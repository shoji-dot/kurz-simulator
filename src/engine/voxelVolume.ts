/**
 * voxelVolume.ts ─ Voxelアーキテクチャ v2.0: ボクセル基盤（V1）
 *
 * 設計書: KURZ_削開アルゴリズム再設計_v1.0.md ⑤実装方針 Phase1、
 *         KURZ_Voxelアーキテクチャ設計_v2.0.md ①Adaptive Resolution・⑧将来拡張
 *
 * 【設計方針の要約】
 * - フルOctreeは採用しない（v1.0/v2.0で「対象領域が小さく過剰設計」と判断済み）。
 * - 代わりに「危険域限定サブグリッド」方式：Base(粗)グリッドを全域に敷き、
 *   DANGER_ZONES近傍にのみ Fine(密)グリッドを近接時に遅延確保(allocate-on-proximity)する。
 * - Fine/Baseのセルサイズは整数倍（0.6mm ÷ 4 = 0.15mm）とし、Marching Cubes時の
 *   シーム（Tジャンクション）を避ける（設計書§1のシーム処理方針）。
 * - データは Structure of Arrays（density / materialId を別配列）。将来 riskTier /
 *   anatomyLayerId / 患者別Hounsfield値等を既存配列に影響を与えず追加できる（設計書§8）。
 * - 骨密度ボクセルは「削れる」唯一のレイヤー。危険構造（顔面神経・S状静脈洞等）は
 *   本ファイルではなく別レイヤー（AnatomyLayer、V9で実装）として扱う（設計書§2 Multi Layer Volume）。
 *
 * このファイルは VolumeSource（voxel初期値のサンプリング元）に依存しない純粋なグリッド管理
 * ロジックのみを持つ。Bone.glb からの具体的な VolumeSource 実装は volumeSource.ts（V1同時実装）。
 * シーンへの実際の配線（Bone.glb ロード・Marching Cubes 呼び出し）は V2〜V5 で行う。
 */

import * as THREE from 'three';
import type { BoneRegionId, ResolutionTier, VolumeSource, VoxelBrushInput, VoxelChunkCoord } from './types';
import { DANGER_ZONES } from '../data/dangerZones';

// ══════════════════════════════════════════════════════════════════════
// グリッド境界（暫定値・要ENT確認）
// ══════════════════════════════════════════════════════════════════════
//
// 既存定数（InteractiveDrillScene.tsx の GUIDE/LANDMARKS/ANTRUM_POS、boneMaterial.ts の
// LABYRINTH_CENTER、dangerZones.ts の DANGER_ZONES＋warningRadius）を包含する最小境界に
// マージンを加えた値。sigmoid-sinus・jugular-bulb は「そこまで削り進む」境界構造として
// 近接縁のみが範囲内に収まればよいと判断し、中心点まで含めて境界を広げてはいない。
// 【暫定】Bone.glb 実測に基づく境界の再検証、および「削開が実際に到達しうる範囲」としての
// 妥当性は shoji さんの確認が必要（保留事項）。
export const VOLUME_BOUNDS_MIN = new THREE.Vector3(-19, -14, -10);
export const VOLUME_BOUNDS_MAX = new THREE.Vector3(6, 12, 31);

// ══════════════════════════════════════════════════════════════════════
// 解像度パラメータ
// ══════════════════════════════════════════════════════════════════════

/** Baseグリッドのセルサイズ mm（全域、一般骨質用）。【暫定】設計書§1の目安値。 */
export const BASE_CELL_MM = 0.6;
/** Fineグリッドのセルサイズ mm（危険構造近傍のみ）。BASE_CELL_MM の整数分の1（シーム回避）。 */
export const FINE_CELL_MM = 0.15;
/** 1チャンクの一辺あたりボクセル数（Base/Fine共通）。 */
export const CHUNK_SIZE = 8;
/** Fineサブグリッドの近接確保トリガー: zone.warningRadius + このマージン mm。設計書§1「暫定3mm」。 */
export const FINE_ALLOCATE_MARGIN_MM = 3.0;

if (BASE_CELL_MM / FINE_CELL_MM !== Math.round(BASE_CELL_MM / FINE_CELL_MM)) {
  throw new Error('voxelVolume.ts: BASE_CELL_MM は FINE_CELL_MM の整数倍である必要があります（シーム回避）');
}

