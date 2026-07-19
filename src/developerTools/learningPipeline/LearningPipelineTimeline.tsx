/**
 * developerTools/learningPipeline/LearningPipelineTimeline.tsx
 *   ── Learning Pipeline Read Only Timeline (Phase19.3〜19.4)
 *
 * shojiさんPhase19.2レビュー「Phase19.3への影響」節で示された責務分離に基づく。
 * Phase19.2 `LearningPipelineDebugPanel`（Snapshot: 直近1件のAssessment/Recommendation +
 * Skill集約値）とは責務を完全に分離し、本コンポーネントは`observations`
 * （`SkillObservation[]`、Phase19.1 Providerが公開）のみを表示するHistory Viewとする。
 * `evidence`/`assessment`/`recommendation`/`skillProfile`はSnapshot（Panel）側の責務のため、
 * ここでは参照しない。
 *
 * 【Provider経由のみ・個別Store/Engine直接参照禁止（Panelと同じ制約）】
 * `useLearningPipelineDebugData()`（Phase19.3共有Hook）経由でのみ`observations`を取得する。
 * `engine/skillTracking`の個別Adapter（`adaptScoreHistory`/`adaptAssessmentHistory`）や
 * store（`useLearningHistoryStore`等）には一切依存しない。
 *
 * 【sourceごとの表示・並び順の区別（Phase18 API契約、shojiさん確定事項）】
 * `SkillObservation.observedAt`の意味はsourceによって異なる（`types.ts`のJSDoc参照）。
 * - `source: 'scoreHistory'` … `observedAt`は実際のセッション完了時刻（実測）。
 *   時系列として意味を持つため、本コンポーネントは`observedAt`昇順にソートして表示し、
 *   「✓ 実測」のラベルを付ける。
 * - `source: 'assessment'` … `observedAt`は変換実行時刻（取得時刻）であり、学習イベントの
 *   発生時刻ではない（Phase18 API契約「並び替え・時系列解析・経時変化の根拠として利用しては
 *   ならない」）。そのため本コンポーネントはこの区分内で時系列ソートを行わず、元の配列順の
 *   まま表示し、「(取得時刻)」のラベルを付けて実測と混同しないようにする。
 * - `source: 'drill'` … Phase19.4時点でもAdapter未実装のためobservationsには出現しないが、
 *   「UI側の受け皿」として`ALL_SOURCES`に固定枠を用意し、「(データなし)」と表示する
 *   （shojiさんPhase19.3レビュー「Phase19.4はsource列の完成」指摘に対応。将来Drill Adapterが
 *   実装されても、本コンポーネントの表示構造は変更不要）。
 *
 * 【完全Read Only（Panelと同じ制約）】state変更・アクション実行は一切行わない。表示のみ。
 * 新しい評価・集計ロジックは追加しない（並び替え・グルーピングはあくまで表示順の整形であり、
 * 値の変換・平均化・判定は一切行わない）。
 */
import type { CSSProperties } from 'react';
import { useLearningPipelineDebugData } from './useLearningPipelineDebugData';
import type { SkillObservation, SkillObservationSource } from '../../engine/skillTracking';
import { Z_INDEX } from '../../components/ui';

const SOURCE_LABEL: Record<SkillObservationSource, string> = {
  scoreHistory: 'ScoreHistory（✓ 実測）',
  assessment: 'Assessment（取得時刻・順序に意味なし）',
  drill: 'Drill（未実装・Phase19.4準備枠）',
};

/**
 * Skill Trackingが扱う全source（Phase18 `SkillObservationSource`と同一の3種）。
 * Phase19.4「UI側の受け皿」対応として、実際にobservationsが存在するかどうかに関わらず
 * 常にこの3枠を固定表示する（`types.ts`の`SkillObservationSource`定義と手動同期。
 * 型に新しいsourceが追加された場合はこの配列とSOURCE_LABEL双方の更新が必要）。
 */
const ALL_SOURCES: readonly SkillObservationSource[] = ['scoreHistory', 'assessment', 'drill'];

/** sourceごとにグルーピングする（表示順整形のみ、値の変換・判断は行わない）。 */
function groupBySource(
  observations: readonly SkillObservation[],
): ReadonlyMap<SkillObservationSource, readonly SkillObservation[]> {
  const groups = new Map<SkillObservationSource, SkillObservation[]>();
  for (const obs of observations) {
    const existing = groups.get(obs.source);
    if (existing) {
      existing.push(obs);
    } else {
      groups.set(obs.source, [obs]);
    }
  }
  return groups;
}

/**
 * `scoreHistory`のみ`observedAt`昇順にソートした新しい配列を返す。それ以外のsourceは
 * 元の配列をそのまま返す（`assessment`のobservedAtは取得時刻のため時系列ソート禁止、
 * Phase18 API契約）。
 */
function orderForDisplay(
  source: SkillObservationSource,
  observations: readonly SkillObservation[],
): readonly SkillObservation[] {
  if (source !== 'scoreHistory') return observations;
  return [...observations].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
}

const panelStyle: CSSProperties = {
  position: 'fixed', top: 64, right: 320, zIndex: Z_INDEX.modal,
  width: 260, maxHeight: '70vh', overflowY: 'auto',
  background: 'rgba(0,0,0,0.82)', color: '#7fd0ff',
  fontFamily: 'monospace', fontSize: 10, padding: '8px 10px',
  borderRadius: 6, lineHeight: 1.5,
  border: '1px solid rgba(127,208,255,0.3)',
};

const groupTitleStyle: CSSProperties = {
  color: '#aaa', fontSize: 9, fontWeight: 700, marginTop: 8, marginBottom: 2,
  borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: 2,
};

/**
 * `observations`をsourceごとにグルーピングし、`scoreHistory`は時系列順、それ以外は元の順序
 * のまま表示するRead Only Timeline。`ALL_SOURCES`の3枠を常に固定表示し（Phase19.4「受け皿」
 * 対応）、データが無いsourceは「(データなし)」と表示する。完全Read Only、状態変更は
 * 一切行わない。
 */
export function LearningPipelineTimeline() {
  const { observations } = useLearningPipelineDebugData();
  const grouped = groupBySource(observations);

  return (
    <div style={panelStyle}>
      <div style={{ color: '#fff', fontWeight: 700, fontSize: 11, marginBottom: 2 }}>
        [DEV] Learning Pipeline Timeline
      </div>

      {ALL_SOURCES.map((source) => {
        const obsForSource = grouped.get(source) ?? [];
        return (
          <div key={source}>
            <div style={groupTitleStyle}>{SOURCE_LABEL[source]}</div>
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {obsForSource.length > 0
                ? orderForDisplay(source, obsForSource)
                    .map((o) => `${o.observedAt}  ${o.skillId}=${o.value.toFixed(1)}`)
                    .join('\n')
                : '(データなし)'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
