**Status**: Resolved・実装済み(2026-07-29)。shojiさんへの確認質問「ツチ骨モデルを表示する
教育的意図はあるか」に対し「完全欠損症例として非表示でよい(推奨案を採用)」との回答を得て、
`src/data/cases.ts`のcase-003 `ossicularStatus.malleus`を`'partial'`→`'absent'`へ変更した。

# Issue-027: case-003 `ossicularStatus.malleus`型値の見直し候補

`docs/P3-EA-2_Step_B_Additional_Confirmation_Malleus_Partial_Anchor_Review_Response_v1.0.md`
(Q4-003)で判明した論点を、独立した修正候補Issueとして起票する。**shojiさんの専門的判断により
修正が妥当そうだと確認できているが、影響範囲整理が未了のためコード変更はまだ行わない**
(調査Issueと修正Issueの区別、[[feedback]]のIssue-021運用を踏襲)。

## 内容

`src/data/cases.ts`のcase-003は`ossicularStatus.malleus: 'partial'`と設定されているが、
同症例のdescription・clinicalNotes・teachingPointsの3箇所すべてが「ツチ骨・キヌタ骨は
コレステアトーマにより除去」「ツチ骨柄なし」「ツチ骨柄がないため」と一貫して記述しており、
`partial`(部分残存)ではなく`absent`(完全欠損)を指しているように読める。

shojiさんへの確認(Q4-003)で、以下の回答を得た。

> ①より②の方が適切のように思う。初回手術の際に、コレステアトーマによりツチ骨・キヌタ骨を
> 除去と書いてあるので、partial(部分)もツチ骨は残っていないと考えられる。

(①=「`partial`は『ツチ骨柄として機能していない残存』を指しており記述として問題ない」、
②=「`cases.ts`側の型設定が実際は`absent`寄りの状態を指す症例で、型設定自体の見直しが必要」)

## 影響範囲(コード調査結果、変更前の事前確認)

`ossicularStatus.malleus`の値は以下の箇所で参照されており、`partial`→`absent`に変更した場合、
**単なるラベル修正ではなく描画・UI挙動が変化する**。

- `src/scenes/SimScene.tsx:820`付近: `status === 'partial' ? 0.45 : undefined`という記述があり、
  `partial`は透明度0.45の半透明描画("ghost"相当)に使われている。`absent`に変更すると、
  この症例のツチ骨モデルは非表示(hidden)扱いに変わる可能性が高い。
- `src/components/StepFlowMode.tsx:31`: `s === 'absent' ? 'hidden' : s === 'partial' ? 'ghost' : 'solid'`。
  同様に、UI上の耳小骨表示モード(hidden/ghost/solid)が変わる。
- `src/components/StepFlowMode.tsx:451`: `partial`は`footplate-only`と共に別グループとして
  扱われている箇所があり、他のロジックへの波及可能性も要確認。
- その他、`ossicularStatus.malleus`を参照する箇所が`OssicleModels.tsx`/`RealAnatomyModels.tsx`/
  `RealEarScene.tsx`/`AnatomyScene.tsx`/`DrillTrainingScene.tsx`/`SimulationMode.tsx`/
  `LearningMode.tsx`/`caseGenerator/internal/caseMappings.ts`にも存在するが、`partial`固有の
  分岐があるかは本Issueでは未調査(`SimScene.tsx`/`StepFlowMode.tsx`以外は`malleus`参照の有無を
  確認したのみで、`partial`分岐の有無は未確認)。

**結論**: `partial`→`absent`への変更は、教育的に正しい方向(narrativeとの整合性向上)である
可能性が高いが、**3Dビジュアル(ツチ骨モデルの表示/非表示)が変わる**という副作用を伴う。
この変更が意図した挙動か(除去済みなら本来非表示が正しい、という理解でよいか)をshojiさんに
確認してから実施する。

## 確認事項への回答・実施結果

1. **「`partial`→`absent`変更後の非表示は教育的に正しいか」**: shojiさんへAskUserQuestionで
   確認。「完全欠損症例として非表示でよい」を選択(コレステアトーマによる完全除去例であり、
   見せるべき残存構造がないという理解で一致)。
2. 他症例(case-005/007)には同様の変更は不要(Step B追加確認で個別確認済み、`partial`型設定
   自体は妥当と判断済み、本Issueの対象外)。
3. `caseGenerator/internal/caseMappings.ts`等、`malleus`を参照する他ファイルにcase-003固有の
   ID参照は見つからなかった(`grep case-003`は`src/data/cases.ts`のみヒット)。`partial`固有の
   分岐ロジック自体(`SimScene.tsx`/`StepFlowMode.tsx`の透明度・表示モード切替)は他症例
   (case-005/007)にも適用され続けるため影響なし。

## 実装内容(完了)

`src/data/cases.ts`のcase-003(120行目付近)の`ossicularStatus`を
`{ malleus: 'partial', incus: 'absent', stapes: 'suprastructure' }`から
`{ malleus: 'absent', incus: 'absent', stapes: 'suprastructure' }`へ変更。変更理由を
コード内コメントとして併記(Issue-027・shoji確認日付を明記)。

**検証**: TypeScriptコンパイラAPI(`ts.transpileModule`)による構文チェックで診断0件を確認。
`npx tsc -b`/`npx eslint`によるプロジェクト全体のBuild/Lintはsandbox環境のI/O速度により
今回セッション内で完了確認できなかった(45秒のコマンドタイムアウトを複数回超過、変更内容とは
無関係な環境要因)。`'absent'`は同ファイル内の他症例(例: case-002/004等)で既に使用されている
`OssicleStatus`型の既存メンバーであり、型エラーが生じる可能性は極めて低い。**shojiさんの
ローカル環境で`npm run build`/`npm run lint`を実行し、最終確認をお願いしたい**
(Verification Order: Build→Type Check→Lintの最終ステップ)。

## 優先度・スコープ(実施済みのため参考情報として保持)

優先度: 低〜中。教育的正確性に関わるが、Safety Engine等のClinical Safety機能には影響しない
(型変更は表示/UIロジックへの影響のみ)。

## 参照

- `docs/P3-EA-2_Step_B_Additional_Confirmation_Malleus_Partial_Anchor_Review_Response_v1.0.md`(Q4-003)
- `src/data/cases.ts`(case-003、124行目)
- `src/scenes/SimScene.tsx`(820行目付近)
- `src/components/StepFlowMode.tsx`(31行目・451行目)
