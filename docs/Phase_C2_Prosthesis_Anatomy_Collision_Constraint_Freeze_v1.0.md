# Phase C-2: Prosthesis-Anatomy Collision Constraint（Placement Drag）凍結 v1.0

**Status**: Completed
**Date**: 2026-08-14
**対象コミット(主要)**:
- `ef1bc0e` — Occlusion診断 + Collision Engine(C-1) + Collision Constraint(C-2) + Collision Boundary Warp検証ハーネス、一括実装（診断ログ除去済み状態でコミット、詳細は本文書§5参照）

## 1. Phase概要

**目的**: Placement段階（`DraggableProsthesis`）でのProsthesisドラッグ操作に、側頭骨（Bone）との
物理的な貫通を防ぐCollision Constraintを追加する。Rendering Depth Occlusion（描画順序）とは
明確に区別される、幾何学的な貫通防止機構。

**前提**（Architect承認済み設計、変更不可）:
- Collisionしたらdragをlockするのではなく、Candidate PoseだけをRejectする（逆方向への
  移動は即座に許可される）
- Frozen対象（`useScreenSpaceDrag`本体・`handleMove`・`handleUp`、`TransformControls`、
  `ManipulationLayer.tsx`、Rendering/Material/Occlusion Mesh設定）には一切変更を加えない
- 初期スコープはBone単体（`DRAG_COLLISION_TARGETS = ['bone']`）。Malleus/StapesはPhase C-6で
  拡張予定
- Collision Proxy（Shaft/Foot=Sphere、Head Plate=OBB）はPhase C-1で単独検証済みの
  `buildProsthesisCollisionProxy()`をそのまま再利用する

**基盤（Phase C-1、本Phaseで同時にコミット）**: `anatomyCollisionIndex.ts`
（`MeshBVH`ベースのAnatomy側静的インデックス）、`prosthesisCollisionGeometry.ts`
（Prosthesis側Collision Proxy生成）、`collisionTest.ts`（Sphere/Box vs BVHの判定）。
`?debug=collision`限定の単独検証ハーネス（`CollisionVerifyOverlay.tsx`の
`CollisionVerifyTracker`/`CollisionVerifyPanel`）で3ケース（Far away/Bone内部点/症例1正常配置）
のPASSを確認済み。

## 2. 実装内容

### Collision補正の配線（`DraggableProsthesis`、`SimScene.tsx`）

```
pointermove → useScreenSpaceDrag.handleMove → dragGroupRef.position = candidate（Frozen）
                                                     ↓
                                     useFrame（新規、DraggableProsthesis内のみ）
                                                     ↓
                           Collision Test → No Collision: lastValid更新
                                          → Collision   : dragGroupRef.position = lastValid
```

`useScreenSpaceDrag`本体の計算式・イベント購読には一切触れず、同じObject3D
（`dragGroupRef`）を外側の`useFrame`から読み書きする「Correction pattern」で実装した。

`lastValidLocalDeltaRef`はドラッグ開始（`onDragActiveChange(true)`）のたびに`(0,0,0)`へ
リセットする（Architect指示Invariant「前回DragのlastValidを次のDragへ持ち越さない」）。

`composeDragCandidatePose()`（`SimScene.tsx`）は「committed placement
（`computeProsthesisModelPose()`の出力）+ dragGroupRefのraw local delta」を合成し、
`shaftRollDeg`後乗せも本番の`renderQuaternion`と同じ式で再現する（Collision判定は実際に
描画される最終Poseに対して行う、Architect指示）。

### Release時ガード（重要な発見）

`useScreenSpaceDrag.handleUp`（Frozen、pointerupイベント）は「最後のpointermove直後、
次のrAFティックより前」に同期的に発火するため、`useFrame`側の補正が1フレーム遅れて効くのに
対し、pointerupはその補正前の`group.position`を読んでしまうレースコンディションが存在する
（Transport段階の既知の非対称性、`ManipulationLayer.tsx:416-421`参照、と同種の問題が
Placement Drag側にも理論上存在すると判明）。

対策として、Release時（`onDragEnd`コールバック内）にも同じ`evaluateDragCandidate()`判定を
もう一度実行し、衝突していれば`lastValidLocalDeltaRef`へ差し替える。

## 3. Evidence（実機ログによる確認）

### 3.1 前進での衝突停止・後退での脱出

