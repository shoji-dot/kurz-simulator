# Phase 1-B: Prosthesis-centric Direct Manipulation UX ── Implementation Prompt v1.0

Status: Ready for Claude Code implementation
Author: Technical Architect (shoji承認済み)
Base commit: `a2247d5`（Phase1 Interaction/Transport Layer、実機確認の結果ボタン手順UXは不採用）
Pattern: Strangler Pattern / Small Change

---

## 0. 位置づけ

本書はTechnical Architectとして整理した設計をClaude Code（実装担当）へ引き継ぐための実装依頼書。
Read-only調査2回（計34ツール呼び出し）でArchitecture Proposalを作成しshoji承認済み（Verdict: PASS
WITH MINOR REVISION）。続けてshojiが4件のOpen Questionsに回答済み（§3）。本書はこれらを踏まえた
最終仕様であり、これ以上の設計判断はClaude Code側で行わず、疑問点があれば実装を進めず確認すること。

---

## 1. 背景（簡潔）

Phase1（`a2247d5`、Instrument-centric: 器具選択→把持→ドラッグ→解放の4ボタン手順UI）を実機確認した
結果、「留置後の再操作のために画面状態から離脱する必要がある」という手順要求型UXが医師向けとして
不適切と判明した。Phase 1-Bでは、Prosthesisを直接クリック→ドラッグ→ControlPad微調整→shaft軸回転→
再選択可能、というProsthesis-centric UXへ転換する。

---

## 2. 実装目的

1. Prosthesisを直接クリックして掴む（器具選択という中間ステップを廃止）
2. スクリーン空間ドラッグでProsthesisを移動できる（TransformControlsのギズモに頼らない）
3. 留置（Commit）後も、再度クリック→ドラッグで位置を微調整できる（Transportへ戻る必要がない）
4. ControlPadで位置・回転（前後傾斜/左右傾斜）に加えてshaft軸回転（↺/↻）を操作できる
5. 上記すべてを既定（デフォルト）UXとしつつ、旧TransformControls経路はfeature flagで温存する
6. PlacementStateの意味・Safety Engine・Frozen Geometry・Frozen座標系には一切変更を加えない

---

## 3. 確定方針（shoji回答済みOpen Questions、実装時は以下に厳密に従うこと）

| # | 論点 | 決定 | 理由・適用方法 |
|---|------|------|----------------|
| 1 | Shaft roll回転をSafety Engineへ反映するか | **限定的に許容**。Safety判定ロジック自体は変更しない。rollはInteraction Layerのpost-multiplyとして描画にのみ反映し、`computeScore()`/`computeSafety()`/`checkProximityToDanger`/`exportGroundTruth.ts`などSafety・スコア計算・Ground Truth出力の入力には一切渡さない。 | 「rollがSafety判定に影響しないことが既知の範囲」に限定する。将来rollが臨床的安全性に影響すると判明した場合は別Phaseで統合を検討する。 |
| 2 | Shaft roll stateの永続性 | **Caseごとにリセット**（0°に戻す）。セッションを跨いだ永続化は行わない。 | `useSimStore.ts`の`setSelectedCase`と`resetSimulation`の両方でリセットする（既存`interactionFlags`と同じ扱い）。 |
| 3 | 選択状態の視覚フィードバック（outline等） | **後続Polish Phaseへ分離**。Phase 1-Bのスコープには含めない。 | 選択状態自体（内部state）は必要だが、その視覚化（枠線・発光等）は今回実装しない。 |
| 4 | 旧TransformControls経路の扱い | **Feature flag化する**。`FEATURE_DRILL_ENABLED`（`src/App.tsx`）と同じ命名・運用パターンで`DIRECT_MANIPULATION_UX`のようなモジュールレベル定数を新設し、既定値`true`。 | flag ONで新UX、OFFで旧経路（`a2247d5`以前のdragMode토글+TransformControlsギズモ）に完全復帰できるようにする。 |

---

## 4. Evidence（実コード確認済み、2026-08-11時点）

- `PlacementState`（`src/store/useSimStore.ts:11-21`）: `dragOffsetX/Y/Z`は±3mmクランプの3D
  ドラッグ累積値。roll相当のフィールドは存在しない。
