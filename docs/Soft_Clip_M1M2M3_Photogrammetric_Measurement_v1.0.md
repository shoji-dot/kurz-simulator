# Soft Clip M1/M2/M3 Measurement Record（写真幾何解析版 v1.0）

**Status**: **shoji判断済み(2026-07-31)**。M3=Definition正式採用(mm値は個体/スケール確認後に統合)、M1=Provisional採用、M2=Pending(正式採用せず)。`Soft_Clip_Band_Loop_Measurement_Record_v1.0.md` §1-1-Aへの数値統合はまだ実施しない。
**Date**: 2026-07-31
**Method**: 手動マーキングではなく、写真EvidenceからOpenCVによる幾何学的抽出（エッジ検出→直線フィット→交点計算）。M3は「Shaft外径左右端→中心軸算出」「Lower Arm構造中心線フィット」の2本の直線の交点として計算。

---

## Decision（shoji、2026-07-31）

**Adopt**
- **M3の定義・手法**（Shaft center axis × Lower Arm structural centerline の幾何学的交点）を正式Definitionとして採用。ただし今回得られたmm値は、写真個体のスケール問題（下記Additional verification）確認後にMeasurement Recordへ統合する。
- **M1**: Lower Arm Centerline開始点の抽出方法は妥当。**Provisional**として保持（正式Measurement Recordへの統合はスケール問題解決後）。

**Pending**
- **M2は正式採用しない**。理由: Right/LeftでM1-M2距離が2.99mm vs 7.68mmとなり視点依存性が大きい。M2は3D曲率遷移点であり、2D写真のみでは確定困難と判断。

**Additional verification（次工程①）**
- まずShaft径不一致問題を解決する。確認事項: 今回写真のSoft Clip個体と、過去測定した20倍模型が同一個体・同一倍率か確認する。
- 同一でない場合: 今回写真は**形状Evidence用**、過去ノギス測定は**寸法Evidence用**として分離管理する。

**次工程**
1. 個体/スケール確認
2. M3/M1 provisional値整理
3. M2追加Evidence取得方法検討

**Centerline Sweep実装にはまだ進まない。**

---

## Image Evidence

**Used images（定量測定に使用）**:
- `SoftClip_Right.jpg`（Right side view、1037×1577px）
- `SoftClip_Left.jpg`（Left side view、936×1749px）

**Used images（定性確認のみ、定量測定には不使用）**:
- `SoftClip_Right_Oblique.jpg`（Right oblique upper view）
- `SoftClip_Left_Oblique.jpg`（Left oblique upper view）
- 理由: 斜め上方視点のため定規面とカメラ面が平行でなく、画素→mm較正の誤差が大きい。トポロジー確認（Lower Arm/Upper Arm/Hookの位置関係）には使用。

**重要な前提確認**: Right.jpg と Left.jpg は同一個体を左右反対側から撮影したものと判断（Hook形状・ループ配置が鏡像関係）。これにより2方向からの独立検証が可能。

---

## Scale calibration

Grid（方眼紙）ではなく、写真に写る**mm刻みルーラー**のティックマークを直接検出して較正（Evidence A+、ノギス相当の直接参照）。

| 画像 | 較正方法 | px/mm | 備考 |
|---|---|---:|---|
| Right.jpg | ルーラー領域を色分離抽出→ティック間隔の中央値 | 15.09 (σ=1.22, n=45) | 1〜4cm範囲で検証 |
| Left.jpg | 同上 | 15.34 (σ=1.15, n=58) | 1〜10cm範囲で検証 |

両画像で1.7%差に収まっており、撮影距離・ズームがほぼ同一だったことを示す（クロスチェックOK）。

---

## Geometry extraction summary

1. HSV彩度によるSoft Clip本体のマスク抽出（背景の黄色方眼紙から分離）。
2. **Shaft center axis**: T字接合部より下の領域で、各y行ごとにShaft円柱の左右端を検出→中点(center x)をyに対して直線フィット。
   - Right.jpg: x = -0.0260·y + 374.14（残差SD 1.03px、y=330-790で抽出）
   - Left.jpg: x = -0.0605·y + 489.64（残差SD 1.02px、y=340-749で抽出）
3. **Lower Arm structural centerline**: Shaft接合部近傍でLower Armが単独の帯として分離できる区間を検出し、その区間で各x列ごとの帯の中心yを直線フィット。
   - Right.jpg: y = -0.0540·x + 355.45（残差SD 0.29px、x=388-431の43px区間）
   - Left.jpg: y = 0.1921·x + 218.35（残差SD 0.51px、x=400-445の46px区間）
4. **M3** = 上記2直線の交点（連立方程式を解く。写真上の「接触して見える位置」ではなく計算値）。
5. **M1** = Lower Armが単独の帯として分離でき、直線近似の残差が閾値内に収まり始める最初の点（Shaft側の境界）。
6. **M2** = 直線近似からの偏差が3σを継続的に超え始める点（直線→Hook-like曲線への遷移開始）。

