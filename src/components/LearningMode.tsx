import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { useSimStore } from '../store/useSimStore';
import { kurzProducts } from '../data/products';
import { AnatomyScene } from '../scenes/AnatomyScene';
import type { ViewMode } from '../scenes/AnatomyScene';
import { DrillTrainingScene, DRILL_STEPS } from '../scenes/DrillTrainingScene';
import { DANGER_ZONES, FACIAL_ZONES, VASCULAR_ZONES } from '../data/dangerZones';
import {
  DEFAULT_MODES,
  DEFAULT_AURICLE_TRANSFORM,
  type OpacityMode,
  type StructureKey,
  type VisibilityMap,
  type AuricleTransform,
} from '../scenes/models/RealAnatomyModels';

// ── 解剖構造リスト ────────────────────────────────────────────────
const anatomyStructures = [
  { id: 'tympanoCavity', label: '鼓室 (Tympanic Cavity)', desc: '中耳腔。6つの壁で構成される空間。内側壁に岬角・卵円窓・正円窓が位置し、顔面神経水平部・鼓索神経が走行する。耳管で鼻咽腔に通じる。', color: '#e8c0a0' },
  { id: 'malleus',  label: 'ツチ骨 (Malleus)',  desc: '鼓膜に付着する最外側の耳小骨。鼓膜の振動を受け取りキヌタ骨に伝達。マニュブリウム（柄）とヘッド部からなる。', color: '#e6a93a' },
  { id: 'incus',   label: 'キヌタ骨 (Incus)',   desc: '中間に位置する耳小骨。体部・短突起・長突起から構成。慢性中耳炎では長突起尖端から壊死しやすい。', color: '#d9892a' },
  { id: 'stapes',  label: 'アブミ骨 (Stapes)',  desc: '最内側かつ最小の耳小骨。頭部・前後弓・底板で構成。底板が卵円窓を塞ぎ蝸牛へ振動を伝える。', color: '#f2cb54' },
  { id: 'membrane', label: '鼓膜 (Tympanic M.)', desc: '外耳道と鼓室を隔てる薄い膜。厚さ約0.1mm。中央部（臍）にツチ骨が付着。', color: '#f5e6c8' },
];

// ── 3D表示切替アイテム定義 ──────────────────────────────────────
const VIS_ITEMS: { key: StructureKey; label: string; color: string; indent?: boolean }[] = [
  { key: 'bone',          label: '側頭骨',  color: '#f2ead8' },
  { key: 'auricle',       label: '耳介',    color: '#e8c8a8' },
  { key: 'malleus',       label: 'ツチ骨 (Malleus)',  color: '#e6a93a', indent: true },
  { key: 'incus',         label: 'キヌタ骨 (Incus)',  color: '#d9892a', indent: true },
  { key: 'stapes',        label: 'アブミ骨 (Stapes)', color: '#f2cb54', indent: true },
  { key: 'tympanic',      label: '鼓膜',    color: '#f8d8c0' },
  { key: 'innerEar',      label: '内耳',    color: '#60b8e0' },
  { key: 'facialNerve',   label: '顔面神経', color: '#f5d820' },
  { key: 'chordaTympani', label: '鼓索神経', color: '#f0b830' },
  { key: 'eac',           label: '外耳道',  color: '#d8c8a0' },
  { key: 'roundWindow',   label: '正円窓',  color: '#5888a8' },
];

const CYCLE: OpacityMode[] = ['solid', 'ghost', 'hidden'];
const MODE_LABEL: Record<OpacityMode, string> = { solid: '実体', ghost: '半透明', hidden: '非表示' };
const MODE_BG: Record<OpacityMode, string> = {
  solid:  'var(--accent)',
  ghost:  'rgba(0,180,216,0.30)',
  hidden: 'rgba(255,255,255,0.07)',
};
const MODE_FG: Record<OpacityMode, string> = {
  solid:  '#001a20',
  ghost:  '#7dd8e8',
  hidden: '#555',
};

// ── 術式データ ─────────────────────────────────────────────────────
const procedures = [
  {
    title: 'PORP 設置手順（ベル型）',
    steps: [
      'アブミ骨頭部の露出・確認：上部構造の可動性チェック',
      'サイジング：サイザーでツチ骨柄〜アブミ骨頭部距離を計測',
      '適切シャフト長のPORPを選択（通常+0.5mm余裕）',
      'アブミ骨頭部にベル部を設置（正中・垂直を確認）',
      '頭板と鼓膜の間に薄い軟骨片を挿入',
      '鼓膜フラップを戻しPORPを被覆',
      '設置後の安定性・角度を確認',
    ],
  },
  {
    title: 'TORP 設置手順（フラット型）',
    steps: [
      'アブミ骨底板の可動性確認（固定なら先に解放）',
      '必要に応じて底板上に軟骨または筋膜を置く',
      'サイジング：鼓膜〜底板間距離を計測',
      '適切シャフト長のTORPを選択',
      'フット部を底板中央に設置（前後左右のバランス確認）',
      '頭板を鼓膜フラップに当て、軽く張力がかかる高さに調整',
      '頭板上に軟骨片を挿入後、鼓膜閉鎖',
    ],
  },
];

