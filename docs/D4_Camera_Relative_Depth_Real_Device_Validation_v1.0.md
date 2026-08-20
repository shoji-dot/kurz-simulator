# D-4 Camera-relative Depth — Real-device Validation

Status: Investigation Complete / Real-device Execution NOT TESTED（このセッションでは）
実装なし・Commitなし・Pushなし

D-4 R4 Geometry Migration（Geometry/Collision Proxy/Actual MeshBVH Safetyすべて`PASS`、
CLOSED済み、`docs/D4_Final_PORP_MeshBVH_Safety_Revalidation_v1.0.md`参照）とは独立した、
D-4の残タスクであるCamera-relative Depth feature（PageUp/PageDown）について、実装仕様を
ソースコードから再確認し、実機Test A/Bの実行を試みた記録である。

## 0. D-4 R4 Geometry Migrationの状態（再確認・変更なし）

```
Geometry                  = PASS
Collision Proxy Geometry  = PASS
Actual MeshBVH Safety     = PASS
D-4 R4 Geometry Migration = CLOSED
```
本Taskではこれらに関わるコード（Candidate B radius、+0.15mm、`resolveCanonicalPose()`、
`FOOT_CONTACT_TOLERANCE_MM`、Danger Zone、Safety Score、Collision Engine semantics、
Decision 3、C-2/C-3/C-4 Freeze、R4 geometry formulas）を一切変更していない。

## 1. Baseline

```
$ git status / git diff --stat / git diff --check / git rev-parse HEAD
HEAD (開始時) = 871b1c5926dd73d6bf5f823dfe6785f2aabc900a
HEAD (終了時) = 871b1c5926dd73d6bf5f823dfe6785f2aabc900a （不変）
source changes = NONE, staged = NONE, Commit = NONE, Push = NONE
```
既存の未コミット差分（modified 7ファイル、untracked doc群、`src/scenes/canonicalPose.ts`）は
前Taskから完全に不変であることを確認した。

## 2. Investigation — A. Depth Featureの実装箇所

Repo-wide search（`Depth|camera-relative|PageUp|PageDown|getWorldDirection`）で特定した、
Depth操作を担当する唯一の実装:

```
Component : DraggableProsthesis（src/scenes/SimScene.tsx、<Canvas>内にmount）
Handler   : onKeyDown（useEffect内、window.addEventListener('keydown', ...)、
            SimScene.tsx:1200-1284）
Gate      : isMove（dragMode==='move'時のみ有効。useEffectの依存配列にisMoveを持つ、
            SimScene.tsx:1200-1201）
Key       : PageUp / PageDown（e.key、既存Move矢印キー・Shift+矢印キーRotateとは別のキー、
            競合なし）
State     : useSimStore.placement.dragOffsetX/Y/Z（既存3フィールドを再利用、新規フィールドは
            追加しない）+ depthSessionQuat（Canvas-local React state、Depth Session中の
            Rendering Quaternion凍結用、D-4 Option①）
Vector    : camera.getWorldDirection(camDir)（react-three-fiberのuseThree()由来、実際の
            カメラ向きそのもの。ハードコードされたworld軸ではない）
```

## 3. Investigation — B. Expected Semantics（ソース・既存Decision文書から再確認）

推測ではなく、以下2箇所を直接読んで確認した:

**a. `SimScene.tsx:1211-1233`（実装コードそのもの）:**
```ts
const camDir = new THREE.Vector3();
camera.getWorldDirection(camDir);                       // カメラが向いている方向（画面奥へ）
const parentInverseRotation = new THREE.Matrix3().setFromMatrix4(
  new THREE.Matrix4().copy(group.parent.matrixWorld).invert(),
);                                                        // 回転成分のみ抽出（平行移動含まず）
const localDir = camDir.clone().applyMatrix3(parentInverseRotation).normalize();
                                                           // dragGroupRefと同じlocal座標系へ変換
const sign = e.key === 'PageDown' ? 1 : -1;
// PageDown = camDir方向（カメラが向いている方向＝画面奥、カメラから離れる）
// PageUp   = camDir逆方向（カメラに近づく、画面手前）
const depthDelta = localDir.multiplyScalar(sign * depthStep);
```
コード中コメント（1228-1231行）が明示的に「Interactive Validation（Test A/B）で画面上の
向きと一致することを実機確認する。符号が逆であればこの1行のsignのみを反転すればよい」と
記載しており、**この符号（PageDown=奥/away、PageUp=手前/toward）自体が、実機確認前提の
未確定パラメータとして設計されている**ことをコード自体が明言している。

**b. `docs/D4_Architect_Manipulation_Axis_Pose_Semantics_Decision_v1.0.md`（既存確定Decision、
D-4より前〜D-4着手時に確定済み）:**
```
7.1 方向選択: Camera-relative — 維持を推奨（変更なし）
「画面奥/手前へ動かす」というUser Intentそのものであり、合理的なUX設計である。
World-relative（固定軸）への変更は推奨しない。

Depth = Camera forward/backward movement（画面奥行き方向の移動）
実装欄: Camera-forward→coordGroupRef-local（動的）
```
この文書は「Depthはworld-axis relativeではなくcamera-relativeであるべき」という設計方針
自体は確定済みであることを示す一方、具体的な符号（PageDown=どちら向きか）についての実機
確認は、上記コードコメントの通り**未完了**であることが分かる。

**結論（DO NOT ASSUMEの遵守）**: Depth +/-は明確に**camera-relative**（world-axis relativeでは
ない）——これはソース・Decision文書の両方から確認した事実である。ただし「PageDown=奥/away
from camera」という具体的な符号の正誤は、実機での視覚的確認によってのみ確定できる、コード上
明示された未検証パラメータである。

## 4. Investigation — C. Collision Interaction

```
depthDelta（camera-relative candidate delta）
  ↓
evaluateDragCandidate(depthDelta)   ← Pointer Dragと完全に同一の関数（C-2、Frozen、無変更）
  ↓
testCanonicalCandidate(committed, {kind:'translate', localDelta: depthDelta}, ...)
  ↓
resolveCanonicalPose() + buildProsthesisCollisionProxy()   ← D-4 R4 Geometry Migrationで
                                                               PASS確定済みの経路、無変更
  ↓
testCollision()（実Bone MeshBVH）
  ↓
accept: dragOffsetX/Y/Zへ加算・updatePlacement()
reject: 何もしない（ただしmarkPositionTouched()は両分岐で呼ぶ）
```
（`SimScene.tsx:1234-1282`で直接確認。）Depth操作はPointer Dragと**同一のCollision Candidate
経路**（`evaluateDragCandidate`）を共有しており、独自の判定ロジックは一切追加されていない。
**D-4 R4 Geometry Migrationで確定したGeometry/MeshBVH Safety semanticsをDepth機能は変更せず、
そのまま利用するだけ**であることを確認した（本Taskのスコープを「Depth操作が既存collision
semanticsを正しく利用しているか」に限定するという指示と整合）。