- `computeScore()`（`src/store/useSimStore.ts:218-`）は`angleTilt`/`angleTiltZ`/`dragOffsetX/Y/Z`等
  のみを読み、shaft軸まわりのroll概念を一切使わない → roll新設はスコア計算に無影響で追加できる。
- `ProsthesisModel()`（`src/scenes/models/ProsthesisModels.tsx:1750-1786`）は
  `pose = poseOverride ?? computeProsthesisModelPose(...)`の結果`pose.quaternion`をそのまま
  outer `<group quaternion={pose.quaternion}>`へ渡している。Head Plateは`[0, headOff, 0]`
  （local +Y方向）に配置されており、**local +Yがshaft軸**（`solvePose.ts`の`PoseInput.forward`
  コメントと一致）。→ この`<group>`へ描画するquaternionにpost-multiplyでlocal Y軸回転を追加
  すれば、`computeProsthesisModelPose`/`computeCurrentAxisAlignmentPose`/
  `computeCurrentAxisAlignmentOrientation`（いずれもFrozen、Safety/Score/GroundTruthが依存）
  には一切触れずにshaft rollを実現できる。
- `DraggableProsthesis`（`src/scenes/SimScene.tsx:538-636`）: 既存の`dragMode==='move'`時のみ
  TransformControlsギズモを表示、`handleMouseUp`でstoreへコミットする現行パターン。
- `ManipulationLayer.tsx`（Phase1新設）: `TransportPose`/`ManipulationState`/
  `commitTransportPoseToOffsets()`が既に実装済み。「Transport→Placementの唯一の変換点」として
  再利用可能（`commitTransportPoseToOffsets`は無変更で再利用してよい）。
- `SimulationMode.tsx:1005-1290`: Phase1のSelect/Grasp/Releaseボタン3つと`instrumentSelected`/
  `isGrasped`/`manipulationCommitted`のlocal state、および`<SimScene manipulation={...}>`の配線
  （L1089）。実機確認で不採用となったUIはここに集約されている。
- `ControlPad.tsx`（`src/components/ui/ControlPad.tsx`）: 既に位置3軸（x/y/z）＋回転2軸
  （tilt/tiltZ）のHoldButtonを実装済み。shaft roll用ボタンはまだ存在しない。
- `transformControlsConfig.ts`: `ROTATION_STEP_DEG=1`/`ROTATION_STEP_FINE_DEG=0.2`/
  `ROTATION_STEP_FAST_DEG=5`など既存の回転ステップ定数。roll操作にも同じ定数を再利用する。
- `App.tsx:17`: `const FEATURE_DRILL_ENABLED = false;` ── 本プロジェクトのfeature flag命名・
  運用の precedent。
- `RealMalleus`等（`src/scenes/SimScene.tsx:1202-1204`）: 既存の3Dオブジェクトクリック検出は
  「可視mesh自体へ`onDoubleClick`を付与」する方式で、専用の不可視hit-targetレイヤーは使って
  いない。Prosthesisのshaft径（PISTON等でØ0.4mm）は細いため、クリック精度が問題になる場合のみ
  透明・拡大hit-cylinderの追加を検討可（Frozen Geometryの定義自体には触れない、描画・
  レイキャスト専用の追加要素として扱うこと）。

---

## 5. 対象ファイル

- `src/store/useSimStore.ts` （新規state・action追加）
- `src/scenes/SimScene.tsx` （DraggableProsthesis拡張、feature flag分岐）
- `src/scenes/models/ProsthesisModels.tsx` （shaft roll描画時post-multiply、hit-target検討）
- `src/scenes/transport/ManipulationLayer.tsx` （既存`TransportPose`/`commitTransportPoseToOffsets`
  の再利用、必要なら直接ドラッグ用の補助関数追加）
- `src/components/SimulationMode.tsx` （Select/Grasp/Releaseボタン置換、feature flag分岐）
- `src/components/ui/ControlPad.tsx` （shaft roll ↺/↻ボタン追加）
- `src/scenes/transformControlsConfig.ts` または新設の定数ファイル（feature flag定数）

