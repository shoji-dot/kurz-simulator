# D-4 Manipulation Axis / Coordinate System Audit

Status: Investigation Only — 実装なし・Commitなし・Pushなし（Decision Preparation）

## Repository Integrity

```
HEAD:                871b1c5926dd73d6bf5f823dfe6785f2aabc900a
Working Tree:        CLEAN（git diff 差分なし。untracked filesは調査開始前から存在、変更対象外）
Implementation Changes: NONE
Commit:               NONE
Push:                 NONE
```
検証コマンドと結果は本レポート末尾「検証ログ」参照。一時検証スクリプト（Node、three.js使用）は
検証後に削除済み（`git status --porcelain` で確認、リポジトリに残存なし）。

---

## A. Operation → Code Path

### A-1. X / Y / Z Translation（Placement段階、矢印キー・ControlPad・Pointer Drag共通の最終書き込み先）

**矢印キー経路（isMove時、Shift無し）:**
```
ArrowRight/Left/Up/Down (Shift無し)
→ SimScene.tsx:1150-1179 onKeyDown()
→ useSimStore.getState().translateSelectedObject(axis, sign*moveStep)
→ useSimStore.ts:205-210 translateSelectedObject()
→ dragOffsetX/Y/Z = clampDragOffsetMm(dragOffsetX/Y/Z + deltaMm)   [useSimStore.ts:148, ±3mm]
→ store.placement (Zustand state)
→ SimScene.tsx:1526 destructure → DraggableProsthesis props (SimScene.tsx:2294-2313)
→ ProsthesisModel(lateralOffset+dragOffsetX, verticalOffset+dragOffsetY, anteriorOffset+dragOffsetZ, angleTilt, angleTiltZ)
   [SimScene.tsx:1391-1395]
→ computeProsthesisModelPose() [ProsthesisModels.tsx:1742-1762]
→ <group position={mid} quaternion={renderQuaternion}> [ProsthesisModels.tsx:1802-1805]
```

**ControlPad経路:**
```
HoldButton onTick → ControlPad.tsx:69-76 translate()
→ useSimStore.getState().translateSelectedObject(axis, deltaMm)  ※以降は矢印キー経路と合流
```
X→lateral(内/外), Y→vertical(上/下), Z→anterior(前/後) というボタン配置・ラベルは
ControlPad.tsx:128-141（`内`/`外`/`上`/`下`/`前`/`後`という解剖学用語ラベル付き）で確認。

**Pointer Direct Drag経路（directManipulation=true時、dragMode≠'rotate'）:**
```
pointerDown on Prosthesis mesh
→ onDirectDragPointerDown = useScreenSpaceDrag(dragGroupRef, handleDragActiveChange, onDragEnd)
   [SimScene.tsx:925-945, 関数本体はManipulationLayer.tsx:277-341]
→ handleMove: camera.getWorldDirection() でplane法線を決定 → raycastToPlane()でスクリーン座標→
   ワールド座標（plane交点） [ManipulationLayer.tsx:293-324]
→ worldDelta = point - startPoint
→ localDelta = worldDelta.applyMatrix3(parentInverseRotation)  ※dragGroupRef.parent
   （＝coordGroupRef、後述）のmatrixWorld回転成分の逆行列 [ManipulationLayer.tsx:297-298, 322]
→ group.position.copy(localDelta)  ※dragGroupRef.position、毎pointermoveで直接書き換え（imperative）
→ pointerUp: onDragEnd(finalDelta) [ManipulationLayer.tsx:331-333]
→ SimScene.tsx:928-943 onDragEnd:
   evaluateDragCandidate(localDelta) でCollision判定 → collision時はlastValidLocalDeltaRefへ差替
   → dragOffsetX/Y/Z = clamp3(dragOffsetX/Y/Z + effectiveDelta.x/y/z)
   → useSimStore.getState().updatePlacement({...})
→ 以降はArrow key経路と合流（dragOffsetX/Y/Zが同一フィールド）
```

**Depth（PageUp/PageDown、Camera-relative）:**
```
PageUp/PageDown keydown
→ SimScene.tsx:1075-1148 onKeyDown() 内のPageUp/PageDown分岐
→ camera.getWorldDirection(camDir)
→ parentInverseRotation = Matrix3(dragGroupRef.parent.matrixWorld の回転成分のみ, invert)
→ localDir = camDir.applyMatrix3(parentInverseRotation).normalize()
→ depthDelta = localDir * (sign * depthStep)   [sign: PageDown=+1, PageUp=-1]
→ evaluateDragCandidate(depthDelta) でCollision判定
→ nextDragOffsetX/Y/Z = clamp3(dragOffsetX/Y/Z + depthDelta.x/y/z)
→ [D-4 Option①] depthSessionQuat未設定なら、現在表示中のQuaternionをsnapshotしてstateへ保存
   （computeProsthesisModelPose({..., lateralOffset+placement.dragOffsetX, ...}).quaternion）
   [SimScene.tsx:1120-1130]
→ useSimStore.getState().updatePlacement({dragOffsetX, dragOffsetY, dragOffsetZ})
→ 以降はArrow key経路と合流（dragOffsetX/Y/Zが同一フィールド）だが、renderのQuaternionのみ
   depthSessionQuat（frozen）で上書き [depthPoseOverride, SimScene.tsx:1331-1341]
keyup (PageUp/PageDown解放)
→ SimScene.tsx:1185-1190 onKeyUp() → endDepthSession(true)
→ 200ms slerp補間（releaseInterp, RELEASE_INTERP_DURATION_MS） [SimScene.tsx:721-749, 1305-1318]
```

### A-2. Rotate（angleTilt / angleTiltZ）

**Shift+矢印キー経路:**
```
Shift+ArrowLeft/Right/Up/Down
→ SimScene.tsx:1158-1175 onKeyDown()
→ candidateAngle = clampAngleDeg(currentAngle + sign*rotStep)
→ evaluateRotationCandidate(rotAxis, candidateAngle) でCollision判定
   [SimScene.tsx:879-920 → composeRotationCandidatePose() → computeProsthesisModelPose()]
→ useSimStore.getState().updatePlacement({angleTilt|angleTiltZ: candidateAngle})
→ computeProsthesisModelPose() [ProsthesisModels.tsx:1742-1762]
   → computeCurrentAxisAlignmentOrientation() [ProsthesisModels.tsx:1641-1662]
→ <group quaternion={renderQuaternion}>
```

