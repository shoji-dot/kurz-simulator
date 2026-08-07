# Soft Clip Geometry Editor 設計文書 v1.0

**Status**: Draft — Pending Approval(実装未着手、shojiレビュー待ち)
**Date**: 2026-08-07
**位置づけ**: Priority4(CAD問い合わせ準備)の前段階として、Tier C(Band Loop全体
Centerline)の「設計判断」をshojiと対話的に行うための独立ツール。`Soft_Clip_Geometry_
Improvement_Phase_v1_Freeze_v1.0.md`§5のTier C再開条件(制御点位置等のEvidence確定)
そのものを、このツールでの対話的検討を通じて埋めていく。**本文書はSpec提示のみで
コード変更は一切含まない。**

---

> ## Non-goals(重要・誤解防止)
>
> - 本ツールは**最終CADでも本番Geometry実装でもない**。出力JSONを`ProsthesisModels.tsx`
>   へ自動反映する仕組みは持たない(将来、Evidence確定後に別途手動で反映する)。
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
新たに確定させたものはない)。

### 1.1 Lock対象(Evidence A+、編集不可・参照表示のみ)

| 項目 | 値 | 出典 |
|---|---:|---|
| Pocket Maximum Width | 1.40 mm | Improvement Spec §1.4 |
| Arm Gap(Pocket入口幅) | 0.75 mm | Improvement Spec §1.4 |
| Pocket Depth | 3.30 mm(定義: Upper Arm先端下面→最深部) | Improvement Spec §1.4 |
| Shaft Lower/Middle 径・長さ | 参照表示のみ(Tier A実装済み、Band Loop側の編集対象外) | Component Tree §2 |

### 1.2 編集可能(Evidence A/B/Hypothesis、色分け表示)

| 項目 | Evidence | 状態 | 出典 |
|---|:---:|---|---|
| Band Loop断面(幅0.25mm×厚さ0.10mm) | **要確認(下記参照)** | 参照値として表示、Phase1では編集対象外 | Measurement Record §0=A+ / Improvement Spec §1.2=A |
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

**要確認事項(shojiへ)**: Band Loop断面(幅0.25mm×厚さ0.10mm)のEvidence区分が
`Soft_Clip_Band_Loop_Measurement_Record_v1.0.md`§0では**A+**、
`Soft_Clip_Geometry_Improvement_Spec_v1.0.md`§1.2では**A**と、参照元によって表記が
食い違っています。実測方法(20倍模型ノギス実測→スケール換算)自体は同一のはずで、
表記のみの揺れと推測しますが、Editorでは安全側(Lock対象)として**A+扱い**にする
予定です。問題なければそのまま進めます。

## 2. 画面構成(Pending Approval、3ペインCAD風)

```
┌─────────────┬───────────────────────┬─────────────────┐
│ 左: Control/Evidence  │ 中央: Geometry表示(3D)   │ 右: Parameter編集     │
│                       │                          │                       │
│ [Control Points]      │  OrbitControls(視点回転) │ 選択中の点/値:        │
│  - Bridge End         │  + TransformControls     │  - 名前・区分         │
│  - Lower Arm Start(M1)│    (選択点のドラッグ移動) │  - Evidenceバッジ     │
│  - Lower Arm Curve #1 │                          │  - X/Y/Z入力          │
│    [+追加][-削除]      │  Centerlineをライン表示   │    (Lock時は読取専用) │
│  - Pocket Entrance(Lock)│  Pocketは破線ワイヤーで  │  - 出典・注記         │
│  - Pocket Deepest(Lock)│  参照表示(非操作)        │  - Add/Remove(可変点) │
│  - Rear Flex #1        │                          │                       │
│    [+追加][-削除]      │                          │ [Reference Values]    │
│  - Upper Arm Curve #1  │                          │  Band幅/厚さ・Pocket  │
│    [+追加][-削除]      │                          │  各値・Terminal Length│
│  - Hook Transition(M2) │                          │                       │
│  - Terminal End        │                          │ [JSON Export]         │
│                       │                          │  コピー/ダウンロード  │
│ [Evidence Legend]      │                          │                       │
│  ■A+(Lock) ■A ■B ■Hyp │                          │                       │
└─────────────┴───────────────────────┴─────────────────┘
```

