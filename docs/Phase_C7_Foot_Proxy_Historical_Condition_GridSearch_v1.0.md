# Phase C-7 (継続調査): Foot Proxy Historical Condition Grid-Search v1.0

**Status**: Investigation Complete（Read-only、Architect Decision待ち）
**Date**: 2026-08-18
**位置付け**:
```
C-7
├─ Foot Proxy Design Requirements Investigation（docs/Phase_C7_Foot_Proxy_Design_Requirements_Investigation_v1.0.md、既存/PUSHED済み、今回無変更）
├─ Cross-Case Validation（docs/Phase_C7_Foot_Proxy_Cross_Case_Validation_v1.0.md、既存/未Commit、今回無変更）
├─ Q1 Follow-up: Original Evidence Reconstruction（docs/Phase_C7_Foot_Proxy_Original_Evidence_Reconstruction_v1.0.md、既存/未Commit、今回無変更）
└─ Q1 Grid-Search Follow-up: Historical Measurement Condition Reconstruction（本文書）
```
C-8ではなく、C-7の後続Investigationとして扱う。C-6の予約は変更・上書きしない。

```
C-7 Proxy Design Decision = PENDING（本文書執筆時点）
```

**Post-Decision Note（2026-08-18追記）**: 本文書執筆時点ではPENDINGであったが、
その後Architectにより`C-7 Proxy Design Decision = DECIDED — OPTION A — KEEP
CURRENT CANDIDATE B`が正式決定された（`docs/Phase_C7_Foot_Proxy_Design_
Decision_v1.0.md`参照、commit `a89432b`）。本文書自体のEvidence・分析内容
（§1〜§14）は変更しない。

---

## 1. Objective

C-7 v1が引用した旧case-001 measurementを生成し得るPose / reference conditionが存在するかを、
Evidence-based parameter searchによって確認する。Foot Proxy redesign、Collision fix、
Tolerance tuningのTaskではない。

**No Target Fitting原則**: 探索対象パラメータは、Memory / 既存文書 / repository historyから
合理的に導出できる候補に限定し、旧数値（`t≈0.19`、`required-radius≈0.012mm`）に一致する
まで値を調整することは行わない。各parameter・各候補値の根拠は§3で個別に明記する。

## 2. Scope / Non-scope

**Scope**: §3で定義するEvidence-grounded search space（basePos×rotation×
shaftLength/offset、計16条件）での`realOuterRadius(t)`/`requiredRadius(t)`/`gap(t)`計算、
旧Figuresとの比較、A/B/C分類判定。

**Non-scope**: Candidate B・Foot Proxy実装・`FOOT_CONTACT_TOLERANCE_MM`・Collision Engine・
`CollisionResult`・Scoring・C-2〜C-6・C-7既存文書（Design Requirements / Cross-Case
Validation / Original Evidence Reconstruction）のいずれの変更。範囲を超えた
grid拡張・interpolation・target fitting。

## 3. Search Space and Evidence Basis

**Priority 1 — basePos（2条件）**:

| 値 | 根拠 |
|---|---|
| `STAPES_HEAD` | 現行`case-001`（`stapes:'suprastructure'`）の正規経路（`SimScene.tsx:1198-1200`） |
| `STAPES_FOOTPLATE` | Q1 Follow-up文書で定性的近似を示した候補（未確定、比較対象として維持） |

**Priority 2 — rotation（2条件、Memoryで確認済みの値のみ、範囲拡張なし）**:

| 値 | 根拠 |
|---|---|
| `tilt=5°, tiltZ=0°`（baseline） | Project Memory「Collision Attribution investigation」「STEP 1」明記の`baseline tilt=5°/tiltZ=0°` |
| `tilt=4.80°, tiltZ=0.20°`（candidate） | Project Memory「Foot #0/#1 Deep Dive」「Foot Y-axis Fine-Sampling Deep Dive」が直接使用した実測candidate角度 |

