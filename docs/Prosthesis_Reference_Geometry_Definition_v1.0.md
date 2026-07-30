# Prosthesis Reference Geometry Definition v1.0

**Status**: G1/G2 Completed(shoji確認 2026-07-30)。§7-6のみKnown Limitation / Design
Decision Pendingとして残り、Phase G3(FlatFoot Geometry改善)着手前に再確認する。
**Date**: 2026-07-30
**位置づけ**: `docs/Prosthesis_Geometry_Audit_Plan_v1.0.md` Phase G2。G1-1〜G1-3
(`Prosthesis_Reference_Landmark_Definition_v1.0.md`、`TORP_SoftClip_Geometry_Audit_v1.0.md`)
で確認済みの事実を、正式なReference Geometry層として整理・定義する。**コード変更は行わない
(設計文書)**。P4C-0(Blocked/Deferred)の判断は変更せず、`composeNormal()`実装には着手しない。

---

## 0. Purpose

G1監査で明らかになった最重要区分:

```
Geometry Accuracy(Visual Meshの寸法精度)
        ≠
Reference Accuracy(Pose Solverが参照する基準点・軸の正しさ)
        ≠
Safety Calculation Accuracy(危険域距離計算の正しさ)
```

TORP FlatFootのVisual Mesh寸法が実測と乖離している(G1-3)ことが判明した際、この3層を混同すると
「Meshを直すならReference基準も見直すべきでは」という誤った連鎖判断につながりかねない。
Phase G2の目的は、**Reference Geometry(臨床的基準点・軸・ランドマークの定義)を先に固定し、
Visual Mesh改善(Phase G3)がSolver基準に影響を与えないことを構造的に保証する**ことにある。

```
Pose Solver
    ↑ (入力として参照)
Reference Geometry  ← 本文書が定義する層
    ↑ (視覚化のみ、Solverは参照しない)
Visual Mesh(BellFoot/FlatFoot/PistonFoot/SoftClipHead等の描画ジオメトリ)
```

## 1. Visual Mesh vs Reference Geometry

| 層 | 内容 | 変更時の影響範囲 |
|---|---|---|
| Visual Mesh | `ProsthesisModels.tsx`内の各`*Foot()`/`*Head()`/`HeadPlate*()`が生成する
  Three.jsジオメトリ(見た目) | 見た目のみ。Pose Solver・Safety計算には影響しない(本文書§2-4で
  保証する境界) |
| Reference Geometry | Pose Anchor・Shaft Axis・Head Plate Reference・Contact Landmarkの4項目
  (本文書で定義) | Pose Solver入力・Safety計算の両方に影響し得るため、変更には
  Frozen Layer相当の慎重さが必要 |

## 2. Pose Anchor Definition(Functional Anchor Point)

**定義(v1.0訂正版)**: AnchorはProsthesis Local Coordinate系(Foot group、
`ProsthesisModel`内`<group position={[0, footOff, 0]}>`)上の基準点(0,0,0)として定義する。
解剖学的ランドマーク`base`とのworld座標一致は、`angleTilt = angleTiltZ = 0`の場合にのみ
成立する(tilt適用時はオフセットが生じる。根拠は下記)。

> 旧版(shoji確認前の初稿)は「Foot group原点が`base`とworld空間で常に厳密一致する基準
> ランドマーク」としていたが、これは局所座標上の定義と解剖学的世界座標上の一致条件を混同
> していた。Anchorはあくまで**Local Coordinate上の基準点**であり、`base`との一致は
> tilt=0という特定条件下でのみ成立する派生的事実として扱う。

**根拠(数式的に導出 + Node実行で数値検証、G2で再確認)**: `computeProsthesisModelPose()`
(`:826`)において`footOff = -(len/2)`、`mid = (base+top)/2`(`top = base + dir*shaftLength`)。

**重要な訂正**: G1-2時点の記述は「Foot group原点はworld空間で常に`base`と厳密に一致する」と
していたが、これは**`angleTilt = angleTiltZ = 0`の場合にのみ厳密に成立する**近似だった。
実際のFoot group原点のworld座標は`mid + quaternion.applyToVector3(0, footOff, 0)`であり、
`quaternion`にはtilt成分が含まれるため、tilt≠0では`applyToVector3`後のY軸方向が
tilt前の`dir`と一致しなくなる(`finalEuler`は`quat0`のEuler分解にtilt角を加算する方式で、
`dir`軸まわりの単純な追加回転ではないため)。Node実行(`OssicleModels.tsx`実値・
`shaftLength=3.0mm`)で数値検証した結果:

| angleTilt | angleTiltZ | Foot原点と`base`のギャップ |
|---|---|---|
| 0° | 0° | 0.000 mm(厳密一致) |
| 15° | 0° | 0.211 mm |
| 0° | 20° | 0.521 mm |
| 25° | −10° | 0.547 mm |
| −30° | 15° | 0.634 mm |

ギャップは`footOff`(=shaftLength/2に比例)とtilt角の両方に応じて増大する。したがって
**「Pose Anchor = `base`」という一致はtilt=0(Ideal Pose)でのみ厳密に成立し、tilt≠0
(malposition表現時)では両者が乖離する**。これはFrozen Layer相当のPose Pipelineの既存挙動
であり、本文書で新たに導入する定義ではない。この挙動自体をどう扱うか(§7-6、Design
Decision Pending)とは切り分けて理解すること: **G1-2で確認した`Anchor Landmark ≠
Physical Contact Surface`という整理は本訂正でも維持される**(修正対象はworld座標上の
「常時一致」という保証部分のみ)。

**製品別のAnchor(= `base`、footTypeで分岐、`:837`)**:

| footType | 使用製品 | Anchor(=`base`) | 定義元 | Evidence |
|---|---|---|---|---|
| `BELL` | porp-ttp-variac(PORP) | `STAPES_HEAD` = `(-0.7249, -0.0273, 3.5259)` | `OssicleModels.tsx:271`。Interactive Landmark Tool v2実測(PORP_CONTACT_POINT)、Reviewer: Shoji、2026-07-22 | A |
| `FLAT` | torp-ttp-variac(TORP) | `STAPES_FOOTPLATE` = `(0.84, -2.65, 2.12)` | `OssicleModels.tsx:266`。OpenEar ALPHA実測 | A |
| `PISTON` | soft-clip-stapes(Soft Clip) | `STAPES_FOOTPLATE`(同上) | 同上 | A |

**Shaft-foot junction centerとしての解釈**: Anchor = シャフトとFootの接合部中心、という
shojiさんの整理と一致する。Anchorは常にPose Solverの`base`入力そのものであり、Foot Visual
Meshの形状・寸法とは独立に定義される(G1-3で確認したFlatFoot寸法の乖離は、このAnchor定義には
一切影響しない)。

## 3. Shaft Axis Definition

**定義**: `computeCurrentAxisAlignmentOrientation()`(`ProsthesisModels.tsx:739`)。

```
dir = direction指定時はそれを正規化 / 未指定時は normalize(target - base)
quat0 = setFromUnitVectors((0,1,0), dir)
finalEuler = (euler0.x + tiltXRad, euler0.y, euler0.z + tiltZRad)  // 'XYZ'
quaternion = setFromEuler(finalEuler)
```

**target(自然方向の基準、footTypeで分岐、`:843`)**:

| footType | target | Evidence |
|---|---|---|
| `BELL` | `UMBO_POS` = `(-3.236, 1.0663, 2.3439)` | A(Malleus.glb manubrium先端実測、2026-07-22) |
| `FLAT`/`PISTON` | `UMBO_POS_TORP` = `(0.84, 2.35, 2.12)` (底板の真上、垂直方向) | A(`STAPES_FOOTPLATE`から真上5mmの構成値) |

**Evidence**: A(全Product共通のコード実装、P4B-4で数式検証済み・最大誤差3.4e-6°)。**変更なし**
(既存Frozen相当のPose Pipeline、[[pose_design_constraints]]系で確立済み)。

## 4. Head Plate Reference

**原則**: Head Plate Center ≠ Shaft Axis(G1-1の最重要発見)。オフセットの有無・大きさは
headTypeごとに異なるため、個別定義が必須。

| headType | 使用製品 | Origin(0,0,0)の意味 | 幾何中心とOriginの関係 | Evidence |
|---|---|---|---|---|
| `BELL_TOP` | porp-ttp-variac(PORP)、torp-ttp-variac(TORP)共通 | シャフト固定ピン/カラー(shaft-to-disc接合部) | **意図的オフセットあり**: disc幾何中心は`(+0.14, −0.24)`(disc-space座標)。20×caliper確認済み(`ProsthesisModels.tsx:301-303`) | A |
| `SOFT_CLIP` | soft-clip-stapes | `SoftClipStem`底面(shaft-to-head接合部) | **オフセットなし**: origin はシャフト軸上に厳密に位置する(G1-3で確認)。Bridge/Wingがy=+0.18〜+0.57、x=±0.90へ非対称に広がるのは接合点から片側へ伸びる構造上の自然な広がりであり、originそのものの軸ズレではない | A(コード構造として確認) |
| `FENESTRATED`/`DISC`/`OVAL_RING`/`DOME_4FIN` | 現行15症例では未使用(代替表示用) | シャフト軸上 | オフセットなし(対称形状) | A(自明) |

