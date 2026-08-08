# PORP/TORP Head Plate Geometry Quality Improvement — Scope / Baseline Audit v1.0

**Status**: Draft（shojiレビュー待ち）
**Date**: 2026-08-08
**位置づけ**: shoji指示による「PORP/TORP Head Plate Geometry Quality Improvement」着手前の
Scope/Baseline Audit。**コード変更は行わない（調査文書）**。既存の`Prosthesis_Geometry_
Audit_Plan_v1.0.md`（Phase G1/G2、2026-07-30 Completed）・`Prosthesis_Reference_Geometry_
Definition_v1.0.md`（G2）・`Prosthesis_Reference_Landmark_Definition_v1.0.md`（G1-1/G1-2）を
一次情報源とし、再調査ではなく既存Evidenceの再整理・不足確認を行う。

---

## Executive Summary（先に結論）

**現行PORP/TORP Head Plate Geometry（`BellTop()`）は、Soft Clip Band Loopとは出発点が
大きく異なる。** Soft Clipは「Geometryがまだ存在しない/未成立」状態からのHypothesis
構築が必要だったが、BellTopは既にGit履歴上10回以上の反復（STLスキャン比較・20倍模型
ノギス計測を経て収束）を経ており、Origin/X/Y平面上の形状（外形楕円・3つの開口・
オフセット位置）は**既にEvidence A**（2026-07-30のG1/G2 Auditで確認済み）。

**現時点で「形状(Geometry Shape)」側に、Normal軸に依存せず着手できる既知の欠陥・改善候補
は見当たらない**（FlatFootの寸法53%乖離、Soft ClipのCollar/Shaft重複バグのような、
着手理由となる具体的Issueが存在しない）。唯一の未解決事項はHead Plate Normal（Z軸）
であり、これは形状の問題ではなく`P4C-0`（Blocked/Deferred、Evidence不足）そのもの。

したがって、Soft Clipと同じ「Evidence→Hypothesis→Geometry Proposal→Audit→Freeze」
サイクルをBellTopに対してそのまま開始することは、**既に完了している調査を重複して
繰り返すリスク**がある。詳細は⑨・末尾のRecommended Actionsを参照。

---

## 調査結果（9項目）

### ① 現行PORP/TORP Head Plate Geometry

`products.ts`確認の通り、**PORPとTORPは`headType: 'BELL_TOP'`を共有**しており、
実装は`BellTop()`（`ProsthesisModels.tsx:289-347`）の単一コンポーネント。他に
`HeadPlateFenestrated`/`HeadPlateDisc`/`HeadPlateOvalRing`/`HeadPlateDome4Fin`が
存在するが、**現行15症例・3製品のどれからも参照されない未使用コード**
（`Prosthesis_Reference_Landmark_Definition_v1.0.md` §0で確認済み、"Named exports
for standalone use / testing"として保持されているのみ）。したがって本Auditの対象は
実質`BellTop()`1つ。

### ② 使用中のControl Point / Geometry Primitive

| 要素 | 定義 | 数値 |
|---|---|---|
| 外形（Disc） | 楕円（`THREE.Shape`、48分割） | 中心(+0.14,−0.24)、rx=1.30mm、ry=1.80mm（20×caliper確認済み） |
| 開口1（上部） | 楕円Hole | 中心(+0.14,+0.955)、rx=0.64、ry=0.295 |
| 開口2（左下） | 楕円Hole | 中心(−0.54,−0.89)、rx=0.37、ry=0.65 |
| 開口3（右下） | 楕円Hole | 中心(+0.69,−0.525)、rx=0.49、ry=1.035 |
| 押し出し | `ExtrudeGeometry(shape, {depth:0.10, bevelEnabled:false})` | 厚さ0.10mm一定（フラット） |
| 固定ピン | Cylinder | r0.13→0.10、h0.04 |
| カラー（シャフト接合部） | Cylinder | r0.10、h0.13 |

いずれもコード内コメントに「20× caliper confirmed」「[unchanged]」と明記され、
git履歴（`0c23b92`〜`e3571b9`等、10コミット以上）でSTLスキャン比較・段階的修正を
経て収束した値であることを確認した。

### ③ 現在のEvidence

