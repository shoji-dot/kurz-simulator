/**
 * coordinates/transforms.ts ── Coordinate Utility (Phase1 / Phase3.1でコメント訂正)
 *
 * 座標系統合_解剖エンジン設計書_v1.0 3.1/3.2/3.3節の実装。
 * 既存の AnatomyScene.tsx / SimScene.tsx が持つ
 *   <group rotation={[Math.PI, -Math.PI/2, 0]}>
 * と数学的に同一の変換を、名前付き関数として一本化する。
 *
 * 【Phase3.1訂正】この回転の変換式は、以前 world=[z,-y,x] と文書化されていたが、これは誤りだった。
 * Phase3で実際にThree.js（three@0.184.0、Euler(Math.PI,-Math.PI/2,0,'XYZ')＋実際の
 * <group rotation>と同一構成のObject3D階層の両方）を実行して検証した結果、
 * 正しい変換式は world=[-z,-y,-x] であることが判明した（詳細は
 * Phase3_AnatomicalValidationFoundation_実装レビュー_2026-07-17.md 参照）。
 * 以下の実装（Matrix4ベース）はこの正しい変換に一致しており、変更していない。誤っていたのは
 * コメント上の式と、それを手計算で書き写していた一部の既存データ（AnatomyScene.tsx の
 * ENDO_ZONES 等）側であり、Phase3.1で該当データを修正する。
 *
 * 【重要】既存ファイル（dangerZones.ts 等）の座標値そのものは変更しない。
 * 「コメントに変換式を書いて人力計算」を置き換えるための共通関数を提供するのみ。
 *
 * WORLD = ANATOMICAL = TEMPORAL_BONE は数値的に同一実体（3.2節のエイリアス設計）。
 * 二重管理の再発を防ぐため、これらの変換は恒等関数として実装する。
 */
import * as THREE from 'three';
import type { OrientationState, Vec3Tuple } from './types';

// ── GLB_LOCAL → WORLD 変換行列 ──────────────────────────────────────
// AnatomyScene.tsx:333, SimScene.tsx:469 の <group rotation={[Math.PI, -Math.PI/2, 0]}>
// と厳密に同じ回転（Euler 'XYZ' 既定順）。det=+1（正則）。
const GLB_TO_WORLD_ROTATION = new THREE.Euler(Math.PI, -Math.PI / 2, 0, 'XYZ');
const GLB_TO_WORLD_MATRIX = new THREE.Matrix4().makeRotationFromEuler(GLB_TO_WORLD_ROTATION);
const WORLD_TO_GLB_MATRIX = GLB_TO_WORLD_MATRIX.clone().invert();

function tupleToVector3(p: Vec3Tuple | THREE.Vector3): THREE.Vector3 {
  return p instanceof THREE.Vector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2]);
}
function vector3ToTuple(v: THREE.Vector3): Vec3Tuple {
  return [v.x, v.y, v.z];
}

/** GLB_LOCAL座標 → WORLD座標（=ANATOMICAL=TEMPORAL_BONE）。既存の world=[z,-y,x] と同一。 */
export function glbLocalToWorld(p: Vec3Tuple | THREE.Vector3): Vec3Tuple {
  return vector3ToTuple(tupleToVector3(p).applyMatrix4(GLB_TO_WORLD_MATRIX));
}

/** WORLD座標 → GLB_LOCAL座標。glbLocalToWorld() の逆変換。 */
export function worldToGlbLocal(p: Vec3Tuple | THREE.Vector3): Vec3Tuple {
  return vector3ToTuple(tupleToVector3(p).applyMatrix4(WORLD_TO_GLB_MATRIX));
}

/**
 * WORLD ⇔ ANATOMICAL 変換の共通シグネチャ。
 * Phase2以降、OrientationManager（orientation.ts の useOrientationStore）が持つ
 * earSide / viewerRole の状態をここで参照し、耳側反転（mirrorLeftRight 等）を適用する
 * 委譲先として使う想定のインターフェース。Phase1時点ではorientation引数を受け取るのみで
 * 内部では未使用（常に恒等変換）。
 */
export type AnatomicalTransform = (p: Vec3Tuple, orientation?: OrientationState) => Vec3Tuple;

/**
 * WORLD → ANATOMICAL。
 * ANATOMICALはWORLDのエイリアスであり新規の数値を持たない（設計書3.2節）。
 * `orientation`引数はPhase2でOrientationManagerへ委譲するための拡張点
 * （例: orientation.earSide === 'left' の場合に orientation.ts の mirrorLeftRight() を適用する）。
 * Phase1では未使用・常に恒等変換。
 */
