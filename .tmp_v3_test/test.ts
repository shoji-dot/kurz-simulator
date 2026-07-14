import * as THREE from 'three';
import { extractChunkMeshRaw } from '../src/engine/marchingCubes';
import { handleRemeshRequest } from '../src/workers/voxelRemeshWorker';
import type { RemeshRequestPayload, RemeshResponsePayload } from '../src/workers/voxelRemeshWorker';
import { RemeshQueue, REMESH_THROTTLE_MS } from '../src/engine/remeshQueue';
import type { WorkerLike } from '../src/engine/remeshQueue';
import type { VoxelChunk } from '../src/engine/voxelVolume';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('PASS: ' + msg);
}

function makeSphereChunk(): VoxelChunk {
  const size = 10;
  const cellSize = 1;
  const origin = new THREE.Vector3(-5, -5, -5);
  const density = new Float32Array(size * size * size);
  const materialId = new Uint8Array(size * size * size);
  const center = new THREE.Vector3(0, 0, 0);
  const p = new THREE.Vector3();
  for (let iz = 0; iz < size; iz++) {
    for (let iy = 0; iy < size; iy++) {
      for (let ix = 0; ix < size; ix++) {
        p.set(origin.x + (ix + 0.5) * cellSize, origin.y + (iy + 0.5) * cellSize, origin.z + (iz + 0.5) * cellSize);
        const flat = ix + iy * size + iz * size * size;
        density[flat] = p.distanceTo(center) <= 3 ? 1.0 : 0.0;
        materialId[flat] = 2;
      }
    }
  }
  return { coord: { cx: 1, cy: 2, cz: 3, tier: 'base' }, cellSize, origin, size, density, materialId, dirty: true };
}

// ── Test A: handleRemeshRequest() が extractChunkMeshRaw() と同じ幾何を返す ──────
{
  const chunk = makeSphereChunk();
  const direct = extractChunkMeshRaw(chunk, 0.5);

  const payload: RemeshRequestPayload = {
    requestId: 42,
    coord: chunk.coord,
    cellSize: chunk.cellSize,
    origin: [chunk.origin.x, chunk.origin.y, chunk.origin.z],
    size: chunk.size,
    density: chunk.density.slice(),
    materialId: chunk.materialId.slice(),
    isoLevel: 0.5,
  };
  const response = handleRemeshRequest(payload);

  assert(response.requestId === 42, 'requestId echoed back correctly');
  assert(response.coord.cx === 1 && response.coord.cy === 2 && response.coord.cz === 3, 'coord echoed back correctly');
  assert(response.vertexCount === direct.vertexCount, `vertexCount matches direct call (${response.vertexCount} vs ${direct.vertexCount})`);
  assert(response.triangleCount === direct.triangleCount, 'triangleCount matches direct call');

  let positionsMatch = true;
  for (let i = 0; i < direct.positions.length; i++) {
    if (Math.abs(response.positions[i] - direct.positions[i]) > 1e-9) positionsMatch = false;
  }
  assert(positionsMatch, 'positions bit-identical to direct extractChunkMeshRaw call');

  let materialsMatch = true;
  for (let i = 0; i < direct.materialIndices.length; i++) {
    if (response.materialIndices[i] !== direct.materialIndices[i]) materialsMatch = false;
  }
  assert(materialsMatch, 'materialIndices identical to direct call');
}

