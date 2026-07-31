# Soft Clip Geometry Interpretation v1.0

**Status**: Draft(shoji確認・v1.6訂正済み)。**コード変更は行っていない(形状解釈・
用語整理のみ)**。
shojiさんの訂正(2026-07-30)を反映しv1.1に更新: ①太いクロム円柱は撮影用治具ではなく
Soft Clip本体の段付きシャフト(Confirmedへ変更、§4-1)。②Wing終端フィーチャー・
③曲げの性質はOpen Questionのまま維持(shoji指定)。
v1.2追加修正(2026-07-30): Shaft Lower/Shaft Middleの径表記で「実寸」と「撮影スケール
換算値」が混在していた点をshoji指摘により分離(§1.2参照)。**実寸径(20倍模型を直接
実測した値、Evidence A+)は Shaft Lower 8.0mm / Shaft Middle 4.0mm。撮影スケール換算
(20×、実測値÷20による算出値)は Shaft Lower 0.40mm / Shaft Middle 0.20mm**。以降、本文書
では両者を必ず区別して表記する。
v1.3追加修正(2026-07-30、shoji指摘): §4のOpen Questionsを**性質の異なる2カテゴリ**に
明確に分離した。(A)**臨床形状の不確定点**(4-2 Band Loop終端フィーチャー数、4-3曲げの
性質) — 実物の形状そのものがまだ確定していない、Interpretation段階の不確定性。
(B)**Geometry実装方式の検討事項**(4-4 Band Loop Geometry Reference、新規追加) —
形状は概ね確定した前提で、それをどう実装するか(手法選択)という、Geometry方式決定
段階の論点。この2カテゴリを混同すると「Evidence→Interpretation→Geometry→
Implementation」という設計思想の階層が崩れるため、以降は明示的に区別する
(shoji指摘、2026-07-30)。
v1.4追加修正(2026-07-30、shoji訂正): Band Loop全体形状の理解を訂正。従来の
「C字状のシルエット」という表現は不正確であり、**実物は単純なC字リングではなく、
「つ」字状の開口部を持つ弾性クリップ**として理解する方が正確(§1.3・新設§1.4)。
あわせて、この「つ」字形状自体がキヌタ骨長脚を保持するクリップ機構を構成している
という機能的な説明をshojiより受領し、Confirmedとして新設§1.4に記録した。本文書内の
「C字状」という表現は全てこの訂正に合わせて置き換えた。4.A(臨床形状)のOpen
Questionsも、この訂正を踏まえて4-2(終端部の正確な形状)・4-3(曲げ・弾性変形に
関する不確定点、新たに「弾性変形領域の境界」を追加)を更新した。**Geometry方式の
決定(②)はこのv1.4では行わない**(shoji指定、Interpretation修正のみ)。
v1.5追加修正(2026-07-30、shoji指摘): §5候補Aの用語を精密化。「Centerlineベース」
「ExtrudeGeometry+区分的直線パス」という表現が一般的な「Centerline Sweep」と意味が
ずれる可能性を指摘され、候補Aの正確な手順(2D断面Profile定義→複数直線区間を1本の
連続Curveへ結合→そのCurveに沿って1回のExtrudeGeometry呼び出しで断面Profileを一括
掃引)を明記した。あわせて、誤解しやすい別解釈(区間ごとに個別Extrude→制御点で配置、
これは実質的に候補Bと同じ)も明示して区別した。**Geometry方式の決定内容(4-4=Option A
採用、Method Decision v1.2)自体に変更はない**、用語の精密化のみ(shoji指定)。
v1.6追加修正(2026-07-30、shoji追加観察): Band Loop全体形状のInterpretationをさらに
精密化。v1.4/v1.5の「単純なC字リングではない開放型弾性クリップ」という理解を維持
しつつ、より正確には**「横から見た基本形状は『つ』字状一筆書きに近い連続形状」**
として扱う(新設§1.3-A)。単純なC字リングでも蛇行したS字部品でもなく、基本トポロジー
は「つ」字状の単一連続Centerlineであり、Upper Arm・Lower Arm部分が複数回(約3回)の
主要カーブを描きながら中央のPocket形成部を構成し、下側先端(Lower Arm側)は反転する
ような返し曲げ形状に見える、という追加観察(Evidence B)。Interpretationの正式表現を
**「『つ』字状一筆書きCenterlineを持つ開放型弾性クリップ」**(英: "Open elastic clip
with a continuous TSU-like centerline geometry")へ更新する。あわせて、Centerline
Sweepの制御点は固定数(P0〜P3等)ではなく、Shaft接続部・主要曲率変化点・Pocket形成部・
開口端という**機能的カテゴリを表現できる必要最小限の点数**として扱う方針を明記
(§5-A)。Pocket最大幅とArm間距離は目的の異なる別パラメータとして分離(§1.3-A)。
最大開口方向は現時点で数値化不要、Evidence B相当の定性記録(「装着時にUpper/Lower
Arm間が広がる方向」)とする。**本v1.6はInterpretationの更新のみであり、制御点座標・
Mesh生成には進まない**(shoji指定)。
v1.7追加修正(2026-07-31、shoji実測値受領): Pocket Maximum Width(1.40mm)・Arm Gap
/Opening(0.75mm)・Pocket Depth(3.30mm)・Terminal Shape(Hook-like)・Terminal
Length(約2.40mm)をEvidence A/A+として受領し反映。**新設§1.5**: Pocket Maximum
Width(1.40mm)≠Arm Gap(0.75mm)であることから、PocketはFunnel状(内部拡大型、
入口→狭い開口→内部で広がる空間→最深部)のGeometryとして確定(Confirmed)。Pocket
Depthの定義を"Distance from the underside of the Upper Arm tip (Pocket entrance
reference plane) to the deepest point of the Pocket"に固定。**§4-2(終端部の正確な
形状)を更新**: Terminal ShapeはHook-like terminal(Evidence A、完全なHook形状では
ない)として確定、Terminal Length約2.40mm。**新設§4-5(4.A、最重要未確定項目)**:
Shaft接続位置(Lower Arm開始点・返し曲げ終端・Shaft中心接続位置の位置関係)。写真では
ShaftがLower Arm根元でなく途中位置に接続しているように見えるため、Centerline Sweep
開始点の決定に直接影響する。**本v1.7も実測値の反映・形状分類の確定までであり、制御点
座標・Mesh生成には進まない**(shoji指定、`docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`
での追加実測待ち)。
**Date**: 2026-07-31(v1.7更新)
**位置づけ**: `docs/Soft_Clip_Geometry_Audit_v1.0.md`(G3-3、Phase 1 Completed・Phase 2 On
Hold)の後続。shoji指定の手順「①Soft Clip Geometry Interpretation → ②Geometry方式の決定 →
③Improvement Spec作成 → ④実装」の①にあたる。**本文書ではGeometry方式を決定しない**
(②は次文書)。FlatFootで1枚の画像から形状を推測し複数回手戻りが発生した反省を踏まえ、
10方向画像+実測値を統合したうえで、確信度の低い箇所は「要確認」として明示的に分離する。

