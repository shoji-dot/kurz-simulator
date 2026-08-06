# Soft Clip Centerline Parameter Definition v1.0

**Status**: Draft(shoji確認・v1.7反映済み)。**Commit4完了・Freeze文書参照**
(`docs/Soft_Clip_Pocket_Phase1_Freeze_v1.0.md`)。
**Date**: 2026-08-06(v1.7更新)
**v1.7での変更点(shoji指摘、2026-08-06、Commit4完了)**: Phase1(Pocket区間)の
Close-outとして`docs/Soft_Clip_Pocket_Phase1_Freeze_v1.0.md`を作成した(Scope Note・
Commit History・Validation結果・Frozen Decisions一覧を含む、Pocket Geometryのみが
対象でPhase2/3は対象外)。本文書のStatusはFreeze文書への参照として更新し、コード
変更は行っていない。
**v1.6での変更点(shoji指摘、2026-08-06、Commit3b完了・Commit4計画確定)**: 3点確定。
①**Status/本節の同期**: v1.5時点で「Commit3bは未着手」としていた記述を、実際の
完了状態(Ring/Face生成+GUI実装完了。Triangle Winding欠陥の発見・修正込みで
`0e70e4f`にamend・push済み)に合わせて更新する。②**§8.2の更新**: Commit3行を
完了マークし、Commit4行を「Orientation Validation(Frenet Frame・Twist確認)」から
「Phase1 Close-out」に差し替える。現行実装(§4.2)はW_hat/N_hatを固定軸として使用し
Frenet Frameを採用していないため、旧Commit4記述は現設計と矛盾しており撤回する
(Frenet Frame/Twistの要否はPhase2/3でCenterlineが曲線化した際に別途検討する)。
③**§8.4新設(Implementation Validation / Acceptance Criteria)**: Commit3bの
Node検証スクリプトによる確認項目(manifold・退化三角形0・法線方向・符号付き体積)を
明文化する。実装の幾何学的正しさを確認するAcceptance Criteriaであり、§2の
Evidence Hierarchy(A+/A/B/C)とは別枠の技術検証であることを明記する(shoji方針、
Evidence階層への昇格ではない)。
**v1.5での変更点(shoji指摘、2026-08-06、Commit3実装依頼確定)**: 4点確定。
①**§4.2に例外規定を追加**: Sweep Geometry concept(Centerlineに沿った断面掃引)は
Freeze維持。断面が経路上で一定(Constant Section)か変化するか(Variable Width)に
よりMesh生成APIに実装差異が生じることを明記する(Freeze解除ではなく例外規定、shoji
指定)。Constant Section=`ExtrudeGeometry`+`extrudePath`(Commit2、不変)、Variable
Width=section interpolation(手動Loft、Commit3新設)は同一Sweep conceptの異なる
実装手段として整理し、ExtrudeGeometryを廃止・置換する表現は用いない。②**§4.1の
幅プロファイルをLinearに確定**: Evidence取得済みはt=0/t=1の2点のみであり、中間形状
への追加仮定を避けるため最小仮定(Linear)を採用、smoothstepは不採用(shoji指定)。
③**§8.1にDebug material color注記を追加**: `showVariableWidthSweep`の識別用
マテリアル色はGeometry比較レビュー用のdebug visualizationであり、Geometry Parameter
でもUI Design Decisionでもないことを明記。④**§8.2にnon-indexed BufferGeometry
採用理由・Commit3a/3b分割を追加**: Phase1 Variable Width validationでは面単位の
normal確認を優先する一時的選択であり、indexed化・smooth shading対応は将来scope。
**v1.4での変更点(shoji指摘、2026-08-05、Commit2実装依頼確定)**: 2点確定。
①**断面幅の固定**: Commit2(Constant Section Sweep)の断面幅はArm Gap(0.75mm、
Evidence A+)に固定し、幅プロファイル(§4.1、Commit3スコープ)はCommit2では適用しない
(shoji指定)。②**§5.2 N軸(厚み方向)の実装時扱いを解消**(§8 Next Step旧項目1)。
Ribbon断面(N軸=0、W軸=0.75mmのみを表現)を採用し、Band Loop厚さ0.10mmの流用は
不採用(Evidence階層の異なる値を混在させるため)。ExtrudeGeometryが技術的に0厚みを
扱えない場合に限り、レンダリング上のみ必要な微小値ε(設計値ではない)を実装内部で
使用してよいが、Geometry Parameterとして解釈しない(shoji指定、詳細は§5.2改訂参照)。
**v1.3での変更点(shoji指摘、2026-08-05、可読性向上のみ・仕様変更なし)**: Commit1の
GUIレビューでshojiがAnchor Points(制御点)を3点(t=0/0.5/1)と誤解した(実際は2点、
t=0.5は§4.1幅プロファイルの説明中の値であり制御点ではない)。同種の誤解を他のレビュー
アも起こしうるため、§4.2にParameter t(連続)とAnchor/Control Points(離散2点)の
混同を防ぐ注記を追加した。仕様(Anchor Points=2点)自体は不変。
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
| 0 < t < 1 | 0.75mm→1.40mmへ単調増加(Linear、v1.5で確定) | Evidence-derived Design Decision(§5.1参照) |

