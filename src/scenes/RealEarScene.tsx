/**
 * RealEarScene.tsx
 *
 * Scaniverse フォトグラメトリ GLB ビューワー
 *
 * モデル一覧（public/models/real-ear/）
 *   ear-model.glb            : ① 耳モデル単体
 *   ear-holder.glb           : ② 耳介付きホルダー
 *   ear-holder-with-model.glb: ③ ホルダー＋耳モデル設置
 *
 * スケール: Scaniverse出力はメートル単位 → scale={1000} で mm に統一
 * センタリング: drei <Center> で自動中央寄せ
 *
 * ▼ 内視鏡カメラ（② / ③ のみ）
 *   メアタス座標（centered mm）: (8.1, 64.7, 9.1)
 *   推定根拠: 境界ループ解析（XZスパン 10.2×7.0mm、Y=532mm / center Y=467.3mm）
 *   ※ デプロイ後に目視確認・微調整が必要
 */

import { Suspense, useState, useRef, useEffect, type CSSProperties } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, useGLTF, Center, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { RealAnatomy, type VisibilityMap } from './models/RealAnatomyModels';
import { Z_INDEX } from '../components/ui';

// ── モデル定義 ────────────────────────────────────────────────────────
export type RealEarModelKey = 'ear-model' | 'ear-holder' | 'ear-holder-with-model';

interface ModelInfo {
  label: string;
  file: string;
  description: string;
  useCases: string[];
  cameraPos: [number, number, number];
  /** 内視鏡視点: メアタス中心座標（centered Three.js space, mm）*/
  meatus?: [number, number, number];
  /** 内視鏡カメラ開始位置（meatus から +Y 方向 80mm 上方）*/
  endoscopeCamPos?: [number, number, number];
  /**
   * 解剖オーバーレイ: アブミ骨底板のscan centered座標（mm）
   * 算出: meatus - canal_depth(30mm) - TM_to_stapes(5.5mm) = meatus_Y - 35.5mm
   */
  anatomyStapesPos?: [number, number, number];
}

const MODEL_INFO: Record<RealEarModelKey, ModelInfo> = {
  'ear-model': {
    label: '① 耳モデル単体',
    file: '/models/real-ear/ear-model.glb',
    description: '外耳・外耳道のシリコン耳モデル単体。外耳道の形状と入射角を観察する。',
    useCases: ['外耳道の形状確認', '内視鏡挿入角度の把握'],
    cameraPos: [0, 50, 150],
  },
  'ear-holder': {
    label: '② 耳介付きホルダー',
    file: '/models/real-ear/ear-holder.glb',
    description: '耳介付きホルダー。耳介から外耳道を通じて鼓膜・耳小骨・神経等を内視鏡で観察する練習に使用。',
    useCases: [
      '🔭 内視鏡観察：耳介 → 外耳道 → 鼓膜 → 中耳腔',
      '🦴 耳小骨・顔面神経・鼓索神経の位置確認',
      '🔩 チタン製人工耳小骨（プロステーシス）設置練習',
    ],
    cameraPos: [0, 20, 250],
    //
    // ▼ 座標根拠（元Scaniverse GLB, <Center>適用後）
    //   bounds Y: 495.5〜598.9mm → center Y=547.2mm
    //   Loop30 center: (9.4, 532.0, 5.7)mm → centered: (8, -15, 10)mm
    //   endoscopeCamPos: meatus + [0, +80, 0]
    //   anatomyStapesPos: meatus_Y - 30mm(canal) - 5.5mm(TM→stapes) = -50.5
    //
    meatus: [8, -15, 10],
    endoscopeCamPos: [8, 65, 10],
    anatomyStapesPos: [8, -50.5, 10],
  },
  'ear-holder-with-model': {
    label: '③ ホルダー＋耳モデル設置',
    file: '/models/real-ear/ear-holder-with-model.glb',
    description: '耳介付きホルダーに耳モデルを設置した状態。乳突洞削開後の中耳観察とプロステーシス設置練習に使用。',
    useCases: [
      '🔨 乳突洞削開後の中耳腔観察',
      '📐 削開後の解剖学的構造の位置確認',
      '🔩 チタン製人工耳小骨（プロステーシス）設置練習',
      '⚠️ 危険部位（顔面神経・鼓索神経）回避訓練',
    ],
    cameraPos: [0, 30, 300],
    //
    // ▼ 座標根拠（元Scaniverse GLB, <Center>適用後）
    //   bounds Y: 464.9〜555.0mm → center Y=510.0mm
    //   Loop30 center (同一物理メアタス): (9.4, 532.0, 5.7)mm → centered: (10, 22, 10)mm
    //   anatomyStapesPos: 22 - 30(canal) - 5.5(TM→stapes) = -13.5
    //
    meatus: [10, 22, 10],
    endoscopeCamPos: [10, 102, 10],
    anatomyStapesPos: [10, -13.5, 10],
  },
};

