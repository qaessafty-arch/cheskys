/**
 * The coach's long memory of the player's mistakes, kept per account, so it can show
 * earlier mistakes of the same kind and pick practice positions with the same pattern.
 */
import { TRAINING_EXERCISES, TrainingExercise } from '../data/coachExercises';
import { VERIFIED_PUZZLES } from '../data/verifiedPuzzles';
import { MistakeMotif } from './mistakes';
import { ReviewedMistake } from './review';

export interface LoggedMistake {
  id: string;
  motif: MistakeMotif;
  label: string;
  fenBefore: string;
  playedSan: string;
  bestSan: string | null;
  explanation: string;
  severity: ReviewedMistake['severity'];
  moveLabel: string;
  opponent: string;
  date: number;
}

const MAX_ENTRIES = 200;
const key = (accountId: string) => `chesskys_coach_mistakes_${accountId || 'guest'}`;

export function loadMistakes(accountId: string): LoggedMistake[] {
  try {
    const raw = localStorage.getItem(key(accountId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Adds a game's mistakes (newest first), ignoring a position already stored. */
export function recordMistakes(accountId: string, mistakes: ReviewedMistake[], opponent: string, now = Date.now()): LoggedMistake[] {
  const existing = loadMistakes(accountId);
  const seen = new Set(existing.map(m => `${m.fenBefore}|${m.playedSan}`));
  const fresh: LoggedMistake[] = mistakes
    .filter(m => !seen.has(`${m.fenBefore}|${m.playedSan}`))
    .map(m => ({
      id: `${now}-${m.id}`,
      motif: m.motif,
      label: m.label,
      fenBefore: m.fenBefore,
      playedSan: m.playedSan,
      bestSan: m.bestSan,
      explanation: m.explanation,
      severity: m.severity,
      moveLabel: m.moveLabel,
      opponent,
      date: now,
    }));
  const next = [...fresh.reverse(), ...existing].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(key(accountId), JSON.stringify(next));
  } catch {
    // Storage full or blocked: the review still works, it just is not remembered.
  }
  return next;
}

/** Earlier mistakes of the same kind, newest first, leaving out those recorded at `excludeDate` (the game under review). */
export function similarMistakes(log: LoggedMistake[], motif: MistakeMotif, excludeDate?: number, max = 3): LoggedMistake[] {
  return log.filter(m => m.motif === motif && m.date !== excludeDate).slice(0, max);
}

/** How often each kind of mistake appears in the log, most frequent first. */
export function mistakeCounts(log: LoggedMistake[]): { motif: MistakeMotif; label: string; count: number }[] {
  const counts = new Map<MistakeMotif, { label: string; count: number }>();
  for (const m of log) {
    const c = counts.get(m.motif) ?? { label: m.label, count: 0 };
    c.count++;
    counts.set(m.motif, c);
  }
  return [...counts.entries()].map(([motif, c]) => ({ motif, ...c })).sort((a, b) => b.count - a.count);
}

// Practice positions grouped by the pattern they train. Coach exercises and verified
// puzzles share the same move-list format, so both can be played on the coach board.
const PUZZLE_CATEGORIES: Record<MistakeMotif, string[]> = {
  allowed_mate: ['Mate in 1', 'Mate in 2'],
  missed_mate: ['Mate in 1', 'Mate in 2'],
  hanging_piece: ['Hanging Piece', 'Fork', 'Skewer', 'Pin'],
  missed_material: ['Hanging Piece', 'Skewer', 'Pin', 'Discovered Attack'],
  allowed_fork: ['Fork', 'Discovered Attack'],
  missed_fork: ['Fork', 'Discovered Attack'],
  positional: ['Endgame', 'Deflection'],
};
const EXERCISE_THEMES: Record<MistakeMotif, string[]> = {
  allowed_mate: ['checkmate'],
  missed_mate: ['checkmate'],
  hanging_piece: ['tactics_pin', 'tactics_skewer'],
  missed_material: ['tactics_pin', 'tactics_skewer'],
  allowed_fork: ['tactics_fork'],
  missed_fork: ['tactics_fork'],
  positional: ['endgame'],
};

export function practiceFor(motif: MistakeMotif, options: { backRank?: boolean; max?: number } = {}): TrainingExercise[] {
  const max = options.max ?? 3;
  const fromExercises = TRAINING_EXERCISES.filter(e => EXERCISE_THEMES[motif].includes(e.theme));
  // Closest pattern first: the motif's own category (back-rank mates first for a back-rank mistake).
  const rank = (p: (typeof VERIFIED_PUZZLES)[number]) =>
    (options.backRank && /back.rank/i.test(p.theme) ? 0 : 2) + PUZZLE_CATEGORIES[motif].indexOf(p.category);
  const puzzles = VERIFIED_PUZZLES.filter(p => PUZZLE_CATEGORIES[motif].includes(p.category)).sort((a, b) => rank(a) - rank(b));
  const fromPuzzles: TrainingExercise[] = puzzles.map(p => ({
    id: `puzzle:${p.id}`,
    title: p.title,
    description: p.description,
    fen: p.fen,
    solution: p.solutionMoves,
    difficulty: p.rating < 1200 ? 'easy' : p.rating < 1700 ? 'medium' : p.rating < 2100 ? 'hard' : 'master',
    theme: p.theme,
    hint: p.tip,
  }));
  // Exact-pattern puzzles lead; the coach's own exercises and related patterns follow.
  const primary = fromPuzzles.filter((_, i) => puzzles[i].category === PUZZLE_CATEGORIES[motif][0]);
  const rest = fromPuzzles.filter((_, i) => puzzles[i].category !== PUZZLE_CATEGORIES[motif][0]);
  return [...primary, ...fromExercises, ...rest].slice(0, max);
}
