// Fair-play analysis: scores a finished game against the engine and turns the
// numbers into a verdict. Pure functions, no IO, so it can be unit tested and
// reused by the server and by offline tools.
//
// Nothing here bans anybody. The verdict is evidence for a human reviewer:
//   'none'   - nothing unusual
//   'watch'  - unusual for the rating; keep an eye on the next games
//   'review' - strong, repeated evidence; queue for a person to look at
//
// The engine signal is the only one that can raise a verdict on its own.
// Move timing and focus loss only add weight once the engine signal is already
// elevated, because honest players premove, tab away and play fast too.

import { Position } from '../../src/engine/board';
import { clearTranspositionTable, searchRootMoves } from '../../src/engine/search';

export interface AnalysedMove {
  uci: string;
  /** Epoch ms when the move was made; optional. */
  t?: number;
}

export interface AnalysisOptions {
  startFen?: string;
  /** Plies skipped at the start: opening theory is played from memory. */
  skipPlies?: number;
  depth?: number;
  /** Time budget per position; a position that times out is skipped. */
  perPlyMs?: number;
  /** Positions already decided by more than this many centipawns are skipped. */
  decidedCp?: number;
  /** Yield between positions so a server's event loop is never blocked for long. */
  yieldBetweenPlies?: () => Promise<void>;
}

export interface SideStats {
  /** Positions that were scored for this side. */
  analysed: number;
  /** Share of scored moves within `EQUIVALENT_CP` of the engine's best move. */
  engineEquivalentRate: number;
  /** Share of scored moves that were exactly the engine's first choice. */
  topMoveRate: number;
  /** Average centipawn loss per scored move (each move capped). */
  acpl: number;
  /** Coefficient of variation of the time spent per move; null without timestamps. */
  timingCv: number | null;
  meanMoveMs: number | null;
}

export interface GameAnalysis {
  w: SideStats;
  b: SideStats;
  plies: number;
  skipped: { opening: number; forcedOrDecided: number; timedOut: number };
}

export const EQUIVALENT_CP = 10;
const LOSS_CAP_CP = 500;
const CLAMP_CP = 1000;

const emptyStats = (): SideStats => ({
  analysed: 0, engineEquivalentRate: 0, topMoveRate: 0, acpl: 0, timingCv: null, meanMoveMs: null
});

const clamp = (v: number) => Math.max(-CLAMP_CP, Math.min(CLAMP_CP, v));

export async function analyseGame(moves: AnalysedMove[], options: AnalysisOptions = {}): Promise<GameAnalysis> {
  const {
    startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    skipPlies = 10,
    depth = 5,
    perPlyMs = 400,
    decidedCp = 800,
    yieldBetweenPlies
  } = options;

  clearTranspositionTable();
  const pos = new Position(startFen);
  const acc = {
    w: { n: 0, equiv: 0, top: 0, loss: 0, durations: [] as number[] },
    b: { n: 0, equiv: 0, top: 0, loss: 0, durations: [] as number[] }
  };
  const skipped = { opening: 0, forcedOrDecided: 0, timedOut: 0 };

  for (let i = 0; i < moves.length; i++) {
    const side: 'w' | 'b' = pos.side === 0 ? 'w' : 'b';
    const played = pos.findMoveUci(moves[i].uci);
    if (!played) break; // not a legal continuation: stop rather than guess

    const t = moves[i].t;
    const prevT = i > 0 ? moves[i - 1].t : undefined;
    if (t !== undefined && prevT !== undefined && t >= prevT) acc[side].durations.push(t - prevT);

    if (i < skipPlies) {
      skipped.opening++;
    } else if (pos.legalMoves().length < 2) {
      skipped.forcedOrDecided++;
    } else {
      const started = Date.now();
      const lines = searchRootMoves(pos, { depth, timeMs: perPlyMs });
      const timedOut = Date.now() - started >= perPlyMs;
      const entry = lines.find(l => l.uci === moves[i].uci);
      if (timedOut || !entry || lines.length < 2) {
        skipped.timedOut++;
      } else if (Math.abs(lines[0].score) > decidedCp) {
        skipped.forcedOrDecided++;
      } else {
        const loss = Math.min(LOSS_CAP_CP, Math.max(0, clamp(lines[0].score) - clamp(entry.score)));
        const a = acc[side];
        a.n++;
        a.loss += loss;
        if (loss <= EQUIVALENT_CP) a.equiv++;
        if (entry.uci === lines[0].uci) a.top++;
      }
      if (yieldBetweenPlies) await yieldBetweenPlies();
    }
    pos.makeMove(played);
  }

  const finish = (a: typeof acc.w): SideStats => {
    if (a.n === 0 && a.durations.length === 0) return emptyStats();
    const mean = a.durations.length ? a.durations.reduce((s, v) => s + v, 0) / a.durations.length : null;
    let cv: number | null = null;
    if (mean && a.durations.length >= 10) {
      const sd = Math.sqrt(a.durations.reduce((s, v) => s + (v - mean) ** 2, 0) / a.durations.length);
      cv = sd / mean;
    }
    return {
      analysed: a.n,
      engineEquivalentRate: a.n ? a.equiv / a.n : 0,
      topMoveRate: a.n ? a.top / a.n : 0,
      acpl: a.n ? a.loss / a.n : 0,
      timingCv: cv,
      meanMoveMs: mean
    };
  };

  return { w: finish(acc.w), b: finish(acc.b), plies: moves.length, skipped };
}

