# FlatFoot Geometry Improvement Specification v1.0

**Status**: G3-2 Implemented v3(最終、2026-07-30)。`FlatFoot()`(`ProsthesisModels.tsx:609`)を
単純な貫通型中空円柱(外殻+内殻、`cylinderGeometry`openEnded)へ実装。v1(外殻が誤って円錐台)
→v2(LatheGeometryでテーパー・面取り・内部キャップを再現)といずれもshojiさんのGUI確認で
差し戻しになり、v3で「テーパー・面取りの厳密再現はスコープ外、実物は単純な中空円柱+上面
中央のシャフト接続」という最終方針に確定(§8.0参照)。Build/TypeCheck/Lint/Review/Clinical
Validation(Verification Order)完了、GUI再確認待ち。
**Date**: 2026-07-30
**位置づけ**: `docs/Prosthesis_Geometry_Audit_Plan_v1.0.md` Phase G3-1。
`docs/TORP_SoftClip_Geometry_Audit_v1.0.md`(G1-3)・`docs/Prosthesis_Reference_Geometry_Definition_v1.0.md`
(G2)で確認済みの通り、TORP `FlatFoot()`のVisual Mesh寸法は実測(Evidence A+)と乖離している
ことが発端。§1-7が仕様(Decision Confirmed)、§8がG3-2実装記録。

**スコープ限定(shoji指定)**: 対象は`FlatFoot()`(`ProsthesisModels.tsx:609-624`)の
Visual Meshのみ。Soft Clip(`PistonFoot`/`SoftClipHead`)は優先度が低いため後回し
(Contact Landmarkが既に「ほぼ整合」と確認済みのため)。着手順: ①FlatFoot → ②Soft Clip →
③PORP Bell微調整(必要なら)。

---

## 1. Current Geometry(現状、変更前)

`FlatFoot()`(`ProsthesisModels.tsx:609-624`):

```tsx
function FlatFoot({ ghost }: { ghost?: boolean }) {
  return (
    <group>
      {/* Tapered terminal cylinder (cannulated end) */}
      <mesh>
        <cylinderGeometry args={[0.24, 0.18, 0.42, 16]} />
        <TitaniumMat ghost={ghost} />
      </mesh>
      {/* Hollow interior */}
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.28, 8]} />
        <meshStandardMaterial color="#050810" transparent opacity={ghost ? 0.0 : 0.90} />
      </mesh>
    </group>
  );
}
```

- 外側: 単純円柱(radiusTop=0.24, radiusBottom=0.18, height=0.42)、原点中心に対称配置。
- 内側(中空表現): 半透明の暗色円柱(radius=0.09均一, height=0.28)、position y=-0.08で
  下寄りにオフセット。
- 実測・スケール係数の記載コメントなし(`Prosthesis_Geometry_Audit_Plan_v1.0.md` ⑥の分類で
  Unknown〜C相当と判定済み)。

## 2. Evidence A+ Measurement(実測値、変更の根拠)

shojiさんによる20倍模型ノギス実測(2026-07-30、`docs/TORP_SoftClip_Geometry_Audit_v1.0.md` §1.1
と同一データ):

| 項目 | 20倍模型実測値 | 実寸換算(÷20) |
|---|---|---|
| 高さ | 16.0 mm | 0.80 mm |
| 開口部厚み(壁厚) | 2.0 mm | 0.10 mm |
| 内径 | 11.8 mm | 0.59 mm(半径0.295mm) |
| 外径 | 15.8 mm | 0.79 mm(半径0.395mm) |

構造補足(shoji確認事項、定量値なし):
- 下面(アブミ骨底板側)は開口構造。
- 天井付近(シャフト側)はテーパー形状。
- 円柱上部縁(天井側)には面取りあり。

**Evidence Gap(明示)**: テーパーの度合い(天井側での径の縮小量)・面取りのサイズは定性的な
確認のみで、定量値は未取得。§3で扱う。

## 3. Target Geometry(改善目標)

### 3.1 確定パラメータ(Evidence A+、そのまま採用)

