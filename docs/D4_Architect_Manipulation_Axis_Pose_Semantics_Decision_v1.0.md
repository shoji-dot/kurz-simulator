# D-4 Architect Decision Proposal — Manipulation Axis / Pose Semantics / Collision Candidate Specification

Status: **Architect Final Decision (1〜9) = FINALIZED**（Section 19・22参照）。
**Decision 3 = APPROVE**（Section 19-3・Section 20.1参照。D-4 Implementation完了後、shojiさんの
実機確認によりReal-device Verification Gate（A1〜A4）を全項目通過、PENDING状態を解消済み。
`ANGLE_TILT_SIGN`/`ANGLE_TILT_Z_SIGN`の符号反転は不要と判明）。
**Decision 10（Section 23、Post-Implementation Addendum）= APPROVED**（Option A、shojiさんに
より正式承認済み、Section 23.7参照。D-4 Implementation完了後のPost-Implementation Review
Finding 1を受けた追加Decision。Decision 1〜9のFINALIZED状態には影響しない）。
**コード変更・Commit・Pushはこれらの承認・確認記録自体では一切行っていない**——D-2 Migration
実行・Freeze/Slerp削除は、Decision 3のAPPROVE確定により着手可能な状態になったが、別途の
明示的な指示・Implementation Taskを要する（Section 22.3・Implementation Specification参照）。

Baseline: `HEAD = 871b1c5926dd73d6bf5f823dfe6785f2aabc900a`

---

## 1. Executive Summary

D-4 Audit / D-4-B Audit（4レポート）で確定した事実は以下の3点に整理できる。

1. **Translation（X/Y/Z、Pointer Drag、Depth）は現在、位置だけでなくQuaternionも変化させる**
   （1mmあたり9〜20°、実測）。原因は「base→UMBO_POS方向へ常に再アライメントする」という
   Pose生成方式そのものであり、局所的なバグではない。
2. **Collision Candidate（`composeDragCandidatePose()`）は、Rendering Poseが実際に使う式
   （既存dragOffsetX/Y/Zを含む）とは異なる式（含まない）でPoseを計算しており、既存offsetが
   大きいほど乖離が拡大する**（実測: Position最大0.89mm、Quaternion最大57.37°）。
   `composeRotationCandidatePose()`は正しく実装されている（非対称）。
3. **矢印キー/ControlPad Translationは、そもそもCollision Candidate自体を生成しない**
   （Collision Constraintが完全に非適用）。実runtimeで確定済み。

Architect Review（暫定評価: **APPROVE WITH CONDITIONS**）を受け、本改訂版では以下を追加調査・
明文化した。

- P0: Canonical Pose Generatorの具体的Contract（Section 10.4、11）
- P1: Translation「Base Alignment固定」の**具体的な固定タイミング**の定義（Section 5.3）
- P1: Rotation R4の**座標系・軸・合成順序を数値レベルで明文化**（Section 6.3）
- D-2（Start Position / Ideal Position / Scoring）との整合性調査（Section 12、新規）
- Final Approvalに必要な条件の一覧化（Section 16、新規）
- 実機確認が必要な項目とUNKNOWN項目の明示（Section 6.4、14）

結論（変更なし、詳細化のみ）:

```
Translation semantics    → RECOMMENDATION: Option C（Base Alignment固定 + 明示的User Rotation）
Rotation semantics       → RECOMMENDATION: R4（Anatomical-axis pre-multiply）
Depth semantics          → RECOMMENDATION: Camera-relative軸選択 + Position-only（Translationと同じ扱い）
Shaft Roll semantics     → RECOMMENDATION: 現状維持（Local shaft axis、既に正しい）
Pointer Drag semantics   → RECOMMENDATION: 現状維持（Screen/Camera-plane、Depthと対を成す設計として妥当）
Collision Candidate      → RECOMMENDATION: YES — Canonical Pose Generator一本化
```

**[更新、Final Decision確定]** 本書はSection 19（Final Decision Sheet）でshojiさんの
明示的な指示によりArchitect Final Decision = FINALIZEDとなった（Decision 3のみ"PENDING
REAL-DEVICE CONFIRMATION"として明示的に受容、Section 20・22参照）。ただし、
**実装（コード変更）はまだ一切行っていない。** Final Decisionの確定と実装着手は分離されており、
実装は別Task（Implementation Specification策定→Implementation→Verification）で行う。

---

## 2. Evidence Reviewed

本書は以下4件の既存Investigation/Verificationレポート（すべてuntracked、本Taskで変更しない）
を根拠とする。

```
docs/D4_Manipulation_Axis_Coordinate_System_Audit_v1.0.md
docs/D4B_Collision_Candidate_Integrity_Audit_v1.0.md
docs/D4B_Collision_Candidate_Runtime_Safety_Verification_v1.0.md
docs/D4B_Collision_Candidate_Final_Runtime_Verification_v1.0.md
```

要点（再掲）:
- Translation→Quaternion Coupling: X/Y/Z各+1mmで9.18°/19.57°/18.39°（実測、BELL-type、実座標定数使用）。
- Rotate（angleTilt/angleTiltZ）は Local post-multiply（差15.24°）ともWorld pre-multiply（差4.79°）
  とも数学的に一致しない独立した第三の変換（Euler XYZ成分修正→再合成）。
- Shaft Rollは幾何学的にProsthesis local +Y（shaft長軸）と一致することを数値確認済み
  （ロール前後でLocal+Y軸のWorld方向が完全一致）。
- `composeDragCandidatePose()`は`dragOffsetX/Y/Z`を一切含まない一方、
  `composeRotationCandidatePose()`は含む（非対称、SimScene.tsx:1439-1464 vs 1478-1506）。
- 矢印キー/ControlPad Translationは`translateSelectedObject()`（useSimStore.ts:205-210）を
  直接呼ぶのみで、Collision Candidate生成コードを一切経由しない（実runtimeでControlPadについて
  確定済み: `evaluateDragCandidate`ログが0件）。
- 実MeshBVHでのFalse Negative/Positiveの発生自体は、Browser pane環境制約（2回連続で
  `document.hidden=true`）により**UNKNOWN（未確定）のまま**。ただし、確認済みのPosition/
  Quaternion乖離幅は`FOOT_CONTACT_TOLERANCE_MM=0.15mm`という既存の安全余裕を大きく超えており、
  Collision Safety Impact=MATERIALという評価を覆すだけの反証は得られていない。
- Rotate-Smoothness調査（`scripts/rotate-smoothness-cost-harness.ts`、既存資産）で、Collision
  評価1回のコストはmean 0.085msと計測済み——Candidate計算を非線形関数の直接呼び出しに変える
  ことへのパフォーマンス懸念に対する既存の反証データとして利用できる（Section 11.4）。

---

## 3. Current Architecture（Pose Pipeline再確認）

```
A. Rendering Pipeline（Placement段階、DraggableProsthesis）
   PlacementState（basePos派生 + lateralOffset/anteriorOffset/verticalOffset +
   dragOffsetX/Y/Z + angleTilt/angleTiltZ）
     ↓
   computeProsthesisModelPose()  [ProsthesisModels.tsx:1742-1762]
     base = basePos + (lateralOffset+dragOffsetX, verticalOffset+dragOffsetY, anteriorOffset+dragOffsetZ)
     target = UMBO_POS（固定の解剖学的ランドマーク）
     computeCurrentAxisAlignmentPose(base, target, shaftLength, angleTilt, angleTiltZ)
       dir = normalize(target - base)
       quat0 = setFromUnitVectors(Y, dir)
       euler0 = decompose(quat0, 'XYZ')
       finalEuler = (euler0.x+tiltXRad, euler0.y, euler0.z+tiltZRad)
       quaternion = recompose(finalEuler)
       position = midpoint(base, base + shaftLength*dir)
     ↓
   ProsthesisModel: renderQuaternion = quaternion [* Roll(shaftRollDeg) if≠0]  [ProsthesisModels.tsx:1796-1800]
     ↓ <group position quaternion> ← Rendering Ground Truth

B. Candidate Pipeline（Collision判定専用、Rendering非経由）
   Translation/Pointer Drag/Depth → composeDragCandidatePose()  [SimScene.tsx:1439-1464]
     committed = computeProsthesisModelPose(lateralOffset, anteriorOffset, verticalOffset, ...)
                 ※dragOffsetX/Y/Z不含（A.のRendering式と異なる）
     position = committed.position + dragLocalDelta（ベクトル加算、線形近似）
     quaternion = committed.quaternion [* Roll]

   Rotate → composeRotationCandidatePose()  [SimScene.tsx:1478-1506]
     computeProsthesisModelPose(lateralOffset+dragOffsetX, verticalOffset+dragOffsetY,
                                 anteriorOffset+dragOffsetZ, candidateAngleTilt, candidateAngleTiltZ)
                 ※dragOffsetX/Y/Z含む（A.と一致）

   Arrow-key / ControlPad Translation → Candidate生成なし（translateSelectedObject()が
   dragOffsetX/Y/Zへ直接clamp書き込みするのみ、useSimStore.ts:205-210）

C. Transport Pipeline（Placement未確定、DirectTransportProsthesis、ManipulationLayer.tsx）
   transportPose.position（basePos起点の絶対座標） + transportTilt（tilt/tiltZ、独立state）
     ↓ useFrame毎フレーム
   computeProsthesisModelPose({basePos: livePos, angleTilt: transportTilt.tilt, ...}).quaternion
     ↓
   innerGroupRef.quaternion ← Transport段階のRendering（Collision Constraint自体が存在しない）
   Release時: commitTransportPoseToOffsets()でdragOffsetX/Y/Zへ差分変換、
              transportTilt.tilt/tiltZをそのままangleTilt/angleTiltZへコピー（T2方式）

D. D-2 Snapshot Pipeline（Start Position / Ideal Position の保存・再利用、Section 12で詳述）
   currentPlacementSnapshot（SimScene.tsx:1631-1639、CasePlacementSnapshot型:
   {lateralOffset, anteriorOffset, verticalOffset, angleTilt, angleTiltZ} の5数値のみ）
     ↓ Save Start Position / Save Ideal Position ボタン
   cases.ts の startPlacement / idealPlacement フィールドへ手動貼り付け
     ↓ 再利用時
   startPlacement → Transport初期transportPose/transportTilt（SimScene.tsx:1560-1570）
   idealPlacement → resolveIdealLateralOffset/resolveIdealAngle → IdealGhostProsthesis
                    （computeProsthesisModelPose呼び出し）・computeScore()（数値diffのみ）
```

Transport段階のプレビュー（C）も同じ`computeProsthesisModelPose()`を使うため、A節と同じ
Translation→Quaternion Coupling特性を継承している（Collision Constraint自体がないため
Candidate divergence問題はないが、UX上の「動かしただけで回転する」という体験は共通）。

D-2 Snapshot（D）は「Positionと角度を別々の数値として保存する」設計であり、Pose（position
vector + quaternion）を直接保存してはいない。この事実がSection 12のD-2互換性評価の前提になる。

---

## 4. Current Problems（3層モデルでの整理）

「Layer 1 User Intent / Layer 2 Manipulation Semantics / Layer 3 Collision Candidate」に
沿って問題を再整理する。

| Layer | 問題 | 該当Evidence |
|---|---|---|
| Layer 2（Manipulation Semantics） | Translationの意味が「平行移動」ではなく「base点を動かしてUMBO方向に再アライメント」になっている。Quaternionが副作用的に変化する。 | D4 Audit D節 |
| Layer 2 | Rotationの回転軸が、Local/World/Umbo/Shaft/Cameraのいずれとも数学的に一致しない未定義の第三の変換。 | D4 Audit E節 |
| Layer 3（Collision Candidate） | `composeDragCandidatePose()`が既存offsetを含まない（非対称バグ）。 | D4-B Integrity Audit A/L節 |
| Layer 3 | Candidateの線形近似とRenderingの非線形計算が乖離（既存offset=0でも発生）。 | D4-B Integrity Audit C節Step1 |
| Layer 2/3混在 | 矢印キー/ControlPad TranslationにCollision Candidate自体が存在しない（Layer3が丸ごと欠落）。 | D4-B Runtime Verification 4.1節 |
| Layer 3 | Shaft RollにCollision Candidate自体が存在しない。 | D4 Audit J節 |

**重要な認識**: Layer 3（Candidate生成の非対称性・欠落）は「実装ミス」だが、Layer 2
（Translationが回転を伴う設計）は「意図的な設計判断（base→target auto-alignment）が
インタラクティブ操作の文脈で予期しない副作用を生んでいる」という、性質の異なる問題である。
Layer 3だけを直しても（例: `composeDragCandidatePose()`にdragOffsetを足すだけ）、Layer 2の
非線形性が残る限りCandidate/Rendering一致は近似的にしか得られない（D4-B Integrity Audit L節で
既に指摘済み）。このため本書はLayer 2の再設計を先に提案する。

---

## 5. Translation Semantics

### 5.1 Options（再掲）

**Option A — Position-only Translation**: Positionのみ変更、Quaternion不変。

**Option B — Position-dependent Alignment（現状）**: `base`変更→`dir=normalize(target-base)`
再計算→Quaternion変化。

