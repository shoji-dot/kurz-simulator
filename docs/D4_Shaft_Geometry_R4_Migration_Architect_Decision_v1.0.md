# D-4 R4 Geometry Migration — Shaft Geometry Finding: Architect Decision

Status: Investigation Only — 実装なし・Commitなし・Pushなし

D-4 R4 Geometry Migrationの Safety Revalidation（`docs/D4_R4_Geometry_Migration_PORP_Safety_
Revalidation_v1.0.md`）で発見された、`shaftMidY`/`shaftY`のR1 origin依存という Finding について、
追加調査を行いArchitect Decisionを提示する。**このTaskでは実装を行っていない。**

## 1. Existing D-4 Documentation Reviewed

- `docs/D4_R4_Geometry_Migration_PORP_Safety_Revalidation_v1.0.md`（本Findingの初出）: 5節に
  同一Findingの初期記述あり。今回はこれを前提に、根本原因・正しい式・全consumer・全球の数値を
  網羅的に確定する。
- `docs/P2_Measurement_Definition_v1.0.md`（**Migrationより前から存在する、既存確定Ground
  Truth文書**）: 85-96行に決定的な既存定義を発見した。
  ```
  selectedLength(base→top)
    = Bell Structural Height（anchor〜Bell apex、BELL_HEIGHT_MM=1.095mm、Geometry Component）
    + Shaft Geometric Length（Bell apex〜Head Plate側、shaftLen = len - BELL_HEIGHT_MM、Geometry Component）
  ```
  この文書は「anchor」を基準としたBell構造の意味論を、D-4 R4 Migrationとは無関係にP1
  （2026-07-29、shoji確認）の時点で既に確定していた。R4の`footOff=0`は、この「anchor」を
  Group Originとして literal に採用したもの——つまり今回のFindingは新しい意味論の発明ではなく、
  **既存のanchor基準定義をR4座標系へ正しく適用しきれていなかった、という適用漏れ**である。
- `docs/Phase_C5_Foot_Collision_Representation_Investigation_v1.0.md`（42-48行）: `BellFoot()`の
  ローカルY規約（`0=rim/底面 〜 1.095=apex/頂点`）を確認。`ProsthesisModels.tsx`本体
  （1316行、`BELL_HEIGHT_MM`定義コメント）とも一致。
- `git show ef1bc0e`（`prosthesisCollisionGeometry.ts`の初回コミット、Phase C-1、D-4より
  大幅に前）: `footOff = -(len / 2)`と`shaftMidY = BELL_HEIGHT_MM / 2`が**同一コミットで同時に
  導入**されており、後者は前者（R1固有の値）に対してのみ数式的に成立する値だったことを確認した
  （2節で導出）。導入時のコメントに`footOff`からの導出式は書かれておらず、単なる決め打ち数値
  として書かれていた。
- 既存のSafety Revalidationレポート（前述）に、8球個別の数値・複数shaftLength・回転candidateでの
  再現は含まれていなかったため、これらは今回新規に実施した（7/11節）。

## 2. Consumer Scope（Repo-wide、`shaftMidY`/`shaftY`/`BELL_HEIGHT_MM`/`shaftStartY`）

`grep -rn "shaftMidY|shaftY\b|BELL_HEIGHT_MM|shaftStartY" src/`の結果、**4箇所**でR1由来の
`BELL_HEIGHT_MM / 2`ハードコードを確認した（2ファイルだけではない）:

| # | ファイル:行 | 用途 | Active/Debug | R4 Migration適用状況 |
|---|---|---|---|---|
| 1 | `src/engine/collision/prosthesisCollisionGeometry.ts:168`（`shaftMidY`） | Collision Proxy（5 shaft spheres） | **常時Active**（footOff/headOffはMigration済み） | footOff/headOffのみ移行、`shaftMidY`未移行 |
| 2 | `src/scenes/models/ProsthesisModels.tsx:1889`（`shaftY`） | Rendering（可視Shaftメッシュ、BELL分岐） | **常時Active**（footOff/headOffはMigration済み） | 同上 |
| 3 | `src/scenes/debug/PoseComparisonOverlay.tsx:49`（`shaftY`） | Debug専用Ghost（P4B-3 Pose比較、`PosedProsthesisGhost`） | `?debug=coords && footType==='BELL'`時のみ描画 | **footOff/headOff自体も含め完全に未移行**（48-51行、`headOff=len/2+0.15`/`footOff=-(len/2)`をそのまま独自複製、ファイル自身のdocstring 27-29行が「本体と同じオフセットを使う」と明記） |
| 4 | `src/scenes/SimScene.tsx:1848-1892`（`bellMarkers`、`BellDebugMarkers`/`BellDirectionCandidates`が消費） | Debug専用マーカー（Bell構造デバッグ、2026-07-23導入） | `?debug=coords && footType==='BELL'`時のみ描画 | **Pose計算自体（`mid`）・`footOff = -(selectedLength/2)`（1870行）ともに完全に未移行**（`resolveCanonicalPose()`を呼ばず、独立にR1式を再実装している） |

`ProsthesisModels.tsx:1886-1891`は`isFlat`分岐（`FLAT_CEILING_Y_MM/2`）も同一パターンで
ハードコードされているが、**Collision Proxy側（`buildProsthesisCollisionProxy`）はBELL以外
`return null`でスコープ外**（Phase 1、Architect指示「まずPORP BELL」、148-151行）であるため、
FLAT/PISTONについてはCollision側の対応するズレは存在しない。Rendering側のみ同種の問題が
存在しうるが、**本Task（PORP/BELL）の範囲外**として扱い、深掘りしていない（19節に記録）。

Scoring（`computeScore()`, `useSimStore.ts`）・hit-target
（`ProsthesisModel`の`interactionHitTarget`、`headOff`/`footOff`のみ参照、`shaftY`非参照）は
`shaftMidY`/`shaftY`を一切消費しないことを確認した（Unaffected、15節）。

**結論**: Active（常時描画・Collision判定対象）な#1/#2は「footOff/headOffだけMigrateされ、
shaftMidY/shaftYが取り残された」という**部分的Migration漏れ**。Debug専用の#3/#4は
「Migration自体に一切触れられていない、独立した複製コード」という**別種の、より重い（Pose全体が
古い）未移行**。両者は原因も影響範囲も異なるため、混同せず別々に扱う（Architect指示に基づく
Category分離の原則、[[feedback_architect_workflow]]参照）。

## 3. `shaftMidY`の意味論定義（推測ではなく、Geometry Sourceから確定）

`shaftMidY`とは **「ProsthesisModel群のローカルY軸上で、可視Shaftメッシュ（円柱、Bell apex〜
Head Plate側の区間）の中点を表すY座標」** である（Question中の選択肢では**B. Shaft geometric
midpoint**に該当、A/C/D/Eのいずれでもない）。

根拠:
- `shaftLen = len - BELL_HEIGHT_MM`（`P2_Measurement_Definition_v1.0.md`の「Shaft Geometric
  Length」と一致、95-96行で「修正不要」と既に確認済みの値）——これは常にBell構造分
  （`BELL_HEIGHT_MM`）を除いた、純粋なShaft円柱部分の長さである。
- `shaftMidY`はこの`shaftLen`区間の中点として`shaftStartY = shaftMidY - shaftLen/2`の形で
  逆算されている（両ファイルとも同一パターン）——definitionそのものが「区間の中点」であることを
  コード構造が示している。
- 「A. Bell structural midpoint」ではない: Bell構造自体の中点はFoot球の配置式
  （`footOff + t*BELL_HEIGHT_MM`, t∈{0,0.5,1}）が別途カバーしており、`shaftMidY`とは無関係。
