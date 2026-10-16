export type PieceColor = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Square = string;
export type GameMode = 'quick' | 'create' | 'join' | 'tournament' | 'puzzle';

export interface BoardThemeId {
  id: string;
  name: string;
  light: string;
  dark: string;
  lightText: string;
  darkText: string;
  border: string;
  glow: string;
  marker?: string;
  captureRing?: string;
}

export interface PieceThemeId {
  id: string;
  name: string;
  tag: string;
  desc: string;
  icon: string;
}

export interface TimeControl {
  id: string;
  name: string;
  initialSeconds: number;
  incrementSeconds: number;
}

export interface Player {
  uid: string;
  name: string;
  elo: number;
  country: string;
  flag: string;
  avatar: string;
  online: boolean;
}

export interface GameState {
  id: string;
  white: Player;
  black: Player;
  timeControl: TimeControl;
  whiteTime: number;
  blackTime: number;
  activeColor: PieceColor;
  fen: string;
  pgn: string;
  moves: string[];
  status: 'waiting' | 'in_progress' | 'checkmate' | 'draw' | 'resigned' | 'timeout';
  result?: '1-0' | '0-1' | '1/2-1/2';
  lastMove?: { from: string; to: string };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: number;
  isSystem: boolean;
}

export interface Notification {
  id: string;
  type: 'challenge' | 'friend_request' | 'achievement' | 'tournament';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
}

export interface Tournament {
  id: string;
  name: string;
  format: 'swiss' | 'round_robin' | 'elimination' | 'arena';
  timeControl: TimeControl;
  maxPlayers: number;
  registeredCount: number;
  status: 'registration' | 'in_progress' | 'completed';
  startTime: string;
  rounds: number;
  currentRound: number;
  prizePool: string;
  bracket: TournamentMatch[];
}

export interface TournamentMatch {
  id: string;
  round: number;
  white: { name: string; elo: number; wins: number };
  black: { name: string; elo: number; wins: number };
  status: 'pending' | 'active' | 'completed';
  winner?: 'white' | 'black' | 'draw';
}

export type BoardThemeName = 'obsidian' | 'one-piece' | 'batman' | 'gotham-city' | 'aot' | 'wall-maria' | 'classic' | 'peshmerga' | 'ukh' | 'emerald' | 'wood' | 'ocean' | 'midnight' | 'premium' | 'marble' | 'custom';
export type PieceThemeName = 'peshmerga' | 'ukh' | 'aot' | 'one-piece' | 'batman' | 'crystal_neon' | 'fide_3d' | 'classic' | 'vintage' | 'neo' | 'custom';

export interface DemoSettings {
  boardTheme: BoardThemeName;
  pieceTheme: PieceThemeName;
  showCoordinates: boolean;
  showLegalMoves: boolean;
  highlightLastMove: boolean;
  confirmMoves: boolean;
  autoQueen: boolean;
  soundEnabled: boolean;
  moveSound: boolean;
  captureSound: boolean;
  checkSound: boolean;
  gameOverSound: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  presentationMode: boolean;
  isFlipped: boolean;
  showWeather: boolean;
  showTerritory: boolean;
  is3dPerspective: boolean;
  showGameOverOverlay: boolean;
}

export interface MoveLog {
  san: string;
  classification?: MoveClassification;
  from: string;
  to: string;
  piece: string;
  captured?: PieceType;
  evaluation?: number;
}

export type MoveClassification = 'brilliant' | 'best' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'blunder';

export interface OpeningInfo {
  eco: string;
  name: string;
}

export interface MoveLog {
  san: string;
  classification?: MoveClassification;
  from: string;
  to: string;
  piece: string;
  captured?: PieceType;
  evaluation?: number;
}

export interface OnlineMatchSession {
  id: string;
  hostId?: string;
  whiteId?: string;
  blackId?: string;
  whitePlayer?: { uid: string; displayName: string; elo: number; photoURL?: string; avatar?: string; country?: string; flag?: string };
  blackPlayer?: { uid: string; displayName: string; elo: number; photoURL?: string; avatar?: string; country?: string; flag?: string };
  fen: string;
  pgn: string;
  turn: 'w' | 'b';
  status: 'waiting' | 'ready' | 'in_progress' | 'checkmate' | 'draw' | 'resigned' | 'timeout' | 'aborted' | 'completed';
  winner?: 'w' | 'b' | 'draw' | null;
  reason?: string;
  timeControl: TimeControl;
  whiteSecondsRemaining?: number;
  blackSecondsRemaining?: number;
  moves: string[];
  moveCount: number;
  drawOfferFrom?: string;
  rematchOfferFrom?: string;
  guestId?: string;
}