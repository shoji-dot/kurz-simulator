# D-4 Shaft Geometry R4 Migration — Implementation Report

Status: Implementation Complete — Commitなし・Pushなし

Architect承認済みの`shaftMidY = footOff + BELL_HEIGHT_MM + shaftLen/2`を、Active consumer 2箇所へ
最小実装した。Debug-only consumer 2箇所は、実装直前の追加検証でArchitect Decisionの想定と異なる
座標系上の理由により**変更しないことが正しい**と判明したため、変更せずコメントのみ追加した
（13節）。

## 1. Baseline

```
開始時 HEAD = 871b1c5926dd73d6bf5f823dfe6785f2aabc900a
終了時 HEAD = 871b1c5926dd73d6bf5f823dfe6785f2aabc900a （不変）
Commit = NONE, Push = NONE
```
開始時点で`docs/D4_Shaft_Geometry_R4_Migration_Architect_Decision_v1.0.md`が既に存在することを
確認。既存untracked files・既存modified filesはすべてそのまま維持（revertしていない）。

## 2. Architect Decision Confirmation

`docs/D4_Shaft_Geometry_R4_Migration_Architect_Decision_v1.0.md`を実装直前に精読し、現在の
ソース（`prosthesisCollisionGeometry.ts:168`, `ProsthesisModels.tsx:1889`）がDecisionの記述
（`shaftMidY = BELL_HEIGHT_MM / 2`、footOff未参照）と一致していることを確認してから編集した。

## 3. Changed Files

```
src/engine/collision/prosthesisCollisionGeometry.ts   （+shaftMidY式変更、コメント追加）
src/scenes/models/ProsthesisModels.tsx                （+shaftY式変更、コメント追加）
src/scenes/debug/PoseComparisonOverlay.tsx             （変更なし、コメントのみ追加）
src/scenes/SimScene.tsx                                （変更なし、コメントのみ追加）
```
実質的なジオメトリ式の変更は上記4ファイル中**2ファイルのみ**（Active consumer）。Debug-only
2ファイルは値を変更せず、調査結果を残すコメントのみ追加した（13節に理由を記載）。

## 4. Exact Formula Change

```diff
- const shaftMidY = BELL_HEIGHT_MM / 2;                              // prosthesisCollisionGeometry.ts:168
+ const shaftMidY = footOff + BELL_HEIGHT_MM + shaftLen / 2;

- const shaftY   = isBell ? BELL_HEIGHT_MM / 2 : ...                  // ProsthesisModels.tsx:1889
+ const shaftY   = isBell ? footOff + BELL_HEIGHT_MM + shaftLen / 2 : ...
```
`isFlat`/その他分岐（`FLAT_CEILING_Y_MM/2`, `0`）は変更していない（Architect Decision 2節、
Collision Proxy側がBELL専用のためFLAT/PISTONに対応するズレが存在しない、本Fixのスコープ外）。
両ファイルとも`footOff`は既存のR4値（`0`）のまま不変（Critical Constraint §6、§27遵守）。

## 5. R1/R4 Numeric Equivalence

Node.js標準スクリプト（`node_modules/three`利用、`src/`は変更せずscratchpadで実行・削除済み）で、
修正後のsrc記述と数式的に同一の式を用いてR1（旧footOff/headOff/shaftMidY、Migration前）と
R4-fixed（現行、修正後）を比較した。`shaftLength ∈ {2,3,4}mm`、tilt/tiltZ ∈ {0,±5}°:

```
tilt=0, tiltZ=0（baseline）:
  全shaftLength・全8球+Head: diff ≈ 1e-16〜1e-15mm（浮動小数点誤差のみ、完全一致）

tilt=±5° または tiltZ=±5°:
  全8球+Headが一律に同じ量だけ乖離（例: len=2,tilt=5°→全要素4.709e-2mm、
  len=2,tiltZ=5°→shaft 7.93〜8.04e-2mm/foot 7.98〜8.72e-2mm/head 8.11e-2mm、
  互いに近い値で全要素が連動）。これはDecision 3（Rotation Pivot semantics、既承認）による
  pivot差であり、Shaft-onlyの残存誤差ではない——修正前は「foot/headは一致するのにshaftだけ
  shaftLength/2ズレる」という非対称な誤差だったが、修正後は「tilt=0で完全一致、tilt≠0では
  全要素が同じ理由（Decision 3）で一律に乖離する」という対称な状態になった。
```

