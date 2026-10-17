import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Upload, ChevronRight, Palette, Layers, Zap, Volume2, Wrench, Sliders, Download, RotateCcw, Check, Lock } from 'lucide-react';
import { useDemo } from '../context/DemoContext';
import { BOARD_THEMES, PIECE_THEMES, DEFAULT_DEMO_SETTINGS } from '../data/demoData';
import { BoardThemeName, PieceThemeName, DemoSettings } from '../types/chess';

// Only the themes shown in the presentation. Every other preset is left out on purpose.
const SHOWN_BOARD_THEMES = ['ukh', 'peshmerga', 'classic', 'wood', 'ocean', 'emerald'];
const SHOWN_PIECE_THEMES = ['ukh', 'peshmerga', 'classic', 'aot'];

type SettingsTab = 'appearance' | 'board' | 'gameplay' | 'sounds' | 'advanced';

// Settings the full platform has, shown so visitors know they exist, but not switchable in the demo
const PLATFORM_ONLY = [
  { label: 'Confirm moves before they are played', desc: 'Two-step move confirmation for slow connections' },
  { label: 'Auto-queen promotion', desc: 'Promote to a queen without the dialog' },
  { label: 'Separate move, capture and check sounds', desc: 'Each sound can be turned on or off' },
  { label: 'High-contrast and reduced-motion modes', desc: 'Accessibility options for WCAG 2.1 AA' },
  { label: 'Territory and weather overlays', desc: 'Board overlays that show control and conditions' },
  { label: 'Account, privacy and connected accounts', desc: 'Sign-in, rating history and privacy controls' },
  { label: 'Custom themes and piece uploads', desc: 'Build your own board and piece set' },
];

const handleExport = (settings: DemoSettings) => {
  const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chesskys-demo-settings.json';
  a.click();
  URL.revokeObjectURL(url);
};

// Only keys the demo knows about, and only with the right type. An unknown file cannot break the page.
const sanitiseImport = (raw: unknown): Partial<DemoSettings> | null => {
  if (!raw || typeof raw !== 'object') return null;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_DEMO_SETTINGS) as Array<keyof DemoSettings>) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === typeof DEFAULT_DEMO_SETTINGS[key]) out[key] = value;
  }
  return Object.keys(out).length > 0 ? (out as Partial<DemoSettings>) : null;
};

const playTestSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => ctx.close();
  } catch {
    // No audio device or the browser blocks audio: the page keeps working without the test tone
  }
};

