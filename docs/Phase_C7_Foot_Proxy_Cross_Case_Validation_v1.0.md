# Phase C-7 (継続調査): Foot Proxy Cross-Case Validation v1.0

**Status**: Investigation Complete（Read-only。本文書執筆時点はArchitect Decision待ち
だったが、その後Architectにより`C-7 Proxy Design Decision = DECIDED — OPTION A —
KEEP CURRENT CANDIDATE B`が正式決定された。`docs/Phase_C7_Foot_Proxy_Design_
Decision_v1.0.md`参照）
**Date**: 2026-08-18
**位置付け**:
```
C-7
├─ Foot Proxy Design Requirements Investigation（docs/Phase_C7_Foot_Proxy_Design_Requirements_Investigation_v1.0.md、既存/PUSHED済み）
└─ Cross-Case Validation（本文書）
```
C-8ではなく、C-7の後続Investigationとして扱う。C-6（Malleus/Stapes Collision Expansion、
`docs/Phase_C3_..._Freeze_v1.0.md` §16予約）は変更・上書きしない。

**重要な先出し注記**: 本調査の結果、既存C-7文書（Design Requirements Investigation）が
「case-001 Baseline」として引用していた数値（`required-radius(rim)≈0.172mm`、
`t≈0.19で最小0.012mm`、Region 1で`gap(t)>0`）を、本文書で定義した再現可能な方法（Clean
Baseline Pose、実project関数・実Bone.glb・実MeshBVHを使用）では**再現できなかった**。
これは「Proxy再設計が不要になった」という意味ではなく、「既存C-7文書が引用した数値の
Pose条件が、Clean Baseline Poseと一致しない可能性が高い」という、Evidence追跡可能性上の
重大な指摘である。詳細は§3, §10, §12を参照。本文書はこの発見をそのまま報告し、隠蔽・
修正せずArchitectの判断を仰ぐ。

---

## 1. Objective

C-7 Foot Proxy Design Requirements Investigationでcase-001から観測された、Foot Geometry
とBone Clearanceの構造的constraint（`gap(t) = realOuterRadius(t) - requiredRadius(t) > 0`
がRegion 1: rim〜t≈0.80で恒常的に成立するという観測）が、他のTraining Caseでも再現する
一般的な現象なのか、それともcase-specificな現象なのかをEvidenceベースで検証する。

これはBug Fixではない。

```
NOT: "Fix Foot Collision"
YES: "Determine whether the geometric constraint observed in case-001
      generalizes across cases."
```

## 2. Scope / Non-scope

**今回のScope**:
- 15 Training Cases全件のCase Coverage確認（評価可能/不可能の分類）
- 評価可能なcase全件について、Foot軸（t=0 rim〜t=1 apex）上のrealOuterRadius(t)/
  requiredRadius(t)/gap(t)を、既存project関数・実Bone.glb・実MeshBVHで計算
- Region 1（0≤t≤0.80）でのgap(t)>0傾向の有無をcase別に記録
- Minimum clearance位置のcase間比較
- Pattern分類（A/B/C/D）
- Cause separation（Foot geometry/Bone geometry/Pose/Coordinate relationshipの寄与を、
  証明ではなくObserved correlationとして整理）

**Non-scope（今回実施していないもの）**:
- Candidate B、Foot Proxy実装、`FOOT_CONTACT_TOLERANCE_MM`、Collision Engine、
  `CollisionResult`、Scoringの変更
- Multi-sphere/Convex hull/Geometry-derived proxy/Region-specific hybrid/Region-aware
  toleranceの実装
- C-2/C-3/C-4/C-5/C-6の再開・変更
- Proxy redesignの要否判断（今回は決定しない）
- ±5°を超える広域Rotation Boundary探索（§12 Open Questionとして記録するに留める）

## 3. Existing C-7 Baseline

`docs/Phase_C7_Foot_Proxy_Design_Requirements_Investigation_v1.0.md` §5が「case-001
Evidence」として引用していた数値（Project Memory 2026-08-15、Foot Y-axis Fine-Sampling
Deep Dive由来）:

```
required-radius(t)   [case-001とされていた]
  t=0.00 (rim)  : 0.172mm
  t≈0.19        : 0.012mm  ← 最小値
  t=1.00 (apex) : 0.636mm

gap(t) = realOuterRadius(t) − requiredRadius(t)
  t≈0.19        : +0.727mm（最大）
  t≈0.80        : 0（交差点）
  t=1.00 (apex) : −0.636mm
```