## 6. All 8 Shaft Sphere Comparison

Baseline（tilt=0）でのR1 vs R4-fixed、全8球（shaft×5 + foot×3）+ Head Box、
`shaftLength ∈ {2,3,4}mm`:

```
全24球 + 3 Head Box = 27要素すべてでdiff ≈ 1e-16〜1e-15mm（machine precision一致）。
```
（修正前は shaft×5 のみ `shaftLength/2` = 1.0/1.5/2.0mm の系統誤差、foot×3+Headは既に一致 —
Safety Revalidation・Architect Decision両レポート参照。修正によりこの非対称性が解消された。）

## 7. Rendering / Collision Consistency

Rendering（`ProsthesisModels.tsx:1889`）とCollision（`prosthesisCollisionGeometry.ts:168`）は
**同一式**（`footOff + BELL_HEIGHT_MM + shaftLen/2`）を適用した。両者は引き続き一致しており
（修正前から一致自体はしていた、6節参照）、加えて今回、その一致する値自体がR4 Anatomical
Geometry（Ground Truth）とも一致するようになった。

## 8. Candidate B Regression

```js
// 実行中のdev serverから直接確認
FOOT_CONTACT_TOLERANCE_MM = 0.15   （不変）
```
`CANDIDATE_B_FOOT_SPHERE_RADII_MM`はコード上変更していない（`git diff`で確認、footOff/headOff/
shaftMidY行以外に変更なし）。Foot球3個の中心座標もR1/R4-fixedでdiff ≈ 1e-16mm（5/6節、
Migration自体は元々正しかった箇所のため不変）。

## 9. Foot Contact Tolerance Regression

`collisionTest.ts`の`role==='foot'`分岐（tolerance適用箇所）・`FOOT_CONTACT_TOLERANCE_MM`定数
いずれも変更していない。今回のFixはshaft球（`role==='shaft'`、tolerance非適用の二値判定のまま）
のみに影響する。

## 10. Bone Collision Result

**実MeshBVH（実Bone.glb）でのaccept/reject二値結果の直接取得は今回も未実施（UNKNOWN）。**
`document.hidden=true`固定の既知環境制約（過去4セッション連続で再現）により、Canvas内
Pointer Drag/Keyboard操作・`?debug=collision`パネルは今回も試行していない（既に確立した
制約のため、同じ失敗の再現に時間を使わず、5/6節のProxy幾何の確定的検証を優先した）。
ただし、`testCollision()`はProxy幾何とBone MeshBVHの決定論的関数であり、Proxy幾何が
（修正前は系統的に`shaftLength/2`ズレていたのが）修正後はR1のProxy幾何（既存の安全性
キャリブレーション全体の前提）とmachine precisionで一致するようになったことを5/6節で確定した
——**Shaft球のCollision判定は、少なくとも既存のCollision Constraint挙動（既にC-2〜C-8で
Freeze・実運用されてきたもの）が前提としていた幾何に復帰した**、という意味での安全性回帰は
確認できた。実際のBone形状に対する具体的なケースでのaccept/reject変化の直接確認はUNKNOWNの
まま。

## 11. Runtime Regression

```
console errors（page reload後）: なし
npx tsc -b:  PASS（0 errors）
npm run build:  PASS（`vite build`成功、既存のchunk-size警告のみ、無関係・pre-existing）
```
Canvas内Translate/Rotate/Shaft Roll/Placement Commitの実機操作確認はUNKNOWN（既知の環境制約、
10節参照）。Live dynamic import経由での`resolveCanonicalPose()`/`buildProsthesisCollisionProxy()`
直接呼び出しは正常動作し、5節の数値と桁レベルで一致することを確認した（Observed、Confirmed）。

## 12. Debug Consumer Verification

`?debug=coords`相当のURLパラメータでページを開き（Canvas自体はcomposite不可のため画面確認は
できないが）、dynamic importでモジュールロード自体に問題がないことは確認した。
`PoseComparisonOverlay.tsx`/`bellMarkers`（`SimScene.tsx`）は**値を変更していない**ため、
Migration前と同じ挙動のまま——これは意図的な判断であり、13節に理由を記載する。

## 13. 重要な追加調査結果: Debug Consumer 2箇所は「変更しない」が正しい判断だった

実装直前のSTEP 3再確認grepで、Architect Decisionの4-consumerリストに含まれない新たな
`shaftLength/2`パターン一致を2件発見した。それぞれ調査し、**いずれもshaft geometry migrationの
対象外**と判断した（勝手に編集せず、まず意味論を確認するというTask指示に従った）。

