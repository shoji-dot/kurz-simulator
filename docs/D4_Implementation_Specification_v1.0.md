# D-4 Implementation Specification — Manipulation Axis / Canonical Pose / Collision Candidate

Status: **Implementation Readiness = READY**（Section 22-24参照。**Decision 3=APPROVE
（後続Task、shoji実機確認完了。Section 20 Gate結果参照、ANGLE_TILT_SIGN/ANGLE_TILT_Z_SIGN
反転は不要と判明）**）。**D-4 Implementation Code = COMPLETE済み
（HEAD=871b1c5に対する作業ツリー、Commit/Pushなし）。Post-Implementation Review（Finding 1〜4）
を経て本書Section 3.3・11.3・18.1・24を更新（Architect Decision Section 23 Decision 10連動、
Decision 10は`APPROVED`——shojiさんにより正式承認済み、Architect Decision Section 23.7参照）。
現在の実装済みコードはSection 24項目4・5（fail-closed null分岐、ControlPad Availability Gate）
を未反映——Decision 10承認により次のImplementation Taskで対応可能な状態になった。それ以外の
本書記載内容とは一致している（Post-Implementation Review Confirmed項目参照）。**

Baseline: `HEAD = 871b1c5926dd73d6bf5f823dfe6785f2aabc900a`

Upstream authority（本書はこれに従う。矛盾があれば下記が優先し、本書側を訂正する）:
```
docs/D4_Architect_Manipulation_Axis_Pose_Semantics_Decision_v1.0.md（FINALIZED）
```

Final Decision（再掲、変更しない）:
```
1 Translation              = APPROVE — Position-only
2 Base Alignment Timing    = APPROVE — Placement Commit時固定
3 Rotation R4               = APPROVE（後続Task、shoji実機確認完了。Section 20 Gate結果参照。
                               元は"PENDING REAL-DEVICE CONFIRMATION"だったが解消済み）
4 Depth                     = APPROVE — Camera-relative Position-only
5 Shaft Roll                = APPROVE — Current Semantics
6 Pointer Drag               = APPROVE — Screen-space
7 Canonical Pose Generator  = APPROVE — Single Source of Truth
8 D-2 Migration              = APPROVE — Option A（Strategyのみ、実行は別工程）
9 Freeze/Slerp               = APPROVE REMOVE（方針のみ、削除は別工程）
```

---

## 1. Repository Investigation Summary

実装対象コードの現在地（すべて既存Investigation済み、本Taskで再確認・変更なし）。

### 1.1 Pose / Manipulation関連

| シンボル | 所在 | 役割 |
|---|---|---|
| `PlacementState` | `src/store/useSimStore.ts:12-22` | `selectedLength, lateralOffset, anteriorOffset, verticalOffset, angleTilt, angleTiltZ, dragOffsetX, dragOffsetY, dragOffsetZ` |
| `interactionShaftRollDeg` | `useSimStore.ts`（PlacementState外、別store field） | Shaft Roll、Safety/Score非参照 |
| `translateSelectedObject` | `useSimStore.ts:205-210` | `dragOffsetX/Y/Z += delta`、`clampDragOffsetMm`（±3mm）のみ。**Collision Candidate評価を一切呼ばない** |
| `rotateSelectedObject` | `useSimStore.ts:212-217` | `angleTilt/angleTiltZ += delta`、`clampAngleDeg`（±180°）のみ |
| `rotateShaftRoll` | `useSimStore.ts:219-221` | `interactionShaftRollDeg += delta` |
| `basePos` | `src/scenes/SimScene.tsx:1535-1538` | `surgicalCase.ossicularStatus.stapes`と`product.footType`から`STAPES_HEAD`/`STAPES_FOOTPLATE`を選択する派生値（React算出、storeには持たない） |
| `computeProsthesisModelPose()` | `src/scenes/models/ProsthesisModels.tsx:1742-1762` | Rendering/一部Candidateが呼ぶ現行Pose生成関数。`base = basePos+offsets`→`dir=normalize(target-base)`→Euler XYZ再合成でQuaternion決定 |
| `computeCurrentAxisAlignmentOrientation/Pose` | `ProsthesisModels.tsx:1641-1693` | 上記の下位関数。回転部分(1641-1662)と位置部分(1679-1693)に分離済み |
| `DraggableProsthesis` | `SimScene.tsx:621-1403` | Placement段階の描画・操作コンポーネント本体 |
| `ManipulationLayer.tsx` | `src/scenes/transport/ManipulationLayer.tsx` | Transport段階（`TransportProsthesis`/`DirectTransportProsthesis`）、`transportPose`/`transportTilt`、`useScreenSpaceDrag`（277-341）、`commitTransportPoseToOffsets`（226-236） |
| `transportPose` / `transportTilt` | `SimScene.tsx:1560-1620`（React local state） | Commit前の一時Pose。`transportPose.position`は`basePos`起点の絶対座標、`transportTilt.tilt/tiltZ`は独立数値 |

### 1.2 Candidate生成

| シンボル | 所在 | 現状の問題 |
|---|---|---|
| `composeDragCandidatePose()` | `SimScene.tsx:1439-1464` | `lateralOffset/anteriorOffset/verticalOffset`（生propsのみ）＋`dragLocalDelta`のベクトル加算。**`dragOffsetX/Y/Z`を含まない**（D4-B Integrity Audit A節） |
| `composeRotationCandidatePose()` | `SimScene.tsx:1478-1506` | `dragOffsetX/Y/Z`を正しく加算（対称性の欠如を示す唯一の正しい実装） |
| `evaluateDragCandidate()` | `SimScene.tsx:815-866` | `composeDragCandidatePose()`→`buildProsthesisCollisionProxy()`→`testCollision()`。Pointer Drag（925-945、useFrame 1273-1285）・Depth（1101）が呼ぶ |
| `evaluateRotationCandidate()` | `SimScene.tsx:879-920` | `composeRotationCandidatePose()`→同上。Shift+矢印キー（1168）・マウスRotate Mode（988,1000）が呼ぶ |
| `translateSelectedObject()`（再掲） | `useSimStore.ts:205-210` | Arrow-key（`SimScene.tsx:1178`）・ControlPad（`ControlPad.tsx:74`）が直接呼ぶ。**Candidate評価を経由しない**（D4-B Runtime Verification 4.1節で実runtime確定） |

### 1.3 Depth / Freeze / Slerp（D-4 Option①/②、Decision 9の削除対象特定）

| シンボル | 所在 | 内容 |
|---|---|---|
| `depthSessionQuat`（state） | `SimScene.tsx:659` | Depth押下中に固定するQuaternionのsnapshot |
| `depthSessionQuatRef` | `SimScene.tsx:663` | 同期読み取り用ミラーref |
| `depthLastOffsetRef` | `SimScene.tsx:669` | 他経路によるdragOffset書き換え検知用 |
| `depthSessionActiveRef` | `SimScene.tsx:675` | 監視effect用のガードref |
| `endDepthSession()` | `SimScene.tsx:721-749` | Depth Session終了処理（Freeze解除、Slerp開始） |
| `releaseInterp`（state） | `SimScene.tsx:687-694` | Release後200ms slerp補間の`{fromQuat, toQuat, progress}` |
| `releaseInterpActiveRef` / `releaseInterpStartRef` | `SimScene.tsx:692, 694` | Slerp進行管理 |
| `cancelReleaseInterpolation()` | `SimScene.tsx:753-758` | 別操作開始時にSlerpを打ち切る |
| PageUp/PageDown keydown本体 | `SimScene.tsx:1075-1148` | Depth Session開始（1120-1136）を含む |
| PageUp/PageDown keyup | `SimScene.tsx:1181-1196` | `endDepthSession(true)`（自然なRelease） |
| Rotate/ShaftRoll監視effect | `SimScene.tsx:1231-1237` | 他操作開始検知→`endDepthSession(false)`/`cancelReleaseInterpolation()` |
| dragOffset不変条件監視effect | `SimScene.tsx:1247-1258` | 同上（dragOffset経由） |
| useFrame（Slerp進行） | `SimScene.tsx:1305-1318` | `releaseInterp.progress`を毎フレーム進める |
| `depthPoseOverride` | `SimScene.tsx:1331-1353` | Depth Session中/Slerp中のQuaternion上書き |
| `RELEASE_INTERP_DURATION_MS` | `src/scenes/transformControlsConfig.ts:48` | Slerp所要時間定数（200ms） |

**この一覧が、Section 14（Freeze/Slerp Removal Specification）で「削除対象」として参照する
全リストである。** 今回は削除しない（Section 18 Implementation Scope参照）。

### 1.4 Collision

| シンボル | 所在 |
|---|---|
| `testCollision()` | `src/engine/collision/collisionTest.ts:38-68`（`MeshBVH.intersectsSphere/intersectsBox`直接呼び出し） |
| `buildProsthesisCollisionProxy()` | `src/engine/collision/prosthesisCollisionGeometry.ts:143-`（Shaft/Foot=Sphere、HeadPlate=OBB） |
| `useAnatomyCollisionIndex()` | `src/engine/collision/anatomyCollisionIndex.ts:89-106`（Bone/Malleus/Stapes GLB+MeshBVH、Reactフック） |
| `FOOT_CONTACT_TOLERANCE_MM` | `prosthesisCollisionGeometry.ts:81`（0.15mm） |
| `COLLISION_CONSTRAINT_ENABLED` | `transformControlsConfig.ts:54`（kill-switch、既存） |

### 1.5 D-2

| シンボル | 所在 |
|---|---|
| `CasePlacementSnapshot` | `src/engine/groundTruth/exportGroundTruth.ts`（型定義）、`{lateralOffset, anteriorOffset, verticalOffset, angleTilt, angleTiltZ}`の5数値のみ、Quaternionは含まない |
| `buildPlacementSnapshot()` | `exportGroundTruth.ts:76-84` |
| `currentPlacementSnapshot` | `SimScene.tsx:1631-1639` |
| `resolveIdealLateralOffset/resolveIdealAngle` | `src/data/cases.ts:82-91` |
| `computeScore()` | `useSimStore.ts:237-`（`angleDiffX = |angleTilt - idealAngle|`、`angleDiffZ = |angleTiltZ|`、Quaternion非参照） |
| `idealAngle`（12症例、5症例が非0） / `startPlacement`（3症例、`case-012/013/014`、`angleTilt=-86.00, angleTiltZ=0.00`） | `src/data/cases.ts` |

---

## 2. Canonical Pose Contract

### 2.1 目標Architecture（再掲、Architect Decision Section 10.3・11.2準拠）

```
User Input（Pointer / Arrow / ControlPad / Depth / Rotate / Shaft Roll）
    ↓
Manipulation Intent（Section 10、種別ごとの正規化済みdelta）
    ↓
Canonical Pose Generator（resolveCanonicalPose()、本書での命名）
    ↓
Canonical Pose（Position + Quaternion）
    ├── Rendering（そのまま使用）
    └── Collision Candidate（同一関数・同一入力形状で評価用に再計算）
```

