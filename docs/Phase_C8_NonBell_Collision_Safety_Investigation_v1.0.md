# Phase C-8（暫定・未確定）: Non-BELL Collision Safety Investigation & Decision v1.0

**Status**: **Investigation Complete / Architect Decision Recorded（OPTION B、DEFERRED）**
**Date**: 2026-08-18

**Phase番号についての注記（重要、C-7の先例に従う）**: `C-1`〜`C-5`は使用済み、`C-6`は
`docs/Phase_C3_Prosthesis_Anatomy_Collision_Constraint_Freeze_v1.0.md` §16にて
Malleus/Stapes Collision Expansion用として既に予約済み、`C-7`はFoot Proxy Design
Decision（`docs/Phase_C7_Foot_Proxy_Design_Decision_v1.0.md`、`DECIDED — OPTION A`）
としてCLOSED済みである。また、C-7派生の複数文書（Cross-Case Validation / Original
Evidence Reconstruction / Historical Condition GridSearch / Evidence Status
Consolidation）はいずれも自らを明示的に「C-8ではなく、C-7の後続」と位置付けており、
`C-8`は本文書執筆時点まで未使用のまま残っている。したがって既存のC-Phase連番規則に
従い、次の未使用連番として**`C-8`（暫定・未確定）**を使用する。本文書はCommit前で
あり、Architectが別番号を指示した場合はいつでも変更可能な暫定ラベルである（C-7と
同一の取り扱い）。旧ファイル名`Phase_[TBD]_NonBell_Collision_Safety_Investigation_
v1.0.md`はこの正式化に伴い本ファイルへ置き換え、内容の意味は変更していない。

**位置付け**: C-Phase（C-1〜C-5, C-7 = CLOSED、C-6 = RESERVED）完了後のPost-C-Phase
Handoffで特定されたCandidate Next Task ①。本文書はEvidence Investigation +
Architect DecisionのDocumentation Finalizationであり、実装Taskではない。Code変更は
一切行っていない（`src`/`scripts` diff = 0行、Investigation時点・本Finalization時点
とも）。C-6（Malleus/Stapes Collision Expansion）とは独立した論点であり、本Task
実施によってC-6を開始・解除しない（`C-6 = RESERVED`のまま）。C-2〜C-7のBaseline
（Candidate B, Foot Proxy, Collision Engine, `CollisionResult`,
`FOOT_CONTACT_TOLERANCE_MM=0.15mm`, Scoring）はすべてUNCHANGEDのまま参照するのみ。

```text
Implementation Fact       = CONFIRMED
Scope Gap                 = CONFIRMED
Concrete Defect Evidence  = NOT ESTABLISHED
Architect Decision        = OPTION B
Implementation            = DEFERRED
Option C                  = DEFERRED / FUTURE EVIDENCE CANDIDATE
C-6                       = RESERVED
```

---

## 1. Investigation Purpose

現行実装では `DRAG_COLLISION_TARGETS = ['bone']` がCollision対象の入り口だが、それ以前に
`buildProsthesisCollisionProxy()` 自体が `footType === 'BELL'` の製品にしかCollision
Proxyを構築しない。この結果、TORP/Soft Clip（Piston）の症例ではPlacement/Rotation
Collision Constraintが常に非動作（無条件許可）になっている。

本Investigationの目的は、この既知の実装事実（Implementation Fact）を根拠付きで確認し、

```text
Implementation Gap ≠ Concrete Defect ≠ Clinical Safety Claim
```

を明確に区別した上で、Evidenceのみに基づき

```text
non-BELL Collision Safety = Concrete Defect Evidenceあり（Option A）
```

なのか、

```text
Known Scope Gap + Evidence insufficient for immediate implementation（Option B/C）
```

なのかを判定し、Architect Decisionとして正式に記録することである。

## 2. Scope

**含む**: `src/data/cases.ts`/`src/data/products.ts`によるcase-prosthesis-footTypeの
静的マッピング、`buildProsthesisCollisionProxy()`/`testCollision()`/
`evaluateDragCandidate()`/`evaluateRotationCandidate()`のCode Path確認（Read-only）、
C-2/C-3/C-5/C-6/C-7既存Documentationとの整合性確認。

**含まない**（§10 Explicit Non-Goalsとして明示済み）: `DRAG_COLLISION_TARGETS`変更、
`buildProsthesisCollisionProxy`変更、Collision Engine変更、`CollisionResult`変更、
Candidate B/Foot Proxy/Tolerance/Scoring変更、C-6 implementation、
FlatFoot/PistonFoot geometry investigation、non-BELL実機検証、Historical Region-1
investigation、C-7 reopening。

