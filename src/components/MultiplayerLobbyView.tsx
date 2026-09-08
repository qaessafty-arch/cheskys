import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PanelContainer } from './PanelContainer';
import { 
  AppSettings, 
  TimeControl, 
  PieceColor, 
  OnlineMatchPlayer,
  OnlineMatchSession 
} from '../types/chess';
import { TIME_CONTROLS } from '../utils/chessEngine';
import { useAuth } from '../context/AuthContext';
import { 
  createOnlineMatch, 
  joinOnlineMatch,
  joinWorldwideMatchmaking,
  listenToOnlineMatchSession,
  listenToPublicOpenMatches,
  generateGameRoomCode,
  listenToUserCreatedRooms,
  cancelUserCreatedRoom,
  UserCreatedRoomItem
} from '../services/onlineMatchService';
import { 
  listenToTournaments,
  createTournament,
  joinTournament,
  startMatch
} from '../services/tournamentService';
import { soundManager } from '../utils/audio';
import { getLocalPlayerUid } from '../utils/identity';
import { socketService } from '../utils/socket';
import { 
  Swords, 
  Globe, 
  Plus, 
  Users, 
  Clock, 
  Shield, 
  Crown, 
  Zap, 
  Copy, 
  Check, 
  Play, 
  ArrowRight, 
  Sparkles, 
  RefreshCw,
  Search,
  Trophy,
  DoorOpen,
  Trash2,
  ExternalLink,
  X
} from 'lucide-react';
import { Tournament, TournamentPlayer } from '../types/chess';
import { ModernWaitingRoom } from './multiplayer/ModernWaitingRoom';
import { ModernGameCreationModal } from './multiplayer/ModernGameCreationModal';

interface MultiplayerLobbyViewProps {
  settings: AppSettings;
  onStartMatch: (matchId: string) => void;
  onOpenWorldwideModal?: () => void;
}