**(a) `src/engine/poseSolver/bellAdapter.ts:80`（`halfShaft`）**: P4B-3実験的Pose Solver
（`solveBellPose`、`useNewPoseSolver`デバッグフラグ、既定OFF、「研修者が触れる経路には出さない」
と既にshoji承認済み）の一部。ドキュメント自体が「position（返り値）は既存ProsthesisModelのmid
（シャフト中点）と同じ意味を持たせる」と明記しており、これは**意図的なR1-mimicking**（本体の
Reference Poseと比較するための独立実装）。Consumer #3（`PoseComparisonOverlay.tsx`）と同じ
機能ファミリーであり、新規consumerではない。変更していない。

**(b) `src/scenes/transport/ManipulationLayer.tsx:130`（`InstrumentMarker`の`headOff`）**:
Transport段階（Placement Commit前）の、器具（鑷子）マーカーの装飾的な表示位置。docstringが
古いR1式（`shaftLength/2 + 0.15`）を「本体と同じ式」として参照しているが、本体
（`ProsthesisModels.tsx`）は既にR4（`shaftLength + 0.15`）へ移行済みのため、このコメント・
実装は**Stale**（未発見だった実質5件目のconsumer）。ただし、Transport段階の`TransportProsthesis`/
`DirectTransportProsthesis`はいずれも`ProsthesisModel`へ`poseOverride={{position: ZERO_VEC,
quaternion: IDENTITY}}`を渡しており（`transportPose.position`自体が既にR4のFoot Anchor
semanticsとして扱われている、コード確認済み）、`InstrumentMarker`もこの同じ外側group内の
兄弟要素であるため、正しい修正は`headOff = shaftLength/2 + 0.15`→`shaftLength + 0.15`
（footOff/headOffのみ、shaftMidYパターンではない）。**本Task（shaft geometry migrationに
Architectが明示的に承認したscope）には含まれていないため、変更していない。** 装飾的な器具
マーカーの位置ズレのみで、Collision/Renderingの実プロステーシス形状には影響しない
（trainee-facing behaviorへの影響は「器具マーカー（鑷子アイコン）がheadから少しズレて見える
可能性がある」程度、collision safetyには無関係）。Finding として28節に報告する。

**(c) `PoseComparisonOverlay.tsx`/`bellMarkers`（既存4-consumerリストの#3/#4）**: 実装直前の
再検証で、当初のArchitect Decisionの想定（「footOff/headOff/shaftYをR4へ同期させるべき」）を
覆す事実を発見した。
- `PoseComparisonOverlay.tsx`の`PosedProsthesisGhost`へ渡される`pose`（`referenceGhost`/
  `candidateGhost`/`anchorGhost`）は、いずれも`resolveCanonicalPose()`を経由しない
  `computeProsthesisModelPose()`/`solveBellPose()`由来のR1 shaft-midpoint positionである
  （SimScene.tsx:1905, 1923確認）。`PosedProsthesisGhost`自身のfootOff/headOff/shaftYだけを
  R4へ変更すると、position（R1基準）とlocal offset解釈（R4基準）が食い違い、**3つのGhost全部が
  まとめてshaftLength/2だけ誤表示される新しい不整合を生む**——一度この変更を試みて（実際に
  編集した後）この問題に気づき、リバートした。現状のR1式は、その入力（R1 position）に対しては
  内部的に正しい（単体でのBugではない）。
- `bellMarkers`（`SimScene.tsx`）は`mid`を自己完結で再計算しており（`resolveCanonicalPose()`を
  呼ばない、独立実装）、`footOff=-(selectedLength/2)`は**その自己完結mid**に対してのみ意味を
  持つ。`rim = mid + footOff*dir`は代数的にtilt=0で常に`base`（Foot Anchor、実際のR4描画位置と
  一致）に等しくなる恒等式であることを確認した——footOffを0（R4値）に変えると、むしろ`rim`が
  `mid`そのものになってしまい不正確になる。**この箇所は元から（tilt=0では）正しく、
  変更してはならない。**
- 両ファイルとも、tilt≠0での実際のRendering位置とのズレは、Decision 3（Rotation Pivot
  semantics）の差によるものであり、Shaft Geometry migration（本Task）のスコープ外。