---

## Executive Summary

1. shoji提供の**10方向画像**(真横・真上・前方/後方×左/右×上/下の斜め8方向)と**実測値**
   (Shaft下端・Shaft中腹・Band Loop断面)をすべて確認した。
2. **確信度が高い(Confirmed)**: Soft Clipは**段付きシャフト**(Shaft Lower実寸径8.0mm→
   Shaft Middle実寸径4.0mm、いずれも20倍模型の直接実測値。撮影スケール換算[÷20]では
   Shaft Lower 0.40mm→Shaft Middle 0.20mm、§1.2参照)+**Bridge**(T字接合部)+
   **Band Loop**(1本の帯状部材、実寸
   長さ約6.0〜7.5mm・幅0.25mm・厚さ0.10mm、ねじりなし、長辺方向に8箇所で前後へ波打つ
   ように成形され、**「『つ』字状一筆書きCenterlineを持つ開放型弾性クリップ」**
   (単純なC字リングでも蛇行したS字部品でもない、v1.6でshojiが精密化。§1.3-A参照)を
   形成)という構成である(shoji訂正・実測により確定、§4-1参照。**v1.0で「撮影用
   治具」と誤認していた太いクロム円柱は、実際にはShaft Lowerそのものであった**)。
   断面が円形ワイヤーではなく帯状(矩形に近い)であることもEvidence A(実測)+写真の
   両方で確認済み。この「つ」字形状自体がキヌタ骨長脚を保持するクリップ機構を構成
   している(Confirmed、§1.4参照)。
3. **臨床形状のOpen Questions(4.A)**: (a) Band Loop終端形状は**2026-07-31に
   Hook-like terminal(Evidence A、長さ約2.40mm)として確定**(4-2、旧Open Question
   から更新)。(b) 「8箇所での曲げ」が明確な折れ点(ポリライン的)か、緩やかな連続曲線
   かは、写真の解像度・反射のため視覚的には判別困難(shojiさんの直接観察・触感による
   情報を優先する、4-3)、Openのまま維持。(c) **新規・最重要**: Shaft接続位置
   (Lower Arm開始点・返し曲げ終端・Shaft中心接続位置の関係)がOpen(4-5、v1.7新規)。
   写真ではShaftがLower Arm根元でなく途中位置に接続しているように見え、Centerline
   Sweep開始点の決定に直接影響するため最優先で確認が必要。
4. **Pocket Geometry(Confirmed、v1.7新規、§1.5)**: Pocket Maximum Width(1.40mm)
   ≠ Arm Gap(0.75mm、Evidence A+)であることから、PocketはFunnel状(内部拡大型)の
   Geometryとして確定。Pocket Depth(3.30mm、Evidence A+)の定義も固定した。
5. **Geometry実装方式のOpen Question(4.B、v1.3新規追加)**: (d) Band Loopの形状生成を
   Centerlineベース(中心曲線+断面Sweep)とPlate deformationベース(平板+曲げ変形)の
   どちらで扱うか(4-4)。**4-4=Option A(Centerline Sweep)採用が決定済み**
   (Method Decision v1.4)。あわせて、Geometry方式を議論する前に「部品が何個で
   構成されるか」を定義する`Soft_Clip_Component_Tree_v1.0.md`を作成した(shoji提案、
   §8参照)。

---

## 1. Evidence一覧(統合対象)

### 1.1 画像(shoji提供、2026-07-30、20倍模型、計10方向)

| # | 方向 | ファイル | 確認結果 |
|---|---|---|---|
| 1 | 真横 | クリップ横２.jpg | シャフト(段付き)+ブリッジ+Band Loop(片方ループ端、片方フック端に見える)を側面から確認 |
| 2 | 真上 | クリップ上.jpg | 薄い帯状の輪(Band Loopの一つ)がエッジ方向に見える。shoji確認済み:
  「Soft Clip全体をシャフト軸方向(真上)から撮影」— 円形ワイヤーではなく帯状部材である
  ことのEvidence(§3参照) |
| 3 | 前方左斜め上 | 前方左斜め上から.jpg | Band Loopが左右両方向へ波状に曲がる様子を立体的に確認 |
| 4 | 前方右斜め上 | 前方右斜め上から.jpg | 同上、反対側から |
| 5 | 後方左斜め上 | 後方左斜め上から.jpg | 同上、後方視点 |
| 6 | 後方右斜め上 | 後方右斜め上から.jpg | 同上、後方視点・反対側 |
| 7 | 前方左斜め下 | 前方左斜め下から.jpg | Band Loop・ブリッジの下面(テーブル接地面側)を確認 |
| 8 | 前方右斜め下 | 前方右斜め下から.jpg | 同上 |
| 9 | 後方左斜め下 | 後方左斜め下から.jpg | 同上 |
| 10 | 後方右斜め下 | 後方右斜め下から.jpg | 同上 |

