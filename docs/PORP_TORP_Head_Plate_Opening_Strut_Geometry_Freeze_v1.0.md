# PORP/TORP Head Plate — Opening/Strut Geometry 監査・凍結 v1.0

**Status**: Completed（Final Audit & Geometry Freeze）
**Date**: 2026-08-10
**対象コミット**: `492d359`（`feat(porp-torp): BellTop() Opening polygon実装...`、本Freezeが凍結する最終状態。`git fetch`で確認済み、shojiにより既にorigin/mainへpush済み。本文書自体のcommit`edf9a3f`はpush待ち）
**対象ファイル/関数**: `src/scenes/models/ProsthesisModels.tsx` `BellTop()`（PORP/TORP共通ヘッドプレート、`headType:'BELL_TOP'`）
**shoji方針**: Editor Candidate（写真トレース・実機確認済み）を実アプリで最終確認し「良いと思います」。Soft Clip Band Loopで確立したAudit→Freezeサイクルを本Geometryにも適用する。

---

> ## Scope Note（最重要・本文書の適用範囲）
>
> **本Freezeの対象は`BellTop()`内のdisc外形+3 Opening(hole1/hole2/hole3)のPolygon境界・disc中心
> 座標のみ**である。**Shaft Axis（ローカル原点(0,0)）・固定ピン・Collar・Pose Solver・Coordinate
> Integrationはすべて無変更のままFrozen**であり、本Freezeによる新たな変更・解除条件の対象外。
> `P4C-0`（Head Plate Normal/Z軸、Blocked/Deferred）にも一切影響しない。

---

## Executive Summary

`PORP_TORP_Head_Plate_Geometry_Scope_Baseline_Audit_v1.0.md`（2026-08-08）は「BellTop Shapeに
具体的な欠陥は見つかっておらず、Soft Clip式Proposal/Freezeサイクルを開始する理由がない」と
結論していた。この結論はEllipse近似の枠内では妥当だったが、その2日後、shoji自身がEditor上で
実物写真とBaselineを重ねて確認した結果、**3 Openingはいずれも楕円+回転では表現できない形状**
であることが判明した（Editor v1.2、実機確認手順③のNO分岐）。これにより「直すべき具体的欠陥」
が新たに特定され、Polygon Candidateの作成→Production実装という工程が発生した。本文書は
その最終成果物（disc+3 HoleのPolygon境界）を対象としたAuditとFreezeを行う。

**Critical Finding（プロセス上の発見）**: 前セッションの記録では「shoji自身がgit push実行済み
（2026-08-10）」とされていたが、本セッション冒頭の`git status`/`git log`実地確認により、実際には
**commitすら行われていない working directory 上の未コミット変更**のまま残っていたことが判明した。
実装内容自体（差分）は正しくファイルに残っており失われてはいなかったが、記録と実態の乖離が
あった。本セッションでshoji確認の上、sandbox内でcommit(`492d359`)を実施した。push（shoji側の
ローカル環境から）は本文書時点で未完了。詳細は§3。

**結論**: Geometry（Polygon境界）としては**Freeze可**。ただし全Polygon頂点座標はEvidence A
ではなく、shoji visual judgment由来のCandidateである点を明記する（§2の二層構造）。

---

## 1. Frozen対象

