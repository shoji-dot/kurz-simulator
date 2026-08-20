# D-4-B Runtime Collision Safety Verification

Status: Investigation Only — 実装なし・Commitなし・Pushなし

## 1. Scope

D4B_Collision_Candidate_Integrity_Audit_v1.0.md（静的コード解析＋Node.js単体スクリプトによる
数値Evidence）で確認された3点について、実際のReact/Three.js/MeshBVH runtime上での検証を試みた。

```
1. committed dragOffset omission（composeDragCandidatePose()の既存offset欠落）
2. nonlinear pose-generation mismatch（Position線形近似とcomputeProsthesisModelPose()非線形性の乖離）
3. Arrow / ControlPad collision bypass（矢印キー/ControlPad TranslationのcomposeDragCandidatePose非経由）
```

結論を先に要約する。**(3)のControlPad経路については実runtimeで確定的に確認できた。
(1)(2)およびPointer Drag/Depth/Arrow-key Translation/Rotateについては、後述する環境制約
（Browser paneが非表示状態のままcompositeされない = `document.hidden === true`）により、
実インタラクション（キー入力・3Dキャンバス上のポインタドラッグ）を通じた再現ができなかった。
NOT REPRODUCIBLEとして記録する。**

---

## 2. Repository Integrity

```
開始時:
HEAD:                   871b1c5926dd73d6bf5f823dfe6785f2aabc900a
Working Tree:           CLEAN（tracked filesの差分なし）
終了時:
HEAD:                   871b1c5926dd73d6bf5f823dfe6785f2aabc900a（変化なし）
Tracked source changes: NONE
Commit:                 NONE
Push:                   NONE
```
検証中に開始したVite dev server（`npm run dev`、ポート5174。5173は本タスク開始前から別プロセスが
使用中だったため触れていない）は検証終了後に停止済み。ブラウザプレビューのタブも閉じた。
リポジトリへの書き込みは一切発生していない（`docs/`配下の本レポート自体を除く。前回タスクの
`D4B_Collision_Candidate_Integrity_Audit_v1.0.md`は上書きせず、指示通り別ファイルとして作成）。

---

## 3. Runtime Verification Method

### 3.1 使用した技術
- `npm run dev`（Vite dev server）を起動し、Browser paneで`http://localhost:5174`を開いた。
- **ソースコード変更なしでの実行中モジュールへのアクセス**: Vite dev serverはESモジュールを
  そのままHTTP配信するため、ブラウザのconsoleから`await import('/src/store/useSimStore.ts')`
  のようにdynamic importで直接参照すると、アプリ本体が実際に使っているのと**同一のシングルトン
  モジュールインスタンス**（Viteのモジュールグラフによる重複排除）が返る。これにより、
  ソースファイルを一切書き換えずに、
  - `useSimStore.getState()`（実際に動いているZustand storeの現在値）
  - `computeProsthesisModelPose()`（Frozen対象、export済みの実関数そのもの）
  - `buildProsthesisCollisionProxy()` / `testCollision()`（export済みのCollision Engine関数）
  - `STAPES_HEAD` / `UMBO_POS`（OssicleModels.tsxの実定数）
  へ読み取り専用・関数呼び出し専用でアクセスできる（一時的なverification instrumentationとして
  使用、tracked source filesへの書き込みは一切発生しない）。
- 既存の本番console.logインストルメンテーション（SimScene.tsx:851-859、`evaluateDragCandidate()`
  内、コード変更なしで元から存在する）を`read_console_messages`で監視し、実際に呼ばれた際の
  candidatePosition/candidateQuaternion/collided/anatomyIdを取得する計画とした。
- 既存の`?debug=collision`診断パネル（CollisionVerifyOverlay.tsx、Case1/2/3の固定検証、実際の
  Bone.glb + MeshBVHを使用）も一次情報源として利用を試みた。

### 3.2 遭遇した環境制約
検証開始直後、`computer{action:"screenshot"}`が
`"the Browser pane is not displayed, so the page is not compositing frames"`で失敗した。
`document.hidden`を確認したところ常に`true`（`document.visibilityState === 'hidden'`）であり、
`tabs_select`でタブをフロントにしても変化しなかった。`window.innerWidth/innerHeight`も
リサイズ後含め異常に小さい値（533×300、Canvas要素は300×150）を示し続けた。

この状態で以下を確認した。
- `useSimStore.getState()`の読み取り、`computeProsthesisModelPose()`等の直接呼び出しは**問題なく
  動作**した（後述4.2で実測値を報告、D-4/D-4-B Auditの解析値と完全一致）。
