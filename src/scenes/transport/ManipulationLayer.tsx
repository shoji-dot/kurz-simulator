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

import { useRef, useEffect, type RefObject } from 'react';
import * as THREE from 'three';
import { TransformControls } from '@react-three/drei';
import { useThree, useFrame, type ThreeEvent } from '@react-three/fiber';
import { ProsthesisModel, computeProsthesisModelPose } from '../models/ProsthesisModels';
import type { KurzProduct } from '../../data/products';
import { TRANSLATION_SNAP_MM } from '../transformControlsConfig';

/** Transport段階の一時pose。PlacementStateとは無関係の独立した自由position（アンクランプ）。 */
export interface TransportPose {
  position:   THREE.Vector3;
  quaternion: THREE.Quaternion;
}

/**
 * Phase1-B ControlPad Transport対応（T2方式）: Transport段階のTilt一時state。
 * PlacementState.angleTilt/angleTiltZとは無関係の独立値（Transport段階でのみ意味を持つ）。
 * Range内Release時にのみ、この数値がそのままPlacementState.angleTilt/angleTiltZへコピーされる
 * （quaternionの分解は一切行わない、角度→quaternionの一方向変換のみで完結させる）。
 */
export interface TransportTilt {
  tilt:  number;
  tiltZ: number;
}

export const INITIAL_TRANSPORT_TILT: TransportTilt = { tilt: 0, tiltZ: 0 };

