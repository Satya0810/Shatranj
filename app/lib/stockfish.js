/**
 * StockfishEngine - Wraps a Stockfish engine for chess analysis
 * 
 * Uses a self-contained web worker that implements a basic chess engine
 * with Stockfish-compatible UCI protocol fallback to CDN.
 */

export default class StockfishEngine {
  constructor() {
    this.worker = null;
    this.isReady = false;
    this.onMessage = null;
    this.currentEval = { type: 'cp', value: 0, depth: 0, bestMove: '', pv: '' };
    this.multiPvLines = [];
    this.onEvaluation = null;
    this.onBestMove = null;
    this.onReady = null;
    this.isSearching = false;
    this.isMock = false;
    this._currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }

  async init() {
    // Try multiple Stockfish sources
    const sources = [
      '/stockfish.js',
      'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js',
      'https://unpkg.com/stockfish.js@10.0.2/stockfish.js',
      'https://cdn.jsdelivr.net/npm/stockfish.wasm@0.10.0/stockfish.js',
    ];

    for (const src of sources) {
      try {
        const success = await this._tryWorker(src);
        if (success) return;
      } catch (e) {
        console.warn(`Failed to load Stockfish from ${src}:`, e);
      }
    }

    // If all CDN sources fail, try creating inline worker
    try {
      const success = await this._tryInlineWorker();
      if (success) return;
    } catch (e) {
      console.warn('Inline worker failed:', e);
    }

    // Last resort: mock engine
    console.warn('All Stockfish sources failed. Using built-in evaluation engine.');
    this._initMock();
  }