### 2.2 Canonical Poseの構成要素

```ts
interface CanonicalPose {
  position:   THREE.Vector3;   // ワールド座標系ではなく coordGroupRef-local（Anatomical Frame）
  quaternion: THREE.Quaternion; // 同上
}
```

**Position**: `basePos`（Case+Product解決で決まる読み取り専用アンカー、Section 1.1）を起点に、
確定済み`dragOffsetX/Y/Z`（＋レガシーの`lateralOffset/anteriorOffset/verticalOffset`スライダー値、
無変更のまま維持）を単純加算した点。Decision 1（Position-only）採用後は、**この加算だけで
Positionが完全に決まり、Quaternion計算とは独立**になる（現行のように`dir=normalize(target-base)`
を経由しない）。

**Quaternion**: 以下3層構成（Architect Decision Section 6.3の式をそのまま踏襲）。

```
Quaternion
  = [ Rx(angleTilt, AnatomicalFrame) * Rz(angleTiltZ, AnatomicalFrame) * BaseAlignmentQuaternion ]
    * Roll(shaftRollDeg, Local+Y)
```

- `BaseAlignmentQuaternion`: Section 3で定義するPlacement Commit時に一度だけ確定する値。
  Translation（Position側の加算）には一切影響されない。
- `Rx(angleTilt)*Rz(angleTiltZ)`: Decision 3（PENDING）の範囲。**数式のみCONFIRMED**、
  符号・見た目はUNKNOWN（Section 5）。
- `Roll(shaftRollDeg, Local+Y)`: Decision 5（現状維持）、既存の`quaternion.multiply(RollY)`と
  同一式（`ProsthesisModels.tsx:1796-1800`, `SimScene.tsx:1458-1462`, `SimScene.tsx:1500-1504`の
  3箇所重複を、本仕様のCanonical Pose Generator内へ一本化する）。

### 2.3 Source of Truthの強制（MUST）

```
MUST: Rendering呼び出しとCollision Candidate呼び出しは、同一の関数
      （resolveCanonicalPose()、Section 4で定義）を、同一の合成順序で呼ぶこと。
MUST NOT: Rendering用とCollision用に別々の近似式（現行のcomposeDragCandidatePose()の
      ようなベクトル加算による線形近似）を新規に作らないこと。
MUST NOT: 新しい`composeXxxPose()`系のヘルパー関数を追加しないこと
      （Architect Decision Section 11.1 P0-7の申し送り事項）。
```

---

## 3. Base Alignment Specification（Decision 2）

### 3.1 状態遷移

```
Transport（manipulation.committed === false）
  → Base Alignment 未確定・不使用
    現行のまま: DirectTransportProsthesisのuseFrame（ManipulationLayer.tsx:539-560）が
    毎フレーム computeProsthesisModelPose({basePos: livePos, angleTilt: transportTilt.tilt,
    angleTiltZ: transportTilt.tiltZ}).quaternion を再計算する。
    根拠: createInitialTransportPose()（ManipulationLayer.tsx:77-82）のコメント
    「Phase1では向きの意味付けは対象外」（ManipulationLayer.tsx:80）。
    → この経路は変更しない（MUST NOT CHANGE、Section 18）。

Transport → Placement Commit（manipulation.committedがfalse→trueへ変わる瞬間）
  → Base Alignment Snapshot確定（新規処理）
    その時点のbase（= basePos + lateralOffset + dragOffsetX 等、Commit直後の値、
    通常dragOffsetX/Y/Z=0）に対して
    computeCurrentAxisAlignmentOrientation({base, target: UMBO_POS（またはUMBO_POS_TORP）,
    angleTilt: 0, angleTiltZ: 0}) を1回だけ評価し、その結果を
    baseAlignmentQuaternion としてPlacementState外の新規stateへ保持する。

Placement（manipulation.committed === true）
  → Base Alignment Immutable
    以降、dragOffsetX/Y/Zがどう変化してもbaseAlignmentQuaternionは再計算しない。
```

### 3.2 現行構造の置き換え方針

現行`computeProsthesisModelPose()`（`ProsthesisModels.tsx:1742-1762`）は「呼ぶたびに
`base`から`dir`を再計算する」という純粋関数の性質を維持したまま**変更しない**
（Architect Decision Section 11.1-2の通り、責務追加はラッパー側で行う）。

新設する`resolveCanonicalPose()`（Section 4）は、Placement段階では
`computeCurrentAxisAlignmentOrientation()`を**Commit時にのみ**呼び、以降は
保持済み`baseAlignmentQuaternion`をそのまま使う。Transport段階では従来通り
`computeProsthesisModelPose()`を毎フレーム呼ぶ経路（変更なし）を維持し、
`resolveCanonicalPose()`はPlacement段階専用として新設する（Transport用の別経路と
Placement用のCanonical Pose Generatorは、意図的に共有しない——Architect Decision
Section 5.3の「Transport段階はOption C/R4の対象外」という結論に従う）。

### 3.3 新規State

```ts
// PlacementState本体には含めない（Architect Decision Section 11.3 State/Candidate
// 責務分離表の通り、既存PlacementStateフィールドを拡張しない）。
baseAlignmentQuaternion: THREE.Quaternion | null   // null = 未Commit（Transport中）
```

**所有者**: PlacementState外の独立したReact local state（`interactionShaftRollDeg`と同じ
並置パターン、SimScene.tsx側で保持。Zustand storeへ入れるかコンポーネントlocal stateに
するかは実装Task側の裁量、MAY CHANGE）。

**ライフサイクル（MUST、`manipulation.committed`の遷移そのものに同期させる）**:
```
manipulation.committed: false → true（Transport→Placement Commit）
  → baseAlignmentQuaternion を Section 3.1 の式で1回だけ計算・書き込む

manipulation.committed: true のまま
  → baseAlignmentQuaternion は不変（再計算しない、MUST NOT）

manipulation.committed: true → false（何らかの理由でPlacementからTransportへ戻る場合）
  → baseAlignmentQuaternion を null へリセットする（MUST）
```
この「`manipulation.committed`のfalse→true/true→falseそれぞれに対称的に同期させる」という
ルールを唯一の正とすることで、「症例変更時」「製品変更時」「Placement段階からの
戻り操作時」等、reset契機を個別に列挙する必要がない（個々のUIイベントを網羅的に洗い出す
より、`manipulation.committed`という既存の単一の真偽値に同期させる方が取りこぼしがない）。

**Case変更時のreset**: `setSelectedCase()`（`useSimStore.ts:187-196`）はPlacementStateを
`dragOffsetX/Y/Z=0`等へ丸ごとリセットする。`manipulation.committed`自体の値はZustand store外
（コンポーネントlocal state、SimulationMode.tsx `PlacementStep`）にあるため、Case変更が
`manipulation.committed`をfalseへ戻すかどうかは、**D-4 Implementation Task（コード実装）で
調査・確認済み**: `PlacementStep`コンポーネント自体がPlacement Step以外のsimStepへ遷移すると
アンマウントされ（`manipulationCommitted`を含む全local stateが破棄される）、再訪時は
`false`から再開する。したがって`manipulation.committed===true`を維持したままCase変更が発生する
経路は現行UIに存在しない（**確認済み、Architect Decision Section 23 Decision 10参照**）。
**MUST（安全側フォールバック、Decision 10により維持）**: 上記にもかかわらず、`setSelectedCase()`
のタイミングで`baseAlignmentQuaternion`も明示的にnullへリセットする処理を追加すること
（`manipulation.committed`の遷移待ちにしない）——単一ファイルの構造への依存だけに安全性の
根拠を置かないための多重防御（defense-in-depth）として維持する。

**Product変更時のreset**: `setSelectedProduct()`（`useSimStore.ts:197`）はPlacementStateを
リセットしない（コード確認済み）。現在のUIフロー（Case選択→適応判断→製品選択→サイズ→
配置調整→評価、`SimulationMode.tsx`の`ProductSelect`）では、製品選択はPlacement到達前の
独立したwizard stepであり、**D-4 Implementation Task／Post-Implementation Reviewで確認済み**:
`SimulationMode.tsx`のPlacement Stepには既存の「← 戻る」ボタン（product-selectへ戻る）が
あるが、これも`PlacementStep`自体のアンマウントを伴うため、`manipulation.committed===true`を
維持したままProductだけが変わる経路は同様に存在しない。`StepFlowMode.tsx`についても、
`flowCase`/`flowProduct`が別のCase/Productへ再代入される経路は`<SimScene>`が未マウントの
Flow Setup時に限定されることを確認済み（Architect Decision Section 23.3参照）。
**MUST（安全側フォールバック、Decision 10により維持）**: Case変更と同様に、
`setSelectedProduct()`のタイミングでも`baseAlignmentQuaternion`を明示的にnullへリセットする
処理を追加すること——同じくdefense-in-depthとして維持する。

**Decision 10（Architect Decision Section 23、次のImplementation Taskへの必須申し送り）**:
`manipulation.committed===true`のままCase/Productが変わる経路は、上記の通りUI構造上到達しない
ことがArchitecture上の前提として確定した（Decision 10）。したがって
`baseAlignmentQuaternion===null`かつ`manipulation.committed===true`という状態は、
「安全に処理すべき通常のtransient state」ではなく**「invariant違反（到達してはならない
bug状態）」**として扱う。
```
MUST（次のImplementation Task）: evaluateDragCandidate() / evaluateRotationCandidate() /
  evaluateShaftRollCandidate()（またはそれらの実装上の後継）は、baseAlignmentQuaternionが
  nullの場合、現行実装（D-4 Implementation Code、Post-Implementation Review Finding 1で
  指摘）のfail-open（制約なし=collision-freeとしてtrueを返す）ではなく、
  fail-closed（候補を拒否する=collided相当としてfalseを返す）としなければならない。
MUST NOT: 上記の変更にあたり、Section 3.3のnullリセットMUST自体は撤回しない
  （Decision 10はこのMUSTの正しさを追認するものであり、置き換えるものではない）。
MUST NOT: この変更にあたり、`manipulation.committed`のownership（SimulationMode.tsx／
  StepFlowMode.tsx側）を変更しない（Decision 10により、その変更は不要と判断されたため）。
  変更対象はSimScene.tsx内のCandidate評価関数群のnull分岐のみに限定される。
```

**Save Start Positionとの関係**: 変更なし。`currentPlacementSnapshot`（`SimScene.tsx:1631-1639`）
は`baseAlignmentQuaternion`を一切参照せず、`lateralOffset/anteriorOffset/verticalOffset/
angleTilt/angleTiltZ`の5数値のみをコピーする（Section 1.5）。この5数値の意味は
Decision 1/3の下でも変わらない（数値そのものはそのまま、解釈方法だけが
`resolveCanonicalPose()`側で変わる）ため、Save Start Positionボタン自体はMUST NOT CHANGE。

