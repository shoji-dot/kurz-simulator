# Soft Clip Band Loop Measurement Record v1.0

**Status**: **一部測定完了(shoji受領、2026-07-31)**。Pocket関連4項目・Terminal形状/
長さは実測値をEvidence A/A+として反映済み・正式Confirmed。**実装不能な曖昧さは
Shaft接続位置(§1-1-A)の1点に収束**(shoji確認、2026-07-31)。このファイル自体は
コード変更を伴わない。
**Date**: 2026-07-31(v1.3更新)
**v1.3での変更点(shoji提案、2026-07-31)**: §1-1-Aを、ノギス測定に加え写真上での
マーキングで効率化できる3点(M1 Lower ArmのCenterline開始点/M2 Hook-like曲げ開始点/
M3 Shaft中心軸との交点)として再整理。
**v1.2での変更点(shoji実測値受領、2026-07-31)**: 以下7項目の実測値を受領し反映。
Band Width 0.25mm(A+)・Band Thickness 0.10mm(A+、既存確定値と一致)・Pocket
Maximum Width 1.40mm(A+)・Arm Gap(Opening)0.75mm(A+)・Pocket Depth 3.30mm
(A+、Definition固定)・Terminal Shape=Hook-like(A)・Terminal Length 約2.40mm(A)。
①§0を更新し確定値を追加。②§1-2(#6/#7)・§1-3(#9/#10/#11)を「測定済み」へ更新。
③Pocket Maximum Width(1.40mm)とArm Gap(0.75mm)の値の違いから、PocketがFunnel状
(内部拡大型)であるとInterpretation側で確定(Interpretation v1.7 §1.5)。④Terminal
Shapeは「Simple Radius/Hook/Flat」の中からHook-likeとして確定(ただし完全なHook
形状ではなく"Hook-like terminal"という分類語を維持)。⑤新規§1-1-Aとして、残存する
最重要未確定項目**Shaft接続位置**(Lower Arm開始点・返し曲げ終端・Shaft中心接続位置
の位置関係)を追加(Centerline Sweep開始点決定に直接影響するため最優先)。
**位置づけ**: `docs/Soft_Clip_Geometry_Improvement_Spec_v1.0.md`(③、v1.2)§1/§2の
Confirmed/Pending区分を解消するための測定依頼テンプレート。shoji整理(2026-07-30)に
よる優先順位付けに基づく。

**目的(shoji指定)**: **「精密な完成形を測る」ことではなく、Centerline Sweepが成立する
最低限の骨格情報を取得すること**。全ての寸法を埋めることを目的とせず、Geometry生成に
必要なParameterのみを優先する。**推測値の代入・記入は禁止**(未測定の項目は空欄のまま
でよい)。

---

## 0. 既に確定済みの値(参考、再測定不要)

`docs/Soft_Clip_Geometry_Interpretation_v1.0.md` §1.2で取得済み(Evidence A、撮影
スケール換算[20×])に加え、2026-07-31受領分(Evidence A/A+)を統合。

| 項目 | 値 | Evidence |
|---|---:|:---:|
| Band Loop 幅(断面長辺) | 0.25 mm | A+ |
| Band Loop 厚さ(断面短辺) | 0.10 mm | A+ |
| Band Loop 全長(見立て、Evidence B) | 約6.0〜7.5mm | B |
| Shaft Lower 径(半径) | 0.40mm(半径0.20mm) | A+ |
| Shaft Middle 径(半径) | 0.20mm(半径0.10mm) | A+ |
| Pocket Maximum Width(Pocket内部空間の最大幅) | 1.40 mm | A+ |
| Arm Gap / Opening(Upper Arm–Lower Arm入口ギャップ) | 0.75 mm | A+ |
| Pocket Depth(定義は下記参照) | 3.30 mm | A+ |
| Terminal Shape | Hook-like terminal | A |
| Terminal Length(フック部長さ) | 約2.40 mm | A |

全長「約6.0〜7.5mm」はshojiの見立て(Evidence B、直接計測ではない)であるため、
§1-1で直接実測値があれば更新をお願いします。

**Pocket Depth Definition(固定、2026-07-31確定)**: 後から同じ測定が再現できるよう、
Pocket Depthの定義を以下に固定する。

> Distance from the underside of the Upper Arm tip (Pocket entrance reference
> plane) to the deepest point of the Pocket.
> (Upper Arm先端下面[Pocket入口の基準面]からPocket最深部までの距離)

**Pocket Geometry解釈(Confirmed、Evidence A+からの論理的帰結、Interpretation
v1.7 §1.5参照)**: 入口幅(Arm Gap)0.75mm ≠ 内部最大幅(Pocket Maximum Width)
1.40mmであるため、Pocketは単純な平行隙間ではなく、**入口(狭い開口)→内部で広がる
空間→最深部**という**ファンネル状(内部拡大型)**のGeometryとして扱う。「凹み空間」
というInterpretationと一致する。

**Terminal Shape確定(Evidence A)**: 候補(Simple Radius / Hook / Flat)のうち
**Hook-like**として確定。ただし完全なHook形状ではないため、Geometry分類としては
**"Hook-like terminal"**という表現を維持する(単純なフック関数への安易な当てはめは
しない)。

**形状トポロジー(Evidence B、Interpretation v1.6 §1.3-A、参考・再測定不要)**: Band
Loopの基本形状は「つ」字状の単一連続Centerline(一筆書き)であり、単純なC字リングでも
蛇行したS字部品でもない。腕部分(Upper Arm・Lower Arm)は約3回の主要カーブを描き、
下側先端(Lower Arm側)は反転するような返し曲げ形状に見える、という見立てを踏まえて
以下の測定項目を設計している。

---

## 1. 必須測定項目(Centerline Sweep成立の最低条件)

以下が揃わないと、Centerline Sweep(Method Decision v1.3で決定済みのGeometry方式)の
Meshそのものが生成できません。優先度順に記載します。

### 1-1. Band Loop制御点位置(優先度★★★★★)

完全なCADデータは不要です。**固定数(4点等)ではなく、以下の機能的カテゴリを表現
できる必要最小限の点数**で構いません(v1.1更新、Interpretation §5-A準拠)。

| # | 項目 | 20倍模型実測値 | 実寸換算(÷20) | 備考 |
|---|---|---|---|---|
| 1 | Band Loop全長(直接実測、あれば) | **(未測定)** | | §0の「約6.0〜7.5mm」を裏付け・更新する値 |
| 2 | Shaft接続部(Bridge側の起点) | **(未測定)** | | センターラインの起点 |
| 3 | 主要曲率変化点(複数、点数は形状に応じて) | **(未測定)** | | 見立てでは約3回の主要カーブに対応(§0参照)。1点ごとに番号を振ってください |
| 4 | Pocket形成部 | **(未測定)** | | Central Pocket周辺を通過する点 |
| 5 | 開口端(Upper Arm側) | **(未測定)** | | Upper Armの自由端 |
| 5' | 開口端(Lower Arm側) | **(未測定)** | | Lower Armの自由端。返し曲げ形状(§0参照)の場合はその先端 |

各点は写真上に点・番号を書き込んでいただく形でも構いません(定規や既知サイズの物と
一緒に撮影いただけると較正しやすいです)。「主要曲率変化点」の正確な数(見立てでは
約3回)が分かれば、その代表点で構いません。**固定で4点ちょうど揃える必要はありません**
(形状を表現できる点数を優先)。

### 1-1-A. Shaft接続位置(優先度★★★★★・現時点で唯一の実装Blocker。v1.3で推奨
マーキング3点を明確化)

