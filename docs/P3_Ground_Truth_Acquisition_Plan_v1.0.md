# P3: Ground Truth Acquisition Plan v1.0 (Draft)

**Status**: Draft(P3-0〜P3-4確定・commit 5160d8d・push待ち、P3-5 Measurement Protocol/Data Format/Validation Criteria作成完了・shoji確認待ち)
**位置づけ**: P2(Measurement Definition v1.0、Approved)完了を受け、Layer1-4の変換過程を
記録するための計画。2026-07-29、shojiさんとの確認に基づき作成。コード変更は行わない
(Strangler Pattern、Definition/Plan文書)。

## Project Scope Note(shoji提示、2026-07-29。文書全体の前提のため冒頭に配置)

> The simulator cases are educational scenarios rather than patient-specific reproductions.
> The anatomical model is based on a shared OpenEar ALPHA dataset and is not expected to
> match the dimensions or pathology of any individual case. Consequently, the reference
> values defined in this document represent expert educational references within the scope
> of this project, not patient-specific clinical ground truth.

(日本語訳): 本プロジェクトの症例は実患者の再現ではなく、教育目的のシナリオである。解剖モデルは
共有のOpenEar ALPHAデータセットに基づいており、個々の症例の寸法や病態と一致することは想定
されていない(コード確認: `RealAnatomyModels.tsx`のBone.glb/Auricle.glbコメント「same OpenEar
ALPHA CT」、`cases.ts`に症例別3Dモデル参照は存在しない)。したがって、本書で定義する基準値は、
患者固有のClinical Ground Truthではなく、**本プロジェクトの範囲内における教育的基準値
(Educational Reference)**である。

この前提は、次の3つの疑問に一括して答える: ①なぜ症例と3Dモデルの寸法が厳密には一致しないか
(共有解剖モデルであるため) ②なぜEvidence A+を目指さないか(実患者が存在しないため) ③なぜ
専門家判断が基準になるか(教育シナリオに対する最良の到達可能Evidenceであるため)。

**用語についての注記(今回は名称変更せず、将来の検討事項として記録するに留める)**: 上記の
前提により、本文書がP3-0〜P3-4で用いてきた「Clinical GT」という呼称は、厳密には
「Educational Reference(教育的基準値)」と理解する方が実態に近い。ただし本セッションでは
P3-0〜P3-4の既存記述を大規模に置き換えることはせず(Small Change原則)、P3-5以降の新規記述
でのみこの区別を意識する。呼称自体の統一は将来のP3凍結時またはP4以降の検討事項とする。

**この節は2026-07-29、P3-5作業中に判明した事実をP3-0〜P3-4に遡って適用したものであり、
文書全体(P3-0〜P3-5すべて)に及ぶ前提として扱う(shoji指摘により、P3-5内から文書冒頭へ移設)。**

## P3-0: Existing GT Data Classification

**目的**: `RecommendedLength_Audit_Template_2026-07-23.md`に既に存在する「GT」列を、
P2で確立した4層モデルのどこに位置づけるかを固定する。これを先に固定しないと、P3以降で
GTという語を使うたびにLayerが混同される。

### 既存GT列の定義(確定)

- **Source**: `RecommendedLength_Audit_Template_2026-07-23.md`(OneDriveプロジェクトルート管理)
- **Value meaning**: シミュレータ上でshojiさんが視覚配置した際の`selectedLength`キャプチャ値
  (Three.js placement capture)
- **NOT**: 解剖学的距離の実測値、術中サイザー測定値、CT/死体解剖由来の測定値
- **Evidence level**: Simulation observation(仮説生成用データ)、解剖学的Ground Truthではない

### P2 4層モデルとの対応

既存Audit Templateの「GT」列は、Layer 1(Anatomical Distance)ではなく、
Layer 3(Selected Implant Length)の観測記録であり、Layer 4(Simulation/Implant Geometry
Capture)上で取得された値として扱う。したがって、case-004/case-012で見られた
「recommended(mm)=2.0 vs GT(mm)=3.0」という差異は、Layer1のGround Truthとの乖離ではなく、
**「Layer1情報不足のためLayer3選択理由が説明できていない」という未解決事項**として再分類する。

