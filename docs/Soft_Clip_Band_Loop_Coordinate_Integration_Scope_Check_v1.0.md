# Soft Clip Band Loop: Coordinate Integration Prerequisite / Scope Check v1.0

**Status**: Blocked / Deferred（結論は`Soft_Clip_Geometry_Improvement_Phase_v1_Freeze_v1.0.md`
§5 Tier Cの既存判定と同一。本文書は新たな判断を下すものではなく、v7 Geometry確定後の
現時点でその判定が依然として有効であることをEvidenceベースで再確認するもの）。

**位置づけ**: shoji指示（2026-08-08、Final Geometry Review PASS直後）による「Coordinate
Integration Prerequisite / Scope Check」の実施結果。**本文書はコード変更を伴わない**
（Geometry座標・Topology・Control Point・Sweep・曲率のいずれも無変更）。

---

## Executive Summary

v7 Geometry（27制御点、Final Geometry Review v1.0でPASS済み）を正式なGlobal/Shaft座標系へ
統合するために必要な情報を10項目で棚卸しした結果、**Tier C再開条件（`Soft_Clip_Geometry_
Improvement_Phase_v1_Freeze_v1.0.md`§5、2026-08-07確定）は今回のv7/Final Geometry Review
（2026-08-08）によっても一切充足されていない**ことを確認した。理由は、今回の一連の作業が
「Editor Local Coordinate内でのGeometry形状の成立性」を検証・改善するものであり、「Shaft座標系
との対応関係（位置・向き）」を確定させるものではなかったため（両者は独立した問題）。

加えて、**Shaft Axis自体は未確定ではなくFrozen・Evidence A**（`ProsthesisModel`の実装、
下記③参照）であり、「Shaft Axisが不明」という前提そのものが誤りであることが判明した。
不足しているのはShaft Axisではなく、「Band LoopがそのShaft Axis上のどこに・どの向きで
接続するか」という接続点情報である。

さらに、shoji自身の実物観察記録（`Soft_Clip_Geometry_Interpretation_v1.0.md`§1.3、
Evidence B、2026-07-30）に「長辺方向8箇所で奥行き方向へ波打つ」という記述があり、これは
現行v7 Geometry（全27点が単一平面`z=1.9`上）の平面性仮定と方向性が矛盾する可能性がある。
これはCoordinate Integrationが「置き場所を決めるだけ」では済まず、「Editor Local Coordinate
自体にZ方向の実データを追加する」というGeometry変更を要する可能性を示す重要な論点であり、
下記⑩で詳述する。

---

## 調査結果（10項目）

### ① 現在のv7 Local Coordinateの定義

Band Loop Editor独自のローカル座標系。全27制御点が単一平面`z=1.9`上に存在する平面Curve
（`ProsthesisModels.tsx`該当コメント「座標系（Small Change判断）」）。原点・軸方向・スケールは
Editor内でshojiが写真トレースにより主観的に設定したものであり、Global/Shaft座標系との対応は
一切ない（`Soft_Clip_Geometry_Editor_Design_v1.0.md` Non-goals「Band Loop Editor内の座標系は
Global/Shaft座標系と意図的に未接続」）。単位はmm相当として扱われているが、この仮定自体は
検証されていない（他のEvidence A値、例えば断面幅0.25mmとの整合はあるが、原点位置・尺度の
Global座標との対応関係は未検証）。

### ② Shaft-relative Coordinateへ変換するために必要な情報

最低限、以下のいずれかが必要：
- Editor平面上の既知点（例: `bridge/end`、Shaft接続候補点）とShaft-relative座標上の対応点の
  ペア（2点以上、剛体変換の回転・並進を解くため）。
- または、Editor平面の法線ベクトルがShaft-relative座標でどの方向を向くか（Editor平面が
  Shaft軸に対して垂直か、平行か、任意角かの決定）。
- スケール（Editor内mm表記が実際のmmと一致するかの独立検証）。

これらはいずれも③④で述べる通り未確定。

### ③ Shaft Axisの定義

**未確定ではない。既にFrozen・Evidence A（実装済み・本番描画で使用中）。**
`ProsthesisModel`（`src/scenes/models/ProsthesisModels.tsx` L1457-1575）は、
`computeProsthesisModelPose()`が返す`position`（Shaft中点）・`quaternion`（Shaft方向を
ローカル+Y軸に一致させる回転）を持つ単一の`<group>`としてShaft・Head Plate・Footを
まとめて描画している。ローカル+Y軸＝Shaft軸方向という規約は、SoftClipStem/Bridge/Wing
（既存の本番描画コンポーネント、L428-446）が既にこの規約に従ってmm単位のローカル座標
（例: `SoftClipStem`の`position={[0, CLIP_STEM_H/2, 0]}`）で実装されていることからも
裏付けられる（決定論的・8症例回帰テスト等で検証済みのPose Solver出力、[[pose_design_constraints]]
参照）。