対象外（触らない）: `solvePose.ts`（Frozen、composeNormal未実装のまま）、
`computeProsthesisModelPose`/`computeCurrentAxisAlignmentPose`/
`computeCurrentAxisAlignmentOrientation`（数式・シグネチャとも無変更）、`src/engine/safety/**`、
`src/engine/groundTruth/exportGroundTruth.ts`、Frozen座標定数（`STAPES_HEAD`/`STAPES_FOOTPLATE`/
`UMBO_POS`等）、`StepFlowMode.tsx`（Phase 1-Bのスコープ外、`manipulation`未指定時の既存動作を
維持するだけでよい）。

---

## 6. Implementation Boundary（制約条件、絶対厳守）

- `a2247d5`をベースにする
- Geometry変更禁止（新規プリミティブ追加は「クリック判定用の不可視要素」に限り許容、視覚的には
  何も変わらないこと）
- `PlacementState`のフィールド追加・意味変更禁止（shaft roll等の新規stateは`placement`オブジェクト
  の外に置く、既存`interactionFlags`と同じ「並置」パターンに従う）
- Frozen座標系・Frozen Geometry関数（§5「対象外」）変更禁止
- EAC入口landmarkは今回追加しない（既存の暫定初期位置のまま出荷）
- `TransformControls`ベースの旧UI（`DraggableProsthesis`のギズモ、Phase1の
  Select/Grasp/Releaseボタン）は削除せず、feature flag OFFで完全復帰できる状態を維持する
- `TransportPose`/`ManipulationState`/`commitTransportPoseToOffsets()`のcommitロジックは再利用
  する（再実装しない）
- Placement済み（committed）の再調整は、既存`dragOffsetX/Y/Z`への直接delta加算で完結させる。
  ±3mmクランプを超える大きな持ち直しはPhase 1-B対象外（将来のInstrument/Forceps Interaction
  Phaseで扱う）
- shaft roll角度はSafety Engine・`computeScore()`・Ground Truth出力のいずれにも渡さない
  （§3 #1）
- shaft roll stateはCase切替でリセットする（§3 #2）
- 選択状態の視覚フィードバック（outline等）は実装しない（§3 #3）
- 旧TransformControls経路はfeature flag（既定ON=新UX）で切替可能にする（§3 #4）
- `any`禁止（新規追加コードに限る、既存コードへの遡及修正は不要）
- TypeScript strict維持

---

## 7. 設計詳細（Stepごと、Strangler方式）

### Step 1: Hit-target（Prosthesisの直接クリック検出）

- `ProsthesisModel`（`ProsthesisModels.tsx`）の outer `<group>`（L1778-1786）に、`onPointerDown`
  を受け取れるオプショナルprop（例: `onGrabStart?: (e) => void`）を追加する。r3fの既存precedent
  （`RealMalleus`等の`onDoubleClick`、可視meshへ直接イベントを付与する方式）に倣い、まずは
  既存の可視meshで十分なクリック精度が出るかを確認する。shaft径が細くクリックしづらい場合のみ、
  透明・やや大きめのhit-cylinder（`visible`ではなく`opacity:0`のtransparent materialでraycast
  可能な状態を維持すること）を追加する。
- 新規propは全てオプショナルにし、未指定時（既存呼び出し元）は完全に無変更で動作すること。

### Step 2: 直接ドラッグ（Transport相当をProsthesis直接クリックへ統合）

- `ManipulationLayer.tsx`の`TransportPose`/`commitTransportPoseToOffsets()`はそのまま再利用する。
- Phase1の「① 器具を選択 → ② 把持する」の2ボタンを廃止し、Prosthesisクリック（`onPointerDown`）
  で直接「把持」状態に入る（`isGrasped`相当を1アクションに統合）。
- ドラッグの実装は新規: `onPointerMove`でスクリーン座標の移動量を、カメラ（Perspective確認済み）
  からのレイと「現在位置を通りカメラ方向を向く平面」の交点差分としてワールド座標系のdeltaへ変換
  する方式を推奨する（drei/three.jsの`Raycaster`+`Plane.intersectLine`相当）。既存の
  `TransportProsthesis`（`ManipulationLayer.tsx:111-151`）のTransformControlsベースの実装とは
  別の入力機構になるため、新規コンポーネントまたは既存コンポーネントの拡張として実装してよいが、
  最終的にstateへ書き込む値の意味（`TransportPose.position`）は変えないこと。
