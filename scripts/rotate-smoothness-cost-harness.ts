/**
 * scripts/rotate-smoothness-cost-harness.ts ─── Rotate Smoothness Investigation ①
 * evaluateRotationCandidate() の処理コスト計測（Architect指示2026-08-16、Read-only）
 *
 * 目的: 実機で確認された「引っ掛かり・遅延」の主因候補のうち、
 *   B = evaluateRotationCandidate() 自体の処理コスト
 * を、実プロジェクトの純粋関数（composeRotationCandidatePose相当/buildProsthesisCollisionProxy/
 * testCollision）をそのまま使って計測する。SimScene.tsx自体はReact/Suspense/useGLTF.preload等の
 * 副作用を持つため直接importせず（scripts/p4b3-safety-regression.tsの既存方針を踏襲）、
 * composeRotationCandidatePose（SimScene.tsx:1093-1120、非export）の式のみをこのファイル内に
 * 複製する（値・ロジックは無変更、複製のみ）。
 *
 * 実行方法: npx tsx scripts/rotate-smoothness-cost-harness.ts
 *
 * 本スクリプトはコード変更ではなく調査専用ツール（scripts/p4b3-safety-regression.tsと同じ
 * 位置づけ）。src/配下のアプリケーションコードには一切触れていない。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshBVH } from 'three-mesh-bvh';

import { computeProsthesisModelPose } from '../src/scenes/models/ProsthesisModels';
import { STAPES_HEAD, STAPES_FOOTPLATE } from '../src/scenes/models/OssicleModels';
import { buildProsthesisCollisionProxy, FOOT_CONTACT_TOLERANCE_MM } from '../src/engine/collision/prosthesisCollisionGeometry';
import { testCollision } from '../src/engine/collision/collisionTest';
import type { AnatomyCollisionKey } from '../src/engine/collision/anatomyCollisionIndex';
import { kurzProducts } from '../src/data/products';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// composeRotationCandidatePose（SimScene.tsx:1093-1120）の複製。式は一切変更していない。
function composeRotationCandidatePose(params: {
  product: typeof kurzProducts[number];
  shaftLength: number;
  basePos: THREE.Vector3;
  lateralOffset: number;
  anteriorOffset: number;
  verticalOffset: number;
  dragOffsetX: number;
  dragOffsetY: number;
  dragOffsetZ: number;
  shaftRollDeg: number;
  candidateAngleTilt: number;
  candidateAngleTiltZ: number;
}): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
  const pose = computeProsthesisModelPose({
    product: params.product, shaftLength: params.shaftLength, basePos: params.basePos,
    lateralOffset: params.lateralOffset + params.dragOffsetX,
    verticalOffset: params.verticalOffset + params.dragOffsetY,
    anteriorOffset: params.anteriorOffset + params.dragOffsetZ,
    angleTilt: params.candidateAngleTilt, angleTiltZ: params.candidateAngleTiltZ,
  });
  const quaternion = params.shaftRollDeg
    ? pose.quaternion.clone().multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (params.shaftRollDeg * Math.PI) / 180),
      )
    : pose.quaternion;
  return { position: pose.position, quaternion };
}

const DRAG_COLLISION_TARGETS: AnatomyCollisionKey[] = ['bone'];

async function loadBoneBvh(coordGroupMatrixWorld: THREE.Matrix4, glbOffset: THREE.Vector3): Promise<{ bvh: MeshBVH; triangleCount: number }> {
  const glbPath = path.resolve(__dirname, '../public/models/Bone.glb');
  const buf = fs.readFileSync(glbPath);
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

  const gltf = await new Promise<any>((resolve, reject) => {
    new GLTFLoader().parse(arrayBuffer, '', resolve, reject);
  });

  let mesh: THREE.Mesh | null = null;
  gltf.scene.traverse((child: THREE.Object3D) => {
    if (mesh) return;
    if ((child as THREE.Mesh).isMesh) mesh = child as THREE.Mesh;
  });
  if (!mesh) throw new Error('Bone.glb: メッシュが見つかりません');

  // anatomyRootMatrixWorld = coordGroupMatrixWorld * translate(GLB_OFFSET)
  // （SimScene.tsx: <group ref={coordGroupRef} rotation={[PI,-PI/2,0]}> の子として
  //   <group position={GLB_OFFSET} ref={anatomyGroupRef}> がある、実際の親子構造と同一）。
  const anatomyRootMatrixWorld = coordGroupMatrixWorld.clone()
    .multiply(new THREE.Matrix4().makeTranslation(glbOffset.x, glbOffset.y, glbOffset.z));

  const worldGeometry = (mesh as THREE.Mesh).geometry.clone();
  worldGeometry.applyMatrix4(anatomyRootMatrixWorld);
  const triangleCount = (worldGeometry.index ? worldGeometry.index.count : worldGeometry.attributes.position.count) / 3;
  const bvh = new MeshBVH(worldGeometry);
  return { bvh, triangleCount };
}

interface Stats { meanMs: number; medianMs: number; p95Ms: number; maxMs: number; minMs: number; n: number }
function computeStats(samplesMs: number[]): Stats {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    meanMs: sum / sorted.length,
    medianMs: sorted[Math.floor(sorted.length * 0.5)],
    p95Ms: sorted[Math.floor(sorted.length * 0.95)],
    maxMs: sorted[sorted.length - 1],
    minMs: sorted[0],
    n: sorted.length,
  };
}

async function main() {
  const product = kurzProducts.find((p) => p.footType === 'BELL' && p.headType === 'BELL_TOP');
  if (!product) throw new Error('footType=BELL/headType=BELL_TOP の製品が見つかりません');
  const shaftLength = 4.0; // 実カタログ値の代表値（形状には影響するが計測意図には影響しない）

  const coordGroupMatrixWorld = new THREE.Matrix4().makeRotationFromEuler(
    new THREE.Euler(Math.PI, -Math.PI / 2, 0),
  );
  const glbOffset = new THREE.Vector3(STAPES_FOOTPLATE.x, STAPES_FOOTPLATE.y, STAPES_FOOTPLATE.z);

  console.log('=== Rotate Smoothness Investigation ① evaluateRotationCandidate() Cost Harness ===');
  console.log(`product: ${product.id} (${product.footType}/${product.headType}), shaftLength=${shaftLength}mm`);
  console.log('Bone.glb ロード中...');
  const { bvh, triangleCount } = await loadBoneBvh(coordGroupMatrixWorld, glbOffset);
  console.log(`Bone.glb ロード完了: triangleCount=${Math.round(triangleCount)}`);
  console.log('');

  const anatomyIndexStub = {
    getBvh: (_key: AnatomyCollisionKey, _worldTransform: THREE.Matrix4) => bvh,
    getWorldGeometry: () => null,
  };
  // testCollision()に渡すworldTransform引数（Bone側）は既にBVH構築時にベイク済みのため、
  // ここではidentityを渡す（実コードのanatomyRoot.matrixWorldは既にgetBvh内部で使用済み、
  // 実際の呼び出しではgetBvh(key, worldTransform)の第2引数はキャッシュヒット時は無視される
  // ── anatomyCollisionIndex.ts:52-54参照。本harnessも同じ挙動を再現している）。
  const identity = new THREE.Matrix4();

  // 実際のRotate-drag操作を模した候補角度スイープ: -30度〜+30度を0.3度刻み
  // （ROTATE_DEG_PER_PIXEL_TILT_Z=0.3、SimScene.tsx:1038 と同じ刻み幅 = 1pxのpointermoveに相当）。
  // Collision/非Collisionの両方の分岐を含む現実的な範囲。basePosはBELLなのでSTAPES_HEAD。
  const basePos = STAPES_HEAD.clone();
  const angles: number[] = [];
  for (let a = -30; a <= 30; a += 0.3) angles.push(Number(a.toFixed(1)));

  const composeSamples: number[] = [];
  const proxySamples: number[] = [];
  const collisionSamples: number[] = [];
  const totalSamples: number[] = [];
  let collidedCount = 0;

  // ウォームアップ（JIT安定化、計測対象外）
  for (let i = 0; i < 200; i++) {
    const a = angles[i % angles.length];
    const pose = composeRotationCandidatePose({
      product, shaftLength, basePos,
      lateralOffset: 0, anteriorOffset: 0, verticalOffset: 0,
      dragOffsetX: 0, dragOffsetY: 0, dragOffsetZ: 0,
      shaftRollDeg: 0, candidateAngleTilt: a, candidateAngleTiltZ: 0,
    });
    const proxy = buildProsthesisCollisionProxy({
      product, shaftLength, position: pose.position, quaternion: pose.quaternion,
      ancestorMatrix: coordGroupMatrixWorld,
    });
    if (proxy) testCollision(proxy, anatomyIndexStub, DRAG_COLLISION_TARGETS, identity, FOOT_CONTACT_TOLERANCE_MM);
  }

  const REPEATS = 40; // 61角度 × 40周 = 2440サンプル
  for (let rep = 0; rep < REPEATS; rep++) {
    for (const a of angles) {
      const t0 = performance.now();
      const pose = composeRotationCandidatePose({
        product, shaftLength, basePos,
        lateralOffset: 0, anteriorOffset: 0, verticalOffset: 0,
        dragOffsetX: 0, dragOffsetY: 0, dragOffsetZ: 0,
        shaftRollDeg: 0, candidateAngleTilt: a, candidateAngleTiltZ: 0,
      });
      const t1 = performance.now();
      const proxy = buildProsthesisCollisionProxy({
        product, shaftLength, position: pose.position, quaternion: pose.quaternion,
        ancestorMatrix: coordGroupMatrixWorld,
      });
      const t2 = performance.now();
      let collided = false;
      if (proxy) {
        const result = testCollision(proxy, anatomyIndexStub, DRAG_COLLISION_TARGETS, identity, FOOT_CONTACT_TOLERANCE_MM);
        collided = result.collided;
      }
      const t3 = performance.now();

      composeSamples.push(t1 - t0);
      proxySamples.push(t2 - t1);
      collisionSamples.push(t3 - t2);
      totalSamples.push(t3 - t0);
      if (collided) collidedCount++;
    }
  }

  const composeStats = computeStats(composeSamples);
  const proxyStats = computeStats(proxySamples);
  const collisionStats = computeStats(collisionSamples);
  const totalStats = computeStats(totalSamples);

  const fmt = (s: Stats) =>
    `mean=${s.meanMs.toFixed(4)}ms median=${s.medianMs.toFixed(4)}ms p95=${s.p95Ms.toFixed(4)}ms max=${s.maxMs.toFixed(4)}ms min=${s.minMs.toFixed(4)}ms (n=${s.n})`;

  console.log(`サンプル数: ${totalStats.n}（角度${angles.length}点 × ${REPEATS}周、collided=${collidedCount}件）`);
  console.log('');
  console.log('--- 内訳（1回のevaluateRotationCandidate相当呼び出しあたり） ---');
  console.log(`① composeRotationCandidatePose : ${fmt(composeStats)}`);
  console.log(`② buildProsthesisCollisionProxy: ${fmt(proxyStats)}`);
  console.log(`③ testCollision (BVH)          : ${fmt(collisionStats)}`);
  console.log(`合計（① + ② + ③）              : ${fmt(totalStats)}`);
  console.log('');
  const collisionShare = (collisionStats.meanMs / totalStats.meanMs) * 100;
  console.log(`Collision evaluation（③）が合計に占める割合: ${collisionShare.toFixed(1)}%`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