**Save Ideal Positionとの関係**: 同上、MUST NOT CHANGE。

**Transport Poseとの関係**: 独立（Section 3.1参照、Transport段階は`baseAlignmentQuaternion`を
一切参照しない）。

**PlacementStateとの関係**: `baseAlignmentQuaternion`はPlacementStateの外側にあるが、
PlacementStateのCommit操作（`manipulation.committed`）と厳密に同期するライフサイクルを持つ
「PlacementStateに付随する派生state」である。

---

## 4. Canonical Pose Generator — 関数仕様

### 4.1 シグネチャ（Architect Decision Section 11.2を実装可能な形へ具体化）

```ts
interface CanonicalPoseCommittedInputs {
  product: KurzProduct;
  shaftLength: number;
  basePos: THREE.Vector3;
  lateralOffset: number;
  anteriorOffset: number;
  verticalOffset: number;
  dragOffsetX: number;
  dragOffsetY: number;
  dragOffsetZ: number;
  angleTilt: number;
  angleTiltZ: number;
  shaftRollDeg: number;
  baseAlignmentQuaternion: THREE.Quaternion;  // Section 3、Placement段階では必須（nullは不可）
}

type CanonicalPoseCandidateDelta =
  | { kind: 'translate'; localDelta: THREE.Vector3 }               // Pointer Drag / Depth / Arrow / ControlPad
  | { kind: 'rotate'; axis: 'tilt' | 'tiltZ'; candidateAngle: number } // Shift+矢印 / Rotate Mode / ControlPad
  | { kind: 'shaftRoll'; candidateAngle: number };                  // 新規、Requirement 4

function resolveCanonicalPose(
  committed: CanonicalPoseCommittedInputs,
  candidate?: CanonicalPoseCandidateDelta,
): CanonicalPose;
```

**`candidate`の意味（曖昧さ排除のため明示、Task Review §4/§5への回答）**:
```
candidate は「Manipulation Intentのうち、まだcommitされていない評価対象の変化分」を表す。
排他的discriminated union（同時に複数kindを持てない、1回の評価は必ず1種類の操作のみを対象とする
——現行のevaluateDragCandidate/evaluateRotationCandidateも同様に1回1操作である）。

kind: 'translate' の localDelta
  = DELTA（差分）。committed.dragOffsetX/Y/Zに対して加算するベクトルであり、絶対位置ではない。
    （現行のdragLocalDelta、SimScene.tsx:1450と同じ意味論を維持）

kind: 'rotate' の candidateAngle
  = ABSOLUTE VALUE（絶対値）。committed.angleTilt/angleTiltZを置き換える新しい角度そのもの
    であり、差分ではない。呼び出し元（キー押下ハンドラ等）が
    `clampAngleDeg(currentAngle + delta)` のようにdelta適用とclampを済ませた後の値を渡す。
    （現行のevaluateRotationCandidate(axis, candidateAngle)、SimScene.tsx:879と同じ意味論——
    既存コードは既にこの「absolute値を渡す」規約で実装されている、新規ルールではない）

kind: 'shaftRoll' の candidateAngle
  = ABSOLUTE VALUE（絶対値）。上記rotateと同じ規約（新規、Requirement 4）。

candidate省略時（undefined）
  = 「評価中の操作なし」。この場合 resolveCanonicalPose() は committed の値のみから
    Canonical Poseを計算する（= 現在Renderingされているべき値）。
```

### 4.2 committed / candidate フィールド対応表（Task Review §5への回答）

D-4-Bで発生した「既存offsetの二重加算・欠落」を再発させないため、PlacementStateの
各フィールドが`resolveCanonicalPose()`の中でどう扱われるかを一意に定める。

| フィールド | committed（常に渡す値） | candidateで上書き/加算されるか |
|---|---|---|
| `lateralOffset/anteriorOffset/verticalOffset` | PlacementStateの現在値（スライダー起点） | されない（candidateはこれらに影響しない） |
| `dragOffsetX/Y/Z` | PlacementStateの現在値（**確定済み全量**、一部省略しない） | `kind:'translate'`のとき、`committed.dragOffsetX/Y/Z`はそのまま保持され、`candidate.localDelta`が**別項として加算**される（`committed`自体を書き換えない、Position式全体の中で1回だけ加算、二重加算にならない） |
| `angleTilt` | PlacementStateの現在値 | `kind:'rotate', axis:'tilt'`のとき、`committed.angleTilt`を**丸ごと`candidate.candidateAngle`へ置換**（加算ではない） |
| `angleTiltZ` | PlacementStateの現在値 | 同上（`axis:'tiltZ'`） |
| `shaftRollDeg` | 現在値（`interactionShaftRollDeg`） | `kind:'shaftRoll'`のとき、`committed.shaftRollDeg`を丸ごと`candidate.candidateAngle`へ置換 |
| `baseAlignmentQuaternion` | Section 3で確定した値 | candidateの影響を一切受けない（常にcommitted値をそのまま使う） |

### 4.3 内部計算式（擬似コード、実装しない）

```
function resolveCanonicalPose(committed, candidate) {
  // ── Position（Decision 1: target/dirは一切登場しない） ──
  const translateDelta = candidate?.kind === 'translate' ? candidate.localDelta : ZERO_VECTOR;

  const position = committed.basePos.clone()
    .add(vector(committed.lateralOffset + committed.dragOffsetX,
                 committed.verticalOffset + committed.dragOffsetY,
                 committed.anteriorOffset + committed.dragOffsetZ))
    .add(translateDelta);
    // dragOffsetX/Y/Z（既存offset）は必ずcommittedから読み、translateDeltaは別項として
    // 加算するのみ。dragOffsetX/Y/Z自体をtranslateDeltaで置き換えることはしない
    // （二重加算・欠落のどちらも起こり得ない、Section 4.2表参照）。

  // ── Quaternion（Decision 3 CONFIRMED部分の式、Decision 5と合成） ──
  const tiltX = (candidate?.kind === 'rotate' && candidate.axis === 'tilt')
    ? candidate.candidateAngle : committed.angleTilt;
  const tiltZ = (candidate?.kind === 'rotate' && candidate.axis === 'tiltZ')
    ? candidate.candidateAngle : committed.angleTiltZ;
  const roll  = candidate?.kind === 'shaftRoll' ? candidate.candidateAngle : committed.shaftRollDeg;

  // AnatomicalFrameのX/Z軸は coordGroupRef-local 空間そのものの基底ベクトルであり、
  // 追加の座標変換は不要（Vector3(1,0,0) / Vector3(0,0,1) をそのまま回転軸として使う）。
  const quaternion =
    quatFromAxisAngle(AXIS_X, degToRad(tiltX))            // Rx(angleTilt)、outermost（最後に適用）
      .multiply(quatFromAxisAngle(AXIS_Z, degToRad(tiltZ))) // Rz(angleTiltZ)、その内側
      .multiply(committed.baseAlignmentQuaternion)           // BaseAlignment、さらに内側
      .multiply(quatFromAxisAngle(AXIS_Y, degToRad(roll)));  // Roll(shaftRoll)、innermost（最初に適用）
      // 適用順序（vへの作用順、内側→外側）: Roll → BaseAlignment → Rz(tiltZ) → Rx(tiltX)
      // Rx/Rzはいずれもpre-multiply（extrinsic、固定Anatomical軸基準）のため、
      // 「Rxが先かRzが先か」に関わらずそれぞれの回転軸自体は固定Anatomical軸のままだが、
      // 複合結果（両方が同時に非0の場合）は順序に依存する。上記の順序
      // （Rx * Rz * BaseAlignment、Architect Decision Section 6.3の式の通り）は
      // MUST——実装時に左右を入れ替えないこと。

  return { position, quaternion };
}
```

（上記は仕様記述であり実装コードではない。実際の型/関数名/ファイル配置・`quatFromAxisAngle`
等のヘルパー名は実装Task側で決定する。`AXIS_X = (1,0,0)`, `AXIS_Y = (0,1,0)`,
`AXIS_Z = (0,0,1)`はAnatomical Frame自身のローカル基底ベクトル。）

### 4.4 呼び出し規約

```
MUST: Rendering（DraggableProsthesisのJSX、SimScene.tsx:1386-1399相当）は
      resolveCanonicalPose(committed) をcandidate省略で呼ぶ。
MUST: Collision Candidate評価（evaluateDragCandidate/evaluateRotationCandidateの後継）は
      resolveCanonicalPose(committed, candidate) を評価対象のcandidateを渡して呼ぶ。
MUST: committedは常にPlacementStateの現在値＋baseAlignmentQuaternionのフルセットを渡すこと
      （現行composeDragCandidatePoseのように一部フィールドを省略しない、Requirement 2）。
```

---

## 5. Translation Specification（Decision 1）

```
MUST: Translation操作（X/Y/Z、Pointer Drag、Depth、Arrow、ControlPad）は
      resolveCanonicalPose()の {kind:'translate', localDelta} candidateとしてのみ
      Position候補を生成する。Quaternionには一切影響しない
      （4.3式の通り、quaternion計算にcommitted.dragOffsetX等は登場しない）。
```

- **Positionの基準座標系**: `coordGroupRef`-local（Anatomical Frame、D-4 Audit B節で確立）。
  World座標系ではない。
- **Translation offsetの保存場所**: 既存`PlacementState.dragOffsetX/Y/Z`をそのまま使う
  （新規フィールド追加なし、Architect Decision Section 11.3の通り既存ownershipを維持）。
- **`basePos`との関係**: `basePos`は不変の解剖学的アンカー（Section 1.1）。Translationは
  そこからの相対オフセットのみを操作する。
- **±3mm clampとの関係**: `clampDragOffsetMm()`（`useSimStore.ts:148`）・`clamp3()`
  （`SimScene.tsx:1406-1408`）は無変更のまま維持する（MUST NOT CHANGE、Section 18）。
- **Transport/Placementのsemantic差**: Section 3.1の通り、Transport段階のTranslationは
  `transportPose.position`（絶対座標、basePos起点）を直接動かす既存経路のまま
  （変更なし）。Position-only化の対象はPlacement段階のみ。
- **Existing offsetをCandidateに必ず含める方法**: `resolveCanonicalPose()`のcommitted
  引数は常にPlacementStateの現在値（`dragOffsetX/Y/Z`含む）を渡す設計そのものが、
  D-4-Bで確認された「existing offset omission」を構造的に防止する（Section 2.3 MUST）。
- **Pointer / Arrow / ControlPad / Depthが同一Translation semanticへ到達する方法**: 全4経路が
  それぞれの入力手段でワールド/スクリーン/カメラ相対のdeltaベクトルを計算した後、
  最終的に「coordGroupRef-local な`localDelta`」という同一形状のIntentへ正規化してから
  `resolveCanonicalPose()`のcandidateへ渡す（Section 10で詳述）。

---

## 6. Rotation R4 Specification（Decision 3 — 執筆時PENDING、後続Task実機確認によりAPPROVE。Section 20参照）