**Priority 3 — (shaftLength, offset) の組（4条件、各値を個別に引用）**:

| 条件 | shaftLength根拠 | offset根拠 |
|---|---|---|
| (2.0, 0.0) | Memory「TTP-VARIAC PORP shaftLength=2mm」明記 | `computeProsthesisModelPose()`関数自体のdefault値（`lateralOffset=0`） |
| (2.0, -0.1) | 同上 | `case-011`の`idealLateralOffset`（shaftLength=2.0 かつ idealAngle=5を満たす唯一のTraining Case、Q1文書§4.2で特定） |
| (2.5, -0.2) | `case-001`の`recommendedLength`（C-7 v1が引用元を「case-001」とラベル付けしているため） | `case-001`自身の`idealLateralOffset` |
| (2.5, 0.0) | 同上 | 関数default（offset変数の影響のみ分離するための対照） |

**Priority 4 — Other parameters**: asset/constant driftは既にQ1 Follow-up文書で否定的
Evidenceを確認済み（STAPES_HEAD/STAPES_FOOTPLATE定数は2026-07-22以降、Bone.glbは
2026-07-21以降無変更）のため、再探索していない。Coordinate transformはPhase-B-corrected
pipeline（`coordGroupRef`回転 + `anatomyWorldTransform`）を維持し、変更していない。

**合計**: 2 (basePos) × 2 (rotation) × 4 (shaftLength/offset) = **16条件**。
offset値の中間補間（例: -0.15）や追加のrotation角度は一切試していない
（Target Fitting回避のため）。

## 4. Measurement Method

C-7 Cross-Case Validation / Q1 Follow-upと同一のmeasurement pipeline
（`computeProsthesisModelPose()`実関数、`coordGroupRef`回転、`anatomyWorldTransform`、
実`Bone.glb`、実`MeshBVH`、`BellFoot()`outerProfile公式の転記）を再利用。

Temporary harness: `scripts/tmp-c7-q1-gridsearch.ts`（esbuildでbundle、Nodeで実行、
調査終了後に削除済み。`src`/`scripts`のtracked fileは無変更）。各条件について17点
（t=0〜1、1/16刻み）の`realOuterRadius(t)`/`requiredRadius(t)`/`gap(t)`を計算し、
最小`requiredRadius`点・rim(t=0)のgap・crossover位置を記録した。

## 5. Per-Condition Results

全16条件（`requiredRadius`の最小値昇順）:

| basePos | rotation | shaftLength/offset | min t | min required-radius | min gap | rim gap | crossover t |
|---|---|---|---|---|---|---|---|
| STAPES_FOOTPLATE | baseline(5,0) | 2.5, -0.2 | 0.3125 | 0.4098mm | +0.2917 | +0.3298 | 0.8128 |
| STAPES_FOOTPLATE | candidate(4.80,0.20) | 2.5, -0.2 | 0.3125 | 0.4135mm | +0.2879 | +0.3247 | 0.8115 |
| STAPES_FOOTPLATE | baseline(5,0) | 2.0, -0.1 | 0.3750 | 0.4751mm | +0.2076 | +0.2483 | 0.7720 |
| STAPES_FOOTPLATE | candidate(4.80,0.20) | 2.0, -0.1 | 0.3750 | 0.4776mm | +0.2052 | +0.2442 | 0.7714 |
| STAPES_FOOTPLATE | baseline(5,0) | 2.5, 0 | 0.4375 | 0.5258mm | +0.1382 | +0.1822 | 0.7446 |
| STAPES_FOOTPLATE | candidate(4.80,0.20) | 2.5, 0 | 0.5000 | 0.5287mm | +0.1166 | +0.1772 | 0.7424 |
| STAPES_FOOTPLATE | baseline(5,0) | 2.0, 0 | 0.4375 | 0.5323mm | +0.1317 | +0.1747 | 0.7347 |
| STAPES_FOOTPLATE | candidate(4.80,0.20) | 2.0, 0 | 0.5000 | 0.5342mm | +0.1111 | +0.1707 | 0.7337 |
| STAPES_HEAD | baseline(5,0) | 2.5, 0 | 0.0000 | 2.2108mm | -1.4158 | -1.4158 | なし |
| STAPES_HEAD | candidate(4.80,0.20) | 2.5, 0 | 0.0000 | 2.2151mm | -1.4201 | -1.4201 | なし |
| STAPES_HEAD | baseline(5,0) | 2.0, 0 | 0.0000 | 2.2195mm | -1.4245 | -1.4245 | なし |
| STAPES_HEAD | candidate(4.80,0.20) | 2.0, 0 | 0.0000 | 2.2230mm | -1.4280 | -1.4280 | なし |
| STAPES_HEAD | baseline(5,0) | 2.0, -0.1 | 0.0000 | 2.2572mm | -1.4622 | -1.4622 | なし |
| STAPES_HEAD | candidate(4.80,0.20) | 2.0, -0.1 | 0.0000 | 2.2604mm | -1.4654 | -1.4654 | なし |
| STAPES_HEAD | baseline(5,0) | 2.5, -0.2 | 0.0000 | 2.2896mm | -1.4946 | -1.4946 | なし |
| STAPES_HEAD | candidate(4.80,0.20) | 2.5, -0.2 | 0.0000 | 2.2935mm | -1.4985 | -1.4985 | なし |

