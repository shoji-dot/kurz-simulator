# Phase C-7（PROPOSED / PENDING ARCHITECT CONFIRMATION）: Foot Proxy Design Requirements Investigation v1.0

**Status**: Investigation Complete（Read-only、Design Requirements整理のみ。本文書
執筆時点はArchitect Decision待ちだったが、その後Architectにより`C-7 Proxy Design
Decision = DECIDED — OPTION A — KEEP CURRENT CANDIDATE B`が正式決定された。詳細は
§16 Evidence Status Annotationおよび`docs/Phase_C7_Foot_Proxy_Design_Decision_
v1.0.md`参照）
**Date**: 2026-08-18

**Evidence Status Annotation（2026-08-18追補）**: 本文書§3〜§10（特にcase-001由来の
Historical Region-1 Finding、`t≈0.19`/`required-radius≈0.012mm`/Region 1 crossover）
は、後続のCross-Case Validation / Original Evidence Reconstruction / Historical
Condition Grid-Search / Evidence Status Consolidation / Evidence Decisionを経て、
Evidence Statusが正式に整理された。詳細は**§16 Evidence Status Annotation**を参照。
本追補は既存の§1〜§15の記述・数値・Figuresを一切削除・改変しない（追記のみ）。

**Phase番号についての注記（重要）**: 依頼では `docs/Phase_C6_...md` が既定名として提案されたが、
`C-6` は既に `docs/Phase_C3_Prosthesis_Anatomy_Collision_Constraint_Freeze_v1.0.md`（§16「次Phase
への引継ぎ」、Final Status）にて **Malleus/Stapes拡張** 用のPhase番号として正式に予約済みである
ことを確認した。したがって本文書では `C-6` を使用せず、既存のC-Phase連番規則（C-1〜C-5が
使用済み、C-6が予約済み）に従い、次の未使用連番として **`C-7`（暫定・未確定）** を提案する。
この番号はArchitectが別名・別番号を指示した場合、いつでも差し替え可能な暫定ラベルであり、
今回のCommitは行わないため、確定前に自由に変更できる。

**C-6 / C-7 Phase関係（明記）**:
```
C-6 = Malleus/Stapes Collision Expansion（既存予約、docs/Phase_C3_...md §16）
C-7 = Foot Proxy Design Requirements Investigation（本文書、暫定番号）
```
C-7はC-6の代替ではない。C-6の予約内容・スコープを本文書は一切変更・上書きしない。
両者は独立したPhase候補であり、着手順序も本文書では決定しない。

**位置付け**: これはC-5の再開ではない。C-5（Foot Collision Representation & Contact Semantics
Investigation）は`CLOSED / SPECIFICATION CLARIFICATION RECORDED`のまま維持される。本文書は、
C-5 Round 1で確認された「Real Foot ≠ Sphere」「単純なSphere radius adjustmentではrim側の
Geometry tensionを解決できない」というEvidenceを出発点として、将来のProxy設計判断に必要な
Design Requirements・Trade-offを整理するための、独立した新規Read-only Investigationである。
コード変更・Candidate B変更・Tolerance値変更・Collision Engine変更のいずれも伴わない。

---

## 1. Objective

Real Bell Foot（`BellFoot()`実形状）をCollision Proxyで表現するにあたり、
**Collision Safety ConstraintとしてProxyに何を表現させる必要があり、何を表現させる必要が
ないのか**をEvidenceベースで明らかにする。

出発点とするEvidence（C-5 Round 1、変更なし・再検証なし）:

```
Real Foot ≠ Sphere

単純なSphere radius adjustmentだけでは
rim側のGeometry tensionを解決できない
```

本調査はBug FixingではなくDesign Requirement Clarificationである。Proxy redesignの実装、
Candidate Bの変更、Tolerance値の再評価は行わない。

## 2. Scope / Non-scope

**今回のScope**:
- `BellFoot()`実形状のGeometry構造をCollision Proxy設計の観点から整理（Read-only）
- Collision上重要な領域（Bone接近領域/Contact-Rim領域/Shaft接続領域）の特定
- 現行Candidate B（3球Sphere Proxy）の過大/過小表現領域の整理
- 代替Proxy設計候補（実装なし、設計レベルの比較のみ）
- 現行Collision Engine / BVH architecture（`three-mesh-bvh`）とのCompatibility整理
- C-5で確定したContact/Tolerated Penetration/Penetration semanticsを前提とした整理

**Non-scope（今回実施していないもの）**:
- Foot Proxy形状の再設計・実装
- Candidate B半径の変更
- `FOOT_CONTACT_TOLERANCE_MM`（0.15mm）の変更・再評価
- Collision Engine（`collisionTest.ts`/`anatomyCollisionIndex.ts`）の変更
- `CollisionResult`のAPI変更
- Scoring（`computeScore()`）の変更
- C-2/C-3/C-4/C-5の再開・再検証
- Commit / Push

## 3. Evidence Sources

今回、以下を実際に読み直して確認した（Read-only、推測に依らない）:

