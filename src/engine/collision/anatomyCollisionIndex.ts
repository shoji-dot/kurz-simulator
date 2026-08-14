/**
 * anatomyCollisionIndex.ts ── Anatomy側 Collision BVH構築・キャッシュ（Phase C-1）
 *
 * [Architect設計確定 2026-08-14] Anatomy側はOriginal GLB MeshにMeshBVHをかぶせる方式。
 * three-mesh-bvhは既存dependency（package.json記載済み）をそのまま使用、新規npm dependency
 * 追加なし。src/engine/volumeSource.ts の既存実装（Bone.glb用MeshBVH、Voxel削開機能向け）と
 * 同じ「ワールド座標系にベイク済みのBufferGeometryを渡す」流儀を踏襲する。
 *
 * RealAnatomyModels.tsxは一切変更しない。GLBは同ファイルとは独立に本ファイルから
 * useGLTF()で読み込むが、@react-three/dreiのuseGLTFはURLキーのグローバルキャッシュを持つため
 * （RealAnatomyModels.tsxが既にuseGLTF.preload()している対象と同一）、二重ダウンロード・
 * 二重パースは発生しない。
 *
 * Phase 1対象: Bone / Malleus / Stapes のみ（Architect指示、Incusは別Issue）。
 *
 * worldTransform（Anatomy GLBローカル→ワールド変換）は、呼び出し側がSimScene.tsxの実際の
 * シーングラフ（anatomyGroupRefのmatrixWorld等）から取得して渡す設計とする。Anatomyは症例中
 * 静止のため、初回構築後はkey単位でキャッシュし、以降は再構築しない
 * （volumeSource.tsと同じ「BVH構築は重いので1回だけ」という設計判断）。
 * matrixWorldをレンダー中に読むとreact-hooks/refs違反になるため、getBvh()は
 * イベントハンドラ/エフェクト内から呼ぶこと（レンダー中に呼ばない）。
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { MeshBVH } from 'three-mesh-bvh';

export type AnatomyCollisionKey = 'bone' | 'malleus' | 'stapes';

const ANATOMY_GLB_URL: Record<AnatomyCollisionKey, string> = {
  bone: '/models/Bone.glb',
  malleus: '/models/Malleus.glb',
  stapes: '/models/Stapes.glb',
};

/** モジュールスコープキャッシュ。Anatomyは静止のため、key単位で最初の1回だけ構築する。 */
const bvhCache = new Map<AnatomyCollisionKey, MeshBVH>();

/** worldGeometryCache: 検証・診断用にベイク済みgeometryも保持しておく（insideTest等の
 *  補助検証で再利用できるよう、任意）。テスト目的でのみ使用、Collision本体はBVHのみ参照。 */
const worldGeometryCache = new Map<AnatomyCollisionKey, THREE.BufferGeometry>();

function findFirstMesh(scene: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  scene.traverse((child) => {
    if (found) return;
    if ((child as THREE.Mesh).isMesh) found = child as THREE.Mesh;
  });
  return found;
}

function buildBvh(key: AnatomyCollisionKey, scene: THREE.Object3D, worldTransform: THREE.Matrix4): MeshBVH | null {
  const cached = bvhCache.get(key);
  if (cached) return cached;

  const mesh = findFirstMesh(scene);
  if (!mesh) {
    console.warn(`[anatomyCollisionIndex] ${key}: メッシュが見つかりません（GLB構造想定外）`);
    return null;
  }

  // ワールド座標系へベイク（volumeSource.tsと同じ流儀）。元のuseGLTFキャッシュ済みgeometryは
  // 変更せず、clone()してから変換する（RealAnatomyModels.tsx側の描画に一切影響しない）。
  const worldGeometry = mesh.geometry.clone();
  worldGeometry.applyMatrix4(worldTransform);

  const bvh = new MeshBVH(worldGeometry);
  bvhCache.set(key, bvh);
  worldGeometryCache.set(key, worldGeometry);
  return bvh;
}

export interface AnatomyCollisionIndex {
  /**
   * getBvh(): 指定されたAnatomyのMeshBVHを取得する（初回のみ構築、以降キャッシュを返す）。
   * worldTransformはAnatomyの現在のmatrixWorld（呼び出し側で取得済みのものを渡す）。
   * レンダー関数の本体からではなく、イベントハンドラ/エフェクト内から呼ぶこと。
   */
  getBvh(key: AnatomyCollisionKey, worldTransform: THREE.Matrix4): MeshBVH | null;
  /** 診断・検証用: ベイク済みworld-space geometryを取得する（getBvh呼び出し後のみ非null）。 */
  getWorldGeometry(key: AnatomyCollisionKey): THREE.BufferGeometry | null;
}

/**
 * useAnatomyCollisionIndex(): Bone/Malleus/StapesのGLBロード（Suspense）を保証しつつ、
 * BVH取得用のimperative accessorを返すフック。GLBロード自体はレンダー中に安全に行える
 * （useGLTFの通常の使い方）が、BVH構築に必要なworldTransformはレンダー外から渡される前提。
 */
export function useAnatomyCollisionIndex(): AnatomyCollisionIndex {
  const { scene: boneScene } = useGLTF(ANATOMY_GLB_URL.bone);
  const { scene: malleusScene } = useGLTF(ANATOMY_GLB_URL.malleus);
  const { scene: stapesScene } = useGLTF(ANATOMY_GLB_URL.stapes);

  // useGLTFのシーンはdreiの内部キャッシュにより参照安定（同一URLなら再ロード後も同一
  // オブジェクト）のため、refを使わずuseMemoの依存配列にそのまま含める
  // （react-hooks/refs: レンダー中のref書き込みを避けるため）。
  const scenes: Record<AnatomyCollisionKey, THREE.Object3D> = useMemo(
    () => ({ bone: boneScene, malleus: malleusScene, stapes: stapesScene }),
    [boneScene, malleusScene, stapesScene],
  );

  return useMemo<AnatomyCollisionIndex>(() => ({
    getBvh: (key, worldTransform) => buildBvh(key, scenes[key], worldTransform),
    getWorldGeometry: (key) => worldGeometryCache.get(key) ?? null,
  }), [scenes]);
}

useGLTF.preload(ANATOMY_GLB_URL.bone);
useGLTF.preload(ANATOMY_GLB_URL.malleus);
useGLTF.preload(ANATOMY_GLB_URL.stapes);
