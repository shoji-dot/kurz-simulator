import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { useSimStore } from '../store/useSimStore';
import { kurzProducts } from '../data/products';
import { AnatomyScene } from '../scenes/AnatomyScene';
import type { ViewMode, EndoscopeAlert } from '../scenes/AnatomyScene';
import { DrillTrainingScene, DRILL_STEPS } from '../scenes/DrillTrainingScene';
import { DANGER_ZONES, FACIAL_ZONES, VASCULAR_ZONES } from '../data/dangerZones';
import {
  DEFAULT_MODES,
  type OpacityMode,
  type StructureKey,
  type VisibilityMap,
} from '../scenes/models/RealAnatomyModels';

// ── 解剖構造リスト ────────────────────────────────────────────────
const anatomyStructures = [
  { id: 'tympanoCavity', label: '鼓室 (Tympanic Cavity)', desc: '中耳腔。6つの壁で構成される空間。内側壁に岬角・卵円窓・正円窓が位置し、顔面神経水平部・鼓索神経が走行する。耳管で鼻咽腔に通じる。', color: '#e8c0a0' },
  { id: 'malleus',  label: 'ツチ骨 (Malleus)',  desc: '鼓膜に付着する最外側の耳小骨。鼓膜の振動を受け取りキヌタ骨に伝達。マニュブリウム（柄）とヘッド部からなる。', color: '#e6a93a' },
  { id: 'incus',   label: 'キヌタ骨 (Incus)',   desc: '中間に位置する耳小骨。体部・短突起・長突起から構成。慢性中耳炎では長突起尖端から壊死しやすい。', color: '#d9892a' },
  { id: 'stapes',  label: 'アブミ骨 (Stapes)',  desc: '最内側かつ最小の耳小骨。頭部・前後弓・底板で構成。底板が卵円窓を塞ぎ蝸牛へ振動を伝える。', color: '#f2cb54' },
  { id: 'membrane', label: '鼓膜 (Tympanic M.)', desc: '外耳道と鼓室を隔てる薄い膜。厚さ約0.1mm。中央部（臍）にツチ骨が付着。', color: '#f5e6c8' },
];

// ── 3D表示切替アイテム定義 ──────────────────────────────────────
const VIS_ITEMS: { key: StructureKey; label: string; color: string; indent?: boolean }[] = [
  { key: 'bone',          label: '側頭骨',  color: '#f2ead8' },
  { key: 'malleus',       label: 'ツチ骨 (Malleus)',  color: '#e6a93a', indent: true },
  { key: 'incus',         label: 'キヌタ骨 (Incus)',  color: '#d9892a', indent: true },
  { key: 'stapes',        label: 'アブミ骨 (Stapes)', color: '#f2cb54', indent: true },
  { key: 'stapesFootplate', label: '底板 (Footplate)', color: '#00e5ff', indent: true },
  { key: 'tympanic',      label: '鼓膜',    color: '#f8d8c0' },
  { key: 'innerEar',      label: '内耳',    color: '#60b8e0' },
  { key: 'facialNerve',   label: '顔面神経', color: '#f5d820' },
  { key: 'chordaTympani', label: '鼓索神経', color: '#f0b830' },
  { key: 'eac',           label: '外耳道',  color: '#d8c8a0' },
  { key: 'roundWindow',   label: '正円窓',  color: '#5888a8' },
];

const CYCLE: OpacityMode[] = ['solid', 'ghost', 'hidden'];
const MODE_LABEL: Record<OpacityMode, string> = { solid: '実体', ghost: '半透明', hidden: '非表示' };
const MODE_BG: Record<OpacityMode, string> = {
  solid:  'var(--accent)',
  ghost:  'rgba(0,180,216,0.30)',
  hidden: 'rgba(255,255,255,0.07)',
};
const MODE_FG: Record<OpacityMode, string> = {
  solid:  '#001a20',
  ghost:  '#7dd8e8',
  hidden: '#555',
};

// ── 術式データ ─────────────────────────────────────────────────────
const procedures = [
  {
    title: 'PORP 設置手順（ベル型）',
    steps: [
      'アブミ骨頭部の露出・確認：上部構造の可動性チェック',
      'サイジング：サイザーでツチ骨柄〜アブミ骨頭部距離を計測',
      '適切シャフト長のPORPを選択（通常+0.5mm余裕）',
      'アブミ骨頭部にベル部を設置（正中・垂直を確認）',
      '頭板と鼓膜の間に薄い軟骨片を挿入',
      '鼓膜フラップを戻しPORPを被覆',
      '設置後の安定性・角度を確認',
    ],
  },
  {
    title: 'TORP 設置手順（フラット型）',
    steps: [
      'アブミ骨底板の可動性確認（固定なら先に解放）',
      '必要に応じて底板上に軟骨または筋膜を置く',
      'サイジング：鼓膜〜底板間距離を計測',
      '適切シャフト長のTORPを選択',
      'フット部を底板中央に設置（前後左右のバランス確認）',
      '頭板を鼓膜フラップに当て、軽く張力がかかる高さに調整',
      '頭板上に軟骨片を挿入後、鼓膜閉鎖',
    ],
  },
];

// ── 解剖学習コース定義（4レベル）────────────────────────────────────
const ANATOMY_COURSES = [
  {
    level: 1,
    title: 'Level 1：外耳道・鼓膜・中耳腔',
    goal: '外耳道から鼓室への空間的連続性を理解する',
    vis: { bone: 'ghost', eac: 'solid', tympanic: 'solid', auricle: 'hidden',
           malleus: 'ghost', incus: 'hidden', stapes: 'hidden',
           facialNerve: 'hidden', chordaTympani: 'hidden', innerEar: 'hidden', roundWindow: 'hidden' } as VisibilityMap,
    quiz: {
      question: '鼓膜は外耳道の長軸に対してほぼ垂直（90°）に位置しているか？',
      options: ['はい（ほぼ垂直）', 'いいえ（約55°の傾斜がある）'],
      correct: 1,
      explanation: '鼓膜は外耳道の長軸に対して約55°傾いています。この傾きにより後上方が「ツチ骨臍」として最深部となります。内視鏡や顕微鏡の挿入角度に影響します。',
    },
  },
  {
    level: 2,
    title: 'Level 2：耳小骨連鎖と音伝達',
    goal: '3骨の配置関係と音響伝達経路を立体的に把握する',
    vis: { bone: 'ghost', eac: 'ghost', tympanic: 'ghost', auricle: 'hidden',
           malleus: 'solid', incus: 'solid', stapes: 'solid',
           facialNerve: 'hidden', chordaTympani: 'hidden', innerEar: 'ghost', roundWindow: 'hidden' } as VisibilityMap,
    quiz: {
      question: '慢性中耳炎でキヌタ骨長突起が欠損した場合、最も音伝達が途絶えやすい部位はどこか？',
      options: ['ツチ骨柄〜鼓膜接合部', 'キヌタ骨長突起〜アブミ骨頭部の間', 'アブミ骨底板〜卵円窓の間'],
      correct: 1,
      explanation: 'キヌタ骨長突起尖端（レンズ状突起）とアブミ骨頭部の接合部（砧鐙関節）が最も壊死しやすい部位です。この部位の断絶がPORPの主な適応となります。',
    },
  },
  {
    level: 3,
    title: 'Level 3：顔面神経・鼓索神経',
    goal: 'プロテーゼ設置経路と危険構造の立体的位置関係を学ぶ',
    vis: { bone: 'ghost', eac: 'hidden', tympanic: 'ghost', auricle: 'hidden',
           malleus: 'ghost', incus: 'hidden', stapes: 'ghost',
           facialNerve: 'solid', chordaTympani: 'solid', innerEar: 'hidden', roundWindow: 'hidden' } as VisibilityMap,
    quiz: {
      question: '顔面神経水平部（鼓室部）はアブミ骨に対してどの方向に走行するか？',
      options: ['アブミ骨の前方', 'アブミ骨の直上（上方）', 'アブミ骨の内側（蝸牛側）'],
      correct: 1,
      explanation: '顔面神経水平部はアブミ骨の直上を走行します。TORPやアブミ骨手術では顔面神経との距離確認が最重要ステップです。顔面神経骨管が薄い症例では特に注意が必要です。',
    },
  },
  {
    level: 4,
    title: 'Level 4：内耳・卵円窓・正円窓',
    goal: 'アブミ骨底板から内耳への振動伝達経路と正円窓の役割を理解する',
    vis: { bone: 'ghost', eac: 'hidden', tympanic: 'ghost', auricle: 'hidden',
           malleus: 'hidden', incus: 'hidden', stapes: 'ghost',
           facialNerve: 'ghost', chordaTympani: 'hidden', innerEar: 'solid', roundWindow: 'solid' } as VisibilityMap,
    quiz: {
      question: 'TORPフット部が卵円窓中央から偏心して設置された場合の主なリスクは？',
      options: ['鼓膜穿孔', '術後めまい・内耳障害（外リンパ瘻）', 'プロテーゼの腐食'],
      correct: 1,
      explanation: 'TORPフット部の偏心は卵円窓縁への機械的刺激を引き起こし、外リンパ瘻や感音難聴のリスクとなります。フット部は底板の中央に設置することが鉄則です。',
    },
  },
] as const;