**方法**: C-5/C-7で確立したEvidence-based methodology（Current Fact → Evidence →
Finding → Interpretation → Decision）を踏襲する。

## 3. Current Implementation Fact

`DRAG_COLLISION_TARGETS = ['bone']`（`src/scenes/SimScene.tsx:1091`）自体はfootTypeに
依存しない定数であり、対象Anatomyを`'bone'`のみに絞るだけの役割である。footTypeによる
分岐は、これより上流の`buildProsthesisCollisionProxy()`（`src/engine/collision/
prosthesisCollisionGeometry.ts:148-151`）に存在する。呼び出し側
（`evaluateDragCandidate`/`evaluateRotationCandidate`、いずれもPlacement段階の
`DraggableProsthesis`専用）は、`proxy === null`の場合を「未対応製品時は制約なし
（安全側フォールバック）」として`return true`（＝常にCollision-free扱い）にしている。
すなわち、non-BELL症例ではCollision Proxyがそもそも構築されず、`testCollision()`
自体が一度も呼ばれない。

Debug/Test Harness側（`src/scenes/debug/CollisionVerifyOverlay.tsx`）も同一の
`buildProsthesisCollisionProxy()`を呼び、`proxy ? testCollision(...) : null`という
同型のガードを持つ。production経路とdebug harness経路の両方で挙動は一貫している。

`testCollision()`（`src/engine/collision/collisionTest.ts:38-68`）自体はfootTypeや
product情報を一切参照しない、純粋な幾何学的交差判定である。ボトルネックは
`buildProsthesisCollisionProxy()`にnon-BELL用のProxy構築ロジックが存在しないことのみ
であり、Collision Engine自体がnon-BELL poseを原理的に処理できないわけではない。

`src/scenes/models/ProsthesisModels.tsx`にはFLAT/CLIP/PISTON各footTypeのRender
Geometry関数が既に実在する（`FlatFoot()`:1469, `ClipFoot()`:1523, `PistonFoot()`:1587）。
また、FLAT/PISTON footTypeはBELLと異なるPlacement基準点・向きを使う
（`ProsthesisModels.tsx:1753,1759`: `base = STAPES_FOOTPLATE`, `target = UMBO_POS_TORP`
（BELLは`STAPES_HEAD`/`UMBO_POS`））。したがって、仮にnon-BELL用Collision Proxyを
追加する場合、BELLのCandidate Bをそのまま流用できず、footplate基準の新しいGeometry
近似設計が必要になる。

`src/engine/scoring.ts`にはfootTypeへの参照が存在しない（grep該当0件）。Scoringは
footType-agnosticであり、今回のCollision Gapによる変更対象ではない。

`src/scenes/transport/ManipulationLayer.tsx`（Transport/pre-commit phase）には
Collision関連コードが一切存在しない（grep該当0件）。Collision Constraintは常に
Placement段階のみに存在し、これはBELL/non-BELLどちらにも共通の既存境界であって、
non-BELL固有の追加ギャップではない。

## 4. Case Mapping

`src/data/cases.ts`全15 Training Casesと`src/data/products.ts`の対応
（`docs/Phase_C7_Foot_Proxy_Cross_Case_Validation_v1.0.md` §4の既存表と本Investigationで
独立に再導出し、完全一致を確認済み）:

| Case | 製品 | footType | Collision Constraint |
|---|---|---|---|
| case-001 | porp-ttp-variac | BELL | 有効 |
| case-002 | torp-ttp-variac | FLAT | **無効** |
| case-003 | porp-ttp-variac | BELL | 有効 |
| case-004 | porp-ttp-variac | BELL | 有効 |
| case-005 | porp-ttp-variac | BELL | 有効 |
| case-006 | torp-ttp-variac | FLAT | **無効** |
| case-007 | porp-ttp-variac | BELL | 有効 |
| case-008 | porp-ttp-variac | BELL | 有効 |
| case-009 | torp-ttp-variac | FLAT | **無効** |
| case-010 | soft-clip-stapes | PISTON | **無効** |
| case-011 | porp-ttp-variac | BELL | 有効 |
| case-012 | porp-ttp-variac | BELL | 有効 |
| case-013 | torp-ttp-variac | FLAT | **無効** |
| case-014 | soft-clip-stapes | PISTON | **無効** |
| case-015 | soft-clip-stapes | PISTON | **無効** |

