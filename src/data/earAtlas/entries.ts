/**
 * data/earAtlas/entries.ts ── Ear Atlas データ (Phase2 / Phase2.1)
 *
 * 収録範囲（shojiさん承認の「推奨」スコープ）:
 *   既存 DANGER_ZONES 5件（顔面神経×3区間・S状静脈洞・頸静脈球）
 *   + 既存 ENDO_ZONES/StructureKey 由来の主要構造（耳小骨3・鼓膜・鼓索神経）
 *   + 正円窓（TympanoCavityModel.tsx由来）
 *   計11構造物。
 *
 * 【重要】値はすべて既存ファイルからの転記であり、新たな解剖学的判断・新しい実測は
 * 一切加えていない。出典は各定数のコメントに元ファイルを明記した。
 * positionWorld / relativePosition.offsetMm / path.points の tangent/normal は、
 * GLB_LOCAL値またはWORLD値からコード側で算出する（手計算・手入力を排除するため）。
 * 既存ファイル（dangerZones.ts / RealAnatomyModels.tsx / OssicleModels.tsx /
 * TympanoCavityModel.tsx 等）は本Phaseでは一切変更しない。
 *
 * 正常サイズ(mm)は、信頼できる実測・文献値の出典が確認できなかったため、
 * 本Phaseでは全エントリで意図的に未設定のまま残した（フィールド自体は用意済み、
 * 推測値を入れて精度を偽装しない）。
 *
 * Phase2.1（2026-07-16 shojiさんレビュー対応）:
 * 顔面神経（鼓室部・乳突部）と鼓索神経は「点」ではなく「経路(path)」として扱い、
 * 開始点・終了点・各点のtangent（走行方向）・normal（幾何学的な垂直参照方向）を追加した。
 * 「顔面神経（第2膝部 = second genu）」は解剖学的に経路ではなく屈曲点そのもの（landmark）
 * であるため、shapeType='point'のまま据え置いた（鼓室部pathの終点・乳突部pathの始点として
 * 両方のpathから参照されており、genuの位置における方向はそれらのpathから取得できる）。
 */
import { glbLocalToWorld } from '../../engine/coordinates/transforms';
import { computeReferenceNormal, computeTangent, subtractVec3 } from '../../engine/coordinates/vectorMath';
import type { EarAtlasEntry, EarAtlasPathPoint } from './types';
import type { Vec3Tuple } from '../../engine/coordinates/types';

// ── 出典GLB_LOCAL座標（各定数のコメントに元ファイルを明記） ─────────────
const FACIAL_TYMPANIC_GLB: Vec3Tuple = [0, 2.8, -1.5];      // dangerZones.ts DANGER_ZONES['facial-tympanic']
const FACIAL_GENU_GLB: Vec3Tuple = [-4, 1.5, -3.0];         // dangerZones.ts DANGER_ZONES['facial-genu']
const FACIAL_MASTOID_GLB: Vec3Tuple = [-4, -8, -4.0];       // dangerZones.ts DANGER_ZONES['facial-mastoid']
const SIGMOID_SINUS_GLB: Vec3Tuple = [-12, -3, -8];         // dangerZones.ts DANGER_ZONES['sigmoid-sinus']
const JUGULAR_BULB_GLB: Vec3Tuple = [-2, -13, -5];          // dangerZones.ts DANGER_ZONES['jugular-bulb']
const MALLEUS_HEAD_GLB: Vec3Tuple = [0.0, 3.6, 4.2];        // OssicleModels.tsx header（ツチ骨頭）
const INCUS_BODY_GLB: Vec3Tuple = [-0.8, 2.2, 3.8];         // OssicleModels.tsx header（キヌタ骨体）
const STAPES_FOOTPLATE_GLB: Vec3Tuple = [0.84, -2.65, 2.12]; // OssicleModels.tsx STAPES_FOOTPLATE
const UMBO_GLB: Vec3Tuple = [0.0, 0.0, 5.0];                // OssicleModels.tsx UMBO_POS
const ROUND_WINDOW_GLB: Vec3Tuple = [0.84, -4.2, 1.5];      // TympanoCavityModel.tsx header（正円窓）
const CHORDA_START_GLB: Vec3Tuple = [0.0, 2.8, 4.5];        // TympanoCavityModel.tsx header（鼓索神経 起点）
const CHORDA_END_GLB: Vec3Tuple = [2.0, -3.0, 5.0];         // TympanoCavityModel.tsx header（鼓索神経 終点）

