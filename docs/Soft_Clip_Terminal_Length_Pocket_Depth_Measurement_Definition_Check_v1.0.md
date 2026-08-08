# Terminal Length / Pocket Depth — Measurement Definition Check v1.0

**Status**: **PASS(Level B、Revision不要)**。形状変更なし。
**目的**: shoji指示「数値差が存在することだけを理由にGeometryを修正せず、まず
Measurement Definitionの同一性を確認する」。Geometry座標は無変更。

---

## 1. Pocket Depth: 参照点の不一致を確認・訂正

`Soft_Clip_Band_Loop_Geometry_Implementation_v1.0.md` §6は、Pocket Depthの
Geometry chordを`pocket/entrance`–`pocket/deepest`間(0.93mm)としてEvidence
3.30mmと比較し「DEVIATION」と記録していた。

しかし`Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`のPocket Depth Definition
(2026-07-31確定)は以下のとおりで、**参照点は`pocket/entrance`ではない**:

> Distance from the underside of the Upper Arm tip (Pocket entrance reference
> plane) to the deepest point of the Pocket.

Definition上の起点は**Upper Arm先端**(現行制御点では`upperArm/end`)である。
`pocket/entrance`はHook/Bridge間の別の制御点であり、Definitionが指す
「Pocket入口の基準面」を代表する点ではない。

**v7座標で再計算**(chord、straight-line distance):

| 参照点ペア | 距離 | Evidence比 |
|---|---:|---:|
| `pocket/entrance`–`pocket/deepest`(旧Audit使用、Definitionと不一致) | 0.87mm | 26% |
| `upperArm/end`–`pocket/deepest`(Definition準拠) | **2.01mm** | **61%** |
| Evidence(Pocket Depth Definition) | 3.30mm | 100% |

Definition準拠の参照点に修正するだけで、一致率が26%→61%に改善した。これは
**旧Auditが参照点を取り違えていたことによる測定上の誤差**であり、Geometry
自体の欠陥ではない。

残る乖離(61%、約1.3mm)については、以下のいずれか、または複合が考えられる
(現時点でどれが支配的かは未確定、Level C):
- Definitionの「underside(下面)」は`upperArm/end`そのものではなく、Band
  Thickness(0.10mm)分オフセットした面を指す可能性があるが、影響は最大でも
  0.1mm程度でありこの乖離(1.3mm)の主要因ではない。
- Geometry Implementation Audit(§6)が既に記録済みのとおり、**Proposal v3以降
  「写真シルエット優先」で意図的にHook/Pocket寸法を実測値に合わせていない**
  (shoji確認済みの既知の判断、Evidence未達のまま採用)。
- 現行の`upperArm/end`は「クリップが閉じた状態」ではなく「静止状態の単一
  Centerline」上の点であり、Definitionが暗黙に想定する「クリップ閉時にPocket
  入口を覆うUpper Armの位置」とは異なる可能性がある(構造的にActuation State
  を持たない現行モデルの限界、Geometry修正では解決しない)。

## 2. Terminal Length: 参照点の対応関係が未確定(Level C)

`Soft_Clip_Band_Loop_Geometry_Implementation_v1.0.md` §6は、Terminal Length
のGeometry chordを`hook/end`–`hook/start`間(0.73mm)としてEvidence 2.40mmと
比較していた。

`Soft_Clip_M1M2M3_Photogrammetric_Measurement_v1.0.md`によれば、Terminal
Lengthは「M2(Hook-like曲げ開始点)から返し曲げ終端(自由端)までの距離、約2.40mm」
と定義されている。M1/M2/M3は「Lower Arm」を基準にした計測であり、**この
Measurement Record作成時点(2026-07-31)は、現行の`hook/end`↔`bridge`近傍への
Topology再解釈(Hook↔Bridge入替、Interpretation v1.9 §4-5-A、2026-08-07)より
前**である。したがって、M2・「返し曲げ終端」が現行の制御点のどれに対応するかは、
Topology再解釈後には再確認されていない。

**Arc Length(直線距離ではなく経路長)での再検証**: 単純な「直線 vs 経路長の
定義違い」で説明できるかを数値確認したが、`hook/end`→`hook/curve/0`→
`hook/curve/1`→`hook/start`の実際の経路長は0.86mm(chord 0.73mmよりわずかに
長いのみ)であり、Evidence 2.40mmとの乖離(約1.5mm)を主に説明しない。

**結論**: Terminal Lengthについては、参照点の取り違えという単純な説明では
Pocket Depthほど乖離を縮小できなかった。M2・返し曲げ終端が現行Topology上で
どこに対応するかは**未確定のまま(Level C、複数のTopology解釈が可能)**とし、
Documentation Onlyとして記録する。

---

## 3. 判定

```
Revision Severity: Level B(Pocket Depth、旧Audit記録の参照点誤りを訂正) /
                    Level C(Terminal Length、対応関係未確定)
User Visual Judgment: 基本的に問題なし(v7はshoji確認済み)
Current Geometry Status: 成立
Revision Necessity: 不要
Reason: Pocket Depthの乖離は主に旧Auditの参照点誤りに起因すると判明し、訂正後の
一致率は26%→61%に改善。残差は「写真シルエット優先」という既存の意図的判断
(shoji確認済み)とActuation State非対応という構造的限界に起因する可能性が高く、
Geometry改変では解決しない。Terminal Lengthは参照点対応が未確定(Level C)の
ため記録に留め、現物確認等の追加Evidenceが得られるまでRevisionを開始しない。
```

`Soft_Clip_Band_Loop_Geometry_Implementation_v1.0.md` §6の記録は本チェック結果を
踏まえた参考情報として残し、本文書を正としてPocket Depthの参照点誤りを今後は
本文書で置き換える。Geometry(`ProsthesisModels.tsx`・Proposal v7)は無変更。

---

## 4. 参照

- `docs/Soft_Clip_Band_Loop_Geometry_Implementation_v1.0.md` §6(訂正対象の
  旧Audit記録)
- `docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`(Pocket Depth
  Definition固定箇所)
- `docs/Soft_Clip_M1M2M3_Photogrammetric_Measurement_v1.0.md`(Terminal Length
  ・M1/M2/M3の定義、Topology再解釈前の計測であることに注意)
- `docs/Soft_Clip_Centerline_Proposal_v7.json`(本チェックで使用した現行座標)
- [[feedback_visual_judgment_priority]](Level A/B/C分類・進行ルールの適用元)
