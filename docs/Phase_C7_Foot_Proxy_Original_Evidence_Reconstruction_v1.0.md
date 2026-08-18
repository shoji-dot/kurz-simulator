# Phase C-7 (継続調査): Foot Proxy Original Evidence Reconstruction v1.0

**Status**: Investigation Complete（Read-only。本文書執筆時点はArchitect Decision待ち
だったが、その後Architectにより`C-7 Proxy Design Decision = DECIDED — OPTION A —
KEEP CURRENT CANDIDATE B`が正式決定された。`docs/Phase_C7_Foot_Proxy_Design_
Decision_v1.0.md`参照）
**Date**: 2026-08-18
**位置付け**:
```
C-7
├─ Foot Proxy Design Requirements Investigation（docs/Phase_C7_Foot_Proxy_Design_Requirements_Investigation_v1.0.md、既存/PUSHED済み、今回無変更）
├─ Cross-Case Validation（docs/Phase_C7_Foot_Proxy_Cross_Case_Validation_v1.0.md、既存/未Commit、今回無変更）
└─ Q1 Follow-up: Original Evidence Reconstruction（本文書）
```
C-8ではなく、C-7の後続Investigationとして扱う。C-6（Malleus/Stapes Collision Expansion）の
予約は変更・上書きしない。

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

C-7 Foot Proxy Design Requirements Investigation（v1、以下「C-7 v1」）が「case-001
Evidence」として引用した数値（`required-radius(rim)≈0.172mm`、`t≈0.19で最小0.012mm`、
Region 1で`gap(t)>0`）が、どのPose / basePos / reference configuration / measurement
conditionから得られたものだったのかをEvidenceベースで特定し、可能であれば再現する。

これはFoot Proxyを修正するTaskではない。

```
NOT: Fix Foot Proxy
YES: Identify the measurement condition behind C-7 v1's case-001 figures,
     and reproduce them if possible.
```

## 2. Scope / Non-scope

**今回のScope**:
- Git history（commit / diff / reflog / dangling objects）からのEvidence Source Trace
- 既存C-5/C-7文書、およびProject Memory（削除済みharnessの唯一の記録）からの測定条件追跡
- 特定できた条件でのRead-only再現Harnessの作成・実行・削除
- Old（旧数値）とCurrent（Clean Baseline）の比較
- Hypothesis→measurement→comparison→conclusionの順序を厳守したSTAPES_FOOTPLATE仮説等の検証

**Non-scope（今回実施していないもの）**:
- Candidate B、Foot Proxy実装、`FOOT_CONTACT_TOLERANCE_MM`、Collision Engine、
  `CollisionResult`、Scoringの変更
- Multi-sphere/Convex hull/Geometry-derived proxy/Region-specific hybrid/Region-aware
  toleranceの設計・実装
- C-2/C-3/C-4/C-5/C-6/C-7 v1の変更（C-7 v1は今回一切変更していない）
- 既存Evidenceの改変・削除。今回の結果に合わせた既存数値の書き換え
- Proxy redesignの要否判断

## 3. C-7 v1 Evidence Under Investigation

`docs/Phase_C7_Foot_Proxy_Design_Requirements_Investigation_v1.0.md` §5が引用した数値
（出典: Project Memory 2026-08-15「Foot Y-axis Fine-Sampling Deep Dive」）:

```
required-radius(t)
  t=0.00 (rim)  : 0.172mm
  t≈0.19        : 0.012mm  ← 最小値
  t=1.00 (apex) : 0.636mm

realOuterRadius(t)
  t=0.00 (rim)  : 0.795mm
  t=1.00 (apex) : 0.000mm

gap(t)
  t≈0.19        : +0.727mm（最大）
  t≈0.80        : 0（交差点）
  t=1.00 (apex) : −0.636mm
```

