/**
 * engine/coordinates/placementFrame.ts ── Placement Frame ⇔ Danger Zone Frame 変換 (Phase20.4)
 *
 * SimScene.tsxでプロステーシス配置に使われるローカル座標系（basePos = STAPES_FOOTPLATE /
 * STAPES_HEAD、OssicleModels.tsx。以下「Placement Frame」）と、data/dangerZones.ts
 * （DANGER_ZONES）が使うローカル座標系（原点 = アブミ骨底板(0,0,0)。以下「Danger Zone Frame」）
 * は、同じ向き・同じ回転系だが、原点がSTAPES_FOOTPLATE_OFFSET_MMぶんだけ平行移動した別の
 * 座標系である。
 *
 * SimScene.tsxの<group rotation={[Math.PI,-Math.PI/2,0]}>による回転は、RealAnatomyメッシュ
 * （Danger Zone Frame基準の値 + GLB_OFFSETで配置）とプロステーシス（Placement Frame基準の値を
 * 直接使用）の両方に同じ親グループとして一様に適用されるため、両フレーム間の相対距離・近接判定
 * には影響しない（回転は距離を保存する）。SimScene.tsxと同じThree.jsオブジェクト階層
 * （<group rotation><group position=OFFSET><mesh position=A/></group><mesh position=A+OFFSET/>
 * </group>）を実際に構築し、両者の`getWorldPosition()`が一致することを数値検証した
 * （誤差2.5e-16、2026-07-21、shojiさんレビューで承認）。
 *
 * したがって必要な変換は回転を含まない単純な平行移動のみ。SimScene.tsxのヘッダーコメントに
 * 以前あった「GLB[x,y,z] → world[z,-y,x]」という回転の変換式は検証されていない誤った式だった
 * （正しい回転式はengine/coordinates/transforms.tsのglbLocalToWorld()参照）が、本モジュールの
 * 計算はその回転に依存しないため、この訂正の影響を受けない。
 *
 * 【重要】STAPES_FOOTPLATE_OFFSET_MMはOssicleModels.tsxのSTAPES_FOOTPLATE
 * （new THREE.Vector3(0.84,-2.65,2.12)）・SimScene.tsxのGLB_OFFSETと同じ数値。engine層は
 * scenes層（OssicleModels.tsx等、Reactコンポーネントファイル）に依存すべきではないため、値を
 * ここに複製する（engine/coordinates/transforms.tsのDEVセルフチェックがdata/dangerZones.tsの
 * 値を複製しているのと同じ方針）。OssicleModels.tsx側の値が変わる場合はこちらも同時に更新すること。
 *
 * engine/safetyはこの変換を一切知らない（座標変換はengine/coordinates、距離判定はengine/safety
 * という依存方向を維持する、Phase20.4設計方針・shojiさんレビュー確定）。本ファイルはPhase20.4
 * 時点でどこからもimportされていない（SimScene.tsxからの実際の呼び出し配線は次のコミット）。
 */
import type { Vec3Tuple } from './types';

/**
 * Placement Frame原点（アブミ骨底板）のDanger Zone Frameにおける座標。
 * OssicleModels.tsxのSTAPES_FOOTPLATE / SimScene.tsxのGLB_OFFSETと同じ数値（要同期）。
 */
export const STAPES_FOOTPLATE_OFFSET_MM: Vec3Tuple = [0.84, -2.65, 2.12];

/** Placement Frameの点 → Danger Zone Frameの点（DANGER_ZONES・checkProximityToDangerへの入力用）。 */
export function placementPointToDangerZoneFrame(p: Vec3Tuple): Vec3Tuple {
  return [
    p[0] - STAPES_FOOTPLATE_OFFSET_MM[0],
    p[1] - STAPES_FOOTPLATE_OFFSET_MM[1],
    p[2] - STAPES_FOOTPLATE_OFFSET_MM[2],
  ];
}

/** Danger Zone Frameの点（DANGER_ZONES.position等） → Placement Frameの点（Overlay描画用）。 */
export function dangerZonePointToPlacementFrame(p: Vec3Tuple): Vec3Tuple {
  return [
    p[0] + STAPES_FOOTPLATE_OFFSET_MM[0],
    p[1] + STAPES_FOOTPLATE_OFFSET_MM[1],
    p[2] + STAPES_FOOTPLATE_OFFSET_MM[2],
  ];
}

// ── 開発時セルフチェック（engine/coordinates/transforms.tsと同じインラインパターン） ──────
if (import.meta.env.DEV) {
  // 1. STAPES_FOOTPLATE自身をDanger Zone Frameへ変換すると原点(0,0,0)に戻ること
  //    （shojiさんPhase20.4レビュー所見: 「最も重要な基準点」）。
  const originCheck = placementPointToDangerZoneFrame(STAPES_FOOTPLATE_OFFSET_MM);
  const originOk =
    Math.abs(originCheck[0]) < 1e-9 && Math.abs(originCheck[1]) < 1e-9 && Math.abs(originCheck[2]) < 1e-9;
  if (!originOk) {
    console.warn('[coordinates/placementFrame] selfCheck FAIL: origin', { originCheck });
  }

  // 2. facial-tympanic（data/dangerZones.ts、値をここに複製。dangerZones.tsは変更しない）の
  //    ラウンドトリップ確認。
  const knownDangerZonePoint: Vec3Tuple = [0, 2.8, -1.5];
  const roundTrip = placementPointToDangerZoneFrame(dangerZonePointToPlacementFrame(knownDangerZonePoint));
  const roundTripOk =
    Math.abs(roundTrip[0] - knownDangerZonePoint[0]) < 1e-9 &&
    Math.abs(roundTrip[1] - knownDangerZonePoint[1]) < 1e-9 &&
    Math.abs(roundTrip[2] - knownDangerZonePoint[2]) < 1e-9;
  if (!roundTripOk) {
    console.warn('[coordinates/placementFrame] selfCheck FAIL: round-trip', { knownDangerZonePoint, roundTrip });
  }

  const okCount = [originOk, roundTripOk].filter(Boolean).length;
  if (okCount === 2) {
    console.info('[coordinates/placementFrame] selfCheck: 2/2 ok');
  } else {
    console.warn(`[coordinates/placementFrame] selfCheck: ${okCount}/2 ok`);
  }
}
