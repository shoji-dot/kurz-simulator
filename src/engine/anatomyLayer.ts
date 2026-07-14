/**
 * anatomyLayer.ts ─ AnatomyLayer 基盤（V9, v2.1追補）
 *
 * 設計書: KURZ_Voxelアーキテクチャ設計_v2.0.md §2（Multi Layer Volume）,
 * KURZ_Voxelアーキテクチャ設計_v2.1_追補.md（顔面神経ポリライン統合の提示）
 *
 * 危険構造を「点（球）」に限定していた既存 DangerZone を汎化し、折れ線（連続した
 * 神経走行など）も同じインターフェースで扱えるようにする。顔面神経は
 * facial-tympanic → facial-genu → facial-mastoid の3点を、独立した3球ではなく
 * 1本の連続した走行（polyline）として統合する。
 *
 * 【Sprint1時点のスコープ】本ファイルは基盤のみ。dangerModel.ts / InteractiveDrillScene.tsx
 * の既存配線（DANGER_ZONES / remainingThicknessToDanger ベース）はまだこちらへ切り替えない
 * （Sprint2「危険UIのモード分岐適用」で実施予定）。既存動作への回帰は発生しない。
 */

import * as THREE from 'three';
import type { AnatomyLayer, LayerThicknessResult } from './types';
import type { DangerZone } from '../data/dangerZones';
import { DANGER_ZONES } from '../data/dangerZones';

// ══════════════════════════════════════════════════════════════════════
// 距離計算（純関数）
// ══════════════════════════════════════════════════════════════════════

/** 点 p から線分 ab への最短距離 mm。 */
function distanceToSegment(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  const ab = b.clone().sub(a);
  const lengthSq = ab.lengthSq();
  if (lengthSq === 0) return p.distanceTo(a);
  const t = Math.min(1, Math.max(0, p.clone().sub(a).dot(ab) / lengthSq));
  const closest = a.clone().add(ab.multiplyScalar(t));
  return p.distanceTo(closest);
}

/**
 * distanceToLayer(): 点 p から AnatomyLayer 芯線/中心点までの生距離 mm を返す純関数。
 * remainingThicknessToDanger()（boneMaterial.ts）の「点→球中心距離」を
 * 「点→折れ線」まで一般化したもの。
 */
export function distanceToLayer(p: THREE.Vector3, layer: AnatomyLayer): number {
  if (layer.geometry.kind === 'point') {
    return p.distanceTo(layer.geometry.position);
  }
  const pts = layer.geometry.points;
  let min = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distanceToSegment(p, pts[i], pts[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

/**
 * remainingThicknessToLayer(): 全 ANATOMY_LAYERS について distanceToLayer() −
 * layer.dangerRadius を計算し最小値を返す。remainingThicknessToDanger() の
 * 一般化版（ANATOMY_LAYERS 版）。Sprint1時点では未配線（Sprint2で dangerModel.ts
 * から呼び出す想定）。
 */
export function remainingThicknessToLayer(p: THREE.Vector3): LayerThicknessResult | null {
  if (ANATOMY_LAYERS.length === 0) return null;
  let best: LayerThicknessResult | null = null;
  for (const layer of ANATOMY_LAYERS) {
    const dist = distanceToLayer(p, layer) - layer.dangerRadius;
    if (!best || dist < best.dist) best = { dist, layer };
  }
  return best;
}

// ══════════════════════════════════════════════════════════════════════
// ANATOMY_LAYERS（DANGER_ZONES からの合成）
// ══════════════════════════════════════════════════════════════════════

/** 顔面神経の走行順（鼓室部→第2膝部→乳突部）。DANGER_ZONES の該当3点をこの順で結ぶ。 */
const FACIAL_NERVE_ORDER = ['facial-tympanic', 'facial-genu', 'facial-mastoid'];

function toPointLayer(zone: DangerZone): AnatomyLayer {
  return {
    id: zone.id,
    nameJa: zone.nameJa,
    geometry: { kind: 'point', position: new THREE.Vector3(...zone.position) },
    warningRadius: zone.warningRadius,
    dangerRadius: zone.dangerRadius,
    category: zone.category,
    color: zone.color,
    glowColor: zone.glowColor,
    shortDescJa: zone.shortDescJa,
    clinicalNoteJa: zone.clinicalNoteJa,
    complicationJa: zone.complicationJa,
    sourceZoneIds: [zone.id],
  };
}

function buildFacialNerveLayer(): AnatomyLayer {
  const zones = FACIAL_NERVE_ORDER.map((id) => {
    const zone = DANGER_ZONES.find((z) => z.id === id);
    if (!zone) throw new Error(`anatomyLayer.ts: DANGER_ZONES に ${id} が見つかりません`);
    return zone;
  });
  const points = zones.map((z) => new THREE.Vector3(...z.position));
  const [first] = zones;
  return {
    id: 'facial-nerve',
    nameJa: '顔面神経（鼓室部〜乳突部）',
    geometry: { kind: 'polyline', points },
    // 既存3ゾーンの warningRadius/dangerRadius はいずれも共通値（5mm/2mm）のためそのまま採用
    warningRadius: first.warningRadius,
    dangerRadius: first.dangerRadius,
    category: 'facial',
    color: first.color,
    glowColor: first.glowColor,
    shortDescJa:
      '鼓室部（卵円窓上方）→第2膝部→乳突部（茎乳突孔）まで連続して走行する顔面神経本幹。' +
      '乳突削開の前内側境界。',
    clinicalNoteJa:
      '3セグメントを1本の連続した走行として扱う。各セグメント個別の臨床所見は ' +
      'dangerZones.ts の facial-tympanic / facial-genu / facial-mastoid を参照。',
    complicationJa: '永続的顔面神経麻痺（House-Brackmann grade 3以上）・閉眼不全・流涙障害',
    sourceZoneIds: FACIAL_NERVE_ORDER,
  };
}

export const ANATOMY_LAYERS: AnatomyLayer[] = [
  buildFacialNerveLayer(),
  ...DANGER_ZONES.filter((z) => z.category !== 'facial').map(toPointLayer),
];