**確認方法の限界(明記)**: 10方向すべて確認したが、いずれも同一の物理サンプルを様々な
角度から撮影した2D写真であり、3Dスキャン・CADデータではない。重なり合う帯状部材の
前後関係・正確な曲げ角度・セグメント長は、写真の重ね合わせだけでは完全には再構成
できない(過去の教訓「写真からの3D姿勢推定でも外形の見え方だけで法線を断定しない」、
[[feedback]]参照)。

### 1.2 実測値(20倍模型、shoji、2026-07-30受領、`Soft_Clip_Geometry_Audit_v1.0.md` §10.1と同一)

**用語の分離(v1.2、shoji指摘)**: 以下の表の左列は20倍模型そのものを直接計測した
「実寸」であり、右列はそこから20倍の撮影・模型スケールで割り戻して算出した「換算値」
である。両者は性質が異なる(左=直接実測 Evidence A+、右=算出値)ため、本文書内では
必ず列名を明記して区別する。「実寸換算」のような直接実測値と換算値を同じ語に混在させる
表記は用いない。

| 部位 | 項目 | 実寸径・実寸長(20倍模型を直接実測、Evidence A+) | 撮影スケール換算(20×、実測値÷20の算出値) |
|---|---|---|---|
| Shaft 下端(Band Loop接合側) | 長さ | 43.4 mm | 2.17 mm |
| 〃 | 径 | 8.0 mm | 0.40 mm(半径0.20mm) |
| Shaft 中腹 | 長さ | 26.6 mm | 1.33 mm |
| 〃 | 径 | 4.0 mm | 0.20 mm(半径0.10mm) |
| Band Loop | 幅(断面長辺) | 5 mm | 0.25 mm |
| Band Loop | 厚さ(断面短辺) | 2.0 mm | 0.10 mm |

補足: 実物はShaft中腹の長さのみ8種類のラインナップがあり、Band Loop形状は共通(shoji確認済み)。

**Geometry設計への注記**: アプリ内3DモデルはKURZ座標系上で実寸(臨床スケール、mm)を
直接扱うため、Geometry実装で使用すべき数値は右列の「撮影スケール換算(20×)」値
(Shaft Lower径0.40mm・Shaft Middle径0.20mm等)である。左列の「実寸径・実寸長」
(8.0mm・4.0mm等)は20倍模型という物理サンプル自体の寸法であり、そのままGeometry
実装に用いてはならない(次工程②Geometry方式決定・③Improvement Specで再度明記する)。

### 1.3 Band Loop全体形状の見立て(shoji、2026-07-30受領、Evidence B。v1.4でシルエット
表現を訂正)

shojiさんが実物を手に取った上での見立てとして、以下の情報を追加受領した(数値化された
直接計測ではなく「見立て」として明示されているため、Evidence Aの断面寸法(§1.2)とは
区別してEvidence Bとして扱う)。

- **全長**: 約12〜15cm(20倍模型、実寸換算 約6.0〜7.5mm)
- **断面**: 幅5mm・厚さ2.0mm(20倍、§1.2のBand Loop断面と同一値)
- **ねじり**: なし(帯の断面の向きは長手方向に沿って一定、板が捩れていない)
- **曲げ**: 長辺方向に沿って**8箇所**で、前後方向(奥行き方向)へ波打つように成形
- **全体形状(v1.4訂正)**: 上記の成形の結果、**単純なC字リングではなく、「つ」字状の
  開口部を持つ弾性クリップ形状**を形成する。v1.3までは「大まかにC字状のシルエット」と
  記述していたが、shojiより「実物の機能を改めて考慮すると、C字リングではなく『つ』の
  形状に近い弾性クリップとして理解する方が正確」との訂正を受けた(2026-07-30)。この
  「つ」字形状自体がクリップ機構を構成している(詳細は§1.4)。

**重要な示唆**: この情報は、Band Loopが「シャフトから左右対称に伸びる2本の独立した
Wing」ではなく、**1本の連続した帯が8箇所で成形されて全体として「つ」字状のクリップ
形状を描いている**という可能性を示している。v1.0で「Wing A / Wing B」として記述した
左右の腕は、実際には同一の連続した帯の異なる区間である可能性がある。ただし、この1本の
帯が具体的にどのような経路(何個の終端フィーチャーを持つか等)を辿るかは、shoji指定の
通りOpen Questionのままとする(§4-2)。

### 1.3-A Centerlineトポロジーの精密化(shoji追加観察、2026-07-30受領、Evidence B、
新設v1.6)

shojiさんより、Band Loop全体形状についてさらに踏み込んだ観察を受領した(実物の機能を
改めて考慮した見立て、数値化された直接計測ではないためEvidence B)。

**重要な訂正点(v1.4/v1.5からの精密化、矛盾ではない)**:
- 単純な**C字リングではない**(v1.4で既出、維持)。
- **蛇行したS字部品という理解でもない**(新たに否定、v1.6)。
- 基本トポロジーは**「つ」字状の単一連続Centerline**(一筆書き)である。
- その腕部分(Upper Arm・Lower Arm)が、日光いろは坂のように**複数回(約3回)の
  主要カーブ**を描いている。
- Upper Arm・Lower Armが中央のPocket形成部を構成する(Component Tree v1.2 §2.1の
  区分と整合)。
- **下側先端(Lower Arm側)は、反転するような返し曲げ形状**に見える。

