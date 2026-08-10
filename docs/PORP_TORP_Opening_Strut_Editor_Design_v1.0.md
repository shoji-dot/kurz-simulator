# PORP/TORP Head Plate — Opening/Strut Editor v1.3（Design Note）

**Status**: Implemented（v1.3、blank pageバグ修正済み・shoji実機再確認待ち）
**Date**: 2026-08-08
**位置づけ**: `PORP_TORP_Head_Plate_Geometry_Scope_Baseline_Audit_v1.0.md`の後続。shoji指示（2026-08-08）に
基づく対話的Editor実装。**コード変更なし（本番`ProsthesisModels.tsx`は非接続・非改変）**。

**shoji評価（2026-08-08）**: 「v1.1 → 実機確認へ進む: YES / さらに機能追加: NO / 本番Geometry変更: NO」。
ここから先はshoji自身が実機で「① 3点キャリブレーション → ② Baseline+写真の重ね合わせ確認 →
③ Opening形状が楕円+回転で表現可能か判断 → ④ Shaftとの構造的対応確認 → ⑤ Candidateを1要素ずつ調整」
という順序で確認する段階であり、Claude側での追加実装は行わない（詳細は末尾「実機確認手順」節）。

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

## 2026-08-08 追記: v1.1（shoji初回試用フィードバック反映）

shojiがv1でBaselineを目視で大まかに実物写真へ再配置(Candidate export)した結果、以下2点の
フィードバックがあった。

1. 「各々の開口部の形状・シャフトの位置が実物と違う」
2. 「下の小さい開口部からシャフトに繋がるスリットも表現する必要がある」

### 対応方針の確認

②は「新規Slit Primitiveを作らない」という当初方針の撤回ではなく、その方針の**延長**として
対応した。既存の3 Openingそれぞれと、Shaft(Collar境界、r=0.10mm、原点固定)との最短境界距離を
新たに計測・可視化する「Opening ↔ Shaft(Slit)」パネルを追加。新規Primitive・新規Topologyは
依然として追加していない。

**重要な訂正（shoji指摘、2026-08-08）**: 「hole2をShaftへ近づけることでスリットを表現できる」は
**確定事項ではなくHypothesis(仮説)**である。Opening↔Shaftの最短境界距離は**Slit candidate metric
（Slit候補指標）**に留め、これを**Slit width（実物のスリット幅）と同一視してはいけない**。理由:
実物が「Opening境界からShaftへ向かって細い残存材が伸び、その残存材の途中がSlit」という構造で
あった場合、単純な最短距離はOpening境界とShaft境界の間の距離を測っているに過ぎず、実物のSlit幅
そのものを表しているとは限らないため。どのOpeningがShaft方向の細い構造につながっているかは
写真からある程度見えてきているが、対応関係(hole2かどうか含む)自体もまだ実機でのBaseline+写真
重ね合わせによる確認待ちであり、本文書やEditor上の「hole2」という名指しも暫定的な作業仮説として
扱う。Evidence(caliper/cv2とも未取得)は現時点でN/A。

①のうち「シャフトの位置が違う」は、Photo Comparisonパネルの手動TransformControls操作が
無較正(目視のみ)であるため、写真の位置合わせ誤差自体が原因である可能性が高いと判断した。
そこで、手動ドラッグに代えて**3点キャリブレーション**を追加: 写真上でShaft(Boss)中心・Disc
長軸上端・下端の3点をクリック指定すると、BellTop()自身のEvidence A座標(Shaft=原点、
Disc長軸長=ry×2=3.60mm)のみを基準に相似変換(回転+均一拡縮+平行移動)を自動計算し、写真を
正確に位置合わせする。`Head_Plate_Local_Coordinate_v1.0.md`の画像較正値(cv2.fitEllipse由来)は
既知の不整合([[p4a_geometry_validation_report]]参照)があるため使用せず、BellTop()コード自身の
Evidence Aとの内部整合性を優先した。