**適用範囲の注記**: `BELL_TOP`は「PORP専用ヘッドプレート」ではなく、PORP(BELLフット)・
TORP(FLATフット)の両方が共有する(G1-1で確認、`products.ts:69`)。したがってHead Plate
Referenceの`BELL_TOP`行は両製品に等しく適用される。

## 5. Contact Landmark Definition

**定義**: Anchor Landmark(§2)とは独立に、Foot Visual Meshが実際に接触面を表現している位置。
Pose Solverは参照しない(視覚的・教育的な意味のみ)。

```
Pose Anchor (§2, Solverが参照)
      |
      +---- Contact Landmark (本節, 視覚化・将来の接触評価用途)
```

| footType | 使用製品 | Anchor⇔Contact Landmarkの関係 | 状態 |
|---|---|---|---|
| `BELL` | PORP | `BellFoot()`のリム(開口部、ローカルY=0)がAnchorと厳密に一致(`outerProfile`起点が`(RIM_R, 0)`) | **確定**(ギャップ0、カップ開口面=Anchor) |
| `FLAT` | TORP | Anchorは円柱中央に位置し、視覚的接触面(先端)とは円柱高さの半分だけ位置がずれる。原因はAnchor設計ではなくVisual Mesh側の簡略化(円柱近似)。実測(G1-3)によりMesh寸法自体も実物と乖離していることが判明 | **要Geometry改善候補**(Phase G3対象、Known Limitation §7-1) |
| `PISTON` | Soft Clip | `PistonFoot()`半球tipの下端(接触面側)がAnchorから約0.03mmの位置にある | **確定**(実務上小さいギャップ、許容範囲) |

## 6. Product-specific Differences(まとめ)

| | PORP(porp-ttp-variac) | TORP(torp-ttp-variac) | Soft Clip(soft-clip-stapes) |
|---|---|---|---|
| footType | BELL | FLAT | PISTON |
| headType | BELL_TOP | BELL_TOP(PORPと共通) | SOFT_CLIP |
| Pose Anchor | STAPES_HEAD | STAPES_FOOTPLATE | STAPES_FOOTPLATE |
| Shaft Axis target | UMBO_POS | UMBO_POS_TORP | UMBO_POS_TORP |
| Head Plate Offset | (+0.14,−0.24)あり | (+0.14,−0.24)あり(BELL_TOP共通) | なし(軸上) |
| Contact Landmark | 確定(ギャップ0) | 要改善候補(Mesh乖離あり) | 確定(ギャップ約0.03mm) |

## 7. Known Limitations

1. **TORP FlatFoot Visual Mesh寸法**(G1-3): 現行コード値(高さ0.42mm/外径0.24-0.18mm/
   内径0.09mm)は実測値(Evidence A+、高さ0.8mm/外径0.79mm/内径0.59mm)と乖離(高さ約53%、
   内径約31%相当)。Pose Anchor(§2)・Safety計算には影響しない。**Phase G3で対応する
   Future Geometry Improvement Itemとして分類**、緊急修正ではない。
2. **PistonFoot(Soft Clip)の寸法根拠不明**: 半球r=0.20・collar r=0.20×h=0.20に対応する
   実測コメントがコード上にない(Unknown〜C相当)。Contact Landmark自体は§5で確定済みだが、
   絶対サイズの実測根拠は今回未取得。
3. **Soft Clip全体スパン(約1.8mm)・ウィング曲率半径R**: 2026-07-02時点で「暫定値、要追加
   ノギス計測」と明記されたまま(`ProsthesisModels.tsx:359-362`)。Head Plate Reference(§4)
   のOrigin定義には影響しないが、Visual Mesh全体の精度としては未確定。
4. **`BELL_TOP`のZ(Normal)軸未確定**: Head Plate Local Coordinateの
   Origin/X(Long Axis)/Y(Short Axis)はEvidence A確定済みだが、Z(Normal)は
   `docs/P4C-0_Evidence_Acquisition_Plan_v1.0.md`によりBlocked/Deferred継続中。本文書の
   Head Plate Reference(§4)はX/Y平面上のオフセットのみを扱い、Normal方向には言及しない。
5. **Soft Clip Head視覚的質量中心は未算出**: §4で確認したのはOrigin(Pose参照点)のみ。
   Bridge/Wingを含めた視覚的重心の位置は今回のスコープ外(Pose Solverが参照しないため
   Reference Geometryとしては不要と判断)。
