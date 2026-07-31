# Soft Clip Geometry Improvement Specification v1.0

**Status**: Draft(shoji確認待ち)。**Confirmed事項の整理のみ、コード変更・制御点配置・
Mesh実装は行っていない**(shoji指定)。
**Date**: 2026-07-30
**位置づけ**: shoji指定の手順「①Soft Clip Geometry Interpretation → ②Geometry方式の
決定 → ③Improvement Spec作成 → ④実装」の③にあたる。前提文書は
`Soft_Clip_Geometry_Interpretation_v1.0.md`(v1.5)・`Soft_Clip_Component_Tree_v1.0.md`
(v1.2)・`Soft_Clip_Geometry_Method_Decision_v1.0.md`(v1.3)。三文書の内容はshoji確認済み
のため再掲しない(差分のみ扱う、Token Efficiency方針)。

**本文書の役割(shoji指定)**: Confirmed(実装に着手してよい確定事項)とPending(未確定、
Evidence整理が必要な事項)を明確に分離する。**Pending項目について、推測による制御点
配置・Mesh実装には進まない**。写真・実物情報から現在のEvidenceレベルを整理し、
不足している情報と次のアクションを明示する。

---

## Executive Summary

| 区分 | 項目 |
|---|---|
| **Confirmed** | Geometry方式(Centerline Sweep)/ Profile定義(幅・厚さ)/ Shaft・Bridge・Band Loopの構造 |
| **Pending** | Band Loop制御点位置 / 「つ」字形状の開口寸法 / Central Pocket形状 / Upper Arm・Lower Armの具体的角度 / Rear Flex Regionの曲率 |

Pendingの5項目はいずれも**Evidence A/A+相当の定量値が存在しない**(§2で詳細)。
④実装(制御点座標を伴うCenterline Sweepの実データ化)には、これらのEvidence取得
またはshoji確認が前提条件となる。

---

## 1. Confirmed(実装に着手してよい確定事項)

### 1.1 Geometry方式: Centerline Sweep

`Soft_Clip_Geometry_Method_Decision_v1.0.md`(v1.3)§3.2で決定済み(4-4 = Option A)。
正確な手順(v1.3で用語精密化済み、再掲は最小限):

1. 2D断面Profileを定義する(§1.2)。
2. 複数の直線区間を1本の連続3D Curve(センターライン)として結合する。
3. そのCurveに沿って、断面Profileを1回のExtrudeGeometry呼び出し(`extrudePath`)で
   一括して掃引し、単一の連続メッシュを生成する。

区間ごとに個別Extrude・配置する手法(候補B相当)は採用しない(Method Decision v1.3
§3.3「誤解しやすい別解釈」参照)。

### 1.2 Profile定義(幅・厚さ)

