# TORP / Soft Clip Geometry Audit v1.0

**Status**: Draft(shoji確認待ち)
**Date**: 2026-07-30
**位置づけ**: `docs/Prosthesis_Geometry_Audit_Plan_v1.0.md` Phase G1-3。
`docs/Prosthesis_Reference_Landmark_Definition_v1.0.md`(G1-1/G1-2、Confirmed)の続き。
対象: TORP(`FlatFoot`)寸法監査、Soft Clip(`SoftClipHead`/`PistonFoot`)のHead Center・
Contact Landmark確認。**コード変更は行わない(調査文書)**。P4C-0(Blocked/Deferred)の判断は
変更せず、`composeNormal()`実装には着手しない。

---

## Executive Summary

1. **TORP FlatFootのVisual Mesh寸法は、shojiさんが今回実測した実物値(Evidence A+)と
   大きく乖離している**(高さ約48%、内径約41%相当しかない)。Anchor Landmarkの設計自体は
   `Prosthesis_Reference_Landmark_Definition_v1.0.md` §2.1で確認済み(変更不要)だが、
   これとは独立に、Visual Meshの絶対サイズが実物より小さく描画されている。
2. **Soft Clip Head Center**: `SoftClipHead`のローカル原点(0,0,0)は`SoftClipStem`底面と
   一致し、シャフト軸上に厳密に位置する(X/Zオフセットなし)。`BELL_TOP`のような
   (+0.14,−0.24)相当の意図的オフセットは存在しない。
3. **Soft Clip Contact Landmark(PistonFoot)**: G1-2で既に「ほぼ整合(約0.03mmギャップ)」と
   判定済み。今回の再確認でも変更なし。
4. **PistonFoot自体もFlatFoot同様、コード内に実測・スケール係数の記載がない**
   (`Prosthesis_Geometry_Audit_Plan_v1.0.md` ⑥の分類通りUnknown〜C相当)。今回は寸法の
   実測データ取得までは行っていない(Known Unknownとして記録)。

---

## 1. TORP FlatFoot: 寸法監査(コード vs 実測)

### 1.1 実測値(Evidence A+、shoji 2026-07-30、20倍模型ノギス実測)

| 項目 | 20倍模型実測値 | 実寸換算(÷20) |
|---|---|---|
| 高さ | 16.0 mm | 0.80 mm |
| 開口部厚み(壁厚) | 2.0 mm | 0.10 mm |
| 内径 | 11.8 mm | 0.59 mm(半径0.295mm) |
| 外径 | 15.8 mm | 0.79 mm(半径0.395mm) |

検算: (外径−内径)/2 = (0.79−0.59)/2 = 0.10mm = 実測壁厚と一致 ✓ 内部整合性あり。

構造補足(shoji確認事項): 下面(アブミ骨底板側)は開口構造、天井付近はテーパー形状、円柱上部縁
には面取りあり。単純な直円柱ではなく「釣り鐘型に近い中空構造」。

### 1.2 現行コード値(`FlatFoot()`、`ProsthesisModels.tsx:609-624`)

```
外側: cylinderGeometry(radiusTop=0.24, radiusBottom=0.18, height=0.42)
内側(中空部): cylinderGeometry(radius=0.09, height=0.28), position y=-0.08
```

コードにはBellFoot(`:507`)のような「20×実測 → スケール係数 → 実寸」の導出コメントが無く、
`Prosthesis_Geometry_Audit_Plan_v1.0.md`表⑥の分類通りEvidence Unknown〜C相当(カタログ記述
ベースの推定値)。

### 1.3 比較

| 項目 | コード値(実寸) | 実測値(実寸、Evidence A+) | 比率(コード/実測) |
|---|---|---|---|
| 高さ | 0.42 mm | 0.80 mm | 約53% |
| 外径(半径) | 0.24 / 0.18 mm(top/bottom) | 0.395 mm | 約46-61% |
| 内径(半径) | 0.09 mm | 0.295 mm | 約31% |

**所見**: 高さ・外径・内径のいずれもコード値が実測値より小さく、特に内径(中空部)の乖離が
最大(実測の約3分の1)。`Prosthesis_Reference_Landmark_Definition_v1.0.md` §2.1で確認した
「Anchor⇔接触面の約0.21mmギャップは簡略化されたGeometry表現による差」という判断は、
Anchorの**位置**(shaft axis基準点=foot中央)については変更不要のまま成立する。一方、
Visual Meshの**絶対サイズ**が実物と乖離している点は独立した問題であり、教育用3Dモデルとして
の解剖学的・形態学的な見た目の正確性に影響する。

### 1.4 Risk評価

- **Clinical/Safety直接影響**: 低。`LandmarkMeasurements.md`のSafety距離計算は
  `STAPES_FOOTPLATE`等のランドマーク座標を基準にしており、Foot Mesh自体のサイズを参照しない
  (dangerZonePointはPose/Flagに非依存、[[coord_phase_implementation]]系の既存確認と整合)。
- **教育的妥当性への影響**: 中。20倍教育モデルとして「TORPの先端はカニュレート(中空)構造で
  流体接着力を得る」という解剖学的説明(コード冒頭コメント`:604-608`)を視覚的に正しく伝える
  上で、実物より小さい・薄い表現になっている可能性。
