# Soft Clip Geometry Improvement Specification v1.0

**Status**: Draft(shoji確認待ち)。**Confirmed事項の整理のみ、コード変更・制御点配置・
Mesh実装は行っていない**(shoji指定)。
**Date**: 2026-07-31(v1.2更新)
**v1.2での変更点(shoji実測値受領、2026-07-31)**: Pocket Maximum Width(1.40mm)・
Arm Gap/Opening(0.75mm)・Pocket Depth(3.30mm)・Terminal Shape(Hook-like)・
Terminal Length(約2.40mm)がEvidence A/A+として確定(Interpretation v1.7 §1.5・
§4-2)。①これらを**§2(Pending)から§1(Confirmed)へ移動**(新設§1.4 Pocket
Geometry、§1.5 Terminal Shape)。②新規に判明した**最重要未確定項目「Shaft接続位置」**
(Lower Arm開始点・返し曲げ終端・Shaft中心接続位置の関係)を§2.1(制御点位置)の
最優先Pendingとして明記(Interpretation v1.7 §4-5に対応)。③新設**§0 Geometry
実装条件確認**で、Evidence A/A+が揃った項目と、Centerline Sweep実装(④)前に残る
ブロッカーを明示。**本v1.2はEvidence反映とConfirmed/Pending区分の更新までであり、
Centerline Parameter Definition(制御点の具体的な座標定義)・Mesh実装には進んでいない**
(shoji指定の作業フロー「Measurement Record → Centerline Parameter Definition →
Improvement Spec最終版 → Centerline Sweep実装」のうち、本文書は最初のステップの
反映にとどまる)。
**位置づけ**: shoji指定の手順「①Soft Clip Geometry Interpretation → ②Geometry方式の
決定 → ③Improvement Spec作成 → ④実装」の③にあたる。前提文書は
`Soft_Clip_Geometry_Interpretation_v1.0.md`(v1.7)・`Soft_Clip_Component_Tree_v1.0.md`
(v1.2)・`Soft_Clip_Geometry_Method_Decision_v1.0.md`(v1.4)。三文書の内容はshoji確認済み
のため再掲しない(差分のみ扱う、Token Efficiency方針)。

**本文書の役割(shoji指定)**: Confirmed(実装に着手してよい確定事項)とPending(未確定、
Evidence整理が必要な事項)を明確に分離する。**Pending項目について、推測による制御点
配置・Mesh実装には進まない**。写真・実物情報から現在のEvidenceレベルを整理し、
不足している情報と次のアクションを明示する。

---

## Executive Summary

| 区分 | 項目 |
|---|---|
| **Confirmed** | Geometry方式(Centerline Sweep)/ Profile定義(幅・厚さ)/ Shaft・Bridge・Band Loopの構造 / **Pocket Geometry(Funnel状、Arm Gap 0.75mm・Pocket Maximum Width 1.40mm・Pocket Depth 3.30mm、v1.2)** / **Terminal Shape(Hook-like terminal、約2.40mm、v1.2)** |
| **Pending** | **Shaft接続位置(v1.2新規・最重要)** / Band Loop制御点位置(主要曲率変化点等、機能的カテゴリで表現) / Upper Arm・Lower Armの具体的角度 / Rear Flex Regionの曲率 |

v1.2でPending項目数は7項目から4項目へ縮小した。残るPendingのうち**Shaft接続位置が
唯一の最優先ブロッカー**であり、これが解消すればCenterline Sweepの制御点定義
(Centerline Parameter Definition)に着手できる見込み(§0参照)。

---

## 0. Geometry実装条件確認(新設v1.2)

Centerline Sweep実装(④)に向けて、現時点でのEvidence充足状況を整理する。

**Evidence A/A+として十分揃っている項目(実装準備完了)**:

| 項目 | 値 | Evidence |
|---|---:|:---:|
| Band cross section(Band Loop断面) | 幅0.25mm × 厚さ0.10mm | A |
| Pocket opening(Arm Gap) | 0.75 mm | A+ |
| Pocket maximum width | 1.40 mm | A+ |
| Pocket depth | 3.30 mm | A+ |
| Terminal shape | Hook-like terminal | A |
| Terminal length | 約2.40 mm | A |

**実装前に残る確認事項(2点)**:

1. **Shaft接続位置(最重要・未確定)**: Lower Arm開始点・返し曲げ終端・Shaft中心接続
   位置の位置関係(§2.1参照)。写真からShaftはLower Arm根元ではなく途中位置に接続
   しているため、Centerline Sweep**開始点**の決定に影響する。
