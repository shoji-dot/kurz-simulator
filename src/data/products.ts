export type ProsthesisType = 'PORP' | 'TORP' | 'PISTON';
export type FootType = 'BELL' | 'CLIP' | 'FLAT' | 'FLEXIBAL';
export type HeadType = 'FENESTRATED' | 'DISC' | 'OVAL_RING' | 'DOME_4FIN';

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
  {
    id: 'porp-duesseldorf',
    name: 'PORP Düsseldorf',
    series: 'Düsseldorf',
    type: 'PORP',
    footType: 'BELL',
    headType: 'DISC',           // flat disc head (confirmed from 20x scale photos)
    shaftLengths: [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5],
    headPlateDiameter: 3.0,
    footDiameter: 2.5,
    weight: 4,
    mriSafe: '7.0T',
    description: 'KURZの標準的なPORPシリーズ。ベル型フットによりアブミ骨頭部を安定保持。軽量4mgで音響特性に優れる。',
    indications: ['ツチ骨・キヌタ骨欠損', 'キヌタ骨単独欠損', 'コレステアトーマ術後再建'],
    color: '#b8c4cc',
  },
  {
    id: 'torp-duesseldorf',
    name: 'TORP Düsseldorf',
    series: 'Düsseldorf',
    type: 'TORP',
    footType: 'FLAT',
    headType: 'OVAL_RING',      // oval ring frame head (confirmed from 20x scale photos)
    shaftLengths: [3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0],
    headPlateDiameter: 3.0,
    footDiameter: 4.5,
    weight: 4,
    mriSafe: '7.0T',
    description: '全耳小骨欠損に対応するTORP。フラット型フットがアブミ骨底板上で安定設置。',
    indications: ['全耳小骨欠損', 'アブミ骨上部構造欠損', 'コレステアトーマ全摘後'],
    color: '#a0acb4',
  },
  {
    id: 'porp-clip-dresden',
    name: 'Clip Partial Dresden',
    series: 'Dresden',
    type: 'PORP',
    footType: 'CLIP',
    headType: 'FENESTRATED',    // Düsseldorf fenestrated (standard for Dresden series)
    shaftLengths: [1.5, 2.0, 2.5, 3.0, 3.5, 4.0],
    headPlateDiameter: 3.0,
    footDiameter: 2.0,
    weight: 4,
    mriSafe: '7.0T',
    description: 'クリップ型フットによりアブミ骨頭部にクリッピング固定。軟骨片不要で手術時間短縮。',
    indications: ['アブミ骨頭部保存症例', '鼓室形成I/II型', 'キヌタ骨欠損単独症例'],
    color: '#c8d4dc',
  },
  {
    id: 'porp-ttp-tuebingen',
    name: 'TTP-Tuebingen PORP',
    series: 'Tuebingen',
    type: 'PORP',
    footType: 'BELL',
    headType: 'FENESTRATED',    // fenestrated head (Tuebingen series standard)
    shaftLengths: [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5],
    headPlateDiameter: 3.0,
    footDiameter: 2.5,
    weight: 4,
    mriSafe: '7.0T',
    description: 'TTPシリーズのPORP。ハンドル付きで術中操作性向上。可変シャフト長調整対応。',
    indications: ['キヌタ骨欠損', '鼓室形成II型', 'ツチ骨頭温存症例'],
    color: '#b0bcc8',
  },
];
