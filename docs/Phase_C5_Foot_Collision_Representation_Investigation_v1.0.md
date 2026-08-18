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
