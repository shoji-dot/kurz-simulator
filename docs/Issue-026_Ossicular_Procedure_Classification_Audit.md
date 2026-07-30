# Issue-026: Ossicular Procedure Classification整合性監査

**Status**: case-001・case-011・case-005分は解決・実装済み(2026-07-29)。いずれもIII型へ統一した
(`docs/Issue-026_Case001_Confirmation_v1.0.md`・`docs/Issue-026_Case011_Confirmation_v1.0.md`・
`docs/Issue-026_Case005_Confirmation_v1.0.md`参照)。case-005については、II型の定義自体が
incus absentの症例にそもそも当てはまるかという医学的精査はshojiさんが今後耳鼻科医へ別途
依頼予定であり未確定(Pending)。**次はProcedure分類ルールAddendum作成**(shoji指定順序④)。

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

1. ~~case-001のtags.procedure「II型」は、JOS2010のⅡ型定義…~~ **解決済み**。shojiさんの
   回答「Ⅲ型への表記変更が必要」を受け、`src/data/cases.ts`のcase-001を修正した(title/
   description/tags.procedureの3箇所、下記実装内容参照)。
2. ~~case-011(`incus: partial`)のtags.procedure「II型」は妥当か…~~ **解決済み**。
   `docs/Issue-026_Case011_Confirmation_v1.0.md`でshojiさんに確認(「1.無い。2.使っていない。
   3.良い。」)、キヌタ骨長突起残存部は術中に除去され再建経路に関与しないと確認できたため、
   case-001と同じ理由でII型→III型に修正した(title/description/teachingPoints[0]/
   tags.procedureの4箇所)。
3. ~~case-005のtags.procedureは「鼓室形成II型変法」だが…~~ **解決済み**。
   `docs/Issue-026_Case005_Confirmation_v1.0.md`でshojiさんに確認。「変法」は難症例で
   あることを示す注記として扱い、III型へ統一(title/tags.procedure/コード内コメントの
   3箇所)。なお、II型の定義自体がincus absentの症例に本来当てはまるかという医学的精査は
   今後耳鼻科医へ別途依頼予定(Pending、shoji方針)。

## 実装内容(case-001、完了)

`src/data/cases.ts`のcase-001を以下の通り修正(コミット、下記参照)。

- `title`: 「症例1: キヌタ骨欠損（II型）— PORP」→「症例1: キヌタ骨欠損（III型）— PORP」
- `description`: 「鼓室形成II型の適応」→「鼓室形成III型の適応」
- `tags.procedure`: `['鼓室形成II型', 'PORP']`→`['鼓室形成III型', 'PORP']`

teachingPointsにII/III型の言及はなく変更不要(確認済み)。検証は`ts.transpileModule`による
構文チェック(診断0件)のみ実施、プロジェクト全体のBuild/Lintはsandbox環境のI/O速度により
未完了(Issue-027と同じ制約、下記参照)。

### 決定記録(shojiさんレビュー、2026-07-29、正式版)

> case-001は「鼓室形成II型」ではなく「鼓室形成III型」へ修正する。
>
> 理由: malleus intact、incus absent、stapes suprastructureであり、PORPをツチ骨柄下から
> アブミ骨頭へ介在させる再建経路は、JOS2010分類ではⅢi-M（アブミ骨-ツチ骨間再建）相当となる。
> case-008と構造的に同一であり、ツチ骨柄残存のみを根拠にII型と分類することは不適切。
>
> なお「ツチ骨柄残存＝II型」という簡略基準は廃止し、今後は再建経路（接続先）を基準に分類する。

### Procedure分類の新原則(次Addendumで正式化予定)

上記決定により、`cases.ts`全体のprocedure分類は以下の原則へ更新する方針が確定した。

```
旧: malleus状態(intact/partial/absent) → procedure
新: 再建経路(何が何に接続されるか) → JOS2010分類 → procedure表示
```

この原則の正式なAddendum文書化は、case-011確認・case-005確認の後にまとめて行う
(shoji指定順序、下記「次の進め方」参照)。

## 副次的に発見・修正した別件(症例表示順バグ)

本Issue対応中にshojiさんがGUIで、症例選択画面の表示順(`cases.ts`末尾の
`.sort((a,b) => a.id.localeCompare(b.id))`によるid昇順表示)と、各症例`title`内に
埋め込まれた手書きの症例番号("症例N:")が食い違っていることを発見した。

原因: `title`文字列内の番号は配列の**挿入順**(case-001, 004, 002, 003, 005, ...)を基準に
振られていたが、表示は`id`昇順にソートされるため、挿入順とid順がずれるcase-002/003/004の
3件でnumberの食い違いが生じていた。

| Case | 修正前title内番号 | 修正後 |
|---|---|---|
| case-002 | 症例3 | 症例2 |
| case-003 | 症例4 | 症例3 |
| case-004 | 症例2 | 症例4 |

3件とも`title`文字列のみの修正(表示テキストのみ、`id`・ロジックへの影響なし)。修正済み。

## 優先度・スコープ

優先度: 中。P3-EA系列(Evidence Acquisition)の直接のブロッカーではなく、教育コンテンツの
用語正確性に関わる論点。**P3-EA-2のスコープには含めず、本Issueとして独立管理する**
(理由: case-008個別の問題ではなく、「malleus intact + procedure classification」という
`cases.ts`全体の整合性に関わる横断的論点のため、[[project_kurz]]方針)。

コード変更は行わない。まずshojiさんに1・2の確認を依頼し、回答を得てから対応要否を判断する。

## 次の進め方(shoji指定順序、2026-07-29)

```
① case-001修正確認        完了
② case-011確認            完了
③ case-005のII型変法問題   完了
④ procedure分類ルールAddendum作成   完了(docs/Issue-026_Procedure_Classification_Addendum_v1.0.md)
```

**本Issue-026は①〜④すべて完了、正式にクローズする。** 全15症例のtags.procedure棚卸し結果
(PORP8件=III型で統一、TORP4件=IV型で統一、Soft Clip3件=既存表記のまま整合)はAddendum文書
参照。

## 参照

- `docs/P3-EA-2_Step_B_Response_Record_v1.0.md`(Q4-008、Finding 4)
- `docs/P3-EA-3_Evidence_Validation_v1.0.md`(Finding 4節、本Issueへの切り出し経緯)
- `docs/Issue-026_Case001_Confirmation_v1.0.md`(case-001確認記録)
- `src/data/cases.ts`(case-001/002/003/004/005/008/011)
- 「伝音再建法の分類と名称について（2010）」日本耳科学会用語委員会報告(shoji提示)