- 「C. Entire shaft collision volume midpoint」ではない: Collision Volume全体（Foot+Shaft+Head）の
  中点という概念はコード中に存在しない（Foot/Shaft/Headは独立した3セクションとしてそれぞれ
  `footOff`/`shaftMidY`/`headOff`を持つ）。
- 「D. Rendering mesh midpoint」ではない: Rendering側の`shaftY`もCollision側の`shaftMidY`も
  **同一の意味論・同一の数式**であり、両者は「Shaft円柱区間の中点」という単一の概念を
  Rendering/Collisionそれぞれで再現しているに過ぎない（意味論はRendering/Collisionで区別されない）。

`BELL_HEIGHT_MM`は「Bell構造（Foot部分）の高さ」（anchorからBell apexまでの距離、Geometry
Landmark、Clinical Definitionには含まれない——`P2_Measurement_Definition_v1.0.md` 98行）であり、
`shaftLength`（=`selectedLength`）は「anchorからHead Plate側までの、Bell構造+Shaft区間を
合わせた全長」である。この2つの定数の意味は独立しており、混同されていない。

## 4. R1 Coordinate Derivation

Group Origin = shaft midpoint（`computeCurrentAxisAlignmentPose()`の`mid = (base+top)/2`）。
`footOff = -(len/2)`, `headOff = len/2 + 0.15`（Group Origin基準ローカルY）。

```
Foot Anchor (= base, R1のGroup Originとは別点) : footOff              = -(len/2)
Bell apex（Shaft/Bell境界）                     : footOff + BELL_HEIGHT_MM = BELL_HEIGHT_MM - len/2
Shaft区間                                       : [BELL_HEIGHT_MM - len/2 , len/2]  （区間長 = len-BELL_HEIGHT_MM = shaftLen、一致）
Shaft区間中点（= shaftMidY、既存コード）         : BELL_HEIGHT_MM / 2   ← len依存項が打ち消し合う
Head top（Head Plate取付点）                    : headOff              = len/2 + 0.15
```

## 5. R4 Coordinate Derivation

Group Origin = Foot Contact Anchor（`resolveCanonicalPose()`の`position = basePos+offsets`、
`footOff = 0`, `headOff = len + 0.15`）。

```
Foot Anchor（= Group Origin自体）        : footOff              = 0
Bell apex（Shaft/Bell境界）              : footOff + BELL_HEIGHT_MM = BELL_HEIGHT_MM
Shaft区間（正しい値）                    : [BELL_HEIGHT_MM , len]              （区間長 = shaftLen、一致）
Shaft区間中点（正しいshaftMidY）         : BELL_HEIGHT_MM + shaftLen/2 = BELL_HEIGHT_MM/2 + shaftLength/2
Shaft区間中点（現在のコード、未修正）    : BELL_HEIGHT_MM / 2                  ← + shaftLength/2 が欠落
Head top（Head Plate取付点）             : headOff              = len + 0.15
```

`shaftLength/2`欠落分は、shaftLength=2/3/4mmでそれぞれ1.0/1.5/2.0mm——本Task 7節の数値検証結果
（1.000e+0 / 1.500e+0 / 2.000e+0mm）と完全一致する。

## 6. Rendering Shaft Analysis（`ProsthesisModels.tsx`）

対象コード（1886-1897行）:
```ts
const shaftLen = isBell ? Math.max(0.01, len - BELL_HEIGHT_MM) : ...
const shaftY   = isBell ? BELL_HEIGHT_MM / 2 : ...
return <mesh position={[0, shaftY, 0]}><cylinderGeometry args={[r, r, shaftLen, 16]} />...
```
この`<mesh>`の親`<group>`は`position={[mid.x,mid.y,mid.z]}`（`mid = pose.position`、R4では
`resolveCanonicalPose()`の出力＝Foot Anchor）。したがって`shaftY`はR4のFoot Anchor基準ローカルY
として解釈される必要があるが、値自体はR1（shaft-midpoint Group Origin）基準のまま——5節の
「現在のコード」行と一致。**R4でrendered shaftが正しい位置に存在するために必要な式は、
5節で導出した`shaftY = BELL_HEIGHT_MM/2 + shaftLength/2`（= `footOff + BELL_HEIGHT_MM +
shaftLen/2`、footOff=0を代入すれば同じ）。** Ad-hocな見た目合わせのoffsetではなく、
`P2_Measurement_Definition_v1.0.md`の既存Bell構造定義から直接導出される値である。