①のうち「開口部の形状が違う」は、rx/ry/rotationが既にCandidate編集可能であるため追加実装は
行わず、キャリブレーション後の写真と照合しながらshojiが引き続き調整する運用とした。楕円+回転の
表現力で実物形状に十分近づけられない場合(非楕円形状であることが確認された場合)は、より自由な
境界表現(多角形/スプライン)の導入を別途検討する必要があるが、これは新規Topologyの追加に相当する
設計判断のため、shoji確認前には着手していない。

### その他の追加

- Candidateの初期値をshoji調整済みの値(2026-08-08 08:27 Export)へ更新(作業の継続性確保)
- Import JSONボタンを追加(Soft Clip Editorと同じ`schemaVersion`検証パターン)、Export/Importの
  往復編集に対応
- Shaft境界(cyan破線)を常時表示する参照リングを追加

## 2026-08-08 追記: v1.2（実機確認結果を受けたPolygon編集・Slit点挿入）

v1.1の実機確認手順①〜②までをshojiが実施(3点キャリブレーション実施、JSON添付)した結果、
「3つの開口部は単純な円や楕円ではない」と判明した(実機確認手順③のNO分岐)。これは事前に
Design Note v1.1で明記していた分岐条件そのものであり、想定内の展開である。あわせて
「下の小さい方の開口部からシャフトに繋がるスリットを、ポイントを指定して実物と同様の構造にしたい」
という要望があった。

### 対応内容

- **Candidate Shape Mode(楕円 / 多角形)**: 各Openingは引き続き楕円(数値編集)を既定とするが、
  「多角形(自由編集)」に切り替えると、3D View上に色付き球ハンドルが表示され、直接ドラッグして
  境界点を編集できる。多角形は**折れ線(straight segment)であり、スプライン補間はしない**
  (shojiが置いた点を忠実に反映するため。Catmull-Rom等の平滑化は、点間隔が不均一な場合に
  オーバーシュートし意図しない自己交差を生む懸念があったため採用しなかった)。楕円モードへ
  いつでも戻せる(点データは保持されるため多角形へ再度切り替え可能)。
- **Shaftへスリット点を追加ボタン**: 選択したOpeningを(必要なら自動的に多角形へ変換した上で)
  Shaftに最も近い境界点から、Shaft方向へ幅0.05mm(仮の初期値)の細い突起を4点挿入する。
  位置・幅は挿入後にドラッグで調整する前提。
- **Topologyへの影響**: `THREE.Shape` + `THREE.Path`(Hole) + `ExtrudeGeometry`という既存の
  メッシュ生成方式は維持している。変更したのはHoleの境界点をどこから取得するか(楕円の数式 vs
  shojiが配置した点列)のみであり、新しいメッシュ生成方式やPrimitive種別を追加したわけではない。
  この意味で「新規Topologyを追加しない」という当初方針の精神は保たれていると判断しているが、
  境界表現力が大きく拡張された(実質的に任意形状が可能)ことは事実であり、これは実機確認で
  shoji自身が「NO」と判断したことに基づく正式な方針転換である。
- **Baselineへの影響**: なし。Baselineは引き続き楕円のみで、`Object.freeze`によりコードレベルでも
  不変性を保証している。
- **距離計算・Diff表示・カメラPreset・Export/Import**: `boundaryPoints(hole, n)`という統一関数を
  通すよう内部をリファクタリングし、楕円/多角形いずれのモードでも既存のStrut Measurement・
  Opening↔Shaft(Slit candidate metric)・Diff表示・カメラPreset・Export/Importがすべてそのまま
  動作するようにした(モード別の特別扱いを最小化)。多角形の頂点はExport JSONの
  `candidate.holeN.points`にそのまま含まれ、Import時も復元される。

### 実物構造との対応について(重要な留保)

