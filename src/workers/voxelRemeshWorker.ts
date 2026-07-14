/**
 * voxelRemeshWorker.ts ─ Marching Cubes 再メッシュ化 Web Worker（V3）
 *
 * 設計書: KURZ_削開アルゴリズム再設計_v1.0.md ⑤実装方針 Phase2/⑦V3
 * メインスレッドをブロックしないよう、チャンク単位の Marching Cubes 抽出
 * （src/engine/marchingCubes.ts の extractChunkMeshRaw）をこの Worker 上で実行する。
 *
 * 【メッセージ契約とテスト方針】メインスレッド⇔Worker間のペイロード変換処理は
 * handleRemeshRequest() という純関数に切り出してある。sandbox の Node 環境では実際の
 * ブラウザ Web Worker を起動できない（`self`/`postMessage` はブラウザ・Workerランタイム
 * 専用グローバル）ため、以下の2段構成にしている:
 *   1. handleRemeshRequest() ─ 型付き・純粋・Node上でも直接ユニットテスト可能
 *   2. ファイル末尾の self.onmessage 配線 ─ 上記を呼ぶだけの薄いアダプタ。ここは
 *      Node からはテストできず、Vite でのバンドル・実ブラウザでの動作確認が別途必要
 *      （保留事項。V4/V5でシーンに配線する際に合わせて確認する）。
 *
 * 【Transferable の扱い】density/materialId は呼び出し側（VoxelVolume）が生きたまま保持し
 * 続ける配列のため、受信メッセージ内のそれらを Transferable として扱ってはならない
 * （呼び出し元は既に構造化クローンでコピーを送っている前提、remeshQueue.ts 参照）。
 * 逆にこの Worker が新規生成する結果配列（positions/normals/materialIndices/indices）は
 * この Worker 内でしか参照されないため、返信時は Transferable で zero-copy 転送する。
 */

import * as THREE from 'three';
import { extractChunkMeshRaw } from '../engine/marchingCubes';
import type { ChunkHalo, VoxelChunk } from '../engine/voxelVolume';
import type { ResolutionTier } from '../engine/types';

export interface RemeshRequestPayload {
  requestId: number;
  coord: { cx: number; cy: number; cz: number; tier: ResolutionTier };
  cellSize: number;
  origin: [number, number, number];
  size: number;
  density: Float32Array;
  materialId: Uint8Array;
  isoLevel: number;
  /** 境界法線の中心差分用ghost layer（2026-07-12・法線継ぎ目修正、voxelVolume.ts getHalo()参照） */
  halo?: ChunkHalo;
}

export interface RemeshResponsePayload {
  requestId: number;
  coord: { cx: number; cy: number; cz: number; tier: ResolutionTier };
  positions: Float32Array;
  normals: Float32Array;
  materialIndices: Uint8Array;
  indices: Uint32Array;
  vertexCount: number;
  triangleCount: number;
}

/**
 * handleRemeshRequest(): リクエストペイロードから VoxelChunk 相当のオブジェクトを再構成し、
 * extractChunkMeshRaw() を実行して応答ペイロードを返す純関数。Worker内・テストの両方から
 * 同じロジックを使う（self.onmessage 配線から意図的に分離している）。
 */
export function handleRemeshRequest(payload: RemeshRequestPayload): RemeshResponsePayload {
  const chunk: VoxelChunk = {
    coord: payload.coord,
    cellSize: payload.cellSize,
    origin: new THREE.Vector3(payload.origin[0], payload.origin[1], payload.origin[2]),
    size: payload.size,
    density: payload.density,
    materialId: payload.materialId,
    dirty: false,
  };
  const raw = extractChunkMeshRaw(chunk, payload.isoLevel, payload.halo);
  return {
    requestId: payload.requestId,
    coord: payload.coord,
    positions: raw.positions,
    normals: raw.normals,
    materialIndices: raw.materialIndices,
    indices: raw.indices,
    vertexCount: raw.vertexCount,
    triangleCount: raw.triangleCount,
  };
}

// ══════════════════════════════════════════════════════════════════════
// Worker実行コンテキストでのみ動く薄いアダプタ（Node/テストでは実行されない）
// ══════════════════════════════════════════════════════════════════════

interface WorkerGlobalLike {
  onmessage: ((ev: MessageEvent<RemeshRequestPayload>) => void) | null;
  postMessage: (message: RemeshResponsePayload, transfer: Transferable[]) => void;
}

const workerSelf: WorkerGlobalLike | undefined =
  typeof self !== 'undefined' ? (self as unknown as WorkerGlobalLike) : undefined;

if (workerSelf) {
  workerSelf.onmessage = (ev) => {
    const response = handleRemeshRequest(ev.data);
    workerSelf.postMessage(response, [
      response.positions.buffer,
      response.normals.buffer,
      response.materialIndices.buffer,
      response.indices.buffer,
    ]);
  };
}
