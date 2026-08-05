# Soft Clip Centerline Parameter Definition v1.0

**Status**: Draft(shoji確認・v1.2反映済み)。**コード変更・Mesh実装は行っていない**
(本文書はPhase1着手前の仕様定義のみ)。
**Date**: 2026-08-05(v1.2更新)
**v1.2での変更点(shoji指摘、2026-08-05、実装依頼の明文化)**: Claude Codeへの実装
依頼で解釈の余地を残さないため4点追加。①**§4.2新設**: Curve実装方式を
`THREE.CatmullRomCurve3`+Centerline Sweep(ExtrudeGeometry/extrudePath、Method
Decision v1.4 4-4=Option A)に固定、変更は別レビュー対象と明記。②**§8.1新設**:
GUIレビュー項目(Centerline/Control Points/Sweep Meshの最低3項目)を明示。
③**§8.2新設**: コミット単位をCenterline Construction/Constant Section Sweep/
Variable Width Profile/Orientation Validationの4段階に命名。④**§8.3新設**:
完了条件に「Geometry生成は決定論的であること」を追加(将来Safety Engine/Ground
Truthとの比較対象になりうるため)。
**v1.1での変更点(shoji指摘、2026-08-05)**: §5を5.1 Evidence-derived Design
Decisions(Pocket Maximum Widthの到達位置=t1採用。既存Confirmed Evidenceの論理的
帰結であり新形状の創作ではないため、Known LimitationからDesign Decisionへ格上げ)と
5.2 Known Limitations(N軸=Band厚さ参考値。Band ThicknessとPocket Thicknessは別物
であり同一視できないため、引き続きReference onlyのEvidence不足として扱う)に分離。
**位置づけ**: `Soft_Clip_Geometry_Improvement_Spec_v1.0.md`(v1.4)§0-B Phase Gateの
**Phase1(Pocket区間)**に対応する実装仕様。Phase Gateの定義通り、Entry条件(既存A+/A
Evidenceのみ)を満たす範囲でのみ制御点を定義する。**推測による座標入力は禁止**
(shoji指定、Interpretation §1.3-A以来の既存Frozen Rule)。本文書がカバーしない
範囲(Shaft/Bridge/Lower Arm/Hook/Terminal)には一切の座標を提案しない。

---

## 1. Scope

**Phase1(Pocket区間のみ)**: Pocket入口(Upper Arm先端下面)からPocket最深部までの
区間を対象とする。`Soft_Clip_Geometry_Interpretation_v1.0.md`(v1.7)§1.5の
Funnel-like internal expanded pocket geometryに対応する。

対象外の区間(Shaft〜Bridge〜Lower Arm開始点、Pocket〜Hook遷移〜Terminal終端)は
§7 Explicit Non-goalsで扱う。

---

## 2. Anchor Points(使用するEvidence A+/Aの点)

| Anchor | 値 | Evidence | 出典 |
|---|---:|:---:|---|
| Pocket Depth(入口→最深部の距離) | 3.30 mm | A+ | Interpretation §1.5 / Measurement Record |
| Arm Gap(Opening、入口の開口幅) | 0.75 mm | A+ | Interpretation §1.5 |
| Pocket Maximum Width(内部空間の最大幅) | 1.40 mm | A+ | Interpretation §1.5 |
| Pocket Depth Definition | "Distance from the underside of the Upper Arm tip (Pocket entrance reference plane) to the deepest point of the Pocket" | A+(定義として固定済み) | Interpretation §1.5 |

3値はいずれも独立したEvidence A+であり、本文書はこれ以外の座標を新規に測定・推定
しない。

---

## 3. Coordinate System

**Pocket-local座標系**(Shaft/Global Soft Clip座標系とは独立、まだ接続しない)。

- **原点**: Pocket入口基準面の中心(Upper Arm先端下面、Pocket Depth Definitionの
  基準面と同一)。
- **D軸(Depth軸)**: 原点から最深部へ向かう軸。Pocket Depth(3.30mm)はこの軸上の
  距離として定義する。
- **W軸(Width軸)**: D軸に直交し、Arm Gap・Pocket Maximum Widthの測定方向(Upper Arm–
  Lower Arm間の開口方向)に対応する軸。Interpretation §1.4の「装着時にUpper/Lower Arm
  間が広がる方向」(Evidence B、定性)と整合させる。
- **N軸(Normal軸)**: D軸・W軸に直交する第三軸。現時点でPocketのN方向寸法を直接示す
  Evidenceはない(§5 Known Limitations参照)。

**本座標系はShaft/Bridge/Lower Armの座標系と未接続**。Phase2でShaft接続位置(M1/M3)の
mm絶対値が確定した後、この原点をLower Arm側の適切な位置へ合成する(Improvement Spec
§0-B Phase2のExit条件に対応)。Phase1単体では、レビュー目的でこの原点を仮に(0,0,0)に
置いて表示してよい。

---

## 4. Parameterization

`t = 0`(Pocket入口、原点)→ `t = 1`(Pocket最深部)。D軸に沿った線形パラメータ化とする。