「スリット点を追加」機能は、実物の構造を**確定的に再現するものではなく**、shojiが写真と照合し
ながら試行錯誤するための足場(仮の初期形状)を提供するだけである。[[feedback_visual_judgment_priority]]
の原則通り、最終判断は3D Viewer上でのshoji自身の目視確認による。挿入直後の初期形状(幅0.05mm、
Shaft境界の少し手前まで)にEvidence上の根拠はなく、完全にHypothesisとして扱う。

## 2026-08-08 追記: v1.3（Candidate Shaft位置の自由編集）

v1.2で開口部形状(多角形)の再現・スリット点挿入を実施した結果、shojiから以下のフィードバックが
あった。

1. 「各開口部の形状は上手く再現できた」(ポジティブ、対応不要)
2. 「スリット機能はOpening 2(hole2)でのみ必要だったが、hole2の(通常の)点と被って操作しづらかった。
   ただし目視した限りスリットは上手く入っているように見える」(UXの改善余地はあるが、致命的では
   ないため今回は未対応。将来、点が密集する箇所の選択性向上が必要になれば対応する)
3. 「シャフトの位置が実物と違っているので、Editor上でシャフトの位置を自由に編集できるようにして
   ほしい」(新規要望、本バージョンで対応)

### 対応内容

- **Candidate Shaft**: `candidateShaft = {cx, cy}`という新しいCandidate状態を追加。3D View上に
  マゼンタの球+破線リング(Shaft Collar径 r=0.10mmの目安)として表示され、Opening境界点と同じ
  ドラッグ機構で自由に移動できる。左パネルにcx/cyの数値入力も用意した。
- **Baseline Shaftとの関係**: Baseline Shaftは引き続き原点(0,0)固定・Evidence Aのまま不変
  (cyan破線リング)。Candidate Shaftは独立した新しい可動マーカーであり、Baseline側やOpeningの
  座標系(原点・キャリブレーション基準)そのものを再定義するものではない。写真キャリブレーション
  (3点)は引き続きShaft=原点(0,0)を前提とした変換のままである。
- **Opening↔Shaft距離への反映**: `computeShaftDistances(holes, shaftRef)`を、固定のBaseline用
  `SHAFT_REF`と可動のCandidate用`candidateShaftRef()`のいずれかを受け取れるよう変更。Baseline列は
  従来通り原点基準、Candidate列はCandidate Shaftの現在位置基準に変わる。
- **Candidate群の3D表示への反映**: `buildPlateGroup()`に`shaftPos`引数を追加し、Candidate側の
  Pin/Collar(3Dシリンダー装飾)もCandidate Shaft位置に追従して描画されるようにした(Baseline側は
  常に原点のまま)。
- **Export/Import**: `candidateShaft`をExport JSONに追加(`schemaVersion`は1.2、`tool`名は
  Editor v1.3に更新)。旧schema(candidateShaftを含まないJSON)をImportした場合は原点(0,0)として
  扱う後方互換処理を実装。

### P4C-0との境界(重要な確認事項)

Candidate Shaftの編集は**真上0°平面内でのXY位置(2D)のみ**であり、Head Plate Normal・Shaft Axis
という**3D方向・姿勢**の話には一切踏み込んでいない。P4C-0(Blocked/Deferred)の対象はあくまで
Z軸(Normal)の確定であり、本変更はその範囲に影響しない。HTML側のバナー・Scope説明文にもこの
区別を明記した。

## 2026-08-08 緊急修正: v1.3で白紙(blank page)になる致命的バグ

shoji報告: 「HTMLを開いても何も出てこない。JSONを読み込みしても何も出てこない」。

### 原因