/** ControlPadがTransport段階でPosition/Tiltを操作するための共通インターフェース。 */
export interface TransportControls {
  translate: (axis: 'x' | 'y' | 'z', deltaMm: number) => void;
  rotate:    (axis: 'tilt' | 'tiltZ', deltaDeg: number) => void;
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
 * Phase1-B ControlPad Transport対応: ControlPad Positionボタン用の純粋関数。
 * transportPose.positionのみをX/Y/Z軸に沿って単純加算する（既存座標系、basePos.x=lateral/
 * basePos.y=vertical/basePos.z=anteriorと同じ軸の意味）。quaternionはそのまま保持する。
 * 元のtransportPoseはmutationしない（新しいTransportPoseを返す）。
 */
export function nudgeTransportPosition(
  transportPose: TransportPose,
  axis:          'x' | 'y' | 'z',
  deltaMm:       number,
): TransportPose {
  const position = transportPose.position.clone();
  position[axis] += deltaMm;
  return { position, quaternion: transportPose.quaternion };
}

/** Phase1-B ControlPad Transport対応: TransportTiltの±180°クランプ。既存の
 *  clampAngleDeg（useSimStore.ts）と同じ境界値をこのモジュール内で独立して持つ
 *  （store層はscenes層に依存しない方針のため、意図的に重複させている既存の前例を踏襲）。 */
function clampTransportTiltDeg(v: number): number {
  return Math.max(-180, Math.min(180, v));
}

/**
 * Phase1-B ControlPad Transport対応: ControlPad Tiltボタン用の純粋関数。
 * tilt/tiltZのみを±180°クランプ付きで加算する。元のTransportTiltはmutationしない。
 */
export function nudgeTransportTilt(
  current: TransportTilt,
  axis:    'tilt' | 'tiltZ',
  deltaDeg: number,
): TransportTilt {
  return { ...current, [axis]: clampTransportTiltDeg(current[axis] + deltaDeg) };
}

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

/**
 * Phase1-B Releaseワープ修正（Conditional Commit方式）: transportPoseがbasePosから見て
 * 3軸ともすでに±3mm以内（＝commitTransportPoseToOffsets()のclampが実質no-opになる）かどうかを
 * 判定する。commitTransportPoseToOffsets()自体は無変更のまま「判定用に呼ぶ」だけで、
 * clamp後の値と生のdelta（同じtransportPose.position.clone().sub(basePos)、Vector3.subは
 * 単純な成分ごとの減算のため丸め誤差は発生しない）を成分ごとに比較する。
 * 一致していればclampは何もしていない＝この時点でcommitしても表示位置とPlacement位置が
 * 完全に一致することが保証される。不一致（＝いずれかの軸でclampが発火した）ならこの
 * Releaseはcommitしない（呼び出し側でTransportを継続する）。
 */
export function isTransportPoseWithinPlacementRange(
  transportPose: TransportPose,
  basePos:       THREE.Vector3,
): boolean {
  const offsets = commitTransportPoseToOffsets(transportPose, basePos);
  const raw = transportPose.position.clone().sub(basePos);
  return offsets.dragOffsetX === raw.x && offsets.dragOffsetY === raw.y && offsets.dragOffsetZ === raw.z;
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
  /** Phase1-B ControlPad Transport対応（T2方式）: Transport段階のTilt一時state。
   *  PlacementStateには一切書き込まない。描画プレビューにのみ使う。 */
  transportTilt:         TransportTilt;
  /** Phase1-B Step5 state（PlacementStateの外側）。描画にのみ反映する。 */
  shaftRollDeg:          number;
  /** ドラッグ中(true)/非ドラッグ中(false)。呼び出し元でOrbitControlsとの競合防止に使う。 */
  onDragActiveChange:    (active: boolean) => void;
  /**
   * Conditional Commit判定用（Releaseワープ修正）。isTransportPoseWithinPlacementRange()の
   * 判定にbasePosが必要なため、呼び出し元（SimScene.tsx）から渡す。PlacementStateとは無関係の
   * 既存アンカー座標（basePos自体は無変更）。
   */
  basePos:               THREE.Vector3;
  /**
   * Release（pointerUp）時点でtransportPoseがbasePosから見て±3mm以内（＝
   * commitTransportPoseToOffsets()のclampがno-opになる）の場合にのみ呼ばれる。
   * 範囲外の場合は呼ばれず、Transport状態が継続する（onTransportPoseChangeによる位置更新
   * 自体はrange外Releaseでも常に行われるため、Prosthesisはその場に留まる）。
   * ここで渡すoffsetsは「表示されていたtransportPoseをbasePos基準に読み替えただけの値」で、
   * clampは実質no-opのため、そのままPlacementStateへ書き込んでも表示位置と一致する。
   * Phase1-B ControlPad Transport対応（T2方式）: angleTilt/angleTiltZ（transportTiltの
   * 現在値をそのままコピーしたもの）も同じpayloadに含め、Position/Tiltを1回の
   * updatePlacement()へまとめられるようにする。
   */
  onRelease:             (offsets: {
    dragOffsetX: number; dragOffsetY: number; dragOffsetZ: number;
    angleTilt:   number; angleTiltZ:  number;
  }) => void;
}

/**
 * Phase1-B Step2: Transport段階のDirect Manipulation版描画コンポーネント。
 * 既存TransportProsthesis（TransformControlsギズモ + Select/Grasp 2ボタン前提）とは別に、
 * Prosthesisを直接クリック（onPointerDown）した瞬間から把持・ドラッグでき、pointerUpで
 * そのままonReleaseを呼ぶ（Select/Graspの中間ステップを持たない）。TransportPose/
 * commitTransportPoseToOffsets()の意味・使い方は既存のTransportProsthesisと同一。
 *
 * Releaseワープ修正（Conditional Commit方式）: onTransportPoseChangeは常に呼ぶ（Transport中の
 * 自由移動は常に保証、basePosから3mmを超えるReleaseでもTransportPoseはそのReleaseした場所に
 * 留まる）。onRelease（実際のPlacement commit要求）は、isTransportPoseWithinPlacementRange()が
 * trueの場合、つまりcommitTransportPoseToOffsets()のclampが実質no-opになる場合にのみ呼ぶ。
 * これにより、実際にcommitされる瞬間は必ず「表示位置＝commit後のPlacement位置」が一致する。
 *
 * Phase1-B ControlPad Transport対応（T2方式）: Tiltの描画は、transportPose.quaternionへの
 * 単純post-multiplyではなく、computeProsthesisModelPose()（Frozen、読み取り専用呼び出し）を
 * transportPose.positionをbasePosとして使って呼び出し、その.quaternionのみを使う。これにより
 * Range内Release時、Placement後（DraggableProsthesis）が同じ関数・同じ実効入力（basePos=
 * transportPose.position、angleTilt/angleTiltZ=transportTilt）で計算するquaternionと
 * byte-identicalな結果になる（回転のWYSIWYGを保証）。.positionは使わない（Position描画は
 * 既存どおりtransportPose.positionをそのまま使う、shaft midpoint計算は導入しない）。
 *
 * Phase1-B Release回転ジャンプ修正: 上記のquaternion計算をReact state（transportPose、
 * ドラッグ終了時にしか更新されない）ではなく、ドラッグ中も常に最新のimperative位置に基づいて
 * 毎フレーム再計算する（useFrame + ref、Reactの再レンダーを経由しない）。useScreenSpaceDrag
 * （Frozen）はドラッグ中の中間位置をコールバックで公開しないため、ドラッグ中の「現在位置」は
 * 外側wrapper（groupRef.current.position、useScreenSpaceDrag.handleMoveが直接書き換える）を
 * 直接参照する以外に取得手段がない。基準位置はbasePosRefで保持し、ドラッグ終了時
 * （onDragEndコールバック内）にReact stateの更新と同期して書き換えることで、React stateの
 * コミットタイミング（非同期）に依存せず回転計算を連続させる。
 *
 * Phase1-B Release位置ジャンプ修正: 上記のrotation修正後もpositionだけがinner groupの
 * JSX position prop（transportPose.position、React state）経由のままだったため、Release時に
 * 「外側wrapperのimperative即時reset（Frozen handleUp）」と「React stateのcommit（非同期）」の
 * 間に挟まるフレームで、position=旧transportPose.position・quaternion=新（useFrame既に反映済み）
 * という不整合な組み合わせが一瞬描画されていた（＝元位置へ一瞬戻って見える）。
 * positionもquaternionと全く同じ経路（basePosRef + groupRef.current.position由来のlivePos）で
 * 同一useFrame内・同一フレームでimperativeに反映することで、この不整合を解消する。
 * inner groupのJSX position propは削除し（二重管理を避ける）、position/quaternionとも
 * useFrameのみが書き込む単一の情報源に統一する。
 *
 * 既知の制限（Phase1-B、未解決）: 上記の修正後もRelease直後にprosthesisが一瞬元位置方向へ
 * 戻って見える、という軽微な視覚的現象が実機で再現している。ただしposition/quaternion/
 * worldPos/screenPosは診断ログ・録画のフレーム単位確認のいずれでもRelease前後で連続してお
 * り、原因は特定できていない（FrozenなuseScreenSpaceDrag.handleUpとReact/Three.jsの
 * render timingの間に、診断では捉えられていない短時間の中間状態が残っている可能性はある）。
 * Phase1-Bのスコープではこれ以上の追跡は行わない。
 */
export function DirectTransportProsthesis({
  product, selectedLength, transportPose, onTransportPoseChange, transportTilt, shaftRollDeg,
  onDragActiveChange, basePos, onRelease,
}: DirectTransportProsthesisProps) {
  const groupRef      = useRef<THREE.Group>(null);
  const innerGroupRef = useRef<THREE.Group>(null);

  /** ドラッグ中/非ドラッグ中を問わない「position/quaternion計算用の現在の基準位置」。
   *  transportPose.position（React state）の変化（ControlPad操作・Case切替等）には
   *  下のuseEffectで追従し、ドラッグ終了時はonDragEndコールバック内で同期的に更新する
   *  （React stateの非同期コミットを待たない、Release直後の位置・回転ジャンプを防ぐため）。 */
  const basePosRef = useRef(transportPose.position.clone());
  /** useFrame内で毎フレーム再利用する一時Vector3（allocation回避、mutationのみに使う）。 */
  const livePosRef = useRef(new THREE.Vector3());

  useEffect(() => {
    basePosRef.current = transportPose.position.clone();
  }, [transportPose.position]);

  const { onPointerDown } = useScreenSpaceDrag(
    groupRef,
    onDragActiveChange,
    (localDelta) => {
      const newPos = transportPose.position.clone().add(localDelta);
      const newTransportPose: TransportPose = { position: newPos, quaternion: transportPose.quaternion };
      // basePosRefをReact state更新と同じタイミングで同期する（range内/range外を問わず、
      // onTransportPoseChangeは常に呼ばれるため、常にnewTransportPose.positionへ合わせる）。
      basePosRef.current = newPos.clone();
      // 範囲内・範囲外を問わず常に更新する（Transport中の自由移動を保証、範囲外Releaseでも
      // Releaseした場所にそのまま留まる。元の位置へ戻す実装はしない）。
      onTransportPoseChange(newTransportPose);
      const inRange = isTransportPoseWithinPlacementRange(newTransportPose, basePos);
      if (inRange) {
        onRelease({
          ...commitTransportPoseToOffsets(newTransportPose, basePos),
          angleTilt:  transportTilt.tilt,
          angleTiltZ: transportTilt.tiltZ,
        });
      }
      // range外: onReleaseを呼ばない＝manipulation.committedはfalseのまま、Transport継続
      // （transportTiltも呼び出し元でそのまま保持される、ここでは変更しない）。
    },
  );

  useFrame(() => {
    if (!innerGroupRef.current) return;
    // livePos（basePosRef + 外側wrapperのimperative drag offset）は、Drag中の「今どこにいるか」を
    // 表す絶対位置で、quaternion計算（UMBO方向再計算、無変更）にのみ必要。
    // 2026-08-15修正（STEP2二重並進Root Cause対応、Architect承認）: innerGroupRef.positionには
    // livePosではなくbasePosRef.currentのみを設定する。innerGroupRefはgroupRef（親、
    // useScreenSpaceDrag.handleMoveがdrag delta自体を書き込む対象）の子であるため、
    // Three.jsのシーングラフが親のposition（drag delta）を自動的に合成する。ここでlivePos
    // （= basePosRef + drag delta）をそのまま子のpositionにも設定すると、同じdrag deltaが
    // 親と子で二重に加算され、Drag中はWorld Position = Base + 2*deltaとなる
    // （Release時はhandleUpがgroupRef.positionを(0,0,0)へ戻すため一重に戻り、見た目上
    // 位置が戻ったように見えていた）。basePosRef.currentのみを設定すれば、drag deltaは
    // 親groupRefの実transformを通じて1回だけ反映される。
    const livePos = livePosRef.current.copy(basePosRef.current).add(groupRef.current?.position ?? ZERO_VEC);
    const quaternion = computeProsthesisModelPose({
      product, shaftLength: selectedLength,
      basePos: livePos,
      angleTilt: transportTilt.tilt, angleTiltZ: transportTilt.tiltZ,
    }).quaternion;
    innerGroupRef.current.position.copy(basePosRef.current);
    innerGroupRef.current.quaternion.copy(quaternion);
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]} onPointerDown={onPointerDown}>
      <group ref={innerGroupRef}>
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
