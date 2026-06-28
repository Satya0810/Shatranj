'use client';

export default function GameOverModal({ result, onNewGame, onAnalyze, onClose }) {
  if (!result) return null;

  const getResultDisplay = () => {
    switch (result.result) {
      case 'checkmate':
        return {
          icon: '👑',
          title: result.winner === 'white' ? 'White Wins!' : 'Black Wins!',
          subtitle: 'by Checkmate',
        };
      case 'stalemate':
        return { icon: '🤝', title: 'Draw', subtitle: 'by Stalemate' };
      case 'threefold':
        return { icon: '🤝', title: 'Draw', subtitle: 'by Threefold Repetition' };
      case 'insufficient':
        return { icon: '🤝', title: 'Draw', subtitle: 'Insufficient Material' };
      case 'fifty-move':
        return { icon: '🤝', title: 'Draw', subtitle: 'by 50-Move Rule' };
      case 'resignation':
        return {
          icon: '🏳️',
          title: result.winner === 'white' ? 'White Wins!' : 'Black Wins!',
          subtitle: 'by Resignation',
        };
      case 'timeout':
        return {
          icon: '⏰',
          title: result.winner === 'white' ? 'White Wins!' : 'Black Wins!',
          subtitle: 'by Timeout',
        };
      default:
        return { icon: '🏁', title: 'Game Over', subtitle: '' };
    }
  };

  const display = getResultDisplay();

  return (
    <div className="modal-overlay" onClick={onClose} id="game-over-modal">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: '56px', marginBottom: 'var(--space-md)' }}>{display.icon}</div>
        <h2>{display.title}</h2>
        <p>{display.subtitle}</p>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onNewGame} id="btn-new-game">
            🔄 New Game
          </button>
          <button className="btn btn-secondary" onClick={onAnalyze} id="btn-analyze-game">
            📊 Analyze
          </button>
        </div>
      </div>
    </div>
  );
}
