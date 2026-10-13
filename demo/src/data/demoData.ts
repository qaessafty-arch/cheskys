import { Player, TimeControl, Tournament, TournamentMatch, GameState, ChatMessage, Notification, DemoSettings } from '../types/chess';

export const DEMO_PLAYERS: Player[] = [
  { uid: 'demo-1', name: 'Ren Barzani', elo: 1428, country: 'IQ', flag: '🇮🇶', avatar: 'ukh', online: true },
  { uid: 'demo-2', name: 'KnightMaster', elo: 1441, country: 'DE', flag: '🇩🇪', avatar: 'neo', online: true },
  { uid: 'demo-3', name: 'SaraChess', elo: 1567, country: 'IQ', flag: '🇮🇶', avatar: 'peshmerga', online: true },
  { uid: 'demo-4', name: 'Dilan', elo: 1290, country: 'SE', flag: '🇸🇪', avatar: 'classic', online: false },
  { uid: 'demo-5', name: 'GM Magnus K.', elo: 2842, country: 'NO', flag: '🇳🇴', avatar: 'fide_3d', online: true },
  { uid: 'demo-6', name: 'GM Hikaru N.', elo: 2820, country: 'US', flag: '🇺🇸', avatar: 'crystal_neon', online: true },
  { uid: 'demo-7', name: 'PeshmergaKnight', elo: 2410, country: 'IQ', flag: '☀️', avatar: 'peshmerga', online: true },
  { uid: 'demo-8', name: 'ArbilTactician', elo: 2395, country: 'IQ', flag: '☀️', avatar: 'ukh', online: true },
  { uid: 'demo-9', name: 'IM Elena_V', elo: 2490, country: 'ES', flag: '🇪🇸', avatar: 'vintage', online: true },
  { uid: 'demo-10', name: 'GM Alireza_F', elo: 2785, country: 'FR', flag: '🇫🇷', avatar: 'fide_3d', online: true },
];

export const DEMO_TIME_CONTROLS: TimeControl[] = [
  { id: 'bullet-1-0', name: 'Bullet 1+0', initialSeconds: 60, incrementSeconds: 0 },
  { id: 'blitz-3-0', name: 'Blitz 3+0', initialSeconds: 180, incrementSeconds: 0 },
  { id: 'blitz-3-2', name: 'Blitz 3+2', initialSeconds: 180, incrementSeconds: 2 },
  { id: 'blitz-5-3', name: 'Blitz 5+3', initialSeconds: 300, incrementSeconds: 3 },
  { id: 'rapid-10-0', name: 'Rapid 10+0', initialSeconds: 600, incrementSeconds: 0 },
  { id: 'rapid-15-10', name: 'Rapid 15+10', initialSeconds: 900, incrementSeconds: 10 },
  { id: 'classical-30-0', name: 'Classical 30+0', initialSeconds: 1800, incrementSeconds: 0 },
];

export const DEMO_TOURNAMENT: Tournament = {
  id: 'ukh-cup-2026',
  name: 'UKH INDIVIDUAL CHESS CUP 2026',
  format: 'swiss',
  timeControl: DEMO_TIME_CONTROLS[3],
  maxPlayers: 64,
  registeredCount: 32,
  status: 'registration',
  startTime: '2026-10-15T14:00:00Z',
  rounds: 6,
  currentRound: 0,
  prizePool: '10,000 XP + Champion Badge',
  bracket: [
    { id: 'm1', round: 1, white: { name: 'Ren Barzani', elo: 1428, wins: 0 }, black: { name: 'Ali Hassan', elo: 1380, wins: 0 }, status: 'pending' },
    { id: 'm2', round: 1, white: { name: 'Sara Ahmed', elo: 1567, wins: 0 }, black: { name: 'Dilan Omar', elo: 1290, wins: 0 }, status: 'pending' },
    { id: 'm3', round: 1, white: { name: 'KnightMaster', elo: 1441, wins: 0 }, black: { name: 'Chen Wei', elo: 1410, wins: 0 }, status: 'pending' },
    { id: 'm4', round: 1, white: { name: 'GM Magnus K.', elo: 2842, wins: 0 }, black: { name: 'Qualifier', elo: 1800, wins: 0 }, status: 'pending' },
  ],
};

