import { useState } from 'react';
import { useSimStore } from '../store/useSimStore';
import { kurzProducts } from '../data/products';
import { AnatomyScene } from '../scenes/AnatomyScene';
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
  { key: 'bone',        label: '側頭骨',  color: '#f2ead8' },
  { key: 'auricle',     label: '耳介',    color: '#e8c8a8' },
  { key: 'ossicles',    label: '耳小骨',  color: '#e8d8a8' },
  { key: 'tympanic',    label: '鼓膜',    color: '#f8d8c0' },
  { key: 'innerEar',    label: '内耳',    color: '#60b8e0' },
  { key: 'nerves',      label: '神経',    color: '#f5d820' },
  { key: 'eac',         label: '外耳道',  color: '#d8c8a0' },
  { key: 'roundWindow', label: '正円窓',  color: '#5888a8' },
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

// ════════════════════════════════════════════════════════
export function LearningMode() {
  const { learningTab, setLearningTab, highlightedStructure, setHighlightedStructure, selectedPatientId } = useSimStore();
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  // 3D表示モード状態（デフォルトはRealAnatomyModelsのDEFAULT_MODESに委譲）
  const [vis, setVis] = useState<VisibilityMap>({});
  const cycleMode = (key: StructureKey) => {
    const curr = vis[key] ?? DEFAULT_MODES[key];
    const next = CYCLE[(CYCLE.indexOf(curr) + 1) % CYCLE.length];
    setVis(v => ({ ...v, [key]: next }));
  };
  const getMode = (key: StructureKey): OpacityMode => vis[key] ?? DEFAULT_MODES[key];

  // ズームレベル（0 = 初期FOV）
  const [zoomLevel, setZoomLevel] = useState(0);

  const selProd = kurzProducts.find((p) => p.id === selectedProduct);

  // 鼓室の表示制御（構造ハイライトで ON）
  const showTympanoCavity = highlightedStructure === 'tympanoCavity';
  // 耳介 STL PinnaModel: 3D表示切替の「耳介」が solid/ghost のときに表示
  // RealAuricle.glb の代わりに STL を使うため、vis.auricle を 'hidden' に強制する
  const auricleMode = vis.auricle ?? DEFAULT_MODES.auricle;
  const showPinna = auricleMode !== 'hidden';
  // AnatomyScene に渡す vis: 耳介を常に hidden にして GLB auricle を非表示にする
  const visForScene: VisibilityMap = { ...vis, auricle: 'hidden' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
      {/* Tabs */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="tabs">
          {(['anatomy', 'products', 'procedure'] as const).map((t) => (
            <button key={t} className={`tab ${learningTab === t ? 'active' : ''}`} onClick={() => setLearningTab(t)}>
              {t === 'anatomy' ? '🦴 解剖' : t === 'products' ? '🔩 製品' : '📋 術式'}
            </button>
          ))}
        </div>
      </div>

      <div className="layout-split" style={{ flex: 1 }}>
        {/* 3D Canvas */}
        <div className="canvas-wrapper" style={{ position: 'relative' }}>
          <AnatomyScene
            vis={visForScene}
            zoomLevel={zoomLevel}
            showTympanoCavity={showTympanoCavity}
            showPinna={showPinna}
            pinnaMode={auricleMode === 'ghost' ? 'ghost' : 'solid'}
            patientId={selectedPatientId}
          />

          {/* 操作ヒント */}
          <div className="canvas-overlay top-left">
            <div style={{ background: 'rgba(0,0,0,.6)', padding: '6px 10px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>
              ドラッグ: 回転 ｜ ホイール: ズーム
            </div>
          </div>

          {/* 強調表示中の構造名 */}
          {highlightedStructure && (
            <div className="canvas-overlay bottom-left">
              <div style={{ background: 'rgba(0,180,216,.15)', border: '1px solid var(--accent)', padding: '6px 10px', borderRadius: 6, color: 'var(--accent)', backdropFilter: 'blur(4px)' }}>
                {anatomyStructures.find((s) => s.id === highlightedStructure)?.label}
              </div>
            </div>
          )}

          {/* ズームボタン */}
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
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          {learningTab === 'anatomy' && (
            <>
              {/* 構造ハイライト */}
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

              {/* 3D表示切替 */}
              <div className="card">
                <div className="section-title">3D 表示切替</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                  クリックで 実体 → 半透明 → 非表示 を切替
                </div>
                {VIS_ITEMS.map(({ key, label, color }) => {
                  const mode = getMode(key);
                  return (
                    <div
                      key={key}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '6px 2px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{
                          width: 9, height: 9, borderRadius: '50%',
                          background: color,
                          opacity: mode === 'hidden' ? 0.2 : mode === 'ghost' ? 0.5 : 1,
                          flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 12, color: mode === 'hidden' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                          {label}
                        </span>
                      </div>
                      <button
                        onClick={() => cycleMode(key)}
                        style={{
                          padding: '3px 10px', borderRadius: 4, border: 'none',
                          cursor: 'pointer', fontSize: 11, fontWeight: 600,
                          background: MODE_BG[mode], color: MODE_FG[mode],
                          minWidth: 52, transition: 'background .15s',
                        }}
                      >
                        {MODE_LABEL[mode]}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* 音響伝達 */}
              <div className="card">
                <div className="section-title">耳小骨連鎖の音響伝達</div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  鼓膜の振動 → ツチ骨 → キヌタ骨 → アブミ骨 → 卵円窓 → 蝸牛<br /><br />
                  KURZ人工耳小骨はこの連鎖を再建します。PORPはキヌタ骨欠損を、TORPは全耳小骨欠損を補填します。
                </p>
              </div>
            </>
          )}

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
        </div>
      </div>
    </div>
  );
}