// ── Test B: RemeshQueue のスロットリング（leading edge即時送信）───────────────
class MockWorker implements WorkerLike {
  sentPayloads: RemeshRequestPayload[] = [];
  onmessage: ((ev: MessageEvent<RemeshResponsePayload>) => void) | null = null;
  postMessage(message: unknown): void {
    this.sentPayloads.push(message as RemeshRequestPayload);
  }
  terminate(): void {}
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runThrottleTests() {
  const THROTTLE = 40; // テスト高速化のため短縮（本番REMESH_THROTTLE_MSは別途定数として検証）

  // B1: 最初の要求は即座に送信される（leading edge）
  {
    const mock = new MockWorker();
    const queue = new RemeshQueue(() => mock, THROTTLE);
    const chunk = makeSphereChunk();
    queue.requestRemesh(chunk);
    assert(mock.sentPayloads.length === 1, `leading edge: first request sent immediately (got ${mock.sentPayloads.length})`);
    queue.dispose();
  }

  // B2: スロットル窓内の連続要求は1回に間引かれ、最新スナップショットが送られる
  {
    const mock = new MockWorker();
    const queue = new RemeshQueue(() => mock, THROTTLE);
    const chunk = makeSphereChunk();

    queue.requestRemesh(chunk); // leading edge, 即送信 (1通目)
    assert(mock.sentPayloads.length === 1, 'B2: leading edge sent (1)');

    // スロットル窓内に3回連続要求 → 追加送信は無し、trailing用に最新版だけ保持されるはず
    chunk.density[0] = 0.11;
    queue.requestRemesh(chunk);
    chunk.density[0] = 0.22;
    queue.requestRemesh(chunk);
    chunk.density[0] = 0.33; // 最新値
    queue.requestRemesh(chunk);
    assert(mock.sentPayloads.length === 1, `B2: no immediate send during throttle window (still ${mock.sentPayloads.length})`);

    await sleep(THROTTLE + 20);
    assert(mock.sentPayloads.length === 2, `B2: trailing edge sent exactly once after window (got ${mock.sentPayloads.length})`);
    const trailingPayload = mock.sentPayloads[1];
    assert(Math.abs(trailingPayload.density[0] - 0.33) < 1e-5, `B2: trailing send uses latest chunk snapshot (density[0]=${trailingPayload.density[0]})`);

    queue.dispose();
  }

  // B3: スロットル窓を空けて要求すると再び即座に送信される
  {
    const mock = new MockWorker();
    const queue = new RemeshQueue(() => mock, THROTTLE);
    const chunk = makeSphereChunk();
    queue.requestRemesh(chunk);
    assert(mock.sentPayloads.length === 1, 'B3: first send');
    await sleep(THROTTLE + 20);
    queue.requestRemesh(chunk);
    assert(mock.sentPayloads.length === 2, `B3: second send after throttle window elapsed (got ${mock.sentPayloads.length})`);
    queue.dispose();
  }

  // B4: density/materialId は Transferable に含まれず、コピー(slice)されて送られる
  {
    const mock = new MockWorker();
    const queue = new RemeshQueue(() => mock, THROTTLE);
    const chunk = makeSphereChunk();
    const originalDensityRef = chunk.density;
    queue.requestRemesh(chunk);
    const sentDensity = mock.sentPayloads[0].density;
    assert(sentDensity !== originalDensityRef, 'B4: sent density is a copy, not the same array reference (no accidental transfer/detach)');
    assert(sentDensity.length === originalDensityRef.length, 'B4: copied density has same length');
    originalDensityRef[5] = 0.987; // 元配列を後から書き換えても送信済みコピーには影響しない
    assert(Math.abs(sentDensity[5] - 0.987) > 1e-6, 'B4: mutating original chunk.density after send does not affect the already-sent copy');
    queue.dispose();
  }

  // B5: onResult のレスポンス配送・登録解除
  {
    const mock = new MockWorker();
    const queue = new RemeshQueue(() => mock, THROTTLE);
    let received: RemeshResponsePayload | null = null;
    const unsubscribe = queue.onResult((payload) => {
      received = payload;
    });
    const fakeResponse: RemeshResponsePayload = {
      requestId: 1,
      coord: { cx: 0, cy: 0, cz: 0, tier: 'base' },
      positions: new Float32Array([1, 2, 3]),
      normals: new Float32Array([0, 1, 0]),
      materialIndices: new Uint8Array([2]),
      indices: new Uint32Array([0]),
      vertexCount: 1,
      triangleCount: 0,
    };
    mock.onmessage?.({ data: fakeResponse } as MessageEvent<RemeshResponsePayload>);
    assert(received !== null && (received as unknown as RemeshResponsePayload).requestId === 1, 'B5: onResult listener receives worker response');

    unsubscribe();
    received = null;
    mock.onmessage?.({ data: { ...fakeResponse, requestId: 2 } } as MessageEvent<RemeshResponsePayload>);
    assert(received === null, 'B5: unsubscribed listener no longer receives responses');

    queue.dispose();
  }

  assert(REMESH_THROTTLE_MS === 120, `production default REMESH_THROTTLE_MS is 120ms (got ${REMESH_THROTTLE_MS})`);

  console.log('ALL V3 TESTS PASSED');
}

runThrottleTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
