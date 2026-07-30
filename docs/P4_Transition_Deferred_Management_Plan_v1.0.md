# P4 Transition / Deferred Management Plan v1.0

**Status**: Active(P4C実装再開ではない、Evidence取得待ち期間の優先順位管理文書)
**Date**: 2026-07-30
**位置づけ**: `docs/P3_Completion_Summary_v1.0.md`(P3 Completed & Frozen)を受けて、P4フェーズの
現在地点と優先順位を整理する。`docs/P4C-0_Evidence_Acquisition_Plan_v1.0.md`
(Status: Blocked / Deferred)の判断を変更するものではなく、その制約を前提として、P4C以外で
今すぐ進められる作業を定義する。**P4Cの実装着手ではない**(本文書の核)。

---

## 1. P4全体の現在地点

```
P3 Completed & Frozen
        ↓
P4A Geometry Validation — Conditionally Complete
        (Origin/X/Y: Evidence A確定。Z軸/Head Plate Normal: 未確定)
        ↓
P4B Pose Solver Rework — Completed(`P4B-3_Freeze_v1.0.md`、push・Deploy確認済み)
        ↓
P4C Normal / 3D Evidence Acquisition — Blocked / Deferred
        (`P4C-0_Evidence_Acquisition_Plan_v1.0.md`)
        ↓
現在地点: P4C Evidence取得待ち。P4基盤維持 + 周辺強化期間
```

**重要な制約(P4C-0からの継承、本文書はこれを変更しない)**:

```
アルゴリズム未完成ではない
    ↓
入力Evidence(Head Plate 3Dメッシュ/点群)が存在しない
    ↓
したがってcomposeNormal()の実装着手は現時点で不可
```

P3で確立した「Ground Truth ≠ Educational Scenario Parameter ≠ Simulation Geometry」という原則
(`P3_Completion_Summary_v1.0.md` §1)を踏まえると、Evidence不足をアルゴリズム開発(実装を先に
進めること)で埋めようとしないことが重要。composeNormal()の実装再開は、Evidence取得手段が
確定してから行う(条件はP4C-0のまま変更なし)。

## 2. 優先順位(Evidence取得待ち期間の作業、shoji確定2026-07-30)

### Priority 1: プロステーシスモデル品質向上

対象: PORP / TORP / Soft Clip / Bell形状 / Head Plate / Shaft / 接触面

現在のボトルネックはPose Solverではなく高品質なReference Geometry不足(P4C-0 §6-1と整合)。
Blender導入を含めた品質向上を検討する(`Blender Policy`が対象とする「Blender MCP経由の計測・
幾何解析」とは別軸の検討)。

### Priority 2: Ground Truth Collection継続

候補: KURZ公式CAD取得可能性確認 / 実物計測追加 / 写真Evidence追加 / 3D Scan可能性検討
(いずれもP4C-0 §4の3方式に対応)。

**取得目的を明確化してから着手する**(目的なきEvidence収集をしない):

```
Head Plate Plane
    ↓
Normal Vector
    ↓
Shaft Axisとの角度
    ↓
Pose Solver Constraint(将来のcomposeNormal()実装で使用)
```

### Priority 3: UI / 教育体験改善

P3で確定したProcedure分類・Anchor・Evidence Layerを、Simulator UIへどう反映するかを検討する。例:

```
Clinical Classification: III型
Detailed Reconstruction Pattern: Ⅲi-M
Anchor Basis: Malleus Handle → Stapes Head
```

### Priority 4: KURZ公式CAD問い合わせ準備(低優先、外部依存)

着手前に「何のデータが必要か」「何を検証したいか」「Confidential情報の要否」を整理する
(P4C-0 §5と同一方針、格下げ維持)。

## 3. Next Step

上記Priority1〜4のうち、どれから着手するかをshojiさんと決定する。P4Cの再開条件(Evidence確定)
に変更はなく、本文書のPriorityはP4Cを代替するものではない。

## 4. 参照文書

- `docs/P3_Completion_Summary_v1.0.md`
- `docs/P4C-0_Evidence_Acquisition_Plan_v1.0.md`(Blocked / Deferredの根拠)
- `docs/P4B-3_Freeze_v1.0.md`
- `docs/Pose_Design_Constraints_v1.0.md`
- `docs/Head_Plate_Local_Coordinate_v1.0.md`