本文書ではこれを**既存の前提**として受け取り、Clean Baseline Pose（idealAngle/
idealLateralOffset commit、angleTiltZ=0、dragOffset=0——C-5が定義した"Clean Baseline
Pose"と同一定義）でcase-001を再計算し、この前提が再現するかをまず確認した。

**結果（§5〜§6で詳述）**: 再現しなかった。case-001のClean Baseline Poseでの
`required-radius(t)`はt=0（rim）で**2.2896mm**であり、上記の0.172mmとは約13倍の乖離が
ある。§10でこの乖離の原因について、証明ではなくHypothesisとして整理する。

## 4. Case Selection

`src/data/cases.ts`の全15 Training Casesを対象に評価可能性を判定した。判定基準:
`buildProsthesisCollisionProxy()`（`prosthesisCollisionGeometry.ts:148-151`）は
`product.footType !== 'BELL'`の場合`null`を返す——すなわちBellFoot()/Candidate B
Geometryが一切使われない。したがって、本調査（Real Bell Foot ⇔ Bone Clearanceの検証）
は`footType==='BELL'`の製品を使うcaseのみ評価可能である。

`src/data/products.ts`確認: `footType==='BELL'`は`porp-ttp-variac`のみ（`torp-ttp-variac`
は`FLAT`、`soft-clip-stapes`は`PISTON`）。

| Case | 製品 | footType | 評価可能性 |
|---|---|---|---|
| case-001 | porp-ttp-variac | BELL | 評価可能 |
| case-002 | torp-ttp-variac | FLAT | **Not evaluable**（footType≠BELL） |
| case-003 | porp-ttp-variac | BELL | 評価可能 |
| case-004 | porp-ttp-variac | BELL | 評価可能 |
| case-005 | porp-ttp-variac | BELL | 評価可能 |
| case-006 | torp-ttp-variac | FLAT | **Not evaluable**（footType≠BELL） |
| case-007 | porp-ttp-variac | BELL | 評価可能 |
| case-008 | porp-ttp-variac | BELL | 評価可能 |
| case-009 | torp-ttp-variac | FLAT | **Not evaluable**（footType≠BELL） |
| case-010 | soft-clip-stapes | PISTON | **Not evaluable**（footType≠BELL） |
| case-011 | porp-ttp-variac | BELL | 評価可能 |
| case-012 | porp-ttp-variac | BELL | 評価可能 |
| case-013 | torp-ttp-variac | FLAT | **Not evaluable**（footType≠BELL） |
| case-014 | soft-clip-stapes | PISTON | **Not evaluable**（footType≠BELL） |
| case-015 | soft-clip-stapes | PISTON | **Not evaluable**（footType≠BELL） |

**評価可能: 8 cases**（case-001, 003, 004, 005, 007, 008, 011, 012——いずれもPORP/
`porp-ttp-variac`）。**Not evaluable: 7 cases**（TORP 4件、Stapedotomy/Soft Clip 3件——
理由はいずれも同一、footTypeがBELLでないためBellFoot()/Candidate B Geometryが対象外）。

全8 evaluable caseについて、`ossicularStatus.stapes`は全て`'suprastructure'`であり
（`src/scenes/SimScene.tsx:1198` `bellHeadAvailable = stapStatus==='intact' ||
stapStatus==='suprastructure'`）、`basePos`は全caseで`STAPES_HEAD`に統一される
（`SimScene.tsx:1200`）。

## 5. Measurement Method

既存project関数・実データをそのまま再利用し、独自座標系・推測値は作成していない
（新規に導入したのはBellFoot()のouterProfile公式の書き写しのみ、下記参照）。

**再利用した実装/データ（すべてsource追跡可能）**:

