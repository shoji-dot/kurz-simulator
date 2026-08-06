# Soft Clip Pocket Phase1 凍結 v1.0

**Status**: Completed
**Date**: 2026-08-06
**対象コミット(主要)**:
- `fa5391d`(Commit1: Centerline Construction)
- `39465df`(Commit2: Constant Section Sweep)
- `827c3e1`(Commit3a: docs、Linear Width確定・例外規定)
- `0e70e4f`(Commit3b: Variable Width Profile、Triangle Winding修正amend込み)
- `93aec9b`(Commit3b-docs: v1.6、Status同期・§8.4新設)

(main / origin/main 同期済み)

---

> ## Scope Note(最重要・本文書の適用範囲)
>
> **本Freezeの対象はPocket Geometry(Phase1: Pocket入口→Pocket最深部の区間)のみ**
> である。Shaft・Bridge・Lower Arm(Phase2)、Hook・Terminal(Phase3)、および
> Pocket-local座標系とShaft/Global座標系の合成は**本Freezeの対象外**であり、いずれも
> 未着手・Evidence取得待ちのまま残る。Phase2/3は別途Evidence取得後、個別のFreeze
> 文書で扱う。本文書の内容をPhase2/3の設計判断に流用してはならない(座標系が
> Pocket-local限定であるため)。

---

## 1. Phase概要

**目的**: `Soft_Clip_Geometry_Improvement_Spec_v1.0.md`(v1.4)§0-B Phase Gateの
Phase1(Pocket区間)実装をClose-outし、次Phase(2/3)またはP4の他Priority trackへ
移行可能な状態を確定する。

**根拠文書**: `docs/Soft_Clip_Centerline_Parameter_Definition_v1.0.md`(v1.6)。
本Freeze文書は同文書の内容を再掲せず、差分・結果のみを整理する。

## 2. Geometry算出方法(要約)

詳細は`Soft_Clip_Centerline_Parameter_Definition_v1.0.md`(v1.6)を参照。要点のみ:

- **Centerline**: Pocket-local座標系(§3、原点=Pocket入口基準面中心、D軸=深さ方向、
  W軸=開口幅方向、N軸=未定義)上で、Anchor Points(t=0/t=1の2点、Evidence A+)を
  `THREE.CatmullRomCurve3`の制御点として使用。
- **Sweep**: Centerlineに沿った断面掃引(Sweep Geometry concept、Freeze維持)。
  断面幅が経路上で変化するため、Constant Section用API(`ExtrudeGeometry`+
  `extrudePath`、Commit2)ではなくsection interpolation(手動Loft、Commit3b)で実装。
- **幅プロファイル**: t=0で0.75mm(Arm Gap)→t=1で1.40mm(Pocket Maximum Width)への
  Linear補間(Evidence A+ 2点+Evidence-derived Design Decision)。
- **断面**: W軸(幅方向)のみのRibbon断面(N軸=未定義、厚み方向のGeometry Parameterは
  持たない)。

## 3. Commit History

| Commit | 内容 | Hash |
|---|---|---|
| 1. Centerline Construction | Anchor Points・Curve・Debug表示(Centerline/Control Points) | `fa5391d` |
| 2. Constant Section Sweep | 幅一定(0.75mm固定)のSweep、経路のみ検証 | `39465df` |
| 3a. docs(Commit3実装依頼確定) | Linear Width確定・§4.2例外規定・debug color注記 | `827c3e1` |
| 3b. Variable Width Profile | Ring/Face生成(32 Ring)+GUIトグル実装。Triangle Winding欠陥発見・修正込み | `0e70e4f`(amend) |
| 3b-docs | Status同期・Frenet Frame記述の撤回・§8.4新設 | `93aec9b` |
| 4. Phase1 Close-out(本文書) | Freeze文書作成、コード変更なし | (本コミット) |

## 4. Validation結果

`Soft_Clip_Centerline_Parameter_Definition_v1.0.md`§8.4(Implementation Validation /
Acceptance Criteria)に基づき、three.js非依存の独立Node検証スクリプトで以下4項目を
確認した。**Evidence Hierarchy(A+/A/B/C)とは別枠の技術検証**であり、Evidence階層
への昇格ではない(shoji方針確定)。

| 項目 | 結果 |
|---|---|
| Manifold性(directed-edge check) | PASS(境界0) |
| 退化三角形 | PASS(0/260件) |
| 法線方向(dot積) | PASS(修正後260/260が+1.0。修正前は260/260が−1.0=逆向き) |
| 符号付き体積(divergence theorem) | PASS(修正後、解析値と誤差0%。修正前は符号のみ反転) |

**経緯**: shojiのGUIレビュー指摘(wireframeのX字状交差)を受けた解析で、Topology自体は
正常だが全260三角形でWindingが逆と判明。側面2三角形+両端cap4三角形の頂点順序を修正し
`0e70e4f`にamend、全項目PASSを再確認した。Build(`tsc -b`)・`vite build`も再PASS。

## 5. 引き継ぎ事項

- **Phase2(Shaft〜Bridge〜Lower Arm)**: Evidence Blocker継続中(Top-down視点
  追加撮影待ち、Decision v1.3)。M1/M3のpx座標・Definitionは変更なし、mm絶対値は
  Provisional以下で保留。
- **Phase3(Hook/Terminal)**: 起点・方向のEvidence不在(Blocker: Shaft〜Hook〜
  Terminal区間の距離・方向欠如)。Pocket区間との接続(t=1点の出口接線)は未定義の
  まま。
- **Node検証スクリプトのリポジトリ格納可否**: 本Commitでは判断を保留する
  (§6 Deferred Decision参照)。
