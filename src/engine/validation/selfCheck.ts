/**
 * engine/validation/selfCheck.ts ── 開発時セルフチェック (Phase3)
 *
 * Ear Atlas由来のルール（rules.ts）に対して実際に検証関数（validate.ts）を実行し、
 * 結果をconsoleへ出力する。Phase1 transforms.ts / Phase2 entries.ts と同じ
 * `if (import.meta.env.DEV)` パターン。
 *
 * 【注意・重要】本Phaseは既存ファイルを一切変更しない方針のため、このファイル自体は
 * どのシーン・App.tsxからもimportされていない。したがって `npm run dev` 実行時には
 * 自動実行されない（Phase2の data/earAtlas/entries.ts 内セルフチェックも同様の理由で
 * 現状は未実行）。実行にはこのファイルを一時的に手動importするか、Phase4以降でValidation
 * Engine本体に配線する必要がある。レビュー資料にこの制約と、代替の手動検証結果を明記する。
 *
 * expectedPosition（期待位置検証）はライブのThree.jsシーンから「実際の配置位置」を
 * 取得できて初めて意味を持つため、本セルフチェックでは対象外とする（Atlas自身の期待位置を
 * 期待位置自身と比較しても常にok=trueになるだけで無意味なため、意図的に実行しない）。
 * 導出ルール件数のみをログに残す。
 */
import {
  EAR_ATLAS_EXPECTED_POSITION_RULES,
  EAR_ATLAS_LANDMARK_DISTANCE_RULES,
  EAR_ATLAS_POSITIONS,
  KNOWN_COORDINATE_CONSISTENCY_RULES,
} from './rules';
import { validateCoordinateConsistency, validateLandmarkDistances } from './validate';

if (import.meta.env.DEV) {
  const consistencyResults = validateCoordinateConsistency(KNOWN_COORDINATE_CONSISTENCY_RULES);
  for (const r of consistencyResults) {
    if (!r.ok) {
      console.warn(
        `[validation] coordinate consistency FAIL: ${r.rule.id} (deviation ${r.deviationMm.toFixed(3)}mm > tolerance ${r.rule.toleranceMm}mm)`,
      );
    }
  }

  const distanceResults = validateLandmarkDistances(EAR_ATLAS_POSITIONS, EAR_ATLAS_LANDMARK_DISTANCE_RULES);
  for (const r of distanceResults) {
    if (!r.ok) {
      console.warn(
        `[validation] landmark distance FAIL: ${r.rule.id} (actual ${r.actualMm.toFixed(3)}mm not in [${r.rule.expectedRangeMm[0].toFixed(2)}, ${r.rule.expectedRangeMm[1].toFixed(2)}]mm)`,
      );
    }
  }

  console.info(
    `[validation] selfCheck: consistency ${consistencyResults.filter((r) => r.ok).length}/${consistencyResults.length} ok, ` +
      `landmarkDistance ${distanceResults.filter((r) => r.ok).length}/${distanceResults.length} ok, ` +
      `expectedPosition rules derived: ${EAR_ATLAS_EXPECTED_POSITION_RULES.length}(live-scene wiring is a later phase)`,
  );
}