**教訓**: Architect Decisionが「4 consumerすべて同じ扱いが必要」と述べていたのは、grep結果
（`shaftMidY`/`shaftY`という同じ変数名パターンが4箇所に見つかった）に基づく妥当な初期分類
だったが、**各consumerの`position`引数がどの座標系（R1 self-contained absolute / R4 anchor
via resolveCanonicalPose）から来ているかまでは、Architect Decision作成時点では検証していな
かった**。今回、実装直前の最終確認（Task指示「単純な文字列置換をしないこと」「各consumerの
座標系・符号・offsetの適用順序を確認」）でこの違いが判明し、Debug-only 2箇所は変更しない方が
正しいという結論に至った。Active 2箇所（Collision/Rendering）は、`resolveCanonicalPose()`が
供給する`position`（R4 Anchor）を**外部から受け取ってローカルoffsetとして解釈する**構造
だったため、Architect Decisionの想定通り修正が必要かつ正しかった。

## 14. C-2/C-3/C-4 Revalidation（Partial）

Freeze State自体は変更していない。`evaluateDragCandidate`/`evaluateRotationCandidate`/
`evaluateShaftRollCandidate`はいずれも共通の`testCanonicalCandidate()`経由で
`buildProsthesisCollisionProxy()`（修正後）を使う（前回Safety Revalidationで確認済みの
Path、コード自体は本Taskで無変更）。5/6節の数値検証により、Translation candidateでは
Shaft球が正しい位置に復帰したことを確認した——C-2（Drag）・C-3（Rotation）・C-4いずれも
このShaft位置修正の恩恵を受ける（従来ズレていた場所ではなく、実際の解剖学的Shaft位置で
Collision判定されるようになった）。

## 15. Decision 3 Supplementary Verification

Decision 3（rotation semantics、`ANGLE_TILT_SIGN`/`ANGLE_TILT_Z_SIGN`）は変更していない。
5節の数値検証で、tilt/tiltZ≠0のとき全8球+Headが一律に（Shaft/Foot/Headで非対称にならず）
Decision 3由来の差を示すことを確認した——今回のShaft Geometry Fixは、Decision 3による
pivot差を悪化させても軽減してもいない（Fix前後で「全要素が一律に動く」という性質は不変、
Fix前は「Shaftだけ追加でズレる」という非対称成分が上乗せされていた点のみが変わった）。

## 16. Danger Zone / Safety Score

再測定していない（UNKNOWN）。`computeScore()`/`computeSafety()`（`useSimStore.ts`）は
PlacementStateの抽象値（lateralOffset等）から計算され、Collision Proxy形状
（`buildProsthesisCollisionProxy`の出力）を直接参照しないため、今回の修正はこの計算経路に
影響しない（Architect Decision 15節で確認済みのUnaffected consumerリストに基づく、原則不変の
判断を維持）。

## 17. TypeCheck

```
$ npx tsc -b
（エラーなし、0件）
```

## 18. Build

```
$ npm run build
✓ 799 modules transformed
✓ built in 11.13s
（chunk-size警告のみ、pre-existing・無関係）
```

## 19. Lint

```
$ npx eslint .
✖ 161 problems (147 errors, 14 warnings)
```
既存baseline（161、D-2/D-3以降固定）と完全一致。新規lint issueなし。

## 20. Git Integrity

```
$ git status --short
（Active 2ファイル: prosthesisCollisionGeometry.ts, ProsthesisModels.tsx が新たに差分を持つ。
  Debug-only 2ファイル: PoseComparisonOverlay.tsx, SimScene.tsxはコメント追加のみ。
  他の既存差分・untracked filesは前回セッションから完全に不変。）
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
unrelated files  = none
temporary files  = none（検証スクリプトはリポジトリ外scratchpadで作成・実行後に削除済み、
                          srcへは一切配置していない）
Commit           = NONE
Push             = NONE
```

## 21. Remaining Limitations

- 実MeshBVHでのPORP accept/reject二値結果の直接確認は今回もNOT REPRODUCIBLE
  （`document.hidden=true`固定、4セッション連続で同一の既知環境制約）。
- Rendering側（可視Shaftメッシュ）の視覚的な修正効果はScreenshotで確認できていない
  （UNKNOWN）——ただしCollision Proxy側とRendering側は完全に同一の式・同一の理由で修正して
  おり、コード上一致していることは確認済み。
- Danger Zone / Safety Scoreは未再測定（UNKNOWN、影響しないと推論される根拠は16節）。
- 実機（shojiさんの通常ブラウザ）でのTranslate/Rotate/Shaft Roll/Placement Commit目視確認は
  UNKNOWN（環境制約）。