```text
BELL      = 8 cases（case-001,003,004,005,007,008,011,012）
non-BELL  = 7 cases（TORP/FLAT 4件: case-002,006,009,013、Soft Clip/PISTON 3件: case-010,014,015）
```

`FootType`型は`'BELL' | 'CLIP' | 'FLAT' | 'FLEXIBAL' | 'PISTON'`の5値を宣言するが、
実在する製品（`kurzProducts`、3件）は`BELL`/`FLAT`/`PISTON`のみを使用する。`CLIP`は
Render Geometryのみ存在し対応製品なし。`FLEXIBAL`は製品・症例・Render Geometryの
いずれも存在しない型定義上の予約値であり、Concrete Defect Assessmentの対象外。

## 5. Direct Code Evidence

以下はいずれもRead-onlyのCode直接確認によるもの（推測・実機テストではない）:

1. `prosthesisCollisionGeometry.ts:148-151`
   ```ts
   if (product.footType !== 'BELL') {
     // Phase 1スコープ外（FLAT/CLIP/PISTON/FLEXIBAL）。Phase C-6以降で拡張。
     return null;
   }
   ```
2. `SimScene.tsx:704-712`（`evaluateDragCandidate`）/ `SimScene.tsx:763-771`
   （`evaluateRotationCandidate`）: `if (!proxy) { return true; }` — 未対応製品時は
   Collision-free扱い。
3. `CollisionVerifyOverlay.tsx`（複数箇所、例: 110-115行, 140-145行, 364-369行,
   575-577行）: `const result = proxy ? testCollision(...) : null;` — production経路と
   同型のガード。
4. `collisionTest.ts:38-68`: `testCollision()`はproxy/index/targets/worldTransformのみを
   引数に取り、footType・product情報を一切参照しない。
5. `ProsthesisModels.tsx:1469,1523,1587,1753,1759,1895-1898`: FLAT/CLIP/PISTONの
   Render Geometry関数、およびFLAT/PISTONがBELLと異なるPlacement基準点
   （`STAPES_FOOTPLATE`/`UMBO_POS_TORP`）を使うことの確認。
6. `scoring.ts`: footType参照0件（grep確認）。
7. `ManipulationLayer.tsx`: Collision関連コード0件（grep確認）。
8. `anatomyCollisionIndex.ts:28`: `AnatomyCollisionKey = 'bone' | 'malleus' | 'stapes'`
   — footplateは独立キーではなくstapes.glbに含まれる前提。

## 6. Existing Evidence Review

- **C-2 Freeze文書 §7**（`docs/Phase_C2_..._Freeze_v1.0.md:168-170`）: 「Collision
  Constraintは`footType === 'BELL'`のみ対応...FLAT/CLIP/PISTON/FLEXIBALは未対応
  （安全側フォールバック）」——本論点は2026-08-14時点で既に開示済みだが、以後C-3〜C-7
  では主題化されず未対応のまま残っていた。
- **C-3 Freeze文書 §10**（`docs/Phase_C3_..._Freeze_v1.0.md:181-199`）: Malleus/Stapes
  Collision対象外の記録とC-6予約。footType Gate（本件）とはコード上・文書上ともに
  別の論点であり、C-3実機Test D（Malleus/Stapes pass-through、BELL症例でのAnatomy
  Target不足）と混同しないこと。
- **C-7 Cross-Case Validation §4**: 15 Training CasesのfootType別評価可能性表
  （本文書§4で独立に再導出・完全一致確認済み）。
- **C-7 Design Decision §8 [5]**（`docs/Phase_C7_Foot_Proxy_Design_Decision_
  v1.0.md:267-268`）: 「non-BELL casesのCollision安全性は、本C-7調査の対象外のまま
  残る」——本Investigationはこの[5]を引き継ぐ形で実施された。
- C-4（Rotation Boundary Verification）・C-5（Foot Collision Representation & Contact
  Semantics）はいずれもBELL/PORP症例のみを対象としており、non-BELLへの言及はない。
- C-2〜C-7いずれの実機/Node検証記録にも、TORP/FlatFoot/Soft Clip（Piston）症例で
  Collision Constraintの有無を実際に検証した記録は存在しない。

## 7. Concrete Defect Assessment