### 用語の再整理(P3以降、「GT」を単独で使わない)

| 名称 | Layer | 意味 | 出典 |
|---|---|---|---|
| Clinical GT | Layer 1 | 解剖学的距離(TM→Stapes Head/Footplate) | 術中サイザー実測(未取得) |
| Compensation GT | Layer 2 | 軟骨補正厚 | IFU/口頭(Unknown) |
| Selected Length Record | Layer 3 | 実際の選択サイズ = `recommendedLength` | `cases.ts` |
| Geometry Capture | Layer 4 | シミュレータ配置値 = 既存Audit Templateの「GT」列 | `RecommendedLength_Audit_Template_2026-07-23.md` |

**注記**: case-008(recommended=GT=2.5mm、diff=0)を「中間値」「代表値」と表現しないこと。
Audit Template自体にその根拠はない(Evidenceなしの解釈)。P3では単に
「selectedLength検証対象の1例」として扱う。

## P3-1: Purpose

### P3の目的

P3の目的は、recommendedLengthの正誤を判定することではなく、P3-0で確定した4層モデルにおいて
**Clinical GT(Layer 1: 解剖学的距離)からSelected Length Record(Layer 3: 実際の選択サイズ)へ
至る変換過程を、Evidence付きで記録可能にすること**である。

具体的には次の2段階それぞれについて、どのEvidence(実測値/IFU記載/口頭伝聞/推定)に基づくかを
明示できる記録方法を整備する。

1. Layer 1 → Layer 2: 軟骨補正(Compensation)の適用根拠
2. Layer 2 → Layer 3: 補正後の値から実際の選択サイズへの決定過程

Geometry Capture(Layer 4)は、上記の変換過程とは独立した「シミュレータ配置の観測結果」として
扱い、Clinical GTの代替・検証手段としては用いない。

### P3の非目的

以下は本Phaseのスコープ外とする。

1. **recommendedLengthの正誤判定** — P3-0で確認した通り、既存Audit Templateの「GT」列は
   Layer 3の観測記録であり解剖学的Ground Truthではない。「recommended vs GT」の差分自体を
   正誤判定の根拠として扱わない。
2. **Bell Geometry(形状)の修正** — Frozen Layerに該当し、本Phaseの変更対象外。
3. **Pose Solver最適化** — [[pose_design_constraints]]で別途進行中のP4系列の管轄であり、
   P3はその入力となるEvidence整備に留める。
4. **推測によるClinical GTの補完** — 実測値が存在しない場合、[[feedback]]のDefinition文書
   方針(推測を書かずUnknownと明記する方が文書として強くなる)に従い、埋めずにUnknownとして
   記録する。

### P2との接続

P2(Measurement Definition v1.0、Approved)は「何を測るか(Layer1-4の定義・用語)」を固定した
文書である。P3はその4層モデルを、実際にEvidenceを取得・記録するための計画へ展開したものであり、
「どう取得し、どう記録するか」の手順に相当する。

### 後続Phaseとの接続

P3で整備するEvidence記録は、以下の後続作業の入力として想定する(いずれも本Phaseでは実装せず、
将来Phase着手時の参照点として位置づけるのみ)。

- Pose Solver検証([[pose_design_constraints]]P4系列)への入力データ
- 将来的なGeometry(Bell/Head Plate等)の改善検討時の裏付け資料
- Education Layer(症例解説・教育コンテンツ)における出典明示

## P3-2: Ground Truth Definition

### Step1: 現行Simulator対象範囲(`data/cases.ts` / `data/products.ts`確認結果)

症例数15件(case-001〜015、欠番なし)。使用中の`recommendedProductId`は3種類のみ、
`footType`も3種類のみ(BELL/FLAT/PISTON)。

| productId | type | footType | 該当case数 | ossicularStatus.stapes |
|---|---|---|---|---|
| porp-ttp-variac | PORP | BELL | 8件(001,003,004,005,007,008,011,012) | 全件 suprastructure(温存) |
| torp-ttp-variac | TORP | FLAT | 4件(002,006,009,013) | 全件 footplate-only |
| soft-clip-stapes | PISTON | PISTON | 3件(010,014,015) | footplate-only(ただしmalleus/incus intact) |