| Source | 内容 |
|---|---|
| `src/scenes/models/ProsthesisModels.tsx:1329-1426`（`BellFoot()`） | Real Bell Foot実形状（outer/inner wall、rim、taper、spherical cap、slit構造）。本日再読、確認済み |
| `src/engine/collision/prosthesisCollisionGeometry.ts` | Collision Proxy構築（Foot 3球、Head Plate OBB、`FOOT_CONTACT_TOLERANCE_MM`定義）。本日再読、確認済み |
| `src/engine/collision/collisionTest.ts` | Collision判定本体（`intersectsSphere`/`intersectsBox`/`closestPointToPoint`分岐）。本日再読、確認済み |
| `src/engine/collision/anatomyCollisionIndex.ts` | Anatomy側BVH構築（`MeshBVH`、Bone/Malleus/Stapes）。本日再読、確認済み |
| `package.json` | `three@^0.184.0` / `three-mesh-bvh@^0.9.11`。本日確認済み |
| `docs/Phase_C5_Foot_Collision_Representation_Investigation_v1.0.md` §3, §4, §10, §16 | Envelope vs 実固体断面積の過大評価（6〜8倍）、Geometry Finding、Layer構造 |
| `docs/Phase_C3_Prosthesis_Anatomy_Collision_Constraint_Freeze_v1.0.md` §16 | C-6予約状況（Malleus/Stapes拡張） |
| Project Memory（2026-08-15、Foot #0/#1 Deep Dive／Foot Y-axis Fine-Sampling Deep Dive／Collision Attribution investigation／Foot Proxy Design Evaluation、**case-001**） | 実`Bone.glb`+実`MeshBVH`による実測値（rim〜apex 17点の`required-radius(t)`曲線等）。**今回のセッションでは再実行していない**——既存の実測Evidenceとして引用し、出典を明記する。Architect Review指摘により、これらの実測は**case-001**に限定された観測であることを明記する（他ケースでの成立は未検証、§11 Q2参照） |

Memory由来のEvidenceは全て、実プロジェクトの`computeProsthesisModelPose`/`buildProsthesisCollisionProxy`/`testCollision`関数と実`Bone.glb`ジオメトリ・実`MeshBVH`を用いた測定であり（手計算やシミュレーションの再実装ではない）、当時の`git diff --stat`によりコード変更を伴わなかったことが確認されている。本文書ではこれを推測ではなく確定Evidenceとして扱うが、**今回のセッションで再測定していない**こと、および**case-001に限定された観測**であることを明記する。

## 4. Real Foot Geometry Requirements

`BellFoot()`のGeometry構造（ローカルY: 0=rim/底面 〜 `BELL_HEIGHT_MM=1.095`=apex/頂点）:

```
Outer wall  : 円錐台 RIM_R=0.795mm → SLIT_TOP_R=0.599mm（Y∈[0, 0.717]）
              + 球冠テーパー（R_SPH≈0.898mm、中心Y_C≈0.582）
              → apex（Y=1.095）にて半径0へ収束（数学的に閉じた点）
Inner wall  : 肉厚WALL_T=0.096mm内側オフセット、同系統のテーパー（R_SPHI≈0.768mm）
Rim         : Y=0の環状閉鎖ストリップ（RIM_R−WALL_T 〜 RIM_R、幅0.096mm）
Slit        : 0°/90°/180°/270°を中心に32.0°×4箇所が開口
              （実体は周方向の約64.4%＝4×58.0°/360°のみ）
Cavity      : 外壁・内壁間は中空（実体は薄肉のみ、内部に質量なし）
```

**Collision Proxy設計上の意味**:

1. **Outer wallのenvelope（外形の輪郭）**が、Boneと物理的に接触しうる唯一の面である。
   Slit/Cavity/Inner wallは、Outer wall envelopeの内側に完全に包含される（Slitから
   Boneが「侵入」してくるような形状ではない——Outer wall自体が周方向の一部にしか
   存在しなくても、その一部が張り出す最大半径はSlitの有無に関わらず変わらない）。
   したがって、Collision判定にとって少なくとも**Inner wall/Slit/Cavity構造そのものは
   Collision Proxy設計上の要求事項ではない**という点は、幾何学的Evidenceから直接
   確認できる。

2. **実固体断面積は、Envelope面積の6〜8倍過小**（C-5 §4のEvidence、rim/mid比較）。
   これは、現行Sphere Proxy（Envelopeを模したもの）が「実体積」を過大評価している
   ことを意味するが、上記1.の理由により、「実固体か中空か」はCollision Safety
   Constraintの設計要求には直接関与しない可能性が高い。過大評価に見える6〜8倍の差は、
   Envelope vs 実固体という**異なる指標を比較した結果**であり、Envelope自体の
   過大/過小評価とは別問題である（C-5 §4「これは"Collisionの誤検知を引き起こしている"
   ことの証明ではない」と整合）。

3. Rimは、Bell Footの中で最も径が大きい（0.795mm）部位である。§5のcase-001分析
   では、Rim付近がBone/底板に最も近接する領域として観測されている（詳細は§5）。
   **この観測がRim形状の臨床的な設計意図を証明するものではない**——本文書が
   確認できるのは幾何学的Evidenceのみであり、臨床的な設計根拠については別途
   Evidenceが必要である。

