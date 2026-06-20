import { useState } from 'react';
import { useSimStore } from '../store/useSimStore';
import { kurzProducts } from '../data/products';
import { AnatomyScene } from '../scenes/AnatomyScene';
import { DrillTrainingScene } from '../scenes/DrillTrainingScene';
import { DANGER_ZONES, FACIAL_ZONES, VASCULAR_ZONES } from '../data/dangerZones';
import {
  DEFAULT_MODES,
  type OpacityMode,
  type StructureKey,
  type VisibilityMap,
} from '../scenes/models/RealAnatomyModels';

// ── 解剖構造リスト（サイドバー教育用）────────────────────────────
const anatomyStructures = [
  { id: 'tympanoCavity', label: '鼓室 (Tympanic Cavity)', desc: '中耳腔。6つの壁で構成される空間。内側壁に岬角・卵円窓・正円窓が位置し、顔面神経水平部・鼓索神経が走行する。耳管で鼻咽腔に通じる。', color: '#e8c0a0' },
  { id: 'malleus',  label: 'ツチ骨 (Malleus)',  desc: '鼓膜に付着する最外側の耳小骨。鼓膜の振動を受け取りキヌタ骨に伝達。マニュブリウム（柄）とヘッド部からなる。', color: '#e8d5b0' },
  { id: 'incus',   label: 'キヌタ骨 (Incus)',   desc: '中間に位置する耳小骨。体部・短突起・長突起から構成。慢性中耳炎では長突起尖端から壊死しやすい。', color: '#c4a97a' },
  { id: 'stapes',  label: 'アブミ骨 (Stapes)',  desc: '最内側かつ最小の耳小骨。頭部・前後弓・底板で構成。底板が卵円窓を塞ぎ蝸牛へ振動を伝える。', color: '#e8d5b0' },
  { id: 'membrane', label: '鼓膜 (Tympanic M.)', desc: '外耳道と鼓室を隔てる薄い膜。厚さ約0.1mm。中央部（臍）にツチ骨が付着。', color: '#f5e6c8' },
];

