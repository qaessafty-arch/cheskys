import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Swords, Zap, Users, Trophy, Sparkles, Globe, Play, Activity, Cpu, Flame, Star, ChevronRight, Clock, Radio, Eye, ShieldCheck, ArrowRight } from 'lucide-react';
import { GameMode } from '../types/chess';
import { DEMO_TIME_CONTROLS, DEMO_PLAYERS } from '../data/demoData';
import { useDemo } from '../context/DemoContext';
import { UkhLogo } from './UkhLogo';

interface LiveGameTickerItem {
  id: string;
  white: { name: string; elo: number; flag: string };
  black: { name: string; elo: number; flag: string };
  timeControl: string;
  evalScore: string;
  currentMove: string;
  moveCount: number;
  spectators: number;
}

export const LandingPage: React.FC = () => {
  const { startQuickMatch, setViewMode, settings } = useDemo();
  const [activeGamesCount, setActiveGamesCount] = useState(14820);
  const [gamesPlayedToday, setGamesPlayedToday] = useState(1248920);
  const [latencyMs, setLatencyMs] = useState(18);
  const [liveGames, setLiveGames] = useState<LiveGameTickerItem[]>([
    { id: 'g-1', white: { name: 'GM Magnus K.', elo: 2842, flag: '🇳🇴' }, black: { name: 'GM Hikaru N.', elo: 2820, flag: '🇺🇸' }, timeControl: '3+0 Blitz', evalScore: '+0.4', currentMove: '32. Qxe4', moveCount: 32, spectators: 3410 },
    { id: 'g-2', white: { name: 'PeshmergaKnight', elo: 2410, flag: '☀️' }, black: { name: 'ArbilTactician', elo: 2395, flag: '☀️' }, timeControl: '10+0 Rapid', evalScore: '-1.1', currentMove: '24... Nd5', moveCount: 24, spectators: 890 },
    { id: 'g-3', white: { name: 'IM Elena_V', elo: 2490, flag: '🇪🇸' }, black: { name: 'GM Alireza_F', elo: 2785, flag: '🇫🇷' }, timeControl: '5+3 Blitz', evalScore: '+0.0', currentMove: '18. Rfc1', moveCount: 18, spectators: 1820 },
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setGamesPlayedToday(prev => prev + Math.floor(Math.random() * 3) + 1);
      setActiveGamesCount(prev => prev + (Math.random() > 0.5 ? 1 : -1));
      setLatencyMs(prev => Math.max(12, Math.min(35, prev + (Math.random() > 0.5 ? 1 : -1))));
      setLiveGames(prev => prev.map(g => ({
        ...g,
        evalScore: (Math.random() > 0.5 ? '+' : '-') + (Math.random() * 3).toFixed(1),
        moveCount: g.moveCount + (Math.random() > 0.7 ? 1 : 0),
        spectators: g.spectators + (Math.random() > 0.5 ? Math.floor(Math.random() * 10) : -Math.floor(Math.random() * 5)),
      })));
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const testimonials = [
    { quote: "The move latency is astonishingly low. It feels like moving physical pieces on an elite mahogany tournament table.", author: "Grandmaster D. Petrosyan", title: "Super GM & FIDE 2750+", avatar: "👑" },
    { quote: "The Respect Honor system and Kurdish Peshmerga cultural aesthetics bring something truly unique and soulful to digital chess.", author: "WGM Soran Hewleri", title: "Kurdistan National Champion", avatar: "☀️" },
    { quote: "From deep Stockfish vision analysis to instantaneous WebSocket synchronization, Chesskys PRO is state of the art.", author: "Master Liam Thorne", title: "Author & Lead Tactical Coach", avatar: "⚔️" },
  ];

  return (
    <div className="w-full min-h-screen relative overflow-hidden bg-[var(--app-bg)] text-white select-none">
      {/* Animated Background with UKH flag pattern */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25">
        <div
          className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[1400px] h-[1400px] rounded-3xl"
          style={{
            transform: 'perspective(1200px) rotateX(62deg) rotateZ(-24deg) translateY(-100px)',
            backgroundImage: `
              linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%),
              linear-gradient(-45deg, rgba(255,255,255,0.06) 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.06) 75%),
              linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.06) 75%)
            `,
            backgroundSize: '120px 120px',
            backgroundPosition: '0 0, 0 60px, 60px -60px, -60px 0px',
          }}
        />
        {/* UKH flag colors as subtle ambient glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#E41E20]/15 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 rounded-full bg-[#FFFFFF]/10 blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full bg-[#278E43]/15 blur-[130px]" />
      </div>

      {/* Floating Pieces */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {['♔', '♕', '♖', '♗', '♘', '♙', '♚', '♛', '♜', '♝', '♞', '♟'].map((piece, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.15, y: [0, -25, 0], rotate: [0, 8, -6, 0] }}
            style={{
              position: 'absolute',
              left: `${10 + (i * 7.5)}%`,
              top: `${15 + (i % 3) * 25}%`,
              fontSize: 'clamp(40px, 4vw, 80px)',
              filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.5))',
            }}
            transition={{ duration: 8 + i * 0.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
          >
            {piece}
          </motion.div>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header with UKH Logo */}
        <header className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UkhLogo variant="horizontal" size="lg" showText={true} />
          </div>
          <motion.span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-[var(--primary-accent)]/20 text-[var(--primary-accent)] border border-[var(--primary-accent)]/30">
            DEMO MODE — UKH INDUCTION DAY
          </motion.span>
        </header>

        {/* Main */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-center mb-16 max-w-4xl"
          >
            <UkhLogo variant="full" size="xl" showText={true} className="mb-8 mx-auto" />
            <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl font-black uppercase tracking-tight mb-6 bg-gradient-to-r from-white via-yellow-300 to-emerald-300 bg-clip-text text-transparent">
              COMPETITIVE CHESS,<br />REIMAGINED
            </h1>
            <p className="text-lg sm:text-xl text-[var(--text-muted)] max-w-2xl mx-auto mb-10 leading-relaxed">
              Experience sub-20ms latency, fair-play integrity, tournament-grade infrastructure,
              and a chess platform built with Kurdish cultural heritage at its core.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => { setViewMode('dashboard'); startQuickMatch(DEMO_TIME_CONTROLS[2], 'medium'); }}
                className="btn-primary px-10 py-4 text-lg"
              >
                <Play className="w-6 h-6 mr-2" />
                PLAY DEMO
              </button>
              <button
                onClick={() => setViewMode('dashboard')}
                className="btn-secondary px-10 py-4 text-lg"
              >
                EXPLORE PLATFORM
              </button>
            </div>
          </motion.div>

          {/* Live Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="w-full max-w-5xl grid grid-cols-3 gap-4 mb-16"
          >
            <StatCard label="Active Games" value={activeGamesCount.toLocaleString()} icon={<Activity className="w-6 h-6" />} />
            <StatCard label="Games Today" value={gamesPlayedToday.toLocaleString()} icon={<Zap className="w-6 h-6" />} />
            <StatCard label="Avg Latency" value={`${latencyMs}ms`} icon={<Clock className="w-6 h-6" />} />
          </motion.div>

          {/* Live Games Ticker */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="w-full max-w-5xl mb-16"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black uppercase tracking-tight text-[var(--text-main)]">Live Games</h2>
              <span className="flex items-center gap-2 text-[var(--text-dim)]">
                <span className="w-2 h-2 rounded-full bg-[var(--secondary-accent)] animate-pulse" />
                LIVE
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {liveGames.map((game) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * liveGames.indexOf(game) }}
                  className="glass-panel p-4 hover:glass-panel-hover transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[var(--primary-accent)]">{game.timeControl}</span>
                    <span className="flex items-center gap-1 text-[11px] text-[var(--text-dim)]">
                      <Radio className="w-3 h-3" />
                      {game.spectators} watching
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-4 mb-3">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <span className="text-xl">{game.white.flag}</span>
                        <span className="font-bold text-[var(--text-main)]">{game.white.name}</span>
                      </div>
                      <div className="text-[var(--primary-accent)] font-mono text-sm">⚔️ {game.white.elo}</div>
                    </div>
                    <span className="text-[var(--text-dim)] font-black">VS</span>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <span className="text-xl">{game.black.flag}</span>
                        <span className="font-bold text-[var(--text-main)]">{game.black.name}</span>
                      </div>
                      <div className="text-[var(--primary-accent)] font-mono text-sm">⚔️ {game.black.elo}</div>
                    </div>
                  </div>
                  <div className="glass-panel p-3 rounded-lg text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <span className="font-mono text-[var(--secondary-accent)]">{game.evalScore}</span>
                      <span className="text-[11px] text-[var(--text-dim)]">Move {game.moveCount}</span>
                    </div>
                    <div className="text-[11px] font-mono text-[var(--text-muted)]">{game.currentMove}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Features */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="w-full max-w-5xl mb-16"
          >
            <h2 className="text-xl font-black uppercase tracking-tight text-[var(--text-main)] text-center mb-10">Platform Features</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: Zap, title: 'Sub-20ms Latency', desc: 'WebSocket sync with drift-free clocks', color: 'var(--primary-accent)' },
                { icon: ShieldCheck, title: 'Fair Play Engine', desc: 'Move timing & engine correlation analysis', color: 'var(--secondary-accent)' },
                { icon: Trophy, title: 'Tournament System', desc: 'Swiss, Round Robin, Elimination, Arena', color: 'var(--tertiary-accent)' },
                { icon: Sparkles, title: '10+ Board Themes', desc: 'Instant CSS-variable theme switching', color: 'var(--danger)' },
                { icon: Cpu, title: 'AI Analysis', desc: 'Stockfish evaluation & manga recaps', color: '#A855F7' },
                { icon: Globe, title: 'Global Leaderboards', desc: 'Per-time-control ELO & UKH rankings', color: '#06B6D4' },
                { icon: Flame, title: 'Respect Honor', desc: 'Cultural gamification beyond ELO', color: '#F97316' },
                { icon: Star, title: 'Cross-Platform', desc: 'Desktop, mobile, PWA ready', color: '#84CC16' },
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="glass-panel p-6 hover:glass-panel-hover transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform" style={{ backgroundColor: `${feature.color}20` }}>
                    <feature.icon className="w-6 h-6" style={{ color: feature.color }} />
                  </div>
                  <h3 className="font-black text-[var(--text-main)] mb-2">{feature.title}</h3>
                  <p className="text-[var(--text-dim)] text-sm">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Testimonials */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="w-full max-w-5xl mb-16"
          >
            <h2 className="text-xl font-black uppercase tracking-tight text-[var(--text-main)] text-center mb-10">Trusted by Champions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i }}
                  className="glass-panel p-6 hover:glass-panel-hover transition-all"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-[var(--primary-accent)]/20 flex items-center justify-center text-2xl">{t.avatar}</div>
                    <div>
                      <div className="font-bold text-[var(--text-main)]">{t.author}</div>
                      <div className="text-[11px] text-[var(--text-dim)]">{t.title}</div>
                    </div>
                  </div>
                  <p className="text-[var(--text-muted)] italic">"{t.quote}"</p>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="text-center glass-panel p-8 rounded-2xl border border-[var(--primary-accent)]/30"
          >
            <h3 className="text-2xl font-black text-[var(--text-main)] mb-2">Ready to Play?</h3>
            <p className="text-[var(--text-muted)] mb-6">Jump into a game against our demo bot or explore the platform</p>
            <button
              onClick={() => { setViewMode('dashboard'); startQuickMatch(DEMO_TIME_CONTROLS[2], 'medium'); }}
              className="btn-primary px-10 py-4 text-lg"
            >
              <Play className="w-6 h-6 mr-2" />
              START DEMO MATCH
            </button>
          </motion.div>
        </main>

        {/* Footer */}
        <footer className="px-6 py-6 border-t border-[var(--glass-border)] flex flex-col sm:flex-row items-center justify-between gap-4 text-[var(--text-dim)] text-sm">
          <div className="flex items-center gap-4">
            <UkhLogo variant="horizontal" size="sm" showText={true} />
            <span>•</span>
            <span>UKH Induction Day 2026</span>
            <span>•</span>
            <a href="https://github.com/qaessafty-arch/cheskys" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--primary-accent)] transition-colors">GitHub</a>
          </div>
          <div className="flex items-center gap-6">
            <span>♟️ Demo uses mock data — no backend required</span>
            <span>🛡 Fair Play badge shown for demo only</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="glass-panel p-6 rounded-2xl text-center">
    <div className="flex items-center justify-center mb-2" style={{ color: 'var(--primary-accent)' }}>{icon}</div>
    <div className="text-3xl sm:text-4xl font-black text-[var(--text-main)] font-mono">{value}</div>
    <div className="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)] mt-1">{label}</div>
  </div>
);