以下、本節執筆時点の**CONFIRMED / PENDING / UNKNOWN**という区別をそのまま記録として保持する
（Architect Decision Section 20の3層構造をそのまま実装仕様へ持ち込んだもの）。後続Taskの
実機確認により、当時PENDINGだった項目もすべて確定済み（Section 20 Gate結果参照、本節の
内容自体は変更しない）。

```
CONFIRMED（実装してよい）:
  座標系フレーム = coordGroupRef-local（Anatomical Frame）
  合成式         = Q = Rx(angleTilt) * Rz(angleTiltZ) * BaseAlignmentQuaternion * Roll(shaftRoll)
  angleTilt軸    = Anatomical FrameのX軸（lateral-medial軸）
  angleTiltZ軸   = Anatomical FrameのZ軸（anterior-posterior軸）
  合成順序       = pre-multiply（Base Alignmentに対して外側から回転を掛ける）

PENDING（実装はCONFIRMED定義通り行うが、実機確認まで最終確定としない）:
  angleTilt/angleTiltZの正符号がユーザーの期待する方向と一致するか
  X軸/Z軸マッピング自体が全製品（BELL/TORP/PISTON）で正しい前後/左右に見えるか

UNKNOWN（実装Taskでは判断しない、実機確認結果を待つ）:
  実機でのvisual feel（「傾き量」の感覚的な妥当性等）
```

### 6.1 実装方針

- CONFIRMED部分（座標系・合成式・軸マッピング）はそのまま実装する。
- PENDING部分（符号）は、既存プロジェクトの確立パターン「実機確認時に反転可能な最小定数」を
  踏襲する。既存の前例と配置場所は具体的に以下の通り:
  ```
  既存前例: transformControlsConfig.ts は「キー操作・将来のボタンUIの両方から同じ値を参照
            できるよう共有UI定数を専用ファイルへ切り出す」という既定方針を持つファイルで
            あり（同ファイル冒頭コメント）、`ROTATE_DEG_PER_PIXEL_TILT`/
            `ROTATE_DEG_PER_PIXEL_TILT_Z`（SimScene.tsx側で定義、符号反転前提のコメント付き）
            と同種の「実機確認待ちの符号定数」が既に存在する。

  MUST（配置場所）: 新設する符号定数は transformControlsConfig.ts へ追加する
       （既存の同種定数群と同じファイルに集約する、新規ファイルを作らない）。

  MUST（命名）: ANGLE_TILT_SIGN, ANGLE_TILT_Z_SIGN （値は 1 または -1 のみ、初期値は
       Architect Decision Section 6.3の定義通り 1 とする＝符号反転なしがデフォルト）。

  MUST（適用箇所）: resolveCanonicalPose()内でtiltX/tiltZをRx/Rzへ渡す直前に
       `tiltX * ANGLE_TILT_SIGN`, `tiltZ * ANGLE_TILT_Z_SIGN` として乗算する。
       PlacementStateの`angleTilt`/`angleTiltZ`自体の値・保存形式・D-2 Migration
       （Section 15）には影響しない（符号定数は表示直前の最終段のみに作用する）。
  ```
  実機確認後、この2定数だけを`1`↔`-1`へ反転すれば軸マッピングの修正が閉じるように設計する
  （MUST）。
- 実装完了後もSection 20のR4 Real-device Verification Gateを通過するまで、Decision 3自体は
  Architect Decisionとして`PENDING REAL-DEVICE CONFIRMATION`のまま据え置く。実装が完了した
  ことと、Decision 3が確定することは別である。**[後続Task、Gate結果]** 本Gateはshojiさんの
  実機確認により通過済み（Section 20参照）、Decision 3は`APPROVE`（Architect Decision
  Section 19-3・20.1）。

---

## 7. Depth Specification（Decision 4）

### 7.1 現行のCamera-relative Direction生成（変更しない部分）

```
camera.getWorldDirection(camDir)                              [SimScene.tsx:1085-1086]
  ↓
parentInverseRotation = Matrix3(dragGroupRef.parent.matrixWorld).invert()  [1087-1089]
  ↓
localDir = camDir.applyMatrix3(parentInverseRotation).normalize()          [1090]
  ↓
depthDelta = localDir * (sign * depthStep)   sign: PageDown=+1, PageUp=-1  [1091-1097]
```

この一連の計算（world→local座標変換、方向ベクトル生成）は**MUST NOT CHANGE**（D-4 Audit G節で
数学的に確認済み、Camera-relativeという軸選択自体はDecision 4でAPPROVE済み）。

### 7.2 変更点（Decision 1 Position-onlyの適用）

```
現行: depthDelta を dragOffsetX/Y/Z へ加算 → Quaternionにも波及（D-4 Option①/②のFreeze/Slerp
      で対症療法していた）
新仕様: depthDelta を resolveCanonicalPose()の {kind:'translate', localDelta: depthDelta}
      candidateとして渡す。Quaternionは committed.baseAlignmentQuaternion 由来のまま不変
      （Section 5のMUSTがそのまま適用される、Depth固有の特別処理は不要）。
```

- **PageUp/PageDownマッピング**: 既存のまま維持（PageDown=カメラから離れる方向=+1、
  PageUp=カメラに近づく方向=-1）。
- **Position update**: `resolveCanonicalPose()`のcandidate経由でCommit（`evaluateDragCandidate`
  相当の後継関数によるCollision判定を経た上で、Section 9のCollision Candidate Specification
  に従う）。
- **Quaternion unchanged**: Section 5 MUSTの通り、Depth操作はQuaternion計算式に一切登場しない。

### 7.3 Rotation Freezeが不要になることの記録

```
記録: Depth操作がPosition-onlyになることで、D-4 Option①（depthSessionQuatによる
      Quaternion Freeze）が対処していた「Depth中にQuaternionが飛ぶ」問題自体が
      発生しなくなる。同様にOption②（Release時200ms slerp）が対処していた
      「Release時のQuaternion snap」も発生しなくなる。
      したがって、Section 1.3に列挙したFreeze/Slerp関連コード（depthSessionQuat,
      endDepthSession, releaseInterp, depthPoseOverride等）は、Depth操作の新実装
      完了後は機能的に不要となる（Decision 9のREMOVE根拠、Section 14参照）。
```

---

## 8. Shaft Roll Specification（Decision 5）

```
MUST NOT CHANGE: 回転軸定義（Prosthesis local +Y = shaft longitudinal axis）
                 D-4 Audit F節で幾何学的・数値的（誤差1e-15未満）に確認済み。
```

### 8.1 合成順序（Architect式との整合性確認）

Section 2.2の式:
```
Quaternion = [ Rx(angleTilt) * Rz(angleTiltZ) * BaseAlignmentQuaternion ] * Roll(shaftRollDeg, Local+Y)
```

Shaft Rollは常に**最後にpost-multiply**される（Rotation R4部分が確定した後の最終姿勢に対して、
Prosthesis自身のローカルY軸まわりに回す）。これは現行実装
（`ProsthesisModels.tsx:1796-1800`の`pose.quaternion.multiply(Roll)`、
`SimScene.tsx:1458-1462`/`1500-1504`の同一パターン）と**完全に同じ合成順序**であり、
変更を要しない。新設する`resolveCanonicalPose()`（Section 4.3）は、この3箇所に重複していた
Roll乗算ロジックを1箇所へ統合するのみ（ロジック自体は不変）。

---

## 9. Pointer Drag Specification（Decision 6）

### 9.1 現行構造（変更しない部分）

```
pointerdown → useScreenSpaceDrag.onPointerDown  [ManipulationLayer.tsx:284-338]
  raycast to camera-facing plane → startPoint
pointermove → handleMove                         [ManipulationLayer.tsx:318-324]
  worldDelta = point - startPoint
  localDelta = worldDelta.applyMatrix3(parentInverseRotation)
  group.position.copy(localDelta)   ← dragGroupRef.position（imperative、React外）
pointerup → handleUp                              [ManipulationLayer.tsx:326-334]
  finalDelta = group.position.clone()
  onDragEnd(finalDelta)
```

この一連の「Screen-space raycast→Plane交点差分→coordGroupRef-local化」という変換手順は
**MUST NOT CHANGE**（Decision 6でScreen-space維持がAPPROVE済み）。

### 9.2 Canonical Pose Generatorへの接続（変更点）

```
現行: onDragEnd内で composeDragCandidatePose(dragLocalDelta) を呼び evaluateDragCandidate()
      で判定 → dragOffsetX/Y/Z += effectiveDelta

新仕様: onDragEnd内で resolveCanonicalPose(committed, {kind:'translate',
      localDelta: dragLocalDelta}) を呼び、Section 9のCollision Candidate Specification
      に従って判定 → PASSなら dragOffsetX/Y/Z += effectiveDelta（clamp3適用、既存のまま）
```

**重要**: Pointer Dragは「Screen-space起点でlocalDeltaを生成する」という**Intent生成方法**の
違いに留め、それ以降（Candidate評価・Collision判定・Commit）は他のTranslation系操作
（Arrow/ControlPad/Depth）と完全に同一のCanonical Pose Generator経路を通る。
**Pointer Drag専用のCollision semanticsを新設しない**（Task指示§10、Architect Decision
Section 10.3の原則通り）。

ドラッグ中のuseFrame補正（`SimScene.tsx:1273-1285`、Collisionしていればlastvalidへ差し戻す
既存ロジック）も、内部で呼ぶ判定関数が`evaluateDragCandidate()`から後継の
`resolveCanonicalPose()`ベースの判定へ置き換わるのみで、フレームごとの補正という制御構造自体は
維持する（MUST NOT CHANGE、C-2 Collision Constraintの既存挙動）。

---

## 10. Manipulation Intent 統合設計（Arrow / ControlPad / Pointer / Depth / Rotate / Shaft Roll）

### 10.1 既存構造の評価（最小変更の原則）

Architect Decision Section 10.3で既に確認した通り、**現状でもPointer Drag/Depth/Arrow/
ControlPadは全て「coordGroupRef-localな並進delta」を`dragOffsetX/Y/Z`という単一フィールドへ
加算する、という同一のManipulation Semanticsに到達している。** 違うのは「どうやってdeltaの
値を生成するか」という入力方法固有の計算だけである。

したがって、**新しい"Intent"型やdispatcher層を大きく新設する必要はない**（Task指示§11
「既存コードに適合しない抽象化を無理に導入しない」に従う）。各入力ハンドラは、既存の
「deltaベクトルを計算する」ところまでは現状の実装（Screen-space raycast、
`camera.getWorldDirection()`、キー押下固定量、ボタン押下固定量）をそのまま維持し、
**deltaを`resolveCanonicalPose()`のcandidateへ渡す最後の1ステップだけを差し替える**、
という設計にする。

### 10.2 各入力ハンドラの変更範囲（最小差分）

