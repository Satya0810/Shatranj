'use client';

import { useRef, useEffect } from 'react';

export default function MoveList({
  history = [],
  currentMoveIndex = -1,
  onMoveClick,
  moveClassifications = {},
  onFirst,
  onPrev,
  onNext,
  onLast,
}) {
  const scrollRef = useRef(null);
  const activeMoveRef = useRef(null);

  // Auto-scroll to active move
  useEffect(() => {
    if (activeMoveRef.current && scrollRef.current) {
      activeMoveRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentMoveIndex]);

  // Group moves into pairs (white, black)
  const movePairs = [];
  for (let i = 0; i < history.length; i += 2) {
    movePairs.push({
      number: Math.floor(i / 2) + 1,
      white: { san: history[i]?.san || history[i], index: i },
      black: i + 1 < history.length
        ? { san: history[i + 1]?.san || history[i + 1], index: i + 1 }
        : null,
    });
  }

  const getClassification = (index) => {
    return moveClassifications[index] || '';
  };

  const getClassificationSymbol = (c) => {
    switch (c) {
      case 'brilliant': return <span style={{marginLeft: '4px', color: '#1baca6', fontWeight: 800}} title="Brilliant">!!</span>;
      case 'great': return <span style={{marginLeft: '4px', color: '#5c8bb0', fontWeight: 800}} title="Great">!</span>;
      case 'best': return <span style={{marginLeft: '4px', color: '#81b64a'}} title="Best">★</span>;
      case 'excellent': return <span style={{marginLeft: '4px', color: '#96bc4b'}} title="Excellent">👍</span>;
      case 'book': return <span style={{marginLeft: '4px', color: '#d5a47d'}} title="Book">📖</span>;
      case 'good': return <span style={{marginLeft: '4px', color: '#96bc4b'}} title="Good">✅</span>;
      case 'inaccuracy': return <span style={{marginLeft: '4px', color: '#f3ae16', fontWeight: 800}} title="Inaccuracy">?!</span>;
      case 'mistake': return <span style={{marginLeft: '4px', color: '#e58f2a', fontWeight: 800}} title="Mistake">?</span>;
      case 'miss': return <span style={{marginLeft: '4px', color: '#ff7769', fontWeight: 800}} title="Miss">❌</span>;
      case 'blunder': return <span style={{marginLeft: '4px', color: '#ca3431', fontWeight: 800}} title="Blunder">??</span>;
      default: return null;
    }
  };

  return (
    <div className="move-list-container card" id="move-list">
      <div className="move-list-header">
        <h3>Moves</h3>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {history.length} moves
        </span>
      </div>

      <div className="move-list" ref={scrollRef}>
        {movePairs.length === 0 ? (
          <div
            style={{
              padding: 'var(--space-xl)',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '13px',
            }}
          >
            No moves yet. Make your first move!
          </div>
        ) : (
          movePairs.map((pair) => (
            <div className="move-row" key={pair.number}>
              <span className="move-number">{pair.number}.</span>
              <span
                ref={pair.white.index === currentMoveIndex ? activeMoveRef : null}
                className={`move-cell ${
                  pair.white.index === currentMoveIndex ? 'active' : ''
                } ${getClassification(pair.white.index)}`}
                onClick={() => onMoveClick && onMoveClick(pair.white.index)}
                id={`move-${pair.white.index}`}
              >
                {pair.white.san}
                {getClassificationSymbol(getClassification(pair.white.index))}
              </span>
              {pair.black && (
                <span
                  ref={pair.black.index === currentMoveIndex ? activeMoveRef : null}
                  className={`move-cell ${
                    pair.black.index === currentMoveIndex ? 'active' : ''
                  } ${getClassification(pair.black.index)}`}
                  onClick={() => onMoveClick && onMoveClick(pair.black.index)}
                  id={`move-${pair.black.index}`}
                >
                  {pair.black.san}
                  {getClassificationSymbol(getClassification(pair.black.index))}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      <div className="move-nav">
        <button onClick={onFirst} title="First move" id="btn-first-move">⏮</button>
        <button onClick={onPrev} title="Previous move" id="btn-prev-move">◀</button>
        <button onClick={onNext} title="Next move" id="btn-next-move">▶</button>
        <button onClick={onLast} title="Last move" id="btn-last-move">⏭</button>
      </div>
    </div>
  );
}
