/**
 * engine/coordinates/tympanicMembrane.ts ── 鼓膜面座標系（TM Coordinate Frame）型定義
 *
 * 【現状】インターフェース定義のみ。値（origin/normal/tangent/bitangent）は未実装。
 * 目的は「今後、鼓膜基準座標系を導入する」という境界（拡張ポイント）をコードベースに
 * 作ることであり、この時点では既存コード（ProsthesisModels.tsx等）からは一切参照されない
 * （Phase20.4のplacementFrame.tsが導入時点でどこからもimportされていなかったのと同じ運用）。
 *
 * 【背景】2026-07-22、shojiさんの調査で、現行の`ProsthesisModel`
 * （kurz-simulator/src/scenes/models/ProsthesisModels.tsx）が
 * `dir = normalize(UMBO_POS - base)` という単一ベクトル（footplate/head→umbo方向）のみで
 * 姿勢（シャフト・ヘッドプレート・フットすべて）を決定しており、「鼓膜面」という解剖学的基準が
 * コード上どこにも存在しないことが判明した。詳細は`LandmarkMeasurements.md`のStep6〜9、
 * memory `ideal_position_audit_2026-07-22.md`参照。
 *
 * 【設計方針（shojiさん提示、2026-07-22）】
 * - PORP/TORPは実物ではHead+Shaftが一体剛体（溶接/一体成形）であるため、Head/Shaftを
 *   独立Quaternionで回転させる設計は採用しない（実装不能な形状になるため却下済み）。
 * - 代わりに、プロステーシス全体の姿勢を「Forward（long axis、既存のUMBO方向）」+
 *   「Up（この座標系のnormal等）」の2軸拘束（lookAt+upベクトル方式）で決定する方向で検討する。
 * - この座標系は将来的にPORP角度だけでなく、Cartilage・TORP・Tympanoplasty・Safety Engine等
 *   でも共通利用できる基盤として設計する。
 *
 * 【今後の実装順（この時点では未着手）】
 * 1. 実物PORP（KURZ Bell PORP等）のHead-Shaft固定角度をshojiさんが確認（90°か85°か等）。
 * 2. `Tympanic_Membrane.glb`（kurz-simulator/public/models/に実在）からInteractive
 *    Landmark Toolで5〜10点以上を実測し、最小二乗平面フィッティングでnormal/originを算出。
 * 3. 上記が揃ってから、このinterfaceに実装（実測値を返すbuilder関数等）を追加する。
 * 4. `ProsthesisModel`側のForward/Up 2軸拘束実装、`idealAngle`再定義へ進む。
 *
 * Frozen Layer尊重: Phase20.4（Danger Zone Frame）・Phase1〜21の既存凍結領域には一切触れない。
 * 本ファイルはengine/coordinates配下の既存の型のみ層（types.ts等）と同じ純粋関数的な設計方針
 * （THREE.Vector3ではなくVec3Tuple、1 unit = 1mm、engine層はscenes層に依存しない）に合わせている。
 */
import type { Vec3Tuple } from './types';

/**
 * 鼓膜面（Tympanic Membrane Plane）を基準とした局所座標系。
 *
 * - origin: 鼓膜座標系の原点（候補: umbo等、まだ未確定）
 * - normal: 鼓膜面の法線ベクトル（最小二乗平面フィッティング由来、単位ベクトル）
 * - tangent: 鼓膜面内の基準方向（候補: umbo→anterior annulus等、まだ未確定）
 * - bitangent: normal × tangent（面内の直交方向、右手系であること）
 *
 * 値の定義（どの実測点をorigin/tangentにするか等）はshojiさんとの設計確定待ち。
 * このinterfaceは境界（拡張ポイント）のみを先に用意するもので、実装（builder関数・
 * 実測値）はまだ含まない。
 */
export interface TMCoordinateFrame {
  readonly origin: Vec3Tuple;
  readonly normal: Vec3Tuple;
  readonly tangent: Vec3Tuple;
  readonly bitangent: Vec3Tuple;
}
