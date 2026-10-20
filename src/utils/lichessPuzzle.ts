import { Chess } from 'chess.js';

/** The parts of a Lichess /api/puzzle/daily response that a puzzle is built from. */
export interface LichessPuzzleResponse {
  game?: { pgn?: string };
  puzzle?: { id?: string; rating?: number; themes?: string[]; solution?: string[]; initialPly?: number };
}

export interface LichessPuzzle {
  id: string;
  fen: string;
  playerColor: 'w' | 'b';
  solutionMoves: string[];
  rating: number;
  themes: string[];
  url: string;
}

const tokens = (pgn: string) =>
  pgn
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\d+\.(\.\.)?/g, ' ')
    .split(/\s+/)
    .filter(t => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));

const playUci = (g: Chess, uci: string) =>
  g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] as any });

/**
 * Builds a playable puzzle from Lichess data: the position the puzzle starts
 * from, and its solution in SAN. Returns null unless the whole solution is
 * legal from that position, so a format change never shows a broken puzzle.
 */
export function puzzleFromLichess(data: LichessPuzzleResponse): LichessPuzzle | null {
  const moves = tokens(data.game?.pgn ?? '');
  const solution = data.puzzle?.solution ?? [];
  if (!data.puzzle?.id || moves.length === 0 || solution.length === 0) return null;

  // The puzzle normally starts after the whole PGN; also try initialPly + 1 plies
  // in case the PGN runs past the puzzle's start.
  const starts = [moves.length];
  if (typeof data.puzzle.initialPly === 'number') starts.push(data.puzzle.initialPly + 1);

  for (const plies of starts) {
    if (plies < 1 || plies > moves.length) continue;
    const g = new Chess();
    try {
      for (const m of moves.slice(0, plies)) g.move(m);
    } catch {
      continue;
    }
    const fen = g.fen();
    const sans: string[] = [];
    try {
      for (const uci of solution) sans.push(playUci(g, uci).san);
    } catch {
      continue;
    }
    return {
      id: data.puzzle.id,
      fen,
      playerColor: new Chess(fen).turn(),
      solutionMoves: sans,
      rating: data.puzzle.rating ?? 1500,
      themes: data.puzzle.themes ?? [],
      url: `https://lichess.org/training/${data.puzzle.id}`,
    };
  }
  return null;
}