**マウスRotate Mode経路（dragMode==='rotate'、directManipulation=true時）:**
```
pointerDown on Prosthesis mesh (Rotate Mode)
→ onDirectRotatePointerDown [SimScene.tsx:960-1022]
→ handleMove: dx=clientX差分→candidateTiltZ（×ROTATE_DEG_PER_PIXEL_TILT_Z=0.3）、
              dy=clientY差分→candidateTilt（×ROTATE_DEG_PER_PIXEL_TILT=-0.3） [SimScene.tsx:982-1004]
→ evaluateRotationCandidate() でCollision判定 → PASSした値をpendingAngleTilt(Z)Refへ保持
→ 1フレームに1回 flushPendingRotation() [SimScene.tsx:774-784, 1294-1296] → updatePlacement()
```
**ControlPad経路:**
```
HoldButton onTick → ControlPad.tsx:77-84 rotate()
→ useSimStore.getState().rotateSelectedObject(axis, deltaDeg)
→ useSimStore.ts:212-217 rotateSelectedObject() → angleTilt|angleTiltZ = clampAngleDeg(...)
   ※ControlPad経由はevaluateRotationCandidate()を経由しない（Collision判定なし）
```

### A-3. Shaft Roll（interactionShaftRollDeg、PlacementStateの外側）

```
HoldButton onTick → ControlPad.tsx:87-89 rotateShaftRoll()
→ useSimStore.getState().rotateShaftRoll(deltaDeg)
→ useSimStore.ts:219-221 interactionShaftRollDeg = clampAngleDeg(interactionShaftRollDeg + deltaDeg)
→ SimScene.tsx:1542 useSimStore((s)=>s.interactionShaftRollDeg) → shaftRollDeg prop
→ DraggableProsthesis(shaftRollDeg) → ProsthesisModel(shaftRollDeg) [SimScene.tsx:1398, 2309]
→ ProsthesisModels.tsx:1796-1800:
   renderQuaternion = pose.quaternion.multiply(Quaternion.setFromAxisAngle([0,1,0], shaftRollDeg))
→ <group quaternion={renderQuaternion}>
```
Collision判定経路は存在しない（`rotateShaftRoll`はstoreのclampのみで直接反映。evaluateDragCandidate/
evaluateRotationCandidateいずれも呼ばれない）。ただしshaftRollDegの現在値は、他操作（X/Y/Z Drag・
Rotate）のCollision候補姿勢計算（composeDragCandidatePose/composeRotationCandidatePose）には
入力として使われる [SimScene.tsx:829, 890] — 「Shaft Roll自身の変更」を直接ゲートする判定はない。

### A-4. Pointer / Direct Drag

上記A-1のPointer Direct Drag経路と同一（Translationの一形態として実装されている。Rotate Modeは
A-2のマウスRotate Mode経路）。

### 補足: Transport段階（manipulation.committed===false、PlacementState未確定）

D-4のPlacement段階操作とは別の並行実装（ManipulationLayer.tsx）。DIRECT_MANIPULATION_UX=true
[transformControlsConfig.ts:40] のため実際に使われるのはDirectTransportProsthesis
[ManipulationLayer.tsx:443-576]。

```
PageUp/PageDown (Transport段階)
→ ManipulationLayer.tsx:490-508 onKeyDown()
→ camera.getWorldDirection() + group.parent.matrixWorld逆行列（Placement段階と全く同じ技法）
→ onTranslateTransport('x'|'y'|'z', delta) = SimScene.tsx側のtranslateTransport（ControlPad用に
   既存定義、未読了・呼び出し元のみ確認）
→ transportPose.position (React state、basePos基準ではなく絶対座標)
```
Transport段階にはCollision Constraint・Quaternion Freeze・dragOffsetクランプは一切存在しない
（ManipulationLayer.tsx:471-473のコメントで明記）。Quaternionは毎フレーム
`computeProsthesisModelPose({basePos: livePos, angleTilt, angleTiltZ}).quaternion`を再計算する
だけで、Freeze相当の仕組みはない [ManipulationLayer.tsx:539-560]。

---

## B. Coordinate System

| 操作 | 入力座標系 | 中間変換 | 最終適用座標系 |
|---|---|---|---|
| X/Y/Z Translation（矢印キー/ControlPad） | 無変換（直接±mm加算） | なし | dragOffsetX/Y/Z（coordGroupRef-local、=解剖学的lateral/vertical/anterior軸） |
| Depth（PageUp/PageDown） | Camera World Space（`camera.getWorldDirection()`） | `Matrix3(dragGroupRef.parent.matrixWorld).invert()` でParent-local化 | dragOffsetX/Y/Z（coordGroupRef-local、Depth自体はCamera軸だが書き込み先はTranslationと同じ軸） |
| Pointer Drag | Screen Space（clientX/clientY） → Raycaster→Plane交点でWorld Space | `Matrix3(dragGroupRef.parent.matrixWorld).invert()` でParent-local化 | dragOffsetX/Y/Z（coordGroupRef-local） |
| Rotate（Shift+矢印キー） | 無変換（直接±deg加算） | なし（Collision判定のみcomposeRotationCandidatePose経由） | angleTilt/angleTiltZ（quat0=base→UMBO方向のEuler分解成分、後述C/E参照。World/Local/Anatomicalいずれの単一軸でもない） |
| Rotate（マウスDrag、Rotate Mode） | Screen Space（clientX/clientY pixel差分） | 無変換（画面px→度の固定比率、Camera向き非依存） | angleTilt/angleTiltZ（上記と同じ） |
| Shaft Roll | 無変換（直接±deg加算） | なし | Prosthesisローカル+Y軸（シャフト軸）まわりのpost-multiply回転 |