export const DEMO_GAMES: GameState[] = [
  {
    id: 'demo-game-1',
    white: DEMO_PLAYERS[0],
    black: DEMO_PLAYERS[1],
    timeControl: DEMO_TIME_CONTROLS[2],
    whiteTime: 180000,
    blackTime: 180000,
    activeColor: 'w',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    pgn: '[Event "Quick Match"]\n[Site "Chesskys Demo"]\n[Date "2026.10.09"]\n[Round "1"]\n[White "Ren Barzani"]\n[Black "KnightMaster"]\n[Result "*"]\n[TimeControl "180+2"]\n\n*',
    moves: [],
    status: 'in_progress',
    lastMove: undefined,
  },
];

export const DEMO_CHAT_MESSAGES: ChatMessage[] = [
  { id: 'c1', senderId: 'demo-2', senderName: 'KnightMaster', message: 'Good luck!', timestamp: Date.now() - 300000, isSystem: false },
  { id: 'c2', senderId: 'demo-1', senderName: 'Ren Barzani', message: 'You too!', timestamp: Date.now() - 290000, isSystem: false },
  { id: 'c3', senderId: 'system', senderName: 'System', message: 'Game started. White to move.', timestamp: Date.now() - 280000, isSystem: true },
];

export const DEMO_NOTIFICATIONS: Notification[] = [
  { id: 'n1', type: 'challenge', title: 'New Challenge', message: 'KnightMaster challenged you to a Blitz 3+2 game', timestamp: Date.now() - 120000, read: false, actionUrl: '/play/demo-game-2' },
  { id: 'n2', type: 'friend_request', title: 'Friend Request', message: 'SaraChess sent you a friend request', timestamp: Date.now() - 3600000, read: false, actionUrl: '/profile' },
  { id: 'n3', type: 'achievement', title: 'Achievement Unlocked', message: '🔥 5-game winning streak!', timestamp: Date.now() - 86400000, read: true },
  { id: 'n4', type: 'tournament', title: 'Tournament Starting Soon', message: 'UKH Individual Chess Cup begins in 2 hours', timestamp: Date.now() - 7200000, read: false, actionUrl: '/tournaments' },
];

export const DEFAULT_DEMO_SETTINGS: DemoSettings = {
  boardTheme: 'ukh',
  pieceTheme: 'ukh',
  showCoordinates: true,
  showLegalMoves: true,
  highlightLastMove: true,
  confirmMoves: false,
  autoQueen: true,
  soundEnabled: true,
  moveSound: true,
  captureSound: true,
  checkSound: true,
  gameOverSound: true,
  difficulty: 'medium',
  presentationMode: false,
  isFlipped: false,
  showWeather: false,
  showTerritory: false,
  is3dPerspective: false,
  showGameOverOverlay: true,
};

