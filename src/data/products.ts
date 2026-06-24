export type ProsthesisType = 'PORP' | 'TORP' | 'PISTON';
export type FootType = 'BELL' | 'CLIP' | 'FLAT' | 'FLEXIBAL' | 'PISTON';
export type HeadType = 'FENESTRATED' | 'DISC' | 'OVAL_RING' | 'DOME_4FIN' | 'BELL_TOP' | 'SOFT_CLIP';

export interface KurzProduct {
  id: string;
  name: string;
  series: string;
  type: ProsthesisType;
  footType: FootType;
  headType: HeadType;   // 3D model head plate variant
  shaftLengths: number[];
  headPlateDiameter: number;
  footDiameter: number;
  weight: number;
  mriSafe: string;
  description: string;
  indications: string[];
  color: string;
}

export const kurzProducts: KurzProduct[] = [
  // ── TTP-VARIAC PORP ───────────────────────────────────────────────
  //   Catalog: Partial Prosthesis, Adjustable Length 1.75-4.50mm (0.25mm step)
  //   Functional Length 0.75-3.50mm. Shaft Ø0.2mm. STL scan-derived BellTop head.
  {
    id: 'porp-ttp-variac',
    name: 'TTP-VARIAC PORP',
    series: 'TTP-VARIAC',
    type: 'PORP',
    footType: 'BELL',
    headType: 'BELL_TOP',       // STLスキャン実測: 急峻フレアー＋フラットリム
    shaftLengths: [1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5, 3.75, 4.0, 4.25, 4.5],
    headPlateDiameter: 3.6,
    footDiameter: 2.5,
    weight: 4,
    mriSafe: '7.0T',
    description: 'TTP-VARIACシステムPORP。可変シャフト長（機能的長さ 0.75〜3.50mm）。内蔵BELLエキスパンダーヘッドが鼓膜グラフトに密着。アブミ骨頭部にベルフットを設置。Tuebingen大学ENT科との共同開発。',
    indications: ['ツチ骨・キヌタ骨欠損（III型）', 'キヌタ骨単独欠損（II型）', '鼓膜再建同時施行症例'],
    color: '#b8c0d0',
  },
  // ── TTP-VARIAC TORP ───────────────────────────────────────────────
  //   Catalog: Total Prosthesis, Adjustable Length 3.0-7.0mm (0.25mm step)
  //   Shaft Ø0.2mm. Same BellTop head as PORP (integrated BELL Expander).
  {
    id: 'torp-ttp-variac',
    name: 'TTP-VARIAC TORP',
    series: 'TTP-VARIAC',
    type: 'TORP',
    footType: 'FLAT',
    headType: 'BELL_TOP',       // PORPと同一ヘッドプレート（BELLエキスパンダー一体型）
    shaftLengths: [3.0, 3.25, 3.5, 3.75, 4.0, 4.25, 4.5, 4.75, 5.0, 5.25, 5.5, 5.75, 6.0, 6.5, 7.0],
    headPlateDiameter: 3.6,
    footDiameter: 2.5,
    weight: 5,
    mriSafe: '7.0T',
    description: 'TTP-VARIACシステムTORP。可変シャフト長（3.0〜7.0mm）。全耳小骨欠損に対応。アブミ骨底板上に平底フットを設置。PORPと同一ヘッドプレートで統一された音響特性。',
    indications: ['全耳小骨欠損（IV型）', 'アブミ骨上部構造欠損', 'コレステアトーマ全摘後再建'],
    color: '#a8b4c4',
  },
  // ── Soft Clip Stapes Prosthesis ───────────────────────────────────
  //   Catalog: Pure Titanium ASTM F67, Shaft Ø0.4/0.6mm, Band loop width 0.25mm
  //   Lengths 3.50-5.50mm. No crimping — spring band self-adapts to incus LP.
  //   Stuttgart ITM: Dr. Schmanski, Dr. Luenen, Dr. Elber (collaboration).
  {
    id: 'soft-clip-stapes',
    name: 'Soft Clip Stapes Prosthesis',
    series: 'Soft Clip',
    type: 'PISTON',
    footType: 'PISTON',
    headType: 'SOFT_CLIP',      // バンドクリップ（クリンピング不要、スプリング機構）
    shaftLengths: [3.5, 3.75, 4.0, 4.25, 4.5, 4.75, 5.0, 5.5],
    headPlateDiameter: 1.2,
    footDiameter: 0.4,
    weight: 1,
    mriSafe: '7.0T',
    description: 'アブミ骨形成術（Stapedotomy）用ピストン型プロテーシス。クリンピング不要のソフトクリップがキヌタ骨長突起に自動固定。チタンバンドが粘膜血流を確保（Contact free zone）。シャフト径 0.4/0.6mm。バンド幅 0.25mm。',
    indications: ['耳硬化症（アブミ骨底板固着）', 'アブミ骨形成術（Stapedotomy）', 'アブミ骨奇形・外傷性固定'],
    color: '#c4ccdc',
  },
];