写真からは、ShaftはLower Arm**根元**ではなく**途中位置**に接続しているように見えます。
これはCenterline Sweepの**開始点(起点)**をどこに置くかに直接影響するため、他の
制御点(1-1)よりも優先して確認が必要です。

**推奨マーキング方法(shoji提案、2026-07-31)**: ノギスによる距離測定に加え、以下
3点を写真上にマーキングしていただくと、Centerline設計が大幅に効率化されます
(この3点が揃えば、Centerline Sweepの起点・Hook-like terminalへの遷移点・Pocket
形成部への経路が全て確定します)。

| # | 項目 | 20倍模型実測値 | 実寸換算(÷20) | 備考 |
|---|---|---|---|---|
| M1 | Lower ArmのCenterline開始点 | **(未測定)** | | Pocket形成部側の起点。Lower Armがどこから始まるか |
| M2 | Hook-like曲げ開始点 | **(未測定)** | | Terminal(Hook-like terminal、§0で確定済み・長さ約2.40mm)の曲げが始まる点。返し曲げの**先端そのもの**(自由端)とは区別する |
| M3 | Shaft中心軸との交点 | **(未測定)** | | Lower ArmのCenterlineとShaft中心軸が交わる位置。= Shaft接続位置そのもの |

参考として、旧来の「返し曲げ終端(Lower Arm自由端、Hook-like terminalの先端)」は
M2から約2.40mm(Terminal Length、既に確定済み)進んだ位置にあたるため、M1・M2・M3
の3点が測定できれば、終端の座標もおおむね算出可能です。**M1〜M3は写真への書き込み
(点・番号のマーキング)でも十分です**(定規や既知サイズの物と一緒に撮影いただけると
較正しやすいです)。

