'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('GLOBAL ERROR:', error);

    // Auto-reload on ChunkLoadError (stale cache after new deploy)
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.toLowerCase().includes('failed to load chunk') ||
      error?.message?.toLowerCase().includes('loading chunk') ||
      error?.message?.toLowerCase().includes('loading css chunk');

    if (isChunkError) {
      try {
        const reloadKey = 'chunk_error_reload_at';
        const lastReload = Number(sessionStorage.getItem(reloadKey) || 0);
        const now = Date.now();
        if (now - lastReload > 10000) {
          sessionStorage.setItem(reloadKey, String(now));
          window.location.reload();
        }
      } catch {}
    }
  }, [error]);

  const isChunkError =
    error?.name === 'ChunkLoadError' ||
    error?.message?.toLowerCase().includes('failed to load chunk') ||
    error?.message?.toLowerCase().includes('loading chunk');

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0f172a' }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '1.5rem',
        }}>
          <div style={{
            width: '100%',
            maxWidth: '480px',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '2rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
              {isChunkError ? '🔄' : '⚠️'}
            </div>
            <h2 style={{ color: '#f1f5f9', fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.75rem' }}>
              {isChunkError ? 'Update Available' : 'Something went wrong'}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              {isChunkError
                ? 'The app was updated. Refreshing to load the latest version...'
                : (error.message || 'An unexpected error occurred. Please try again.')}
            </p>
            <button
              onClick={() => {
                if (isChunkError) {
                  window.location.reload();
                } else {
                  reset();
                }
              }}
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '0.75rem 1.5rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: 'pointer',
                width: '100%',
                minHeight: '44px',
              }}
            >
              {isChunkError ? '🔄 Reload Now' : '↩ Try Again'}
            </button>

            <p style={{ color: '#475569', fontSize: '0.72rem', marginTop: '1.25rem' }}>
              Godwin ERP · Hotel Grand Godwin &amp; Godwin Deluxe
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
