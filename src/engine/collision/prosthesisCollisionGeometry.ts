/**
 * prosthesisCollisionGeometry.ts ── Prosthesis Collision Proxy構築（Phase C-1、Head Plate OBB修正）
 *
 * [Architect設計確定 2026-08-14] Prosthesis-Anatomy Collision Constraint。
 * Render MeshそのものではなくSimplified Collision Proxyを使う。Shaft/FootはSphere近似
 * （安全側＝多少大きめでよい、という合意のまま変更なし）。
 *
 * [Architect承認 2026-08-14 追加修正] Head PlateはSphere近似（半径headPlateDiameter/2）が
 * 過剰に大きく張り出し、Case3（症例1の正常配置、UI上「配置良好」）でも誤ってBoneと衝突判定
 * されることが単独検証で確認された。原因はHead Plateが「薄い楕円板」であるのに対しSphereは
 * 全方向に均等な近似になってしまうため。今回の目的は「安全側に大きく膨らませる」ことではなく
 * 「実際のプロステーシス形状を十分な精度で近似すること」であるため、Head Plateのみ実寸OBB
 * （Box3 + Matrix4）へ変更する。Shaft/Footは変更しない。人工的なcollision marginも追加しない。
 *
 * 寸法は ProsthesisModels.tsx の既存export定数（BELL_HEIGHT_MM/BELL_RIM_RADIUS_MM）と
 * KurzProduct.headPlateDiameter（Foot用フォールバックとしてのみ残す）に加え、BellTop()
 * （ProsthesisModels.tsx:302-422）のHead Plate実寸を below の named constants として複製する。
 * [Architect承認 2026-08-14] ProsthesisModels.tsxはFrozen対象のため変更しない方針を優先し、
 * 単一情報源化（exportへの昇格）はせず、出典コメント付きでCollision Engine側に複製する
 * （Collision Engineの独立性を保つため）。
 * ProsthesisModels.tsx 本体・Render Geometry・GLBには一切触れていない（読み取り専用import）。
 */
import * as THREE from 'three';
import { BELL_HEIGHT_MM, BELL_RIM_RADIUS_MM } from '../../scenes/models/ProsthesisModels';
import type { KurzProduct } from '../../data/products';

/**
 * BellTop() Head Plate実寸（ProsthesisModels.tsx:319「ellipsePoints(0.031574, -0.601665, 1.30, 1.80)」
 * + ProsthesisModels.tsx:422「ExtrudeGeometry(shape, { depth: 0.10 })」より複製。
 * 前回のScene Dump診断（Occlusion原因診断タスク）で実機取得したgeometry.boundingBox
 * （min=(-1.268,-2.402,0), max=(1.332,1.198,0.10)、shape-local空間）と一致することを確認済み。
 * 数値自体はProsthesisModels.tsxから一切変更していない（単なる複製、独自の推測値ではない）。
 *
 * BellTop()の<mesh rotation={[Math.PI/2,0,0]}>（shape-local (x,y,z)→headOffグループlocal
 * (x,-z,y)への写像）を適用した後の、headOffグループ基準ローカル座標系での実効寸法・中心:
 *   X（rx=1.30）        : 変化なし
 *   Y（押し出し厚さ0.10） : shape-Zが反転してYへ → 半厚0.05mm、中心は-0.05
 *   Z（ry=1.80）         : shape-Yがそのまま → 半幅1.80mm、中心は元のcy=-0.601665
 * この90°回転は軸を入れ替えるだけで傾けないため、Box3は軸並行のままoffset平行移動のみで
 * 表現できる（追加の回転行列は不要）。
 */
const BELL_TOP_HEAD_PLATE_RX_MM = 1.30;
const BELL_TOP_HEAD_PLATE_RY_MM = 1.80;
const BELL_TOP_HEAD_PLATE_THICKNESS_MM = 0.10;
const BELL_TOP_HEAD_PLATE_OFFSET_X_MM = 0.031574;
const BELL_TOP_HEAD_PLATE_OFFSET_Z_MM = -0.601665;

/** Collision判定に使う球（ワールド座標系）。 */
export interface CollisionSphere {
  center: THREE.Vector3;
  radius: number;
}

/**
 * ProsthesisCollisionProxy: Render Meshの近似（Simplified Collision Proxy）。
 * spheres: Shaft/Foot（BELL近似、変更なし）。boxes: Head Plate（BELL_TOP実寸OBB、
 * Architect承認2026-08-14でSphere近似から変更）。CollisionResultの拡張余地は
 * collisionTest.ts側で確保している（Architect指示#6）。
 */
export interface ProsthesisCollisionProxy {
  spheres: CollisionSphere[];
  boxes: { box: THREE.Box3; matrix: THREE.Matrix4 }[];
}

export interface BuildProsthesisCollisionProxyParams {
  product: KurzProduct;
  shaftLength: number;
  /** 最終ワールド位置。DraggableProsthesis/DirectTransportProsthesisが実際にレンダーへ渡す値と
   *  同じ意味（committed offsets適用後、またはドラッグ中のcandidate値）。 */
  position: THREE.Vector3;
  /**
   * 最終ワールドquaternion。computeProsthesisModelPose()の生の戻り値ではなく、
   * shaftRollDeg適用後（ProsthesisModels.tsx renderQuaternion相当）を渡すこと
   * （Architect指示#7「Collision対象は実際にRenderされる最終Quaternion」）。
   */
  quaternion: THREE.Quaternion;
}

