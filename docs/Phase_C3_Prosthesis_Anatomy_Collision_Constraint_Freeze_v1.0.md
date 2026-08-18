# Phase C-3: Prosthesis-Anatomy Collision Constraint（Rotation）凍結 v1.0

**Status**: PASS / CLOSED / FROZEN
**Date**: 2026-08-16
**C-2 Freeze**: 維持（`docs/Phase_C2_Prosthesis_Anatomy_Collision_Constraint_Freeze_v1.0.md`、無変更）
**対象コミット(主要)**:
- `fdd7452` — feat(collision): Phase C-3 Rotation Collision Constraint実装
- `f272aca` — fix(transport): Direct Transport Release時の二重並進を修正
- `f233ab1` — fix(sim): TEST強制確定後のtransportPose再上書きを防止
- `d6c545a` — perf(sim): Rotate placement commitをrAF/useFrameへ間引く
- （参照）`910289a` — docs: Phase C-2 Freeze文書追加

## 1. Status

```
C-3 = PASS / CLOSED / FROZEN
C-2 = PASS / Freeze維持（本Phaseによる変更なし）
```

## 2. C-3 Core Objective

**目的**: Placement段階でのProsthesis軸傾斜回転操作（Keyboard Shift+Arrow、および
Direct Manipulation Rotate Modeのドラッグ）に、Phase C-2（Placement Drag）と同種の
Prosthesis-Anatomy Collision Constraintを適用する。

**基本動作**（実装・実機検証済み）:

```
Rotation Candidate生成
        ↓
Collision Evaluation（evaluateRotationCandidate）
        ↓
PASS → Placement更新（angleTilt / angleTiltZ）
FAIL → Rotation停止（候補を採用せず、直前の安全な角度を維持）
```

`evaluateRotationCandidate()`はC-2の`buildProsthesisCollisionProxy()`/`testCollision()`を
そのまま再利用し、判定ロジック自体は複製していない（Keyboard Shift+Arrow・Rotateドラッグ・
Rotation Boundary Warpハーネスの3経路が共通で使用）。

**Core Objective Status**: **PASS**

## 3. Root Cause A（TEST強制確定後のtransportPose再上書き）

**Status**: `CONFIRMED / FIXED / VERIFIED`

TEST（理想位置で配置を強制確定）ボタン使用後、Rotateが常にCollisionでブロックされる
症状が報告され、実機ログにより以下のRoot Causeが確認された。

```
TEST
  ↓ Placement更新（正しい値でupdatePlacement()）
  ↓
Transport→Placement Commit用の既存useEffect（`manipulation.committed`監視）
  ↓ transportPoseから再計算（commitTransportPoseToOffsets）
  ↓
transportPoseがcreateInitialTransportPose()の初期値のまま
（TESTはtransportPoseに一切触れないため）
  ↓ ±3mmクランプにより dragOffsetX/Y/Z = (3, 3, 3) を再書き込み
  ↓
TESTが直前に設定した正しいdragOffset=(0,0,0)をサイレントに上書き
  ↓
汚染されたPoseがbaseline自体で既にCollision状態
  ↓
Rotateの全候補がCollisionでRejectされる（Rotate不可に見える）
```

実機観察値との一致:

```
idealLateralOffset = -0.2
clobbered dragOffsetX = +3.0
結果 = 2.80mm（shojiさん報告値と一致）
```

**Fix**: Transport→Placement Commit用`useEffect`から、`transportPose`を再計算して
`updatePlacement()`/`markPositionTouched()`する処理を削除。offsetsの書き込み責務は、
`manipulation.committed`をtrueにする側（`DirectTransportProsthesis`の`onRelease`、または
TEST等の強制確定ハンドラ）が既にそれぞれ正しい値で行っているため、当該`useEffect`は
`hasCommittedRef`ガード＋`onManipulationCommitted?.()`呼び出しのみに縮小した。

## 4. Rotate Smoothness

**Status**: `ROOT CAUSE CONFIRMED / FIXED / VERIFIED`

実機で「引っ掛かり・遅延あり」というSmoothness FAILが報告され、Read-only調査
（実プロジェクト関数＋実`Bone.glb`由来のMeshBVHを使ったNode harness、
`scripts/rotate-smoothness-cost-harness.ts`）により原因を切り分けた。

**調査結果**:

| 候補原因 | 判定 | 根拠 |
|---|---|---|
| `evaluateRotationCandidate()`の処理コスト | 非主因 | mean≈0.085ms / median≈0.084ms / p95≈0.110ms（うちCollision評価/BVHが94%）。1 pointermoveあたり最大2回呼ばれても計0.17msで60fps予算(16.6ms)に対し無視できる |
| keydown-effectのリスナー再登録 | 非主因 | Rotate-drag中は`isMove=false`のため、リスナー自体（`addEventListener('keydown',...)`）は一度も呼ばれていない（コード確認） |
| Rotate pointermove時の同期React state update / rerender | **主因** | 生pointermoveイベントごとに`updatePlacement()`/`markAngleTouched()`を同期呼び出し、未memo化のSimScene/DraggableProsthesis配下全体がrAFを介さず再レンダーされていた（Move-dragはuseFrame経由でのみ候補評価・store commitを行う設計との非対称性） |

