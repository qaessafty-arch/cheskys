import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, MessageSquare, X } from 'lucide-react';
import { ChatMessage } from '../types/chess';
import { useDemo } from '../context/DemoContext';

interface InGameChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InGameChatPanel: React.FC<InGameChatPanelProps> = ({ isOpen, onClose }) => {
  const { chatMessages, addChatMessage, currentUser } = useDemo();
  const [input, setInput] = useState('');
  const [showTyping, setShowTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (isOpen && chatMessages.length === 0) {
      // Add welcome messages
      addChatMessage({ senderId: 'system', senderName: 'System', message: 'Welcome to Chesskys Demo! Chat with your opponent.', isSystem: true });
    }
  }, [isOpen, chatMessages.length, addChatMessage]);

  const handleSend = () => {
    if (!input.trim()) return;
    addChatMessage({ senderId: currentUser.uid, senderName: currentUser.name, message: input.trim(), isSystem: false });
    setInput('');

    // Simulate opponent response
    setShowTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      const responses = [
        'Good game!',
        'Nice move.',
        'Interesting position.',
        'Your move was unexpected.',
        'Well played.',
        'Let\'s see how this goes.',
      ];
      addChatMessage({
        senderId: 'opponent',
        senderName: 'Opponent',
        message: responses[Math.floor(Math.random() * responses.length)],
        isSystem: false,
      });
      setShowTyping(false);
    }, 1000 + Math.random() * 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-[var(--panel-bg)] border-l border-[var(--glass-border)] flex flex-col z-40 shadow-[0_0_40px_rgba(0,0,0,0.5)]"
          role="dialog"
          aria-label="In-game chat"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--glass-border)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--primary-accent)]/20 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-[var(--primary-accent)]" />
              </div>
              <h3 className="font-black text-[var(--text-main)]">Chat</h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[var(--glass-bg)] hover:bg-[var(--glass-bg-hover)] flex items-center justify-center text-[var(--text-muted)] transition-colors"
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={messagesEndRef}>
            <AnimatePresence mode="popLayout">
              {chatMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`flex gap-3 ${msg.isSystem ? 'justify-center' : msg.senderId === currentUser.uid ? 'flex-row-reverse' : ''}`}
                >
                  {!msg.isSystem && msg.senderId !== currentUser.uid && (
                    <div className="w-8 h-8 rounded-full bg-[var(--primary-accent)]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-[var(--primary-accent)]">
                        {msg.senderName[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                      msg.isSystem
                        ? 'bg-[var(--glass-bg)] text-[var(--text-dim)] text-center text-xs'
                        : msg.senderId === currentUser.uid
                        ? 'bg-[var(--primary-accent)] text-[var(--app-bg)] rounded-br-md'
                        : 'bg-[var(--glass-bg)] text-[var(--text-main)] rounded-bl-md'
                    }`}
                  >
                    {!msg.isSystem && (
                      <div className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">
                        {msg.senderName}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap break-words">{msg.message}</div>
                    <div className="text-[9px] opacity-50 mt-1 text-right">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {!msg.isSystem && msg.senderId === currentUser.uid && (
                    <div className="w-8 h-8 rounded-full bg-[var(--primary-accent)] flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-[var(--app-bg)]">
                        {currentUser.name[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                </motion.div>
              ))}
              {showTyping && (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-[var(--primary-accent)]/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-[var(--primary-accent)]">🤖</span>
                  </div>
                  <div className="flex items-center gap-1 px-4 py-2 bg-[var(--glass-bg)] rounded-2xl rounded-bl-md">
                    <span className="text-[var(--text-dim)] text-sm">Opponent is typing</span>
                    <motion.span
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity }}
                    >
                      ...
                    </motion.span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-[var(--glass-border)]">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="flex-1 px-4 py-3 bg-[var(--app-bg)] border border-[var(--glass-border)] rounded-xl text-[var(--text-main)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--primary-accent)] focus:ring-2 focus:ring-[var(--primary-accent)]/20"
                maxLength={200}
                autoFocus
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="px-6 py-3 bg-[var(--primary-accent)] text-[var(--app-bg)] font-black rounded-xl hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                aria-label="Send message"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};