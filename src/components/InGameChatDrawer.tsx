import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  Volume2, 
  VolumeX, 
  X, 
  Sparkles, 
  Smile, 
  ShieldAlert,
  Check
} from 'lucide-react';
import DOMPurify from 'dompurify';

export interface InGameChatMessage {
  id: string;
  sender: string;
  senderRole: 'player' | 'opponent' | 'system';
  text: string;
  timestamp: string;
  isEmote?: boolean;
}

interface InGameChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  opponentName: string;
  messages: InGameChatMessage[];
  onSendMessage: (text: string, isEmote?: boolean) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

const QUICK_EMOTES = [
  'Good luck! ☀️',
  'Nice move! 👏',
  'GG! 🤝',
  'Well played! 🏆',
  'Thinking... 🤔',
  '⚔️ Attack!',
  'Impressive defense! 🛡️',
  'Oops! 😅'
];

export const InGameChatDrawer: React.FC<InGameChatDrawerProps> = ({
  isOpen,
  onClose,
  opponentName,
  messages,
  onSendMessage,
  isMuted,
  onToggleMute
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim(), false);
    setInputText('');
  };

  const handleQuickEmote = (emote: string) => {
    onSendMessage(emote, true);
  };

  return (
    <div
      id="in-game-chat-drawer"
      className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-[#121710] border-l border-[#F5C453]/30 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300 select-none"
    >
      {/* Drawer Header */}
      <div className="p-4 border-b border-white/10 bg-black/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#52673A]/40 border border-[#F5C453]/40 flex items-center justify-center text-amber-300">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black text-white flex items-center gap-1.5">
              <span>Match Chat</span>
              <span className="text-[10px] text-[#DFD0B0]/60">vs {opponentName}</span>
            </h3>
            <p className="text-[10px] text-white/50">Tactical in-game communication</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Opponent Mute Toggle */}
          <button
            type="button"
            onClick={onToggleMute}
            className={`min-w-[40px] min-h-[40px] p-2 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
              isMuted
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-white/10'
            }`}
            title={isMuted ? 'Opponent is Muted (Click to Unmute)' : 'Mute Opponent Chat'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            <span className="text-[10px] hidden sm:inline">{isMuted ? 'Muted' : 'Mute'}</span>
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/10"
            aria-label="Close Chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mute Notice Banner */}
      {isMuted && (
        <div className="px-4 py-2 bg-rose-950/40 border-b border-rose-800/40 text-rose-300 text-[11px] flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span>Opponent chat and emotes are currently muted.</span>
        </div>
      )}

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {messages.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-2 text-white/40">
            <Smile className="w-8 h-8 mx-auto text-[#F5C453]/40" />
            <p className="text-xs">No messages yet in this game.</p>
            <p className="text-[10px]">Send a quick greeting or reaction below!</p>
          </div>
        ) : (
          messages.map(msg => {
            if (isMuted && msg.senderRole === 'opponent') {
              return null; // Suppress opponent messages when muted
            }

            const isMe = msg.senderRole === 'player';
            const isSystem = msg.senderRole === 'system';

            if (isSystem) {
              return (
                <div key={msg.id} className="text-center py-1 text-[10px] font-mono text-[#F5C453]/70" dangerouslySetInnerHTML={{ __html: `── ${DOMPurify.sanitize(msg.text)} ──` }} />
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-0.5`}
              >
                <div className="flex items-center gap-1 px-1">
                  <span className="text-[10px] font-bold text-white/60">
                    {isMe ? 'You' : msg.sender}
                  </span>
                  <span className="text-[9px] text-white/30">{msg.timestamp}</span>
                </div>
                <div
                  className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs font-medium ${
                    isMe
                      ? msg.isEmote
                        ? 'bg-[#52673A] text-white border border-[#F5C453]/50 shadow-md font-bold'
                        : 'bg-[#52673A]/80 text-white border border-white/10'
                      : msg.isEmote
                      ? 'bg-amber-950/60 text-amber-200 border border-amber-500/40 font-bold'
                      : 'bg-white/10 text-white/90 border border-white/5'
                  }`}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.text) }}
                />
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Emote Presets Tray */}
      <div className="p-3 bg-black/60 border-t border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#DFD0B0]/60 uppercase tracking-wider">
            Quick Reactions
          </span>
          <Sparkles className="w-3 h-3 text-amber-300" />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {QUICK_EMOTES.map((emote, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickEmote(emote)}
              className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-white/90 hover:text-white text-xs font-bold whitespace-nowrap border border-white/10 transition-all cursor-pointer shrink-0 active:scale-95"
            >
              {emote}
            </button>
          ))}
        </div>

        {/* Custom Text Input Form */}
        <form onSubmit={handleSend} className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Type tactical message..."
            maxLength={140}
            className="flex-1 min-h-[44px] px-3.5 py-2 bg-black/80 border border-white/15 rounded-xl text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-[#F5C453]"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="min-w-[44px] min-h-[44px] px-3.5 py-2 rounded-xl bg-[#52673A] hover:bg-[#52673A]/80 disabled:opacity-40 text-white font-bold flex items-center justify-center transition-all cursor-pointer shrink-0 border border-[#F5C453]/40"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