## 5. Real-device Test A/B — 実行結果

このセッションで利用可能なBrowser paneで実行を試みた。**結果: NOT REPRODUCIBLE。**

### 環境確認
```
document.hidden          = true
document.visibilityState = "hidden"
```
過去6セッション（D-4-B Integrity Audit以降）と同一の、Canvas/React Three Fiber
`useEffect`ライフサイクルが機能しないBrowser pane環境であることを確認した。

### 実行手順と結果
実際にUI操作（Home→症例12→TTP-VARIAC PORP→ACサイザー→配置調整→「🧪 [TEST]
理想位置で配置を強制確定」）でPlacement段階まで到達し、`useSimStore`の`placement`を
直接読み取れる状態を確立した（Force Commit前後で`dragOffsetX/Y/Z=0`を確認）。

その状態で、`window.dispatchEvent(new KeyboardEvent('keydown', {key:'PageDown', ...}))`
（続けて`keyup`）を実行し、`useSimStore.getState().placement`の変化を確認した:
```js
before: {"dragOffsetX":0,"dragOffsetY":0,"dragOffsetZ":0, ...}
after:  {"dragOffsetX":0,"dragOffsetY":0,"dragOffsetZ":0, ...}   // 変化なし
```
**原因（2節参照）**: PageUp/PageDownの`keydown`リスナーは`DraggableProsthesis`
（`<Canvas>`内にmount）の`useEffect`内で`window.addEventListener`により登録される。
この`useEffect`自体が、Canvas子コンポーネントの通常のReact effectライフサイクルに依存して
おり、過去セッション（D-4 Post-Implementation Review、`project_kurz_d_track_case_ux`
メモリ参照）で「Canvas子コンポーネントの`useEffect`が一度も実行されない（mount counterが
一度もincrementしない、という直接証拠あり）」ことが確定している同一の制約下にある。
リスナー自体が登録されていないため、`window`へdispatchした`KeyboardEvent`を受け取る
ハンドラが存在せず、`dragOffsetX/Y/Z`が変化しないのは当然の帰結である——これは
Depth機能固有の新規バグではない。

## 6. Evidence（指定フォーマット）

```
Camera-relative Depth — Real Browser Validation

Environment:
- Browser pane環境（Claude Code CLI起動、document.hidden=true固定）
  ※ shojiさんの実際にvisual-compositedされている環境ではない（6節参照、実行不能の理由）
- Case: 症例12（ツチ骨・キヌタ骨欠損III型、PORP入門）
- Prosthesis: TTP-VARIAC PORP（porp-ttp-variac、BELL/BELL_TOP）
- Shaft Length: 2.5mm（実UIフローで到達した実際値、useSimStoreで確認）

Test A:
- Initial camera orientation: 確認不能（Canvas非compositing、視覚情報を取得できない）
- Initial prosthesis position: dragOffsetX/Y/Z=0（store値としては確認済み、視覚確認は不能）
- Input: PageDown（KeyboardEvent dispatchを試行）
- Expected direction: ソースコード上の設計（3節）＝camDir方向（画面奥、カメラから離れる）
- Observed direction: 観測不能（keydownハンドラが登録されていないため、dragOffsetX/Y/Z/
  depthSessionQuatいずれも変化せず、移動自体が発生しなかった）
- Result: NOT TESTED

Test B:
- Initial camera orientation: 確認不能
- Initial prosthesis position: 確認不能（視覚的には）
- Input: PageUp（未実施、Test Aが未実施のため後続テストも意味を持たないと判断し省略）
- Expected direction: camDir逆方向（画面手前、カメラに近づく）
- Observed direction: 観測不能
- Result: NOT TESTED

Camera Rotation Re-test:
- Camera orientation 1: 実施不能（Canvas操作・視覚確認いずれも不能）
- Depth +: 実施不能
- Depth -: 実施不能
- Camera orientation 2: 実施不能
- Depth +: 実施不能
- Depth -: 実施不能

Collision interaction:
- Safe candidate: 実施不能（Depth自体が発火しないため候補生成自体が発生しない）
- Near-contact: 実施不能
- Further movement toward Bone: 実施不能
- Movement stopped: 判定不能（YES/NOいずれも主張できない）

重要な確認事項：
- window.dispatchEvent(new KeyboardEvent('keydown', {key:'PageDown', ...}))を実行したが、
  useSimStore.getState().placementのdragOffsetX/Y/Zはdispatch前後で完全に同一の値のままだった。
- document.hiddenがtrueに固定されたBrowser pane環境で、過去6セッションと同一の制約
  （Canvas子コンポーネントのuseEffectが実行されない）が本機能でも再現した。
- これはDepth機能のロジック自体（camera-relative変換式、Collision Candidate接続）の欠陥
  ではなく、検証環境（このBrowser pane）がCanvas内部のイベントリスナー登録自体を実行できない
  ことに起因する、という切り分けをコード読解（2〜4節）と実測（5節）の両方で行った。

Evidence:
- Screenshot/video: NO（Canvas非compositing環境のため取得不能、`computer{action:"screenshot"}`
  自体が"the Browser pane is not displayed, so the page is not compositing frames"で
  失敗することも past sessionsで確認済み、本Taskでは再試行していない）
- Filename: N/A

Final assessment:
- Camera-relative Depth = PARTIAL
  （Investigation・既存Decision文書との整合性確認・Collision統合経路の確認は完了。
  実機Test A/Bの実行そのものは、このBrowser pane環境の制約によりNOT TESTEDのまま。
  「PASSだった」とは一切主張しない——単に「試せなかった」という事実のみを記録する。）
```

## 7. Finding: Depth Test A/Bは、このBrowser pane環境では原理的に実行不能

