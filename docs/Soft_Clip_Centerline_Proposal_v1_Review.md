# Soft Clip Centerline Proposal v1 レビュー

**Status**: Review Complete(shoji依頼、Claude実施)
**Date**: 2026-08-07
**対象**: `docs/Soft_Clip_Centerline_Proposal_v1.json`(shoji作成、Soft_Clip_Geometry_Editor_v1.html Phase1で出力)
**Scope Note**: 本レビューはBand Loop Centerline**形状のみ**を対象とする。Coordinate
System/XYZ軸/Pocket座標(entrance・deepest)/Global-Shaft対応/Evidence階層/JSON
Schema/Three.js実装は対象外(shoji指定)。**本JSON自体がHypothesis(設計案)であり、
Evidenceではない**。以下の分析は「このHypothesis JSONの幾何学的性質」を客観的に
計算したものであり、実物の形状を確定させるものではない。

---

## 1. Executive Summary

Topology(単一連続鎖)は健全。LowerArm〜Pocket区間の曲率も滑らか。**最大の問題は
RearFlex(7点)が方向反転を繰り返すジグザグになっている**ことで、Evidence B(単一の
弯曲部という定性描像)と整合しない。UpperArmは逆に手薄(1点)。Pocket深さ・Terminal
長さという既存Evidence A/A+の「距離」を、Hypothesis Centerline側の対応する2点間
距離が大きく下回っている(Pocket: 0.90mm vs 3.30mm、Terminal: 0.61mm vs 2.40mm)。
全体形状は完全に平面(Y座標が全点でほぼ一定)であり、立体的な「前後の成形」という
既存の定性Evidenceを現時点では反映していない。優先度付きの修正提案は§6参照。

## 2. Topology評価

- **単一連続鎖として自然か**: JSON構造上、Bridge→LowerArm→Pocket→RearFlex→
  UpperArm→Hookの順で1本の配列になっており、分岐は存在しない(Interpretation
  §4-5-A Topology Candidate A[単一連続鎖]と整合)。
- **逆転**: リージョン単位の順序(Bridge→...→Hook)に逆転はない。ただし**RearFlex
  内部**では、点同士を結ぶ方向が繰り返し反転しており(詳細は§3)、区間内で経路が
  自分の近くへ折り返すような動きになっている。
- **不自然な接続**: 隣接セグメント2組を抜き取って交差の有無を確認したところ
  (`rearFlex/curve/0`–`1` vs `rearFlex/curve/5`–`6`、`rearFlex/curve/2`–`3` vs
  `rearFlex/curve/4`–`5`)、いずれも交差なし。**ただし全ペアを網羅的に検証した
  わけではなく、目視・概算に基づく所見**であることを明記する。交差の有無に
  かかわらず、RearFlexの経路自体が「単一の滑らかな弯曲部」というEvidence Bの
  定性描像とは異なる動きをしている点が本質的な問題(§3・§5参照)。

## 3. 曲率評価(実測: JSONの座標から機械的に算出した値)

全制御点のY座標が1.004〜1.00402(ほぼ完全に一定)のため、以下はXZ平面内の2D解析
として扱ってよい。

### 3.1 セグメント距離

| 区間 | 距離 |
|---|---:|
| bridge/end → lowerArm/start | 0.222 mm |
| lowerArm/start → lowerArm/curve/0 | 0.647 mm |
| lowerArm/curve/0 → pocket/entrance | 0.386 mm |
| pocket/entrance → pocket/deepest | 0.899 mm |
| pocket/deepest → rearFlex/curve/0 | 0.923 mm |
| rearFlex/curve/0 → /1 | 0.323 mm |
| rearFlex/curve/1 → /2 | 0.644 mm |
| rearFlex/curve/2 → /3 | 0.599 mm |
| rearFlex/curve/3 → /4 | 0.368 mm |
| rearFlex/curve/4 → /5 | 0.561 mm |
| rearFlex/curve/5 → /6 | 0.740 mm |
| rearFlex/curve/6 → upperArm/curve/0 | 0.615 mm |
| upperArm/curve/0 → hook/start | 0.498 mm |
| hook/start → hook/end | 0.613 mm |
| **合計(折れ線長)** | **8.036 mm** |

