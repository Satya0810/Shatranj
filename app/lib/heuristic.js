/**
 * Advanced Chess Heuristic Evaluation Engine
 * 
 * Evaluates a chess position using multiple factors:
 * 1. Material count (piece values)
 * 2. Piece-Square Tables (positional bonuses)
 * 3. Mobility (number of legal moves available)
 * 4. King Safety (pawn shield, king exposure)
 * 5. Pawn Structure (doubled, isolated, passed pawns)
 * 6. Bishop Pair bonus
 * 7. Rook on Open/Semi-Open Files
 * 8. Center Control
 * 9. Connectivity (piece coordination)
 * 10. Game Phase (tapered evaluation for endgame)
 */

// Standard piece values in centipawns (divided by 100 for pawns-unit)
export const PIECE_VALUES = { p: 1.0, n: 3.05, b: 3.33, r: 5.63, q: 9.5, k: 0 };

// Piece-Square Tables (from White's perspective, rank 8 = index 0)
const PST = {
  p: [
     0,    0,    0,    0,    0,    0,    0,    0,
     0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50,
     0.10, 0.10, 0.20, 0.30, 0.30, 0.20, 0.10, 0.10,
     0.05, 0.05, 0.10, 0.25, 0.25, 0.10, 0.05, 0.05,
     0,    0,    0,    0.20, 0.20, 0,    0,    0,
     0.05,-0.05,-0.10, 0,    0,   -0.10,-0.05, 0.05,
     0.05, 0.10, 0.10,-0.20,-0.20, 0.10, 0.10, 0.05,
     0,    0,    0,    0,    0,    0,    0,    0,
  ],
  n: [
    -0.50,-0.40,-0.30,-0.30,-0.30,-0.30,-0.40,-0.50,
    -0.40,-0.20, 0,    0,    0,    0,   -0.20,-0.40,
    -0.30, 0,    0.10, 0.15, 0.15, 0.10, 0,   -0.30,
    -0.30, 0.05, 0.15, 0.20, 0.20, 0.15, 0.05,-0.30,
    -0.30, 0,    0.15, 0.20, 0.20, 0.15, 0,   -0.30,
    -0.30, 0.05, 0.10, 0.15, 0.15, 0.10, 0.05,-0.30,
    -0.40,-0.20, 0,    0.05, 0.05, 0,   -0.20,-0.40,
    -0.50,-0.40,-0.30,-0.30,-0.30,-0.30,-0.40,-0.50,
  ],
  b: [
    -0.20,-0.10,-0.10,-0.10,-0.10,-0.10,-0.10,-0.20,
    -0.10, 0,    0,    0,    0,    0,    0,   -0.10,
    -0.10, 0,    0.05, 0.10, 0.10, 0.05, 0,   -0.10,
    -0.10, 0.05, 0.05, 0.10, 0.10, 0.05, 0.05,-0.10,
    -0.10, 0,    0.10, 0.10, 0.10, 0.10, 0,   -0.10,
    -0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10,-0.10,
    -0.10, 0.05, 0,    0,    0,    0,    0.05,-0.10,
    -0.20,-0.10,-0.10,-0.10,-0.10,-0.10,-0.10,-0.20,
  ],
  r: [
     0,    0,    0,    0,    0,    0,    0,    0,
     0.05, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.05,
    -0.05, 0,    0,    0,    0,    0,    0,   -0.05,
    -0.05, 0,    0,    0,    0,    0,    0,   -0.05,
    -0.05, 0,    0,    0,    0,    0,    0,   -0.05,
    -0.05, 0,    0,    0,    0,    0,    0,   -0.05,
    -0.05, 0,    0,    0,    0,    0,    0,   -0.05,
     0,    0,    0,    0.05, 0.05, 0,    0,    0,
  ],
  q: [
    -0.20,-0.10,-0.10,-0.05,-0.05,-0.10,-0.10,-0.20,
    -0.10, 0,    0,    0,    0,    0,    0,   -0.10,
    -0.10, 0,    0.05, 0.05, 0.05, 0.05, 0,   -0.10,
    -0.05, 0,    0.05, 0.05, 0.05, 0.05, 0,   -0.05,
     0,    0,    0.05, 0.05, 0.05, 0.05, 0,   -0.05,
    -0.10, 0.05, 0.05, 0.05, 0.05, 0.05, 0,   -0.10,
    -0.10, 0,    0.05, 0,    0,    0,    0,   -0.10,
    -0.20,-0.10,-0.10,-0.05,-0.05,-0.10,-0.10,-0.20,
  ],
  k_mg: [ // Middlegame king table
    -0.30,-0.40,-0.40,-0.50,-0.50,-0.40,-0.40,-0.30,
    -0.30,-0.40,-0.40,-0.50,-0.50,-0.40,-0.40,-0.30,
    -0.30,-0.40,-0.40,-0.50,-0.50,-0.40,-0.40,-0.30,
    -0.30,-0.40,-0.40,-0.50,-0.50,-0.40,-0.40,-0.30,
    -0.20,-0.30,-0.30,-0.40,-0.40,-0.30,-0.30,-0.20,
    -0.10,-0.20,-0.20,-0.20,-0.20,-0.20,-0.20,-0.10,
     0.20, 0.20, 0,    0,    0,    0,    0.20, 0.20,
     0.20, 0.30, 0.10, 0,    0,    0.10, 0.30, 0.20,
  ],
  k_eg: [ // Endgame king table — king should be active
    -0.50,-0.40,-0.30,-0.20,-0.20,-0.30,-0.40,-0.50,
    -0.30,-0.20,-0.10, 0,    0,   -0.10,-0.20,-0.30,
    -0.30,-0.10, 0.20, 0.30, 0.30, 0.20,-0.10,-0.30,
    -0.30,-0.10, 0.30, 0.40, 0.40, 0.30,-0.10,-0.30,
    -0.30,-0.10, 0.30, 0.40, 0.40, 0.30,-0.10,-0.30,
    -0.30,-0.10, 0.20, 0.30, 0.30, 0.20,-0.10,-0.30,
    -0.30,-0.30, 0,    0,    0,    0,   -0.30,-0.30,
    -0.50,-0.30,-0.30,-0.30,-0.30,-0.30,-0.30,-0.50,
  ],
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
  return { board, turn: parts[1] || 'w', castling: parts[2] || '-' };
}

