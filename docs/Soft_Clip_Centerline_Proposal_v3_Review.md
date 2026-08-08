# Soft Clip Centerline Proposal v3 レビュー

**Status**: Hypothesisレビュー(Evidence変更なし・座標系/JSON Schema/実装は対象外)
**対象**: `docs/Soft_Clip_Centerline_Proposal_v3.json`(shoji作成、2026-08-08 01:32 export)
**背景**: v1/v2はEditor上で座標のみを操作して作成されたが、v3は新設のReference Photo機能
(3D空間内への写真配置)と、チェーン順序の汎用化(`chainOrder`、領域をまたいだ自由な並べ替え)
を用いて、shojiが写真を見ながら直接トレースして作成した初めてのProposal。
**レビュー日**: 2026-08-08

---

## 1. Executive Summary

v3の直接の目的だった「Pocket entrance/deepestを他領域の点列の間・途中へ配置する」は完全に
実現している(§2)。自己交差はなく(全点が同一z平面のため2D線分交差判定を全ペアに対し厳密実施、
交差ゼロ)、RearFlex+Pocket区間の旋回パターンも「毎点反転するジグザグ」ではなく「deepest付近で
1回だけ折り返す」自然な形になっている(§3)。

一方で2点、確認・対応を要する事項がある。**(1) UpperArm区間の4点が旋回符号を毎点反転させており
(+41°→-27°→+35°→-48°)、v1で最大の問題だったRearFlexのジグザグと同種のパターンがUpperArmに
出現している**(§3、Medium〜High)。**(2) Terminal Length(Evidence A、2.40mm)・Pocket Depth
(Evidence A+、3.30mm)のいずれも、今回の形状では実測chord距離が大幅に下回っている**(0.73mm/
0.93mm、§4)。後者はv1から続く既知の低優先度課題だが、前者はv2で一度2.40mmちょうどに一致させた
実績があり、今回未反映になっている理由の確認を推奨する。

写真とのシルエット照合は、v1/v2時点では静止画に対するClaude側の定性比較として実施していたが、
v3はshoji自身がEditor内で写真を背景に直接トレースして作成したものであり、視覚一致の確認は
既にその工程で行われている。本レビューはEditorでは検出しにくい幾何学的性質(自己交差・旋回の
符号パターン・Evidence数値との整合)に絞った。

---

## 2. Topology確認(今回の主目的)

| 点 | chainOrder | 前後の点 | 判定 |
|---|---|---|---|
| `pocket/entrance` | 3 | `hook/start`(2) と `bridge/approach/0`(4) の間 | ✅ 意図通り |
| `pocket/deepest` | 10.875 | `rearFlex/curve/3`(10.75) と `rearFlex/curve/4`(10.9375) の間 | ✅ 意図通り |

依頼のあった配置(entranceをBridge/Hookの点列間、deepestをRearFlexの点列途中)がそのまま実現
されている。

---

## 3. Curvature / 自己交差

区間ごとの旋回角(進行方向の変化量、符号付き、度):

| 区間 | 旋回角の推移 | 符号反転 | 評価 |
|---|---|---|---|
| Hook (`curve/0,1`, `start`) | +50.3 → +59.3 → +18.3 | 0回 | 自然 |
| Bridge (`approach/0`, `end`, `departure/0`) | −14.7 → −10.3 → −17.5 | 0回 | 自然、大きさも揃っている |
| RearFlex + Pocket (`curve/0-2`, `curve/3`, `deepest`, `curve/4-7`) | −72.3→−76.3→−50.7 → **+68.7→+2.9→+73.6** → −55.4→−69.3→−67.3 | 2回(`curve/2→3` と `curve/4→5`) | 自然。2回の反転はいずれも折り返し点(`pocket/deepest`)の直前・直後で発生しており、Rear Flex Regionが弾性的に折れ返るという既存の臨床機構理解(Component Tree §2.1、Interpretation §1.4)と整合する。 |
| UpperArm (`curve/0-3`) | **+41.3 → −27.4 → +34.7 → −47.5** | **3回(毎点反転)** | ⚠️ v1のRearFlexで問題になったジグザグと同種のパターン。4点全てで隣接点と逆方向に旋回しており、滑らかな単一の弧というより微小な波打ちに見える可能性が高い。 |

自己交差判定: 全23点が `z = 1.9` で完全に一致しており平面上の折れ線となっているため、隣接しない
全セグメントの組み合わせに対して厳密な2D線分交差判定を実施。**交差ゼロ**(自己交差なし)。

---

## 4. Evidence整合性

| 項目 | 実測値(chord距離) | Evidence | 差 |
|---|---|---|---|
| Terminal Length(`hook/end`–`hook/start`) | 0.73mm(経路長は0.85mm) | 2.40mm(**A**) | 大幅未達。v2では直線区間として2.40mmちょうどに設定されていたが、今回は未反映。写真シルエット優先の結果と推測されるが、意図的な優先順位づけかの確認を推奨。 |
| Pocket Depth(`pocket/entrance`–`pocket/deepest`) | 0.93mm | 3.30mm(**A+**) | 大幅未達。ただしv2時点(0.90mm)からほぼ変化なしの**既知の低優先度課題**(Editor上、Pocket各パラメータはLock/参照専用でentrance/deepestの座標と自動連動しないため、手動調整が必要)。 |

参考: Band Loop全長(全セグメント合計) = 7.66mm。Evidence Bの見立て(約6.0–7.5mm)よりわずかに
長いが、v1(8.04mm)・v2(8.95mm)よりは短く、範囲に近い。

---

## 5. Remaining Issues(優先度順)

**High**
- なし(構造的な破綻・自己交差は検出されず)

**Medium**
- UpperArm区間4点の旋回符号が毎点反転している(§3)。意図的な微細ディテールか、単純化すべき
  波打ちかの確認を推奨。対応する場合は「点数を減らす」ことが目的ではなく、v1→v2のRearFlex改善
  と同様に「符号反転を region境界(自然な折り返し)にのみ残す」ことを基準にするとよい。
- Terminal Length 2.40mm(Evidence A)が今回の形状に反映されていない。v2では明示的に達成して
  いた数値であり、今回の非反映が意図的か確認を推奨。

**Low**
- Pocket Depth 3.30mm(Evidence A+)との乖離(v1から継続、既知)。

---

## 6. 総合評価

**★★★★☆(4/5)**

今回の主目的(Pocket entrance/deepestの他領域点列への割り込み配置)は完全に達成され、
チェーン順序汎用化機能も設計通りに機能した。自己交差なし、RearFlex+Pocket区間の折り返しも
臨床機構理解と整合しており、構造面での健全性は高い。

星5としなかった理由は、UpperArム区間に新規のジグザグパターンが出現している点、および
Evidence A/A+の2つの数値目標(Terminal Length・Pocket Depth)への一致が今回のパスでは
優先されなかった点。ただしこれらはいずれも「次に調整すべき点が明確」という性質のもので、
v1→v2の改善サイクルと同様、次回パスで個別に対応可能と見ている。

---

*本レビューはHypothesisレベルの形状評価であり、Evidence階層・座標系・JSON Schema・実装への
変更は一切含まない。数値はすべて `docs/Soft_Clip_Centerline_Proposal_v3.json` から直接
再計算し、Node実行で検証済み。*