**Option C — Base Alignment固定 + 明示的User Rotation**: Base Alignment Quaternion
（base→target方向）は一度だけ計算し固定、以降のTranslationでは再計算しない。

### 5.2 評価（再掲）

| 観点 | Option A | Option B（現状） | Option C |
|---|---|---|---|
| User Intuition | ◎ | ×（3mmクランプ内の移動で最大数十度回転しうる） | ◎ |
| Anatomical Meaning | △（base→target整合を失う） | ◎（常にUMBO方向を自動追尾） | ○（初期整合は保持、以降は明示操作のみ） |
| Mathematical Stability | ◎ | ×（Section 4の全問題の根） | ◎ |
| Collision Candidate統合 | ◎ | ×（現在の根本原因） | ◎ |
| D-4 UX（Depth Freeze等）との整合 | ◎ | △（Option①/②のFreeze/Slerpが必須なのは、この結合が原因） | ◎ |

### 5.3 「Base Alignment固定」の具体的定義（Review条件への回答）

Task Review §3で要求された「どのタイミングのAlignmentを固定するのか」を、既存コードの状態
遷移に沿って具体的に定義する。

```
① 初期Position（basePos）に対するAlignment？        → NOT THIS
② Save Start Positionに対するAlignment？             → NOT THIS（Snapshotの保存操作自体とは無関係）
③ Placement開始時（Transport開始）のAlignment？       → NOT THIS
④ Placement確定時（Commit、manipulation.committed
   がfalse→trueに変わる瞬間）のAlignment          → ★ RECOMMENDATION: THIS
```

**理由と根拠**:

1. **Transport段階（③、Commit前）でAlignmentを固定すべきでない理由**: `createInitialTransportPose()`
   （ManipulationLayer.tsx:77-82）は、Transport初期姿勢を`quaternion: new THREE.Quaternion()`
   （恒等、無回転）とし、コメントで明示的に
   > 「Phase1では向きの意味付けは対象外」
   と記載している（ManipulationLayer.tsx:80）。これは、**Transport段階の向きには元々clinical
   な意味がないという既存の設計判断**を示す一次証拠である。したがって、Transport中の自由な
   移動・回転に対して「Alignmentを固定する」という概念自体を持ち込む必要がない
   （Transport中は現状のまま——DirectTransportProsthesisのプレビューが
   `computeProsthesisModelPose()`を毎フレーム呼ぶ現状の実装で問題ない）。
2. **Placement確定時（④）を固定タイミングとする理由**: Commit以降にユーザーが操作する
   `dragOffsetX/Y/Z`は、PlacementState定義コメントで明確に
   > 「3D TransformControls drag accumulated」（useSimStore.ts:19-21）
   と記載されており、**粗い配置（Transport）が完了した後の「微調整」として設計されている**
   （±3mmクランプもこれを裏付ける）。微調整の文脈では、大きな回転を伴わない「純粋な平行移動」
   という直感が最も自然であり、Commit時点の姿勢（=Transportで運んできた、その時点でユーザーが
   妥当と判断した向き）を基準に固定するのが最も既存UXと衝突しない。
3. Base Alignment Quaternionの計算式自体は**変更しない**——`computeCurrentAxisAlignmentOrientation
   ({base: basePos+lateralOffset+dragOffsetX(=0 at commit)..., target: UMBO_POS, angleTilt: 0,
   angleTiltZ: 0})`をCommit時点の`base`（Transportで運んだ最終位置）に対して1回評価し、その
   結果のQuaternionを「Placement段階のBase Alignment」として保持する。以降、`dragOffsetX/Y/Z`
   が変化してもこのBase Alignmentは再評価しない。

**留意点**: この定義は、Section 12（D-2 Compatibility）の`startPlacement`（Transport初期姿勢）
と`idealPlacement`（Scoring/Ghost用の目標姿勢）双方に影響する。詳細はSection 12参照。

### 5.4 RECOMMENDATION: **Option C（固定タイミング=Placement Commit時、Section 5.3）**

理由（既存記載を維持）: UX直感・Candidate計算の単純化・D-4 Freeze機構の不要化という3つの
利点が揃う。既存の"UMBO自動追尾"という設計意図をCommit時点の初期整合として保持しつつ、
インタラクティブ操作（微調整フェーズ）からは切り離す。

**留意点（Architect確認が必要な事項、変更なし）**: Option Cは、現在shojiさんが実機で確認・
承認してきた「Translationで自動的にUMBO方向へ向く」という挙動を変更する。これは意図的な
設計だった可能性があり（`computeCurrentAxisAlignmentModel`という名前自体がPoseModelBaseline.md
§4で正式に命名・Frozen指定されている）、UXとして本当に望ましい変更かはコードからは判断できない
（**UNKNOWN / Architect Decision Required**、Section 14 A参照）。

---

## 6. Rotation Semantics

### 6.1 Options（再掲）

R1（現状Euler） / R2（Local post-multiply） / R3（World pre-multiply） / R4（Anatomical、
R3を具体化）。評価表はv1.0から変更なし（Section 6.2参照）。

### 6.2 評価（再掲）

| 観点 | R1（現状） | R2（Local） | R3（World） | R4（Anatomical、明示） |
|---|---|---|---|---|
| User Intuition | ×（軸が説明不能） | ○ | ○ | ◎（"前後/左右に傾ける"というUI文言と一致） |
| Anatomical Meaning | ×（base依存でぶれる） | × | ○ | ◎ |
| Mathematical Stability | ×（Euler round-trip） | ◎ | ◎ | ◎ |
| Collision Candidate統合 | △ | ◎ | ◎ | ◎ |
| D-4 UX互換 | △ | ○ | ○ | ◎ |

### 6.3 R4の数値・座標系レベルでの明文化（Review条件への回答）

Task Review §4の要求に厳密に応える。**「Local X rotation」「Local Y rotation」という単純な
説明は使わない**（既に不正確であることをD-4 Audit E節で確認済み）。また
**screen-space directionとanatomical rotation axisを混同しない**——本節で定義するのは
Section 3.Bで確立した`coordGroupRef`-localの座標系（＝Anatomical Frame）であり、Screen/Camera
Spaceとは無関係である。

```
Axis coordinate frame
= coordGroupRef-local空間（D-4 Audit B節で確立した「Anatomical Frame」、
  <group ref={coordGroupRef} rotation={[Math.PI, -Math.PI/2, 0]}>のローカル座標系）。
  World（Three.jsの生のWorld Space）でもParent（coordGroupRefのさらに親、通常は恒等）でも
  Prosthesis-local（shaft軸基準）でもない。coordGroupRef-localは「Parent-local」の一種だが、
  D-4 Audit全体を通して「lateral-medial/vertical/anterior-posteriorという解剖学的に意味の
  ある軸として運用されている」ことが確認済みのため、本書では明示的に"Anatomical Frame"と呼ぶ。

Base Alignment Quaternion
= Section 5.3で定義した「Placement Commit時に1回だけ計算し、以降固定するQuaternion」
  （computeCurrentAxisAlignmentOrientation()の出力、base=Commit時点のbasePos+lateralOffset+
  dragOffsetX等、target=UMBO_POS固定、angleTilt=angleTiltZ=0で評価）。

angleTilt（前後傾斜）の回転軸
= Anatomical Frame の X軸（lateral-medial軸、D-4 Audit C節で確立: dragOffsetXが加算される軸、
  ControlPad「内/外」ボタンと同じ軸）。
  理由: 前後（anterior-posterior、Z軸）方向への"傾き"は、Z軸自体を回転させるのではなく、
  Z軸と直交するX軸まわりに回転させることで生じる（標準的な回転力学: pitch相当）。

angleTiltZ（左右傾斜）の回転軸
= Anatomical Frame の Z軸（anterior-posterior軸、D-4 Audit C節で確立: dragOffsetZが加算される軸、
  ControlPad「前/後」ボタンと同じ軸）。
  理由: 左右（lateral-medial、X軸）方向への"傾き"は、X軸自体ではなくX軸と直交するZ軸まわりの
  回転で生じる（同上、roll相当）。

Pre-multiplyするQuaternionの生成元
= Anatomical Frame自体（coordGroupRef-local空間で直接定義されたX軸・Z軸）。Base Alignment
  Quaternionの向きには依存しない（Base Alignmentが何であっても、X軸・Z軸は固定）。

合成順序（式）
quaternion = Rx(angleTiltRad, AnatomicalFrame) * Rz(angleTiltZRad, AnatomicalFrame)
             * BaseAlignmentQuaternion
= pre-multiply（Base Alignmentに対して外側から回転を掛ける）。

  理由: post-multiply（R2、baseAlignment * Rx * Rz）だと、回転軸(X/Z)がBase Alignment適用後の
  Prosthesis自身の姿勢に依存してしまい（Local軸扱いになってしまい）、"前後傾斜"という名前が
  約束する「常に解剖学的な前後方向への傾き」という意味を満たせない。pre-multiplyにすることで、
  X軸・Z軸は常にAnatomical Frameに固定された軸のまま保たれる。
```

**Shaft Rollとの合成順序**: Section 8の通りShaft RollはProsthesis local +Y軸まわりの
post-multiply（`quaternion.multiply(RollY)`）であるため、Rotationとは独立した「最後に乗せる」
操作として現状の順序を維持する。全体の合成順序は次のようになる。

```
finalQuaternion
  = [ Rx(angleTilt) * Rz(angleTiltZ) * BaseAlignmentQuaternion ]  ← Section 6.3のRotate部分
    * Roll(shaftRollDeg, Local+Y)                                  ← Section 8のShaft Roll部分
```

### 6.4 実機確認が必要な事項（Review §5への回答、UNKNOWN明記）

Task Review §5の要求通り、**数学的定義（6.3節）とUX確認（実機）を分離する**。以下は
コードからは判断できず、shojiさんの実機確認が必要な項目として**UNKNOWN**のまま記録する
（推測でPASSにしない）。

| 確認事項 | 内容 | 現状 |
|---|---|---|
| A | `angleTilt`の正方向（例: X軸+回転）が、UI「前傾」ボタン（ControlPad.tsx:148、`rotate('tilt', 1)`）を押したときにユーザーが期待する「前へ傾く」向きと一致するか | UNKNOWN |
| B | `angleTiltZ`の正方向が、UI「右傾」ボタン（ControlPad.tsx:151、`rotate('tiltZ', 1)`）を押したときにユーザーが期待する「右へ傾く」向きと一致するか | UNKNOWN |
| C | 6.3節のX軸/Z軸マッピング（前後傾斜=X軸、左右傾斜=Z軸）自体が、実際にBELL/TORP/PISTON
    各製品・各症例のジオメトリで見た目として正しい「前後/左右」に見えるか（basePosの向きに
    よっては符号や軸マッピングを反転する必要がある可能性） | UNKNOWN |
| D | Translation Option C採用後、「動かしても回転しない」という体験が実際にユーザー
    （shojiさん）の意図に合うか（5.4節の留意点と同一項目） | UNKNOWN |
| E | D-4 Freeze/Slerp（Option①/②）を将来的に不要化してよいか（Section 9参照） | UNKNOWN |

これらはSection 16「Final Approvalに必要な条件」に集約する。数式・符号の反転自体は
「実機確認時に反転可能な最小定数」という既存プロジェクトの設計パターン（`ROTATE_DEG_PER_PIXEL_TILT`
等、SimScene.tsx既存コメント）を踏襲すればよく、実装コスト自体は小さいと見積もられる
（**ただし本Taskでは実装しない**）。

### 6.4.1 実機確認の試行ログ（Test R4-1〜R4-5、Decision Gate継続タスクでの再試行）

Task指示（Section 4）に従い、既存Browser pane環境で実機確認をもう一度試みた（3回目）。

```
$ npm run dev  （ポート5173使用中のため5174で起動）
$ preview_start → http://localhost:5174
$ document.hidden          = true
$ document.visibilityState = "hidden"
```

D4-B Runtime Safety Verification・D4-B Final Runtime Verificationで確認済みの制約が3回目も
再現した。Task指示「同じBrowser環境でWebGL runtime検証を無限に繰り返す必要はない」に従い、
これ以上の試行は行わなかった。したがって、Test R4-1〜R4-5（前後傾斜/左右傾斜/正負方向/
Translation独立性/複合操作の実機確認）はいずれも**実施不可（NOT REPRODUCIBLE）**であり、
推測でPASSに変更していない。

```
Test R4-1（前後傾斜）           = UNKNOWN
Test R4-2（左右傾斜）           = UNKNOWN
Test R4-3（正負方向）           = UNKNOWN
Test R4-4（Translation独立性）  = UNKNOWN
Test R4-5（複合操作）           = UNKNOWN
```

Decision 3（Rotation R4）は、数学的定義（6.3節、COMPLETE）とは独立に、
**`Rotation R4 = PENDING / UNKNOWN`のまま**とする。通常表示可能なブラウザ環境
（shojiさんの手元環境）での確認が引き続き必要。

### 6.5 RECOMMENDATION: **R4（Anatomical-axis pre-multiply、Section 6.3の式で確定）**

理由（既存記載を維持・補強）: PlacementStateの既存コメント・ControlPadの既存UIラベルが
最初から"前後傾斜/左右傾斜"という解剖学的軸を約束しており、R4はその約束を実際に満たす。
6.3節でその約束を数式レベルまで具体化した。