type CourseLevel = 0 | 1 | 2 | 3 | 4;

// ── ビューモード定義 ──────────────────────────────────────────────
const VIEW_MODES: { mode: ViewMode; icon: string; label: string; desc: string }[] = [
  { mode: 'normal',     icon: '👁',  label: '通常',   desc: '標準3Dビュー' },
  { mode: 'microscope', icon: '🔬', label: '顕微鏡', desc: '手術用顕微鏡視野（狭FOV・ビネット）' },
  { mode: 'endoscope',  icon: '🔭', label: '内視鏡', desc: '硬性内視鏡視野（広角・円形）' },
];

// ══════════════════════════════════════════════════════════════════
export function LearningMode() {
  const { learningTab, setLearningTab, highlightedStructure, setHighlightedStructure } = useSimStore();
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  // 3D表示モード
  const [vis, setVis] = useState<VisibilityMap>({ bone: 'ghost', eac: 'solid' });
  const cycleMode = (key: StructureKey) => {
    const curr = vis[key] ?? DEFAULT_MODES[key];
    const next = CYCLE[(CYCLE.indexOf(curr) + 1) % CYCLE.length];
    setVis(v => ({ ...v, [key]: next }));
  };

  // ── 解剖学習コース状態 ──────────────────────────────────────────
  const [courseLevel, setCourseLevel] = useState<CourseLevel>(0);
  const [courseQuizSelected, setCourseQuizSelected] = useState<number | null>(null);
  const [courseQuizSubmitted, setCourseQuizSubmitted] = useState(false);

  const activateCourse = (level: CourseLevel) => {
    if (level === 0) {
      setCourseLevel(0);
      setCourseQuizSelected(null);
      setCourseQuizSubmitted(false);
      return;
    }
    const course = ANATOMY_COURSES[level - 1];
    setCourseLevel(level);
    setCourseQuizSelected(null);
    setCourseQuizSubmitted(false);
    setVis({ ...course.vis });
  };
  const getMode = (key: StructureKey): OpacityMode => vis[key] ?? DEFAULT_MODES[key];

  // 耳小骨3骨の一括切替（代表値 = ツチ骨のモードを基準に次状態へ）
  const ossicleGroupMode = (): OpacityMode => getMode('malleus');
  const cycleOssicles = () => {
    const curr = ossicleGroupMode();
    const next = CYCLE[(CYCLE.indexOf(curr) + 1) % CYCLE.length];
    setVis(v => ({ ...v, malleus: next, incus: next, stapes: next }));
  };

  // 外殻グループ（側頭骨 + 外耳道 + 耳介）
  const shellGroupMode = (): OpacityMode => getMode('bone');
  const cycleShell = () => {
    const curr = shellGroupMode();
    const next = CYCLE[(CYCLE.indexOf(curr) + 1) % CYCLE.length];
    setVis(v => ({ ...v, bone: next, eac: next }));
  };

  // 神経グループ（顔面神経 + 鼓索神経）
  const nerveGroupMode = (): OpacityMode => getMode('facialNerve');
  const cycleNerves = () => {
    const curr = nerveGroupMode();
    const next = CYCLE[(CYCLE.indexOf(curr) + 1) % CYCLE.length];
    setVis(v => ({ ...v, facialNerve: next, chordaTympani: next }));
  };

  // 内耳グループ（内耳 + 正円窓）
  const innerEarGroupMode = (): OpacityMode => getMode('innerEar');
  const cycleInnerEar = () => {
    const curr = innerEarGroupMode();
    const next = CYCLE[(CYCLE.indexOf(curr) + 1) % CYCLE.length];
    setVis(v => ({ ...v, innerEar: next, roundWindow: next }));
  };

  // ズームレベル
  const [zoomLevel, setZoomLevel] = useState(0);
  const [boneGhostOpacity, setBoneGhostOpacity] = useState(0.25);

  // 削開タブ状態
  const [drillScenario, setDrillScenario] = useState<'s1' | 's2' | 's3' | 's4' | 's5'>('s1');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  // S1 側頭骨表示モード
  const [drillBoneVis, setDrillBoneVis] = useState<OpacityMode>('solid');

  // ── S3 アニメーション状態 ─────────────────────────────────────
  const [s3StepIndex, setS3StepIndex] = useState(0);
  const [s3IsPlaying, setS3IsPlaying] = useState(false);

  const handleS3Next = useCallback(() => {
    setS3StepIndex(i => Math.min(i + 1, DRILL_STEPS.length - 1));
  }, []);
  const handleS3Prev = useCallback(() => {
    setS3StepIndex(i => Math.max(i - 1, 0));
  }, []);
  const handleS3StepComplete = useCallback(() => {
    setS3StepIndex(i => {
      if (i < DRILL_STEPS.length - 1) return i + 1;
      setS3IsPlaying(false);
      return i;
    });
  }, []);

  // オートプレイ: 1ステップ5秒で自動進行
  useEffect(() => {
    if (!s3IsPlaying) return;
    const timer = setTimeout(() => {
      setS3StepIndex(i => {
        if (i < DRILL_STEPS.length - 1) return i + 1;
        setS3IsPlaying(false);
        return i;
      });
    }, 5000);
    return () => clearTimeout(timer);
  }, [s3IsPlaying, s3StepIndex]);


  // ── ビューモード（解剖タブ用）───────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('normal');
  const [endoscopeAlerts, setEndoscopeAlerts] = useState<EndoscopeAlert[]>([]);
  const handleEndoscopeAlert = useCallback((alerts: EndoscopeAlert[]) => {
    setEndoscopeAlerts(alerts);
  }, []);

  // 内視鏡モード終了時にアラートをクリア
  useEffect(() => {
    if (viewMode !== 'endoscope') setEndoscopeAlerts([]);
  }, [viewMode]);

  // タブ変更時にビューモードをリセット
  useEffect(() => {
    if (learningTab !== 'anatomy') setViewMode('normal');
  }, [learningTab]);

  const selProd = kurzProducts.find((p) => p.id === selectedProduct);
  const showTympanoCavity = highlightedStructure === 'tympanoCavity';
  const visForScene: VisibilityMap = { ...vis };

  const TAB_LIST = [
    { key: 'anatomy',   label: '🦴 解剖' },
    { key: 'products',  label: '🔩 製品' },
    { key: 'procedure', label: '📋 術式' },
    { key: 'drilling',  label: '🔴 削開' },
  ] as const;

  // ── CSS オーバーレイ（顕微鏡/内視鏡効果）──────────────────────
  const vignetteStyle: CSSProperties | null =
    viewMode === 'microscope' ? {
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
      background: 'radial-gradient(circle at center, transparent 26%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.92) 68%, black 82%)',
    } :
    viewMode === 'endoscope' ? {
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
      background: 'radial-gradient(circle at center, rgba(0,0,0,0.0) 36%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.88) 62%, black 72%)',
    } : null;

  // 内視鏡ビュー: 円形クリップは3Dコンテンツ専用divに適用（UIボタンへの影響を防ぐ）
  const canvasWrapperStyle: CSSProperties = { position: 'relative' };
  const endoscopeClipStyle: CSSProperties = viewMode === 'endoscope' ? {
    position: 'absolute', inset: 0,
    clipPath: 'circle(43% at center)',
    background: 'black',
  } : { position: 'absolute', inset: 0 };

  // 内視鏡貫通防止（φ2.7mm相当）
  // 内視鏡 minDistance: 鼓膜・骨の表示状態に応じて動的に変更
  // 鼓膜 solid: 膜の手前で停止 / 鼓膜 hidden: 鼓室に進入可能
  const endoscopeMinDist = (() => {
    if (viewMode !== 'endoscope') return 4;
    const bone = getMode('bone');
    const tymp = getMode('tympanic');
    if (bone === 'solid' && tymp === 'solid') return 6;  // 外側から観察
    if (bone === 'solid' && tymp !== 'hidden') return 3; // 骨あり・膜半透明
    if (bone === 'solid') return 2;                       // 鼓膜消去→鼓室進入可
    if (tymp === 'solid') return 3;                       // 骨透明・膜あり
    if (tymp !== 'hidden') return 2;                      // 膜半透明
    return 1;                                             // 全て非表示・自由視点
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 60px)' }}>
      {/* Tabs + Patient selector */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="tabs">
          {TAB_LIST.map(({ key, label }) => (
            <button
              key={key}
              className={`tab ${learningTab === key ? 'active' : ''}`}
              onClick={() => {
                setLearningTab(key);
                if (key !== 'drilling') setSelectedZoneId(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>

      </div>

      <div className="layout-split" style={{ flex: 1 }}>
        {/* 3D Canvas */}
        <div className="canvas-wrapper" style={canvasWrapperStyle}>
          {/* 3Dコンテンツ + 視覚エフェクト（内視鏡時はここだけclipPath適用） */}
          <div style={endoscopeClipStyle}>
            {learningTab === 'drilling' ? (
              <DrillTrainingScene
                scenario={drillScenario}
                selectedZoneId={selectedZoneId}
                onZoneSelect={setSelectedZoneId}
                s3StepIndex={s3StepIndex}
                s3IsPlaying={s3IsPlaying}
                onS3StepComplete={handleS3StepComplete}
                boneVis={drillBoneVis}
                boneGhostOpacity={boneGhostOpacity}
              />
            ) : (
              <AnatomyScene
                vis={visForScene}
                zoomLevel={zoomLevel}
                showTympanoCavity={showTympanoCavity}
                viewMode={viewMode}
                highlightedKey={highlightedStructure}
                boneGhostOpacity={boneGhostOpacity}
                minDistance={endoscopeMinDist}
                onEndoscopeAlert={handleEndoscopeAlert}
                onStructureClick={cycleMode}
              />
            )}

            {/* CSS ビネット/内視鏡オーバーレイ */}
            {vignetteStyle && <div style={vignetteStyle} />}

            {/* 内視鏡: 青みフィルター */}
            {viewMode === 'endoscope' && (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9,
                background: 'rgba(10, 25, 60, 0.08)',
              }} />
            )}
          </div>

          {/* ── 硬性内視鏡 近接アラート ── */}
          {viewMode === 'endoscope' && endoscopeAlerts.length > 0 && (
            <div style={{
              position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)',
              zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              pointerEvents: 'none',
            }}>
              {/* 重大度が最も高いものを先に表示 */}
              {[...endoscopeAlerts]
                .sort((a, b) => (a.severity === 'danger' ? -1 : 1))
                .map(alert => (
                  <div key={alert.id} style={{
                    padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    backdropFilter: 'blur(8px)',
                    background: alert.severity === 'danger'
                      ? 'rgba(248,65,65,0.88)'
                      : 'rgba(255,180,0,0.88)',
                    color: alert.severity === 'danger' ? '#fff' : '#1a0a00',
                    border: `1px solid ${alert.severity === 'danger' ? '#ff6060' : '#ffcc00'}`,
                    boxShadow: alert.severity === 'danger'
                      ? '0 0 12px rgba(255,60,60,0.7)'
                      : '0 0 10px rgba(255,180,0,0.5)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span>{alert.severity === 'danger' ? '⚠️ 危険' : '⚡ 注意'}</span>
                    <span>{alert.nameJa} に接触</span>
                  </div>
                ))
              }
            </div>
          )}

          {/* ── ビューモードトグル（UIボタンはclipPath外 → 常時クリック可能）── */}
          {learningTab === 'anatomy' && (
            <div style={{
              position: 'absolute', top: 12, right: 16, zIndex: 15,
              display: 'flex', gap: 5,
            }}>
              {VIEW_MODES.map(({ mode, icon, label, desc }) => (
                <button
                  key={mode}
                  title={desc}
                  onClick={() => setViewMode(mode)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 7,
                    border: `1px solid ${viewMode === mode ? 'var(--accent)' : 'rgba(255,255,255,0.18)'}`,
                    background: viewMode === mode ? 'rgba(0,180,216,0.22)' : 'rgba(10,15,26,0.78)',
                    color: viewMode === mode ? 'var(--accent)' : '#7a8898',
                    fontSize: 11, fontWeight: viewMode === mode ? 700 : 400,
                    cursor: 'pointer', backdropFilter: 'blur(6px)',
                    transition: 'all .15s',
                  }}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          )}


          {/* 操作ヒント */}
          <div className="canvas-overlay top-left">
            <div style={{ background: 'rgba(0,0,0,.6)', padding: '6px 10px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>
              {learningTab === 'drilling' && drillScenario === 's2'
                ? '球をクリック: 危険部位を選択 ｜ ドラッグ: 回転'
                : learningTab === 'drilling' && drillScenario === 's3'
                ? '▶ 再生で自動進行 ｜ ドラッグ: 自由回転'
                : learningTab === 'drilling' && drillScenario === 's4'
                ? '限界壁確認モード ｜ 骨 solid + 危険部位グロー表示 ｜ ドラッグ: 回転'
                : learningTab === 'drilling' && drillScenario === 's5'
                ? '削開完了後ビュー ｜ 骨 ghost で内部露出 ｜ ドラッグ: 回転'
                : 'ドラッグ: 回転 ｜ ホイール: ズーム'}
            </div>
          </div>

          {/* ビューモードラベル */}
          {learningTab === 'anatomy' && viewMode !== 'normal' && (
            <div className="canvas-overlay bottom-left">
              <div style={{
                background: 'rgba(0,180,216,.12)', border: '1px solid var(--accent)',
                padding: '5px 10px', borderRadius: 6, color: 'var(--accent)',
                backdropFilter: 'blur(4px)', fontSize: 12,
              }}>
                {viewMode === 'microscope' ? '🔬 手術顕微鏡ビュー' : '🔭 硬性内視鏡ビュー'}
              </div>
            </div>
          )}

          {/* 危険部位選択インジケーター（S2） */}
          {learningTab === 'drilling' && drillScenario === 's2' && selectedZoneId && (() => {
            const zone = DANGER_ZONES.find(z => z.id === selectedZoneId);
            if (!zone) return null;
            return (
              <div className="canvas-overlay bottom-left">
                <div style={{
                  background: 'rgba(10,10,20,.82)',
                  border: `1px solid ${zone.color}`,
                  padding: '8px 12px', borderRadius: 8,
                  backdropFilter: 'blur(4px)',
                }}>
                  <span style={{ color: zone.color, fontWeight: 700, fontSize: 13 }}>
                    ⚠ {zone.nameJa}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* S3: ステッパー表示 */}
          {learningTab === 'drilling' && drillScenario === 's3' && (
            <div style={{
              position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
              zIndex: 15, display: 'flex', gap: 6,
            }}>
              {DRILL_STEPS.map((_, i) => (
                <div
                  key={i}
                  onClick={() => { setS3StepIndex(i); setS3IsPlaying(false); }}
                  style={{
                    width: i === s3StepIndex ? 28 : 8,
                    height: 8, borderRadius: 4,
                    background: i === s3StepIndex
                      ? 'var(--accent)'
                      : i < s3StepIndex ? 'rgba(0,180,216,0.5)' : 'rgba(255,255,255,0.18)',
                    cursor: 'pointer',
                    transition: 'all .3s',
                  }}
                />
              ))}
            </div>
          )}

          {/* 強調表示中の構造名 + 説明パネル（解剖タブ） */}
          {learningTab === 'anatomy' && highlightedStructure && (() => {
            const s = anatomyStructures.find(x => x.id === highlightedStructure);
            if (!s) return null;
            return (
              <div style={{
                position: 'absolute', bottom: 60, left: 12, zIndex: 15,
                maxWidth: 280,
                background: 'rgba(6,10,26,0.88)', backdropFilter: 'blur(8px)',
                border: `1px solid ${s.color}66`,
                borderRadius: 10, padding: '10px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0, boxShadow: `0 0 6px ${s.color}` }} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: s.color }}>{s.label}</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{s.desc}</p>
              </div>
            );
          })()}

          {/* ズームボタン（削開タブ以外）*/}
          {learningTab !== 'drilling' && (
            <div style={{
              position: 'absolute', bottom: 16, right: 16,
              display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10,
            }}>
              {[
                { label: '＋', delta: 1, title: 'ズームイン' },
                { label: '－', delta: -1, title: 'ズームアウト' },
              ].map(({ label, delta, title }) => (
                <button
                  key={label}
                  title={title}
                  onClick={() => setZoomLevel(z => z + delta)}
                  style={{
                    width: 34, height: 34, borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(10,15,26,0.80)', color: '#c0d8e8',
                    fontSize: 18, cursor: 'pointer', backdropFilter: 'blur(6px)',
                    lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, transition: 'background .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,180,216,0.22)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(10,15,26,0.80)')}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* 側頭骨不透明度スライダー（骨が ghost の場合）*/}
          {getMode('bone') === 'ghost' && (
            <div style={{ position: 'absolute', bottom: 96, right: 8, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', writingMode: 'vertical-rl' }}>骨透明度</span>
              <input type="range" min={0} max={1} step={0.02} value={boneGhostOpacity}
                onChange={e => setBoneGhostOpacity(Number(e.target.value))}
                style={{ appearance: 'slider-vertical', writingMode: 'vertical-lr', height: 80, width: 20, cursor: 'pointer', accentColor: '#00b4d8' } as React.CSSProperties} />
              <span style={{ fontSize: 9, color: '#c0d8e8' }}>{Math.round(boneGhostOpacity * 100)}%</span>
            </div>
          )}
        </div>

        {/* ═══ Sidebar ═══ */}
        <div className="sidebar">
          {/* ── 解剖タブ ── */}
          {learningTab === 'anatomy' && (
            <>
              {/* ビューモード説明 */}
              {viewMode !== 'normal' && (
                <div className="card" style={{ padding: '10px 14px', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 12, marginBottom: 5 }}>
                    {viewMode === 'microscope' ? '🔬 手術顕微鏡ビュー' : '🔭 硬性内視鏡ビュー'}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                    {viewMode === 'microscope'
                      ? 'FOV 11° の狭い視野で術野を拡大表示。実際の手術顕微鏡（例: Zeiss Pentero）と同等の視野角。外周ビネットが特徴的な顕微鏡視野を再現。'
                      : 'FOV 112° の広角レンズ効果。Hopkins 式硬性内視鏡（0° または 30°）の視野を模擬。円形視野と周辺の暗部が内視鏡視野の特徴。'}
                  </p>
                </div>
              )}

              {/* ── 解剖学習コース ── */}
              <div className="card">
                <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📚 解剖学習コース</span>
                  {courseLevel > 0 && (
                    <button
                      onClick={() => activateCourse(0)}
                      style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      自由探索に戻る
                    </button>
                  )}
                </div>

                {/* レベル選択ボタン */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: courseLevel > 0 ? 12 : 0 }}>
                  {ANATOMY_COURSES.map((c) => {
                    const isActive = courseLevel === c.level;
                    return (
                      <button
                        key={c.level}
                        onClick={() => activateCourse(isActive ? 0 : c.level as CourseLevel)}
                        style={{
                          padding: '8px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                          border: `1px solid ${isActive ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
                          background: isActive ? 'rgba(0,180,216,0.12)' : 'rgba(255,255,255,0.03)',
                          color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                          fontSize: 12, fontWeight: isActive ? 700 : 400,
                          transition: 'all .15s',
                        }}
                      >
                        <div>{c.title}</div>
                        {isActive && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>🎯 {c.goal}</div>}
                      </button>
                    );
                  })}
                </div>

                {/* アクティブコースのクイズ */}
                {courseLevel > 0 && (() => {
                  const course = ANATOMY_COURSES[courseLevel - 1];
                  const quiz = course.quiz;
                  const isCorrect = courseQuizSelected === quiz.correct;
                  return (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
                      <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginBottom: 8 }}>
                        🧠 確認クイズ
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 10, lineHeight: 1.5 }}>
                        {quiz.question}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {quiz.options.map((opt, i) => {
                          const isSelected = courseQuizSelected === i;
                          const showResult = courseQuizSubmitted;
                          const isCorrectOpt = i === quiz.correct;
                          let bg = 'rgba(255,255,255,0.04)';
                          let border = 'rgba(255,255,255,0.12)';
                          let color = 'var(--text-secondary)';
                          if (showResult && isCorrectOpt) { bg = 'rgba(74,222,128,0.12)'; border = '#4ade80'; color = '#4ade80'; }
                          else if (showResult && isSelected && !isCorrectOpt) { bg = 'rgba(255,100,100,0.1)'; border = '#ff8080'; color = '#ff8080'; }
                          else if (!showResult && isSelected) { bg = 'rgba(0,180,216,0.15)'; border = 'var(--accent)'; color = 'var(--accent)'; }
                          return (
                            <div
                              key={i}
                              onClick={() => !courseQuizSubmitted && setCourseQuizSelected(i)}
                              style={{ padding: '8px 12px', borderRadius: 6, cursor: courseQuizSubmitted ? 'default' : 'pointer',
                                border: `1px solid ${border}`, background: bg, color, fontSize: 12, transition: 'all .15s' }}
                            >
                              {opt}
                            </div>
                          );
                        })}
                      </div>
                      {!courseQuizSubmitted ? (
                        <button
                          className="btn btn-primary"
                          disabled={courseQuizSelected === null}
                          style={{ width: '100%', marginTop: 10, opacity: courseQuizSelected !== null ? 1 : 0.4 }}
                          onClick={() => setCourseQuizSubmitted(true)}
                        >
                          回答する
                        </button>
                      ) : (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: isCorrect ? '#4ade80' : '#ff8080', marginBottom: 6 }}>
                            {isCorrect ? '✅ 正解！' : '❌ 不正解'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 6 }}>
                            {quiz.explanation}
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            <button
                              style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}
                              onClick={() => { setCourseQuizSelected(null); setCourseQuizSubmitted(false); }}
                            >
                              もう一度
                            </button>
                            {courseLevel < 4 && (
                              <button
                                className="btn btn-primary"
                                style={{ flex: 1, fontSize: 11 }}
                                onClick={() => activateCourse((courseLevel + 1) as CourseLevel)}
                              >
                                次のレベルへ →
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="card">
                <div className="section-title">構造を選択してハイライト</div>
                {anatomyStructures.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setHighlightedStructure(highlightedStructure === s.id ? null : s.id)}
                    style={{
                      padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 6,
                      background: highlightedStructure === s.id ? 'rgba(0,180,216,.15)' : 'rgba(255,255,255,.03)',
                      border: `1px solid ${highlightedStructure === s.id ? 'var(--accent)' : 'var(--border)'}`,
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{s.label}</span>
                    </div>
                    {highlightedStructure === s.id && (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 6 }}>{s.desc}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="section-title">3D 表示切替</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                  クリックまたは3Dダブルクリックで 実体 → 半透明 → 非表示 を切替
                </div>

                {/* ── グループ一括切替 ── */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.06em', marginBottom: 5 }}>
                    グループ一括切替
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {[
                      { label: '🦴 外殻', mode: shellGroupMode(), onClick: cycleShell, color: '#f2ead8' },
                      { label: '🔗 耳小骨', mode: ossicleGroupMode(), onClick: cycleOssicles, color: '#e6a93a' },
                      { label: '⚡ 神経', mode: nerveGroupMode(), onClick: cycleNerves, color: '#f5d820' },
                      { label: '🐚 内耳', mode: innerEarGroupMode(), onClick: cycleInnerEar, color: '#60b8e0' },
                    ].map(({ label, mode, onClick, color }) => (
                      <button
                        key={label}
                        onClick={onClick}
                        style={{
                          flex: '1 1 80px',
                          padding: '5px 6px',
                          borderRadius: 6,
                          border: `1px solid ${mode === 'solid' ? color : mode === 'ghost' ? color + '66' : 'var(--border)'}`,
                          background: mode === 'solid' ? color + '22' : mode === 'ghost' ? color + '11' : 'rgba(255,255,255,0.03)',
                          color: mode === 'hidden' ? 'var(--text-muted)' : color,
                          fontSize: 10, fontWeight: 600, cursor: 'pointer',
                          textAlign: 'center', transition: 'all .15s',
                        }}
                      >
                        <div>{label}</div>
                        <div style={{ fontSize: 9, opacity: 0.7, marginTop: 1 }}>{MODE_LABEL[mode]}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', marginBottom: 8 }} />

                {VIS_ITEMS.map(({ key, label, color, indent }) => {
                  const mode = getMode(key);
                  return (
                    <div key={key}>
                      {key === 'malleus' && (
                        <div style={{ padding: '7px 2px 3px', marginTop: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#e0a93a', letterSpacing: '.04em', opacity: 0.7 }}>
                            耳小骨連鎖 (Ossicular Chain)
                          </span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 2px', paddingLeft: indent ? 14 : 2, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, opacity: mode === 'hidden' ? 0.2 : mode === 'ghost' ? 0.5 : 1, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: mode === 'hidden' ? 'var(--text-muted)' : 'var(--text-primary)' }}>{label}</span>
                        </div>
                        <button
                          onClick={() => cycleMode(key)}
                          style={{ padding: '3px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: MODE_BG[mode], color: MODE_FG[mode], minWidth: 52, transition: 'background .15s' }}
                        >
                          {MODE_LABEL[mode]}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="card">
                <div className="section-title">耳小骨連鎖の音響伝達</div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  鼓膜の振動 → ツチ骨 → キヌタ骨 → アブミ骨 → 卵円窓 → 蝸牛<br /><br />
                  KURZ人工耳小骨はこの連鎖を再建します。PORPはキヌタ骨欠損を、TORPは全耳小骨欠損を補填します。
                </p>
              </div>
            </>
          )}

          {/* ── 製品タブ ── */}
          {learningTab === 'products' && (
            <>
              {/* ── プロテーゼ選択ガイド ── */}
              <div className="card" style={{ padding: '14px' }}>
                <div className="section-title">プロテーゼ選択ガイド</div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                  術中所見から適切なプロテーゼを選択する臨床フロー
                </p>

                {/* Step 1: アブミ骨上部構造 */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>
                    ① アブミ骨上部構造の確認
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ flex: 1, padding: '8px 10px', borderRadius: 7, background: 'rgba(0,180,216,0.10)', border: '1px solid rgba(0,180,216,0.30)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#7dd8e8', marginBottom: 3 }}>温存あり ✓</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5 }}>頭部・前後弓が残存<br />可動性を必ず確認</div>
                      <div style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: '#60b8e0' }}>→ PORP 適応</div>
                    </div>
                    <div style={{ flex: 1, padding: '8px 10px', borderRadius: 7, background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', marginBottom: 3 }}>底板のみ ✗</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5 }}>上部構造欠損<br />底板可動性を確認</div>
                      <div style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: '#f87171' }}>→ TORP 適応</div>
                    </div>
                  </div>
                </div>

                {/* Step 2: ツチ骨柄の有無（PORP選択時） */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>
                    ② ツチ骨柄の残存確認（PORP選択時）
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ flex: 1, padding: '8px 10px', borderRadius: 7, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', marginBottom: 3 }}>柄あり</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5 }}>II型変法<br />柄下にPORPを設置</div>
                    </div>
                    <div style={{ flex: 1, padding: '8px 10px', borderRadius: 7, background: 'rgba(255,209,102,0.08)', border: '1px solid rgba(255,209,102,0.25)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#ffd166', marginBottom: 3 }}>柄なし</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5 }}>III型<br />鼓膜直下にPORP</div>
                    </div>
                  </div>
                </div>

                {/* Step 3: フット選択 */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>
                    ③ フット形状の選択
                  </div>
                  {[
                    { type: 'BELL', label: 'ベル型', color: '#60b8e0', desc: '標準PORP。アブミ骨頭部を包む形状。軟骨片を頭板下に追加。' },
                    { type: 'CLIP', label: 'クリップ型', color: '#a78bfa', desc: 'アブミ骨頭部にクリッピング固定。軟骨不要。Dresden型。' },
                    { type: 'FLAT', label: 'フラット型', color: '#f87171', desc: 'TORP専用。底板中央に設置。偏心厳禁。' },
                  ].map(({ type, label, color, desc }) => (
                    <div key={type} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6, padding: '6px 8px', borderRadius: 6, background: `${color}10` }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color, minWidth: 50, marginTop: 1 }}>{type}</span>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 1 }}>{label}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card" style={{ padding: '12px' }}>
                <div className="section-title">製品を選択</div>
                {kurzProducts.map((p) => (
                  <div
                    key={p.id}
                    className={`selectable-card ${selectedProduct === p.id ? 'selected' : ''}`}
                    style={{ marginBottom: 8 }}
                    onClick={() => setSelectedProduct(selectedProduct === p.id ? null : p.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</span>
                      <span className={`badge badge-${p.type === 'PORP' ? 'blue' : p.type === 'TORP' ? 'green' : 'yellow'}`}>
                        {p.type}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>フット: {p.footType} ｜ 頭板: {p.headPlateDiameter}mm</div>
                  </div>
                ))}
              </div>

              {selProd && (
                <div className="card">
                  <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--accent)' }}>{selProd.name}</div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>{selProd.description}</p>
                  <div className="section-title">仕様</div>
                  {[
                    ['シャフト長', selProd.shaftLengths.map((l) => `${l}`).join(', ') + ' mm'],
                    ['頭板径', `${selProd.headPlateDiameter} mm`],
                    ['フット径', `${selProd.footDiameter} mm`],
                    ['重量', `${selProd.weight} mg`],
                    ['MRI安全', selProd.mriSafe],
                    ['フット型', selProd.footType],
                  ].map(([k, v]) => (
                    <div key={k} className="info-row">
                      <span className="label">{k}</span>
                      <span className="value" style={{ fontSize: 12 }}>{v}</span>
                    </div>
                  ))}
                  <div className="section-title" style={{ marginTop: 12 }}>適応</div>
                  <div className="tag-list">
                    {selProd.indications.map((ind) => <span key={ind} className="tag">{ind}</span>)}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── 術式タブ ── */}
          {learningTab === 'procedure' && (
            <>
              {procedures.map((proc) => (
                <div key={proc.title} className="card">
                  <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>{proc.title}</div>
                  <ol style={{ paddingLeft: 18 }}>
                    {proc.steps.map((step, i) => (
                      <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 6 }}>{step}</li>
                    ))}
                  </ol>
                </div>
              ))}
              <div className="card">
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>⚠️ 重要な注意点</div>
                <ul style={{ paddingLeft: 16, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.8 }}>
                  <li>シャフト長の過不足は術後成績に直結</li>
                  <li>軟骨片の挿入で鼓膜穿孔・押出しを防止</li>
                  <li>チタン製は電気メスを直接当てない</li>
                  <li>MRI対応だが術前に金属確認票を記載</li>
                </ul>
              </div>
            </>
          )}

          {/* ── 削開タブ ── */}
          {learningTab === 'drilling' && (
            <>
              {/* シナリオセレクター */}
              <div className="card">
                <div className="section-title">シナリオ選択</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                  {([
                    { key: 's1', label: 'S1: 解剖探索',   desc: '自由に観察' },
                    { key: 's2', label: 'S2: 危険部位',   desc: 'クリックで確認' },
                    { key: 's3', label: 'S3: 削開動画',   desc: '5ステップ手術' },
                    { key: 's4', label: 'S4: 削開範囲',   desc: '推奨限界壁' },
                    { key: 's5', label: 'S5: 削開完了後', desc: '確認ビュー' },
                  ] as const).map(({ key, label, desc }) => (
                    <button
                      key={key}
                      onClick={() => {
                        setDrillScenario(key);
                        setSelectedZoneId(null);
                        if (key === 's3') { setS3StepIndex(0); setS3IsPlaying(false); }
                      }}
                      style={{
                        flex: '1 1 80px', padding: '10px 8px', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${drillScenario === key ? 'var(--accent)' : 'var(--border)'}`,
                        background: drillScenario === key ? 'rgba(0,180,216,.15)' : 'rgba(255,255,255,.03)',
                        color: drillScenario === key ? 'var(--accent)' : 'var(--text-secondary)',
                        fontSize: 11, textAlign: 'center', transition: 'all .15s',
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 10, opacity: 0.75 }}>{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 側頭骨 表示切替（全シナリオ共通）── */}
              <div className="card" style={{ padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>側頭骨 表示</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['solid', 'ghost', 'hidden'] as OpacityMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setDrillBoneVis(mode)}
                      style={{
                        flex: 1, padding: '6px 0', borderRadius: 6, cursor: 'pointer', fontSize: 11,
                        border: `1px solid ${drillBoneVis === mode ? 'var(--accent)' : 'var(--border)'}`,
                        background: drillBoneVis === mode ? MODE_BG[mode] : 'rgba(255,255,255,.03)',
                        color: drillBoneVis === mode ? (mode === 'solid' ? '#001a20' : 'var(--accent)') : 'var(--text-secondary)',
                        transition: 'all .15s',
                      }}
                    >
                      {MODE_LABEL[mode]}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── S1 ── */}
              {drillScenario === 's1' && (
                <div className="card">
                  <div className="section-title">S1 — 解剖探索</div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
                    側頭骨と中耳構造を自由に観察してください。ドラッグで回転、ホイールでズームができます。
                  </p>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>学習チェックポイント</div>
                    {[
                      '顔面神経の走行（水平部・膝部・乳突部）',
                      '卵円窓と正円窓の位置関係',
                      'S状静脈洞の後乳突部での走行',
                      '蝸牛と半規管の3D的位置関係',
                    ].map((item, i) => (
                      <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', lineHeight: 1.5 }}>
                        ✓ {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── S2 ── */}
              {drillScenario === 's2' && (
                <>
                  <div className="card" style={{ padding: '10px 14px' }}>
                    <div className="section-title">危険部位警告システム</div>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
                      {[['#f5d820', '顔面神経系'], ['#4477ff', '血管系']].map(([color, label]) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                          <div style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
                          {label}
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>● 核（小）: 危険域 2mm以内　◯ 外周（大）: 警告域 5mm以内</div>
                  </div>

                  {/* 顔面神経系 */}
                  <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f5d820' }} />
                      <div className="section-title" style={{ margin: 0 }}>顔面神経系</div>
                    </div>
                    {FACIAL_ZONES.map((zone) => (
                      <div
                        key={zone.id}
                        onClick={() => setSelectedZoneId(selectedZoneId === zone.id ? null : zone.id)}
                        style={{
                          padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 6,
                          background: selectedZoneId === zone.id ? 'rgba(245,216,32,.10)' : 'rgba(255,255,255,.03)',
                          border: `1px solid ${selectedZoneId === zone.id ? '#f5d820' : 'var(--border)'}`,
                          transition: 'all .15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: selectedZoneId === zone.id ? 6 : 0 }}>
                          <span style={{ fontSize: 14 }}>⚡</span>
                          <span style={{ fontWeight: 600, fontSize: 13, color: selectedZoneId === zone.id ? '#f5d820' : 'var(--text-primary)' }}>
                            {zone.nameJa}
                          </span>
                        </div>
                        {selectedZoneId === zone.id && (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                            <p style={{ marginBottom: 6 }}>{zone.shortDescJa}</p>
                            <div style={{ background: 'rgba(245,216,32,.06)', border: '1px solid rgba(245,216,32,.20)', borderRadius: 6, padding: '6px 8px', marginBottom: 5 }}>
                              <div style={{ fontSize: 11, color: '#c8b010', fontWeight: 600, marginBottom: 3 }}>臨床メモ</div>
                              <div style={{ fontSize: 11 }}>{zone.clinicalNoteJa}</div>
                            </div>
                            <div style={{ background: 'rgba(220,50,50,.08)', border: '1px solid rgba(220,50,50,.25)', borderRadius: 6, padding: '5px 8px' }}>
                              <div style={{ fontSize: 11, color: '#dd6060', fontWeight: 600, marginBottom: 2 }}>合併症リスク</div>
                              <div style={{ fontSize: 11, color: '#dd8080' }}>{zone.complicationJa}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* 血管系 */}
                  <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4477ff' }} />
                      <div className="section-title" style={{ margin: 0 }}>血管系</div>
                    </div>
                    {VASCULAR_ZONES.map((zone) => (
                      <div
                        key={zone.id}
                        onClick={() => setSelectedZoneId(selectedZoneId === zone.id ? null : zone.id)}
                        style={{
                          padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 6,
                          background: selectedZoneId === zone.id ? 'rgba(68,119,255,.10)' : 'rgba(255,255,255,.03)',
                          border: `1px solid ${selectedZoneId === zone.id ? '#4477ff' : 'var(--border)'}`,
                          transition: 'all .15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: selectedZoneId === zone.id ? 6 : 0 }}>
                          <span style={{ fontSize: 14 }}>💧</span>
                          <span style={{ fontWeight: 600, fontSize: 13, color: selectedZoneId === zone.id ? '#6699ff' : 'var(--text-primary)' }}>
                            {zone.nameJa}
                          </span>
                        </div>
                        {selectedZoneId === zone.id && (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                            <p style={{ marginBottom: 6 }}>{zone.shortDescJa}</p>
                            <div style={{ background: 'rgba(68,119,255,.06)', border: '1px solid rgba(68,119,255,.20)', borderRadius: 6, padding: '6px 8px', marginBottom: 5 }}>
                              <div style={{ fontSize: 11, color: '#7799dd', fontWeight: 600, marginBottom: 3 }}>臨床メモ</div>
                              <div style={{ fontSize: 11 }}>{zone.clinicalNoteJa}</div>
                            </div>
                            <div style={{ background: 'rgba(220,50,50,.08)', border: '1px solid rgba(220,50,50,.25)', borderRadius: 6, padding: '5px 8px' }}>
                              <div style={{ fontSize: 11, color: '#dd6060', fontWeight: 600, marginBottom: 2 }}>合併症リスク</div>
                              <div style={{ fontSize: 11, color: '#dd8080' }}>{zone.complicationJa}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── S3 ── */}
              {drillScenario === 's3' && (
                <>
                  {/* 現在のステップ */}
                  <div className="card" style={{ padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        ステップ {s3StepIndex + 1} / {DRILL_STEPS.length}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {DRILL_STEPS.map((_, i) => (
                          <div
                            key={i}
                            onClick={() => { setS3StepIndex(i); setS3IsPlaying(false); }}
                            style={{
                              width: i === s3StepIndex ? 18 : 7, height: 7, borderRadius: 4,
                              background: i === s3StepIndex ? 'var(--accent)' : i < s3StepIndex ? 'rgba(0,180,216,0.45)' : 'rgba(255,255,255,0.15)',
                              cursor: 'pointer', transition: 'all .3s',
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)', marginBottom: 6 }}>
                      {DRILL_STEPS[s3StepIndex].title}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 10 }}>
                      {DRILL_STEPS[s3StepIndex].subtitle}
                    </p>

                    {/* 臨床メモ */}
                    <div style={{
                      background: 'rgba(0,180,216,0.07)', border: '1px solid rgba(0,180,216,0.20)',
                      borderRadius: 7, padding: '8px 10px', marginBottom: 12,
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 3 }}>💡 臨床メモ</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {DRILL_STEPS[s3StepIndex].clinicalNote}
                      </div>
                    </div>

                    {/* 再生コントロール */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        onClick={handleS3Prev}
                        disabled={s3StepIndex === 0}
                        style={{
                          width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)',
                          background: 'rgba(255,255,255,0.05)', color: s3StepIndex === 0 ? '#333' : '#aaa',
                          fontSize: 16, cursor: s3StepIndex === 0 ? 'default' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        ◀
                      </button>

                      <button
                        onClick={() => setS3IsPlaying(p => !p)}
                        style={{
                          flex: 1, height: 36, borderRadius: 8,
                          border: `1px solid ${s3IsPlaying ? '#f59020' : 'var(--accent)'}`,
                          background: s3IsPlaying ? 'rgba(245,144,32,0.15)' : 'rgba(0,180,216,0.15)',
                          color: s3IsPlaying ? '#f59020' : 'var(--accent)',
                          fontSize: 13, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        {s3IsPlaying ? '⏸ 一時停止' : '▶ 再生'}
                      </button>

                      <button
                        onClick={handleS3Next}
                        disabled={s3StepIndex === DRILL_STEPS.length - 1}
                        style={{
                          width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)',
                          background: 'rgba(255,255,255,0.05)', color: s3StepIndex === DRILL_STEPS.length - 1 ? '#333' : '#aaa',
                          fontSize: 16, cursor: s3StepIndex === DRILL_STEPS.length - 1 ? 'default' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        ▶
                      </button>
                    </div>

                    {s3IsPlaying && (
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                        5秒後に次のステップへ自動進行
                      </div>
                    )}
                  </div>

                  {/* 全ステップ一覧 */}
                  <div className="card">
                    <div className="section-title">全手術ステップ</div>
                    {DRILL_STEPS.map((step, i) => (
                      <div
                        key={step.id}
                        onClick={() => { setS3StepIndex(i); setS3IsPlaying(false); }}
                        style={{
                          padding: '8px 10px', borderRadius: 7, cursor: 'pointer', marginBottom: 5,
                          background: i === s3StepIndex ? 'rgba(0,180,216,.12)' : i < s3StepIndex ? 'rgba(0,180,216,.04)' : 'rgba(255,255,255,.02)',
                          border: `1px solid ${i === s3StepIndex ? 'var(--accent)' : 'var(--border)'}`,
                          transition: 'all .15s',
                          display: 'flex', alignItems: 'center', gap: 10,
                        }}
                      >
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                          background: i === s3StepIndex ? 'var(--accent)' : i < s3StepIndex ? 'rgba(0,180,216,0.4)' : 'rgba(255,255,255,0.08)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700, color: i <= s3StepIndex ? '#001a20' : '#555',
                        }}>
                          {i < s3StepIndex ? '✓' : i + 1}
                        </div>
                        <span style={{
                          fontSize: 12,
                          color: i === s3StepIndex ? 'var(--accent)' : i < s3StepIndex ? 'var(--text-secondary)' : 'var(--text-muted)',
                          fontWeight: i === s3StepIndex ? 700 : 400,
                        }}>
                          {step.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── S4: 推奨削開範囲 ── */}
              {drillScenario === 's4' && (
                <>
                  <div className="card">
                    <div className="section-title" style={{ color: '#ffd166' }}>🗺 Mastoidectomy 推奨削開範囲</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
                      側頭骨削開の限界壁（限界構造）を理解することが安全な乳突腔削開の基本です。
                      慈恵医大テキスト準拠の5限界壁を確認してください。
                    </div>

                    {[
                      {
                        label: '① Tegmen（天蓋）',
                        en: 'Middle fossa dura',
                        dir: '上方限界',
                        color: '#ff9060',
                        desc: '中頭蓋窩硬膜。この壁を越えると硬膜損傷・髄液漏のリスク。削開中に骨の色が黄白色に変わったら天蓋近傍のサイン。',
                        check: '骨面がやや黄色に変わったら削開を止める',
                      },
                      {
                        label: '② Sigmoid sinus（S状静脈洞）',
                        en: 'Sigmoid sinus',
                        dir: '後方限界',
                        color: '#4477ff',
                        desc: '後乳突部を走行する大静脈洞。損傷すると大量出血。骨面が青みがかった紺色のエッグシェルになったら直前のサイン。',
                        check: '青みがかった骨面（エッグシェル）を確認したら止める',
                      },
                      {
                        label: '③ Sinodural angle（乙状静脈洞—天蓋角）',
                        en: 'Sinodural angle',
                        dir: '後上方限界',
                        color: '#a060ff',
                        desc: 'Tegmenと Sigmoid sinusが交差する角。乳突腔削開の基準点であり、この角を明視野に確保することで方向感が得られる。',
                        check: 'Sino-dural angleを明視野に露出させる（Check List必須）',
                      },
                      {
                        label: '④ Digastric ridge（顎二腹筋稜）',
                        en: 'Digastric ridge',
                        dir: '下方限界',
                        color: '#4ade80',
                        desc: '乳突切痕内側の骨稜。顎二腹筋の付着部。この稜の深部に顔面神経乳突部が走行するため、稜を超えての削開は禁止。',
                        check: '顎二腹筋稜を超えて削開しない',
                      },
                      {
                        label: '⑤ Posterior canal wall（外耳道後壁）',
                        en: 'Posterior canal wall',
                        dir: '前方限界（保存）',
                        color: '#60b8e0',
                        desc: '外耳道後壁は基本的に保存する（canal wall up法）。壁を薄くしすぎると外耳道穿孔や鼓膜穿孔の原因になる。Canal wall down法では意図的に削除するが慎重な操作が必要。',
                        check: '外耳道後壁の厚みを意識して削開する',
                      },
                    ].map(({ label, en, dir, color, desc, check }) => (
                      <div key={label} style={{
                        padding: '10px 12px', marginBottom: 8, borderRadius: 8,
                        border: `1px solid ${color}44`,
                        background: `${color}08`,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: `${color}22`, color, border: `1px solid ${color}44` }}>{dir}</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 5 }}>{en}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 6 }}>{desc}</div>
                        <div style={{ fontSize: 11, padding: '4px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: 5, color: '#ffd166' }}>
                          ✓ {check}
                        </div>
                      </div>
                    ))}

                    <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 7, background: 'rgba(255,209,102,0.06)', border: '1px solid rgba(255,209,102,0.2)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      💡 3Dビューでは顔面神経（黄）と血管系（青）のグロー球が限界壁位置を示しています。
                      骨を solid 表示にして位置関係を把握してください。
                    </div>
                  </div>

                  {/* Körner's septum 補足 */}
                  <div className="card">
                    <div className="section-title">Körner's septum（ペトロ鱗骨縫合）</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      削開を進めると Antrum に入る手前で密な蜂巣構造が認められます。
                      これが Körner's septum（中頭蓋窩とS状静脈洞の境界骨片）です。
                      この隔壁を確認したら、より深部の乳突洞（Antrum）に向かって削開します。
                    </div>
                    <div style={{ marginTop: 8, padding: '5px 8px', borderRadius: 5, background: 'rgba(255,100,100,0.07)', border: '1px solid rgba(255,100,100,0.2)', fontSize: 11, color: '#dd8080' }}>
                      ⚠ Körner's septumを確認せずに深く削開すると迷路を損傷するリスクあり
                    </div>
                  </div>
                </>
              )}

              {/* ── S5: 削開完了後ビュー ── */}
              {drillScenario === 's5' && (
                <>
                  <div className="card">
                    <div className="section-title" style={{ color: '#4ade80' }}>✅ 削開完了後チェックリスト</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
                      Mastoidectomy完了時に3Dビューで確認できる構造です。
                      慈恵医大テキストのCheck Listに基づいて確認してください。
                    </div>

                    {[
                      { item: 'Körner\'s septumの確認・通過', note: '密な蜂巣を確認後、乳突洞（Antrum）に到達したことを確認' },
                      { item: '中頭蓋窩（Tegmen）の限界壁確認', note: '天蓋を明視野に露出。黄白色の骨面が目安' },
                      { item: 'S状静脈洞（Sigmoid sinus）の限界壁確認', note: '青みがかったエッグシェル様骨面を確認' },
                      { item: 'Sino-dural angle（乙状静脈洞—天蓋角）の露出', note: '乳突腔削開の最重要ランドマーク' },
                      { item: '外耳道後壁をできる限り薄く削除', note: 'Canal wall up法では外耳道後壁を保存しつつ薄くする' },
                      { item: '鼓探輪（外耳道輪）の高さを確認', note: '外耳道後壁削開の深さ制限の指標' },
                      { item: '外側半規管（Horizontal SC）を同定', note: '3Dビューで青い構造として表示。方向感の基準になる' },
                      { item: 'キヌタ骨短脚（Incus short process）を確認', note: 'Fossa incudisの目視確認。砧骨窩が明視野に入ったら上鼓室開放の指標' },
                      { item: 'Fossa incudis（砧骨窩）の確認', note: '上鼓室と乳突腔の境界部位。Incus short processが見えれば上鼓室開放の準備完了' },
                      { item: '顔面神経（水平部）の同定', note: '外側半規管の直下に走行。アブミ骨手術・後鼓室開放の際に必須の同定' },
                    ].map(({ item, note }, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: 10, padding: '8px 10px', marginBottom: 6,
                        borderRadius: 7, border: '1px solid rgba(74,222,128,0.18)',
                        background: 'rgba(74,222,128,0.05)',
                      }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                          background: 'rgba(74,222,128,0.2)', border: '1px solid #4ade8055',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700, color: '#4ade80',
                        }}>
                          {i + 1}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#4ade80', marginBottom: 2 }}>{item}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{note}</div>
                        </div>
                      </div>
                    ))}

                    <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 7, background: 'rgba(0,180,216,0.06)', border: '1px solid rgba(0,180,216,0.2)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      💡 3Dビューは骨を半透明（ghost）にして内部構造を露出した状態です。
                      顔面神経（黄）・耳小骨（金）・内耳（青）の立体的位置関係を確認してください。
                    </div>
                  </div>

                  {/* 顔面神経走行の要約 */}
                  <div className="card">
                    <div className="section-title">顔面神経の走行（乳突腔内）</div>
                    {[
                      { seg: '迷路部（Labyrinthine）', note: '内耳道底〜膝神経節。最短・最狭窄部。血流が乏しく麻痺が起きやすい。' },
                      { seg: '水平部（Tympanic）', note: '膝神経節〜錐体隆起。アブミ骨直上を走行。鼓室形成・アブミ骨手術の最重要危険部位。' },
                      { seg: '乳突部（Mastoid）', note: '錐体隆起〜茎乳突孔。外側半規管直下・顎二腹筋稜内側を走行。Mastoidectomyの危険部位。' },
                    ].map(({ seg, note }) => (
                      <div key={seg} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#f5d820', marginBottom: 3 }}>{seg}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{note}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