**Stapedotomyは既にCurrent Scope内**(Future Scope扱いは誤り)。soft-clip-stapesの
`description`に「アブミ骨形成術(Stapedotomy)用ピストン型プロステーシス」と明記されており、
15症例中3件を占める。

### Clinical GT Definition v0.1

| 製品カテゴリ | Clinical GT候補(Layer 1) | Status |
|---|---|---|
| PORP(porp-ttp-variac) | TM(またはツチ骨柄) → Stapes Head | Definition Confirmed(P2で既に採用) |
| TORP(torp-ttp-variac) | TM → Footplate | Definition Confirmed(P2で既に採用) |
| Soft Clip Stapes(soft-clip-stapes、Stapedotomy) | Incus Long Process → Footplate | Pending Clinical Confirmation |

**Soft Clip Stapesの訂正経緯**: 検討開始時点の候補「TM → Footplate/Prosthesis interface」は
PORP/TORP(耳小骨連鎖再建)の発想を混用したものであり、製品構造(`headType: SOFT_CLIP`、
`headPlateDiameter: 1.2mm`、「キヌタ骨長突起に自動固定」)と整合しなかったため撤回した。
該当3症例はいずれもmalleus/incus intact(TORPのfootplate-onlyがmalleus/incus absentなのと
対照的)であり、構造上はTMではなくIncus Long Processが起点になる。

**Confirmed / Pendingの区別根拠**:

| 項目 | 状態 |
|---|---|
| soft-clip-stapesがincus固定型の製品であること | Confirmed(製品定義から) |
| Incus Long Process→Footplateが幾何学的距離として必要であること | Confirmed(構造から) |
| これをClinical GT測定定義として採用すること | Pending Clinical Confirmation |

Pendingとする理由: Simulator構造・製品設計上の接続点は確認できるが、実臨床での術者測定定義・
軟骨補正をどこに含めるか・stapes surgeryでのlength selection workflowはまだEvidenceがなく、
[[feedback]]のUnknown明記方針(推測で埋めない)に従いConfirmedへ格上げしない。

### P3-2で行うこと / 行わないこと

**やる**:
- `cases.ts`上の臨床カテゴリ固定(Step1)
- product → anatomy relationshipの整理
- Clinical GT候補の定義(Confirmed/Pending区分つき)
- Evidence状態管理

**やらない**:
- Stapedotomyの最終測定定義確定
- Soft Clip Stapesのlength calculation確定
- recommendedLengthの正誤評価

## P3-3: Evidence Hierarchy Mapping

### 前提: P3専用Evidence Hierarchy v1.0(新設)

既存の[[feedback]]には性質の異なる2系統のEvidence分類が既に存在する。

1. Geometry Validation用: A+(実物直接計測)/A(画像計測・較正済み)/B(写真観察)/C(推定)
2. 製品・臨床情報記述用: 【KURZ固有情報】/【一般耳科知識】/【要確認事項】

いずれもP3のClinical GT(Layer1: 解剖学的距離)を分類する目的には直接適用できない
(1は3D幾何計測の文脈、2は製品情報記述の文脈であり、Layer1の情報源分類とは軸が異なる)。
2026-07-29、shojiさんとの確認により、両者を統合せずP3専用のEvidence Hierarchy v1.0を新設する
方針とした。

| レベル | 定義 |
|---|---|
| A+ | 術中直接実測(サイザー等による生の解剖学的距離の実測) |
| A | 公式較正済み資料(KURZ IFU等、メーカーが数値として文書化した資料) |
| B | 臨床知識・観察(術者の臨床経験に基づく知識・口頭説明・症例観察) |
| C | 推定・仮説(根拠が明示されない想定値、または構造からの論理的推論) |

**運用原則**: "Official source ≠ Clinical GT evidence"。KURZ公式資料(IFU等)に記載があっても、
それは製品仕様のEvidence(A)であり、個々の症例のLayer1実測値(A+)の代替にはならない。

