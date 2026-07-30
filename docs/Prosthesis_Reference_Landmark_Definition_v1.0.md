# Prosthesis Reference Landmark Definition v1.0

**Status**: Draft(shoji確認待ち)
**Date**: 2026-07-30
**位置づけ**: `docs/Prosthesis_Geometry_Audit_Plan_v1.0.md` Phase G1-1(Head Plate Center)・
G1-2(Contact Point)の監査結果。実コード(`src/scenes/models/ProsthesisModels.tsx`、
`src/data/products.ts`)の確認に基づく。**コード変更は行わない(調査文書)**。P4C-0
(Blocked / Deferred)の判断は変更せず、`composeNormal()`実装には着手しない。

---

## 0. スコープ修正(監査中の発見)

- `footType: 'CLIP'`(`ClipFoot`/`ClipArm`、Dresden Type)は、現行`products.ts`のどの製品
  からも参照されていない未使用コードと判明。実際に使われるFootは`BELL`(porp-ttp-variac)・
  `FLAT`(torp-ttp-variac)・`PISTON`(soft-clip-stapes)の3種のみ。Phase G1-3(TORP/Soft Clip)
  の実質対象は`FlatFoot`と`PistonFoot`。
- `headType: 'BELL_TOP'`は**porp-ttp-variacとtorp-ttp-variacの両方**が使用
  (`products.ts:69`「PORPと同一ヘッドプレート（BELLエキスパンダー一体型）」)。つまり
  Head Plate Geometryの監査対象は実質「BellTop(PORP/TORP共通、全12症例)」と
  「SoftClipHead(全3症例)」の2系統。`FENESTRATED`/`DISC`/`OVAL_RING`/`DOME_4FIN`は
  現行15症例のどの製品からも参照されない代替表示用ジオメトリ。

## 1. G1-1: Head Plate Center

| headType | 使用製品 | 幾何中心の定義 | Evidence |
|---|---|---|---|
| `BELL_TOP` | porp-ttp-variac(全8症例)、torp-ttp-variac(全4症例) | シャフト軸から**意図的にオフセット**: (+0.14, −0.24)(disc-space座標)。「20× caliper confirmed」とコード内に明記(`ProsthesisModels.tsx:301-303`)、かつ「[unchanged]」(既存確認値、変更なし)と注記 | A |
| `SOFT_CLIP` | soft-clip-stapes(全3症例) | `SoftClipStem`/`SoftClipBridge`/`SoftClipWing`×2の複合形状。個々の部品中心・全体としての幾何中心は未確認 | Unknown(要追加確認) |
| `FENESTRATED`/`DISC`/`OVAL_RING`/`DOME_4FIN` | 現行15症例では未使用(代替表示用ジオメトリ) | シャフト軸上(0,0,0)対称、オフセットなし | A(形状の対称構造として自明) |

**最重要発見**: PORP/TORP(全12症例)が使う`BELL_TOP`ヘッドプレートは、シャフト軸上ではなく
(+0.14, −0.24)だけオフセットした位置に幾何中心を持つ。実測に基づく意図的な設計でありバグ
ではないが、**「Head Plate Center = シャフト軸」という単純化した前提は成立しない**。将来の
Reference Geometry定義(Phase G2)・`composeNormal()`実装(P4C再開後)は、このオフセットを
明示的に扱う必要がある。

## 2. G1-2: Contact Point

Anchor Landmark(`base` = `STAPES_HEAD`/`STAPES_FOOTPLATE`、`OssicleModels.ts`)は、
`computeCurrentAxisAlignmentPose()`の構造上(`footOff = -(len/2)`と`mid`の関係)、Foot group
のローカル原点(0,0,0)とworld空間で厳密に一致する。**問題は、このローカル原点が各Footジオ
メトリの「実際に接触する面」と一致しているかがFoot種別ごとに異なる点。**

| footType | 使用製品 | ローカル原点(=Anchor)とジオメトリの関係 | 評価 |
|---|---|---|---|
| `BELL` | porp-ttp-variac | `BellFoot()`のリム(開口部、ローカルY=0)がローカル原点と厳密に一致(`outerProfile`の起点が`(RIM_R, 0)`) | **整合**(カップ形状の開口面がAnchor位置と一致する設計) |
| `FLAT` | torp-ttp-variac | `FlatFoot()`は円柱(高さ0.42mm)がローカル原点を中心に対称配置(position省略=原点固定)。Anchorは円柱の**中央**に位置し、先端(接触面寄り)は原点から±0.21mmずれる | **要確認**(Anchorと視覚的接触面の間に構造的なギャップの可能性) |
| `PISTON` | soft-clip-stapes | `PistonFoot()`の半球ティップ(sphereGeometry、原点中心、θ最大約99°=赤道をわずかに超える範囲)。原点は半球の下端付近に位置 | **ほぼ整合**(ギャップ約0.03mm、BELLほど厳密ではないが実務上小さい) |
| `CLIP` | (未使用) | `ClipFoot()`原点は「シャフト基部の接合カラー」(position `[0,0.05,0]`、高さ0.13)近傍 | 対象外(未使用製品) |

**最重要発見**: `FLAT`(TORP)のみ、Anchor Landmarkとフット形状の視覚的接触面の間に構造的な
ギャップ(円柱高さの半分、約0.21mm)がある可能性がある。`BELL`/`PISTON`は概ね整合している。

## 3. Known Unknowns(次調査)

- `SOFT_CLIP`ヘッドプレート(`SoftClipStem`/`SoftClipBridge`/`SoftClipWing`)の幾何中心定義。
- `FLAT`フットのAnchor⇔接触面ギャップ(約0.21mm相当)が意図的設計(例: 円柱が底板を跨いで
  刺さる構造を表現)か、未検証の誤差かの判断(**shoji確認が必要**)。
- `BELL_TOP`の(+0.14, −0.24)オフセットが、`composeNormal()`実装時のNormal Vector計算
  (Head Plate Local Coordinateとの整合)にどう影響するか。

## 4. Next Step

`FLAT`フットのギャップ(§2)について、意図的設計かどうかをshojiさんに確認する。確認後、
Phase G1-3(TORP/Soft Clip Geometry Auditの残り)またはPhase G2(Reference Geometry定義)
へ進む。

## 5. 参照文書

- `docs/Prosthesis_Geometry_Audit_Plan_v1.0.md`(Phase G1の全体計画)
- `src/scenes/models/ProsthesisModels.tsx`(`BellTop`:289、`BellFoot`:507、`FlatFoot`:609、
  `PistonFoot`:685、`computeProsthesisModelPose`:826、`ProsthesisModel`:848)
- `src/data/products.ts`(headType/footType割り当て)
