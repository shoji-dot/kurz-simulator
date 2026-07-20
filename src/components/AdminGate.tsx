import { useState, useRef, useEffect } from 'react';
import { verifyAdminPasscode, unlockAdminMode } from '../utils/adminMode';
import { Button, Alert, Z_INDEX } from './ui';

export interface AdminGateProps {
  onUnlock: () => void;
  onCancel: () => void;
}

/**
 * 管理者プレビュー（削開練習等）解除用のパスコード入力画面。
 * ?admin=1 でアクセスされ、まだ解除されていない場合に App.tsx から表示される。
 * 詳細・パスコード変更方法は src/utils/adminMode.ts のコメント参照。
 */
export function AdminGate({ onUnlock, onCancel }: AdminGateProps) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode || checking) return;
    setChecking(true);
    setError(false);
    const ok = await verifyAdminPasscode(passcode);
    setChecking(false);
    if (ok) {
      unlockAdminMode();
      onUnlock();
    } else {
      setError(true);
      setPasscode('');
      inputRef.current?.focus();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z_INDEX.modal,
        background: 'var(--color-bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-5)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 320,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <div style={{ font: 'var(--text-subtitle)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
            管理者プレビュー
          </div>
          <div style={{ font: 'var(--text-small)', color: 'var(--color-text-muted)' }}>
            パスコードを入力してください
          </div>
        </div>

        <input
          ref={inputRef}
          type="password"
          value={passcode}
          onChange={(e) => { setPasscode(e.target.value); setError(false); }}
          className="kz-focusable"
          autoComplete="off"
          style={{
            width: '100%',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-border-bright)'}`,
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)',
            font: 'var(--text-body)',
            outline: 'none',
          }}
        />

        {error && <Alert tone="error">パスコードが違います。</Alert>}

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button type="button" variant="ghost" style={{ flex: 1 }} onClick={onCancel}>
            戻る
          </Button>
          <Button type="submit" variant="primary" style={{ flex: 1 }} disabled={!passcode || checking}>
            {checking ? '確認中…' : '解除する'}
          </Button>
        </div>
      </form>
    </div>
  );
}
