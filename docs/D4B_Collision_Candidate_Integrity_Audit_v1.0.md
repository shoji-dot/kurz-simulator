# D-4-B Collision Candidate Integrity Audit

Status: Investigation Only — 実装なし・Commitなし・Pushなし

## Repository Integrity

```
HEAD:                   871b1c5926dd73d6bf5f823dfe6785f2aabc900a
Working Tree:           CLEAN（tracked filesの差分なし。git diff --check 出力なし）
Implementation Changes: NONE
Commit:                 NONE
Push:                   NONE
```
既存の未追跡ドキュメント（`docs/D1_*.md`×2、`docs/D4_Manipulation_Axis_Coordinate_System_Audit_v1.0.md`
他）は削除・変更していない。検証ログは末尾参照。

---

## A. composeDragCandidatePose() Ground Truth

```js
// SimScene.tsx:1439-1464（原文ママ）
function composeDragCandidatePose(params: {
  product, shaftLength, basePos,
  lateralOffset, anteriorOffset, verticalOffset,   // ← 生のprops（PlacementStateのスライダー値）
  angleTilt, angleTiltZ, shaftRollDeg,
  dragLocalDelta: THREE.Vector3,                    // ← 今回のドラッグ/Depthの新規delta
}): { position; quaternion } {
  const committed = computeProsthesisModelPose({
    product, shaftLength, basePos,
    lateralOffset, anteriorOffset, verticalOffset,   // ← dragOffsetX/Y/Zを一切加算していない
    angleTilt, angleTiltZ,
  });
  const position = committed.position.clone().add(params.dragLocalDelta);  // ベクトル加算のみ
  const quaternion = shaftRollDeg
    ? committed.quaternion.clone().multiply(RollQuat(shaftRollDeg))
    : committed.quaternion;                          // ← dragLocalDeltaはQuaternionに一切影響しない
  return { position, quaternion };
}
```
**確定事実**: `composeDragCandidatePose()`の引数リストに`dragOffsetX`/`dragOffsetY`/`dragOffsetZ`は
一切存在しない（型定義・呼び出し元いずれにも現れない）。呼び出し元は2箇所、いずれも同じ形で
呼んでいる:
- `evaluateDragCandidate()`（Pointer Drag用、SimScene.tsx:826-830）: `lateralOffset, anteriorOffset,
  verticalOffset`は`DraggableProsthesis`の生propsをそのまま渡す（`+dragOffsetX`等の加算なし）。
- Depth handler（PageUp/PageDown、SimScene.tsx:1101、内部で`evaluateDragCandidate(depthDelta)`を
  呼ぶ）: 同一関数を経由するため同じ式。

**結論（Primary Question回答）**: **NO — composeDragCandidatePose()は既にCommitted済みの
dragOffsetX/Y/Zを一切含んでいない。** これは推測ではなく、関数のパラメータリストと呼び出し引数を
直接読んだ確定事実である。

---

## B. composeRotationCandidatePose() Ground Truth

```js
// SimScene.tsx:1478-1506（原文ママ）
function composeRotationCandidatePose(params: {
  product, shaftLength, basePos,
  lateralOffset, anteriorOffset, verticalOffset,
  dragOffsetX, dragOffsetY, dragOffsetZ,             // ← 明示的にパラメータとして存在する
  shaftRollDeg,
  candidateAngleTilt, candidateAngleTiltZ,
}): { position; quaternion } {
  const pose = computeProsthesisModelPose({
    product, shaftLength, basePos,
    lateralOffset:  params.lateralOffset  + params.dragOffsetX,   // ← 明示的に加算
    verticalOffset: params.verticalOffset + params.dragOffsetY,
    anteriorOffset: params.anteriorOffset + params.dragOffsetZ,
    angleTilt: params.candidateAngleTilt, angleTiltZ: params.candidateAngleTiltZ,
  });
  ...
}
```
呼び出し元（`evaluateRotationCandidate()`、SimScene.tsx:886-893）は`dragOffsetX, dragOffsetY,
dragOffsetZ`を明示的に渡している。

**結論**: `composeRotationCandidatePose()`は既存の`dragOffsetX/Y/Z`をCandidate計算に正しく
反映している。`composeDragCandidatePose()`との設計差は明確（A/B節の比較）。

---

## C/D/E. X / Y / Z Translation