C-7 Cross-Case Validation（既存、未Commit）は、Clean Baseline Pose（idealAngle/
idealLateralOffset commit、angleTiltZ=0、basePos=STAPES_HEAD——現行コードの正しい
動作）でこれを再現しようとしたが、case-001含む評価可能な全8 caseで、`required-radius
(t=0)`は2.2205〜2.2989mmとなり、上記0.172mmとは一致しなかった。本文書はこの不一致の
原因（＝旧数値の真の測定条件）をEvidenceベースで追跡する。

## 4. Evidence Source Trace

### 4.1 Step 1 — Repository History

```bash
git log --all -p -S "0.012"
git log --all -p -S "required-radius"
git log --all -p -S "requiredRadius"
git rev-list --objects --all | grep -i "tmp-c"
git reflog --all
git fsck --unreachable --no-reflogs
```

結果:
- `-S "0.012"` / `-S "required-radius"` / `-S "requiredRadius"` のいずれも、ヒットするのは
  **C-7 v1文書自身のcommit（`e2bb376`）のみ**。旧数値を生成したscript/harness/commitは
  git履歴上に一切存在しない。
- `tmp-c*`という名前のファイルパスは、全git objects中に一件も存在しない
  （＝該当harnessは一度もgit stage/commitされたことがない）。
- `git reflog --all`は現在のbranch履歴のみを示し、削除されたharnessに関する情報は
  含まれない。
- `git fsck --unreachable`はdangling commit/blob/treeを複数検出したが、内訳は主に
  過去の`git stash`由来のindex/work-tree/untracked-filesスナップショット
  （2026-08-14〜17付近）であった。それぞれの内容を`git ls-tree -r`で確認したところ、
  `tmp`/`harness`/`clearance`/`c5`/`c7`に該当するファイルパスは一件もヒットしなかった
  （詳細は§10）。

**結論（Step 1）**: git履歴には、旧数値を生成したharnessやその出力の痕跡は一切残って
いない。Project Memoryに記載されている「一時harness、測定後削除済み」は文字通り、
一度もgit管理下に入らなかったことを意味する。

### 4.2 Step 2 — Existing C-7 / C-5 Documentation

`docs/Phase_C5_Foot_Collision_Representation_Investigation_v1.0.md`を全文確認したが、
Foot Y-axis Fine-Sampling Deep Dive由来の17点曲線・0.172mm/0.012mm等の生データは
**同文書には一切含まれていない**（C-5文書はこれらをRound 1/2の一般的な結論としてのみ
参照し、細かい数値は記載していない）。したがって、これらの数値の直接的な出典は
**Project Memory（`project_kurz_collision_constraint.md`）のみ**である。

Project Memoryの該当エントリ（2026-08-15付、原文ママ引用）を精査した結果、以下の
測定条件情報を得た:

```
"Collision Attribution investigation 2026-08-15":
  "11 real-device rotation candidates (tiltZ +0.2°→+2.4°, tilt −0.2°→−2.0°
  from baseline tilt=5°/tiltZ=0°, TTP-VARIAC PORP shaftLength=2mm)"
  "Case was TTP-VARIAC PORP, shaftLength 2mm (case-004-equivalent, one of
  the 3 cases used in the STEP3 Ground Truth Investigation)"

"Foot #0/#1 Deep Dive 2026-08-15":
  "the exact real logged sphereCenters+radius from the Candidate-B-round
  ... output (tilt=4.80°/tiltZ=0.20° candidates, both only 0.2° from baseline)"

"Foot Y-axis fine-sampling Deep Dive 2026-08-15":
  同一の実測sphereCenters（tilt=4.80°/tiltZ=0.20°候補）を17点補間して使用。
```

**製品/shaftLength**: TTP-VARIAC PORP、shaftLength=2mmと明記されている。これは
`porp-ttp-variac`製品（`recommendedProductId`が一致するのは全PORP case共通）、
かつ`recommendedLength=2.0`のcase（case-003, 004, 007, 011, 012のいずれか）に限定される。

**Pose（baseline）**: `tilt=5°, tiltZ=0°`と明記されている（STEP1・Collision Attribution
双方で一致）。