## 7. Collision Shaft Analysis + 8-Sphere数値比較（`prosthesisCollisionGeometry.ts`）

対象コード（167-168, 180-188行）は6節と数式的に同一（`shaftMidY`≡`shaftY`、同じ由来）。

Node.js標準スクリプトによる全8球（Shaft×5 + Foot×3）＋Head Boxの数値比較
（`shaftLength ∈ {2,3,4}mm`、baseline pose、PORP `porp-ttp-variac`、`basePos=STAPES_HEAD`）:

```
sphereIdx | role  | R1 vs 現行(current)コード diff | R1 vs 提案式(proposed) diff
--------- | ----- | ------------------------------- | -----------------------------
0-4       | shaft | shaftLength/2（常に、len=2→1.000mm / len=3→1.500mm / len=4→2.000mm） | ~1e-16mm（浮動小数点誤差のみ）
5-7       | foot  | ~1e-16mm（Migration自体は正しい） | ~1e-16mm
head      | head  | ~1e-16mm（Migration自体は正しい） | ~1e-16mm
```

（全27行の生データはSafety Revalidation時点の検証スクリプト出力を再実行して確認、検証用
スクリプトは実行後削除・Gitに残存しない。5球すべてで`shaftLength/2`が完全に一致する
一定値であることを確認——特定球だけの偶然のズレではなく、shaftMidY一箇所の系統誤差が
5球全部に一律に伝播していることを意味する。）

回転candidate（`angleTilt=10°`, `shaftLength=3`）でも、現行式と提案式の最大球間距離は
`1.500mm`（= shaftLength/2、rotation-invariant）——両式は同一のPose（`resolveCanonicalPose()`
出力）を共有するため、footOff/headOffのMigration自体が持ち込む回転依存の誤差（Decision 3由来、
別件）とは独立して、常に一定のtranslational offsetとして現れる。

## 8. Rendering / Collision Consistency

RenderingとCollisionは**同一の誤り（`BELL_HEIGHT_MM/2`ハードコード）を共有**しているため、
Candidate（衝突判定対象）と実際に画面表示されるShaft位置は**一致している**（新規の
Candidate≠Renderingという意味での乖離は生じていない、D-4-B Auditが指摘した旧来の問題とは別種）。

ただし本Task指示の通り、「一致しているから正しい」とは判断しない。R4 Anatomical Geometry
（5節、`P2_Measurement_Definition_v1.0.md`由来のGround Truth）に照らすと、**両者とも
shaftLength/2だけ実際の解剖学的位置からズレている**——一致は「両方とも同じだけ間違っている」
ことを意味するに過ぎない。

## 9. Candidate B Impact

**影響なし。** Candidate Bは`CANDIDATE_B_FOOT_SPHERE_RADII_MM`（Foot球3個の半径のみ）と
`footOff + t*BELL_HEIGHT_MM`という配置式（`shaftMidY`を一切参照しない）で構成される。
7節の数値比較で確認した通り、Foot球3個（index 5-7）のR1/R4 diffは常に~1e-16mm——今回の
Shaft Findingの影響を一切受けていない。**Radius・配置式のいずれも変更不要**（Task指示
「radius = unchanged」の原則を維持できる）。

## 10. Foot Contact Tolerance Impact

