/**
 * visToggleConfig.ts — 構造物表示切替（solid → ghost → hidden）の共有UI定数
 *
 * Phase22.2 P0-1: SimulationMode.tsx（PlacementStepの「3D 表示切替」）と
 * StepFlowMode.tsx（STEP6の側頭骨表示トグル）の両方から使う CYCLE / MODE_LABEL /
 * MODE_BG / MODE_FG / SIM_VIS_ITEMS を1箇所に集約した。
 * 元々は SimulationMode.tsx 内に定義されていたが、コンポーネントファイルから
 * 非コンポーネントの定数を export すると react-refresh/only-export-components に
 * 抵触するため、値・ロジックは無変更のまま専用ファイルへ切り出した。
 */
import type { OpacityMode, StructureKey } from './RealAnatomyModels';

export const SIM_VIS_ITEMS: { key: StructureKey; label: string; color: string; indent?: boolean }[] = [
  { key: 'bone',          label: '側頭骨',    color: '#f2ead8' },
  { key: 'malleus',       label: 'ツチ骨',    color: '#e6a93a', indent: true },
  { key: 'incus',         label: 'キヌタ骨',  color: '#d9892a', indent: true },
  { key: 'stapes',          label: 'アブミ骨',  color: '#f2cb54', indent: true },
  { key: 'stapesFootplate', label: '底板',      color: '#00e5ff', indent: true },
  { key: 'tympanic',        label: '鼓膜',      color: '#f8d8c0' },
  { key: 'innerEar',      label: '内耳',      color: '#60b8e0' },
  { key: 'facialNerve',   label: '顔面神経',  color: '#f5d820' },
  { key: 'chordaTympani', label: '鼓索神経',  color: '#f0b830' },
  { key: 'eac',           label: '外耳道',    color: '#d8c8a0' },
  { key: 'roundWindow',   label: '正円窓',    color: '#5888a8' },
];

export const CYCLE: OpacityMode[] = ['solid', 'ghost', 'hidden'];
export const MODE_LABEL: Record<OpacityMode, string> = { solid: '実体', ghost: '半透明', hidden: '非表示' };
export const MODE_BG: Record<OpacityMode, string> = {
  solid:  'var(--color-primary)',
  ghost:  'rgba(var(--color-primary-rgb),0.30)',
  hidden: 'rgba(255,255,255,0.07)',
};
export const MODE_FG: Record<OpacityMode, string> = {
  solid:  'var(--color-bg-primary)',
  ghost:  'var(--color-primary)',
  hidden: 'var(--color-text-muted)',
};
