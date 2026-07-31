# Soft Clip Component Tree v1.0

**Status**: Draft(shoji確認待ち)。**コード変更は行っていない(部品構成の定義のみ)**。
**Date**: 2026-07-30
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
     8箇所で前後に波打つように曲げ、全体でC字状。
     │
     ├─ 終端フィーチャー A  [Open] 種別未確定(ループ/フック/突起)
     ├─ 終端フィーチャー B  [Open] 種別未確定(ループ/フック/突起)
     └─ (中間フィーチャー?) [Open] 経路途中に追加の突起等があるかも未確定
```

**部品点数(現時点の回答)**: 大分類では**4部品**(Shaft Lower / Shaft Middle / Bridge /
Band Loop)がConfirmed。ただしBand Loop内部の終端フィーチャー数(2個か3個か)は
Open Questionのため、Geometry上の最終的なメッシュ分割数はこれに依存し確定していない。

## 2. 各部品の定義(現時点でConfirmedな範囲)

| 部品名 | 状態 | 寸法(実寸) | 備考 |
|---|---|---|---|
| Shaft Lower | Confirmed | 長さ2.17mm・径0.40mm(半径0.20mm) | シャフトのうちBand Loopから
  見て最も遠い側の区間。v1.0で「撮影用治具」と誤認していたが本体の一部と訂正済み
  ([[Soft_Clip_Geometry_Interpretation_v1.0]] §4-1) |
| Shaft Middle | Confirmed | 長さ1.33mm・径0.20mm(半径0.10mm) | 製品の8種類の長さ
  ラインナップに対応し、長さのみ変化する区間(断面径は共通) |
| Bridge | Confirmed(存在は確実、詳細形状はOpen) | 未計測 | Shaft MiddleとBand Loopを
  接合するT字の分岐点。具体的な形状(単純な直線的T字か、丸みを帯びた接合部か)は10方向
  画像からの視認のみで、寸法計測はまだない |
| Band Loop | Confirmed(1部品として)、内部の経路はOpen | 全長約6.0〜7.5mm・断面
  幅0.25mm×厚さ0.10mm | 帯状部材1本。ねじりなし、8箇所で前後に波打つ曲げ、全体で
  C字状。両端(または経路途中)のフィーチャー数・形状はOpen([[Soft_Clip_Geometry_Interpretation_v1.0]]
  §4-2) |

## 3. Connection(接続点)の扱いについて

shojiさんが例示した構造案には`Connection`という項目が含まれていたが、本文書では
独立した「部品」としては列挙しなかった。理由: 現行コードの設計思想
(`docs/Prosthesis_Reference_Geometry_Definition_v1.0.md`)では、Anchor/Pose Solverが
参照する接続点は「部品そのものの一部」ではなく「部品群のローカル座標系における基準点
(原点)」として扱われている(例: PistonFoot・FlatFootのローカル原点=Anchor)。Soft Clip
でも同様に、Shaft MiddleとBridgeの接合点(またはShaft LowerとShaft Middleの段差位置)が
「Connection」に相当すると考えられるが、これは独立ジオメトリを持つ部品ではなく座標上の
基準点であるため、Component Treeの部品リストとは別に、次のGeometry方式決定・
Improvement Specの段階で座標系として定義する方が既存の設計思想と整合する。**この整理
自体もshoji確認をお願いしたい**(Connectionを部品として明示的にモデル化すべきという
意図であれば訂正してください)。

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

1. 本文書と`Soft_Clip_Geometry_Interpretation_v1.0.md`の両方をshojiさんに確認いただく。
2. §4-2(Band Loop終端フィーチャー数)・§4-3(曲げの性質)・本文書§3(Connectionの扱い)の
   確認が得られ次第、両文書をv1.1へ更新する。
3. 部品構成が確定した後、shoji指定の手順②「Geometry方式の決定」に進む。
4. **現時点ではコード変更を行わない**(Phase 2は引き続きOn Hold)。

## 6. 参照文書

- `docs/Soft_Clip_Geometry_Interpretation_v1.0.md`(①Interpretation、本文書と対で参照)
- `docs/Soft_Clip_Geometry_Audit_v1.0.md`(G3-3、Phase 1 Completed・Phase 2 On Hold)
- `docs/Prosthesis_Reference_Geometry_Definition_v1.0.md`(Anchor/接続点の既存設計思想)
- `src/scenes/models/ProsthesisModels.tsx`(`SoftClipHead`:437、`SoftClipStem`:428、
  `SoftClipBridge`:409、`SoftClipWing`:384、`ProsthesisModel`シャフト計算部)