// ── WORLD座標（glbLocalToWorld()で算出、手計算なし） ──────────────────
const FACIAL_TYMPANIC_WORLD = glbLocalToWorld(FACIAL_TYMPANIC_GLB);
const FACIAL_GENU_WORLD = glbLocalToWorld(FACIAL_GENU_GLB);
const FACIAL_MASTOID_WORLD = glbLocalToWorld(FACIAL_MASTOID_GLB);
const SIGMOID_SINUS_WORLD = glbLocalToWorld(SIGMOID_SINUS_GLB);
const JUGULAR_BULB_WORLD = glbLocalToWorld(JUGULAR_BULB_GLB);
const MALLEUS_HEAD_WORLD = glbLocalToWorld(MALLEUS_HEAD_GLB);
const INCUS_BODY_WORLD = glbLocalToWorld(INCUS_BODY_GLB);
const STAPES_FOOTPLATE_WORLD = glbLocalToWorld(STAPES_FOOTPLATE_GLB);
const UMBO_WORLD = glbLocalToWorld(UMBO_GLB);
const ROUND_WINDOW_WORLD = glbLocalToWorld(ROUND_WINDOW_GLB);
const CHORDA_START_WORLD = glbLocalToWorld(CHORDA_START_GLB);
const CHORDA_END_WORLD = glbLocalToWorld(CHORDA_END_GLB);

// ── 経路(path)構造のtangent/normal算出ヘルパー（Phase2.1） ────────────
// tangentは「from→to」の単位ベクトル、normalはtangentから幾何学的に導出した参照垂直方向。
// 医学的な前方/後方の意味付けは保証しない（vectorMath.ts のJSDoc参照）。
function pathPoint(positionWorld: Vec3Tuple, from: Vec3Tuple, to: Vec3Tuple): EarAtlasPathPoint {
  const tangent = computeTangent(from, to);
  return { positionWorld, tangent, normal: computeReferenceNormal(tangent) };
}

