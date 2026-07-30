# P2: Measurement Definition v1.0

**位置づけ**: P1(Bell Evidence整理)完了を受け、`selectedLength`/`recommendedLength`が何を
表す数値かを4層に分離して定義する。コード変更は行わない(Strangler Pattern、Definition文書)。
2026-07-29、shojiさんとの確認(Bell Landmark測定・cases.ts監査)に基づき作成。

**Status**: Approved(2026-07-29、shoji確認済み)

## 前提(確定済み、変更しない)

- プロジェクトルート管理の既存文書`selectedLength_定義書_v1.0.md`(OneDrive、kurz-simulator/docs外)
  D1: Functional Lengthを教育システム全体の基準概念とする(2026-07-23決定済み)。
- P1: Bell外形(`BELL_HEIGHT_MM=1.095mm`・`BELL_RIM_RADIUS_MM=0.795mm`)はEvidence確定済み、
  再測定不要。シャフトはBell内部に実物構造として存在せず、Bell頂点(apex)に接続される
  (2026-07-29、shoji確認、Evidence区分: Ground Truth/術者回答)。

## 4層モデル

臨床測定・製品選択・アプリ内数値・3Dジオメトリという性質の異なる4つの量を、無理に1つの数値へ
押し込めず、明確に分離する。

### Layer 1: Anatomical Distance(臨床測定距離)

**定義**: TM(または軟骨再建面)からプロステーシスのアンカー点(PORP/Bell系: アブミ骨頭、
TORP/FLAT系: アブミ骨底板)までを、術中にサイザーで実測した生の距離。

**基準点(確定、2026-07-29 shoji確認)**:

```
TM(または軟骨再建面)
      ↓
Stapes Head(PORP/Bell) または Footplate(TORP/FLAT/Stapedotomy)
```

この基準点は`cases.ts`のclinicalNotes表現(「アブミ骨頭間」「底板間」)、および現行コードの
`base`変数切替ロジック(`stapStatus`/`footType`による`STAPES_HEAD`/`STAPES_FOOTPLATE`分岐、
`SimScene.tsx:643-646`)と一致する。

> **追記(2026-07-30、P3-EA-3 Anchor分岐 最終整理、shoji承認・案B)**: PORPのみ、上記
> 「TM(または軟骨再建面) → Stapes Head」はさらにⅢc相当(軟骨再建面 → Stapes Head)/
> Ⅲi-M相当(ツチ骨柄 → Stapes Head)に分岐する。malleus状態(absent/intact/partial)単独では
> 判定できず、症例ごとのnarrative確認が必要。判断手順の確定版は
> `docs/P3-EA-2_Step_B_Additional_Confirmation_Malleus_Partial_Anchor_Review_Response_v1.0.md`
> 「PORP Anchor Definitionの最終形」を参照。本追記は既存の基準点定義を変更するものではなく、
> 追加情報として付記する(Strangler Pattern、既存文言は無変更)。

**現状**: `cases.ts`にこの生の値を保持する専用フィールドは存在しない。clinicalNotesの文中に
記述される場合があるが(例: 「約2.5mm」)、記述の性質は症例ごとに異なる(下記Layer 3参照)。

### Layer 2: Cartilage Compensation(軟骨グラフト補正)

**定義**: Head PlateとTMの間に挿入する軟骨グラフトの厚み分を、Layer 1から差し引く補正。

**確定した事実**: KURZ IFU記載は0.3〜0.5mm(Head PlateはTMに直接接触せず、必ずグラフトを介在
させる設計)。2026-07-29shojiさんの説明では具体例として0.2mmが挙げられた(症例固有の値か
一般値かは未確認、Unknownのまま扱う)。

**この補正は現状コードに実装されていない**。Layer 1(生の測定距離)からLayer 3(選択した
インプラント長)への変換過程で臨床的に発生するものだが、アプリ内では両者の関係を明示的に
モデル化していない。

### Layer 3: Selected Implant Length(選択したインプラント長 = `recommendedLength`)

**定義(2026-07-29 shoji確認により確定)**: 術者がLayer 1・Layer 2を踏まえて最終的に選択した
製品カタログ上のシャフト長(`shaftLengths`グリッド値)。

**Evidence**: case-004/008/012(`RecommendedLength_Audit_Template_2026-07-23.md`
(OneDriveプロジェクトルート管理)で「実測(サイザー)」に
分類された3症例)の記載値(2.0mm/2.5mm/2.0mm)は、いずれも`porp-ttp-variac`の
`shaftLengths`グリッド(1.75〜4.50mm、0.25mm刻み)に完全に一致する。サイザーの生実測値が
偶然この刻みに一致する必然性はないため、**これらは生の解剖学的距離ではなく、製品規格値へ
丸めた選択長である**と判断する(shoji確認済み)。

