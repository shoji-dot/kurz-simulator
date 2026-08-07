# P4 Transition / Deferred Management Plan v1.3

**Status**: Active(P4C実装再開ではない、Evidence取得待ち期間の優先順位管理文書)。
**v1.3でPriority2をクローズしPriority4へ移行**(Soft Clip Geometry Improvement Phase v1
Freeze・shoji確定、2026-08-07)。
**v1.2でMeasurement Record v1.9の内容に同期**(新しい方針判断は含まない、Decision v1.4の
事実を転記するのみ)。
**Date**: 2026-07-30(v1.0)/2026-08-06(v1.1)/2026-08-06(v1.2)/2026-08-07(v1.3)
**v1.3での変更点(shoji確定、2026-08-07)**: Soft Clip Geometry Improvement Phase v1
(Tier A/B/C分類での本番コードEvidence反映作業)がTier A Completed(Clinical Visual
Validation PASSED)/Tier B Canceled(Tier C依存と判明)/Tier C Deferredで完了・Freeze
(`Soft_Clip_Geometry_Improvement_Phase_v1_Freeze_v1.0.md`)。これを受け**Priority2
(Ground Truth Collection)を「現時点で取得可能なEvidenceの反映は完了」という
マイルストーンでクローズ**し、**Priority4(KURZ公式CAD問い合わせ準備)へ移行**。
shoji整理: Priority4のスコープはCAD問い合わせ本体だけでなく、メーカーへの確認事項
整理・将来取得したい寸法リスト・Tier C解除条件の明文化を含む(§2 Priority4参照)。
§1現在地点図・§2 Priority1/2/4・§3 Roadmapを更新。

**v1.2での変更点(shoji承認、2026-08-06)**: 3点。①§1の現在地点図・§2 Priority1/2の
「Top-down撮影待ち」という古い記述を、Measurement Record v1.9(Decision v1.4)の内容に
同期(候補A[90°/270°]撮影・解析がCompletedし、Candidate Cは同目的では不要と判定済み)。
②Coordinate Integrationを新規の残課題として追加するが、**優先度はP0ではなくP0〜P1境界の
「解析精度向上の重要課題」**として位置づける(現時点でCoordinate Integration不在がPhase2
進捗の唯一のBlockerと証明されたわけではないため。直接Blockerは引き続きHook Transition
Profile定量化とShaft径較正の2点、shoji指摘2026-08-06)。③§3 RoadmapのStep1を
「Completed」として明示し、Step1.5としてCoordinate Integrationを、Priority3着手の
前提条件ではない並行トラックとして追加。
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
  Soft Clip Shaft〜Hook〜Terminal(Phase2/3) — Evidence Blocker継続
        (候補A[90°/270°]撮影・解析はCompleted、Measurement Record v1.9。
         直接Blocker: Hook Transition Profile定量化・Shaft径較正。
         Coordinate Integrationは解析精度向上の重要課題として並行管理、P0直接
         Blockerではない)
        ↓
  Soft Clip Geometry Improvement Phase v1(本番コードへのEvidence反映、2026-08-07)
        Tier A(Shaft Lower/Middle 2段円柱化) — Completed & Clinical Visual
          Validation PASSED(commit 0639f2d)
        Tier B(Pocket座標統合) — Canceled(Tier Cへのサブタスクと判明、暫定配置不採用)
        Tier C(Bridge/Band Loop全体/Hook) — Deferred(再開条件は同Freeze文書§5)
        (`Soft_Clip_Geometry_Improvement_Phase_v1_Freeze_v1.0.md`)
        ↓
現在地点(2026-08-07): P4C Evidence取得待ち継続 + Priority1(Soft Clip)を意図的にFreeze。
**Priority2はSoft Clip Geometry Improvement Phase v1 Freezeをもってクローズ、
Priority4(CAD問い合わせ準備)へ移行** → §2/§3参照。
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
Bell微調整(優先度低のまま)とSoft Clip Phase2/3(Shaft〜Hook〜Terminal)の2点のみ。
**Priority1は現時点で意図的にFreeze中**(Evidence Blocker解消まで新規Mesh実装は
行わない)。