| 要素 | Source |
|---|---|
| Pose計算 | `computeProsthesisModelPose()`（`src/scenes/models/ProsthesisModels.tsx:1742-1762`、実関数をそのままimport） |
| Foot軸ローカル座標 | `footOff = -(shaftLength/2)`、`BELL_HEIGHT_MM`（`prosthesisCollisionGeometry.ts:156,160`と同一式） |
| Ancestor Transform | `coordGroupRef`回転 `Euler(π,-π/2,0,'XYZ')`（`SimScene.tsx:1824`、Ground Truth Transform STEP3で確定済み・C-5でも再利用） |
| Anatomy World Transform | `anatomyWorldTransform = ancestorMatrix × translate(GLB_OFFSET)`、`GLB_OFFSET=STAPES_FOOTPLATE`（`SimScene.tsx:151-154`と同一式、`anatomyCollisionIndex.ts`の`buildBvh()`と同一手法） |
| Bone Geometry | `public/models/Bone.glb`（実ファイル、`GLTFLoader.parse()`で読み込み、`findFirstMesh`は`anatomyCollisionIndex.ts:43-50`と同一ロジック） |
| BVH / 距離判定 | `three-mesh-bvh`（`^0.9.11`、実project依存） `MeshBVH.closestPointToPoint(point, undefined, 0, maxThreshold)` |
| realOuterRadius(t) | `BellFoot()`のouterProfile公式（`ProsthesisModels.tsx:1362-1376`）を書き写し（transcribe、独自導出ではない）。定数`BELL_RIM_RADIUS_MM`/`BELL_HEIGHT_MM`は実exportをimport、`SLIT_TOP_R=0.599`/`SLIT_H=0.717`は同ファイルのローカル定数を数値として転記 |
| Candidate B比較用 | `BELL_RIM_RADIUS_MM`（#0、実exportをimport）、`0.7704`/`0.6028`（#1/#2、`prosthesisCollisionGeometry.ts:132`の非export定数を数値として転記） |

**Temporary harness**: `scripts/tmp-c7-cross-case-clearance.ts`（esbuildでbundle、Nodeで実行、
調査完了後に削除済み。`src`/`scripts`のtracked fileは無変更）。

**測定内容（case毎）**:
1. **Baseline curve**: Clean Baseline Pose（`angleTilt=idealAngle`、`angleTiltZ=0`、
   dragOffset相当なし——C-5の"Clean Baseline Pose"と同一定義）で、Foot軸上17点
   （t=0, 1/16, ..., 1）の`realOuterRadius(t)`、`requiredRadius(t)`
   （`closestPointToPoint`によるBone表面までの実距離）、`gap(t)`を計算。
2. **±5° sweep（worst-case curve）**: C-5 §8と同一手法（tilt軸: idealAngle±5°を1°刻み、
   tiltZ軸: idealAngle固定でtiltZ±5°を1°刻み、計21点）で同じ17点を再計算し、各tについて
   21ポーズ中の最小`requiredRadius(t)`を記録（Region 1により近づく可能性がある近傍を
   探索するため。C-5 Round1の手法をそのまま再利用、新しいサンプリング方式の考案ではない）。

**Validation（Evidence品質確認）**: case-001のBaseline結果（t=0で`requiredRadius=2.2896mm`）
を、C-5文書§7「First Rotation Candidate」（`tilt=6°(idealAngle+1°), tiltZ=0°`、Foot#0
penetration=`-1.4861mm`）から逆算した距離（`radius(0.795) - penetration(-1.4861) =
2.2811mm`）と比較したところ、0.4%以内で一致した（角度差1°による僅かな差は妥当な範囲）。
これは本Harnessの座標変換・Pose計算が、C-5がArchitect承認済みの数値と整合していることを
示す独立した確認である。

## 6. Per-case Results

**Baseline（Clean Baseline Pose）— t=0 (rim) の最小値**:

| Case | shaftLength | offset | angle | required-radius(t=0) | gap(t=0) | Region1 all gap>0? | crossover |
|---|---|---|---|---|---|---|---|
| case-001 | 2.5 | -0.2 | 5° | 2.2896mm | -1.4946mm | No | none found |
| case-003 | 2.0 | 0.0 | 0° | 2.2547mm | -1.4597mm | No | none found |
| case-004 | 2.0 | 0.0 | 0° | 2.2547mm | -1.4597mm | No | none found |
| case-005 | 3.0 | -0.3 | 5° | 2.2989mm | -1.5039mm | No | none found |
| case-007 | 2.0 | 0.1 | 0° | 2.2205mm | -1.4255mm | No | none found |
| case-008 | 2.5 | -0.2 | 5° | 2.2896mm | -1.4946mm | No | none found |
| case-011 | 2.0 | -0.1 | 5° | 2.2572mm | -1.4622mm | No | none found |
| case-012 | 2.0 | 0.0 | 0° | 2.2547mm | -1.4597mm | No | none found |

（case-003/004/012は`shaftLength=2.0`・`offset=0`・`angle=0`が完全一致するため、計算結果も
bit-for-bit一致。これは内部整合性の確認であり、誤りではない。）

**±5° sweep（worst-case、21ポーズ中の最小`required-radius(t=0)`）**:

