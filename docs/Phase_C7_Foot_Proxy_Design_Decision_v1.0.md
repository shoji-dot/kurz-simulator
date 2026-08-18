# Phase C-7 (継続調査): Foot Proxy Design Decision v1.0

**Status**: **Decision Formalized（Architect承認済み、DECIDED）**
**Date**: 2026-08-18
**位置付け**:
```
C-7
├─ Foot Proxy Design Requirements Investigation（v1、PUSHED済み、Evidence Status Annotation追加、未Commit）
├─ Cross-Case Validation（未Commit）
├─ Q1 Follow-up: Original Evidence Reconstruction（未Commit）
├─ Q1 Grid-Search Follow-up: Historical Condition Reconstruction（未Commit）
├─ Evidence Status Consolidation（未Commit）
└─ Proxy Design Decision（本文書、Formal Decision — Architect承認済み）
```
本文書はCode変更を一切行わない。正式Decisionを記録するのみで、Candidate B変更・
Proxy実装・Tolerance変更のいずれも今回は実施しない（実装が必要になった場合は
別途新たなArchitect指示を起点とする）。

```
C-7 Proxy Design Decision = DECIDED — OPTION A（Architect承認済み）
```

**Formal Architect Decision**:
```
C-7 Proxy Design Decision
= OPTION A — KEEP CURRENT CANDIDATE B
```

**Decision Meaning（正確な意味）**: これは`Candidate B is proven optimal`という
意味ではない。正確には、以下のEvidence-based conservative decisionである:
```
Current Evidence
        ↓
No concrete defect evidence against Candidate B
        ↓
Insufficient evidence to justify proxy redesign
        ↓
Keep current Candidate B
```

**Scope Boundary**: 本Decisionにより`C-7 Proxy Design Decision = DECIDED`と
するが、これは将来のProxy Design変更を永久禁止するものではない。
```
Future Proxy Redesign = possible if new evidence justifies it
```

---

## 1. Current Evidence

### 1.1 Primary Evidence（正式採用済み、`docs/...Evidence_Status_Consolidation_v1.0.md` §16で決定）

```
Pattern A — Common Structural Pattern
Clean Baseline Pose + ±5° sweep
  8/8 evaluable BELL cases（case-001, 003, 004, 005, 007, 008, 011, 012）
  gap(t) < 0（Region 1全域で安全側）
  minimum required-radius の位置 = t=0 (rim)
  Region 1 crossover = none
```

現行`basePos`選択（`STAPES_HEAD`）・実project関数・実Bone.glb・実MeshBVHで再現可能。

### 1.2 Historical Evidence（Secondary、Status維持）

```
Historical Region-1 Finding
= Secondary / Historical Evidence
= Source Condition Unresolved
= Qualitative reproduction only
= Root Cause Unconfirmed
```

`t≈0.19`・`required-radius≈0.012mm`・Region 1 crossoverはClean Baselineでは再現
されていない。`STAPES_FOOTPLATE`では8/8条件で定性的類似性（positive rim gap、
interior minimum、crossover）が得られたが、historical magnitude・historical t
positionとの定量的一致はない。`Historical basePos = STAPES_FOOTPLATE`とは決定
しない（既にEvidence Status Annotationで確定済み）。

### 1.3 Candidate B現状

```
Foot #0 = 0.7950 mm
Foot #1 = 0.7704 mm
Foot #2 = 0.6028 mm
Status  = Diagnostic / Provisional / UNCHANGED
```

C-7 Investigation全体を通じて、Candidate Bを変更する根拠となるConcrete Defect
Evidenceは得られていない。

### 1.4 独立した確認済みEvidence（C-7 v1 §4、Geometry-only、Bone非依存）

参考として、C-7 v1 §4・C-5 §4は、`BellFoot()`実形状とSphere Proxyの間に
Envelope形状ミスマッチ（rim/mid実固体断面積がEnvelope比6〜8倍過小等）が
存在することを、Bone.glbとは無関係な純粋Geometry比較として既に確認している。
これはConfirmed Evidenceだが、それ単独では「Sphere Proxyが誤り」という結論には
直結しない（§4 Important Reasoning Constraint参照）。