- ドラッグ終了（pointerUp）時に、既存の`commitTransportPoseToOffsets()`と同じ変換ロジックで
  `dragOffsetX/Y/Z`へ反映する。

### Step 3: Placement済みの再ドラッグ拡張

- `manipulation.committed === true`（既にPlacement済み）の状態でもProsthesisをクリック→ドラッグ
  できるようにする。
- Transport段階と異なり、ここでは`TransportPose`という別stateを経由せず、ドラッグ中の累積量を
  直接`useSimStore.getState().updatePlacement({ dragOffsetX: clamp3(...), ... })`へ反映する
  （`DraggableProsthesis.handleMouseUp`、`SimScene.tsx:557-570`と同じ意味論・同じ±3mmクランプ、
  ただし入力機構はTransformControlsギズモではなくStep2と同じスクリーン空間ドラッグにする）。
- ドラッグ終了時に`markPositionTouched()`を呼ぶこと（既存の採点起動条件を壊さないため）。

### Step 4: ControlPad拡張（shaft roll ↺/↻ボタン）

- `ControlPad.tsx`の「回転」セクション（L115-122）に、既存の前傾/後傾/左傾/右傾4ボタンと並べて
  shaft roll用の↺/↻ 2ボタンを追加する。
- 内部では新設のstore action（Step5参照）を呼ぶのみ。既存の`rotateStepDeg()`/
  `ROTATION_STEP_DEG`等の定数をそのまま再利用する。

### Step 5: Shaft Roll State実装（Store）

`src/store/useSimStore.ts`に、`PlacementState`の外側（`interactionFlags`と同じ「並置」パターン）
で以下を追加する:

```ts
// SimStore interface へ追加
interactionShaftRollDeg: number;
rotateShaftRoll: (deltaDeg: number) => void;
```

- 初期値0、既存`clampAngleDeg`（±180）を再利用してクランプする。
- `setSelectedCase`（L174-182）と`resetSimulation`（L435-446）の両方で`interactionShaftRollDeg: 0`
  にリセットする（§3 #2）。
- `computeScore()`・`computeSafety()`はこの値を一切参照しないこと（§3 #1）。
- 描画側（`ProsthesisModel`または`DraggableProsthesis`）で、`pose.quaternion`に対しlocal +Y軸
  まわりのquaternionをpost-multiplyする形でのみ反映する（§4のEvidence参照）。
  ```ts
  const rollQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rollRad);
  const finalQuaternion = pose.quaternion.clone().multiply(rollQuat);
  ```
  `computeProsthesisModelPose`等のFrozen関数は無変更のまま、呼び出し側でのみ合成すること。

### Step 6: Feature Flag導入 + 旧UI（Select/Grasp/Release）の置換

- `transformControlsConfig.ts`または新設定数ファイルに、`App.tsx`の`FEATURE_DRILL_ENABLED`と
  同じパターンで以下を追加する:
  ```ts
  // 再有効化する場合は DIRECT_MANIPULATION_UX を false に変更する。
  export const DIRECT_MANIPULATION_UX = true;
  ```
- `SimulationMode.tsx`の`instrumentSelected`/`isGrasped`/`manipulationCommitted`のUI（L1005-1290
  周辺のSelect/Grasp/Releaseボタン、L1256以降）を、flag ONの場合は非表示にし、代わりに
  Step1〜3の直接クリック→ドラッグ→（任意で）再ドラッグのUXへ差し替える。
- flag OFFの場合は`a2247d5`時点の挙動（Select/Grasp/Releaseボタン + 既存
  `dragMode`トグル + `DraggableProsthesis`のTransformControlsギズモ）を完全に維持する。
- 既存の`dragMode`トグルボタン・`DraggableProsthesis`のギズモコード自体は削除しない
  （flag OFF経路として温存する）。

---

## 8. テスト内容

1. `npx tsc -b`（または個別ファイル指定の`tsc --noEmit`。過去複数回timeoutが既知のため、
   timeoutした場合はリトライ、または変更ファイル単位の`tsc --noEmit`で代替する）
