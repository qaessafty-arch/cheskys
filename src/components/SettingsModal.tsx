import React, { useState, useEffect } from 'react';
import { AppSettings, BoardThemeId, PieceThemeId, AuthoredPuzzle } from '../types/chess';
import { UITheme } from '../types/theme';
import { 
  Volume2, 
  VolumeX, 
  Check, 
  X, 
  Palette, 
  Plus, 
  Trash2, 
  Edit3, 
  Sparkles, 
  Layers, 
  Sliders,
  Copy,
  ChevronRight,
  Crown,
  MessageSquare,
  Shield,
  Zap,
  Lock,
  Unlock,
  Database,
  History,
  PenTool,
  ExternalLink,
  HelpCircle,
  Eye,
  RotateCcw
} from 'lucide-react';
import { 
  PRESET_THEMES, 
  getSavedCustomThemes, 
  deleteCustomTheme, 
  getActiveThemeId, 
  setActiveThemeId, 
  applyThemeToDOM,
  saveCustomTheme,
  hexToRgba
} from '../utils/themePresets';
import { CustomThemeModal } from './CustomThemeModal';
import { FeedbackModal } from './FeedbackModal';
import { DeveloperSettingsModal } from './DeveloperSettingsModal';
import { DatabaseView } from './DatabaseView';
import { LoggingView } from './LoggingView';
import { AuthoringView } from './AuthoringView';
import { useAuth } from '../context/AuthContext';

export type SettingsTab = 'themes' | 'board' | 'gameplay' | 'database' | 'logs' | 'authoring' | 'developer' | 'feedback';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onThemeChange?: (theme: UITheme) => void;
  initialTab?: SettingsTab;
  onSelectPuzzleToSolve?: (puzzle: AuthoredPuzzle) => void;
  onOpenAnalysisWithFen?: (fen: string) => void;
}

const BOARD_THEMES: { id: BoardThemeId; name: string; lightBg: string; darkBg: string; desc: string }[] = [
  { id: 'aot', name: '⚔️ Wall Maria & Survey Corps', lightBg: '#5d6f54', darkBg: '#1f232b', desc: 'Weathered Dark Stone & Survey Corps Green' },
  { id: 'peshmerga', name: '☀️ Peshmerga Tactical', lightBg: '#DFD0B0', darkBg: '#435433', desc: 'Sandstone Khaki & Military Olive' },
  { id: 'ukh', name: '🎓 UKH Chancellor', lightBg: '#E8EEF5', darkBg: '#1A3B5C', desc: 'Parchment White & Chancellor Navy' },
  { id: 'emerald', name: 'Emerald Tournament', lightBg: '#eeeed2', darkBg: '#769656', desc: 'Classic FIDE Green' },
  { id: 'wood', name: 'Warm Walnut', lightBg: '#e2c499', darkBg: '#9c6a38', desc: 'Handcrafted Hardwood' },
  { id: 'ocean', name: 'Ocean Breeze', lightBg: '#dee3e6', darkBg: '#678292', desc: 'Maritime Slate' },
  { id: 'midnight', name: 'Midnight Slate', lightBg: '#334155', darkBg: '#0f172a', desc: 'Deep Obsidian' },
  { id: 'marble', name: 'Royal Marble', lightBg: '#e8ebf0', darkBg: '#8ca2b0', desc: 'Polished Alabaster' },
  { id: 'custom', name: 'Theme Matched', lightBg: 'var(--board-light)', darkBg: 'var(--board-dark)', desc: 'Synchronized with UI Palette' }
];