**影響なし。** `collisionTest.ts:50-57`を確認したところ、`footContactToleranceMm`による
深度考慮判定（`closestPointToPoint`+許容貫入深度）は`role==='foot'`の球にのみ適用され、
`role==='shaft'`/Head Boxは常に従来通りの二値`intersectsSphere`/`intersectsBox`判定である
（コード上明示、`if (s.role === 'foot' && ...)`の分岐）。**Shaft Sphereの位置ズレという
今回のFindingと、`FOOT_CONTACT_TOLERANCE_MM=0.15`は完全に独立した仕組み**であり、
混同していない。`FOOT_CONTACT_TOLERANCE_MM`自体も変更不要。

## 11. Numeric Reproduction Summary

`shaftLength ∈ {2,3,4}mm`について、R1 / R4-現行 / R4-提案の3状態でLocal-Y landmark
（Foot Anchor, Bell apex, shaftMidY, shaftStartY, shaftEndY, headOff）を導出し、World-space
8球+Head Boxの座標を比較した（7節）。R4-提案式はすべてのshaftLength・全8球+Headについて
R1と~1e-16mm（浮動小数点誤差のみ）で一致することを確認した——**R1の安全性キャリブレーション
（Candidate B含む、既存Collision Constraint挙動全体）を、R4座標系上でtranslation-invariantに
完全再現する式であることが数値的に証明された。**

## 12. Live Application Verification

既存のVite dev server（このセッションが起動したものではなく、既に稼働中だったプロセス。
`.claude/launch.json`の`url`属性経由でBrowser paneから接続、起動も停止もしていない）に対し、
Browser paneの`javascript_tool`から`await import('/src/engine/collision/
prosthesisCollisionGeometry.ts')`等のdynamic importで**実際に動いているモジュールインスタンス**の
`buildProsthesisCollisionProxy()`を直接呼び出した（Canvas/React Three Fiber lifecycleに依存しない
ため、既知の`document.hidden=true`制約下でも問題なく動作した）。

```js
// shaftLength=3、PORP porp-ttp-variac、basePos=STAPES_HEAD、baseline（全offset=0）
// 実際に稼働中のアプリから直接取得した5 shaft sphere centers:
[-0.3840, -0.1758, 3.6864]
[-0.7849, -0.0012, 3.4977]
[-1.1858,  0.1734, 3.3090]
[-1.5867,  0.3480, 3.1203]
[-1.9876,  0.5226, 2.9315]
```
Node.js standalone script（現行コード再現）の同一条件での出力と**桁レベルで完全一致**した
（shaftLength=2でも別途確認済み、前回Safety Revalidation参照）。**source-derived calculation
とlive running applicationの一致を確認した**——本Findingは静的コード読解だけでなく、
実際に稼働しているアプリケーションのコードに対しても確定した事実である。

## 13. Root Cause

`shaftMidY`（Collision Proxy側）・`shaftY`（Rendering側）は、Phase C-1（`git show ef1bc0e`、
D-4より大幅に前）の時点で`footOff = -(len/2)`（R1）と**同時に**導入された。当時の値
`BELL_HEIGHT_MM/2`は、3節で示した通り「Shaft区間の中点」という一般式
（`footOff + BELL_HEIGHT_MM + shaftLen/2`）に`footOff=-(len/2)`を代入した結果、len依存項が
偶然打ち消し合って得られる特殊値であり、**`footOff`から独立した定数として決め打ちされていた**
（導出過程はコード上に残されていなかった）。

今回のR4 Migration（`footOff`を`-(len/2)`から`0`へ変更）は、`footOff`/`headOff`という
**名前を持つ変数**は正しく更新したが、`shaftMidY`/`shaftY`という**footOffに依存するにもかかわらず
footOffを直接参照していなかった値**の更新が漏れた。これは「変数名で検索すれば見つかる」種類の
見落としではなく、「数式的にfootOffへ依存しているのに、コード上はfootOffを一切参照していない」
という、より発見しづらい種類のMigration漏れである。

