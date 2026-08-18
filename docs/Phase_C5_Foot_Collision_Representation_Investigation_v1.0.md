# C-5: Foot Collision Representation & Contact Semantics Investigation v1.0

**Status**: Investigation In Progress（本文書はArchitect Conclusionを含むEvidence記録であり、
C-5自体の完全終了を宣言するものではない）
**Date**: 2026-08-18
**位置付け**: これはC-3/C-4の実装変更ではない。コード変更・Collision Logic変更・Foot Proxy/
Candidate B/Foot Contact Tolerance変更・Malleus/Stapes実装・STEP 4D再開・Scoring変更のいずれも
伴わない、Read-only調査によるEvidence記録である。C-2/C-3/C-4のFreeze/Closed状態はそのまま維持
される。

## 1. Objective

Foot Collision Representation（Candidate B、3球近似）とContact/Penetration Semantics
（`FOOT_CONTACT_TOLERANCE_MM`）について、以下を確認する：

1. Real Bell Foot（`BellFoot()`実形状）とCandidate B（3球）の間に、どの程度のGeometry
   近似誤差が存在するか（定量比較）。
2. 過去に記録されたHistorical Evidence（2026-08-15、Foot #0/#1が約0.5〜0.6mm貫入）が、
   現在のClean Baseline Pose（TEST forced commit直後、`dragOffsetX/Y/Z=0`）でも再現するか。
3. 上記2点を踏まえ、Foot Proxy再設計に進む根拠が現時点で存在するかをArchitect判断として
   明文化する。

## 2. Scope / Non-goals

**今回のScope**:
- Real Foot Geometry・Candidate B・Collision箇所・Contact/Penetration SemanticsのEvidence収集
  （Read-only）
- Clean Baseline Poseでの実際のCollision再現性検証（Read-only、一時harness使用）
- 上記EvidenceからのArchitect Conclusion明文化

**Non-goals（今回実施していないもの）**:
- Foot Proxy形状の再設計・変更
- Candidate B半径の変更
- `FOOT_CONTACT_TOLERANCE_MM`の変更
- Collision Engine（`testCollision.ts`/`anatomyCollisionIndex.ts`）の変更
- Scoring（`computeScore()`）の変更
- C-3/C-4関連コードの再変更
- STEP 4D、Malleus/Stapes拡張（C-6スコープ）

## 3. Real Bell Foot Geometry

`BellFoot()`（`src/scenes/models/ProsthesisModels.tsx:1331-1425`）は単純な回転体ではなく、
**4分割された中空スリット形状**である：

- `BELL_HEIGHT_MM = 1.095`（ローカルY: 0=rim/底面 〜 1.095=apex/頂点）
- `BELL_RIM_RADIUS_MM = 0.795`（rim半径）
- `SLIT_TOP_R = 0.599`（Y=0.717でのスリット上端半径）、`WALL_T = 0.096`（肉厚）
- 断面プロファイル: `Y∈[0, 0.717]`は円錐台（RIM_R→SLIT_TOP_R）、`Y∈[0.717, 1.095]`は
  球冠テーパーでapex（Y=1.095）にて半径0へ収束
- 実体は外壁+内壁+リム環の3レイヤーを、0°/90°/180°/270°を中心に`SECT_ANG=58.0°`の
  セクター4枚で構成（`SLIT_ANG=32.0°`のスリット4箇所が開口、実体は周方向の約64.4%
  （4×58°/360°）のみ）

Collision Proxy側（`prosthesisCollisionGeometry.ts:188-195`）はこの形状をFoot軸上3点の
均等配置球でのみ近似しており、中空・スリット構造は一切反映されない（意図的な簡略化、
C-1設計時からの既定方針、無変更）。

## 4. Candidate B Geometry

`CANDIDATE_B_FOOT_SPHERE_RADII_MM = [0.7950, 0.7704, 0.6028]`
（`prosthesisCollisionGeometry.ts:132`、2026-08-15 Architect承認、Diagnostic/Provisional、
今回変更なし）

