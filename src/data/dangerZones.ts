/**
 * dangerZones.ts  ── 側頭骨削開における危険部位定義
 *
 * 座標系: GLB原点 = アブミ骨底板 (0,0,0)
 *   Z+ = 外耳道方向（外側）
 *   Y+ = 上方
 *   X+ = 前方（顔面方向）
 *
 * 警告距離: warningRadius 5mm（黄色） / dangerRadius 2mm（赤）
 */

export interface DangerZone {
  id: string;
  nameJa: string;
  nameEn: string;
  category: 'facial' | 'vascular';
  /** OpenEar ALPHA GLB world coordinates (AnatomyScene, stapes footplate = origin) */
  position: [number, number, number];
  /** 黄色警告球の半径 mm */
  warningRadius: number;
  /** 赤危険核の半径 mm */
  dangerRadius: number;
  /** 構造色 */
  color: string;
  /** 発光色 */
  glowColor: string;
  importance: 'critical';
  /** 短い説明 */
  shortDescJa: string;
  /** 臨床メモ */
  clinicalNoteJa: string;
  /** 合併症 */
  complicationJa: string;
}

export const DANGER_ZONES: DangerZone[] = [
  {
    id: 'facial-tympanic',
    nameJa: '顔面神経（鼓室部）',
    nameEn: 'Facial Nerve – Tympanic Segment',
    category: 'facial',
    // 卵円窓の約2.5mm上方、内側壁の骨管内を走行
    position: [0, 2.8, -1.5],
    warningRadius: 5,
    dangerRadius: 2,
    color: '#f5d820',
    glowColor: '#f5d820',
    importance: 'critical',
    shortDescJa:
      '卵円窓上方を走行する顔面神経水平部。内側壁の骨管内を前方から後方へ走る。削開中に最も損傷リスクが高い部位。',
    clinicalNoteJa:
      '卵円窓から約2〜3mm上方に位置。骨管が自然裂開している例が10〜30%存在し、特に危険。' +
      '安全域は2mm以上を確保すること。',
    complicationJa: '永続的顔面神経麻痺（House-Brackmann grade 3以上）',
  },
  {
    id: 'facial-genu',
    nameJa: '顔面神経（第2膝部）',
    nameEn: 'Facial Nerve – Second Genu',
    category: 'facial',
    // 後鼓室、水平部から乳突部への屈曲部
    position: [-4, 1.5, -3.0],
    warningRadius: 5,
    dangerRadius: 2,
    color: '#f5d820',
    glowColor: '#ffa500',
    importance: 'critical',
    shortDescJa:
      '顔面神経が水平部（鼓室部）から垂直部（乳突部）へと屈曲する部位。後鼓室削開のランドマーク。',
    clinicalNoteJa:
      '砧骨窩との距離を常に把握すること。後鼓室径路（facial recess）手術時の重要ランドマーク。',
    complicationJa: '顔面神経麻痺（一時的・永続的）',
  },
  {
    id: 'facial-mastoid',
    nameJa: '顔面神経（乳突部）',
    nameEn: 'Facial Nerve – Mastoid Segment',
    category: 'facial',
    // 乳突洞前内側を茎乳突孔まで垂直に下行
    position: [-4, -8, -4.0],
    warningRadius: 5,
    dangerRadius: 2,
    color: '#f5d820',
    glowColor: '#f5d820',
    importance: 'critical',
    shortDescJa:
      '第2膝部から茎乳突孔まで垂直に下行する乳突部。乳突削開の前内側境界となる。',
    clinicalNoteJa:
      '乳突洞削開時は常に本部位の前方・内側を削る。成人では茎乳突孔の約10〜15mm上方。' +
      '蝸牛との間の骨橋（bridge）を温存すること。',
    complicationJa: '永続的顔面神経麻痺・閉眼不全・流涙障害',
  },
  {
    id: 'sigmoid-sinus',
    nameJa: 'S状静脈洞',
    nameEn: 'Sigmoid Sinus',
    category: 'vascular',
    // 後乳突部深部を走行する大きな静脈洞
    position: [-12, -3, -8],
    warningRadius: 6,
    dangerRadius: 3,
    color: '#4477ff',
    glowColor: '#2255dd',
    importance: 'critical',
    shortDescJa:
      '後頭蓋窩硬膜静脈洞。乳突削開の後外側境界であり、損傷すると大量出血をきたす。',
    clinicalNoteJa:
      "Körner隔壁（Körner's septum）の後方に位置。術前CTで位置を確認し、前方に偏位している" +
      '例（anterior sigmoid sinus）では術野が狭小化する。',
    complicationJa: '制御困難な大量出血・空気塞栓（静脈性空気塞栓）',
  },
  {
    id: 'jugular-bulb',
    nameJa: '頸静脈球',
    nameEn: 'Jugular Bulb',
    category: 'vascular',
    // 正円窓下方に位置する内頸静脈の拡張部
    position: [-2, -13, -5],
    warningRadius: 6,
    dangerRadius: 3,
    color: '#3366ee',
    glowColor: '#1144cc',
    importance: 'critical',
    shortDescJa:
      '正円窓下方に位置する内頸静脈の拡張部。高位の場合は正円窓・蝸牛に達することがある（高位頸静脈球）。',
    clinicalNoteJa:
      '高位頸静脈球では正円窓手術・cochlear implant電極挿入時のリスクが増大。術前CT（冠状断・矢状断）で' +
      '必ず確認すること。骨被覆がない例（dehiscent jugular bulb）も存在する。',
    complicationJa: '制御困難な出血・感音難聴・後迷路障害',
  },
];

/** カテゴリ別に危険部位を分類 */
export const FACIAL_ZONES = DANGER_ZONES.filter((z) => z.category === 'facial');
export const VASCULAR_ZONES = DANGER_ZONES.filter((z) => z.category === 'vascular');