### 「Confirmed」の意味の切り分け(未解決論点の解消)

P3-2で用いた「Confirmed」は、**Clinical GT Definition(どの2点間を測るかという定義)が
P2文書で確定していること**を指し、**個々の症例でLayer1の実測値(生の距離)が実際に
取得・保存されていることを意味しない**。両者は独立した軸であり、以下のMapping Tableでは
「Definition Status」と「Layer1 Data Availability」を別行として明示する。

`cases.ts`には解剖学的距離の生の実測値を保持する専用フィールドが存在しない(P2 Layer1節で
既確認)ため、**Layer1の実測値自体はPORP/TORP/Soft Clipのいずれの製品カテゴリであっても
全15症例でUnknownである**。これはP2で「定義済み・Confirmed」とした基準点(TM→Stapes Head等)
とは矛盾しない(定義が確定していることと、その定義に基づく実測データが存在することは別問題)。

### Mapping Table

#### PORP(porp-ttp-variac、8症例: 001/003/004/005/007/008/011/012)

| Clinical Item | Evidence Level | Layer | Status | Source | Limitation |
|---|---|---|---|---|---|
| Anchor定義: TM(または軟骨再建面)→Stapes Head | B | Layer1 Definition | Confirmed(Definition) | P2 Measurement Definition v1.0(shoji確認2026-07-29) | 定義の確定であり、Layer1実測値の存在を意味しない |
| Layer1実測値(術中サイザー等の生の解剖学的距離) | (取得なし) | Layer1 Data | Unknown(8/8症例) | `cases.ts`(専用フィールドなし) | 保持フィールド自体が存在しないため参照不能 |
| clinicalNotes記載距離(Layer1相当の参考記述) | C | Clinical Narrative | Pending(未検証)。8症例中「実測(サイザー)」表記3件(004/008/012)、「約(推定)」3件(001/005/007)、記載なし2件(003/011) | `cases.ts` clinicalNotes | 症例設定上の想定値であり、実患者の術中実測を裏付ける証跡ではない。「実測」表記も検証不能 |
| Layer2軟骨補正の適用根拠 | A(範囲)/B(具体例) | Layer1→2変換 | Pending | KURZ IFU(0.3-0.5mm、Evidence A)、shoji口頭(0.2mm、2026-07-29、Evidence B) | 症例別の補正適用は現行コード・データいずれにも実装されていない(P2既述) |
| Selected Length Record(`recommendedLength`) | A(コード内definitionとして一貫) | Layer3 | Confirmed(コード上の値として) | `cases.ts` / P2 v1.0 | Layer1→2→3の導出過程は未記録。正誤判定の根拠にはしない([[p3_purpose]]非目的1) |

#### TORP(torp-ttp-variac、4症例: 002/006/009/013)

| Clinical Item | Evidence Level | Layer | Status | Source | Limitation |
|---|---|---|---|---|---|
| Anchor定義: TM(または軟骨再建面)→Footplate | B | Layer1 Definition | Confirmed(Definition) | P2 Measurement Definition v1.0(shoji確認2026-07-29) | PORPと同様、定義確定はLayer1実測値の存在を意味しない |
| Layer1実測値 | (取得なし) | Layer1 Data | Unknown(4/4症例) | `cases.ts`(専用フィールドなし) | 同上 |
| clinicalNotes記載距離 | C | Clinical Narrative | Pending(未検証)。4症例中「約(推定)」2件(002/013)、記載なし2件(006/009) | `cases.ts` clinicalNotes | 同上 |
| Layer2軟骨補正の適用根拠 | A(範囲)/B(具体例) | Layer1→2変換 | Pending | 同上(PORPと共通のIFU根拠) | 同上 |
| Selected Length Record(`recommendedLength`) | A | Layer3 | Confirmed(コード上の値として) | `cases.ts` / P2 v1.0 | 同上 |

#### Soft Clip Stapes(soft-clip-stapes、Stapedotomy、3症例: 010/014/015)

