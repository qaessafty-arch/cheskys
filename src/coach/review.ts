/**
 * Game review: replays a finished game, searches every position where the player
 * moved, and returns the moves that lost real winning chances with a diagnosis of
 * what went wrong.
 */
import { Chess } from 'chess.js';
import { EngineSearchResponse } from '../engine/protocol';
import { winningChance } from '../utils/chessEngine';
import { Diagnosis, diagnose } from './mistakes';

export type Severity = 'inaccuracy' | 'mistake' | 'blunder';

export interface ReviewedMistake extends Diagnosis {
  id: string;
  ply: number;
  /** "12." for White, "12..." for Black. */
  moveLabel: string;
  color: 'w' | 'b';
  fenBefore: string;
  bestUci: string | null;
  severity: Severity;
  /** Winning chances lost, in percentage points. */
  drop: number;
  /** Evaluations in pawns from the player's point of view (mates as +/-50). */
  evalBefore: number;
  evalAfter: number;
}

export type SearchFn = (fen: string) => Promise<EngineSearchResponse>;

const pawnsFor = (res: EngineSearchResponse) => (res.mateIn !== null ? Math.sign(res.mateIn || 1) * 50 : res.score / 100);

export const severityFor = (drop: number): Severity | null =>
  drop >= 15 ? 'blunder' : drop >= 10 ? 'mistake' : drop >= 5 ? 'inaccuracy' : null;

/**
 * Reviews the player's moves. Only mistakes and blunders are returned (inaccuracies
 * too when `includeInaccuracies` is set), in game order.
 */
export async function reviewGame(
  startFen: string,
  sanMoves: string[],
  playerColor: 'w' | 'b',
  search: SearchFn,
  options: { includeInaccuracies?: boolean; onProgress?: (done: number, total: number) => void; isCancelled?: () => boolean } = {}
): Promise<ReviewedMistake[]> {
  const game = new Chess(startFen);
  const plies: { fen: string; uci: string; san: string; ply: number; moveNumber: number; color: 'w' | 'b' }[] = [];
  for (let i = 0; i < sanMoves.length; i++) {
    const fen = game.fen();
    const color = game.turn();
    const moveNumber = game.moveNumber();
    const move = game.move(sanMoves[i]);
    if (color === playerColor) {
      plies.push({ fen, uci: move.from + move.to + (move.promotion ?? ''), san: move.san, ply: i, moveNumber, color });
    }
  }

  const cache = new Map<string, EngineSearchResponse>();
  const searchCached = async (fen: string) => {
    const hit = cache.get(fen);
    if (hit) return hit;
    const res = await search(fen);
    cache.set(fen, res);
    return res;
  };

  const out: ReviewedMistake[] = [];
  for (let k = 0; k < plies.length; k++) {
    if (options.isCancelled?.()) break;
    options.onProgress?.(k, plies.length);
    const p = plies[k];
    const before = await searchCached(p.fen);
    if (!before.bestMove || before.bestMove === p.uci) continue;

    const afterGame = new Chess(p.fen);
    afterGame.move(p.san);
    // A move that ends the game with mate or a draw is judged by the result itself.
    if (afterGame.isCheckmate()) continue;
    const evalBefore = pawnsFor(before);
    let evalAfter: number;
    let replyLine: string[] = [];
    let mateAfter: number | null = null;
    if (afterGame.isGameOver()) {
      evalAfter = 0;
    } else {
      const after = await searchCached(afterGame.fen());
      evalAfter = -pawnsFor(after);
      replyLine = after.pv.length ? after.pv : after.bestMove ? [after.bestMove] : [];
      mateAfter = after.mateIn;
    }

    const drop = winningChance(evalBefore) - winningChance(evalAfter);
    const severity = severityFor(drop);
    if (!severity || (severity === 'inaccuracy' && !options.includeInaccuracies)) continue;

    const diagnosis = diagnose({
      fenBefore: p.fen,
      playedUci: p.uci,
      bestLine: before.pv.length ? before.pv : [before.bestMove],
      replyLine,
      mateBefore: before.mateIn,
      mateAfter,
    });
    out.push({
      ...diagnosis,
      id: `${p.ply}-${p.uci}`,
      ply: p.ply,
      moveLabel: `${p.moveNumber}${p.color === 'w' ? '.' : '...'}`,
      color: p.color,
      fenBefore: p.fen,
      bestUci: before.bestMove,
      severity,
      drop: Math.round(drop),
      evalBefore,
      evalAfter,
    });
  }
  options.onProgress?.(plies.length, plies.length);
  return out;
}