| 入力 | delta生成（MUST NOT CHANGE） | Canonical Poseへの接続（変更点） |
|---|---|---|
| Pointer Drag | `useScreenSpaceDrag`（Section 9.1） | `onDragEnd`内、Section 9.2 |
| Depth | `camera.getWorldDirection()`経路（Section 7.1） | `PageUp/PageDown`ハンドラ内、Section 7.2 |
| Arrow Translation | `moveStep`固定量（`SimScene.tsx:1177-1178`） | **新規**: 現状`translateSelectedObject()`直呼びを、`resolveCanonicalPose()`のcandidate評価を経由する形へ差し替える（Requirement 4、Section 11） |
| ControlPad Translation | `moveStepMm()`固定量（`ControlPad.tsx:69-76`） | **新規**: 同上（`translateSelectedObject()`直呼びを置き換え） |
| Shift+矢印 / Rotate Mode | 角度delta（既存） | `evaluateRotationCandidate()`後継、`{kind:'rotate'}`candidate |
| ControlPad Rotate | 角度delta（既存） | **新規**: 現状`rotateSelectedObject()`直呼びを、`{kind:'rotate'}`candidate評価を経由する形へ差し替える |
| Shaft Roll（ControlPad） | 角度delta（既存） | **新規**: `{kind:'shaftRoll'}`candidate評価を新設して経由させる（現状Collision評価が皆無） |

**Intentという概念自体は、上表の「delta生成」→「candidate化」という2段階の橋渡しとして
実装仕様上の言葉として使うのみであり、独立した型階層（`TranslationIntent`クラス等）を
新設するかどうかは実装Task側の裁量とする**（本仕様が要求するのはあくまで「最終的に
`CanonicalPoseCandidateDelta`型（Section 4.1）へ正規化されること」のみ）。

---

## 11. Collision Candidate Specification（Requirement 4、D-4-Bの中心課題）

```
新仕様: Canonical Pose → Collision Candidate → collisionTest()

MUST: 以下すべての操作が、同一のCollision Candidate評価経路
      （resolveCanonicalPose(committed, candidate) → buildProsthesisCollisionProxy() →
      testCollision()）を経由すること。
      - Pointer Drag（Translation）        [既存evaluateDragCandidate相当を維持]
      - Depth                              [既存evaluateDragCandidate相当を維持]
      - Arrow Translation                  [新規追加]
      - ControlPad Translation             [新規追加]
      - Shift+矢印 / マウスRotate Mode      [既存evaluateRotationCandidate相当を維持]
      - ControlPad Rotate                  [新規追加]
      - Shaft Roll（全入力手段）             [新規追加、現在皆無]

MUST NOT: 上記のいずれかがCollision Candidate評価を経由せずPlacementStateへ直接書き込む
      経路（現行の`translateSelectedObject()`/`rotateSelectedObject()`直呼び）を残さない。
```

### 11.1 Arrow-key / ControlPad Translationの具体的差し替え方針

現行:
```
onKeyDown（矢印キー） → useSimStore.getState().translateSelectedObject(axis, delta)
ControlPad.translate() → useSimStore.getState().translateSelectedObject(axis, deltaMm)
```

新仕様:
```
onKeyDown / ControlPad.translate()
  → localDelta を組み立てる（axis 'x'|'y'|'z' → Vector3、既存のaxis-to-vector対応をそのまま使う）
  → resolveCanonicalPose(committed, {kind:'translate', localDelta}) で候補Pose生成
  → buildProsthesisCollisionProxy() + testCollision() で判定
  → PASS: dragOffsetX/Y/Z += localDelta（clampDragOffsetMm、既存のまま）
  → FAIL: 何もしない（Section 13 Collision Failure Semantics）
```

`translateSelectedObject()`/`rotateSelectedObject()`（`useSimStore.ts:205-217`）自体は
**残してよい**（他の内部呼び出し元との互換性のため）が、Arrow/ControlPadの入力ハンドラからは
直接呼ばず、Collision Candidate評価を経由した後にのみ呼ぶよう配線し直す（呼び出し元の変更、
関数自体のシグネチャ変更は不要）。

### 11.2 composeDragCandidatePose() / composeRotationCandidatePose() の処遇（Task Review §14への回答）

```
MUST: evaluateDragCandidate()（SimScene.tsx:815-866）・evaluateRotationCandidate()
      （SimScene.tsx:879-920）の内部実装は、composeDragCandidatePose()/
      composeRotationCandidatePose()の呼び出しを、resolveCanonicalPose()の呼び出しへ
      置き換える。以後、いかなるコードパスからもcomposeDragCandidatePose()/
      composeRotationCandidatePose()を呼び出してはならない（Single Source of Truthの
      要求そのもの、Decision 7）。

MAY: composeDragCandidatePose()/composeRotationCandidatePose()の関数定義自体
     （SimScene.tsx:1439-1464, 1478-1506）を削除するかは実装Task側の裁量とする。
     ただし呼び出し元が1つも残っていない状態（デッドコード）にすることはMUST。
     関数定義を残す場合は、将来の誤用を防ぐため「呼び出し禁止・resolveCanonicalPose()を
     使うこと」を示すコメントを付す（推奨、必須ではない）。

**重要（Task指示の確認）**: 「既存関数名を残すこと自体が目的ではない」という指示の通り、
本仕様が要求するのは「関数を残すか消すか」ではなく「Rendering/Collision Candidateが
`resolveCanonicalPose()`という単一の生成点を経由すること」（INVARIANT 1〜3、Section 12）
そのものである。
```

### 11.3 ControlPad Availability Gate（Post-Implementation Review Finding 2、次のImplementation Taskへの申し送り）

D-4 Implementation Code完了後のPost-Implementation Reviewで、ControlPad（SimSceneの兄弟
コンポーネント）が`placementControls`（Section 11.1のArrow/ControlPad Collision Candidate接続を
実現する橋渡し）をまだ受け取っていない場合に、既存store直接呼び出し（`translateSelectedObject()`
等）へフォールバックする経路が確認された。Placement Commit直後（`manipulation.committed`が
false→trueへ変わった直後）、`DraggableProsthesis`の`useEffect`が`placementControls`を親経由で
ControlPadへ伝播するまでの間、この経路が理論上・実際に操作可能な短いwindowとして存在する
（Reviewでの詳細分析: マルチタッチ操作でのみ到達可能、影響は既存±3mm/±180°クランプの範囲内の
単発delta1回分に有界）。

```
MUST（次のImplementation Task）: ControlPadは、Placement段階（manipulationCommitted===true）
      かつ`placementControls`が未接続（null/undefined）の間、Translation/Rotate/Shaft Roll
      操作を無効化しなければならない。
MUST NOT: 上記の場合に、既存store直接呼び出し（useSimStore.getState().translateSelectedObject()
      等）へフォールバックしてはならない。
MUST NOT CHANGE: Transport段階（manipulationCommitted===false）の`transportControls`未接続時の
      既存フォールバック（`useSimStore.getState().translateSelectedObject()`等への直接呼び出し）
      は変更しない——Transportは Architect Decision Section 3.C の通りCollision Constraint
      対象外であり、このフォールバックはSafety上のbypassを構成しない（Placement段階の
      `placementControls`未接続時のフォールバックとは性質が異なる、Post-Implementation
      Review Finding 2 Evidence参照）。
```

これにより、Requirement 4（全ての操作入力がCollision Candidate評価を経由する）が
ControlPadについて例外なく成立する。コード変更自体は本Specification更新には伴わない
（次のImplementation Taskの対象、`ControlPad.tsx`内で完結する見込み）。

---

## 12. Rendering / Collision Consistency — 必須Invariant

```
INVARIANT 1:
  Rendering Pose == resolveCanonicalPose(committed)  （candidate省略時）

INVARIANT 2:
  Collision Candidate Pose == resolveCanonicalPose(committed, candidate)
  （評価対象のcandidateを渡した場合）

INVARIANT 3（Requirement 1、Architect Decision Section 10.2）:
  操作確定前（Committed State不変）の同一入力に対し、INVARIANT 1とINVARIANT 2は
  candidate=undefinedのとき数学的に恒等（bit-for-bit一致）である
  （同一関数・同一分岐のため、近似ではなく実装として保証される）。
```

D-4-Bで発生した3種の不具合の再発防止を、上記Invariantが成立する設計そのものによって
構造的に保証する。

| D-4-Bで発生した不具合 | 本仕様での再発防止根拠 |
|---|---|
| Existing offset omission | `resolveCanonicalPose()`のcommitted引数は常にPlacementStateの現在値（dragOffsetX/Y/Z含む）フルセットを要求する（Section 4.3 MUST） |
| Position error（線形近似と非線形計算の乖離） | Decision 1（Position-only）採用によりPosition計算自体が単純加算のみになり、非線形計算（旧`dir=normalize(target-base)`）がCandidate/Rendering間で二重実装される余地自体が消える |
| Quaternion error | 同上、QuaternionはBase Alignment（Commit時固定）+ Rotate/Roll deltaのみに依存し、Translation delta（Position側）とは無関係になる（Section 2.2） |
| ControlPad/Arrow Collision bypass | Section 11 MUSTにより全入力手段がCollision Candidate評価を経由する |

---

## 13. Collision Failure Semantics（既存C-Phase原則の維持）

```
MUST NOT CHANGE: 既存のCollision失敗時挙動（movement stop、no bounce）。
```

```
Candidate Pose を resolveCanonicalPose(committed, candidate) で計算
  ↓
buildProsthesisCollisionProxy() + testCollision()
  ↓
collided === true
  → candidate は rejected
  → PlacementStateは変更しない（現在のCanonical Pose = 直前のcommitted状態のまま）
  → Pointer Drag中のuseFrame補正は既存通りlastValidへ差し戻す（SimScene.tsx:1280-1284と同型）
  → Arrow/ControlPad/Depthは単に何も書き込まない（既存のif分岐パターンを踏襲、
    SimScene.tsx:1101, 1168のif文と同型）
collided === false
  → candidate を committed へ反映（dragOffsetX/Y/Z or angleTilt/angleTiltZ or shaftRollDeg の更新）
```

C-2（Prosthesis-Anatomy Collision Constraint）・C-7/C-8（Foot Proxy関連の既存Decision）の
判定ロジック自体（`testCollision()`、`buildProsthesisCollisionProxy()`、Foot Contact
Toleranceの扱い）は**MUST NOT CHANGE**（Section 18 Implementation Scope参照、今回の変更対象は
「どのPoseを判定にかけるか」であり「どう判定するか」ではない）。

---

## 14. Freeze / Slerp Removal Specification（Decision 9、削除順序）

```
MUST: 以下の順序を守ること。今回のTaskではどちらも実行しない。
  ① 新Position-only Translation/Depth semantics（Section 5, 7）を実装・Verification（Section 17）で
     PASSさせる
  ② ①のVerificationが完了して初めて、Section 1.3に列挙したFreeze/Slerp関連コードを削除する
```

