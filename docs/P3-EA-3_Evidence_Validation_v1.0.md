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
| `recommendedLength` | Layer3 Selected Length Record(P3-0/P3-3の正式用語に統一、2026-07-30訂正) |
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

**更新(2026-07-29)**: malleus:partial(case-003/005/007)の確認が完了し、本Findingは
**Resolved**扱いとする。詳細は
`docs/P3-EA-2_Step_B_Additional_Confirmation_Malleus_Partial_Anchor_Review_Response_v1.0.md`
参照。結論: partialは固定の第3Anchorパターンではなく、症例ごとのnarrative確認により
Ⅲc相当/Ⅲi-M相当いずれかへ分類する(判断手順は上記回答記録の「PORP Anchor Definitionの
最終形」節を参照)。副次的に、case-003の`ossicularStatus.malleus`型値自体の見直し候補
(Issue-027)が新たに生じた。P3-2本文への反映方式(v1.1かAddendumか)は、Issue-026対応後に
まとめて判断する。

### 決定(当初、旧版として残す): P3-2への即時反映は保留。Extension Proposalとして本文書に保持する

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
| Anchor分岐をP3-2(`P2_Measurement_Definition_v1.0.md`)へ反映するか | **完了**(案B: 注記追加、2026-07-30実施。詳細は下記「5. Anchor分岐 最終整理」) |
| Anchor分岐案をEvidence Bとして保存 | 実施(本文書のExtension Proposal、判断手順として確定) |
| Malleus partial症例(003/005/007)のAnchor確認 | 完了(2026-07-29、Resolved) |
| 軟骨補正0.2mm/0.5mmの統一 | 保留(Unknown維持) |
| case-001/011の分類確認 | **完了**(Issue-026、2026-07-29クローズ。`docs/Issue-026_Procedure_Classification_Addendum_v1.0.md`) |
| case-003の`ossicularStatus.malleus`型値見直し | **完了**(Issue-027実装済み、`partial`→`absent`) |
| `cases.ts`修正 | **実施済み**(case-001/005/011のtags.procedure、case-003のossicularStatus.malleus) |

## 5. Anchor分岐 最終整理(2026-07-30追記)

前提が全て揃った(Malleus partial Anchor確認=Resolved、Issue-026=Close、Issue-027=実装済み)ため、
残る唯一の未決事項である「Anchor分岐をP3-2本文へ反映するか」を検討する。

### 現状(確定事項の再掲、変更なし)

- P3-2(`docs/P2_Measurement_Definition_v1.0.md` Layer 1)の現行記述:
  「TM(または軟骨再建面) → Stapes Head(PORP/Bell)」という単一Anchorのみ。Ⅲc/Ⅲi-Mの分岐は
  記述されていない。
- 一方、PORP Anchor Definitionの判断手順(本文書Finding 3、確定版)は
  「①malleus absentか確認→Ⅲc、②intact/partialならnarrativeで機能的関与を確認→Ⅲi-M/Ⅲc」
  という分岐を持つ。P3-2本文とP3-EA系列の間に**記述粒度の差**が残っている。

### 案(Frozen Layer変更のため複数案として提示、独断で決定しない)

| 案 | 内容 | Small Change適合度 | リスク・トレードオフ |
|---|---|---|---|
| A: 現状維持 | P3-2本文は変更しない。Ⅲc/Ⅲi-M分岐はP3-EA系列文書(本文書+Response記録)のみで保持し続ける。 | 最も高い(変更ゼロ) | 将来P3-5(Measurement Protocol)実装時、症例別の判断根拠を毎回P3-EA文書まで遡る必要がある。P3-2だけを読む人には分岐の存在が伝わらない。 |
| B: P3-2へ注記追加(Addendum形式) | Layer 1基準点の記述末尾に「PORPのみⅢc/Ⅲi-M分岐が存在し、判断手順は別紙参照」という1〜2文とリンクを**追加のみ**行う。既存文言は削除・書き換えしない。 | 高い(追加のみ、既存記述を壊さない) | Frozen文書への軽微な追記が発生する(Strangler Pattern上は許容範囲だが、Approved文書への手入れという事実は残る)。 |
| C: P3-2 v1.1へ改訂 | Layer 1セクションをPORP/TORP/Soft Clipの分岐を正式に統合した表形式へ書き換える。 | 低い(構造変更) | 参照箇所の洗い出し・影響範囲確認が必要。Small Change原則からは最も逸脱する。 |

**Technical Architectとしての所見**: B(P3-2へ注記追加)がStrangler Pattern/Small Change原則に
最も整合する。

**決定(2026-07-30、shoji承認)**: 案B(注記追加)を採用。`docs/P2_Measurement_Definition_v1.0.md`
のLayer 1基準点セクション末尾に、Ⅲc/Ⅲi-M分岐の存在とResponse文書へのリンクを追記(既存文言は
無変更)。P3-2のStatus(Approved)自体は変更しない。

## 次のステップ

1. ~~Malleus partial症例(case-003/005/007)のAnchorパターン確認~~ → **完了**(2026-07-29、Resolved)。
2. ~~Issue-026(Ossicular Procedure Classification Audit)の着手判断~~ → **完了**(2026-07-29クローズ)。
3. ~~「5. Anchor分岐 最終整理」の案A/B/C選択~~ → **完了**(案B採用、2026-07-30実施)。
4. 次はKnown Limitationsに残るteachingPoints文言(case-004/012)の見直しへ進む。

## No inference added

本文書はshojiさんが示した検証結果・判断方針をそのまま記録・整理したものであり、新たな臨床的
判断・数値の推定は加えていない。Extension Proposalの表・partial症例の「未確認」表記も、
既存の型定義(`ossicularStatus.malleus`の3状態)と Step B回答の突き合わせによる整理である。
