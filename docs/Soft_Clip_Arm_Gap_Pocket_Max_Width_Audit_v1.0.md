# Arm Gap / Pocket Maximum Width Audit v1.0

**Status**: **PASS(Level A問題なし)**。形状変更なし。
**目的(shoji明示指定)**: 「数値差を探して修正するAuditではなく、現行v7に
Level A相当の問題(現Topologyでは実物の主要構造を表現できないことが明確な場合)
が存在するかを判定するAudit」。Geometry座標は無変更。

---

## 1. Executive Summary

`Soft_Clip_Band_Loop_Geometry_Implementation_v1.0.md` §6は、Arm Gap・Pocket
Maximum Widthを「本Sweepは全区間定数幅0.25mmであり、開口幅という概念そのものを
表現していない → NOT YET MEASURABLE」としていた。これは**Ribbon断面の幅
パラメータ(0.25mm、材料の帯幅)と、Pocket空洞の開口幅(0.75mm/1.40mm、
RearFlex折り返しの両脚間の間隔)を混同した記録**であったと判明した。両者は
無関係な独立の量であり、後者はCenterlineの座標だけから直接計算できる。

v7座標で計算した結果、**現行Geometryは既に「入口が狭く内部が広がるFunnel状」
という定性的パターンを再現しており**、定量的にもEvidence値に対しそれぞれ
79%・90%という妥当な近さだった。**Level A相当の問題(表現不能)は存在しない**。
旧Auditの「NOT YET MEASURABLE」は計算方法の見落としであり、Geometry自体の
欠陥ではない。

---

## 2. 計算結果

RearFlexの折り返し(`pocket/deepest`を起点に、`lowerArm/start`側の脚と
`upperArm/curve/0`側の脚)を、`pocket/deepest`からの弧長比率(0=最深部、
1=Arm開口部)で対称パラメータ化し、同じ比率における両脚間の直線距離を
「その深さでのPocket幅」として算出した(v7centerline、`THREE.CatmullRomCurve3.
getPointAt`使用)。

| 位置 | 幅 |
|---|---:|
| 最深部(`pocket/deepest`) | 0.00mm(定義上、両脚が収束する点) |
| 弧長10%地点 | 0.28mm |
| 弧長50%地点 | 0.82mm |
| **弧長70%地点(最大)** | **1.27mm** |
| 弧長90%地点 | 1.08mm |
| **開口部(`lowerArm/start`↔`upperArm/curve/0`)** | **0.95mm** |

| 項目 | Evidence(A+) | Geometry計算値 | 一致率 |
|---|---:|---:|---:|
| Arm Gap(開口部の幅) | 0.75mm | 0.95mm | 79% |
| Pocket Maximum Width(内部最大幅) | 1.40mm | 1.27mm | 90% |

**定性的パターンの一致(重要)**: Evidence・Geometryのいずれも「開口部(0.75mm/
0.95mm)< 内部最大幅(1.40mm/1.27mm)」というFunnel状(内部拡大型)の大小関係を
満たしている。単純な平行隙間(内部にいくほど狭まる、または一定)ではなく、
RearFlexの折り返し形状が既にこの構造を自然に生み出している。

---

## 3. Level A判定

```
Revision Severity: Level B(数値差21%/10%、改善候補として記録のみ)
User Visual Judgment: 基本的に問題なし(v7はshoji確認済み)
Current Geometry Status: 成立。Funnel状という主要構造は現Topologyで表現できている
Revision Necessity: 不要
Reason: 現Topology(単一の開いた帯によるRearFlex折り返し)は、Arm Gap/Pocket
Maximum Widthの「入口が狭く内部が広がる」という主要構造を、追加の分岐やTopology
変更なしに、既存Control Pointの配置だけで既に表現できている(一致率79%・90%)。
「現Topologyでは実物の主要構造を表現できないことが明確に確認された場合」という
Level Aの要件には該当しない。残差(21%・10%)はControl Point位置の微調整で
縮められる可能性はあるが、Level B(改善候補)にとどまり、v7を今Revisionする
理由にはならない。
```

---

## 4. 参照

- `docs/Soft_Clip_Band_Loop_Geometry_Implementation_v1.0.md` §6(訂正対象の
  旧「NOT YET MEASURABLE」記録)
- `docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`(Arm Gap/Pocket Maximum
  Width Evidence値・Funnel状Interpretation)
- `docs/Soft_Clip_Centerline_Proposal_v7.json`(本チェックで使用した現行座標)
- `docs/Soft_Clip_Terminal_Length_Pocket_Depth_Measurement_Definition_Check_v1.0.md`
  (同種の「旧Auditの参照点/計算方法の見落とし」パターンの先行事例)
- [[feedback_visual_judgment_priority]](Level A/B/C分類の適用元)
