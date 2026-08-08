# Soft Clip Band Loop — Geometry Implementation v1.0

**Status**: Hypothesis Geometry実装完了(Geometry Freezeではない)。dev preview限定
(`?debug=coords` かつ `headType==='SOFT_CLIP'`時のみ表示、既存の臨床シーン描画には
一切影響しない)。
**Date**: 2026-08-08
**対象タスク**: 「Soft Clip Band Loop — Current Evidence-Based Geometry Implementation
Task」(shoji指定、2026-08-08)
**実装ファイル**: `src/scenes/models/ProsthesisModels.tsx`(新規関数群・
`SoftClipBandLoopPreview`)、`src/scenes/SimScene.tsx`(dev preview配線のみ)

---

## 1. Executive Summary

Proposal v3(`docs/Soft_Clip_Centerline_Proposal_v3.json`)の23制御点を用い、
Hook→Bridge→LowerArm→Pocket→RearFlex→UpperArmの一筆書きChainをCenterline Sweepで
3D Geometry化した。Band断面(幅0.25mm×厚さ0.10mm、Evidence A+)をRing-loft方式
(Pocket Phase1 Commit3bと同じFrenetフレーム非使用方式を一般化)で掃引し、
TypeScript compile・Production Buildともに成功、NaN/Infinity・退化フレームは0件を
Node検証で確認した。

実装前に依頼のあったUpperArm 4点のジグザグ(Proposal v3 Reviewで指摘、旋回符号が
毎点反転)は、実物写真(`azimuth045_upperarm_end_zoom.png`)照合の結果トレースノイズと
判断し、3点移動平均で平滑化した(端点は無変更、詳細は§3)。

一方、実装後の厳密な自己交差検証で、**LowerArm開始点付近とRearFlex折り返し
(pocket/deepest手前)の間でRibbon境界に2箇所の自己交差**を新規に検出した(§5)。
これはPocket開口部近傍のHypothesis形状に起因するもので、タスク指示により今回は
意図的に修正していない(RearFlexの再設計は今回のScope外)。

寸法Audit(§6)では、Terminal Length・Pocket Depthは既知どおり大幅未達(Proposal v3
Reviewから変化なし、UpperArm平滑化はこの2値に影響しない)。Arm Gap・Pocket Maximum
Widthは、本実装が**全区間定数幅0.25mmのSweep**であるため、そもそも表現対象外
(Pocket Phase1の可変幅Sweepとは別実装、今回は未統合)であり、NOT YET MEASURABLEと
分類した。

---

## 2. 採用したTopology・Centerline構造

Proposal v3の`chainOrder`昇順をそのまま採用(Editor Design v1.5 §3.2の鎖順序と一致):

```
hook/end → hook/curve/0,1 → hook/start → pocket/entrance →
bridge/approach/0 → bridge/end → bridge/departure/0 →
lowerArm/start → rearFlex/curve/0-3 → pocket/deepest → rearFlex/curve/4-7 →
upperArm/curve/0-3 → upperArm/end
```

pocket/entranceがHook/Bridgeの点列間に、pocket/deepestがRearFlexの点列途中に
割り込む配置(Proposal v3 Reviewで確認済みのchainOrder割り込み)をそのまま尊重した
(実装タスク指示§6)。Curve方式はEditor Design v1.5 §3.1・Proposal v3 JSONの
`curveType`と同じ`THREE.CatmullRomCurve3`、`closed: false`(Hook側・UpperArm側の
両端は自由端であり閉じたループではない)。

全23制御点はEditorローカル座標系で`z = 1.9`固定(平面Curve)。この性質を利用し、
Sweepの断面フレームは固定の平面法線(N軸、厚み方向)+ 各tでの接線とN軸の外積
(W軸、幅方向)という明示的フレームとした。Frenetフレーム(TubeGeometry/extrudePath
自動追従)は使用していない — SoftClipWing/Bridgeで過去発生した急カーブでの破綻
(2026-07-02)と同種のリスクを構造的に排除するため、Pocket Phase1 Commit3bで確立
済みの手法(固定軸フレーム)を、大きく方向転換するBand Loop全体に一般化した
(固定W/N軸→固定N軸+可変W軸)。既存方式からの逸脱ではなく、Pocketで確立済みの
設計方針の横展開。

