import React, { Suspense, useEffect, useRef, useState } from 'react';
import { COACHES, CoachCharacter, CoachId } from '../../coach/characters';
import type { AvatarMood } from './CoachAvatar3D';

const CoachAvatar3D = React.lazy(() => import('./CoachAvatar3D'));

export type CoachSpeechType = 'advice' | 'exercise' | 'praise' | 'warning' | 'celebration';

export const moodFor = (type: CoachSpeechType | undefined): AvatarMood =>
  type === 'praise' ? 'happy'
    : type === 'celebration' ? 'celebrate'
      : type === 'warning' ? 'concerned'
        : type === 'exercise' ? 'pointing'
          : 'explaining';

/** Reading time for a line: the mouth moves for about as long as the text takes to say. */
const speakingMs = (text: string) => Math.min(9000, 600 + text.length * 45);

const hasWebGL = () => {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
};

class AvatarBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface CoachStageProps {
  coach: CoachCharacter;
  onChangeCoach: (id: CoachId) => void;
  /** Latest line the coach says; a new id restarts the speech and gesture. */
  speech: { id: string; type: CoachSpeechType; text: string } | null;
  onPoke: () => void;
  badge?: React.ReactNode;
}

export const CoachStage: React.FC<CoachStageProps> = ({ coach, onChangeCoach, speech, onPoke, badge }) => {
  const [speaking, setSpeaking] = useState(false);
  const [gestureKey, setGestureKey] = useState(0);
  const [use3d] = useState(hasWebGL);
  const [failed3d, setFailed3d] = useState(false);
  const [showBio, setShowBio] = useState(false);

  useEffect(() => {
    if (!speech) return;
    setGestureKey(k => k + 1);
    setSpeaking(true);
    const timer = setTimeout(() => setSpeaking(false), speakingMs(speech.text));
    return () => clearTimeout(timer);
  }, [speech?.id]);

  const fallback = (
    <button
      type="button"
      onClick={onPoke}
      aria-label={`${coach.name}, your coach`}
      className="w-full h-full rounded-full flex items-center justify-center text-6xl"
      style={{ background: `radial-gradient(circle at 50% 35%, ${coach.accent}55, transparent 70%)` }}
    >
      {coach.emoji}
    </button>
  );

  // The 3D stage fills the panel's width; the canvas is rebuilt only when that width changes.
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(0);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStageWidth(Math.round(el.clientWidth / 8) * 8);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const stageHeight = 200;

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-black text-sm text-white font-ui uppercase tracking-wider leading-tight">{coach.name}</div>
          <button type="button" onClick={() => setShowBio(v => !v)} className="text-[11px] text-white/60 text-left hover:text-white/80 underline-offset-2 hover:underline">
            {coach.tagline}
          </button>
        </div>
        {badge}
      </div>
      <div
        ref={stageRef}
        className="relative w-full rounded-2xl overflow-hidden border border-white/10"
        style={{ height: stageHeight, background: `radial-gradient(circle at 55% 35%, ${coach.accent}40, rgba(0,0,0,0.18) 75%)` }}
        title="Click me for a tip"
      >
        {stageWidth > 0 && (use3d && !failed3d ? (
          <AvatarBoundary fallback={fallback}>
            <Suspense fallback={fallback}>
              <CoachAvatar3D
                coach={coach}
                mood={moodFor(speech?.type)}
                speaking={speaking}
                gestureKey={gestureKey}
                width={stageWidth}
                height={stageHeight}
                onPoke={onPoke}
                onUnsupported={() => setFailed3d(true)}
              />
            </Suspense>
          </AvatarBoundary>
        ) : fallback)}
      </div>
      <div
        className="relative rounded-2xl p-3 text-xs leading-relaxed text-white/90 border min-h-[60px] max-h-[150px] overflow-y-auto"
        style={{ borderColor: `${coach.accent}66`, background: `${coach.accent}14` }}
        aria-live="polite"
      >
        <span
          aria-hidden="true"
          className="absolute -top-2 left-8 w-4 h-4 rotate-45 border-l border-t"
          style={{ borderColor: `${coach.accent}66`, background: 'inherit' }}
        />
        {speech?.text ?? coach.lines.greeting[0]}
      </div>
      {showBio && (
        <p className="text-[11px] leading-relaxed text-white/70 p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
          {coach.bio} <span className="text-white/50">Specialty: {coach.specialty}.</span>
        </p>
      )}
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Choose your coach">
        {COACHES.map(c => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={c.id === coach.id}
            onClick={() => onChangeCoach(c.id)}
            className={`px-2 py-1.5 rounded-xl border text-[11px] font-black truncate transition-all ${
              c.id === coach.id ? 'text-white' : 'border-white/10 bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.06]'
            }`}
            style={c.id === coach.id ? { borderColor: c.accent, background: `${c.accent}22` } : undefined}
            title={c.specialty}
          >
            <span className="mr-1">{c.emoji}</span>
            {c.shortName}
          </button>
        ))}
      </div>
    </div>
  );
};
