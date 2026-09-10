import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GameOverModal } from "./GameOverModal";
import { PanelContainer } from './PanelContainer';
import { Chess, Square, Move } from 'chess.js';
import { AppSettings, OnlineMatchSession, PieceColor, PieceType } from '../types/chess';
import {
  listenToOnlineMatchSession,
  sendOnlineMove,
  resignOnlineMatch,
  offerDrawOnlineMatch,
  acceptDrawOnlineMatch,
  finalizeOnlineMatch,
  resolveFate,
  offerRematchOnlineMatch,
  acceptRematchOnlineMatch
} from '../services/onlineMatchService';
import {
  sendInGameMessage,
  listenToInGameMessages,
  setInGameTypingStatus,
  listenToInGameTypingStatus,
  InGameMessage
} from '../services/chatService';
import { getOnlineMatchSessionLocal } from '../services/matchService';
import { advanceTournamentMatch } from '../services/tournamentService';
import { getBotMoveForElo, getCapturedMaterial, evaluateBoard } from '../utils/chessEngine';
import { useAuth } from '../context/AuthContext';
import { ChessBoard } from './ChessBoard';
import { CapturedPieces } from './CapturedPieces';
import { ChessClock } from './ChessClock';
import { VoiceMoveDictator } from './VoiceMoveDictator';
import { LiveHypeMeter } from './LiveHypeMeter';
import { soundManager } from '../utils/audio';
import { socketService } from '../utils/socket';
import { getLocalPlayerUid } from '../utils/identity';
import {
  Swords,
  Flag,
  Handshake,
  RotateCcw,
  X,
  Copy,
  Check,
  MessageSquare,
  Layers,
  Crown,
  Shield,
  Sun,
  AlertTriangle,
  Users
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { ConnectionStatus } from './multiplayer/ConnectionStatus';
import { InGameChatPanel } from './InGameChatPanel';
import { ModernFloatingControls } from './multiplayer/ModernFloatingControls';
import { ModernSpectatorWidget } from './multiplayer/ModernSpectatorWidget';

interface FloatingEmote {
  id: string;
  emote: string;
  isMe: boolean;
}

interface OnlineMatchViewProps {
  matchId: string;
  settings: AppSettings;
  onClose: () => void;
  onOpenChatWithOpponent?: (opponentUid: string) => void;
}

export const OnlineMatchView: React.FC<OnlineMatchViewProps> = ({
  matchId,
  settings,
  onClose,
  onOpenChatWithOpponent
}) => {
  const { profile, user, updateRespectMetrics } = useAuth();
  const [session, setSession] = useState<OnlineMatchSession | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const loadStateRef = useRef(loadState);
  const [game, setGame] = useState<Chess>(() => new Chess());
  const [lastMove, setLastMove] = useState<{ from: string; to: string | null }>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [pendingDraw, setPendingDraw] = useState(false);

  const hasMovesPlayed = Boolean(
    (session?.moves && session.moves.length > 0) ||
    (session?.moveCount && session.moveCount > 0) ||
    (session?.pgn && session.pgn.trim().length > 0) ||
    (game && game.history().length > 0)
  );

  const isGameOver = useCallback(() => {
    if (!session?.status) return false;
    if (session.status === 'awaiting_fate') return false;
    if (['in_progress', 'waiting', 'active', 'ready'].includes(session.status)) return false;
    if (session.status === 'aborted') return false;
    if (session.status === 'abandoned') {
      return hasMovesPlayed;
    }
    const finalStatuses = ['checkmate', 'resigned', 'draw', 'timeout', 'completed'];
    if (!finalStatuses.includes(session.status)) return false;
    // Without moves played, a match cannot be checkmate, timeout, draw, or completed unless someone resigned
    if (!hasMovesPlayed && session.status !== 'resigned') return false;
    return true;
  }, [session, hasMovesPlayed]);

  useEffect(() => {
    loadStateRef.current = loadState;
  }, [loadState]);

  const [activeTab, setActiveTab] = useState<'moves' | 'chat'>('moves');
  const [isMuted, setIsMuted] = useState(false);
  const [isPendingMove, setIsPendingMove] = useState(false);
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'error'>('connecting');
  const [isOpponentPresent, setIsOpponentPresent] = useState<boolean>(true);
  const [chatMessages, setChatMessages] = useState<InGameMessage[]>([]);
  const [seenChatCount, setSeenChatCount] = useState(0);
  const [typingMap, setTypingMap] = useState<Record<string, boolean>>({});
  const [floatingEmotes, setFloatingEmotes] = useState<FloatingEmote[]>([]);

  const [whiteTime, setWhiteTime] = useState<number>(600);
  const [blackTime, setBlackTime] = useState<number>(600);

  const [evalScore, setEvalScore] = useState<number>(0);
  const [showWeather, setShowWeather] = useState(false);
  const [showTerritory, setShowTerritory] = useState(false);
  const [is3dPerspective, setIs3dPerspective] = useState(false);
  const [manualFlipped, setManualFlipped] = useState<boolean | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square | null }>(null);

  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [moveIndex, setMoveIndex] = useState(0);

  const myUid = profile?.uid || user?.uid || getLocalPlayerUid();
  const sessionWhiteId = session?.whiteId || session?.whitePlayer?.uid;
  const sessionBlackId = session?.blackId || session?.blackPlayer?.uid;

  const isWhitePlayer = useMemo(() => {
    // 1. Direct match with white player identifiers
    if (sessionWhiteId && sessionWhiteId === myUid) return true;
    if (session?.whitePlayer?.uid && session.whitePlayer.uid === myUid) return true;

    // 2. Direct match with black player identifiers
    if (sessionBlackId && sessionBlackId === myUid) return false;
    if (session?.blackPlayer?.uid && session.blackPlayer.uid === myUid) return false;

    // 3. Host resolution: if current user is host, check whether host is white or black
    if (session?.hostId && session.hostId === myUid) {
      if (sessionBlackId === session.hostId || session?.blackPlayer?.uid === session.hostId) {
        return false;
      }
      return true;
    }

    // 4. Guest resolution: if current user is guest/opponent in a room with a known host
    if (session?.hostId) {
      if (sessionWhiteId === session.hostId || session?.whitePlayer?.uid === session.hostId) {
        return false;
      }
      if (sessionBlackId === session.hostId || session?.blackPlayer?.uid === session.hostId) {
        return true;
      }
    }

    // 5. Placeholder fallback: if blackId is placeholder and white is not, this user may be black
    if (sessionBlackId === 'guest_black' && sessionWhiteId !== myUid) {
      return false;
    }

    // 6. Default to white
    return true;
  }, [sessionWhiteId, sessionBlackId, session?.whitePlayer?.uid, session?.blackPlayer?.uid, session?.hostId, myUid]);

  const myColor: PieceColor = isWhitePlayer ? 'w' : 'b';
  const isGameLive = Boolean(
    session &&
      (session.status === 'in_progress' ||
        session.status === 'active' ||
        session.status === 'ready' ||
        session.status === 'waiting')
  );
  // Source of truth for active turn must reflect the live board state
  const currentTurn = game.turn();

  // If host is testing in a private room alone without an opponent yet, allow moving for either side
  const isSoloTest = Boolean(
    session?.hostId === myUid &&
    (!session?.guestId || session?.guestId === myUid) &&
    (!session?.blackPlayer?.uid || session?.blackPlayer?.uid === 'guest_black' || session?.blackPlayer?.uid === myUid) &&
    (!session?.whitePlayer?.uid || session?.whitePlayer?.uid === 'guest_white' || session?.whitePlayer?.uid === myUid)
  );

  const isMyTurn = isGameLive && (isSoloTest || currentTurn === myColor);
  const capturedMaterial = getCapturedMaterial(game);

  const opponent = isWhitePlayer ? session?.blackPlayer : session?.whitePlayer;
  const me = isWhitePlayer ? session?.whitePlayer : session?.blackPlayer;

  useEffect(() => {
    if (!matchId) return;

    // Immediate Local Fallback: Load from cache to prevent "Zombie Loading" state
    const cachedSession = getOnlineMatchSessionLocal(matchId);
    if (cachedSession) {
      setSession(cachedSession);
      setLoadState('ready');
    }

    let timeoutId: NodeJS.Timeout;

    const unsub = listenToOnlineMatchSession(matchId, newSession => {
      if (!newSession || !newSession.fen || newSession.fen.trim().length === 0) {
        return;
      }
      setSession(newSession);
      setLoadState('ready');

      // Synchronize game board if the session FEN differs from current game FEN
      try {
        setGame(prevGame => {
          if (prevGame.fen() !== newSession.fen) {
            const nextGame = new Chess(newSession.fen);
            setMoveHistory(nextGame.history());
            setMoveIndex(nextGame.history().length);
            setEvalScore(evaluateBoard(nextGame));
            setIsPendingMove(false);
            return nextGame;
          }
          return prevGame;
        });
      } catch (err) {
        console.error('Error syncing FEN from session:', err);
      }

      if (newSession.whiteSecondsRemaining !== undefined) {
        setWhiteTime(newSession.whiteSecondsRemaining);
      }
      if (newSession.blackSecondsRemaining !== undefined) {
        setBlackTime(newSession.blackSecondsRemaining);
      }
      if (isGameLive && (!newSession.moves || newSession.moves.length === 0) && (!newSession.pgn || newSession.pgn.trim() === '')) {
        setLastMove(null);
        setPendingPromotion(null);
      }

      socketService.getSocket()?.emit('join_match', { matchId, uid: myUid, session: newSession });
    });

    const socket = socketService.getSocket() || socketService.connect(myUid);
    setSocketStatus(socket.connected ? 'connected' : 'connecting');

    timeoutId = setTimeout(() => {
      if (loadStateRef.current === 'loading') {
        import('../services/matchService').then(m => m.verifyOnlineMatchExists(matchId)).then(session => {
          if (!session) {
            setLoadState('missing');
          } else {
            setSession(session);
            setLoadState('ready');
          }
        });
      }
    }, 8000);

    const fallbackTimer = setTimeout(() => {
      setSocketStatus(prev => (prev === 'connecting' || prev === 'error' ? 'connected' : prev));
    }, 2500);

    const onConnect = () => {
      clearTimeout(fallbackTimer);
      setSocketStatus('connected');
      socket.emit('join_match', { matchId, uid: myUid });
    };
    const onDisconnect = () => setSocketStatus('reconnecting');
    const onConnectError = () => {
      setSocketStatus('connected');
    };
    const onMatchJoined = (data: any) => {
      if (data.success) {
        setLoadState(prev => prev === 'loading' ? 'ready' : prev);
        setSession(prev => ({
          ...prev,
          id: data.matchId,
          hostId: data.whitePlayer?.uid || prev?.hostId || '',
          whitePlayer: { uid: data.whitePlayer?.uid || '', displayName: data.whitePlayer?.name || 'Player 1', elo: data.whitePlayer?.rating || 1200 },
          blackPlayer: { uid: data.blackPlayer?.uid || '', displayName: data.blackPlayer?.name || 'Player 2', elo: data.blackPlayer?.rating || 1200 },
          fen: data.fen,
          pgn: prev?.pgn || '',
          turn: data.turn,
          status: data.status,
          winner: prev?.winner || null,
          timeControl: prev?.timeControl || { name: 'Rapid', initialSeconds: data.whiteSecondsRemaining, incrementSeconds: 0 },
          whiteSecondsRemaining: data.whiteSecondsRemaining,
          blackSecondsRemaining: data.blackSecondsRemaining,
          moves: prev?.moves || [],
          moveCount: data.movesCount || 0
        } as any));
      }
    };

    const onMoveMade = (data: any) => {
      setIsPendingMove(false);
      if (!data) return;
      const fen = data.fen || data.currentFen || data.boardFen;
      if (!fen) return;
      try {
        const updatedGame = new Chess(fen);
        setGame(updatedGame);
        setMoveHistory(updatedGame.history());
        setEvalScore(evaluateBoard(updatedGame));
        const moveFrom = data.from || data.lastMove?.from || data.move?.from;
        const moveTo = data.to || data.lastMove?.to || data.move?.to;
        if (moveFrom && moveTo) {
          setLastMove({ from: moveFrom, to: moveTo });
        }
        if (data.whiteSecondsRemaining !== undefined) setWhiteTime(data.whiteSecondsRemaining);
        if (data.blackSecondsRemaining !== undefined) setBlackTime(data.blackSecondsRemaining);
        if (data.moveIndex !== undefined) setMoveIndex(data.moveIndex);
        else setMoveIndex(updatedGame.history().length);

        // Keep session synchronized so turn and status remain accurate
        setSession(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            fen,
            pgn: data.pgn || updatedGame.pgn() || prev.pgn,
            turn: data.turn || updatedGame.turn(),
            moveCount: data.moveIndex ?? updatedGame.history().length,
            whiteSecondsRemaining: data.whiteSecondsRemaining ?? prev.whiteSecondsRemaining,
            blackSecondsRemaining: data.blackSecondsRemaining ?? prev.blackSecondsRemaining,
            status: (data.checkmate || updatedGame.isCheckmate())
              ? 'checkmate'
              : (data.stalemate || data.isDraw || updatedGame.isDraw())
              ? 'draw'
              : prev.status,
            winner: (data.checkmate || updatedGame.isCheckmate())
              ? (updatedGame.turn() === 'w' ? 'b' : 'w')
              : prev.winner,
          };
        });

        if (updatedGame.isCheckmate()) soundManager.playVictory();
        else if (updatedGame.inCheck()) soundManager.playCheck();
        else if (data.san && typeof data.san === 'string' && data.san.includes('x')) soundManager.playCapture('p', 'w');
        else soundManager.playMove('p', 'w');
      } catch (e) {
        console.error('Error processing socket move:', e);
      }
    };

    const onBoardState = (data: any) => {
      if (!data || !data.fen) return;
      try {
        const updatedGame = new Chess(data.fen);
        setGame(updatedGame);
        setMoveHistory(updatedGame.history());
        setEvalScore(evaluateBoard(updatedGame));
        if (data.lastMove?.from && data.lastMove?.to) {
          setLastMove({ from: data.lastMove.from, to: data.lastMove.to });
        }
        if (data.whiteSecondsRemaining !== undefined) setWhiteTime(data.whiteSecondsRemaining);
        if (data.blackSecondsRemaining !== undefined) setBlackTime(data.blackSecondsRemaining);
        setSession(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            fen: data.fen,
            pgn: data.pgn || prev.pgn,
            turn: data.turn || updatedGame.turn(),
            status: data.status || prev.status,
            whiteSecondsRemaining: data.whiteSecondsRemaining ?? prev.whiteSecondsRemaining,
            blackSecondsRemaining: data.blackSecondsRemaining ?? prev.blackSecondsRemaining,
          };
        });
      } catch (e) {
        console.error('Error handling boardState:', e);
      }
    };

    const onClockSync = (data: any) => {
      if (!data) return;
      const w = data.white ?? data.whiteTime;
      const b = data.black ?? data.blackTime;
      if (typeof w === 'number') setWhiteTime(Math.round(w));
      if (typeof b === 'number') setBlackTime(Math.round(b));
    };

    const onGameOver = (data: { reason: string, winner: string, result?: string }) => {
      if (data.result === 'aborted' || !data.winner || data.winner === 'draw') return;
      if (data.winner === myColor) soundManager.playVictory();
      else soundManager.playDefeat();
    };

    const onMatchAborted = (data: { reason: string }) => {
      setSession(prev => prev ? { ...prev, status: 'aborted', reason: data.reason || 'Match was aborted.' } : prev);
    };

    const onReconnectSuccess = (data: any) => {
      const g = new Chess(data.fen);
      setGame(g);
      setMoveHistory(g.history());
      setWhiteTime(data.whiteSecondsRemaining);
      setBlackTime(data.blackSecondsRemaining);
      setMoveIndex(g.history().length);
    };

    const onMoveRejected = (data: any) => {
      setIsPendingMove(false);
      if (data?.error && data.error.includes('not found')) {
        socket.emit('join_match', { matchId, uid: myUid });
      }
      if (data?.currentFen || data?.fen) {
        setGame(new Chess(data.currentFen || data.fen));
      }
    };

    const onOpponentDisconnected = () => setIsOpponentPresent(false);
    const onOpponentReconnected = () => setIsOpponentPresent(true);

    const onDrawOffered = (data: any) => {
      setSession(prev => prev ? { ...prev, drawOfferFrom: data?.uid || 'opponent' } : prev);
    };

    const onDrawAccepted = () => {
      setSession(prev => prev ? { ...prev, status: 'draw', winner: 'draw', reason: 'Draw agreed by both players.' } : prev);
      setPendingDraw(false);
    };

    const onDrawDeclined = () => {
      setSession(prev => prev ? { ...prev, drawOfferFrom: undefined } : prev);
      setPendingDraw(false);
    };

    const onRematchOffered = (data: any) => {
      setSession(prev => prev ? { ...prev, rematchOfferFrom: data?.uid || data?.offeredBy } : prev);
    };
    const onRematchDeclined = () => {
      setSession(prev => prev ? { ...prev, rematchOfferFrom: undefined } : prev);
    };
    const onRematchStarted = (data: any) => {
      const fen = data?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const newG = new Chess(fen);
      setGame(newG);
      setMoveHistory([]);
      setMoveIndex(0);
      setLastMove(null);
      setPendingPromotion(null);
      setEvalScore(0);
      const wSec = data?.whiteSecondsRemaining || session?.timeControl?.initialSeconds || 600;
      const bSec = data?.blackSecondsRemaining || session?.timeControl?.initialSeconds || 600;
      setWhiteTime(wSec);
      setBlackTime(bSec);
      setSession(prev => {
        if (!prev) return prev;
        const newWhitePlayer = data?.whitePlayer ? { ...prev.whitePlayer, ...data.whitePlayer } : prev.blackPlayer;
        const newBlackPlayer = data?.blackPlayer ? { ...prev.blackPlayer, ...data.blackPlayer } : prev.whitePlayer;
        return {
          ...prev,
          status: 'in_progress',
          winner: null,
          reason: undefined,
          rematchOfferFrom: undefined,
          fen,
          pgn: '',
          moves: [],
          moveCount: 0,
          turn: 'w',
          whitePlayer: newWhitePlayer,
          blackPlayer: newBlackPlayer,
          whiteId: newWhitePlayer?.uid,
          blackId: newBlackPlayer?.uid,
          whiteSecondsRemaining: wSec,
          blackSecondsRemaining: bSec,
        };
      });
    };

    socket.on('match_joined', onMatchJoined);
    socket.on('roomJoined', onMatchJoined);
    socket.on('room_joined', onMatchJoined);
    socket.on('gameJoined', onMatchJoined);
    socket.on('game_joined', onMatchJoined);

    socket.on('move_made', onMoveMade);
    socket.on('moveMade', onMoveMade);
    socket.on('opponent_move', onMoveMade);
    socket.on('opponentMove', onMoveMade);
    socket.on('player_moved', onMoveMade);
    socket.on('playerMoved', onMoveMade);
    socket.on('move', onMoveMade);

    socket.on('boardState', onBoardState);
    socket.on('gameState', onBoardState);
    socket.on('gameStateUpdate', onBoardState);
    socket.on('state_update', onBoardState);

    socket.on('move_rejected', onMoveRejected);
    socket.on('moveRejected', onMoveRejected);

    socket.on('clock_sync', onClockSync);
    socket.on('clockSync', onClockSync);
    socket.on('timerUpdate', onClockSync);
    socket.on('timer_update', onClockSync);

    socket.on('draw_offered', onDrawOffered);
    socket.on('drawOffered', onDrawOffered);
    socket.on('draw_accepted', onDrawAccepted);
    socket.on('drawAccepted', onDrawAccepted);
    socket.on('draw_declined', onDrawDeclined);
    socket.on('drawDeclined', onDrawDeclined);

    socket.on('game_over', onGameOver);
    socket.on('gameOver', onGameOver);
    socket.on('match_aborted', onMatchAborted);
    socket.on('matchAborted', onMatchAborted);
    socket.on('reconnect_success', onReconnectSuccess);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('opponentDisconnected', onOpponentDisconnected);
    socket.on('playerDisconnected', onOpponentDisconnected);
    socket.on('playerReconnected', onOpponentReconnected);
    socket.on('opponentReconnected', onOpponentReconnected);
    socket.on('rematch_offered', onRematchOffered);
    socket.on('rematchOffered', onRematchOffered);
    socket.on('rematch_declined', onRematchDeclined);
    socket.on('rematchDeclined', onRematchDeclined);
    socket.on('rematch_started', onRematchStarted);
    socket.on('rematchStarted', onRematchStarted);
    socket.on('game_reset', onRematchStarted);
    socket.emit('join_match', { matchId, uid: myUid, session });

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(fallbackTimer);
      if (unsub) unsub();
      socket.off('match_joined', onMatchJoined);
      socket.off('roomJoined', onMatchJoined);
      socket.off('room_joined', onMatchJoined);
      socket.off('gameJoined', onMatchJoined);
      socket.off('game_joined', onMatchJoined);

      socket.off('move_made', onMoveMade);
      socket.off('moveMade', onMoveMade);
      socket.off('opponent_move', onMoveMade);
      socket.off('opponentMove', onMoveMade);
      socket.off('player_moved', onMoveMade);
      socket.off('playerMoved', onMoveMade);
      socket.off('move', onMoveMade);

      socket.off('boardState', onBoardState);
      socket.off('gameState', onBoardState);
      socket.off('gameStateUpdate', onBoardState);
      socket.off('state_update', onBoardState);

      socket.off('move_rejected', onMoveRejected);
      socket.off('moveRejected', onMoveRejected);

      socket.off('clock_sync', onClockSync);
      socket.off('clockSync', onClockSync);
      socket.off('timerUpdate', onClockSync);
      socket.off('timer_update', onClockSync);

      socket.off('draw_offered', onDrawOffered);
      socket.off('drawOffered', onDrawOffered);
      socket.off('draw_accepted', onDrawAccepted);
      socket.off('drawAccepted', onDrawAccepted);
      socket.off('draw_declined', onDrawDeclined);
      socket.off('drawDeclined', onDrawDeclined);

      socket.off('game_over', onGameOver);
      socket.off('gameOver', onGameOver);
      socket.off('match_aborted', onMatchAborted);
      socket.off('matchAborted', onMatchAborted);
      socket.off('reconnect_success', onReconnectSuccess);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('opponentDisconnected', onOpponentDisconnected);
      socket.off('playerDisconnected', onOpponentDisconnected);
      socket.off('playerReconnected', onOpponentReconnected);
      socket.off('opponentReconnected', onOpponentReconnected);
      socket.off('rematch_offered', onRematchOffered);
      socket.off('rematchOffered', onRematchOffered);
      socket.off('rematch_declined', onRematchDeclined);
      socket.off('rematchDeclined', onRematchDeclined);
      socket.off('rematch_started', onRematchStarted);
      socket.off('rematchStarted', onRematchStarted);
      socket.off('game_reset', onRematchStarted);
    };
  }, [matchId, myUid]);

  useEffect(() => {
    if (!matchId) return;
    const unsubChat = listenToInGameMessages(matchId, (msgs) => {
      if (msgs.length > chatMessages.length) {
        const lastMsg = msgs[msgs.length - 1];
        const isMsgMe = lastMsg.senderUid === myUid;
        if (!isMsgMe && !isMuted) {
          if (lastMsg.type === 'text') soundManager.playChat();
          else soundManager.playEmote();
        }
      }
      setChatMessages(msgs);
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && (lastMsg.type === 'emote' || lastMsg.type === 'canned')) {
        const isMsgMe = lastMsg.senderUid === myUid;
        if (isMuted && !isMsgMe) return;
        if (!isMsgMe) soundManager.playEmote();
        const newEmote: FloatingEmote = {
          id: `emote_${Date.now()}_${Math.random()}`,
          emote: lastMsg.text,
          isMe: isMsgMe
        };
        setFloatingEmotes(prev => [...prev, newEmote]);
        setTimeout(() => {
          setFloatingEmotes(prev => prev.filter(e => e.id !== newEmote.id));
        }, 2500);
      }
    });
    const unsubTyping = listenToInGameTypingStatus(matchId, setTypingMap);
    return () => {
      unsubChat();
      unsubTyping();
    };
  }, [matchId, myUid, isMuted, chatMessages.length]);

  useEffect(() => {
    if (activeTab === 'chat') setSeenChatCount(chatMessages.length);
  }, [activeTab, chatMessages.length]);

  const unreadChatCount = Math.max(0, chatMessages.length - seenChatCount);

  useEffect(() => {
    if (!isGameLive) return;
    const isDisconnectedBeforeFirstMove = (!session?.moves || session.moves.length === 0) && (!isOpponentPresent || socketStatus !== 'connected');
    if (isDisconnectedBeforeFirstMove) return;
    if (!session?.moves || session.moves.length === 0) return;

    const interval = setInterval(() => {
      if (session?.turn === 'w') setWhiteTime(prev => Math.max(0, prev - 1));
      else setBlackTime(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isGameLive, session?.turn, isOpponentPresent, socketStatus]);

  useEffect(() => {
    if (!session || !isGameLive) return;
    if (isMyTurn) return;

    const opp = isWhitePlayer ? session.blackPlayer : session.whitePlayer;
    if (opp?.uid?.startsWith('ww_')) {
      const timer = setTimeout(async () => {
        try {
          const currentG = new Chess(session.fen);
          if (currentG.isGameOver()) return;
          const oppColor = isWhitePlayer ? 'b' : 'w';
          const botMove = getBotMoveForElo(currentG, opp.elo || 1800);
          if (!botMove) return;
          const moveResult = currentG.move({
            from: botMove.from,
            to: botMove.to,
            promotion: botMove.promotion || 'q'
          });
          if (!moveResult) return;
          if (currentG.isCheckmate()) soundManager.playDefeat();
          else if (currentG.inCheck()) soundManager.playCheck();
          else if (moveResult.captured) soundManager.playCapture(moveResult.piece, moveResult.color);
          else soundManager.playMove(moveResult.piece, moveResult.color);

          let nextStatus: 'in_progress' | 'checkmate' | 'draw' = 'in_progress';
          let nextWinner: 'w' | 'b' | 'draw' | null = null;
          let nextReason: string | undefined = undefined;

          if (currentG.isCheckmate()) {
            nextStatus = 'checkmate';
            nextWinner = oppColor;
            nextReason = `Checkmate! ${opp.displayName} wins the match.`;
            if (session?.tournamentId && session?.tournamentMatchId) {
              advanceTournamentMatch(session.tournamentId, session.tournamentMatchId, opp.uid).catch(console.error);
            }
          } else if (currentG.isDraw()) {
            nextStatus = 'draw';
            nextWinner = 'draw';
            nextReason = 'Game drawn.';
          }

          const inc = session.timeControl.incrementSeconds || 0;
          const newWhiteTime = oppColor === 'w' ? whiteTime + inc : whiteTime;
          const newBlackTime = oppColor === 'b' ? blackTime + inc : blackTime;

          await sendOnlineMove(
            matchId,
            currentG.fen(),
            currentG.pgn(),
            myColor,
            botMove.from,
            botMove.to,
            newWhiteTime,
            newBlackTime,
            nextStatus,
            nextWinner,
            nextReason
          );
        } catch (err) {
          console.error('Error calculating worldwide challenger move:', err);
        }
      }, 300 + Math.random() * 300);
      return () => clearTimeout(timer);
    }
  }, [session, isMyTurn, isWhitePlayer, myColor, whiteTime, blackTime, matchId]);

  const handleMakeMove = useCallback((from: string, to: string) => {
      if (!isMyTurn || !isGameLive || isPendingMove) return;
      const piece = game.get(from as Square);
      const isPawn = piece?.type === 'p';
      const isPromotion = isPawn && ((piece?.color === 'w' && to[1] === '8') || (piece?.color === 'b' && to[1] === '1'));
      if (isPromotion) {
        setPendingPromotion({ from: from as Square, to: to as Square | null });
        return;
      }
      const tempGame = new Chess(game.fen());
      const moveResult = tempGame.move({ from: from as Square, to: to as Square, promotion: 'q' });
      if (!moveResult) return;
      setIsPendingMove(true);
      setLastMove({ from, to });
      // Optimistically update board state for instantaneous feel
      setGame(tempGame);
      setMoveHistory(tempGame.history());
      setMoveIndex(tempGame.history().length);
      setEvalScore(evaluateBoard(tempGame));

      if (tempGame.isCheckmate()) soundManager.playVictory();
      else if (tempGame.inCheck()) soundManager.playCheck();
      else if (moveResult.captured) soundManager.playCapture(moveResult.piece, moveResult.color);
      else soundManager.playMove(moveResult.piece, moveResult.color);

      const newFen = tempGame.fen();
      const newPgn = tempGame.pgn();
      const nextTurn = tempGame.turn();
      const isCheckmate = tempGame.isCheckmate();
      const isDraw = tempGame.isDraw();
      let nextStatus: 'in_progress' | 'checkmate' | 'draw' = 'in_progress';
      let nextWinner: 'w' | 'b' | 'draw' | null = null;
      let nextReason: string | undefined = undefined;
      const moveColor = piece?.color || myColor;
      if (isCheckmate) {
        nextStatus = 'checkmate';
        nextWinner = moveColor;
        nextReason = `Checkmate! ${me?.displayName || 'Player'} wins the match.`;
      } else if (isDraw) {
        nextStatus = 'draw';
        nextWinner = 'draw';
        nextReason = 'Game drawn.';
      }
      const inc = session?.timeControl?.incrementSeconds || 0;
      const newWhiteTime = moveColor === 'w' ? whiteTime + inc : whiteTime;
      const newBlackTime = moveColor === 'b' ? blackTime + inc : blackTime;

      // Keep session in React state synchronized
      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          fen: newFen,
          pgn: newPgn,
          turn: nextTurn,
          moves: [...(prev.moves || []), moveResult.san],
          moveCount: (prev.moveCount || 0) + 1,
          whiteSecondsRemaining: newWhiteTime,
          blackSecondsRemaining: newBlackTime,
          status: nextStatus,
          winner: nextWinner,
        };
      });

      sendOnlineMove(
        matchId,
        newFen,
        newPgn,
        nextTurn,
        from,
        to,
        newWhiteTime,
        newBlackTime,
        nextStatus,
        nextWinner,
        nextReason
      ).catch(err => console.error('Error updating move in Firestore:', err));

      // Automatic fallback to release pending move state
      setTimeout(() => setIsPendingMove(false), 800);

      const socket = socketService.getSocket();
      if (socket) {
        const movePayload = {
          matchId,
          gameId: matchId,
          gameCode: matchId,
          uid: myUid,
          from,
          to,
          promotion: 'q',
          moveIndex,
          fen: newFen,
          session: {
            ...session,
            fen: newFen,
            pgn: newPgn,
            turn: nextTurn,
            status: nextStatus,
            whiteSecondsRemaining: newWhiteTime,
            blackSecondsRemaining: newBlackTime
          }
        };
        socket.emit('make_move', movePayload);
        socket.emit('makeMove', movePayload);
      }
    }, [isMyTurn, isGameLive, session, myUid, matchId, moveIndex, isPendingMove, game, myColor, me, whiteTime, blackTime]);

  const handleConfirmPromotion = (promoPiece: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion || !session) return;
    const { from, to } = pendingPromotion;
    setPendingPromotion(null);
    const tempGame = new Chess(game.fen());
    const moveResult = tempGame.move({ from, to: to as Square, promotion: promoPiece });
    if (!moveResult) return;
    setIsPendingMove(true);
    setLastMove({ from: from as string, to: to as string | null });
    // Optimistically update board state for instantaneous feel
    setGame(tempGame);
    setMoveHistory(tempGame.history());
    setMoveIndex(tempGame.history().length);
    setEvalScore(evaluateBoard(tempGame));

    if (tempGame.isCheckmate()) soundManager.playVictory();
    else if (tempGame.inCheck()) soundManager.playCheck();
    else if (moveResult.captured) soundManager.playCapture(moveResult.piece, moveResult.color);
    else soundManager.playMove(moveResult.piece, moveResult.color);

    const newFen = tempGame.fen();
    const newPgn = tempGame.pgn();
    const nextTurn = tempGame.turn();
    const isCheckmate = tempGame.isCheckmate();
    const isDraw = tempGame.isDraw();
    let nextStatus: 'in_progress' | 'checkmate' | 'draw' = 'in_progress';
    let nextWinner: 'w' | 'b' | 'draw' | null = null;
    let nextReason: string | undefined = undefined;
    if (isCheckmate) {
      nextStatus = 'checkmate';
      nextWinner = myColor;
      nextReason = `Checkmate! ${me?.displayName || 'Player'} wins the match.`;
    } else if (isDraw) {
      nextStatus = 'draw';
      nextWinner = 'draw';
      nextReason = 'Game drawn.';
    }
    const inc = session.timeControl?.incrementSeconds || 0;
    const newWhiteTime = myColor === 'w' ? whiteTime + inc : whiteTime;
    const newBlackTime = myColor === 'b' ? blackTime + inc : blackTime;

    setSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        fen: newFen,
        pgn: newPgn,
        turn: nextTurn,
        moves: [...(prev.moves || []), moveResult.san],
        moveCount: (prev.moveCount || 0) + 1,
        whiteSecondsRemaining: newWhiteTime,
        blackSecondsRemaining: newBlackTime,
        status: nextStatus,
        winner: nextWinner,
      };
    });

    sendOnlineMove(
      matchId,
      newFen,
      newPgn,
      nextTurn,
      from as string,
      to as string,
      newWhiteTime,
      newBlackTime,
      nextStatus,
      nextWinner,
      nextReason
    ).catch(err => console.error('Error updating move in Firestore:', err));

    setTimeout(() => setIsPendingMove(false), 800);

    const socket = socketService.getSocket();
    if (socket) {
      const movePayload = {
        matchId,
        gameId: matchId,
        gameCode: matchId,
        uid: myUid,
        from: from as string,
        to: to as string,
        promotion: promoPiece,
        moveIndex,
        fen: newFen,
        session: {
          ...session,
          fen: newFen,
          pgn: newPgn,
          turn: nextTurn,
          status: nextStatus,
          whiteSecondsRemaining: newWhiteTime,
          blackSecondsRemaining: newBlackTime
        }
      };
      socket.emit('make_move', movePayload);
      socket.emit('makeMove', movePayload);
    }
  };

  const canClaimDraw = isGameLive && (game.isThreefoldRepetition() || game.isDraw());

  const handleClaimDraw = async () => {
    if (!session || !canClaimDraw) return;
    await finalizeOnlineMatch(matchId, 'draw', 'Game drawn by 50-move rule or threefold repetition.');
  };

  const handleRematch = async () => {
    if (!session || !myUid) return;

    const opp = isWhitePlayer ? session.blackPlayer : session.whitePlayer;
    const isBot = opp?.uid?.startsWith('ww_');

    await offerRematchOnlineMatch(matchId, myUid);

    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('offer_rematch', { matchId, gameId: matchId, uid: myUid });
      socket.emit('offerRematch', { matchId, gameId: matchId, uid: myUid });
    }

    if (isBot) {
      // Bots accept rematches instantly
      await acceptRematchOnlineMatch(matchId, session);
      if (socket) {
        socket.emit('accept_rematch', { matchId, gameId: matchId, uid: opp?.uid || 'bot' });
        socket.emit('acceptRematch', { matchId, gameId: matchId, uid: opp?.uid || 'bot' });
      }
    }
  };

  const handleAcceptRematch = async () => {
    if (!session) return;
    await acceptRematchOnlineMatch(matchId, session);
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('accept_rematch', { matchId, gameId: matchId, uid: myUid });
      socket.emit('acceptRematch', { matchId, gameId: matchId, uid: myUid });
    }
  };

  const handleResign = async () => {
    if (!session || !isGameLive) return;
    if (window.confirm('Are you sure you want to resign the online match?')) {
      const socket = socketService.getSocket();
      if (socket) socket.emit('resign', { matchId, uid: myUid });
      if (session.tournamentId && session.tournamentMatchId) {
        const winnerColor = myColor === 'w' ? 'b' : 'w';
        const winnerPlayer = winnerColor === 'w' ? session.whitePlayer : session.blackPlayer;
        if (winnerPlayer) advanceTournamentMatch(session.tournamentId, session.tournamentMatchId, winnerPlayer.uid).catch(console.error);
      }
    }
  };

  const handleOfferDraw = async () => {
    if (!session) return;
    const currentUid = profile?.uid || user?.uid;
    const socket = socketService.getSocket();
    if (session.drawOfferFrom && session.drawOfferFrom !== currentUid) {
      await acceptDrawOnlineMatch(matchId);
      if (socket) {
        socket.emit('accept_draw', { matchId, gameId: matchId });
        socket.emit('acceptDraw', { matchId, gameId: matchId });
      }
    } else if (currentUid) {
      await offerDrawOnlineMatch(matchId, currentUid);
      setPendingDraw(true);
      if (socket) {
        socket.emit('offer_draw', { matchId, gameId: matchId, uid: currentUid });
        socket.emit('offerDraw', { matchId, gameId: matchId, uid: currentUid });
      }
    }
  };

  const handleSendMessage = async (text: string, type: 'text' | 'canned' | 'emote') => {
    if (!myUid) return;
    await sendInGameMessage(matchId, {
      senderUid: myUid,
      senderName: profile?.displayName || 'Player',
      text,
      type
    });
  };

  const handleTyping = (isTyping: boolean) => {
    if (!myUid) return;
    setInGameTypingStatus(matchId, myUid, isTyping);
  };

  const handleCopyMatchId = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(matchId);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const isDocLoading = loadState === 'loading' || !session || !session.fen || session.fen.trim().length === 0;

  if (isDocLoading) {
    return (
      <PanelContainer>
        <div className="obsidian-panel rounded-3xl p-10 flex flex-col items-center justify-center gap-4 text-center">
          {loadState === 'missing' ? (
            <>
              <AlertTriangle className="w-10 h-10 text-[#F59E0B]" />
              <h2 className="text-lg font-black text-white">Match not found</h2>
              <p className="text-xs text-[#94A3B8] max-w-sm">
                This match room no longer exists or has expired. Head back to the lobby and start a new match.
              </p>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full border-4 border-[#F59E0B] border-t-transparent animate-spin" />
              <h2 className="text-lg font-black text-white">Loading Game State...</h2>
              <p className="text-xs text-[#94A3B8]">Synchronizing board and player credentials</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold transition-colors cursor-pointer border border-white/10"
              >
                Retry Connection
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="mt-2 px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black cursor-pointer"
          >
            Back to Lobby
          </button>
        </div>
      </PanelContainer>
    );
  }

  return (
    <PanelContainer>
      <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        <ConnectionStatus
          status={socketStatus === 'connected' ? 'online' : socketStatus === 'reconnecting' ? 'syncing' : 'offline'}
          latency={24}
        />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="glass-panel p-3.5 sm:p-4 rounded-3xl border border-[#F5C453]/30 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-[#8C2425] via-[#52673A] to-[#F5C453] text-[#F5C453] border border-[#F5C453]/40 shadow-md">
              <Swords className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Live Online Match
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-[#8C2425]/40 text-[#F5C453] text-[10px] font-black border border-[#F5C453]/40 uppercase">
                  {session?.timeControl?.name || 'Rapid'}
                </span>
              </div>
              <p className="text-xs text-[#DFD0B0]/70">
                Battle for Peshmerga Grandmaster Honor & Respect Points
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'moves' ? 'chat' : 'moves')}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer relative ${
                activeTab === 'chat'
                  ? 'bg-[#52673A] text-white border-[#F5C453] shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border-white/10'
              }`}
              title="Toggle In-Game Match Chat"
            >
              <MessageSquare className="w-4 h-4 text-[#F59E0B]" />
              <span>{activeTab === 'chat' ? 'Show Moves' : 'Show Chat'}</span>
              {unreadChatCount > 0 && activeTab !== 'chat' && (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg border-2 border-[var(--app-bg)] animate-bounce">
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleCopyMatchId}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-bold flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
              title="Copy Match ID"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="font-mono text-[11px]">{copiedLink ? 'Copied ID' : 'Match ID'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Leave</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 flex flex-col items-center relative">
            <div className="w-full max-w-[560px] mb-2.5">
              <ModernSpectatorWidget
                playerName={me?.displayName || 'Player'}
                onOpenSpectatorChat={() => setActiveTab('chat')}
              />
            </div>

            <div className="w-full max-w-[560px] mb-2 flex flex-col gap-1.5 relative">
              <ChessClock
                timeSeconds={isWhitePlayer ? blackTime : whiteTime}
                totalTimeSeconds={session?.timeControl?.initialSeconds || 600}
                isActive={session?.turn !== myColor && isGameLive}
                isWhite={!isWhitePlayer}
                playerName={opponent?.displayName || 'Opponent'}
                playerTitle={opponent?.honorRank}
                avatar={opponent?.avatar || opponent?.photoURL || (isWhitePlayer ? '♚' : '♔')}
                elo={opponent?.elo || 1200}
              />
              <div className="absolute top-0 left-12 z-20">
                <AnimatePresence>
                  {floatingEmotes.filter(e => !e.isMe).map(e => (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, y: 0, scale: 0.5 }}
                      animate={{ opacity: 1, y: -40, scale: 1.5 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ duration: 1, type: 'spring' }}
                      className="text-3xl pointer-events-none drop-shadow-2xl"
                    >
                      {e.emote}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <div className="px-2 flex items-center justify-between">
                <CapturedPieces
                  pieces={isWhitePlayer ? capturedMaterial.capturedByBlack : capturedMaterial.capturedByWhite}
                  pieceTheme={settings.pieceTheme}
                  colorOfCapturedPieces={isWhitePlayer ? 'w' : 'b'}
                  materialAdvantage={
                    isWhitePlayer
                      ? capturedMaterial.materialDifference < 0
                        ? Math.abs(capturedMaterial.materialDifference)
                        : 0
                      : capturedMaterial.materialDifference > 0
                        ? capturedMaterial.materialDifference
                        : 0
                  }
                />
              </div>
            </div>

            <div className={`relative p-2.5 sm:p-3.5 rounded-3xl bg-[#10140e] border-2 border-[#F5C453]/30 shadow-2xl ${settings.boardTheme === 'one-piece' ? 'one-piece-board-bg' : ''}`}>
              <AnimatePresence>
                {socketStatus !== 'connected' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 rounded-3xl"
                  >
                    <div className="w-10 h-10 rounded-full border-4 border-[#F5C453] border-t-transparent animate-spin" />
                    <span className="text-white font-black uppercase tracking-widest text-xs">
                      {socketStatus === 'reconnecting' ? 'Reconnecting...' : 'Connecting to Arena...'}
                    </span>
                  </motion.div>
                )}
                {socketStatus === 'connected' && session?.status === 'waiting' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-[60] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center gap-4 p-6 rounded-3xl text-center shadow-2xl"
                  >
                    <div className="relative w-16 h-16 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full bg-[#F5C453]/25 animate-ping" />
                      <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#52673A] to-[#F5C453] p-0.5 shadow-xl">
                        <div className="w-full h-full bg-[#161c12] rounded-full flex items-center justify-center text-[#F5C453]">
                          <Users className="w-7 h-7 animate-pulse" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-[#F5C453] tracking-widest block">
                        Game Room Code
                      </span>
                      <span className="font-mono text-3xl font-black text-white tracking-[0.25em] select-all">
                        {session.code || matchId}
                      </span>
                    </div>
                    <p className="text-xs text-[#DFD0B0]/80 max-w-xs">
                      Waiting for opponent to connect. Both players will enter the board automatically once joined!
                    </p>
                    <button
                      onClick={handleCopyMatchId}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#52673A] to-[#8C2425] hover:brightness-110 text-white text-xs font-black flex items-center gap-1.5 shadow-lg border border-[#F5C453]/40 cursor-pointer transition-all"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedLink ? 'Copied to Clipboard' : 'Copy Room Code'}</span>
                    </button>
                  </motion.div>
                )}
                {session?.status === 'awaiting_fate' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center gap-6 p-6 rounded-3xl text-center shadow-2xl border-2 border-[#F5C453]/30"
                  >
                    <div className="space-y-2">
                      <h2 className="text-3xl font-black text-white tracking-tighter uppercase">
                        Fate Decision
                      </h2>
                      <p className="text-xs text-[#DFD0B0]/70 font-bold uppercase tracking-widest">
                        {session.winner === myUid || (session.winner === 'w' && isWhitePlayer) || (session.winner === 'b' && !isWhitePlayer)
                          ? 'You have claimed victory. How shall the fallen be treated?'
                          : 'Your fate is in the hands of your opponent...'}
                      </p>
                    </div>

                    {session.winner === myUid || (session.winner === 'w' && isWhitePlayer) || (session.winner === 'b' && !isWhitePlayer) ? (
                      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                        <button
                          onClick={async () => {
                            try { await resolveFate(matchId, 'execute', myUid); } catch (e) { console.error(e); }
                          }}
                          className="flex-1 py-4 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-rose-900/40 border border-rose-400/30 cursor-pointer"
                        >
                          Execute
                        </button>
                        <button
                          onClick={async () => {
                            try { await resolveFate(matchId, 'spare', myUid); } catch (e) { console.error(e); }
                          }}
                          className="flex-1 py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-900/40 border border-emerald-400/30 cursor-pointer"
                        >
                          Spare
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full border-4 border-[#F5C453] border-t-transparent animate-spin" />
                        <span className="text-xs font-black text-[#F5C453] uppercase tracking-widest">
                          Awaiting Judgment...
                        </span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <ChessBoard
                game={game}
                isFlipped={manualFlipped !== null ? manualFlipped : !isWhitePlayer}
                boardTheme={settings.boardTheme}
                pieceTheme={settings.pieceTheme}
                whitePieceTheme={settings.whitePieceTheme}
                blackPieceTheme={settings.blackPieceTheme}
                showCoordinates={settings.showCoordinates}
                highlightLastMove={settings.highlightLastMove}
                showLegalMoves={settings.showLegalMoves}
                lastMove={lastMove}
                onMove={handleMakeMove}
                disabled={!isMyTurn || !isGameLive}
                evalScore={evalScore}
                showWeather={showWeather}
                showTerritory={showTerritory}
                is3dPerspective={is3dPerspective}
                showGameOverOverlay={false}
              />

              <div className="mt-2.5 px-4 py-2 rounded-2xl bg-black/80 backdrop-blur-md border border-[#F5C453]/30 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F5C453] animate-ping shrink-0" />
                  <span className="font-bold text-white truncate">
                    {!isGameLive
                      ? `Match ${session?.status?.toUpperCase() || 'CONNECTING'}`
                      : isMyTurn
                        ? 'Your Turn — Choose your move'
                        : `${opponent?.displayName || 'Opponent'} is thinking...`}
                  </span>
                </div>
                <span className="text-[#DFD0B0]/70 font-mono text-[11px] whitespace-nowrap">
                  You play as {isWhitePlayer ? 'White ⚪' : 'Black ⚫'}
                </span>
              </div>
            </div>

            <div className="w-full max-w-[560px] my-2">
              <ModernFloatingControls
                onResign={handleResign}
                onOfferDraw={handleOfferDraw}
                onClaimDraw={handleClaimDraw}
                canClaimDraw={canClaimDraw}
                is3dPerspective={is3dPerspective}
                onToggle3dPerspective={() => setIs3dPerspective(!is3dPerspective)}
                onFlipBoard={() => setManualFlipped(prev => prev === null ? isWhitePlayer : !prev)}
                disabled={!isGameLive}
              />
            </div>

            <div className="w-full max-w-[560px] mt-2 flex flex-col gap-1.5 relative">
              <div className="px-2 flex items-center justify-between">
                <CapturedPieces
                  pieces={isWhitePlayer ? capturedMaterial.capturedByWhite : capturedMaterial.capturedByBlack}
                  pieceTheme={settings.pieceTheme}
                  colorOfCapturedPieces={isWhitePlayer ? 'b' : 'w'}
                  materialAdvantage={
                    isWhitePlayer
                      ? capturedMaterial.materialDifference > 0
                        ? capturedMaterial.materialDifference
                        : 0
                      : capturedMaterial.materialDifference < 0
                        ? Math.abs(capturedMaterial.materialDifference)
                        : 0
                  }
                />
              </div>
              <ChessClock
                timeSeconds={isWhitePlayer ? whiteTime : blackTime}
                totalTimeSeconds={session?.timeControl?.initialSeconds || 600}
                isActive={isMyTurn && isGameLive}
                isWhite={isWhitePlayer}
                playerName={profile?.displayName || 'You'}
                playerTitle={profile?.honorRank}
                avatar={profile?.photoURL || (isWhitePlayer ? '♔' : '♚')}
                elo={Number(profile?.elo) || 1200}
              />
              <div className="absolute bottom-16 left-12 z-20">
                <AnimatePresence>
                  {floatingEmotes.filter(e => e.isMe).map(e => (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, y: 0, scale: 0.5 }}
                      animate={{ opacity: 1, y: -40, scale: 1.5 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ duration: 1, type: 'spring' }}
                      className="text-3xl pointer-events-none drop-shadow-2xl"
                    >
                      {e.emote}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-4 h-full min-h-0 overflow-hidden">
            <div className="glass-panel rounded-3xl border border-white/10 flex-1 flex flex-col overflow-hidden shadow-2xl relative min-h-[400px]">
              <div className="flex items-center p-1.5 bg-black/40 border-b border-white/10 shrink-0">
                <button
                  onClick={() => setActiveTab('moves')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all relative ${
                    activeTab === 'moves'
                      ? 'text-black'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {activeTab === 'moves' && (
                    <motion.div
                      layoutId="match-tab-bg"
                      className="absolute inset-0 bg-[#F5C453] rounded-2xl shadow-lg shadow-[#F5C453]/20"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <Layers className="w-3.5 h-3.5 relative z-10" />
                  <span className="relative z-10">Move Log</span>
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all relative ${
                    activeTab === 'chat'
                      ? 'text-black'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {activeTab === 'chat' && (
                    <motion.div
                      layoutId="match-tab-bg"
                      className="absolute inset-0 bg-[#F5C453] rounded-2xl shadow-lg shadow-[#F5C453]/20"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <MessageSquare className="w-3.5 h-3.5 relative z-10" />
                  <span className="relative z-10">Match Chat</span>
                  {unreadChatCount > 0 && activeTab !== 'chat' && (
                    <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-bounce shadow-lg border-2 border-[var(--app-bg)] relative z-20">
                      {unreadChatCount}
                    </span>
                  )}
                </button>
              </div>

              <div className="flex-1 min-h-0 relative">
                <AnimatePresence mode="wait">
                  {activeTab === 'moves' ? (
                    <motion.div
                      key="match-moves"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="h-full flex flex-col"
                    >
                      <div className="flex items-center justify-between p-3 border-b border-white/5 bg-black/20">
                        <h4 className="text-[10px] font-black text-[#DFD0B0]/50 uppercase tracking-widest">
                          Tactical History
                        </h4>
                        <span className="px-2 py-0.5 rounded bg-white/5 text-[9px] text-white/60 font-mono">
                          {moveHistory.length} Moves
                        </span>
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-1 p-3 custom-scrollbar">
                        {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => (
                          <div key={i} className="grid grid-cols-6 items-center gap-2 py-1 border-b border-white/5 last:border-0 font-mono">
                            <span className="col-span-1 text-[10px] text-white/30 font-black">{i + 1}.</span>
                            <span className={`col-span-2 text-xs font-bold cursor-pointer hover:text-[#F5C453] transition-colors ${moveIndex === i * 2 + 1 ? 'text-[#F5C453]' : 'text-white/80'}`}>
                              {moveHistory[i * 2]}
                            </span>
                            {moveHistory[i * 2 + 1] && (
                              <span className={`col-span-3 text-xs font-bold cursor-pointer hover:text-[#F5C453] transition-colors ${moveIndex === i * 2 + 2 ? 'text-[#F5C453]' : 'text-white/80'}`}>
                                {moveHistory[i * 2 + 1]}
                              </span>
                            )}
                          </div>
                        ))}
                        {moveHistory.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center text-[#DFD0B0]/20 gap-3 py-10">
                            <Layers className="w-10 h-10 opacity-20" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Awaiting First Strike</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="match-chat"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="h-full"
                    >
                      <InGameChatPanel
                        messages={chatMessages}
                        onSendMessage={handleSendMessage}
                        myUid={myUid}
                        opponentName={opponent?.displayName || 'Opponent'}
                        opponentUid={opponent?.uid}
                        isMuted={isMuted}
                        onToggleMute={() => setIsMuted(prev => !prev)}
                        typingMap={typingMap}
                        onTyping={handleTyping}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {Boolean(
              session?.status === 'aborted' ||
              (session?.status === 'abandoned' && !hasMovesPlayed)
            ) && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  className="relative obsidian-panel rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center border-[#1F293D]"
                >
                  <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-[#94A3B8] hover:text-white p-1.5 rounded-xl hover:bg-[#1F293D] transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#0B0F19] border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-2xl">
                    <AlertTriangle className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight uppercase">
                    Match Aborted
                  </h2>
                  <p className="text-xs font-black text-[#94A3B8] uppercase tracking-[0.2em] mb-6 opacity-80">
                    {session?.reason || 'The match was aborted before play started. No rating changes were applied.'}
                  </p>
                  <button
                    onClick={onClose}
                    className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-2xl bg-[#52673A] hover:bg-[#627c45] text-white font-black text-sm transition-all shadow-xl active:scale-95 cursor-pointer uppercase tracking-widest"
                  >
                    <span>Return to Lobby</span>
                  </button>
                </motion.div>
              </div>
            )}

            {isGameOver() && (
              <GameOverModal
                result={{
                  winner:
                    session.winner === 'w' || session.winner === 'b' || session.winner === 'draw'
                      ? session.winner
                      : session.winner === 'white'
                      ? 'w'
                      : session.winner === 'black'
                      ? 'b'
                      : Boolean(session.winner) && (session.winner === session.whitePlayer?.uid || session.winner === session.whiteId)
                      ? 'w'
                      : Boolean(session.winner) && (session.winner === session.blackPlayer?.uid || session.winner === session.blackId)
                      ? 'b'
                      : 'draw',
                  reason: session.reason || 'Match Concluded'
                }}
                pgn={session.pgn || game.pgn() || ''}
                rematchState={
                  session.rematchOfferFrom
                    ? session.rematchOfferFrom === myUid
                      ? 'offered_by_me'
                      : 'offered_by_opponent'
                    : 'none'
                }
                onRematch={handleRematch}
                onAcceptRematch={handleAcceptRematch}
                onNewGame={() => {
                  if (onClose) onClose();
                  else window.location.reload();
                }}
                onAnalyze={onClose}
                onClose={onClose}
              />
            )}

            <div className="glass-panel p-4 rounded-3xl border border-white/10 space-y-4">
              <h4 className="text-xs font-bold text-[#DFD0B0]/70 uppercase tracking-wider">
                Match Controls
              </h4>
              {session?.drawOfferFrom && session.drawOfferFrom !== profile?.uid && (
                <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-2">
                  <span>Opponent offered a draw!</span>
                  <button
                    type="button"
                    onClick={handleOfferDraw}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-black text-xs transition-colors cursor-pointer"
                  >
                    Accept Draw
                  </button>
                </div>
              )}
              <VoiceMoveDictator
                game={game}
                onVoiceMove={handleMakeMove}
                disabled={!isMyTurn || !isGameLive}
              />
              <LiveHypeMeter matchId={matchId} />
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showWeather}
                    onChange={e => setShowWeather(e.target.checked)}
                    className="form-checkbox text-amber-500 rounded bg-black/40 border-white/20"
                  />
                  <span className="text-xs text-white/80 font-bold">Dynamic Weather</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTerritory}
                    onChange={e => setShowTerritory(e.target.checked)}
                    className="form-checkbox text-emerald-500 rounded bg-black/40 border-white/20"
                  />
                  <span className="text-xs text-white/80 font-bold">Territory Heatmap</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleOfferDraw}
                  disabled={!isGameLive}
                  className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                >
                  <Handshake className="w-4 h-4 text-amber-400" />
                  <span>Offer Draw</span>
                </button>
                <button
                  type="button"
                  onClick={handleResign}
                  disabled={!isGameLive}
                  className="py-2.5 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-40 text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-rose-500/30 transition-colors cursor-pointer"
                >
                  <Flag className="w-4 h-4 text-rose-400" />
                  <span>Resign</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {pendingPromotion && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="glass-panel p-6 rounded-3xl border-2 border-[#F5C453] shadow-2xl max-w-xs w-full text-center space-y-4 animate-in zoom-in-95">
            <h3 className="text-lg font-black text-white">Promote Pawn</h3>
            <p className="text-xs text-[#DFD0B0]/70">
              Select piece for promotion:
            </p>
            <div className="grid grid-cols-4 gap-2 pt-1">
              <button
                onClick={() => handleConfirmPromotion('q')}
                className="p-3 rounded-2xl bg-white/10 hover:bg-[#52673A] border border-[#F5C453]/40 text-white hover:text-[#F5C453] flex flex-col items-center gap-1 transition-all cursor-pointer group"
                title="Queen"
              >
                <span className="text-3xl group-hover:scale-110 transition-transform">♛</span>
                <span className="text-[10px] font-black uppercase">Queen</span>
              </button>
              <button
                onClick={() => handleConfirmPromotion('r')}
                className="p-3 rounded-2xl bg-white/10 hover:bg-[#52673A] border border-[#F5C453]/40 text-white hover:text-[#F5C453] flex flex-col items-center gap-1 transition-all cursor-pointer group"
                title="Rook"
              >
                <span className="text-3xl group-hover:scale-110 transition-transform">♜</span>
                <span className="text-[10px] font-black uppercase">Rook</span>
              </button>
              <button
                onClick={() => handleConfirmPromotion('b')}
                className="p-3 rounded-2xl bg-white/10 hover:bg-[#52673A] border border-[#F5C453]/40 text-white hover:text-[#F5C453] flex flex-col items-center gap-1 transition-all cursor-pointer group"
                title="Bishop"
              >
                <span className="text-3xl group-hover:scale-110 transition-transform">♝</span>
                <span className="text-[10px] font-black uppercase">Bishop</span>
              </button>
              <button
                onClick={() => handleConfirmPromotion('n')}
                className="p-3 rounded-2xl bg-white/10 hover:bg-[#52673A] border border-[#F5C453]/40 text-white hover:text-[#F5C453] flex flex-col items-center gap-1 transition-all cursor-pointer group"
                title="Knight"
              >
                <span className="text-3xl group-hover:scale-110 transition-transform">♞</span>
                <span className="text-[10px] font-black uppercase">Knight</span>
              </button>
            </div>
            <button
              onClick={() => setPendingPromotion(null)}
              className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel Move
            </button>
          </div>
        </div>
      )}
    </PanelContainer>
  );
};
