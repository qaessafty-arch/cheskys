import { Puzzle } from '../types/chess';
import { VERIFIED_PUZZLES, toPuzzle } from '../data/verifiedPuzzles';

export type TacticalTheme = 'Mate in 1' | 'Mate in 2' | 'Fork' | 'Pin' | 'Skewer' | 'Discovered Attack' | 'Deflection' | 'Hanging Piece' | 'Sacrifice' | 'Endgame' | 'Mixed';

/** Categories in menu order, listing only those that have puzzles. */
export const PRACTICE_CATEGORIES: TacticalTheme[] = (
  ['Mate in 1', 'Mate in 2', 'Fork', 'Pin', 'Skewer', 'Discovered Attack', 'Deflection', 'Hanging Piece', 'Sacrifice', 'Endgame'] as TacticalTheme[]
).filter(c => VERIFIED_PUZZLES.some(p => p.category === c));
export type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' | 'Grandmaster';

export interface ExtendedPuzzle extends Puzzle {
  category: TacticalTheme;
  level: DifficultyLevel;
}

const levelFor = (rating: number): DifficultyLevel =>
  rating <= 1000 ? 'Beginner' : rating <= 1500 ? 'Intermediate' : rating <= 1900 ? 'Advanced' : rating <= 2200 ? 'Expert' : 'Grandmaster';

// Practice puzzles by tactical theme, from the engine-checked set in src/data/verifiedPuzzles.ts.
export const EXTENDED_PUZZLES: ExtendedPuzzle[] = VERIFIED_PUZZLES.map(p => ({
  ...toPuzzle(p),
  category: p.category,
  level: levelFor(p.rating)
}));

export const getPuzzlesByCategory = (category: TacticalTheme | 'All'): ExtendedPuzzle[] => {
  if (category === 'All' || category === 'Mixed') return EXTENDED_PUZZLES;
  return EXTENDED_PUZZLES.filter(p => p.category === category);
};

export const getRandomPuzzle = (category: TacticalTheme | 'All', difficulty?: DifficultyLevel): ExtendedPuzzle => {
  let pool = getPuzzlesByCategory(category);
  if (difficulty) {
    pool = pool.filter(p => p.level === difficulty);
  }
  if (pool.length === 0) pool = EXTENDED_PUZZLES; // fallback
  return pool[Math.floor(Math.random() * pool.length)];
};