export const SettingsView: React.FC = () => {
  const { setViewMode, settings, updateSettings, presentationMode, togglePresentationMode } = useDemo();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
    { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
    { id: 'board', label: 'Board', icon: <Layers className="w-4 h-4" /> },
    { id: 'gameplay', label: 'Gameplay', icon: <Zap className="w-4 h-4" /> },
    { id: 'sounds', label: 'Sounds', icon: <Volume2 className="w-4 h-4" /> },
    { id: 'advanced', label: 'Advanced', icon: <Wrench className="w-4 h-4" /> },
  ];

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = sanitiseImport(JSON.parse(String(reader.result)));
        if (next) {
          updateSettings(next);
          setMessage({ text: `Imported ${Object.keys(next).length} settings.`, ok: true });
        } else {
          setMessage({ text: 'That file has no Chesskys settings in it.', ok: false });
        }
      } catch {
        setMessage({ text: 'That file is not valid JSON.', ok: false });
      }
    };
    reader.readAsText(file);
  };

  const doReset = () => {
    updateSettings(DEFAULT_DEMO_SETTINGS);
    setConfirmReset(false);
    setMessage({ text: 'Settings reset to the presentation defaults.', ok: true });
  };

  return (
    <div className="min-h-screen pt-20 bg-[var(--app-bg)]">
      <header className="fixed top-0 left-0 right-0 z-40 glass-panel border-b border-[var(--glass-border)] px-4 py-3" style={{ backdropFilter: 'blur(20px)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode('dashboard')}
              className="w-10 h-10 rounded-xl glass-panel-hover flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)]"
              aria-label="Back to dashboard"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-[var(--primary-accent)]/20 flex items-center justify-center">
              <Sliders className="w-5 h-5 text-[var(--primary-accent)]" />
            </div>
            <h1 className="font-black text-lg text-[var(--text-main)]">Settings</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleExport(settings)} className="btn-secondary text-sm">
              <Download className="w-4 h-4 mr-1" /> Export
            </button>
            <label className="btn-secondary text-sm cursor-pointer">
              <Upload className="w-4 h-4 mr-1" /> Import
              <input type="file" accept=".json,application/json" onChange={handleImport} className="hidden" />
            </label>
            {confirmReset ? (
              <>
                <button onClick={doReset} className="btn-danger text-sm">Yes, reset</button>
                <button onClick={() => setConfirmReset(false)} className="btn-secondary text-sm">Keep</button>
              </>
            ) : (
              <button onClick={() => setConfirmReset(true)} className="btn-danger text-sm">
                <RotateCcw className="w-4 h-4 mr-1" /> Reset
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="pt-20 pb-10 px-4 max-w-4xl mx-auto">
        {message && (
          <div
            role="status"
            className={`mb-4 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-between gap-3 ${
              message.ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
            }`}
          >
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-xs underline opacity-80">Dismiss</button>
          </div>
        )}

        {/* Tabs: a plain row of buttons. No exit animation, so a click always swaps the content at once. */}
        <div className="glass-panel p-1 rounded-xl mb-6 overflow-x-auto">
          <div role="tablist" className="flex gap-1 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[var(--primary-accent)] text-[var(--app-bg)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
          {activeTab === 'appearance' && (
            <Section title="Appearance">
              <SettingRow label="Presentation mode" desc="Hides extra panels and enlarges the board, for projectors">
                <Toggle checked={presentationMode} onChange={togglePresentationMode} label="Presentation mode" />
              </SettingRow>
              <SettingRow label="Tilted board" desc="A slight 3D perspective on the board">
                <Toggle checked={settings.is3dPerspective} onChange={() => updateSettings({ is3dPerspective: !settings.is3dPerspective })} label="Tilted board" />
              </SettingRow>
            </Section>
          )}

          {activeTab === 'board' && (
            <>
              <Section title="Board theme">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {BOARD_THEMES.filter(t => SHOWN_BOARD_THEMES.includes(t.id)).map((theme) => (
                    <OptionCard
                      key={theme.id}
                      selected={settings.boardTheme === theme.id}
                      onSelect={() => updateSettings({ boardTheme: theme.id as BoardThemeName })}
                      label={theme.name}
                    >
                      <div className="grid grid-cols-4 h-6 rounded overflow-hidden mb-2" aria-hidden="true">
                        {[0, 1, 2, 3].map(i => (
                          <span key={i} style={{ background: i % 2 === 0 ? theme.light : theme.dark }} />
                        ))}
                      </div>
                    </OptionCard>
                  ))}
                </div>
              </Section>

              <Section title="Piece set">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {PIECE_THEMES.filter(t => SHOWN_PIECE_THEMES.includes(t.id)).map((theme) => (
                    <OptionCard
                      key={theme.id}
                      selected={settings.pieceTheme === theme.id}
                      onSelect={() => updateSettings({ pieceTheme: theme.id as PieceThemeName })}
                      label={theme.name}
                    >
                      <div className="text-[11px] text-[var(--text-dim)] leading-snug">{theme.tag}</div>
                    </OptionCard>
                  ))}
                </div>
              </Section>

              <Section title="Board details">
                <SettingRow label="Coordinates" desc="Show file and rank letters on the edge squares">
                  <Toggle checked={settings.showCoordinates} onChange={() => updateSettings({ showCoordinates: !settings.showCoordinates })} label="Coordinates" />
                </SettingRow>
                <SettingRow label="Legal move dots" desc="Dots on the squares a selected piece can move to">
                  <Toggle checked={settings.showLegalMoves} onChange={() => updateSettings({ showLegalMoves: !settings.showLegalMoves })} label="Legal move dots" />
                </SettingRow>
                <SettingRow label="Highlight last move" desc="Shade the squares of the most recent move">
                  <Toggle checked={settings.highlightLastMove} onChange={() => updateSettings({ highlightLastMove: !settings.highlightLastMove })} label="Highlight last move" />
                </SettingRow>
              </Section>
            </>
          )}

          {activeTab === 'gameplay' && (
            <Section title="Bot strength">
              <p className="text-sm text-[var(--text-dim)] mb-4">Used for Quick Match and when a room is left empty. The bot is a demo engine, not the platform’s.</p>
              <div className="grid grid-cols-3 gap-3">
                {(['easy', 'medium', 'hard'] as const).map((level) => (
                  <OptionCard
                    key={level}
                    selected={settings.difficulty === level}
                    onSelect={() => updateSettings({ difficulty: level })}
                    label={level === 'easy' ? 'Beginner' : level === 'medium' ? 'Club' : 'Expert'}
                  >
                    <div className="text-[11px] text-[var(--text-dim)]">
                      {level === 'easy' ? 'Plays random legal moves' : level === 'medium' ? 'Captures and centre control' : 'Searches two moves ahead'}
                    </div>
                  </OptionCard>
                ))}
              </div>
            </Section>
          )}

          {activeTab === 'sounds' && (
            <Section title="Sounds">
              <SettingRow label="Game sounds" desc="Move, capture, check and game-over sounds">
                <Toggle checked={settings.soundEnabled} onChange={() => updateSettings({ soundEnabled: !settings.soundEnabled })} label="Game sounds" />
              </SettingRow>
              <SettingRow label="Test sound" desc="Plays one tone so you can check the volume">
                <button onClick={playTestSound} className="btn-secondary text-sm">Play test tone</button>
              </SettingRow>
            </Section>
          )}

          {activeTab === 'advanced' && (
            <>
              <Section title="Your data">
                <SettingRow label="Export settings" desc="Save your current settings as a JSON file">
                  <button onClick={() => handleExport(settings)} className="btn-secondary text-sm"><Download className="w-4 h-4 mr-1" /> Export</button>
                </SettingRow>
                <SettingRow label="Reset to defaults" desc="Restores the presentation defaults. Asks first.">
                  {confirmReset ? (
                    <div className="flex gap-2">
                      <button onClick={doReset} className="btn-danger text-sm">Yes, reset</button>
                      <button onClick={() => setConfirmReset(false)} className="btn-secondary text-sm">Keep</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmReset(true)} className="btn-danger text-sm"><RotateCcw className="w-4 h-4 mr-1" /> Reset</button>
                  )}
                </SettingRow>
              </Section>

              <Section title="Coming in the full platform">
                <p className="text-sm text-[var(--text-dim)] mb-2">These are part of the full Chesskys platform. They are not switchable in this demo.</p>
                {PLATFORM_ONLY.map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-4 py-3 border-b border-[var(--glass-border)]/50 last:border-0 opacity-70">
                    <div>
                      <div className="font-medium text-[var(--text-main)] text-sm">{item.label}</div>
                      <div className="text-[11px] text-[var(--text-dim)] mt-0.5">{item.desc}</div>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md border border-[var(--glass-border)] text-[var(--text-dim)]">
                      <Lock className="w-3 h-3" /> Full platform
                    </span>
                  </div>
                ))}
              </Section>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="glass-panel p-6 rounded-2xl mb-6">
    <h3 className="font-black text-[var(--text-main)] mb-4">{title}</h3>
    {children}
  </section>
);

const SettingRow: React.FC<{ label: string; desc?: string; children: React.ReactNode }> = ({ label, desc, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4 border-b border-[var(--glass-border)]/50 last:border-0">
    <div className="flex-1">
      <div className="font-medium text-[var(--text-main)]">{label}</div>
      {desc && <div className="text-[11px] text-[var(--text-dim)] mt-1">{desc}</div>}
    </div>
    <div className="flex items-center">{children}</div>
  </div>
);

const OptionCard: React.FC<{ selected: boolean; onSelect: () => void; label: string; children?: React.ReactNode }> = ({ selected, onSelect, label, children }) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className={`relative text-left p-3 rounded-xl border transition-colors ${
      selected ? 'border-[var(--primary-accent)] bg-[var(--primary-accent)]/10' : 'border-[var(--glass-border)] hover:border-[var(--text-dim)]'
    }`}
  >
    {selected && <Check className="absolute top-2 right-2 w-4 h-4 text-[var(--primary-accent)]" />}
    <div className="font-bold text-sm text-[var(--text-main)] mb-2 pr-5">{label}</div>
    {children}
  </button>
);

const Toggle: React.FC<{ checked: boolean; onChange: () => void; label: string }> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    className={`relative w-12 h-7 rounded-full transition-colors ${checked ? 'bg-[var(--primary-accent)]' : 'bg-[var(--glass-border)]'}`}
  >
    <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);
