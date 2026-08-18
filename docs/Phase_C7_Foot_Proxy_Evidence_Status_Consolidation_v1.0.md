# Phase C-7 (継続調査): Foot Proxy Evidence Status Consolidation v1.0

**Status**: Consolidation Complete（Read-only Documentation。本文書執筆時点はArchitect
Decision待ちだったが、その後Architectにより`C-7 Proxy Design Decision = DECIDED —
OPTION A — KEEP CURRENT CANDIDATE B`が正式決定された。`docs/Phase_C7_Foot_Proxy_
Design_Decision_v1.0.md`参照）
**Date**: 2026-08-18
**位置付け**:
```
C-7
├─ Foot Proxy Design Requirements Investigation（v1、PUSHED済み、今回無変更）
├─ Cross-Case Validation（未Commit、今回無変更）
├─ Q1 Follow-up: Original Evidence Reconstruction（未Commit、今回無変更）
├─ Q1 Grid-Search Follow-up: Historical Condition Reconstruction（未Commit、今回無変更）
└─ Evidence Status Consolidation（本文書）
```
C-8ではなく、C-7の後続Documentationとして扱う。C-6の予約は変更・上書きしない。
本文書はImplementation Taskではない。新規Grid Search・Proxy redesign・Tolerance
redesignは一切行わない。

---

## 1. Objective

C-7配下の4つのEvidence文書（Design Requirements Investigation、Cross-Case
Validation、Original Evidence Reconstruction、Historical Condition Grid-Search）を
一つの論理体系として整理し、case-001で過去に観測されたRegion-1 constraintについて、
**現在確認できるEvidence・再現できたEvidence・再現できないEvidence・未解決事項**を
明確に分離する。既存4文書はいずれも改変しない。

## 2. Scope / Non-scope

**Scope**: 既存4文書の内容整理・分類・Evidence Confidence評価・Open Questions統合。

**Non-scope**:
- 新規Grid Search、offset/rotation/axis fitting、parameter optimization
- Candidate B、Foot Proxy実装、`FOOT_CONTACT_TOLERANCE_MM`、Tolerance Policy、
  Collision Engine、`CollisionResult`、Scoringの変更
- C-2〜C-6の再開・変更
- 既存4文書の書き換え
- Proxy Design DecisionそのものやRegion-aware toleranceの導入判断

## 3. C-7 Evidence Timeline

```
2026-08-15（Project Memory、削除済みharness由来）
  Collision Attribution investigation → Foot #0/#1 Deep Dive
  → Foot Y-axis Fine-Sampling Deep Dive
  ("case-001"由来とラベル付けされた旧Evidence、
   required-radius(rim)≈0.172mm, minimum=0.012mm at t≈0.19)

2026-08-18 C-5 CLOSED / SPECIFICATION CLARIFICATION RECORDED
  （Contact/Tolerated Penetration/Penetration semantics確定、
    0.15mm=Provisional、本Consolidationの前提として維持）

2026-08-18 C-7 v1: Foot Proxy Design Requirements Investigation
  旧2026-08-15 Evidenceを「case-001 Baseline」として引用、
  Design Requirements/Findings/Option A-Gを整理。PUSHED（e2bb376）。

2026-08-18 C-7 Cross-Case Validation
  Clean Baseline Pose（basePos=STAPES_HEAD、現行正規経路）で
  8 BELL casesを再測定。旧Evidence（case-001含む）は
  Clean Baselineでは再現せず。全8caseでgap(t)<0、
  minimum=t=0、crossoverなしという別の一貫した
  Pattern（Pattern A、"consistently clear"）を発見。

2026-08-18 C-7 Q1 Follow-up: Original Evidence Reconstruction
  Git history（Step1-3）に旧harnessの痕跡なしを確認。
  Project Memory記述から測定条件を部分的に特定
  （shaftLength=2mm, baseline tilt=5°/tiltZ=0°）。
  STAPES_FOOTPLATE仮説を試行し、定性的近似（sign/shape一致、
  数値不一致）を発見。

2026-08-18 C-7 Q1 Grid-Search Follow-up
  Evidence-groundedな16条件（basePos×rotation×shaftLength/offset）
  でSTAPES_FOOTPLATE仮説を系統的に検証。8/8で定性的再現、
  0/16でStrong reproduction。crossover位置のみ定量的に近似。

2026-08-18 本Consolidation文書
```