---

## 3. UpperArmジグザグ判断(実装前の確認事項)

**判断**: トレースノイズと判断し、平滑化した。

**根拠**:
1. 実物写真(`docs/assets/soft-clip-m1m2m3/azimuth-ring/azimuth045_upperarm_end_zoom.png`)
   でUpperArm区間を確認したところ、Shaft/Hook/Bridge近傍の二重ループ形状から続く
   長い腕は、なめらかな連続曲線(全体としては緩いS字/くの字)として写っており、
   高頻度の波打ち(毎区間での方向反転)に対応する輪郭変化は確認できなかった。
2. Proposal v3の座標を直接解析すると、UpperArm4点の区間でx成分は単調増加する一方、
   y成分の変化が毎区間で符号反転しており(-0.277→+0.089→-0.139→+0.214→-0.315mm)、
   これは滑らかな単一曲線の性質と整合しない(通常、緩いS字なら符号反転は多くて1回)。
   振幅(±0.1〜0.3mm)もUpperArm全体のy方向範囲(約0.43mm)の25〜45%に相当し、
   無視できる誤差の大きさではない。

**手法**: `rearFlex/curve/7`(区間開始側の隣接点)・`upperArm/end`(区間終了側の
隣接点)を固定端とし、`upperArm/curve/0..3`の4点をそれぞれ「自分と前後の点」の
3点移動平均(simple moving average)で再配置した。再現可能な決定論的手法であり、
新しい座標を目視で創作したものではない。

**結果**(Node検証、旋回角度の符号):

| | Before(Proposal v3) | After(Smoothed) |
|---|---|---|
| 旋回角の推移 | +41.3°→−27.4°→+34.7°→−47.5° | +5.3°→+19.1°→−14.1°→−5.1° |
| 符号反転回数 | 3回(毎点反転) | 1回(単一の緩いS字) |

端点(rearFlex/curve/7・upperArm/end)は無変更のため、UpperArm区間の全体的な
位置関係(写真シルエット全体、Priority1)は維持される。他19点(Hook/Bridge/
LowerArm/Pocket/RearFlex)はProposal v3から無変更。

---

## 4. Geometry生成方法

**方式**: Centerline Sweep(タスク指示§7で指定された方式のまま、既存Soft Clip
Geometry設計方針から逸脱なし)。

**断面**: 幅0.25mm×厚さ0.10mm固定の矩形(Ring 4頂点)、全区間で一定
(Pocket Maximum Width/Arm Gapによる幅プロファイル変化は本Sweepには未適用、
§6参照)。

**Mesh生成API**: 手動Ring-loft(non-indexed BufferGeometry、`computeVertexNormals()`
で法線計算)。ExtrudeGeometry+extrudePathではなくPocket Commit3bと同じ手法を採用した
理由: Band Loopは360°近い方向転換(Hook区間・RearFlex折り返し)を含み、
ExtrudeGeometryのextrudePathは内部でFrenetフレームに追従するため、急カーブでの
反転・破綻リスクがある(2026-07-02の既知問題)。Pocketは直線2点のみだったため
このリスクが低かったが、Band Loop全体では無視できないため、確立済みの代替手法
(固定軸フレームによるRing-loft)を適用した。

**分割数**: 400 steps(Pocketの32に対し高めに設定。全長7.6mm・急カーブ複数を
考慮した視覚解像度のための値であり、Geometry Parameterではない)。

**両端の扱い**: `hook/end`・`upperArm/end`はTopology上は自由端(Bridge-side Endの
再評価はPending、Interpretation §4-5-A)だが、Geometryとしては閉じた形状として
端面キャップを付けた(Pocket Commit3bと同じ扱い、§6 Tangent Rule準拠)。

---

## 5. 実装後の検証(タスク指示§10準拠)

| 項目 | 結果 |
|---|---|
| TypeScript compile | **PASS**(`tsc --noEmit -p .`、エラー0件) |
| Production Build | **PASS**(`vite build`、792 modules transformed、38.81s、既存の
  chunk-size警告[1500kB超]のみ・本変更由来ではない) |