// ── 3D表示切替アイテム定義 ───────────────────────────────────────
const VIS_ITEMS: { key: StructureKey; label: string; color: string }[] = [
  { key: 'bone',          label: '側頭骨',  color: '#f2ead8' },
  { key: 'auricle',       label: '耳介',    color: '#e8c8a8' },
  { key: 'ossicles',      label: '耳小骨',  color: '#e8d8a8' },
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

// ── 術式データ ────────────────────────────────────────────────────
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

// ── 危険部位カテゴリラベル ─────────────────────────────────────────
const CAT_LABEL: Record<string, string> = {
  facial:   '顔面神経系',
  vascular: '血管系',
};
const CAT_COLOR: Record<string, string> = {
  facial:   '#f5d820',
  vascular: '#4477ff',
};

// ════════════════════════════════════════════════════════
export function LearningMode() {
  const { learningTab, setLearningTab, highlightedStructure, setHighlightedStructure, selectedPatientId } = useSimStore();
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  // 3D表示モード状態
  const [vis, setVis] = useState<VisibilityMap>({});
  const cycleMode = (key: StructureKey) => {
    const curr = vis[key] ?? DEFAULT_MODES[key];
    const next = CYCLE[(CYCLE.indexOf(curr) + 1) % CYCLE.length];
    setVis(v => ({ ...v, [key]: next }));
  };
  const getMode = (key: StructureKey): OpacityMode => vis[key] ?? DEFAULT_MODES[key];

  // ズームレベル
  const [zoomLevel, setZoomLevel] = useState(0);

  // 削開タブ状態
  const [drillScenario, setDrillScenario] = useState<'s1' | 's2'>('s1');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const selProd = kurzProducts.find((p) => p.id === selectedProduct);
  const selectedZone = DANGER_ZONES.find((z) => z.id === selectedZoneId) ?? null;

  // 鼓室の表示制御
  const showTympanoCavity = highlightedStructure === 'tympanoCavity';
  const auricleMode = vis.auricle ?? DEFAULT_MODES.auricle;
  const showPinna = auricleMode !== 'hidden';
  const visForScene: VisibilityMap = { ...vis, auricle: 'hidden' };

  // タブ定義
  const TAB_LIST = [
    { key: 'anatomy',   label: '🦴 解剖' },
    { key: 'products',  label: '🔩 製品' },
    { key: 'procedure', label: '📋 術式' },
    { key: 'drilling',  label: '🔴 削開' },
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
      {/* Tabs */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
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
        <div className="canvas-wrapper" style={{ position: 'relative' }}>
          {learningTab === 'drilling' ? (
            <DrillTrainingScene
              scenario={drillScenario}
              selectedZoneId={selectedZoneId}
              onZoneSelect={setSelectedZoneId}
            />
          ) : (
            <AnatomyScene
              vis={visForScene}
              zoomLevel={zoomLevel}
              showTympanoCavity={showTympanoCavity}
              showPinna={showPinna}
              pinnaMode={auricleMode === 'ghost' ? 'ghost' : 'solid'}
              patientId={selectedPatientId}
            />
          )}

          {/* 操作ヒント */}
          <div className="canvas-overlay top-left">
            <div style={{ background: 'rgba(0,0,0,.6)', padding: '6px 10px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>
              {learningTab === 'drilling' && drillScenario === 's2'
                ? '球をクリック: 危険部位を選択 ｜ ドラッグ: 回転'
                : 'ドラッグ: 回転 ｜ ホイール: ズーム'}
            </div>
          </div>

          {/* 危険部位選択インジケーター（S2） */}
          {learningTab === 'drilling' && drillScenario === 's2' && selectedZone && (
            <div className="canvas-overlay bottom-left">
              <div style={{
                background: 'rgba(10,10,20,.82)',
                border: `1px solid ${selectedZone.color}`,
                padding: '8px 12px', borderRadius: 8,
                backdropFilter: 'blur(4px)',
              }}>
                <span style={{ color: selectedZone.color, fontWeight: 700, fontSize: 13 }}>
                  ⚠ {selectedZone.nameJa}
                </span>
              </div>
            </div>
          )}

          {/* 強調表示中の構造名（解剖タブ） */}
          {learningTab === 'anatomy' && highlightedStructure && (
            <div className="canvas-overlay bottom-left">
              <div style={{ background: 'rgba(0,180,216,.15)', border: '1px solid var(--accent)', padding: '6px 10px', borderRadius: 6, color: 'var(--accent)', backdropFilter: 'blur(4px)' }}>
                {anatomyStructures.find((s) => s.id === highlightedStructure)?.label}
              </div>
            </div>
          )}

          {/* ズームボタン（削開タブ以外） */}
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
                    width: 34, height: 34,
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(10,15,26,0.80)',
                    color: '#c0d8e8',
                    fontSize: 18,
                    cursor: 'pointer',
                    backdropFilter: 'blur(6px)',
                    lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700,
                    transition: 'background .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,180,216,0.22)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(10,15,26,0.80)')}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          {/* ══ 解剖タブ ══ */}
          {learningTab === 'anatomy' && (
            <>
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
                  クリックで 実体 → 半透明 → 非表示 を切替
                </div>
                {VIS_ITEMS.map(({ key, label, color }) => {
                  const mode = getMode(key);
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 2px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
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

          {/* ══ 製品タブ ══ */}
          {learningTab === 'products' && (
            <>
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

          {/* ══ 術式タブ ══ */}
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

          {/* ══ 削開タブ ══ */}
          {learningTab === 'drilling' && (
            <>
              {/* シナリオセレクター */}
              <div className="card">
                <div className="section-title">シナリオ選択</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  {([
                    { key: 's1', label: 'S1: 解剖探索', desc: '自由に回転・拡大して構造を確認' },
                    { key: 's2', label: 'S2: 危険部位特定', desc: '危険部位をクリックして確認' },
                  ] as const).map(({ key, label, desc }) => (
                    <button
                      key={key}
                      onClick={() => { setDrillScenario(key); setSelectedZoneId(null); }}
                      style={{
                        flex: 1, padding: '10px 8px', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${drillScenario === key ? 'var(--accent)' : 'var(--border)'}`,
                        background: drillScenario === key ? 'rgba(0,180,216,.15)' : 'rgba(255,255,255,.03)',
                        color: drillScenario === key ? 'var(--accent)' : 'var(--text-secondary)',
                        fontSize: 12, fontWeight: drillScenario === key ? 700 : 400,
                        textAlign: 'center', transition: 'all .15s',
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 10, opacity: 0.75 }}>{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* S1: 解剖探索 */}
              {drillScenario === 's1' && (
                <div className="card">
                  <div className="section-title">S1 — 解剖探索</div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
                    側頭骨と中耳構造を自由に観察してください。
                    ドラッグで回転、ホイールでズームができます。
                  </p>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
                      学習チェックポイント
                    </div>
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

              {/* S2: 危険部位特定 */}
              {drillScenario === 's2' && (
                <>
                  {/* 凡例 */}
                  <div className="card" style={{ padding: '10px 14px' }}>
                    <div className="section-title">危険部位警告システム</div>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f5d820' }} />
                        顔面神経系
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#4477ff' }} />
                        血管系
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      ● 核（小）: 危険域 2mm以内　◯ 外周（大）: 警告域 5mm以内
                    </div>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
