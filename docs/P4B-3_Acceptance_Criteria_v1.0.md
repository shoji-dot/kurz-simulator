# P4B-3 Acceptance Criteria v1.0

P4B-3（新Pose Solverの本番`ProsthesisModel`/`CartilageSlice`への段階的配線）着手前に、
「何をもって完了とするか」を1ページで固定するための文書。2026-07-28、shojiさんとの合意に基づき作成。
`docs/PoseModelBaseline.md`・`docs/Pose_Design_Constraints_v1.0.md`と同種の運用（実装着手前の
基準固定、コード変更は伴わない）。

## 前提条件（本文書より上位、変更不可）

- **`docs/PoseModelBaseline.md` §4（2026-07-22、shojiさん決定）**: `ProsthesisModel`と
  `CartilageSlice`は同一の姿勢生成方式（`CurrentAxisAlignmentModel`）を独立実装しており、
  「片方だけ先行させると、PORPはTM基準・Cartilageは旧UMBO基準という教育上危険な不整合が
  生じる」ため、Pose Solver移行時は**両者を同時に**変更する。これは実装方針ではなく設計原則
  であり、P4B-3のスコープ・スケジュールより優先する。
- P4B-3の対象は`solvePose()`→`composeTwist()`の2層（Forward/Twist確立）まで。`composeNormal()`
  （Head Plate Normal確定後に追加）はP4C（Z軸Evidence取得）の範囲であり、P4B-3では実装しない。

## Acceptance Criteria

1. **Prosthesis/Cartilage同一Poseモデル**
   `ProsthesisModel`と`CartilageSlice`が同一のPose生成経路（`solvePose()`→`composeTwist()`）を
   共有していること。独立実装の重複が残っていないこと。
   判定方法: コードレビュー（両コンポーネントが同一関数を呼んでいるかgrep確認）。

2. **Feature Flag同時切替**
   `POSE_SOLVER_V2`のON/OFFで、Prosthesis・Cartilage双方が同時にOLD/NEWへ切り替わること。
   一方だけがNEWでもう一方がOLD、という中間状態にユーザーが到達できないこと。
   判定方法: Flag ON/OFF両方の状態でGUI目視確認（Prosthesis・Cartilage両方の見た目が
   一致して切り替わるか）。

3. **Shadow比較は本番実出力を基準とする**
   Shadow Integration（Phase A）の比較対象は、Debug Overlay側の再現実装（`bellMarkers`等）
   ではなく、`ProsthesisModel`/`CartilageSlice`本体が実際に描画に使っている値そのものである
   こと。本番実出力とは、`ProsthesisModel`/`CartilageSlice`が描画に使用する最終的な
   Position・Quaternion（内部途中計算やThree.jsへ渡す直前の値ではなく、meshへ適用される
   値そのもの）を指す。
   判定方法: コードレビュー（比較用OLD値の取得元が本体コンポーネントの実出力であることを
   確認）。

4. **Debug OverlayでOLD/NEW差分を確認可能**
   Position差・Quaternion差（Forward Error/Twist）・Shaft差・Bell差を`?debug=coords`限定で
   数値表示できること（既存のPose Comparison Overlayを拡張する形でよい）。
   判定方法: GUI確認。

5. **15症例でSafety Engineに回帰がないこと**
   15症例全てでNEW Pose適用時に`computeSafety`の判定結果（safe/warning/danger）がOLD時と
   意図せず変化しないこと。変化する場合は原因（Pose自体の違いか、Safety Engine側の問題か）を
   切り分けて記録すること。
   判定方法: 15症例をNEW/OLD双方で実行し、Safety判定結果を比較する検証スクリプトまたは
   手動確認ログ。

6. **P4A Evidenceを変更しないこと**
   `Head_Plate_Local_Coordinate_v1.0.md`で確定したOrigin/X軸/Y軸のEvidence、および
   `P4A_Geometry_Validation_Report_v1.4.md`の内容に対し、P4B-3のPose Solver配線が変更・
   再解釈を加えないこと（P4B-3はGeometry Validationではなく実装統合のフェーズ）。
   判定方法: レビュー（P4B-3の変更差分がdocs/配下のP4A系文書に触れていないことを確認）。

7. **`composeNormal()`未実装時点でも従来仕様と整合すること**
   Z軸（Head Plate Normal）が未確定のため、Forward/Twistのみで構成した現行のNEW Poseは、
   raw Forward（umbo方向）を旧`CurrentAxisAlignmentModel`と共通の基準とすること（TM基準への
   再照準はP4Cで`composeNormal()`導入時に行う）。P4B-3の時点でOLD/NEWの差はPose合成方式の
   違い（Euler加算 vs 2軸拘束）に限定され、基準軸自体の変更によるものではないこと。
   判定方法: P4B-0のRoot Cause Analysis結果（`docs/Pose_Design_Constraints_v1.0.md`
   P4B-0節）との整合確認。

8. **将来の`composeNormal()`追加が両コンポーネント個別修正を必要としないこと**
   Pose生成経路が`ProsthesisModel`/`CartilageSlice`間で共通化されているため、P4Cで
   `composeNormal()`を追加する際、共通のPose Solver呼び出し1箇所を変更するだけで両方に
   反映されること（今回の3層API分離の価値を将来へ引き継ぐための条件）。
   判定方法: コードレビュー（呼び出し箇所が1つに集約されているか）。

## スコープ外（P4C以降）

- Head Plate Normal（Z軸）のEvidence A/A+取得
- `composeNormal()`の実装
- `idealAngle`の医学的根拠の再定義（`PoseModelBaseline.md` §2、既知の別課題）

## 参照文書

- `docs/PoseModelBaseline.md`（§3〜4: Cartilage重複実装・同時移行の決定）
- `docs/Pose_Design_Constraints_v1.0.md`（P4B-0〜P4B-2の進捗、Z軸保留の扱い）
- `docs/Head_Plate_Local_Coordinate_v1.0.md`（P4A確定Evidence）
