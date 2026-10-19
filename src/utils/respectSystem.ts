import { RespectProfile, RespectLeaderboardEntry } from '../types/chess';

const RESPECT_STORAGE_KEY = 'chesskys_respect_profile_v1';

export const HONOR_RANKS = [
  { minRespect: 0, title: 'Mountain Recruit', badge: '🌾', description: 'New player learning the basics' },
  { minRespect: 25, title: 'Desert Scout', badge: '🗡️', description: 'Getting comfortable with the game' },
  { minRespect: 75, title: 'Zagros Vanguard', badge: '🛡️', description: 'A steady, reliable player' },
  { minRespect: 150, title: 'Peshmerga Guardian', badge: '🌿', description: 'Plays fair and shows good sportsmanship' },
  { minRespect: 300, title: 'Eagle of Kurdistan', badge: '🦅', description: 'Strong player with good planning' },
  { minRespect: 500, title: 'Lion of Kurdistan', badge: '🦁', description: 'Top player, respected by everyone' },
  { minRespect: 1000, title: 'Supreme Peshmerga Grandmaster', badge: '☀️', description: 'The highest rank on Chesskys' }
];

export function getHonorRank(respectPoints: number | string): { title: string; badge: string; nextRank?: { title: string; pointsNeeded: number } } {
  if (respectPoints === '∞') {
    return {
      title: 'Supreme Immortal Grandmaster',
      badge: '☀️',
      nextRank: undefined
    };
  }

  let numPoints = 0;
  if (typeof respectPoints === 'number') {
    numPoints = isNaN(respectPoints) ? 0 : respectPoints;
  } else {
    numPoints = parseInt(String(respectPoints)) || 0;
  }
  let current = HONOR_RANKS[0];
  let nextRank: { title: string; pointsNeeded: number } | undefined = undefined;

  for (let i = 0; i < HONOR_RANKS.length; i++) {
    if (numPoints >= HONOR_RANKS[i].minRespect) {
      current = HONOR_RANKS[i];
      if (i + 1 < HONOR_RANKS.length) {
        nextRank = {
          title: HONOR_RANKS[i + 1].title,
          pointsNeeded: HONOR_RANKS[i + 1].minRespect - numPoints
        };
      } else {
        nextRank = undefined;
      }
    }
  }

  return {
    title: current.title,
    badge: current.badge,
    nextRank
  };
}

export function getRespectProfile(): RespectProfile {
  if (typeof window === 'undefined') {
    return {
      elo: 1200,
      respectPoints: 100,
      executions: 8,
      merciesGranted: 4,
      gamesPlayed: 14,
      wins: 10,
      honorRank: 'Peshmerga Guardian',
      rankBadge: '🌿'
    };
  }

  try {
    const saved = localStorage.getItem(RESPECT_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const rank = getHonorRank(parsed.respectPoints || 0);
      return {
        ...parsed,
        honorRank: rank.title,
        rankBadge: rank.badge
      };
    }
  } catch (e) {
    console.error('Failed to load respect profile', e);
  }

  const initial: RespectProfile = {
    elo: 1200,
    respectPoints: 85,
    executions: 7,
    merciesGranted: 5,
    gamesPlayed: 12,
    wins: 9,
    honorRank: 'Zagros Vanguard',
    rankBadge: '🛡️'
  };
  saveRespectProfile(initial);
  return initial;
}

export function saveRespectProfile(profile: RespectProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RESPECT_STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to save respect profile', e);
  }
}

// Honor and Elo are separate. Judgments only move honor points. Rating changes only in rated
// games, and the server sets them, so a local judgment can never change a player's Elo.
export function recordExecution(customProfile?: RespectProfile): RespectProfile {
  const current = customProfile || getRespectProfile();
  const isInfinite = current.isImmortal || current.respectPoints === '∞' || current.elo === '∞';

  const numRespect = typeof current.respectPoints === 'number' ? current.respectPoints : 100;
  const numExecutions = typeof current.executions === 'number' ? current.executions : 0;

  // Execute: no honor gain (cold, decisive).
  const updatedRespect = isInfinite ? '∞' : numRespect;
  const rank = getHonorRank(updatedRespect);

  const updated: RespectProfile = {
    ...current,
    respectPoints: updatedRespect,
    executions: isInfinite ? '∞' : numExecutions + 1,
    gamesPlayed: typeof current.gamesPlayed === 'number' ? current.gamesPlayed + 1 : 1,
    wins: typeof current.wins === 'number' ? current.wins + 1 : 1,
    honorRank: isInfinite ? 'IMMORTAL' : rank.title,
    rankBadge: isInfinite ? '☀️' : rank.badge
  };

  saveRespectProfile(updated);
  return updated;
}

export function recordMercy(customProfile?: RespectProfile): RespectProfile {
  const current = customProfile || getRespectProfile();
  const isInfinite = current.isImmortal || current.respectPoints === '∞' || current.elo === '∞';

  const numRespect = typeof current.respectPoints === 'number' ? current.respectPoints : 100;
  const numMercies = typeof current.merciesGranted === 'number' ? current.merciesGranted : 0;

  // Spare: honorific gain only.
  const updatedRespect = isInfinite ? '∞' : numRespect + 12;
  const rank = getHonorRank(updatedRespect);

  const updated: RespectProfile = {
    ...current,
    respectPoints: updatedRespect,
    merciesGranted: isInfinite ? '∞' : numMercies + 1,
    honorRank: isInfinite ? 'IMMORTAL' : rank.title,
    rankBadge: isInfinite ? '☀️' : rank.badge
  };

  saveRespectProfile(updated);
  return updated;
}

export function recordVictory(customProfile?: RespectProfile): RespectProfile {
  return recordExecution(customProfile);
}