/* ------------------------------------------------------------------ *
 * Verdict
 * ------------------------------------------------------------------ */

export type Verdict = 'none' | 'watch' | 'review';

export interface Assessment {
  verdict: Verdict;
  /** 0..1, how far the engine signal sits above what the rating predicts. */
  engineScore: number;
  reasons: string[];
}

/** Fewer scored moves than this and a single game proves nothing. */
export const MIN_ANALYSED_MOVES = 20;

/**
 * Engine-equivalent rate an honest player of this rating is expected to reach.
 * Linear between 0.38 at 400 and 0.62 at 2600, flat outside that.
 */
export function expectedEquivalentRate(rating: number): number {
  const r = Math.max(400, Math.min(2600, rating));
  return 0.38 + ((r - 400) / 2200) * 0.24;
}

export function assessSide(stats: SideStats, rating: number): Assessment {
  const reasons: string[] = [];
  if (stats.analysed < MIN_ANALYSED_MOVES) {
    return { verdict: 'none', engineScore: 0, reasons: [`only ${stats.analysed} scored moves`] };
  }

  const expected = expectedEquivalentRate(rating);
  const excess = stats.engineEquivalentRate - expected;
  // 0 at "as expected", 1 at "everything matches"
  const engineScore = Math.max(0, Math.min(1, excess / (1 - expected)));

  let verdict: Verdict = 'none';
  if (excess >= 0.2 && stats.acpl <= 25) verdict = 'watch';
  if (excess >= 0.3 && stats.acpl <= 15) verdict = 'review';

  if (verdict !== 'none') {
    reasons.push(
      `${Math.round(stats.engineEquivalentRate * 100)}% engine-equivalent moves over ${stats.analysed} scored ` +
      `(expected about ${Math.round(expected * 100)}% at rating ${Math.round(rating)}), average loss ${stats.acpl.toFixed(1)} cp`
    );
    // Supporting signal: unusually even move times. Never raises the verdict alone.
    if (stats.timingCv !== null && stats.timingCv < 0.35 && verdict === 'watch') {
      verdict = 'review';
      reasons.push(`very even move times (variation ${stats.timingCv.toFixed(2)})`);
    }
  }
  return { verdict, engineScore, reasons };
}

export interface HistoryEntry { verdict: Verdict; at: number }

/** Repeated 'watch' games escalate: one odd game is luck, a pattern is not. */
export function escalateWithHistory(current: Assessment, recent: HistoryEntry[]): Assessment {
  if (current.verdict !== 'watch') return current;
  const lastFive = recent.slice(-5);
  const elevated = lastFive.filter(h => h.verdict !== 'none').length;
  if (elevated >= 2) {
    return {
      ...current,
      verdict: 'review',
      reasons: [...current.reasons, `${elevated} of the last ${lastFive.length} analysed games were already elevated`]
    };
  }
  return current;
}