## 6. Comparison with Historical Figures

旧Figures: `rim required-radius=0.172mm`、`minimum=0.012mm at t≈0.19`、
`rim gap=+0.623mm`、`crossover t≈0.80`。

**判定基準（本文書で採用した許容差、旧数値へ合わせるための逆算ではなく、判定のための
事前定義）**: `t≈0.19`は`|Δt|≤0.05`（サンプリング刻み1/16=0.0625の約1刻み以内）、
`required-radius≈0.012mm`は絶対誤差`≤0.05mm`または相対誤差`≤50%`のいずれか緩い方。

| 項目 | 旧Figures | 最良候補（STAPES_FOOTPLATE, baseline, 2.5/-0.2） | 差 |
|---|---|---|---|
| minimum t | ≈0.19 | 0.3125 | Δt=0.12（許容差0.05を超過） |
| minimum required-radius | 0.012mm | 0.4098mm | 約34倍（許容差を大幅に超過） |
| rim gap | +0.623mm | +0.3298mm | 約0.29mm差（同符号だが数値不一致） |
| crossover t | ≈0.80 | 0.8128 | Δt=0.013（許容差内、唯一一致） |

**crossover位置（t≈0.80）のみ、全STAPES_FOOTPLATE条件で許容差内に収まった**
（0.7337〜0.8128の範囲、旧数値0.80とおおむね近い）。minimum t・minimum
required-radius・rim gapはいずれの条件でも許容差を満たさなかった。

## 7. Reproduction Classification

```
A — Strong reproduction: 該当条件なし（0/16）

B — Partial / Qualitative reproduction: 8/16
    （STAPES_FOOTPLATE使用の全8条件——basePos/rotation/shaftLength/offsetの
    いずれの組み合わせでも、Region 1 crossover + interior minimumという
    定性的パターンは一貫して再現された。crossover位置(t≈0.73-0.81)は
    旧数値(t≈0.80)に近い。ただしminimum t・required-radiusの定量一致は
    いずれも得られなかった）

C — No reproduction: 8/16
    （STAPES_HEAD使用の全8条件——rotation/shaftLength/offsetを変えても、
    minimum は常にt=0（rim）、gapは常に負、crossoverは存在しない）
```