**正式なInterpretation表現(v1.6)**: **「『つ』字状一筆書きCenterlineを持つ開放型
弾性クリップ」**(英: *"Open elastic clip with a continuous TSU-like centerline
geometry"*)。

**旧表現との関係**: v1.4/v1.5で確立した「単純なC字リングではなく『つ』字状の開口部を
持つ弾性クリップ」という理解自体は誤りではないが、上記の観察はそのトポロジー(一筆書き
の単一連続曲線であること、腕部分に約3回の主要カーブがあること、下側先端に返し曲げ
形状があること)をより具体的に記述するものであり、v1.6として本文書の正式な表現とする。

**§1.2の「約8箇所の成形」との関係(要整理、未解消)**: §1.2・§1.3で記録済みの
「長辺方向に約8箇所で前後へ波打つように成形」という見立てと、本節の「約3回の主要
カーブ」という見立ての関係は、本文書内では確定的に整理できていない(細かい波打ち
8箇所のうち、大きな主要カーブが3回という粒度の違いである可能性が高いが、断定は
しない)。この点は4-3-1(正確な曲率)の確認時にあわせて確認することとする。

**Geometry設計への示唆(参考、④実装では未反映)**: Centerline Sweepの制御点は、
固定数(例: P0〜P3の4点)ではなく、以下の**機能的カテゴリを表現できる必要最小限の
点数**として扱う方針とする(§5-A参照)。

- Shaft接続部(Bridge側の起点)
- 主要曲率変化点(複数、当初の見立てでは約3回のカーブに対応)
- Pocket形成部
- 開口端(Upper Arm・Lower Armそれぞれの自由端)

**推測による制御点座標の入力は禁止**(shoji指定)。各点の正確な座標・曲率は未測定
(Unknown)であり、§4.Aの既存Open Question(4-2、4-3-1、4-3-2)の解消と合わせて
`docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`での追加実測を待つ。

### 1.4 クリップ機構(Confirmed、shoji説明2026-07-30、Evidence B — 実物操作に基づく
機能説明。新設v1.4)

shojiさん(ENT外科医)より、Band Loopの「つ」字形状が構成するクリップ機構について、
以下の機能説明を受領した。臨床的妥当性・教育的妥当性に直結する情報のため、Confirmed
として記録する(ただし正確な形状パラメータ[終端形状・曲率・弾性変形境界]は§4.A参照、
Open Questionのまま)。

**構造と静止状態**:
- 「つ」の上部と下部が中央方向へすぼまっている(=開口部が狭くなっている)ことで、
  中央の窪みに対象物(キヌタ骨長脚)が容易には入らない構造になっている。これが
  クリップの「閉じた」静止状態であり、把持力の源になっている。

**キヌタ骨長脚の挿入動作**:
1. 開放部(「つ」の開口側)から
2. 円柱状のキヌタ骨長脚に対して概ね垂直方向に挿入し
3. 「つ」の中央の窪みに長脚を収納する

**SOFTCLIPフック使用時のクリップ動作**:
1. 「つ」の後方にある弯曲部へフックを当てる
2. 前方へ押す
3. 長脚との接触圧によって上部が弾性変形して広がる
4. 長脚が中央の窪みに収納される

**Geometry設計への示唆(参考、②Geometry方式決定では未反映)**: 上記の機能から、
Band Loopは単なる静的な装飾形状ではなく、(a)開口部・中央の窪み・後方弯曲部という
機能的に異なる領域を持つこと、(b)少なくとも一部領域([上部]付近)は弾性変形する
ことを前提とした形状であることが分かる。これらの機能的区分と、正確な曲率・弾性変形
領域の境界は、§4.Aの新しいOpen Question(4-2、4-3)として維持する。

### 1.5 Pocket Geometry(Funnel状、Confirmed、Evidence A+。新設v1.7)

2026-07-31、shojiより以下の実測値を受領した(20倍模型、Evidence A+)。

| Parameter | 値 | Evidence | 定義/備考 |
|---|---:|:---:|---|
| Pocket Maximum Width | 1.40 mm | A+ | Pocket内部空間の最大幅 |
| Arm Gap(Opening) | 0.75 mm | A+ | Upper Arm–Lower Arm入口ギャップ |
| Pocket Depth | 3.30 mm | A+ | Upper Arm先端下面(Pocket入口の基準面)→Pocket最深部 |

**Pocket Maximum WidthとArm Gapは別Parameter(Confirmed)**: 1.40mm ≠ 0.75mmである
ため、両者を明確に分離する。
- **Pocket Maximum Width**: Upper Arm/Lower Armで囲まれた中央Pocket内部空間の最大幅。
- **Arm Gap**: Pocket入口の開口幅。

**Pocket形状の解釈(Confirmed)**: 入口幅(0.75mm)に対して内部最大幅(1.40mm)の方が
大きいため、Pocketは単純な平行隙間ではなく、

```
入口
 ↓
狭い開口(Arm Gap 0.75mm)
 ↓
内部で広がる空間
 ↓
最深部(Pocket Depth 3.30mm)
```

という**ファンネル状(内部拡大型)**のGeometryとして扱う。§1.4「開口部が狭く、
長脚が容易には入らない構造」というクリップ機構の説明、および§1.3-A「Pocket形成部」
という区分と整合する(「凹み空間」というInterpretationと一致)。

**Pocket Depth Definition(固定)**: 後から同じ測定が再現可能となるよう、以下に定義を
固定する。

> Distance from the underside of the Upper Arm tip (Pocket entrance reference
> plane) to the deepest point of the Pocket.

**Geometry設計への示唆(参考、④実装では未反映)**: Funnel状という形状特性上、
Centerline Sweepの断面Profile(§5参照)は開口部からPocket最深部にかけて一定ではなく、
Pocket形成部の制御点付近で断面(または周辺の壁面形状)が変化する可能性がある。ただし
具体的な制御点座標・断面変化の実装方法は本文書では確定しない(shoji指定、Measurement
Recordでの追加実測・Improvement Specでの整理を待つ)。

---

## 2. 部品構成(v1.1、shoji訂正を反映)

