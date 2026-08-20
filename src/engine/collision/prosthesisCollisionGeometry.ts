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
  /**
   * [Foot-specific Contact Tolerance、Architect承認2026-08-15] どのProsthesis部位の球かを
   * collisionTest.ts側へ伝えるための識別子（任意、未指定time=従来通りの二値判定のまま）。
   * Foot #0/#1/#2 Deep Dive〜Foot Proxy Design Evaluation〜Constraint Semantics調査
   * （2026-08-15、project_kurz_collision_constraintメモリ参照）で、既存Placement Scoring
   * （useSimStore.ts computeScore()）がFoot-底板接触を理想状態として設計している一方、
   * Collision Constraintは幾何学的交差を一律forbiddenとしており、両者の意味論が矛盾して
   * いることが確認された。Shaft/HeadはこのTolerance適用対象外（従来のintersects即NG判定を
   * 維持、C-2で安定しているCollision Constraintを変更しないため）。
   */
  role?: 'shaft' | 'foot' | 'head';
}

/**
 * [Diagnostic / Provisional Contact Tolerance、Architect承認2026-08-15]
 * Foot球のみに適用する、Bone表面への許容貫入深度（mm）。collisionTest.ts側で
 * role==='foot'の球についてのみ、単純な交差判定（intersectsSphere）ではなく
 * 「貫入深度がこの値を超えたらcollided」という深度考慮判定に切り替えるために使う。
 *
 * 重要: これは臨床的に正しいと確認された安全閾値ではない。Penetration Threshold Evidence
 * Study（2026-08-15、project_kurz_collision_constraintメモリ参照）で、Placement Scoringの
 * 位置偏差バンド（0.3/0.6/1.0mm）・既存設計文書・Candidate B実測値のいずれからも、臨床的に
 * 妥当な閾値をEvidenceのみから導出することはできないと確認済み。Architect指示により、
 * 「値そのものを最終値と扱わない」ことを明示した上でのDiagnostic Parameterとして、
 * C-2のCollisionBoundaryWarpTracker（CollisionVerifyOverlay.tsx）が既に使っている
 * marginMm=0.15（境界からの安全側オフセット、同じCollision Constraint機能ファミリー内の
 * 既存precedent）に倣った暫定初期値を置く。実機検証の結果を見ながら、Architectが数値のみを
 * 更新する前提（Foot Proxy geometry自体・Collision Engine構造には触れない）。
 */
export const FOOT_CONTACT_TOLERANCE_MM = 0.15;

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
  /**
   * [Phase C-3 STEP3/Phase B、Architect承認2026-08-15] position/quaternionは
   * SimScene.tsxのcoordGroupRef（rotation=[π,-π/2,0]）配下のローカル座標系の値であり、
   * それ自体はまだWorld Spaceではない。呼び出し側が実際のScene Graphから取得した
   * coordGroupRef.matrixWorldをそのまま渡すこと（固定値のハードコードはしない、
   * Ground Truth Transform Investigation STEP3で実測・確定済み）。
   */
  ancestorMatrix: THREE.Matrix4;
}

const HEAD_SPHERE_MARGIN_MM = 0; // Head Plate Sphereフォールバック（BELL_TOP以外）用、マージンなし
const SHAFT_SPHERE_COUNT: number = 5;
const FOOT_SPHERE_COUNT = 3;

/**
 * [Candidate B、Architect承認2026-08-15、Geometry-derived Diagnostic Candidate]
 * Foot sphere（rim→apex、i=0〜2）個別半径。STEP 4A〜4C（実Bell Foot形状とProxyの形状差を
 * 数学的に算出）で導出した値をそのまま使用する。#0（rim側）はBELL_RIM_RADIUS_MMと同一
 * （実測リム半径と一致するため変更理由なし）。#1/#2はBell Footが先細りする実形状を反映した
 * 縮小値（#2=apex側が最も縮小、24.2%）。
 *
 * 重要: これは最終確定値ではない。Safety Marginを含まない幾何学的最小値（Architect指示
 * 「Safety Marginは今回まだ設定しない」）であり、実機でRotation Collision Constraintの
 * 挙動（過剰拘束が解消されるか、Collision方向で正しく停止するか、Boneへの明らかな
 * 突き抜けが発生しないか）を検証するためのDiagnostic Candidateとして扱う。
 */