| Case | worst-case required-radius(t=0) | at (tilt, tiltZ) | Region1 all gap>0? | crossover |
|---|---|---|---|---|
| case-001 | 2.2411mm | (5°, -5°) | No | none found |
| case-003 | 2.2089mm | (0°, -5°) | No | none found |
| case-004 | 2.2089mm | (0°, -5°) | No | none found |
| case-005 | 2.2006mm | (5°, -5°) | No | none found |
| case-007 | 2.1706mm | (0°, -5°) | No | none found |
| case-008 | 2.2411mm | (5°, -5°) | No | none found |
| case-011 | 2.2135mm | (5°, -5°) | No | none found |
| case-012 | 2.2089mm | (0°, -5°) | No | none found |

全8 caseで、Baseline・±5° sweepともに、Region 1（0≤t≤0.80）全域で`gap(t)`は負
（安全側）であり、`gap(t)>0`となる点は一つも観測されなかった。全caseで`crossover`は
検出されず（`gap(t)`の符号反転が起きないため）。

**Candidate B（実装、変更なし）との比較（Baseline、t=0/0.5/1.0）**:

| Case | #0 diff (0.795-required) | #1 diff (0.7704-required) | #2 diff (0.6028-required) |
|---|---|---|---|
| case-001 | -1.4946mm | -1.6055mm | -1.9129mm |
| case-003/004/012 | -1.4597mm | -1.6607mm | -1.8975mm |
| case-005 | -1.5039mm | -1.5864mm | -1.9176mm |
| case-007 | -1.4255mm | -1.6729mm | -1.8913mm |
| case-008 | -1.4946mm | -1.6055mm | -1.9129mm |
| case-011 | -1.4622mm | -1.6273mm | -1.9110mm |

全caseでCandidate Bの3球全てが、Clean Baseline Poseにおいて1.4〜1.9mm以上の余裕を持って
Boneからclearである（過小評価どころか、大きくclear）。

## 7. Cross-case Comparison

8 caseの`required-radius(t=0)`（Baseline）は2.2205mm〜2.2989mmの範囲に収まり、変動幅は
わずか0.078mm（3.5%程度）。shaftLength（2.0〜3.0mm）・idealLateralOffset（-0.3〜+0.1mm）・
idealAngle（0°〜5°）が case間で大きく異なるにもかかわらず、この結果はきわめて安定している。

これは、Foot rim付近のBone Clearanceが、これらの症例パラメータの変動に対して比較的
鈍感であることを示唆する（Observed correlation、§8参照）——ただし、これは「Region 1
constraintがcase間で一貫している」ことの確認ではなく、「Clean Baseline Poseにおいては
全caseでBoneから十分clearである」ことの確認である（§3の既存前提とは逆方向の結論）。

## 8. Minimum-clearance Distribution

全8caseで、Baseline・±5° sweep worst-caseともに、`required-radius(t)`の最小値は
**t=0（rim）**で観測された（§7の表）。t≈0.19付近に最小値が来るという既存C-7文書の記述
（§3参照）は、今回のいずれのcaseでも、いずれのPose条件でも再現しなかった。

`realOuterRadius(t)`はt=0で最大（0.795mm）、t=1（apex）で0まで単調減少する一方、
`requiredRadius(t)`は今回の測定では**t=0で最小、t=1で最大**という、既存C-7文書とは逆の
単調傾向を示した（§6の表、全t区間でgap(t)は単調に負方向へ拡大）。

## 9. Pattern Classification

**Core Research Question（既存C-7 case-001前提が他caseで再現するか）に対する分類**:

```
Pattern D
Not reproducible / insufficient evidence
```

理由: 既存C-7文書が「case-001 Baseline」として引用した数値自体が、本文書で定義した
再現可能な方法（Clean Baseline Pose、実project関数・実Bone.glb・実MeshBVH）では
case-001についても再現しなかった（§3, §6）。したがって「他caseで再現するか」という
問いに答える以前に、比較対象となるBaseline自体の再現性が確認できていない。これは
Region 1 constraintが「存在しない」と結論するものではなく、「既存の引用数値が指す
Pose条件が特定できていない」という、Evidence追跡可能性上の未解決事項である。

**別の問い（Clean Baseline PoseでのBone Clearanceは全caseで一貫するか）に対する分類**:

```
Pattern A
Common structural pattern
```

こちらは明確にPattern Aである——8 caseすべてで、Clean Baseline Poseおよびその近傍
（±5°）において、Foot全域（t=0〜1）が一貫してBoneからclear（gap(t)<0、最大で
2.5mm以上の余裕）であり、これはC-5 Round1の"Historical Foot Collision NOT REPRODUCED"
という結論（case-001のみで確認）を、評価可能な全8 Training Caseへ一貫して拡張する
独立したEvidenceである。

