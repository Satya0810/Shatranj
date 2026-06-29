'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthContext';
import ProfileModal from './ProfileModal';

const navItems = [
  {
    section: 'Play',
    items: [
      { href: '/', icon: '🏠', label: 'Home' },
      { href: '/play/computer', icon: '🤖', label: 'vs Computer' },
      { href: '/play/local', icon: '👥', label: 'Play Friend' },
      { href: '/play/online', icon: '🌐', label: 'Play Online', badge: 'Live' },
    ],
  },
  {
    section: 'Learn',
    items: [
      { href: '/puzzles', icon: '🧩', label: 'Puzzles', badge: 'New' },
      { href: '/analyze', icon: '📊', label: 'Analysis Board' },
    ],
  },
  {
    section: 'Community',
    items: [
      { href: '/watch', icon: '🏆', label: 'Leaderboard' },
      { href: '/watch', icon: '📰', label: 'Watch Live' },
      { href: '/lichess', icon: '🔍', label: 'Lichess Database', badge: 'Hot' },
      { href: '/chesscom', icon: '♟️', label: 'Chess.com Database', badge: 'New' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const { user, loading, openAuthModal, logout } = useAuth();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="modal-overlay"
          style={{ zIndex: 99 }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile menu button (rendered in header) */}
      <button
        className="mobile-menu-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
        id="mobile-menu-toggle"
      >
        {isOpen ? '✕' : '☰'}
      </button>

      <aside className={`sidebar ${isOpen ? 'open' : ''}`} id="main-sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">♞</div>
          <div className="logo-text">
            Chess<span>Master</span>
          </div>
        </div>

        <nav className="sidebar-nav" id="sidebar-navigation">
          {navItems.map((section) => (
            <div className="nav-section" key={section.section}>
              <div className="nav-section-title">{section.section}</div>
              {section.items.map((item) => (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                  onClick={() => setIsOpen(false)}
                  id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* User Profile / Sign In Section */}
        <div style={{ padding: 'var(--space-md)', borderTop: '1px solid var(--border-subtle)' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-md)' }}>
              <div className="spinner" style={{ width: '20px', height: '20px', margin: '0 auto' }} />
            </div>
          ) : user ? (
            <div style={{
              padding: 'var(--space-md)',
              background: 'rgba(129, 182, 74, 0.08)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-sm)',
                  marginBottom: 'var(--space-sm)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: 'var(--radius-sm)',
                }}
                onClick={() => setShowProfile(true)}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {user.avatar ? (
                  <img src={user.avatar} alt={user.username} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent-green), var(--accent-blue))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: 700,
                    color: 'white',
                  }}>
                    {user.username[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{user.username}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    ⭐ {user.rating} • {user.gamesPlayed} games
                  </div>
                </div>
              </div>
              <button
                onClick={logout}
                style={{
                  width: '100%',
                  padding: '6px',
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={openAuthModal}
              style={{
                width: '100%',
                padding: 'var(--space-md)',
                background: 'linear-gradient(135deg, var(--accent-green), #6ab04c)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: 'white',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              🔑 Sign In / Sign Up
            </button>
          )}
        </div>
      </aside>

      {showProfile && user && (
        <ProfileModal username={user.username} onClose={() => setShowProfile(false)} />
      )}
    </>
  );
}

