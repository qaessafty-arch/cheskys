import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Play, Plus, Search, Trophy, Star, Settings } from 'lucide-react';
import { TimeControl } from '../types/chess';
import { DEMO_TIME_CONTROLS } from '../data/demoData';
import { useDemo } from '../context/DemoContext';
import { MatchmakingModal } from './MatchmakingModal';
import { CreateRoomModal } from './CreateRoomModal';
import { JoinRoomModal } from './JoinRoomModal';
import { UkhLogo } from './UkhLogo';

export const Dashboard: React.FC = () => {
  const {
    currentUser,
    viewMode,
    setViewMode,
    createdRoomCode,
    matchmakingState,
    startQuickMatch,
    createRoom,
    joinRoom,
    settings,
    setViewMode: _setViewMode,
  } = useDemo();

  const [recentGames] = useState([
    { result: 'W', opponent: 'KnightMaster', elo: 1441, timeControl: '3+2', date: '2h ago' },
    { result: 'L', opponent: 'SaraChess', elo: 1567, timeControl: '10+0', date: '5h ago' },
    { result: 'D', opponent: 'Dilan', elo: 1290, timeControl: '5+3', date: '1d ago' },
    { result: 'W', opponent: 'Chen Wei', elo: 1410, timeControl: '3+0', date: '2d ago' },
    { result: 'W', opponent: 'Ali Hassan', elo: 1380, timeControl: '15+10', date: '3d ago' },
  ]);

  const [selectedQuickTime, setSelectedQuickTime] = useState<TimeControl>(DEMO_TIME_CONTROLS[2]);
  const [selectedTimeControl, setSelectedTimeControl] = useState<TimeControl>(DEMO_TIME_CONTROLS[2]);
  const [selectedSide, setSelectedSide] = useState<'white' | 'black' | 'random'>('random');
  const [rated, setRated] = useState(true);
  const [roomCode, setRoomCode] = useState(() => generateGameRoomCode());
  const [copiedCode, setCopiedCode] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  const handleCreateRoom = (timeControl: TimeControl, side: 'white' | 'black' | 'random', rated: boolean) => {
    createRoom(timeControl);
    setShowCreateModal(false);
  };

  const handleJoinRoom = (code: string, timeControl: TimeControl) => {
    joinRoom(code, timeControl);
    setShowJoinModal(false);
  };

  const handleReviewGame = (game: typeof recentGames[0]) => {
    // Navigate to replay view with the game data
    // For demo, we'll just log it
    console.log('Review game:', game);
    alert(`Reviewing game vs ${game.opponent} (${game.result})`);
  };

  return (
    <div className="min-h-screen pt-20 pb-8 px-4">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <UkhLogo variant="horizontal" size="lg" showText={true} />
          <div>
            <h1 className="text-3xl font-black text-[var(--text-main)]">Welcome back, {currentUser.name}</h1>
            <p className="text-[var(--text-muted)] mt-1">Rating: <span className="text-[var(--primary-accent)] font-mono font-black">⚔️ {currentUser.elo}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setViewMode('features')} className="btn-secondary">
            <Star className="w-4 h-4 mr-1" />
            Features
          </button>
          <button onClick={() => setShowSettings(true)} className="btn-secondary">Settings</button>
        </div>
      </header>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto mb-8 grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <StatCard label="Rating" value={currentUser.elo.toString()} icon="⚔️" color="var(--primary-accent)" />
        <StatCard label="Games" value="126" icon="♟️" />
        <StatCard label="Win Rate" value="58.7%" icon="📊" color="var(--secondary-accent)" />
        <StatCard label="Streak" value="🔥 5" icon="🔥" color="var(--danger)" />
      </motion.div>

      {/* Main Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="max-w-7xl mx-auto mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <ActionCard
          icon={<Play className="w-8 h-8" />}
          title="Quick Match"
          desc="Instant matchmaking with demo bot"
          onClick={() => startQuickMatch(selectedQuickTime, settings.difficulty)}
          highlighted
        >
          <div className="mt-4">
            <label className="block text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-2">Time Control</label>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_TIME_CONTROLS.slice(0, 4).map((tc) => (
                <button
                  key={tc.id}
                  onClick={() => setSelectedQuickTime(tc)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    selectedQuickTime.id === tc.id
                      ? 'bg-[var(--primary-accent)] text-[var(--app-bg)]'
                      : 'glass-panel-hover text-[var(--text-main)]'
                  }`}>
                  {tc.name}
                </button>
              ))}
            </div>
          </div>
        </ActionCard>

        <ActionCard
          icon={<Plus className="w-8 h-8" />}
          title="Create Game"
          desc="Private room with 6-char code"
          onClick={() => setShowCreateModal(true)}
        >
          <button className="btn-primary w-full mt-4" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-5 h-5 mr-2" />
            Create Room
          </button>
        </ActionCard>

        <ActionCard
          icon={<Search className="w-8 h-8" />}
          title="Join by Code"
          desc="Enter friend's room code"
          onClick={() => setShowJoinModal(true)}
        >
          <button className="btn-secondary w-full mt-4" onClick={() => setShowJoinModal(true)}>
            <Search className="w-5 h-5 mr-2" />
            Join Room
          </button>
        </ActionCard>

        <ActionCard
          icon={<Trophy className="w-8 h-8" />}
          title="Tournaments"
          desc="UKH Cup registration open"
          onClick={() => setShowTournaments(true)}
        >
          <button className="btn-secondary w-full mt-4" onClick={() => setShowTournaments(true)}>
            <Trophy className="w-5 h-5 mr-2" />
            Browse
          </button>
        </ActionCard>
      </motion.div>

      {/* Quick Match Time Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-7xl mx-auto mb-8"
      >
        <h2 className="text-lg font-black uppercase tracking-tight text-[var(--text-main)] mb-4">All Time Controls</h2>
        <div className="flex flex-wrap gap-3">
          {DEMO_TIME_CONTROLS.map((tc) => (
            <button
              key={tc.id}
              onClick={() => setSelectedQuickTime(tc)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                selectedQuickTime.id === tc.id
                  ? 'bg-[var(--primary-accent)] text-[var(--app-bg)] shadow-[0_0_20px_rgba(245,184,61,0.3)]'
                  : 'glass-panel-hover text-[var(--text-main)]'
              }`}>
            {tc.name}
          </button>
        ))}
        </div>
      </motion.div>

      {/* Recent Games */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="max-w-7xl mx-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black uppercase tracking-tight text-[var(--text-main)]">Recent Games</h2>
          <button className="btn-secondary text-sm">View All</button>
        </div>
        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-[var(--glass-border)] text-[11px] font-black uppercase tracking-wider text-[var(--text-dim)]">
            <div className="col-span-2">Opponent</div>
            <div className="col-span-2">Result</div>
            <div className="col-span-2">Time</div>
            <div className="col-span-2">ELO</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-2">Actions</div>
          </div>
          {recentGames.map((game, i) => (
            <div key={i} className="grid grid-cols-12 gap-4 p-4 border-b border-[var(--glass-border)]/50 last:border-0 hover:bg-[var(--glass-bg-hover)] transition-colors">
              <div className="col-span-2 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--primary-accent)]/20 flex items-center justify-center text-xl">🤖</div>
                <div>
                  <div className="font-bold text-[var(--text-main)]">{game.opponent}</div>
                  <div className="text-[var(--primary-accent)] font-mono text-xs">⚔️ {game.elo}</div>
                </div>
              </div>
              <div className="col-span-2">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  game.result === 'W' ? 'bg-[var(--secondary-accent)]/20 text-[var(--secondary-accent)]' :
                  game.result === 'L' ? 'bg-[var(--danger)]/20 text-[var(--danger)]' :
                  'bg-[var(--tertiary-accent)]/20 text-[var(--tertiary-accent)]'
                }`}>
                  {game.result === 'W' ? 'WIN' : game.result === 'L' ? 'LOSS' : 'DRAW'}
                </span>
              </div>
              <div className="col-span-2 text-[var(--text-main)] font-mono">{game.timeControl}</div>
              <div className="col-span-2 text-[var(--primary-accent)] font-mono">{game.result === 'W' ? '+12' : game.result === 'L' ? '-10' : '+2'}</div>
              <div className="col-span-2 text-[var(--text-dim)]">{game.date}</div>
              <div className="col-span-2">
                <button className="text-[var(--text-dim)] hover:text-[var(--primary-accent)] text-sm font-medium">Review</button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Modals */}
      <MatchmakingModal isOpen={matchmakingState !== 'idle'} onClose={() => {}} onStart={startQuickMatch} />
      <CreateRoomModal isOpen={!!createdRoomCode} onClose={() => {}} onCreate={createRoom} />
      <JoinRoomModal isOpen={false} onClose={() => {}} onJoin={joinRoom} />
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; icon: string | React.ReactNode; color?: string }> = ({
  label, value, icon, color
}) => (
  <motion.div
    className="glass-panel p-6 rounded-2xl text-center hover:glass-panel-hover transition-all"
    whileHover={{ y: -4 }}
  >
    <div className="text-3xl mb-2">{icon}</div>
    <div className="text-3xl font-black text-[var(--text-main)] font-mono" style={{ color }}>{value}</div>
    <div className="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)] mt-1">{label}</div>
  </motion.div>
);

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  highlighted?: boolean;
  children?: React.ReactNode;
}

const ActionCard: React.FC<ActionCardProps> = ({ icon, title, desc, onClick, highlighted, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -4 }}
    className={`glass-panel p-6 rounded-2xl cursor-pointer transition-all ${highlighted ? 'border border-[var(--primary-accent)]/30 relative overflow-hidden' : ''}`}
    onClick={onClick}
  >
    {highlighted && (
      <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--primary-accent)]/10 rounded-bl-3xl" />
    )}
    <div className="relative flex items-center gap-4 mb-4">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${highlighted ? 'bg-[var(--primary-accent)]/20' : 'bg-[var(--glass-bg)]'}`} style={{ color: highlighted ? 'var(--primary-accent)' : 'var(--text-main)' }}>
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-black text-[var(--text-main)]">{title}</h3>
        <p className="text-[var(--text-dim)] text-sm">{desc}</p>
      </div>
    </div>
    {children}
  </motion.div>
);