# Soft Clip M1/M2/M3 Measurement Record（写真幾何解析版 v1.8）

**Status**: **shoji判断済み(2026-07-31、Decision v1.3まで)。v1.7でレビュー反映(2026-08-04、Centerline Sweep実装状況・優先順位・座標系記述の整合修正のみ、Decision内容に変更なし)。v1.8でTurntable撮影セッションをGeometry Evidenceとして追加(2026-08-05、Decision内容に変更なし)**。M3=Definition正式採用(mm値は個体/スケール確認後に統合)、M1=Provisional採用/Definition現状維持、M2=固定座標点としての正式採用は行わない方針(v1.3)、代わりに「Hook Transition Profile」への再定義を検討中。`Soft_Clip_Band_Loop_Measurement_Record_v1.0.md` §1-1-Aへの数値統合はまだ実施しない。
**Date**: 2026-07-31（v1.7更新: 2026-08-04、v1.8更新: 2026-08-05）
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

## v1.2 Update: Neck形状プロファイル解析（Right.jpg、再較正は目的外、2026-07-31）

shoji依頼により、**mm再計算・M1/M3のpx座標変更を行わず**、Neck領域の形状のみを確認。
Right.jpgでy=320〜1037の範囲を1px刻みでスキャンし、各yでのNeck帯の画素幅を計測
（`docs/assets/soft-clip-m1m2m3/right_neck_width_profile.png`参照）。

1. **上下方向の横幅変化**: T字接合部の融合域（y≈320-375、Bridge/Lower Armと重なり
   ノイズが大きい、幅15-75px程度で不安定）を除くと、**y=376〜976の区間（clean
   cylindrical region）では幅はほぼ一定**（平均40.3px、標準偏差2.08px≈5%、線形
   回帰の傾きは-0.0002px/px行でほぼ無視できる水準）。左端・右端それぞれの位置も
   yに対してほぼ同じ傾き(-0.026px/px、Shaft軸の傾きと一致)で平行移動しており、
   幅そのものは変化していない。
2. **最大幅位置**: 上記のノイズ帯内でy≈582に局所的な46pxのピークがあるが、統計的
   にはノイズ範囲内（標準偏差の範囲内）であり、明確な「最大幅点」とは言えない。
   実質的な幅の増加はy≈980以降、ボール継手→Main Body方向への遷移部でのみ生じる。
3. **円柱かテーパー/R形状か**: **円柱（parallel-sided cylinder）と判断**。
   y=376-976の区間で幅・左右端位置とも系統的な変化がなく、テーパーやR形状を示す
   証拠はない。テーパーが明確に現れるのはボール継手遷移部（y≈980-1030+）のみ。
4. **4.0mm実測値がどの高さに対応するか（推定）**: Neckがほぼ全長にわたり一定幅
   であるため、**y=376〜976のどの高さで測っても写真上はほぼ同じ値（4.0mm相当）
   になるはずと推定**。ただしM1/M3(y≈331-336)はこの「clean」区間よりやや上、
   T字接合部の融合域(y≈320-375)寄りに位置しており、その高さ自体の画素幅は
   フィレット/Bridgeとの重なりで直接信頼できない。M1/M3位置における実効的な
   Neck径は、直下のclean区間(y≈376以降)から外挿した値に近いと考えるのが妥当。

**注**: 本セクションはNeck形状の理解のみを目的とし、mm較正・M1/M3のpx座標は
変更していない（shoji指定）。

---

## Decision v1.2（shoji、2026-07-31）

- **Shaft Connection Neck Diameter = 4.0mm を維持**（v1.1の値のまま）。
- **Neck形状は円柱としてConfirmed**（v1.2の解析結果を正式採用）。
- **Neck直接較正によるmm再計算は不採用**（v1.1で確認したクロスビュー悪化・Main
  Body/Neck画素比不一致のため）。ルーラー較正値・Neck較正値のいずれも確定根拠とせず、
  mm絶対値は引き続きProvisional以下として保留。
- **M1/M3のpx座標およびDefinitionは変更なし**（v1.0時点の値を継続保持）。
- **次工程**: M2追加Evidence取得方法の検討（下記）。**Centerline Sweep実装は
  まだ開始しない**（shoji明示）。

---

## M2 Additional Evidence Acquisition — 検討（Draft、shoji依頼、2026-07-31）

