import React from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Eye, History, Play, Target, X } from 'lucide-react';
import { CoachCharacter } from '../../coach/characters';
import { LoggedMistake } from '../../coach/mistakeLog';
import { TrainingExercise } from '../../data/coachExercises';

/** A position where the player went wrong, either from the game just reviewed or an earlier one. */
export interface RetryTask {
  key: string;
  fenBefore: string;
  playedSan: string;
  bestSan: string | null;
  bestLineSan: string[];
  explanation: string;
  label: string;
  motif: LoggedMistake['motif'];
  severity: LoggedMistake['severity'];
  moveLabel: string;
  backRank?: boolean;
  /** Set for mistakes from earlier games. */
  fromEarlierGame?: { opponent: string; date: number };
}

export type RetryStep = 'try' | 'checking' | 'solved' | 'revealed';

export type ReviewView =
  | { phase: 'analysing'; done: number; total: number }
  | {
      phase: 'ready';
      tasks: RetryTask[];
      index: number;
      /** An earlier mistake being retried instead of tasks[index]. */
      earlier: RetryTask | null;
      step: RetryStep;
      similar: LoggedMistake[];
      practice: TrainingExercise[];
    };

const SEVERITY_STYLE: Record<RetryTask['severity'], string> = {
  blunder: 'bg-red-500/20 text-red-300 border-red-500/40',
  mistake: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  inaccuracy: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
};
const SEVERITY_MARK: Record<RetryTask['severity'], string> = { blunder: '??', mistake: '?', inaccuracy: '?!' };

interface ReviewPanelProps {
  coach: CoachCharacter;
  view: ReviewView;
  onSelect: (index: number) => void;
  onReveal: () => void;
  onRetryEarlier: (m: LoggedMistake) => void;
  onBackToGame: () => void;
  onPractice: (ex: TrainingExercise) => void;
  onReplayLine: () => void;
  onClose: () => void;
}