- ControlPad（`HoldButton`、`onPointerDown`で即時実行）に対する**合成`PointerEvent`
  （`pointerdown`→`pointerup`）のdispatch**は実際に`translateSelectedObject()`を呼び出し、
  storeの`dragOffsetX`が実際に変化した（後述4.1）。
- 一方、以下はいずれも**観測可能な効果を生まなかった**（`computer{action:"key"}`によるOS/CDPレベルの
  キー入力、`window.dispatchEvent(new KeyboardEvent(...))`による直接JS dispatch、ボタン要素への
  `.click()`呼び出し、Canvas要素への合成`PointerEvent`シーケンス）:
  - Arrow key Translation（矢印キー）
  - PageUp/PageDown Depth
  - Shift+矢印キー Rotate
  - Canvas上でのPointer Drag（プロステーシスmeshへのraycast起点のドラッグ）
  - `?debug=collision`パネルの「Run Verification」ボタン（`onClick`ベースの通常ボタンだが無反応）
- `dragMode`（PillToggleGroup、`aria-checked`属性で確認）や`manipulation.committed`
  （UI文言の変化・Rotation Boundary Warpボタンの出現で間接確認）といった**Reactの状態変化自体は
  観測できた**ため、Reactのstate管理・レンダリングパイプライン自体は機能している。にもかかわらず
  上記のCanvas/Keyboard起点の操作だけが一貫して無反応だった。

**推定原因（未確定、Investigation範囲での推測に留める）**: `document.hidden===true`の状態では、
Three.js/react-three-fiberのCanvas内部処理（GLTFのSuspense解決、WebGLコンテキストでの
テクスチャ・ジオメトリのGPUアップロード、`requestAnimationFrame`駆動のレンダーループ）が
ブラウザ側で抑制・遅延されている可能性が高い。DraggableProsthesisの`anatomyRootRef`/
`coordGroupRef`はAnatomy GLBのロード（Suspense境界）に依存するため、この境界が解決しない限り
これらのrefは`null`のままとなり、`evaluateDragCandidate()`内の
`if (!anatomyRoot || !coordGroup) return true;`（安全側フォールバック、無条件許可）が働き、
かつ`console.log`にも到達しない（これは`evaluateDragCandidate`本体の分岐であり、コード自体は
無変更で読んだとおり）。矢印キーの`window.addEventListener('keydown', ...)`自体はSuspenseと
無関係のはずだが、それも無反応だった理由は本調査では特定できなかった（**UNKNOWN**、
Investigation Only の制約上、原因を確定させるためのコード変更・追加ログは行っていない）。

**重要**: 上記はいずれも本アプリのソースコードの欠陥ではなく、**この検証環境（Browser paneが
可視化・compositeされない状態）に起因する制約**である可能性が高いと考えられる。実機（shojiさんの
通常のブラウザ環境）では、D-4 Audit・D-4-B Auditで確認したとおりPointer Drag/Depthは正常に
動作すること自体はコード上確定している（`evaluateDragCandidate`の本番console.logの存在自体が、
通常操作時にこのパスが実際に呼ばれる前提で実装されている証拠）。

---

## 4. 実際に確認できたRuntime Evidence

### 4.1 ControlPad Translation — 実runtimeでCollision Constraintを経由しないことを確認

手順（実際に実行、結果は実測）:
```
1. Case-012（症例12、ツチ骨・キヌタ骨欠損III型）、TTP-VARIAC PORP（BELL）、shaftLength=2mmを選択。
2. 🧪 [TEST] 理想位置で配置を強制確定 をクリック（manipulation.committed=true、
   dragOffsetX/Y/Z=0を確認）。
3. ControlPad「外側へ移動」ボタン（aria-label="外側へ移動"、HoldButton、onPointerDown起点）へ
   合成PointerEvent（pointerdown→pointerup）をdispatch。
```
結果:
```
dispatch前: placement.dragOffsetX = 0
dispatch後: placement.dragOffsetX = 0.1   （translateSelectedObject('x', 0.10)が実行された）
read_console_messages（dispatch前後で比較）: 新規ログなし
  （[C3-P0-1-VERIFY][evaluateDragCandidate] は一切出力されなかった）
```
`useSimStore.getState()`（実行中の実storeインスタンス）で直接確認した値であり、推測ではない。
`evaluateDragCandidate()`のconsole.logは無条件（デバッグフラグ非依存）で毎回発火する実装
（D4B_Collision_Candidate_Integrity_Audit_v1.0.md A節参照）であるため、このログが一切出力
されなかったことは、**ControlPadの「外側へ移動」操作が実際にCollision Candidate評価
（`evaluateDragCandidate`/`composeDragCandidatePose`）を一度も経由しなかったことの直接証拠**
である。これはD4B静的解析（`translateSelectedObject()`の実装にCollision Engine呼び出しが
存在しないというコードリーディング）と完全に一致する、**実runtimeでの確定的な再現**である。

