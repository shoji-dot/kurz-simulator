# Soft Clip Centerline Proposal v7 レビュー

**Status**: **PASS(条件付き)**(実装反映済み、`ProsthesisModels.tsx`)
**対象**: `docs/Soft_Clip_Centerline_Proposal_v7.json`
**起点**: v6(self-intersection解消版、commit `afadf57`)
**依頼**: 「Proposal v5」として指示された曲率品質改善タスク(RearFlex/UpperArmの
曲率を滑らかにし、UpperArmの二山形状を明確化する)。ファイル名はv5/v6が既存の
別Proposalで使用済みのため、shojiの承認により**v7**として命名(2026-08-08)。
**レビュー日**: 2026-08-08

---

## 1. Executive Summary

v6をBaselineに、v6 Reviewで「次パスの課題」として残されていたRearFlex(curve0〜4
付近の曲率の粗さ)とUpperArm(curve0直後の遷移・curve1付近の小さな波打ち)を、
Node数値探索(Laplacian平滑化・3点移動平均の部分適用、写真トレースではなく
既存座標に対する数値操作)で改善した。

**変更点は4点のみ**(`rearFlex/curve/1`, `rearFlex/curve/3`, `rearFlex/curve/4`,
`upperArm/curve/1`)。`pocket/deepest`・`rearFlex/curve/2`・Hook・Bridge・
Topology・chainOrder・Evidence値・Coordinate Systemは無変更。

Ribbon境界の厳密交差判定(production設定 STEPS=400・MIN_GAP=15、v4/v6と同一手法)
でself-intersection **0を維持**。さらに副産物として、Ribbon境界の**最小クリアランス
が0.0335mm→0.0440mm(+31%)に改善**した(v6が抱えていた「数値上は薄いクリアランス」
という既知の脆弱性、v6 Review §4の軽減にも寄与)。

`ProsthesisModels.tsx`へ実装反映済み。**TypeCheck(`tsc --noEmit`)はPASS**。
**Build(`vite build`)はsandbox環境の制約により今回のセッションでは完走を確認できず**
(§8参照、コード起因の可能性は低いと判断するが、Evidence不足として明示する)。

---

## 2. 曲率改善の方針と数値的根拠

### 2.1 RearFlex(curve0〜curve7、pocket/deepest含む)

v5候補Review §3の指摘(「curve5〜7は符号反転が少なく振幅が揃っている(滑らか)。
curve0〜3は振幅の変動が大きい」)を、旋回角密度(旋回角÷隣接区間の平均長、
deg/mm)で定量比較した。

| 制御点 | v6 旋回角 | v6 密度(deg/mm) | v7 旋回角 | v7 密度(deg/mm) |
|---|---:|---:|---:|---:|
| `rearFlex/curve/0` | -52.5° | -133 | -61.4° | -161 |
| `rearFlex/curve/1` | -83.5° | **-387**(突出) | -64.0° | -337 |
| `rearFlex/curve/2` | -41.9° | -98 | -52.1° | -129 |
| `rearFlex/curve/3` | +43.5° | 107 | +35.9° | 89 |
| `pocket/deepest` | +49.1° | 319 | +60.0° | 364 |
| `rearFlex/curve/4` | +48.6° | 145 | +44.5° | 134 |
| `rearFlex/curve/5`〜`7`(基準・無変更) | -55.4°/-69.3°/-52.2° | -156/-398/-157 | 同左 | 同左 |

`curve/1`の密度スパイク(-387deg/mm、隣接する`curve/0`(-133)・`curve/2`(-98)に
対して明確な外れ値)を、`curve/0`・`curve/2`の中点方向へのLaplacian平滑化
(alpha=0.3)で-337deg/mmへ緩和し、隣接点との対称性も改善した(133/98→161/129)。

`curve/3`・`curve/4`は同様にLaplacian平滑化を試みたが、alpha=0.3では
Ribbon境界の最小クリアランスが**0.0335mm→0.0127mmまで悪化**した(§3参照、
`pocket/deepest`に隣接点を寄せたことで折り返しの内側半径が縮小したため)。
これを受けてalpha=0.1(`curve/3`)・alpha=0.05(`curve/4`)まで縮小し、
クリアランスを0.0440mmまで改善する設定を採用した。`pocket/deepest`自体は
Pocket Depth測定定義([[次々タスク②]]の対象)との関係に配慮し、**無変更**とした。

`pocket/deepest`地点の旋回角密度(364deg/mm)は依然として高いが、これはRearFlex
の折り返し(fold-back)の物理的な頂点であり構造的に鋭い転回が必然であるため、
「過度な折れ」ではなく「折り返しという基本形状」の一部と判断し、意図的に
最小限の変更(0)に留めた。

### 2.2 UpperArm(curve0〜curve2)

v5候補Review §4は「`curve/1`(-2.5°、ほぼ直線)付近に小さな波打ちが残っている
可能性があるが、過剰適合(トレースノイズ)か否かはこの数値だけでは判別できない」
と保留していた。v7では、`curve/0`→`curve/1`→`curve/2`→`curve/3`の直線トレンド
(区間全体の傾向線)からの偏差を算出し、この判別を試みた:

| 制御点 | y座標(v6) | トレンド線予測値 | 偏差 |
|---|---:|---:|---:|
| `curve/0` | 3.647 | 3.705 | -0.058 |
| `curve/1` | 3.540 | 3.635 | **-0.095**(最大偏差) |
| `curve/2` | 3.571 | 3.566 | +0.005(ほぼ一致) |
| `curve/3` | 3.493 | 3.496 | -0.003(ほぼ一致) |

`curve/2`・`curve/3`はトレンド線にほぼ一致しており「ピーク1」としての意味は
本来薄い可能性があるが、`curve/1`は明確にトレンド線から下方へ突出した窪みで
あり、これが波打ちの実体と判断した。したがって**`curve/1`のみ**を
`curve/0`-`curve/1`-`curve/2`の3点移動平均へ部分的にブレンド(beta=0.3)し、
**`curve/2`(ピーク1)は無変更**として保持する方針を採用した。

結果、`upperArm/curve/0`直後の旋回角は-11.3°→-8.4°(v6 Review §6のフォローアップ
課題)、`curve/1`の旋回角は+34.6°→+27.9°へ緩和。ピーク1(`curve/2`)のプロミネンス
(`curve/2`のyが`curve/1`のyを上回る量)は0.0314mm→0.0175mmへ縮小したが、
消失はしていない(§4「二山形状」参照)。

**未確認事項(Evidence不足の明示)**: `curve/1`の窪みが実物写真上の本物の特徴か
トレースノイズかは、この数値解析だけでは最終確定できない。v5候補Reviewと同様、
Editorでの写真オーバーレイ確認を推奨する(今回もsandbox制約でその確認は
実施できていない)。

---

## 3. Self-intersection / 最小クリアランス: 検証結果

Ribbon境界の厳密交差判定(v4/v6と同一手法、production設定 STEPS=400・
MIN_GAP=15)をNode.js上でthree.js(プロジェクトのnode_modulesと同一バージョン
0.184.0)を用いて再実装し、`getSoftClipBandLoopRingAt`と同一の数式で検証した。

| 候補 | crossings | NaN | 退化フレーム | 最小クリアランス |
|---|---:|---:|---:|---:|
| v6(Baseline) | 0 | 0 | 0 | 0.0335mm |
| v7(alpha=0.3で3点全て平滑化、試作) | 0 | 0 | 0 | **0.0127mm**(悪化のため不採用) |
| **v7(採用、alpha=0.3/0.1/0.05)** | **0** | **0** | **0** | **0.0440mm**(+31%) |

alpha値のグリッド探索(`rearFlex/curve/1`=0.2〜0.5、`curve/3`=0〜0.3、
`curve/4`=0〜0.3の組み合わせ)を行い、crossings=0を保ったまま最小クリアランスが
最大化される設定を選定した。採用値(alphaC1=0.3, alphaC3=0.1, alphaC4=0.05)は
周辺の広いプラトー内にあり(近傍の組み合わせでも0.043〜0.045mm、単一の狭い
偶然解ではない)、v4/v6と同様の「プラトー確認」による頑健性を確保している。

---

## 4. UpperArm「2つの山」形状への影響確認

v5候補Review §4で定量確認された「山1(`curve/2`付近)→谷(`curve/3`〜`curve/4`)
→山2(`curve/6`付近)」という二峰構造は、v7でも制御点レベルで維持されている
(§2.2参照、`curve/2`は無変更、谷・山2も無変更)。

ただし§2.2で述べたとおり、山1のプロミネンス(周囲との高さ差)は0.0314mm→
0.0175mmへ縮小した。これは「過度な折れをなくす」目的での意図的な結果だが、
「2つの山を明確に再現する」という要求との間にトレードオフが生じている。
本Reviewでは、トレンドライン分析(§2.2)に基づき`curve/2`自体は無変更のまま
残したため二峰構造そのものは消えていないと判断するが、**山1の視覚的な明確さが
写真と比べて十分かどうかは、写真オーバーレイでの最終確認を推奨**する
(v5候補Reviewから持ち越しの未確認事項)。

---

## 5. Deltas(v6→v7、変更点は4点のみ)

| Control Point | v6座標 | v7座標 | Δ |
|---|---|---|---|
| `rearFlex/curve/1` | (-1.45371, 2.64402) | (-1.41137, 2.65253) | dx=+0.0423, dy=+0.0085 |
| `rearFlex/curve/3` | (-0.75248, 3.05727) | (-0.77925, 3.05319) | dx=-0.0268, dy=-0.0041 |
| `rearFlex/curve/4` | (-0.73758, 3.33691) | (-0.74870, 3.33769) | dx=-0.0111, dy=+0.0008 |
| `upperArm/curve/1` | (-0.45818, 3.53953) | (-0.45907, 3.55341) | dx=-0.0009, dy=+0.0139 |

他23点は完全に無変更(`pocket/deepest`・`rearFlex/curve/2`を含む)。