// ══════════════════════════════════════════════════════════════════════
// 材質ID ⇔ 小型整数インデックス（Uint8Array格納用）
// ══════════════════════════════════════════════════════════════════════

/**
 * MATERIAL_INDEX_TO_REGION_ID: materialId(Uint8Array)の小型整数インデックス⇔BoneRegionIdの
 * 唯一の対応表。V4（InteractiveDrillScene.tsx）が Marching Cubes 抽出結果の materialIndices
 * から BONE_MATERIALS の色を引く際、この配列を直接参照する（重複定義による不整合を避けるため
 * export する。順序を変更すると既存チャンクのmaterialId値の意味が変わるため変更禁止）。
 */
export const MATERIAL_INDEX_TO_REGION_ID: BoneRegionId[] = ['airCells', 'cortex', 'oticCapsule', 'tegmen', 'sinusPlate'];
const REGION_INDEX: Record<BoneRegionId, number> = Object.fromEntries(
  MATERIAL_INDEX_TO_REGION_ID.map((id, i) => [id, i])
) as Record<BoneRegionId, number>;

function materialIdToIndex(id: BoneRegionId): number {
  return REGION_INDEX[id];
}
export function indexToMaterialId(i: number): BoneRegionId {
  return MATERIAL_INDEX_TO_REGION_ID[i] ?? 'airCells';
}

/**
 * baseChunkGridDims(): VOLUME_BOUNDS を Base(0.6mm)チャンクで覆うのに必要な各軸チャンク数。
 * V4の初回ロード時、全Baseチャンクを一括生成する際の走査範囲として使う。
 */
export function baseChunkGridDims(): { nx: number; ny: number; nz: number } {
  const w = chunkWorldSizeForTier('base');
  const size = VOLUME_BOUNDS_MAX.clone().sub(VOLUME_BOUNDS_MIN);
  return {
    nx: Math.ceil(size.x / w),
    ny: Math.ceil(size.y / w),
    nz: Math.ceil(size.z / w),
  };
}

// ══════════════════════════════════════════════════════════════════════
// チャンク
// ══════════════════════════════════════════════════════════════════════

export interface VoxelChunk {
  coord: VoxelChunkCoord;
  /** このチャンクのセルサイズ mm（tierから決まる） */
  cellSize: number;
  /** チャンクのワールド座標系での最小コーナー */
  origin: THREE.Vector3;
  /** 一辺のボクセル数（= CHUNK_SIZE） */
  size: number;
  /** 0–1 密度。CHUNK_SIZE³ 個、インデックス = ix + iy*size + iz*size*size */
  density: Float32Array;
  /** 材質ID（小型整数）。CHUNK_SIZE³ 個 */
  materialId: Uint8Array;
  /** 前回のMarching Cubes抽出以降に変更されたか（V2/V3が読み取り、消費後にクリアする） */
  dirty: boolean;
}

/**
 * ChunkHalo（2026-07-12・法線継ぎ目修正）: チャンク境界の勾配計算（marchingCubes.ts の
 * computeDensityGradients）を中心差分にするため、6方向の同一tier隣接チャンクから境界1層分の
 * 密度（n×n個、平坦インデックスは面ごとに定義: x面=iy+iz*n, y面=ix+iz*n, z面=ix+iy*n）を渡す。
 * 隣接チャンクが存在しない方向（体積境界外、Fine未確保）は該当フィールドをundefinedのままにし、
 * 呼び出し側で従来通りの片側差分フォールバックを使わせる。
 * 【背景】従来はチャンク境界を自チャンクの値で代用していたため、位置は完全一致していても
 * 法線がわずかにずれ、shojiさんのローカル確認で「骨表面の継ぎ接ぎ感」として指摘された
 * （旧・角つき問題を解消したV5追補の残存課題として[[drill-mves-design]]に記録済みだったもの）。
 */
export interface ChunkHalo {
  xMinus?: Float32Array;
  xPlus?: Float32Array;
  yMinus?: Float32Array;
  yPlus?: Float32Array;
  zMinus?: Float32Array;
  zPlus?: Float32Array;
}

function chunkKey(cx: number, cy: number, cz: number, tier: ResolutionTier): string {
  return `${tier}:${cx},${cy},${cz}`;
}

function cellSizeForTier(tier: ResolutionTier): number {
  return tier === 'base' ? BASE_CELL_MM : FINE_CELL_MM;
}