**Envelope半径（外壁半径）比較**:

| # | ローカルY | Candidate B半径 | 実Outer半径 | envelope過大率 |
|---|---|---|---|---|
| #0 (rim) | 0.000mm | 0.7950mm | 0.7950mm | ±0%（完全一致） |
| #1 (mid) | 0.5475mm | 0.7704mm | 0.6453mm | +19.4% |
| #2 (apex) | 1.095mm | 0.6028mm | 0.0000mm | 理論上+∞%（実形状は頂点で閉じる） |

**実固体断面積（中空4スリット構造を反映した"実在領域"そのもの）比較**:

| # | 実固体断面積 | 球断面積(πr²) | 過大倍率 |
|---|---|---|---|
| #0 (rim) | 0.2904mm² | 1.9856mm² | ×6.84 |
| #1 (mid) | 0.2322mm² | 1.8646mm² | ×8.03 |
| #2 (apex) | 0.0000mm² | 1.1416mm² | ×∞ |

**Geometry Finding**: Candidate BはReal Bell Footのmaterial occupancyを忠実には表現して
いない。#0はenvelope半径では過大評価ゼロだが、実際のrimは肉厚0.096mmの中空スリットリング
でしかなく、実固体断面積との比較では#0〜#2すべてで6〜8倍以上の過大評価が存在する。#2は
実形状が数学的に閉じた点（半径0）である一方、球はr=0.6028mmの実体を保持しており、質的に
最大の乖離を示す。この事実は本文書のEvidenceとして記録するが、§10/§12で述べる通り、
これは「Collisionの誤検知を引き起こしている」ことの証明ではない（Geometry mismatch ≠
Collision failure）。

## 5. Clean Baseline Pose

```
Case = case-001
idealAngle = 5°
idealLateralOffset = -0.2

committed lateralOffset = -0.2
committed angleTilt = 5°
committed angleTiltZ = 0°

dragOffsetX = 0
dragOffsetY = 0
dragOffsetZ = 0
```

この値は`SimulationMode.tsx`のTESTボタン`onClick`実装（`updatePlacement({..., angleTilt:
selectedCase.idealAngle, angleTiltZ: 0, dragOffsetX: 0, dragOffsetY: 0, dragOffsetZ: 0})`）
をそのまま読み取ったものである。

**Read-only事前確認（コード）**: `SimScene.tsx:1237-1242`の`hasCommittedRef`ガード付き
`useEffect`は`onManipulationCommitted?.()`呼び出しのみで、`commitTransportPoseToOffsets`は
一切呼ばれない（Root Cause A修正、コミット`f233ab1`が現行HEADに含まれることを確認済み）。
すなわち、stale `transportPose`によるdragOffset再上書きの**コード上の経路自体が現在存在
しない**ことを確認済みである。

## 6. Collision Reproduction Method

本セッションのBrowser paneはWebGL/GPU compositingが機能せず（`preview_start`→
`screenshot`が"the Browser pane is not displayed, so the page is not compositing frames"
で失敗、過去セッションでも複数回確認済みの既知の制約）、文字通りの実機クリック操作を
Claude Code側で実行することはできない。

代替として、実プロジェクトの純粋関数（`composeRotationCandidatePose`相当の複製、
`buildProsthesisCollisionProxy`、`testCollision`）を無改変でimportし、実`Bone.glb`
（93,124三角形、`three-mesh-bvh`でBVH構築）に対して評価する一時harness
（`scripts/tmp-c5-clean-baseline-repro.ts`、測定後削除済み）を用いた。これはSTEP3 Ground
Truth Investigation・Rotate Smoothness Cost Harnessと同一手法であり、Radius/Tolerance/
Poseの手動調整は一切行っていない。

**注意**: これは実プロジェクトのコードパスと数学的に同一の再現であり、文字通りの実機
ブラウザ操作ではない。§13にて、独立検証としての実機確認を推奨事項として残す。

## 7. First Rotation Candidate

