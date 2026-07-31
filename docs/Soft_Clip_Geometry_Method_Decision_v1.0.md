# Soft Clip Geometry Method Decision v1.0

**Status**: Draft(shoji確認待ち)。**コード変更は行っていない(方式の決定まで完了、
Mesh分割の具体的パラメータ・実装コードは未着手)**。
**Date**: 2026-07-30(v1.4更新)
**v1.4での変更点(shoji確認、2026-07-30)**: Interpretation v1.6でBand Loop全体形状の
トポロジーがさらに精密化された(「『つ』字状一筆書きCenterlineを持つ開放型弾性
クリップ」、腕部分に約3回の主要カーブ、下側先端に返し曲げ形状)。shojiより**「現在の
Centerline Sweep採用判断は、この『つ』字状一筆書き形状Interpretationと整合している」**
と確認済みであり、**本文書の決定内容(4-4=Option A採用)自体の変更はない**。センター
ラインの制御点は固定数(P0〜P3等)ではなく機能的カテゴリ(Shaft接続部・主要曲率変化点・
Pocket形成部・開口端)で表現する方針をInterpretation v1.6 §5-Aで整理済み、本文書§3.3
「Option A内の具体技法」もこの方針と整合する(修正不要)。
**v1.3での変更点(shoji指摘、2026-07-30)**: Option Aの名称・技術的定義を精密化。
旧v1.2までの「Centerlineベース」「ExtrudeGeometry+区分的直線パス」という表現が一般的な
「Centerline Sweep」と意味がずれる可能性があるため、正式名称を**「Centerline Sweep」**
とし、正確な手順を明記: (1)2D断面Profile(幅0.25mm×厚さ0.10mm)を定義、(2)複数の
直線区間を**1本の連続Curve**として結合、(3)そのCurveに沿って**1回のExtrudeGeometry
呼び出し(`extrudePath`)で断面Profileを一括掃引**し単一メッシュを生成。誤解しやすい
別解釈(「2D輪郭→厚み方向Extrude→区分的パス・制御点による配置」=区間ごとに個別
Extrude・配置)は**候補B(boxGeometryチェーン)と実質的に同じ**であり、Option Aが
選ばれた理由(単一の連続メッシュ、継ぎ目なし)を満たさないことを明記した。**4-4の
決定内容(Option A採用)自体に変更はない**、用語整理のみ(shoji指定)。
**v1.2での変更点(shoji指示、2026-07-30)**: shoji承認「Component Tree v1.2の論理構造は
問題なし、Geometry方式決定へ進んでよい」を受け、評価軸を「見た目の再現」ではなく
**「クリップ機構の理解可能性」**中心に再設定(新設§3.0、shoji指定の5項目高重要度+
Mesh数低重要度)。この評価軸に基づき**Band Loopの4-4を決定**: **Option A
(Centerline Sweep)を採用**(§3.2)。あわせてCentral Pocketは「穴」ではなく「凹み
(開口部側が開いた空間)」であることを明確化。Rear Flex Regionは静的形状+区分ラベル
(色分け等)で概念表現し、実際の弾性変形シミュレーションは今回の決定範囲外(将来
拡張候補として整理)。**Mesh分割の具体的パラメータ(セグメント数・正確な曲率等)は
4-2/4-3-1/4-3-2の解消後、③Improvement Specで確定する**(shoji指定、パラダイム決定と
詳細パラメータ決定は分離)。
**v1.1での変更点(shoji指示、2026-07-30)**: §3(Band Loop)をInterpretation v1.4
(Band Loop全体形状「単純なC字リング」→「『つ』字状の開口部を持つ弾性クリップ」への
訂正、クリップ機構Confirmed)およびComponent Tree v1.2 §2.1(Upper Arm/Lower
Arm/Central Pocket/Rear Flex Regionという論理的サブ構造、Mesh分割ではない)を反映して
更新した。Shaft Lower/Middle(Decided)・Bridge(Pending)はBand Loop形状訂正の影響を
受けないため変更なし。
**位置づけ**: shoji指定の手順「①Soft Clip Geometry Interpretation → ②Geometry方式の
決定 → ③Improvement Spec作成 → ④実装」の②にあたる。前提文書は
`Soft_Clip_Geometry_Interpretation_v1.0.md`(v1.6)・`Soft_Clip_Component_Tree_v1.0.md`
(v1.2)。両文書の内容はshoji確認済みのため再掲しない(差分のみ扱う、Token Efficiency
方針)。

