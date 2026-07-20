/**
 * coordinates/boundingBox.ts ── BoundingBox Utility (Phase1)
 *
 * 座標系統合_解剖エンジン設計書_v1.0 3.7節の実装。
 * 実行時に Object3D の BoundingBox・実寸(mm)・中心を計算する。
 * 開発モード/Debug Overlay専用の読み取り専用ユーティリティであり、
 * 既存のレンダリングパスには一切影響しない。
 */
import * as THREE from 'three';
import type { BoundingBoxInfoMm, Vec3Tuple } from './types';

/** 指定したObject3D配下のBoundingBoxを実行時に計算する（mm単位、WORLD座標）。 */
export function computeBoundingBoxMm(object: THREE.Object3D): BoundingBoxInfoMm | null {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return null;
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  return {
    min: [box.min.x, box.min.y, box.min.z],
    max: [box.max.x, box.max.y, box.max.z],
    sizeMm: [size.x, size.y, size.z],
    center: [center.x, center.y, center.z],
  };
}

export interface BoundingBoxAuditResult {
  readonly ok: boolean;
  readonly actualSizeMm: Vec3Tuple;
  readonly expectedSizeMm: Vec3Tuple;
  readonly deviationRatio: Vec3Tuple;
}

/**
 * 実測BoundingBoxと期待サイズ(mm)を比較し、乖離が許容範囲を超えていないか検証する。
 * 「真珠腫1mm指定が実際に1mmで描画されているか」等の監査に使う（設計書3.7節）。
 * expectedSizeMm を持つ正準レジストリ（Ear Atlas）はPhase2以降で整備するため、
 * Phase1では呼び出し側が個別に期待値を渡す関数のみを提供する。
 */
export function auditBoundingBox(
  actual: BoundingBoxInfoMm,
  expectedSizeMm: Vec3Tuple,
  toleranceRatio = 0.15,
): BoundingBoxAuditResult {
  const ratioFor = (value: number, expected: number): number => {
    if (expected === 0) return value === 0 ? 0 : Number.POSITIVE_INFINITY;
    return Math.abs(value - expected) / Math.abs(expected);
  };
  const deviationRatio: Vec3Tuple = [
    ratioFor(actual.sizeMm[0], expectedSizeMm[0]),
    ratioFor(actual.sizeMm[1], expectedSizeMm[1]),
    ratioFor(actual.sizeMm[2], expectedSizeMm[2]),
  ];
  const ok = deviationRatio.every((r) => r <= toleranceRatio);
  return { ok, actualSizeMm: actual.sizeMm, expectedSizeMm, deviationRatio };
}

// ── BoundingBox Registry（将来拡張の型のみ、Phase1では未使用） ──────────
// 座標系統合_解剖エンジン設計書_v1.0 3.6節（Ear Atlas）・3.7節（BoundingBox監査）の
// 交点にあたる構造。期待サイズ・許容誤差・対象構造物をレジストリとして束ね、
// Phase2でEar Atlas（またはそのサブセット）から供給されることを想定する。

export interface BoundingBoxRegistryEntry {
  /**
   * 対象構造物ID。将来的にStructureKey/DangerZone.id/DiseaseInstance.id等の
   * ID体系統一（教育プラットフォーム視点レビューv1.1で指摘）に合わせる想定。
   */
  readonly targetId: string;
  readonly labelJa: string;
  readonly expectedSizeMm: Vec3Tuple;
  /** 許容誤差比率（例: 0.15 = ±15%）。 */
  readonly toleranceRatio: number;
  /** 期待値の出典。既存のsourceTag運用（KURZ固有情報/一般耳科知識/要確認事項）と揃える。 */
  readonly source: 'measured' | 'literature' | 'provisional';
}

export type BoundingBoxRegistry = readonly BoundingBoxRegistryEntry[];

export interface BoundingBoxRegistryAuditResult extends BoundingBoxAuditResult {
  readonly targetId: string;
  readonly labelJa: string;
  readonly source: BoundingBoxRegistryEntry['source'];
}

/**
 * BoundingBox Registryに登録された各構造物について、実測BoundingBoxとの乖離を一括監査する。
 * Phase1時点ではレジストリ自体は空（呼び出し側が個別にentryを渡す）。
 * Ear Atlas整備後は `actualByTargetId` にAtlas由来の実測値、`registry` にAtlas由来の
 * 期待値エントリを渡すだけで動く設計にしてある。
 */
export function auditBoundingBoxRegistry(
  actualByTargetId: ReadonlyMap<string, BoundingBoxInfoMm>,
  registry: BoundingBoxRegistry,
): readonly BoundingBoxRegistryAuditResult[] {
  const results: BoundingBoxRegistryAuditResult[] = [];
  for (const entry of registry) {
    const actual = actualByTargetId.get(entry.targetId);
    if (!actual) continue;
    const base = auditBoundingBox(actual, entry.expectedSizeMm, entry.toleranceRatio);
    results.push({ ...base, targetId: entry.targetId, labelJa: entry.labelJa, source: entry.source });
  }
  return results;
}