function chunkWorldSizeForTier(tier: ResolutionTier): number {
  // 【V5追補・シーム修正】ステップを CHUNK_SIZE ではなく (CHUNK_SIZE-1) 個分のセルにする。
  // これにより隣接チャンクは境界の1ボクセル層（世界座標が完全一致するサンプル点）を共有する。
  // sampleAt()はワールド座標の純関数なので共有層の密度値は両チャンクで必ず一致し、
  // Marching Cubesが両側で同じ境界密度から補間するため、チャンク間の隙間（シーム）が生じない
  // （旧: ステップ=CHUNK_SIZE個分だったため境界層が共有されず、チャンク間に1セル分の
  // 隙間が生じ「骨モデルが分断される」問題があった。shojiさんのローカル確認2026-07-11で発覚）。
  return cellSizeForTier(tier) * (CHUNK_SIZE - 1);
}

// ══════════════════════════════════════════════════════════════════════
// VoxelVolume
// ══════════════════════════════════════════════════════════════════════

export class VoxelVolume {
  private readonly source: VolumeSource;
  private readonly baseChunks = new Map<string, VoxelChunk>();
  private readonly fineChunks = new Map<string, VoxelChunk>();
  /** 近接確保済みの危険構造ID（一度確保したら解放しない。設計書§1「遅延確保」の確保側のみMVES範囲） */
  private readonly fineActiveZoneIds = new Set<string>();
  private readonly dirtyChunkKeys = new Set<string>();

  constructor(source: VolumeSource) {
    this.source = source;
  }

  // ── 座標変換 ──────────────────────────────────────────────────────

  private chunkCoordForPoint(p: THREE.Vector3, tier: ResolutionTier): { cx: number; cy: number; cz: number } {
    const w = chunkWorldSizeForTier(tier);
    return {
      cx: Math.floor((p.x - VOLUME_BOUNDS_MIN.x) / w),
      cy: Math.floor((p.y - VOLUME_BOUNDS_MIN.y) / w),
      cz: Math.floor((p.z - VOLUME_BOUNDS_MIN.z) / w),
    };
  }

  private chunkOrigin(cx: number, cy: number, cz: number, tier: ResolutionTier): THREE.Vector3 {
    const w = chunkWorldSizeForTier(tier);
    return new THREE.Vector3(
      VOLUME_BOUNDS_MIN.x + cx * w,
      VOLUME_BOUNDS_MIN.y + cy * w,
      VOLUME_BOUNDS_MIN.z + cz * w
    );
  }

  /** チャンク内のローカルボクセルインデックス [ix,iy,iz] と平坦インデックスを返す。範囲外は null。 */
  private localVoxelIndex(chunk: VoxelChunk, p: THREE.Vector3): { ix: number; iy: number; iz: number; flat: number } | null {
    const rel = p.clone().sub(chunk.origin).divideScalar(chunk.cellSize);
    const ix = Math.floor(rel.x);
    const iy = Math.floor(rel.y);
    const iz = Math.floor(rel.z);
    if (ix < 0 || iy < 0 || iz < 0 || ix >= chunk.size || iy >= chunk.size || iz >= chunk.size) return null;
    const flat = ix + iy * chunk.size + iz * chunk.size * chunk.size;
    return { ix, iy, iz, flat };
  }

  // ── チャンク生成（VolumeSourceからの遅延初期化） ───────────────────

  /**
   * getOrCreateChunk(): 指定座標のチャンクを返す（未生成なら VolumeSource から生成）。
   * 【V4向けに public 化】初回シーン構築時、全Baseチャンクを座標指定で一括生成するために
   * scene 側（InteractiveDrillScene.tsx）から直接呼び出す。通常の削開時は sampleDensity 等の
   * 座標ベースAPI経由で間接的に呼ばれる（このメソッドを直接使う必要はない）。
   */
  getOrCreateChunk(cx: number, cy: number, cz: number, tier: ResolutionTier): VoxelChunk {
    const map = tier === 'base' ? this.baseChunks : this.fineChunks;
    const key = chunkKey(cx, cy, cz, tier);
    const existing = map.get(key);
    if (existing) return existing;

    const cellSize = cellSizeForTier(tier);
    const origin = this.chunkOrigin(cx, cy, cz, tier);
    const n = CHUNK_SIZE;
    const density = new Float32Array(n * n * n);
    const materialId = new Uint8Array(n * n * n);

    const voxelCenter = new THREE.Vector3();
    for (let iz = 0; iz < n; iz++) {
      for (let iy = 0; iy < n; iy++) {
        for (let ix = 0; ix < n; ix++) {
          voxelCenter.set(
            origin.x + (ix + 0.5) * cellSize,
            origin.y + (iy + 0.5) * cellSize,
            origin.z + (iz + 0.5) * cellSize
          );
          const sample = this.source.sampleAt(voxelCenter);
          const flat = ix + iy * n + iz * n * n;
          density[flat] = sample.density;
          materialId[flat] = materialIdToIndex(sample.materialId);
        }
      }
    }

    const chunk: VoxelChunk = {
      coord: { cx, cy, cz, tier },
      cellSize,
      origin,
      size: n,
      density,
      materialId,
      dirty: false,
    };
    map.set(key, chunk);
    return chunk;
  }