export const ReviewPanel: React.FC<ReviewPanelProps> = ({ coach, view, onSelect, onReveal, onRetryEarlier, onBackToGame, onPractice, onReplayLine, onClose }) => {
  if (view.phase === 'analysing') {
    const pct = view.total ? Math.round((view.done / view.total) * 100) : 0;
    return (
      <div className="glass-card p-3 space-y-2" aria-busy="true">
        <div className="flex items-center justify-between">
          <span className="font-black text-xs text-white uppercase tracking-wider">Reviewing your game</span>
          <span className="text-[11px] text-white/60 font-mono">{view.done} / {view.total} moves</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full transition-all" style={{ width: `${pct}%`, background: coach.accent }} />
        </div>
        <button type="button" onClick={onClose} className="text-[11px] text-white/50 hover:text-white">Cancel</button>
      </div>
    );
  }

  const { tasks, index, earlier, step, similar, practice } = view;
  const task = earlier ?? tasks[index];
  const done = step === 'solved' || step === 'revealed';

  return (
    <div className="glass-card p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-black text-xs text-white uppercase tracking-wider">Game review</span>
        <button type="button" onClick={onClose} aria-label="Close the review" className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {tasks.length === 0 && !earlier ? (
        <p className="text-xs text-white/75">No mistakes or blunders in this game. Try a stronger opponent!</p>
      ) : (
        <>
          {/* The game's mistakes as move chips. */}
          {tasks.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tasks.map((t, i) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onSelect(i)}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-mono font-black ${SEVERITY_STYLE[t.severity]} ${!earlier && i === index ? 'ring-2 ring-white/60' : 'opacity-80 hover:opacity-100'}`}
                >
                  {t.moveLabel} {t.playedSan}{SEVERITY_MARK[t.severity]}
                </button>
              ))}
            </div>
          )}

          {task && (
            <div className="p-3 rounded-xl border border-white/10 bg-white/[0.03] space-y-2">
              {earlier && (
                <div className="flex items-center gap-1.5 text-[11px] text-white/60">
                  <History className="w-3.5 h-3.5" />
                  From your game vs {earlier.fromEarlierGame?.opponent} · {new Date(earlier.fromEarlierGame?.date ?? 0).toLocaleDateString()}
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-white">
                  {task.moveLabel} {task.playedSan}{SEVERITY_MARK[task.severity]}
                </span>
                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider ${SEVERITY_STYLE[task.severity]}`}>{task.label}</span>
              </div>
              {step === 'try' && <p className="text-xs text-white/80">Find a better move than {task.playedSan} on the board.</p>}
              {step === 'checking' && <p className="text-xs text-white/60">Checking your move…</p>}
              {done && (
                <>
                  <p className="text-xs text-white/85 leading-relaxed">{task.explanation}</p>
                  {task.bestLineSan.length > 0 && (
                    <p className="text-[11px] font-mono text-white/70">
                      Best line: <span className="text-yellow-300 font-black">{task.bestLineSan.join(' ')}</span>
                    </p>
                  )}
                  <p className="text-[11px] text-white/60 italic">{coach.lines.motifTip[task.motif]}</p>
                </>
              )}
              <div className="flex gap-2">
                {step === 'try' && (
                  <button type="button" onClick={onReveal} className="flex-1 py-2 rounded-lg bg-white/[0.06] hover:bg-white/10 border border-white/10 text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> Show me
                  </button>
                )}
                {done && task.bestLineSan.length > 0 && (
                  <button type="button" onClick={onReplayLine} className="flex-1 py-2 rounded-lg bg-white/[0.06] hover:bg-white/10 border border-white/10 text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5">
                    <Play className="w-3.5 h-3.5" /> Play the line
                  </button>
                )}
                {earlier ? (
                  <button type="button" onClick={onBackToGame} className="flex-1 py-2 rounded-lg bg-white/[0.06] hover:bg-white/10 border border-white/10 text-[11px] font-black uppercase tracking-wider">
                    Back to this game
                  </button>
                ) : (
                  <>
                    <button type="button" disabled={index === 0} onClick={() => onSelect(index - 1)} aria-label="Previous mistake" className="px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/10 border border-white/10 disabled:opacity-40">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" disabled={index >= tasks.length - 1} onClick={() => onSelect(index + 1)} aria-label="Next mistake" className="px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/10 border border-white/10 disabled:opacity-40">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Similar mistakes from earlier games, and practice positions with the same pattern. */}
          {task && done && (similar.length > 0 || practice.length > 0) && (
            <div className="space-y-2">
              {similar.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-black text-white/70 uppercase tracking-wider">{coach.lines.similarFound(similar.length)}</div>
                  {similar.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onRetryEarlier(m)}
                      className="w-full text-left p-2 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] flex items-center justify-between gap-2"
                    >
                      <span className="text-[11px] text-white/80 truncate">
                        <History className="w-3 h-3 inline mr-1" />
                        {m.moveLabel} {m.playedSan} vs {m.opponent}
                      </span>
                      <span className="shrink-0 text-[10px] font-black uppercase text-white/60">Retry</span>
                    </button>
                  ))}
                </div>
              )}
              {practice.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-black text-white/70 uppercase tracking-wider">{coach.lines.practice}</div>
                  {practice.map(ex => (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => onPractice(ex)}
                      className="w-full text-left p-2 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] flex items-center justify-between gap-2"
                    >
                      <span className="text-[11px] text-white/80 truncate">
                        <Target className="w-3 h-3 inline mr-1" />
                        {ex.title}
                      </span>
                      <span className="shrink-0 text-[10px] font-black uppercase text-white/60">{ex.difficulty}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {task && step === 'solved' && (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 font-black">
              <CheckCircle2 className="w-3.5 h-3.5" /> Found it
            </div>
          )}
        </>
      )}
    </div>
  );
};