**注記**: 「ProxyがReal Footの何を表現すべきか」（Outer Envelope／Contact Zone／
Safety Envelope等のいずれを優先すべきか）自体は、本文書のEvidenceだけでは
確定できないDesign Requirementであり、§11で改めて整理する。上記1.は
Inner wall/Slit/Cavityが不要である根拠は示すが、それだけでは「Outer Wall Envelope
を表現することが必須仕様である」とまでは断定できない。

## 5. Collision-relevant Regions（case-001 Evidenceに基づく観測）

2026-08-15のFoot Y-axis Fine-Sampling Deep Dive（Project Memory、実Bone.glb/実MeshBVH
測定、`localYToWorld`のアフィン性を利用しFoot#0-Foot#2間を17点で線形補間した各点で
`closestPointToPoint`によりBone表面までの実距離を測定したもの。**case-001**、本セッション
では再測定していないが、Ground Truth Transform（STEP3）確定後・Candidate B確定前の実測で
あり、今回の対象コード（`BellFoot()`/`prosthesisCollisionGeometry.ts`）と矛盾しないことを
本日のコード再読で確認済み）による、`t=0`(rim)〜`t=1`(apex)の2曲線:

```
required-radius(t)   [Bone非衝突を保つ最大半径、case-001]
  t=0.00 (rim)  : 0.172mm
  t≈0.19        : 0.012mm  ← 最小値（Boneに最も近接する点）
  t=1.00 (apex) : 0.636mm
  → 滑らかかつ単調、不連続点なし（Pattern A、case-001において確定）

realOuterRadius(t)   [BellFoot()実形状の外壁半径]
  t=0.00 (rim)  : 0.795mm
  t=1.00 (apex) : 0.000mm（数学的に閉じた点）
  → 滑らかな単調減少

gap(t) = realOuterRadius(t) − requiredRadius(t)   [case-001]
  t≈0.19        : +0.727mm（最大、実形状がBone許容量を最も超過）
  t≈0.80        : 0（交差点）
  t=1.00 (apex) : −0.636mm（実形状がBone許容量を大きく下回る）
```

**重要な限定事項**: 上記の`required-radius(t)`/`gap(t)`はいずれも**case-001**の
Pose・寸法条件下での実測であり、他ケース（shaftLength違い等）で同一の曲線形状・
同一の交差点(t≈0.80)・同一の最小点(t≈0.19)が成立するかは**未検証**である
（§11 Q2）。以下の「Region 1」「Region 2」という呼称は、この文書内では
**case-001で観測された区分**を指す略称として用いる。

**case-001において観測されたCollision-relevant Regionの区分**:

```
Region 1（case-001観測）: Rim〜t≈0.80（Y≈0〜0.89mm）
  = "Bone接近領域" + "Contact/Rim領域"
  = gap(t) > 0 の区間 = case-001ではCollision上主要な制約領域として観測された

Region 2（case-001観測）: t≈0.80〜1.00（apex/Shaft接続領域）
  = gap(t) < 0 の区間 = case-001ではCollision上安全な区間として観測された
```

**重要な非自明ポイント（case-001）**: 最もBoneに近接する点はrim自体（t=0）ではなく、
**t≈0.19**であった。点サンプリングに基づくいかなるProxy設計も、この最小点を
見落とさないだけの密度でサンプリングするか、連続的な表現を採用する必要がある。
Candidate Bの現行3点サンプリング（t=0, 0.5, 1.0）はこの最小点を直接には捉えて
いない。ただし、この最小点の位置（t≈0.19）自体がcase-001に固有のものか、
他ケースでも同様の位置に現れるかは未検証である。

**観測のまとめ（Requirementではなく観測として記録）**: 今回のcase-001分析では
rim〜t≈0.80が主要な設計制約領域として観測された。Foot全体を均等にProxy化する
必要があるか、Region単位で重み付けすべきかは、他ケースでの検証を経た上でDesign
Requirementとして定義・検証する必要がある（§11 R2参照）。

## 6. Current Sphere Proxy Limitations

Candidate B（`CANDIDATE_B_FOOT_SPHERE_RADII_MM`、`prosthesisCollisionGeometry.ts:132`、
今回変更なし）:

```
#0 (t=0.0, rim)  = 0.7950 mm
#1 (t=0.5, mid)  = 0.7704 mm
#2 (t=1.0, apex) = 0.6028 mm
```

§5の`required-radius(t)`曲線（case-001）と対比:

| Sphere | t | Candidate B半径 | required-radius(t)（case-001） | 差分 | 評価 |
|---|---|---|---|---|---|
| #0 | 0.0 | 0.7950mm | 0.172mm | +0.623mm | 過大表現（Region 1、Foot#0 Deep Dive実測penetration≈0.623mmと一致） |
| #1 | 0.5 | 0.7704mm | ≈0.25mm | +0.518mm | 過大表現（Region 1、Foot#1 Deep Dive実測penetration≈0.518mmと一致） |
| #2 | 1.0 | 0.6028mm | 0.636mm | −0.033mm | 過小表現（Region 2、安全側、実測非衝突と整合） |

**なぜ単一/個別radius adjustmentでは解決できないか（case-001のgeometry modelに基づく観測）**:

1. `gap(t)`は`t≈0.80`で符号反転する（case-001）。Region 1で`required-radius(t)`
   （最小0.012mm、最大でも0.25mm程度）に合わせて#0/#1を縮小すると、実際のBell
   Foot rim/mid外壁（0.795mm/0.77mm）より遥かに小さい「点」に近い球になり、
   Envelopeを表現する球としての意味を失う。

