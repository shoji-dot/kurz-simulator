# P3-EA-2 Step B: 専門家レビュー ヒアリングフォーム v1.0

**Status**: Draft(shoji回答待ち)
**Date**: 2026-07-29
**位置づけ**: `docs/P3-EA-1_Evidence_Acquisition_Plan_v1.0.md`のStep B(専門家レビュー)。
`docs/P3-EA-2_Step_A_Existing_Evidence_Organization_v1.0.md`(commit `0b881ba`)で整理した
case-004/008/012の既存記載を踏まえ、shojiさんの専門的臨床判断(Evidence B)を記録する質問票。
**本文書はStep Aの整理結果を前提とし、新たなStep Aの再整理は行わない。**

## 記入方法

- 各質問は自由記述。数値のみの回答を強制しない(P3-EA-1「取得するのは正解ではなく判断根拠」)。
- 「わからない」「特に根拠なし」も有効な回答。Unknownとして記録する([[feedback]]方針)。
- 3症例共通の質問(Q1)は1回のみ回答。症例別の質問(Q2〜)は3症例それぞれに回答。
- 回答内容は`docs/P3-EA-1_Evidence_Acquisition_Plan_v1.0.md`で提案した`EducationalReferenceRecord`
  型(`anchorDefinition`/`measurement`/`evidence`/`validationStatus`)に対応する形でP3-EA-3以降に
  整理する(本フォーム自体はコード実装しない)。

---

## Q1(Priority 1・症例横断): Anchor起点の確認

Step Aで、PORP症例間でAnchorの記載が2種類あることを確認した。

```
case-004 / case-012: 軟骨再建面 → アブミ骨頭部
case-008          : ツチ骨柄下 → アブミ骨頭部
```

**質問**:

1. この違いは症例の解剖学的状態(ツチ骨の有無: case-008はmalleus intact、case-004/012は
   malleus absent)による必然的な違いか、それとも症例作成時の表現の揺れか。
2. 実際のPORP長選択(length selection)のワークフローでは、ツチ骨柄が残存している場合と欠損して
   いる場合とで、基準点(Anchor)の考え方は変わるか。変わる場合、どう変わるか。
3. 上記を踏まえ、PORPのAnchor定義(現行: 「TM(または軟骨再建面)→Stapes Head」)は、
   ツチ骨柄残存例と欠損例を区別せず1つの定義として扱ってよいか、あるいは区別すべきか。

**回答欄**:

```
(shoji記入欄)
```

---

## Case-004

**参照**: Step A記載(`docs/P3-EA-2_Step_A_Existing_Evidence_Organization_v1.0.md` Case-004節)。
recommendedLength=2.0mm、clinicalNotes「軟骨〜アブミ骨頭間距離をサイザーで実測。約2.0mm」。

### Q2-004(Priority 2): サイズ選択根拠

1. 本症例で2.0mmを選んだ最大の理由は何か。
2. 1サイズ上(2.5mm)または下(1.5mm)を選ばなかった理由は何か。
3. Bell部の設置安定性(seating/stability)は、サイズ選択の判断に影響したか。

**回答欄**:

```
(shoji記入欄)
```

### Q3-004(Priority 3): 軟骨補正の考え方

Step Aで、本症例のclinicalNotesには軟骨補正量(Layer1→2)への言及がないことを確認した。

サイズ決定にあたり、軟骨(耳珠軟骨)の厚みを考慮したか。考慮した場合、どのように考慮したか
(具体的な数値でなくてよい)。

**回答欄**:

```
(shoji記入欄)
```

---

## Case-008

**参照**: Step A記載(Case-008節)。recommendedLength=2.5mm、clinicalNotes「ツチ骨柄下〜アブミ骨頭間
距離を実測（2.5mm）」。

### Q2-008(Priority 2): サイズ選択根拠

1. 本症例で2.5mmを選んだ最大の理由は何か。
2. 1サイズ上(3.0mm)または下(2.0mm)を選ばなかった理由は何か。
3. 外傷性(交通事故後)という背景が、通常例と比べてサイズ選択に影響する要素はあるか
   (例: 組織腫脹・瘢痕・耳小骨位置のずれ等)。

**回答欄**:

```
(shoji記入欄)
```

### Q3-008(Priority 3): 軟骨補正の考え方

本症例は鼓膜が無穿孔(外傷性耳小骨離断、鼓膜正常)と記載されている。軟骨再建を伴う他2症例
(case-004/012)と異なり、軟骨補正(Layer1→2)という概念自体が本症例に当てはまるか。当てはまらない
場合、その理由も記録したい。

**回答欄**:

```
(shoji記入欄)
```

### Q4-008(Priority 4): II型/III型判定の整合性

Step Aで、以下の不整合を確認した(既存記載同士の比較のみ、判断は加えていない)。

```
case-008: tags.procedure = 「鼓室形成III型」、ossicularStatus.malleus = intact

一方、case-004/012自身のteachingPointsに記載された判定基準:
「ツチ骨柄が残存していればII型、なければIII型」
```

**質問**:

1. case-008はmalleus intact(ツチ骨柄残存)であるため、上記基準に従うとII型に該当するように
   読めるが、この理解は正しいか。
2. 正しい場合、`tags.procedure`の「III型」表記は修正が必要か(修正が必要な場合、修正案は
   別途Claude Codeへの実装依頼として整理する。本フォームでは判断のみ確認する)。
3. 誤りである場合、外傷性耳小骨離断特有の事情でIII型分類が妥当となる理由があるか。

**回答欄**:

```
(shoji記入欄)
```

---

## Case-012

**参照**: Step A記載(Case-012節)。recommendedLength=2.0mm、clinicalNotesはcase-004とほぼ同一の
文面パターン(「軟骨〜アブミ骨頭間距離をサイザーで実測。約2.0mm」)。

### Q2-012(Priority 2): サイズ選択根拠

1. 本症例で2.0mmを選んだ最大の理由は何か。
2. 1サイズ上(2.5mm)または下(1.5mm)を選ばなかった理由は何か。
3. case-004とclinicalNotesの文面がほぼ同一だが、これは意図的な典型例の反復か
   (difficulty: beginnerの入門症例として、case-004(intermediate)と同じ臨床像をより単純化した
   ものか)、それとも独立に設定された値か。

**回答欄**:

```
(shoji記入欄)
```

### Q3-012(Priority 3): 軟骨補正の考え方

サイズ決定にあたり、軟骨(耳珠軟骨)の厚みを考慮したか。考慮した場合、どのように考慮したか
(具体的な数値でなくてよい)。

**回答欄**:

```
(shoji記入欄)
```

---

## 次のステップ

本フォームへの回答をもって、Step B(専門家レビュー)の記録が完了する。回答内容は
P3-EA-3(Evidence Validation)以降で、`EducationalReferenceRecord`提案フィールドへの
マッピング・整理に用いる予定(本フォーム段階ではコード実装・型への投入は行わない)。