v1.3で追加した`rebuildCandidateShaftMarker()`の初回呼び出しを、関数定義の直後(モジュール
上部、Scene構築直後)に置いていた。この関数は内部で`viewMode`変数を参照するが、`viewMode`は
`let viewMode = 'candidate';`としてモジュール下部の「View mode」セクションで初めて宣言される。
JavaScriptの`let`は宣言前にアクセスするとTemporal Dead Zone(TDZ)により
`ReferenceError: Cannot access 'viewMode' before initialization`を投げる。ESモジュールの
トップレベル同期コードで例外が発生すると、そこでモジュール全体の実行が停止し、以降の
`renderer`構築・`animate()`呼び出し・全イベントリスナー登録が一切実行されないため、
画面は完全に白紙になる。JSON Import機能もこの時点で配線されていないため、当然反応しない。

### 修正

問題の即時呼び出しを削除し、ファイル末尾の「Init」セクション(`viewMode`宣言より後、かつ
DOM/three.jsのセットアップが全て完了した後)で`rebuildCandidateShaftMarker()`と
`updateShaftFieldsUI()`をまとめて呼び出すよう変更した。

### 再発防止のための検証強化

今回のバグは`node --check`(構文検査のみ)では検出できない**実行時**エラーだったため、新たに
Node.js上でthree.js/DOM APIを最小限モック化した検証ハーネスを作成し、
①モジュールのトップレベル同期コードが例外なく完走するか、②主要なUI操作(表示モード切替・
Reset・Export/Import・写真キャリブレーションボタン・全Camera Preset・Shaft数値入力)を
実際にイベント発火してエラーが出ないか、③shojiが実際にアップロードしたJSONでImportが
成功するか、を機械的に検証できるようにした。今回のTDZバグをこのハーネスで実際に再現・
検出できることも確認済み(修正前のコードに対して`ReferenceError: Cannot access 'viewMode'
before initialization`を正しく検出した)。今後のバージョンアップ時もこのハーネスでの
事前検証を行う。

## 2026-08-10 追記: Candidate Shaft位置チェックポイント

shojiが写真と照合してCandidate Shaftを`(cx=0.15, cy=0.43)`へ移動したJSONを共有(機能追加依頼では
なく進捗共有)。EditorのCandidate初期値をこの値へ更新した(Opening形状側は前回から変更なし)。

参考: この移動によりOpening↔Shaft(Slit candidate metric)のCandidate列は
`h1-shaft=0.107mm / h2-shaft=0.0009mm(ほぼ接触) / h3-shaft=0.230mm`となった。hole2のスリット
突起がShaft境界にほぼ接触する結果になっており、「hole2からShaftへ繋がるスリット」という意図と
整合する形になっている(あくまでCandidate上の幾何学的観察であり、Evidence Aへの昇格ではない)。

## 実機確認手順（shoji指定、2026-08-08。次に行うのはこれのみで、追加実装ではない）

Editorへの機能追加はここでいったん停止し、以下の順でshoji自身が実機確認する。目的は
「現行Geometryが本当に悪いか」ではなく、「キャリブレーション後の写真とBaselineを重ねたとき、
どこが実際に違って見えるか」を具体的に特定すること。

1. **3点キャリブレーション**: `真上0°.jpg`を読み込み、①Shaft/Boss中心 ②Disc長軸上端
   ③下端をクリック。ここではGeometryの正しさではなく、**写真とBaselineの座標系が本当に
   重なるか**を確認する(Shaft中心・外形・長軸方向・上下位置・スケールが自然に一致するか)。
   ここが合わなければ、以降のOpening比較は信用しない。
2. **Baseline + calibrated photoを重ねる**(Candidateは一旦見ない): hole1/hole2/hole3それぞれ
   について中心位置→外形→縦横サイズ→回転→境界の順で見る。「開口部の形状が違う」という
   最初の感覚がキャリブレーション後も残るか確認する。
3. **3つのOpeningを個別に確認**: 楕円+回転だけで実物のOpeningを表現できるか判断する。
   YESなら現在のEditor構造で十分。NOなら初めてpolygon/splineをCandidate Geometryとして
   検討する(現状はProduction変更ではなくEditorの表現力の問題として扱う、新規Topology相当の
   判断のため要shoji確認)。