2. **Centerline制御点定義**: Measurementではなく設計パラメータとして、Centerline
   開始点・Arm方向・Pocket形成部の曲率制御点・Hook-like terminalへの遷移点を定義する
   必要がある。**これは次のステップ(Centerline Parameter Definition)で扱う内容で
   あり、本文書(v1.2)ではまだ着手していない**。

**現時点の判断**: Pocket・Terminal関連の主要寸法はEvidence A/A+で揃ったが、
Shaft接続位置が未確定のままCenterline Sweepの起点を決めることはできない。
**次の作業は、shojiによる`docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`
§1-1-A(Shaft接続位置)の記入を待ってから、Centerline Parameter Definitionへ進む**
(推測によるShaft接続位置の仮置きは行わない、shoji指定)。

---

## 1. Confirmed(実装に着手してよい確定事項)

### 1.1 Geometry方式: Centerline Sweep

`Soft_Clip_Geometry_Method_Decision_v1.0.md`(v1.4)§3.2で決定済み(4-4 = Option A)。
正確な手順(v1.3で用語精密化済み、v1.4でInterpretation v1.6との整合をshoji確認済み、
再掲は最小限):

1. 2D断面Profileを定義する(§1.2)。
2. 複数の直線区間を1本の連続3D Curve(センターライン)として結合する。
3. そのCurveに沿って、断面Profileを1回のExtrudeGeometry呼び出し(`extrudePath`)で
   一括して掃引し、単一の連続メッシュを生成する。

区間ごとに個別Extrude・配置する手法(候補B相当)は採用しない(Method Decision v1.4
§3.3「誤解しやすい別解釈」参照)。

### 1.2 Profile定義(幅・厚さ)

Geometry実装で使用すべき値は撮影スケール換算(20×)後の値(Interpretation v1.6 §1.2
の用語整理に従う。20倍模型を直接実測した「実寸径」ではない)。

| 部位 | 断面 | 値 | Evidence |
|---|---|---|---|
| Band Loop | 幅(長辺)×厚さ(短辺) | 0.25mm × 0.10mm | A(実測+確立済みの20×換算) |
| Shaft Lower | 径(半径) | 0.40mm(半径0.20mm) | A+(実測+換算) |
| Shaft Middle | 径(半径) | 0.20mm(半径0.10mm) | A+(実測+換算) |

Band Loopの断面が矩形(帯状)であり円形ワイヤーでないことはEvidence A(実測)+写真
(「真上」画像)の両方でConfirmed(Interpretation §3)。

### 1.3 Shaft / Bridge / Band Loopの構造(Component Tree v1.2)

- **大分類4部品**(Shaft Lower / Shaft Middle / Bridge / Band Loop)がConfirmed。
- **Shaft Lower/Middle**: CylinderGeometry ×2、同軸接続(Method Decision v1.4 §1、
  Decided)。
- **Bridge**: 存在・役割(Shaft MiddleとBand Loopを接合するTransition Surface)は
  Confirmed。**詳細形状・寸法はPending**(Evidence不足、§2では扱わない。理由は本文書
  スコープ外の既存Pending事項であり、Method Decision v1.4 §2で継続管理)。
- **Band Loop全体形状**: 「『つ』字状一筆書きCenterlineを持つ開放型弾性クリップ」
  (単純なC字リングでも蛇行したS字部品でもない。腕部分[Upper Arm・Lower Arm]は約3回の
  主要カーブを描き、下側先端は返し曲げ形状。Interpretation v1.6 §1.3-A、Confirmed
  [Evidence B、shoji追加観察]。正確な曲率・座標はPending、§2)。
- **Band Loopの論理的サブ構造**(Mesh分割ではない、Component Tree v1.2 §2.1):
  Upper Arm / Lower Arm / Central Pocket / Rear Flex Regionの4区分がConfirmed
  (機能区分として存在することは確定、各区分の正確な範囲・寸法はPending、§2)。
- **クリップ機構**(Interpretation v1.4 §1.4、Confirmed、Evidence B — shoji=ENT外科医
  による機能説明): 静止時は上下がすぼまり長脚が入りにくい構造、開放部から長脚を垂直
  挿入、SOFTCLIPフックで後方の弯曲部(Rear Flex Region)を押すと上部が弾性変形して
  広がり長脚が中央の窪みに収納される。
- **Central Pocketの分類**: 「穴」ではなく「開口部側が開いた凹み」(Method Decision
  v1.4 §3.3、クリップ機構[Evidence B]からの論理的帰結としてConfirmed)。

### 1.4 Pocket Geometry(Funnel状、v1.2新規、Evidence A+)

`Soft_Clip_Geometry_Interpretation_v1.0.md`(v1.7)§1.5で確定。

