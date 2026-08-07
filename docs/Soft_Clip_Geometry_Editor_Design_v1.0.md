# Soft Clip Geometry Editor 設計文書 v1.3

**Status**: Approved(shojiレビュー承認、2026-08-07)。v1.3はTopology revision(Hook/Bridge
の鎖順序変更)を反映。
**Date**: 2026-08-07(v1.0)/2026-08-07(v1.1、shojiフィードバック反映)/2026-08-07(v1.2、
Hook:curve追加)/2026-08-07(v1.3、Topology revision)
**v1.3での変更点(shoji確認、2026-08-07)**: Editorでの対話的検討中、`right_annotated.png`・
`right_oblique_terminal_zoom.png`・`azimuth-ring/azimuth135_hook_visible_zoom.png`の
再確認により、Hook-like terminal(Evidence A)はBridge(Shaft接続点)のすぐ近傍にあり、
UpperArmの遠い先端はHookではなく単なる自由端(Photo#1でいう「ループ端」)である可能性が
高いとshojiが確認。これは`Soft_Clip_Geometry_Interpretation_v1.0.md` §4-5-A(v1.9、
「候補A: 単一連続鎖・BridgeとHookは鎖の両端」をStrongly Supportedと判定)の図解と
矛盾するため、同節を**Pending Re-evaluation**として明示し、正式な文書改訂は別途行う
こととした(shoji指定、Editor実装が文書改訂に先行する形)。Editor側は以下の変更を実施:
①鎖順序をHook→Bridge→LowerArm→Pocket→RearFlex→UpperArmへ変更。②旧`hook/start`・
`hook/end`をBridge隣接の短い区間として再配置。③旧UpperArm遠端(旧`hook/end`の位置)を
`upperArm/end`(新規ロール)として分離、Terminal Length 2.40mmの参照はHook側へ移動。
④shoji指摘の「Hook–Bridge–LowerArm間は下弦のカーブを描く」を表現するため、Bridge
region配下に`approach`(Hook側)・`departure`(LowerArm側)の2つのcurve可変グループを
新設。⑤1領域に複数のcurveグループを持てるよう、`renderCpList`/`addCurvePoint`の
マッチングをregion単独からregion+roleへ変更(Small Change、Region/Role分離の設計
意図に沿った拡張)。
**v1.2での変更点(shoji方針、2026-08-07)**: Proposal v2レビューでHookの直線区間が
「孤立した棒状の突起」に見えると判明したのを受け、Hook区間(`hook/start`–`hook/end`)に
`role:"curve"`可変グループを追加。LowerArm/RearFlex/UpperArmで既に使われている構造の
横展開であり、Frozen Layer・専用UI([[Non-goals §6の"Hook詳細編集"]]、Phase2)には
該当しない。**Decision Point(未解決のまま保留)**: Terminal Length 2.40mm
(`hook/start`–`hook/end`間、Evidence A)の測定定義が直線距離(chord)か経路長(path)かは
Measurement Record上明文化されておらず未確定。本追加はEditorの表現力拡張が目的であり、
この定義を確定・変更するものではない(shoji指定の一文をそのまま採用)。
**v1.1での変更点(shojiレビュー、2026-08-07)**: ①Control Point IDをUUID的な`cp_*`
命名からPath形式(`region/role`または`region/role/index`)へ変更。②`functionalRegion`
のフラットenumをRegion(LowerArm/RearFlex/UpperArm/Pocket/Bridge/Hook)+Role
(start/curve/entrance/deepest/end)の階層構造へ変更。③JSON Exportに
`evidenceSnapshot`を追加(編集時に参照していたEvidence値のスナップショット)。④Phase1
スコープにUndo(Ctrl+Z)とJSON Importを追加(範囲確認は§6)。⑤Decision Points(§7)を
全件解決、結果を反映。⑥Non-goalsに「ExportされたJSONはEvidenceではなく設計案」の
明示的な一文を追加。
**位置づけ**: Priority4(CAD問い合わせ準備)の前段階として、Tier C(Band Loop全体
Centerline)の「設計判断」をshojiと対話的に行うための独立ツール。`Soft_Clip_Geometry_
Improvement_Phase_v1_Freeze_v1.0.md`§5のTier C再開条件(制御点位置等のEvidence確定)
そのものを、このツールでの対話的検討を通じて埋めていく。

---

> ## Non-goals(重要・誤解防止)
>
> - 本ツールは**最終CADでも本番Geometry実装でもない**。出力JSONを`ProsthesisModels.tsx`
>   へ自動反映する仕組みは持たない(将来、Evidence確定後に別途手動で反映する)。
> - **Editorは設計支援ツールであり、ExportされたJSONはEvidenceではなく設計案
>   (Hypothesis)として扱う。JSONを本番Geometryへ反映する際は、別途レビュー・承認を
>   経ることを必須とする。**(v1.1新設、shoji指定の一文をそのまま採用)
> - 本ツール内で入力される座標・曲率等は、たとえ確定的に見えても**すべてHypothesis
>   Sandbox内の値**であり、Evidence階層としてA+/A/Bへ昇格することはない(昇格は
>   実測・写真解析等の既存プロセスでのみ行う)。
> - Frozen Layer(Engine/Safety/Pose Solver/Coordinate System)には一切触れない。
>   Band Loop Editor内の座標系はGlobal/Shaft座標系と**意図的に未接続**(Coordinate
>   Integration課題そのものであり、本ツールで解決しようとしない)。
> - 既存の`kurz_landmark_editor_tool_v2_2026-07-22.html`は変更しない。

---

## 1. Confirmed(既存文書からのEvidence一覧、本ツールの編集可否判定の根拠)

出典はすべて`docs/Soft_Clip_*.md`。値・Evidence区分は転記のみ(このEditor設計のために
新たに確定させたものはない)。v1.0から内容変更なし。

### 1.1 Lock対象(Evidence A+、編集不可・参照表示のみ)

| 項目 | 値 | 出典 |
|---|---:|---|
| Pocket Maximum Width | 1.40 mm | Improvement Spec §1.4 |
| Arm Gap(Pocket入口幅) | 0.75 mm | Improvement Spec §1.4 |
| Pocket Depth | 3.30 mm(定義: Upper Arm先端下面→最深部) | Improvement Spec §1.4 |
| Band Loop断面(幅0.25mm×厚さ0.10mm) | **A+として確定(v1.1、下記参照)** | Measurement Record §0 |
| Shaft Lower/Middle 径・長さ | 参照表示のみ(Tier A実装済み、Band Loop側の編集対象外) | Component Tree §2 |

**v1.1でのEvidence区分解決**: Band Loop断面のEvidence区分がMeasurement Record(A+)
とImprovement Spec §1.2(A)で食い違っていた件、shoji判断: **Measurement Recordを
一次情報として優先しA+採用**(Improvement Specは設計文書でありEvidence階層では一次
情報を優先するのが自然)。ただし**文書間の不一致は別途解消し、根拠を注記として残す
ことを推奨**(本Editor設計の範囲外、Improvement Spec側の表記統一は別タスクとして
Backlog化)。

### 1.2 編集可能(Evidence A/B/Hypothesis、色分け表示)

| 項目 | Evidence | 状態 | 出典 |
|---|:---:|---|---|
| Terminal Shape(Hook-like terminal) | A | 分類は確定、幾何形状としての厳密な曲率式はなし | Improvement Spec §1.5 |
| Terminal Length | A | 約2.40mm。基準値として表示、Phase2でHook Terminal点との距離ヒントに使用 | 同上 |
| Bridge-side End(Topology) | Topology: Strongly supported / Position: Unknown | 単一連続鎖の端点であることは支持されるが3D座標は未確定 | Interpretation §4-5-A |
| Hook-side End(Topology) | 同上 | 同上 | 同上 |
| Lower Arm開始点(旧M1) | Provisional | 写真幾何解析による相対距離のみ(M3→M1: 1.50〜1.73mm、視点2方向) | M1M2M3 Measurement v1.9 |
| Shaft接続点(旧M3) | Definition: Adopted / mm値: Provisional | 幾何学的交点として定義は確定、絶対mm値はスケール較正未解決 | 同上 |
| Hook-like曲げ開始点(旧M2) | Reject(固定点として不採用) | Hook Transition Profile(遷移長・曲率・進入角)として再定義中、定量値ゼロ | 同上 |
| 主要曲率変化点(約3回) | B | 回数の見立てのみ、座標なし | Interpretation §1.3-A |
| Upper/Lower Arm角度 | B(示唆のみ) | 非対称性(Upper側がより弾性変形)の可能性、未確定 | Component Tree §2.1 |
| Rear Flex Region曲率・境界 | B | 離散/連続の判別も未着手 | Improvement Spec §2.5 |
| Bridge詳細形状(位置・長さ・角度) | Unknown | 存在は確実、寸法計測なし | Component Tree §2 |

## 2. 画面構成(3ペインCAD風、v1.0から変更なし)

```
┌─────────────┬───────────────────────┬─────────────────┐
│ 左: Control/Evidence  │ 中央: Geometry表示(3D)   │ 右: Parameter編集     │
│                       │                          │                       │
│ [Control Points]      │  OrbitControls(視点回転) │ 選択中の点/値:        │
│  - bridge/end          │  + TransformControls     │  - Path ID・Region/Role│
│  - lowerArm/start      │    (選択点のドラッグ移動) │  - Evidenceバッジ     │
│  - lowerArm/curve/0    │                          │  - X/Y/Z入力          │
│    [+追加][-削除]      │  Centerlineをライン表示   │    (Lock時は読取専用) │
│  - pocket/entrance(Lock)│  Pocketは破線ワイヤーで  │  - 出典・注記         │
│  - pocket/deepest(Lock)│  参照表示(非操作)        │  - Add/Remove(可変点) │
│  - rearFlex/curve/0    │                          │                       │
│    [+追加][-削除]      │                          │ [Reference Values]    │
│  - upperArm/curve/0    │                          │  Band幅/厚さ・Pocket  │
│    [+追加][-削除]      │                          │  各値・Terminal Length│
│  - hook/start(旧M2)    │                          │                       │
│  - hook/end            │                          │ [JSON Export/Import]  │
│                       │                          │  コピー/DL/読込        │
│ [Evidence Legend]      │                          │                       │
│  ■A+(Lock) ■A ■B ■Hyp │                          │ Ctrl+Z = Undo         │
└─────────────┴───────────────────────┴─────────────────┘
```

- 操作系は`kurz_landmark_editor_tool_v2_2026-07-22.html`と同一パターンを踏襲
  (OrbitControls=視点、TransformControls=選択点のドラッグ)。
- Lock対象(Evidence A+)の点はTransformControlsを無効化し、色をグレーアウトして
  ドラッグ不可を視覚的に明示する。
- **画面上部に常設のHypothesisバナー**(v1.1、shoji指定): 「この画面の座標・形状は
  すべてHypothesis(設計案)です。Evidenceとして確定しているのはPocket内部寸法と
  Band Loop断面のみです」を固定表示(閉じても再訪時に再表示、常時警告)。

## 3. データモデル(v1.1、Region/Role階層 + Path ID)

### 3.1 座標系(v1.0から変更なし)

**Band Loop Editorローカル座標系**(Global/Shaft座標系とは非接続)。原点・軸向きは
Editor内でのみ意味を持つ暫定フレームとし、Phase1では原点をBridge-side End(t=0相当)
に仮置きする。**Coordinate Integration(Tier C課題)を先取りして解決しようとしない**。

### 3.2 Control Point構造(v1.1、Path ID + Region/Role階層)

```js
{
  id: "lowerArm/start",           // Path形式(region/role、可変グループはregion/role/index)
  region: "LowerArm",             // "Bridge" | "LowerArm" | "Pocket" | "RearFlex" | "UpperArm" | "Hook"
  role: "start",                  // "start" | "curve" | "entrance" | "deepest" | "end" | "approach" | "departure"(v1.3、Bridge専用)
  index: null,                    // 可変グループのみ使用(0始まり)、固定スロットはnull
  position: { x: 0, y: 0, z: 0 }, // mm、Band Loop Editorローカル座標
  locked: false,                  // true = Evidence A+、ドラッグ不可
  evidenceLevel: "Provisional",   // "A+" | "A" | "B" | "Provisional" | "Unknown" | "Hypothesis"
  note: "旧M1。M3→M1: 1.50–1.73mm(視点2方向、Measurement v1.9)",
  removable: false                // 固定スロットはfalse、可変グループ点はtrue
}
```

**Region/Role組み合わせ**(v1.3、Topology revision反映。固定スロット7 + 可変グループ6。
**注記**: shoji提案の省略形(`rearFlex/0`等)ではなく、`region/role/index`へ統一表記とした。
可変グループの多くで`role:"curve"`を用いるが、Bridgeのみ`approach`/`departure`という
別ロール名を使う[v1.3新設、理由は下記]。1領域に複数の可変グループを持てるよう、
Editor側の`renderCpList`/`addCurvePoint`はregion単独ではなくregion+roleでマッチする
よう変更済み):

**鎖順序(v1.3)**: `hook/end` → `hook/curve/0..n` → `hook/start` → `bridge/approach/0..n`
→ `bridge/end` → `bridge/departure/0..n` → `lowerArm/start` → `lowerArm/curve/0..n` →
`pocket/entrance` → `pocket/deepest` → `rearFlex/curve/0..n` → `upperArm/curve/0..n` →
`upperArm/end`

| Path ID例 | Region | Role | 種別 | Evidence | 備考 |
|---|---|---|---|---|---|
| `hook/end` | Hook | end | 固定1点 | Hypothesis、参照距離2.40mm(A)をヒント表示 | 単一鎖の自由端(Hook-like terminal先端)。v1.3でBridge隣接へ再配置(旧: UpperArm遠端側と誤って想定) |
| `hook/curve/0..n` | Hook | curve | 可変(0〜n) | Hypothesis | Hook区間の巻き込み表現用。Terminal Length 2.40mm(A)のMeasurement Definition[chord/path]は未確定のままDecision Point保留 |
| `hook/start` | Hook | start | 固定1点 | Unknown(旧M2、固定点として不採用済み) | Bridge側の曲げ開始点。Phase2でHook Transition Profileパラメータに拡張(定量値化は別途) |
| `bridge/approach/0..n` | Bridge | approach | 可変(0〜n、v1.3新設) | Hypothesis | Hook→Bridge間の「下弦のカーブ」表現用(shoji指摘) |
| `bridge/end` | Bridge | end | 固定1点 | Topology: 要再評価(Interpretation §4-5-A参照) / Position: Unknown | Shaft MiddleとBand Loopを接合するT字接合部(Component Tree、Confirmed) |
| `bridge/departure/0..n` | Bridge | departure | 可変(0〜n、v1.3新設) | Hypothesis | Bridge→LowerArm間の「下弦のカーブ」表現用(shoji指摘、approachと対) |
| `lowerArm/start` | LowerArm | start | 固定1点 | Provisional(旧M1) | |
| `lowerArm/curve/0..n` | LowerArm | curve | 可変(0〜n) | Hypothesis | 主要曲率変化点(見立てでは約3回) |
| `pocket/entrance` | Pocket | entrance | 固定1点 | 位置=Hypothesis、内部params=A+(Lock) | |
| `pocket/deepest` | Pocket | deepest | 固定1点 | 位置=Hypothesis、内部params=A+(Lock) | |
| `rearFlex/curve/0..n` | RearFlex | curve | 可変(0〜n) | Hypothesis | |
| `upperArm/curve/0..n` | UpperArm | curve | 可変(0〜n) | Hypothesis | |
| `upperArm/end` | UpperArm | end | 固定1点 | Hypothesis | v1.3新設(旧`hook/end`を改称)。Upper Armの自由端、Photo#1の「ループ端」に相当。Terminal Length 2.40mmの参照は持たない |

**Region/Role分離の狙い(shoji指摘どおり)**: Phase2で`hook/start`に曲率・進入角
パラメータを追加する、あるいは`bridge`region配下に`bridge/end`以外のフィールド
(長さ・角度)を追加する際も、既存のPath ID・Region/Role構造を壊さず拡張できる。

### 3.3 Pocket参照ジオメトリ(v1.0から変更なし)

`pocket/entrance`/`pocket/deepest`の2点は他の点と同じくCenterline配列の一部
(自由に動かせる)だが、追加で以下のLock済みパラメータを保持し、中央ペインに破線の
簡易ファンネル形状として参照表示する(実際のGeometry実装の再現ではなく目安):

```js
pocketParams: {
  armGapMm: 0.75,      // locked, A+
  maxWidthMm: 1.40,    // locked, A+
  depthMm: 3.30,       // locked, A+
  source: "Soft_Clip_Geometry_Improvement_Spec_v1.0.md §1.4"
}
```

### 3.4 Profile(参照値、Phase1では編集対象外、v1.1でEvidence確定)

```js
profile: {
  bandWidthMm: 0.25,
  bandThicknessMm: 0.10,
  evidenceLevel: "A+",   // v1.1でA+確定(§1.1参照、Measurement Record優先)
  locked: true
}
```

### 3.5 初期配置(Seed positions、v1.1でshoji承認: ガイド形状を採用)

3D座標の実測はまだ存在しないため、初期状態は**目安の仮配置**(単純な「つ」字ガイド
形状)から開始する。固定スロット点(6点)を生成し、可変グループ
(`lowerArm/curve`等)はガイド形状として各1点をデフォルト生成する(shoji承認、
「完全に空だと最初の操作が面倒」)。**画面上部の常設Hypothesisバナー(§2)で
警告することを条件とする**(shoji指定: 重要なのは大きな表示)。

### 3.6 Undo(v1.1新設、Phase1スコープ)

- 操作(ドラッグ確定・数値入力確定・点の追加/削除・Import)ごとに、直前の全体state
  (JSON化可能な状態)をUndoスタックへpush。
- `Ctrl+Z`でスタックから1つ戻し再描画。
- Redo・スタック上限(古い履歴の破棄)はPhase2で検討(shoji了承、Phase1はUndoのみ)。

### 3.7 JSON Import(v1.1新設、Phase1スコープ)

- 左または右パネルにファイル選択(`<input type=file accept=".json">`)を設置。
- 読み込んだJSONの`schemaVersion`を検証(`1.x`以外は警告して読み込み中止)。
- 読み込み成功時は現在のstateを丸ごと置換し、Undoスタックへ読み込み前のstateを
  push(Import自体もUndo可能にする)。
- Import後は初回ロード同様、Hypothesisバナーを再表示する。

## 4. JSON Export スキーマ(v1.1、evidenceSnapshot追加)

```json
{
  "schemaVersion": "1.0",
  "tool": "Soft_Clip_Geometry_Editor",
  "exportedAt": "2026-08-07T00:00:00Z",
  "disclaimer": "This JSON is a design proposal (Hypothesis), not Evidence. Any reflection into production Geometry requires separate review and approval.",
  "coordinateFrame": {
    "type": "bandLoopLocal",
    "note": "Global/Shaft座標系とは未統合(Tier C Coordinate Integration課題)"
  },
  "profile": { "bandWidthMm": 0.25, "bandThicknessMm": 0.10, "evidenceLevel": "A+", "locked": true },
  "centerline": {
    "curveType": "CatmullRomCurve3",
    "controlPoints": [ { "...": "§3.2の構造そのまま" } ]
  },
  "evidenceSnapshot": {
    "pocketDepthMm": 3.30,
    "armGapMm": 0.75,
    "pocketMaxWidthMm": 1.40,
    "bandWidthMm": 0.25,
    "bandThicknessMm": 0.10,
    "bandCrossSectionEvidenceLevel": "A+",
    "terminalLengthMm": 2.40,
    "sourceDocs": [
      "Soft_Clip_Geometry_Improvement_Spec_v1.0.md",
      "Soft_Clip_Band_Loop_Measurement_Record_v1.0.md",
      "Soft_Clip_M1M2M3_Photogrammetric_Measurement_v1.0.md"
    ]
  },
  "referenceValues": {
    "terminalLengthMm": { "value": 2.40, "evidenceLevel": "A" }
  },
  "meta": { "editedBy": "shoji", "sessionNote": "" }
}
```

`evidenceSnapshot`の狙い(shoji指摘どおり): 「どのEvidenceを見ながら編集したJSON
なのか」を後から追跡できるようにする。値そのものはProfile/Pocketの参照値と重複
するが、Export時点でのスナップショットとして独立させることで、将来Evidence値が
更新された際に「このJSONは旧Evidence基準で作られていた」と判別できる。

Phase1では`bridge`/`hook`(詳細パラメータ)フィールドは省略可能(将来のPhase2で
追加してもschemaVersionは1.xのまま拡張、破壊的変更にしない)。

## 5. 技術方針(v1.0から変更なし)

- 単一HTML、Vanilla JS、React/TypeScript不使用。
- Three.js + OrbitControls + TransformControlsを`importmap`経由でCDN読み込み
  (`kurz_landmark_editor_tool_v2_2026-07-22.html`と同一パターン、jsdelivr CDN)。
- ビルドステップなし。`kurz-simulator`のVerification Order(Build/TypeCheck/Lint)は
  対象外。完了条件は「ブラウザで開いてCenterline編集→Export/Import→Undoが動作
  すること」の手動確認とする。

## 6. Phase1完了条件(v1.1、Undo・Import追加)

- ✅ Centerline編集(固定スロット6点+可変グループのドラッグ移動)
- ✅ Evidence表示(色分け+バッジ+出典note)
- ✅ JSON Export(コピー or ダウンロード、evidenceSnapshot込み)
- ✅ **JSON Import(v1.1追加)**
- ✅ **Undo/Ctrl+Z(v1.1追加)**
- ❌ 曲率Handle/スライダー — Phase2
- ✅ **Hook:curve可変グループ(v1.2追加)** — `hook/start`/`hook/end`は引き続き固定、
  中間点(`hook/curve/0..n`)のみ可変グループとして追加・削除・ドラッグ可能
- ❌ Hook詳細編集(長さ/曲率/方向の専用UI) — Phase2(`hook/start`点の位置編集・
  `hook/curve`点の追加自体はv1.2でPhase1に含めた)
- ❌ Bridge詳細編集(長さ/角度の専用UI) — Phase2(`bridge/end`点の位置編集自体は
  Phase1に含む)
- ❌ Redo — Phase2

## 7. Decision Points — 解決済み(v1.1、shoji回答2026-08-07)

| # | 論点 | 結論 |
|---|---|---|
| 1 | Band Loop断面のEvidence区分 | **A+採用**(Measurement Recordを一次情報として優先)。文書間不一致の解消は別タスク(Backlog) |
| 2 | 保存先 | **OneDriveプロジェクト直下**(kurz-simulator gitリポジトリ外)。理由: 開発ツールであり製品コードではない、gitへ入れるとVerification/Review/Build対象と誤解されるため |
| 3 | ファイル名 | `Soft_Clip_Geometry_Editor_v1.html`で確定 |
| 4 | 初期配置 | ガイド形状を採用(完全に空だと最初の操作が面倒なため)。画面上に大きなHypothesis表示を必須条件とする |
| 5 | コミット単位 | Spec → Review → Phase1実装 → Review → Phase2、の順で確定 |

## 8. 参照文書

- `docs/Soft_Clip_Geometry_Improvement_Phase_v1_Freeze_v1.0.md`(Tier C再開条件)
- `docs/Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`
- `docs/Soft_Clip_Component_Tree_v1.0.md`(v1.3)
- `docs/Soft_Clip_Geometry_Method_Decision_v1.0.md`(v1.4)
- `docs/Soft_Clip_Geometry_Interpretation_v1.0.md`(§4-5-A Topology Candidate Evaluation)
- `docs/Soft_Clip_Geometry_Improvement_Spec_v1.0.md`
- `docs/Soft_Clip_M1M2M3_Photogrammetric_Measurement_v1.0.md`(v1.9)
- `docs/Soft_Clip_Centerline_Parameter_Definition_v1.0.md`(Pocket Phase1、座標系記法の参考元)
- `kurz_landmark_editor_tool_v2_2026-07-22.html`(UI/操作方式の参考元)
