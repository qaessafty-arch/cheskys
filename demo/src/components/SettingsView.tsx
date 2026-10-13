import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ArrowLeft, Palette, Plus, Trash2, Edit3, Sparkles, Layers, Sliders, Crown, MessageSquare, Shield, Zap, Lock, Unlock, Database, History, PenTool, ExternalLink, HelpCircle, Eye, RotateCcw, Sun, Moon, Volume2, VolumeX, Check, X, Copy, ChevronDown, Globe, Users, Award, Zap as ZapIcon, Shield as ShieldIcon, HeartHandshake, BarChart2, Bell, Key, Wrench, Bug, Monitor, Smartphone, Globe as GlobeIcon, Download, Link, MousePointer, HeartHandshake as HeartHandshakeIcon, BarChart2 as BarChart2Icon } from 'lucide-react';
import { useDemo } from '../context/DemoContext';
import { BOARD_THEMES, PIECE_THEMES, DEFAULT_DEMO_SETTINGS } from '../data/demoData';
import { BoardThemeName, PieceThemeName, DemoSettings } from '../types/chess';

type SettingsTab = 'appearance' | 'board' | 'gameplay' | 'sounds' | 'accessibility' | 'account' | 'advanced';

const handleExportSettings = (settings: DemoSettings) => {
  const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chesskys-demo-settings.json';
  a.click();
  URL.revokeObjectURL(url);
};

const handleImportSettings = (e: React.ChangeEvent<HTMLInputElement>, updateSettings: (s: Partial<DemoSettings>) => void) => {
  const file = e.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        updateSettings(imported);
      } catch (err) {
        alert('Invalid settings file');
      }
    };
    reader.readAsText(file);
  }
};

const handleResetSettings = (updateSettings: (s: Partial<DemoSettings>) => void) => {
  if (confirm('Reset all settings to defaults?')) {
    updateSettings(DEFAULT_DEMO_SETTINGS);
  }
};

