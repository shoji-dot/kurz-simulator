/**
 * ViewPresets.ts — 解剖・手術ビュープリセット定義
 *
 * ▼ 座標系（World空間 = GLB Y-down → scale=[1,-1,1] 反転後）
 *   GLB[x, y, z] → world[x, -y, z]
 *   X+ = 前方 (Anterior)
 *   Y+ = 上方 (Superior)
 *   Z+ = 外耳道方向 (Lateral / EAC)
 *
 * ▼ 主要ランドマーク (AnatomyScene world space)
 *   アブミ骨底板     : [0, 0, 0]     <- GLB 原点
 *   アブミ骨頭       : [0.84, 2.65, 4.86]
 *   鼓膜中心(臍部)   : [0, 0, 5.5]
 *   外耳道中心軸     : Y~0, X~0, Z=5-20
 *   側頭骨視覚中心   : [-3, 12, 0]  <- BONE_CENTER (蓋板~乳突間重心推定)
 *
 * ▼ SimScene 補正
 *   GLB_OFFSET_local = [0.84, -2.65, 2.12]
 *   world offset (scale Y-flip) = [0.84, +2.65, 2.12]
 */

export interface CameraView {
  pos:    [number, number, number];
  target: [number, number, number];
  up?:    [number, number, number];
}

export interface ViewPreset {
  key:   string;
  label: string;
  short: string;
  view:  CameraView;
}

// 側頭骨視覚中心 (AnatomyScene world座標)
const CX = -3, CY = 12, CZ = 0;
const D  = 62;  // 全体概観距離 (mm)

// ── 解剖学的ビュー（6方向）
export const ANATOMICAL_VIEWS: ViewPreset[] = [
  {
    key: 'lateral',
    label: '外側面 Lateral',
    short: '外側',
    view: { pos: [CX, CY, CZ + D], target: [CX, CY, CZ], up: [0, 1, 0] },
  },
  {
    key: 'medial',
    label: '内側面 Medial',
    short: '内側',
    view: { pos: [CX, CY, CZ - D], target: [CX, CY, CZ], up: [0, 1, 0] },
  },
  {
    key: 'anterior',
    label: '前面 Anterior',
    short: '前面',
    view: { pos: [CX + D, CY, CZ], target: [CX, CY, CZ], up: [0, 1, 0] },
  },
  {
    key: 'posterior',
    label: '後面 Posterior',
    short: '後面',
    view: { pos: [CX - D, CY, CZ], target: [CX, CY, CZ], up: [0, 1, 0] },
  },
  {
    key: 'superior',
    label: '上面 Superior',
    short: '上面',
    view: { pos: [CX, CY + D, CZ], target: [CX, CY, CZ], up: [0, 0, -1] },
  },
  {
    key: 'inferior',
    label: '下面 Inferior',
    short: '下面',
    view: { pos: [CX, CY - D, CZ], target: [CX, CY, CZ], up: [0, 0, 1] },
  },
];

// ── 手術ビュープリセット
export const SURGICAL_VIEWS: ViewPreset[] = [
  {
    key: 'overview',
    label: '全体概観（側頭骨全景）',
    short: '全体',
    view: { pos: [CX + 5, CY + 10, CZ + D], target: [CX, CY, CZ], up: [0, 1, 0] },
  },
  {
    key: 'tympanic_membrane',
    label: '鼓膜ビュー（外耳道軸）',
    short: '鼓膜',
    // 外耳道軸に沿ってZ+方向から直視: EAC中心(X~0, Y~0)に合わせる
    view: { pos: [0, 6, 42], target: [0, 1, 5], up: [0, 1, 0] },
  },
  {
    key: 'microscope',
    label: '手術顕微鏡（鼓室形成術）',
    short: '顕微鏡',
    // 術者視点: やや上から外耳道を通して鼓室を見る
    view: { pos: [2, 8, 38], target: [0, 0, 4], up: [0, 1, 0] },
  },
  {
    key: 'tympanoplasty',
    label: '鼓室正面（プロテーゼ設置）',
    short: '鼓室正面',
    view: { pos: [0, 3, 26], target: [0, -1, 3], up: [0, 1, 0] },
  },
  {
    key: 'mastoidectomy',
    label: '乳突削開アプローチ',
    short: '乳突削開',
    view: { pos: [CX - 30, CY + 10, CZ + 15], target: [CX, CY - 5, CZ], up: [0, 1, 0] },
  },
  {
    key: 'facialRecess',
    label: '顔面神経窩（後鼓室切開）',
    short: '顔面神経窩',
    view: { pos: [-18, -8, 28], target: [-2, -2, 2], up: [0, 1, 0] },
  },
  {
    key: 'endo0',
    label: '内視鏡 0°',
    short: 'Endo 0',
    view: { pos: [0, 0, 42], target: [0, -1, 2], up: [0, 1, 0] },
  },
  {
    key: 'endo30',
    label: '内視鏡 30°',
    short: 'Endo 30',
    view: { pos: [0, 21, 37], target: [0, -1, 2], up: [0, 1, 0] },
  },
  {
    key: 'endo45',
    label: '内視鏡 45°',
    short: 'Endo 45',
    view: { pos: [0, 30, 30], target: [0, -1, 2], up: [0, 1, 0] },
  },
  {
    key: 'endo70',
    label: '内視鏡 70°',
    short: 'Endo 70',
    view: { pos: [0, 40, 14], target: [0, -1, 2], up: [0, 1, 0] },
  },
];

// ── SimScene 用オフセット補正
const SIM_OFF: [number, number, number] = [0.84, 2.65, 2.12];

export function shiftViewForSim(v: CameraView): CameraView {
  return {
    pos:    [v.pos[0]    + SIM_OFF[0], v.pos[1]    + SIM_OFF[1], v.pos[2]    + SIM_OFF[2]],
    target: [v.target[0] + SIM_OFF[0], v.target[1] + SIM_OFF[1], v.target[2] + SIM_OFF[2]],
    up: v.up,
  };
}
