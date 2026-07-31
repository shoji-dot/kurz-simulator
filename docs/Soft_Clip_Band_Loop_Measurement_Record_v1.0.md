# Soft Clip Band Loop Measurement Record v1.0

**Status**: 未測定(shoji記入待ち)。**このファイル自体はコード変更を伴わない。**
**Date**: 2026-07-30(v1.1更新)
**v1.1での変更点(shoji追加観察、2026-07-30)**: Interpretation v1.6のCenterline
トポロジー精密化(「つ」字状一筆書き、腕部分に約3回の主要カーブ、下側先端に返し曲げ
形状)を反映。①§1-1の制御点を固定数(P0〜P3)から、Shaft接続部・主要曲率変化点(複数)・
Pocket形成部・開口端という機能的カテゴリへ変更。②§1-3にPocket深さを新規項目として
追加し、Pocket最大幅・Arm間距離との違いを明記。③§1-2の最大開口方向をEvidence B定性
記録(数値不要)として扱う旨を明確化。
**位置づけ**: `docs/Soft_Clip_Geometry_Improvement_Spec_v1.0.md`(③、v1.1)§2の
Pending項目を解消するための測定依頼テンプレート。shoji整理(2026-07-30)による優先
順位付けに基づく。

**目的(shoji指定)**: **「精密な完成形を測る」ことではなく、Centerline Sweepが成立する
最低限の骨格情報を取得すること**。全ての寸法を埋めることを目的とせず、Geometry生成に
必要なParameterのみを優先する。**推測値の代入・記入は禁止**(未測定の項目は空欄のまま
でよい)。

---

## 0. 既に確定済みの値(参考、再測定不要)

`docs/Soft_Clip_Geometry_Interpretation_v1.0.md` §1.2で取得済み(Evidence A、撮影
スケール換算[20×])。

| 項目 | 値 |
|---|---|
| Band Loop 幅(断面長辺) | 0.25 mm |
| Band Loop 厚さ(断面短辺) | 0.10 mm |
| Band Loop 全長(見立て、Evidence B) | 約6.0〜7.5mm |
| Shaft Lower 径(半径) | 0.40mm(半径0.20mm) |
| Shaft Middle 径(半径) | 0.20mm(半径0.10mm) |

全長「約6.0〜7.5mm」はshojiの見立て(Evidence B、直接計測ではない)であるため、
§1-1で直接実測値があれば更新をお願いします。

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

### 1-2. 「つ」字開口寸法(優先度★★★★★)

Soft Clipの臨床的な特徴(閉じたリングではなく、挿入時に開いて保持する弾性機構)を
理解するために必要です。

| # | 項目 | 20倍模型実測値 | 実寸換算(÷20) | 備考 |
|---|---|---|---|---|
| 6 | 開口幅(静止状態) | **(未測定)** | | Upper Arm先端とLower Arm先端の間の距離 |
| 7 | Pocket入口幅 | **(未測定)** | | 開口部からCentral Pocketへ入る部分の幅(#6と異なる場合) |
| 8 | 最大開口方向(v1.1更新、数値不要) | **Evidence B定性記録**: 「装着時にUpper/Lower Arm間が広がる方向」 | (換算不要) | 数値化は不要です。この定性記録のままで確定として扱います(shoji指定) |

### 1-3. Central Pocket関連(優先度★★★★☆、初期モデルは簡易形状で可。v1.1で3項目に分離)

最初から複雑な凹形状は不要です。以下の3項目は**目的が異なる別Parameter**として
分離しています(shoji指定)。

| # | 項目 | 20倍模型実測値 | 実寸換算(÷20) | 備考 |
|---|---|---|---|---|
| 9 | Arm間距離(Upper Arm・Lower Arm間の**開口側**ギャップ) | **(未測定)** | | Pocket最大幅とは別の値。開口部での腕どうしの間隔 |
| 10 | Pocket最大幅(中央Pocket=長脚保持部の**凹み空間そのもの**の最大寸法) | **(未測定)** | | Arm間距離とは別の値 |
| 11 | Pocket深さ(新規、v1.1) | **(未測定)** | | Pocket凹みの深さ方向の寸法 |

---

## 2. 可能であれば(推奨、必須ではない)

以下は無理に測定いただかなくても①〜④の作業は進められますが、あると精度が上がります。

| # | 項目 | 備考 |
|---|---|---|
| 12 | 板厚分布 | 全長にわたり厚さ0.10mmが一定か、変化する箇所があるか |
| 13 | 端部形状写真 | Upper Arm・Lower Armの先端が単純端面/フック形状/突起形状のいずれか(Interpretation §4-2と対応。下側先端の「返し曲げ」形状[§0]の確認にも有用) |
| 14 | Flex領域推定用の側面写真 | Rear Flex Regionがどこからどこまでか、たわむ範囲が分かる角度からの写真(Interpretation §4-3-2と対応) |

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

## 4. 優先度サマリ(shoji整理、2026-07-30)

| 優先度 | 項目 | 理由 |
|---|---|---|
| ★★★★★ | Band Loop制御点位置(§1-1) | Centerline Sweep自体が生成できないため必須 |
| ★★★★★ | 「つ」字開口寸法(§1-2) | 臨床的な機構理解(挿入時に開いて保持する弾性機構)に直結 |
| ★★★★☆ | Central Pocket関連: Arm間距離・Pocket最大幅・Pocket深さ(§1-3) | 初期モデルは簡易形状で成立可、複雑な凹形状は不要 |
| ★★★☆☆ | Upper Arm/Lower Armの具体的角度 | 制御点が決まれば後から調整可能、本テンプレートでは§2-13で部分的にカバー |
| ★★☆☆☆ | Rear Flex Regionの曲率(§2-14) | 静的教育モデル・配置理解が主目的のため後回し可 |

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

- `docs/Soft_Clip_Geometry_Improvement_Spec_v1.0.md`(③、Confirmed/Pending整理の出典)
- `docs/Soft_Clip_Geometry_Interpretation_v1.0.md`(v1.5、§4-2/4-3-1/4-3-2の出典)
- `docs/Soft_Clip_Component_Tree_v1.0.md`(v1.2、§2.1論理的サブ構造の出典)
- `docs/Soft_Clip_Geometry_Method_Decision_v1.0.md`(v1.3、Centerline Sweep決定の出典)
- `docs/FlatFoot_Measurement_Record_v1.0.md`(テンプレート形式の参考元)
- `src/scenes/models/ProsthesisModels.tsx`(`SoftClipHead`:437、`SoftClipStem`:428、
  `SoftClipBridge`:409、`SoftClipWing`:384)