---

## 28. Finding: `ManipulationLayer.tsx:130`（`InstrumentMarker`）— 本Taskスコープ外の関連Finding

```
Finding:
  src/scenes/transport/ManipulationLayer.tsx:130のInstrumentMarker（Transport段階の器具マーカー、
  装飾のみ）が、headOff = shaftLength/2 + 0.15というR1（旧）式を独自に保持している。
  ProsthesisModels.tsx側は既にheadOff = shaftLength + 0.15（R4）へ移行済み。

Evidence:
  実装直前のrepo-wide grep（`shaftLength / 2`パターン）で発見。コード読解で確認
  （13節(b)、本ファイル）。

Impact:
  Transport段階（instrumentSelected=true時のみ表示）の器具マーカー（鑷子アイコン）の表示位置が、
  実際のHead Plate位置からshaftLength/2だけズレる可能性がある。装飾的表示のみで、Collision
  判定・Rendering実体・Scoring・Safety計算のいずれにも影響しない（純粋に見た目のみ）。

Recommended Next Investigation:
  Architect承認の上、headOff = shaftLength/2 + 0.15 → shaftLength + 0.15への1行修正
  （footOff/headOffパターンの修正であり、shaftMidYパターンの修正ではないため、本Task
  （Shaft Geometry Migration）とは別の、小さな独立Fixとして扱うのが適切）。
```

---

## Final Verdict

```
Implementation:
  Shaft Geometry R4 Migration = COMPLETE
  （Active consumer 2箇所: prosthesisCollisionGeometry.ts, ProsthesisModels.tsx）
  Debug-only consumer 2箇所（PoseComparisonOverlay.tsx, SimScene.tsx bellMarkers）は、
  実装直前の追加検証により「変更しない」ことが正しいと判明したため、意図的に未変更
  （13節、Findingとして記録済み、Architect Decisionの想定を実装フェーズで修正した）。

Numeric Verification:
  = PASS
  全shaftLength(2/3/4mm)・全8球+Head Boxについて、tilt=0でR1とR4-fixedがmachine precision
  （~1e-16mm）で一致。tilt≠0での乖離はDecision 3由来（全要素一律、Shaft単独の残存誤差なし）。
  Live dynamic importによる実行中アプリからの直接確認とも一致（Confirmed、Observed）。

Collision Revalidation:
  = PARTIAL
  Proxy幾何のmachine precision一致は確定（PASS相当）。実MeshBVHでのaccept/reject二値結果は
  UNKNOWN（環境制約、NOT REPRODUCIBLE）。

C-track:
  C-2 Partial Revalidation（Shaft位置修正の恩恵を受けることを確認）
  C-3 Partial Revalidation（同上）
  C-4 Partial Revalidation（同上）
  Freeze state = 維持（変更なし）

TypeCheck = PASS
Build     = PASS
Lint      = 161（baseline通り、悪化なし）
Git Integrity = HEAD不変・Commit/Push=NONE・不要なfile変更なし

Critical Constraints遵守:
  Candidate B radius = 不変
  +0.15mm Head Plate alignment offset = 不変
  resolveCanonicalPose() = 不変
  FOOT_CONTACT_TOLERANCE_MM = 不変
  Danger Zone / Safety Score計算経路 = 不変
  Collision Engine semantics = 不変
  Decision 3 rotation semantics = 不変
  C-2/C-3/C-4 Freeze = 維持
  footOff/headOff（既存R4 migration） = 不変
```

## Architect Note

Active consumer 2箇所への最小修正は完了し、R1の歴史的なCollision安全性キャリブレーション
（Candidate B含む）とmachine precisionで一致することを数値・Live Runtimeの両方で確認した。
一方、Debug-only consumer 2箇所については、Architect Decisionの想定を実装直前の座標系検証で
覆す事実が見つかり、「変更しないことが正しい」という結論に至った——これはArchitect Decision
自体の誤りというより、Decision作成時点ではconsumerの`position`供給元（座標系）までは検証して
いなかったことによるギャップである。また、本Task範囲外の関連Finding
（`ManipulationLayer.tsx`の`InstrumentMarker`）を1件新たに発見し、実装せずFindingとして報告する
（28節）。次のステップはshojiさん/Architectによるこれらの報告内容の確認と、実機でのMeshBVH
accept/reject最終確認である。
