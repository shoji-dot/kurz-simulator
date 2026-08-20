# D-4 R4 Geometry Migration — Final PORP MeshBVH Safety Revalidation

Status: Validation Only — 実装なし・Commitなし・Pushなし

## 1. Baseline

```
開始時 HEAD = 871b1c5926dd73d6bf5f823dfe6785f2aabc900a
終了時 HEAD = 871b1c5926dd73d6bf5f823dfe6785f2aabc900a （不変）
staged = NONE, Commit = NONE, Push = NONE
git diff --check = 出力なし
```
前Task（Shaft Geometry Implementation）終了時点の状態と完全に一致することを確認した
（modified 7ファイル・untracked file一覧とも不変）。本Taskはソースコードを一切変更していない。

## 2. Device / Browser Environment

このセッションのBrowser pane（Claude Code CLIから起動、`http://localhost:5173`に接続）を使用した。
このBrowser paneは`document.hidden === true` / `document.visibilityState === "hidden"`固定であり
（本Task開始直後に再確認、6節）、これは**shojiさんの通常のブラウザ環境ではなく、Claude Code
セッション固有の非表示・非compositing環境**である。この制約は過去4セッション
（D-4-B Integrity Audit / Runtime Safety Verification / Final Runtime Verification、および
本Taskの前々セッションSafety Revalidation）で確認済みのものと同一であり、今回で5セッション連続
での再現となる。したがって、Task冒頭が想定する「実機Browser環境」を、このBrowser pane自体は
提供できない——これは環境の性質であり、ソースコードの欠陥ではない。

既に起動していたVite dev server（このセッションが起動したものではない、`.claude/launch.json`の
`url`属性経由で接続）は起動も停止もしていない。

## 3. Actual Running Version Confirmation

Dynamic importで実際に稼働中のモジュールを直接呼び出し、Shaft Geometry Fix
（`docs/D4_Shaft_Geometry_R4_Migration_Implementation_v1.0.md`）が反映されていることを確認した:

```js
// shaftLength=2, PORP porp-ttp-variac, basePos=STAPES_HEAD, baseline
firstShaftSphere.distanceTo(basePos) = 1.0949999999999998mm  ≈ BELL_HEIGHT_MM (1.095)
```
Shaft球1個目がBell apex（=BELL_HEIGHT_MM、修正後の期待値）の位置にあることを確認した
（修正前は≈0.095mmだった、前Task参照）。**実行中のアプリはShaft Geometry Fix適用後の
最新版であることを確定した。**

## 4. PORP/BELL Case

```
症例: 症例12（ツチ骨・キヌタ骨欠損III型、PORP入門）
製品: TTP-VARIAC PORP（porp-ttp-variac、footType:BELL、headType:BELL_TOP）
```
実際にUI操作（Home→プロステーシス選択→症例選択→製品選択→ACサイザー→配置調整）で
選択した。**shaftLength**は選択フロー上「2mm」と表示されていたが、Force Commit後に
`useSimStore`から直接読み取った実際値は`selectedLength: 2.5`だった（UIの表示値とstoreの
実際値に差異があった可能性がある。原因調査は本Taskのスコープ外——Collision Geometry
migrationとは無関係な、UI表示とstore値の整合性という別種の問題であり、事実として記録するに
留める）。以降の検証は実際に稼働していたstore値（2.5mm）に基づく。

## 5. Initial Placement

「🧪 [TEST] 理想位置で配置を強制確定」ボタン（既存のTEST専用ショートカット、`manipulation.
committed=true`かつ`dragOffsetX/Y/Z=0`等を設定）をクリックし、Placement段階へ強制遷移した。
`useSimStore.getState().placement`を直接読み取り、確認した:
```js
{ selectedLength: 2.5, lateralOffset:0, anteriorOffset:0, verticalOffset:0,
  angleTilt:0, angleTiltZ:0, dragOffsetX:0, dragOffsetY:0, dragOffsetZ:0 }
```
UI上の「配置状況」パネルも「配置良好」「シャフト長 ✓ 適切」「設置位置 ✓ 適切（理想位置と一致）」
「設置角度 ✓ 適切」を表示しており、初期状態が想定通りであることを確認した（Foot/Shaft/Headの
3D描画そのものはCanvas非compositing環境のため目視確認できない、6節参照）。