**削除順序の理由**: Freeze/Slerpは現行のTranslation→Quaternion Couplingという問題への
対症療法である。新semantics実装前に削除すると、修正されていない旧Couplingの上でDepth操作時に
Quaternionが飛ぶ問題（D-4-A以前の不具合）が復活する。したがって削除は新semantics実装完了・
検証後の別ステップとする。

削除対象リストはSection 1.3の表をそのまま使う（`depthSessionQuat`, `depthSessionQuatRef`,
`depthLastOffsetRef`, `depthSessionActiveRef`, `endDepthSession()`, `releaseInterp`,
`releaseInterpActiveRef`, `releaseInterpStartRef`, `cancelReleaseInterpolation()`,
PageUp/PageDown keydown内のDepth Session開始処理（1120-1136相当）, keyup内の
`endDepthSession(true)`呼び出し, Rotate/ShaftRoll監視effect（1231-1237）, dragOffset不変条件
監視effect（1247-1258）, Slerp進行useFrame（1305-1318）, `depthPoseOverride`（1331-1353）,
`RELEASE_INTERP_DURATION_MS`定数）。

**MUST RETAIN（Task Review §16「何を残すのか」への回答）**: 以下はFreeze/Slerpとは無関係の
機構であり、削除対象に**含まれない**。
```
- PageUp/PageDown keydownハンドラ自体（camera.getWorldDirection()による方向生成、Section 7.1）
  ——削除対象はSession開始処理（Depth Session固有の部分）のみで、Depth操作自体は残す。
- evaluateDragCandidate() 相当の後継関数（Collision判定自体、Section 11）
- COLLISION_CONSTRAINT_ENABLED / DIRECT_MANIPULATION_UX（既存kill-switch、
  transformControlsConfig.ts:40, 54）
- TransformControls / useScreenSpaceDrag 等のPointer/Drag入力基盤（Section 9.1）
- lastValidLocalDeltaRef 等のCollision補正機構（Section 13、Freeze/Slerpとは別系統）
```

---

## 15. D-2 Migration Specification（Decision 8、Option A）

### 15.1 前提（Architect Decision Section 12.5から転記、数学的根拠は変更しない）

```
角度Tilt=angleTilt, angleTiltZ=0 のとき、R1（現行Euler再合成）とR4（新pre-multiply）は
恒等的に一致する（Node.js数値検証、最大誤差 1.708e-6°、機械精度レベル）。
既存D-2データ（idealAngle 12症例、startPlacement 3症例）は全数 angleTiltZ=0 であることを
確認済み。
```

### 15.2 Migrationアルゴリズム

```
Input:  旧CasePlacementSnapshot { lateralOffset, anteriorOffset, verticalOffset,
        angleTilt, angleTiltZ }  （cases.ts の idealPlacement / startPlacement）
Old semantics: R1（Euler XYZ再合成、Decision 3実装前の現行式）
Conversion:
  angleTilt_new  = angleTilt_old      （無変換）
  angleTiltZ_new = angleTiltZ_old     （無変換、現行データは常に0）
  lateralOffset/anteriorOffset/verticalOffset は無変換
        （Position計算式はR1/R4で共通、Architect Decision Section 12.5-3）
Output: 新CasePlacementSnapshot（フィールド形状は不変、値も数値としては不変——
        「変換」というよりversion tagの更新に近い、15.4節参照）
Validation:
  各症例について、旧式R1(angleTilt_old, angleTiltZ_old)と新式R4(angleTilt_new,
  angleTiltZ_new)のQuaternion角度差を計算し、閾値（例: 1e-4°、機械精度に対して十分な
  安全マージン）以下であることを確認する。
  → angleTiltZ=0の症例（現行データ全件）はこの検証を通過する設計上の保証がある
    （Architect Decision Section 12.5 Claim1/3/4で実証済み）。
Rollback / failure handling:
  Validationで閾値を超える症例が1件でもあれば、その症例のMigrationを実行せず、
  UNKNOWNとして報告する（Architect Decisionの証明範囲外＝angleTiltZ≠0のケースに該当する
  可能性が高い）。全件一括でのMigration実行は行わず、症例単位でVerificationしてから
  適用する。
```

### 15.3 適用範囲の限定（MUST）

```
MUST: 本Migrationアルゴリズムの「無誤差」という保証は、angleTiltZ=0のデータにのみ適用される。
MUST NOT: 将来angleTiltZ≠0のIdeal/Start Positionデータが追加された場合、本アルゴリズムを
      そのまま適用しない（Architect Decision Section 12.5「留意点」に明記済み、
      「今回の証明範囲外」）。その場合は実機での再キャプチャ（Option B相当）が必要になる。
```

### 15.4 実行タイミング

```
MUST: 本Migrationの実行はDecision 3（Rotation R4）が最終確定（実機確認完了、本書Section 20
      R4 Real-device Verification Gate通過）した後に行う（Architect Decision Section 13
      「Option Aの承認とMigrationの実行は分離する」、Architect Decision Section 22.3
      Blocking Item 2）。
      理由: R4の軸マッピング自体が実機確認でPENDINGのため、「R4へのMigration」という
      行為自体、R4が最終的にどう実装されるか（符号定数、Section 6.1）が固まってから
      でなければ実施できない。
```

---

## 16. Data Versioning

### 16.1 調査結果

`CasePlacementSnapshot`（`cases.ts`の`idealPlacement`/`startPlacement`フィールド）には
現在バージョンタグが存在しない（型定義は5数値のみ、Section 1.5）。`cases.ts`自体は
コード内の静的データ（TypeScriptオブジェクトリテラル）であり、DBやユーザーデータストアの
ような実行時マイグレーション機構は存在しない。

### 16.2 提案

Architect DecisionはOption A（数値変換、既存データを実質無変更で新semanticsへ引き継ぐ）を
採用済みのため、Option B/C（再キャプチャ、legacy併存）へ戻す必要はない
（Task指示§17の通り）。したがって、複雑なversion fieldやlegacy保持機構は不要と判断する。

```
Migration one-time conversion（最小構成案）:
  - cases.ts の angleTilt/angleTiltZ フィールドの「意味」がR1→R4へ切り替わる、
    というのはコード側（Pose生成関数）の切り替えであり、cases.ts自体のデータ値は
    Section 15.2の通りほぼ無変換（angleTiltZ=0のデータは数値として不変）。
  - したがって「Migration」の実体は、cases.tsの値を書き換える一括スクリプトというより、
    「Pose生成関数をR1からR4へ切り替えるコード変更そのもの」に近い
    （Section 15.2のValidationステップだけを、切り替え前後の回帰確認として実施する）。
  - 明示的なversion fieldの追加は、現時点では過剰設計と判断する（YAGNI、Section 19
    Minimal Change Principleにも合致）。将来angleTiltZ≠0のデータが増える段階で、
    その時点のMigration方式（Option B相当）に応じて再検討する。
```

### 16.3 Rollback / Backup（最低限の安全策、Task Review §19への回答）

```
`cases.ts`はリポジトリ管理下の静的ソースファイルであるため、専用のbackup/rollback機構を
新設する必要はない（過剰設計を避ける、Section 19 Minimal Change Principle）。

MUST（最小限の安全策）:
  - Migration（Section 15.2のConversion）はcases.tsに対する通常のコード変更として実施し、
    通常のcommitフローに乗せる（他の変更と分離した単独commitにすることを推奨——
    Migration自体をgit historyから独立してrevertできるようにするため）。
  - Rollbackは`git revert`（既存の標準手段）で足りる。新しいrollback機構は不要。
  - Migration失敗時（Section 15.2 Rollback/failure handling、閾値超過症例）は、
    該当症例をUNKNOWNとして報告するのみで、cases.ts自体は変更しない
    （部分適用ではなく、症例単位で「適用する/しない」を明確に分ける）。
```

---

## 17. Verification Specification

### 17.1 Translation

```
MUST verify:
  X translation → Quaternion unchanged（angle(Q_before, Q_after) = 0、機械精度）
  Y translation → Quaternion unchanged
  Z translation → Quaternion unchanged
検証方法: 既存D-4/D-4-B Auditで使用した手法（Node.js+three.jsでの数値スクリプト、または
本番`resolveCanonicalPose()`をdynamic importで直接呼び出す手法、D4-B Runtime Safety
Verification 3.1節参照）を踏襲する。
```

### 17.2 Depth

```
MUST verify:
  PageUp/PageDown → Position only変化、Quaternion unchanged
検証方法: 同上。実機（通常表示可能なブラウザ環境）でのPageUp/PageDown操作前後の
Rendering Quaternionをdynamic import経由で比較する。
```

### 17.3 Rotation

```
MUST verify:
  angleTilt/angleTiltZ/shaftRollDegの変化に対し、Quaternionが仕様式（Section 2.2）通りに
  変化すること（数値一致、機械精度）。
MUST（Decision 3 Gate、Section 20）:
  real-device axis/sign verification を必須Verification Gateとして残す。
  このGateが未通過の間は、Rotation R4の実装が数式としてCONFIRMED通りであることは
  検証できても、Decision 3自体（Architect Decision）はPENDINGのまま変更しない。
```

### 17.4 Shaft Roll

```
MUST verify:
  shaftRollDeg変化 → Position unchanged（4.3式のquaternion項のみ変化、position式に
  shaftRollDegが登場しないことの数値確認）
  shaftRollDeg変化 → 回転軸がLocal +Y（D-4 Audit F節の検証手法と同一: ロール前後で
  Local+Y軸のWorld方向が不変であることを確認）
```

### 17.5 Pointer Drag

```
MUST verify:
  Screen-space raycast手順（Section 9.1）が無変更であること（既存のManipulationLayer.tsx
  useScreenSpaceDrag実装との差分なし、コードレビューで確認）
  onDragEnd以降がSection 9.2の新経路（resolveCanonicalPose + Collision Candidate評価）を
  通ること（17.6のCollision検証と共通）
```

### 17.6 Collision

```
MUST verify:
  同一操作量について Rendering Pose == Collision Candidate Pose を数値検証
  （Section 12 INVARIANT 1/2/3の実装確認）。
MUST verify（runtime/static evidence）:
  Pointer / Arrow / ControlPad / Depth / Rotate の全経路が、実際にCollision Candidate
  評価コードパスを通過すること。
    - Static evidence: 各入力ハンドラのコードが`resolveCanonicalPose()`+
      `testCollision()`を呼ぶ経路にのみ書き込みを行い、直接`updatePlacement()`等を
      呼ぶ経路が残っていないことをコードレビューで確認する。
    - Runtime evidence: 既存の本番console.log計装（`evaluateDragCandidate`相当、
      D4-B Runtime Verification 4.1節で使用した手法）を用い、各入力手段の操作後に
      実際にCandidate評価ログが出力されることを確認する。
```

### 17.7 D-2

```
MUST verify:
  Migration前後で対象症例のQuaternion equality（Section 15.2 Validation）・
  Position equality（無変換のため自明）・Score semantics（computeScore()の数式は
  無変更のため、angleDiffX/angleDiffZの計算結果が入力値ベースで一致することを確認、
  Architect Decision Section 12.3「computeScore()のスコアリング式自体=互換性あり」の
  検証）を確認する。
```

