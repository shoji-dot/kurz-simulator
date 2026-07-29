# P3: Ground Truth Acquisition Plan v1.0 (Draft)

**Status**: Draft(P3-0のみ確定、P3-1以降は未着手)
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

## P3-1〜P3-5(次セッションで詳細化、アウトラインのみ)

1. **Purpose**: recommendedLengthの正しさを確認するのではなく、Layer1→Layer2→Layer3の
   変換過程を記録すること。
2. **Ground Truth Definition**: 上記P3-0の用語整理を踏まえ、Clinical GT(Layer1)を
   新たに取得する場合の定義方法。
3. **Evidence Hierarchy Mapping**: [[feedback]]のEvidence A+/A/B/C階層と、上表のLayer1-4を
   どう対応づけるか。
4. **Case Priority Definition**: case-004→008→012を優先する根拠の再整理(Evidence確度High、
   実測サイザー分類済み。ただし「GT差異があるから優先」という誤った根拠は使わない)。
5. **Measurement Protocol / Data Format / Validation Criteria**: 未着手。

## 次のステップ

P3-0をshojiさんに確認のうえ、P3-1(Purpose)以降を次セッションで詳細化する。