**「case-004-equivalent」という表記の解釈**: この語はSTEP3 Ground Truth Investigationの
3canonical test case（shaftLength 2.0/2.5/3.0mm = case-004/001/005）のうち
shaftLength=2.0mmのものを指す、という**shaftLengthのみの参照**であり、case-004自身の
`idealAngle=0°`が使われたことを意味しない（baseline tilt=5°という明記と矛盾するため）。
すなわち、この表記は不正確・紛らわしい記述だったと判断する。

**shaftLength=2.0mm かつ idealAngle=5°の組み合わせ**は、15 Training Cases中
**case-011のみ**が該当する（`src/data/cases.ts`: case-011 = `recommendedLength: 2.0`,
`idealAngle: 5`, `idealLateralOffset: -0.1`）。これはEvidenceとして特定できる、
最も具体的な候補である。

### 4.3 Step 3 — Reflog / Dangling Objects（詳細）

§4.1で言及した dangling commit の内訳（`git show --stat`/`git ls-tree -r`で個別確認）:

| Dangling commit | 種別 | 内容 |
|---|---|---|
| `5041715...` | stash index (Aug17) | 377ファイル、tmp/harness該当なし |
| `cf4128f...` | stash index (Aug14) | ファイルリスト空 |
| `0283050...` | stash index (Aug14) | 377ファイル、tmp/harness該当なし |
| `ec056fa...` | stash WIP (Aug7) | `ProsthesisModels.tsx`のみ、無関係な時期 |
| `00a627e...` | stash WIP (Aug17) | `SimScene.tsx`/`collisionTest.ts`等のsrc差分、tmp harnessではない |
| `97e68f8...` | stash untracked (Aug15) | ファイル0件（空） |

いずれもtmp harnessやその出力を含んでいない。復元・チェックアウトは行っていない
（`git ls-tree`/`git show --stat`のみ、作業treeへの影響なし）。

## 5. Historical Measurement Condition

上記Evidence Traceから、**確認できた**条件と**確認できなかった**条件を分離する。

```
確認できた（Project Memoryに明記）:
  Product        = TTP-VARIAC PORP (porp-ttp-variac)
  shaftLength    = 2.0mm
  baseline tilt  = 5°
  baseline tiltZ = 0°
  candidate tilt/tiltZ (Foot Y-axis Fine-Sampling直接使用分) = 4.80° / 0.20°
  Coordinate pipeline = Phase B適用後（ancestorMatrix = coordGroupRef.matrixWorld、
                         STEP3 Ground Truth Transform確定済み、Memory本文に明記）

確認できなかった（Memoryに明記なし）:
  basePos（STAPES_HEAD か STAPES_FOOTPLATE か）
  idealLateralOffset（もし特定のcaseに基づくなら-0.1〜+0.1のいずれか、
                       もしくは0固定だった可能性）
  厳密なcase識別子（"case-011"等の明示的記載は存在しない）
```

## 6. Reconstruction Method

既存project関数・実データをそのまま再利用（C-7 Cross-Case Validationと同一手法）。
Temporary harness: `scripts/tmp-c7-q1-reconstruction.ts`（esbuildでbundle、Nodeで実行、
調査終了後に削除済み。`src`/`scripts`のtracked fileは無変更）。

再利用した実装/データはC-7 Cross-Case Validation §5と同一（`computeProsthesisModelPose()`、
`coordGroupRef`回転、`anatomyWorldTransform`、実`Bone.glb`、実`MeshBVH`、`BellFoot()`
outerProfile公式の転記）。

**Hypothesis → measurement → comparison → conclusionの順序で、以下を個別に検証した**
（いずれも仮説段階であり、原因と断定しない）:

```
H2a: basePos=STAPES_FOOTPLATE, shaftLen=2.0, offset=0, tilt=5°, tiltZ=0°
H2b: basePos=STAPES_FOOTPLATE, shaftLen=2.0, offset=0, tilt=4.80°, tiltZ=0.20°
     （Foot Y-axis Fine-Sampling Deep Dive が直接使用したcandidate角度）
CONTROL: basePos=STAPES_HEAD, shaftLen=2.0, offset=0, tilt=5°, tiltZ=0°
     （現行コードの正しい動作、比較対象）
H2c: basePos=STAPES_FOOTPLATE, shaftLen=2.0, offset=-0.1（case-011の値）, tilt=5°, tiltZ=0°
H2d: basePos=STAPES_FOOTPLATE, shaftLen=2.5（case-001の値）, offset=-0.2, tilt=5°, tiltZ=0°
```

