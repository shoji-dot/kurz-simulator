# Issue-026 Addendum: Procedure Classification Principle v1.0

**Status**: Completed
**Date**: 2026-07-29
**位置づけ**: `docs/Issue-026_Ossicular_Procedure_Classification_Audit.md`(調査Issue)で
case-001/005/011の3件を個別確認した結果を踏まえ、`cases.ts`の`tags.procedure`(鼓室形成術の
型表記)全体に適用する原則を正式に文書化する(shoji指定順序④)。**P3-2 Clinical GT
Definition(Anchor定義、Frozen)とは別軸の文書であり、P3-2本文は変更しない。**

---

## 1. 原則(確定)

```
旧: malleus状態(intact/partial/absent)だけを見てprocedureを決める
新: 再建経路(何が何に接続されるか) → JOS2010分類 → procedure表示
```

判断手順:

1. 実際の再建経路(clinicalNotesの記述、術中の処置内容)を確認する。
2. JOS2010(「伝音再建法の分類と名称について2010」日本耳科学会用語委員会報告)の定義に
   照らして分類する(Ⅰ〜Ⅳ型、アブミ骨手術は別カテゴリ)。
3. `ossicularStatus`の値(malleus/incus/stapesの状態)は、再建経路を読み解くための手掛かりの
   1つに過ぎず、それ単独でprocedureを決定しない。

**背景**: 「ツチ骨柄残存＝II型」という簡略基準(case-004/012のteachingPointsに残っていた
旧来の説明)は、malleus状態とprocedureを直結させる考え方であり、今回のcase-001/005/008/011の
確認で成立しないことが判明した(いずれもmalleus intact/partialだが、PORPで再建する限り
JOS2010のⅢi-M相当であり、II型ではない)。

### 表記の二層構造(UI表記とEvidence Layer)

「Ⅲ型」と「Ⅲc/Ⅲi-M相当」は矛盾する表記ではなく、抽象度が異なる二層である。

```
UI(tags.procedure)
　鼓室形成III型

Evidence Layer(判断根拠、PORP Anchor Definition手順)
　・Ⅲc相当(軟骨再建面 → Stapes Head)
　・Ⅲi-M相当(ツチ骨柄 → Stapes Head)
```

`tags.procedure`はJOS2010の大分類(Ⅰ〜Ⅳ型)のみを表示し、Ⅲc/Ⅲi-Mの内訳は表示しない。
内訳の判断手順は
`docs/P3-EA-2_Step_B_Additional_Confirmation_Malleus_Partial_Anchor_Review_Response_v1.0.md`
「PORP Anchor Definitionの最終形」を参照。

## 2. 決定ログ(Issue-026を通じた変更履歴)

| Case | 修正前 | 修正後 | 理由 | Commit |
|---|---|---|---|---|
| case-008 | III型(変更なし) | III型 | Step B Q4で先行確認、malleus intact+PORPインターポジションはIIIi-M相当 | `9c34dad`(記録) |
| case-001 | II型 | III型 | case-008と同一構造(malleus intact/incus absent、PORPをツチ骨柄下〜アブミ骨頭間に設置) | `49e6d66` |
| case-011 | II型 | III型 | 術中にキヌタ骨長突起残存部を除去しPORP設置、再建経路はcase-001と同一。「II型」は臨床像の呼称としても使われていなかったとshoji確認 | `542d16f` |
| case-005 | II型変法 | III型 | 再建経路はcase-001/011と同一。「変法」は難症例(ツチ骨柄菲薄化・固定不完全)を示す注記として扱う。**II型定義自体がincus absent症例に当てはまるかという医学的精査は今後耳鼻科医へ別途依頼予定(Pending)** | `f29291d` |

## 3. 現状棚卸し(全15症例、2026-07-29時点で整合性確認済み)

上記4件の修正を反映した結果、`cases.ts`全15症例の`tags.procedure`は以下の通り一貫した状態に
なっている(スクリプトで実データを確認、推測ではない)。

| 製品カテゴリ | 該当症例 | tags.procedure | 備考 |
|---|---|---|---|
| PORP | case-001,003,004,005,007,008,011,012(8件) | 鼓室形成III型(全件で統一) | 全件、PORPによるアブミ骨上部構造への再建(Ⅲc/Ⅲi-M相当) |
| TORP | case-002,006,009,013(4件) | 鼓室形成IV型(全件で統一) | 全件、底板上再建(JOS2010のⅣ型定義と整合、footplate-only) |
| Soft Clip Stapes | case-010,014,015(3件) | アブミ骨手術/Stapedotomy/ピストン法 | Wullstein I-IV型の枠組みとは別カテゴリ(JOS2010の「アブミ骨手術」節)、II/III/IV型ラベルを使わない現行表記のままで整合 |

**結論**: 本Addendum作成時点で、PORP8症例は全件III型、TORP4症例は全件IV型に統一されており、
`tags.procedure`とJOS2010分類の間に既知の不整合は残っていない。

## 4. Known Limitations / Pending事項

- **JOS2010におけるII型の適用範囲(case-005由来の論点)**: 残る論点は「III型かII型か」では
  ない(Issue-026の結論により実務上は既にIII型へ変更済み)。残るのは「JOS2010のII型定義が
  incus absentの症例(本来は耳小骨連鎖が保たれている前提の分類)にそもそも適用可能かという、
  定義の解釈そのもの」である。JOS2010におけるII型の適用範囲について、教育資料作成上の参考
  として耳鼻科専門医へ確認予定。現在のSimulator実装(III型)は変更予定なし。
- **Soft Clip Stapes(Stapedotomy)のAnchor定義**: `docs/P3-EA-3_Evidence_Validation_v1.0.md`
  で既に「Pending Clinical Confirmation」と記録済み。本Addendumのprocedure表示原則とは
  独立した論点(Anchor定義はP3-2/P3-EA系列の管轄)。
- **teachingPoints内の一般的な解説文**: case-004/012に残る「ツチ骨柄残存→II型、なし→III型」
  という簡略説明は、今回の原則変更を踏まえると学習者向けの説明としては不正確または不十分に
  なった可能性がある。**本Addendumでは変更していない**(該当症例のtags.procedure自体は
  既にIII型で一貫しており、教育文言の書き換えは別途の判断が必要なため、次セッション以降で
  shojiさんと相談する)。

## 5. 次のステップ

Issue-026(調査Issue)は本Addendumの作成をもって①〜④すべて完了。次はP3-EA系列
(`docs/P3-EA-3_Evidence_Validation_v1.0.md`)のRecommended Actionsに残っている
「Anchor分岐案のP3-2への反映方式」の判断に戻るか、あるいはKnown Limitationsで挙げた
teachingPoints文言の見直しに進むか、shojiさんと相談して決定する。
