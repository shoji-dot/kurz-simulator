/**
 * audioEngine.ts ─ 削開モード MVES WebAudio音響エンジン（T6）
 *
 * 設計書: KURZ_MVES_技術詳細設計書_v1.0.md §4.5
 * 骨材料の基準音程を軸に、残存骨厚（危険構造接近）が薄いほど音程が上がる合成を行う。
 * ノード数は固定・使い回し（GC回避のためノード再生成しない、設計書「負荷」節）。
 * WebAudio非対応環境でも成立する設計（確定事項3）: ensureInit()がAudioContext生成に
 * 失敗した場合は全メソッドが無音でno-opする。
 */

import type { AudioState, BoneMaterial, RemainingThicknessResult, RpmPreset } from './types';
import { rpmFactor } from './removalModel'; // Sprint6・Audio: RPM連動モーター音（既存rpmFactorをそのまま再利用、新規係数表は増やさない）

// ══════════════════════════════════════════════════════════════════════
// 純関数: 材料・危険接近・除去速度 → AudioState
// ══════════════════════════════════════════════════════════════════════

/** 残存骨厚→音程のクロスオーバー距離 mm（これを下回るとthinFactorが立ち上がる） */
export const THIN_FACTOR_DISTANCE_MM = 6;
/** 危険接近時の到達音程上限 Hz（設計書 §4.5） */
export const DANGER_PITCH_HZ = 1200;
/**
 * Sprint6・Audio: RPMプリセット→基音ピッチ倍率の下限。既定rpmPreset='high'（rpmFactor=1.0）で
 * 倍率1.0となり、これまでチューニング済みだったpitch計算をhigh RPM時に完全維持する
 * （low/mid RPMのみ基音を控えめに下げる）。危険接近時のDANGER_PITCH_HZ（警報の上限音程）自体は
 * RPMで変化させない設計とし、低RPMでも危険信号の明瞭さを損なわないようにする
 * （下記pitchHz計算参照。安全教育上、警報音の視認性＝聴認性を優先する判断）。
 */
export const RPM_PITCH_FACTOR_MIN = 0.6;

/**
 * growthRate正規化の基準 mm/s。T4 removalModel.ts の理論最大値
 * （cutting・側面ヒット・pressure=1.0・rpm高・airCells hardness=0.2）
 * = BASE_GROWTH_RATE_MM_S(1.0) × efficiency(1.0) × sideCutBoost(1.3) × pressure(1.0)
 *   × rpmFactor(1.0) ÷ hardness(0.2) = 6.5 mm/s。
 */
export const MAX_EXPECTED_GROWTH_RATE_MM_S = 6.5;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * computeAudioState(): 材料・残存骨厚・除去速度から合成音の状態を算出する純関数。
 * - pitchHz: material.basePitchHz → DANGER_PITCH_HZ を thinFactor で線形補間。
 * - gain: growthRate を理論最大値で正規化した0-1値（削れているほど鳴る）。
 * - toneMix: material.density をそのまま採用（低密度=ノイズ主体、高密度=トーン主体）。
 */
export function computeAudioState(
  material: BoneMaterial,
  remaining: RemainingThicknessResult | null,
  growthRateMmPerSec: number,
  rpmPreset: RpmPreset
): AudioState {
  const dist = remaining?.dist ?? Infinity;
  const thinFactor = clamp01(1 - dist / THIN_FACTOR_DISTANCE_MM);
  // Sprint6・Audio: RPMは基音（材料由来のbasePitchHz）にのみ乗算し、危険接近時のDANGER_PITCH_HZは
  // 固定のまま補間する。こうすることで「低RPMでもモーター音の高さは変わるが、危険域に近づけば
  // 必ず同じ警報音程へ収束する」という安全上望ましい挙動になる。
  const rpmPitchMultiplier = RPM_PITCH_FACTOR_MIN + (1 - RPM_PITCH_FACTOR_MIN) * rpmFactor(rpmPreset);
  const pitchHz = lerp(material.basePitchHz * rpmPitchMultiplier, DANGER_PITCH_HZ, thinFactor);
  const gain = clamp01(growthRateMmPerSec / MAX_EXPECTED_GROWTH_RATE_MM_S);
  const toneMix = clamp01(material.density);
  return { pitchHz, gain, toneMix };
}

// ══════════════════════════════════════════════════════════════════════
// WebAudioクラス（ノード固定・使い回し）
// ══════════════════════════════════════════════════════════════════════

const RAMP_TIME_CONST      = 0.05; // setTargetAtTime時定数 s（急変クリック音防止）
const STOP_RAMP_TIME_CONST = 0.15; // 停止時のフェードアウト時定数 s
const FILTER_Q_MIN = 0.7; // 低密度（蜂巣）: こもった広帯域
const FILTER_Q_MAX = 8.0; // 高密度（otic capsule等）: 鋭い狭帯域

