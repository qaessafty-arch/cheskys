import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Crown, ChevronRight, Flame, RefreshCw, Search, Filter, Globe, Users, Award, Star, Zap, Shield, HeartHandshake } from 'lucide-react';
import { useDemo } from '../context/DemoContext';
import { DEMO_PLAYERS, DEMO_TIME_CONTROLS } from '../data/demoData';
import { Player } from '../types/chess';
import { UkhLogo } from './UkhLogo';

interface LeaderboardEntry extends Player {
  rank: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  streak: number;
  streakType: 'win' | 'loss';
  isImmortal?: boolean;
}

export const LeaderboardView: React.FC = () => {
  const { viewMode, setViewMode, settings } = useDemo();
  const [leaderboardType, setLeaderboardType] = useState<'elo' | 'respect'>('elo');
  const [timeControl, setTimeControl] = useState<string>('all');
  const [scope, setScope] = useState<'global' | 'friends' | 'ukh'>('global');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Stable pseudo-random numbers per player, so the table doesn't reshuffle on every render
  const seededNumber = (seed: string, range: number) => {
    let hash = 0;
    for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return hash % range;
  };

  const generateLeaderboard = (): LeaderboardEntry[] => {
    const basePlayers = [...DEMO_PLAYERS];
    // Add some mock players
    const extraPlayers: Player[] = [
      { uid: 'extra-1', name: 'ChessMaster99', elo: 1842, country: 'US', flag: '🇺🇸', avatar: 'fide_3d', online: true },
      { uid: 'extra-2', name: 'QueenAttack', elo: 1751, country: 'GB', flag: '🇬🇧', avatar: 'crystal_neon', online: true },
      { uid: 'extra-3', name: 'KnightKing', elo: 1797, country: 'DE', flag: '🇩🇪', avatar: 'neo', online: true },
      { uid: 'extra-4', name: 'RookRuler', elo: 1720, country: 'FR', flag: '🇫🇷', avatar: 'vintage', online: false },
      { uid: 'extra-5', name: 'BishopBlitz', elo: 1689, country: 'CA', flag: '🇨🇦', avatar: 'classic', online: true },
      { uid: 'extra-6', name: 'PawnPusher', elo: 1645, country: 'AU', flag: '🇦🇺', avatar: 'peshmerga', online: true },
    ];
    return [...basePlayers, ...extraPlayers].map((p, i) => ({
      ...p,
      rank: i + 1,
      wins: 50 + seededNumber(p.uid + 'w', 100),
      losses: 20 + seededNumber(p.uid + 'l', 50),
      draws: 5 + seededNumber(p.uid + 'd', 20),
      winRate: 0,
      streak: seededNumber(p.uid + 's', 10),
      streakType: seededNumber(p.uid + 't', 2) === 0 ? 'win' as const : 'loss' as const,
    })).map(p => ({
      ...p,
      winRate: Math.round((p.wins / (p.wins + p.losses + p.draws)) * 100),
    })).sort((a, b) => b.elo - a.elo).map((p, i) => ({ ...p, rank: i + 1 }));
  };

  const leaderboard = useMemo(() => {
    let list = generateLeaderboard();
    if (searchQuery) {
      list = list.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (scope === 'friends') {
      list = list.filter(p => p.uid !== 'demo-1' && Math.random() > 0.5);
    }
    if (scope === 'ukh') {
      list = list.filter(p => p.country === 'IQ' || p.flag === '☀️');
    }
    return list.slice(0, 50);
  }, [searchQuery, scope]);

  const refreshLeaderboard = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <div className="min-h-screen pt-20 bg-[var(--app-bg)]">
      <header className="fixed top-0 left-0 right-0 z-40 glass-panel border-b border-[var(--glass-border)] px-4 py-3" style={{ backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setViewMode('dashboard')} className="w-10 h-10 rounded-xl glass-panel-hover flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)]"><ChevronRight className="w-5 h-5 rotate-180" /></button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--primary-accent)]/20 flex items-center justify-center"><Trophy className="w-5 h-5 text-[var(--primary-accent)]" /></div>
              <h1 className="font-black text-lg text-[var(--text-main)]">Leaderboard</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refreshLeaderboard} disabled={isLoading} className="btn-secondary text-sm"><RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh</button>
          </div>
        </div>
      </header>

      <div className="pt-20 pb-8 px-4 max-w-7xl mx-auto">
        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-4 rounded-xl mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Type Tabs */}
            <div className="flex bg-[var(--glass-bg)] rounded-xl p-1">
              {[
                { id: 'elo', label: 'ELO Rating', icon: Trophy },
                { id: 'respect', label: 'Respect Points', icon: HeartHandshake },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setLeaderboardType(tab.id as 'elo' | 'respect')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                    leaderboardType === tab.id
                      ? 'bg-[var(--primary-accent)] text-[var(--app-bg)] shadow-[0_0_20px_rgba(245,184,61,0.3)]'
                      : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'
                  }`}>
                  <tab.icon className="w-4 h-4" /> {tab.label}
                </button>
              ))}
            </div>

            {/* Scope Tabs */}
            <div className="flex bg-[var(--glass-bg)] rounded-xl p-1 ml-auto">
              {[
                { id: 'global', label: 'Global', icon: Globe },
                { id: 'ukh', label: 'UKH', icon: Award },
                { id: 'friends', label: 'Friends', icon: Users },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setScope(tab.id as 'ukh' | 'global' | 'friends')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                    scope === tab.id
                      ? 'bg-[var(--secondary-accent)]/20 text-[var(--secondary-accent)] border border-[var(--secondary-accent)]/30'
                      : 'text-[var(--text-dim)] hover:text-[var(--text-main)]'
                  }`}>
                  <tab.icon className="w-4 h-4" /> {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Control Filter */}
          <div className="flex items-center gap-4 mb-4 glass-panel p-4 rounded-xl">
            <label className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)]">Time Control:</label>
            <select
              value={timeControl}
              onChange={(e) => setTimeControl(e.target.value)}
              className="px-4 py-2 bg-[var(--panel-bg)] border border-[var(--glass-border)] rounded-xl text-[var(--text-main)] text-sm flex-1 max-w-xs"
            >
              <option value="all">All Time Controls</option>
              {DEMO_TIME_CONTROLS.map(tc => (
                <option key={tc.id} value={tc.id}>{tc.name}</option>
              ))}
            </select>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-dim)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search players..."
                className="w-full pl-10 pr-4 py-2 bg-[var(--panel-bg)] border border-[var(--glass-border)] rounded-xl text-[var(--text-main)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--primary-accent)]"
              />
            </div>
          </div>

          {/* Leaderboard Table */}
          <div className="glass-panel rounded-xl overflow-hidden">
            <div className="grid grid-cols-[50px_1fr_80px_80px_80px_80px_80px_100px] gap-4 p-4 border-b border-[var(--glass-border)] text-[10px] font-black uppercase tracking-wider text-[var(--text-dim)]">
              <div>Rank</div>
              <div>Player</div>
              <div className="text-right">Rating</div>
              <div className="text-right">W</div>
              <div className="text-right">L</div>
              <div className="text-right">D</div>
              <div className="text-right">Win%</div>
              <div>Streak</div>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {leaderboard.map((player, index) => (
                  <motion.div
                    key={player.uid}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.02 }}
                    className={`grid grid-cols-[50px_1fr_80px_80px_80px_80px_80px_100px] gap-4 p-3 items-center border-b border-[var(--glass-border)]/50 hover:bg-[var(--glass-bg-hover)] transition-colors ${player.rank <= 3 ? 'bg-[var(--primary-accent)]/5' : ''} ${player.uid === 'demo-1' ? 'bg-[var(--secondary-accent)]/5 ring-1 ring-[var(--secondary-accent)]/30' : ''}`}
                  >
                    <div className="flex items-center justify-center">
                      {player.rank === 1 && <Crown className="w-6 h-6 text-yellow-400" />}
                      {player.rank === 2 && <Trophy className="w-6 h-6 text-gray-300" />}
                      {player.rank === 3 && <Award className="w-6 h-6 text-amber-700" />}
                      {(player.rank > 3 || !player.rank) && <span className="font-mono font-black text-[var(--text-dim)]">#{player.rank}</span>}
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[var(--primary-accent)]/20 flex items-center justify-center flex-shrink-0 text-xl">{player.flag}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-bold text-[var(--text-main)] truncate">{player.name}</span>
                          {player.online && <span className="w-2 h-2 rounded-full bg-[var(--secondary-accent)] animate-pulse" />}
                        </div>
                        <div className="text-[11px] text-[var(--text-dim)]">{player.country}</div>
                      </div>
                    </div>
                    <div className="text-right font-mono font-bold text-[var(--primary-accent)]">⚔️ {typeof player.elo === 'number' ? player.elo : player.elo}</div>
                    <div className="text-right font-mono text-[var(--secondary-accent)]">{player.wins}</div>
                    <div className="text-right font-mono text-[var(--danger)]">{player.losses}</div>
                    <div className="text-right font-mono text-[var(--tertiary-accent)]">{player.draws}</div>
                    <div className="text-right font-mono font-bold text-[var(--text-main)]">{player.winRate}%</div>
                    <div className="flex items-center gap-1">
                      {player.streak > 0 && (
                        <span className={`text-[10px] font-black ${player.streakType === 'win' ? 'text-[var(--secondary-accent)]' : 'text-[var(--danger)]'}`}>
                          {player.streakType === 'win' ? '🔥' : '❄️'} {player.streak}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Empty State */}
          {leaderboard.length === 0 && (
            <div className="glass-panel p-12 rounded-xl text-center">
              <Trophy className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-[var(--text-dim)]">No players found matching your criteria</p>
            </div>
          )}
        </motion.div>

        {/* Legend */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6 glass-panel p-4 rounded-xl">
          <h3 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-3">Legend</h3>
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <LegendItem color="var(--primary-accent)" label="#1" icon={Crown} />
            <LegendItem color="var(--secondary-accent)" label="Win Streak" icon={Flame} />
            <LegendItem color="var(--danger)" label="Loss Streak" icon={Zap} />
            <LegendItem color="var(--secondary-accent)" label="Online" icon={<span className="w-2 h-2 rounded-full bg-[var(--secondary-accent)] animate-pulse" />} />
            <LegendItem color="var(--text-dim)" label="You" icon={Star} />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const LegendItem: React.FC<{ color: string; label: string; icon: React.ReactNode | React.ComponentType }> = ({ color, label, icon }) => (
  <div className="flex items-center gap-2" style={{ color }}>
    {React.isValidElement(icon) || icon == null || typeof icon === 'string' ? icon : React.createElement(icon as React.ElementType, { className: 'w-4 h-4' })}
    <span>{label}</span>
  </div>
);