export const SettingsView: React.FC = () => {
  const { viewMode, setViewMode, settings, updateSettings, presentationMode, togglePresentationMode } = useDemo();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [showCustomThemeModal, setShowCustomThemeModal] = useState(false);
  const [customThemeName, setCustomThemeName] = useState('');

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ReactNode; desc: string }> = [
    { id: 'appearance', label: 'Appearance', icon: <Palette className="w-5 h-5" />, desc: 'Themes, colors, presentation mode' },
    { id: 'board', label: 'Board', icon: <Layers className="w-5 h-5" />, desc: 'Board themes, piece sets, coordinates' },
    { id: 'gameplay', label: 'Gameplay', icon: <Zap className="w-5 h-5" />, desc: 'Move confirmation, auto-queen, difficulty' },
    { id: 'sounds', label: 'Sounds', icon: <Volume2 className="w-5 h-5" />, desc: 'Move, capture, check, game-over sounds' },
    { id: 'accessibility', label: 'Accessibility', icon: <Shield className="w-5 h-5" />, desc: 'High contrast, reduced motion, large pieces' },
    { id: 'account', label: 'Account', icon: <Users className="w-5 h-5" />, desc: 'Profile, privacy, connected accounts' },
    { id: 'advanced', label: 'Advanced', icon: <Wrench className="w-5 h-5" />, desc: 'Debug, reset, export data' },
  ];

  const handleResetSettings = () => {
    if (confirm('Reset all settings to defaults?')) {
      updateSettings(DEFAULT_DEMO_SETTINGS);
    }
  };

  const handleExportSettings = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chesskys-demo-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);
          updateSettings(imported);
        } catch (err) {
          alert('Invalid settings file');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen pt-20 bg-[var(--app-bg)]">
      <header className="fixed top-0 left-0 right-0 z-40 glass-panel border-b border-[var(--glass-border)] px-4 py-3" style={{ backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setViewMode('dashboard')} className="w-10 h-10 rounded-xl glass-panel-hover flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)]"><ChevronRight className="w-5 h-5 rotate-180" /></button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--primary-accent)]/20 flex items-center justify-center"><Sliders className="w-5 h-5 text-[var(--primary-accent)]" /></div>
              <h1 className="font-black text-lg text-[var(--text-main)]">Settings</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportSettings} className="btn-secondary text-sm"><Download className="w-4 h-4 mr-1" /> Export</button>
            <input type="file" accept=".json" onChange={handleImportSettings} className="hidden" id="import-settings" ref={(el) => el?.click()} />
            <label htmlFor="import-settings" className="btn-secondary text-sm cursor-pointer"><Upload className="w-4 h-4 mr-1" /> Import</label>
            <button onClick={handleResetSettings} className="btn-danger text-sm"><RotateCcw className="w-4 h-4 mr-1" /> Reset</button>
          </div>
        </div>
      </header>

      <div className="pt-20 pb-8 px-4 max-w-5xl mx-auto">
        {/* Tab Navigation */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-1 rounded-xl mb-6 max-w-xs">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-[var(--primary-accent)] text-[var(--app-bg)] shadow-[0_0_20px_rgba(245,184,61,0.3)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'
                }`}
                title={tab.desc}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'appearance' && <AppearanceTab settings={settings} updateSettings={updateSettings} presentationMode={presentationMode} togglePresentationMode={togglePresentationMode} />}
            {activeTab === 'board' && <BoardTab settings={settings} updateSettings={updateSettings} />}
            {activeTab === 'gameplay' && <GameplayTab settings={settings} updateSettings={updateSettings} />}
            {activeTab === 'sounds' && <SoundsTab settings={settings} updateSettings={updateSettings} />}
            {activeTab === 'accessibility' && <AccessibilityTab settings={settings} updateSettings={updateSettings} />}
            {activeTab === 'account' && <AccountTab />}
            {activeTab === 'advanced' && <AdvancedTab settings={settings} updateSettings={updateSettings} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-6 rounded-2xl mb-6">
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl bg-[var(--primary-accent)]/20 flex items-center justify-center" style={{ color: 'var(--primary-accent)' }}>{icon}</div>
      <h3 className="font-black text-[var(--text-main)]">{title}</h3>
    </div>
    {children}
  </motion.div>
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

const Toggle: React.FC<{ checked: boolean; onChange: () => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
  <button
    onClick={onChange}
    disabled={disabled}
    className={`relative w-14 h-8 rounded-full flex items-center transition-all ${checked ? 'bg-[var(--primary-accent)]' : 'bg-[var(--glass-bg)] border border-[var(--glass-border)]'}`}
    aria-label={checked ? 'Enabled' : 'Disabled'}
  >
    <span className={`absolute w-6 h-6 rounded-full bg-white shadow-md transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

const Select: React.FC<{ value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }> = ({ value, onChange, options }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className="px-4 py-2 bg-[var(--panel-bg)] border border-[var(--glass-border)] rounded-xl text-[var(--text-main)] text-sm focus:outline-none focus:border-[var(--primary-accent)] min-w-[200px]">
    {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
  </select>
);

// Appearance Tab
const AppearanceTab: React.FC<{ settings: DemoSettings; updateSettings: (s: Partial<DemoSettings>) => void; presentationMode: boolean; togglePresentationMode: () => void }> = ({ settings, updateSettings, presentationMode, togglePresentationMode }) => (
  <>
    <Section title="UI Theme" icon={<Palette className="w-5 h-5" />}>
      <SettingRow label="Presentation Mode" desc="Larger board, simplified UI for demos">
        <Toggle checked={presentationMode} onChange={togglePresentationMode} />
      </SettingRow>
      <SettingRow label="Dark Mode" desc="Always dark (demo only supports dark)">
        <Toggle checked={true} onChange={() => {}} disabled />
      </SettingRow>
    </Section>

    <Section title="Quick Theme Presets" icon={<Sparkles className="w-5 h-5" />}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { name: 'UKH Gold', primary: '#F5B83D', secondary: '#6EE7B7' },
          { name: 'Emerald', primary: '#6EE7B7', secondary: '#60A5FA' },
          { name: 'Purple', primary: '#A855F7', secondary: '#F5B83D' },
          { name: 'Rose', primary: '#FB7185', secondary: '#6EE7B7' },
        ].map((preset) => (
          <button
            key={preset.name}
            className="p-4 rounded-xl glass-panel-hover text-center transition-all border-2"
            style={{ borderColor: settings.presentationMode ? 'transparent' : 'var(--glass-border)' }}
            onClick={() => {}}
          >
            <div className="w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})` }} />
            <div className="font-bold text-[var(--text-main)] text-sm">{preset.name}</div>
          </button>
        ))}
      </div>
    </Section>
  </>
);

