# Soft Clip Geometry Method Decision v1.0

**Status**: Draft(shoji確認待ち)。**コード変更は行っていない(方式の検討・部分決定のみ、
Mesh分割方式・実装方法は未確定)**。
**Date**: 2026-07-30(v1.1更新)
**v1.1での変更点(shoji指示、2026-07-30)**: §3(Band Loop)をInterpretation v1.4
(Band Loop全体形状「単純なC字リング」→「『つ』字状の開口部を持つ弾性クリップ」への
訂正、クリップ機構Confirmed)およびComponent Tree v1.2 §2.1(Upper Arm/Lower
Arm/Central Pocket/Rear Flex Regionという論理的サブ構造、Mesh分割ではない)を反映して
更新した。**この更新はGeometry方式(4-4)の決定でも、Mesh分割方式・実装方法の確定でも
ない**(shoji指定により今回も未決定のまま)。Shaft Lower/Middle(Decided)・Bridge
(Pending)はBand Loop形状訂正の影響を受けないため変更なし。
**位置づけ**: shoji指定の手順「①Soft Clip Geometry Interpretation → ②Geometry方式の
決定 → ③Improvement Spec作成 → ④実装」の②にあたる。前提文書は
`Soft_Clip_Geometry_Interpretation_v1.0.md`(v1.4)・`Soft_Clip_Component_Tree_v1.0.md`
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
| Band Loop | Centerlineベース or Plate deformationベース(4-4) | **Pending(4.A+4.B)** | 4-2・4-3-1・4-3-2(4.A)、4-4(4.B)が未解消。「つ」字クリップ形状・論理的サブ構造(Upper Arm/Lower Arm/Central Pocket/Rear Flex Region)は反映済み(§3) |

Shaft Lower/Middleは実測(Evidence A+)とComponent Tree v1.2のGeometry責務(Cylinder)に
基づき本文書で確定する。Bridge・Band Loopは、Evidence不足または4-4未決定のため、
本文書では**最終決定はしない**。ただし判断材料・比較の枠組みを整理し、③Improvement
Specへ引き継ぐ準備とする(shoji指定「Geometry方式検討時には4-4の選択を含めて判断
してください」への対応)。

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

## 3. Band Loop — Pending(4.A + 4.B、比較の枠組みを整理。v1.1でつ字クリップ+論理的
サブ構造を反映)

**前提の更新(v1.1)**: Band Loop全体形状はInterpretation v1.4により「単純なC字リング」
ではなく「『つ』字状の開口部を持つ弾性クリップ」と訂正されている(§1.3・§1.4)。また
Component Tree v1.2 §2.1により、Band Loop内部に**Mesh分割ではない論理的サブ構造**
(Upper Arm / Lower Arm / Central Pocket / Rear Flex Region)が整理されている。以下の
検討はこれらを前提とするが、**Mesh分割方式・実装方法そのものは本節でも確定しない**
(shoji指定)。

### 3.1 4-4(Centerline vs Plate deformation)と§5候補A/B/Cの関係

`Soft_Clip_Geometry_Interpretation_v1.0.md` §5の候補A(ExtrudeGeometry+区分的直線
パス)・候補B(boxGeometryチェーン)は、いずれも**4-4のOption A(Centerlineベース)**に
属する具体的な実装技法である。候補C(現行TubeGeometry維持)も円形近似ではあるが
Centerlineに沿った掃引という点では同じ範疇に入る(ただし断面が実測[矩形0.25×0.10mm]
と食い違うため§5で既に技術的な難点が指摘済み)。この関係は「C字」から「つ」字への
形状訂正によって変わらない(いずれもパス形状が変わるのみで、パラダイム自体は同じ)。

**4-4のOption B(Plate deformationベース)は§5には含まれていない別パラダイム**であり、
平板の帯を先に作成し、そこへ曲げ変形を適用するアプローチである。

### 3.2 比較(所見の整理、決定ではない)

**Option A: Centerlineベース(§5候補A/B)**
- 長所: 実測値(全長約6.0〜7.5mm、断面0.25×0.10mm、8箇所成形)を制御点座標として
  直接パラメータ化しやすい。G3-2(FlatFoot)で確立した「Evidence A+寸法を直接
  Geometryパラメータへ落とし込む」手法と一貫性がある。4-3-1(離散的な折れ点か連続
  曲線か)のどちらの回答でも、区分的直線パス(候補A)またはboxチェーン(候補B)で
  近似的に対応可能。論理的サブ構造(Upper Arm→Rear Flex Region→Lower Arm、または
  その逆順)をセンターラインの区間分けとして自然に表現できる可能性がある(Central
  Pocketはセンターラインが囲む空間であり、パス自体の一部ではない)。
- 短所: 4-2(終端部の正確な形状)が未解消のままだと、パスの始点・終点(Upper Arm・
  Lower Armの先端)の正確な形状を定義できない。また、Rear Flex Regionが実際に弾性
  変形する領域である(§1.4)ことは、静的なCenterlineベースの手法では通常表現されない
  (=描画される形状は常に「変形後」の1状態のみになる)。教育用Visual Geometryとして
  静的な1状態のみで十分かどうかは別途検討が必要。

**Option B: Plate deformationベース**
- 長所: 「平板を曲げ加工する」という実物の製造プロセスに近いメタファー。「Rear Flex
  Region(弾性変形領域)」という機能的概念(Component Tree v1.2 §2.1)とも親和性が
  ある(変形領域を明示的にパラメータ化できる可能性)。
