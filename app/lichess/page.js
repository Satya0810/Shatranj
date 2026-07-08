'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchLichessUser, fetchLichessGames } from '../lib/lichessDatabase';
import AppShell from '../components/AppShell';
import Link from 'next/link';

function LichessDatabaseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialUsername = searchParams.get('user') || '';
  
  const [username, setUsername] = useState(initialUsername);
  const [searchInput, setSearchInput] = useState(initialUsername);
  const [userProfile, setUserProfile] = useState(null);
  const [recentGames, setRecentGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (username) {
      loadUserData(username);
    }
  }, [username]);

  async function loadUserData(uname) {
    setLoading(true);
    setError(null);
    setUserProfile(null);
    setRecentGames([]);
    
    try {
      const profile = await fetchLichessUser(uname);
      setUserProfile(profile);
      
      const games = await fetchLichessGames(uname, 12);
      setRecentGames(games);
    } catch (err) {
      setError(err.message === 'User not found' ? `Lichess user "${uname}" not found.` : 'Failed to fetch data from Lichess.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    
    router.push(`/lichess?user=${encodeURIComponent(searchInput.trim())}`);
    setUsername(searchInput.trim());
  };

  const renderRating = (perf, name) => {
    if (!perf || !perf.games) return null;
    return (
      <div style={{ padding: '12px', background: 'var(--bg-surface-hover)', borderRadius: '8px', textAlign: 'center', flex: 1 }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px', textTransform: 'uppercase', marginBottom: '4px' }}>{name}</div>
        <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{perf.rating}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{perf.games} games</div>
      </div>
    );
  };

  const getResultBadge = (game, pColor) => {
    if (!game.winner) return <span style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-surface)', fontSize: '12px', fontWeight: 600 }}>½-½ Draw</span>;
    const isWin = game.winner === pColor;
    if (isWin) return <span style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(129, 182, 74, 0.2)', color: 'var(--accent-green)', fontSize: '12px', fontWeight: 600 }}>1-0 Victory</span>;
    return <span style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(235, 87, 87, 0.2)', color: 'var(--accent-red)', fontSize: '12px', fontWeight: 600 }}>0-1 Defeat</span>;
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
        <h1 style={{ fontSize: '32px', marginBottom: 'var(--space-sm)' }}>Lichess Database Explorer</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>Search for any Lichess player to view their profile and analyze their games.</p>
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', maxWidth: '600px', margin: '0 auto var(--space-xl)' }}>
        <input
          type="text"
          className="input"
          placeholder="Enter Lichess username (e.g. DrNykterstein)"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{ flex: 1, fontSize: '16px', padding: '12px 16px' }}
        />
        <button type="submit" className="btn btn-primary" style={{ padding: '0 24px', fontSize: '16px' }} disabled={loading}>
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
                {userProfile.title ? <span style={{ color: 'var(--accent-gold)', fontWeight: 800, fontSize: '24px' }}>{userProfile.title}</span> : '♟️'}
              </div>
              <div>
                <h2 style={{ fontSize: '28px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {userProfile.username}
                  {userProfile.online && <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block', boxShadow: '0 0 8px var(--accent-green)' }}></span>}
                </h2>
                <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {userProfile.profile?.bio || 'No bio provided'}
                </div>
                <div style={{ marginTop: '8px', fontSize: '13px', display: 'flex', gap: '16px' }}>
                  <a href={userProfile.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>
                    View on Lichess ↗
                  </a>
                </div>
              </div>
            </div>
            
            <div style={{ padding: 'var(--space-lg)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {renderRating(userProfile.perfs?.blitz, 'Blitz')}
              {renderRating(userProfile.perfs?.rapid, 'Rapid')}
              {renderRating(userProfile.perfs?.bullet, 'Bullet')}
              {renderRating(userProfile.perfs?.classical, 'Classical')}
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
                const isWhite = game.players.white.user?.id === userProfile.id;
                const playerColor = isWhite ? 'white' : 'black';
                
                return (
                  <div key={game.id} className="card" style={{ display: 'flex', flexDirection: 'column', transition: 'transform 0.2s', ':hover': { transform: 'translateY(-2px)' } }}>
                    <div style={{ padding: 'var(--space-md)', flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                          {game.perf} • {game.speed}
                        </span>
                        {getResultBadge(game, playerColor)}
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: isWhite ? 700 : 400, color: isWhite ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            ⚪ {game.players.white.user?.name || 'Anonymous'}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>{game.players.white.rating}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: !isWhite ? 700 : 400, color: !isWhite ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            ⚫ {game.players.black.user?.name || 'Anonymous'}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>{game.players.black.rating}</span>
                        </div>
                      </div>
                      
                      {game.opening && (
                        <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          {game.opening.name}
                        </div>
                      )}
                    </div>
                    
                    <div style={{ padding: '12px var(--space-md)', borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface-hover)', borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)' }}>
                      <Link href={`/analyze?lichessGameId=${game.id}&orientation=${playerColor}`} className="btn btn-secondary" style={{ width: '100%', textAlign: 'center', padding: '8px' }}>
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
  );
}

export default function LichessDatabasePage() {
  return (
    <AppShell title="Lichess Explorer">
      <Suspense fallback={<div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>Loading Explorer...</div>}>
        <LichessDatabaseContent />
      </Suspense>
    </AppShell>
  );
}