```
Band Loop(1本の連続した帯状部材、実寸長さ約6.0〜7.5mm、幅0.25mm×厚さ0.10mm、
          ねじりなし、8箇所で前後に波打つように成形され、「『つ』字状一筆書き
          Centerlineを持つ開放型弾性クリップ」を形成[単純なC字リングでも蛇行した
          S字部品でもない]。腕部分は約3回の主要カーブ、終端はHook-like terminal
          (約2.40mm、Evidence A、§4-2)。Upper Arm・Lower Armで囲まれるPocketは
          Arm Gap(入口0.75mm)≠Pocket Maximum Width(内部1.40mm)によりFunnel状
          [内部拡大型]、Pocket Depth 3.30mm(いずれもEvidence A+、§1.5)。
          v1.7精密化、§1.3/§1.3-A/§1.4/§1.5参照。**Shaft接続位置は未確定**[§4-5])
  ↓
Bridge(T字接合部、Band LoopとShaftを接合する起点)
  ↓
Shaft Middle(細径、撮影スケール換算[20×]で長さ1.33mm・径0.20mm[半径0.10mm]、
             実寸[20倍模型直接実測]は長さ26.6mm・径4.0mm。製品長により長さが変化する区間)
  ↓
Shaft Lower(太径、撮影スケール換算[20×]で長さ2.17mm・径0.40mm[半径0.20mm]、
             実寸[20倍模型直接実測]は長さ43.4mm・径8.0mm。Band Loop接合側の呼称だが
             Bridgeから見て遠位側に位置する。v1.0で「撮影用治具」と誤認していたが、
             Soft Clip本体の一部と訂正済み)
```

**寸法表記の注意(v1.2)**: 上記の「実寸長さ○○mm」という表記はv1.1まで撮影スケール
換算後の値(0.40mm等)を指していたが、これは§1.2の用語整理により「撮影スケール換算
(20×)」と呼ぶべき算出値であり、「実寸」ではない。20倍模型そのものの直接実測値
(8.0mm等)と区別するため、v1.2以降は「撮影スケール換算[20×]」と明記する。

**v1.0からの訂正点(重要)**: v1.0では写真に写る太いクロム円柱を「撮影・保持用の治具」
として要確認事項にしていたが、shojiさんより「これはSoft Clip本体の一部であり、
段付きシャフト(Shaft Middle径0.20mm→Shaft Lower径0.40mm)の一部」と訂正を受けた。
これにより§4-1は解消しConfirmedへ移行した(詳細は§4-1)。

**「Wing」という呼称について**: v1.0では左右に伸びる腕をそれぞれ「Wing A」「Wing B」
という独立した部品として記述したが、shojiさんの見立て(§1.3)により、これらは実際には
**1本の連続したBand Loopが8箇所で曲げられた結果、左右に腕が伸びているように見えている
だけ**という可能性が高い。したがって本文書ではv1.1より「Wing」という部品名を単独では
使わず、「Band Loop」という1つの連続部品として扱う。ただし、Band Loopの具体的な経路
(終端が何個あるか等)はOpen Questionのまま(§4-2)。

---

## 3. 断面形状(Confirmed、Evidence A + 写真での定性確認)

- **数値(Evidence A)**: Band Loop断面は幅0.25mm(長辺)×厚さ0.10mm(短辺)の帯状
  (矩形に近い断面)。円形ワイヤーではない。
- **写真での確認**: 「真上」写真(クリップ上.jpg)で、薄い帯状の部材がエッジ方向を
  向いた状態で写っており、3層(手前の縁・奥の縁・その間の厚み面)のように見える反射
  パターンが確認できる。これは「板厚方向を真上から見ている」という状態と整合し、
  円形ワイヤーであれば発生しない見え方である。**この写真自体が「円形ワイヤーではなく
  帯状部材である」ことの直接的なEvidenceになっている**(shoji指摘の通り)。
- **角の丸み(定性、Evidence B)**: マクロ写真での反射の滑らかさから、断面のエッジは
  完全な直角(シャープコーナー)ではなく、わずかに面取り・丸みがある可能性があるが、
  数値化はしていない(教育用Visual Geometryとして厳密再現が必要な精度かはPhase 2で
  判断)。

---

## 4. 要確認事項(Open Questions)

**v1.3でのカテゴリ分離(shoji指摘)**: 以下のOpen Questionsは性質が異なる2カテゴリに
分かれる。

- **4.A 臨床形状に関するOpen Questions**(4-2、4-3): 実物Soft Clipの形状そのものが
  まだ確定していない不確定点。Interpretation(①)段階の課題であり、Evidence(shojiの
  直接観察等)によってのみ解消できる。
- **4.B Geometry実装方式の検討事項**(4-4): 形状解釈が概ね確定した前提で、それを
  three.js上でどう実装するか(手法選択)という論点。Geometry方式決定(②)段階の
  課題であり、技術的なトレードオフ判断で進められる(Evidence待ちではない)。

4.Aが未解消の状態でも4.Bの検討・部分的な決定を進めることは可能だが、4.Aの回答内容
(特に4-3)は4.Bの最終選択に影響しうるため、4.Bの一部項目は4.Aの解消と連動して
確定する(詳細は各項目を参照)。

### 4-1. 太いクロム円柱の正体 — **解消済み(Confirmed、shoji訂正2026-07-30)**

v1.0では、10方向のうち「上斜め」4枚・「下斜め」4枚に写る太いクロム色の円柱
(端面に丸い白ラベルシールが貼付されている)について、「実物Shaftの一部」か「撮影用の
治具」か判断できないとして要確認事項にしていた。

**shoji訂正**: この太いクロム円柱は**撮影用治具ではなく、Soft Clip本体の一部**である。
Soft Clipは段付きシャフト構造になっており、

```
Band Loop → Bridge → Shaft Middle(径4.0mm、20倍) → Shaft Lower(径8.0mm、20倍)
```