**v1.5での確定(shoji指摘、2026-08-06)**: 幅プロファイルはLinear補間に確定する。
Evidence A+として取得済みなのはt=0(0.75mm)・t=1(1.40mm)の2点のみであり、中間形状は
いずれにせよ仮定にならざるを得ない。smoothstep等の非線形補間は新たな形状仮定を追加
するため不採用とし、最小仮定であるLinearを採用する。

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

> **Note(v1.3新設)**: Parameter `t` is a continuous parameter along the
> centerline. References to intermediate values (e.g., `t = 0.5`) describe
> evaluation of parameterized properties (such as width profile), not
> additional anchor/control points. Anchor Points(§2)は常に2点(t=0/t=1)
> であり、幅プロファイル(§4.1)等の連続関数の説明に現れる中間値とは区別する。

> **v1.5改訂: Mesh生成APIの例外規定(Freeze解除ではない、shoji指定2026-08-06)**
>
> 上記のFreeze対象は「Centerlineに沿って断面を掃引するSweep Geometry concept」
> そのものである。この上位概念はFreeze維持のまま変更しない。
>
> 一方、断面(幅)が経路上で一定か変化するかによって、Mesh生成に用いるThree.js API
> には技術的な実装差異が生じる(`ExtrudeGeometry`+`extrudePath`は単一Shapeの掃引の
> みに対応し、経路上でのShape寸法変化には対応しない)。この差異を以下の通り整理する。
>
> - **Constant Section(Commit2)**: `THREE.ExtrudeGeometry`+`extrudePath`(本節
>   既存の固定通り、不変)。
> - **Variable Width(Commit3)**: section interpolation(tごとにRingを生成し
>   手動でtriangulateするLoft手法)。ExtrudeGeometryを廃止・置換するものではなく、
>   断面が変化する区間に限定して用いる追加の実装手段である。
>
> どちらもCenterline(本節のCatmullRomCurve3)・Pocket-local座標系(§3)を共通の
> Sweep conceptとして使用する。Curve種別の変更・Sweep concept自体の変更は引き続き
> 本文書のスコープ外であり、別レビュー対象とする(Freeze対象は不変)。

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
Reference onlyとして扱い、Pocket自体の実測値としては採用しない。

**v1.4での解消(shoji指摘、2026-08-05)**: 上記の「暫定値として使うか、N軸寸法自体を
省略した簡易形状にするか」という実装時の扱いは、**省略(Ribbon断面)を採用**して
解消した。断面ShapeはW軸(0.75mm、Evidence A+)のみで定義し、N軸寸法は設計値として
持たない(N=0の数学的Ribbon)。Band Loop厚さ0.10mmは不採用— 円形断面(直径=幅)も
同様に「Pocket断面が円である」という新たな形状を創作してしまうため不採用とし、
最もEvidenceに忠実な選択としてRibbon断面(N軸未定義)をshoji指定により採用した。
ExtrudeGeometryの実装上、真の0厚みを扱えない場合に限り、レンダリング目的のみの
微小値ε(例: 0.001mm)を使用してよいが、これは**実装上のレンダリング都合であり
Geometry Parameterではない**(コード上にその旨を明記する)。

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
- **Debug material color(v1.5追加、shoji指摘2026-08-06)**: Constant Section
  (Commit2)とVariable Width(Commit3)を重ねて比較表示する際、識別のためマテリアル色
  を変える(例: `#33aaff`/`#ffaa33`)。これは**Geometry比較レビュー用のdebug
  visualizationであり、Geometry ParameterでもUI Design Decisionでもない**
  (コード上にもその旨を明記する)。

### 8.2 コミット単位(v1.2、shoji命名案を採用)

| Commit | 内容 | 対応するNext Step |
|---|---|---|
| 1. Centerline Construction | Anchor Points・Curve(§4.2)・Debug表示(§8.1のCenterline/Control Points) | §4・§8.1 |
| 2. Constant Section Sweep | Sweep・幅一定(幅プロファイル未適用、経路のみ検証) | §4.2 |
| 3. Variable Width Profile(**完了**、`0e70e4f`) | 幅プロファイル(§4.1、Linear確定)・Pocket Maximum Width反映。section interpolation(手動Loft、§4.2 v1.5例外規定)で実装。Triangle Winding欠陥の発見・修正込み(§8.4参照) | §4.1・§5.1・§4.2・§8.4 |
| 4. Phase1 Close-out(v1.6で「Orientation Validation」から差し替え) | Freeze文書作成(`Soft_Clip_Pocket_Phase1_Freeze_v1.0.md`)・Status確定・Validation結果記録。コード変更は想定しない | §8.4・Freeze文書 |

