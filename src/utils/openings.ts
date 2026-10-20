import { OpeningInfo } from '../types/chess';

interface OpeningEntry {
  moves: string[]; // sequence of SAN moves
  eco: string;
  name: string;
  variation?: string;
}

export const OPENINGS_DATABASE: OpeningEntry[] = [
  // Ruy Lopez
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], eco: 'C60', name: 'Ruy Lopez' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'], eco: 'C70', name: 'Ruy Lopez', variation: 'Morphy Defense' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6'], eco: 'C68', name: 'Ruy Lopez', variation: 'Exchange Variation' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'], eco: 'C65', name: 'Ruy Lopez', variation: 'Berlin Defense' },

  // Italian Game
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], eco: 'C50', name: 'Italian Game' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'], eco: 'C50', name: 'Italian Game', variation: 'Giuoco Piano' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3'], eco: 'C53', name: 'Italian Game', variation: 'Classical Variation' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'], eco: 'C51', name: 'Evans Gambit' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'], eco: 'C55', name: 'Two Knights Defense' },

  // Other 1.e4 e5
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'], eco: 'C44', name: 'Scotch Game' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4'], eco: 'C45', name: 'Scotch Game' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6'], eco: 'C47', name: 'Four Knights Game' },
  { moves: ['e4', 'e5', 'Nf3', 'd6'], eco: 'C41', name: 'Philidor Defense' },
  { moves: ['e4', 'e5', 'Nf3', 'Nf6'], eco: 'C42', name: 'Petrov Defense' },
  { moves: ['e4', 'e5', 'f4'], eco: 'C30', name: "King's Gambit" },
  { moves: ['e4', 'e5', 'f4', 'exf4'], eco: 'C33', name: "King's Gambit Accepted" },
  { moves: ['e4', 'e5', 'Nc3'], eco: 'C25', name: 'Vienna Game' },
  { moves: ['e4', 'e5', 'Bc4'], eco: 'C23', name: "Bishop's Opening" },
  { moves: ['e4', 'e5', 'd4', 'exd4', 'Qxd4'], eco: 'C22', name: 'Center Game' },

  // Sicilian Defense
  { moves: ['e4', 'c5'], eco: 'B20', name: 'Sicilian Defense' },
  { moves: ['e4', 'c5', 'c3'], eco: 'B22', name: 'Sicilian Defense', variation: 'Alapin Variation' },
  { moves: ['e4', 'c5', 'Nc3'], eco: 'B23', name: 'Sicilian Defense', variation: 'Closed' },
  { moves: ['e4', 'c5', 'Nf3', 'Nc6'], eco: 'B30', name: 'Sicilian Defense' },
  { moves: ['e4', 'c5', 'Nf3', 'e6'], eco: 'B40', name: 'Sicilian Defense', variation: 'French Variation' },
  { moves: ['e4', 'c5', 'Nf3', 'd6'], eco: 'B50', name: 'Sicilian Defense' },
  { moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6'], eco: 'B70', name: 'Sicilian Defense', variation: 'Dragon Variation' },
  { moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'], eco: 'B90', name: 'Sicilian Defense', variation: 'Najdorf Variation' },

  // French Defense
  { moves: ['e4', 'e6'], eco: 'C00', name: 'French Defense' },
  { moves: ['e4', 'e6', 'd4', 'd5', 'e5'], eco: 'C02', name: 'French Defense', variation: 'Advance Variation' },
  { moves: ['e4', 'e6', 'd4', 'd5', 'Nd2'], eco: 'C03', name: 'French Defense', variation: 'Tarrasch Variation' },
  { moves: ['e4', 'e6', 'd4', 'd5', 'Nc3'], eco: 'C10', name: 'French Defense', variation: 'Paulsen Variation' },
  { moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Bb4'], eco: 'C15', name: 'French Defense', variation: 'Winawer Variation' },
  { moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6'], eco: 'C11', name: 'French Defense', variation: 'Classical Variation' },

  // Caro-Kann Defense
  { moves: ['e4', 'c6'], eco: 'B10', name: 'Caro-Kann Defense' },
  { moves: ['e4', 'c6', 'd4', 'd5', 'e5'], eco: 'B12', name: 'Caro-Kann Defense', variation: 'Advance Variation' },
  { moves: ['e4', 'c6', 'd4', 'd5', 'exd5', 'cxd5'], eco: 'B13', name: 'Caro-Kann Defense', variation: 'Exchange Variation' },
  { moves: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4'], eco: 'B15', name: 'Caro-Kann Defense' },
  { moves: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5'], eco: 'B18', name: 'Caro-Kann Defense', variation: 'Classical Variation' },

  // Other 1.e4 defenses
  { moves: ['e4', 'd5'], eco: 'B01', name: 'Scandinavian Defense' },
  { moves: ['e4', 'd5', 'exd5', 'Qxd5'], eco: 'B01', name: 'Scandinavian Defense', variation: 'Mieses-Kotroč Variation' },
  { moves: ['e4', 'Nf6'], eco: 'B02', name: "Alekhine's Defense" },
  { moves: ['e4', 'g6'], eco: 'B06', name: 'Modern Defense' },
  { moves: ['e4', 'd6'], eco: 'B07', name: 'Pirc Defense' },

  // Queen's Gambit
  { moves: ['d4', 'd5', 'c4'], eco: 'D06', name: "Queen's Gambit" },
  { moves: ['d4', 'd5', 'c4', 'dxc4'], eco: 'D20', name: "Queen's Gambit Accepted" },
  { moves: ['d4', 'd5', 'c4', 'e6'], eco: 'D30', name: "Queen's Gambit Declined" },
  { moves: ['d4', 'd5', 'c4', 'c6'], eco: 'D10', name: 'Slav Defense' },
  { moves: ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6', 'Nc3', 'e6'], eco: 'D43', name: 'Semi-Slav Defense' },

  // London System and other d4 systems
  { moves: ['d4', 'd5', 'Bf4'], eco: 'D00', name: 'London System' },
  { moves: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4'], eco: 'D02', name: 'London System' },
  { moves: ['d4', 'Nf6', 'Bf4'], eco: 'A45', name: 'London System' },
  { moves: ['d4', 'Nf6', 'Bg5'], eco: 'A45', name: 'Trompowsky Attack' },
  { moves: ['d4', 'f5'], eco: 'A80', name: 'Dutch Defense' },

  // Indian defenses
  { moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7'], eco: 'E61', name: "King's Indian Defense" },
  { moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'], eco: 'D80', name: 'Grünfeld Defense' },
  { moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'], eco: 'E20', name: 'Nimzo-Indian Defense' },
  { moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6'], eco: 'E12', name: "Queen's Indian Defense" },
  { moves: ['d4', 'Nf6', 'c4', 'e6', 'g3'], eco: 'E00', name: 'Catalan Opening' },
  { moves: ['d4', 'Nf6', 'c4', 'c5', 'd5'], eco: 'A56', name: 'Benoni Defense' },

  // Flank openings
  { moves: ['c4'], eco: 'A10', name: 'English Opening' },
  { moves: ['c4', 'e5'], eco: 'A20', name: 'English Opening', variation: "King's English Variation" },
  { moves: ['c4', 'c5'], eco: 'A30', name: 'English Opening', variation: 'Symmetrical Variation' },
  { moves: ['Nf3', 'd5', 'c4'], eco: 'A09', name: 'Réti Opening' },
  { moves: ['f4'], eco: 'A02', name: "Bird's Opening" },
  { moves: ['b3'], eco: 'A01', name: 'Nimzo-Larsen Attack' },
];

export function detectOpening(sanMoves: string[]): OpeningInfo | null {
  if (!sanMoves || sanMoves.length === 0) return null;

  let bestMatch: OpeningEntry | null = null;
  let maxMatchedMoves = 0;

  for (const entry of OPENINGS_DATABASE) {
    if (entry.moves.length <= sanMoves.length) {
      let isMatch = true;
      for (let i = 0; i < entry.moves.length; i++) {
        if (sanMoves[i] !== entry.moves[i]) {
          isMatch = false;
          break;
        }
      }
      if (isMatch && entry.moves.length > maxMatchedMoves) {
        bestMatch = entry;
        maxMatchedMoves = entry.moves.length;
      }
    }
  }

  if (bestMatch) {
    return {
      eco: bestMatch.eco,
      name: bestMatch.name,
      variation: bestMatch.variation
    };
  }

  // Generic fallback by first moves
  if (sanMoves[0] === 'e4' && sanMoves[1] === 'e5') return { eco: 'C20', name: "King's Pawn Game" };
  if (sanMoves[0] === 'e4') return { eco: 'B00', name: "King's Pawn Opening" };
  if (sanMoves[0] === 'd4') return { eco: 'A40', name: "Queen's Pawn Opening" };
  if (sanMoves[0] === 'c4') return { eco: 'A10', name: 'English Opening' };
  if (sanMoves[0] === 'Nf3') return { eco: 'A04', name: 'Réti Opening' };

  return null;
}