2. 今回のgeometry modelおよびrequired-radius定義に基づくと、Region 1では
   Real Foot Outer Envelope自体がrequired clearanceを超過する構造的constraintが
   観測された（case-001）。すなわち、Envelope形状に忠実な（=Real Footと同程度に
   大きい）Proxyは、Region 1のどこかでBone-clearance要求を超過する——これは
   今回のgeometry model・BVH実測から導かれる幾何学的・数学的なEvidenceであり、
   臨床的な安全要件や臨床的に許容される接触量についての主張ではない。

3. Candidate Bの3点サンプリング（t=0, 0.5, 1.0）は、case-001において最もBoneに
   近接する実際の点（t≈0.19）を直接評価していない。仮に#0/#1の半径を個別調整
   しても、サンプリング密度自体が粗いため、真の最悪点を捉えられない可能性が残る。

**結論（case-001のgeometry modelに基づく）**: 半径調整のみによる解決（Option A系の
延長）は、case-001で観測されたRegion 1に関する限り、今回のgeometry model上では
解決しないことが観測された。これはC-5 Round1のEvidence（「単純なSphere radius
adjustmentだけではrim側のGeometry tensionを解決できない」）と整合する。

## 7. Candidate Proxy Approaches

実装は行わない。**Proxy形状そのものの設計候補（Proxy Design Options）**と、
**判定基準（Tolerance policy）に関する横断的な論点（Cross-cutting Policy Question）**
を分離して整理する（Proxy representationとCollision tolerance policyは責務が異なる
ため、C-5で確定したContact semantics / Tolerance semanticsの責務分離を維持する）。

### 7.1 Proxy Design Options（A〜F、Proxy形状そのものの候補）

```
Option A: Current spherical proxy（現状維持）
  = 3球固定、Candidate B。変更なし。

Option B: Multi-sphere proxy
  = Y軸方向のサンプリング点数を増やす（3→N球）。
    Region 1/2境界付近の粗さは緩和されるが、
    case-001で観測されたRegion 1のgap(t)>0がそのまま残るため、
    今回のgeometry model上は根本解決にならない。

Option C: Capsule / frustum-segment proxy
  = 円錐台/カプセルの連続チェーンでOuter wallの
    テーパーそのものを近似する。
    three-mesh-bvhにintersectsCapsuleは無いため、
    closestPointToPoint多点サンプリング（Option Bの極限）か
    shapecastベースのカスタム距離判定が必要。
    形状忠実度は上がるが、case-001で観測されたRegion 1のgap(t)>0は
    解消されない（実形状に忠実であるほど、むしろRegion 1での
    Bone近接をそのまま表現することになる）。

Option D: Simplified custom convex proxy
  = BellFoot() Outer wall envelopeを単一の凸包（Convex Hull）で近似。
    three-mesh-bvhのintersectsGeometry()で凸メッシュ同士の交差判定が
    可能（新規依存追加不要）。形状忠実度は高いが、
    メッシュ資産の生成・保守（shaftLength依存のY方向オフセット変化への追従）
    が必要。case-001で観測されたRegion 1のgap(t)>0は解消されない。

Option E: Geometry-derived proxy
  = BellFoot()自体のlatheGeometry（outerProfile）をCollision用に転用。
    最も形状忠実だが、prosthesisCollisionGeometry.ts冒頭のコメントが
    明記する「Collision Engineの独立性を保つ」という既存設計方針（Render
    GeometryとCollision Geometryを意図的に分離）と正面から矛盾する。
    Render側（Frozen）の変更がCollision側に意図せず波及するリスクを
    新たに生む。case-001で観測されたRegion 1のgap(t)>0は解消されない。

Option F: Region-specific / hybrid proxy
  = case-001で観測されたRegion 1（rim〜t≈0.80）とRegion 2（apex側）を
    異なる扱いにする。Proxy形状自体は変更せず、判定ロジック側で
    Region分離する案を含む。Region 1に対してどのような判定基準を
    適用するかは、後述のCross-cutting Policy Question（G）と
    連動しうるが、Option F自体はProxy構造上のRegion分離を指す。
```

### 7.2 Cross-cutting Policy Question（G、Proxy形状のOptionではない）

```
G = Region-aware / non-uniform tolerance

既存のFoot専用tolerance機構（role==='foot'、collisionTest.ts、
closestPointToPoint利用）を、単一の flat 0.15mm から
「t（またはsphere index）に応じた非一様tolerance」へ拡張するという論点。
Proxy形状（sphere数・半径・位置、Option A〜Fのいずれか）は一切変更しない。

これはProxy Geometryの設計候補ではなく、C-5で確定したTolerance semantics
（Contact / Tolerated Penetration / Penetration）の"値"の扱い方に関する
Cross-cutting Policy Questionである。C-5で確定したContact semantics/
Tolerance semanticsとの責務分離を維持するため、Proxy Design Options
（A〜F）とは別枠で扱う。§5で確認したrequired-radius(t)曲線（case-001）を
tolerance設計の参考情報として転用できる可能性はあるが、これがC-5の
Specification Clarificationの範囲内か、新たなSpecification Clarificationが
必要かは今回判断しない（§11 Q3）。
```

