import { useState } from 'react';
import { useSimStore } from '../store/useSimStore';
import { kurzProducts } from '../data/products';
import { AnatomyScene } from '../scenes/AnatomyScene';
import type { RealAnatomyProps } from '../scenes/models/RealAnatomyModels';

const anatomyStructures = [
  { id: 'malleus',  label: 'ツチ骨 (Malleus)',  desc: '鼓膜に付着する最外側の耳小骨。鼓膜の振動を受け取りキヌタ骨に伝達。マニュブリウム（柄）とヘッド部からなる。', color: '#e8d5b0' },
  { id: 'incus',   label: 'キヌタ骨 (Incus)',   desc: '中間に位置する耳小骨。体部・短突起・長突起から構成。慢性中耳炎では長突起尖端から壊死しやすい。', color: '#c4a97a' },
  { id: 'stapes',  label: 'アブミ骨 (Stapes)',  desc: '最内側かつ最小の耳小骨。頭部・前後弓・底板で構成。底板が卵円窓を塞ぎ蝸牛へ振動を伝える。', color: '#e8d5b0' },
  { id: 'membrane', label: '鼓膜 (Tympanic M.)', desc: '外耳道と鼓室を隔てる薄い膜。厚さ約0.1mm。中央部（臍）にツチ骨が付着。', color: '#f5e6c8' },
];

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

// 表示切替の定義
const VISIBILITY_ITEMS: { key: keyof RealAnatomyProps; label: string; color: string }[] = [
  { key: 'showBone',        label: '側頭骨',  color: '#f2ead8' },
  { key: 'showAuricle',     label: '耳介',    color: '#e8c8a8' },
  { key: 'showOssicles',    label: '耳小骨',  color: '#e8d8a8' },
  { key: 'showTympanic',    label: '鼓膜',    color: '#f8d8c0' },
  { key: 'showInnerEar',    label: '内耳',    color: '#60b8e0' },
  { key: 'showNerves',      label: '神経',    color: '#f5d820' },
  { key: 'showEAC',         label: '外耳道',  color: '#d8c8a0' },
  { key: 'showRoundWindow', label: '正円窓',  color: '#5888a8' },
];

const DEFAULT_VISIBILITY: RealAnatomyProps = {
  showBone: true,
  showAuricle: false,
  showOssicles: true,
  showTympanic: true,
  showInnerEar: true,
  showNerves: true,
  showEAC: true,
  showRoundWindow: true,
};

export function LearningMode() {
  const { learningTab, setLearningTab, highlightedStructure, setHighlightedStructure } = useSimStore();
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<RealAnatomyProps>(DEFAULT_VISIBILITY);

  const toggleVisibility = (key: keyof RealAnatomyProps) =>
    setVisibility(v => ({ ...v, [key]: !v[key] }));

  const selProd = kurzProducts.find((p) => p.id === selectedProduct);

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
        <div className="canvas-wrapper">
          <AnatomyScene visibility={visibility} />
          <div className="canvas-overlay top-left">
            <div style={{ background: 'rgba(0,0,0,.6)', padding: '6px 10px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>
              ドラッグ: 回転 ｜ ホイール: ズーム
            </div>
          </div>
          {highlightedStructure && (
            <div className="canvas-overlay bottom-left">
              <div style={{ background: 'rgba(0,180,216,.15)', border: '1px solid var(--accent)', padding: '6px 10px', borderRadius: 6, color: 'var(--accent)', backdropFilter: 'blur(4px)' }}>
                {anatomyStructures.find((s) => s.id === highlightedStructure)?.label}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          {learningTab === 'anatomy' && (
            <>
              <div className="card">
                <div className="section-title">構造を選択してハイライト</div>
                {anatomyStructures.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setHighlightedStructure(highlightedStructure === s.id ? null : s.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      marginBottom: 6,
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
                <div className="section-title">3D表示切替</div>
                {VISIBILITY_ITEMS.map(({ key, label, color }) => {
                  const isOn = !!visibility[key];
                  return (
                    <div
                      key={key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 4px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0, opacity: isOn ? 1 : 0.3 }} />
                        <span style={{ fontSize: 13, color: isOn ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</span>
                      </div>
                      {/* トグルスイッチ */}
                      <div
                        onClick={() => toggleVisibility(key)}
                        style={{
                          width: 38,
                          height: 20,
                          borderRadius: 10,
                          background: isOn ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'background .2s',
                          flexShrink: 0,
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: 2,
                          left: isOn ? 20 : 2,
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: '#fff',
                          transition: 'left .2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                        }} />
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
