'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { useRouter } from 'next/navigation';
import AppShell from '../components/AppShell';

export default function HistoryPage() {
  const { user, token } = useAuth();
  const router = useRouter();

  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterOpponent, setFilterOpponent] = useState('');
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPgn, setImportPgn] = useState('');
  const [importPlatform, setImportPlatform] = useState('chess.com');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchGames();
  }, [token, filterPlatform, filterOpponent]);

  const fetchGames = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (filterPlatform !== 'all') query.append('platform', filterPlatform);
      if (filterOpponent) query.append('opponent', filterOpponent);

      const res = await fetch(`/api/games/history?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.games) {
        setGames(data.games);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importPgn) return;
    setImporting(true);
    try {
      const res = await fetch('/api/games/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ pgn: importPgn, platform: importPlatform })
      });
      if (res.ok) {
        setShowImportModal(false);
        setImportPgn('');
        fetchGames();
      } else {
        const data = await res.json();
        alert(data.error || 'Import failed');
      }
    } catch (err) {
      console.error(err);
      alert('Import failed');
    } finally {
      setImporting(false);
    }
  };

  if (!user) {
    return (
      <AppShell title="Game History">
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Please log in to view your history.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Game History">
      <style>{`
        .history-table th {
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          font-weight: 600;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-medium);
        }
        .history-row {
          transition: background var(--transition-fast);
          border-bottom: 1px solid var(--border-subtle);
        }
        .history-row:hover {
          background: var(--bg-card-hover);
        }
        .history-row td {
          padding: 16px 20px;
          vertical-align: middle;
        }
        .player-badge {
          display: inline-block;
          width: 14px;
          height: 14px;
          border-radius: 3px;
          margin-right: 10px;
        }
        .player-white {
          background: #f8f9fa;
          border: 1px solid #ced4da;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        .player-black {
          background: #212529;
          border: 1px solid #000;
          box-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }
        .platform-badge {
          padding: 4px 10px;
          border-radius: var(--radius-full);
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          border: 1px solid var(--border-subtle);
        }
        .platform-chesscom { background: rgba(118, 150, 86, 0.15); color: #81b64a; border-color: rgba(129, 182, 74, 0.3); }
        .platform-lichess { background: rgba(255, 255, 255, 0.05); color: #e2e8f0; }
        .platform-local { background: rgba(92, 158, 230, 0.1); color: var(--accent-blue); border-color: rgba(92, 158, 230, 0.2); }
      `}</style>
      <div className="container" style={{ padding: '0 20px 40px', maxWidth: '1100px', margin: '0 auto', animation: 'fadeIn 0.5s ease-out' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px', background: 'linear-gradient(90deg, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Game History
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>Review and analyze your past games from all platforms.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowImportModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '18px' }}>📥</span> Import Game
          </button>
        </div>

        <div className="card" style={{ padding: '24px', marginBottom: '32px', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Platform Filter</label>
            <div style={{ position: 'relative' }}>
              <select 
                className="input" 
                value={filterPlatform} 
                onChange={e => setFilterPlatform(e.target.value)}
                style={{ width: '100%', appearance: 'none', paddingRight: '40px', background: 'var(--bg-dark)', border: '1px solid var(--border-subtle)' }}
              >
                <option value="all">All Platforms</option>
                <option value="local">Local</option>
                <option value="chess.com">Chess.com</option>
                <option value="lichess">Lichess</option>
              </select>
              <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>▼</span>
            </div>
          </div>
          
          <div style={{ flex: 2, minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Opponent Search</label>
            <input 
              type="text" 
              className="input" 
              placeholder="Search by opponent username..." 
              value={filterOpponent}
              onChange={e => setFilterOpponent(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-subtle)' }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'inline-block', width: '30px', height: '30px', border: '3px solid var(--border-medium)', borderTopColor: 'var(--accent-green)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <div style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Loading your games...</div>
          </div>
        ) : games.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-medium)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>♟️</div>
            <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>No games found</h3>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
              We couldn't find any games matching your filters. Try importing a game or adjusting your search.
            </p>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden', padding: 0, border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-lg)', background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="history-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
                  <tr>
                    <th>Players</th>
                    <th>Result</th>
                    <th>Accuracy</th>
                    <th>Platform</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map(game => {
                    const whiteName = game.whitePlayer ? game.whitePlayer.username : (game.externalWhite || 'Unknown');
                    const blackName = game.blackPlayer ? game.blackPlayer.username : (game.externalBlack || 'Unknown');
                    const isWhite = game.whitePlayer && game.whitePlayer._id === user.id;
                    const isBlack = game.blackPlayer && game.blackPlayer._id === user.id;
                    
                    let resultText = game.result;
                    let resultColor = 'var(--text-secondary)';
                    if (game.result === '1-0') {
                      resultText = 'White Won';
                      resultColor = isWhite ? 'var(--accent-green)' : (isBlack ? 'var(--accent-red)' : 'var(--text-primary)');
                    } else if (game.result === '0-1') {
                      resultText = 'Black Won';
                      resultColor = isBlack ? 'var(--accent-green)' : (isWhite ? 'var(--accent-red)' : 'var(--text-primary)');
                    } else if (game.result === '1/2-1/2') {
                      resultText = 'Draw';
                      resultColor = 'var(--text-muted)';
                    }

                    const myAcc = game.analysisReport ? (isWhite ? game.analysisReport.whiteAccuracy : (isBlack ? game.analysisReport.blackAccuracy : null)) : null;

                    let platformClass = 'platform-local';
                    if (game.platform === 'chess.com') platformClass = 'platform-chesscom';
                    if (game.platform === 'lichess') platformClass = 'platform-lichess';

                    return (
                      <tr key={game._id} className="history-row">
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                            <span className="player-badge player-white"></span>
                            <span style={{ fontWeight: isWhite ? '700' : '400', color: isWhite ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{whiteName}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span className="player-badge player-black"></span>
                            <span style={{ fontWeight: isBlack ? '700' : '400', color: isBlack ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{blackName}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: '700', color: resultColor, padding: '4px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                            {resultText}
                          </span>
                        </td>
                        <td>
                          {myAcc !== null ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(129, 182, 74, 0.1)', color: 'var(--accent-green)', borderRadius: 'var(--radius-full)', fontSize: '13px', fontWeight: '600' }}>
                              🎯 {myAcc}%
                            </span>
                          ) : (
                            <span style={{ color: 'var(--border-medium)', paddingLeft: '14px' }}>—</span>
                          )}
                        </td>
                        <td>
                          <span className={`platform-badge ${platformClass}`}>
                            {game.platform}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                          {new Date(game.endedAt || game.startedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="btn btn-secondary"
                            onClick={() => router.push(`/analyze?gameId=${game._id}`)}
                            style={{ padding: '8px 16px', fontSize: '13px', borderRadius: 'var(--radius-full)', background: 'var(--bg-dark)' }}
                          >
                            🔍 Analyze
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showImportModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--bg-overlay)', backdropFilter: 'var(--glass-blur)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, animation: 'fadeIn 0.2s ease-out'
          }}>
            <div className="card" style={{ padding: '32px', width: '100%', maxWidth: '500px', background: 'var(--bg-card)', border: '1px solid var(--border-medium)', boxShadow: 'var(--shadow-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 'bold' }}>Import Game</h2>
                <button onClick={() => setShowImportModal(false)} style={{ color: 'var(--text-muted)', fontSize: '20px' }}>&times;</button>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: 'var(--text-secondary)' }}>Source Platform</label>
                <select className="input" style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-subtle)' }} value={importPlatform} onChange={e => setImportPlatform(e.target.value)}>
                  <option value="chess.com">Chess.com</option>
                  <option value="lichess">Lichess</option>
                  <option value="local">Other PGN</option>
                </select>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: 'var(--text-secondary)' }}>Paste PGN Text</label>
                <textarea 
                  className="input" 
                  style={{ width: '100%', minHeight: '180px', background: 'var(--bg-dark)', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '13px', resize: 'vertical' }} 
                  value={importPgn} 
                  onChange={e => setImportPgn(e.target.value)}
                  placeholder="[Event &quot;Live Chess&quot;]&#10;[Site &quot;Chess.com&quot;]&#10;[Date &quot;2024.01.01&quot;]&#10;&#10;1. e4 e5 2. Nf3 Nc6..."
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={() => setShowImportModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleImport} disabled={importing || !importPgn}>
                  {importing ? 'Importing...' : 'Import Game'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
