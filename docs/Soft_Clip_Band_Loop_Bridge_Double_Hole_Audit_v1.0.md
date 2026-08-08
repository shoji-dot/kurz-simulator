# Soft Clip Band Loop — Bridge Double-Hole Audit v1.0

**Status**: **Audit(形状変更なし)、結論はPartial — 1件はHypothesis収束、1件は要shoji物理確認**
**依頼**: v6 Visual Verification §Next Actions 2.「Bridgeの『二重ホール』対応関係の調査」
(2026-08-08未着手のまま持ち越し)、v7完了後にshoji指示で正式着手。
**方針**: 形状(Geometry)はいっさい変更しない。Evidence→Interpretation→Topology→
Geometry実装可否の4層を分離して、「2つのホールが何なのか」を先に確定する。

---

## 1. Executive Summary

`docs/assets/soft-clip-m1m2m3/`配下の実物写真(azimuth045/135/225/315、および
`azimuth045_pocket_zoom_hook_occluded.png`等のクローズアップ)を再確認した結果、
**Hook〜Bridge〜Pocket entranceが密集する、シャフト接合部のすぐ近傍に、閉じた
輪郭に見える開口部が2箇所存在する**ことをEvidence Aとして確認した。

現行Topology(`ProsthesisModels.tsx`の27制御点)は、`hook/end`(自由端)から
`upperArm/end`(自由端)まで**単一の開いた帯(closed=falseのCatmullRomCurve3、
一筆書き)**であり、経路上のどこにも真に閉じたループ(自己溶着・分岐)を持たない。
`Bridge`は現在3点(`approach`/`end`/`departure`)からなる**単一のT字通過点**として
モデル化されており、`bridge/end`の`evidenceLevel`は`Unknown`。

2箇所の開口部のうち、**1箇所は既存の`Hook`(近傍のカール形状)と対応する可能性が高い**
と判断した(Hypothesis、§4)。**もう1箇所は現行Topologyのどの制御点にも対応せず、
未モデル化**である(§3・§5)。ただし、写真だけでは「実際に貫通した閉じた穴」なのか
「2本の帯/シャフトが接近しているだけの見かけ上の開口(投影上の錯覚)」なのかを
確定できず、**shojiによる現物の直接確認(角度を変えての目視・可能なら触診)を推奨**する。

**今回は形状変更を行っていない**(Audit専用、v7のBand Loop実装は無変更)。

---

## 2. Evidence(写真からの直接観察、Evidence A)

参照した写真:

| ファイル | 内容 |
|---|---|
| `azimuth-ring/SoftClip_Azimuth_045.jpg`, `_135.jpg`, `_225.jpg`, `_315.jpg` | 全体像、90°刻み4方向 |
| `azimuth-ring/azimuth045_pocket_zoom_hook_occluded.png` | シャフト接合部近傍のクローズアップ(ファイル名が示すとおりHook部分は奥に隠れて見えにくい角度) |
| `azimuth-ring/azimuth135_hook_visible_zoom.png` | 同部位、Hookが視認できる角度からのクローズアップ |
| `right_oblique_annotated_view.png` | シャフト接合部を斜め上から見た詳細ショット |
| `right_oblique_terminal_zoom.png` | Hook単体の孤立クローズアップ(丸まった鉤状の自由端) |

**観察された事実(Evidence A)**:

1. シャフト(円柱ロッド)の先端に、扁平な帯材(Band Loop)が接続している。接続部
   直後(シャフト側から見て最初の数mm以内)に、**2つの独立した楕円形の開口(閉じた
   輪郭に見える)**が並んで存在する。
2. この2開口のすぐ外側(シャフトからさらに離れた位置)に、明確に**自由端として
   丸まったフック形状**(`right_oblique_terminal_zoom.png`で単体視認できる、
   J字型の鉤)が別途存在する。
3. 2開口・フック形状からさらに離れた位置から、**長い波状(複数回の折り返し)の
   帯**が伸びている。この波状部分の形状的特徴(複数回の方向反転、鋭い折り返し)は、
   現行モデルの`RearFlex`(curve0〜7)・`UpperArm`(curve0〜7)の折り返しパターンと
   定性的に整合する。
