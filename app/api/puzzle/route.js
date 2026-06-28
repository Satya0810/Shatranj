import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const theme = searchParams.get('theme') || 'mix';

    // For "mix" (random daily-style puzzle), we can just fetch the dashboard random training
    // Actually, Lichess /training/mix gives a random puzzle
    const targetTheme = theme === 'mix' ? 'mix' : theme;
    const url = targetTheme === 'mix' ? 'https://lichess.org/training/mix' : `https://lichess.org/training/${targetTheme}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!res.ok) {
      throw new Error(`Failed to fetch from lichess: ${res.status}`);
    }

    const html = await res.text();
    
    // Extract the page-init-data JSON from the HTML
    // It looks like: <script type="application/json" id="page-init-data">{"data":...}</script>
    const match = html.match(/<script type="application\/json" id="page-init-data">([\s\S]*?)<\/script>/);
    
    if (!match || !match[1]) {
      // If scraping fails, fallback to daily puzzle
      const dailyRes = await fetch('https://lichess.org/api/puzzle/daily');
      const dailyData = await dailyRes.json();
      return NextResponse.json(dailyData);
    }

    const initData = JSON.parse(match[1]);
    
    if (!initData.data || !initData.data.puzzle) {
      throw new Error("Could not find puzzle data in the parsed JSON");
    }

    const puzzle = initData.data.puzzle;
    const game = initData.data.game;

    // The scraped puzzle doesn't have a FEN, and its solution doesn't include the opponent's first move.
    // We must reconstruct it from the PGN to match the daily puzzle API format expected by the frontend.
    if (!puzzle.fen && game && game.pgn) {
      const { Chess } = require('chess.js');
      const chess = new Chess();
      chess.loadPgn(game.pgn);
      const moves = chess.history({ verbose: true });
      
      const replay = new Chess();
      // Play up to initialPly (which leaves it at the opponent's turn)
      for (let i = 0; i < puzzle.initialPly; i++) {
        replay.move(moves[i].san);
      }
      puzzle.fen = replay.fen(); // The FEN BEFORE the opponent's blunder
      
      // The opponent's blunder is the move at initialPly
      const opponentMove = moves[puzzle.initialPly];
      if (opponentMove) {
        let opponentUci = opponentMove.from + opponentMove.to;
        if (opponentMove.promotion) opponentUci += opponentMove.promotion;
        
        // Prepend the opponent's move to the solution
        puzzle.solution.unshift(opponentUci);
      }
    }

    // Format the response to match the structure expected by PuzzleBoard.js (which expects `{ puzzle: { ... } }`)
    return NextResponse.json({
      puzzle: puzzle,
      game: game
    });

  } catch (error) {
    console.error('Error in puzzle API route:', error);
    // Fallback to daily puzzle on any error
    try {
      const dailyRes = await fetch('https://lichess.org/api/puzzle/daily');
      const dailyData = await dailyRes.json();
      return NextResponse.json(dailyData);
    } catch (fallbackError) {
      return NextResponse.json({ error: 'Failed to fetch puzzle' }, { status: 500 });
    }
  }
}