// ── 解剖オーバーレイ設定 ────────────────────────────────────────────────
/**
 * 右耳スキャンモデル内に解剖モデルを重ねる際の表示設定
 * 側頭骨・外耳道は非表示（スキャンモデルが代替）
 */
// ── L1: 物理製品情報（KURZ正式型番・QRコード確定後に差し替え予定のプレースホルダー）───────
// 設計変更書2026-07-03 L1: 削開シナリオ⇄実モデル間の相互導線。型番/QR実データは未確定のため
// プレースホルダー表示とし、確定次第この定数を差し替える。
const PHYSICAL_PRODUCT_INFO = {
  modelNumber: '型番：KURZ確認後に反映（プレースホルダー）',
  qrNote: 'QRコード\n（準備中）',
};

const ANATOMY_IN_EAR_VIS: VisibilityMap = {
  bone:            'hidden',
  auricle:         'hidden',
  eac:             'hidden',
  tympanic:        'solid',
  malleus:         'solid',
  incus:           'solid',
  stapes:          'solid',
  stapesFootplate: 'solid',
  facialNerve:     'solid',
  chordaTympani:   'solid',
  innerEar:        'ghost',
  roundWindow:     'ghost',
};

/**
 * AnatomyInEar — 左耳GLB解剖モデルを右耳変換してスキャンモデル内に配置
 *
 * ▼ GLB座標系（RealAnatomyModels.tsx定義）
 *   Z+ = canal外方向（toward EAC/meatus）
 *   Y+ = inferior（患者下方）
 *   X+ = anterior（前方）
 *   アブミ骨底板 = 原点(0,0,0)
 *   鼓膜中心 = (0, 0, +5.5mm)
 *
 * ▼ スキャンモデル座標系（<Center>後）
 *   Y+ = 上方（耳が上向き = 内視鏡が上から入る方向）
 *   canal外方向 → Y+（上向き）に合わせる必要がある
 *
 * ▼ 適用変換（Three.js TRS: scale → rotation → translation の順）
 *   scale=[-1,1,1]         : 左耳→右耳ミラー（X反転）
 *   rotation=[-π/2, 0, 0] : Rx(-90°) canal軸補正
 *     GLB(0,0,1)→Scan(0,1,0): Z+→+Y ✓
 *     GLB(0,0,5.5)[TM]→Scan(0,5.5,0): 鼓膜が+Y方向（メアタスより深く） ✓
 *   position=stapesPos     : アブミ骨底板をスキャン空間に配置
 */
const DEG = Math.PI / 180;

function AnatomyInEar({
  stapesPos,
  offset,
  uniformScale,
  rotationDeg,
}: {
  stapesPos: [number, number, number];
  offset: [number, number, number];
  uniformScale: number;
  /** ユーザー調整回転 [rx, ry, rz] 度数（スキャン空間で適用） */
  rotationDeg: [number, number, number];
}) {
  const finalPos: [number, number, number] = [
    stapesPos[0] + offset[0],
    stapesPos[1] + offset[1],
    stapesPos[2] + offset[2],
  ];
  const userRot: [number, number, number] = [
    rotationDeg[0] * DEG,
    rotationDeg[1] * DEG,
    rotationDeg[2] * DEG,
  ];
  return (
    // 外側グループ: スキャン空間でのユーザー回転（直感的に操作できる）
    <group position={finalPos} rotation={userRot}>
      {/* 内側グループ: GLB→スキャン座標変換（固定） */}
      <group rotation={[-Math.PI / 2, 0, 0]} scale={[-uniformScale, uniformScale, uniformScale]}>
        <Suspense fallback={null}>
          <RealAnatomy vis={ANATOMY_IN_EAR_VIS} boneGhostOpacity={0} />
        </Suspense>
      </group>
    </group>
  );
}