---

## 7. Depth Semantics

### 7.1 方向選択: Camera-relative — 維持を推奨（変更なし）
D-4 Audit G節の実測で、Depthはカメラ向きに応じて実際に動く解剖学的軸（X/Y/Z）自体が
切り替わることを確認済み。これは「画面奥/手前へ動かす」というUser Intentそのものであり、
合理的なUX設計である。World-relative（固定軸）への変更は推奨しない。

### 7.2 Quaternionへの影響: Position-only化を推奨（変更なし）
Section 5でOption Cを採用する場合、Depthは自動的にPosition-onlyになる（特別な設計変更は
不要）。

### RECOMMENDATION: **Camera-relative（軸選択） + Position-only（Quaternion挙動、Section 5 Option Cに従属）**

---

## 8. Shaft Roll Semantics

D-4 Audit F節で、Shaft RollがProsthesisのlocal +Y軸（shaft長軸そのもの）を回転軸とすることを
幾何学的階層と数値検証の両方で確認済み。「Shaft Roll = Prosthesis shaft longitudinal axis
rotation」として正式定義することを提案する（Task Review §7）。

既存実装との整合性: 6.3節の合成順序（Rotate部分を先に適用、Shaft Rollを最後にpost-multiply）は
現行実装の順序（`pose.quaternion.multiply(Roll)`）と一致しており、変更を要しない。

### RECOMMENDATION: **現状維持（Local shaft axis）**

理由: 名前が約束する意味と実装が一致しており、数学的にも安定。唯一の懸念はCollision Candidate
の欠落（Section 10 Requirement 4）であり、軸の意味論自体には問題がない。

---

## 9. Pointer Drag Semantics

現在: Screen-space raycast → camera向き法線のPlaneとの交点差分 → coordGroupRef-local化
（D-4 Audit H節）。

```
Pointer Drag = Camera plane / screen plane movement（画面に沿った移動）
Depth        = Camera forward/backward movement（画面奥行き方向の移動）
```

という3D操作分解は、既存実装の実態と一致している（Pointer DragのPlaneはcamDirを法線として
構築されており、Depthは同じcamDirそのものに沿って動く。両者は互いに直交する2つの操作として
既に設計されている）。

### RECOMMENDATION: **現状維持（Screen-space / Camera-plane）**

理由: 「掴んで動かす」という直接操作のUXはScreen-spaceマッピングが最も自然。Depthとの役割
分担も明確（3自由度の並進を過不足なくカバー）。

**軽微な既知の懸念（記録のみ）**: Drag-Planeの通過点は`dragGroupRef`のワールド原点
（Prosthesis実位置とは数mm程度ズレている可能性がある点）であり、Perspectiveカメラでの
ドラッグ感度に軽微な影響を与えうる（Section 14 Risks参照）。

---

## 10. Collision Candidate Contract

### 10.1 原則
> Collision Candidateは、最終的にRenderingされるPoseと同一のPose semanticsから生成されるべきである。

### RECOMMENDATION: **YES**

「Rendering用とCollision用に別々の近似式を書く」という現在のアーキテクチャは、
- 片方の関数だけがdragOffsetを含め忘れる（非対称バグ）、
- 片方（Arrow/ControlPad）はCollision Candidate自体を作り忘れる（欠落）、
という**同種の過誤を繰り返し生む構造的リスク**を内在している。個別の関数を直しても再発しうる
問題であり、「Rendering/Candidateを単一の生成点から作る」という規律をアーキテクチャレベルで
強制する以外に根本解決はない。

### 10.2 Requirement 1〜5への回答（再掲、Section 5/6のRecommendation反映）

| Requirement | 現状 | Section 5/6のRecommendationを採用した場合の効果 |
|---|---|---|
| R1: Candidate==Rendering | 満たされない | Option C+R4採用でPositionは単純加算、Quaternionは委譲操作(Rotate)経由でのみ変化するため、同一の合成手順を踏めば数学的に一致させやすくなる |
| R2: Committed state保持 | `composeDragCandidatePose`は満たさない、`composeRotationCandidatePose`は満たす | Canonical Generatorが常にFULL committed stateを入力に取る設計にすれば、非対称性自体がなくなる |
| R3: Translation起因のQuaternion変化もCandidateへ反映 | Option B（現状）では必要だが未実装 | Option C採用ならこの要求自体が不要になる |
| R4: 全Translation inputが同じCollision Constraintを通る | 満たされない | Section 5/6の選択に関わらず必須の対応 |
| R5: Collision判定とRenderingのPose semanticsを分離しない | 満たされない | Section 11のCanonical Pose Generator採用で解消 |

### 10.3 入力方法とManipulation Semanticsの分離（Task Review §9への回答）

```
Pointer Drag ─┐
Arrow ────────┤
ControlPad ───┤     → すべて「Anatomical Frame-localな並進delta」に正規化される
Depth ────────┤       （現状でも実質的にこの形——Pointer Drag/Depth/Arrowはいずれも
               ↓       coordGroupRef-local方向ベクトルをdragOffsetX/Y/Zへ加算するのみ）
       Manipulation Intent（並進 or 回転 or Shaft Roll、と量）
               ↓
     Canonical Pose Generator（Section 11）
               ↓
        Rendering Pose ／ Collision Candidate Pose（同一関数・同一入力形状）
```

**現状の入力方法間の違いは、すでに「どんな量のdeltaを生成するか」という値の生成元の違いに
留まっており（Screen-space raycastかキー押下固定量か等）、Manipulation Semantics自体
（＝dragOffsetX/Y/Zという同一フィールドへ加算する、という意味論）は既に共通化されている。**
崩れているのはこの先——「そのdeltaをCollision Candidateとして評価するかどうか」が入力方法
ごとに異なる（Pointer Drag/Depthはする、Arrow/ControlPadはしない）という、Layer 3側の
非対称性である（Section 4参照）。したがって、Task Review §9が要求する「入力方法によって
Collision semanticsが変わってはいけない」という原則は、**新しい抽象化を追加するというより、
既存のCandidate生成コードパス（`evaluateDragCandidate`）を、Arrow/ControlPadも含めた
全ての並進入力の共通出口として使うよう配線し直す**、という比較的小さい変更で達成できる
見込みが高い（配線の詳細は実装Taskで確定する）。

### 10.4 Requirement 4の重要度（変更なし、再確認）

Requirement 4は「どの軸設計を選ぶか」とは独立した、「全ての操作入力がCollision Constraint
という同じ安全装置を通る」というSafety Coverageの問題であり、Section 5/6のいずれのOptionを
最終的に選んでも、Arrow-key/ControlPad Translation・Shaft Rollには等しくCollision Candidate
評価を追加する必要がある。**Task Review §13でP0として扱われている理由もこれと同一。**

---

## 11. Canonical Pose Generator Proposal

### 11.1 P0調査事項1〜7への回答（Task Review §2の要求に対応）

**1. `computeProsthesisModelPose()`をCanonical Pose Generatorとして利用できるか**
= **部分的にYES**。Position+Quaternionの中核計算（base→target alignment、tilt適用）は
このままの形で再利用できる。ただし以下2点は現状のこの関数の責務外。

**2. そのまま利用できない場合、どの責務を抽出すべきか**
= (a) `shaftRollDeg`の後乗せ（現在3箇所に重複、Section 11.2参照）をこの関数の外側の薄い
ラッパーへ統合する。(b) Section 5.3で定義した「Base Alignment固定」の概念（Commit時点で
1度だけ評価し、以降はキャッシュされた値を使う）は`computeProsthesisModelPose()`自体には
持たせず、呼び出し元（PlacementState管理層）が「Commit時点のBase Alignment Quaternion」を
別途保持し、それをこの関数（またはラッパー）へ引数として渡す形にする——`computeProsthesisModelPose()`
自体は「常にbase/targetから再計算する」という現在の純粋関数としての性質を保ったまま、
呼び出し側の使い方でOption Cのセマンティクスを実現する。

**3. State PoseとCandidate Poseをどのように表現するか**
= Section 11.2の`EffectivePlacementInputs`（Committed State、既存PlacementStateとほぼ同型）
と`CandidateDelta`（評価中の未確定操作、排他的discriminated union）に分離する。

**4. Candidate計算時に一時的なStateを生成する設計が妥当か**
= 妥当と判断する。理由: 現状でも`dragGroupRef.position`（Pointer Drag中の生delta）・
`pendingAngleTiltRef`（Rotate中のpending値）といった、Committed Stateとは別のtransientな
一時値がイベントハンドラのローカルスコープに既に存在しており、これをCommit時にPlacementState
へ反映するという構造は既存パターンと一致する。新しい概念ではなく、既存パターンの延長。

**5. RenderingとCollisionが完全に同一Pose semanticsを共有できるか**
= Section 5（Option C）・Section 6（R4）を採用すればYES。採用しない場合（現状Option B/R1を
維持する場合）でも、「Candidateも必ずcomputeProsthesisModelPose()をフル評価する」という
規律さえ守ればRenderingと数学的に一致させることは可能（ただしPosition/Quaternionとも非線形な
ままなので、Option C/R4採用時ほど実装がシンプルにはならない）。

**6. Pointer / Arrow / ControlPad / Depth / Rotationがすべて同じManipulation semanticsへ
   収束できるか**
= Section 10.3で述べた通りYES。すでに「同一フィールド（dragOffsetX/Y/Z、angleTilt/
angleTiltZ）へ加算する」という点で収束している。不足しているのはLayer 3（Collision
Candidate評価の網羅性）のみ。

**7. Collision Candidateだけ別の近似計算を行わないことを明文化する**
= 本書10.1節の原則として明文化済み。実装Taskへの申し送り事項として、「新しい`composeXxxPose()`
関数を追加する形での実装は禁止し、必ずCanonical Pose Generator（Section 11.2）を経由する」
という制約を実装Prompt側に明記することを推奨する。

### 11.2 提案する関数シグネチャ（設計方針のみ、実装はしない、変更なし）

```
resolveEffectivePose(committed: EffectivePlacementInputs, candidate?: CandidateDelta): Pose

EffectivePlacementInputs = {
  product, shaftLength, basePos,
  lateralOffset, anteriorOffset, verticalOffset,     // スライダー起点のオフセット
  dragOffsetX, dragOffsetY, dragOffsetZ,             // Fine Adjustment累積値（Committed）
  angleTilt, angleTiltZ,                             // Rotation（Committed）
  shaftRollDeg,                                      // Shaft Roll（Committed、PlacementState外）
  baseAlignmentQuaternion,                           // Section 5.3: Commit時点で1度だけ確定した値
}
CandidateDelta = 排他的に1種類のみ:
  | { kind: 'translate', localDelta: Vector3 }        // Pointer Drag / Depth / (将来: Arrow/ControlPad)
  | { kind: 'rotate', axis: 'tilt'|'tiltZ', angle: number }
  | { kind: 'shaftRoll', angle: number }              // 現在未対応、Requirement4で新設
```

`resolveEffectivePose()`内部で、Section 5/6のDecision（Option C + R4を採用した場合）に従い、
Section 6.3で確定した合成式（`Rx(angleTilt)*Rz(angleTiltZ)*baseAlignmentQuaternion*
Roll(shaftRollDeg)`）とPosition側の単純加算を実装する。Rendering呼び出しは`candidate`を
渡さない、Collision Candidate評価は評価対象のdeltaだけを`candidate`として渡す——同じ関数、
同じ合成順序で両方を計算するため、R1（Candidate==Rendering）が実装として保証される
（近似ではなく恒等式になる）。

### 11.3 State / Candidate Stateの責務分離（変更なし）

| State | 所有者 | 性質 |
|---|---|---|
| `basePos` | Case + Product解決ロジック（SimScene.tsx、stapes状態で分岐） | 派生値、Read-only |
| `lateralOffset/anteriorOffset/verticalOffset` | PlacementState | 粗調整（スライダー起点）、Committed |
| `dragOffsetX/Y/Z` | PlacementState | 微調整累積値、Committed、±3mmクランプ |
| `angleTilt/angleTiltZ` | PlacementState | Rotation、Committed、±180°クランプ |
| `shaftRollDeg`(`interactionShaftRollDeg`) | PlacementState外（別store field） | Committed、Safety/Score非参照 |
| **`baseAlignmentQuaternion`（新規）** | **Section 5.3: Placement Commit時に1回確定、PlacementState外の新規state（案）** | **Committed、Rendering/Candidate双方の入力** |
| `transportPose/transportTilt` | ManipulationLayer.tsx（Placement Commit前の一時state） | Transport専用、Commit時にdragOffset/angleTiltへ変換 |
| Candidate Delta（ドラッグ中・押下中の未確定値） | 各操作のイベントハンドラ内ローカル変数 | 一時的、Commit（pointerup/keyup）で上記Committed Stateへ反映 |

この表は現状のownership（PlacementStateとTransportの分離、Committed/Candidateの区別）を
概ね踏襲しつつ、Option C採用時に新規追加が必要になる`baseAlignmentQuaternion`のみ加えている。

### 11.4 パフォーマンス上の懸念への回答（変更なし）