## 4. Original C-7 Finding（Design Requirements Investigation, v1）

C-7 v1（`docs/Phase_C7_Foot_Proxy_Design_Requirements_Investigation_v1.0.md`）は、
「case-001 Baseline」として以下を引用した（出典: Project Memory、2026-08-15）:

```
required-radius(t)
  t=0.00 (rim)  : 0.172mm
  t≈0.19        : 0.012mm  ← 最小値
  t=1.00 (apex) : 0.636mm

gap(t) = realOuterRadius(t) − requiredRadius(t)
  t≈0.19        : +0.727mm（最大）
  t≈0.80        : 0（交差点）
  t=1.00 (apex) : −0.636mm
```

これを基に、Region 1（rim〜t≈0.80）でのgap(t)>0という構造的constraintを観測とし、
Design Findings（F1-F3）・Design Requirements（R1-R6）・7つのProxy Design
Options（A-F + Cross-cutting Policy Question G）を整理した。C-7 v1自体は
Architect Reviewを経て、既にPUSHED済みである。

## 5. Cross-Case Validation Result

`docs/Phase_C7_Foot_Proxy_Cross_Case_Validation_v1.0.md`は、Clean Baseline Pose
（`basePos=STAPES_HEAD`——現行の正規経路、`angleTiltZ=0`、dragOffset相当なし）と
±5° sweepで、評価可能な8つのBELL/PORP Training Case全件を実project関数・実
Bone.glb・実MeshBVHで測定した。

```
8 cases全件（case-001, 003, 004, 005, 007, 008, 011, 012）:
  gap(t) < 0（Region 1全域で安全側）
  minimum required-radius の位置 = 常に t=0 (rim)
  Region 1 crossover = なし
  required-radius(t=0) の範囲 = 2.2205mm 〜 2.2989mm（Baseline）
                                2.1706mm 〜 2.2411mm（±5° sweep worst-case）
```

case-001自身についても、C-7 v1が引用した旧数値（0.172mm/0.012mm）はClean
Baselineでは再現しなかった。

## 6. Historical Evidence Reconstruction（Q1 Follow-up）

`docs/Phase_C7_Foot_Proxy_Original_Evidence_Reconstruction_v1.0.md`は、旧数値の
発生源をGit history・既存文書・Project Memoryの順に追跡した。

```
Step1 (Git history): "0.012"/"required-radius"/"requiredRadius"の
  literal/semantic searchはC-7 v1自身のcommitのみヒット。
  旧harnessは一度もgit管理下に入っていない。

Step2 (既存文書): C-5文書には生データなし。唯一の出典はProject Memory。
  確認できた条件: TTP-VARIAC PORP, shaftLength=2mm,
  baseline tilt=5°/tiltZ=0°, candidate tilt=4.80°/tiltZ=0.20°
  （Phase-B-corrected pipeline使用、Memory本文に明記）。
  確認できなかった条件: basePos, offset, 厳密なcase識別子。

Step3 (reflog/dangling objects): stash由来のdangling commit 6件を
  個別確認、いずれも該当harnessを含まず。

Step4 (再現Harness): basePos=STAPES_FOOTPLATE仮説を試行し、
  rim gapが正転する・最小点がrimから内部へ移動するという
  定性的一致を確認（数値は不一致）。
```

## 7. Grid Search Result

`docs/Phase_C7_Foot_Proxy_Historical_Condition_GridSearch_v1.0.md`は、Evidence-
groundedな16条件（basePos 2 × rotation 2 × shaftLength/offset 4）で
STAPES_FOOTPLATE仮説を系統的に検証した。

```
STAPES_FOOTPLATE (8/8条件): 定性的パターン一貫再現
  （rim gap>0、interior minimum、crossover t≈0.73-0.81）
STAPES_HEAD (8/8条件): 再現なし
  （minimum=t=0、crossoverなし）

最良候補: basePos=STAPES_FOOTPLATE, tilt=5°/tiltZ=0°,
  shaftLength=2.5mm, offset=-0.2（case-001自身のパラメータ）
  → minimum t=0.3125（旧: t≈0.19、Δt=0.12、許容差0.05超過）
  → minimum required-radius=0.4098mm（旧: 0.012mm、約34倍の乖離）
  → crossover t=0.8128（旧: t≈0.80、Δt=0.013、唯一許容差内）

Strong reproduction = 0/16
Partial/Qualitative reproduction = 8/16（全STAPES_FOOTPLATE条件）
No reproduction = 8/16（全STAPES_HEAD条件）
```