### 3.2 各点での進行方向の変化(turn angle、°)

正=左折、負=右折。±90°を超える値は「急激な方向転換」とみなす目安。

| 制御点 | Turn |
|---|---:|
| lowerArm/start | +59.1° |
| lowerArm/curve/0 | +63.2° |
| pocket/entrance | +24.8° |
| pocket/deepest | +37.4° |
| **rearFlex/curve/0** | **-83.7°** |
| **rearFlex/curve/1** | **-95.5°** |
| **rearFlex/curve/2** | **+103.9°** |
| **rearFlex/curve/3** | **-86.1°** |
| **rearFlex/curve/4** | **-97.8°** |
| **rearFlex/curve/5** | **+70.9°** |
| rearFlex/curve/6 | -39.3° |
| upperArm/curve/0 | +21.9° |
| hook/start | -43.8° |

**LowerArm〜Pocket区間**(lowerArm/start〜pocket/deepest)は turn がすべて同符号
(+25°〜+63°)で、単調に左へ曲がり続ける滑らかな弧を描いている。**問題なし**。

**RearFlex区間**は `-83.7° → -95.5° → +103.9° → -86.1° → -97.8° → +70.9°` と
符号が右・右・左・右・右・左と目まぐるしく反転しており、典型的な**不要なS字
(ジグザグ)**。ユーザー指摘の「急激な曲率変化」「不要なS字」の双方に該当する。

**UpperArm〜Hook区間**は turn が +21.9°→-43.8°と小さく、急激な変化ではないが、
制御点が1つしかないため「曲率」として評価できる情報量自体が少ない(§5)。

### 3.3 検証: RearFlexを3点に削減した場合の効果(シミュレーション)

`rearFlex/curve/0`(入口)・`rearFlex/curve/4`(Z最大=最も後方の点、頂点候補)・
`rearFlex/curve/6`(出口)の3点だけを残して再計算すると:

| 区間 | 距離 | Turn |
|---|---:|---:|
| pocket/deepest → rearFlex/curve/0 | 0.923 mm | — |
| rearFlex/curve/0 → rearFlex/curve/4 | 1.305 mm | -128.1° |
| rearFlex/curve/4 → rearFlex/curve/6 | 1.065 mm | -90.1° |
| rearFlex/curve/6 → upperArm/curve/0 | 0.615 mm | -9.5° |

Turnがすべて同符号(右折のみ)になり、ジグザグが解消される。個々の角度は大きい
(-128°/-90°)が、これは「つ」字の後方で大きく折り返す形状として妥当な範囲であり、
符号反転(不要なS字)とは性質が異なる。

## 4. 写真との一致評価(既存Evidence文書との突き合わせ)

**一致**:
- LowerArm〜Pocket entranceの単調な曲がり方は、Interpretation §1.3-Aの「つ」字
  状一筆書きCenterline(Evidence B)と矛盾しない。
- Region順序(Bridge→LowerArm→Pocket→RearFlex→UpperArm→Hook)がTopology
  Candidate A(単一連続鎖、Interpretation §4-5-A、Strongly supported)と一致。

**違和感・不一致(すべてHypothesis同士の比較、または既存EvidenceとHypothesisの
比較であることを明示する)**:

1. **RearFlexのジグザグ形状**は、Component Tree §2.1・Improvement Spec §2.5に
   ある「Rear Flex Region = SOFTCLIPフックが接触し前方へ押されることで力が
   伝達される起点」という機能描像(Evidence B、単一の弯曲部を想定した記述)と
   整合しにくい。フックが押す対象が7点でジグザグする複雑な形状だとすると、
   機能説明との整合性が弱くなる。
