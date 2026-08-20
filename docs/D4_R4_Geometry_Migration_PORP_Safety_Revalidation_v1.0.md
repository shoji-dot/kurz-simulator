# D-4 R4 Geometry Migration — PORP Absolute-Coordinate Safety Revalidation

Status: Investigation Only — 実装なし・Commitなし・Pushなし

## 1. Baseline

```
$ git status && git diff --check && git rev-parse HEAD
HEAD (開始時)     = 871b1c5926dd73d6bf5f823dfe6785f2aabc900a
HEAD (終了時)     = 871b1c5926dd73d6bf5f823dfe6785f2aabc900a（変化なし）
git diff --check = 出力なし
staged           = NONE
Commit / Push     = NONE（本Task中、一切実行していない）
```

Working Treeには本Task開始時点で以下6ファイルの未コミット変更が存在した（本TaskはこのいずれもEditしていない）:

```
src/components/SimulationMode.tsx        （D-4 Option② Freeze/Slerp関連、本Task対象外）
src/components/ui/ControlPad.tsx         （同上）
src/engine/collision/prosthesisCollisionGeometry.ts  ← R4 Geometry Migration対象（2ファイルの1つ）
src/scenes/SimScene.tsx                  （D-4 canonicalPose.ts配線、本Task対象外）
src/scenes/models/ProsthesisModels.tsx   ← R4 Geometry Migration対象（2ファイルの1つ）
src/scenes/transformControlsConfig.ts    （Decision 3 sign定数、本Task対象外）
```

Task冒頭の前提「変更済みファイル＝2ファイルのみ」は、footOff/headOff変更という**意味では**正確
（`git diff`で該当2ファイルの差分を直接確認し、`footOff=0`/`headOff=len+0.15`であることを確定した）。
ただし同じWorking Treeには、この2ファイルの変更を実際に消費する新規モジュール
`src/scenes/canonicalPose.ts`（untracked、新規ファイル）とその配線（`SimScene.tsx`等）も同時に
存在しており、これらは今回のR4 Migration全体（footOff/headOff変更を含む、より広い一連の変更）の
一部である。**この事実自体はBaseline異常ではない**（Task本文が「今回のTask由来の変更がない」と
確認を求めているのはこの2ファイル自体の差分内容についてであり、実際にその通りであることを
確認した）。この6ファイル構成は本Task開始前から不変（本Task中に一切Editしていない）。

未追跡ファイル（`.claude/`, `.mcp.json`, `.serena/`, `_softclip_split_backup/`, `docs/D1_*.md`×2,
`docs/D4B_*.md`×3, `docs/D4_Architect_*.md`, `docs/D4_Implementation_*.md`,
`docs/D4_Manipulation_Axis_*.md`, `eac_topology_check.py`, `serena-mcp.ps1`,
`src/scenes/canonicalPose.ts`）はすべて本Task開始前から存在し、一切変更・削除していない。
本レポート自体は新規untrackedファイルとして追加。

## 2. Test Environment

- 静的解析: 実ソースコードの直接読解（`git diff`によるR1/R4差分確認含む）。
- 数値検証: Node.js（プロジェクトの`node_modules/three`, r184、`git diff`と実ソースから複製した
  数式のみ使用）による、R1（旧footOff/headOff、Migration前）とR4（新footOff/headOff、現在の
  Working Tree）の並行再現・比較。
- **実行時ライブ検証（新規、今回初めて成功した手法）**: 既存の`npm run dev`（このセッションが
  起動したものではなく、既に稼働中だったVite dev server、port 5173、`.claude/launch.json`の
  `url`設定により接続。本Taskはこのプロセスを起動も停止もしていない）に対し、Browser paneから
  `import('/src/scenes/canonicalPose.ts')` / `import('/src/engine/collision/prosthesisCollisionGeometry.ts')`
  のdynamic importで**実際に動いているモジュールインスタンス**を取得し、`resolveCanonicalPose()` /
  `buildProsthesisCollisionProxy()`を実引数で直接呼び出した（D4B_Collision_Candidate_Runtime_Safety_
  Verification_v1.0.md §3.1で確立済みの手法を、今回のGeometry Migration検証に再利用）。