**v1.2時点の状況**: 候補A(90°/270° Azimuth Ring撮影)がCompleted(Measurement
Record v1.9)。M2の視点間乖離が157%→7%に改善し、Hook Transition Profile観察という
目的においては候補C(現物マーキング)は不要と判定された(Decision v1.4)。**残る直接
Blockerは「Top-down撮影待ち」ではなく、Hook Transition Profile定量パラメータ
(Transition length/Curvature profile/Terminal approach angle)の未確定とShaft径較正
(Main Body/Neck判別に加え倍率差・視差等の複合要因)の2点**。Coordinate Integration
(4撮影セッション間の座標変換未定義)は新たに判明した課題だが、Phase2進捗の唯一の
Blockerと証明されたわけではないため、**P0直接Blockerとは区別し「解析精度向上の重要
課題」(P0〜P1境界)として並行管理する**(shoji指摘、2026-08-06)。**Priority1は引き
続き意図的にFreeze中**。

**v1.3時点の状況**: Soft Clip Geometry Improvement Phase v1として、既存Evidence
(Shaft Lower/Middle径等)の本番コード反映をTier分類で実施。**Tier A(Shaft Lower/
Middle 2段円柱化)はCompleted・Clinical Visual Validation PASSED**(commit 0639f2d、
2026-08-07)。**Tier B(Pocket座標統合)はTier C(Band Loop全体)へのサブタスクと
実装前レビューで判明しCanceled**(暫定配置は不採用、Evidence First優先)。**Tier C
(Bridge/Band Loop全体/Hook)はDeferred**、再開条件は`Soft_Clip_Geometry_
Improvement_Phase_v1_Freeze_v1.0.md`§5(Band Loop制御点位置・Hook Transition
Profile定量パラメータ・Shaft径較正のいずれかがEvidence A/A+相当に確定すること)。
**Priority1は引き続き意図的にFreeze中**(Tier C再開まで新規Mesh実装は行わない)。

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

**v1.2時点の状況**: 上記のTop-down優先という判断はMeasurement Record v1.7で
候補A(90°/270°)→候補C→候補D→候補B(Top-down)へ整合修正済みだったため、実際に
撮影・解析が行われたのは候補A(90°/270°)であり、§3 Roadmap Step1はこれをもって
Completedとして扱う(Measurement Record v1.9)。次に必要なEvidenceは、新規撮影を
必ずしも要さない**Coordinate Integration(既存4セッションの対応点解析)**と、次回
撮影機会での**Shaft径現物ノギス確認**の2点(`Soft_Clip_Phase2_Photography_
Checklist_v1.0.md` §4に記録事項化済み)。Top-down(候補B)は引き続き低優先のまま
維持。

**v1.3時点の状況(Priority2クローズ、shoji確定2026-08-07)**: Scaniverse 3D Scan
Evidence Evaluation(Completed、Partially Adopted/Evidence B+/A-、
`Scaniverse_Validation_Report_v1.0.md`)に続き、既存Evidence(ノギス実測・写真計測・
候補A撮影)を最大活用したSoft Clip Geometry Improvement Phase v1(Tier A Completed/
Tier B Canceled/Tier C Deferred)をもって、**「現時点で取得可能なEvidenceの反映は
完了」というマイルストーンでPriority2をクローズ**。理由(shoji): Scaniverseの限界は
確認済み、既存のノギス・写真・実測データはほぼ出し切っており、これ以上はTier C
(Bridge/Band Loop全体/Hook)のような「Evidence Bから妥当な形状を設計する」フェーズに
入ってしまいEvidence Firstの軸足がぶれるため。次はPriority4へ移行。

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

### Priority 4: KURZ公式CAD問い合わせ準備

着手前に「何のデータが必要か」「何を検証したいか」「Confidential情報の要否」を整理する
(P4C-0 §5と同一方針)。

**v1.1時点の状況**: 完全未着手。要件整理(文書作成のみ)は問い合わせの実行(外部依存)
とは切り離して先行可能だが、優先度は引き続き最下位。

**v1.3時点の状況(shoji確定2026-08-07、Priority2クローズに伴い次テーマへ格上げ)**:
Priority2クローズを受け、**準備作業(文書化)はActiveへ格上げ**(実際のKURZ社への
問い合わせ実行自体は引き続き外部依存・低優先のまま)。scopeは4点:

1. KURZ公式CAD問い合わせ本体(データ要件・検証目的・Confidential要否の整理、
   問い合わせ文面作成)
2. メーカーへの確認事項整理(Head Plate Normal/Shaft Axis角度、Soft Clip Band Loop
   制御点位置等、composeNormal()・Tier C双方が必要とする項目の棚卸し)