export const EAR_ATLAS_ENTRIES: readonly EarAtlasEntry[] = [
  // ── 顔面神経（3区間、出典: data/dangerZones.ts） ──────────────────
  {
    id: 'nerve.facial.tympanic',
    legacyIds: { structureKey: 'facialNerve', dangerZoneId: 'facial-tympanic', endoZoneId: 'facial-tympanic' },
    nameJa: '顔面神経（鼓室部）',
    nameEn: 'Facial Nerve – Tympanic Segment',
    category: 'nerve',
    positionWorld: FACIAL_TYMPANIC_WORLD,
    adjacentStructureIds: ['ossicle.stapes', 'nerve.facial.genu'],
    shapeType: 'path',
    // 開始点=自身の代表点（前方の起点は本Atlas未収録）、終了点=第2膝部（次区間との境界）
    path: { points: [
      pathPoint(FACIAL_TYMPANIC_WORLD, FACIAL_TYMPANIC_WORLD, FACIAL_GENU_WORLD),
      pathPoint(FACIAL_GENU_WORLD, FACIAL_TYMPANIC_WORLD, FACIAL_GENU_WORLD),
    ] },
    dangerLevel: 'critical',
    educationCommentJa:
      '卵円窓上方を走行する顔面神経水平部。内側壁の骨管内を前方から後方へ走る。削開中に最も損傷リスクが高い部位。' +
      '卵円窓から約2〜3mm上方に位置し、骨管が自然裂開している例が10〜30%存在する。安全域は2mm以上を確保すること。',
    color: '#f5d820',
    defaultVisible: true,
    sourceTag: '一般耳科知識',
    lastVerifiedMethod: '未検証',
  },
  {
    id: 'nerve.facial.genu',
    legacyIds: { structureKey: 'facialNerve', dangerZoneId: 'facial-genu' },
    nameJa: '顔面神経（第2膝部）',
    nameEn: 'Facial Nerve – Second Genu',
    category: 'nerve',
    positionWorld: FACIAL_GENU_WORLD,
    relativePosition: {
      referenceId: 'nerve.facial.tympanic',
      offsetMm: subtractVec3(FACIAL_GENU_WORLD, FACIAL_TYMPANIC_WORLD),
      descriptionJa: '水平部（鼓室部）から後方・下方へ屈曲する部位',
    },
    adjacentStructureIds: ['nerve.facial.tympanic', 'nerve.facial.mastoid', 'ossicle.incus'],
    // 第2膝部は経路ではなく屈曲点そのもの（landmark）。方向情報は鼓室部path終点・
    // 乳突部path始点として両側からこの位置のtangentを参照できる。
    shapeType: 'point',
    dangerLevel: 'critical',
    educationCommentJa:
      '顔面神経が水平部（鼓室部）から垂直部（乳突部）へと屈曲する部位。後鼓室削開のランドマーク。' +
      '砧骨窩との距離を常に把握すること。後鼓室径路（facial recess）手術時の重要ランドマーク。',
    color: '#f5d820',
    defaultVisible: true,
    sourceTag: '一般耳科知識',
    lastVerifiedMethod: '未検証',
  },
  {
    id: 'nerve.facial.mastoid',
    legacyIds: { structureKey: 'facialNerve', dangerZoneId: 'facial-mastoid' },
    nameJa: '顔面神経（乳突部）',
    nameEn: 'Facial Nerve – Mastoid Segment',
    category: 'nerve',
    positionWorld: FACIAL_MASTOID_WORLD,
    adjacentStructureIds: ['nerve.facial.genu', 'vascular.sigmoidSinus'],
    shapeType: 'path',
    // 開始点=第2膝部（前区間との境界）、終了点=自身の代表点（茎乳突孔側は本Atlas未収録）
    path: { points: [
      pathPoint(FACIAL_GENU_WORLD, FACIAL_GENU_WORLD, FACIAL_MASTOID_WORLD),
      pathPoint(FACIAL_MASTOID_WORLD, FACIAL_GENU_WORLD, FACIAL_MASTOID_WORLD),
    ] },
    dangerLevel: 'critical',
    educationCommentJa:
      '第2膝部から茎乳突孔まで垂直に下行する乳突部。乳突削開の前内側境界となる。' +
      '乳突洞削開時は常に本部位の前方・内側を削る。成人では茎乳突孔の約10〜15mm上方。蝸牛との間の骨橋（bridge）を温存すること。',
    color: '#f5d820',
    defaultVisible: true,
    sourceTag: '一般耳科知識',
    lastVerifiedMethod: '未検証',
  },
  // ── 血管構造（2件、出典: data/dangerZones.ts） ──────────────────
  {
    id: 'vascular.sigmoidSinus',
    legacyIds: { dangerZoneId: 'sigmoid-sinus' },
    nameJa: 'S状静脈洞',
    nameEn: 'Sigmoid Sinus',
    category: 'vascular',
    positionWorld: SIGMOID_SINUS_WORLD,
    adjacentStructureIds: ['nerve.facial.mastoid'],
    shapeType: 'point',
    dangerLevel: 'critical',
    educationCommentJa:
      '後頭蓋窩硬膜静脈洞。乳突削開の後外側境界であり、損傷すると大量出血をきたす。' +
      "Körner隔壁（Körner's septum）の後方に位置。術前CTで位置を確認し、前方に偏位している例（anterior sigmoid sinus）では術野が狭小化する。",
    color: '#4477ff',
    defaultVisible: true,
    sourceTag: '一般耳科知識',
    lastVerifiedMethod: '未検証',
  },
  {
    id: 'vascular.jugularBulb',
    legacyIds: { dangerZoneId: 'jugular-bulb' },
    nameJa: '頸静脈球',
    nameEn: 'Jugular Bulb',
    category: 'vascular',
    positionWorld: JUGULAR_BULB_WORLD,
    relativePosition: {
      referenceId: 'window.round',
      offsetMm: subtractVec3(JUGULAR_BULB_WORLD, ROUND_WINDOW_WORLD),
      descriptionJa: '正円窓の下方に位置する（高位例では正円窓・蝸牛に達することがある）',
    },
    adjacentStructureIds: ['window.round'],
    shapeType: 'point',
    dangerLevel: 'critical',
    educationCommentJa:
      '正円窓下方に位置する内頸静脈の拡張部。高位の場合は正円窓・蝸牛に達することがある（高位頸静脈球）。' +
      '高位頸静脈球では正円窓手術・cochlear implant電極挿入時のリスクが増大。骨被覆がない例（dehiscent jugular bulb）も存在する。',
    color: '#3366ee',
    defaultVisible: true,
    sourceTag: '一般耳科知識',
    lastVerifiedMethod: '未検証',
  },
  // ── 耳小骨（3件、出典: scenes/models/OssicleModels.tsx） ──────────
  {
    id: 'ossicle.malleus',
    legacyIds: { structureKey: 'malleus', endoZoneId: 'ossicles' },
    nameJa: 'ツチ骨',
    nameEn: 'Malleus',
    category: 'ossicle',
    positionWorld: MALLEUS_HEAD_WORLD,
    relativePosition: {
      referenceId: 'membrane.tympanic',
      offsetMm: subtractVec3(MALLEUS_HEAD_WORLD, UMBO_WORLD),
      distanceMm: 3.62,
      descriptionJa: '臍部（鼓膜中心）から3.62mm上方（ツチ骨頭）',
    },
    adjacentStructureIds: ['ossicle.incus', 'membrane.tympanic'],
    shapeType: 'point',
    dangerLevel: 'safe',
    educationCommentJa: 'ツチ骨柄が鼓膜臍部に付着し、ツチ骨頭がキヌタ骨体と鞍関節で連結する耳小骨連鎖の起点。',
    color: '#e6a93a',
    defaultVisible: true,
    sourceTag: '一般耳科知識',
    lastVerifiedMethod: '未検証',
  },
  {
    id: 'ossicle.incus',
    legacyIds: { structureKey: 'incus', endoZoneId: 'ossicles' },
    nameJa: 'キヌタ骨',
    nameEn: 'Incus',
    category: 'ossicle',
    positionWorld: INCUS_BODY_WORLD,
    relativePosition: {
      referenceId: 'ossicle.malleus',
      offsetMm: subtractVec3(INCUS_BODY_WORLD, MALLEUS_HEAD_WORLD),
      descriptionJa: 'ツチ骨頭の後内方（鞍関節で連結）',
    },
    adjacentStructureIds: ['ossicle.malleus', 'ossicle.stapes'],
    shapeType: 'point',
    dangerLevel: 'safe',
    educationCommentJa: '体部でツチ骨頭と関節し、長脚が下方へ走ってアブミ骨頭と豆状突起で連結する。',
    color: '#d9892a',
    defaultVisible: true,
    sourceTag: '一般耳科知識',
    lastVerifiedMethod: '未検証',
  },
  {
    id: 'ossicle.stapes',
    legacyIds: { structureKey: 'stapes', endoZoneId: 'ossicles' },
    nameJa: 'アブミ骨',
    nameEn: 'Stapes',
    category: 'ossicle',
    positionWorld: STAPES_FOOTPLATE_WORLD,
    relativePosition: {
      referenceId: 'membrane.tympanic',
      offsetMm: subtractVec3(STAPES_FOOTPLATE_WORLD, UMBO_WORLD),
      distanceMm: 4.00,
      descriptionJa: '臍部（鼓膜中心）からのTORPシャフト相当距離（底板中心）',
    },
    adjacentStructureIds: ['ossicle.incus', 'nerve.facial.tympanic', 'window.round'],
    shapeType: 'point',
    dangerLevel: 'caution',
    educationCommentJa:
      '底板が卵円窓に嵌る。底板中心はこのアプリのGLB原点でもある。過剰挿入による底板骨折・内耳障害に注意。',
    color: '#f2cb54',
    defaultVisible: true,
    sourceTag: '一般耳科知識',
    lastVerifiedMethod: '未検証',
  },
  // ── 鼓膜（出典: scenes/models/OssicleModels.tsx UMBO_POS） ─────────
  {
    id: 'membrane.tympanic',
    legacyIds: { structureKey: 'tympanic', endoZoneId: 'tympanic' },
    nameJa: '鼓膜',
    nameEn: 'Tympanic Membrane',
    category: 'membrane',
    abbreviation: 'TM',
    positionWorld: UMBO_WORLD,
    adjacentStructureIds: ['ossicle.malleus'],
    shapeType: 'point',
    dangerLevel: 'safe',
    educationCommentJa: '円錐状で臍部（ツチ骨柄付着部）が最深部。臍部はこのAtlasの多くの相対位置の基準点として使われる。',
    color: '#f8d8c0',
    defaultVisible: true,
    sourceTag: '一般耳科知識',
    lastVerifiedMethod: '未検証',
  },
  // ── 正円窓（出典: scenes/models/TympanoCavityModel.tsx） ──────────
  {
    id: 'window.round',
    legacyIds: { structureKey: 'roundWindow' },
    nameJa: '正円窓',
    nameEn: 'Round Window',
    category: 'window',
    positionWorld: ROUND_WINDOW_WORLD,
    relativePosition: {
      referenceId: 'ossicle.stapes',
      offsetMm: subtractVec3(ROUND_WINDOW_WORLD, STAPES_FOOTPLATE_WORLD),
      descriptionJa: '卵円窓（アブミ骨底板）の後下方',
    },
    adjacentStructureIds: ['ossicle.stapes', 'vascular.jugularBulb'],
    shapeType: 'point',
    dangerLevel: 'safe',
    educationCommentJa: '卵円窓の後下方に位置する。蝸牛内圧を逃がす窓であり、高位頸静脈球では近接することがある。',
    color: '#80ccff',
    defaultVisible: true,
    sourceTag: '一般耳科知識',
    lastVerifiedMethod: '未検証',
  },
  // ── 鼓索神経（出典: scenes/models/TympanoCavityModel.tsx） ────────
  {
    id: 'nerve.chorda',
    legacyIds: { structureKey: 'chordaTympani', endoZoneId: 'chorda' },
    nameJa: '鼓索神経',
    nameEn: 'Chorda Tympani',
    category: 'nerve',
    positionWorld: CHORDA_START_WORLD,
    adjacentStructureIds: ['ossicle.malleus'],
    shapeType: 'path',
    // TympanoCavityModel.tsxが明記する2点（起点→終点）をそのまま経路として採用
    path: { points: [
      pathPoint(CHORDA_START_WORLD, CHORDA_START_WORLD, CHORDA_END_WORLD),
      pathPoint(CHORDA_END_WORLD, CHORDA_START_WORLD, CHORDA_END_WORLD),
    ] },
    dangerLevel: 'caution',
    educationCommentJa:
      '顔面神経鼓室部から分岐し鼓室内を前方へ横切りツチ骨頸部付近を通過する。味覚・唾液分泌に関与し、' +
      '鼓室形成術で温存が望ましいが、やむを得ず切断しても致命的ではない。',
    color: '#f0b830',
    defaultVisible: true,
    sourceTag: '一般耳科知識',
    lastVerifiedMethod: '未検証',
  },
];