**結論**: Band Loopが接続すべき「Shaft-relative Local Coordinate」とは、この
`SoftClipHead`ローカルフレーム（原点はHead Plate群の原点、+Y=Shaft軸方向）そのものであり、
新たに定義すべき座標系ではない。

### ④ Shaft Connection Neckの基準位置

**未確定（Evidence不足）。** `Soft_Clip_Geometry_Improvement_Phase_v1_Freeze_v1.0.md`§5の
Tier C再開条件3項目の1つ「Shaft径較正（Main Body/Neck判別に加え倍率差・視差等の複合要因、
Priority2 Scaniverse検証でも精密値未到達）」に該当。Shaft Lower（2.17mm・r0.20mm）/
Middle（r0.10mm、可変長）の寸法自体はEvidence A+として確定・実装済み（Tier A Completed、
`SOFT_CLIP_SHAFT_LOWER_LEN_MM`等）だが、**Band LoopがこのShaft区間のどのY座標位置で
接続するか**は未確定のまま。

### ⑤ Head Plateとの位置関係

Soft Clip（PISTON footType）にはPORP/TORPのような独立した「Head Plate」部品が存在しない
（`HeadPlate()`関数の`SOFT_CLIP`分岐は`SoftClipHead`＝Stem+Bridge+Wingそのものを返す）。
したがって本項目は文字通りには非該当（N/A）。実質的に対応する論点は④（Shaft接続位置）と
同一であり、P4C-0のHead Plate Normal問題とは対象産品（PORP/TORP vs Soft Clip）が異なる
別問題である。

### ⑥ Head Plate 3D Meshの必要性

⑤と同じ理由でN/A。ただし類推として、Band Loop自体の3Dスキャンメッシュ（Scaniverse等）が
あれば③④の一部（大局的な向き・接続位置の概算）を補助的に得られる可能性はある
（P4C-0のScaniverse実績と同種、Evidence B+/A-止まりという限界も同様に適用されると想定）。
現時点でSoft Clip専用のBand Loop 3Dスキャンは未実施（`3D_scans/`にBand Loop単体スキャンは
存在しないことを確認、既存のPORP/Soft Clip Scaniverseスキャンは製品全体形状の粗い検証が目的
であり、Band Loop接続部の精密位置には未使用）。

### ⑦ Global Coordinate確定に必要なEvidence

`Soft_Clip_Geometry_Improvement_Phase_v1_Freeze_v1.0.md`§5と同一（再掲）：
1. Band Loop制御点位置のうちShaft接続部座標
2. Hook Transition Profile定量パラメータ（Transition length/Curvature profile/Terminal
   approach angle）
3. Shaft径較正（Main Body/Neck判別）

いずれか1つがEvidence A/A+相当に確定すればTier C再開条件を満たす。

### ⑧ 現時点で不足しているEvidence

⑦の3項目はすべて未充足のまま（2026-08-07 Freeze時点から本日2026-08-08まで変化なし）。
v1〜v7の一連の作業はEditor Local Coordinate内でのGeometry形状洗練（self-intersection解消・
曲率品質改善）であり、⑦のいずれにも新規Evidenceを追加していない。Final Geometry Review
PASSは「Geometryとして成立している」ことの確認であり、「Shaft座標系上の位置が確定した」
ことの確認ではない（shoji自身の整理と一致）。

### ⑨ 不足Evidenceがなくても仮Integrationできる範囲

**既存のFrozen判断により、実質ゼロ。** `Soft_Clip_Geometry_Improvement_Phase_v1_Freeze_v1.0.md`
Frozen Decisions表#3「Tier B暫定配置の不採用: Hypothesisラベル付きでも仮配置は行わない」
（理由: Evidence First原則、FlatFoot G3-2 v1-v7で発生した「あとで直す前提のGeometryが
本番に混在するリスク」との同型性）は、Pocketについて2026-08-07にshoji自身が下した判断だが、
Band Loop全体にも同じ理由がそのまま当てはまる。この方針を覆さない限り、Coordinate
Integrationは「Evidence充足後に一度で正式に行う」以外の進め方を取るべきではない。

### ⑩ Coordinate IntegrationによってGeometryのControl Pointを変更する必要があるか

**条件付き。剛体変換（回転+並進、スケール=1）で済む場合は不要。ただしその前提自体に
未検証の懸念がある。**

