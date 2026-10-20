import React from 'react';

interface EvalBarProps {
  score: number; // in pawns (positive = White ahead, negative = Black ahead)
  isFlipped: boolean;
  /** Moves to mate from White's view (+ White mates, - Black mates, 0 = game already ended in mate). */
  mateIn?: number | null;
}

export const EvalBar: React.FC<EvalBarProps> = React.memo(({ score, isFlipped, mateIn = null }) => {
  // Legacy callers signal a mate with |score| > 900.
  const mate = mateIn ?? (Math.abs(score) > 900 ? Math.sign(score) : null);
  const whiteWinning = mate !== null ? (mate === 0 ? score > 0 : mate > 0) : score > 0;

  let whitePercentage: number;
  let label: string;
  if (mate !== null) {
    whitePercentage = whiteWinning ? 100 : 0;
    const distance = Math.abs(mate);
    label = `${whiteWinning ? '' : '-'}M${mateIn !== null && distance > 0 ? distance : ''}`;
  } else {
    // Sigmoid mapping centered at 0 with soft saturation: +5 is ~85% white, +10 is ~96%.
    const clampedScore = Math.max(-15, Math.min(15, score));
    whitePercentage = 50 + (2 / (1 + Math.exp(-clampedScore * 0.35)) - 1) * 50;
    label = Math.abs(score) < 0.05 ? '0.0' : score > 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
  }

  // The label sits in the winning side's segment; nothing is shown for a level position.
  const showLabel = mate !== null || Math.abs(score) > 0.1;

  const whiteSegment = (
    <div
      key="white"
      data-eval-side="white"
      className={`w-full bg-white/80 transition-all duration-700 ease-out flex justify-center ${isFlipped ? 'items-start pt-3' : 'items-end pb-3'}`}
      style={{ height: `${whitePercentage}%` }}
    >
      <span className="hidden md:block w-full text-center px-0.5 text-[10px] leading-none font-black text-black tracking-tighter uppercase">
        {showLabel && whiteWinning ? label : ''}
      </span>
    </div>
  );
  const blackSegment = (
    <div
      key="black"
      data-eval-side="black"
      className={`w-full bg-black/60 transition-all duration-700 ease-out flex justify-center ${isFlipped ? 'items-end pb-3' : 'items-start pt-3'}`}
      style={{ height: `${100 - whitePercentage}%` }}
    >
      <span className="hidden md:block w-full text-center px-0.5 text-[10px] leading-none font-black text-white/90 tracking-tighter uppercase">
        {showLabel && !whiteWinning ? label : ''}
      </span>
    </div>
  );

  return (
    <div
      id="eval-bar-container"
      className="relative w-full h-full glass-premium overflow-hidden border-white/10 flex flex-col justify-between select-none"
      title={`Evaluation: ${label}`}
    >
      {/* White's side is nearest White's pieces: at the bottom normally, at the top when flipped. */}
      {isFlipped ? [whiteSegment, blackSegment] : [blackSegment, whiteSegment]}

      {/* Center line indicator - Premium Gold/Red */}
      <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-gradient-to-r from-[#FFD700] to-[#D32F2F] transform -translate-y-1/2 pointer-events-none z-10 opacity-100 shadow-[0_0_10px_rgba(255,215,0,0.5)]" />
    </div>
  );
});
