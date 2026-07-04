'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import ChessGame from './ChessGame';
import MoveList from './MoveList';
import EvaluationBar from './EvaluationBar';
import EvaluationChart from './EvaluationChart';
import GameOverModal from './GameOverModal';
import ChessClock from './ChessClock';
import StockfishEngine from '../lib/stockfish';
import { evaluateHeuristic } from '../lib/heuristic';
import useGameClock, { TIME_CONTROLS } from '../lib/useGameClock';
import { useRouter } from 'next/navigation';

const DIFFICULTY_LABELS = [
  'Beginner', 'Casual', 'Intermediate', 'Advanced',
  'Expert', 'Master', 'Grandmaster', 'Stockfish Max',
];

const SKILL_LEVELS = [1, 3, 6, 10, 14, 17, 19, 20];
const SEARCH_DEPTHS = [3, 5, 8, 12, 15, 18, 22, 30];

export default function PlayComputer() {
  const [game, setGame] = useState(new Chess());
  const [history, setHistory] = useState([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [evaluation, setEvaluation] = useState(0);
  const [mate, setMate] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [moveClassifications, setMoveClassifications] = useState({});
  const [heuristicEvals, setHeuristicEvals] = useState([0]);
  const [playerColor, setPlayerColor] = useState('white');
  const [difficulty, setDifficulty] = useState(3);
  const [isThinking, setIsThinking] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [boardWidth, setBoardWidth] = useState(560);
  const [highlightSquares, setHighlightSquares] = useState({});
  const [selectedTimeControl, setSelectedTimeControl] = useState(4); // Default: 5+0 (Blitz)
  
  // Real-time analysis states
  const [showRealTimeAnalysis, setShowRealTimeAnalysis] = useState(false);
  const [engineLines, setEngineLines] = useState([]);
  const [arrows, setArrows] = useState([]);
  const [moveEvals, setMoveEvals] = useState({});

  const engineRef = useRef(null);
  const gameRef = useRef(game); // Keep a mutable ref to current game
  const showRealTimeRef = useRef(false);
  const currentMoveIndexRef = useRef(-1);

  // Keep refs in sync
  useEffect(() => {
    showRealTimeRef.current = showRealTimeAnalysis;
    if (engineRef.current && engineRef.current.isReady) {
      engineRef.current.setMultiPV(showRealTimeAnalysis ? 3 : 1);
    }
  }, [showRealTimeAnalysis]);

  useEffect(() => {
    currentMoveIndexRef.current = currentMoveIndex;
  }, [currentMoveIndex]);

  // Real-time Move Classifications
  useEffect(() => {
    if (!showRealTimeAnalysis) return;
    
    const newClassifications = {};
    for (let i = 0; i < history.length; i++) {
      if (moveEvals[i] === undefined) continue;

      const prevEval = i > 0 ? (moveEvals[i - 1] || 0) : 30; // 30cp start pos
      const isWhiteMove = history[i].color === 'w';
      const absEval = moveEvals[i];

      const eBefore = isWhiteMove ? prevEval : -prevEval;
      const eAfter = isWhiteMove ? absEval : -absEval;

      const wBefore = 50 + 50 * (2 / Math.PI) * Math.atan(eBefore / 290);
      const wAfter = 50 + 50 * (2 / Math.PI) * Math.atan(eAfter / 290);
      const loss = Math.max(0, wBefore - wAfter);
      const evalDrop = isWhiteMove ? (prevEval - absEval) : (absEval - prevEval);

      if (i <= 10 && evalDrop < 50) newClassifications[i] = 'book';
      else if (loss >= 20) newClassifications[i] = 'blunder';
      else if (loss >= 10) newClassifications[i] = 'mistake';
      else if (loss >= 5) newClassifications[i] = 'inaccuracy';
      else if (evalDrop <= -150) newClassifications[i] = 'brilliant';
      else if (evalDrop <= -75) newClassifications[i] = 'great';
      else if (loss < 1.5) newClassifications[i] = 'best';
      else newClassifications[i] = 'good';
    }
    
    setMoveClassifications(newClassifications);
  }, [moveEvals, history, showRealTimeAnalysis]);

  const router = useRouter();

  // Get the selected time control object
  const timeControl = TIME_CONTROLS[selectedTimeControl];

  // Game clock
  const onFlag = useCallback((side) => {
    // The side that ran out of time loses
    const loser = side;
    const winner = loser === 'white' ? 'black' : 'white';
    setGameResult({ result: 'timeout', winner });
  }, []);

  const clock = useGameClock({
    initialMinutes: timeControl.minutes,
    increment: timeControl.increment,
    onFlag,
  });

  // Always keep gameRef in sync
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  // Responsive board sizing
  useEffect(() => {
    const updateSize = () => {
      const padding = window.innerWidth <= 1024 ? 32 : 120;
      const verticalOffset = window.innerWidth <= 1024 ? 180 : 280;
      const maxHeight = window.innerHeight - verticalOffset;
      const maxWidth = window.innerWidth <= 1024
        ? window.innerWidth - padding
        : Math.min(window.innerWidth * 0.55, 640);
      setBoardWidth(Math.max(280, Math.min(maxWidth, maxHeight)));
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Initialize Stockfish
  useEffect(() => {
    const engine = new StockfishEngine();
    engineRef.current = engine;
    engine.init().then(() => {
      console.log('Stockfish engine ready');
    });
    return () => engine.destroy();
  }, []);

  // Pause clock when game is over
  useEffect(() => {
    if (gameResult) {
      clock.pauseClock();
    }
  }, [gameResult]);

  // Check game end conditions
  const checkGameOver = useCallback((g) => {
    if (g.isCheckmate()) {
      setGameResult({ result: 'checkmate', winner: g.turn() === 'w' ? 'black' : 'white' });
      return true;
    }
    if (g.isStalemate()) { setGameResult({ result: 'stalemate' }); return true; }
    if (g.isDraw()) {
      if (g.isThreefoldRepetition()) setGameResult({ result: 'threefold' });
      else if (g.isInsufficientMaterial()) setGameResult({ result: 'insufficient' });
      else setGameResult({ result: 'fifty-move' });
      return true;
    }
    return false;
  }, []);

  // Computer makes a move — receives the current FEN to avoid stale closures
  const makeComputerMove = useCallback((fen) => {
    const engine = engineRef.current;
    if (!engine || !engine.isReady) {
      // If engine is still loading, retry in 500ms instead of permanently breaking the game
      setTimeout(() => makeComputerMove(fen), 500);
      return;
    }

    const g = new Chess(fen);
    if (g.isGameOver()) return;

    setIsThinking(true);
    engine.setSkillLevel(SKILL_LEVELS[difficulty]);
    engine.setPosition(fen);

    engine.onEvaluation = (evalData) => {
      setMate(evalData.type === 'mate' ? evalData.value : null);
      setEvaluation(evalData.type === 'cp' ? evalData.value : 0);

      if (showRealTimeRef.current && evalData.lines) {
        setEngineLines(evalData.lines.filter(Boolean).map((line) => ({
          eval: line.type === 'mate' ? `M${Math.abs(line.value)}` : (line.value > 0 ? '+' : '') + line.value.toFixed(2),
          evalValue: line.value,
          type: line.type,
          moves: line.pv || '',
          depth: line.depth || 0,
          bestMove: line.bestMove || '',
        })));

        if (evalData.lines[0] && evalData.lines[0].bestMove) {
          const bm = evalData.lines[0].bestMove;
          if (bm && bm.length >= 4) {
            setArrows([[bm.substring(0, 2), bm.substring(2, 4), 'rgba(96, 165, 250, 0.7)']]);
          }
        }
      } else {
        setEngineLines([]);
        setArrows([]);
      }

      // Record absolute evaluation for current position
      let evalValue = 0;
      if (evalData.type === 'mate') {
        evalValue = Math.sign(evalData.value) * 10000 - evalData.value * 100;
      } else if (evalData.value !== undefined) {
        evalValue = evalData.value * 100;
      }
      const absEval = g.turn() === 'w' ? evalValue : -evalValue;
      setMoveEvals(prev => ({...prev, [currentMoveIndexRef.current]: absEval}));
    };

    engine.onBestMove = (bestMove) => {
      setIsThinking(false);
      if (!bestMove || bestMove === '(none)') return;

      const afterPlayerGame = new Chess(fen);
      try {
        const move = afterPlayerGame.move({
          from: bestMove.substring(0, 2),
          to: bestMove.substring(2, 4),
          promotion: bestMove.length > 4 ? bestMove[4] : undefined,
        });

        if (move) {
          const newFen = afterPlayerGame.fen();
          setGame(new Chess(newFen));
          setHistory((prev) => [...prev, move]);
          setCurrentMoveIndex((prev) => prev + 1);
          setHighlightSquares({
            [move.from]: { background: 'rgba(255, 255, 0, 0.3)' },
            [move.to]: { background: 'rgba(255, 255, 0, 0.3)' },
          });

          // Switch clock: computer just moved, now it's player's turn
          clock.switchClock();

          // Check game over after computer move
          checkGameOver(afterPlayerGame);

          // Get eval for new position without triggering another move
          engine.onBestMove = null;
          // Re-bind onEvaluation for the player's turn to use the updated board
          engine.onEvaluation = (evalData) => {
            setMate(evalData.type === 'mate' ? evalData.value : null);
            setEvaluation(evalData.type === 'cp' ? evalData.value : 0);

            if (showRealTimeRef.current && evalData.lines) {
              setEngineLines(evalData.lines.filter(Boolean).map((line) => ({
                eval: line.type === 'mate' ? `M${Math.abs(line.value)}` : (line.value > 0 ? '+' : '') + line.value.toFixed(2),
                evalValue: line.value,
                type: line.type,
                moves: line.pv || '',
                depth: line.depth || 0,
                bestMove: line.bestMove || '',
              })));

              if (evalData.lines[0] && evalData.lines[0].bestMove) {
                const bm = evalData.lines[0].bestMove;
                if (bm && bm.length >= 4) {
                  setArrows([[bm.substring(0, 2), bm.substring(2, 4), 'rgba(96, 165, 250, 0.7)']]);
                }
              }
            } else {
              setEngineLines([]);
              setArrows([]);
            }

            // Record absolute evaluation for current position
            let evalValue = 0;
            if (evalData.type === 'mate') {
              evalValue = Math.sign(evalData.value) * 10000 - evalData.value * 100;
            } else if (evalData.value !== undefined) {
              evalValue = evalData.value * 100;
            }
            const absEval = afterPlayerGame.turn() === 'w' ? evalValue : -evalValue;
            setMoveEvals(prev => ({...prev, [currentMoveIndexRef.current]: absEval}));
          };
          engine.setPosition(newFen);
          engine.search(SEARCH_DEPTHS[difficulty]);
        }
      } catch (err) {
        console.error('Computer move error:', err);
        setIsThinking(false);
      }
    };

    engine.search(SEARCH_DEPTHS[difficulty]);
  }, [difficulty, checkGameOver, clock]);

  // Player makes a move
  const onPlayerMove = useCallback((move) => {
    console.log('onPlayerMove triggered with:', move);
    // Apply the move to a fresh copy (ChessGame didn't mutate our game)
    const newGame = new Chess(game.fen());
    try {
      newGame.move(move.san);
      const newFen = newGame.fen();
      console.log('onPlayerMove computed new FEN:', newFen);

      setGame(new Chess(newFen));
      setHistory((prev) => [...prev, move]);
      setCurrentMoveIndex((prev) => prev + 1);
      setHighlightSquares({
        [move.from]: { background: 'rgba(255, 255, 0, 0.3)' },
        [move.to]: { background: 'rgba(255, 255, 0, 0.3)' },
      });

      // Switch clock: player just moved, now it's computer's turn
      clock.switchClock();

      if (!checkGameOver(newGame)) {
        // Schedule computer move with the NEW fen (not stale state)
        setTimeout(() => makeComputerMove(newFen), 300);
      }
    } catch (err) {
      console.error('onPlayerMove failed to apply move:', err);
    }
  }, [game, checkGameOver, makeComputerMove, clock]);

  // Start a new game
  const startNewGame = useCallback(() => {
    const newGame = new Chess();
    setGame(newGame);
    setHistory([]);
    setCurrentMoveIndex(-1);
    setEvaluation(0);
    setMate(null);
    setGameResult(null);
    setMoveClassifications({});
    setHeuristicEvals([0]);
    setHighlightSquares({});
    setGameStarted(true);

    if (engineRef.current) engineRef.current.newGame();

    // Reset the clock with current time control
    clock.resetClock(timeControl.minutes, timeControl.increment);

    // If playing as black, computer moves first, then start player's clock
    if (playerColor === 'black') {
      // Start clock for white (computer) side
      clock.startClock('white');
      setTimeout(() => makeComputerMove(newGame.fen()), 500);
    } else {
      // Start clock for white (player) side
      clock.startClock('white');
    }
  }, [playerColor, makeComputerMove, clock, timeControl]);

  // Move navigation (for reviewing the game)
  const goToMove = useCallback((index) => {
    if (index < -1 || index >= history.length) return;
    const newGame = new Chess();
    for (let i = 0; i <= index; i++) {
      newGame.move(history[i].san);
    }
    setGame(newGame);
    setCurrentMoveIndex(index);
  }, [history]);

  const isPlayerTurn = (game.turn() === 'w' && playerColor === 'white') ||
                       (game.turn() === 'b' && playerColor === 'black');

  const allowMoves = isPlayerTurn && !gameResult && !isThinking;

  // Real-time heuristic move analysis
  useEffect(() => {
    if (history.length === 0) return;
    const lastMoveIndex = history.length - 1;
    if (moveClassifications[lastMoveIndex]) return;

    const newFen = game.fen();
    const currentEval = evaluateHeuristic(newFen);
    
    // Store eval
    let newEvals = [...heuristicEvals];
    newEvals[lastMoveIndex + 1] = currentEval;
    
    const prevEval = heuristicEvals[lastMoveIndex];
    let newClassifications = { ...moveClassifications };
    
    if (prevEval !== undefined) {
      const isWhiteMove = lastMoveIndex % 2 === 0;
      
      const eBefore = isWhiteMove ? prevEval : -prevEval;
      const eAfter = isWhiteMove ? currentEval : -currentEval;
      
      // Heuristic eval is in pawns, multiply by 100 for centipawns
      const cpBefore = eBefore * 100;
      const cpAfter = eAfter * 100;
      
      const wBefore = 50 + 50 * (2 / Math.PI) * Math.atan(cpBefore / 290);
      const wAfter = 50 + 50 * (2 / Math.PI) * Math.atan(cpAfter / 290);
      const loss = Math.max(0, wBefore - wAfter);

      const evalDrop = isWhiteMove ? (prevEval - currentEval) : (currentEval - prevEval);
      
      let classification = '';
      if (lastMoveIndex < 10 && evalDrop < 0.5) classification = 'book';
      else if (loss >= 20) classification = 'blunder';
      else if (loss >= 10) classification = 'mistake';
      else if (loss >= 5) classification = 'inaccuracy';
      else if (evalDrop <= -1.5) classification = 'brilliant';
      else if (evalDrop <= -0.75) classification = 'great';
      else if (loss < 1.5) classification = 'best';
      else classification = 'good';
      
      if (classification) {
        newClassifications[lastMoveIndex] = classification;
      }
    }
    
    setHeuristicEvals(newEvals);
    setMoveClassifications(newClassifications);
  }, [history.length, game.fen()]); // Explicitly depend on lengths/strings

  // Group time controls by category for the setup screen
  const timeControlCategories = TIME_CONTROLS.reduce((acc, tc, idx) => {
    if (!acc[tc.category]) acc[tc.category] = [];
    acc[tc.category].push({ ...tc, index: idx });
    return acc;
  }, {});

  // Determine which side is which from player perspective
  const topSide = playerColor === 'white' ? 'black' : 'white';
  const bottomSide = playerColor === 'white' ? 'white' : 'black';

  // Setup screen
  if (!gameStarted) {
    return (
      <div className="play-page" id="play-setup">
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>
            Play vs Computer
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Choose your settings and challenge Stockfish AI
          </p>
        </div>

        <div className="play-options">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Play As</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                {['white', 'random', 'black'].map((color) => (
                  <button
                    key={color}
                    className={`time-control-btn ${playerColor === color || (color === 'random' && false) ? 'selected' : ''}`}
                    onClick={() => setPlayerColor(color === 'random' ? (Math.random() > 0.5 ? 'white' : 'black') : color)}
                    style={{ flex: 1 }}
                    id={`color-${color}`}
                  >
                    <span className="tc-time">{color === 'white' ? '♔' : color === 'black' ? '♚' : '🎲'}</span>
                    <span className="tc-label" style={{ textTransform: 'capitalize' }}>{color}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Difficulty</span>
              <span className="badge badge-green">{DIFFICULTY_LABELS[difficulty]}</span>
            </div>
            <div className="card-body">
              <div className="difficulty-slider">
                <input
                  type="range" min="0" max="7" value={difficulty}
                  onChange={(e) => setDifficulty(parseInt(e.target.value))}
                  id="difficulty-slider"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>Beginner</span>
                  <span>Stockfish Max</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Time Control Selection */}
        <div className="card" style={{ marginTop: 'var(--space-lg)', maxWidth: '900px', marginLeft: 'auto', marginRight: 'auto' }}>
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
                      id={`tc-${tc.label.replace('+', '-')}`}
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
          <button className="btn btn-primary btn-lg" onClick={startNewGame} id="btn-start-game">
            ⚔️ Start Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-layout" id="game-layout">
      <div className="board-section">
        <div className="player-info" id="opponent-info">
          <div className="player-avatar" style={{ background: 'linear-gradient(135deg, var(--accent-red), var(--accent-gold))' }}>🤖</div>
          <div>
            <div className="player-name">Stockfish</div>
            <div className="player-rating">{DIFFICULTY_LABELS[difficulty]}</div>
          </div>
          {isThinking && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Thinking...</span>
            </div>
          )}
          <ChessClock
            time={topSide === 'white' ? clock.whiteTime : clock.blackTime}
            isActive={clock.activeSide === topSide}
            isLowTime={clock.isLowTime[topSide]}
            isUnlimited={clock.isUnlimited}
          />
        </div>

        <div className="board-container-wrapper">
          <EvaluationBar evaluation={evaluation} mate={mate} orientation={playerColor} />
          <ChessGame
            game={game}
            onMove={onPlayerMove}
            boardWidth={boardWidth}
            orientation={playerColor}
            allowMoves={allowMoves}
            highlightSquares={highlightSquares}
            arrowsOnBoard={showRealTimeAnalysis ? arrows : []}
          />
        </div>

        <div className="player-info" id="player-info">
          <div className="player-avatar">G</div>
          <div>
            <div className="player-name">You</div>
            <div className="player-rating" style={{ textTransform: 'capitalize' }}>Playing as {playerColor}</div>
          </div>
          <ChessClock
            time={bottomSide === 'white' ? clock.whiteTime : clock.blackTime}
            isActive={clock.activeSide === bottomSide}
            isLowTime={clock.isLowTime[bottomSide]}
            isUnlimited={clock.isUnlimited}
          />
        </div>
      </div>

      <div className="game-panel">
        <MoveList
          history={history}
          currentMoveIndex={currentMoveIndex}
          moveClassifications={moveClassifications}
          onMoveClick={goToMove}
          onFirst={() => goToMove(-1)}
          onPrev={() => goToMove(Math.max(-1, currentMoveIndex - 1))}
          onNext={() => goToMove(Math.min(history.length - 1, currentMoveIndex + 1))}
          onLast={() => goToMove(history.length - 1)}
        />

        <div className="card">
          <div className="card-body" style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={startNewGame} id="btn-rematch" style={{ flex: 1 }}>
              🔄 New Game
            </button>
            <button
              className="btn btn-danger"
              onClick={() => setGameResult({ result: 'resignation', winner: playerColor === 'white' ? 'black' : 'white' })}
              disabled={!!gameResult}
              id="btn-resign"
              style={{ flex: 1 }}
            >
              🏳️ Resign
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="card-title">Engine</span>
              <span className="badge badge-blue" style={{ marginLeft: '8px' }}>Stockfish</span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <input 
                type="checkbox" 
                checked={showRealTimeAnalysis} 
                onChange={(e) => setShowRealTimeAnalysis(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Real-time Analysis
            </label>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Evaluation</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: evaluation > 0 ? 'var(--accent-green)' : evaluation < 0 ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                {mate !== null ? `M${Math.abs(mate)}` : (evaluation > 0 ? '+' : '') + evaluation.toFixed(2)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: 'var(--space-sm)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Turn</span>
              <span>{isThinking ? '🤖 Computer thinking...' : isPlayerTurn ? '👤 Your turn' : '⏳ Waiting...'}</span>
            </div>
            {!clock.isUnlimited && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: 'var(--space-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Time Control</span>
                <span>{timeControl.label} · {timeControl.category}</span>
              </div>
            )}
            
            {showRealTimeAnalysis && (
              <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>Top Engine Lines</div>
                <div className="engine-lines">
                  {engineLines.length === 0 ? (
                    <div style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                      Waiting for engine...
                    </div>
                  ) : (
                    engineLines.map((line, i) => (
                      <div className="engine-line" key={i} style={{ display: 'flex', gap: '12px', fontSize: '13px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ 
                          width: '40px', 
                          fontWeight: 700, 
                          color: line.type === 'mate' 
                            ? (line.evalValue > 0 ? 'var(--accent-green)' : 'var(--accent-red)')
                            : (line.evalValue > 0 ? 'var(--accent-green)' : line.evalValue < 0 ? 'var(--accent-red)' : 'var(--text-muted)') 
                        }}>
                          {line.eval}
                        </span>
                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          {line.moves}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>d{line.depth}</span>
                      </div>
                    ))
                  )}
                </div>
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

      {gameResult && showRealTimeAnalysis && (
        <div className="card" id="analysis-summary" style={{ marginTop: 'var(--space-xl)' }}>
          <div className="card-header">
            <span className="card-title">Analysis Summary</span>
          </div>
          <div className="card-body">
            {(() => {
              const categories = ['brilliant', 'great', 'best', 'book', 'good', 'inaccuracy', 'mistake', 'blunder'];
              const counts = Object.fromEntries(categories.map(c => [c, 0]));
              const whiteCounts = Object.fromEntries(categories.map(c => [c, 0]));
              const blackCounts = Object.fromEntries(categories.map(c => [c, 0]));
              
              Object.entries(moveClassifications).forEach(([idx, c]) => {
                if (counts[c] !== undefined) {
                  counts[c]++;
                  if (history[idx] && history[idx].color === 'w') whiteCounts[c]++;
                  else blackCounts[c]++;
                }
              });

              let whiteAccSum = 0;
              let blackAccSum = 0;
              let whiteMovesCount = 0;
              let blackMovesCount = 0;

              for (let i = 0; i < history.length; i++) {
                if (moveEvals[i] === undefined) continue;
                const isWhiteMove = history[i].color === 'w';
                const prevEval = i > 0 ? (moveEvals[i - 1] || 0) : 30;
                const absEval = moveEvals[i] || 0;

                const eBefore = isWhiteMove ? prevEval : -prevEval;
                const eAfter = isWhiteMove ? absEval : -absEval;

                const wBefore = 50 + 50 * (2 / Math.PI) * Math.atan(eBefore / 290);
                const wAfter = 50 + 50 * (2 / Math.PI) * Math.atan(eAfter / 290);
                const loss = Math.max(0, wBefore - wAfter);
                const moveAcc = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));

                if (isWhiteMove) {
                  whiteAccSum += moveAcc;
                  whiteMovesCount++;
                } else {
                  blackAccSum += moveAcc;
                  blackMovesCount++;
                }
              }

              const whiteAccuracy = whiteMovesCount > 0 ? Math.round(whiteAccSum / whiteMovesCount) : 100;
              const blackAccuracy = blackMovesCount > 0 ? Math.round(blackAccSum / blackMovesCount) : 100;

              const getEstimatedElo = (acc) => {
                if (acc <= 10) return 100;
                if (acc >= 100) return 3200;
                const mapping = [
                  [10, 100], [20, 200], [30, 300], [40, 400], [50, 500],
                  [60, 700], [70, 1000], [80, 1500], [90, 2100], [95, 2600],
                  [99, 3000], [100, 3200]
                ];
                for (let i = 0; i < mapping.length - 1; i++) {
                  const [acc1, elo1] = mapping[i];
                  const [acc2, elo2] = mapping[i + 1];
                  if (acc >= acc1 && acc <= acc2) {
                    const fraction = (acc - acc1) / (acc2 - acc1);
                    return Math.round(elo1 + fraction * (elo2 - elo1));
                  }
                }
                return 100;
              };

              const whiteElo = getEstimatedElo(whiteAccuracy);
              const blackElo = getEstimatedElo(blackAccuracy);
              const getRowStyle = (color) => ({ textAlign: 'center', fontFamily: 'var(--font-mono)', color });

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>White Performance</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{whiteElo}</div>
                        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>({whiteAccuracy}%)</div>
                      </div>
                      <div style={{ height: '4px', background: 'var(--bg-surface)', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${whiteAccuracy}%`, background: 'var(--accent-green)', borderRadius: '2px', transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Black Performance</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{blackElo}</div>
                        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>({blackAccuracy}%)</div>
                      </div>
                      <div style={{ height: '4px', background: 'var(--bg-surface)', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${blackAccuracy}%`, background: 'var(--accent-green)', borderRadius: '2px', transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  </div>

                  <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ textAlign: 'left', paddingBottom: '6px' }}>Classification</th>
                        <th style={{ textAlign: 'center', paddingBottom: '6px' }}>White</th>
                        <th style={{ textAlign: 'center', paddingBottom: '6px' }}>Black</th>
                        <th style={{ textAlign: 'center', paddingBottom: '6px' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '6px 0' }}>💎 Brilliant</td>
                        <td style={getRowStyle('var(--accent-blue)')}>{whiteCounts.brilliant}</td>
                        <td style={getRowStyle('var(--accent-blue)')}>{blackCounts.brilliant}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{counts.brilliant}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '6px 0' }}>🌟 Great</td>
                        <td style={getRowStyle('var(--accent-blue)')}>{whiteCounts.great}</td>
                        <td style={getRowStyle('var(--accent-blue)')}>{blackCounts.great}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{counts.great}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '6px 0' }}>⭐ Best</td>
                        <td style={getRowStyle('var(--accent-green)')}>{whiteCounts.best}</td>
                        <td style={getRowStyle('var(--accent-green)')}>{blackCounts.best}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{counts.best}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '6px 0' }}>📘 Book</td>
                        <td style={getRowStyle('var(--accent-primary)')}>{whiteCounts.book}</td>
                        <td style={getRowStyle('var(--accent-primary)')}>{blackCounts.book}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{counts.book}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '6px 0' }}>👍 Good</td>
                        <td style={getRowStyle('var(--accent-green)')}>{whiteCounts.good}</td>
                        <td style={getRowStyle('var(--accent-green)')}>{blackCounts.good}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{counts.good}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '6px 0' }}>🤔 Inaccuracy</td>
                        <td style={getRowStyle('var(--accent-gold)')}>{whiteCounts.inaccuracy}</td>
                        <td style={getRowStyle('var(--accent-gold)')}>{blackCounts.inaccuracy}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{counts.inaccuracy}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '6px 0' }}>⚠️ Mistake</td>
                        <td style={getRowStyle('var(--accent-gold)')}>{whiteCounts.mistake}</td>
                        <td style={getRowStyle('var(--accent-gold)')}>{blackCounts.mistake}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{counts.mistake}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '6px 0' }}>❌ Blunder</td>
                        <td style={getRowStyle('var(--accent-red)')}>{whiteCounts.blunder}</td>
                        <td style={getRowStyle('var(--accent-red)')}>{blackCounts.blunder}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{counts.blunder}</td>
                      </tr>
                    </tbody>
                  </table>

                  <EvaluationChart evals={moveEvals} historyLength={history.length} />
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