- 短所: three.jsの標準Geometryクラスは板の曲げ変形(ベンドモディファイア相当)を
  直接サポートしておらず、独自の頂点変形ロジック(パラメトリックな曲げ関数)の
  実装が必要になる。2026-07-02レポートで報告された「滑らかな急カーブでのFrenet
  フレーム破綻」、およびFlatFoot v1〜v7で繰り返された「教育用Geometryへの過剰な
  精度追求による手戻り」([[feedback]])と同種のリスクが高いと見込まれる。実装・
  保守コストがOption Aより高いと予想される。

**現時点の所見(判断ではなく整理、shoji確認まで確定させない)**: 上記の技術的
トレードオフと、本プロジェクトで一貫している「教育用Visual Geometryは実装の
シンプルさを優先する」という方針(FlatFoot v1〜v7・[[feedback]])を踏まえると、
Option A(Centerlineベース)の方が実装・保守コストの観点で有利と見込まれる。ただし、
Rear Flex Regionの弾性変形という機能(§1.4)を将来的に動的表現(例: フック使用時の
アニメーション)として扱う要件が出てきた場合は、Option Bの方が本質的に適している
可能性があり、この判断は要件次第で変わりうる。あくまで技術的な所見であり、実物を
手に取ったshojiさんの判断を上書きするものではない。**4-4自体はshoji指定の通り本文書
でも確定させない**。

### 3.3 4-2・4-3-1・4-3-2・4-4がBand Loopの最終手法選択に与える影響(整理)

| 項目 | 未解消の場合の影響 |
|---|---|
| 4-2(終端部の正確な形状) | Upper Arm・Lower Armの先端(パスの始点・終点)形状が確定できず、Option Aを選んだ場合も端部の追加ジオメトリ(閉塞キャップ等)の要否が判断できない |
| 4-3-1(正確な曲率) | 離散的な折れ点なら候補B(boxチェーン)が自然、連続曲線なら候補A(区分的直線パスによる近似、または滑らかなスプライン)が候補になるが、後者は過去のFrenetフレーム破綻リスクに注意が必要 |
| 4-3-2(弾性変形領域の境界) | Rear Flex Region(および場合によりUpper Arm)がどこまで及ぶか未確定のため、論理的サブ構造(§2.1)を実際のパラメータ境界に落とし込めない。静的形状のみで良いか、変形前提の設計が必要かにも影響する |
| 4-4(Centerline vs Plate deformation) | Option Aか Bかで実装アプローチ自体が根本的に変わる。3.2の所見はあるが最終選択はshoji確認待ち |

### 3.4 論理的サブ構造(Component Tree v1.2 §2.1)とGeometry手法の対応(所見、決定ではない)

| 論理区分 | Option A(Centerline)での扱いの見込み | Option B(Plate deformation)での扱いの見込み |
|---|---|---|
| Upper Arm | センターラインの一区間 | 板の一領域(先端寄り) |
| Lower Arm | センターラインの一区間 | 板の一領域(先端寄り) |
| Central Pocket | パスが囲む空間(パス自体の一部ではない、Anchor/Coordinate的な扱いが近い) | 板の変形結果として生じる空間 |
| Rear Flex Region | センターラインの一区間(ただし「変形する」という性質は静的パスでは表現されない) | 変形パラメータを直接割り当てられる領域(Option Bの主要な強み) |

**注記**: 上表はあくまで概念的な対応関係の整理であり、Mesh分割方式・実装方法(何個の
Geometryオブジェクトに分けるか等)を決定するものではない(shoji指定)。

---

## 4. Next Step

1. Shaft Lower/Middle: Decided。③Improvement Spec作成時にそのまま採用する。
2. Bridge: 寸法・詳細形状のEvidence取得をshojiに依頼するかを検討(測定依頼
   テンプレートが必要であれば次ステップで作成)。
3. Band Loop: 4-2・4-3-1・4-3-2(4.A)、4-4(4.B)の4点についてshoji確認待ちを継続する。
   3.2〜3.4の所見・対応関係は判断材料として保持するのみで、確定はしない。
4. 上記が解消次第、③Soft Clip Geometry Improvement Spec作成に進み、Shaft
   Lower/Middle(Decided)・Bridge・Band Loopの最終Geometry仕様をまとめる。
5. **現時点ではコード変更を行わない**(Phase 2は引き続きOn Hold)。

## 5. 参照文書

- `docs/Soft_Clip_Geometry_Interpretation_v1.0.md`(v1.4、①Interpretation。4.A/4.Bの
  カテゴリ区分・4-2/4-3-1/4-3-2/4-4・§1.4クリップ機構の出典)
- `docs/Soft_Clip_Component_Tree_v1.0.md`(v1.2、Geometry責務[候補]列・Connection=
  Anchor/Coordinate Definition確定・§2.1論理的サブ構造の出典)
- `docs/Soft_Clip_Geometry_Audit_v1.0.md`(G3-3、Phase 1 Completed・Phase 2 On Hold、
  §5候補A/B/Cの出典)
- `docs/FlatFoot_Geometry_Improvement_Spec_v1.0.md`(§8.0、Frenet frame破綻の経緯・
  過剰なCAD再現の反省点の出典)
- `docs/FlatFoot_Measurement_Record_v1.0.md`(Bridge Evidence取得依頼テンプレートの
  参考様式)