| Parameter | 値 | Evidence | 定義 |
|---|---:|:---:|---|
| Pocket Maximum Width | 1.40 mm | A+ | Pocket内部空間の最大幅 |
| Arm Gap(Opening) | 0.75 mm | A+ | Upper Arm–Lower Arm入口ギャップ |
| Pocket Depth | 3.30 mm | A+ | Upper Arm先端下面(Pocket入口の基準面)→Pocket最深部 |

Pocket Maximum Width(1.40mm)≠Arm Gap(0.75mm)であるため、Pocketは単純な平行隙間
ではなく、**入口(狭い開口)→内部で広がる空間→最深部**という**ファンネル状(内部
拡大型)**のGeometryとして確定(Confirmed)。「凹み空間」というInterpretation(§1.3)
と一致する。

### 1.5 Terminal Shape(Hook-like terminal、v1.2新規、Evidence A)

`Soft_Clip_Geometry_Interpretation_v1.0.md`(v1.7)§4-2で確定。

| 項目 | 値 | Evidence |
|---|---:|:---:|
| Terminal Shape | Hook-like terminal | A |
| Terminal Length | 約2.40 mm | A |

候補(Simple Radius / Hook / Flat)のうちHook-likeとして確定したが、**完全なHook
形状ではない**ため、Geometry分類上は"Hook-like terminal"という表現を維持する
(単純な円弧フック関数への安易な当てはめはしない)。下側先端(Lower Arm側)の
「反転するような返し曲げ形状」(Interpretation §1.3-A、Evidence B)と整合する。

---

## 2. Pending(未確定、Evidenceレベルの整理)

Evidence階層は本プロジェクトの標準(`[[feedback]]`): **A+(実物直接計測)/ A(画像計測・
較正済み)/ B(写真観察・機能説明等の定性情報)/ C(推定)/ Unknown(情報なし)**。

### 2.1 Band Loop制御点位置(v1.2更新: Shaft接続位置を最優先Pendingとして明記)

- **最優先Pending(v1.2新規)**: **Shaft接続位置**(Interpretation v1.7 §4-5)。
  Lower Arm開始点・返し曲げ終端・Shaft中心接続位置の位置関係が未確定。写真からShaftは
  Lower Arm根元ではなく途中位置に接続しているように見えるため、Centerline Sweepの
  **開始点**の決定に直接影響する。他の制御点カテゴリより優先して確認が必要
  (`docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md` §1-1-A)。
- **関連Open Question**: Interpretation v1.7 §4-5(Shaft接続位置、新規最重要)・
  4-3-1(正確な曲率)。4-2(終端部の正確な形状)はv1.7でTerminal Shape=Hook-like
  terminalとしてConfirmedへ移行済み(§1.5参照)。
- **制御点の扱い方(v1.1更新、Interpretation §5-A準拠)**: 固定数(P0〜P3等)では
  なく、以下の**機能的カテゴリを表現できる必要最小限の点数**として扱う。
  - Shaft接続部(Bridge側の起点。**§4-5が未解消のため、Lower Armの端点として扱って
    よいか経路途中の分岐点として扱うべきかは未確定、v1.2**)
  - 主要曲率変化点(複数。Interpretation §1.3-Aの見立てでは約3回のカーブに対応)
  - Pocket形成部(Funnel状Geometryとして確定済み、§1.4参照)
  - 開口端(Upper Arm・Lower Armそれぞれの自由端。Hook-like terminalとして確定済み、
    §1.5参照)
- **現在のEvidence**:
  - Evidence B: shoji見立て(Interpretation §1.3)により、全長約6.0〜7.5mm、長辺方向
    に**約8箇所**で前後に成形、という定性的な回数・全長の情報はある。
  - Evidence B: Interpretation §1.3-Aの追加観察により、基本トポロジーは「つ」字状の
    単一連続Centerline(一筆書き)であり、腕部分に**約3回の主要カーブ**、下側先端に
    **返し曲げ形状**があるという、より具体的な見立てを受領した。
  - **未整理の関係**: 「約8箇所の成形」(§1.2/§1.3)と「約3回の主要カーブ」
    (§1.3-A)の粒度の違いは本文書でも確定的に整理していない(Interpretation
    §1.3-A参照、4-3-1確認時にあわせて確認)。
  - Evidence B: 10方向画像(Interpretation §1.1)により、Band Loopが立体的にどう
    波打つかを視覚的に確認できるが、写真の重なり・反射により正確な3D座標の再構成は
    できない(Interpretation §1.1「確認方法の限界」参照)。
