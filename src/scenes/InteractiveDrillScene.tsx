/**
 * InteractiveDrillScene.tsx  ─── S6: インタラクティブ削開練習
 *
 * 3mm 球形ダイヤモンドバー（KURZ TTP-VARIAC に付属の指示ドリルを想定）で
 * 側頭骨を削開するインタラクティブシミュレーション。
 *
 * フラグメントシェーダーで vWorldPos が drillRadius 内に入ったら discard することで
 * 骨が「溶けるように削れる」視覚表現を実現する。
 *
 * 操作:
 *   Drill ON 時  : 左ドラッグ = 削開 / 右ドラッグ = 視点回転
 *   Drill OFF 時 : 左ドラッグ = 視点回転
 */

import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { OrbitControls, TransformControls } from '@react-three/drei';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { DANGER_ZONES } from '../data/dangerZones';
import { regionAt, BONE_MATERIALS, remainingThicknessToDanger } from '../engine/boneMaterial';
import { DEFAULT_BURR, DRILL_BURRS, getBurrById } from '../engine/drillModel';
import { computeContactAngleDeg, growthRateMmPerSec, growClogLevel, clearClogLevel, advanceDwellMs, growHeatLevel, coolHeatLevel } from '../engine/removalModel';
import { particleSpawnRatePerSec, PARTICLE_MAX_COUNT, PARTICLE_LIFETIME_SEC, PARTICLE_MAX_SPAWN_PER_FRAME } from '../engine/particleModel';
import { DrillAudioEngine, computeAudioState } from '../engine/audioEngine';
import { computeDangerState, dangerTintColor } from '../engine/dangerModel';
import { remainingThicknessToLayer } from '../engine/anatomyLayer'; // Sprint4: AnatomyLayer配線（顔面神経ポリライン統合）
import { selectEducationCard } from '../engine/educationCards';
import {
  computeScoreBreakdown, stepDamageTracker, initialDamageTrackerState,
  appendScoreHistory, generateScoreReview, describeDamageEvent,
} from '../engine/scoring';
import type { ScoreReviewItem } from '../engine/scoring';
import type { RpmPreset, EducationCardContent, ScoreBreakdown, DamageEvent, BoneRegionId } from '../engine/types';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createMeshInsideTest, createBoneVolumeSource } from '../engine/volumeSource';
import { VoxelVolume, baseChunkGridDims, indexToMaterialId } from '../engine/voxelVolume';
import { RemeshQueue } from '../engine/remeshQueue';
import type { RemeshResponsePayload } from '../workers/voxelRemeshWorker';
// Stage1 RC Phase2（Disease Layer、2026-07-15新設）: Voxelとは独立した病変レイヤー。
// 除去ロジックは既存Voxel carveをそのまま流用する設計（[[stage1-rc-design]]参照、推測を避けるため
// 3Dシーンへの配線・描画のみを先行実装し、症例ごとの実配置データは次PRでshojiさん確認後に追加する）。
import { applyDiseaseRemoval, isDiseaseCleared } from '../engine/disease/diseaseRemoval';
import type { DiseaseInstance } from '../engine/disease/types';
import { DISEASE_PRESETS } from '../engine/disease/diseaseCatalog';


// ── FovController: 顕微鏡モード FOV 切替 ─────────────────────────────
const DRILL_VIEW_FOV: Record<string, number> = {
  normal:     38,
  microscope: 12,
  endoscope:  110,
};
function FovController({ viewMode }: { viewMode: string }) {
  const { camera } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = DRILL_VIEW_FOV[viewMode] ?? 38;
    cam.updateProjectionMatrix();
  }, [viewMode, camera]);
  return null;
}

// ── 定数 ──────────────────────────────────────────────────────────────
const DRILL_RADIUS   = 1.5;  // 3mm 径バーの半径 (scene unit = 1mm)
const MIN_HOLE_DIST  = 0.55; // 連続ホール間の最小距離 mm
const DRILL_INTERVAL = 80;   // ms ごとに 1 ホール追加
// Feed Rate（経路分配方式、2026-07-12・Sprint3・[[drill-mves-design]]）: 1フレーム分の
// 除去量(amount)を前フレーム位置→現在位置の掃引経路へサブステップ分配する際の設定。
// growthRateMmPerSecの式自体は不変（二重補正を避けるための設計判断）。
const FEED_RATE_MAX_SUBSTEPS = 6;        // 1フレームあたりの最大サブステップ数（性能上限）
const FEED_RATE_SUBSTEP_FRACTION = 0.5;  // バー半径のこの割合移動するごとに1サブステップ追加
// WARN_DIST/DANGER_DIST は T7 dangerModel.ts の WARN_DIST_MM/DANGER_DIST_MM を re-export importで使用
const BASE_BONE_COLOR = '#c8b090'; // T7: 色透見ブレンドの基準色（DrillBoneの既定骨色と同値）

// T10: 荷重・RPM・バー選択はInteractiveDrillScene本体の内部UIで管理する（旧cutterSizeMm橋渡しを廃止）。

// 乳突洞（Mastoid Antrum）推定位置
// 算出根拠: EAC後壁(X≈2)後方5.5mm, 側頭線(Y≈10)下方3mm, 外側皮質(Z≈26)深部13mm
// Bone.glb 解剖学的実測値 2026-06-24
// Bone.glb 実測値に基づく修正済み座標（2026-06-24検証）
// 深さ: 外側皮質(Z≈22)から12mm → Z=10.0
// 前後: EAC後壁(X≈1.8)後方5.3mm → X=-3.5  ✓
// 上下: 側頭線(Y≈9.4)下方2.4mm → Y=7.0  ✓
// Tegmen（上壁）まで2.7mm → 解剖学的に妥当
const ANTRUM_POS          = new THREE.Vector3(-3.5, 7.0, 10.0);
const ANTRUM_RADIUS       = 3.5;   // 乳突洞半径 mm（成人平均）

// 【文献ベース配置・2026-07-15設計→shojiさん指摘3回を経て確定、要shojiさん再確認】
// 経緯: (1)ANTRUM_POS付近への誤配置を撤去し文献調査に基づき再設計→(2)PTAM system用語へ改訂→
// (3)「耳小骨から離れ外耳道側に飛び出て見える」座標誤りをpygltflib実測で訂正→
// (4)「3球連結は聞いたことがない、文献根拠もない」との指摘を受け単一球へ差し戻し。
//
// 【文献】東野哲也, 本間明宏, 他: 真珠腫進展度分類2015改訂案. Otol Jpn 2015;25:845-850. /
//         Yung M, Tono T, Olszewska E, et al: EAONO/JOS Joint Consensus Statement on the
//         Definitions, Classification and Staging of Middle Ear Cholesteatoma. J Int Adv Otol
//         2017;13:1-8.（shojiさん提供PDF「中耳真珠腫の進展度分類と手術基本手技」より）
//
// 文献の要点（弛緩部型真珠腫、本ケースが該当）: Stage Iは初発区分＝上鼓室（P区画:Prussak腔）に限局。
// 本placeholderは進展前のStage I相当（P区画に限局する単一病変）として単純化した
// （3球連結という複合形状は文献裏付けがないため撤回、[[feedback]]参照）。
//
// 座標の根拠（アブミ骨底板原点系、X+=前方/Y+=上方/Z+=外耳道方向(外側)、pygltflib実測ベース）:
//   P区画起始点=Prussak腔。マレウス実測中心[0.25,4.46,1.06]・頭部Y上限≈6.27に隣接させた
//   （マレウス頸部の外側、Zをマレウス実測Z上限2.75よりわずかに外側へ）。この位置自体は
//   前回shojiさんに「良くなってきました」と確認済みのため変更していない。
//   サイズはshojiさん指摘（実際は5-40mm、10mm程度が妥当）を踏まえ半径4mm（直径8mm）とした。
//
// 【要確認】マレウス/インカス実測に隣接させたことで確からしいが、鼓膜・盾板(scutum)自体の
// 実測座標までは持っておらず、位置関係の細部（Y方向の高さ等）はなお推定。shojiさんがローカルで
// 3D画面を目視し、位置・サイズを耳鼻科医の目で確認・調整することを前提とする
// （BONE_MATERIALS.hardnessと同じ「暫定値→較正待ち」運用、[[stage1-rc-design]]参照）。
function createPlaceholderDiseaseInstances(): DiseaseInstance[] {
  return [
    {
      id: 'cholesteatoma-attic-1',
      type: 'cholesteatoma',
      // P区画: Prussak腔（マレウス頸部の外側に隣接、上記コメント参照）
      // 2026-07-15: 4.0mm→1.33mm→5.0mmを経て一度確定。2026-07-19: 鼓膜・ツチ骨頸部・キヌタ骨短脚を
      // 同時表示した状態でのshojiさん目視により「大きすぎる」との指摘、半径2.0mmへ再確定。
      // Prussak腔の位置自体は同セッションでshojiさん確認済み（「良いのでは」）。
      position: [0.3, 6.0, 3.8],
      radiusMm: 2.0,
      severity: 1,
      adherence: DISEASE_PRESETS.cholesteatoma.defaultAdherence,
      educationTagJa: DISEASE_PRESETS.cholesteatoma.educationTagJa,
      clinicalNoteJa: DISEASE_PRESETS.cholesteatoma.clinicalNoteJa,
    },
  ];
}
const ANTRUM_REACHED_DIST = 2.5;   // 到達判定距離 mm

// ── 骨表面の質感シェーダー（2026-07-13・低ポリ感/「マインクラフト感」対応） ──────────
// 方針（shojiさんへ提案・承認済み、[[drill-mves-design]]参照）: ボクセル解像度(0.6mm)は
// 変更せず、既存BONE_MATERIALSのparticleAmount（部位ごとの骨粉量係数。乳突蜂巣=多孔質
// で高い/骨迷路=緻密で低い、既存の目詰まりモデルで再利用済みの値をそのまま流用）を
// 「表面の多孔質感の強さ」としても再利用し、フラグメントシェーダーでワールド座標ベースの
// 3Dプロシージャルノイズから法線を有限差分で摂動する（UV座標が無いMarching Cubesメッシュへ
// テクスチャを貼る代わりに使われる標準的な手法。3Dノイズ自体はどの向きから見ても継ぎ目が
// 出ないため、2Dテクスチャ用のtriplanar軸ブレンドは不要で、ワールド座標を直接ノイズへ渡すだけでよい）。
// ジオメトリ・頂点数・チャンク再メッシュコストは一切変更しないため、60FPS優先方針への
// 影響はフラグメントシェーダー内の追加計算のみに限定される。
// 【要ローカル見た目確認】sandboxでは実描画不可のため、強度(BONE_BUMP_AMOUNT)は暫定値。
// 効きすぎ/効かなすぎの場合はこの1行の値のみ調整すればよい。見た目が破綻する場合は
// ENABLE_BONE_SURFACE_DETAIL を false にすれば即座に旧来の平滑シェーディングへ戻せる。
const ENABLE_BONE_SURFACE_DETAIL = true;
// 2026-07-13追補: shojiさんローカル確認で「表面が黒カビみたいに見える部分がある、商売視点で
// キレイ目にしたい」とのフィードバック。強い法線摂動×点光源の組み合わせで暗い斑点状の陰影が
// 強調されていたのが原因と考えられるため、ブレンド比率・振幅・ノイズ周波数すべてを大幅に
// 弱め、控えめな質感（輪郭のごまかしよりも「艶のある滑らかな骨」寄り）へ調整した。
const BONE_BUMP_AMOUNT = 0.35; // 0-1: 摂動法線と元の法線のブレンド比率（1=摂動を全反映、旧0.9から弱めた）

const BONE_SURFACE_DETAIL_GLSL = {
  vertexDeclare: `
    attribute float porosity;
    varying vec3 vBoneWorldPos;
    varying vec3 vBoneWorldNormal;
    varying float vPorosity;
  `,
  vertexInject: `
    vBoneWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
    vBoneWorldNormal = normalize( mat3( modelMatrix ) * objectNormal );
    vPorosity = porosity;
  `,
  fragmentDeclare: `
    varying vec3 vBoneWorldPos;
    varying vec3 vBoneWorldNormal;
    varying float vPorosity;

    float boneHash13(vec3 p) {
      p = fract(p * 0.3183099 + 0.1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float boneNoise3(vec3 x) {
      vec3 i = floor(x);
      vec3 f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      float n000 = boneHash13(i + vec3(0.0, 0.0, 0.0));
      float n100 = boneHash13(i + vec3(1.0, 0.0, 0.0));
      float n010 = boneHash13(i + vec3(0.0, 1.0, 0.0));
      float n110 = boneHash13(i + vec3(1.0, 1.0, 0.0));
      float n001 = boneHash13(i + vec3(0.0, 0.0, 1.0));
      float n101 = boneHash13(i + vec3(1.0, 0.0, 1.0));
      float n011 = boneHash13(i + vec3(0.0, 1.0, 1.0));
      float n111 = boneHash13(i + vec3(1.0, 1.0, 1.0));
      return mix(
        mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
        mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
        f.z
      );
    }
    // 2オクターブfbm: 多孔質な骨表面の細かいピット感を表現（骨梁・蜂巣状の質感の簡易近似）
    float boneFbm(vec3 p) {
      float n = boneNoise3(p) * 0.65;
      n += boneNoise3(p * 2.7) * 0.35;
      return n;
    }
    // 有限差分による法線摂動（UV/タンジェント空間なしでも成立する手法。法線に直交する
    // 2方向を都度構成し、その方向へのノイズ勾配だけ法線を傾ける）
    vec3 boneBumpNormal(vec3 worldPos, vec3 worldNormal, float porosityAmt) {
      // 2026-07-13: scaleを6.0→3.0（ピットを大きく・粗さを抑える）、ampを弱めて
      // 「黒カビ」に見えていた高周波・高振幅の暗い斑点を解消（下記amp参照）
      float scale = 3.0;  // ノイズの空間周波数（1/mm相当、ピットの大きさの目安）
      float eps = 0.15;   // 有限差分オフセット mm

      vec3 up = abs(worldNormal.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
      vec3 t = normalize(cross(up, worldNormal));
      vec3 b = normalize(cross(worldNormal, t));

      float h0 = boneFbm(worldPos * scale);
      float ht = boneFbm((worldPos + t * eps) * scale);
      float hb = boneFbm((worldPos + b * eps) * scale);

      // particleAmount(porosity)が高い部位（乳突蜂巣等）ほど強く、骨迷路等の緻密骨は
      // ほぼ滑らかに近づける（既存BONE_MATERIALS.particleAmountの値をそのまま流用、
      // 新規の推測パラメータは追加しない）。2026-07-13: 上限0.16→0.045へ大幅に弱め、
      // 「黒カビ」に見えていた強い暗部を解消（商売視点でキレイ目に、とのフィードバック対応）
      float amp = mix(0.006, 0.045, clamp(porosityAmt, 0.0, 1.0));
      vec3 perturbed = worldNormal - t * ((ht - h0) / eps) * amp - b * ((hb - h0) / eps) * amp;
      return normalize(perturbed);
    }
  `,
};

// ── DrillBone ─────────────────────────────────────────────────────────
// V5: レイキャスト対象を実ボクセル幾何へ一本化。VoxelVolume/RemeshQueueをコンポーネント
// 生存期間中ずっと保持し、carveRef経由でDrillCanvas3Dから毎フレーム実際のボクセル除去
// （applyBrush）を呼び出せるようにする。再メッシュ結果はチャンク単位でGroupへ増分反映
// （変化したチャンクだけを差し替え・三角形0枚になったチャンクは削除）するため、
// 「削った箇所がそのまま当たり判定になる＝奥へ削り進められる」挙動が成立する（設計書V5）。
// V4のdiscardシェーダー方式（頂点色は変わるが実ジオメトリは不変の見た目だけの穴）は廃止。
type VisMode = 'solid' | 'ghost' | 'hidden';

interface DrillBoneProps {
  /** DrillCanvas3Dが毎フレーム呼び出す実ボクセル除去関数。DrillBoneがマウント後に設定する。 */
  carveRef: React.MutableRefObject<((center: THREE.Vector3, radiusMm: number, amount: number) => void) | null>;
  /** 2026-07-13: 宙に浮いた骨片除去（VoxelVolume.pruneDisconnectedIslands）を
      DrillCanvas3D側のstopDrilling()から呼び出すためのref（carveRefと同じ配線パターン）。 */
  pruneIslandsRef: React.MutableRefObject<(() => void) | null>;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp:   (e: ThreeEvent<PointerEvent>) => void;
  boneVis:       VisMode;
}