Rotate Smoothness調査（`scripts/rotate-smoothness-cost-harness.ts`）で「Collision評価自体は
無視できるコスト（mean 0.085ms）」と実測済み。Candidate Pose計算はCollision評価そのものより
軽い処理であるため、Canonical Generator化によるパフォーマンス低下の懸念に対する反証として
十分と考えられる（新規ベンチマークは本Taskでは実施していない、既存資産の参照のみ）。

---

## 12. D-2 Compatibility（新規、Task Review §11への回答）

### 12.1 保存データの実際の形（調査結果）

`CasePlacementSnapshot`（`exportGroundTruth.ts:76-84`、Save Start Position/Save Ideal
Positionが書き込む共通形）は次の通り。

```ts
{
  lateralOffset:  number,   // = placement.lateralOffset + placement.dragOffsetX（合計値）
  anteriorOffset: number,   // = placement.anteriorOffset + placement.dragOffsetZ（合計値）
  verticalOffset: number,   // = placement.verticalOffset + placement.dragOffsetY（合計値）
  angleTilt:      number,   // = placement.angleTilt（生の角度値）
  angleTiltZ:     number,   // = placement.angleTiltZ（生の角度値）
}
```

**結論（Task Review §11の質問に直接回答）**: 保存済みStart Position/Ideal Positionは、
**「位置＋姿勢」を1つのPose（position vector + quaternion）として保存しているのではなく、
位置3値と角度2値を独立した数値として保存している。** Quaternionは保存されていない。
再利用時（Transport初期化、IdealGhostProsthesis描画、Scoring）は、いずれもこの5数値を
`computeProsthesisModelPose()`（またはその角度パラメータ）へ**再投入**して、その時点の
Pose生成ロジックでQuaternionを都度再計算している。

### 12.2 影響範囲の特定

| 用途 | 該当コード | R4採用時の影響 |
|---|---|---|
| `startPlacement`（Transport初期姿勢） | SimScene.tsx:1560-1570、`transportTilt`の初期値に`sp.angleTilt/angleTiltZ`をそのまま使用 | Transport段階のプレビュー（ManipulationLayer.tsx:553-557）は現行のComputeProsthesisModelPose()をそのまま使うため、**Rotation SemanticsをR4化してもTransport段階自体はSection 5.3の理由により対象外**（Transportの向きは意味を持たない設計）。ただし、Commitして`angleTilt/angleTiltZ`がPlacementStateへコピーされた**直後の見た目**は、R4適用後は現在と異なる可能性がある。 |
| `idealPlacement`（Scoring/Ghost用目標） | `resolveIdealLateralOffset`/`resolveIdealAngle`（cases.ts:82-91）→`computeScore()`（数値diffのみ、useSimStore.ts:274-275）／`IdealGhostProsthesis`（computeProsthesisModelPose呼び出し、SimScene.tsx:2221-2229） | Scoring自体（角度の差分計算）はセマンティクス非依存のため**式は無変更で動く**（12.3節参照）。しかし**Ghost表示の見た目**（Rendering）はR4適用後に変わる。 |
| 既存保存値の一覧（`src/data/cases.ts`より） | `idealAngle`: 12症例中5症例が非0（-0.2, 5, -0.3, 0.1, -0.2, 5, 0.2, 3, -0.1等）／`startPlacement.angleTilt`: 3症例（case-012/013/014）が`-86.00`で保存済み | **これらの数値がR4適用後に意図した見た目を再現する保証はない**（12.3節「Migration required」） |

### 12.3 「互換性あり」と推測しない — Migration Requiredの明示

Task Review §11の指示「既存保存データを壊す可能性がある場合はMigration requiredとして明示する。
推測で互換性ありと判断しない」に従い、以下を明確に判定する。

```
computeScore() のスコアリング式自体
= 互換性あり（コード変更不要）
  理由: angleDiffX = |angleTilt - idealAngle| という「保存されている数値同士の引き算」のみで
  完結しており、Quaternionを一切参照しない（useSimStore.ts:274-276で確認済み）。R1→R4の
  切り替えは、この引き算の対象となる数値の「意味」を変えるだけで、計算式自体は変更なしで動く。

idealAngle / idealPlacement.angleTilt の"値"（12症例中5症例が非0、上表参照）
= Migration Required
  理由: これらの数値は、R1（Euler再合成）方式のもとで「視覚的に妥当な理想角度」として
  shojiさんが実機調整・確定した値である可能性が高い（数値の由来を示すコミット履歴等は
  本調査の範囲外、確認できていない）。R4適用後、同じ数値を`computeProsthesisModelPose()`
  （新しい合成式）へ入力すると、**視覚的に異なる姿勢が生成される**（R1とR4は同じ入力に対し
  異なるQuaternionを返すことがD-4 Audit E節で数値確認済み: 差15.24°〜4.79°）。
  したがって、R4採用時は該当する全症例（少なくとも上表に挙げた5+3症例）について、
  実機で目視確認しながら値を再設定する（＝既存の「Save Ideal Position」/「Save Start
  Position」ボタンで再キャプチャする）作業が必要になる。

startPlacement.angleTilt = -86.00（case-012/013/014）
= Migration Required（Transport初期姿勢としての妥当性を再確認）
  理由: 上記と同様。Transport段階自体はSection 5.3によりR4の対象外だが、Commit直後に
  PlacementStateへコピーされた瞬間からR4の対象になるため、Commit直後の見た目が変わりうる。
```

**再migrationの実施方法自体はコード変更を伴わない**——既存の「Save Start Position」「Save
Ideal Position」ボタン（SimScene.tsx:2009-2048）をそのまま使い、実機でR4適用後の見た目を
確認しながら再度値をコピーし、`cases.ts`へ手動で貼り付け直すだけでよい（既存のD-2ワークフロー
の再実行）。ただし、**この再キャプチャ作業自体を「いつ・誰が・何症例分行うか」はFinal
Approvalの条件（Section 16）として明示する。**

**[Decision Gate監査で更新、Section 12.5参照]** 本節（12.3）執筆時点では「実機で目視確認
しながら値を再設定する（再キャプチャ）」が唯一の対応方法であるかのように記載したが、その後
Section 12.5で数値検証した結果、**既存の5+3症例は全数`angleTiltZ=0`であり、R1→R4変換は
実機確認・再キャプチャを要さない数値変換（Option A、恒等写像・誤差ゼロ）で足りる**ことが
判明した。したがって本節で述べた「Migration Required」という判定自体は正しいが（R1の数値を
そのままR4へ入力してはいけない、という結論は変わらない）、その対応方法は「実機での再確認・
再キャプチャ」ではなく「Section 12.5の数値変換の適用」で足りる。本節の記述はSection 12.5に
より更新されたものとして読むこと。

### 12.4 transportPose / transportTilt自体への影響

Section 3.Cで確認した通り、`transportPose`/`transportTilt`はPlacement Commit前の一時stateで
あり、Section 5.3の結論（Transport段階はR4/Option Cの対象外）により、**このstate自体の構造・
ライフサイクルには変更が生じない**。影響が生じるのはCommit直後（transportTilt.tilt/tiltZが
angleTilt/angleTiltZへコピーされた瞬間から）のみである。

### 12.5 Migration Option A — 数値的実現可能性の検証（新規、Decision Gate継続タスク）

Task指示（Migration Option A調査事項1〜5）に応え、「旧Euler semantics（R1）から新R4 semantics
への変換が数学的に一意か・Losslessか」を、**推測ではなく実際にNode.js+three.jsで数値検証した**
（一時検証スクリプト、検証後削除、Frozen対象コードは無変更）。

**数学的導出（検証前の仮説）**: R1（Euler XYZ再合成）とR4（`Rx(angleTilt)*Rz(angleTiltZ)*
baseAlignment`）は、`angleTiltZ=0`の場合に限り、代数的に完全一致するはずである。理由:
R1は`recompose(euler0.x+tiltX, euler0.y, euler0.z+tiltZ)`であり、'XYZ'順のEuler合成規約
（`M = Rx(x)·Ry(y)·Rz(z)`）のもとでは、`tiltZ=0`のとき
`recompose(euler0.x+tiltX, euler0.y, euler0.z) = Rx(euler0.x+tiltX)·Ry(euler0.y)·Rz(euler0.z)
= Rx(tiltX)·[Rx(euler0.x)·Ry(euler0.y)·Rz(euler0.z)] = Rx(tiltX)·quat0`
（Rx(a)·Rx(b)=Rx(a+b)という同一軸回転の可換性のみを使用、近似ではなく恒等式）。これは
R4の定義`Rx(tiltX)*Rz(0)*baseAlignment = Rx(tiltX)*baseAlignment`（`baseAlignment=quat0`、
Section 6.3で確認済み）と**完全に同一の式**になる。`angleTiltZ≠0`の場合はこの可換性が
成立しないため、一般には一致しない。

**数値検証結果**（BELL-type、実座標定数 basePos=STAPES_HEAD、target=UMBO_POS使用）:

```
Claim 1: angleTiltZ=0（tiltXのみ）→ R1とR4は完全一致するはず
  angleTilt=0/±0.1/±0.2/±0.3/3/5/45/-45/90 → angle(R1,R4) = 0.000e+0 度（機械誤差レベル）
  angleTilt=-86.00 → angle(R1,R4) = 1.708e-6 度（浮動小数点誤差、実質ゼロ）
  → Claim 1 CONFIRMED（全ケースで一致、恒等式であることを数値的にも確認）

Claim 2: angleTiltZ≠0 → R1とR4は乖離するはず
  angleTiltZ=1° → 0.48度差 / 5° → 2.40度差 / 10° → 4.79度差（D4 Audit E節の実測値と一致）
  → Claim 2 CONFIRMED（乖離は存在し、angleTiltZの大きさにほぼ比例して増大）

Claim 3: cases.ts の idealAngle 全12症例（-0.2, 0, 0, 0, -0.3, 0.1, -0.2, 0.2, 0, 0, -0.1, 0）
  → 全12症例で angle(R1,R4) = 0.000e+0 度

Claim 4: cases.ts の startPlacement（case-012/013/014、angleTilt=-86.00, angleTiltZ=0.00）
  → angle(R1,R4) = 1.708e-6 度（機械誤差レベル）
```

**結論（Migration Option A調査事項1〜5への回答）**:

```
1. 旧angleTilt/idealAngleが何を意味していたか
   = R1（Euler XYZ再合成）方式でのquat0(base→target)からのtiltX/tiltZ偏差。
     ただしcodeベースの追跡だけでは「なぜその数値（-0.2度、-86.00度等）が選ばれたか」という
     臨床的・実機確認上の意図は確認できない（UNKNOWN、コミット履歴等の追加調査が必要）。

2. 旧Euler semanticsからR4 semanticsへの変換が数学的に一意か
   = 一般にはNO（angleTiltZ≠0の場合、Rx*Rzという2パラメータ合成では旧Quaternionを
     厳密に再現できない一般的な保証はない）。ただし angleTiltZ=0 の場合に限り、
     YES・恒等（数値検証で確認済み）。

3. Positionとの組み合わせで元のIdeal Poseを再現できるか
   = Position計算式（`computeCurrentAxisAlignmentPose`のmidpoint部分）はR1/R4で共通のため、
     Quaternionさえ一致すればPositionも自動的に一致する。

4. Quaternionを介してLosslessに変換できるか
   = angleTiltZ=0の場合はYES（Lossless、上記数値検証で確認）。angleTiltZ≠0の場合は
     一般にはNO（現時点でexact変換式は未導出、UNKNOWN）。

5. 変換後のデータをCanonical Pose Generatorで再生成した場合、旧Ideal Poseと一致するか
   = 上記の通り、既存の全D-2データ（idealAngle 12症例・startPlacement 3症例）は
     **例外なくangleTiltZ=0であるため、変換誤差ゼロ（機械精度の範囲内）で一致する**
     （Claim 3・4で全数検証済み）。
```

**Migration Option A（数値変換）に対する最終評価**: **既存D-2データに関しては、変換は
「数式変換」というより「恒等写像」（`angleTilt_new = angleTilt_old`、`angleTiltZ_new =
angleTiltZ_old = 0`のまま何もしない）に等しく、数学的に厳密かつ無誤差であることを全数値
検証で確認した。** これはSection 9（Migration Decision Matrix）の「数値検証なしにOption Aを
安全と断定しない」という要求に対し、**推測ではなく実際の数値検証で応えたものである**。

**留意点（一般化への注意）**: この結論は「既存データが偶然すべてangleTiltZ=0である」という
**現在のデータセットに固有の性質**に依存しており、R1→R4変換が一般に安全であることを意味しない。
将来、angleTiltZ≠0のIdeal/Start Positionを新規に保存する場合（現在computeScore()は
「左右傾斜の理想は全症例0°」を前提にしており、これ自体が意図的な設計かは別途確認が必要）、
Option A（数値変換）は使えず、Option B（実機での再キャプチャ）が必要になる。

---

## 13. Decision Matrix（更新版）