- 環境制約（既知、再現確認済み）: `document.hidden === true` / `document.visibilityState === "hidden"`
  固定であり、`computer{action:"screenshot"}`は`"the Browser pane is not displayed, so the page is
  not compositing frames"`で失敗した。過去3セッション（D-4-B Integrity Audit / Runtime Safety
  Verification / Final Runtime Verification、いずれも[[project_kurz_d_track_case_ux]]参照）と
  完全に同一の制約が今回も再現した。したがって**Canvas内部のPointer Drag/Keyboard操作・実MeshBVH
  Bone Collisionの目視確認はNOT REPRODUCIBLE**（下記4/6節）。一方、Canvas非依存のdynamic
  import経由での関数直接呼び出しは正常に動作し、実行中のアプリと**桁レベルで一致する**実測値を
  得られた（3節）。

## 3. PORP Test Matrix / 4. R1/R4 Comparison結果

対象: PORP `porp-ttp-variac`（`footType: BELL`, `headType: BELL_TOP`）、`basePos = STAPES_HEAD`、
`shaftLength ∈ {2.0, 2.5, 3.0}mm`。R1（`git diff`確認済みの旧式、`footOff=-(len/2)`,
`headOff=len/2+0.15`、Positionは`computeCurrentAxisAlignmentPose()`のshaft midpoint）と
R4（現在のWorking Tree、`footOff=0`, `headOff=len+0.15`、Positionは`resolveCanonicalPose()`の
Foot Contact Anchor）を、同一のTranslate（±X/Y/Z 0.5mm）・Rotate（tilt/tiltZ ±5°/±15°）・
Shaft Roll（±10°）candidateについて並行評価した（スクリプトは検証後に破棄、`git status`に
残存しないことを確認済み。ロジックはR1側=`git diff`で確認した旧数式＋
`docs/D4B_Collision_Candidate_Integrity_Audit_v1.0.md`記載の`composeDragCandidatePose`/
`composeRotationCandidatePose`の実際の式、R4側=現在の`canonicalPose.ts`をそのまま複製）。

**Foot Anchor / Head Plate（Box中心）: 全candidate・全shaftLengthでR1≡R4、diff ≈ 1e-16mm
（浮動小数点誤差のみ）。** これは「Known Completed Verification」の既報値（Foot distance=0,
Head delta=5.5e-16mm）と整合し、かつ**今回、翻訳系・回転系・Shaft Roll系すべてのcandidateに
拡張して再確認**した点で既報よりカバレッジが広い。

```
shaftLength=2, translate ±X/Y/Z          : footDist ≈ 2.5〜3.5e-16mm, headDist ≈ 5〜6e-16mm
shaftLength=2, shaftRoll ±10°            : footDist ≈ 2.9〜4.4e-16mm, headDist ≈ 5.9〜7.1e-16mm
shaftLength=2, rotate tilt ±5°/±15°      : footDist = 4.71e-2mm / 1.409e-1mm（★下記参照）
shaftLength=2, rotate tiltZ ±5°          : footDist = 8.72e-2mm
```

Rotate candidateでのfoot/head diff（数cm未満、tiltが大きいほど拡大）は**footOff/headOff
Migration由来のバグではない**——R1（shaft-midpoint pivotで回転、Euler再合成Quaternion）とR4
（Foot-anchor pivotで回転、`Rx(tilt)*Rz(tiltZ)*BaseAlignment*Roll`のpremultiply）は、Position
計算の回転中心そのものが異なる、という**D-4 Axis Design（Decision 3、既にArchitect確定・
Freeze対象）による意図的な設計変更**であることを数式的に確認した（5節Category A′参照）。
footOff/headOff自体（Migrationの対象）は、Rotate candidateにおいても常にR4の同一
`resolveCanonicalPose()`出力に対して一貫して適用されており、Migration固有の追加誤差は
上記diffに含まれていない。