### 17.8 Verification Matrix（統合表、Task Review §20への回答）

| 操作 | 確認項目 | Pass条件 |
|---|---|---|
| X Translation | Position changes / Quaternion unchanged / Collision Candidate consistent | Position=coordGroupRef-local X軸方向へ変化、Quaternion差分=0（機械精度）、Rendering==Candidate Pose |
| Y Translation | 同上（Y軸） | 同上 |
| Z Translation | 同上（Z軸） | 同上 |
| Depth（PageUp） | Position changes along Camera-relative axis / Quaternion unchanged | Section 7.1の方向生成通りにPositionが変化、Quaternion差分=0 |
| Depth（PageDown） | 同上（逆方向） | 同上 |
| Rotation（angleTilt） | Quaternion changes according to R4 | Section 6.3の式通りにQuaternionが変化（符号自体はSection 20 Gate待ち） |
| Rotation（angleTiltZ） | 同上 | 同上 |
| Shaft Roll | 回転軸=Local +Y | ロール前後でLocal+Y軸のWorld方向不変（17.4参照） |
| Pointer Drag | Screen-space movement | Section 9.1手順が無変更、9.2経路でCollision Candidateを通る |
| Collision（全経路共通） | Pointer/Arrow/ControlPad/Depth/RotateすべてがCandidate evaluationを通る | 17.6のstatic/runtime evidence双方でPASS |
| D-2 Migration | Pose equality / Quaternion equality / Score semantics | 17.7参照、angleTiltZ=0症例は誤差ゼロ（機械精度） |
| Decision 3 | axis / sign / visual direction（実機） | Section 20 R4 Real-device Verification Gate参照、UNKNOWNのまま許容 |

---

## 18. Implementation Scope

```
MUST CHANGE:
  - Placement段階のPose生成経路（DraggableProsthesis内、SimScene.tsx）
  - composeDragCandidatePose() / composeRotationCandidatePose() の後継となる
    Canonical Pose Generator呼び出しへの置き換え
  - Arrow-key Translation/Rotate、ControlPad Translation/Rotate/Shaft Rollの
    Collision Candidate評価への接続（現在皆無、Requirement 4）
  - Base Alignment Quaternionの新規state（Placement Commit時に1回確定）
  - D-4 Option①/②（Freeze/Slerp）関連コード（Section 14の順序に従い、新semantics
    実装・検証完了後に削除）

MAY CHANGE（実装Task側の裁量、本仕様は強制しない）:
  - `resolveCanonicalPose()`の具体的なファイル配置・命名
  - Manipulation Intent正規化の内部実装詳細（Section 10.1、既存構造の最小差し替えの範囲内）

MUST NOT CHANGE:
  - C-2 Prosthesis-Anatomy Collision Constraint の判定ロジック自体
    （`testCollision()`, `buildProsthesisCollisionProxy()`）
  - C-7/C-8（Foot Proxy設計、Foot Contact Tolerance = 0.15mm等の既存Decision）
  - 既存Collision Geometry（Shaft/Foot Sphere近似、HeadPlate OBB近似）
  - Transport段階のPose生成経路（Section 3.1、DirectTransportProsthesisのuseFrame）
  - Shaft Roll軸定義（Local +Y、Decision 5）
  - Pointer DragのScreen-space raycast手順（Section 9.1、Decision 6）
  - Depthのcamera-relative方向生成手順（Section 7.1、Decision 4）
  - ±3mm / ±180°のクランプ値・関数（`clampDragOffsetMm`, `clampAngleDeg`, `clamp3`）
  - `translateSelectedObject()`/`rotateSelectedObject()`のシグネチャ（呼び出し元の
    配線のみ変更、関数自体は残してよい）
  - D-2 `CasePlacementSnapshot`の型形状（Section 16.2）
```

### 18.1 Scope Boundary — 対象とする呼び出し元（Post-Implementation Review Finding 3）

Requirement 4（Section 10.4、11「全ての操作入力がCollision Candidate評価を通る」）の適用範囲は、
**Section 1（Repository Investigation Summary）で投資調査対象とした呼び出し元に限定する**。
具体的には`SimulationMode.tsx`の`PlacementStep`が構成するPlacement flow（`DraggableProsthesis`・
`ControlPad`・Arrow-keyハンドラの組み合わせ）を指す。

```
Out of Scope（D-4未調査、Regressionではない）:
  - StepFlowMode.tsx:718 の <ControlPad /> （props未接続、placementControls/transportControls
    いずれとも接続されていない）。D-4着手前から存在する挙動であり、D-4 Implementationに
    よって悪化していない。Section 1のInvestigationはこのファイルを対象にしていない。
  - Collision Candidate接続が必要と判断される場合は、D-4とは別のTaskとして扱う
    （D-4 Scopeを事後的に拡張しない、Post-Implementation Review Finding 3の結論）。
```

---

## 19. Minimal Change Principle

```
禁止（Task指示§20の通り、本書でも維持）:
  - unrelated refactor
  - UI redesign
  - unrelated naming cleanup
  - unrelated state management migration
  - collision geometry redesign
  - new framework introduction
```

本仕様が要求する変更は、Section 18「MUST CHANGE」に列挙した範囲に限定される。
Canonical Pose Generatorの導入自体も、既存の`computeProsthesisModelPose()`・
`buildProsthesisCollisionProxy()`・`testCollision()`という既存関数群を**そのまま呼び出す
薄い統合層**として設計されており（Section 2.3、4.3、4.4）、これらの内部実装を書き換える
ものではない。

---

## 20. R4 Real-device Verification Gate（Decision 3）

```
Gate名: R4 Real-device Verification Gate

確認項目:
  1. angleTilt direction   — 前後傾斜の見た目が期待通りか
  2. angleTiltZ direction  — 左右傾斜の見た目が期待通りか
  3. positive/negative sign — Keyboard/Rotate UIの操作方向とQuaternion変化の方向が一致するか
  4. visual anatomical meaning — 各製品(BELL/TORP/PISTON)・各症例のジオメトリで
     見た目として正しい前後/左右に見えるか

実施条件:
  通常表示可能なブラウザ環境（document.hidden=false, visibilityState="visible"）が
  前提。Browser paneが再び document.hidden=true となる場合、確認項目は UNKNOWN として
  記録し、推測でPASSにしない（D4-B Runtime Verification系列と同じ規律）。
  ただし同一環境での無限再試行は不要（既に3回連続で同一結果、Architect Decision
  Section 6.4.1参照）。

Gate通過条件:
  上記4項目すべてが実機でPASS（またはSection 6.1の符号定数反転で対応）した時点で、
  Decision 3を "PENDING REAL-DEVICE CONFIRMATION" から "APPROVE" または
  （軸マッピング自体に問題があれば）再設計要求 へ更新する、別途のArchitect Decision
  更新Taskを発行する。本Implementation Specification自体はこのGate通過を待たずに
  実装着手してよい（Section 6.1の符号定数分離設計により、Gate通過後の修正が
  最小定数の反転で閉じるように設計されているため）。
```

**Gate結果（後続Task、D-4 Implementation・Post-Implementation Review完了後）**:
```
角度Tilt direction      = 問題無し
角度TiltZ direction     = 問題無し
positive/negative sign  = 問題無し
visual anatomical meaning = 問題無し

Gate = PASS（4項目すべて）
ANGLE_TILT_SIGN / ANGLE_TILT_Z_SIGN の反転 = 不要（現状の1のまま）
Decision 3 = APPROVE（Architect Decision Section 19-3・20.1で確定済み）
```
この結果と合わせ、D-4 Post-Implementation Review Finding 1/2で静的検証のみだった項目
（Placement flowの各入力経路、Collision Candidate評価の実際の拒否動作、`placementControls`
接続タイミング周辺の挙動、`baseAlignmentQuaternion`不正状態の非到達性、StepFlowMode/
Transport/クランプ値のRegression確認、計B1〜B5）も同一の実機確認機会で実施し、すべて
「問題無し」の報告を得た。これによりSection 17.6（Collision Runtime evidence）・
Post-Implementation Reviewで`Runtime = UNKNOWN`だった項目は`Runtime = PASS`（実機確認済み）
へ更新する。コード変更は伴わない（確認結果の記録のみ）。

---

## 21. 自己レビュー（初版、Task指示§23）

```
[x] Architect Decisionと矛盾なし
[x] Decision 3のUNKNOWNをPASSにしていない
[x] D-2 Option Aの数学的根拠を正しく反映
[x] Freeze/SlerpはREMOVE方針だがまだ削除していない
[x] Canonical PoseがRendering/CollisionのSingle Source of Truth
[x] ControlPad / Arrow bypassを再発させない
[x] Translation/DepthはPosition-only
[x] Base AlignmentはPlacement Commit
[x] Shaft RollはCurrent Semantics
[x] Pointer DragはScreen-space
```
（初版作成時の自己レビュー。Section 22（本Task、Implementation Readiness Review）で
より詳細な17項目チェックリストに置き換えて再監査した。）

---

## 22. Implementation Readiness Checklist（本Task、Task Review §24）