```text
Implementation Gap    = CONFIRMED（footType Gateにより7 non-BELL casesで
                         Collision Constraintが無条件無効）
Concrete Defect        = NOT ESTABLISHED（実際に問題のある貫入が発生したという
                         実機/Node Evidenceは一件も存在しない）
Clinical Safety Claim  = NOT MADE
```

区別を厳密に維持する:

```text
Confirmed:     non-BELL Collision Constraint is not active.
Confirmed:     This constitutes an implementation / scope gap.
Not established: A harmful penetration incident occurred.
Not established: Clinical safety is compromised.
Not established: The current system is clinically unsafe.
```

「Collision Protectionが適用されていない」という実装事実（Implementation Fact）と、
「実際に有害な貫入が発生した」というConcrete Defect Evidenceを混同しない。後者は
本調査でもFinalization時点でも確認されていない。臨床的安全性について肯定・否定
いずれの断定も行わない。

## 8. Scope Gap Assessment

```text
Known Scope Gap:
  対象      = 7 non-BELL cases（TORP/FLAT 4件、Soft Clip/PISTON 3件）
  原因      = buildProsthesisCollisionProxy()のfootType==='BELL'限定ガード
              （prosthesisCollisionGeometry.ts:148-151、Phase C-1からの既存スコープ）
  影響範囲   = Placement Drag Constraint (C-2) / Rotation Collision Constraint (C-3)
              いずれも無効。Scoringは影響を受けない。
  C-6との関係 = 独立（§12参照）
  文書化状況 = C-2 §7で開示済み（2026-08-14）、以後C-3〜C-7で主題化されず継続
```

これは「未完了のTask」ではなく、C-1のPhase 1スコープ決定（「まずPORP BELL」）の
自然な帰結として、当初から意図的にスコープ外とされてきた領域である。

## 9. Architect Decision

```text
Non-BELL Collision Safety Decision
= OPTION B

Known Implementation / Scope Gap
+
No Concrete Defect Evidence established
=
Implementation deferred
```

正式記録:

```text
Current Implementation Fact   = CONFIRMED
Non-BELL Collision Protection = CURRENTLY NOT APPLIED
Concrete Defect Evidence      = NOT ESTABLISHED
Scope Gap                     = CONFIRMED
Implementation Decision       = DEFERRED
Architect Decision            = OPTION B
```

Option A（Concrete Defect Evidence identified → Architect Decision required）は
該当しない。Option Bが正式Decisionとして採用された。

## 10. Option B Rationale

1. **Implementation Gapは明確にConfirmedだが、Concrete Defect Evidenceが存在しない**
   （§7）。Evidenceのない状態で実装（non-BELL Proxy新規設計）に着手することは、
   C-7 §5 Important Reasoning Constraint（「形状差があること自体だけを理由に設計変更
   しない」）と同じ推論規律に反する。
2. **non-BELL対応はC-6より作業規模が大きい可能性が高い**（§3）。FLAT/PISTONは
   BELLと異なるPlacement基準点を使うため、既存Candidate Bの単純な流用ではなく、
   footplate基準の新しいGeometry Design Investigation（C-7同等規模）が前提となる。
   Evidence不在のままこの規模の設計に着手するのは時期尚早である。
3. **Scoringは影響を受けない**（§3, §6）。non-BELL症例で失われるのはCollision
   Constraintという幾何学的ハードブロックのみであり、教育的フィードバック
   （Scoring）自体は機能し続ける。したがって「今すぐ実装しなければ機能全体が
   失われる」という緊急性の根拠がない。
4. **Deferすること自体は可逆的**（C-7 Design Decision §7と同じ論理）。将来、
   §11のOption C的Evidence取得（Geometry-only比較）や実機検証を経て新たな
   Concrete Defect Evidenceが得られれば、いつでも再検討できる。Historical Region-1
   Findingと同様、本Gapも削除せずSecondary/既知事項として記録済みのまま残す。

## 11. Option C Deferred Evidence Candidate

```text
OPTION C = DEFERRED / FUTURE EVIDENCE CANDIDATE
```

将来Option C（追加Evidence取得）を選ぶ場合の具体的候補手段として、以下を記録する
（本Task・本Investigationいずれでも実施していない）:

```text
FlatFoot() / PistonFoot()
  vs
Bone

Geometry-only comparison
（Bone非依存、C-5 §4 / C-7 v1 §4がBellFoot()に対して行ったのと同種の、実形状と
  Bone/Stapes footplate landmarkとの幾何学的比較）
```

