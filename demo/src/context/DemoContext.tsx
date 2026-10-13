import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { DemoSettings, Player, GameState, ChatMessage, Notification, TimeControl, DEFAULT_DEMO_SETTINGS, BOARD_THEMES, PIECE_THEMES, DEMO_PLAYERS, getMockOpponent } from '../data/demoData';
import { generateGameRoomCode } from '../utils/chessEngine';
import { BoardThemeName, PieceThemeName } from '../types/chess';

interface DemoContextType {
  settings: DemoSettings;
  updateSettings: (settings: Partial<DemoSettings>) => void;
  currentUser: Player;
  currentGame: GameState | null;
  setCurrentGame: (game: GameState | null) => void;
  chatMessages: ChatMessage[];
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  notifications: Notification[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  unreadNotificationCount: number;
  matchmakingState: 'idle' | 'searching' | 'found' | 'error';
  setMatchmakingState: (state: 'idle' | 'searching' | 'found' | 'error') => void;
  matchmakingOpponent: Player | null;
  setMatchmakingOpponent: (opponent: Player | null) => void;
  createdRoomCode: string | null;
  setCreatedRoomCode: (code: string | null) => void;
  activeTab: 'dashboard' | 'play' | 'replay' | 'leaderboard' | 'tournaments' | 'profile' | 'settings' | 'landing';
  setActiveTab: (tab: DemoContextType['activeTab']) => void;
  viewMode: 'landing' | 'dashboard' | 'game' | 'replay' | 'leaderboard' | 'tournaments' | 'profile' | 'settings' | 'features';
  setViewMode: (mode: DemoContextType['viewMode']) => void;
  presentationMode: boolean;
  togglePresentationMode: () => void;
  pendingPromotion: { from: string; to: string; game: GameState } | null;
  setPendingPromotion: (promo: { from: string; to: string; game: GameState } | null) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  showLeaderboard: boolean;
  setShowLeaderboard: (show: boolean) => void;
  showProfile: boolean;
  setShowProfile: (show: boolean) => void;
  showTournaments: boolean;
  setShowTournaments: (show: boolean) => void;
  showNotifications: boolean;
  setShowNotifications: (show: boolean) => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export const useDemo = () => {
  const context = useContext(DemoContext);
  if (!context) throw new Error('useDemo must be used within DemoProvider');
  return context;
};

export const DemoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<DemoSettings>(() => {
    const saved = localStorage.getItem('chesskys-demo-settings');
    return saved ? { ...DEFAULT_DEMO_SETTINGS, ...JSON.parse(saved) } : DEFAULT_DEMO_SETTINGS;
  });

  const [currentUser] = useState<Player>(DEMO_PLAYERS[0]);
  const [currentGame, setCurrentGame] = useState<GameState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [matchmakingState, setMatchmakingState] = useState<'idle' | 'searching' | 'found' | 'error'>('idle');
  const [matchmakingOpponent, setMatchmakingOpponent] = useState<Player | null>(null);
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'play' | 'replay' | 'leaderboard' | 'tournaments' | 'profile' | 'settings' | 'landing'>('landing');
  const [viewMode, setViewMode] = useState<'landing' | 'dashboard' | 'game' | 'replay' | 'leaderboard' | 'tournaments' | 'profile' | 'settings' | 'features'>('landing');
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string; game: GameState } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showTournaments, setShowTournaments] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const presentationMode = settings.presentationMode;

  useEffect(() => {
    localStorage.setItem('chesskys-demo-settings', JSON.stringify(settings));
    // Apply board theme to CSS variables
    const theme = BOARD_THEMES.find(t => t.id === settings.boardTheme);
    if (theme) {
      document.documentElement.style.setProperty('--board-light', theme.light);
      document.documentElement.style.setProperty('--board-dark', theme.dark);
      document.documentElement.style.setProperty('--square-light', theme.light);
      document.documentElement.style.setProperty('--square-dark', theme.dark);
    }
    // Apply presentation mode class
    if (presentationMode) {
      document.body.classList.add('presentation-mode');
    } else {
      document.body.classList.remove('presentation-mode');
    }
  }, [settings, presentationMode]);

  const updateSettings = useCallback((newSettings: Partial<DemoSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const addChatMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    setChatMessages(prev => [...prev, newMessage]);
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const unreadNotificationCount = notifications.filter(n => !n.read).length;

  const togglePresentationMode = useCallback(() => {
    updateSettings({ presentationMode: !settings.presentationMode });
  }, [settings.presentationMode, updateSettings]);

  // Quick match simulation
  const startQuickMatch = useCallback(async (timeControl: TimeControl, difficulty: 'easy' | 'medium' | 'hard') => {
    setMatchmakingState('searching');
    setMatchmakingOpponent(null);

    // Simulate search delay
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));

    const opponent = getMockOpponent(difficulty);
    setMatchmakingOpponent(opponent);
    setMatchmakingState('found');

    // Auto-accept after 1.5s
    setTimeout(() => {
      const newGame: GameState = {
        id: `game-${Date.now()}`,
        white: Math.random() > 0.5 ? currentUser : opponent,
        black: Math.random() > 0.5 ? opponent : currentUser,
        timeControl,
        whiteTime: timeControl.initialMinutes * 60 * 1000,
        blackTime: timeControl.initialMinutes * 60 * 1000,
        activeColor: 'w',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: `[Event "Quick Match"]\n[Site "Chesskys Demo"]\n[Date "${new Date().toISOString().split('T')[0]}"]\n[Round "1"]\n[White "${currentUser.name}"]\n[Black "${opponent.name}"]\n[Result "*"]\n[TimeControl "${timeControl.initialMinutes * 60}+${timeControl.incrementSeconds}"]\n\n*`,
        moves: [],
        status: 'in_progress',
      };
      setCurrentGame(newGame);
      setViewMode('game');
      setMatchmakingState('idle');
      setMatchmakingOpponent(null);
      addChatMessage({ senderId: 'system', senderName: 'System', message: `Game started vs ${opponent.name}. ${currentUser.name} plays as ${newGame.white.uid === currentUser.uid ? 'White' : 'Black'}.`, isSystem: true });
    }, 1500);
  }, [currentUser, addChatMessage, updateSettings]);

  const createRoom = useCallback((timeControl: TimeControl) => {
    const code = generateGameRoomCode();
    setCreatedRoomCode(code);
    // Simulate opponent joining after 3-5 seconds
    setTimeout(() => {
      const opponent = getMockOpponent(settings.difficulty);
      const newGame: GameState = {
        id: `game-${Date.now()}`,
        white: currentUser,
        black: opponent,
        timeControl,
        whiteTime: timeControl.initialMinutes * 60 * 1000,
        blackTime: timeControl.initialMinutes * 60 * 1000,
        activeColor: 'w',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: `[Event "Private Game"]\n[Site "Chesskys Demo"]\n[Date "${new Date().toISOString().split('T')[0]}"]\n[Round "1"]\n[White "${currentUser.name}"]\n[Black "${opponent.name}"]\n[Result "*"]\n[TimeControl "${timeControl.initialMinutes * 60}+${timeControl.incrementSeconds}"]\n\n*`,
        moves: [],
        status: 'in_progress',
      };
      setCurrentGame(newGame);
      setViewMode('game');
      setCreatedRoomCode(null);
      addChatMessage({ senderId: 'system', senderName: 'System', message: `${opponent.name} joined the game!`, isSystem: true });
    }, 3000 + Math.random() * 2000);
  }, [currentUser, settings.difficulty, addChatMessage]);

  const joinRoom = useCallback((code: string, timeControl: TimeControl) => {
    if (code.length !== 6) {
      setMatchmakingState('error');
      setTimeout(() => setMatchmakingState('idle'), 2000);
      return;
    }
    const opponent = getMockOpponent(settings.difficulty);
    const newGame: GameState = {
      id: `game-${Date.now()}`,
      white: opponent,
      black: currentUser,
      timeControl,
      whiteTime: timeControl.initialMinutes * 60 * 1000,
      blackTime: timeControl.initialMinutes * 60 * 1000,
      activeColor: 'w',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: `[Event "Joined Game"]\n[Site "Chesskys Demo"]\n[Date "${new Date().toISOString().split('T')[0]}"]\n[Round "1"]\n[White "${opponent.name}"]\n[Black "${currentUser.name}"]\n[Result "*"]\n[TimeControl "${timeControl.initialMinutes * 60}+${timeControl.incrementSeconds}"]\n\n*`,
      moves: [],
      status: 'in_progress',
    };
    setCurrentGame(newGame);
    setViewMode('game');
    addChatMessage({ senderId: 'system', senderName: 'System', message: `Joined room ${code}. You are playing Black vs ${opponent.name}.`, isSystem: true });
  }, [currentUser, settings.difficulty, addChatMessage]);

  const endGame = useCallback((result: '1-0' | '0-1' | '1/2-1/2', reason: string) => {
    if (!currentGame) return;
    const finalGame = { ...currentGame, status: reason === 'checkmate' ? 'checkmate' : reason === 'timeout' ? 'timeout' : reason === 'resigned' ? 'resigned' : 'draw', result };
    setCurrentGame(finalGame);
    setViewMode('replay');
    addChatMessage({ senderId: 'system', senderName: 'System', message: `Game over: ${reason}`, isSystem: true });
  }, [currentGame, addChatMessage]);

  const value = {
    settings,
    updateSettings,
    currentUser,
    currentGame,
    setCurrentGame,
    chatMessages,
    addChatMessage,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    unreadNotificationCount,
    matchmakingState,
    setMatchmakingState,
    matchmakingOpponent,
    setMatchmakingOpponent,
    createdRoomCode,
    setCreatedRoomCode,
    activeTab,
    setActiveTab,
    viewMode,
    setViewMode,
    presentationMode,
    togglePresentationMode,
    pendingPromotion,
    setPendingPromotion,
    showSettings,
    setShowSettings,
    showLeaderboard,
    setShowLeaderboard,
    showProfile,
    setShowProfile,
    showTournaments,
    setShowTournaments,
    showNotifications,
    setShowNotifications,
    startQuickMatch,
    createRoom,
    joinRoom,
    endGame,
  };

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
};