### ★重大な発見: Shaft Collision Sphereの`shaftLength/2`ミスアラインメント

```
shaftLength=2, 全candidate（baseline/translate/rotate/shaftRoll問わず）: maxSphereDist = 1.000mm（= len/2）
shaftLength=2.5:                                                        maxSphereDist = 1.250mm（= len/2）
shaftLength=3.0:                                                        maxSphereDist = 1.500mm（= len/2）
```

Foot/Headは完全一致するにもかかわらず、8個のCollision Sphereのうち**Shaft用5個**（`role:'shaft'`）
だけが、R1とR4の間で常に正確に`shaftLength/2`だけ異なる（translateのみのcandidateでも発生する
＝回転由来ではない、純粋なGeometry Migrationの不整合）。

**原因の特定（`prosthesisCollisionGeometry.ts:167-168`、コード読解で確認、R4 Migrationの
対象diffには含まれず未変更のまま）:**
```ts
const shaftLen   = Math.max(0.01, len - BELL_HEIGHT_MM);
const shaftMidY  = BELL_HEIGHT_MM / 2;                       // ← footOffを参照していない
...
const shaftStartY = shaftMidY - shaftLen / 2;
```
この`shaftMidY = BELL_HEIGHT_MM / 2`は、**R1の`footOff = -(len/2)`のときにのみ数式的に正しい値**
（`apex = footOff + BELL_HEIGHT_MM = BELL_HEIGHT_MM - len/2`、`shaftMid = apex + shaftLen/2 =
BELL_HEIGHT_MM/2`——len依存項が打ち消し合う偶然の一致）である。R4の`footOff = 0`のもとでは、
正しい値は`apex = footOff + BELL_HEIGHT_MM = BELL_HEIGHT_MM`、`shaftMid = apex + shaftLen/2 =
BELL_HEIGHT_MM/2 + shaftLength/2`——**`+ shaftLength/2`の項がMigrationから欠落している**。

**`ProsthesisModels.tsx:1889`（Rendering側）に同一の欠落を確認**:
```ts
const shaftY = isBell ? BELL_HEIGHT_MM / 2 : ...   // 同じ未更新の定数
```
このコードのコメント（1830-1834行、日付「2026-07-23修正」）は今回のR4 Migrationとは**無関係の
別の過去修正**（Bell rim起点→Bell apex起点への描画修正）であり、その時点では`footOff=-(len/2)`
（R1）が前提だったため正しかった。今回のR4 Migrationはこの箇所を更新しておらず、
**RenderingとCollisionの両方が同一の理由・同一の量だけ、同一方向に不正確**（Candidate≠Renderingの
新規乖離ではなく、両者が「静かに」同じだけ間違っている）。

**Live Runtime確認（`document.hidden`制約下でも、Canvas非依存のdynamic import経由で実行・成功）:**
```js
// 実際に稼働中のVite dev serverから、実モジュールを直接呼び出した結果（推測ではない）
product: porp-ttp-variac, shaftLength: 2, basePos: STAPES_HEAD, 全offset=0（baseline）
position（= resolveCanonicalPose()の実際の戻り値）: [-0.7249, -0.0273, 3.5259]
basePos:                                            [-0.7249, -0.0273, 3.5259]
footWorldPoint（実際のbuildProsthesisCollisionProxy()の戻り値）: [-0.7249, -0.0273, 3.5259]
footDistFromBase = 0                                             ← Foot Anchorは正確

shaftSphereCenters[0]（footに最も近いShaft Sphere、実測）:
  distanceFromBase ≈ 0.095mm   （正しくは apex = BELL_HEIGHT_MM ≈ 1.095mm 付近にあるべき）
shaftSphereCenters[4]（headに最も近いShaft Sphere、実測）:
  distanceFromBase ≈ 1.000mm   （正しくは shaftLength = 2.0mm 付近にあるべき）
```
これはNode.js静的再現（上表）と桁レベルで一致し、**静的解析の結論が実際に稼働しているアプリの
コードで裏付けられた**（Evidence Based Review水準の実測値）。

