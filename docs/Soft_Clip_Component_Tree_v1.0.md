# Soft Clip Component Tree v1.2

**Status**: Draft(shoji確認・v1.2反映済み)。**コード変更は行っていない(部品構成の定義
とGeometry責務候補の整理のみ、Geometry方式そのものは未決定)**。
**Date**: 2026-07-30(v1.2更新)
**v1.2での変更点(shoji指示、2026-07-30)**:
Band Loopの内部に、**Geometry実装用のMesh分割を意味しない、形状理解・機能理解のための
論理的サブ構造**を追加(新設§2.1)。Upper Arm / Lower Arm / Central Pocket / Rear Flex
Regionの4区分。Interpretation v1.4のクリップ機構(§1.4)を踏まえ、どの部分が保持機能を
担うか・どの部分が弾性変形するか・Geometry方式決定時にどの領域を別扱いする可能性が
あるかを整理する目的。Mesh分割方式・実装方法の確定は本改訂の対象外(shoji指定)。
**v1.1での変更点(shoji指示、2026-07-30)**:
1. §3 Connectionの扱いを確定: 独立したMesh Componentとして列挙しない方針をshojiが承認。
   Connectionは今後Anchor / Coordinate Definitionとして扱う(Open Questionから
   Confirmedへ)。
2. §2の部品定義表に「Geometry責務(候補)」列を追加(例: Shaft→Cylinder、
   Bridge→Transition Surface、Band Loop→曲線/板形状候補)。**これはGeometry方式の決定
   ではなく、各部品がどの種類の形状責務を担うかという分類の整理に留まる**。方式決定
   (ExtrudeGeometry/boxGeometryチェーン等の選定)は次ステップ②で引き続き行う。
**位置づけ**: `docs/Soft_Clip_Geometry_Interpretation_v1.0.md`(①Interpretation)の
補助文書。shoji提案(2026-07-30)により、Geometry方式(②)を議論する前に「Soft Clipが
何個の部品で構成されるか」を先に固定するために作成する。FlatFootでは断面形状の解釈違いが
手戻りの原因になったが、Soft Clipでは断面に加えて**部品点数・階層の認識**が固まって
いないままGeometry方式(ExtrudeGeometry/複数Mesh等)を選ぶと、同様の手戻りが起きうる
というのがshojiさんの指摘。

---

## 1. Component Tree(現時点の理解)

```
Soft Clip
├─ Shaft Lower          [Confirmed]  径0.40mm・長さ2.17mm(実寸)、Band Loopから見て遠位
├─ Shaft Middle         [Confirmed]  径0.20mm・長さ1.33mm(実寸、8種の製品長で変化する区間)
├─ Bridge               [Confirmed]  T字接合部。Shaft MiddleとBand Loopを接合
└─ Band Loop            [Confirmed as 1部品、内部構造はOpen]
     帯状部材1本、実寸長さ約6.0〜7.5mm・幅0.25mm・厚さ0.10mm、ねじりなし、
     8箇所で前後に成形され、単純なC字リングではなく「つ」字状の開口部を持つ弾性
     クリップ形状(2026-07-30訂正、[[Soft_Clip_Geometry_Interpretation_v1.0]] v1.4
     §1.3・§1.4参照)。
     │
     ├─ [Mesh分割の観点、Open] 終端フィーチャー A  種別未確定(ループ/フック/突起)
     ├─ [Mesh分割の観点、Open] 終端フィーチャー B  種別未確定(ループ/フック/突起)
     ├─ [Mesh分割の観点、Open] (中間フィーチャー?) 経路途中に追加の突起等があるかも未確定
     │
     └─ [論理的サブ構造、v1.2新設、詳細は§2.1] Mesh分割ではなく機能理解のための区分
          ├─ Upper Arm          開口部の上側の腕
          ├─ Lower Arm          開口部の下側の腕
          ├─ Central Pocket     Upper/Lower Armに囲まれた中央の窪み(長脚の収納空間)
          └─ Rear Flex Region   後方の弯曲部(SOFTCLIPフック接触点)
```