**Fix**: Collision評価の呼び出し頻度・粒度（毎pointermoveで評価、PASSした候補のみ採用）は
無変更のまま、PASS済み候補をReact state（store）へ書き込む頻度のみをrAF/`useFrame`で
1フレーム1回に間引いた。`pendingAngleTiltRef`/`pendingAngleTiltZRef`（PASS済み候補の
一時保持、nullが「新規候補なし」を表すsentinel）と、pointerup時の同期Release時flush
（`useScreenSpaceDrag.handleUp`が次のrAFティックより前に同期発火しうるため、最後の
数pixel分の回転取りこぼしを防ぐ、C-2のRelease時ガードと同じ設計思想）を実装。

**実機確認**: 引っ掛かり・遅延の解消、Collision Stopの維持、Regression（TEST→Rotate/
TEST→Move/通常Transport→Release）にPASS。

## 5. 実機Regression（STEP C、5ケース）

```
① Transport操作なし → TEST                PASS
② Transport操作後 → TEST                  PASS
③ TEST → Rotate                           PASS
④ TEST → Move                             PASS
⑤ 通常Transport → Release                 PASS
```

## 6. Foot Contact Tolerance（Provisional）

```
FOOT_CONTACT_TOLERANCE_MM = 0.15
```

role==='foot'の球についてのみ、単純な交差判定ではなく「貫入深度がこの値を超えたら
collided」という深度考慮判定に切り替えるための値（`collisionTest.ts`/
`prosthesisCollisionGeometry.ts`）。

**これは正式なClinical / Educational thresholdではない**。既存
`CollisionVerifyOverlay.tsx`の`CollisionBoundaryWarpTracker`が使用する`marginMm=0.15`
（境界からの安全側オフセット、同じCollision Constraint機能ファミリー内の既存precedent）に
倣った暫定初期値であり、Placement Scoringの位置偏差バンド・既存設計文書・実測値のいずれ
からも臨床的に妥当な閾値をEvidenceのみから導出できないことを確認した上での
Diagnostic Parameterである。

**Status**: `DIAGNOSTIC / PROVISIONAL`（C-3 Freezeによってこの0.15mmが正式基準になった
と解釈してはならない）

## 7. Candidate B（Foot Sphere半径、Diagnostic）

```
Foot #0（rim側）= 0.7950 mm
Foot #1        = 0.7704 mm
Foot #2（apex側）= 0.6028 mm
```

実Bell Foot形状（rim→apexの先細り）との幾何形状差分解析（STEP 4A〜4C）から導出した
個別半径。#0はBELL_RIM_RADIUS_MMと同一、#1/#2は先細りを反映した縮小値。

実機結果:

```
Foot #0 → Collision継続
Foot #1 → Collision継続
Foot #2 → Collision解消
```

Safety Marginを含まない幾何学的最小値であり、最終確定値ではない。

**Status**: `DIAGNOSTIC / NOT FINAL`

## 8. Foot Proxy Known Limitation

実Footは単純な球ではなく、rim・先細りcup形状・slit・実接触面を持つ複雑な形状であるのに
対し、現在のCollision Proxyは3球近似（`SHAFT_SPHERE_COUNT`とは別に`FOOT_SPHERE_COUNT=3`)
を使用している。§7で残った#0/#1のCollision継続は、座標系の残差だけでは説明しきれず、
**球Proxyと実Foot形状の構造的な近似誤差**が主要因と判断される。

これはC-3の実装不具合ではなく、将来のGeometry再設計課題として記録する。

## 9. Contact vs Penetration（意味論上の既知の緊張関係）

既存Placement Scoring（`useSimStore.ts`の`computeScore()`）はFoot-底板接触を理想状態と
して設計している一方、Collision Constraintは幾何学的交差を一律forbiddenとして扱うため、
両者の意味論には緊張関係がある（§6のFoot Contact Toleranceはこれを緩和する暫定対応）。

既存のPlacement Scoring位置偏差バンド（`0.3 / 0.6 / 1.0mm`）は**verticalDeviation**
（採点用の位置ずれ許容量）であり、Collision Constraintのpenetration threshold（貫入許容
深度）として直接流用できる値ではない。§6のFOOT_CONTACT_TOLERANCE_MM=0.15はこれらの
既存値から導出したものではなく、独立したDiagnostic Parameterである。

## 10. Malleus / Stapes（Scope外）

```
DRAG_COLLISION_TARGETS = ['bone']
```

現在のCollision Constraint（C-2 Drag / C-3 Rotationとも共通）は側頭骨（Bone）のみを
対象とする。

```
Temporal Bone = 対象
Malleus        = 対象外
Stapes         = 対象外
```

