# Soft Clip Geometry Audit v1.0

**Status**: Draft(shoji確認待ち)。**コード変更は行っていない(調査のみ)**。
**Date**: 2026-07-30
**位置づけ**: `docs/Prosthesis_Geometry_Audit_Plan_v1.0.md` Phase G3-3(Soft Clip改善、
FlatFoot(G3-2、Completed & Clinical Visual Validation PASSED)の次)。既存の
`docs/TORP_SoftClip_Geometry_Audit_v1.0.md`(G1-3)が既にSoft Clipの一部(Head Center/Contact
Landmark)を確認済みであり、本文書はその内容を再利用しつつ、実装着手(G3-3)に向けて
①現状のGeometry方式の確認②FlatFootの反省点の再発リスク評価③新規に発見した問題(シャフト/
Foot間の座標重複)を追加するもの。

---

## Executive Summary

1. **現状のGeometry方式は、FlatFoot(v1〜v6)で問題になった「外殻/内殻の別メッシュ二重構造」
   パターンを構造的に持たない**。Soft Clip Head(`SoftClipHead`)は全てTubeGeometry(ワイヤー
   状の1本の曲線を掃引した単一メッシュ)+cylinderGeometry(Stem)の組み合わせであり、
   PistonFootも中実(solid)なプリミティブ(sphereGeometry+cylinderGeometry)。「厚みのある
   中空シェルを外殻/内殻の2メッシュで表現する」設計そのものが存在しないため、FlatFootの
   根本原因(v5→v6の教訓)はSoft Clipには当てはまらない。
2. **新規発見**: `PistonFoot()`の`collar`(cylinderGeometry、半径0.20mm)と、
   `ProsthesisModel()`側のシャフト描画(PISTON時も半径0.20mm)が、Foot group原点(footOff)
   から局所y=[0, 0.20]の区間で**完全に同一半径・同軸で重複**している(Node実行で全8シャフト長
   [3.5〜5.5mm]について数値確認、§3.2)。これはBellFoot/FlatFootで既に修正済みの「シャフトが
   Foot内部へ侵入して見える」問題と構造的に同一のパターンであり、Soft Clipでは未対応のまま
   残っている。
3. **Evidence状況**: Soft Clip Head(Wing/Bridge/Stem)の主要寸法(ワイヤー断面平均径・フック幅・
   ブリッジ〜シャフト高さ)は2026-07-02のノギス実測+6方向写真+GLBスキャンによる**Evidence A**
   相当(コード内コメントに明記済み)。一方、ウィング曲線の詳細形状(制御点・曲率R)・全体スパン・
   Stem/Bridgeへの高さ按分は**Evidence C(推定)**であることがコード自身にフラグ済み。
   `PistonFoot`(半球tip r=0.20・collar r=0.20×h=0.20)は実測コメントが無く**Evidence Unknown
   〜C相当**(ただし半径0.20mmは`products.ts`の`footDiameter: 0.4mm`(soft-clip-stapes)と
   数値上一致しており、カタログ由来の可能性がある)。
4. **本Auditで確認した限り、Anchor/Pose Solver/Safety Engineへの参照は`FLAT`と同一パターン**
   (`base = STAPES_FOOTPLATE`、方向基準 = `UMBO_POS_TORP`)であり、`src/engine/`配下に
   `footType`/`PISTON`/`SOFT_CLIP`固有の分岐は一切存在しない(grep確認)。Geometry層の変更が
   Pose Solver/Safety Engineに影響するリスクは構造的に低い。

---

## 1. 現在の実装場所

| 対象 | 関数/定数 | ファイル:行 |
|---|---|---|
| Head(headType='SOFT_CLIP') | `SoftClipHead()` | `ProsthesisModels.tsx:437-446` |
| 〃 Stem | `SoftClipStem()` | `:428-435` |
| 〃 Bridge | `SoftClipBridge()` | `:409-426` |
| 〃 Wing(左右) | `SoftClipWing()` | `:384-407` |
| 〃 定数 | `CLIP_WIRE_R`(0.10)、`CLIP_STEM_H`(0.20) | `:379`, `:382` |
| Foot(footType='PISTON') | `PistonFoot()` | `:726-741` |
| 製品定義 | `soft-clip-stapes` | `src/data/products.ts:96-122` |
| 対象症例 | `recommendedProductId: 'soft-clip-stapes'` | `src/data/cases.ts`: case-010(L270)、
  case-014(L397)、case-015(L421) |