| Clinical Item | Evidence Level | Layer | Status | Source | Limitation |
|---|---|---|---|---|---|
| Anchor定義: Incus Long Process→Footplate | C(製品構造からの論理的推論) | Layer1 Definition | Pending Clinical Confirmation | P3-2(製品構造根拠、2026-07-29確定) | 幾何構造上の妥当性は確認できるが、実臨床でのstapes surgery測定定義として採用することは未確認 |
| Layer1実測値 | (取得なし) | Layer1 Data | Unknown(3/3症例) | `cases.ts`(専用フィールドなし) | 同上(PORP/TORPと共通の構造的制約) |
| clinicalNotes記載距離 | C | Clinical Narrative | Pending(未検証)。3症例中「約(推定)」2件(014/015)、記載なし1件(010) | `cases.ts` clinicalNotes | 同上 |
| Layer2軟骨補正の適用可否 | (Evidenceなし) | Layer1→2変換 | Unknown | — | Stapedotomyに軟骨補正(TM-Head Plate間グラフト)という前提自体が適用されるか未確認。PORP/TORPの前提をそのまま流用できない |
| Selected Length Record(`recommendedLength`) | A(コード上の値)、ただしGT側Confidence=Low | Layer3 | Confirmed(コード上の値として)、GT取得はConfidence=Low | `cases.ts` / `RecommendedLength_Audit_Template_2026-07-23.md` | 水平軸回転操作の欠如により、GT取得(Simulator上の配置)自体が理想配置を反映していない(Audit Template既知所見、3症例とも共通) |

#### Unknown一覧(製品カテゴリ横断・未解決)

| Clinical Item | Evidence Level | Layer | Status | Source | Limitation |
|---|---|---|---|---|---|
| Layer1実測値を記録するフィールド・プロセスの不在 | — | Layer1 | Unknown | `cases.ts`全15症例 | 術中サイザー実測を記録する専用フィールドが現行システムに存在しない(P3-0で既確認、製品カテゴリに依らず共通) |
| 軟骨グラフト厚0.2mmの由来(症例固有値か一般値か) | B、ただし起源はUnknown | Layer1→2変換 | Unknown | shoji口頭(2026-07-29) | [[feedback]]のDefinition文書方針(推測で埋めない)により、由来確認までUnknownのまま扱う |
| KURZカタログ「Functional Length」とLayer1の関係 | Unknown | 未分類 | Unknown | KURZ製品カタログ | TORPにFunctional Length概念が存在しないという既存所見と、Layer1がPORP/TORP双方に適用される前提が整合しないまま(P2既述、統一を保留) |
| Stapedotomy術式におけるlength selectionワークフロー全体 | Unknown | Layer1〜3 | Pending Clinical Confirmation | — | 実臨床でのstapes surgery測定定義・軟骨補正の要否・length selection手順いずれもEvidence未取得(P3-2既述) |

## P3-4: Case Priority Definition

### 目的

15症例すべてを同一優先度で扱うのではなく、P3-3で確定したDefinition Status(基準点定義の確定度)と
Layer1 Data Availability(実測値の有無)を軸に、Clinical GT Evidence取得(将来のP3-5以降で実施)の
着手順序を決めることが目的である。

**禁止事項(P3-0/P3-1から継続)**: 「recommended−GTの乖離幅が大きいから優先する」という理由は
使わない。乖離幅はLayer3(Selected Length Record)とLayer4(Geometry Capture)の間の観測差に
過ぎず、Layer1(Clinical GT)取得の優先度とは無関係([[p3_purpose]]非目的1、P3-0で既に固定)。

### Axis 1: 臨床カテゴリ別 症例配置(P3-2/P3-3から再掲、変更なし)

| 臨床カテゴリ | 製品 | 症例 | Definition Status |
|---|---|---|---|
| PORP | porp-ttp-variac | 001,003,004,005,007,008,011,012(8件) | Definition Confirmed |
| TORP | torp-ttp-variac | 002,006,009,013(4件) | Definition Confirmed |
| Soft Clip Stapes | soft-clip-stapes | 010,014,015(3件) | Pending Clinical Confirmation |

### Axis 2: Evidence Gap(製品カテゴリ別、P3-3 Mapping Tableの要約)

