# P4B-3: Pose Solver Integration 凍結 v1.0

**Status**: Completed
**Date**: 2026-07-29
**対象コミット(主要)**:
- `c06d7eb`
- `2d77041`
- `01d5bc2`
- `ffaa64a`
- `f4747b1`
- `322affb`

(main / origin/main 同期済み、Vercel Deploy Success)

## 1. Phase概要

**目的**: `solvePose()`→`composeTwist()`→`composeTilt()`の新Pose Solverを、`ProsthesisModel`/
`CartilageSlice`の本番描画へStrangler Patternで安全に統合する基盤を作る。Feature Flagにより
既定OFF(既存挙動に一切影響しない)を維持しつつ、Flag ON時の切替が検証可能な状態を作ることが
スコープ(`docs/P4B-3_Acceptance_Criteria_v1.0.md`)。

**前提**(変更不可、上位文書):

- `docs/PoseModelBaseline.md` §4: `ProsthesisModel`/`CartilageSlice`は同一姿勢生成方式を
  独立実装しており、Pose Solver移行は両者を同時に行う(片方だけ先行させない)。
- P4B-3の対象は`solvePose()`→`composeTwist()`→`composeTilt()`の3層まで。`composeNormal()`
  (Head Plate Normal)はP4C(Z軸Evidence取得)の範囲であり、P4B-3では未実装。

## 2. 完了項目

### Step1-2: ProsthesisModel/CartilageSlice共有化(`c06d7eb`)

両コンポーネントのPose回転計算を`computeProsthesisModelPose()`を単一の入口とした共有関数へ
統合。独立実装の重複を解消。Step3(GUI Regression)により、本番描画・Cartilage相対位置・
Debug Overlay・ControlPad操作に回帰がないことを確認した。

### Step4: Shadow Integration(`2d77041`)

比較基盤を導入し、用語をReference/Candidate/Anchor Poseへ整理(`SimScene.tsx`/
`PoseComparisonOverlay.tsx`)。

| 名称 | 意味 |
|---|---|
| Reference Pose | `ProsthesisModel`本体が実際に描画へ使う最終出力(`computeProsthesisModelPose()`、本番実出力そのもの) |
| Candidate Pose | 新Pose Solver(`solveBellPose()`)の出力 |
| Anchor Pose | `?debug=coords`のHUDボタンでユーザーが任意タイミングに手動キャプチャする一時スナップショット(ページリロードで消える、真のGround Truthではない) |

