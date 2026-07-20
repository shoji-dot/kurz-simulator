/**
 * ViewPresetPanel.tsx — 解剖・手術ビュープリセット選択パネル
 * カスタム保存: プリセット選択後に視点を保存すると次回そのプリセットで復元される
 */

import { useState, useCallback } from 'react';
import {
  ANATOMICAL_VIEWS,
  SURGICAL_VIEWS,
  type CameraView,
} from '../scenes/ViewPresets';

// localStorage キー
const CUSTOM_PRESET_KEY = 'kurz_custom_presets';

function loadCustomPresets(): Record<string, CameraView> {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESET_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function persistCustomPresets(presets: Record<string, CameraView>): void {
  localStorage.setItem(CUSTOM_PRESET_KEY, JSON.stringify(presets));
}

interface ViewPresetPanelProps {
  onSelectView: (view: CameraView) => void;
  /** 表示する手術プリセットキーの絞り込み（省略時: 全表示） */
  surgicalKeys?: string[];
  /** 解剖学的方向ビューを表示するか（省略時: true） */
  showAnatomical?: boolean;
  /**
   * 現在のカメラ視点を返すコールバック（省略時: 保存ボタン非表示）
   * 返す座標は onSelectView に渡すものと同じ座標系（未シフト）であること
   */
  getCamera?: () => CameraView;
  /** 既定折りたたみのヘッダーを表示するか（省略時: false = 常時展開・従来動作） */
  collapsible?: boolean;
  /** collapsible=true のときの初期展開状態（省略時: false = 折りたたみ） */
  defaultOpen?: boolean;
}

const BTN_BASE: React.CSSProperties = {
  flex: '1 1 48px',
  padding: '5px 4px',
  borderRadius: 5,
  border: '1px solid var(--color-border-bright)',
  background: 'var(--color-surface-hover)',
  color: 'var(--color-text-secondary)',
  fontSize: 10,
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'center',
  transition: 'all .12s',
  lineHeight: 1.3,
  position: 'relative' as const,
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  letterSpacing: '.05em',
  marginBottom: 5,
};

function PresetButton({
  label, active, hasCustom, onClick,
}: {
  label: string;
  active: boolean;
  hasCustom: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      style={{
        ...BTN_BASE,
        background: active
          ? 'rgba(var(--color-primary-rgb),0.22)'
          : hover ? 'rgba(var(--color-primary-rgb),0.10)' : BTN_BASE.background,
        borderColor: active
          ? 'rgba(var(--color-primary-rgb),0.70)'
          : hover ? 'rgba(var(--color-primary-rgb),0.40)' : 'var(--color-border-bright)',
        color: active || hover ? 'var(--color-primary)' : 'var(--color-text-secondary)',
      }}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {label}
      {hasCustom && (
        <span style={{
          position: 'absolute', top: 2, right: 3,
          fontSize: 7, color: 'var(--color-warning)', lineHeight: 1,
          pointerEvents: 'none',
        }}>
          &#9733;
        </span>
      )}
    </button>
  );
}

export function ViewPresetPanel({
  onSelectView, surgicalKeys, showAnatomical = true, getCamera,
  collapsible = false, defaultOpen = false,
}: ViewPresetPanelProps) {
  const filteredSurgical = surgicalKeys
    ? SURGICAL_VIEWS.filter(p => surgicalKeys.includes(p.key))
    : SURGICAL_VIEWS;

  const [activeKey, setActiveKey]         = useState<string | null>(null);
  const [customPresets, setCustomPresets] = useState<Record<string, CameraView>>(loadCustomPresets);
  const [savedFlash, setSavedFlash]       = useState(false);
  const [isOpen, setIsOpen]               = useState(!collapsible || defaultOpen);

  const handleSelect = useCallback((key: string, defaultView: CameraView) => {
    setActiveKey(key);
    const custom = customPresets[key];
    onSelectView(custom ?? defaultView);
  }, [customPresets, onSelectView]);

  const handleSave = useCallback(() => {
    if (!activeKey || !getCamera) return;
    const cam = getCamera();
    const next = { ...customPresets, [activeKey]: cam };
    persistCustomPresets(next);
    setCustomPresets(next);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1400);
  }, [activeKey, getCamera, customPresets]);

  const handleReset = useCallback((key: string) => {
    const next = { ...customPresets };
    delete next[key];
    persistCustomPresets(next);
    setCustomPresets(next);
    const preset = [...SURGICAL_VIEWS, ...ANATOMICAL_VIEWS].find(p => p.key === key);
    if (preset) onSelectView(preset.view);
  }, [customPresets, onSelectView]);

  const activeLabel = [...filteredSurgical, ...(showAnatomical ? ANATOMICAL_VIEWS : [])]
    .find(p => p.key === activeKey)?.short ?? activeKey;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {collapsible && (
        <button
          onClick={() => setIsOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
            padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            color: 'var(--color-text-secondary)', fontSize: 11, fontWeight: 700,
          }}
        >
          <span>視点プリセット{!isOpen && activeLabel ? `： ${String(activeLabel)}` : ''}</span>
          <span style={{ fontSize: 10, opacity: 0.6 }}>{isOpen ? '▾ 閉じる' : '▸ 開く'}</span>
        </button>
      )}

      {isOpen && (
        <>
      {filteredSurgical.length > 0 && (
        <div>
          <div style={SECTION_LABEL}>手術ビュー</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {filteredSurgical.map(p => (
              <PresetButton
                key={p.key}
                label={p.short}
                active={activeKey === p.key}
                hasCustom={!!customPresets[p.key]}
                onClick={() => handleSelect(p.key, p.view)}
              />
            ))}
          </div>
        </div>
      )}

      {showAnatomical && (
        <div>
          <div style={SECTION_LABEL}>解剖学的方向</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {ANATOMICAL_VIEWS.map(p => (
              <PresetButton
                key={p.key}
                label={p.short}
                active={activeKey === p.key}
                hasCustom={!!customPresets[p.key]}
                onClick={() => handleSelect(p.key, p.view)}
              />
            ))}
          </div>
        </div>
      )}

      {getCamera && activeKey && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            onClick={handleSave}
            style={{
              flex: 1, padding: '5px 8px', borderRadius: 5, cursor: 'pointer',
              border: savedFlash ? '1px solid rgba(var(--color-success-rgb),0.50)' : '1px solid rgba(var(--color-primary-rgb),0.40)',
              background: savedFlash ? 'var(--color-success-bg)' : 'rgba(var(--color-primary-rgb),0.10)',
              color: savedFlash ? 'var(--color-success)' : 'var(--color-primary)',
              fontSize: 10, fontWeight: 700, transition: 'all .18s',
            }}
          >
            {savedFlash ? '\u2713 保存しました' : ('\ud83d\udcbe ' + String(activeLabel) + 'に保存')}
          </button>
          {customPresets[activeKey] && (
            <button
              onClick={() => handleReset(activeKey)}
              style={{
                padding: '5px 8px', borderRadius: 5, cursor: 'pointer',
                border: '1px solid rgba(var(--color-error-rgb),0.30)',
                background: 'rgba(var(--color-error-rgb),0.08)',
                color: 'var(--color-error)', fontSize: 10, fontWeight: 700,
              }}
            >
              \u2715 リセット
            </button>
          )}
        </div>
      )}
        </>
      )}

    </div>
  );
}