### 前提となる重要な訂正（Scope訂正）
Task冒頭の想定は「X/Y/Z Translation」全般が`composeDragCandidatePose()`を経由するというものだが、
**コード上、実際には2つの異なる実装が存在し、片方はCollision判定を一切行わない**:

| 経路 | Collision判定 | 根拠 |
|---|---|---|
| 矢印キー（Shift無し、X/Yのみ、Zは矢印キー未対応） | **行わない** | `SimScene.tsx:1176-1178`: `useSimStore.getState().translateSelectedObject(axis, sign*moveStep)`を直接呼ぶのみ。`evaluateDragCandidate`/`composeDragCandidatePose`いずれも呼ばれない。 |
| ControlPad（X/Y/Z全軸ボタン） | **行わない** | `ControlPad.tsx:69-76`→`useSimStore.getState().translateSelectedObject(axis, deltaMm)`。同上、Collision Engine非経由。 |
| `translateSelectedObject()`本体 | **行わない** | `useSimStore.ts:205-210`: `clampDragOffsetMm()`のみ、Collision呼び出しなし。 |
| Pointer / Direct Drag | **行う**（`composeDragCandidatePose()`経由） | `SimScene.tsx:925-945`、A節参照 |
| Depth（PageUp/PageDown） | **行う**（同じ`composeDragCandidatePose()`経由） | `SimScene.tsx:1101` |

したがって、本Taskが問う「既存dragOffsetがCandidateに正しく反映されているか」という問題は
**Pointer Drag と Depth にのみ該当する**。矢印キー/ControlPadのX/Y/Z Translationは
Collision Candidateという概念自体が存在しない（＝Collision Constraintが常にスキップされる、
これはこれで別の重大な事実だが、本Task範囲の「乖離」問題とは性質が異なる — K節で扱う）。

### 数値検証（Pointer Dragを想定、BELL-type、`basePos=STAPES_HEAD`、`target=UMBO_POS`
実座標定数使用、`shaftLength=4.5mm`、`angleTilt=angleTiltZ=0`）

**Step 1（dragOffset 0mm → 1.0mm、＝初回ドラッグ）:**

| 軸 | Candidate Position | Rendering Position（Commit後再評価） | Position \|diff\| | angle(Candidate.quat, Rendering.quat) |
|---|---|---|---|---|
| X | (-1.6189, 0.7976, 2.6344) | (-1.7701, 0.6097, 2.8374) | **0.315 mm** | **9.18°** |
| Y | (-2.6189, 1.7976, 2.6344) | (-2.7595, 1.0485, 2.5682) | **0.765 mm** | **19.57°** |
| Z | (-2.6189, 0.7976, 3.6344) | (-2.3383, 0.6754, 3.1239) | **0.595 mm** | **18.39°** |

**重要な発見（本Taskが想定していなかった追加事項）**: Step 1は**既存offsetがゼロの状態**
（＝本Taskが「問題ない」と想定していたケース）にもかかわらず、Candidate PositionとRendering
Position（Commit後）に明確な乖離が生じている。原因はA節の式`committed.position.clone().add(dragLocalDelta)`
がベクトル加算という**線形近似**である一方、Commit後の再描画（`computeProsthesisModelPose()`の
再評価）は`base`から`dir=normalize(target-base)`を再計算する**非線形関数**であるため
（D-4 Audit D節で確認済みの「Translation→Quaternion Coupling」と同一の非線形性）。
ドラッグ中に画面に表示されている位置（`committed.position + dragLocalDelta`、これは実際に
Rendering側もドラッグ中は同じ式で描画している——`dragGroupRef`がProsthesisModelの外側に
position-onlyでネストされているため）と、pointerup直後に再計算される真の位置との間には、
**既存offsetの有無に関わらず**、ドラッグ量に比例したズレが常に存在する。
これは「Release Jump（開放時の視覚的スナップ）」の一種であり、本Task範囲を超える追加の
Architecture上の懸念事項として L/M節で扱う。

**Step 2（既存dragOffset=1.0mm、新規delta+0.5mm → 真の合計1.5mm）:**

