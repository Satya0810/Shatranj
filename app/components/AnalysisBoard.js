'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import { useSearchParams } from 'next/navigation';
import ChessGame from './ChessGame';
import MoveList from './MoveList';
import EvaluationBar from './EvaluationBar';
import StockfishEngine from '../lib/stockfish';
import { evaluateHeuristic, evaluateDetailed } from '../lib/heuristic';
import { fetchLichessCloudEval, uciToDisplay } from '../lib/lichess';
import { fetchLichessGamePgn } from '../lib/lichessDatabase';
import CoachFeedback from './CoachFeedback';
import EvaluationChart from './EvaluationChart';

const SAMPLE_PGN = `[Event "Immortal Game"]
[Site "London"]
[Date "1851.06.21"]
[White "Adolf Anderssen"]
[Black "Lionel Kieseritzky"]
[Result "1-0"]

1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7# 1-0`;

export default function AnalysisBoard() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get('gameId');
  const [game, setGame] = useState(new Chess());
  const [fullHistory, setFullHistory] = useState([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [evaluation, setEvaluation] = useState(0);
  const [mate, setMate] = useState(null);
  const [engineReady, setEngineReady] = useState(false);
  const [engineLines, setEngineLines] = useState([]);
  const [engineDepth, setEngineDepth] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lichessData, setLichessData] = useState(null);
  const [boardWidth, setBoardWidth] = useState(560);
  const [orientation, setOrientation] = useState('white');
  const [pgnInput, setPgnInput] = useState('');
  const [showPgnImport, setShowPgnImport] = useState(true);
  const [arrows, setArrows] = useState([]);
  const [highlightSquares, setHighlightSquares] = useState({});
  const [moveEvals, setMoveEvals] = useState({});
  const [moveClassifications, setMoveClassifications] = useState({});
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [fullGameAnalysisDone, setFullGameAnalysisDone] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [coachFeedback, setCoachFeedback] = useState(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [gameSummary, setGameSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const engineRef = useRef(null);
  const analysisTimeoutRef = useRef(null);

  const [shouldAutoAnalyze, setShouldAutoAnalyze] = useState(false);

  // Responsive board sizing
  useEffect(() => {
    const updateSize = () => {
      const maxHeight = window.innerHeight - 180;
      let maxWidth;
      if (window.innerWidth <= 1024) {
        maxWidth = window.innerWidth - 32;
      } else {
        // On desktop, leave room for the side panel (min 320px) + gaps
        maxWidth = Math.min(window.innerWidth - 420, 800);
      }
      setBoardWidth(Math.max(280, Math.min(maxWidth, maxHeight)));
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);


  // Initialize Stockfish for analysis
  useEffect(() => {
    const engine = new StockfishEngine();
    engineRef.current = engine;

    engine.onReady = () => {
      setEngineReady(true);
    };

    engine.init().then(() => {
      engine.setMultiPV(3); // Show 3 best lines
    });

    engine.onEvaluation = (evalData) => {
      if (evalData.type === 'mate') {
        setMate(evalData.value);
        setEvaluation(0);
      } else {
        setMate(null);
        setEvaluation(evalData.value);
      }
      setEngineDepth(evalData.depth || 0);

      // Update engine lines display
      if (evalData.lines) {
        setEngineLines(evalData.lines.filter(Boolean).map((line) => ({
          eval: line.type === 'mate' ? `M${Math.abs(line.value)}` : (line.value > 0 ? '+' : '') + line.value.toFixed(2),
          evalValue: line.value,
          type: line.type,
          moves: line.pv || '',
          depth: line.depth || 0,
          bestMove: line.bestMove || '',
        })));
      }

      // Show best move arrow
      if (evalData.lines && evalData.lines[0] && evalData.lines[0].bestMove) {
        const bm = evalData.lines[0].bestMove;
        if (bm && bm.length >= 4) {
          setArrows([[bm.substring(0, 2), bm.substring(2, 4), 'rgba(96, 165, 250, 0.7)']]);
        }
      }
    };

    return () => {
      engine.destroy();
      if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
    };
  }, []);

  // Update heuristic eval, detailed breakdown, and Lichess cloud eval when move changes
  const [heuristicEval, setHeuristicEval] = useState(0);
  const [heuristicBreakdown, setHeuristicBreakdown] = useState(null);
  useEffect(() => {
    const currentGame = new Chess();
    for (let i = 0; i <= currentMoveIndex && i < fullHistory.length; i++) {
      currentGame.move(fullHistory[i].san);
    }
    const fen = currentGame.fen();
    setHeuristicEval(evaluateHeuristic(fen));
    setHeuristicBreakdown(evaluateDetailed(fen));
    
    // Fetch Lichess cloud eval
    fetchLichessCloudEval(fen, 3).then((data) => {
      setLichessData(data);
    });
  }, [currentMoveIndex, fullHistory]);

  // Analyze current position when move changes
  useEffect(() => {
    if (engineRef.current && engineRef.current.isReady) {
      analyzeCurrentPosition();
    }
  }, [currentMoveIndex]);

  const analyzeCurrentPosition = useCallback(() => {
    if (!engineRef.current || !engineRef.current.isReady) return;
    if (analysisRunning || shouldAutoAnalyze) return; // Prevent collision with full game analysis
    const engine = engineRef.current;
    
    // Build position from moves
    const currentGame = new Chess();
    for (let i = 0; i <= currentMoveIndex && i < fullHistory.length; i++) {
      currentGame.move(fullHistory[i].san);
    }
    
    engine.stop();
    engine.setPosition(currentGame.fen());
    setIsAnalyzing(true);
    
    // Run analysis
    engine.onBestMove = () => {
      setIsAnalyzing(false);
    };
    
    engine.searchInfinite();
  }, [currentMoveIndex, fullHistory]);

  // Load a PGN string
  const loadPgn = useCallback((pgn) => {
    try {
      const newGame = new Chess();
      newGame.loadPgn(pgn);
      
      const moves = newGame.history({ verbose: true });
      setFullHistory(moves);
      setCurrentMoveIndex(moves.length - 1);
      setGame(newGame);
      setShowPgnImport(false);
      setMoveEvals({});
      setMoveClassifications({});
      setFullGameAnalysisDone(false);
      setAnalysisProgress(0);
      setCoachFeedback(null);
      setGameSummary(null);
      
      if (engineRef.current) {
        engineRef.current.newGame();
      }
    } catch (err) {
      alert('Invalid PGN format. Please check your input.');
    }
  }, []);

  const askCoach = async () => {
    if (currentMoveIndex < 0) return;
    setCoachLoading(true);
    setCoachFeedback(null);
    try {
      const playedMove = fullHistory[currentMoveIndex];
      
      // Build the sfData from engineLines
      const sfData = engineLines && engineLines.length > 0 ? {
        eval: engineLines[0].evalValue,
        centipawns: engineLines[0].type === 'cp' ? Math.round(engineLines[0].evalValue * 100) : 0,
        mate: engineLines[0].type === 'mate' ? engineLines[0].evalValue : null,
        depth: engineLines[0].depth,
        move: engineLines[0].bestMove || (engineLines[0].moves ? engineLines[0].moves.split(' ')[0] : undefined)
      } : undefined;

      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen: game.fen(),
          moveNumber: Math.floor(currentMoveIndex / 2) + 1,
          playerColor: currentMoveIndex % 2 === 0 ? 'white' : 'black',
          playedMoveSan: playedMove ? playedMove.san : undefined,
          playedMoveUci: playedMove ? playedMove.from + playedMove.to : undefined,
          cloudData: lichessData,
          sfData: sfData,
          positionBreakdown: heuristicBreakdown
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCoachFeedback(data);
    } catch (e) {
      alert('Failed to get coach feedback: ' + e.message);
    } finally {
      setCoachLoading(false);
    }
  };

  // Full game analysis
  const runFullAnalysis = useCallback(async () => {
    if (!engineRef.current || !engineRef.current.isReady) return;
    if (fullHistory.length === 0) return;

    setAnalysisRunning(true);
    setFullGameAnalysisDone(false);
    const engine = engineRef.current;
    const evals = {};
    const classifications = {};
    
    engine.setMultiPV(1); // Use single PV for speed during full analysis

    for (let i = 0; i < fullHistory.length; i++) {
      setAnalysisProgress(Math.round(((i + 1) / fullHistory.length) * 100));
      
      // Build position up to move i
      const tempGame = new Chess();
      for (let j = 0; j <= i; j++) {
        tempGame.move(fullHistory[j].san);
      }

      // Analyze this position
      await new Promise((resolve) => {
        if (tempGame.isGameOver()) {
          let evalValue = 0;
          if (tempGame.isCheckmate()) {
            evalValue = tempGame.turn() === 'w' ? -10000 : 10000;
          }
          evals[i] = evalValue;
          
          // Classify the final move that led to game over
          const prevEval = i > 0 ? (evals[i - 1] || 0) : 30;
          const isWhiteMove = fullHistory[i].color === 'w';
          const absEval = evalValue;
          const evalDrop = isWhiteMove ? (prevEval - absEval) : (absEval - prevEval);
          
          if (evalDrop <= -150) classifications[i] = 'brilliant';
          else if (evalDrop <= -75) classifications[i] = 'great';
          else classifications[i] = 'best';
          
          resolve();
          return;
        }

        let isResolved = false;
        engine.setPosition(tempGame.fen());
        engine.currentEval = null; // Clear stale evaluations to prevent perspective flipping

        engine.onBestMove = () => {
          if (isResolved) return;
          isResolved = true;

          let absEval;
          if (engine.currentEval) {
            let evalValue = 0;
            if (engine.currentEval.type === 'mate') {
              evalValue = Math.sign(engine.currentEval.value) * 10000 - engine.currentEval.value * 100;
            } else if (engine.currentEval.value !== undefined) {
              evalValue = engine.currentEval.value * 100; // Convert pawns to centipawns
            }
            // Store all evaluations from White's absolute perspective
            absEval = tempGame.turn() === 'w' ? evalValue : -evalValue;
          } else {
            // Engine instantly output bestmove (e.g. single legal move) without evaluation info
            absEval = i > 0 ? (evals[i - 1] || 0) : 30;
          }
          evals[i] = absEval;

          // Classify the move that led to this position (move i)
          const prevEval = i > 0 ? (evals[i - 1] || 0) : 30; // 30cp is standard start pos eval
          const isWhiteMove = fullHistory[i].color === 'w'; 
          
          // evalDrop: how much advantage the moving player LOST in centipawns.
          const evalDrop = isWhiteMove ? (prevEval - absEval) : (absEval - prevEval);

          // Calculate Lichess Win% drop
          const eBefore = isWhiteMove ? prevEval : -prevEval;
          const eAfter = isWhiteMove ? absEval : -absEval;
          const wBefore = 50 + 50 * (2 / Math.PI) * Math.atan(eBefore / 290);
          const wAfter = 50 + 50 * (2 / Math.PI) * Math.atan(eAfter / 290);
          const loss = Math.max(0, wBefore - wAfter);

          if (i <= 10 && evalDrop < 50) {
            classifications[i] = 'book';
          } else if (evalDrop <= -150) {
            classifications[i] = 'brilliant';
          } else if (evalDrop <= -75) {
            classifications[i] = 'great';
          } else if (loss >= 20) {
            if (wBefore > 70 && wAfter >= 40) {
              classifications[i] = 'miss';
            } else {
              classifications[i] = 'blunder';
            }
          } else if (loss >= 15) {
            classifications[i] = 'mistake';
          } else if (loss >= 10) {
            classifications[i] = 'inaccuracy';
          } else if (loss >= 5) {
            classifications[i] = 'good';
          } else if (loss >= 2) {
            classifications[i] = 'excellent';
          } else {
            classifications[i] = 'best';
          }
          
          resolve();
        };
        // Search up to depth 12. This analyzes every single move accurately while being ~5x faster than Depth 16.
        engine.search(12); 
      });
    }

    setMoveEvals(evals);
    setMoveClassifications(classifications);
    setFullGameAnalysisDone(true);
    setAnalysisRunning(false);

    // Calculate accuracies and counts for the AI coach
    const categories = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];
    const counts = Object.fromEntries(categories.map(c => [c, 0]));
    Object.values(classifications).forEach(c => {
      if (counts[c] !== undefined) counts[c]++;
    });

    let whiteAccSum = 0; let blackAccSum = 0;
    let whiteMovesCount = 0; let blackMovesCount = 0;
    for (let i = 0; i < fullHistory.length; i++) {
      const isWhiteMove = fullHistory[i].color === 'w';
      const prevEval = i > 0 ? (evals[i - 1] || 0) : 30; // 30cp for start position
      const absEval = evals[i] || 0;
      const eBefore = isWhiteMove ? prevEval : -prevEval;
      const eAfter = isWhiteMove ? absEval : -absEval;
      const wBefore = 50 + 50 * (2 / Math.PI) * Math.atan(eBefore / 290);
      const wAfter = 50 + 50 * (2 / Math.PI) * Math.atan(eAfter / 290);
      const loss = Math.max(0, wBefore - wAfter);
      const moveAcc = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));
      
      if (isWhiteMove) { whiteAccSum += moveAcc; whiteMovesCount++; } 
      else { blackAccSum += moveAcc; blackMovesCount++; }
    }
    const whiteAccuracy = whiteMovesCount > 0 ? Math.round(whiteAccSum / whiteMovesCount) : 100;
    const blackAccuracy = blackMovesCount > 0 ? Math.round(blackAccSum / blackMovesCount) : 100;

    // Fetch Game Summary automatically
    setSummaryLoading(true);
    fetch('/api/coach/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pgn: game.pgn(),
        counts,
        whiteAccuracy,
        blackAccuracy
      })
    })
    .then(res => res.json())
    .then(data => {
      setGameSummary(data);
      setSummaryLoading(false);
    })
    .catch(() => setSummaryLoading(false));

    // Save Analysis to DB if gameId is present
    if (gameId) {
      // Need token for auth
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      if (token) {
        fetch(`/api/games/${gameId}/analysis`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            analysisReport: {
              whiteAccuracy,
              blackAccuracy,
              classifications: counts
            }
          })
        }).catch(err => console.error("Failed to save analysis:", err));
      }
    }
    
    // Restore multi PV for live analysis
    engine.setMultiPV(3);
  }, [fullHistory, gameId]);

  // Load PGN from URL params
  useEffect(() => {
    const pgnParam = searchParams.get('pgn');
    const autoAnalyzeParam = searchParams.get('autoAnalyze');
    const lichessGameId = searchParams.get('lichessGameId');
    const orientationParam = searchParams.get('orientation');

    if (orientationParam && (orientationParam === 'white' || orientationParam === 'black')) {
      setOrientation(orientationParam);
    }

    if (pgnParam) {
      setPgnInput(pgnParam);
      loadPgn(pgnParam);
      if (autoAnalyzeParam === 'true') {
        setShouldAutoAnalyze(true);
      }
    } else if (lichessGameId) {
      fetchLichessGamePgn(lichessGameId)
        .then(pgnText => {
          setPgnInput(pgnText);
          loadPgn(pgnText);
          if (autoAnalyzeParam === 'true') {
            setShouldAutoAnalyze(true);
          }
        })
        .catch(err => {
          console.error("Failed to fetch Lichess game:", err);
        });
    } else if (gameId) {
      // If we have a local gameId, we should fetch it if we don't already pass PGN
      // However, usually PGN is passed via searchParams or we can just fetch it here.
      fetch(`/api/games/${gameId}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.pgn) {
            setPgnInput(data.pgn);
            loadPgn(data.pgn);
            if (autoAnalyzeParam === 'true') {
              setShouldAutoAnalyze(true);
            }
          }
        })
        .catch(err => console.error("Failed to fetch local game:", err));
    }
  }, [searchParams, loadPgn]);

  // Auto trigger full analysis if requested
  useEffect(() => {
    if (shouldAutoAnalyze && engineReady && fullHistory.length > 0 && !analysisRunning && !fullGameAnalysisDone) {
      setShouldAutoAnalyze(false);
      runFullAnalysis();
    }
  }, [shouldAutoAnalyze, engineReady, fullHistory, analysisRunning, fullGameAnalysisDone, runFullAnalysis]);

  // Navigate to a specific move
  const goToMove = useCallback((index) => {
    if (index < -1 || index >= fullHistory.length) return;
    const newGame = new Chess();
    for (let i = 0; i <= index; i++) {
      newGame.move(fullHistory[i].san);
    }
    setGame(newGame);
    setCurrentMoveIndex(index);
    
    // Highlight last move
    if (index >= 0) {
      const move = fullHistory[index];
      setHighlightSquares({
        [move.from]: { background: 'rgba(255, 255, 0, 0.3)' },
        [move.to]: { background: 'rgba(255, 255, 0, 0.3)' },
      });
    } else {
      setHighlightSquares({});
    }
  }, [fullHistory]);

  // Handle move on the analysis board (add to history)
  const onMove = useCallback((move) => {
    // If we're not at the end, truncate future moves
    const newHistory = fullHistory.slice(0, currentMoveIndex + 1);
    newHistory.push(move);
    setFullHistory(newHistory);
    setCurrentMoveIndex(newHistory.length - 1);
    
    const newGame = new Chess(game.fen());
    newGame.move(move.san);
    setGame(new Chess(newGame.fen()));
    
    setHighlightSquares({
      [move.from]: { background: 'rgba(255, 255, 0, 0.3)' },
      [move.to]: { background: 'rgba(255, 255, 0, 0.3)' },
    });
  }, [game, fullHistory, currentMoveIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goToMove(Math.max(-1, currentMoveIndex - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToMove(Math.min(fullHistory.length - 1, currentMoveIndex + 1));
          break;
        case 'Home':
          e.preventDefault();
          goToMove(-1);
          break;
        case 'End':
          e.preventDefault();
          goToMove(fullHistory.length - 1);
          break;
        case 'f':
          if (!e.ctrlKey && !e.metaKey) {
            setOrientation(prev => prev === 'white' ? 'black' : 'white');
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentMoveIndex, fullHistory, goToMove]);

  // Convert UCI moves to SAN for display
  const formatPvMoves = useCallback((pvString) => {
    if (!pvString) return '';
    try {
      const tempGame = new Chess();
      // Rebuild to current position
      for (let i = 0; i <= currentMoveIndex && i < fullHistory.length; i++) {
        tempGame.move(fullHistory[i].san);
      }
      const uciMoves = pvString.split(' ');
      const sanMoves = [];
      for (const uci of uciMoves.slice(0, 8)) {
        try {
          const m = tempGame.move({
            from: uci.substring(0, 2),
            to: uci.substring(2, 4),
            promotion: uci.length > 4 ? uci[4] : undefined,
          });
          if (m) sanMoves.push(m.san);
          else break;
        } catch {
          break;
        }
      }
      return sanMoves.join(' ');
    } catch {
      return pvString;
    }
  }, [currentMoveIndex, fullHistory]);

  // PGN Import View
  if (showPgnImport) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }} id="pgn-import-view">
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>
            📊 Game Analysis
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Import a PGN to analyze with Stockfish, or start from an empty board
          </p>
        </div>

        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="card-header">
            <span className="card-title">Import PGN</span>
          </div>
          <div className="pgn-import-area">
            <textarea
              className="input"
              value={pgnInput}
              onChange={(e) => setPgnInput(e.target.value)}
              placeholder="Paste your PGN here..."
              id="pgn-textarea"
              style={{ width: '100%', minHeight: '180px' }}
            />
            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={() => loadPgn(pgnInput)}
                disabled={!pgnInput.trim()}
                id="btn-load-pgn"
              >
                📥 Load PGN
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setPgnInput(SAMPLE_PGN);
                  loadPgn(SAMPLE_PGN);
                }}
                id="btn-sample-pgn"
              >
                📋 Load Sample Game
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowPgnImport(false);
                  setFullHistory([]);
                  setCurrentMoveIndex(-1);
                  setGame(new Chess());
                }}
                id="btn-empty-board"
              >
                ♟️ Empty Board
              </button>
            </div>
          </div>
        </div>

        {/* Quick tips */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Tips</span>
          </div>
          <div className="card-body">
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <li>• Use <kbd style={{ padding: '2px 6px', background: 'var(--bg-surface)', borderRadius: '4px', fontSize: '11px' }}>← →</kbd> arrow keys to navigate moves</li>
              <li>• Press <kbd style={{ padding: '2px 6px', background: 'var(--bg-surface)', borderRadius: '4px', fontSize: '11px' }}>F</kbd> to flip the board</li>
              <li>• Click on engine lines to see the suggested continuation</li>
              <li>• You can add moves to explore variations</li>
              <li>• Copy your PGN from Chess.com, Lichess, or any chess platform</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="play-layout" id="analysis-layout">
      {/* Board Section */}
      <div className="analysis-board-section">
        <EvaluationBar evaluation={evaluation} mate={mate} orientation={orientation} />
        <div className="board-section">
          <div className="eval-bar-horizontal" style={{ display: 'none' }}>
            <div className="eval-bar-fill" style={{ width: `${50 + (evaluation / 10) * 50}%` }} />
          </div>
          <ChessGame
            game={game}
            onMove={onMove}
            boardWidth={boardWidth}
            orientation={orientation}
            allowMoves={true}
            highlightSquares={highlightSquares}
            arrowsOnBoard={arrows}
          />
        </div>
      </div>

      {/* Analysis Panel */}
      <div className="analysis-panel">
        {/* Engine Lines */}
        <div className="card" id="engine-lines-card">
          <div className="card-header">
            <span className="card-title">Engine Lines</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                heuristic: {heuristicEval > 0 ? '+' : ''}{heuristicEval.toFixed(2)}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                | depth {engineDepth}
              </span>
              <div className={`engine-indicator ${isAnalyzing ? '' : 'stopped'}`}
                style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: isAnalyzing ? 'var(--accent-green)' : 'var(--text-muted)',
                  animation: isAnalyzing ? 'pulse 2s infinite' : 'none',
                }}
              />
            </div>
          </div>
          <div className="engine-lines">
            {engineLines.length === 0 ? (
              <div style={{ padding: 'var(--space-md)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                {isAnalyzing ? 'Analyzing position...' : 'Engine not started'}
              </div>
            ) : (
              engineLines.map((line, i) => (
                <div className="engine-line" key={i} id={`engine-line-${i}`}>
                  <span className={`engine-eval ${
                    line.type === 'mate' 
                      ? (line.evalValue > 0 ? 'positive' : 'negative')
                      : (line.evalValue > 0 ? 'positive' : line.evalValue < 0 ? 'negative' : '')
                  }`}>
                    {line.eval}
                  </span>
                  <span className="engine-moves">
                    {formatPvMoves(line.moves)}
                  </span>
                  <span className="engine-depth">d{line.depth}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Move List */}
        <MoveList
          history={fullHistory}
          currentMoveIndex={currentMoveIndex}
          onMoveClick={goToMove}
          moveClassifications={moveClassifications}
          onFirst={() => goToMove(-1)}
          onPrev={() => goToMove(Math.max(-1, currentMoveIndex - 1))}
          onNext={() => goToMove(Math.min(fullHistory.length - 1, currentMoveIndex + 1))}
          onLast={() => goToMove(fullHistory.length - 1)}
        />

        {/* Analysis Controls */}
        <div className="card">
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {/* Full Game Analysis */}
            {fullHistory.length > 0 && (
              <button
                className="btn btn-primary"
                onClick={runFullAnalysis}
                disabled={analysisRunning || !engineReady}
                id="btn-full-analysis"
                style={{ width: '100%' }}
              >
                {!engineReady ? '⏳ Loading Engine...' : analysisRunning ? (
                  <>
                    <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                    Analyzing... {analysisProgress}%
                  </>
                ) : fullGameAnalysisDone ? (
                  '✅ Analysis Complete — Reanalyze'
                ) : (
                  '🔍 Full Game Analysis'
                )}
              </button>
            )}

            {/* Ask AI Coach */}
            {fullHistory.length > 0 && currentMoveIndex >= 0 && (
              <button
                className="btn"
                style={{ 
                  background: 'linear-gradient(135deg, var(--accent-blue), #4a8cdb)',
                  color: 'white',
                  width: '100%',
                  marginTop: '8px'
                }}
                onClick={askCoach}
                disabled={coachLoading}
                id="btn-ask-coach"
              >
                {coachLoading ? '🧠 Coach is thinking...' : '🤖 Ask AI Coach'}
              </button>
            )}

            {analysisRunning && (
              <div style={{
                height: '4px', background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-full)', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: `${analysisProgress}%`,
                  background: 'var(--accent-green)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setOrientation(prev => prev === 'white' ? 'black' : 'white')}
                id="btn-flip-board"
                style={{ flex: 1 }}
              >
                🔄 Flip
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowPgnImport(true);
                  if (engineRef.current) engineRef.current.stop();
                }}
                id="btn-new-analysis"
                style={{ flex: 1 }}
              >
                📥 Import
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const pgn = game.pgn();
                  navigator.clipboard.writeText(pgn).then(() => {
                    alert('PGN copied to clipboard!');
                  });
                }}
                id="btn-copy-pgn"
                style={{ flex: 1 }}
              >
                📋 PGN
              </button>
            </div>
          </div>
        </div>

        {/* Coach Feedback */}
        {(coachFeedback || coachLoading) && (
          <CoachFeedback feedback={coachFeedback} loading={coachLoading} />
        )}

        {/* Evaluation summary when full analysis is done */}
        {fullGameAnalysisDone && (
          <div className="card" id="analysis-summary">
            <div className="card-header">
              <span className="card-title">Analysis Summary</span>
            </div>
            <div className="card-body">
              {(() => {
                const categories = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];
                const counts = Object.fromEntries(categories.map(c => [c, 0]));
                const whiteCounts = Object.fromEntries(categories.map(c => [c, 0]));
                const blackCounts = Object.fromEntries(categories.map(c => [c, 0]));
                
                Object.entries(moveClassifications).forEach(([idx, c]) => {
                  if (counts[c] !== undefined) {
                    counts[c]++;
                    if (parseInt(idx) % 2 === 0) whiteCounts[c]++;
                    else blackCounts[c]++;
                  }
                });

                let whiteAccSum = 0;
                let blackAccSum = 0;
                let whiteAcplSum = 0;
                let blackAcplSum = 0;
                let whiteMovesCount = 0;
                let blackMovesCount = 0;

                for (let i = 0; i < fullHistory.length; i++) {
                  const isWhiteMove = fullHistory[i].color === 'w';
                  const prevEval = i > 0 ? (moveEvals[i - 1] || 0) : 30;
                  const absEval = moveEvals[i] || 0;

                  // Evaluations from the perspective of the player making the move
                  const eBefore = isWhiteMove ? prevEval : -prevEval;
                  const eAfter = isWhiteMove ? absEval : -absEval;

                  // Lichess Win Probability formula
                  const wBefore = 50 + 50 * (2 / Math.PI) * Math.atan(eBefore / 290);
                  const wAfter = 50 + 50 * (2 / Math.PI) * Math.atan(eAfter / 290);
                  
                  // Loss in win probability
                  const loss = Math.max(0, wBefore - wAfter);

                  // Centipawn loss (cap at 1000 to prevent a single blunder from destroying everything)
                  const cpl = Math.max(0, Math.min(1000, eBefore - eAfter));

                  // Lichess Move Accuracy formula
                  const moveAcc = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));

                  if (isWhiteMove) {
                    whiteAccSum += moveAcc;
                    whiteAcplSum += cpl;
                    whiteMovesCount++;
                  } else {
                    blackAccSum += moveAcc;
                    blackAcplSum += cpl;
                    blackMovesCount++;
                  }
                }

                const whiteAccuracy = whiteMovesCount > 0 ? Math.round(whiteAccSum / whiteMovesCount) : 100;
                const blackAccuracy = blackMovesCount > 0 ? Math.round(blackAccSum / blackMovesCount) : 100;
                
                const whiteAcpl = whiteMovesCount > 0 ? Math.round(whiteAcplSum / whiteMovesCount) : 0;
                const blackAcpl = blackMovesCount > 0 ? Math.round(blackAcplSum / blackMovesCount) : 0;

                const getEstimatedElo = (acc, acpl) => {
                  // Accuracy-based ELO estimation (Quadratic curve based on CAPS statistics)
                  let eloAcc = 400;
                  if (acc >= 50) {
                    eloAcc = 400 + 2800 * Math.pow((acc - 50) / 50, 2);
                  } else {
                    eloAcc = 100 + (acc / 50) * 300;
                  }

                  // ACPL-based ELO estimation (Exponential curve based on centipawn loss research)
                  const eloAcpl = 3200 * Math.exp(-0.015 * acpl);

                  // Blend them together for a highly robust "Game Rating"
                  let finalElo = Math.round((eloAcc + eloAcpl) / 2);
                  
                  return Math.max(100, Math.min(3200, finalElo));
                };

                const whiteElo = getEstimatedElo(whiteAccuracy, whiteAcpl);
                const blackElo = getEstimatedElo(blackAccuracy, blackAcpl);

                const getRowStyle = (color) => ({ textAlign: 'center', fontFamily: 'var(--font-mono)', color });

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    {/* Accuracy Bars */}
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

                    {/* Move Classification Table */}
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
                          <td style={{ padding: '6px 0', color: '#1baca6', fontWeight: 600 }}>!! Brilliant</td>
                          <td style={getRowStyle('#1baca6')}>{whiteCounts.brilliant}</td>
                          <td style={getRowStyle('#1baca6')}>{blackCounts.brilliant}</td>
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1baca6' }}>{counts.brilliant}</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '6px 0', color: '#5c8bb0', fontWeight: 600 }}>! Great</td>
                          <td style={getRowStyle('#5c8bb0')}>{whiteCounts.great}</td>
                          <td style={getRowStyle('#5c8bb0')}>{blackCounts.great}</td>
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#5c8bb0' }}>{counts.great}</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '6px 0', color: '#81b64a', fontWeight: 600 }}>★ Best</td>
                          <td style={getRowStyle('#81b64a')}>{whiteCounts.best}</td>
                          <td style={getRowStyle('#81b64a')}>{blackCounts.best}</td>
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#81b64a' }}>{counts.best}</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '6px 0', color: '#96bc4b', fontWeight: 600 }}>👍 Excellent</td>
                          <td style={getRowStyle('#96bc4b')}>{whiteCounts.excellent}</td>
                          <td style={getRowStyle('#96bc4b')}>{blackCounts.excellent}</td>
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#96bc4b' }}>{counts.excellent}</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '6px 0', color: '#96bc4b', fontWeight: 600 }}>✅ Good</td>
                          <td style={getRowStyle('#96bc4b')}>{whiteCounts.good}</td>
                          <td style={getRowStyle('#96bc4b')}>{blackCounts.good}</td>
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#96bc4b' }}>{counts.good}</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '6px 0', color: '#d5a47d', fontWeight: 600 }}>📖 Book</td>
                          <td style={getRowStyle('#d5a47d')}>{whiteCounts.book}</td>
                          <td style={getRowStyle('#d5a47d')}>{blackCounts.book}</td>
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#d5a47d' }}>{counts.book}</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '6px 0', color: '#f3ae16', fontWeight: 600 }}>?! Inaccuracy</td>
                          <td style={getRowStyle('#f3ae16')}>{whiteCounts.inaccuracy}</td>
                          <td style={getRowStyle('#f3ae16')}>{blackCounts.inaccuracy}</td>
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#f3ae16' }}>{counts.inaccuracy}</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '6px 0', color: '#e58f2a', fontWeight: 600 }}>? Mistake</td>
                          <td style={getRowStyle('#e58f2a')}>{whiteCounts.mistake}</td>
                          <td style={getRowStyle('#e58f2a')}>{blackCounts.mistake}</td>
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#e58f2a' }}>{counts.mistake}</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '6px 0', color: '#ff7769', fontWeight: 600 }}>❌ Miss</td>
                          <td style={getRowStyle('#ff7769')}>{whiteCounts.miss}</td>
                          <td style={getRowStyle('#ff7769')}>{blackCounts.miss}</td>
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#ff7769' }}>{counts.miss}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '6px 0', color: '#ca3431', fontWeight: 600 }}>?? Blunder</td>
                          <td style={getRowStyle('#ca3431')}>{whiteCounts.blunder}</td>
                          <td style={getRowStyle('#ca3431')}>{blackCounts.blunder}</td>
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#ca3431' }}>{counts.blunder}</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Evaluation Chart */}
                    <EvaluationChart evals={moveEvals} historyLength={fullHistory.length} />

                    {/* AI Coach Game Summary */}
                    {summaryLoading ? (
                      <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>AI Coach is summarizing the game...</span>
                      </div>
                    ) : gameSummary && !gameSummary.error ? (
                      <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(129, 182, 74, 0.3)' }}>
                        <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--accent-green)', marginBottom: '8px', fontWeight: 700 }}>
                          🤖 AI Game Summary
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
                          {gameSummary.title}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', whiteSpace: 'pre-wrap' }}>
                          {gameSummary.summary}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-blue)', borderLeft: '3px solid var(--accent-blue)', paddingLeft: '8px' }}>
                          💡 Key Takeaway: {gameSummary.key_takeaway}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Heuristic Breakdown Panel */}
        {heuristicBreakdown && (
          <div className="card" style={{ marginTop: 'var(--space-md)' }}>
            <div className="card-header">
              <span className="card-title">Position Breakdown</span>
              <span className="badge badge-blue">{heuristicBreakdown.phase}</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                {[
                  { label: 'Material & Position', value: heuristicBreakdown.material, icon: '♟️' },
                  { label: 'Pawn Structure', value: heuristicBreakdown.pawnStructure, icon: '🏗️' },
                  { label: 'King Safety', value: heuristicBreakdown.kingSafety, icon: '🛡️' },
                  { label: 'Bishop Pair', value: heuristicBreakdown.bishopPair, icon: '🔷' },
                  { label: 'Rook Activity', value: heuristicBreakdown.rookFiles, icon: '🏰' },
                  { label: 'Center Control', value: heuristicBreakdown.centerControl, icon: '🎯' },
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{item.icon} {item.label}</span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontWeight: 600,
                      color: item.value > 0.05 ? 'var(--accent-green)' : item.value < -0.05 ? 'var(--accent-red)' : 'var(--text-muted)',
                    }}>
                      {item.value > 0 ? '+' : ''}{item.value.toFixed(2)}
                    </span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
                  <span>Total Evaluation</span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '15px',
                    color: heuristicBreakdown.total > 0.1 ? 'var(--accent-green)' : heuristicBreakdown.total < -0.1 ? 'var(--accent-red)' : 'var(--text-primary)',
                  }}>
                    {heuristicBreakdown.total > 0 ? '+' : ''}{heuristicBreakdown.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lichess Cloud Eval Panel */}
        <div className="card" style={{ marginTop: 'var(--space-md)' }}>
          <div className="card-header">
            <span className="card-title">Cloud Analysis</span>
            <span className="badge badge-green">Lichess</span>
          </div>
          <div className="card-body">
            {!lichessData ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {fullHistory.length === 0 ? 'Load a game to see cloud evaluations.' : 'Fetching from Lichess cloud...'}
              </div>
            ) : lichessData.pvs && lichessData.pvs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Depth: {lichessData.depth}</span>
                  <span>{(lichessData.knodes / 1000).toFixed(0)}M nodes</span>
                </div>
                {lichessData.pvs.map((pv, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 8px', borderRadius: '6px',
                    background: idx === 0 ? 'rgba(96, 165, 250, 0.08)' : 'transparent',
                    borderLeft: idx === 0 ? '3px solid var(--accent-primary)' : '3px solid transparent',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontWeight: 700, minWidth: '50px', fontSize: '13px',
                      color: pv.cp !== null
                        ? (pv.cp > 0.1 ? 'var(--accent-green)' : pv.cp < -0.1 ? 'var(--accent-red)' : 'var(--text-primary)')
                        : 'var(--accent-primary)',
                    }}>
                      {pv.eval}
                    </span>
                    <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {pv.moves.slice(0, 6).map(m => uciToDisplay(m)).join('  ')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Position not found in Lichess cloud database.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
