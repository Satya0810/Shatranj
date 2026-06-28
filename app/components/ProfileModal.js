import { useState, useEffect } from 'react';

export default function ProfileModal({ username, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch(`/api/users/${username}`);
        if (!res.ok) {
          throw new Error('Failed to load profile');
        }
        const data = await res.json();
        setProfile(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    if (username) {
      fetchProfile();
    }
  }, [username]);

  if (!username) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: 2000 }} />
      <div className="modal" style={{ zIndex: 2001, maxWidth: '450px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <button 
          className="modal-close" 
          onClick={onClose}
          style={{ position: 'absolute', top: 15, right: 15, background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)' }}
        >
          &times;
        </button>

        {loading ? (
          <div style={{ padding: 'var(--space-2xl)', textAlign: 'center' }}>
            <div className="spinner" style={{ width: '30px', height: '30px', margin: '0 auto var(--space-md)' }} />
            <div style={{ color: 'var(--text-muted)' }}>Loading profile...</div>
          </div>
        ) : error ? (
          <div style={{ padding: 'var(--space-2xl)', textAlign: 'center', color: 'var(--accent-red)' }}>
            {error}
          </div>
        ) : profile && (
          <div style={{ padding: 'var(--space-xl)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
              {profile.avatar ? (
                <img 
                  src={profile.avatar} 
                  alt={profile.username} 
                  style={{ width: '96px', height: '96px', borderRadius: '50%', objectFit: 'cover', marginBottom: 'var(--space-md)', border: '3px solid var(--border-color)' }} 
                />
              ) : (
                <div style={{ 
                  width: '96px', height: '96px', borderRadius: '50%', backgroundColor: 'var(--accent-blue)', 
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  fontSize: '40px', fontWeight: 'bold', marginBottom: 'var(--space-md)', border: '3px solid var(--border-color)'
                }}>
                  {profile.username.charAt(0).toUpperCase()}
                </div>
              )}
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>{profile.username}</h2>
              <div style={{ display: 'inline-block', background: 'var(--bg-surface)', padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: '14px', fontWeight: 600, color: 'var(--accent-green)', marginTop: '8px' }}>
                <span style={{ marginRight: '4px' }}>🏆</span> {profile.rating}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
              <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{profile.gamesPlayed}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Games</div>
              </div>
              <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-green)' }}>
                  {profile.gamesPlayed > 0 ? Math.round((profile.wins / profile.gamesPlayed) * 100) : 0}%
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Win Rate</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-surface)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-xl)' }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-green)' }}>{profile.wins}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Wins</div>
              </div>
              <div style={{ textAlign: 'center', flex: 1, borderLeft: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-secondary)' }}>{profile.draws}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Draws</div>
              </div>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-red)' }}>{profile.losses}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Losses</div>
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', marginBottom: 'var(--space-2xl)' }}>
              Joined {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>

            {profile.recentGames && profile.recentGames.length > 0 && (
              <div style={{ marginBottom: 'var(--space-xl)' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: 'var(--space-md)' }}>Recent Games</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {profile.recentGames.map((game, i) => {
                    const isWhite = game.whitePlayer?.username === profile.username;
                    const opponent = isWhite ? game.blackPlayer : game.whitePlayer;
                    const win = (isWhite && game.result === '1-0') || (!isWhite && game.result === '0-1');
                    const draw = game.result === '1/2-1/2';
                    const resultColor = win ? 'var(--accent-green)' : (draw ? 'var(--text-secondary)' : 'var(--accent-red)');
                    
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: resultColor }} />
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 600 }}>vs {opponent?.username || 'Unknown'}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{isWhite ? 'White' : 'Black'} • {game.timeControl?.minutes || 10} min</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: resultColor }}>{win ? 'Win' : (draw ? 'Draw' : 'Loss')}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{game.resultReason}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {profile.recentPuzzles && profile.recentPuzzles.length > 0 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: 'var(--space-md)' }}>Recent Puzzles</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {profile.recentPuzzles.map((puzzle, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: puzzle.isCorrect ? 'var(--accent-green)' : 'var(--accent-red)' }} />
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600 }}>Puzzle #{puzzle.puzzleId}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Rating {puzzle.rating}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: puzzle.isCorrect ? 'var(--accent-green)' : 'var(--accent-red)' }}>{puzzle.isCorrect ? 'Solved' : 'Failed'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{puzzle.timeTaken}s</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