**分類の頑健性**: STAPES_FOOTPLATE条件は、rotation（baseline vs candidate）・
shaftLength（2.0 vs 2.5）・offset（0 / -0.1 / -0.2）のいずれを変えても、定性的
パターン（正のrim gap、interior minimum、crossover存在）が一貫して崩れなかった。
これはbasePos（reference point）が定性的形状を左右する支配的な変数であり、
rotation/offset/shaftLengthは（探索した範囲内では）二次的な影響しか持たないことを
示唆する——ただし、これは相関の観測であり、Root Cause特定ではない。

## 8. Best Candidate Condition

```
basePos    = STAPES_FOOTPLATE
rotation   = baseline (tilt=5°, tiltZ=0°)
shaftLength = 2.5mm
offset     = -0.2

minimum t                = 0.3125
minimum required-radius  = 0.4098mm
minimum gap              = +0.2917mm
rim gap                  = +0.3298mm
crossover t              = 0.8128
```

この条件は§3で定義したEvidence-groundedな16条件中、旧Figuresに最も近い
（`required-radius`が最小、`crossover`が旧数値に最も近い）。ただし§6の通り、
定量的な一致基準は満たしていない——**Partial / Qualitative reproductionに留まる**。

## 9. Hypotheses and Evidence

```
Hypothesis（強度: possible contributing factor、Root Causeとは書かない）:
basePos=STAPES_FOOTPLATE（またはそれに類する、STAPES_HEADより
Bone.glbに近いreference point）が、旧Figuresの定性的形状
（正のrim gap・interior minimum・crossover存在）に関与している
可能性がある。

Evidence:
- Priority1で定義した2条件のうち、STAPES_FOOTPLATEのみが
  定性的パターンを示し、STAPES_HEADは一貫して示さない
  （§5, §7、8条件 vs 8条件で完全に分離）。
- この分離は、rotation・shaftLength・offsetのいずれを変えても
  崩れなかった（§7の頑健性）。

Evidenceが不十分な点（Unconfirmed）:
- 旧数値との定量的一致（minimum t・required-radius）が
  得られていない——basePos以外に、未特定の追加要因
  （さらに異なるreference point、Foot軸定義の違い、
  当時のharness固有の実装差異等）が関与している可能性を
  排除できない。
- 「当時、実際にSTAPES_FOOTPLATEが使われていた」という
  直接証拠（当時のログ・コード）は存在しない。
```

**明示**: `Root Cause = STAPES_FOOTPLATE` とは記述しない。`STAPES_FOOTPLATE
= Historical Condition` とも認定しない。あくまで `possible contributing
factor` / `qualitative match` として扱う。

## 10. Limitations

- 探索した16条件は、Memory/既存文書から直接引用できる値のみに限定した
  （§3）。offset/shaftLength/rotationの中間値・追加値は一切試していない
  ——これはTarget Fitting回避のための意図的な制約であり、探索が
  不完全である可能性を残す（§12 Open Questionsに記録）。
- 当時の実機ログ・harnessコードは現存せず、直接検証は不可能
  （Q1 Follow-up文書§10と同一の制約）。
- `crossover t`のみ許容差内で一致したが、これは`realOuterRadius(t)`
  （BellFoot()形状、旧数値と共通）と`requiredRadius(t)`の交差点であり、
  `realOuterRadius(t)`側の寄与が大きい可能性がある——`requiredRadius(t)`
  自体（Bone側）の一致精度は低いままである点に注意。

## 11. Impact on C-7 v1

```
C-7 v1（docs/Phase_C7_Foot_Proxy_Design_Requirements_Investigation_v1.0.md）
は今回変更していない。
```

本調査は、旧Figuresの発生条件について「STAPES_FOOTPLATEが関与している
可能性がある」という、Q1 Follow-up文書より一段強いが依然確定的でない
Evidence（8/8条件で一貫した定性的分離）を追加した。これはC-7 v1の
数値そのものの正確性を保証するものではなく、C-7 v1修正の要否は
今回も判断しない。

## 12. Open Questions