## 10. Evidence / Limitations

**Evidence品質**: §5に記載の通り、全数値についてsource（関数/定数/ファイル）・
case・pose（shaftLength/offset/angle/basePos）・coordinate system（coordGroupRef基準
worldMatrix）・sampling method（17点t-sampling、±5° 1°刻みsweep）を追跡可能な形で記録した。
`§6`の全表はHarness出力の実測値そのものであり、Hypothesisではない。

**Critical Limitation（最重要）**: §3で述べた通り、既存C-7文書の「case-001 Baseline」
数値は、本調査のClean Baseline Poseでは再現しなかった。以下はHypothesisとして明示する
（証明されていない）:

```
Hypothesis 1: 既存の0.172mm/0.012mm等の数値は、Clean Baseline Pose
（idealAngle/idealLateralOffset commit、dragOffset=0）ではなく、
より境界に近い、または当時のPose調査過程における別の候補Pose
（例: STEP1「ほぼ全角度で衝突」P0-1調査時、Candidate B確定前後の
境界探索候補等）に由来する可能性がある。

Hypothesis 2: `basePos`がSTAPES_HEADではなくSTAPES_FOOTPLATEで
計算された可能性がある。参考値として、本Harnessで
STAPES_FOOTPLATE(world)からBone表面までの距離を確認したところ
0.6519mmであり（STAPES_HEAD(world)からの距離2.2547mmより大幅に
小さい）、これは既存数値の桁数（sub-mm）によりよく合致する。
ただし、これも確認されたものではなくHypothesisである。

Hypothesis 3: 当時の実機ログ/Node harnessが、本調査とは異なる
Ground Truth Transform（例: Phase B適用前の座標系）を使用していた
可能性がある。ただし、Foot Y-axis Fine-Sampling Deep DiveはPhase B
適用・実機確認後に実施されたとProject Memoryに記録されており、
この仮説の優先度は1・2より低い。
```

いずれのHypothesisも、既存の実機ログ（`[C3-P0-1-VERIFY]`等）が調査終了後に削除されて
おり、本セッションから直接検証することはできない。**これは推測であり、確定的な
原因特定ではない**。

**その他のLimitation**:
- ±5°を超える広域Rotation探索は実施していない（§12 Open Question）。
- Foot軸のみを対象とし、Shaft/Head Plateとの複合的な干渉は評価していない。
- 実機（ブラウザ）での確認は行っていない（Node harnessによる純粋関数呼び出しのみ、
  C-5/C-7と同一の制約）。

## 11. Implications for Proxy Design

```
Geometry constraint exists ≠ Collision Proxy is defective
Cross-case reproducible ≠ Proxy redesign is required
```

本調査で確定的に言えるのは以下のみである:

1. Clean Baseline Poseおよびその±5°近傍では、評価可能な全8 caseでFoot Proxy
   （Candidate B）・実Bell Foot Envelopeともに、Boneから一貫してclearである
   （§6, §9 Pattern A）。これはProxy設計の変更を要求するEvidenceではない。

2. 既存C-7文書がRegion 1 constraintの根拠とした数値は、本文書のいずれの測定条件でも
   再現しなかった（§9 Pattern D）。したがって、「Region 1 constraintがcase横断的に
   一般化する」という主張は、現時点でEvidenceにより支持されていない——ただし
   「Region 1 constraintが存在しない」という逆方向の断定もできない（§10のHypothesisが
   未解決のため、真のconstraint条件を特定できていない）。

3. 既存C-7文書のDesign Findings/Design Requirements（F1, F2, R2, R3等）は、本調査結果を
   もって直ちに撤回すべきとは判断しない——それらのEvidence源自体の妥当性確認が
   本文書の主目的であり、Architectによる再評価が必要である（§13）。

## 12. Open Questions

