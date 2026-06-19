export type OssicleStatus = 'intact' | 'partial' | 'absent';
export type StapesStatus = 'intact' | 'suprastructure' | 'footplate-only' | 'absent';

export interface SurgicalCase {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  ossicularStatus: {
    malleus: OssicleStatus;
    incus: OssicleStatus;
    stapes: StapesStatus;
  };
  recommendedProductId: string;
  recommendedLength: number;
  idealLateralOffset: number;
  idealAngle: number;
  clinicalNotes: string;
  teachingPoints: string[];
}

export const surgicalCases: SurgicalCase[] = [
  {
    id: 'case-001',
    title: '症例1: キヌタ骨欠損',
    description: '42歳女性。慢性中耳炎。鼓膜穿孔、キヌタ骨欠損。ツチ骨・アブミ骨上部構造は温存。鼓室形成II型の適応。',
    difficulty: 'beginner',
    ossicularStatus: { malleus: 'intact', incus: 'absent', stapes: 'suprastructure' },
    recommendedProductId: 'porp-duesseldorf',
    recommendedLength: 2.5,
    idealLateralOffset: 0,
    idealAngle: 0,
    clinicalNotes: 'ツチ骨柄〜アブミ骨頭間距離は約2.5mm。軟骨片を頭板下に挿入し鼓膜穿孔を防止する。',
    teachingPoints: [
      'PORP適応の典型例。アブミ骨上部構造温存が前提条件。',
      'シャフト長はサイザーで実測。カルテ記録の距離は参考値として扱う。',
      '頭板と鼓膜の間に薄い軟骨片を挟む（押出し防止）。',
      '適切な張力：鼓膜閉鎖後わずかに張力がかかる程度。',
    ],
  },
  {
    id: 'case-002',
    title: '症例2: 全耳小骨欠損',
    description: '58歳男性。真珠腫性中耳炎。全耳小骨欠損。アブミ骨底板は可動性あり。鼓室形成III型。',
    difficulty: 'intermediate',
    ossicularStatus: { malleus: 'absent', incus: 'absent', stapes: 'footplate-only' },
    recommendedProductId: 'torp-duesseldorf',
    recommendedLength: 5.0,
    idealLateralOffset: 0,
    idealAngle: 0,
    clinicalNotes: '鼓膜〜アブミ骨底板間距離は約5.0mm。フット部が底板上中央に安定設置されることを確認。',
    teachingPoints: [
      'TORP適応。フット部がアブミ骨底板上に安定設置できるか確認。',
      '高さ不足：TORPが底板に接触せず音伝達不良。高さ過剰：鼓膜を圧迫し疼痛・穿孔。',
      '軟骨で十分なサポートを確保してからTORPを設置する。',
      'アブミ骨底板の可動性確認（固定例はTORPでも改善不良）。',
    ],
  },
  {
    id: 'case-003',
    title: '症例3: クリップPORP使用例',
    description: '35歳男性。コレステアトーマ初回手術後。キヌタ骨欠損、アブミ骨頭部温存。クリップ固定を検討。',
    difficulty: 'advanced',
    ossicularStatus: { malleus: 'partial', incus: 'absent', stapes: 'suprastructure' },
    recommendedProductId: 'porp-clip-dresden',
    recommendedLength: 2.0,
    idealLateralOffset: 0,
    idealAngle: 0,
    clinicalNotes: 'Clip Partial Dresdenのクリップ部をアブミ骨頭部にクリッピング。軟骨不要。術野が狭い場合は注意。',
    teachingPoints: [
      'Clip PORPはアブミ骨頭部が温存されている症例で有用。',
      'クリップを開いた状態で挿入し、アブミ骨頭部に引っ掛けてから閉じる。',
      '過度のクリッピングでアブミ骨頭部骨折リスクあり。適切な力加減が必要。',
      '術野が狭い場合は通常のベル型PORPへの変更も考慮する。',
    ],
  },
];