## 5. Bone Collision結果 / Classification Inversionの有無

- **実MeshBVH（実Bone.glb）を用いたaccept/reject二値結果そのもののNOT REPRODUCIBLE**:
  `document.hidden=true`固定により、Canvas内部のPointer Drag/Keyboard操作・
  `?debug=collision`診断パネルのボタン押下がいずれも無反応（過去3セッションと同一の制約、
  2節参照）。したがって「実際にBoneと衝突判定されたか」の二値ログ（`[C3-P0-1-VERIFY]`等）は
  今回も取得できなかった。
- **ただし、Collision判定の入力となるCollision Proxy幾何そのもの（accept/rejectを決定する
  唯一の入力）はNode.js静的検証＋Live Runtime実測の両方で確定した。** `testCollision()`は
  Proxy幾何とBone MeshBVHの決定論的関数であるため、「Proxy幾何がどれだけズレているか」が
  分かれば「そのズレがaccept/reject反転を引き起こしうるか」は幾何学的に評価できる。
- **Foot/Head**: R1≡R4（誤差1e-16mm）。Foot/Headに起因するaccept/reject反転は
  **Category A（Migration由来ではない、regressionではない）**。
- **Shaft（5/8スフィア）**: R1・R4間で常に`shaftLength/2`（1.0〜1.5mm）のワールド座標差。
  `FOOT_CONTACT_TOLERANCE_MM = 0.15mm`（Shaftには本来適用されないが、判定許容誤差の目安として
  比較すると）の6.7〜10倍の大きさであり、**Shaft Sphereが実際の解剖学的位置から系統的に
  `shaftLength/2`だけ足側へズレた場所でBone Collisionを判定している**。これは
  **Category E（実際にCollision Classificationが変化しうる、Migration由来の実regression）**
  に該当する。
    - False Negative方向: 本来ShaftがBoneに接触する位置（Y≈apex〜headに近い側）でのCollisionが、
      実際にはその位置のSphereが存在しない（ズレた場所にしかSphereがない）ため見逃される
      可能性がある。
    - False Positive方向: 本来Shaftが到達しないFoot直上の領域（Y≈0〜apex付近）にShaft Sphereが
      誤って配置されているため、そこにBoneがあれば誤って衝突判定される可能性がある。
    - どちらの方向に転ぶかはケース依存（Bone形状・Placement位置に依存）であり、本Taskの
      検証環境では実MeshBVHでの確定的な発生有無（実際にaccept→reject/reject→acceptの反転が
      起きた具体的ケース）は**UNKNOWN**（実機/E2E検証が必要）。**しかし「発生しうるか」は
      幾何学的にPLAUSIBLE〜MATERIALと確定した**（Foot/Headとは異なり、Shaftはこの検証時点で
      すでに数値的に確定した系統誤差を持つため、単なる可能性論ではない）。
- **RenderingもCollisionと同一の誤りを共有**（4節）しているため、**Candidate（衝突判定対象）と
  Rendering（画面表示）は依然として一致している**（D-4-B Auditが指摘した旧来の非対称性は
  `resolveCanonicalPose()`統一により解消済み、今回新たな乖離は生じていない）。ただし、
  「一致してはいるが、両者とも解剖学的に誤った位置を指している」という意味で、**視覚的にも
  Shaftがfoot付近に短く縮こまって描画され、Headまで届いていないように見える可能性が高い**
  （Rendering側の視覚的影響は未Screenshot確認、UNKNOWN、6節参照）。

## 6. C-2/C-3/C-4 Revalidation（Partial）