これは実機検証を伴わない、Documentation-only Investigationとして実施可能な候補
だが、着手には別途新たなArchitect Decisionが必要である。本文書はこれを提案する
だけで、着手しない。

## 12. Relationship to C-6

```text
C-6 = RESERVED（維持）
```

本Decision（Option B）はC-6の開始・解除を一切伴わない。C-6（Malleus/Stapes Collision
Expansion）はAnatomy Target（`DRAG_COLLISION_TARGETS`への`malleus`/`stapes`追加）の
話であり、footType Gate（本文書の主題、Proxy構築自体の話）とはコード上の別レイヤーで
ある。両方が解決されて初めて「BELL症例でMalleus/Stapesも含めた完全なCollision
Safety」が成立し、footType Gateのみを解決してもMalleus/Stapes pass-through問題は
解消されない（逆も同様）——2つのGapは加算的であり、どちらか一方の解決が他方の代替
にはならない。

```text
Non-BELL Scope Gap ≠ C-6 automatically started
```

Malleus/Stapes Collision Expansionは、本Decisionの自動的な実装結果として扱わない。

## 13. Deferred Items

```text
1. non-BELL Proxy Geometry設計（footplate基準、C-7同等規模のDesign Requirements
   Investigationが必要になる可能性が高い）— 未着手。
2. Option C的Geometry-only比較（§11）— 将来候補として記録のみ、未着手。
3. non-BELL実機Collision validation — 本Task/本Investigationとも明示的にNon-Goal。
4. FLEXIBAL footTypeの扱い — 実体（製品・症例・Render Geometry）が存在しないため
   Concrete Defect Assessmentの対象外のまま。
5. C-6（Malleus/Stapes拡張）— 本Decisionにより変更なし、引き続きRESERVED。
```

## 14. Final Status

```text
Investigation             = COMPLETE
Implementation Gap        = CONFIRMED
Concrete Defect Evidence  = NOT ESTABLISHED
Decision                  = OPTION B
Implementation            = DEFERRED
Option C                  = DEFERRED / FUTURE EVIDENCE CANDIDATE
C-6                       = RESERVED
```

Candidate B・Foot Proxy・Collision Engine・`CollisionResult`・
`FOOT_CONTACT_TOLERANCE_MM`（0.15mm）・Scoring・C-1〜C-7いずれも本文書により変更して
いない（UNCHANGED）。将来この論点を再度取り上げる場合は、§13 Deferred Itemsのうち
最も具体的な次の一手候補（non-BELL Proxy Geometry設計、またはOption C的Evidence
取得）を、新たなArchitect Decisionによって別途Scopeすることを推奨する。

---

## 参照

- `src/engine/collision/prosthesisCollisionGeometry.ts`（§3, §5 — footType Gate、148-151行）
- `src/engine/collision/collisionTest.ts`（§3, §5 — Collision Engine自体のfootType非依存性）
- `src/scenes/SimScene.tsx`（§3, §5 — `evaluateDragCandidate`/`evaluateRotationCandidate`呼び出し）
- `src/scenes/debug/CollisionVerifyOverlay.tsx`（§3, §5 — Debug Harness側の同型ガード）
- `src/scenes/transport/ManipulationLayer.tsx`（§3, §5 — Transport段階にCollisionコード不在）
- `src/scenes/models/ProsthesisModels.tsx`（§3, §5 — FlatFoot/ClipFoot/PistonFootのRender Geometry、Placement基準点の相違）
- `src/engine/scoring.ts`（§3, §5 — footType非依存の確認）
- `src/engine/collision/anatomyCollisionIndex.ts`（§5 — AnatomyCollisionKeyの範囲確認）
- `src/data/cases.ts` / `src/data/products.ts`（§4 — Case/Prosthesis/footTypeマッピング）
- `docs/Phase_C2_Prosthesis_Anatomy_Collision_Constraint_Freeze_v1.0.md`（§6 — §7既存開示）
- `docs/Phase_C3_Prosthesis_Anatomy_Collision_Constraint_Freeze_v1.0.md`（§6, §12 — §10 C-6 Scope予約）
- `docs/Phase_C7_Foot_Proxy_Cross_Case_Validation_v1.0.md`（§4, §6 — 既存Case評価可能性表）
- `docs/Phase_C7_Foot_Proxy_Design_Decision_v1.0.md`（§6, §10 — Remaining Evidence Gap [5]、Option判断の推論規律）
