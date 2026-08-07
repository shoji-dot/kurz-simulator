# Priority3 UI Design Review v1.5(Commit1〜6完了・Priority3クローズ)

**Status**: **Commit1〜5完了(Commit6は任意/Could項目のため未着手)**。§8.2
Pending Approval全4項目をshojiが承認、全Decision Points確定。Commit1〜5実装完了
(commit `01e08a1`/`afcf7cf`/`0bd4e6d`/`4f42588`/`4e04c83`)。Commit5はshoji確認の
結果PORPのみへスコープ限定(§11参照)。**Priority3(UI改善)は本Commit5をもって
実質完了**、TORP/Soft ClipのAnchor Basis拡張は将来Phaseへ持ち越し。
**Date**: 2026-08-06(v1.0作成)/2026-08-06(v1.1、Confirmed/Pending Approval分離)/
2026-08-06(v1.2、8.2承認・確定版化)/2026-08-06(v1.3、Commit2・3進捗反映)/
2026-08-06(v1.4、Commit4進捗反映)/2026-08-06(v1.5、Commit5完了・§11追記・
Priority3クローズ)
**位置づけ**: `P4_Transition_Deferred_Management_Plan_v1.0.md`(v1.2)§3 Roadmap Step2。
P3で確定したProcedure分類・Anchor・Evidence Layer(`P3_Completion_Summary_v1.0.md`)を
Simulator UIへどう反映するかを、実装前に画面設計として整理する。**Soft Clip Geometry
トラック(Freeze中)とは独立**しており、本文書の作業はGeometry Freezeに影響しない。

**推奨フロー(shoji指定)**: ①現状UI棚卸し→②学習フロー観点の画面・情報整理→③画面遷移・
情報アーキテクチャ設計→④Must/Should/Could優先順位→⑤Small Change実装単位分割→
⑥実装ロードマップ(コミット単位)。本文書はこの6段階に対応する。

**v1.1差分要約**: v1.0公開後の実コード追加調査で、Decision Points #1〜#3の不確実性が
大幅に縮小したことが判明。§2.1(新設)に確認済み事実を追加、§8をConfirmed/Pending
Approval形式に再構成した。設計提案(§3〜§6)自体に変更はない。

**v1.2差分要約**: shojiが§8.2 Pending Approval全4項目を承認(下記§8.3参照)。これにより
本文書のDecision Pointsは全て確定。Commit1(`cases.ts`への`detailedReconstructionPattern`
フィールド追加、データ層のみ)を実装・commit `01e08a1`完了。Verification Order
(Build/TypeCheck/Lint/Review/Clinical Validation)全て完了。次はCommit2
(`ContextTagBar`共有コンポーネント化)。

---

## Scope Note

対象は`SimulationMode.tsx`・`StepFlowMode.tsx`(Priority3の目的= Clinical
Classification/Anchor Basis/Teaching Informationの表示改善)。§1の棚卸しは全6画面を
対象とするが、§4以降の設計提案は上記2画面に限定する。`HomeScreen`/`LearningMode`/
`LearningDashboard`/`DrillPracticeScreen`(Feature Flag OFF)への変更は本文書の対象外。

---

## 1. 現状UI棚卸し(実コード調査、2026-08-06)

### 1.1 画面一覧(`src/App.tsx`)

| screen key | 画面 | 役割 | 主要データソース |
|---|---|---|---|
| home | HomeScreen | モード選択ハブ | — |
| learning | LearningMode | 解剖構造の自由学習(6構造・可視化トグル) | `anatomyStructures`(コンポーネント内定義) |
| simulation | SimulationMode | プロステーシス選択・配置シミュレーション(自由操作) | `surgicalCases`(`data/cases.ts`)・`kurzProducts`(`data/products.ts`) |
| stepflow | StepFlowMode | 8ステップ手術フロー(ガイド付き) | 同上 |
| dashboard | LearningDashboard | 学習履歴ベースの推奨教材(Phase14) | `useLearningHistoryStore` |
| drill | DrillPracticeScreen | 削開練習(**Feature Flag OFF**、`FEATURE_DRILL_ENABLED=false`) | — |

### 1.2 既存の症例情報表示コンポーネント