| 臨床カテゴリ | 既知 | 不足 |
|---|---|---|
| PORP | Anchor定義(TM→Stapes Head、Evidence B) | Layer1実測値(全8症例Unknown)、Layer2軟骨補正の症例別適用根拠 |
| TORP | Anchor定義(TM→Footplate、Evidence B) | Layer1実測値(全4症例Unknown)、Layer2軟骨補正の症例別適用根拠 |
| Soft Clip Stapes | 製品構造(Incus固定、Evidence A/C) | Anchor定義自体のClinical Confirmation、Layer1実測値(全3症例Unknown)、Layer2補正適用可否自体がUnknown |

### Definition Status × Layer1 Data Availabilityマトリクスの限界(先に明示)

2軸で単純にマトリクス化すると、Layer1 Data Availabilityは**全15症例で一律Unknown**
(P3-3既確認)であるため、この2軸だけではConfirmed群(PORP/TORP、12症例)内部の優先順位を
区別できない。したがって、Confirmed群内部の優先度分けには第3の観点として
**既存clinicalNotes記載(Layer1近似のClinical Narrative、Evidence C)の強度**を用いる。
これはLayer1実測値そのものではなく、あくまで「取得時に参照可能な既存の手掛かりの強さ」を
表す観点であり、Evidence C(推定・仮説)の域を出ないことを明記する。

### Priority Tiers

**Priorityの意味(shojiさんレビュー指摘により明記)**: Priorityは臨床的正しさの順位ではなく、Ground Truth Acquisition(Evidence取得)の着手順序を示す。Priority 1の症例が他より「臨床的に正しい」「信頼できる」ことを意味しない。

```
Priority 1: Definition Confirmed かつ Evidence acquisition impact大
            (既存clinicalNotesが「実測(サイザー)/実測」と明記している症例。
             実際にLayer1 Evidenceを取得した場合、この記載自体の信頼性を検証できる)
Priority 2: Definition Confirmed だが Data acquisition未実施
            (既存clinicalNotesが「約(推定)」または記載なしの症例。
             取得の意義はあるが、比較対象となる既存記載が弱い、または無い)
Priority 3: Definition Pending
            (Soft Clip Stapes。Anchor定義自体のClinical Confirmationが先決であり、
             個々の症例のLayer1取得は定義確定後でなければ意味を持たない)
```

### 症例別Priority一覧

| Case | 製品 | Definition Status | Layer1 Data Availability | clinicalNotes記載(Evidence C) | Priority |
|---|---|---|---|---|---|
| case-004 | PORP | Confirmed | Unknown | 実測(サイザー) 2.0mm | 1 |
| case-008 | PORP | Confirmed | Unknown | 実測 2.5mm | 1 |
| case-012 | PORP | Confirmed | Unknown | 実測 2.0mm | 1 |
| case-001 | PORP | Confirmed | Unknown | 約(推定) 2.5mm | 2 |
| case-005 | PORP | Confirmed | Unknown | 約(推定,癒着解除後) 3.0mm | 2 |
| case-007 | PORP | Confirmed | Unknown | 約(推定,成人比やや短い) 2.0mm | 2 |
| case-003 | PORP | Confirmed | Unknown | 記載なし | 2 |
| case-011 | PORP | Confirmed | Unknown | 記載なし | 2 |
| case-002 | TORP | Confirmed | Unknown | 約(推定) 5.0mm | 2 |
| case-013 | TORP | Confirmed | Unknown | 約(推定) 4.5mm | 2 |
| case-006 | TORP | Confirmed | Unknown | 記載なし | 2 |
| case-009 | TORP | Confirmed | Unknown | 記載なし | 2 |
| case-010 | Soft Clip Stapes | Pending Clinical Confirmation | Unknown | 記載なし | 3 |
| case-014 | Soft Clip Stapes | Pending Clinical Confirmation | Unknown | 約(推定) 4.0mm | 3 |
| case-015 | Soft Clip Stapes | Pending Clinical Confirmation | Unknown | 約(推定) 4.25mm | 3 |

