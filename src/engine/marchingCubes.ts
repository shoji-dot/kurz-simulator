/**
 * marchingCubes.ts ─ Marching Cubes 抽出アルゴリズム（V2、V3向けにraw版を追加）
 *
 * 設計書: KURZ_削開アルゴリズム再設計_v1.0.md ⑤実装方針 Phase2, ⑦V2/V3
 * 標準ルックアップテーブル（marchingCubesTables.ts、出典: Paul Bourke "Polygonising a scalar
 * field"）を用いて、VoxelChunk（voxelVolume.ts, Sprint1実装済み）1個分の密度スカラー場から
 * 等値面（三角形メッシュ）を抽出する純関数。
 *
 * 【V3での変更】extractChunkMesh() は色解決コールバック（THREE.Color を返す関数）を引数に
 * 取るが、Web Worker境界（postMessage）を越えて関数を渡すことはできない。そのため、
 * アルゴリズム本体を extractChunkMeshRaw()（頂点ごとの材質インデックスをUint8Arrayで返す、
 * 関数を一切引数に取らない版）へ切り出し、extractChunkMesh() はその薄いラッパー（materialIndex
 * →色变换のみ行う）とした。Worker（voxelRemeshWorker.ts）は extractChunkMeshRaw() を直接呼ぶ。
 * 挙動は変更前と完全互換（既存 mc_test.ts のテストは無変更で通過することを確認済み）。
 *
 * 【Sprint2 V2/V3時点のスコープ】本ファイルはチャンク単体の等値面抽出アルゴリズムのみを実装する。
 * 以下は未実装・次段階（設計書のタスク分割どおり）:
 *   - 隣接チャンク間のシーム処理（チャンク境界を跨ぐ継ぎ目。v2.0 §1で言及済みの既知の限界）
 *   - 実シーンへの描画配線（V4）・レイキャスト再配線（V5）
 *   - スムースシェーディング（現在はフラット＝三角形単位の法線。頂点法線平均化はV4の改善候補）
 *
 * 密度値の扱い: VoxelChunk.density は「残存骨密度」0(空気・全除去)〜1(骨実質フル)。
 * isoLevel を閾値として density > isoLevel を「固体（骨が残っている）」側とみなし、生成される
 * 三角形群の法線は固体側から空気側（削られた側）を向く（=通常の外向き法線）。この向きは
 * ランタイムテスト（既知の球形状での符号付き体積検証、mc_test.ts）で確認済み
 * （TRI_TABLE の (e0,e1,e2) 並びをそのまま使うと内向きになったため、e1/e2 を入れ替えて補正済み）。
 */

import * as THREE from 'three';
import type { ChunkHalo, VoxelChunk } from './voxelVolume';
import { EDGE_TABLE, TRI_TABLE } from './marchingCubesTables';

// ══════════════════════════════════════════════════════════════════════
// 立方体の頂点・エッジ規約（marchingCubesTables.ts のテーブルと厳密に対応。変更禁止）
// ══════════════════════════════════════════════════════════════════════

/** 立方体8頂点のローカルオフセット（0/1格子単位）。出典ページの頂点番号と対応。 */
const CORNER_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0], // v0
  [1, 0, 0], // v1
  [1, 1, 0], // v2
  [0, 1, 0], // v3
  [0, 0, 1], // v4
  [1, 0, 1], // v5
  [1, 1, 1], // v6
  [0, 1, 1], // v7
];

/** 12エッジそれぞれが結ぶ頂点インデックスの組。EDGE_TABLE/TRI_TABLEのエッジ番号と対応。 */
const EDGE_CORNER_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

// ══════════════════════════════════════════════════════════════════════
// 出力型
// ══════════════════════════════════════════════════════════════════════

/** extractChunkMeshRaw() の戻り値。色ではなく頂点ごとの材質インデックスを持つ（Worker境界越え用）。 */
export interface RawMarchingCubesResult {
  positions: Float32Array;
  normals: Float32Array;
  /** 頂点ごとの材質インデックス（voxelVolume.ts内部の小型整数）。頂点数と同数。 */
  materialIndices: Uint8Array;
  indices: Uint32Array;
  vertexCount: number;
  triangleCount: number;
}