// ── 内視鏡カメラコントローラー（Canvas内） ──────────────────────────────
function EndoscopeCameraController({
  active,
  meatus,
  camPos,
  defaultCamPos,
  controlsRef,
}: {
  active: boolean;
  meatus: [number, number, number];
  camPos: [number, number, number];
  defaultCamPos: [number, number, number];
  controlsRef: React.RefObject<any>;
}) {
  const { camera } = useThree();
  const cam = camera as THREE.PerspectiveCamera;

  useEffect(() => {
    if (!controlsRef.current) return;

    if (active) {
      // 内視鏡: メアタス上方からメアタスを見下ろす
      camera.position.set(...camPos);
      cam.fov = 70;
      cam.updateProjectionMatrix();
      controlsRef.current.target.set(...meatus);
      controlsRef.current.minDistance = 2;
      controlsRef.current.maxDistance = 200;
    } else {
      // 通常: デフォルトカメラ復帰
      camera.position.set(...defaultCamPos);
      cam.fov = 50;
      cam.updateProjectionMatrix();
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.minDistance = 20;
      controlsRef.current.maxDistance = 600;
    }
    controlsRef.current.update();
  }, [active]);

  return null;
}

// ── GLB モデルコンポーネント ───────────────────────────────────────────
function RealEarModel({ modelKey }: { modelKey: RealEarModelKey }) {
  const { file } = MODEL_INFO[modelKey];
  const { scene } = useGLTF(file);

  // Scaniverse GLB のマテリアル修正
  // - UV seam の黒ライン対策: テクスチャフィルタとシームブリード抑制
  // - フォトグラメトリ baked color は roughness=1, metalness=0 が適切
  useEffect(() => {
    scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        const m = mat as THREE.MeshStandardMaterial;
        // UV seam の黒ライン対策
        if (m.map) {
          m.map.generateMipmaps = true;
          m.map.minFilter = THREE.LinearMipmapLinearFilter;
          m.map.magFilter = THREE.LinearFilter;
          // anisotropy: GPU最大値を設定（斜め角度でのテクスチャ品質向上）
          m.map.anisotropy = 16;
          m.map.needsUpdate = true;
        }
        // フォトグラメトリ: baked color のみ使用、物理反射なし
        m.roughness = 1.0;
        m.metalness = 0.0;
        // 両面レンダリング（穴のある面が裏から見えるのを防ぐ）
        m.side = THREE.FrontSide;
        m.needsUpdate = true;
      });
    });
  }, [scene]);

  return (
    // Scaniverse: メートル単位 → ×1000 で mm に変換
    // Center: バウンディングボックス中心を原点に自動配置
    <Center>
      <primitive object={scene} scale={1000} />
    </Center>
  );
}

// プリロード
Object.values(MODEL_INFO).forEach(info => useGLTF.preload(info.file));

// ── メインシーンコンポーネント ────────────────────────────────────────
interface RealEarSceneProps {
  initialModel?: RealEarModelKey;
}