2. `npm run build`（vite build。過去sandbox制約でtimeoutすることがあるため、timeoutした場合は
   その旨をEvidence不足として明示し、ローカル環境での再実行をshojiへ依頼する）
3. `npx eslint <変更ファイルのみ>`（個別ファイル指定なら実行可、プロジェクト全体は避ける）
4. Pose数式（`solvePose.ts`/`computeCurrentAxisAlignmentOrientation`等）は無変更のため、既存の
   Pose回帰テスト・スクリプトがあれば実行し「差分0」を確認する（数式に触れていないため差分が
   出ないことの確認のみでよい）
5. 実機/ブラウザGUI確認チェックリスト（shoji実施、Claude Codeは手順を用意する）:
   - Prosthesisをクリックしただけで（器具選択ボタンなしで）掴める
   - ドラッグでPlacement前の自由移動ができる
   - 解放（release）でPlacement Systemへ正しくコミットされる（既存の採点・Safety表示が動く）
   - Placement済みの状態から再度クリック→ドラッグでき、Transport状態へ戻らない
   - ControlPadの位置・回転ボタンが従来通り動作し、新設のshaft roll ↺/↻ボタンも動作する
   - shaft rollを操作してもSafety Score/Placement Scoreが変化しない（同一placementでroll角度
     だけ変えた場合、両スコアが完全に一致することを確認する）
   - Case切替後、shaft rollが0°にリセットされている
   - `DIRECT_MANIPULATION_UX = false`に切り替えると、`a2247d5`相当の旧UI（Select/Grasp/Release
     ボタン + dragMode切替 + ギズモ）に完全復帰する

---

## 9. 完了条件（Definition of Done）

- 上記テスト1〜3がPASS（timeoutが既知の問題であるものは、その旨を明示した上でCommit可）
- §8の実機GUI確認チェックリストをshojiが実施しPASSする（Claude Code側の「実装完了」報告だけでは
  完了扱いにしない、[[User Visual Judgment Priority]]原則）
- `git diff`で以下に差分がないことを確認する: `PlacementState`の型定義、`solvePose.ts`、
  `computeProsthesisModelPose`/`computeCurrentAxisAlignmentPose`/
  `computeCurrentAxisAlignmentOrientation`のシグネチャ・数式本体、Safety Engine
  （`src/engine/safety/**`）、`exportGroundTruth.ts`
- roll角度を変えてもSafety Score/Placement Scoreが不変であることをコード上でも保証する
  （`computeScore`/`computeSafety`の入力に`interactionShaftRollDeg`が含まれていないことを
  grep等で確認する）

---

## 10. コミット単位（Strangler、Step単位で分割）

1. `feat(interaction): Phase1-B Step1 — Prosthesis直接クリック検出（hit-target）`
2. `feat(interaction): Phase1-B Step2 — スクリーン空間ドラッグによるTransport統合`
3. `feat(interaction): Phase1-B Step3 — Placement済みプロステーシスの再ドラッグ対応`
4. `feat(ui): Phase1-B Step4 — ControlPadにshaft roll(↺/↻)ボタン追加`
5. `feat(store): Phase1-B Step5 — interactionShaftRollDeg state追加（Safety/Score非反映、Case
   切替でリセット）`
6. `feat(interaction): Phase1-B Step6 — DIRECT_MANIPULATION_UX feature flag導入、旧
   Select/Grasp/Releaseボタンをflag OFF経路へ）`

各コミットは独立してビルド可能な状態を保つこと（Strangler Pattern、一括コミット禁止）。

---

## 11. Claude Codeへの申し送り事項

- 本書§3・§6の制約条件から逸脱する必要が生じた場合は、実装を進めず設計差し戻しとしてTechnical
  Architectへ報告すること（独断で範囲を広げない）
- 各Stepごとに小さくcommitし、まとめて1コミットにしない
- 「commit/push完了」は次回セッション冒頭で`git status`/`git log`により必ず実地確認してから
  報告する（過去に記録と実態が食い違った事例あり）
- 実装完了の報告は「TypeCheck/Build PASS」までであり、「Phase 1-B完成」とは称さない
  （実機GUI確認＝shojiの目視判断が別ゲートとして必須）