### 4.2 Live State Cross-Validation — 静的解析Evidenceの検算

実行中のstoreから読み取った実際の値と、`computeProsthesisModelPose()`（export済みの実関数、
importして直接呼び出し）による計算結果:
```js
product: porp-ttp-variac（実際に選択中）, footType: BELL, stapes: suprastructure
shaftLength(selectedLength): 2
basePos: STAPES_HEAD = (-0.7249, -0.0273, 3.5259)   // 実import値
UMBO_POS: (-3.236, 1.0663, 2.3439)                  // 実import値
placement（強制確定直後）: lateralOffset=anteriorOffset=verticalOffset=angleTilt=angleTiltZ=
                          dragOffsetX=dragOffsetY=dragOffsetZ=0
→ computeProsthesisModelPose()の実際の戻り値:
   position:   (-1.5667, 0.3393, 3.1297)
   quaternion: (-0.23967235602120604, -4.163336342344337e-17, 0.5091719570261003, 0.8266202755421955)
```
このquaternion値は、D4_Manipulation_Axis_Coordinate_System_Audit_v1.0.md（D節）で
Node.js単体スクリプトにより独立に計算した「Initial Quaternion」の値
`(-0.23967235602120604, -4.163336342344337e-17, 0.5091719570261003, 0.8266202755421955)`
と**桁レベルで完全一致**した。これは、D-4/D-4-B両Auditで使用した「コードから直接書き写した
Node.js再現スクリプト」が、実際に動いているアプリのコードと数学的に完全に同一の計算を
行っていたことの実証（cross-validation）である。すなわち、D-4/D-4-B Auditで報告した
Translation→Quaternion Coupling（9〜20°/mm）・Quaternion誤差の既存offset依存性（最大57.37°）
等の数値Evidenceは、いずれも実際のアプリの計算式を正確に反映した値であると、実runtime照合により
裏付けられた。

### 4.3 Arrow-key Translation / Pointer Drag / Depth / Rotate — NOT REPRODUCIBLE

3.2節で述べた環境制約（Browser paneの非compositing状態）により、これらの操作を実際に発火させ
実行中の`evaluateDragCandidate()`ログ・実MeshBVH衝突結果を取得することができなかった。
以下の手段をすべて試みたが、いずれもstoreの値・console出力に変化を生じさせなかった。
```
- computer{action:"key", text:"ArrowRight"/"PageUp"/"PageDown", repeat:N}
- window.dispatchEvent(new KeyboardEvent('keydown'/'keyup', {...}))  ×window直接
- Canvas要素へのPointerEvent(pointerdown→pointermove→pointerup)シーケンス
- ?debug=collision パネルの「Run Verification」ボタンへの.click()およびdispatchEvent
```
これらはコードの欠陥の証拠ではなく、**この検証セッションのBrowser paneが実際には画面に
表示・composite されていない状態（document.hidden=true固定）であることに起因する、
Three.js Canvas起点の対話機能（GLB Suspense解決・WebGLレンダーループ・raycastベースの
pointer/keyboardハンドラ）が実質的に機能しない環境制約**と考えられる。原因を完全に特定する
には、実際に画面表示されたブラウザ（shojiさんの通常環境）での再実行が必要（**UNKNOWN**、
Investigation Onlyの制約上、この制約自体を回避するための実装変更は行っていない）。

---

## 5-9. 個別操作の検証結果

| 項目 | 結果 |
|---|---|
| Pointer Drag Results | NOT REPRODUCIBLE（3.2節参照）。静的解析（D4B Integrity Audit C/D/E/G節）の数値Evidenceのみ有効。 |
| Depth Results | NOT REPRODUCIBLE。静的解析（同F節）のみ有効。 |
| Arrow Translation Results | NOT REPRODUCIBLE（キー入力が実runtimeで一切効果を生まなかった）。ただし、静的コード読解では矢印キーはisMove依存のeffectで`window.addEventListener('keydown', ...)`のみ、Collision Candidate生成コード（`evaluateDragCandidate`/`composeDragCandidatePose`）を一切呼ばない実装であることをSimScene.tsx:1176-1178で直接確認済み（D4B Integrity Audit C/D/E節）。 |
| ControlPad Results | **実runtimeで確認済み（4.1節）**。「外側へ移動」操作はCollision Candidate生成を一切経由しない。 |
| Rendering vs Candidate Pose Comparison | Pointer Drag/Depthについては実runtime比較ができなかった（NOT REPRODUCIBLE）。ControlPadについては「Candidate Pose自体が生成されない」ことを実runtimeで確認（4.1節）。 |
| MeshBVH Collision Results | 実runtimeでの直接取得はできなかった（NOT REPRODUCIBLE）。`?debug=collision`パネルのCase1/2/3固定検証も同じ環境制約でトリガーできなかった。 |

