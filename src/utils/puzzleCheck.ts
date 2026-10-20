import { Chess, Move } from 'chess.js';

/**
 * Whether a move played in a puzzle counts as the solution move.
 * Any checkmate is always correct, even if the puzzle lists a different mate;
 * otherwise the move must be the listed one (check/mate symbols and promotion
 * notation are compared by the squares and piece actually moved).
 */
export function isCorrectPuzzleMove(fenBefore: string, played: Move, expectedSan: string | undefined): boolean {
  if (played.san.endsWith('#')) return true;
  if (!expectedSan) return false;
  try {
    const expected = new Chess(fenBefore).move(expectedSan);
    return expected.from === played.from && expected.to === played.to && (expected.promotion ?? null) === (played.promotion ?? null);
  } catch {
    return false;
  }
}

/** A puzzle is finished once the listed line runs out or the player delivers mate. */
export function isPuzzleFinished(played: Move, nextStep: number, solutionLength: number): boolean {
  return played.san.endsWith('#') || nextStep >= solutionLength;
}