| Operation | User Intent | Position Axis | Quaternion Behavior | Recommended Semantics | Collision Candidate |
|---|---|---|---|---|---|
| X Translation | 内外側へ平行移動 | coordGroupRef-local X（lateral-medial） | 変化なし（Option C採用時、Base Alignment固定＝Section 5.3） | Position-only Translation | Canonical Generatorへ統合（新規追加） |
| Y Translation | 上下へ平行移動 | coordGroupRef-local Y（vertical） | 変化なし | 同上 | 同上 |
| Z Translation | 前後へ平行移動 | coordGroupRef-local Z（anterior-posterior） | 変化なし | 同上 | 同上 |
| Pointer Drag | 掴んで動かす（画面に沿った2軸） | Screen/Camera-plane→coordGroupRef-local | 変化なし | Screen-space、Position-only | Canonical Generatorへ統合（既存経路を置き換え） |
| Depth | 画面奥/手前へ動かす | Camera-forward→coordGroupRef-local（動的） | 変化なし | Camera-relative、Position-only | 同上（Freeze機構は不要化候補、Section 14で条件付き） |
| Rotate | 前後/左右に傾ける | N/A（回転） | Anatomical Frame（X=前後傾斜、Z=左右傾斜、Section 6.3）まわりのpre-multiply | R4 Anatomical-axis | 既存`composeRotationCandidatePose`をCanonical Generatorへ統合 |
| Shaft Roll | シャフトを軸に回す | N/A（回転） | Local +Y軸まわりのpost-multiply（現状維持） | 現状維持 | 新規追加（現在皆無） |
| ControlPad | Translation/Rotationのボタン版 | Same semantic axis（対応する操作と同一） | Same semantic rule（対応する操作と同一） | Input-independent（入力方法はSemanticsを変えない、Section 10.3） | 新規追加（現在皆無、Requirement4） |
| Arrow | Translation/Rotationのキーボード版 | Same semantic axis | Same semantic rule | Input-independent（同上） | Translation側のみ新規追加（Rotate側は既にCollision判定を実装済み、SimScene.tsx:1168） |

各行の一貫性確認（Task Review §12要求）: User Intent（Section 5-9の各RECOMMENDATIONの理由）
→ Manipulation Semantics（Position-only or Anatomical-axis回転）→ Pose result（Section 11.2の
`resolveEffectivePose()`が単一の合成式で返す）→ Collision Candidate contract（Section 10.1の
原則によりRenderingと同一関数を経由）という流れが、全行で矛盾なく繋がっていることを確認した。

---

## 14. Recommended Architecture / Risks（統合）

### 14.1 Recommended Architecture（変更なし）

```
Translation:    Option C（Section 5、固定タイミング=Placement Commit時、Section 5.3）
Rotation:       R4（Section 6、Anatomical Frame pre-multiply、式はSection 6.3）
Depth:          Camera-relative + Position-only（Section 7、Translationに従属）
Shaft Roll:     現状維持（Section 8）
Pointer Drag:   現状維持（Section 9）
Collision Candidate: Canonical Pose Generator = YES（Section 10/11）
```

### 14.2 Risks

**A. Option C（Translation Position-only化）はUX変更である**（UNKNOWN、Section 6.4 D参照）:
shojiさんが既に確認・承認してきた「Translationで自動的にUMBO方向へ向く」挙動が実際にどう
使われているか（意図的な機能か、単なる既存Pose Modelの副作用か）はコードから判断できない。
実機での意図確認が必須。

**B. R4（Anatomical Axis Rotation）は既存の角度値の意味を変える**（Section 12で
Migration Requiredと確定）。**[Decision Gate監査で更新]** Section 12.3執筆時点では
「再キャプチャが必要」とのみ記載していたが、その後Section 12.5の数値検証により、
既存D-2データ（5+3症例）は全数`angleTiltZ=0`であり、R1→R4変換が誤差ゼロ（恒等写像）で
成立することを実証したため、**再キャプチャ（Option B）ではなくOption A（数値変換、実質
無変更のコピー）で足りる**（Section 12.5・18 Decision 8参照）。ただし、この変換の実行
自体はDecision 3（Rotation R4の採否）が確定して初めて意味を持つ（Decision 3が
REJECTされればR4への変換自体が不要になる）。将来angleTiltZ≠0のデータを保存する場合は
この結論が成立しないため、その場合に限りOption B（再キャプチャ）が必要になる
（Section 12.5留意点）。

**C. D-4 Freeze/Slerp機構の扱いは別Decision**（Task Review §10・§6の指示通り）:
Section 5/7で「不要になる可能性が高い」と述べたDepth Session Quaternion Freeze（Option①）・
Release Slerp補間（Option②）は、Depth Freeze不具合（D-4-A）の修正として既にshojiさんの承認を
得て実装・Commit済みの機能である（commit 871b1c5）。**今回のTaskではこれを削除しない。**
以下として明記する。

```
Current D-4 Freeze/Slerp
= Existing approved implementation（commit 871b1c5、削除しない）
Future status
= REMOVE / RETAIN decision required（Section 16の条件5、Section 6.4 Eの実機確認事項）
```

削除はFinal Architect Decision後の別Implementation Taskで、明示的な承認を得てから行う。

**D. Pointer DragのDrag-Plane通過点のズレ**（Section 9末尾、記録のみ）: 本書のスコープ外の
軽微な実装詳細だが、Canonical Pose Generator導入と同じタイミングで見直す価値があるかもしれない
（別Issueとして記録することを推奨）。

**E. 実MeshBVHでのFalse Negative/Positiveは依然UNKNOWN**: 本Decisionは静的解析・実測可能な
Position/Quaternion乖離幅に基づく判断であり、「実際に臨床的に危険な配置がCollisionをすり
抜けた」という直接証拠はまだ得られていない。この確認は、実装Task着手前、または着手と並行して、
通常表示可能なブラウザ環境で再試行すべき（同一Browser paneでの再試行は既に2回失敗しており、
繰り返す必要はない、というTask Review §15の指示を踏襲）。

---

## 15. Implementation Prerequisites（Final Approval後、実装Task発行前に必要な準備）

1. Section 16の全条件がshojiさんにより確認・承認されていること。
2. Section 12.3で特定した5+3症例の`idealAngle`/`startPlacement.angleTilt`について、
   Section 12.5の数値検証結果に基づきOption A（数値変換、既存データは誤差ゼロで恒等）を
   適用する方針が確定していること（実施方法・タイミングは実装と同時で問題ない見込み、
   Section 18 Decision 8参照）。ただし本項目自体はDecision 3の確定が前提。
3. D-4 Freeze/Slerp機構の削除可否（Risks C）が決まっていること。
4. Requirement 4（全Translation input・Shaft Rollへのcollision candidate新規追加）の
   実装優先度がP0として確定していること（Task Review §16のPriorityと整合）。
5. 実MeshBVH False Negative/Positive確認を、実装Task着手前に別途実施するかどうかの方針。

---

## 16. Conditions for Final Approval（新規、Task Review §13の要求に対応）

Task Review §13の暫定評価（**APPROVE WITH CONDITIONS**）に対し、Final Approvalへ進むために
満たすべき条件を以下に列挙する。

```
1. Canonical Pose Contractの具体化
   = COMPLETE（Section 11、resolveEffectivePose()のシグネチャ・合成式まで明文化済み）

2. Translation Base Alignmentの定義
   = COMPLETE（Section 5.3、固定タイミング=Placement Commit時と確定・根拠明記）
   ただしUX意図確認（Section 6.4 D）はUNKNOWNのまま——shoji実機確認待ち

3. Rotation Axisの数値的定義
   = COMPLETE（Section 6.3、座標系・軸・合成順序を数式で明文化済み）
   ただし実機確認（Section 6.4 A/B/C）はUNKNOWNのまま——shoji実機確認待ち

4. D-2保存データとの整合性確認
   = COMPLETE（Section 12、Migration Required対象を5+3症例と特定済み。Section 12.5の
   数値検証によりOption A＝数値変換で対応可能なことも実証済み、再キャプチャOption Bは
   現行データには不要と判明）
   ただし実際のMigration実行（Option A適用、Section 12.5）はDecision 3確定後・
   Final Approval後の作業として未実施のまま

5. D-4 Freeze/Slerpの撤去可否
   = NOT DECIDED（Section 14 Risks C、Section 6.4 E）——shoji判断待ち、今回は削除しない
```

**したがって、Final Architect Decisionは本書では確定していない。** 上記1〜3の技術的定義は
完了したが、4（実データ移行の実施）と5（Freeze/Slerp撤去）はshojiさんの判断・作業を要する
オープン項目であり、かつ2/3の技術的定義についても「UX上の意図・見た目が実機で本当に正しいか」
という確認（Section 6.4）が残っている。

---

## 17. Architect Decision Required（最終報告）

```
D-4 ARCHITECT DECISION PREPARATION

D-4 Architect Decision Gate
= COMPLETE
  （Section 18〜20: Decision Questions 1〜9・Final Decision Sheet・完了条件の整理が完了）

Architect Proposal Review
= COMPLETE

Architect Final Decision
= NOT FINALIZED
  （Section 19のFinal Decision Sheetが未記入のため。Claude Code側が推奨案を提示したことと、
    shojiさんがArchitect Decisionを承認したことは別であり、混同しない。Section 19の
    チェックボックスに人手で記入されるまでNOT FINALIZEDのまま。）

Collision Candidate / Rendering Contract
= DEFINED（技術的定義はSection 11で完了。採用可否はshoji最終承認待ち）

Translation Semantics
= DEFINED（固定タイミングSection 5.3で確定。UX意図確認はUNKNOWN、Section 6.4 D）

Rotation Semantics
= DEFINED（軸・座標系・合成式はSection 6.3で確定。実機確認はUNKNOWN、Section 6.4 A/B/C）

Depth Semantics
= DEFINED（Translation Decisionに従属する形で確定）

Shaft Roll Semantics
= DEFINED（現状維持で問題なし、Collision Candidate新設のみ別途必要）

Pointer Drag Semantics
= DEFINED（現状維持で問題なし）

Canonical Pose Generator
= RECOMMENDED（Section 11、YES。P0調査事項1〜7すべて回答済み）

D-2 Compatibility
= MIGRATION REQUIRED（Section 12、対象5+3症例を特定済み、未実施）

D-4 Freeze/Slerp Disposition
= NOT DECIDED（Section 14 Risks C、今回は削除しない）

Implementation
= NOT AUTHORIZED

Implementation Changes
= NONE

Commit
= NONE

Push
= NONE
```

---

## 18. Decision Gate — Decision Questions 1〜9

Section 5〜10で既に技術的検討を完了した各論点を、shojiさんが1問ずつYES/NO（またはPENDING/
MIGRATE等の選択肢）で判断できる形に整理する。各Questionの技術的根拠は既存Sectionへの参照
のみとし、本節では重複説明しない。

### Decision 1 — Translation Semantics
> プロステーシスをX/Y/Z方向へ平行移動した際、移動操作だけではQuaternionを変更しない。

根拠: Section 5（特に5.2の比較表、5.4のRECOMMENDATION）。
現在の問題（base変更→UMBO方向再計算→Quaternion変更→「移動しただけで回転する」UX）は
D4 Audit D節で数値確認済み（1mmあたり9〜20°）。
**Claude Code推奨: YES**（Position-only化）。
**未解決**: この変更が実際にユーザー体験として望ましいかは、Section 6.4 Dの通りUNKNOWN
（実機確認待ち）。

### Decision 2 — Base Alignment Timing
> Base AlignmentはTransport開始時ではなく、Transport→PlacementのCommit時点で固定する。

根拠: Section 5.3。`ManipulationLayer.tsx:80`「Phase1では向きの意味付けは対象外」という
既存コメントを一次証拠として、Transport段階はBase Alignment固定の対象に含めない
（Transport中は現行のまま自由に姿勢が変化してよい）ことも合わせて明記する。
**Claude Code推奨: YES**。

### Decision 3 — Rotation R4
> `angleTilt`/`angleTiltZ`をAnatomical Frame（coordGroupRef-local）のX軸/Z軸まわりの
> pre-multiplyとして再定義する（式はSection 6.3）。

根拠: Section 6（6.2比較表、6.3数式定義、6.5 RECOMMENDATION）。
以下5項目は実機確認が必須であり、確認できない限り**UNKNOWNのまま**とする（推測でPASSにしない、
Section 6.4参照）。
```
A. 前後傾斜（angleTilt）の見た目が期待通りか
B. 左右傾斜（angleTiltZ）の見た目が期待通りか
C. 正負方向がKeyboard/Rotate UIの操作方向と一致するか
D. Anatomical Frame（coordGroupRef-local）という軸定義自体がUXと一致するか
E. Translationとの独立性（動かしても回転しない）がユーザー意図と一致するか
   ※Decision 1と同一の確認事項
```
**Claude Code推奨: PENDING REAL-DEVICE CONFIRMATION**（数学的定義はCOMPLETE、採否はA〜Eの
実機確認後に確定すべき）。

### Decision 4 — Depth Semantics
> DepthをCamera-relativeなPosition-only Translationとして正式定義する。

根拠: Section 7。Decision 1（Translation Position-only化）に従属するDecisionであり、
Decision 1がYESであれば自動的に成立する。
**Claude Code推奨: YES**（Decision 1のYESを前提条件とする）。

### Decision 5 — Shaft Roll
> Shaft Rollは現在の軸定義（Prosthesis local +Y = shaft longitudinal axis）を維持する。

