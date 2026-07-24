/**
 * engine/coordinates/tympanicMembrane.ts ── 鼓膜面座標系（TM Coordinate Frame）
 *
 * 【現状】2026-07-24、shojiさんの実測・仕様確定を受けて値を実装（P4-1）。
 * `TM_UMBO`等7ランドマーク点・`TM_NORMAL`は実測値、`buildTMCoordinateFrame()`が
 * origin/tangent/bitangentを導出する。ただしこの時点では既存コード
 * （ProsthesisModels.tsx等）からは一切参照されない（P4-2でPose Solverが利用する予定、
 * Phase20.4のplacementFrame.tsが導入時点でどこからもimportされていなかったのと同じ運用）。
 *
 * 【背景】2026-07-22、shojiさんの調査で、現行の`ProsthesisModel`
 * （kurz-simulator/src/scenes/models/ProsthesisModels.tsx）が
 * `dir = normalize(UMBO_POS - base)` という単一ベクトル（footplate/head→umbo方向）のみで
 * 姿勢（シャフト・ヘッドプレート・フットすべて）を決定しており、「鼓膜面」という解剖学的基準が
 * コード上どこにも存在しないことが判明した。詳細は`LandmarkMeasurements.md`のStep6〜9、
 * memory `ideal_position_audit_2026-07-22.md`参照。
 *
 * 【設計方針（shojiさん提示、2026-07-22〜2026-07-24で確定）】
 * - PORP/TORPは実物ではHead+Shaftが一体剛体（溶接/一体成形）であるため、Head/Shaftを
 *   独立Quaternionで回転させる設計は採用しない（実装不能な形状になるため却下済み）。
 * - 代わりに、プロステーシス全体の姿勢を「Forward（long axis、既存のUMBO方向）」+
 *   「Up（この座標系のnormal）」の2軸拘束（lookAt+upベクトル方式）で決定する（P4-2で実装）。
 * - Pose Solverの責務: TMCoordinateFrame・Bell Ground Truth・Prosthesis Geometryから
 *   最終Poseを決定する純粋関数とする。UIやThree.js、useSimStoreへの依存を持たない。
 *   副作用を持たず、同一入力に対して常に同一Poseを返す決定論的(deterministic)な関数とする。
 *   返り値は`{ position: Vec3Tuple; quaternion: QuaternionTuple }`のみ（THREE.Object3D/
 *   Matrix4を一切知らない）。Three.jsは最後のアダプター層のみに限定する。
 *
 * 【今後の実装順（P4、2026-07-24確定）】
 * P4-1: 本ファイルへの定数追加 + `QuaternionTuple`型追加（完了）。
 * P4-2: Pose Solver純粋関数化。
 * P4-3: Bell Ground Truth接続（15症例）。
 * P4-4: 実機で姿勢確認。
 * Definition of Done: ①Bell姿勢がGround Truthと一致 ②PORP Head Plateが鼓膜内面を向く
 * ③selectedLength変更が期待どおり反映される ④Pose Solverが決定論的 ⑤既存15症例で回帰なし。
 *
 * Frozen Layer尊重: Phase20.4（Danger Zone Frame）・Phase1〜21の既存凍結領域には一切触れない。
 * 本ファイルはengine/coordinates配下の既存の型のみ層（types.ts等）と同じ純粋関数的な設計方針
 * （THREE.Vector3ではなくVec3Tuple、1 unit = 1mm、engine層はscenes層に依存しない）に合わせている。
 */
import type { Vec3Tuple } from './types';
import { subtractVec3, dotVec3, scaleVec3, normalizeVec3, crossVec3 } from './vectorMath';

