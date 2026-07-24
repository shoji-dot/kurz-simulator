/**
 * coordinates/vectorMath.ts ── WORLD空間ベクトル演算ユーティリティ (Phase2.1)
 *
 * Ear Atlasの経路構造（神経等のPolyline）にtangent/normalを付与するために追加した、
 * 純粋な幾何計算のみを行うユーティリティ。座標系そのものの変換（GLB_LOCAL⇔WORLD等）は
 * transforms.tsの責務であり、本ファイルはWORLD空間内でのベクトル演算のみを扱う。
 */
import type { Vec3Tuple } from './types';

const EPSILON = 1e-9;

export function subtractVec3(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function lengthVec3(v: Vec3Tuple): number {
  return Math.hypot(v[0], v[1], v[2]);
}

/** ベクトルを正規化する。長さがほぼ0の場合は[0,0,0]を返す。 */
export function normalizeVec3(v: Vec3Tuple): Vec3Tuple {
  const len = lengthVec3(v);
  if (len < EPSILON) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function crossVec3(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** WORLD座標系の基準上方向（Y+=Superior）。 */
export const WORLD_UP: Vec3Tuple = [0, 1, 0];
/** tangentがWORLD_UPとほぼ平行な場合のフォールバック参照軸（Z+=Anterior）。 */
export const WORLD_FORWARD_FALLBACK: Vec3Tuple = [0, 0, 1];

/** 2点(from→to)からWORLD空間の単位接線ベクトルを計算する。同一点の場合は[0,0,0]を返す。 */
export function computeTangent(from: Vec3Tuple, to: Vec3Tuple): Vec3Tuple {
  return normalizeVec3(subtractVec3(to, from));
}

/**
 * 接線ベクトルに垂直な参照法線を計算する（tangent × 参照上方向、正規化）。
 * 「構造物の2mm前方」のようなオフセット計算に使える幾何学的に一貫した垂直方向を返すのみで、
 * 解剖学的な「前方/後方」等の医学的な意味付けまでは保証しない（要別途検証）。
 * tangentがWORLD_UPとほぼ平行な場合はWORLD_FORWARD_FALLBACKを参照軸として使う。
 */
export function computeReferenceNormal(tangent: Vec3Tuple): Vec3Tuple {
  const dotWithUp = Math.abs(
    tangent[0] * WORLD_UP[0] + tangent[1] * WORLD_UP[1] + tangent[2] * WORLD_UP[2],
  );
  const reference = dotWithUp > 0.98 ? WORLD_FORWARD_FALLBACK : WORLD_UP;
  return normalizeVec3(crossVec3(tangent, reference));
}

export function dotVec3(a: Vec3Tuple, b: Vec3Tuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function scaleVec3(v: Vec3Tuple, scalar: number): Vec3Tuple {
  return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
}
