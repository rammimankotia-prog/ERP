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
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: 'red' }}>Something went wrong!</h2>
          <p style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '8px' }}>
            {error.message || 'Unknown error'}
          </p>
          <pre>{error.stack}</pre>
          <button
            onClick={() => reset()}
            style={{ padding: '0.5rem 1rem', marginTop: '1rem' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