「Parent」= dragGroupRef.parent = `coordGroupRef`（`<group rotation={[Math.PI, -Math.PI/2, 0]}>`、
SimScene.tsx:2204）。dragGroupRefはこのcoordGroupRefの直接の子孫（`prosthesisGroupRef`経由、
SimScene.tsx:2292-2313）。dragOffsetX/Y/Zが表す「lateral/vertical/anterior」はこの
coordGroupRef-localな座標系であり、World座標系そのものではない（World座標系への変換には
coordGroupRefの`rotation=[π, -π/2, 0]`が必ず介在する）。

---

## C. Translation Axis

`base`計算式（ProsthesisModels.tsx:1753-1756）:
```js
const base = (basePos ?? ...).clone();
base.x += lateralOffset;   // = X: dragOffsetXが加算される軸
base.y += verticalOffset;  // = Y: dragOffsetYが加算される軸
base.z += anteriorOffset;  // = Z: dragOffsetZが加算される軸
```

| 軸 | 意味（+方向） | 意味（-方向） | 座標系 | 基準点 | Positionへの影響 | Quaternionへの影響 |
|---|---|---|---|---|---|---|
| X (dragOffsetX↔lateralOffset) | 外側（コメント: 内外側、ControlPad「外」ラベル） | 内側（ControlPad「内」ラベル） | coordGroupRef-local（Anatomical、解剖学的lateral-medial軸として運用） | basePos = STAPES_HEAD or STAPES_FOOTPLATE（症例のstapes状態で分岐、SimScene.tsx:1535-1538） | `base.x`直接加算 → `mid`（シャフト中点）を通じて反映 | あり（D節参照、実測9.18°/mm） |
| Y (dragOffsetY↔verticalOffset) | 上（ControlPad「上」ラベル） | 下（ControlPad「下」ラベル） | 同上 | 同上 | `base.y`直接加算 | あり（実測19.57°/mm） |
| Z (dragOffsetZ↔anteriorOffset) | 前（ControlPad「前」ラベル） | 後（ControlPad「後」ラベル） | 同上 | 同上 | `base.z`直接加算 | あり（実測18.39°/mm） |

X/Y/Zいずれも「Prosthesis自身の向きを基準とした軸（Prosthesis-local）」ではなく、「basePosを原点と
した固定の解剖学的座標系（coordGroupRef-local）」である。Prosthesisの現在の傾き（angleTilt/
angleTiltZ/shaftRollDeg）はX/Y/Z Translationの意味に一切影響しない（=Prosthesis-localではない）。

---

## D. Translation → Quaternion Coupling

**判定: YES（Translation単独操作でQuaternionが変化する）。**

数値Evidence（`computeProsthesisModelPose()`をNode+three.jsで直接実行、BELL-type製品、
`basePos=STAPES_HEAD=(-0.7249,-0.0273,3.5259)`、`target=UMBO_POS=(-3.236,1.0663,2.3439)`
[両定数ともOssicleModels.tsx:266-277からの実値]、`shaftLength=4.5mm`、tilt角0°固定）:

| ケース | Initial Position | Initial Quaternion (x,y,z,w) | Final Position | Final Quaternion (x,y,z,w) | angle(Q_initial, Q_final) |
|---|---|---|---|---|---|
| X +1mm | (-2.6189, 0.7976, 2.6344) | (-0.23967, 0, 0.50917, 0.82662) | (-1.7701, 0.6097, 2.8374) | (-0.19102, 0, 0.56741, 0.80097) | **9.18°** |
| Y +1mm | 同上 | 同上 | (-2.7595, 1.0485, 2.5682) | (-0.29603, 0, 0.62890, 0.71892) | **19.57°** |
| Z +1mm | 同上 | 同上 | (-2.3383, 0.6754, 3.1239) | (-0.38462, 0, 0.44263, 0.81003) | **18.39°** |

X/Y/Zいずれも1mmの単独Translationで9〜20°のQuaternion変化が発生する。dragOffsetの許容範囲は
±3mmのため、理論上は最大でこの3倍程度（数十度）のQuaternion変化がTranslationのみで起こりうる
（この最大値は非線形なため単純な3倍にはならない。上記は基準姿勢近傍での局所勾配的な実測値）。

**Why（コードレベルの依存関係証明）:**
```
lateralOffset/verticalOffset/anteriorOffset (+ dragOffsetX/Y/Z)
  → base.x/y/z += ...                                    [ProsthesisModels.tsx:1754-1756]
  → dir = normalize(target - base)                        [ProsthesisModels.tsx:1650, target=UMBO_POS固定]
  → quat0 = Quaternion.setFromUnitVectors(Y軸, dir)        [ProsthesisModels.tsx:1652]
  → euler0 = Euler.setFromQuaternion(quat0)                [ProsthesisModels.tsx:1653]
  → finalEuler = Euler(euler0.x+tiltX, euler0.y, euler0.z+tiltZ, 'XYZ')  [ProsthesisModels.tsx:1658]
  → quaternion = Quaternion.setFromEuler(finalEuler)        [ProsthesisModels.tsx:1659]
```
`target`（UMBO_POS、固定の解剖学的ランドマーク）は変化しないが、`base`はTranslation操作の直接の
書き込み先であり、`dir`は`base`の関数である。したがって`base`の変化は必ず`dir`→`quat0`→
`euler0`→`finalEuler`→最終`quaternion`という一直線の依存関係を経て伝播する。これは
「UMBO方向が変わるから」という説明の通りだが、より正確には「`quaternion`は`angleTilt`/
`angleTiltZ`という2自由度の“補正”を除けば、実質的に`base→target`方向のみで決定される」という
設計そのものに起因する（tilt角が0の場合、quaternionは完全にbaseとtargetの相対位置だけで決まる）。

---

## E. Rotate Axis