| 項目 | Evidence | 出典 |
|---|---|---|
| Origin/X軸(Long Axis)/Y軸(Short Axis) | **A**（画像計測、較正済み） | `Head_Plate_Local_Coordinate_v1.0.md` |
| Head Plate Center オフセット(+0.14,−0.24) | **A**（20×caliper実測） | G1-1、`ProsthesisModels.tsx:301-303` |
| 3開口の位置・サイズ | **A**（同上caliper実測） | 同上、コード内コメント |
| 外形寸法(3.6×2.6mm楕円) | **A**（実物KURZ製品と一致確認） | `Pose_Design_Constraints_v1.0.md`(2026-07-24調査) |
| Z軸(Head Plate Normal) | **B/Unknown**（未確定候補） | `Head_Plate_Local_Coordinate_v1.0.md`、`P4C-0` |
| Contact Landmark(BELL Foot) | **確定**（ギャップ0） | G2 §5 |

### ④ 実物写真

P4A-1/A-2で撮影・cv2計測済みの「拡大PORP模型の多視点写真(真上0°/90°/270°、10枚+8枚)」
が既存Evidence源（`Head_Plate_Local_Coordinate_v1.0.md`）。**Soft Clipのような専用の
新規撮影セッション（`docs/assets/soft-clip-m1m2m3/`等）はPORP/TORP Head Plateには存在
しない**（`docs/assets`配下はSoft Clip関連フォルダのみ）。追加の新規撮影が必要かは
⑨で扱う。

### ⑤ 既存P4A/P4B/P4C成果

- **P4A**: Origin/X/Y軸 Evidence A確定、Z軸(Normal)は保留（Conditionally Complete）。
- **P4B**: Pose Solver 3層API（`solvePose()`→`composeTwist()`→将来`composeNormal()`）
  実装完了。Shaft Axis自体はNormalに依存せず確定・動作中（Head Plate Geometryとは
  独立したレイヤー）。
- **P4C-0**: Head Plate Normal Evidence取得手段が未確定のためBlocked/Deferred継続。
  Scaniverse新規3Dスキャンの実現性確認はCompletedだが、到達したのはEvidence B+/A-
  （角度レンジ約0.6〜3.6°）止まりで、`composeNormal()`実装が要求するEvidence A級には
  未到達（[[p4_transition_deferred_management]]）。
- **G1(Audit)/G2(Reference Geometry定義)**: 2026-07-30 Completed。Head Plate Center
  オフセットの正体を確認、Reference Geometry(Pose Anchor/Shaft Axis/Head Plate
  Reference/Contact Landmark)を正式定義。
- **G3(製品別改善実装)**: TORP FlatFoot（Completed、v1→v7、Clinical Visual Validation
  PASSED）・Soft Clip Phase1（Completed、Collar/Shaft重複解消）は実施済み。
  **PORP/BellTop向けのG3フェーズは存在しない**（起票された記録なし）。

### ⑥ 未解決のHead Plate Normal問題

`P4C-0`と完全に同一。新規3Dメッシュ/点群（KURZ公式CADまたは高精度スキャン）、
カメラキャリブレーション済み多視点撮影、または直接角度計測（治具要）のいずれかが
Evidence A以上で確定するまで着手不可。**本Auditで新たに前進させられる要素はない**
（既存Blockerの再確認のみ）。

### ⑦ Geometry変更可能範囲

Normal軸に依存しないXY平面上の要素（外形楕円・3開口の位置/サイズ・オフセット・
外形寸法）は、いずれも③の通り**既にEvidence A**。したがって「Normal非依存で今すぐ
安全に変更できる範囲」は理論上存在するが、**変更すべき具体的な欠陥が現時点で
特定されていない**（後述⑨）。

### ⑧ Coordinate Integrationとの依存関係

BellTopの唯一の未解決要素（Z/Normal）は、Coordinate Integration/`composeNormal()`
そのものに完全に従属する。これはSoft Clip Band Loopの構造（Shape=Frozen可能、
Connection/Orientation=Blocked）と同型だが、**BellTopは既にShape側がFrozen相当の
成熟度に達している**点がSoft Clipと異なる。

### ⑨ 最初に改善すべき部位（重要な発見）