**部品点数(現時点の回答)**: 大分類では**4部品**(Shaft Lower / Shaft Middle / Bridge /
Band Loop)がConfirmed。ただしBand Loop内部の終端フィーチャー数(2個か3個か)は
Open Questionのため、Geometry上の最終的なメッシュ分割数はこれに依存し確定していない。
なお、上記の論理的サブ構造(Upper Arm等)はこの「終端フィーチャー」のOpen Questionとは
別軸の整理であり、Mesh分割数を先取りして決定するものではない(§2.1参照)。

## 2. 各部品の定義(現時点でConfirmedな範囲)

**寸法表記について**: 下表の「寸法」列は[[Soft_Clip_Geometry_Interpretation_v1.0]]
§1.2の用語整理に従い、撮影スケール換算(20×、Geometry実装で用いるべき値)を記載する。
20倍模型を直接実測した実寸径(Shaft Lower 8.0mm・Shaft Middle 4.0mm)とは区別すること。

| 部品名 | 状態 | 寸法(撮影スケール換算[20×]) | Geometry責務(候補、方式は未決定) | 備考 |
|---|---|---|---|---|
| Shaft Lower | Confirmed | 長さ2.17mm・径0.40mm(半径0.20mm) | Cylinder(円柱) | シャフトのうちBand Loopから
  見て最も遠い側の区間。v1.0で「撮影用治具」と誤認していたが本体の一部と訂正済み
  ([[Soft_Clip_Geometry_Interpretation_v1.0]] §4-1) |
| Shaft Middle | Confirmed | 長さ1.33mm・径0.20mm(半径0.10mm) | Cylinder(円柱) | 製品の8種類の長さ
  ラインナップに対応し、長さのみ変化する区間(断面径は共通) |
| Bridge | Confirmed(存在は確実、詳細形状はOpen) | 未計測 | Transition Surface
  (Shaft MiddleとBand Loopの径・断面形状[円形→矩形]をつなぐ遷移面) | Shaft MiddleとBand Loopを
  接合するT字の分岐点。具体的な形状(単純な直線的T字か、丸みを帯びた接合部か)は10方向
  画像からの視認のみで、寸法計測はまだない |
| Band Loop | Confirmed(1部品として)、内部の経路はOpen | 全長約6.0〜7.5mm・断面
  幅0.25mm×厚さ0.10mm | 曲線/板形状候補(矩形断面[0.25×0.10mm]を曲げ経路に沿って
  掃引する形状。具体的な生成方式[Extrude/box連結等]は未決定) | 帯状部材1本。ねじりなし、8箇所で前後に成形、単純なC字リングではなく
  「つ」字状の開口部を持つ弾性クリップ形状(2026-07-30訂正)。両端(または経路途中)のフィーチャー数・形状はOpen([[Soft_Clip_Geometry_Interpretation_v1.0]]
  §4-2) |

**Geometry責務列の位置づけ(v1.1、shoji指示)**: 各部品が「どの種類の形状カテゴリに
属するか」という分類の整理であり、具体的な実装方式(three.jsのどのGeometryクラスを
使うか、断面をどうスイープするか等)を決定するものではない。方式決定は次ステップ②
(`Soft_Clip_Geometry_Interpretation_v1.0.md` §5の候補A/B/C)で改めて行う。

## 2.1 Band Loopの論理的サブ構造(v1.2新設、Mesh分割ではない)

**目的(shoji指示、2026-07-30)**: Band Loopは§1・§2ではConfirmedな1部品として扱って
いるが、Geometry実装用のMesh分割を先取りするのではなく、**形状理解・機能理解のための
論理的サブ構造**として以下の4区分を導入する。目的は(a)どの部分が保持機能を担うか、
(b)どの部分が弾性変形するか、(c)Geometry方式決定時にどの領域を別扱いする可能性が
あるか、を明確にすること。**本節はMesh分割方式・実装方法を確定するものではない**
(shoji指定)。

