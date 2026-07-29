# P3-EA-3: Evidence Validation v1.0

**Status**: Draft(shoji確認待ち)
**Date**: 2026-07-29
**位置づけ**: `docs/P3-EA-2_Step_B_Response_Record_v1.0.md`(commit `9c34dad`)で得られたFinding
1〜4を、Evidence分類の確定・Priority定義のAddendum・Frozen Layer影響の切り分けという観点で
検証する。P3-EA-1で定義した`P3-EA`系列(Evidence Acquisition & Validation)の第3段階。
**P3-2/P3-4/P3 Freeze v1.0(いずれもStatus: Completed)の本文は変更しない**(Strangler Pattern、
Frozen Layer尊重)。本文書は、それらに対する追補(Addendum)として独立に成立する。

---

## Finding 1: recommendedLengthのEvidence分類更新

### 検証結果(shoji確認済み方針)

`recommendedLength`は「間違い」ではなく、**「Educational Scenario Parameterではあるが、
Patient-specific Measurement Evidenceではない」**という再分類が妥当。

| 項目 | 分類(確定) |
|---|---|
| `recommendedLength` | Layer3 Code Record |
| `clinicalNotes`記載距離 | Evidence C相当(Scenario Narrative) |
| Expert explanation(Step B回答) | Evidence B |
| Patient anatomy measurement(症例固有の解剖実測値) | Unknown |

この分類は`docs/P3-EA-2_Step_A_Existing_Evidence_Organization_v1.0.md`のEvidence Classification
と整合しており、**新たな階層変更ではなく、Step Bで得た事実(ALPHA単一モデル制約)を踏まえた
確認・確定**という位置づけである。

### Priority定義のAddendum(P3-4本文は変更しない)

P3-4(`docs/P3_Ground_Truth_Acquisition_Plan_v1.0.md`)は既に「Priorityは臨床的正しさの順位では
なくEvidence取得着手順序である」と明記済みだが、Step Bで判明した事実(Priority1の3症例も
recommendedLength自体はALPHA単一モデル制約により恣意的)を踏まえ、以下のAddendumを追加する。

> **P3-EA Addendum(2026-07-29)**: Priority 1は「Evidence確度が高い症例」ではなく、
> **「既存Evidence候補(clinicalNotesの実測記載)が存在する症例。ただしEvidence確度自体は
> 未確定」**と読み替える。Priorityは「正しそうな順番」ではなく「検証価値・情報量の順番」を
> 意味する。この読み替えはP3-4本文の削除・書き換えではなく、P3-EA系列における追加解釈として
> 別途保持する。

---

## Finding 2: 軟骨補正値(0.2mm/0.5mm)の扱い

### 決定: 統一しない、Unknownのまま保持

現時点でどちらが正しいか、あるいは両者が指す対象自体が異なるかを判断する材料がないため、
**今回は統一・reconcileを行わない**。参考のため、想定される関係性を仮説として記録する
(いずれも検証されていない仮説であり、採否を決めるものではない)。

| 仮説 | 内容 |
|---|---|
| A | 0.5mm=軟骨厚そのもの、0.2mm=実際の補正量(異なる量を指している可能性) |
| B | 0.2mmは記録上の誤り(教科書値0.5mmが正) |
| C | 0.5mm=教科書の一般値、0.2mm=shojiさんの個別経験に基づく値(用途が異なる) |

**次のアクション**: 次回shojiさんへのヒアリング機会があれば確認する。それまでKnown Unknownとして
保持し、P3-3 Mapping Table・P3-5 Measurement Protocolの本文修正は行わない。

---

## Finding 3: PORP Anchor Definition Extension Proposal

### 決定: P3-2への即時反映は保留。Extension Proposalとして本文書に保持する

**理由(shoji判断)**: `ossicularStatus.malleus`には`absent`/`partial`/`intact`の3状態が存在する
(`cases.ts`型定義参照)。Step Bで確認できたのは`absent`(case-004/012)と`intact`(case-008)の
2パターンのみであり、**`partial`(case-003/005/007)がどちらのAnchorパターンに該当するか、
あるいは第3のパターンかは未確認**。この状態でP3-2 Frozen本文を書き換えると、partial症例確認後
に再度変更が発生するリスクがある。

### PORP Anchor Definition Extension Proposal(Evidence B、確定ではなく提案として保持)

| Malleus状態 | 該当パターン(JOS2010) | Anchor(提案) | 確認状況 |
|---|---|---|---|
| absent | Ⅲc相当 | 軟骨再建面(TM) → Stapes Head | 確認済み(case-004/012、Step B) |
| intact | Ⅲi-M相当 | ツチ骨柄(Malleus handle) → Stapes Head | 確認済み(case-008、Step B) |
| partial | 未確認 | 未確認 | **要確認**(case-003/005/007) |

**運用方針**: 本Extension Proposalは`docs/P3-EA-3_Evidence_Validation_v1.0.md`(本文書)内でのみ
保持し、P3-2本文には反映しない。partial症例のAnchorパターンが確認され次第、
「P3-2 v1.1」または「P3-2 Addendum」のどちらの形式で反映するかを改めて検討する
(いずれも次フェーズの意思決定事項であり、本文書では決定しない)。

---

## Finding 4: Ossicular Procedure Classification整合性(範囲外)

case-008のIII型表記はJOS2010に照らして妥当と確認できたが、同じ論点がcase-001・case-011
(いずれも`malleus: intact`、tags.procedure=「II型」)にも当てはまるかは未評価。

**扱い**: P3-EA-2のスコープ拡張ではなく、独立したIssueとして切り出す
(`docs/Issue-026_Ossicular_Procedure_Classification_Audit_v1.0.md`、本セッションで新規起票)。
理由: case-008個別の問題ではなく、「malleus intact + procedure classification」という
cases.ts全体の整合性に関わる横断的論点のため。

---

## 本文書のDecision Summary

| Decision Point | 結果 |
|---|---|
| Anchor分岐をP3-2へ即反映 | 保留(partial症例確認後に再検討) |
| Anchor分岐案をEvidence Bとして保存 | 実施(本文書のExtension Proposal) |
| Malleus partial症例(003/005/007)のAnchor確認 | 次フェーズで実施予定(未着手) |
| 軟骨補正0.2mm/0.5mmの統一 | 保留(Unknown維持) |
| case-001/011の分類確認 | Issue-026として別途起票 |
| `cases.ts`修正 | 未実施(方針確定後に別途実装依頼) |

## 次のステップ

1. Malleus partial症例(case-003/005/007)のAnchorパターン確認(Priority2の一部として、または
   独立したヒアリングとして実施するかは次セッションでshojiさんと相談)。
2. Issue-026(Ossicular Procedure Classification Audit)の着手判断。
3. 上記が整理された段階で、P3-2 v1.1/Addendumの形式を確定し、必要であれば`cases.ts`の実装
   依頼(対象ファイル・完了条件・テスト内容を整理の上)をClaude Codeへ起票する。

## No inference added

本文書はshojiさんが示した検証結果・判断方針をそのまま記録・整理したものであり、新たな臨床的
判断・数値の推定は加えていない。Extension Proposalの表・partial症例の「未確認」表記も、
既存の型定義(`ossicularStatus.malleus`の3状態)と Step B回答の突き合わせによる整理である。