`angleTilt`/`angleTiltZ`は「Local Euler後乗せ」という説明（Task冒頭の記述）よりも精密には、
**「base→target方向alignment quaternion(quat0)をEuler角(XYZ順)に一度分解し、そのX成分・Z成分に
tiltX/tiltZを加算してから再度Quaternionへ合成し直す」**という操作である
[ProsthesisModels.tsx:1652-1659、C節参照]。この式はpost-multiply（`quat0.multiply(tiltQuat)`）
とも、pre-multiply（World軸回転、`tiltQuat.multiply(quat0)`）とも数学的に異なる第三の操作である。

数値Evidence（tiltX=15°, tiltZ=10°、q0=base→target alignment、上記C節と同じbasePos/UMBO_POS）:

| 比較対象 | angle(actual, 比較対象) |
|---|---|
| 実装（Euler成分修正→再合成） vs. **仮説：local post-multiply**（`q0 * Rx(tiltX) * Rz(tiltZ)`） | **15.24°** — 一致しない |
| 実装（Euler成分修正→再合成） vs. **仮説：world pre-multiply**（`Rx(tiltX) * Rz(tiltZ) * q0`） | **4.79°** — 一致しないが、local post-multiply仮説よりは近い |

したがって:
- 「Local」の一言では不十分（Task §11の指摘通り）だが、**実装は単一の名前を持つ回転軸（World X/Z、
  Local X/Z、Umbo方向、Shaft軸、Camera軸のいずれか単独）には分解できない**。Euler角のXYZ順での
  再合成という手続き上の産物であり、「angleTilt/angleTiltZが何軸まわりの回転を表すか」は
  **base→target方向（quat0）に依存して変化する**（quat0が変われば、同じtiltX/tiltZ値でも実際の
  回転軸・回転量の見え方が変わりうる）。
- World axis / Local axis / Umbo方向 / Shaft axis / Camera axisのいずれとも数学的に一致しない
  独立した第三の変換方式である、という事実のみ確定できる。「どちらに寄せるべきか」はArchitect
  Decision対象（M節）。

---

## F. Shaft Roll Axis

```js
// ProsthesisModels.tsx:1796-1800（ProsthesisModel、Render専用）
// SimScene.tsx:1458-1462 / 1500-1504（composeDragCandidatePose / composeRotationCandidatePose、Collision候補専用）
renderQuaternion = pose.quaternion.clone().multiply(
  Quaternion.setFromAxisAngle(Vector3(0,1,0), shaftRollDeg * Math.PI/180)
)
```
これは`pose.quaternion`に対するpost-multiplyであり、四元数合成の性質上、回転軸`(0,1,0)`は
「`pose.quaternion`適用後のワールド座標系」ではなく「`pose.quaternion`適用前のローカル座標系
（＝Prosthesis自身の局所+Y軸）」を意味する。

**幾何階層による裏付け**（ProsthesisModels.tsx:1802-1899）:
```
<group position={mid} quaternion={renderQuaternion}>          … Root（頂点座標系の原点）
  <group position={[0, headOff, 0]}> <HeadPlate/> </group>     … 頭板、Root-local Y=headOff
  <mesh position={[0, shaftY, 0]}> <cylinderGeometry .../> </mesh>  … シャフト、cylinderGeometryは
                                                                       three.jsのデフォルトでY軸沿いに生成される
  <group position={[0, footOff, 0]}> <BellFoot/等/> </group>   … 足部、Root-local Y=footOff
</group>
```
頭板(+headOff)・シャフト本体（cylinderGeometryのY軸沿い円柱）・足部(footOff、負値)がすべて
Rootのローカル+Y軸上に一列に配置されている。したがって「Local +Y」は「Prosthesisの
Shaft longitudinal axis」と幾何学的に一致する（推測ではなくgeometry座標の直接確認）。

数値検証（shaftRollDeg=30°を上記式で適用し、ロール前後でLocal+Y軸が指すWorld方向を比較）:
```
world direction of local +Y BEFORE roll: (-0.84178, 0.36660, -0.39624)
world direction of local +Y AFTER  roll: (-0.84178, 0.36660, -0.39624)   … 完全一致（誤差1e-15未満）
```
Shaft Rollを適用してもLocal+Y軸自体のWorld方向は変化しない（＝回転軸自身は動かない）ことを
数値的に確認済み。Pivot（回転の中心点）はRoot自体の原点（`position=mid`、シャフト中点）であり、
Shaft Roll操作によって`mid`（position）が変化することはない（quaternionのみが変化する）。

---

## G. Depth Axis

コード（SimScene.tsx:1085-1097）:
```js
const camDir = new THREE.Vector3();
camera.getWorldDirection(camDir);
const parentInverseRotation = new THREE.Matrix3().setFromMatrix4(
  new THREE.Matrix4().copy(group.parent.matrixWorld).invert(),
);
const localDir = camDir.clone().applyMatrix3(parentInverseRotation).normalize();
const sign = e.key === 'PageDown' ? 1 : -1;
const depthDelta = localDir.multiplyScalar(sign * depthStep);
```
`group` = `dragGroupRef`、`group.parent` = `coordGroupRef`（B節参照）。

### Question A: PageUp/PageDownはCamera View Directionに沿っているか
**YES**（コード上、`camera.getWorldDirection()`を直接の入力源としている。近似・代替手段は
使われていない）。

### Question B: Cameraが回転してもPageUp=手前・PageDown=奥は維持されるか
**YES、ただし「手前/奥」が意味する実際の`dragOffsetX/Y/Z`軸はカメラ向きによって変わる。**
数値Evidence（coordGroupRefの実際の回転`rotation=[π, -π/2, 0]`をMatrix3へ変換し適用、
`KEYBOARD_STEP_MM=0.10mm`固定）:

| カメラ向き（World空間） | localDir（coordGroupRef-local） | PageUp depthDelta | PageDown depthDelta |
|---|---|---|---|
| World -Z方向を注視 | (1, 0, 0) | dragOffsetX -= 0.10 | dragOffsetX += 0.10 |
| World -X方向を注視 | (0, 0, 1) | dragOffsetZ -= 0.10 | dragOffsetZ += 0.10 |
| World -Y方向を注視（真上から） | (0, 1, 0) | dragOffsetY -= 0.10 | dragOffsetY += 0.10 |