export const MultiplayerLobbyView: React.FC<MultiplayerLobbyViewProps> = ({
  settings,
  onStartMatch,
  onOpenWorldwideModal
}) => {
  const { profile, user } = useAuth();

  const [activeTab, setActiveTab] = useState<'quick' | 'create' | 'join' | 'my_rooms' | 'open_challenges' | 'tournaments'>('quick');

  // Quick matchmaking
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimer, setSearchTimer] = useState(0);
  const [searchStatus, setSearchStatus] = useState('');
  const cancelSearchRef = useRef<(() => void) | null>(null);
  const pairWithBotRef = useRef<(() => void) | null>(null);
  const guestUidRef = useRef(getLocalPlayerUid());
  const [selectedQuickTime, setSelectedQuickTime] = useState<TimeControl>(TIME_CONTROLS[5]); // Rapid 10m

  // Create Room state
  const [selectedTimeControl, setSelectedTimeControl] = useState<TimeControl>(TIME_CONTROLS[5]);
  const [selectedSide, setSelectedSide] = useState<'w' | 'b' | 'random'>('random');
  const [isCreating, setIsCreating] = useState(false);
  const [createdMatchId, setCreatedMatchId] = useState<string | null>(null);
  const [opponentJoined, setOpponentJoined] = useState(false);
  const [pregeneratedCode, setPregeneratedCode] = useState<string>(() => generateGameRoomCode());
  const [copiedCode, setCopiedCode] = useState(false);
  const [showCreationModal, setShowCreationModal] = useState(false);

  // My Rooms state
  const [myRooms, setMyRooms] = useState<UserCreatedRoomItem[]>([]);
  const [copiedRoomCode, setCopiedRoomCode] = useState<string | null>(null);
  const [roomFilter, setRoomFilter] = useState<'all' | 'waiting' | 'in_progress' | 'completed'>('all');
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [isCancellingRoom, setIsCancellingRoom] = useState<string | null>(null);

  // Join Room state
  const [joinMatchId, setJoinMatchId] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Auto-transition host into match when opponent joins with the code
  useEffect(() => {
    if (!createdMatchId) return;
    const unsub = listenToOnlineMatchSession(createdMatchId, session => {
      if (
        session &&
        (session.status === 'in_progress' ||
          (session.guestId && session.guestId !== buildLocalPlayer().uid))
      ) {
        setOpponentJoined(true);
        soundManager.playVictory();
        // Brief delay before starting
        setTimeout(() => {
          onStartMatch(createdMatchId);
          setOpponentJoined(false);
        }, 1500);
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, [createdMatchId, onStartMatch]);

  // Open Public Matches from Firestore
  const [openMatches, setOpenMatches] = useState<OnlineMatchSession[]>([]);

  // Tournaments
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [showCreateTournament, setShowCreateTournament] = useState(false);
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentMaxPlayers, setTournamentMaxPlayers] = useState<number>(4);
  const [expandedTournamentId, setExpandedTournamentId] = useState<string | null>(null);

  // Search countdown interval
  useEffect(() => {
    let interval: any;
    if (isSearching) {
      interval = setInterval(() => {
        setSearchTimer(prev => prev + 1);
      }, 1000);
    } else {
      setSearchTimer(0);
    }
    return () => clearInterval(interval);
  }, [isSearching]);

  // Cancel any pending matchmaking search when leaving the lobby
  useEffect(() => {
    return () => {
      cancelSearchRef.current?.();
      cancelSearchRef.current = null;
    };
  }, []);

  const buildLocalPlayer = useCallback((): OnlineMatchPlayer => {
    const uid = profile?.uid || user?.uid || guestUidRef.current;
    const player: OnlineMatchPlayer = {
      uid,
      displayName: profile?.displayName || user?.displayName || 'Peshmerga Warrior',
      username: profile?.username || 'peshmerga',
      elo: Number(profile?.elo) || 1200,
      respectPoints: Number(profile?.respectPoints) || 100,
      honorRank: profile?.honorRank || 'Peshmerga Tactician',
      rankBadge: profile?.rankBadge || '🌿',
      country: profile?.country || 'Kurdistan',
      flag: profile?.flag || '☀️',
      avatar:
        profile?.photoURL ||
        user?.photoURL ||
        `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(uid)}&backgroundColor=0B0F19`
    };
    const photoURL = profile?.photoURL || user?.photoURL;
    if (photoURL) player.photoURL = photoURL;
    return player;
  }, [profile, user]);



  // Stable identifier for the local user
  const currentUid = profile?.uid || user?.uid || guestUidRef.current;

  // Listen to all rooms created by the current user
  useEffect(() => {
    if (!currentUid) return;
    const unsub = listenToUserCreatedRooms(currentUid, rooms => {
      setMyRooms(rooms);
    });
    return () => unsub();
  }, [currentUid]);

  const handleCopyRoomCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedRoomCode(code);
      soundManager.playCapture();
      setTimeout(() => {
        setCopiedRoomCode(prev => (prev === code ? null : prev));
      }, 2000);
    } catch (err) {
      console.warn('Clipboard write error:', err);
    }
  };

  const handleCancelRoom = async (code: string) => {
    if (!currentUid) return;
    setIsCancellingRoom(code);
    try {
      await cancelUserCreatedRoom(code, currentUid);
      soundManager.playMove();
    } catch (err) {
      console.warn('Error cancelling room:', err);
    } finally {
      setIsCancellingRoom(null);
    }
  };

  const formatRoomTimeAgo = (isoString?: string) => {
    if (!isoString) return 'Recently';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      if (isNaN(diffMs)) return 'Recently';
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return 'Recently';
    }
  };

  const filteredMyRooms = myRooms.filter(room => {
    if (roomFilter === 'waiting' && room.status !== 'waiting') return false;
    if (roomFilter === 'in_progress' && room.status !== 'in_progress' && room.status !== 'ready') return false;
    if (roomFilter === 'completed' && ['waiting', 'in_progress', 'ready'].includes(room.status)) return false;

    if (roomSearchQuery.trim()) {
      const q = roomSearchQuery.trim().toLowerCase();
      const matchCode = room.code.toLowerCase().includes(q);
      const matchTC = (room.timeControl?.name || '').toLowerCase().includes(q);
      const matchOpponent = (room.opponent?.displayName || '').toLowerCase().includes(q);
      if (!matchCode && !matchTC && !matchOpponent) return false;
    }

    return true;
  });

  const waitingCount = myRooms.filter(r => r.status === 'waiting').length;
  const inProgressCount = myRooms.filter(r => r.status === 'in_progress' || r.status === 'ready').length;
  const completedCount = myRooms.filter(r => !['waiting', 'in_progress', 'ready'].includes(r.status)).length;
  const activeWaitingRooms = myRooms.filter(r => r.status === 'waiting');

  // Listen to open public challenges
  useEffect(() => {
    const unsub = listenToPublicOpenMatches(matches => {
      setOpenMatches(matches);
    });

    const socket = socketService.getSocket();
    const handleRoomListUpdate = (data: any) => {
      console.log('[MultiplayerLobbyView] Received roomListUpdate:', data);
      if (data?.action === 'create' && data?.room) {
        // Optimistically append to openMatches
        setOpenMatches(prev => {
          if (prev.some(m => m.code === data.room.code)) return prev;
          const newMatch = {
            id: data.room.code,
            code: data.room.code,
            hostId: data.room.hostId || 'unknown',
            whitePlayer: data.room.side === 'w' ? { displayName: data.room.hostName } : null,
            blackPlayer: data.room.side === 'b' ? { displayName: data.room.hostName } : null,
            status: data.room.status,
            timeControl: data.room.timeControl,
            createdAt: data.room.createdAt,
          } as any;
          return [newMatch, ...prev];
        });

        // Also update myRooms if the current user is the host
        if (data.room.hostId === currentUid) {
          setMyRooms((prev: UserCreatedRoomItem[]) => {
            if (prev.some(m => m.code === data.room.code)) return prev;
            const newMyRoom: UserCreatedRoomItem = {
              id: data.room.code,
              code: data.room.code,
              timeControl: data.room.timeControl,
              side: data.room.side,
              status: data.room.status,
              createdAt: data.room.createdAt,
              isHost: true,
            };
            return [newMyRoom, ...prev];
          });
        }
      }
    };

    if (socket) {
      socket.on('roomListUpdate', handleRoomListUpdate);
    }

    return () => {
      if (unsub) unsub();
      if (socket) socket.off('roomListUpdate', handleRoomListUpdate);
    };
  }, []);

  // Listen to tournaments
  useEffect(() => {
    const unsub = listenToTournaments(data => {
      setTournaments(data);
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Quick Match Finder Logic — Firestore live queue, engine challenger as fallback
  const handleQuickMatch = async (tc: TimeControl) => {
    if (isSearching) return;
    setIsSearching(true);
    setSearchStatus('Scanning the live queue for opponents…');
    soundManager.playCapture();

    try {
      const { cancel, pairWithBotNow } = await joinWorldwideMatchmaking(
        buildLocalPlayer(),
        tc,
        matchId => {
          cancelSearchRef.current = null;
          pairWithBotRef.current = null;
          setIsSearching(false);
          setSearchStatus('');
          soundManager.playVictory();
          onStartMatch(matchId);
        },
        setSearchStatus,
        'human_first',
        20
      );
      cancelSearchRef.current = cancel;
      pairWithBotRef.current = pairWithBotNow;
    } catch (e) {
      console.error('Quick match error:', e);
      setIsSearching(false);
      setSearchStatus('');
    }
  };

  const handleCancelQuickMatch = () => {
    cancelSearchRef.current?.();
    cancelSearchRef.current = null;
    pairWithBotRef.current = null;
    setIsSearching(false);
    setSearchStatus('');
  };

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      const code = (pregeneratedCode || generateGameRoomCode()).trim().toUpperCase();
      const matchId = await createOnlineMatch(buildLocalPlayer(), selectedTimeControl, selectedSide, code);
      setCreatedMatchId(matchId);
      setIsCreating(false);
      soundManager.playCapture();
    } catch (e) {
      console.error('Create room error:', e);
      setIsCreating(false);
    }
  };

  const handleModalCreateGame = async (config: {
    timeControl: TimeControl;
    isRated: boolean;
    colorPreference: 'w' | 'b' | 'random';
    roomCode: string;
  }) => {
    const matchId = await createOnlineMatch(
      buildLocalPlayer(),
      config.timeControl,
      config.colorPreference,
      config.roomCode
    );
    setCreatedMatchId(matchId);
    setSelectedTimeControl(config.timeControl);
    setSelectedSide(config.colorPreference);
    return matchId;
  };

  const handleJoinRoom = async () => {
    const cleanId = joinMatchId.trim().toUpperCase();
    if (!cleanId) {
      setJoinError('Please enter a valid 6-character match room code.');
      return;
    }

    setIsJoining(true);
    setJoinError(null);
    try {
      await joinOnlineMatch(cleanId, buildLocalPlayer());
      setIsJoining(false);
      soundManager.playVictory();
      onStartMatch(cleanId);
    } catch (e: any) {
      console.error('Join room error:', e);
      setJoinError(e?.message || 'Match not found or already completed.');
      setIsJoining(false);
    }
  };

  const handleCopyCode = () => {
    if (!createdMatchId) return;
    navigator.clipboard.writeText(createdMatchId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCreateTournament = async () => {
    if (!tournamentName.trim()) return;
    try {
      const local = buildLocalPlayer();
      const p: TournamentPlayer = {
        uid: local.uid,
        displayName: local.displayName,
        elo: local.elo,
        avatar: local.avatar,
        rankBadge: local.rankBadge
      };
      await createTournament(tournamentName, p, tournamentMaxPlayers, selectedTimeControl);
      setShowCreateTournament(false);
      setTournamentName('');
      soundManager.playCapture();
    } catch (e) {
      console.error(e);
    }
  };

  const handleJoinTournament = async (tId: string) => {
    try {
      const local = buildLocalPlayer();
      const p: TournamentPlayer = {
        uid: local.uid,
        displayName: local.displayName,
        elo: local.elo,
        avatar: local.avatar,
        rankBadge: local.rankBadge
      };
      await joinTournament(tId, p);
      soundManager.playCapture();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Error joining tournament');
    }
  };

  const handleStartTournamentMatch = async (tId: string, matchId: string, tc: TimeControl) => {
    try {
      const sessionId = await startMatch(tId, matchId, tc);
      onStartMatch(sessionId);
    } catch (e) {
      console.error(e);
    }
  };


  if (createdMatchId) {
    return (
      <div className="w-full h-full min-h-screen flex items-center justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm animate-in fade-in">
        <ModernWaitingRoom
          gameCode={createdMatchId}
          timeControlName={selectedTimeControl.name || 'Custom'}
          isRated={true}
          playerSide={selectedSide || 'random'}
          onCancel={() => {
            setCreatedMatchId(null);
            setPregeneratedCode(generateGameRoomCode());
          }}
          onEnterBoard={() => onStartMatch(createdMatchId)}
          opponentJoined={opponentJoined}
        />
      </div>
    );
  }

  return (
    <PanelContainer>
      {/* Hero Header */}
      <div className="glass-panel p-4 sm:p-5 rounded-3xl border border-[#F5C453]/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#8C2425] via-[#52673A] to-[#F5C453] p-0.5 shadow-lg shadow-[#F5C453]/25 flex-shrink-0">
            <div className="w-full h-full bg-[#161c12] rounded-[14px] flex items-center justify-center text-[#F5C453]">
              <Swords className="w-6 h-6" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black font-heading text-white tracking-tight">
                Multiplayer Arena & Worldwide PvP
              </h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#8C2425] text-white border border-[#F5C453]/40 uppercase tracking-wider">
                Live Multiplayer
              </span>
            </div>
            <p className="text-xs text-[#DFD0B0]/75">
              Battle live against chess players worldwide, challenge friends by room code, or join public arena matches.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 bg-[#161c12] p-1.5 rounded-2xl border border-white/10 flex-wrap">
          <button
            onClick={() => setActiveTab('quick')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'quick'
                ? 'bg-[#52673A] text-white shadow-md border border-[#F5C453]/50'
                : 'text-[#DFD0B0]/70 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-[#F5C453]" />
            <span>Quick Match</span>
          </button>

          <button
            onClick={() => setActiveTab('create')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'bg-[#52673A] text-white shadow-md border border-[#F5C453]/50'
                : 'text-[#DFD0B0]/70 hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-[#F5C453]" />
            <span>Create Room</span>
          </button>

          <button
            onClick={() => setActiveTab('join')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'join'
                ? 'bg-[#52673A] text-white shadow-md border border-[#F5C453]/50'
                : 'text-[#DFD0B0]/70 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-[#F5C453]" />
            <span>Join Code</span>
          </button>

          <button
            onClick={() => setActiveTab('my_rooms')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'my_rooms'
                ? 'bg-[#52673A] text-white shadow-md border border-[#F5C453]/50'
                : 'text-[#DFD0B0]/70 hover:text-white'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-[#F5C453]" />
            <span>My Rooms</span>
            {myRooms.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'my_rooms' ? 'bg-[#F5C453] text-black' : 'bg-white/10 text-[#DFD0B0]'
              }`}>
                {myRooms.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('open_challenges')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'open_challenges'
                ? 'bg-[#52673A] text-white shadow-md border border-[#F5C453]/50'
                : 'text-[#DFD0B0]/70 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-[#F5C453]" />
            <span>Open Arena ({openMatches.length})</span>
          </button>
          
          <button
            onClick={() => setActiveTab('tournaments')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'tournaments'
                ? 'bg-[#52673A] text-white shadow-md border border-[#F5C453]/50'
                : 'text-[#DFD0B0]/70 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-[#F5C453]" />
            <span>Tournaments</span>
          </button>
        </div>
      </div>

      {/* User Stats Ribbon */}
      <div className="glass-panel p-3.5 rounded-2xl border border-white/10 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#52673A] border border-[#F5C453] flex items-center justify-center font-black text-white text-xs">
            {profile?.displayName?.charAt(0) || '👑'}
          </div>
          <div>
            <div className="text-xs font-black text-white flex items-center gap-1.5">
              <span>{profile?.displayName || user?.displayName || 'Peshmerga Tactician'}</span>
              {profile?.honorRank && (
                <span className="text-[10px] font-mono text-[#F5C453]">
                  ({profile.rankBadge ? `${profile.rankBadge} ` : ''}{profile.honorRank})
                </span>
              )}
            </div>
            <div className="text-[10px] text-[#DFD0B0]/60">
              Live Battle Rating: <strong className="text-white font-mono">{profile?.elo || 1200} Elo</strong> • Respect: <strong className="text-[#F5C453] font-mono">{profile?.respectPoints || 100} pts</strong>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenWorldwideModal && (
            <button
              onClick={onOpenWorldwideModal}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#DFD0B0] text-xs font-bold flex items-center gap-1.5 border border-white/10 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-[#F5C453]" />
              <span>Worldwide Roster</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Waiting Room Alert (When not on My Rooms tab and not currently in the Create waiting room) */}
      {activeWaitingRooms.length > 0 && activeTab !== 'my_rooms' && !createdMatchId && (
        <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 flex items-center justify-between gap-3 flex-wrap animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
            <div className="text-xs text-amber-200">
              <span className="font-bold">Active Waiting Room:</span>{' '}
              <span className="font-mono font-black text-[#F5C453] bg-black/60 px-2 py-0.5 rounded border border-amber-500/30">
                {activeWaitingRooms[0].code}
              </span>
              <span className="text-white/60 ml-2 hidden sm:inline">
                ({activeWaitingRooms[0].timeControl?.name || 'Rapid 10m'})
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopyRoomCode(activeWaitingRooms[0].code)}
              className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-white/10"
              title="Copy code to clipboard"
            >
              {copiedRoomCode === activeWaitingRooms[0].code ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-[#F5C453]" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
            <button
              onClick={() => setActiveTab('my_rooms')}
              className="px-3 py-1 rounded-xl bg-[#52673A] hover:bg-[#627c45] text-white text-xs font-black flex items-center gap-1 cursor-pointer border border-[#F5C453]/40 shadow-sm"
            >
              <span>View in My Rooms</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: QUICK MATCHMAKING */}
      {activeTab === 'quick' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Quick Match Time Controls */}
          <div className="lg:col-span-8 space-y-4">
            <div className="glass-panel p-5 rounded-3xl border border-[#F5C453]/30 shadow-xl space-y-4">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#F5C453]" />
                <span>Select Time Control & Queue Instantly</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {TIME_CONTROLS.map(tc => {
                  const isSelected = selectedQuickTime.id === tc.id;
                  return (
                    <button
                      key={tc.id}
                      disabled={isSearching}
                      onClick={() => setSelectedQuickTime(tc)}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#52673A]/50 border-[#F5C453] shadow-lg shadow-[#F5C453]/15'
                          : 'bg-black/40 border-white/10 hover:border-white/30 hover:bg-black/60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-white font-mono">{tc.name}</span>
                        <span className="text-[10px] uppercase font-bold text-[#F5C453]">{tc.category}</span>
                      </div>
                      <div className="text-[10px] text-[#DFD0B0]/60">
                        {tc.initialSeconds / 60} min {tc.incrementSeconds > 0 ? `+ ${tc.incrementSeconds}s` : ''}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Start Searching Button or Active Searching Spinner */}
              {!isSearching ? (
                <button
                  onClick={() => handleQuickMatch(selectedQuickTime)}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#8C2425] via-[#52673A] to-[#F5C453] hover:brightness-110 text-white font-black text-base flex items-center justify-center gap-2 shadow-xl shadow-[#F5C453]/20 border border-[#F5C453]/50 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  <Swords className="w-5 h-5" />
                  <span>Start Instant Multiplayer Match ({selectedQuickTime.name})</span>
                </button>
              ) : (
                <div className="p-6 rounded-2xl bg-black/80 border-2 border-[#F5C453] text-center space-y-3">
                  <div className="w-12 h-12 rounded-full border-4 border-[#F5C453] border-t-transparent animate-spin mx-auto" />
                  <h4 className="text-base font-black text-white">Searching for Worthy Opponent...</h4>
                  <p className="text-xs text-white/80">{searchStatus}</p>
                  <p className="text-xs text-[#DFD0B0]/70 font-mono">
                    {selectedQuickTime.name} • {searchTimer}s elapsed
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={handleCancelQuickMatch}
                      className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer"
                    >
                      Cancel Queue
                    </button>
                    <button
                      onClick={() => pairWithBotRef.current?.()}
                      className="px-4 py-1.5 rounded-xl bg-[#52673A]/70 hover:bg-[#52673A] border border-[#F5C453]/40 text-[#F5C453] text-xs font-bold cursor-pointer"
                    >
                      Play Bot Now
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Tips & Rules */}
          <div className="lg:col-span-4 space-y-4">
            <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-3">
              <h4 className="text-xs font-bold text-[#DFD0B0]/70 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#F5C453]" />
                <span>Multiplayer Honor Code</span>
              </h4>
              <ul className="text-xs text-[#DFD0B0]/80 space-y-2 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-[#F5C453] font-bold">•</span>
                  <span><strong>Live Clock Countdown:</strong> Clocks tick in real-time. Moving adds configured increments.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#F5C453] font-bold">•</span>
                  <span><strong>Respect Points:</strong> Victories award +30 Respect Points and +20 ELO points.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#F5C453] font-bold">•</span>
                  <span><strong>Instant Sparring:</strong> If no human player is instantly available in the queue, our Grandmaster bot matches with you immediately.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CREATE CUSTOM ROOM */}
      {activeTab === 'create' && (
        <div className="glass-panel p-6 rounded-3xl border border-[#F5C453]/30 shadow-xl max-w-2xl mx-auto space-y-5">
          <div className="flex items-center gap-3 border-b border-white/10 pb-3">
            <Plus className="w-6 h-6 text-[#F5C453]" />
            <div>
              <h3 className="text-base font-black text-white">Create Custom Multiplayer Challenge</h3>
              <p className="text-xs text-[#DFD0B0]/70">
                Configure time, piece color, and share the room code with your friend.
              </p>
            </div>
          </div>

          {true ? (
            <div className="space-y-4">
              {/* Unique 6-character Game Code Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-black/90 via-[#182214] to-black/90 border border-[#F5C453]/40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
                <div>
                  <span className="text-[10px] font-black uppercase text-[#F5C453] tracking-widest block">
                    Assigned 6-Character Game Code
                  </span>
                  <span className="font-mono text-2xl sm:text-3xl font-black text-white tracking-[0.25em]">
                    {pregeneratedCode}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(pregeneratedCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#F5C453]" />}
                    <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPregeneratedCode(generateGameRoomCode())}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer"
                    title="Generate different 6-character code"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#DFD0B0]">Time Control</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TIME_CONTROLS.map(tc => (
                    <button
                      key={tc.id}
                      type="button"
                      onClick={() => setSelectedTimeControl(tc)}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                        selectedTimeControl.id === tc.id
                          ? 'bg-[#52673A] text-white border-[#F5C453] font-bold'
                          : 'bg-black/40 text-white/70 border-white/10 hover:bg-black/60'
                      }`}
                    >
                      <div className="font-mono">{tc.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#DFD0B0]">Choose Your Side</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSide('w')}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      selectedSide === 'w'
                        ? 'bg-[#52673A] text-white border-[#F5C453]'
                        : 'bg-black/40 text-white/70 border-white/10'
                    }`}
                  >
                    ⚪ White
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSide('b')}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      selectedSide === 'b'
                        ? 'bg-[#52673A] text-white border-[#F5C453]'
                        : 'bg-black/40 text-white/70 border-white/10'
                    }`}
                  >
                    ⚫ Black
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSide('random')}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      selectedSide === 'random'
                        ? 'bg-[#52673A] text-white border-[#F5C453]'
                        : 'bg-black/40 text-white/70 border-white/10'
                    }`}
                  >
                    🎲 Random
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={handleCreateRoom}
                  disabled={isCreating}
                  className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-[#52673A] via-[#8C2425] to-[#F5C453] hover:brightness-110 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#F5C453]/20 border border-[#F5C453]/50 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isCreating ? 'Creating Room...' : `Create Game (${pregeneratedCode})`}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreationModal(true)}
                  className="px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/20 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Create Private Room</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('my_rooms')}
                  className="px-4 py-3.5 rounded-2xl bg-[#52673A]/30 hover:bg-[#52673A]/50 text-[#DFD0B0] font-bold text-xs flex items-center justify-center gap-2 border border-[#F5C453]/30 transition-all cursor-pointer"
                  title="View all rooms created by you"
                >
                  <Crown className="w-4 h-4 text-[#F5C453]" />
                  <span>My Rooms ({myRooms.length})</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <ModernWaitingRoom
                gameCode={createdMatchId}
                timeControlName={selectedTimeControl.name}
                isRated={true}
                playerSide={selectedSide}
                onCancel={() => {
                  setCreatedMatchId(null);
                  setPregeneratedCode(generateGameRoomCode());
                }}
                onEnterBoard={() => onStartMatch(createdMatchId)}
              />
              <div className="flex items-center justify-between text-xs px-2 text-[#DFD0B0]/70">
                <span>Room is saved to your history.</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('my_rooms')}
                  className="text-[#F5C453] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span>Go to My Rooms</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: JOIN ROOM BY CODE */}
      {activeTab === 'join' && (
        <div className="glass-panel p-6 rounded-3xl border border-[#F5C453]/30 shadow-xl max-w-md mx-auto space-y-4">
          <div className="flex items-center gap-3 border-b border-white/10 pb-3">
            <Users className="w-6 h-6 text-[#F5C453]" />
            <div>
              <h3 className="text-base font-black text-white">Join Game with Code</h3>
              <p className="text-xs text-[#DFD0B0]/70">
                Enter the unique 6-character game code generated by Player 1.
              </p>
            </div>
          </div>

          {joinError && (
            <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-bold">
              {joinError}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-[#DFD0B0]">6-Character Game Code</label>
            <input
              type="text"
              value={joinMatchId}
              onChange={e => setJoinMatchId(e.target.value.toUpperCase())}
              maxLength={12}
              placeholder="e.g. K9X2P7"
              className="w-full px-4 py-3.5 rounded-2xl bg-black/70 border-2 border-[#F5C453]/40 text-white font-mono text-center text-xl font-black tracking-[0.25em] focus:border-[#F5C453] focus:outline-none transition-all placeholder:text-white/20"
            />
          </div>

          <button
            onClick={handleJoinRoom}
            disabled={isJoining || !joinMatchId.trim()}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#8C2425] via-[#52673A] to-[#F5C453] hover:brightness-110 disabled:opacity-40 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#F5C453]/20 border border-[#F5C453]/50 transition-all cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span>{isJoining ? 'Connecting to Room...' : 'Join & Start Playing'}</span>
          </button>
        </div>
      )}

      {/* TAB: DEDICATED MY ROOMS SECTION */}
      {activeTab === 'my_rooms' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Section Header */}
          <div className="glass-panel p-5 rounded-3xl border border-[#F5C453]/30 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#52673A]/40 border border-[#F5C453]/40 flex items-center justify-center text-[#F5C453]">
                  <Crown className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>My Created Rooms</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#52673A] text-[#F5C453] font-mono font-bold border border-[#F5C453]/40">
                    {myRooms.length}
                  </span>
                </h3>
              </div>
              <p className="text-xs text-[#DFD0B0]/70 max-w-xl">
                Dedicated list of rooms created by you. Copy codes to invite friends, enter your waiting rooms, or review completed games.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setActiveTab('create')}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#52673A] to-[#F5C453] hover:brightness-110 text-white font-black text-xs inline-flex items-center justify-center gap-2 cursor-pointer shadow-md border border-[#F5C453]/40 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Room</span>
              </button>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1.5 bg-[#161c12] p-1.5 rounded-2xl border border-white/10 overflow-x-auto">
              <button
                onClick={() => setRoomFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  roomFilter === 'all'
                    ? 'bg-[#52673A] text-white shadow-sm border border-[#F5C453]/40'
                    : 'text-[#DFD0B0]/70 hover:text-white'
                }`}
              >
                All ({myRooms.length})
              </button>

              <button
                onClick={() => setRoomFilter('waiting')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  roomFilter === 'waiting'
                    ? 'bg-amber-600/70 text-white shadow-sm border border-amber-400/50'
                    : 'text-[#DFD0B0]/70 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />
                <span>Waiting ({waitingCount})</span>
              </button>

              <button
                onClick={() => setRoomFilter('in_progress')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  roomFilter === 'in_progress'
                    ? 'bg-emerald-600/70 text-white shadow-sm border border-emerald-400/50'
                    : 'text-[#DFD0B0]/70 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping" />
                <span>In Progress ({inProgressCount})</span>
              </button>

              <button
                onClick={() => setRoomFilter('completed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  roomFilter === 'completed'
                    ? 'bg-slate-700 text-white shadow-sm border border-white/20'
                    : 'text-[#DFD0B0]/70 hover:text-white'
                }`}
              >
                Finished ({completedCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={roomSearchQuery}
                onChange={e => setRoomSearchQuery(e.target.value)}
                placeholder="Search room code or time control..."
                className="w-full pl-9 pr-8 py-2 rounded-2xl bg-black/50 border border-white/15 text-white text-xs placeholder:text-white/30 focus:border-[#F5C453] focus:outline-none transition-all"
              />
              {roomSearchQuery && (
                <button
                  onClick={() => setRoomSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Rooms Grid / Empty State */}
          {filteredMyRooms.length === 0 ? (
            <div className="glass-panel p-10 rounded-3xl border border-white/10 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#52673A]/20 border border-[#F5C453]/30 mx-auto flex items-center justify-center text-[#F5C453]">
                <Crown className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h4 className="text-sm font-black text-white">
                  {myRooms.length === 0
                    ? 'No Rooms Created Yet'
                    : 'No Matching Rooms Found'}
                </h4>
                <p className="text-xs text-[#DFD0B0]/60">
                  {myRooms.length === 0
                    ? "You haven't created any custom multiplayer rooms yet. Create a room and share the 6-character code with a friend to begin!"
                    : 'No rooms match your filter or search query. Try switching to "All" or clearing the search.'}
                </p>
              </div>
              {myRooms.length === 0 ? (
                <button
                  onClick={() => setActiveTab('create')}
                  className="px-5 py-2.5 rounded-xl bg-[#52673A] hover:bg-[#627c45] text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer shadow-md border border-[#F5C453]/40"
                >
                  <Plus className="w-4 h-4 text-[#F5C453]" />
                  <span>Create Your First Room</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setRoomFilter('all');
                    setRoomSearchQuery('');
                  }}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer border border-white/10"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Show All Rooms</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMyRooms.map(room => {
                const isWaiting = room.status === 'waiting';
                const isInProgress = room.status === 'in_progress' || room.status === 'ready';
                const isFinished = !isWaiting && !isInProgress;
                const isCopied = copiedRoomCode === room.code;

                return (
                  <div
                    key={room.id || room.code}
                    className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-[#F5C453]/40 transition-all flex flex-col justify-between gap-4 shadow-lg group relative overflow-hidden"
                  >
                    {/* Top Row: Room Code with Copy Button & Status Badge */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        {/* Room Code Badge */}
                        <div className="px-3 py-1.5 rounded-xl bg-black/80 border border-[#F5C453]/40 flex items-center gap-2 shadow-inner">
                          <span className="text-[10px] text-[#DFD0B0]/60 uppercase font-bold tracking-wider">
                            Code
                          </span>
                          <span className="font-mono font-black text-base tracking-[0.15em] text-[#F5C453] select-all">
                            {room.code}
                          </span>
                        </div>

                        {/* Copy Code to Clipboard Button */}
                        <button
                          id={`copy-btn-${room.code}`}
                          onClick={() => handleCopyRoomCode(room.code)}
                          title="Copy room code to clipboard"
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border shadow-sm ${
                            isCopied
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/20'
                              : 'bg-white/10 hover:bg-white/20 text-[#DFD0B0] hover:text-white border-white/15'
                          }`}
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-[#F5C453]" />
                              <span>Copy Code</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {isWaiting && (
                          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1.5 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />
                            <span>Waiting</span>
                          </span>
                        )}
                        {isInProgress && (
                          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1.5 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                            <span>In Progress</span>
                          </span>
                        )}
                        {isFinished && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-500/20 text-slate-300 border border-slate-500/30 inline-flex items-center gap-1.5">
                            <span>{room.status === 'aborted' ? 'Cancelled' : 'Finished'}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle Info Block: Time Control & Opponent / Side details */}
                    <div className="bg-black/40 p-3.5 rounded-xl border border-white/5 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        {/* Time Control details */}
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-lg bg-[#52673A]/40 border border-[#F5C453]/20 text-[#F5C453]">
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-black text-white text-xs">
                              {room.timeControl?.name || 'Rapid 10m'}
                            </span>
                            <span className="text-[10px] text-white/50 ml-1.5 font-mono">
                              ({room.timeControl?.initialSeconds ? `${Math.round(room.timeControl.initialSeconds / 60)}m` : '10m'}
                              {room.timeControl?.incrementSeconds ? ` + ${room.timeControl.incrementSeconds}s` : ''})
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] text-[#DFD0B0]/60">
                          {formatRoomTimeAgo(room.createdAt)}
                        </span>
                      </div>

                      {/* Opponent & Side Information */}
                      <div className="text-xs text-[#DFD0B0]/70 flex items-center justify-between pt-1 border-t border-white/5">
                        <div className="flex items-center gap-2">
                          {room.opponent ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full overflow-hidden bg-[#52673A] border border-white/20 flex items-center justify-center text-[10px] text-white font-bold">
                                {room.opponent.avatar ? (
                                  <img
                                    src={room.opponent.avatar}
                                    alt="Opponent"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  room.opponent.displayName?.charAt(0) || '?'
                                )}
                              </div>
                              <span className="text-white font-bold truncate max-w-[120px]">
                                {room.opponent.displayName}
                              </span>
                              {room.opponent.elo && (
                                <span className="text-[10px] text-[#F5C453] font-mono">
                                  ({room.opponent.elo})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-white/50 italic flex items-center gap-1">
                              {isWaiting ? (
                                <>
                                  <Users className="w-3 h-3 text-amber-400" />
                                  <span>Waiting for challenger</span>
                                </>
                              ) : (
                                <span>No opponent record</span>
                              )}
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] font-mono text-[#F5C453] uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded border border-white/10">
                          Side: {room.side === 'w' ? 'White' : room.side === 'b' ? 'Black' : 'Random'}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Actions */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                      {/* Enter Room / Board Action */}
                      {isWaiting && (
                        <button
                          onClick={() => onStartMatch(room.code)}
                          className="flex-1 py-2 rounded-xl bg-[#52673A] hover:bg-[#627c45] text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md border border-[#F5C453]/40 transition-all cursor-pointer"
                        >
                          <DoorOpen className="w-3.5 h-3.5 text-[#F5C453]" />
                          <span>Enter Waiting Room</span>
                        </button>
                      )}

                      {isInProgress && (
                        <button
                          onClick={() => onStartMatch(room.code)}
                          className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md border border-emerald-400/50 transition-all cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Resume Match</span>
                        </button>
                      )}

                      {isFinished && (
                        <button
                          onClick={() => onStartMatch(room.code)}
                          className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-all cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Review Match</span>
                        </button>
                      )}

                      {/* Cancel Room Action (available for waiting rooms) */}
                      {isWaiting && (
                        <button
                          onClick={() => handleCancelRoom(room.code)}
                          disabled={isCancellingRoom === room.code}
                          title="Close this waiting room"
                          className="px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-200 border border-rose-500/30 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">
                            {isCancellingRoom === room.code ? 'Closing...' : 'Close Room'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: OPEN PUBLIC ARENA CHALLENGES */}
      {activeTab === 'open_challenges' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#F5C453]" />
              <span>Public Live Open Challenges ({openMatches.length})</span>
            </h3>
          </div>

          {openMatches.length === 0 ? (
            <div className="glass-panel p-8 rounded-3xl border border-white/10 text-center space-y-3">
              <Swords className="w-10 h-10 text-[#F5C453]/40 mx-auto" />
              <h4 className="text-sm font-bold text-white">No Public Waiting Matches</h4>
              <p className="text-xs text-[#DFD0B0]/60 max-w-sm mx-auto">
                No players are currently waiting in the open lobby. Create a new challenge or use Quick Match!
              </p>
              <button
                onClick={() => setActiveTab('create')}
                className="px-4 py-2 rounded-xl bg-[#52673A] hover:bg-[#52673A]/90 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus className="w-3.5 h-3.5 text-[#F5C453]" />
                <span>Create Public Match</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {openMatches.map(m => (
                <div
                  key={m.id}
                  className="glass-panel p-4 rounded-2xl border border-white/10 hover:border-[#F5C453]/50 transition-all flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white">{m.whitePlayer?.displayName || 'Host Player'}</span>
                      <span className="text-[10px] font-mono text-[#F5C453]">{m.whitePlayer?.elo || 1200} Elo</span>
                    </div>
                    <div className="text-[11px] text-[#DFD0B0]/70 font-mono mt-0.5">
                      {m.timeControl?.name || 'Rapid'} • Open Waiting
                    </div>
                  </div>

                  <button
                    onClick={() => onStartMatch(m.id)}
                    className="px-3 py-1.5 rounded-xl bg-[#52673A] hover:bg-[#52673A]/90 text-white font-black text-xs flex items-center gap-1 cursor-pointer border border-[#F5C453]/40 shadow-md"
                  >
                    <span>Accept</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* TAB 5: TOURNAMENTS */}
      {activeTab === 'tournaments' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#F5C453]" />
                <span>Tournament Bracket Arena</span>
              </h3>
              <p className="text-xs text-[#DFD0B0]/70 mt-1">Join or create knockout tournaments.</p>
            </div>
            
            <button
              onClick={() => setShowCreateTournament(!showCreateTournament)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#8C2425] to-[#52673A] text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-md border border-[#F5C453]/40"
            >
              <Plus className="w-4 h-4" />
              <span>Host Tournament</span>
            </button>
          </div>

          {showCreateTournament && (
            <div className="glass-panel p-5 rounded-2xl border border-[#F5C453]/40 space-y-4 animate-in slide-in-from-top-4">
              <h4 className="text-sm font-bold text-white">Create New Tournament</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#DFD0B0]">Tournament Name</label>
                  <input
                    type="text"
                    value={tournamentName}
                    onChange={e => setTournamentName(e.target.value)}
                    placeholder="e.g. Weekly Masters"
                    className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/20 text-white text-xs font-bold focus:border-[#F5C453] focus:outline-none"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#DFD0B0]">Max Players</label>
                  <select 
                    value={tournamentMaxPlayers} 
                    onChange={e => setTournamentMaxPlayers(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/20 text-white text-xs font-bold focus:border-[#F5C453] focus:outline-none"
                  >
                    <option value={4}>4 Players</option>
                    <option value={8}>8 Players</option>
                    <option value={16}>16 Players</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#DFD0B0]">Time Control</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TIME_CONTROLS.map(tc => (
                    <button
                      key={tc.id}
                      onClick={() => setSelectedTimeControl(tc)}
                      className={`p-2 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                        selectedTimeControl.id === tc.id
                          ? 'bg-[#52673A] text-white border-[#F5C453] font-bold'
                          : 'bg-black/40 text-white/70 border-white/10'
                      }`}
                    >
                      {tc.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleCreateTournament}
                  disabled={!tournamentName.trim()}
                  className="px-6 py-2.5 rounded-xl bg-[#52673A] text-white font-bold text-xs shadow-md border border-[#F5C453]/40 cursor-pointer disabled:opacity-50"
                >
                  Create Bracket
                </button>
              </div>
            </div>
          )}

          {tournaments.length === 0 ? (
            <div className="glass-panel p-8 rounded-3xl border border-white/10 text-center space-y-3">
              <Trophy className="w-10 h-10 text-[#F5C453]/40 mx-auto" />
              <h4 className="text-sm font-bold text-white">No Active Tournaments</h4>
              <p className="text-xs text-[#DFD0B0]/60 max-w-sm mx-auto">
                There are no open tournaments right now. Be the first to host one!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {tournaments.map(t => {
                const isJoined = t.players.some(p => p.uid === user?.uid);
                
                return (
                  <div key={t.id} className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-[#F5C453]/30 transition-all flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-white">{t.name}</h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md uppercase font-bold border ${
                            t.status === 'registration' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                            t.status === 'in_progress' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                            'bg-slate-500/20 text-slate-300 border-slate-500/30'
                          }`}>
                            {t.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-xs text-[#DFD0B0]/70 mt-1 flex items-center gap-3">
                          <span>Host: <strong>{t.creatorName}</strong></span>
                          <span>•</span>
                          <span>{t.timeControl.name}</span>
                          <span>•</span>
                          <span>{t.players.length}/{t.maxPlayers} Players</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        {t.status === 'registration' && !isJoined && (
                          <button
                            onClick={() => handleJoinTournament(t.id)}
                            className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#52673A] to-[#3a4a29] text-white font-bold text-xs border border-[#F5C453]/30 cursor-pointer whitespace-nowrap shadow-md"
                          >
                            Join Tournament
                          </button>
                        )}
                        
                        {t.status !== 'registration' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setExpandedTournamentId(expandedTournamentId === t.id ? null : t.id)}
                              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#DFD0B0] font-bold text-xs border border-white/10 cursor-pointer whitespace-nowrap"
                            >
                              {expandedTournamentId === t.id ? 'Hide Bracket' : 'View Bracket'}
                            </button>
                            
                            {t.matches.some(m => m.status === 'ready' && (m.player1?.uid === user?.uid || m.player2?.uid === user?.uid)) && (
                              <button
                                onClick={() => {
                                  const myMatch = t.matches.find(m => m.status === 'ready' && (m.player1?.uid === user?.uid || m.player2?.uid === user?.uid));
                                  if (myMatch) {
                                    if (myMatch.matchSessionId) {
                                      onStartMatch(myMatch.matchSessionId);
                                    } else {
                                      handleStartTournamentMatch(t.id, myMatch.id, t.timeControl);
                                    }
                                  }
                                }}
                                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs border border-emerald-400/50 cursor-pointer whitespace-nowrap shadow-md shadow-emerald-900/40"
                              >
                                Enter Match
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Bracket View */}
                    {expandedTournamentId === t.id && (
                      <div className="mt-2 p-4 sm:p-6 rounded-2xl bg-[#0b0e09] border border-white/5 overflow-x-auto">
                      <div className="flex items-start gap-8 min-w-max">
                        {Array.from({ length: Math.log2(t.maxPlayers) }).map((_, roundIndex) => {
                          const roundMatches = t.matches.filter(m => m.round === roundIndex + 1);
                          return (
                            <div key={`round-${roundIndex}`} className="flex flex-col gap-4">
                              <h5 className="text-[10px] font-black text-[#F5C453] uppercase tracking-widest text-center mb-2">
                                {roundIndex + 1 === Math.log2(t.maxPlayers) ? 'Finals' : `Round ${roundIndex + 1}`}
                              </h5>
                              {roundMatches.map(m => (
                                <div key={m.id} className={`w-48 p-2.5 rounded-xl border flex flex-col gap-1.5 ${m.status === 'completed' ? 'bg-black/80 border-white/10' : m.status === 'in_progress' ? 'bg-[#52673A]/20 border-emerald-500/30' : 'bg-black/40 border-white/5'}`}>
                                  <div className={`flex items-center justify-between text-xs px-2 py-1.5 rounded-lg ${m.winnerId === m.player1?.uid ? 'bg-[#52673A]/60 font-black text-white' : 'bg-white/5 text-[#DFD0B0]'}`}>
                                    <span className="truncate">{m.player1?.displayName || 'TBD'}</span>
                                    {m.winnerId === m.player1?.uid && <Check className="w-3 h-3 text-[#F5C453]" />}
                                  </div>
                                  <div className={`flex items-center justify-between text-xs px-2 py-1.5 rounded-lg ${m.winnerId === m.player2?.uid ? 'bg-[#52673A]/60 font-black text-white' : 'bg-white/5 text-[#DFD0B0]'}`}>
                                    <span className="truncate">{m.player2?.displayName || 'TBD'}</span>
                                    {m.winnerId === m.player2?.uid && <Check className="w-3 h-3 text-[#F5C453]" />}
                                  </div>
                                  {m.status === 'in_progress' && (
                                    <div className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider text-center mt-1">Live Match</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* Advanced Custom Game Creation Modal */}
      <ModernGameCreationModal
        isOpen={showCreationModal}
        onClose={() => setShowCreationModal(false)}
        onCreateGame={handleModalCreateGame}
        onStartMatch={onStartMatch}
      />
    </PanelContainer>
  );
};