| 軸 | Candidate Position（既存1.0mm無視） | Rendering Position（真の1.5mm） | Position \|diff\| | Candidate Quaternion | Rendering Quaternion | angle |
|---|---|---|---|---|---|---|
| X | (-2.1189, 0.7976, 2.6344) | (-1.3129, 0.5420, 2.9106) | **0.890 mm** | (-0.2397,0,0.5092,0.8266) | (-0.1728,0,0.5862,0.7915) | **12.37°** |
| Y | (-2.6189, 0.7976, 2.6344) | (-2.7392, 1.1467, 2.5778) | **0.201 mm** | 同上 | (-0.3222,0,0.6846,0.6539) | **29.84°** |
| Z | (-2.6189, 0.7976, 3.1344) | (-2.1988, 0.6146, 3.4517) | **0.557 mm** | 同上 | (-0.4364,0,0.4086,0.8017) | **25.53°** |

Candidate Quaternionは3軸とも同一値（＝新規delta 0.5mmとは無関係に、既存offset無視のbase固定値）。
これは「Quaternionの誤差は新規操作量ではなく、既存の累積offset量にのみ依存する」ことを意味する。

### Quaternion誤差の既存offset依存性（新規delta固定=0.10mm=KEYBOARD_STEP_MM、既存offsetのみ変化）

| 既存offset | X誤差 | Y誤差 | Z誤差 |
|---:|---:|---:|---:|
| 0.5mm | 6.05° | 11.42° | 11.72° |
| 1.0mm | 9.88° | 21.64° | 19.93° |
| 2.0mm | 15.42° | 41.44° | 32.58° |
| 3.0mm（クランプ上限） | 19.20° | **57.37°** | 41.48° |

**新規操作量がわずか0.10mm（最小キーボードステップ）であっても、既存offsetが大きいほど
Candidate Quaternionの誤差は線形以上に増大する。** Y軸では既存offset=3.0mmのとき57.37°という、
無視できない大きさの誤差に達する。

---

## F. Depth

コード経路はC/D/E節のPointer Dragと同一の`evaluateDragCandidate()`/`composeDragCandidatePose()`
を共有する（D-4 Audit G節参照）。カメラ方向→coordGroupRef-local変換は以下（実際の
`coordGroupRef.rotation=[π,-π/2,0]`使用、カメラがWorld -Z方向を注視している代表例）:

```
localDir (coordGroupRef-local) = (1.0000, -0.0000, 0.0000)   ← この例ではX軸（dragOffsetX）に射影される
```

**Depth #1（dragOffsetX 0→0.10mm、PageDown1回）:**
```
Candidate Position: (-2.5189, 0.7976, 2.6344)
Rendering Position（Commit後）: (-2.5400, 0.7748, 2.6590)
|diff| = 0.0396mm,  angle(Candidate.quat, Rendering.quat) = 1.15°
```
Step1相当（既存offset無し）でも上記C/D/E節の非線形性による乖離が発生するが、Depthの1押下分の
delta（0.10mm）がPointer Drag検証（1.0mm）より小さいため、絶対値は小さい（0.04mm/1.15°）。

**Depth #2（既存dragOffsetX=0.10mm、新規PageDown1回+0.10mm → 真の合計0.20mm）:**
```
Candidate Position（既存0.10mm無視）: (-2.5189, 0.7976, 2.6344)
Rendering Position（真の0.20mm）: (-2.4594, 0.7530, 2.6825)
|diff| = 0.0886mm,  angle(Candidate.quat, Rendering.quat) = 2.23°
```
Depthを連続して複数回押下するほど、C/D/E節と同じ機序でCandidate Quaternionの誤差が累積する
（押下回数に応じて上記「Quaternion誤差の既存offset依存性」表と同じ傾向で増大する）。

**補足（Depth特有の注意点）**: Depth Session中（PageUp/PageDown押下中）は、画面に実際に表示される
Quaternionは`depthSessionQuat`（Session開始時点のスナップショットで凍結、SimScene.tsx:1120-1130、
D-4-A/Option①で導入）であり、`renderingPose()`の毎フレーム再計算値ではない。したがって
「Rendering Quaternion」が実際に画面上どう見えるかはFreeze機構が別途介在するが、
**Collision判定自体（`evaluateDragCandidate`）はFreeze機構と無関係にcomposeDragCandidatePose()を
そのまま呼んでおり、Freezeの有無に関わらず上記の乖離を抱えたままCollision判定が行われる。**

---

## G. Pointer Drag

C/D/E節の数値検証がそのままPointer Dragの検証結果である（Pointer DragはTranslationの一実装であり、
`evaluateDragCandidate()`/`composeDragCandidatePose()`を共有するため、コード経路上区別できない）。