という並び順が正しい。「Shaft下端(Band Loop接合側)」という命名は、Band Loopから見た
シャフト全体の遠位端(下端)を指す呼称であり、Bridgeに物理的に近接しているという意味
ではない(v1.0での「命名と写真上の位置関係が直感的に一致しない」という懸念は、命名の
基準を誤解していたことが原因だった)。**本項目はConfirmedとし、§2(部品構成)に反映
済み**。

### 4.A 臨床形状に関するOpen Questions

### 4-2. Band Loop終端部の正確な形状 — **Terminal Shape確定(Confirmed、Evidence A、
v1.7更新)**

v1.3までは「終端フィーチャーの数・対応関係」として、閉じたループ/開いたフックが
それぞれ何個あるかという観点で整理していた。v1.4のクリップ機構訂正(§1.4)を踏まえると、
Band Loopは「つ」字状の開口部を持つ1本の帯であり、機能的には開口部側の2つの先端
(自由端)の形状が特に重要になる。

**2026-07-31確定(shoji実測値受領)**: 候補(Simple Radius / Hook / Flat)のうち、
**Terminal Shape = Hook-like**として確定(Evidence A)。Terminal Length(フック部
長さ)は約2.40mm(Evidence A)。ただし完全なHook形状(閉じた鉤形状)ではないため、
Geometry分類上は**"Hook-like terminal"**という表現を維持する(単純な円弧フック関数
への安易な当てはめはしない)。

**追加観察(v1.6、shoji、Evidence B)との関係**: 下側先端(Lower Arm側)の「反転する
ような返し曲げ形状」という観察(§1.3-A)は、このHook-like terminalという分類と整合
する。ただし、この返し曲げ形状がShaft接続位置(§4-5、新規)とどう関係するか
(Lower Armの経路上のどこで返し曲げが起き、どこでShaftに接続するか)は、引き続き
Open Questionとして§4-5で扱う。

**残る確認事項(縮小)**: Terminal Shapeの大分類(Hook-like)は確定したが、フック部の
正確な曲率・開口方向はEvidence Bレベルにとどまる(4-3-1と関連)。座標配置には
`docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`での追加実測を要する場合がある。

### 4-3. 曲げ・弾性変形に関する不確定点(v1.4で「弾性変形領域の境界」を追加)

#### 4-3-1. 正確な曲率(旧: 曲げの性質 — 離散的な折れ点か連続的な曲線か)

shojiさんの説明「複数箇所で曲げ加工」「8箇所で前後に波打つように成形」は、離散的な
折れ点(ポリライン的な、直線区間の連続)を示唆しているが、写真上の反射・解像度からは、
滑らかな連続曲線なのか、明確な折れ点があるのかを視覚的に判別できていない。この点は
shojiさんの実物での直接観察・触感による情報を優先し、写真からの独自の判断はしない
こととする。

**確認依頼**: 実物を手に取った際、「明確に角度が変わる折れ点」として感じられますか、
それとも「なだらかに曲率が変化する曲線」に近いでしょうか(可能な範囲で、既存の
2026-07-02レポートで報告済みの情報があればそれを優先して構いません)。

#### 4-3-2. 弾性変形領域の境界(新規、v1.4追加、shoji指摘)

§1.4のクリップ機構によれば、SOFTCLIPフック使用時に「上部が弾性変形して広がる」動作が
発生する。しかし、帯のどの区間が弾性変形する領域で、どの区間が(相対的に)剛性の高い
形状保持領域なのかという境界は、写真・実測値のみでは確定できていない。

**確認依頼**: 実物を操作した際、弾性変形が生じるのは「つ」の上部・下部いずれか一方
だけか、両方か。またその変形領域は帯のどのあたり(全長のおおよそ何%程度の区間)に
及ぶか、可能な範囲で教えていただけますか(数値化できない場合は定性的な説明で構いません)。

### 4.B Geometry実装方式の検討事項

### 4-4. Band Loop Geometry Reference(新規追加、shoji指摘2026-07-30。Open Question、
現時点では決定しない)

**カテゴリ**: 4.B(実装方式選択の論点)。4-2・4-3(4.A、臨床形状の不確定点)とは性質が
異なり、「Band Loopが8箇所で成形された、単純なC字リングではなく『つ』字状の開口部を
持つ弾性クリップである」という形状解釈そのものは確定している前提で(v1.4、§1.3・
§1.4参照)、それをGeometry上どう表現するかという実装アプローチの選択肢。

Band Loopの形状生成基準として、以下の2方式が考えられる。

- **A. Centerlineベース**: 帯の中心を通る曲線(センターライン)をまず定義し、
  断面(幅0.25mm×厚さ0.10mm、§3参照)をその曲線に沿ってSweep(掃引)することで
  帯状の立体を生成する。
- **B. Plate deformationベース**: まず平坦な板状の帯(未変形の直方体・平面)を作成し、
  その後に曲げ変形(bend deformation)を適用して「つ」字状の最終形状を得る。

**現時点では決定しない(shoji指定)**。ただし、この選択は§5のGeometry方式候補
(候補A: ExtrudeGeometry+区分的直線パス、候補B: boxGeometryチェーン、候補C: 現行
TubeGeometry維持)よりも上位の、より根本的なパラダイム選択である。§5の候補A・Bは
いずれも本質的に「4-4のOption A(Centerlineベース)」に属する具体的な実装技法であり、
「4-4のOption B(Plate deformationベース)」は§5には含まれていない別パラダイムで
ある点に注意する。

**Geometry方式決定(②)への引き継ぎ**: 次ステップのGeometry方式決定では、この4-4の
選択を含めて判断する(shoji指定)。4-4自体の最終確定はshoji確認を待つが、4-4を含めた
検討・比較・暫定的な方向性の整理は②のステップで進める。

**決定済み(参考)**: 4-4は`Soft_Clip_Geometry_Method_Decision_v1.0.md`(v1.2以降)で
**Option A(Centerline Sweep)採用**として確定済み。

### 4-5. Shaft接続位置(新規、v1.7、4.A・現時点で残る最重要未確定項目)

