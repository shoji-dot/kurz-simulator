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

## v1.1 Update: Shaft Main Body / Shaft Connection Neck 分離 + 再較正試行（shoji実物確認、2026-07-31）

**shoji実物確認結果**:
- A. 既存Measurement Record記載の **"Shaft Lower Diameter 8.0mm"** は太い **Shaft Main Body**（写真下部のポリッシュ仕上げ円柱、ボール継手より下）を測定した値であり、細い接続部ではない。
- B. 今回の写真解析で抽出した部位（T字接合部直下の細い棒）は **Band LoopとShaft Main Bodyを接続する Shaft Connection Neck** であり、その実測値は **約4.0mm**。

**Parameter名称を分離（正式採用）**:
- **Shaft Main Body Diameter = 8.0mm**
- **Shaft Connection Neck Diameter = 4.0mm**
- M3で使用するShaft center axisは **Shaft Connection Neck center axis** として扱う（今回の対象部位選択は正しかったとshoji確認済み）。

**Neck Diameter 4.0mm基準での再較正**:

| 画像 | Neck幅(px、中央値) | 再較正スケール(px/mm) | 参考: ルーラー較正 |
|---|---:|---:|---:|
| Right.jpg | 40px | **10.00 px/mm** | 15.09 px/mm |
| Left.jpg | 33px | **8.25 px/mm** | 15.34 px/mm |

再較正後のM1/M3距離（同じpx距離を新スケールで再計算）:

| 距離 | Right.jpg | Left.jpg | ルーラー較正時の値（参考） |
|---|---:|---:|---:|
| M3→M1 | 2.27mm | 3.21mm | 1.50mm / 1.73mm |
| M3→M2(参考、Pending) | 6.78mm | 17.49mm | 4.49mm / 9.40mm |

**新たな不整合（Unresolved §4に追記）**: Neck基準で再較正すると、Right/Left間のM3→M1のクロスビュー差が **13%→42%に悪化**する（1.50/1.73mm→2.27/3.21mm）。また、Right.jpgでMain Body幅を独立に画素計測すると約114px、Neck幅40pxとの比は **114/40=2.85**であり、shoji申告の8.0/4.0=**2.0**という比と一致しない（43%の乖離）。これは、Neck1本の画素幅（30〜40px程度の細い特徴）はルーラーの目盛間隔（600px超にわたる基準）に比べて測定誤差の影響を受けやすいこと、または撮影時のNeck測定位置（Band Loop側/Main Body側のどちら寄りか、テーパーの有無）が、shojiのノギス測定位置と一致していない可能性を示唆する。**結論として、ルーラー較正とNeck較正はどちらも単独では確定的な決め手にならず、Neck基準mm値は参考値（Provisional以下の暫定値）として扱う**。

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

1. **【解決済み・部位識別】Shaft径不一致の原因はMain Body/Neckの取り違えと判明（v1.1）**。
   写真解析で抽出したのはShaft Main Body(8.0mm)ではなく**Shaft Connection Neck(4.0mm)**だったことがshoji実物確認で判明。ただし、Neck Diameter基準で再較正すると①Right/LeftのM3→M1クロスビュー差が13%→42%に悪化、②同一写真内でのMain Body/Neck画素幅比(2.85)がshoji申告の実寸比(2.0)と一致しない、という**新たな不整合**が発生（v1.1参照）。ルーラー較正・Neck較正のいずれもmm絶対値の確定的根拠にはならず、**mm値は当面Provisional以下の参考値**として扱う。

2. **M2（直線→Hook遷移点）は視点依存性が大きく、単一2D写真解析では確定困難**。
   物理的な返し曲げが緩やかであるほど、真上から見るか横から見るかで「曲がり始め」に見える位置がずれる。より確実な決定には、①現物への直接マーキング（shoji当初案）、②Lower Armの局所曲げ平面にほぼ正対する追加アングル写真、のいずれかが必要。

3. **Oblique 2枚（top-angle）は定量校正に使用していない**。定性的にはLower Arm–Hook–Shaftの位置関係が正面視と矛盾しないことを確認済みだが、独立した数値検証としては使っていない。

---

## Files

- `right_annotated.png` / `right_annotated_crop.png`: Right.jpg上にShaft軸(青)・Lower Arm直線(緑)・M1(赤)/M2(橙)/M3(マゼンタ)をオーバーレイ
- `left_annotated.png` / `left_annotated_crop.png`: 同上（Left.jpg）