- **不足している情報**: 各制御点(Shaft接続部・主要曲率変化点・Pocket形成部・開口端)
  の3D座標の実測値。回数・カテゴリの見立てはあるが、各点の正確な位置・角度を示す数値
  ではない。
- **次のアクション**: `docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`での追加
  実測、または4-2・4-3-1のshoji確認が必要。**本文書では制御点座標を決定・提案しない**
  (推測による座標入力は禁止、shoji指定)。

### 2.2「つ」字形状の開口寸法 — **RESOLVED(v1.2、§1.4参照)**

Arm Gap(Opening)= 0.75mm(Evidence A+)として確定。最大開口方向はEvidence B定性
記録(「装着時にUpper/Lower Arm間が広がる方向」)のまま確定として扱う(shoji指定、
数値化不要)。詳細は§1.4「Pocket Geometry」参照。**本節はv1.2でConfirmedへ統合済み**。

### 2.3 Central Pocket関連Parameter — **RESOLVED(v1.2、§1.4参照)**

Pocket最大幅(1.40mm)・Pocket深さ(3.30mm)・Arm間距離(0.75mm、= Arm Gap)を
Evidence A+として受領し、目的が異なる別Parameterとして確定(shoji指定の分離方針を
維持)。Pocket Depth Definitionも固定した(§1.4・Measurement Record §0参照)。
**本節はv1.2でConfirmedへ統合済み**。

収納対象であるキヌタ骨長脚の径との関係(挿入後にどの程度の余裕があるか等)は引き続き
定量値なし(Unknown、本文書のスコープ外)。

### 2.4 Upper Arm / Lower Armの具体的角度

- **関連Open Question**: Interpretation v1.6 §4-3-2(弾性変形領域の境界)と部分的に
  関連(Upper/Lower Armどちらが変形するかという論点を含むため)。
- **現在のEvidence**:
  - Evidence B: shojiの説明「上部が弾性変形して広がる」(§1.4)から、Upper Armが
    Lower Armより弾性変形する可能性が高いという**示唆**はあるが、Component Tree v1.2
    §2.1で「Lower Armは相対的に剛性が高い可能性があるが未確認」と明記した通り、
    確定情報ではない。
- **不足している情報**: 静止状態でのUpper Arm・Lower Armそれぞれの角度(Rear Flex
  Regionまたはシャフト軸からの角度)の実測値はUnknown。Upper/Lower間の非対称性
  (どちらがどれだけ変形するか)も未確認。
- **次のアクション**: shoji確認(実物操作時の角度・非対称性の有無)。

### 2.5 Rear Flex Regionの曲率

- **関連Open Question**: Interpretation v1.6 §4-3-1(正確な曲率)・4-3-2(弾性変形
  領域の境界)に直接対応(既存のOpen Questionそのもの)。
- **現在のEvidence**:
  - Evidence B: 写真上の反射・解像度からは、離散的な折れ点か連続的な曲線かを判別
    できていない(Interpretation §4-3-1)。弾性変形領域がどこまで及ぶかも未確認
    (§4-3-2)。
- **不足している情報**: 正確な曲率(数値)、変形領域の境界位置、いずれもUnknown。
- **次のアクション**: shoji確認依頼はInterpretation §4-3-1・4-3-2に既出(実物での
  直接観察・触感を優先する方針)。本文書では追加の確認依頼を重複させない。

### 2.6 Pendingサマリ(v1.2更新: 4項目に縮小)

未確定として残る項目(2026-07-31時点): **Shaft接続位置(新規最重要)**/各カーブの
正確な曲率/Arm角度/Rear Flex Region境界。開口寸法・Pocket最大幅・Pocket深さ・
Terminal Shape/Lengthはv1.2でConfirmedへ移行済み(§1.4・§1.5)。

| 項目 | 現在のEvidenceレベル | 次のアクション |
|---|---|---|
| **Shaft接続位置**(v1.2新規) | Unknown(写真からLower Arm根元でなく途中接続に見えるという示唆のみ) | 最優先で追加実測(Measurement Record §1-1-A) |
| Band Loop制御点位置(主要曲率変化点等) | B(回数・全長・トポロジーの見立てのみ) | 追加実測(Measurement Record)または4-3-1のshoji確認 |
| Upper Arm/Lower Armの具体的角度 | B(示唆のみ、非対称性は未確認) | shoji確認(4-3-2と連動) |
| Rear Flex Regionの曲率 | B(既存Open Question) | Interpretation §4-3-1/4-3-2の確認待ち(重複依頼なし) |

### 2.7 優先順位(v1.2更新)

