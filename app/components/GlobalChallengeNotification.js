'use client';

import { useAuth } from './AuthContext';
import { useRouter } from 'next/navigation';

export default function GlobalChallengeNotification() {
  const { globalChallenge, acceptGlobalChallenge, declineGlobalChallenge } = useAuth();
  const router = useRouter();

  if (!globalChallenge) return null;

  const handleAccept = () => {
    acceptGlobalChallenge();
    // Redirect to play online page so the game-start event is caught
    router.push('/play/online');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      zIndex: 9999,
      maxWidth: '360px',
      width: '90%',
      background: 'linear-gradient(135deg, #1e293b, #0f172a)',
      border: '2px solid var(--accent-green)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-lg)',
      boxShadow: '0 8px 32px rgba(129, 182, 74, 0.3), 0 0 60px rgba(129, 182, 74, 0.1)',
      animation: 'slideInRight 0.4s ease-out',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
        <div style={{
          width: '48px', height: '48px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent-green), var(--accent-blue))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '22px', color: 'white', fontWeight: 'bold',
          flexShrink: 0
        }}>
          {globalChallenge.username?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '16px', color: '#e2e8f0' }}>⚔️ Challenge Received!</div>
          <div style={{ fontSize: '14px', color: '#94a3b8' }}>
            <strong style={{ color: 'var(--accent-green)' }}>{globalChallenge.username}</strong> ({globalChallenge.rating}) wants to play
          </div>
        </div>
      </div>

      {globalChallenge.note && (
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          padding: '8px 12px',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-md)',
          fontStyle: 'italic',
          color: '#94a3b8',
          fontSize: '13px',
          borderLeft: '3px solid var(--accent-green)'
        }}>
          "{globalChallenge.note}"
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleAccept}
          style={{ flex: 1, fontWeight: 700, padding: '10px' }}
        >
          ✅ Accept
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={declineGlobalChallenge}
          style={{ flex: 1, padding: '10px' }}
        >
          ✕ Decline
        </button>
      </div>
    </div>
  );
}