```
position(t) = origin + t * 3.30mm * D_hat   (0 ≤ t ≤ 1)
```

**注記**: 「D軸に沿った直線」という扱いはPocket Depthの計測方法(入口基準面から
最深部までの距離)に対する最小限の解釈であり、実際の内壁形状が直線か緩やかに湾曲
しているかを示すEvidenceはない。教育用Visual Geometryとして直線を採用する(FlatFoot
G3-2で確立した「主要寸法は正確に、形状は単純に留める」原則、`[[feedback]]`)。

### 4.1 幅プロファイル w(t)

| t | 幅 | 根拠 |
|---|---:|---|
| t = 0(入口) | 0.75 mm(Arm Gap) | Evidence A+ |
| t = 1(最深部) | 1.40 mm(Pocket Maximum Width) | Evidence A+ + Evidence-derived Design Decision(§5.1参照) |
| 0 < t < 1 | 0.75mm→1.40mmへ単調増加(線形またはsmoothstep) | Evidence-derived Design Decision(§5.1参照) |

### 4.2 Curve実装方式の固定(新設v1.2、shoji指摘)

CenterlineはCenterline Parameter Definition(本節のParameterization)に対応する
Three.js Curveクラスとして**`THREE.CatmullRomCurve3`**を使用し、Mesh生成は
`Soft_Clip_Geometry_Method_Decision_v1.0.md`(v1.4、4-4=Option A)で既に決定済みの
**Centerline Sweep(ExtrudeGeometry+`extrudePath`による単一Curveの一括掃引)**に
従う。t=0/t=1の2点をCatmullRomCurve3の制御点として渡す(将来Phase2/3で中間制御点が
追加された場合も同じ手法をそのまま拡張できる)。

**Curve種別(CatmullRomCurve3以外への変更、Cubic/Quadratic Bézier・NURBS・独自
Splineの採用等)、およびMesh生成方式(ExtrudeGeometry+extrudePath以外への変更)は
本文書のスコープ外であり、変更する場合は別レビュー対象とする**(shoji指定)。

---

## 5. Evidence-derived Design Decisions / Known Limitations

Phase1のEntry条件(既存A+/A Evidence)は満たしているが、Mesh生成には以下2点の
追加的な形状解釈が必要になる。この2点は性質が異なるため分離する。**5.1は既存
Confirmed Evidenceの論理的帰結(新しい形状の創作ではない)、5.2は真にEvidence不足の
項目**である(shoji指摘、2026-08-05)。

### 5.1 Evidence-derived Design Decisions(Evidenceからの論理的帰結)

**Pocket Maximum Widthの到達位置(t軸上)**: 実測値はPocket内部空間の「最大幅」
としてのみ記録されており、それがt軸上のどの位置で生じるかは直接測定されていない。
しかし以下3点の既存A+/Confirmed Evidenceから、単調増加プロファイル(t=1すなわち
最深部でPocket Maximum Widthに到達)は**新しい形状の創作ではなく論理的帰結**として
導かれる。

- Pocket入口の幅(Arm Gap 0.75mm、A+)
- Pocket最深部までの距離(Pocket Depth 3.30mm、A+)
- Interpretation §1.5のConfirmed記述順序: 「入口→狭い開口→内部で広がる空間→
  最深部」

この記述順序は「入口が最も狭く、内部に向かって広がる」ことを示しており、途中で
一度広がってから最深部に向けて再び狭まるといった非単調な形状を示すEvidenceは
存在しない。**最大幅が最深部より手前にある、という新しい形状情報を追加しては
いない**——既存Evidenceが許容する最も単純な解釈を採用したに留まる。したがって
本項目はKnown Limitationではなく、Evidence-derived Design Decisionとして扱う。

### 5.2 Known Limitations(Evidence不足、今後の取得対象)

**N軸方向(幅と直交する厚み方向)の寸法**: Pocket自体のN軸寸法(厚み)を直接示す
Evidenceはない。Band Loop断面厚さ(0.10mm、Evidence A、Interpretation §1.2)は
**あくまで隣接部品(Band Loop)の実測値であり、Pocket自体の厚みではない**
(Band Thickness ≠ Pocket Thickness)。両者を同一視する根拠はないため、本文書では
Reference onlyとして扱い、Pocket自体の実測値としては採用しない。Mesh生成時の
暫定値として使う場合も、Pocket自体の測定値ではないことを実装コード上のコメントに
明記する。

いずれもAnchor/Pose Solver/Safety Engineに影響しない(Pocket Meshは視覚的表現のみ)。

---

## 6. Tangent Rule

CatmullRomCurve3(またはLatheGeometry、断面が概ね回転対称に扱える場合)は制御点の
位置のみで補間可能であり、明示的な接線指定は必須ではない。以下は視覚品質向上のための
方針であり、Phase1のMesh生成の必須要件ではない。

- **入口(t=0)**: 接線はD軸に一致させる(Pocket入口基準面に対して垂直に入る形状。
  Evidence C、視覚的自然さのための単純化)。