| 項目 | 内容 | 由来/Evidence |
|---|---|---|
| Disc外形 | 楕円、rx=1.30/ry=1.80（形状・寸法は無変更） | Evidence A（20×caliper、`Head_Plate_Local_Coordinate_v1.0.md`） |
| Disc中心座標 | `(0.031574, -0.601665)`（Shaft基準、旧`(0.14, -0.24)`から再表現） | Candidate Shaft位置`(0.1084, 0.3617)`分の平行移動。Shaft Axis自体は不変（§4参照） |
| hole1境界 | Polygon 20点（shoji写真トレース→平滑化1パス適用後） | Candidate、Evidence Aではない |
| hole2境界 | Polygon 24点（Shaft方向へ包み込む形状、Slit candidate構造を含む） | Candidate、Evidence Aではない |
| hole3境界 | Polygon 22点 | Candidate、Evidence Aではない |
| 押し出し | `ExtrudeGeometry(shape, {depth:0.10, bevelEnabled:false})`（Topology自体は無変更） | 既存実装のまま |
| Shaft Axis / 固定ピン / Collar / Pose Solver | 無変更 | Frozen（本Freeze対象外、§Scope Note） |
| 平滑化 | 3 Openingそれぞれに重み付き移動平均1パス（自分75%・両隣12.5%ずつ）、面積変化 hole1 -3.1% / hole2 -2.8% / hole3 -2.2% | shoji実機確認後の依頼（「開口部形状にいびつな箇所がある」）への対応。2パス以上は面積縮小7-9%で不採用 |

## 2. Evidence分類（二層構造・最重要）

Soft Clip Band Loop Freezeと同じ構造だが、由来が異なる点に注意。

- **形状そのもの（Geometry Shape）**: shojiが実アプリ3D Viewerで確認し「良いと思います」で
  PASS。[[feedback_visual_judgment_priority]]の最上位基準（shoji目視確認）を満たす。
- **個々のPolygon頂点座標**: Editor上でshojiが写真トレースしたCandidateであり、**Evidence A
  として確定した実測値ではない**。コード内コメントにも`Status: unverified-candidate`と明記済み。
- **Disc外形寸法(rx/ry)・Baseline楕円時代のStrut間ギャップ実測値（hole1↔hole3=0.15mm、
  hole2↔hole3=0.37mm）**: これらはEvidence Aのまま変更していない。ただしPolygon化後の実際の
  Strut間距離はこの実測値と直接対応する保証はない（Polygon境界に置き換わったため）。今後
  Strut幅の再検証が必要になった場合は、Polygon境界から再計算する必要がある（Open Item、§6）。

**したがって「Geometry Freeze = YES」だが「全Polygon座標がEvidence A」ではない。** 今後の
文書・コメントでもこの区別を維持すること。

## 3. Critical Finding: commit/push状態の記録誤り（プロセス監査）

- **発見内容**: 前セッションのmemory記録「shoji自身が`git push`実行済み(2026-08-10)」は誤り。
  本セッション冒頭で`git log`/`git status`を確認したところ、HEAD(`cbd10fb`)はorigin/mainと一致
  しており、Polygon関連のcommitは1件も存在せず、`ProsthesisModels.tsx`はworking directory上の
  未コミット変更（`git diff --stat`: 1 file changed, 122 insertions(+), 26 deletions(-)）の
  ままだった。
- **原因（推定）**: 前セッション終了までに`git commit`コマンド自体が実行されなかった可能性が
  高い。shojiによる実機確認・承認自体は実施されており、実装内容（diff）も正しくファイルに
  残存していたため、データ損失や実装の巻き戻りは発生していない。
- **対応**: 本セッションでshojiに状況を報告し確認を得た上で、①`.git/index.lock`の残留
  （別の要因、`allow_cowork_file_delete`で解消）を除去、②TypeCheck(`tsc -b`)がPASSすることを
  確認した上でsandbox内commit(`492d359`)を実施。
- **未完了事項**: pushは認証情報がsandboxにないためローカル必須（既存運用ルール通り）。
  shoji側での`git push`実行が必要。
- **再発防止**: 「commit/push完了」等のセッション終了報告は、次回セッション冒頭で
  `git status`/`git log`により必ず実地確認してから作業を継続する旨をfeedback memoryに
  追記済み（[[feedback]]）。

## 4. Verification Order結果

プロジェクト標準の Build → TypeCheck → Lint → Review → Clinical Validation の順で実施。