カメラを90°回転させるごとに、Depthが実際に動かす`dragOffsetX/Y/Z`の軸そのものが切り替わる
（X→Z→Y…）。「画面奥/手前」という体験としての一貫性はコード上保証されている
（`camera.getWorldDirection()`を毎回再取得するため）が、これが「解剖学的にどの軸への移動か」は
カメラ操作（OrbitControls、ユーザー操作で任意に変化）に依存し、実行時のカメラ状態は静的コードから
は確定できない（**UNKNOWN as fixed value** — 上表は代表例による例示であり、任意のカメラ角度に
一般化した式ではない）。

### Question C: 最終的にどの軸へ格納されるか
`dragOffsetX`, `dragOffsetY`, `dragOffsetZ`（X/Y/Z Translationと完全に同一のPlacementStateフィールド、
`clamp3()`で±3mmクランプ）。新規フィールドは存在しない。上表がその具体数値例。

---

## H. Pointer Drag Axis

```
Screen (clientX/clientY)
  → NDC変換 [ManipulationLayer.tsx:303-306]
  → Raycaster.setFromCamera(ndc, camera) → ray
  → ray.intersectPlane(plane)                    … plane: 法線=camDir、通過点=dragGroupRef.getWorldPosition()
  → worldDelta = point - startPoint               … World Space（plane上の2点の差）
  → localDelta = worldDelta.applyMatrix3(parentInverseRotation)   … coordGroupRef-local化
  → group.position.copy(localDelta)               … dragGroupRef.position（imperative、Reactを経由しない）
  → pointerUp: dragOffsetX/Y/Z += localDelta（clamp3、evaluateDragCandidate通過後）
```
変換順序: **Screen → (Raycast+Plane交点による) World → Parent(coordGroupRef)-local**。
CameraはPlaneの法線決定にのみ使われ（`camera.getWorldDirection()`、ManipulationLayer.tsx:294）、
そのPlane上でのRay-Plane交点の差分がworldDeltaとなる。

**追加の確認事項（未修正・報告のみ）**: Drag-Plane（法線=camDir、通過点=`dragGroupRef.
getWorldPosition()`）の通過点は、**dragGroupRef自身のposition（JSX上、常に`[0,0,0]`固定、
SimScene.tsx:1369-1371）のWorld変換**であり、Prosthesis本体の実際の描画位置（`mid`、
`ProsthesisModel`内部の別groupが`position={mid}`で保持、ProsthesisModels.tsx:1803-1805）とは
**異なる点**である。`dragGroupRef`は`coordGroupRef`の子孫として原点`(0,0,0)`に留まり続け、
Prosthesis本体の実位置`mid`はさらにその子（`ProsthesisModel`内部）で加算されるため、
Plane通過点はcoordGroupRefの原点付近（基準例ではWorld原点に近い、STAPES_HEAD/UMBO_POSはいずれも
原点から3.6〜3.9mm程度）であり、Prosthesis本体の実際の奥行き位置とは数mm程度ズレている
可能性がある。Perspectiveカメラでは、Plane通過点の奥行き（カメラからの距離）がRay-Plane交点の
スケール（画面px→World mmの換算比）に影響するため、理論上はドラッグ感度（動かした量に対する
実際の移動量）に軽微な誤差が生じうる。ただし軸の意味・符号自体には影響しない（幾何学的に
Planeに対する交点の差分ベクトルの向きは変わらない）。この点は数学的事実の指摘に留め、
実害の有無・修正要否はArchitect判断に委ねる。

---

## I. Prosthesis Hierarchy / Origin

**Placement段階（`manipulation.committed===true`）:**
```
<group ref={coordGroupRef} rotation={[π,-π/2,0]}>                       SimScene.tsx:2204
  <group ref={prosthesisGroupRef}>                                       SimScene.tsx:2292
    <TransformControls (mode="translate", gizmoActive時のみ表示)>        SimScene.tsx:1356-1367
      <group ref={dragGroupRef} position={[0,0,0]}>                      SimScene.tsx:1369-1384
                                                    … pointer drag中、position直接書換
        <ProsthesisModel poseOverride?>                                  SimScene.tsx:1386-1399
          <group position={mid} quaternion={renderQuaternion}>           ProsthesisModels.tsx:1802-1805
            <group position={[0,headOff,0]}> <HeadPlate/> </group>       ProsthesisModels.tsx:1818-1820
            <mesh position={[0,shaftY,0]}> <cylinderGeometry/> </mesh>   ProsthesisModels.tsx:1841-1891
            <group position={[0,footOff,0]}> <Bell/Flat/Clip/Piston Foot/> </group>  ProsthesisModels.tsx:1894-1899
```

**Transport段階（`manipulation.committed===false`、DIRECT_MANIPULATION_UX=true時）:**
```
<group ref={coordGroupRef} rotation={[π,-π/2,0]}>
  <group ref={prosthesisGroupRef}>
    <DirectTransportProsthesis>
      <group ref={groupRef} position={[0,0,0]}>                         ManipulationLayer.tsx:563
                                          … pointer drag中、position直接書換
        <group ref={innerGroupRef}>                                     ManipulationLayer.tsx:564
                    … useFrameで毎フレーム position=basePosRef.current, quaternion=再計算値を imperative設定
          <ProsthesisModel poseOverride={identity}>                      ManipulationLayer.tsx:565-572
            （以下Placement段階と同一のProsthesisModel内部階層）
```

| Group | position | rotation/quaternion | scale |
|---|---|---|---|
| coordGroupRef | 未指定（既定0,0,0） | `[π,-π/2,0]`（固定値、Euler） | 未指定（既定1,1,1） |
| prosthesisGroupRef | 未指定 | 未指定 | 未指定 |
| dragGroupRef / groupRef(Transport) | `[0,0,0]`固定（JSX）、ドラッグ中のみimperativeに書換 | 未指定 | 未指定 |
| innerGroupRef(Transport専用) | useFrameでimperative設定（basePosRef） | useFrameでimperative設定（computeProsthesisModelPose().quaternion） | 未指定 |
| ProsthesisModel Root | `mid`（pose.position、React宣言的） | `renderQuaternion`（pose.quaternion [+shaftRoll]、React宣言的） | 未指定 |
| HeadPlate/Shaft/Foot（子group/mesh） | `headOff`/`shaftY`/`footOff`（局所Y軸オフセットのみ） | 個別指定なし（Rootのquaternionを継承） | 未指定（Shaft cylinderGeometryの半径・長さは別途args指定） |