いずれのProxy Design Option（A〜F）も、case-001で観測されたRegion 1における
幾何学的重なりを、Proxy形状の変更だけでは解消できないことが今回のgeometry
model上で観測された。Option A〜Eは形状忠実度の軸、Option Fは判定ロジックの
Region分離という軸のアプローチであり、Cross-cutting Policy Question（G）は
これらと独立した、判定基準（tolerance policy）の軸の論点である。両者は排他的
ではなく組み合わせ可能である。

## 8. Engine Compatibility

現行Collision Engineの確認済み事実（本日のコード再読）:

```
ProsthesisCollisionProxy = { spheres: CollisionSphere[], boxes: {box,matrix}[] }
  → 既に2種類のPrimitiveを同時サポート（Head PlateはOBB、Shaft/FootはSphere）
    C-1（2026-08-14、Architect承認）で既に実運用実績あり。

collisionTest.ts
  → sphere: intersectsSphere() または role==='foot'時のみ
    closestPointToPoint()（tolerance付き深度判定）
  → box: intersectsBox()
  → いずれもthree-mesh-bvhの公開APIを直接呼ぶのみ（独自三角形交差判定なし）

three-mesh-bvh ^0.9.11 の公開API
  → intersectsSphere / intersectsBox / intersectsGeometry /
    closestPointToPoint / closestPointToGeometry / shapecast / raycast
  → メッシュ同士の交差判定（intersectsGeometry）、カスタム形状判定
    （shapecast）は新規npm依存なしで利用可能。
```

Proxy Design Option別の評価（実装は行わず、既存コード構造からの評価のみ）:

| Option | Implementation complexity | Runtime cost | Collision robustness | Maintainability | Coordinate-transform risk | C-2/C-3 compatibility |
|---|---|---|---|---|---|---|
| A (現状) | なし（実装済み） | 最小（3回のclosestPointToPoint） | case-001観測のRegion1限界あり、既知でありEvidence済み | 高 | なし（Ground Truth Transform検証済み） | 完全（現状） |
| B (Multi-sphere) | 低（ループ回数変更のみ） | 球数に比例して増加 | わずかに改善、case-001観測のRegion1課題は残存 | 高 | なし（既存worldMatrixパイプライン再利用） | 高 |
| C (Capsule/frustum chain) | 中（新規primitive判定が必要） | 中〜高 | 形状忠実度は上がるがcase-001観測のRegion1課題は残存 | 中（新primitive種別の保守） | 低〜中（新規変換経路の追加はバグの温床になりうる、C-3の座標変換バグ史あり） | 中 |
| D (Convex hull) | 高（メッシュ資産生成・保守が必要） | 中（intersectsGeometryはsphere/boxより重い） | 形状忠実度は高いがcase-001観測のRegion1課題は残存 | 低（shaftLength依存の資産更新が必要） | 中 | 中 |
| E (Geometry-derived) | 最高（Render Geometry結合） | 最高（候補ごとのメッシュ生成の可能性） | 最も忠実だがcase-001観測のRegion1課題は残存 | 最低（Collision Engine独立性という既存設計方針と矛盾） | 最高 | 低（既存の意図的分離方針を破る） |
| F (Region-specific hybrid) | 中（Region境界パラメータの追加） | A/Bと同等 | case-001観測のRegion1課題に判定ロジック側で対応可能 | 中 | なし | 高 |

**Cross-cutting Policy Question（G）のEngine Compatibility**（Proxy Design Optionとは
別枠）: 既存の`footContactToleranceMm`機構（`collisionTest.ts`の`closestPointToPoint`
経路）をそのまま流用できるため、Implementation complexity・Coordinate-transform risk
ともに新規Proxy Design Optionより低い。ただし、これはあくまでEngine構造上の
Compatibility評価であり、tolerance値の設計自体の妥当性を判断するものではない
（§11 Q3参照、判断保留）。

## 9. Trade-off Matrix

```
                     形状忠実度   Region1課題への対応  実装コスト   既存Engine適合   Coordinate risk
Option A (現状)         低          対応せず           ゼロ          満点             ゼロ
Option B (Multi-sphere) 中          対応せず           低            高               ゼロ
Option C (Capsule)      高          対応せず           中            中               低〜中
Option D (Convex hull)  高          対応せず           高            中               中
Option E (Geometry-derived) 最高    対応せず           最高           低（設計方針違反） 最高
Option F (Region hybrid) 低〜中     判定ロジックで対応可能 中          高               ゼロ
```
（Cross-cutting Policy Question G は上表に含めない。Proxy形状のOptionではないため、
§7.2/§8末尾を参照）

「Region1課題への対応」列は、case-001で観測されたgap(t)>0区間について、各Option
がProxy形状の変更のみで対応できるかどうかを示す。「対応せず」は、形状忠実度を
上げても今回のgeometry model上ではcase-001のRegion1課題が解消されないことが
観測されたことを意味し、「実物理配置が特定の状態である」という主張ではない。

**この表が示す構造（観測、Requirementではない）**: case-001の分析範囲では、
形状忠実度を上げるOption（B〜E）は軒並みRegion1課題への対応にならず、実装・
維持コストのみが増加する。Region1課題に直接対応しうるのはOption F（判定ロジック
のRegion分離）、およびProxy形状とは別枠のCross-cutting Policy Question（G）で
ある。他ケースでも同じ構造が成立するかは未検証（§11 Q2）。