2. **pocket/entrance→pocket/deepestの距離(0.899mm)が、Evidence A+のPocket
   Depth(3.30mm)より大幅に小さい**。Pocket座標自体は今回のレビュー対象外
   (shoji指定)のため修正提案はしないが、事実として記録する。
3. **hook/start→hook/endの距離(0.613mm)が、Evidence AのTerminal Length
   (約2.40mm)より大幅に小さい**。Hook側はレビュー対象内のため§6で提案する。
4. **全体の折れ線長(8.036mm)が、Evidence B(shoji見立て)のBand Loop全長
   6.0〜7.5mmをやや超えている**。CatmullRomCurve3で滑らかに補間した場合の
   実際の曲線長は、制御多角形の折れ線長よりも通常長くなる(特にRearFlexの
   ジグザグ区間で顕著に伸びると推定される)ため、上振れ幅はさらに大きい
   可能性がある。ただしEvidence B自体が実測ではなく見立てのため、これは
   「参考程度の所見」とする。
5. **形状全体が完全に平面**(全点のY座標が1.004〜1.00402でほぼ一定)。
   Interpretation §1.2/§1.3では「Band Loopが立体的にどう波打つか」を10方向
   画像から確認しており(確定的な3D座標化はできないが、定性的には非平面の
   構造として記述されている)、Rear Flex Regionを含め「前後」方向への成形が
   ある可能性が示唆されている。今回のProposal v1が意図的に「まず平面内で
   トポロジーとおおよそのプロポーションを固める」段階なのか、それとも
   立体化がまだ未着手なだけなのかは本レビューでは判断できない
   (**shoji確認事項として§7に記載**)。

## 5. Control Point評価

| Region | 現在の点数 | 所見 |
|---|---:|---|
| Bridge | 0(bridge/endのみ) | Phase1スコープ外(Bridge詳細はPhase2)、現状で問題なし |
| LowerArm | 1(lowerArm/curve/0) | 曲率は滑らか(§3.2)。Evidence B「約3回の主要カーブ」がLowerArm単体を指すのか全体を指すのか未整理(Improvement Spec §2.1既知の課題)のため、点数の過不足は断定しないが、他リージョンとの詳細度の差(後述)を踏まえるとやや手薄な可能性 |
| Pocket | 2(entrance/deepest、固定スロット) | レビュー対象外 |
| **RearFlex** | **7(curve/0〜6)** | **過多。§3.2の通りジグザグの直接原因。3点程度への削減を推奨(§6)** |
| **UpperArm** | **1(curve/0)** | **手薄。RearFlexの7点と比べて詳細度の差が大きい。最低1点の追加を推奨(§6)** |
| Hook | 0(start/endのみ) | Phase1スコープ外(Hook Transition ProfileはPhase2)、現状で問題なし。ただしstart-end間距離はEvidence Aと比較し短い(§4) |

**理由と期待効果**: RearFlex削減は、ジグザグ(§3.2)を解消し、機能描像(単一の
弯曲部、§4)と整合する形状にするために必要。UpperArm追加は、現状1点しかないため
「曲率」として評価できる情報がほぼ皆無であり、Pocket出口からHookへの遷移の
自然さを検証・調整できる余地を作るために必要。

## 6. Proposal v2 修正提案(優先順位付き)

**前提の再確認**: `bridge/end`・`pocket/entrance`・`pocket/deepest`はshoji指定
により変更提案の対象外。以下はそれ以外の点のみを対象とする。

### 優先度1: RearFlexの削減(7点 → 3点)

ジグザグ(§3.2)を解消するため、以下を提案する。

- **削除**: `rearFlex/curve/1`・`rearFlex/curve/2`・`rearFlex/curve/3`・
  `rearFlex/curve/5`(4点)