```
Finding:
  PageUp/PageDown Depth機能のkeydownハンドラは、<Canvas>内にmountされる
  DraggableProsthesis内部のuseEffectで登録される。このBrowser pane環境
  （document.hidden=true固定）では、Canvas子コンポーネントのuseEffectライフサイクルが
  機能しないため、このリスナー自体が一度も登録されない。

Evidence:
  - document.hidden=true / visibilityState="hidden"を実測（5節）
  - window.dispatchEvent(KeyboardEvent('keydown',{key:'PageDown'}))を実行したが、
    useSimStore.placement.dragOffsetX/Y/Zが一切変化しなかった（5節）
  - 同一原因（Canvas子useEffect非実行）は、D-4 Post-Implementation Reviewで
    mount counterによる直接証拠と共に既に確定済み（project_kurz_d_track_case_uxメモリ）、
    かつ前タスク（Shaft Geometry Real-device MeshBVH Validation）でも同一機構
    （baseAlignmentQuaternion未確立によるfail-closed）として6セッション連続で再現している

Impact:
  Camera-relative Depthの符号（PageDown=奥か手前か）・カメラ回転追従性いずれも、
  このBrowser pane環境では検証できない。実装自体（camDir変換式・Collision統合）は
  ソースコード読解で確認済みだが、「実際に画面上でどちらへ動くか」という視覚的事実は
  このセッションでは一切取得できない。

Recommended Next Investigation:
  shojiさんの実際にvisual-compositedされている通常のブラウザ環境で、6節Evidenceフォーマットの
  Test A/B・Camera Rotation Re-test・Collision interactionを実施する必要がある。
  実施手順（このドキュメント2〜4節の実装理解を前提）:
  1. PORP/BELL症例でPlacement段階まで進める（配置状態は任意、理想的にはBoneから離れた
     安全な位置）。
  2. 現在のカメラ向きを目視で記録する（例:「ほぼ正面視」「右へ約90°回転」等）。
  3. PageDownキーを押下し、プロステーシスが画面のどちら方向へ動くかを観察・記録する。
  4. PageUpキーで逆方向に動くか確認する。
  5. カメラをドラッグで回転させ、同じPageDown/PageUpが新しいカメラ向きに追従して
     「画面奥/手前」を保つか確認する（複数のカメラ角度で）。
  6. もし符号が視覚的直感と逆であれば、`SimScene.tsx:1232`の`const sign = e.key ===
     'PageDown' ? 1 : -1;`のみを反転すれば直る設計になっている（コード自体のコメントに
     明記済み）——ただし、この修正はArchitect承認と別Taskでの実施が前提（本Taskでは
     一切実装していない）。
```

## 8. Git Integrity

```
$ git status --short
（開始時と完全に同一——modified 7ファイル、untracked file一覧とも不変）
$ git diff --stat
（前Taskと同一、7ファイル・485 insertions/127 deletions）
$ git diff --check
（出力なし）
$ git rev-parse HEAD
871b1c5926dd73d6bf5f823dfe6785f2aabc900a （不変）
$ git diff --cached
（出力なし、staged=NONE）
```
```
HEAD unchanged   = YES
staged           = none
source changes   = NONE（本Taskはsource codeを一切変更していない）
temporary files  = none
Commit           = NONE
Push             = NONE
```

---

## Final Report

```
D-4 R4 Geometry Migration
= CLOSED
（Geometry=PASS, Collision Proxy Geometry=PASS, Actual MeshBVH Safety=PASS。
本Taskは一切変更していない。）

Camera-relative Depth
= PARTIAL
（Investigation完了: 実装箇所・camera-relative semantics・Collision統合経路をソースコードから
確認済み。実機Test A/Bの実行は、このBrowser pane環境の制約（Canvas子useEffect非実行、
6節Finding参照）によりNOT TESTED。「PASS」とは判定しない——観測事実がないため。）

Git:
HEAD unchanged: YES (871b1c5926dd73d6bf5f823dfe6785f2aabc900a)
source changes: NONE
commit: NONE
push: NONE
```

D-4 R4 Geometry MigrationとCamera-relative Depthの結果は独立して扱った——Depth機能の検証が
未完了であっても、D-4 R4 Geometry Migration（CLOSED、3層すべてPASS）の判定には一切影響しない。

## Architect Note

Camera-relative Depth機能のsemantics自体（camera-relative、world-axis固定ではない）は、
ソースコード・既存Decision文書の両方から明確に確認できた。Collision統合（`evaluateDragCandidate`
経由、D-4 R4 Geometryとの整合）も確認済みで、独自の判定ロジックは追加されていない。残る
唯一の未確認事項は、コード自体が明示的に「実機確認が必要」と記している符号（PageDown=奥か
手前か）とカメラ回転追従性の視覚的事実のみである。これは、このBrowser pane環境
（document.hidden=true固定）では原理的に取得できないことを実測で確認した——前Task
（Shaft Geometry MeshBVH Safety）がshojiさんの実機報告で解決した経緯と同じ構造であり、
次のステップは同様にshojiさんの実機ブラウザでの、本ドキュメント6節フォーマットに基づく
Test A/B実施である。

---

## 9. Initial Position Validation Path Investigation（2026-08-20、追記）

shojiさんの実機Test A/B結果（前回のTest A/B実施時）で、「ROTATION BOUNDARY WARP後の
狭い空間ではDepth+/-とcollision停止が視覚的に判定しづらい」というFindingを受け、
ROTATION BOUNDARY WARPをDepth validationの前提条件から外すための調査を行った。
**本節で調査した範囲では、ソースコードの変更は不要**（＝コードレベルでROTATION BOUNDARY
WARPがDepth操作の前提条件になっている箇所は存在しない）と判明した。以下に根拠を記す。

### 9.1 現在のDepth実装とROTATION BOUNDARY WARPの関係（Source確認）

**Depth（PageUp/PageDown）の実行条件**（`SimScene.tsx:1200-1201`）:
```ts
useEffect(() => {
  if (!isMove) return;             // dragMode==='move' のときのみkeydownリスナーを登録
  const onKeyDown = (e: KeyboardEvent) => {
    ...
    if (e.key === 'PageUp' || e.key === 'PageDown') { ... }
```
Depthが実行される条件は**`dragMode==='move'`（isMove）のみ**。`angleTilt`/`angleTiltZ`の値・
Rotation Boundary Warpを実行したかどうかを一切参照していない。

**Rotation Boundary Warpの実体**（`SimulationMode.tsx:946-953`, `1374-1381`）:
```
[TEST-ONLY, 一時] Phase C-3実機検証（Architect依頼2026-08-14）専用ツール。
tilt/tiltZ軸を「Bone手前・非衝突角度」まで探索してwarpさせる、Rotation Collision
Constraint（C-3）検証専用ボタン。Placement段階（manipulationCommitted=true）で完結し、
Depth（Translation/camera-relative）とは異なる軸・異なる状態（angleTilt/angleTiltZ）を
操作する、独立したTEST-ONLY機能。
```
Depth側のコードにも、Rotation Boundary Warp側のコードにも、**互いを参照する処理は存在しない**
（`grep`でも相互参照なしを確認済み）。

**「↺ すべてリセット」ボタンの実体**（`SimulationMode.tsx:1365-1369`）:
```ts
onClick={() => updatePlacement({
  lateralOffset: 0, anteriorOffset: 0, verticalOffset: 0,
  angleTilt: 0, angleTiltZ: 0,
  dragOffsetX: 0, dragOffsetY: 0, dragOffsetZ: 0,
})}
```
Position（lateral/anterior/vertical/dragOffset×3）とRotation（angleTilt/angleTiltZ）の
**両方を同時に0へリセットする**——Rotation Boundary Warpで傾けた角度も含めて、この1クリックで
「理想位置」（既知baseline: Danger Zone x=-1.56/y=2.62/z=1.41、Nearest 顔面神経3.31mm、
Score 85 の状態）へ戻る。

