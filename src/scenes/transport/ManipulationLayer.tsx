/**
 * ManipulationLayer.tsx ── Phase1 Interaction/Transport Layer
 * （External Prosthesis → Instrument Select → Grasp → Hold/Transport → Release）
 *
 * Strangler Pattern: 既存Placement System（PlacementState + DraggableProsthesis +
 * TransformControls/矢印キー/ControlPad + Safety/Score）の外側に薄く追加するレイヤー。
 * このモジュールが扱うのは「Release（Commit）されるまでの一時的な自由position」のみで、
 * PlacementStateのフィールド・意味・クランプ範囲には一切触れない。
 *
 * 状態はここでは意図的に最小: transportPose（position + quaternion）と
 * ManipulationState（instrumentSelected/isGrasped/committed の3フラグ）のみ。
 * committed=true になった時点でこのモジュールの役目は終わり、以降の描画は完全に既存の
 * DraggableProsthesis経路（無変更）へ戻る（呼び出し側 SimScene.tsx が分岐する）。
 *
 * 将来のAC Sizer/Measurement Adapterとは意図的にコードパスを共有しない別モジュール
 * （設計指示: 「新規Layerは実質Manipulation Adapter1層のみ、新規Store API不要」）。
 */

import { useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { TransformControls } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { ProsthesisModel } from '../models/ProsthesisModels';
import type { KurzProduct } from '../../data/products';
import { TRANSLATION_SNAP_MM } from '../transformControlsConfig';

/** Transport段階の一時pose。PlacementStateとは無関係の独立した自由position（アンクランプ）。 */
export interface TransportPose {
  position:   THREE.Vector3;
  quaternion: THREE.Quaternion;
}

/** Instrument Select → Grasp → Release の3フラグのみ。DragMode（move/view）とは別軸で、
 *  「新規Modeレイヤーを作らずisGrasped+committedから導出する」という設計方針どおり最小構成。 */
export interface ManipulationState {
  instrumentSelected: boolean;
  isGrasped:           boolean;
  /** Release/Commitが実行済みか。true以降は既存DraggableProsthesis経路のみが描画される。 */
  committed:            boolean;
}

export const INITIAL_MANIPULATION_STATE: ManipulationState = {
  instrumentSelected: false,
  isGrasped:           false,
  committed:            false,
};

/**
 * Case開始時の「外部（術野の外）」初期Transport位置。
 * Phase1の暫定値: basePos（アブミ骨頭 or 底板、症例別に既に確定済みのアンカー）から見て
 * 斜め上外側に離した、3Dシーン上ではっきり解剖構造の外に見える座標を選んだだけであり、
 * 臨床的な意味・実測値は一切含まない（表示上の視認性のみを基準にした任意choiceであることを
 * 明記する）。既存のSoft Clip dev previewが basePos.x±10 のような離れたオフセットで単独表示
 * している前例（SimScene.tsx L1221, L1232）にならった値。
 */
export function createInitialTransportPose(basePos: THREE.Vector3): TransportPose {
  return {
    position: new THREE.Vector3(basePos.x + 12, basePos.y + 9, basePos.z + 6),
    quaternion: new THREE.Quaternion(), // identity — Phase1では向きの意味付けは対象外
  };
}

const ZERO_VEC     = new THREE.Vector3(0, 0, 0);
const IDENTITY_QUAT = new THREE.Quaternion();

/**
 * Grasp中に表示する簡易インストゥルメント・マーカー（実物の鑷子/鉗子形状の再現ではない、
 * Phase1用の最小プレースホルダー）。Grasp Anchorはheadoff
 * （ProsthesisModels.tsx `headOff = shaftLength/2 + 0.15`、頭板/Soft Clip共通の基準点、
 * ProsthesisModels.tsx L1775）と同じ式をそのまま参照する（新規ジオメトリプリミティブは
 * 追加しない・既存Frozen Geometryには一切触れない）。
 */
function InstrumentMarker({ shaftLength }: { shaftLength: number }) {
  const headOff = shaftLength / 2 + 0.15;
  return (
    <group position={[0, headOff + 1.2, 0]}>
      <mesh>
        <coneGeometry args={[0.35, 1.4, 10]} />
        <meshStandardMaterial color="#c8ccd4" metalness={0.6} roughness={0.35} emissive="#5566ff" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 1.6, 10]} />
        <meshStandardMaterial color="#8890a0" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

export interface TransportProsthesisProps {
  product:                KurzProduct;
  selectedLength:         number;
  transportPose:          TransportPose;
  onTransportPoseChange: (pose: TransportPose) => void;
  /** 器具選択済み（マーカー表示のみ、ドラッグ不可）。 */
  instrumentSelected:     boolean;
  /** 把持中（TransformControls有効、ドラッグ可）。 */
  isGrasped:              boolean;
}

/**
 * Transport段階専用の描画コンポーネント。既存DraggableProsthesis（PlacementState連動、
 * SimScene.tsx）とは完全に別のTransformControlsインスタンスを使う。
 *
 * commit方式はDraggableProsthesis.handleMouseUp（SimScene.tsx L540-553）と同じパターンを
 * 踏襲する: TransformControlsが内部生成するwrapper groupは常に(0,0,0)始点で、ドラッグ量が
 * そのままwrapper.positionに累積される。mouseUp時にその累積値を読み取って外部stateへ
 * 加算し、wrapperを(0,0,0)へリセットする（Issue-024の調査で確認済み、'mouseUp'イベントが
 * 確実に発火することを利用した手口 ── 'dragging-changed'には依存しない）。
 * ここで更新されるのはtransportPose（呼び出し側のローカルstate）のみで、PlacementStateには
 * 一切書き込まない。
 */
export function TransportProsthesis({
  product, selectedLength, transportPose, onTransportPoseChange, instrumentSelected, isGrasped,
}: TransportProsthesisProps) {
  const tcRef = useRef<any>(null);

  const handleMouseUp = () => {
    const obj = tcRef.current?.object as THREE.Object3D | undefined;
    if (!obj) return;
    const newPos = transportPose.position.clone().add(obj.position);
    onTransportPoseChange({ position: newPos, quaternion: transportPose.quaternion });
    obj.position.set(0, 0, 0);
  };

  return (
    <TransformControls
      ref={tcRef}
      mode="translate"
      space="world"
      showX={isGrasped}
      showY={isGrasped}
      showZ={isGrasped}
      enabled={isGrasped}
      size={0.55}
      translationSnap={TRANSLATION_SNAP_MM}
      onMouseUp={handleMouseUp}
    >
      <group
        position={[transportPose.position.x, transportPose.position.y, transportPose.position.z]}
        quaternion={transportPose.quaternion}
      >
        <ProsthesisModel
          product={product}
          shaftLength={selectedLength}
          headType={product.headType}
          poseOverride={{ position: ZERO_VEC, quaternion: IDENTITY_QUAT }}
        />
        {instrumentSelected && <InstrumentMarker shaftLength={selectedLength} />}
      </group>
    </TransformControls>
  );
}

/**
 * ±3mmクランプ。既存の clampDragOffsetMm（useSimStore.ts）/ clamp3（SimScene.tsx）と
 * 完全に同じ境界値をこのモジュール内で独立して持つ（store側コメント「store層はscenes層に
 * 依存しない方針のため、意図的に重複させている」という既存の前例を踏襲。範囲は拡張しない）。
 */
function clampToExistingOffsetRange(v: number): number {
  return Math.max(-3, Math.min(3, v));
}

/**
 * Release/Commitの唯一の変換点（Transport → Placement）。
 * 自由・アンクランプなtransportPose.positionを、basePos（既存のアンカー）からの差分として
 * 読み替え、既存PlacementStateのdragOffsetX/Y/Zと全く同じ意味・同じ±3mmクランプで返す。
 * 角度（angleTilt/angleTiltZ）はTransportでは一切操作しないため対象外（Commit後は既存の
 * TransformControls/矢印キー/ControlPadで従来通り0から調整できる）。
 */
export function commitTransportPoseToOffsets(
  transportPose: TransportPose,
  basePos:       THREE.Vector3,
): { dragOffsetX: number; dragOffsetY: number; dragOffsetZ: number } {
  const delta = transportPose.position.clone().sub(basePos);
  return {
    dragOffsetX: clampToExistingOffsetRange(delta.x),
    dragOffsetY: clampToExistingOffsetRange(delta.y),
    dragOffsetZ: clampToExistingOffsetRange(delta.z),
  };
}

// ════════════════════════════════════════════════════════════════════════
// Phase1-B Step2: スクリーン空間ドラッグ（Direct Manipulation UX）
// ════════════════════════════════════════════════════════════════════════

/**
 * Perspective Cameraからのレイと「ドラッグ開始時点のオブジェクト位置を通りカメラ方向を向く
 * 平面」の交点差分を、ワールド座標系のdeltaとして求める screen-space drag の共通ヘルパー。
 *
 * groupRefは常にローカル位置[0,0,0]始点の専用wrapper groupを指す前提（DraggableProsthesis.
 * handleMouseUpが読み取るTransformControls内部wrapperと同じ前例、SimScene.tsx参照。
 * 「常に(0,0,0)始点、ドラッグ量がそのままwrapper.positionに累積される」パターンを、
 * TransformControlsの代わりに素のpointerイベント+Raycasterで再現する）。
 *
 * ワールドdeltaは、group.parentのmatrixWorldの回転成分のみ（Matrix3、平行移動を含まない）を
 * 使ってローカル座標系へ変換する。Vector3.transformDirection()は結果を正規化してしまう
 * （距離が失われる）ため使わず、Matrix3.applyMatrix3()で大きさを保持したまま変換する。
 * ドラッグ中はReact stateを経由せずgroup.positionを直接書き換え（TransformControlsと同じ
 * imperative更新、60fps更新をReact再レンダーの外で行う）、pointerUp時に一度だけ蓄積済みの
 * ローカルdeltaをonDragEndへ渡す。
 */
export function useScreenSpaceDrag(
  groupRef:           RefObject<THREE.Group | null>,
  onDragActiveChange: (active: boolean) => void,
  onDragEnd:          (localDelta: THREE.Vector3) => void,
) {
  const { camera, gl } = useThree();

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return; // 左クリックのみ（右ドラッグ=Pan等の既存操作と競合させない）
    e.stopPropagation();
    const group = groupRef.current;
    if (!group || !group.parent) return;

    const worldPos = new THREE.Vector3();
    group.getWorldPosition(worldPos);

    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, worldPos);

    const parentInverse = new THREE.Matrix4().copy(group.parent.matrixWorld).invert();
    const parentInverseRotation = new THREE.Matrix3().setFromMatrix4(parentInverse);

    const raycaster = new THREE.Raycaster();
    const raycastToPlane = (clientX: number, clientY: number): THREE.Vector3 | null => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const out = new THREE.Vector3();
      return raycaster.ray.intersectPlane(plane, out) ? out : null;
    };

    const startPoint = raycastToPlane(e.clientX, e.clientY);
    if (!startPoint) return;

    try { gl.domElement.setPointerCapture(e.pointerId); } catch { /* 一部環境で未対応、無視 */ }
    onDragActiveChange(true);

    const handleMove = (ev: PointerEvent) => {
      const point = raycastToPlane(ev.clientX, ev.clientY);
      if (!point) return;
      const worldDelta = point.clone().sub(startPoint);
      const localDelta = worldDelta.clone().applyMatrix3(parentInverseRotation);
      group.position.copy(localDelta);
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      try { gl.domElement.releasePointerCapture(e.pointerId); } catch { /* 無視 */ }
      onDragActiveChange(false);
      const finalDelta = group.position.clone();
      group.position.set(0, 0, 0);
      onDragEnd(finalDelta);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  return { onPointerDown };
}