## 6. Translation Tests

**NOT REPRODUCIBLE。** ControlPad（操作パネル展開後）の「外側へ移動」ボタンへ、確立済みの
手法（合成`PointerEvent('pointerdown'→'pointerup')`、`HoldButton.tsx`の`onPointerDown`実装に
対応）を用いてdispatchしたが、`useSimStore.getState().placement.dragOffsetX`は変化しなかった
（before=0, after=0）。座標・要素ターゲットは`document.elementFromPoint()`で正しくボタン自体を
指していること、ボタンが`disabled`でないことを確認済み——dispatch自体は正しい要素に届いている。

**重要な新しい診断**: 現在のControlPad（`ControlPad.tsx:101-116`、D-4で新規配線済み）は、
`manipulationCommitted && placementControls`が真の場合、`placementControls.translate()`
（`evaluateDragCandidate()`経由でCollision Candidateを評価）を呼ぶ構造になっている
（旧D4B Audit時点の「ControlPad Translateは Collision Candidateを一切経由しない」という
挙動は、この間のD-4実装により**解消済み**であることをコード上確認した）。しかし
`evaluateDragCandidate()`の**無条件console.log**（`[C3-P0-1-VERIFY][evaluateDragCandidate]`、
production常時出力、debug flag非依存）が、複数回のdispatch後も一度も出力されなかった
（`read_console_messages`で確認）。これは、この関数の`if (!anatomyRoot || !coordGroup)
{ return true; }`という最初期のガード条件で早期returnしている（＝Canvas内の
`anatomyRootRef`/`coordGroupRef`のいずれかが`null`のまま）ことと矛盾しない——console.logより
前の行で処理が止まっているため、ログすら出ない。

## 7. Near-contact Tests

**NOT REPRODUCIBLE。** 6節と同じ理由により、Bone表面近傍への接近操作自体を発火できなかった。
Placement段階のTEST専用ショートカット「🧪 [TEST] Collision境界直前へワープ」はTransport段階
専用（Force Commit後は非表示）であることを確認した。Force Commit後に代わって表示される
「🧪 [TEST] Rotation Boundary Warp（Bone手前・非衝突角度へ）」ボタンは、一度クリック後の
再取得で見失った（UI上の条件付き表示によるものと推測、原因未特定）——再試行するコストと
得られる情報の見込みを検討し、6/8節で既に確定した同一制約の再確認に留まると判断して
これ以上の追跡を打ち切った。

## 8. Rotation Tests

**NOT REPRODUCIBLE。** tilt(↑↓) +/−・tiltZ(←→) +/−ボタン（Force Commit後に表示される、
`HoldButton`ベース）へ合成PointerEventをdispatchしたが、`placement.angleTilt`/`angleTiltZ`は
一切変化しなかった（複数回試行、waitタイムも100〜300msへ拡大して再試行したが結果は同一）。
`evaluateRotationCandidate()`にはconsole.logが存在しないため（6節の`evaluateDragCandidate`とは
異なる）、直接的なログ証拠は得られないが、同じ関数構造（`if (!anatomyRoot || !coordGroup)
{return true;} if (!baseAlignmentQuaternion) {return false;}`、いずれのパスでも
`rotateSelectedObject`は呼ばれない経路にはならない・状態が変化しない事実と整合する）から、
6節と同一原因（Canvas内ref/Stateが確立していない）と推定される。

## 9. Shaft Roll Tests