Pending4項目は重要度が異なるため、追加実測・確認は以下の優先順位で進める。

| 優先度 | 項目 | 理由 |
|---|---|---|
| ★★★★★ | **Shaft接続位置(§2.1、v1.2新規)** | Centerline Sweepの**開始点**そのものが確定しない。他のPending項目より優先 |
| ★★★★★ | Band Loop制御点位置(その他、§2.1) | 主要曲率変化点等、Meshそのものが生成できない |
| ★★★☆☆ | Upper Arm/Lower Armの具体的角度(§2.4) | 制御点(§2.1)が決まれば後から調整可能 |
| ★★☆☆☆ | Rear Flex Regionの曲率(§2.5) | 現在のSimulatorの目的は静的教育モデル・配置理解が主であり、物理的な弾性変形の再現は行わない方針(§1.1、Method Decision v1.4 §3.3)のため後回し可 |

「つ」字開口寸法・Central Pocket形状・Terminal Shapeはv1.2でConfirmedへ移行したため
優先順位表から除外した(§1.4・§1.5参照)。

追加実測依頼テンプレートは`docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`
(v1.2)として維持している。「全項目を測る」ことを目的とせず、Centerline Sweep生成に
必要な最小限のParameter取得に絞る方針は継続(現時点の最優先はShaft接続位置
[§1-1-A]のみ)。

---

## 3. Non-goals(本文書で行わないこと、明記)

- **制御点の座標配置(Centerline Parameter Definition)**: §2の4項目、特にShaft接続
  位置がPendingのため、具体的な数値・座標は本文書では一切提案しない(shoji指定)。
  これは次のステップとして別途着手する。
- **Mesh実装・コード変更**: 本文書はSpecの整理のみ。④実装は別ステップ。
- **Bridgeの詳細形状決定**: Method Decision v1.4 §2で既にPending(Evidence不足)と
  整理済みであり、本文書のスコープ(Band Loop中心のConfirmed/Pending整理)には
  含めない。
- **Rear Flex Regionの動的変形(アニメーション)実装**: Method Decision v1.4 §3.3
  「将来拡張候補」として整理済み、現時点の要件外(変更なし)。

---

## 4. Next Step

1. ~~§2.6のPending項目について、shojiに確認を依頼する。~~ shoji優先順位付け(§2.7)を
   反映。
2. ~~追加実測が必要と判断された場合、FlatFootのG3-1.5と同様の測定依頼テンプレートの
   作成を検討する。~~ 完了。`docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`を
   作成した。
3. ~~shojiの記入完了後、Evidence A(またはA+)として本文書§2へ反映する。~~
   **一部完了(v1.2)**: Pocket関連4項目・Terminal Shape/Lengthを§1.4・§1.5へ
   反映済み。**残るShaft接続位置の記入待ち**(Measurement Record §1-1-A)。
4. Shaft接続位置が確定次第、**Centerline Parameter Definition**(制御点の具体的な
   座標定義: Centerline開始点・Arm方向・Pocket形成部の曲率制御点・Hook-like
   terminalへの遷移点)へ進む。これは本文書の次のステップであり、**まだ着手していない**。
5. Centerline Parameter Definition完了後、本Improvement Specの最終版を作成し、
   Centerline Sweep実装(④)へ進む。
6. **現時点ではコード変更を行わない**(制御点座標設定・Mesh実装は未着手のまま)。

## 5. 参照文書

- `docs/Soft_Clip_Geometry_Interpretation_v1.0.md`(v1.7、①Interpretation。§1.5
  [Pocket Geometry確定]・§4-2[Terminal Shape確定]・§4-5[Shaft接続位置、新規]・
  §1.4クリップ機構の出典)
- `docs/Soft_Clip_Component_Tree_v1.0.md`(v1.2、§2.1論理的サブ構造の出典)
- `docs/Soft_Clip_Geometry_Method_Decision_v1.0.md`(v1.4、②4-4決定[Centerline Sweep]・
  Central Pocket分類の出典)
- `docs/Soft_Clip_Geometry_Audit_v1.0.md`(G3-3、Phase 1 Completed・Phase 2 On Hold)
- `docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`(v1.2、§1-1-A[Shaft接続位置]が
  現時点の最優先依頼事項)
- `docs/FlatFoot_Measurement_Record_v1.0.md`(テンプレート形式の参考元)
- `src/scenes/models/ProsthesisModels.tsx`(`SoftClipHead`:437、`SoftClipStem`:428、
  `SoftClipBridge`:409、`SoftClipWing`:384、`ProsthesisModel`シャフト計算部 — 現行
  コードとの対応はComponent Tree v1.2 §4参照)
