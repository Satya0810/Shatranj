'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchChesscomUser, fetchChesscomStats, fetchChesscomGames } from '../lib/chesscomDatabase';
import AppShell from '../components/AppShell';
import Link from 'next/link';

export default function ChesscomDatabasePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialUsername = searchParams.get('user') || '';
  
  const [username, setUsername] = useState(initialUsername);
  const [searchInput, setSearchInput] = useState(initialUsername);
  const [userProfile, setUserProfile] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [recentGames, setRecentGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (username) {
      loadUserData(username);
    }
  }, [username]);

  const loadUserData = async (uname) => {
    setLoading(true);
    setError(null);
    setUserProfile(null);
    setUserStats(null);
    setRecentGames([]);
    
    try {
      const profile = await fetchChesscomUser(uname);
      setUserProfile(profile);
      
      const stats = await fetchChesscomStats(uname);
      setUserStats(stats);
      
      const games = await fetchChesscomGames(uname, 12);
      setRecentGames(games);
    } catch (err) {
      setError(err.message === 'User not found' ? `Chess.com user "${uname}" not found.` : 'Failed to fetch data from Chess.com.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    
    router.push(`/chesscom?user=${encodeURIComponent(searchInput.trim())}`);
    setUsername(searchInput.trim());
  };

  const renderRating = (statObj, name) => {
    if (!statObj || !statObj.last) return null;
    return (
      <div style={{ padding: '12px', background: 'var(--bg-surface-hover)', borderRadius: '8px', textAlign: 'center', flex: 1 }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px', textTransform: 'uppercase', marginBottom: '4px' }}>{name}</div>
        <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{statObj.last.rating}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{statObj.record?.win + statObj.record?.loss + statObj.record?.draw || 0} games</div>
      </div>
    );
  };

  const getResultBadge = (resultCode) => {
    if (['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'].includes(resultCode)) {
      return <span style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-surface)', fontSize: '12px', fontWeight: 600 }}>½-½ Draw</span>;
    }
    if (resultCode === 'win') {
      return <span style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(129, 182, 74, 0.2)', color: 'var(--accent-green)', fontSize: '12px', fontWeight: 600 }}>1-0 Victory</span>;
    }
    return <span style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(235, 87, 87, 0.2)', color: 'var(--accent-red)', fontSize: '12px', fontWeight: 600 }}>0-1 Defeat</span>;
  };

  return (
    <AppShell title="Chess.com Explorer">
      <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
          <h1 style={{ fontSize: '32px', marginBottom: 'var(--space-sm)' }}>Chess.com Database Explorer</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>Search for any Chess.com player to view their profile and analyze their games.</p>
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', maxWidth: '600px', margin: '0 auto var(--space-xl)' }}>
          <input
            type="text"
            className="input"
            placeholder="Enter Chess.com username (e.g. Hikaru)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ flex: 1, fontSize: '16px', padding: '12px 16px' }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '0 24px', fontSize: '16px', background: 'var(--accent-green)', borderColor: 'var(--accent-green)' }} disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && (
          <div style={{ padding: 'var(--space-md)', background: 'rgba(235, 87, 87, 0.1)', color: 'var(--accent-red)', borderRadius: 'var(--radius-md)', textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
            {error}
          </div>
        )}

        {userProfile && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className="card" style={{ marginBottom: 'var(--space-xl)', overflow: 'hidden' }}>
              <div style={{ background: 'var(--bg-surface-hover)', padding: 'var(--space-lg)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '24px' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '16px', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', border: '1px solid var(--border-color)' }}>
                  {userProfile.avatar ? (
                    <img src={userProfile.avatar} alt={userProfile.username} style={{ width: '100%', height: '100%', borderRadius: '16px', objectFit: 'cover' }} />
                  ) : (
                    userProfile.title ? <span style={{ color: 'var(--accent-gold)', fontWeight: 800, fontSize: '24px' }}>{userProfile.title}</span> : '♟️'
                  )}
                </div>
                <div>
                  <h2 style={{ fontSize: '28px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {userProfile.username}
                  </h2>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {userProfile.location || 'Unknown Location'}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '13px', display: 'flex', gap: '16px' }}>
                    <a href={userProfile.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-green)', textDecoration: 'none' }}>
                      View on Chess.com ↗
                    </a>
                  </div>
                </div>
              </div>
              
              <div style={{ padding: 'var(--space-lg)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {userStats && renderRating(userStats.chess_blitz, 'Blitz')}
                {userStats && renderRating(userStats.chess_rapid, 'Rapid')}
                {userStats && renderRating(userStats.chess_bullet, 'Bullet')}
                {userStats && renderRating(userStats.chess_daily, 'Daily')}
              </div>
            </div>

            <h3 style={{ fontSize: '24px', marginBottom: 'var(--space-md)' }}>Recent Games</h3>
            
            {recentGames.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)' }}>
                No recent games found.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-md)' }}>
                {recentGames.map(game => {
                  const isWhite = game.white.username.toLowerCase() === userProfile.username.toLowerCase();
                  const playerColor = isWhite ? 'white' : 'black';
                  const resultCode = isWhite ? game.white.result : game.black.result;
                  
                  return (
                    <div key={game.url} className="card" style={{ display: 'flex', flexDirection: 'column', transition: 'transform 0.2s', ':hover': { transform: 'translateY(-2px)' } }}>
                      <div style={{ padding: 'var(--space-md)', flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                            {game.time_class} • {game.rules}
                          </span>
                          {getResultBadge(resultCode)}
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: isWhite ? 700 : 400, color: isWhite ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                              ⚪ {game.white.username}
                            </span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>{game.white.rating}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: !isWhite ? 700 : 400, color: !isWhite ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                              ⚫ {game.black.username}
                            </span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>{game.black.rating}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div style={{ padding: '12px var(--space-md)', borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface-hover)', borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)' }}>
                        <Link href={`/analyze?pgn=${encodeURIComponent(game.pgn)}&orientation=${playerColor}`} className="btn btn-secondary" style={{ width: '100%', textAlign: 'center', padding: '8px' }}>
                          Analyze Game 🔍
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
