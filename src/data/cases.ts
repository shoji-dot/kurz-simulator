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
  /** コンテキストタグ（常時表示チップ） */
  tags: {
    procedure: string[];  // 術式チップ: 鼓室形成型・プロテーゼ種類
    lesion: string[];     // 病変チップ: 疾患・状態
  };
}

export const surgicalCases: SurgicalCase[] = [
  {
    id: 'case-001',
    title: '症例1: キヌタ骨欠損（II型）— PORP',
    description: '42歳女性。慢性中耳炎。鼓膜穿孔、キヌタ骨欠損。ツチ骨柄・アブミ骨上部構造は温存。鼓室形成II型の適応。PORP（ツチ骨柄下）を使用。',
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
    tags: {
      procedure: ['鼓室形成II型', 'PORP'],
      lesion:    ['慢性中耳炎', 'キヌタ骨欠損'],
    },
  },
  {
    id: 'case-004',
    title: '症例2: ツチ骨・キヌタ骨欠損（III型）— PORP',
    description: '47歳女性。真珠腫性中耳炎（アティコトミー後再発）。ツチ骨・キヌタ骨は真珠腫により破壊・摘出。アブミ骨上部構造（頭部・前後脚）は温存、可動性良好。鼓室形成III型の典型例。PORP適応。',
    difficulty: 'intermediate',
    ossicularStatus: { malleus: 'absent', incus: 'absent', stapes: 'suprastructure' },
    recommendedProductId: 'porp-duesseldorf',
    recommendedLength: 2.0,
    idealLateralOffset: 0,
    idealAngle: 0,
    clinicalNotes: '軟骨（耳珠軟骨）で鼓膜を再建し、軟骨〜アブミ骨頭間距離をサイザーで実測。本症例は約2.0mm。アブミ骨頭部が明視野に確認でき、ベル型フットで安定保持が可能。',
    teachingPoints: [
      'III型の定義：ツチ骨・キヌタ骨欠損、アブミ骨上部構造温存。PORPのベル型フット（Bell foot）がアブミ骨頭部を包む形で設置。',
      'III型 vs II型の判断：ツチ骨柄が残存していればII型（PORP under malleus handle）。ツチ骨柄なしならIII型（PORP直接on stapes head）。',
      'PORPのシャフト長はサイザーを使い必ず術中実測。術前CTの距離は参考値。通常1.5〜2.5mmの範囲。',
      'アブミ骨頭部の安定性確認：プロテーゼ設置前に必ずアブミ骨頭部の可動性と固定の有無を確認する。',
      '鼓膜（軟骨）と頭板の間に薄い軟骨片を追加挿入するとPORPの安定性が向上し、押し出しリスクが低下する。',
    ],
    tags: {
      procedure: ['鼓室形成III型', 'PORP'],
      lesion:    ['真珠腫性中耳炎', 'ツチ骨・キヌタ骨欠損'],
    },
  },
  {
    id: 'case-002',
    title: '症例3: 全耳小骨欠損（IV型）— TORP',
    description: '58歳男性。真珠腫性中耳炎。ツチ骨・キヌタ骨・アブミ骨上部構造を全摘出。アブミ骨底板のみ残存、可動性良好。鼓室形成IV型の典型例。TORP適応。',
    difficulty: 'intermediate',
    ossicularStatus: { malleus: 'absent', incus: 'absent', stapes: 'footplate-only' },
    recommendedProductId: 'torp-duesseldorf',
    recommendedLength: 5.0,
    idealLateralOffset: 0,
    idealAngle: 0,
    clinicalNotes: '鼓膜（軟骨再建）〜アブミ骨底板間距離は約5.0mm。フット部が底板上中央に安定設置されることを確認。底板の可動性が良好であることが術前評価で確認済み。',
    teachingPoints: [
      'IV型の定義：耳小骨連鎖が完全欠損し、アブミ骨底板のみ残存する状態。TORP適応の典型。',
      'フット部は底板の中央に設置。偏心すると卵円窓縁に接触し術後めまいの原因となる。',
      '高さ不足（底板不接触）は音伝達不良、高さ過剰（鼓膜圧迫）は術後疼痛・穿孔リスク。厳密な計測が必須。',
      '底板固定（耳硬化症の合併）が疑われる場合はTORPでも改善不良。術前の骨導聴力とCT所見を確認。',
      '軟骨片を頭板と鼓膜の間に挿入してTORPの押し出しを防止する。特に鼓膜が薄い症例では必須。',
    ],
    tags: {
      procedure: ['鼓室形成IV型', 'TORP'],
      lesion:    ['真珠腫性中耳炎', '全耳小骨欠損'],
    },
  },
  {
    id: 'case-003',
    title: '症例4: クリップPORP使用例（応用）',
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
    tags: {
      procedure: ['クリップPORP', 'Dresden型'],
      lesion:    ['真珠腫（術後）', 'キヌタ骨欠損'],
    },
  },
  {
    id: 'case-005',
    title: '症例5: ツチ骨柄下PORP（II型変法）— 難症例',
    description: '61歳男性。癒着性中耳炎術後。キヌタ骨欠損、ツチ骨柄菲薄化・一部癒着。アブミ骨上部構造は温存。鼓膜は菲薄化し癒着傾向あり。PORPをツチ骨柄下に設置するが、ツチ骨柄の固定不完全により正確なセンタリングが要求される難症例。',
    difficulty: 'advanced',
    ossicularStatus: { malleus: 'partial', incus: 'absent', stapes: 'suprastructure' },
    recommendedProductId: 'porp-duesseldorf',
    recommendedLength: 3.0,
    idealLateralOffset: 0,
    idealAngle: 0,
    clinicalNotes: 'ツチ骨柄〜アブミ骨頭間距離は約3.0mm（癒着解除後計測）。鼓膜の癒着を慎重に剥離し、軟骨で補強再建。ツチ骨柄が菲薄化しているためPORP頭板の支持面積確保が重要。',
    teachingPoints: [
      'ツチ骨柄菲薄化症例ではPORP頭板サイズ（標準 vs ラージ）の選択が重要。支持面積が小さいと不安定になる。',
      '癒着性中耳炎では鼓膜剥離中に耳小骨への機械的刺激を最小限にすること。内耳障害リスクがある。',
      '軟骨片の厚さはPORPシャフト長の選択に直結する。軟骨補強後に必ず再計測する。',
      'アブミ骨上部構造の可動性確認は必須。長期癒着例では固定している可能性がある。',
      '鼓膜が菲薄化している場合、PORP押し出しリスクが高い。軟骨による鼓膜補強は必須条件。',
    ],
    tags: {
      procedure: ['鼓室形成II型変法', 'PORP'],
      lesion:    ['癒着性中耳炎', 'キヌタ骨欠損'],
    },
  },
  {
    id: 'case-006',
    title: '症例6: アブミ骨底板固定疑い（耳硬化症合併）— TORP 高難度',
    description: '52歳女性。両側の混合性難聴（骨導低下を伴う）。真珠腫術後、耳小骨連鎖全欠損。アブミ骨底板のみ残存するが、術前CTにて底板肥厚・ハロー所見あり。耳硬化症の合併が疑われる。術中に底板可動性を慎重に評価しTORPを設置する高難度症例。',
    difficulty: 'advanced',
    ossicularStatus: { malleus: 'absent', incus: 'absent', stapes: 'footplate-only' },
    recommendedProductId: 'torp-duesseldorf',
    recommendedLength: 4.5,
    idealLateralOffset: 0,
    idealAngle: 0,
    clinicalNotes: '術前CT: 底板肥厚2.0mm、アブミ骨周囲低吸収ハロー所見あり。術中に底板可動性を細い吸引管で慎重に確認。可動性良好なら TORP 設置継続。固定が強い場合は Laser アシスト耳硬化症手術（鐙骨手術）との複合対応を検討。',
    teachingPoints: [
      '耳硬化症合併の TORP は「底板可動性の確認」が最重要手技。固定底板に TORP 設置しても音響改善は得られない。',
      '術前骨導聴力は必ず確認。Carhart notch（2kHz 骨導低下）は耳硬化症の特徴的所見。',
      'TORP のフット部は底板中央に設置。底板への不均等な接触は内耳リンパ液の圧力変動を起こしめまいの原因となる。',
      '耳硬化症合併例では術後 ABG 改善が不完全な場合がある。術前インフォームド・コンセントで予め伝える。',
      '混合性難聴（骨導低下）を伴う場合、術後の骨導改善は期待できない。気導改善のみを目標とした手術計画を立てる。',
    ],
    tags: {
      procedure: ['鼓室形成IV型', 'TORP'],
      lesion:    ['耳硬化症合併', '全耳小骨欠損', '底板固定疑い'],
    },
  },
];