export interface MarchingCubesResult {
  /** ワールド座標系、頂点数×3。三角形は非共有頂点（フラットシェーディング）。 */
  positions: Float32Array;
  /** 三角形単位の法線（頂点ごとに複製）、頂点数×3。 */
  normals: Float32Array;
  /** 0–1 RGB、頂点数×3。 */
  colors: Float32Array;
  /** 0..vertexCount-1 の連番（非共有頂点のため）。BufferGeometry組み立ての一貫性のため返す。 */
  indices: Uint32Array;
  vertexCount: number;
  triangleCount: number;
}

const EPS = 1e-5;

/** エッジ上でisoLevelを横切る補間係数t(0=A側,1=B側)を返す。位置・法線の補間で共有する。 */
function edgeInterpT(isoLevel: number, densityA: number, densityB: number): number {
  if (Math.abs(isoLevel - densityA) < EPS) return 0;
  if (Math.abs(isoLevel - densityB) < EPS) return 1;
  if (Math.abs(densityA - densityB) < EPS) return 0;
  return (isoLevel - densityA) / (densityB - densityA);
}

/**
 * computeDensityGradients(): チャンク内全ボクセルの密度場勾配（中心差分、境界は片側差分に
 * フォールバック）を事前計算する。頂点法線を勾配ベースにして滑らかにする（V5追補）。
 * 【背景】従来は三角形単位のフラット法線のみだったため、shojiさんのローカル確認で
 * 「骨表面が角ついて見える」と指摘された。Marching Cubes標準の勾配法線へ変更して解消する。
 * 【既知の残存課題】チャンク境界ボクセルは片側差分のみで近似するため、隣接チャンクとの
 * 継ぎ目にごく僅かな法線の不連続（シェーディングの継ぎ目）が残りうる（頂点位置自体は
 * voxelVolume.tsのチャンクステップ変更により完全一致するため、隙間・分断は生じない）。
 */
function computeDensityGradients(
  density: Float32Array,
  n: number,
  cellSize: number,
  halo?: ChunkHalo
): Float32Array {
  const grad = new Float32Array(n * n * n * 3);
  const at = (ix: number, iy: number, iz: number) => density[ix + iy * n + iz * n * n];
  for (let iz = 0; iz < n; iz++) {
    for (let iy = 0; iy < n; iy++) {
      for (let ix = 0; ix < n; ix++) {
        const flat = ix + iy * n + iz * n * n;
        // 境界（ix/iy/iz が 0 または n-1）は、ghost layer（隣接チャンクの境界1層分の密度、
        // voxelVolume.ts の getHalo()）があればそれを使って中心差分にする。ない場合
        // （体積境界外・Fine未確保）は従来通り自チャンクの値で代用するフォールバック
        // （2026-07-12・法線継ぎ目修正、[[drill-mves-design]]参照）。
        const dPrevX = ix > 0 ? at(ix - 1, iy, iz) : (halo?.xMinus ? halo.xMinus[iy + iz * n] : at(ix, iy, iz));
        const dNextX = ix < n - 1 ? at(ix + 1, iy, iz) : (halo?.xPlus ? halo.xPlus[iy + iz * n] : at(ix, iy, iz));
        const dPrevY = iy > 0 ? at(ix, iy - 1, iz) : (halo?.yMinus ? halo.yMinus[ix + iz * n] : at(ix, iy, iz));
        const dNextY = iy < n - 1 ? at(ix, iy + 1, iz) : (halo?.yPlus ? halo.yPlus[ix + iz * n] : at(ix, iy, iz));
        const dPrevZ = iz > 0 ? at(ix, iy, iz - 1) : (halo?.zMinus ? halo.zMinus[ix + iy * n] : at(ix, iy, iz));
        const dNextZ = iz < n - 1 ? at(ix, iy, iz + 1) : (halo?.zPlus ? halo.zPlus[ix + iy * n] : at(ix, iy, iz));
        grad[flat * 3]     = (dNextX - dPrevX) / (2 * cellSize);
        grad[flat * 3 + 1] = (dNextY - dPrevY) / (2 * cellSize);
        grad[flat * 3 + 2] = (dNextZ - dPrevZ) / (2 * cellSize);
      }
    }
  }
  return grad;
}

