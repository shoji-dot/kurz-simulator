# Soft Clip Centerline Proposal v5候補(shoji作成)レビュー

**Status**: **REVISION REQUIRED**(実装反映は保留)
**対象**: `docs/Soft_Clip_Centerline_Proposal_v5_candidate_shoji_2026-08-08.json`
(shojiがEditorで作成、2026-08-08 03:25 export。ChatGPTとの検討を経てClaudeへ共有)
**レビュー日**: 2026-08-08
**位置づけ**: v4(自己交差解消、commit `1c72f61`)とは別軸の「曲率・シルエット品質向上」
Revisionとして評価する(ChatGPT提案の区分に同意、v4のPASS判定は変更しない)。

---

## 1. Executive Summary

RearFlex curve5〜7の滑らかさを基準にcurve0〜4を改善する方針、およびUpperArmを
4点→8点に拡張して「2つの山」を再現する方針は、**いずれも定量的に裏付けられ、
方向性として妥当**と判断した(§3・§4)。

一方、**self-intersection = 0という絶対条件を満たしていない**。このJSONはv3を
ベースに独立編集されたものでv4の`lowerArm/start`修正を含んでおらず、そのままでは
**4箇所**の交差がある。v4の修正を適用しても**2箇所**が残る。この2箇所は
v3/v4では存在しなかった**新規の交差**であり、`pocket/deepest`の移動
(x+0.060mm)とRearFlex後半(curve4〜7)〜UpperArm冒頭の間隔が詰まったことに
起因すると考えられる(§2)。

加えて、`upperArm/curve/6`のz座標が1.9→1.613と、他の全点(z=1.9固定の平面
Curveという前提)から**約0.29mm逸脱**しており、Obliqueレンダリングで実際に
視認できる不自然なキンク(局所的な捻れ)を生じさせている(§5)。TransformControls
操作時の意図しないZドラッグの可能性が高いと考えられる。

したがって、**今回の候補をそのまま実装へ反映することは推奨しない**。RearFlex/
UpperArmの改善方針自体は活かしつつ、①self-intersectionを再度0にする、
②`upperArm/curve/6`のz異常を確認・修正する、の2点を解消したうえで再度
Reviewする必要がある(§7)。

---

## 2. Self-intersection: 検証結果

Ribbon境界の厳密交差判定(production設定 STEPS=400・MIN_GAP=15、v4と同一手法)で
以下を確認した。

| 候補 | crossings | 内訳 |
|---|---:|---|
| v3(参考) | 2 | `lowerArm/start`〜`rearFlex/curve/2,3`間 |
| v4(参考、PASS済み) | 0 | — |
| **v5候補(アップロードされたまま)** | **4** | 上記2箇所(v3と同系統) + 新規2箇所 |
| v5候補 + v4の`lowerArm/start`修正を適用 | **2** | 新規2箇所のみ残存 |

**新規2箇所の詳細**(v4修正適用後、production設定):

| # | 位置A | 位置B |
|---|---|---|
| 1 | `rearFlex/curve/4`付近(t≈0.495) | `upperArm/curve/0`付近(t≈0.695) |
| 2 | `rearFlex/curve/5`〜`curve/7`間(t≈0.540) | `rearFlex/curve/7`付近(t≈0.650) |

**原因の推定**: `pocket/deepest`が(-0.741, 3.206)→(-0.681, 3.206)へx+0.060mm
移動し、かつ`rearFlex/curve/2`がy-0.046mm移動したことで、中央のS字連結の
形状が変化した。この変化自体はRearFlex中央部の曲率改善という意図した方向だが、
副作用として`rearFlex/curve/4`〜`curve/7`〜`upperArm/curve/0`にかけての
折り返しがより密になり、新たな交差を生んだと考えられる。

**再修正の試行(参考、未採用)**: `rearFlex/curve/4`単独の位置調整で0まで
追い込めるか数値探索したところ、粗い分割(STEPS=250-300)では0件の候補が
見つかるものの、production設定(STEPS=400)で再検証すると1件が残ることを
複数回確認した。この領域はv4の`lowerArm/start`修正時よりも交差の起きる
マージンが薄く、単一点の調整だけでは安定して0にならない可能性が高い。
**この探索はあくまで参考であり、正式なProposalとしては採用していない**
(そのままEditor実装へ反映していない)。

---

## 3. RearFlex曲率の滑らかさ(定量評価)

旋回角(進行方向の変化量、度)を区間ごとに算出した(v5候補、v4修正適用後の値)。

| 区間 | 旋回角の推移 | 評価 |
|---|---|---|
| `bridge/departure`→`lowerArm/start`→`curve0`→`curve1`→`curve2`→`curve3`→`pocket/deepest` | +56.6 → -69.3 → **-83.5** → -41.9 → +43.5 | 符号反転は少ないが、振幅の変動が大きい(-83.5°は鋭い)。shoji/ChatGPT指摘のとおり「急」。 |
| `pocket/deepest`→`curve4`→`curve5`→`curve6`→`curve7`→`upperArm/curve0` | +48.6 → -55.4 → -69.3 → -67.3 | 符号は1回反転のみ、`curve4`以降は-55°〜-69°で振幅が揃っており連続的。shoji/ChatGPT指摘の「curve5〜7が滑らか」を**定量的に裏付ける**。 |

