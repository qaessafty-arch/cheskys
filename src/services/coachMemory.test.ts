import {
  emptyMemory,
  recordAttempt,
  recordAnalysedMove,
  weaknesses,
  strengths,
  improvementRate,
  engineMatchRate,
  targetDifficulty,
  recommendNext,
  startSession,
  strengthTier,
  ExerciseMeta,
} from './coachMemory';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean) {
  if (ok) {
    passed++;
    console.log(`PASS: ${name}`);
  } else {
    failed++;
    console.log(`FAIL: ${name}`);
  }
}

const DAY = 24 * 60 * 60 * 1000;
const fork: ExerciseMeta = { id: 'fork', theme: 'tactics_fork', difficulty: 'easy' };
const pin: ExerciseMeta = { id: 'pin', theme: 'tactics_pin', difficulty: 'easy' };
const mate: ExerciseMeta = { id: 'mate', theme: 'checkmate', difficulty: 'medium' };
const hard: ExerciseMeta = { id: 'hard', theme: 'prophylaxis', difficulty: 'hard' };
const all = [fork, pin, mate, hard];

let m = emptyMemory();
m = recordAttempt(m, fork, { solved: true, mistakes: 0, timeMs: 9000, at: 1 });
m = recordAttempt(m, fork, { solved: true, mistakes: 0, timeMs: 5000, at: 2 });
check('attempts and solves are counted per exercise', m.exercises.fork.attempts === 2 && m.exercises.fork.solved === 2);
check('best time keeps the fastest solve', m.exercises.fork.bestTimeMs === 5000);

m = recordAttempt(m, pin, { solved: false, mistakes: 2, timeMs: 30000, at: 3 });
m = recordAttempt(m, pin, { solved: true, mistakes: 3, timeMs: 40000, at: 4 });
check('a failed theme is reported as a weakness', weaknesses(m).includes('tactics_pin'));
check('a clean theme is reported as a strength', strengths(m).includes('tactics_fork'));
check('a strong theme is not a weakness', !weaknesses(m).includes('tactics_fork'));
check('one attempt is not enough to judge a theme', !weaknesses(recordAttempt(emptyMemory(), mate, { solved: false, mistakes: 1, timeMs: 1, at: 1 })).includes('checkmate'));

const now = 10 * DAY;
check('an unsolved exercise is recommended before solved ones', recommendNext(all, m, 800, now)?.id === 'mate');
const afterMate = recordAttempt(m, mate, { solved: true, mistakes: 0, timeMs: 1000, at: now });
check('the weak theme is recommended once everything easy is solved', recommendNext([fork, pin, mate], afterMate, 800, now)?.id === 'pin');
check('the current exercise is never recommended again immediately', recommendNext([fork, pin], afterMate, 800, now, 'pin')?.id === 'fork');
check('a beginner is steered away from hard exercises', recommendNext([hard, mate], emptyMemory(), 700, now)?.id === 'mate');
check('a strong player is steered toward hard exercises', recommendNext([hard, fork], emptyMemory(), 2000, now)?.id === 'hard');

let streak = emptyMemory();
for (let i = 0; i < 5; i++) streak = recordAttempt(streak, fork, { solved: true, mistakes: 0, timeMs: 1, at: i });
check('a run of clean solves raises the target difficulty', targetDifficulty(800, streak) === 1);
let slump = emptyMemory();
for (let i = 0; i < 5; i++) slump = recordAttempt(slump, mate, { solved: false, mistakes: 2, timeMs: 1, at: i });
check('a run of failures lowers the target difficulty', targetDifficulty(1600, slump) === 1);

check('improvement is unknown with too few attempts', improvementRate(m) === null);
let progress = emptyMemory();
for (let i = 0; i < 10; i++) progress = recordAttempt(progress, pin, { solved: false, mistakes: 1, timeMs: 1, at: i });
for (let i = 10; i < 20; i++) progress = recordAttempt(progress, pin, { solved: true, mistakes: 0, timeMs: 1, at: i });
check('improvement compares recent attempts with earlier ones', improvementRate(progress) === 100);

let moves = emptyMemory();
for (let i = 0; i < 4; i++) moves = recordAnalysedMove(moves, i % 2 === 0);
check('engine match rate needs at least 5 moves', engineMatchRate(moves) === null);
moves = recordAnalysedMove(moves, true);
check('engine match rate is the share of best moves', engineMatchRate(moves) === 60);

const s1 = startSession(emptyMemory(), 0);
check('a session within the hour is not counted twice', startSession(s1, 30 * 60 * 1000).sessions === 1);
check('a later visit starts a new session', startSession(s1, 2 * 60 * 60 * 1000).sessions === 2);
check('strength tier follows rating', strengthTier(800) === 'beginner' && strengthTier(2300) === 'master');

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