  /**
   * getHalo(): 指定チャンクの6方向の同一tier隣接チャンクから境界1層分の密度データ（ghost layer）
   * を集める。隣接チャンクが存在しない場合は該当フィールドをundefinedのままにする
   * （新規にチャンクを生成しない＝Fineの遅延確保方針を壊さないため）。
   */
  getHalo(chunk: VoxelChunk): ChunkHalo {
    const n = chunk.size;
    const { cx, cy, cz, tier } = chunk.coord;
    const map = tier === 'base' ? this.baseChunks : this.fineChunks;

    const sliceX = (neighbor: VoxelChunk, ix: number): Float32Array => {
      const out = new Float32Array(n * n);
      for (let iz = 0; iz < n; iz++) {
        for (let iy = 0; iy < n; iy++) {
          out[iy + iz * n] = neighbor.density[ix + iy * n + iz * n * n];
        }
      }
      return out;
    };
    const sliceY = (neighbor: VoxelChunk, iy: number): Float32Array => {
      const out = new Float32Array(n * n);
      for (let iz = 0; iz < n; iz++) {
        for (let ix = 0; ix < n; ix++) {
          out[ix + iz * n] = neighbor.density[ix + iy * n + iz * n * n];
        }
      }
      return out;
    };
    const sliceZ = (neighbor: VoxelChunk, iz: number): Float32Array => {
      const out = new Float32Array(n * n);
      for (let iy = 0; iy < n; iy++) {
        for (let ix = 0; ix < n; ix++) {
          out[ix + iy * n] = neighbor.density[ix + iy * n + iz * n * n];
        }
      }
      return out;
    };

    const halo: ChunkHalo = {};
    const xNeg = map.get(chunkKey(cx - 1, cy, cz, tier));
    if (xNeg) halo.xMinus = sliceX(xNeg, n - 2);
    const xPos = map.get(chunkKey(cx + 1, cy, cz, tier));
    if (xPos) halo.xPlus = sliceX(xPos, 1);
    const yNeg = map.get(chunkKey(cx, cy - 1, cz, tier));
    if (yNeg) halo.yMinus = sliceY(yNeg, n - 2);
    const yPos = map.get(chunkKey(cx, cy + 1, cz, tier));
    if (yPos) halo.yPlus = sliceY(yPos, 1);
    const zNeg = map.get(chunkKey(cx, cy, cz - 1, tier));
    if (zNeg) halo.zMinus = sliceZ(zNeg, n - 2);
    const zPos = map.get(chunkKey(cx, cy, cz + 1, tier));
    if (zPos) halo.zPlus = sliceZ(zPos, 1);
    return halo;
  }

  // ── Fineサブグリッドの近接確保（設計書§1: 危険域限定サブグリッド） ──

  /**
   * updateFineAllocation(): ドリル先端位置から、まだ確保していない危険構造の
   * 近接確保トリガー（warningRadius + FINE_ALLOCATE_MARGIN_MM）に入ったものがあれば
   * その周辺のFineチャンクを確保する。新規に確保した危険構造IDの配列を返す。
   */
  updateFineAllocation(toolPos: THREE.Vector3): string[] {
    const newlyActivated: string[] = [];
    for (const zone of DANGER_ZONES) {
      if (this.fineActiveZoneIds.has(zone.id)) continue;
      const zonePos = new THREE.Vector3(...zone.position);
      const activationR = zone.warningRadius + FINE_ALLOCATE_MARGIN_MM;
      if (toolPos.distanceTo(zonePos) <= activationR) {
        this.fineActiveZoneIds.add(zone.id);
        this.allocateFineChunksForSphere(zonePos, activationR);
        newlyActivated.push(zone.id);
      }
    }
    return newlyActivated;
  }

