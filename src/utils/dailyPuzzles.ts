import { Puzzle, DailyPuzzleProgress } from '../types/chess';
import { puzzleFromLichess } from './lichessPuzzle';
import { VERIFIED_PUZZLES, toPuzzle } from '../data/verifiedPuzzles';

export interface DailyPuzzleData extends Puzzle {
  dateKey: string;
  source: 'peshmerga_archive' | 'grandmaster_daily' | 'lichess';
  loreContext: string;
  tacticalTidbit: string;
  solutionExplanation?: string;
  sourceUrl?: string;
}

// Daily puzzles rotate through the engine-checked set in src/data/verifiedPuzzles.ts.
export const DAILY_PUZZLES_ARCHIVE: Omit<DailyPuzzleData, 'dateKey'>[] = VERIFIED_PUZZLES.map(p => ({
  ...toPuzzle(p),
  source: p.game ? 'grandmaster_daily' : 'peshmerga_archive',
  loreContext: p.game ? `${p.game.white} – ${p.game.black}, ${p.game.event} ${p.game.year}.` : 'A pattern every player should know.',
  tacticalTidbit: p.tip,
  solutionExplanation: p.explanation
}));

export const getTodayDateKey = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getFormattedDate = (dateKey: string): string => {
  try {
    const [y, m, d] = dateKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  } catch {
    return dateKey;
  }
};

export const getFormattedTodayDate = (): string => {
  return getFormattedDate(getTodayDateKey());
};

// Generates deterministic daily puzzle based on date string
export const getDailyPuzzleForDate = (dateKey: string = getTodayDateKey()): DailyPuzzleData => {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash << 5) - hash + dateKey.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % DAILY_PUZZLES_ARCHIVE.length;
  const base = DAILY_PUZZLES_ARCHIVE[index];

  return {
    ...base,
    id: `daily-${dateKey}-${base.id}`,
    dateKey
  };
};

// Fetch live puzzle online with graceful fallback to built-in archive
export const fetchLiveDailyPuzzle = async (dateKey: string = getTodayDateKey()): Promise<DailyPuzzleData> => {
  const fallback = getDailyPuzzleForDate(dateKey);

  // If today's date, attempt to query lichess daily puzzle
  if (dateKey === getTodayDateKey()) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch('https://lichess.org/api/puzzle/daily', {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const live = puzzleFromLichess(await res.json());
        if (live) {
          return {
            ...fallback,
            id: `lichess-${live.id}`,
            source: 'lichess',
            fen: live.fen,
            playerColor: live.playerColor,
            solutionMoves: live.solutionMoves,
            rating: live.rating,
            theme: live.themes.slice(0, 2).join(' & ') || 'Lichess puzzle',
            title: 'Lichess Puzzle of the Day',
            sourceUrl: live.url,
            description: `Today's puzzle from Lichess (rated ${live.rating}). Find the best move.`,
            loreContext: 'Lichess builds its puzzles from real games between its players.',
            tacticalTidbit: 'Look at every check and capture first.',
            solutionExplanation: `Solution: ${live.solutionMoves.join(' ')}.`
          };
        }
      }
    } catch {
      // Fallback seamlessly to curated archive
    }
  }

  return fallback;
};

// Time remaining calculation until the next 24h reset
export const getTimeUntilNextDailyPuzzle = (): {
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
} => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const diffMs = tomorrow.getTime() - now.getTime();
  const totalSecs = Math.max(0, Math.floor(diffMs / 1000));

  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const formatted = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;

  return { hours, minutes, seconds, formatted };
};

const DAILY_STORAGE_KEY = 'chesskys_daily_puzzle_progress';

export const loadDailyProgress = (dateKey: string = getTodayDateKey()): DailyPuzzleProgress => {
  try {
    const raw = localStorage.getItem(DAILY_STORAGE_KEY);
    if (raw) {
      const data: DailyPuzzleProgress = JSON.parse(raw);
      const isToday = data.dateKey === dateKey;
      const solvedDates = data.solvedDates || (data.solved && data.dateKey ? [data.dateKey] : []);
      const isDateSolved = solvedDates.includes(dateKey) || (isToday && data.solved);

      // Check streak continuity
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      
      const streak = data.lastSolvedDate === yesterdayKey || data.lastSolvedDate === dateKey ? data.streak : 0;

      return {
        dateKey,
        solved: isDateSolved,
        streak,
        lastSolvedDate: data.lastSolvedDate || '',
        totalDailySolved: data.totalDailySolved || solvedDates.length,
        solvedDates
      };
    }
  } catch (e) {
    console.error('Failed to read daily progress:', e);
  }

  return {
    dateKey,
    solved: false,
    streak: 0,
    lastSolvedDate: '',
    totalDailySolved: 0,
    solvedDates: []
  };
};

export const saveDailyProgress = (dateKey: string, solved: boolean): DailyPuzzleProgress => {
  try {
    const prev = loadDailyProgress(dateKey);
    const solvedDates = new Set(prev.solvedDates || []);
    if (solved) {
      solvedDates.add(dateKey);
    }

    const isConsecutive = prev.lastSolvedDate === dateKey || (() => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      return prev.lastSolvedDate === yesterdayKey;
    })();

    const updated: DailyPuzzleProgress = {
      dateKey,
      solved,
      streak: solved ? (prev.lastSolvedDate === dateKey ? prev.streak : isConsecutive ? prev.streak + 1 : 1) : prev.streak,
      lastSolvedDate: solved ? dateKey : prev.lastSolvedDate,
      totalDailySolved: solvedDates.size,
      solvedDates: Array.from(solvedDates)
    };

    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to save daily progress:', e);
    return {
      dateKey,
      solved,
      streak: 1,
      lastSolvedDate: dateKey,
      totalDailySolved: 1,
      solvedDates: [dateKey]
    };
  }
};

// Generate list of days in current month for the Daily Archive Calendar
export const getMonthlyCalendarDays = (year: number = new Date().getFullYear(), month: number = new Date().getMonth()): {
  dateKey: string;
  dayNumber: number;
  dayName: string;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
}[] => {
  const days = [];
  const todayKey = getTodayDateKey();
  const numDays = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= numDays; d++) {
    const dayStr = String(d).padStart(2, '0');
    const monthStr = String(month + 1).padStart(2, '0');
    const dateKey = `${year}-${monthStr}-${dayStr}`;
    const dateObj = new Date(year, month, d);
    const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(dateObj);

    const isToday = dateKey === todayKey;
    const isPast = dateKey < todayKey;
    const isFuture = dateKey > todayKey;

    days.push({
      dateKey,
      dayNumber: d,
      dayName,
      isToday,
      isPast,
      isFuture
    });
  }

  return days;
};

export const generateDailyShareText = (puzzle: DailyPuzzleData, streak: number): string => {
  return `⚔️ Chesskys Peshmerga Edition • Daily Chess Tactics ☀️
📅 ${puzzle.dateKey} — "${puzzle.title}"
🎯 Solved Cleanly! (${puzzle.difficulty} • ${puzzle.rating} Elo)
🔥 Daily Tactical Streak: ${streak} Days
♟️ Play Daily Challenge: https://chesskys.pro`;
};