**目的**: Straight Lower Arm → Hook-like terminal transition point（M2）を、
再現可能なGeometry parameterとして定義すること。M2は3D的な曲率遷移点であり、
Right/Left（ほぼ180°対向視点）だけではM1→M2距離が2.99mm vs 7.68mmと2.1倍
乖離し、確定できないことがv1.0で判明済み。以下3項目を検討する。設計判断は
含まない（複数案の整理のみ、shoji判断待ち）。

### 1. 追加撮影条件（3D曲率遷移を最も観測できる方向）

Right/Left は Shaft軸まわりでほぼ180°対向する2視点であり、これらは互いに
**ほぼ同一の投影平面**（Lower Armの曲げがカメラ視線方向にどれだけ「奥行き」
成分を持つか、という点で情報を共有していない）を見ている。そのため2視点の
乖離自体が「曲げが2D投影に対してどちらの視点でも一部が奥行き方向に潰れている」
ことを示している。

- **案A(推奨): Shaft軸を中心に約90°回転した視点を追加**（Right/Left視点の
  「正面/背面」にあたる方向、Lower Armの曲げ平面をなるべく正面から見る狙い）。
  Right/Leftと合わせて実質3視点(0°/90°/180°)になり、三角測量的にM2の3D位置を
  絞り込みやすくなる。
