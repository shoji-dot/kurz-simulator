# Soft Clip Geometry Improvement Phase v1 凍結 v1.0

**Status**: Tier A = Completed(Clinical Visual Validation PASSED) / Tier B = Canceled(Tier C依存と判明) / Tier C = Deferred(追加Evidence待ち)
**Date**: 2026-08-07
**対象コミット**: `0639f2d`(Tier A: PISTON Shaft Lower/Middle 2段円柱化)

(main / origin/main 同期は§8参照)

---

> ## Scope Note(最重要・本文書の適用範囲)
>
> 本Freezeの対象は**Soft Clip(PISTON footType)のShaft Geometry(Shaft Lower/Middle
> 2段円柱化、Tier A)のみ**である。Pocket座標統合(Tier B)、Bridge・Band Loop全体・
> Hook Transition(Tier C)は本Freezeの対象外であり、いずれも未着手・Evidence取得待ち
> のまま残る。本文書はTier B/Cの設計判断には流用してはならない。
>
> 既存の`Soft_Clip_Pocket_Phase1_Freeze_v1.0.md`(Pocket-local座標系でのCenterline
> Sweep実装、dev previewのまま本番未接続)とは別の対象・別のFreezeである。両文書は
> 独立に参照する。

---

## 1. 背景・目的

Priority2(Ground Truth Collection)の一環として、shojiが「追加計測でなく既存Evidence
最大活用によるSoft Clip形状改善」を選択(2026-08-07)。実装着手前のGap Analysisで、
本番コード(`SoftClipHead`/`SoftClipStem`/`SoftClipBridge`/`SoftClipWing`、
`ProsthesisModels.tsx`)が2026-07-02時点の暫定コードのままで、Component Tree/Method
Decision/Interpretation/Measurement Recordで積み上げたEvidence作業(2026-07-30〜
2026-08-06)が一切反映されていなかったと判明。これを受け、本番コードへのEvidence反映を
「Tier A(即着手可)/Tier B(統合作業)/Tier C(新規Geometry、Evidence B定性情報からの
解釈が必要)」の3段階に分類して提示した。

## 2. Tier分類の訂正(実装前レビューで判明)

当初「Tier A→Tier B→Tier C」を独立した順次実行タスクと想定していたが、Tier B(Pocket
Centerline SweepのSoftClipHeadへの座標統合)着手前のレビューで、**Tier Bは独立
タスクではなく、Tier C(Band Loop全体の「つ」字状Centerline)へのサブタスクである**と
判明した。PocketはBand Loop全体Path上のサブ構造であり、Shaft/Global座標系での配置・
向きはBand Loop全体Path(Shaft接続位置等が未確定)に依存するため、変換関数だけ先に
用意しても当てはめ先の基準点がない。

したがって実際のタスク構造は次の2層である(当初の3段階順次実行という想定は誤り):

```
Tier A(独立、Evidence A+のみで完結)
Tier C(Band Loop全体・Bridge・Hook・Pocket統合を含む、Evidence B+新規Evidence待ち)
  └ Tier B(Pocket統合)はTier Cのサブタスクとして包含される
```

## 3. Tier A: Completed

**内容**: `ProsthesisModel()`のisPiston分岐において、従来の単一円柱(全長r=0.20mm
一律、Shaft Middle区間の半径が誤っていたバグ)を、Shaft Lower(固定長2.17mm・
r=0.20mm)/Shaft Middle(可変長・r=0.10mm)の2段円柱へ分割。新規exported定数
`SOFT_CLIP_SHAFT_LOWER_LEN_MM`/`SOFT_CLIP_SHAFT_LOWER_R_MM`/
`SOFT_CLIP_SHAFT_MIDDLE_R_MM`を追加。base/dir/shaftLength/headOff/footOffは無変更、
BELL/FLAT等他footTypeも無変更(isPiston分岐内のみ)。

**Evidence**: Shaft Lower/Middle径・長さは20倍模型ノギス実測(Evidence A+、
`Soft_Clip_Component_Tree_v1.0.md`、v1.1)。

**Verification Order結果**:

| 段階 | 結果 |
|---|---|
| Build | PASS(`vite build`、792 modules、エラーなし) |
| TypeCheck | PASS(`tsc --noEmit -p .`、エラーなし) |
| Lint | PASS(該当ファイルeslint 13件[9エラー+4警告]、`git show HEAD`版との比較で完全一致・新規0件) |
| Review | PASS(diff scope=isPiston分岐+定数3つに限定確認) |
| Clinical Validation(数値) | PASS(Node数値検証、全8 shaftLengths[3.5-5.5mm]で上端/下端境界が旧実装と完全一致、2段円柱の接続部に隙間/重複なし) |
| Clinical Visual Validation(GUI) | **PASS(shoji確認、「実物と同等に見える」、2026-08-07)** |