| コンポーネント | 場所 | 表示内容 | 使用箇所 |
|---|---|---|---|
| `ContextTagBar`(ローカル関数) | `SimulationMode.tsx`内、非export | `tags.procedure`/`tags.lesion`をBadge表示 | SimulationModeのみ |
| Badge直書き(procedure/lesion) | `StepFlowMode.tsx` | 同等の内容だが**別実装**(コンポーネント共有なし) | StepFlowMode(FlowSetup・実行画面) |
| ossicularStatus表示 | 両画面で**表現方法が異なる**: SimulationModeは`ツチ骨: 温存`のプレーンテキスト、StepFlowModeは`ツ 温存`の1文字Badge | 症例のmalleus/incus/stapes状態 | 両画面 |
| `TeachingPointList`(`ui/`) | 共有コンポーネント | `teachingPoints[]`を番号付きリスト表示 | 両画面 |
| `LearningPanel`(`ui/`) | 共有コンポーネント | `clinicalNotes`+`TeachingPointList`のラッパー | 両画面 |
| `StepProgress`/`StepProgressBar` | 共有/ローカル | 手順進行表示 | 両画面(SimulationModeは配置調整の段階、StepFlowModeは8ステップ) |

**技術的負債候補(新規発見)**: `ContextTagBar`とossicularStatus表示がSimulationMode/
StepFlowMode間で重複実装・表現不一致になっている。Priority3着手時に共有コンポーネント化
すると、Clinical Classification/Anchor Basis追加のための土台にもなる(§5 Must参照)。

---

## 2. データ構造の現状(重要な発見、Clinical Safety関連)

`SurgicalCase`型(`src/data/cases.ts`)の該当フィールド:

```
tags: {
  procedure: string[];  // 例: ['鼓室形成III型', 'PORP']
  lesion:    string[];
}
teachingPoints: string[];   // 自由記述
clinicalNotes:  string;     // 自由記述
```

**確認した事実(grep調査)**:

1. `tags.procedure`は「鼓室形成III型」のような**型分類**と「PORP」のような**製品種別**が
   同一配列に混在しており、UI側で種類を判別する仕組みがない(文字列一致に依存)。
2. **Detailed Reconstruction Pattern(Ⅲc/Ⅲi-M)は構造化データとして存在しない**。
   `P3_Completion_Summary_v1.0.md` §3が定義する判定手順(malleus状態確認→narrative確認→
   Ⅲc相当/Ⅲi-M相当)はコード内**コメント**として15症例分すべてに記録されているが、
   ユーザーに表示される`teachingPoints`/`clinicalNotes`に含まれるのは**15症例中2症例
   (case-004・case-012)のみ**。残り13症例はこの情報がUI上どこにも表示されない。
3. **Anchor Basis(解剖学的な再建経路、例:「ツチ骨柄→アブミ骨頭部」)も構造化データ
   として存在しない**。`P3_Completion_Summary_v1.0.md` §3の判定手順は文書レベルの
   手順であり、各症例オブジェクトに結果が事前計算・格納されているわけではない。