// Board Tab
const BoardTab: React.FC<{ settings: DemoSettings; updateSettings: (s: Partial<DemoSettings>) => void }> = ({ settings, updateSettings }) => (
  <>
    <Section title="Board Themes" icon={<Layers className="w-5 h-5" />}>
      <p className="text-[var(--text-dim)] text-sm mb-4">Click a theme to preview instantly</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {BOARD_THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => updateSettings({ boardTheme: theme.id as BoardThemeName })}
            className={`relative aspect-square rounded-xl overflow-hidden transition-all border-2 ${
              settings.boardTheme === theme.id ? 'border-[var(--primary-accent)] scale-[1.02]' : 'border-[var(--glass-border)] hover:border-[var(--primary-accent)]/50'
            }`}
          >
            <div className="absolute inset-0" style={{
              background: `linear-gradient(45deg, ${theme.light} 25%, transparent 25%), linear-gradient(-45deg, ${theme.light} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${theme.light} 75%), linear-gradient(-45deg, transparent 75%, ${theme.light} 75%), ${theme.dark}`,
              backgroundSize: '40px 40px',
              backgroundPosition: '0 0, 0 20px, 20px -20px, -20px 0px',
            }} />
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
              <div className="font-bold text-[var(--text-main)] text-sm">{theme.name}</div>
              <div className="text-[10px] text-[var(--text-dim)]">{theme.desc}</div>
            </div>
            {settings.boardTheme === theme.id && (
              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--primary-accent)] flex items-center justify-center">
                <Check className="w-4 h-4 text-[var(--app-bg)]" />
              </div>
            )}
          </button>
        ))}
      </div>
    </Section>

    <Section title="Piece Sets" icon={<Crown className="w-5 h-5" />}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {PIECE_THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => updateSettings({ pieceTheme: theme.id as PieceThemeName })}
            className={`p-4 rounded-xl glass-panel-hover text-center transition-all border-2 ${
              settings.pieceTheme === theme.id ? 'border-[var(--primary-accent)]' : 'border-[var(--glass-border)]'
            }`}
          >
            <div className="text-3xl mb-2">{theme.icon}</div>
            <div className="font-bold text-[var(--text-main)] text-sm">{theme.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">{theme.tag}</div>
            <div className="text-[11px] text-[var(--text-dim)]">{theme.desc}</div>
            {settings.pieceTheme === theme.id && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--primary-accent)] flex items-center justify-center">
                <Check className="w-3 h-3 text-[var(--app-bg)]" />
              </div>
            )}
          </button>
        ))}
      </div>
    </Section>

    <Section title="Board Display" icon={<Eye className="w-5 h-5" />}>
      <SettingRow label="Show Coordinates" desc="Display file/rank labels on board">
        <Toggle checked={settings.showCoordinates} onChange={() => updateSettings({ showCoordinates: !settings.showCoordinates })} />
      </SettingRow>
      <SettingRow label="Show Legal Moves" desc="Highlight legal move destinations">
        <Toggle checked={settings.showLegalMoves} onChange={() => updateSettings({ showLegalMoves: !settings.showLegalMoves })} />
      </SettingRow>
      <SettingRow label="Highlight Last Move" desc="Show from/to squares of last move">
        <Toggle checked={settings.highlightLastMove} onChange={() => updateSettings({ highlightLastMove: !settings.highlightLastMove })} />
      </SettingRow>
      <SettingRow label="3D Perspective" desc="Subtle board perspective effect">
        <Toggle checked={false} onChange={() => {}} disabled />
      </SettingRow>
    </Section>
  </>
);

