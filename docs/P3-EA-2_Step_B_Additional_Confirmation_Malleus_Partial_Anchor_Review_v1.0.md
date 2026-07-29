# P3-EA-2 Step B追加確認: Malleus Partial症例 Anchor Review v1.0

**Status**: Draft(shoji回答待ち)
**Date**: 2026-07-29
**位置づけ**: `docs/P3-EA-3_Evidence_Validation_v1.0.md`のFinding 3(PORP Anchor Definition
Extension Proposal)で「malleus: partialの3症例(case-003/005/007)が未確認」と記録した点への
追加ヒアリング。**目的はcase-003/005/007の分類を確定することではなく、partial malleus症例の
Anchor workflow(基準点の考え方)を確認すること**(shoji方針)。回答後、Extension Proposalの
3分類目(absent/intact/partial)を完成させ、P3-2改訂の要否を判断する材料とする。

---

## 既存情報の整理(Step A相当、参考として先に提示)

新規の判断は加えず、`cases.ts`の既存記載のみを引用する。

| Case | ossicularStatus.malleus | description | clinicalNotes | teachingPoints/コード内コメント |
|---|---|---|---|---|
| case-003 | partial | 「ツチ骨・キヌタ骨はコレステアトーマにより**除去**」 | 「**ツチ骨柄なし**・アブミ骨頭部温存の条件下でPORPを直接アブミ骨頭部上に載置」 | 「III型再建…**ツチ骨柄がない**ため頭板の安定確保が最重要」 |
| case-005 | partial | 「ツチ骨柄**菲薄化**・一部癒着」 | 「**ツチ骨柄**〜アブミ骨頭間距離は約3.0mm…ツチ骨柄が**菲薄化**しているため頭板の支持面積確保が重要」 | (該当コメントなし) |
| case-007 | partial | 「ツチ骨柄は形態的に**存在するが**、キヌタ骨との関節が未形成」 | 「**ツチ骨柄下**〜アブミ骨頭間距離は約2.0mm」 | コード内コメント: 「先天性奇形では解剖構造は明瞭。**ツチ骨柄なし相当**のため直置き」 |

**観察1(case-003、判断は加えていない)**: `ossicularStatus.malleus`は`partial`(部分残存)だが、
description・clinicalNotes・teachingPointsの3箇所すべてが「ツチ骨柄なし」「除去」と記述して
おり、`partial`という型設定と一致しない。この症例のみ、narrative記述が一貫して「absent」を
指しているように見える。

**観察2(case-007、判断は加えていない)**: descriptionとclinicalNotesは「ツチ骨柄は形態的に
存在する」「ツチ骨柄下〜距離を計測」とAnchorとして機能する記述だが、コード内コメント
(`idealLateralOffset`直前)は「ツチ骨柄なし相当のため直置き」と逆の前提を記している。
同一症例内でnarrative記述とコード内コメントが食い違っている。

**観察3(case-005)**: description・clinicalNotesはいずれも「ツチ骨柄菲薄化(thinned、存在は
している)」で一貫しており、上記2件のような内部矛盾は見られない。

これら3件は既存記載同士の比較による観察であり、新規の医学的判断ではない。

---

## Q1: partial malleus症例のAnchor基準点

PORP/TORPのlength selection時、ツチ骨柄が部分的に残存している症例では基準点はどこになるか。

- [ ] ツチ骨柄残存部
- [ ] 軟骨再建面(TM側)
- [ ] 症例ごとに判断
- [ ] その他( 　　　　　 )

**回答欄**:

```
(shoji記入欄)
```

## Q2: partial malleusはintact側/absent側のどちらに近いか

臨床的な考え方として、partial malleus症例はmalleus intact側(Ⅲi-M相当)とmalleus absent側
(Ⅲc相当)のどちらに近い扱いになるか。

**回答欄**:

```
(shoji記入欄)
```

## Q3: partial malleusを別カテゴリとして扱うべきか

Anchor定義を教育用モデルとして記載する場合、partial malleus症例はabsent/intactとは別の
第3カテゴリとして扱うべきか、それともabsent/intactいずれかに統合してよいか。

**回答欄**:

```
(shoji記入欄)
```

## Q4-003(観察に基づく確認、任意): 「ツチ骨柄なし」という記述と`partial`の関係

case-003は`ossicularStatus.malleus: partial`だが、description・clinicalNotes・teachingPoints
すべてが「ツチ骨柄なし」「除去」と記述している(上記観察1参照)。これは、①`partial`が「ツチ骨柄
としては機能していない残存」を指しており記述として問題ない、②`cases.ts`側の型設定(`partial`)
が実際は`absent`寄りの状態を指す症例で、型設定自体の見直しが必要、のいずれか判断できるか。

**回答欄**:

```
(shoji記入欄)
```

## Q5-007(観察に基づく確認、任意): narrative記述とコード内コメントの食い違い

case-007はdescription・clinicalNotesが「ツチ骨柄は形態的に存在し、Anchorとして機能する」と
読める記述である一方、コード内コメント(`idealLateralOffset`直前)は「ツチ骨柄なし相当のため
直置き」と逆の前提を記している(上記観察2参照)。どちらがこの症例の実態を正しく表しているか、
あるいは両方とも成立しうる(例: 形態的には存在するが機能的にはAnchorとして使えない)か。

**回答欄**:

```
(shoji記入欄)
```

---

## 次のステップ

回答を得たら`docs/P3-EA-3_Evidence_Validation_v1.0.md`のFinding 3表(Extension Proposal)に
partial行を確定させ、P3-2改訂の要否(反映する場合は「P3-2 v1.1」か「P3-2 Addendum」か)を
判断する。その後、Issue-026(case-001/011のtags.procedure確認)に進む(shoji指定の優先順序、
2026-07-29)。