  private allocateFineChunksForSphere(center: THREE.Vector3, radius: number): void {
    const minP = center.clone().subScalar(radius).max(VOLUME_BOUNDS_MIN);
    const maxP = center.clone().addScalar(radius).min(VOLUME_BOUNDS_MAX);
    if (minP.x > maxP.x || minP.y > maxP.y || minP.z > maxP.z) return; // 完全に範囲外

    const { cx: cxMin, cy: cyMin, cz: czMin } = this.chunkCoordForPoint(minP, 'fine');
    const { cx: cxMax, cy: cyMax, cz: czMax } = this.chunkCoordForPoint(maxP, 'fine');
    for (let cz = czMin; cz <= czMax; cz++) {
      for (let cy = cyMin; cy <= cyMax; cy++) {
        for (let cx = cxMin; cx <= cxMax; cx++) {
          this.getOrCreateChunk(cx, cy, cz, 'fine');
        }
      }
    }
  }

  /** isFineActiveAt(): 点pが、既に近接確保済みのいずれかの危険構造の確保球内にあるか。 */
  isFineActiveAt(p: THREE.Vector3): boolean {
    if (this.fineActiveZoneIds.size === 0) return false;
    for (const zone of DANGER_ZONES) {
      if (!this.fineActiveZoneIds.has(zone.id)) continue;
      const zonePos = new THREE.Vector3(...zone.position);
      const activationR = zone.warningRadius + FINE_ALLOCATE_MARGIN_MM;
      if (p.distanceTo(zonePos) <= activationR) return true;
    }
    return false;
  }

  /** 現在の近接確保済み危険構造ID一覧（読み取り専用スナップショット）。 */
  getActiveFineZoneIds(): string[] {
    return Array.from(this.fineActiveZoneIds);
  }

  // ── サンプリング ──────────────────────────────────────────────────

  private tierAt(p: THREE.Vector3): ResolutionTier {
    return this.isFineActiveAt(p) ? 'fine' : 'base';
  }

  /** sampleDensity(): 点pにおける現在の密度 0–1（該当チャンク未確保なら生成して返す）。 */
  sampleDensity(p: THREE.Vector3): number {
    const tier = this.tierAt(p);
    const { cx, cy, cz } = this.chunkCoordForPoint(p, tier);
    const chunk = this.getOrCreateChunk(cx, cy, cz, tier);
    const idx = this.localVoxelIndex(chunk, p);
    if (!idx) return 0;
    return chunk.density[idx.flat];
  }

  /** sampleMaterial(): 点pにおける現在の材質ID。 */
  sampleMaterial(p: THREE.Vector3): BoneRegionId {
    const tier = this.tierAt(p);
    const { cx, cy, cz } = this.chunkCoordForPoint(p, tier);
    const chunk = this.getOrCreateChunk(cx, cy, cz, tier);
    const idx = this.localVoxelIndex(chunk, p);
    if (!idx) return 'airCells';
    return indexToMaterialId(chunk.materialId[idx.flat]);
  }

  // ── ブラシ適用（除去） ────────────────────────────────────────────