```
Q1（新規）. 既存C-7文書の「case-001 Baseline」数値（0.172mm/0.012mm等）は、
    どのPose条件（basePos/angleTilt/angleTiltZ/dragOffset）に由来するか？
    → §10のHypothesis 1-3のいずれか、あるいは別の要因か、確認が必要。
      当時の実機ログは削除済みのため、再現には新たな実機テストが必要になる
      可能性がある。

Q2（C-7から継続、部分的に回答）. C-7 case-001のt≈0.19最小点・t≈0.80交差点は、
    他caseでも成立するか？
    → 本調査ではいずれのcase・Pose条件でも、既存の前提そのものを再現できな
      かったため、「他caseで成立するか」という問いに直接は答えられない。
      Q1の解決が前提となる。

Q3（新規）. Clean Baseline Pose + ±5°を超える、より広いRotation境界（例:
    実際の境界探索/Boundary Warp）まで探索した場合、Region 1に相当するgap(t)>0
    が出現するcase・Pose条件はあるか？
    → 未検証。本調査のScope外（§2）。

Q4（新規）. 既存C-7文書（`docs/Phase_C7_Foot_Proxy_Design_Requirements_Investigation_v1.0.md`）
    のEvidence記述（§3, §5, §6, §10 F2, R2/R3, R4）は、本文書の発見を踏まえて
    訂正・注記が必要か？
    → 今回は判断しない。C-7文書自体を今回は変更していない（既存Evidenceの
      改変・削除禁止、Documentation Non-scope §2参照）。Architect判断待ち。

Q5（C-7から継続）. Region-aware tolerance（Cross-cutting Policy Question G）は、
    C-5のTolerance semanticsの範囲内か、新たなSpecification Clarificationが
    必要か？
    → 引き続き判断保留（potential new Specification / Design Decision）。
```

## 13. Architect Decision Required

```
Option A
既存C-7文書のEvidence記述はそのまま維持し、本文書の発見（Pattern D、
Clean Baselineでは再現せず）を別記録として残す。C-7文書自体は今回変更しない。

Option B
既存C-7文書のEvidence記述（case-001由来とされる数値）について、
Q1のHypothesisを検証するための追加調査（実機再テスト等）を別Phaseとして
指示する。

Option C
既存C-7文書のRegion 1 constraint関連の記述（§4項目3、§5、§6、§10 F2、
§11 R2/R3/R4）に、本文書への参照・出典未確認の注記を追加する
Documentation修正を別途指示する（本文書ではまだ実施していない）。

Option D
Pattern A（Clean Baseline Poseでは全8caseで一貫してclear）を正式なEvidenceとして
採用し、Region 1 constraintの議論自体を、新たなConcrete Defect Evidenceが
得られるまでPending扱いとする。

Option E
上記いずれも保留し、次のCross-Case Validationやその他調査を指示しない
（Defer）。
```

どのOptionを採用するかは、本文書では決定しない。

## 14. Conclusion

C-7 Foot Proxy Design Requirements Investigationがcase-001から観測したとされる
Region 1 constraint（Foot rim付近でのgap(t)>0）が他Training Caseへ一般化するかを
検証するため、Clean Baseline Poseと±5° sweepを用いて、評価可能な8つのBELL/PORP
Training Case全件を実project関数・実Bone.glb・実MeshBVHで再測定した。

結果、当初の前提として使用した「case-001 Baseline」数値そのものが、本文書の
再現可能な方法では再現できなかった（Pattern D）。一方、8 case全てにおいて、
Clean Baseline Poseとその近傍でFoot ProxyもFoot Envelopeも一貫してBoneからclear
であるという、明確で高い再現性を持つ別のEvidence（Pattern A）が得られた——これは
C-5 Round1の"Historical Foot Collision NOT REPRODUCED"をcross-caseに拡張する
独立した確認である。

本調査は、Cross-case reproducibleかどうかにかかわらずProxy redesignの要否を
決定するものではない。得られたEvidenceと、既存C-7文書とのEvidence源不一致という
未解決の指摘を、そのままArchitectへ報告し、次のDesign Decisionを待つ。

---

## 15. 参照

- `docs/Phase_C7_Foot_Proxy_Design_Requirements_Investigation_v1.0.md`（§3〜§10 — 本調査の出発点、Baseline記述の再検証対象）
- `docs/Phase_C5_Foot_Collision_Representation_Investigation_v1.0.md`（§7, §9, §16 — Clean Baseline Pose定義、Historical Foot Collision NOT REPRODUCED、Contact/Penetration Semantics）
- `docs/Phase_C3_Prosthesis_Anatomy_Collision_Constraint_Freeze_v1.0.md`（§16 — C-6 Phase番号予約状況）
- `src/data/cases.ts`, `src/data/products.ts`（Case/Product定義、本調査の入力データ）
- `src/scenes/models/ProsthesisModels.tsx`, `src/engine/collision/prosthesisCollisionGeometry.ts`, `src/engine/collision/anatomyCollisionIndex.ts`（再利用した実project関数・定数）
