# Soft Clip Band Loop Geometry 凍結 v1.0

**Status**: Completed（Geometry Freeze）
**Date**: 2026-08-08
**対象コミット**: `a3f4136`（Proposal v7、曲率品質改善、本Freezeが凍結する最終状態）
**shoji方針**: 実アプリ`?debug=coords`確認済み・完成度約90%、v7を「Geometry成立性を
満たした現行Baseline」として確定。以後の微調整はv8で局所対応する方針
（[[p4_transition_deferred_management]]）。本文書はこの方針をFreeze文書として正式化する。

---

> ## Scope Note（最重要・本文書の適用範囲）
>
> **本Freezeの対象はBand Loop Editor Local Coordinate内のGeometry（27 Control Points・
> Topology・Sweep方式・断面寸法・曲率）のみ**である。**Coordinate Integration
> （Shaft-relative座標への正式配置）は本Freezeの対象外**であり、`Soft_Clip_Band_Loop_
> Coordinate_Integration_Scope_Check_v1.0.md`の通りBlocked/Deferredのまま別Tierで管理する。
> 本文書はGeometry Freezeを宣言するものであり、Coordinate Integrationの解除条件には
> 一切影響しない。

---

## 1. Frozen対象

| 項目 | 内容 | Evidence/根拠 |
|---|---|---|
| Control Points | 全27点（`SOFT_CLIP_BAND_LOOP_CONTROL_POINTS`、`hook/end`〜`upperArm/end`） | v7座標値そのもの。Hypothesis Geometry（Editor上での写真トレース）、Evidence A/A+ではない（Freeze対象は「この座標を正とする」という運用上の凍結であり、Evidence区分を格上げするものではない） |
| Topology | `hook/end`→...→`upperArm/end`の単一の開いた帯（分岐なし、closed=false） | `Soft_Clip_Band_Loop_Bridge_Double_Hole_Audit_v1.0.md`（Level C再評価PASS）、Topology Revision（Hook↔Bridge入替、commit 782d0a3）確定済み |
| Sweep方式 | Ring-loft Sweep（固定N軸+可変W軸、Frenetフレーム不使用） | `ProsthesisModels.tsx`実装（`SOFT_CLIP_BAND_LOOP_PLANE_NORMAL`等）、Pocket Commit3bと同一方式 |
| 断面寸法 | 大きい方0.25mm×小さい方0.10mm（どちらの値をlocal axisへ割り当てるかは2026-08-10修正、§6参照） | `SOFT_CLIP_BAND_LOOP_WIDTH_MM`/`SOFT_CLIP_BAND_LOOP_THICKNESS_MM`、Measurement Record v1.0 §0、**Evidence A+**（Control Points本体とは異なりEvidence A+として確定済み） |
| 曲率 | v7の平滑化結果（RearFlex curve1/3/4、UpperArm curve1の部分的Laplacian/移動平均適用） | Proposal v7 Review、self-intersection=0・最小クリアランス0.0440mm |
| Ring分割数(STEPS=400) | 視覚解像度のみ、Geometry Parameterではない | 実装コメント通り、Freeze対象外パラメータとして明記のみ |
| 描画上の隔離 | `SoftClipBandLoopPreview`は`SimScene.tsx`の`coordDebug && headType==='SOFT_CLIP'`限定のdev preview。`SoftClipHead()`への配線は行わない | Final Geometry Review v1.0（コードレベル再確認済み） |

## 2. Freeze解除ゲート（[[feedback_visual_judgment_priority]]適用）

本Geometryの再変更（Revision）は、以下のいずれかに該当する場合のみ許可する。

- **Level A相当の新発見**: self-intersection/NaN/退化フレームの再発、または実物との
  重大な矛盾（現Topologyでは実物の主要構造を表現できないことが明確な場合）。
- **新規Evidence A/A+の確定**: 現在Hypothesisレベルの27 Control Pointsの一部または
  全部について、写真測量・実測・CAD等でEvidence A/A+相当のデータが新たに得られた場合。

**Level B/C相当の指摘（改善候補・記録のみ）だけでは、本Freezeを解除しない。**
既存の全Audit（Bridge Double-Hole/Terminal Length/Pocket Depth/Arm Gap/Pocket Max
Width、いずれもLevel B/C・Revision不要でPASS済み）はこの基準で処理済みであり、
今後同種の指摘が出ても同じ基準を適用する。

## 3. Coordinate Integrationとの関係（誤解防止のため明記）

