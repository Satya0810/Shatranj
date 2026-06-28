'use client';

import { useState } from 'react';

const TV_CHANNELS = [
  { key: '', label: 'Top Rated', icon: '⭐' },
  { key: 'bullet', label: 'Bullet', icon: '🔫' },
  { key: 'blitz', label: 'Blitz', icon: '⚡' },
  { key: 'rapid', label: 'Rapid', icon: '🕐' },
  { key: 'classical', label: 'Classical', icon: '🏛️' },
  { key: 'chess960', label: 'Chess960', icon: '🎲' },
  { key: 'kingOfTheHill', label: 'KotH', icon: '👑' },
  { key: 'antichess', label: 'Antichess', icon: '🔄' },
  { key: 'atomic', label: 'Atomic', icon: '💥' },
  { key: 'crazyhouse', label: 'Crazyhouse', icon: '🏠' },
];

/**
 * LichessTVWidget — Embeds the Lichess TV iframe with a channel selector.
 * Uses dark theme + green board to match our site's aesthetic.
 */
export default function LichessTVWidget({ compact = false }) {
  const [channel, setChannel] = useState('');

  const channelPath = channel ? `/${channel}` : '';
  const iframeSrc = `https://lichess.org/tv${channelPath}/frame?theme=green&bg=dark&pieceSet=cburnett`;

  const size = compact ? { width: 400, height: 444 } : { width: 600, height: 444 };

  return (
    <div className="lichess-widget" id="lichess-tv-widget">
      <div className="card">
        <div className="card-header">
          <span className="card-title">📺 Live Chess</span>
          <span className="badge badge-green">Lichess TV</span>
        </div>

        {/* Channel selector */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: 'var(--space-sm) var(--space-md)',
          overflowX: 'auto',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          {TV_CHANNELS.map((ch) => (
            <button
              key={ch.key}
              className={`btn btn-sm ${channel === ch.key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setChannel(ch.key)}
              style={{ whiteSpace: 'nowrap', padding: '4px 10px', fontSize: '11px' }}
              id={`tv-channel-${ch.key || 'top'}`}
            >
              {ch.icon} {ch.label}
            </button>
          ))}
        </div>

        <div className="lichess-iframe-container">
          <iframe
            src={iframeSrc}
            width={size.width}
            height={size.height}
            frameBorder="0"
            title={`Lichess TV - ${TV_CHANNELS.find(c => c.key === channel)?.label || 'Top Rated'}`}
            loading="lazy"
            allowFullScreen
            style={{ display: 'block', maxWidth: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
