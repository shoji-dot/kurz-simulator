# C-4: Rotation Collision Boundary 実機Verification Evidence v1.0

**Status**: Verification Completed
**Date**: 2026-08-16
**目的**: C-3 Freeze文書（`docs/Phase_C3_Prosthesis_Anatomy_Collision_Constraint_Freeze_v1.0.md`
§12）に記録されていた唯一のVerification Gap、

```
Collision Boundary Transition
= Logic-consistent
= Direct real-device verification pending
```

を解消するための実機検証Evidenceを記録する。

**位置付け**: これはC-3の実装変更ではない。コード変更・Collision Logic変更・Foot Proxy/
Candidate B/Foot Tolerance変更・Malleus/Stapes実装・STEP 4D再開・Rotate Smoothness変更・
Scoring/Threshold変更のいずれも伴わない、Evidence固定のみの独立した検証記録である。
C-3のFreeze状態（`C-3 = PASS / CLOSED / FROZEN`）はそのまま維持される。

## 1. 検証対象ロジック（無変更、C-3実装のまま）

```
pointermove → candidate角度計算 → evaluateRotationCandidate()
  → PASS: pendingAngleTiltRef/pendingAngleTiltZRefへ書き込み
  → FAIL: pendingRef不変（直前の安全な角度を維持）
       ↓
useFrame（1フレーム1回）/ pointerup時（Release時ガード） → storeへflush
```

## 2. 実機検証結果

### 2.1 Boundary Approach Test

**Status**: `PASS`

- Safe領域からRotationを開始
- Collision boundaryへ正常に接近
- Boundary到達時に追加Rotationが停止
- Collision Constraintが実機上で正常に機能することを確認

### 2.2 Boundary Release / Reverse Test

**Status**: `PASS`

- Collision boundaryで停止した状態から反対方向へRotation
- 正常にBoundaryから離脱
- Collision後にRotationが永久Freezeしないことを確認
- Reverse Rotationが正常に機能

### 2.3 Small Increment Test

**Status**: `PASS`

- Boundary近傍で微小Rotationを実施
- Collision PASS candidateは正常に反映
- Collision FAIL candidateは既存Placementを変更せず停止
- 微小RotationでもConstraint動作に破綻がないことを確認

### 2.4 TEST起点との組み合わせ

**Status**: `PASS`

- TESTによるPlacement確定
- TEST後にRotate開始
- Collision boundaryへ接近
- BoundaryでRotation停止
- TEST → Rotate → Boundaryの一連の経路が正常に機能することを確認

## 3. 総合判定

```
Boundary Approach Test            PASS
Boundary Release / Reverse Test   PASS
Small Increment Test              PASS
TEST起点との組み合わせ              PASS
```

4項目すべてPASS。

```
Collision Boundary Transition
= VERIFIED
```

C-3 Freeze文書§12「Direct HW = 実機での直接検証は未完了」は本Evidenceにより解消された
（C-3 Freeze文書側に本文書への参照を追記済み、C-3自体の実装・Freeze状態は無変更）。

## 4. スコープ外（本Evidenceで変更・実施していないもの）

```
コード変更                 なし
Collision Logic変更         なし
Foot Proxy変更              なし
Candidate B変更             なし
Foot Contact Tolerance変更  なし
Malleus/Stapes実装          なし
STEP 4D                    再開せず（DEFERREDのまま）
Rotate Smoothness           変更なし
Scoring / Threshold         変更なし
Commit / Push               本文書作成時点では未実施
```

## 5. 参照文書

- `docs/Phase_C3_Prosthesis_Anatomy_Collision_Constraint_Freeze_v1.0.md`（§12, §18）
- `docs/Phase_C2_Prosthesis_Anatomy_Collision_Constraint_Freeze_v1.0.md`