```
tilt = +1° (idealAngle 5° → candidate 6°)
tiltZ = 0°
```

結果:
```
Foot #0 = -1.4861 mm
Foot #1 = -1.5992 mm
Foot #2 = -1.9116 mm

Shaft = clear
Head Plate = clear
collision = false
```

（penetration値は正値=Bone内部への食い込み、負値=Bone表面からの距離。すべて負値、
すなわち全球Bone表面からclear。）

## 8. ±5° Sweep

case-001について、tilt軸（tiltZ=0°固定）・tiltZ軸（tilt=5°固定）をそれぞれ独立に
-5°〜+5°、1°刻みでスイープ（各11点、合計21点+First Candidateの計22点評価）。

| angle | tilt | tiltZ | foot#0 | foot#1 | foot#2 | head | collision |
|---|---|---|---|---|---|---|---|
| tilt−5 | 0° | 0° | −1.540 | −1.637 | −1.920 | clear | false |
| tilt+0(baseline) | 5° | 0° | −1.495 | −1.606 | −1.913 | clear | false |
| tilt+5 | 10° | 0° | −1.454 | −1.575 | −1.907 | clear | false |
| tiltZ−5 | 5° | −5° | −1.446 | −1.559 | −1.904 | clear | false |
| tiltZ+0(baseline) | 5° | 0° | −1.495 | −1.606 | −1.913 | clear | false |
| tiltZ+5 | 5° | +5° | −1.554 | −1.653 | −1.923 | clear | false |

（表は代表点を抜粋。全21点でFoot #0/#1/#2は一貫して負のpenetration＝Bone表面からclear、
単調な変化のみで境界越えなし。Head Plate/Shaftも全点clear。）

**全測定点中の最大penetration（最もCollisionに近かった値）**:
```
Foot #0 ≈ -1.446 mm
Foot #1 ≈ -1.559 mm
Foot #2 ≈ -1.904 mm
```

## 9. Historical Evidence Comparison

```
Historical (2026-08-15, Foot #0/#1 Deep Dive):
Foot #0 ≈ +0.5〜0.6 mm penetration
Foot #1 ≈ +0.5〜0.6 mm penetration

Current Clean Baseline (case-001, 22点評価):
Foot #0 = 常にclear (最悪値でも -1.446 mm)
Foot #1 = 常にclear (最悪値でも -1.559 mm)
Foot #2 = 常にclear (最悪値でも -1.904 mm)
```

この差は単なるrounding errorやsmall numerical deviationとして扱わない。差は約2mm
オーダーであり、座標丸めや測定誤差では説明できない。

**正式な分類**:
```
Historical Foot Collision = NOT REPRODUCED
```

## 10. Findings

1. **Geometry Finding**: Candidate BはReal Bell Footのmaterial occupancyを忠実には表現
   していない（§4）。特にrim/mid球は実固体断面積の6〜8倍、apex球は実形状が閉じた点である
   のに対し有限半径を保持している。これはEvidenceとして確定的に記録する。

2. **Collision Finding**: 上記のGeometry over-approximationが、現在のClean Baselineで
   実際のFalse Positive Collisionを発生させていることは**今回確認されなかった**（§7,§8）。
   Clean Baseline付近±5°のスイープ全域で、Foot #0/#1/#2は一貫してBoneから1.4mm以上clear
   であった。

3. これら2点は同一視しない：
   ```
   Candidate B geometry = imperfect approximation（確定）
   Candidate B = currently causing a demonstrated collision problem（今回のEvidenceでは
                 確認されず）
   ```

4. **Historical Foot #0/#1 penetration was not reproduced under the current clean
   baseline pose.** Pose contamination related to the previously fixed stale
   `transportPose` overwrite is a plausible leading hypothesis — this is not proven,
   since the exact `dragOffsetX/Y/Z` values at the time of the historical measurement
   were never recorded and the historical pose cannot be reconstructed directly.
   （Historical Evidence自体は削除・否定しない。「過去に観測された」「現時点では
   再現しない」「Pose provenanceが不完全である」という3点として記録する。）

