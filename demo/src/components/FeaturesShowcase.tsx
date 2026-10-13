import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import {
  Zap, ShieldCheck, Trophy, Sparkles, Cpu, Globe, Flame, Star,
  Users, Award, Brain, Target, Crown, Shield, MessageSquare,
  Volume2, Settings, Palette, Layers, Clock, Search, Flag,
  HeartHandshake, BarChart2, Download, Upload, Eye, ChevronRight,
  ChevronLeft, Play, Pause, RotateCcw, Flag as FlagIcon, Bell
} from 'lucide-react';
import { UkhLogo } from './UkhLogo';

const FEATURE_CATEGORIES = [
  {
    id: 'core',
    title: 'Core Gameplay',
    icon: Zap,
    color: 'var(--primary-accent)',
    features: [
      {
        name: 'Sub-20ms Real-time Multiplayer',
        desc: 'WebSocket sync with drift-free clocks, 500ms tick intervals',
        icon: Zap,
        demo: 'Live clock sync'
      },
      {
        name: 'Drift-free Chess Clock System',
        desc: 'High-resolution timestamp deltas, Fischer increment per move, pause/resume sync',
        icon: Clock,
        demo: 'Interactive clock'
      },
      {
        name: 'Complete Rule Engine (chess.js)',
        desc: 'Legal moves, check/checkmate, stalemate, 3-fold repetition, 50-move rule, insufficient material',
        icon: ShieldCheck,
        demo: 'Try illegal move'
      },
      {
        name: 'Pawn Promotion Dialog',
        desc: 'Queen/Rook/Bishop/Knight selection with 5s auto-queen timer',
        icon: Crown,
        demo: 'Promote pawn'
      },
      {
        name: 'Draw & Resignation System',
        desc: 'Offer/accept/decline draws, takebacks, resign confirmation',
        icon: HeartHandshake,
        demo: 'Offer draw'
      },
      {
        name: 'Time Controls: Bullet → Classical',
        desc: '1+0, 3+0, 3+2, 5+3, 10+0, 15+10 with increment support',
        icon: Target,
        demo: 'Select time control'
      },
    ]
  },
  {
    id: 'fairplay',
    title: 'Fair Play & Anti-Cheat',
    icon: Shield,
    color: 'var(--secondary-accent)',
    features: [
      {
        name: 'Move Timing Analysis',
        desc: 'Detects robotic play: avg <200ms AND variance <50ms across 10+ moves',
        icon: Brain,
        demo: 'Timing graph'
      },
      {
        name: 'Engine Correlation Detection',
        desc: 'Flags superhuman accuracy >90% AND best-move rate >85%',
        icon: Cpu,
        demo: 'Accuracy meter'
      },
      {
        name: 'ELO-Adaptive Thresholds',
        desc: 'Relaxes detection for lower-rated players (95%/92% vs 90%/85%)',
        icon: Target,
        demo: 'Threshold slider'
      },
      {
        name: 'Flag Escalation System',
        desc: '3 flags → monitor, 5 flags → 7-day auto-suspension',
        icon: Flag,
        demo: 'Flag counter'
      },
      {
        name: 'Audit Trail & Moderator Alerts',
        desc: 'All flags logged to PostgreSQL + Redis (24hr TTL), WebSocket moderator notifications',
        icon: Shield,
        demo: 'Audit log'
      },
    ]
  },
  {
    id: 'social',
    title: 'Social & Community',
    icon: Users,
    color: '#F97316',
    features: [
      {
        name: 'Friend System',
        desc: 'Send/accept/decline requests with messages, online status, direct challenges',
        icon: Users,
        demo: 'Friend list'
      },
      {
        name: 'In-Game Chat',
        desc: 'Real-time messages with /resign, /draw, /takeback slash commands, typing indicators',
        icon: MessageSquare,
        demo: 'Chat demo'
      },
      {
        name: 'Notifications Center',
        desc: 'Bell icon with unread badge: challenges, friend requests, achievements, tournament invites',
        icon: Bell,
        demo: 'Notification panel'
      },
      {
        name: 'Player Profiles',
        desc: 'Custom avatars, display name, country, badges, privacy settings',
        icon: Award,
        demo: 'Profile editor'
      },
      {
        name: 'Respect & Honor System',
        desc: 'Cultural gamification beyond ELO: respect points, honor ranks, immortal status',
        icon: HeartHandshake,
        demo: 'Honor meter'
      },
    ]
  },
  {
    id: 'tournaments',
    title: 'Tournament System',
    icon: Trophy,
    color: '#8B5CF6',
    features: [
      {
        name: 'Swiss System Pairing',
        desc: 'Score-based pairing, prevents repeat matchups, bye for odd counts',
        icon: Brain,
        demo: 'Pairing engine'
      },
      {
        name: 'Round Robin (Berger Tables)',
        desc: 'Polygon rotation tables for everyone-plays-everyone',
        icon: RotateCcw,
        demo: 'Round robin view'
      },
      {
        name: 'Single/Double Elimination',
        desc: 'Bracket generation with proper seeding',
        icon: Trophy,
        demo: 'Bracket demo'
      },
      {
        name: 'Arena Format',
        desc: 'Time-limited continuous play, join anytime, point streaks',
        icon: Zap,
        demo: 'Arena timer'
      },
      {
        name: 'Sonneborn-Berger Tiebreaks',
        desc: 'Defeated opponents\' scores + ½ drawn opponents\' scores',
        icon: Target,
        demo: 'Tiebreak calc'
      },
    ]
  },
  {
    id: 'analytics',
    title: 'Analytics & Leaderboards',
    icon: BarChart2,
    color: '#06B6D4',
    features: [
      {
        name: 'Multi-Time-Control Ratings',
        desc: 'Separate ELO for Bullet, Blitz, Rapid, Classical with Glicko-2 support',
        icon: BarChart2,
        demo: 'Rating cards'
      },
      {
        name: 'Global & UKH Leaderboards',
        desc: 'Top 100 per time control, medals 🥇🥈🥉, win rate, country filter',
        icon: Globe,
        demo: 'Leaderboard view'
      },
      {
        name: '30-Day Rating Graph',
        desc: 'Interactive ELO progression chart with hover details',
        icon: BarChart2,
        demo: 'Rating chart'
      },
      {
        name: 'Post-Game Analysis',
        desc: 'Move-by-move replay, FEN copy, Stockfish eval placeholder, PGN download',
        icon: Brain,
        demo: 'Replay mode'
      },
      {
        name: 'Accuracy & Classification',
        desc: 'Best moves, blunders, mistakes, inaccuracies with centipawn loss',
        icon: Target,
        demo: 'Accuracy meter'
      },
    ]
  },
  {
    id: 'customization',
    title: 'Customization & Themes',
    icon: Palette,
    color: '#EC4899',
    features: [
      {
        name: '10 Board Themes',
        desc: 'UKH Chancellor, Peshmerga Tactical, Wall Maria, Emerald, Wood, Ocean, Midnight, Marble, Classic, Custom',
        icon: Layers,
        demo: 'Theme switcher'
      },
      {
        name: '9 Piece Sets',
        desc: 'Peshmerga Royal, UKH Chancellor, Attack on Titan, Crystal Neon, FIDE 3D, Classic, Vintage, Neo Azure, Custom Upload',
        icon: Crown,
        demo: 'Piece picker'
      },
      {
        name: 'Instant CSS-Variable Theme Switching',
        desc: 'Zero-reload theme changes via CSS custom properties',
        icon: Sparkles,
        demo: 'Live switch'
      },
      {
        name: 'Custom Theme Builder',
        desc: 'Create personalized color palettes with live preview',
        icon: Palette,
        demo: 'Theme editor'
      },
      {
        name: 'Custom Piece Upload',
        desc: 'Upload SVG/PNG piece sets with automatic processing',
        icon: Upload,
        demo: 'Upload demo'
      },
    ]
  },
  {
    id: 'accessibility',
    title: 'Accessibility & Polish',
    icon: Shield,
    color: '#84CC16',
    features: [
      {
        name: 'WCAG 2.1 AA Compliant',
        desc: '4.5:1 contrast, focus rings, keyboard nav, screen reader support',
        icon: Shield,
        demo: 'A11y audit'
      },
      {
        name: 'Reduced Motion Support',
        desc: 'Respects prefers-reduced-motion, disables non-essential animations',
        icon: Eye,
        demo: 'Motion toggle'
      },
      {
        name: 'High Contrast Mode',
        desc: 'Pure B&W + gold palette override for visibility',
        icon: Shield,
        demo: 'Contrast toggle'
      },
      {
        name: 'Presentation Mode',
        desc: '?presentation=true - 30% larger board, auto-demo opponent, simplified nav',
        icon: Play,
        demo: 'Try ?presentation=true'
      },
      {
        name: 'PWA Ready',
        desc: 'Service worker, offline play, installable, push notifications',
        icon: Download,
        demo: 'Install prompt'
      },
    ]
  },
];

