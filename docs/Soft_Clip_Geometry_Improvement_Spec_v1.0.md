# Soft Clip Geometry Improvement Specification v1.0

**Status**: Draft(shoji確認待ち)。**Confirmed事項の整理のみ、コード変更・制御点配置・
Mesh実装は行っていない**(shoji指定)。
**Date**: 2026-07-30(v1.1更新)
**v1.1での変更点(shoji追加観察、2026-07-30)**: Interpretation v1.6のCenterlineトポロジー
精密化(「『つ』字状一筆書きCenterlineを持つ開放型弾性クリップ」、腕部分に約3回の
主要カーブ、下側先端に返し曲げ形状)を反映。①§1.3のBand Loop全体形状記述を更新。
②§2.1の制御点位置を、固定数(P0〜P3等)ではなくShaft接続部・主要曲率変化点・Pocket
形成部・開口端という機能的カテゴリで表現する方針に更新(Interpretation §5-A準拠)。
③§2.3を再構成し、**Pocket最大幅**(中央Pocketの凹み空間そのものの最大寸法)・
**Pocket深さ**(新規)・**Arm間距離**(Upper Arm・Lower Arm間の開口側ギャップ)を
目的の異なる別Parameterとして明示的に分離。④§2.2の最大開口方向を、数値化不要の
Evidence B定性記録(「装着時にUpper/Lower Arm間が広がる方向」)として扱う方針に変更。
**本v1.1もInterpretation更新の反映のみであり、具体的な制御点座標の設定・Mesh生成には
進んでいない**(shoji指定)。
**位置づけ**: shoji指定の手順「①Soft Clip Geometry Interpretation → ②Geometry方式の
決定 → ③Improvement Spec作成 → ④実装」の③にあたる。前提文書は
`Soft_Clip_Geometry_Interpretation_v1.0.md`(v1.6)・`Soft_Clip_Component_Tree_v1.0.md`
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
| **Confirmed** | Geometry方式(Centerline Sweep)/ Profile定義(幅・厚さ)/ Shaft・Bridge・Band Loopの構造(「つ」字状一筆書きCenterlineトポロジーを含む、v1.6) |
| **Pending** | Band Loop制御点位置(機能的カテゴリで表現) / 開口幅 / Pocket最大幅・Pocket深さ・Arm間距離(v1.1で分離) / Upper Arm・Lower Armの具体的角度 / Rear Flex Regionの曲率 |

Pendingの5項目はいずれも**Evidence A/A+相当の定量値が存在しない**(§2で詳細)。
④実装(制御点座標を伴うCenterline Sweepの実データ化)には、これらのEvidence取得
またはshoji確認が前提条件となる。

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
  v1.4 §3.3、クリップ機構[Evidence B]からの論理的帰結としてConfirmed。ただし正確な
  寸法・形状はPending、§2.3)。

---

## 2. Pending(未確定、Evidenceレベルの整理)

Evidence階層は本プロジェクトの標準(`[[feedback]]`): **A+(実物直接計測)/ A(画像計測・
較正済み)/ B(写真観察・機能説明等の定性情報)/ C(推定)/ Unknown(情報なし)**。

### 2.1 Band Loop制御点位置

- **関連Open Question**: Interpretation v1.6 §4-2(終端部の正確な形状)・4-3-1
  (正確な曲率)。
- **制御点の扱い方(v1.1更新、Interpretation §5-A準拠)**: 固定数(P0〜P3等)では
  なく、以下の**機能的カテゴリを表現できる必要最小限の点数**として扱う。
  - Shaft接続部(Bridge側の起点)
  - 主要曲率変化点(複数。Interpretation §1.3-Aの見立てでは約3回のカーブに対応)
  - Pocket形成部
  - 開口端(Upper Arm・Lower Armそれぞれの自由端)
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

### 2.2 「つ」字形状の開口寸法