## 2. Decision Options

### Option A — Keep Current Candidate B

現行のCandidate B / Sphere-based proxyを維持する。

### Option B — Replace with More Anatomically Faithful Proxy

Multi-sphere / Convex hull / Geometry-derived proxy / Hybrid proxyのいずれかへ
変更する。

### Option C — Defer Proxy Redesign

現行Candidate Bを維持しつつ、追加Evidence取得後に再判断する。

## 3. Advantages / Disadvantages / Evidence Support

### Option A — Keep Current Candidate B

**Advantages**:
- Primary Evidence（Pattern A、8/8 BELL cases）と直接整合する。
- 実装リスクを増やさない（Regression riskゼロ）。
- Evidence lineage全体（C-5 Round1〜C-7全調査）が一貫して「Concrete Defect
  Evidenceなし」と結論しており、それとも整合する。
- Decisionを明確に確定でき、Evidence debtを閉じる（Historical Findingは
  Secondary Evidenceとして記録済みのまま、Decisionの妨げにしない）。

**Disadvantages**:
- Real Foot ≠ Sphereという形状差（§1.4）は未解消のまま残る。
- Historical Findingの完全な説明にはならない（Source Condition Unresolvedの
  まま）。
- Clean Baseline + ±5°を超えるRotation境域は未検証のまま
  （Cross-Case Validation §12 Q3、既知のGap）。

**Evidence Support**: 強い直接支持（Primary Evidenceと一致）。

### Option B — Replace with More Anatomically Faithful Proxy

**Advantages**:
- Real Foot ≠ Sphereという形状ミスマッチ（§1.4、Confirmed）への対応にはなる。
- Historical Findingが「もし」実在の現象だった場合、より安全側に倒せる
  可能性がある（ただし未確認）。

**Disadvantages**:
- **Real Foot ≠ Sphereであることだけを理由にはできない**（§4 Important
  Reasoning Constraint、本Task指示で明示的に禁止）。
- C-7 v1自身のTrade-off Matrix（§9）が既に示す通り、形状忠実度を上げる
  Option（Multi-sphere/Convex hull/Geometry-derived）は、いずれもRegion 1
  相当のgap(t)>0問題への対応にならない（Proxy形状変更では解決しない構造的
  制約）。
- Historical Findingの Source Condition が未解決のため、「何を修正目標に
  するか」自体が定義できない（target fittingになりかねない）。
- 実装・検証コストが高く、Regression riskを新たに生む
  （coordinate-transform関連は本プロジェクトで過去に複数回バグの温床と
  なった実績あり）。

**Evidence Support**: 現時点では不十分。Concrete Defect Evidenceが存在しない
（C-5 §9、Cross-Case Validation §6-9で確認済み）。

### Option C — Defer Proxy Redesign

**Advantages**:
- Option Aと同様、コード変更なしでRegression riskゼロ。
- Historical Findingを将来のEvidenceで再評価する余地を明示的に残す。

**Disadvantages**:
- 追加Evidence（exact basePos、exact offset等）の入手経路が実質的に尽きて
  いる——Git history探索（Q1 Follow-up §4.1）・Evidence-grounded Grid
  Search（Grid-Search §3-§9）は既に実施済みで、これ以上のarchival
  investigationは新情報を生まない可能性が高い。
- 「新しいEvidenceが得られるまで」という条件が具体的な取得手段
  （実機再テスト等）を伴わない限り、実質的にOption Aと同じ状態が
  無期限に継続するだけになりうる（Evidence debtを未決のまま先送りする）。

**Evidence Support**: Option Aと同程度（Pattern Aと整合、追加変更は求めない）。
ただしOption Aより意思決定としては弱い（結論を出していない）。

## 4. Decision Criteria評価