---

## M1: Lower Arm Centerline Start Point

**Definition**: Centerline Sweep開始点。Straight Lower Armとして扱える開始位置。

| 画像 | 座標(px) | 実寸(mm、当該写真内) | 判断理由 |
|---|---|---|---|
| Right.jpg | (388, 334.0) | M3から1.50mm | Shaft-Lower Arm融合域から分離し、単独帯（幅28px）として安定し始める最初のx列 |
| Left.jpg | (445, 303.5) | M3から1.73mm | 同上（鏡像方向） |

**Confidence: Medium-High**（2方向で1.50mm / 1.73mm、差13%。分離境界の画素判定に若干の主観閾値が残るが、両画像で同オーダーの値）

---

## M2: Hook-like Bend Start Point

**Definition**: Straight Lower ArmからHook-like terminalへ曲率変化が開始する点（Hook終端でも最大曲率点でもない、Transition Point）。

| 画像 | 座標(px) | 実寸(mm、当該写真内) | 判断理由 |
|---|---|---|---|
| Right.jpg | (433, 331) | M3から4.49mm / M1から2.99mm | 直線フィットからの偏差が3σ(0.88px)を継続的に超え始める最初のx |
| Left.jpg | (329, 283.0) | M3から9.40mm / M1から7.68mm | 同上 |

**Confidence: Low**。**両画像で2.1倍の乖離**（M1→M2直線区間長: Right 2.99mm vs Left 7.68mm）。これは測定誤差というより、**3D的な緩やかな曲げが視点方位によって見かけの曲率開始点を変える**ためと考えられる（後述Unresolved参照）。単一写真からの2D画素解析だけでは確定できない。

---

## M3: Shaft Connection Point（Shaft center axis ∩ Lower Arm centerline）

**Definition**: Shaft中心軸とLower Arm構造中心線の幾何学的交点（見た目の接触点ではない）。

| 画像 | 座標(px) | 使用した2直線 |
|---|---|---|
| Right.jpg | (365.4, 335.7) | Shaft: x=-0.0260y+374.14 / LowerArm: y=-0.0540x+355.45 |
| Left.jpg | (471.0, 308.8) | Shaft: x=-0.0605y+489.64 / LowerArm: y=0.1921x+218.35 |

**Shaft–Lower Arm交差角**（直線同士のなす角、参考値）:
- Right.jpg: 94.6°
- Left.jpg: 82.6°（平均88.6°、ほぼ直交＝目視のT字形状と整合）

**Confidence: Medium-High**。2直線の交点という計算自体は決定論的で視点非依存性が高く、M3→M1距離も2方向で近い値（1.50mm/1.73mm）。ただし絶対mm値は下記Unresolved（Shaft径の不整合）の影響を受ける可能性がある。

---

## Unresolved points（要shoji確認）

1. **【最重要】Shaft径がこれまでの記録値と一致しない**
   本写真から実測したShaft径: Right.jpg 約2.65mm、Left.jpg 約2.28mm（写真内mm、平均約2.5mm）。
   一方 `Soft_Clip_Band_Loop_Measurement_Record_v1.0.md` §0記載の20倍模型実測値は
   **Shaft Lower 径0.40mm(20倍模型で8.0mm)**。この写真のShaftはBand Loop直下（Shaft Lower相当の位置）にもかかわらず、実測値がその1/3程度しかない。
   考えられる原因: ①今回の4枚は以前ノギス実測した「20倍模型」とは別個体・別スケールの現物/レプリカである、②以前の8.0mm記録に誤りがある、③斜め視点による見かけの縮小（ただしRight/Left.jpgは正面に近い側面視のため影響は小さいはず）。
   **この写真をもとにしたM1/M2/M3のmm値を、既存のSoft Clip設計文書（20倍模型基準）にそのまま統合してよいか、shojiの判断が必要**。

2. **M2（直線→Hook遷移点）は視点依存性が大きく、単一2D写真解析では確定困難**。
   物理的な返し曲げが緩やかであるほど、真上から見るか横から見るかで「曲がり始め」に見える位置がずれる。より確実な決定には、①現物への直接マーキング（shoji当初案）、②Lower Armの局所曲げ平面にほぼ正対する追加アングル写真、のいずれかが必要。

3. **Oblique 2枚（top-angle）は定量校正に使用していない**。定性的にはLower Arm–Hook–Shaftの位置関係が正面視と矛盾しないことを確認済みだが、独立した数値検証としては使っていない。

---

## Files

- `docs/assets/soft-clip-m1m2m3/right_annotated.png`: Right.jpg上にShaft軸(青)・Lower Arm直線(緑)・M1(赤)/M2(橙)/M3(マゼンタ)をオーバーレイ
- `docs/assets/soft-clip-m1m2m3/left_annotated.png`: 同上（Left.jpg）
