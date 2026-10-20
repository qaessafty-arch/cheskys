export interface TrainingExercise {
  id: string;
  title: string;
  description: string;
  fen: string;
  /** Alternating moves: the player's moves at even indexes, the coach's replies at odd ones. */
  solution: string[];
  difficulty: 'easy' | 'medium' | 'hard' | 'master';
  theme: string;
  hint?: string;
}

// Every position and line is replayed move by move in coachExercises.test.ts; the mates end in mate.
export const TRAINING_EXERCISES: TrainingExercise[] = [
  {
    id: 'mate_back_rank',
    title: 'Back Rank Mate',
    description: 'Deliver checkmate on the back rank',
    fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
    solution: ['Ra8#'],
    difficulty: 'easy',
    theme: 'checkmate',
    hint: 'The king is boxed in by its own pawns. Which line is open?'
  },
  {
    id: 'fork_knight',
    title: 'Knight Fork',
    description: 'Attack the king and queen at once, then win the queen',
    fen: 'q3k3/8/8/1N6/8/8/5PPP/6K1 w - - 0 1',
    solution: ['Nc7+', 'Kd7', 'Nxa8'],
    difficulty: 'easy',
    theme: 'tactics_fork',
    hint: 'Look for a knight check that also hits the queen in the corner'
  },
  {
    id: 'pin_win_piece',
    title: 'Win the Pinned Knight',
    description: 'The knight cannot move without exposing its king. Attack it.',
    fen: '4k3/8/8/4n3/8/8/5P2/4R1K1 w - - 0 1',
    solution: ['f4', 'Kd7', 'fxe5'],
    difficulty: 'easy',
    theme: 'tactics_pin',
    hint: 'A pinned piece is a target. Hit it with something cheap — a pawn.'
  },
  {
    id: 'skewer_rook',
    title: 'Skewer Attack',
    description: 'Check the king so it has to step aside, then take the rook behind it',
    fen: '3r4/8/8/3k4/8/8/8/R3K3 w - - 0 1',
    solution: ['Rd1+', 'Kc4', 'Rxd8'],
    difficulty: 'medium',
    theme: 'tactics_skewer',
    hint: 'The king and rook stand on the same file'
  },
  {
    id: 'mate_smothered',
    title: 'Smothered Mate',
    description: 'Knight delivers mate surrounded by own pieces',
    fen: '6rk/6pp/8/6N1/8/8/8/6QK w - - 0 1',
    solution: ['Nf7#'],
    difficulty: 'medium',
    theme: 'checkmate',
    hint: 'The knight can jump to a square where the king is surrounded by its own pieces'
  },
  {
    id: 'mate_ladder',
    title: 'Two-Rook Ladder',
    description: 'Use both rooks to drive the king to the edge and mate it',
    fen: '7k/8/8/8/8/8/R7/1R4K1 w - - 0 1',
    solution: ['Ra7', 'Kg8', 'Rb8#'],
    difficulty: 'medium',
    theme: 'endgame',
    hint: 'One rook cuts off the 7th rank, the other delivers mate on the 8th'
  },
  {
    id: 'opening_italian',
    title: 'Italian Game',
    description: 'Play the first moves of the Italian Game as White',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    solution: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
    difficulty: 'easy',
    theme: 'opening_italian',
    hint: 'Take the centre with a pawn, develop the king-side knight, then aim the bishop at f7'
  },
  {
    id: 'endgame_breakthrough',
    title: 'Pawn Breakthrough',
    description: 'Three pawns against three, with the black king far away. Make a queen',
    fen: '8/ppp5/8/PPP5/8/8/5k2/7K w - - 0 1',
    solution: ['b6', 'axb6', 'c6', 'bxc6', 'a6'],
    difficulty: 'hard',
    theme: 'endgame',
    hint: 'Sacrifice the middle pawn first, then the c-pawn, and the a-pawn walks through'
  }
];