| 項目 | 現行コード値 | Target(実寸) | Evidence |
|---|---|---|---|
| 全高 | 0.42 mm | **0.80 mm** | A+ |
| 開口部 外径(半径) | 0.24/0.18 mm | **0.395 mm** | A+ |
| 開口部 内径(半径) | 0.09 mm | **0.295 mm** | A+ |
| 壁厚(開口部) | 約0.09-0.15mm(位置依存) | **0.10 mm(均一と仮定)** | A+(開口部のみ実測、天井側は未実測につき同一仮定) |

### 3.2 未確定パラメータ(Evidence Gap、要決定)

| 項目 | 現状の扱い | 決定が必要な理由 |
|---|---|---|
| 天井側(シャフト接続部)の外径 | 未定 | テーパーの終端値が未実測。現行コードのradiusTop(0.24)相当にあたる値が不明 |
| テーパー形状(直線/曲線) | 未定 | 「やや」テーパーという定性的表現のみ |
| 上部縁の面取りサイズ | 未定 | 定量値なし |
| 天井側の壁厚 | 開口部と同一(0.10mm)と仮定 | 未実測。テーパーに伴い変化する可能性 |

**決定(shoji、2026-07-30)**: **Option 1(追加実測)を採用**。理由: 今回のFlatFoot改善の
目的は見た目修正ではなく「簡略Geometry→Evidence A+ベースのReference Visual Geometry」への
移行であり、`BellFoot()`で確立した「実測値→Geometry定義」という品質基準をTORPにも揃える。
特に単純円柱→釣り鐘型中空構造への変更であるため、天井側形状(未確定パラメータ)がモデル
品質を左右する。

追加実測が必要な項目は`docs/FlatFoot_Measurement_Record_v1.0.md`に整理した(shoji測定待ち)。
測定完了までG3-2(実装)には着手しない。

### 3.3 構造(中空・開口)

- 現行の「外側ソリッド円柱+内側の半透明円柱で穴を表現」という手法(2メッシュ構成)は、
  実物の「壁厚0.10mmの中空シェル」を正確に表現できていない(内側円柱がただの色付き
  塗りつぶしであり、真の貫通穴・開口端面を表現しない)。

**決定(shoji、2026-07-30)**: **`BellFoot()`と同じLatheGeometry方式を採用**
(`ProsthesisModels.tsx:507-602`の`outerProfile`/`innerProfile` + `THREE.LatheGeometry`
パターンを再利用)。外殻・内殻を正しい壁厚(0.10mm、天井側は追加実測後に確定)でオフセット
した回転体として構築する。下面(Y=0付近、開口)は開いたままにし、上面付近はテーパーして
閉じる(またはシャフト接続部として別途処理)。現行の「暗色半透明シリンダーで穴を表現する」
トリックは廃止する。

理由(shoji整理): ①FlatFootは円形・中空・テーパー・面取りという回転対称形状であり
LatheGeometryが本来の対象。②PORP(`BellFoot`、LatheGeometry、Evidence A)とTORP
(`FlatFoot`)のGeometry実装方式を揃えることで、Reference Geometry思想をPORP/TORP間で
統一できる。③将来KURZ CAD/3D Scan/追加実測が入った場合、変更点が「Profile data更新」に
限定される(実装方式そのものの作り直しが不要)。

## 4. Reference Coordinate(原点・Anchorとの関係)

**変更しない**: Foot group のローカル原点(0,0,0)は Anchor(`base` = `STAPES_FOOTPLATE`)と
一致する Pose Solver 上の基準点であり、これは`docs/Prosthesis_Reference_Geometry_Definition_v1.0.md`
§2で確定済み(Local Coordinate上の基準点として定義、G2-Reviewで確定)。**G3ではこの原点位置
そのものを動かさない**。

**Decision Point(要確認)**: 新しいVisual Mesh(§3)を原点に対してどう配置するか。

- **案A(現状踏襲)**: 現行同様、メッシュを原点を中心に対称配置する(「Anchor = foot中央」
  というOption A決定([[p4_transition_deferred_management]]、shoji 2026-07-30)を踏襲)。
  新しい高さ0.8mmなら、Y=[-0.4, +0.4]に対称配置。
- **案B(開口面を原点に合わせる)**: 実際の接触面(開口=底面)がY=0(Anchor位置)に来るよう、
  メッシュをY=[0, +0.8]に配置する。解剖学的には「Anchorがまさに接触面上にある」という
  より直感的な対応になるが、これまでの「Anchor=foot中央」という整理(Option A)からの
  変更を意味し、Visual Mesh変更のはずがReference側の解釈変更に波及する恐れがある。

