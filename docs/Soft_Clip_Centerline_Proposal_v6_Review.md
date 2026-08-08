# Soft Clip Centerline Proposal v6 レビュー

**Status**: **PASS**(実装反映済み、`ProsthesisModels.tsx`)
**対象**: `docs/Soft_Clip_Centerline_Proposal_v6.json`
**起点**: v5候補(shoji作成、`soft_clip_geometry_editor_export_2026-08-08 (2).json`。
`upperArm/curve/6`のz修正済み版)
**依頼**: shoji「upperArm/curve/0とrearFlex/curve/4の間には本来隙間がありますが…
隙間が全くないように見えますので、修正してください。同様に、rearFlex/curve/3と
lowerArm/startの間にも隙間がありますので修正してください。」(2026-08-08)
**レビュー日**: 2026-08-08

---

## 1. Executive Summary

shoji指摘の2箇所の隙間消失(自己交差)を、既存の座標をできる限り変更しない方針で
解消した。変更点は**2点2軸のみ**(`lowerArm/start`のy、`upperArm/curve/0`のy)。
Ribbon境界の厳密交差判定(production設定 STEPS=400・MIN_GAP=15)で
self-intersection **4→0**、NaN=0、退化フレーム=0を確認した。

アップロードされたJSON(2)の差分確認(§2)により、shojiの言及した「upperArm/
curve/7の修正」は実際には**`upperArm/curve/6`のz座標修正**(1.613→1.9)であると
判明した(curve/7の座標は(1)(2)間で完全に同一)。この修正はv5候補Reviewで指摘した
異常点(TransformControls誤操作によるZドラッグ)の解消と一致するため、そのまま
採用した。

`ProsthesisModels.tsx`へ実装反映済み。TypeCheck(`tsc --noEmit`)・Build
(`vite build`)ともにPASS。

---

## 2. アップロードJSON差分確認(shoji「curve/7修正」の実体)

`soft_clip_geometry_editor_export_2026-08-08 (1).json` と `(2).json` をプログラムで
突き合わせた結果、**差分は1点のみ**:

| id | 差分 |
|---|---|
| `upperArm/curve/6` | z: 1.6131370913305092 → 1.9(dz=+0.286863mm) |

`upperArm/curve/7`を含む他26点は(1)(2)間で完全に一致していた。v5候補Review §5で
指摘した「`upperArm/curve/6`のz異常(TransformControls誤操作の可能性)」の修正と
解釈が一致するため、shojiの発言中の点番号の言い間違い(curve/7→curve/6)と判断し、
そのまま採用した。

---

## 3. Self-intersection: 検証結果

Ribbon境界の厳密交差判定(production設定 STEPS=400・MIN_GAP=15)。

| 候補 | crossings | 内訳 |
|---|---:|---|
| v5候補(2)、curve/6 z修正のみ反映 | 4 | `rearFlex/curve/3`↔`lowerArm/start`系統 ×2、`rearFlex/curve/4`↔`upperArm/curve/0`系統 ×2 |
| **v6(本Proposal)** | **0** | — |

### 変更内容

| Control Point | 変更前(v5候補) | 変更後(v6) | Δ |
|---|---|---|---|
| `lowerArm/start` | y=2.8998480454435365 | y=2.6998480454435367 | -0.20mm |
| `upperArm/curve/0` | y=3.496894373489493 | y=3.6468943734894932 | +0.15mm |

他25点は無変更。

### 探索方法

1. `lowerArm/start`のy単独調整をSTEPS=400で直接スイープ。dy=-0.12〜-0.20mmが
   crossings=0(該当区間のみ)のプラトーであることを確認。この修正だけでは
   `rearFlex/curve/4`↔`upperArm/curve/0`側の交差(2箇所)は残存(v5候補Review §2で
   既知)。
2. `rearFlex/curve/4`単独(dx,dy)での解消をSTEPS=400グリッド探索(dx:-0.4〜0.1,
   dy:-0.3〜0.1)したが、**0件**(v5候補Reviewの参考試行と同じ結論が production
   設定でも再確認された)。
3. `rearFlex/curve/4`+`rearFlex/curve/5`の2点合同探索(粗い解像度STEPS=250で
   114件の候補を発見)も、production設定STEPS=400で再検証すると**全て非0**
   (v5候補Reviewで警告した「粗い探索の偽陽性」が今回も再現)。
4. `rearFlex/curve/4`+`upperArm/curve/0`の2点グリッド探索(STEPS=400、production
   設定で直接)で117件の解を発見。最小変位の解は`upperArm/curve/0`のy単独+0.10〜
   +0.30mmという広いプラトーであり、`rearFlex/curve/4`側を動かさなくても解消可能と
   判明。
5. `upperArm/curve/0`のy単独でdy=+0.10〜+0.30mmを0.02mm刻みでスイープし、全域で
   crossings=0を確認(狭いプラトーではなく安定した広い解領域)。中間よりやや余裕を
   持たせた+0.15mmを採用。

