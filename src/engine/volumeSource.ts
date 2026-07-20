/**
 * volumeSource.ts ─ Voxelアーキテクチャ v2.0: VolumeSource実装（V1）
 *
 * 設計書: KURZ_Voxelアーキテクチャ設計_v2.0.md ⑧将来拡張（VolumeSource抽象化）
 *
 * 現状の唯一の実装は「Bone.glb（解析的 regionAt 分類）」。将来、患者別CTセグメンテーション
 * 由来のボリュームも同じ VolumeSource インターフェースで供給できるようにするための境界線を
 * ここに引く（上位の voxelVolume.ts / Marching Cubes / 除去モデル等は本ファイルの実装詳細に
 * 一切依存しない）。
 *
 * 点群のメッシュ内外判定（「Bone.glb表面の内側=骨実質、外側=空気」の判定）は
 * three-mesh-bvh の MeshBVH.raycast() を用いたレイキャスト・パリティ法（奇数回交差=内側）
 * で行う。BVH化により大量のボクセル中心点に対しても高速に判定できる
 * （設計書v1.0 ③改善案での three-mesh-bvh 採用実績・性能データを踏襲）。
 *
 * 【注意】この関数はメッシュが閉じた多様体（watertight）であることを前提とする。
 * Bone.glb が非多様体・開口部を含む場合はパリティ判定が不正確になりうる
 * （要検証・保留事項）。
 */

import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { regionAt } from './boneMaterial';
import type { VolumeSample, VolumeSource } from './types';

// ══════════════════════════════════════════════════════════════════════
// メッシュ内外判定（レイキャスト・パリティ法）
// ══════════════════════════════════════════════════════════════════════

/**
 * createMeshInsideTest(): ワールド座標系の BufferGeometry から、任意の点がその
 * メッシュの内側にあるかを判定する関数を返す。
 *
 * @param worldGeometry ワールド座標系にベイク済み（mesh.matrixWorld適用済み）の BufferGeometry。
 *   Bone.glb が複数メッシュに分かれている場合は、呼び出し側で1つに結合してから渡すこと
 *   （THREE.BufferGeometryUtils.mergeGeometries 等。結合はシーン配線側=V4/V5の責務）。
 */
export function createMeshInsideTest(worldGeometry: THREE.BufferGeometry): (p: THREE.Vector3) => boolean {
  const bvh = new MeshBVH(worldGeometry);
  // 軸に平行だと数値的に縮退しやすいため、非軸平行の固定方向を使う。
  const rayDir = new THREE.Vector3(0.6247, 0.7503, 0.2081).normalize();
  const ray = new THREE.Ray();

  return (p: THREE.Vector3): boolean => {
    ray.origin.copy(p);
    ray.direction.copy(rayDir);
    const hits = bvh.raycast(ray, THREE.DoubleSide);
    return hits.length % 2 === 1;
  };
}

// ══════════════════════════════════════════════════════════════════════
// Bone.glb を実装とする VolumeSource
// ══════════════════════════════════════════════════════════════════════

/**
 * createBoneVolumeSource(): insideTest（上記 createMeshInsideTest の戻り値）と
 * 既存の解析的材質分類（boneMaterial.ts の regionAt）を組み合わせた VolumeSource。
 *
 * - メッシュの外側 → density=0（空気、削るものがない）
 * - メッシュの内側 → density=1（骨実質フル密度）、材質は regionAt(p) による解析的分類
 *
 * regionAt() は 3Dセグメンテーション不要の解析的判定（既存T2実装）であり、ボクセル座標に
 * 対してもそのまま適用できる（追加のセグメンテーション処理は不要）。
 */
export function createBoneVolumeSource(insideTest: (p: THREE.Vector3) => boolean): VolumeSource {
  return {
    sampleAt(p: THREE.Vector3): VolumeSample {
      if (!insideTest(p)) {
        return { density: 0, materialId: 'airCells' };
      }
      return { density: 1, materialId: regionAt(p) };
    },
  };
}

// ══════════════════════════════════════════════════════════════════════
// テスト・検証用: 解析的球体ソース（Bone.glb 非依存）
// ══════════════════════════════════════════════════════════════════════

/**
 * createSphereVolumeSource(): 単純な球（中心・半径）を「骨実質」とみなす VolumeSource。
 * Bone.glb のロードを待たずに voxelVolume.ts のグリッド・ブラシロジック単体を検証する
 * ためのテスト用実装（本番では使用しない）。
 */
export function createSphereVolumeSource(center: THREE.Vector3, radius: number): VolumeSource {
  return {
    sampleAt(p: THREE.Vector3): VolumeSample {
      if (p.distanceTo(center) > radius) {
        return { density: 0, materialId: 'airCells' };
      }
      return { density: 1, materialId: regionAt(p) };
    },
  };
}
