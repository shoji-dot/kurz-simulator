# P3-EA-2 Step A: 既存Evidenceの整理(case-004/008/012)

**Status**: Draft(shoji確認待ち)
**Date**: 2026-07-29
**位置づけ**: `docs/P3-EA-1_Evidence_Acquisition_Plan_v1.0.md`のStep A(既存Evidenceの整理)。
Priority1(case-004/008/012、`docs/P3_Ground_Truth_Acquisition_Plan_v1.0.md` P3-4で確定)を対象に、
`cases.ts`の既存記載をP3-3のEvidence Hierarchy(A+/A/B/C)・P3-0のLayer分類(Layer1-4)へマッピング
する。**新規の判断・推測は加えない(既存記載の再整理のみ)。** Step B(shojiさんへの専門家レビュー)
は本文書の対象外であり、別途実施する。

---

## Case-004

**title**: 症例2: ツチ骨・キヌタ骨欠損（III型）— PORP
**ossicularStatus**: malleus: absent / incus: absent / stapes: suprastructure
**recommendedProductId**: porp-ttp-variac / **recommendedLength**: 2.0mm

### Existing Information(原文引用)

- **clinicalNotes**: 「軟骨（耳珠軟骨）で鼓膜を再建し、軟骨〜アブミ骨頭間距離をサイザーで実測。
  本症例は約2.0mm。アブミ骨頭部が明視野に確認でき、ベル型フットで安定保持が可能。」
- **teachingPoints(該当箇所)**: 「PORPのシャフト長はサイザーを使い必ず術中実測。術前CTの距離は
  参考値。通常1.5〜2.5mmの範囲。」

### Evidence Classification

| 項目 | 記載内容 | Evidence Level | Layer | Status |
|---|---|---|---|---|
| Anchor定義 | 軟骨再建面 → アブミ骨頭部(Stapes Head) | B | Layer1 Definition | Confirmed(Definition)。P3-2/P3-3の「TM(または軟骨再建面)→Stapes Head」に合致 |
| Layer1実測値 | (専用フィールドなし) | (取得なし) | Layer1 Data | Unknown |
| clinicalNotes記載距離 | 「軟骨〜アブミ骨頭間距離をサイザーで実測…約2.0mm」 | C相当(Scenario Narrative) | Clinical Narrative | Pending(未検証)。P3-4分類「実測(サイザー)」に該当 |
| Layer2軟骨補正 | 記載なし(補正量の言及なし) | — | Layer1→2変換 | Unknown |
| Selected Length Record | recommendedLength = 2.0mm | A(コード内で一貫) | Layer3 | Confirmed(コード上の値として) |

### Known

- Anchorは「軟骨再建面〜アブミ骨頭部」と明記されている(TMそのものではなく軟骨再建面が起点)。
- 「サイザーで実測」という記載がある(表現上は実測を主張)。
- teachingPointsに一般的なPORPシャフト長の範囲(1.5〜2.5mm)への言及があり、本症例の2.0mmはその
  範囲内。

### Unknown / 曖昧な点

- 「サイザーで実測」の記載が、P3 Freeze v1.0で確定した前提(15症例は教育目的の架空/合成シナリオ)
  の下で何を意味するか(症例設定上の記述であり、実患者の実測記録ではない)。
- 軟骨補正(Layer1→2)の適用有無・適用量への言及がclinicalNotesに存在しない。
- 「軟骨再建面」の具体的な厚さ・位置の記載がなく、Anchor起点の物理的定義がテキストのみ。

---

## Case-008

**title**: 症例8: 外傷性耳小骨離断 — PORP（急性期）
**ossicularStatus**: malleus: intact / incus: absent / stapes: suprastructure
**recommendedProductId**: porp-ttp-variac / **recommendedLength**: 2.5mm

### Existing Information(原文引用)

- **clinicalNotes**: 「外傷から3ヶ月後に手術施行。鼓膜切開で鼓室内を確認するとキヌタ骨が砧骨窩
  から完全脱臼し、後鼓室に落下していた。脱臼キヌタ骨を摘出後、ツチ骨柄下〜アブミ骨頭間距離を
  実測（2.5mm）。PORPを設置。」
- **teachingPoints(該当箇所)**: 「外傷性耳小骨離断の最多損傷部位はキヌタ骨長突起〜アブミ骨頭部の
  間（砧鐙関節）。CT診断が有用だが見落としも多い。」

### Evidence Classification

| 項目 | 記載内容 | Evidence Level | Layer | Status |
|---|---|---|---|---|
| Anchor定義 | ツチ骨柄下 → アブミ骨頭部(Stapes Head) | B | Layer1 Definition | Confirmed(Definition)。「TM(または軟骨再建面)」のうちツチ骨柄下(TM側)に該当 |
| Layer1実測値 | (専用フィールドなし) | (取得なし) | Layer1 Data | Unknown |
| clinicalNotes記載距離 | 「ツチ骨柄下〜アブミ骨頭間距離を実測（2.5mm）」 | C相当(Scenario Narrative) | Clinical Narrative | Pending(未検証)。P3-4分類「実測」に該当 |
| Layer2軟骨補正 | 記載なし(補正量の言及なし) | — | Layer1→2変換 | Unknown |
| Selected Length Record | recommendedLength = 2.5mm | A(コード内で一貫) | Layer3 | Confirmed(コード上の値として) |

### Known