| 論理区分 | 機能理解(Interpretation v1.4 §1.4クリップ機構との対応) | 状態 | 関連Open Question |
|---|---|---|---|
| Upper Arm | 「つ」の開口部の上側の腕。静止時に中央へすぼまり保持力の一部を担う。shojiの説明では「上部が弾性変形して広がる」とされており、Rear Flex Regionと連続する領域である可能性がある | Confirmed(機能区分として存在)、正確な範囲・先端形状はOpen | 先端形状は4-2、弾性変形の有無・範囲は4-3-2 |
| Lower Arm | 「つ」の開口部の下側の腕。静止時に中央へすぼまり保持力の一部を担う。shojiの説明は「上部」の弾性変形に言及しているため、Lower Armは相対的に剛性が高い(変形しない)側である可能性があるが未確認 | Confirmed(機能区分として存在)、正確な範囲・先端形状・弾性変形の有無はOpen | 先端形状は4-2、弾性変形の有無は4-3-2(Upper/Lower間で非対称かどうかも含め未確認) |
| Central Pocket | Upper Arm・Lower Armに囲まれた中央の窪み。キヌタ骨長脚が収納される空間そのものであり、Band Loopの物理的な帯の一部というより、帯に囲まれた領域(座標・空間)として理解する方が近い | Confirmed(機能的空間として存在)、正確な形状・寸法はOpen | 直接対応するOpen Questionはないが、将来Anchor/Coordinate Definitionの対象になりうる([[Prosthesis_Reference_Geometry_Definition_v1.0]]と同様の扱い、§3参照) |
| Rear Flex Region | 「つ」の後方にある弯曲部。SOFTCLIPフックが接触し、前方へ押されることで力が伝達される起点 | Confirmed(機能区分として存在)、正確な曲率・弾性変形領域との境界はOpen | 正確な曲率は4-3-1、弾性変形領域の境界は4-3-2 |

**注記**: 上記4区分は`SoftClipBridge()`/`SoftClipWing({side:1})`/`SoftClipWing({side:-1})`
という現行コードの3mesh構成(§4参照)とは意図的に対応付けていない。現行コードのmesh
境界と、Interpretation由来の機能境界(Upper Arm/Lower Arm/Central Pocket/Rear Flex
Region)が一致するかどうかは、②Geometry方式決定・③Improvement Specの段階で改めて
検討する。

## 3. Connection(接続点)の扱いについて — **Confirmed(shoji承認、2026-07-30)**

shojiさんが例示した構造案には`Connection`という項目が含まれていたが、本文書では
独立した「部品」としては列挙しない。理由: 現行コードの設計思想
(`docs/Prosthesis_Reference_Geometry_Definition_v1.0.md`)では、Anchor/Pose Solverが
参照する接続点は「部品そのものの一部」ではなく「部品群のローカル座標系における基準点
(原点)」として扱われている(例: PistonFoot・FlatFootのローカル原点=Anchor)。Soft Clip
でも同様に、Shaft MiddleとBridgeの接合点(またはShaft LowerとShaft Middleの段差位置)が
「Connection」に相当する。

**shoji承認(2026-07-30)**: Connectionを独立部品から除外する判断は問題なし。Connection
はMesh Componentではなく、**Anchor / Coordinate Definition**として後続(次ステップ②
Geometry方式決定、または③Improvement Spec)で座標系として扱う。本項目はOpen Question
からConfirmedへ移行し、Component Tree(§1)の部品リストには含めない方針を確定する。

## 4. 現行コードとの対応関係(参考、変更提案ではない)

現行`ProsthesisModels.tsx`の実装と、本文書のComponent Treeの対応を整理する
(**現時点では実装への反映は行わない、あくまで対応関係の整理**)。

| Component Tree上の部品 | 現行コード | 対応状況 |
|---|---|---|
| Shaft Lower | `ProsthesisModel()`内のシャフト`mesh`(半径`r = product.type === 'PISTON' ? 0.20 : 0.10`) | 現行コードはPISTON製品のシャフト**全長**を一律半径0.20mmで描画している。これは
  Shaft Lowerの半径(0.20mm)とは数値が一致するが、Shaft Middle(半径0.10mm)の区間にも
  同じ0.20mmが適用されてしまっている状態(`Soft_Clip_Geometry_Audit_v1.0.md` §10.2で
  既出の新規発見と同一) |