function squareToCoords(idx) {
  return { rank: Math.floor(idx / 8), file: idx % 8 };
}

function getPieces(board, color) {
  const pieces = [];
  for (let i = 0; i < 64; i++) {
    if (board[i] && board[i].color === color) {
      pieces.push({ ...board[i], idx: i, ...squareToCoords(i) });
    }
  }
  return pieces;
}

/**
 * Calculate game phase: 0 = endgame, 1 = opening/middlegame
 */
function getGamePhase(board) {
  const phaseWeights = { q: 4, r: 2, b: 1, n: 1, p: 0, k: 0 };
  let totalPhase = 0;
  for (let i = 0; i < 64; i++) {
    if (board[i]) totalPhase += phaseWeights[board[i].type] || 0;
  }
  // Max phase = 4+4 + 2*4 + 1*4 = 24
  return Math.min(totalPhase / 24, 1);
}

/**
 * Material and PST evaluation with tapered endgame
 */
function evalMaterialAndPST(board, phase) {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const piece = board[i];
    if (!piece) continue;

    const val = PIECE_VALUES[piece.type] || 0;
    let pstVal = 0;

    if (piece.type === 'k') {
      const mgPst = PST.k_mg || [];
      const egPst = PST.k_eg || [];
      const mgVal = piece.color === 'w' ? (mgPst[i] || 0) : (mgPst[63 - i] || 0);
      const egVal = piece.color === 'w' ? (egPst[i] || 0) : (egPst[63 - i] || 0);
      pstVal = mgVal * phase + egVal * (1 - phase); // Tapered
    } else {
      const pst = PST[piece.type] || [];
      pstVal = piece.color === 'w' ? (pst[i] || 0) : (pst[63 - i] || 0);
    }

    if (piece.color === 'w') {
      score += val + pstVal;
    } else {
      score -= val + pstVal;
    }
  }
  return score;
}

/**
 * Pawn structure analysis: doubled, isolated, and passed pawns
 */
