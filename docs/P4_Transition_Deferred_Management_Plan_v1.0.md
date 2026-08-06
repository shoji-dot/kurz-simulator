# P4 Transition / Deferred Management Plan v1.1

**Status**: Active(P4C実装再開ではない、Evidence取得待ち期間の優先順位管理文書)。
**v1.1で2026-08-06時点の実績に同期**(新しい方針判断は含まない、既存Freeze文書群の
事実を転記するのみ)。
**Date**: 2026-07-30(v1.0)/2026-08-06(v1.1)
**v1.1での変更点(shoji承認、2026-08-06)**: 3点。①§1の現在地点図をSoft Clip Pocket
Phase1 Freeze完了まで更新。②§2 Priority1にG1/G2/G3(FlatFoot)Completed・G3-3(Soft
Clip)Phase1 Completed/Phase2 On Hold・Soft Clip Pocket Phase1 Completed & Frozenを
反映。③新設§3にRoadmap(Step0〜Step5+Backlog)を追加、Git housekeepingをBacklogへ
格下げ、Node検証スクリプトを「格納するか」ではなく「将来のGeometry Validation
Standard(Geometry QA Framework)として標準化するか」という観点のDeferred Decision
として再整理、Priority3(UI改善)は実装前に画面設計レビューを行う方針を明記。
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
P4C Normal / 3D Evidence Acquisition — Blocked / Deferred(変更なし)
        (`P4C-0_Evidence_Acquisition_Plan_v1.0.md`)
        ↓
Priority1(プロステーシス品質向上)着手(2026-07-30〜)
        ↓
  PORP/TORP/Soft Clip Reference Landmark/Geometry定義(G1/G2) — Completed
        ↓
  FlatFoot(TORP)Geometry再実装(G3) — Completed & Clinical Visual Validation PASSED
        ↓
  Soft Clip collar/shaft重複解消(G3-3 Phase1) — Completed & Clinical Visual Validation PASSED
  Soft Clip Head形状改善(G3-3 Phase2) — On Hold(Evidence不足)
        ↓
  Soft Clip Pocket Geometry(Phase1: Centerline/Sweep/Width Profile)
        — Completed & Frozen(`Soft_Clip_Pocket_Phase1_Freeze_v1.0.md`、2026-08-06)
  Soft Clip Shaft〜Hook〜Terminal(Phase2/3) — Evidence Blocker(Top-down撮影待ち)
        ↓
現在地点(2026-08-06): P4C Evidence取得待ち継続 + Priority1(Soft Clip)を意図的にFreeze。
Priority2/3/4は本文書v1.0策定以降ほぼ未着手 → §3 Roadmap参照。
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

**v1.1時点の状況**: PORP/TORP(FlatFoot)Reference Landmark/Geometry定義はCompleted
(`Prosthesis_Reference_Landmark_Definition_v1.0.md`/`Prosthesis_Reference_Geometry_
Definition_v1.0.md`/`FlatFoot_Geometry_Improvement_Spec_v1.0.md`)。Soft Clipは
collar/shaft重複解消(G3-3 Phase1)Completed、Head形状改善(Phase2)はEvidence不足で
On Hold、**Pocket Geometry(Centerline/Sweep/Width Profile)はPhase1として実装・
検証・Freeze完了**(`Soft_Clip_Pocket_Phase1_Freeze_v1.0.md`)。残る未着手項目はPORP
Bell微調整(優先度低のまま)とSoft Clip Phase2/3(Shaft〜Hook〜Terminal、Evidence
Blocker: Top-down撮影待ち)の2点のみ。**Priority1は現時点で意図的にFreeze中**
(Evidence Blocker解消まで新規Mesh実装は行わない)。

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

**v1.1時点の状況**: Soft Clip関連の実測・写真Evidenceは継続的に蓄積してきたが、
Soft Clip Phase2/3着手に必要なTop-down視点の追加撮影(`Soft_Clip_Pocket_Phase1_
Freeze_v1.0.md` §5引き継ぎ事項)は未実施。P4C向けHead Plate 3Dメッシュ/CADの取得
手段確定も未着手(P4C-0のBlocked判断以降、進展なし)。**Soft Clip Top-down撮影の
依頼はコード変更を伴わずPriority1のFreezeと無関係に進められるため、§3 Roadmap
Step1として独立に扱う**。

