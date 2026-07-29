# P3: Ground Truth Acquisition Plan 凍結 v1.0

**Status**: Completed
**Date**: 2026-07-29
**対象コミット**:
- `c39d1fd`(P3-1 Purpose)
- `f00117c`(P3-2 Ground Truth Definition)
- `ca7c662`(P3-3 Evidence Hierarchy Mapping)
- `5160d8d`(P3-4 Case Priority Definition)
- `abea2d9`(P3-5 Measurement Protocol/Data Format/Validation Criteria、Project Scope Note)

(origin/main = `abea2d9`まで確認済み)

**ベース文書**: `docs/P3_Ground_Truth_Acquisition_Plan_v1.0.md`(P3-0〜P3-5全節)。本Freeze文書は
その要点を1ページに集約したものであり、ベース文書を置き換えるものではない。詳細確認時は
ベース文書を参照する。

## 1. Scope

P3の目的(P3-1で確定): recommendedLengthの正誤判定ではなく、Clinical GT(Layer1: 解剖学的距離)
からSelected Length Record(Layer3: 実際の選択サイズ)へ至る変換過程を、Evidence付きで記録
可能にすることである。

**P3の範囲**: Evidence取得の計画策定(Layer1-4の定義・Evidence Hierarchy・優先順位・測定手順・
データ形式・検証観点の文書化)まで。**実際のEvidenceデータ取得はP3のスコープ外**(次Phaseで
実施)。

**非対象(4点、P3-1で固定・変更なし)**:
1. recommendedLengthの正誤判定
2. Bell Geometry(形状)の修正(Frozen Layer)
3. Pose Solver最適化([[pose_design_constraints]]P4系列の管轄)
4. 推測によるClinical GTの補完(実測値なしはUnknownと明記)

## 2. Decisions(確定事項)

| # | 決定内容 | 出典 |
|---|---|---|
| 1 | 用語規約: Clinical GT=Layer1、Compensation GT=Layer2、Selected Length Record=Layer3(=`recommendedLength`)、Geometry Capture=Layer4 | P3-0 |
| 2 | Clinical GT Definition v0.1: PORP=TM→Stapes Head(Definition Confirmed)、TORP=TM→Footplate(Definition Confirmed)、Soft Clip Stapes=Incus Long Process→Footplate(Pending Clinical Confirmation) | P3-2 |
| 3 | P3専用Evidence Hierarchy v1.0(A+/A/B/C)。Geometry Validation用・製品情報記述用とは別系統として新設 | P3-3 |
| 4 | 「Confirmed」の意味分離: Definition Status(基準点定義の確定)とLayer1 Data Availability(実測値の有無)は独立軸。Layer1実測値は全15症例でUnknown(製品カテゴリ問わず) | P3-3 |
| 5 | Case Priority: Priority1(case-004/008/012)→Priority2(残り9症例)→Priority3(Soft Clip 3症例)。Priorityの意味はEvidence取得着手順序であり、臨床的正しさの順位ではない | P3-4 |
| 6 | Measurement Protocol: PORP/TORPは既存Anchor定義を踏襲、本プロジェクト内で到達可能な最大Evidence=B。Soft ClipはAnchor定義自体のClinical Confirmationが測定手順確定より先決 | P3-5 |
| 7 | Data Format: `EducationalReferenceRecord`型を提案(`recommendedLength`とは別構造、ドキュメント上の提案のみ・コード未実装) | P3-5 |
| 8 | Validation Criteria: Layer1〜4individually、Layer1は「Expert-defined reference validation」(実患者実測検証ではない) | P3-5 |

## 3. Assumptions(前提、Project Scope Note)

2026-07-29、shojiさんへの直接確認により判明・確定した前提(ベース文書冒頭に配置、P3-0〜P3-5
全体に遡って適用):

- 15症例は**shojiさんが実際に執刀した患者記録ではなく、教育目的で作成した架空/合成シナリオ**
  である。
- 解剖モデルは症例別ではなく、**共有のOpenEar ALPHAデータセット**に基づく(コード確認:
  `RealAnatomyModels.tsx`の「same OpenEar ALPHA CT」コメント、`cases.ts`に症例別3Dモデル
  参照が存在しないこと)。
- したがって本書で扱うGround Truthは、患者固有のClinical Ground Truthではなく、**本プロジェクト
  の範囲内における教育的基準値(Educational Reference)**である。
- この前提により、Layer1でEvidence A+(術中直接実測)へ到達する経路は現時点で存在しない。
  到達可能な最大Evidenceは**B(shojiさんの専門的臨床判断)**。
- **用語は今回リネームしていない**: 上記前提により「Clinical GT」は実態としては「Educational
  Reference」に近いが、Small Change原則によりP3-0〜P3-4の既存記述は書き換えず、呼称統一は
  将来の検討事項として保持する。

## 4. Known Unknowns(未解決のまま残す事項、Blockerではない)

- Layer1実測値そのもの(全15症例、製品カテゴリ問わずUnknown)
- Layer2軟骨補正0.2mmの由来(症例固有値か一般値か、shoji口頭情報のみ)
- KURZカタログ「Functional Length」とLayer1(Anatomical Distance)の関係
- Soft Clip Stapes(Stapedotomy)のAnchor定義(Incus Long Process→Footplate)自体のClinical
  Confirmation
- Stapedotomyへの軟骨補正(Layer1→2)適用可否自体
- Priority1(case-004/008/012)の具体的なEvidence取得形式(ヒアリング形式か、既存clinicalNotes
  レビュー確定形式か、未定)

## 5. Next Phase: Evidence Acquisition

**開始条件**: 本Freeze文書(またはベース文書`docs/P3_Ground_Truth_Acquisition_Plan_v1.0.md`)を
ベースラインとする。

**最初のステップ**: Priority1(case-004/008/012)からのEvidence取得着手。ただし取得形式(4.節
既述)がまだ未定のため、まずこれをshojiさんと決定してから着手する。

**制約(Frozen Layer尊重)**: 本Freezeで確定したMeasurement Protocol/Data Format
(`EducationalReferenceRecord`型提案)/Validation Criteriaを変更する場合は、影響範囲を整理し
複数案を提示すること。P3-0〜P3-5の用語規約(Layer1-4、Confirmed/Pending、Priority1-3)は
次Phaseでも継続使用する。

## 6. 参照文書

- `docs/P3_Ground_Truth_Acquisition_Plan_v1.0.md`(本Freezeのベース文書、全節)
- `docs/P2_Measurement_Definition_v1.0.md`(Approved、P3の前提)
- `RecommendedLength_Audit_Template_2026-07-23.md`(OneDriveプロジェクトルート管理)

## 7. Final Status

```
P3
Status: Completed
Blocking Issue: None
Open Issues: なし(4.節のKnown UnknownsはBlockerではない)
Next Phase: Evidence Acquisition
  Priority1: case-004 / case-008 / case-012
  取得形式: 未定(次セッションでshojiさんと決定)
```