**Priority 1(3症例、いずれもPORP)の根拠の再確認**: case-004/008/012はいずれも
`porp-ttp-variac`かつclinicalNotesが「実測(サイザー)」または「実測」と明記する3症例
(P2 Layer3節で既確認)。優先理由は**recommendedLengthとGT(Simulator配置キャプチャ)の
乖離幅ではなく**、既存記載が「実際の術中実測」を主張している点にある。

**重要な訂正(2026-07-29、shoji確認によりP3-5着手前に判明)**: 当初、ここでLayer1 Evidence
(A+相当=術中直接実測)を取得できる前提で記述していたが、これは誤りだった。15症例は**shojiさんが
実際に執刀した患者記録ではなく、教育目的で作成した架空/合成シナリオ**である(2026-07-29確認)。
したがって、これら3症例について「実患者を再測定してA+を得る」という経路は存在しない。
Priority1で本プロジェクト内で実際に到達可能な最大Evidenceは**Evidence B(shojiさんの
専門的臨床判断による確定的な値の付与)であり、Evidence A+ではない**(「Bが上限」という表現は
Evidence階層上BがA+より一般的に優れるという意味ではなく、あくまで本Planの対象データの性質上
到達できる最大値という限定的な意味であることに注意)。P3-3のEvidence Hierarchy定義自体(A+=術中直接
実測)は変更しないが、**本Acquisition Planの対象である15症例に関しては、Layer1でA+に到達する
経路が現時点で存在しないことを明示する**(将来的に側頭骨模型実測等の代替経路が検討される場合は
別途Unknownとして扱う)。波及効果も修正: ①この3症例のclinicalNotes記載(Evidence C)を、
shojiさんの専門的臨床判断(Evidence B)によって確定させることができる ②将来「実測」表記が
付された症例のEvidence C記載を、Evidence Bへ確定させる際の検証手順を確立できる。

**Priority 3(Soft Clip、3症例)の位置づけ**: この3症例はLayer1実測値がUnknownである点は
Priority1/2と同じだが、それ以前にAnchor定義(Incus Long Process→Footplate)自体が
Pending Clinical Confirmationであるため、Layer1取得に着手する前提が整っていない。
P3-4の範囲では「定義確定が先決」と位置づけるに留め、定義確定の具体的手順はP3-5
(Measurement Protocol)以降で検討する。

## P3-5: Measurement Protocol / Data Format / Validation Criteria

### 前提(P3-4からの訂正を反映、文書冒頭のProject Scope Note参照)

文書冒頭の「Project Scope Note」で明記した通り、15症例は教育用の架空/合成シナリオであり、
実患者の再測定によるLayer1 Evidence A+の取得経路は存在しない(上記Priority1節の訂正参照)。
以下のProtocol/Format/Criteriaは、**Evidence B
(shojiさんの専門的臨床判断)を本プロジェクト内で到達可能な最大Evidenceとして設計する**
(「天井」という表現は一般的な優劣を意味しない、上記注記参照)。A+はEvidence Hierarchy定義上
は存在するが、本Planの範囲では「将来、側頭骨模型実測等の代替経路が確立された場合にのみ
到達しうる、現時点ではUnknownの経路」として扱う。

### 1. Measurement Protocol

「誰が確認しても同じ意味になる」ことを目的とし、製品カテゴリ別にAnchorとMeasurementの対応を
固定する。P3-2/P3-3で確定した定義をそのまま踏襲する(新規定義は行わない)。

| 製品カテゴリ | Anchor(Reference→Target) | Measurement | 本プロジェクト内で到達可能な最大Evidence |
|---|---|---|---|
| PORP | TM(または軟骨再建面) → Stapes Head | Clinical GT distance(shojiさんの専門的臨床判断による確定値) | B |
| TORP | TM(または軟骨再建面) → Footplate | Clinical GT distance(同上) | B |
| Soft Clip Stapes | Incus Long Process → Footplate | **Protocol TBDではなく「Clinical workflow confirmation required before protocol definition」** | Anchor定義自体がPending Clinical Confirmationのため測定手順の確定より前の段階 |

**実施順序**: Priority1(case-004/008/012)から着手し、Priority2(残りPORP/TORP計9症例)、
Priority3(Soft Clip)の順(P3-4で確定済み)。