Shadow比較の基準は本番実出力(Reference Pose)そのものであり、Debug Overlay側の再現実装ではない
(Acceptance Criteria #3)。

### P4B-4: composeTilt()追加(`01d5bc2`)

Step5着手前の監査で、`solvePose()`→`composeTwist()`の2層にはUI操作`angleTilt`/`angleTiltZ`を
NEW Poseへ反映する経路が存在しないことが判明(Flag ON時、tilt操作に3Dモデルが視覚的に無反応な
一方でフィードバック文言はtilt値を語るという教育アプリとして危険な不整合)。

旧`computeCurrentAxisAlignmentOrientation`のEuler角加算を代数的に整理し、以下の閉形式(近似で
はなく厳密な等価変形)を導出・実装:

```
quatFinal = Rx_world(angleTilt) · quat0 · Rz_local(angleTiltZ)
```

Node検証(実測定数×96通りのオフセット×tilt角)で旧実装との最大誤差2.4e-6°(浮動小数点誤差
レベル)を確認済み。`composeTilt()`は`twisted.quaternion`を土台にtiltを合成するのみで、forward
自体やtwist解決ロジックには関与しない(責務境界を明文化、`solvePose.ts`)。

責務境界:

```
solvePose()      → Forward決定
composeTwist()   → Twist決定
composeTilt()    → angleTilt / angleTiltZのみ合成
composeNormal()  → P4C以降
```

### Step5: Feature Flag導入(`ffaa64a`)

`?debug=coords`限定HUDチェックボックス(既定OFF)で`ProsthesisModel`/`CartilageSlice`を同時に
OLD/NEWへ切替。単一の`poseFlagActive`真偽値から両コンポーネントがpropを受け取ることで中間状態
(片方だけNEW)への到達を構造的に防止。対応`footType`は`solveBellPose`が扱うBELL(PORP)限定
(FLAT/CLIP/PISTON用Adapterは未実装のため、それ以外は常にOLD)。

既知の技術的負債: Pose生成が`ProsthesisModel`(`computeProsthesisModelPose`)側と
`CartilageSlice`用Candidate Pose(`SimScene.tsx`内で個別組み立て)の1箇所に完全集約されていない。
将来`composeNormal()`導入時(P4C以降)に共通化を検討する候補として残す(将来Issue化予定)。

### Safety Regression検証(`f4747b1`)

`scripts/p4b3-safety-regression.ts`を追加。既存の`checkProximityToDanger`/`computeSafetyScore`
(`src/engine/safety/`)をそのままimportし、独自の危険判定ロジックは再実装していない。

## 3. Acceptance Criteria v1.0 充足状況

`docs/P4B-3_Acceptance_Criteria_v1.0.md`の8項目すべてを満たしていることを確認した。

| # | 内容 | 状態 | 根拠 |
|---|---|---|---|
| 1 | Prosthesis/Cartilage同一Poseモデル | 満 | `c06d7eb`、コードレビュー(共有関数呼び出し確認) |
| 2 | Feature Flag同時切替 | 満 | `ffaa64a`、GUI確認(shojiさん承認済み) |
| 3 | Shadow比較は本番実出力基準 | 満 | `2d77041`、Reference Pose=本番実出力 |
| 4 | Debug OverlayでOLD/NEW差分確認可能 | 満 | Pose Comparison Overlay(GUI確認済み) |
| 5 | 15症例でSafety Engineに回帰がないこと | 満 | 本文書§4参照 |
| 6 | P4A Evidenceを変更しないこと | 満 | `f4747b1`/`322affb`はdocs/配下のP4A系文書に無変更 |
| 7 | composeNormal()未実装でも従来仕様と整合 | 満 | P4B-0 Root Cause Analysisとの整合確認済み(`docs/Pose_Design_Constraints_v1.0.md`) |
| 8 | 将来のcomposeNormal()追加が両コンポーネント個別修正不要 | 満 | Pose生成経路が共通化されている(コードレビュー) |

## 4. Safety Regression Evidence(Acceptance Criteria #5)

監査により、Safety Engineの入力`dangerZonePoint`(`SimScene.tsx:654-661`)は`basePos +
lateralOffset/verticalOffset/anteriorOffset + dragOffset`のみで構成され、`angleTilt`/
`angleTiltZ`/Pose Solver出力(quaternion)/Feature Flag状態のいずれにも依存しないことが
判明した(唯一の呼び出し元`SimScene.tsx:664`のuseMemo依存配列に該当項目が含まれない)。

`scripts/p4b3-safety-regression.ts`により、15症例×13配置シナリオ(理想値・offset極値・
tilt極値±180°・Flag ON/OFF・tilt±999°の摂動)＝195件を実行し、Claude Cowork側で独立に
再実行して結果を確認した。

```
比較件数: 195
差分件数: 0
```

本検証は「実測結果(195件・差分0件)」と「入力依存関係のコード監査(dangerZonePointの
useMemo依存配列にtilt/Flag関連値が含まれないことの確認)」の両方で確認しており、
偶然の一致ではなく構造的な独立性であることを担保している。

結論: P4B-3のPose Solver差し替えはSafety Engineの入力経路に一切触れておらず、Feature Flag
起因のSafety回帰リスクはゼロ。Build(tsc --noEmit エラー0件)・Lint(新規ファイル警告0件)も
確認済み。既存tracked fileへの変更はゼロ(新規ファイル追加のみ、`git show --stat`で確認)。

## 5. Known Limitations(Issue-025、次Phase検討事項)

`docs/Issue-025_SafetyEngine_HeadPlate_DangerZone_Evaluation_Gap.md`参照。

Safety Engineは現状STAPES接触点(アンカー)1点のみを評価対象とし、tiltで動くヘッドプレート側
(鼓膜穿孔・キヌタ骨窩・顔面神経等への近接)は評価範囲に含まれない。仕様上の制約であり不具合
ではない(Pose Solver移行以前から存在する既存仕様)。P4Bのブロッカーではなく、評価範囲拡張は
`composeNormal()`実装(ヘッドプレート側の位置確定が前提)を待ってP4C以降で検討する。優先度: 中。

## 6. P4Cへの引継ぎ

**開始条件**: Head Plate Normal(Z軸)のEvidence A/A+取得(`docs/Head_Plate_Local_Coordinate_v1.0.md`
のZ軸節、`docs/PORP_Geometry_Validation_Photo_Analysis_v1.1.md`のEvidence B所見を出発点とする)。

**実装対象**: `composeNormal()`(`solvePose.ts`に未実装のスタブとして既存、恒等関数)。

**制約**: P4B-3で確定したPose Pipeline(3層API・Reference/Candidate/Anchor用語・Feature Flag
方式)を維持すること。`composeTilt()`同様、既存層の責務・数式を変更せず新規層として追加する
こと。

## 7. 参照文書

- `docs/P4B-3_Acceptance_Criteria_v1.0.md`
- `docs/PoseModelBaseline.md`
- `docs/Pose_Design_Constraints_v1.0.md`
- `docs/Head_Plate_Local_Coordinate_v1.0.md`
- `docs/Issue-025_SafetyEngine_HeadPlate_DangerZone_Evaluation_Gap.md`
- `scripts/p4b3-safety-regression.ts`
- `src/engine/poseSolver/solvePose.ts`

## 8. Final Status

```
P4B-3
Status: Completed
Blocking Issue:
None
Open Issues:
Issue-025
Next Phase:
P4C
Head Plate Normal Evidence A/A+
composeNormal()
```