- **関連Open Question**: 直接対応する既存のOpen Question番号はない(新規に本文書で
  切り出した項目)。Interpretation §1.4のクリップ機構の記述と関連。
- **現在のEvidence**:
  - Evidence B: 「つ」の上部・下部が中央へすぼまり、長脚が容易には入らない、という
    定性的な機能説明(shoji、Interpretation §1.4)。
- **不足している情報**: 静止状態での開口部の実際の幅(mm)は定量値なし(Unknown)。
- **最大開口方向(v1.1更新、shoji指定)**: 数値化は現時点で不要とする。**Evidence B
  相当の定性記録**として「装着時にUpper/Lower Arm間が広がる方向」と記録する
  (SOFTCLIPフック使用時のクリップ動作、Interpretation §1.4と対応)。
- **次のアクション**: 開口幅(mm)の実測要否をshojiに確認。最大開口方向は定性記録の
  ままで足りる(追加確認不要)。

### 2.3 Central Pocket関連Parameter(v1.1で3項目に分離)

Pocket最大幅・Pocket深さ・Arm間距離は目的が異なる別Parameterであるため、明示的に
分離する(shoji指定)。

- **Pocket最大幅**: 中央Pocket(キヌタ骨長脚保持部)の**凹み空間そのものの最大寸法**。
- **Pocket深さ**(新規、v1.1): Pocket凹みの深さ方向の寸法。
- **Arm間距離**: Upper ArmとLower Arm間の**開口側ギャップ**(Pocket最大幅とは異なる、
  開口部での腕どうしの間隔)。

| Parameter | 現在のEvidence | 不足している情報 |
|---|---|---|
| Pocket最大幅 | Evidence B: 「穴ではなく凹み(開口部側が開いている)」という分類はクリップ機構からの論理的帰結としてConfirmed(§1.3参照) | 具体的な数値(mm)はUnknown |
| Pocket深さ | Evidence: なし | Unknown(本文書で初めて項目化) |
| Arm間距離 | Evidence: なし | Unknown |

収納対象であるキヌタ骨長脚の径との関係(挿入後にどの程度の余裕があるか等)も定量値
なし(Unknown)。本文書のスコープでは、キヌタ骨長脚側の解剖学的実測値も確認していない。

**次のアクション**: 教育用Visual Geometryとして「凹みが存在し長脚を収納する」ことが
視覚的に理解できれば足りるか、正確な寸法まで必要かをshojiと確認。
`docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md` §1-3でArm間距離・Pocket最大幅の
実測を依頼済み(Pocket深さは同ファイルv1.1で追加予定)。

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

### 2.6 Pendingサマリ(v1.1更新)

未確定として残る項目(shoji確認、2026-07-30時点): 制御点座標/各カーブの正確な曲率/
開口寸法/Pocket深さ/Arm角度/Rear Flex Region境界。

| 項目 | 現在のEvidenceレベル | 次のアクション |
|---|---|---|
| Band Loop制御点位置(Shaft接続部・主要曲率変化点・Pocket形成部・開口端) | B(回数・全長・トポロジーの見立てのみ) | 追加実測(Measurement Record)または4-2・4-3-1のshoji確認 |
| 「つ」字形状の開口幅 | B(定性説明のみ)、寸法はUnknown | shoji確認(開口部幅の実測要否) |
| 最大開口方向 | B(定性記録で確定: 「装着時にUpper/Lower Arm間が広がる方向」) | 追加確認不要 |
| Pocket最大幅 | B(凹みという分類のみ)、寸法はUnknown | 追加実測 |
| Pocket深さ | Unknown(v1.1で新規項目化) | 追加実測 |
| Arm間距離 | Unknown | 追加実測 |
| Upper Arm/Lower Armの具体的角度 | B(示唆のみ、非対称性は未確認) | shoji確認(4-3-2と連動) |
| Rear Flex Regionの曲率 | B(既存Open Question) | Interpretation §4-3-1/4-3-2の確認待ち(重複依頼なし) |