**決定(shoji、2026-07-30)**: **案A(現状踏襲、foot中央Anchor維持)を採用**。理由:
①G2で確定した「Anchor = Prosthesis Local Coordinate上の基準点」を守るため。②案Bを採用
すると、PORP Bell/TORP Flat/Soft Clip PistonでAnchor定義の意味が分裂し、Pose Solver
Adapter側の意味変更にもつながる。現在の設計(Reference GeometryとVisual Meshの分離)では
避けるべき。

## 5. Non-goals(今回変更しないもの、明記)

- `computeCurrentAxisAlignmentOrientation()` / `computeCurrentAxisAlignmentPose()` /
  `computeProsthesisModelPose()`(Pose Solver、`ProsthesisModels.tsx:739-846`)
- Pose Anchor定義(`base` = `STAPES_FOOTPLATE`)・Shaft Axis定義・Head Plate Reference
  (`docs/Prosthesis_Reference_Geometry_Definition_v1.0.md` §2-4)
- §7-6(Pose Anchor tilt挙動、Model A/Design Decision Pending)— 別スコープ、今回のFlatFoot
  Visual Mesh変更では触れない
- Safety Engine / `dangerZonePoint`計算
- `footOff`/`headOff`の値・Product/Adapter層(`products.ts`のheadType/footType割り当て)
- Soft Clip(`PistonFoot`/`SoftClipHead`)・PORP(`BellFoot`)— 別Phaseで扱う

## 6. Compatibility Constraints(実装時の確認事項、G3-2用)

Small Change原則(Project Instructions)に基づき、`FlatFoot()`関数の内部実装のみを変更し、
呼び出し側(`ProsthesisModel`の`<group position={[0, footOff, 0]}>`内での使用箇所)は無変更
とする。

実装後、以下を確認する(Verification Order: Build → Type Check → Lint → Review →
Clinical Validation):

1. **Anchor位置不変**: Foot group原点のworld座標が実装前後で変化しないこと(`base`との
   関係は§7-6のtilt挙動を含め無変更)。
2. **Shaft Axis不変**: `computeCurrentAxisAlignmentOrientation()`の出力が実装前後で
   ビット単位一致すること(FlatFoot()はこの関数を呼ばないため、通常は自明に無変更)。
3. **Pose結果不変**: `computeProsthesisModelPose()`の出力(position/quaternion)が
   実装前後で不変であること。
4. **Safety Score不変**: `dangerZonePoint`関連の計算結果が実装前後で不変であること
   ([[coord_phase_implementation]]系で確立済みの「Pose非依存」性質を再確認)。
5. **Visual改善**: TORP症例で見た目のサイズ・形状がEvidence A+値に近づいていること
   (目視確認)。

### Regression確認対象(TORP 4症例)

`LandmarkMeasurements.md`に記載のTORP(FLAT)症例:

```
case-002
case-006
case-009
case-013
```

| 項目 | 期待結果 |
|---|---|
| Pose | 変化なし |
| Anchor | 変化なし |
| Safety | 変化なし |
| Visual | 改善(Evidence A+寸法に近づく) |

## 7. Next Step(履歴)

```
G3-1   FlatFoot Geometry Improvement Specification   (完了)
  ↓
G3-1.5 追加実測記録(docs/FlatFoot_Measurement_Record_v1.0.md)   (完了、shoji測定)
  ↓
G3-2   FlatFoot LatheGeometry Implementation          (完了、本文書§9)
```

## 8. G3-2 Implementation Record

### 8.0 実装の変遷(v1→v2→v3)

| version | 内容 | 結果 |
|---|---|---|
| v1 | 「テーパー開始位置: 天井中央半径2mm(実寸0.1mm)」という実測値を誤って**外殻**
  (outerProfile)に適用。LatheGeometry、outerProfileが7点のテーパー形状 | shoji GUI確認で
  差し戻し(「外形が円錐台になっている」) |
| v2 | 外殻/内殻を訂正: 外殻=円柱+天井面取りのみ、内殻(中空)側にテーパー・閉塞キャップを
  再現。LatheGeometry継続 | shoji GUI確認で再度差し戻し(「テーパー・面取りの厳密再現は
  スコープ外。実物はもっと単純」) |