// ── 開発時セルフチェック（参照整合性、Phase2.1でpath整合性チェックを追加） ──
if (import.meta.env.DEV) {
  const ids = new Set(EAR_ATLAS_ENTRIES.map((e) => e.id));

  const idCounts = new Map<string, number>();
  for (const e of EAR_ATLAS_ENTRIES) idCounts.set(e.id, (idCounts.get(e.id) ?? 0) + 1);
  for (const [id, count] of idCounts) {
    if (count > 1) {
      console.warn(`[earAtlas] id "${id}" が${count}件重複している`);
    }
  }

  for (const entry of EAR_ATLAS_ENTRIES) {
    for (const adjId of entry.adjacentStructureIds ?? []) {
      if (!ids.has(adjId)) {
        console.warn(`[earAtlas] ${entry.id}: adjacentStructureIds に未知のid "${adjId}"`);
      }
    }
    const refId = entry.relativePosition?.referenceId;
    if (refId && !ids.has(refId)) {
      console.warn(`[earAtlas] ${entry.id}: relativePosition.referenceId に未知のid "${refId}"`);
    }
    if (entry.shapeType === 'path' && (!entry.path || entry.path.points.length < 2)) {
      console.warn(`[earAtlas] ${entry.id}: shapeType='path'だがpathが未設定または点数不足`);
    }
  }
}