**Open Questionsのカテゴリ区別(Interpretation v1.3で確立、v1.4で項目更新)**: 本文書
では以下を区別する。
- **4.A 臨床形状のOpen Questions**(4-2 Band Loop終端部の正確な形状、4-3-1正確な曲率、
  4-3-2弾性変形領域の境界) — Evidence待ち、本文書では解消しない。
- **4.B Geometry実装方式の検討事項**(4-4 Band Loop Geometry Reference: Centerline vs
  Plate deformation) — 技術的トレードオフ判断の対象。本文書の主題。

---

## Executive Summary

| Component | Method | Status | ブロック要因 |
|---|---|---|---|
| Shaft Lower | CylinderGeometry | **Decided** | なし |
| Shaft Middle | CylinderGeometry | **Decided** | なし |
| Bridge | Transition Surface(責務は確定、具体的技法は未定) | **Pending(Evidence不足)** | 詳細形状・寸法が未計測 |
| Band Loop | **4-4: Centerline Sweep(Option A)に決定**。§5候補A(2D断面Profileを1本の連続Curveに沿って1回のExtrudeGeometry呼び出しで一括掃引、§3.3)を基本方針とする | **Decided(パラダイム)、詳細パラメータはPending** | 4-2・4-3-1・4-3-2(4.A、臨床形状)が未解消のため、セグメント数・正確な曲率・端部形状は③で確定 |

Shaft Lower/Middleは実測(Evidence A+)とComponent Tree v1.2のGeometry責務(Cylinder)に
基づき本文書で確定する。Bridgeは、Evidence不足のため本文書では**最終決定はしない**。
Band Loopは、shoji指定の評価軸(§3.0、クリップ機構の理解可能性を最優先)に基づき
**4-4=Option A(Centerline Sweep)を決定した**(§3.2)。ただし4-2/4-3-1/4-3-2(臨床
形状のOpen Questions)は未解消のため、Centerlineの具体的な制御点・セグメント数・
正確な曲率は③Improvement Specで確定する。

---

## 1. Shaft Lower / Shaft Middle — Decided: Cylinder

**Geometry**: `CylinderGeometry` ×2(Lower・Middle)を同軸上に接続。

**寸法(撮影スケール換算[20×]、Geometry実装で使用すべき値。
[[Soft_Clip_Geometry_Interpretation_v1.0]] §1.2参照)**:

| 部位 | 長さ | 径(半径) |
|---|---|---|
| Shaft Lower | 2.17mm | 0.40mm(半径0.20mm) |
| Shaft Middle | 1.33mm(8種の製品長ラインナップで変化) | 0.20mm(半径0.10mm) |

**根拠**:
- Evidence A+(20倍模型の直接実測+確立済みの20×換算)、4.A(臨床形状)のOpen
  Questionに影響されない部品。
- Component Tree v1.2 §2のGeometry責務(候補)列で既に「Cylinder」と整理済み。
- 単純な円柱2本の同軸接続であり、FlatFoot(v1〜v7)で得た教訓「教育用Geometryでは
  明示されない曲面・複雑さを勝手に追加しない」([[feedback]])とも整合する。

**既知の現行コード乖離(参考、実装はしない)**: G3-3 Phase 1完了時点の監査
(`Soft_Clip_Geometry_Audit_v1.0.md` §10.2、Component Tree v1.2 §4)で既出の通り、現行
PISTONシャフトは全長にわたり一律半径0.20mmで描画されており、Shaft Middle区間
(半径0.10mmであるべき)にも誤って0.20mmが適用されている。本決定はこの是正の目標値を
文書化するものであり、実装(④)は別途行う。

