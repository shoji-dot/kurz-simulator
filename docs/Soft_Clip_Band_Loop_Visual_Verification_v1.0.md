# Soft Clip Band Loop — Visual Verification v1.0

**Status**: Visual Verification完了。Geometry未修正(タスク指示§11準拠、修正は次パス)。
**Date**: 2026-08-08
**対象**: `docs/Soft_Clip_Band_Loop_Geometry_Implementation_v1.0.md`で実装したBand Loop
Hypothesis Geometry(commit `a23ab63`)

---

## 0. 実施方法に関する重要な制約(先に明示)

本sandbox環境からは、実行中のReact Three Fiberアプリ(`?debug=coords`付きURL)を
ブラウザで直接開いて目視確認することができない(ブラウザ自動化ツールはユーザーの
デスクトップ側Chromeに接続されており、このsandbox内でのみ動くdev serverには到達
できない)。

そのため、**コミット済みソースコード(`ProsthesisModels.tsx`)の`SOFT_CLIP_BAND_
LOOP_CONTROL_POINTS`・Ring-loft算出ロジックを一字一句そのまま複製したNodeスクリプト
で実際の三角形メッシュ(3204三角形)を再生成し、それをmatplotlibで5方向レンダリング
する**という代替手段で検証した(アプリ側のコードは一切変更していない、複製元との
一致はソース行を直接diff確認済み)。実際のReact Three Fiberレンダラー[WebGL/
物理ベースライティング]とは異なる[matplotlibの簡易フラットシェーディング]ため、
色味・質感は参考程度。**shoji側での実機`?debug=coords`確認を別途推奨する**
(本文書はその代替であり、置き換えではない)。

レンダリング画像: `docs/assets/soft-clip-band-loop-v1-renders/`
(view1_face.png / view2_back.png / view3_oblique.png / view4_pocket_zoom.png /
view5_edge.png)

---

## 1. Overall Verdict

**CONDITIONAL PASS**

今回のタスク目的(「現在のHypothesis Geometryを実物写真と比較可能な状態にする」、
実装タスク指示§15)は達成された。比較の結果、全体シルエット・Hook位置関係・
UpperArm平滑化の効果は妥当と判断できる一方、**LowerArm〜RearFlex間で実物では
起こり得ない「非隣接ストランドの交差」が視覚的にも明確に確認された**(§3)。
これは次パスでの修正対象として明確化されたが、今回のCONDITIONAL PASSの判断を
妨げるものではない(Hypothesis Geometry構築という目的自体は達成、次の修正対象が
明確になったこと自体が本タスクの成果)。

---

## 2. Visual Findings

| Region | Result | Comment |
|---|---|---|
| Hook | **CONDITIONAL** | 位置関係(Bridge近傍)は実物写真(`right_oblique_terminal_zoom.png`)と整合。ただしTerminal Length未達(chord 0.73mm、既知)のため、実物の伸びた開いたJ字フックではなく、タイトな閉じ気味のループとして表示される(View1/View4、hook/end-curve/0-curve/1-hook/startが短い半径で密集)。今回は数値を合わせる修正をしない方針のため現状維持。 |
| Bridge | **AUDIT** | 実物写真(`azimuth045/135`)では2つの独立した貫通ホールが見えるが、現在の実装はBridgeを明示的な閉ループとして表現していない(`bridge/end`はPosition: Unknownの単一T字接合点)。写真の「二重ホール」のどちらがBridgeに対応するかは特定できておらず、次パスの調査候補。 |
| LowerArm | **REVISION CANDIDATE** | `lowerArm/start`(chainOrder 8)が§3の交差に巻き込まれている。 |
| Pocket | **NOT DIRECTLY COMPARABLE** | `pocket/entrance`・`pocket/deepest`のchainOrder配置(Hook/Bridge間・RearFlex途中)は維持されているが、本Sweepは全区間定数幅0.25mmのためFunnel状の開口(実物写真`azimuth045_pocket_zoom_hook_occluded.png`で確認できる小さなV字ノッチ)を再現していない。直接比較は困難。 |
| RearFlex | **CONDITIONAL** | `rearFlex/curve/0-2`・`curve/4-7`はそれぞれタイトな折り返しループを形成しており(View4)、実物写真で見える小さなフック/スクープ状の折り返し形状と定性的な印象は近い。ただし§3の交差により視覚的な破綻が生じている。 |
| UpperArm | **IMPROVED** | 平滑化後(§3の前回実装Reviewで実施)、写真(`azimuth045_upperarm_end_zoom.png`)に見える単一の緩やかな曲線に近づいた。View1/View3で高頻度の波打ちは見られない。 |

---

## 3. Self-intersection(2箇所)の判定

**判定: Level A — 明らかな実物との矛盾。次パスで修正必須。**

### 根拠