`dragGroupRef.position`とPlacementState.dragOffsetX/Y/Zの関係:
```
ドラッグ中: dragGroupRef.position = 生の累積delta（pointerdown起点からの合計、useScreenSpaceDrag.
            handleMoveが毎pointermoveでimperativeに書き換え。Reactを経由しないためstore更新なし）
pointerup:  onDragEnd(finalDelta) → evaluateDragCandidate(finalDelta)でCollision再判定
            → dragOffsetX/Y/Z = clamp3(dragOffsetX/Y/Z + effectiveDelta) → store書き込み
            → dragGroupRef.position は (0,0,0) へリセット（useScreenSpaceDrag.handleUp内）
```
`finalDelta`は「このドラッグセッションの合計delta」であり、既存の`dragOffsetX/Y/Z`を含まない
（A節で確認した`composeDragCandidatePose()`の性質と整合的——Pointer Drag自体、実装当初から
既存offsetを意識していない設計であることが伺える）。

---

## H. Rotate Comparison

数値検証（既存`dragOffsetX=1.0mm`、Rotate: `angleTilt` 0°→5°）:
```
Rotate Candidate Position: (-1.7701, 0.6097, 2.8374)
Rendering  Position（Commit後、angleTilt=5°, dragOffsetX=1.0mm）: (-1.7701, 0.6097, 2.8374)
|diff| = 0.000000 mm
angle(Candidate.quat, Rendering.quat) = 0.000000°
```
**完全一致。** `composeRotationCandidatePose()`は既存`dragOffsetX/Y/Z`を明示的に加算しており
（B節）、かつ「今回の操作対象は角度のみでPositionには新規delta概念がない」という性質上、
Position計算式自体がRendering側と数式レベルで同一（両者とも`computeProsthesisModelPose(lateralOffset+
dragOffsetX, ...)`という同じ式）。これは`composeDragCandidatePose()`とは対照的な設計であり、
「同じCandidate Pose計算という役割を持つ2つの関数が、既存offsetの扱いについて非対称な設計に
なっている」ことを改めて確定する。

ただしRotateにも、`composeDragCandidatePose()`と同様に「ドラッグ中の線形近似」の概念は存在しない
（マウスRotate ModeはpxdeltaをそのままcandidateAngleへ変換するため、Rotateには本質的に
C/D/E節で確認した「Release Jump」的な非線形性は生じない——Position式が完全に同一であるため）。

---

## I. Rendering vs Collision Matrix

| Operation | Existing Offset Included? | New Delta Included? | Rendering Position | Candidate Position | Difference |
|---|---:|---:|---|---|---|
| X（矢印キー/ControlPad） | N/A（Candidate自体が計算されない） | N/A | `lateralOffset+dragOffsetX`基準 | — Collision判定自体が存在しない — | N/A |
| Y（矢印キー/ControlPad） | N/A | N/A | 同上 | 同上 | N/A |
| Z（ControlPadのみ、矢印キー非対応） | N/A | N/A | 同上 | 同上 | N/A |
| X（Pointer Drag/Depth） | **NO** | YES | C節参照 | C節参照 | Step1: 0.32mm/9.18°、Step2: 0.89mm/12.37° |
| Y（Pointer Drag/Depth） | **NO** | YES | D節参照 | D節参照 | Step1: 0.76mm/19.57°、Step2: 0.20mm/29.84° |
| Z（Pointer Drag/Depth） | **NO** | YES | E節参照 | E節参照 | Step1: 0.60mm/18.39°、Step2: 0.56mm/25.53° |
| Depth | **NO**（X/Yと同一関数） | YES | F節参照 | F節参照 | #1: 0.04mm/1.15°、#2: 0.09mm/2.23° |
| Pointer Drag | **NO**（X/Y/Zと同一） | YES | G節参照 | G節参照 | C/D/E節と同一 |
| Rotate（矢印キー/マウスDrag） | **YES** | YES（candidateAngle） | H節参照 | H節参照 | **0.000mm / 0.000°（完全一致）** |
| Rotate（ControlPad） | N/A（Collision判定自体が存在しない、D-4 Audit確認済み） | N/A | — | — | N/A |
| Shaft Roll | N/A（Collision判定自体が存在しない） | N/A | — | — | N/A |

「Included」は変数名の存在ではなく、最終Position/Quaternion計算式への実際の寄与で判定した
（Task §13の指示通り）。

---

