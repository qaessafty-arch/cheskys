// Pure match-state logic. Operates on MatchSession values without
// touching Socket.IO. Testable in isolation.

import { Chess } from 'chess.js';
import {
  MatchSession,
  MatchStatus,
  TimeControl,
} from './types.js';
import { computeEloDelta, EloResult } from './elo.js';
import { PrecisionMatchClock } from './preciseClock.js';

/** Terminal statuses that stop the game. */
const TERMINAL_STATUSES = new Set([
  'completed',
  'aborted',
  'resigned',
  'timeout',
  'checkmate',
  'stalemate',
  'draw',
  'expired',
  'cancelled',
]);

export function isTerminal(status: MatchStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Start the drift-free timer interval for an active match.
 *
 *  The caller is responsible for storing the returned timer and
 *  clearing it when the match ends. `match.lastTimerTick` is seeded
 *  so the first tick does not double-count.
 */
export function startMatchTimers(
  match: MatchSession,
  emitTimerUpdate: (
    payload: {
      whiteTime: number;
      blackTime: number;
      white?: number;
      black?: number;
      whiteMs?: number;
      blackMs?: number;
    },
  ) => void,
  emitClockSync: (payload: {
    white: number;
    black: number;
    whiteMs?: number;
    blackMs?: number;
    activeColor?: string;
  }) => void,
): NodeJS.Timeout {
  if (match.gameInterval) clearInterval(match.gameInterval);
  if (match.precisionClock) match.precisionClock.destroy();

  const tc = match.timeControl ?? { initialSeconds: 600, incrementSeconds: 0 };
  const initialSec = tc.initialSeconds ?? 600;
  const incSec = tc.incrementSeconds ?? 0;

  // Initialize PrecisionMatchClock with callback for authoritative flag drop
  const precisionClock = new PrecisionMatchClock(
    initialSec,
    incSec,
    (flaggedColor) => {
      match.status = 'timeout';
      stopMatchTimers(match);
      emitTimerUpdate({
        whiteTime: Math.round(match.whiteSecondsRemaining),
        blackTime: Math.round(match.blackSecondsRemaining),
        white: Math.round(match.whiteSecondsRemaining),
        black: Math.round(match.blackSecondsRemaining),
      });
      emitClockSync({
        white: Math.round(match.whiteSecondsRemaining),
        black: Math.round(match.blackSecondsRemaining),
      });
    }
  );

  // Sync remaining time if already partway into game
  if (match.whiteSecondsRemaining !== undefined && match.blackSecondsRemaining !== undefined) {
    (precisionClock as any).white.remainingMs = Math.max(0, match.whiteSecondsRemaining * 1000);
    (precisionClock as any).black.remainingMs = Math.max(0, match.blackSecondsRemaining * 1000);
  }
  if (match.chess && match.chess.turn()) {
    (precisionClock as any).activeColor = match.chess.turn();
  }

  precisionClock.start();
  match.precisionClock = precisionClock;

  // Heartbeat interval emitting every 500ms
  const interval = setInterval(() => {
    if (isTerminal(match.status)) {
      clearInterval(interval);
      match.gameInterval = undefined;
      return;
    }

    const snap = precisionClock.getSnapshot();
    match.whiteSecondsRemaining = snap.whiteSecondsRemaining;
    match.blackSecondsRemaining = snap.blackSecondsRemaining;

    // Timeout check
    if (match.whiteSecondsRemaining <= 0 || match.blackSecondsRemaining <= 0) {
      match.status = 'timeout';
      stopMatchTimers(match);
      emitTimerUpdate({
        whiteTime: 0,
        blackTime: 0,
        white: 0,
        black: 0,
      });
      emitClockSync({
        white: 0,
        black: 0,
      });
      return;
    }

    emitTimerUpdate({
      whiteTime: snap.whiteSecondsRemaining,
      blackTime: snap.blackSecondsRemaining,
      white: snap.whiteSecondsRemaining,
      black: snap.blackSecondsRemaining,
      whiteMs: snap.whiteMs,
      blackMs: snap.blackMs,
    });

    // Periodic sync pulse
    if (Math.floor(Date.now() / 1000) % 2 === 0) {
      emitClockSync({
        white: snap.whiteSecondsRemaining,
        black: snap.blackSecondsRemaining,
        whiteMs: snap.whiteMs,
        blackMs: snap.blackMs,
        activeColor: snap.activeColor,
      });
    }
  }, 500);

  match.gameInterval = interval;
  return interval;
}

/** Stop all timers associated with a match. Safe to call multiple times. */
export function stopMatchTimers(match: MatchSession): void {
  if (match.precisionClock) {
    match.precisionClock.destroy();
    match.precisionClock = undefined;
  }
  if (match.gameInterval) {
    clearInterval(match.gameInterval);
    match.gameInterval = undefined;
  }
  if (match.abortTimer) {
    clearTimeout(match.abortTimer);
    match.abortTimer = undefined;
  }
  if (match.waitingTimer) {
    clearTimeout(match.waitingTimer);
    match.waitingTimer = undefined;
  }
  if (match.reconnectTimeout) {
    clearTimeout(match.reconnectTimeout);
    match.reconnectTimeout = undefined;
  }
}

/** Handle game-over state: set status, stop timers, compute rating
 *  changes if rated.
 *
 *  Returns the payload emitted to clients.
 */
export function handleGameOver(
  match: MatchSession,
  reason: string,
  winner: 'w' | 'b' | 'draw' | null,
): {
  result: string;
  winner: 'w' | 'b' | 'draw' | null;
  reason: string;
  fen: string;
  pgn: string;
  ratingChanges: ReturnType<typeof computeEloDelta> | null;
} {
  if (match.status === 'completed') {
    return {
      result: 'draw',
      winner: 'draw',
      reason,
      fen: match.chess.fen(),
      pgn: match.chess.pgn(),
      ratingChanges: null,
    };
  }

  match.status = 'completed';
  stopMatchTimers(match);

  const result =
    winner === 'draw'
      ? 'draw'
      : winner === 'w'
        ? 'whiteWins'
        : winner === 'b'
          ? 'blackWins'
          : 'draw';

  const ratingChanges =
    match.rated &&
    match.whiteRating != null &&
    match.blackRating != null
      ? computeEloDelta(
          match.whiteRating,
          match.blackRating,
          winner === 'w' ? 'white' : winner === 'b' ? 'black' : 'draw',
        )
      : null;

  return {
    result,
    winner,
    reason,
    fen: match.chess.fen(),
    pgn: match.chess.pgn(),
    ratingChanges,
  };
}

/** Handle abort (voluntary or system-triggered).
 *
 *  Returns the abort payload.
 */
export function handleAbort(
  match: MatchSession,
  triggeredByUid: string,
  onPenalize: (uid: string, unbanMs: number) => void,
): { reason: string; winner: 'w' | 'b' | null } {
  if (
    match.status !== 'starting' &&
    match.status !== 'active' &&
    match.status !== 'waiting'
  ) {
    return { reason: 'Match already ended.', winner: null };
  }

  match.status = 'aborted';
  stopMatchTimers(match);

  if (triggeredByUid === match.whiteUid || triggeredByUid === 'system') {
    const targetUid =
      triggeredByUid === 'system' ? match.whiteUid : triggeredByUid;
    if (targetUid) {
      onPenalize(targetUid, 5 * 60 * 1000);
    }
  }

  const reason =
    triggeredByUid === 'system'
      ? 'White failed to make the first move in time.'
      : 'Opponent aborted the match.';

  return { reason, winner: null };
}

/** Build the initial clock for a session. */
export function buildInitialTimeControl(
  pool: string,
  rated: boolean,
  provided?: TimeControl,
): TimeControl {
  if (provided) return provided;
  const initialSeconds =
    pool === 'blitz'
      ? 180
      : pool === 'bullet'
        ? 60
        : 600;
  return {
    name: pool || 'Rapid 10 min',
    initialSeconds,
    incrementSeconds: 0,
  };
}

/** Initialise a fresh Chess instance, falling back to the start position
 *  if the supplied FEN is invalid. */
export function newChessFromFen(
  fen?: string,
): Chess {
  try {
    const chess = new Chess(fen ?? undefined);
    // Verify it loaded without error by checking turn.
    chess.turn();
    return chess;
  } catch {
    return new Chess();
  }
}
