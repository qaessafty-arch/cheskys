// The coach's memory of one player: every exercise attempt and analysed move is
// recorded here, and the coach's profile, weaknesses and next lesson are derived
// from that record. Pure functions over a plain object, persisted per account.

export type ExerciseDifficulty = 'easy' | 'medium' | 'hard' | 'master';
export type StrengthTier = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master';

export interface ExerciseRecord {
  attempts: number;
  solved: number;
  mistakes: number;
  bestTimeMs: number | null;
  lastAttemptAt: number;
  lastSolvedAt: number | null;
}

export interface AttemptOutcome {
  solved: boolean;
  mistakes: number;
  timeMs: number;
  at: number;
}

export interface CoachMemory {
  version: 1;
  exercises: Record<string, ExerciseRecord>;
  /** Most recent attempts first, capped, used to measure improvement over time. */
  history: { id: string; theme: string; solved: boolean; mistakes: number; at: number }[];
  movesAnalysed: number;
  movesMatchingEngine: number;
  sessions: number;
  lastSessionAt: number | null;
}

export interface ExerciseMeta {
  id: string;
  theme: string;
  difficulty: ExerciseDifficulty;
}

export interface ThemeStat {
  theme: string;
  attempts: number;
  successRate: number;
}

const HISTORY_LIMIT = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

export function emptyMemory(): CoachMemory {
  return { version: 1, exercises: {}, history: [], movesAnalysed: 0, movesMatchingEngine: 0, sessions: 0, lastSessionAt: null };
}

const storageKey = (accountId: string) => `chess_coach_memory_${accountId}`;

export function loadMemory(accountId: string): CoachMemory {
  try {
    const raw = localStorage.getItem(storageKey(accountId));
    if (!raw) return emptyMemory();
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1) return emptyMemory();
    return { ...emptyMemory(), ...parsed };
  } catch {
    return emptyMemory();
  }
}

export function saveMemory(accountId: string, memory: CoachMemory): void {
  try {
    localStorage.setItem(storageKey(accountId), JSON.stringify(memory));
  } catch {
    // Storage full or blocked: the coach still works for this session.
  }
}

/** Counts a new coaching session when the last one was more than an hour ago. */
export function startSession(memory: CoachMemory, now: number): CoachMemory {
  if (memory.lastSessionAt !== null && now - memory.lastSessionAt < 60 * 60 * 1000) {
    return { ...memory, lastSessionAt: now };
  }
  return { ...memory, sessions: memory.sessions + 1, lastSessionAt: now };
}

export function recordAttempt(memory: CoachMemory, exercise: ExerciseMeta, outcome: AttemptOutcome): CoachMemory {
  const prev = memory.exercises[exercise.id];
  const record: ExerciseRecord = {
    attempts: (prev?.attempts ?? 0) + 1,
    solved: (prev?.solved ?? 0) + (outcome.solved ? 1 : 0),
    mistakes: (prev?.mistakes ?? 0) + outcome.mistakes,
    bestTimeMs: outcome.solved
      ? Math.min(prev?.bestTimeMs ?? Infinity, outcome.timeMs)
      : prev?.bestTimeMs ?? null,
    lastAttemptAt: outcome.at,
    lastSolvedAt: outcome.solved ? outcome.at : prev?.lastSolvedAt ?? null,
  };
  const entry = { id: exercise.id, theme: exercise.theme, solved: outcome.solved, mistakes: outcome.mistakes, at: outcome.at };
  return {
    ...memory,
    exercises: { ...memory.exercises, [exercise.id]: record },
    history: [entry, ...memory.history].slice(0, HISTORY_LIMIT),
  };
}

/** Records whether a move played in analysis matched the engine's best move. */
export function recordAnalysedMove(memory: CoachMemory, matchedEngine: boolean): CoachMemory {
  return {
    ...memory,
    movesAnalysed: memory.movesAnalysed + 1,
    movesMatchingEngine: memory.movesMatchingEngine + (matchedEngine ? 1 : 0),
  };
}

/** A clean solve counts fully; a solve after mistakes counts half. */
const attemptScore = (a: { solved: boolean; mistakes: number }) => (a.solved ? (a.mistakes === 0 ? 1 : 0.5) : 0);