## J. Numeric Evidence

C〜H節に記載の全数値は、Frozen対象コード（`computeCurrentAxisAlignmentOrientation`/
`computeCurrentAxisAlignmentPose`/`computeProsthesisModelPose`/`composeDragCandidatePose`/
`composeRotationCandidatePose`）をNode.js + three.js（プロジェクトの`node_modules/three`、
バージョン変更なし）で**一字一句コピーして実行**した結果である。使用した定数はすべて実際の
プロジェクト値（`OssicleModels.tsx`の`STAPES_HEAD=(-0.7249,-0.0273,3.5259)`、
`UMBO_POS=(-3.236,1.0663,2.3439)`、`coordGroupRef.rotation=[π,-π/2,0]`）。検証スクリプトは
実行後に削除済み（末尾「検証ログ」参照）。

---

## K. Collision Safety Impact

### False Negative（実際は衝突しているのにCollision Engineがcollided=falseと判定する）
**PLAUSIBLE（実際のMeshBVHベースCollision Engineでは未検証、幾何学的類推による）。**
理由: Collision判定は`buildProsthesisCollisionProxy({position: candidatePose.position, quaternion:
candidatePose.quaternion, ...})`（SimScene.tsx:831-835）に対して行われる。C〜F節の数値により、
Candidate Position/Quaternionは実際のRendering Position/Quaternionから最大で
**Position 0.89mm、Quaternion 29.84°（Step2実測）〜57.37°（既存offset=3.0mm理論値）**
ズレうることが確定した。このズレはCollision判定対象のProsthesis形状全体（Shaft/Foot/HeadPlate）を
実際の姿勢とは異なる姿勢で評価することを意味する。Foot-Bone間の接触許容誤差
`FOOT_CONTACT_TOLERANCE_MM=0.15mm`（`prosthesisCollisionGeometry.ts:81`）と比較すると、
実測されたPosition誤差（0.04〜0.89mm）は同オーダーかそれ以上であり、Quaternion誤差
（1°〜57°、シャフト長4.5mmに対する先端変位に換算すると数百µm〜mmオーダー）も同様に
無視できない。したがって、**Candidate Poseで「衝突なし」と判定された移動が、実際にRenderingされる
姿勢では衝突している（False Negative）可能性は幾何学的に否定できない。**

実際のMeshBVH（Bone.glb等の実メッシュ）を用いた確定的な再現テストは、本調査で使用した
スタンドアロンNodeスクリプトでは実施不可能だった（`anatomyCollisionIndex.ts`は
`@react-three/drei`の`useGLTF()`＋React実行コンテキストに依存するため、Reactアプリ外の
単体スクリプトでは同じ経路を再現できない——ブラウザ内での実機再現テストが必要）。
**したがって、False Negativeの実発生は「幾何学的に可能」であることまでを確定し、
「実際に発生するか」はUNKNOWN（実機/E2E検証が必要）とする。**

### False Positive（実際は衝突していないのにCollision Engineがcollided=trueと判定する）
同一の理由で**PLAUSIBLE**。Candidate Poseが実際の姿勢よりも解剖構造に近い（または誤った方向へ
傾いた）姿勢で評価されれば、安全な移動を誤ってブロックする可能性も同様に存在する。
False Negative/Positiveいずれの方向にも誤差が作用しうる（誤差の符号はケースに依存するため、
一方向にのみ偏るとは言えない）。

### 影響の重大度に関わる追加要因
- 誤差は**既存offsetの絶対値に比例して増大**する（C/D/E節の表）。したがって、ユーザーが
  Prosthesisを繰り返しドラッグ・Depth操作するほど（＝実際の手技として自然に起こりうる操作
  パターン）、Collision判定の信頼性は低下していく。
- Y軸方向の誤差が最も大きい（既存offset=3.0mmで57.37°）。これは`target(UMBO_POS)`との相対距離・
  方向関係に起因する幾何学的性質であり、症例・製品（basePos=STAPES_HEAD/FOOTPLATE、footType）に
  よって具体的な数値は変動する（本検証はBELL-type・特定basePos一例のみ、他の症例/製品での
  再現値はUNKNOWN）。

---

## L. Root Cause

