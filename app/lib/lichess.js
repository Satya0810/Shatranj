/**
 * Lichess Cloud Evaluation API
 * 
 * Fetches pre-computed Stockfish evaluations from Lichess's cloud database.
 * These are crowd-sourced evaluations at extremely high depth (60-70+).
 * 
 * API: https://lichess.org/api/cloud-eval?fen={fen}&multiPv={n}
 * 
 * Note: The old explorer.lichess.ovh endpoint now returns 401.
 * We use the cloud-eval endpoint instead, which provides deep engine analysis
 * from Lichess's distributed evaluation network.
 */

const CACHE = new Map();
const RATE_LIMIT_MS = 1500; // Lichess asks for reasonable rate limiting
let lastFetchTime = 0;

/**
 * Fetch cloud evaluation from Lichess for a given FEN position.
 * Returns top engine lines with evaluations at very high depth.
 * 
 * @param {string} fen - FEN string of the position
 * @param {number} multiPv - Number of principal variations to return (1-5)
 * @returns {Object|null} - { fen, depth, knodes, pvs: [{ moves, cp, mate? }] }
 */
export async function fetchLichessCloudEval(fen, multiPv = 3) {
  // Check cache first
  const cacheKey = `${fen}:${multiPv}`;
  if (CACHE.has(cacheKey)) {
    return CACHE.get(cacheKey);
  }

  // Rate limiting
  const now = Date.now();
  const elapsed = now - lastFetchTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
  }

  try {
    lastFetchTime = Date.now();
    const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=${multiPv}`;
    const response = await fetch(url);

    if (response.status === 404) {
      // Position not in cloud database — this is normal for rare positions
      return null;
    }

    if (!response.ok) {
      console.warn(`Lichess cloud eval returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    // Parse the PVs into a more usable format
    const result = {
      fen: data.fen,
      depth: data.depth,
      knodes: data.knodes,
      source: 'Lichess Cloud',
      pvs: (data.pvs || []).map(pv => {
        const moves = pv.moves ? pv.moves.split(' ') : [];
        return {
          moves,
          movesUci: pv.moves || '',
          cp: pv.cp !== undefined ? pv.cp / 100 : null, // Convert centipawns to pawns
          mate: pv.mate !== undefined ? pv.mate : null,
          eval: pv.mate !== undefined
            ? `M${Math.abs(pv.mate)}`
            : pv.cp !== undefined
              ? (pv.cp >= 0 ? '+' : '') + (pv.cp / 100).toFixed(2)
              : '?',
        };
      }),
    };

    CACHE.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching Lichess cloud eval:', error);
    return null;
  }
}

/**
 * Convert UCI move notation (e.g. "e2e4") to SAN-like display (e.g. "e2→e4")
 */
export function uciToDisplay(uci) {
  if (!uci || uci.length < 4) return uci;
  return `${uci.substring(0, 2)}→${uci.substring(2, 4)}${uci.length > 4 ? '=' + uci[4].toUpperCase() : ''}`;
}