## 10. Design Findings

Evidence（§4〜§9）から導かれる、今回の分析範囲における**観測結果（Finding）**。
Design Requirement（次章）とは区別し、Evidenceからの直接的な導出物として記録する。

```
[F1] Geometry fidelity alone is insufficient to resolve the Region 1 constraint
     observed in the current analysis.
     （形状忠実度の向上だけでは、今回の分析（case-001）で観測されたRegion 1の
     constraintは解消されない。§6, §7.1, §9参照）

[F2] 今回のgeometry modelおよびrequired-radius定義に基づくと、case-001の
     Region 1ではReal Foot Outer Envelope自体がrequired clearanceを超過する
     構造的constraintが観測された（§5, §6）。これは幾何学的・数学的なEvidence
     であり、臨床的な安全要件・臨床的に許容される接触量についての主張ではない。

[F3] case-001で観測された`required-radius(t)`/`gap(t)`の形状（Pattern A、
     不連続点なし、t≈0.19に最小点、t≈0.80に交差点）が他ケースでも成立するかは
     未検証であり、上記F1/F2の一般化可能性は現時点で未確認である（§11 Q2）。
```

これらはEvidenceからの観測結果であり、それ自体がDesign Requirementを構成する
ものではない。次章のDesign Requirementsは、これらのFindingを踏まえて
「今後何を明示的に定義・検証すべきか」を整理したものである。

## 11. Design Requirements

Evidence・Design Findingsに基づき、将来のFoot Proxy設計判断に向けて
**明示的に定義・検証すべき事項**を整理する（既に確定した仕様ではない）。

```
[R1] Proxyが「Real Footの何」を表現するためのものかを明示的に定義する必要がある。
     候補としてOuter Envelope、Contact Zone、Safety Envelope等があり得る（§4）。
     現時点で「Outer Wall Envelopeを表現することが必須仕様である」とは決めない
     ——これはまだ検証されていないDesign Requirementの候補の一つである。

[R2] 今回のcase-001分析ではrim〜t≈0.80が主要な設計制約領域として観測された
     ため、Collision-relevant regionをどう定義するか（Foot全体を均等に扱うか、
     Region単位で重み付けするか）を明示的に定義・検証する必要がある（§5, §10 F3）。
     他ケースでの検証を経ていないため、「apex側は精度不要」という断定はしない。

[R3] case-001では、rim（t=0）ではなくt≈0.19付近に最小clearanceが観測された。
     他ケースでも成立するかは未検証である（§5, §11 Q2）。点サンプリング方式を
     採る場合、この観測を踏まえた検証（サンプリング密度が最小点を捉えられるか）
     が必要になる可能性がある。

[R4] 今回のgeometry modelおよびrequired-radius定義に基づくと、case-001の
     Region 1ではReal Foot Outer Envelope自体がrequired clearanceを超過する
     構造的constraintが観測された（§10 F2）。将来の設計判断は、この構造的
     constraintをEvidenceとして踏まえる必要があるが、これをもって特定の
     Proxy設計（Option A〜F、Cross-cutting Policy Question G）の採否を
     決定づけるものではない。

[R5] 将来の設計変更は、既存のrole別Dual-primitive architecture（spheres+boxes）
     と、Ground Truth Transform検証済みのworldMatrixパイプラインを保持すべきである
     （§8、新規座標変換経路の追加はC-3の実績あるバグ源であるため）。

[R6] C-5で確定したContact/Tolerated Penetration/Penetration semanticsとの整合性を
     保つこと。0.15mmという値自体は今回もProvisionalのまま変更しない。Proxy
     Design Options（§7.1）とCross-cutting Policy Question（§7.2）の責務分離を
     維持すること。
```

## 12. Open Questions

```
Q1. Rim-critical Zone（case-001で観測されたRegion 1）を、Penetration回避とは
    別の、専用のCollision基準を新設すべきか？
    → Design-level open question。過去のProject Memory（2026-08-15
      Foot Proxy Design Evaluation）でも同種の問いが提起されたが、
      Architectのスコープ承認を経ておらず未着手のまま。

Q2. case-001で観測されたt≈0.19の最小Clearance点（0.012mm）、および
    required-radius(t)/gap(t)の形状（交差点t≈0.80等）は、他ケースでも
    同様に成立するか？
    → 本セッションでは再測定していない。形状忠実度を上げるOptionを
      具体的に検討する段階になった場合、追加Evidence収集の候補。

Q3. Region-aware tolerance（Cross-cutting Policy Question G）は、C-5で
    確定したTolerance semanticsの"概念"の範囲内の拡張と解釈できるか、
    それとも新たなSpecification Clarificationが必要か？
    → 現時点では、Region-aware tolerance = potential new Specification /
      Design Decision として扱う。C-5文書には戻らず、C-5文書自体も
      変更しない。今回は判断しない。

Q4. 将来Malleus/Stapes（Phase C-6予定）へCollision対象を拡張する際、
    Foot Rimと解剖学的に近接するMalleus/Stapesにも同種のRegion-aware
    な扱いが必要になる可能性はあるか？
    → 今回のScope外だが、C-6設計時に参照する価値がある観点として記録。
```

