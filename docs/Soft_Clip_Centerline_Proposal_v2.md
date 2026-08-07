# Soft Clip Centerline Proposal v2

**Status**: Draft(Claude作成、shoji確認・Editor上での再調整待ち)
**Date**: 2026-08-07
**入力**: `docs/Soft_Clip_Centerline_Proposal_v1.json` + `Soft_Clip_Centerline_Proposal_v1_Review.md`
**出力**: `docs/Soft_Clip_Centerline_Proposal_v2.json`
**Scope Note**: 本文書もHypothesis(設計案)であり、Evidenceではない。Three.js実装・
ProsthesisModels.tsx反映・Coordinate Integration・Evidence階層変更・JSON Schema変更は
対象外(shoji指定を継承)。`bridge/end`・`pocket/entrance`・`pocket/deepest`は今回も
変更していない(shoji指定の対象外を継続)。

---

## 1. Proposal v2の設計方針

shoji指示のとおり、**Control Point数を減らすこと自体を目的にせず、写真との一致度を
最優先**とした。具体的な優先順位:

1. RearFlexのturn angle符号反転(不要なS字)を解消すること(v1レビュー§3.2の
   最大の問題点)
2. 上記を達成する上で、点数はまず「7→5」に留める(7→3への直行はしない、shoji指定)
3. UpperArmの手薄さを補うため1点追加(座標はHypothesis、Claudeが独自の“正解”を
   主張するものではない)
4. Hook終端をEvidence A(Terminal Length約2.40mm)へ近づける、ただし方向は
   v1のHypothesis方向を維持し新規に発明しない
5. 平面(2D)設計は今回も維持(shoji確認: 「意図的な設計方針、立体化は今回は
   考えない」)

**写真参照**: `docs/assets/soft-clip-m1m2m3/right_annotated.png`・
`left_annotated.png`(Right/Left側面、M1/M2/M3マーカー付き)を確認した。両画像とも、
シャフト付近から**単一の滑らかな大きな弧**がRearFlex方向へ伸び、その先端に**小さな
Hookの巻き込み**が見える、というシルエットで一致している(左右は鏡像)。この
「単一の大きな弧+末端の小さな巻き込み」という見た目は、v1のRearFlexジグザグ
(7点)とは整合しにくく、v2でRearFlexをより滑らかな弧に近づける方向性を支持する
所見だった。**このことがRearFlex修正(§3)の直接の動機**である。

## 2. Proposal v1から変更したControl Point一覧

| 変更種別 | 対象 |
|---|---|
| 変更なし(維持) | `bridge/end`・`lowerArm/start`・`lowerArm/curve/0`・`pocket/entrance`・`pocket/deepest`・`hook/start` |
| 座標変更・点数削減(7→5) | `rearFlex/curve/0`〜`4`(新規5点、旧`curve/1,2,3,5,6`の一部情報を統合・再配置) |
| 新規追加 | `upperArm/curve/1` |
| 座標変更(位置は同じ、参考として維持) | `upperArm/curve/0`(値は不変) |
| 座標変更(距離延長) | `hook/end` |

## 3. RearFlexをそのように修正した理由

v1のRearFlex(7点)は、pocket/deepestから見た進行方向の変化(turn angle)が
`-84°→-96°→+104°→-86°→-98°→+71°`と交互に反転し、経路が細かく折り返す
ジグザグになっていた(v1 Review §3.2)。これは①写真で見える「単一の滑らかな
大きな弧」という見た目(§1)、②Component Tree/Improvement Specの「Rear Flex
Region = SOFTCLIPフックが接触する単一の弯曲部」という機能描像、のいずれとも
整合しなかった。

v2では5点に再配置し、turnを`-61.6°→-69.9°→-25.6°→-53.1°→-7.1°`という
**全て同符号(右折のみ)の滑らかな弧**へ変更した(検証済み、§7参照)。7→3へ
一気に減らさなかったのは、shoji指定通り「まず5点で写真との一致を見てから、
必要に応じて4→3を検討する」という段階的な収束を優先したため。5点の配置は
v1の7点が示していた「左に大きく張り出し、後方(Z方向)へ伸びる」という
おおよその外形(最左端x≈-2.27、最奥z≈1.57)を概ね踏襲しつつ、内部のジグザグ
だけを解消する方針で選んだ(v1の情報を全て無視した新規デザインではない)。

## 4. UpperArm修正理由

v1はUpperArmが`upperArm/curve/0`の1点のみで、曲率として評価できる情報が
ほぼなかった(v1 Review §5)。RearFlex側(v2で5点)との詳細度の差が大きい
ままだと、Pocket〜Hookの遷移がUpperArm区間だけ不自然に単純化される懸念が
あったため、`upperArm/curve/1`を追加した。

