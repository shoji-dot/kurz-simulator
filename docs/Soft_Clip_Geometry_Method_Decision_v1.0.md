# Soft Clip Geometry Method Decision v1.0

**Status**: Draft(shoji確認待ち)。**コード変更は行っていない(方式の検討・部分決定のみ)**。

> **⚠ 一部内容が古い(2026-07-30追記)**: `Soft_Clip_Geometry_Interpretation_v1.0.md`が
> v1.4へ改訂され、Band Loop全体形状が「単純なC字リング」から「『つ』字状の開口部を
> 持つ弾性クリップ」へ訂正された(Interpretation v1.4 §1.3・§1.4)。本文書§3(Band
> Loop、Centerline/Plate deformationの比較)は旧「C字」前提の記述のままであり、
> shoji指定により本改訂では**Geometry方式の再検討は行っていない**。②を再訪する際は
> Interpretation v1.4(特にクリップ機構・4-2/4-3-1/4-3-2)を踏まえて本文書§3を
> 改訂すること。§1(Shaft Lower/Middle)・§2(Bridge)はBand Loop形状訂正の影響を
> 受けないため、Decided/Pendingの状態は変更なし。

**Date**: 2026-07-30
**位置づけ**: shoji指定の手順「①Soft Clip Geometry Interpretation → ②Geometry方式の
決定 → ③Improvement Spec作成 → ④実装」の②にあたる。前提文書は
`Soft_Clip_Geometry_Interpretation_v1.0.md`(v1.3)・`Soft_Clip_Component_Tree_v1.0.md`
(v1.1)。両文書の内容はshoji確認済みのため再掲しない(差分のみ扱う、Token Efficiency
方針)。

**Open Questionsのカテゴリ区別(Interpretation v1.3で確立)**: 本文書では以下を区別する。
- **4.A 臨床形状のOpen Questions**(4-2 Band Loop終端フィーチャー数、4-3曲げの性質) —
  Evidence待ち、本文書では解消しない。
- **4.B Geometry実装方式の検討事項**(4-4 Band Loop Geometry Reference: Centerline vs
  Plate deformation) — 技術的トレードオフ判断の対象。本文書の主題。

---

## Executive Summary

| Component | Method | Status | ブロック要因 |
|---|---|---|---|
| Shaft Lower | CylinderGeometry | **Decided** | なし |
| Shaft Middle | CylinderGeometry | **Decided** | なし |
| Bridge | Transition Surface(責務は確定、具体的技法は未定) | **Pending(Evidence不足)** | 詳細形状・寸法が未計測 |
| Band Loop | Centerlineベース or Plate deformationベース(4-4) | **Pending(4.A+4.B)** | 4-2・4-3(4.A)、4-4(4.B)が未解消 |

Shaft Lower/Middleは実測(Evidence A+)とComponent Tree v1.1のGeometry責務(Cylinder)に
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
- Component Tree v1.1 §2のGeometry責務(候補)列で既に「Cylinder」と整理済み。
- 単純な円柱2本の同軸接続であり、FlatFoot(v1〜v7)で得た教訓「教育用Geometryでは
  明示されない曲面・複雑さを勝手に追加しない」([[feedback]])とも整合する。

**既知の現行コード乖離(参考、実装はしない)**: G3-3 Phase 1完了時点の監査
(`Soft_Clip_Geometry_Audit_v1.0.md` §10.2、Component Tree v1.1 §4)で既出の通り、現行
PISTONシャフトは全長にわたり一律半径0.20mmで描画されており、Shaft Middle区間
(半径0.10mmであるべき)にも誤って0.20mmが適用されている。本決定はこの是正の目標値を
文書化するものであり、実装(④)は別途行う。

**リスク**: 低。

---

## 2. Bridge — Pending(Evidence不足につき本文書では決定しない)

Component Tree v1.1 §2の状態は「Confirmed(存在は確実)、詳細形状はOpen」であり、
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

## 3. Band Loop — Pending(4.A + 4.B、比較の枠組みを整理)

### 3.1 4-4(Centerline vs Plate deformation)と§5候補A/B/Cの関係

`Soft_Clip_Geometry_Interpretation_v1.0.md` §5の候補A(ExtrudeGeometry+区分的直線
パス)・候補B(boxGeometryチェーン)は、いずれも**4-4のOption A(Centerlineベース)**に
属する具体的な実装技法である。候補C(現行TubeGeometry維持)も円形近似ではあるが
Centerlineに沿った掃引という点では同じ範疇に入る(ただし断面が実測[矩形0.25×0.10mm]
と食い違うため§5で既に技術的な難点が指摘済み)。