---

## J. Rendering vs Collision

| 操作 | Rendering Position | Rendering Quaternion | Collision Candidate Position | Collision Candidate Quaternion | 一致/不一致 | 根拠 |
|---|---|---|---|---|---|---|
| X/Y/Z（Pointer Drag中／Depth） | `computeProsthesisModelPose(lateralOffset+dragOffsetX, verticalOffset+dragOffsetY, anteriorOffset+dragOffsetZ, angleTilt, angleTiltZ).position` + dragGroupRef.position（生delta） [SimScene.tsx:1391-1396] | 同上`.quaternion`（Depth Session中はfrozen snapshot、releaseInterp中はslerp） | `composeDragCandidatePose()`: `computeProsthesisModelPose(lateralOffset, anteriorOffset, verticalOffset, angleTilt, angleTiltZ)`**（dragOffsetX/Y/Z不含）**`.position + dragLocalDelta` [SimScene.tsx:826-830, 1452-1457] | 同上`.quaternion`（shaftRoll post-multiply込み） | **不一致（dragOffsetX/Y/Z≠0の場合）** | `evaluateDragCandidate()`は`lateralOffset`等の生propのみを使い、`dragOffsetX/Y/Z`を加算しない。Rendering側は加算する。既に確定済みのdragOffsetがある状態で新たなDrag/Depthを行うと、Collision判定はRendering上の実際の位置とは異なる（dragOffsetX/Y/Z分ずれた）基準点で行われる。 |
| Rotate（Shift+矢印キー/マウスRotate） | `computeProsthesisModelPose(..., angleTilt, angleTiltZ)`（dragOffsetX/Y/Z込み） | 同上 | `composeRotationCandidatePose()`: `computeProsthesisModelPose(lateralOffset+dragOffsetX, verticalOffset+dragOffsetY, anteriorOffset+dragOffsetZ, candidateAngleTilt/Z)` [SimScene.tsx:889, 1495-1498] | 同上`.quaternion`（shaftRoll込み） | **一致**（Position計算式がRenderingと同一。角度のみが候補値） | `evaluateRotationCandidate()`は`dragOffsetX/Y/Z`を明示的に加算している（composeRotationCandidatePoseの引数）。X/Y/Z Drag用のcomposeDragCandidatePoseとは対照的に、こちらは正しくRendering基準と一致させている。 |
| Shaft Roll | `pose.quaternion * Roll(shaftRollDeg)`（Y軸post-multiply） | 同上 | Collision候補評価自体が存在しない（Shaft Roll単独をゲートする関数がない） | — | **N/A（判定なし）** | Shaft Roll変更時にCollision判定を行う専用コードパスが存在しない（`rotateShaftRoll`はstore直書き、clampAngleDegのみ）。ただし`shaftRollDeg`は他操作（X/Y/Z Drag・Rotate）のCollision候補計算に入力として使われる（composeDragCandidatePose/composeRotationCandidatePoseの引数）。 |
| Pointer Drag | X/Y/Zと同一（Pointer DragはTranslationの一実装） | 同上 | 同上（composeDragCandidatePose、dragOffsetX/Y/Z不含） | 同上 | **不一致（dragOffsetX/Y/Z≠0の場合）** | 上記X/Y/Zと同じ根拠。 |
| Depth | X/Y/Zと同一の`evaluateDragCandidate()`を呼ぶ（SimScene.tsx:1101） | Depth Session中はfrozen snapshot | composeDragCandidatePose（dragOffsetX/Y/Z不含） | 同上 | **不一致（dragOffsetX/Y/Z≠0の場合）** | 同上。DepthはPointer Drag/X/Y/Zと同一のevaluateDragCandidate()を共有しているため、同じ不一致を継承する。 |

**不一致の分類**:
- 既存仕様 or 実装上の差異: **UNKNOWN**（コードコメント上、composeDragCandidatePoseがdragOffsetX/Y/Zを
  含まない設計が意図的か見落としかを示す記述は見つからなかった。一方、composeRotationCandidatePoseの
  コメント[SimScene.tsx:1471-1474]は「dragOffsetX/Y/Zを含める」ことを明示的に理由付けしており、
  Drag側だけこれが欠けている非対称性は設計意図の記述が非対称であることを示唆する）。
- 安全性への影響: Collision判定が実際の描画位置より`(dragOffsetX, dragOffsetY, dragOffsetZ)`
  だけズレた基準点で行われるため、**実際には衝突する位置への移動をCollision Constraintが
  誤って許可する（false negative）、または逆に衝突しない位置への移動を誤ってブロックする
  （false positive）可能性がある**。ズレの最大値は±3mm（dragOffsetの許容範囲）で、D節の実測
  （1mmあたり9〜20°のQuaternion変化）から類推すると、Quaternion側の誤差は無視できない大きさ
  になりうる。これは事実の指摘のみであり、実際の発生条件（dragOffsetX/Y/Zが同時に0でない状態で
  新規Drag/Depthを開始する頻度）・深刻度の評価はArchitect判断に委ねる。

---

## K. User Intent vs Current Implementation

