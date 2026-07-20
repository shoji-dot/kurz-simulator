/**
 * developerTools/learning/LearningEvidenceDebugBadge.tsx ── Developer Tools Layer（Phase16.1）
 *
 * 元は components/LearningMode.tsx 内にインライン定義されていた DEV限定デバッグバッジ
 * （Phase15.2 `useLearningEvidenceStore` の `clickedTeachingNoteIds` を画面上に表示する、
 * Phase15.4 GUI Acceptance Test Test2用）。Phase16前整理で`developerTools/`直下へ移設した後、
 * Phase16.1のディレクトリ規約（`developerTools/learning/`）に合わせて再配置した。挙動・見た目は
 * 一貫して無変更。ゲート方式は系統A（`shared/debugGate.ts`の`isDevToolEnabled()`、
 * `import.meta.env.DEV`ベース）を使用する呼び出し元（`LearningMode.tsx`）に委ねる。
 * 判断ロジック・状態変更は持たない、表示専用の薄いコンポーネント。
 */
import { useLearningEvidenceStore } from '../../store/useLearningEvidenceStore';
import { Z_INDEX } from '../../components/ui';

export function LearningEvidenceDebugBadge() {
  const clickedTeachingNoteIds = useLearningEvidenceStore((state) => state.clickedTeachingNoteIds);
  return (
    <div style={{
      position: 'absolute', bottom: 8, left: 8, zIndex: Z_INDEX.modal,
      background: 'rgba(0,0,0,0.72)', color: '#7fffb2',
      fontFamily: 'monospace', fontSize: 10, padding: '6px 8px',
      borderRadius: 4, pointerEvents: 'none', whiteSpace: 'pre-wrap',
      lineHeight: 1.55, userSelect: 'none', maxWidth: 260,
    }}>
      <div style={{ color: '#aaa', marginBottom: 2, fontSize: 9 }}>
        [DEV] clickedTeachingNoteIds ({clickedTeachingNoteIds.length})
      </div>
      <div>{clickedTeachingNoteIds.length > 0 ? clickedTeachingNoteIds.join(', ') : '(空)'}</div>
    </div>
  );
}