**NOT REPRODUCIBLE。** 6/8節と同一の環境制約により未実施（同一のCollision Candidate経路
`placementControls.rotateShaftRoll()`→`evaluateShaftRollCandidate()`を使うため、個別の
追加試行は行わず、6/8節で確立した制約の帰結として扱った）。

## 10. Combined Operation Tests

**NOT REPRODUCIBLE。** 6/8/9節の個別操作がいずれも発火できなかったため、連続操作シーケンスの
検証も実施できなかった。

## 11. MeshBVH Accept/Reject Observations

**取得できなかった（UNKNOWN）。** 6〜10節の制約により、`evaluateDragCandidate`/
`evaluateRotationCandidate`/`evaluateShaftRollCandidate`のいずれも、実機UIインタラクション
経由では一度も呼び出しの完了（Bone MeshBVHとの実際の交差判定）まで到達しなかった。

一方、**Collision Proxy自体の幾何（MeshBVH判定の入力）がR1 historical geometryとmachine
precisionで一致すること**は、前Task（Shaft Geometry Implementation）で数値・Live Runtime
（本Taskと同じdynamic import技法）の両方で既に確定している（3節で再確認済み）。
`testCollision()`はProxy幾何とBone MeshBVHの決定論的関数であるため、「入力Proxy幾何が
既存の安全性キャリブレーション全体の前提と一致する」ことは、「実際のBone形状に対する
具体的なaccept/reject結果」の直接証拠ではないが、少なくとも「Collision判定が誤った幾何を
評価する」という経路のリスクは排除されている。

## 12. Classification Inversion Analysis

**評価不能（UNKNOWN）。** 11節の通り、実際のaccept/reject結果を一件も取得できなかったため、
safe→unexpected REJECT、またはpenetrating→unexpected ACCEPTの発生有無を判定する材料がない。
**「未確認」であることと「問題なし」であることを混同しない**——本節はPASSではなくUNKNOWNとして
明示的に記録する。

## 13. C-2/C-3/C-4 Status

Freeze State自体は変更していない（本Taskはソースコード変更を一切行っていない）。
`evaluateDragCandidate`/`evaluateRotationCandidate`/`evaluateShaftRollCandidate`のコード自体
（C-2/C-3/C-4のFreeze対象）は前Taskから無変更であることを`git diff`で確認済み。
**Partial Revalidation**として記録する: Proxy幾何のmachine precision一致（3節、前Task由来）は
確認できたが、実機でのcollision behavior確認はUNKNOWN（11/12節）。

## 14. Decision 3 Supplementary Verification

Decision 3（rotation semantics、`ANGLE_TILT_SIGN`/`ANGLE_TILT_Z_SIGN`）のコードは無変更
（`git diff`で確認）。horizontal drag→angleTiltZ、vertical drag→angleTilt、rotation sign等の
実機確認は、8節の制約によりUNKNOWN。Geometry correctionによってDecision 3の実装コード自体が
影響を受けていないことはコードレベルで確認済み（前Task 15節、本Taskで再変更なし）。

## 15. Danger Zone / Safety Score

**既知baselineと完全一致することを確認した（Confirmed、実機値）。**
```
Force Commit前（Transport段階、offset=0相当）:
  Placement Point: x:-1.56 y:2.62 z:1.41
  Nearest: 顔面神経（鼓室部）, distance: 3.31mm, state: WARNING
  Score: 85

Force Commit後（Placement段階、dragOffset等=0確認済み）:
  Placement Point: x:-1.56 y:2.62 z:1.41   （同一）
  Nearest: 顔面神経（鼓室部）, distance: 3.31mm  （同一）
  Score: 85   （同一）
```
Task 18節記載の既知baseline（x:-1.56/y:2.62/z:1.41、顔面神経3.31mm、Score 85）と完全一致。
**これはCanvas非compositing制約の影響を受けない**（Safety Debugパネルは`?debug=coords`の
プレーンDOM要素であり、`useSimStore`から直接値を描画しているため、Canvas内部のuseEffectに
依存しない——6〜10節のCollision Candidate操作とは異なる経路）。