/**
 * 鼓膜面（Tympanic Membrane Plane）を基準とした局所座標系。
 * - origin: TM_UMBO（解剖学的基準点。Pose Solverは「平面を表現する」のではなく「PORPを配置する」
 *   ための座標系なので、平面フィッティングの重心ではなく解剖学的ランドマークを原点にする、
 *   2026-07-24shojiさん決定）。
 * - normal: 鼓膜面の法線ベクトル（単位ベクトル、+Z）。正方向=外耳道側（術者が鼓膜を見る方向）。
 * - tangent: 鼓膜面内の基準方向（+X）。UMBO→Anteriorをnormal垂直面へ投影してから正規化した方向
 *   （Projection onto TM plane、Gram-Schmidt的な直交化）。
 * - bitangent: normal × tangent（+Y、面内の直交方向、右手系）。
 * Node実行で直交性(X・Y, X・N, Y・N ≈ 0)と右手系(X×Y = N)を数値検証済み（2026-07-24）。
 */
export interface TMCoordinateFrame {
  readonly origin: Vec3Tuple;
  readonly normal: Vec3Tuple;
  readonly tangent: Vec3Tuple;
  readonly bitangent: Vec3Tuple;
}

/**
 * 実測ランドマーク（`Tympanic_Membrane.glb`、Interactive Landmark Tool、2026-07-22実測・
 * 2026-07-24再測定、Reviewer: Shoji）。footplateワールド座標を固定した変換式（Step7と同一手法）
 * でワールド座標へ変換済み。7点の最小二乗平面フィッティング、Fit RMS error: 0.5009mm。
 */
export const TM_UMBO: Vec3Tuple = [-4.1093, 2.8364, 1.8696];
export const TM_ANNULUS_ANTERIOR: Vec3Tuple = [-2.6627, 2.6393, 5.8140];
export const TM_ANNULUS_POSTERIOR: Vec3Tuple = [-5.5787, 5.3828, -2.2958];
export const TM_ANNULUS_SUPERIOR: Vec3Tuple = [1.3260, 6.2694, 2.8727];
export const TM_ANNULUS_INFERIOR: Vec3Tuple = [-6.9966, 1.6353, 1.0768];
export const TM_ANNULUS_MEDIAL: Vec3Tuple = [-3.5472, 3.1849, 0.1930];
export const TM_ANNULUS_LATERAL: Vec3Tuple = [-3.4960, 3.4942, 2.4390];

/**
 * 鼓膜面の法線ベクトル（最小二乗平面フィッティング由来、単位ベクトル）。
 * 符号規約（2026-07-24、shojiさん決定）: 正方向=外耳道側（術者が鼓膜を見る方向）。
 * 検証済み根拠: (TM_ANNULUS_LATERAL−TM_ANNULUS_MEDIAL)・normal = +1.134（強い正、直接的根拠）、
 * (TM_UMBO−origin)・normal = −0.267（UMBOは解剖学的に中耳側へ最も後退した点のため整合、補助的根拠）。
 * 反転不要と確認済み。
 */
export const TM_NORMAL: Vec3Tuple = [-0.5102, 0.7547, 0.4124];

/**
 * 参考値: 平面フィッティングの原点候補（7点の最小二乗フィッティングが返す点）。
 * TMCoordinateFrame.originには使わない（originはTM_UMBOを採用、上記interfaceコメント参照）。
 */
export const TM_PLANE_FIT_ORIGIN: Vec3Tuple = [-3.5806, 3.6346, 1.7099];

/**
 * TMCoordinateFrameを構築する。origin/normalは実測値をそのまま使い、tangent/bitangentは
 * 実測点から導出する（手計算による転記を避け、再測定時の不整合を防ぐため関数化）。
 * tangentはGram-Schmidt的な直交化（Projection onto TM plane→正規化）で求める。
 */
export function buildTMCoordinateFrame(): TMCoordinateFrame {
  const normal = normalizeVec3(TM_NORMAL);
  const rawRadial = subtractVec3(TM_ANNULUS_ANTERIOR, TM_UMBO);
  const radialDotNormal = dotVec3(rawRadial, normal);
  const tangentRaw = subtractVec3(rawRadial, scaleVec3(normal, radialDotNormal));
  const tangent = normalizeVec3(tangentRaw);
  const bitangent = normalizeVec3(crossVec3(normal, tangent));

  return {
    origin: TM_UMBO,
    normal,
    tangent,
    bitangent,
  };
}