- **案B: Shaft軸方向の真上からの垂直視点（Top-down/Plan view）を追加**。
  既存のOblique 2枚は斜め上方視点でルーラーがカメラ面と平行でなく較正誤差が
  大きかった(v1.0 Unresolved #3)。真上からの垂直視点であれば、Lower Arm/Upper
  Armの水平方向の広がり(Central Pocket開口方向)が最も歪みなく写り、ルーラーも
  平面に寝かせて同一面較正が可能になる。
  Shaft軸に沿った視点のため「どちらの向きに曲がっているか」を直接判定しやすい。
- **共通条件**: 新規撮影でもルーラーは被写体と同一平面（同一奥行き）に置く
  （v1.0/v1.1で判明した奥行きズレによる較正誤差を再発させないため）。

案A・案Bは互いに排他的でなく、**両方揃えば最も確度が高い**(Right/Left/90°回転/
Top-downの4視点で3D centerlineを近似復元できる可能性)。撮影負担を考えると、
まずは案B(Top-down、1枚追加)が費用対効果が高いと考えられる（Lower Armの
曲げ平面が水平方向寄りであれば、Top-downだけでほぼ解消できる可能性がある）。

### 2. 現物マーキング方法

写真解析だけに頼らず、現物へ直接マーキングする方法も有効（元々shoji提案の
アプローチ）。

- **案A(推奨): 直線定規/細い直線状の治具をLower Armに沿わせ、浮き上がり始める
  点を物理的に特定**。これは本解析で使った「直線フィットからの偏差が閾値を
  超える点」という計算上の判定基準を、現物上で直接行う方法にあたる（視点依存性
  の影響を受けない）。特定した点に極細マーカーで印をつけ、その状態でRight/Left/
  追加視点を撮影すれば、マーク位置の三角測量でM2の3D座標を確定できる。
- **案B: 曲率半径を複数点でノギス等により推定し、閾値以下になる点を特定**。
  定規法より手間がかかるが、定量的な「どのくらい曲がっているか」の記録が残る。
- 案A・Bいずれも、マーキング後に**複数方向から撮影し直す**ことで、写真解析
  パイプライン（本解析で確立したライン抽出・交点計算の手法）をそのまま
  再利用できる。

### 3. M2を固定点でなくSpline transition parameterとして扱う可能性

Right/Leftでの2.1倍の乖離、および既存Interpretation文書の記述（Lower Arm/
Upper Armは「約3回の主要カーブ」を描く、単純な直線→1箇所の鋭い曲げではない）
を踏まえると、**M2を「厳密な1点」として求めること自体が、実際の形状と整合
しない可能性がある**。

- **検討方向**: Centerline SweepのProfile経路をスプライン(Catmull-Rom/Bezier等、
  Method Decision v1.4で言及済みのCenterline Sweep方式と整合)で構成する場合、
  M2は「座標点」ではなく、**スプラインの曲率がなだらかに増加し始めるパラメータ
  (例: t値、または局所曲率半径のプロファイル)として扱う**選択肢がある。
- **利点**: 現物が本当になだらかに曲率が変化する形状であれば、Spline
  parameterとして扱う方が物理形状に忠実。「M2という1点を確定させる」ことに
  固執せず、Right/Left両方の輪郭とおおむね整合するスプライン曲率プロファイルを
  探索的に選ぶ、というアプローチになる。
- **これまでのFlatFoot(G3-2)の教訓との整合**: 「教育用Visual Geometryでは
  主要寸法は正確に、形状そのものは可能な限り単純に留め、曲面は明示的要求が
  ない限り追加しない」という既存の設計原則([[feedback]])とも整合的——M2を
  ピクセル単位で厳密に求めようとすること自体が、FlatFoot v1〜v7で経験した
  「精度過剰」パターンに近い可能性がある。
- **留意点**: この方向性を採用する場合、「Geometry生成に必要な最小限の
  Parameter」という元々のMeasurement Record方針(shoji指定)からは、M2が
  「測定して代入する定数」から「デザイン上チューニングするパラメータ」へ
  性格が変わることになる。これ自体の是非はshoji判断が必要。

**次工程（提案、shoji判断待ち）**: 上記1〜3のどの組み合わせで進めるか
（例: 案B(Top-down追加撮影) + 案3(Spline parameter化)を先に試す、等）を
決定してから着手する。**Centerline Sweep実装はまだ開始しない**。

---

## Decision v1.3（shoji、2026-07-31）

1. **追加撮影は案B(Top-down視点)を優先**。
   **目的**: Lower Arm〜Hookの曲げ主平面を取得し、M2の3D曲率遷移理解に利用する。
   **撮影条件**:
   - 被写体とルーラーを同一平面に配置する（v1.0/v1.1で判明した奥行きズレによる
     較正誤差を再発させないため）。
   - Shaft軸方向から垂直視（真上からのTop-down、斜めのObliqueではない）。
   - 定量解析可能な解像度（既存Right/Left.jpg相当以上を想定）。
   → **撮影待ち**（次回shoji撮影後、本ファイルの解析パイプラインを再適用する）。

2. **M2は固定座標点としての正式採用を行わない**。
   **理由**: Right/Leftで2.1倍乖離し（v1.0参照）、既存Interpretation文書の
   「複数主要カーブ」（約3回の主要カーブ、単純な直線→1箇所の鋭い曲げではない）
   という記述と整合しないため。

3. **M2をCenterline Sweep用Parameterとして再定義する方向で検討**（旧称→新称）:

   | 旧 | 新案 |
   |---|---|
   | Hook-like Bend Start Point（固定座標点） | **Hook Transition Profile**（遷移領域のParameter群） |

   検討項目（v1.2の「Spline transition parameter」案を具体化）:
   - **Transition length**: 直線区間からHook形状へ移行する区間の長さ
     （Right/Leftそれぞれで観測された「見かけの直線区間長」2.99mm/7.68mmを、
     視点依存性を踏まえてどう統合するかが論点）。
   - **Curvature profile**: 遷移区間内での曲率の変化のしかた（一定曲率の円弧
     近似か、なだらかに増加するプロファイルか）。
   - **Terminal approach angle**: Hook-like terminal（既にEvidence A確定済み、
     Terminal Length約2.40mm）へ接続する際の角度。
   - **注**: これは名称・方針の検討であり、上記3項目の具体的な値決定はまだ
     行っていない。Top-down撮影のEvidenceを得てから着手する。

4. **M1/M3のDefinitionは現状維持**（v1.0〜v1.1のまま変更なし）。

**Centerline Sweep実装はまだ開始しない。**

---

## v1.4 Update: 既存Oblique 2枚のSHOT A(90°回転視点)該当確認 + Hook Transition Profile用の再評価（2026-07-31）

**確認結果: 既存4枚の中に、Shaft軸まわり約90°回転視点（SHOT A相当）は存在しない。**

Right_Oblique.jpg / Left_Oblique.jpg のマスク抽出・拡大確認により、それぞれ
Right.jpg / Left.jpg と**同一方位角(azimuth)**であることを確認した（ループ・
Hookの左右配置がRight.jpg/Left.jpgとそれぞれ一致、鏡像関係も同じ）。Obliqueは
方位角ではなく**仰角（カメラを上方から見下ろす角度）のみが異なる**撮影であり、
SHOT A(方位角90°回転)には該当しない。

**Hook Transition Profile用としての再評価（M2固定点探索としてではなく）**:

| 確認項目 | 判定 | 根拠 |
|---|---|---|
| 1. Lower Arm→Hook terminalの3D曲率方向が観察可能か | **部分的に可能** | 仰角視点のためLower Arm帯の上面が写り、Hook接近部でハイライトの位置が
帯の長手方向に沿ってシフトしている＝ねじれ(torsion)成分が存在する可能性を示唆。ただし方位角回転がないため、曲げ平面の正確な向き(3D法線方向)は未確定 |
| 2. Transition regionの範囲推定が可能か | **定性的には可能、定量化は不可** | 直線区間から曲がり始める位置は目視で確認できるが、v1.0 Unresolved#3と同じ較正課題（ルーラーがカメラ面と平行でない）が残る。方眼紙が被写体と同一平面にある保証がなくローカル較正の根拠として使えるかは未確認 |
| 3. Terminal approach angleが取得可能か | **良好に観察可能** | 拡大クロップ(`right_obl_terminal_zoom.png`)でHook terminalの巻き方向・開口向きが明瞭に確認できる。Right.jpg/Left.jpgより近接・高精細で、定性的な形状把握には既存Oblique 2枚で十分 |

**結論**:
- Right_Oblique.jpg / Left_Oblique.jpgは、**M2固定点探索用としては不採用のまま**
  だが、**Hook Transition Profileの定性的な形状理解（特にitem 3: Terminal
  approach angleの向き、item 1: ねじれ成分の存在示唆）には有用**と再評価する。
- **不足する情報**: item 2(Transition region範囲の定量化)と、item 1の3D曲げ
  平面の正確な向きは、既存4枚だけでは埋まらない。**Decision v1.3で決定済みの
  Top-down追加撮影が引き続き必要**（方位角の異なる視点情報が根本的に不足している
  ため）。

**Centerline Sweep実装はまだ開始しない。**

---

## v1.5 Update: Azimuth Ring追加撮影4枚の整理（Geometry Evidence整理のみ、2026-07-31）

**前提の訂正**: 今回の4枚は「Top-down(真上視点)」ではなく、**Soft Clip本体をルーラーと
同一平面上に寝かせ、被写体を回転させずカメラをShaft軸まわりに約45°刻みで移動**させた
撮影(Azimuth Ring)。以前v1.3で決定した「Top-down追加撮影」とは別の取得方法である
（本セクションはこのAzimuth Ring 4枚の整理、Top-downの要否は下記v1.5結論参照）。

### 1. 既存Right.jpg/Left.jpgとの対応関係

Right.jpg(直立撮影・Azimuth基準0°)/Left.jpg(直立撮影・Azimuth基準180°)とは、
**被写体の置き方(直立 vs 寝かせ)が異なるため撮影セットアップ自体は別物**。
ただし被写体は同一個体であり、Shaft軸まわりの回転角という意味では同一の連続的な
座標系として扱える(Shaft軸を回転軸とする点は共通)。

### 2. 方位角の判定

ファイル名(`SoftClip_Azimuth_Right45/Right135/Left45/Left135`)は撮影時のshoji整理
ラベルであり、命名規則から以下の対応が最も整合的と判断した:

| 撮影ファイル名 | 対応Azimuth(判定) | 判断根拠 |
|---|---:|---|
| SoftClip_Azimuth_Right45.jpg.jpg | **45°** | "Right(0°)から45°"という命名と、Right.jpgに近い(ただしHook-like terminalが遮蔽されて見えないなど明確な差もある)シルエット傾向から整合 |
| SoftClip_Azimuth_Right135.jpg | **135°** | "Right(0°)から135°"、Hook-like terminalが明瞭に見え始める |
| SoftClip_Azimuth_Left45.jpg | **225°**(=180°+45°) | "Left(180°)から45°"はRight45(45°)との重複を避けるため180°を跨いだ側と判断 |
| SoftClip_Azimuth_Left135.jpg | **315°**(=180°+135°) | 同上、Left135はLeft45よりさらに0°/360°側へ回転した位置 |

**確信度: Medium**。0°→45°→135°→180°→225°→315°→(360°=0°)という並びで、Hook-like
terminalの遮蔽/可視のパターンがなだらかに変化しており(下記参照)、大きな矛盾はない。
ただし正確な角度値(45°刻みが本当に等間隔だったか)はshoji撮影時の位置決めに依存し、
写真のみからの独立検証はできていない(**確認済みなのは相対的な並び順のみ**)。

**ファイル名の提案(採用)**:
- `SoftClip_Azimuth_045.jpg`(旧Right45)
- `SoftClip_Azimuth_135.jpg`(旧Right135)
- `SoftClip_Azimuth_225.jpg`(旧Left45)
- `SoftClip_Azimuth_315.jpg`(旧Left135)

`docs/assets/soft-clip-m1m2m3/azimuth-ring/`に上記名称でコピー済み。

### 3. 評価項目A/B/C

**重要な観察: Hook-like terminalの可視性がAzimuthによって変化する（自己遮蔽）**。
これはM2/Transition理解にとって新規かつ重要な情報。

| Azimuth | Hook-like terminal | 備考 |
|---|---|---|
| 0°(Right.jpg) | 可視 | 直立撮影 |
| **45°** | **不可視(Upper Arm/ループ構造に隠れる)** | `azimuth045_pocket_zoom_hook_occluded.png`参照。この角度から見えるのはUpper Arm自由端(単純な丸め形状、Hookなし)のみ |
| **135°** | **明瞭に可視** | `azimuth135_hook_visible_zoom.png`参照、J字型のHook形状がはっきり確認できる |
| 180°(Left.jpg) | 可視 | 直立撮影 |
| 225° | 可視 | |
| 315° | 可視 | |

**A. Lower Arm→Hook terminalの3D曲率方向**: **135°/225°/315°(Hookが可視な角度)で
観察可能**。これらの視点でHookは一貫して「Shaft/Pocket側へ巻き込むように」湾曲しており、
定性的な巻き方向は3視点で矛盾しない。ただし曲げ平面の正確な法線方向(定量値)は、
本解析(較正未確認)からは求めていない。**45°でHookが遮蔽される**という事実は、
Hookが Upper Arm/ループ構造の「陰」に入る3D配置であることを示す新しい間接証拠。

**B. Transition region**: 各Azimuthでの直線→Hook遷移の見かけ位置は、Right/Left
(0°/180°)間で既に2.1倍の乖離が確認済み(v1.0)。今回の4枚についても同様の視点
依存的なシフトが予想されるが、**本セクションでは較正・px計測は行っていない**
(目的はGeometry Evidence整理、Centerline Sweep実装や数値確定はまだ行わない
というshoji指示のため)。定性的には、Hookが可視な135°/225°/315°の3枚を比較する
ことで、視点依存性の傾向をより詳しく把握できる可能性がある(次工程候補)。

**C. Terminal approach angle**: **135°/225°/315°で良好に観察可能**。3視点とも
Hook終端の巻き込み方向・開口方向は定性的に一致しており(Shaft/Pocket側を向く)、
Right_Oblique/Left_Obliqueで得た所見(v1.0 Unresolved item3相当)と整合的。

### v1.5 結論（3つの判断事項）

**1. 今回4枚によりTop-down追加撮影は不要になるか**: **不要にはならない、ただし
優先度は下がる**。今回のAzimuth Ring 4枚はいずれも「机上に寝かせた状態を横から
見る」撮影であり、被写体の**上面**を見る視点(v1.3で意図したTop-down相当)は
まだ得られていない。一方、Azimuth Ring自体は0°/45°/135°/180°/225°/315°の6方位
まで揃い、**90°/270°(Hookの湾曲平面に最も正対すると予想される方位)のみが
欠落**している。**費用対効果としては、Top-downより先に90°/270°の追加撮影の
方が優先度が高いと判断する**(Ring方式を継続する方が撮影セットアップの
一貫性が保てるため)。Top-downは依然として補完的に有用(上面からしか見えない
情報があるため)だが、必須のブロッカーではなくなった。

**2. 6方位ViewでCenterline Sweep用Transition Profileを設計可能か**: **定性的
設計(形状の全体像・Hookの巻き方向・遮蔽パターン)には十分**。**定量的パラメータ
(Transition length・Curvature profileの数値・Terminal approach angleの角度値)
の確定には、まだ不十分**——理由: ①今回4枚の較正(ルーラーと被写体の同一平面性)
は撮影条件として申告されているが、v1.0/v1.1で判明した奥行きズレの再発有無を
まだ検証していない、②本セクションではM1/M3で行ったような直線フィット・交点
計算をこの4枚に適用していない(Evidence整理のみに留めるというshoji指示のため)。

**3. 追加で必要なEvidence**:
- **90°/270°のAzimuth Ring撮影**(最優先候補、Hookの湾曲平面に正対すると
  期待される角度)。
- 較正検証: 今回4枚でルーラー目盛間隔の較正値を算出し、Right/Left(15.09/15.34
  px/mm)と比較整合するか確認(Neck径既知値4.0mmとの整合確認も含めうる)。
- (補完・低優先)Top-down 1枚: 上面情報の取得。

**Centerline Sweep実装はまだ開始しない。**

---

## v1.6 Update: Geometry Evidence管理レビュー（前提訂正: カメラ方位角変更、被写体回転ではない、2026-07-31）

**前提訂正の反映**: 今回のAzimuth Ring 4枚は「被写体回転」ではなく**カメラの
方位角変更**（Soft Clip本体はルーラーと同一平面上に静置・無回転、カメラを
Shaft軸まわり水平方向に約45°刻みで移動、カメラ高さは不定）。v1.5の記述と矛盾
しないが、用語を明確化。

### 1. Azimuth命名の妥当性

**判断: 命名は`SoftClip_Azimuth_045/135/225/315.jpg`へ統一し、"Right/Left"表記は
正式Parameter名からは外す。ただしshoji撮影時セッションラベルとして注記は残す。**

- **Right/Left表記を残すべきか**: 正式名称としては**残さない**。理由: 元の
  Right.jpg/Left.jpg(直立撮影セッション)と、今回のAzimuth Ring(寝かせ撮影
  セッション)は**物理セットアップが異なる**。"Right45"という表記は「Right.jpg
  から45°」という直接的な派生関係を連想させるが、実際には別セッションであり、
  対応関係はShaft軸まわりの回転角という**概念上の連続性**でしかない。命名の
  混同を避けるため正式名称は`SoftClip_Azimuth_0XX.jpg`に統一し、`Right45`等は
  「撮影時shojiラベル」として参照用に併記するに留める（v1.5で採用済みの命名
  規則を維持、追加の修正なし）。
- **Azimuth 045/135/225/315への統一**: 上記の通り採用済み。
- **絶対角度 vs Relative Azimuth**: **Relative Azimuth(相対方位角)として管理
  すべき**。根拠: v1.5で確認した通り、対応の確信度は"Medium"——**検証できて
  いるのはRight(0°)/Left(180°)を基準にした相対的な並び順(Hook可視性パターン
  等から一貫性を確認)のみ**であり、「本当に45.0°刻みだったか」という絶対角度
  の精度はshoji撮影時の位置決めに依存し写真から独立検証していない。したがって
  文書内では「Azimuth 045°(nominal, 撮影時想定値)」のように**nominal(公称値)
  であることを明記**し、精密な角度較正が必要になった場合は別途Evidence取得が
  必要と扱う。

### 2. Evidence価値の再評価（A/B/C）

| 項目 | Evidence強化になった点 | まだ不足している情報 | 次に撮影すべき角度 |
|---|---|---|---|
| **A. Lower Arm→Hook Transition Profile理解** | 視点数が2→6に増加、Transition
領域の視点依存性をより広い角度範囲で確認できる基盤ができた | この4枚に対する
較正・px計測(直線フィット等)は未実施、定量値はまだ無い | **90°/270°**（未取得の
唯一の45°刻み方位、Hookの湾曲平面に最も正対すると予想） |
| **B. Hook-like terminalの3D配置理解** | **自己遮蔽パターン(45°で不可視/135°
以降で可視)という新規Evidence**を獲得、これは較正なしでも成立する直接観察事実 | 遮蔽↔可視の境界がどこにあるか未特定（45°と135°の間、90°分の粗い範囲でしか
絞れていない）、正確な3D配置(座標)は未計算 | **90°**を優先（境界の中間点として
最有力）、必要なら60°/75°等の細分化 |
| **C. Centerline Sweep用Parameter設計** | 6方位分の定性的シルエットが揃い、
将来スプライン候補の目視検証(視点間の整合確認)がしやすくなった | 定量Parameter
はゼロ、かつ今回の寝かせ撮影セッションとRight/Left(直立撮影セッション)の座標系
統合方法が未検討(較正・座標変換とも未着手) | 90°/270°に加え、**座標系統合方針の
整理**（撮影セッションが混在する場合の対処、次工程で検討） |

### 3. Hook可視性変化のEvidence Level評価

| 評価対象 | Evidence Level | 理由 |
|---|:---:|---|
| Hook-like terminalが方位角により遮蔽/可視が切り替わるという**事実そのもの** | **A** | 複数枚の写真で直接観察された再現性のある事実（解釈を要さない）。ただし遮蔽/可視の境界の正確な角度値はUnknown |
| Upper Arm(またはループ構造)との**前後関係**（Hookが奥にある、という解釈） | **B** | 直接観察(遮蔽)から導かれる妥当な解釈だが、断面図やスキャン等の独立手段で確認されたわけではない |
| Hookの**曲げ方向**（3D的にどちらへ巻き込むか） | **B（精度面ではB−寄り）** | 135°/225°/315°の3視点で定性的に一致する巻き込み方向の印象はあるが、較正されたTriangulationではなく目視の定性判断に留まる |

**総合**: 「自己遮蔽が発生する」という事実(Evidence A)は、Hookの3D配置に
ついて**強い間接証拠**を与えるが、それを「正確な3D座標」や「正確な曲げ方向の
数値」に変換するには、この4枚だけではまだ不十分（Evidence B相当が上限）。

### 4. 追加撮影優先順位（費用対効果順）

1. **候補C: 現物マーキング後の複数方向撮影**（最優先）。理由: M2/Hook
   Transition Profileの核心Parameter(Transition length)は、これまで複数回の
   写真解析だけでは確定できなかった（Right/Left間で2.1倍の乖離、v1.0参照）。
   今回確立したAzimuth Ring撮影の手法(同一平面較正・複数方位角)と組み合わせれば、
   マーキング点の三角測量による確定が最も確実性が高い。
2. **候補A: 90°/270° Azimuth Ring追加撮影**（次点、候補Cの準備としても有効）。
   理由: 低コスト（既存Ring撮影と同一セットアップの延長）で、①Hook遮蔽境界の
   特定、②現物マーキング位置をshojiが判断する際の視覚的補助、の両方に寄与する。
   **候補Cの前に実施するのが望ましい**（マーキング位置の判断材料になるため）。
3. **候補B: 完全なTop-down撮影**（低優先）。理由: 上面情報という独自の価値は
   あるが、Hook Transition Profileという当面の目的に対しては候補A/Cほど
   直接的でない。Pocket形状等の別目的では引き続き有用な可能性があり、完全に
   不要とはしない。
4. **候補D: その他(提案) — 動画による連続Azimuthスイープ**。静止画を45°刻みで
   都度撮影する代わりに、カメラを連続的に動かしながら動画撮影し、必要な
   フレームを後から切り出す方法。候補Aの角度細分化(90°付近を細かく確認したい
   場合等)を低コストで実現できる可能性があるが、画質・ルーラー較正の安定性は
   要検証。優先度は候補A/Cの結果を見てから判断。

**推奨順序**: 候補A(90°/270°) → 候補C(現物マーキング、Aの結果を参考に位置決め)
→ 必要なら候補D → 候補B。

### 5. Centerline Sweep実装開始可否

**判断: 「まだEvidence取得フェーズ継続」。「Geometry設計開始可能」の段階には
達していない。**

根拠:
- **M2/Hook Transition Profile**: 定量Parameterが依然としてゼロ（Evidence B
  相当の定性理解のみ）。Transition length/Curvature profile/Terminal approach
  angleのいずれも数値未確定。
- **M1/M3**: Decision v1.2の通り、mm絶対値はProvisional以下のまま据え置き
  （Neck基準再較正がクロスビュー差を悪化させた問題は未解決）。px座標・
  Definitionのみ確定。
- **座標系統合**: 直立撮影セッション(Right/Left)と寝かせ撮影セッション
  (Azimuth Ring)の座標系統合方針も未着手（v1.6 §2表内で新規指摘）。
- 現行方針(M1=Provisional維持/M2=固定点不採用・Hook Transition Profile検討/
  M3=Definition採用/数値パラメータ確定前に実装しない)は**妥当であり変更不要**。

**Centerline Sweep実装はまだ開始しない。**

---

## v1.7 Update: 座標系記述の訂正 + 優先順位の整合修正（2026-08-04）

外部レビューを受けての差分確認。**以下はv1.6で既に対応済みのため変更なし**:
Azimuth命名のNominal Relative Azimuth化（§1）、Evidence Level A/B/B−相当の区分（§3）、
Centerline Sweep実装未開始の判断（§5、方針自体は不変）。

実質的な差分は以下3点。

### 1. v1.5記載「同一の連続的な座標系として扱える」の訂正

v1.5 §1に以下の記載がある:

> ただし被写体は同一個体であり、Shaft軸まわりの回転角という意味では同一の連続的な
> 座標系として扱える(Shaft軸を回転軸とする点は共通)。

この表現は誤解を招く。正確には「同一個体のため形状対応は推定できる」というだけで、
「座標系が連続」とまでは言えない。直立撮影(Right/Left)とAzimuth Ring撮影(寝かせ)は
物理セットアップ・カメラ高さ・較正基準が異なり、両セッション間のオフセット（回転
原点のズレ、上下方向の対応関係）は未定義のまま。

**訂正後の正式な扱い（v1.5本文より本節を優先）**:
「同一個体であるため形状対応関係は推定可能。ただし、直立撮影セッションとAzimuth
Ring撮影セッション間の座標変換は未定義であり、正式な統合座標系はまだ構築していない。」

これはv1.6 §2表の「座標系統合方法が未検討」という指摘と矛盾しない（新規課題では
なく、その根拠を明記したもの）。

### 2. 追加撮影優先順位の整合修正

v1.6 §4の番号付きリスト（1.候補C→2.候補A→3.候補B→4.候補D）と、同節末尾の
「推奨順序」（候補A→候補C→候補D→候補B）が不一致だった。**推奨順序を正とし、
番号付きリストを以下に修正する**:

1. **候補A: 90°/270° Azimuth Ring追加撮影**（最優先）。低コストで既存Ring撮影の
   延長、Hook遮蔽境界の特定と候補Cの位置決め補助を兼ねる。
2. **候補C: 現物マーキング + 複数Azimuth撮影**（候補Aの結果を撮影角度・位置決めの
   参考にする）。**目的の明確化**: M2を固定座標点として決定するためではなく（v1.3で
   既に不採用と決定済み）、**Hook Transition Profile（Transition length /
   Curvature profile / Terminal approach angle）のParameter抽出のための現物対応
   付け**が目的。
3. **候補D: 動画による連続Azimuthスイープ**（候補A/Cの結果を見てから要否判断）。
4. **候補B: 完全なTop-down撮影**（低優先、補完的価値のみ）。

### 3. Centerline Sweep実装判断（内容はv1.6§5と同一、構造化して再掲）

```
Centerline Sweep implementation status: NOT STARTED
Current phase: Geometry Evidence Acquisition Phase

Reason:
- Hook Transition Profile has no quantitative parameters yet.
- M1/M3 absolute mm values remain Provisional or below.
- Coordinate relationship between the upright session (Right/Left) and
  the Azimuth Ring session is not yet defined (see §1 correction above).
- Transition region cannot yet be represented by stable procedural parameters.

Implementation may begin only after:
1. Transition Profile parameter definition
2. Coordinate system integration strategy
3. Minimum sufficient geometry specification
are completed.
```

### v1.7 Status サマリ

| 項目 | Status |
|---|:---:|
| M3 Definition | Adopted |
| M1 Definition | Provisional |
| M2固定点 | Reject |
| Hook Transition Profile | Concept adopted（Parameter未定） |
| Azimuth Naming | Nominal Relative Azimuth（v1.6で確定、変更なし） |
| Hook遮蔽Evidence | A/B/B−（v1.6で確定、変更なし） |
| 座標系統合（直立⇔Azimuth Ring） | 未着手。**v1.5の誤解を招く表現をv1.7で訂正** |
| 追加撮影優先順位 | **v1.7で整合修正（候補A→C→D→B）** |
| Geometry Parameter | 未確定 |
| Centerline Sweep | NOT STARTED |

---

## v1.8 Update: Turntable撮影セッション追加（Geometry Evidence、2026-08-05）

**前提**: 本セッションはRight/Left（直立撮影）およびAzimuth Ring（v1.5/v1.6、カメラ手持ち移動）とは別の新規データセット。ターンテーブル固定回転・カメラ固定・被写体固定という撮影条件（約90°刻み4カット）。座標系統合はv1.7までの方針通り未着手・本セクションでも行わない。

**用語訂正**: 撮影物の金属シャフト部分は独立した器具ではなく、Soft Clip自体のShaft（金属製）。グレー/タン色のHook・Band Loop部分と合わせて一体の医療機器である。

差分は以下4点のみ。

- 新ターンテーブル撮影セッションをGeometry Evidenceとして追加。
- 4方向すべてでSoft Clip本体は確認できた。ただし、一部画像ではピント・フレーミングの影響によりHook Transition Profile評価可能な情報量に差があった。
- 今回のデータセットには、前回確認された自己遮蔽パターンを再確認または反証できるEvidenceは含まれていなかった。
- Centerline Sweep開始判断は変更せず、Evidence取得フェーズ継続とする。

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