- **C-2（Drag Collision Constraint）**: `evaluateDragCandidate()`は`testCanonicalCandidate()`
  経由で`resolveCanonicalPose()`＋新footOff/headOffのProxyを使う（コード読解で確認済み、
  2節参照）。Collision判定ロジック自体（`testCollision`呼び出し）はC-2 Freeze以降無変更。
  Shaft Sphereミスアラインメント（4/5節）はTranslate candidateでも発生するため、**C-2の
  Drag Collision ConstraintはこのShaft問題の影響を直接受ける**。
- **C-3（Rotation Collision Constraint）**: `evaluateRotationCandidate()`も同じ
  `testCanonicalCandidate()`を共有。`FOOT_CONTACT_TOLERANCE_MM`はC-3のみ適用（無変更、確認済み）。
  Rotate candidateでのFoot/Head diffはDecision 3由来（Category A′、regressionではない）だが、
  Shaft Sphereのミスアラインメントは独立して同時に存在する。
- **C-4**: 本Task範囲でC-4固有の追加検証対象コードは確認されなかった（`testCanonicalCandidate`/
  `buildProsthesisCollisionProxy`双方ともC-2/C-3と共通のPathを通るため、上記の評価がそのまま
  適用される）。
- Freeze State自体（Candidate B radii, `FOOT_CONTACT_TOLERANCE_MM=0.15`, Collision Engine構造）は
  一切変更していない。

## 7. Decision 3 Supplementary Verification

Decision 3（Rotation semantics、`ANGLE_TILT_SIGN=1`/`ANGLE_TILT_Z_SIGN=1`、
`transformControlsConfig.ts`）自体は撤回・再設計していない。今回の数値検証で、Decision 3の
Foot-anchor pivot設計（R1のshaft-midpoint pivotとは異なる）が、Rotate candidateにおけるFoot/Head
World位置のR1/R4差（4節）の直接の原因であることを数式的に再確認した——これはDecision 3が
「意図した」設計上の帰結であり、PORP absolute-coordinate safetyの文脈で新たに問題視すべき
挙動ではない（Decision 3のsign自体の正誤はPENDING REAL-DEVICE CONFIRMATIONのまま、本Taskは
その判定に影響を与えない）。

## 8. Danger Zone / Safety Score Regression

本Taskはこの2値を再測定していない（Canvas非依存の`useSimStore`読み取りは技術的に可能だが、
`computeScore()`はPlacementState（lateralOffset/idealPosition等の抽象値）から計算され、
今回発見したShaft Collision Sphereの幾何ズレ（Collision Proxy内部限定の問題）を直接消費しない
ため、この2値の再測定は本Findingの検出力に寄与しない。Task記載の既報値（x:-1.56,y:2.62,z:1.41,
Nearest 3.31mm, Score 85）を上書きする新しい実測は行っていない、UNKNOWN扱いのまま）。

## 9. Runtime Regression

- ControlPad/矢印キー等、Collision Candidateを経由しない操作系（D4-B Audit時点でCollision
  Engine非経由と確定済みの経路）は、本Taskのfindingの影響を受けない。
- `document.hidden=true`固定によりCanvas内Pointer Drag/Keyboard操作は今回もNOT REPRODUCIBLE
  （2節）。実機（shojiさんの通常ブラウザ）でのTranslate/Rotate/Shaft Roll/Placement Commit
  の目視回帰確認はUNKNOWN（未実施）。

## 10. Static Checks

本Taskはソースコードを一切変更していない（Implementation Changes = NONE）。参考として
Working Treeの現状（既存の6ファイル未コミット変更を含む）に対し実行:
```
$ npx tsc -b
（エラーなし、0件）
```
`npm run build` / `npx eslint .`は本Task中は実行していない（tscのみで型検証は十分と判断、
かつ既存の「Known Completed Verification」でBuild/Lintは既に確認済みのため重複実行を省略）。
`git diff --check`は11節参照（クリーン）。

## 11. Git Integrity（最終確認）