export function themeStats(memory: CoachMemory): ThemeStat[] {
  const byTheme = new Map<string, { attempts: number; score: number }>();
  for (const a of memory.history) {
    const t = byTheme.get(a.theme) ?? { attempts: 0, score: 0 };
    t.attempts += 1;
    t.score += attemptScore(a);
    byTheme.set(a.theme, t);
  }
  return [...byTheme.entries()].map(([theme, t]) => ({
    theme,
    attempts: t.attempts,
    successRate: t.attempts > 0 ? t.score / t.attempts : 0,
  }));
}

/** Themes tried at least twice, weakest first. */
export function weaknesses(memory: CoachMemory, max = 3): string[] {
  return themeStats(memory)
    .filter(t => t.attempts >= 2 && t.successRate < 0.7)
    .sort((a, b) => a.successRate - b.successRate)
    .slice(0, max)
    .map(t => t.theme);
}

export function strengths(memory: CoachMemory, max = 3): string[] {
  return themeStats(memory)
    .filter(t => t.attempts >= 2 && t.successRate >= 0.8)
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, max)
    .map(t => t.theme);
}

/**
 * Change in success rate, in percentage points, between the latest 10 attempts and
 * the 10 before them. Null until there are enough attempts to compare.
 */
export function improvementRate(memory: CoachMemory): number | null {
  if (memory.history.length < 10) return null;
  const recent = memory.history.slice(0, 10);
  const earlier = memory.history.slice(10, 20);
  if (earlier.length < 5) return null;
  const rate = (list: typeof recent) => list.reduce((sum, a) => sum + attemptScore(a), 0) / list.length;
  return Math.round((rate(recent) - rate(earlier)) * 100);
}

export function engineMatchRate(memory: CoachMemory): number | null {
  if (memory.movesAnalysed < 5) return null;
  return Math.round((memory.movesMatchingEngine / memory.movesAnalysed) * 100);
}

export function strengthTier(rating: number): StrengthTier {
  if (rating < 1000) return 'beginner';
  if (rating < 1500) return 'intermediate';
  if (rating < 1900) return 'advanced';
  if (rating < 2200) return 'expert';
  return 'master';
}

const DIFFICULTY_LEVEL: Record<ExerciseDifficulty, number> = { easy: 0, medium: 1, hard: 2, master: 3 };

/** Difficulty level the player is ready for: rating sets the base, recent results nudge it. */
export function targetDifficulty(rating: number, memory: CoachMemory): number {
  const base = rating < 1000 ? 0 : rating < 1500 ? 1 : rating < 1900 ? 2 : 3;
  const recent = memory.history.slice(0, 5);
  if (recent.length < 3) return base;
  const score = recent.reduce((sum, a) => sum + attemptScore(a), 0) / recent.length;
  if (score >= 0.8) return Math.min(3, base + 1);
  if (score < 0.4) return Math.max(0, base - 1);
  return base;
}

/**
 * Picks the next exercise. Unsolved exercises come first, then ones on weak themes,
 * then solved-with-mistakes ones that are due for review (spaced by days since the
 * last solve), with difficulty kept close to what the player is ready for.
 */
export function recommendNext<T extends ExerciseMeta>(
  exercises: T[],
  memory: CoachMemory,
  rating: number,
  now: number,
  excludeId?: string
): T | null {
  const target = targetDifficulty(rating, memory);
  const weak = new Set(weaknesses(memory, 5));
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const ex of exercises) {
    if (ex.id === excludeId) continue;
    const rec = memory.exercises[ex.id];
    let score = 0;
    if (!rec || rec.solved === 0) score += 100;
    if (weak.has(ex.theme)) score += 40;
    if (rec && rec.solved > 0) {
      // Review a solved exercise once enough days have passed for its error rate.
      const daysSince = rec.lastSolvedAt ? (now - rec.lastSolvedAt) / DAY_MS : Infinity;
      const interval = rec.mistakes > 0 ? 1 : 7;
      score += daysSince >= interval ? 30 : -50;
    }
    score -= Math.abs(DIFFICULTY_LEVEL[ex.difficulty] - target) * 25;
    if (score > bestScore) {
      bestScore = score;
      best = ex;
    }
  }
  return best;
}
