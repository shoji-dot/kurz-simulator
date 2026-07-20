/**
 * engine/skillTracking/aggregator.ts ── Skill Aggregator（Phase18.4）
 *
 * 設計書: Phase18_SkillTracking_API設計_v1.0.md / shojiさんPhase18.4仕様確定（2026-07-19）。
 * 責務は「SkillObservation[] → SkillProfileへの集約」のみ。入力は`readonly SkillObservation[]`
 * のみで、いずれのAdapter（ScoreHistory/Assessment/将来のDrill）にも依存しない
 * （shojiさん確定事項「Aggregator入力はSkillObservation[]のみ・Adapterには依存しない」）。
 *
 * 集計方法は単純平均（shojiさん確定事項）。Observationが1件も無いSkillIdについても、
 * value=0・sampleSize=0でSkillScoreを必ず生成する（省略しない、shojiさん確定事項「SkillScoreは
 * 常に生成する方を推奨」。UI側が「データなし」をsampleSize===0で判定できるようにするため）。
 */
import type { SkillId, SkillObservation, SkillProfile, SkillScore } from './types';
import { SKILL_DEFINITIONS } from './definitions';

/** 1つのSkillIdに対応するObservationの単純平均値を計算する（0件の場合は0）。 */
function averageValue(observations: readonly SkillObservation[]): number {
  if (observations.length === 0) return 0;
  const sum = observations.reduce((acc, o) => acc + o.value, 0);
  return sum / observations.length;
}

/** observationsをskillIdごとにグループ化する（Map、挿入順維持）。 */
function groupBySkillId(
  observations: readonly SkillObservation[],
): ReadonlyMap<SkillId, readonly SkillObservation[]> {
  const groups = new Map<SkillId, SkillObservation[]>();
  for (const obs of observations) {
    const existing = groups.get(obs.skillId);
    if (existing) {
      existing.push(obs);
    } else {
      groups.set(obs.skillId, [obs]);
    }
  }
  return groups;
}

/**
 * SkillObservation[]からSkillProfileを集約する。SKILL_DEFINITIONSの全軸を必ず走査するため、
 * 出力のtechnical/knowledgeはそれぞれ常に固定件数（現状3件/1件）になる。
 * 平均計算・0件時のフォールバック以外の判断（ランク化・閾値判定・重み付け等）は一切行わない。
 */
export function aggregateSkillProfile(observations: readonly SkillObservation[]): SkillProfile {
  const grouped = groupBySkillId(observations);

  const scores: readonly SkillScore[] = SKILL_DEFINITIONS.map((def): SkillScore => {
    const obsForSkill = grouped.get(def.id) ?? [];
    return {
      id: def.id,
      category: def.category,
      value: averageValue(obsForSkill),
      sampleSize: obsForSkill.length,
    };
  });

  return {
    technical: scores.filter((s) => s.category === 'technical'),
    knowledge: scores.filter((s) => s.category === 'knowledge'),
  };
}
