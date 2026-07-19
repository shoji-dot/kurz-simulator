// KURZ Otology Simulator - Disease Layer 除去ロジック（Stage1 RC Phase2 新設）
//
// Three.js非依存の純粋関数のみ（engine/removalModel.tsと同じ設計方針）。
// 除去操作は既存Voxel carve呼び出しと同じ引数（point/brushRadiusMm/amount）をそのまま
// 受け取れる形にし、InteractiveDrillScene.tsxのcarveRef呼び出し箇所に並行して呼び出す
// だけで配線できるようにする（2026-07-15 shojiさん確認: Voxel carve流用方針）。
// このファイル単体では3Dシーンへの配線は行わない。

import type { DiseaseInstance } from './types';

export interface DiseaseRemovalInput {
  /** ドリル/カーソル位置。底板原点座標系（mm）。 */
  point: [number, number, number];
  /** 削開ブラシ半径mm（InteractiveDrillScene.tsxのburrRadiusと同じ値を渡す想定）。 */
  brushRadiusMm: number;
  /** その1回のcarve呼び出しで除去された量（既存carveRefのamountと同じ値を渡す想定）。 */
  amount: number;
}

function distance3(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * ブラシが病変の範囲内にあれば severity を減少させる。癒着度(adherence)が高いほど同じ除去量に
 * 対する severity 減少が小さい（BoneMaterial.hardnessに対するgrowthRateMmPerSecの「割る」抵抗
 * モデルと同じ考え方、removalModel.ts参照）。イミュータブルに新しい配列を返す。
 */
export function applyDiseaseRemoval(
  instances: DiseaseInstance[],
  input: DiseaseRemovalInput,
): DiseaseInstance[] {
  return instances.map((inst) => {
    if (inst.severity <= 0) return inst;
    const d = distance3(inst.position, input.point);
    if (d > inst.radiusMm + input.brushRadiusMm) return inst;
    const delta = input.amount / Math.max(inst.adherence, 0.05);
    const nextSeverity = Math.max(0, inst.severity - delta);
    if (nextSeverity === inst.severity) return inst;
    return { ...inst, severity: nextSeverity };
  });
}

export function isDiseaseCleared(instance: DiseaseInstance): boolean {
  return instance.severity <= 0;
}
