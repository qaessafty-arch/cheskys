import { diagnose, findFork, winningCapture } from './mistakes';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.error(`FAIL ${name}`, detail ?? '');
  }
};

const facts = (fenBefore: string, playedUci: string, bestLine: string[], replyLine: string[], mateBefore: number | null = null, mateAfter: number | null = null) =>
  ({ fenBefore, playedUci, bestLine, replyLine, mateBefore, mateAfter });

// Hanging piece: 3.Nh4?? walks into ...Qxh4.
{
  const d = diagnose(facts('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'f3h4', ['f1c4'], ['d8h4']));
  check('hanging motif', d.motif === 'hanging_piece', d);
  check('hanging text', d.explanation.includes('knight on h4') && d.explanation.includes('Qxh4'), d.explanation);
  check('hanging san', d.playedSan === 'Nh4' && d.bestSan === 'Bc4', d);
}

// Allowed fork: h3?? lets ...Nc2+ hit king and rook.
{
  const d = diagnose(facts('4k3/8/8/8/3n4/8/7P/R3K3 w - - 0 1', 'h2h3', ['a1a4'], ['d4c2']));
  check('allowed fork motif', d.motif === 'allowed_fork', d);
  check('allowed fork text', d.explanation.includes('your king') && d.explanation.includes('rook on a1'), d.explanation);
}

// Missed fork: ...Ke7 instead of ...Nc2+.
{
  const d = diagnose(facts('4k3/8/8/8/3n4/8/7P/R3K3 b - - 0 1', 'e8e7', ['d4c2', 'e1d1', 'c2a1'], ['a1a7']));
  check('missed fork motif', d.motif === 'missed_fork', d);
  check('missed fork text', d.explanation.startsWith('Nc2+ was a knight fork'), d.explanation);
}

// Allowed back-rank mate.
{
  const d = diagnose(facts('6k1/p4ppp/8/8/8/8/5PPP/3R2K1 b - - 0 1', 'a7a6', ['g8f8'], ['d1d8'], null, 1));
  check('allowed mate motif', d.motif === 'allowed_mate', d);
  check('back rank flagged', d.backRank === true, d);
  check('allowed mate text', d.explanation.includes('mate in 1: Rd8#'), d.explanation);
}

// Missed mate in one.
{
  const d = diagnose(facts('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'g1f1', ['d1d8'], [], 1, null));
  check('missed mate motif', d.motif === 'missed_mate', d);
  check('missed mate text', d.explanation.includes('You had mate in 1: Rd8#'), d.explanation);
}

// Missed free material: Qxd5 was free.
{
  const d = diagnose(facts('4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1', 'e1f1', ['d1d5'], []));
  check('missed material motif', d.motif === 'missed_material', d);
  check('missed material text', d.explanation.includes('wins the knight on d5'), d.explanation);
}

// No tactic on the board: plain explanation, never a made-up motif.
{
  const d = diagnose(facts('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'g2g4', ['e2e4', 'e7e5'], ['d7d5']));
  check('positional motif', d.motif === 'positional', d);
  check('positional text', d.explanation.startsWith('e4 was stronger'), d.explanation);
}

// Helpers: an even trade is not a winning capture; a defended piece attacked by a pawn is.
check('even trade not winning', winningCapture('4k3/8/4p3/3n4/8/4N3/8/4K3 w - - 0 1', 'e3d5') === null);
check('pawn takes defended knight wins', winningCapture('4k3/8/4p3/3n4/2P5/8/8/4K3 w - - 0 1', 'c4d5')?.victim === 'n');
// A "fork" by a piece that is simply captured is not a fork.
check('unsafe fork rejected (king guards)', findFork('4k3/8/8/8/3n4/8/7P/R2K4 b - - 0 1', 'd4c2') === null);

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);