**リスク**: 低。

---

## 2. Bridge — Pending(Evidence不足につき本文書では決定しない)

Component Tree v1.2 §2の状態は「Confirmed(存在は確実)、詳細形状はOpen」であり、
寸法計測はまだない。Geometry責務は「Transition Surface」(Shaft MiddleとBand Loopの
径・断面形状[円形→矩形]をつなぐ遷移面)とComponent Treeで整理済みだが、遷移面の
具体的な技法(単純なフィレット/ロフト形状/その他)を決定するための実測データが
ない。

**方針**: Evidence不足の状態で形状を推測・決定することは行わない(Evidence Based
Review原則)。Bridgeの具体的なGeometry技法はEvidence(寸法・詳細形状)取得後に
本文書を改訂して決定する。取得方法は、FlatFootのG3-1.5(`FlatFoot_Measurement_Record_v1.0.md`)
と同様の測定依頼テンプレートをshojiに依頼することを想定(必要であれば次ステップで
作成)。

**現時点の扱い**: ③Improvement Spec作成時点でもBridgeがPendingのままであれば、
Shaft Middle上端とBand Loop接合点を単純に接続する最小限の暫定形状(Evidence C、
定性的判断に基づく仮置き)を採用するか、Bridgeを省略してShaft MiddleとBand Loopを
直接接続するかをshojiと協議する。

---

## 3. Band Loop — **Decided(4-4パラダイム): Centerline Sweep**。詳細パラメータは
Pending(4.A解消待ち)

**前提の更新(v1.1)**: Band Loop全体形状はInterpretation v1.4により「単純なC字リング」
ではなく「『つ』字状の開口部を持つ弾性クリップ」と訂正されている(§1.3・§1.4)。また
Component Tree v1.2 §2.1により、Band Loop内部に**Mesh分割ではない論理的サブ構造**
(Upper Arm / Lower Arm / Central Pocket / Rear Flex Region)が整理されている。

**v1.2での決定**: 以下の評価軸(§3.0)に基づき、4-4は**Option A(Centerline Sweep)に
決定した**(§3.2)。**ただしMesh分割の具体的パラメータ(セグメント数・制御点座標等)・
実装コードは本文書では確定しない**(shoji指定。4-2/4-3-1/4-3-2の解消後、③Improvement
Specで確定)。

### 3.0 評価軸(shoji指定、2026-07-30)

Soft ClipのGeometry方式で最も重要なのは「見た目の再現」ではなく**「クリップ機構の
理解可能性」**である(shoji指定)。教育用Simulatorとしての目的は、Band Loopが実際に
どう機能してキヌタ骨長脚を保持するか(§1.4)を学習者が理解できることであり、寸法・
曲率の忠実な再現はその手段の一つに過ぎない。

| 評価項目 | 重要度 |
|---|---|
| Band Loopの「つ」形状を再現できる | 高 |
| Upper/Lower Armのすぼまりを表現できる | 高 |
| Central Pocketを理解できる | 高 |
| Rear Flex Regionを説明できる | 高 |
| 将来パラメータ変更できる(Evidence反映の容易さ) | 高 |
| Mesh数を減らせる | 低 |

### 3.1 4-4候補とv1.4形状・Component Tree v1.2の関係

`Soft_Clip_Geometry_Interpretation_v1.0.md` §5の候補A(v1.5で「Centerline Sweep」と
命名精密化。2D断面Profileを1本の連続Curveに沿って1回のExtrudeGeometry呼び出しで一括
掃引する手法、§3.3参照)・候補B(boxGeometryチェーン)は、いずれも**4-4のOption A
(Centerline Sweep)**に属する実装技法だが、候補Aのみが単一の連続メッシュを生成する
(候補Bは区間ごとに独立したboxを配置・結合するため、Option Aの主要な利点を持たない)。
候補C(現行TubeGeometry維持)も円形近似ではあるがCenterlineに沿った掃引という点では
同じ範疇に入る(ただし断面が実測[矩形0.25×0.10mm]と食い違うため§5で既に技術的な
難点が指摘済み)。この関係は「C字」から「つ」字への形状訂正によって変わらない
(いずれもパス形状が変わるのみで、パラダイム自体は同じ)。

