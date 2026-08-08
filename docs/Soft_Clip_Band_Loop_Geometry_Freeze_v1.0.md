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
| 断面寸法 | 幅0.25mm×厚さ0.10mm | `SOFT_CLIP_BAND_LOOP_WIDTH_MM`/`SOFT_CLIP_BAND_LOOP_THICKNESS_MM`、Measurement Record v1.0 §0、**Evidence A+**（Control Points本体とは異なりEvidence A+として確定済み） |
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
