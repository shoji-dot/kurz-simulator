/**
 * ViewPresets.ts — 解剖・手術ビュープリセット定義
 *
 * ▼ 座標系 v2（world空間 = GLB → rotation=[π,-π/2,0] 適用後）
 *   GLB[x, y, z] → world[z, -y, x]
 *
 *   X+ = 患者右側 / 外側 (Patient Right / Lateral)
 *   Y+ = 頭頂側   (Superior)
 *   Z+ = 顔面側   (Anterior)
 *
 *   前方(Anterior)  = +Z
 *   後方(Posterior) = -Z
 *   上方(Superior)  = +Y
 *   下方(Inferior)  = -Y
 *   外側(Lateral)   = +X  （右耳の場合 = Patient Right）
 *   内側(Medial)    = -X
 *
 * ▼ 主要ランドマーク (AnatomyScene world space v2)
 *   アブミ骨底板     : [0,    0,    0  ]   ← GLB 原点
 *   アブミ骨頭       : [4.86, 2.65, 0.84]
 *   鼓膜中心(臍部)   : [5.5,  0,    0  ]   ← EAC 方向 (+X)
 *   外耳道中心軸     : X軸正方向
 *   側頭骨視覚中心   : [0, 12, -3]         ← BONE_CENTER
 *
 * ▼ SimScene 補正
 *   アブミ骨底板 world(SimScene) = [2.12, 2.65, 0.84]
 *   SIM_OFF (AnatomyScene → SimScene) = [2.12, 2.65, 0.84]
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

// 側頭骨視覚中心 (AnatomyScene world座標 v2)
//   X=0: 外側基準, Y=12: 12mm Superior, Z=-3: 3mm Posterior
const CX = 0, CY = 12, CZ = -3;
const D  = 62;   // 全体概観距離 (mm)

// ── 解剖学的ビュー（6方向）
export const ANATOMICAL_VIEWS: ViewPreset[] = [
  {
    key: 'lateral',
    label: '外側面 Lateral',
    short: '外側',
    // +X方向（患者右側・外耳道側）からモデルを見る
    view: { pos: [CX + D, CY, CZ], target: [CX, CY, CZ], up: [0, 1, 0] },
  },
  {
    key: 'medial',
    label: '内側面 Medial',
    short: '内側',
    // -X方向（内側・錐体尖側）からモデルを見る
    view: { pos: [CX - D, CY, CZ], target: [CX, CY, CZ], up: [0, 1, 0] },
  },
  {
    key: 'anterior',
    label: '前面 Anterior',
    short: '前面',
    // +Z方向（顔面側）からモデルを見る
    view: { pos: [CX, CY, CZ + D], target: [CX, CY, CZ], up: [0, 1, 0] },
  },
  {
    key: 'posterior',
    label: '後面 Posterior',
    short: '後面',
    // -Z方向（後頭部側）からモデルを見る
    view: { pos: [CX, CY, CZ - D], target: [CX, CY, CZ], up: [0, 1, 0] },
  },
  {
    key: 'superior',
    label: '上面 Superior',
    short: '上面',
    // +Y方向（頭頂側）から真下に向けて見る
    // up=[0,0,1] = 前方(Z+)が画面上方
    view: { pos: [CX, CY + D, CZ], target: [CX, CY, CZ], up: [0, 0, 1] },
  },
  {
    key: 'inferior',
    label: '下面 Inferior',
    short: '下面',
    // -Y方向（下方）から真上に向けて見る
    view: { pos: [CX, CY - D, CZ], target: [CX, CY, CZ], up: [0, 0, -1] },
  },
];

// ── 手術ビュープリセット
export const SURGICAL_VIEWS: ViewPreset[] = [
  {
    key: 'overview',
    label: '全体概観（側頭骨全景）',
    short: '全体',
    // 外側＋上方＋やや前方から全体を俯瞰
    view: { pos: [50, 30, 15], target: [CX, CY, CZ], up: [0, 1, 0] },
  },
  {
    key: 'tympanic_membrane',
    label: '鼓膜ビュー（外耳道軸）',
    short: '鼓膜',
    // 外耳道口（+X側）から-X方向を向いて鼓膜を直視
    // 鼓膜中心: world[5.5, 0, 0]
    view: { pos: [40, 5, 0], target: [5.5, 0, 0], up: [0, 1, 0] },
  },
  {
    key: 'microscope',
    label: '手術顕微鏡（鼓室形成術）',
    short: '顕微鏡',
    // 術者視点: 外側やや上方から外耳道を通じて鼓室を観察
    view: { pos: [38, 12, 0], target: [5, 2, 0], up: [0, 1, 0] },
  },
  {
    key: 'tympanoplasty',
    label: '鼓室正面（プロテーゼ設置）',
    short: '鼓室正面',
    // 外耳道から鼓室直視: 近距離
    view: { pos: [25, 5, 0], target: [3, 0, 0], up: [0, 1, 0] },
  },
  {
    key: 'mastoidectomy',
    label: '乳突削開アプローチ',
    short: '乳突削開',
    // 後方＋上方＋外側から乳突削開窩を見る
    view: { pos: [15, 22, -33], target: [0, 7, -3], up: [0, 1, 0] },
  },
  {
    key: 'facialRecess',
    label: '顔面神経窩（後鼓室切開）',
    short: '顔面神経窩',
    // 後方外側から顔面神経窩を見る
    view: { pos: [28, -8, -18], target: [2, -2, -2], up: [0, 1, 0] },
  },
  {
    key: 'endo0',
    label: '内視鏡 0°',
    short: 'Endo 0',
    // 外耳道口から直進（0°）: カメラは+X側、-X方向を向く
    view: { pos: [42, 0, 0], target: [2, -1, 0], up: [0, 1, 0] },
  },
  {
    key: 'endo30',
    label: '内視鏡 30°',
    short: 'Endo 30',
    // 外耳道口から30°上向き
    view: { pos: [37, 21, 0], target: [2, -1, 0], up: [0, 1, 0] },
  },
  {
    key: 'endo45',
    label: '内視鏡 45°',
    short: 'Endo 45',
    view: { pos: [30, 30, 0], target: [2, -1, 0], up: [0, 1, 0] },
  },
  {
    key: 'endo70',
    label: '内視鏡 70°',
    short: 'Endo 70',
    // 70°角で鼓室上陥凹を見る
    view: { pos: [14, 40, 0], target: [2, -1, 0], up: [0, 1, 0] },
  },
];

// ── SimScene 用オフセット補正
// AnatomyScene では GLB 原点 = アブミ骨底板 = world[0,0,0]
// SimScene では GLB が GLB_OFFSET だけシフトされ、アブミ骨底板 = world[2.12, 2.65, 0.84]
const SIM_OFF: [number, number, number] = [2.12, 2.65, 0.84];

export function shiftViewForSim(v: CameraView): CameraView {
  return {
    pos:    [v.pos[0]    + SIM_OFF[0], v.pos[1]    + SIM_OFF[1], v.pos[2]    + SIM_OFF[2]],
    target: [v.target[0] + SIM_OFF[0], v.target[1] + SIM_OFF[1], v.target[2] + SIM_OFF[2]],
    up: v.up,
  };
}