| Lint | **未完了(環境制約)**。`eslint`/`tsc -b`とも本sandbox環境でI/O待ちにより
  45秒のコマンド上限内に完了せず(OneDrive同期フォルダ上のnode_modules走査による
  既知の遅延、[[project_kurz]]既存メモの制約と同種)。新規コードはPocket
  Phase1(`SoftClipPocketPreview`/`getSoftClipPocketVariableWidthSweepGeometry`、
  既存lint合格済み)と同一パターン(any不使用、hooks依存配列の書き方、`const`使用等)
  を踏襲しており目視レビューでは違反なし。**shoji側での`npm run lint`実行を推奨**。 |
| Geometry生成 | **成功**(23制御点・400 rings・1600 side triangles + 4 cap triangles) |
| NaN / Infinity | **0件**(Node検証、全401リングの全頂点) |
| 退化フレーム(接線とN軸が平行) | **0件**(平面Curveのため理論通り) |
| Self-intersection | **2箇所で検出**(§下記詳細)。厳密な2Dリボン境界交差判定
  (非隣接区間、隣接20 ring-step以内は除外)で確認。 |
| Band断面 | 破綻なし(全リング4頂点、`lengthSq`退化フォールバックの発火0件) |

**Self-intersection詳細**: Ribbon境界の-W側(内側エッジ)で2箇所交差
(センターラインのt≈0.245-0.29付近[`lowerArm/start`近傍]とt≈0.44-0.49付近
[`rearFlex/curve/3`近傍、pocket/deepestへの折り返し直前]の間)。該当区間の
中心線同士の最短距離は約0.12mmで、Band幅0.25mm(半幅0.125mm×2)より小さいため、
実際のMeshでも重なりが生じている。原因はPocket開口部近傍でLowerArmの起点と
RearFlex折り返しのHypothesis座標が近接しすぎていること。タスク指示§13
「RearFlexの再設計を目的とした変更は行わない」に基づき、今回は意図的に未修正
(次パスでの検討対象、§7参照)。

**Visual確認(3D Viewer)**: 実装はコード上の検証のみで完了しており、
shoji側での実機5方向確認(正面相当/反対側/Oblique/上面/側面、タスク指示§10)は
未実施。`?debug=coords`付きURLでheadType SOFT_CLIPの症例を開くと、
`SoftClipBandLoopPreview`が`SoftClipPocketPreview`と左右反対側のオフセット位置
(`basePos.x - 10`)に表示される。

---

## 6. 寸法Audit(タスク指示§12準拠)

| Item | Evidence | Current Geometry | 判定 |
|---|---:|---:|---|
| Band Width | 0.25mm(A+) | 0.25mm(Geometry Parameterとして直接使用) | **PASS** |
| Band Thickness | 0.10mm(A+) | 0.10mm(同上) | **PASS** |
| Terminal Length(`hook/end`–`hook/start`) | 約2.40mm(A) | chord 0.73mm(Proposal v3から
  無変更、UpperArm平滑化はHook区間に影響しない) | **DEVIATION**(Proposal v3 Review
  から既知、今回未対応・写真シルエット優先) |
| Pocket Depth(`pocket/entrance`–`pocket/deepest`) | 3.30mm(A+) | chord 0.93mm(同上、
  無変更) | **DEVIATION**(v1から継続する既知の低優先度課題) |
| Arm Gap(Pocket入口幅) | 0.75mm(A+) | — | **NOT YET MEASURABLE**: 本Sweepは全区間
  定数幅0.25mmであり、Pocket入口の開口幅という概念そのものを表現していない
  (Pocket Phase1の可変幅Sweep`getSoftClipPocketVariableWidthSweepGeometry`とは
  別実装、今回は未統合)。 |
| Pocket Maximum Width | 1.40mm(A+) | — | **NOT YET MEASURABLE**: 同上の理由により
  本Sweepでは非表現。 |

数値を合わせるために写真シルエット(Priority1)やUpperArm平滑化の判断根拠(§3)を
崩す変更は行っていない(タスク指示§12「数値を合わせるために写真シルエットを
破壊しない」に準拠)。

---

## 7. Evidence / Hypothesis Audit(トレーサビリティ)

