/**
 * ViewPresetPanel.tsx — 解剖・手術ビュープリセット選択パネル
 *
 * 使用方法:
 *   <ViewPresetPanel mode="anatomy" onSelectView={setAnatomyCameraView} />
 *   <ViewPresetPanel mode="sim"     onSelectView={v => setSimCameraView(shiftViewForSim(v))} />
 */

import { useState } from 'react';
import {
  ANATOMICAL_VIEWS,
  SURGICAL_VIEWS,
  type CameraView,
} from '../scenes/ViewPresets';

interface ViewPresetPanelProps {
  onSelectView: (view: CameraView) => void;
}

const BTN_BASE: React.CSSProperties = {
  flex: '1 1 48px',
  padding: '5px 4px',
  borderRadius: 5,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.05)',
  color: 'var(--text-secondary)',
  fontSize: 10,
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'center',
  transition: 'all .12s',
  lineHeight: 1.3,
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--text-muted)',
  letterSpacing: '.05em',
  marginBottom: 5,
};

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      style={{
        ...BTN_BASE,
        background: hover ? 'rgba(0,180,216,0.18)' : BTN_BASE.background,
        borderColor: hover ? 'rgba(0,180,216,0.50)' : 'rgba(255,255,255,0.12)',
        color: hover ? '#7dd8e8' : 'var(--text-secondary)',
      }}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {label}
    </button>
  );
}

export function ViewPresetPanel({ onSelectView }: ViewPresetPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* 解剖学的ビュー */}
      <div>
        <div style={SECTION_LABEL}>解剖学的方向</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {ANATOMICAL_VIEWS.map(p => (
            <PresetButton
              key={p.key}
              label={p.short}
              onClick={() => onSelectView(p.view)}
            />
          ))}
        </div>
      </div>

      {/* 手術ビュー */}
      <div>
        <div style={SECTION_LABEL}>手術ビュー</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {SURGICAL_VIEWS.map(p => (
            <PresetButton
              key={p.key}
              label={p.short}
              onClick={() => onSelectView(p.view)}
            />
          ))}
        </div>
      </div>

    </div>
  );
}