根拠: Section 8。D4 Audit F節で幾何学的・数値的に確認済み、変更を要する根拠がない。
**Claude Code推奨: YES**（現状維持）。

### Decision 6 — Pointer Drag
> Pointer DragはScreen-space movementとして維持する。

根拠: Section 9。Depthとの役割分担（Screen-plane vs Camera-depth）が既に自然に成立している。
**Claude Code推奨: YES**（現状維持）。

### Decision 7 — Canonical Pose Generator
> RenderingとCollision Candidateが同一のCanonical Pose Generatorを共有するArchitectureを
> 正式採用する（`resolveEffectivePose()`、Section 11.2）。

根拠: Section 10（10.1原則、10.2 Requirement対応表）、Section 11（P0調査事項1〜7の回答）。
D4-B Integrity Auditで確認された「Existing dragOffset omission」「Candidate / Rendering
divergence」「Nonlinear mismatch」「ControlPad Collision bypass」の4点はいずれもこの
Architecture採用で構造的に防止できる。
**Claude Code推奨: YES**。

### Decision 8 — D-2 Existing Angle Data Migration
> 既存症例の`idealAngle`/`startPlacement.angleTilt`（Section 12.2で特定した5+3症例）を
> どう扱うか。

根拠: Section 12（12.1保存形式の確認、12.2影響範囲、12.3 Migration Required判定、
**12.5 Migration Option A数値検証、新規**）。
選択肢:
```
Option A — 既存Angle値を新しいRotation semanticsへ数式的に変換（Migration）
           ※Section 12.5で数値検証済み: 既存D-2データ（idealAngle 12症例＋startPlacement
           3症例）は全数angleTiltZ=0であり、R1→R4変換は誤差ゼロ（機械精度の範囲内）で
           成立することを確認した（恒等写像、実装コストは極小）。
Option B — 既存症例を実機で目視確認しながら再キャプチャ（Save Start/Ideal Positionボタンを
           使った既存D-2ワークフローの再実行、Section 12.3で説明済み）
Option C — その他の方式
```
**Claude Code推奨: Option A**（Section 12.5の数値検証により、既存データに関する限りOption Aは
「安全と推測」ではなく「無誤差であることを実証済み」の状態になったため、v1.0時点でのOption B寄り
の推奨から更新する）。ただし、Option Aは現在のデータセットが偶然すべてangleTiltZ=0であることに
依存した結論であり、将来angleTiltZ≠0のデータを保存する場合には成立しない（Section 12.5
留意点）。Rotation R4自体の採否がDecision 3（PENDING）に依存するため、**Option Aの採用も
Decision 3が確定した後に初めて実行可能**になる。**最終的な方式決定はユーザーDecision前に
確定しない**（Task指示通り、本書はrecommendationの更新のみ）。

### Decision 9 — D-4 Freeze/Slerp
> Translation/Depth semantics変更後、D-4 Option①（Depth Quaternion Freeze）・Option②
> （Release Quaternion Slerp）を撤去する。

根拠: Section 14.2 Risks C。Decision 1（Translation Position-only化）採用時、Freeze/Slerpが
対処していたQuaternion変化自体が発生しなくなるため原理的に不要になる。**ただし既存承認済み
Commit済み機能（commit 871b1c5）であるため、明示的なArchitect Decisionなしに削除しない。**
**Claude Code暫定推奨: REMOVE方向**（Decision 1がYESの場合に限る）。**未解決**:
Section 6.4 Eの通りUNKNOWN（実機確認・明示的承認待ち）。

---

## 19. Final Decision Sheet — FINALIZED

**shojiさんの指示（本Task）により、以下の通り正式に確定した。** 確定日時はこのドキュメント
更新のタイミング（本Task実行時点）とする。Decision 3を除く8項目はAPPROVE、Decision 3のみ
「PENDING REAL-DEVICE CONFIRMATION」として明示的に受容した状態でFinalizeする（Section 13
参照、これはAPPROVEでもREJECTでもない）。

```text
D-4 FINAL ARCHITECT DECISION — FINALIZED

1. Translation Position-only
   [x] APPROVE
   [ ] REJECT

2. Base Alignment fixed at Placement Commit
   [x] APPROVE
   [ ] REJECT

3. Rotation R4
   [x] APPROVE（Section 20 Real-device Verification Gate通過、後述の更新記録参照）
   [ ] REJECT
   [ ] PENDING REAL-DEVICE CONFIRMATION（解消済み）

4. Depth Camera-relative Position-only
   [x] APPROVE
   [ ] REJECT

5. Shaft Roll current semantics
   [x] APPROVE
   [ ] REJECT

6. Pointer Drag Screen-space
   [x] APPROVE
   [ ] REJECT

7. Canonical Pose Generator shared
   [x] APPROVE
   [ ] REJECT

8. D-2 existing angle data
   [x] MIGRATE（Option A）
   [ ] RE-CAPTURE（Option B）
   [ ] OTHER（Option C、備考欄に方式を記載）

9. D-4 Freeze/Slerp
   [x] REMOVE
   [ ] RETAIN
```

**注記**: Decision 8「MIGRATE（Option A）」として承認されたのは**Migration Strategyのみ**
であり、実際のMigration実行（`cases.ts`の値更新）はここではまだ行っていない（Section 13
「Option Aの承認とMigrationの実行は分離」参照）。Decision 9「REMOVE」も同様に、**REMOVE方針の
承認**であり、`SimScene.tsx`のFreeze/Slerpコード自体はまだ削除していない（Section 15
Implementation禁止事項参照）。

**[後続Task、Decision 3 Real-device Confirmation]** Decision 3は本節（Section 19）確定時点では
「PENDING REAL-DEVICE CONFIRMATION」だったが、D-4 Implementation（Canonical Pose Generator・
Finding 1/2）完了後、shojiさんが通常表示可能な実機ブラウザ環境でSection 20 R4 Real-device
Verification Gateの確認項目（A1〜A4、下記参照）をすべて実施し、全項目「問題無し」と報告した
ため、`[x] APPROVE`へ更新した（詳細な確認結果・実施日時の記録はSection 20参照）。
`ANGLE_TILT_SIGN`/`ANGLE_TILT_Z_SIGN`の符号反転は不要と判明した（A1〜A3が問題無しのため）。

---

## 20. Architect Final Decision Gate 完了条件 — 充足確認

Final Decisionを「COMPLETE」として扱ってよい条件（再掲）と、Section 19確定後の充足状況。

```text
Translation semantics       = DECIDED   （Section 19-1 APPROVE）
Base Alignment timing       = DECIDED   （Section 19-2 APPROVE）
Rotation axis/sign          = explicitly accepted as pending （Section 19-3 PENDING REAL-DEVICE CONFIRMATION、shoji明示受容）
Depth semantics              = DECIDED   （Section 19-4 APPROVE）
Shaft Roll                   = DECIDED   （Section 19-5 APPROVE）
Pointer Drag                 = DECIDED   （Section 19-6 APPROVE）
Canonical Pose Contract      = DECIDED   （Section 19-7 APPROVE）
D-2 Migration                = DECIDED   （Section 19-8 APPROVE — Option A、Strategyのみ。実行は別工程）
D-4 Freeze/Slerp             = DECIDED   （Section 19-9 APPROVE — REMOVE方針。削除実行は別工程）
```

**全9項目が「DECIDED」または「explicitly accepted as pending」のいずれかを満たしたため、
`Architect Final Decision = FINALIZED` とする（本Task、shojiさんの明示的指示による）。**

Rotation axis/sign（Decision 3）は「APPROVE」でも「REJECT」でもなく、以下の3層で正確に
記録する（Task指示§13の要求通り）。

```text
Mathematical Definition   = CONFIRMED（Section 6.3、Q = Rx(angleTilt)*Rz(angleTiltZ)*
                             BaseAlignment*Roll(shaftRoll)、X軸=前後傾斜/Z軸=左右傾斜/
                             Frame=coordGroupRef-local/Anatomical Frame、という設計定義は
                             Architect Decisionとして維持する）
Runtime / Visual Verification = UNKNOWN（axis mapping・sign・visual directionは実機未確認。
                             Browser paneで3回試行、いずれもdocument.hidden=true/
                             visibilityState=hiddenによりruntime検証が成立せず。推測で
                             PASSに変更していない）
Architect Acceptance      = ACCEPTED AS PENDING（shojiさんが実機確認未完了を承知の上で
                             明示的に受け入れ、Final Decision全体をFINALIZEDとして進めることを
                             承認した状態。R4=PASSでもR4=REJECTでもない）
```

**重要**: Decision 3の実機確認未完了そのものは、Architect Final Decisionを妨げるblockerでは
ない。上記の通り「explicitly accepted as pending」という第三の状態が本Decision Gateの設計に
最初から組み込まれており（本節冒頭の完了条件参照）、今回shojiさんがこれを正式に選択した
ことで、Decision 3以外の8項目の確定を妨げることなくArchitect Final Decision全体をFINALIZEDと
できる。

### 20.1 Real-device Confirmation Update（後続Task、D-4 Implementation完了後）

D-4 Implementation（Canonical Pose Generator、Finding 1/2）完了後、shojiさんが通常表示可能な
実機ブラウザ環境で、以下のGate確認項目（本節冒頭の定義、A1〜A4）を実施し、結果を報告した。

```text
A1  angleTilt方向（前後傾斜）                = 問題無し
A2  angleTiltZ方向（左右傾斜）               = 問題無し
A3  正負方向とKeyboard/Rotate UI操作方向の一致 = 問題無し
A4  BELL/TORP/PISTON各製品・各症例での解剖学的妥当性 = 問題無し
```

加えて、D-4 Post-Implementation Review（Finding 1/2）で静的検証のみに留まっていた項目についても
同一の実機確認機会に合わせて確認し、すべて「問題無し」の報告を得た（B1〜B5、Implementation
Specification側の記録として扱う。詳細はImplementation Specification Section 17.6/24参照）。

**Decision 3の3層記録の更新**:
```text
Mathematical Definition       = CONFIRMED（変更なし、Section 6.3のまま）
Runtime / Visual Verification = CONFIRMED（更新——A1〜A4すべて問題無し、shoji実機確認済み）
Architect Acceptance          = APPROVE（更新——ACCEPTED AS PENDINGから昇格。
                                 Section 19-3チェックボックスも[x] APPROVEへ更新済み）
```

**符号定数への影響**: A1〜A3が「問題無し」（＝現状のUI操作方向とQuaternion変化方向が既に
一致している）と報告されたため、`ANGLE_TILT_SIGN`/`ANGLE_TILT_Z_SIGN`（`transformControlsConfig.ts`、
現在いずれも`1`）の反転は不要と判明した。コード変更は発生しない。

**Decision 3 = APPROVE（Mathematical Definition・Runtime/Visual Verificationとも確定）。**
本更新はArchitect Decision文書の更新のみで行い、コード変更・Commit・Pushは伴わない。

---

## 21. Final Decision Preparation Report（本Task、Decision Gate継続タスク）

本Taskで実施した作業の要約と、Task指定の最終報告フォーマットへの回答。

```
D-4 Final Decision Preparation = COMPLETE

Decision 3 — Rotation R4
= UNKNOWN / PENDING
  数学的定義（Section 6.3）はCOMPLETEのまま変更なし。実機確認（Test R4-1〜R4-5、
  Section 6.4.1）は3回目の試行でも同一のBrowser pane環境制約（document.hidden=true）に
  より実施不可（NOT REPRODUCIBLE）。推測でPASSに変更していない。

Decision 8 — D-2 Migration
= OPTION A（推奨を更新、Section 12.5・18参照）
  数値検証（Section 12.5）により、既存D-2データ（idealAngle 12症例＋startPlacement3症例、
  全数angleTiltZ=0）に対するR1→R4変換が誤差ゼロで成立することを実証した。v1.0時点の
  「Option B寄り」推奨から、実証データに基づき「Option A」へ更新した。ただし採用実行は
  Decision 3確定後。

Decision 9 — Freeze/Slerp
= REMOVE RECOMMENDED
  Section 14.2 Risks C・Section 9（本書内Decision 9）の理由を維持（Translation
  Position-only化が採用されればFreeze/Slerpの対象自体が消滅するため）。ただし既存承認済み
  Commit済み機能のため、今回も削除は実施していない（明示的Architect Decision待ち）。

Architect Final Decision
= NOT FINALIZED
```

**本Taskで新たにClaude Code側がチェックを入れた項目はない**（Section 19 Final Decision
Sheetは引き続き全項目未記入）。Decision 8の推奨を「Option B寄り」から「Option A」へ更新した
のは、Section 12.5の数値検証という新しい客観的Evidenceに基づくrecommendationの更新であり、
Architect（shoji）による承認確定ではない。

**[以降、次Task（本Task）で更新]** 上記21節はDecision Gate監査完了時点（Final Decision確定前）
の状態のスナップショットとして保持する。実際のFinal Decision確定はSection 19・20・22を参照。

---

## 22. Final Decision Record（本Task — Architect Final Decision確定）

### 22.1 確定内容

shojiさんの明示的指示（本Task）により、Section 19のFinal Decision Sheetを以下の通り確定した。

