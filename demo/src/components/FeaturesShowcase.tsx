import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import {
  Zap, ShieldCheck, Trophy, Sparkles, Cpu, Globe, Flame, Star,
  Users, Award, Brain, Target, Crown, Shield, MessageSquare,
  Volume2, Settings, Palette, Layers, Clock, Search, Flag,
  HeartHandshake, BarChart2, Download, Upload, Eye, ChevronRight,
  ChevronLeft, Play, Pause, RotateCcw, Flag as FlagIcon, Bell, ChevronDown,
} from 'lucide-react';
import { UkhLogo } from './UkhLogo';
import { useDemo } from '../context/DemoContext';
import { ArrowLeft } from 'lucide-react';

// Every feature says whether this demo shows it (live: true, with what to try) or whether
// it belongs to the full platform (live: false). Nothing is claimed as working that is not.
const FEATURE_CATEGORIES = [
  {
    id: 'play',
    title: 'Playing',
    icon: Zap,
    color: 'var(--primary-accent)',
    features: [
      {
        name: 'Quick Match vs a bot',
        desc: 'Pick a time control and start a game in one click. Three bot strengths, from Beginner to Expert.',
        icon: Zap,
        live: true,
        demo: 'Dashboard → Quick Match',
      },
      {
        name: 'Private rooms with a 6-character code',
        desc: 'Create a room, send the code to a friend, and join a room with a code.',
        icon: Users,
        live: true,
        demo: 'Dashboard → Create Room, then Join by Code',
      },
      {
        name: 'Real chess rules',
        desc: 'Legal moves only, check and checkmate, stalemate, pawn promotion and draws are all enforced by the rules engine.',
        icon: ShieldCheck,
        live: true,
        demo: 'Try an illegal move on the board',
      },
      {
        name: 'Chess clocks with increment',
        desc: 'Bullet, blitz, rapid and classical controls, with the increment added after each move.',
        icon: Clock,
        live: true,
        demo: 'Start a Blitz 3+2 game',
      },
    ],
  },
  {
    id: 'review',
    title: 'After the game',
    icon: BarChart2,
    color: 'var(--secondary-accent)',
    features: [
      {
        name: 'Rating change after every rated game',
        desc: 'The result screen shows the rating change for both players.',
        icon: Trophy,
        live: true,
        demo: 'Finish a game, then read the result',
      },
      {
        name: 'Replay any game',
        desc: 'Step through the moves, or jump to the start or the end, from the move list.',
        icon: Layers,
        live: true,
        demo: 'Dashboard → Review on a recent game',
      },
      {
        name: 'Live rated multiplayer',
        desc: 'Play real opponents across the country in real time, with ratings that update on the server.',
        icon: Globe,
        live: false,
      },
      {
        name: 'Post-game engine analysis',
        desc: 'Accuracy scores and the best move for each position, calculated by an engine.',
        icon: Brain,
        live: false,
      },
    ],
  },
  {
    id: 'community',
    title: 'Community and tournaments',
    icon: Trophy,
    color: 'var(--primary-accent)',
    features: [
      {
        name: 'UKH Cup tournament listing',
        desc: 'Upcoming events, registration and the current bracket for the UKH Cup.',
        icon: Trophy,
        live: true,
        demo: 'Dashboard → Tournaments',
      },
      {
        name: 'Leaderboard',
        desc: 'Players ranked by rating, with the top players at the top.',
        icon: Crown,
        live: true,
        demo: 'Open Leaderboard from the menu',
      },
      {
        name: 'Friends and accounts',
        desc: 'Sign in, add friends and see their games.',
        icon: HeartHandshake,
        live: false,
      },
      {
        name: 'Swiss and arena tournaments',
        desc: 'Automatic pairing for tournaments with hundreds of players.',
        icon: Target,
        live: false,
      },
    ],
  },
  {
    id: 'look',
    title: 'Look and feel',
    icon: Palette,
    color: 'var(--secondary-accent)',
    features: [
      {
        name: 'Board and piece themes',
        desc: 'Six board themes and four piece sets, including the UKH set. Changes apply at once.',
        icon: Palette,
        live: true,
        demo: 'Settings → Board',
      },
      {
        name: 'Presentation mode',
        desc: 'Hides the extra panels and enlarges the board, for projectors and talks.',
        icon: Eye,
        live: true,
        demo: 'Header → presentation icon',
      },
      {
        name: 'Sound effects',
        desc: 'Short tones for moves, captures, check and the end of the game.',
        icon: Volume2,
        live: true,
        demo: 'Settings → Sounds',
      },
      {
        name: 'Custom themes and piece uploads',
        desc: 'Build your own board colours and upload your own piece set.',
        icon: Palette,
        live: false,
      },
    ],
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
    <div className="absolute top-0 right-0 w-24 h-24 opacity-40 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: `radial-gradient(circle at top right, ${color}33, transparent 70%)` }} />
    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 relative z-10 group-hover:scale-110 transition-transform" style={{ backgroundColor: `${color}20` }}>
      <feature.icon className="w-6 h-6" style={{ color }} />
    </div>
    <h3 className="font-black text-[var(--text-main)] mb-2">{feature.name}</h3>
    <p className="text-[var(--text-dim)] text-sm mb-4">{feature.desc}</p>
    {feature.live ? (
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider" style={{ color }}>
        <feature.icon className="w-4 h-4" />
        <span>Try it: {feature.demo}</span>
      </div>
    ) : (
      <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md border border-[var(--glass-border)] text-[var(--text-dim)]">
        Full platform
      </span>
    )}
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
  const { setViewMode } = useDemo();

  return (
    <div className="min-h-screen bg-[var(--app-bg)]">
      {/* Back to the dashboard, so the presenter can always get out of this page */}
      <button
        onClick={() => setViewMode('dashboard')}
        className="fixed top-20 left-4 z-50 flex items-center gap-2 px-4 py-2 rounded-xl glass-panel text-sm font-bold text-[var(--text-main)] hover:text-[var(--primary-accent)]"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
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
            A chess platform built with Kurdish heritage at its core. This page shows what the demo
            does today, and which parts belong to the full platform.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <span className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-[var(--primary-accent)]/20 text-[var(--primary-accent)] border border-[var(--primary-accent)]/30">
              4 AREAS
            </span>
            <span className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-[var(--secondary-accent)]/20 text-[var(--secondary-accent)] border border-[var(--secondary-accent)]/30">
              {FEATURE_CATEGORIES.reduce((n, c) => n + c.features.filter(f => f.live).length, 0)} IN THE DEMO
            </span>
            <span className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-[var(--tertiary-accent)]/20 text-[var(--tertiary-accent)] border border-[var(--tertiary-accent)]/30">
              {FEATURE_CATEGORIES.reduce((n, c) => n + c.features.filter(f => !f.live).length, 0)} FULL PLATFORM ONLY
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
              Everything marked “Try it” works in this demo. Start a match, open a room,
              review a game, or change the board. The rest belongs to the full platform.
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