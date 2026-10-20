/**
 * The coaches the player can train with. Two are inspired by historical world-class
 * players (their biographies use documented facts only; their lines are written for
 * the app, not quotations), and one is an original Chesskys character.
 */
import { MistakeMotif } from './mistakes';
import { Severity } from './review';

export type CoachId = 'morphy' | 'capablanca' | 'mamosta';

export interface CoachLook {
  skin: string;
  hair: string;
  coat: string;
  coatTrim: string;
  shirt: string;
  neckwear: string;
  eyes: string;
  /** Extra details the 3D model draws for this character. */
  beard?: string;
  headwrap?: { base: string; pattern: string };
  sash?: string;
}

export interface CoachCharacter {
  id: CoachId;
  name: string;
  shortName: string;
  /** One line under the name. */
  tagline: string;
  bio: string;
  specialty: string;
  /** Kept for the existing message code. */
  style: string;
  focus: string[];
  emoji: string;
  accent: string;
  look: CoachLook;
  catchphrases: string[];
  lines: {
    greeting: string[];
    poke: string[];
    reviewStart: string;
    reviewClean: string;
    reviewSummary: (count: number) => string;
    mistake: Record<Severity, string[]>;
    motifTip: Record<MistakeMotif, string>;
    tryAgain: string;
    retryRight: string[];
    retryAlsoGood: string;
    retryWrong: string;
    reveal: string;
    similarFound: (count: number) => string;
    practice: string;
  };
}

const MOTIF_TIPS_SHARED: Record<MistakeMotif, string> = {
  allowed_mate: 'Before every move, ask: what checks does my opponent have after it?',
  missed_mate: 'Checks, captures, threats — in that order. Mates hide behind checks.',
  hanging_piece: 'After choosing a move, count attackers and defenders on every piece you own.',
  allowed_fork: 'Knights love squares that touch two of your pieces. Keep your king and big pieces off the same knight jump.',
  missed_fork: 'Look for squares where one piece attacks two targets, especially with check.',
  missed_material: 'Always check whether your opponent left something unprotected.',
  positional: 'When there is no tactic, improve your worst piece.',
};

