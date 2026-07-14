/**
 * remeshQueue.ts ─ Marching Cubes 再メッシュ化キュー（V3）
 *
 * 設計書: KURZ_削開アルゴリズム再設計_v1.0.md ⑤実装方針 Phase2/⑦V3
 * 変更のあったチャンク（VoxelVolume.getDirtyChunks()、Sprint1実装済み）を Web Worker
 * （voxelRemeshWorker.ts）へ送り、チャンクごとに約100〜150msスロットルして再メッシュ化要求の
 * 過多を防ぐ（設計書「Workerメッセージ過多を防ぐ」、既定120ms）。
 *
 * density/materialId は VoxelVolume が生きたまま保持し続ける配列のため、送信時は
 * Transferable化せず slice() でコピーする（Transferableに含めると呼び出し元の配列がdetachされ、
 * 以後の削開処理が壊れるため厳禁）。応答（新規生成された頂点配列）は Worker内でしか
 * 使われないため zero-copy Transferable で受け取る（voxelRemeshWorker.ts側の実装）。
 *
 * 【Sprint2 V3時点のスコープ】本ファイルはWorker管理・スロットリングのみを提供する。実シーンから
 * 毎フレーム VoxelVolume.getDirtyChunks() を渡す配線や、結果を使った BufferGeometry組み立ては
 * V4/V5で行う（本ファイルはテスト可能な独立ユニットとして先行実装する）。
 */

import type { ChunkHalo, VoxelChunk } from './voxelVolume';
import type { RemeshRequestPayload, RemeshResponsePayload } from '../workers/voxelRemeshWorker';

/** postMessage/onmessage/terminateのみに依存する最小Workerインターフェース（テスト注入用）。 */
export interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((ev: MessageEvent<RemeshResponsePayload>) => void) | null;
  terminate(): void;
}

/** 実ブラウザWorkerを生成するデフォルトファクトリ（Vite標準のmodule worker importパターン）。 */
function defaultWorkerFactory(): WorkerLike {
  return new Worker(new URL('../workers/voxelRemeshWorker.ts', import.meta.url), {
    type: 'module',
  }) as unknown as WorkerLike;
}

/** チャンクごとの再メッシュ化要求スロットル間隔 ms。設計書「約100〜150ms」の中央値。 */
export const REMESH_THROTTLE_MS = 120;

function chunkKey(coord: VoxelChunk['coord']): string {
  return `${coord.tier}:${coord.cx},${coord.cy},${coord.cz}`;
}

export class RemeshQueue {
  private readonly worker: WorkerLike;
  private readonly throttleMs: number;
  private readonly listeners = new Set<(payload: RemeshResponsePayload) => void>();
  private readonly lastSentAt = new Map<string, number>();
  private readonly pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pendingChunks = new Map<string, { chunk: VoxelChunk; halo?: ChunkHalo; isoLevel: number }>();
  private requestIdCounter = 0;

  constructor(workerFactory: () => WorkerLike = defaultWorkerFactory, throttleMs: number = REMESH_THROTTLE_MS) {
    this.worker = workerFactory();
    this.throttleMs = throttleMs;
    this.worker.onmessage = (ev) => {
      const payload = ev.data;
      for (const listener of this.listeners) listener(payload);
    };
  }

  /** onResult(): 再メッシュ結果を受け取るリスナーを登録する。戻り値の関数で登録解除できる。 */
  onResult(cb: (payload: RemeshResponsePayload) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /**
   * requestRemesh(): チャンクの再メッシュ化を要求する（leading + trailing throttle）。
   * - 前回送信から throttleMs 以上経過していれば即座に送信する（leading edge）。
   * - throttleMs 未満なら、区間末尾で1回だけ送信するよう予約する（trailing edge）。
   *   予約中に同じチャンクへ再度要求が来た場合、送信されるのは最新のチャンクスナップショット
   *   （直前のスナップショットは破棄）。
   */
  requestRemesh(chunk: VoxelChunk, halo?: ChunkHalo, isoLevel = 0.5): void {
    const key = chunkKey(chunk.coord);
    const now = Date.now();
    const lastSent = this.lastSentAt.get(key) ?? -Infinity;

    this.pendingChunks.set(key, { chunk, halo, isoLevel });

    if (now - lastSent >= this.throttleMs) {
      this.flush(key);
      return;
    }

    if (this.pendingTimers.has(key)) return; // 既にtrailing送信が予約済み

    const delay = this.throttleMs - (now - lastSent);
    const timer = setTimeout(() => {
      this.pendingTimers.delete(key);
      this.flush(key);
    }, delay);
    this.pendingTimers.set(key, timer);
  }

  private flush(key: string): void {
    const pending = this.pendingChunks.get(key);
    if (!pending) return;
    this.pendingChunks.delete(key);
    this.lastSentAt.set(key, Date.now());

    const { chunk, halo, isoLevel } = pending;
    const requestId = this.requestIdCounter++;

    const payload: RemeshRequestPayload = {
      requestId,
      coord: chunk.coord,
      cellSize: chunk.cellSize,
      origin: [chunk.origin.x, chunk.origin.y, chunk.origin.z],
      size: chunk.size,
      // density/materialIdはVoxelVolumeが生きたまま保持するため slice() でコピーを送る
      // （Transferableに含めると呼び出し元の配列がdetachされ、以後の削開処理が壊れるため厳禁）。
      density: chunk.density.slice(),
      materialId: chunk.materialId.slice(),
      isoLevel,
      // halo（ghost layer）は呼び出し側がgetHalo()で毎回新規生成する使い捨て配列なので
      // コピーで送っても実害はない（2026-07-12・法線継ぎ目修正）。
      halo,
    };
    this.worker.postMessage(payload);
  }

  /** flushAll(): 保留中の全チャンクを即座に送信する（例: セッション終了直前のフラッシュ用）。 */
  flushAll(): void {
    for (const key of Array.from(this.pendingChunks.keys())) {
      const timer = this.pendingTimers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.pendingTimers.delete(key);
      }
      this.flush(key);
    }
  }

  dispose(): void {
    for (const timer of this.pendingTimers.values()) clearTimeout(timer);
    this.pendingTimers.clear();
    this.pendingChunks.clear();
    this.listeners.clear();
    this.worker.terminate();
  }
}
