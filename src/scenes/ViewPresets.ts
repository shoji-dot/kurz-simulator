/**
 * ViewPresets.ts — 解剖・手術ビュープリセット定義
 *
 * ▼ 座標系（World空間 = GLB Y-flip後）
 *   X+ = 前方 (Anterior)
 *   Y+ = 上方 (Superior)
 *   Z+ = 外側 / 外耳道方向 (Lateral / EAC)
 *
 * ▼ 中耳中心（ワールド座標）
 *   AnatomyScene: GLBはY-flipのみ → 中心 ≈ [0, 0, 3]
 *   SimScene: GLB_OFFSETあり → 中心 ≈ [0.84, 2.65, 3]
 *   プリセットは AnatomyScene 基準で定義
 */

export interface CameraView {
  pos:    [number, number, number];
  target: [number, number, number];
  up?:    [number, number, number];  // 省略時 [0, 1, 0]
}

export interface ViewPreset {
  key:   string;
  label: string;  // 表示ラベル（日本語）
  short: string;  // ボタン表示（短縮）
  view:  CameraView;
}

// 中耳中心（AnatomyScene基準）
const C = { x: 0, y: 0, z: 3 } as const;
const D = 52;  // 標準観察距離 (mm)

// ── 解剖学的ビュー（6方向標準断面）──────────────────────────────────
export const ANATOMICAL_VIEWS: ViewPreset[] = [
  {
    key: 'lateral',
    label: '外側面 Lateral',
    short: '外側',
    view: { pos: [0, 3, C.z + D], target: [C.x, C.y, C.z], up: [0, 1, 0] },
  },
  {
    key: 'medial',
    label: '内側面 Medial',
    short: '内側',
    view: { pos: [0, 3, C.z - D], target: [C.x, C.y, C.z], up: [0, 1, 0] },
  },
  {
    key: 'anterior',
    label: '前面 Anterior',
    short: '前面',
    view: { pos: [C.x + D, 0, C.z], target: [C.x, C.y, C.z], up: [0, 1, 0] },
  },
  {
    key: 'posterior',
    label: '後面 Posterior',
    short: '後面',
    view: { pos: [C.x - D, 0, C.z], target: [C.x, C.y, C.z], up: [0, 1, 0] },
  },
  {
    key: 'superior',
    label: '上面 Superior',
    short: '上面',
    // カメラが真上→ up を -Z 方向（外耳道と逆）に設定してオリエンテーション固定
    view: { pos: [0, C.y + D, C.z], target: [C.x, C.y, C.z], up: [0, 0, -1] },
  },
  {
    key: 'inferior',
    label: '下面 Inferior',
    short: '下面',
    view: { pos: [0, C.y - D, C.z], target: [C.x, C.y, C.z], up: [0, 0, 1] },
  },
];

// ── 手術ビュープリセット ─────────────────────────────────────────────
// 各ビューは術者が実際に見る視野を再現
export const SURGICAL_VIEWS: ViewPreset[] = [
  {
    key: 'microscope',
    label: '手術顕微鏡（鼓室形成術）',
    short: '顕微鏡',
    // Z+ 方向（外耳道側）から鼓室を見下ろす標準術野
    view: { pos: [2, 6, 50], target: [0, 0, 3], up: [0, 1, 0] },
  },
  {
    key: 'tympanoplasty',
    label: '鼓室正面（プロテーゼ設置視野）',
    short: '鼓室正面',
    // 外耳道正面近距離 → プロテーゼ配置調整用
    view: { pos: [0, 2, 30], target: [0, -1, 3], up: [0, 1, 0] },
  },
  {
    key: 'mastoidectomy',
    label: '乳突削開アプローチ',
    short: '乳突削開',
    // 後上方から乳突・中耳を俯瞰（乳突削開手術）
    view: { pos: [-40, 18, 18], target: [0, -1, 2], up: [0, 1, 0] },
  },
  {
    key: 'facialRecess',
    label: '顔面神経窩（後鼓室切開）',
    short: '顔面神経窩',
    // 後下方から顔面神経窩を通して鼓室を見る
    view: { pos: [-18, -8, 28], target: [-2, -2, 2], up: [0, 1, 0] },
  },
  {
    key: 'endo0',
    label: '内視鏡 0°（直視鏡）',
    short: 'Endo 0°',
    // 外耳道軸と平行（直視）
    view: { pos: [0, 0, 45], target: [0, -1, 2], up: [0, 1, 0] },
  },
  {
    key: 'endo30',
    label: '内視鏡 30°',
    short: 'Endo 30°',
    // 30° 上方傾斜（cos30≈0.866, sin30=0.5）× D=45
    view: { pos: [0, 22, 39], target: [0, -1, 2], up: [0, 1, 0] },
  },
  {
    key: 'endo45',
    label: '内視鏡 45°',
    short: 'Endo 45°',
    // 45° 上方傾斜（cos45≈0.707, sin45≈0.707）× D=45
    view: { pos: [0, 32, 32], target: [0, -1, 2], up: [0, 1, 0] },
  },
  {
    key: 'endo70',
    label: '内視鏡 70°',
    short: 'Endo 70°',
    // 70° 傾斜（cos70≈0.342, sin70≈0.940）× D=45
    view: { pos: [0, 42, 15], target: [0, -1, 2], up: [0, 1, 0] },
  },
];

// ── SimScene 用オフセット適用ユーティリティ ─────────────────────────
// SimScene では GLB が GLB_OFFSET=[0.84, -2.65, 2.12] → world[0.84, 2.65, 2.12] にオフセットされる
// プリセットを SimScene 座標系に補正する
const SIM_OFFSET: [number, number, number] = [0.84, 2.65, 0]; // Z はほぼ同じ

export function shiftViewForSim(v: CameraView): CameraView {
  return {
    pos:    [v.pos[0] + SIM_OFFSET[0], v.pos[1] + SIM_OFFSET[1], v.pos[2] + SIM_OFFSET[2]],
    target: [v.target[0] + SIM_OFFSET[0], v.target[1] + SIM_OFFSET[1], v.target[2] + SIM_OFFSET[2]],
    up: v.up,
  };
}