`composeDragCandidatePose()`（SimScene.tsx:1439-1464）が、Candidate Positionの基準を
`computeProsthesisModelPose({lateralOffset, anteriorOffset, verticalOffset, ...})`
（＝生のPlacementStateスライダー値のみ）から計算し、既にCommitted済みの`dragOffsetX/Y/Z`
（TransformControls/Pointer Drag/Depthが積み上げてきた累積オフセット）を一切加算していない。
これに対し、兄弟関数`composeRotationCandidatePose()`（SimScene.tsx:1478-1506）は同じ役割を
果たすにもかかわらず`dragOffsetX/Y/Z`を明示的に加算しており、**設計として非対称**である
（H節で数値的に完全一致を確認済み——Rotate側は正しく実装されている）。

さらに、この非対称性とは独立した第二の要因として、`composeDragCandidatePose()`の
`position = committed.position.clone().add(dragLocalDelta)`という**ベクトル加算による線形近似**が、
`computeProsthesisModelPose()`自体の非線形性（D-4 Audit D節: `dir=normalize(target-base)`という
非線形関数）と本質的に相容れない。この第二の要因は既存offsetの有無に関わらず作用するため
（C節Step1で確認）、composeRotationCandidatePose側には該当しない（Rotateには「ドラッグ中delta」の
概念自体が存在しないため）。**両要因は独立して存在し、Pointer Drag/DepthではSTEP数が増えるごとに
両方が複合的に累積する。**

矢印キー/ControlPadのX/Y/Z Translationについては、そもそもCollision Candidateという概念自体が
コード上存在しない（`translateSelectedObject()`が直接dragOffsetを書き換えるのみ）ため、
本Root Causeの対象外（＝別の、より根本的な「この経路にCollision Constraintが実装されていない」
という事実、これは新規のRoot Causeというより既存の実装範囲の限界として扱う）。

---

## M. Architecture Assessment

**判定: COLLISION SAFETY ISSUE および BROADER MANIPULATION ARCHITECTURE ISSUE の両方に該当する。**

- **COLLISION SAFETY ISSUE**: K節で確認した通り、Candidate PoseとRendering Poseの乖離
  （最大0.89mm Position / 57°級Quaternion、既存offsetに比例して増大）は、Collision Constraintの
  False Negative/False Positiveを幾何学的に否定できない水準である。実メッシュでの確定は
  未実施（UNKNOWN）だが、「起こりうるかどうか」自体はもはやUNKNOWNではなく、数学的にPLAUSIBLEと
  確定した。
- **BROADER MANIPULATION ARCHITECTURE ISSUE**: 原因はcomposeDragCandidatePose 1関数の
  ローカルなtypo/見落としではなく、(a) Candidate Pose計算関数が2つ独立実装され片方だけ
  既存offsetを欠く非対称設計、(b) Candidate Pose計算がPosition/Quaternionの非線形関数を
  線形（ベクトル加算）近似している構造的性質、という2つの独立した設計上の性質に起因する。
  さらに矢印キー/ControlPad Translationには、そもそもこの種のCandidate Pose計算自体が
  存在しない（Collision Constraint非適用）という第三の、より広い意味論の不統一が併存する。

`composeDragCandidatePose()`単体を修正すれば済む「Cosmetic」な問題ではなく、Candidate Pose生成の
設計方針そのものについてArchitect判断が必要な段階にある。

---

## N. Architect Decision Required

1. **矢印キー/ControlPadによるX/Y/Z Translationに、そもそもCollision Constraintを適用するか。**
   現状は完全に非適用（本Task最大の追加発見）。適用する場合、`evaluateDragCandidate()`相当の
   判定をどう組み込むか（新規delta概念がない一括加算型の操作にどう対応するか）を含め設計が必要。
2. **composeDragCandidatePose()へ既存dragOffsetX/Y/Zを含めるべきか。** 含めれば
   composeRotationCandidatePose()との対称性は回復するが、Collision Constraintの合格/不合格境界が
   変化するため、既存Phase C-2〜C-8で確定した挙動への影響評価が必要（D-4 Audit M節と同一の
   論点）。
3. **Candidate Pose計算のベクトル加算近似（線形近似）を、非線形な`computeProsthesisModelPose()`
   の直接再評価へ置き換えるべきか。** 置き換える場合、毎フレーム/毎pointermoveのパフォーマンス
   コストが増加する可能性があり、既存のInvestigation（rotate-smoothness-cost-harness等）と
   同様のコスト測定が必要になりうる。