function DrillBone({ carveRef, pruneIslandsRef, onPointerMove, onPointerDown, onPointerUp, boneVis }: DrillBoneProps) {
  const { scene } = useGLTF('/models/Bone.glb');
  const groupRef = useRef<THREE.Group>(null!);
  const chunkMeshesRef = useRef(new Map<string, THREE.Mesh>());

  // 頂点カラー(BONE_MATERIALS色)をそのまま表示する単一マテリアル（全チャンクで共有）
  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color:        new THREE.Color('#ffffff'),
      vertexColors: true,
      roughness:    0.42,
      metalness:    0.05,
      side:         THREE.DoubleSide,
      transparent:  true,
      opacity:      1.0,
      depthWrite:   true,
    });
    // 2026-07-13: 骨表面の質感（低ポリ感対応、BONE_SURFACE_DETAIL_GLSL参照）。
    // ジオメトリ・頂点数は無変更、フラグメントシェーダーでのみ法線を摂動する。
    if (ENABLE_BONE_SURFACE_DETAIL) {
      mat.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `${BONE_SURFACE_DETAIL_GLSL.vertexDeclare}\n#include <common>`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>\n${BONE_SURFACE_DETAIL_GLSL.vertexInject}`);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `${BONE_SURFACE_DETAIL_GLSL.fragmentDeclare}\n#include <common>`)
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          {
            vec3 boneWorldNormal = normalize(vBoneWorldNormal);
            vec3 perturbedWorld = boneBumpNormal(vBoneWorldPos, boneWorldNormal, vPorosity);
            vec3 perturbedView = normalize(mat3(viewMatrix) * perturbedWorld);
            normal = normalize(mix(normal, perturbedView, ${BONE_BUMP_AMOUNT.toFixed(2)}));
          }`);
      };
    }
    return mat;
  }, []);

  // Bone.glb → ワールド座標系ジオメトリ（VoxelVolumeのinsideTest構築用、volumeSource.ts参照）
  const worldGeometry = useMemo(() => {
    scene.updateMatrixWorld(true);
    const geos: THREE.BufferGeometry[] = [];
    scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      const g = mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld);
      geos.push(g);
    });
    return geos.length === 1 ? geos[0] : (mergeGeometries(geos, false) ?? geos[0]);
  }, [scene]);

  // Marching Cubes応答を1チャンク分シーンへ反映する（新規追加/差し替え/三角形0枚なら削除）
  const applyChunkResult = useCallback((payload: RemeshResponsePayload) => {
    const key = `${payload.coord.tier}:${payload.coord.cx},${payload.coord.cy},${payload.coord.cz}`;
    const existing = chunkMeshesRef.current.get(key);

    if (payload.vertexCount === 0) {
      if (existing) {
        groupRef.current.remove(existing);
        existing.geometry.dispose();
        chunkMeshesRef.current.delete(key);
      }
      return;
    }

    const colors = new Float32Array(payload.vertexCount * 3);
    // 2026-07-13: 骨表面質感シェーダー用（既存particleAmountを多孔質感の強さとして再利用、
    // 新規の推測パラメータは追加しない。BONE_SURFACE_DETAIL_GLSL参照）
    const porosity = new Float32Array(payload.vertexCount);
    for (let i = 0; i < payload.vertexCount; i++) {
      const regionId = indexToMaterialId(payload.materialIndices[i]);
      const c = new THREE.Color(BONE_MATERIALS[regionId].color);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      porosity[i] = BONE_MATERIALS[regionId].particleAmount;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(payload.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(payload.normals, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('porosity', new THREE.BufferAttribute(porosity, 1));

    if (existing) {
      existing.geometry.dispose();
      existing.geometry = geo;
    } else {
      const mesh = new THREE.Mesh(geo, material);
      groupRef.current.add(mesh);
      chunkMeshesRef.current.set(key, mesh);
    }
  }, [material]);

  // マウント中ずっと生存: VoxelVolume構築 → 全Baseチャンク初回一括生成 → 以後はcarveRef経由の
  // 実削開で発生したダーティチャンクをその都度再メッシュ化する（RemeshQueueが120msスロットル）。
  useEffect(() => {
    let cancelled = false;
    const insideTest = createMeshInsideTest(worldGeometry);
    const source = createBoneVolumeSource(insideTest);
    const volume = new VoxelVolume(source);
    const queue = new RemeshQueue();

    const unsubscribe = queue.onResult((payload) => {
      if (cancelled) return;
      applyChunkResult(payload);
    });

    // 初回一括生成: 先に全Baseチャンクを生成してから再メッシュ要求する（2パス化）。
    // ghost layer（getHalo()）は隣接チャンクが既に存在している前提で境界1層分を読むため、
    // 生成と要求を同一ループで行うと後続チャンクがまだ存在せずhaloが欠けてしまう
    // （2026-07-12・法線継ぎ目修正、[[drill-mves-design]]参照）。
    const { nx, ny, nz } = baseChunkGridDims();
    const initialChunks: ReturnType<typeof volume.getOrCreateChunk>[] = [];
    for (let cz = 0; cz < nz; cz++) {
      for (let cy = 0; cy < ny; cy++) {
        for (let cx = 0; cx < nx; cx++) {
          initialChunks.push(volume.getOrCreateChunk(cx, cy, cz, 'base'));
        }
      }
    }
    for (const chunk of initialChunks) {
      queue.requestRemesh(chunk, volume.getHalo(chunk));
    }

    carveRef.current = (center, radiusMm, amount) => {
      volume.applyBrush({ center, radiusMm, amount });
      for (const chunk of volume.getDirtyChunks()) {
        queue.requestRemesh(chunk, volume.getHalo(chunk));
        volume.consumeDirty(chunk);
      }
    };

    // 2026-07-13: 宙に浮いた骨片除去。stopDrilling()（ドリルを離した瞬間）からのみ呼ばれる想定
    // （毎フレーム実行はしない。詳細はvoxelVolume.ts pruneDisconnectedIslands()のdocコメント参照）。
    pruneIslandsRef.current = () => {
      const changed = volume.pruneDisconnectedIslands();
      for (const chunk of changed) {
        queue.requestRemesh(chunk, volume.getHalo(chunk));
        volume.consumeDirty(chunk);
      }
    };

    return () => {
      cancelled = true;
      carveRef.current = null;
      pruneIslandsRef.current = null;
      unsubscribe();
      queue.dispose();
      for (const mesh of chunkMeshesRef.current.values()) mesh.geometry.dispose();
      chunkMeshesRef.current.clear();
    };
  }, [worldGeometry, applyChunkResult, carveRef, pruneIslandsRef]);

  useEffect(() => {
    material.opacity     = boneVis === 'ghost' ? 0.18 : 1.0;
    material.transparent = boneVis === 'ghost';
    material.depthWrite  = boneVis !== 'ghost';
    material.needsUpdate = true;
  }, [boneVis, material]);

  return (
    <group
      ref={groupRef}
      visible={boneVis !== 'hidden'}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    />
  );
}

// ── DrillOssicles: 耳小骨（Malleus / Incus / Stapes）────────────────
const OSSICLE_COLORS = ['#e6a93a', '#d9892a', '#f2cb54'] as const;

function DrillOssicles({ mode }: { mode: VisMode }) {
  const { scene: mScene } = useGLTF('/models/Malleus.glb');
  const { scene: iScene } = useGLTF('/models/Incus.glb');
  const { scene: sScene } = useGLTF('/models/Stapes.glb');
  const matsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  const clones = useMemo(() => {
    matsRef.current = [];
    return [mScene, iScene, sScene].map((scene, idx) => {
      const c = scene.clone(true);
      const mat = new THREE.MeshStandardMaterial({
        color:       OSSICLE_COLORS[idx],
        roughness:   0.32,
        metalness:   0.35,
        transparent: true,
        opacity:     1.0,
        depthWrite:  true,
        side:        THREE.DoubleSide,
      });
      matsRef.current.push(mat);
      c.traverse((obj) => {
        if (!(obj as THREE.Mesh).isMesh) return;
        const mesh = obj as THREE.Mesh;
        const geo = mesh.geometry.clone();
        geo.deleteAttribute('normal');
        geo.computeVertexNormals();
        mesh.geometry = geo;
        mesh.material = mat;
      });
      return c;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mScene, iScene, sScene]);

  useEffect(() => {
    const op = mode === 'ghost' ? 0.32 : 1.0;
    matsRef.current.forEach(mat => {
      mat.opacity    = op;
      mat.transparent = mode === 'ghost';
      mat.depthWrite = mode !== 'ghost';
      mat.needsUpdate = true;
    });
  }, [mode]);

  if (mode === 'hidden') return null;

  return (
    <>
      {clones.map((clone, i) => (
        <primitive key={i} object={clone} />
      ))}
    </>
  );
}

// ── DrillNerves: 神経・頸動脈 GLB ────────────────────────────────────
// 色の根拠: 耳科解剖アトラスの標準配色
//   顔面神経       → 黄色 (#f5d820) ← 最重要危険構造
//   鼓索神経       → オレンジ (#f0b830)
//   内耳神経       → ライムイエロー (#d4e840)
//   内頸動脈       → 赤 (#e84040)
const NERVE_DATA = [
  { url: '/models/Facial_Nerve.glb',            color: '#f5d820', label: '顔面神経' },
  { url: '/models/Chorda_Tympani.glb',          color: '#f0b830', label: '鼓索神経' },
  { url: '/models/Cochleo_Vestibular_Nerve.glb', color: '#d4e840', label: '内耳神経' },
  { url: '/models/Carotis.glb',                 color: '#e84040', label: '内頸動脈' },
] as const;

function DrillNerve({ url, color, mode }: { url: string; color: string; mode: VisMode }) {
  const { scene } = useGLTF(url);
  const matRef = useRef<THREE.MeshStandardMaterial | null>(null);

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness:   0.58,
      metalness:   0.0,
      transparent: true,
      opacity:     0.88,
      depthWrite:  false,
      side:        THREE.DoubleSide,
    });
    matRef.current = mat;
    c.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      const geo = mesh.geometry.clone();
      geo.deleteAttribute('normal');
      geo.computeVertexNormals();
      mesh.geometry = geo;
      mesh.material = mat;
      mesh.renderOrder = 1;
    });
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, color]);

  useEffect(() => {
    const mat = matRef.current;
    if (!mat) return;
    const op = mode === 'solid' ? 0.88 : mode === 'ghost' ? 0.28 : 0;
    mat.opacity     = op;
    mat.transparent = true;
    mat.depthWrite  = false;
    mat.needsUpdate = true;
  }, [mode]);

  if (mode === 'hidden') return null;
  return <primitive object={cloned} />;
}

function DrillNerves({ mode }: { mode: VisMode }) {
  if (mode === 'hidden') return null;
  return (
    <>
      {NERVE_DATA.map(({ url, color }) => (
        <DrillNerve key={url} url={url} color={color} mode={mode} />
      ))}
    </>
  );
}

// ── DrillCursor: Round Carbide Bur #8 (8枚刃 球形バー) ───────────────
function DrillCursor({ groupRef, rotation, sizeMm = 3 }: {
  groupRef: React.RefObject<THREE.Group>;
  rotation: 'CW' | 'CCW';
  sizeMm?: 1 | 2 | 3;
}) {
  const burrScaleVal = sizeMm / 3;
  const burrRef = useRef<THREE.Group>(null!);
  const dir = rotation === 'CW' ? 1 : -1;

  // 8枚螺旋フルート: 球面上を120°螺旋するTubeGeometry
  const fluteGeos = useMemo(() => {
    const R = DRILL_RADIUS;
    return Array.from({ length: 8 }, (_, idx) => {
      const baseAngle = (idx / 8) * Math.PI * 2;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        // phi: 南極付近(0.12π) → 北極付近(0.88π)
        const phi = Math.PI * (0.12 + 0.76 * t);
        // theta: 1刃あたり120°螺旋
        const theta = baseAngle + t * (2 * Math.PI / 3);
        pts.push(new THREE.Vector3(
          R * Math.sin(phi) * Math.cos(theta),
          R * Math.cos(phi),
          R * Math.sin(phi) * Math.sin(theta),
        ));
      }
      return new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(pts), 14, 0.075, 4, false
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    if (burrRef.current) burrRef.current.rotation.y += dir * 60 * delta;
  });

  return (
    <group ref={groupRef} visible={false} scale={[burrScaleVal, burrScaleVal, burrScaleVal]}>
      <group ref={burrRef}>
        {/* タングステンカーバイド球体 */}
        <mesh>
          <sphereGeometry args={[DRILL_RADIUS, 24, 16]} />
          <meshStandardMaterial color="#b0afa0" metalness={0.82} roughness={0.22} />
        </mesh>
        {/* 8枚螺旋フルート（球面上の刃） */}
        {fluteGeos.map((geo, i) => (
          <mesh key={i} geometry={geo}>
            <meshStandardMaterial color="#787870" metalness={0.90} roughness={0.12} />
          </mesh>
        ))}
      </group>
      {/* ネック（球→シャフト接続部）*/}
      <mesh position={[0, DRILL_RADIUS + 0.7, 0]}>
        <cylinderGeometry args={[0.18, 0.30, 1.4, 10]} />
        <meshStandardMaterial color="#b8b8a8" metalness={0.88} roughness={0.14} />
      </mesh>
      {/* シャフト */}
      <mesh position={[0, DRILL_RADIUS + 5.0, 0]}>
        <cylinderGeometry args={[0.22, 0.30, 8.0, 12]} />
        <meshStandardMaterial color="#c0c0b0" metalness={0.88} roughness={0.12} />
      </mesh>
      {/* アクティブ時グローリング */}
      <mesh rotation={[Math.PI/2, 0, 0]} renderOrder={2}>
        <torusGeometry args={[DRILL_RADIUS * 1.3, 0.12, 8, 48]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.55} depthTest={false} />
      </mesh>
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════
// DustParticles: 骨粉パーティクル（Sprint6・Particle）
//
// Object Pool方式: 固定サイズのFloat32Array上でring-bufferアロケーションし、
// 生成・破棄のたびにオブジェクトを作らない（GC負荷ゼロ、60FPS維持を優先）。
// あえてカスタムシェーダーは使わずTHREE.PointsMaterial（vertexColors）のみで構成する
// （骨表面シェーダーで「黒カビっぽい」との指摘を受けた反省を踏まえ、見た目の制御が難しい
// カスタムシェーダーの追加リスクを避ける判断。文献: Markey et al. 2021、[[drill-mves-design]]参照）。
// 寿命が尽きた粒子はY座標を-9999へ飛ばして非表示にする（フェード用シェーダー不要の簡易処理。
// 寿命0.5秒・粒径が小さいため視覚的な破綻はない）。
// ══════════════════════════════════════════════════════════════════
function DustParticles({ spawnRef, visible }: {
  spawnRef: React.MutableRefObject<((center: THREE.Vector3, count: number, colorHex: THREE.ColorRepresentation) => void) | null>;
  visible: boolean;
}) {
  const pointsRef   = useRef<THREE.Points>(null!);
  const cursorIdxRef = useRef(0);

  const pool = useMemo(() => {
    const positions  = new Float32Array(PARTICLE_MAX_COUNT * 3);
    const colors     = new Float32Array(PARTICLE_MAX_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_MAX_COUNT * 3);
    const ages       = new Float32Array(PARTICLE_MAX_COUNT).fill(PARTICLE_LIFETIME_SEC + 1); // 全個非アクティブから開始
    for (let i = 0; i < PARTICLE_MAX_COUNT; i++) positions[i * 3 + 1] = -9999; // 原点(0,0,0)に描画されるのを防ぐ
    return { positions, colors, velocities, ages };
  }, []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pool.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(pool.colors, 3));
    return geo;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const material = useMemo(() => new THREE.PointsMaterial({
    size: 0.12,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    sizeAttenuation: true,
    depthWrite: false,
  }), []);

  // carveRefと同じパターン: 親(DrillCanvas3D)のuseFrameから直接呼べるよう、生成関数をrefへ注入する
  useEffect(() => {
    spawnRef.current = (center, count, colorHex) => {
      const tmpColor = new THREE.Color(colorHex).lerp(new THREE.Color('#ffffff'), 0.45); // 骨色→白寄りで「粉」らしい淡さに
      for (let n = 0; n < count; n++) {
        const i = cursorIdxRef.current;
        cursorIdxRef.current = (i + 1) % PARTICLE_MAX_COUNT;
        pool.positions[i * 3]     = center.x;
        pool.positions[i * 3 + 1] = center.y;
        pool.positions[i * 3 + 2] = center.z;
        // ランダムな外向き＋上向きの初速（削開点から飛散する見た目）
        const theta = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 2.5;
        pool.velocities[i * 3]     = Math.cos(theta) * speed * 0.5;
        pool.velocities[i * 3 + 1] = 1.0 + Math.random() * 1.5;
        pool.velocities[i * 3 + 2] = Math.sin(theta) * speed * 0.5;
        pool.colors[i * 3]     = tmpColor.r;
        pool.colors[i * 3 + 1] = tmpColor.g;
        pool.colors[i * 3 + 2] = tmpColor.b;
        pool.ages[i] = 0;
      }
    };
    return () => { spawnRef.current = null; };
  }, [spawnRef, pool]);

  useFrame((_, delta) => {
    let anyActive = false;
    for (let i = 0; i < PARTICLE_MAX_COUNT; i++) {
      if (pool.ages[i] > PARTICLE_LIFETIME_SEC) continue;
      anyActive = true;
      // Object Pool: typed array内容のその場更新はGCゼロを保つための意図的な設計（[[drill-mves-design]]参照）
      // eslint-disable-next-line react-hooks/immutability
      pool.ages[i] += delta;
      if (pool.ages[i] > PARTICLE_LIFETIME_SEC) {
        pool.positions[i * 3 + 1] = -9999; // 寿命切れ→画面外へ退避（フェードシェーダー不要の簡易処理）
        continue;
      }
      pool.velocities[i * 3 + 1] -= 4.0 * delta; // 重力
      pool.positions[i * 3]     += pool.velocities[i * 3]     * delta;
      pool.positions[i * 3 + 1] += pool.velocities[i * 3 + 1] * delta;
      pool.positions[i * 3 + 2] += pool.velocities[i * 3 + 2] * delta;
    }
    if (anyActive) {
      // BufferGeometryのneedsUpdateはthree.jsの標準的な差分更新API（毎フレーム再生成を避ける意図的使用）
      // eslint-disable-next-line react-hooks/immutability
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    }
  });

  return <points ref={pointsRef} geometry={geometry} material={material} visible={visible} frustumCulled={false} />;
}

// ── 方向ガイド計算 ────────────────────────────────────────────────────
// ドリル位置から ANTRUM_POS への方向を外科的用語で返す
// 座標軸: X+=前方, Y+=上方, Z+=外耳道方向(外側)
function computeDrillDirection(point: THREE.Vector3): string | null {
  const diff = new THREE.Vector3().subVectors(ANTRUM_POS, point);
  if (diff.length() < ANTRUM_REACHED_DIST) return null;

  // 各成分の解剖学的方向ラベル
  const components = [
    { label: diff.z < 0 ? '深部' : '外側', abs: Math.abs(diff.z) },
    { label: diff.x < 0 ? '後方' : '前方', abs: Math.abs(diff.x) },
    { label: diff.y > 0 ? '上方' : '下方', abs: Math.abs(diff.y) },
  ].sort((a, b) => b.abs - a.abs);

  const primary = components[0];
  const secondary = components[1];

  // 第2成分が第1の50%以上なら両方表示
  let guide = `→ ${primary.label}へ削開`;
  if (secondary.abs > primary.abs * 0.5) {
    guide += ` + ${secondary.label}`;
  }
  return guide;
}

// ══════════════════════════════════════════════════════════════════
// MastoidGuide: 乳突削開 教育ガイドレイヤー
//
// 座標系: アブミ骨底板 = (0,0,0), Y+ = 上方, Z+ = 外耳道方向（外側）
// ⚠ 座標は Bone.glb 推定値。3D ビューで確認後に GUIDE 定数を調整。
// ══════════════════════════════════════════════════════════════════
type V3 = [number, number, number];

// 【2026-07-15新設→同日ドラッグ式ギズモへ改訂】ガイド（MacEwen三角・すり鉢状削開ガイド）位置調整機能。
// shojiさん要望: 「ガイドの位置や方向を自分で決めたい」。当初は数値入力パネル方式を選んだが、
// (1)三角形・リング等がガイド調整に連動しない実装バグ、(2)Y軸回転のみで縦回転ができない、
// (3)拡大縮小もしたい、という3点の指摘を受け、three-stdlib TransformControls
// （@react-three/drei）によるドラッグ式3Dギズモへ全面的に作り直した。
// 対象は「削開開始点の推奨ガイド」のみ（Start Zone/MacEwen三角/中心ドット/青バー/すり鉢錐台/
// 深度リング/削開方向矢印）。乳突洞ターゲット球（ANTRUM_POS）と専門医モードの解剖ランドマーク
// （LANDMARKS）は実測固定値のため調整対象に含めない。
interface GuideTransform {
  x: number; y: number; z: number;
  rx: number; ry: number; rz: number; // 度
  sx: number; sy: number; sz: number;
}

const GUIDE = {
  // MacEwen Triangle (Suprameatal Triangle) ── 外側皮質面上の三角
  // ⚠ Z値は Bone.glb 実測値（2026-06-24 pygltflib計測）
  CENTER:    [-2.5,  6,   26] as V3,
  SUPERIOR:  [-2.5, 10,   19] as V3,  // 上角: Temporal Line (Z実測≈19)
  ANTERIOR:  [ 2.0,  3.5, 29] as V3,  // 前角: Posterior EAC Wall (Z実測≈29)
  POSTERIOR: [-7.0,  4,   22] as V3,  // 後角: Predicted sigmoid line (Z実測≈23)

  // Mastoidectomy Start Zone（MacEwen 周囲の安全削開域）
  START_ZONE: [
    [-2.5, 10, 19], [ 4.0, 10, 22], [-11,  9.5, 10],
    [-11,  1, 10],  [ 3,   1, 29],
  ] as V3[],

  // Saucerization Volume（すり鉢状削開ガイド）
  SURFACE_Z:   26,    // 外側皮質面 Z（Bone.glb 実測値）
  DEPTH:       14,    // 削開深度 mm
  OUTER_R:     5.0,   // 外側開口半径
  INNER_R:     1.5,   // 深部半径

  DEPTH_RINGS: [
    { depth: 5,  color: '#4ade80' },
    { depth: 10, color: '#fbbf24' },
    { depth: 14, color: '#f97316' },
  ],
  ANTRUM_DEPTH: 13,
} as const;

// GUIDE内の各点を「GUIDE.CENTERからの相対座標（ローカル座標）」へ変換。
// TransformControlsで動かす<group>の子はこのローカル座標で配置し、group自体の
// position/rotation/scaleだけをドラッグ操作で変更する設計にする（子の座標は不変のため
// useMemo([])のジオメトリキャッシュも安全に機能する）。
function sub3(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
const GUIDE_LOCAL = {
  SUPERIOR:     sub3(GUIDE.SUPERIOR,  GUIDE.CENTER),
  ANTERIOR:     sub3(GUIDE.ANTERIOR,  GUIDE.CENTER),
  POSTERIOR:    sub3(GUIDE.POSTERIOR, GUIDE.CENTER),
  START_ZONE:   GUIDE.START_ZONE.map((p) => sub3(p, GUIDE.CENTER)) as V3[],
  TEMPORAL_BAR: sub3([(-12 + 4) / 2, GUIDE.SUPERIOR[1], GUIDE.SUPERIOR[2] - 0.5], GUIDE.CENTER),
  ARROW:        sub3([GUIDE.CENTER[0] + 4, GUIDE.CENTER[1] + 2.5, GUIDE.CENTER[2] + 1.5], GUIDE.CENTER),
  // 【2026-07-15】乳突洞ターゲット球もガイド編集グループへ含める（shojiさん指摘: 三角形・錐台と
  // 連動して動くべき）。ANTRUM_POS自体（ドリル中の距離判定等、実際のゲーム内判定に使う定数）は
  // 変更しない。ここではガイド編集時の「見た目上の初期位置」をANTRUM_POSと一致させるための
  // ローカル座標変換のみ行う。
  ANTRUM:       sub3([ANTRUM_POS.x, ANTRUM_POS.y, ANTRUM_POS.z], GUIDE.CENTER),
};

// 【2026-07-15 shojiさん確定 → 2026-07-21 shojiさん再調整（暫定）】ガイド編集（TransformControls）で
// 調整した位置・向き・縮尺。これを新しい初期状態（editModeを開いた直後の表示・reset後の戻り先）とする。
// 2026-07-21: shojiさん（医師ではない立場）の見た目判断による再調整。今後、医師からの指摘があれば
// 再修正する可能性がある暫定値（Step2 MacEwen三角調整、優先順位: 解剖学的整合性→視認性→
// TransformControls干渉→Danger Zone重ね表示との両立）。
const GUIDE_TRANSFORM_DEFAULT = {
  position:    [3.2, 9.1, 26.3] as V3,
  rotationDeg: [-8, 2, -85] as V3,
  scale:       [0.63, 0.63, 1.08] as V3,
};

// 専門医モード用ランドマーク（Bone.glb 実測値 2026-06-24）
const LANDMARKS = {
  // EAC後壁: 外側面重心
  PCW_CENTER:  [ 1.8,  2.8, 29.0] as V3,
  PCW_WIDTH:   4.0,  // X幅 mm
  PCW_HEIGHT:  6.0,  // Y高さ mm

  // Temporal Line: Y≈9 の稜線（X=-12〜5）
  TL_Y:        9.0,
  TL_Z:        22.0,  // 乳突側 Z
  TL_X_LEFT:  -12.0,
  TL_X_RIGHT:   4.0,

  // S状静脈洞予測: X<-8 の後方皮質中心
  SIG_CENTER:  [-12.0, 4.0, 20.0] as V3,
  SIG_RADIUS:   4.0,
} as const;

function TriMesh({ v0, v1, v2, color, opacity, wire = false }: {
  v0: V3; v1: V3; v2: V3; color: string; opacity: number; wire?: boolean;
}) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      ...v0, ...v1, ...v2, ...v0, ...v2, ...v1,
    ], 3));
    g.computeVertexNormals();
    return g;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <mesh geometry={geo} renderOrder={1}>
      <meshBasicMaterial color={color} transparent opacity={opacity}
        side={THREE.DoubleSide} wireframe={wire} depthWrite={false} />
    </mesh>
  );
}

function FanMesh({ verts, color, opacity }: { verts: V3[]; color: string; opacity: number }) {
  const geo = useMemo(() => {
    const flat: number[] = [];
    for (let i = 1; i < verts.length - 1; i++) {
      flat.push(...verts[0], ...verts[i], ...verts[i+1]);
      flat.push(...verts[0], ...verts[i+1], ...verts[i]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(flat, 3));
    g.computeVertexNormals();
    return g;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <mesh geometry={geo} renderOrder={1}>
      <meshBasicMaterial color={color} transparent opacity={opacity}
        side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function MastoidGuide({
  expertMode,
  editMode = false,
  gizmoMode = 'translate',
  onTransformChange,
  resetSignal = 0,
  orbitControlsRef,
}: {
  expertMode: boolean;
  editMode?: boolean;
  gizmoMode?: 'translate' | 'rotate' | 'scale';
  onTransformChange?: (t: GuideTransform) => void;
  resetSignal?: number;
  orbitControlsRef?: React.RefObject<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}) {
  // 【2026-07-15】ガイド本体（Start Zone/MacEwen三角/中心ドット/青バー/すり鉢錐台/深度リング/
  // 削開方向矢印）を1つの<group>にまとめ、TransformControls（three-stdlib）でgroup自体の
  // position/rotation/scaleをドラッグ操作する。子要素は全てGUIDE.CENTERからのローカル座標
  // （GUIDE_LOCAL）で固定配置し、groupの変形だけで全体が連動して動く（旧実装は各要素へ個別に
  // 座標を計算し直しており、TriMesh/FanMeshがuseMemo([])でジオメトリをキャッシュしていたため
  // 三角形・扇形が連動しないバグがあった。ローカル座標を不変にすることでこの問題ごと解消）。
  const groupRef = useRef<THREE.Group>(null!);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || !groupRef.current) return;
    groupRef.current.position.set(...GUIDE_TRANSFORM_DEFAULT.position);
    groupRef.current.rotation.set(
      THREE.MathUtils.degToRad(GUIDE_TRANSFORM_DEFAULT.rotationDeg[0]),
      THREE.MathUtils.degToRad(GUIDE_TRANSFORM_DEFAULT.rotationDeg[1]),
      THREE.MathUtils.degToRad(GUIDE_TRANSFORM_DEFAULT.rotationDeg[2]),
    );
    groupRef.current.scale.set(...GUIDE_TRANSFORM_DEFAULT.scale);
    initializedRef.current = true;
    onTransformChange?.(DEFAULT_GUIDE_TRANSFORM_ABS());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resetSignal === 0 || !groupRef.current) return;
    groupRef.current.position.set(...GUIDE_TRANSFORM_DEFAULT.position);
    groupRef.current.rotation.set(
      THREE.MathUtils.degToRad(GUIDE_TRANSFORM_DEFAULT.rotationDeg[0]),
      THREE.MathUtils.degToRad(GUIDE_TRANSFORM_DEFAULT.rotationDeg[1]),
      THREE.MathUtils.degToRad(GUIDE_TRANSFORM_DEFAULT.rotationDeg[2]),
    );
    groupRef.current.scale.set(...GUIDE_TRANSFORM_DEFAULT.scale);
    onTransformChange?.(DEFAULT_GUIDE_TRANSFORM_ABS());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  const handleObjectChange = useCallback(() => {
    const g = groupRef.current;
    if (!g || !onTransformChange) return;
    onTransformChange({
      x: g.position.x, y: g.position.y, z: g.position.z,
      rx: THREE.MathUtils.radToDeg(g.rotation.x),
      ry: THREE.MathUtils.radToDeg(g.rotation.y),
      rz: THREE.MathUtils.radToDeg(g.rotation.z),
      sx: g.scale.x, sy: g.scale.y, sz: g.scale.z,
    });
  }, [onTransformChange]);

  return (
    <>
      <group ref={groupRef}>
        {/* Start Zone: 薄いグリーン */}
        <FanMesh verts={GUIDE_LOCAL.START_ZONE} color="#4ade80" opacity={0.09} />

        {/* MacEwen Triangle: 塗り */}
        <TriMesh v0={GUIDE_LOCAL.SUPERIOR} v1={GUIDE_LOCAL.ANTERIOR} v2={GUIDE_LOCAL.POSTERIOR}
                 color="#22c55e" opacity={0.35} />
        {/* MacEwen Triangle: アウトライン */}
        <TriMesh v0={GUIDE_LOCAL.SUPERIOR} v1={GUIDE_LOCAL.ANTERIOR} v2={GUIDE_LOCAL.POSTERIOR}
                 color="#86efac" opacity={0.85} wire />

        {/* Center マーカー（Safe Entry ドット）*/}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.55, 12, 8]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>

        {/* Temporal Line（青バー）*/}
        <mesh position={GUIDE_LOCAL.TEMPORAL_BAR}>
          <boxGeometry args={[16, 0.28, 0.28]} />
          <meshBasicMaterial color="#60a5fa" />
        </mesh>

        {/* Saucerization Volume（黄色ワイヤーフレーム錐台）*/}
        {/* CylinderGeometry axis = Y → rotate PI/2 around X to align with Z。
            2026-07-15 shojiさん指摘で上下逆と判明: 骨表面(Z=0)は広く、antrum方向(Z=-DEPTH)へ
            すり鉢状に狭くなるのが正しい向き。radiusTop/radiusBottomの順序を入れ替えて修正した
            （骨面側=OUTER_R(広い)、深部側=INNER_R(狭い)）。 */}
        <mesh position={[0, 0, -GUIDE.DEPTH / 2]} rotation={[Math.PI / 2, 0, 0]} renderOrder={2}>
          <cylinderGeometry args={[GUIDE.OUTER_R, GUIDE.INNER_R, GUIDE.DEPTH, 24, 1, true]} />
          <meshBasicMaterial color="#fbbf24" wireframe transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>

        {/* 深度リング（5 / 10 / 15 mm）*/}
        {GUIDE.DEPTH_RINGS.map(({ depth, color }) => {
          const t      = depth / GUIDE.DEPTH;
          const ringR  = GUIDE.OUTER_R + (GUIDE.INNER_R - GUIDE.OUTER_R) * t;
          return (
            <mesh key={depth} position={[0, 0, -depth]}>
              <torusGeometry args={[ringR, 0.2, 8, 36]} />
              <meshBasicMaterial color={color} transparent opacity={0.75} />
            </mesh>
          );
        })}

        {/* 削開方向矢印（黄色、外側→内側）*/}
        <group position={GUIDE_LOCAL.ARROW}>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -3.5]}>
            <cylinderGeometry args={[0.22, 0.22, 7, 8]} />
            <meshBasicMaterial color="#fbbf24" />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -7.5]}>
            <coneGeometry args={[0.65, 1.6, 8]} />
            <meshBasicMaterial color="#fbbf24" />
          </mesh>
        </group>

        {/* Mastoid Antrum: First Surgical Target（専門医モードでは非表示）。
            2026-07-15 shojiさん指摘で三角形・錐台と連動するようgroup内へ移動（見た目上の初期位置は
            ANTRUM_POSと一致させたローカル座標、GUIDE_LOCAL.ANTRUM参照）。ドリル中の実際の距離判定
            （onAntrumDist等）は引き続き固定のANTRUM_POSを使用するため、ガイド編集で見た目を動かしても
            判定位置自体は変わらない（ズレる場合はANTRUM_POS自体の較正が必要、[[stage1-rc-design]]参照）。 */}
        {!expertMode && (
          <>
            <mesh position={GUIDE_LOCAL.ANTRUM}>
              <sphereGeometry args={[ANTRUM_RADIUS, 20, 14]} />
              <meshBasicMaterial color="#4ade80" transparent opacity={0.22} />
            </mesh>
            <mesh position={GUIDE_LOCAL.ANTRUM}>
              <sphereGeometry args={[ANTRUM_RADIUS + 0.1, 20, 14]} />
              <meshBasicMaterial color="#86efac" wireframe transparent opacity={0.70} />
            </mesh>
          </>
        )}
      </group>

      {editMode && (
        <TransformControls
          object={groupRef}
          mode={gizmoMode}
          onObjectChange={handleObjectChange}
          onMouseDown={() => { if (orbitControlsRef?.current) orbitControlsRef.current.enabled = false; }}
          onMouseUp={() => { if (orbitControlsRef?.current) orbitControlsRef.current.enabled = true; }}
        />
      )}

      {/* 専門医モード: 解剖学的ランドマークのみ表示（実測固定値のため調整対象外） */}
      {expertMode && (
        <>
          {/* EAC後壁（水色プレーン）*/}
          <mesh position={LANDMARKS.PCW_CENTER} renderOrder={2}>
            <planeGeometry args={[LANDMARKS.PCW_WIDTH, LANDMARKS.PCW_HEIGHT]} />
            <meshBasicMaterial color="#7dd8f0" transparent opacity={0.35}
              side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh position={LANDMARKS.PCW_CENTER} renderOrder={2}>
            <planeGeometry args={[LANDMARKS.PCW_WIDTH, LANDMARKS.PCW_HEIGHT]} />
            <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.70}
              side={THREE.DoubleSide} />
          </mesh>

          {/* Temporal Line（濃青バー）*/}
          <mesh
            position={[(LANDMARKS.TL_X_LEFT + LANDMARKS.TL_X_RIGHT) / 2, LANDMARKS.TL_Y, LANDMARKS.TL_Z]}
            renderOrder={2}
          >
            <boxGeometry args={[LANDMARKS.TL_X_RIGHT - LANDMARKS.TL_X_LEFT, 0.35, 0.35]} />
            <meshBasicMaterial color="#1d4ed8" />
          </mesh>
          {/* 側頭線ラベルドット */}
          {[-8, -4, 0, 4].map(x => (
            <mesh key={x} position={[x, LANDMARKS.TL_Y, LANDMARKS.TL_Z + 0.3]} renderOrder={3}>
              <sphereGeometry args={[0.4, 8, 6]} />
              <meshBasicMaterial color="#3b82f6" />
            </mesh>
          ))}

          {/* S状静脈洞予測（赤橙 半透明球）*/}
          <mesh position={LANDMARKS.SIG_CENTER}>
            <sphereGeometry args={[LANDMARKS.SIG_RADIUS, 16, 12]} />
            <meshBasicMaterial color="#f97316" transparent opacity={0.18} />
          </mesh>
          <mesh position={LANDMARKS.SIG_CENTER}>
            <sphereGeometry args={[LANDMARKS.SIG_RADIUS + 0.1, 16, 12]} />
            <meshBasicMaterial color="#fb923c" wireframe transparent opacity={0.55} />
          </mesh>
        </>
      )}
    </>
  );
}

function DEFAULT_GUIDE_TRANSFORM_ABS(): GuideTransform {
  const [x, y, z]    = GUIDE_TRANSFORM_DEFAULT.position;
  const [rx, ry, rz] = GUIDE_TRANSFORM_DEFAULT.rotationDeg;
  const [sx, sy, sz] = GUIDE_TRANSFORM_DEFAULT.scale;
  return { x, y, z, rx, ry, rz, sx, sy, sz };
}

// ── DangerSpheres: 危険部位マーカー ───────────────────────────────────
function DangerSpheres() {
  return (
    <>
      {DANGER_ZONES.map((z) => (
        <mesh key={z.id} position={z.position as [number,number,number]}>
          <sphereGeometry args={[z.dangerRadius * 0.6, 12, 8]} />
          <meshStandardMaterial
            color={z.color}
            emissive={z.glowColor}
            emissiveIntensity={0.5}
            transparent
            opacity={0.35}
          />
        </mesh>
      ))}
    </>
  );
}

// ── DrillDisease: 病変マーカー（Stage1 RC Phase2、Disease Layer） ─────────────────
// stateを描画するだけの表示専用コンポーネント（Three.jsへ業務ロジックを書かない方針、除去判定は
// engine/disease/diseaseRemoval.tsの純粋関数側で行う）。severityが0になったインスタンスは非表示。
// 半径はseverityに比例して縮小し、除去の進捗を視覚的に示す（下限を設け消える寸前まで視認できるようにする）。
function DrillDisease({ instances }: { instances: DiseaseInstance[] }) {
  return (
    <>
      {instances.map((inst) => {
        if (isDiseaseCleared(inst)) return null;
        const preset = DISEASE_PRESETS[inst.type];
        const radius = inst.radiusMm * Math.max(0.15, inst.severity);
        const opacity = 0.55 + 0.35 * inst.severity;
        return (
          <mesh key={inst.id} position={inst.position}>
            <sphereGeometry args={[radius, 16, 12]} />
            <meshStandardMaterial
              color={preset.color}
              emissive={preset.color}
              emissiveIntensity={0.25}
              transparent
              opacity={opacity}
              roughness={0.85}
            />
          </mesh>
        );
      })}
    </>
  );
}

// Sprint5（Post Session Review）: セッション終了後、位置付きDamageEventを3Dピンとして表示する。
// クリックで選択→外側stateへ通知（詳細カードは外側InteractiveDrillScene側でdescribeDamageEvent()を
// 使って表示する。判定ロジック自体には一切関与しない、記録の可視化専用コンポーネント）。
function DamageReviewPins({
  events,
  selectedIndex,
  onSelect,
}: {
  events: DamageEvent[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
}) {
  return (
    <>
      {events.map((ev, i) => {
        if (!ev.position) return null; // 旧セッション履歴等、位置情報がないイベントはピン化できない
        const isSelected = i === selectedIndex;
        const color = ev.severity === 'critical' ? '#ef4444' : '#fbbf24';
        return (
          <mesh
            key={i}
            position={[ev.position.x, ev.position.y, ev.position.z]}
            onClick={(e) => { e.stopPropagation(); onSelect(isSelected ? null : i); }}
            onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
          >
            <sphereGeometry args={[isSelected ? 0.6 : 0.42, 16, 16]} />
            <meshBasicMaterial color={color} transparent opacity={isSelected ? 1 : 0.8} />
          </mesh>
        );
      })}
    </>
  );
}

// ── DrillCanvas3D: R3F内部コンポーネント ────────────────────────────
interface DrillCanvas3DProps {
  drillMode:        boolean;
  rotation:         'CW' | 'CCW';
  onAlert:          (msg: string | null) => void;
  onHoleCount:      (n: number) => void;
  onAntrumDist:     (dist: number | null) => void;
  onDrillDirection: (dir: string | null) => void;
  onDangerTint:     (color: string | null) => void;
  // Sprint6・演出: 危険接近ビネット用の生proximity値（0-1）。dangerTintは既にブレンド済み色の
  // ためUI側で強度を再計算できず、画面周辺ビネットの不透明度・色補間には別途この数値が必要。
  onDangerProximity: (proximity: number) => void;
  onEducationCard:  (card: EducationCardContent | null) => void;
  /** Sprint6・Heat: 発熱レベル 0-1（毎フレーム通知、UIゲージ表示用） */
  onHeatLevel:      (level: number) => void;
  onScoreReady:     (result: { breakdown: ScoreBreakdown; review: ScoreReviewItem[]; damageEvents: DamageEvent[] }) => void; // Sprint5: 3Dレビュー用にdamageEventsも渡す
  burrId:           string;
  onBurrIdChange:   (id: string) => void; // V5: 数字キー(1-3)クイックバー切替
  pressure:         number;
  rpmPreset:        RpmPreset;
  showGuide:        boolean;
  guideEditMode:    boolean;
  guideGizmoMode:   'translate' | 'rotate' | 'scale';
  guideResetSignal: number;
  onGuideTransformChange: (t: GuideTransform) => void;
  expertMode:       boolean;
  boneVis:          VisMode;
  ossicleVis:       VisMode;
  nerveVis:         VisMode;
  diseaseVis:       boolean; // 【2026-07-15新設】病変表示。半透明モードは不要のためVisModeでなくboolean
  viewMode?:        'normal' | 'microscope' | 'endoscope';
  positionMode?:    boolean;
  cutterSizeMm?:    1 | 2 | 3;
  // 2026-07-13: 削開/視点トグル（drillControlMode）を廃止し、顕微鏡モードの固定/移動中
  // （positionMode）へ統一。通常モードでもpositionMode=true（移動中）でドラッグ=カメラ回転、
  // false（固定）でドラッグ=削開となる（旧drillControlMode==='view'/'drill'に相当）。
  // shojiさん指摘: 2つのトグルが機能的に衝突していたための整理（[[feedback]]参照）。
  onPositionModeChange: (mode: boolean) => void; // スペースキー・内蔵ボタンでpositionModeを更新するため必要
  // Sprint5（Post Session Review）: レビューモード中のみ非nullで渡される位置付きダメージイベント一覧。
  // 3Dピン描画とクリック選択に使う。実データはfinalizeScore時にこのコンポーネント内で確定→
  // onScoreReady経由で一度外側stateへ渡り、レビューを開いたときにここへ戻ってくる
  // （単方向データフローを維持するための設計、DrillCanvas3D側の内部refを直接外へ公開しない）。
  reviewEvents:         DamageEvent[] | null;
  reviewSelectedIndex:  number | null;
  onReviewSelect:       (index: number | null) => void;
}

function DrillCanvas3D({ drillMode, rotation, onAlert, onHoleCount, onAntrumDist, onDrillDirection, onDangerTint, onDangerProximity, onEducationCard, onScoreReady, onHeatLevel, burrId, onBurrIdChange, pressure, rpmPreset, showGuide, guideEditMode, guideGizmoMode, guideResetSignal, onGuideTransformChange, expertMode, boneVis, ossicleVis, nerveVis, diseaseVis, viewMode = 'normal', positionMode = false, onPositionModeChange, reviewEvents, reviewSelectedIndex, onReviewSelect }: DrillCanvas3DProps) {
  const { camera }      = useThree();
  const carveRef        = useRef<((center: THREE.Vector3, radiusMm: number, amount: number) => void) | null>(null); // V5: DrillBoneへの実ボクセル除去呼び出し
  const pruneIslandsRef = useRef<(() => void) | null>(null); // 2026-07-13: 宙に浮いた骨片除去呼び出し（stopDrillingで使用）
  // Stage1 RC Phase2（Disease Layer）: 病変インスタンスのstate。carveRef呼び出しと並行して
  // applyDiseaseRemoval()（純粋関数）を呼びseverityを減少させる。何も変化しなければ同一参照を
  // 返す設計のため、範囲外での毎フレームsetState呼び出しはReactのbailoutで再レンダリングされない。
  const [diseaseInstances, setDiseaseInstances] = useState<DiseaseInstance[]>(createPlaceholderDiseaseInstances);
  // 連続したstart/stop連打でpruneDisconnectedIslandsが密に呼ばれ続けないための最小間隔ガード
  // （全Baseボクセル走査のBFSのため軽くはない処理。1回あたりの体感コストは要ローカル確認）。
  const lastPruneCheckMsRef = useRef(0);
  const contactAngleRef = useRef(0);                      // 面法線×ドリル軸のなす角（度）
  const lastGrowthRateRef = useRef(0);                    // T6: 直近成長速度 mm/s（音量算出に使用）
  const audioEngineRef  = useRef<DrillAudioEngine | null>(null); // T6: WebAudioエンジン（ノード使い回し）
  // T9: ダメージ記録・採点用ステート
  const damageEventsRef       = useRef<DamageEvent[]>([]);
  const damageTrackerStateRef = useRef(initialDamageTrackerState);
  const minDistToDangerRef    = useRef<number | null>(null);
  const nearDangerDiamondMsRef = useRef(0);
  const nearDangerCuttingMsRef = useRef(0);
  const reachedAntrumRef      = useRef(false);
  const scoreFinalizedRef     = useRef(false);
  // V5: 実ボクセル除去とは別に、scoring.tsの較正値を変えないよう既存「80ms間隔+MIN_HOLE_DIST」
  // 頻度のまま採点用の削開点数を数える（旧holesRef配列をカウンタ2本へ簡略化）
  const totalDrillPointsRef       = useRef(0);
  const oticCapsuleDrillPointsRef = useRef(0);
  const isDrillingRef  = useRef(false);
  const lastHolePosRef = useRef<THREE.Vector3 | null>(null);
  const lastDrillTime  = useRef(0);
  const cursorRef      = useRef<THREE.Group>(null!);
  const orbitRef       = useRef<any>(null);
  // V5: Shift/Ctrl荷重クイック切替（押している間だけ最大/最小荷重へ一時的に上書き、スライダー値は不変）
  const shiftHeldRef = useRef(false);
  const ctrlHeldRef  = useRef(false);
  // 2026-07-13: positionModeのref版（スペースキー処理でstate更新の非同期反映を待たず
  // 即座にガード判定へ反映させるために必要。通常はpropと同期させる）
  const positionModeRef = useRef(positionMode);
  useEffect(() => { positionModeRef.current = positionMode; }, [positionMode]);
  // 【2026-07-15新設】ガイド編集中（TransformControlsのギズモがbone上に重なりドリルのポインタ
  // イベントを奪ってしまう）はドリル開始できないようガードする。shojiさん報告: 「ガイドに合わせて
  // 骨をドリルで削ってみましたが全く削れませんでした」の原因調査で判明。
  const guideEditModeRef = useRef(guideEditMode);
  useEffect(() => { guideEditModeRef.current = guideEditMode; }, [guideEditMode]);
  // Sprint3: バーのフルート目詰まり度 0-1（removalModel.ts clogFactor）。バー交換でリセットされる。
  const clogLevelRef = useRef(0);
  // Sprint3: Tool Pose速度(mm/s)・dwell(留まり)継続時間ms（removalModel.ts advanceDwellMs）
  const prevPointRef    = useRef<THREE.Vector3 | null>(null);
  const toolVelocityRef = useRef(0);
  const dwellMsRef      = useRef(0);
  // Sprint4: Expert Coach（educationCards.ts）がShift/Ctrlクイック切替後の実効荷重を
  // 参照できるよう、useFrame内で算出したeffectivePressureをrefに保持しておく。
  const effectivePressureRef = useRef(0.6);
  // Sprint5（Post Session Review）: DamageEvent.tを「セッション内相対ms」にするため、
  // 初回削開開始時刻を基準として保持する（performance.now()は絶対値で意味を持たないため）。
  const sessionStartMsRef = useRef<number | null>(null);
  // Sprint6・Heat: 発熱レベル 0-1（removalModel.ts growHeatLevel/coolHeatLevel）。
  // バー交換やリセットでは明示的にリセットしない（熱は骨側の状態という想定のため、
  // clogLevelRef=バー側の状態とは異なる。非削開中は徐々に放熱する）。
  const heatLevelRef = useRef(0);

  // Sprint6・Particle: 骨粉パーティクルのspawn呼び出し（DustParticles側からuseEffectで注入される、
  // carveRefと同じ「ref経由でのコンポーネント間関数受け渡し」パターン）。
  const spawnParticlesRef = useRef<((center: THREE.Vector3, count: number, colorHex: THREE.ColorRepresentation) => void) | null>(null);
  // Sprint6・Particle: フレームごとの発生数は端数が出るため、次フレームへ持ち越す蓄積値。
  const particleSpawnAccumRef = useRef(0);

  // T6: アンマウント時にAudioContextを解放（resetKeyでのremount毎のリーク防止）
  useEffect(() => {
    return () => { audioEngineRef.current?.dispose(); };
  }, []);

  // Sprint3: バー交換で目詰まりをリセット（バー交換の動機付け＝交換直後は切削効率が戻る）
  useEffect(() => {
    clogLevelRef.current = 0;
  }, [burrId]);

  // ドリル開始/停止（ポインタ押下・スペースキートグルの共通処理。下のキー監視useEffectより先に
  // 定義しておく必要がある＝TSの「使用後宣言」エラー回避のための配置）
  const startDrilling = useCallback(() => {
    if (!drillMode || positionModeRef.current || guideEditModeRef.current) return;
    isDrillingRef.current = true;
    if (sessionStartMsRef.current === null) sessionStartMsRef.current = performance.now(); // Sprint5: DamageEvent.tの基準時刻
    if (cursorRef.current) cursorRef.current.visible = true;
    lastDrillTime.current = DRILL_INTERVAL; // 即座に 1 記録
    // T6: ユーザー操作起点でAudioContext生成/resume（autoplay制約回避）
    if (!audioEngineRef.current) audioEngineRef.current = new DrillAudioEngine();
    audioEngineRef.current.start();
  }, [drillMode]);

  const stopDrilling = useCallback(() => {
    isDrillingRef.current = false;
    if (cursorRef.current) cursorRef.current.visible = false;
    audioEngineRef.current?.stop();
    onEducationCard(null);
    // 2026-07-13: ドリルを離した瞬間に、主骨塊から切り離された骨片（宙に浮いた状態）が
    // ないか確認し、あれば除去する（shojiさん指摘。詳細はvoxelVolume.ts参照）。
    // 最小800ms間隔でガード（start/stop連打時の連続実行を防ぐ）。
    const nowMs = performance.now();
    if (nowMs - lastPruneCheckMsRef.current > 800) {
      lastPruneCheckMsRef.current = nowMs;
      pruneIslandsRef.current?.();
    }
  }, [onEducationCard]);

  // 2026-07-12: スペースキー専用トグル。「削開中」→止めて視点操作へ、「待機中」→ドリルモードへ
  // 切り替えてから即座に削開開始（shojiさん指示: 待機中にspaceを押しても何も起きないのは、
  // view選択中はstartDrillingがガードで弾いていたため。ここでは先にrefを更新してから
  // startDrillingを呼ぶことで、同一イベントハンドラ内で確実にガードを通過させる）。
  const toggleDrillSpace = useCallback(() => {
    if (!drillMode) return;
    if (isDrillingRef.current) {
      // 削開中 → 削開を止めて移動中（固定解除）へ
      stopDrilling();
      positionModeRef.current = true;
      onPositionModeChange(true);
    } else {
      // 待機中 → 固定へ切り替えてから即座に削開開始
      positionModeRef.current = false;
      onPositionModeChange(false);
      startDrilling();
    }
  }, [drillMode, stopDrilling, startDrilling, onPositionModeChange]);

  // V5: Shift/Ctrl荷重クイック切替 + 数字キー(1-3)バー切替 + スペースキーでドリル開始/停止トグル
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftHeldRef.current = true;
      if (e.key === 'Control') ctrlHeldRef.current = true;
      const burrIdx = ['1', '2', '3'].indexOf(e.key);
      if (burrIdx >= 0 && DRILL_BURRS[burrIdx]) onBurrIdChange(DRILL_BURRS[burrIdx].id);
      // スペース: 待機中→削開開始（固定へ切替）／削開中→移動中へ切替（削開は停止）
      // （オートリピートは無視。2026-07-13改修: 削開/視点ボタンを廃止し、固定/移動中
      // （positionMode）の切替まで一体で行う設計に統一）
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault(); // ページスクロールを抑止
        toggleDrillSpace();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftHeldRef.current = false;
      if (e.key === 'Control') ctrlHeldRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onBurrIdChange, toggleDrillSpace]);

  // T6: 現在の削開点(材料・残存骨厚・成長速度)から音を更新する（設計書 §4.5）
  const updateAudio = useCallback((point: THREE.Vector3, regionId: BoneRegionId) => {
    const engine = audioEngineRef.current;
    if (!engine) return;
    const material = BONE_MATERIALS[regionId];
    const remaining = remainingThicknessToDanger(point);
    // Sprint6・Audio: RPM連動モーター音（rpmPresetをそのまま渡す。回転数プリセット変更で
    // 基音ピッチが変わる。危険接近時の警報音程自体はRPM非依存のまま、詳細はaudioEngine.ts参照）
    engine.update(computeAudioState(material, remaining, lastGrowthRateRef.current, rpmPreset));
  }, [rpmPreset]);

  // T8/Sprint4(Expert Coach): 現在の材料・バー・危険状態・Pressure/Angle/Feed Rate/RPMから
  // 教育カードを1つ選び出す（危険判定はAnatomyLayerベースのremainingThicknessToLayerへ統一）
  const updateEducationCard = useCallback((point: THREE.Vector3, regionId: BoneRegionId) => {
    const material = BONE_MATERIALS[regionId];
    const burr = getBurrById(burrId);
    const dangerState = computeDangerState(remainingThicknessToLayer(point));
    onEducationCard(selectEducationCard({
      material,
      burr,
      dangerState,
      growthRateMmPerSec: lastGrowthRateRef.current,
      clogLevel: clogLevelRef.current,
      dwellMs: dwellMsRef.current,
      pressure: effectivePressureRef.current,
      rpmPreset,
      contactAngleDeg: contactAngleRef.current,
      toolVelocityMmPerSec: toolVelocityRef.current,
      heatLevel: heatLevelRef.current,
    }));
  }, [burrId, onEducationCard, rpmPreset]);

  // T9/Sprint4: 危険接近時間・最小到達距離・ダメージイベントを毎フレーム追跡する
  // （AnatomyLayerベースのremainingThicknessToLayerへ統一、2026-07-12）
  const updateScoringTrackers = useCallback((delta: number, point: THREE.Vector3, regionId: BoneRegionId) => {
    const dangerState = computeDangerState(remainingThicknessToLayer(point));

    if (dangerState.distMm !== null) {
      minDistToDangerRef.current =
        minDistToDangerRef.current === null
          ? dangerState.distMm
          : Math.min(minDistToDangerRef.current, dangerState.distMm);
    }

    if (dangerState.level !== 'safe') {
      const burr = getBurrById(burrId);
      if (burr.type === 'diamond') nearDangerDiamondMsRef.current += delta * 1000;
      else nearDangerCuttingMsRef.current += delta * 1000;
    }

    const isOnOticCapsule = regionId === 'oticCapsule';
    // Sprint5: tはセッション内相対ms（sessionStartMsRef基準）。stepDamageTracker内のdwell計算は
    // 差分のみを使うため、絶対値→相対値への変更でも既存ロジックへの影響はない。
    const nowMs = performance.now() - (sessionStartMsRef.current ?? performance.now());
    const { events, next } = stepDamageTracker(
      damageTrackerStateRef.current, nowMs, dangerState, isOnOticCapsule, true,
      {
        position: { x: point.x, y: point.y, z: point.z },
        toolPoseSnapshot: {
          burrId,
          rpmPreset,
          pressure: effectivePressureRef.current,
          contactAngleDeg: contactAngleRef.current,
          velocityMmPerSec: toolVelocityRef.current,
          regionId,
        },
      },
      heatLevelRef.current // Sprint6・Heat: overheatイベント発火判定に使用
    );
    damageTrackerStateRef.current = next;
    if (events.length > 0) damageEventsRef.current.push(...events);
  }, [burrId, rpmPreset]);

  // T9: セッション終了（到達 or アンマウント/リセット）時にスコアを確定・保存する。二重確定はしない。
  const finalizeScore = useCallback(() => {
    if (scoreFinalizedRef.current || totalDrillPointsRef.current === 0) return;
    scoreFinalizedRef.current = true;

    // Sprint5: damageEventsRef.currentは以後もpushされ続けうる同一配列参照のため、確定時点で
    // スナップショット（スプレッドコピー）を取っておく（レビュー内容が後から変わらないようにするため）。
    const damageEventsSnapshot = [...damageEventsRef.current];
    const inputs = {
      damageEvents: damageEventsSnapshot,
      reachedAntrum: reachedAntrumRef.current,
      oticCapsuleHolesCount: oticCapsuleDrillPointsRef.current,
      totalHolesCount: totalDrillPointsRef.current,
      minDistToDangerMm: minDistToDangerRef.current,
      nearDangerDiamondMs: nearDangerDiamondMsRef.current,
      nearDangerCuttingMs: nearDangerCuttingMsRef.current,
    };
    const breakdown = computeScoreBreakdown(inputs);
    const review = generateScoreReview(breakdown, inputs);

    appendScoreHistory({
      date: new Date().toISOString(),
      breakdown,
      damageEvents: damageEventsSnapshot,
      reachedAntrum: reachedAntrumRef.current,
    });

    onScoreReady({ breakdown, review, damageEvents: damageEventsSnapshot });
  }, [onScoreReady]);

  // T9: アンマウント時（resetKey変更含む）に未確定スコアを確定・保存する
  useEffect(() => {
    return () => { finalizeScore(); };
  }, [finalizeScore]);

  // 危険部位チェック（T7: remainingThicknessToLayer基準に統一、色透見をUIへ配線。
  // Sprint4でAnatomyLayerベースへ切替、2026-07-12）
  const checkDanger = useCallback((point: THREE.Vector3) => {
    const remaining = remainingThicknessToLayer(point);
    const state = computeDangerState(remaining);

    if (state.zone && state.level !== 'safe' && state.distMm !== null) {
      const icon = state.level === 'critical' ? '🔴' : '⚠️';
      onAlert(`${icon} ${state.zone.nameJa} まで ${state.distMm.toFixed(1)} mm`);
    } else {
      onAlert(null);
    }

    const material = BONE_MATERIALS[regionAt(point)];
    const tint = dangerTintColor(BASE_BONE_COLOR, material, state.proximity);
    onDangerTint(state.proximity > 0 ? `#${tint.getHexString()}` : null);
    onDangerProximity(state.proximity); // Sprint6・演出: 危険接近ビネット
  }, [onAlert, onDangerTint, onDangerProximity]);

  // useFrame: V5では毎フレーム実ボクセル除去(carveRef)を行う。採点用の記録は既存の
  // 80ms間隔+MIN_HOLE_DISTデデュープ頻度を踏襲する（positionMode時は中断）
  useFrame((_, delta) => {
    const drilling = isDrillingRef.current && !!cursorRef.current?.visible && drillMode;
    if (!drilling) {
      // 非削開中（間欠停止）は目詰まりが解消していく（文献: 間欠的な軽圧削開が目詰まりを防ぐ）
      clogLevelRef.current = clearClogLevel(clogLevelRef.current, delta);
      // 非削開中はTool Pose速度・dwell時間もリセット（次回削開開始時は留まり0からカウント）
      prevPointRef.current = null;
      toolVelocityRef.current = 0;
      dwellMsRef.current = advanceDwellMs(dwellMsRef.current, 0, false, delta);
      // Sprint6・Heat: 非削開中は放熱する（文献: 間欠的な休止による放熱が発熱抑制に有効）
      heatLevelRef.current = coolHeatLevel(heatLevelRef.current, delta);
      onHeatLevel(heatLevelRef.current);
      return;
    }

    const point = cursorRef.current.position;

    // Sprint3: Tool Pose速度(mm/s)＝直近フレームからの移動距離/dt。dwell(留まり)検知の基礎。
    // Feed Rate（経路分配方式）: prevPointRefを上書きする前に前フレーム位置を保持しておき、
    // 下記carve呼び出しの掃引経路サブステップ分配に使う。
    const prevPoint = prevPointRef.current;
    toolVelocityRef.current = prevPoint && delta > 0
      ? point.distanceTo(prevPoint) / delta
      : 0;
    prevPointRef.current = point.clone();
    dwellMsRef.current = advanceDwellMs(dwellMsRef.current, toolVelocityRef.current, true, delta);

    // ドリル表示の向き: 視点(カメラ)方向へシャフトが受け流れ、右上からやや傾いて
    // 差し込むように見せる（球の先端が切削点を向く。旧: 常にワールド+Y=真上固定だった）
    const camRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const camUp    = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const camBack  = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2);
    const shaftDir = camBack.multiplyScalar(0.85).add(camUp.multiplyScalar(0.3)).add(camRight.multiplyScalar(0.3)).normalize();
    cursorRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), shaftDir);

    const regionId = regionAt(point);
    const material = BONE_MATERIALS[regionId];
    const burr = getBurrById(burrId);
    // 削開中は目詰まりが蓄積する（material.particleAmountが高いほど早い、既存T2材料表を再利用）
    clogLevelRef.current = growClogLevel(clogLevelRef.current, material, delta);
    // Shift=荷重最大へ一時上書き、Ctrl=荷重最小へ一時上書き（クイック切替、スライダー値は不変）
    const effectivePressure = shiftHeldRef.current ? 1.0 : ctrlHeldRef.current ? 0.2 : pressure;
    effectivePressureRef.current = effectivePressure; // Sprint4: Expert Coachが参照

    // Sprint6・Heat: 荷重・RPM・バー種(heatCoef)・留まり(dwell)・危険構造近接から発熱を蓄積する
    // （文献根拠はremovalModel.tsのHeatセクション参照）。危険構造近接はここでのみ算出が必要なため
    // 専用に1回computeDangerStateする（update*系コールバック内でも同様の計算を個別に行っており
    // 既存の設計と同じ粒度の重複、新規の重い処理ではない）。
    const dangerStateForHeat = computeDangerState(remainingThicknessToLayer(point));
    heatLevelRef.current = growHeatLevel(heatLevelRef.current, {
      burr,
      pressure: effectivePressure,
      rpmPreset,
      isDwelling: dwellMsRef.current > 0,
      dangerProximity: dangerStateForHeat.proximity,
    }, delta);
    onHeatLevel(heatLevelRef.current);

    const rate = growthRateMmPerSec({
      burr,
      pressure: effectivePressure,
      rpmPreset,
      contactAngleDeg: contactAngleRef.current,
      material,
      clogLevel: clogLevelRef.current,
    });
    lastGrowthRateRef.current = rate;

    // Sprint6・Particle: 骨粉パーティクル。particleAmount（材料由来）×除去速度から1秒あたりの
    // 発生数を求め、フレームdeltaぶんを蓄積→整数個ぶんだけ生成（端数は次フレームへ持ち越す）。
    particleSpawnAccumRef.current += particleSpawnRatePerSec(material.particleAmount, rate) * delta;
    const spawnCount = Math.min(PARTICLE_MAX_SPAWN_PER_FRAME, Math.floor(particleSpawnAccumRef.current));
    if (spawnCount > 0) {
      particleSpawnAccumRef.current -= spawnCount;
      spawnParticlesRef.current?.(point, spawnCount, material.color);
    }

    const amount = rate * delta;
    if (amount > 0) {
      // Feed Rate（経路分配方式、2026-07-12）: growthRateMmPerSecの式自体は変更せず、
      // 1フレーム分のamountを前フレーム位置→現在位置の掃引経路へサブステップ分配する。
      // 高速掃引時にカーソルがバー半径以上ジャンプし中間ボクセルが未接触になる
      // 「トンネリング」を防ぐ（一般機械加工のMRR=送り速度×切込み深さ×切削速度の原理を、
      // 除去率自体ではなく空間分配の正確化として適用。既存のdwell検知・目詰まりモデルとは
      // 独立に効くため二重補正にはならない。文献的根拠と設計判断の詳細は[[drill-mves-design]]参照）。
      const burrRadius = burr.diameterMm / 2;
      const sweepDist = prevPoint ? point.distanceTo(prevPoint) : 0;
      const steps = sweepDist > 0
        ? Math.min(FEED_RATE_MAX_SUBSTEPS, Math.max(1, Math.ceil(sweepDist / (burrRadius * FEED_RATE_SUBSTEP_FRACTION))))
        : 1;
      const stepAmount = amount / steps;
      for (let i = 0; i < steps; i++) {
        const t = steps === 1 ? 1 : (i + 1) / steps;
        const stepPoint = prevPoint ? prevPoint.clone().lerp(point, t) : point;
        carveRef.current?.(stepPoint, burrRadius, stepAmount);
        // Stage1 RC Phase2（Disease Layer）: 同じドリル操作で病変も並行して除去する
        // （2026-07-15 shojiさん確認: Voxel carve流用方針）。
        setDiseaseInstances((prev) => applyDiseaseRemoval(prev, {
          point: [stepPoint.x, stepPoint.y, stepPoint.z],
          brushRadiusMm: burrRadius,
          amount: stepAmount,
        }));
      }
    }

    lastDrillTime.current += delta * 1000;
    if (lastDrillTime.current >= DRILL_INTERVAL) {
      lastDrillTime.current = 0;
      const last = lastHolePosRef.current;
      if (!last || last.distanceTo(point) >= MIN_HOLE_DIST) {
        lastHolePosRef.current = point.clone();
        totalDrillPointsRef.current++;
        if (regionId === 'oticCapsule') oticCapsuleDrillPointsRef.current++;
        onHoleCount(totalDrillPointsRef.current);
      }
    }

    updateAudio(point, regionId);
    updateEducationCard(point, regionId);
    updateScoringTrackers(delta, point, regionId);
  });

  // ── イベントハンドラ ──────────────────────────────────────────────
  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (cursorRef.current) {
      cursorRef.current.position.copy(e.point);
      cursorRef.current.visible = isDrillingRef.current; // 「削開中」以外はドリル表示を出さない
    }
    checkDanger(e.point);
    const antrumDistNow = e.point.distanceTo(ANTRUM_POS);
    onAntrumDist(antrumDistNow);
    onDrillDirection(computeDrillDirection(e.point));

    // T9: 目標到達（乳突洞）を検知したらスコアを確定する（初回のみ）
    if (antrumDistNow < ANTRUM_REACHED_DIST && !reachedAntrumRef.current) {
      reachedAntrumRef.current = true;
      finalizeScore();
    }

    // 接触角: 面法線（ワールド空間）とドリル軸（カメラ→接触点方向）のなす角（設計書 §4.4）
    if (e.face) {
      const worldNormal = e.face.normal.clone().transformDirection(e.object.matrixWorld).normalize();
      const drillAxis = e.point.clone().sub(camera.position).normalize();
      contactAngleRef.current = computeContactAngleDeg(worldNormal, drillAxis);
    }
  }, [checkDanger, onAntrumDist, onDrillDirection, camera, finalizeScore]);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!drillMode || e.button !== 0) return;
    e.stopPropagation();
    startDrilling();
  }, [drillMode, startDrilling]);

  const handlePointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    stopDrilling();
  }, [stopDrilling]);

  const handlePointerLeave = useCallback(() => {
    isDrillingRef.current = false;
    if (cursorRef.current) cursorRef.current.visible = false;
    onAlert(null);
    onAntrumDist(null);
    onDrillDirection(null);
    onDangerTint(null);
    onDangerProximity(0); // Sprint6・演出: カーソルが骨から離れたらビネットも消す
    onEducationCard(null);
    audioEngineRef.current?.stop();
  }, [onAlert, onAntrumDist, onDrillDirection, onDangerTint, onDangerProximity, onEducationCard]);

  return (
    <>
      {/* ライティング（解剖モード AnatomyScene.tsx と同一トーン。60FPS優先のためcastShadowは付けない） */}
      <directionalLight position={[10, 15, 5]}  intensity={1.8}  color="#fff8f0" />
      <directionalLight position={[18, 3, 2]}   intensity={0.9}  color="#ffe8d0" />
      <directionalLight position={[-12, 2, -4]} intensity={0.6}  color="#c0d8ff" />
      <directionalLight position={[5, -8, 0]}   intensity={0.25} color="#d0e4ff" />
      <pointLight position={[-8, -2, 0]} intensity={3.0} color="#a0c8ff" distance={20} decay={2} />
      <pointLight position={[4,   3, 1]} intensity={2.0} color="#fff4e0" distance={14} decay={2} />

      {/* 側頭骨（ドリルシェーダー付き） */}
      <DrillBone
        carveRef={carveRef}
        pruneIslandsRef={pruneIslandsRef}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        boneVis={boneVis}
      />
      {/* 耳小骨 */}
      <DrillOssicles mode={ossicleVis} />
      {/* 神経・頸動脈 */}
      <DrillNerves mode={nerveVis} />
      {/* ポインタリーブ用不可視プレーン */}
      <mesh visible={false} onPointerLeave={handlePointerLeave}>
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial side={THREE.DoubleSide} />
      </mesh>

      {/* 危険部位マーカー */}
      <DangerSpheres />
      {/* Stage1 RC Phase2: 病変マーカー（暫定配置データ、次PRで実症例データへ差し替え予定） */}
      {diseaseVis && <DrillDisease instances={diseaseInstances} />}
      {/* Mastoidectomy ガイドレイヤー */}
      {showGuide && (
        <MastoidGuide
          expertMode={expertMode}
          editMode={guideEditMode}
          gizmoMode={guideGizmoMode}
          onTransformChange={onGuideTransformChange}
          resetSignal={guideResetSignal}
          orbitControlsRef={orbitRef}
        />
      )}

      {/* Sprint5: Post Session Review ピン（レビューモード中のみ表示） */}
      {reviewEvents && (
        <DamageReviewPins
          events={reviewEvents}
          selectedIndex={reviewSelectedIndex}
          onSelect={onReviewSelect}
        />
      )}

      {/* ドリルカーソル */}
      <DrillCursor groupRef={cursorRef} rotation={rotation} sizeMm={getBurrById(burrId).diameterMm as 1 | 2 | 3} />

      {/* Sprint6・Particle: 骨粉パーティクル（削開中に発生、Object Pool管理） */}
      <DustParticles spawnRef={spawnParticlesRef} visible={boneVis !== 'hidden'} />

      {/* FovController: viewMode に応じてカメラFOVを切替 */}
      <FovController viewMode={viewMode} />

      {/* OrbitControls */}
      {/* 2026-07-13: 固定/移動中（positionMode）へ統一。固定（false）の間は1本指ドラッグ(タッチ)/
          左ボタン(マウス)を削開専用にし、OrbitControlsのROTATEへは渡さない（2本指ピンチ/中ボタンでの
          ズームは常時可能）。移動中（true）はマウス左ボタンもタッチ1本指も通常のROTATEへ戻す。 */}
      <OrbitControls
        ref={orbitRef}
        makeDefault
        mouseButtons={{
          LEFT:   (drillMode && !positionMode) ? (THREE.MOUSE as any).NONE : THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT:  THREE.MOUSE.ROTATE,
        }}
        touches={{
          ONE: (drillMode && !positionMode) ? undefined : THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
        enableRotate={viewMode !== 'microscope' || positionMode}
        enablePan={(!drillMode || positionMode) && (viewMode !== 'microscope' || positionMode)}
        enableZoom={true}
        target={[0, 0, 2]}
      />
    </>
  );
}

// ── InteractiveDrillScene: 外部コンポーネント ─────────────────────────
export interface InteractiveDrillSceneProps {
  viewMode?:           'normal' | 'microscope' | 'endoscope';
  positionMode?:       boolean;
  onPositionModeChange?: (mode: boolean) => void; // 親が制御するとき（未指定時は内部stateへフォールバック）
  drillActive?:        boolean;      // 親が制御するとき
  onDrillToggle?:      () => void;   // 親が制御するとき
  rightOverlayOffset?: number;       // 右オーバーレイを下にずらすpx
}

export function InteractiveDrillScene({
  viewMode = 'normal',
  positionMode,
  onPositionModeChange,
  drillActive,
  onDrillToggle,
  rightOverlayOffset = 0,
}: InteractiveDrillSceneProps = {}) {
  const [internalDrillMode, setInternalDrillMode] = useState(false);
  // 制御モード判定
  const isControlled = onDrillToggle !== undefined;
  const drillMode    = isControlled ? !!drillActive : internalDrillMode;
  // 2026-07-13: positionMode（固定/移動中）も同じ制御/非制御パターンを踏襲。
  // 親（LearningMode.tsx等）がonPositionModeChangeを渡さない場合は内部stateへフォールバックし、
  // スタンドアロン利用時も固定/移動中トグルが機能するようにする。
  const [internalPositionMode, setInternalPositionMode] = useState(false);
  const isPositionControlled = onPositionModeChange !== undefined;
  const effectivePositionMode = isPositionControlled ? !!positionMode : internalPositionMode;
  const handlePositionModeChange = useCallback((v: boolean) => {
    if (isPositionControlled) onPositionModeChange!(v);
    else setInternalPositionMode(v);
  }, [isPositionControlled, onPositionModeChange]);
  // 実効ドリル: 移動中（positionMode=true）は中断
  const effectiveDrill = drillMode && !effectivePositionMode;
  const [showGuide,  setShowGuide]  = useState(true);
  // 【2026-07-15新設→同日ドラッグ式ギズモへ改訂】ガイド位置調整（shojiさん要望）。
  // 数値入力パネル方式は(1)三角形等が連動しない実装バグ、(2)Y軸回転しかできない、
  // (3)拡大縮小がない、の3点で不十分と指摘を受け、TransformControlsのドラッグ式へ変更。
  // guideTransformは表示専用（TransformControlsがgroupを直接操作し、onObjectChangeで
  // ここへ反映するのみ。数値を直接編集する入力欄は持たない）。
  const [guideEditMode, setGuideEditMode] = useState(false);
  const [guideGizmoMode, setGuideGizmoMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [guideResetSignal, setGuideResetSignal] = useState(0);
  const [showGuideLegend, setShowGuideLegend] = useState(false); // 【2026-07-15新設】ガイド各要素の説明トグル
  const [guideTransform, setGuideTransform] = useState<GuideTransform>(DEFAULT_GUIDE_TRANSFORM_ABS());
  const [rotation,  setRotation]  = useState<'CW' | 'CCW'>('CW');
  const [alertMsg,  setAlertMsg]  = useState<string | null>(null);
  const [holeCount,  setHoleCount]  = useState(0);
  const [antrumDist,    setAntrumDist]    = useState<number | null>(null);
  const [drillDirection, setDrillDirection] = useState<string | null>(null);
  const [dangerTint,     setDangerTint]     = useState<string | null>(null); // T7: 色透見
  const [dangerProximity, setDangerProximity] = useState(0); // Sprint6・演出: 危険接近ビネット強度 0-1
  const [eduCard,        setEduCard]        = useState<EducationCardContent | null>(null); // T8
  const [heatLevel,      setHeatLevel]      = useState(0); // Sprint6・Heat: 0-1、UIゲージ表示用
  const [scoreResult,    setScoreResult]    = useState<{ breakdown: ScoreBreakdown; review: ScoreReviewItem[]; damageEvents: DamageEvent[] } | null>(null); // T9（Sprint5でdamageEventsを追加）
  // Sprint5（Post Session Review）: スコアパネルから「3Dでレビュー」を開いたときの状態
  const [reviewOpen,          setReviewOpen]          = useState(false);
  const [reviewSelectedIndex, setReviewSelectedIndex] = useState<number | null>(null);
  const [burrId,         setBurrId]         = useState(DEFAULT_BURR.id);       // T10
  const [pressure,       setPressure]       = useState(0.6);                   // T10: 0.2-1.0既定0.6
  const [rpmPreset,      setRpmPreset]      = useState<RpmPreset>('high');     // T10（既定値: shoji指示によりhighからスタート, 2026-07-12）
  const [expertMode,     setExpertMode]     = useState(false);
  const [boneVis,        setBoneVis]        = useState<VisMode>('solid');
  const [ossicleVis,     setOssicleVis]     = useState<VisMode>('solid');
  const [nerveVis,       setNerveVis]       = useState<VisMode>('solid');
  const [diseaseVis,     setDiseaseVis]     = useState(true); // 【2026-07-15新設】病変表示トグル（半透明モードなし）
  const [resetKey,       setResetKey]       = useState(0);

  const handleReset = () => {
    setResetKey(k => k + 1);
    setHoleCount(0);
    setAlertMsg(null);
    setAntrumDist(null);
    setDrillDirection(null);
    setDangerTint(null);
    setDangerProximity(0);
    setEduCard(null);
    setReviewOpen(false);          // Sprint5: リセット時はレビュー状態も閉じる
    setReviewSelectedIndex(null);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        key={resetKey}
        camera={{ position: [10, 8, 52], fov: 38 }}
        style={{ background: '#0a0f1a' }}
        gl={{ antialias: true }}
      >
        <DrillCanvas3D
          drillMode={drillMode}
          rotation={rotation}
          onAlert={setAlertMsg}
          onHoleCount={setHoleCount}
          onAntrumDist={setAntrumDist}
          onDrillDirection={setDrillDirection}
          onDangerTint={setDangerTint}
          onDangerProximity={setDangerProximity}
          onEducationCard={setEduCard}
          onScoreReady={setScoreResult}
          onHeatLevel={setHeatLevel}
          showGuide={showGuide}
          guideEditMode={guideEditMode}
          guideGizmoMode={guideGizmoMode}
          guideResetSignal={guideResetSignal}
          onGuideTransformChange={setGuideTransform}
          expertMode={expertMode}
          boneVis={boneVis}
          ossicleVis={ossicleVis}
          nerveVis={nerveVis}
          diseaseVis={diseaseVis}
          viewMode={viewMode}
          positionMode={effectivePositionMode}
          burrId={burrId}
          onBurrIdChange={setBurrId}
          onPositionModeChange={handlePositionModeChange}
          pressure={pressure}
          rpmPreset={rpmPreset}
          reviewEvents={reviewOpen ? (scoreResult?.damageEvents ?? null) : null}
          reviewSelectedIndex={reviewSelectedIndex}
          onReviewSelect={setReviewSelectedIndex}
        />
      </Canvas>

      {/* 顕微鏡ビネットオーバーレイ */}
      {viewMode === 'microscope' && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
          background: 'radial-gradient(circle at center, transparent 26%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.92) 68%, black 82%)',
        }} />
      )}

      {/* Sprint6・演出: 危険接近ビネット（多感覚出力の4つ目のチャンネル。dangerModel.tsの設計方針
          「テキスト・音程上昇・色透見」に画面全体の視覚的緊張感を追加する。数値を出さない周辺視野
          効果のため、専門医モード（Real Mode）でも既存の色透見・音程と同様に常時表示する
          （v2.1追補§2: 実センサリーフィードバックは両モード共通、数値・警告バナーのみEducation限定）。
          proximityは危険域(WARN_DIST_MM=4.5mm)からの接近度0-1、色はamber(注意)→red(危険接近)へ
          連続補間、既存の🔴/⚠️アラートアイコンの色使いを踏襲。 */}
      {dangerProximity > 0.05 && (() => {
        const t = dangerProximity;
        const r = Math.round(245 + (239 - 245) * t);
        const g = Math.round(166 + (68  - 166) * t);
        const b = Math.round(35  + (68  - 35)  * t);
        const edgeOpacity = Math.min(0.55, t * 0.6);
        const midOpacity  = edgeOpacity * 0.5;
        return (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9,
            background: `radial-gradient(circle at center, transparent 55%, rgba(${r},${g},${b},${midOpacity}) 78%, rgba(${r},${g},${b},${edgeOpacity}) 100%)`,
            transition: 'background 120ms linear',
          }} />
        );
      })()}

      {/* ドリル開始 — スタンドアロン時のみ中央CTAを表示 */}
      {!isControlled && !drillMode && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 15, pointerEvents: 'none',
        }}>
          <button
            onClick={() => setInternalDrillMode(true)}
            style={{
              pointerEvents: 'auto',
              padding: '14px 32px', borderRadius: 12, border: '2px solid rgba(239,68,68,0.7)',
              cursor: 'pointer', fontSize: 15, fontWeight: 800,
              background: 'rgba(239,68,68,0.18)', color: '#f87171',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 0 24px rgba(239,68,68,0.3)',
              transition: 'all .15s',
            }}
          >🔴 ドリル開始</button>
        </div>
      )}

      {/* オーバーレイ UI */}
      {/* ドリルモードトグル（スタンドアロン時）+ 回転/リセット */}
      <div style={{
        position: 'absolute', top: 10, left: 10,
        display: 'flex', gap: 6, zIndex: 10, alignItems: 'center',
      }}>
        {!isControlled && (
          <button
            onClick={() => setInternalDrillMode(v => !v)}
            style={{
              padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
              background: drillMode ? '#ef4444' : 'rgba(255,255,255,0.10)',
              color: drillMode ? '#fff' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(4px)',
              transition: 'all .15s',
            }}
          >
            🔴 {drillMode ? '削開中 ─ クリックで停止' : 'ドリル開始'}
          </button>
        )}
        {effectiveDrill && (
          <>
            <button
              onClick={() => setRotation(r => r === 'CW' ? 'CCW' : 'CW')}
              style={{
                padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)',
                cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: 'rgba(0,0,0,0.6)', color: '#7dd8e8',
                backdropFilter: 'blur(4px)',
              }}
            >
              {rotation === 'CW' ? '↻ 右回転' : '↺ 左回転'}
            </button>
            <button
              onClick={handleReset}
              style={{
                padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,100,100,0.4)',
                cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: 'rgba(0,0,0,0.6)', color: '#f87171',
                backdropFilter: 'blur(4px)',
              }}
            >
              ↺ リセット
            </button>
          </>
        )}
        {drillMode && !effectiveDrill && effectivePositionMode && (
          <span style={{
            padding: '5px 10px', borderRadius: 7,
            background: 'rgba(251,191,36,0.12)',
            border: '1px solid rgba(251,191,36,0.35)',
            color: '#fbbf24', fontSize: 11, fontWeight: 600,
          }}>⏸ 移動中は一時中断</span>
        )}
      </div>

      {/* T10: バー選択トグル（左上1段目）。2026-07-13: RPM・削開/視点ボタンと3段に分離
          （旧: バー選択+RPMを1つのflex-wrap divに同居させていたため、画面幅によって
          RPM行が2行目へ折り返り、下に固定top配置していた削開/視点ボタンと被っていた。
          3段それぞれを独立したtop固定divにすることで折り返りの影響を受けなくする） */}
      <div style={{
        position: 'absolute', top: 50, left: 10, zIndex: 10,
        display: 'flex', gap: 5, flexWrap: 'wrap', maxWidth: 250,
      }}>
        {DRILL_BURRS.map(b => (
          <button
            key={b.id}
            onClick={() => setBurrId(b.id)}
            title={b.labelJa}
            style={{
              padding: '5px 9px', borderRadius: 7, cursor: 'pointer',
              fontSize: 10, fontWeight: burrId === b.id ? 700 : 400,
              border: `1px solid ${burrId === b.id ? '#ffd166' : 'rgba(255,255,255,0.18)'}`,
              background: burrId === b.id ? 'rgba(255,209,102,0.20)' : 'rgba(10,15,26,0.72)',
              color: burrId === b.id ? '#ffd166' : '#7a8898',
              backdropFilter: 'blur(4px)', transition: 'all .15s',
            }}
          >{b.type === 'cutting' ? '🔵' : '💎'} {b.diameterMm}mm</button>
        ))}
      </div>

      {/* T10: RPMプリセット（左上2段目） */}
      <div style={{
        position: 'absolute', top: 84, left: 10, zIndex: 10,
        display: 'flex', gap: 5, flexWrap: 'wrap', maxWidth: 250,
      }}>
        {(['low', 'mid', 'high'] as const).map(p => (
          <button
            key={p}
            onClick={() => setRpmPreset(p)}
            style={{
              padding: '5px 9px', borderRadius: 7, cursor: 'pointer',
              fontSize: 10, fontWeight: rpmPreset === p ? 700 : 400,
              border: `1px solid ${rpmPreset === p ? '#7dd8e8' : 'rgba(255,255,255,0.18)'}`,
              background: rpmPreset === p ? 'rgba(125,216,232,0.20)' : 'rgba(10,15,26,0.72)',
              color: rpmPreset === p ? '#7dd8e8' : '#7a8898',
              backdropFilter: 'blur(4px)', transition: 'all .15s',
            }}
          >RPM:{p === 'low' ? '低' : p === 'mid' ? '中' : '高'}</button>
        ))}
      </div>

      {/* 2026-07-13: 固定/移動中トグル（左上3段目）。旧・削開/視点ボタンと顕微鏡モードの
          固定/移動中ボタン（外側LearningMode.tsx等）が機能的に衝突していたため統一（[[feedback]]参照）。
          通常・顕微鏡どちらのviewModeでも表示し、ボタンクリックまたはスペースキーで切替できる。 */}
      {drillMode && (
        <div style={{
          position: 'absolute', top: 118, left: 10, zIndex: 10,
          display: 'flex', gap: 5,
        }}>
          <button
            onClick={() => handlePositionModeChange(!effectivePositionMode)}
            title={effectivePositionMode ? '移動中 — クリック/スペースキーで固定へ（削開再開）' : '固定 — クリック/スペースキーで移動中へ（削開一時停止）'}
            style={{
              padding: '5px 9px', borderRadius: 7, cursor: 'pointer',
              fontSize: 10, fontWeight: 700,
              border: `1px solid ${effectivePositionMode ? '#00c4e8' : '#a78bfa'}`,
              background: effectivePositionMode ? 'rgba(0,180,216,0.20)' : 'rgba(167,139,250,0.20)',
              color: effectivePositionMode ? '#00c4e8' : '#a78bfa',
              backdropFilter: 'blur(4px)', transition: 'all .15s',
            }}
          >{effectivePositionMode ? '🔓 移動中' : '🔒 固定'}</button>
        </div>
      )}

      {/* ホール数表示 */}
      {holeCount > 0 && (
        <div style={{
          position: 'absolute', top: 10 + rightOverlayOffset, right: 10, zIndex: 10,
          padding: '5px 10px', borderRadius: 7,
          background: 'rgba(0,0,0,0.65)', color: '#7dd8e8',
          fontSize: 11, backdropFilter: 'blur(4px)',
        }}>
          削開: {holeCount} ポイント
        </div>
      )}

      {/* Sprint6・Heat: 発熱ゲージ（専門医モード=Real Mode相当では非表示。v2.1追補§2の
          モード分岐方針: 数値表示・警告は教育的足場のためEducation Modeのみ。危険接近時と
          同様に0.15以上で表示開始し、目立たせすぎないよう低いうちは隠す） */}
      {!expertMode && effectiveDrill && heatLevel >= 0.15 && (
        <div style={{
          position: 'absolute', top: 108 + rightOverlayOffset, right: 10, zIndex: 10,
          padding: '5px 10px', borderRadius: 7, width: 96,
          background: 'rgba(0,0,0,0.65)',
          border: heatLevel >= 0.85 ? '1px solid rgba(239,68,68,0.6)'
                : heatLevel >= 0.6  ? '1px solid rgba(251,146,60,0.5)'
                :                     '1px solid rgba(251,191,36,0.3)',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, marginBottom: 3,
            color: heatLevel >= 0.85 ? '#f87171' : heatLevel >= 0.6 ? '#fdba74' : '#fde047',
          }}>🌡️ 発熱 {Math.round(heatLevel * 100)}%</div>
          <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.round(heatLevel * 100)}%`, height: '100%',
              background: heatLevel >= 0.85 ? '#ef4444' : heatLevel >= 0.6 ? '#fb923c' : '#fbbf24',
              transition: 'width .15s',
            }} />
          </div>
        </div>
      )}

      {/* Distance to Antrum（専門医モードでは非表示）*/}
      {!expertMode && antrumDist !== null && (
        <div style={{
          position: 'absolute', top: 44 + rightOverlayOffset, right: 10, zIndex: 10,
          padding: '6px 12px', borderRadius: 7,
          background: antrumDist < ANTRUM_REACHED_DIST
            ? 'rgba(74,222,128,0.20)'
            : 'rgba(0,0,0,0.65)',
          border: antrumDist < ANTRUM_REACHED_DIST
            ? '1px solid rgba(74,222,128,0.6)'
            : '1px solid rgba(134,239,172,0.25)',
          color: antrumDist < ANTRUM_REACHED_DIST ? '#4ade80' : '#86efac',
          fontSize: 11, fontWeight: 700, backdropFilter: 'blur(4px)',
          transition: 'all .2s',
        }}>
          {antrumDist < ANTRUM_REACHED_DIST
            ? '🟢 Reached Antrum!'
            : `🎯 Antrum: ${antrumDist.toFixed(1)} mm`}
        </div>
      )}

      {/* 削開方向ガイド（専門医モードでは非表示）*/}
      {!expertMode && drillDirection && antrumDist !== null && antrumDist >= ANTRUM_REACHED_DIST && (
        <div style={{
          position: 'absolute', top: 76 + rightOverlayOffset, right: 10, zIndex: 10,
          padding: '5px 10px', borderRadius: 7,
          background: 'rgba(0,0,0,0.65)',
          border: '1px solid rgba(251,191,36,0.35)',
          color: '#fde68a',
          fontSize: 11, fontWeight: 600, backdropFilter: 'blur(4px)',
          letterSpacing: '0.03em',
        }}>
          {drillDirection}
        </div>
      )}

      {/* T8/Sprint4(Expert Coach): 教育カード（なぜ削れた/危険/交換の3種＋Pressure/Angle/
          Feed Rate/RPMの技術指導を状況で出し分け、既存アラート帯の拡張）。
          専門医モード(expertMode=Real Mode相当)では非表示（v2.1追補§2のモード分岐表） */}
      {!expertMode && eduCard && (
        <div style={{
          position: 'absolute', bottom: alertMsg ? 52 : 10, left: '50%', transform: 'translateX(-50%)',
          maxWidth: 340, padding: '10px 14px', borderRadius: 10, zIndex: 20,
          background: eduCard.kind === 'whyBurrChange' ? 'rgba(251,146,60,0.16)'
                    : eduCard.kind === 'whyDanger'      ? 'rgba(239,68,68,0.14)'
                    :                                     'rgba(56,189,248,0.14)',
          border: eduCard.kind === 'whyBurrChange' ? '1px solid rgba(251,146,60,0.5)'
                : eduCard.kind === 'whyDanger'      ? '1px solid rgba(239,68,68,0.4)'
                :                                      '1px solid rgba(56,189,248,0.4)',
          backdropFilter: 'blur(4px)', transition: 'bottom .2s',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 800, marginBottom: 3,
            color: eduCard.kind === 'whyBurrChange' ? '#fdba74'
                 : eduCard.kind === 'whyDanger'      ? '#fca5a5'
                 :                                      '#7dd3fc',
          }}>
            {eduCard.kind === 'whyBurrChange' ? '🔁' : eduCard.kind === 'whyDanger' ? '⚠️' : '💡'} {eduCard.titleJa}
          </div>
          <div style={{ fontSize: 11.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.85)' }}>
            {eduCard.bodyJa}
          </div>
        </div>
      )}

      {/* 危険部位アラート（色透見バッジ含む）。専門医モード(Real Mode相当)では非表示
          （v2.1追補§2のモード分岐表: 危険構造の距離表示・警告バナー/色調ブレンドは
          Education Modeのみ。計算自体（onAlert/onDangerTint呼び出し）は両モードで常時
          継続するため採点・レビューへの影響はない） */}
      {!expertMode && alertMsg && (
        <div style={{
          position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 16px', borderRadius: 9, zIndex: 20,
          background: alertMsg.startsWith('🔴') ? 'rgba(239,68,68,0.18)' : 'rgba(251,191,36,0.15)',
          border: alertMsg.startsWith('🔴') ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(251,191,36,0.4)',
          color: alertMsg.startsWith('🔴') ? '#fca5a5' : '#fde047',
          fontSize: 12, fontWeight: 700, backdropFilter: 'blur(4px)',
          whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {/* T7: 色透見（該当リージョン材料色を接近度でブレンド） */}
          {dangerTint && (
            <span style={{
              display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
              background: dangerTint, boxShadow: `0 0 6px ${dangerTint}`, flexShrink: 0,
            }} />
          )}
          {alertMsg}
        </div>
      )}

      {/* 専門医モードトグル */}
      <button
        onClick={() => setExpertMode(v => !v)}
        style={{
          position: 'absolute', bottom: 76, right: 10, zIndex: 10,
          padding: '5px 10px', borderRadius: 7,
          border: expertMode
            ? '1px solid rgba(251,191,36,0.6)'
            : '1px solid rgba(255,255,255,0.18)',
          cursor: 'pointer', fontSize: 10, fontWeight: 700,
          background: expertMode ? 'rgba(251,191,36,0.15)' : 'rgba(0,0,0,0.5)',
          color: expertMode ? '#fde68a' : 'rgba(255,255,255,0.4)',
          backdropFilter: 'blur(4px)',
        }}
      >
        {expertMode ? '🧠 専門医モード（ヒント非表示）' : '🧠 教育モード（ヒント表示）'}
      </button>

      {/* ガイドレイヤートグル */}
      <button
        onClick={() => setShowGuide(v => !v)}
        style={{
          position: 'absolute', bottom: 44, right: 10, zIndex: 10,
          padding: '5px 10px', borderRadius: 7,
          border: '1px solid rgba(255,255,255,0.18)',
          cursor: 'pointer', fontSize: 10, fontWeight: 700,
          background: showGuide ? 'rgba(74,222,128,0.15)' : 'rgba(0,0,0,0.5)',
          color: showGuide ? '#4ade80' : 'rgba(255,255,255,0.4)',
          backdropFilter: 'blur(4px)',
        }}
      >
        {showGuide ? '🗺 ガイド ON' : '🗺 ガイド OFF'}
      </button>

      {/* 【2026-07-15新設】ガイド各要素の説明トグル（shojiさん要望: チャットで説明した内容をアプリ内でも確認できるように） */}
      {showGuide && (
        <button
          onClick={() => setShowGuideLegend(v => !v)}
          style={{
            position: 'absolute', bottom: 44, right: 226, zIndex: 10,
            padding: '5px 10px', borderRadius: 7,
            border: '1px solid rgba(255,255,255,0.18)',
            cursor: 'pointer', fontSize: 10, fontWeight: 700,
            background: showGuideLegend ? 'rgba(74,222,128,0.15)' : 'rgba(0,0,0,0.5)',
            color: showGuideLegend ? '#4ade80' : 'rgba(255,255,255,0.4)',
            backdropFilter: 'blur(4px)',
          }}
        >
          ℹ️ ガイドの説明
        </button>
      )}
      {showGuide && showGuideLegend && (
        <div style={{
          position: 'absolute', bottom: 78, right: 196, zIndex: 10,
          display: 'flex', flexDirection: 'column', gap: 5,
          padding: '8px 10px', borderRadius: 8, width: 230,
          background: 'rgba(10,15,26,0.9)', border: '1px solid rgba(74,222,128,0.3)',
          backdropFilter: 'blur(4px)', fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6,
        }}>
          {([
            ['🟦', '水色の棒', 'Temporal Line（側頭線）。これより上は硬膜・脳への危険域'],
            ['🟨', '黄色いワイヤーフレーム錐台', 'すり鉢状削開ガイド。骨表面は広く、乳突洞に向かって狭くなる'],
            ['🟢', '緑の小さな点', 'Safe Entry（推奨削開開始点＝MacEwen三角の中心）'],
            ['🟩', '緑の三角形', 'MacEwen三角（乳突削開の標準的な安全開始域）'],
            ['🟢🟡🟠', '緑・黄・オレンジのリング', '削開深度の目安（5mm/10mm/14mm）'],
            ['⚪🟢', '緑の半透明球＋ワイヤーフレーム球', '乳突洞（Antrum）ターゲット。最初に到達すべきランドマーク'],
          ]).map(([icon, name, desc]) => (
            <div key={name}>
              <span style={{ fontWeight: 700 }}>{icon} {name}</span>：{desc}
            </div>
          ))}
        </div>
      )}

      {/* 【2026-07-15新設→同日ドラッグ式ギズモへ改訂】ガイド編集トグル＋TransformControlsモード切替＋
          現在値の読み取り専用表示（shojiさん指摘: 数値入力より3Dドラッグの方が調整しやすいとのこと） */}
      {showGuide && (
        <button
          onClick={() => setGuideEditMode(v => !v)}
          style={{
            position: 'absolute', bottom: 44, right: 118, zIndex: 10,
            padding: '5px 10px', borderRadius: 7,
            border: '1px solid rgba(255,255,255,0.18)',
            cursor: 'pointer', fontSize: 10, fontWeight: 700,
            background: guideEditMode ? 'rgba(96,165,250,0.20)' : 'rgba(0,0,0,0.5)',
            color: guideEditMode ? '#60a5fa' : 'rgba(255,255,255,0.4)',
            backdropFilter: 'blur(4px)',
          }}
        >
          📐 ガイド編集{guideEditMode ? ' ON' : ''}
        </button>
      )}
      {showGuide && guideEditMode && (
        <div style={{
          position: 'absolute', bottom: 78, right: 10, zIndex: 10,
          display: 'flex', flexDirection: 'column', gap: 6,
          padding: '8px 10px', borderRadius: 8, width: 176,
          background: 'rgba(10,15,26,0.85)', border: '1px solid rgba(96,165,250,0.3)',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.5)' }}>
            緑の球をドラッグして調整
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {([
              { mode: 'translate' as const, label: '↔ 移動' },
              { mode: 'rotate'    as const, label: '⟲ 回転' },
              { mode: 'scale'     as const, label: '⤢ 拡縮' },
            ]).map(({ mode, label }) => (
              <button
                key={mode}
                onClick={() => setGuideGizmoMode(mode)}
                style={{
                  flex: 1, padding: '4px 0', borderRadius: 5, fontSize: 9.5, fontWeight: 700,
                  cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)',
                  background: guideGizmoMode === mode ? 'rgba(96,165,250,0.30)' : 'rgba(255,255,255,0.06)',
                  color: guideGizmoMode === mode ? '#60a5fa' : 'rgba(255,255,255,0.6)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, fontFamily: 'monospace' }}>
            位置 X:{guideTransform.x.toFixed(1)} Y:{guideTransform.y.toFixed(1)} Z:{guideTransform.z.toFixed(1)}<br />
            回転 X:{guideTransform.rx.toFixed(0)}° Y:{guideTransform.ry.toFixed(0)}° Z:{guideTransform.rz.toFixed(0)}°<br />
            縮尺 X:{guideTransform.sx.toFixed(2)} Y:{guideTransform.sy.toFixed(2)} Z:{guideTransform.sz.toFixed(2)}
          </div>
          <button
            onClick={() => setGuideResetSignal(s => s + 1)}
            style={{
              padding: '4px 8px', borderRadius: 6, fontSize: 9.5, fontWeight: 700,
              cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
            }}
          >
            初期位置に戻す
          </button>
        </div>
      )}

      {/* T10: 荷重スライダー（左下、Pressure 0.2-1.0 既定0.6） */}
      <div style={{
        position: 'absolute', bottom: 78, left: 10, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 10px', borderRadius: 7,
        background: 'rgba(10,15,26,0.72)', border: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(4px)',
      }}>
        <span style={{ fontSize: 10, color: '#7a8898', fontWeight: 700 }}>荷重</span>
        <input
          type="range" min={0.2} max={1.0} step={0.05} value={pressure}
          onChange={e => setPressure(parseFloat(e.target.value))}
          style={{ width: 90, accentColor: '#ffd166' }}
        />
        <span style={{ fontSize: 10, color: '#ffd166', fontWeight: 700, minWidth: 26 }}>{pressure.toFixed(2)}</span>
      </div>

      {/* 可視化コントロール */}
      <div style={{
        position: 'absolute', bottom: 44, left: 10, zIndex: 10,
        display: 'flex', gap: 5,
      }}>
        {/* 骨 表示トグル */}
        <button
          onClick={() => setBoneVis(v => v === 'solid' ? 'ghost' : v === 'ghost' ? 'hidden' : 'solid')}
          style={{
            padding: '5px 10px', borderRadius: 7,
            cursor: 'pointer', fontSize: 10, fontWeight: 700,
            background: boneVis === 'solid'  ? 'rgba(226,232,240,0.15)'
                      : boneVis === 'ghost'  ? 'rgba(125,216,232,0.15)'
                      : 'rgba(0,0,0,0.5)',
            color: boneVis === 'solid'  ? '#e2e8f0'
                 : boneVis === 'ghost'  ? '#7dd8e8'
                 : 'rgba(255,255,255,0.3)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          🦴 骨: {boneVis === 'solid' ? '実体' : boneVis === 'ghost' ? '半透明' : '非表示'}
        </button>
        {/* 耳小骨 表示トグル */}
        <button
          onClick={() => setOssicleVis(v => v === 'solid' ? 'ghost' : v === 'ghost' ? 'hidden' : 'solid')}
          style={{
            padding: '5px 10px', borderRadius: 7,
            cursor: 'pointer', fontSize: 10, fontWeight: 700,
            background: ossicleVis === 'solid'  ? 'rgba(230,169,58,0.15)'
                      : ossicleVis === 'ghost'  ? 'rgba(125,216,232,0.15)'
                      : 'rgba(0,0,0,0.5)',
            color: ossicleVis === 'solid'  ? '#e6a93a'
                 : ossicleVis === 'ghost'  ? '#7dd8e8'
                 : 'rgba(255,255,255,0.3)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          🔮 耳小骨: {ossicleVis === 'solid' ? '表示' : ossicleVis === 'ghost' ? '半透明' : '非表示'}
        </button>
        {/* 神経 表示トグル */}
        <button
          onClick={() => setNerveVis(v => v === 'solid' ? 'ghost' : v === 'ghost' ? 'hidden' : 'solid')}
          style={{
            padding: '5px 10px', borderRadius: 7,
            cursor: 'pointer', fontSize: 10, fontWeight: 700,
            background: nerveVis === 'solid'  ? 'rgba(245,216,32,0.15)'
                      : nerveVis === 'ghost'  ? 'rgba(125,216,232,0.15)'
                      : 'rgba(0,0,0,0.5)',
            color: nerveVis === 'solid'  ? '#f5d820'
                 : nerveVis === 'ghost'  ? '#7dd8e8'
                 : 'rgba(255,255,255,0.3)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          ⚡ 神経: {nerveVis === 'solid' ? '表示' : nerveVis === 'ghost' ? '半透明' : '非表示'}
        </button>
        {/* 【2026-07-15新設】病変 表示トグル（shojiさん要望: 骨・耳小骨・神経と同様に非表示可能に。
            半透明モードは「不要」とのことなので表示/非表示の2値のみ） */}
        <button
          onClick={() => setDiseaseVis(v => !v)}
          style={{
            padding: '5px 10px', borderRadius: 7,
            cursor: 'pointer', fontSize: 10, fontWeight: 700,
            background: diseaseVis ? 'rgba(232,224,200,0.18)' : 'rgba(0,0,0,0.5)',
            color: diseaseVis ? '#e8e0c8' : 'rgba(255,255,255,0.3)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          🦠 病変: {diseaseVis ? '表示' : '非表示'}
        </button>
      </div>

      {/* 操作ガイド（ドリルOFF時）*/}
      {!effectiveDrill && (
        <div style={{
          position: 'absolute', bottom: 10, left: 10, zIndex: 10,
          padding: '6px 10px', borderRadius: 7,
          background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.45)',
          fontSize: 10, backdropFilter: 'blur(4px)',
          lineHeight: 1.6,
        }}>
          左ドラッグ: 回転　右ドラッグ: 回転　スクロール: ズーム　｜　1/2/3: バー切替
        </div>
      )}
      {effectiveDrill && (
        <div style={{
          position: 'absolute', bottom: 10, left: 10, zIndex: 10,
          padding: '6px 10px', borderRadius: 7,
          background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.45)',
          fontSize: 10, backdropFilter: 'blur(4px)',
          lineHeight: 1.6,
        }}>
          左クリック&ドラッグ: 削開　右ドラッグ: 回転　スクロール: ズーム　｜　Space: 削開⇄視点切替　Shift: 荷重最大　Ctrl: 荷重最小　1/2/3: バー切替　｜　🔧/🎥: 1本指ドラッグの意味を切替(タッチ向け)
        </div>
      )}
      {/* T9: スコアパネル（リセット/到達時に表示、3軸内訳＋「事実→意味→改善策」レビュー） */}
      {/* Sprint5: reviewOpen中はこの大きいモーダルを隠し、3Dピン用のコンパクトなオーバーレイに切り替える */}
      {scoreResult && !reviewOpen && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 40, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(5,8,14,0.72)', backdropFilter: 'blur(3px)',
        }}>
          <div style={{
            width: 'min(92%, 420px)', maxHeight: '82%', overflowY: 'auto',
            padding: '20px 22px', borderRadius: 14,
            background: 'rgba(14,20,32,0.96)', border: '1px solid rgba(125,216,232,0.25)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0' }}>削開スコア</span>
              <span style={{ fontSize: 26, fontWeight: 900, color: '#7dd8e8' }}>{scoreResult.breakdown.total}<span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}> / 100</span></span>
            </div>

            {/* 3軸内訳 */}
            <div style={{ display: 'flex', gap: 8, margin: '12px 0 16px' }}>
              {([
                { label: '安全',     value: scoreResult.breakdown.safety,             max: 60, color: '#f87171' },
                { label: '効率',     value: scoreResult.breakdown.efficiency,         max: 25, color: '#fbbf24' },
                { label: '骨質適応', value: scoreResult.breakdown.materialAdaptation, max: 15, color: '#4ade80' },
              ] as const).map(axis => (
                <div key={axis.label} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>{axis.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: axis.color }}>{axis.value}<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}> /{axis.max}</span></div>
                </div>
              ))}
            </div>

            {/* 事実→意味→改善策レビュー */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {scoreResult.review.map((item, i) => (
                <div key={i} style={{
                  padding: '9px 11px', borderRadius: 9,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <div style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 700, marginBottom: 3 }}>{item.factJa}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 3, lineHeight: 1.5 }}>{item.meaningJa}</div>
                  <div style={{ fontSize: 11, color: '#86efac', lineHeight: 1.5 }}>→ {item.improvementJa}</div>
                </div>
              ))}
            </div>

            {/* Sprint5: Post Session Review — 位置付きダメージイベントがあれば3Dレビューへの導線を出す */}
            {scoreResult.damageEvents.some(e => e.position) ? (
              <button
                onClick={() => { setReviewOpen(true); setReviewSelectedIndex(null); }}
                style={{
                  marginTop: 10, width: '100%', padding: '9px', borderRadius: 8,
                  border: '1px solid rgba(125,216,232,0.4)', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700, background: 'rgba(125,216,232,0.12)', color: '#7dd8e8',
                }}
              >📍 削開ポイントを3Dで振り返る（{scoreResult.damageEvents.filter(e => e.position).length}件）</button>
            ) : (
              <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                危険イベントはありませんでした。振り返り対象はありません。
              </div>
            )}

            <button
              onClick={() => setScoreResult(null)}
              style={{
                marginTop: 10, width: '100%', padding: '9px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.06)', color: '#e2e8f0',
              }}
            >閉じる</button>
          </div>
        </div>
      )}

      {/* Sprint5: Post Session Review — 3Dピンレビュー用オーバーレイ（上部バー＋イベントリスト＋選択詳細カード） */}
      {scoreResult && reviewOpen && (
        <>
          <div style={{
            position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 40,
            display: 'flex', gap: 8, alignItems: 'center',
            padding: '7px 12px', borderRadius: 9,
            background: 'rgba(14,20,32,0.9)', border: '1px solid rgba(125,216,232,0.3)',
            backdropFilter: 'blur(4px)',
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#7dd8e8' }}>📍 削開ポイント 3Dレビュー</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>ピンをクリック、またはドラッグで回転して確認できます</span>
            <button
              onClick={() => setReviewOpen(false)}
              style={{
                padding: '4px 9px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
                fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.06)', color: '#e2e8f0',
              }}
            >← スコアに戻る</button>
            <button
              onClick={() => { setScoreResult(null); setReviewOpen(false); setReviewSelectedIndex(null); }}
              style={{
                padding: '4px 9px', borderRadius: 6, border: '1px solid rgba(255,100,100,0.35)', cursor: 'pointer',
                fontSize: 11, fontWeight: 700, background: 'rgba(0,0,0,0.3)', color: '#f87171',
              }}
            >閉じる</button>
          </div>

          {/* イベントリスト（左下、3Dピンと同じ選択stateを共有） */}
          <div style={{
            position: 'absolute', bottom: 50, left: 10, zIndex: 40,
            display: 'flex', flexDirection: 'column', gap: 5,
            maxHeight: '42%', overflowY: 'auto', width: 220,
          }}>
            {scoreResult.damageEvents.map((ev, i) => ev.position && (
              <button
                key={i}
                onClick={() => setReviewSelectedIndex(reviewSelectedIndex === i ? null : i)}
                style={{
                  padding: '6px 9px', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                  fontSize: 10.5, fontWeight: reviewSelectedIndex === i ? 700 : 400,
                  border: `1px solid ${reviewSelectedIndex === i ? (ev.severity === 'critical' ? '#ef4444' : '#fbbf24') : 'rgba(255,255,255,0.15)'}`,
                  background: reviewSelectedIndex === i ? 'rgba(255,255,255,0.10)' : 'rgba(10,15,26,0.75)',
                  color: ev.severity === 'critical' ? '#f87171' : '#fbbf24',
                  backdropFilter: 'blur(4px)',
                }}
              >{ev.severity === 'critical' ? '🔴' : '⚠️'} {ev.zoneNameJa ?? '危険構造'}（{(ev.t / 1000).toFixed(0)}s）</button>
            ))}
          </div>

          {/* 選択イベント詳細カード（describeDamageEventで「事実→意味→改善策」を個別に説明） */}
          {(() => {
            if (reviewSelectedIndex === null) return null;
            const ev = scoreResult.damageEvents[reviewSelectedIndex];
            if (!ev) return null;
            const item = describeDamageEvent(ev);
            return (
              <div style={{
                position: 'absolute', bottom: 50, right: 10, zIndex: 40,
                width: 'min(90%, 300px)', padding: '12px 14px', borderRadius: 10,
                background: 'rgba(14,20,32,0.96)', border: '1px solid rgba(125,216,232,0.3)',
                boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>選択中のポイント</span>
                  <span onClick={() => setReviewSelectedIndex(null)} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>×</span>
                </div>
                <div style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 700, marginBottom: 4 }}>{item.factJa}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 4, lineHeight: 1.5 }}>{item.meaningJa}</div>
                <div style={{ fontSize: 11, color: '#86efac', lineHeight: 1.5 }}>→ {item.improvementJa}</div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

useGLTF.preload('/models/Malleus.glb');
useGLTF.preload('/models/Incus.glb');
useGLTF.preload('/models/Stapes.glb');
useGLTF.preload('/models/Facial_Nerve.glb');
useGLTF.preload('/models/Chorda_Tympani.glb');
useGLTF.preload('/models/Cochleo_Vestibular_Nerve.glb');
useGLTF.preload('/models/Carotis.glb');