// Gameplay Tab
const GameplayTab: React.FC<{ settings: DemoSettings; updateSettings: (s: Partial<DemoSettings>) => void }> = ({ settings, updateSettings }) => (
  <>
    <Section title="Move Behavior" icon={<Zap className="w-5 h-5" />}>
      <SettingRow label="Confirm Moves" desc="Click piece then click destination (vs drag)">
        <Toggle checked={settings.confirmMoves} onChange={() => updateSettings({ confirmMoves: !settings.confirmMoves })} />
      </SettingRow>
      <SettingRow label="Auto Queen Promotion" desc="Auto-promote to Queen after 5 seconds">
        <Toggle checked={settings.autoQueen} onChange={() => updateSettings({ autoQueen: !settings.autoQueen })} />
      </SettingRow>
      <SettingRow label="Show Captured Pieces" desc="Display captured material count">
        <Toggle checked={true} onChange={() => {}} disabled />
      </SettingRow>
      <SettingRow label="Premove" desc="Queue moves during opponent's turn">
        <Toggle checked={false} onChange={() => {}} disabled />
      </SettingRow>
    </Section>

    <Section title="Bot Difficulty" icon={<Smartphone className="w-5 h-5" />}>
      <SettingRow label="Demo Bot Level" desc="Opponent strength for quick matches">
        <Select
          value={settings.difficulty}
          onChange={(v) => updateSettings({ difficulty: v as 'easy' | 'medium' | 'hard' })}
          options={[
            { value: 'easy', label: '🟢 Beginner (1000) - Random moves' },
            { value: 'medium', label: '🟡 Club (1450) - Captures & center control' },
            { value: 'hard', label: '🔴 Expert (1800) - Minimax depth 2' },
          ]}
        />
      </SettingRow>
    </Section>

    <Section title="Time Controls" icon={<Clock className="w-5 h-5" />}>
      <SettingRow label="Default Time Control" desc="Used for new quick matches">
        <Select
          value="blitz-3-2"
          onChange={() => {}}
          options={[
            { value: 'bullet-1-0', label: 'Bullet 1+0' },
            { value: 'blitz-3-0', label: 'Blitz 3+0' },
            { value: 'blitz-3-2', label: 'Blitz 3+2' },
            { value: 'blitz-5-3', label: 'Blitz 5+3' },
            { value: 'rapid-10-0', label: 'Rapid 10+0' },
            { value: 'rapid-15-10', label: 'Rapid 15+10' },
          ]}
        />
      </SettingRow>
    </Section>
  </>
);

// Sounds Tab
const SoundsTab: React.FC<{ settings: DemoSettings; updateSettings: (s: Partial<DemoSettings>) => void }> = ({ settings, updateSettings }) => (
  <>
    <Section title="Sound Effects" icon={<Volume2 className="w-5 h-5" />}>
      <SettingRow label="Master Sound" desc="Enable/disable all sounds">
        <Toggle checked={settings.soundEnabled} onChange={() => updateSettings({ soundEnabled: !settings.soundEnabled })} />
      </SettingRow>
      <SettingRow label="Move Sound" desc="Play sound on piece movement">
        <Toggle checked={settings.moveSound} onChange={() => updateSettings({ moveSound: !settings.moveSound })} disabled={!settings.soundEnabled} />
      </SettingRow>
      <SettingRow label="Capture Sound" desc="Different sound for captures">
        <Toggle checked={settings.captureSound} onChange={() => updateSettings({ captureSound: !settings.captureSound })} disabled={!settings.soundEnabled} />
      </SettingRow>
      <SettingRow label="Check Sound" desc="Alert when king is in check">
        <Toggle checked={settings.checkSound} onChange={() => updateSettings({ checkSound: !settings.checkSound })} disabled={!settings.soundEnabled} />
      </SettingRow>
      <SettingRow label="Game Over Sound" desc="Fanfare on game end">
        <Toggle checked={settings.gameOverSound} onChange={() => updateSettings({ gameOverSound: !settings.gameOverSound })} disabled={!settings.soundEnabled} />
      </SettingRow>
    </Section>

    <Section title="Sound Preview" icon={<Volume2 className="w-5 h-5" />}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Move', type: 'move' as const },
          { label: 'Capture', type: 'capture' as const },
          { label: 'Check', type: 'check' as const },
          { label: 'Game Over', type: 'gameover' as const },
        ].map(sound => (
          <button
            key={sound.label}
            onClick={() => playTestSound(sound.type)}
            className="p-4 rounded-xl glass-panel-hover text-center transition-all"
          >
            <Volume2 className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--primary-accent)' }} />
            <div className="font-medium text-[var(--text-main)]">{sound.label}</div>
            <div className="text-[11px] text-[var(--text-dim)]">Click to preview</div>
          </button>
        ))}
      </div>
    </Section>
  </>
);

