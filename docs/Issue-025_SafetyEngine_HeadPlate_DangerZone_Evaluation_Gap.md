# Issue-025: Safety EngineのHead Plate側Danger Zone評価ギャップ

P4B-3 Acceptance Criteria #5（`docs/P4B-3_Acceptance_Criteria_v1.0.md`、
「15症例でSafety Engineに回帰がないこと」）の検証（`scripts/p4b3-safety-regression.ts`、
15症例×13配置シナリオ、195件比較・差分0件）を実施した際に判明した、実装済み挙動の
記録。**不具合ではなく仕様上の評価範囲の制約**であり、P4Bのブロッカーではない。

## 内容

Safety Engine（`src/engine/safety/`の`checkProximityToDanger`/`computeSafetyScore`）の
入力`dangerZonePoint`は、`src/scenes/SimScene.tsx:654-661`で以下のように計算される。

```ts
const dangerZonePoint = useMemo<Vec3Tuple>(() => {
  const point: [number, number, number] = [
    basePos.x + lateralOffset  + dragOffsetX,
    basePos.y + verticalOffset + dragOffsetY,
    basePos.z + anteriorOffset + dragOffsetZ,
  ];
  return placementPointToDangerZoneFrame(point);
}, [basePos, lateralOffset, dragOffsetX, verticalOffset, dragOffsetY, anteriorOffset, dragOffsetZ]);
```

`basePos`（`STAPES_HEAD`または`STAPES_FOOTPLATE`）はプロステーシスの**シャフトが
アブミ骨に接触する端**（アンカー側）であり、ヘッドプレート側（鼓膜側、`angleTilt`/
`angleTiltZ`で傾く側）ではない（`SimScene.tsx:649-651`のコメントで既に明記、
Phase20.5.2でshojiさんへの回答として確認済み）。useMemoの依存配列にも
`angleTilt`/`angleTiltZ`/`useNewPoseSolver`/`poseFlagActive`のいずれも含まれない。

つまりSafety EngineはアンカーであるSTAPES接触点1点のみを評価対象とし、
シャフト全体・ヘッドプレート側の危険構造への近接は評価範囲に含まれない。傾斜操作
（`angleTilt`/`angleTiltZ`）でヘッドプレート側が危険構造へ接近しても、現在の
Safety Scoreには反映されない。

## P4B-3への影響（なし）

`scripts/p4b3-safety-regression.ts`での検証により、以下を確認済み。

- `angleTilt`/`angleTiltZ`の値（±180°を含む極端値）を変えても`dangerZonePoint`は
  一切変化しない。
- Feature Flag（`useNewPoseSolver`/`poseFlagActive`、P4B-3で導入したNEW Pose Pipeline
  切替）のON/OFFでもSafety Engineの入出力（`dangerZonePoint`・alerts・Safety Level・
  Score）は完全に一致する（15症例×13シナリオ＝195件、差分0件）。

したがって、P4B-3のスコープであるPose Solver差し替え（`solvePose()`→
`composeTwist()`→`composeTilt()`）はSafety Engineの入力経路に一切触れておらず、
本Issueが指す評価範囲の制約はPose Solver移行前から存在する既存仕様である。
P4B-3 Acceptance Criteria #5は満たされている。

## 今後の検討候補（次Phase以降）

ヘッドプレート側（鼓膜穿孔・キヌタ骨窩・顔面神経等への近接）も含めた評価範囲拡張は、
教育的価値はあるが以下の前提が必要でP4Bの範囲を超える。

- ヘッドプレート側の位置を確定するには`composeNormal()`（Head Plate Normal、Z軸）の
  実装が前提（P4C範囲、`docs/P4B-3_Acceptance_Criteria_v1.0.md`スコープ外節を参照）。
- 評価点をアンカー1点から複数点（シャフト両端・ヘッドプレート中心等）へ拡張する
  Safety Engine自体の設計変更が必要（`engine/safety`のAPI形状に影響）。

優先度: 中。P4Bのブロッカーではなく、P4C（Z軸Evidence取得）以降で評価範囲拡張を
検討する際の課題として記録する。

## 参照

- `docs/P4B-3_Acceptance_Criteria_v1.0.md`（Acceptance Criteria #5）
- `scripts/p4b3-safety-regression.ts`（検証スクリプト）
- `src/scenes/SimScene.tsx:643-665`（`basePos`決定ロジック・`dangerZonePoint`計算式）
- `src/engine/safety/`（`checkProximityToDanger`/`computeSafetyScore`）