- **Housekeeping(優先度低、未着手)**: 未追跡ファイル(`.claude`/`.mcp.json`/
  `.serena`/`serena-mcp.ps1`/`_softclip_split_backup`)のgitignore整理、backup
  branch 2本(`backup-before-linefix`/`backup-before-softclip-split`)の削除要否。
- **N軸(厚み方向)**: Geometry Parameterとして未定義のまま(Ribbon断面、Evidence
  不足)。将来N軸寸法のEvidenceが取得された場合も、本Freezeの範囲外の追加作業として
  扱う(既存Pocket Geometryの破壊的変更ではなくAdditiveな拡張を想定)。

## 6. Deferred Decision

**Node検証スクリプトのリポジトリ正式追加**(`tests/`等への格納、再利用可能な
Acceptance Testとしての整備)は、本Commit4では判断を保留する。Bell/Flat等の他形状
実装でも同種のmanifold/winding/volume検証が必要になる見込みがあり、その時点で
共通化の要否とあわせて判断する方が合理的なため(shoji方針)。現時点ではスクリプトは
一時検証用として扱い、リポジトリには未格納。

## 7. Explicit Non-goals(再掲、詳細は§7参照)

以下は本Freezeの対象外であり、Pocket Phase1のClose-outをもって解消されるものでは
ない(`Soft_Clip_Centerline_Parameter_Definition_v1.0.md`§7と同一)。

- Shaft・Bridge・Lower Arm(Phase2)
- Hook・Terminal(Phase3)
- Pocket-local座標系とShaft/Global座標系の合成
- Upper Arm/Lower Armの弾性変形(アニメーション)
- 断面の矩形形状(Band幅0.25mm×厚さ0.10mm)の直接反映

## 8. 参照文書

- `docs/Soft_Clip_Centerline_Parameter_Definition_v1.0.md`(v1.6)
- `docs/Soft_Clip_Geometry_Improvement_Spec_v1.0.md`(v1.4、§0-B Phase Gate)
- `docs/Soft_Clip_Geometry_Interpretation_v1.0.md`(v1.9、§1.5 Pocket Geometry)
- `docs/Soft_Clip_Geometry_Method_Decision_v1.0.md`(v1.4、4-4=Option A)
- `docs/TORP_SoftClip_Geometry_Audit_v1.0.md`

---

## 9. Frozen Decisions(1ページ要約)

Phase1(Pocket Geometry)で意図的に確定した設計判断の一覧。変更する場合は別レビュー
対象とする(Strangler Pattern・Small Change原則、shoji承認なしに変更しない)。

| # | 判断項目 | 確定内容 | 根拠 |
|---|---|---|---|
| 1 | Sweep concept | Centerlineに沿った断面掃引(Sweep Geometry)。Constant Section/Variable Widthは同一conceptの実装差異(例外規定であり別conceptではない) | Method Decision v1.4(4-4=Option A)、Centerline Parameter Definition §4.2 |
| 2 | Curve種別 | `THREE.CatmullRomCurve3`固定。変更(Bézier/NURBS等)は別レビュー対象 | §4.2 |
| 3 | 幅プロファイル | Linear補間(t=0: 0.75mm → t=1: 1.40mm)。smoothstep等の非線形補間は不採用(最小仮定原則) | §4.1(v1.5確定) |
| 4 | W_hat(幅方向軸) | 固定軸(1,0,0)として実装。Frenetフレームは不使用 | Commit3b実装、§8.2 v1.6補足 |
| 5 | N_hat(法線/厚み方向軸) | 固定軸(0,0,1)として実装。N軸自体の寸法はGeometry Parameterとして未定義(Ribbon断面、N=0) | §5.2、Commit3b実装 |
| 6 | BufferGeometry構築方式 | non-indexed(頂点非共有)。理由: 面単位のnormal確認優先。indexed化・smooth shadingは将来scope | §8.2(v1.5補足) |
| 7 | Epsilon(微小値) | 真の0厚みをAPIが扱えない場合に限り、レンダリング目的のみの微小値εを使用可。Geometry Parameterとしては解釈しない | §5.2(v1.4解消) |
| 8 | Debug material color | `#33aaff`(Commit2)/`#ffaa33`(Commit3b)。Geometry比較レビュー用のdebug visualizationであり、Geometry Parameter/UI Design Decisionではない | §8.1(v1.5追加) |
| 9 | Triangle Winding | 側面2三角形+両端cap4三角形の頂点順序を修正済み(`0e70e4f`amend)。全260三角形で法線が正しい外向き(dot=+1.0)、符号付き体積が解析値と誤差0% | §8.4、本文書§4 |
| 10 | Node検証スクリプトの位置付け | Evidence Hierarchyとは別枠のImplementation Validation / Acceptance Criteria。リポジトリ格納可否はDeferred Decision(§6) | §8.4 |
| 11 | Pocket Maximum Widthの到達位置 | t=1(最深部)。既存Confirmed Evidenceの論理的帰結として採用(新形状の創作ではない) | §5.1 |
| 12 | 座標系の独立性 | Pocket-local座標系はShaft/Global座標系と未接続。Phase1単体では原点を仮に(0,0,0)として表示可 | §3 |

---

## 10. Final Status

```
Soft Clip Pocket Phase1 (Pocket Geometryのみ)
Status: Completed
Blocking Issue:
None
Open Issues:
Phase2 Evidence Blocker(Top-down撮影待ち)
Phase3 Evidence Blocker(Shaft〜Hook〜Terminal区間の距離・方向欠如)
Deferred Decision:
Node検証スクリプトのリポジトリ格納可否
Next Phase (shoji判断待ち):
(a) Phase2/3(Shaft〜Hook〜Terminal)へ進む
(b) 他のP4 Priorityへ戻る(①プロステーシス品質向上/②GT収集/③UI改善/④CAD問い合わせ準備)
```
