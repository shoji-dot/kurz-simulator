/**
 * scenes/debug/CollisionVerifyOverlay.tsx ── Collision Engine 単独検証Overlay（Phase C-1）
 *
 * [Architect指示 2026-08-14] 「特に最初のC-1では、まだManipulation LayerにCollision処理を
 * 入れない方がよい。まず、anatomyCollisionIndex / prosthesisCollisionGeometry / collisionTest
 * だけを実装し、『既存Bone Meshに対して、PORP Bell Proxyが衝突したと正しく判定できる』ところ
 * まで単独検証する」に対応する一時計装。
 *
 * DraggableProsthesis / DirectTransportProsthesis / TransportProsthesis / ManipulationLayer /
 * TransformControls / TransportControls / useScreenSpaceDrag には一切触れない・接続しない。
 * ?debug=collision 時のみマウントされる、完全に独立した検証専用オーバーレイ。
 *
 * 既存のCoordinateDebugOverlay.tsx/SceneDumpOverlay.tsxと同じ設計方針（Canvas外側HTMLパネル
 * + Canvas内Tracker、ボタン押下時のみ実行）を踏襲する。
 *
 * 検証ケース（3件、いずれもfootType==='BELL'のTTP-VARIAC PORP、shaftLength=2.5mm想定）:
 *   1. Far away（Anatomyから十分離れた位置）    → collided=false を期待
 *   2. Bone内部の点（insideTestで自動探索）      → collided=true  を期待
 *   3. 症例1の通常配置（basePos=STAPES_HEAD）    → collided=false を期待（False Positive確認）
 */
import { useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { RefObject } from 'react';
import { useAnatomyCollisionIndex } from '../../engine/collision/anatomyCollisionIndex';
import { buildProsthesisCollisionProxy } from '../../engine/collision/prosthesisCollisionGeometry';
import { testCollision } from '../../engine/collision/collisionTest';
import { createMeshInsideTest } from '../../engine/volumeSource';
import { computeProsthesisModelPose } from '../models/ProsthesisModels';
import { STAPES_HEAD } from '../models/OssicleModels';
import { kurzProducts } from '../../data/products';
import type { KurzProduct } from '../../data/products';

const TEST_PRODUCT = kurzProducts.find((p) => p.id === 'porp-ttp-variac');
const TEST_SHAFT_LENGTH_MM = 2.5;

export interface CollisionVerifyCaseResult {
  label: string;
  expectedCollided: boolean;
  actualCollided: boolean | null; // null = 実行不可（内部点探索失敗等）
  pass: boolean;
  detail: string;
}

function findFirstMesh(scene: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  scene.traverse((child) => {
    if (found) return;
    if ((child as THREE.Mesh).isMesh) found = child as THREE.Mesh;
  });
  return found;
}

/** Bone worldGeometry内部にある点を、いくつかの候補戦略から自動探索する（診断・検証専用）。 */
function findPointInsideBone(boneScene: THREE.Object3D, worldTransform: THREE.Matrix4): { point: THREE.Vector3; strategy: string } | null {
  const mesh = findFirstMesh(boneScene);
  if (!mesh) return null;

  const worldGeo = mesh.geometry.clone();
  worldGeo.applyMatrix4(worldTransform);
  worldGeo.computeBoundingBox();
  worldGeo.computeBoundingSphere();
  const insideTest = createMeshInsideTest(worldGeo);

  const candidates: [string, THREE.Vector3][] = [];
  if (worldGeo.boundingSphere) candidates.push(['boundingSphere.center', worldGeo.boundingSphere.center.clone()]);
  if (worldGeo.boundingBox) candidates.push(['boundingBox.center', worldGeo.boundingBox.getCenter(new THREE.Vector3())]);

  const pos = worldGeo.attributes.position;
  if (pos) {
    const centroid = new THREE.Vector3();
    const step = Math.max(1, Math.floor(pos.count / 500));
    let n = 0;
    for (let i = 0; i < pos.count; i += step) {
      centroid.add(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
      n += 1;
    }
    if (n > 0) {
      centroid.divideScalar(n);
      candidates.push(['vertexCentroidSample', centroid]);
    }
  }

  for (const [strategy, point] of candidates) {
    if (insideTest(point)) return { point, strategy };
  }
  return null;
}

function runVerification(
  anatomyIndex: ReturnType<typeof useAnatomyCollisionIndex>,
  boneSceneForProbe: THREE.Object3D,
  anatomyRoot: THREE.Object3D,
): CollisionVerifyCaseResult[] {
  const results: CollisionVerifyCaseResult[] = [];
  if (!TEST_PRODUCT) {
    return [{ label: 'setup', expectedCollided: false, actualCollided: null, pass: false, detail: 'porp-ttp-variac 製品データが見つかりません' }];
  }

  anatomyRoot.updateWorldMatrix(true, false);
  const worldTransform = anatomyRoot.matrixWorld.clone();

  // ── Case 1: Far away（衝突しないはず） ──
  {
    const proxy = buildProsthesisCollisionProxy({
      product: TEST_PRODUCT, shaftLength: TEST_SHAFT_LENGTH_MM,
      position: new THREE.Vector3(100, 100, 100), quaternion: new THREE.Quaternion(),
    });
    const result = proxy ? testCollision(proxy, anatomyIndex, ['bone'], worldTransform) : null;
    results.push({
      label: 'Case1: Far away (100,100,100)',
      expectedCollided: false,
      actualCollided: result?.collided ?? null,
      pass: result?.collided === false,
      detail: result ? JSON.stringify(result) : 'proxy未生成（footType!==BELL）',
    });
  }

  // ── Case 2: Boneの内部点（衝突するはず） ──
  {
    const inside = findPointInsideBone(boneSceneForProbe, worldTransform);
    if (!inside) {
      results.push({
        label: 'Case2: Bone内部点',
        expectedCollided: true, actualCollided: null, pass: false,
        detail: '内部点の自動探索に失敗（候補すべてinsideTest=false）',
      });
    } else {
      const proxy = buildProsthesisCollisionProxy({
        product: TEST_PRODUCT, shaftLength: TEST_SHAFT_LENGTH_MM,
        position: inside.point, quaternion: new THREE.Quaternion(),
      });
      const result = proxy ? testCollision(proxy, anatomyIndex, ['bone'], worldTransform) : null;
      results.push({
        label: `Case2: Bone内部点 (via ${inside.strategy})`,
        expectedCollided: true,
        actualCollided: result?.collided ?? null,
        pass: result?.collided === true,
        detail: JSON.stringify({ point: inside.point.toArray(), result }),
      });
    }
  }

  // ── Case 3: 症例1相当の通常配置（False Positive確認、衝突しないはず） ──
  {
    const pose = computeProsthesisModelPose({
      product: TEST_PRODUCT, shaftLength: TEST_SHAFT_LENGTH_MM,
      basePos: STAPES_HEAD.clone(), angleTilt: 0, angleTiltZ: 0,
    });
    const proxy = buildProsthesisCollisionProxy({
      product: TEST_PRODUCT, shaftLength: TEST_SHAFT_LENGTH_MM,
      position: pose.position, quaternion: pose.quaternion,
    });
    const result = proxy ? testCollision(proxy, anatomyIndex, ['bone'], worldTransform) : null;
    // 診断用: どのsphere（shaft/foot）・box（head、OBB化後）が衝突しているかを個別に調べる
    // （collisionTest.ts本体は変更せず、検証ハーネス内でindex.getBvh()を直接呼ぶだけ）。
    let sphereDetail = '';
    if (proxy) {
      const bvh = anatomyIndex.getBvh('bone', worldTransform);
      const perSphere = proxy.spheres.map((s, i) => ({
        i,
        part: i < 5 ? 'shaft' : 'foot',
        radius: s.radius,
        worldPos: s.center.toArray().map((v) => Number(v.toFixed(3))),
        hit: bvh ? bvh.intersectsSphere(new THREE.Sphere(s.center, s.radius)) : null,
      }));
      const perBox = proxy.boxes.map((b, i) => ({
        i, part: 'head',
        hit: bvh ? bvh.intersectsBox(b.box, b.matrix) : null,
      }));
      sphereDetail = ` spheres=${JSON.stringify(perSphere)} boxes=${JSON.stringify(perBox)}`;
    }
    results.push({
      label: 'Case3: 症例1通常配置 (basePos=STAPES_HEAD, angleTilt=0)',
      expectedCollided: false,
      actualCollided: result?.collided ?? null,
      pass: result?.collided === false,
      detail: (result ? JSON.stringify(result) : 'proxy未生成') + sphereDetail,
    });
  }

  return results;
}

interface CollisionVerifyTrackerProps {
  anatomyRootRef: RefObject<THREE.Object3D | null>;
  verifyRequestId: number;
  onResults: (results: CollisionVerifyCaseResult[]) => void;
}

/** Canvas内部: ?debug=collision時のみマウント。ManipulationLayer/TransformControls等には
 *  一切依存しない、完全に独立した検証コンポーネント。 */
export function CollisionVerifyTracker({ anatomyRootRef, verifyRequestId, onResults }: CollisionVerifyTrackerProps) {
  const anatomyIndex = useAnatomyCollisionIndex();
  const { scene: boneSceneForProbe } = useGLTF('/models/Bone.glb');
  const lastRequestId = useRef(0);

  useEffect(() => {
    if (verifyRequestId === lastRequestId.current) return;
    lastRequestId.current = verifyRequestId;
    const anatomyRoot = anatomyRootRef.current;
    if (!anatomyRoot) return;

    const results = runVerification(anatomyIndex, boneSceneForProbe, anatomyRoot);
    console.table(results.map((r) => ({ label: r.label, expected: r.expectedCollided, actual: r.actualCollided, pass: r.pass })));
    console.log('[CollisionVerify]', results);
    onResults(results);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyRequestId]);

  return null;
}

interface CollisionVerifyPanelProps {
  zIndex: number;
  onRequestVerify: () => void;
  results: CollisionVerifyCaseResult[] | null;
}

/** Canvas外側: ボタン + 結果表示パネル。 */
export function CollisionVerifyPanel({ zIndex, onRequestVerify, results }: CollisionVerifyPanelProps) {
  return (
    <div
      style={{
        position: 'absolute', bottom: 8, right: 8, zIndex,
        background: 'rgba(0,0,0,0.82)', color: '#ffd8d8',
        fontFamily: 'monospace', fontSize: 10, padding: '8px 10px',
        borderRadius: 4, whiteSpace: 'pre-wrap', lineHeight: 1.5,
        userSelect: 'text', width: 360, maxHeight: '50vh', overflow: 'auto',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ color: '#fff', fontWeight: 700, marginBottom: 4 }}>
        Collision Engine 単独検証（Phase C-1、Manipulation Layer非接続）
      </div>
      <button
        type="button"
        onClick={onRequestVerify}
        style={{
          fontFamily: 'monospace', fontSize: 10, padding: '2px 8px', marginBottom: 6,
          cursor: 'pointer', background: '#2a2a2a', color: '#7fd3ff',
          border: '1px solid #555', borderRadius: 3,
        }}
      >
        Run Verification
      </button>
      {results ? (
        <div>
          {results.map((r, i) => (
            <div key={i} style={{ marginBottom: 6, color: r.pass ? '#8fe08f' : '#ff8888' }}>
              {r.pass ? '✓ PASS' : '✗ FAIL'} — {r.label}
              <div style={{ color: '#999', fontSize: 9 }}>
                expected={String(r.expectedCollided)} actual={String(r.actualCollided)}
              </div>
              <div style={{ color: '#777', fontSize: 9, wordBreak: 'break-all' }}>{r.detail}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: '#888' }}>未実行（Run Verificationを押してください）</div>
      )}
    </div>
  );
}

/**
 * ── Collision Boundary Warp（Phase C-2実機検証、一時的なテスト専用機能） ──
 *
 * [Architect依頼 2026-08-14] Phase C-2実機検証のQuestion 1（Release後の最終停止位置が
 * Bone外側/内部いずれかのA/B判定）を行うには、「側頭骨の外側・Collision発生直前（まだ
 * 非衝突）」という開始Poseが必要。既存の「[TEST] 理想位置で配置を強制確定」ボタンは
 * 理想位置（Bone内部相当）へ直接ワープするため、「外側から近づいて止まる」挙動自体を
 * 再現できない。この検証専用開始Poseを二分探索で機械的に求める。
 *
 * DraggableProsthesis本体・useScreenSpaceDrag・ManipulationLayer.tsx・本番の初期値/
 * 理想位置ワープ機能には一切触れない。ここで使うCollision判定（buildProsthesisCollisionProxy
 * /testCollision/useAnatomyCollisionIndex、いずれもPhase C-1で実装済みの既存関数）は
 * DraggableProsthesis.evaluateDragCandidateと同一の関数を同一のanatomyRootRefで呼ぶのみで、
 * 判定ロジック自体を複製してはいない（computeProsthesisModelPose自体もFrozen、無変更）。
 */
export interface CollisionBoundaryWarpTrackerProps {
  anatomyRootRef: RefObject<THREE.Object3D | null>;
  /** ボタン押下のたびにインクリメントされる値（CollisionVerifyTrackerのverifyRequestIdと同じ
   *  bump pattern）。0のときは初期状態として何もしない。 */
  warpRequestId: number;
  product: KurzProduct;
  basePos: THREE.Vector3;
  shaftLength: number;
  /** 探索方向の目安として症例のidealLateralOffsetを使う（符号・大まかな距離のみ利用）。 */
  idealLateralOffset: number;
  /** 見つかった境界直前のlateralOffsetをPlacementStateへ確定する（呼び出し元がupdatePlacement
   *  等を行う。ここではCollision Engineの計算のみを行い、Store書き込みは一切行わない）。 */
  onWarp: (lateralOffset: number) => void;
  onResult: (message: string, success: boolean) => void;
}

/** Canvas内部: SimSceneから渡されたwarpRequestIdが変化した回のみ1回だけ探索を実行する。 */
export function CollisionBoundaryWarpTracker({
  anatomyRootRef, warpRequestId, product, basePos, shaftLength, idealLateralOffset,
  onWarp, onResult,
}: CollisionBoundaryWarpTrackerProps) {
  const anatomyIndex = useAnatomyCollisionIndex();
  const lastRequestId = useRef(0);

  // UI側のステータス表示がタイミングにより見えないケースがあっても追跡できるよう、
  // 常にconsoleへも同じメッセージを出す（実機確認2026-08-14で発覚、UI表示不具合とは独立の保険）。
  const report = (message: string, success: boolean) => {
    if (success) console.log(message); else console.warn(message);
    onResult(message, success);
  };

  useEffect(() => {
    if (warpRequestId === lastRequestId.current) return;
    lastRequestId.current = warpRequestId;
    if (warpRequestId === 0) return;

    console.log('[CollisionBoundaryWarp] 探索を開始します。', { warpRequestId, product: product.id, basePos: basePos.toArray(), idealLateralOffset });

    const anatomyRoot = anatomyRootRef.current;
    if (!anatomyRoot) {
      report('[CollisionBoundaryWarp] anatomyRootRef未取得のため中止しました。', false);
      return;
    }
    anatomyRoot.updateWorldMatrix(true, false);
    const worldTransform = anatomyRoot.matrixWorld.clone();

    // lateralOffset以外は0固定（anteriorOffset/verticalOffset/angleTilt/angleTiltZ=0、
    // dragLocalDeltaに相当する項もなし）の静的Candidate Poseで衝突判定する。
    const testAt = (lateralOffset: number): boolean => {
      const pose = computeProsthesisModelPose({
        product, shaftLength, basePos,
        lateralOffset, anteriorOffset: 0, verticalOffset: 0, angleTilt: 0, angleTiltZ: 0,
      });
      const proxy = buildProsthesisCollisionProxy({
        product, shaftLength, position: pose.position, quaternion: pose.quaternion,
      });
      if (!proxy) return false;
      return testCollision(proxy, anatomyIndex, ['bone'], worldTransform).collided;
    };

    if (testAt(0)) {
      report('[CollisionBoundaryWarp] lateralOffset=0（初期位置）が既に衝突しています。境界探索を中止しました。', false);
      return;
    }

    // Step1: idealLateralOffset方向（符号のみ利用）へ倍率を広げながら、実際に衝突する
    // lateralOffsetを1つ見つける（見つからなければ逆方向も試す）。
    //
    // [2026-08-14実機確認で発覚・修正] ワープ後にBoneから逆方向へドラッグし切って離すと、
    // 元の(鼓膜と被る)配置へ戻ってしまう現象を確認。原因は、このWarpがlateralOffset経由で
    // 開始Poseを置くのに対し、DraggableProsthesisの通常ドラッグはPlacement Drag本体が既に
    // 持つ±3mmのdragOffsetX/Y/Zクランプ（clamp3、Collision Constraintとは無関係の既存仕様、
    // SimScene.tsx参照）の範囲内でしか位置を確定できないこと。idealLateralOffset===0の症例では
    // baseMag=5・multiplier最大10倍で候補が±50mmまで広がり得て、見つかった境界がこの±3mm予算を
    // 超えてしまうと「逆方向へドラッグでは元の位置まで戻り切れない」状態になる。
    // 対策: 探索候補の絶対値をABS_SEARCH_LIMIT_MM以内に制限し、見つかる境界は常に
    // 逆方向ドラッグ（最大でも境界からlateralOffset=0までの距離）が既存の±3mmクランプの
    // 範囲内に収まることを保証する（0.5mmの安全マージンを残す）。
    const ABS_SEARCH_LIMIT_MM = 2.5;
    const dir = idealLateralOffset !== 0 ? Math.sign(idealLateralOffset) : 1;
    const baseMag = Math.abs(idealLateralOffset) || 5;
    const multipliers = [1, 1.3, 1.6, 2, 2.5, 3, 4, 5, 7, 10];

    let collideOffset: number | null = null;
    for (const trySign of [dir, -dir]) {
      for (const m of multipliers) {
        const candidate = trySign * baseMag * m;
        if (Math.abs(candidate) > ABS_SEARCH_LIMIT_MM) break; // これ以遠は±3mmクランプ内で逆方向へ脱出できない
        if (testAt(candidate)) { collideOffset = candidate; break; }
      }
      if (collideOffset !== null) break;
    }

    if (collideOffset === null) {
      report(`[CollisionBoundaryWarp] lateralOffset=±${ABS_SEARCH_LIMIT_MM}mm以内で探索しましたが、Boneと衝突する位置が見つかりませんでした（既存Placement Dragの±3mmクランプ内で逆方向脱出できる範囲に探索を制限しているため）。`, false);
      return;
    }

    // Step2: safe(lateralOffset=0、非衝突) ⇔ collideOffset（衝突）の間を二分探索し、
    // 境界（非衝突側の最も衝突に近い値）を追い込む。
    let safeT = 0;
    let collideT = 1;
    const offsetAt = (t: number) => t * (collideOffset as number);
    for (let i = 0; i < 24; i++) {
      const midT = (safeT + collideT) / 2;
      if (testAt(offsetAt(midT))) collideT = midT; else safeT = midT;
    }

    // Step3: 境界からさらに0.15mm分だけ安全側（非衝突側）へ戻し、「Collision発生直前・
    // まだ非衝突」という開始Poseにする。
    const boundaryOffset = offsetAt(safeT);
    const marginMm = 0.15;
    const towardCollideSign = Math.sign(collideOffset);
    let finalOffset = boundaryOffset - towardCollideSign * marginMm;
    if (testAt(finalOffset)) {
      // 想定外（境界近傍の非単調な形状等）。安全側フォールバックとしてlateralOffset=0を採用する。
      finalOffset = 0;
      report('[CollisionBoundaryWarp] マージン適用後も衝突判定のため、安全側フォールバック(lateralOffset=0)を採用しました。', true);
    } else {
      report(
        `[CollisionBoundaryWarp] 境界探索完了: collideOffset=${collideOffset.toFixed(3)}mm, boundary=${boundaryOffset.toFixed(3)}mm, warp先=${finalOffset.toFixed(3)}mm（境界から${marginMm}mm安全側）`,
        true,
      );
    }
    onWarp(finalOffset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warpRequestId]);

  return null;
}