3. 将来取得したい寸法リスト(Priority2で埋まらなかった項目の一覧化。P4C-0 §3・
   `Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`優先順位[P1〜P5]・本文書の
   Tier C再開条件[Freeze v1.0 §5]を統合)
4. Tier C解除条件の明文化(Soft Clip Geometry Improvement Phase v1 Freeze §5に
   既出の3条件[Band Loop制御点位置/Hook Transition Profile定量化/Shaft径較正]を、
   CAD問い合わせで代替取得できるか・現物計測で埋めるべきかを区別して整理)

具体的な文書作成・着手順序はshoji確認後に決定(次アクション)。

## 3. Roadmap(shoji確定、2026-08-06、v1.1新設)

Soft Clip Pocket Phase1 Freeze後、次に何を着手するかについてshojiと合意した順序。
Small Change(小さく分割)・Evidence First(推測で進めない)・Git履歴を綺麗に保つ、の
3原則を維持する。

```
Step0  P4管理文書同期(本文書、docsのみ) .................. Completed(26f8c74, 561818a)
  ↓
Step1  Soft Clip Phase2 Evidence取得(候補A: 90°/270°撮影・解析)
                                                          Completed(494554e, 561818a / v1.9)
       ※当初「Top-down撮影の依頼」としていたが、Measurement Record v1.7で優先順位を
         候補A→C→D→Bへ整合修正(Top-downは候補Bとして最低優先へ後退)。実施したのは
         候補A。
  ↓
Step1.5(v1.2新設) Coordinate Integrationトラック(必要になった時に並行実施。
       Priority3着手の前提条件ではない)
       - 既存4セッション(Right/Left・Azimuth Ring・Turntable・90°/270°)の対応点
         解析(写真測量、追加撮影不要)
       - 次回撮影時: Shaft径ノギス確認 + 座標系メモ記録
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

**v1.3 Sync Note(2026-08-07)**: 上記Step2〜Step5(Priority3 UI改善)は、本Roadmap
策定と同日(2026-08-06)中にCommit1〜5として実装が進み、Priority3全体が
`Priority3_UI_Design_Review_v1.0.md`(v1.5)・Commit5監査を経て**Completed &
Auditedとして正式クローズ済み**(shoji承認、2026-08-07)。本Roadmap上のStep2〜5表記は
歴史的記録として残すが、最新状況はPriority3_UI_Design_Review系文書を参照すること。
続けてPriority2もSoft Clip Geometry Improvement Phase v1 Freezeをもってクローズし、
現在はPriority4(CAD問い合わせ準備、§2参照)へ移行済み。

**据え置き(着手しない)**: Issue-025(Safety Engine Head Plate側評価範囲拡張)・Soft
Clip Phase2/3実装・composeNormal()は、Evidence確定(Hook Transition Profile定量化・
Shaft径較正、またはP4C-0の代替手段確定)まで着手しない。**Step1[候補A撮影]完了は
Evidence取得の前進であって確定ではない**(Measurement Record v1.9、依然Provisional
以下の値を含む)。

## 4. 参照文書

- `docs/P3_Completion_Summary_v1.0.md`
- `docs/P4C-0_Evidence_Acquisition_Plan_v1.0.md`(Blocked / Deferredの根拠)
- `docs/P4B-3_Freeze_v1.0.md`
- `docs/Pose_Design_Constraints_v1.0.md`
- `docs/Head_Plate_Local_Coordinate_v1.0.md`
- `docs/Prosthesis_Geometry_Audit_Plan_v1.0.md`(Priority1進捗)
- `docs/Soft_Clip_Pocket_Phase1_Freeze_v1.0.md`(Soft Clip Phase1 Freeze・引き継ぎ事項)
- `docs/Soft_Clip_M1M2M3_Photogrammetric_Measurement_v1.0.md`(v1.9、Decision v1.4。
  候補A[90°/270°]結果・Candidate C位置付け変更・Coordinate Integration新設の根拠)
- `docs/Soft_Clip_Phase2_Photography_Checklist_v1.0.md`
- `docs/Soft_Clip_Geometry_Improvement_Phase_v1_Freeze_v1.0.md`(Tier A/B/C結論、
  Priority2クローズの根拠)
- `docs/Priority3_UI_Design_Review_v1.0.md`(v1.5、Priority3 Completed & Auditedの根拠)
- `docs/Scaniverse_Validation_Report_v1.0.md`(Priority2 Scaniverse検証の根拠)
- `docs/Issue-025_SafetyEngine_HeadPlate_DangerZone_Evaluation_Gap.md`(据え置き事項)
