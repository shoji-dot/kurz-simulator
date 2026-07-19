/**
 * coordinates/orientation.ts ── Orientation Manager 土台 (Phase1)
 *
 * 座標系統合_解剖エンジン設計書_v1.0 3.8節の土台のみ実装する。
 * 対応: 耳側（右/左）・視点（術者/患者）。
 * 反転変換（左右反転・上下反転・前後反転）の実装はPhase2。
 * 本Phaseでは型安全なAPIの器だけを用意し、呼び出しても入力をそのまま返す
 * （副作用なし・既存コードからは一切呼ばれない）。
 */
import { create } from 'zustand';
import type { EarSide, OrientationState, Vec3Tuple, ViewerRole } from './types';

export const DEFAULT_ORIENTATION: OrientationState = {
  earSide: 'right',
  viewerRole: 'surgeon',
};

interface OrientationStore extends OrientationState {
  setEarSide: (side: EarSide) => void;
  setViewerRole: (role: ViewerRole) => void;
  reset: () => void;
}

/**
 * Orientation状態のZustandストア。既存の useSimStore.ts とは独立した新規ストアであり、
 * Phase1では既存のシーン・ストアから一切参照されない（接続はPhase2以降）。
 */
export const useOrientationStore = create<OrientationStore>((set) => ({
  ...DEFAULT_ORIENTATION,
  setEarSide: (earSide) => set({ earSide }),
  setViewerRole: (viewerRole) => set({ viewerRole }),
  reset: () => set({ ...DEFAULT_ORIENTATION }),
}));

// ── 反転API（Phase2実装予定、シグネチャのみ） ─────────────────────────
let warnedFlipStub = false;
function warnFlipStubOnce(fnName: string): void {
  if (warnedFlipStub) return;
  warnedFlipStub = true;
  console.warn(`[orientation] ${fnName}() はPhase2で実装予定のスタブです。現在は入力をそのまま返します。`);
}

/** 左右反転（耳側切替）。Phase2で実装。現在は恒等関数。 */
export function mirrorLeftRight(p: Vec3Tuple): Vec3Tuple {
  warnFlipStubOnce('mirrorLeftRight');
  return p;
}
/** 上下反転。Phase2で実装。現在は恒等関数。 */
export function flipSuperiorInferior(p: Vec3Tuple): Vec3Tuple {
  warnFlipStubOnce('flipSuperiorInferior');
  return p;
}
/** 前後反転。Phase2で実装。現在は恒等関数。 */
export function flipAnteriorPosterior(p: Vec3Tuple): Vec3Tuple {
  warnFlipStubOnce('flipAnteriorPosterior');
  return p;
}