**(1) 幾何学的検証(数値)**: `lowerArm/start`近傍(centerline t≈0.25)と
`rearFlex/curve/3`近傍(centerline t≈0.48)の間で、Ribbon境界(-W側)に2箇所の
厳密な交差を検出済み(`Soft_Clip_Band_Loop_Geometry_Implementation_v1.0.md` §5)。
中心線最短距離は約0.12mmで、Band幅0.25mm(半幅0.125mm×2)より小さい。

**(2) 視覚的検証(今回新規)**: View1(正面相当)・View4(Pocket/LowerArm/
RearFlex詳細ズーム)のレンダリングで、この2箇所は「タイトな折り返し(自己近接、
問題なし)」ではなく、**`bridge/departure/0`→`lowerArm/start`側のストランドと
`rearFlex/curve/3`→`pocket/deepest`側のストランドが、明確なX字状に交差して
重なり合っている**ことが確認できた(View4中央、2本のバンドが交差する箇所)。

**(3) 実物写真との矛盾**: 実物(`right_annotated.png`・`azimuth045/135`・
`azimuth045_pocket_zoom_hook_occluded.png`)は**単一の連続した平板状ストリップ**
であり(Interpretation v1.6 §1.3-A「一筆書き」)、chainOrder上遠く離れた
2つの区間(`lowerArm/start`はchainOrder 8、`rearFlex/curve/3`はchainOrder
10.75)が同一平面内で交差することは、平板1枚から成形される実物では物理的に
起こり得ない(Z方向の段差[厚み方向オフセット]を持たない限り、同一平面上の
交差は自己貫通を意味する)。実物写真でもそのような交差箇所は確認できない。

**(4) Arm Gap Evidenceとの関係(§5指示に基づく再確認、結論)**: Arm Gap
(0.75mm、Evidence A+)の定義は`Soft_Clip_Geometry_Interpretation_v1.0.md`
§1.5により「**Upper Arm先端とLower Arm先端の間の距離 = Pocket入口の開口幅**」
であり、現在のchainOrder上は`pocket/entrance`(Hook/Bridge間、chainOrder 3)
に紐づく参照値である。今回検出した交差箇所(`lowerArm/start`〜`rearFlex/
curve/3`間、chainOrder 8〜10.75)は`pocket/entrance`とは離れた別の区間であり、
**Arm Gap Evidenceを直接の判定根拠として使うのは妥当ではない**と判断した
(Topology Revision[v1.3、2026-08-07]により「Upper Armの先端・Lower Armの
先端が1箇所で向き合う」という旧・二腕モデルが単一連続鎖モデルに置き換わって
おり、Arm Gapの物理的対応点が新Topology上でどこに当たるか自体が
Interpretation §4-5-A Pending Re-evaluationと同根の未解決事項であるため)。
したがって本件は「Arm Gap違反」ではなく、**Evidenceとは独立した、単純な
Geometry上の交差(Topology上あってはならない状態)**として記録する。

---

## 4. Evidence Alignment

| Evidence | Current Geometry | Status |
|---|---|---|
| Band Width 0.25mm | 0.25mm | **PASS** |
| Band Thickness 0.10mm | 0.10mm | **PASS**(View5で厚み方向の破綻なし・断面が潰れていないことを確認) |
| Terminal Length 2.40mm | chord 0.73mm | **DEVIATION**(既知、今回未対応。§2 Hookで視覚的影響を記録) |
| Pocket Depth 3.30mm | chord 0.93mm | **DEVIATION**(既知、今回未対応) |
| Arm Gap 0.75mm | 未実装(§3-4で対応関係自体が未解決と判明) | **AUDIT**(NOT YET MEASURABLE from 単純比較。§3-4参照) |
| Pocket Maximum Width 1.40mm | 未実装(定数幅Sweepのため) | **NOT YET MEASURABLE** |

---

## 5. Next Action(3件に限定)

1. **`lowerArm/start`〜`rearFlex/curve/3`間の交差解消**(Level A、次パス最優先)。
   Pocket/RearFlex近傍の該当制御点(座標のみ、Topology・Evidence値は不変)を
   Editor上で再調整し、Proposal v4として作成 → 交差ゼロを再度Node検証で確認、
   という既存サイクル(Proposal→Review→Implementation)を踏襲する。
2. **Bridgeの「二重ホール」対応関係の調査**(§2 Bridge、優先度中)。実物写真の
   2つの貫通ホールのうちどちらがBridge/Hookに対応するかを、既存写真の再確認
   またはshoji確認で特定する。
3. **shoji側での実機確認**: `?debug=coords`付きURLでのライブ3D Viewer確認、
   および`npm run lint`のローカル実行(本sandboxでは`tsc -b`/`eslint`とも
   45秒のコマンド上限内に完了せず、実行不能。§0と同じくOneDrive同期フォルダの
   I/O遅延が原因と推定、コード自体の問題ではない)。

---

## 6. 実施しなかったこと(タスク指示§11準拠、確認)

Visual確認前の自己交差修正・Terminal Length数字合わせ・Pocket Depth数字合わせ・
Evidence書き換え・Topology再変更・Coordinate Integration開始・Geometry Freeze・
新規Measurement Definition確定、いずれも行っていない。