実機コンソールログにより、`dragLocalDelta`が変化するたびに`collided: false ⇄ true
(anatomyId: 'bone')`が実際のドラッグ操作と連動して切り替わることを確認。前進（Boneへ
近づく方向）でCandidate Poseが正しくRejectされて停止し、後退（Boneから離れる方向）では
即座に受理されることを確認した。

### 3.2 Release時のlateralOffset保持（Evidence Based Review基準を満たす実測データ）

一時的な検証ハーネス（Collision Boundary Warp、§4参照）でWarpした`lateralOffset`が、
Release確定までの間に意図せず上書きされていないかを実測ログで確認した。

```
[CollisionBoundaryWarp][診断] storeLateralOffsetAfterUpdate: -0.5804654598236084
[TransportCommit][診断]        lateralOffsetBeforeThisEffect: -0.5804654598236084
[TransportCommit][診断]        lateralOffsetAfterThisEffect:  -0.5804654598236084
[CollisionConstraint][C-2診断][release] ... lateralOffset(committed)=-0.580
```

Warp直後・既存のTransport→Placement Commit処理（`commitTransportPoseToOffsets`、Frozen、
`dragOffsetX/Y/Z`のみを返す設計で`lateralOffset`には触れない）通過後・実際のPlacement Drag
確定時の3箇所で値が完全一致（`-0.5804654598236084`）しており、推測ではなく実測値による
確認が取れている。

### 3.3 原因の切り分け（重要）— 2つの別問題を混同しないこと

実機検証中に「逆方向へドラッグして離すと元の配置に戻る」という報告があったが、原因調査の
結果、これは**2つの独立した問題**が混在していたことが判明した。今回のC-2検証で説明が
付いたのは原因Bのみであり、原因Aは本Phaseのスコープ外のまま未解決で残っている。

**原因A（未解決、本Phaseのスコープ外）**: `ManipulationLayer.tsx:416-421`に既存記載の
Phase1-B既知の制限。`DirectTransportProsthesis`側（Transport段階、C-2とは別コンポーネント）で、
`useScreenSpaceDrag.handleUp`のimperative reset（`group.position.set(0,0,0)`、同期的）と
Reactのstate commit（非同期）の間に生じる、1フレーム未満の微小な視覚的揺らぎ。
position/quaternion/worldPos/screenPosは診断ログ上連続しており、原因は特定できていない。
Phase1-Bのスコープで既に「これ以上の追跡は行わない」と結論済みであり、本Phaseでも対応しない。

**原因B（今回のC-2検証で説明済み、バグではない）**: `DraggableProsthesis`の
`dragOffsetX/Y/Z`確定処理には、Collision Constraintとは無関係の既存仕様として±3mmの
クランプ（`clamp3()`）が元々存在する。実機ログで`dragOffsetBefore=(3.000, 3.000, 3.000)`
（既にクランプ上限）の状態から大きな生の移動量（`localDelta`で最大26mm相当）のドラッグを
行った結果、`dragOffsetAfterClamp`がクランプ境界へ張り付き、ユーザーの意図した位置と
無関係な結果になっていたことを実測データで確認した。これは既存仕様どおりの動作であり、
Collision Constraintのバグではない。

この2つの原因は性質・所在（原因Aは`DirectTransportProsthesis`のimperative/Reactタイミング
問題、原因Bは`DraggableProsthesis`の既存±3mmクランプ）が異なるため、報告・記録上も分離して
扱う。原因Bが主要因と判明したことで、原因Aの緊急度は当面下がったと判断する（Issue化は
必須とせず、`ManipulationLayer.tsx`の既存コメントのまま維持する、Small Change原則）。

## 4. Collision Boundary Warp検証ハーネス（一時、Architect依頼対応）

Phase C-2実機検証（逆方向脱出のQuestion 1判定）のため、「側頭骨の外側・Collision発生直前
（まだ非衝突）」のlateralOffsetを二分探索で機械的に求めてPlacementStateへワープする
一時的なテスト機能を追加した（`CollisionBoundaryWarpTracker`、`SimulationMode.tsx`の
「🧪 [TEST] Collision境界直前へワープ」ボタン）。

安全マージン込みの探索範囲を`ABS_SEARCH_LIMIT_MM = 2.5`に制限しており、見つかる境界は
必ず既存の±3mm `dragOffsetX/Y/Z`クランプ内で逆方向ドラッグにより脱出できることを保証する
設計とした（`idealLateralOffset===0`の症例で探索範囲が際限なく広がる設計ミスを実機検証中に
発見・修正済み）。

