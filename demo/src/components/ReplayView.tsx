import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Chess, Square } from 'chess.js';
import { ChevronLeft, ChevronRight, Copy, Check, X, Download, Eye, RotateCcw, RotateCw, BarChart2, Brain, Share2, ArrowLeft } from 'lucide-react';
import { useDemo } from '../context/DemoContext';
import { ChessBoard } from './ChessBoard';
import { MoveHistory } from './MoveHistory';
import { DEMO_GAMES } from '../data/demoData';
import { formatTimeLong } from '../utils/chessEngine';
import { GameState } from '../types/chess';

// Replays need the real move list. A FEN has no history, so the moves come from the PGN and
// the replay always starts from the standard starting position.
const movesFromPgn = (pgn: string) => {
  const parsed = new Chess();
  try { parsed.loadPgn(pgn); } catch { /* keep whatever parsed before the error */ }
  return parsed.history({ verbose: true });
};

// Simple material balance, in pawns, from White's point of view
const materialScore = (g: Chess) => {
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  return g.board().flat().reduce((sum, sq) => {
    if (!sq) return sum;
    return sum + (sq.color === 'w' ? values[sq.type] : -values[sq.type]);
  }, 0);
};

export const ReplayView: React.FC = () => {
  const { viewMode, setViewMode, settings, currentUser, currentGame, replayGame } = useDemo();
  // A game picked from the dashboard comes first, then the game just played, then the samples
  const replayGames: GameState[] = [
    ...(replayGame ? [replayGame] : []),
    ...(currentGame && currentGame.moves.length > 0 ? [currentGame] : []),
    ...DEMO_GAMES,
  ].filter((g, i, all) => all.findIndex(x => x.id === g.id) === i);
  const [selectedGame, setSelectedGame] = useState<GameState>(() => replayGames[0]);
  const [game, setGame] = useState<Chess>(() => new Chess());
  const [moveIndex, setMoveIndex] = useState(0);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [evalScore, setEvalScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const moves = useMemo(() => movesFromPgn(selectedGame.pgn), [selectedGame]);

  const movePairs = useMemo(() => {
    const pairs: Array<{ moveNumber: number; white: string; black?: string; whiteSan: string; blackSan?: string }> = [];
    for (let i = 0; i < moves.length; i += 2) {
      pairs.push({
        moveNumber: Math.floor(i / 2) + 1,
        white: moves[i].san,
        black: moves[i + 1]?.san,
        whiteSan: moves[i].san,
        blackSan: moves[i + 1]?.san,
      });
    }
    return pairs;
  }, [moves]);

  // Open each game at its final position
  useEffect(() => {
    const list = movesFromPgn(selectedGame.pgn);
    const finalGame = new Chess();
    for (const m of list) finalGame.move({ from: m.from, to: m.to, promotion: m.promotion });
    setGame(finalGame);
    setMoveIndex(list.length);
  }, [selectedGame]);

  const goToMove = (index: number) => {
    const targetIndex = Math.max(0, Math.min(index, moves.length));
    const newGame = new Chess();
    for (let i = 0; i < targetIndex; i++) {
      newGame.move({ from: moves[i].from, to: moves[i].to, promotion: moves[i].promotion });
    }
    setGame(newGame);
    setMoveIndex(targetIndex);
    setEvalScore(materialScore(newGame));
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      playIntervalRef.current = setInterval(() => {
        if (moveIndex >= moves.length) {
          setIsPlaying(false);
          if (playIntervalRef.current) clearInterval(playIntervalRef.current);
        } else {
          goToMove(moveIndex + 1);
        }
      }, 1000);
    }
  };

  useEffect(() => {
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, []);

  const copyFEN = () => {
    navigator.clipboard.writeText(game.fen());
  };

  const copyPGN = () => {
    navigator.clipboard.writeText(game.pgn());
  };

  const downloadPGN = () => {
    const blob = new Blob([game.pgn()], { type: 'application/x-chess-pgn' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedGame.white.name}-vs-${selectedGame.black.name}-${new Date().toISOString().split('T')[0]}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen pt-20 bg-[var(--app-bg)]">
      <header className="fixed top-0 left-0 right-0 z-40 glass-panel border-b border-[var(--glass-border)] px-4 py-3" style={{ backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setViewMode('dashboard')} className="w-10 h-10 rounded-xl glass-panel-hover flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)]"><ArrowLeft className="w-5 h-5" /></button>
            <h1 className="font-black text-lg text-[var(--text-main)]">Game Replay</h1>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedGame.id}
              onChange={(e) => setSelectedGame(replayGames.find(g => g.id === e.target.value)!)}
              className="px-3 py-2 bg-[var(--panel-bg)] border border-[var(--glass-border)] rounded-xl text-[var(--text-main)] text-sm"
            >
              {replayGames.map(g => (
                <option key={g.id} value={g.id}>{g.white.name} vs {g.black.name} ({g.timeControl.name})</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 px-4 pb-8 max-w-7xl mx-auto w-full pt-24">
        {/* Left: Board + Controls */}
        <div className="flex-1 lg:w-2/3 flex flex-col items-center gap-6">
          {/* Game Header */}
          <div className="w-full max-w-[560px] glass-panel p-4 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--primary-accent)]/20 flex items-center justify-center text-xl">{selectedGame.white.flag}</div>
                <div>
                  <div className="font-bold text-[var(--text-main)]">{selectedGame.white.name}</div>
                  <div className="text-[var(--primary-accent)] font-mono text-sm">⚔️ {selectedGame.white.elo}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[var(--primary-accent)] font-black text-xl">VS</div>
              <div className="flex items-center gap-3 text-right">
                <div>
                  <div className="font-bold text-[var(--text-main)]">{selectedGame.black.name}</div>
                  <div className="text-[var(--primary-accent)] font-mono text-sm">⚔️ {selectedGame.black.elo}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-[var(--primary-accent)]/20 flex items-center justify-center text-xl">{selectedGame.black.flag}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <span className="px-3 py-1 rounded-full bg-[var(--primary-accent)]/20 text-[var(--primary-accent)] font-bold">{selectedGame.timeControl.name}</span>
              <span className="text-[var(--text-dim)]">{selectedGame.result ?? '*'}</span>
              <span className="text-[var(--text-dim)]">{selectedGame.moves.length} moves</span>
            </div>
          </div>

          {/* Board */}
          <ChessBoard
            game={game}
            orientation="w"
            settings={settings}
            lastMove={moves[moveIndex - 1] ? { from: moves[moveIndex - 1].from, to: moves[moveIndex - 1].to } : null}
            selectedSquare={null}
            onSquareClick={() => {}}
            disabled={true}
          />

          {/* Navigation Controls */}
          <div className="w-full max-w-[560px] flex items-center justify-center gap-4 glass-panel p-4 rounded-xl">
            <button onClick={() => goToMove(0)} disabled={moveIndex === 0} className="btn-secondary px-4"><ChevronLeft className="w-5 h-5" /><ChevronLeft className="w-5 h-5" /></button>
            <button onClick={() => goToMove(moveIndex - 1)} disabled={moveIndex === 0} className="btn-secondary px-4"><ChevronLeft className="w-5 h-5" /></button>
            <button onClick={handlePlayPause} className="btn-primary px-6">
              {isPlaying ? <motion.span animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity }}><span className="w-5 h-5 inline-block">⏸</span></motion.span> : <span className="w-5 h-5 inline-block">▶</span>}
            </button>
            <button onClick={() => goToMove(moveIndex + 1)} disabled={moveIndex >= moves.length} className="btn-secondary px-4"><ChevronRight className="w-5 h-5" /></button>
            <button onClick={() => goToMove(moves.length)} disabled={moveIndex >= moves.length} className="btn-secondary px-4"><ChevronRight className="w-5 h-5" /><ChevronRight className="w-5 h-5" /></button>
          </div>

          {/* Move Counter */}
          <div className="w-full max-w-[560px] flex items-center justify-center gap-4 text-[var(--text-dim)]">
            <span>Move {moveIndex} / {moves.length}</span>
            <div className="w-48 h-2 bg-[var(--glass-bg)] rounded-full overflow-hidden">
              <motion.div className="h-full bg-[var(--primary-accent)]" style={{ width: `${(moveIndex / Math.max(1, moves.length)) * 100}%` }} transition={{ duration: 200 }} />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full max-w-[560px] flex flex-wrap justify-center gap-3 glass-panel p-4 rounded-xl">
            <button onClick={copyFEN} className="btn-secondary text-sm flex items-center gap-2"><Copy className="w-4 h-4" /> Copy FEN</button>
            <button onClick={copyPGN} className="btn-secondary text-sm flex items-center gap-2"><Copy className="w-4 h-4" /> Copy PGN</button>
            <button onClick={downloadPGN} className="btn-secondary text-sm flex items-center gap-2"><Download className="w-4 h-4" /> Download PGN</button>
            <button onClick={() => setShowAnalysis(!showAnalysis)} className={`btn-secondary text-sm flex items-center gap-2 ${showAnalysis ? 'bg-[var(--primary-accent)]/10 border-[var(--primary-accent)]/30' : ''}`}><Brain className="w-4 h-4" /> Analysis</button>
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4 max-h-[calc(100vh-160px)]">
          {/* Move History */}
          <div className="glass-panel p-4 rounded-xl flex-1 min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-muted)]">Move History</h3>
              <span className="text-xs text-[var(--text-dim)]">{movePairs.length} moves</span>
            </div>
            <MoveHistory game={game} onGoToMove={goToMove} currentMoveIndex={moveIndex} maxHeight={400} />
          </div>

          {/* Analysis Panel */}
          {showAnalysis && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-4 rounded-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2"><Brain className="w-4 h-4" /> Analysis</h3>
                <button onClick={() => setShowAnalysis(false)} className="w-8 h-8 rounded-lg glass-panel-hover flex items-center justify-center text-[var(--text-muted)]"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-[var(--text-dim)]">Evaluation</span>
                    <span className="font-mono font-bold text-[var(--text-main)]">{evalScore > 0 ? '+' : ''}{evalScore.toFixed(1)}</span>
                  </div>
                  <div className="h-3 bg-[var(--glass-bg)] rounded-full overflow-hidden relative">
                    <motion.div
                      className="absolute top-0 bottom-0 bg-[var(--secondary-accent)]"
                      style={{ left: '50%', width: `${Math.max(0, Math.min(100, 50 + evalScore * 10))}%` }}
                      transition={{ duration: 300 }}
                    />
                    <div className="absolute top-0 bottom-0 w-px bg-[var(--primary-accent)] left-[50%]" />
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--text-dim)] mt-1">
                    <span>Black winning</span>
                    <span>Equal</span>
                    <span>White winning</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <AnalysisStat label="Best Moves" value="8" icon="✨" />
                  <AnalysisStat label="Blunders" value="1" icon="💥" color="var(--danger)" />
                  <AnalysisStat label="Mistakes" value="2" icon="⚠️" color="var(--primary-accent)" />
                  <AnalysisStat label="Accuracy" value="87%" icon="🎯" color="var(--secondary-accent)" />
                </div>
                <div className="pt-4 border-t border-[var(--glass-border)]">
                  <button className="btn-primary w-full text-sm"><Share2 className="w-4 h-4 mr-2" /> Share Analysis</button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

const AnalysisStat: React.FC<{ label: string; value: string; icon: string; color?: string }> = ({ label, value, icon, color }) => (
  <div className="glass-panel p-3 rounded-xl text-center">
    <div className="text-xl mb-1">{icon}</div>
    <div className="text-xl font-black text-[var(--text-main)]" style={{ color }}>{value}</div>
    <div className="text-[9px] uppercase tracking-widest font-black text-[var(--text-muted)]">{label}</div>
  </div>
);