**結論**: ROTATION BOUNDARY WARPがDepth検証の前提条件になっていた原因は、**コード側の
依存関係ではなく、前回のTest A/B手順書（本ドキュメント6節）がテストの実行順序
（Rotation→Depth）だけを示し、各セクションの間で「↺ すべてリセット」を挟むことを明示して
いなかった、という手順書側の不備**である。shojiさんがチェックリストの記載順に沿って
Rotation Boundary Warpの直後にDepthも試したため、Warpで傾いた・骨に近い状態のまま
Depthを観察することになったと考えられる。**ソースコード側に修正の必要はない。**

### 9.2 Depth Calculationの数学的再検証（DO NOT ASSUMEの遵守）

推測（「camera-relativeだから正しい」）ではなく、以下を実際のsourceから確認した。

**A. `camera.getWorldDirection()`のvector向き**: インストール済みthree.jsパッケージ本体
（`node_modules/three/src/cameras/Camera.js:106-110`、`node_modules/three/src/core/
Object3D.js:1042-1050`）を直接読んだ。
```js
// Object3D.getWorldDirection(): ローカル+Z軸をworld化
target.set(e[8], e[9], e[10]).normalize();   // matrixWorldの第3列（local +Z）
// Camera.getWorldDirection(): 上記を反転
return super.getWorldDirection(target).negate();  // → local -Z軸のworld方向
```
Three.jsのカメラは規約上ローカル-Z方向を見る。したがって`camera.getWorldDirection()`は
**「camera → scene」方向（カメラが実際に見ている方向、画面奥へ向かうベクトル）**を返す
——「scene → camera」ではない。これはthree.js本体のソースコードで確認した事実であり、
推測ではない。

**B. PageUp/PageDown signとの整合性**: `SimScene.tsx:1232`
```ts
const sign = e.key === 'PageDown' ? 1 : -1;
const depthDelta = localDir.multiplyScalar(sign * depthStep);
```
Aで確認した通り`camDir`（＝`localDir`のworld版）は「camera→scene」方向。PageDown
（sign=+1）はこの方向そのままなので「カメラから離れる＝奥」、PageUp（sign=-1）は逆方向で
「カメラに近づく＝手前」。**コードのコメント記載（"PageDown=奥/away from camera"）と、
実際のvector計算・符号は数学的に整合している**（内部矛盾はない）。

**C. Candidate position（加算/減算）**: `canonicalPose.ts:96-104`（`resolveCanonicalPose`、
Frozen・無変更）
```ts
const translateDelta = candidate?.kind === 'translate' ? candidate.localDelta : ZERO_VECTOR;
const position = committed.basePos.clone()
  .add(new THREE.Vector3(committed.lateralOffset + committed.dragOffsetX, ...))
  .add(translateDelta);          // ← 常に加算（P' = P + delta）
```
Depth candidateは常に`P' = P + depthDelta`という**加算**で評価される。`depthDelta`自体に
すでに符号（B節のsign）が織り込まれているため、この加算がPageDown/PageUp双方に対して
正しく機能する——「P + F*d」（PageDown）「P - F*d」（PageUp、Fをcamera-forwardとした場合）
という、タスク提示の例と数式的に一致する形になっている。

**D. Camera orientation追従性**: `camDir`は`onKeyDown`ハンドラ内で**キー押下のたびに
毎回`camera.getWorldDirection(camDir)`を呼んで再計算**している（キャッシュ・セッション
開始時のスナップショットではない、`depthSessionQuat`とは別の変数）。したがって、
カメラが回転した状態でPageDownを押せば、その時点のカメラ向きに基づいた`depthDelta`が
毎回計算される——設計上、camera-relativeな追従性は保証されている。

**E. Coordinate space（world/camera/prosthesis local空間の区別）**: `camDir`
（world space）は`group.parent.matrixWorld`の逆行列の回転成分（`Matrix3`、平行移動を
含まない）で`dragGroupRef`のローカル空間へ変換されている。`dragGroupRef`の親chainを
JSXから追跡した:
```
dragGroupRef（DraggableProsthesis内、position=[0,0,0]で宣言）
  ↑ 親: drei TransformControlsが内部で生成する<group>（node_modules/@react-three/drei/
        core/TransformControls.js:109-111で確認。実際に渡されるpropsに位置/回転/scaleは
        含まれない。ジオメトリ操作対象としてcontrols.attach()されるが、mode="translate"の
        gizmoが位置のみを動かす対象であり、通常時（gizmoドラッグ中でない限り）は
        position=[0,0,0]・回転/scaleなしのまま）
  ↑ 親: prosthesisGroupRef（SimScene.tsx:2521、transform props一切なし＝恒等）
  ↑ 親: coordGroupRef（SimScene.tsx:2432、rotation=[π,-π/2,0]のみ、scaleは指定なし＝
        既定の(1,1,1)）
```
**scaleを持つ祖先が経路上に存在しない**ことを確認した——`Matrix4.invert()`してから
`Matrix3.setFromMatrix4()`で3x3を抽出する手法（「フル行列を反転してから3x3を取り出す」）は、
一般にscaleを含む行列では単純な「回転成分のみの逆行列」と一致しない場合があるが、
本経路にはscaleが存在しないため、この技法は数学的に正しく回転のみの逆変換として機能する。

さらに、この技法は**`useScreenSpaceDrag`（`ManipulationLayer.tsx:297-298`、Pointer Drag、
既存の確立された操作）とバイト単位で同一のコード**であることを確認した:
```ts
// useScreenSpaceDrag（Pointer Drag、既存）
const parentInverse = new THREE.Matrix4().copy(group.parent.matrixWorld).invert();
const parentInverseRotation = new THREE.Matrix3().setFromMatrix4(parentInverse);
// Depth（SimScene.tsx）— 同一
const parentInverseRotation = new THREE.Matrix3().setFromMatrix4(
  new THREE.Matrix4().copy(group.parent.matrixWorld).invert(),
);
```
（さらに、Transport段階専用の**もう1つの独立したDepth実装**が`ManipulationLayer.tsx:
490-504`に存在し、これも同一技法を使っていることを確認した——Depth機能はPlacement段階
（SimScene.tsx）とTransport段階（ManipulationLayer.tsx）の2箇所に個別実装されている。）

**結論（9.2節全体）**: A〜Eいずれについても、コード上の実装は内部的に数学的一貫性があり、
かつ「camera→scene」の意味を持つベクトルを正しく使っている。また、Depthの座標変換技法は
既存の（動作実績があると前提される）Pointer Drag実装（`useScreenSpaceDrag`）と完全に同一
であり、Depth固有の新しい数式上のバグは本調査では発見されなかった。**shojiさんが観察した
「真っすぐ動いていないように見えた」という現象は、9.1節で特定した「Rotation Boundary Warp後の
狭い・傾いた空間での観察」という条件に起因する可能性が高い**——ただし、これは推論であり、
9.3節のクリーンな初期位置での再テストによってのみ確定できる。

### 9.3 Minimal Validation-path Implementation