**記入方法の例**: 「Lower Armの根元から実測で◯mm(20倍模型上)の位置にShaftが接続」
「Lower Arm全長のうちおおよそ◯%の位置」等、比率・距離いずれの形でも構いません。
写真への書き込み(Shaft接続点に印を付ける)でも十分です。**この項目が確定するまで、
Centerline Sweepの開始点(Shaft接続部の制御点)は確定できません**(Interpretation
v1.7 §4-5、Improvement Spec v1.2 §2.1参照)。

### 1-2. 「つ」字開口寸法(優先度★★★★★・#6/#7は測定済み)

Soft Clipの臨床的な特徴(閉じたリングではなく、挿入時に開いて保持する弾性機構)を
理解するために必要です。

| # | 項目 | 20倍模型実測値 | 実寸換算(÷20) | 備考 |
|---|---|---|---|---|
| 6 | 開口幅(静止状態) | — | **0.75 mm(測定済み)** | Upper Arm先端とLower Arm先端の間の距離。= Arm Gap(Opening)、Evidence A+ |
| 7 | Pocket入口幅 | — | **0.75 mm(#6と同一値として解決)** | Funnel状Geometry(§0参照)であるため、入口幅=Arm Gapであり、内部最大幅(Pocket Maximum Width 1.40mm)とは別の値として区別される。追加測定不要 |
| 8 | 最大開口方向(v1.1更新、数値不要) | **Evidence B定性記録**: 「装着時にUpper/Lower Arm間が広がる方向」 | (換算不要) | 数値化は不要です。この定性記録のままで確定として扱います(shoji指定) |

### 1-3. Central Pocket関連(優先度★★★★☆・v1.2で#9〜#11測定済み)

最初から複雑な凹形状は不要です。以下の3項目は**目的が異なる別Parameter**として
分離しています(shoji指定)。**2026-07-31、3項目とも実測値を受領し測定済み。**

| # | 項目 | 20倍模型実測値 | 実寸換算(÷20) | 備考 |
|---|---|---|---|---|
| 9 | Arm間距離(Upper Arm・Lower Arm間の**開口側**ギャップ) | — | **0.75 mm(測定済み)** | Pocket最大幅とは別の値。#6(開口幅)と同一値、Evidence A+ |
| 10 | Pocket最大幅(中央Pocket=長脚保持部の**凹み空間そのもの**の最大寸法) | — | **1.40 mm(測定済み)** | Arm間距離とは別の値、Evidence A+。1.40mm≠0.75mmによりFunnel状Geometryが確定(§0参照) |
| 11 | Pocket深さ | — | **3.30 mm(測定済み)** | Evidence A+。定義は§0「Pocket Depth Definition」参照(Upper Arm先端下面→Pocket最深部) |

---

## 2. 可能であれば(推奨、必須ではない)

以下は無理に測定いただかなくても①〜④の作業は進められますが、あると精度が上がります。
**#13(端部形状)は2026-07-31に測定済みへ移行。**

| # | 項目 | 状況 | 備考 |
|---|---|---|---|
| 12 | 板厚分布 | 未測定 | 全長にわたり厚さ0.10mmが一定か、変化する箇所があるか |
| 13 | 端部形状写真 | **測定済み**: Terminal Shape = Hook-like terminal(Evidence A)、Terminal Length 約2.40mm(Evidence A) | Interpretation §4-2で「Hook-like terminal」として確定(完全なHook形状ではない、§0参照)。下側先端の「返し曲げ」形状との関係は1-1-A(Shaft接続位置)で引き続き整理 |
| 14 | Flex領域推定用の側面写真 | 未測定 | Rear Flex Regionがどこからどこまでか、たわむ範囲が分かる角度からの写真(Interpretation §4-3-2と対応) |

**優先度は★★☆☆☆(Priority 5相当)**: 現在のSimulatorの目的は静的教育モデル・配置
理解が主であり、物理的な弾性変形の再現は行わない方針(Method Decision v1.4 §3.3)の
ため、#14は他の項目が揃った後で構いません。

---

## 3. 記入方法

- 数値は20倍模型でのノギス実測値をご記入いただければ、実寸換算(÷20)はこちらで
  計算します。
- センターライン通過点(§1-1、Shaft接続部・主要曲率変化点・Pocket形成部・開口端)は、
  数値座標が難しい場合は写真への書き込み(点・番号)でも構いません。
- 「わからない」「未確認」の項目は空欄のままで問題ありません。**推測値を代入しない
  でください**(Evidence Based Reviewの原則、[[feedback]])。

## 4. 優先度サマリ(2026-07-31更新: 測定済み項目を反映)

| 優先度 | 項目 | 状況 |
|---|---|---|
| ★★★★★ | **Shaft接続位置(§1-1-A、新規)** | **未測定・現時点で残る最重要項目**。Centerline Sweep開始点決定に直接影響 |
| ★★★★★ | Band Loop制御点位置(主要曲率変化点・Pocket形成部・開口端、§1-1) | 未測定。Shaft接続部以外の制御点もCenterline Sweep生成に必要 |
| ★★★★★ | 「つ」字開口寸法(§1-2) | **測定済み**: Arm Gap(Opening)= 0.75mm(A+) |
| ★★★★☆ | Central Pocket関連: Arm間距離・Pocket最大幅・Pocket深さ(§1-3) | **測定済み**: 0.75mm / 1.40mm / 3.30mm(いずれもA+)。Funnel状Geometryとして確定 |
| — | Terminal Shape/Length(§2-13) | **測定済み**: Hook-like terminal / 約2.40mm(いずれもA) |
| ★★★☆☆ | Upper Arm/Lower Armの具体的角度 | 未測定。制御点が決まれば後から調整可能 |
| ★★☆☆☆ | Rear Flex Regionの曲率(§2-14) | 未測定。静的教育モデル・配置理解が主目的のため後回し可 |

---

## 5. 記入後の扱い

このファイルに記入いただいた値を、Evidence A(またはA+)として
`docs/Soft_Clip_Geometry_Improvement_Spec_v1.0.md` §2へ反映します。**§1(必須項目)が
揃えば**、粗いCenterlineでの④実装着手を検討します(shoji確認のうえ)。§2(可能で
あれば)は揃わなくても実装着手を妨げません。実装対象は
`src/scenes/models/ProsthesisModels.tsx`の`SoftClipHead`/`SoftClipStem`/
`SoftClipBridge`/`SoftClipWing`関連のみで、Pose Anchor・Shaft Axis・Safety Engineには
一切触れません。

## 6. 参照文書

- `docs/Soft_Clip_Geometry_Improvement_Spec_v1.0.md`(v1.2、③、Confirmed/Pending整理の出典)
- `docs/Soft_Clip_Geometry_Interpretation_v1.0.md`(v1.7、§1.5 Pocket Geometry[Funnel]・
  §4-2[Terminal Shape確定]・§4-5[Shaft接続位置、新規]の出典)
- `docs/Soft_Clip_Component_Tree_v1.0.md`(v1.2、§2.1論理的サブ構造の出典)
- `docs/Soft_Clip_Geometry_Method_Decision_v1.0.md`(v1.4、Centerline Sweep決定の出典)
- `docs/FlatFoot_Measurement_Record_v1.0.md`(テンプレート形式の参考元)
- `src/scenes/models/ProsthesisModels.tsx`(`SoftClipHead`:437、`SoftClipStem`:428、
  `SoftClipBridge`:409、`SoftClipWing`:384)
