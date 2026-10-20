import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Mic, Send, Square, Swords, Trash2, X, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FriendUser, DirectMessageItem, TimeControl } from '../types/chess';
import { TIME_CONTROLS } from '../utils/chessEngine';
import {
  ChatMeta,
  getChatId,
  listenToChatMeta,
  listenToDirectMessages,
  listenToDirectTyping,
  markChatRead,
  sendDirectMessage,
  setChallengeStatus,
  setDirectTyping,
} from '../services/chatService';
import { acceptOnlineMatchChallenge, createOnlineMatchChallenge } from '../services/onlineMatchService';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { PlayerAvatar, lastSeenText } from './social/PlayerRow';

interface FriendChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  friend: FriendUser | null;
  onStartOnlineMatch: (matchId: string) => void;
}

const QUICK_CHAT = [
  'Hi! 👋',
  'Want to play? ♟️',
  'Rematch? ⚔️',
  'Good game! 🤝',
  'Well played! 👏',
  'Thanks!',
  'One more?',
  'Brb ⏳',
  'shakh shakh',
  "nah i'd win",
  'kodiiiiiiii',
];

const CHALLENGE_TIMES = TIME_CONTROLS.filter(t => t.category !== 'unlimited').slice(0, 6);

const formatClock = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const timeOf = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

type Msg = DirectMessageItem & { type?: string; audio?: string; audioMs?: number };