```
Q1（継続）. STAPES_FOOTPLATE以外の、未探索のreference point / Foot軸定義
    条件が、旧Figuresへより近い定量一致を示す可能性はあるか？
    → 今回の16条件Search Spaceの外。Evidence-groundedな新候補が
      提示されない限り、追加探索はTarget Fittingのリスクを伴う。

Q2（継続）. 当時のharnessが、現行の`computeProsthesisModelPose()`と
    数式レベルで完全に同一だったか（例: Foot軸のY-parameterizationの
    定義差）？
    → 当時のコードが現存しないため検証不能。

Q3（新規）. `crossover t≈0.80`のみが一致した理由——`realOuterRadius(t)`
    （BellFoot()形状、当時と現在で不変）の寄与が支配的である可能性は
    あるか？
    → 未検証、Q1/Q3双方とも今回のTaskスコープ外。
```

## 13. Architect Decision Required

```
Option A
basePos=STAPES_FOOTPLATE を "possible contributing factor" として
記録したまま、これ以上のHistorical Condition探索は行わない
（C-7 Proxy Design Decision = PENDING維持）。

Option B
さらなるEvidence-grounded候補（新たに文書化されたPose条件等）が
見つかった場合にのみ、追加のGrid-Search Follow-upを承認する。

Option C
Historical Condition の完全特定を断念し、"Source Condition
Unresolved" として正式にC-7 v1へ注記するDocumentation Taskを
別途指示する。

Option D
Cross-Case Validation（Pattern A: Clean Baselineでは全case clear）を
Foot Proxy設計判断の主要Evidenceとして採用し、旧Figuresの
Historical Condition追跡はこれ以上優先しない。
```

どのOptionを採用するかは、本文書では決定しない。

## 14. Conclusion

Evidence-groundedな16条件（basePos×rotation×shaftLength/offset）の小規模な
Grid-Searchを実施した結果、`basePos=STAPES_FOOTPLATE`を使用した全8条件で、
旧Figuresと定性的に一致するパターン（rim付近での正のgap、interior minimum、
crossover存在）が一貫して再現された一方、`basePos=STAPES_HEAD`（現行の正しい
経路）では8条件すべてで再現されなかった。この分離はrotation/shaftLength/
offsetの選択に対して頑健であった。

しかし、`t≈0.19`・`required-radius≈0.012mm`という定量的な旧数値は、
いずれの条件でも再現されなかった（最良候補でも約34倍の乖離）。したがって、
本調査の結論は**Partial / Qualitative reproduction（Classification B）**であり、
Strong reproduction（Classification A）には至らなかった。`basePos`
（reference point）は旧Figuresの形状に関与している可能性がある要因として
記録するが、Root Causeとして確定しない。

C-7 v1、Candidate B、Foot Proxy実装、Tolerance、Collision Engineのいずれも
今回変更していない。本文書作成時点では`C-7 Proxy Design Decision = PENDING`
のまま、Proxy redesign・Tolerance policy変更のいずれにも進まず、結果を
Architectへ報告して次の判断を待った（その後、Architectにより`DECIDED —
OPTION A — KEEP CURRENT CANDIDATE B`が正式決定された。`docs/Phase_C7_
Foot_Proxy_Design_Decision_v1.0.md`参照）。

---

## 15. 参照

- `docs/Phase_C7_Foot_Proxy_Original_Evidence_Reconstruction_v1.0.md`（§4〜§9 — 本調査のSearch Space根拠の出典）
- `docs/Phase_C7_Foot_Proxy_Design_Requirements_Investigation_v1.0.md`（§5 — 調査対象の旧Evidence引用元、今回も無変更）
- `docs/Phase_C7_Foot_Proxy_Cross_Case_Validation_v1.0.md`（§6 — STAPES_FOOTPLATE観測の初出）
- Project Memory `project_kurz_collision_constraint`（2026-08-15、Collision Attribution investigation／Foot #0/#1 Deep Dive／Foot Y-axis Fine-Sampling Deep Dive）
- `src/data/cases.ts`（case-001, case-011の定義）