## 14. Correct R4 Formula（数学的正当性）

```
shaftMidY = footOff + BELL_HEIGHT_MM + shaftLen / 2
          = footOff + BELL_HEIGHT_MM + (shaftLength - BELL_HEIGHT_MM) / 2
          = footOff + BELL_HEIGHT_MM / 2 + shaftLength / 2
```
R4では`footOff = 0`のため、上式は`BELL_HEIGHT_MM / 2 + shaftLength / 2`に簡約できる。

**Why mathematically correct**:
1. `P2_Measurement_Definition_v1.0.md`（Migrationと無関係に既存確定済みのGround Truth文書）が
   「Bell Structural Height = anchor〜Bell apex = BELL_HEIGHT_MM」「Shaft Geometric Length =
   Bell apex〜Head Plate側 = shaftLen」と定義している。Bell apexは`footOff`（anchor）から
   `BELL_HEIGHT_MM`だけ離れた点であり、これは`BellFoot()`自身のローカルY規約（`0=rim`〜
   `BELL_HEIGHT_MM=apex`、Phase_C5調査確認済み）とも一致する。
2. Shaft区間はBell apexからHead Plate側まで、長さ`shaftLen`——その中点は
   `apex + shaftLen/2 = footOff + BELL_HEIGHT_MM + shaftLen/2`。
3. 11節の数値検証で、この式がR1のWorld座標（Candidate B含む既存Collision Constraint
   キャリブレーションの前提となっている座標系）を全shaftLength・全8球+Headについて
   ~1e-16mmの精度で再現することを確認した——単なる数式的な妥当性だけでなく、**既存の安全性
   キャリブレーションとの整合性**という観点でも正しさが実証されている。
4. `footOff`を明示的な項として含む一般形（`footOff + BELL_HEIGHT_MM + shaftLen/2`）で書くことで、
   Group Origin semanticsが将来再び変わった場合にも自動的に追従できる、Migration-safeな表現に
   なる（`footOff`という「名前のある変数」への依存が可視化されるため、次回同種のMigrationで
   見落とされるリスクが下がる）。現状の`BELL_HEIGHT_MM/2 + shaftLength/2`という定数式のままでも
   R4では数値的に等価だが、**式の意味論をfootOffから独立させないほうが保守性の観点で望ましい**
   ——これはCase Bに追加する提案であり、Case C（意味論の再定義）を要求するものではない。

## 15. Affected Files / Unaffected Files

**Affected（footOff Migrationとの整合性が崩れている、修正候補）:**
```
src/engine/collision/prosthesisCollisionGeometry.ts:168   (shaftMidY, Active/Collision)
src/scenes/models/ProsthesisModels.tsx:1889                (shaftY,   Active/Rendering)
src/scenes/debug/PoseComparisonOverlay.tsx:48-51            (shaftY + footOff/headOff全体, Debug-only)
src/scenes/SimScene.tsx:1848-1892 (bellMarkers)              (Pose全体 + footOff, Debug-only)
```

**Unaffected（今回のFindingの影響を受けない、確認済み）:**
```
Candidate B（CANDIDATE_B_FOOT_SPHERE_RADII_MM、Foot球配置式）  ── 9節
FOOT_CONTACT_TOLERANCE_MM / collisionTest.tsのtolerance分岐    ── 10節
resolveCanonicalPose()（canonicalPose.ts、Position/Quaternion計算そのもの）── shaftMidYを一切参照しない
Danger Zone / Safety Score（useSimStore.ts computeScore()）    ── PlacementStateの抽象値から計算、
                                                                     Collision Proxy形状を直接参照しない
Head Plate OBB（headOff、両ファイルとも既にMigration済みで正しい）
Foot Sphere（footOff、両ファイルとも既にMigration済みで正しい）
C-track Collision Engine構造（testCollision/MeshBVH呼び出し自体）
```

## 16. Architect Decision

