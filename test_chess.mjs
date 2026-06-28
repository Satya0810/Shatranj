import { Chess } from 'chess.js';

const chess = new Chess();
try {
  const result = chess.move({ from: 'e2', to: 'e4', promotion: 'q' });
  console.log("Move result:", result);
  console.log("FEN after move:", chess.fen());
} catch (e) {
  console.error("Caught error:", e.message);
}