**4-4のOption B(Plate deformationベース)は§5には含まれていない別パラダイム**であり、
平板の帯を先に作成し、そこへ曲げ変形を適用するアプローチである。

### 3.2 評価軸に基づく比較・決定

| 評価項目 | 重要度 | Option A(Centerline Sweep) | Option B(Plate deformation) |
|---|---|---|---|
| 「つ」形状を再現できる | 高 | ○ 制御点で開口部・すぼまりを直接表現可能 | ○ 曲げ変形後の形状として表現可能(ただし変形関数の設計次第で再現度が変動) |
| Upper/Lower Armのすぼまりを表現できる | 高 | ○ 制御点座標で直接指定可能、実測値をそのままパラメータ化しやすい | △ 曲げ関数のパラメータ経由で間接的に表現、実測値との対応がCenterlineほど直接的でない |
| Central Pocketを理解できる | 高 | ○ Upper Arm・Lower Arm・Rear Flex Regionに囲まれた凹み(開口部側が開いている、「穴」ではない)として明確に可視化できる | ○ 同様に可視化できるが、静的形状としての明確さはOption Aと同等 |
| Rear Flex Regionを説明できる | 高 | △ 静的形状+区分ごとの色分け・ラベルで「ここが変形する領域」と概念的に説明可能。実際の弾性変形(動的アニメーション)は非対応 | ○ 変形パラメータを直接割り当てられるため、将来的に「フックで押すと広がる」動的表現に発展させやすい(ただし現時点では未実装・未要求) |
| 将来パラメータ変更できる(Evidence反映の容易さ) | 高 | ◎ 制御点座標=実測値という直接対応。FlatFoot(G3-2)で確立した手法と一貫 | △ 曲げ関数のパラメータは実測値との対応が間接的、Evidence更新のたびに関数調整が必要になりうる |
| Mesh数を減らせる | 低 | ○ 単一の連続Profile(ExtrudeGeometry)で1meshに収められる見込み | ○ 同様に1mesh(変形後の板)に収められる見込み |
| 実装リスク | (参考) | 低〜中(区分的直線パスならFrenetフレーム破綻を回避しやすい、§3.1) | 高(独自の曲げ変形ロジックが必要、2026-07-02のFrenetフレーム破綻・FlatFoot v1〜v7の過剰精度追求による手戻りと同種のリスク) |

**決定: 4-4 = Option A(Centerline Sweep)を採用する。**

**根拠**:
1. 高重要度5項目のうち4項目(「つ」形状再現・すぼまり表現・Central Pocket理解・将来
   パラメータ変更)でOption Aが同等以上。特に「将来パラメータ変更できる」は、実測値
   (制御点座標)を直接Geometryパラメータへ落とし込めるOption Aが明確に優位で、
   G3-2(FlatFoot)で確立した本プロジェクトの標準的アプローチとも一貫する。
2. 「Rear Flex Regionを説明できる」の1項目のみOption Bに理論的優位性があるが、これは
   **動的な弾性変形アニメーションを将来実装する場合**の話であり、現時点でそのような
   要件は存在しない(SimSceneは手続き型の静的描画であり、物理演算・GLBアニメーションは
   使用していない、[[anatomy_state_design]]参照)。現時点の要件は「概念として理解
   できる静的な形状」であり、Option Aでも区分ごとの色分け・ラベル表示という
   Geometry方式に依存しない手段で対応可能(§3.3)。
3. Option Bは実装リスクが高い(独自の曲げ変形ロジックが必要)。2026-07-02レポートの
   Frenetフレーム破綻、FlatFoot v1〜v7で繰り返された「教育用Geometryへの過剰な精度
   追求による手戻り」([[feedback]])と同種のリスクを抱えており、「教育用Visual
   Geometryは実装のシンプルさを優先する」という本プロジェクト一貫の方針とも整合しない。