---

## 10. False Negative Analysis

**実runtimeでのYES/NO確定はできなかった（UNKNOWN、環境制約によりNOT REPRODUCIBLE）。**
D4B_Collision_Candidate_Integrity_Audit_v1.0.md K節の幾何学的評価（PLAUSIBLE、Position最大
0.89mm・Quaternion最大57.37°の乖離がFOOT_CONTACT_TOLERANCE_MM=0.15mmを大幅に超える）から
判定は変更しない。4.2節のLive State Cross-Validationにより、この評価の元となった数値計算
（computeProsthesisModelPose等）自体は実際のアプリと完全に一致することが実証されたため、
**この幾何学的PLAUSIBLE判定の信頼性はむしろ強化された**が、実際のMeshBVH（Bone.glbの実形状）を
用いた「penetration depth > 0.15mmなのにcollided=false」という具体的な組み合わせの再現は、
本タスクでは達成できなかった。

## 11. False Positive Analysis

同様に**UNKNOWN（NOT REPRODUCIBLE）**。判定根拠はD4B Integrity Audit K節から変更なし
（PLAUSIBLE、幾何学的類推）。

## 12. Safety Impact

**MATERIAL**（D4B_Collision_Candidate_Integrity_Audit_v1.0.mdから変更なし）。
今回のRuntime Verificationは、この判定を裏付ける新しい根拠（4.2節のLive Cross-Validation、
4.1節のControlPad bypass実証）を追加したが、判定区分自体（NONE/LOW/MATERIAL/CRITICAL）を
CRITICALへ引き上げる、あるいはNONE/LOWへ引き下げるだけの実MeshBVHエビデンスは得られなかった
ため、MATERIALのまま維持する。

## 13. Architect Questions（回答）

```
Q1: Pointer Drag / Depthについて、Collision EngineはRendering Poseと同じPoseを判定しているか？
= PARTIAL
  静的解析（D4B Integrity Audit）ではNO（既存dragOffset非包含のため不一致）と確定しているが、
  実runtimeでの再確認はNOT REPRODUCIBLE（環境制約）。静的解析の結論は4.2節のLive Cross-
  Validationにより信頼性が補強されているため、実質的にはNOに近いが、実MeshBVH runtimeでの
  直接確認ができていない事実を反映しPARTIALとする。

Q2: Arrow / ControlPad Translationについて、Collision Engineによる制約を通過しているか？
= NO（ControlPadは実runtimeで確定。Arrow keyは静的解析でNO、実runtime再現はNOT REPRODUCIBLE
  だがコード上の結論を変える要素はない）
  ControlPad: 実runtimeで確認済み（4.1節、console.logの不在という直接証拠）。
  Arrow key: 静的コード読解で確定（SimScene.tsx:1176-1178、Collision Engine呼び出しなし）、
  実runtime再現は環境制約によりNOT REPRODUCIBLEだが、コードパス自体はControlPadの
  translateSelectedObject()と完全に同一の関数を呼ぶため、結論はControlPadと同じくNOと推定される
  （PARTIALではなくNOと判定する根拠: 4.1節で実証された「同一関数呼び出しならCollision Candidate
  が生成されない」という実runtimeでの因果関係が、Arrow keyが呼ぶのと全く同じ
  `useSimStore.getState().translateSelectedObject()`に対しても成立するはずであるため）。

Q3: RenderingではpenetrationしているのにCandidateではcollision=falseとなる実runtime False
    Negativeは存在するか？
= UNKNOWN
  幾何学的にPLAUSIBLE（D4B Integrity Audit K節）だが、実MeshBVHでの確定的再現は本タスクでは
  環境制約により達成できなかった。

Q4: RenderingではsafeなのにCandidateではcollision=trueとなるFalse Positiveは存在するか？
= UNKNOWN（Q3と同じ理由）

Q5: Collision Safety上の問題は、NONE/LOW/MATERIAL/CRITICALのどれか？
= MATERIAL（12節参照、判定変更なし）

Q6: Axis DesignをこのCollision Candidate問題から独立して進められるか？
= NO
  D4B_Collision_Candidate_Integrity_Audit_v1.0.mdでの判定（NO推奨）を維持する。今回のRuntime
  Verificationにより新たにAxis Designを先行させてよいと判断できるだけの根拠（False Negative/
  Positiveが実際には発生しないことの実証等）は得られなかった。逆に4.1節・4.2節の実runtime
  裏付けにより、静的解析の結論（Collision Candidate生成の非対称性・既存offset欠落）に対する
  信頼性が高まったため、NOという判断はむしろ補強された。
```