Geometry実装で使用すべき値は撮影スケール換算(20×)後の値(Interpretation v1.5 §1.2
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
- **Shaft Lower/Middle**: CylinderGeometry ×2、同軸接続(Method Decision v1.3 §1、
  Decided)。
- **Bridge**: 存在・役割(Shaft MiddleとBand Loopを接合するTransition Surface)は
  Confirmed。**詳細形状・寸法はPending**(Evidence不足、§2では扱わない。理由は本文書
  スコープ外の既存Pending事項であり、Method Decision v1.3 §2で継続管理)。
- **Band Loop全体形状**: 単純なC字リングではなく「つ」字状の開口部を持つ弾性クリップ
  (Interpretation v1.4 §1.3、Confirmed)。
- **Band Loopの論理的サブ構造**(Mesh分割ではない、Component Tree v1.2 §2.1):
  Upper Arm / Lower Arm / Central Pocket / Rear Flex Regionの4区分がConfirmed
  (機能区分として存在することは確定、各区分の正確な範囲・寸法はPending、§2)。
- **クリップ機構**(Interpretation v1.4 §1.4、Confirmed、Evidence B — shoji=ENT外科医
  による機能説明): 静止時は上下がすぼまり長脚が入りにくい構造、開放部から長脚を垂直
  挿入、SOFTCLIPフックで後方の弯曲部(Rear Flex Region)を押すと上部が弾性変形して
  広がり長脚が中央の窪みに収納される。
- **Central Pocketの分類**: 「穴」ではなく「開口部側が開いた凹み」(Method Decision
  v1.3 §3.3、クリップ機構[Evidence B]からの論理的帰結としてConfirmed。ただし正確な
  寸法・形状はPending、§2.3)。

---

## 2. Pending(未確定、Evidenceレベルの整理)

Evidence階層は本プロジェクトの標準(`[[feedback]]`): **A+(実物直接計測)/ A(画像計測・
較正済み)/ B(写真観察・機能説明等の定性情報)/ C(推定)/ Unknown(情報なし)**。

### 2.1 Band Loop制御点位置

- **関連Open Question**: Interpretation v1.5 §4-2(終端部の正確な形状)・4-3-1
  (正確な曲率)。
- **現在のEvidence**:
  - Evidence B: shoji見立て(Interpretation §1.3)により、全長約6.0〜7.5mm、長辺方向
    に**約8箇所**で前後に成形、という定性的な回数・全長の情報はある。
  - Evidence B: 10方向画像(Interpretation §1.1)により、Band Loopが立体的にどう
    波打つかを視覚的に確認できるが、写真の重なり・反射により正確な3D座標の再構成は
    できない(Interpretation §1.1「確認方法の限界」参照)。
- **不足している情報**: 各bend点の3D座標(またはセンターラインに沿った位置・曲げ角度)
  の実測値。「約8箇所」は回数の見立てであり、各箇所の正確な位置・角度を示す数値では
  ない。
- **次のアクション**: shoji確認(4-2・4-3-1の解消)、または追加実測(FlatFootの
  G3-1.5と同様の測定依頼)が必要。**本文書では制御点座標を決定・提案しない**。

### 2.2 「つ」字形状の開口寸法

- **関連Open Question**: 直接対応する既存のOpen Question番号はない(新規に本文書で
  切り出した項目)。Interpretation §1.4のクリップ機構の記述と関連。
- **現在のEvidence**:
  - Evidence B: 「つ」の上部・下部が中央へすぼまり、長脚が容易には入らない、という
    定性的な機能説明(shoji、Interpretation §1.4)。
- **不足している情報**: 静止状態での開口部の実際の幅(mm)、Central Pocket最大幅との
  比率など、定量値は一切ない(Unknown)。
- **次のアクション**: 20倍模型上での開口部幅の実測をshojiに依頼するか検討。

### 2.3 Central Pocket形状

- **関連Open Question**: 直接対応する既存のOpen Question番号はない。
- **現在のEvidence**:
  - Evidence B: 「穴ではなく凹み(開口部側が開いている)」という分類はクリップ機構
    (Evidence B)からの論理的帰結としてConfirmed(§1.3参照)。
- **不足している情報**: 凹みの具体的な寸法(深さ・幅)、収納対象であるキヌタ骨長脚の
  径との関係(挿入後にどの程度の余裕があるか等)は定量値なし(Unknown)。本文書の
  スコープでは、キヌタ骨長脚側の解剖学的実測値も確認していない。
- **次のアクション**: 教育用Visual Geometryとして「凹みが存在し長脚を収納する」ことが
  視覚的に理解できれば足りるか、正確な寸法まで必要かをshojiと確認。

### 2.4 Upper Arm / Lower Armの具体的角度

- **関連Open Question**: Interpretation v1.5 §4-3-2(弾性変形領域の境界)と部分的に
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

- **関連Open Question**: Interpretation v1.5 §4-3-1(正確な曲率)・4-3-2(弾性変形
  領域の境界)に直接対応(既存のOpen Questionそのもの)。
- **現在のEvidence**:
  - Evidence B: 写真上の反射・解像度からは、離散的な折れ点か連続的な曲線かを判別
    できていない(Interpretation §4-3-1)。弾性変形領域がどこまで及ぶかも未確認
    (§4-3-2)。
- **不足している情報**: 正確な曲率(数値)、変形領域の境界位置、いずれもUnknown。
- **次のアクション**: shoji確認依頼はInterpretation §4-3-1・4-3-2に既出(実物での
  直接観察・触感を優先する方針)。本文書では追加の確認依頼を重複させない。

### 2.6 Pendingサマリ

| 項目 | 現在のEvidenceレベル | 次のアクション |
|---|---|---|
| Band Loop制御点位置 | B(回数・全長の見立てのみ) | shoji確認(4-2・4-3-1)または追加実測 |
| 「つ」字形状の開口寸法 | B(定性説明のみ)、寸法はUnknown | shoji確認(開口部幅の実測要否を含め) |
| Central Pocket形状 | B(凹みという分類のみ)、寸法はUnknown | shoji確認(必要精度の確認) |
| Upper Arm/Lower Armの具体的角度 | B(示唆のみ、非対称性は未確認) | shoji確認(4-3-2と連動) |
| Rear Flex Regionの曲率 | B(既存Open Question) | Interpretation §4-3-1/4-3-2の確認待ち(重複依頼なし) |

---

## 3. Non-goals(本文書で行わないこと、明記)

- **制御点の座標配置**: §2の5項目がPendingのため、具体的な数値・座標は本文書では
  一切提案しない(shoji指定)。
- **Mesh実装・コード変更**: 本文書はSpecの整理のみ。④実装は別ステップ。
- **Bridgeの詳細形状決定**: Method Decision v1.3 §2で既にPending(Evidence不足)と
  整理済みであり、本文書のスコープ(Band Loop中心のConfirmed/Pending整理)には
  含めない。
- **Rear Flex Regionの動的変形(アニメーション)実装**: Method Decision v1.3 §3.3
  「将来拡張候補」として整理済み、現時点の要件外(変更なし)。

---

## 4. Next Step

1. §2.6のPending項目について、shojiに確認を依頼する(Interpretation §4-3-1/4-3-2は
   既存の依頼を継続、§2.1/2.2/2.3/2.4は新規に整理した確認事項)。
2. 追加実測が必要と判断された場合、FlatFootのG3-1.5(`FlatFoot_Measurement_Record_v1.0.md`)
   と同様の測定依頼テンプレートの作成を検討する。
3. Pending項目が解消次第、本文書を改訂して制御点座標・Profile配置の具体的な数値を
   追加し、④実装へ進む。
4. **現時点ではコード変更を行わない**(Phase 2は引き続きOn Hold)。

## 5. 参照文書

- `docs/Soft_Clip_Geometry_Interpretation_v1.0.md`(v1.5、①Interpretation。4-2/4-3-1/
  4-3-2・§1.4クリップ機構・§5用語精密化の出典)
- `docs/Soft_Clip_Component_Tree_v1.0.md`(v1.2、§2.1論理的サブ構造の出典)
- `docs/Soft_Clip_Geometry_Method_Decision_v1.0.md`(v1.3、②4-4決定[Centerline Sweep]・
  Central Pocket分類の出典)
- `docs/Soft_Clip_Geometry_Audit_v1.0.md`(G3-3、Phase 1 Completed・Phase 2 On Hold)
- `docs/FlatFoot_Measurement_Record_v1.0.md`(追加実測依頼テンプレートの参考様式)
- `src/scenes/models/ProsthesisModels.tsx`(`SoftClipHead`:437、`SoftClipStem`:428、
  `SoftClipBridge`:409、`SoftClipWing`:384、`ProsthesisModel`シャフト計算部 — 現行
  コードとの対応はComponent Tree v1.2 §4参照)
