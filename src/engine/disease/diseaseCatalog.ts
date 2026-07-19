// KURZ Otology Simulator - Disease Layer カタログ（Stage1 RC Phase2 新設）
//
// DiseaseType ごとの既定値プリセット。症例追加が容易な配列構造とする
// （data/dangerZones.ts の DANGER_ZONES と同じ設計思想）。
//
// 【情報ソース区分】defaultAdherence の数値は本セッションで暫定的に置いた値であり、
// 文献・KURZ公式資料のいずれにも基づかない【要確認事項】。相対順序（真珠腫は癒着しやすく
// 肉芽・炎症・粘膜より除去に抵抗が大きい、という一般耳科知識）のみを踏まえた仮の並びであり、
// 絶対値は耳鼻科医（shojiさん）の較正が必要。BONE_MATERIALS.hardnessの運用（暫定値として
// 実装し較正待ちとする、boneMaterial.ts/removalModel.ts参照）と同じ扱いとする。
import type { DiseaseTypePreset } from './types';

export const DISEASE_PRESETS: Record<string, DiseaseTypePreset> = {
  cholesteatoma: {
    type: 'cholesteatoma',
    defaultAdherence: 0.8, // 【要確認】真珠腫は基質が骨・硬膜に癒着しやすいという一般耳科知識に基づく暫定値
    color: '#e8e0c8',
    educationTagJa: '真珠腫（角化重層扁平上皮の異所性増殖）',
    clinicalNoteJa: '周囲構造（顔面神経・外側半規管・硬膜）への進展・癒着に注意。取り残しは再発の主因となる。',
  },
  granulation: {
    type: 'granulation',
    defaultAdherence: 0.4, // 【要確認】肉芽組織は真珠腫基質より剥離しやすいという一般耳科知識に基づく暫定値
    color: '#c9524a',
    educationTagJa: '肉芽組織',
    clinicalNoteJa: '炎症性の血管新生組織。出血しやすく術野を妨げるため、止血しながらの処理が必要。',
  },
  inflammation: {
    type: 'inflammation',
    defaultAdherence: 0.2, // 【要確認】暫定値
    color: '#d98c8c',
    educationTagJa: '炎症性粘膜肥厚',
    clinicalNoteJa: '中耳粘膜の炎症性変化。可逆性があり、原疾患の治療で改善しうる。',
  },
  mucosa: {
    type: 'mucosa',
    defaultAdherence: 0.1, // 【要確認】暫定値。正常/軽度肥厚粘膜は最も抵抗が小さいという想定
    color: '#e0a8a8',
    educationTagJa: '中耳粘膜',
    clinicalNoteJa: '正常またはごく軽度に肥厚した粘膜。温存を優先すべき部位が多い。',
  },
};

export function getDiseasePreset(type: DiseaseTypePreset['type']): DiseaseTypePreset {
  return DISEASE_PRESETS[type];
}