interface FeatureCardProps {
  feature: typeof FEATURE_CATEGORIES[0]['features'][0];
  index: number;
  color: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ feature, index, color }) => (
  <motion.div
    key={feature.name}
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-50px' }}
    transition={{ duration: 0.5, delay: index * 0.08 }}
    className="glass-panel p-6 rounded-2xl hover:glass-panel-hover transition-all group relative overflow-hidden"
    style={{ border: `1px solid ${color}30` }}
  >
    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-transparent to-transparent group-hover:from-[${color}]20 group-hover:to-transparent transition-all duration-500" />
    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 relative z-10 group-hover:scale-110 transition-transform" style={{ backgroundColor: `${color}20` }}>
      <feature.icon className="w-6 h-6" style={{ color }} />
    </div>
    <h3 className="font-black text-[var(--text-main)] mb-2">{feature.name}</h3>
    <p className="text-[var(--text-dim)] text-sm mb-4">{feature.desc}</p>
    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider" style={{ color }}>
      <feature.icon className="w-4 h-4" />
      <span>DEMO: {feature.demo}</span>
    </div>
  </motion.div>
);

interface CategorySectionProps {
  category: typeof FEATURE_CATEGORIES[0];
  index: number;
}

const CategorySection: React.FC<CategorySectionProps> = ({ category, index }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '-30%']);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.8, delay: index * 0.1 }}
      className="py-20"
      style={{ y, opacity }}
    >
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${category.color}20` }}>
              <category.icon className="w-7 h-7" style={{ color: category.color }} />
            </div>
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tight text-[var(--text-main)]">{category.title}</h2>
              <div className="w-24 h-1 rounded-full mt-2" style={{ backgroundColor: category.color }} />
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {category.features.map((feature, i) => (
            <FeatureCard feature={feature} index={i} color={category.color} />
          ))}
        </div>
      </div>
    </motion.section>
  );
};

export const FeaturesShowcase: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[var(--app-bg)]">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative min-h-[90vh] flex items-center justify-center px-6 overflow-hidden"
      >
        <div className="absolute inset-0 pointer-events-none opacity-15">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#E41E20]/20 blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 w-96 h-96 rounded-full bg-[#FFFFFF]/10 blur-[120px]" />
          <div className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full bg-[#278E43]/20 blur-[130px]" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <UkhLogo variant="full" size="xl" showText={true} className="mb-8 mx-auto" />

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-black uppercase tracking-tight mb-6 bg-gradient-to-r from-white via-yellow-300 to-emerald-300 bg-clip-text text-transparent"
          >
            CHESSKYS FEATURES
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-lg sm:text-xl text-[var(--text-muted)] max-w-3xl mx-auto mb-12 leading-relaxed"
          >
            A production-grade competitive chess platform with enterprise-grade architecture,
            Kurdish cultural heritage, and features that redefine digital chess.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <span className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-[var(--primary-accent)]/20 text-[var(--primary-accent)] border border-[var(--primary-accent)]/30">
              7 CATEGORIES
            </span>
            <span className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-[var(--secondary-accent)]/20 text-[var(--secondary-accent)] border border-[var(--secondary-accent)]/30">
              40+ FEATURES
            </span>
            <span className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-[var(--tertiary-accent)]/20 text-[var(--tertiary-accent)] border border-[var(--tertiary-accent)]/30">
              PRODUCTION READY
            </span>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <ChevronDown className="w-8 h-8 text-[var(--text-muted)]" />
        </motion.div>
      </motion.section>

      {/* Categories */}
      <div className="pt-10 pb-20">
        {FEATURE_CATEGORIES.map((category, index) => (
          <CategorySection key={category.id} category={category} index={index} />
        ))}

        {/* CTA */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="py-20 px-4"
        >
          <div className="max-w-3xl mx-auto text-center glass-panel p-12 rounded-3xl border border-[var(--primary-accent)]/30">
            <h2 className="text-3xl font-black text-[var(--text-main)] mb-4">Ready to Experience It?</h2>
            <p className="text-[var(--text-muted)] mb-8 max-w-xl mx-auto">
              All features are live in the demo. Start a match, explore tournaments,
              check leaderboards, customize themes — everything works.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a href="/" className="btn-primary px-10 py-4 text-lg">
                <Play className="w-6 h-6 mr-2" />
                PLAY DEMO
              </a>
              <a href="/?presentation=true" className="btn-secondary px-10 py-4 text-lg">
                <Play className="w-6 h-6 mr-2" />
                PRESENTATION MODE
              </a>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
};

export default FeaturesShowcase;