| Criterion | Option A | Option B | Option C |
|---|---|---|---|
| Evidence strength | 強い直接支持（Pattern A） | 不十分（Concrete Defect Evidenceなし） | Aと同程度だが未決 |
| Cross-case consistency | 8/8 casesと整合 | 目標未定義のため評価不能 | Aと同一 |
| Historical compatibility | Secondary Evidenceとして記録・説明はしない | Historical Findingの目標未確定のため直接対応不可 | Aと同一、将来対応の余地を残す |
| Clinical / educational safety | 0.15mmはClinical Thresholdとして扱わない前提を維持、Pattern Aの範囲内でのみ安全性を主張 | 未定義の変更は安全性向上を保証しない | Aと同一 |
| False positive risk | 現状維持（既知） | 新Proxyの再チューニングコスト・新たな過大/過小表現リスク | Aと同一 |
| False negative risk | ±5°を超える範囲は未検証（既知のGap、A/B/C共通） | 未定義のためRisk評価不能 | Aと同一 |
| Implementation risk | ゼロ | 高い（座標変換関連のRegression実績あり） | ゼロ |
| Validation burden | なし | 高い | なし |
| Reversibility | 高い（いつでも再検討可能） | 低い（一度実装すると後戻りコストが発生） | 高い |
| Evidence debt | Historical Findingは記録済みのまま残すが、Decision自体は確定 | 新たなEvidence debt（未定義の設計目標）を生む | 未決のまま先送り、debtは実質的に残る |

## 5. Important Reasoning Constraint（適用確認）

```
Real Foot ≠ Sphere  →  Sphere Proxy is wrong  は導けない。
```
§1.4の形状ミスマッチはConfirmed Evidenceだが、これ単独でOption Bを正当化しない。

```
Historical Region-1 Finding was observed  →  Current Candidate B causes the finding  は導けない。
```
Historical FindingはSource Condition Unresolvedであり、現行Candidate Bとの
因果関係は確認されていない（実際、Clean BaselineでCandidate Bは一貫して
clear——§1.1）。

```
STAPES_FOOTPLATE gives qualitative reproduction  →  Historical condition was STAPES_FOOTPLATE  は導けない。
```
Evidence Status Annotationで既に確定済みの区別を維持する。

いずれの禁止された推論もOption Bの根拠として使用していない。

## 6. Formal Decision（Architect承認済み）

```
Decided Option = A — Keep Current Candidate B
```

Architect Reviewにより、Option Aが正式なC-7 Proxy Design Decisionとして承認された
（§0「Formal Architect Decision」参照）。以下§7は、この決定に至ったRationale
（Option B/Cを採用しなかった理由を含む）の記録である。

## 7. Decision Rationale

1. **Primary Evidence（Pattern A）が直接支持する**唯一のOptionはAである。
   8/8 evaluable BELL casesで、Clean Baseline + ±5° sweepの下、Candidate Bは
   Boneから一貫してclearであり、これはCandidate Bを変更する必要がないことを
   支持する、現行repository/asset/pipelineで再現可能な直接Evidenceである。

2. **Option BはEvidence不足**である。Real Foot ≠ SphereというConfirmed
   Evidence（§1.4）は存在するが、本Task §4/§8の明示的制約により、それ単独では
   Proxy変更の根拠にならない。Historical Findingは、Source Condition
   Unresolvedのため、Option Bの具体的な設計目標（何を・どこまで修正するか）
   すら定義できない。

3. **Option Cは実質的にOptionAと同じ帰結になりやすい**。C-7の一連の調査
   （Q1 Follow-up + Grid-Search）は、Git history探索とEvidence-grounded
   parameter reconstructionという、Documentation-only Investigationとして
   合理的な手段を既に尽くしている。これ以上の"追加Evidence"は、実機再テスト
   （本Taskのスコープを超える、別種の調査）を伴わない限り得られる見込みが
   低い。したがって、明確な取得計画のないまま"Defer"を選ぶことは、
   Decisionを確定させないままEvidence debtを先送りするだけになりうる。