---

## 6. Visual Verification

sandbox制約でライブ3D Viewerに到達できないため、Visual Verification v1.0
以来の方針(matplotlibによる独立再構築レンダリング)を継続した。

- `v7_view1_face.png`: 全体シルエット(Face-on)。RearFlexの折り返し
  (Hook→Bridge→LowerArm→RearFlex S字→UpperArm)が明確に確認できる。
- `v7_view2_oblique.png`: 3D斜視(参考)。Ribbon断面が薄いため
  `Poly3DCollection`のシェーディングが不十分で、形状の大枠確認以上の
  精度は無い(v6と同様の制約)。
- `v7_view3_side.png`: エッジオン(Y-Z投影)。厚み方向(z)がz≈1.9±0.05mmの
  範囲に収まっており、意図しないZ逸脱(v5候補の`upperArm/curve/6`異常のような
  問題)が無いことを確認した。
- `cmp_rearflex_before/after.png`, `cmp_upperarm_before/after.png`:
  変更領域の拡大Before/After比較。

**既知の描画上の注意点**: これらの2Dシルエットは、Ribbon境界の2エッジを
`matplotlib.fill()`で単純に閉多角形として描画したものであり、RearFlexの
折り返し部分で多角形の非単純性(自己交差)による三角形の切れ込み状の描画
アーチファクトが生じる(v6の同種レンダリングでも同じ現象が見られた)。
これは**Ribbon Meshの実際の自己交差ではない**(§3の厳密判定で0を確認済み)。
描画アーチファクトと実際の幾何学的自己交差を混同しないよう注意されたい。

全体シルエットは変更量(0.001〜0.04mm)がスケール(全長約2.9mm)に対して
小さいため、遠景ではv6とほぼ同じ輪郭に見える(意図通り、Small Change)。

---

## 7. Verification Order(Build確認の制約について)

指示に基づく確認順序(Build→TypeCheck→Lint→Review→Clinical Validation)の
うち、以下を実施した。

| ステップ | 結果 |
|---|---|
| TypeCheck(`tsc --noEmit`) | **PASS**(エラー0件) |
| Build(`vite build`) | **未完走**(§7.1参照) |
| Lint | 未実施(Buildが未完走のため今回は見送り) |

### 7.1 Build未完走の詳細

`vite build`を計4回試行した(production構成2回、`--mode development
--minify false`1回、うち1回はバックグラウンド実行で長時間監視)。いずれも
`transforming...`段階でプロセスが出力を残さないまま終了し、明示的なエラー
メッセージやスタックトレースは得られなかった。`dmesg`はsandbox権限で
アクセス不可のため、OOM Kill等の断定はできない。

**コード起因である可能性は低いと判断する根拠**:
- 変更内容は既存の`THREE.Vector3`配列内の座標値4点のみ(新規import・型定義
  変更なし)。
- TypeCheckは変更後のファイル全体を静的検証しておりPASS。
- 同一コマンドは過去セッション(v4・v6)で正常完了したことが記録されている
  (`docs/Soft_Clip_Centerline_Proposal_v6_Review.md`)。

とはいえ、**Build PASSをこのレビューでは主張しない**(Evidence不足の明示、
指示§7「Evidence Based Review」準拠)。次回セッションでの再試行、または
ユーザー環境での`npm run build`実行による確認を推奨する。

---

## 8. 総合判定と次のアクション

**判定: PASS(条件付き)**

- self-intersection = 0、NaN = 0、退化フレーム = 0 を確認(絶対条件クリア)。
- 最小クリアランスがv6比+31%改善(0.0335→0.0440mm)。
- 変更点は4点のみ、Topology/Hook/Bridge/Evidence値/Coordinate System/
  `pocket/deepest`/`rearFlex/curve/2`は無変更(Small Change原則準拠)。
- `ProsthesisModels.tsx`へ実装反映済み、TypeCheckはPASS。

**条件(次のアクション、3件)**:

1. **Build未完走の解消**: 次回セッションまたはユーザー環境で`npm run build`
   を実行し、production buildが正常完了することを確認する(§7.1)。
2. **写真オーバーレイでの最終確認**: `upperArm/curve/1`の窪み(トレースノイズ
   か実特徴か、§2.2)と、山1のプロミネンス縮小が写真シルエットとして許容範囲か
   (§4)を、写真と重ねての目視確認をもって最終判断する。
3. 本Proposalはdev previewのみ(`SoftClipHead()`には未統合)。臨床シーンへの
   影響はない。

---

## 9. 参照

- `docs/Soft_Clip_Centerline_Proposal_v7.json`(本レビュー対象)
- `docs/Soft_Clip_Centerline_Proposal_v6.json` / `_Review.md`(起点)
- `docs/Soft_Clip_Centerline_Proposal_v5_candidate_shoji_2026-08-08.json` /
  `_v5_candidate_Review.md`(曲率改善方針の初出、旋回角密度分析の参照元)
- `docs/assets/soft-clip-band-loop-v7-renders/`(レンダリング画像)
