'use client';

import { useState } from 'react';
import LichessTVWidget from '../components/LichessTVWidget';

const FEATURED_GAMES = [
  { id: 'MPJcy1JW', label: 'Magnus Carlsen Blitz', year: '2023' },
  { id: 'J3bJp7aY', label: 'Dubov vs Carlsen', year: '2020' },
  { id: 'ELwjwjTc', label: 'Kasparov Immortal', year: '1999' },
];

export default function WatchContent() {
  const [selectedGame, setSelectedGame] = useState(null);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }} id="watch-page">
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>
          📺 Watch Live Chess
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Watch top-rated games live from Lichess, browse famous games, and learn from the best
        </p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-lg)', flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* Main TV Widget */}
        <div style={{ flex: '1 1 500px', maxWidth: '650px' }}>
          <LichessTVWidget />
        </div>

        {/* Sidebar: Featured Games + Analysis Board */}
        <div style={{ flex: '1 1 300px', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {/* Featured Classic Games */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">🏆 Famous Games</span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {FEATURED_GAMES.map((g) => (
                <button
                  key={g.id}
                  className={`btn ${selectedGame === g.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedGame(selectedGame === g.id ? null : g.id)}
                  style={{ justifyContent: 'space-between', width: '100%' }}
                  id={`featured-game-${g.id}`}
                >
                  <span>{g.label}</span>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>{g.year}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Embedded game viewer */}
          {selectedGame && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">🎮 Game Viewer</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedGame(null)}
                  style={{ padding: '2px 8px' }}
                >
                  ✕
                </button>
              </div>
              <div className="lichess-iframe-container">
                <iframe
                  src={`https://lichess.org/embed/game/${selectedGame}?theme=green&bg=dark&pieceSet=cburnett`}
                  width="100%"
                  height="397"
                  frameBorder="0"
                  title="Lichess Game"
                  loading="lazy"
                  allowFullScreen
                  style={{ display: 'block' }}
                />
              </div>
            </div>
          )}

          {/* Embedded Lichess Analysis Board */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">🔬 Quick Analysis</span>
              <span className="badge badge-blue">Lichess</span>
            </div>
            <div className="lichess-iframe-container">
              <iframe
                src="https://lichess.org/embed/analysis?theme=green&bg=dark&pieceSet=cburnett"
                width="100%"
                height="397"
                frameBorder="0"
                title="Lichess Analysis Board"
                loading="lazy"
                allowFullScreen
                style={{ display: 'block' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