// ── ビューモード定義 ──────────────────────────────────────────────
const VIEW_MODES: { mode: ViewMode; icon: string; label: string; desc: string }[] = [
  { mode: 'normal',     icon: '👁',  label: '通常',   desc: '標準3Dビュー' },
  { mode: 'microscope', icon: '🔬', label: '顕微鏡', desc: '手術用顕微鏡視野（狭FOV・ビネット）' },
  { mode: 'endoscope',  icon: '🔭', label: '内視鏡', desc: '硬性内視鏡視野（広角・円形）' },
];

// ══════════════════════════════════════════════════════════════════
export function LearningMode() {
  const { learningTab, setLearningTab, highlightedStructure, setHighlightedStructure, selectedPatientId } = useSimStore();
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  // 3D表示モード
  const [vis, setVis] = useState<VisibilityMap>({});
  const cycleMode = (key: StructureKey) => {
    const curr = vis[key] ?? DEFAULT_MODES[key];
    const next = CYCLE[(CYCLE.indexOf(curr) + 1) % CYCLE.length];
    setVis(v => ({ ...v, [key]: next }));
  };
  const getMode = (key: StructureKey): OpacityMode => vis[key] ?? DEFAULT_MODES[key];

  // 耳小骨3骨の一括切替（代表値 = ツチ骨のモードを基準に次状態へ）
  const ossicleGroupMode = (): OpacityMode => getMode('malleus');
  const cycleOssicles = () => {
    const curr = ossicleGroupMode();
    const next = CYCLE[(CYCLE.indexOf(curr) + 1) % CYCLE.length];
    setVis(v => ({ ...v, malleus: next, incus: next, stapes: next }));
  };

  // 外殻グループ（側頭骨 + 外耳道 + 耳介）
  const shellGroupMode = (): OpacityMode => getMode('bone');
  const cycleShell = () => {
    const curr = shellGroupMode();
    const next = CYCLE[(CYCLE.indexOf(curr) + 1) % CYCLE.length];
    setVis(v => ({ ...v, bone: next, eac: next, auricle: next }));
  };

  // 神経グループ（顔面神経 + 鼓索神経）
  const nerveGroupMode = (): OpacityMode => getMode('facialNerve');
  const cycleNerves = () => {
    const curr = nerveGroupMode();
    const next = CYCLE[(CYCLE.indexOf(curr) + 1) % CYCLE.length];
    setVis(v => ({ ...v, facialNerve: next, chordaTympani: next }));
  };

  // 内耳グループ（内耳 + 正円窓）
  const innerEarGroupMode = (): OpacityMode => getMode('innerEar');
  const cycleInnerEar = () => {
    const curr = innerEarGroupMode();
    const next = CYCLE[(CYCLE.indexOf(curr) + 1) % CYCLE.length];
    setVis(v => ({ ...v, innerEar: next, roundWindow: next }));
  };

  // ズームレベル
  const [zoomLevel, setZoomLevel] = useState(0);

  // 削開タブ状態
  const [drillScenario, setDrillScenario] = useState<'s1' | 's2' | 's3'>('s1');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  // ── S3 アニメーション状態 ─────────────────────────────────────
  const [s3StepIndex, setS3StepIndex] = useState(0);
  const [s3IsPlaying, setS3IsPlaying] = useState(false);

  const handleS3Next = useCallback(() => {
    setS3StepIndex(i => Math.min(i + 1, DRILL_STEPS.length - 1));
  }, []);
  const handleS3Prev = useCallback(() => {
    setS3StepIndex(i => Math.max(i - 1, 0));
  }, []);
  const handleS3StepComplete = useCallback(() => {
    setS3StepIndex(i => {
      if (i < DRILL_STEPS.length - 1) return i + 1;
      setS3IsPlaying(false);
      return i;
    });
  }, []);

  // オートプレイ: 1ステップ5秒で自動進行
  useEffect(() => {
    if (!s3IsPlaying) return;
    const timer = setTimeout(() => {
      setS3StepIndex(i => {
        if (i < DRILL_STEPS.length - 1) return i + 1;
        setS3IsPlaying(false);
        return i;
      });
    }, 5000);
    return () => clearTimeout(timer);
  }, [s3IsPlaying, s3StepIndex]);

  // ── 耳介フリームーブ（デバッグ用トランスフォーム）───────────────
  const [auricleTransform, setAuricleTransform] = useState<AuricleTransform>(DEFAULT_AURICLE_TRANSFORM);
  const setAuriclePos = (axis: 0 | 1 | 2, val: number) =>
    setAuricleTransform(t => {
      const p = [...t.position] as [number, number, number];
      p[axis] = val;
      return { ...t, position: p };
    });
  const setAuricleRot = (axis: 0 | 1 | 2, deg: number) =>
    setAuricleTransform(t => {
      const r = [...t.rotation] as [number, number, number];
      r[axis] = (deg * Math.PI) / 180;
      return { ...t, rotation: r };
    });
  const getAuricleRotDeg = (axis: 0 | 1 | 2) =>
    Math.round((auricleTransform.rotation[axis] * 180) / Math.PI);
  const setAuricleScale = (axis: 0 | 1 | 2, val: number) =>
    setAuricleTransform(t => {
      const s = [...(t.scale ?? [1, 1, 1])] as [number, number, number];
      s[axis] = val;
      return { ...t, scale: s };
    });
  const getAuricleScale = (axis: 0 | 1 | 2) =>
    (auricleTransform.scale ?? [1, 1, 1])[axis];

  // ── ビューモード（解剖タブ用）───────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('normal');

  // タブ変更時にビューモードをリセット
  useEffect(() => {
    if (learningTab !== 'anatomy') setViewMode('normal');
  }, [learningTab]);

  const selProd = kurzProducts.find((p) => p.id === selectedProduct);
  const showTympanoCavity = highlightedStructure === 'tympanoCavity';
  const auricleMode = vis.auricle ?? DEFAULT_MODES.auricle;
  const showPinna = auricleMode !== 'hidden';
  const visForScene: VisibilityMap = { ...vis, auricle: 'hidden' };

  const TAB_LIST = [
    { key: 'anatomy',   label: '🦴 解剖' },
    { key: 'products',  label: '🔩 製品' },
    { key: 'procedure', label: '📋 術式' },
    { key: 'drilling',  label: '🔴 削開' },
  ] as const;

  // ── CSS オーバーレイ（顕微鏡/内視鏡効果）──────────────────────
  const vignetteStyle: CSSProperties | null =
    viewMode === 'microscope' ? {
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
      background: 'radial-gradient(circle at center, transparent 26%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.92) 68%, black 82%)',
    } :
    viewMode === 'endoscope' ? {
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
      background: 'radial-gradient(circle at center, rgba(0,0,0,0.0) 36%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.88) 62%, black 72%)',
    } : null;

  // 内視鏡ビュー: 円形クリップ用
  const canvasWrapperStyle: CSSProperties = {
    position: 'relative',
    ...(viewMode === 'endoscope' ? {
      clipPath: 'circle(43% at center)',
      background: 'black',
    } : {}),
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
      {/* Tabs */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="tabs">
          {TAB_LIST.map(({ key, label }) => (
            <button
              key={key}
              className={`tab ${learningTab === key ? 'active' : ''}`}
              onClick={() => {
                setLearningTab(key);
                if (key !== 'drilling') setSelectedZoneId(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="layout-split" style={{ flex: 1 }}>
        {/* 3D Canvas */}
        <div className="canvas-wrapper" style={canvasWrapperStyle}>
          {learningTab === 'drilling' ? (
            <DrillTrainingScene
              scenario={drillScenario}
              selectedZoneId={selectedZoneId}
              onZoneSelect={setSelectedZoneId}
              s3StepIndex={s3StepIndex}
              s3IsPlaying={s3IsPlaying}
              onS3StepComplete={handleS3StepComplete}
            />
          ) : (
            <AnatomyScene
              vis={visForScene}
              zoomLevel={zoomLevel}
              showTympanoCavity={showTympanoCavity}
              showPinna={showPinna}
              pinnaMode={auricleMode === 'ghost' ? 'ghost' : 'solid'}
              patientId={selectedPatientId}
              viewMode={viewMode}
              auricleTransform={auricleTransform}
              highlightedKey={highlightedStructure}
            />
          )}

          {/* CSS ビネット/内視鏡オーバーレイ */}
          {vignetteStyle && <div style={vignetteStyle} />}

          {/* 内視鏡: 青みフィルター */}
          {viewMode === 'endoscope' && (
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9,
              background: 'rgba(10, 25, 60, 0.08)',
            }} />
          )}

          {/* ── ビューモードトグル（解剖タブ）── */}
          {learningTab === 'anatomy' && (
            <div style={{
              position: 'absolute', top: 12, right: 16, zIndex: 15,
              display: 'flex', gap: 5,
            }}>
              {VIEW_MODES.map(({ mode, icon, label, desc }) => (
                <button
                  key={mode}
                  title={desc}
                  onClick={() => setViewMode(mode)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 7,
                    border: `1px solid ${viewMode === mode ? 'var(--accent)' : 'rgba(255,255,255,0.18)'}`,
                    background: viewMode === mode ? 'rgba(0,180,216,0.22)' : 'rgba(10,15,26,0.78)',
                    color: viewMode === mode ? 'var(--accent)' : '#7a8898',
                    fontSize: 11, fontWeight: viewMode === mode ? 700 : 400,
                    cursor: 'pointer', backdropFilter: 'blur(6px)',
                    transition: 'all .15s',
                  }}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          )}

          {/* ── 耳介フリームーブ デバッグパネル（開発環境のみ） ── */}
          {import.meta.env.DEV && showPinna && learningTab === 'anatomy' && (
            <div style={{
              position: 'absolute', bottom: 12, left: 12, zIndex: 20,
              background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(230,169,58,0.45)',
              borderRadius: 10, padding: '10px 14px', minWidth: 230,
              color: '#e6c87a', fontSize: 11,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 12 }}>🦻 耳介 トランスフォーム</span>
                <button
                  onClick={() => setAuricleTransform(DEFAULT_AURICLE_TRANSFORM)}
                  style={{ fontSize: 10, padding: '2px 7px', background: 'rgba(255,80,80,0.18)', border: '1px solid rgba(255,80,80,0.4)', borderRadius: 5, color: '#ff8080', cursor: 'pointer' }}
                >リセット</button>
              </div>
              {/* 位置 */}
              {(['X','Y','Z'] as const).map((ax, i) => (
                <div key={`pos${ax}`} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 42, opacity: 0.7 }}>位置{ax}</span>
                  <input type="range" min={-60} max={60} step={0.5}
                    value={auricleTransform.position[i]}
                    onChange={e => setAuriclePos(i as 0|1|2, parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: '#e6a93a' }}
                  />
                  <span style={{ width: 36, textAlign: 'right', opacity: 0.9 }}>{auricleTransform.position[i].toFixed(1)}</span>
                </div>
              ))}
              {/* 回転 */}
              {(['X','Y','Z'] as const).map((ax, i) => (
                <div key={`rot${ax}`} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 42, opacity: 0.7 }}>回転{ax}</span>
                  <input type="range" min={-180} max={180} step={1}
                    value={getAuricleRotDeg(i as 0|1|2)}
                    onChange={e => setAuricleRot(i as 0|1|2, parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: '#e6a93a' }}
                  />
                  <span style={{ width: 36, textAlign: 'right', opacity: 0.9 }}>{getAuricleRotDeg(i as 0|1|2)}°</span>
                </div>
              ))}
              {/* 傾き（スケール） */}
              <div style={{ borderTop: '1px solid rgba(230,169,58,0.2)', margin: '6px 0 4px' }} />
              {(['X','Y','Z'] as const).map((ax, i) => (
                <div key={`sc${ax}`} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 42, opacity: 0.7 }}>傾き{ax}</span>
                  <input type="range" min={0.3} max={2.0} step={0.01}
                    value={getAuricleScale(i as 0|1|2)}
                    onChange={e => setAuricleScale(i as 0|1|2, parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: '#60c8b0' }}
                  />
                  <span style={{ width: 36, textAlign: 'right', opacity: 0.9 }}>{getAuricleScale(i as 0|1|2).toFixed(2)}</span>
                </div>
              ))}
              {/* 表裏反転 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <span style={{ opacity: 0.7 }}>表裏反転（X軸）</span>
                <input type="checkbox" checked={auricleTransform.flip}
                  onChange={e => setAuricleTransform(t => ({ ...t, flip: e.target.checked }))}
                  style={{ accentColor: '#e6a93a', width: 14, height: 14, cursor: 'pointer' }}
                />
              </div>
              {/* 値コピー */}
              <button
                onClick={() => {
                  const p = auricleTransform.position.map(v => v.toFixed(2)).join(', ');
                  const r = auricleTransform.rotation.map(v => v.toFixed(4)).join(', ');
                  const s = (auricleTransform.scale ?? [1,1,1]).map(v => v.toFixed(3)).join(', ');
                  const text = `position: [${p}]\nrotation: [${r}]\nscale: [${s}]\nflip: ${auricleTransform.flip}`;
                  navigator.clipboard.writeText(text);
                }}
                style={{ marginTop: 8, width: '100%', fontSize: 10, padding: '4px 0',
                  background: 'rgba(0,180,216,0.15)', border: '1px solid rgba(0,180,216,0.35)',
                  borderRadius: 5, color: '#7dd8e8', cursor: 'pointer' }}
              >📋 値をコピー</button>
            </div>
          )}

          {/* 操作ヒント */}
          <div className="canvas-overlay top-left">
            <div style={{ background: 'rgba(0,0,0,.6)', padding: '6px 10px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>
              {learningTab === 'drilling' && drillScenario === 's2'
                ? '球をクリック: 危険部位を選択 ｜ ドラッグ: 回転'
                : learningTab === 'drilling' && drillScenario === 's3'
                ? '▶ 再生で自動進行 ｜ ドラッグ: 自由回転'
                : 'ドラッグ: 回転 ｜ ホイール: ズーム'}
            </div>
          </div>

          {/* ビューモードラベル */}
          {learningTab === 'anatomy' && viewMode !== 'normal' && (
            <div className="canvas-overlay bottom-left">
              <div style={{
                background: 'rgba(0,180,216,.12)', border: '1px solid var(--accent)',
                padding: '5px 10px', borderRadius: 6, color: 'var(--accent)',
                backdropFilter: 'blur(4px)', fontSize: 12,
              }}>
                {viewMode === 'microscope' ? '🔬 手術顕微鏡ビュー' : '🔭 硬性内視鏡ビュー'}
              </div>
            </div>
          )}

          {/* 危険部位選択インジケーター（S2） */}
          {learningTab === 'drilling' && drillScenario === 's2' && selectedZoneId && (() => {
            const zone = DANGER_ZONES.find(z => z.id === selectedZoneId);
            if (!zone) return null;
            return (
              <div className="canvas-overlay bottom-left">
                <div style={{
                  background: 'rgba(10,10,20,.82)',
                  border: `1px solid ${zone.color}`,
                  padding: '8px 12px', borderRadius: 8,
                  backdropFilter: 'blur(4px)',
                }}>
                  <span style={{ color: zone.color, fontWeight: 700, fontSize: 13 }}>
                    ⚠ {zone.nameJa}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* S3: ステッパー表示 */}
          {learningTab === 'drilling' && drillScenario === 's3' && (
            <div style={{
              position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
              zIndex: 15, display: 'flex', gap: 6,
            }}>
              {DRILL_STEPS.map((_, i) => (
                <div
                  key={i}
                  onClick={() => { setS3StepIndex(i); setS3IsPlaying(false); }}
                  style={{
                    width: i === s3StepIndex ? 28 : 8,
                    height: 8, borderRadius: 4,
                    background: i === s3StepIndex
                      ? 'var(--accent)'
                      : i < s3StepIndex ? 'rgba(0,180,216,0.5)' : 'rgba(255,255,255,0.18)',
                    cursor: 'pointer',
                    transition: 'all .3s',
                  }}
                />
              ))}
            </div>
          )}

          {/* 強調表示中の構造名 + 説明パネル（解剖タブ） */}
          {learningTab === 'anatomy' && highlightedStructure && (() => {
            const s = anatomyStructures.find(x => x.id === highlightedStructure);
            if (!s) return null;
            return (
              <div style={{
                position: 'absolute', bottom: 60, left: 12, zIndex: 15,
                maxWidth: 280,
                background: 'rgba(6,10,26,0.88)', backdropFilter: 'blur(8px)',
                border: `1px solid ${s.color}66`,
                borderRadius: 10, padding: '10px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0, boxShadow: `0 0 6px ${s.color}` }} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: s.color }}>{s.label}</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{s.desc}</p>
              </div>
            );
          })()}

          {/* ズームボタン（削開タブ以外）*/}
          {learningTab !== 'drilling' && (
            <div style={{
              position: 'absolute', bottom: 16, right: 16,
              display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10,
            }}>
              {[
                { label: '＋', delta: 1, title: 'ズームイン' },
                { label: '－', delta: -1, title: 'ズームアウト' },
              ].map(({ label, delta, title }) => (
                <button
                  key={label}
                  title={title}
                  onClick={() => setZoomLevel(z => z + delta)}
                  style={{
                    width: 34, height: 34, borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(10,15,26,0.80)', color: '#c0d8e8',
                    fontSize: 18, cursor: 'pointer', backdropFilter: 'blur(6px)',
                    lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, transition: 'background .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,180,216,0.22)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(10,15,26,0.80)')}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ═══ Sidebar ═══ */}
        <div className="sidebar">
          {/* ── 解剖タブ ── */}
          {learningTab === 'anatomy' && (
            <>
              {/* ビューモード説明 */}
              {viewMode !== 'normal' && (
                <div className="card" style={{ padding: '10px 14px', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 12, marginBottom: 5 }}>
                    {viewMode === 'microscope' ? '🔬 手術顕微鏡ビュー' : '🔭 硬性内視鏡ビュー'}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                    {viewMode === 'microscope'
                      ? 'FOV 11° の狭い視野で術野を拡大表示。実際の手術顕微鏡（例: Zeiss Pentero）と同等の視野角。外周ビネットが特徴的な顕微鏡視野を再現。'
                      : 'FOV 112° の広角レンズ効果。Hopkins 式硬性内視鏡（0° または 30°）の視野を模擬。円形視野と周辺の暗部が内視鏡視野の特徴。'}
                  </p>
                </div>
              )}

              <div className="card">
                <div className="section-title">構造を選択してハイライト</div>
                {anatomyStructures.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setHighlightedStructure(highlightedStructure === s.id ? null : s.id)}
                    style={{
                      padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 6,
                      background: highlightedStructure === s.id ? 'rgba(0,180,216,.15)' : 'rgba(255,255,255,.03)',
                      border: `1px solid ${highlightedStructure === s.id ? 'var(--accent)' : 'var(--border)'}`,
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{s.label}</span>
                    </div>
                    {highlightedStructure === s.id && (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 6 }}>{s.desc}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="section-title">3D 表示切替</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                  クリックで 実体 → 半透明 → 非表示 を切替
                </div>

                {/* ── グループ一括切替 ── */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.06em', marginBottom: 5 }}>
                    グループ一括切替
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {[
                      { label: '🦴 外殻', mode: shellGroupMode(), onClick: cycleShell, color: '#f2ead8' },
                      { label: '🔗 耳小骨', mode: ossicleGroupMode(), onClick: cycleOssicles, color: '#e6a93a' },
                      { label: '⚡ 神経', mode: nerveGroupMode(), onClick: cycleNerves, color: '#f5d820' },
                      { label: '🐚 内耳', mode: innerEarGroupMode(), onClick: cycleInnerEar, color: '#60b8e0' },
                    ].map(({ label, mode, onClick, color }) => (
                      <button
                        key={label}
                        onClick={onClick}
                        style={{
                          flex: '1 1 80px',
                          padding: '5px 6px',
                          borderRadius: 6,
                          border: `1px solid ${mode === 'solid' ? color : mode === 'ghost' ? color + '66' : 'var(--border)'}`,
                          background: mode === 'solid' ? color + '22' : mode === 'ghost' ? color + '11' : 'rgba(255,255,255,0.03)',
                          color: mode === 'hidden' ? 'var(--text-muted)' : color,
                          fontSize: 10, fontWeight: 600, cursor: 'pointer',
                          textAlign: 'center', transition: 'all .15s',
                        }}
                      >
                        <div>{label}</div>
                        <div style={{ fontSize: 9, opacity: 0.7, marginTop: 1 }}>{MODE_LABEL[mode]}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', marginBottom: 8 }} />

                {VIS_ITEMS.map(({ key, label, color, indent }) => {
                  const mode = getMode(key);
                  return (
                    <div key={key}>
                      {key === 'malleus' && (
                        <div style={{ padding: '7px 2px 3px', marginTop: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#e0a93a', letterSpacing: '.04em', opacity: 0.7 }}>
                            耳小骨連鎖 (Ossicular Chain)
                          </span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 2px', paddingLeft: indent ? 14 : 2, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, opacity: mode === 'hidden' ? 0.2 : mode === 'ghost' ? 0.5 : 1, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: mode === 'hidden' ? 'var(--text-muted)' : 'var(--text-primary)' }}>{label}</span>
                        </div>
                        <button
                          onClick={() => cycleMode(key)}
                          style={{ padding: '3px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: MODE_BG[mode], color: MODE_FG[mode], minWidth: 52, transition: 'background .15s' }}
                        >
                          {MODE_LABEL[mode]}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="card">
                <div className="section-title">耳小骨連鎖の音響伝達</div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  鼓膜の振動 → ツチ骨 → キヌタ骨 → アブミ骨 → 卵円窓 → 蝸牛<br /><br />
                  KURZ人工耳小骨はこの連鎖を再建します。PORPはキヌタ骨欠損を、TORPは全耳小骨欠損を補填します。
                </p>
              </div>
            </>
          )}

          {/* ── 製品タブ ── */}
          {learningTab === 'products' && (
            <>
              <div className="card" style={{ padding: '12px' }}>
                <div className="section-title">製品を選択</div>
                {kurzProducts.map((p) => (
                  <div
                    key={p.id}
                    className={`selectable-card ${selectedProduct === p.id ? 'selected' : ''}`}
                    style={{ marginBottom: 8 }}
                    onClick={() => setSelectedProduct(selectedProduct === p.id ? null : p.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</span>
                      <span className={`badge badge-${p.type === 'PORP' ? 'blue' : p.type === 'TORP' ? 'green' : 'yellow'}`}>
                        {p.type}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>フット: {p.footType} ｜ 頭板: {p.headPlateDiameter}mm</div>
                  </div>
                ))}
              </div>

              {selProd && (
                <div className="card">
                  <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--accent)' }}>{selProd.name}</div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>{selProd.description}</p>
                  <div className="section-title">仕様</div>
                  {[
                    ['シャフト長', selProd.shaftLengths.map((l) => `${l}`).join(', ') + ' mm'],
                    ['頭板径', `${selProd.headPlateDiameter} mm`],
                    ['フット径', `${selProd.footDiameter} mm`],
                    ['重量', `${selProd.weight} mg`],
                    ['MRI安全', selProd.mriSafe],
                    ['フット型', selProd.footType],
                  ].map(([k, v]) => (
                    <div key={k} className="info-row">
                      <span className="label">{k}</span>
                      <span className="value" style={{ fontSize: 12 }}>{v}</span>
                    </div>
                  ))}
                  <div className="section-title" style={{ marginTop: 12 }}>適応</div>
                  <div className="tag-list">
                    {selProd.indications.map((ind) => <span key={ind} className="tag">{ind}</span>)}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── 術式タブ ── */}
          {learningTab === 'procedure' && (
            <>
              {procedures.map((proc) => (
                <div key={proc.title} className="card">
                  <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>{proc.title}</div>
                  <ol style={{ paddingLeft: 18 }}>
                    {proc.steps.map((step, i) => (
                      <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 6 }}>{step}</li>
                    ))}
                  </ol>
                </div>
              ))}
              <div className="card">
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>⚠️ 重要な注意点</div>
                <ul style={{ paddingLeft: 16, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.8 }}>
                  <li>シャフト長の過不足は術後成績に直結</li>
                  <li>軟骨片の挿入で鼓膜穿孔・押出しを防止</li>
                  <li>チタン製は電気メスを直接当てない</li>
                  <li>MRI対応だが術前に金属確認票を記載</li>
                </ul>
              </div>
            </>
          )}

          {/* ── 削開タブ ── */}
          {learningTab === 'drilling' && (
            <>
              {/* シナリオセレクター */}
              <div className="card">
                <div className="section-title">シナリオ選択</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                  {([
                    { key: 's1', label: 'S1: 解剖探索', desc: '自由に観察' },
                    { key: 's2', label: 'S2: 危険部位', desc: 'クリックで確認' },
                    { key: 's3', label: 'S3: 削開動画', desc: '5ステップ手術' },
                  ] as const).map(({ key, label, desc }) => (
                    <button
                      key={key}
                      onClick={() => {
                        setDrillScenario(key);
                        setSelectedZoneId(null);
                        if (key === 's3') { setS3StepIndex(0); setS3IsPlaying(false); }
                      }}
                      style={{
                        flex: '1 1 80px', padding: '10px 8px', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${drillScenario === key ? 'var(--accent)' : 'var(--border)'}`,
                        background: drillScenario === key ? 'rgba(0,180,216,.15)' : 'rgba(255,255,255,.03)',
                        color: drillScenario === key ? 'var(--accent)' : 'var(--text-secondary)',
                        fontSize: 11, textAlign: 'center', transition: 'all .15s',
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 10, opacity: 0.75 }}>{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── S1 ── */}
              {drillScenario === 's1' && (
                <div className="card">
                  <div className="section-title">S1 — 解剖探索</div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
                    側頭骨と中耳構造を自由に観察してください。ドラッグで回転、ホイールでズームができます。
                  </p>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>学習チェックポイント</div>
                    {[
                      '顔面神経の走行（水平部・膝部・乳突部）',
                      '卵円窓と正円窓の位置関係',
                      'S状静脈洞の後乳突部での走行',
                      '蝸牛と半規管の3D的位置関係',
                    ].map((item, i) => (
                      <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', lineHeight: 1.5 }}>
                        ✓ {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── S2 ── */}
              {drillScenario === 's2' && (
                <>
                  <div className="card" style={{ padding: '10px 14px' }}>
                    <div className="section-title">危険部位警告システム</div>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
                      {[['#f5d820', '顔面神経系'], ['#4477ff', '血管系']].map(([color, label]) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                          <div style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
                          {label}
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>● 核（小）: 危険域 2mm以内　◯ 外周（大）: 警告域 5mm以内</div>
                  </div>

                  {/* 顔面神経系 */}
                  <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f5d820' }} />
                      <div className="section-title" style={{ margin: 0 }}>顔面神経系</div>
                    </div>
                    {FACIAL_ZONES.map((zone) => (
                      <div
                        key={zone.id}
                        onClick={() => setSelectedZoneId(selectedZoneId === zone.id ? null : zone.id)}
                        style={{
                          padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 6,
                          background: selectedZoneId === zone.id ? 'rgba(245,216,32,.10)' : 'rgba(255,255,255,.03)',
                          border: `1px solid ${selectedZoneId === zone.id ? '#f5d820' : 'var(--border)'}`,
                          transition: 'all .15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: selectedZoneId === zone.id ? 6 : 0 }}>
                          <span style={{ fontSize: 14 }}>⚡</span>
                          <span style={{ fontWeight: 600, fontSize: 13, color: selectedZoneId === zone.id ? '#f5d820' : 'var(--text-primary)' }}>
                            {zone.nameJa}
                          </span>
                        </div>
                        {selectedZoneId === zone.id && (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                            <p style={{ marginBottom: 6 }}>{zone.shortDescJa}</p>
                            <div style={{ background: 'rgba(245,216,32,.06)', border: '1px solid rgba(245,216,32,.20)', borderRadius: 6, padding: '6px 8px', marginBottom: 5 }}>
                              <div style={{ fontSize: 11, color: '#c8b010', fontWeight: 600, marginBottom: 3 }}>臨床メモ</div>
                              <div style={{ fontSize: 11 }}>{zone.clinicalNoteJa}</div>
                            </div>
                            <div style={{ background: 'rgba(220,50,50,.08)', border: '1px solid rgba(220,50,50,.25)', borderRadius: 6, padding: '5px 8px' }}>
                              <div style={{ fontSize: 11, color: '#dd6060', fontWeight: 600, marginBottom: 2 }}>合併症リスク</div>
                              <div style={{ fontSize: 11, color: '#dd8080' }}>{zone.complicationJa}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* 血管系 */}
                  <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4477ff' }} />
                      <div className="section-title" style={{ margin: 0 }}>血管系</div>
                    </div>
                    {VASCULAR_ZONES.map((zone) => (
                      <div
                        key={zone.id}
                        onClick={() => setSelectedZoneId(selectedZoneId === zone.id ? null : zone.id)}
                        style={{
                          padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 6,
                          background: selectedZoneId === zone.id ? 'rgba(68,119,255,.10)' : 'rgba(255,255,255,.03)',
                          border: `1px solid ${selectedZoneId === zone.id ? '#4477ff' : 'var(--border)'}`,
                          transition: 'all .15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: selectedZoneId === zone.id ? 6 : 0 }}>
                          <span style={{ fontSize: 14 }}>💧</span>
                          <span style={{ fontWeight: 600, fontSize: 13, color: selectedZoneId === zone.id ? '#6699ff' : 'var(--text-primary)' }}>
                            {zone.nameJa}
                          </span>
                        </div>
                        {selectedZoneId === zone.id && (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                            <p style={{ marginBottom: 6 }}>{zone.shortDescJa}</p>
                            <div style={{ background: 'rgba(68,119,255,.06)', border: '1px solid rgba(68,119,255,.20)', borderRadius: 6, padding: '6px 8px', marginBottom: 5 }}>
                              <div style={{ fontSize: 11, color: '#7799dd', fontWeight: 600, marginBottom: 3 }}>臨床メモ</div>
                              <div style={{ fontSize: 11 }}>{zone.clinicalNoteJa}</div>
                            </div>
                            <div style={{ background: 'rgba(220,50,50,.08)', border: '1px solid rgba(220,50,50,.25)', borderRadius: 6, padding: '5px 8px' }}>
                              <div style={{ fontSize: 11, color: '#dd6060', fontWeight: 600, marginBottom: 2 }}>合併症リスク</div>
                              <div style={{ fontSize: 11, color: '#dd8080' }}>{zone.complicationJa}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── S3 ── */}
              {drillScenario === 's3' && (
                <>
                  {/* 現在のステップ */}
                  <div className="card" style={{ padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        ステップ {s3StepIndex + 1} / {DRILL_STEPS.length}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {DRILL_STEPS.map((_, i) => (
                          <div
                            key={i}
                            onClick={() => { setS3StepIndex(i); setS3IsPlaying(false); }}
                            style={{
                              width: i === s3StepIndex ? 18 : 7, height: 7, borderRadius: 4,
                              background: i === s3StepIndex ? 'var(--accent)' : i < s3StepIndex ? 'rgba(0,180,216,0.45)' : 'rgba(255,255,255,0.15)',
                              cursor: 'pointer', transition: 'all .3s',
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)', marginBottom: 6 }}>
                      {DRILL_STEPS[s3StepIndex].title}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 10 }}>
                      {DRILL_STEPS[s3StepIndex].subtitle}
                    </p>

                    {/* 臨床メモ */}
                    <div style={{
                      background: 'rgba(0,180,216,0.07)', border: '1px solid rgba(0,180,216,0.20)',
                      borderRadius: 7, padding: '8px 10px', marginBottom: 12,
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 3 }}>💡 臨床メモ</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {DRILL_STEPS[s3StepIndex].clinicalNote}
                      </div>
                    </div>

                    {/* 再生コントロール */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        onClick={handleS3Prev}
                        disabled={s3StepIndex === 0}
                        style={{
                          width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)',
                          background: 'rgba(255,255,255,0.05)', color: s3StepIndex === 0 ? '#333' : '#aaa',
                          fontSize: 16, cursor: s3StepIndex === 0 ? 'default' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        ◀
                      </button>

                      <button
                        onClick={() => setS3IsPlaying(p => !p)}
                        style={{
                          flex: 1, height: 36, borderRadius: 8,
                          border: `1px solid ${s3IsPlaying ? '#f59020' : 'var(--accent)'}`,
                          background: s3IsPlaying ? 'rgba(245,144,32,0.15)' : 'rgba(0,180,216,0.15)',
                          color: s3IsPlaying ? '#f59020' : 'var(--accent)',
                          fontSize: 13, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        {s3IsPlaying ? '⏸ 一時停止' : '▶ 再生'}
                      </button>

                      <button
                        onClick={handleS3Next}
                        disabled={s3StepIndex === DRILL_STEPS.length - 1}
                        style={{
                          width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)',
                          background: 'rgba(255,255,255,0.05)', color: s3StepIndex === DRILL_STEPS.length - 1 ? '#333' : '#aaa',
                          fontSize: 16, cursor: s3StepIndex === DRILL_STEPS.length - 1 ? 'default' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        ▶
                      </button>
                    </div>

                    {s3IsPlaying && (
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                        5秒後に次のステップへ自動進行
                      </div>
                    )}
                  </div>

                  {/* 全ステップ一覧 */}
                  <div className="card">
                    <div className="section-title">全手術ステップ</div>
                    {DRILL_STEPS.map((step, i) => (
                      <div
                        key={step.id}
                        onClick={() => { setS3StepIndex(i); setS3IsPlaying(false); }}
                        style={{
                          padding: '8px 10px', borderRadius: 7, cursor: 'pointer', marginBottom: 5,
                          background: i === s3StepIndex ? 'rgba(0,180,216,.12)' : i < s3StepIndex ? 'rgba(0,180,216,.04)' : 'rgba(255,255,255,.02)',
                          border: `1px solid ${i === s3StepIndex ? 'var(--accent)' : 'var(--border)'}`,
                          transition: 'all .15s',
                          display: 'flex', alignItems: 'center', gap: 10,
                        }}
                      >
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                          background: i === s3StepIndex ? 'var(--accent)' : i < s3StepIndex ? 'rgba(0,180,216,0.4)' : 'rgba(255,255,255,0.08)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700, color: i <= s3StepIndex ? '#001a20' : '#555',
                        }}>
                          {i < s3StepIndex ? '✓' : i + 1}
                        </div>
                        <span style={{
                          fontSize: 12,
                          color: i === s3StepIndex ? 'var(--accent)' : i < s3StepIndex ? 'var(--text-secondary)' : 'var(--text-muted)',
                          fontWeight: i === s3StepIndex ? 700 : 400,
                        }}>
                          {step.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