| 姿勢計算での分岐 | `base`/`target`選択 | `ProsthesisModels.tsx:867, 873`
  (`['FLAT','PISTON'].includes(footType)`で`STAPES_FOOTPLATE`/`UMBO_POS_TORP`を選択、FLATと
  完全共通) |

**未使用の関連コード(参考、変更不要)**: `ClipArm()`/`ClipFoot()`(`:675-719`)は`FootType`型に
`'CLIP'`が定義されているが、現行3製品(`porp-ttp-variac`/`torp-ttp-variac`/`soft-clip-stapes`)
のいずれも`footType: 'CLIP'`を使用していない(`products.ts`全件確認済み、G1-1/G1-2で既出の
結論を再確認)。Soft Clip改善のスコープには含めない。

## 2. 現状のGeometry方式

```
SoftClipHead
├─ SoftClipStem   : cylinderGeometry(r_top=0.06, r_bottom=0.07, h=CLIP_STEM_H=0.20)  ← 単一・中実
├─ SoftClipBridge : TubeGeometry(CatmullRomCurve3、5制御点、半径CLIP_WIRE_R=0.10)     ← 単一・ワイヤー状
├─ SoftClipWing(+1) : TubeGeometry(CatmullRomCurve3、7制御点、半径CLIP_WIRE_R=0.10)   ← 単一・ワイヤー状
└─ SoftClipWing(-1) : 同上(左右対称、side=-1)

PistonFoot
├─ tip(半球) : sphereGeometry(r=0.20, thetaLength=0.55π)  ← 単一・中実
└─ collar    : cylinderGeometry(r=0.20, h=0.20)           ← 単一・中実
```

**GLB/CADモデルは使用していない**(手続き型ジオメトリ、`SimScene`全体の設計方針と一貫)。
BellFoot/FlatFootのような「LatheGeometryによる回転体+外殻/内殻」という設計パターンは
Soft Clipには採用されていない(採用する必然性も薄い。Wing/Bridgeは回転対称形状ではなく
ワイヤー状の自由曲線であり、LatheGeometryの対象外)。

## 3. FlatFootで発生した問題の再発リスク評価

| FlatFootで発生した問題 | Soft Clipでの該当有無 | 評価 |
|---|---|---|
| 外殻/内殻を別メッシュにして二重構造に見える(v5→v6) | **該当なし**。Wing/Bridge/Stemは
  いずれも単一メッシュのワイヤー/中実プリミティブで、「厚みのある中空シェル」を表現しようと
  する設計自体が存在しない | リスク低 |
| 天井の輪(annulus)閉塞が不完全で穴が残る(v6→v7) | **該当なし**(同上、中空シェル自体を
  作っていない) | リスク低 |
| 過剰なCAD的精密再現(テーパー角・面取り等、v2→v3) | **要注意**。コード内コメント自身が
  「真の矩形断面(0.235×0.095mm)はCAD化時に再現する」「ウィング曲率半径Rは未確定」と
  明記しており、2026-07-02時点で既に「今は円形近似で十分」という判断が下されている。
  今回の改善でここへ回帰しない(矩形断面の忠実な掃引などに手を広げない)よう注意が必要 | リスク中
  (自制すべき方向は既にコード内に明記済み) |
| シャフトがFoot内部へ侵入して見える(Bell:2026-07-23、Flat:v7で対応) | **該当あり(新規発見)**。
  §3.2参照 | **要対応** |

### 3.2 新規発見: PistonFoot collarとシャフトの座標重複

`ProsthesisModel()`のシャフト計算(`:922-941`付近)は`isBell`/`isFlat`のみ短縮分岐を持ち、
`PISTON`用の分岐がない。そのため`PISTON`はデフォルトパス(`shaftLen=len`, `shaftY=0`)となり、
シャフト下端は常に`footOff`(=Foot group原点、`PistonFoot()`のローカル原点)に一致する。