- Anchorは「ツチ骨柄下」と明記されている(case-004/012が「軟骨再建面」なのと異なる)。
- malleus: intactであり、他2症例(malleus: absent)と構造上異なる。
- 「実測（2.5mm）」という記載がある(表現上は実測を主張、括弧付きで数値を明示する書式)。

### Unknown / 曖昧な点

- **tags.procedureは「鼓室形成III型」だが、malleus: intact(ツチ骨柄下配置)という構造記載は、
  case-004(症例2)自身のteachingPoints内に記載された「III型 vs II型の判断：ツチ骨柄が残存して
  いればII型（PORP under malleus handle）。ツチ骨柄なしならIII型」、およびcase-012(症例12)の
  teachingPoints内に記載された同旨の判定基準(「ツチ骨柄が残存すればII型…なければIII型」)という、
  本コードベース内の他症例(かつ同じPriority1グループ内)の判定基準と整合しない。この不一致は
  cases.ts上の既存記載同士の観察であり、新規の医学的判断は加えていない。**
- 軟骨補正(Layer1→2)の適用有無・適用量への言及がclinicalNotesに存在しない。
- 「実測」の主体(誰が・どの器具で)は「サイザー」との明記がcase-004/012と異なり本文中にない
  (teachingPointsではなくclinicalNotes内に器具名の記載なし)。

---

## Case-012

**title**: 症例12: ツチ骨・キヌタ骨欠損（III型）— PORP 入門
**ossicularStatus**: malleus: absent / incus: absent / stapes: suprastructure
**recommendedProductId**: porp-ttp-variac / **recommendedLength**: 2.0mm

### Existing Information(原文引用)

- **clinicalNotes**: 「軟骨（耳珠軟骨）で鼓膜を再建し、軟骨〜アブミ骨頭間距離をサイザーで実測。
  本症例は約2.0mm。術野が清潔でアブミ骨頭部が明視野に確認でき、ベル型フットで安定保持が可能。」
- **teachingPoints(該当箇所)**: 「シャフト長は術中サイザーで実測する。通常1.5〜2.5mmの範囲。
  CTの距離は参考値にとどめる。」

### Evidence Classification

| 項目 | 記載内容 | Evidence Level | Layer | Status |
|---|---|---|---|---|
| Anchor定義 | 軟骨再建面 → アブミ骨頭部(Stapes Head) | B | Layer1 Definition | Confirmed(Definition)。case-004と同一の記載パターン |
| Layer1実測値 | (専用フィールドなし) | (取得なし) | Layer1 Data | Unknown |
| clinicalNotes記載距離 | 「軟骨〜アブミ骨頭間距離をサイザーで実測…約2.0mm」 | C相当(Scenario Narrative) | Clinical Narrative | Pending(未検証)。P3-4分類「実測」に該当 |
| Layer2軟骨補正 | 記載なし(補正量の言及なし) | — | Layer1→2変換 | Unknown |
| Selected Length Record | recommendedLength = 2.0mm | A(コード内で一貫) | Layer3 | Confirmed(コード上の値として) |

### Known

- clinicalNotesの文面はcase-004とほぼ同一パターン(「軟骨〜アブミ骨頭間距離をサイザーで実測。
  約2.0mm」)。difficulty: beginner(入門症例)として設定されている点がcase-004(intermediate)と
  異なる。
- teachingPointsで一般的なシャフト長範囲(1.5〜2.5mm)への言及があり、本症例の2.0mmはその範囲内。

### Unknown / 曖昧な点

- case-004との記載パターンの類似性が、症例設計上意図されたものか(教育目的での典型値の反復)か、
  独立した設定かは本文からは判別できない。
- 軟骨補正(Layer1→2)の適用有無・適用量への言及がclinicalNotesに存在しない。

---

## 3症例横断の要約

| Case | Anchor記載 | recommendedLength | clinicalNotes上の実測表現 | tags.procedure |
|---|---|---|---|---|
| case-004 | 軟骨再建面 → Stapes Head | 2.0mm | 「サイザーで実測…約2.0mm」 | 鼓室形成III型 |
| case-008 | ツチ骨柄下 → Stapes Head | 2.5mm | 「実測（2.5mm）」(器具名の明記なし) | 鼓室形成III型(malleus: intactとの整合に疑問、上記参照) |
| case-012 | 軟骨再建面 → Stapes Head | 2.0mm | 「サイザーで実測…約2.0mm」 | 鼓室形成III型 |

**共通してLayer1実測値・Layer2軟骨補正はいずれもUnknown**(P3-3で確認済みの全15症例共通の
制約であり、Priority1固有の新事実ではない)。

**Step Bで確認が必要な論点(本文書からの示唆、判断は加えていない)**:

1. Anchorの起点(軟骨再建面 vs ツチ骨柄下)が症例間で異なる記載になっている理由。
2. case-008のtags(III型)とossicularStatus(malleus: intact)の整合性。
3. 「サイザーで実測」という記載表現を、Evidence B(shojiさんの専門的臨床判断)として確定させる際の
   根拠(P3-EA-1のStep B観点「なぜそのサイズを選んだか」に対応)。
4. Layer2軟骨補正が3症例いずれのclinicalNotesにも明記されていない点をどう扱うか。

---

## No inference added

本文書は`cases.ts`の既存記載(clinicalNotes/recommendedLength/teachingPoints/tags/
ossicularStatus)をP3-3のEvidence Hierarchy・P3-0のLayer分類へ再整理したものであり、新規の
臨床的判断・数値の推定は加えていない。「Unknown / 曖昧な点」に記載した観察も、既存記載同士の
突き合わせによる指摘であり、医学的な正誤判断ではない。