| 操作 | 現在の実装軸 | 座標系 | 基準点/Pivot | Quaternion変化 | 現在の意味 | ユーザー意図との一致 | 判定 |
|---|---|---|---|---|---|---|---|
| X | `base.x += lateralOffset+dragOffsetX` | coordGroupRef-local（Anatomical、World空間に対し[π,-π/2,0]回転） | basePos（STAPES_HEAD/FOOTPLATE、固定ランドマーク） | **あり**（D節、実測9.18°/mm） | 「基準点から見た内外側方向への平行移動」だが、target(UMBO_POS)が固定のため副作用としてProsthesisの向きも変わる | UNKNOWN | **UNKNOWN / Architect Decision Required** |
| Y | `base.y += verticalOffset+dragOffsetY` | 同上 | 同上 | **あり**（19.57°/mm） | 同上（上下方向） | UNKNOWN | **UNKNOWN / Architect Decision Required** |
| Z | `base.z += anteriorOffset+dragOffsetZ` | 同上 | 同上 | **あり**（18.39°/mm） | 同上（前後方向） | UNKNOWN | **UNKNOWN / Architect Decision Required** |
| Depth | Camera view方向をcoordGroupRef-localへ変換した上でX/Y/Zと同一フィールドへ加算 | Camera World Space → coordGroupRef-local | 同上 | **あり**（X/Y/Zと同じ仕組みを経由するため） | 「画面奥/手前への移動」だが実装上はX/Y/Zのいずれか（カメラ向き依存）に射影される | UNKNOWN | **UNKNOWN / Architect Decision Required** |
| Rotate | `base→target` alignment quaternion(quat0)のEuler(XYZ)分解のX/Z成分にtiltX/tiltZを加算し再合成 | quat0依存（World/Local/Umbo/Shaft/Cameraいずれとも数学的に非一致、E節） | Rootのposition（`mid`、シャフト中点） | （定義上、回転操作そのもの） | 「前後傾斜/左右傾斜」という名前だが、実際に動く軸はUMBO方向（＝X/Y/Z Translationにも依存）によって変化しうる | UNKNOWN | **UNKNOWN / Architect Decision Required** |
| Shaft Roll | Rootのlocal+Y軸（シャフト長軸）まわりのpost-multiply回転 | Prosthesis-local（F節で幾何学的に確認済み） | Rootのposition（`mid`） | Quaternionのみ変化、Positionは不変（F節数値検証済み） | 「シャフトを軸に回す」という名前と実装が一致（Prosthesis-local回転） | UNKNOWN（ただしF節の数学的性質はユーザー期待「シャフト軸まわりに回る」と整合的） | **UNKNOWN / Architect Decision Required**（数学的性質は期待と整合するように見えるが、確定にはユーザー意図の直接確認が必要） |
| Pointer Drag | X/Y/Zと同一（Screen→World Plane交点→coordGroupRef-local） | Screen→World→coordGroupRef-local | dragGroupRef原点（H節、Prosthesis実位置とは別点の可能性） | X/Y/Zと同じ仕組みを経由するためあり | 「掴んで動かす」直感的操作、内部的にはX/Y/Zと同じdragOffset書き込み | UNKNOWN | **UNKNOWN / Architect Decision Required** |

Task §17の指示通り、「ユーザー意図との一致」列はコードから推測せず全てUNKNOWNとした。

---

## L. Architecture Assessment

### LOCAL FIX（既に対応済み、または局所的原因に起因）
- **D-4-A（basePos参照不安定性によるDepth Freeze機能不全）**: `basePos={basePos.clone()}`が
  毎レンダー新規参照を生成し、`endDepthSession`のuseCallback依存配列を毎レンダー変化させ、
  Rotate/Shaft Roll監視effectを誤発火させていた。原因はReactのidentity/依存配列管理という
  局所的なもので、Coordinate System自体の設計とは無関係。`basePosRef`によるミラーリングで
  修正済み（commit 871b1c5）。→ **LOCAL FIX（React dependency instability）**。

### SYSTEMIC MANIPULATION AXIS ISSUE（座標系設計そのものに起因する特性）
- **D節: Translation→Quaternion Coupling**: `angleTilt=angleTiltZ=0`の場合、Quaternionは
  完全に`base`（basePos+offset群）と固定の`target`（UMBO_POS）の相対位置のみで決定される設計。
  これはbug修正では解消できない、Pose生成方式（`computeCurrentAxisAlignmentOrientation`、
  "base→target常時再アライメント"）そのものの性質である。
- **E節: Rotate Axis**: `angleTilt`/`angleTiltZ`は単一の名前を持つ回転軸に分解できない
  （World/Local/Umbo/Shaft/Cameraいずれとも数学的に非一致）。Euler角の成分修正→再合成という
  手続き上の設計に起因し、`base`（＝Translation操作）が変わるとRotateの実効的な意味も変わる
  （C/D/E節の相互依存）。
- **J節: composeDragCandidatePose/composeRotationCandidatePoseの非対称性**: Drag/Depth系の
  Collision候補計算だけがdragOffsetX/Y/Zを含めておらず、Rotate系は含めている。これは
  「複数のCandidate Pose計算関数が同じRendering式を独立に再実装している」というアーキテクチャ上の
  構造（DRY違反）に起因する副作用であり、個別のtypoというよりは「Candidate Pose計算をComponent外
  で複製する」という設計パターンそのものに内在するリスクだと考えられる。

**総合判定**: D-4-A（Depth Freeze不具合）は個別修正で解消済み（LOCAL FIX）だが、
**Translationが常にQuaternionへ波及する設計、およびRotate軸が単一の物理的軸に対応しない設計は
SYSTEMIC（Coordinate System自体の性質）である。** また、J節で確認したCollision候補計算の
非対称性も、複数箇所での式の重複というアーキテクチャ上の構造に起因する（SYSTEMIC寄り）。

---

## M. Architect Decision Required

1. **Translation（X/Y/Z/Depth/Pointer Drag）がQuaternionを変化させる現行設計を維持するか。**
   ユーザーが「平行移動のみ」を意図している場合、現行実装（base→target再アライメント方式）は
   その意図と構造的に相容れない（D節）。
2. **Rotate（angleTilt/angleTiltZ）の回転軸をWorld軸・Local(Shaft)軸・現行のEuler再合成方式の
   いずれにするか。** 現行方式は3者いずれとも数学的に一致しない（E節）。