`Prosthesis_Geometry_Audit_Plan_v1.0.md`の当初の着手順は「PORP→TORP→Soft Clip」
（理由: PORPが最もリスクが低い）だったが、実際にはTORP(FlatFoot、G3)とSoft Clip
(Phase1、G3-3)が先にCompletedし、**PORP/BellTopのG3フェーズは一度も起票されて
いない**。

理由を調べたところ、これは「後回しにされた」のではなく、**TORP/Soft Clipには
G1 Audit時点で具体的な欠陥が見つかっていた**（TORP: 寸法53%乖離、Soft Clip:
Collar/Shaft座標重複バグ）のに対し、**PORP/BellTopのG1 Audit結果には対応する
具体的な欠陥が記録されていない**ことが原因と判明した(`Prosthesis_Reference_
Geometry_Definition_v1.0.md` §7 Known Limitations表に、BellTop形状自体の欠陥項目
がない。唯一の関連項目は前述④のZ軸未確定のみ)。

**結論**: 「最初に改善すべき部位」を形状(Shape)の中から選ぶとすれば、現時点では
候補が存在しない。強いて挙げるなら、以下のいずれかが実質的な「次の一歩」になる。

- (a) P4C-0のEvidence取得手段（KURZ公式CAD問い合わせ等）そのものを進める
  （形状ではなく、唯一の既知Blocker）。
- (b) BellTopの「厚さ0.10mm一定のフラット押し出し」が実物形状（平面か、わずかな
  ドーム/湾曲があるか）と一致しているかを、既存P4A写真（未使用のまま残っている
  可能性がある視点）で再確認する。ただし`products.ts:38`のコメント「STLスキャン
  実測: 急峻フレアー＋フラットリム」は、フラット形状自体が既にSTLスキャン比較を
  経た結果であることを示唆しており、未検証の仮定ではない可能性が高い（要再確認、
  Evidence文書として明文化されたものは今回未発見）。
- (c) PORP/TORP Head Plateを離れ、他のKnown Limitation（PistonFoot寸法根拠不明、
  Soft Clip全体スパン等）または他のP4 Priorityへ進む。

---

## Risk Ranking

- **Low**: 既存BellTop Shape(XY平面)を無理に「改善」しようとすると、Evidence Aの
  値を根拠なく動かすことになり、Evidence First原則（Soft ClipのTier B暫定配置
  不採用と同じ理由）に反する。
- **Blocked（変更不可）**: Head Plate Normal(Z軸)は`P4C-0`のまま。

## Recommended Actions

1. **BellTop Shapeに対する新規Geometry Proposal/Freezeサイクル（Soft Clip式）は
   今は開始しない。** 具体的な欠陥がG1/G2 Auditで見つかっていないため、
   「直すべきものがない状態でRevisionサイクルを回す」リスクがある
   （[[feedback_visual_judgment_priority]]のLevel B/C原則と同じ理由）。
2. shojiに⑨(b)の確認（フラット形状の妥当性、既存P4A写真での再チェック）を
   小規模タスクとして依頼するかを判断してもらう。もし既にSTLスキャン比較で
   決着済みと確認できれば、この項目もクローズしてよい。
3. Head Plate Normal問題(P4C-0)を進めたい場合は、Soft Clipの`Coordinate
   Integration Scope Check`と同じ枠組みで扱う（新しいCAD問い合わせ準備＝
   Priority4本来の目的、または他の優先タスクへ）。
4. 上記1-3のいずれも「今すぐ着手すべきPORP/TORP Head Plate Geometry作業」
   ではないため、**Priority2(GT収集)またはPriority4(CAD問い合わせ準備)へ
   直接進む選択肢が、現時点のEvidenceからは最も自然**である。

---

## 参照文書

- `docs/Prosthesis_Geometry_Audit_Plan_v1.0.md`(Phase G1/G2/G3全体計画、Status)
- `docs/Prosthesis_Reference_Landmark_Definition_v1.0.md`(G1-1/G1-2)
- `docs/Prosthesis_Reference_Geometry_Definition_v1.0.md`(G2、Known Limitations §7)
- `docs/TORP_SoftClip_Geometry_Audit_v1.0.md`(G1-3)
- `docs/Head_Plate_Local_Coordinate_v1.0.md`、`docs/P4C-0_Evidence_Acquisition_Plan_v1.0.md`
- `src/scenes/models/ProsthesisModels.tsx`(`BellTop`:289-347)、`src/data/products.ts`