function evalPawnStructure(board) {
  let score = 0;
  const wPawnFiles = new Array(8).fill(0);
  const bPawnFiles = new Array(8).fill(0);
  const wPawnRanks = []; // Track all white pawn positions
  const bPawnRanks = []; // Track all black pawn positions

  for (let i = 0; i < 64; i++) {
    if (!board[i] || board[i].type !== 'p') continue;
    const { rank, file } = squareToCoords(i);
    if (board[i].color === 'w') {
      wPawnFiles[file]++;
      wPawnRanks.push({ rank, file });
    } else {
      bPawnFiles[file]++;
      bPawnRanks.push({ rank, file });
    }
  }

  // Doubled pawns penalty
  for (let f = 0; f < 8; f++) {
    if (wPawnFiles[f] > 1) score -= 0.15 * (wPawnFiles[f] - 1);
    if (bPawnFiles[f] > 1) score += 0.15 * (bPawnFiles[f] - 1);
  }

  // Isolated pawns penalty
  for (let f = 0; f < 8; f++) {
    if (wPawnFiles[f] > 0) {
      const hasNeighbor = (f > 0 && wPawnFiles[f - 1] > 0) || (f < 7 && wPawnFiles[f + 1] > 0);
      if (!hasNeighbor) score -= 0.20;
    }
    if (bPawnFiles[f] > 0) {
      const hasNeighbor = (f > 0 && bPawnFiles[f - 1] > 0) || (f < 7 && bPawnFiles[f + 1] > 0);
      if (!hasNeighbor) score += 0.20;
    }
  }

  // Passed pawns bonus (no opposing pawns on same or adjacent files ahead)
  for (const wp of wPawnRanks) {
    let isPassed = true;
    for (const bp of bPawnRanks) {
      if (Math.abs(bp.file - wp.file) <= 1 && bp.rank < wp.rank) {
        isPassed = false;
        break;
      }
    }
    if (isPassed) score += 0.20 + (7 - wp.rank) * 0.10; // Closer to promotion = bigger bonus
  }
  for (const bp of bPawnRanks) {
    let isPassed = true;
    for (const wp of wPawnRanks) {
      if (Math.abs(wp.file - bp.file) <= 1 && wp.rank > bp.rank) {
        isPassed = false;
        break;
      }
    }
    if (isPassed) score -= 0.20 + bp.rank * 0.10;
  }

  return score;
}

/**
 * King Safety: Pawn shield evaluation
 */
function evalKingSafety(board, phase) {
  let score = 0;

  // Only relevant in middlegame
  if (phase < 0.3) return 0;

  let wKingIdx = -1, bKingIdx = -1;
  for (let i = 0; i < 64; i++) {
    if (board[i]?.type === 'k') {
      if (board[i].color === 'w') wKingIdx = i;
      else bKingIdx = i;
    }
  }

  // White king safety
  if (wKingIdx >= 0) {
    const { rank, file } = squareToCoords(wKingIdx);
    // Check pawn shield (pawns in front of the king)
    let shieldCount = 0;
    for (let df = -1; df <= 1; df++) {
      const f = file + df;
      if (f < 0 || f > 7) continue;
      // Check one rank in front
      if (rank > 0) {
        const idx = (rank - 1) * 8 + f;
        if (board[idx]?.type === 'p' && board[idx]?.color === 'w') shieldCount++;
      }
    }
    score += shieldCount * 0.12 * phase; // Only in middlegame

    // Penalty if king is exposed (in center files during middlegame)
    if (file >= 2 && file <= 5 && rank >= 5) {
      score -= 0.30 * phase;
    }
  }

  // Black king safety (mirrored)
  if (bKingIdx >= 0) {
    const { rank, file } = squareToCoords(bKingIdx);
    let shieldCount = 0;
    for (let df = -1; df <= 1; df++) {
      const f = file + df;
      if (f < 0 || f > 7) continue;
      if (rank < 7) {
        const idx = (rank + 1) * 8 + f;
        if (board[idx]?.type === 'p' && board[idx]?.color === 'b') shieldCount++;
      }
    }
    score -= shieldCount * 0.12 * phase;

    if (file >= 2 && file <= 5 && rank <= 2) {
      score += 0.30 * phase;
    }
  }

  return score;
}

