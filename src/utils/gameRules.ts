import { Chess, Color } from 'chess.js';

/**
 * Copy of a game that keeps its move history. `new Chess(game.fen())` drops the
 * history, and without it threefold repetition can never be detected.
 */
export function cloneGame(game: Chess): Chess {
  const copy = new Chess();
  copy.loadPgn(game.pgn());
  return copy;
}

/** The rule that ended a drawn game, worded for the result screen. */
export function drawReason(game: Chess): string {
  if (game.isStalemate()) return 'Draw by stalemate.';
  if (game.isThreefoldRepetition()) return 'Draw by threefold repetition.';
  if (game.isInsufficientMaterial()) return 'Draw by insufficient material.';
  if (game.isDrawByFiftyMoves()) return 'Draw by the fifty-move rule.';
  return 'Game drawn.';
}

/**
 * FIDE rule 6.9: a player who runs out of time loses, unless the opponent
 * cannot possibly checkmate, in which case the game is drawn. Counted
 * conservatively: a lone king, or king and one minor piece against a lone king.
 */
export function canStillMate(game: Chess, color: Color): boolean {
  const own = game.board().flat().filter(p => p && p.color === color && p.type !== 'k');
  const theirs = game.board().flat().filter(p => p && p.color !== color && p.type !== 'k');
  if (own.length === 0) return false;
  if (own.length === 1 && (own[0]!.type === 'n' || own[0]!.type === 'b') && theirs.length === 0) return false;
  return true;
}

/** PGN of the game with proper headers, for copying, saving and sharing. */
export function pgnWithHeaders(
  game: Chess,
  headers: { white: string; black: string; result?: '1-0' | '0-1' | '1/2-1/2' | '*'; event?: string; date?: Date }
): string {
  const g = cloneGame(game);
  const d = headers.date ?? new Date();
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  g.setHeader('Event', headers.event ?? 'Casual game');
  g.setHeader('Site', 'Chesskys');
  g.setHeader('Date', date);
  g.setHeader('White', headers.white);
  g.setHeader('Black', headers.black);
  g.setHeader('Result', headers.result ?? '*');
  return g.pgn();
}