4. **Option Aは可逆的である**。Candidate Bを"確定"として扱うことは、将来
   真に新しいEvidence（特に実機での広域Rotation境界探索、または
   Historical Source Conditionの新たな手がかり）が得られた場合に再検討する
   ことを妨げない。Historical Region-1 Findingは削除せず、Secondary Evidence
   として文書に残されている（Evidence Status Annotation）ため、再評価の
   足がかりは保持されている。

## 8. Remaining Evidence Gaps（Decision後もUnresolvedとして保持）

```
[1] Historical Region-1 FindingのSource Condition（basePos/offset/厳密な
    case識別子等）は未解決のまま（§1.2、Q1 Follow-up §5, §9）。

[2] Historical Root Cause = UNCONFIRMED（§1.2, §5）。STAPES_FOOTPLATEは
    strongest hypothesisのままだが、Root Causeとしては認定しない。

[3] Clean Baseline ±5°を超えるRotation境界（実際のBoundary Warp探索等）は、
    本C-7調査全体を通じて未検証である（Cross-Case Validation §12 Q3）。
    これはOption A/B/Cいずれの選択でも解消されない、独立したGapである。

[4] STAPES_FOOTPLATE仮説（basePos/reference point）の定量的検証は完了して
    いない（Grid-Search §6-8、最良候補でも約34倍の乖離）。

[5] non-BELL cases（TORP/Piston、footType≠BELL、7 Training Cases）の
    Collision安全性は、本C-7調査の対象外のまま残る（Cross-Case Validation §4）。
```

**明示的な注記**: `8/8 BELL cases clear`（Pattern A、§1.1）は、
`all 15 training cases are proven safe`を意味しない——BELL/PORP以外の
7 cases（TORP/Piston）はC-7 Evidence Scopeの対象外であり（[5]）、Current
C-7 evidence scopeを超える事項について、本Decisionは新たな結論を作らない。

## 9. Implementation Decision（Formal）

```
Candidate B                = UNCHANGED
Foot Proxy                 = UNCHANGED
Collision Engine           = UNCHANGED
CollisionResult            = UNCHANGED
FOOT_CONTACT_TOLERANCE_MM  = UNCHANGED
Scoring                    = UNCHANGED
C-2〜C-6                    = UNCHANGED

実装影響 = ゼロ
```

Candidate B・Foot Proxy・`FOOT_CONTACT_TOLERANCE_MM`・Collision Engine・
`CollisionResult`・Scoring・C-2〜C-6のいずれも変更しない。Multi-sphere・
Convex hull・Geometry-derived proxy・Region-specific hybrid・Region-aware
toleranceのいずれの実装にも着手しない。

本Decision（Option A）はProxy Designに関するEvidence-based Decisionの確定で
あり、実装Taskそのものではない。将来、新たなEvidence（§8参照）に基づき
Proxy Design変更が検討される場合も、そのImplementation Taskは別途、新たな
Architect指示を起点とする。

---

## 10. 参照

- `docs/Phase_C7_Foot_Proxy_Design_Requirements_Investigation_v1.0.md`（§4, §9, §16 — Geometry Evidence、Trade-off Matrix、Evidence Status Annotation）
- `docs/Phase_C7_Foot_Proxy_Cross_Case_Validation_v1.0.md`（§6-9 — Pattern A、Historical Finding非再現）
- `docs/Phase_C7_Foot_Proxy_Original_Evidence_Reconstruction_v1.0.md`（§4-9 — Source Condition追跡）
- `docs/Phase_C7_Foot_Proxy_Historical_Condition_GridSearch_v1.0.md`（§5-9 — STAPES_FOOTPLATE仮説検証）
- `docs/Phase_C7_Foot_Proxy_Evidence_Status_Consolidation_v1.0.md`（§8-17 — Evidence Confidence、Architect Decision = Option A採用）
- `docs/Phase_C5_Foot_Collision_Representation_Investigation_v1.0.md`（§9, §12 — Concrete Defect Evidenceなし、の既存判断基準）