## 4. Tier B: Canceled

**理由(shoji判断、2026-08-07)**: Pocket自体はEvidence A+(寸法確定済み)だが、
Pocketの位置・向きはTier C(Band Loop全体Centerline)のHypothesisに依存する。これを
統合すると「PocketまでEvidence Bで実装したように見える」ため、Evidence First原則
(確定済みEvidenceと未確定Hypothesisを混在させない)に反する。暫定アンカーでの仮配置
(代替案の1つ)は、FlatFoot G3-2 v1-v7で発生した「あとで直す前提のGeometryが本番に
混在するリスク」と同型のため採用しない。

**現状**: Pocket Phase1 Centerline Sweep(`Soft_Clip_Pocket_Phase1_Freeze_v1.0.md`、
commit `93aec9b`/`d34a29d`)は引き続きdev previewのまま、SoftClipHeadへは未接続。
本番描画への統合は行わない。

## 5. Tier C: Deferred

Bridge・Band Loop全体(Upper Arm/Lower Arm/Central Pocket/Rear Flex Region)・Hook
Transition Profileの新規Geometry実装。Method Decision v1.4で4-4=Option A
(Centerline Sweep)を採用済みだが、以下がEvidence B(定性情報)またはUnknownのまま
未確定:

- Band Loop制御点位置(Shaft接続部/主要曲率変化点/Pocket形成部/開口端の座標)
- Hook Transition Profile定量パラメータ(Transition length/Curvature profile/
  Terminal approach angle)
- Shaft径較正(Main Body/Neck判別に加え倍率差・視差等の複合要因、Priority2
  Scaniverse検証でも精密値未到達)

**再開条件**: 上記のいずれかがEvidence A/A+相当まで確定すること。Priority4での
KURZ公式CAD問い合わせが実現した場合、これらを一括で確定できる可能性がある
(`docs/Soft_Clip_Geometry_Improvement_Spec_v1.0.md`Pending項目・
`docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`優先順位[P1〜P5]を参照)。

## 6. Frozen Decisions(1ページ要約)

| # | 判断項目 | 確定内容 | 根拠 |
|---|---|---|---|
| 1 | Tier A採用範囲 | PISTON Shaft(Shaft Lower/Middle)の2段円柱化のみ。Head/Bridge/Wingは対象外 | §3 |
| 2 | Tier Bの位置づけ | 独立Tierではなく、Tier C(Band Loop全体)のサブタスクとして再分類。Canceledであり単なる延期(Deferred)ではない | §2、§4 |
| 3 | Tier B暫定配置の不採用 | Hypothesisラベル付きでも仮配置は行わない(Evidence First優先) | §4 |
| 4 | Tier C再開条件 | Band Loop制御点位置・Hook Transition Profile定量パラメータ・Shaft径較正のいずれかがEvidence A/A+相当に確定すること | §5 |
| 5 | Pocket Phase1の扱い | 変更なし。dev previewのまま、本番未接続(`Soft_Clip_Pocket_Phase1_Freeze_v1.0.md`参照) | §4 |

## 7. 参照文書

- `docs/Soft_Clip_Geometry_Audit_v1.0.md`
- `docs/Soft_Clip_Component_Tree_v1.0.md`(v1.1、Shaft Lower/Middle Evidence A+根拠)
- `docs/Soft_Clip_Geometry_Method_Decision_v1.0.md`(v1.4)
- `docs/Soft_Clip_Geometry_Improvement_Spec_v1.0.md`(Pending項目)
- `docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`(優先順位P1〜P5)
- `docs/Soft_Clip_Pocket_Phase1_Freeze_v1.0.md`(Pocket Phase1、対象外だが関連)
- `docs/P4_Transition_Deferred_Management_Plan_v1.0.md`

## 8. Final Status

```
Soft Clip Geometry Improvement Phase v1
Tier A: Completed(commit 0639f2d、Clinical Visual Validation PASSED 2026-08-07)
Tier B: Canceled(Tier C依存と判明、暫定配置は不採用)
Tier C: Deferred(Evidence待ち、再開条件は§5)

Push状態: commit 0639f2dはローカルcommitのみ(origin/main未同期、本文書作成時点)。
本文書自体もローカルcommitとして作成、pushはshoji側で実施。

Next:
Priority2(Ground Truth Collection)はこのFreezeをもって「現時点で取得可能な
Evidenceの反映は完了」というマイルストーンでクローズ(shoji判断、2026-08-07)。
以降はPriority4(KURZ公式CAD問い合わせ・確認事項整理・将来取得したい寸法リスト・
Tier C解除条件の明文化)へ移行する。
```