```
$ git status --short
（開始時と完全に同一、1節参照）
$ git diff --stat
 src/components/SimulationMode.tsx                  |  12 +-
 src/components/ui/ControlPad.tsx                   |  59 ++-
 .../collision/prosthesisCollisionGeometry.ts       |  13 +-
 src/scenes/SimScene.tsx                            | 455 +++++++++++++++------
 src/scenes/models/ProsthesisModels.tsx             |  19 +-
 src/scenes/transformControlsConfig.ts              |  12 +
 6 files changed, 445 insertions(+), 125 deletions(-)
（開始時と完全に同一）
$ git diff --check
（出力なし）
$ git rev-parse HEAD
871b1c5926dd73d6bf5f823dfe6785f2aabc900a （開始時と同一、変化なし）
```
```
HEAD unchanged   = YES
staged           = none
unintended files = none（本レポート自体のみ新規追加、docs/配下）
temporary files  = none（検証用Node scriptはリポジトリ外のscratchpadに作成・そこで実行、
                          リポジトリには一切コピーしていない）
unrelated mods   = none
Commit           = NONE
Push             = NONE
```

## 12. Remaining Limitations

- **実MeshBVH（実Bone.glb）でのaccept/reject二値結果そのものはNOT REPRODUCIBLE**
  （`document.hidden=true`固定、過去3セッションと同一の既知のsandbox制約）。5節のCategory E判定は
  Proxy幾何の確定的な数値差（実測・二重検証済み）からの幾何学的推論であり、「実際に特定の
  ケースでaccept→reject反転が起きた」ことの直接証拠ではない。
- Rendering側の視覚的影響（Shaftが短く見える等）はScreenshotで未確認（UNKNOWN）。
- Danger Zone / Safety Scoreの再測定は未実施（8節、UNKNOWN）。
- FLAT/PISTON等、BELL以外のfootTypeについても`ProsthesisModels.tsx`側に同種の
  `FLAT_CEILING_Y_MM/2`ハードコードを確認したが（Collision Proxy側は現状BELLのみ対応のため
  該当なし）、本Task範囲（PORP/BELL）外のため深掘りしていない（別途調査が必要な可能性がある
  ことのみ記録）。
- Decision 3のsign（`ANGLE_TILT_SIGN`/`ANGLE_TILT_Z_SIGN`）自体の実機確認は本Taskの範囲外
  （PENDING、変更なし）。

## 13. Finding Summary（Architect判断が必要な事項）

```
Finding:
  buildProsthesisCollisionProxy()（prosthesisCollisionGeometry.ts:167-168）の
  shaftMidY = BELL_HEIGHT_MM / 2 が、R4 Migrationの footOff=0 化に合わせて更新されておらず、
  正しくは shaftMidY = BELL_HEIGHT_MM / 2 + shaftLength / 2 であるべき。
  同一の未更新値が ProsthesisModels.tsx:1889 の shaftY にも存在する（Rendering側）。

Evidence:
  1. 数式的導出（本レポート4節）: footOff=-(len/2)（R1）のときのみ shaftMidY=BELL_HEIGHT_MM/2 が
     正しい。footOff=0（R4）では + shaftLength/2 の項が必要。
  2. Node.js標準スクリプトによるR1/R4並行数値比較（3ファイル・shaftLength、全candidate種別）:
     Foot/Head diff ≈ 1e-16mm（一致）に対し、Shaft Sphere diff = shaftLength/2 mm（1.0〜1.5mm、
     一致していない）。
  3. 実行中のVite dev serverに対するdynamic import経由のLive Runtime実測（document.hidden=true
     環境下でもCanvas非依存のため実行可能だった）: 静的解析と桁レベルで一致。

Impact:
  PORP（BELL/BELL_TOP）のShaft部分5スフィア（Collision Proxy全8要素のうち過半数）が、
  実際の解剖学的位置からshaftLength/2（1.0〜1.5mm、FOOT_CONTACT_TOLERANCE_MM=0.15mmの
  6.7〜10倍）だけ系統的にfoot側へズレた場所でBone Collision判定を行っている。
  False Negative（Shaft-Bone接触の見逃し）・False Positive（Foot直上領域での誤検出）の
  両方向が幾何学的に否定できない。Rendering側も同一の誤りを共有するため、視覚的にも
  Shaftが正しい長さ・位置で描画されていない可能性が高い（未確認）。

Recommended Next Investigation:
  1. 実機（shojiさんの通常ブラウザ）でPORP Placementを表示し、Shaftが視覚的にFoot〜Head間を
     正しく接続しているか（短く縮こまっていないか）を確認する。
  2. Architectの判断のもと、shaftMidY（及びRendering側shaftY）に + shaftLength/2 相当の補正を
     加える小さな修正Taskを別途起票する（本Task自体はこの修正を実施しない、Critical
     Constraints「Collision Engine改変禁止」に従い、Implementation Requiredの判断はArchitectに
     委ねる）。
  3. 修正後、実MeshBVHでのPORP accept/reject回帰確認（本Taskで技術的制約によりNOT REPRODUCIBLE
     だった部分）を実施する。
  4. FLAT/PISTON等、他footTypeのRendering側の同種ハードコード（12節）についても、別途
     R4 Migration適用範囲の確認が必要かArchitectに確認する。
```