export function RealEarScene({ initialModel = 'ear-holder' }: RealEarSceneProps) {
  const [activeModel, setActiveModel] = useState<RealEarModelKey>(initialModel);
  const [endoscopeMode, setEndoscopeMode] = useState(false);
  const [showAnatomy, setShowAnatomy] = useState(false);
  const [anatomyOffset, setAnatomyOffset] = useState<[number, number, number]>([0, 0, 0]);
  const [anatomyRotation, setAnatomyRotation] = useState<[number, number, number]>([0, 0, 0]);
  const [anatomyScale, setAnatomyScale] = useState(1.0);
  const controlsRef = useRef<any>(null);

  const info = MODEL_INFO[activeModel];
  const hasEndoscope = Boolean(info.meatus);

  // モデル切替時に内視鏡・解剖モードをリセット
  const handleModelChange = (key: RealEarModelKey) => {
    setActiveModel(key);
    setEndoscopeMode(false);
    setShowAnatomy(false);
    setAnatomyOffset([0, 0, 0]);
    setAnatomyRotation([0, 0, 0]);
    setAnatomyScale(1.0);
  };

  // オフセット個別更新ヘルパー
  const setOffset = (axis: 0 | 1 | 2, val: number) =>
    setAnatomyOffset(prev => {
      const next = [...prev] as [number, number, number];
      next[axis] = val;
      return next;
    });

  // 回転個別更新ヘルパー
  const setRot = (axis: 0 | 1 | 2, val: number) =>
    setAnatomyRotation(prev => {
      const next = [...prev] as [number, number, number];
      next[axis] = val;
      return next;
    });

  // 内視鏡オーバーレイスタイル
  const vignetteStyle: CSSProperties = {
    position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: Z_INDEX.hud,
    background: 'radial-gradient(circle at center, rgba(0,0,0,0.0) 36%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.88) 62%, black 72%)',
  };

  const clipStyle: CSSProperties = {
    position: 'absolute', inset: 0,
    clipPath: endoscopeMode ? 'circle(43% at center)' : 'none',
    background: 'black',
    pointerEvents: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── モデル選択タブ ── */}
      <div style={{
        display: 'flex', gap: 8, padding: '8px 12px',
        borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', alignItems: 'center',
      }}>
        {(Object.keys(MODEL_INFO) as RealEarModelKey[]).map(key => (
          <button
            key={key}
            onClick={() => handleModelChange(key)}
            style={{
              padding: '5px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: activeModel === key ? 'var(--color-primary)' : 'var(--color-surface-hover)',
              color: activeModel === key ? 'var(--color-bg-primary)' : 'var(--color-text-primary)',
              cursor: 'pointer', fontSize: 13,
              fontWeight: activeModel === key ? 700 : 400,
              transition: 'all var(--duration-fast) var(--ease-standard)',
            }}
          >
            {MODEL_INFO[key].label}
          </button>
        ))}

        {/* 内視鏡ボタン（②③のみ） */}
        {hasEndoscope && (
          <button
            onClick={() => setEndoscopeMode(v => !v)}
            style={{
              marginLeft: 8, padding: '5px 12px', borderRadius: 'var(--radius-sm)',
              border: `1px solid ${endoscopeMode ? 'var(--color-primary)' : 'var(--color-border-bright)'}`,
              background: endoscopeMode ? 'var(--color-primary-tint)' : 'var(--glass-bg)',
              color: endoscopeMode ? 'var(--color-primary)' : 'var(--color-text-muted)',
              cursor: 'pointer', fontSize: 12, fontWeight: endoscopeMode ? 700 : 400,
              transition: 'all var(--duration-fast) var(--ease-standard)',
            }}
          >
            🔭 内視鏡視点
          </button>
        )}

        {/* 解剖オーバーレイボタン（②③のみ） */}
        {hasEndoscope && (
          <button
            onClick={() => setShowAnatomy(v => !v)}
            style={{
              marginLeft: 4, padding: '5px 12px', borderRadius: 'var(--radius-sm)',
              border: `1px solid ${showAnatomy ? 'var(--color-accent)' : 'var(--color-border-bright)'}`,
              background: showAnatomy ? 'rgba(201,166,107,0.18)' : 'var(--glass-bg)',
              color: showAnatomy ? 'var(--color-accent)' : 'var(--color-text-muted)',
              cursor: 'pointer', fontSize: 12, fontWeight: showAnatomy ? 700 : 400,
              transition: 'all var(--duration-fast) var(--ease-standard)',
            }}
          >
            🦴 解剖を重ねる
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)', alignSelf: 'center' }}>
          Scaniverse 実スキャン · 1unit=1mm
        </span>
      </div>

      {/* ── 3D Canvas + 情報パネル ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* 3D ビュー */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>

          {/* 内視鏡: clipPath 適用ラッパー */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <div style={endoscopeMode ? { ...clipStyle, pointerEvents: 'auto', position: 'absolute', inset: 0 } : { position: 'absolute', inset: 0 }}>
              <Canvas
                camera={{ position: info.cameraPos, fov: 50 }}
                gl={{ antialias: true }}
                style={{ width: '100%', height: '100%' }}
              >
                <color attach="background" args={['#0a0f1a']} />

                {/* ライティング: baked color を自然に照らす */}
                <ambientLight intensity={1.2} />
                <directionalLight position={[100, 200, 150]} intensity={1.5} color="#fff8f0" />
                <directionalLight position={[-100, 50, -80]} intensity={0.6} color="#c0d8ff" />
                <pointLight position={[0, 100, 50]} intensity={2.0} color="#ffffff" distance={500} decay={1} />
                <Environment preset="studio" backgroundBlurriness={1} backgroundIntensity={0.1} />

                <Suspense fallback={null}>
                  <RealEarModel key={activeModel} modelKey={activeModel} />
                </Suspense>

                {/* 解剖オーバーレイ（②③のみ） */}
                {showAnatomy && info.anatomyStapesPos && (
                  <AnatomyInEar
                    stapesPos={info.anatomyStapesPos}
                    offset={anatomyOffset}
                    uniformScale={anatomyScale}
                    rotationDeg={anatomyRotation}
                  />
                )}

                {/* 内視鏡カメラコントローラー */}
                {hasEndoscope && info.meatus && info.endoscopeCamPos && (
                  <EndoscopeCameraController
                    active={endoscopeMode}
                    meatus={info.meatus}
                    camPos={info.endoscopeCamPos}
                    defaultCamPos={info.cameraPos}
                    controlsRef={controlsRef}
                  />
                )}

                <OrbitControls
                  ref={controlsRef}
                  makeDefault
                  minDistance={endoscopeMode ? 2 : 20}
                  maxDistance={endoscopeMode ? 200 : 600}
                  enableDamping
                  dampingFactor={0.08}
                />

                <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
                  <GizmoViewport
                    axisColors={['#ff6655', '#88ee88', '#5599ff']}
                    labelColor="#ffffff"
                    labels={['X', 'Y', 'Z']}
                  />
                </GizmoHelper>
              </Canvas>
            </div>

            {/* 内視鏡ビネット（clipPathの外側のブラックアウト） */}
            {endoscopeMode && <div style={vignetteStyle} />}

            {/* 内視鏡: 青みフィルター */}
            {endoscopeMode && (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: Z_INDEX.dim,
                background: 'rgba(10, 25, 60, 0.06)',
              }} />
            )}
          </div>

          {/* 内視鏡ヘッドアップ表示 */}
          {endoscopeMode && (
            <div style={{
              position: 'absolute', top: 12, left: 16, zIndex: Z_INDEX.toolbar, pointerEvents: 'none',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{
                padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                background: 'var(--color-primary-tint)', border: '1px solid rgba(31,182,214,0.5)',
                color: 'var(--color-primary)', fontSize: 11, fontWeight: 700,
              }}>
                🔭 内視鏡視点（FOV 70°）
              </div>
              <div style={{
                padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                background: 'rgba(0,0,0,0.5)',
                color: 'rgba(255,255,255,0.6)', fontSize: 10,
              }}>
                左ドラッグ：回転　ホイール：前後移動
              </div>
            </div>
          )}
        </div>

        {/* 情報パネル */}
        <div style={{
          width: 240, padding: 'var(--space-4)', borderLeft: '1px solid var(--color-border)',
          overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
          flexShrink: 0,
        }}>
          {/* モデル説明 */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 5 }}>
              {info.label}
            </div>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.7, margin: 0 }}>
              {info.description}
            </p>
          </div>

          {/* 用途 */}
          <div>
            <div className="section-title" style={{ marginBottom: 6 }}>
              練習用途
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {info.useCases.map((uc, i) => (
                <div key={i} style={{
                  background: 'var(--color-surface-hover)', borderRadius: 'var(--radius-sm)',
                  padding: '5px 8px', fontSize: 11, color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)', lineHeight: 1.5,
                }}>
                  {uc}
                </div>
              ))}
            </div>
          </div>

          {/* 物理製品情報（L1: プレースホルダー。実データ確定後に差し替え） */}
          <div>
            <div className="section-title" style={{ marginBottom: 6 }}>
              物理モデル製品情報
            </div>
            <div style={{
              background: 'var(--color-surface-hover)', borderRadius: 'var(--radius-sm)', padding: '10px 8px',
              border: '1px dashed var(--color-border-bright)', textAlign: 'center',
            }}>
              <div style={{
                width: 56, height: 56, margin: '0 auto 8px', borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--color-border-bright)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 9,
                color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.4, whiteSpace: 'pre-line',
              }}>
                {PHYSICAL_PRODUCT_INFO.qrNote}
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                {PHYSICAL_PRODUCT_INFO.modelNumber}
              </div>
            </div>
          </div>

          {/* 解剖オーバーレイ調整パネル */}
          {showAnatomy && info.anatomyStapesPos && (() => {
            const base = info.anatomyStapesPos!;
            const abs = [
              (base[0] + anatomyOffset[0]).toFixed(1),
              (base[1] + anatomyOffset[1]).toFixed(1),
              (base[2] + anatomyOffset[2]).toFixed(1),
            ];
            const sliderStyle: CSSProperties = {
              width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer',
            };
            const labelStyle: CSSProperties = {
              display: 'flex', justifyContent: 'space-between',
              fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2,
            };
            return (
              <div style={{
                padding: '10px 10px 8px',
                background: 'var(--color-primary-tint)',
                border: '1px solid rgba(31,182,214,0.3)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 8 }}>
                  🔧 解剖位置・サイズ調整
                </div>

                {/* X */}
                <div style={labelStyle}>
                  <span>X オフセット</span>
                  <span style={{ color: 'var(--color-primary)' }}>{anatomyOffset[0] >= 0 ? '+' : ''}{anatomyOffset[0].toFixed(0)} mm</span>
                </div>
                <input type="range" min={-100} max={100} step={1}
                  value={anatomyOffset[0]}
                  onChange={e => setOffset(0, Number(e.target.value))}
                  style={sliderStyle}
                />

                {/* Y */}
                <div style={{ ...labelStyle, marginTop: 6 }}>
                  <span>Y オフセット</span>
                  <span style={{ color: 'var(--color-primary)' }}>{anatomyOffset[1] >= 0 ? '+' : ''}{anatomyOffset[1].toFixed(0)} mm</span>
                </div>
                <input type="range" min={-100} max={100} step={1}
                  value={anatomyOffset[1]}
                  onChange={e => setOffset(1, Number(e.target.value))}
                  style={sliderStyle}
                />

                {/* Z */}
                <div style={{ ...labelStyle, marginTop: 6 }}>
                  <span>Z オフセット</span>
                  <span style={{ color: 'var(--color-primary)' }}>{anatomyOffset[2] >= 0 ? '+' : ''}{anatomyOffset[2].toFixed(0)} mm</span>
                </div>
                <input type="range" min={-100} max={100} step={1}
                  value={anatomyOffset[2]}
                  onChange={e => setOffset(2, Number(e.target.value))}
                  style={sliderStyle}
                />

                {/* Scale */}
                <div style={{ ...labelStyle, marginTop: 8 }}>
                  <span>スケール</span>
                  <span style={{ color: 'var(--color-primary)' }}>× {anatomyScale.toFixed(2)}</span>
                </div>
                <input type="range" min={0.1} max={5} step={0.05}
                  value={anatomyScale}
                  onChange={e => setAnatomyScale(Number(e.target.value))}
                  style={sliderStyle}
                />

                {/* 区切り */}
                <div style={{ borderTop: '1px solid rgba(31,182,214,0.2)', margin: '10px 0 8px' }} />

                {/* Rx */}
                <div style={labelStyle}>
                  <span>回転 X（前後傾き）</span>
                  <span style={{ color: 'var(--color-primary)' }}>{anatomyRotation[0] >= 0 ? '+' : ''}{anatomyRotation[0]}°</span>
                </div>
                <input type="range" min={-180} max={180} step={1}
                  value={anatomyRotation[0]}
                  onChange={e => setRot(0, Number(e.target.value))}
                  style={sliderStyle}
                />

                {/* Ry */}
                <div style={{ ...labelStyle, marginTop: 6 }}>
                  <span>回転 Y（左右回転）</span>
                  <span style={{ color: 'var(--color-primary)' }}>{anatomyRotation[1] >= 0 ? '+' : ''}{anatomyRotation[1]}°</span>
                </div>
                <input type="range" min={-180} max={180} step={1}
                  value={anatomyRotation[1]}
                  onChange={e => setRot(1, Number(e.target.value))}
                  style={sliderStyle}
                />

                {/* Rz */}
                <div style={{ ...labelStyle, marginTop: 6 }}>
                  <span>回転 Z（左右傾き）</span>
                  <span style={{ color: 'var(--color-primary)' }}>{anatomyRotation[2] >= 0 ? '+' : ''}{anatomyRotation[2]}°</span>
                </div>
                <input type="range" min={-180} max={180} step={1}
                  value={anatomyRotation[2]}
                  onChange={e => setRot(2, Number(e.target.value))}
                  style={sliderStyle}
                />

                {/* 現在値表示 */}
                <div style={{
                  marginTop: 10, padding: '5px 7px',
                  background: 'rgba(0,0,0,0.4)', borderRadius: 'var(--radius-sm)',
                  fontSize: 9, color: 'var(--color-text-muted)', lineHeight: 1.7, fontFamily: 'monospace',
                }}>
                  pos: [{abs[0]}, {abs[1]}, {abs[2]}]<br />
                  rot: [{anatomyRotation[0]}, {anatomyRotation[1]}, {anatomyRotation[2]}]°<br />
                  scale: {anatomyScale.toFixed(2)}
                </div>

                {/* リセット */}
                <button
                  onClick={() => { setAnatomyOffset([0,0,0]); setAnatomyRotation([0,0,0]); setAnatomyScale(1.0); }}
                  style={{
                    marginTop: 8, width: '100%', padding: '4px 0',
                    background: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border-bright)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--color-text-muted)', fontSize: 10, cursor: 'pointer',
                  }}
                >
                  リセット
                </button>
              </div>
            );
          })()}

          {/* 内視鏡ヒント */}
          {hasEndoscope && (
            <div style={{
              padding: '8px 10px',
              background: endoscopeMode ? 'var(--color-primary-tint)' : 'var(--color-surface-hover)',
              border: `1px solid ${endoscopeMode ? 'rgba(31,182,214,0.3)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-md)', fontSize: 11, lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 600, color: 'var(--color-primary)', marginBottom: 3 }}>
                🔭 内視鏡視点
              </div>
              <div style={{ color: 'var(--color-text-muted)' }}>
                {endoscopeMode
                  ? '外耳道孔の上方から見下ろしています。ドラッグで角度を変えてください。'
                  : '「内視鏡視点」ボタンで外耳道孔へカメラを移動します。'}
              </div>
            </div>
          )}

          {/* 操作ヒント */}
          <div style={{
            marginTop: 'auto', padding: '8px 10px',
            background: 'var(--color-primary-tint)',
            border: '1px solid rgba(31,182,214,0.15)',
            borderRadius: 'var(--radius-md)', fontSize: 10, color: 'var(--color-text-muted)', lineHeight: 1.8,
          }}>
            <div style={{ fontWeight: 600, color: 'var(--color-primary)', marginBottom: 3 }}>操作</div>
            左ドラッグ：回転<br />
            右ドラッグ：パン<br />
            ホイール：ズーム
          </div>

          {/* データ品質ノート */}
          <div style={{
            padding: '7px 9px',
            background: 'var(--color-warning-bg)',
            border: '1px solid rgba(240,181,69,0.2)',
            borderRadius: 'var(--radius-sm)', fontSize: 10, color: 'var(--color-warning)', lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>📷 スキャン情報</div>
            Scaniverse原本GLB使用。
            {hasEndoscope && '解剖オーバーレイは右耳変換後の参照位置。'}
          </div>
        </div>
      </div>
    </div>
  );
}