TEST等でMalleus/Stapesと視覚的に重なって見える場合があるが、これはCollision Engineが
Malleus/Stapesを一切評価していないことによる既知の仕様であり、C-3のRegressionではない。

**Status**: `C-3 OUT OF SCOPE / FUTURE`（Phase C-6で拡張予定）

## 11. STEP 4D

**Status**: `DEFERRED`

## 12. Collision Boundary Transition（Verification Gap）

Collision候補がFAILした場合、`pendingAngleTiltRef`/`pendingAngleTiltZRef`へは書き込まれず
（＝storeへflushされず）、直前の安全な角度がそのまま維持される、というロジックは
コード上確認済みであり、Release時flush（pointerup時の同期flush）も実装済みである。

```
Logic     = consistent（コード確認済み）
Direct HW = 実機での直接検証は未完了
```

「回転を続けてCollision境界へ到達した瞬間、実際にそこで停止すること」自体の直接実機確認は
行っていない（実機確認時はBoneに近い位置からRotateを試みて最初の候補から拒否される
ケースのみ確認、境界到達までの遷移過程は未確認）。

これは**C-3 Blockerではなく、Verification Gap**として記録し、C-3のClose/Freezeを
妨げるものとしては扱わない。

## 13. Build / TypeCheck / Lint

```
TypeCheck（tsc -b）  = PASS（0 errors）
Build（vite build）   = PASS（798 modules transformed、built in 11.45s）
Working Tree          = CLEAN（HEADと完全一致）
```

Lint（`eslint`）:

```
repo-wide（eslint .） = 162 problems（148 errors / 14 warnings）
変更対象ファイル       = 新規Lint問題なし（git stashによるA/B比較で個別確認済み）
repo-wide baselineとの厳密比較 = 未実施
```

repo-wide 162件は今回のC-3変更に起因するものではない（変更対象ファイルは個別に
baseline比較済み、新規0件）。この未比較状態はC-3のClose/Push条件とはしない。

## 14. Commit History

```
fdd7452  feat(collision): Phase C-3 Rotation Collision Constraint実装
f272aca  fix(transport): Direct Transport Release時の二重並進を修正
f233ab1  fix(sim): TEST強制確定後のtransportPose再上書きを防止
d6c545a  perf(sim): Rotate placement commitをrAF/useFrameへ間引く
```

（参照、C-2）:

```
910289a  docs: Phase C-2 Freeze文書追加（Prosthesis-Anatomy Collision Constraint）
```

## 15. Push Status

```
Push = NOT YET EXECUTED
```

本Freeze文書作成時点ではPushを実行していない。Pushは別途、Architectからの明示的指示を
起点として実行する。

## 16. 次Phaseへの引継ぎ

**次Phase候補**: C-6（Malleus/Stapes拡張）、Foot Proxy再設計、Candidate B再評価、
Foot Contact Tolerance妥当性検証、STEP 4D — いずれもArchitectの事前承認なしに着手しない。

**引継ぎ事項**:
- §6 Foot Contact Tolerance、§7 Candidate Bは最終確定値ではない。数値のみを
  Architectが今後更新する前提で、Collision Engine構造自体（Proxy生成/BVH判定ロジック）は
  変更しないこと。
- §8 Foot Proxy Known Limitationは、将来のGeometry再設計（実Foot形状ベースのProxy）の
  出発点として扱うこと。
- §12 Collision Boundary Transitionの直接実機検証は、次にRotate周りへ着手する際の
  最初の確認事項として引き継ぐ。
- `scripts/rotate-smoothness-cost-harness.ts`はRegression再現用として温存する
  （実プロジェクト関数＋実Bone.glbを使用、C-2のCollision Boundary Warpハーネス同様
  恒久ツールとして扱う）。

## 17. 参照文書

- `docs/Phase_C2_Prosthesis_Anatomy_Collision_Constraint_Freeze_v1.0.md`
- `src/engine/collision/anatomyCollisionIndex.ts`
- `src/engine/collision/prosthesisCollisionGeometry.ts`
- `src/engine/collision/collisionTest.ts`
- `src/scenes/debug/CollisionVerifyOverlay.tsx`
- `scripts/rotate-smoothness-cost-harness.ts`

## 18. Final Status

```
Phase C-3
Status: Completed (PASS / CLOSED / FROZEN)
Blocking Issue:
None
Open Issues (Provisional / Future, not blockers):
Foot Contact Tolerance (0.15mm) — Diagnostic/Provisional
Candidate B — Diagnostic/Not Final
Foot Proxy spherical approximation — Known Limitation
Malleus/Stapes — Out of Scope (Future C-6)
STEP 4D — Deferred
Collision Boundary Transition — Verification Gap（実機直接検証未完）
Repo-wide Lint baseline — 未厳密比較（Close/Push条件とはしない）
Push:
NOT YET EXECUTED（別途明示的指示を起点に実行）
Next Phase:
C-6以降（Malleus/Stapes拡張等）
着手はArchitectのスコープ承認後
```
