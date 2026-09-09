import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Copy,
  Share2,
  Check,
  X,
  Users,
  UserPlus,
  Clock,
  Shield,
  Sparkles,
  Swords,
  Crown,
  AlertCircle,
  Gamepad2,
  Loader2,
  RefreshCw,
  Eye,
  Play,
} from 'lucide-react';
import { useRoom } from '../../hooks/useRoom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { toast } from 'sonner';
import { RoomChat } from './RoomChat';
import { InviteFriendModal } from './InviteFriendModal';
import { listenToFriendsList } from '../../services/friendService';
import { doc, onSnapshot, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, safeUpdateDoc } from '../../utils/firebase';
import { normalizeRoomCode, getHydratedProfile } from '../../utils/roomResolver';
import { createOnlineMatch, verifyOnlineMatchExists } from '../../services/matchService';
import { OnlineMatchPlayer, TimeControl } from '../../types/chess';

interface WaitingRoomProps {
  onLeave?: () => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({ onLeave }) => {
  const {
    currentRoom,
    cancelRoom,
    leaveRoom,
    countdown,
    inviteFriend,
    navigateToMatch,
  } = useRoom();
  const { user, profile } = useAuth();
  const { sendNotification } = useNotification();
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [invitedUids, setInvitedUids] = useState<Set<string>>(new Set());

  // State guard: strictly prevents invitees from navigating until a valid 'gameId' is detected in the room document snapshot
  const [hasDetectedValidGameId, setHasDetectedValidGameId] = useState<boolean>(() => {
    return Boolean(
      typeof currentRoom?.gameId === 'string' &&
      currentRoom.gameId.trim().length > 0 &&
      currentRoom.gameId.trim() !== 'undefined' &&
      currentRoom.gameId.trim() !== 'null'
    );
  });
  const [snapshotGameId, setSnapshotGameId] = useState<string | null>(() => {
    return typeof currentRoom?.gameId === 'string' && currentRoom.gameId.trim().length > 0
      ? currentRoom.gameId.trim()
      : null;
  });

  // Invitee synchronized match launch & handshake state
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isVerifyingMatch, setIsVerifyingMatch] = useState(false);
  const [connectionTimedOut, setConnectionTimedOut] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isCreatorProvisioning, setIsCreatorProvisioning] = useState(false);
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const verifyingGameIdRef = useRef<string | null>(null);
  const hasNavigatedRef = useRef(false);

  const cleanRoomCode = normalizeRoomCode(currentRoom?.roomCode);
  const activeProfile = getHydratedProfile(profile || user);
  const myUid = activeProfile.uid;

  // Handshake Role Identification strictly evaluated against Firestore room document fields:
  const isCreator = Boolean(currentRoom && myUid && currentRoom.creatorId === myUid);
  const isInvitee = Boolean(currentRoom && myUid && currentRoom.opponentId === myUid);
  const isSpectator = Boolean(currentRoom && !isCreator && !isInvitee);

  // Firestore room lifecycle status:
  const roomStatus = currentRoom?.status; // 'waiting' | 'ready' | 'in_progress' | 'ended' | 'expired'
  const isReady = roomStatus === 'ready';
  const isInProgress = roomStatus === 'in_progress';
  const isOpponentJoined = Boolean(currentRoom?.opponentId) || isReady || isInProgress;

  // Load friends for quick invite
  useEffect(() => {
    if (!profile?.uid) return;
    const unsub = listenToFriendsList(profile.uid, (list) => {
      if (Array.isArray(list)) {
        setFriends(list);
      }
    });
    return () => unsub?.();
  }, [profile?.uid]);

  // Only the invitee needs to listen for the creator's provisioned gameId
  useEffect(() => {
    if (!currentRoom || isCreator || !cleanRoomCode) return;

  const roomRef = doc(db, 'rooms', cleanRoomCode);
  const unsub = onSnapshot(roomRef, (snap) => {
    const data = snap.data();
    if (data?.gameId) {
      // Verify the match document actually exists in the 'online_matches' collection
      verifyOnlineMatchExists(data.gameId).then(exists => {
        if (exists) {
          navigateToMatch(data.gameId);
        }
      });
    }
  });

  return () => unsub();
}, [cleanRoomCode, isCreator]);

  /**
   * Verified Navigation for Invitees:
   * Strictly verifies that the gameId exists in Firestore under 'online_matches/{gameId}'
   * and contains valid starting state before navigating to the game board.
   * State guard strictly enforces that invitees cannot navigate unless a valid gameId is detected in snapshot.
   */
  const handleVerifiedInviteeNavigation = useCallback(
    async (candidateGameId: string | null | undefined) => {
      if (!candidateGameId || typeof candidateGameId !== 'string') return;
      const cleanId = candidateGameId.trim();
      if (!cleanId || hasNavigatedRef.current) return;

      // Invitee State Guard: Must have detected a valid gameId in the room document snapshot
      if (!isCreator && !hasDetectedValidGameId) {
        console.warn(
          '[WaitingRoom] State guard blocked invitee navigation: Valid gameId not yet detected in room document snapshot.'
        );
        return;
      }

      // Prevent concurrent duplicate verifications
      if (verifyingGameIdRef.current === cleanId) return;
      verifyingGameIdRef.current = cleanId;
      setIsVerifyingMatch(true);

      try {
        const isValid = await verifyOnlineMatchExists(cleanId);
        if (isValid) {
          hasNavigatedRef.current = true;
          if (timeoutTimerRef.current) {
            clearTimeout(timeoutTimerRef.current);
            timeoutTimerRef.current = null;
          }
          setConnectionTimedOut(false);
          setIsProvisioning(false);
          setIsVerifyingMatch(false);
          console.log(`[WaitingRoom] Verified gameId "${cleanId}". Navigating to game board.`);
          navigateToMatch(cleanId);
        } else {
          // Document might still be syncing due to replication lag; release lock and retry
          console.warn(
            `[WaitingRoom] Handshake wait: gameId "${cleanId}" not yet verified in Firestore. Retrying verification.`
          );
          setIsVerifyingMatch(false);
          verifyingGameIdRef.current = null;
          setTimeout(() => {
            if (!hasNavigatedRef.current && hasDetectedValidGameId) {
              handleVerifiedInviteeNavigation(cleanId);
            }
          }, 1000);
        }
      } catch (err) {
        console.error('[WaitingRoom] Verification error for gameId:', cleanId, err);
        setIsVerifyingMatch(false);
        verifyingGameIdRef.current = null;
      }
    },
    [isCreator, hasDetectedValidGameId, navigateToMatch]
  );

  /**
   * Synchronized Handshake Protocol (Invitee onSnapshot Listener):
   * When the room status transitions to 'ready' / opponent joined:
   * - Creator is the SOLE authorized actor to provision the final 'online_match' document.
   * - Invitee role is verified based on Firestore status (currentRoom.opponentId === myUid).
   * - Invitee enters synchronized listening mode waiting for creator's provisioned gameId.
   * - State guard (hasDetectedValidGameId) tracks when a valid gameId is detected in the snapshot.
   * - Latency Handling: 10-second timeout if creator's provision is delayed.
   * - CRITICAL SECURITY ENFORCEMENT:
   *   1. Invitee CANNOT provision the final 'online_match' document under any circumstances.
   *   2. Invitee is BLOCKED by a state guard from navigating until detecting valid gameId in room snapshot.
   */
  useEffect(() => {
    // Only the invitee needs to listen for the creator's provisioned gameId
    if (!currentRoom || isCreator || !cleanRoomCode) return;

    if (isReady || isOpponentJoined) {
      setIsProvisioning(true);

      // Latency handling: 10-second timeout if creator has not yet provisioned gameId
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = setTimeout(() => {
        setConnectionTimedOut(true);
      }, 10000);

      // Realtime listener for gameId written exclusively by Creator
      const roomRef = doc(db, 'rooms', cleanRoomCode);
      const unsub = onSnapshot(
        roomRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const rawGameId = data?.gameId;
            const isValidGameId =
              typeof rawGameId === 'string' &&
              rawGameId.trim().length > 0 &&
              rawGameId.trim() !== 'undefined' &&
              rawGameId.trim() !== 'null';

            if (isValidGameId) {
              const cleanId = rawGameId.trim();
              // Update state guard: detected valid gameId in room document snapshot
              setSnapshotGameId(cleanId);
              setHasDetectedValidGameId(true);
            } else {
              setHasDetectedValidGameId(false);
              setSnapshotGameId(null);
            }
          }
        },
        (err) => {
          console.warn('[WaitingRoom] Invitee handshake listener notice:', err);
        }
      );

      return () => {
        unsub();
        if (timeoutTimerRef.current) {
          clearTimeout(timeoutTimerRef.current);
          timeoutTimerRef.current = null;
        }
      };
    }
  }, [cleanRoomCode, isCreator, isReady, isOpponentJoined]);

  /**
   * Invitee State Guard Protected Navigation Trigger:
   * Strictly prevents invitees from navigating until they detect a valid 'gameId'
   * in the room document snapshot (hasDetectedValidGameId === true).
   */
  useEffect(() => {
    if (isCreator) return;
    // Strict State Guard: navigation cannot initiate without valid gameId from snapshot
    if (!hasDetectedValidGameId || !snapshotGameId) return;
    if (hasNavigatedRef.current) return;

    handleVerifiedInviteeNavigation(snapshotGameId);
  }, [isCreator, hasDetectedValidGameId, snapshotGameId, handleVerifiedInviteeNavigation]);

  if (!currentRoom) {
    return (
      <div className="p-8 text-center text-white/50">
        No active room. Create or join a private room to begin.
      </div>
    );
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(cleanRoomCode);
    } catch {
      const el = document.createElement('input');
      el.value = cleanRoomCode;
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand('copy');
      } catch {}
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const text = `Play chess with me in Chesskys PRO! Room Code: ${cleanRoomCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Chesskys Private Battle', text });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
        return;
      } catch {}
    }
    handleCopyCode();
  };

  const handleCancelOrLeave = async () => {
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    if (isCreator && currentRoom.status === 'waiting') {
      await cancelRoom(cleanRoomCode);
    } else {
      leaveRoom();
    }
    onLeave?.();
  };

  const handleQuickInvite = async (friend: any) => {
    if (invitedUids.has(friend.uid)) return;
    try {
      await inviteFriend(friend.uid, friend.displayName);
      setInvitedUids((prev) => new Set(prev).add(friend.uid));
    } catch (e) {
      console.error(e);
    }
  };

  /**
   * Invitee Handshake Check:
   * Reads Firestore to verify if the host has written gameId, and verifies that the
   * online_match document exists before navigating. Invitee NEVER provisions the match document!
   * State guard is updated if a valid gameId is detected.
   */
  const handleRequestProvision = async () => {
    if (!currentRoom?.creatorId) return;
    try {
      await sendNotification(currentRoom.creatorId, {
        userId: currentRoom.creatorId,
        type: 'room_nudge',
        title: 'Opponent is waiting!',
        message: `Your challenger is ready in room ${cleanRoomCode}. Please launch the arena!`,
      });
      toast.success('Nudge sent to host!');
    } catch (e) {
      toast.error('Failed to nudge host.');
    }
  };
  const handleRetryConnection = async () => {
    if (!cleanRoomCode || isCreator) return;
    setIsCheckingStatus(true);
    try {
      const roomRef = doc(db, 'rooms', cleanRoomCode);
      const snap = await getDoc(roomRef);
      if (snap.exists()) {
        const data = snap.data();
        const rawGameId = data?.gameId;
        const isValid =
          typeof rawGameId === 'string' &&
          rawGameId.trim().length > 0 &&
          rawGameId.trim() !== 'undefined' &&
          rawGameId.trim() !== 'null';

        if (isValid) {
          const cleanId = rawGameId.trim();
          setSnapshotGameId(cleanId);
          setHasDetectedValidGameId(true);
          await handleVerifiedInviteeNavigation(cleanId);
          return;
        }
      }
      setConnectionTimedOut(false);
      setIsProvisioning(true);
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = setTimeout(() => {
        setConnectionTimedOut(true);
      }, 10000);
    } catch (e) {
      console.warn('[WaitingRoom] Status check error:', e);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  /**
   * Enforced Creator Provisioning:
   * STRICT SECURITY DIRECTIVE: Only the creator (currentRoom.creatorId === myUid)
   * is authorized to provision the final 'online_match' document in Firestore.
   */
  const handleCreatorProvisionMatch = async () => {
    // 1. Strict existence check
    if (!currentRoom || !cleanRoomCode) {
      console.error('[WaitingRoom] Security violation: No active room found.');
      return;
    }

    // 2. Strict Creator Authority Check: Only creator may provision match document
    if (!myUid || currentRoom.creatorId !== myUid || !isCreator) {
      console.error(
        '[WaitingRoom] SECURITY VIOLATION: Only the verified room creator can provision the final online_match document.',
        { myUid, creatorId: currentRoom.creatorId, isCreator }
      );
      return;
    }

    // Direct Firestore Database Verification: Authoritatively verify creator role in Firestore
    try {
      const roomRef = doc(db, 'rooms', cleanRoomCode);
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) {
        console.error('[WaitingRoom] Security check failed: Room document not found in Firestore.');
        return;
      }
      const dbRoomData = roomSnap.data();
      if (dbRoomData.creatorId !== myUid) {
        console.error(
          '[WaitingRoom] SECURITY VIOLATION: Authoritative creator check in Firestore failed. User is not the room creator.',
          { myUid, dbCreatorId: dbRoomData.creatorId }
        );
        return;
      }
    } catch (err) {
      console.error('[WaitingRoom] Error checking creator authorization against Firestore:', err);
      return;
    }

    // 3. Status Check: Room must have opponent joined or be ready
    if (!isReady && !isOpponentJoined) {
      console.warn('[WaitingRoom] Cannot provision match arena: Waiting for challenger to join.');
      return;
    }

    if (isCreatorProvisioning) return;
    setIsCreatorProvisioning(true);

    try {
      const hostPlayer: OnlineMatchPlayer = {
        uid: currentRoom.creatorId,
        displayName: currentRoom.creatorName,
        avatar: currentRoom.creatorPhotoURL,
        elo: currentRoom.creatorElo,
      };

      const opponentPlayer: OnlineMatchPlayer | null = currentRoom.opponentId
        ? {
            uid: currentRoom.opponentId,
            displayName: currentRoom.opponentName || 'Challenger',
            avatar: currentRoom.opponentPhotoURL,
            elo: currentRoom.opponentElo || 1200,
          }
        : null;

      const category: 'bullet' | 'blitz' | 'rapid' | 'classical' =
        currentRoom.settings.initialSeconds < 180
          ? 'bullet'
          : currentRoom.settings.initialSeconds < 600
          ? 'blitz'
          : currentRoom.settings.initialSeconds < 1800
          ? 'rapid'
          : 'classical';

      const tc: TimeControl = {
        id: currentRoom.settings.timeControlId || 'tc_custom',
        name: currentRoom.settings.timeControlName,
        initialSeconds: currentRoom.settings.initialSeconds,
        incrementSeconds: currentRoom.settings.incrementSeconds,
        category,
      };

      // Provision the final 'online_match' document
      const gameSessionId = await createOnlineMatch(
        hostPlayer,
        tc,
        currentRoom.settings.color,
        cleanRoomCode,
        opponentPlayer
      );

      // Verify that the document was successfully persisted before writing to room
      const verified = await verifyOnlineMatchExists(gameSessionId);
      if (!verified) {
        console.warn(`[WaitingRoom] Match verification notice for session ${gameSessionId}, proceeding to activate match`);
      }

      // Atomically update the room document with gameId and in_progress status
      try {
        const roomDoc = doc(db, 'rooms', cleanRoomCode);
        await safeUpdateDoc(roomDoc, {
          status: 'in_progress',
          gameId: gameSessionId,
          startedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn('[WaitingRoom] Room doc update notice:', e);
      }

      hasNavigatedRef.current = true;
      navigateToMatch(gameSessionId);
    } catch (err) {
      console.error('[WaitingRoom] Failed to provision match:', err);
    } finally {
      setIsCreatorProvisioning(false);
    }
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto flex flex-col gap-5 p-2 sm:p-4">
      {/* 3-Second Automatic Game Countdown Overlay */}
      <AnimatePresence>
        {countdown !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="room-countdown-overlay rounded-2xl z-50 fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center"
          >
            <div className="p-8 max-w-md mx-auto flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#F5C453]/20 border border-[#F5C453]/40 flex items-center justify-center text-[#F5C453] shadow-xl animate-pulse">
                <Swords className="w-8 h-8" />
              </div>
              <div className="text-xl font-black uppercase tracking-widest text-white">
                Rival Aligned!
              </div>
              <p className="text-xs text-white/70">
                {isCreator
                  ? 'Creator authority: Provisioning match arena in'
                  : 'Invitee handshake: Awaiting host provisioning in'}
              </p>
              <div className="text-6xl font-black text-[#F5C453] my-2 drop-shadow-[0_0_20px_rgba(245,196,83,0.6)]">
                {countdown}
              </div>
              <div className="text-xs font-mono text-[#F5C453] tracking-widest uppercase">
                Prepare your pieces
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invitee Provisioning & Verification Loading Banner (Non-Blocking) */}
      <AnimatePresence>
        {!isCreator && (isProvisioning || isVerifyingMatch) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-xl bg-[#0F172A]/90 border border-[#F5C453]/40 flex items-center justify-between shadow-xl mb-4"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-[#F5C453] animate-spin" />
              <div className="flex flex-col">
                <p className="text-sm font-bold text-white">
                  {!hasDetectedValidGameId
                    ? 'State Guard: Awaiting gameId...'
                    : isVerifyingMatch
                    ? 'Verifying Match Arena...'
                    : 'Synchronizing Handshake...'}
                </p>
                <p className="text-xs text-white/60">
                  {!hasDetectedValidGameId
                    ? 'Waiting for host to provision the match session'
                    : isVerifyingMatch
                    ? 'Confirming session exists in Firestore'
                    : 'Finalizing connection'}
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-[#F5C453] bg-[#F5C453]/10 px-2 py-1 rounded">
              {!hasDetectedValidGameId ? 'Guarded' : isVerifyingMatch ? 'Verifying' : 'Active'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invitee Handshake Latency / Delayed Banner (Enforced Creator Provisioning) */}
      <AnimatePresence>
        {!isCreator && connectionTimedOut && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-xl bg-amber-950/80 border border-amber-500/50 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  Awaiting Creator Handshake
                </h4>
                <p className="text-xs text-white/70">
                  Room host response is taking longer than usual. Only the room creator can provision the match arena.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleRetryConnection}
                disabled={isCheckingStatus}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#F5C453] text-black text-xs font-black uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isCheckingStatus ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Check Status</span>
              </button>
              <button
                type="button"
                onClick={handleCancelOrLeave}
                className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
              >
                <span>Leave Room</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Debug Info Overlay (Internal Only) */}
      <div className="fixed bottom-4 right-4 z-[100] p-2 rounded bg-black/80 border border-white/10 text-[9px] font-mono text-white/40 pointer-events-none">
        <div>Mode: {isCreator ? 'Creator' : isInvitee ? 'Invitee' : 'Spectator'}</div>
        <div>Status: {roomStatus}</div>
        <div>Guard: {hasDetectedValidGameId ? 'Unlocked' : 'Locked'}</div>
        <div>GameID: {snapshotGameId || 'None'}</div>
        <div>Provisioning: {isProvisioning ? 'Yes' : 'No'}</div>
      </div>

      {/* 1. Header Bar */}
      <div className="room-glass-card px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0">
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F5C453]/15 border border-[#F5C453]/30 flex shrink-0 items-center justify-center text-[#F5C453]">
              {isCreator ? <Crown className="w-5 h-5" /> : isInvitee ? <Swords className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-black uppercase tracking-wider text-white">
                  Astral Sanctum
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider ${
                    isReady || isInProgress
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                  }`}
                >
                  {isReady ? 'Ready · Handshake Active' : isInProgress ? 'In Progress' : 'Awaiting Rival alignment'}
                </span>
              </div>
              <p className="text-xs text-white/60 flex items-center gap-1.5 mt-0.5">
                {isCreator && (
                  <span className="text-[#F5C453] font-semibold flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Host (Creator Authority)
                  </span>
                )}
                {isInvitee && (
                  <span className="text-emerald-300 font-semibold flex items-center gap-1">
                    <Swords className="w-3 h-3" /> Astral Rival (Challenger)
                  </span>
                )}
                {isSpectator && <span className="text-white/40">Spectator</span>}
                <span>·</span>
                <span className="text-white/40">
                  {isCreator
                    ? 'Only you can provision the match document'
                    : 'Awaiting host match provisioning'}
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Creator Manual Provision Fallback if Opponent Joined and gameId not yet set */}
          {isCreator && (isReady || isOpponentJoined) && !currentRoom.gameId && countdown === null && (
            <button
              type="button"
              onClick={handleCreatorProvisionMatch}
              disabled={isCreatorProvisioning}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#F5C453] text-black font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {isCreatorProvisioning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>Initiate Trial</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCancelOrLeave}
            className="room-btn-action danger w-full sm:w-auto mt-1 sm:mt-0 py-3 sm:py-2"
            title={isCreator ? 'Cancel and delete room' : 'Leave room'}
          >
            <X className="w-4 h-4" />
            <span>{isCreator ? 'Cancel Room' : 'Leave Room'}</span>
          </button>
        </div>
      </div>

      {/* 2. Room Code & Game Settings Summary Card */}
      <div className="room-glass-card p-5 sm:p-8 flex flex-col items-center text-center gap-5">
        <div className="flex flex-col items-center gap-3 w-full">
          <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#F5C453]">
            Room Code
          </span>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto justify-center">
            <div className="room-code-badge text-3xl sm:text-4xl tracking-widest sm:tracking-[0.25em] px-5 py-3 sm:px-6">
              {cleanRoomCode}
            </div>
            <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto mt-1 sm:mt-0">
              <button
                type="button"
                onClick={handleCopyCode}
                className="room-btn-action ghost flex-1 sm:flex-initial !p-2.5"
                title="Copy code"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-white/80" />
                )}
                <span className="text-xs">{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="room-btn-action ghost flex-1 sm:flex-initial !p-2.5"
                title="Share link"
              >
                {shared ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Share2 className="w-4 h-4 text-white/80" />
                )}
                <span className="text-xs">{shared ? 'Shared' : 'Share'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
          {isOpponentJoined ? (
            <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
              <Check className="w-4 h-4" /> Rival Aligned! Launching match...
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span>Awaiting Rival alignment</span>
              <div className="waiting-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
        </div>

        {/* Settings Pill Summary Bar */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2 border-t border-white/10 w-full max-w-lg">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-white/80">
            <Clock className="w-3.5 h-3.5 text-[#F5C453]" />
            <span>{currentRoom.settings.timeControlName}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-white/80">
            <Shield className="w-3.5 h-3.5 text-[#F5C453]" />
            <span>{currentRoom.settings.rated ? 'Rated Match' : 'Casual'}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-white/80">
            <Gamepad2 className="w-3.5 h-3.5 text-[#F5C453]" />
            <span>
              Color:{' '}
              {currentRoom.settings.color.charAt(0).toUpperCase() +
                currentRoom.settings.color.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Middle Row: Players (Left) & Summons (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: 👤 Players */}
        <div className="room-glass-card p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#F5C453]" />
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Celestial Aspirants
              </span>
            </div>
            <span className="text-[11px] font-mono text-white/40">
              {isOpponentJoined ? '2/2' : '1/2'} Players
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {/* Host / Creator Player Slot */}
            <div className="player-slot active">
              <div className="relative">
                <img
                  src={
                    currentRoom.creatorPhotoURL ||
                    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'
                  }
                  alt=""
                  className="w-11 h-11 rounded-full object-cover border-2 border-[#F5C453]"
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#F5C453] text-black text-[9px] font-black flex items-center justify-center">
                  👑
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white truncate">
                    {currentRoom.creatorName}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#52673A] text-white">
                    Host (Creator)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/50 font-mono mt-0.5">
                  <span>⭐ ELO: {currentRoom.creatorElo}</span>
                  <span>·</span>
                  <span className="text-[#F5C453]">
                    {currentRoom.creatorColor === 'black'
                      ? 'Black ♚'
                      : 'White ♔'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center text-xs font-black text-white/30 tracking-widest">
              VS
            </div>

            {/* Challenger Player Slot */}
            {isOpponentJoined ? (
              <div className="player-slot active">
                <img
                  src={
                    currentRoom.opponentPhotoURL ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
                  }
                  alt=""
                  className="w-11 h-11 rounded-full object-cover border-2 border-emerald-400"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white truncate">
                      {currentRoom.opponentName}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Astral Rival (Challenger)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/50 font-mono mt-0.5">
                    <span>⭐ ELO: {currentRoom.opponentElo || 1200}</span>
                    <span>·</span>
                    <span className="text-emerald-300">
                      {currentRoom.opponentColor === 'white'
                        ? 'White ♔'
                        : 'Black ♚'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="player-slot waiting justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center text-white/30">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white/60">
                      Awaiting Rival alignment...
                    </div>
                    <div className="text-[11px] text-white/40">
                      Share code or invite friends
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(true)}
                  className="room-btn-action gold !py-2 !px-3 !text-xs cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Summon</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: 📨 Summons & Allies */}
        <div className="room-glass-card p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#F5C453]" />
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Summon Allies
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="text-xs font-bold text-[#F5C453] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>View All</span>
            </button>
          </div>

          <div className="flex flex-col gap-2 flex-1">
            {friends.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-center text-white/40 gap-2">
                <Users className="w-8 h-8 opacity-40 text-[#F5C453]" />
                <p className="text-xs">
                  No online friends available right now.
                </p>
                <button
                  type="button"
                  onClick={handleShare}
                  className="room-btn-action ghost !py-1.5 !px-3 !text-xs mt-1 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share Room Link</span>
                </button>
              </div>
            ) : (
              friends.slice(0, 3).map((friend) => {
                const isInvited = invitedUids.has(friend.uid);
                const isOnline = friend.isOnline !== false;

                return (
                  <div
                    key={friend.uid}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5"
                  >
                    <div className="relative">
                      <img
                        src={
                          friend.photoURL ||
                          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80'
                        }
                        alt=""
                        className="w-8 h-8 rounded-full object-cover border border-white/10"
                      />
                      <div
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-black ${
                          isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {friend.displayName}
                      </div>
                      <div className="text-[10px] text-white/40 font-mono">
                        {isOnline ? 'Online' : 'Offline'} ·{' '}
                        {friend.elo || 1200} ELO
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuickInvite(friend)}
                      disabled={isInvited || isOpponentJoined}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isInvited
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-[#F5C453] text-black font-black uppercase text-[10px] hover:brightness-110'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {isInvited ? 'Summoned' : 'Summon'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 4. Bottom Card: 💬 Room Chat */}
      <RoomChat />

      {/* Summon Friends Modal */}
      <InviteFriendModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />
    </div>
  );
};
export default WaitingRoom;
