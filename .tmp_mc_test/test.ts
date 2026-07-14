import * as THREE from 'three';
import { extractChunkMesh } from '../src/engine/marchingCubes';
import type { VoxelChunk } from '../src/engine/voxelVolume';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('PASS: ' + msg);
}

function makeChunk(size: number, cellSize: number, origin: THREE.Vector3, fill: (p: THREE.Vector3) => number): VoxelChunk {
  const density = new Float32Array(size * size * size);
  const materialId = new Uint8Array(size * size * size);
  const p = new THREE.Vector3();
  for (let iz = 0; iz < size; iz++) {
    for (let iy = 0; iy < size; iy++) {
      for (let ix = 0; ix < size; ix++) {
        p.set(origin.x + (ix + 0.5) * cellSize, origin.y + (iy + 0.5) * cellSize, origin.z + (iz + 0.5) * cellSize);
        const flat = ix + iy * size + iz * size * size;
        density[flat] = fill(p);
        materialId[flat] = 2; // 定数材質（テストでは中身は問わない）
      }
    }
  }
  return {
    coord: { cx: 0, cy: 0, cz: 0, tier: 'base' },
    cellSize,
    origin,
    size,
    density,
    materialId,
    dirty: false,
  };
}

const gray = () => new THREE.Color(0.7, 0.6, 0.5);

// ── Test 1: 全固体チャンク → 三角形0枚 ──────────────────────────────
{
  const chunk = makeChunk(6, 1, new THREE.Vector3(-3, -3, -3), () => 1.0);
  const result = extractChunkMesh(chunk, gray);
  assert(result.triangleCount === 0, `all-solid chunk produces 0 triangles (got ${result.triangleCount})`);
}

// ── Test 2: 全空気チャンク → 三角形0枚 ──────────────────────────────
{
  const chunk = makeChunk(6, 1, new THREE.Vector3(-3, -3, -3), () => 0.0);
  const result = extractChunkMesh(chunk, gray);
  assert(result.triangleCount === 0, `all-air chunk produces 0 triangles (got ${result.triangleCount})`);
}

// ── Test 3: 球形状 → 三角形群が閉曲面を形成し、符号付き体積が正かつ理論値に近い ──
{
  const size = 20;
  const cellSize = 0.75; // mm
  const half = (size * cellSize) / 2;
  const origin = new THREE.Vector3(-half, -half, -half);
  const radius = 5.0; // mm
  const center = new THREE.Vector3(0, 0, 0);

  const chunk = makeChunk(size, cellSize, origin, (p) => (p.distanceTo(center) <= radius ? 1.0 : 0.0));
  const result = extractChunkMesh(chunk, gray);

  assert(result.triangleCount > 0, `sphere chunk produces triangles (got ${result.triangleCount})`);

  // 符号付き体積 = (1/6) * Σ p0・(p1×p2)（閉曲面・外向き法線なら正、かつ理論値に近いはず）
  let signedVolume = 0;
  const pos = result.positions;
  for (let t = 0; t < result.triangleCount; t++) {
    const i0 = t * 9;
    const p0 = new THREE.Vector3(pos[i0], pos[i0 + 1], pos[i0 + 2]);
    const p1 = new THREE.Vector3(pos[i0 + 3], pos[i0 + 4], pos[i0 + 5]);
    const p2 = new THREE.Vector3(pos[i0 + 6], pos[i0 + 7], pos[i0 + 8]);
    signedVolume += p0.dot(p1.clone().cross(p2));
  }
  signedVolume /= 6;

  const analyticVolume = (4 / 3) * Math.PI * radius ** 3;
  console.log(`  signedVolume=${signedVolume.toFixed(2)}  analyticVolume=${analyticVolume.toFixed(2)}`);

  assert(signedVolume > 0, `signed volume is positive (outward-facing normals) (got ${signedVolume.toFixed(2)})`);
  const relErr = Math.abs(signedVolume - analyticVolume) / analyticVolume;
  assert(relErr < 0.1, `signed volume within 10% of analytic sphere volume (relErr=${(relErr * 100).toFixed(1)}%)`);

  // 法線の外向き確認（三角形重心→中心の逆方向を向くはず）
  let outwardCount = 0;
  for (let t = 0; t < result.triangleCount; t++) {
    const i0 = t * 9;
    const cx = (pos[i0] + pos[i0 + 3] + pos[i0 + 6]) / 3;
    const cy = (pos[i0 + 1] + pos[i0 + 4] + pos[i0 + 7]) / 3;
    const cz = (pos[i0 + 2] + pos[i0 + 5] + pos[i0 + 8]) / 3;
    const nrm = result.normals;
    const ni = t * 9; // 法線は頂点ごとに複製、三角形先頭のみ参照
    const outward = new THREE.Vector3(cx, cy, cz).sub(center).normalize();
    const normal = new THREE.Vector3(nrm[ni], nrm[ni + 1], nrm[ni + 2]);
    if (normal.dot(outward) > 0) outwardCount++;
  }
  const outwardRatio = outwardCount / result.triangleCount;
  console.log(`  outwardRatio=${(outwardRatio * 100).toFixed(1)}% (${outwardCount}/${result.triangleCount})`);
  assert(outwardRatio > 0.95, `>95% of triangle normals point outward (got ${(outwardRatio * 100).toFixed(1)}%)`);
}

// ── Test 4: 材質色伝播（固体側の材質が優先されること）──────────────
{
  const size = 6;
  const cellSize = 1;
  const origin = new THREE.Vector3(-3, -3, -3);
  const density = new Float32Array(size * size * size).fill(0);
  const materialId = new Uint8Array(size * size * size).fill(9); // 空気側の材質(意味なし値)
  // 中心付近の1点だけ密度1・材質7の「固体」にする
  const flatCenter = 3 + 3 * size + 3 * size * size;
  density[flatCenter] = 1.0;
  materialId[flatCenter] = 7;
  const chunk: VoxelChunk = {
    coord: { cx: 0, cy: 0, cz: 0, tier: 'base' },
    cellSize,
    origin,
    size,
    density,
    materialId,
    dirty: false,
  };
  const result = extractChunkMesh(chunk, (idx) => new THREE.Color(idx / 10, 0, 0));
  assert(result.triangleCount > 0, `single solid voxel produces triangles (got ${result.triangleCount})`);
  // 生成された色の少なくとも一部が材質7 (r=0.7) を反映しているはず
  let found7 = false;
  for (let i = 0; i < result.colors.length; i += 3) {
    if (Math.abs(result.colors[i] - 0.7) < 1e-6) found7 = true;
  }
  assert(found7, 'material index 7 (solid corner) color propagated to at least one vertex');
}

console.log('ALL TESTS PASSED');