**v1.6補足**: 旧Commit4「Orientation Validation(Frenet Frame・Twist確認)」は現行
実装(§4.2、W_hat/N_hat固定軸・Frenet Frame不使用)と矛盾するため撤回した。Frenet
Frame/Twistの要否はPhase2/3でCenterlineが直線から曲線に変わった際に別途検討する。

**v1.5補足: Commit3の分割(shoji指摘、2026-08-06)**: Commit3は実装依頼の粒度として
Commit3a(本docs更新のみ)とCommit3b(Ring/Face生成+GUI実装)に分割する。Commit3a完了後、
diffレビューを経てCommit3bへ進む。

**v1.5補足: non-indexed BufferGeometry採用理由**: Commit3bで実装する
`getSoftClipPocketVariableWidthSweepGeometry()`は`THREE.BufferGeometry`をnon-indexed
(頂点非共有)で構築する。理由はPhase1のVariable Width validationでは面単位
(triangleごと)のnormal確認を優先するためであり、indexed化によるメモリ最適化や
smooth shading対応は本Commitのscopeに含めない(将来scope、shoji指定)。

### 8.3 完了条件への追加(v1.2、shoji指摘)

Node実行での座標・幅プロファイル数値検証(既存)に加え、以下を完了条件へ追加する。

- **Geometry生成は決定論的であること**(同一入力[Anchor Points・Parameterization]に
  対して常に同一の頂点列を生成する。乱数要素・フレーム依存[前フレームの状態に依存する
  処理]を含まない)。将来Safety EngineやGround Truthとの比較対象になりうるため、
  Phase1の時点でこの性質を確認しておく。

### 8.4 Implementation Validation / Acceptance Criteria(新設v1.6、Commit3b)

Commit3b(`getSoftClipPocketVariableWidthSweepGeometry()`)の実装後、three.js非依存の
独立Node検証スクリプトにより以下4項目を確認した。**これは§2のEvidence Hierarchy
(A+/A/B/C)とは別枠の技術検証(Acceptance Criteria)であり、Evidence階層への昇格
ではない**(shoji方針確定)。

| 項目 | 内容 | 結果 |
|---|---|---|
| Manifold性 | Directed-edge manifold check(各辺が正確に2回、逆向きに使用される) | PASS(境界0) |
| 退化三角形 | 面積0または縮退した三角形の有無 | PASS(0件、全260三角形が非退化) |
| 法線方向 | 各三角形法線とローカル外向き方向のdot積 | 発見時: 260/260が逆向き(dot=−1.0) → 修正後: 260/260が正しい向き(dot=+1.0) |
| 符号付き体積 | Divergence theoremによるメッシュclosed volumeの符号 | 発見時: 符号のみ反転(絶対値は解析値と一致) → 修正後: 解析値と誤差0% |

**経緯**: shojiのGUIレビューで「wireframeにX字状の交差が見える」との指摘を受け、
上記スクリプトで解析した結果、Topology自体は正常だが全260三角形でWinding(頂点順序)
が逆(法線が内向き)と判明した。側面2三角形+両端cap4三角形の頂点順序を修正し、
`git commit --amend`で`0e70e4f`に統合した(修正後は本表の全項目がPASS)。

**このNode検証スクリプトのリポジトリ正式追加(再利用可能なテストとして格納するか)
はCommit4でDeferred Decisionとして扱う**(Bell/Flat等の他形状での再利用見込みを
踏まえた将来判断、shoji方針)。

## 9. 参照文書

- `docs/Soft_Clip_Geometry_Improvement_Spec_v1.0.md`(v1.4、§0-A Layer Status・§0-B
  Phase Gate)
- `docs/Soft_Clip_Geometry_Interpretation_v1.0.md`(v1.9、§1.5 Pocket Geometry・
  §4-5-A Topology Candidate Evaluation)
- `docs/Soft_Clip_Component_Tree_v1.0.md`(v1.3、§2.1 Central Pocketの論理的サブ構造)
- `src/scenes/models/ProsthesisModels.tsx`(`SoftClipHead`/`SoftClipWing`/
  `SoftClipBridge`/`SoftClipStem` — 現行の暫定TubeGeometry実装。Phase1完了後も
  Pocket以外の区間はこの現行実装を維持する)