**含意(Clinical Safety First原則に照らした重要な判断点)**: Clinical Classification/
Anchor BasisをUIに表示するには、(a)表示時に判定ロジックをRuntimeで実行する、
(b)`cases.ts`に新規構造化フィールドを追加しshoji(ENT外科医)が確認した値を事前格納する、
の二択になる。**(a)は臨床分類の自動生成であり、Clinical Safety First原則(教育的・臨床的
妥当性を常に評価する)に照らすとリスクが高い**(誤判定した分類を教育コンテンツとして
表示する可能性)。したがって**(b)の事前格納方式が妥当と考えられるが、これはPriority3
(UI表示)のスコープを超えたデータ層の変更であり、shoji判断が必要**(§8.2 Decision
Points #2、v1.1で調査結果を追記・§2.1参照)。

### 2.1 追加コード調査で確認した事実(v1.1、Confirmed)

v1.0公開後、Decision Points #1〜#3の実装リスクを見積もるため追加調査を実施した。

**(A) PORP 8症例のDetailed Reconstruction Pattern内訳**:

| 分類状況 | 症例 | 根拠 |
|---|---|---|
| コードから決定的に導出可能(malleus absent→Ⅲc) | case-003・case-004・case-012 | `SurgicalCase`データのmalleus状態フィールドから一意に決まる |
| shoji確認済み(Ⅲi-M相当) | case-001・case-005・case-008・case-011 | 過去レビューで確認済み([[next_tasks]]Issue-026関連) |
| **未確認(Hypothesis)** | **case-007** | コード内コメントに「ツチ骨柄なし相当のため直置き」の記載がありⅢc相当の可能性が高いが、**shoji未確認のため仮説扱い**。正式採用はshoji確認後とする |

→ v1.0時点で「13症例確認が必要」と見えていたものが、**未確認は case-007 の1件のみ**まで
絞り込めた。TORP/Soft Clipカテゴリの各症例についても、Anchor経路の表現は症例間で統一的
であり、下記(B)の対応表方式で追加確認なしにカバー可能と判断できる。

**(B) Anchor Basisは分類から一意に導出可能(pure function)**: Anchor Basis(「ツチ骨柄→
アブミ骨頭部」等)は症例ごとに自由記入で保持する必要はなく、**Detailed Reconstruction
Pattern(Ⅲc/Ⅲi-M等)→表示文字列**という一方向・決定的な対応表(pure function)として
実装できる。これはRuntimeでの臨床分類の自動生成(§2で「リスクが高い」とした(a))とは
異なり、**確定済みの分類を表示用文字列に変換するだけの表示変換**であり、Clinical Safety
上のリスクは伴わない。

**(C) 影響範囲の確認**: `src/engine/`・`src/store/`配下で`tags.procedure`を参照する
箇所は**0件**(grep確認)。Clinical Classification/Anchor Basisフィールドの追加は
Safety Engine・Pose Solverの計算ロジックに一切影響しない。

---

## 3. 学習フロー観点の整理(初心者→熟練者)

Simulator全体の学習段階を3つに分けて、情報の出しどころを検討する。

| 段階 | 画面 | 学習者が知りたいこと | 適した情報 |
|---|---|---|---|
| 1. 解剖理解 | LearningMode | 構造の名称・位置関係 | (対象外、既存で完結) |
| 2. 症例理解 | SimulationMode/StepFlowMode選択前 | 「この症例は何型か」「なぜこの分類か」 | **Clinical Classification** |
| 3. 手技理解 | StepFlowMode実施中/SimulationMode配置中 | 「なぜこの位置に置くのか」「どこからどこへ再建するのか」 | **Anchor Basis** |

この整理から、Clinical ClassificationとAnchor Basisは**同じ場所にまとめて表示するのでは
なく、異なるタイミング(症例選択時 vs 配置操作時)で提示する方が学習効果に沿う**と考えら
れる(shoji確認推奨、§8.2 Decision Points #3)。

---

## 4. 画面遷移・情報アーキテクチャ(案)

### SimulationMode

- **症例選択リスト**(既存`ContextTagBar`付近): Clinical Classification行を追加。
  例: 既存「鼓室形成III型」チップに加え、細分類を括弧書きで併記(「鼓室形成III型
  (Ⅲi-M)」)。
- **配置パネル**(既存`LearningPanel`周辺、配置操作と隣接): Anchor Basis行を新設。
  例:「再建経路: ツチ骨柄 → アブミ骨頭部」。3Dシーンの配置と対応づけて表示すると
  効果が高い。

### StepFlowMode

- **FlowSetup(Step1症例選択)・Step4(耳小骨評価)**: SimulationModeと同様のClinical
  Classification表示を追加(shoji確定、§8.3 #4)。**表示ロジックはSimulationModeと
  共有すべき**(§1で指摘した重複実装の解消と同時に行う)。
- **Step6(プロステーシス設置)**: Anchor Basis表示を追加(shoji確定、§8.3 #4)。

---

## 5. Must / Should / Could 優先順位

| 優先度 | 項目 | 理由 |
|---|---|---|
| **Must** | `cases.ts`構造化フィールド追加方針の決定(shoji判断) | Runtime推論は不採用が前提(§2)。これが決まらないと§4のClinical Classification/Anchor Basis表示に着手できない |
| **Must** | `ContextTagBar`の共有コンポーネント化 | SimulationMode/StepFlowMode間の重複実装解消。Clinical Classification追加の土台にもなる(Small Change、表示内容は不変) |
| Should | Clinical Classification表示(症例選択画面、両モード) | 学習段階2に対応 |
| Should | Anchor Basis表示(配置操作に近い画面) | 学習段階3に対応 |
| Could | Teaching Information表示の拡充(表示位置・タイミング改善) | 既存`LearningPanel`で最低限機能している、優先度は低い |
| Could | Evidence Layer(A+/A/B/C)の可視化 | 教育的透明性の向上、shoji指定があれば追加検討 |

---

## 6. Small Change実装単位分割(案)

| Commit | 内容 | 状態 |
|---|---|---|
| Commit1 | `cases.ts`構造化フィールド追加(データのみ、UI変更なし) | **完了**(commit `01e08a1`、2026-08-06) |
| Commit2 | Clinical Tag表示基盤の共通化(表示内容不変のリファクタ、Strangler Pattern、variant対応) | **完了**(commit `afcf7cf`、2026-08-06) |
| Commit3 | Clinical Classification表示追加(SimulationMode 症例選択リストのみ) | **完了**(commit `0bd4e6d`、2026-08-06) |
| Commit4 | Clinical Classification表示追加(StepFlowMode、Step1・Step4) | **完了**(commit `4f42588`、2026-08-06) |
| Commit5 | Anchor Basis表示追加(SimulationMode配置パネル・StepFlowMode Step6、**PORPのみ**) | **完了**(commit `4e04c83`、2026-08-06、スコープをPORPのみに限定。理由は§11参照) |
| Commit6(Could) | Teaching Information/Evidence Layer拡充 | 任意、shoji指定があれば |

---

## 7. 実装ロードマップ

```
Step2(本文書、docs only) → shoji確認・§8 Decision Points決定
    ↓
Step3  Commit1(データ層) + Commit2(ContextTagBar共有化)
    ↓
Step4  Commit3-5(Clinical Classification/Anchor Basis表示)
    ↓
Step5  Commit6(Teaching Information/Evidence Layer拡充、任意)
```

Verification Order(project instruction準拠)は各Commitごとに実施: Build→Type Check→
Lint→Review→Clinical Validation。特にCommit1(データ層)はClinical Validation(shoji
によるEvidence B判定の確認)を重視する。

---

## 8. Decision Points(v1.1、Confirmed / Pending Approval分離)

### 8.1 Confirmed(確認済み、shojiレビュー済み)

- **PORP 8症例の分類状況**: case-003/004/012はコードから決定的に導出可能(Ⅲc)、
  case-001/005/008/011はshoji確認済み(Ⅲi-M相当)。未確認はcase-007の1件のみ(§2.1(A))。
- **Anchor Basisは分類から一意に導出可能**: 症例ごとの自由記入ではなく、
  「分類→表示文字列」のpure functionとして実装する方針を採用(§2.1(B))。
  Runtime臨床推論ではなく表示変換であり、Clinical Safety上安全。
- **影響範囲**: `tags.procedure`参照は`src/engine/`・`src/store/`に0件。
  Safety Engine・Pose Solverへの影響なし(§2.1(C))。

### 8.2 Pending Approval(承認待ち)

1. **case-007の最終分類(Current Assessment、Hypothesis)**: コード内コメントから
   Ⅲc相当である可能性が高い。**ただし正式採用はshoji確認後とする**。
2. **`cases.ts`構造化フィールドの追加方式**: 8.1の確認結果を踏まえ、事前格納方式
   (shoji確認済みの値をフィールドとして追加)での着手可否。
3. **表示タイミング分離案(Recommended)**: Clinical Classification=症例選択時、
   Anchor Basis=配置操作時、というタイミング分離(§3)の妥当性。UX判断としてshoji
   最終確認が必要。
4. **StepFlowModeのAnchor Basis表示位置(Recommended)**: Step4(耳小骨評価)
   vs Step6(プロステーシス設置)のどちらが適切か。UX判断としてshoji最終確認が必要。

**Commit1(データ層追加)着手条件**: 8.2の#1(case-007)・#2(フィールド追加方式)の
承認が得られ次第、着手可能(§6 Commit1参照)。#3・#4(UX判断)はCommit3以降の前提。

### 8.3 Resolved(2026-08-06、shoji承認・確定)

| # | 項目 | 決定内容 |
|---|---|---|
| 1 | case-007の最終分類 | **Ⅲcで確定**(Hypothesisから正式分類へ昇格) |
| 2 | `cases.ts`構造化フィールドの追加方式 | **新規フィールド追加方式で確定**(既存フィールドは変更しない)。Commit1で実装済み(`detailedReconstructionPattern?: 'Ⅲc' \| 'Ⅲi-M'`、commit `01e08a1`) |
| 3 | 表示タイミング分離案 | **確定**: Clinical Classification=症例選択時、Anchor Basis=配置操作時 |
| 4 | StepFlowModeのAnchor Basis表示位置 | **確定**: Clinical ClassificationはStep1(FlowSetup)とStep4(耳小骨評価)の両方に表示、Anchor BasisはStep6(プロステーシス設置)に表示 |

これにより8.1(Confirmed)・8.3(Resolved)で全Decision Pointsが確定し、Pending Approval
は0件。以降のCommit2-6は本§8.3の決定内容に従って実装する。

---

## 9. Non-goals(本文書で行わないこと)

- `HomeScreen`/`LearningMode`/`LearningDashboard`/`DrillPracticeScreen`への変更提案
- Soft Clip Geometryトラックへの影響・変更(完全に独立)
- Evidence Layer可視化の詳細設計(Could項目、Decision Points解決後に別途検討)
- 実装コード・コンポーネントの新規作成(本文書はdocsのみ)

---

## 10. 参照文書

- `docs/P4_Transition_Deferred_Management_Plan_v1.0.md`(v1.2、§2 Priority3・§3 Roadmap Step2)
- `docs/P3_Completion_Summary_v1.0.md`(§2 Procedure Classification・§3 Anchor Definition)
- `src/data/cases.ts`(`SurgicalCase`型定義・15症例データ)
- `src/components/SimulationMode.tsx`・`src/components/StepFlowMode.tsx`

---

## 11. Commit5スコープ限定の経緯(2026-08-06、v1.5で追記)

Commit5着手前、shoji指定の実装前確認事項(①Anchor Basis関数の配置場所②分類→表示
文字列の変換のみか③Soft Clip/TORP/PORPの既存表示経路と競合しないか)を調査した
結果、③で**Clinical Safety First原則に関わる重要な制約**を発見した。

`P3_Completion_Summary_v1.0.md`(Frozen)を確認したところ、§3 Anchor Definitionは
**PORPのⅢc/Ⅲi-M判定手順のみ**を確定事項として扱っており、TORPについては言及が
ない。さらに§5 Known Limitationsには**「Soft Clip Stapes(Stapedotomy)のAnchor
定義(キヌタ骨長突起→底板): Pending Clinical Confirmation」**と明記されている。
実データ確認では、TORP4症例(case-002/006/009/013)は全件`malleus:absent,
incus:absent, stapes:footplate-only`で均一、Soft Clip3症例(case-010/014/015)は
全件`malleus:intact, incus:intact, stapes:footplate-only`で均一だが、これは
Anchor Basisを構造化データとして確定してよい根拠にはならない(P3 Frozen文書の
確認ステータスが優先される)。

この発見を受け、Commit5開始前にshojiへ3案(①PORPのみ②PORP+TORP、この場でTORPの
Anchorを新規確認③全カテゴリ、この場でSoft Clipも含め一括確認)を提示。**shojiが
①PORPのみを選択**(理由: 「今回のPriority3は確定済みGround Truthの可視化であり、
新たな臨床定義を導入するフェーズではない」)。

**結論**: `getAnchorBasis()`(`src/data/anchorBasis.ts`)はPORP症例
(`detailedReconstructionPattern`が設定されている8症例)のみを対象とし、TORP/
Soft Clipは`undefined`を返して何も表示しない。将来的にTORPのAnchor Definitionを
臨床的に確定→P3文書更新→本関数拡張、Soft ClipはClinical Confirmation完了後に
追加、という順序をロードマップとして残す(本Commitでは拡張しない)。

---