```
Current behavior:
  shaftMidY (collision) / shaftY (rendering) = BELL_HEIGHT_MM / 2 （固定値、footOff非依存）
  footOff/headOffはR4へMigrate済みだが、shaftMidY/shaftYは旧R1前提のまま据え置かれている。

Root cause:
  shaftMidY/shaftYは、導入時（Phase C-1、D-4より前）にfootOffへの依存関係を式として持たず、
  footOff=-(len/2)前提で偶然成立する定数として決め打ちされていた（13節）。R4 MigrationはfootOff/
  headOffという変数名を持つ値のみ更新し、この暗黙の依存関係を持つ値の更新を見落とした。

R1 semantics:
  Group Origin = shaft midpoint。shaftMidY = BELL_HEIGHT_MM/2 はこの原点に対して正しい
  （4節）。

R4 semantics:
  Group Origin = Foot Contact Anchor。正しいshaftMidYはBELL_HEIGHT_MM/2 + shaftLength/2
  （footOff + BELL_HEIGHT_MM + shaftLen/2 の footOff=0代入形、5節・14節）。

Correct formula:
  shaftMidY = footOff + BELL_HEIGHT_MM + shaftLen / 2
  （R4では footOff=0 のため BELL_HEIGHT_MM/2 + shaftLength/2 に簡約可能。14節に数学的正当性の
  完全な導出を記載。11/12節で数値・Live Runtimeの両方で検証済み。）

Affected consumers:
  prosthesisCollisionGeometry.ts:168（Active/Collision）、ProsthesisModels.tsx:1889
  （Active/Rendering）、PoseComparisonOverlay.tsx:48-51（Debug-only、footOff/headOff含め全面
  未移行）、SimScene.tsx:1848-1892のbellMarkers（Debug-only、Pose計算全体が未移行）。

Unaffected consumers:
  Candidate B、FOOT_CONTACT_TOLERANCE_MM、resolveCanonicalPose()、Danger Zone/Safety Score、
  Head/Foot（headOff/footOff自体）、C-track Collision Engine構造（15節）。

Candidate B impact:
  なし（9節）。Radius・Foot球配置式は変更不要。

Collision tolerance impact:
  なし（10節）。FOOT_CONTACT_TOLERANCE_MMはShaftに適用されない独立した仕組み。

Runtime impact:
  Active 2箇所（Collision Proxy・Rendering）は、修正により5 shaft spheresの位置が
  shaftLength/2（1.0〜2.0mm、shaftLength=2〜4mm）だけ移動する。既存C-2/C-3/C-4のFreeze済み
  Collision Constraint挙動は、Shaft部分に限り「実際の解剖学的位置で正しく判定されるようになる」
  方向に変化する（安全性の観点では改善方向の修正だが、既存の「たまたま許容されていたcandidate」が
  修正後にBlockされる可能性はある——実MeshBVHでの回帰確認が必要、19節）。Debug-only 2箇所は
  修正すれば`?debug=coords`パネルの表示のみに影響し、trainee向け経路には影響しない。

Verification plan（修正実施Task向け、本Task範囲外）:
  1. Architect承認後、Active 2箇所（prosthesisCollisionGeometry.ts / ProsthesisModels.tsx）を
     `shaftMidY = footOff + BELL_HEIGHT_MM + shaftLen / 2`へ最小修正。
  2. Debug-only 2箇所は同一修正か、あるいはArchitect判断で「Debug専用であり実害がない」として
     別Task/低優先度に回すかを別途決定（本Decisionでは範囲外、19節）。
  3. 修正後、本Task 7/11/12節と同じ手法（Node.js標準スクリプト + dynamic importによるLive
     Runtime確認）で、修正後のshaftMidYがR1のWorld座標と~1e-16mmで一致することを再確認する。
  4. 実MeshBVH（実Bone.glb）でのPORP accept/reject回帰確認（既存2セッションでNOT REPRODUCIBLE
     だったCanvas内操作）を、実機（shojiさんの通常ブラウザ）で実施する。
```