```text
D-4 ARCHITECT FINAL DECISION = FINALIZED

Decision 1 — Translation                = APPROVE（Position-only）
Decision 2 — Base Alignment Timing      = APPROVE（Placement Commit時固定）
Decision 3 — Rotation R4                = PENDING REAL-DEVICE CONFIRMATION
Decision 4 — Depth                      = APPROVE（Camera-relative Position-only）
Decision 5 — Shaft Roll                 = APPROVE（現状維持）
Decision 6 — Pointer Drag               = APPROVE（Screen-space）
Decision 7 — Canonical Pose Generator   = APPROVE（Single Source of Truth）
Decision 8 — D-2 Migration              = APPROVE（Migration Strategy = Option A、実行は別工程）
Decision 9 — D-4 Freeze/Slerp           = APPROVE（REMOVE方針、削除実行は別工程）
```

各Decisionの確定理由は、本文書の該当Section（Decision 1〜9それぞれSection 5〜10、18）に
既に記載済みの内容をそのまま正式なArchitect Decisionの根拠として採用する（Task指示§4〜12の
通り、追加の理由変更は行っていない）。

### 22.2 Decision 3の扱い（Task指示§13・§6への回答）

Decision 3は**APPROVEでもREJECTでもない**。正確には以下の3層で記録する。

```text
Mathematical Definition       = CONFIRMED
Runtime / Visual Verification = UNKNOWN
Architect Acceptance          = ACCEPTED AS PENDING
```

数学的定義（`Q = Rx(angleTilt)*Rz(angleTiltZ)*BaseAlignment*Roll(shaftRoll)`、X軸=前後傾斜、
Z軸=左右傾斜、Frame=coordGroupRef-local/Anatomical Frame）はArchitect Decisionとして維持する
（Section 6.3、Section 20参照）。一方、axis mapping・sign・visual directionの実機確認は
未完了（Browser paneで3回試行、いずれも`document.hidden=true`/`visibilityState=hidden`により
runtime検証が成立せず、D4-B Runtime Safety Verification・D4-B Final Runtime Verification・
本書Section 6.4.1参照）。この未完了自体は、Architect Final Decision全体のFINALIZED判定を
妨げるblockerとしては扱わない（Section 20参照）。

### 22.3 Final Remaining Uncertainty / Blocking Items

Architect Final DecisionはFINALIZEDだが、以下は実装工程（Implementation Specification以降）で
解決すべき残存事項として明示する。

```text
1. Rotation R4 real-device axis/sign/visual verification pending
   — Decision 3自体の内容（どの軸が前後傾斜/左右傾斜か、符号がUI操作と一致するか）は
     shojiさんの手元の通常表示可能なブラウザ環境で確認が必要（Section 6.4 A/B/C）。
     確認後、必要であれば「実機確認時に反転可能な最小定数」パターン（Section 6.4末尾）で
     軸マッピング・符号のみを修正する。数学的骨格（pre-multiply、coordGroupRef-local Frame）
     自体の変更は想定しない。

2. D-2 Migration execution is implementation-stage work
   — Decision 8で承認されたのはMigration Strategy（Option A、数値変換）のみ。実際の
     `cases.ts`データ更新（idealAngle 5症例＋startPlacement 3症例）はImplementation
     Specification策定後に実施する（Section 13、Section 15 Implementation禁止事項）。

3. Freeze/Slerp removal is implementation-stage work
   — Decision 9で承認されたのはREMOVE方針のみ。既存承認済みCommit済みコード
     （D-4 Option①/②、commit 871b1c5）の実削除はImplementation工程で行う
     （Section 15 Implementation禁止事項）。
```

**[後続Task、Decision 3 Real-device Confirmation Update]** 上記項目1（Rotation R4
real-device axis/sign/visual verification pending）は、D-4 Implementation（Finding 1/2）完了後の
shoji実機確認（Section 20.1参照、A1〜A4すべて問題無し）により**RESOLVED**となった。
Decision 3は`APPROVE`へ更新済み（Section 19-3、Section 20.1）。項目2（D-2 Migration実行）・
項目3（Freeze/Slerp削除）はDecision 3のAPPROVE確定を前提条件としていたため（Section 15.4、
Section 14.2 Risks C）、これらが着手可能な状態になったが、**実行自体は本Taskでは行っていない**
（別途の明示的な指示・Taskを要する）。

**Decision 3の実機確認未完了そのものは、Architect Final Decisionを妨げるblockerではない**
（Task指示§14・Section 20参照、"explicitly accepted as pending"扱いにより確定済み）。上記3項目は
いずれも「Final Decisionは確定しているが、実行にあたり別途対応が必要な残作業」という位置づけ
であり、Architect Decision自体の再検討を要するものではない。

### 22.4 次工程

```text
Architect Final Decision  → FINALIZED（本Task、確定済み）
Implementation Specification → NOT YET STARTED（次Task以降）
Implementation             → NOT AUTHORIZED
Commit                      → NONE
Push                        → NONE
```

実装（Canonical Pose Generator実装、Translation/Rotation/Depth semantics変更、D-2 Migration
実行、Freeze/Slerp削除）は、本Taskでは一切行っていない。次のTaskとしてImplementation
Specification（実装仕様書）の策定を行うかどうかは、shojiさんの判断に委ねる。

---

## 23. Decision 10 — Case/Product Change During Committed Placement（Post-Implementation Addendum）

**Status: APPROVED — shojiさんにより正式承認済み（Section 23.7参照）。** Decision 1〜9とは
別の手続き（Section 19のFinal Decision Sheetとは別のAddendumとしての承認）を経て確定した。
本Section 23全体は、Decision 10の導出過程（23.1〜23.6、Claude Code推奨案としての検討記録）と
その確定結果（23.7）から成る。23.1〜23.6の記述は検討過程の記録として原文のまま保持する。

### 23.1 背景

D-4 Implementation完了後のPost-Implementation Review（Finding 1、Architect Decision Review）で、
以下の潜在的な設計ギャップが発見された。

```
Base Alignment Specification（Implementation Specification Section 3.3）は、
Case/Product変更時にbaseAlignmentQuaternionを明示的にnullへリセットするMUSTを持つ。
しかし、もし manipulation.committed === true を維持したままこのリセットが発生した場合
（＝Placement確定状態のままCase/Productだけが変わるシナリオ）、
再計算のトリガーはmanipulation.committedのfalse→true遷移のみであるため、
baseAlignmentQuaternionはnullのまま固定される。
Collision Candidate評価（evaluateDragCandidate等）はnullを「制約なし」として扱う設計のため、
このシナリオが発生するとCollision Constraintが無期限に無効化される（fail-open）。
```

現行UI（`SimulationMode.tsx`の`PlacementStep`、`StepFlowMode.tsx`）のいずれからもこのシナリオへ
到達できないことは2回の独立調査で確認済みである。しかし、これが「現行UI構造への依存」による
偶然の安全性なのか、それとも「そもそもこの操作フロー自体が許容されない」というArchitecture上の
原則なのかが、既存のArchitect Decision（Section 3, 5.3, 6.3, 10.4, 11.2, 11.3等）には明文化されて
いなかった。本Decision 10はこの空白を埋めるためのAddendumである。

### 23.2 既存Sectionとの照合

- **Section 3.C（Transport Pipeline）**: 「Collision Constraint自体が存在しない」段階として
  Transportを定義し、Release時に`commitTransportPoseToOffsets()`という**一方向の変換**でPlacement
  段階へ移行する。Transportへ「戻る」という経路はこのPipeline図には一切描かれていない。
- **Section 5.3（Base Alignment固定の具体的定義）**: Base Alignmentを「④ Placement確定時
  （Commit、manipulation.committedがfalse→trueに変わる瞬間）」に紐づけて定義し、①〜③（初期
  Position、Save Start Position、Transport開始時点）を明示的に不採用としている。この理由づけ
  （「Commit時点の姿勢（=Transportで運んできた、その時点でユーザーが妥当と判断した向き）」）は、
  Base Alignmentが**単なる計算可能な値ではなく、実際に行われたTransport操作という行為の結果**
  であることを前提にしている。
- **Section 10.4（Requirement 4の重要度）・11.2/11.3（State ownership）**: Canonical Pose
  GeneratorとState責務分離の設計はいずれも「Committed StateとCandidate Stateの区別」を前提とし
  ており、「Committed State自体が同一Placementセッション内で不整合な形に変化する」ケース
  （＝Case/Productだけが変わり、Base Alignmentだけが古いまま/nullのまま残る）は検討されていない。

**結論**: 既存Architect Decisionのいずれの箇所も、「Placement確定後にCase/Productを変更できる」
という操作フロー自体を積極的に許可・想定していない。むしろSection 3.C・5.3の設計は、
「Transport→Commitは1セッションにつき1回の一方向の流れ」であることを暗黙の前提としている。

### 23.3 Evidence — 既存UIの実際の挙動（新規UXの発明ではなく、既存の確認）

`SimulationMode.tsx`のPlacement Stepには、既に「← 戻る」ボタン（product-selectへ戻る）が存在する
（D-4着手前から存在する機能、本Task範囲外の変更なし）。このボタンを押すと：

```
Placement Step（PlacementStep component）
  → 「← 戻る」→ product-select step
  → PlacementStepコンポーネント自体がアンマウントされる
    （manipulationCommitted、baseAlignmentQuaternion等、全local stateが破棄される）
  → 別のProductを選択
  → shaft-estimate → placement Stepへ再度遷移
  → PlacementStepが新規マウント（manipulationCommitted=falseから再開）
  → 新しいTransport → 新しいPlacement Commit → 新しいBase Alignment Snapshot
```

つまり、**「Placement確定状態を保ったままCase/Productだけを差し替える」という機能は、現行UIに
そもそも存在しない。** 既存の「Case/Productを変えたい場合はPlacement Stepを離れて選び直す」
という設計は、Base Alignmentの観点からは「新しいTransport→Commitを強制する」という意味を
既に**結果的に**満たしている（この一方向unmountパターンはD-4着手前の別Phaseで確立されたもので
あり、D-4のために新設したものではない）。

### 23.4 Option評価

```
Option A — Placement確定後のCase/Product変更を（in-placeでは）許可しない
  = 既存UI（23.3節）が既に一貫してこの前提で動作している。
  = Base Alignment semantics（Section 5.3、Transport→Commitの一方向性）と完全に整合する。
  = 新しいUX機能の追加を要しない（既存の「戻る」ボタンで代替済み）。

Option B — 許可する場合、committed=falseへ戻しTransport→Commitを再実行する
  = Option Aの下で「Placement Stepを離れて戻る」という既存フローが、実質的にこれを実装している。
  = ただし「Placement画面内に留まったまま製品だけをその場で切り替える」という**新しいUI機能**
    として実装する場合は、manipulation.committedのownership（SimulationMode.tsx/StepFlowMode.tsx側）
    への変更が必要になり、これは新しいUX要件（「その場で製品比較をしたい」等の臨床教育上の
    ニーズ）に基づく将来の機能追加として扱うべきであり、本Addendumの範囲では要求しない。
```

Option Bを「その場で切り替える新機能」として今すぐ実装する动機・要求はD-4のいかなる文書
（Architect Decision、Implementation Specification、Post-Implementation Review）にも存在しない。
したがって、**新しいUX要件を発明することなく、既存の23.3節のEvidenceのみからOption Aを導出
できる**と判断する。

### 23.5 Decision 10（Claude Code推奨案 — Section 23.7でshojiさんにより正式承認済み）

```text
Decision 10 — Case/Product Change During Committed Placement

> Placement確定後（manipulation.committed === true）は、Case/Productのin-place変更を
> 許可しない。Case/Productを変更する唯一の経路は、既存UIが既に提供している「Placement Step
> を離れる」操作（→ manipulation.committedがfalseへ戻る、Base Alignmentが破棄される）
> であり、以降は新しいTransport→Commitを経て新しいBase Alignmentを確定させる。

根拠: Section 23.2（既存Section整合性）、Section 23.3（既存UI Evidence）。

[x] APPROVE（Claude Code推奨、Section 23.7でshojiさんにより正式承認済み）
[ ] REJECT
[ ] PENDING SHOJI CONFIRMATION
```

**この決定が意味すること（Base Alignment Semanticsの明文化、Task指示への回答）**:

```
Base Alignmentは単なるQuaternion値ではない。
「ユーザーがTransport操作を行い、Placement Commitという明示的な行為を行った時点の
配置姿勢を基準として固定されたもの」である（Section 5.3の定義そのもの）。

したがって：
MUST NOT: Case/Product変更後に、Transportを経由せずに新しいBase Alignmentを生成すること
  （＝Post-Implementation Review Finding 1のOption Bを正式に不採用とする）。
MUST NOT: baseAlignmentQuaternion = null を、Placement中（manipulation.committed===true）の
  通常状態として扱うこと。Decision 10により、この状態はUI構造上到達しないことが
  Architecture上の前提として確定した——したがって、もしこの状態が観測された場合は、
  「安全に処理すべき通常のedge case」ではなく「invariant違反（本来発生してはならない
  bug状態）」として扱われるべきである。
MUST（次のImplementation Taskへの申し送り、Implementation Specification側で規定）:
  invariant違反状態（committed===trueかつbaseAlignmentQuaternion===null）を検知した場合、
  Collision Candidate評価はfail-closed（制約を維持する＝候補を常に拒否する）とし、
  現行実装のfail-open（無条件に制約なしとしてtrueを返す）から変更する。
  Base Alignmentの「安全側フォールバック」（Section 3.3のnullリセットMUST）自体は維持する
  （Decision 10はこのMUSTを撤回しない、撤回する理由がないため）——変更が必要なのは
  null発生後のCandidate評価側の扱いのみである。
```