## 8. Confirmed Evidence

現行repository・再現可能なmeasurementで確認できる事項:

```
[C1] 評価可能なBELL/PORP Training Caseは8件、Not evaluableは7件
     （footType≠BELLのため）。C-7 Cross-Case Validation §4で確定。

[C2] Clean Baseline Pose（basePos=STAPES_HEAD）+ ±5° sweepでは、
     評価可能な8 case全件でgap(t)<0（Region 1全域で安全側）、
     minimumは常にt=0、crossoverは存在しない。C-7 Cross-Case
     Validation §6-9で確定。

[C3] C-7 v1が引用した旧Figures（required-radius(rim)≈0.172mm、
     minimum=0.012mm at t≈0.19）は、Clean Baseline Pose
     （現行の正しいbasePos選択）では、case-001を含むいずれの
     評価可能caseでも再現しない。C-7 Cross-Case Validation §3, §6、
     Q1 Follow-up §7で確定。

[C4] STAPES_HEAD/STAPES_FOOTPLATE定数（2026-07-22以降）、
     Bone.glb（2026-07-21以降）はいずれも今日まで変更されていない
     ——資産/定数のdriftではない。Q1 Follow-up §4.2, §9で確定
     （Hypothesis 4棄却）。

[C5] Git historyには、旧harnessやその出力の痕跡が一切存在しない
     （commit search、reflog、dangling objectsのいずれも確認済み）。
     Q1 Follow-up §4.1で確定。

[C6] basePos=STAPES_FOOTPLATEを用いると、basePos=STAPES_HEAD
     （現行正規経路）とは異なり、rim付近でgap(t)>0・interior
     minimum・crossover存在という定性的パターンが、rotation/
     shaftLength/offsetの組み合わせを変えても一貫して現れる。
     Grid-Search §5, §7で確定（8/8 vs 0/8の完全分離）。
```

## 9. Unresolved Evidence

```
[U1] 旧C-7 measurementの正確なsource condition（basePos含む）は
     特定できていない。Q1 Follow-up §5, Grid-Search §9参照。

[U2] STAPES_FOOTPLATEが実際に旧measurementで使用されたか自体は
     未確認（qualitative matchはpossible contributing factorの
     Evidenceであり、使用の証明ではない）。

[U3] 旧Figuresの定量的不一致（約34倍の乖離）を説明する追加要因は
     未特定。basePos以外の要因（未知のreference point、Foot軸
     定義差、当時のharness固有の実装差異）の関与は排除できない。

[U4] 旧2026-08-15 Evidence自体が測定誤りだったのか、それとも
     Clean Baseline以外の正当なPose条件で実際に観測された現象
     だったのかは、いずれとも判定できていない。
```

## 10. Hypotheses

```
Hypothesis（強度: strongest unresolved hypothesis、Root Causeではない）:
basePos/reference point（STAPES_HEAD vs STAPES_FOOTPLATE、または
それに類する未特定のreference point）が、旧Figuresの定性的形状に
関与している可能性がある。

支持するEvidence: [C6]（8/8 vs 0/8の完全分離、rotation/shaftLength/
offset非依存の頑健性）。

反証されない代替Hypothesis: 追加の未特定要因（Foot軸定義差、
当時のharness実装差異等）が、basePos仮説だけでは説明できない
約34倍の定量的乖離を埋めている可能性（[U3]）。

明示的に採用しないHypothesis:
- 「旧2026-08-15 Evidenceは誤りだった」——Evidence不足のため
  採用しない（§7 Critical Wording参照）。
- 「Region 1 constraintは実在しない」——Clean Baselineで
  再現しないことは、Region 1 constraintが原理的に存在しない
  ことの証明ではない（同様にCritical Wording参照）。
```

## 11. Evidence Confidence

各Findingを4分類で明示する。