`STAPES_FOOTPLATE`を仮説として選んだ理由（§4のEvidenceとは独立、C-7 Cross-Case
Validationで得た観測に基づく）: 同文書で`STAPES_FOOTPLATE`（world座標）からBone表面
までの距離を確認したところ0.6519mmであり（`STAPES_HEAD`からの2.2547mmより大幅に
小さい）、これは旧数値の桁数（sub-mm）により近い。

## 7. Old vs Current Comparison

| 項目 | Old（C-7 v1引用値） | CONTROL（Clean Baseline、STAPES_HEAD） | H2a（STAPES_FOOTPLATE, tilt=5, offset=0） |
|---|---|---|---|
| rim (t=0) required-radius | 0.172mm | 2.2195mm | 0.6203mm |
| rim (t=0) gap | +0.623mm (0.795-0.172) | -1.4245mm | +0.1747mm |
| minimum required-radius | 0.012mm | 2.2195mm (t=0で最小) | 0.5323mm (t≈0.44で最小) |
| minimum位置 | t≈0.19 | t=0.00 | t≈0.44 |
| apex (t=1) gap | -0.636mm | -2.5042mm | -0.5907mm |

## 8. Reproduction Result

```
Reconstruction = Partially reproduced（定性的一致、定量的不一致）
```

**定性的に一致した点（basePos=STAPES_FOOTPLATE仮説のみ）**:
- `gap(t=0)`（rim）が**正**になる（H2a: +0.1747、H2b: +0.1707、H2c: +0.2483、
  H2d: +0.3298）——`STAPES_HEAD`（CONTROL、現行コード）では常に負（-1.42mm程度）。
- 最小`required-radius`点が**rim自体ではなく内部の点**にシフトする
  （H2a: t≈0.44、H2b: t≈0.50、H2c: t≈0.375、H2d: t≈0.3125）——`STAPES_HEAD`では
  常にt=0（rim）で最小。旧数値の「t≈0.19で最小」という記述と、"rimそのものではない
  内部点が最小になる"という構造的特徴は一致する。
- apexに向けてgapが負に転じる傾向も、全条件で共通して観測された。

**定量的に一致しなかった点**:
- 旧数値: rim required-radius=0.172mm、最小値=0.012mm、最小位置t≈0.19。
- H2a〜H2d: rim required-radiusは0.46〜0.62mmの範囲、最小値は0.41〜0.53mmの範囲、
  最小位置はt≈0.31〜0.50の範囲——いずれも旧数値より大きく（2〜4倍程度）、最小位置も
  旧数値のt≈0.19よりも apex寄り。
- offset/shaftLengthのいずれの組み合わせ（H2a〜H2d）でも、旧数値と完全一致する条件は
  見つからなかった。

**t≈0.19 / required-radius≈0.012mmの直接再現**: いずれの検証条件でも達成できなかった。

## 9. Hypotheses and Evidence