**結論**: 「curve5〜7に見られる滑らかさをcurve1〜4にも適用する」という方針
(コピーではなく振る舞いの模倣)は、上表の振幅変動を均すことで実現可能と考えられ、
方向性として支持する。ただし今回のJSONではcurve0〜3自体は無変更(v3から座標
不変)であり、**この方針はまだ実行されていない**(`curve/2`と`pocket/deepest`
のみ移動、curve0/1/3は未着手)。次パスの主な作業対象となる。

---

## 4. UpperArmの「2つの山」形状

y座標の推移(x昇順、UpperArmのみ):

```
curve0: y=3.497
curve1: y=3.540
curve2: y=3.571  ← 山1
curve3: y=3.493  ← 谷
curve4: y=3.427  ← 谷(最深部)
curve5: y=3.555
curve6: y=3.656  ← 山2
curve7: y=3.568
end:    y=3.346
```

**確認**: 山1(`curve2`付近)→谷(`curve3`〜`curve4`)→山2(`curve6`付近)という
明確な二峰形状が制御点レベルで形成されており、意図(2つの大きな曲率イベント)は
**達成されている**。

旋回角(`rearFlex/curve7`→`curve0`..`curve7`→`upperArm/end`):
`[+40.9, -2.5, -27.1, +2.9, +42.0, -12.0, -32.0, -34.1]`(8値、符号反転3回)。

v1(4点、毎点反転=3回/3区間、密度100%)と比較し、v5候補は8点で3回/8区間
(密度37.5%)であり、**反転密度は明確に改善**している。一方、理想的な
「2つの単一符号の山」であれば反転は1回で済むはずのところ3回あり、`curve1`
(-2.5°、ほぼ直線)・`curve3`(+2.9°、ほぼ直線)付近に小さな波打ちが残っている
可能性がある。過剰適合(写真の細部ノイズ追跡)によるものかは、この数値だけ
では判別できない(Editorでの写真オーバーレイ確認、または実物写真との詳細
照合が必要)。

**総合**: 方針・大枠は妥当。仕上げ(小さな波打ちの要否判断)は次パスの課題。

---

## 5. 異常点: `upperArm/curve/6`のZ座標

| 項目 | 値 |
|---|---|
| 他の全26点のz | 1.9(完全固定、Bridge/end除き無変動) |
| `bridge/end`のz | 1.9084141123734004(逸脱 +0.008mm、無視できる範囲) |
| **`upperArm/curve/6`のz** | **1.6131370913305092(逸脱 -0.287mm)** |

Obliqueレンダリング(`docs/assets/soft-clip-band-loop-v5-candidate-renders/
new_view3_oblique.png`)で、UpperArm終端(`upperArm/end`)手前に**視認できる
段差状のキンク**を確認した。これは`upperArm/curve/6`のz逸脱がRibbonの厚み
方向に段差を作っていることと整合する。

Band Loop Editorは3D空間内でTransformControlsによるドラッグ操作を行うため、
XY移動を意図した操作でZ軸方向にも意図せず動いてしまう(ドラッグハンドルの
誤操作)可能性が高い。**実物のBand Loopがこの位置で意図的にZ方向へ0.29mm
近く逸脱している根拠([[写真Evidence]])は現時点で確認できていない**ため、
意図的な表現でなければ z=1.9 へ戻すことを推奨する。

---

## 6. その他の差分(参考、v3比)

| Control Point | 変更 | 評価 |
|---|---|---|
| `pocket/entrance` | y+0.0026mm | 無視できる誤差範囲 |
| `bridge/end` | dx+0.001, dy-0.029, dz+0.008mm | 小さいが実質的な変更。Bridge二重ホール問題(別Audit)との関連は未確認 |
| `bridge/departure/0` | y-0.0121mm | 軽微 |
| `lowerArm/start` | y-0.0225mm | v4の必要量(-0.14mm以上)に遠く届かない。v4の知見が未反映であることの証跡 |
| `rearFlex/curve/0` | x+0.0155mm | 軽微 |

---

## 7. 総合判定と次のアクション

**判定: REVISION REQUIRED**(self-intersection = 0を満たさないため、現状のまま
実装へは反映しない)。

**次のアクション(3件に限定、指示§18準拠)**:

1. **v4ベースラインの再統合**: 今回のJSONはv3ベースで、v4の`lowerArm/start`
   修正(y-0.16mm)を含んでいない。次にEditorで作業する際は、v4適用後の座標
   (`docs/Soft_Clip_Centerline_Proposal_v4.json`)を起点にすることを推奨する。
2. **`rearFlex/curve/4`〜`upperArm/curve/0`間の新規交差の解消**: `pocket/
   deepest`の移動と絡む可能性が高い(§2)。単一点の微調整では production
   設定で安定して0にならなかった(§2参考試行)ため、Editorで写真を見ながら
   `curve/4`・`curve/5`・`pocket/deepest`を少しずつ調整し、都度self-intersection
   チェックを行う反復が必要。
3. **`upperArm/curve/6`のz座標確認**: 意図的でなければz=1.9へ修正。

上記が解消された時点で、RearFlex(curve0〜3の滑らかさ改善、§3)・UpperArm
(小さな波打ちの要否、§4)を仕上げたうえで、v5として再度self-intersection・
NaN/Infinity・退化フレーム・5方向Visual Verificationのフルレビューを行う。

---

## 8. 参照

- `docs/Soft_Clip_Centerline_Proposal_v4.json` / `_Review.md`(v4ベースライン)
- `docs/Soft_Clip_Centerline_Proposal_v5_candidate_shoji_2026-08-08.json`(本レビュー対象)
- `docs/assets/soft-clip-band-loop-v5-candidate-renders/`(レンダリング画像)