## 16. Runtime Regression

```
console errors: なし（`read_console_messages`で複数回確認、エラーメッセージ0件）
vite HMR: 正常（前Taskの編集内容が正しくhot-reloadされていることを確認済み、3節）
Case selection → Product selection → AC Sizer → Placement: 実機UI操作で正常に到達（5節）
Ideal Ghost / Translate / Rotate / Shaft Roll / Placement Commit: Canvas内操作はNOT REPRODUCIBLE
  （6-10節）、ただし試行そのものによる新規エラー発生もなし
```

## 17. Debug Consumers

`PoseComparisonOverlay.tsx`/`bellMarkers`（`SimScene.tsx`）は前Taskの判断通り、R1-source
geometryを意図的に維持している（本Taskで再変更していない、`git diff`で確認）。今回のTaskでも
R4 offsetを追加していない——前Taskで確定した「local geometry input position自体がR1-sourced
であり、R4 offsetを追加すると二重補正になる」という判断を維持した。

## 18. Known Out-of-Scope Finding: `InstrumentMarker`

`src/scenes/transport/ManipulationLayer.tsx:130`が旧R1 `headOff`式を使用している件
（前Task 28節で報告済み）は、本Taskでも未着手のまま維持した。装飾的なTransport段階の器具
マーカーであり、Collision・Scoring・trainee safety geometryのいずれにも非関与——本Task
スコープ外として記録するのみに留める。

## 19. Static Checks

本Taskはsource変更を行っていないため、原則再実行不要（Task指示§22）。参考として、前Task
終了時点の`tsc -b`/`build`/`eslint`結果（PASS/PASS/161）に変更を加える操作は一切行っていない。

## 20. Git Integrity

```
$ git status --short
（前Task終了時と完全に同一——modified 7ファイル、untracked file一覧とも不変）
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
temporary files  = none（検証はdynamic import + console操作のみ、一時ファイル作成なし）
unintended mods  = none
Commit           = NONE
Push             = NONE
```

## 21. Limitations

- **本Taskの最大の限界**: 使用したBrowser pane環境（Claude Code CLI起動）は
  `document.hidden=true`固定であり、Canvas/React Three Fiber内部の`useEffect`ライフサイクルが
  機能しない（5セッション連続で確認済みの環境固有の制約、D-4メモリ参照）。この制約下では、
  Collision Candidate評価（`evaluateDragCandidate`/`evaluateRotationCandidate`/
  `evaluateShaftRollCandidate`）がいずれも`anatomyRootRef`/`coordGroupRef`/
  `baseAlignmentQuaternion`のいずれかが未確立のまま早期return（安全側フォールバックまたは
  fail-closed）するため、実際のBone MeshBVHとの交差判定まで到達しない。
- **今回新たに確立した診断精度**: 過去セッションでは「Canvas系操作全般が無反応」という粒度の
  確認だったが、本Taskでは(a) `evaluateDragCandidate`の無条件console.logが一度も出力されない
  こと、(b) ControlPad ButtonのdispatchされたPointerEventが正しい要素に届いていること
  （`elementFromPoint`で確認）、(c) `useSimStore`の該当フィールドが一切変化しないこと、を
  個別に確認し、原因が「イベントがボタンに届いていない」ことではなく「Canvas内部の
  ref/Stateの未確立」であることをより正確に切り分けた。
- Danger Zone/Safety Score（15節）とcase/product選択フロー（5節）はCanvas非依存のため実機で
  確認できたが、これはCollision Constraint自体の実機確認ではない。
- 実MeshBVHでのaccept/reject二値結果は、本Taskを含め過去5セッションいずれでも取得できて
  いない。**この限界を解消するには、shojiさんの通常のブラウザ環境（画面表示・compositeされる
  実環境）での実機検証が必須**である。