```
Hypothesis 1（case識別子の誤帰属）
= 棄却（Evidence: §4.2でcase-011を最有力候補として特定したが、C-7 Cross-Case
  Validationで既にcase-011のClean Baseline結果はrequired-radius(t=0)=2.2572mmと
  確認済みであり、basePos=STAPES_HEADである限りcase識別子を変えても旧数値には
  近づかない）

Hypothesis 2（basePos: STAPES_FOOTPLATE vs STAPES_HEAD の不一致）
= 部分的Evidence支持（Confirmed: 符号・構造パターンの一致。Unconfirmed: 数値の
  完全一致）。§8参照。Root Causeとは断定しない。

Hypothesis 3（Ground Truth Transform / Phase Bバージョン差異）
= 棄却の方向（Evidence: Project Memory本文が明示的に「the sphere centers tested
  already flow through the live, Phase-B-corrected ancestorMatrix pipeline (same
  production code path)」と記載しており、当時のPipelineは今回のCONTROL/H2条件と
  同一のはず）

Hypothesis 4（STAPES_HEAD/Bone.glbの資産drift）
= 棄却（Evidence: §4で確認した通り、STAPES_HEAD/STAPES_FOOTPLATE定数は2026-07-22
  以降、Bone.glbは2026-07-21以降、いずれも今日まで変更されていない）

Hypothesis 5（offset/shaftLengthの厳密な組み合わせが未特定）
= 未確認、残存（H2a〜H2dで試した組み合わせ以外の値であれば、より近い一致を
  示す可能性は排除できない。ただし、際限のない組み合わせ探索は今回のTask
  スコープを超えるため実施していない）
```

## 10. Limitations

- 当時の実機コンソールログ（`[C3-P0-1-VERIFY]`等）は調査終了後に削除されており、
  本セッションから直接検証することはできない。これは、当時のProject Memory記述に
  「一時harness…測定後削除済み」と明記されている通りであり、意図的な逸脱ではない。
- Hypothesis 2の検証は、offset/shaftLength/tilt/tiltZの限られた組み合わせのみを
  試した。網羅的な探索（grid search）は行っていない——Evidence-based Investigationの
  範囲を超え、数値を合わせるための恣意的な調整になりかねないため、意図的に打ち切った。
- `basePos=STAPES_FOOTPLATE`がなぜ当時使われた可能性があるのか（コード上の根拠）は
  未特定。現行コード（`SimScene.tsx:1198-1200`）でBELL/`suprastructure`条件では
  `STAPES_HEAD`が正しく選択されるため、これは「当時のコードにバグがあった」
  「当時のharnessが独自にbasePosを誤って設定した」等、複数の説明が考えられるが、
  いずれも確認されていない。

## 11. Implications for C-7 v1

```
C-7 v1（Design Requirements Investigation）文書は、今回一切変更していない。
```

以下は今回のInvestigationがC-7 v1に対して示唆する事項であり、決定ではない:

1. C-7 v1 §4項目3、§5、§6、§10 F2、§11 R2/R3/R4が引用する「case-001 Baseline」数値は、
   Clean Baseline Pose（現行コードの正しいbasePos選択）では再現しない。今回、
   `basePos=STAPES_FOOTPLATE`という条件が定性的に近い挙動（rim付近でgap(t)>0、
   最小点がrim以外にシフト）を示すことが確認されたが、これが当時の実際の測定条件
   だったと確定するものではない。
2. したがって、C-7 v1のRegion 1 constraint関連の記述は、「Clean Baseline Poseでは
   未確認」「特定・未確認のPose条件（basePos=STAPES_FOOTPLATE近傍の可能性）で
   観測された」という限定付きのEvidenceとして再解釈される余地がある。
3. C-7 v1自体の訂正・注記追加は、Architectの明示的指示がない限り今回実施しない。

## 12. Open Questions

```
Q1（継続）. basePos=STAPES_FOOTPLATE条件下で、旧数値（0.172mm/0.012mm/t≈0.19）に
    数値的に一致する正確なoffset/shaftLength/tilt組み合わせは存在するか？
    → 今回のH2a〜H2dでは未発見。網羅探索は今回のScope外としたため未実施。

Q2（新規）. `basePos=STAPES_FOOTPLATE`が当時のharnessで使われていたとすれば、
    それはコード側のバグだったのか、それとも当時のharness自身が独自に
    （現行のSimScene.tsxのbasePos選択ロジックを経由せず）STAPES_FOOTPLATEを
    ハードコードしていたのか？
    → 未確認。当時のharnessコードが存在しないため検証不能。

Q3（新規）. STAPES_FOOTPLATE以外の未試行条件（例: 別のcoordinate assumption、
    別のFoot軸定義）が、旧数値により近い一致を示す可能性はあるか？
    → 未検証。

Q4（C-7 Cross-Case Validationから継続）. C-7 v1のDesign Findings/Requirements
    （F1/F2/R2/R3/R4）を、本文書の発見を踏まえてどう扱うか？
    → 今回も判断しない。Architect Decision待ち。
```