| Shaft Middle | 同上(区別なし) | 同上。現行コードには「Lower/Middleの2段」という
  区分が存在しない |
| Bridge | `SoftClipStem()`(`cylinderGeometry(0.06,0.07,CLIP_STEM_H=0.20)`) | 名称・
  形状(単純な円柱)とも本文書のBridgeの理解と一致しない可能性がある。現行コードの
  `SoftClipStem`は円柱、本文書のBridgeはT字分岐点という理解 |
| Band Loop | `SoftClipBridge()`+`SoftClipWing({side:1})`+`SoftClipWing({side:-1})` | 現行
  コードは3つの独立したTubeGeometry meshに分かれている。本文書の理解(1本の連続した
  帯)が正しい場合、この3分割自体がGeometry方式決定(②)で見直しの対象になりうる |

**注記**: 上表は「現行コードが間違っている」と断定するものではない。現行コードは
2026-07-02時点の限られたEvidence(ノギス実測+6方向写真+GLBスキャン)に基づく実装であり、
今回受領した10方向画像+新しい寸法(Shaft Lower/Middle・Band Loop全長)によって、より
正確な部品構成の理解が得られた、という位置づけ。

## 5. Next Step

1. ~~本文書と`Soft_Clip_Geometry_Interpretation_v1.0.md`の両方をshojiさんに確認いただく。~~
   完了。本文書§3(Connectionの扱い)はshoji承認によりConfirmed(v1.1)。
2. 残る臨床形状のOpen Question(4.A)は`Soft_Clip_Geometry_Interpretation_v1.0.md`
   §4-2(Band Loop終端フィーチャー数)・§4-3(曲げの性質)の2点のみ(v1.3でカテゴリ
   整理、4.B=実装方式検討事項の4-4とは区別)。これらの確認が得られ次第、
   Interpretation文書を改訂する(本文書のGeometry責務列・部品構成には影響しない
   見込み)。
3. ~~部品構成(大分類4部品)とGeometry責務(候補)は確定した。次はshoji指定の手順②
   「Geometry方式の決定」(ExtrudeGeometry/boxGeometryチェーン/現行維持のいずれか)に
   進む。~~ `docs/Soft_Clip_Geometry_Method_Decision_v1.0.md`作成済み。Shaft
   Lower/Middleは責務通りCylinderでDecided、Bridge・Band LoopはEvidence不足・4-4
   (Centerline vs Plate deformation)未決定のためPending。
4. ~~Band Loopの論理的サブ構造(Upper Arm/Lower Arm/Central Pocket/Rear Flex Region)を
   追加する。~~ 完了(v1.2、§2.1)。shoji承認済み。Mesh分割方式・実装方法の確定は
   引き続き未着手。
5. 本文書の更新(v1.2)を踏まえ、`docs/Soft_Clip_Geometry_Method_Decision_v1.0.md`の
   Band Loopに関する検討(§3)を、Interpretation v1.4のクリップ機構および本文書§2.1の
   論理的サブ構造を反映して更新する。ただしMesh分割方式・実装方法自体は確定しない
   (shoji指定)。
6. **現時点ではコード変更を行わない**(Phase 2は引き続きOn Hold)。

## 6. 参照文書

- `docs/Soft_Clip_Geometry_Interpretation_v1.0.md`(①Interpretation、本文書と対で参照)
- `docs/Soft_Clip_Geometry_Audit_v1.0.md`(G3-3、Phase 1 Completed・Phase 2 On Hold)
- `docs/Soft_Clip_Geometry_Method_Decision_v1.0.md`(②Geometry方式決定。Shaft
  Lower/MiddleはDecided、Bridge・Band LoopはPending)
- `docs/Prosthesis_Reference_Geometry_Definition_v1.0.md`(Anchor/接続点の既存設計思想)
- `src/scenes/models/ProsthesisModels.tsx`(`SoftClipHead`:437、`SoftClipStem`:428、
  `SoftClipBridge`:409、`SoftClipWing`:384、`ProsthesisModel`シャフト計算部)