3. **composeDragCandidatePose()にdragOffsetX/Y/Zを含めるべきか。** 現行はcomposeRotationCandidatePose()
   とは非対称に除外されている（J節）。含める設計に変更する場合、Rendering/Collisionの一致性が
   改善するが、Collision Constraintの挙動（許容/拒否の境界）が変化するため、既存のCollision
   Constraint合格基準（Phase C-2〜C-8で確定済み）への影響評価が必要。
4. **Depth（Camera-relative）が実際に動かす解剖学的軸（dragOffsetX/Y/Z）がカメラ向きに応じて
   切り替わる現行の挙動（G節）を意図通りとするか。** 「Depth＝常に特定の解剖学的軸（例:
   anterior-posterior）」という体験を期待している場合、現行のCamera-relative実装とは異なる。
5. **Pointer DragのDrag-Plane通過点（dragGroupRef原点、Prosthesis実位置とは別点）がドラッグ感度に
   与える影響（H節）を評価不要と判断してよいか、実機確認が必要か。**
6. **Shaft Rollに対するCollision Constraintを新設するか。** 現行はShaft Roll単独の衝突判定が
   存在しない（J節）。

---

## N. Final Conclusion

```
D-4-A Bug
= FIXED（commit 871b1c5、basePosRefによるReact依存配列安定化。原因はReact identity管理の
  局所バグであり、Coordinate System設計とは無関係。LOCAL FIX。）

Depth Freeze
= VERIFIED（コードレベルで確認: depthSessionQuatによるQuaternion固定[SimScene.tsx:659,
  1120-1130]、endDepthSession()による終了判定[SimScene.tsx:721-749]、dragOffset不変条件チェック
  [SimScene.tsx:1247-1258]、Rotate/ShaftRoll監視[SimScene.tsx:1231-1237]がいずれも設計通りに
  実装されていることを静的に確認済み。実機での視覚的検証は本Investigationのスコープ外
  ——Task指示により実装検証は行っていない。）

Translation Axis
= dragOffsetX/Y/Z は coordGroupRef-local 座標系（解剖学的lateral/vertical/anterior軸として運用）
  で `base` に直接加算される。Prosthesis自身の向き（angleTilt/angleTiltZ/shaftRollDeg）には
  非依存（Prosthesis-localではない）。[C節]

Translation → Quaternion Coupling
= YES。数値実測: X/Y/Z 各+1mmの単独Translationで9.18°/19.57°/18.39°のQuaternion変化
  （BELL-type、実際のOssicleModels.tsx座標定数を使用した計算）。原因: base→target(UMBO_POS固定)
  の再アライメント方式そのもの。[D節]

Rotate Axis
= World軸・Local(Shaft)軸・Umbo方向・Camera軸のいずれとも数学的に一致しない、独立した
  第三の変換（base→target alignment quaternionのEuler XYZ成分修正→再合成）。実測:
  local post-multiply仮説との角度差15.24°、world pre-multiply仮説との角度差4.79°。[E節]

Shaft Roll Axis
= Prosthesisのlocal +Y軸（シャフト長軸そのもの、ジオメトリ階層で幾何学的に確認済み）まわりの
  post-multiply回転。Positionは不変、Quaternionのみ変化（数値検証済み）。[F節]

Depth Axis
= camera.getWorldDirection()をParent(coordGroupRef)-local化した方向ベクトル。カメラ向きに
  応じて実際に動くdragOffsetX/Y/Zの軸自体が切り替わる（実測例: World -Z注視→X軸、-X注視→Z軸、
  -Y注視→Y軸）。[G節]

Pointer Drag Axis
= Screen Space → (Raycast+Plane交点)World Space → coordGroupRef-local。Drag-Plane通過点は
  dragGroupRef原点（Prosthesis実位置とは異なる可能性のある点）。[H節]

Rendering / Collision Consistency
= 不一致あり。X/Y/Z Translation・Depth・Pointer Drag（いずれもevaluateDragCandidate/
  composeDragCandidatePoseを共有）は既存dragOffsetX/Y/Zを候補姿勢計算に含めておらず、
  Rendering基準からズレる（dragOffsetX/Y/Z≠0の場合）。Rotateはこのズレがない（正しく
  dragOffsetX/Y/Zを含めている）。Shaft Rollには専用のCollision判定自体が存在しない。[J節]

Manipulation Architecture
= 個々のバグ（D-4-A）はLOCAL FIXで解消済みだが、Translation→Quaternion Coupling・Rotate軸の
  非単一性・Candidate Pose計算の非対称性は、いずれもCoordinate System / Candidate Pose計算方式
  自体に起因する SYSTEMIC MANIPULATION AXIS ISSUE である。[L節]

Architect Decision Required
= (1) Translation→Quaternion Coupling設計の維持可否
  (2) Rotate回転軸の定義（World/Local/現行Euler再合成のいずれか）
  (3) composeDragCandidatePose()へのdragOffsetX/Y/Z包含可否
  (4) Depthのカメラ相対軸切り替え挙動の維持可否
  (5) Pointer Drag-Plane通過点のズレの実害評価要否
  (6) Shaft Roll用Collision Constraint新設の要否
  [M節]
```

---

## 検証ログ

開始時（Baseline確認）:
```
$ git status && git log -1 && git diff && git diff --check
→ HEAD = 871b1c5926dd73d6bf5f823dfe6785f2aabc900a
→ Working Tree = CLEAN（tracked filesの差分なし）
→ Untracked files: .claude/, .mcp.json, .serena/, _softclip_split_backup/,
  docs/D1_*.md ×2, eac_topology_check.py, serena-mcp.ps1（調査開始前から存在、対象外）
```

数値Evidence生成に使用した一時スクリプト（Node.js + three.js、`computeCurrentAxisAlignmentOrientation`
/ `computeCurrentAxisAlignmentPose` / `computeProsthesisModelPose`のロジックをコードから直接
書き写して実行、Frozen対象の本体コードは一切変更していない）は検証後に削除済み。

終了時:
```
$ git status --porcelain
→ 開始時と同一（untracked filesのみ、tracked filesの変更なし）
Implementation Changes = NONE
Commit = NONE
Push = NONE
Working Tree = unchanged
```
