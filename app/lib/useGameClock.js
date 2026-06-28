'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * TIME_CONTROLS — All standard chess time control presets.
 * Each entry: { label, category, minutes, increment }.
 * `minutes: null` means unlimited (no timer).
 */
export const TIME_CONTROLS = [
  { label: '1+0',  category: 'Bullet',    minutes: 1,  increment: 0  },
  { label: '2+1',  category: 'Bullet',    minutes: 2,  increment: 1  },
  { label: '3+0',  category: 'Blitz',     minutes: 3,  increment: 0  },
  { label: '3+2',  category: 'Blitz',     minutes: 3,  increment: 2  },
  { label: '5+0',  category: 'Blitz',     minutes: 5,  increment: 0  },
  { label: '5+3',  category: 'Blitz',     minutes: 5,  increment: 3  },
  { label: '10+0', category: 'Rapid',     minutes: 10, increment: 0  },
  { label: '10+5', category: 'Rapid',     minutes: 10, increment: 5  },
  { label: '15+10',category: 'Rapid',     minutes: 15, increment: 10 },
  { label: '30+0', category: 'Rapid',     minutes: 30, increment: 0  },
  { label: '30+20',category: 'Classical', minutes: 30, increment: 20 },
  { label: '60+30',category: 'Classical', minutes: 60, increment: 30 },
  { label: '∞',    category: 'Unlimited', minutes: null, increment: 0 },
];

/**
 * formatTime — Formats milliseconds into a clock display string.
 * Shows MM:SS normally, or M:SS.t (tenths) when below 20 seconds.
 */
export function formatTime(ms) {
  if (ms == null || ms === Infinity) return '∞';
  if (ms <= 0) return '0:00';

  const totalSeconds = ms / 1000;

  if (totalSeconds < 20) {
    // Show tenths of a second
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    const tenths = Math.floor((totalSeconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
  }

  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const LOW_TIME_THRESHOLD = 30000; // 30 seconds
const TICK_INTERVAL = 100; // 100ms for smooth display

/**
 * useGameClock — React hook for managing two-player chess game clocks.
 *
 * @param {Object} options
 * @param {number|null} options.initialMinutes  — Starting time per side in minutes (null = unlimited)
 * @param {number}      options.increment       — Seconds added after each move (Fischer)
 * @param {Function}    options.onFlag          — Callback when a player's time runs out: ('white'|'black')
 *
 * @returns {Object}
 *   whiteTime, blackTime  — milliseconds remaining
 *   activeSide             — 'white' | 'black' | null
 *   isRunning              — boolean
 *   isUnlimited            — boolean
 *   isLowTime              — { white: bool, black: bool }
 *   startClock(side)       — Start/resume the clock for the given side
 *   switchClock()          — Switch to the other side (adds increment to current side)
 *   pauseClock()           — Pause both clocks
 *   resetClock(minutes, increment) — Reset with new time control
 */
export default function useGameClock({ initialMinutes, increment = 0, onFlag }) {
  const isUnlimited = initialMinutes == null;
  const initialMs = isUnlimited ? Infinity : initialMinutes * 60 * 1000;

  const [whiteTime, setWhiteTime] = useState(initialMs);
  const [blackTime, setBlackTime] = useState(initialMs);
  const [activeSide, setActiveSide] = useState(null); // 'white' | 'black' | null
  const [isRunning, setIsRunning] = useState(false);

  const intervalRef = useRef(null);
  const lastTickRef = useRef(null);
  const onFlagRef = useRef(onFlag);

  // Keep onFlag ref current
  useEffect(() => {
    onFlagRef.current = onFlag;
  }, [onFlag]);

  // Core tick function
  const tick = useCallback(() => {
    const now = performance.now();
    const delta = now - lastTickRef.current;
    lastTickRef.current = now;

    setWhiteTime((prev) => prev);
    setBlackTime((prev) => prev);

    // We need to use functional updates so we get the latest state
    if (activeSide === 'white') {
      setWhiteTime((prev) => {
        const next = prev - delta;
        if (next <= 0) {
          // Flag!
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setIsRunning(false);
          setActiveSide(null);
          setTimeout(() => {
            if (onFlagRef.current) onFlagRef.current('white');
          }, 0);
          return 0;
        }
        return next;
      });
    } else if (activeSide === 'black') {
      setBlackTime((prev) => {
        const next = prev - delta;
        if (next <= 0) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setIsRunning(false);
          setActiveSide(null);
          setTimeout(() => {
            if (onFlagRef.current) onFlagRef.current('black');
          }, 0);
          return 0;
        }
        return next;
      });
    }
  }, [activeSide]);

  // Start/stop interval when activeSide or isRunning changes
  useEffect(() => {
    if (isRunning && activeSide && !isUnlimited) {
      lastTickRef.current = performance.now();
      intervalRef.current = setInterval(tick, TICK_INTERVAL);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [isRunning, activeSide, tick, isUnlimited]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const startClock = useCallback((side) => {
    if (isUnlimited) return;
    setActiveSide(side);
    setIsRunning(true);
  }, [isUnlimited]);

  const switchClock = useCallback(() => {
    if (isUnlimited) return;

    // Add increment to the side that just moved
    const incrementMs = increment * 1000;
    if (activeSide === 'white') {
      setWhiteTime((prev) => prev + incrementMs);
      setActiveSide('black');
    } else if (activeSide === 'black') {
      setBlackTime((prev) => prev + incrementMs);
      setActiveSide('white');
    }
    setIsRunning(true);
  }, [isUnlimited, activeSide, increment]);

  const pauseClock = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resetClock = useCallback((newMinutes, newIncrement) => {
    pauseClock();
    const newMs = newMinutes == null ? Infinity : newMinutes * 60 * 1000;
    setWhiteTime(newMs);
    setBlackTime(newMs);
    setActiveSide(null);
  }, [pauseClock]);

  return {
    whiteTime,
    blackTime,
    activeSide,
    isRunning,
    isUnlimited,
    isLowTime: {
      white: !isUnlimited && whiteTime < LOW_TIME_THRESHOLD && whiteTime > 0,
      black: !isUnlimited && blackTime < LOW_TIME_THRESHOLD && blackTime > 0,
    },
    startClock,
    switchClock,
    pauseClock,
    resetClock,
    formatTime,
  };
}