**結論(重要)**: `cases.ts`の`recommendedLength`は**Layer 3を表す**。これは現行コードの
`selectedLength`(UI・スコア計算・Ground Truth Exportが参照する値)と**同じ層の量**であり、
両者は最初から整合していた。**既存15症例の`recommendedLength`データを軟骨補正のために遡って
修正する必要はない。**

### Layer 4: Implant Model Geometry(3Dジオメトリ上の構造長)

**定義**: `selectedLength`(=Layer 3の値)が、procedural geometry上でBell・Shaft・Head Plateへ
どう分解されるか。

**確定(P1・既存コード確認、2026-07-29 shoji指摘によりLayer3(臨床)との混同を避けるため命名修正)**:

```
selectedLength(base→top)
  = Bell Structural Height(anchor〜Bell apex、BELL_HEIGHT_MM=1.095mm、Geometry Component)
  + Shaft Geometric Length(Bell apex〜Head Plate側、shaftLen = len - BELL_HEIGHT_MM、Geometry Component)
```

(旧称「Bell Engagement」「Shaft Exposed Length」は、臨床的な「stapes headへの装着領域」を
想起させ、幾何長と接触領域の意味が混ざる懸念があるため改称した。)

`ProsthesisModels.tsx`L895-896で既に`shaftLen = len - BELL_HEIGHT_MM`として実装済み
(P1で確認済み、修正不要)。

**Bell Apexの位置づけ**: Clinical Definition(Layer 1〜3)には含めない。Geometry Landmark
(Layer 4)として扱う(2026-07-29 shoji方針)。

## 未解決のまま残す数値(統一しない、`selectedLength_定義書_v1.0.md`(OneDrive管理)D3を継承)

以下3つの数値は出所が異なるため、無理に1つに統一しない。

| 数値 | 値 | 出所 | 対応するLayer |
|---|---|---|---|
| Bell高さ実測値 | 1.095mm | 20倍模型ノギス実測(`BELL_HEIGHT_MM`) | Layer 4(Geometry) |
| カタログAdjustable−Functional差 | 1.00mm | KURZ製品カタログ | Layer 3⇔別のFunctional Length概念(TORPには存在しない、未解決) |
| 軟骨グラフト厚 | 0.2〜0.5mm | IFU(0.3-0.5mm)/shoji口頭(0.2mm、Unknown) | Layer 1→Layer2の変換 |

**注記**: カタログの「Functional Length」という語は、本文書のLayer 1(Anatomical Distance)とは
別概念である可能性が高い(TORPにはFunctional Length概念自体が存在しないという既存所見と、
Layer1がPORP/TORPどちらにも適用されることが整合しないため)。この点は本文書のスコープ外とし、
Unknownのまま残す。

## cases.tsとの対応関係(監査結果)

`RecommendedLength_Audit_Template_2026-07-23.md`(OneDrive管理)の分類に基づき、15症例は以下のようにLayer上の性質が異なる。

- **実測(サイザー)、Layer 3として確定(3症例)**: case-004/008/012。
- **約(推定)、性質不明(7症例)**: case-001/002/005/007/013/014/015。推定値がLayer 1相当か
  Layer 3相当かは症例ごとに異なりうる(shoji指摘、未確認)。
- **記載なし(5症例)**: case-003/006/009/010/011。テキストからの検証不能。

**P2としての判断**: 上記の分類にかかわらず、**`recommendedLength`フィールド自体はアプリ内で
一貫してLayer 3(Selected Implant Length)として扱われている**(スコア計算・Ground Truth
Export・UI表示すべて同一の生数値を参照、`selectedLength_定義書_v1.0.md`(OneDrive管理)第6章で確認済み)。したがって
コード上の扱いを変更する必要はない。「約(推定)」症例のclinicalNotes文言がLayer 1的な表現
(生の解剖学的距離)になっている点は、**教育的な説明文としての性質**であり、`recommendedLength`
という数値そのものの層とは別問題として扱う。

## 将来事項(本文書のスコープ外、記録のみ)

2026-07-29shojiさんより、「アブミ骨頭の形状やアブミ骨と鼓膜の位置関係によっては、Head Plateが
TMと平行にならず、シャフトを若干曲げてHead PlateとTMを平行にすることがある」という臨床情報を
得た。現行のPose Solver(P4B)はPORPを剛体(rigid body)として扱っており、この「シャフトの
局所的な曲げ」は表現できない。将来のPose Solver拡張(shaftのdeformation/adjustment layer)の
検討材料として記録するが、**P2・P4Cいずれのスコープにも含めない**。

## 次のステップ

shojiさん確認済み(2026-07-29)。本文書をApprovedとし、P3(Ground Truth再取得計画)へ進む。P3では
実測(サイザー)3症例を優先し、推定7症例・記載なし5症例は優先度を下げて扱う方針(前回監査で
提案済み)を維持する。