## 13. Architect Decision Required

```
Option A
Keep current Sphere Proxy
  = Candidate B（現行）を維持する。case-001で観測されたRegion 1の
    既知の課題は、Concrete Defect Evidenceがない限りそのまま許容する。

Option B
Redesign Proxy Geometry
  = §7.1 Option B/C/D/Eのいずれかで形状忠実度を上げる。
    ただし§9のTrade-off Matrixが示す通り、これ単体ではcase-001で
    観測されたRegion 1の課題への対応にはならない点に留意が必要。

Option C
Region-specific / hybrid Proxy
  = §7.1 Option Fに相当。Proxy形状・判定ロジックの両方でRegion単位の
    扱いを導入する。

Option D
Alternative Collision Representation
  = §7.2のCross-cutting Policy Question（G、Region-aware tolerance）、
    またはそれ以外の新しい判定方式。Proxy形状は変えず、判定semantics
    側で対応する案。

Option E
Defer Proxy redesign
  = C-5同様、Concrete Defect Evidenceが得られるまで一切着手しない。
```

どのOptionを採用するかは、本文書では決定しない。

## 14. Conclusion

Real Bell FootとCandidate B Sphere Proxyの間には、case-001の分析範囲において、
Envelope面での構造的な緊張関係（gap(t)の符号反転、rim〜t≈0.80の区間で
gap(t)>0）が観測された。これは既存実装・既存Evidenceから確認できる幾何学的・
数学的事実である。この緊張関係は、今回の分析範囲では、形状忠実度の向上
（Option B〜Eのいずれでも）だけでは解消されないことが観測された（§10 Design
Findings）。したがって、根本的な対応には形状（Geometry）だけでなく判定基準
（Collision Semantics、§7.2 Cross-cutting Policy Question）側の検討も必要に
なる可能性がある、というのが本調査の観測結果である。

**ただし、これは「Option F/Gを採用すべき」という結論ではなく、また「rimの
近接がclinicalに正しい/許容される」という主張でもない**。C-5同様、Concrete
Defect Evidence（Historical Foot CollisionはClean Baselineで再現していない、
C-5 §9）は今回も存在しないため、**Proxy redesignが必要であるという結論を
先に置かない**。また、上記の観測はcase-001のみに基づくものであり、他ケースへの
一般化は未検証である（§10 F3、§12 Q2）。

本文書は、次にArchitectが判断を下す際に使えるEvidence・Design Findings・
Design Requirements・Trade-offの整理を提供するものであり、方向性の決定
そのものではない。

---

## 15. 参照

- `docs/Phase_C5_Foot_Collision_Representation_Investigation_v1.0.md`（§3, §4, §10, §16, §18 — Real Foot Geometry Evidence、Contact/Penetration Semantics確定事項）
- `docs/Phase_C3_Prosthesis_Anatomy_Collision_Constraint_Freeze_v1.0.md`（§16 — C-6 Phase番号予約状況、Malleus/Stapes Collision Expansion）

---

## 16. Evidence Status Annotation（2026-08-18追補、C-7継続調査の結果反映）

**位置付け**: 本セクションは、§1〜§15（本文書のOriginal Finding、特にcase-001由来の
Region 1 constraint観測）を書き換えるものではない。以下の後続Read-only Investigation/
Documentationを経て確定した、Evidence Statusの正式な整理を追記する:

```
docs/Phase_C7_Foot_Proxy_Cross_Case_Validation_v1.0.md
docs/Phase_C7_Foot_Proxy_Original_Evidence_Reconstruction_v1.0.md
docs/Phase_C7_Foot_Proxy_Historical_Condition_GridSearch_v1.0.md
docs/Phase_C7_Foot_Proxy_Evidence_Status_Consolidation_v1.0.md
```

§1〜§15に記載された数値・Figures・観測結果そのものは削除・訂正・上書きしていない。
Candidate B・Foot Proxy実装・`FOOT_CONTACT_TOLERANCE_MM`・Collision Engine・
`CollisionResult`・Scoring・C-2〜C-6のいずれもこの追補を理由に変更していない。

### 16.1 Primary Evidence

```
Primary Evidence = Pattern A — Common Structural Pattern

Clean Baseline Pose + ±5° sweep
  8/8 evaluable BELL cases（case-001, 003, 004, 005, 007, 008, 011, 012）
  gap(t) < 0（Region 1全域で安全側）
  minimum required-radius の位置 = t=0 (rim)
  Region 1 crossover = none
```

現行repository・実project関数・実Bone.glb・実MeshBVH・現行の正しい`basePos`選択
（`STAPES_HEAD`）で再現可能なEvidenceとして、Pattern Aを本文書のPrimary Evidenceと
する（出典: `docs/Phase_C7_Foot_Proxy_Cross_Case_Validation_v1.0.md` §6-9）。

### 16.2 Historical Region-1 Finding（§1〜§10のOriginal Finding）の現在のEvidence Status

```
Historical Region-1 Finding
= Secondary / Historical Evidence
= Source Condition Unresolved
= Qualitative reproduction only
= Root Cause Unconfirmed
```