配置は、追加後のturn angleが`+12.2°→+17.3°`と小さく滑らかになる位置を
複数候補から選定した(§7の比較表参照)。**座標そのものはHypothesisであり、
Claudeが「これが正しいUpperArmの形」と主張しているわけではない**。あくまで
「曲率が滑らかになる」という幾何学的な観点でのみ選定しており、実物写真との
一致はshojiの確認を仰ぐ(§8)。

## 5. Hook修正理由

`hook/start`→`hook/end`の距離が、v1では0.613mmとEvidence A(Terminal Length
約2.40mm)を大幅に下回っていた(v1 Review §4項目3)。shoji指示に従い、
**方向はv1が既に持っていたHypothesis方向をそのまま維持**し(Claudeが新しい
方向を発明しない)、**距離のみ2.40mmへ延長**した。

**Known Limitation(重要、v3以降で再検討推奨)**: Terminal Length(2.40mm)は
写真上でHook-like terminalの**巻き込み形状に沿った長さ**として観察された値
であり(Improvement Spec §1.5)、`hook/start`→`hook/end`の**直線距離**と
厳密に同じ意味とは限らない。現在のPhase1 Editorは`Hook`に`start`/`end`の
2点しか持たず(曲率を表現する中間点はPhase2スコープ)、実際には巻いている
形状を直線で近似していることになる。今回は指示どおり直線距離を2.40mmへ
近づけたが、**Hook Transition Profile(Phase2で曲率・進入角を扱う機能)が
実装されるまでは、この直線がやや「伸びすぎ」に見える可能性がある**ことを
明記しておく。

## 6. Proposal v2 JSON

`docs/Soft_Clip_Centerline_Proposal_v2.json`として保存済み(全文はファイル参照、
14制御点)。主要な新しい座標のみ抜粋:

```json
{
  "rearFlex/curve/0": { "x": -2.05, "y": 1.004, "z": 0.55 },
  "rearFlex/curve/1": { "x": -2.30, "y": 1.004, "z": 0.95 },
  "rearFlex/curve/2": { "x": -1.95, "y": 1.004, "z": 1.40 },
  "rearFlex/curve/3": { "x": -1.55, "y": 1.004, "z": 1.60 },
  "rearFlex/curve/4": { "x": -0.75, "y": 1.004, "z": 1.20 },
  "upperArm/curve/0": { "x": -0.1455, "y": 1.004, "z": 0.7971 },
  "upperArm/curve/1": { "x": 0.05, "y": 1.004, "z": 0.72 },
  "hook/end": { "x": 1.7129, "y": 1.00402, "z": -1.2714 }
}
```

`Soft_Clip_Geometry_Editor_v1.html`の「読み込み(Import)」からこのJSONファイルを
読み込めば、そのままCenterlineとして表示・再編集できる(Undoで読み込み前の状態へ
戻せる)。

## 7. Proposal v1との比較

### ① Turn Angle比較

| 制御点 | v1 | v2 |
|---|---:|---:|
| lowerArm/start | +59.1° | +59.1°(不変) |
| lowerArm/curve/0 | +63.2° | +63.2°(不変) |
| pocket/entrance | +24.8° | +24.8°(不変) |
| pocket/deepest | +37.4° | +26.6° |
| rearFlex/curve/0 | -83.7° | -61.6° |
| rearFlex/curve/1 | -95.5° | -69.9° |
| rearFlex/curve/2 | +103.9° | -25.6° |
| rearFlex/curve/3 | -86.1° | -53.1° |
| rearFlex/curve/4 | -97.8° | -7.1° |
| rearFlex/curve/5 | +70.9° | (削除) |
| rearFlex/curve/6 | -39.3° | (削除) |
| upperArm/curve/0 | +21.9° | +12.2° |
| upperArm/curve/1 | (新規) | +17.3° |
| hook/start | -43.8° | -51.0° |

**符号反転の回数**(進行方向が左右入れ替わる回数、経路全体):
v1 = RearFlex区間だけで5回(6区間中)。v2 = 経路全体で3回のみ、かつそれぞれが
「Pocket→RearFlex」「RearFlex→UpperArm」「UpperArm→Hook」という**機能領域の
境界**で1回ずつ起きている(領域内部では反転なし)。単一連続鎖の「つ」字形状
としては、領域境界での方向反転はむしろ自然であり、v1のようにRearFlex内部で
何度も反転するのが不自然だった、という当初の診断(v1 Review)を裏付ける結果。

### ② 折れ線長比較

| | v1 | v2 |
|---|---:|---:|
| 合計 | 8.036 mm | 8.953 mm |
| Pocket〜UpperArm区間(RearFlex含む) | 4.773 mm | 3.905 mm(**短縮**) |
| hook/start→hook/end | 0.613 mm | 2.400 mm(**延長**) |

