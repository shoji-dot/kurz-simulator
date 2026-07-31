# Soft Clip Band Loop Measurement Record v1.0

**Status**: 未測定(shoji記入待ち)。**このファイル自体はコード変更を伴わない。**
**Date**: 2026-07-30
**位置づけ**: `docs/Soft_Clip_Geometry_Improvement_Spec_v1.0.md`(③)§2のPending
5項目を解消するための測定依頼テンプレート。shoji整理(2026-07-30)による優先順位付け
に基づく。

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

---

## 1. 必須測定項目(Centerline Sweep成立の最低条件)

以下が揃わないと、Centerline Sweep(Method Decision v1.3で決定済みのGeometry方式)の
Meshそのものが生成できません。優先度順に記載します。

### 1-1. Band Loop制御点位置(優先度★★★★★)

完全なCADデータは不要です。粗いCenterline(P0→P1→P2→P3程度の数点)で構いません。

| # | 項目 | 20倍模型実測値 | 実寸換算(÷20) | 備考 |
|---|---|---|---|---|
| 1 | Band Loop全長(直接実測、あれば) | **(未測定)** | | §0の「約6.0〜7.5mm」を裏付け・更新する値 |
| 2 | センターライン通過点(P0: 開始点) | **(未測定)** | | Rear Flex Region側の起点。写真への点書き込み・番号振りでも可 |
| 3 | センターライン通過点(P1: 曲率変化点) | **(未測定)** | | Arm分岐位置付近 |
| 4 | センターライン通過点(P2: Pocket中心) | **(未測定)** | | Central Pocketの中心付近 |
| 5 | センターライン通過点(P3: 終了点) | **(未測定)** | | 開口部側のもう一方の端 |

P1〜P3は写真上に点・番号を書き込んでいただく形でも構いません(定規や既知サイズの
物と一緒に撮影いただけると較正しやすいです)。「何箇所で曲げられているか」の正確な
数(既存の見立てでは約8箇所)が分かれば、P1〜P3はその一部の代表点で構いません。

### 1-2. 「つ」字開口寸法(優先度★★★★★)

Soft Clipの臨床的な特徴(閉じたリングではなく、挿入時に開いて保持する弾性機構)を
理解するために必要です。

| # | 項目 | 20倍模型実測値 | 実寸換算(÷20) | 備考 |
|---|---|---|---|---|
| 6 | 開口幅(静止状態) | **(未測定)** | | Upper Arm先端とLower Arm先端の間の距離 |
| 7 | Pocket入口幅 | **(未測定)** | | 開口部からCentral Pocketへ入る部分の幅(#6と異なる場合) |
| 8 | 最大開口方向 | **(未測定・定性可)** | | 開口部がどの向きを向いているか(Shaft軸に対する角度、または「側方」「前方」等の定性的な説明で可) |

### 1-3. Central Pocket形状(優先度★★★★☆、初期モデルは簡易形状で可)

最初から複雑な凹形状は不要です。Upper Arm・Lower Armに挟まれた窪みとして最低限の
輪郭が分かれば十分です。

| # | 項目 | 20倍模型実測値 | 実寸換算(÷20) | 備考 |
|---|---|---|---|---|
| 9 | Arm間距離(Upper Arm・Lower Armの分岐位置間) | **(未測定)** | | Bridge/Rear Flex Region側での間隔 |
| 10 | Pocket最大幅 | **(未測定)** | | Central Pocketが最も広い箇所の幅 |

---

## 2. 可能であれば(推奨、必須ではない)

以下は無理に測定いただかなくても①〜④の作業は進められますが、あると精度が上がります。

| # | 項目 | 備考 |
|---|---|---|
| 11 | 板厚分布 | 全長にわたり厚さ0.10mmが一定か、変化する箇所があるか |
| 12 | 端部形状写真 | Upper Arm・Lower Armの先端が単純端面/フック形状/突起形状のいずれか(Interpretation §4-2と対応) |
| 13 | Flex領域推定用の側面写真 | Rear Flex Regionがどこからどこまでか、たわむ範囲が分かる角度からの写真(Interpretation §4-3-2と対応) |

**優先度は★★☆☆☆(Priority 5相当)**: 現在のSimulatorの目的は静的教育モデル・配置
理解が主であり、物理的な弾性変形の再現は行わない方針(Method Decision v1.3 §3.3)の
ため、#13は他の項目が揃った後で構いません。

---

## 3. 記入方法

- 数値は20倍模型でのノギス実測値をご記入いただければ、実寸換算(÷20)はこちらで
  計算します。
- センターライン通過点(P0〜P3)は、数値座標が難しい場合は写真への書き込み(点・
  番号)でも構いません。
- 「わからない」「未確認」の項目は空欄のままで問題ありません。**推測値を代入しない
  でください**(Evidence Based Reviewの原則、[[feedback]])。

## 4. 優先度サマリ(shoji整理、2026-07-30)

| 優先度 | 項目 | 理由 |
|---|---|---|
| ★★★★★ | Band Loop制御点位置(§1-1) | Centerline Sweep自体が生成できないため必須 |
| ★★★★★ | 「つ」字開口寸法(§1-2) | 臨床的な機構理解(挿入時に開いて保持する弾性機構)に直結 |
| ★★★★☆ | Central Pocket形状(§1-3) | 初期モデルは簡易形状で成立可、複雑な凹形状は不要 |
| ★★★☆☆ | Upper Arm/Lower Armの具体的角度 | 制御点が決まれば後から調整可能、本テンプレートでは§2-12で部分的にカバー |
| ★★☆☆☆ | Rear Flex Regionの曲率(§2-13) | 静的教育モデル・配置理解が主目的のため後回し可 |

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
