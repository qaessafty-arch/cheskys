import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Chess, Square } from 'chess.js';
import confetti from 'canvas-confetti';
import { ChevronLeft, ChevronRight, RotateCcw, RotateCw, Flag, Handshake, X, MessageSquare, Volume2, VolumeX, Settings, Crown, Shield, Zap, Copy, Check, Eye, Layers, Swords, HeartHandshake, Sparkles, RefreshCw, Crown as CrownIcon } from 'lucide-react';
import { useDemo } from '../context/DemoContext';
import { ChessBoard } from './ChessBoard';
import { ChessClock } from './ChessClock';
import { MoveHistory } from './MoveHistory';
import { InGameChatPanel } from './InGameChatPanel';
import { GameOverModal } from './GameOverModal';
import { PromotionModal } from './PromotionModal';
import { ExecuteSpareModal } from './ExecuteSpareModal';
import { formatTime, formatTimeLong, getDemoBotMove, getGameStatus, makeMove } from '../utils/chessEngine';
import { TimeControl } from '../types/chess';
import { DEMO_BOT_CONFIG } from '../data/demoData';

export const GameView: React.FC = () => {
  const {
    currentGame,
    setCurrentGame,
    settings,
    viewMode,
    setViewMode,
    currentUser,
    chatMessages,
    addChatMessage,
    showSettings,
    setShowSettings,
    pendingPromotion,
    setPendingPromotion,
    endGame,
  } = useDemo();

  const [game, setGame] = useState<Chess>(() => new Chess());
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);
  const [activeColor, setActiveColor] = useState<PieceColor>('w');
  const [showChat, setShowChat] = useState(false);
  const [showMoveHistory, setShowMoveHistory] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [moveIndex, setMoveIndex] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState<'1-0' | '0-1' | '1/2-1/2' | null>(null);
  const [gameEndReason, setGameEndReason] = useState('');
  const [stats, setStats] = useState({ accuracy: 72, bestMoves: 5, blunders: 2, mistakes: 3 });
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [showExecuteSpare, setShowExecuteSpare] = useState(false);
  const [executeSpareData, setExecuteSpareData] = useState<{
    currentUserColor: 'w' | 'b';
    opponentName: string;
  } | null>(null);
  const botMoveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const soundContextRef = useRef<AudioContext | null>(null);

  // Initialize game from currentGame
  useEffect(() => {
    if (currentGame) {
      const newGame = new Chess(currentGame.fen);
      setGame(newGame);
      setWhiteTime(currentGame.whiteTime);
      setBlackTime(currentGame.blackTime);
      setActiveColor(currentGame.activeColor);
      setLastMove(currentGame.lastMove || null);
      setMoveIndex(currentGame.moves.length);
      setGameOver(false);
      setGameResult(null);
      setGameEndReason('');
      setSelectedSquare(null);
    }
  }, [currentGame]);

  // Sync game state back to context
  useEffect(() => {
    if (currentGame) {
      setCurrentGame({
        ...currentGame,
        fen: game.fen(),
        pgn: game.pgn(),
        moves: game.history(),
        whiteTime,
        blackTime,
        activeColor,
        lastMove,
        status: gameOver ? (gameResult === '1/2-1/2' ? 'draw' : gameResult === '1-0' || gameResult === '0-1' ? 'checkmate' : 'in_progress') : 'in_progress',
        result: gameResult || undefined,
      });
    }
  }, [game, whiteTime, blackTime, activeColor, lastMove, gameOver, gameResult, gameEndReason, currentGame, setCurrentGame]);

  // Handle bot moves
  useEffect(() => {
    if (gameOver || !currentGame) return;

    const isCurrentUserTurn = (activeColor === 'w' && currentGame.white.uid === currentUser.uid) ||
                              (activeColor === 'b' && currentGame.black.uid === currentUser.uid);

    if (!isCurrentUserTurn && !isBotThinking) {
      const config = DEMO_BOT_CONFIG[settings.difficulty];
      setIsBotThinking(true);

      botMoveTimeoutRef.current = setTimeout(() => {
        const botMove = getDemoBotMove(game, settings.difficulty);
        if (botMove) {
          handleMove(botMove.from, botMove.to, botMove.promotion);
        }
        setIsBotThinking(false);
      }, config.moveDelay);
    }

    return () => {
      if (botMoveTimeoutRef.current) clearTimeout(botMoveTimeoutRef.current);
    };
  }, [activeColor, game, gameOver, currentGame, currentUser.uid, settings.difficulty]);

  // Clock updates
  const handleTimeUpdate = useCallback((wTime: number, bTime: number) => {
    setWhiteTime(wTime);
    setBlackTime(bTime);
  }, []);

  const handleFlagFall = useCallback((color: PieceColor) => {
    const result = color === 'w' ? '0-1' : '1-0';
    setGameResult(result);
    setGameEndReason('timeout');
    setGameOver(true);
    playSound('gameover');
    triggerConfetti();
  }, []);

  const handleMove = useCallback((from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n') => {
    // Check for promotion
    const piece = game.get(from);
    if (piece && piece.type === 'p' && ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'))) {
      setPendingPromotion({ from, to, game: { ...currentGame!, fen: game.fen() } as any });
      return;
    }

    const moveResult = makeMove(game, from, to, promotion);
    if (!moveResult) return false;

    // Play sound
    playSound(moveResult.captured ? 'capture' : 'move');

    // Update state
    setGame(new Chess(game.fen()));
    setLastMove({ from, to });
    setSelectedSquare(null);
    setActiveColor(activeColor === 'w' ? 'b' : 'w');

    // Add increment
    if (activeColor === 'w') {
      setWhiteTime(prev => prev + currentGame!.timeControl.incrementSeconds * 1000);
    } else {
      setBlackTime(prev => prev + currentGame!.timeControl.incrementSeconds * 1000);
    }

    // Check game status
    const status = getGameStatus(game);
    if (status.status === 'checkmate') {
      const result = status.winner === 'w' ? '1-0' : '0-1';
      setGameResult(result);
      setGameEndReason('checkmate');
      setGameOver(true);
      playSound('gameover');
      triggerConfetti();
    } else if (status.status === 'draw') {
      setGameResult('1/2-1/2');
      setGameEndReason('draw');
      setGameOver(true);
      playSound('gameover');
    } else if (game.history().length >= 30 && !showExecuteSpare && !gameOver) {
      // Trigger Execute/Spare decision ~2 moves before likely end (heuristic)
      // In a real implementation, this would be based on position evaluation
      const movesRemaining = Math.max(0, 35 - game.history().length);
      if (movesRemaining <= 2) {
        setShowExecuteSpare(true);
        setExecuteSpareData({
          currentUserColor: myColor,
          opponentName: isWhitePlayer ? currentGame.black.name : currentGame.white.name,
        });
      }
    }

    return true;
  }, [game, activeColor, currentGame, playSound, myColor, isWhitePlayer, currentGame, showExecuteSpare, gameOver]);

  const handlePromote = useCallback((piece: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;
    handleMove(pendingPromotion.from, pendingPromotion.to, piece);
    setPendingPromotion(null);
  }, [pendingPromotion, handleMove]);

  const handleSquareClick = useCallback((square: Square) => {
    if (gameOver) return;

    const piece = game.get(square);
    const isCurrentUserTurn = (activeColor === 'w' && currentGame?.white.uid === currentUser.uid) ||
                              (activeColor === 'b' && currentGame?.black.uid === currentUser.uid);

    if (!isCurrentUserTurn) return; // Can't move opponent's pieces

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    if (selectedSquare) {
      const legalMoves = game.moves({ square: selectedSquare, verbose: true });
      const isLegal = legalMoves.some(m => m.to === square);
      if (isLegal) {
        handleMove(selectedSquare, square);
      } else if (piece && piece.color === game.turn()) {
        setSelectedSquare(square);
      } else {
        setSelectedSquare(null);
      }
    } else if (piece && piece.color === game.turn()) {
      setSelectedSquare(square);
    }
  }, [game, activeColor, currentGame, currentUser.uid, selectedSquare, handleMove, gameOver]);

  const handleUndo = useCallback(() => {
    if (game.history().length >= 2) {
      game.undo();
      game.undo();
      setGame(new Chess(game.fen()));
      setMoveIndex(Math.max(0, moveIndex - 2));
      setLastMove(null);
    }
  }, [game, moveIndex]);

  const handleDrawOffer = useCallback(() => {
    addChatMessage({ senderId: currentUser.uid, senderName: currentUser.name, message: 'Draw offer', isSystem: false });
    // Simulate opponent response
    setTimeout(() => {
      if (Math.random() > 0.5) {
        setGameResult('1/2-1/2');
        setGameEndReason('draw');
        setGameOver(true);
        addChatMessage({ senderId: 'opponent', senderName: 'Opponent', message: 'Accepts draw', isSystem: false });
      } else {
        addChatMessage({ senderId: 'opponent', senderName: 'Opponent', message: 'Declines draw', isSystem: false });
      }
    }, 1000);
  }, [currentUser, addChatMessage]);

  const handleResign = useCallback(() => {
    const result = activeColor === 'w' ? '0-1' : '1-0';
    setGameResult(result);
    setGameEndReason('resigned');
    setGameOver(true);
    playSound('gameover');
  }, [activeColor]);

  const handleRematch = useCallback(() => {
    // Reset for new game
    setGameOver(false);
    setGameResult(null);
    setGameEndReason('');
    setShowExecuteSpare(false);
    setExecuteSpareData(null);
    // Start new quick match
    // This would be handled by the context
  }, []);

  const handleReview = useCallback(() => {
    setViewMode('replay');
  }, [setViewMode]);

  const handleExecute = useCallback(() => {
    // Execute: win the game with full rewards
    const result = activeColor === 'w' ? '1-0' : '0-1';
    setGameResult(result);
    setGameEndReason('checkmate');
    setGameOver(true);
    setShowExecuteSpare(false);
    setExecuteSpareData(null);
    playSound('gameover');
    triggerConfetti();
    // In a real app, would update ELO/Honor here
    addChatMessage({ senderId: 'system', senderName: 'System', message: `You executed the final blow! +12 ELO, +25 Honor`, isSystem: true });
  }, [activeColor, playSound, triggerConfetti, addChatMessage]);

  const handleSpare = useCallback(() => {
    // Spare: offer honorable draw
    setGameResult('1/2-1/2');
    setGameEndReason('draw');
    setGameOver(true);
    setShowExecuteSpare(false);
    setExecuteSpareData(null);
    playSound('gameover');
    addChatMessage({ senderId: 'system', senderName: 'System', message: `You showed mercy. Draw agreed. +8 Honor (Mercy)`, isSystem: true });
  }, [playSound, addChatMessage]);

  const playSound = useCallback((type: 'move' | 'capture' | 'check' | 'gameover') => {
    if (isMuted || !settings.soundEnabled) return;
    if (!soundContextRef.current) {
      soundContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = soundContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case 'move':
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
        break;
      case 'capture':
        osc.frequency.setValueAtTime(330, ctx.currentTime);
        osc.type = 'square';
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
        break;
      case 'check':
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.type = 'triangle';
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
        break;
      case 'gameover':
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.type = 'sawtooth';
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
        break;
    }
  }, [isMuted, settings.soundEnabled]);

  const triggerConfetti = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#F5B83D', '#6EE7B7', '#60A5FA', '#FB7185', '#FFFFFF'],
    });
  }, []);

  const checkSquare = game.isCheck() ? game.turn() === 'w'
    ? game.board().flat().find(p => p && p.type === 'k' && p.color === 'w')?.square as Square
    : game.board().flat().find(p => p && p.type === 'k' && p.color === 'b')?.square as Square
    : null;

  if (!currentGame) return null;

  const isWhitePlayer = currentGame.white.uid === currentUser.uid;
  const myTime = isWhitePlayer ? whiteTime : blackTime;
  const opponentTime = isWhitePlayer ? blackTime : whiteTime;
  const myColor: PieceColor = isWhitePlayer ? 'w' : 'b';

  return (
    <div className="min-h-screen pt-20 bg-[var(--app-bg)]">
      <Header showBack onBack={() => setViewMode('dashboard')} title={`${currentGame.timeControl.name} • ${currentGame.white.name} vs ${currentGame.black.name}`} />

      <div className="flex flex-col lg:flex-row gap-6 px-4 pb-8 max-w-7xl mx-auto w-full">
        {/* Left: Board + Clock */}
        <div className="flex-1 lg:w-2/3 flex flex-col items-center gap-6">
          {/* Opponent Info */}
          <div className="w-full max-w-[560px] flex items-center justify-between p-4 glass-panel rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--primary-accent)]/20 flex items-center justify-center text-xl">{currentGame.black.flag}</div>
              <div>
                <div className="font-bold text-[var(--text-main)]">{!isWhitePlayer ? currentGame.white.name : currentGame.black.name}</div>
                <div className="text-[var(--primary-accent)] font-mono text-sm">⚔️ {!isWhitePlayer ? currentGame.white.elo : currentGame.black.elo}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-[var(--text-dim)] uppercase tracking-wider">Opponent</div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--secondary-accent)]" />
                <span className="text-[11px] font-bold text-[var(--secondary-accent)]">Online</span>
              </div>
            </div>
          </div>

          {/* Board */}
          <ChessBoard
            game={game}
            orientation={myColor}
            settings={settings}
            lastMove={lastMove}
            selectedSquare={selectedSquare}
            onSquareClick={handleSquareClick}
            onMove={handleMove}
            disabled={gameOver}
            checkSquare={checkSquare}
          />

          {/* My Info + Clock */}
          <div className="w-full max-w-[560px] flex items-center justify-between gap-4">
            <ChessClock
              whiteTime={isWhitePlayer ? whiteTime : blackTime}
              blackTime={isWhitePlayer ? blackTime : whiteTime}
              activeColor={activeColor}
              timeControl={currentGame.timeControl}
              onTimeUpdate={handleTimeUpdate}
              onFlagFall={handleFlagFall}
              paused={gameOver}
            />
            <div className="flex-1 flex items-center justify-end gap-3">
              <div className="text-right">
                <div className="font-bold text-[var(--text-main)]">{currentUser.name}</div>
                <div className="text-[var(--primary-accent)] font-mono text-sm">⚔️ {currentUser.elo}</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-[var(--primary-accent)]/20 flex items-center justify-center text-xl">{currentUser.flag}</div>
            </div>
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4 max-h-[calc(100vh-140px)]">
          {/* Game Controls */}
          <div className="glass-panel p-4 rounded-xl flex flex-wrap gap-2">
            <button onClick={handleUndo} disabled={game.history().length < 2 || gameOver} className="btn-secondary text-sm flex-1 min-w-[80px]">
              <RotateCcw className="w-4 h-4 mr-1" />
              Undo
            </button>
            <button onClick={handleDrawOffer} disabled={gameOver} className="btn-secondary text-sm flex-1 min-w-[80px]">
              <Handshake className="w-4 h-4 mr-1" />
              Draw
            </button>
            <button onClick={handleResign} disabled={gameOver} className="btn-danger text-sm flex-1 min-w-[80px]">
              <Flag className="w-4 h-4 mr-1" />
              Resign
            </button>
            <button onClick={() => setShowSettings(true)} className="btn-secondary text-sm flex-1 min-w-[80px]">
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="glass-panel rounded-xl overflow-hidden">
            <div className="flex border-b border-[var(--glass-border)]">
              <TabButton active={showMoveHistory} onClick={() => setShowMoveHistory(true)} icon={<Swords className="w-4 h-4" />} label="Moves" />
              <TabButton active={showChat} onClick={() => setShowChat(true)} icon={<MessageSquare className="w-4 h-4" />} label="Chat" />
            </div>
            <div className="p-4">
              {showMoveHistory && <MoveHistory game={game} onGoToMove={setMoveIndex} currentMoveIndex={moveIndex} maxHeight={300} />}
              {showChat && <InGameChatPanel isOpen={true} onClose={() => setShowChat(false)} />}
            </div>
          </div>

          {/* Game Info */}
          <div className="glass-panel p-4 rounded-xl">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-3">Game Info</h3>
            <div className="space-y-2 text-sm">
              <InfoRow label="Time Control" value={currentGame.timeControl.name} />
              <InfoRow label="Rated" value={currentGame.white.elo !== currentGame.black.elo ? 'Yes' : 'Demo'} />
              <InfoRow label="Moves" value={game.history().length.toString()} />
              <InfoRow label="Status" value={gameOver ? 'Finished' : activeColor === myColor ? 'Your Turn' : "Opponent's Turn"} />
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {pendingPromotion && (
          <PromotionModal
            square={pendingPromotion.to}
            color={pendingPromotion.game.activeColor === 'w' ? 'w' : 'b'}
            onPromote={handlePromote}
            onCancel={() => setPendingPromotion(null)}
          />
        )}
        {gameOver && (
          <GameOverModal
            game={{ ...currentGame, result: gameResult!, status: gameEndReason as any }}
            onRematch={handleRematch}
            onReview={handleReview}
            onShare={() => navigator.share?.({ title: 'Chesskys Game', text: `I just played ${currentGame.white.name} vs ${currentGame.black.name}` })}
            onClose={() => setViewMode('dashboard')}
            accuracy={stats.accuracy}
            bestMoves={stats.bestMoves}
            blunders={stats.blunders}
            mistakes={stats.mistakes}
          />
        )}
        {showExecuteSpare && executeSpareData && (
          <ExecuteSpareModal
            isOpen={showExecuteSpare}
            onClose={() => setShowExecuteSpare(false)}
            onExecute={handleExecute}
            onSpare={handleSpare}
            currentUserColor={executeSpareData.currentUserColor}
            opponentName={executeSpareData.opponentName}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const Header: React.FC<{ showBack: boolean; onBack: () => void; title: string }> = ({ showBack, onBack, title }) => (
  <header className="fixed top-0 left-0 right-0 z-40 glass-panel border-b border-[var(--glass-border)] px-4 py-3" style={{ backdropFilter: 'blur(20px)' }}>
    <div className="max-w-7xl mx-auto flex items-center justify-between">
      <div className="flex items-center gap-3">
        {showBack && <button onClick={onBack} className="w-10 h-10 rounded-xl glass-panel-hover flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)]"><ChevronLeft className="w-5 h-5" /></button>}
        <h1 className="font-black text-lg text-[var(--text-main)] truncate max-w-[300px]">{title}</h1>
      </div>
    </div>
  </header>
);

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-bold transition-all ${active ? 'text-[var(--primary-accent)] border-b-2 border-[var(--primary-accent)]' : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'}`}>
    {icon} {label}
  </button>
);

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between">
    <span className="text-[var(--text-dim)]">{label}</span>
    <span className="font-bold text-[var(--text-main)]">{value}</span>
  </div>
);