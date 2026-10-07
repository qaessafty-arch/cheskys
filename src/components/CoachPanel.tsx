import React, { useState, useEffect, useCallback } from 'react';
import { Chess, Square, Move } from 'chess.js';
import { PanelContainer } from './PanelContainer';
import { ChessBoard } from './ChessBoard';
import { EvalBar } from './EvalBar';
import { MoveHistory } from './MoveHistory';
import { engine } from '../engine/client';
import { detectOpening } from '../utils/openings';
import { soundManager } from '../utils/audio';
import { StrategicVisionPanel } from './StrategicVisionPanel';
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
  ClipboardPaste
} from 'lucide-react';
import { AppSettings, OpeningInfo } from '../types/chess';
import { useTranslation } from 'react-i18next';

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

interface TrainingExercise {
  id: string;
  title: string;
  description: string;
  fen: string;
  solution: string[];
  difficulty: 'easy' | 'medium' | 'hard' | 'master';
  theme: string;
  hint?: string;
  completed?: boolean;
  attempts?: number;
  bestTime?: number;
}

interface CoachProfile {
  rating: number;
  strength: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master';
  weaknesses: string[];
  strengths: string[];
  preferredOpenings: string[];
  preferredTimeControl: string;
  gamesAnalyzed: number;
  improvementRate: number;
  lastSession: string;
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
    focus: ['basics', 'tactics', 'piece_safety'],
    catchphrases: [
      "Every master was once a beginner!",
      "Great job spotting that!",
      "Let's work on piece safety first."
    ]
  },
  intermediate: {
    name: 'Coach Maya',
    style: 'analytical',
    focus: ['positional_understanding', 'planning', 'calculation'],
    catchphrases: [
      "Good calculation!",
      "What's your plan here?",
      "Let's look at the pawn structure."
    ]
  },
  advanced: {
    name: 'Coach Viktor',
    style: 'deep',
    focus: ['prophylaxis', 'transitions', 'endgame_technique'],
    catchphrases: [
      "Interesting choice. What's your plan?",
      "Have you considered the prophylactic move?",
      "The endgame starts now."
    ]
  },
  master: {
    name: 'Grandmaster Aria',
    style: 'masterful',
    focus: ['prophylaxis', 'deep_strategy', 'psychology', 'endgame_mastery'],
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

const TRAINING_EXERCISES: TrainingExercise[] = [
  {
    id: 'fork_1',
    title: 'Knight Fork Basics',
    description: 'Find the knight fork that wins material',
    fen: 'r1bqkb1r/pppp1ppp/2n2n1p/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4',
    solution: ['Nxe5', 'dxe5', 'Qh5'],
    difficulty: 'easy',
    theme: 'tactics_fork',
    hint: 'Look for a knight move that attacks two pieces at once'
  },
  {
    id: 'pin_1',
    title: 'Absolute Pin',
    description: 'Use the pin to win the pinned piece',
    fen: 'r1bqk2r/pppp1ppp/2n2n2/4p1B1/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 5 5',
    solution: ['Bxf6', 'gxf6', 'Nxd5'],
    difficulty: 'easy',
    theme: 'tactics_pin',
    hint: 'The pinned piece cannot move without exposing the king'
  },
  {
    id: 'skewer_1',
    title: 'Skewer Attack',
    description: 'Force the valuable piece to move and capture the one behind',
    fen: '8/8/8/3k4/8/3R4/3K4/8 w - - 0 1',
    solution: ['Rd8+', 'Kc7', 'Rxa8'],
    difficulty: 'medium',
    theme: 'tactics_skewer',
    hint: 'Attack the king and the piece behind it on the same line'
  },
  {
    id: 'mate_1',
    title: 'Back Rank Mate',
    description: 'Deliver checkmate on the back rank',
    fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
    solution: ['Rd8#'],
    difficulty: 'easy',
    theme: 'checkmate',
    hint: 'The king has no escape squares on the back rank'
  },
  {
    id: 'mate_2',
    title: 'Smothered Mate',
    description: 'Knight delivers mate surrounded by own pieces',
    fen: '6rk/6pp/8/6N1/8/8/8/6QK w - - 0 1',
    solution: ['Nf7#'],
    difficulty: 'medium',
    theme: 'checkmate',
    hint: 'The knight can jump to a square where the king is surrounded by its own pieces'
  },
  {
    id: 'endgame_1',
    title: 'King and Pawn vs King',
    description: 'Promote the pawn with correct technique',
    fen: '8/8/8/8/8/4k3/4P3/4K3 w - - 0 1',
    solution: ['Ke2', 'Ke7', 'Ke3', 'Ke6', 'Ke4', 'Ke5', 'Ke5', 'Ke6', 'Kd5', 'Kd7', 'Ke5', 'Ke7', 'Kd6', 'Kd8', 'c8=Q#'],
    difficulty: 'medium',
    theme: 'endgame',
    hint: 'Use opposition to push the enemy king back'
  },
  {
    id: 'opening_1',
    title: 'Italian Game Main Line',
    description: 'Play the main line of the Italian Game',
    fen: 'rnbqkb1r/pppp1ppp/5n2/4p2N/3p4/8/PPPP1PPP/RNBQKB1R w KQkq - 2 4',
    solution: ['Nc3', 'Nf6', 'd4', 'exd4', 'Nxd4', 'Bb4', 'c3', 'Nxd4', 'Qxd4'],
    difficulty: 'medium',
    theme: 'opening_italian',
    hint: 'Develop pieces and control the center'
  },
  {
    id: 'prophylaxis_1',
    title: 'Prophylactic Thinking',
    description: "Prevent opponent's plan before executing your own",
    fen: 'r1bq1rk1/ppp2ppp/2np1n1p/4p3/2PP4/2N1PN2/PP2BPPP/R1BQ1RK1 w - - 0 9',
    solution: ['a3', 'Bg4', 'h3', 'Bh5'],
    difficulty: 'hard',
    theme: 'prophylaxis',
    hint: "Prevent the bishop from pinning your knight"
  }
];

export const CoachPanel: React.FC<CoachPanelProps> = ({
  settings,
  onUpdateSettings,
  initialFen,
  initialPgn
}) => {
  const { t } = useTranslation();
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
  const [isFlipped, setIsFlipped] = useState(false);
  const [evalScore, setEvalScore] = useState<number>(0);
  const [bestMoveSan, setBestMoveSan] = useState<string | null>(null);
  const [searchDepth, setSearchDepth] = useState(0);
  const [mateIn, setMateIn] = useState<number | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [fenInput, setFenInput] = useState('');
  const [showFenModal, setShowFenModal] = useState(false);
  const [coachAdvice, setCoachAdvice] = useState<CoachAdvice[]>([]);
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [currentExercise, setCurrentExercise] = useState<TrainingExercise | null>(null);
  const [currentExerciseStep, setCurrentExerciseStep] = useState(0);
  const [coachProfile] = useState<CoachProfile>({
    rating: 1200,
    strength: 'beginner',
    weaknesses: [],
    strengths: [],
    preferredOpenings: [],
    preferredTimeControl: 'rapid',
    gamesAnalyzed: 0,
    improvementRate: 0,
    lastSession: new Date().toISOString()
  });
  const [showCoachChat, setShowCoachChat] = useState(true);

  const persona = getCoachPersona(coachProfile.rating);

  useEffect(() => {
    let cancelled = false;
    const fen = analysisGame.fen();
    setIsThinking(true);

    engine
      .search({ fen }, { depth: 16, timeMs: 2000 })
      .then(result => {
        if (cancelled) return;
        setEvalScore(result.mateIn !== null ? (result.mateIn > 0 ? 1000 : -1000) : result.scoreWhite / 100);
        setSearchDepth(result.depth);
        setMateIn(result.mateIn);
        if (!result.bestMove) {
          setBestMoveSan(null);
          return;
        }
        try {
          const probe = new Chess(fen);
          const applied = probe.move({
            from: result.bestMove.slice(0, 2) as Square,
            to: result.bestMove.slice(2, 4) as Square,
            promotion: (result.bestMove[4] as 'q' | 'r' | 'b' | 'n' | undefined) ?? 'q'
          });
          setBestMoveSan(applied ? applied.san : null);
        } catch {
          setBestMoveSan(null);
        }

        generateCoachAdvice(fen, result, analysisGame);
      })
      .catch(() => {
        if (!cancelled) setBestMoveSan(null);
      })
      .finally(() => {
        if (!cancelled) setIsThinking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [analysisGame]);

  const generateCoachAdvice = useCallback((fen: string, result: any, game: Chess) => {
    const advice: CoachAdvice[] = [];
    const evalScore = result.mateIn !== null ? (result.mateIn > 0 ? 1000 : -1000) : result.scoreWhite / 100;

    const moves = game.moves({ verbose: true });
    const captures = moves.filter(m => m.flags.includes('c'));
    const checksMoves = moves.filter(m => m.san.includes('+'));
    const mateMoves = moves.filter(m => m.san.includes('#'));

    if (mateMoves.length > 0) {
      advice.push({
        id: `mate_${Date.now()}`,
        type: 'tactic',
        title: 'Checkmate Available!',
        description: `You have a forced checkmate in ${mateMoves.length} move(s)!`,
        priority: 'critical',
        move: mateMoves[0].san,
        category: 'tactical',
        confidence: 100,
        explanation: 'You have a forced checkmate. Calculate carefully and deliver the final blow!'
      });
    }

    if (checksMoves.length > 0 && evalScore > 100) {
      advice.push({
        id: `check_${Date.now()}`,
        type: 'tactic',
        title: 'Strong Checking Move',
        description: `A checking move improves your position significantly.`,
        priority: 'high',
        move: checksMoves[0].san,
        category: 'tactical',
        confidence: 85,
        explanation: 'Checks that improve your position are often the most forcing moves.'
      });
    }

    if (captures.length > 0) {
      advice.push({
        id: `capture_${Date.now()}`,
        type: 'tactic',
        title: 'Capture Opportunity',
        description: `Consider capturing on ${captures[0].to}.`,
        priority: 'high',
        move: captures[0].san,
        category: 'tactical',
        confidence: 80,
        explanation: 'Capturing material is usually good, but verify it does not lead to a trap.'
      });
    }

    if (!fen.split(' ')[0].includes('K')) {
      advice.push({
        id: `endgame_${Date.now()}`,
        type: 'endgame',
        title: 'Endgame Technique',
        description: 'Activate your king and push passed pawns.',
        priority: 'medium',
        category: 'endgame',
        confidence: 90,
        explanation: 'In the endgame, the king becomes a powerful piece. Activate it!'
      });
    }

    if (historySans.length < 10) {
      const openingInfo = detectOpening(historySans);
      if (openingInfo) {
        advice.push({
          id: `opening_${Date.now()}`,
          type: 'opening',
          title: `Opening: ${openingInfo.name}`,
          description: `You are in the ${openingInfo.name}. ${openingInfo.variation || 'Main line.'}`,
          priority: 'medium',
          category: 'opening',
          confidence: 85,
          explanation: `The ${openingInfo.name} (ECO ${openingInfo.eco}) is a solid choice.`
        });
      }
    }

    const persona = getCoachPersona(1200);
    const randomCatchphrase = persona.catchphrases[Math.floor(Math.random() * persona.catchphrases.length)];

    const messages: CoachMessage[] = [];
    if (advice.length > 0) {
      messages.push({
        id: `advice_${Date.now()}`,
        type: 'advice',
        content: `${persona.name}: ${randomCatchphrase} ${advice[0].description}`,
        timestamp: new Date(),
        priority: 'high'
      });
    }

    setCoachAdvice(prev => [...advice, ...prev.slice(0, 9)]);
    setCoachMessages(prev => [...messages, ...prev.slice(0, 19)]);
  }, [historySans]);

  const handleAnalysisMove = (from: Square, to: Square) => {
    try {
      const newGame = new Chess(analysisGame.fen());
      const move = newGame.move({ from, to, promotion: 'q' });
      if (!move) return;

      soundManager.playMove();

      const newFens = historyFens.slice(0, currentStep + 1);
      newFens.push(newGame.fen());

      const newSans = historySans.slice(0, currentStep);
      newSans.push(move.san);

      setHistoryFens(newFens);
      setHistorySans(newSans);
      setCurrentStep(newFens.length - 1);
      setAnalysisGame(newGame);

      provideMoveFeedback(move);
    } catch {
      // Illegal
    }
  };

  const provideMoveFeedback = (move: Move) => {
    const persona = getCoachPersona(1200);
    const messages: CoachMessage[] = [];

    if (move.san.includes('#')) {
      messages.push({
        id: `praise_${Date.now()}`,
        type: 'celebration',
        content: `${persona.name}: Checkmate! ${persona.catchphrases[0]}`,
        timestamp: new Date(),
        relatedMove: move.san,
        priority: 'high'
      });
    } else if (move.san.includes('+')) {
      messages.push({
        id: `praise_${Date.now()}`,
        type: 'praise',
        content: `${persona.name}: Good check! Keep the pressure on.`,
        timestamp: new Date(),
        relatedMove: move.san,
        priority: 'medium'
      });
    } else if (move.flags.includes('c')) {
      messages.push({
        id: `praise_${Date.now()}`,
        type: 'praise',
        content: `${persona.name}: Good capture! ${persona.catchphrases[Math.floor(Math.random() * persona.catchphrases.length)]}`,
        timestamp: new Date(),
        relatedMove: move.san,
        priority: 'medium'
      });
    }

    setCoachMessages(prev => [...messages, ...prev.slice(0, 19)]);
  };

  const jumpToStep = (step: number) => {
    if (step < 0 || step >= historyFens.length) return;
    const targetFen = historyFens[step];
    const g = new Chess(targetFen);
    setAnalysisGame(g);
    setCurrentStep(step);
  };

  const startExercise = (exercise: TrainingExercise) => {
    setCurrentExercise(exercise);
    setCurrentExerciseStep(0);
    const g = new Chess(exercise.fen);
    setAnalysisGame(g);
    setHistoryFens([exercise.fen]);
    setHistorySans([]);
    setCurrentStep(0);

    setCoachMessages(prev => [{
      id: `exercise_${Date.now()}`,
      type: 'exercise',
      content: `New exercise: ${exercise.title}. ${exercise.description}`,
      timestamp: new Date(),
      priority: 'high'
    }, ...prev.slice(0, 9)]);
  };

  const handleExerciseMove = (from: Square, to: Square) => {
    if (!currentExercise) return;

    try {
      const newGame = new Chess(analysisGame.fen());
      const move = newGame.move({ from, to, promotion: 'q' });
      if (!move) return;

      soundManager.playMove();

      const newFens = historyFens.slice(0, currentStep + 1);
      newFens.push(newGame.fen());

      const newSans = historySans.slice(0, currentStep);
      newSans.push(move.san);

      setHistoryFens(newFens);
      setHistorySans(newSans);
      setCurrentStep(newFens.length - 1);
      setAnalysisGame(newGame);

      const expectedMove = currentExercise.solution[currentExerciseStep];
      if (move.san === expectedMove) {
        setCurrentExerciseStep(prev => prev + 1);

        const persona = getCoachPersona(1200);
        setCoachMessages(prev => [{
          id: `exercise_${Date.now()}`,
          type: 'praise',
          content: `${persona.name}: Excellent! ${persona.catchphrases[Math.floor(Math.random() * persona.catchphrases.length)]}`,
          timestamp: new Date(),
          priority: 'high'
        }, ...prev.slice(0, 9)]);

        if (currentExerciseStep + 1 >= currentExercise.solution.length) {
          setCurrentExercise(null);
          setCoachMessages(prev => [{
            id: `complete_${Date.now()}`,
            type: 'celebration',
            content: `Exercise completed! ${getCoachPersona(1200).name}: Outstanding work! You've mastered this pattern.`,
            timestamp: new Date(),
            priority: 'high'
          }, ...prev.slice(0, 9)]);
        }
      } else {
        const persona = getCoachPersona(1200);
        setCoachMessages(prev => [{
          id: `hint_${Date.now()}`,
          type: 'warning',
          content: `${persona.name}: Not quite. ${currentExercise.hint || 'Think about the key tactical idea.'}`,
          timestamp: new Date(),
          priority: 'medium'
        }, ...prev.slice(0, 9)]);
      }
    } catch {
      // Illegal move
    }
  };

  const startNextExercise = () => {
    const nextIdx = TRAINING_EXERCISES.findIndex(e => e.id === currentExercise?.id) + 1;
    if (nextIdx < TRAINING_EXERCISES.length) {
      startExercise(TRAINING_EXERCISES[nextIdx]);
    }
  };

  const handleLoadFen = () => {
    try {
      const g = new Chess(fenInput.trim());
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

  const openingInfo: OpeningInfo | null = detectOpening(historySans);

  return (
    <PanelContainer className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-5">
      <div className="flex items-stretch justify-center gap-2 sm:gap-3 w-full lg:flex-1 lg:max-w-[640px]">
        {settings.showEvalBar && (
          <EvalBar score={evalScore} isFlipped={isFlipped} />
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
        <div className="glass-card p-4 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                <BrainCircuit className="w-4 h-4" />
              </div>
              <div>
                <div className="font-black text-xs text-white font-ui uppercase tracking-wider">
                  {persona.name}
                </div>
                <div className="text-[10px] text-white/50 font-mono uppercase tracking-widest">
                  {persona.style} | {persona.focus.join(', ')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                coachProfile.strength === 'master' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' :
                coachProfile.strength === 'expert' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40' :
                coachProfile.strength === 'advanced' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' :
                coachProfile.strength === 'intermediate' ? 'bg-green-500/20 text-green-400 border border-green-500/40' :
                'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}>
                {coachProfile.strength.toUpperCase()}
              </span>
            </div>
          </div>

          {showCoachChat && (
            <div className="glass-card p-3 max-h-64 overflow-y-auto space-y-2">
              {coachMessages.slice(0, 10).map(msg => (
                <div
                  key={msg.id}
                  className={`flex gap-2 p-2 rounded-xl transition-all ${
                    msg.priority === 'high' ? 'bg-blue-500/10 border border-blue-500/20' :
                    msg.priority === 'medium' ? 'bg-green-500/10 border border-green-500/20' :
                    'bg-white/[0.03] border border-white/5'
                  }`}
                >
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                    msg.type === 'celebration' ? 'bg-yellow-500/20 text-yellow-400' :
                    msg.type === 'praise' ? 'bg-green-500/20 text-green-400' :
                    msg.type === 'warning' ? 'bg-orange-500/20 text-orange-400' :
                    msg.type === 'exercise' ? 'bg-blue-500/20 text-blue-400' :
                    msg.type === 'advice' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-white/10 text-white/60'
                  }`}>
                    {msg.type === 'celebration' && <Trophy className="w-3.5 h-3.5" />}
                    {msg.type === 'praise' && <Heart className="w-3.5 h-3.5" />}
                    {msg.type === 'warning' && <Zap className="w-3.5 h-3.5" />}
                    {msg.type === 'exercise' && <Target className="w-3.5 h-3.5" />}
                    {msg.type === 'advice' && <Lightbulb className="w-3.5 h-3.5" />}
                    {msg.type === 'celebration' && <Award className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/90 leading-relaxed">{msg.content}</p>
                    <span className="text-[8px] text-white/30 font-mono">{msg.timestamp.toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {coachAdvice.length > 0 && (
            <div className="glass-card p-3 space-y-2">
              <div className="flex items-center gap-2 mb-2">
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
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
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
                      <p className="text-[10px] font-black text-white uppercase tracking-wider mb-0.5">{advice.title}</p>
                      <p className="text-[9px] text-white/70 leading-relaxed">{advice.description}</p>
                      {advice.move && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-mono font-black text-yellow-300">
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
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <span className="font-black text-xs text-white uppercase tracking-wider">Training</span>
              </div>
              <span className="text-[9px] text-white/40 font-mono">{TRAINING_EXERCISES.filter(e => !e.completed).length} remaining</span>
            </div>
            <div className="space-y-1.5">
              {TRAINING_EXERCISES.slice(0, 4).map(ex => (
                <button
                  key={ex.id}
                  onClick={() => startExercise(ex)}
                  className={`w-full text-left p-2.5 rounded-xl transition-all ${
                    ex.completed
                      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                      : 'bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 text-white/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
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
                      <div>
                        <div className="text-[10px] font-black text-white truncate">{ex.title}</div>
                        <div className="text-[8px] text-white/50 truncate">{ex.theme.replace('_', ' ')}</div>
                      </div>
                    </div>
                    {ex.completed && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-black">Done</span>}
                  </div>
                </button>
              ))}
              <button
                onClick={() => startExercise(TRAINING_EXERCISES[0])}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-black text-[10px] uppercase tracking-wider transition-all hover:brightness-110 active:scale-[0.98] shadow-lg shadow-blue-500/20 flex items-center justify-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>All Exercises</span>
              </button>
            </div>
          </div>

          <div className="glass-card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-black text-xs text-white uppercase tracking-wider">Progress</span>
              <span className="text-[9px] text-white/40 font-mono">
                {coachProfile.gamesAnalyzed} games analyzed
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                <div className="text-lg font-black text-white">{coachProfile.rating}</div>
                <div className="text-[8px] text-white/50 font-mono uppercase tracking-wider">Rating</div>
              </div>
              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                <div className="text-lg font-black text-emerald-400">{coachProfile.gamesAnalyzed}</div>
                <div className="text-[8px] text-white/50 font-mono uppercase tracking-wider">Analyzed</div>
              </div>
              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                <div className="text-lg font-black text-amber-400">{coachProfile.improvementRate > 0 ? '+' : ''}{coachProfile.improvementRate.toFixed(1)}</div>
                <div className="text-[8px] text-white/50 font-mono uppercase tracking-wider">Improvement</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => startExercise(TRAINING_EXERCISES[0])}
              className="flex-1 min-w-0 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-black font-black text-[10px] uppercase tracking-wider transition-all hover:brightness-110 active:scale-[0.98] shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5"
            >
              <Target className="w-3.5 h-3.5" />
              <span>Start Training</span>
            </button>
            <button
              onClick={() => setShowCoachChat(!showCoachChat)}
              className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowFenModal(true)}
              className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </PanelContainer>
  );
};

export type { CoachAdvice, TrainingExercise, CoachProfile, CoachMessage };
