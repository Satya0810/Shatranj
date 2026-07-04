import Link from 'next/link';
import AppShell from './components/AppShell';

export default function NotFound() {
  return (
    <AppShell title="404 - Not Found">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <div style={{ fontSize: '72px', marginBottom: 'var(--space-md)' }}>♟️</div>
        <h1 style={{ fontSize: '48px', margin: '0 0 var(--space-md) 0', color: 'var(--text-primary)' }}>404</h1>
        <h2 style={{ fontSize: '24px', margin: '0 0 var(--space-lg) 0', color: 'var(--text-secondary)' }}>Page Not Found</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-xl)', maxWidth: '400px', lineHeight: '1.6' }}>
          It looks like this move is illegal. The page you are looking for doesn't exist or has been moved.
        </p>
        <Link href="/" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          Return to Base
        </Link>
      </div>
    </AppShell>
  );
}