### Priority 3: UI / 教育体験改善

P3で確定したProcedure分類・Anchor・Evidence Layerを、Simulator UIへどう反映するかを検討する。例:

```
Clinical Classification: III型
Detailed Reconstruction Pattern: Ⅲi-M
Anchor Basis: Malleus Handle → Stapes Head
```

**v1.1時点の状況**: コード未着手(`Clinical Classification`/`Anchor Basis`等の文言は
`src/`に0件、grep確認済み)。ただし`SimulationMode.tsx`/`StepFlowMode.tsx`が既に
`tags.procedure`等を参照しており土台は存在する。**Evidence Blockerと無関係に進められる
唯一のPriorityであり、Soft Clip Freeze期間の本命候補**(shoji承認、2026-08-06)。
ただし**いきなり実装せず、まず画面設計(Clinical Classification/Anchor Basis/Teaching
Informationをどこへ・どう表示するか)のレビューを行ってから、Small Changeで段階的に
実装する**(shoji指定。§3 Roadmap Step2〜5参照)。

### Priority 4: KURZ公式CAD問い合わせ準備(低優先、外部依存)

着手前に「何のデータが必要か」「何を検証したいか」「Confidential情報の要否」を整理する
(P4C-0 §5と同一方針、格下げ維持)。

**v1.1時点の状況**: 完全未着手。要件整理(文書作成のみ)は問い合わせの実行(外部依存)
とは切り離して先行可能だが、優先度は引き続き最下位。

## 3. Roadmap(shoji確定、2026-08-06、v1.1新設)

Soft Clip Pocket Phase1 Freeze後、次に何を着手するかについてshojiと合意した順序。
Small Change(小さく分割)・Evidence First(推測で進めない)・Git履歴を綺麗に保つ、の
3原則を維持する。

```
Step0  P4管理文書同期(本文書、docsのみ)
  ↓
Step1  Soft Clip Phase2用 Top-down撮影の依頼(shojiアクション、コード変更なし)
  ↓
Step2  Priority3 UI設計(画面設計のみ、実装しない)
       Clinical Classification / Anchor Basis / Teaching Informationを
       どの画面のどこに表示するかをレビュー
  ↓
Step3  Clinical Classification表示(最小コミット)
  ↓
Step4  Anchor Basis表示(最小コミット)
  ↓
Step5  その他UI改善(Teaching Information等、Step2設計に基づき段階的に)
  ↓
Backlog(品質向上・教育価値・Evidenceに直接寄与しないため優先度を上げない)
  - .gitignore整理(`.claude`/`.mcp.json`/`.serena`/`serena-mcp.ps1`/
    `_softclip_split_backup`)
  - backup branch削除(`backup-before-linefix`/`backup-before-softclip-split`、
    GitHub確認後にshoji実施)
  - Geometry Validation Standardの検討(**「Node検証スクリプトをscriptsへ格納するか」
    ではなく「Bell/Flat/Soft Clip等で共通のTopology/Normal/Signed Volume/Manifold
    検証をGeometry QA Frameworkとして標準化するか」という観点のDeferred Decision**。
    `Soft_Clip_Pocket_Phase1_Freeze_v1.0.md` §6を参照、現時点ではDeferredのまま
    据え置き)
```

**据え置き(着手しない)**: Issue-025(Safety Engine Head Plate側評価範囲拡張)・Soft
Clip Phase2/3実装・composeNormal()は、Evidence確定(Step1の撮影結果、またはP4C-0の
代替手段確定)まで着手しない。

## 4. 参照文書

- `docs/P3_Completion_Summary_v1.0.md`
- `docs/P4C-0_Evidence_Acquisition_Plan_v1.0.md`(Blocked / Deferredの根拠)
- `docs/P4B-3_Freeze_v1.0.md`
- `docs/Pose_Design_Constraints_v1.0.md`
- `docs/Head_Plate_Local_Coordinate_v1.0.md`
- `docs/Prosthesis_Geometry_Audit_Plan_v1.0.md`(Priority1進捗)
- `docs/Soft_Clip_Pocket_Phase1_Freeze_v1.0.md`(Soft Clip Phase1 Freeze・引き継ぎ事項)
- `docs/Issue-025_SafetyEngine_HeadPlate_DangerZone_Evaluation_Gap.md`(据え置き事項)