### 23.6 本Addendumのスコープ

本Decision 10は、Decision 1〜9（Section 19、FINALIZED）を一切変更・撤回しない。Decision 1〜9は
そのままFINALIZEDの状態を維持する。Decision 10は独立した新規Addendumであり、Section 19の
Final Decision Sheetにも追加しない（Decision 1〜9はshojiさんが直接チェックボックスへ記入した
確定事項という性質を持つため、混同を避ける）。Decision 10の正式なshoji確認は、別途Section 19と
同様の手続き（明示的な承認）を経ることを推奨する。

### 23.7 Formal Confirmation（shojiさんによる正式承認）

```text
D-4 DECISION 10 — FINAL CONFIRMATION

Decision 10 — Case/Product Change During Committed Placement
= APPROVE（Option A）

「Decision 10（Option A）を正式承認します。」（shojiさん、本Task）

Approved Content:
  Placement確定後（manipulation.committed === true）は、Case/Productのin-place変更を
  許可しない。既存UIの「Placement Stepを離れる」操作のみを唯一の変更経路とし、これにより
  manipulation.committedがfalseへ戻り、baseAlignmentQuaternionが破棄され、以降は新しい
  Transport→Commitを経て新しいBase Alignmentを確定させる（Section 23.5参照）。
```

**確定事項**:
```
Decision 10 = APPROVED（Option A、shoji正式承認済み）
Decision 1〜9 = FINALIZEDのまま変更なし
Section 19（Final Decision Sheet）= 変更なし（Decision 10はこのSheetの対象外のまま、
  Section 23が独立した承認記録として機能する）
```

**この承認が確定させるBase Alignment Semantics（再掲、Architecture上の正式な前提）**:
```
1. Base Alignmentは「Transport→Placement Commitというユーザー操作の結果として固定された
   姿勢」であり、単なる計算可能なQuaternion値ではない（Section 5.3の定義の再確認）。
2. Placement確定後のCase/Product変更は、既存UIの「Placement Stepを離れる」経路以外には
   存在しない（Decision 10により、これが今後もArchitecture上の前提として維持される
   ——将来のいかなる実装も、manipulation.committed===trueを保ったままCase/Productの
   identityを変更するショートカットを導入してはならない、MUST NOT）。
3. 上記1・2の帰結として、baseAlignmentQuaternion===null かつ manipulation.committed===true
   という状態は、Placement中に正当に発生しうる状態ではなく、invariant違反として扱う
   （Implementation Specification Section 3.3・24、fail-closed MUST）。
```

**次工程（本承認を受けて、次のImplementation Taskの対象として確定）**:
```
1. evaluateDragCandidate() / evaluateRotationCandidate() / evaluateShaftRollCandidate()
   （またはその実装上の後継）のnull分岐を fail-open → fail-closed へ変更する
   （Implementation Specification Section 3.3・24 項目4）。
2. ControlPad Availability Gate実装（Finding 2、Implementation Specification Section 11.3、
   Section 24 項目5）。
3. StepFlowMode.tsxは変更しない（Finding 3、D-4 Scope外、Section 18.1）。
4. 上記1・2の実装後、TypeCheck / Build / Lint / Targeted Numeric Verification /
   （可能な範囲での）Runtime Verificationを実施する。
5. Decision 3（Rotation R4実機確認）・D-2 Migration・Freeze/Slerp削除は、本承認・本Addendum
   により何ら変更されない（Decision 3=PENDING REAL-DEVICE CONFIRMATION、Migration=
   NOT STARTED、Freeze/Slerp=RETAINEDのまま）。
6. Commit/Pushは、次のImplementation Task完了後も、明示的な別指示があるまで実施しない。
```

**Implementation Specification側の対応**（本Addendムに基づき、Implementation Specification
Section 3.3・11に追記済み——詳細は該当文書参照）:
```
1. Section 3.3: null発生後の下流挙動（fail-closed）を明記。
2. Section 11: Finding 2（ControlPad Collision Candidate Gap）Option Bを明記。
```
いずれもコード変更は伴わない（次のImplementation Taskの対象）。

---

## Git Integrity

```bash
$ git status --short   （開始時・終了時とも同一、tracked filesの変更なし）
?? .claude/
?? .mcp.json
?? .serena/
?? _softclip_split_backup/
?? docs/D1_Case_Prosthesis_Initial_State_Decision_v1.0.md
?? docs/D1_Case_Prosthesis_Initial_State_Selection_Flow_Investigation_v1.0.md
?? docs/D4B_Collision_Candidate_Final_Runtime_Verification_v1.0.md
?? docs/D4B_Collision_Candidate_Integrity_Audit_v1.0.md
?? docs/D4B_Collision_Candidate_Runtime_Safety_Verification_v1.0.md
?? docs/D4_Architect_Manipulation_Axis_Pose_Semantics_Decision_v1.0.md
?? docs/D4_Manipulation_Axis_Coordinate_System_Audit_v1.0.md
?? eac_topology_check.py
?? serena-mcp.ps1

$ git diff --stat          （出力なし）
$ git diff --cached --stat （出力なし）
$ git diff --check         （出力なし）

$ git rev-parse HEAD
871b1c5926dd73d6bf5f823dfe6785f2aabc900a
```

```
HEAD = unchanged（871b1c5926dd73d6bf5f823dfe6785f2aabc900a）
Tracked diff = none
Staged diff = none
Commit = none
Push = none
```

既存4件のInvestigation/Verificationレポート（D4 Audit、D4-B Integrity/Runtime/Final Runtime
Verification）は一切変更していない。本Taskはコード変更・Commit・Pushを一切行っていない
（Architect Decision documentationの更新のみ）。**[本Task、Final Decision確定]**
shojiさんの明示的指示によりSection 19のFinal Decision Sheetを確定した（Decision 1・2・4〜7・
8・9=APPROVE、Decision 3=PENDING REAL-DEVICE CONFIRMATION）。Section 20の完了条件
（9項目すべてDECIDED、Decision 3のみ"explicitly accepted as pending"の扱いを許容）を満たした
ため、`Architect Final Decision = FINALIZED` である（Section 22参照）。ただし
`Implementation = NOT AUTHORIZED`のまま——Final Decisionの確定とImplementationの着手は
明確に分離されている。以下は旧記述（Decision Gate監査時点のもの）だが、参考として残す:
「Claude Code側が各Decision Questionに推奨案（YES寄り、Rotation R4のみPENDING）を提示したこと」
と「shojiさんがArchitect Decisionを
承認したこと」は明確に別であり、本書はこれらを混同していない。

**[本Task、D-4 Architect Decision Formalization / Specification Update]** D-4 Implementation
完了後のPost-Implementation Review（Finding 1〜4）を受け、Section 23「Decision 10 — Case/Product
Change During Committed Placement」をAddendumとして追加した。Decision 1〜9（Section 19、
FINALIZED）は一切変更・撤回していない。Decision 10はClaude Code推奨案（DRAFT）として作成し、
Section 19のFinal Decision Sheetには追加していない（独立したAddendumとして扱う）。
本Taskはコード変更・Commit・Pushを一切行っていない（本Architect Decision文書とImplementation
Specification文書の更新のみ）。

**[後続Task、Decision 10 Formal Confirmation]** shojiさんより「Decision 10（Option A）を正式承認
します」との明示的指示を受け、Section 23.7「Formal Confirmation」を追加し、Decision 10を
`APPROVED`として確定した。トップStatus行・Section 23冒頭のStatus行も合わせて更新した。
Decision 1〜9・Section 19は本承認記録によっても一切変更していない。本Task（承認記録）でも
コード変更・Commit・Pushは一切行っていない。次工程（Finding 1のfail-closed実装・Finding 2の
ControlPad Availability Gate実装）は別途のImplementation Taskとして残る
（Section 23.7「次工程」参照）。

```bash
$ git status --short   （本Task開始時・終了時とも同一。tracked code diff = D-4 Implementation
                          由来の4ファイルのみ、本Taskによる追加変更なし）
 M src/components/SimulationMode.tsx
 M src/components/ui/ControlPad.tsx
 M src/scenes/SimScene.tsx
 M src/scenes/transformControlsConfig.ts
?? .claude/
?? .mcp.json
?? .serena/
?? _softclip_split_backup/
?? docs/D1_Case_Prosthesis_Initial_State_Decision_v1.0.md
?? docs/D1_Case_Prosthesis_Initial_State_Selection_Flow_Investigation_v1.0.md
?? docs/D4B_Collision_Candidate_Final_Runtime_Verification_v1.0.md
?? docs/D4B_Collision_Candidate_Integrity_Audit_v1.0.md
?? docs/D4B_Collision_Candidate_Runtime_Safety_Verification_v1.0.md
?? docs/D4_Manipulation_Axis_Coordinate_System_Audit_v1.0.md
?? eac_topology_check.py
?? serena-mcp.ps1
?? src/scenes/canonicalPose.ts
（docs/D4_Architect_...md・docs/D4_Implementation_Specification...mdはこの一覧では既存untracked
  のまま——本Task時点で新規trackingへは移していない。内容の変更自体はgit diffでは表現されない
  untracked fileのため、"?? " のまま。）

$ git diff --check         （出力なし）
$ git rev-parse HEAD
871b1c5926dd73d6bf5f823dfe6785f2aabc900a
```

```
HEAD = unchanged（871b1c5926dd73d6bf5f823dfe6785f2aabc900a）
Tracked code diff = 4ファイル（D-4 Implementation由来、本Taskによる追加なし）
Staged diff = none
Commit = none
Push = none
```

**[後続Task、Decision 3 Real-device Confirmation]** D-4 Finding 1/2のImplementation・
Post-Implementation Reviewが完了した後、shojiさんが通常表示可能な実機ブラウザ環境で
Section 20 R4 Real-device Verification Gate（A1〜A4）およびFinding 1/2関連の追加確認
（B1〜B5、Implementation Specification側で記録）を実施し、すべて「問題無し」と報告した。
これを受け、Section 19-3のチェックボックスを`[x] APPROVE`へ更新し、Section 20.1・
Section 22.3にReal-device Confirmation Updateの記録を追加した。トップStatus行も
Decision 3=APPROVEへ更新した。Decision 1〜9・Decision 10・C-2 collision engine・R4
Quaternion合成順序・`ANGLE_TILT_SIGN`/`ANGLE_TILT_Z_SIGN`の値（実機確認によりいずれも
反転不要と判明、`1`のまま）は本Taskで一切変更していない。本Task（確認結果の記録）でも
コード変更・Commit・Pushは一切行っていない。

```bash
$ git status --short   （本Task開始時・終了時とも同一）
 M src/components/SimulationMode.tsx
 M src/components/ui/ControlPad.tsx
 M src/scenes/SimScene.tsx
 M src/scenes/transformControlsConfig.ts
?? .claude/
?? .mcp.json
?? .serena/
?? _softclip_split_backup/
?? docs/D1_Case_Prosthesis_Initial_State_Decision_v1.0.md
?? docs/D1_Case_Prosthesis_Initial_State_Selection_Flow_Investigation_v1.0.md
?? docs/D4B_Collision_Candidate_Final_Runtime_Verification_v1.0.md
?? docs/D4B_Collision_Candidate_Integrity_Audit_v1.0.md
?? docs/D4B_Collision_Candidate_Runtime_Safety_Verification_v1.0.md
?? docs/D4_Manipulation_Axis_Coordinate_System_Audit_v1.0.md
?? eac_topology_check.py
?? serena-mcp.ps1
?? src/scenes/canonicalPose.ts

$ git diff --stat
 src/components/SimulationMode.tsx     |  12 +-
 src/components/ui/ControlPad.tsx      |  59 ++++-
 src/scenes/SimScene.tsx               | 424 ++++++++++++++++++++++++----------
 src/scenes/transformControlsConfig.ts |  12 +
 4 files changed, 387 insertions(+), 120 deletions(-)
（D-4 Implementation〔Finding 1/2実装済み〕由来、本Taskによる追加変更なし）

$ git diff --check         （出力なし）
$ git rev-parse HEAD
871b1c5926dd73d6bf5f823dfe6785f2aabc900a
```

```
HEAD = unchanged（871b1c5926dd73d6bf5f823dfe6785f2aabc900a）
Tracked code diff = 4ファイル、387 insertions/120 deletions（本Taskによる追加なし）
Staged diff = none
Commit = none
Push = none
```

**次工程**: Decision 3のAPPROVE確定により、D-2 Migration実行・Freeze/Slerp削除は着手可能な
状態になったが、いずれも本Taskでは実行していない。実行には別途の明示的な指示・
Implementation Taskを要する（Section 15.4、Section 14.2 Risks C、Section 22.3参照）。
