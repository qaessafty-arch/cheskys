import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, Crown, Clock, Users, Zap, Shield, ChevronRight, ChevronLeft, ArrowLeft, Calendar, Lock, Globe, Star, Zap as ZapIcon, Shield as ShieldIcon, Award, Flag } from 'lucide-react';
import { useDemo } from '../context/DemoContext';
import { DEMO_TOURNAMENT, DEMO_TIME_CONTROLS, Tournament, TournamentMatch } from '../data/demoData';

export const TournamentsView: React.FC = () => {
  const { viewMode, setViewMode, settings } = useDemo();
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(DEMO_TOURNAMENT);
  const [view, setView] = useState<'list' | 'bracket' | 'details'>('list');

  const tournaments = [DEMO_TOURNAMENT, {
    ...DEMO_TOURNAMENT,
    id: 'ukh-blitz-championship',
    name: 'UKH BLITZ CHAMPIONSHIP',
    format: 'arena',
    timeControl: DEMO_TIME_CONTROLS[1], // Blitz 3+0
    maxPlayers: 128,
    registeredCount: 67,
    status: 'in_progress',
    startTime: '2026-10-10T18:00:00Z',
    rounds: 10,
    currentRound: 3,
    prizePool: '5,000 XP + Blitz Badge',
    bracket: [],
  }, {
    ...DEMO_TOURNAMENT,
    id: 'ukh-rapid-open',
    name: 'UKH RAPID OPEN',
    format: 'swiss',
    timeControl: DEMO_TIME_CONTROLS[4], // Rapid 10+0
    maxPlayers: 256,
    registeredCount: 142,
    status: 'registration',
    startTime: '2026-10-20T10:00:00Z',
    rounds: 9,
    currentRound: 0,
    prizePool: '15,000 XP + Rapid Champion Badge',
    bracket: [],
  }];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'registration': return 'var(--tertiary-accent)';
      case 'in_progress': return 'var(--secondary-accent)';
      case 'completed': return 'var(--text-dim)';
      default: return 'var(--text-muted)';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'registration': return <Calendar className="w-4 h-4" />;
      case 'in_progress': return <ZapIcon className="w-4 h-4" />;
      case 'completed': return <ShieldIcon className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (view === 'bracket' && selectedTournament) {
    return (
      <div className="min-h-screen pt-20 bg-[var(--app-bg)]">
        <header className="fixed top-0 left-0 right-0 z-40 glass-panel border-b border-[var(--glass-border)] px-4 py-3" style={{ backdropFilter: 'blur(20px)' }}>
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setView('list')} className="w-10 h-10 rounded-xl glass-panel-hover flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)]"><ChevronLeft className="w-5 h-5" /></button>
              <h1 className="font-black text-lg text-[var(--text-main)] truncate max-w-[300px]">{selectedTournament.name} — Bracket</h1>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase" style={{ backgroundColor: `${getStatusColor(selectedTournament.status)}20`, color: getStatusColor(selectedTournament.status) }}>
                {getStatusIcon(selectedTournament.status)} {selectedTournament.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        <div className="pt-20 pb-8 px-4 max-w-7xl mx-auto">
          <TournamentBracket tournament={selectedTournament} />
        </div>
      </div>
    );
  }

  if (view === 'details' && selectedTournament) {
    return (
      <div className="min-h-screen pt-20 bg-[var(--app-bg)]">
        <header className="fixed top-0 left-0 right-0 z-40 glass-panel border-b border-[var(--glass-border)] px-4 py-3" style={{ backdropFilter: 'blur(20px)' }}>
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setView('list')} className="w-10 h-10 rounded-xl glass-panel-hover flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)]"><ChevronLeft className="w-5 h-5" /></button>
              <h1 className="font-black text-lg text-[var(--text-main)] truncate max-w-[300px]">{selectedTournament.name}</h1>
            </div>
          </div>
        </header>

        <div className="pt-20 pb-8 px-4 max-w-7xl mx-auto">
          <TournamentDetails tournament={selectedTournament} onJoin={() => { setView('bracket'); setSelectedTournament(selectedTournament); }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 bg-[var(--app-bg)]">
      <header className="fixed top-0 left-0 right-0 z-40 glass-panel border-b border-[var(--glass-border)] px-4 py-3" style={{ backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setViewMode('dashboard')} className="w-10 h-10 rounded-xl glass-panel-hover flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)]"><ArrowLeft className="w-5 h-5" /></button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--primary-accent)]/20 flex items-center justify-center"><Trophy className="w-5 h-5 text-[var(--primary-accent)]" /></div>
              <h1 className="font-black text-lg text-[var(--text-main)]">Tournaments</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-[var(--primary-accent)]/20 text-[var(--primary-accent)] border border-[var(--primary-accent)]/30">DEMO MODE</span>
          </div>
        </div>
      </header>

      <div className="pt-20 pb-8 px-4 max-w-7xl mx-auto">
        {/* Featured Tournament */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden border border-[var(--primary-accent)]/30">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary-accent)]/10 rounded-full blur-3xl" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[var(--primary-accent)]/20 text-[var(--primary-accent)] border border-[var(--primary-accent)]/30">FEATURED</span>
                  <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${getStatusColor(DEMO_TOURNAMENT.status)}20`, color: getStatusColor(DEMO_TOURNAMENT.status) }}>
                    {getStatusIcon(DEMO_TOURNAMENT.status)} {DEMO_TOURNAMENT.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-[var(--text-main)] mb-2">{DEMO_TOURNAMENT.name}</h2>
                <p className="text-[var(--text-muted)] mb-4 max-w-md">{DEMO_TOURNAMENT.prizePool} • {DEMO_TOURNAMENT.maxPlayers} players max • {DEMO_TOURNAMENT.format.toUpperCase()}</p>
                <div className="flex flex-wrap items-center gap-6 text-sm">
                  <div className="flex items-center gap-2 text-[var(--text-dim)]"><Calendar className="w-4 h-4" /> Starts {new Date(DEMO_TOURNAMENT.startTime).toLocaleDateString()} at {new Date(DEMO_TOURNAMENT.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="flex items-center gap-2 text-[var(--text-dim)]"><Users className="w-4 h-4" /> {DEMO_TOURNAMENT.registeredCount}/{DEMO_TOURNAMENT.maxPlayers} registered</div>
                  <div className="flex items-center gap-2 text-[var(--text-dim)]"><Clock className="w-4 h-4" /> {DEMO_TOURNAMENT.timeControl.name}</div>
                  <div className="flex items-center gap-2 text-[var(--text-dim)]"><Shield className="w-4 h-4" /> {DEMO_TOURNAMENT.format.toUpperCase()}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => { setSelectedTournament(DEMO_TOURNAMENT); setView('details'); }} className="btn-primary px-6 py-3">
                  <Users className="w-5 h-5 mr-2" />
                  {DEMO_TOURNAMENT.status === 'registration' ? 'Register' : 'View Bracket'}
                </button>
                <button onClick={() => { setSelectedTournament(DEMO_TOURNAMENT); setView('bracket'); }} className="btn-secondary px-6 py-3">
                  <Trophy className="w-5 h-5 mr-2" />
                  View Bracket
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Other Tournaments */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-black uppercase tracking-tight text-[var(--text-main)] mb-4">Upcoming Tournaments</h2>
          {tournaments.slice(1).map((tournament, index) => (
            <motion.div
              key={tournament.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
              className="glass-panel p-4 rounded-xl hover:glass-panel-hover transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              onClick={() => { setSelectedTournament(tournament); setView('details'); }}
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{ backgroundColor: 'var(--primary-accent)/20' }}>
                  <Trophy className="w-8 h-8 text-[var(--primary-accent)]" />
                </div>
                <div>
                  <h3 className="font-black text-[var(--text-main)]">{tournament.name}</h3>
                  <div className="flex flex-wrap items-center gap-4 text-[var(--text-dim)] text-sm mt-1">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(tournament.startTime).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {tournament.registeredCount}/{tournament.maxPlayers}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {tournament.timeControl.name}</span>
                    <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> {tournament.format.toUpperCase()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 md:ml-auto">
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${getStatusColor(tournament.status)}20`, color: getStatusColor(tournament.status) }}>
                  {getStatusIcon(tournament.status)} {tournament.status.replace('_', ' ').toUpperCase()}
                </span>
                <ChevronRight className="w-5 h-5 text-[var(--text-dim)]" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tournament Formats Info */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-10 grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { icon: Trophy, title: 'Swiss System', desc: 'Score-based pairing, no elimination, fair for all', color: 'var(--primary-accent)' },
            { icon: Crown, title: 'Round Robin', desc: 'Everyone plays everyone, most accurate ranking', color: 'var(--secondary-accent)' },
            { icon: ZapIcon, title: 'Elimination', desc: 'Single/double elimination brackets', color: 'var(--danger)' },
            { icon: Globe, title: 'Arena', desc: 'Time-limited continuous play, join anytime', color: 'var(--tertiary-accent)' },
          ].map((format, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              className="glass-panel p-6 rounded-xl hover:glass-panel-hover transition-all"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${format.color}20` }}>
                <format.icon className="w-6 h-6" style={{ color: format.color }} />
              </div>
              <h3 className="font-black text-[var(--text-main)] mb-2">{format.title}</h3>
              <p className="text-[var(--text-dim)] text-sm">{format.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

const TournamentBracket: React.FC<{ tournament: Tournament }> = ({ tournament }) => {
  const rounds = Array.from({ length: tournament.rounds }, (_, i) => i + 1);
  const currentRoundMatches = tournament.bracket.filter(m => m.round === (tournament.currentRound || 1));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary-accent)]/20 flex items-center justify-center"><Trophy className="w-5 h-5 text-[var(--primary-accent)]" /></div>
          <div>
            <h2 className="text-xl font-black text-[var(--text-main)]">{tournament.name}</h2>
            <p className="text-[var(--text-dim)]">{tournament.format.toUpperCase()} • {tournament.timeControl.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={tournament.currentRound || 1}
            onChange={(e) => {}}
            className="px-3 py-2 bg-[var(--panel-bg)] border border-[var(--glass-border)] rounded-xl text-[var(--text-main)] text-sm"
          >
            {rounds.map(r => (
              <option key={r} value={r}>Round {r}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {currentRoundMatches.length === 0 ? (
          <div className="col-span-full glass-panel p-12 rounded-xl text-center">
            <Trophy className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-[var(--text-dim)]">Bracket not generated yet. Tournament starts soon!</p>
          </div>
        ) : (
          currentRoundMatches.map((match, idx) => (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * idx }}
              className="relative"
            >
              <div className={`glass-panel p-4 border-l-4 ${match.status === 'active' ? 'border-l-[var(--primary-accent)] shadow-[0_0_30px_rgba(245,184,61,0.1)]' : 'border-l-white/10'}`}>
                <div className="space-y-3">
                  <div className={`flex items-center justify-between p-2 rounded-lg ${match.winner === 'white' ? 'bg-[var(--secondary-accent)]/10' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-[10px] font-bold">W</div>
                      <div className="text-[11px] font-black uppercase text-white/80">{match.white.name}</div>
                    </div>
                    <div className="text-[10px] font-mono text-[var(--primary-accent)]">{match.white.elo}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-[1px] flex-1 bg-white/5" />
                    <span className="text-[9px] font-black text-white/20">VS</span>
                    <div className="h-[1px] flex-1 bg-white/5" />
                  </div>
                  <div className={`flex items-center justify-between p-2 rounded-lg ${match.winner === 'black' ? 'bg-[var(--secondary-accent)]/10' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-[10px] font-bold">B</div>
                      <div className="text-[11px] font-black uppercase text-white/80">{match.black.name}</div>
                    </div>
                    <div className="text-[10px] font-mono text-[var(--primary-accent)]">{match.black.elo}</div>
                  </div>
                </div>
                {match.status === 'active' && (
                  <div className="mt-4 pt-3 border-t border-white/5">
                    <button className="w-full py-2 bg-[var(--primary-accent)] text-[var(--app-bg)] text-xs font-black uppercase tracking-wider rounded-md hover:bg-yellow-400 transition-colors truncate">
                      Enter Match
                    </button>
                  </div>
                )}
                {match.status === 'completed' && match.winner && (
                  <div className="mt-3 pt-3 border-t border-white/5 text-center text-[11px] font-bold" style={{ color: match.winner === 'draw' ? 'var(--tertiary-accent)' : 'var(--secondary-accent)' }}>
                    {match.winner === 'draw' ? 'DRAW' : `${match.winner.toUpperCase()} WON`}
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

const TournamentDetails: React.FC<{ tournament: Tournament; onJoin: () => void }> = ({ tournament, onJoin }) => {
  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl">
        <h2 className="text-2xl font-black text-[var(--text-main)] mb-4">{tournament.name}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <DetailCard label="Format" value={tournament.format.toUpperCase()} icon={<ShieldIcon className="w-5 h-5" />} />
          <DetailCard label="Time Control" value={tournament.timeControl.name} icon={<Clock className="w-5 h-5" />} />
          <DetailCard label="Players" value={`${tournament.registeredCount}/${tournament.maxPlayers}`} icon={<Users className="w-5 h-5" />} />
          <DetailCard label="Rounds" value={tournament.rounds.toString()} icon={<Flag className="w-5 h-5" />} />
        </div>
        <div className="flex items-center gap-4 text-sm text-[var(--text-dim)] mb-6">
          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> Starts {new Date(tournament.startTime).toLocaleString()}</span>
          <span className="flex items-center gap-1"><Award className="w-4 h-4" /> {tournament.prizePool}</span>
        </div>
        <button onClick={onJoin} className="btn-primary w-full md:w-auto py-3">
          <Users className="w-5 h-5 mr-2" />
          {tournament.status === 'registration' ? 'Register Now' : 'View Bracket'}
        </button>
      </div>

      <div className="glass-panel p-6 rounded-2xl">
        <h3 className="text-lg font-black text-[var(--text-main)] mb-4">How It Works</h3>
        <div className="space-y-3 text-[var(--text-dim)]">
          <Step number={1} text="Register for the tournament before the start time" />
          <Step number={2} text="Pairings are generated automatically at round start" />
          <Step number={3} text="Play your game within the time limit" />
          <Step number={4} text="Advance through rounds based on results" />
          <Step number={5} text="Top finishers win prizes and XP" />
        </div>
      </div>
    </div>
  );
};

const DetailCard: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="glass-panel p-4 rounded-xl text-center">
    <div className="flex items-center justify-center gap-2 mb-2" style={{ color: 'var(--primary-accent)' }}>{icon}</div>
    <div className="text-xl font-black text-[var(--text-main)]">{value}</div>
    <div className="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)]">{label}</div>
  </div>
);

const Step: React.FC<{ number: number; text: string }> = ({ number, text }) => (
  <div className="flex items-center gap-3">
    <div className="w-6 h-6 rounded-full bg-[var(--primary-accent)]/20 flex items-center justify-center text-[var(--primary-accent)] font-black text-sm">{number}</div>
    <span>{text}</span>
  </div>
);