## 14. Final Verdict

```
Implementation:
  R4 Geometry Migration（footOff/headOff、Foot/Head Plateの原点移動）
  = COMPLETE（Foot/Head部分に限り、数値・Live Runtimeで正確性を確認済み）

Safety Revalidation:
  = PARTIAL / OPEN

  内訳:
    Foot Anchor（Candidate B含む）      : PASS（Confirmed、静的+Live Runtime実測、diff≈1e-16mm）
    Head Plate OBB                      : PASS（Confirmed、静的+diff≈1e-16mm）
    Shaft Collision Sphere（5/8要素）   : FAIL（Confirmed、shaftLength/2の系統的ズレ、13節Finding）
    Classification Inversion（実MeshBVH）: UNKNOWN（Not Verified、環境制約でNOT REPRODUCIBLE）
    C-2/C-3/C-4 Partial Revalidation    : Shaft findingの影響を受けることを確認（Observed）
    Decision 3補足検証                   : 影響は設計意図通り（Category A′、regressionではない）
    Danger Zone/Safety Score            : UNKNOWN（Not Verified、未再測定）
    Runtime Regression（実機操作）       : UNKNOWN（Not Verified、環境制約）

Observed / Confirmed / Not Verified の区別:
  Observed  : Live Runtime実測値（実際に動いているアプリのモジュールから直接取得、3/4節）
  Confirmed : 上記Observed値がNode.js静的再現と桁レベルで一致したもの（Foot/Head PASS、
              Shaft FAILいずれも該当）——推測ではなく二重に実測・確認された事実
  Not Verified: 実MeshBVHでのaccept/reject二値結果、Rendering視覚確認、Danger Zone/Safety Score
              再測定、実機でのPointer Drag/Keyboard操作（環境制約により今回未達成）

Implementation Required:
  = NOT AUTHORIZED IN THIS TASK（13節のFindingはArchitect判断を経てから着手）

Implementation Changes = NONE
Commit                 = NONE
Push                   = NONE
```

---

## Architect Note

本Taskは「修正Taskを自発的に開始しない」というArchitect Ruleに従い、検証結果とFinding
（13節）の報告のみで終了する。R4 Geometry MigrationのFoot/Head部分は正確性を確認できた一方、
本Taskの過程でShaft Collision Sphere（及び対応するRendering側のShaft Mesh）に、Migrationが
見落とした`shaftLength/2`分のオフセット未更新を発見した。これは「PORP absolute-coordinate
safety」revalidationという本Taskの目的に照らして最も重要な発見であり、次のステップは
Architect判断（13節Recommended Next Investigation）に委ねる。