export const BOARD_THEMES: BoardThemeId[] = [
  { id: 'ukh', name: '🎓 UKH Chancellor', light: '#E8EEF5', dark: '#1A3B5C', lightText: '#E8EEF5', darkText: '#1A3B5C', border: '#D4AF37', glow: 'shadow-[0_0_35px_rgba(229,169,59,0.38)]', marker: 'bg-[var(--secondary-accent)]/30', captureRing: 'border-[var(--secondary-accent)]/30' },
  { id: 'peshmerga', name: '☀️ Peshmerga Tactical', light: '#DFD0B0', dark: '#435433', lightText: '#DFD0B0', darkText: '#435433', border: '#8C2425', glow: 'shadow-[0_0_35px_rgba(245,196,83,0.35)]', marker: 'bg-[var(--secondary-accent)]/30', captureRing: 'border-[var(--secondary-accent)]/30' },
  { id: 'aot', name: '⚔️ Wall Maria (AoT)', light: '#1C221A', dark: '#4A5D43', lightText: '#4A5D43', darkText: '#1C221A', border: '#2B3827', glow: 'shadow-[0_0_35px_rgba(74,93,67,0.45)]' },
  { id: 'wall-maria', name: '🏰 Wall Maria', light: '#1C221A', dark: '#4A5D43', lightText: '#4A5D43', darkText: '#1C221A', border: '#2B3827', glow: 'shadow-[0_0_35px_rgba(74,93,67,0.45)]' },
  { id: 'classic', name: 'Classic', light: '#F0D9B5', dark: '#B58863', lightText: '#F0D9B5', darkText: '#B58863', border: '#8B5A2B', glow: 'shadow-[0_0_25px_rgba(181,136,99,0.3)]' },
  { id: 'obsidian', name: '⚫ Obsidian', light: '#27272A', dark: '#09090B', lightText: '#A1A1AA', darkText: '#3F3F46', border: '#3F3F46', glow: 'shadow-[0_0_50px_rgba(245,158,11,0.08)]', marker: 'bg-[var(--secondary-accent)]/30', captureRing: 'border-[var(--secondary-accent)]/30' },
  { id: 'one-piece', name: '🏴‍☠️ One Piece', light: '#0B1D3A', dark: '#D4A359', lightText: '#D4A359', darkText: '#0B1D3A', border: '#A855F7', glow: 'shadow-[0_0_40px_rgba(168,85,247,0.5)]' },
  { id: 'batman', name: '🦇 Batman Gotham', light: '#39445A', dark: '#0E141D', lightText: '#0D1117', darkText: '#FACC15', border: '#FACC15', glow: 'shadow-[0_0_35px_rgba(250,204,21,0.45)]' },
  { id: 'gotham-city', name: '🌃 Gotham City', light: '#39445A', dark: '#0E141D', lightText: '#0D1117', darkText: '#FACC15', border: '#FACC15', glow: 'shadow-[0_0_35px_rgba(250,204,21,0.45)]' },
  { id: 'emerald', name: 'Emerald Tournament', light: '#EEEED2', dark: '#769656', lightText: '#EEEED2', darkText: '#769656', border: '#4A6333', glow: 'shadow-[0_0_30px_rgba(118,150,86,0.25)]' },
  { id: 'wood', name: '🪵 Warm Walnut', light: '#E2C499', dark: '#9C6A38', lightText: '#E2C499', darkText: '#9C6A38', border: '#5E381B', glow: 'shadow-[0_0_30px_rgba(156,106,56,0.3)]' },
  { id: 'ocean', name: '🌊 Ocean Breeze', light: '#DEE3E6', dark: '#678292', lightText: '#DEE3E6', darkText: '#678292', border: '#3F525D', glow: 'shadow-[0_0_30px_rgba(103,130,146,0.3)]' },
  { id: 'midnight', name: '🌙 Midnight Slate', light: '#1A1A2E', dark: '#16213E', lightText: '#4E5D7A', darkText: '#0F3460', border: '#0F3460', glow: 'shadow-[0_0_50px_rgba(15,52,96,0.4)]', marker: 'bg-blue-400/30', captureRing: 'border-blue-400/40' },
  { id: 'premium', name: '💎 Premium', light: '#1E293B', dark: '#0F172A', lightText: '#94A3B8', darkText: '#94A3B8', border: '#334155', glow: 'shadow-[0_20px_50px_rgba(0,0,0,0.5)]', marker: 'bg-emerald-400/40', captureRing: 'border-emerald-400/50' },
  { id: 'marble', name: '🏛️ Royal Marble', light: '#E8EBF0', dark: '#8CA2B0', lightText: '#E8EBF0', darkText: '#8CA2B0', border: '#596D79', glow: 'shadow-[0_0_30px_rgba(140,162,176,0.3)]' },
  { id: 'custom', name: 'Theme Matched', light: 'var(--board-light)', dark: 'var(--board-dark)', lightText: 'var(--board-light)', darkText: 'var(--board-dark)', border: 'var(--board-border)', glow: 'shadow-[0_0_30px_var(--accent-glow,rgba(59,130,246,0.35))]' },
];