function playTestSound(type: 'move' | 'capture' | 'check' | 'gameover') {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  switch (type) {
    case 'move': osc.frequency.value = 440; osc.type = 'sine'; gain.gain.value = 0.1; osc.start(); osc.stop(ctx.currentTime + 0.1); break;
    case 'capture': osc.frequency.value = 330; osc.type = 'square'; gain.gain.value = 0.15; osc.start(); osc.stop(ctx.currentTime + 0.15); break;
    case 'check': osc.frequency.value = 523; osc.type = 'triangle'; gain.gain.value = 0.1; osc.start(); osc.stop(ctx.currentTime + 0.3); break;
    case 'gameover': osc.frequency.value = 220; osc.type = 'sawtooth'; gain.gain.value = 0.1; osc.start(); osc.stop(ctx.currentTime + 0.5); break;
  }
}

// Accessibility Tab
const AccessibilityTab: React.FC<{ settings: DemoSettings; updateSettings: (s: Partial<DemoSettings>) => void }> = ({ settings, updateSettings }) => (
  <>
    <Section title="Visual Accessibility" icon={<Shield className="w-5 h-5" />}>
      <SettingRow label="High Contrast Mode" desc="Increase contrast for better visibility">
        <Toggle checked={false} onChange={() => {}} disabled />
      </SettingRow>
      <SettingRow label="Larger Pieces" desc="Increase piece size by 20%">
        <Toggle checked={false} onChange={() => {}} disabled />
      </SettingRow>
      <SettingRow label="Reduced Motion" desc="Disable non-essential animations">
        <Toggle checked={false} onChange={() => {}} />
      </SettingRow>
      <SettingRow label="Color Blind Friendly" desc="Adjust piece colors for color blindness">
        <Toggle checked={false} onChange={() => {}} disabled />
      </SettingRow>
    </Section>

    <Section title="Interaction" icon={<MousePointer className="w-5 h-5" />}>
      <SettingRow label="Click-to-Move" desc="Click piece then click destination">
        <Toggle checked={settings.confirmMoves} onChange={() => updateSettings({ confirmMoves: !settings.confirmMoves })} />
      </SettingRow>
      <SettingRow label="Right-click to Cancel" desc="Right-click deselects piece">
        <Toggle checked={true} onChange={() => {}} disabled />
      </SettingRow>
      <SettingRow label="Touch Optimized" desc="Larger touch targets on mobile">
        <Toggle checked={true} onChange={() => {}} disabled />
      </SettingRow>
    </Section>
  </>
);