このハーネス自体は「🧪 [TEST] 理想位置で配置を強制確定」ボタンおよびPhase C-1の
`?debug=collision`単独検証ハーネスと同様、恒久的なテスト用ツールとして温存する
（Phase C-1クローズ時の前例に倣い、Phase完了＝ツール削除ではないと判断）。C-3以降の
Placement系テストでも流用できる想定。

## 5. 診断ログの除去について（コミット構成に関する注記）

本セッションではPhase C-1/C-2/Collision Boundary Warp（および先行するOcclusion原因診断）の
一連の作業が開始時点から一度もコミットされておらず、`git log`上に「診断ログ追加」に相当する
コミットが存在しなかった。そのため、Architect指示の「診断ログの削除を単独コミットで実施」を
文字通りの意味（既存コミットに対するrevert的な削除コミット）では実行できなかった。

代替として、実機ログでの原因切り分けに使用した一時的な`console.log`/`console.warn`
（`[CollisionConstraint][C-2診断]`系、`[CollisionBoundaryWarp][診断]`、
`[TransportCommit][診断]`）はすべて**コミット前にワーキングツリーから除去**したうえで、
Phase C-1/C-2/Warpハーネス一式を単一のコミット（`ef1bc0e`）にまとめた。結果として、
git履歴上に診断ログが混入した状態は一度も存在しない（除去漏れがないことはBuild/Lint後の
`grep`で確認済み）。

Collision Boundary Warpハーネス自体が持つ通常運用ログ（`[CollisionBoundaryWarp]`
探索開始/完了ログ、`CollisionVerifyTracker`の`console.table`/`console.log`）は、
一時的な原因調査用ではなく該当ツールの操作結果フィードバックの一部であるため、
Phase C-1の前例と同様に維持している。

## 6. Build/TypeCheck/Lint

- TypeCheck（`tsc --noEmit`）: エラー0件
- Build（`vite build`）: 成功
- Lint（`eslint`）: 診断ログ除去後、C-2関連ファイルの指摘は既存ベースライン（`git stash`で
  比較確認済み、35件、本Phaseの変更に起因するものはゼロ）から増加なし。
  `CollisionVerifyOverlay.tsx`（Phase C-1/C-2/Warpハーネスの実体）単体では指摘0件。

## 7. Known Limitation

- **原因A**（`ManipulationLayer.tsx:416-421`既存記載のPhase1-B既知の制限）は未解決のまま。
  本Phaseでは対応しない。Issue化は見送り、既存コメントを正とする。
- Collision対象はBone単体（`DRAG_COLLISION_TARGETS = ['bone']`）。Malleus/StapesはPhase C-6
  まで未対応。
- Collision Constraintは`footType === 'BELL'`（PORP系）のみ対応（`buildProsthesisCollisionProxy`
  のPhase 1スコープ、Phase C-1から継続）。FLAT/CLIP/PISTON/FLEXIBALは未対応（Collision
  Constraintが常に非衝突扱いになる、安全側フォールバック）。

## 8. 次Phaseへの引継ぎ

**次Phase**: Phase C-3（Rotation）、C-4（ControlPad/Keyboard）、C-5（Transport）、
C-6（Malleus/Stapes拡張）、C-7（実機検証）— いずれもArchitectの事前承認なしに着手しない。

**引継ぎ事項**:
- `evaluateDragCandidate()`（`DraggableProsthesis`内）はPlacement Drag専用。Rotation
  （C-3）やTransport（C-5）向けのCollision Constraintは別途設計・実装が必要（本Phaseの
  スコープ外）。
- Collision Boundary Warpハーネスは残しているが、C-3以降で別のCollision検証ニーズが
  出た場合は、それぞれのPhaseで改めてArchitectへ設計提案すること（本ハーネスを無条件に
  流用してよいとは限らない）。

## 9. 参照文書

- `ManipulationLayer.tsx:416-421`（原因Aの既存記載箇所）
- `src/engine/collision/anatomyCollisionIndex.ts`
- `src/engine/collision/prosthesisCollisionGeometry.ts`
- `src/engine/collision/collisionTest.ts`
- `src/scenes/debug/CollisionVerifyOverlay.tsx`

## 10. Final Status

```
Phase C-2
Status: Completed (PASS)
Blocking Issue:
None
Open Issues:
原因A（ManipulationLayer.tsx既存記載、Issue化見送り）
Next Phase:
C-3以降（Rotation/ControlPad/Transport/Malleus-Stapes拡張/実機検証）
着手はArchitectのスコープ承認後
```