const CANDIDATE_B_FOOT_SPHERE_RADII_MM: readonly number[] = [BELL_RIM_RADIUS_MM, 0.7704, 0.6028];

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
  const { product, shaftLength, position, quaternion, ancestorMatrix } = params;

  if (product.footType !== 'BELL') {
    // Phase 1スコープ外（FLAT/CLIP/PISTON/FLEXIBAL）。Phase C-6以降で拡張。
    return null;
  }

  const len = shaftLength;
  // headOff/footOff: ProsthesisModel()と同一式（ProsthesisModels.tsx:1791-1798）。
  // [R4 Geometry Migration、Architect Approved] Group origin(position引数、
  // resolveCanonicalPose()の出力)がR1(shaft midpoint)からR4(Anatomical/Foot Contact
  // Anchor)へ変わったことに伴う原点平行移動(+shaftLength/2)。相対距離(headOff-footOff=
  // len+0.15)は不変。Candidate Bのradius校正はBellFoot内部のlocal Y(rim=0〜apex=
  // BELL_HEIGHT_MM)に基づくtranslation-invariantな形状比較のため、本Migrationによる
  // 再校正は不要（docs/Phase_C5_Foot_Collision_Representation_Investigation_v1.0.md
  // Section 3-4参照、Architect確認済み）。
  const headOff = len + 0.15;
  const footOff = 0;
  // shaft半径: ProsthesisModel()と同一分岐（ProsthesisModels.tsx:1842、PISTON以外は0.10mm）。
  const shaftRadius = product.type === 'PISTON' ? 0.20 : 0.10;
  // BELL: シャフト描画区間はBell apex(Y=BELL_HEIGHT_MM)起点（ProsthesisModels.tsx:1879-1882）。
  const shaftLen = Math.max(0.01, len - BELL_HEIGHT_MM);
  // [R4 Geometry Migration Shaft Fix、Architect Decision承認: docs/D4_Shaft_Geometry_R4_
  // Migration_Architect_Decision_v1.0.md] 旧shaftMidY=BELL_HEIGHT_MM/2はfootOff=-(len/2)
  // （R1）でのみ数式的に成立する値だった（footOffを一切参照しない決め打ち）。一般式
  // footOff + BELL_HEIGHT_MM + shaftLen/2（P2_Measurement_Definition_v1.0.mdの
  // 「anchor〜Bell apex=BELL_HEIGHT_MM」+「Bell apex〜Head Plate側=shaftLen」から導出）へ
  // 修正。footOff=0（R4）代入でBELL_HEIGHT_MM/2+shaftLength/2と数値的に一致。ProsthesisModels.tsx
  // 側shaftYと同一式・同一理由。Candidate B radii/FOOT_CONTACT_TOLERANCE_MMは無変更（Foot球
  // 配置式はfootOffのみを参照し、shaftMidYと独立）。
  const shaftMidY = footOff + BELL_HEIGHT_MM + shaftLen / 2;

  // [Phase C-3 STEP3/Phase B] position/quaternionはcoordGroupRefローカル系の値のため、
  // ancestorMatrix（呼び出し側が渡すcoordGroupRef.matrixWorld）を先に乗じてから使う。
  // ancestorMatrixを書き換えないようclone()してからmultiply()する。
  const worldMatrix = ancestorMatrix
    .clone()
    .multiply(new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(1, 1, 1)));

  const spheres: CollisionSphere[] = [];

  // ── Shaft: N個の球を軸に沿って均等配置 ──
  const shaftStartY = shaftMidY - shaftLen / 2;
  for (let i = 0; i < SHAFT_SPHERE_COUNT; i++) {
    const t = SHAFT_SPHERE_COUNT === 1 ? 0.5 : i / (SHAFT_SPHERE_COUNT - 1);
    spheres.push({
      center: localYToWorld(shaftStartY + t * shaftLen, worldMatrix),
      radius: shaftRadius,
      role: 'shaft',
    });
  }

  // ── Foot（BellFoot近似）: rim(Y=footOff)〜apex(Y=footOff+BELL_HEIGHT_MM)を、
  //    Candidate B（STEP 4A〜4C由来、上記CANDIDATE_B_FOOT_SPHERE_RADII_MM参照）の
  //    球ごと個別半径で覆う。2026-08-15まではBELL_RIM_RADIUS_MM一律だったが、Rotation
  //    Candidate CollisionをProxy要素別に分解した結果Foot#0〜#2のみが全candidateで
  //    collided:trueとなることが実機で確認され、Architect承認によりCandidate Bへ変更。 ──
  for (let i = 0; i < FOOT_SPHERE_COUNT; i++) {
    const t = i / (FOOT_SPHERE_COUNT - 1);
    spheres.push({
      center: localYToWorld(footOff + t * BELL_HEIGHT_MM, worldMatrix),
      radius: CANDIDATE_B_FOOT_SPHERE_RADII_MM[i],
      role: 'foot',
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
      role: 'head',
    });
  }

  return { spheres, boxes };
}