  /**
   * applyBrush(): 球状ブラシで密度を減算する。除去量は中心からの距離に応じた
   * 線形フォールオフ（中心=amount全量、境界=0）。除去モデル（removalModel.ts）が
   * 算出した1フレーム分の amount（mm相当）をそのまま渡す想定。
   * 触れた全チャンクを dirty としてマークする（V2/V3のMarching Cubes再抽出対象）。
   */
  applyBrush(input: VoxelBrushInput): void {
    const { center, radiusMm, amount } = input;
    if (radiusMm <= 0 || amount <= 0) return;

    const tier = this.tierAt(center);
    const cellSize = cellSizeForTier(tier);
    const minP = center.clone().subScalar(radiusMm).max(VOLUME_BOUNDS_MIN);
    const maxP = center.clone().addScalar(radiusMm).min(VOLUME_BOUNDS_MAX);
    if (minP.x > maxP.x || minP.y > maxP.y || minP.z > maxP.z) return;

    const { cx: cxMin, cy: cyMin, cz: czMin } = this.chunkCoordForPoint(minP, tier);
    const { cx: cxMax, cy: cyMax, cz: czMax } = this.chunkCoordForPoint(maxP, tier);

    const map = tier === 'base' ? this.baseChunks : this.fineChunks;
    const voxelCenter = new THREE.Vector3();
    for (let cz = czMin; cz <= czMax; cz++) {
      for (let cy = cyMin; cy <= cyMax; cy++) {
        for (let cx = cxMin; cx <= cxMax; cx++) {
          const chunk = this.getOrCreateChunk(cx, cy, cz, tier);
          const n = chunk.size;
          let touched = false;
          // 境界層（ix/iy/iz が 0 または n-1）が変化したか個別に追跡する。ghost layer方式
          // （getHalo()）導入に伴い、境界を挟んだ隣接チャンクの法線も再計算が必要になるため
          // （2026-07-12・法線継ぎ目修正、[[drill-mves-design]]参照）。
          let touchedXMin = false, touchedXMax = false;
          let touchedYMin = false, touchedYMax = false;
          let touchedZMin = false, touchedZMax = false;
          for (let iz = 0; iz < n; iz++) {
            for (let iy = 0; iy < n; iy++) {
              for (let ix = 0; ix < n; ix++) {
                voxelCenter.set(
                  chunk.origin.x + (ix + 0.5) * cellSize,
                  chunk.origin.y + (iy + 0.5) * cellSize,
                  chunk.origin.z + (iz + 0.5) * cellSize
                );
                const d = voxelCenter.distanceTo(center);
                if (d >= radiusMm) continue;
                const falloff = 1 - d / radiusMm;
                const flat = ix + iy * n + iz * n * n;
                const next = Math.max(0, chunk.density[flat] - amount * falloff);
                if (next !== chunk.density[flat]) {
                  chunk.density[flat] = next;
                  touched = true;
                  if (ix === 0) touchedXMin = true;
                  if (ix === n - 1) touchedXMax = true;
                  if (iy === 0) touchedYMin = true;
                  if (iy === n - 1) touchedYMax = true;
                  if (iz === 0) touchedZMin = true;
                  if (iz === n - 1) touchedZMax = true;
                }
              }
            }
          }
          if (touched) {
            chunk.dirty = true;
            this.dirtyChunkKeys.add(chunkKey(cx, cy, cz, tier));

            const markNeighborDirty = (dx: number, dy: number, dz: number) => {
              const nKey = chunkKey(cx + dx, cy + dy, cz + dz, tier);
              const neighbor = map.get(nKey);
              if (neighbor) {
                neighbor.dirty = true;
                this.dirtyChunkKeys.add(nKey);
              }
            };
            if (touchedXMin) markNeighborDirty(-1, 0, 0);
            if (touchedXMax) markNeighborDirty(1, 0, 0);
            if (touchedYMin) markNeighborDirty(0, -1, 0);
            if (touchedYMax) markNeighborDirty(0, 1, 0);
            if (touchedZMin) markNeighborDirty(0, 0, -1);
            if (touchedZMax) markNeighborDirty(0, 0, 1);
          }
        }
      }
    }
  }

  // ── ダーティチャンク管理（V2/V3 Marching Cubes / Web Worker 連携用） ──

  /** getDirtyChunks(): 前回消費以降に変更のあったチャンクの配列を返す（消費はconsumeDirtyで行う）。 */
  getDirtyChunks(): VoxelChunk[] {
    const result: VoxelChunk[] = [];
    for (const key of this.dirtyChunkKeys) {
      const chunk = this.baseChunks.get(key) ?? this.fineChunks.get(key);
      if (chunk) result.push(chunk);
    }
    return result;
  }

  /** consumeDirty(): 指定チャンクをdirty状態から復帰させる（再メッシュ化完了後にV3が呼ぶ）。 */
  consumeDirty(chunk: VoxelChunk): void {
    chunk.dirty = false;
    this.dirtyChunkKeys.delete(chunkKey(chunk.coord.cx, chunk.coord.cy, chunk.coord.cz, chunk.coord.tier));
  }

  // ── 連結性チェック（宙に浮いた骨片の除去） ──────────────────────