| ステップ | 結果 | 備考 |
|---|---|---|
| TypeCheck (`tsc -b`) | **PASS**（0 errors） | commit前に実行、commit後の状態と同一内容 |
| Build (`vite build`) | 未完走 | sandbox環境の既知の制約（Soft Clip v7時と同一の制約、disk容量問題ではないと推定されるが原因未確定）。Evidence不足として明示、新規の問題ではない |
| Lint (`eslint`) | 未完走 | 同上のsandbox制約（今回は個別ファイル指定でも45秒タイムアウト、過去記録の「2026-07-28時点で個別ファイルなら実行可」から状況が悪化している可能性があり、要継続観察） |
| Review | 完了（本文書） | diff scope確認: 変更は`BellTop()`内のみ、Pin/Collar/Shaft/Pose Solver/他ファイルへの影響なし |
| Clinical Validation | shoji実機確認PASS（「良いと思います」） | [[feedback_visual_judgment_priority]]の最上位基準を満たす |
| Geometry Integrity (shapely+earcut) | **PASS** | 自己交差なし・単純閉曲線・disc内包・hole間非重複・triangulated面積一致100%（平滑化後の最終形状で再検証済み、実装作業内で実施） |

vite build/eslintの未完走は、Soft Clip Band Loop Freeze(v7)時と同型のsandbox制約であり、
コード起因の新規障害ではないと判断する。ただしEvidence不足であることは明示し、shoji側の
ローカル環境での`npm run build`/`npm run lint`実行を推奨する。

## 5. 既存Baseline Audit v1.0との関係

`PORP_TORP_Head_Plate_Geometry_Scope_Baseline_Audit_v1.0.md`（2026-08-08、Status: Draft）の
結論のうち、「Opening形状の楕円近似で十分」という暗黙の前提（同文書は明示的にはOpening形状の
妥当性を検証していないが、Ellipse-basedな現行実装を疑う理由がないと結論していた）は、
本Freezeの元になったshoji自身の実機確認（Editor v1.2、③NO分岐）により**部分的にSupersede**
された。同文書の他の結論（Disc外形寸法・オフセット位置はEvidence A、Head Plate Normal(Z軸)は
`P4C-0`のままBlocked）は引き続き有効。同文書のStatusを次回整理時に「Superseded（Opening形状
部分のみ、本Freeze文書 v1.0参照）」へ更新することを推奨する（本文書では同文書自体の書き換えは
行わない）。

## 6. Freeze解除ゲート（[[feedback_visual_judgment_priority]]適用）

本Geometry（disc外形位置・3 Opening境界）の再変更は、以下のいずれかに該当する場合のみ許可する。

- **Level A相当の新発見**: 自己交差/NaN/退化フレームの再発、shapely+earcut検証の不一致、
  または実物との重大な矛盾（現在の3 Opening形状では実物の主要構造を表現できないことが
  明確な場合）。
- **新規Evidence A/A+の確定**: 現在Candidateレベルの66点(20+24+22)Polygon座標の一部または
  全部について、写真測量（キャリブレーション済み）・実測・CAD等でEvidence A/A+相当のデータが
  新たに得られた場合。

**Level B/C相当の指摘（微調整の余地・記録のみ）だけでは、本Freezeを解除しない。**

## 7. Known Limitations / Open Items

- **Slit candidate metric（hole2↔Shaft）は依然Hypothesis**: 「hole2からShaftへ繋がるスリット」
  という構造理解はEditor上の幾何学的観察（h2-shaft≈0.0009mm、ほぼ接触）に基づく作業仮説であり、
  Evidence A確定ではない。将来的な訂正の可能性を残す。
- **Strut幅の再検証は未実施**: 旧Ellipse実装のEvidence A（hole1↔hole3=0.15mm、hole2↔hole3=
  0.37mm）が、新しいPolygon境界上でも同等の実測的意味を持つかは未検証（§2参照）。臨床教育上
  Strut幅の正確性が重要になった場合は再検証が必要。
- **Lintがsandbox内で完走しない状態が悪化している可能性**: 過去記録（2026-07-28）では個別
  ファイル指定のeslintはsandbox内で実行可能だったが、本セッションでは45秒タイムアウトで
  複数回失敗した。原因未確定（sandbox環境側の変化の可能性）。次回作業時に再確認する。