**カテゴリ**: 4.A(臨床形状に関する不確定点)。Terminal Shape(4-2)がConfirmedへ
移行したことで、4.A(臨床形状)に残る主要な不確定点は本項目と4-3(曲げ・弾性変形)の
みとなった。

**内容**: Lower Arm**全長**に対して、以下3点の位置関係が未確定。

- Lower Arm開始点(Pocket形成部側の起点)
- 返し曲げ終端(Lower Arm自由端、Hook-like terminalの先端、§4-2参照)
- Shaft中心接続位置

**確認が必要な理由**: 10方向画像を確認する限り、Shaftは**Lower Arm根元ではなく途中
位置**に接続しているように見える。これは§5-A「Shaft接続部(Bridge側の起点)」という
制御点カテゴリの前提(Shaft接続部=Lower Armの端点の一つ、という暗黙の想定)を覆す
可能性があり、**Centerline Sweepの開始点(起点)そのものの決定に直接影響する**。

**確認依頼**: Lower Armの根元(Pocket形成部側の起点)から数えて、Shaftが接続する
位置はどのあたりか(実測距離、またはLower Arm全長に対するおおよその比率)。返し曲げ
終端(自由端)との位置関係もあわせて確認したい。詳細な依頼内容は
`docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md` §1-1-Aを参照。

**Geometry設計への影響(参考、④実装では未反映)**: 本項目が未解消の間は、§5-Aの
制御点カテゴリのうち「Shaft接続部」を、Lower Armの端点として単純に扱ってよいのか、
Lower Arm経路の途中の分岐点として扱うべきかが確定しない。Improvement Spec
(`Soft_Clip_Geometry_Improvement_Spec_v1.0.md`)では、本項目を制御点定義における
最優先のPending項目として扱う。

---

## 5. Geometry方式候補(未決定、次ステップ「②Geometry方式の決定」で確定)

**本セクションは候補の提示のみであり、方式を決定するものではない**(shoji指定の手順
②は本文書の対象外)。§4の要確認事項、特に4-3-1(離散的な折れ点か連続曲線か)の回答に
よって、以下の候補の妥当性が変わる。**v1.4の形状訂正(C字リング→「つ」字状クリップ、
§1.3・§1.4)により本セクションの候補自体は無効化されない**(いずれもパスに沿った
断面Sweepという点は変わらず、パス形状が「つ」字に変わるのみ)が、§1.4で新たに判明した
「弾性変形」という機能は、以下の候補(いずれも静的な形状生成手法)には未反映であり、
④実装段階で別途検討が必要になる可能性がある(4-3-2参照)。

**用語の精密化(v1.4、shoji指摘)**: 「Centerlineベース」「ExtrudeGeometry+区分的直線
パス」という表現は、一般的な「Centerline Sweep」と意味がずれる可能性があるため、
候補Aの技術的内容を以下のように明確化する。目的はGeometry方式の変更ではなく、後工程
(③Improvement Spec・④実装)で誤解が生じないための用語整理である。

- **候補Aが指す手順(正)**: (1)矩形の**2D断面Profile**(幅0.25mm×厚さ0.10mm、パスの
  進行方向に垂直な断面)を定義する。(2)複数の直線区間(bend点)を**1本の連続した
  3D Curve**(パス/センターライン)として結合する。(3)このCurveに沿って、断面
  Profileを**1回のExtrudeGeometry呼び出し(`extrudePath`オプション)で一括して掃引**
  し、単一の連続メッシュを生成する。区間ごとに個別のExtrude・配置を行うものではない。
- **候補Aが指さない手順(誤解しやすい例)**: 「2D輪郭(Profile)→厚み方向Extrude→
  区分的パス・制御点による配置」、すなわち区間ごとに個別のExtrude(または箱)を生成し、
  それらを制御点に沿って配置・結合する手順は、**候補B(boxGeometryの連結チェーン)と
  実質的に同じ**であり、候補Aの主要な利点(継ぎ目のない単一メッシュ、Frenetフレーム
  破綻の回避)を持たない。実装時にこの2つを混同しないこと。

### 5-A センターライン制御点数の扱い(v1.6追加、shoji指定)

§1.3-Aの追加観察(Centerlineは「つ」字状の一筆書き、腕部分に約3回の主要カーブ)を
踏まえ、候補A(Centerline Sweep)で使用する制御点は**固定数(例: P0〜P3の4点)として
扱わない**。代わりに、以下の機能的カテゴリを表現できる**必要最小限の点数**として
扱う方針とする。

- Shaft接続部(Bridge側の起点。**§4-5[Shaft接続位置]が未解消のため、この点をLower
  Armの端点として扱ってよいか、経路途中の分岐点として扱うべきかは未確定、v1.7**)
- 主要曲率変化点(複数、当初の見立てでは約3回のカーブに対応。正確な数は未確定)
- Pocket形成部(§1.5のFunnel状Geometryとして確定、v1.7)
- 開口端(Upper Arm・Lower Armそれぞれの自由端。Hook-like terminalとしてConfirmed、
  §4-2・v1.7)

制御点の実際の座標・個数は`docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`での
追加実測を待つ(推測による座標入力は禁止、shoji指定)。**特にShaft接続部の座標は
§4-5の確認が前提条件となる。**

