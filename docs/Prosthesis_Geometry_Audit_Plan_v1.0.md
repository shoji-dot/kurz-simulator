# Prosthesis Geometry Audit Plan v1.0

**Status**: Phase G1/G2 Completed(shoji確認 2026-07-30)。Phase G3(製品別改善実装)は
未着手。詳細成果物は`Prosthesis_Reference_Landmark_Definition_v1.0.md`(G1-1/G1-2)、
`TORP_SoftClip_Geometry_Audit_v1.0.md`(G1-3)、`Prosthesis_Reference_Geometry_Definition_v1.0.md`
(G2、G2-Review含む)を参照。
**Date**: 2026-07-30
**位置づけ**: `docs/P4_Transition_Deferred_Management_Plan_v1.0.md` Priority1(プロステーシス
モデル品質向上)のPhase G1。PORP/TORP/Soft ClipのGeometry実装を評価項目ごとに監査し、
Evidence Level・修正優先順位を整理する。**コード変更は行わない(Plan文書)**。

**P4Cとの関係(非代替)**: 本Auditは`composeNormal()`実装(P4C本体)の再開条件ではない。
`docs/P4C-0_Evidence_Acquisition_Plan_v1.0.md`(Blocked / Deferred)の判断は変更せず、
Head Plate Normal Evidence取得手段が未確定のままでも進められる作業として位置づける。

---

## 1. 目的

現行`ProsthesisModel`(`src/scenes/models/ProsthesisModels.tsx`)のGeometry実装が、製品ごとに
どの程度Evidence(実測・カタログ・推定)に基づいているかを可視化し、品質改善の優先順位を
決定する。P4Bで完成したPose Pipeline(`solvePose()`→`composeTwist()`→`composeTilt()`)は
「入力Geometryの精度」を保証しないため、Reference Geometry層を独立に評価する。

## 2. 対象モデルと着手順(確定)

```
1. PORP (BellFoot)
2. TORP (FlatFoot)
3. Soft Clip (ClipArm/ClipFoot/PistonFoot)
```

理由: PORPは既にP4A(Geometry Validation)でOrigin/X/Y軸がEvidence A確定済み・P4B(Pose Solver)
の主対象済みであり、着手リスクが最も低い。

## 3. 評価項目(7項目、shoji指定)

コード確認(`src/scenes/models/ProsthesisModels.tsx`、`src/engine/poseSolver/`)により、
以下が判明している。Phase G1で埋めるのは特に④⑤⑥の「Unknown」欄。

| # | 評価項目 | 現状(コード確認済み) | Evidence Level | 対象関数/定数 |
|---|---|---|---|---|
| ① | Origin | Head Plate Local Coordinate Origin(`docs/Head_Plate_Local_Coordinate_v1.0.md`) | A(PORPのみ確定) | — |
| ② | Local Coordinate | 同上、X(Long Axis)/Y(Short Axis)確定、Z(Normal)未確定 | A(X/Y)、Unknown(Z) | 同上(P4Cブロッカーそのもの、対象外) |
| ③ | Shaft Axis | `computeCurrentAxisAlignmentOrientation()`(`ProsthesisModels.tsx:739`)。`direction`基準に(0,1,0)からのquaternion回転+tilt/tiltZをXYZ Eulerで合成 | A(コード実装として全Product共通、P4B-4で数式検証済み) | `computeCurrentAxisAlignmentOrientation` |
| ④ | Head Plate Center | `HeadPlate()`(`:451`)。headType(FENESTRATED/DISC/OVAL_RING/DOME_4FIN)ごとに個別ジオメトリ | **Unknown(監査対象)** | `HeadPlate`, `HeadPlateFenestrated`等 |
| ⑤ | Contact Point | コード内に明示的な「Contact Point」変数・関数は未確認。Pivot位置(後述⑦)との関係が未整理 | **Unknown(監査対象)** | 該当なし(要新規定義または既存流用の判断) |
| ⑥ | Bell Geometry | `BellFoot()`(`:507`)。`BELL_HEIGHT_MM=1.095mm`/`BELL_RIM_RADIUS_MM=0.795mm`は20倍物理模型実測+文書化されたスケール係数(0.7395)から算出、P4A確定値 | **A(PORPのみ)**。TORP(`FlatFoot`, `:609`)/Soft Clip(`ClipArm`等, `:634`以降)はカタログ記述由来のハードコード値のみで、実測・スケール係数の記載なし | `BellFoot`(A) / `FlatFoot`, `ClipArm`, `ClipFoot`, `PistonFoot`(Unknown〜C相当) |
| ⑦ | Pivot定義 | `computeCurrentAxisAlignmentPose()`(`:777`)。position = シャフト中点(base〜base+shaftLength*dir)。全Product共通のロジック | A(コード実装として一貫) | `computeCurrentAxisAlignmentPose` |

## 4. Phase構成

### Phase G1: 現状Geometry Audit **(Completed、2026-07-30)**

上表③〜⑦を実データで確認し、④Head Plate Center・⑤Contact Point・⑥TORP/Soft Clip Bell/Foot
Geometryの「Unknown」を解消した。成果物: `Prosthesis_Reference_Landmark_Definition_v1.0.md`
(G1-1/G1-2)、`TORP_SoftClip_Geometry_Audit_v1.0.md`(G1-3)。

### Phase G2: Reference Geometry定義 **(Completed、2026-07-30)**

「現在描画されている形状(Visual Mesh)」と「Solverが必要とする基準(Reference Geometry)」を
分離して定義した。成果物: `Prosthesis_Reference_Geometry_Definition_v1.0.md`(Pose Anchor/
Shaft Axis/Head Plate Reference/Contact Landmarkの正式定義、G2-Review含む)。

```
Visual Mesh(BellFoot/FlatFoot/ClipArm等の描画ジオメトリ)
    ↓
Reference Geometry(Origin/Axis/Contact Pointの正式定義)
    ↓
Pose Solver Input(PoseInput、bellAdapter.ts経由)
```

G2完了時にPose Anchor(§2)がtilt≠0で解剖学的ランドマークから乖離するという新規発見があり、
Design Decision Pending(Model A=Rigid Body維持)として記録した(詳細は
`Prosthesis_Reference_Geometry_Definition_v1.0.md` §7-6)。Safety計算には影響しないため
Phase G3着手の妨げにはならない。

### Phase G3: 製品別改善実装

Phase G1/G2の結果を踏まえ、PORP→TORP→Soft Clipの順で個別に改善提案・実装依頼を起票する。

## 5. 除外事項(今回着手しないもの、明記)

- **`composeNormal()`実装**: `docs/P4C-0_Evidence_Acquisition_Plan_v1.0.md`の制約を維持。
  Head Plate Normal Evidence取得手段が未確定のまま実装しない。
- **Blender MCP前提の設計**: BlenderはGeometry Validation Tool群(Open3D/Trimesh/OpenCV等)の
  一つとして扱う。特定ツールへの依存を設計に組み込まない(`Blender Policy`継承)。

## 6. Next Step

本Plan(v1.0)をshojiさんに確認のうえ、Phase G1(④⑤⑥のUnknown解消)から着手する。