4. 将来、SOFTCLIPフックによる開閉動作を実際にアニメーションで見せる要件が生じた場合は、
   本決定を再検討する余地を残す(§3.3「将来拡張候補」参照)。

### 3.3 決定の詳細

**Central Pocketの分類(v1.2で明確化)**: Central Pocketは「穴(完全に閉じた開口)」
ではなく**「凹み(開口部側が開いた空間)」**である。Band Loopは「つ」字状であり、
Upper Arm・Lower Armの間に開口部が存在するため、Central Pocketはこの開口部を通じて
外部とつながっている。Geometry上は、Centerlineパスが3方向(Rear Flex Region・Upper
Arm・Lower Arm)を囲み、開口部側のみパスが存在しない形として表現される。

**Rear Flex Regionの表現方針**: 本決定(Option A)では、Rear Flex Regionを物理的に
変形するジオメトリとしては扱わない。区分ラベル・マテリアル(色分け)等、Geometry方式に
依存しない教育UI的な手段で「ここが弾性変形する領域である」という概念を伝える方針とする
(具体的な実装方法は③Improvement Specで検討)。

**Option A内の具体技法(v1.3で用語精密化、shoji指摘)**: `Soft_Clip_Geometry_Interpretation_v1.0.md`
§5の候補A、正式名称**「Centerline Sweep」**を基本方針とする。「Centerlineベース」
「ExtrudeGeometry+区分的直線パス」という従来表現は一般的な用語法とずれる可能性が
あるため、正確な手順を以下のとおり明記する。

1. **2D断面Profileを定義**する(幅0.25mm×厚さ0.10mm の矩形、パス進行方向に垂直な
   断面)。これはBand Loop全体の平面的な輪郭(「つ」字シルエット)ではなく、帯の
   細い断面のみを表す。
2. 複数の直線区間(bend点、数・位置は4-2/4-3-1解消後に確定)を**1本の連続した3D
   Curve**(センターライン)として結合する。
3. このCurveに沿って、断面Profileを**1回のExtrudeGeometry呼び出し(`extrudePath`
   オプション)で一括して掃引**し、単一の連続メッシュを生成する。

**誤解しやすい別解釈(採用しない)**: 「2D輪郭(Profile)→厚み方向Extrude→区分的
パス・制御点による配置」、すなわち直線区間ごとに個別のExtrudeGeometryを生成し、
それらを制御点に沿って配置・結合する手順は、**候補B(boxGeometryチェーン)と実質的に
同じ**である。この場合、Option Aが選ばれた主要な理由(単一の連続メッシュ、継ぎ目
なし、Frenetフレーム破綻の回避)が失われるため、③Improvement Spec・④実装では
上記1〜3の手順(1本のCurveに対する1回のExtrudeGeometry呼び出し)を用いること。

候補B(boxGeometryチェーン)より継ぎ目の隙間・めり込みリスクが低く、単一の連続
Profileとして生成できるため、G3-2(FlatFoot v6)の教訓「中空シェルは外殻/内殻を
別メッシュにせず単一の連続Profileで構成する」([[feedback]])とも整合する。
4-3-1(離散的な折れ点か連続曲線か)の回答によって制御点数・区間の直線/曲線の別を
調整するが、パラダイム(Centerline Sweep採用)自体は変わらない見込み。

**将来拡張候補(現時点では実装しない)**: 将来的にSOFTCLIPフックによる開閉動作の
アニメーション表示が要件として追加された場合、Rear Flex Region(必要であればUpper
Armも)を対象に、Option B的な変形パラメータ(または単純化した剛体ヒンジ回転による
近似)を別途追加することを検討する。現時点でこの要件は存在しないため、本決定には
影響しない。

### 3.4 4-2・4-3-1・4-3-2がBand Loopの詳細パラメータに与える影響(4-4決定後も残る
Open Questions)

