# PORP/TORP Head Plate — Opening/Strut Editor v1.0（Design Note）

**Status**: Implemented（shoji確認待ち）
**Date**: 2026-08-08
**位置づけ**: `PORP_TORP_Head_Plate_Geometry_Scope_Baseline_Audit_v1.0.md`の後続。shoji指示（2026-08-08）に
基づく対話的Editor実装。**コード変更なし（本番`ProsthesisModels.tsx`は非接続・非改変）**。

---

## 方針転換（重要）

当初想定していた「Slitという独立Geometryを追加する」という考え方を修正した。今回対象とする
Slit/切れ込み状構造は、独立したPrimitiveではなく、**3 Openingの形状・位置によって形成される
残存材（strut）**として扱う。したがって新規Slit Primitive・新規Topologyは追加せず、現行`BellTop()`
のShape + 3 Holes構造をBaselineとして維持し、Candidateではhole1/hole2/hole3の形状・位置を変更した
結果として生じるstrutを評価する。

## 実装ファイル

`PORP_TORP_HeadPlate_Opening_Strut_Editor_v1.html`（OneDrive直下、kurz-simulator git外。
Soft Clip Geometry Editorと同じ配置・単一HTML・three.js CDN importmap方式）。

## Baseline（Evidence A、`BellTop()` / `ProsthesisModels.tsx:289-347`から転記・不変）

| 要素 | cx | cy | rx | ry |
|---|---|---|---|---|
| 外形Disc | +0.14 | −0.24 | 1.30 | 1.80 |
| hole1（Upper） | +0.14 | +0.955 | 0.64 | 0.295 |
| hole2（Lower-Left） | −0.54 | −0.89 | 0.37 | 0.65 |
| hole3（Lower-Right） | +0.69 | −0.525 | 0.49 | 1.035 |

固定ピン・Collar・押し出し厚(0.10mm)も含めてBaselineとして固定表示（Candidate編集対象外）。
`Object.freeze()`によりコードレベルでもBaselineの不変性を保証している。

## Evidence A / Provisional の分離

| Pair | Evidence A(caliper) | Provisional(cv2, 2026-08-08) | 出典 |
|---|---|---|---|
| hole1↔hole3 | **0.15mm** | 約0.50mm | コード内コメント「Strut below hole1」/ 今回cv2解析 |
| hole2↔hole3 | **0.37mm** | 約0.20mm | コード内コメント「Strut to hole3」/ 今回cv2解析 |
| hole1↔hole2 | 記載なし(N/A) | 約0.21mm | — / 今回cv2解析 |

Provisional値はEvidence Aへ自動昇格しない。UI上は常時「Provisional / Photo-derived」バッジで
区別表示し、既存Evidence A値を上書き・混同しないよう設計した。

## Opening間距離の計算方法

現行`ellipsePoints()`（axis-aligned ellipse、production同一ロジック、rotation=0で完全一致）を
高解像度(N=360点)でサンプリングし、2つの楕円境界点集合間のbrute-force最短距離を算出する
（O(N×M)、実測で数ms程度、リアルタイム編集に十分な速度）。新規のGeometry表現・解析手法は
導入せず、既存のポリゴン近似方式をそのまま流用している。

## Candidate Opening Editor

hole1/hole2/hole3それぞれについて cx / cy / rx / ry / rotation(度) を編集可能。rotationは現行
`ellipsePoints()`に存在しないパラメータだが、同一のEllipse→Path→Hole→ExtrudeGeometryパイプライン
内で完結する最小拡張（新規Topology・新規Primitiveではない）として追加した。Baselineでは常に
rotation=0固定であり、Candidateのみの探索用パラメータである旨をUI上に明記している。

## Baseline / Candidate分離・Visual Inspection

- 表示モード: Candidateのみ / Baselineのみ / Overlay(半透明重畳) / 左右比較
- Overlay時のみ「Difference表示」（変化した開口のBaseline輪郭を赤破線で重畳）
- Camera Presetボタン: 3 Opening全体 / 真上ビュー(写真比較用) / 各Opening Close-up ×3 /
  各Strut拡大(hole1↔hole2, hole1↔hole3, hole2↔hole3) ×3
- CandidateはBaselineの状態を一切変更しない（`Object.freeze`済みBaseline定数とは独立した
  ミュータブルな`candidate`オブジェクトとして分離管理）

## Photo Comparison

Soft Clip Geometry Editorと同じ`FileReader`+`PlaneGeometry`+`TransformControls`方式を再利用。
キャリブレーションは行っていないため位置合わせは目視のみであり、UIバナーで「Photo Overlay =
Geometry Correctness ではない」旨とパース・照明・輪郭抽出誤差の影響を明記している。

読み込み推奨ファイル: 元の「真上0°」較正写真（今回セッションの一時uploadsには残っていないため、
shojiの手元ファイルから都度読み込む運用。参考として`docs/analysis/headplate_frame_annotated.jpg`
（Head_Plate_Local_Coordinate_v1.0.mdで使用した同一写真のcv2解析アノテーション出力）が
OneDrive上に存在する）。

## Scope外（P4C-0との分離）

Head Plate Normal / Shaft Axis / Coordinate Integration / 本番`ProsthesisModel`コンポーネントには
一切触れていない。本Editorはこれらをimportせず、完全にスタンドアロンのロジック再実装である。

## 設計思想

本Editorは「現行Geometryが間違っていることを証明するTool」ではない。Evidence Aで確定している
現行GeometryをBaselineとして保持し、3 Openingの局所形状・配置をCandidateとして探索し、結果として
形成されるstrutが実物としてより自然になる可能性を検討するTool。Editor使用の結果「Baselineのまま
で十分」という結論になっても正常である。Candidateで良い値が見つかっても自動的にEvidence Aへ
昇格しない（Export JSONにも`status: unverified-candidate`を明記）。

## 未検証事項

- 実ブラウザでのランタイム動作確認（sandbox制約でWebGL headless検証が完走せず、構文検査
  (`node --check`)とコードレビューのみで代替）。shoji側での実機確認を推奨。
- Pin/Collarの3D配置は本番`BellTop()`のワールド回転（`rotation={[Math.PI/2,0,0]}`）を再現して
  いない（本Editorのスコープが2D XY平面上のOpening/Strut分析であるため、意図的に簡略化）。
  定量的な分析対象（Opening位置・サイズ・Strut距離）には影響しない。

## 参照文書

- `docs/PORP_TORP_Head_Plate_Geometry_Scope_Baseline_Audit_v1.0.md`
- `docs/Head_Plate_Local_Coordinate_v1.0.md`
- `src/scenes/models/ProsthesisModels.tsx`（`BellTop`: 289-347、非改変）