4. **Shaftとの構造的対応を見る**(特にhole2): 「Opening↔Shaft(Slit)」の数値そのものより、
   写真上でOpeningからShaftへ向かう実際の構造と、Editor上のGeometryが同じ構造に見えるかを
   見る(上記の通りこの数値はSlit candidate metricであり、Slit widthと同一視しない)。
5. **その後にCandidateを触る**: 一度に3つとも動かさず、hole2だけ/hole1だけ/hole3だけ、と
   1要素ずつ変更し、どのOpeningの変更がstrutの見え方を変えているかを分離して観察する。

**この確認で得られる分解**: 3 Opening → Opening間の残存材(hole↔hole) → Shaftとの残存材
(hole↔Shaft)、という形でGeometry関係そのものを評価でき、「Slit」という曖昧な言葉に
引っ張られずに済む。

**変更しないもの**: この実機確認の結果「Candidateの方が自然」と判断されても、本番`BellTop()`は
今回変更しない。CandidateはExportして「Candidate Proposal」として残すに留め、以降は
Soft Clipで確立した手順(Visual Judgment→Evidenceとの整合→必要なら追加写真・実測→
Revision Proposal→本番変更)に従う。

## 未検証事項

- 実ブラウザでのランタイム動作確認（sandbox制約でWebGL headless検証が完走せず、構文検査
  (`node --check`)とコードレビューのみで代替）。shoji側での実機確認を推奨。
- Pin/Collarの3D配置は本番`BellTop()`のワールド回転（`rotation={[Math.PI/2,0,0]}`）を再現して
  いない（本Editorのスコープが2D XY平面上のOpening/Strut分析であるため、意図的に簡略化）。
  定量的な分析対象（Opening位置・サイズ・Strut距離）には影響しない。
- 3点キャリブレーション機能(Raycaster+クリックpicking)は特にsandboxでの実機検証ができておらず、
  ロジックレビュー(HTML id突き合わせ・構文検査)のみで代替した。写真読み込み→3点クリック→
  キャリブレーション実行の一連の操作感はshoji側での実機確認が必要。
- （v1.2で解消）楕円+回転で実物Opening形状を十分に近似できるかは、shojiの実機確認で
  「不十分」と判明したため多角形モードを追加した。
- （v1.2新規）多角形ハンドルのドラッグ操作は、OrbitControlsとのポインタイベント競合を避けるため
  `{capture:true}`でイベントを先取りし、ハンドルを掴んだ場合のみ`stopPropagation`する設計にして
  いるが、実ブラウザでの動作(特にOrbitControlsの回転開始と誤って同時発火しないか)は未検証。
- （v1.2新規）「Shaftへスリット点を追加」で挿入する幅0.05mmの細い矩形突起が、
  `ExtrudeGeometry`(earcut三角形分割)で正しく単純多角形として処理されるか、退化・自己交差を
  起こさないかは未検証。挿入直後に3D Viewで目視確認することを推奨。
- （v1.3新規）Candidate Shaftのドラッグは既存のOpening点ドラッグと同じraycaster/pointer機構を
  共用しているが、点ハンドルとShaftマーカーが近接した場合の選択優先順位(`intersectObjects`の
  ヒット順)は未検証。
- （v1.3新規）hole2の点密集によるドラッグ操作のしづらさ(shoji報告)は今回未対応。将来、密集時の
  選択性向上(例: ズーム連動のハンドルサイズ調整、数値リストからの直接編集)が必要になれば検討する。

## 参照文書

- `docs/PORP_TORP_Head_Plate_Geometry_Scope_Baseline_Audit_v1.0.md`
- `docs/Head_Plate_Local_Coordinate_v1.0.md`
- `src/scenes/models/ProsthesisModels.tsx`（`BellTop`: 289-347、非改変）