- **Shaft Axisは未確定ではない。Frozen・Evidence A**（`ProsthesisModel`のposition/
  quaternion実装、`computeCurrentAxisAlignmentOrientation()`等で確定済み・本番描画で
  使用中）。今後「Shaft Axisが未確定だからIntegrationできない」という表現は用いない。
- **Coordinate IntegrationのBlockerはBand Loop↔Shaft接続位置（Neck位置）等であり、
  Shaft Axisではない**（`Soft_Clip_Geometry_Improvement_Phase_v1_Freeze_v1.0.md`§5
  Tier C再開条件、`Soft_Clip_Band_Loop_Coordinate_Integration_Scope_Check_v1.0.md`参照）。
- **「平面性（z=1.9固定）vs 奥行き波打ち（Evidence B、§1.3）」の潜在的矛盾は、現時点では
  v7 Geometry Revisionの理由ではない。** Level A（self-intersection等の物理的破綻）
  ではなくLevel B/C（記録のみ）に該当するため、本Freezeの範囲では扱わない。この論点は
  **Tier C再開時の確認事項**として`Soft_Clip_Band_Loop_Coordinate_Integration_Scope_
  Check_v1.0.md`⑩に記録済みであり、再開時に「単純な剛体変換で足りるか、Z方向データの
  追加が必要か」を判断する。
- **仮Integration・仮のGlobal/Shaft座標を本番コード（`SoftClipHead()`等）へ入れない。**
  Evidence充足前の暫定配置は、Pocket Tier Bで既にshojiが不採用と判断済み
  （Evidence First原則、FlatFoot G3-2との同型リスク）であり、Band Loopにも同じ運用を
  適用する。

## 4. 参照文書

- `docs/Soft_Clip_Centerline_Proposal_v7.json` / `docs/Soft_Clip_Centerline_Proposal_v7_Review.md`
- `docs/Soft_Clip_Band_Loop_Final_Geometry_Review_v1.0.md`（Level A問題なしの確認）
- `docs/Soft_Clip_Band_Loop_Coordinate_Integration_Scope_Check_v1.0.md`（Coordinate Integration Blocked/Deferredの根拠）
- `docs/Soft_Clip_Geometry_Improvement_Phase_v1_Freeze_v1.0.md`（Tier C再開条件、上位Freeze文書）
- `docs/Soft_Clip_Band_Loop_Bridge_Double_Hole_Audit_v1.0.md`、`Soft_Clip_Terminal_Length_Pocket_Depth_Measurement_Definition_Check_v1.0.md`、`Soft_Clip_Arm_Gap_Pocket_Max_Width_Audit_v1.0.md`（Level B/C・Revision不要の判定根拠）
- `feedback_visual_judgment_priority.md`（Freeze解除ゲートの原則出典）

---

## 5. Final Status

```
Soft Clip Band Loop Geometry (v7, commit a3f4136)
Status: FROZEN

Frozen:
  27 Control Points / Topology / Sweep方式 / 断面寸法(0.25×0.10mm) / 曲率

Freeze解除条件:
  Level A相当の新発見、または新規Evidence A/A+の確定のみ
  (Level B/C指摘だけでは解除しない)

Coordinate Integration:
  別Tierとして引き続きBLOCKED / DEFERRED
  Blocker: Band Loop Shaft接続位置(Neck) / Hook Transition Profile定量パラメータ /
           Shaft径較正のいずれか(Evidence A/A+待ち)
  Shaft Axis自体: Frozen / Evidence A(問題ではない)
  平面性 vs 奥行き波打ち: Revision理由ではなく、Tier C再開時の確認事項

運用ルール:
  Coordinate Integration Blocked中はBand Loop Geometryを操作しない
  仮のGlobal/Shaft座標を本番コードへ入れない
  SoftClipBandLoopPreviewはdev preview限定のまま、SoftClipHead()へは未配線を維持

Next:
  (a) Tier C再開条件(Evidence A/A+)の充足を待つ
  (b) 他のP4 Priority(Ground Truth収集/UI改善/CAD問い合わせ準備)を継続
```

---

## 6. Addendum（2026-08-10）: 断面寸法のlocal axis割り当て修正

**対象コミット**: `39d8f3a`
**Status**: 実装・shoji Viewer確認済み。**本Freezeの再オープンではない**（§2の解除
ゲートに該当しないことを本節末尾で明示）。

### 6.1 何が変わったか（何が変わっていないか）

