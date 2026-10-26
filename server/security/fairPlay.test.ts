/**
 * Fair-play tests.  Run with:  npx tsx server/security/fairPlay.test.ts
 *
 * The game fixtures are bot games (see fixtures/fairPlayGames.json): "cheating"
 * is the engine's own best move every turn, "honest" is the rated bots, which
 * make human-like mistakes. This checks the mechanics and that the thresholds
 * separate the two; it says nothing about how real humans score.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  analyseGame, assessSide, escalateWithHistory, expectedEquivalentRate, MIN_ANALYSED_MOVES, type SideStats
} from './fairPlay';
import { FairPlayService } from './fairPlayService';

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { passed++; console.log(`PASS  ${name}`); }
  else { failed++; console.log(`FAIL  ${name} ${detail}`); }
};

const stats = (over: Partial<SideStats> = {}): SideStats => ({
  analysed: 30, engineEquivalentRate: 0.45, topMoveRate: 0.3, acpl: 60, timingCv: null, meanMoveMs: null, ...over
});

(async () => {
  /* ---- verdict rules ---- */
  check('expected rate rises with rating',
    expectedEquivalentRate(600) < expectedEquivalentRate(1500) && expectedEquivalentRate(1500) < expectedEquivalentRate(2400));
  check('too few scored moves gives no verdict',
    assessSide(stats({ analysed: MIN_ANALYSED_MOVES - 1, engineEquivalentRate: 1, acpl: 0 }), 1000).verdict === 'none');
  check('ordinary play at the expected rate is not flagged',
    assessSide(stats({ engineEquivalentRate: expectedEquivalentRate(1200) }), 1200).verdict === 'none');
  check('a strong player matching a lot is not flagged at their own level',
    assessSide(stats({ engineEquivalentRate: 0.65, acpl: 12 }), 2500).verdict === 'none');
  check('perfect play over a long game is flagged for review',
    assessSide(stats({ analysed: 40, engineEquivalentRate: 0.97, acpl: 3 }), 1100).verdict === 'review');
  check('suspicious but short sample is only watch',
    assessSide(stats({ analysed: 11, engineEquivalentRate: 1, acpl: 1 }), 1050).verdict === 'watch');
  check('even move times alone never raise a verdict',
    assessSide(stats({ engineEquivalentRate: expectedEquivalentRate(1200), timingCv: 0.02 }), 1200).verdict === 'none');
  check('even move times push a watch to review',
    assessSide(stats({ analysed: 11, engineEquivalentRate: 1, acpl: 1, timingCv: 0.1 }), 1050).verdict === 'review');
  const watch = assessSide(stats({ analysed: 11, engineEquivalentRate: 1, acpl: 1 }), 1050);
  check('a watch game after an elevated one escalates to review',
    escalateWithHistory(watch, [{ verdict: 'watch', at: 1 }]).verdict === 'review');
  check('a watch game after clean games stays watch',
    escalateWithHistory(watch, [{ verdict: 'none', at: 1 }, { verdict: 'none', at: 2 }]).verdict === 'watch');

  /* ---- analysis mechanics ---- */
  const fixtures = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'server', 'security', 'fixtures', 'fairPlayGames.json'), 'utf-8')) as
    Record<string, { rating: number; side: 'w' | 'b'; moves: string[] }>;
  const fast = { depth: 4, perPlyMs: 3000 }; // the depth the server uses

  const short = await analyseGame(fixtures.honestKnightVsBishop.moves.slice(0, 8).map(uci => ({ uci })), fast);
  check('opening moves are not scored', short.w.analysed === 0 && short.b.analysed === 0 && short.skipped.opening === 8);

  const broken = await analyseGame([{ uci: 'e2e4' }, { uci: 'e2e4' }, { uci: 'a7a6' }], { ...fast, skipPlies: 0 });
  check('an illegal move stops the analysis instead of guessing', broken.plies === 3 && broken.w.analysed + broken.b.analysed <= 1);

  /* ---- engine-vs-honest separation ---- */
  const run = async (key: string) => {
    const f = fixtures[key];
    const a = await analyseGame(f.moves.map(uci => ({ uci })), fast);
    return { a, assessment: assessSide(a[f.side], f.rating) };
  };
  const cheat = await run('cheatVsKnight');
  const honest1 = await run('honestKnightVsBishop');
  const honest2 = await run('honestBishopVsKnight');
  console.log(`      cheater   eq=${(cheat.a.w.engineEquivalentRate * 100).toFixed(0)}% n=${cheat.a.w.analysed} acpl=${cheat.a.w.acpl.toFixed(0)} z=${cheat.assessment.z.toFixed(1)} -> ${cheat.assessment.verdict}`);
  console.log(`      honest 1  eq=${(honest1.a.w.engineEquivalentRate * 100).toFixed(0)}% n=${honest1.a.w.analysed} acpl=${honest1.a.w.acpl.toFixed(0)} z=${honest1.assessment.z.toFixed(1)} -> ${honest1.assessment.verdict}`);
  console.log(`      honest 2  eq=${(honest2.a.w.engineEquivalentRate * 100).toFixed(0)}% n=${honest2.a.w.analysed} acpl=${honest2.a.w.acpl.toFixed(0)} z=${honest2.assessment.z.toFixed(1)} -> ${honest2.assessment.verdict}`);
  check('the engine-perfect side is flagged (watch or review)', cheat.assessment.verdict !== 'none');
  check('human-like bots are not flagged', honest1.assessment.verdict === 'none' && honest2.assessment.verdict === 'none');
  check('the cheater scores clearly higher than the honest bots',
    cheat.a.w.engineEquivalentRate > honest1.a.w.engineEquivalentRate + 0.3 && cheat.a.w.acpl < honest1.a.w.acpl);

  /* ---- service: history, escalation, persistence ---- */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fairplay-'));
  const svc = new FairPlayService(dir);
  const match = { whiteUid: 'alice', blackUid: 'bob', whiteRating: 1050, blackRating: 1450 };
  const first = svc.recordGame('m1', match, cheat.a);
  check('first elevated game is recorded for the cheating side', first[0].uid === 'alice' && first[0].verdict !== 'none');
  const second = svc.recordGame('m2', match, cheat.a);
  check('a second elevated game escalates to review', second[0].verdict === 'review');
  check('the honest opponent is untouched', first[1].verdict === 'none' && second[1].verdict === 'none');
  check('review queue lists the flagged player', svc.reviewQueue().some(r => r.uid === 'alice'));
  check('client signals only accept known reasons',
    svc.recordClientSignal('alice', 'BOT_TIMING') === true && svc.recordClientSignal('alice', 'rm -rf') === false);
  await new Promise(r => setTimeout(r, 200));
  const reloaded = new FairPlayService(dir);
  check('history survives a restart', reloaded.historyOf('alice').length === 2);
  fs.rmSync(dir, { recursive: true, force: true });

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
})();
