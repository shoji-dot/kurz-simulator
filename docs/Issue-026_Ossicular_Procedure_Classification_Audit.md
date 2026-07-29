# Issue-026: Ossicular Procedure Classification整合性監査

P3-EA-2 Step B(`docs/P3-EA-2_Step_B_Response_Record_v1.0.md`、commit `9c34dad`)のQ4回答で
判明した論点を、独立した調査専用Issueとして切り出す。**不具合の確定ではなく、確認が必要な
論点の記録**である(調査Issueと修正Issueを区別する方針、[[feedback]]のIssue-021運用を踏襲)。

## 内容

`cases.ts`の`SurgicalCase.tags.procedure`(鼓室形成術の型表記)は、`ossicularStatus.malleus`
との対応関係が症例間で一貫しているかを確認していない。

Step B(Q4-008)で、shojiさんから以下の見解を得た(参照: 「伝音再建法の分類と名称について
（2010）」日本耳科学会用語委員会報告、以下JOS2010)。

> Ⅲ型の3cはツチ骨、キヌタ骨があっても経由せず、アブミ骨上部からプロステーシスを立てて鼓膜に
> 接続する。3iはアブミ骨とツチ骨との間、またはアブミ骨とキヌタ骨の間にプロステーシスを設置
> して連鎖を再建する。Ⅱ型はキヌタ骨上に鼓膜を形成する。以上のことから、ツチ骨柄が残存して
> いてもⅢ型の場合がある。

この見解により、case-008(`malleus: intact`、tags.procedure=「III型」)は、JOS2010の
**Ⅲi-M(Ⅲ型インターポジション、アブミ骨-ツチ骨間)** に相当し、tags表記は妥当と確認できた
(`docs/P3-EA-2_Step_B_Response_Record_v1.0.md`のQ4-008節、Step Aで指摘した不整合は撤回済み)。

一方、`cases.ts`には`malleus: intact`かつtags.procedure=「II型」と表記されている症例が
他に2件存在し、同じ論点が当てはまるかは未確認のまま残っている。

| Case | malleus | incus | stapes | tags.procedure | clinicalNotes上のPORP設置記述 |
|---|---|---|---|---|---|
| case-001 | intact | absent | suprastructure | 鼓室形成II型 | 「ツチ骨柄下に頭板を合わせるため…」 |
| case-008 | intact | absent | suprastructure | 鼓室形成III型 | 「ツチ骨柄下〜アブミ骨頭間距離を実測」 |
| case-011 | intact | partial | suprastructure | 鼓室形成II型 | (軟骨グラフト併用の記述のみ、malleus/incus接続の明記なし) |

**観察(判断は加えていない)**: case-001とcase-008は、`malleus`/`incus`/`stapes`の構造的状態が
同一(intact/absent/suprastructure)であり、clinicalNotesの記述("ツチ骨柄下"にPORPを設置)も
類似しているにもかかわらず、tags.procedureはそれぞれ「II型」「III型」と異なる。case-008が
JOS2010のⅢi-Mとして妥当と確認された以上、**同じ構造を持つcase-001のタグが「II型」のままで
よいか**は、tags.procedureとJOS2010の対応を厳密に確認しないと判断できない。

case-011は`incus: partial`であり、case-001/008(`incus: absent`)と構造が異なるため、
上記2件とは別に個別確認が必要。

## 確認が必要な事項

1. case-001のtags.procedure「II型」は、JOS2010のⅡ型定義(「キヌタ骨上に鼓膜を形成する」)と
   整合するか、それともcase-008同様Ⅲi-M相当であり表記修正が必要か。
2. case-011(`incus: partial`)のtags.procedure「II型」は妥当か。`incus: partial`という状態が
   JOS2010の分類上どう扱われるか(部分残存キヌタ骨がある場合の扱いはJOS2010原文に明記が
   ない可能性があり、追加確認が必要)。
3. 上記1・2の結果次第で、`cases.ts`の`tags.procedure`修正が必要になる場合、影響範囲
   (該当症例のみか、teachingPoints内の説明文にも影響するか)を整理してからClaude Codeへの
   実装依頼として起票する。

## 優先度・スコープ

優先度: 中。P3-EA系列(Evidence Acquisition)の直接のブロッカーではなく、教育コンテンツの
用語正確性に関わる論点。**P3-EA-2のスコープには含めず、本Issueとして独立管理する**
(理由: case-008個別の問題ではなく、「malleus intact + procedure classification」という
`cases.ts`全体の整合性に関わる横断的論点のため、[[project_kurz]]方針)。

コード変更は行わない。まずshojiさんに1・2の確認を依頼し、回答を得てから対応要否を判断する。

## 参照

- `docs/P3-EA-2_Step_B_Response_Record_v1.0.md`(Q4-008、Finding 4)
- `docs/P3-EA-3_Evidence_Validation_v1.0.md`(Finding 4節、本Issueへの切り出し経緯)
- `src/data/cases.ts`(case-001/008/011)
- 「伝音再建法の分類と名称について（2010）」日本耳科学会用語委員会報告(shoji提示)