## 22. Final Verdict

```
Geometry:
  = PASS
  （前Task・前々Taskでmachine precision証明済み、本Taskで再変更なし・Live Runtimeで再確認）

Collision Proxy Geometry:
  = PASS
  （Shaft correction後、R1 historical geometryとのequivalenceを本Task冒頭で再確認、3節）

Actual MeshBVH Safety:
  = PARTIAL / OPEN
  （実Bone MeshBVHでのsafe/collision candidate classificationを、環境制約（Canvas
  useEffectライフサイクル非機能）により本Taskでも十分に確認できなかった。Classification
  Inversionの有無はUNKNOWN——「問題なし」ではなく「未確認」である。）

Reporting distinction（Task指示§25厳守）:
  Geometry              = PROVEN
  Proxy                 = PROVEN
  Actual MeshBVH classification = OPEN（本Taskで解消されず）
```

---

## Architect Note

本Taskは、既に幾何学的に証明済みのR4 Geometry / Collision Proxyについて、実際のTemporal Bone
MeshBVHに対するaccept/reject挙動を実機で確認することを目的としていた。Case選択からPlacement
Commitまでの非Canvas UI操作、およびDanger Zone/Safety Scoreの実機値確認（既知baselineと完全
一致）には成功したが、Collision Candidate評価自体（Translate/Rotate/Shaft Roll）は、このBrowser
pane環境固有の`document.hidden=true`制約により、5セッション連続で実行できなかった。本Taskでは
その原因をこれまでより詳細に切り分け（console.log不在・PointerEvent到達確認・store状態不変の
3点から、Canvas内部ref/State未確立であることを特定）、環境の限界であることをより明確にした。
Geometry/Collision Proxyの正しさは確定しているため安全側のリスクは大きくないと考えられるが、
「Actual MeshBVH Safety = OPEN」という判定は変更せず、shojiさんの実機ブラウザでの最終確認を
次のステップとして残す。

---

## 23. Re-confirmation Session（2026-08-20、追記）

新規タスクとして「同一sandbox Browserでの再試行ではなく、shoji本人の実機ブラウザでの最終確認を
明確化する」という引継ぎを受けた。本節はその実施記録である。**事実関係（1〜22節の結論）は
一切変更していない。**

### Baseline再固定
```
$ git status --short / git diff --stat / git diff --check / git rev-parse HEAD / git diff --cached
→ 前Task終了時点と完全に同一（modified 7ファイル・untracked file一覧とも不変）
HEAD = 871b1c5926dd73d6bf5f823dfe6785f2aabc900a （不変）
staged = NONE, source changes = NONE, Commit = NONE, Push = NONE
```

### Running環境の再確認
```
document.hidden           = true
document.visibilityState  = "hidden"
```
前回と同一のBrowser pane（`http://localhost:5173`、このセッションが起動したものではない
既存dev serverに接続）で再確認した。**5セッション連続と同一の制約が、6回目の確認でも
再現した。** 引継ぎ指示（§3「同じsandbox/browser paneで別手法を繰り返しても改善する合理性は
低い」「同一sandbox環境で既に5回失敗しているため、同じ手法を無目的に反復しないこと」）に従い、
このBrowser paneでのCollision Candidate実機再試行（Translate/Rotate/Shaft Roll等）は**行って
いない**（6/7/8/9節の結果を上書きする新しい試行はしていない、1〜22節の内容がそのまま最新の
事実である）。

### 実機（shojiさんのBrowser環境）向け最終チェックリスト

次にshojiさんの実際にvisual-compositedされているブラウザで確認すべき項目を、本Task引継ぎ
指示（§6〜9）に基づき整理する。**対象はPORP/BELL、shaftLength=2.0mm相当のケース
（症例12・TTP-VARIAC PORP）**。過去の検証と同一のCaseを使うこと。

