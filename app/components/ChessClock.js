'use client';

import { formatTime } from '../lib/useGameClock';

/**
 * ChessClock — Displays a player's remaining time with visual states.
 *
 * @param {number|null} time       — Milliseconds remaining (Infinity = unlimited)
 * @param {boolean}     isActive   — Whether this clock is currently ticking
 * @param {boolean}     isLowTime  — Whether the player is low on time (< 30s)
 * @param {boolean}     isUnlimited — Whether the game has no time control
 */
export default function ChessClock({ time, isActive, isLowTime, isUnlimited }) {
  if (isUnlimited) return null;

  const displayTime = formatTime(time);

  const classes = [
    'player-clock',
    isActive ? 'active-clock' : '',
    isLowTime ? 'low-time' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} id="chess-clock">
      {isActive && (
        <span className="clock-tick-dot" />
      )}
      <span className="clock-time">{displayTime}</span>
    </div>
  );
}