- **変わっていない**: 実測された断面寸法の値そのもの（大きい方≈0.24mm→Production
  コード値0.25mm、小さい方≈0.10mm→Production コード値0.10mm、いずれもEvidence A+、
  Measurement Record v1.0 §0）。27 Control Points・Centerline・Topology・Band Loopの
  translation/rotation（rotation=0°、translation.y=-0.15mmのまま）・Shaft Middle径
  （0.10mm半径）/位置/高さ・Pocket/Hook/Lower Arm/Rear Flex/Upper Arm形状。
- **変わった**: Production Sweep実装（`getSoftClipBandLoopRingAt()`）のlocal
  frame上で、2つの実測値をどちらの軸に割り当てるか。
  - 修正前: `SOFT_CLIP_BAND_LOOP_WIDTH_MM = 0.25`(wHat軸) / `SOFT_CLIP_BAND_LOOP_
    THICKNESS_MM = 0.10`(nHat軸、固定ローカルZ)
  - 修正後: `SOFT_CLIP_BAND_LOOP_WIDTH_MM = 0.10`(wHat軸) / `SOFT_CLIP_BAND_LOOP_
    THICKNESS_MM = 0.25`(nHat軸、固定ローカルZ)
  - wHat軸 = `cross(nHat, tangent)`（centerline接線に応じて向きが変わる）、nHat軸 =
    `SOFT_CLIP_BAND_LOOP_PLANE_NORMAL`（固定ローカルZ）。

### 6.2 なぜ修正したか（重要: 「見た目合わせ」ではない）

20倍模型から得られた2つの断面寸法（≈0.24mm/≈0.10mm）自体は正しかった。問題は、
その2つの値をProduction Sweepのlocal frame（nHat/wHat）へ割り当てる**向き**が、
実物に対して逆になっていたことであり、値そのものの誤りではない。この向きを
Audit（Node数値検証、`bandloop_check/check4_caseAB.mjs`、リポジトリ外）で特定し、
Case B（大きい方0.25mmをnHat軸へ）が実物のZ方向被覆関係と一致することを確認した
うえで修正した。

Case A（修正前）vs Case B（修正後）、Shaft Middle↔Band Loop接続点近傍（bridge/end、
centerline全長400分割中の該当区間）での数値比較:

| 指標 | Case A（修正前） | Case B（修正後） |
|---|---|---|
| Z方向（nHat軸、Shaft直径0.20mmとの関係） | 断面厚さ0.10mm＜Shaft直径0.20mm。全周貫通頂点12/1604 | 断面厚さ0.25mm＞Shaft直径0.20mm。全周貫通頂点0/1604 |
| 全ループ最小距離（Band Loop表面-Shaft軸） | 0.0504mm | 0.1251mm |
| 接続点近傍のX方向extent（tangent≈World Xのため断面のX方向extentが構造的に縮小する区間、t≈0.167〜0.227） | 0.0005〜0.0705mm | 0.0002〜0.0426mm（Case Aよりやや悪化、未解決の既知限界） |

X方向の露出は今回の軸割り当て修正では解決しない構造的制約（centerline/sweep frame
側の問題、§3「平面性vs奥行き波打ち」等と同様にTier C以降の課題）として残存する。

### 6.3 shoji Viewer確認チェックリスト（2026-08-10、shoji本人が実機`?debug=coords`
なし・本番描画で確認・記録のみ）

- [x] Shaftが横に飛び出て見える状態が改善
- [x] Band Loopに対してShaftが不自然に埋没していない
- [x] 幅/厚さの見た目の印象が実物(20倍模型)に近い
- [x] Pocket形状が崩れていない
- [x] Hook形状が崩れていない
- [x] Upper Arm/Lower Armのシルエットが歪んでいない
- [x] 全体として実物写真との整合性がある

### 6.4 Freeze解除ゲート（§2）との関係

本修正は§2のFreeze解除ゲート（Level A相当の新発見／新規Evidence A/A+の確定）を
発動させるものではない。27 Control Points・Topology・Centerline・曲率は無変更であり、
断面寸法の**値**（0.25mm/0.10mm、Evidence A+）も無変更。変更したのはこの2つの
既存Evidence A+値をどちらのlocal axisへ実装上割り当てるかという、Production
Sweep実装のバグ修正（Audit起因のCorrection）であり、Geometry仕様のRevisionでは
ない。§1の「断面寸法」行を上記の通り更新し、本Addendumを参照させる。