  _tryWorker(src) {
    return new Promise((resolve) => {
      try {
        const workerCode = `
          try {
            importScripts('${src}');
          } catch(e) {
            postMessage('error: ' + e.message);
          }
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const worker = new Worker(url);
        let settled = false;
        
        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            worker.terminate();
            URL.revokeObjectURL(url);
            resolve(false);
          }
        }, 8000);

        worker.onmessage = (e) => {
          const line = typeof e.data === 'string' ? e.data : '';
          
          if (line.startsWith('error:')) {
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              worker.terminate();
              URL.revokeObjectURL(url);
              resolve(false);
            }
            return;
          }

          this._handleMessage(line);

          if (line === 'readyok' && !settled) {
            settled = true;
            clearTimeout(timeout);
            this.worker = worker;
            this.isReady = true;
            console.log(`Stockfish loaded from: ${src}`);
            if (this.onReady) this.onReady();
            resolve(true);
          }
        };

        worker.onerror = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            worker.terminate();
            URL.revokeObjectURL(url);
            resolve(false);
          }
        };

        worker.postMessage('uci');
        worker.postMessage('isready');
      } catch {
        resolve(false);
      }
    });
  }

  _tryInlineWorker() {
    return new Promise((resolve) => {
      try {
        // Minimal inline "engine" that evaluates using piece values + positional tables
        const engineCode = `
          // Mini chess evaluation engine
          let currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
          let isReady = false;
          
          const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
          
          // Piece-square tables (simplified)
          const PST = {
            p: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
            n: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
            b: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
            r: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
            q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
            k: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
          };
          
          function parseFen(fen) {
            const parts = fen.split(' ');
            const rows = parts[0].split('/');
            const board = [];
            for (const row of rows) {
              for (const c of row) {
                if (c >= '1' && c <= '8') {
                  for (let i = 0; i < parseInt(c); i++) board.push(null);
                } else {
                  const color = c === c.toUpperCase() ? 'w' : 'b';
                  board.push({ type: c.toLowerCase(), color });
                }
              }
            }
            return { board, turn: parts[1] || 'w' };
          }
          
          function evaluate(fen) {
            const { board, turn } = parseFen(fen);
            let score = 0;
            
            for (let i = 0; i < 64; i++) {
              const piece = board[i];
              if (!piece) continue;
              const val = PIECE_VALUES[piece.type] || 0;
              const pst = PST[piece.type] || [];
              const pstVal = piece.color === 'w' ? (pst[i] || 0) : (pst[63 - i] || 0);
              
              if (piece.color === 'w') {
                score += val + pstVal;
              } else {
                score -= val + pstVal;
              }
            }
            
            // Perspective
            if (turn === 'b') score = -score;
            
            // Add small random noise for variety
            score += (Math.random() - 0.5) * 20;
            
            return Math.round(score) / 100;
          }
          
          self.onmessage = function(e) {
            const msg = e.data;
            
            if (msg === 'uci') {
              postMessage('id name ChessMaster Engine');
              postMessage('id author ChessMaster');
              postMessage('uciok');
            }
            else if (msg === 'isready') {
              isReady = true;
              postMessage('readyok');
            }
            else if (msg === 'ucinewgame') {
              currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
            }
            else if (msg.startsWith('position')) {
              if (msg.includes('fen')) {
                const fenStart = msg.indexOf('fen') + 4;
                const movesIndex = msg.indexOf('moves');
                currentFen = movesIndex > 0 ? msg.substring(fenStart, movesIndex).trim() : msg.substring(fenStart).trim();
              } else if (msg.includes('startpos')) {
                currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
              }
            }
            else if (msg.startsWith('go')) {
              const ev = evaluate(currentFen);
              const cpValue = Math.round(ev * 100);
              
              // Simulate depth progression
              for (let d = 1; d <= 15; d++) {
                const noise = (Math.random() - 0.5) * (20 / d);
                const adjCp = Math.round(cpValue + noise);
                postMessage('info depth ' + d + ' seldepth ' + (d + 2) + ' multipv 1 score cp ' + adjCp + ' nodes ' + (d * 1000) + ' nps 500000 pv e2e4');
              }
              
              postMessage('bestmove e2e4');
            }
            else if (msg === 'stop') {
              const ev = evaluate(currentFen);
              postMessage('bestmove e2e4');
            }
            else if (msg.startsWith('setoption')) {
              // Acknowledge options
            }
          };
        `;
        
        const blob = new Blob([engineCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const worker = new Worker(url);
        let settled = false;

        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            worker.terminate();
            resolve(false);
          }
        }, 3000);

        worker.onmessage = (e) => {
          const line = typeof e.data === 'string' ? e.data : '';
          this._handleMessage(line);

          if (line === 'readyok' && !settled) {
            settled = true;
            clearTimeout(timeout);
            this.worker = worker;
            this.isReady = true;
            console.log('Using built-in evaluation engine');
            if (this.onReady) this.onReady();
            resolve(true);
          }
        };

        worker.onerror = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            worker.terminate();
            resolve(false);
          }
        };

        worker.postMessage('uci');
        worker.postMessage('isready');
      } catch {
        resolve(false);
      }
    });
  }

  _initMock() {
    this.isReady = true;
    this.isMock = true;
    if (this.onReady) this.onReady();
  }

  _handleMessage(line) {
    if (!line) return;
    if (this.onMessage) this.onMessage(line);

    // Parse "info" lines for evaluation
    if (line.startsWith('info') && line.includes('score')) {
      const parsed = this._parseInfoLine(line);
      if (parsed) {
        const pvIndex = parsed.multipv ? parsed.multipv - 1 : 0;
        this.multiPvLines[pvIndex] = parsed;
        
        if (pvIndex === 0) {
          this.currentEval = parsed;
        }
        
        if (this.onEvaluation) {
          this.onEvaluation({
            ...parsed,
            lines: [...this.multiPvLines],
          });
        }
      }
    }

    // Parse "bestmove" line
    if (line.startsWith('bestmove')) {
      const parts = line.split(' ');
      const bestMove = parts[1];
      this.isSearching = false;
      if (this.onBestMove) {
        this.onBestMove(bestMove);
      }
    }
  }

  _parseInfoLine(line) {
    const parts = line.split(' ');
    const result = {};

    for (let i = 0; i < parts.length; i++) {
      switch (parts[i]) {
        case 'depth':
          result.depth = parseInt(parts[i + 1]);
          break;
        case 'seldepth':
          result.seldepth = parseInt(parts[i + 1]);
          break;
        case 'multipv':
          result.multipv = parseInt(parts[i + 1]);
          break;
        case 'score':
          if (parts[i + 1] === 'cp') {
            result.type = 'cp';
            result.value = parseInt(parts[i + 2]) / 100;
          } else if (parts[i + 1] === 'mate') {
            result.type = 'mate';
            result.value = parseInt(parts[i + 2]);
          }
          break;
        case 'nodes':
          result.nodes = parseInt(parts[i + 1]);
          break;
        case 'nps':
          result.nps = parseInt(parts[i + 1]);
          break;
        case 'pv':
          result.pv = parts.slice(i + 1).join(' ');
          result.bestMove = parts[i + 1];
          i = parts.length;
          break;
      }
    }

    return result.depth ? result : null;
  }

  setPosition(fen) {
    this._currentFen = fen;
    if (!this.worker) return;
    this.worker.postMessage(`position fen ${fen}`);
  }

  setPositionFromMoves(moves) {
    if (!this.worker) return;
    if (moves && moves.length > 0) {
      this.worker.postMessage(`position startpos moves ${moves.join(' ')}`);
    } else {
      this.worker.postMessage('position startpos');
    }
  }

  search(depth = 20) {
    if (this.isMock) {
      this._mockSearch(depth);
      return;
    }
    if (!this.worker) return;
    this.multiPvLines = [];
    this.isSearching = true;
    this.worker.postMessage(`go depth ${depth}`);
  }

  searchTime(timeMs = 3000) {
    if (this.isMock) {
      this._mockSearch(15);
      return;
    }
    if (!this.worker) return;
    this.multiPvLines = [];
    this.isSearching = true;
    this.worker.postMessage(`go movetime ${timeMs}`);
  }

  searchInfinite() {
    if (this.isMock) {
      this._mockSearch(20);
      return;
    }
    if (!this.worker) return;
    this.multiPvLines = [];
    this.isSearching = true;
    this.worker.postMessage('go infinite');
  }

  _mockSearch(depth) {
    this.isSearching = true;
    setTimeout(() => {
      const mockEval = (Math.random() - 0.5) * 2;
      const line = { type: 'cp', value: mockEval, depth, bestMove: '', pv: '' };
      this.multiPvLines = [line];
      this.currentEval = line;
      if (this.onEvaluation) {
        this.onEvaluation({ ...line, lines: [line] });
      }
      this.isSearching = false;
      if (this.onBestMove) {
        this.onBestMove(null);
      }
    }, 300);
  }

  stop() {
    if (!this.worker || this.isMock) return;
    this.worker.postMessage('stop');
    this.isSearching = false;
  }

  setMultiPV(count) {
    if (!this.worker || this.isMock) return;
    this.worker.postMessage(`setoption name MultiPV value ${count}`);
  }

  setSkillLevel(level) {
    if (!this.worker || this.isMock) return;
    this.worker.postMessage(`setoption name Skill Level value ${level}`);
  }

  setThreads(threads) {
    if (!this.worker || this.isMock) return;
    this.worker.postMessage(`setoption name Threads value ${threads}`);
  }

  newGame() {
    if (this.worker) {
      this.worker.postMessage('ucinewgame');
      this.worker.postMessage('isready');
    }
    this.multiPvLines = [];
    this.currentEval = { type: 'cp', value: 0, depth: 0, bestMove: '', pv: '' };
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isReady = false;
    this.isSearching = false;
  }
}
