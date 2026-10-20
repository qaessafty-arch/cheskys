import { Puzzle } from '../types/chess';
import { VERIFIED_PUZZLES, toPuzzle } from '../data/verifiedPuzzles';

// The puzzle collection, easiest first. Every puzzle is engine-checked (see src/data/verifiedPuzzles.ts).
export const PUZZLES_COLLECTION: Puzzle[] = [...VERIFIED_PUZZLES]
  .sort((a, b) => a.rating - b.rating)
  .map(toPuzzle);
