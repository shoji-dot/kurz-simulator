# P3-EA-1: Evidence Acquisition Plan v1.0

**Status**: Draft
**Date**: 2026-07-29
**位置づけ**: P3(Ground Truth Framework、Status: Completed、`docs/P3_Freeze_v1.0.md`参照)の
「設計」フェーズを受け、「運用」フェーズへ移行するP3-EA系列の最初のサブフェーズ。P3自体は
凍結済みであり、本文書はP3の内容を変更せず、その上に新規フェーズとして追加する
(Strangler Pattern)。コード変更は行わない(P3同様、Definition/Plan文書)。

## P3-EA全体構成(shoji提示、2026-07-29)

```
P3-EA-1: Evidence Acquisition Plan(本文書)
P3-EA-2: Priority 1 Cases(case-004/008/012)
P3-EA-3: Evidence Validation
P3-EA-4: Evidence Integration
```

**命名の意図**: 「P4」は既存のPose Solver/Geometry系列(P4A/P4B/P4C、composeNormal関連)で
既に使用されており、無関係のフェーズに同名を割り当てると履歴が混同する。P3-EAはP3
(Ground Truth Framework設計)の運用フェーズと位置づけ、P4系列とは独立に管理する。

将来的な整理イメージ(shoji提示):

```
P3(Ground Truth Framework)
├── P3-0〜P3-5: Framework Design
├── P3 Freeze v1.0
└── P3-EA: Evidence Acquisition & Validation
```

## 目的

P3-EA-1の目的は、P3-5(`docs/P3_Ground_Truth_Acquisition_Plan_v1.0.md`)で確定した
Measurement Protocol/Data Format/Validation Criteriaが実際に運用可能かを、Priority1の
3症例(case-004/008/012、P3-4で確定済み)で試行する前に、取得プロセス自体の手順を固定する
ことである。

**重要な前提の再確認(P3 Freeze v1.0のAssumptions節を継承)**: 15症例は教育用の架空/合成
シナリオであり、実患者の実測によるEvidence A+の取得経路は存在しない。したがって本フェーズで
取得するのは「解剖学的な正解」ではなく、**shojiさんの専門的臨床判断とその根拠(判断根拠、
Evidence B)である**(shoji明言、2026-07-29)。

## 取得プロセス(2段階、shoji提示・2026-07-29)

Priority1の3症例それぞれについて、次の2段階を分離して実施する。

### Step A: 既存Evidenceの整理

**対象**: `clinicalNotes`、`recommendedLength`、症例作成時の記録(`cases.ts`)。

**作業**: 3症例それぞれについて、既存記載をP3-3で確立したEvidence Hierarchy(A+/A/B/C)・
P3-0のLayer分類(Layer1-4)へマッピングする。新規の判断・推測は加えない(既存記載の再整理
のみ)。

**成果物**: 症例別のEvidence状態一覧(既存記載の要約+Evidence Level+Layerの対応)。
「現在何が分かっているか」「どこが曖昧か」を症例ごとに明確化する。

### Step B: 専門家レビュー(shojiさん)

**対象**: Step Aで整理した3症例について、shojiさんに次の観点を確認する。

- TM(または軟骨再建面)からどこを基準に考えたか(Anchor定義の妥当性確認)
- なぜそのサイズ(`recommendedLength`)を選んだか(判断根拠)
- 他のサイズを採用しなかった理由
- Cartilage Compensationをどう考えたか(該当する場合)

**成果物**: 各症例のExpert-defined educational reference記録(Evidence B)。単なる
臨床観察記録ではなく、教育ケースに対する専門家基準という位置づけである。P3-5で提案した
`EducationalReferenceRecord`型のフィールド構成(`anchorDefinition`/`measurement`/`evidence`/
`validationStatus`)に準拠する形で内容を整理する。**ただしP3-EA-1は計画文書であり、実データの
記入・コード実装はP3-EA-2以降で行う**。

**`measurement`フィールドについての注記**: `measurement.valueMm`は実患者の実測値ではなく、
教育シナリオに対するshojiさんの専門的判断による基準値(expert-defined reference value within
the educational scenario)を表す。将来この型を実装する際は、フィールド名またはコメントで
この区別を明示すること(patient-specific measurementと誤解されないため)。

## Step AとStep Bを分離する理由(shoji指摘)

既存記録(Step A)と新規専門家レビュー(Step B)を同一作業内で混在させると、「症例作成時に
何を根拠にしていたか」と「今回新たに確認した判断根拠」の出典が区別できなくなる。P3-3で
確立したEvidence Hierarchy運用と同様、出典の異なる情報を安易に統合しない([[feedback]]の
Definition文書方針「根拠のない推測を書かずUnknownと明記する」の精神を継承)。

## 取得する情報の性質(shoji明言、2026-07-29)

P3-EAで取得するのは「正解」ではなく「判断根拠」である。例えば、TMからどこを基準に考えたか、
なぜそのサイズを選んだか、他サイズを採用しなかった理由、Cartilage Compensationをどう考えたか
(必要であれば)といった情報が記録できれば、教育シナリオとしての価値が高まる
(recommendedLengthという数値そのものの正誤判定ではないという、P3-1以来の非目的1を継承)。

## 次のステップ

本Planをshojiさんに確認のうえ、P3-EA-2(Priority 1 Cases: case-004/008/012)としてStep Aから
実際に着手する。