RearFlexのジグザグ解消により当該区間は短縮したが、Hook終端をEvidence Aへ
近づけた分だけ全体としては伸び、結果として合計はEvidence B見立て(6.0〜7.5mm)
から**v1よりもさらに離れた**(v1: 8.0mm→v2: 9.0mm、上振れ約1.5mm→約1.7mm)。
これは「Pocket〜RearFlexの滑らかさ」と「Hook終端のEvidence A整合」という
2つの改善が、全長という1つの指標の上ではトレードオフになっていることを示す
(§9で扱う)。

### ③ RearFlex: S字解消の確認

turn角度の符号を見ると、v1は `- - + - - +` と6区間中4回反転していたのに対し、
v2は `- - - - -` と全て同符号。**S字は解消された**(§7①で算出済み)。

## 8. 写真との一致評価

**重要な限界**: Band Loop Editorのローカル座標系は、写真撮影時の座標系
(Right/Left/Azimuth Ring等)とはCoordinate Integrationが未解決のため**まだ
統合されていない**(Tier C課題、Measurement Record v1.9でも「未着手/部分的
前進」)。したがって**ピクセル単位でCenterlineを写真に重ねる厳密なOverlayは
今回実施できない**。以下は`right_annotated.png`・`left_annotated.png`を
目視した上での**定性的な形状比較**であり、Evidence Bレベルの所見として扱う。

- **一致**: シャフト付近から始まり、単一の大きな弧を描いてから小さなHookの
  巻き込みで終わる、という全体シルエットの「一筆書き」的な流れは、v2の
  Turn Angle推移(Pocket区間で滑らかに曲がり、RearFlexで大きく1方向へ
  曲がり、UpperArm〜Hookでまた向きを変える)と定性的に矛盾しない。
- **未確認**: 写真では「大きな弧」の内部に секunder-curvature(細かい波打ち)が
  あるかどうかまでは、Right/Left側面写真だけでは判別できない(既存の
  Interpretation §1.3-Aでも「約8箇所での成形」という指摘があり、v2の
  5点で本当に十分かは未確定)。
- **確認できなかった点**: Hookの実際の巻き込み角度・巻き数(J字なのか、
  もう少し複雑な形か)は、`azimuth135_hook_visible_zoom.png`等の別角度写真
  ではより複雑な形状も観察されているが、Coordinate Integration未解決のため
  v2のhook/endの向きが実物の巻き込み方向と一致しているかは判断できない
  (§5のKnown Limitationと同根の課題)。

## 9. 次回Proposal v3へ向けた改善点

1. **RearFlex 5→4→3の検討**: 今回5点で符号反転は解消済みだが、shoji指定の
   段階的アプローチに従い、次はEditor上で実際に写真と見比べながら
   「5点のうちどれが冗長か」を確認し、必要なら4点・3点への削減を検討する。
   v1 Reviewで検証した3点案(entry/apex/exit)も参考として残っている。
2. **Hook Transition Profile(Phase2)**: §5のKnown Limitationのとおり、
   Hook終端の距離だけをEvidence Aへ合わせても、巻き込み形状(curl)を
   表現できないままでは不完全。Phase2でHookに中間制御点を追加し、
   直線ではなく実際の巻き込みに近い形状を表現できるようにすることを
   優先的に検討したい。
3. **全長トレードオフの扱い(§7②)**: Pocket〜RearFlexの短縮とHook延長が
   打ち消し合わず、合計長がv1よりEvidence B見立てから離れた。この
   トレードオフ自体は仕方ない面もあるが、v3ではLowerArm・Pocket区間も
   含めた全体のバランスを見て、どこかで妥協点を探る必要があるかもしれない。
4. **写真Overlayの限界(§8)**: 現状は定性的な比較に留まっている。もし
   将来Coordinate Integrationが前進すれば、より定量的な一致度評価が
   可能になる。それまでは「シルエットの大まかな一致」以上の精度を
   主張しないよう注意する。

---

## 10. 参照文書

- `docs/Soft_Clip_Centerline_Proposal_v1.json` / `Soft_Clip_Centerline_Proposal_v1_Review.md`
- `docs/Soft_Clip_Centerline_Proposal_v2.json`(本文書の出力)
- `docs/assets/soft-clip-m1m2m3/right_annotated.png` / `left_annotated.png`(写真参照)
- `docs/Soft_Clip_Geometry_Editor_Design_v1.0.md`(v1.1)
- `docs/Soft_Clip_Component_Tree_v1.0.md` / `Soft_Clip_Geometry_Improvement_Spec_v1.0.md`