## 17. Implementation Status

```
Finding confirmed              = YES（13/14節）
Root cause confirmed           = YES（13節）
Correct R4 formula proven      = YES（14節、数式導出+数値検証+Live Runtime検証の3重確認）
Affected consumer scope        = YES（2/15節、4ファイル特定、Active/Debug-onlyを区別）
Architect Decision             = 本レポート16節として提示（Implementation Requiredの可否は
                                  shojiさん/Architectの最終判断）
Implementation                 = NOT PERFORMED（このTaskでは意図的に未実施、Task指示§Critical
                                  Constraintに従う）
```

## 18. C-2/C-3/C-4 Status

Freeze State自体は変更していない。前回Safety Revalidationの「Partial Revalidation」記録
（[[project_kurz_d_track_case_ux]]参照）を維持する。C-2/C-3/C-4いずれも`shaftMidY`ズレの
影響を受けることを2/7節で再確認したが、Collision Engine自体・Freeze State・Tolerance定数は
一切変更していない。

## 19. Remaining Open Items

- **Debug-only consumer（#3/#4）の扱いはArchitect判断待ち。** `PoseComparisonOverlay.tsx`/
  `bellMarkers`はfootOff/headOff自体を含め全面的にR1のまま——Active 2箇所と同じ`+shaftLength/2`
  修正だけでは`PoseComparisonOverlay`の`headOff`/`footOff`自体（48-51行）は直らない
  （これらは元々R1式を丸ごと複製している）。Debug専用ツールの正確性をどこまで維持すべきかは
  Architect判断が必要（優先度は低いと考えられるが、本Decisionでは範囲外として保留する）。
- **実MeshBVHでのaccept/reject回帰確認は本Task・前回Taskいずれでも未実施**（環境制約、
  16節Verification plan §4）。修正実施後にshojiさんの実機で確認が必要。
- FLAT/PISTON footTypeのRendering側`FLAT_CEILING_Y_MM/2`類似ハードコード（2節）は、Collision
  Proxy側が現状BELL専用（Phase 1スコープ）のため対応するCollision側の問題は存在しないが、
  Rendering側の妥当性は未調査（本Task範囲外、PORP/BELLのみ）。

## 20. Git Integrity

```
$ git status --short
（前回Safety Revalidation終了時と完全に同一。追加は本レポート自体のみ、docs/配下）
$ git diff --stat
（前回と同一、6ファイル・445 insertions/125 deletions、本Task中不変）
$ git diff --check
（出力なし）
$ git rev-parse HEAD
871b1c5926dd73d6bf5f823dfe6785f2aabc900a （不変）
```
```
HEAD unchanged   = YES
staged           = none
unintended files = none（本レポートのみ新規追加）
temporary files  = none（検証用Node scriptはリポジトリ外scratchpadに作成・実行後に削除、
                          `src/`には一切配置していない）
unrelated mods   = none
Commit           = NONE
Push             = NONE
```

---

## Architect Note

本Findingは、footOff/headOffという名前を持つ変数の更新だけでは検出できない種類のMigration漏れ
だった——`shaftMidY`/`shaftY`は`footOff`に対して数式的に依存しているにもかかわらず、コード上は
`footOff`を一切参照せず、値だけを決め打ちしていたためである。正しい式
`footOff + BELL_HEIGHT_MM + shaftLen/2`は、既存の`P2_Measurement_Definition_v1.0.md`
（Migrationと無関係に既に確定していたGround Truth文書）から直接導出でき、かつR1の
World座標（既存の安全性キャリブレーション全体の前提）を全shaftLength・全8球+Headについて
浮動小数点精度で再現することを数値・Live Runtimeの両方で確認した。次のステップはArchitectの
Implementation可否判断であり、このTaskではその判断を待たずに実装しない。
