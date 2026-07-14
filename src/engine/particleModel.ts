/**
 * particleModel.ts ─ 骨粉パーティクルの純粋ロジック（Sprint6・Particle）
 *
 * 設計書: KURZ_Voxelアーキテクチャ設計_v2.0.md §副産物「骨粉: 既存particleAmount（材料由来）
 * × 除去速度で量を決定」をそのまま数式化する。実際のレンダリング（THREE.Points・Object Pool
 * によるパーティクル管理）は scenes/InteractiveDrillScene.tsx の DustParticles コンポーネントで
 * 行い、本ファイルは「1秒あたり何個生成すべきか」の純粋な計算のみを担う（node実行で検証可能に
 * するため、three.js依存を持たせない）。
 *
 * 文献: 骨粉は視界を悪化させ、注水・吸引で常時除去する必要がある（Markey et al. 2021,
 * Clin Otolaryngol「Droplet and bone dust contamination from high-speed drilling during
 * mastoidectomy」。Suction irrigatorsで骨粉を洗い流し視認性を確保する、との記載）。
 * バー径が小さい・Diamondバーの方がCuttingバーより飛散が少ないとの報告もあるが、本MVESでは
 * バー種別による飛散量の差は導入せず（要ENT較正の新規パラメータ増加を避けるための判断）、
 * 既存のparticleAmount（材料由来）と除去速度のみで発生量を決定する設計とした。
 */

/** Object Poolの固定サイズ（同時に存在できる最大パーティクル数）。60FPS優先のため控えめに設定。 */
export const PARTICLE_MAX_COUNT = 350;
/** 1粒子の寿命 秒。文献的な定量値はないため、削開の視覚的テンポに合わせた目安値。 */
export const PARTICLE_LIFETIME_SEC = 0.5;
/** particleAmount=1.0・growthRateMmPerSec=1.0mm/sのときの目安発生数（個/秒）。【暫定】 */
export const PARTICLE_SPAWN_BASE_PER_SEC = 60;
/** 1フレームあたりの最大生成数（フレームレート低下時のバースト生成を防ぐ性能保護）。 */
export const PARTICLE_MAX_SPAWN_PER_FRAME = 20;

/**
 * particleSpawnRatePerSec(): 現在の材料・除去速度から、1秒あたりのパーティクル発生数を返す。
 * 設計書の「particleAmount × 除去速度」をそのまま採用（新規の推測係数は追加しない）。
 */
export function particleSpawnRatePerSec(particleAmount: number, growthRateMmPerSec: number): number {
  return PARTICLE_SPAWN_BASE_PER_SEC * Math.max(0, particleAmount) * Math.max(0, growthRateMmPerSec);
}
