import fs from 'fs';

async function testApis() {
  const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3'; // Ruy Lopez

  console.log('--- Testing chess-api.com ---');
  try {
    const res = await fetch('https://chess-api.com/v1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen, depth: 12 })
    });
    console.log('chess-api status:', res.status);
    console.log(await res.json());
  } catch (e) {
    console.error(e);
  }

  console.log('\n--- Testing Lichess Opening Explorer ---');
  try {
    const res = await fetch(`https://explorer.lichess.ovh/lichess?fen=${encodeURIComponent(fen)}&speeds=blitz,rapid,classical`, {
      headers: {
        'User-Agent': 'ChessMaster/1.0 (test-script)'
      }
    });
    console.log('Lichess Explorer status:', res.status);
    const data = await res.json();
    console.log('Top move:', data.moves?.[0]);
  } catch (e) {
    console.error(e);
  }

  console.log('\n--- Testing Lichess Tablebase (Endgame) ---');
  const endgameFen = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1';
  try {
    const res = await fetch(`http://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(endgameFen)}`);
    console.log('Tablebase status:', res.status);
    console.log(await res.json());
  } catch (e) {
    console.error(e);
  }
}

testApis();
