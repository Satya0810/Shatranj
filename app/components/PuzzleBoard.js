'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import ChessGame from './ChessGame';
import { useAuth } from './AuthContext';

export default function PuzzleBoard() {
  const [puzzle, setPuzzle] = useState(null);
  const [game, setGame] = useState(null);
  const [solutionStep, setSolutionStep] = useState(0);
  const [puzzleState, setPuzzleState] = useState('loading'); // 'loading' | 'playing' | 'correct' | 'incorrect'
  const [streak, setStreak] = useState(0);
  const [totalSolved, setTotalSolved] = useState(0);
  const [boardWidth, setBoardWidth] = useState(560);
  const [highlightSquares, setHighlightSquares] = useState({});
  const [showHint, setShowHint] = useState(false);
  const [theme, setTheme] = useState('mix');
  
  // List of fallback Lichess puzzle IDs to cycle through
  const fallbackIds = ['61XpE', 'qLcwl', '0Z3gI', 'rY4B4', 'sZ7X1'];
  const [fallbackIndex, setFallbackIndex] = useState(0);

  const { token } = useAuth();
  const startTimeRef = useRef(Date.now());

  const recordPuzzleResult = useCallback(async (isCorrect) => {
    if (!token || !puzzle || puzzle.id === 'error_fallback') return;
    
    const timeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);
    
    try {
      await fetch('/api/puzzle/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          puzzleId: puzzle.id,
          rating: puzzle.rating,
          isCorrect,
          timeTaken
        })
      });
    } catch (err) {
      console.error('Failed to record puzzle:', err);
    }
  }, [token, puzzle]);

  // Responsive board sizing
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

  const fetchPuzzle = async (overrideTheme = null) => {
    setPuzzleState('loading');
    try {
      const activeTheme = overrideTheme || theme;
      const url = `/api/puzzle?theme=${activeTheme}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch puzzle');
      const data = await res.json();
      
      const p = data.puzzle;
      
      // The fen provided by Lichess is the position *before* the opponent's last move.
      // The solution array includes the opponent's first move!
      // So we must play the opponent's first move, then the user solves the rest.
      const initialGame = new Chess(p.fen);
      const firstMoveUci = p.solution[0];
      
      // Make the opponent's first move
      initialGame.move({
        from: firstMoveUci.substring(0, 2),
        to: firstMoveUci.substring(2, 4),
        promotion: firstMoveUci.length > 4 ? firstMoveUci[4] : undefined
      });
      
      const setup = {
        id: p.id,
        fen: initialGame.fen(),
        solution: p.solution.slice(1), // user's solution starts from index 1
        theme: p.themes ? p.themes.join(', ').replace(/([A-Z])/g, ' $1').trim() : 'Tactics',
        rating: p.rating,
        orientation: initialGame.turn() === 'w' ? 'white' : 'black',
        originalSolution: p.solution
      };

      setPuzzle(setup);
      setGame(new Chess(setup.fen));
      setSolutionStep(0);
      setPuzzleState('playing');
      setHighlightSquares({
        [firstMoveUci.substring(0, 2)]: { background: 'rgba(255, 255, 0, 0.3)' },
        [firstMoveUci.substring(2, 4)]: { background: 'rgba(255, 255, 0, 0.3)' },
      });
      setShowHint(false);
      startTimeRef.current = Date.now();
    } catch (err) {
      console.error('Error fetching puzzle:', err);
      // Fallback puzzle in case of network error
      const fallbackSetup = {
        id: 'error_fallback',
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 2 3',
        solution: ['f3f7'],
        theme: 'Scholar\'s Mate',
        rating: 500,
        orientation: 'white'
      };
      setPuzzle(fallbackSetup);
      setGame(new Chess(fallbackSetup.fen));
      setSolutionStep(0);
      setPuzzleState('playing');
    }
  };

  // Load initial daily puzzle
  useEffect(() => {
    fetchPuzzle('mix');
  }, []);

  const onMove = useCallback((move) => {
    if (puzzleState !== 'playing' || !puzzle) return;

    // Convert move to UCI format (e.g., e2e4)
    let moveUci = move.from + move.to;
    if (move.promotion) moveUci += move.promotion;

    const expectedMoveUci = puzzle.solution[solutionStep];
    
    // Create a new game copy for the new state
    const newGame = new Chess(game.fen());
    newGame.move(move.san);
    
    if (moveUci === expectedMoveUci) {
      // Correct move!
      setHighlightSquares({
        [move.from]: { background: 'rgba(129, 182, 74, 0.4)' },
        [move.to]: { background: 'rgba(129, 182, 74, 0.4)' },
      });

      if (solutionStep + 1 >= puzzle.solution.length) {
        // Puzzle solved!
        setPuzzleState('correct');
        setStreak(prev => prev + 1);
        setTotalSolved(prev => prev + 1);
        setGame(newGame);
        recordPuzzleResult(true);
      } else {
        // Correct move, but more moves remain.
        setGame(newGame);
        setSolutionStep(prev => prev + 1);
        
        // Auto-play the opponent's response after a delay
        setTimeout(() => {
          const opponentMoveUci = puzzle.solution[solutionStep + 1];
          if (opponentMoveUci) {
            const responseGame = new Chess(newGame.fen());
            try {
              responseGame.move({
                from: opponentMoveUci.substring(0, 2),
                to: opponentMoveUci.substring(2, 4),
                promotion: opponentMoveUci.length > 4 ? opponentMoveUci[4] : undefined
              });
              setGame(responseGame);
              setSolutionStep(prev => prev + 1);
              setHighlightSquares({
                [opponentMoveUci.substring(0, 2)]: { background: 'rgba(255, 255, 0, 0.3)' },
                [opponentMoveUci.substring(2, 4)]: { background: 'rgba(255, 255, 0, 0.3)' },
              });
            } catch (e) {
              console.error('Error applying opponent response:', e);
            }
          }
        }, 600);
      }
    } else {
      // Wrong move!
      if (puzzleState === 'playing') {
        recordPuzzleResult(false);
      }
      setPuzzleState('incorrect');
      setStreak(0);
      setHighlightSquares({
        [move.from]: { background: 'rgba(224, 90, 90, 0.4)' },
        [move.to]: { background: 'rgba(224, 90, 90, 0.4)' },
      });
      // Temporarily show the wrong move, then revert
      setGame(newGame);
      setTimeout(() => {
        setGame(new Chess(game.fen()));
      }, 1000);
    }
  }, [game, puzzle, solutionStep, puzzleState]);

  const retryPuzzle = useCallback(() => {
    if (!puzzle) return;
    setGame(new Chess(puzzle.fen));
    setSolutionStep(0);
    setPuzzleState('playing');
    setHighlightSquares({});
    setShowHint(false);
  }, [puzzle]);

  if (puzzleState === 'loading' && !puzzle) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
        <div className="spinner" style={{ margin: '0 auto var(--space-md)' }} />
        <p>Loading Lichess Puzzle...</p>
      </div>
    );
  }

  if (!game || !puzzle) return null;

  return (
    <div className="puzzle-layout" id="puzzle-layout">
      <div className="board-section">
        <ChessGame
          game={game}
          onMove={onMove}
          boardWidth={boardWidth}
          orientation={puzzle.orientation}
          allowMoves={puzzleState === 'playing'}
          highlightSquares={highlightSquares}
        />
      </div>

      <div className="puzzle-panel">
        {/* Puzzle Info */}
        <div className="card" id="puzzle-info">
          <div className="card-header">
            <span className="card-title">Lichess Puzzle #{puzzle.id}</span>
            <span className="badge badge-gold">Rating {puzzle.rating}</span>
          </div>
          <div className="puzzle-info">
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <select 
                value={theme}
                onChange={(e) => {
                  setTheme(e.target.value);
                  fetchPuzzle(e.target.value);
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="mix">🎲 Mixed Daily</option>
                <option value="mateIn1">🎯 Mate in 1</option>
                <option value="mateIn2">🎯 Mate in 2</option>
                <option value="fork">🔱 Forks</option>
                <option value="pin">📍 Pins</option>
                <option value="skewer">🍢 Skewers</option>
                <option value="endgame">🏁 Endgames</option>
                <option value="middlegame">⚔️ Middlegame</option>
                <option value="opening">🔰 Opening</option>
                <option value="defensiveMove">🛡️ Defense</option>
                <option value="sacrifice">💥 Sacrifice</option>
                <option value="xRayAttack">🔦 X-Ray</option>
              </select>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', textTransform: 'capitalize' }}>
              {puzzle.theme}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>
              {puzzle.orientation === 'white' ? '♔' : '♚'}{' '}
              {puzzle.orientation === 'white' ? 'White' : 'Black'} to play
            </div>
          </div>
        </div>

        {/* Puzzle State */}
        <div className="card" id="puzzle-state">
          <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
            {puzzleState === 'playing' && (
              <>
                <div style={{ fontSize: '24px', marginBottom: 'var(--space-sm)' }}>🤔</div>
                <div style={{ fontWeight: 600, marginBottom: 'var(--space-sm)' }}>Find the best move!</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Step {Math.floor(solutionStep/2) + 1} of {Math.ceil(puzzle.solution.length/2)}
                </div>
              </>
            )}
            {puzzleState === 'correct' && (
              <>
                <div style={{ fontSize: '48px', marginBottom: 'var(--space-sm)' }}>🎉</div>
                <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--accent-green)' }}>Correct!</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 'var(--space-sm)' }}>
                  Great tactical vision!
                </div>
              </>
            )}
            {puzzleState === 'incorrect' && (
              <>
                <div style={{ fontSize: '48px', marginBottom: 'var(--space-sm)' }}>😔</div>
                <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--accent-red)' }}>Incorrect</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 'var(--space-sm)' }}>
                  The correct move was: <strong style={{ color: 'var(--accent-green)' }}>{puzzle.solution[solutionStep]}</strong>
                </div>
              </>
            )}
            {puzzleState === 'loading' && (
              <div style={{ padding: 'var(--space-md)' }}>
                <div className="spinner" style={{ margin: '0 auto var(--space-sm)', width: '20px', height: '20px' }} />
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading...</div>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="card">
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {puzzleState === 'playing' && (
              <button
                className="btn btn-secondary"
                onClick={() => setShowHint(!showHint)}
                id="btn-hint"
              >
                💡 {showHint ? `Hint: Move to ${puzzle.solution[solutionStep].substring(2,4)}` : 'Show Hint'}
              </button>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              {puzzleState !== 'playing' && puzzleState !== 'loading' && (
                <button
                  className="btn btn-secondary"
                  onClick={retryPuzzle}
                  id="btn-retry-puzzle"
                  style={{ flex: 1 }}
                >
                  🔄 Retry
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={() => fetchPuzzle(theme)}
                disabled={puzzleState === 'loading'}
                id="btn-next-puzzle"
                style={{ flex: 1 }}
              >
                Next Puzzle ▶
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="card" id="puzzle-stats">
          <div className="card-header">
            <span className="card-title">Stats</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-green)' }}>
                  {streak}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Streak</div>
              </div>
              <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
              <div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-gold)' }}>
                  {totalSolved}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Solved</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