type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

/**
 * DrillAudioEngine: オシレータ（正弦+のこぎり）＋ホワイトノイズ→bandpassフィルタ→マスターゲイン。
 * start()/stop()はノードを生成し直さず gain のみ操作する（設計書「負荷」節）。
 * 使用側は削開開始/停止でstart()/stop()、毎フレームupdate()を呼ぶ想定。
 * アンマウント時は dispose() でAudioContextを閉じること（呼び忘れるとremount毎にリークする）。
 */
export class DrillAudioEngine {
  private ctx: AudioContext | null = null;
  private sineOsc: OscillatorNode | null = null;
  private sawOsc: OscillatorNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private sineGain: GainNode | null = null;
  private sawGain: GainNode | null = null;
  private noiseGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private masterGain: GainNode | null = null;
  private initialized = false;

  /** ノード生成（初回のみ）。WebAudio非対応環境では何もせず ctx=null のまま無音no-opする。 */
  private ensureInit(): void {
    if (this.initialized) return;
    this.initialized = true; // 失敗しても再試行しない（設計書: 音なしでも成立）

    const w = window as WindowWithWebkitAudio;
    const AudioCtx = window.AudioContext ?? w.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    const sineOsc = ctx.createOscillator();
    sineOsc.type = 'sine';
    const sawOsc = ctx.createOscillator();
    sawOsc.type = 'sawtooth';

    const bufferSize = ctx.sampleRate * 2; // 2秒ループのホワイトノイズ
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const sineGain = ctx.createGain();
    const sawGain  = ctx.createGain();
    const noiseGain = ctx.createGain();
    sineGain.gain.value  = 0;
    sawGain.gain.value   = 0;
    noiseGain.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = FILTER_Q_MIN;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;

    sineOsc.connect(sineGain).connect(filter);
    sawOsc.connect(sawGain).connect(filter);
    noiseSource.connect(noiseGain).connect(filter);
    filter.connect(masterGain).connect(ctx.destination);

    sineOsc.start();
    sawOsc.start();
    noiseSource.start();

    this.sineOsc = sineOsc;
    this.sawOsc = sawOsc;
    this.noiseSource = noiseSource;
    this.sineGain = sineGain;
    this.sawGain = sawGain;
    this.noiseGain = noiseGain;
    this.filter = filter;
    this.masterGain = masterGain;
  }

  /** start(): ユーザー操作（削開開始）起点でAudioContextを生成/resumeする（autoplay制約回避）。 */
  start(): void {
    this.ensureInit();
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  /** stop(): ノードは維持したまま masterGain を0へrampする（ノード再生成しない）。 */
  stop(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(0, now, STOP_RAMP_TIME_CONST);
  }

  /** update(): 現在のAudioStateを各ノードへ反映する。削開中は毎フレーム呼び出す想定。 */
  update(state: AudioState): void {
    const ctx = this.ctx;
    if (!ctx || !this.sineOsc || !this.sawOsc || !this.filter || !this.masterGain
      || !this.sineGain || !this.sawGain || !this.noiseGain) return;
    const now = ctx.currentTime;

    this.sineOsc.frequency.setTargetAtTime(state.pitchHz, now, RAMP_TIME_CONST);
    this.sawOsc.frequency.setTargetAtTime(state.pitchHz, now, RAMP_TIME_CONST);
    this.filter.frequency.setTargetAtTime(state.pitchHz, now, RAMP_TIME_CONST);

    const toneMix = state.toneMix;
    this.sineGain.gain.setTargetAtTime(toneMix, now, RAMP_TIME_CONST);
    this.sawGain.gain.setTargetAtTime(toneMix * 0.4, now, RAMP_TIME_CONST);
    this.noiseGain.gain.setTargetAtTime(1 - toneMix, now, RAMP_TIME_CONST);
    this.filter.Q.setTargetAtTime(lerp(FILTER_Q_MIN, FILTER_Q_MAX, toneMix), now, RAMP_TIME_CONST);

    this.masterGain.gain.setTargetAtTime(state.gain, now, RAMP_TIME_CONST);
  }

  /** dispose(): アンマウント時にAudioContextを閉じ、参照を破棄する。 */
  dispose(): void {
    if (!this.ctx) return;
    void this.ctx.close();
    this.ctx = null;
    this.initialized = false;
    this.sineOsc = null;
    this.sawOsc = null;
    this.noiseSource = null;
    this.sineGain = null;
    this.sawGain = null;
    this.noiseGain = null;
    this.filter = null;
    this.masterGain = null;
  }
}