/** 三角形が属する3エッジそれぞれの「固体側(density高い方)」コーナーの材質を集計し最多を返す。 */
function pickDominantMaterial(
  edges: readonly [number, number, number],
  cornerDensity: number[],
  cornerMaterial: number[]
): number {
  const counts = new Map<number, number>();
  for (const e of edges) {
    const [a, b] = EDGE_CORNER_PAIRS[e];
    const solidCorner = cornerDensity[a] >= cornerDensity[b] ? a : b;
    const m = cornerMaterial[solidCorner];
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  let best = 0;
  let bestCount = -1;
  for (const [m, c] of counts) {
    if (c > bestCount) {
      best = m;
      bestCount = c;
    }
  }
  return best;
}

// ══════════════════════════════════════════════════════════════════════
// 抽出本体（raw版: 材質インデックスのみ、色解決コールバックを取らない）
// ══════════════════════════════════════════════════════════════════════

/**
 * extractChunkMeshRaw(): VoxelChunk 1個分の密度場から Marching Cubes で三角形メッシュを抽出する。
 * 格子点は density 配列そのもの（chunk.size³個、chunk.origin+(i+0.5)*cellSize がワールド位置、
 * voxelVolume.ts のサンプリング規約と一致）。(size-1)³ 個のセルを走査する。
 *
 * 法線は密度場勾配ベース（computeDensityGradients）で頂点ごとに補間するsmooth shading
 * （V5追補）。固体(density高)→空気(density低)方向が外向きのため、法線=-勾配の向きになる
 * （ランタイムテスト mc_test.ts の符号付き体積・外向き比率で検証済み）。勾配が退化する
 * （ほぼゼロになる）頂点のみ、従来の三角形単位フラット法線へフォールバックする。
 *
 * 関数を引数に取らない（Web Worker境界を越えられるプレーンな入出力のみ）。色解決が必要な
 * 呼び出し元は extractChunkMesh()（本ファイル下部の薄いラッパー）を使うこと。
 */
export function extractChunkMeshRaw(chunk: VoxelChunk, isoLevel = 0.5, halo?: ChunkHalo): RawMarchingCubesResult {
  const n = chunk.size;
  const { density, materialId, origin, cellSize } = chunk;
  const gradients = computeDensityGradients(density, n, cellSize, halo);

  const positions: number[] = [];
  const normals: number[] = [];
  const materialIndices: number[] = [];

  const cornerPos: THREE.Vector3[] = Array.from({ length: 8 }, () => new THREE.Vector3());
  const cornerGrad: THREE.Vector3[] = Array.from({ length: 8 }, () => new THREE.Vector3());
  const cornerDensity = new Array<number>(8);
  const cornerMaterial = new Array<number>(8);

  const flatIndex = (ix: number, iy: number, iz: number) => ix + iy * n + iz * n * n;

  for (let cz = 0; cz < n - 1; cz++) {
    for (let cy = 0; cy < n - 1; cy++) {
      for (let cx = 0; cx < n - 1; cx++) {
        let cubeindex = 0;
        for (let k = 0; k < 8; k++) {
          const [ox, oy, oz] = CORNER_OFFSETS[k];
          const ix = cx + ox;
          const iy = cy + oy;
          const iz = cz + oz;
          const flat = flatIndex(ix, iy, iz);
          cornerPos[k].set(
            origin.x + (ix + 0.5) * cellSize,
            origin.y + (iy + 0.5) * cellSize,
            origin.z + (iz + 0.5) * cellSize
          );
          cornerGrad[k].set(gradients[flat * 3], gradients[flat * 3 + 1], gradients[flat * 3 + 2]);
          cornerDensity[k] = density[flat];
          cornerMaterial[k] = materialId[flat];
          // 固体(density > isoLevel)側を「内側」ビットとする。生成面の法線が固体→空気方向
          // （外向き）になることをランタイムテストで確認済み（mc_test.ts）。
          if (cornerDensity[k] > isoLevel) cubeindex |= 1 << k;
        }

        const edgeMask = EDGE_TABLE[cubeindex];
        if (edgeMask === 0) continue;

        const vertList: Array<THREE.Vector3 | null> = new Array(12).fill(null);
        const normList: Array<THREE.Vector3 | null> = new Array(12).fill(null);
        for (let e = 0; e < 12; e++) {
          if ((edgeMask & (1 << e)) === 0) continue;
          const [a, b] = EDGE_CORNER_PAIRS[e];
          const t = edgeInterpT(isoLevel, cornerDensity[a], cornerDensity[b]);
          vertList[e] = cornerPos[a].clone().lerp(cornerPos[b], t);
          const g = cornerGrad[a].clone().lerp(cornerGrad[b], t);
          normList[e] = g.lengthSq() > 1e-12 ? g.normalize().negate() : null;
        }

        const tri = TRI_TABLE[cubeindex];
        for (let t = 0; t < tri.length; t += 3) {
          const e0 = tri[t];
          if (e0 === -1) break;
          // TRI_TABLE の並び (e0,e1,e2) をそのまま使うと法線が内向きになることをランタイム
          // テスト（符号付き体積が負）で確認したため、e1/e2 を入れ替えて外向きにする。
          const e1 = tri[t + 2];
          const e2 = tri[t + 1];
          const p0 = vertList[e0];
          const p1 = vertList[e1];
          const p2 = vertList[e2];
          if (!p0 || !p1 || !p2) continue; // 理論上到達しないが型安全のためガード

          // 勾配ベース法線が退化(平坦領域等)している頂点のみ、三角形単位フラット法線へフォールバック
          const edgeA = p1.clone().sub(p0);
          const edgeB = p2.clone().sub(p0);
          const flatNormal = edgeA.cross(edgeB).normalize();
          const n0 = normList[e0] ?? flatNormal;
          const n1 = normList[e1] ?? flatNormal;
          const n2 = normList[e2] ?? flatNormal;

          const materialIndex = pickDominantMaterial([e0, e1, e2], cornerDensity, cornerMaterial);

          const verts: Array<[THREE.Vector3, THREE.Vector3]> = [[p0, n0], [p1, n1], [p2, n2]];
          for (const [p, nrm] of verts) {
            positions.push(p.x, p.y, p.z);
            normals.push(nrm.x, nrm.y, nrm.z);
            materialIndices.push(materialIndex);
          }
        }
      }
    }
  }

  const vertexCount = positions.length / 3;
  const indices = new Uint32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) indices[i] = i;

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    materialIndices: new Uint8Array(materialIndices),
    indices,
    vertexCount,
    triangleCount: vertexCount / 3,
  };
}

