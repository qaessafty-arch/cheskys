// Run with: node --test backend/elo.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateRatingChanges, expectedScore, kFactorFor, scoreForWinner, RATING_FLOOR, MAX_CHANGE_PER_GAME } from './elo.js';

test('equal ratings: winner gains exactly what the loser drops', () => {
  const r = calculateRatingChanges({ whiteRating: 1200, blackRating: 1200, whiteGames: 60, blackGames: 60, scoreWhite: 1 });
  assert.equal(r.whiteDelta, 10);   // K=20, expected 0.5
  assert.equal(r.blackDelta, -10);
  assert.equal(r.whiteDelta + r.blackDelta, 0);
});

test('new players use K=40 and move faster', () => {
  const r = calculateRatingChanges({ whiteRating: 1200, blackRating: 1200, whiteGames: 0, blackGames: 0, scoreWhite: 1 });
  assert.equal(r.whiteDelta, 20);
  assert.equal(r.blackDelta, -20);
});

test('a draw between equal players changes nothing', () => {
  const r = calculateRatingChanges({ whiteRating: 1500, blackRating: 1500, whiteGames: 80, blackGames: 80, scoreWhite: 0.5 });
  assert.equal(r.whiteDelta, 0);
  assert.equal(r.blackDelta, 0);
});

test('an upset pays more than an expected win', () => {
  const expectedWin = calculateRatingChanges({ whiteRating: 1800, blackRating: 1200, whiteGames: 80, blackGames: 80, scoreWhite: 1 });
  const upset = calculateRatingChanges({ whiteRating: 1200, blackRating: 1800, whiteGames: 80, blackGames: 80, scoreWhite: 1 });
  assert.ok(upset.whiteDelta > expectedWin.whiteDelta, 'underdog should gain more');
});

test('ratings never drop below the floor', () => {
  const r = calculateRatingChanges({ whiteRating: 100, blackRating: 2000, whiteGames: 80, blackGames: 80, scoreWhite: 0 });
  assert.equal(r.newWhiteRating, RATING_FLOOR);
});

test('a single game is capped', () => {
  const r = calculateRatingChanges({ whiteRating: 100, blackRating: 3000, whiteGames: 0, blackGames: 0, scoreWhite: 1 });
  assert.ok(Math.abs(r.whiteDelta) <= MAX_CHANGE_PER_GAME);
  assert.ok(Math.abs(r.blackDelta) <= MAX_CHANGE_PER_GAME);
});

test('missing ratings fall back to 1200 instead of NaN', () => {
  const r = calculateRatingChanges({ whiteRating: undefined, blackRating: null, whiteGames: 0, blackGames: 0, scoreWhite: 0.5 });
  assert.equal(r.newWhiteRating, 1200);
  assert.equal(r.newBlackRating, 1200);
  assert.ok(Number.isFinite(r.whiteDelta));
});

test('K-factor tiers', () => {
  assert.equal(kFactorFor(0), 40);
  assert.equal(kFactorFor(29), 40);
  assert.equal(kFactorFor(30), 30);
  assert.equal(kFactorFor(49), 30);
  assert.equal(kFactorFor(50), 20);
});

test('expected score is 0.5 for equal ratings and 10x odds at +400', () => {
  assert.equal(expectedScore(1200, 1200), 0.5);
  assert.ok(Math.abs(expectedScore(1600, 1200) - 10 / 11) < 1e-9);
});

test('winner mapping', () => {
  assert.equal(scoreForWinner('white'), 1);
  assert.equal(scoreForWinner('black'), 0);
  assert.equal(scoreForWinner('draw'), 0.5);
});