## 11. Contact/Penetration Semantics

現状（無変更）:
```
Scoring (computeScore()) → ideal contact is desirable（verticalDeviation理想値=0）
Collision Constraint     → geometric penetration is prohibited（二値判定が既定）
Foot                     → 0.15mm provisional contact tolerance（role='foot'のみ）
```

今回のEvidenceから、Contact/Penetration semanticsを変更する必要があるとは結論しない。

```
Contact semantics = Open investigation item
                   = No implementation change
```

→ 詳細Evidence（Collision Engine実処理の境界判定、Q1〜Q6、Layer構造、この観点での
Architect Decision）は §16「Contact/Penetration Semantics Evidence（Investigation
Round 2、2026-08-18追補）」を参照。本セクション（§11）の記述自体は無変更。

## 12. Architect Decision

```
Foot Proxy redesign     = NOT JUSTIFIED AT THIS TIME
Candidate B             = KEEP / UNCHANGED
Foot Contact Tolerance  = KEEP 0.15 mm / PROVISIONAL / no clinical finalization
Collision Engine        = unchanged
```

**理由**: No reproducible Foot collision exists in the current clean baseline that
would justify redesigning the proxy.

## 13. Remaining Questions

**Q**: Does the current Foot Proxy produce any reproducible false-positive collision
under a clean, valid placement?
**A (今回のEvidence)**: `NO`

独立検証を実機で行う場合の推奨手順（Proxy redesignを開始するための測定ではなく、
追加Verificationとして）:
```
TEST → immediate Rotate → minimum rotation candidate
```
UI上のPose表示（committed placement / dragOffset / 角度）と、実際のプロステーシスの
見た目（Bone突き抜けの有無）を目視確認する。

## 14. Final Status

```
C-5 Status:               Investigation In Progress（本Evidenceにより一区切り、完全終了は未宣言）
Historical Foot Collision: NOT REPRODUCED
Clean Baseline Collision:  NO (Foot/Shaft/Head Plateとも全点clear)
Candidate B:               UNCHANGED
Foot Proxy Redesign:       NOT JUSTIFIED AT THIS TIME
Contact Semantics:         Open investigation item, no implementation change
Code Changes:              0 (src/ 変更なし)
Commit:                    未実施
Push:                      未実施
Working Tree:              CLEAN（測定前と同一、既存の未追跡ファイルのみ）
```

**Architect Conclusion**: Clean BaselineではHistorical Foot #0/#1 penetrationは再現され
ず、現時点でFoot Proxy redesignを正当化する再現可能なCollision Evidenceは存在しない。
C-3/C-4は再開しない。Foot Proxy実装変更にも進まない。

## 15. 参照文書

- `docs/Phase_C3_Prosthesis_Anatomy_Collision_Constraint_Freeze_v1.0.md`（§6, §9, §12）
- `docs/Phase_C4_Rotation_Collision_Boundary_Verification_v1.0.md`

---

## 16. Contact/Penetration Semantics Evidence（Investigation Round 2、2026-08-18追補）

**位置付け**: §1〜§15（Investigation Round 1、Geometry比較・Clean Baseline再現性検証）を
書き換えるものではない。§11「Contact/Penetration Semantics」で"Open investigation item"と
した項目について、Read-only調査を継続した結果を追補する。コード・Collision Engine・
Tolerance・Candidate B・Foot Proxy・Scoringのいずれも変更していない。

### 16.1 Collision Engineの実処理（`collisionTest.ts`、confirmed）

```
[role==='foot' かつ tolerance>0のとき]
1. BVH closest-point search:
   bvh.closestPointToPoint(center, undefined, 0, radius+tolerance)
2. penetration = radius - hit.distance
3. penetration > tolerance → collided=true
4. それ以外（hitなし、またはpenetration<=tolerance）→ clear

[role!=='foot'（Shaft sphere / Head box）、またはtolerance未指定/0のとき]
geometric intersection（intersectsSphere / intersectsBox）→ collided=true
境界接触（tangent）も含めintersectionとして扱われる。penetration量は問わない。
```