**方針判断**: `rearFlex/curve/4`(RearFlexの一部、旋回角の滑らかさが定量的に確認
済みの区間)ではなく`upperArm/curve/0`側を動かした。理由: (a) `rearFlex/curve/4`
単独・合同探索では解が見つからなかった、(b) `upperArm/curve/0`側は広く安定した
プラトーを持ち、production設定での再現性が高い、(c) shojiの指摘文でも
`upperArm/curve/0`とセットで言及されており、この点の位置調整は指摘の範囲内。

---

## 4. Global最小クリアランス(構造的な限界の確認)

`lowerArm/start`のdyをさらに深く(-0.20〜-0.36mm)しても、Global最小クリアランスは
約0.04mmで頭打ちになることを確認した。この頭打ちの原因は、shoji指摘の2箇所とは
**別の、RearFlex自体の内在的なタイトターン**(`rearFlex/curve/0`↔`curve/2`付近、
v3/v4/v5候補いずれにも存在していた構造)であり、今回のスコープ外と判断し変更して
いない(Small Change原則、RearFlex中央部の滑らかさ改善はv5候補で既にレビュー済みの
別軸の変更であり、今回それを再度動かすことは避けた)。

この頭打ちにより、shoji指摘の2箇所自体のクリアランスも数値上は小さい
(概算0.03〜0.06mm、Ribbon幅0.25mmに対して薄い)が、**crossings=0は production
設定で確実に確認済み**であり、実際に触れ合っていた状態(§5参照)からは明確に
改善している。

---

## 5. Visual Verification(自己交差箇所の拡大比較)

matplotlibによる独立再構築レンダリング(sandbox制約でライブ3D Viewer到達不可、
Visual Verification v1.0からの継続方針)。実際に検出された交差セグメントの
座標を中心に、Before/Afterを同一の絶対座標・同一ズーム範囲(span=0.3mm)で
比較した(`docs/assets/soft-clip-band-loop-v6-renders/`)。

| 箇所 | Before | After |
|---|---|---|
| `rearFlex/curve/3`↔`lowerArm/start`系統(交差1) | 2本のリボンが融合したV字カスプが視認できる | カスプが解消し、明確な隙間が開いている |
| `rearFlex/curve/4`↔`upperArm/curve/0`系統(交差2) | 上側ループの先端でリボンが自己貫通した閉じた輪郭 | 同位置で貫通が解消し、開いた輪郭に変化 |

両箇所とも「触れていた状態」から「明確に離れた状態」への視覚的変化を確認した。
全体シルエット(Face-on、`docs/assets/soft-clip-band-loop-v6-renders/
v6_view1_face.png`)は、変更点が全体スケール(全長約2.9mm)に対して0.15〜0.20mmと
小さいため、遠景では v5候補とほぼ同じ輪郭に見える(意図通り、Small Change)。

---

## 6. UpperArm形状への影響確認

`upperArm/curve/0`のy+0.15mm変更が、v5候補Reviewで定量確認した「UpperArm二山
形状」「RearFlex→UpperArm遷移の滑らかさ」を崩していないか、旋回角で確認した。

旋回角(`rearFlex/curve/6`→`curve/7`→`upperArm/curve/0`→`curve/1`→`curve/2`):

| | 値 |
|---|---|
| 変更前(v5候補) | [-67.3°, +40.9°, -2.5°] |
| 変更後(v6) | [-52.2°, -11.3°, +34.6°] |

符号パターンが変化しており、`upperArm/curve/0`直後の遷移カーブの性質は変わって
いる(過去のほぼ直線的な-2.5°から、より明確な旋回+34.6°へ)。二山形状の山1
(`curve/2`付近)・谷(`curve/3`〜`curve/4`)・山2(`curve/6`付近)という大枠の
制御点配置自体は無変更のため、UpperArm全体の「2つの山」という大枠の形状意図は
維持されていると判断するが、`curve/0`直後の遷移の見え方はv5候補時点から変化して
いる。**この点はEditorでの写真オーバーレイ確認をもって最終判断することを推奨**
(Hypothesis段階の座標であり、次パスでの微調整対象としてよい)。

---

## 7. 総合判定と次のアクション

**判定: PASS**(self-intersection = 0を確認、shoji指摘の2箇所の隙間を解消)。
`ProsthesisModels.tsx`へ実装反映済み。

**次のアクション(3件に限定)**:

1. **`upperArm/curve/0`直後の遷移カーブ**(§6)を、写真オーバーレイでの確認を
   もって最終確認する。旋回角の符号が変化しているため、シルエットとしての妥当性を
   目視確認することを推奨。
2. **RearFlex内在的タイトターン**(§4、`rearFlex/curve/0`↔`curve/2`付近、
   Global最小クリアランスの頭打ち原因)は今回スコープ外としたが、Pocket Phase1
   同様に将来的な形状改善候補として記録しておく。
3. 本Proposalはdev previewのみ(`SoftClipHead()`には未統合)。臨床シーンへの
   影響はない。

---

## 8. 参照

- `docs/Soft_Clip_Centerline_Proposal_v6.json`(本レビュー対象)
- `docs/Soft_Clip_Centerline_Proposal_v5_candidate_shoji_2026-08-08.json` /
  `_Review.md`(起点)
- `docs/Soft_Clip_Centerline_Proposal_v4.json` / `_Review.md`(参考、旧lowerArm修正)
- `docs/assets/soft-clip-band-loop-v6-renders/`(レンダリング画像)