**実装は不要と判断した。** 9.1節の通り、Depthの実行条件（`isMove`のみ）にRotation
Boundary Warpとの依存関係はコード上存在しない。必要なのは実装変更ではなく、**検証手順の
訂正**のみである——次節に修正済みチェックリストを記載する。

## 10. 修正版 Real-device Test A/B（初期位置ベース、ROTATION BOUNDARY WARPなし）

```
前提条件（必須、テスト開始前に必ず実行）:
[ ] Case-012 / TTP-VARIAC PORP / Shaft Length表示 2.0mm（実際のstore値は2.5mmの場合がある、
    docs/D4_Final_PORP_MeshBVH_Safety_Revalidation_v1.0.md §4参照——値の相違自体は
    本検証に影響しない）
[ ] Placement段階に到達（「🧪 [TEST] 理想位置で配置を強制確定」、または通常のDrag&Drop配置）
[ ] 「↺ すべてリセット」をクリックし、angleTilt/angleTiltZ/dragOffsetX/Y/Zすべてが0で
    あることを確認する（Rotation Boundary Warpは今回使用しない）
[ ] Safety Debugパネル（?debug=coords）で既知baseline一致を確認:
    Danger Zone x=-1.56/y=2.62/z=1.41, Nearest 顔面神経3.31mm, Score=85
[ ] 操作モードが「移動」（isMove=true）になっていることを確認する（「回転」ではない）
    ——Depth機能は移動モードのときのみ動作する（9.1節）

Test A — Initial Camera Orientation:
  Initial Position: 上記前提条件を満たした状態（理想位置、Bone等から適切な距離）
  Camera orientation: [実機で目視記録、例:「ほぼ正面視」]
  Input: PageUp
  Observed direction: [実際に観察した移動方向]
  Input: PageDown
  Observed direction: [実際に観察した移動方向]
  Expected direction: PageUp=カメラに近づく方向（手前）、PageDown=カメラから離れる方向（奥）
  Match: YES / NO

Test B — Rotated Camera Orientation:
  ROTATION BOUNDARY WARPは使用しない。3Dビューを手でドラッグしてカメラ視点のみを回転させる
  （プロステーシス自体のRotationではない）。
  Camera orientation: [実機で目視記録、例:「右へ約90°回転」]
  Input: PageUp / PageDown
  Observed direction: [実際に観察した移動方向]
  Expected direction: 常にカメラ視点基準で「手前/奥」（世界座標の固定軸ではない）
  Match: YES / NO
  （可能なら複数のカメラ角度で追加確認）

Collision interaction（今回のPageUp/PageDownの範囲で、Boneに近い方向がある場合のみ）:
  Safe candidate: ACCEPT / REJECT
  Near-contact: ACCEPT / REJECT
  Further movement toward Bone: ACCEPT / REJECT
  Movement stopped（bounceでない）: YES / NO
  ※目的はD-4 MeshBVH Safetyの再検証ではなく、Depth操作が既存Collision semanticsを正しく
    利用しているかの確認に限定する（D-4 R4 Geometry Migrationは既にCLOSED、変更対象外）。

重要な確認事項：
- [実際に観察した事実のみを記録、推測・評価は書かない]

Evidence:
- Screenshot/video: YES / NO
- Filename:

Final assessment:
- Camera-relative Depth = PASS / FAIL / PARTIAL
```

## 11. 本Taskでの実行結果

**Investigation（1〜9節）: 完了。** ソースコード・three.js本体・既存Decision文書から
Depth semantics・座標変換・Collision統合を再確認し、Rotation Boundary WarpとDepthの
コード上の依存関係がないことを確定した。実装変更は不要と判断し、一切行っていない。

**Real Browser validation（このセッションでの実行試行）: NOT REPRODUCIBLE。** 前Taskと
同一のBrowser pane環境で`document.hidden`状態を再確認したところ、依然として`true`固定
であり（8回目の同一確認）、Canvas子コンポーネントのuseEffectライフサイクル制約により
実行できなかった。このセッションではこれ以上の再試行は行わず（同一環境での反復に
合理性がないため）、10節の修正版チェックリストをshojiさんの実機検証用に用意した。

**Static Verification**: `npx tsc -b`実行、0エラー（ソース変更していないため必須ではないが、
参考として実施）。`npm run build`/`npx eslint .`は実行していない（前回確認済みの結果
PASS/161から変化する要因（source変更）が存在しないため）。

## 12. Final Assessment（本Task）

```
D-4 R4 Geometry Migration
= CLOSED（変更なし、維持）

Camera-relative Depth
= PARTIAL
（Investigation完了、数式・Collision統合ともに問題は発見されなかった。Rotation Boundary
Warpとの依存関係はコード上存在しないことを確定——検証手順の訂正のみで、初期位置からの
Depth検証が可能になる。実機でのTest A/B実行そのものは、このBrowser pane環境の制約により
本Taskでも実施できず、引き続きPARTIALのまま。10節の修正済みチェックリストをshojiさんの
実機検証用に用意した。）

Git:
HEAD unchanged: YES (871b1c5926dd73d6bf5f823dfe6785f2aabc900a)
source changes: NONE
commit: NONE
push: NONE
```

## Architect Note（追記）

今回の調査で最も重要な発見は、「ROTATION BOUNDARY WARP後にDepthが真っすぐ動かないように
見えた」というFindingの原因が、**Depth機能の実装（数式・Collision統合）ではなく、検証手順
（Rotation Boundary Warpで傾いた状態のままDepthも試した）にある可能性が高い**、という
切り分けである。ソースコード・three.js本体・既存Decision文書の再確認により、Depth
calculationの数式自体（camera.getWorldDirection()の向き、PageUp/PageDown signとの整合性、
加算によるcandidate生成、camera回転への追従性、scaleを含まない座標変換経路）に矛盾は
見つからず、かつPointer Dragの既存実装（useScreenSpaceDrag）と完全に同一の技法であることも
確認した。したがって実装は一切変更していない。次のステップは、10節の修正済みチェックリスト
（「↺ すべてリセット」で理想位置へ戻してからDepthのみを検証する）を用いた、shojiさんの
実機での再テストである。

---

## 13. Follow-up Investigation — 10〜20°斜め下方向成分のRoot Cause（2026-08-20）

shojiさんが10節の修正済みチェックリスト（ROTATION BOUNDARY WARPなし、「↺ すべてリセット」
後の初期位置から）で実機再検証した結果、Camera-following（PASS）・Forward/Reverse対称性
（PASS）は確認できたが、「手前」移動時に視覚的に「camera方向＋約10〜20°の下方向成分」が
観測された、というFindingを受けて実施した追加調査である。**本節でもコードは一切変更して
いない。**

### 13.1 D-4 R4 Geometry Migrationの状態（再確認・変更なし）
```
Geometry / Collision Proxy Geometry / Actual MeshBVH Safety = すべてPASS、CLOSED
本Taskで変更したコードなし（Candidate B radius、+0.15mm、resolveCanonicalPose()、
FOOT_CONTACT_TOLERANCE_MM、Danger Zone、Safety Score、Collision Engine semantics、
Decision 3、C-2/C-3/C-4 Freezeいずれも無変更）。
```