4. 波状帯の終端は、丸まった穴ではなく**単純な自由端**(`upperArm/end`、
   Editor Design v1.0で「Photo#1の『ループ端』」と既述、旧称`hook/end`から改称済み)。

**Evidence Aの限界**: 全て単眼写真(2D投影)からの観察であり、開口が実際に
「貫通した穴」なのか「帯材同士が投影上重なって閉じて見えるだけ」なのかは、
単一写真からは幾何学的に確定できない(M1M2M3 Measurement Record v1.9で
既に指摘されている「視点依存性」の一般的な限界と同種の問題)。

---

## 3. Topology(現行モデルの表現能力)

`ProsthesisModels.tsx`の`SOFT_CLIP_BAND_LOOP_CONTROL_POINTS`(27点)を確認した。

- 全27点が単一の`THREE.CatmullRomCurve3(points, false)`(閉じていない一筆書き)
  を構成する。
- chainOrder順: `hook/end`(0, 自由端)→`hook/curve/0,1`→`hook/start`(2)→
  `pocket/entrance`(3)→`bridge/approach/0`(4)→`bridge/end`(5)→
  `bridge/departure/0`(6)→`lowerArm/start`(8)→`rearFlex/curve/0〜7`
  (9〜10.99、`pocket/deepest`を含む折り返し)→`upperArm/curve/0〜7`→
  `upperArm/end`(12, 自由端)。
- **経路上のどこにも分岐(Y字)や自己溶着(真に閉じたループ)は存在しない**。
  Ring-loft Sweep(`getSoftClipBandLoopSweepGeometry`)も単一パスへの一様断面
  掃引であり、構造的に分岐を表現できない。

**技術的含意**: 単一の開いた帯という現行Topologyでも、経路が自分自身に十分
接近する(≒v4/v6/v7で扱ってきたself-intersectionのちょうど逆——意図的に
近接させる)ことで、**2D投影上は「閉じた穴」に見える形状を作ることは可能**
である(Hookの丸まった見た目も、実際にはHook自体は自由端を持つ開いた曲線
だが、`hook/curve/1`〜`hook/start`が近接することで視覚的に「輪」に見えて
いると考えられる、現行実装で既に達成済み)。

一方、**もし実物が真の分岐構造(シャフト接合部が2本の独立した帯へY字に
枝分かれし、それぞれが別の閉ループを形成する)であれば、単一パスTopologyでは
原理的に表現不可能**であり、Topology Revision(分岐構造の追加)が必要になる。

`right_oblique_annotated_view.png`を子細に見ると、シャフト接合部から
**2方向(短い方=Hookのカール、長い方=Pocket/RearFlex/UpperArmへ続く波状部)へ
分かれる、Y字分岐に近い構造**にも見える。これが正しければ、2つの開口は
「Y字分岐の2本の枝それぞれが作る閉ループ」ではなく、**「シャフト・短い枝
(Hook)・長い枝(Bridge以降)の3者に囲まれた負の空間(見かけ上の開口)」**
である可能性があり、その場合は実際の貫通穴ではなく③(見かけ上の開口)に
分類される。この区別は2D写真だけでは確定できない。

---

## 4. Interpretation(仮説、Hypothesisレベル)

| 開口 | 仮説 | 根拠 | 確信度 |
|---|---|---|---|
| 開口1(Hookに近い側) | 既存の`Hook`(`hook/curve/1`〜`hook/start`の近接)に対応 | 現行実装で既に類似の「輪に見える開いた曲線」を実現済み。位置関係(シャフト直近)も整合 | Hypothesis(中) |
| 開口2(もう一方) | `Bridge`(現在は単一T字点、`bridge/end`はEvidence Unknown)に対応する、未モデル化の構造 | 現行`Bridge`が持つ情報量(Position: Unknown)の低さと、写真上の開口の近接位置が一致 | Hypothesis(中、§3のY字分岐仮説とは非排他ではない) |

**未確定事項**: 開口1・2のどちらがどちらに対応するか、あるいは両方とも
Hook/Bridgeとは別の第三の構造(例: シャフトを帯材が2回巻いて固定する
「巻き付け固定」構造)である可能性も排除できない。SOFTCLIPの一般的な
クリップ機構(Interpretation v1.9 §1.4、ChatGPT/shoji既存議論)は「後方の
弯曲部を押すと上部が弾性変形して広がる」という**片持ち梁的な弾性変形**を
前提としており、2つの独立した閉ループが両方とも力学的に必須かは、現時点の
Evidenceからは判断できない。

---

## 5. Geometry実装可否(3択の判定)

指示された3択それぞれについて、現時点のEvidenceで判定可能な範囲を示す。

| 開口 | 判定 | 理由 |
|---|---|---|
| 開口1(Hook対応、Hypothesis) | **①現Topologyで表現可能** | 現行の開いた曲線でも近接により「輪」に見える形状は既に実現済み。座標調整のみで対応可能な範疇 |
| 開口2(Bridge対応、Hypothesis) | **判定保留(②または③、追加確認が必要)** | Y字分岐(②Topology Revisionが必要)か、単一パス上の近接による見かけ上の開口(①/③、座標調整のみ)かを2D写真だけでは判別できない |

**結論**: 3択のうち、開口1は「①現Topologyで表現可能」の方向で収束したが、
**開口2は追加のEvidenceなしに①〜③のいずれかを確定できない**。

---

## 6. 推奨アクション(次のアクション)

1. **shojiによる現物の直接確認(最優先)**: 実物のシャフト接合部を、
   写真では判別しづらい角度(特に開口を真横から見る角度、または開口の
   奥に指や光を通して貫通しているか確認できる角度)から目視・可能なら
   触診で確認する。特に「開口2」がシャフト接合部でY字に分岐した2本の
   独立した帯なのか、単一の帯が近接しているだけなのかを確認したい。
2. **追加写真の取得(shoji確認が難しい場合)**: 開口を真横(帯の厚み方向)
   から撮影した写真があれば、開口が貫通しているか(奥が見えるか)を
   Claude側でも判別できる可能性がある。
3. **Topology Revision Proposalの要否判断**: 上記1または2の結果、Y字分岐が
   確認された場合のみ、Topology Revision Proposal(分岐構造をどう
   `SOFT_CLIP_BAND_LOOP_CONTROL_POINTS`のデータモデルに組み込むかの設計案、
   複数案提示)を別途作成する。確認されなければ、本Auditはここでクローズし
   Band Loop Geometryは現状(v7)維持で問題ない。

**今回のAuditでは形状(`ProsthesisModels.tsx`・Proposal JSON)をいっさい
変更していない**。v7 Baselineはそのまま維持。

---

## 7. 再評価(2026-08-08、User Visual Judgment Priority原則適用後)

shojiの正式指示により、本AuditをLevel A/B/C分類基準で再評価した。

```
Revision Severity: Level C
User Visual Judgment: 基本的に問題なし(shojiがアプリ上?debug=coordsでv7を確認済み、完成度約90%と評価)
Current Geometry Status: 成立(self-intersection=0、NaN/Infinity=0、Build以外の検証はPASS)
Revision Necessity: 不要(現時点)
Reason: 開口2(Bridge対応)について、Y字分岐/単一帯近接/投影上の錯視のいずれかを
2D写真だけでは確定できていない(§3・§5)。これは「現Topologyでは実物の主要構造を
表現できないことが明確に確認された場合」という Level A の要件を満たしておらず、
「複数のTopology解釈が可能」「現物確認が必要」というLevel Cの要件に該当する。
したがって本Auditの結果だけを理由にTopology Revisionを開始しない。
```

**結論**: 開口2の解釈不確定は**Level C(Documentation Only)**として本文書に記録済み
(§4・§5)とし、これ以上の追加調査(shoji現物確認以外)は行わない。v7 Geometry・
現行Topologyをそのまま維持し、Bridge Double-Hole Auditは本再評価をもって
**PASS(Level C記録のみ)としてクローズ**する。将来、shojiの現物確認等で
「現Topologyでは表現不能」というLevel A相当の事実が判明した場合にのみ、
Topology Revision Proposalを別途起票する。

---

## 8. 参照

- `docs/Soft_Clip_Band_Loop_Visual_Verification_v1.0.md` §2(本Auditの発端、
  「Bridge | AUDIT」の指摘)
- `docs/Soft_Clip_Centerline_Proposal_v7.json` / `_Review.md`(現行Baseline、
  無変更)
- `docs/Soft_Clip_Geometry_Editor_Design_v1.0.md`(`hook/end`→`upperArm/end`
  改称の経緯、L45/219)
- `docs/Soft_Clip_M1M2M3_Photogrammetric_Measurement_v1.0.md`(視点依存性に
  関する既存の知見、M2の議論と同種の限界)
- `docs/assets/soft-clip-m1m2m3/`(本Auditで参照した実物写真一式)
