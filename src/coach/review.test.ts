import { handleEngineRequest } from '../engine/handler';
import { EngineSearchResponse } from '../engine/protocol';
import { practiceFor, recordMistakes, loadMistakes, similarMistakes, mistakeCounts } from './mistakeLog';
import { reviewGame } from './review';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.error(`FAIL ${name}`, detail ?? '');
  }
};

// The real engine, called the way the worker calls it.
let nextId = 1;
const search = async (fen: string): Promise<EngineSearchResponse> => {
  const res = handleEngineRequest({ id: nextId++, type: 'search', fen, limits: { depth: 8, timeMs: 400 } });
  if (res.type !== 'search') throw new Error('search failed');
  return res.result;
};

// In-memory localStorage for the mistake log.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

(async () => {
  // White blunders the knight with 3.Nh4?? and Black takes it.
  const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Nh4', 'Qxh4'];
  const mistakes = await reviewGame(START, moves, 'w', search);
  check('one mistake found', mistakes.length === 1, mistakes.map(m => m.playedSan));
  const m = mistakes[0];
  check('it is Nh4', m?.playedSan === 'Nh4', m);
  check('labelled hanging piece', m?.motif === 'hanging_piece', m);
  check('blunder severity', m?.severity === 'blunder', m);
  check('move label', m?.moveLabel === '3.', m);
  check('explanation names the reply', !!m?.explanation.includes('Qxh4'), m?.explanation);

  // Black's moves are not reviewed when the player is White.
  const asBlack = await reviewGame(START, moves, 'b', search);
  check('black side clean', asBlack.length === 0, asBlack.map(x => x.playedSan));

  // Fool's mate: 2.g4?? allows mate in one.
  const fool = await reviewGame(START, ['f3', 'e5', 'g4', 'Qh4#'], 'w', search);
  check('fool mate reviewed', fool.some(x => x.playedSan === 'g4' && x.motif === 'allowed_mate'), fool.map(x => [x.playedSan, x.motif]));

  // The log remembers mistakes and finds similar ones from earlier games.
  recordMistakes('tester', mistakes, 'Pawn Cadet', 1000);
  recordMistakes('tester', mistakes, 'Pawn Cadet', 2000); // same position: not stored twice
  const log = loadMistakes('tester');
  check('log stored once', log.length === 1, log);
  check('similar finds it', similarMistakes(log, 'hanging_piece').length === 1);
  check('similar excludes the game under review', similarMistakes(log, 'hanging_piece', 1000).length === 0);
  check('counts', mistakeCounts(log)[0]?.count === 1);

  // Practice positions exist for every kind of mistake and replay legally.
  const { Chess } = await import('chess.js');
  for (const motif of ['allowed_mate', 'missed_mate', 'hanging_piece', 'missed_material', 'allowed_fork', 'missed_fork', 'positional'] as const) {
    const list = practiceFor(motif, { max: 5 });
    check(`practice for ${motif}`, list.length > 0, motif);
    for (const ex of list) {
      const g = new Chess(ex.fen);
      let ok = true;
      for (const san of ex.solution) {
        try { g.move(san); } catch { ok = false; break; }
      }
      check(`practice ${ex.id} legal`, ok, ex);
    }
  }
  check('back-rank first', /back.rank/i.test(practiceFor('allowed_mate', { backRank: true })[0]?.theme ?? '') ||
    practiceFor('allowed_mate', { backRank: true })[0]?.id === 'mate_back_rank');

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed) process.exit(1);
})();
