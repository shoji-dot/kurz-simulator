# Priority3 UI Design Review v1.0

**Status**: Draft(shoji確認待ち)。**設計レビューのみ、実装は行っていない**(shoji指定、
コード変更なし)。
**Date**: 2026-08-06
**位置づけ**: `P4_Transition_Deferred_Management_Plan_v1.0.md`(v1.2)§3 Roadmap Step2。
P3で確定したProcedure分類・Anchor・Evidence Layer(`P3_Completion_Summary_v1.0.md`)を
Simulator UIへどう反映するかを、実装前に画面設計として整理する。**Soft Clip Geometry
トラック(Freeze中)とは独立**しており、本文書の作業はGeometry Freezeに影響しない。

**推奨フロー(shoji指定)**: ①現状UI棚卸し→②学習フロー観点の画面・情報整理→③画面遷移・
情報アーキテクチャ設計→④Must/Should/Could優先順位→⑤Small Change実装単位分割→
⑥実装ロードマップ(コミット単位)。本文書はこの6段階に対応する。

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
(UI表示)のスコープを超えたデータ層の変更であり、shoji判断が必要**(§8 Decision
Points #1)。

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
れる(shoji確認推奨、§8 Decision Points)。

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

- **FlowSetup(Step1症例選択)**: SimulationModeと同様のClinical Classification表示を
  追加。**表示ロジックはSimulationModeと共有すべき**(§1で指摘した重複実装の解消と
  同時に行う)。
- **Step4(耳小骨評価)またはStep6(プロステーシス設置)**: Anchor Basis表示を追加
  (手技理解のタイミングに最も近い、要shoji確認でどちらが適切か)。

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

| Commit | 内容 | 前提条件 |
|---|---|---|
| Commit1 | `cases.ts`構造化フィールド追加(データのみ、UI変更なし) | shoji確認必須(§8 #1・#2) |
| Commit2 | `ContextTagBar`の共有コンポーネント化(表示内容不変のリファクタ、Strangler Pattern) | 前提なし、単独で着手可能 |
| Commit3 | Clinical Classification表示追加(SimulationMode) | Commit1・2完了後 |
| Commit4 | Clinical Classification表示追加(StepFlowMode) | Commit3と同一表示ロジックを再利用 |
| Commit5 | Anchor Basis表示追加(該当画面) | Commit1完了後 |
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

## 8. Decision Points(shoji判断が必要な事項)

1. **`cases.ts`構造化フィールドの追加方式**: Runtime推論は不採用とし、事前格納方式
   (shoji確認済みの値をフィールドとして追加)を採用してよいか。
2. **Detailed Reconstruction Pattern(Ⅲc/Ⅲi-M)の全15症例確認**: 現在2症例のみ
   `teachingPoints`に記載あり、残り13症例はコード内コメントのみ。shoji自身による
   全件確認・記入という作業が新たに発生する(Evidence B、専門的判断)。作業量の
   見積もりと着手タイミング。
3. **Anchor Basis表示文言の生成方法**: 「ツチ骨柄→アブミ骨頭部」等の文言を判定
   ロジックから自動生成するか、shoji記入の自由記述とするか。
4. **§3の表示タイミング分離案**(Clinical Classificationは症例選択時、Anchor Basisは
   配置操作時)の妥当性。
5. **StepFlowModeのAnchor Basis表示位置**(Step4耳小骨評価 vs Step6プロステーシス
   設置のどちらが適切か)。

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
