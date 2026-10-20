import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Chess, Square, Move } from 'chess.js';
import { PanelContainer } from './PanelContainer';
import { ChessBoard } from './ChessBoard';
import { EvalBar } from './EvalBar';
import { engine } from '../engine/client';
import { EngineSearchResponse } from '../engine/protocol';
import { detectOpening } from '../utils/openings';
import { soundManager } from '../utils/audio';
import { useAuth } from '../context/AuthContext';
import { getRespectProfile } from '../utils/respectSystem';
import {
  CoachMemory,
  StrengthTier,
  loadMemory,
  saveMemory,
  startSession,
  recordAttempt,
  recordAnalysedMove,
  weaknesses,
  strengths,
  improvementRate,
  engineMatchRate,
  strengthTier,
  recommendNext,
} from '../services/coachMemory';
import {
  Sparkles,
  Lightbulb,
  Trophy,
  BookOpen,
  Target,
  MessageSquare,
  Heart,
  Zap,
  Award,
  Flame,
  BrainCircuit,
  ClipboardPaste,
  Eye,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';
import { AppSettings } from '../types/chess';
import { TRAINING_EXERCISES, TrainingExercise } from '../data/coachExercises';

interface CoachPanelProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  initialFen?: string;
  initialPgn?: string;
}

interface CoachAdvice {
  id: string;
  type: 'move' | 'plan' | 'tactic' | 'positional' | 'endgame' | 'opening';
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  move?: string;
  fen?: string;
  explanation?: string;
  category: 'tactical' | 'positional' | 'strategic' | 'endgame' | 'opening';
  confidence: number;
}

interface CoachProfile {
  rating: number;
  strength: StrengthTier;
  weaknesses: string[];
  strengths: string[];
  sessions: number;
  solved: number;
  improvementRate: number | null;
  engineMatch: number | null;
}

interface CoachMessage {
  id: string;
  type: 'advice' | 'exercise' | 'praise' | 'warning' | 'celebration';
  content: string;
  timestamp: Date;
  relatedMove?: string;
  priority: 'high' | 'medium' | 'low';
}

const COACH_PERSONAS = {
  beginner: {
    name: 'Coach Alex',
    style: 'encouraging',
    focus: ['basics', 'tactics', 'piece safety'],
    catchphrases: [
      "Every master was once a beginner!",
      "Great job spotting that!",
      "Let's keep every piece safe first."
    ]
  },
  intermediate: {
    name: 'Coach Maya',
    style: 'analytical',
    focus: ['planning', 'calculation', 'structure'],
    catchphrases: [
      "Good calculation!",
      "What's your plan here?",
      "Let's look at the pawn structure."
    ]
  },
  advanced: {
    name: 'Coach Viktor',
    style: 'deep',
    focus: ['prophylaxis', 'transitions', 'endgames'],
    catchphrases: [
      "Interesting choice. What's your plan?",
      "Have you considered the prophylactic move?",
      "The endgame starts now."
    ]
  },
  master: {
    name: 'Grandmaster Aria',
    style: 'masterful',
    focus: ['deep strategy', 'psychology', 'endgame mastery'],
    catchphrases: [
      "Beautiful! You're thinking like a GM.",
      "The position whispers its secrets to those who listen.",
      "Excellence is in the details."
    ]
  }
};

const getCoachPersona = (rating: number) => {
  if (rating < 1200) return COACH_PERSONAS.beginner;
  if (rating < 1800) return COACH_PERSONAS.intermediate;
  if (rating < 2200) return COACH_PERSONAS.advanced;
  return COACH_PERSONAS.master;
};

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

const THEME_LABELS: Record<string, string> = {
  tactics_fork: 'forks',
  tactics_pin: 'pins',
  tactics_skewer: 'skewers',
  checkmate: 'checkmates',
  endgame: 'endgames',
  opening_italian: 'openings',
  prophylaxis: 'prophylaxis'
};
const themeLabel = (theme: string) => THEME_LABELS[theme] || theme.replace(/_/g, ' ');