export const COACHES: CoachCharacter[] = [
  {
    id: 'morphy',
    name: 'Paul Morphy',
    shortName: 'Morphy',
    tagline: 'Inspired by the 1850s American champion',
    bio: 'Paul Morphy (1837–1884) of New Orleans won the First American Chess Congress in 1857 and in 1858 beat the leading European masters. His Opera Game, played in Paris that year, is still the model of fast development and attack.',
    specialty: 'Attack, development and tactics',
    style: 'attacking',
    focus: ['development', 'open lines', 'tactics'],
    emoji: '🎩',
    accent: '#F59E0B',
    look: {
      skin: '#E8C4A0',
      hair: '#2B1B12',
      coat: '#1C1F2E',
      coatTrim: '#2E3348',
      shirt: '#F4F1E8',
      neckwear: '#111111',
      eyes: '#3B2A1E',
    },
    catchphrases: [
      'Develop, then attack!',
      'Every tempo counts.',
      'Open lines lead to the enemy king.',
    ],
    lines: {
      greeting: [
        'Good day! Bring your pieces out quickly and the attack will come to you.',
        'Welcome. Shall we find some brilliant combinations today?',
      ],
      poke: [
        'Count your developed pieces. Then count your opponent\'s.',
        'A knight on the rim is dim, but a knight near the king is dangerous.',
        'Castle early, and open the centre when you are ahead in development.',
      ],
      reviewStart: 'Let us replay your game. I will stop where the game turned.',
      reviewClean: 'I found no serious mistakes. Splendid play!',
      reviewSummary: n => `I found ${n} moment${n === 1 ? '' : 's'} where the game slipped. Let us look at each one.`,
      mistake: {
        blunder: ['Here the game turned against you.', 'Ah, this one hurt.'],
        mistake: ['Here you let some of your advantage go.', 'A real chance was missed here.'],
        inaccuracy: ['A small slip here.', 'Not the sharpest move.'],
      },
      motifTip: MOTIF_TIPS_SHARED,
      tryAgain: 'Find a better move. Look for the most forcing one first.',
      retryRight: ['Exactly! That is the move.', 'Bravo, you found it!'],
      retryAlsoGood: 'That works just as well. Well played.',
      retryWrong: 'Not quite. Try once more, or let me show you.',
      reveal: 'Here is what I would have played:',
      similarFound: n => `You have made this kind of mistake ${n === 1 ? 'once before' : `${n} times before`}. Let us fix the habit.`,
      practice: 'Practise the same idea in these positions:',
    },
  },
  {
    id: 'capablanca',
    name: 'José Raúl Capablanca',
    shortName: 'Capablanca',
    tagline: 'Inspired by the Cuban world champion',
    bio: 'José Raúl Capablanca (1888–1942) of Havana was world champion from 1921 to 1927. He was famous for clear, simple play and flawless endgames, and wrote the classic book Chess Fundamentals (1921).',
    specialty: 'Positional play and endgames',
    style: 'positional',
    focus: ['simplicity', 'endgames', 'piece activity'],
    emoji: '🎓',
    accent: '#38BDF8',
    look: {
      skin: '#D9A97F',
      hair: '#141414',
      coat: '#4A4F5C',
      coatTrim: '#5A606E',
      shirt: '#FFFFFF',
      neckwear: '#7A1F2B',
      eyes: '#2A1D14',
    },
    catchphrases: [
      'Keep it simple.',
      'Good technique wins more games than brilliance.',
      'Know the endgame and the middlegame becomes easier.',
    ],
    lines: {
      greeting: [
        'Hello. Let us make your play simpler and stronger.',
        'Welcome. Good chess is clear chess.',
      ],
      poke: [
        'Trade pieces when you are ahead in material.',
        'An active king wins endgames.',
        'Rooks belong on open files.',
      ],
      reviewStart: 'Let us review your game calmly, move by move.',
      reviewClean: 'Clean play. I found no serious mistakes.',
      reviewSummary: n => `There ${n === 1 ? 'is one moment' : `are ${n} moments`} worth studying. One at a time.`,
      mistake: {
        blunder: ['This move changed the result.', 'Here the position was thrown away.'],
        mistake: ['This made your task much harder.', 'A clearer move was available here.'],
        inaccuracy: ['A little imprecise.', 'Slightly loose.'],
      },
      motifTip: { ...MOTIF_TIPS_SHARED, positional: 'Ask which of your pieces is doing least, and give it a better square.' },
      tryAgain: 'What would you play instead? Take your time.',
      retryRight: ['Correct.', 'Yes, that is the right idea.'],
      retryAlsoGood: 'That is also fine. Good.',
      retryWrong: 'No. Look again, or I will show you.',
      reveal: 'The correct continuation:',
      similarFound: n => `This pattern appeared in your games ${n === 1 ? 'once before' : `${n} times before`}.`,
      practice: 'Study the same idea here:',
    },
  },
  {
    id: 'mamosta',
    name: 'Mamosta Zagros',
    shortName: 'Mamosta',
    tagline: 'Chesskys original — mamosta means teacher in Kurdish',
    bio: 'A patient teacher from the Zagros mountains who has taught chess to three generations of players. He believes every mistake is a lesson, and that a calm mind finds the best move.',
    specialty: 'Patient teaching for every level',
    style: 'patient',
    focus: ['safety first', 'calm thinking', 'learning from mistakes'],
    emoji: '🏔️',
    accent: '#22C55E',
    look: {
      skin: '#C99872',
      hair: '#D9D6CF',
      coat: '#6B5A3E',
      coatTrim: '#85724F',
      shirt: '#EDE6D6',
      neckwear: '#6B5A3E',
      eyes: '#2B2017',
      beard: '#E3DFD6',
      headwrap: { base: '#F2F0EA', pattern: '#1A1A1A' },
      sash: '#B23A2E',
    },
    catchphrases: [
      'Slowly, slowly — the mountain is climbed step by step.',
      'Every mistake is a lesson.',
      'Look twice, move once.',
    ],
    lines: {
      greeting: [
        'Welcome, my student. Let us learn something together today.',
        'Welcome back! Sit, and let us look at some chess.',
      ],
      poke: [
        'Before you move, ask: is every one of my pieces safe?',
        'A calm mind sees more than a fast hand.',
        'When you find a good move, look for a better one.',
      ],
      reviewStart: 'Let us walk through your game together. Mistakes are our teachers.',
      reviewClean: 'Well done! I found no serious mistakes in this game.',
      reviewSummary: n => `I found ${n} lesson${n === 1 ? '' : 's'} in this game. Let us learn from ${n === 1 ? 'it' : 'each one'}.`,
      mistake: {
        blunder: ['Here is the big lesson of this game.', 'This is the moment to remember.'],
        mistake: ['Here there was a better path.', 'Let us look closely here.'],
        inaccuracy: ['A small thing, but worth seeing.', 'Almost right.'],
      },
      motifTip: MOTIF_TIPS_SHARED,
      tryAgain: 'Take your time. What would you play now?',
      retryRight: ['Yes! You see it now.', 'Very good, that is the move.'],
      retryAlsoGood: 'That is good too. Well thought.',
      retryWrong: 'Not this one. Try again, or ask me to show you.',
      reveal: 'Look at this path:',
      similarFound: n => `You met this same problem ${n === 1 ? 'once before' : `${n} times before`}. Let us make it the last time.`,
      practice: 'Train the same idea with these positions:',
    },
  },
];

export const DEFAULT_COACH: CoachId = 'mamosta';
const STORAGE_KEY = 'chesskys_coach_character';

export const getCoach = (id: string | null | undefined): CoachCharacter => COACHES.find(c => c.id === id) ?? COACHES.find(c => c.id === DEFAULT_COACH)!;

export function loadCoachId(): CoachId {
  try {
    return getCoach(localStorage.getItem(STORAGE_KEY)).id;
  } catch {
    return DEFAULT_COACH;
  }
}

export function saveCoachId(id: CoachId) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Not remembered; the default coach is used next time.
  }
}