const HEAD_SPHERE_MARGIN_MM = 0; // Head Plate Sphereフォールバック（BELL_TOP以外）用、マージンなし
const SHAFT_SPHERE_COUNT: number = 5;
const FOOT_SPHERE_COUNT = 3;

/** ローカル(0, y, 0)をワールド座標へ変換するヘルパー（ProsthesisModelのgroup合成と同じ規約）。 */
function localYToWorld(y: number, worldMatrix: THREE.Matrix4): THREE.Vector3 {
  return new THREE.Vector3(0, y, 0).applyMatrix4(worldMatrix);
}

/**
 * buildProsthesisCollisionProxy(): Candidate Poseに対するCollision Proxyを構築する純粋関数。
 * Phase 1: footType==='BELL'のみ対応（Architect指示「まずPORP BELL」）。それ以外はnullを返す。
 */
export function buildProsthesisCollisionProxy(
  params: BuildProsthesisCollisionProxyParams,
): ProsthesisCollisionProxy | null {
  const { product, shaftLength, position, quaternion } = params;

  if (product.footType !== 'BELL') {
    // Phase 1スコープ外（FLAT/CLIP/PISTON/FLEXIBAL）。Phase C-6以降で拡張。
    return null;
  }

  const len = shaftLength;
  // headOff/footOff: ProsthesisModel()と同一式（ProsthesisModels.tsx:1791-1792）。
  const headOff = len / 2 + 0.15;
  const footOff = -(len / 2);
  // shaft半径: ProsthesisModel()と同一分岐（ProsthesisModels.tsx:1842、PISTON以外は0.10mm）。
  const shaftRadius = product.type === 'PISTON' ? 0.20 : 0.10;
  // BELL: シャフト描画区間はBell apex(Y=BELL_HEIGHT_MM)起点（ProsthesisModels.tsx:1879-1882）。
  const shaftLen = Math.max(0.01, len - BELL_HEIGHT_MM);
  const shaftMidY = BELL_HEIGHT_MM / 2;

  const worldMatrix = new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(1, 1, 1));

  const spheres: CollisionSphere[] = [];

  // ── Shaft: N個の球を軸に沿って均等配置 ──
  const shaftStartY = shaftMidY - shaftLen / 2;
  for (let i = 0; i < SHAFT_SPHERE_COUNT; i++) {
    const t = SHAFT_SPHERE_COUNT === 1 ? 0.5 : i / (SHAFT_SPHERE_COUNT - 1);
    spheres.push({
      center: localYToWorld(shaftStartY + t * shaftLen, worldMatrix),
      radius: shaftRadius,
    });
  }

  // ── Foot（BellFoot近似）: rim(Y=footOff)〜apex(Y=footOff+BELL_HEIGHT_MM)を
  //    BELL_RIM_RADIUS_MM一律の球で覆う（Bell実形状は先細りだが、安全側＝リム半径一律を
  //    採用、Architect指示「初期値としては安全側を優先してよい」）。 ──
  for (let i = 0; i < FOOT_SPHERE_COUNT; i++) {
    const t = i / (FOOT_SPHERE_COUNT - 1);
    spheres.push({
      center: localYToWorld(footOff + t * BELL_HEIGHT_MM, worldMatrix),
      radius: BELL_RIM_RADIUS_MM,
    });
  }

  const boxes: { box: THREE.Box3; matrix: THREE.Matrix4 }[] = [];

  // ── Head Plate ──
  if (product.headType === 'BELL_TOP') {
    // 実寸OBB（Architect承認 2026-08-14）。Box3は中心原点のlocal boxとして定義し、
    // headOffグループ内でのoffsetはMatrix4側（headWorldMatrix）に持たせる
    // （寸法・offset・pose回転を明確に分離する、というArchitect指示に基づく構造）。
    const headBox = new THREE.Box3(
      new THREE.Vector3(-BELL_TOP_HEAD_PLATE_RX_MM, -BELL_TOP_HEAD_PLATE_THICKNESS_MM / 2, -BELL_TOP_HEAD_PLATE_RY_MM),
      new THREE.Vector3(BELL_TOP_HEAD_PLATE_RX_MM, BELL_TOP_HEAD_PLATE_THICKNESS_MM / 2, BELL_TOP_HEAD_PLATE_RY_MM),
    );
    // headWorldMatrix = (candidate pose: position+renderQuaternion) * (headOffグループ内offset)。
    // multiply()の合成順序: 点へ適用する際はoffsetTranslationが先に効き、その後worldMatrix
    // （pose回転+平行移動）が効く＝offsetもrenderQuaternionで正しく回転される。
    const headOffsetTranslation = new THREE.Matrix4().makeTranslation(
      BELL_TOP_HEAD_PLATE_OFFSET_X_MM,
      headOff - BELL_TOP_HEAD_PLATE_THICKNESS_MM / 2,
      BELL_TOP_HEAD_PLATE_OFFSET_Z_MM,
    );
    const headWorldMatrix = worldMatrix.clone().multiply(headOffsetTranslation);
    boxes.push({ box: headBox, matrix: headWorldMatrix });
  } else {
    // Phase 1スコープ外のheadType用フォールバック（現行製品カタログにfootType==='BELL'かつ
    // headType!=='BELL_TOP'は存在しないが、totalityのため残す）。従来のSphere近似。
    const headRadius = (product.headPlateDiameter ?? 3.0) / 2 + HEAD_SPHERE_MARGIN_MM;
    spheres.push({
      center: localYToWorld(headOff, worldMatrix),
      radius: headRadius,
    });
  }

  return { spheres, boxes };
}
