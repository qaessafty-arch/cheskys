import React, { useEffect, useMemo, useState } from 'react';
import { AtSign, Ban, MoreVertical, Search, Sparkles, UserMinus, Users, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { FriendUser } from '../../types/chess';
import { useSocialGraph } from '../../hooks/useSocialGraph';
import { blockUser, checkUsernameAvailability, fetchSuggestedPlayers, removeFriendRelationship, searchUsersInDirectory } from '../../services/friendService';
import { PlayerAvatar, PlayerRow } from './PlayerRow';

interface SocialPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChat?: (friend: FriendUser) => void;
  onChallengeFriend?: (friend: FriendUser) => void;
}

type Tab = 'friends' | 'requests' | 'find';

export const SocialPanel: React.FC<SocialPanelProps> = ({ isOpen, onClose, onOpenChat }) => {
  const { user, profile, isGuest, signInWithGoogle, updateProfileDetails } = useAuth();
  const signedIn = !!user && !isGuest && !!profile;
  const graph = useSocialGraph(profile?.uid, isOpen && signedIn);
  const [tab, setTab] = useState<Tab>('friends');
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<FriendUser[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [suggested, setSuggested] = useState<FriendUser[]>([]);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameState, setNameState] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle');

  const notify = (text: string, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(t => (t?.text === text ? null : t)), 3500);
  };

  // Searching real players by name or @username.
  useEffect(() => {
    const term = search.trim();
    if (!signedIn || term.length < 2) {
      setResults(null);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      setResults(await searchUsersInDirectory(term, profile!.uid));
      setSearching(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [search, signedIn, profile?.uid]);

  // Suggestions refresh when the friends or requests change.
  const excludeKey = [...graph.friendIds, ...graph.outgoing.map(r => r.toUserId), ...graph.incoming.map(r => r.fromUserId), ...graph.blocked.map(b => b.uid)].join(',');
  useEffect(() => {
    if (!isOpen || !signedIn) return;
    const myElo = typeof profile?.elo === 'number' ? profile.elo : 800;
    fetchSuggestedPlayers(profile!.uid, myElo, new Set(excludeKey.split(',').filter(Boolean))).then(setSuggested);
  }, [isOpen, signedIn, excludeKey, profile?.uid]);

  // Username: lets friends find you by @handle.
  useEffect(() => {
    const clean = nameInput.trim().toLowerCase().replace(/^@/, '');
    if (!editingName || clean.length < 3) {
      setNameState('idle');
      return;
    }
    setNameState('checking');
    const timer = setTimeout(async () => setNameState((await checkUsernameAvailability(clean, profile?.uid)) ? 'free' : 'taken'), 400);
    return () => clearTimeout(timer);
  }, [nameInput, editingName, profile?.uid]);

  const saveUsername = async () => {
    const clean = nameInput.trim().toLowerCase().replace(/^@/, '');
    if (nameState !== 'free') return;
    try {
      await updateProfileDetails({ username: clean });
      setEditingName(false);
      notify(`Your username is now @${clean}.`);
    } catch {
      notify('Could not save the username.', false);
    }
  };

  const sortedFriends = useMemo(
    () => [...graph.friends].sort((a, b) => Number(graph.unread.has(b.uid)) - Number(graph.unread.has(a.uid)) || Number(b.isOnline) - Number(a.isOnline) || a.displayName.localeCompare(b.displayName)),
    [graph.friends, graph.unread]
  );
  const onlineCount = graph.friends.filter(f => f.isOnline).length;
  const requestCount = graph.incoming.length;

  if (!isOpen) return null;

  const openChat = (f: FriendUser) => {
    onOpenChat?.(f);
  };

  const tabButton = (id: Tab, label: string, badge?: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={`flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${tab === id ? 'bg-white/10 text-[#F5C453]' : 'text-white/60 hover:text-white'}`}
    >
      {label}
      {!!badge && <span className="min-w-5 px-1.5 py-0.5 rounded-full bg-[#F5C453] text-black text-[10px]">{badge}</span>}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Friends"
        className="relative obsidian-panel w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl border border-[#1F293D] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#F5C453]/15 flex items-center justify-center">
              <Users className="w-5 h-5 text-[#F5C453]" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider">Friends</h2>
              {signedIn && (
                <p className="text-[11px] text-white/60">
                  {graph.friends.length} friend{graph.friends.length === 1 ? '' : 's'} · <span className="text-emerald-400">{onlineCount} online</span>
                </p>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!signedIn ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-sm text-white/80">Friends, chat and the leaderboard are for real players. Sign in with your Google account to join.</p>
            <button type="button" onClick={() => signInWithGoogle().catch(() => notify('Google sign-in did not complete.', false))} className="px-5 py-2.5 rounded-xl bg-white text-black font-black text-sm">
              Continue with Google
            </button>
          </div>
        ) : (
          <>
            {/* Your handle, so friends can find you. */}
            <div className="px-4 pt-3">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <AtSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/50" />
                    <input
                      autoFocus
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveUsername()}
                      maxLength={20}
                      placeholder="username"
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-black/40 border border-white/10 text-sm text-white focus:outline-none focus:border-[#F5C453]/50"
                    />
                  </div>
                  <button type="button" disabled={nameState !== 'free'} onClick={saveUsername} className="px-3 py-2 rounded-xl bg-[#F5C453] text-black text-[11px] font-black uppercase disabled:opacity-40">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingName(false)} className="px-2 py-2 text-white/60 text-[11px]">Cancel</button>
                </div>
              ) : (
                <button type="button" onClick={() => { setNameInput(profile!.username || ''); setEditingName(true); }} className="text-[11px] text-white/60 hover:text-white">
                  {profile!.username ? <>Your username: <span className="font-black text-white">@{profile!.username}</span> (change)</> : 'Set a username so friends can find you'}
                </button>
              )}
              {editingName && nameState !== 'idle' && (
                <p className={`mt-1 text-[11px] ${nameState === 'free' ? 'text-emerald-400' : nameState === 'taken' ? 'text-rose-400' : 'text-white/50'}`}>
                  {nameState === 'checking' ? 'Checking…' : nameState === 'free' ? 'Available' : 'Taken or not allowed (3–20 letters, numbers or _)'}
                </p>
              )}
            </div>

            <div className="flex gap-1 m-4 mb-2 p-1 rounded-2xl bg-black/30 border border-white/5" role="tablist">
              {tabButton('friends', 'Friends')}
              {tabButton('requests', 'Requests', requestCount)}
              {tabButton('find', 'Find players')}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
              {tab === 'friends' && (
                graph.loading ? (
                  <p className="text-sm text-white/60 py-6 text-center">Loading friends…</p>
                ) : sortedFriends.length === 0 ? (
                  <div className="text-center py-6 space-y-2">
                    <p className="text-sm text-white/70">No friends yet.</p>
                    <button type="button" onClick={() => setTab('find')} className="px-4 py-2 rounded-xl bg-[#F5C453] text-black text-[11px] font-black uppercase">Find players</button>
                  </div>
                ) : (
                  sortedFriends.map(f => (
                    <div key={f.uid} className="relative">
                      <PlayerRow
                        player={f}
                        graph={graph}
                        unread={graph.unread.has(f.uid)}
                        onMessage={openChat}
                        onResult={notify}
                        extra={
                          <button type="button" aria-label={`More for ${f.displayName}`} onClick={() => setMenuFor(m => (m === f.uid ? null : f.uid))} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        }
                      />
                      {menuFor === f.uid && (
                        <div className="absolute right-2 top-full mt-1 z-10 w-44 rounded-xl border border-white/10 bg-[#0B0F19] shadow-xl p-1">
                          <button
                            type="button"
                            onClick={async () => {
                              setMenuFor(null);
                              if (!window.confirm(`Remove ${f.displayName} from your friends?`)) return;
                              notify((await removeFriendRelationship(profile!.uid, f.uid)) ? `${f.displayName} removed.` : 'Could not remove.', true);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/80 hover:bg-white/10"
                          >
                            <UserMinus className="w-3.5 h-3.5" /> Remove friend
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setMenuFor(null);
                              if (!window.confirm(`Block ${f.displayName}? They will be removed and cannot send you requests.`)) return;
                              notify((await blockUser(profile!.uid, f.uid, f.displayName)) ? `${f.displayName} blocked.` : 'Could not block.', true);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-rose-300 hover:bg-white/10"
                          >
                            <Ban className="w-3.5 h-3.5" /> Block
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )
              )}

              {tab === 'requests' && (
                <>
                  <h3 className="text-[11px] font-black text-white/60 uppercase tracking-wider">Received</h3>
                  {graph.incoming.length === 0 ? (
                    <p className="text-sm text-white/60">No new requests.</p>
                  ) : (
                    graph.incoming.map(r => (
                      <PlayerRow
                        key={r.id}
                        player={{ uid: r.fromUserId, displayName: r.fromUserName, username: r.fromUsername, photoURL: r.fromUserAvatar, elo: r.fromUserElo, respectPoints: 0, honorRank: r.fromUserHonorRank, rankBadge: '' }}
                        graph={graph}
                        onResult={notify}
                        subtitle={<>{r.fromUsername ? `@${r.fromUsername} · ` : ''}<span className="font-mono">{r.fromUserElo}</span> Elo · wants to be friends</>}
                      />
                    ))
                  )}
                  <h3 className="pt-2 text-[11px] font-black text-white/60 uppercase tracking-wider">Sent</h3>
                  {graph.outgoing.length === 0 ? (
                    <p className="text-sm text-white/60">No pending requests.</p>
                  ) : (
                    graph.outgoing.map(r => (
                      <PlayerRow
                        key={r.id}
                        player={{ uid: r.toUserId, displayName: (r as any).toUserName || (r.toUsername ? `@${r.toUsername}` : 'Player'), username: r.toUsername, elo: 0, respectPoints: 0, honorRank: '', rankBadge: '' }}
                        graph={graph}
                        onResult={notify}
                        subtitle="Waiting for an answer · tap to cancel"
                      />
                    ))
                  )}
                  {graph.blocked.length > 0 && (
                    <>
                      <h3 className="pt-2 text-[11px] font-black text-white/60 uppercase tracking-wider">Blocked</h3>
                      {graph.blocked.map(b => (
                        <PlayerRow key={b.uid} player={{ uid: b.uid, displayName: b.displayName, elo: 0, respectPoints: 0, honorRank: '', rankBadge: '' }} graph={graph} onResult={notify} subtitle="Blocked" />
                      ))}
                    </>
                  )}
                </>
              )}

              {tab === 'find' && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search by name or @username"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white focus:outline-none focus:border-[#F5C453]/50"
                    />
                  </div>
                  {results !== null ? (
                    searching ? (
                      <p className="text-sm text-white/60 py-3">Searching…</p>
                    ) : results.length === 0 ? (
                      <p className="text-sm text-white/60 py-3">No players found.</p>
                    ) : (
                      results.map(p => <PlayerRow key={p.uid} player={p} graph={graph} onMessage={openChat} onResult={notify} />)
                    )
                  ) : (
                    <>
                      <h3 className="pt-1 text-[11px] font-black text-white/60 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#F5C453]" /> Suggested players near your rating
                      </h3>
                      {suggested.length === 0 ? (
                        <p className="text-sm text-white/60">No suggestions right now. Search for a friend by name.</p>
                      ) : (
                        suggested.map(p => <PlayerRow key={p.uid} player={p} graph={graph} onMessage={openChat} onResult={notify} />)
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {toast && (
          <div
            role="status"
            className={`absolute left-4 right-4 bottom-4 px-4 py-2.5 rounded-xl text-sm font-bold shadow-xl ${toast.ok ? 'bg-emerald-500 text-black' : 'bg-rose-500 text-white'}`}
          >
            {toast.text}
          </div>
        )}
      </div>
    </div>
  );
};

export { PlayerAvatar };
export default SocialPanel;
