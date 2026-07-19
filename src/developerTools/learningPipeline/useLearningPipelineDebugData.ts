/**
 * developerTools/learningPipeline/useLearningPipelineDebugData.ts
 *   ── Learning Pipeline Debug Data Polling Hook (Phase19.3)
 *
 * shojiさんPhase19.2レビュー「改善候補（Known Limitation）」への対応。
 * `collectLearningPipelineDebugData()`（Phase19.1 Provider）はstateを購読しない素朴な関数の
 * ため、DEV向け表示コンポーネント側が定期的に再取得する必要がある。この定型コードを
 * `LearningPipelineDebugPanel`（Phase19.2）と`LearningPipelineTimeline`（Phase19.3）の間で
 * 重複させないための共有Hook（プロジェクト方針「重複コード禁止」への対応、shojiさん
 * Phase19.2レビューで示唆された次の一手そのもの）。
 *
 * 【Known Limitation（据え置き、shojiさんPhase19.2レビュー原文）】
 * Debug Panel currently refreshes by polling every second because the provider is
 * intentionally stateless. Reactive updates are out of scope for Phase19.
 * 本Hookは「pollingという実装詳細を1箇所に集約する」ことのみを行う。Provider
 * （`collectLearningPipelineDebugData()`）自体を購読可能にする設計変更ではなく、
 * 真のsubscribe()/Pub-Sub化はPhase19範囲外のまま（shojiさん指摘どおり）。
 */
import { useEffect, useState } from 'react';
import { collectLearningPipelineDebugData } from './collectLearningPipelineDebugData';
import type { LearningPipelineDebugData } from './collectLearningPipelineDebugData';

/** Providerが購読機構を持たないため、この間隔でポーリング再取得する（DEV限定表示専用）。 */
const POLL_INTERVAL_MS = 1000;

/**
 * `collectLearningPipelineDebugData()`をpollingで定期的に再取得するHook。
 * Debug Panel/Timelineいずれも本Hook経由でのみProviderへアクセスする
 * （個別Store/Engineへの直接依存は引き続き持たない）。
 */
export function useLearningPipelineDebugData(): LearningPipelineDebugData {
  const [data, setData] = useState<LearningPipelineDebugData>(() => collectLearningPipelineDebugData());

  useEffect(() => {
    const timer = setInterval(() => {
      setData(collectLearningPipelineDebugData());
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return data;
}
