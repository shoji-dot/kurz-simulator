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
  /** 術前ABG想定値 (dB) — スコア画面のABG改善予測に使用 */
  preOpAbg: number;
  clinicalNotes: string;
  teachingPoints: string[];
  /** コンテキストタグ（常時表示チップ） */
  tags: {
    procedure: string[];  // 術式チップ: 鼓室形成型・プロステーシス種類
    lesion: string[];     // 病変チップ: 疾患・状態
  };
}

export const surgicalCases: SurgicalCase[] = ([
  {
    id: 'case-001',
    title: '症例1: キヌタ骨欠損（II型）— PORP',
    description: '42歳女性。慢性中耳炎。鼓膜穿孔、キヌタ骨欠損。ツチ骨柄・アブミ骨上部構造は温存。鼓室形成II型の適応。PORP（ツチ骨柄下）を使用。',
    difficulty: 'beginner',
    ossicularStatus: { malleus: 'intact', incus: 'absent', stapes: 'suprastructure' },
    recommendedProductId: 'porp-ttp-variac',
    recommendedLength: 2.5,
    // ツチ骨柄(X≈0)下に頭板を合わせるため、シャフトは内側に傾く。
    // 底板はアブミ骨頭部中心(X=0.84)より約0.2mm内側が安定。傾斜角は解剖学的に約15°。
    idealLateralOffset: -0.2,
    idealAngle: 5,
    preOpAbg: 30,
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
    recommendedProductId: 'porp-ttp-variac',
    recommendedLength: 2.0,
    // ツチ骨なしでアブミ骨頭部上に設置（III型: stapes suprastructure温存）。
    // 上方に鼓膜再建軟骨があるため傾きは最小限(5°以内)。
    idealLateralOffset: 0.0,
    idealAngle: 0,
    preOpAbg: 35,
    clinicalNotes: '軟骨（耳珠軟骨）で鼓膜を再建し、軟骨〜アブミ骨頭間距離をサイザーで実測。本症例は約2.0mm。アブミ骨頭部が明視野に確認でき、ベル型フットで安定保持が可能。',
    teachingPoints: [
      'III型の定義：ツチ骨・キヌタ骨欠損、アブミ骨上部構造温存。PORPのベル型フット（Bell foot）がアブミ骨頭部を包む形で設置。',
      'III型 vs II型の判断：ツチ骨柄が残存していればII型（PORP under malleus handle）。ツチ骨柄なしならIII型（PORP直接on stapes head）。',
      'PORPのシャフト長はサイザーを使い必ず術中実測。術前CTの距離は参考値。通常1.5〜2.5mmの範囲。',
      'アブミ骨頭部の安定性確認：プロステーシス設置前に必ずアブミ骨頭部の可動性と固定の有無を確認する。',
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
    recommendedProductId: 'torp-ttp-variac',
    recommendedLength: 5.0,
    // 底板中央(offset 0)が理想。偏心すると窓龕縁に接触しめまいの原因となる。
    // 鼓膜〜底板間はほぼ垂直(0°)。
    idealLateralOffset: 0.0,
    idealAngle: 0,
    preOpAbg: 40,
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
    title: '症例4: ツチ骨・キヌタ骨欠損（III型）— TTP-VARIAC PORP（応用）',
    description: '35歳男性。コレステアトーマ初回手術後（アティコトミー）。ツチ骨・キヌタ骨はコレステアトーマにより除去。アブミ骨上部構造（頭部・前後弓）は温存、可動性良好。鼓室形成III型にTTP-VARIAC PORPを使用するin-stage再建の応用例。',
    difficulty: 'advanced',
    ossicularStatus: { malleus: 'partial', incus: 'absent', stapes: 'suprastructure' },
    recommendedProductId: 'porp-ttp-variac',
    recommendedLength: 2.0,
    // クリップがアブミ骨頭部を掴むため中央(offset 0)が必須。
    // クリップ機構の構造上、わずかな前後傾き(5°)は許容される。
    idealLateralOffset: 0.0,
    idealAngle: 0,
    preOpAbg: 30,
    clinicalNotes: 'TTP-VARIAC PORPのベル型フットをアブミ骨頭部に設置するIII型（in-stage）再建の応用例。ツチ骨柄なし・アブミ骨頭部温存の条件下でPORPを直接アブミ骨頭部上に載置。軟骨補強で頭板を安定させる。',
    teachingPoints: [
      'III型再建（ツチ骨・キヌタ骨欠損、アブミ骨頭部温存）ではPORPをアブミ骨頭部に直接設置する。ツチ骨柄がないため頭板の安定確保が最重要。',
      'TTP-VARIAC PORPのベル型フットはアブミ骨頭部を包み込み、フット部の形状が自然な安定を提供する。頭部を鉗子で直接つかまず、フット部から誘導して設置する。',
      'in-stage再建では一期的に鼓膜形成と耳小骨再建を同時施行する。術野確保と術式選択の判断が二期的再建より高度な技術を要する。',
      '頭板と鼓膜（軟骨グラフト）の間に薄い軟骨片を挿入する。これによりPORPの横方向のずれを防止し、長期安定性を高める。',
    ],
    tags: {
      procedure: ['鼓室形成III型', 'PORP', 'in-stage再建'],
      lesion:    ['真珠腫性中耳炎（術後）', 'ツチ骨・キヌタ骨欠損'],
    },
  },
  {
    id: 'case-005',
    title: '症例5: ツチ骨柄下PORP（II型変法）— 難症例',
    description: '61歳男性。癒着性中耳炎術後。キヌタ骨欠損、ツチ骨柄菲薄化・一部癒着。アブミ骨上部構造は温存。鼓膜は菲薄化し癒着傾向あり。PORPをツチ骨柄下に設置するが、ツチ骨柄の固定不完全により正確なセンタリングが要求される難症例。',
    difficulty: 'advanced',
    ossicularStatus: { malleus: 'partial', incus: 'absent', stapes: 'suprastructure' },
    recommendedProductId: 'porp-ttp-variac',
    recommendedLength: 3.0,
    // 癒着性中耳炎では鼓膜・ツチ骨柄が内側に引き寄せられる。
    // II型変法のため通常より約0.1mm多く内側へオフセット。傾斜はやや小さい(12°)。
    idealLateralOffset: -0.3,
    idealAngle: 5,
    preOpAbg: 40,
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
    id: 'case-007',
    title: '症例7: 先天性耳小骨奇形 — PORP（小児）',
    description: '8歳男児。生下時より左耳の伝音難聴。CTにてキヌタ骨・アブミ骨上部構造の先天性欠損を確認。ツチ骨柄は形態的に存在するが、キヌタ骨との関節が未形成。アブミ骨底板は正常可動。先天性耳小骨奇形に対する鼓室形成術（PORP使用）の典型例。',
    difficulty: 'advanced',
    ossicularStatus: { malleus: 'partial', incus: 'absent', stapes: 'suprastructure' },
    recommendedProductId: 'porp-ttp-variac',
    recommendedLength: 2.0,
    // 先天性奇形では解剖構造は明瞭。ツチ骨柄なし相当のため直置き。
    // 小児は鼓室腔が狭く、アブミ骨頭部が成人より若干外側に位置する傾向(+0.1mm)。
    idealLateralOffset: 0.1,
    idealAngle: 0,
    preOpAbg: 35,
    clinicalNotes: '小児例のため鼓室腔が小さい。術野確保にファイバー内視鏡を併用。ツチ骨柄下〜アブミ骨頭間距離は約2.0mm（成人比やや短い）。軟骨補強と鼓膜形成を同時施行。',
    teachingPoints: [
      '先天性耳小骨奇形は後天性疾患と異なり、炎症・瘢痕が少ないため解剖構造が比較的明瞭。',
      '小児では鼓室腔が狭く、成人用PORPでも頭板が大きすぎることがある。サイズの慎重な選択が必要。',
      '先天性例では顔面神経走行異常（水平部の下方偏位など）の合併に注意。術前CT読影が特に重要。',
      '小児は術後の耳管機能不全が再発リスクになる。耳管通気訓練・術後フォローが成人より長期化する。',
      'アブミ骨底板の可動性確認は成人と同様に必須。先天性例でも底板固定の合併例が存在する。',
    ],
    tags: {
      procedure: ['鼓室形成III型', 'PORP', '小児手術'],
      lesion:    ['先天性耳小骨奇形', 'キヌタ骨・アブミ骨上部欠損'],
    },
  },
  {
    id: 'case-008',
    title: '症例8: 外傷性耳小骨離断 — PORP（急性期）',
    description: '28歳男性。交通事故後の左側頭骨骨折。事故直後から左耳の伝音難聴。CTにてキヌタ骨の砧骨窩からの脱臼（Incus dislocation）を確認。ツチ骨・アブミ骨は正常位置。鼓膜は無穿孔。外傷性耳小骨離断の典型例。',
    difficulty: 'intermediate',
    ossicularStatus: { malleus: 'intact', incus: 'absent', stapes: 'suprastructure' },
    recommendedProductId: 'porp-ttp-variac',
    recommendedLength: 2.5,
    // ツチ骨・アブミ骨は正常位置(外傷性キヌタ骨脱臼のみ)。II型と同様の解剖。
    // ツチ骨柄(X≈0)下配置のため約0.2mm内側オフセット・傾斜約15°が理想。
    idealLateralOffset: -0.2,
    idealAngle: 5,
    preOpAbg: 30,
    clinicalNotes: '外傷から3ヶ月後に手術施行。鼓膜切開で鼓室内を確認するとキヌタ骨が砧骨窩から完全脱臼し、後鼓室に落下していた。脱臼キヌタ骨を摘出後、ツチ骨柄下〜アブミ骨頭間距離を実測（2.5mm）。PORPを設置。',
    teachingPoints: [
      '外傷性耳小骨離断の最多損傷部位はキヌタ骨長突起〜アブミ骨頭部の間（砧鐙関節）。CT診断が有用だが見落としも多い。',
      '外傷後3ヶ月以降に純音聴力検査で気骨導差（ABG）が残存していれば手術適応を検討する。',
      '離断した耳小骨を用いた自家移植（incus interposition）も選択肢だが、骨質や形態によってはPORPが優れる。',
      '外傷例では顔面神経麻痺の合併に注意。手術前に顔面神経機能（House-Brackmann分類）を必ず評価。',
      '急性期（外傷後4〜6週）には中耳出血・血腫が残存することがある。CT所見と聴力の経時的評価が重要。',
    ],
    tags: {
      procedure: ['鼓室形成III型', 'PORP', '外傷手術'],
      lesion:    ['外傷性耳小骨離断', 'キヌタ骨脱臼', '側頭骨骨折'],
    },
  },
  {
    id: 'case-009',
    title: '症例9: 再手術（Revision）— TORP 困難症例',
    description: '63歳女性。10年前に鼓室形成IV型手術施行。術後聴力改善後、徐々に再悪化。CTにて以前のTORPが底板から外れ後鼓室に落下。鼓室内に瘢痕組織と肉芽。再手術の典型例。前回使用プロステーシス摘出、瘢痕除去、新規TORPによる再建。',
    difficulty: 'advanced',
    ossicularStatus: { malleus: 'absent', incus: 'absent', stapes: 'footplate-only' },
    recommendedProductId: 'torp-ttp-variac',
    recommendedLength: 5.5,
    // 再手術(Revision)では瘢痕収縮により底板が外側縁に偏位することがある。
    // フット部を若干外側(+0.2mm)に設置することで底板中央〜外側の安定した接触を確保。
    // 傾きは瘢痕の影響で完全垂直は困難なため5°を許容する。
    idealLateralOffset: 0.2,
    idealAngle: 3,
    preOpAbg: 35,
    clinicalNotes: '初回術後10年での再手術。鼓室内は瘢痕組織に富み術野展開に難渋。底板は露出されているが可動性は軽度低下。瘢痕を丁寧に除去後、底板可動性を再確認し新規TORPを設置。鼓膜は瘢痕性に肥厚しており、軟骨補強を追加。',
    teachingPoints: [
      '再手術（Revision）では初回手術の術式と結果を正確に把握することが前提。前院の手術記録・使用プロステーシス情報を収集する。',
      '瘢痕組織の除去は顔面神経・鼓索神経への刺激リスクを伴う。モニタリング下での慎重な操作が必要。',
      '再手術ではプロステーシスの高さ（シャフト長）が初回と異なることが多い。必ず術中計測を行う。',
      'プロステーシス脱落の原因（不適切なサイジング・感染・底板固定など）を評価し再発防止策を講じる。',
      '再手術の合併症率は初回手術より高い。術前インフォームドコンセントで難易度と合併症リスクを十分説明する。',
    ],
    tags: {
      procedure: ['鼓室形成IV型', 'TORP', '再手術(Revision)'],
      lesion:    ['プロステーシス脱落', '鼓室瘢痕', '全耳小骨欠損'],
    },
  },
  {
    id: 'case-010',
    title: '症例10: 耳硬化症 — アブミ骨手術（Stapedotomy）',
    description: '38歳女性。両側進行性伝音難聴。純音聴力検査でCarhart notch（2kHz骨導低下）あり。ティンパノグラムAs型。CTにてアブミ骨底板肥厚、窓龕周囲のハロー所見。耳硬化症の診断。アブミ骨底板固定に対するStapedotomy（ピストン法）の教育症例。本シミュレーターではアブミ骨底板までのアクセスと評価を学ぶ。',
    difficulty: 'advanced',
    ossicularStatus: { malleus: 'intact', incus: 'intact', stapes: 'footplate-only' },
    recommendedProductId: 'soft-clip-stapes',
    recommendedLength: 4.0,
    // Stapedotomy: キヌタ骨長突起〜底板開窓部の距離。クリップをキヌタ骨長突起に固定。
    // 底板中央(offset 0)・垂直(0°)が最重要。
    idealLateralOffset: 0.0,
    idealAngle: 0,
    preOpAbg: 45,
    clinicalNotes: '耳硬化症のStapedotomyでは、まずアブミ骨上部構造（前後弓・頭部）を切断・摘出し、底板に0.4〜0.6mm径の小孔を開ける（底板開窓）。Soft Clipのバンドをキヌタ骨長突起にクリンピング不要で固定し、シャフト先端を底板孔に挿入（ピストン法）。バンドスプリング機構がキヌタ骨長突起の径に自動適合。本シミュレーターはアブミ骨底板へのアクセスと評価フローに特化。',
    teachingPoints: [
      'アブミ骨底板固定の確認方法：細い吸引管でアブミ骨頭部を軽く押す。正常なら弾性的に動く。固定なら全く動かない。',
      '顔面神経水平部はアブミ骨直上を走行する。顔面神経と底板の距離確認がStapedotomyの最重要ステップ。',
      'ピストン径（0.4mm vs 0.6mm）の選択：0.4mmは内耳障害リスクが低いが音響効果がやや劣る。0.6mmは逆。',
      '底板開窓はレーザー（CO2またはEr:YAG）またはマイクロドリルで行う。過度の圧力は内耳障害の原因になる。',
      '両側耳硬化症では片側ずつ手術を行う。初回手術の結果を評価してから対側手術の適応を決定する。',
    ],
    tags: {
      procedure: ['アブミ骨手術', 'Stapedotomy', 'ピストン法'],
      lesion:    ['耳硬化症', 'アブミ骨底板固定', 'Carhart notch'],
    },
  },
  {
    id: 'case-006',
    title: '症例6: アブミ骨底板固定疑い（耳硬化症合併）— TORP 高難度',
    description: '52歳女性。両側の混合性難聴（骨導低下を伴う）。真珠腫術後、耳小骨連鎖全欠損。アブミ骨底板のみ残存するが、術前CTにて底板肥厚・ハロー所見あり。耳硬化症の合併が疑われる。術中に底板可動性を慎重に評価しTORPを設置する高難度症例。',
    difficulty: 'advanced',
    ossicularStatus: { malleus: 'absent', incus: 'absent', stapes: 'footplate-only' },
    recommendedProductId: 'torp-ttp-variac',
    recommendedLength: 4.5,
    // 耳硬化症では底板が肥厚・中央固定のため底板中央(offset 0)・垂直(0°)が厳格に要求される。
    // 偏心配置は固定底板への不均等圧力で術後めまいの原因となる。
    idealLateralOffset: 0.0,
    idealAngle: 0,
    preOpAbg: 45,
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
  {
    id: 'case-011',
    title: '症例11: 小児慢性中耳炎 — PORP（II型 小児）',
    description: '8歳男児。3歳から反復性急性中耳炎の既往。左耳に鼓膜穿孔が持続し慢性化。術前CT・鼓室鏡にてキヌタ骨長突起の骨吸収（partial）を確認。ツチ骨柄および鼓膜臍部は温存。アブミ骨上部構造は保存されており鼓室形成II型の適応。小児のため外耳道が狭く、軟骨グラフトとPORPを組み合わせた鼓室形成術を計画。',
    difficulty: 'intermediate',
    ossicularStatus: { malleus: 'intact', incus: 'partial', stapes: 'suprastructure' },
    recommendedProductId: 'porp-ttp-variac',
    recommendedLength: 2.0,
    idealLateralOffset: -0.1,
    idealAngle: 5,
    preOpAbg: 30,
    clinicalNotes: '小児の外耳道は成人と比べて狭く短い。顕微鏡視野確保のため耳後切開が必要な場合がある。軟骨グラフト（耳珠軟骨）を鼓膜補強に使用し、頭板下に薄い軟骨片を挟んでプロステーシスの押出しを防止する。キヌタ骨長突起残存部は除去してPORP頭板の支持面を確保する。',
    teachingPoints: [
      '小児慢性中耳炎ではキヌタ骨長突起の骨吸収が最多パターン（II型）。ツチ骨柄は比較的保存されることが多い。',
      '小児は成人より耳小骨間距離が短い傾向があり、プロステーシス長は術中サイザーで実測することが必須。',
      '軟骨グラフトとPORPの組み合わせは小児・再手術例での鼓膜穿孔再発防止に有効。',
      '術後管理：小児は自己管理が難しいため、保護者への耳管通気・水への注意の教育が重要。',
      '小児では中耳炎の再発リスクが残るため、術後フォローアップを6ヶ月ごとに継続する。',
    ],
    tags: {
      procedure: ['鼓室形成II型', 'PORP', '軟骨グラフト'],
      lesion:    ['小児慢性中耳炎', 'キヌタ骨長突起骨吸収'],
    },
  },
  {
    id: 'case-012',
    title: '症例12: ツチ骨・キヌタ骨欠損（III型）— PORP 入門',
    description: '38歳女性。慢性穿孔性中耳炎（非真珠腫性）。ツチ骨・キヌタ骨は骨吸収により欠損。アブミ骨上部構造（頭部・前後脚）は完全温存、可動性良好。術野清潔で解剖確認が容易。鼓室形成III型の入門症例。',
    difficulty: 'beginner',
    ossicularStatus: { malleus: 'absent', incus: 'absent', stapes: 'suprastructure' },
    recommendedProductId: 'porp-ttp-variac',
    recommendedLength: 2.0,
    idealLateralOffset: 0.0,
    idealAngle: 0,
    preOpAbg: 35,
    clinicalNotes: '軟骨（耳珠軟骨）で鼓膜を再建し、軟骨〜アブミ骨頭間距離をサイザーで実測。本症例は約2.0mm。術野が清潔でアブミ骨頭部が明視野に確認でき、ベル型フットで安定保持が可能。',
    teachingPoints: [
      'III型の定義：ツチ骨・キヌタ骨欠損、アブミ骨上部構造温存。PORP（Bell foot）をアブミ骨頭部上に設置。',
      'II型との違い：ツチ骨柄が残存すればII型（PORP under malleus）、なければIII型（PORP on stapes head）。',
      'シャフト長は術中サイザーで実測する。通常1.5〜2.5mmの範囲。CTの距離は参考値にとどめる。',
      '頭板と鼓膜再建軟骨の間に薄い軟骨片を追加すると押し出しリスクが低下する。',
    ],
    tags: {
      procedure: ['鼓室形成III型', 'PORP'],
      lesion:    ['慢性穿孔性中耳炎', 'ツチ骨・キヌタ骨欠損'],
    },
  },
  {
    id: 'case-013',
    title: '症例13: 全耳小骨欠損（IV型）— TORP 入門',
    description: '52歳男性。慢性穿孔性中耳炎術後（鼓膜形成術後）。耳小骨連鎖の完全欠損を確認。アブミ骨底板は温存・可動性良好。合併症なく術野明瞭。鼓室形成IV型のTORP入門症例。',
    difficulty: 'beginner',
    ossicularStatus: { malleus: 'absent', incus: 'absent', stapes: 'footplate-only' },
    recommendedProductId: 'torp-ttp-variac',
    recommendedLength: 4.5,
    idealLateralOffset: 0.0,
    idealAngle: 0,
    preOpAbg: 40,
    clinicalNotes: '鼓膜（軟骨再建）〜アブミ骨底板間距離は約4.5mm。フット部が底板上中央に安定設置されることを確認。底板の可動性が良好であることが術前評価で確認済み。合併症がなく教育的に理想的な症例。',
    teachingPoints: [
      'IV型の定義：耳小骨連鎖の完全欠損、アブミ骨底板のみ残存。TORP（Flat foot）を底板中央に設置。',
      'フット部の偏心は厳禁。底板縁に接触するとめまい・感音難聴のリスクがある。',
      'TORPのシャフト長は正確な距離実測が必須。高さ不足（不接触）も過剰（鼓膜圧迫）も不良結果となる。',
      '底板固着（耳硬化症合併）が疑われる場合はTORPでも改善不良。術中に底板可動性を必ず確認する。',
    ],
    tags: {
      procedure: ['鼓室形成IV型', 'TORP'],
      lesion:    ['慢性穿孔性中耳炎', '全耳小骨欠損'],
    },
  },
  {
    id: 'case-014',
    title: '症例14: 耳硬化症 Grade 1（典型例）— Stapedotomy 入門',
    description: '30歳女性。右耳の進行性伝音難聴（2年間）。自覚的な耳鳴りなし。純音聴力検査：右耳平均ABG 40dB、骨導正常（Carhart notch 2kHz +10dB）。ティンパノグラムAs型。CTにて右アブミ骨底板の軽度肥厚（1.2mm）、ハロー所見あり。典型的な片側耳硬化症 Grade 1（Sando分類）。Stapedotomyの入門症例。',
    difficulty: 'beginner',
    ossicularStatus: { malleus: 'intact', incus: 'intact', stapes: 'footplate-only' },
    recommendedProductId: 'soft-clip-stapes',
    recommendedLength: 4.0,
    idealLateralOffset: 0.0,
    idealAngle: 0,
    preOpAbg: 40,
    clinicalNotes: 'Grade 1耳硬化症の典型例。底板軽度肥厚で可動性は完全に消失。キヌタ骨長突起〜底板開窓部の距離は約4.0mm。Soft Clipのバンドをキヌタ骨長突起に固定し、0.4mm径ピストンを底板開窓部に挿入。骨導が正常であり、ABGの術後完全閉鎖（0dB）が期待できる好適症例。',
    teachingPoints: [
      '耳硬化症の診断三徴：進行性伝音難聴・Carhart notch（2kHz）・ティンパノグラムAs型。CTで底板肥厚とハロー所見を確認。',
      '底板固定確認：細い吸引管でアブミ骨頭部を軽く押す。正常なら弾性的に動く。固定なら全く動かない。本症例は完全固定。',
      'Soft Clipの利点：クリンピング不要のスプリング式バンドがキヌタ骨長突起の径に自動適合。術者の習熟度によらず安定した固定が得られる。',
      '底板開窓の位置：底板中央前方1/3が最適。後方への偏心はプロモントリー方向への内耳リンパ液洩れのリスクがある。',
      '骨導正常であればABGの完全閉鎖が期待でき、術後聴力改善の予後は良好。片側例では対側のフォローアップも継続する。',
    ],
    tags: {
      procedure: ['アブミ骨手術', 'Stapedotomy', 'ピストン法'],
      lesion:    ['耳硬化症 Grade 1', 'アブミ骨底板固定', '片側伝音難聴'],
    },
  },
  {
    id: 'case-015',
    title: '症例15: 耳硬化症 Grade 2（両側・混合性）— Stapedotomy 中級',
    description: '45歳男性。両側の進行性難聴（10年間）。左耳が先に悪化、右耳も低音域から難聴が進行中。純音聴力検査：左耳平均ABG 50dB、骨導2kHz -15dB（Carhart notch）、4kHzも-10dBの低下。ティンパノグラムAs型。CTにて両側底板肥厚（左1.8mm）、蝸牛周囲ハロー所見。耳硬化症 Grade 2（中等度）。左耳先行Stapedotomy。混合性難聴のため術後ABG改善は部分的である点を術前に説明する必要がある。',
    difficulty: 'intermediate',
    ossicularStatus: { malleus: 'intact', incus: 'intact', stapes: 'footplate-only' },
    recommendedProductId: 'soft-clip-stapes',
    recommendedLength: 4.25,
    idealLateralOffset: 0.0,
    idealAngle: 0,
    preOpAbg: 50,
    clinicalNotes: '底板より厚い（1.8mm）Grade 2症例。開窓はCO2レーザーまたはマイクロドリルで慎重に施行。底板開窓部の出血コントロールが重要。キヌタ骨長突起〜底板間距離は約4.25mm。骨導低下（感音成分）があるため、術後ABG改善は30〜40dBに留まる可能性を術前に説明。',
    teachingPoints: [
      '混合性難聴の解釈：ABG（気骨導差）=伝音成分。骨導低下=感音成分。Stapedotomyで改善できるのは伝音成分（ABG）のみ。骨導成分は改善しない。',
      'Carhart notch（2kHz骨導低下）は機械的影響であり、真の感音難聴ではない。Stapedotomy後に骨導が5〜10dB改善することがある（Carhart effect reversal）。',
      'Grade 2では底板が厚く硬いため、開窓時の圧力コントロールが重要。内耳窓に過度の圧力がかかると感音難聴悪化のリスクがある。',
      '両側例では6〜12ヶ月後に対側Stapedotomyを検討。初回手術の客観的結果（ABG改善）と主観的満足度を評価してから対側の適応を決定する。',
      '長期フォロー：耳硬化症は進行性疾患。Stapedotomy後も耳硬化病変が進行し、骨導がさらに低下するケースがある。年1回の聴力検査を継続。',
    ],
    tags: {
      procedure: ['アブミ骨手術', 'Stapedotomy', 'ピストン法'],
      lesion:    ['耳硬化症 Grade 2', '両側難聴', '混合性難聴', 'Carhart notch'],
    },
  },
] satisfies SurgicalCase[]).sort((a, b) => a.id.localeCompare(b.id)); // H3-b: データ追加順ではなくid昇順で表示