export const PIECE_THEMES: PieceThemeId[] = [
  { id: 'ukh', name: '🎓 UKH Chancellor', tag: 'ACADEMIC', desc: 'University regalia, academic gold torches & navy silhouettes', icon: '🎓' },
  { id: 'peshmerga', name: '☀️ Peshmerga Royal', tag: 'SIGNATURE', desc: 'Kurdish 21-ray sun, Khanjar crests, gold/crimson trim', icon: '☀️' },
  { id: 'aot', name: '⚔️ Attack on Titan', tag: 'ANIME / DARK FANTASY', desc: 'Scouts vs Nine Titans (Colossal, Armored, Female, Beast)', icon: '⚔️' },
  { id: 'one-piece', name: '🏴‍☠️ One Piece', tag: 'ANIME', desc: 'Straw Hats vs Marines (Luffy, Zoro, Sanji vs Akainu, Kaido)', icon: '🏴‍☠️' },
  { id: 'batman', name: '🦇 Batman Gotham', tag: 'DARK HERO', desc: 'Heroes vs Villains (Batman, Robin vs Joker, Bane, Penguin)', icon: '🦇' },
  { id: 'aot', name: '⚔️ Attack on Titan', tag: 'ANIME / DARK FANTASY', desc: 'Scouts vs Nine Titans (Colossal, Armored, Female, Beast)', icon: '⚔️' },
  { id: 'one-piece', name: '🏴‍☠️ One Piece', tag: 'ANIME', desc: 'Straw Hats vs Marines', icon: '🏴‍☠️' },
  { id: 'crystal_neon', name: '💎 Crystal Glass & Neon', tag: 'GLOW', desc: 'Translucent glowing neon-infused laser vector shapes', icon: '💎' },
  { id: 'fide_3d', name: '👑 FIDE 3D Staunton', tag: 'OFFICIAL', desc: 'Official tournament 3D shaded piece set modeled after WCC pieces', icon: '👑' },
  { id: 'classic', name: 'Classic Staunton (Flat)', tag: 'STANDARD', desc: 'Clean, minimalist vector Staunton tournament pieces', icon: '♟️' },
  { id: 'vintage', name: 'Vintage Carved Wood', tag: 'WARM', desc: 'Antiqued amber and sepia tournament wooden finish', icon: '🪵' },
  { id: 'neo', name: 'Neo Azure Modern', tag: 'CLEAN', desc: 'High contrast electric slate vector silhouettes', icon: '⚡' },
  { id: 'custom', name: 'Custom Upload', tag: 'PERSONAL', desc: 'Your own SVG/PNG piece set', icon: '🎨' },
];

export const DEMO_BOT_CONFIG = {
  easy: { name: 'UKH Bot (Beginner)', rating: 1000, moveDelay: 800, strategy: 'random_legal' },
  medium: { name: 'UKH Bot (Club)', rating: 1450, moveDelay: 1200, strategy: 'capture_center_control' },
  hard: { name: 'UKH Bot (Expert)', rating: 1800, moveDelay: 1500, strategy: 'minimax_depth_2' },
};

export function getRandomPlayer(excludeUid?: string): Player {
  const available = DEMO_PLAYERS.filter(p => p.uid !== excludeUid && p.online);
  return available[Math.floor(Math.random() * available.length)];
}

export function getMockOpponent(difficulty: 'easy' | 'medium' | 'hard'): Player {
  const config = DEMO_BOT_CONFIG[difficulty];
  return {
    uid: `bot-${difficulty}`,
    name: config.name,
    elo: config.rating,
    country: 'IQ',
    flag: '🤖',
    avatar: 'ukh',
    online: true,
  };
}