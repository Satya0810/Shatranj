'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import ChessGame from './ChessGame';
import MoveList from './MoveList';
import GameOverModal from './GameOverModal';
import { useAuth } from './AuthContext';
import ProfileModal from './ProfileModal';
import { getSocket, disconnectSocket } from '../lib/socket';

const TIME_CONTROLS = [
  { label: '1 min', minutes: 1, increment: 0, icon: '⚡' },
  { label: '3 min', minutes: 3, increment: 0, icon: '⚡' },
  { label: '3+2', minutes: 3, increment: 2, icon: '⚡' },
  { label: '5 min', minutes: 5, increment: 0, icon: '🔥' },
  { label: '5+3', minutes: 5, increment: 3, icon: '🔥' },
  { label: '10 min', minutes: 10, increment: 0, icon: '⏱️' },
  { label: '10+5', minutes: 10, increment: 5, icon: '⏱️' },
  { label: '15+10', minutes: 15, increment: 10, icon: '🐢' },
  { label: '30 min', minutes: 30, increment: 0, icon: '🐢' },
];

export default function PlayOnline() {
  const { user, token, openAuthModal } = useAuth();
  const [phase, setPhase] = useState('setup'); // 'setup' | 'searching' | 'playing' | 'gameover'
  const [game, setGame] = useState(new Chess());
  const [history, setHistory] = useState([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [gameResult, setGameResult] = useState(null);
  const [highlightSquares, setHighlightSquares] = useState({});
  const [boardWidth, setBoardWidth] = useState(560);
  const [orientation, setOrientation] = useState('white');
  const [opponent, setOpponent] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [selectedTC, setSelectedTC] = useState(5); // default 10 min
  const [whiteTime, setWhiteTime] = useState(600000);
  const [blackTime, setBlackTime] = useState(600000);
  const [drawOffered, setDrawOffered] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const socketRef = useRef(null);
  const searchIntervalRef = useRef(null);

  const [showProfileUsername, setShowProfileUsername] = useState(null);
  const clockIntervalRef = useRef(null);
  const lastMoveTimeRef = useRef(null);

  // Responsive board sizing
  useEffect(() => {
    const updateSize = () => {
      const padding = window.innerWidth <= 1024 ? 32 : 120;
      const maxHeight = window.innerHeight - 180;
      const maxWidth = window.innerWidth <= 1024
        ? window.innerWidth - padding
        : Math.min(window.innerWidth * 0.55, 640);
      setBoardWidth(Math.min(maxWidth, maxHeight));
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
      disconnectSocket();
    };
  }, []);

  // Clock tick
  useEffect(() => {
    if (phase !== 'playing') {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
      return;
    }

    clockIntervalRef.current = setInterval(() => {
      if (!lastMoveTimeRef.current) return;
      const elapsed = Date.now() - lastMoveTimeRef.current;
      const isMyTurn = (game.turn() === 'w' && orientation === 'white') || (game.turn() === 'b' && orientation === 'black');
      
      // Only tick the active player's clock locally for display purposes
      if (game.turn() === 'w') {
        setWhiteTime(prev => {
          const newTime = Math.max(0, prev - 100);
          return newTime;
        });
      } else {
        setBlackTime(prev => {
          const newTime = Math.max(0, prev - 100);
          return newTime;
        });
      }
    }, 100);

    return () => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    };
  }, [phase, game, orientation]);

  const formatTime = (ms) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const startSearching = useCallback(() => {
    if (!user) {
      openAuthModal();
      return;
    }

    const socket = getSocket();
    socketRef.current = socket;
    setPhase('searching');
    setSearchTime(0);

    searchIntervalRef.current = setInterval(() => {
      setSearchTime(prev => prev + 1);
    }, 1000);

    const tc = TIME_CONTROLS[selectedTC];

    socket.emit('join-lobby', {
      userId: user.id,
      username: user.username,
      rating: user.rating,
      timeControl: { minutes: tc.minutes, increment: tc.increment },
    });

    // Listen for game start
    socket.on('game-start', (data) => {
      if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
      
      setGameId(data.gameId);
      setOrientation(data.color);
      setOpponent(data.opponent);
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      setGame(new Chess());
      setHistory([]);
      setCurrentMoveIndex(-1);
      setPhase('playing');
      lastMoveTimeRef.current = Date.now();
    });

    // Listen for moves
    socket.on('move-made', (data) => {
      setGame(prev => {
        const newGame = new Chess(data.fen);
        return newGame;
      });
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      lastMoveTimeRef.current = Date.now();

      // Update history
      const tempGame = new Chess();
      const newHistory = [];
      const gameCopy = new Chess(data.fen);
      // Rebuild history from PGN
      const pgnMoves = gameCopy.history({ verbose: true });
      // We can't easily get full history from just FEN, so we track it ourselves
      setHistory(prev => {
        const move = data.move;
        return [...prev, move];
      });
      setCurrentMoveIndex(prev => prev + 1);
    });

    // Listen for game over
    socket.on('game-over', (data) => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);

      let result;
      if (data.winner === null) {
        result = { result: 'draw', winner: null };
      } else {
        result = {
          result: data.reason,
          winner: data.winner,
        };
      }
      setGameResult(result);
      setPhase('gameover');
    });

    // Listen for draw offers
    socket.on('draw-offered', () => {
      setDrawOffered(true);
    });

    socket.on('draw-declined', () => {
      // Could show a notification
    });

  }, [user, openAuthModal, selectedTC]);

  const cancelSearch = useCallback(() => {
    if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
    const socket = socketRef.current;
    if (socket) {
      socket.emit('leave-lobby', {});
    }
    setPhase('setup');
    setSearchTime(0);
  }, []);

  const onMove = useCallback((move) => {
    if (phase !== 'playing') return;

    // Verify it's our turn
    const isOurTurn = (game.turn() === 'w' && orientation === 'white') || (game.turn() === 'b' && orientation === 'black');
    if (!isOurTurn) return;

    const socket = socketRef.current;
    if (socket && gameId) {
      socket.emit('move', {
        gameId,
        move: { from: move.from, to: move.to, promotion: move.promotion },
      });
    }

    setHighlightSquares({
      [move.from]: { background: 'rgba(129, 182, 74, 0.4)' },
      [move.to]: { background: 'rgba(129, 182, 74, 0.4)' },
    });
  }, [phase, game, orientation, gameId]);

  const handleResign = useCallback(() => {
    if (!gameId || !socketRef.current) return;
    if (confirm('Are you sure you want to resign?')) {
      socketRef.current.emit('resign', { gameId });
    }
  }, [gameId]);

  const handleOfferDraw = useCallback(() => {
    if (!gameId || !socketRef.current) return;
    socketRef.current.emit('offer-draw', { gameId });
  }, [gameId]);

  const handleAcceptDraw = useCallback(() => {
    if (!gameId || !socketRef.current) return;
    socketRef.current.emit('accept-draw', { gameId });
    setDrawOffered(false);
  }, [gameId]);

  const handleDeclineDraw = useCallback(() => {
    if (!gameId || !socketRef.current) return;
    socketRef.current.emit('decline-draw', { gameId });
    setDrawOffered(false);
  }, [gameId]);

  const playAgain = useCallback(() => {
    setPhase('setup');
    setGame(new Chess());
    setHistory([]);
    setCurrentMoveIndex(-1);
    setGameResult(null);
    setOpponent(null);
    setGameId(null);
    setDrawOffered(false);
    disconnectSocket();
    socketRef.current = null;
  }, []);

  // SETUP PHASE - Time control selection
  if (phase === 'setup') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 'calc(100vh - 60px)',
        padding: 'var(--space-xl)',
      }}>
        <div style={{ maxWidth: '500px', width: '100%' }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{
              padding: 'var(--space-xl)',
              textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(129, 182, 74, 0.15), rgba(96, 165, 250, 0.15))',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <div style={{ fontSize: '48px', marginBottom: 'var(--space-sm)' }}>🌐</div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Play Online</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Find an opponent and play in real-time
              </p>
              {user && (
                <div style={{
                  marginTop: 'var(--space-md)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-sm)',
                  padding: '6px 16px',
                  background: 'rgba(129, 182, 74, 0.15)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '13px',
                  fontWeight: 600,
                }}>
                  <span>👤 {user.username}</span>
                  <span className="badge badge-gold">{user.rating}</span>
                </div>
              )}
            </div>

            <div style={{ padding: 'var(--space-xl)' }}>
              <div style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-md)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Select Time Control
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 'var(--space-sm)',
                marginBottom: 'var(--space-xl)',
              }}>
                {TIME_CONTROLS.map((tc, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedTC(idx)}
                    style={{
                      padding: 'var(--space-md)',
                      background: selectedTC === idx
                        ? 'linear-gradient(135deg, var(--accent-green), #6ab04c)'
                        : 'var(--bg-surface)',
                      border: selectedTC === idx
                        ? '2px solid var(--accent-green)'
                        : '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      color: selectedTC === idx ? 'white' : 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    <div style={{ fontSize: '18px', marginBottom: '2px' }}>{tc.icon}</div>
                    {tc.label}
                  </button>
                ))}
              </div>

              <button
                className="btn btn-primary"
                onClick={startSearching}
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, var(--accent-green), #6ab04c)',
                }}
              >
                {user ? '🎮 Find Opponent' : '🔑 Sign In to Play'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SEARCHING PHASE
  if (phase === 'searching') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 'calc(100vh - 60px)',
        padding: 'var(--space-xl)',
      }}>
        <div className="card" style={{
          maxWidth: '400px',
          width: '100%',
          textAlign: 'center',
          padding: 'var(--space-2xl)',
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            border: '4px solid var(--border-color)',
            borderTop: '4px solid var(--accent-green)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto var(--space-xl)',
          }} />
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
            Finding Opponent...
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 'var(--space-md)' }}>
            {TIME_CONTROLS[selectedTC].label} • {user?.rating || 1200} rating
          </p>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '32px',
            fontWeight: 700,
            color: 'var(--accent-green)',
            marginBottom: 'var(--space-xl)',
          }}>
            {Math.floor(searchTime / 60)}:{(searchTime % 60).toString().padStart(2, '0')}
          </div>
          <button
            className="btn btn-secondary"
            onClick={cancelSearch}
            style={{ width: '100%' }}
          >
            ✕ Cancel
          </button>
        </div>
      </div>
    );
  }

  // PLAYING PHASE
  return (
    <div className="play-layout" id="play-online-layout">
      <div className="board-section">
        {/* Opponent info bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-sm)',
          border: '1px solid var(--border-subtle)',
        }}>
          <div 
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: opponent?.username ? 'pointer' : 'default' }}
            onClick={() => opponent?.username && setShowProfileUsername(opponent.username)}
          >
            <span style={{ fontSize: '20px' }}>👤</span>
            <span style={{ fontWeight: 600 }}>{opponent?.username || 'Opponent'}</span>
            <span className="badge badge-gold" style={{ fontSize: '11px' }}>{opponent?.rating || '?'}</span>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '20px',
            fontWeight: 700,
            padding: '4px 12px',
            borderRadius: 'var(--radius-md)',
            background: (orientation === 'white' ? blackTime : whiteTime) <= 30000
              ? 'rgba(224, 90, 90, 0.2)' : 'var(--bg-surface)',
            color: (orientation === 'white' ? blackTime : whiteTime) <= 30000
              ? 'var(--accent-red)' : 'var(--text-primary)',
          }}>
            {formatTime(orientation === 'white' ? blackTime : whiteTime)}
          </div>
        </div>

        <ChessGame
          game={game}
          onMove={onMove}
          boardWidth={boardWidth}
          orientation={orientation}
          allowMoves={phase === 'playing'}
          highlightSquares={highlightSquares}
        />

        {/* Your info bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          marginTop: 'var(--space-sm)',
          border: '1px solid var(--border-subtle)',
        }}>
          <div 
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: user?.username ? 'pointer' : 'default' }}
            onClick={() => user?.username && setShowProfileUsername(user.username)}
          >
            <span style={{ fontSize: '20px' }}>👤</span>
            <span style={{ fontWeight: 600 }}>{user?.username || 'You'}</span>
            <span className="badge badge-green" style={{ fontSize: '11px' }}>{user?.rating || '?'}</span>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '20px',
            fontWeight: 700,
            padding: '4px 12px',
            borderRadius: 'var(--radius-md)',
            background: (orientation === 'white' ? whiteTime : blackTime) <= 30000
              ? 'rgba(224, 90, 90, 0.2)' : 'var(--bg-surface)',
            color: (orientation === 'white' ? whiteTime : blackTime) <= 30000
              ? 'var(--accent-red)' : 'var(--text-primary)',
          }}>
            {formatTime(orientation === 'white' ? whiteTime : blackTime)}
          </div>
        </div>
      </div>

      <div className="game-panel">
        {/* Move List */}
        <div className="card" style={{ flex: 1 }}>
          <div className="card-header">
            <span className="card-title">Moves</span>
            <span className="badge badge-blue">Online</span>
          </div>
          <MoveList
            history={history}
            currentMoveIndex={currentMoveIndex}
            onSelectMove={() => {}}
          />
        </div>

        {/* Draw offer notification */}
        {drawOffered && (
          <div className="card" style={{
            border: '1px solid var(--accent-gold)',
            background: 'rgba(255, 193, 7, 0.1)',
          }}>
            <div className="card-body" style={{ textAlign: 'center' }}>
              <p style={{ fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
                🤝 Opponent offers a draw
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button className="btn btn-primary" onClick={handleAcceptDraw} style={{ flex: 1 }}>
                  ✓ Accept
                </button>
                <button className="btn btn-secondary" onClick={handleDeclineDraw} style={{ flex: 1 }}>
                  ✕ Decline
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="card">
          <div className="card-body" style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button
              className="btn btn-secondary"
              onClick={handleOfferDraw}
              style={{ flex: 1 }}
              title="Offer Draw"
            >
              🤝 Draw
            </button>
            <button
              className="btn"
              onClick={handleResign}
              style={{
                flex: 1,
                background: 'rgba(224, 90, 90, 0.15)',
                color: 'var(--accent-red)',
                border: '1px solid rgba(224, 90, 90, 0.3)',
              }}
              title="Resign"
            >
              🏳️ Resign
            </button>
          </div>
        </div>
      </div>

      {/* Game Over Modal */}
      {gameResult && (
        <GameOverModal
          result={gameResult}
          history={history}
          playerColor={orientation}
          onNewGame={playAgain}
          onAnalyze={() => {}}
        />
      )}

      {showProfileUsername && (
        <ProfileModal username={showProfileUsername} onClose={() => setShowProfileUsername(null)} />
      )}
    </div>
  );
}