- Editor平面（z=1.9固定）をShaft-relative座標へ配置するだけであれば、27制御点の相対位置・
  相対距離・相対角度は不変のまま、render時に1つの変換（`ProsthesisModel`が既に採用している
  position+quaternionパターンと同型）を適用すればよく、Control Point自体の値は変更不要。
- **懸念**: shoji自身の実物観察記録（`Soft_Clip_Geometry_Interpretation_v1.0.md`§1.3、
  Evidence B、2026-07-30）に「長辺方向8箇所で**前後方向（奥行き方向）へ波打つように成形**」
  という記述がある。これは実物が単純な平面形状ではなく、Editor平面に垂直な方向（Editor座標系
  でいうZ方向）に実際の凹凸を持つことを示唆する。現行v7は全27点が`z=1.9`で完全に一致する
  平面Curveであり、この奥行き方向の波打ちを一切表現していない（Editorの2D的な設計上の
  制約、`Soft_Clip_Geometry_Editor_Design_v1.0.md`にも「単一画像トレース」である旨明記）。
  もしCoordinate Integration時にこの奥行き情報を追加する必要があると判断された場合、それは
  座標変換ではなくGeometry変更（Control PointへのZ方向オフセット追加）に該当し、
  Final Geometry Review PASS済みのv7を再びAudit/Revisionループへ戻すことになる。
- **現時点の評価**: この平面性仮定と奥行き波打ちの記述との不整合は、Level A（self-
  intersection等の物理的破綻）ではなく、[[feedback_visual_judgment_priority]]の基準では
  Level B〜C（記録のみ、shojiの3D確認が最上位）に相当する可能性が高い。ただし
  **Coordinate Integrationに着手する場合はこの論点を無視できない**ため、Integration
  Prerequisiteの一部として明示的に記録する。

---

## Freeze §5との照合（判定根拠）

| Tier C再開条件（3項目のいずれか） | 本日時点の充足状況 |
|---|---|
| Band Loop制御点位置（Shaft接続部座標） | 未充足（v7はEditor Local Coordinateのみ、④参照） |
| Hook Transition Profile定量パラメータ | 未充足（変更なし、Freeze時点から本日まで新規取得なし） |
| Shaft径較正（Main Body/Neck判別） | 未充足（変更なし、Priority2 Scaniverseでも精密値未到達） |

3項目とも未充足のため、**Tier C（Coordinate Integrationを含む）はBlocked/Deferredのまま**。

---

## 結論・Recommended Actions

1. **Coordinate Integrationには着手しない。** v7 Geometry Freeze（Control Point値の凍結）は
   実施してよいが、それはCoordinate Integrationとは独立した工程として扱う。
2. **v7 GeometryはFinal Geometry Review PASSのまま維持する。** 本Scope Checkの結果によって
   v7へ差し戻す理由はない（⑩の懸念はLevel B/C相当であり、Revision要件ではない）。
3. Tier C再開条件（⑦の3項目）のいずれかが確定するまで、Coordinate Integrationは
   P4C-0と同様Blocked/Deferredとして明示する。
4. ⑩で指摘した「平面性仮定 vs 奥行き波打ちEvidence B」の不整合は、Coordinate Integration
   着手前に必ず再確認すべき論点として記録し、Tier C再開時のScope（単純な剛体変換で足りるか、
   Z方向データの新規取得が必要か）の判断材料とする。
5. 次の開発優先度は、P4C-0§6・[[p4_transition_deferred_management]]記載の既存優先タスク
   （Ground Truth収集・UI改善・CAD問い合わせ準備等）を継続する。Band Loop側で今すぐ着手
   可能な作業は見当たらない（Evidence待ちの純粋な調査・撮影・問い合わせ活動を除く）。

---

## 参照

- `Soft_Clip_Geometry_Improvement_Phase_v1_Freeze_v1.0.md`（Tier C再開条件の一次情報源）
- `Soft_Clip_Band_Loop_Final_Geometry_Review_v1.0.md`（v7 Geometry確定、本文書の前提）
- `Soft_Clip_Geometry_Editor_Design_v1.0.md`（v1.5、Editor Local Coordinateの設計制約）
- `Soft_Clip_Geometry_Interpretation_v1.0.md`（§1.3、奥行き波打ちEvidence Bの出典）
- `P4C-0_Evidence_Acquisition_Plan_v1.0.md`（同種のBlocked/Deferred判断の先例、Head Plate
  Normal問題）
- `src/scenes/models/ProsthesisModels.tsx`（Shaft Axis実装、L1348-1575）