**判定境界（`collisionTest.ts:50-56`のコードから直接導出、confirmed）**:

| penetration | 判定 |
|---|---|
| 0 | clear |
| 0.05 mm | clear |
| 0.15 mm | clear（`>` を使用しており `>=` ではないため） |
| 0.16 mm | collision |

### 16.2 Q1 — 「Collision」の厳密な意味（confirmed）

```
Current "Collision" semantics are role-dependent.

Foot:
    penetration depth > tolerance
    → collision

Non-foot:
    geometric intersection
    → collision
```

単一のCollision semanticsが存在するのではなく、roleに応じた2種類の判定方式が同一関数内で
共存している。**これ自体はBugとして記録しない**（今回、Concrete Defect Evidenceは存在
しない、§16.6参照）。

### 16.3 Q2 — 0.15mm toleranceの意味（confirmed）

```
FOOT_CONTACT_TOLERANCE_MM = 0.15 mm
```

は名称（"Contact Tolerance"）に反して、実処理上は **Penetration tolerance** である：

```
penetration = 0             → contact / clear
0 < penetration <= 0.15 mm  → tolerated penetration / clear
penetration > 0.15 mm       → collision
```

コードコメント（`prosthesisCollisionGeometry.ts:66-79`）にも「許容貫入深度（mm）」と
明記されており、これがEvidenceである。

```
0.15 mm = Clinical Thresholdではない
        = Diagnostic / Provisional
```

は§6・§12（本文書）およびC-3 Freeze文書§6と矛盾せず維持する。名称変更等のコード変更は
行わない。

### 16.4 Q3 — C-2/C-3 tolerance差（confirmed / unknown・undocumented）

```
C-2 Translation (evaluateDragCandidate):
    footContactToleranceMmを渡していない

C-3 Rotation (evaluateRotationCandidate):
    FOOT_CONTACT_TOLERANCE_MMを渡している
```

これは「TranslationとRotationで物理的に異なるtoleranceが必要」という仕様Evidenceでは
**ない**。既存コメント（`SimScene.tsx:773-777`）から確認できるのは、「C-2はPASS/Freeze
済み」「C-3の問題（Rotate Modeが常にCollisionでブロックされる）を最小変更で解決する」
「C-2の挙動を巻き込まない」というScope Discipline / Minimal Changeの判断のみである。

```
正式分類: Unknown / undocumented
```

「C-2に将来もtoleranceを適用しない」という仕様Evidenceは存在しないため、これも記録しない。

### 16.5 Q4 — Scoring vs Collision（confirmed）

```
Scoring (computeScore()):
    verticalDeviation ideal = 0
    「浮いた状態→接触不安定/音響損失」「接触を確保してください」という
    接触を推奨するFeedback文言が存在
    0.3 / 0.6 / 1.0 mm の位置偏差bandによる段階的減点（hard threshold ではない）

Collision:
    geometry intersection / penetration constraint
```

ScoringとCollisionは異なるレイヤー・目的を持つが、同一の物理状況（Foot-底板の幾何学的
重なり）に対して逆方向の評価を行いうるため、semantics上の緊張関係が存在する（既存C-3
Freeze文書§9と整合、無変更）。

```
Scoring threshold (0.3/0.6/1.0mm) ≠ Collision penetration tolerance (0.15mm)
```

Scoringの位置偏差bandを0.15mmの根拠として使用していないことを維持する。

### 16.6 Q5 — Contact / Penetration / Tolerated Penetration（confirmed）

`CollisionResult`（`collisionTest.ts:15-22`）には`penetrationDepth?`/`normal?`が将来拡張用
として型のみ予約済み（C-1設計時のコメント、未使用のまま）。現在の実装は`boolean collided`
としてしか結果を返さない。

```
Contact              : penetration ≈ 0
Tolerated penetration: 0 < penetration <= tolerance
Penetration           : penetration > tolerance
```

