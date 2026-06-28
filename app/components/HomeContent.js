'use client';

import Link from 'next/link';
import LichessTVWidget from './LichessTVWidget';
import LichessPuzzleWidget from './LichessPuzzleWidget';

export default function HomeContent() {
  return (
    <div className="home-page" id="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <h1>Play Chess Online</h1>
        <p>
          Challenge the computer, solve puzzles, analyze your games with Stockfish, and improve your skills — all for free.
        </p>

        <div className="play-buttons">
          <Link href="/play/computer" className="play-card" id="play-computer-card">
            <div className="play-card-icon">🤖</div>
            <div className="play-card-title">Play Computer</div>
            <div className="play-card-desc">Challenge Stockfish AI at any difficulty</div>
          </Link>

          <Link href="/play/local" className="play-card" id="play-friend-card">
            <div className="play-card-icon">👥</div>
            <div className="play-card-title">Play a Friend</div>
            <div className="play-card-desc">Play on the same device with a friend</div>
          </Link>

          <Link href="/analyze" className="play-card" id="analysis-card">
            <div className="play-card-icon">📊</div>
            <div className="play-card-title">Analysis Board</div>
            <div className="play-card-desc">Deep engine analysis with Stockfish</div>
          </Link>

          <Link href="/puzzles" className="play-card" id="puzzles-card">
            <div className="play-card-icon">🧩</div>
            <div className="play-card-title">Puzzles</div>
            <div className="play-card-desc">Improve your tactics daily</div>
          </Link>
        </div>
      </section>

      {/* Live Chess & Daily Puzzle — Lichess Widgets */}
      <section className="lichess-widgets-row" id="lichess-widgets">
        <LichessTVWidget compact />
        <LichessPuzzleWidget size={400} />
      </section>

      {/* Features Grid */}
      <section className="features-grid" id="features-section">
        <div className="card feature-card">
          <div className="feature-icon">⚡</div>
          <h3>Real-Time Analysis</h3>
          <p>
            Stockfish engine runs directly in your browser via WebAssembly. Get instant
            evaluations, best move suggestions, and multi-line analysis.
          </p>
        </div>

        <div className="card feature-card">
          <div className="feature-icon">📈</div>
          <h3>Game Review</h3>
          <p>
            Paste any PGN to get a full game analysis. See blunders, mistakes, and
            brilliant moves highlighted with evaluation graphs.
          </p>
        </div>

        <div className="card feature-card">
          <div className="feature-icon">🧩</div>
          <h3>Daily Puzzles</h3>
          <p>
            Sharpen your tactical vision with curated chess puzzles. From forks and
            pins to complex combinations at every difficulty level.
          </p>
        </div>

        <div className="card feature-card">
          <div className="feature-icon">🤖</div>
          <h3>Adjustable AI</h3>
          <p>
            Play against Stockfish with adjustable difficulty from beginner to grandmaster.
            Perfect for learning and practice at your own pace.
          </p>
        </div>

        <div className="card feature-card">
          <div className="feature-icon">📋</div>
          <h3>PGN Import/Export</h3>
          <p>
            Import games from Chess.com, Lichess, or any PGN source. Export your
            analyzed games to share with coaches or friends.
          </p>
        </div>

        <div className="card feature-card">
          <div className="feature-icon">🎨</div>
          <h3>Premium Design</h3>
          <p>
            Beautiful dark theme with smooth animations, responsive layout, and
            intuitive controls. Chess has never looked this good.
          </p>
        </div>
      </section>

      {/* Stats Bar */}
      <section
        style={{
          display: 'flex',
          gap: 'var(--space-lg)',
          justifyContent: 'center',
          marginTop: 'var(--space-2xl)',
          flexWrap: 'wrap',
        }}
      >
        {[
          { value: '♟️', label: 'Chess Engine', detail: 'Stockfish 16' },
          { value: '∞', label: 'Unlimited', detail: 'Analysis Depth' },
          { value: '🆓', label: 'Free', detail: 'No Sign-up Required' },
        ].map((stat, i) => (
          <div
            key={i}
            className="card"
            style={{
              padding: 'var(--space-xl) var(--space-2xl)',
              textAlign: 'center',
              minWidth: '200px',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: 'var(--space-sm)' }}>{stat.value}</div>
            <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>{stat.label}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{stat.detail}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