**具体的な取得形式(未確定、次セッションでshojiさんと相談)**: ヒアリング形式(症例ごとに
「この症例なら実際にはどの程度の距離を想定するか」を口頭で確認)か、既存clinicalNotes記載を
shojiさんが直接レビューし確定/修正する形式か、いずれかは未定。

### 2. Data Format

**設計方針(shoji提示、2026-07-29)**: 取得したClinical GT Recordは`recommendedLength`
(Layer3)とは別フィールド・別構造で保持する。理由: 両者を同一フィールドで扱うと、P2で確立した
Layer1〜4分離(recommendedLengthは既にLayer3を表すという結論、P2既述)が再び混同されるため。

**型定義(ドキュメント上の提案。P3はDefinition/Planフェーズのためコード実装はしない
[[project_kurz]]方針、Strangler Pattern)**:

**命名についての訂正(shojiさんレビュー、2026-07-29)**: 当初`ClinicalGroundTruthRecord`と
提案したが、上記Project Scope Noteの前提(実患者ではなく教育シナリオである)を踏まえると
「Clinical」という語は「実患者測定値」を想起させ実態と乖離する。本文書では
`EducationalReferenceRecord`に改める。将来コード実装する段階で改めて命名を検討する余地は
残す(現時点ではドキュメント提案のみのため、この改名も確定ではなく提案の更新)。

```ts
type EducationalReferenceRecord = {
  caseId: string;
  productId: string;

  anchorDefinition: {
    referencePoint: string;   // 例: "TM" | "軟骨再建面"
    targetPoint: string;      // 例: "Stapes Head" | "Footplate" | "Incus Long Process"
  };

  measurement: {
    valueMm: number;
    method: string;           // 例: "clinical-judgment"(shoji専門的臨床判断) | 将来の代替経路名
    operator?: string;
  };

  evidence: {
    level: "A+" | "A" | "B" | "C";
    source: string;
  };

  validationStatus: "confirmed" | "pending";
};
```

**注記**: `evidence.level`は現時点の本Planでは実質的に"B"のみが到達可能(上記前提節参照)。
将来"A+"経路が確立された場合に備え型上は残すが、現状のデータ投入で"A+"を用いることはない。
このフィールド自体、実装はせず設計提案として文書に残すのみ(P3スコープ外)。

### 3. Validation Criteria

Educational Reference(Layer1)からGeometry Capture(Layer4)までの4段階それぞれについて、
確認観点を分離する(混同しないことが目的、[[feedback]]の構造的事実と数値的帰結の分離原則に従う)。

| Layer | Validation観点 | 現状 |
|---|---|---|
| Layer1(Anatomical Distance) | Expert-defined reference validation(専門家判断による基準値が定義(P2/P3-2)通りのAnchorに基づいているかの一貫性確認。実患者の実測検証ではない) | 未着手(P3-5以降で実施) |
| Layer2(Cartilage Compensation) | 補正値の適用根拠が存在するか(IFU 0.3-0.5mm等) | 未実装(P2既述、症例別適用は現状ゼロ) |
| Layer3(Selected Length Record) | `selectedLength`(=`recommendedLength`)がLayer1から説明可能か | Priority1の3症例で検証予定(P3-4) |
| Layer4(Implant Model Geometry) | Geometry表現がLayer3の値と一致するか(Bell Structural Height+Shaft Geometric Length) | P1/P2で確認済み(`shaftLen = len - BELL_HEIGHT_MM`、修正不要) |

**P3-5開始時の注意点(shoji指摘)**: 測定方法を先に決めすぎない。特にSoft Clip(Anchor定義自体
Pending)・Cartilage Compensationの症例別適用根拠(Unknown)・Functional Length概念とLayer1の
関係(Unknown、P2既述)は、Protocol化せずValidation対象としてUnknownのまま保持する。

## 次のステップ

P3-5をshojiさんに確認のうえ、実際のEvidence取得(Priority1の3症例からのヒアリング等)に着手する
か、あるいはP3全体を一区切りとして凍結するかを相談する。