```
[ ] 1. Home → 症例12選択 → TTP-VARIAC PORP選択 → ACサイザー → 配置調整 まで到達
[ ] 2. 「🧪 [TEST] 理想位置で配置を強制確定」または実際のDrag&Dropで初期配置
[ ] 3. Translation（±X/±Y/±Z、各小さい移動量）
       - Boneから十分離れた安全な移動 → ACCEPT（移動が反映される）
       - Boneへ侵入する方向の移動 → REJECT（movement stop、bounceしない）
[ ] 4. Near-contact（Bone表面付近まで接近）
       - penetrating candidate → unexpected ACCEPT がないか（あればFAIL候補、直ちに記録・
         その場で修正しない）
       - safe candidate → unexpected REJECT がないか
[ ] 5. Rotation（tilt/tiltZ、小さい角度、±方向）
       - Decision 3のmapping（Horizontal drag→angleTiltZ、Vertical drag→angleTilt）通りの
         符号か
       - Bone collisionへ入るrotationがREJECTされるか、bounce/jumpがないか
[ ] 6. Shaft Roll（±方向、可能ならBone近傍でも）
       - safe rollはACCEPT、collision rollはREJECT
[ ] 7. Runtime Regression（余裕があれば）
       - Case selection→Product選択→ACサイザー→Placement→Ideal Ghost→Translate→Rotate→
         Shaft Roll→Placement Commitを通しで実行、console errorがないこと
```

判定基準（引継ぎ指示§14をそのまま適用）:
```
PASS        : 上記が実機で十分確認でき、safe→ACCEPT / penetrating→REJECT / collision→movement
              stopのいずれも期待通りだった場合
PARTIAL/OPEN: MeshBVH classificationを十分再現できない場合（環境都合等）
FAIL        : penetrating candidate → ACCEPT 等、明確なSafety classification inversionを
              実測した場合——ただし発見してもその場でコード修正せず、Findingとして停止する
```

### 現時点の結論（変更なし）

```
Geometry                  = PASS
Collision Proxy Geometry  = PASS
Actual MeshBVH Safety     = PARTIAL / OPEN
```
「Browser environment limitationによりactual MeshBVH accept/reject classificationを再現できず、
Safety status remains PARTIAL/OPEN」——これが正しい記述であり、「問題がなかった」とは書かない
（引継ぎ指示§13を遵守）。

### Git Integrity（再確認）
```
$ git status / git diff --stat / git diff --check / git rev-parse HEAD / git diff --cached
HEAD unchanged = YES, staged = NONE, source changes = NONE, Commit = NONE, Push = NONE
```

Next: 上記チェックリストを用いたshojiさんの実機ブラウザでのMeshBVH最終確認。それ以外の
D-4作業（Camera-relative Depthの実機Validation含む）と本件はいずれも独立しており、
どちらから着手してもよい。

---

## 24. Real Browser Validation Results（shojiさん報告、2026-08-20）

shojiさんが実際にvisual-compositedされている実機ブラウザで、23節のチェックリストに基づき
検証を実施し、結果を報告した。**本節の内容はshojiさんの実機報告であり、Claude Code側
（この検証セッション）が独自にscreenshotやconsole logで裏取りしたものではない**——
Evidence Based Reviewの原則に従い、この区別を明示する。

### 環境・条件
```
Environment: 実際のvisual-composited browser（shojiさんの通常環境、Browser pane sandboxではない）
Case: 症例12（PORP/BELL）
Shaft Length: 2.0mm
```

### Baseline（既知値との一致）
```
Danger Zone: x=-1.56, y=2.62, z=1.41
Nearest: 顔面神経（鼓室部） 3.31mm
Safety Score: 85
```
1〜22節・23節で記録した既知baselineと完全一致（実機でも再現）。

