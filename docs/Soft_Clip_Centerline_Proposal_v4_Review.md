# Soft Clip Centerline Proposal v4 レビュー

**Status**: 独立Review完了。Self-intersection = 0達成。Geometry Implementationへの反映はこのReview後に実施(§後述)。
**対象**: `docs/Soft_Clip_Centerline_Proposal_v4.json`
**背景**: v3のBand Loop Geometry Implementation v1.0に対するVisual Verification v1.0で、
LowerArm〜RearFlex間のRibbon自己交差2箇所がLevel A(明らかな実物との矛盾)と判定された。
本Revisionはこの交差のみを解消する目的で作成。
**レビュー日**: 2026-08-08

**作成方法に関する制約(先に明示)**: v1〜v3はshojiがSoft_Clip_Geometry_Editor_v1.htmlで
GUI操作・写真トレースにより作成したが、本v4はsandbox環境からEditor(ブラウザ)を操作できない
制約があるため、**Claudeがv3と同一のCatmullRomCurve3+Ring-loftロジックをNode.js上に再現し、
Ribbon境界の厳密な自己交差判定(0件)を目的関数とした数値探索でlowerArm/startの1点のみを
再配置して作成した**。GUIでの目視トレースは経ていない。schemaVersion・chainOrder形式は
完全互換のため、Editorで開いて追加調整することは可能。

---

## 1. v3 → v4 変更点

| Control Point | v3座標 (x, y) | v4座標 (x, y) | 差分 |
|---|---|---|---|
| `lowerArm/start` | (-0.7304564, 2.9223861) | (-0.7304564, 2.7623861) | y: **-0.16mm** |

**他22点はすべて無変更**(座標・chainOrder・evidenceLevel・region/role、いずれも)。

### 変更点を1点・1軸のみに絞った理由

Node探索により以下を確認した:

- `rearFlex/curve/3`単独(x: -1.0〜+0.3mm、y: 2.9〜3.8mmの絶対座標を全探索) → **解なし**
- `rearFlex/curve/0`単独(x: -1.8〜0.0mm、y: 1.9〜2.9mmの絶対座標を全探索) → **解なし**
- `rearFlex/curve/2`+`rearFlex/curve/3`(y方向+0〜0.7mm、x方向±0.2〜0.3mmの格子探索、2100通り) → **解なし**
- `lowerArm/start`(y方向のみ) → **y: -0.14mm以上のシフトで解あり**(-0.13mmでは交差2件のまま、
  -0.14mmで交差0件、閾値を跨ぐことを確認)

すなわち、RearFlex側の点(Hypothesis、Evidence上も"正確な曲率・境界は未確認")だけをどれだけ
動かしても交差は解消せず、`lowerArm/start`(departure legの起点)を動かすことが実質的に必須
であった。したがって最小限の変更として`lowerArm/start`のyのみを、閾値(-0.14mm)に安全マージンを
加えた**-0.16mm**とした。

---

## 2. Self-intersection: Before / After

| | v3 | v4 |
|---|---:|---:|
| Ribbon境界交差(厳密判定、非隣接ring-step、production設定 STEPS=400・MIN_GAP=15) | **2件** | **0件** |
| NaN / Infinity | 0件 | 0件 |
| 退化フレーム(接線とN軸平行) | 0件 | 0件 |

v4のvisual確認(`docs/assets/soft-clip-band-loop-v4-renders/v4_view4_pocket_zoom.png`)でも、
v3で見えていたX字状の交差(2本のストランドが重なり合う状態)が解消され、LowerArm起点→
RearFlex折り返し→Pocket deepestが、交差のない滑らかなS字連結として表示されることを確認した。

---

## 3. Shape確認(Region別)

| Region | 確認結果 |
|---|---|
| Hook | v3から無変更。座標・形状とも影響なし。 |
| Bridge | v3から無変更。座標・形状とも影響なし。二重ホール対応関係は別Audit(本Revisionのスコープ外、§13準拠)。 |
| LowerArm | `lowerArm/start`のyが-0.16mm(下方向)。Bridge→LowerArm→RearFlexの旋回角パターンが[-17.5°,+60.2°,-72.3°](2回反転、鋭い山型)から[+30.3°,+0.1°,-60.0°](実質1回反転)へ単純化(§4参照、副次効果)。 |
| Pocket | `pocket/entrance`・`pocket/deepest`とも無変更(chainOrder・座標とも)。Priority4準拠。 |
| RearFlex | `rearFlex/curve/0〜3`すべて無変更。折り返しの基本形状(Priority3)を完全維持。 |
| UpperArm | 無変更(今回スコープ外、Hook同様)。 |

---

## 4. Photo Alignment(v3からの悪化有無)

v3レビュー時点で「実物写真では確認できない、非隣接ストランドの交差」があったこと自体が
写真との不一致だった(Visual Verification v1.0 §3)。v4ではこの不一致が解消されたため、
**写真との整合性はv3比で改善**と判断する。

副次的な変化として、Bridge→LowerArm→RearFlex間の旋回パターンが単純化された(§3)。
これは実物写真(`right_annotated.png`等)で見える、Bridge直後からLowerArmにかけての
比較的滑らかな遷移とも整合的であり、v3で見られた鋭い折れ(-17.5°→+60.2°の急な山型)が
緩和されたことは、写真との一致度をむしろ改善する方向の変化と考えられる。ただし
これはEditorでの写真オーバーレイによる直接確認ではなく、Claudeによる定性的判断である
点に留意(§0の制約と同根)。

大幅な悪化(Bounding Boxの拡大・LowerArm/RearFlexの輪郭が写真から明らかに外れる等)は
確認されなかった(Bounding Box X/Yともv3と完全一致、§5参照)。

---

## 5. Dimensions

| Item | v3 | v4 | 判定 |
|---|---:|---:|---|
| Terminal Length(`hook/end`-`hook/start`) | chord 0.73mm | chord 0.732mm | 変化なし(Evidence 2.40mm、DEVIATION継続、既知・今回対象外) |
| Pocket Depth(`pocket/entrance`-`pocket/deepest`) | chord 0.93mm | chord 0.927mm | 変化なし(Evidence 3.30mm、DEVIATION継続、既知・今回対象外) |
| Band Loop全長(centerline) | 7.596mm | 7.508mm | -0.09mm(軽微、lowerArm/start移動の副次効果) |
| Bounding Box X | [-1.454, 1.448] | [-1.454, 1.448] | 無変化 |
| Bounding Box Y | [2.112, 3.774] | [2.112, 3.774] | 無変化(lowerArm/startはXY極値ではないため) |

Evidence値そのもの(Band Width/Thickness/Terminal Length/Pocket Depth/Arm Gap/Pocket
Maximum Width)はすべて無変更(§3指示準拠、書き換えていない)。

---

## 6. 総合判定

**PASS**。self-intersection = 0(production設定で確認)、NaN/Infinity = 0、退化フレーム = 0、
Topology・Evidence・Hook・UpperArm・Pocket位置関係(entrance/deepest)いずれも維持、
変更点は1制御点・1軸のみ。写真との整合性はv3比で改善(交差という物理的にあり得ない状態が
解消されたため)。

Geometry Implementation(`ProsthesisModels.tsx`)への反映を実施してよいと判断する。

---

## 7. 参照

- `docs/Soft_Clip_Band_Loop_Visual_Verification_v1.0.md`(v3のLevel A判定根拠)
- `docs/Soft_Clip_Band_Loop_Geometry_Implementation_v1.0.md`(反映元の実装方針)
- `docs/assets/soft-clip-band-loop-v4-renders/`(v4の5方向レンダリング)