### 2.7 優先順位(shoji整理、2026-07-30)

Pending5項目は重要度が異なるため、追加実測・確認は以下の優先順位で進める。

| 優先度 | 項目 | 理由 |
|---|---|---|
| ★★★★★ | Band Loop制御点位置(§2.1) | Centerline Sweepの場合、ここが決まらないとMeshそのものが生成できない。完全なCADデータは不要で、開始点・終了点・曲率変化点・Pocket中心・Arm分岐位置程度の粗いCenterlineで十分 |
| ★★★★★ | 「つ」字開口寸法(§2.2) | Soft Clipの特徴(閉じたリングでなく挿入時に開いて保持する弾性機構)を理解するうえで臨床的意味がある。最低限、開口幅・Pocket入口幅・最大開口方向が必要 |
| ★★★★☆ | Central Pocket形状(§2.3) | 初期モデルでは複雑な凹形状は不要。Upper Arm・Lower Armに挟まれた窪みとしての最低限の輪郭で教育用形状として成立する |
| ★★★☆☆ | Upper Arm/Lower Armの具体的角度(§2.4) | 制御点(§2.1)が決まれば後から調整可能 |
| ★★☆☆☆ | Rear Flex Regionの曲率(§2.5) | 現在のSimulatorの目的は静的教育モデル・配置理解が主であり、物理的な弾性変形の再現は行わない方針(§1.1、Method Decision v1.4 §3.3)のため後回し可 |

追加実測依頼テンプレートは`docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`として
作成した(§4参照)。「全項目を測る」ことを目的とせず、Centerline Sweep生成に必要な
最小限のParameter取得(必須: 制御点位置・開口寸法・Pocket形状の一部/可能であれば:
板厚分布・端部形状・Flex領域推定用写真)に絞っている。

---

## 3. Non-goals(本文書で行わないこと、明記)

- **制御点の座標配置**: §2の5項目がPendingのため、具体的な数値・座標は本文書では
  一切提案しない(shoji指定)。
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
   作成した。「全項目を測る」ことを目的とせず、Centerline Sweep生成に必要な最小限の
   Parameter(§2.7の優先度★★★★★の2項目を中心)に絞った依頼内容。
3. shojiの記入完了後、Evidence A(またはA+)として本文書§2へ反映し、制御点座標・
   Profile配置の具体的な数値を追加して④実装へ進む。必須項目(測定Record §1)のみ
   揃った時点で、粗いCenterlineでの実装着手可否をshojiと協議することも可能。
4. **現時点ではコード変更を行わない**(Phase 2は引き続きOn Hold)。

## 5. 参照文書

- `docs/Soft_Clip_Geometry_Interpretation_v1.0.md`(v1.5、①Interpretation。4-2/4-3-1/
  4-3-2・§1.4クリップ機構・§5用語精密化の出典)
- `docs/Soft_Clip_Component_Tree_v1.0.md`(v1.2、§2.1論理的サブ構造の出典)
- `docs/Soft_Clip_Geometry_Method_Decision_v1.0.md`(v1.4、②4-4決定[Centerline Sweep]・
  Central Pocket分類の出典)
- `docs/Soft_Clip_Geometry_Audit_v1.0.md`(G3-3、Phase 1 Completed・Phase 2 On Hold)
- `docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`(§2.7優先順位に基づく追加実測
  依頼テンプレート、shoji記入待ち)
- `docs/FlatFoot_Measurement_Record_v1.0.md`(テンプレート形式の参考元)
- `src/scenes/models/ProsthesisModels.tsx`(`SoftClipHead`:437、`SoftClipStem`:428、
  `SoftClipBridge`:409、`SoftClipWing`:384、`ProsthesisModel`シャフト計算部 — 現行
  コードとの対応はComponent Tree v1.2 §4参照)