| Finding | 分類 | 根拠文書 |
|---|---|---|
| 8 case中BELL評価可能=8、Not evaluable=7 | **Confirmed** | Cross-Case Validation §4 |
| Clean Baseline + ±5°で全8caseがconsistently clear | **Confirmed** | Cross-Case Validation §6-9 |
| 旧Figuresの数値そのもの（0.172mm/0.012mm/t≈0.19） | **Unresolved**（当時の実測記録として存在するが、条件が復元できない） | Q1 Follow-up §3, §5 |
| 旧FiguresがClean Baselineで再現するか | **Confirmed = 再現しない**（否定形で確定） | Cross-Case Validation §6、Grid-Search §6 |
| basePos=STAPES_FOOTPLATEで定性的形状が一致するか | **Qualitative only** | Q1 Follow-up §8、Grid-Search §7 |
| basePos=STAPES_FOOTPLATEが旧測定条件だったか | **Unresolved** | Grid-Search §9 |
| 資産/定数drift（STAPES_HEAD/Bone.glb）の関与 | **Confirmed = 関与なし**（否定形で確定） | Q1 Follow-up §4.2, §9 |
| Case識別子誤帰属（case-011等）の関与 | **Confirmed = 関与なし**（否定形で確定） | Q1 Follow-up §9 |
| Region 1のgap(t)>0が全caseへ一般化するか | **Unresolved**（Clean Baselineでは確認されず、他Pose条件は未確定） | Cross-Case Validation §9, §11 |

## 12. Implications for Candidate B

```
Candidate B = UNCHANGED
```

本Consolidationは、Candidate Bの変更を要求するEvidenceを一切示さない。§8
[C2]（Clean BaselineでCandidate Bは全8caseで1.4〜1.9mm以上の余裕を持って
clear）はむしろCandidate Bの現状維持を支持する方向のEvidenceである。旧
Figuresが定量的に再現していない以上（§9 [U1]-[U3]）、Candidate Bの数値を
修正する根拠は今回のEvidenceからは導出しない。

## 13. Implications for Foot Proxy Design

```
Foot Proxy = UNCHANGED
```

C-7 v1のDesign Requirements/Findings（Region 1のgap(t)>0という観測に基づく
Option A-G）は撤回しない——旧Figures自体がClean Baselineでは非再現である
ことは、C-7 v1のEvidence源に関する未解決事項（§9, §11）として記録するに
留め、C-7 v1のRequirements/Findingsそのものを無効化する結論には至らない
（Evidence不足なため断定しない）。同時に、Cross-Case Validationが確認した
"Clean Baselineでは8 case全てclear"というPattern A（§8 [C2]）も、独立した
正当なEvidenceとして並記する。

```
Geometry constraint exists ≠ Proxy is defective
```
のCritical Wordingに基づき、いずれの方向にもProxy設計変更の要否を今回は
判断しない。

## 14. Implications for Tolerance Policy

```
FOOT_CONTACT_TOLERANCE_MM = UNCHANGED
Tolerance Policy = UNCHANGED
```

本ConsolidationからRegion-aware toleranceの導入判断は行わない。C-7 v1
§7.2のCross-cutting Policy Question（G）はOpen Questionのまま維持する
（§15 Q4/Q5参照）。0.15mmは引き続きProvisionalのままであり、Clinical
Safety Thresholdとしての意味づけはC-5同様、今回も一切行わない。

```
Clean Baseline is consistently clear ≠ Clinical safety proven
```

## 15. Open Questions

```
Q1. 旧C-7 measurementのexact source conditionは特定できるか。
    → Unresolved（§9 U1）。当時の実機ログ・harnessコードが
      現存しないため、新たなEvidenceが発見されない限り解決不能。

Q2. STAPES_FOOTPLATEが旧measurementに実際に使用されたか。
    → Unresolved（§9 U2）。Qualitative matchのみ、使用の
      直接証拠なし。

Q3. 旧Figuresの定量的不一致を説明するadditional factorは
    存在するか。
    → Unresolved（§9 U3）。basePos仮説だけでは約34倍の
      乖離を説明できない。

Q4. 旧C-7 Region-1 findingを将来のDesign Evidenceとして
    維持するか。
    → 未決定。Architect判断待ち。

Q5. Cross-Case Pattern-A（「Clean Baselineでは8 BELL casesが
    consistently clear」）をC-7のprimary evidenceとして
    採用するか。
    → 未決定。Architect判断待ち。

Q6. C-7 Proxy Design Decisionを実施する必要があるか。
    → 本文書執筆時点では未決定、`C-7 Proxy Design Decision = PENDING`の
      まま。（Post-Decision Note、2026-08-18追記: その後Architectにより
      `DECIDED — OPTION A — KEEP CURRENT CANDIDATE B`が正式決定された。
      `docs/Phase_C7_Foot_Proxy_Design_Decision_v1.0.md`参照）
```