### Translation
```
+X: ACCEPT   -X: ACCEPT   +Y: ACCEPT   -Y: ACCEPT   +Z: ACCEPT   -Z: ACCEPT
```
6方向すべて、安全な移動量でACCEPT（移動が反映される）ことを確認したとの報告。

### Collision Stop（+X方向で詳細確認）
```
Safe movement            : ACCEPT
Near-contact movement    : ACCEPT
Further movement into Bone: REJECT
Prosthesis stopped       : YES
```
「安全→接近→さらにBoneへ」という段階的なcandidateに対し、Boneへの侵入を試みる段階で
初めてREJECTされ、移動が停止したとの報告——これは23節チェックリストが最も重視していた
「penetrating candidate → unexpected ACCEPT」（Safety上重大なFAIL条件）が**発生しなかった**
ことを意味する。

### Rotation
```
+tilt: PASS   -tilt: PASS   +tiltZ: PASS   -tiltZ: PASS
```
Decision 3のmapping（Horizontal drag→angleTiltZ、Vertical drag→angleTilt）に沿った挙動で、
4方向すべてPASS（安全な回転はACCEPT、Bone collisionでは停止）との報告。

### Shaft Roll
```
+roll: PASS   -roll: PASS
```

### 定性的観察（shojiさん記載のまま）
```
- Boneに近づけると移動が停止した
- それ以上Bone方向へ操作しても侵入しなかった
- Rotation中もcollision時に回転が停止した
- Console errorは発生しなかった
```
bounce（跳ね返り）ではなくmovement stop（その場で停止）という、23節チェックリストが
期待していたsemantics通りの挙動だったことが確認された。

### Evidence形式
Screenshot/video: 添付なし（shojiさんのテキスト報告のみ）。本節はこの報告をそのまま記録する
——「screenshotがないため観測ではなくShojiさんの主張」という区別自体は残しつつ、
Evidence Based Reviewの精神（実測値に基づく）とも整合的な、実際に操作した結果としての
テキストEvidenceとして扱う（数値・方向別の結果が明確に区分されており、単なる印象評価ではない）。

### Classification Inversion Analysis（更新）
12節で「評価不能（UNKNOWN）」としていた項目について、shojiさんの実機報告に基づき更新する:
```
Safe candidate      → unexpected REJECT     : 報告されなかった（6方向Translation・4方向
                                                Rotation・2方向Shaft Rollいずれも安全な操作は
                                                ACCEPTと報告）
Penetrating candidate → unexpected ACCEPT   : 報告されなかった（+X near-contact→further-into-
                                                bone candidateで明確にREJECTされたと報告、
                                                これが唯一の「Boneへの侵入を試みた」ケース）
```

### Final Verdict（更新）

```
Geometry                  = PASS   （前Taskまでにmachine precision証明済み、不変）
Collision Proxy Geometry  = PASS   （同上、不変）
Actual MeshBVH Safety     = PASS
  （shojiさんの実機報告により、safe candidate→ACCEPT、penetrating candidate→REJECT、
  collision→movement stop（bounceではない）をすべて確認。14節の判定ルール
  「実際のvisual-composited Browserで、safe candidate→ACCEPT / penetrating candidate→
  REJECT / collision→movement stopを十分確認できた場合」に該当するためPASSとする。）
```

**残る限界**: screenshot/videoの添付がないため、この検証セッション自身がpixelレベルで
独立に裏取りしたものではない（shojiさんのテキスト報告に基づく）。ただし、報告内容は
方向別・operation別に具体的かつ一貫しており（bounce/jump等の異常挙動が明示的に「なかった」
とまで記載）、Task当初のOPEN理由（Browser paneのCanvas制約）そのものは実機では該当しない
環境で得られた結果である。

これにより、**D-4 R4 Geometry Migration（Shaft Geometry Fix含む）のPORP absolute-coordinate
Safety Revalidationは、Geometry / Collision Proxy / Actual MeshBVH Safetyの3層すべてで
PASSとなり、CLOSEDとして扱ってよい。**
