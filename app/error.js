'use client';

import { useEffect } from 'react';
import AppShell from './components/AppShell';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('Application Error:', error);
  }, [error]);

  return (
    <AppShell title="Error">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <div style={{ fontSize: '72px', marginBottom: 'var(--space-md)' }}>⚠️</div>
        <h1 style={{ fontSize: '32px', margin: '0 0 var(--space-lg) 0', color: 'var(--text-primary)' }}>Something went wrong!</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-xl)', maxWidth: '400px', lineHeight: '1.6' }}>
          We encountered an unexpected error while trying to process your request.
        </p>
        <button onClick={() => reset()} className="btn btn-primary">
          Try Again
        </button>
      </div>
    </AppShell>
  );
}
