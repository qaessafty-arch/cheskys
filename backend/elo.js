// Rating math for rated games. The live server (backend/index.js) is the only
// place that changes a stored rating, and it uses these functions.

export const DEFAULT_RATING = 1200;
export const RATING_FLOOR = 100;
// A single game can move a rating by at most this much, so one lucky result can't swing it.
export const MAX_CHANGE_PER_GAME = 50;

// New players move faster (K = 40 under 30 games), settled players slower (K = 20 from 50 games).
export function kFactorFor(gamesPlayed = 0) {
  const games = Number.isFinite(gamesPlayed) ? gamesPlayed : 0;
  if (games < 30) return 40;
  if (games < 50) return 30;
  return 20;
}

// Expected score of a player rated `own` against `opponent`, between 0 and 1.
export function expectedScore(own, opponent) {
  return 1 / (1 + 10 ** ((opponent - own) / 400));
}

// scoreWhite: 1 = white won, 0.5 = draw, 0 = black won.
// Returns the new ratings and the signed change for each side. Changes are
// zero-sum before the rating floor is applied.
export function calculateRatingChanges({ whiteRating, blackRating, whiteGames = 0, blackGames = 0, scoreWhite }) {
  const white = Number.isFinite(whiteRating) ? whiteRating : DEFAULT_RATING;
  const black = Number.isFinite(blackRating) ? blackRating : DEFAULT_RATING;

  const expectedWhite = expectedScore(white, black);
  const expectedBlack = 1 - expectedWhite;
  const scoreBlack = 1 - scoreWhite;

  const clamp = (value) => Math.max(-MAX_CHANGE_PER_GAME, Math.min(MAX_CHANGE_PER_GAME, value));
  const whiteDelta = clamp(Math.round(kFactorFor(whiteGames) * (scoreWhite - expectedWhite)));
  const blackDelta = clamp(Math.round(kFactorFor(blackGames) * (scoreBlack - expectedBlack)));

  return {
    whiteDelta,
    blackDelta,
    newWhiteRating: Math.max(RATING_FLOOR, white + whiteDelta),
    newBlackRating: Math.max(RATING_FLOOR, black + blackDelta)
  };
}

// Maps a game winner ('white' | 'black' | 'draw') to the score used above.
export function scoreForWinner(winner) {
  if (winner === 'white') return 1;
  if (winner === 'black') return 0;
  return 0.5;
}