/** Few pieces and no queens: the side to move should think in endgame terms. */
const isEndgame = (game: Chess) => {
  const pieces = game.board().flat().filter(Boolean) as { type: string }[];
  const heavyAndMinor = pieces.filter(p => p.type !== 'p' && p.type !== 'k');
  return !pieces.some(p => p.type === 'q') && heavyAndMinor.length <= 6;
};

const uciToSan = (fen: string, uci: string | null): string | null => {
  if (!uci) return null;
  try {
    const probe = new Chess(fen);
    const applied = probe.move({
      from: uci.slice(0, 2) as Square,
      to: uci.slice(2, 4) as Square,
      promotion: (uci[4] as 'q' | 'r' | 'b' | 'n' | undefined) ?? 'q'
    });
    return applied ? applied.san : null;
  } catch {
    return null;
  }
};

export const CoachPanel: React.FC<CoachPanelProps> = ({
  settings,
  initialFen,
  initialPgn
}) => {
  const { user, profile } = useAuth();
  const accountId = user?.uid || profile?.uid || 'guest';
  // Same source as the header's rating: the account's Elo, else the local profile kept for guests.
  const localElo = getRespectProfile().elo;
  const rating = typeof profile?.elo === 'number' ? profile.elo : typeof localElo === 'number' ? localElo : 1200;

  const [analysisGame, setAnalysisGame] = useState<Chess>(() => {
    const g = new Chess();
    if (initialPgn) {
      try { g.loadPgn(initialPgn); } catch {}
    } else if (initialFen) {
      try { g.load(initialFen); } catch {}
    }
    return g;
  });

  const [historyFens, setHistoryFens] = useState<string[]>([analysisGame.fen()]);
  const [historySans, setHistorySans] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isFlipped] = useState(false);
  const [evalScore, setEvalScore] = useState<number>(0);
  const [evalMate, setEvalMate] = useState<number | null>(null);
  const [bestMoveSan, setBestMoveSan] = useState<string | null>(null);
  const [searchDepth, setSearchDepth] = useState(0);
  const [fenInput, setFenInput] = useState('');
  const [showFenModal, setShowFenModal] = useState(false);
  const [coachAdvice, setCoachAdvice] = useState<CoachAdvice[]>([]);
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [currentExercise, setCurrentExercise] = useState<TrainingExercise | null>(null);
  const [currentExerciseStep, setCurrentExerciseStep] = useState(0);
  const [showAllExercises, setShowAllExercises] = useState(false);
  const [showCoachChat, setShowCoachChat] = useState(true);
  const exerciseStartRef = useRef(0);
  const exerciseMistakesRef = useRef(0);
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The coach's memory follows the signed-in account and survives reloads.
  const [memory, setMemory] = useState<CoachMemory>(() => startSession(loadMemory(accountId), Date.now()));
  const memoryRef = useRef(memory);
  memoryRef.current = memory;
  const loadedForRef = useRef(accountId);
  useEffect(() => {
    if (loadedForRef.current !== accountId) {
      loadedForRef.current = accountId;
      setMemory(startSession(loadMemory(accountId), Date.now()));
      return;
    }
    saveMemory(accountId, memory);
  }, [accountId, memory]);

  useEffect(() => () => {
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
  }, []);

  const coachProfile: CoachProfile = useMemo(() => ({
    rating,
    strength: strengthTier(rating),
    weaknesses: weaknesses(memory),
    strengths: strengths(memory),
    sessions: memory.sessions,
    solved: Object.values(memory.exercises).filter(r => r.solved > 0).length,
    improvementRate: improvementRate(memory),
    engineMatch: engineMatchRate(memory)
  }), [memory, rating]);

  const persona = getCoachPersona(rating);

  const pushMessages = useCallback((messages: CoachMessage[]) => {
    if (messages.length > 0) setCoachMessages(prev => [...messages, ...prev].slice(0, 20));
  }, []);

  const say = useCallback((type: CoachMessage['type'], content: string, priority: CoachMessage['priority'] = 'medium', relatedMove?: string) => {
    pushMessages([{ id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, type, content, timestamp: new Date(), priority, relatedMove }]);
  }, [pushMessages]);

  // Greets the player with what the coach has learned about them so far, once per account.
  const greetedRef = useRef<string | null>(null);
  useEffect(() => {
    if (greetedRef.current === accountId) return;
    greetedRef.current = accountId;
    const weak = weaknesses(memory);
    const solved = Object.values(memory.exercises).filter(r => r.solved > 0).length;
    if (solved === 0 && weak.length === 0) {
      say('advice', `${persona.name}: Welcome! Solve a few exercises and I'll learn where to help you most.`, 'high');
    } else if (weak.length > 0) {
      say('advice', `${persona.name}: Welcome back. Last time ${themeLabel(weak[0])} gave you trouble, so I'll bring those up first.`, 'high');
    } else {
      say('advice', `${persona.name}: Welcome back! ${solved} exercise${solved === 1 ? '' : 's'} solved so far. Let's keep going.`, 'high');
    }
    // Only once per account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const generateCoachAdvice = useCallback((game: Chess, result: EngineSearchResponse, bestSan: string | null) => {
    const advice: CoachAdvice[] = [];
    const now = Date.now();
    const moves = game.moves({ verbose: true });
    const mateNow = moves.find(m => m.san.includes('#'));
    const bestMove = bestSan ? moves.find(m => m.san === bestSan) : undefined;

    if (mateNow) {
      advice.push({
        id: `mate_${now}`,
        type: 'tactic',
        title: 'Checkmate Available!',
        description: `${mateNow.san} is checkmate right now.`,
        priority: 'critical',
        move: mateNow.san,
        category: 'tactical',
        confidence: 100,
        explanation: 'Always look for checks first — this one ends the game.'
      });
    } else if (result.mateIn !== null && result.mateIn > 0 && bestSan) {
      advice.push({
        id: `forced_mate_${now}`,
        type: 'tactic',
        title: `Forced Mate in ${result.mateIn}`,
        description: `There is a forced checkmate in ${result.mateIn}. It starts with ${bestSan}.`,
        priority: 'critical',
        move: bestSan,
        category: 'tactical',
        confidence: 95
      });
    } else if (bestMove && result.depth >= 6) {
      // Only point at captures and checks the engine actually recommends.
      const kind = bestMove.san.includes('+') ? 'check' : bestMove.flags.includes('c') ? 'capture' : null;
      if (kind) {
        advice.push({
          id: `best_${now}`,
          type: 'tactic',
          title: kind === 'check' ? 'Strong Checking Move' : 'Winning Capture',
          description: kind === 'check'
            ? `${bestMove.san} is the strongest move here — a forcing check.`
            : `Capturing with ${bestMove.san} on ${bestMove.to} is the best move.`,
          priority: 'high',
          move: bestMove.san,
          category: 'tactical',
          confidence: 85
        });
      }
    }

    if (isEndgame(game)) {
      advice.push({
        id: `endgame_${now}`,
        type: 'endgame',
        title: 'Endgame Technique',
        description: 'With the queens gone, activate your king and push passed pawns.',
        priority: 'medium',
        category: 'endgame',
        confidence: 90
      });
    }

    const sans = game.history();
    if (sans.length > 0 && sans.length < 12) {
      const openingInfo = detectOpening(sans);
      if (openingInfo) {
        advice.push({
          id: `opening_${now}`,
          type: 'opening',
          title: `Opening: ${openingInfo.name}`,
          description: `You are in the ${openingInfo.name}. ${openingInfo.variation || 'Main line.'}`,
          priority: 'medium',
          category: 'opening',
          confidence: 85
        });
      }
    }

    // Personalised: remind the player of the pattern they miss most often.
    const weak = weaknesses(memory, 1)[0];
    if (weak && advice.length < 3) {
      advice.push({
        id: `focus_${now}`,
        type: 'plan',
        title: `Your focus: ${themeLabel(weak)}`,
        description: `You've been missing ${themeLabel(weak)} lately. Scan this position for one before you move.`,
        priority: 'low',
        category: 'tactical',
        confidence: 70
      });
    }

    setCoachAdvice(advice);
    if (advice.length > 0 && advice[0].priority !== 'low') {
      say('advice', `${persona.name}: ${pick(persona.catchphrases)} ${advice[0].description}`, 'high');
    }
  }, [memory, persona, say]);

  const generateRef = useRef(generateCoachAdvice);
  generateRef.current = generateCoachAdvice;

  useEffect(() => {
    let cancelled = false;
    const fen = analysisGame.fen();
    if (analysisGame.isGameOver()) {
      setBestMoveSan(null);
      const mated = analysisGame.isCheckmate();
      setEvalMate(mated ? 0 : null);
      setEvalScore(mated ? (analysisGame.turn() === 'w' ? -100 : 100) : 0);
      return;
    }

    engine
      .search({ fen }, { depth: 16, timeMs: 2000 })
      .then(result => {
        if (cancelled) return;
        // mateIn counts from the side to move; the bar wants White's view.
        const whiteMate = result.mateIn === null ? null : analysisGame.turn() === 'w' ? result.mateIn : -result.mateIn;
        setEvalMate(whiteMate);
        setEvalScore(whiteMate !== null ? Math.sign(whiteMate) * 50 : result.scoreWhite / 100);
        setSearchDepth(result.depth);
        const san = uciToSan(fen, result.bestMove);
        setBestMoveSan(san);
        if (!currentExercise) generateRef.current(analysisGame, result, san);
      })
      .catch(() => {
        if (!cancelled) setBestMoveSan(null);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisGame]);

  const applyMove = (game: Chess, from: Square, to: Square): { next: Chess; move: Move } | null => {
    try {
      const next = new Chess(game.fen());
      const move = next.move({ from, to, promotion: 'q' });
      return move ? { next, move } : null;
    } catch {
      return null;
    }
  };

  const pushPosition = (next: Chess, san: string, baseFens = historyFens, baseSans = historySans, baseStep = currentStep) => {
    const newFens = [...baseFens.slice(0, baseStep + 1), next.fen()];
    const newSans = [...baseSans.slice(0, baseStep), san];
    setHistoryFens(newFens);
    setHistorySans(newSans);
    setCurrentStep(newFens.length - 1);
    setAnalysisGame(next);
    return { newFens, newSans };
  };

  const handleAnalysisMove = (from: Square, to: Square) => {
    const applied = applyMove(analysisGame, from, to);
    if (!applied) return;
    const { next, move } = applied;
    soundManager.playMove();

    // Learn from real play: compare the move with the engine's choice at a trustworthy depth.
    if (bestMoveSan && searchDepth >= 8) {
      const matched = move.san === bestMoveSan;
      setMemory(m => recordAnalysedMove(m, matched));
      if (!matched && !move.san.includes('#')) {
        say('warning', `${persona.name}: Playable, but the engine preferred ${bestMoveSan}.`, 'low', move.san);
      }
    }

    pushPosition(next, move.san);

    if (move.san.includes('#')) {
      say('celebration', `${persona.name}: Checkmate! ${persona.catchphrases[0]}`, 'high', move.san);
    } else if (move.san.includes('+')) {
      say('praise', `${persona.name}: Good check! Keep the pressure on.`, 'medium', move.san);
    } else if (move.flags.includes('c') && move.san === bestMoveSan) {
      say('praise', `${persona.name}: Good capture! ${pick(persona.catchphrases)}`, 'medium', move.san);
    }
  };

  const loadExercisePosition = (exercise: TrainingExercise) => {
    const g = new Chess(exercise.fen);
    setAnalysisGame(g);
    setHistoryFens([exercise.fen]);
    setHistorySans([]);
    setCurrentStep(0);
    setCurrentExerciseStep(0);
  };

  const startExercise = (exercise: TrainingExercise) => {
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    setCurrentExercise(exercise);
    setCoachAdvice([]);
    loadExercisePosition(exercise);
    exerciseStartRef.current = Date.now();
    exerciseMistakesRef.current = 0;
    const rec = memory.exercises[exercise.id];
    const note = rec?.solved ? ' A review — show me it stuck.' : '';
    say('exercise', `New exercise: ${exercise.title}. ${exercise.description}.${note}`, 'high');
  };

  const finishExercise = (exercise: TrainingExercise, solved: boolean) => {
    const timeMs = Date.now() - exerciseStartRef.current;
    const mistakes = exerciseMistakesRef.current;
    const updated = recordAttempt(memoryRef.current, exercise, { solved, mistakes, timeMs, at: Date.now() });
    setMemory(updated);
    setCurrentExercise(null);
    if (solved) {
      const clean = mistakes === 0 ? ' Flawless!' : ` (${mistakes} miss${mistakes === 1 ? '' : 'es'} on the way.)`;
      say('celebration', `Exercise completed in ${Math.max(1, Math.round(timeMs / 1000))}s.${clean} ${persona.name}: Outstanding work!`, 'high');
    }
    const next = recommendNext(TRAINING_EXERCISES, updated, rating, Date.now(), exercise.id);
    if (next) say('advice', `${persona.name}: Up next I'd suggest "${next.title}".`, 'medium');
    if (solved) {
      // Some finished lines are dead positions the board would announce as "Game over: draw";
      // hand back a fresh board for free analysis instead.
      replyTimerRef.current = setTimeout(() => {
        const fresh = new Chess();
        setAnalysisGame(fresh);
        setHistoryFens([fresh.fen()]);
        setHistorySans([]);
        setCurrentStep(0);
      }, 1800);
    }
  };

  const handleExerciseMove = (from: Square, to: Square) => {
    // Odd steps are the coach's reply, which is still being played.
    if (!currentExercise || currentExerciseStep % 2 === 1) return;
    const applied = applyMove(analysisGame, from, to);
    if (!applied) return;
    const { next, move } = applied;
    soundManager.playMove();

    const expected = currentExercise.solution[currentExerciseStep];
    // Any checkmate is accepted where the solution mates, even a different one.
    const correct = move.san === expected || (expected.endsWith('#') && next.isCheckmate());
    if (!correct) {
      exerciseMistakesRef.current += 1;
      say('warning', `${persona.name}: Not quite — ${move.san} isn't it. ${currentExercise.hint || 'Think about the key tactical idea.'}`, 'medium', move.san);
      return; // The board stays on the exercise position so the player can try again.
    }

    const { newFens, newSans } = pushPosition(next, move.san);
    const step = currentExerciseStep + 1;
    if (step >= currentExercise.solution.length) {
      finishExercise(currentExercise, true);
      return;
    }

    say('praise', `${persona.name}: Excellent! ${pick(persona.catchphrases)}`, 'medium', move.san);
    // The coach plays the opponent's reply, then it's the player's turn again.
    const reply = currentExercise.solution[step];
    const exercise = currentExercise;
    setCurrentExerciseStep(step);
    replyTimerRef.current = setTimeout(() => {
      const after = new Chess(next.fen());
      const replyMove = after.move(reply);
      soundManager.playMove();
      pushPosition(after, replyMove.san, newFens, newSans, newFens.length - 1);
      setCurrentExerciseStep(step + 1);
      if (step + 1 >= exercise.solution.length) finishExercise(exercise, true);
    }, 500);
  };

  const showSolution = () => {
    if (!currentExercise) return;
    const exercise = currentExercise;
    say('advice', `${persona.name}: The solution is ${exercise.solution.join(', ')}. We'll come back to this one soon.`, 'high');
    finishExercise(exercise, false);
    loadExercisePosition(exercise);
  };

  const restartExercise = () => {
    if (!currentExercise) return;
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    loadExercisePosition(currentExercise);
  };

  const startRecommended = () => {
    const next = recommendNext(TRAINING_EXERCISES, memory, rating, Date.now(), currentExercise?.id);
    if (next) startExercise(next);
  };

  const handleLoadFen = () => {
    try {
      const g = new Chess(fenInput.trim());
      setCurrentExercise(null);
      setAnalysisGame(g);
      setHistoryFens([g.fen()]);
      setHistorySans([]);
      setCurrentStep(0);
      setShowFenModal(false);
      setFenInput('');
    } catch {
      alert('Invalid FEN format.');
    }
  };

  const recommended = recommendNext(TRAINING_EXERCISES, memory, rating, Date.now(), currentExercise?.id);
  const visibleExercises = showAllExercises ? TRAINING_EXERCISES : TRAINING_EXERCISES.slice(0, 4);
  const remaining = TRAINING_EXERCISES.filter(e => !((memory.exercises[e.id]?.solved ?? 0) > 0)).length;

  return (
    <PanelContainer className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-5">
      <div className="flex items-stretch justify-center gap-2 sm:gap-3 w-full lg:flex-1 lg:max-w-[640px]">
        {settings.showEvalBar && (
          <div className="w-5 sm:w-8 shrink-0 flex glass-premium overflow-hidden !rounded-xl border-white/10">
            <EvalBar score={evalScore} isFlipped={isFlipped} mateIn={evalMate} />
          </div>
        )}
        <ChessBoard
          game={analysisGame}
          isFlipped={isFlipped}
          boardTheme={settings.boardTheme}
          pieceTheme={settings.pieceTheme}
          showCoordinates={settings.showCoordinates}
          highlightLastMove={settings.highlightLastMove}
          showLegalMoves={settings.showLegalMoves}
          lastMove={null}
          onMove={currentExercise ? handleExerciseMove : handleAnalysisMove}
          showTerritory={settings.showTerritory}
          showWeather={settings.showWeather}
        />
      </div>

      <div className="w-full lg:w-96 flex flex-col gap-3">
        <div className="glass-card p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                <BrainCircuit className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-black text-sm text-white font-ui uppercase tracking-wider truncate">
                  {persona.name}
                </div>
                <div className="text-[11px] text-white/60 font-mono truncate">
                  {persona.style} · {persona.focus.join(', ')}
                </div>
              </div>
            </div>
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              coachProfile.strength === 'master' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' :
              coachProfile.strength === 'expert' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40' :
              coachProfile.strength === 'advanced' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' :
              coachProfile.strength === 'intermediate' ? 'bg-green-500/20 text-green-400 border border-green-500/40' :
              'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
            }`}>
              {coachProfile.strength}
            </span>
          </div>

          {currentExercise && (
            <div className="glass-card p-3 border border-blue-500/30 bg-blue-500/5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-black text-white uppercase tracking-wider truncate">{currentExercise.title}</span>
                <span className="text-[11px] text-white/60 font-mono shrink-0">
                  move {Math.floor(currentExerciseStep / 2) + 1} / {Math.ceil(currentExercise.solution.length / 2)}
                </span>
              </div>
              <p className="text-xs text-white/75 leading-relaxed mb-2">{currentExercise.description}</p>
              <div className="flex gap-2">
                <button onClick={restartExercise} className="flex-1 py-2 rounded-lg bg-white/[0.06] hover:bg-white/10 border border-white/10 text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" /> Restart
                </button>
                <button onClick={showSolution} className="flex-1 py-2 rounded-lg bg-white/[0.06] hover:bg-white/10 border border-white/10 text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Solution
                </button>
              </div>
            </div>
          )}

          {showCoachChat && coachMessages.length > 0 && (
            <div className="glass-card p-3 max-h-64 overflow-y-auto space-y-2" aria-live="polite">
              {coachMessages.slice(0, 10).map(msg => (
                <div
                  key={msg.id}
                  className={`flex gap-2 p-2 rounded-xl transition-all ${
                    msg.priority === 'high' ? 'bg-blue-500/10 border border-blue-500/20' :
                    msg.priority === 'medium' ? 'bg-green-500/10 border border-green-500/20' :
                    'bg-white/[0.03] border border-white/5'
                  }`}
                >
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                    msg.type === 'celebration' ? 'bg-yellow-500/20 text-yellow-400' :
                    msg.type === 'praise' ? 'bg-green-500/20 text-green-400' :
                    msg.type === 'warning' ? 'bg-orange-500/20 text-orange-400' :
                    msg.type === 'exercise' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-purple-500/20 text-purple-400'
                  }`}>
                    {msg.type === 'celebration' && <Trophy className="w-3.5 h-3.5" />}
                    {msg.type === 'praise' && <Heart className="w-3.5 h-3.5" />}
                    {msg.type === 'warning' && <Zap className="w-3.5 h-3.5" />}
                    {msg.type === 'exercise' && <Target className="w-3.5 h-3.5" />}
                    {msg.type === 'advice' && <Lightbulb className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/90 leading-relaxed">{msg.content}</p>
                    <span className="text-[10px] text-white/40 font-mono">{msg.timestamp.toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {coachAdvice.length > 0 && (
            <div className="glass-card p-3 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Lightbulb className="w-4 h-4 text-yellow-400" />
                <span className="font-black text-xs text-white uppercase tracking-wider">Coach Insights</span>
              </div>
              {coachAdvice.slice(0, 3).map(advice => (
                <div
                  key={advice.id}
                  className={`p-2.5 rounded-xl border transition-all ${
                    advice.priority === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                    advice.priority === 'high' ? 'bg-orange-500/10 border-orange-500/30' :
                    advice.priority === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30' :
                    'bg-blue-500/10 border-blue-500/30'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                      advice.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                      advice.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                      advice.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {advice.priority === 'critical' && <Zap className="w-3 h-3" />}
                      {advice.priority === 'high' && <Target className="w-3 h-3" />}
                      {advice.priority === 'medium' && <Lightbulb className="w-3 h-3" />}
                      {advice.priority === 'low' && <MessageSquare className="w-3 h-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black text-white uppercase tracking-wider mb-0.5">{advice.title}</p>
                      <p className="text-xs text-white/75 leading-relaxed">{advice.description}</p>
                      {advice.move && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-white/10 text-[11px] font-mono font-black text-yellow-300">
                          {advice.move}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="glass-card p-3 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <span className="font-black text-xs text-white uppercase tracking-wider">Training</span>
              </div>
              <span className="text-[11px] text-white/50 font-mono">{remaining} of {TRAINING_EXERCISES.length} to solve</span>
            </div>
            <div className="space-y-1.5">
              {visibleExercises.map(ex => {
                const rec = memory.exercises[ex.id];
                const done = (rec?.solved ?? 0) > 0;
                const isNext = recommended?.id === ex.id;
                return (
                  <button
                    key={ex.id}
                    onClick={() => startExercise(ex)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                      currentExercise?.id === ex.id
                        ? 'bg-blue-500/15 border-blue-500/40 text-white'
                        : done
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                          : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10 text-white/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center ${
                          ex.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
                          ex.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          ex.difficulty === 'hard' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {ex.difficulty === 'easy' && <Sparkles className="w-3 h-3" />}
                          {ex.difficulty === 'medium' && <Target className="w-3 h-3" />}
                          {ex.difficulty === 'hard' && <Flame className="w-3 h-3" />}
                          {ex.difficulty === 'master' && <Award className="w-3 h-3" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-white truncate">{ex.title}</div>
                          <div className="text-[11px] text-white/55 truncate">
                            {themeLabel(ex.theme)} · {ex.difficulty}
                            {rec?.bestTimeMs ? ` · best ${Math.max(1, Math.round(rec.bestTimeMs / 1000))}s` : ''}
                          </div>
                        </div>
                      </div>
                      {isNext && !currentExercise && <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-black">Next</span>}
                      {done && !isNext && <CheckCircle2 className="shrink-0 w-4 h-4 text-emerald-400" aria-label="Solved" />}
                    </div>
                  </button>
                );
              })}
              <button
                onClick={() => setShowAllExercises(v => !v)}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-black text-[11px] uppercase tracking-wider transition-all hover:brightness-110 active:scale-[0.98] shadow-lg shadow-blue-500/20 flex items-center justify-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{showAllExercises ? 'Show Fewer' : `All Exercises (${TRAINING_EXERCISES.length})`}</span>
              </button>
            </div>
          </div>

          <div className="glass-card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-black text-xs text-white uppercase tracking-wider">Progress</span>
              <span className="text-[11px] text-white/50 font-mono">
                {coachProfile.sessions} session{coachProfile.sessions === 1 ? '' : 's'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                <div className="text-lg font-black text-white">{coachProfile.rating}</div>
                <div className="text-[10px] text-white/55 font-mono uppercase tracking-wider">Rating</div>
              </div>
              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                <div className="text-lg font-black text-emerald-400">{coachProfile.solved}</div>
                <div className="text-[10px] text-white/55 font-mono uppercase tracking-wider">Solved</div>
              </div>
              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5 text-center" title="Change in success rate: your last 10 exercises compared with the 10 before">
                <div className="text-lg font-black text-amber-400">
                  {coachProfile.improvementRate === null ? '—' : `${coachProfile.improvementRate > 0 ? '+' : ''}${coachProfile.improvementRate}%`}
                </div>
                <div className="text-[10px] text-white/55 font-mono uppercase tracking-wider">Trend</div>
              </div>
              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5 text-center" title="How often your analysis moves match the engine's first choice">
                <div className="text-lg font-black text-sky-400">{coachProfile.engineMatch === null ? '—' : `${coachProfile.engineMatch}%`}</div>
                <div className="text-[10px] text-white/55 font-mono uppercase tracking-wider">Accuracy</div>
              </div>
            </div>
            {(coachProfile.weaknesses.length > 0 || coachProfile.strengths.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {coachProfile.weaknesses.map(w => (
                  <span key={`w_${w}`} className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-500/15 text-orange-300 border border-orange-500/30">Work on {themeLabel(w)}</span>
                ))}
                {coachProfile.strengths.map(s => (
                  <span key={`s_${s}`} className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Strong at {themeLabel(s)}</span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={startRecommended}
              disabled={!recommended}
              className="flex-1 min-w-0 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-black font-black text-[11px] uppercase tracking-wider transition-all hover:brightness-110 active:scale-[0.98] shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Target className="w-3.5 h-3.5" />
              <span className="truncate">{recommended ? `Train: ${recommended.title}` : 'Start Training'}</span>
            </button>
            <button
              onClick={() => setShowCoachChat(!showCoachChat)}
              aria-label={showCoachChat ? 'Hide coach messages' : 'Show coach messages'}
              className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowFenModal(v => !v)}
              aria-label="Load a position from FEN"
              className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
            </button>
          </div>

          {showFenModal && (
            <div className="glass-card p-3 space-y-2">
              <label htmlFor="coach-fen" className="text-[11px] font-black text-white/70 uppercase tracking-wider">Analyse a position (FEN)</label>
              <input
                id="coach-fen"
                value={fenInput}
                onChange={e => setFenInput(e.target.value)}
                placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-white text-xs font-mono focus:outline-none focus:border-emerald-500/50"
              />
              <button onClick={handleLoadFen} className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black uppercase tracking-wider">
                Load Position
              </button>
            </div>
          )}
        </div>
      </div>
    </PanelContainer>
  );
};

export type { CoachAdvice, TrainingExercise, CoachProfile, CoachMessage };
