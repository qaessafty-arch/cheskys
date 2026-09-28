import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Keyboard, RotateCw, Volume2, Flag, Undo2, Redo2, Lightbulb, PlusCircle, HelpCircle } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface ShortcutSection {
  title: string;
  items: ShortcutItem[];
}

const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: 'Game & Board Controls',
    items: [
      {
        keys: ['F'],
        label: 'Flip Board',
        description: 'Toggles board perspective between White and Black',
        icon: RotateCw
      },
      {
        keys: ['Shift', 'R'],
        label: 'Resign Match',
        description: 'Surrender the current active match',
        icon: Flag
      },
      {
        keys: ['N'],
        label: 'New Game',
        description: 'Open the game creation and bot selector modal',
        icon: PlusCircle
      },
      {
        keys: ['H'],
        label: 'Request Hint',
        description: 'Ask the Stockfish engine for a tactical recommendation',
        icon: Lightbulb
      }
    ]
  },
  {
    title: 'History & Moves',
    items: [
      {
        keys: ['U', 'Ctrl + Z'],
        label: 'Undo Move',
        description: 'Take back the last move in local or AI mode',
        icon: Undo2
      },
      {
        keys: ['Y', 'Ctrl + Y'],
        label: 'Redo Move',
        description: 'Redo previously taken back move',
        icon: Redo2
      }
    ]
  },
  {
    title: 'Audio & Navigation',
    items: [
      {
        keys: ['S', 'M'],
        label: 'Toggle Sound',
        description: 'Mute or unmute all board audio and piece movements',
        icon: Volume2
      },
      {
        keys: ['?'],
        label: 'Shortcuts Menu',
        description: 'Display this keyboard shortcuts cheat sheet',
        icon: HelpCircle
      },
      {
        keys: ['Esc'],
        label: 'Close / Cancel',
        description: 'Dismiss any open modal or prompt dialog',
        icon: X
      }
    ]
  }
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-2xl bg-[#0F172A] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/60 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Keyboard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white tracking-wide flex items-center gap-2">
                  Keyboard Shortcuts
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                    Hotkeys
                  </span>
                </h3>
                <p className="text-xs text-slate-400">Instant shortcuts for rapid grandmaster actions</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              aria-label="Close shortcuts modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {SHORTCUT_SECTIONS.map((section, idx) => (
              <div key={idx} className="space-y-2.5">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-amber-400/90 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  {section.title}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {section.items.map((item, itemIdx) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={itemIdx}
                        className="flex items-start justify-between p-3 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-white/15 transition-all hover:bg-slate-900/80 group"
                      >
                        <div className="flex items-start gap-3 min-w-0 pr-2">
                          <div className="p-1.5 rounded-lg bg-white/5 text-slate-300 group-hover:text-amber-300 group-hover:bg-amber-500/10 transition-colors shrink-0 mt-0.5">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white tracking-tight">{item.label}</div>
                            <div className="text-[10px] text-slate-400 line-clamp-1">{item.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {item.keys.map((k, kIdx) => (
                            <kbd
                              key={kIdx}
                              className="px-2 py-1 text-[10px] font-mono font-black text-slate-200 bg-slate-800/90 border border-slate-700/80 rounded-lg shadow-sm group-hover:border-amber-500/40 group-hover:text-amber-200 transition-colors"
                            >
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-white/10 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Press <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-slate-800 border border-slate-700 rounded text-slate-200">?</kbd> anywhere to toggle this guide</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-lg shadow-amber-500/20"
            >
              Got it
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