- 操作系は`kurz_landmark_editor_tool_v2_2026-07-22.html`と同一パターンを踏襲
  (OrbitControls=視点、TransformControls=選択点のドラッグ)。shojiが既に習熟している
  操作方式を再利用し、学習コストを避ける。
- Lock対象(Evidence A+)の点はTransformControlsを無効化し、色をグレーアウトして
  ドラッグ不可を視覚的に明示する。

## 3. データモデル(Pending Approval)

### 3.1 座標系

**Band Loop Editorローカル座標系**(Global/Shaft座標系とは非接続)。原点・軸向きは
Editor内でのみ意味を持つ暫定フレームとし、Phase1では原点をBridge-side End(t=0相当)
に仮置きする。**Coordinate Integration(Tier C課題)を先取りして解決しようとしない**
(Soft_Clip_Geometry_Improvement_Phase_v1_Freeze_v1.0.md §5と同じ理由)。

### 3.2 Control Point構造

単一の順序付き配列。「つ」字状の単一連続鎖(Interpretation §4-5-A、Topology
Candidate A、Strongly supported)を前提に、固定数ではなく**機能的カテゴリ**で
表現する(既存文書の一貫した方針を踏襲)。

```js
{
  id: "cp_lower_arm_start",       // 安定キー
  functionalRegion: "LowerArmStart", // enum(下記参照)
  position: { x: 0, y: 0, z: 0 }, // mm、Band Loop Editorローカル座標
  locked: false,                  // true = Evidence A+、ドラッグ不可
  evidenceLevel: "Provisional",   // "A+" | "A" | "B" | "Provisional" | "Unknown" | "Hypothesis"
  note: "旧M1。M3→M1: 1.50–1.73mm(視点2方向、Measurement v1.9)",
  removable: false,               // 固定スロットはfalse、可変グループ点はtrue
  pocketParams: null              // PocketEntrance/PocketDeepestのみ使用(§3.3)
}
```

**functionalRegion enum**(固定スロット5 + 可変グループ3):

| enum値 | 種別 | Evidence | 備考 |
|---|---|---|---|
| `BridgeEnd` | 固定1点 | Topology: B / Position: Unknown | 単一鎖の一端 |
| `LowerArmStart` | 固定1点 | Provisional(旧M1) | |
| `LowerArmCurve` | 可変(0〜n) | Hypothesis | 主要曲率変化点(見立てでは約3回) |
| `PocketEntrance` | 固定1点 | 位置=Hypothesis、内部params=A+(Lock) | |
| `PocketDeepest` | 固定1点 | 位置=Hypothesis、内部params=A+(Lock) | |
| `RearFlexCurve` | 可変(0〜n) | Hypothesis | |
| `UpperArmCurve` | 可変(0〜n) | Hypothesis | |
| `HookTransitionStart` | 固定1点 | Unknown(旧M2、固定点として不採用済み) | Phase2でHook Transition Profileパラメータに拡張 |
| `TerminalEnd` | 固定1点 | 位置=Hypothesis、参照距離2.40mm(A)をヒント表示 | 単一鎖のもう一端 |

### 3.3 Pocket参照ジオメトリ

`PocketEntrance`/`PocketDeepest`の2点は他の点と同じくCenterline配列の一部
(自由に動かせる)だが、追加で以下のLock済みパラメータを保持し、中央ペインに破線の
簡易ファンネル形状として参照表示する(実際のGeometry実装[Pocket Phase1
Centerline Sweep]の再現ではなく、あくまで目安):

```js
pocketParams: {
  armGapMm: 0.75,      // locked, A+
  maxWidthMm: 1.40,    // locked, A+
  depthMm: 3.30,       // locked, A+
  source: "Soft_Clip_Geometry_Improvement_Spec_v1.0.md §1.4"
}
```

### 3.4 Profile(参照値、Phase1では編集対象外)