- **技術的負債**: 中。将来Phase G3(製品別改善実装)でのCAD値更新候補として記録。

---

## 2. Soft Clip: Head Center確認(G1-1の残り、Unknown解消)

### 2.1 コード構造(`SoftClipHead()`、`:437-446`とその構成要素)

```
SoftClipStem  : cylinderGeometry(0.06, 0.07, CLIP_STEM_H=0.20), position y=0.10 → 局所y=[0, 0.20]
SoftClipBridge: TubeGeometry、制御点 y≈0.54-0.57、x=±0.03範囲
SoftClipWing×2: TubeGeometry、制御点 x=side×[0.03..0.90]、y=[0.18..0.57]、z=[-0.08..0.09]
```

### 2.2 結論

`SoftClipStem`の底面(y=0)が`SoftClipHead`グループの局所原点(0,0,0)と一致し、X/Z方向の
オフセットはゼロ(ステムはx=0,z=0上の円柱として定義)。つまり**シャフト軸はSoft Clip Head
の原点を厳密に貫通しており、`BELL_TOP`の(+0.14,−0.24)のような意図的オフセットは存在しない**。

Bridge/Wingが原点からy=+0.18〜+0.57、x=±0.90まで非対称に広がるのは、シャフト接合点から
片側(頭側)へ伸びる構造上自然な広がりであり、「原点そのものの位置がずれている」という意味
でのオフセットではない。BELL_TOPのケースとは性質が異なる点に注意(BELL_TOPは対称形状の
中心そのものが軸からずれている一方、Soft Clipは原点=軸上にあり、その上に非対称な構造が
生えている)。

**G1-1「SOFT_CLIP: 個々の部品中心・全体としての幾何中心は未確認」への回答**: Pose計算上
参照される原点(Anchor相当)はシャフト軸上に確認された。装置全体の視覚的な質量中心
(Bridge/Wingを含めた重心)までは未算出だが、Pose Solverが参照するのは原点であり質量中心
ではないため、Phase G1の目的(Reference Geometry監査)としては本項目は解消と判断する。

---

## 3. Soft Clip: Contact Landmark確認(PistonFoot、G1-2からの引き継ぎ確認)

`Prosthesis_Reference_Landmark_Definition_v1.0.md` §2(G1-2)で既に確認済みの内容を再確認:

- `PistonFoot()`(`:685-700`)の半球tip(`sphereGeometry(0.20, ..., thetaLength=Math.PI*0.55)`)
  は局所原点を中心に描画され、球の下端(接触面側)はy≈−0.031付近に位置する。
- 局所原点(0,0,0、Anchor)との差は約0.03mm。
- 評価: **ほぼ整合**(BELLほど厳密な一致ではないが、実務上小さいギャップ)。

今回のG1-3再確認でも数値・評価に変更なし。追加のEvidence取得(実測)は行っていない
(§4 Known Unknownsに記録)。

---

## 4. Known Unknowns(次調査、優先度順)

1. **FlatFoot Visual Mesh寸法の更新要否**(§1): 実装変更を伴うため、Phase G3(製品別改善
   実装)でshojiさんと着手判断。今回はAudit結果の記録のみ。
2. **PistonFootの寸法根拠**: `SoftClipStem`/`Bridge`/`Wing`(ワイヤー0.235×0.095mm等)は
   2026-07-02のノギス実測でEvidence A相当だが、`PistonFoot`自体(半球r=0.20、collar
   r=0.20×h=0.20)には対応する実測コメントがなく、根拠不明(Unknown〜C相当)。今回は追加
   実測を行っていない。
3. **Soft Clip全体スパン(約1.8mm)/ウィング曲率半径R**: `ProsthesisModels.tsx:359-362`に
   既存の「暫定値、要追加ノギス計測」の記載あり(2026-07-02時点)。本Auditでは未着手。

---

## 5. Next Step

本文書をshojiさんに確認のうえ、以下のいずれかへ進む。

- **Phase G2(Reference Geometry定義)**: G1-1〜G1-3で確認したOrigin/Anchor/Contact
  Landmarkを正式なReference Geometry層として整理する。
- **Phase G3先行着手**: FlatFoot寸法(§1)を優先的に実測ベースへ更新する(Small Change、
  Anchor設計は不変のままVisual Meshのみ調整)。
- **Known Unknowns(§4)の追加実測**: PistonFoot/Soft Clip全体スパンの計測を先に行う。

いずれもP4C(composeNormal)の再開条件ではなく、Blocked/Deferredの判断は維持する。

## 6. 参照文書

- `docs/Prosthesis_Geometry_Audit_Plan_v1.0.md`(Phase G1全体計画)
- `docs/Prosthesis_Reference_Landmark_Definition_v1.0.md`(G1-1/G1-2、本文書の前提)
- `src/scenes/models/ProsthesisModels.tsx`(`FlatFoot`:609、`SoftClipHead`:437、
  `SoftClipStem`:428、`SoftClipBridge`:409、`SoftClipWing`:384、`PistonFoot`:685)
- `src/data/products.ts`(torp-ttp-variac:64、soft-clip-stapes:96)