という概念整理は可能だが、API上で明示的な3状態として返しているわけではない。これを
**仕様上の未確定事項**として記録する。今回これを理由にAPI変更は行わない。

### 16.7 Q6 — Implementation Changeの正当性（confirmed）

```
Concrete Defect Evidence = None
```

理由:
- Historical Foot collisionはClean Baselineで再現されていない（§9、Round 1）
- Current Clean BaselineはFoot #0/#1/#2すべてclear（§7, §8、Round 1）
- ±5° sweepでもcollisionなし（§8、Round 1）
- 今回（Round 2）発見されたのはsemanticsの非対称性・未文書化であり、再現可能な
  Concrete Defectではない

```
Implementation change is not justified at this time.
```

### 16.8 Layer構造（Round 1との分離維持）

```
Layer 1  Geometry Representation  : Real Foot vs Candidate B（§3, §4、確定済み）
Layer 2  Collision Semantics      : role依存の2判定方式が共存（§16.1-16.2、今回確定）
Layer 3  Tolerance                : FOOT_CONTACT_TOLERANCE_MM=0.15mm、Diagnostic/Provisional
Layer 4  Clinical Interpretation  : 臨床的Evidence皆無（未確立のまま）
```

```
Real Foot ≠ Sphere
```
だからといって、
```
Sphere Proxy = Current Collision Bug
```
とは結論しない（§4, §10と同一の原則をLayer 2にも適用する）。

### 16.9 表現ルールの適用

```
confirmed とするもの:
- Collision Engineの実処理（§16.1）
- ">" 境界判定（§16.1）
- 0.15mmがpenetration toleranceであること（§16.3）
- C-2/C-3の現在の実装差そのもの（§16.4）
- Concrete Defect Evidenceがないこと（§16.7）

leading hypothesis に留めるもの:
- Historical collisionの原因としてのstale transportPose（§10で既述、変更なし）

unknown / undocumented とするもの:
- C-2で今後toleranceを適用するか（§16.4）
- C-2/C-3 tolerance差が将来も維持されるべき仕様か（§16.4）
- Clinicalに0.15mmが妥当か（§16.3、§6, §12と同一）
```

### 16.10 Architect Decision（Investigation Round 2）

```
Option B
Semantics ambiguity exists.
Specification clarification required.
No implementation change yet.
```

**Option Aではない理由**: 現在の実装はコードとして一貫して動作しているが、C-2/C-3
tolerance差・Contact/Penetration distinction・Scoring/Collision relationship・
Clinical basis of 0.15mmには未文書化・未確定部分がある。「Current semantics are
sufficiently coherent」と断定するのは不適切。

**Option Cではない理由**: Concrete Defect Evidenceがない（§16.7）。「Implementation
defect demonstrated」とは言えない。

```
Foot Proxy redesign     = NOT JUSTIFIED AT THIS TIME（§12と同一、維持）
Candidate B              = KEEP / UNCHANGED
Foot Contact Tolerance   = KEEP 0.15 mm / PROVISIONAL / no clinical finalization
Collision Engine         = unchanged
Contact/Penetration API  = unchanged（penetrationDepth/normalは型予約のまま、未実装）
```

### 16.11 Investigation Status（Round 2終了時点）

```
C-5 = INVESTIGATION COMPLETE FOR THIS ROUND
      / SPECIFICATION CLARIFICATION REQUIRED
      / NO IMPLEMENTATION CHANGE
```

コードを直さないこと自体が今回のArchitect Decisionである。将来Concrete Defect Evidenceが
得られた場合のみ、別途Implementation Phaseを開始する。C-3/C-4は再開しない。

## 17. 参照（Round 2追加分）

- 本文書 §9〜§12（Round 1、Historical Evidence比較・Geometry Findings・Architect Decision）
- `docs/Phase_C3_Prosthesis_Anatomy_Collision_Constraint_Freeze_v1.0.md`（§6, §9）