const PIECE_THEMES: { id: PieceThemeId; name: string; tag: string; desc: string; icon: string }[] = [
  { 
    id: 'aot', 
    name: '⚔️ Attack on Titan (Scouts vs Titans)', 
    tag: 'ANIME / DARK FANTASY',
    desc: 'White Scout Regiment (Wings of Freedom, ODM Blades, Scarf) vs Black Nine Titans (Colossal, Armored, Female, Beast)',
    icon: '⚔️'
  },
  { 
    id: 'peshmerga', 
    name: '☀️ Peshmerga Royal (Kurdish)', 
    tag: 'SIGNATURE',
    desc: 'Custom vector silhouettes with Kurdish 21-ray sun, Khanjar crests, and gold/crimson trim',
    icon: '☀️'
  },
  { 
    id: 'ukh', 
    name: '🎓 UKH Chancellor Set', 
    tag: 'ACADEMIC',
    desc: 'University of Kurdistan Hewlêr chancellor regalia, academic gold torches & navy silhouettes',
    icon: '🎓'
  },
  { 
    id: 'crystal_neon', 
    name: '💎 Crystal Glass & Neon', 
    tag: 'GLOW',
    desc: 'Translucent glowing neon-infused laser vector shapes',
    icon: '💎'
  },
  { 
    id: 'fide_3d', 
    name: '👑 Classic FIDE Staunton 3D', 
    tag: 'OFFICIAL',
    desc: 'Official tournament 3D shaded piece set modeled after World Chess Championship pieces',
    icon: '👑'
  },
  { 
    id: 'classic', 
    name: 'Classic Staunton (Flat)', 
    tag: 'STANDARD',
    desc: 'Clean, minimalist vector Staunton tournament pieces',
    icon: '♟️'
  },
  { 
    id: 'vintage', 
    name: 'Vintage Carved Wood', 
    tag: 'WARM',
    desc: 'Antiqued amber and sepia tournament wooden finish',
    icon: '🪵'
  },
  { 
    id: 'neo', 
    name: 'Neo Azure Modern', 
    tag: 'CLEAN',
    desc: 'High contrast electric slate vector silhouettes',
    icon: '⚡'
  }
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onThemeChange,
  initialTab = 'themes',
  onSelectPuzzleToSolve,
  onOpenAnalysisWithFen
}) => {
  const { isDeveloper, isOwner, isAdmin, devModeUnlocked } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [customThemes, setCustomThemes] = useState<UITheme[]>([]);
  const [activeThemeId, setActiveTheme] = useState<string>('peshmerga');
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<UITheme | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isDevSettingsOpen, setIsDevSettingsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCustomThemes(getSavedCustomThemes());
      setActiveTheme(getActiveThemeId());
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleSelectTheme = (theme: UITheme) => {
    setActiveTheme(theme.id);
    setActiveThemeId(theme.id);
    applyThemeToDOM(theme);
    if (theme.id === 'aot') {
      onUpdateSettings({ uiThemeId: theme.id, boardTheme: 'aot', pieceTheme: 'aot' });
    } else if (theme.id === 'ukh') {
      onUpdateSettings({ uiThemeId: theme.id, boardTheme: 'ukh', pieceTheme: 'ukh' });
    } else if (theme.id === 'peshmerga') {
      onUpdateSettings({ uiThemeId: theme.id, boardTheme: 'peshmerga', pieceTheme: 'peshmerga' });
    } else if (theme.isCustom) {
      onUpdateSettings({ uiThemeId: theme.id, boardTheme: 'custom' });
    } else {
      onUpdateSettings({ uiThemeId: theme.id });
    }
    if (onThemeChange) {
      onThemeChange(theme);
    }
  };

  const handleThemeCreated = (newTheme: UITheme) => {
    setCustomThemes(getSavedCustomThemes());
    handleSelectTheme(newTheme);
  };

  const handleDeleteCustom = (e: React.MouseEvent, themeId: string) => {
    e.stopPropagation();
    if (confirm('Delete this custom theme?')) {
      const updated = deleteCustomTheme(themeId);
      setCustomThemes(updated);
      if (activeThemeId === themeId) {
        handleSelectTheme(PRESET_THEMES[0]);
      }
    }
  };

  const handleDuplicateCustom = (e: React.MouseEvent, theme: UITheme) => {
    e.stopPropagation();
    const cloned: UITheme = {
      ...theme,
      id: `custom-${Date.now()}`,
      name: `${theme.name} (Copy)`,
      isCustom: true
    };
    const updated = saveCustomTheme(cloned);
    setCustomThemes(updated);
    handleSelectTheme(cloned);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl animate-in fade-in duration-200 p-2 sm:p-4">
        <div className={`relative glass-panel rounded-3xl p-4 sm:p-6 w-full shadow-2xl overflow-y-auto max-h-[94vh] border border-[#F5C453]/30 transition-all flex flex-col justify-between ${
          activeTab === 'database' || activeTab === 'logs' || activeTab === 'authoring' 
            ? 'max-w-5xl' 
            : 'max-w-2xl'
        }`}>
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#F5C453]/10 rounded-full blur-3xl pointer-events-none" />

          <div>
            {/* Header Ribbon */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-2xl bg-[#52673A]/40 border border-[#F5C453]/40 text-[#F5C453] shadow-md flex-shrink-0">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#FDFCF7] tracking-tight">
                    Settings & Studio Hub
                  </h2>
                  <p className="text-xs text-[#DFD0B0]/70">
                    Organize your theme palettes, vector pieces, database, battle logs, and creator tools
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="text-white/50 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close Settings"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Divided Categorized Tab Navigation */}
            <div className="space-y-2 mb-5">
              {/* Category 1: Preferences & Customization */}
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#141a10]/90 border border-white/10 backdrop-blur-md overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setActiveTab('themes')}
                  className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'themes'
                      ? 'bg-[#52673A] text-white shadow-md shadow-[#52673A]/40 border border-[#F5C453]/50'
                      : 'text-[#DFD0B0]/70 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <Palette className="w-3.5 h-3.5 text-[#F5C453]" />
                  <span>UI Themes</span>
                </button>

                <button
                  onClick={() => setActiveTab('board')}
                  className={`flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'board'
                      ? 'bg-[#52673A] text-white shadow-md shadow-[#52673A]/40 border border-[#F5C453]/50'
                      : 'text-[#DFD0B0]/70 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-[#F5C453]" />
                  <span>Piece & Board</span>
                </button>

                <button
                  onClick={() => setActiveTab('gameplay')}
                  className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'gameplay'
                      ? 'bg-[#52673A] text-white shadow-md shadow-[#52673A]/40 border border-[#F5C453]/50'
                      : 'text-[#DFD0B0]/70 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 text-[#F5C453]" />
                  <span>Gameplay</span>
                </button>

                <button
                  onClick={() => setActiveTab('database')}
                  className={`flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'database'
                      ? 'bg-gradient-to-r from-emerald-800 to-[#52673A] text-white shadow-md border border-emerald-400/60'
                      : 'text-emerald-300/80 hover:text-emerald-200 hover:bg-emerald-950/40'
                  }`}
                >
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Database</span>
                </button>

                <button
                  onClick={() => setActiveTab('logs')}
                  className={`flex-1 min-w-[105px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'logs'
                      ? 'bg-[#8C2425] text-white shadow-md border border-[#F5C453]/60'
                      : 'text-[#DFD0B0]/70 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <History className="w-3.5 h-3.5 text-amber-300" />
                  <span>Battle Logs</span>
                </button>

                <button
                  onClick={() => setActiveTab('authoring')}
                  className={`flex-1 min-w-[115px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'authoring'
                      ? 'bg-[#52673A] text-white shadow-md border border-[#F5C453]/60'
                      : 'text-[#DFD0B0]/70 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5 text-[#F5C453]" />
                  <span>Creator Studio</span>
                </button>
              </div>
            </div>

            {/* TAB 1: UI THEMES */}
            {activeTab === 'themes' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* Header with Custom Theme Creator trigger */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Curated Themes
                    </h3>
                    <p className="text-[11px] text-[#DFD0B0]/70">
                      Signature Kurdish military and high-contrast grandmaster palettes
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingTheme(null);
                      setIsCustomModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-[#52673A] text-white text-xs font-bold shadow-md shadow-[#52673A]/30 border border-[#F5C453]/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#F5C453]" />
                    <span>Create Custom</span>
                  </button>
                </div>

                {/* Pre-made themes grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PRESET_THEMES.map(theme => {
                    const isSelected = activeThemeId === theme.id;
                    const c = theme.colors;
                    const isPeshmerga = theme.id === 'peshmerga';

                    return (
                      <div
                        key={theme.id}
                        onClick={() => handleSelectTheme(theme)}
                        className={`group relative p-3.5 rounded-2xl border transition-all cursor-pointer backdrop-blur-md overflow-hidden ${
                          isSelected
                            ? 'bg-[#52673A]/30 border-[#F5C453] shadow-lg shadow-[#F5C453]/15 ring-1 ring-[#F5C453]'
                            : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] hover:border-white/20'
                        }`}
                      >
                        {/* Theme Ambient Glow */}
                        <div 
                          className="absolute -top-10 -right-10 w-24 h-24 rounded-full pointer-events-none filter blur-xl opacity-30 group-hover:opacity-60 transition-opacity"
                          style={{ backgroundColor: c.secondary || c.primary }}
                        />

                        <div className="flex items-start justify-between gap-2 mb-2 relative z-10">
                          <div className="flex items-center gap-2">
                            {/* Color Palette Swatches */}
                            <div className="flex items-center -space-x-1.5">
                              <span 
                                className="w-4 h-4 rounded-full border border-black/40 shadow-sm"
                                style={{ backgroundColor: c.primary }}
                              />
                              <span 
                                className="w-4 h-4 rounded-full border border-black/40 shadow-sm"
                                style={{ backgroundColor: c.secondary }}
                              />
                              <span 
                                className="w-4 h-4 rounded-full border border-white/30 shadow-sm"
                                style={{ backgroundColor: c.appBg }}
                              />
                            </div>
                            <span className="text-xs font-black text-white group-hover:text-[#F5C453] transition-colors">
                              {theme.name}
                            </span>
                          </div>

                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-[#F5C453] flex items-center justify-center text-[#10140e] shadow-sm shrink-0">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>

                        <p className="text-[11px] text-[#DFD0B0]/80 line-clamp-2 mb-3 relative z-10 leading-relaxed">
                          {theme.description}
                        </p>

                        {/* Mini Preview Bar */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/10 relative z-10">
                          <div className="flex items-center gap-1.5">
                            {isPeshmerga ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F5C453]/20 text-[#F5C453] border border-[#F5C453]/30 flex items-center gap-1">
                                <span>🔒 Protected Original</span>
                              </span>
                            ) : (
                              <span 
                                className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold text-white"
                                style={{ backgroundColor: hexToRgba(c.primary, 0.35), color: c.secondary || c.primary }}
                              >
                                Preset
                              </span>
                            )}
                            <div 
                              className="w-4 h-4 rounded border grid grid-cols-2 grid-rows-2"
                              style={{ borderColor: c.boardBorder || c.primary }}
                            >
                              <div style={{ backgroundColor: c.boardLight || '#DFD0B0' }} />
                              <div style={{ backgroundColor: c.boardDark || '#435433' }} />
                              <div style={{ backgroundColor: c.boardDark || '#435433' }} />
                              <div style={{ backgroundColor: c.boardLight || '#DFD0B0' }} />
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTheme(theme);
                              setIsCustomModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-[#DFD0B0] hover:text-white font-medium flex items-center gap-1.5 transition-all border border-white/10 hover:border-[#F5C453]/40 cursor-pointer"
                            title="Create an editable custom copy of this theme"
                          >
                            <Copy className="w-3 h-3 text-[#F5C453]" />
                            <span>Copy & Customize</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* User Custom Themes Section */}
                <div className="pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      My Custom Themes ({customThemes.length})
                    </h3>
                  </div>

                  {customThemes.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/15 text-center">
                      <p className="text-xs text-[#DFD0B0]/60 mb-3">
                        Tailor your own Kurdish military variants, ambient colors, and chessboard tones!
                      </p>
                      <button
                        onClick={() => {
                          setEditingTheme(null);
                          setIsCustomModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-white font-bold text-xs transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#F5C453]" />
                        <span>Build Custom Theme</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {customThemes.map(theme => {
                        const isSelected = activeThemeId === theme.id;
                        const c = theme.colors;
                        return (
                          <div
                            key={theme.id}
                            onClick={() => handleSelectTheme(theme)}
                            className={`group relative p-3.5 rounded-2xl border transition-all cursor-pointer backdrop-blur-md overflow-hidden ${
                              isSelected
                                ? 'bg-[#52673A]/30 border-[#F5C453] shadow-lg shadow-[#F5C453]/20 ring-1 ring-[#F5C453]'
                                : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center -space-x-1.5">
                                  <span 
                                    className="w-4 h-4 rounded-full border border-black/40 shadow-sm"
                                    style={{ backgroundColor: c.primary }}
                                  />
                                  <span 
                                    className="w-4 h-4 rounded-full border border-black/40 shadow-sm"
                                    style={{ backgroundColor: c.secondary }}
                                  />
                                  <span 
                                    className="w-4 h-4 rounded-full border border-white/30 shadow-sm"
                                    style={{ backgroundColor: c.appBg }}
                                  />
                                </div>
                                <span className="text-xs font-bold text-white">
                                  {theme.name}
                                </span>
                              </div>

                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-[#F5C453] flex items-center justify-center text-[#10140e] shadow-sm shrink-0">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-white/10">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTheme(theme);
                                    setIsCustomModalOpen(true);
                                  }}
                                  className="p-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.15] text-white/70 hover:text-white transition-colors cursor-pointer"
                                  title="Edit theme colors"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => handleDuplicateCustom(e, theme)}
                                  className="p-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.15] text-white/70 hover:text-white transition-colors cursor-pointer"
                                  title="Duplicate theme"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <button
                                onClick={(e) => handleDeleteCustom(e, theme.id)}
                                className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                                title="Delete custom theme"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: BOARD & PIECES */}
            {activeTab === 'board' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* Piece Theme Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-white/90 uppercase tracking-wider block font-ui">
                      Piece Vector Styles & Sets
                    </label>
                    <span className="text-[11px] text-[#F5C453] font-semibold">
                      Instant Vector Switcher
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {PIECE_THEMES.map(theme => {
                      const isSelected = settings.pieceTheme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          onClick={() => onUpdateSettings({ pieceTheme: theme.id })}
                          className={`p-3.5 rounded-2xl border transition-all text-left backdrop-blur-md relative overflow-hidden cursor-pointer ${
                            isSelected
                              ? 'bg-[#52673A]/40 border-[#F5C453] text-white shadow-lg shadow-[#F5C453]/20 ring-1 ring-[#F5C453]'
                              : 'bg-white/[0.04] border-white/10 text-white/70 hover:bg-white/[0.08] hover:text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xl select-none">{theme.icon}</span>
                              <span className="text-xs font-black text-white">{theme.name}</span>
                            </div>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-[#F5C453] text-black' : 'bg-white/10 text-white/70'
                            }`}>
                              {theme.tag}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#DFD0B0]/70 leading-relaxed">
                            {theme.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Board Theme Selection */}
                <div>
                  <label className="text-xs font-bold text-white/90 uppercase tracking-wider block mb-2 font-ui">
                    Chessboard Color Style
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {BOARD_THEMES.map(theme => {
                      const isSelected = settings.boardTheme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          onClick={() => onUpdateSettings({ boardTheme: theme.id })}
                          className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left backdrop-blur-md cursor-pointer ${
                            isSelected
                              ? 'bg-[#52673A]/40 border-[#F5C453] text-white shadow-sm'
                              : 'bg-white/[0.04] border-white/10 text-white/70 hover:bg-white/[0.08] hover:text-white'
                          }`}
                        >
                          <div className="w-9 h-9 rounded-xl overflow-hidden border border-white/20 grid grid-cols-2 grid-rows-2 shrink-0">
                            <div style={{ backgroundColor: theme.lightBg }} />
                            <div style={{ backgroundColor: theme.darkBg }} />
                            <div style={{ backgroundColor: theme.darkBg }} />
                            <div style={{ backgroundColor: theme.lightBg }} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{theme.name}</div>
                            <div className="text-[11px] text-[#DFD0B0]/60">
                              {theme.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: GAMEPLAY HELPERS */}
            {activeTab === 'gameplay' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md">
                  <div>
                    <div className="text-xs font-semibold text-white/90">Sound Effects & Audio</div>
                    <div className="text-[11px] text-[#DFD0B0]/60">Audio for moves, captures, checks, and game over</div>
                  </div>
                  <button
                    onClick={() => onUpdateSettings({ sound: !settings.sound })}
                    className={`w-11 h-6 rounded-full transition-colors relative border border-white/10 cursor-pointer ${
                      settings.sound ? 'bg-[#52673A]' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform transform shadow-sm ${
                        settings.sound ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md">
                  <div>
                    <div className="text-xs font-semibold text-white/90">Legal Move Highlights</div>
                    <div className="text-[11px] text-[#DFD0B0]/60">Display valid destination dots and capture rings</div>
                  </div>
                  <button
                    onClick={() => onUpdateSettings({ showLegalMoves: !settings.showLegalMoves })}
                    className={`w-11 h-6 rounded-full transition-colors relative border border-white/10 cursor-pointer ${
                      settings.showLegalMoves ? 'bg-[#52673A]' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform transform shadow-sm ${
                        settings.showLegalMoves ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md">
                  <div>
                    <div className="text-xs font-semibold text-white/90">Evaluation Bar</div>
                    <div className="text-[11px] text-[#DFD0B0]/60">Real-time advantage engine gauge on side of board</div>
                  </div>
                  <button
                    onClick={() => onUpdateSettings({ showEvalBar: !settings.showEvalBar })}
                    className={`w-11 h-6 rounded-full transition-colors relative border border-white/10 cursor-pointer ${
                      settings.showEvalBar ? 'bg-[#52673A]' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform transform shadow-sm ${
                        settings.showEvalBar ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md">
                  <div>
                    <div className="text-xs font-semibold text-white/90">Board Coordinates (Ranks & Files)</div>
                    <div className="text-[11px] text-[#DFD0B0]/60">Show 1-8 and a-h notation on board borders</div>
                  </div>
                  <button
                    onClick={() => onUpdateSettings({ showCoordinates: !settings.showCoordinates })}
                    className={`w-11 h-6 rounded-full transition-colors relative border border-white/10 cursor-pointer ${
                      settings.showCoordinates ? 'bg-[#52673A]' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform transform shadow-sm ${
                        settings.showCoordinates ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md">
                  <div>
                    <div className="text-xs font-semibold text-white/90">Highlight Last Move</div>
                    <div className="text-[11px] text-[#DFD0B0]/60">Soft highlight on origin and target squares</div>
                  </div>
                  <button
                    onClick={() => onUpdateSettings({ highlightLastMove: !settings.highlightLastMove })}
                    className={`w-11 h-6 rounded-full transition-colors relative border border-white/10 cursor-pointer ${
                      settings.highlightLastMove ? 'bg-[#52673A]' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform transform shadow-sm ${
                        settings.highlightLastMove ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: DATABASE EXPLORER */}
            {activeTab === 'database' && (
              <div className="animate-in fade-in duration-150">
                <DatabaseView />
              </div>
            )}

            {/* TAB 5: BATTLE LOGS */}
            {activeTab === 'logs' && (
              <div className="animate-in fade-in duration-150">
                <LoggingView 
                  settings={settings}
                  onOpenAnalysisWithFen={onOpenAnalysisWithFen}
                />
              </div>
            )}

            {/* TAB 6: CREATOR STUDIO */}
            {activeTab === 'authoring' && (
              <div className="animate-in fade-in duration-150">
                <AuthoringView
                  settings={settings}
                  onSelectPuzzleToSolve={onSelectPuzzleToSolve}
                  onOpenAnalysisWithFen={onOpenAnalysisWithFen}
                />
              </div>
            )}
          </div>

          {/* Divided Footer Actions (Feedback, Developer Controls & Save) */}
          <div className="pt-4 mt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsFeedbackOpen(true)}
                className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                <span>Send Feedback</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDevSettingsOpen(true)}
                className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5 text-[#F5C453]" />
                <span>Developer Settings</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#52673A] hover:bg-[#435433] text-white font-bold text-xs transition-all shadow-lg shadow-[#52673A]/30 border border-[#F5C453]/40 cursor-pointer"
            >
              Done & Save
            </button>
          </div>
        </div>
      </div>

      {/* Custom Theme Builder Sub-Modal */}
      <CustomThemeModal
        isOpen={isCustomModalOpen}
        onClose={() => {
          setIsCustomModalOpen(false);
          setEditingTheme(null);
        }}
        onThemeCreated={handleThemeCreated}
        initialTheme={editingTheme}
      />

      {/* User Feedback Submission Modal */}
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />

      {/* Developer Command Center Modal [Dev Set] */}
      <DeveloperSettingsModal
        isOpen={isDevSettingsOpen}
        onClose={() => setIsDevSettingsOpen(false)}
      />
    </>
  );
};