export const worldToAnatomical: AnatomicalTransform = (p, orientation) => {
  void orientation; // Phase2でOrientationManagerへ委譲するまでは未使用
  return p;
};
/** ANATOMICAL → WORLD（恒等）。worldToAnatomical() の逆。orientation引数の扱いは同関数のJSDoc参照。 */
export const anatomicalToWorld: AnatomicalTransform = (p, orientation) => {
  void orientation;
  return p;
};

/**
 * ANATOMICAL → TEMPORAL_BONE（恒等）。TEMPORAL_BONEはANATOMICALのエイリアス（設計書3.2節）。
 * 耳側反転等のorientation依存処理はWORLD⇔ANATOMICAL側（worldToAnatomical/anatomicalToWorld）で
 * 完結させる方針のため、本関数はorientationを受け取らない（用語の言い換えのみ）。
 */
export function anatomicalToTemporalBone(p: Vec3Tuple): Vec3Tuple {
  return p;
}
/** TEMPORAL_BONE → ANATOMICAL（恒等）。 */
export function temporalBoneToAnatomical(p: Vec3Tuple): Vec3Tuple {
  return p;
}

/** GLB_LOCAL → TEMPORAL_BONE のショートカット（glbLocalToWorld + エイリアス通過）。 */
export function glbLocalToTemporalBone(p: Vec3Tuple | THREE.Vector3): Vec3Tuple {
  return anatomicalToTemporalBone(worldToAnatomical(glbLocalToWorld(p)));
}

// ── Temporal Bone Coordinate System（設計書3.3節） ──────────────────
export const TEMPORAL_BONE_AXIS_LABELS = {
  eyeball: '+Z',        // 眼球方向 = Anterior
  sigmoidSinus: '-Z',   // S状静脈洞方向 = Posterior
  tegmen: '+Y',          // 中頭蓋窩（硬膜）方向 = Superior
  jugularBulb: '-Y',    // 頸静脈球方向 = Inferior
  innerEar: '-X',        // 内耳方向 = Medial
  eac: '+X',              // 外耳道方向 = Lateral
} as const;

export const ANATOMICAL_AXIS_LABELS = {
  anterior: '+Z', posterior: '-Z',
  superior: '+Y', inferior: '-Y',
  lateral: '+X', medial: '-X',
} as const;

/** WORLD/ANATOMICAL座標から支配的な方向をラベル文字列で返す（Debug Overlay表示用）。 */
export function describeAnatomicalDirection(p: Vec3Tuple, epsilonMm = 0.5): string {
  const [x, y, z] = p;
  const parts: string[] = [];
  if (Math.abs(y) > epsilonMm) parts.push(y > 0 ? 'Superior' : 'Inferior');
  if (Math.abs(z) > epsilonMm) parts.push(z > 0 ? 'Anterior' : 'Posterior');
  if (Math.abs(x) > epsilonMm) parts.push(x > 0 ? 'Lateral' : 'Medial');
  return parts.length > 0 ? parts.join('/') : '(origin)';
}

// ── 開発時セルフチェック ─────────────────────────────────────────────
// dangerZones.ts の facial-tympanic (GLB_LOCAL [0,2.8,-1.5]) の正しい変換結果を検証する。
// Phase3.1訂正: knownWorldは以前 AnatomyScene.tsx ENDO_ZONES の（誤っていた）手計算値
// [-1.5,-2.8,0.0] をそのまま複製していたが、Phase3でThree.jsを実際に実行して検証した結果
// 正しい値は [1.5,-2.8,0.0] と判明したため訂正した
// （Phase3_AnatomicalValidationFoundation_実装レビュー_2026-07-17.md 参照）。
// ENDO_ZONES facial-tympanicもPhase3.1でAtlas経由の同じ正しい値へ修正済みのため、
// 現在はこのセルフチェックとENDO_ZONESの値は一致する。
// 既存ファイルは変更せず、値のみをここに複製して検証する。
if (import.meta.env.DEV) {
  const knownGlbLocal: Vec3Tuple = [0, 2.8, -1.5];
  const knownWorld: Vec3Tuple = [1.5, -2.8, 0.0];
  const computed = glbLocalToWorld(knownGlbLocal);
  const diff = Math.hypot(
    computed[0] - knownWorld[0],
    computed[1] - knownWorld[1],
    computed[2] - knownWorld[2],
  );
  if (diff > 1e-6) {
    console.warn(
      '[coordinates/transforms] glbLocalToWorld selfcheck mismatch:',
      { knownGlbLocal, knownWorld, computed, diff },
    );
  }
}
