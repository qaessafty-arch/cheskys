import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { BarChart2, Users, ChevronRight, ArrowLeft, Edit2, Camera, Upload, Image as ImageIcon, CheckCircle2, Star, Flame, Award, Zap, Shield, Trophy, Crown, Star as StarIcon, HeartHandshake, Settings, X, Check, Copy, RotateCcw, Lock, Unlock, Key } from 'lucide-react';
import { useDemo } from '../context/DemoContext';
import { DEMO_PLAYERS } from '../data/demoData';
import { Player } from '../types/chess';
import { UkhLogo } from './UkhLogo';

export const ProfileView: React.FC = () => {
  const { viewMode, setViewMode, currentUser, settings, updateSettings } = useDemo();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser.name);
  const [selectedAvatar, setSelectedAvatar] = useState(currentUser.avatar);
  const [selectedCountry, setSelectedCountry] = useState(currentUser.country);
  const [copiedLink, setCopiedLink] = useState(false);

  const avatars = [
    { id: 'peshmerga', label: '☀️ Peshmerga' },
    { id: 'ukh', label: '🎓 UKH Chancellor' },
    { id: 'aot', label: '⚔️ Attack on Titan' },
    { id: 'crystal_neon', label: '💎 Crystal Neon' },
    { id: 'fide_3d', label: '👑 FIDE 3D' },
    { id: 'classic', label: '♟️ Classic' },
    { id: 'vintage', label: '🪵 Vintage' },
    { id: 'neo', label: '⚡ Neo Azure' },
  ];

  const countries = [
    { code: 'IQ', name: 'Iraq', flag: '🇮🇶' },
    { code: 'US', name: 'United States', flag: '🇺🇸' },
    { code: 'DE', name: 'Germany', flag: '🇩🇪' },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
    { code: 'FR', name: 'France', flag: '🇫🇷' },
    { code: 'ES', name: 'Spain', flag: '🇪🇸' },
    { code: 'NO', name: 'Norway', flag: '🇳🇴' },
    { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
    { code: 'CA', name: 'Canada', flag: '🇨🇦' },
    { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  ];

  const achievements = [
    { id: 'first_win', icon: '🏆', title: 'First Victory', desc: 'Win your first game', unlocked: true },
    { id: 'streak_5', icon: '🔥', title: 'Hot Streak', desc: 'Win 5 games in a row', unlocked: true },
    { id: 'games_100', icon: '♟️', title: 'Centurion', desc: 'Play 100 games', unlocked: false },
    { id: 'blitz_master', icon: '⚡', title: 'Blitz Specialist', desc: 'Reach 1800 in Blitz', unlocked: false },
    { id: 'rapid_champ', icon: '🏃', title: 'Rapid Champion', desc: 'Win a Rapid tournament', unlocked: false },
    { id: 'respect_1000', icon: '✊', title: 'Respected', desc: 'Earn 1000 Respect points', unlocked: true },
    { id: 'peshmerga_fan', icon: '☀️', title: 'Peshmerga Fan', desc: 'Use Peshmerga theme for 50 games', unlocked: true },
    { id: 'night_owl', icon: '🦉', title: 'Night Owl', desc: 'Play 10 games after midnight', unlocked: false },
  ];

  const stats = [
    { label: 'Rating', value: currentUser.elo, icon: '⚔️', color: 'var(--primary-accent)' },
    { label: 'Games', value: 126, icon: '♟️' },
    { label: 'Wins', value: 74, icon: '✅', color: 'var(--secondary-accent)' },
    { label: 'Draws', value: 18, icon: '➖', color: 'var(--tertiary-accent)' },
    { label: 'Losses', value: 34, icon: '❌', color: 'var(--danger)' },
    { label: 'Win Rate', value: '58.7%', icon: '📊', color: 'var(--secondary-accent)' },
    { label: 'Best Streak', value: '🔥 7', icon: '🔥', color: 'var(--danger)' },
    { label: 'Current Streak', value: '🔥 5', icon: '🔥', color: 'var(--danger)' },
  ];

  const ratingHistory = [
    { date: '2026-01', elo: 1100 },
    { date: '2026-02', elo: 1180 },
    { date: '2026-03', elo: 1240 },
    { date: '2026-04', elo: 1290 },
    { date: '2026-05', elo: 1320 },
    { date: '2026-06', elo: 1350 },
    { date: '2026-07', elo: 1380 },
    { date: '2026-08', elo: 1410 },
    { date: '2026-09', elo: 1428 },
    { date: '2026-10', elo: 1428 },
  ];

  const handleSaveProfile = () => {
    setIsEditing(false);
    // In real app, would save to backend
  };

  const copyProfileLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/profile/${currentUser.uid}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen pt-20 bg-[var(--app-bg)]">
      <header className="fixed top-0 left-0 right-0 z-40 glass-panel border-b border-[var(--glass-border)] px-4 py-3" style={{ backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setViewMode('dashboard')} className="w-10 h-10 rounded-xl glass-panel-hover flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)]"><ChevronRight className="w-5 h-5 rotate-180" /></button>
            <UkhLogo variant="horizontal" size="lg" showText={true} className="ml-2" />
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button onClick={() => setIsEditing(false)} className="btn-secondary text-sm">Cancel</button>
                <button onClick={handleSaveProfile} className="btn-primary text-sm">Save</button>
              </>
            ) : (
              <button onClick={() => setIsEditing(true)} className="btn-secondary text-sm"><Edit2 className="w-4 h-4 mr-1" /> Edit</button>
            )}
          </div>
        </div>
      </header>

      <div className="pt-20 pb-8 px-4 max-w-4xl mx-auto">
        {/* Profile Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-6 rounded-2xl mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary-accent)]/5 rounded-full blur-3xl" />
          <div className="relative flex flex-col md:flex-row md:items-center gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 rounded-2xl flex items-center justify-center text-6xl shadow-[0_0_40px_rgba(245,184,61,0.2)]" style={{ backgroundColor: 'var(--primary-accent)/10', border: '3px solid var(--primary-accent)' }}>
                {avatars.find(a => a.id === selectedAvatar)?.label.split(' ')[0] || '🎓'}
              </div>
              {isEditing && (
                <button className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-[var(--primary-accent)] text-[var(--app-bg)] flex items-center justify-center shadow-lg hover:bg-yellow-400 transition-colors" onClick={() => {}}>
                  <Camera className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              {isEditing ? (
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="text-3xl font-black text-[var(--text-main)] text-center md:text-left bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-[var(--primary-accent)] rounded px-2"
                  maxLength={20}
                />
              ) : (
                <h2 className="text-3xl font-black text-[var(--text-main)]">{displayName}</h2>
              )}
              <div className="flex items-center justify-center md:justify-start gap-4 mt-2">
                <span className="text-2xl">{currentUser.flag}</span>
                <span className="text-[var(--text-dim)]">{countries.find(c => c.code === selectedCountry)?.name || selectedCountry}</span>
                {isEditing && (
                  <select
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    className="px-3 py-1 bg-[var(--panel-bg)] border border-[var(--glass-border)] rounded-lg text-[var(--text-main)] text-sm"
                  >
                    {countries.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex items-center justify-center md:justify-start gap-4 mt-3">
                <div className="flex items-center gap-1 text-[var(--secondary-accent)]">
                  <Star className="w-4 h-4" />
                  <span className="font-bold">Respect: 1,247</span>
                </div>
                <div className="flex items-center gap-1 text-[var(--primary-accent)]">
                  <Zap className="w-4 h-4" />
                  <span className="font-bold">Honor: Grandmaster</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 md:ml-auto">
              <button onClick={copyProfileLink} className="btn-secondary text-sm flex items-center gap-2">
                <Copy className="w-4 h-4" />
                {copiedLink ? 'Copied!' : 'Copy Link'}
              </button>
              <button className="btn-secondary text-sm flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              className="glass-panel p-4 rounded-xl text-center hover:glass-panel-hover transition-all"
            >
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-black text-[var(--text-main)] font-mono" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)] mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Rating Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-panel p-6 rounded-2xl mb-6">
          <h3 className="text-lg font-black text-[var(--text-main)] mb-4 flex items-center gap-2"><BarChart2 className="w-5 h-5" /> Rating History (30 Days)</h3>
          <div className="h-48 relative">
            <svg viewBox="0 0 400 200" className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="ratingGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary-accent)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="var(--primary-accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={ratingHistory.map((point, i) => {
                  const x = (i / (ratingHistory.length - 1)) * 400;
                  const y = 200 - ((point.elo - 1000) / 500) * 180;
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ')}
                stroke="var(--primary-accent)"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={ratingHistory.map((point, i) => {
                  const x = (i / (ratingHistory.length - 1)) * 400;
                  const y = 200 - ((point.elo - 1000) / 500) * 180;
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ') + ' L 400 200 L 0 200 Z'}
                fill="url(#ratingGradient)"
              />
              {ratingHistory.map((point, i) => (
                <circle
                  key={i}
                  cx={(i / (ratingHistory.length - 1)) * 400}
                  cy={200 - ((point.elo - 1000) / 500) * 180}
                  r={4}
                  fill="var(--primary-accent)"
                  stroke="var(--app-bg)"
                  strokeWidth="2"
                />
              ))}
            </svg>
            <div className="flex justify-between text-[11px] text-[var(--text-dim)] mt-2 px-2">
              <span>Jan</span>
              <span>Apr</span>
              <span>Jul</span>
              <span>Oct</span>
            </div>
          </div>
        </motion.div>

        {/* Achievements */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-panel p-6 rounded-2xl mb-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-[var(--text-main)] flex items-center gap-2"><Award className="w-5 h-5" /> Achievements</h3>
            <span className="text-[var(--text-dim)]">{achievements.filter(a => a.unlocked).length} / {achievements.length} unlocked</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {achievements.map((achievement, i) => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                className={`glass-panel p-4 rounded-xl text-center transition-all ${achievement.unlocked ? 'border border-[var(--primary-accent)]/30' : 'opacity-50'}`}
              >
                <div className="text-4xl mb-2">{achievement.icon}</div>
                <h4 className="font-bold text-[var(--text-main)] mb-1">{achievement.title}</h4>
                <p className="text-[var(--text-dim)] text-sm">{achievement.desc}</p>
                {achievement.unlocked && (
                  <div className="flex items-center justify-center gap-1 mt-2 text-[var(--secondary-accent)]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-[11px] font-bold">UNLOCKED</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Recent Opponents */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-panel p-6 rounded-2xl">
          <h3 className="text-lg font-black text-[var(--text-main)] mb-4 flex items-center gap-2"><Users className="w-5 h-5" /> Recent Opponents</h3>
          <div className="space-y-3">
            {DEMO_PLAYERS.filter(p => p.uid !== 'demo-1').slice(0, 5).map((opponent, i) => (
              <motion.div
                key={opponent.uid}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
                className="flex items-center gap-4 p-3 glass-panel-hover rounded-xl transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--primary-accent)]/20 flex items-center justify-center text-xl">{opponent.flag}</div>
                <div className="flex-1">
                  <div className="font-bold text-[var(--text-main)]">{opponent.name}</div>
                  <div className="text-[var(--primary-accent)] font-mono text-sm">⚔️ {opponent.elo}</div>
                </div>
                <div className="flex items-center gap-2 text-[var(--text-dim)] text-sm">
                  <span>W</span>
                  <span>D</span>
                  <span>L</span>
                </div>
                <button className="btn-secondary text-sm px-3 py-1">Challenge</button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};