// KURZ Otology Simulator - Disease Layer 型定義（Stage1 RC Phase2 新設）
//
// Voxel（骨）とは状態を独立させたレイヤーとする（骨密度場を病変の有無で汚染しない）。
// 除去操作は既存Voxel carve（削開ドリル操作）をそのまま流用する設計方針
// （2026-07-15 shojiさん確認: 実際の吸引・剥離操作の再現より実装コストの低さを優先する判断）。
// 症例ごとの具体的な配置（position/radiusMm/severity初期値）は本ファイルでは定義しない
// （解剖学的位置の推測を避けるため。症例データ側でshojiさんの確認を得てから追加する）。
//
// 【2026-07-15追記】一時的に複数球連結（lobes）で袋状進展を近似する設計を試したが、
// shojiさんより「3球連結という所見は聞いたことがない、文献根拠もない」との明確な指摘を受け、
// 単純な単一球モデルへ差し戻した（過剰な近似は行わない）。

export type DiseaseType = 'cholesteatoma' | 'granulation' | 'inflammation' | 'mucosa';

/**
 * 病変の1インスタンス。症例データ側（今後追加予定）で具体的な position/radiusMm/severity を
 * 割り当てる。ここでは型のみを定義する。
 */
export interface DiseaseInstance {
  id: string;
  type: DiseaseType;
  /** 底板原点座標系（mm）。data/dangerZones.ts の DangerZone.position と同じ座標系。 */
  position: [number, number, number];
  radiusMm: number;
  /** 0-1。0になれば除去完了。初期値は症例データ側で設定する。 */
  severity: number;
  /** 0-1。周囲構造への癒着度。除去に対する抵抗係数（BoneMaterial.hardnessに相当する概念）。 */
  adherence: number;
  educationTagJa: string;
  clinicalNoteJa: string;
}

/** DiseaseType ごとの既定値プリセット（diseaseCatalog.ts 参照）。 */
export interface DiseaseTypePreset {
  type: DiseaseType;
  /** 既定の癒着度（0-1）。症例側で上書き可能。 */
  defaultAdherence: number;
  color: string;
  educationTagJa: string;
  clinicalNoteJa: string;
}
