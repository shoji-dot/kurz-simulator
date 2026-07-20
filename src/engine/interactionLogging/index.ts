/**
 * engine/interactionLogging/index.ts ─── Interaction Logging Layer バレル (Phase15.1)
 *
 * `resolveTeachingNoteIdsByStructureKey`（resolve.ts）を公開する。Ear Atlas
 * （`data/earAtlas`、Phase2凍結）の`getEarAtlasEntriesByStructureKey()`への薄い橋渡しのみで、
 * 新しい判断ロジックは追加しない（Phase14の「Integration Layerは判断禁止」と同じ方針を
 * Interaction Loggingでも継続）。
 *
 * 本ファイルはPhase15.1時点ではどのシーン・App.tsxからも呼び出されていない
 * （Phase15.4で`AnatomyScene`/`LearningMode`への配線を予定、Small Change分割案参照）。
 */
export { resolveTeachingNoteIdsByStructureKey } from './resolve';
