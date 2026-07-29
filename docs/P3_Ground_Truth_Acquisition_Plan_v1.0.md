# P3: Ground Truth Acquisition Plan v1.0 (Draft)

**Status**: Draft(P3-0/P3-1/P3-2/P3-3確定・commit ca7c662・push確認済み、P3-4 Case Priority Definition作成完了・shoji確認待ち、P3-5未着手)
**位置づけ**: P2(Measurement Definition v1.0、Approved)完了を受け、Layer1-4の変換過程を
記録するための計画。2026-07-29、shojiさんとの確認に基づき作成。コード変更は行わない
(Strangler Pattern、Definition/Plan文書)。

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
乖離幅ではなく**、既存記載が「実際の術中実測」を主張している点にある。ここでLayer1
Evidence(A+相当)を取得できれば、①この3症例のclinicalNotes記載の信頼性を検証できる
②将来「実測」表記が付された症例のEvidence C記載を、Evidence A+に格上げする際の
検証手順を確立できる、という2つの波及効果がある。

**Priority 3(Soft Clip、3症例)の位置づけ**: この3症例はLayer1実測値がUnknownである点は
Priority1/2と同じだが、それ以前にAnchor定義(Incus Long Process→Footplate)自体が
Pending Clinical Confirmationであるため、Layer1取得に着手する前提が整っていない。
P3-4の範囲では「定義確定が先決」と位置づけるに留め、定義確定の具体的手順はP3-5
(Measurement Protocol)以降で検討する。

## P3-5(次セッションで詳細化、アウトラインのみ)

1. **Measurement Protocol**: Priority1の3症例(004/008/012)から着手する具体的な
   Evidence取得手順(shojiさんへのヒアリング形式か、既存カルテ参照か等は未定)。
2. **Data Format**: 取得したLayer1 Evidenceをどこにどう記録するか(`cases.ts`拡張か
   別ファイルか等は未定)。
3. **Validation Criteria**: 取得したEvidenceをA+として確定させる基準(未着手)。

## 次のステップ

P3-4をshojiさんに確認のうえ、P3-5(Measurement Protocol / Data Format / Validation Criteria)を
次セッションで詳細化する。