// Account Tab
const AccountTab: React.FC = () => (
  <>
    <Section title="Profile" icon={<Users className="w-5 h-5" />}>
      <SettingRow label="Display Name" desc="Your name shown to other players">
        <input type="text" defaultValue="Ren Barzani" className="px-4 py-2 bg-[var(--panel-bg)] border border-[var(--glass-border)] rounded-xl text-[var(--text-main)] w-64" />
      </SettingRow>
      <SettingRow label="Country" desc="Your country flag">
        <Select value="IQ" onChange={() => {}} options={[
          { value: 'IQ', label: '🇮🇶 Iraq' },
          { value: 'US', label: '🇺🇸 United States' },
          { value: 'DE', label: '🇩🇪 Germany' },
        ]} />
      </SettingRow>
      <SettingRow label="Avatar" desc="Your profile picture">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--primary-accent)]/20 flex items-center justify-center text-2xl">🎓</div>
          <button className="btn-secondary text-sm">Change</button>
        </div>
      </SettingRow>
    </Section>

    <Section title="Privacy" icon={<Lock className="w-5 h-5" />}>
      <SettingRow label="Show Online Status" desc="Let friends see when you're online">
        <Toggle checked={true} onChange={() => {}} />
      </SettingRow>
      <SettingRow label="Show Rating History" desc="Public rating graph">
        <Toggle checked={true} onChange={() => {}} />
      </SettingRow>
      <SettingRow label="Allow Friend Requests" desc="Receive friend requests from anyone">
        <Toggle checked={true} onChange={() => {}} />
      </SettingRow>
      <SettingRow label="Allow Challenges" desc="Receive game challenges from anyone">
        <Toggle checked={true} onChange={() => {}} />
      </SettingRow>
      <SettingRow label="Data Collection" desc="Anonymous analytics for improvement">
        <Toggle checked={false} onChange={() => {}} />
      </SettingRow>
    </Section>

    <Section title="Connected Accounts" icon={<Link className="w-5 h-5" />}>
      <div className="space-y-3">
        {[
          { name: 'Google', connected: true, icon: GlobeIcon },
          { name: 'GitHub', connected: false, icon: GlobeIcon },
          { name: 'Discord', connected: false, icon: MessageSquare },
        ].map(account => (
          <div key={account.name} className="flex items-center justify-between p-3 glass-panel rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--primary-accent)]/20 flex items-center justify-center"><account.icon className="w-5 h-5" style={{ color: 'var(--primary-accent)' }} /></div>
              <div>
                <div className="font-bold text-[var(--text-main)]">{account.name}</div>
                <div className="text-[11px] text-[var(--text-dim)]">{account.connected ? 'Connected' : 'Not connected'}</div>
              </div>
            </div>
            <button className={`px-4 py-2 rounded-lg text-sm font-bold ${account.connected ? 'bg-[var(--danger)]/20 text-[var(--danger)] border border-[var(--danger)]/30' : 'btn-secondary'}`}>
              {account.connected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        ))}
      </div>
    </Section>
  </>
);

// Advanced Tab
const AdvancedTab: React.FC<{ settings: DemoSettings; updateSettings: (s: Partial<DemoSettings>) => void }> = ({ settings, updateSettings }) => (
  <>
    <Section title="Debug" icon={<Bug className="w-5 h-5" />}>
      <SettingRow label="Show FPS Counter" desc="Display frame rate in corner">
        <Toggle checked={false} onChange={() => {}} />
      </SettingRow>
      <SettingRow label="Show Move Coordinates" desc="Log all moves to console">
        <Toggle checked={false} onChange={() => {}} />
      </SettingRow>
      <SettingRow label="Verbose Logging" desc="Detailed console output">
        <Toggle checked={false} onChange={() => {}} />
      </SettingRow>
    </Section>

    <Section title="Data Management" icon={<Database className="w-5 h-5" />}>
      <div className="space-y-3">
        <button onClick={handleExportSettings} className="btn-secondary w-full justify-start"><Download className="w-4 h-4 mr-2" /> Export Settings</button>
        <label className="btn-secondary w-full justify-start cursor-pointer"><Upload className="w-4 h-4 mr-2" /> Import Settings <input type="file" accept=".json" onChange={handleImportSettings} className="hidden" /></label>
        <button onClick={handleResetSettings} className="btn-danger w-full justify-start"><RotateCcw className="w-4 h-4 mr-2" /> Reset All Settings</button>
        <button className="btn-danger w-full justify-start"><Trash2 className="w-4 h-4 mr-2" /> Clear All Data (Demo)</button>
      </div>
    </Section>

    <Section title="About" icon={<HelpCircle className="w-5 h-5" />}>
      <div className="space-y-2 text-[var(--text-dim)]">
        <div className="flex justify-between"><span>Version</span><span className="font-mono">1.0.0-demo</span></div>
        <div className="flex justify-between"><span>Build</span><span className="font-mono">UKH Induction Day 2026</span></div>
        <div className="flex justify-between"><span>Engine</span><span className="font-mono">chess.js v1.0</span></div>
        <div className="flex justify-between"><span>UI</span><span className="font-mono">React 19 + Tailwind + Framer Motion</span></div>
        <div className="flex justify-between"><span>Mode</span><span className="font-mono">Offline Demo (No Backend)</span></div>
      </div>
    </Section>
  </>
);

