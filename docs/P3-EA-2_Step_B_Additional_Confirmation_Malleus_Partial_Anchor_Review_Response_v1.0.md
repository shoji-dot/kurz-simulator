# P3-EA-2 Step B追加確認 回答記録: Malleus Partial Anchor Review v1.0

**Status**: Completed (Evidence Review Recorded)
**Date**: 2026-07-29
**位置づけ**: `docs/P3-EA-2_Step_B_Additional_Confirmation_Malleus_Partial_Anchor_Review_v1.0.md`
(commit `9262321`)へのshojiさん回答を記録する。Evidence B(専門的臨床判断)として扱う。

---

## Q1: partial malleus症例のAnchor基準点 — 回答記録

> 症例ごとに判断。

**Evidence記録**: `ossicularStatus.malleus: partial`という型情報単独からAnchorを一意に
決定することはできない。個々の症例のnarrative記述(description/clinicalNotes/コード内コメント)
を確認し、機能的にツチ骨柄が連鎖に関与しているかどうかで判断する必要がある。

## Q2: partial malleusはintact側/absent側のどちらに近いか — 回答記録

未回答(空欄)。ただしQ1回答(症例ごとに判断)・Q4-003/Q5-007回答から、**一律にintact側/absent側
いずれかへ寄せることはできない**ことが実質的に示されている。

## Q3: partial malleusを別カテゴリとして扱うべきか — 回答記録

> Ⅲi

**記録上の注記**: この回答はQ1(症例ごとに判断)・Q4-003(case-003は実質absent)という
個別回答と一見テンションがある(Ⅲiは「Ⅲ型インターポジション」全般を指す語であり、特定の
Anchorパターンではない)。**新規の解釈は加えず、そのまま記録するに留める**。次回、
「partialを分類する際の一般的な参照枠組みとしてⅢiを使う」という意図か、それとも別の意図かを
確認したい場合は改めてヒアリングする。

## Q4-003: 「ツチ骨柄なし」という記述とpartialの関係 — 回答記録

> ①より②の方が適切のように思う。初回手術の際に、コレステアトーマによりツチ骨・キヌタ骨を
> 除去と書いてあるので、partial(部分)もツチ骨は残っていないと考えられる。

**Evidence記録**: case-003の`ossicularStatus.malleus: partial`という型設定は、症例のnarrative
(コレステアトーマによる摘出)と整合しない可能性が高いとの専門的判断を得た。**`cases.ts`の
データ修正候補として扱う**(下記Recommended Actions参照、本文書ではコード変更を行わない)。

## Q5-007: narrative記述とコード内コメントの食い違い — 回答記録

> ツチ骨柄は形態的に存在するが、キヌタ骨との関節が未形成。と書いてあるので、両方とも成立し得る
> ように思う。一応解剖学的にツチ骨が存在するが、キヌタ骨と繋がっていないから伝音を伝える役割を
> 果たしていないという意味だと思われる。

**Evidence記録**: case-007は解剖学的にはツチ骨柄が存在する(clinicalNotesの「ツチ骨柄下〜
距離」という記述はこの意味で成立する)が、キヌタ骨との連結がないため**伝音の連鎖には関与
していない**。したがって、length selection/Anchorという機能的観点では、ツチ骨柄を経由しない
直接設置(Ⅲc相当)に近い扱いになると考えられる。コード内コメント「ツチ骨柄なし相当のため
直置き」は、この機能的な意味において成立している。**data修正は不要**(narrative記述と
コードコメントは、それぞれ解剖学的事実と機能的扱いという異なる観点を述べており、矛盾ではない)。

---

## 結論: PORP Anchor Definition Extension Proposal(確定版)

`docs/P3-EA-3_Evidence_Validation_v1.0.md`のFinding 3で「未確認」としていたmalleus:partialの
扱いについて、以下の通り確定する。

**malleus: partialは固定の第3Anchorパターンではない。** `ossicularStatus.malleus`の値だけを
見て機械的にAnchorを決定するのではなく、各症例のnarrative記述(除去済みか、菲薄化しているが
残存か、解剖学的に存在するが機能的に非連結か)を個別に確認する必要がある。

| Case | malleus型 | narrative上の実態 | 機能的Anchor分類 |
|---|---|---|---|
| case-003 | partial(型設定は要見直し候補) | 除去済み(absent相当) | Ⅲc相当: 軟骨再建面 → Stapes Head |
| case-005 | partial(型設定は妥当) | 菲薄化・残存・連鎖に関与 | Ⅲi-M相当: ツチ骨柄 → Stapes Head |
| case-007 | partial(型設定は妥当、解剖学的に存在) | 解剖学的に存在するが機能的に非連結 | Ⅲc相当(機能面): 軟骨再建面/直接設置 → Stapes Head。ただしclinicalNotesの距離記述はツチ骨柄を空間的な目印として使用 |

**PORP Anchor Definitionの最終形(3値の型ではなく判断手順として記録)**:

```
1. まずmalleus: absentか確認 → Ⅲc(軟骨再建面 → Stapes Head)
2. malleus: intact/partialの場合、narrative記述で機能的にツチ骨柄が連鎖に関与しているか確認
   - 関与している(例: case-005/008) → Ⅲi-M(ツチ骨柄 → Stapes Head)
   - 関与していない、または解剖学的に存在するのみ(例: case-007) → Ⅲc相当(軟骨再建面/直接設置)
3. `ossicularStatus.malleus`の型値のみでは判定を確定しない(narrative確認が必須)
```

この手順化は、P3-2 Frozen本文を直接書き換えるのではなく、P3-EA系列の追補(判断手順の明文化)
として保持する(Strangler Pattern、これまでの方針を継続)。

---

## Recommended Actions(更新)

1. **case-003の`ossicularStatus.malleus`型値見直し提案**: shojiさんの回答(Q4-003)を根拠に、
   `partial`→`absent`への変更を提案する。ただし本文書はコード変更を行わない。影響範囲
   (`ossicularStatus.malleus`を参照する箇所、例: `SimScene.tsx`のbasePos決定ロジック等)を
   整理した上で、別途Claude Codeへの実装依頼として起票するか確認する
   (`docs/Issue-027_Case003_MalleusStatus_Field_Review.md`として起票予定、下記参照)。
2. **P3-2への反映**: 上記「PORP Anchor Definitionの判断手順」をP3-2本文に追記するか、
   本文書(P3-EA系列)のみに留めるかは、Issue-026対応後にまとめて判断する(Frozen Layer
   変更をまとめて一度に検討する方が影響範囲整理の手間が少ないため)。
3. **次のステップ(shoji指定順序を継続)**: Issue-026(case-001確認、次いでcase-011)へ進む。

## No inference added

本文書はshojiさんの回答をそのまま記録したものである。「Extension Proposal(確定版)」の
手順化は、Q1(症例ごとに判断)・Q4-003・Q5-007の3回答を単純に統合した結果であり、新たな
臨床的判断を加えていない。Q3(「Ⅲi」)とQ4-003(case-003は実質absent)の間に見えるテンションは
解消せず、そのまま記録している。