## 13. Architect Decision Required

```
Option A
basePos=STAPES_FOOTPLATE仮説を「部分的に支持されたが未確定」の状態のまま
Pendingとし、これ以上のGrid Search / 数値一致追求は行わない。

Option B
Q1（網羅的なoffset/shaftLength/tilt組み合わせ探索）を別Task として承認し、
旧数値との完全一致を追求する。

Option C
旧数値自体を「Source Condition Unresolved」（Outcome C相当）として正式に
Unreliable Evidenceに分類し、C-7 v1の該当箇所に注記を追加する
Documentation Task を別途指示する。

Option D
本調査結果を受け、C-7 v1のRegion 1 constraint関連の記述を保留のまま、
Foot Proxyに関するさらなるDesign Decisionへは進まない
（現状のPENDING状態を維持）。

Option E
これ以上のQ1関連調査は行わず、Cross-Case Validation（Pattern A: Clean
Baselineでは全case clear）の方をFoot Proxy設計判断の主要Evidenceとして
採用する。
```

どのOptionを採用するかは、本文書では決定しない。

## 14. Conclusion

C-7 v1が引用した「case-001」の旧数値（`required-radius(rim)≈0.172mm`、
`t≈0.19で最小0.012mm`）について、Git history・既存文書・Project Memoryを順に
追跡した結果、これらの数値を生成した一時harnessやその出力はgit履歴上に一切
残っておらず（Step1-3で確認）、確認できた測定条件は「TTP-VARIAC PORP、
shaftLength=2mm、baseline tilt=5°/tiltZ=0°、candidate tilt=4.80°/tiltZ=0.20°」
のみであった。`basePos`（STAPES_HEAD/STAPES_FOOTPLATE）・厳密なcase識別子・
offset値は特定できなかった。

`basePos=STAPES_FOOTPLATE`という仮説を検証した結果、旧数値と**定性的に一致する
構造**（rim付近でgap(t)>0、最小点がrim自体ではなく内部にシフト）が再現された一方、
**定量的な完全一致**は得られなかった（Reconstruction = Partially reproduced）。
これは有力な手がかりであるが、Root Causeとして確定するものではない。

C-7 v1文書、Candidate B、Foot Proxy実装、Tolerance、Collision Engineのいずれも
今回変更していない。本文書作成時点では`C-7 Proxy Design Decision = PENDING`
のまま、結果をArchitectへ報告して次の判断を待った（その後、Architectにより
`DECIDED — OPTION A — KEEP CURRENT CANDIDATE B`が正式決定された。
`docs/Phase_C7_Foot_Proxy_Design_Decision_v1.0.md`参照）。

---

## 15. 参照

- `docs/Phase_C7_Foot_Proxy_Design_Requirements_Investigation_v1.0.md`（§3〜§10 — 調査対象の旧Evidence引用元）
- `docs/Phase_C7_Foot_Proxy_Cross_Case_Validation_v1.0.md`（§3, §6, §10 — Clean Baselineでの非再現確認、STAPES_FOOTPLATE観測の初出）
- `docs/Phase_C5_Foot_Collision_Representation_Investigation_v1.0.md`（Clean Baseline Pose定義）
- Project Memory `project_kurz_collision_constraint`（2026-08-15、Collision Attribution investigation／Foot #0/#1 Deep Dive／Foot Y-axis Fine-Sampling Deep Dive — 本調査の唯一のEvidence源）
- `src/scenes/models/OssicleModels.tsx`（commit `eb81195`, `5cc709e`, `df52e72` — STAPES_HEAD/UMBO_POS実測補正・basePos選択ロジック拡張の履歴）
- `public/models/Bone.glb`（commit `b16c45d`, `e9c84f2`, `2b440de` — 資産変更履歴、2026-07-21以降無変更）