  /**
   * pruneDisconnectedIslands(): 削開によって主骨塊（グリッド外周＝側頭骨ブロックの外側、
   * 実際には頭蓋骨の他部分へ繋がっている想定）から完全に切り離された骨片を検出し、
   * 密度を0にして除去する。
   *
   * 【背景・医学的根拠】実際の乳突削開でも、削り進めるうちに薄い骨橋（bone bridge）だけで
   * 主骨塊とつながった骨片ができることがあるが、そのような薄い骨橋はドリルの接触圧や
   * 器具操作で自然に破断し、骨片は摘出（または吸引）される。宙に浮いたまま残ることは
   * 現実にはあり得ない（shojiさん指摘、2026-07-13）。
   *
   * 【アルゴリズム】Baseチャンクグリッドの外周面（＝側頭骨ブロックの境界、骨がまだ他の
   * 頭蓋骨部分へ繋がっているとみなせる場所）を起点としたBFS（6方向连結）で、isoLevel相当の
   * solidThreshold（既定0.5、Marching Cubesの既定isoLevelと同一値を再利用し新規の推測
   * 閾値は増やさない）を上回る密度を持つボクセルを辿る。到達できなかった「固体」ボクセルは
   * 主骨塊から切り離されていると判定し、密度を0にする（＝視覚的に消える。骨片が破断・摘出
   * された結果として扱う。将来的にはSprint6のDustParticlesで摘出演出を加える余地もあるが、
   * 今回はバグ修正のスコープを優先し見送った）。
   *
   * 【スコープ】Baseチャンクのみを対象とする。Fineチャンクは危険構造近傍限定の高解像度
   * オーバーレイであり、単独で島化するほどの塊にはなりにくいため対象外とした（既知の制約、
   * [[drill-mves-design]]に記録）。
   *
   * 【呼び出しタイミング】全Baseボクセル（既定設定で約20万個）を辿るBFSのため、毎フレーム
   * 実行はしない。呼び出し側（InteractiveDrillScene.tsx）はドリルを離した瞬間（stopDrilling）
   * にのみ呼び出す設計とし、60FPS維持と検出頻度のバランスを取る。
   *
   * @returns 密度が変化した（＝再メッシュ化が必要な）チャンクの配列
   */
  pruneDisconnectedIslands(solidThreshold = 0.5): VoxelChunk[] {
    const chunks = Array.from(this.baseChunks.values());
    if (chunks.length === 0) return [];
    const n = CHUNK_SIZE;

    let cxMin = Infinity, cxMax = -Infinity;
    let cyMin = Infinity, cyMax = -Infinity;
    let czMin = Infinity, czMax = -Infinity;
    for (const chunk of chunks) {
      const { cx, cy, cz } = chunk.coord;
      if (cx < cxMin) cxMin = cx; if (cx > cxMax) cxMax = cx;
      if (cy < cyMin) cyMin = cy; if (cy > cyMax) cyMax = cy;
      if (cz < czMin) czMin = cz; if (cz > czMax) czMax = cz;
    }

    // 性能最適化（2026-07-13）: BFS中の「訪問済み判定」をMap<VoxelChunk,...>のオブジェクトキー
    // 参照ではなく、チャンクごとに事前採番した整数インデックス経由の単純配列アクセスにする
    // （実測でMap.get()の呼び出し回数がボトルネックの一つだったため）。
    const chunkIndex = new Map<VoxelChunk, number>();
    chunks.forEach((chunk, i) => chunkIndex.set(chunk, i));
    const perChunkVisited: Uint8Array[] = chunks.map(() => new Uint8Array(n * n * n));

    const queueChunkIdx: number[] = [];
    const queueFlats: number[] = [];
    const trySeedByIdx = (chunkIdx: number, chunk: VoxelChunk, flat: number): void => {
      const vis = perChunkVisited[chunkIdx];
      if (vis[flat]) return;
      if (chunk.density[flat] <= solidThreshold) return;
      vis[flat] = 1;
      queueChunkIdx.push(chunkIdx);
      queueFlats.push(flat);
    };
    const trySeed = (chunk: VoxelChunk, flat: number): void => {
      trySeedByIdx(chunkIndex.get(chunk)!, chunk, flat);
    };

    // シード: グリッド外周チャンクの、外側を向く境界層ボクセル
    for (const chunk of chunks) {
      const { cx, cy, cz } = chunk.coord;
      const onBoundary = cx === cxMin || cx === cxMax || cy === cyMin || cy === cyMax || cz === czMin || cz === czMax;
      if (!onBoundary) continue;
      for (let iz = 0; iz < n; iz++) {
        for (let iy = 0; iy < n; iy++) {
          for (let ix = 0; ix < n; ix++) {
            const onFace =
              (cx === cxMin && ix === 0) || (cx === cxMax && ix === n - 1) ||
              (cy === cyMin && iy === 0) || (cy === cyMax && iy === n - 1) ||
              (cz === czMin && iz === 0) || (cz === czMax && iz === n - 1);
            if (!onFace) continue;
            trySeed(chunk, ix + iy * n + iz * n * n);
          }
        }
      }
    }

    // BFS（6方向連結）。性能最適化（2026-07-13）: 実グリッド規模（約20万ボクセル）での
    // 計測でワールド座標経由の隣接解決（Vector3生成＋除算＋Map文字列キー2回）がボトルネックと
    // 判明したため、チャンク境界を跨ぐ場合も整数演算のみで隣接チャンク座標を直接算出する
    // （チャンクは(CHUNK_SIZE-1)セル分ずつオーバーラップして境界層を共有する設計＝
    // chunkWorldSizeForTier参照。したがって隣チャンクへ1歩踏み出す際のローカルindexは
    // 境界の反対側から2番目の層になる: 高い側へ超えたらlocal=1、低い側へ超えたらlocal=n-2）。
    // 6方向の差分配列はBFSノードごとに再生成せずループ外で1回だけ確保する（GC負荷回避）。
    const DELTAS: readonly [number, number, number, 'x' | 'y' | 'z'][] = [
      [-1, 0, 0, 'x'], [1, 0, 0, 'x'],
      [0, -1, 0, 'y'], [0, 1, 0, 'y'],
      [0, 0, -1, 'z'], [0, 0, 1, 'z'],
    ];
    let head = 0;
    while (head < queueChunkIdx.length) {
      const chunkIdx = queueChunkIdx[head];
      const chunk = chunks[chunkIdx];
      const flat = queueFlats[head];
      head++;
      const ix = flat % n;
      const iy = Math.floor(flat / n) % n;
      const iz = Math.floor(flat / (n * n));
      const { cx, cy, cz } = chunk.coord;

      for (let d = 0; d < 6; d++) {
        const [dx, dy, dz, axis] = DELTAS[d];
        const jx = ix + dx, jy = iy + dy, jz = iz + dz;
        if (jx >= 0 && jx < n && jy >= 0 && jy < n && jz >= 0 && jz < n) {
          trySeedByIdx(chunkIdx, chunk, jx + jy * n + jz * n * n);
          continue;
        }
        // このチャンクのローカル範囲を超えた＝隣接チャンクへ踏み出す（隣接解決のみMap文字列
        // キー参照が必要。チャンク内で完結する残り大半のステップは上のtrySeedByIdxで完結する）。
        let ncx = cx, ncy = cy, ncz = cz;
        let nix = jx, niy = jy, niz = jz;
        if (axis === 'x') { ncx = cx + dx; nix = dx > 0 ? 1 : n - 2; }
        else if (axis === 'y') { ncy = cy + dy; niy = dy > 0 ? 1 : n - 2; }
        else { ncz = cz + dz; niz = dz > 0 ? 1 : n - 2; }
        const neighbor = this.baseChunks.get(chunkKey(ncx, ncy, ncz, 'base'));
        if (!neighbor) continue;
        trySeed(neighbor, nix + niy * n + niz * n * n);
      }
    }

    // 未到達の固体ボクセル＝主骨塊から切り離された骨片 → 除去
    const changed: VoxelChunk[] = [];
    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];
      const vis = perChunkVisited[ci];
      let touched = false;
      const total = n * n * n;
      for (let i = 0; i < total; i++) {
        if (chunk.density[i] > solidThreshold && !vis[i]) {
          chunk.density[i] = 0;
          touched = true;
        }
      }
      if (touched) {
        chunk.dirty = true;
        this.dirtyChunkKeys.add(chunkKey(chunk.coord.cx, chunk.coord.cy, chunk.coord.cz, 'base'));
        changed.push(chunk);
      }
    }
    return changed;
  }

  // ── デバッグ/検証用 ───────────────────────────────────────────────

  /** 確保済みチャンク数（Base/Fine別）。性能検証（V8）・テスト用。 */
  getStats(): { baseChunkCount: number; fineChunkCount: number; dirtyCount: number; activeFineZones: number } {
    return {
      baseChunkCount: this.baseChunks.size,
      fineChunkCount: this.fineChunks.size,
      dirtyCount: this.dirtyChunkKeys.size,
      activeFineZones: this.fineActiveZoneIds.size,
    };
  }
}
