# P3: Ground Truth Acquisition Plan v1.0 (Draft)

**Status**: Draft(P3-0/P3-1確定、P3-2以降は未着手)
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

## P3-2〜P3-5(次セッションで詳細化、アウトラインのみ)

1. **Ground Truth Definition**: P3-0の用語整理を踏まえ、Clinical GT(Layer1)を
   新たに取得する場合の定義方法。
2. **Evidence Hierarchy Mapping**: [[feedback]]のEvidence A+/A/B/C階層と、上表のLayer1-4を
   どう対応づけるか。
3. **Case Priority Definition**: case-004→008→012を優先する根拠の再整理(Evidence確度High、
   実測サイザー分類済み。ただし「GT差異があるから優先」という誤った根拠は使わない)。
4. **Measurement Protocol / Data Format / Validation Criteria**: 未着手。

## 次のステップ

P3-1をshojiさんに確認のうえ、P3-2(Ground Truth Definition)以降を次セッションで詳細化する。