export interface DirectTransportProsthesisProps {
  product:               KurzProduct;
  selectedLength:        number;
  transportPose:         TransportPose;
  onTransportPoseChange: (pose: TransportPose) => void;
  /** Phase1-B Step5 state（PlacementStateの外側）。描画にのみ反映する。 */
  shaftRollDeg:          number;
  /** ドラッグ中(true)/非ドラッグ中(false)。呼び出し元でOrbitControlsとの競合防止に使う。 */
  onDragActiveChange:    (active: boolean) => void;
  /**
   * ドラッグ解放（pointerUp）時に呼ぶ。TransportPoseの更新自体はここで完了させるが、
   * PlacementStateへのCommit実行そのもの（manipulation.committedをtrueにする）は呼び出し元
   * （SimScene.tsx既存のuseEffect、commitTransportPoseToOffsets）に委ねる。ここでは
   * 「Commitを要求する」だけ。
   */
  onRelease:             () => void;
}

/**
 * Phase1-B Step2: Transport段階のDirect Manipulation版描画コンポーネント。
 * 既存TransportProsthesis（TransformControlsギズモ + Select/Grasp 2ボタン前提）とは別に、
 * Prosthesisを直接クリック（onPointerDown）した瞬間から把持・ドラッグでき、pointerUpで
 * そのままonReleaseを呼ぶ（Select/Graspの中間ステップを持たない）。TransportPose/
 * commitTransportPoseToOffsets()の意味・使い方は既存のTransportProsthesisと同一。
 */
export function DirectTransportProsthesis({
  product, selectedLength, transportPose, onTransportPoseChange, shaftRollDeg,
  onDragActiveChange, onRelease,
}: DirectTransportProsthesisProps) {
  const groupRef = useRef<THREE.Group>(null);

  const { onPointerDown } = useScreenSpaceDrag(
    groupRef,
    onDragActiveChange,
    (localDelta) => {
      const newPos = transportPose.position.clone().add(localDelta);
      onTransportPoseChange({ position: newPos, quaternion: transportPose.quaternion });
      onRelease();
    },
  );

  return (
    <group ref={groupRef} position={[0, 0, 0]} onPointerDown={onPointerDown}>
      <group
        position={[transportPose.position.x, transportPose.position.y, transportPose.position.z]}
        quaternion={transportPose.quaternion}
      >
        <ProsthesisModel
          product={product}
          shaftLength={selectedLength}
          headType={product.headType}
          poseOverride={{ position: ZERO_VEC, quaternion: IDENTITY_QUAT }}
          interactionHitTarget
          shaftRollDeg={shaftRollDeg}
        />
      </group>
    </group>
  );
}
