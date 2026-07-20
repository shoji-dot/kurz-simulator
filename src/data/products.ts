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
  /** 選択根拠（1文）: なぜこの製品を選ぶか */
  selectionRationale: string;
  /** 主な特徴（2-3項目） */
  keyFeatures: string[];
  /** 不適切な場面（教育用） */
  notForWhen: string[];
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
    // 【一般耳科知識】PORP適応の臨床根拠
    selectionRationale: 'アブミ骨上部構造（頭部・前後脚）が温存されている場合に選択。ベル型フットがアブミ骨頭部を包み込み安定した固定を提供する。',
    keyFeatures: [
      '可変シャフト長（1.75〜4.50mm）で術中サイジングに対応',
      'BELLエキスパンダーヘッドが鼓膜グラフトに自然密着',
      'ベル型フット（Bell foot）がアブミ骨頭部を安定保持',
    ],
    notForWhen: [
      'アブミ骨上部構造が欠損している場合（→ TTP-VARIAC TORPを選択）',
      '耳硬化症・アブミ骨底板固着（→ Soft Clip Stapes Prosthesisを選択）',
      'アブミ骨底板のみ残存でアブミ骨頭部がない場合（→ TORPを選択）',
    ],
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
    // 【一般耳科知識】TORP適応の臨床根拠
    selectionRationale: 'アブミ骨上部構造が欠損し底板のみ残存する場合に選択。平底フットが底板上に安定設置し、残存鼓膜〜底板間の振動伝達を担う。',
    keyFeatures: [
      '平底フット（Flat foot）がアブミ骨底板上に安定設置',
      '可変シャフト長（3.0〜7.0mm）で深い鼓室にも対応',
      'PORPと同一ヘッドプレートで一貫した音響特性',
    ],
    notForWhen: [
      'アブミ骨上部構造が温存されている場合（→ TTP-VARIAC PORPで十分）',
      '耳硬化症・底板固着が主病変の場合（→ Soft Clip Stapes Prosthesisを検討）',
      'アブミ骨底板の可動性が確認できない場合（設置前に可動性確認必須）',
    ],
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
    description: 'アブミ骨形成術（Stapedotomy）用ピストン型プロステーシス。クリンピング不要のソフトクリップがキヌタ骨長突起に自動固定。チタンバンドが粘膜血流を確保（Contact free zone）。シャフト径 0.4/0.6mm。バンド幅 0.25mm。',
    indications: ['耳硬化症（アブミ骨底板固着）', 'アブミ骨形成術（Stapedotomy）', 'アブミ骨奇形・外傷性固定'],
    // 【KURZ固有情報 + 一般耳科知識】Soft Clip適応の臨床根拠
    selectionRationale: '耳硬化症によるアブミ骨底板固着に特化したStapedotomy用プロステーシス。クリンピング不要のスプリング式バンドがキヌタ骨長突起に自動適合し、術者負担と血管損傷リスクを軽減する。',
    keyFeatures: [
      'クリンピング不要のスプリング式バンドクリップ（自動適合）',
      'Contact free zoneでキヌタ骨長突起の粘膜血流を保護',
      'Stapedotomy専用設計（底板に小孔を作成し挿入）',
    ],
    notForWhen: [
      'ツチ骨・キヌタ骨連鎖の欠損（→ TTP-VARIAC PORP/TORPを選択）',
      'アブミ骨底板が正常可動の鼓室形成術（Stapedotomy適応でない）',
      'アブミ骨底板が完全欠損している症例',
    ],
    color: '#c4ccdc',
  },
];