- **維持**: `rearFlex/curve/0`(Pocketからの入口)・`rearFlex/curve/4`(Z座標が
  最大=最も後方に位置する点。削減後の「頂点」として自然な候補)・
  `rearFlex/curve/6`(UpperArmへの出口)
- 削除後、ツールの仕様上インデックスは自動的に再採番される
  (`rearFlex/curve/4`→新`rearFlex/curve/1`、`rearFlex/curve/6`→新
  `rearFlex/curve/2`)。
- 効果(§3.3で検証済み): turnが全て同符号(右折のみ)になり、ジグザグが解消。

### 優先度2: UpperArmに1点追加

- `rearFlex/curve/6`(新`rearFlex/curve/2`)と`hook/start`の間、あるいは既存の
  `upperArm/curve/0`と`hook/start`の間に、`upperArm/curve/1`を追加。
- 目的: 現状1点のみで評価できないUpperArmの曲率を、優先度1の変更後に改めて
  評価・調整できるようにするため。具体的な座標はshojiの写真参照による配置を
  推奨(Claudeから座標を提案しない、Hypothesisの中身はshoji主導という今回の
  ワークフロー方針に沿うため)。

### 優先度3: Hookの間隔調整(方向はHypothesisのまま、距離のみ既存Evidenceに寄せる)

- `hook/end`を`hook/start`からもう少し離す(現状0.613mm→目安として2.40mm
  [Evidence A、Terminal Length]に近づける)。**方向は完全にHypothesis**であり
  Claudeから特定の方向は提案しない。距離の目安のみ、既存Evidenceとの整合を
  図る目的で提示する。

### 優先度4(任意・低優先): LowerArmへの点追加検討

- 曲率自体に問題はないが(§3.2)、RearFlex削減後・UpperArm追加後の全体バランスを
  見た上で、必要であれば`lowerArm/curve/1`の追加を検討。今回のJSONだけからは
  必要性を断定できないため、Proposal v2作成後に改めて判断することを推奨。

## 7. 総合評価

Topology(単一連続鎖)・LowerArm〜Pocket区間の曲率は健全で、Interpretation
§4-5-Aの単一連続鎖モデルとも整合している。**最大の課題はRearFlexのジグザグ
(§3.2で数値的に確認、優先度1で対処)**であり、これを解消すればBand Loop全体の
印象は大きく改善すると考えられる。UpperArmの手薄さ(優先度2)、Pocket/Hookの
距離とEvidenceとのギャップ(§4項目2・3、優先度3)は副次的な課題として扱ってよい。

**shoji確認事項(判断が必要、Claudeからは断定しない)**:
1. 今回のProposal v1が意図的に平面(2D)から着手しているか、それとも立体化が
   単に未着手なだけか(§4項目5)。
2. RearFlexの「頂点」として`rearFlex/curve/4`(Z最大点)を採用する提案(§6優先度1)
   が、実物写真の観察と矛盾しないか。

Proposal v2の作成(優先度1〜3の反映)を`Soft_Clip_Geometry_Editor_v1.html`上で
行い、再度JSONをエクスポートしてレビュー依頼いただければ、同様の手順で再評価する。

## 8. 参照文書

- `docs/Soft_Clip_Centerline_Proposal_v1.json`(本レビューの対象JSON)
- `docs/Soft_Clip_Geometry_Editor_Design_v1.0.md`(v1.1、Editorの設計仕様)
- `docs/Soft_Clip_Geometry_Interpretation_v1.0.md`(§1.3-A・§4-5-A)
- `docs/Soft_Clip_Component_Tree_v1.0.md`(§2.1、RearFlex/UpperArmの機能描像)
- `docs/Soft_Clip_Geometry_Improvement_Spec_v1.0.md`(§1.4 Pocket Geometry、§2.5 Rear Flex)
- `docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`(§0、Band Loop全長のEvidence B見立て)