```
Evidence(A+): Band Width 0.25mm・Band Thickness 0.10mm
  → そのままGeometry Parameterとして使用(§4、変更なし)

Evidence(A/A+): Terminal Length 2.40mm・Pocket Depth 3.30mm・Arm Gap 0.75mm・
Pocket Max Width 1.40mm
  → Photo Observation(shoji写真トレース、Proposal v3)
  → Hypothesis(Control Point座標、写真シルエット優先で数値未達のまま採用)
  → Implementation(§6でDEVIATION/NOT YET MEASURABLEとして明示、Evidence自体は不変)

Photo Observation(azimuth045_upperarm_end_zoom.png、UpperArm区間の輪郭)
  → Hypothesis(Proposal v3のUpperArm4点にはジグザグあり)
  → Revision判断(§3、トレースノイズと判定・3点移動平均で平滑化)
  → Implementation(平滑化後の座標をControl Pointとして採用)

Hypothesis(chainOrder順序、Topology全体)
  → そのままImplementation(§2、変更なし、taskの指示どおり尊重)
```

---

## 8. 写真との一致点・不一致点

**一致点**:
- Hook〜Bridge近傍の二重ループ構造(chainOrder 0〜6)は、写真
  (`right_annotated.png`、`right_oblique_terminal_zoom.png`)で確認できる
  Shaft直後の折り返し形状と定性的に整合する位置関係を維持している(Proposal v3
  トレース由来、無変更)。
- UpperArm平滑化後は、写真で見える単一の緩やかな曲線という印象に近づいた(§3)。

**不一致点**:
- Terminal Length・Pocket Depthのchord距離がEvidence値を大幅に下回る(§6、
  写真シルエット優先の既知の意図的な乖離)。
- Pocket入口の開口(Funnel状、Evidence A+由来のInterpretation)が本Sweepでは
  定数幅のため表現されていない(§6)。
- LowerArm起点近傍とRearFlex折り返し近傍の自己交差(§5)は、実物のPocket
  開口部の実際の間隔(Arm Gap 0.75mm)よりも本Hypothesis座標が近すぎることを
  示唆している可能性がある(確定的な結論ではなく、次の実測・座標調整で解消
  すべき候補として記録)。

---

## 9. 残課題・次パスへの引き継ぎ

1. **Self-intersection(§5)**: LowerArm/RearFlex近傍の2箇所。Arm Gap
   (0.75mm、Evidence A+)を実際に反映する形でPocket開口部の制御点間隔を
   見直すことで解消する可能性が高いが、これはPocket/RearFlex座標の変更を
   伴うため、今回のScope外(タスク指示§13)として次パスでの判断事項とする。
2. **Terminal Length / Pocket Depth未達(§6)**: 既知・低優先度(shoji確認済み、
   写真シルエット優先の意図的判断)。対応する場合はHook/Pocket制御点の
   再調整が必要。
3. **Arm Gap / Pocket Maximum Width未表現(§6)**: 本Band Loop Sweepに
   Pocket Phase1の可変幅プロファイル(`getSoftClipPocketWidthAt`)を統合するか
   どうかは未決定。統合する場合、Pocket区間(`pocket/entrance`〜
   `pocket/deepest`間)のみ幅を0.25mm→広げるteper処理が必要になり、
   Geometry方式の部分的拡張(Small Change判断が必要)。
4. **Coordinate Integration(Tier C課題)**: 今回もPocket Phase1と同じく
   意図的に未着手。Band Loop Editorローカル座標系のままdev previewとして
   実装し、Shaft/Global座標系への統合は行っていない。
5. **Visual確認(3D Viewer、5方向)**: shoji側での実機確認が未実施(§5)。
   `?debug=coords`付きURLでの目視確認を推奨。

---

## 10. 実装しなかったこと(タスク指示§13準拠、確認)

Evidence変更・Measurement Definitionの確定・新規実測値の捏造・Geometry Freeze・
製品寸法の完全再現主張・Coordinate System再設計・Editorへの機能追加・
不要なControl Point最適化(UpperArm4点の平滑化はジグザグ判断の結果であり
「最適化」目的ではない)・RearFlexの再設計、いずれも行っていない。