### 13.2 Depth候補生成の全経路（world→local→acceptance→render）

指示（4節）通り、`camera.getWorldDirection()`の確認だけで終わらせず、最終的にrenderされる
world-space translation vectorまで追跡した。

```
1. camera.getWorldDirection(camDir)                         [SimScene.tsx:1222]
   → world space、camera→scene方向（前回9.2節Aでthree.js本体ソースから確認済み、再確認せず）

2. parentInverseRotation = Matrix3(invert(group.parent.matrixWorld))  [SimScene.tsx:1223-1225]
   group.parent = coordGroupRef（前回9.2節Eで確認したTransformControls/prosthesisGroupRef
   経由の親chain、rotation=[π,-π/2,0]のみ・scaleなし）

3. localDir = camDir.applyMatrix3(parentInverseRotation).normalize()  [SimScene.tsx:1226]
   → coordGroupRef-local space（dragOffsetX/Y/Zと同じ意味の空間）

4. depthDelta = localDir * sign * depthStep                  [SimScene.tsx:1232-1233]
   sign: PageDown=+1（camDir方向）/ PageUp=-1（camDir逆方向）

5. evaluateDragCandidate(depthDelta)                          [SimScene.tsx:1237]
   → testCanonicalCandidate({kind:'translate', localDelta: depthDelta}, ...)
   → resolveCanonicalPose(committed, candidate).position
      = basePos + (lateral+dragOffsetX, vertical+dragOffsetY, anterior+dragOffsetZ) + translateDelta
      （canonicalPose.ts:96-104、加算のみ、Frozen・無変更）
   → buildProsthesisCollisionProxy() → testCollision()（実Bone MeshBVH、R4 Geometry、無変更）

6. accept時: dragOffsetX/Y/Z += depthDelta（clamp3適用）→ updatePlacement()  [SimScene.tsx:1238-1279]

7. Rendering: DraggableProsthesis → ProsthesisModel の
   lateralOffset={lateralOffset+dragOffsetX}, anteriorOffset={anteriorOffset+dragOffsetZ},
   verticalOffset={verticalOffset+dragOffsetY} → poseOverride（canonicalPoseOverride、
   resolveCanonicalPose(committed)、candidate省略）→ <group position={[mid.x,mid.y,mid.z]}>
   → これはcoordGroupRef配下のローカル座標として解釈される（<group ref={coordGroupRef}
   rotation=[π,-π/2,0]>の内側にネストされているため）
```
6・7節はいずれもD-4 R4 Geometry Migrationで既にPASS確定済みの経路であり、本Taskでは
一切変更していない（4節冒頭の禁止事項を遵守）。

### 13.3 数学的検証: depthDeltaは最終的に本当にcamDirと平行か

Node.js標準スクリプト（`node_modules/three`利用、`src/`は変更せず、実行後削除済み）で、
上記1〜4の式をsourceから複製し、**depthDeltaがcoordGroupRef-localとして格納された後、
render時に再びcoordGroupRefの回転で world 空間へ戻した場合に、元のcamDirと完全に一致するか**
を検証した（往復変換のロスレス性を検証＝Case A/B切り分けの核心）。

```
camDir = worldDirection、depthDeltaLocal = camDir を coordGroupRef^-1 で変換
worldDelta = depthDeltaLocal を coordGroupRef で再変換（＝実際にrenderされる時にたどる変換）
angle = acos(dot(normalize(worldDelta), normalize(camDir)))

【Case 1】デフォルト概観カメラ（_SIM_DEFAULT: pos=[-37.88,-22.35,45.84], target=[2.12,14.65,-2.16]）
  camDir       = (0.550847, 0.509534, -0.661017)
  depthDelta(local) = (0.330508, -0.254767, -0.275424)
  worldDelta   = (0.275424, 0.254767, -0.330508)
  angle(worldDelta, camDir) = 0.000000°

【Case 2】カメラを大きく回転（同じtarget、位置のみ変更）
  camDir       = (-1.000000, 0.000000, 0.000000)
  worldDelta   = (-0.500000, 0.000000, 0.000000)
  angle(worldDelta, camDir) = 0.000000°

【Case 3】カメラがSTAPES_HEAD（プロステーシス位置）を直接注視する場合
  camDir       = (0.742781, -0.371391, -0.557086)
  worldDelta   = (0.371391, -0.185695, -0.278543)
  angle(worldDelta, camDir) = 0.000000°
```

**3種類のカメラ配置いずれでも、angle = 0.000000°（machine precision一致）。**
`Matrix3(invert(coordGroupRef.matrixWorld))`で world→local へ変換し、その後
`Matrix3(coordGroupRef.matrixWorld)`で local→world へ戻す往復変換は、数学的に完全に
ロスレスである（coordGroupRef経路にscaleが存在しないことは前回9.2節Eで確認済み——
scaleがあれば往復でロスレスにならない可能性があったが、この経路にはない）。

**これは、Depth candidateとして最終的にrenderされるworld-space displacement vectorが、
`camera.getWorldDirection()`が返す真のcamera forward方向と寸分違わず平行であることの
直接的な数学的証明である。** 座標変換（world↔coordGroupRef-local）のどこにも角度誤差は
混入していない。

### 13.4 Case A / Case B の切り分け（8節の指示に対する回答）

```
Case B（Depth implementationまたは後段のcoordinate transformationに問題がある）
= 明確に否定できる（NOT CONFIRMED、根拠：13.3節、angle=0.000000°を3ケースで実証）

Case A（camera.getWorldDirection()自体が実機で見た「斜め下方向」に対応している、
       cameraのpitch/orientationによる正常な結果）
= 有力（PLAUSIBLE、13.5節でさらに定量的に補強）
```

### 13.5 「斜め下」の定量的説明（Off-axis Perspective Projection）

Depth vector自体に誤差がないとすれば、視覚的な「斜め下」はどこから来るのか。
**プロステーシスが画面中心（カメラの光軸）からずれた位置に表示されているために生じる、
遠近法（Perspective Projection）の正常な性質**という仮説を、実際のsource定数で検証した。

Three.jsの透視投影下では、カメラの真の前進方向（forward vector）に沿って移動する物体は、
画面中心（消失点）へ向かう直線を描く——**物体が画面中心にちょうど写っていない限り**、
その物体を「奥へ」動かすと画面中心へ向かって（＝現在位置から中心への方向へ）ドリフトして
見え、「手前へ」動かすとその逆（中心から遠ざかる方向）にドリフトして見える。これは
実装のバグではなく、遠近法カメラの幾何学的な性質である。