- **push未完了**: commit `492d359`はorigin/mainに対しahead 1のまま。shoji側でのローカル
  `git push`が必要。

## 8. Risk Ranking

- **Low**: Geometry自体（disc/Opening形状）はshoji実機確認PASS、shapely+earcut検証PASSで
  臨床教育用Visual Geometryとして許容範囲。
- **Low〜Medium（記録のみ、Revision理由ではない）**: Polygon座標がEvidence Aでない点、Strut幅
  再検証未実施の点は、Level B/C相当の既知の限界として明示。
- **Process Risk（今回是正済み）**: commit/push状態の記録誤り。今回は実装の損失には至らな
  かったが、医療教育アプリのGeometry変更履歴管理として重要インシデントであり、feedback
  memoryに再発防止策を記録した。

## 9. Recommended Actions

1. shojiにローカル環境での`git push`実行を依頼（commit `492d359`）。
2. push後、`npm run build`/`npm run lint`をローカル環境で一度実行し、sandbox制約で未確認の
   ままだったVerification Order項目を埋める。
3. `PORP_TORP_Head_Plate_Geometry_Scope_Baseline_Audit_v1.0.md`のStatusを次回整理時に
   Supersede注記へ更新（本文書では未実施）。
4. 次のPriority4継続、またはP4C-0（Head Plate Normal、Evidence取得待ち）への復帰をshojiと
   決定。

---

## 参照文書

- `docs/PORP_TORP_Head_Plate_Geometry_Scope_Baseline_Audit_v1.0.md`（先行Audit、§5で関係整理）
- `docs/PORP_TORP_Opening_Strut_Editor_Design_v1.0.md`（v1.0〜v1.3、Candidate作成過程の設計記録）
- `PORP_TORP_HeadPlate_Opening_Strut_Editor_v1.html`（OneDrive直下、kurz-simulator git外）
- `docs/Soft_Clip_Band_Loop_Geometry_Freeze_v1.0.md`（本文書が踏襲したFreeze文書フォーマットの先例）
- `feedback_visual_judgment_priority.md`（Freeze解除ゲートの原則出典）
- `src/scenes/models/ProsthesisModels.tsx`（`BellTop()`: 302-479、commit `492d359`）

---

## 10. Final Status

```
PORP/TORP Head Plate Opening/Strut Geometry (BellTop(), commit 492d359)
Status: FROZEN（push待ち）

Frozen:
  disc外形寸法(rx=1.30/ry=1.80) / disc中心座標(Shaft基準再表現)
  hole1(20pt)/hole2(24pt)/hole3(22pt) Polygon境界(平滑化後最終形状)
  Topology(Shape+3 Holes+ExtrudeGeometry、無変更)

Frozen対象外（本Freeze範囲外、既存Frozenのまま）:
  Shaft Axis / 固定ピン / Collar / Pose Solver / Coordinate Integration
  Head Plate Normal(Z軸) = P4C-0のままBlocked/Deferred

Evidence区分:
  形状全体: shoji visual judgment PASS(最上位基準)
  Polygon頂点座標: Candidate(unverified-candidate)、Evidence Aではない
  Disc外形寸法・旧Strutギャップ実測値: Evidence A(不変)

Freeze解除条件:
  Level A相当の新発見、または新規Evidence A/A+の確定のみ
  (Level B/C指摘だけでは解除しない)

Verification Order:
  TypeCheck PASS / Build・Lint未完走(sandbox制約、Evidence不足として明示)
  Review完了 / Clinical Validation(shoji実機確認)PASS
  Geometry Integrity(shapely+earcut)PASS

Process Note:
  前セッション「push完了」記録は誤りと判明、本セッションでcommit実施(492d359)
  push(ローカル)は未完了、shoji側で実施予定

Next:
  (a) shojiによるgit push実行
  (b) ローカル環境でのbuild/lint実行(Evidence補完)
  (c) P4C-0またはPriority4継続への復帰
```