```
[x] Architect DecisionとSpecificationが一致
    — Section 3の監査で全9 Decisionを照合、Specification側がArchitect Decisionより
      強い主張（例: Decision 3をAPPROVE扱いする等）をしている箇所がないことを確認済み。

[x] Canonical Pose Contractが完全定義
    — Section 2（構成要素）・Section 4.1（シグネチャ）・Section 4.3（計算式）・
      Section 4.4（呼び出し規約）で、Input/Output/Invariantを明文化（Section 12）。

[x] committed/candidate semanticsが明確
    — Section 4.1「candidateの意味」ブロックで、translate=DELTA、rotate/shaftRoll=
      ABSOLUTE VALUEという区別を明示。Section 4.2でフィールドごとの対応表を追加、
      二重加算・欠落が構造的に起きない設計であることを式（Section 4.3）で確認。

[x] Base Alignment lifecycleが明確
    — Section 3.3で`manipulation.committed`の遷移と対称的に同期させるルールを確定。
      Case変更（MUST）・Product変更（UNKNOWN、実装Task側で要確認と明記）・
      Save Start/Ideal Position（MUST NOT CHANGE）・Transport Pose（独立）・
      PlacementState（付随する派生state）との関係をすべて記載。

[x] Translation semanticsが明確
    — Section 5で座標系・保存場所・basePos関係・clamp・Transport/Placement差・
      existing offset保証・入力方法間の到達方法をすべて記載。

[x] R4 Quaternion compositionが明確
    — Section 6.3（CONFIRMED式）・Section 4.3（適用順序、Roll→BaseAlignment→Rz→Rxの
      内側→外側の順で明記、pre-multiply/post-multiplyの区別も明記）。

[x] R4 signが隔離されている
    — Section 6.1で`ANGLE_TILT_SIGN`/`ANGLE_TILT_Z_SIGN`という具体的定数名・配置場所
      （transformControlsConfig.ts、既存の同種定数と同じファイル）・適用箇所を明記。

[x] Depth semanticsが明確
    — Section 7で現行方向生成（MUST NOT CHANGE）とPosition-only化（変更点）を分離して記載。

[x] Pointer Drag semanticsが明確
    — Section 9でScreen-space raycast手順（MUST NOT CHANGE）とCanonical Pose接続
      （変更点）を分離して記載。「独自Pose生成にしない」ことも明記（Section 9.2）。

[x] Arrow/ControlPad bypassが排除される
    — Section 11・11.1でArrow/ControlPad TranslationがCollision Candidate評価を
      経由する具体的差し替え方針を記載。Section 11.2でcomposeDragCandidatePose()/
      composeRotationCandidatePose()の処遇（呼び出し禁止・関数削除はMAY）を明記。

[x] Collision CandidateがCanonical Poseを使用
    — Section 12 INVARIANT 1〜3、Section 2.3のMUST/MUST NOTで明記。

[x] Freeze/Slerp removal scopeが明確
    — Section 1.3・14で削除対象を具体的シンボル名・行番号まで列挙。MUST RETAINリストも
      追加（Task Review §16「何を残すのか」への回答）。

[x] D-2 Option A migration algorithmが明確
    — Section 15.2でInput/Old semantics/Conversion/Output/Validation/Rollbackの
      6要素すべてを記載。

[x] Migration execution boundaryが明確
    — Section 15.4・18で「Migration Strategy=APPROVED、Migration Execution=NOT YET」
      という順序（Architect Decision→Implementation→Migration→Verification）を明記。

[x] Verification Matrixが完成
    — Section 17.1〜17.8（Translation/Depth/Rotation/Shaft Roll/Pointer Drag/
      Collision/D-2の個別MUST verify＋Section 17.8の統合表）。

[x] Decision 3 verification gateが定義済み
    — Section 20 R4 Real-device Verification Gate（確認項目4点・実施条件・Gate通過条件）。

[x] MUST CHANGE / MUST NOT CHANGEが明確
    — Section 18で三分類（MUST CHANGE / MAY CHANGE / MUST NOT CHANGE）を明記、
      C-2/C-7/C-8・Collision Geometry・Shaft Roll軸定義・Pointer Drag Raycast手順・
      ±3mm/±180°クランプ・Transport semanticsをすべてMUST NOT CHANGEとして列挙済み。

[x] 不要なrefactorがscopeから除外
    — Section 19 Minimal Change Principleで明示的に禁止事項を列挙
      （unrelated refactor / UI redesign / naming cleanup / state management migration /
      collision geometry redesign / framework introduction）。
```

**全17項目がチェック済み。Implementation Readiness = READY と判定する
（Section 23で詳述）。**

---

## 23. Implementation Readiness 判定

```
IMPLEMENTATION READY
```

**判定根拠**: Decision 3（Rotation R4）が`PENDING REAL-DEVICE CONFIRMATION`のままである
ことは、単独ではNOT READYの理由としない（Task Review §23の指示通り）。理由:

```
R4 Mathematical structure  = CONFIRMED（Section 6、Section 4.3の式）
R4 sign                    = ISOLATED（Section 6.1、2定数への隔離実装で閉じる設計）
R4 Visual verification     = PENDING（Section 20 Gate、実装完了後・Gate通過前でも
                              実装着手自体は可能な設計になっている）
```

この構造が成立していること自体は本Reviewで確認済み（Section 22チェックリスト「R4
Quaternion compositionが明確」「R4 signが隔離されている」）。

一方、本Reviewの過程で発見・修正した以下の曖昧箇所は、修正前であればNOT READY相当の
指摘事項だった（Section 24 Blocking Issues参照、いずれも本Task内で修正済み）。

```
- Section 4の擬似コードに実装者が解釈不能な誤記（プレースホルダの取り違え、無意味な
  自己代入）が残っていた → 修正済み
- committed/candidateの意味論（delta vs absolute value）が暗黙のままだった → 明示化済み
- Base Alignmentのreset契機（Case/Product変更時）が未定義だった → 同期ルールとして
  明確化（Product変更については実装Task側の要確認事項として明記、投機的に断定しない）
- 複数箇所でSection番号の相互参照がずれていた（編集時の混入） → 全数修正済み
- Freeze/Slerpの「MUST RETAIN」リストが欠落していた → 追加済み
- Data Versioningのrollback/backup策が未記載だった → 追加済み（git revertで足りる、
  過剰設計を避けた最小策）
```

これらはすべて本Task内で「Specificationの必要最小限の修正」として対応済みであり
（Task Review §15の許可範囲内）、現時点のSpecificationにはREADY判定を妨げる曖昧箇所は
残っていないと判断する。

---

## 24. Blocking Issues

```
なし（Implementation Readiness = READYのため）。
```

**参考（Blockerではないが実装Task側で対応すべき事項）**:
```
1. [RESOLVED、Architect Decision Section 23 Decision 10] Product変更がPlacement Commit後に
   発生しうるかは、D-4 Implementation Task／Post-Implementation Reviewでコードベースを
   再確認済み——発生しない（UI構造上到達不能、Decision 10で正式にArchitecture上の前提として
   確定）。baseAlignmentQuaternionの明示的nullリセット（Case/Product変更時）はdefense-in-depth
   として実装済み・維持する。
2. Decision 3の実機確認（Section 20 Gate）は、Implementation完了後・Migration実行前
   （Section 15.4）に必須で挟むこと。（変更なし）
3. Freeze/Slerp削除（Section 14）はSection 17 Verificationが完了してから行うこと。（変更なし）
4. [APPROVED、Decision 10承認済み、実装可能。Post-Implementation Review Finding 1、
   Section 3.3参照] evaluateDragCandidate() / evaluateRotationCandidate() /
   evaluateShaftRollCandidate()（の実装上の後継）のnull分岐を
   fail-open（制約なし=true）からfail-closed（候補拒否=false）へ変更すること。SimScene.tsx内
   で完結する小規模な修正で、state ownership変更は伴わない。Decision 10承認前はコード変更禁止
   だったが、shojiさんの正式承認（Architect Decision Section 23.7）により次のImplementation
   Taskでの実装が可能になった。
5. [APPROVED、実装可能。Post-Implementation Review Finding 2、Section 11.3参照] ControlPadは
   `manipulationCommitted===true && placementControls未接続`の間、Translation/Rotate/
   Shaft Roll操作を無効化すること（既存store直接呼び出しへのフォールバックをやめる）。
   ControlPad.tsx内で完結する。
6. [NEW、Post-Implementation Review Finding 3、Section 18.1参照] StepFlowMode.tsxの
   ControlPad（props未接続）はD-4 Scope外として扱う。次のImplementation Taskでの
   対応は不要（別Task判断待ち）。
```

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
?? docs/D4_Implementation_Specification_v1.0.md
?? docs/D4_Manipulation_Axis_Coordinate_System_Audit_v1.0.md
?? eac_topology_check.py
?? serena-mcp.ps1

$ git diff --check   （出力なし）
$ git rev-parse HEAD
871b1c5926dd73d6bf5f823dfe6785f2aabc900a
```

```
HEAD = 871b1c5926dd73d6bf5f823dfe6785f2aabc900a
Commit = NONE
Push = NONE
```

既存D-4-B系3レポート（Integrity Audit / Runtime Safety Verification / Final Runtime
Verification）は本Taskで変更していない。**[本Task、D-4 Architect Decision Formalization /
Specification Update]** D-4 Implementation Code完了後のPost-Implementation Review
（Finding 1〜4）を受け、Architect Decision文書にSection 23「Decision 10 — Case/Product Change
During Committed Placement」を追加した上で、本Implementation Specification文書を以下の通り
更新した:

```
Section 3.3  — Case/Product変更時reset（Decision 10により「UNKNOWN・要調査」を解消、
                「invariant違反時はfail-closed」という次Implementation Task向けMUSTを追加）
Section 11.3 — 新規追加（Finding 2、ControlPad Availability Gate）
Section 18.1 — 新規追加（Finding 3、StepFlowMode.tsxをD-4 Scope外として明記）
Section 24   — Blocking Issues参考事項を更新（項目1をRESOLVED、項目4〜6を新規追加）
Status行     — Implementation CodeがSection 24項目4・5を未反映であることを明記
```

Finding 4（`CollisionVerifyOverlay.tsx`のコメントのみの旧関数名参照）は正式なDecision項目化
していない（Post-Implementation Review Architect Reviewの結論通り、Future cleanupとして記録
するに留める、本書への変更なし）。

コード変更・Migration実行・Freeze/Slerp削除・テスト実装・Commit・Pushは一切行っていない
（`src/`配下は本Taskで一切touchしていない）。

**[後続Task、Decision 10 Formal Confirmation]** shojiさんより「Decision 10（Option A）を正式承認
します」との明示的指示を受けたことに伴い、トップStatus行とSection 24項目4・5の記述を
「Decision 10承認前はコード変更禁止」から「Decision 10承認済み・次のImplementation Taskで
実装可能」へ更新した。Decision 10自体の承認記録はArchitect Decision文書
（`docs/D4_Architect_Manipulation_Axis_Pose_Semantics_Decision_v1.0.md` Section 23.7）に
記載する（本書の役割はImplementation Specificationとして「何を実装するか」を記述することに
留め、承認そのものの記録はArchitect Decision側に一元化する）。本Task（承認記録の反映）でも
コード変更・Commit・Pushは一切行っていない。

**[後続Task、D-4 Finding 1/2 Implementation → Post-Implementation Review → Decision 3
Real-device Confirmation]** Finding 1/2はコード実装済み、独立したPost-Implementation Review
で監査しPASS（StepFlowMode回帰は実装過程で発見・修正済みであることを確認）。その後、shojiさんが
実機ブラウザ環境でSection 20 R4 Real-device Verification Gate（A1〜A4）およびFinding 1/2関連の
追加確認（B1〜B5）を実施し、すべて「問題無し」と報告。これを受け、トップStatus行・Section 6・
Section 20にDecision 3=APPROVEの結果を記録した（正式なDecision確定自体はArchitect Decision
Section 19-3・20.1で行う、本書はその結果を反映するのみ）。
Post-Implementation Review（前回Task）で指摘したDocumentation Drift（D1: トップStatus行/
Section 24項目4・5の実装未反映記述、D2: Section 11.3が`enforcePlacementCollisionGate`機構を
未記載）は、**本Taskでは意図的に修正していない**（ユーザー指示により、Decision 3確認Taskとは
分離した別のDocumentation Update Taskとして扱う）。D-2 Migration・Freeze/Slerp削除は、
Decision 3のAPPROVE確定により着手可能な状態になったが、いずれも実行していない
（別途の明示的な指示・Implementation Taskを要する）。コード変更・Commit・Pushは本Taskで
一切行っていない。
