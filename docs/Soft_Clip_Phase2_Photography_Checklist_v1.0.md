# Soft Clip Phase2 Photography Checklist v1.0

**Status**: Draft(shoji確認待ち)
**Date**: 2026-08-06
**位置づけ**: Soft Clip Phase2/3再開に向けた追加撮影(候補A最優先)を実施する際の
作業指示書(チェックリスト)。**正式仕様書ではない**。撮影条件・優先順位の根拠は
`Soft_Clip_M1M2M3_Photogrammetric_Measurement_v1.0.md`(v1.7/v1.8)に既にあるため、
本文書では再掲せず結論のみを使う(Token Efficiency方針)。撮影完了後の解析・
Centerline Parameter Definitionへの反映は別途行う(本文書のスコープ外)。

---

## 1. 目的

Phase2(Shaft〜Bridge〜Lower Arm)の本質的なBlockerは「写真の枚数不足」ではなく、
以下の2点である。

1. **M2(Hook-like曲げ開始点)が視点によって位置が大きく変わる**(既存Right/Left
   2方向で2.99mm vs 7.68mm、2.1倍の乖離、単一2D写真解析では確定困難)。
2. **Right/Left(直立撮影)・Azimuth Ring(v1.5/v1.6)・Turntable(v1.8)の3セッションが
   同一座標系で結びついていない**(方位角の対応関係が未較正)。

本撮影の目的は、この2点を解消するためのEvidenceを追加取得すること。単に画像を
増やすことが目的ではない。

## 2. 撮影条件(共通)

- **方式**: 被写体固定・カメラを移動する(既存Azimuth Ring撮影 v1.5/v1.6と同一手法。
  被写体を回転させる方式ではない)。
- **基準**: 既存`SoftClip_Right.jpg`= Azimuth 0°、`SoftClip_Left.jpg`= Azimuth 180°
  を基準とする。
- **較正**: mm刻みルーラーを被写体と同一平面に配置する(ノギス相当の直接較正、
  既存Azimuth Ring 4枚と同条件)。
- **フォーカス/フレーミング**: Hook-like terminal部分にピントを合わせる
  (Turntableセッションで一部画像の情報量が不足した反省を踏まえる)。

## 3. 必須カット

| 優先度 | カット | 備考 |
|---|---|---|
| 最優先(候補A) | **Azimuth 90°** | Hookの湾曲平面に最も正対すると予想される方位 |
| 最優先(候補A) | **Azimuth 270°** | 同上(反対側) |
| 次点(候補C、必要であれば) | 現物マーキング後の複数Azimuth撮影 | Lower Arm開始点/Hook曲げ開始点の推定位置に印を付けた上で撮影。候補Aの結果を見てから要否判断 |
| 今回は不要 | 候補D(連続Azimuth動画スイープ) | 候補A/Cの結果次第 |
| 今回は不要 | 候補B(完全Top-down撮影) | 低優先(補完的価値のみ)。候補A/C/Dで解決しない場合に検討 |

## 4. 必須記録事項

- **座標系メモ(新規・最重要)**: 今回の90°/270°が、Right(0°)/Left(180°)/Azimuth
  Ring(v1.5/v1.6)/Turntable(v1.8)のどの回転方向・どの基準からの角度なのかを、
  撮影時にメモとして残す。可能であれば同一撮影セッション内でRight/Leftの少なくとも
  一方を再撮影し、角度の対応関係を直接確認する。
- **Shaft径の確認**: 写真に写っているのがShaft Main Body(8.0mm)かConnection
  Neck(4.0mm)かを現物で確認し記録する(既存の較正不整合はこの取り違えが原因の
  可能性、Measurement記録のUnresolved#1)。

## 5. 撮影後確認項目

- [ ] Azimuth 90°・270°の2カットが撮影されている
- [ ] ルーラーが被写体と同一平面にあり、較正に使えるピントで写っている
- [ ] Hook-like terminal部分がピンボケしていない
- [ ] 座標系メモ(角度の基準・回転方向)が記録されている
- [ ] Shaft径(Main Body/Neck)の識別結果が記録されている
- [ ] Right/Leftとの対応関係(同一個体・向き)が確認できる

## 6. 参照文書

- `docs/Soft_Clip_M1M2M3_Photogrammetric_Measurement_v1.0.md`(v1.7/v1.8、優先順位・
  座標系整理の根拠)
- `docs/Soft_Clip_Pocket_Phase1_Freeze_v1.0.md` §5(引き継ぎ事項)
- `docs/Soft_Clip_Geometry_Improvement_Spec_v1.0.md`(v1.4、Phase Gate)
