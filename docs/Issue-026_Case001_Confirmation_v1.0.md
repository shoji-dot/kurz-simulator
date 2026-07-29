# Issue-026 case-001確認: II型表記の妥当性

**Status**: Draft(shoji回答待ち)
**Date**: 2026-07-29
**位置づけ**: `docs/Issue-026_Ossicular_Procedure_Classification_Audit.md`で保留にしていた
case-001の確認。shoji指定の順序(partial Anchor確認→Issue-026 case-001→case-011)に従い着手。

---

## 既存情報(判断は加えず引用)

| 項目 | 内容 |
|---|---|
| ossicularStatus | malleus: intact / incus: **absent** / stapes: suprastructure |
| tags.procedure | 「鼓室形成**II型**」、PORP |
| description | 「42歳女性。慢性中耳炎。鼓膜穿孔、**キヌタ骨欠損**。ツチ骨柄・アブミ骨上部構造は温存。**鼓室形成II型**の適応。PORP（ツチ骨柄下）を使用。」 |
| clinicalNotes | 「ツチ骨柄〜アブミ骨頭間距離は約2.5mm。軟骨片を頭板下に挿入し鼓膜穿孔を防止する。」 |

## 確認したい点

**JOS2010(伝音再建法の分類と名称について2010)のⅡ型定義**: 「キヌタ骨**上**に鼓膜を形成する」
(WullsteinⅡ型に相当)。この定義は、キヌタ骨が**残存し、その上にTMを直接形成する**(プロス
テーシスを介さない)ことを前提としているように読める。

一方case-001は`incus: absent`(キヌタ骨欠損)であり、PORP(プロステーシス)をツチ骨柄下に設置
している。これは構造として、Q4-008で確認したcase-008(`malleus: intact`/`incus: absent`、
PORPをツチ骨柄下〜アブミ骨頭間に設置)と**同一パターン**であり、Q4-008の回答ではこのパターンは
JOS2010のⅢi-M(Ⅲ型インターポジション、アブミ骨-ツチ骨間)に相当すると確認済み。

case-001とcase-008を構造だけで比べると、両症例ともmalleus intact・incus absent・stapes
suprastructureで、PORPをツチ骨柄下に設置する点も同じだが、tags.procedureはcase-001が
「II型」、case-008が「III型」と異なる。

**質問**: case-001も、case-008と同じ理由(JOS2010のⅢi-M相当)によりtags.procedureを
「III型」へ修正すべきか。それとも、本アプリ独自の簡略基準(case-004/012のteachingPointsに
ある「ツチ骨柄残存→II型、なし→III型」)をcase-001ではそのまま維持する理由があるか。

**回答欄**:

```
(shoji記入欄)
```

## (参考)修正した場合の影響

tags.procedureのみの変更であれば`src/data/cases.ts`のcase-001 1箇所の文字列変更で完結する
見込み(Issue-027のような3D表示への副作用は想定されない、`tags`は表示ラベル用途のため)。
ただし、description本文中の「鼓室形成II型の適応」という記述、およびteachingPoints
「PORP適応の典型例」等の説明文が「II型」を前提に書かれていないか確認が必要
(実装依頼前に該当箇所を洗い出す)。

## 次のステップ

回答を得たら`docs/Issue-026_Ossicular_Procedure_Classification_Audit.md`へ反映し、
その後case-011(`incus: partial`が追加条件のため分類難度が高い、shoji指定により最後に確認)へ
進む。