## 16. Architect Decision

```
C-Phase Status（本文書執筆時点、変更なし）:
C-1 = CLOSED
C-2 = PASS / FROZEN
C-3 = PASS / CLOSED / FROZEN
C-4 = PASS / VERIFIED / CLOSED
C-5 = CLOSED
C-6 = RESERVED
C-7 = EVIDENCE REVIEW / DESIGN DECISION PENDING（本文書執筆時点）
```

**Post-Decision Note（2026-08-18追記）**: 本文書執筆時点ではC-7全体が
`EVIDENCE REVIEW / DESIGN DECISION PENDING`であったが、その後Architectにより
`C-7 Proxy Design Decision = DECIDED — OPTION A — KEEP CURRENT CANDIDATE B`が
正式決定された（`docs/Phase_C7_Foot_Proxy_Design_Decision_v1.0.md`参照、
commit `a89432b`）。本文書自体のEvidence Confidence分類（§8-§15）は変更しない。

本文書はArchitectがQ1-Q6（§15）を含む次のDesign Decisionを下すための整理
であり、いずれの選択も本文書では決定しない。想定される選択肢の例
（決定はしない）:

```
- 旧C-7 Region-1 findingを "Source Condition Unresolved"
  として正式に記録し、Cross-Case Pattern-A（consistently
  clear）をprimary evidenceとして採用する
- 旧C-7 Region-1 findingとCross-Case Pattern-Aの両方を
  並記Evidenceとして維持し、Proxy Design Decisionを
  さらに保留する
- 新たなHistorical Evidence（実機再テスト等）が得られるまで
  C-7全体をPendingのまま凍結する
- C-7 v1既存文書に、本Consolidationへの参照・注記を追加する
  別Documentation Taskを承認する
```

## 17. Conclusion

C-7配下の4つのEvidence文書を整理した結果、以下が明確になった:

1. **Confirmed**: Clean Baseline Pose（現行の正しいbasePos選択）では、
   評価可能な8 BELL Training Case全件でFoot Proxy・Foot Envelopeともに
   Boneから一貫してclearであり、旧C-7 Figures（Region 1 constraint）は
   case-001を含めいずれのcaseでも再現しない。
2. **Unresolved**: 旧Figures自体の測定条件（特にbasePos）は、Git
   history・既存文書・Project Memoryを尽くしても完全には特定できな
   かった。`basePos=STAPES_FOOTPLATE`は定性的パターンを一貫して再現する
   最有力の未確定Hypothesisであるが、定量的一致（約34倍の乖離）が
   得られておらず、Root Causeとしては認定しない。
3. **Not concluded**: Region 1 constraintが実在するか否か、Candidate B
   やFoot Proxyの設計を変更すべきか否か、Region-aware toleranceを
   導入すべきか否かは、本Consolidationのいずれの結論からも導出しない。

`Candidate B = UNCHANGED`、`Foot Proxy = UNCHANGED`、
`FOOT_CONTACT_TOLERANCE_MM = UNCHANGED`、`Tolerance Policy = UNCHANGED`を
維持する。C-2〜C-6のいずれも今回変更していない。本文書作成時点では
`C-7 Proxy Design Decision = PENDING`のまま、次のDesign Decisionを
Architectに委ねた（その後、Architectにより`DECIDED — OPTION A — KEEP
CURRENT CANDIDATE B`が正式決定された。`docs/Phase_C7_Foot_Proxy_Design_
Decision_v1.0.md`参照）。

---

## 18. 参照

- `docs/Phase_C7_Foot_Proxy_Design_Requirements_Investigation_v1.0.md`
- `docs/Phase_C7_Foot_Proxy_Cross_Case_Validation_v1.0.md`
- `docs/Phase_C7_Foot_Proxy_Original_Evidence_Reconstruction_v1.0.md`
- `docs/Phase_C7_Foot_Proxy_Historical_Condition_GridSearch_v1.0.md`
- `docs/Phase_C5_Foot_Collision_Representation_Investigation_v1.0.md`（Clean Baseline Pose定義、Contact/Penetration Semantics）
- `docs/Phase_C3_Prosthesis_Anatomy_Collision_Constraint_Freeze_v1.0.md`（C-6 Phase番号予約状況）