| **v3(最終、採用)** | テーパー・面取り・内部キャップを一切再現せず、**単純な貫通型中空
  円柱**(外殻+内殻、`cylinderGeometry`、openEnded=true)へ簡略化 | 現行実装。GUI再確認待ち |

**教訓**: 実測メモの数値をどの面(外殻/内殻)へ、どの精度で適用するかは、GUI確認を経て
初めて確定した。教育用Visual Geometryでは「Evidence A+の主要寸法(全高・開口部外径/内径)を
正確に反映しつつ、細部形状(テーパー・面取り)は過剰に作り込まない」という原則が今回の
やり取りで明確になった。

### 8.1 最終実装(`ProsthesisModels.tsx`内`FlatFoot()`、v3)

```tsx
function FlatFoot({ ghost }: { ghost?: boolean }) {
  const OUTER_R = 0.395;  // 開口部外径(Evidence A+)、本体全体で一定
  const INNER_R = 0.295;  // 開口部内径(Evidence A+、壁厚0.10mmと整合)、本体全体で一定
  const HEIGHT  = 0.80;   // 全高(Evidence A+)

  return (
    <group>
      <mesh>
        <cylinderGeometry args={[OUTER_R, OUTER_R, HEIGHT, 24, 1, true]} />
        <TitaniumMatDS ghost={ghost} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[INNER_R, INNER_R, HEIGHT, 24, 1, true]} />
        <TitaniumMatDS ghost={ghost} />
      </mesh>
    </group>
  );
}
```

外殻・内殻ともテーパーなしの単純円柱(半径一定)、`openEnded=true`により上下端に蓋を作らず
貫通させる。シャフトとの接続は`ProsthesisModel`側の既存ロジック(シャフトメッシュを別途
描画)がそのまま担うため、`FlatFoot()`自身はスリーブ形状のみを担当すればよい(shoji整理:
「外形：円柱/内部：中空(上下貫通)/シャフト：円柱上面中央に接続」)。

### 8.2 Verification Order結果(v3、最終)

| ステップ | 結果 |
|---|---|
| Build | ✓(`vite build`、790 modules transformed、約26秒、エラーなし) |
| Type Check | ✓(`tsc --noEmit --project tsconfig.app.json`、エラーなし) |
| Lint | ✓(`eslint src/scenes/models/ProsthesisModels.tsx`、警告・エラーなし) |
| Review | ✓(diff scope確認、`FlatFoot()`関数内のみ22行追加・43行削除に限定。他関数への
  影響なし) |
| Clinical Validation | ✓(視覚のみの変更。Pose Anchor/Shaft Axis/Safety Engineに
  該当するコードへの変更なし。Node実行で外殻・内殻ともbounding boxが高さ0.80mm・半径一定
  (テーパーなし)であること、壁厚が0.10mmであることを数値検証) |

### 8.3 Regression確認(§6予定分)

- Anchor位置・Shaft Axis・Pose結果・Safety Score: `computeCurrentAxisAlignmentOrientation()`
  /`computeCurrentAxisAlignmentPose()`/`computeProsthesisModelPose()`および
  `dangerZonePoint`関連コードは一切変更していないため、構造的に不変(コードを直接変更して
  いないことがdiffで確認済み、v1/v2/v3を通じて一貫)。
- Visual確認(TORP case-002/006/009/013での目視確認): **shoji再確認待ち**(v3の単純化後の
  外観をGUIで再度ご確認いただく)。

## 9. 参照文書

- `docs/Prosthesis_Geometry_Audit_Plan_v1.0.md`(Phase G1/G2 Completed、G3全体位置づけ)
- `docs/TORP_SoftClip_Geometry_Audit_v1.0.md`(G1-3、実測値の出典)
- `docs/Prosthesis_Reference_Geometry_Definition_v1.0.md`(G2、Anchor/Reference定義、
  G2-Review含む)
- `docs/Prosthesis_Reference_Landmark_Definition_v1.0.md`(G1-1/G1-2、Option A決定の出典)
- `src/scenes/models/ProsthesisModels.tsx`(`FlatFoot`:609、`BellFoot`:507、
  `ProsthesisModel`:848)
- `LandmarkMeasurements.md`(TORP症例一覧、Regression確認対象)