**4-4のOption B(Plate deformationベース)は§5には含まれていない別パラダイム**であり、
平板の帯を先に作成し、そこへ曲げ変形を適用するアプローチである。

### 3.2 比較(所見の整理、決定ではない)

**Option A: Centerlineベース(§5候補A/B)**
- 長所: 実測値(全長約6.0〜7.5mm、断面0.25×0.10mm、8箇所曲げ)を制御点座標として
  直接パラメータ化しやすい。G3-2(FlatFoot)で確立した「Evidence A+寸法を直接
  Geometryパラメータへ落とし込む」手法と一貫性がある。4-3(離散的な折れ点か連続
  曲線か)のどちらの回答でも、区分的直線パス(候補A)またはboxチェーン(候補B)で
  近似的に対応可能。
- 短所: 4-2(終端フィーチャー数)が未解消のままだと、パスの始点・終点の正確な形状
  (ループを閉じるか、フックとして開くか)を定義できない。

**Option B: Plate deformationベース**
- 長所: 「平板を曲げ加工する」という実物の製造プロセスに近いメタファー。
- 短所: three.jsの標準Geometryクラスは板の曲げ変形(ベンドモディファイア相当)を
  直接サポートしておらず、独自の頂点変形ロジック(パラメトリックな曲げ関数)の
  実装が必要になる。2026-07-02レポートで報告された「滑らかな急カーブでのFrenet
  フレーム破綻」、およびFlatFoot v1〜v7で繰り返された「教育用Geometryへの過剰な
  精度追求による手戻り」([[feedback]])と同種のリスクが高いと見込まれる。実装・
  保守コストがOption Aより高いと予想される。

**現時点の所見(判断ではなく整理、shoji確認まで確定させない)**: 上記の技術的
トレードオフと、本プロジェクトで一貫している「教育用Visual Geometryは実装の
シンプルさを優先する」という方針(FlatFoot v1〜v7・[[feedback]])を踏まえると、
Option A(Centerlineベース)の方が実装・保守コストの観点で有利と見込まれる。
ただし、これはあくまで技術的な所見であり、実物を手に取ったshojiさんの判断を
上書きするものではない。**4-4自体はshoji指定の通り本文書でも確定させない**。

### 3.3 4-2・4-3・4-4がBand Loopの最終手法選択に与える影響(整理)

| 項目 | 未解消の場合の影響 |
|---|---|
| 4-2(終端フィーチャー数) | パスの始点・終点形状(ループ閉じ/フック開き)が確定できず、Option Aを選んだ場合も端部の追加ジオメトリ(閉塞キャップ等)の要否が判断できない |
| 4-3(曲げの性質) | 離散的な折れ点なら候補B(boxチェーン)が自然、連続曲線なら候補A(区分的直線パスによる近似、または滑らかなスプライン)が候補になるが、後者は過去のFrenetフレーム破綻リスクに注意が必要 |
| 4-4(Centerline vs Plate deformation) | Option Aか Bかで実装アプローチ自体が根本的に変わる。3.2の所見はあるが最終選択はshoji確認待ち |

---

## 4. Next Step

1. Shaft Lower/Middle: Decided。③Improvement Spec作成時にそのまま採用する。
2. Bridge: 寸法・詳細形状のEvidence取得をshojiに依頼するかを検討(測定依頼
   テンプレートが必要であれば次ステップで作成)。
3. Band Loop: 4-2・4-3(4.A)、4-4(4.B)の3点についてshoji確認待ちを継続する。
   3.2の所見は判断材料として保持するのみで、確定はしない。
4. 上記が解消次第、③Soft Clip Geometry Improvement Spec作成に進み、Shaft
   Lower/Middle(Decided)・Bridge・Band Loopの最終Geometry仕様をまとめる。
5. **現時点ではコード変更を行わない**(Phase 2は引き続きOn Hold)。

## 5. 参照文書

- `docs/Soft_Clip_Geometry_Interpretation_v1.0.md`(v1.3、①Interpretation。4.A/4.Bの
  カテゴリ区分・4-4の出典)
- `docs/Soft_Clip_Component_Tree_v1.0.md`(v1.1、Geometry責務[候補]列・Connection=
  Anchor/Coordinate Definition確定の出典)
- `docs/Soft_Clip_Geometry_Audit_v1.0.md`(G3-3、Phase 1 Completed・Phase 2 On Hold、
  §5候補A/B/Cの出典)
- `docs/FlatFoot_Geometry_Improvement_Spec_v1.0.md`(§8.0、Frenet frame破綻の経緯・
  過剰なCAD再現の反省点の出典)
- `docs/FlatFoot_Measurement_Record_v1.0.md`(Bridge Evidence取得依頼テンプレートの
  参考様式)
