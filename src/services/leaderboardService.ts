import { collection, query, orderBy, limit, getDocs, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../utils/firebase';

// Real leaderboard rows built from `users` documents. Nothing here is generated:
// a player appears only if their profile exists in Firestore, with the stats it holds.

export type LeaderboardSort = 'elo' | 'respect';

export interface RankedPlayer {
  uid: string;
  displayName: string;
  username: string;
  photoURL: string;
  avatar: string;
  country: string;
  flag: string;
  elo: number;
  respectPoints: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  executions: number;
  mercies: number;
  winRate: number;
  streak: number;
  streakType: 'win' | 'loss';
  rank: number;
  title: string;
  honorRank?: string;
  role?: string;
  isCurrentUser?: boolean;
}

const finite = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export const ratingField = (mode: string = 'blitz') =>
  mode === 'blitz' ? 'elo' : `elo${mode.charAt(0).toUpperCase()}${mode.slice(1)}`;

const sortField = (sortBy: LeaderboardSort) => (sortBy === 'elo' ? 'elo' : 'respectPoints');

/**
 * Converts a user document to a row, or null when it cannot be ranked honestly:
 * private profiles, and placeholder values such as '∞' that are not real ratings.
 */
export function toRankedPlayer(uid: string, d: any, mode: string = 'blitz'): RankedPlayer | null {
  // Seeded demo players (DatabaseView) use readable ids like gm_*; real Firebase uids never do.
  if (!d || d.isPublic === false || d.isGuest || d.isSample || uid.startsWith('gm_')) return null;
  const elo = finite(d[ratingField(mode)]) ?? finite(d.elo);
  const respectPoints = finite(d.respectPoints);
  if (elo === null || respectPoints === null) return null;

  const wins = finite(d.wins) ?? 0;
  const draws = finite(d.draws) ?? 0;
  const gamesPlayed = Math.max(finite(d.gamesPlayed) ?? 0, wins + draws);
  // Older profiles never stored losses; every game that was not a win or draw was one.
  const losses = finite(d.losses) ?? Math.max(0, gamesPlayed - wins - draws);
  const decided = wins + losses + draws;
  const streak = finite(d.streak) ?? 0;

  return {
    uid,
    displayName: d.displayName || d.username || 'Player',
    username: d.username || '',
    photoURL: d.photoURL || '',
    avatar: d.photoURL || '',
    country: d.country || '',
    flag: d.flag || '',
    elo,
    respectPoints,
    wins,
    losses,
    draws,
    gamesPlayed,
    executions: finite(d.executions) ?? 0,
    mercies: finite(d.merciesGranted) ?? 0,
    winRate: decided > 0 ? Math.round((wins / decided) * 100) : 0,
    streak,
    streakType: d.streakType === 'loss' ? 'loss' : 'win',
    rank: 0,
    title: d.title || '',
    honorRank: d.honorRank || undefined,
    role: d.role || undefined,
  };
}

/**
 * Top players straight from Firestore, ranked 1..n. Rating boards only list players who
 * have finished at least one game, so untouched starting ratings do not fill the table.
 */
export async function fetchRankedPlayers(
  sortBy: LeaderboardSort = 'elo',
  max: number = 200,
  currentUid?: string,
  mode: string = 'blitz'
): Promise<RankedPlayer[]> {
  const field = sortBy === 'elo' ? ratingField(mode) : sortField(sortBy);
  // Over-fetch a little: placeholder or private profiles are dropped after the read.
  const snap = await getDocs(query(collection(db, 'users'), orderBy(field, 'desc'), limit(max + 20)));
  const rows: RankedPlayer[] = [];
  snap.forEach(docSnap => {
    const row = toRankedPlayer(docSnap.id, docSnap.data(), mode);
    if (!row) return;
    if (sortBy === 'elo' && row.gamesPlayed === 0) return;
    rows.push(row);
  });
  rows.sort((a, b) => (sortBy === 'elo' ? b.elo - a.elo : b.respectPoints - a.respectPoints));
  return rows.slice(0, max).map((row, i) => ({ ...row, rank: i + 1, isCurrentUser: !!currentUid && row.uid === currentUid }));
}

/**
 * 1-based position of a score on the board, counted on the server so it is correct
 * for players outside the fetched top list. Ties share the better position.
 */
export async function fetchRankForScore(sortBy: LeaderboardSort, score: number, mode: string = 'blitz'): Promise<number | null> {
  try {
    const field = sortBy === 'elo' ? ratingField(mode) : sortField(sortBy);
    const ahead = await getCountFromServer(query(collection(db, 'users'), where(field, '>', score)));
    return ahead.data().count + 1;
  } catch {
    return null;
  }
}