```
STAPES_HEAD（プロステーシス基準点、OssicleModels.tsx）のworld座標:
  (-3.526, 0.027, 0.725)

アプリのデフォルト概観カメラ（Canvas fov=38、SimScene.tsx:2394、_SIM_DEFAULT位置/target）
での画面上位置（NDC、(0,0)=画面中心、+y=上）:
  (-0.0676, -0.4641)   ← 画面中心よりかなり下（-0.46）に表示される

カメラ光軸とSTAPES_HEADへの視線のなす角:
  9.373°
```
このデフォルトカメラの数値だけでも、プロステーシスが画面中心より明確に下側に表示されており、
その角度のオーダー（約9°）は今回報告された「10〜20°」と同じ桁である。shojiさん実機での
実際のカメラ位置（`localStorage`に保存された視点、または操作中に手動調整した視点）は
このデフォルト値とは異なる可能性が高いため、この9.373°という数値そのものが「10〜20°」と
一致することを主張するものではない——**あくまで「同じ現象・同じオーダーの角度が、
実装のどこにも手を加えずに、単純な幾何学（プロステーシスが画面中心からどれだけ離れているか）
だけから自然に生じる」ことを示す一例**として提示する。

**方向の整合性**: STAPES_HEADは画面中心より「下」に表示される（NDC y=-0.46）。この場合、
物体が画面中心（消失点）から遠ざかる方向＝画面上でさらに「下」に描画される。shojiさんの
Observation 2（「手前」移動＝カメラに近づく＝画面中心の消失点から遠ざかる方向）で
「下方向成分」が観測された、という報告の**向きも、この幾何学的予測と一致する**
（物体が中心より下にある状態で、カメラに近づく＝消失点効果が弱まる方向に動けば、
画面上ではより下側へ変位して見える）。

### 13.6 Depth vs useScreenSpaceDragの数式比較（再確認）

前回9.2節Eで確認済みの通り、両者は完全に同一のコード（`Matrix4(parentMatrixWorld).invert()`
→`Matrix3.setFromMatrix4()`）を使用している。Pointer Drag（`useScreenSpaceDrag`）でも
同じ座標変換を経由しているため、もし変換自体にバグがあれば、Pointer Dragでも同様の角度誤差が
生じるはずである——Pointer Dragについては今回・前回いずれのFindingでも角度誤差の報告は
ない。これは13.3節の数学的証明（angle=0.000000°）と整合する、傍証的な追加確認である。

## 14. Camera-relative Depth — Follow-up Investigation（指定フォーマット）

```
Camera-relative Depth — Follow-up Investigation

Real-device finding:
- Camera-following: PASS
- Forward/reverse symmetry: PASS
- Approx. 10°〜20° downward deviation: OBSERVED

Source-level result:
- Camera forward vector: camera.getWorldDirection()、world space、camera→scene方向
  （three.js本体ソースで確認済み、前回9.2節A）
- Depth movement vector: coordGroupRef-localへ変換 → dragOffsetX/Y/Zへ加算 →
  resolveCanonicalPose()でrender → 再びcoordGroupRefの回転でworld空間へ戻した結果、
  camera forward vectorとangle=0.000000°で完全に平行（13.3節、3カメラ配置で実証）
- Angle difference: 0.000000°（コード上のvector変換経路には、実測可能な角度誤差なし）
- Downward component origin: Depth vector自体ではなく、プロステーシス（STAPES_HEAD近傍）が
  カメラのOrbitControls target（アプリ全体を見渡す概観点、プロステーシスの位置とは別）から
  見て画面中心からずれた位置に表示されているために生じる、遠近法（perspective projection）の
  正常な幾何学的性質である可能性が高い（13.5節、デフォルトカメラで9.373°という同オーダーの
  角度・同じ方向性を定量的に確認）。

Root Cause:
- NOT CONFIRMED（Case Aとして強く示唆されるが、shojiさん実機での正確なカメラ位置・
  プロステーシスの画面上位置を測定していないため、「これが100%の原因」と断定するだけの
  直接証拠はない。Case B（実装のvector変換バグ）は13.3節の数学的証明により明確に否定できる。）

Impact:
- NONE（Case Aが正しい場合。Depth machine自体は数学的に正しく、視覚的な「斜め下」は
  カメラ視点とプロステーシスの画面上位置関係から生じる正常な遠近法効果であり、
  camera-relative semantics・Collision Constraint・D-4 R4 Geometryのいずれにも
  実装上の問題は存在しない。）

Recommended next task:
- shojiさんの実機で、Depth操作中にプロステーシスを画面中心付近に捉えた状態
  （カメラをプロステーシスへズーム/パンして中心に置いた状態）で再度PageUp/PageDownを
  観察する。Case Aが正しければ、この条件下では「斜め下」成分が明確に減少・消失するはずである
  （13.5節の幾何学的予測）。もしプロステーシスを画面中心に捉えた状態でも同程度の斜め下成分が
  残る場合は、Case Aでは説明できないため、Case B（未発見の実装上の問題）の可能性を再検討する
  必要がある——ただしそれでもD-4 R4 Geometry Migration・Collision Engineには触れず、
  Depth機能固有の座標変換のみを対象とする。

Current status:
Camera-relative Depth = PARTIAL

Git:
HEAD unchanged: YES (871b1c5926dd73d6bf5f823dfe6785f2aabc900a)
source changes: NONE
commit: NONE
push: NONE
```

## Architect Note（Follow-up、追記）

今回の調査で最も重要な成果は、「Depth candidateとして計算されるworld-space vectorが、
camera.getWorldDirection()と完全に平行（angle=0.000000°）であること」を、実際のsource式を
複製した数値計算で3通りのカメラ配置について証明した点である。これによりCase B
（実装・座標変換のバグ）は明確に否定できる。一方、報告された「10〜20°の斜め下」という
視覚的Observationは、プロステーシスが画面中心からずれた位置に表示されている場合に生じる、
遠近法カメラの正常な幾何学的性質（Case A）として、デフォルトカメラの実測値（9.373°、
同じ方向性）で定量的に裏付けられた。ただし、shojiさん実機での正確なカメラ状態を測定した
わけではないため、Root Causeは「NOT CONFIRMED」のまま——Recommended next task
（プロステーシスを画面中心に捉えた状態での再テスト）がCase A/Bを最終的に切り分ける。

---

## 15. Final Real-device Validation & Closure（2026-08-20）

shojiさんが14節「Recommended next task」（プロステーシスを画面中央付近に捉えた状態での
再テスト）を実施し、結果を報告した。本節はその反映と、Camera-relative Depthの最終判定である。
**本節でもコードは一切変更していない。**

### 15.1 追加のReal-device Evidence（shojiさん報告）

```
手順: ↺すべてリセット → ROTATION BOUNDARY WARP不使用 → cameraを調整し、
      prosthesisを画面中央付近に配置 → 手前方向へDepth操作

結果: prosthesisを画面中央付近で手前に動かしたところ、比較的真っすぐ移動させることができた。
```
前回（13/14節）の「画面中心からずれた位置での手前移動時、約10〜20°斜め下に見えた」という
Observationは、本ドキュメントから削除せず、そのまま維持する（3節の指示通り）。