6. **【Known Limitation / Design Decision Pending】Pose Anchor(§2)はtilt≠0で`base`から
   乖離する**: G1-2時点の「Foot group原点は常に`base`と厳密一致」という記述は
   `angleTilt=angleTiltZ=0`限定の近似だった。Node実行による数値検証で、tilt角に応じて
   Foot原点が`base`から最大0.6mm程度(検証範囲: tilt 15-30°、shaftLength=3.0mmの場合)
   乖離することを確認した(§2表参照)。

   **2つのPoseモデル概念**(shoji整理、2026-07-30):

   | | Model A: Rigid Bodyモデル(現行実装) | Model B: Contact固定モデル |
   |---|---|---|
   | 構造 | Prosthesis全体を1つの剛体として回転。Footもtiltに伴い移動 | Foot Contact Pointを固定し、Shaftのみ角度変化(Foot pivot + shaft rotation) |
   | メリット | 数学的に単純、実装整合性が高い、現行Pose Solver(`solvePose()`→`composeTwist()`→`composeTilt()`)と一致 | 手術操作の直感に近い |
   | デメリット | Stapes側固定点から見ると違和感が出る可能性 | Pose Solver再設計・Product Adapter変更が必要 |

   **決定(shoji、2026-07-30、Design Decision Pending扱い)**: **現時点ではModel A(現行実装)
   を維持する**。理由: ①P4Bで検証済みのPose Solver設計(`solvePose()`→`composeTwist()`→
   `composeTilt()`)を崩す必要がない。②Safety Score計算(`dangerZonePoint`)はPose非依存と
   別途確認済みのため、安全評価基盤への影響がない。③教育Simulatorとしては「理想留置との差
   (Correct Placement→Foot position aligned / Tilt error→Foot position deviation)」を
   表現できる可能性があり、単なるバグではなく教育情報になり得る。

   **Pendingとして残す理由**: 上記は「バグと断定せず現状維持する」という暫定判断であり、
   Model Bへの再設計を将来的に排除するものではない。教育的検証(実際にtilt時のFoot位置
   ズレが学習者に誤解を与えないか等)を経て、正式なDesign Decisionとして確定させる。
   Safety Score計算には影響しないため、Phase G3(FlatFoot Geometry改善)の着手を妨げない。

## 8. Next Step

**G2-Review完了(shoji確認 2026-07-30)**: Pose Anchor(§2)の定義文言をLocal Coordinate基準へ
訂正し、tilt依存の乖離挙動(§7-6)をKnown Limitation / Design Decision Pending(Model A維持)
として正式に整理した。経緯:

```
G2   Reference Geometry Definition        (完了)
  ↓
G2-Review  Pose Anchor behavior clarification  (完了、本節)
  ↓
G1/G2 Completed Freeze                    (完了、`docs/Prosthesis_Geometry_Audit_Plan_v1.0.md`側)
  ↓
G3   FlatFoot Geometry Improvement        (次工程)
```

- `docs/Prosthesis_Geometry_Audit_Plan_v1.0.md`のPhase G1/G2はCompletedとしてクローズする。
- **Phase G3(製品別Geometry改善実装)**は、§7-1のFlatFoot寸法修正を主対象として別途起票する。
  本文書のPose Anchor/Shaft Axis/Head Plate Reference定義は不変のまま、Visual Meshのみを
  更新する(Small Change、Frozen Layer非該当)。
- §7-6(Design Decision Pending)は、Model A維持の暫定判断のまま残す。教育的検証を経て
  正式なDesign Decisionとして確定させるまでは、Pending状態を維持する(Safety計算には影響
  しないため、この保留自体はG3着手を妨げない)。

## 9. 参照文書

- `docs/Prosthesis_Geometry_Audit_Plan_v1.0.md`(Phase G1全体計画)
- `docs/Prosthesis_Reference_Landmark_Definition_v1.0.md`(G1-1/G1-2、Confirmed)
- `docs/TORP_SoftClip_Geometry_Audit_v1.0.md`(G1-3、Draft)
- `docs/Head_Plate_Local_Coordinate_v1.0.md`(Head Plate Local Coordinate Origin/X/Y、
  Z未確定の背景)
- `docs/P4C-0_Evidence_Acquisition_Plan_v1.0.md`(Blocked/Deferredの根拠)
- `src/scenes/models/ProsthesisModels.tsx`(`BellTop`:289、`SoftClipHead`:437、`BellFoot`:507、
  `FlatFoot`:609、`PistonFoot`:685、`computeCurrentAxisAlignmentOrientation`:739、
  `computeCurrentAxisAlignmentPose`:777、`computeProsthesisModelPose`:826、`ProsthesisModel`:848)
- `src/scenes/models/OssicleModels.tsx`(`STAPES_FOOTPLATE`:266、`STAPES_HEAD`:271、
  `UMBO_POS`:277、`UMBO_POS_TORP`:283)
- `src/data/products.ts`(headType/footType割り当て)