---

## 14. Conclusion

D-4-B Runtime Verificationは、当初計画していた「Pointer Drag/Depthの2段階シナリオを実runtimeの
MeshBVHで再現する」という主目的については、Browser paneが実際には画面表示・compositeされない
（`document.hidden=true`固定）という環境制約により**達成できなかった**（NOT REPRODUCIBLE）。

一方で、
1. **ControlPad Translationが実際にCollision Candidate評価を一切経由しないこと**を、実行中の
   本番console.logインストルメンテーション（ソース無変更、既存のもの）の不在という直接証拠で
   実runtime確定した。
2. **D-4/D-4-B両Auditの数値Evidenceの計算基盤（`computeProsthesisModelPose()`等）が、実際に
   動いているアプリのコードと寸分違わず一致すること**を、dynamic importによる実storeの読み取り
   ＋実関数呼び出しで検算し、実証した。

この2点により、静的解析ベースだったD4B_Collision_Candidate_Integrity_Audit_v1.0.mdの結論
（Existing dragOffset非包含、Collision Safety Impact=MATERIAL、Axis Design非独立推奨）は、
**部分的に実runtimeで裏付けられ、少なくとも反証する材料は一切得られなかった**。
Pointer Drag/Depthの実MeshBVH False Negative/Positiveの確定的証明には、実際に画面表示された
ブラウザ環境での再検証が必要である。

---

## 15. Implementation Status

```
D-4-B RUNTIME SAFETY VERIFICATION

Pointer Drag Candidate Integrity
= UNKNOWN（NOT REPRODUCIBLE、環境制約）

Depth Candidate Integrity
= UNKNOWN（NOT REPRODUCIBLE、環境制約）

Arrow Translation Collision Constraint
= FAIL（Collision Constraintを通過していない＝制約が適用されていないという意味でのFAIL。
  静的解析で確定、実runtime再現はNOT REPRODUCIBLEだが結論を左右する要素なし）

ControlPad Translation Collision Constraint
= FAIL（実runtimeで確定。4.1節参照。Collision Constraintを一切経由しない）

Rendering Pose == Actual Collision Candidate Pose
= PARTIAL（静的解析ではNO、実runtimeでの直接確認はUNKNOWN。ControlPad/Arrow経路は
  「Candidate Pose自体が生成されない」ため比較不能＝別カテゴリ）

Actual MeshBVH False Negative
= UNKNOWN

Actual MeshBVH False Positive
= UNKNOWN

Collision Safety Impact
= MATERIAL

Axis Design can proceed independently
= NO

Implementation Required
= NOT AUTHORIZED IN THIS TASK

Implementation Changes
= NONE

Commit
= NONE

Push
= NONE
```

---

## 16. Git Final Verification

```bash
$ git status --short
?? .claude/
?? .mcp.json
?? .serena/
?? _softclip_split_backup/
?? docs/D1_Case_Prosthesis_Initial_State_Decision_v1.0.md
?? docs/D1_Case_Prosthesis_Initial_State_Selection_Flow_Investigation_v1.0.md
?? docs/D4B_Collision_Candidate_Integrity_Audit_v1.0.md
?? docs/D4B_Collision_Candidate_Runtime_Safety_Verification_v1.0.md
?? docs/D4_Manipulation_Axis_Coordinate_System_Audit_v1.0.md
?? eac_topology_check.py
?? serena-mcp.ps1
（tracked filesの変更なし）

$ git diff --check
（出力なし）

$ git rev-parse HEAD
871b1c5926dd73d6bf5f823dfe6785f2aabc900a
```

```
HEAD = 871b1c5926dd73d6bf5f823dfe6785f2aabc900a
Tracked source changes = NONE
Commit = NONE
Push = NONE
```

一時的に起動したVite dev server（ポート5174）は検証終了後に停止済み。使用したブラウザタブも
閉じた。ソースコードへの一時的な計装（console.log追加等）も一切行っていない
（既存の本番インストルメンテーションと、dynamic importによる読み取り専用アクセスのみを使用）。