### 15.2 Evidenceの統合評価

**過剰な断定をしないこと**（4節の指示）を踏まえ、以下を明確に区別して記述する。

```
Source / Mathematical Verification（13.3節、実機測角ではない）:
  camera-forwardとfinal rendered displacementのworld-space角度差 = 0.000000°
  （3種類のcamera configurationについて、実sourceの式をそのまま複製した数値計算による。
  実機でこの角度を測定したわけではない——これは「coordinate-transform自体には角度誤差が
  混入する余地がない」という、コードの数学的性質の証明である。）

Real-device Evidence（今回15.1節・前回13/14節、実際の目視観察）:
  - Camera rotationへの追従: 確認済み（PASS）
  - Forward/Reverse対称性（元の位置へ復元）: 確認済み（PASS）
  - 複数camera視点での再現性: 確認済み（PASS）
  - 画面中心付近でのDepth移動: 比較的真っすぐ見えた（今回、新規Evidence）
  - 画面中心からずれた位置での斜め下方向の視覚的偏差: 観測された（前回、維持）
```

**両者を組み合わせた解釈**: 「画面中心からずれた位置では斜めに見えるが、画面中心付近では
まっすぐに見える」という実機Observationのパターンは、13.5節で定量的に示した「Off-center
prosthesis→Perspective projection→True camera-forward movementがscreen-spaceでは斜め方向に
見える」という仮説が予測する挙動と**方向性・条件依存性の両方で一致する**（画面中心付近では
off-axis角度がゼロに近づくため、遠近法による見かけの偏差も縮小するはずであり、実際にそう
観測された）。これは、Source/Mathematical Verification（coordinate-transformに角度誤差が
ないこと）と、Real-device Evidence（画面中心では真っすぐ、中心からずれると斜めに見える、
という条件依存的な視覚パターン）という、**独立した2種類のEvidenceが互いを裏付け合っている**
状態である。

**結論として述べられること**: 「実機で0°を証明した」わけではない——実機で測角は行っていない。
正確には、(a) source/mathの数値検証で座標変換に角度誤差がないことを確認し、(b) 実機で
「画面中心では真っすぐ、中心からずれると斜めに見える」という、遠近法仮説と整合するパターンが
観測された、という**複数の独立したEvidenceが、Camera-relative Depthが正しく動作していることを
十分に支持している**、という言い方が正確である。

### 15.3 Final Validation Criteria（総合判定）

```
Camera-relative behavior:
  Camera rotation → Depth direction changes accordingly
  = PASS（実機確認済み、13節）

Forward / Reverse symmetry:
  Depth toward → movement / Depth away → reverse movement → original position restored
  = PASS（実機確認済み、前回Task）

Camera viewpoint change re-test:
  camera視点を変更しても同様のcamera-relative behaviorを維持
  = PASS（実機確認済み、13節）

Center-screen validation:
  prosthesisを画面中央付近に配置した場合、Depth towardの移動が比較的真っすぐ見える
  = PASS / OBSERVED（実機確認済み、15.1節、今回新規）

Mathematical validation:
  final rendered displacement vs true camera-forward, angle = 0.000000°
  = 数値確認済み（13.3節、source formulasによる計算、実機測角ではない）

Initial off-center downward visual deviation:
  画面中心からずれた位置での約10〜20°の視覚的偏差
  = OBSERVED（前回13/14節、削除せず維持。Center-screen validationとMathematical
    Verificationの両方と整合する説明（Off-axis perspective projection）が存在するため、
    実装上の欠陥という解釈は採用しない）
```

### 15.4 Final Status

```
Camera-relative Depth = PASS

根拠: Camera-relative behavior・Forward/Reverse symmetry・Camera viewpoint change・
Center-screen validationの4項目すべてが実機でPASS/OBSERVEDであり、かつMathematical
Verificationがcoordinate-transform自体に角度誤差がないことを裏付けている。初回観測された
斜め下方向の視覚的偏差は、削除せずEvidenceとして維持した上で、Off-axis Perspective
Projectionという、実機Evidence（中心では真っすぐ・中心以外では斜め）とMathematical
Verification（変換自体に誤差なし）の両方と整合する説明によって、実装上の欠陥ではないと
判断した。

D-4 R4 Geometry Migration = CLOSED

（維持。本Taskの範囲でCandidate B radius、+0.15mm、resolveCanonicalPose()、
FOOT_CONTACT_TOLERANCE_MM、Danger Zone、Safety Score、Collision Engine semantics、
Decision 3、C-2/C-3/C-4 Freezeいずれも一切変更していない。Camera-relative DepthのPASSに
伴ってD-4 R4 Geometry Migrationを再OPENしていない。）
```

### 15.5 Git Integrity

```
$ git status --short / git diff --stat / git diff --check / git rev-parse HEAD / git diff --cached
HEAD unchanged = YES (871b1c5926dd73d6bf5f823dfe6785f2aabc900a)
source changes = NONE
staged = NONE
Commit = NONE
Push = NONE
```

---

## Final Report

```
Camera-relative Depth — Final Validation

Real-device Evidence:
- Camera rotation changes Depth direction: PASS
- Forward / reverse symmetry: PASS
- Camera viewpoint change re-test: PASS
- Center-screen Depth movement: PASS / OBSERVED
- Initial off-center downward visual deviation: OBSERVED

Mathematical Verification:
- Final displacement vs camera-forward: 0.000000°
  （source formulasの数値計算による。実機測角ではない。）

Interpretation:
- Off-center visual deviation is consistent with perspective projection
  （画面中心付近でのRe-testで偏差が縮小したという実機Evidenceと、coordinate-transformに
  角度誤差がないというMathematical Verificationの両方が、この解釈を支持する）。
- No coordinate-transform defect identified.

Final status:
Camera-relative Depth = PASS

D-4 R4 Geometry Migration = CLOSED

Git:
HEAD unchanged: YES (871b1c5926dd73d6bf5f823dfe6785f2aabc900a)
source changes: NONE
commit: NONE
push: NONE
```

## Architect Note（Final Closure）

Camera-relative Depthの検証は、Investigation（実装箇所・semantics・Collision統合の確認）→
Source-level Mathematical Verification（coordinate-transformの角度誤差なしを数値証明）→
Real-device Validation（Camera-following/Symmetry/視点変更/中心画面での直線性）という3段階を
経てPASSと判定した。初回観測された斜め下方向の視覚的偏差は、単なる「未解決の疑問」として
放置するのではなく、削除せずEvidenceとして保持した上で、独立した2種類の追加Evidence
（画面中心でのRe-test、および座標変換の数学的検証）によって、実装上の欠陥ではなく遠近法の
正常な性質であるという説明で裏付けた。D-4 R4 Geometry Migration（Geometry/Collision Proxy/
Actual MeshBVH Safetyすべて PASS、CLOSED）は本Task全体を通じて一切変更していない。
実装は一切変更していない。