- **最深部(t=1)**: 終端は開いた形状ではなく閉じた形状として扱う(Pocketは「凹み」
  であり貫通しない、Interpretation §1.4のクリップ機構と整合)。閉じ方の詳細
  (丸みの半径等)はEvidence Cとし、FlatFoot G3-2で確立した「単純な形状に留める」
  方針を踏襲する。
- **出口(Pocket外への接続、Lower Arm側)**: **Phase1のスコープ外**。t=1の点は
  将来Phase3(Hook/Terminal)の起点候補となりうるが、本文書ではその接続方向・
  接線を一切定義しない。

---

## 7. Explicit Non-goals

- **Shaft・Bridge・Lower Arm(Shaft接続部〜Pocket入口)**: 対象外。Improvement Spec
  §0-B Phase2(Position Evidence取得待ち)。
- **Hook・Terminal(Pocket出口〜Hook遷移〜Terminal終端)**: 対象外。Improvement Spec
  §0-B Phase3(起点・方向Evidence取得待ち)。
- **Pocket-local座標系とShaft/Global座標系の合成**: 対象外。Phase2のExit条件
  (Position拘束確定)が満たされてから行う。
- **Upper Arm/Lower Armの弾性変形(アニメーション)**: 対象外。Method Decision v1.4
  §3.3で既に将来拡張候補として整理済み、静的教育モデルの範囲を超える。
- **断面の矩形形状(Band幅0.25mm×厚さ0.10mm)の直接反映**: Pocketは空間(凹み)であり
  Band Loopの断面そのものではないため、本文書のスコープでは扱わない(§5のN軸で
  参考値として言及するのみ)。

---

## 8. Next Step

1. 本文書(Anchor Points/Coordinate System/Parameterization/Tangent Rule/Non-goals)
   をshoji確認。§5.1(Pocket Maximum Widthの到達位置=t1)はEvidenceからの論理的
   帰結として採用済み。§5.2(N軸=Band厚さ参考値)はEvidence不足のReference only
   のため、実装時の扱い(暫定値として使うか、N軸寸法自体を省略した簡易形状にするか)
   についてshoji確認が必要。
2. 承認後、Mesh実装(§4.2で固定したCatmullRomCurve3+ExtrudeGeometry/extrudePath)へ
   進む。
3. Verification Order(Build→TypeCheck→Lint→Review→Clinical Validation)を実施。
4. Pocket-local座標系のまま(Shaft/Global座標系に未接続の状態)でGUIレビューを行う。
   Anchor/Pose Solver/Safety Engineへの影響がないことをdiffで確認する。

### 8.1 GUIレビュー項目(新設v1.2、shoji指摘)

Phase1実装のGUIレビューでは、最低限以下3項目を個別に表示切替できること。

- **Centerline**: t=0→t=1の補間曲線(§4.2のCatmullRomCurve3)
- **Control Points**: Anchor Points(§2)に対応する制御点マーカー
- **Sweep Mesh**: 幅プロファイル(§4.1)を適用した最終Mesh

### 8.2 コミット単位(v1.2、shoji命名案を採用)

| Commit | 内容 | 対応するNext Step |
|---|---|---|
| 1. Centerline Construction | Anchor Points・Curve(§4.2)・Debug表示(§8.1のCenterline/Control Points) | §4・§8.1 |
| 2. Constant Section Sweep | Sweep・幅一定(幅プロファイル未適用、経路のみ検証) | §4.2 |
| 3. Variable Width Profile | 幅プロファイル(§4.1)・Pocket Maximum Width反映 | §4.1・§5.1 |
| 4. Orientation Validation | Frenet Frame・Twist確認 | §6 Tangent Rule |

### 8.3 完了条件への追加(v1.2、shoji指摘)

Node実行での座標・幅プロファイル数値検証(既存)に加え、以下を完了条件へ追加する。

- **Geometry生成は決定論的であること**(同一入力[Anchor Points・Parameterization]に
  対して常に同一の頂点列を生成する。乱数要素・フレーム依存[前フレームの状態に依存する
  処理]を含まない)。将来Safety EngineやGround Truthとの比較対象になりうるため、
  Phase1の時点でこの性質を確認しておく。

## 9. 参照文書

- `docs/Soft_Clip_Geometry_Improvement_Spec_v1.0.md`(v1.4、§0-A Layer Status・§0-B
  Phase Gate)
- `docs/Soft_Clip_Geometry_Interpretation_v1.0.md`(v1.9、§1.5 Pocket Geometry・
  §4-5-A Topology Candidate Evaluation)
- `docs/Soft_Clip_Component_Tree_v1.0.md`(v1.3、§2.1 Central Pocketの論理的サブ構造)
- `src/scenes/models/ProsthesisModels.tsx`(`SoftClipHead`/`SoftClipWing`/
  `SoftClipBridge`/`SoftClipStem` — 現行の暫定TubeGeometry実装。Phase1完了後も
  Pocket以外の区間はこの現行実装を維持する)