一方`PistonFoot()`の`collar`(cylinderGeometry、半径0.20mm)はローカルy=[0, 0.20]に位置し、
シャフト自体もPISTON時は半径0.20mm(`product.type === 'PISTON' ? 0.20 : 0.10`)であるため、
**両者は同一半径・同軸で局所y=[0, 0.20]の区間が完全に重複する**。Node実行(three.js実
インスタンス化)で製品の全シャフト長(3.5/4.0/4.5/5.0/5.5mm)について確認したところ、いずれも
シャフト下端が`footOff`と厳密に一致し、collarの区間全体(0.20mm)が重複することを数値確認した。

**評価**: Bell(2026-07-23修正)・Flat(本日v7で修正)と構造的に同一のパターン。視覚的には
同一半径・同一材質(TitaniumMat)のため大きな破綻には見えにくいが、Z-fighting(同一面の
ちらつき)のリスクと、「シャフトがPistonFoot内部(半球tip側)まで理論上侵入している」という
構造的な不整合が残っている。**Clinical/Safety影響はなし**(§1のAnchor/Pose/Safety確認の通り、
シャフト描画区間はSafety Engine非参照の純粋な描画用ローカル変数)。

## 4. Evidence状況のまとめ

| 部位 | 値 | Evidence | 備考 |
|---|---|---|---|
| ワイヤー断面(平均径として近似) | CLIP_WIRE_R=0.10mm | **A**(2026-07-02ノギス実測、断面
  0.235×0.095mmの平均値を円形近似) | 矩形断面の忠実再現は意図的に見送り済み(コード内コメント) |
| フック(先端ループ)幅 | 0.195mm相当 | **A**(ノギス実測"3.9"/20) | Wing制御点の一部に反映 |
| ブリッジ〜シャフト高さ | 0.56mm | **A**(ノギス実測"11.2"/20) | Stem+Bridgeへの按分は暫定 |
| Stem高さ | CLIP_STEM_H=0.20mm | **C(推定)** | 上記0.56mmのうち「ステム分」を暫定按分した値、
  コード内コメントで明記済み |
| Wing曲線形状(制御点・曲率R) | 7制御点(手動設定) | **C(推定)** | 「暫定パス(要実測R確認)」と
  コード内コメントで明記済み |
| 全体スパン(両ウィング先端間) | 約1.8mm | **C(推定)** | GLB点群概算のみ、ノギス未実測 |
| PistonFoot半球tip半径 | 0.20mm | **Unknown〜C** | 実測コメントなし。`products.ts`の
  `footDiameter: 0.4mm`(soft-clip-stapes)と数値上一致(半径0.20mm)、カタログ由来の可能性 |
| PistonFoot collar(r/h) | 0.20mm / 0.20mm | **Unknown〜C** | 同上 |

## 5. Anchor / Pose Solver / Safety Engine参照確認

- `grep -rn "footType\|PISTON\|SOFT_CLIP" src/engine/` → **0件**。Pose Solver
  (`computeCurrentAxisAlignmentPose`等)・Safety Engine(`dangerZonePoint`関連)のいずれにも
  `footType`/`PISTON`/`SOFT_CLIP`固有の分岐は存在しない。
- `base`(Anchor)は`['FLAT','PISTON'].includes(footType) ? STAPES_FOOTPLATE : STAPES_HEAD`
  (`:867`)、方向基準`target`も同条件で`UMBO_POS_TORP`(`:873`)。**FLATと完全に同一のパターンを
  共有しており、Soft Clip固有のPose/Safetyロジックは存在しない**。
- 結論: Geometry層(`SoftClipHead`/`PistonFoot`)のみの変更であれば、Anchor/Pose Solver/
  Safety Engineへの影響はFlatFoot(G3-2)と同様に構造的に生じない。

## 6. Geometry方式の提案(実装方針の選択肢、未実装)

shoji優先順位(①外観シルエット②クリップとして認識できる特徴③シャフト接続④サイズ感
⑤厳密な肉厚)を踏まえた提案。**いずれも本Auditの範囲では実装しない**。

### 提案A(推奨): 現行方式(TubeGeometry)を維持し、③シャフト接続のみ修正

- Wing/Bridge/Stemの実装方式(TubeGeometry+cylinderGeometry、単一メッシュ)はそのまま維持する。
  既にFlatFootの反省点(外殻/内殻の二重構造)を構造的に回避できており、方式変更の必要性がない。