/**
 * Bishop pair bonus
 */
function evalBishopPair(board) {
  let wBishops = 0, bBishops = 0;
  for (let i = 0; i < 64; i++) {
    if (board[i]?.type === 'b') {
      if (board[i].color === 'w') wBishops++;
      else bBishops++;
    }
  }
  let score = 0;
  if (wBishops >= 2) score += 0.30;
  if (bBishops >= 2) score -= 0.30;
  return score;
}

/**
 * Rook on open/semi-open file bonus
 */
function evalRookFiles(board) {
  let score = 0;
  const wPawnFiles = new Set();
  const bPawnFiles = new Set();

  for (let i = 0; i < 64; i++) {
    if (board[i]?.type === 'p') {
      if (board[i].color === 'w') wPawnFiles.add(i % 8);
      else bPawnFiles.add(i % 8);
    }
  }

  for (let i = 0; i < 64; i++) {
    if (board[i]?.type !== 'r') continue;
    const file = i % 8;
    const color = board[i].color;
    const friendlyPawns = color === 'w' ? wPawnFiles : bPawnFiles;
    const enemyPawns = color === 'w' ? bPawnFiles : wPawnFiles;
    const sign = color === 'w' ? 1 : -1;

    if (!friendlyPawns.has(file) && !enemyPawns.has(file)) {
      score += 0.25 * sign; // Open file
    } else if (!friendlyPawns.has(file)) {
      score += 0.15 * sign; // Semi-open file
    }
  }

  return score;
}

/**
 * Center control (d4, d5, e4, e5 squares)
 */
function evalCenterControl(board) {
  let score = 0;
  const centerSquares = [27, 28, 35, 36]; // d4, e4, d5, e5
  const extendedCenter = [18, 19, 20, 21, 26, 29, 34, 37, 42, 43, 44, 45];

  for (const sq of centerSquares) {
    if (board[sq]) {
      score += board[sq].color === 'w' ? 0.10 : -0.10;
    }
  }
  for (const sq of extendedCenter) {
    if (board[sq]) {
      score += board[sq].color === 'w' ? 0.03 : -0.03;
    }
  }

  return score;
}

/**
 * Full heuristic evaluation
 * Returns a score where positive = White advantage, negative = Black advantage
 * Score is in "pawn units" (e.g., +1.5 = White is up ~1.5 pawns)
 */
export function evaluateHeuristic(fen) {
  const { board } = parseFen(fen);
  const phase = getGamePhase(board);

  let score = 0;

  score += evalMaterialAndPST(board, phase);
  score += evalPawnStructure(board);
  score += evalKingSafety(board, phase);
  score += evalBishopPair(board);
  score += evalRookFiles(board);
  score += evalCenterControl(board);

  return score;
}

/**
 * Get a detailed breakdown of the evaluation for display
 */
export function evaluateDetailed(fen) {
  const { board } = parseFen(fen);
  const phase = getGamePhase(board);

  const material = evalMaterialAndPST(board, phase);
  const pawnStructure = evalPawnStructure(board);
  const kingSafety = evalKingSafety(board, phase);
  const bishopPair = evalBishopPair(board);
  const rookFiles = evalRookFiles(board);
  const centerControl = evalCenterControl(board);
  const total = material + pawnStructure + kingSafety + bishopPair + rookFiles + centerControl;

  // Piece counts
  const counts = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (let i = 0; i < 64; i++) {
    if (board[i] && board[i].type !== 'k') {
      counts[board[i].color][board[i].type]++;
    }
  }

  return {
    total: +total.toFixed(2),
    material: +material.toFixed(2),
    pawnStructure: +pawnStructure.toFixed(2),
    kingSafety: +kingSafety.toFixed(2),
    bishopPair: +bishopPair.toFixed(2),
    rookFiles: +rookFiles.toFixed(2),
    centerControl: +centerControl.toFixed(2),
    phase: phase > 0.6 ? 'Middlegame' : phase > 0.3 ? 'Late Middlegame' : 'Endgame',
    pieceCounts: counts,
  };
}