本文書§3〜§10が引用した`t≈0.19`・`required-radius≈0.012mm`・Region 1 crossoverと
いう旧Figures（出典: Project Memory 2026-08-15、Foot Y-axis Fine-Sampling Deep
Dive等）について、後続調査で確認された事項:

1. **Clean BaselineではHistorical Findingを再現できなかった**（`docs/Phase_C7_Foot_
   Proxy_Cross_Case_Validation_v1.0.md` §3, §6。case-001自身を含む）。
2. **Cross-case validationでも同様のHistorical Region-1 patternは確認されなかった**
   （同文書§6-9。評価可能な8 BELL case全件で、Clean Baseline + ±5° sweepの下では
   Pattern A——一貫してclear——が観測された）。
3. **Historical source conditionは特定できていない**（`docs/Phase_C7_Foot_Proxy_
   Original_Evidence_Reconstruction_v1.0.md` §4-§9。Git history上に旧harnessの
   痕跡なし、`basePos`・offset・厳密なcase識別子は未確認）。
4. **`STAPES_FOOTPLATE`では旧Findingと定性的に類似するcrossover patternを再現した
   が、定量的一致ではない**（`docs/Phase_C7_Foot_Proxy_Historical_Condition_
   GridSearch_v1.0.md` §5-§8。Evidence-groundedな16条件中、`basePos=STAPES_
   FOOTPLATE`の全8条件でrim付近のgap(t)>0・interior minimum・crossover存在という
   定性的パターンが再現されたが、`minimum required-radius`は旧数値0.012mmに対し
   最良候補でも0.4098mmであり、約34倍の乖離が残る）。
5. **したがってHistorical FindingのRoot Causeは未確定である。**

### 16.3 Evidence Interpretation（用語の区別）

```
Confirmed ≠ Reproduced ≠ Qualitative-only ≠ Hypothesis
```

`basePos`/reference point choiceは、Historical Findingの定性的形状を説明し得る
最も強い未解決仮説（strongest hypothesis）であるが、以下の通り記述する:

```
STAPES_FOOTPLATE provides partial / qualitative reproduction
and is consistent with the strongest basePos/reference-point hypothesis,
but historical source condition remains unresolved.
```

以下の表現は用いない:

```
Historical basePos = STAPES_FOOTPLATE   （不使用）
Root Cause = basePos                     （不使用）
Root Cause = STAPES_FOOTPLATE            （不使用）
```

`Root Cause = UNCONFIRMED`を維持する。

さらに、以下の区別も維持する（`docs/Phase_C7_Foot_Proxy_Evidence_Status_
Consolidation_v1.0.md` §7 Critical Wordingと同一）:

```
Reproducible ≠ Clinically validated
Qualitative reproduction ≠ Historical condition identified
Strong hypothesis ≠ Root cause
Consistently clear under tested conditions ≠ Universal collision safety
```

Pattern AをPrimary Evidenceとして採用しても、「Foot Proxy is clinically safe」とは
記述しない。

### 16.4 Architect Decision（参照）

```
C-7 Evidence Decision = DECIDED（Option A採用、Evidence Hierarchy）
C-7 Proxy Design Decision = DECIDED — OPTION A — KEEP CURRENT CANDIDATE B
```

Evidence Hierarchyに関するOption A（Pattern AをPrimary Evidenceとして正式採用し、
Historical Region-1 FindingをSecondary/Historical Evidence・Source Condition
Unresolvedとして併記）がArchitectにより決定された（`docs/Phase_C7_Foot_Proxy_
Evidence_Status_Consolidation_v1.0.md` §16参照）。本追補はその反映である。

その後、上記Evidenceに基づき、Foot Collision Proxy自体のDesign Decision
（Candidate Bを維持するか、形状忠実Proxyへ変更するか、Redesignを保留するか）も
別途Architectにより決定された: `C-7 Proxy Design Decision = OPTION A — KEEP
CURRENT CANDIDATE B`（Evidence-based conservative decision、`Candidate B is
proven optimal`という意味ではない。詳細は`docs/Phase_C7_Foot_Proxy_Design_
Decision_v1.0.md`を参照）。Candidate B・Foot Proxy実装・Collision Engine・
Tolerance Policyはこの決定によっても変更されていない（UNCHANGED）。

## 17. 参照（Evidence Status Annotation追加分）

- `docs/Phase_C7_Foot_Proxy_Cross_Case_Validation_v1.0.md`（§3-§9 — Pattern A、Historical Finding非再現の確認）
- `docs/Phase_C7_Foot_Proxy_Original_Evidence_Reconstruction_v1.0.md`（§4-§9 — Historical source condition追跡、Evidence Source Trace）
- `docs/Phase_C7_Foot_Proxy_Historical_Condition_GridSearch_v1.0.md`（§5-§9 — STAPES_FOOTPLATE仮説のEvidence-grounded検証、Partial/Qualitative reproduction判定）
- `docs/Phase_C7_Foot_Proxy_Evidence_Status_Consolidation_v1.0.md`（§8-§17 — Evidence Confidence分類、Architect Decision）
- Project Memory `project_kurz_collision_constraint`（2026-08-15各エントリ、case-001 — Foot #0/#1 Deep Dive、Foot Y-axis Fine-Sampling Deep Dive、Collision Attribution investigation、Foot Proxy Design Evaluation）