| 項目 | 未解消の場合の影響 |
|---|---|
| 4-2(終端部の正確な形状) | Upper Arm・Lower Armの先端(パスの始点・終点)形状が確定できず、端部の追加ジオメトリ(閉塞キャップ等)の要否が判断できない |
| 4-3-1(正確な曲率) | 離散的な折れ点か連続曲線かにより、Option A内での制御点数・区間の直線/曲線の別が変わる(3.3参照)。パラダイム[Option A採用]自体は変わらない |
| 4-3-2(弾性変形領域の境界) | Rear Flex Region(および場合によりUpper Arm)がどこまで及ぶか未確定のため、論理的サブ構造(Component Tree §2.1)を色分け・ラベルの実際の境界に落とし込めない |

### 3.5 論理的サブ構造(Component Tree v1.2 §2.1)とOption A(Centerline Sweep)採用後の扱い

| 論理区分 | Option A(Centerline Sweep、採用決定)での扱い |
|---|---|
| Upper Arm | センターラインの一区間。先端形状は4-2解消後に確定 |
| Lower Arm | センターラインの一区間。先端形状は4-2解消後に確定 |
| Central Pocket | パスが3方向を囲む凹み(開口部側は開いている、「穴」ではない、§3.3)。パス自体の一部ではなく、Anchor/Coordinate的な扱いが近い |
| Rear Flex Region | センターラインの一区間。区分ラベル・色分け等で「弾性変形領域」であることを概念的に説明する(§3.3、実際の変形シミュレーションは対象外) |

**注記**: 上表はあくまで概念的な対応関係の整理であり、Mesh分割の具体的パラメータ
(セグメント数・制御点座標等)・実装コードを確定するものではない(shoji指定)。

---

## 4. Next Step

1. Shaft Lower/Middle: Decided。③Improvement Spec作成時にそのまま採用する。
2. Bridge: 寸法・詳細形状のEvidence取得をshojiに依頼するかを検討(測定依頼
   テンプレートが必要であれば次ステップで作成)。
3. ~~Band Loop: 4-4(Option A/B)についてshoji確認待ちを継続する。~~ 完了。4-4は
   Option A(Centerline Sweep)に決定した(§3.2)。残るのは4-2・4-3-1・4-3-2
   (4.A、臨床形状の詳細パラメータ)のみで、shoji確認待ちを継続する。
4. ~~4-2・4-3-1・4-3-2が解消次第、③Soft Clip Geometry Improvement Spec作成に進み、~~
   `docs/Soft_Clip_Geometry_Improvement_Spec_v1.0.md`作成済み。Confirmed(Geometry方式・
   Profile定義・構造)とPending(制御点位置・開口寸法・Central Pocket形状・Upper/Lower
   Arm角度・Rear Flex Region曲率)を分離、Pendingは制御点配置・実装に進んでいない。
5. **現時点ではコード変更を行わない**(Phase 2は引き続きOn Hold)。

## 5. 参照文書

- `docs/Soft_Clip_Geometry_Interpretation_v1.0.md`(v1.6、①Interpretation。4.A/4.Bの
  カテゴリ区分・4-2/4-3-1/4-3-2/4-4・§1.4クリップ機構の出典)
- `docs/Soft_Clip_Component_Tree_v1.0.md`(v1.2、Geometry責務[候補]列・Connection=
  Anchor/Coordinate Definition確定・§2.1論理的サブ構造の出典)
- `docs/Soft_Clip_Geometry_Audit_v1.0.md`(G3-3、Phase 1 Completed・Phase 2 On Hold、
  §5候補A/B/Cの出典)
- `docs/FlatFoot_Geometry_Improvement_Spec_v1.0.md`(§8.0、Frenet frame破綻の経緯・
  過剰なCAD再現の反省点の出典)
- `docs/FlatFoot_Measurement_Record_v1.0.md`(Bridge Evidence取得依頼テンプレートの
  参考様式)
