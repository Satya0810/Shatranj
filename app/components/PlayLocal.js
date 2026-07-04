'use client';

import { useState, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import ChessGame from './ChessGame';
import MoveList from './MoveList';
import GameOverModal from './GameOverModal';
import ChessClock from './ChessClock';
import useGameClock, { TIME_CONTROLS } from '../lib/useGameClock';
import { useRouter } from 'next/navigation';

export default function PlayLocal() {
  const [game, setGame] = useState(new Chess());
  const [history, setHistory] = useState([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [gameResult, setGameResult] = useState(null);
  const [highlightSquares, setHighlightSquares] = useState({});
  const [boardWidth, setBoardWidth] = useState(560);
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedTimeControl, setSelectedTimeControl] = useState(4); // Default: 5+0
  const router = useRouter();

  const timeControl = TIME_CONTROLS[selectedTimeControl];

  // Game clock
  const onFlag = useCallback((side) => {
    const winner = side === 'white' ? 'black' : 'white';
    setGameResult({ result: 'timeout', winner });
  }, []);

  const clock = useGameClock({
    initialMinutes: timeControl.minutes,
    increment: timeControl.increment,
    onFlag,
  });

  useEffect(() => {
    const updateSize = () => {
      const padding = window.innerWidth <= 1024 ? 32 : 120;
      const verticalOffset = window.innerWidth <= 1024 ? 180 : 280;
      const maxHeight = window.innerHeight - verticalOffset;
      const maxWidth = window.innerWidth <= 1024 
        ? window.innerWidth - padding 
        : Math.min(window.innerWidth * 0.55, 640);
        
      setBoardWidth(Math.min(maxWidth, maxHeight));
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Pause clock when game is over
  useEffect(() => {
    if (gameResult) {
      clock.pauseClock();
    }
  }, [gameResult]);

  const checkGameOver = useCallback((g) => {
    if (g.isCheckmate()) {
      const winner = g.turn() === 'w' ? 'black' : 'white';
      setGameResult({ result: 'checkmate', winner });
      return true;
    }
    if (g.isStalemate()) {
      setGameResult({ result: 'stalemate' });
      return true;
    }
    if (g.isDraw()) {
      setGameResult({ result: g.isThreefoldRepetition() ? 'threefold' : g.isInsufficientMaterial() ? 'insufficient' : 'fifty-move' });
      return true;
    }
    return false;
  }, []);

  const onMove = useCallback((move) => {
    const newGame = new Chess(game.fen());
    newGame.move(move.san);
    
    setGame(new Chess(newGame.fen()));
    setHistory(prev => [...prev, move]);
    setCurrentMoveIndex(prev => prev + 1);
    setHighlightSquares({
      [move.from]: { background: 'rgba(255, 255, 0, 0.3)' },
      [move.to]: { background: 'rgba(255, 255, 0, 0.3)' },
    });

    // Switch clock after the move
    if (clock.activeSide) {
      clock.switchClock();
    } else {
      // First move of the game — start the clock for the other side
      const nextSide = newGame.turn() === 'w' ? 'white' : 'black';
      clock.startClock(nextSide);
    }

    checkGameOver(newGame);
  }, [game, checkGameOver, clock]);

  const startNewGame = useCallback(() => {
    const newGame = new Chess();
    setGame(newGame);
    setHistory([]);
    setCurrentMoveIndex(-1);
    setGameResult(null);
    setHighlightSquares({});
    setGameStarted(true);

    // Reset the clock with current time control
    clock.resetClock(timeControl.minutes, timeControl.increment);
    // Start white's clock
    clock.startClock('white');
  }, [clock, timeControl]);

  const goToMove = useCallback((index) => {
    if (index < -1 || index >= history.length) return;
    const newGame = new Chess();
    for (let i = 0; i <= index; i++) {
      newGame.move(history[i].san);
    }
    setGame(newGame);
    setCurrentMoveIndex(index);
  }, [history]);

  // Group time controls by category
  const timeControlCategories = TIME_CONTROLS.reduce((acc, tc, idx) => {
    if (!acc[tc.category]) acc[tc.category] = [];
    acc[tc.category].push({ ...tc, index: idx });
    return acc;
  }, {});

  // Setup screen
  if (!gameStarted) {
    return (
      <div className="play-page" id="local-setup">
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>
            Play a Friend
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Play chess on the same device with a friend
          </p>
        </div>

        {/* Time Control Selection */}
        <div className="card" style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div className="card-header">
            <span className="card-title">Time Control</span>
            <span className="badge badge-blue">{timeControl.label === '∞' ? 'Unlimited' : `${timeControl.label} · ${timeControl.category}`}</span>
          </div>
          <div className="card-body">
            {Object.entries(timeControlCategories).map(([category, controls]) => (
              <div key={category}>
                <div className="time-control-category">{category === 'Unlimited' ? '♾️ Unlimited' : `${category === 'Bullet' ? '🔫' : category === 'Blitz' ? '⚡' : category === 'Rapid' ? '🕐' : '🏛️'} ${category}`}</div>
                <div className="time-control-grid-compact">
                  {controls.map((tc) => (
                    <button
                      key={tc.index}
                      className={`time-control-btn compact ${selectedTimeControl === tc.index ? 'selected' : ''}`}
                      onClick={() => setSelectedTimeControl(tc.index)}
                      id={`tc-local-${tc.label.replace('+', '-')}`}
                    >
                      <span className="tc-time">{tc.label}</span>
                      {tc.category !== 'Unlimited' && (
                        <span className="tc-label">{tc.minutes}m{tc.increment > 0 ? ` +${tc.increment}s` : ''}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-xl)' }}>
          <button className="btn btn-primary btn-lg" onClick={startNewGame} id="btn-start-local-game">
            ⚔️ Start Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-layout" id="local-game-layout">
      <div className="board-section">
        <div className="player-info">
          <div className="player-avatar" style={{ background: 'var(--eval-black)', color: 'white' }}>♚</div>
          <div>
            <div className="player-name">Player 2</div>
            <div className="player-rating">Black</div>
          </div>
          {game.turn() === 'b' && !gameResult && (
            <span className="badge badge-green" style={{ marginLeft: 'auto' }}>Your turn</span>
          )}
          <ChessClock
            time={clock.blackTime}
            isActive={clock.activeSide === 'black'}
            isLowTime={clock.isLowTime.black}
            isUnlimited={clock.isUnlimited}
          />
        </div>

        <ChessGame
          game={game}
          onMove={onMove}
          boardWidth={boardWidth}
          orientation="white"
          allowMoves={!gameResult && (currentMoveIndex === history.length - 1 || history.length === 0)}
          highlightSquares={highlightSquares}
        />

        <div className="player-info">
          <div className="player-avatar" style={{ background: 'var(--eval-white)', color: 'var(--bg-darkest)' }}>♔</div>
          <div>
            <div className="player-name">Player 1</div>
            <div className="player-rating">White</div>
          </div>
          {game.turn() === 'w' && !gameResult && (
            <span className="badge badge-green" style={{ marginLeft: 'auto' }}>Your turn</span>
          )}
          <ChessClock
            time={clock.whiteTime}
            isActive={clock.activeSide === 'white'}
            isLowTime={clock.isLowTime.white}
            isUnlimited={clock.isUnlimited}
          />
        </div>
      </div>

      <div className="game-panel">
        <MoveList
          history={history}
          currentMoveIndex={currentMoveIndex}
          onMoveClick={goToMove}
          onFirst={() => goToMove(-1)}
          onPrev={() => goToMove(Math.max(-1, currentMoveIndex - 1))}
          onNext={() => goToMove(Math.min(history.length - 1, currentMoveIndex + 1))}
          onLast={() => goToMove(history.length - 1)}
        />

        <div className="card">
          <div className="card-body" style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button className="btn btn-secondary" onClick={startNewGame} style={{ flex: 1 }} id="btn-new-local-game">
              🔄 New Game
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                const pgn = game.pgn();
                router.push(`/analyze?pgn=${encodeURIComponent(pgn)}&autoAnalyze=true`);
              }}
              style={{ flex: 1 }}
              id="btn-analyze-local-game"
            >
              📊 Analyze
            </button>
          </div>
        </div>

        {/* Turn Indicator & Clock Info */}
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: 'var(--space-sm)' }}>
              {game.turn() === 'w' ? '♔' : '♚'}
            </div>
            <div style={{ fontWeight: 600 }}>
              {gameResult ? 'Game Over' : `${game.turn() === 'w' ? 'White' : 'Black'}'s Turn`}
            </div>
            {game.inCheck() && !gameResult && (
              <div className="badge badge-red" style={{ marginTop: 'var(--space-sm)' }}>Check!</div>
            )}
            {!clock.isUnlimited && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 'var(--space-sm)' }}>
                {timeControl.label} · {timeControl.category}
              </div>
            )}
          </div>
        </div>
      </div>

      <GameOverModal
        result={gameResult}
        onNewGame={startNewGame}
        onAnalyze={() => {
          const replayGame = new Chess();
          for (const move of history) {
            replayGame.move(move.san);
          }
          const pgn = replayGame.pgn();
          router.push(`/analyze?pgn=${encodeURIComponent(pgn)}&autoAnalyze=true`);
        }}
        onClose={() => setGameResult(null)}
      />
    </div>
  );
}