```js
profile: {
  bandWidthMm: 0.25,
  bandThicknessMm: 0.10,
  evidenceLevel: "A+",   // 上記§1「要確認事項」参照、shoji確認待ち
  locked: true
}
```

### 3.5 初期配置(Seed positions)

3D座標の実測はまだ存在しないため、初期状態は**目安の仮配置**(直線的または単純な
「つ」字ガイド形状)から開始する。画面初回表示時にバナー表示: 「初期値は目安の仮配置
です。全てHypothesisとして自由に再配置してください」。固定スロット点のみ生成し、
可変グループ(LowerArmCurve等)は初期0点(shojiが必要数を追加)とする。

## 4. JSON Export スキーマ(Pending Approval)

```json
{
  "schemaVersion": "1.0",
  "tool": "Soft_Clip_Geometry_Editor",
  "exportedAt": "2026-08-07T00:00:00Z",
  "coordinateFrame": {
    "type": "bandLoopLocal",
    "note": "Global/Shaft座標系とは未統合(Tier C Coordinate Integration課題)"
  },
  "profile": { "bandWidthMm": 0.25, "bandThicknessMm": 0.10, "evidenceLevel": "A+", "locked": true },
  "centerline": {
    "curveType": "CatmullRomCurve3",
    "controlPoints": [ { "...": "§3.2の構造そのまま" } ]
  },
  "referenceValues": {
    "terminalLengthMm": { "value": 2.40, "evidenceLevel": "A" }
  },
  "meta": { "editedBy": "shoji", "sessionNote": "" }
}
```

Phase1では`bridge`/`hook`(詳細パラメータ)フィールドは省略可能(将来のPhase2で
追加してもschemaVersionは1.xのまま拡張、破壊的変更にしない)。

## 5. 技術方針

- 単一HTML、Vanilla JS、React/TypeScript不使用(指定通り)。
- Three.js + OrbitControls + TransformControlsを`importmap`経由でCDN読み込み
  (`kurz_landmark_editor_tool_v2_2026-07-22.html`と同一パターン、jsdelivr CDN)。
- ビルドステップなし。`kurz-simulator`のVerification Order(Build/TypeCheck/Lint)は
  対象外(TypeScriptでもsrc/配下でもないため)。代わりの完了条件は「ブラウザで開いて
  Centerline編集→JSON Exportが動作すること」の手動確認とする。

## 6. Phase1完了条件(shoji指定範囲の再確認)

- ✅ Centerline編集(固定スロット8点相当+可変グループのドラッグ移動)
- ✅ Evidence表示(色分け+バッジ+出典note)
- ✅ JSON Export(コピー or ダウンロード)
- ❌ 曲率Handle/スライダー(②) — Phase2
- ❌ Hook詳細編集(③: 開始位置/長さ/曲率/方向) — Phase2(HookTransitionStart点の
  位置編集自体はPhase1に含むが、曲率・進入角の専用UIはPhase2)
- ❌ Bridge詳細編集(④: 位置/長さ/角度の専用UI) — Phase2(BridgeEnd点の位置編集
  自体はPhase1に含むが、長さ・角度の専用パラメータはPhase2)

## 7. Decision Points(shoji確認事項)

1. **Band Loop断面のEvidence区分(A+ vs A)** — §1「要確認事項」参照。A+扱いで
   進めてよいか。
2. **保存先**: 完成後のHTMLファイルの置き場所。推奨は`kurz_landmark_editor_tool_v2`
   と同様に**OneDriveプロジェクト直下**(kurz-simulator gitリポジトリ外、
   ビルド非対象の独立ツールとして)。`kurz-simulator/tools/`配下にgit管理する代替案も
   あるが、Frozen Layer(src/)との誤混同を避けるため非推奨。
3. **ファイル名**: 指定通り`Soft_Clip_Geometry_Editor_v1.html`でよいか。
4. **初期配置の生成方法**: §3.5の「単純なガイド形状」でよいか、それとも固定スロット
   点も含め完全に空(0,0,0)からshojiが配置する方が誤解を招かないか。
5. **コミット単位**: 本設計文書(docs)を先にcommit → 承認後にPhase1 HTML実装を
   別コミットとする、という分割でよいか。

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