| 候補 | 概要 | 長所 | 短所・リスク |
|---|---|---|---|
| A. Centerline Sweep(ExtrudeGeometry+extrudePath、単一の連続Curveに沿った断面
  Profileの一括掃引) | 矩形断面Profile(0.25×0.10mm)を、複数の直線区間を結合した
  1本のCurveに沿って**1回で**掃引する | 実測断面を厳密に再現できる。区分的直線パス
  なら各区間で一定のFrenetフレームを持てるため、2026-07-02に発生した「滑らかな急
  カーブでのFrenetフレーム破綻」問題を回避できる可能性が高い(4-3-1で「離散的な折れ点」
  が確認された場合に特に有効)。単一の連続メッシュになる | 実装がやや複雑。曲げ点で
  断面の向き(フレーム)を明示的に指定する必要がある |
  | B. 矩形プリズム(boxGeometry)の連結チェーン | 直線区間ごとに`boxGeometry`を
  個別に配置・回転し、端点を突き合わせて連結する | 実装が単純、Frenet frame問題が
  そもそも発生しない(1区間=1個の独立したbox) | 区間の継ぎ目(bend点)で隙間や
  めり込みが生じないよう、各boxの端点位置・回転を手計算で正確に合わせる必要がある。
  区間数が多いと管理が煩雑になる |
  | C. 現行TubeGeometry(円形近似)を維持 | 変更しない | 実装コスト0 | 断面が実測
  (矩形0.25×0.10mm)と食い違ったままになる。§3で確認した通り「真上から見ると
  帯状に見える」という実物の特徴的な見え方を再現できない |

**現時点の所見(判断ではなく整理)**: shojiさんの「複数箇所で曲げ加工」という説明が
文字通り離散的な折れ点を意味するなら、候補A・Bはどちらも2026-07-02の失敗(滑らかな
スプラインでのFrenetフレーム破綻)を回避できる可能性が高い。A/Bのどちらが実装・
保守性の観点で優れるかは、§4の要確認事項が解消してから判断する。

---

## 6. Next Step

1. ~~§4の残る要確認事項(4-2、4-3)をshojiさんに確認する(4-1はConfirmed済み)。~~
   shojiより「Interpretation・Component Treeの整理は問題なし、②Geometry方式決定へ
   進んでよい」と確認済み(2026-07-30)。ただし4.A(臨床形状)は未解消のまま維持
   (v1.4でBand Loop全体形状をC字リングから「つ」字状クリップへ訂正し、4-2[終端部の
   正確な形状]・4-3-1[正確な曲率]・4-3-2[弾性変形領域の境界、新規]の3点が対象)。
2. ~~`docs/Soft_Clip_Component_Tree_v1.0.md`(§8参照)で部品の個数・階層をあわせて
   確認する。~~ 完了(Component Tree v1.1、Connection=Anchor/Coordinate Definition
   としてConfirmed、Geometry責務列追加)。
3. ~~shoji指定の手順②「Geometry方式の決定」に進む。~~ 完了(Method Decision v1.3、
   4-4=Centerline Sweep採用)。v1.6の追加観察はshoji確認済みで「現在のCenterline
   Sweep採用判断はこの『つ』字状一筆書き形状Interpretationと整合している」ため、
   Method Decision文書の決定内容自体の再検討は不要(shoji明言)。
4. ~~③Soft Clip Geometry Improvement Spec作成に進む。~~ 完了
   (`Soft_Clip_Geometry_Improvement_Spec_v1.0.md`)。v1.6の追加観察を反映して
   Confirmed/Pendingの記述を更新する(制御点数の柔軟化、Pocket最大幅/Arm間距離/
   Pocket深さの分離、最大開口方向のEvidence B定性記録化)。**制御点座標・Mesh生成には
   進まない**(shoji指定)。
5. ~~`docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`もv1.6の観察にあわせて
   更新し、shoji記入待ち。~~ 完了。2026-07-31、Pocket Maximum Width・Arm Gap・
   Pocket Depth・Terminal Shape・Terminal Lengthの実測値を受領しv1.7へ反映
   (§1.5・§4-2)。**現時点で残る最重要未確定項目はShaft接続位置(§4-5、新規)**。
6. 次はshojiによる`docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md` §1-1-A
   (Shaft接続位置)の記入待ち。解消後、Improvement Spec上でCenterline Parameter
   Definition(制御点の具体的な座標定義)へ進む。
7. **現時点ではコード変更を行わない**(制御点座標設定・Mesh実装は未着手のまま)。

## 7. 参照文書

- `docs/Soft_Clip_Geometry_Audit_v1.0.md`(G3-3、Phase 1 Completed・Phase 2 On Hold、
  提案A/B/Cの出典)
- `docs/Soft_Clip_Component_Tree_v1.0.md`(§8、部品構成・階層の定義。Geometry方式決定
  前の前提として本文書と対で参照する)
- `docs/Soft_Clip_Geometry_Method_Decision_v1.0.md`(②Geometry方式決定。4-4=
  Centerline Sweep採用、v1.6のトポロジー精密化と整合済み)
- `docs/Soft_Clip_Geometry_Improvement_Spec_v1.0.md`(v1.2、③、Confirmed/Pendingの
  分離。v1.7[Pocket Geometry確定・Terminal Shape確定・Shaft接続位置]を反映)
- `docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`(v1.2、追加実測依頼テンプレート。
  §1-1-A[Shaft接続位置]が現時点の最優先依頼事項)
- `docs/FlatFoot_Geometry_Improvement_Spec_v1.0.md`(§8.0、Frenet frame破綻の経緯・
  過剰なCAD再現の反省点の出典)
- `src/scenes/models/ProsthesisModels.tsx`(`SoftClipHead`:437、`SoftClipStem`:428、
  `SoftClipBridge`:409、`SoftClipWing`:384、`CLIP_WIRE_R`/`CLIP_STEM_H`:379,382 —
  いずれも現行コードの変数名であり、本文書§2の解釈上の部品名(Band Loop等)とは
  1対1に対応しない可能性がある点に注意)

## 8. Component Tree(別文書)

Geometry方式を議論する前に、部品が何個で構成されるかを明確化するため
`docs/Soft_Clip_Component_Tree_v1.0.md`を別文書として作成した(shoji提案、2026-07-30)。
本文書(Interpretation)が「形状の意味・由来」を扱うのに対し、Component Treeは
「部品の個数・階層・命名」を定義する。両文書はセットでGeometry方式決定の前提となる。