// ══════════════════════════════════════════════════════════════════════
// 色解決ラッパー（同期呼び出し用。Worker境界は越えられない＝メインスレッド専用）
// ══════════════════════════════════════════════════════════════════════

/**
 * extractChunkMesh(): extractChunkMeshRaw() の結果に materialColorForIndex で色を解決して
 * 付加する薄いラッパー。V2時点のAPIとの完全互換のため維持（既存テストは無変更で通過）。
 *
 * @param materialColorForIndex 材質ID（voxelVolume.ts内部の小型整数インデックス）から表示色を
 *   得るコールバック。呼び出し側（V4描画配線）が BONE_MATERIALS と接続する想定。
 */
export function extractChunkMesh(
  chunk: VoxelChunk,
  materialColorForIndex: (materialIndex: number) => THREE.Color,
  isoLevel = 0.5
): MarchingCubesResult {
  const raw = extractChunkMeshRaw(chunk, isoLevel);
  const colors = new Float32Array(raw.vertexCount * 3);
  for (let i = 0; i < raw.vertexCount; i++) {
    const c = materialColorForIndex(raw.materialIndices[i]);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  return {
    positions: raw.positions,
    normals: raw.normals,
    colors,
    indices: raw.indices,
    vertexCount: raw.vertexCount,
    triangleCount: raw.triangleCount,
  };
}
