'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();
  
  // Minimal footprint on actual game boards
  const isBoardPage = pathname?.includes('/play/') || pathname?.includes('/analyze') || pathname?.includes('/puzzles');

  if (isBoardPage) {
    return null; // Do not render footer on active boards to maximize screen real estate
  }

  return (
    <footer style={{
      borderTop: '1px solid var(--border-subtle)',
      padding: 'var(--space-xl) var(--space-2xl)',
      marginTop: 'auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 'var(--space-md)',
      color: 'var(--text-muted)'
    }}>
      <div style={{ display: 'flex', gap: 'var(--space-lg)', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/about" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>About</Link>
        <Link href="/privacy" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>Privacy Policy</Link>
        <Link href="/terms" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>Terms of Service</Link>
      </div>
      <div style={{ fontSize: '12px', textAlign: 'center' }}>
        &copy; {new Date().getFullYear()} ChessMaster. All rights reserved.
      </div>
    </footer>
  );
}
