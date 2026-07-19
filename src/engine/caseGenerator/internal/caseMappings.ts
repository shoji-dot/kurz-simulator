/**
 * engine/caseGenerator/internal/caseMappings.ts ─── Case Generator 内部対応表 (Phase7.2)
 *
 * SurgicalCase.ossicularStatus のキー(malleus/incus/stapes)からEar Atlas idへの静的対応表のみを
 * 持つ。危険度判定・教育コメント組み立て・解剖学的判断は一切行わない（意味づけはEducation Layer
 * 側に残す。shojiさんのPhase7要確認事項1レビュー所見「Case → mapping → Education API →
 * TeachingNote」を遵守）。
 *
 * 非公開実装（`index.ts`からexportしない）。将来 facialNerve/chorda/ovalWindow 等が追加されても
 * この対応表を拡張するだけでよく、bundler.tsの変更は不要（設計書どおりの分離）。
 */
export const OSSICLE_KEY_TO_EAR_ATLAS_ID = {
  malleus: 'ossicle.malleus',
  incus: 'ossicle.incus',
  stapes: 'ossicle.stapes',
} as const;
