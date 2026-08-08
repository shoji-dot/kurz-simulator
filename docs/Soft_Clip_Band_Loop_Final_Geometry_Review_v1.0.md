# Soft Clip Band Loop — Final Geometry Review v1.0

**Status**: **PASS**。v7(commit `a3f4136`)を成立Baselineとして確定。形状変更なし。
**目的**: Coordinate Integration検討の前段として、v7 Geometry全体をLevel A観点で
最終確認する(個別Auditの再実施ではなく、既存Audit結果の統合+全体スコープの
高解像度再検証)。

---

## 1. Executive Summary

v7は、shojiによる実アプリ`?debug=coords`上の3D確認で「基本的に問題なし・約90%
完成」と評価済み([[feedback_visual_judgment_priority]])。本Reviewでは、それ以降に
実施した個別Audit(§2)を統合するとともに、全27制御点にわたる自己交差・NaN・
退化フレームを本番設定の**2倍解像度(STEPS=800)**で再検証し(§3)、dev preview
限定であることのコード上の隔離を再確認した(§4)。

**Level A相当の問題は一切検出されなかった**。v7はGeometry成立性の観点で
**Final Reviewを通過**する。

---

## 2. 個別Auditの統合(既存結果、再実施なし)

| Audit | 対象 | 判定 | Level | 参照 |
|---|---|---|---|---|
| Self-intersection / 最小クリアランス | 全27点、Ribbon境界 | PASS(0件、0.0335→0.0440mm改善) | — | Proposal v7 Review |
| Bridge Double-Hole | シャフト接合部近傍の開口2箇所 | PASS(開口2は要現物確認、Revision不要) | Level C | Bridge Double-Hole Audit v1.0 |
| Terminal Length / Pocket Depth | Hook・Pocket寸法のEvidence一致度 | PASS(旧Auditの参照点誤りを訂正、一致率改善) | Level B/C | Terminal Length/Pocket Depth Check v1.0 |
| Arm Gap / Pocket Maximum Width | RearFlex折り返し両脚間の開口幅 | PASS(Funnel状パターン含め一致、旧「NOT YET MEASURABLE」は見落としと判明) | Level B | Arm Gap/Pocket Max Width Audit v1.0 |

いずれもLevel A(Revision必須)に該当する事項はなく、Level B/Cのみ
(Documentation継続・現物確認待ち)。

---

## 3. 全体スコープの高解像度再検証(本Review新規実施分)

`ProsthesisModels.tsx`から直接抽出した27制御点(コミット済みソースそのもの、
scratch計算からの再構築ではない)に対し、Ribbon境界の厳密交差判定を実施。

| 設定 | crossings | NaN | 退化フレーム |
|---|---:|---:|---:|
| Production(STEPS=400, MIN_GAP=15) | 0 | 0 | 0 |
| **2倍解像度(STEPS=800, MIN_GAP=30)** | **0** | **0** | **0** |

最小クリアランス(Production設定): **0.0440mm**(v6比+31%)。

ソースファイルから抽出した座標と、v7 Review作成時に検証済みの座標は完全一致
(27点すべて誤差1e-6mm以内)——実装反映時の転記ミスがないことも確認した。

---

## 4. Dev Preview隔離の確認

- `SoftClipBandLoopPreview`は`src/scenes/SimScene.tsx`内で
  `coordDebug && product.headType === 'SOFT_CLIP'`の条件下でのみ描画され、
  かつ実際の装着位置から意図的にオフセットした位置(`basePos.x - 10`)に配置される
  (実物写真との形状比較専用、臨床シーンの装着位置とは無関係)。
- `coordDebug`は`isCoordDebugMode()`(`?debug=coords`クエリパラメータ)でのみ
  `true`になる。
- `SoftClipHead()`(実際に処方箋シーンで使われるSoft Clip描画関数、L437)の
  定義本体は、Band Loop関連コード(L676〜)より前に完結しており、参照関係もない。

**結論**: v7のBand Loop Geometryは臨床シーン(通常の処方箋・教育シナリオ表示)に
一切影響しない。

---

## 5. Evidenceパラメータの整合性

| パラメータ | 値 | Evidence Level | v4〜v7で変更 |
|---|---:|---|---|
| Band Width | 0.25mm | A+ | なし |
| Band Thickness | 0.10mm | A+ | なし |
| Coordinate Frame | bandLoopLocal(Global/Shaft座標系とは未統合) | — | なし(Coordinate Integration課題として別管理) |

---

## 6. 未解決事項(Freeze前に確認が必要、Level A/Bいずれでもない運用上の項目)

1. **`vite build`未完走**(Proposal v7 Review §7参照)。TypeCheckはPASS、
   コード変更は座標値のみだがBuild自体は本sandboxセッションで確認できていない。
   Freeze判断前にユーザー環境またはCIでの`npm run build`実行を推奨する
   (Geometry自体の問題ではなく、確認手順上の未了項目)。
2. Bridge開口2・Terminal Length参照点は、shojiの現物確認が得られ次第
   Documentation更新(Level C記録の解消、Geometry変更を伴うとは限らない)。

いずれも**v7 GeometryのRevisionを要求するものではない**(shoji指示のLevel A基準
に該当しない)。

---

## 7. 総合判定

```
Revision Severity: Level 該当なし(全Audit通過)
User Visual Judgment: 基本的に問題なし(shoji確認済み)
Current Geometry Status: 成立
Revision Necessity: 不要
Reason: 全27点にわたる自己交差・NaN・退化フレームを2倍解像度で再確認しゼロを維持。
Bridge/Terminal Length/Pocket Depth/Arm Gap/Pocket Max Widthの個別AuditもすべてPASS
(Level B/Cのみ)。dev preview隔離・Evidenceパラメータも変更なし。v7を成立Geometryの
Final Baselineとして確定してよい。
```

**次のアクション**: Coordinate Integration(Editor Local Coordinates→Shaft-relative
→正式Global Coordinates)は、Evidence(Head Plate 3Dメッシュ等)が未取得のため
P4C-0でBlocked/Deferredとされている既存の判断([[p4_transition_deferred_management]])
と重なる可能性がある。着手前に、Coordinate Integrationの前提Evidenceが今回のSoft
Clip Band Loopでも同様に不足していないか、別途スコープ確認を推奨する。

---

## 8. 参照

- `docs/Soft_Clip_Centerline_Proposal_v7.json` / `_Review.md`
- `docs/Soft_Clip_Band_Loop_Bridge_Double_Hole_Audit_v1.0.md`
- `docs/Soft_Clip_Terminal_Length_Pocket_Depth_Measurement_Definition_Check_v1.0.md`
- `docs/Soft_Clip_Arm_Gap_Pocket_Max_Width_Audit_v1.0.md`
- [[feedback_visual_judgment_priority]]