export const FriendChatModal: React.FC<FriendChatModalProps> = ({ isOpen, onClose, friend, onStartOnlineMatch }) => {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [meta, setMeta] = useState<ChatMeta | null>(null);
  const [friendTyping, setFriendTyping] = useState(false);
  const [input, setInput] = useState('');
  const [showQuick, setShowQuick] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [timeControl, setTimeControl] = useState<TimeControl>(CHALLENGE_TIMES[2] ?? TIME_CONTROLS[0]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const typingSentRef = useRef(0);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voice = useVoiceRecorder();

  const myUid = profile?.uid ?? '';
  const chatId = myUid && friend?.uid ? getChatId(myUid, friend.uid) : '';

  useEffect(() => {
    if (!isOpen || !chatId || !friend) return;
    setError(null);
    const stops = [
      listenToDirectMessages(chatId, setMessages, setError),
      listenToChatMeta(chatId, setMeta),
      listenToDirectTyping(chatId, friend.uid, setFriendTyping),
    ];
    return () => {
      stops.forEach(s => s());
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      setDirectTyping(chatId, myUid, false);
    };
  }, [isOpen, chatId, friend?.uid, myUid]);

  // Reading the chat marks it read, which drives the friend's "Seen" and your unread dot.
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (isOpen && chatId && lastId) markChatRead(chatId, myUid);
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [isOpen, chatId, lastId, myUid]);
  useEffect(() => {
    if (friendTyping) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [friendTyping]);

  // A voice clip that reached the 30-second limit sends itself.
  useEffect(() => {
    if (!voice.finishedClip) return;
    const clip = voice.takeFinishedClip();
    if (clip) send({ text: '', type: 'voice', audio: clip.dataUrl, audioMs: clip.durationMs });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.finishedClip]);

  const seenId = useMemo(() => {
    const friendRead = friend ? meta?.[`lastRead_${friend.uid}`] : undefined;
    if (!friendRead) return null;
    const mine = [...messages].reverse().find(m => m.senderId === myUid);
    return mine && mine.createdAt <= friendRead ? mine.id : null;
  }, [messages, meta, friend, myUid]);

  if (!isOpen || !friend || !profile) return null;

  const sender = {
    senderId: profile.uid,
    senderName: profile.displayName || 'Player',
    senderAvatar: profile.photoURL || null,
    senderBadge: profile.rankBadge || '☀️',
  };

  async function send(content: { text: string; type: 'text' | 'quick' | 'voice' | 'challenge'; audio?: string; audioMs?: number; challengeData?: any }) {
    if (!chatId) return;
    setSending(true);
    setError(null);
    try {
      await sendDirectMessage(chatId, { ...sender, ...content });
      setDirectTyping(chatId, myUid, false);
      typingSentRef.current = 0;
    } catch (e: any) {
      setError(e?.code === 'permission-denied' ? `You can only chat with friends. Is ${friend!.displayName} still your friend?` : 'Message not sent. Check your connection.');
      throw e;
    } finally {
      setSending(false);
    }
  }

  const sendText = async () => {
    const text = input.trim();
    if (!text || sending) return;
    try {
      await send({ text, type: 'text' });
      setInput('');
    } catch {
      // The error banner explains what went wrong; the text stays in the box.
    }
  };

  const onType = (value: string) => {
    setInput(value);
    if (!chatId) return;
    const now = Date.now();
    if (value && now - typingSentRef.current > 3000) {
      typingSentRef.current = now;
      setDirectTyping(chatId, myUid, true);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      typingSentRef.current = 0;
      setDirectTyping(chatId, myUid, false);
    }, 5000);
  };

  const finishVoice = async () => {
    const clip = await voice.stop();
    if (clip) await send({ text: '', type: 'voice', audio: clip.dataUrl, audioMs: clip.durationMs }).catch(() => {});
  };

  const sendChallenge = async () => {
    setShowChallenge(false);
    try {
      const matchId = await createOnlineMatchChallenge(
        {
          uid: profile.uid,
          displayName: profile.displayName || 'Player',
          username: profile.username,
          photoURL: profile.photoURL || null,
          elo: typeof profile.elo === 'number' ? profile.elo : parseInt(profile.elo || '1200', 10),
          respectPoints: typeof profile.respectPoints === 'number' ? profile.respectPoints : parseInt(profile.respectPoints || '100', 10),
          honorRank: profile.honorRank,
          rankBadge: profile.rankBadge,
        },
        friend,
        timeControl,
        'random'
      );
      if (!matchId) throw new Error('no match');
      await send({
        text: `⚔️ Challenged you to a ${timeControl.name} game`,
        type: 'challenge',
        challengeData: { matchId, timeControlName: timeControl.name, timeControlSeconds: timeControl.initialSeconds, challengerColor: 'random', status: 'pending' },
      });
      onStartOnlineMatch(matchId);
    } catch {
      setError('Could not create the game. Try again.');
    }
  };

  const acceptChallenge = async (m: Msg) => {
    if (!m.challengeData) return;
    try {
      await setChallengeStatus(chatId, m.id, m.challengeData, 'accepted');
      await acceptOnlineMatchChallenge(m.challengeData.matchId);
      onStartOnlineMatch(m.challengeData.matchId);
    } catch {
      setError('This challenge is no longer available.');
    }
  };

  const declineChallenge = async (m: Msg) => {
    if (m.challengeData) await setChallengeStatus(chatId, m.id, m.challengeData, 'declined').catch(() => {});
  };

  const status = friendTyping ? 'typing…' : friend.isOnline ? 'Online' : lastSeenText(friend.lastSeen);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Chat with ${friend.displayName}`}
        onClick={e => e.stopPropagation()}
        className="relative obsidian-panel w-full max-w-lg h-[640px] max-h-[92vh] flex flex-col rounded-3xl border border-[#1F293D] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-3 sm:p-4 border-b border-white/10">
          <PlayerAvatar player={friend} size={44} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black text-white truncate">{friend.displayName}</div>
            <div className={`text-[11px] ${friendTyping || friend.isOnline ? 'text-emerald-400' : 'text-white/60'}`}>
              {status} · <span className="font-mono">{friend.elo}</span> Elo
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowChallenge(v => !v)}
            className="px-3 py-2 rounded-xl bg-[#F5C453] text-black text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5"
          >
            <Swords className="w-3.5 h-3.5" /> Play
          </button>
          <button type="button" onClick={onClose} aria-label="Close chat" className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {showChallenge && (
          <div className="p-3 border-b border-white/10 bg-black/30 space-y-2">
            <div className="text-[11px] font-black text-white/70 uppercase tracking-wider">Challenge {friend.displayName}</div>
            <div className="flex flex-wrap gap-1.5">
              {CHALLENGE_TIMES.map(t => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setTimeControl(t)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border ${t.name === timeControl.name ? 'bg-[#F5C453]/20 border-[#F5C453] text-[#F5C453]' : 'border-white/10 text-white/70'}`}
                >
                  {t.name}
                </button>
              ))}
            </div>
            <button type="button" onClick={sendChallenge} className="w-full py-2 rounded-xl bg-emerald-500 text-black text-[11px] font-black uppercase">
              Send challenge ({timeControl.name})
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2" aria-live="polite">
          {messages.length === 0 && !error && (
            <div className="text-center text-sm text-white/60 py-10">
              Say hello to {friend.displayName}! Send a quick message or record a voice message below.
            </div>
          )}
          {messages.map(m => {
            const mine = m.senderId === myUid;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed break-words ${
                    mine ? 'bg-[#F5C453] text-black rounded-br-md' : 'bg-white/10 text-white rounded-bl-md'
                  } ${m.type === 'quick' ? 'font-bold' : ''}`}
                >
                  {m.type === 'voice' && m.audio ? (
                    <div className="flex items-center gap-2">
                      <Mic className="w-4 h-4 shrink-0" />
                      <audio controls preload="metadata" src={m.audio} className="h-9 max-w-[220px]" />
                      {m.audioMs ? <span className="text-[11px] font-mono opacity-70">{formatClock(m.audioMs)}</span> : null}
                    </div>
                  ) : (
                    <span>{m.text}</span>
                  )}
                  {m.challengeData && (
                    <div className="mt-2 pt-2 border-t border-black/10 flex items-center gap-2">
                      {m.challengeData.status === 'pending' && !mine ? (
                        <>
                          <button type="button" onClick={() => acceptChallenge(m)} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-[11px] font-black uppercase flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Accept
                          </button>
                          <button type="button" onClick={() => declineChallenge(m)} className="px-3 py-1.5 rounded-lg bg-black/20 text-[11px] font-black uppercase">
                            Decline
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] font-black uppercase opacity-70">
                          {m.challengeData.status === 'pending' ? 'Waiting for answer' : m.challengeData.status}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <span className="mt-0.5 text-[10px] text-white/50 font-mono">
                  {timeOf(m.createdAt)}
                  {m.id === seenId && ' · Seen'}
                </span>
              </div>
            );
          })}
          {friendTyping && (
            <div className="flex items-center gap-1 px-3 py-2 rounded-2xl bg-white/10 w-fit" aria-label={`${friend.displayName} is typing`}>
              <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:120ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:240ms]" />
            </div>
          )}
          <div ref={endRef} />
        </div>

        {(error || voice.error) && <div className="mx-3 mb-2 px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200">{error || voice.error}</div>}

        {showQuick && (
          <div className="px-3 pb-2 flex flex-wrap gap-1.5">
            {QUICK_CHAT.map(q => (
              <button
                key={q}
                type="button"
                disabled={sending}
                onClick={() => send({ text: q, type: 'quick' }).then(() => setShowQuick(false)).catch(() => {})}
                className="px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-[12px] text-white"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input row: quick chat, text, voice */}
        <div className="p-3 border-t border-white/10 flex items-center gap-2">
          {voice.recording ? (
            <>
              <button type="button" onClick={voice.cancel} aria-label="Cancel voice message" className="p-2.5 rounded-xl bg-white/10 text-white/70">
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-sm font-mono text-white">{formatClock(voice.elapsedMs)}</span>
                <span className="text-[11px] text-white/60">/ 0:30</span>
              </div>
              <button type="button" onClick={finishVoice} aria-label="Send voice message" className="p-2.5 rounded-xl bg-emerald-500 text-black">
                <Square className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowQuick(v => !v)}
                aria-label="Quick chat"
                aria-pressed={showQuick}
                className={`p-2.5 rounded-xl ${showQuick ? 'bg-[#F5C453] text-black' : 'bg-white/10 text-white/80'}`}
              >
                <Zap className="w-4 h-4" />
              </button>
              <input
                value={input}
                onChange={e => onType(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendText()}
                maxLength={1000}
                placeholder="Message…"
                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white focus:outline-none focus:border-[#F5C453]/50"
              />
              {input.trim() ? (
                <button type="button" onClick={sendText} disabled={sending} aria-label="Send" className="p-2.5 rounded-xl bg-[#F5C453] text-black disabled:opacity-50">
                  <Send className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={voice.start}
                  disabled={!voice.supported}
                  aria-label="Record a voice message"
                  title={voice.supported ? 'Record a voice message' : 'Voice messages are not supported in this browser'}
                  className="p-2.5 rounded-xl bg-white/10 text-white/80 disabled:opacity-40"
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendChatModal;