- `PistonFoot`のcollarとシャフトの重複(§3.2)のみ、Bell/Flatと同一パターン
  (`isPiston`分岐を追加し、シャフト下端をcollar上端(ローカルy=0.20)まで短縮)で解消する。
- ①外観シルエット・②クリップ特徴の改善が必要な場合は、Wing制御点(曲率)の微調整のみに留め、
  Geometry方式自体(TubeGeometryへの円形近似)は変更しない。
- ⑤肉厚(矩形断面0.235×0.095mmの忠実再現)は、FlatFoot(G3-2)と同じ理由で**現Phaseでは
  対象外**とし、High Precision Geometry Phase送りとする。

### 提案B(非推奨、参考): 矩形断面の忠実再現(ExtrudeGeometry+extrudePath)

- 2026-07-02時点で一度試みて「急カーブでFrenetフレームが破綻し黒い塊状ジオメトリになった」
  (コード内コメント)という失敗履歴がある。Parallel Transport Frame等の代替手法で再挑戦する
  ことは技術的に可能だが、優先順位⑤(肉厚)に該当し、shoji優先順位表でも最下位。**FlatFoot
  v2→v3の「過剰なCAD再現」の反省と同じ轍を踏むリスクが高いため、現時点では推奨しない**。

### 提案C: Wing曲線・全体スパンの追加実測を先に行う

- §4の通り、Wing曲率R・全体スパン(約1.8mm)はEvidence C(推定)のまま。①外観シルエットの
  精度を上げたい場合、実装より先に追加ノギス計測または新しい参考写真(shojiさん提供の横/上
  視点写真)による形状確認を行う方が、FlatFoot v1(実測メモの適用面誤り)のような手戻りを
  防げる。

## 7. 参考資料についての所見(ASCIIアート・写真)

shojiさんから共有されたASCIIアート(横方向シルエット)を確認した。**率直な所見として、
ASCIIアート(文字密度による濃淡表現)からは、大まかな明暗のグラデーション(丸みを帯びた
明るい領域とその周辺の階調)以上の情報を確度高く読み取ることができなかった**。曲線の
流れ・フックの開き方・クリップの湾曲構造といった①②で必要な特徴は、文字密度だけでは
判別が難しい(過去のフィードバック「写真からの3D姿勢推定でも外形の見え方だけで法線を
断定しない」と同種の理由で、不確かな読み取りから形状を断定するリスクを避けたい)。

**依頼**: 可能であれば、ASCIIアートの元になった実際の画像ファイル(横方向)、および
shojiさんが提案された上方向からの画像・寸法情報を、通常の画像ファイルとして共有
いただけると、より確度の高い形状確認ができる。それまでは提案A(現行方式維持+シャフト接続
修正のみ)を基本線とし、Wing曲線の形状変更は保留する。

## 8. Next Step

本文書をshojiさんに確認のうえ、以下のいずれかへ進む。

- **G3-3実装①(推奨)**: 提案Aのシャフト接続修正のみ先行実装(Bell/Flatと同一パターン、
  Small Change、Anchor/Pose/Safety不変)。
- **追加Evidence取得**: 実画像ファイル・上視点写真・寸法情報の共有を待ってからWing/Bridge
  形状の調整に着手する。
- 実装に着手する場合も、Verification Order(Build→TypeCheck→Lint→Review→Clinical
  Validation)を継続する。

## 9. 参照文書

- `docs/Prosthesis_Geometry_Audit_Plan_v1.0.md`(Phase G1-G3全体位置づけ)
- `docs/TORP_SoftClip_Geometry_Audit_v1.0.md`(G1-3、Head Center/Contact Landmark確認の前提)
- `docs/Prosthesis_Reference_Landmark_Definition_v1.0.md`(G1-1/G1-2)
- `docs/Prosthesis_Reference_Geometry_Definition_v1.0.md`(G2)
- `docs/FlatFoot_Geometry_Improvement_Spec_v1.0.md`(G3-2、反省点の出典)
- `src/scenes/models/ProsthesisModels.tsx`(`SoftClipHead`:437、`SoftClipStem`:428、
  `SoftClipBridge`:409、`SoftClipWing`:384、`PistonFoot`:726、`ProsthesisModel`:878)
- `src/data/products.ts`(`soft-clip-stapes`:96-122)
- `src/data/cases.ts`(case-010:270、case-014:397、case-015:421)
