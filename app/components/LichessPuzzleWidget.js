'use client';

/**
 * LichessPuzzleWidget — Embeds the Lichess daily puzzle iframe.
 * Dark theme + green board to match our site.
 */
export default function LichessPuzzleWidget({ size = 400 }) {
  return (
    <div className="lichess-widget" id="lichess-puzzle-widget">
      <div className="card">
        <div className="card-header">
          <span className="card-title">🧩 Daily Puzzle</span>
          <span className="badge badge-gold">Lichess</span>
        </div>
        <div className="lichess-iframe-container">
          <iframe
            src="https://lichess.org/training/frame?theme=green&bg=dark&pieceSet=cburnett"
            width={size}
            height={size}
            frameBorder="0"
            title="Lichess Daily Puzzle"
            loading="lazy"
            allowFullScreen
            style={{ display: 'block', maxWidth: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