4. **上記1〜3のいずれを選んでも、実際にFalse Negativeが起こりうる具体的な症例・操作パターンを
   実機（ブラウザ、MeshBVH経由の実Collision Engine）で再現・定量化する追加検証が必要か。**
   本Taskはスタンドアロンスクリプトの制約上、これを実施できていない。
5. **D-4 Axis Design（角度軸・座標系そのものの設計変更）を、本Collision Candidate Integrity問題の
   解決より先に進めてよいか。** O節で回答する。

---

## O. Final Conclusion

```
Existing dragOffset is correctly included in composeDragCandidatePose?
= NO
  （A節で確定。パラメータリスト・呼び出し引数のいずれにもdragOffsetX/Y/Zが存在しない。
    composeRotationCandidatePose()は正しく含めている＝非対称。）

Rendering Pose == Collision Candidate Pose?
= NO（Translation/Depth/Pointer Drag） / YES（Rotate）
  Translation系: 既存offset=0でも非線形近似により乖離（Step1実測 0.32-0.76mm/9-20°）、
  既存offsetが増えるほど乖離が拡大（Step2実測 0.20-0.89mm/12-30°、理論最大値 Y軸57°@offset3mm）。
  Rotate: 完全一致（0.000mm/0.000°、実測）。
  Shaft Roll: Collision Candidate自体が存在しないためN/A。
  矢印キー/ControlPad Translation: Collision Candidate自体が存在しないためN/A
  （＝Collision Constraint完全非適用、乖離以前の問題）。

Collision Safety Impact?
= MATERIAL（幾何学的評価に基づく判定。実メッシュCollision Engineでの確定的再現は未実施のため
  CRITICALとまでは断定しないが、Position最大0.89mm・Quaternion最大57°級の乖離は
  FOOT_CONTACT_TOLERANCE_MM=0.15mmという既存の安全余裕と比較して明らかに大きく、
  「無視できるCosmetic差」ではない。）

False Negative collision possible?
= PLAUSIBLE（幾何学的に否定できないことを数値確認済み。実メッシュでの確定発生条件はUNKNOWN、
  実機/E2E検証が必要。YES/NOで断定するにはMeshBVHベースの実Collision Engine実行が必須で、
  本Taskのスタンドアロンスクリプトでは到達不可能だった。）

D-4 Axis Design can proceed independently?
= NO（推奨）。D-4 Axis Design（angleTilt/angleTiltZ・Translation軸の意味論変更）は、
  Candidate Pose計算式（composeDragCandidatePose/composeRotationCandidatePose）を直接の
  入力として使う。Axis Design自体を変更すればCandidate Pose計算式も連動して書き換える
  必要が生じるため、現在確認されているCollision Safety上の乖離（本Task）を未解決のまま
  Axis Design変更を進めると、新しい設計の上に同じ乖離（またはより複雑化した乖離）を
  積み重ねることになる。ただし本判定は事実に基づく推奨であり、最終的な順序決定は
  Architect判断に委ねる（Task指示§19「HOW TO FIXは別Task」を遵守し、本レポートは
  順序に関する事実整理のみを行う）。

Implementation Required?
= NOT AUTHORIZED IN THIS TASK
```

```
Implementation Changes = NONE
Commit = NONE
Push = NONE
```

---

## 検証ログ

開始時:
```
$ git status && git log -1 && git diff && git diff --check
→ HEAD = 871b1c5926dd73d6bf5f823dfe6785f2aabc900a
→ Working Tree = CLEAN（tracked filesの差分なし）
→ Untracked: .claude/, .mcp.json, .serena/, _softclip_split_backup/, docs/D1_*.md ×2,
  docs/D4_Manipulation_Axis_Coordinate_System_Audit_v1.0.md, eac_topology_check.py,
  serena-mcp.ps1（前回D-4 Audit終了時点から変化なし、いずれも本Taskで変更・削除していない）
```

数値Evidence生成に使用した一時スクリプト（Node.js + three.js、`composeDragCandidatePose`/
`composeRotationCandidatePose`/`computeProsthesisModelPose`等のロジックをコードから直接
書き写して実行、Frozen対象の本体コードは一切変更していない）は検証後に削除済み。

終了時:
```
$ git status --porcelain
→ 開始時と同一（untracked filesのみ、tracked filesの変更なし。本レポート自体は新規untracked
  ファイルとして追加、Commit/Push対象外）
Implementation Changes = NONE
Commit = NONE
Push = NONE
Working Tree = unchanged
```
