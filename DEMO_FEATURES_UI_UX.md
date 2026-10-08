# Chess Platform — Induction Day Demo Feature Specification
**UKH (University of Kurdistan Hewlêr) — Demo Showcase Edition**  
**Version:** 1.0 | **Purpose:** Induction Day Presentation | **Classification:** Public Demo (Showcase Only)

---

## Executive Summary

This document specifies the **Demo Showcase Edition** of the Chess Platform for UKH Induction Day. It defines exactly what features, UI components, and UX flows will be demonstrated — while **intentionally excluding all proprietary backend architecture, algorithms, security systems, and production infrastructure**.

**Core Principle:** Show the *experience*, hide the *machinery*.

---

## 1. Demo Architecture Overview

### Two-Version Strategy

| Aspect | **Demo Edition (Public)** | **Production Edition (Private)** |
|--------|---------------------------|----------------------------------|
| Data Source | Static/mock data, localStorage, simulated opponents | Firebase (Auth, Firestore, Storage), Redis, PostgreSQL |
| Backend | None — pure frontend simulation | Node.js + Express + Socket.io + Bull Queue |
| Authentication | Guest mode + demo accounts | JWT (15m access / 7d refresh), httpOnly cookies, rotation |
| Anti-Cheat | Visual badge only ("Fair Play Protection") | Full engine-correlation + timing analysis + ELO-adaptive thresholds |
| Real-time | Simulated WebSocket events | Socket.io with reconnection handling, presence |
| Persistence | localStorage + in-memory | Full game archive (PGN, FEN history, move telemetry) |
| Deployment | Static hosting (Vercel/Netlify/GitHub Pages) | Docker orchestration (Nginx, backend, ws, postgres, redis) |

**Induction Day Deployment:** The demo runs entirely in the browser. No server required. No secrets exposed. No production credentials anywhere in the repo.

---

## 2. Demo Flow — 5-Minute Scripted Experience

### Scene 1: Landing Page (30 seconds)
```
┌─────────────────────────────────────────────────────────────────┐
│  [Animated 3D Board Background]    [Floating Pieces]            │
│                                                                 │
│   ███████╗██╗  ██╗██████╗ ███████╗██████╗  ██████╗ ███████╗     │
│   ██╔════╝██║  ██║██╔══██╗██╔════╝██╔══██╗██╔═══██╗██╔════╝     │
│   ███████╗███████║██████╔╝█████╗  ██████╔╝██║   ██║███████╗     │
│   ╚════██║██╔══██║██╔═══╝ ██╔══╝  ██╔══██╗██║   ██║╚════██║     │
│   ███████║██║  ██║██║     ███████╗██║  ██║╚██████╔╝███████║     │
│   ╚══════╝╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝     │
│                                                                 │
│            COMPETITIVE CHESS, REIMAGINED                         │
│                    ▸ DEMO MODE — UKH INDUCTION DAY ◂             │
│                                                                 │
│  [PLAY DEMO]    [EXPLORE PLATFORM]    [VIEW LEADERBOARD]        │
│  [TOURNAMENTS]  [ABOUT]                                         │
└─────────────────────────────────────────────────────────────────┘
```

**Key Demo Elements:**
- Animated 3D chessboard background with perspective transform
- Floating 3D pieces with subtle motion (y: [0, -25, 0], rotate: [0, 8, -6, 0])
- Live game ticker (3 simulated grandmaster games with real-time updates)
- Grandmaster testimonials carousel (auto-rotating)
- Feature highlights: "⚡ Sub-20ms Latency", "🛡 Fair Play Engine", "🏆 Tournament System", "🎨 10+ Board Themes"

### Scene 2: Dashboard (30 seconds)
```
┌─────────────────────────────────────────────────────────────────┐
│  LOGO  HOME  PLAY  TOURNAMENTS  LEADERBOARD        🔔  👤  🌙   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Welcome back, Ren                    [Avatar]  1428 ELO        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Rating: 1428  │  Games: 126  │  Win Rate: 58.7%  │ 🔥5 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │
│  │ QUICK MATCH │ │ CREATE GAME │ │ JOIN BY CODE │ │ TOURNAMENT │  │
│  │             │ │             │ │             │ │            │  │
│  │  [PLAY NOW] │ │  [CREATE]   │ │  [JOIN]     │ │ [BROWSE]   │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘  │
│                                                                 │
│  TIME CONTROLS:  [1+0] [3+0] [3+2] [5+3] [10+0] [15+10]         │
│                                                                 │
│  RECENT GAMES:  W  L  D  W  W  L  D  W  W  W                    │
└─────────────────────────────────────────────────────────────────┘
```

### Scene 3: Interactive Game (90 seconds)
- Start Quick Match → Simulated matchmaking (2-3s) → Match Found → Accept
- **Demonstrate live:**
  1. Legal move highlights (green dots for empty, red rings for captures)
  2. Last move indicator (sky-blue from/to squares)
  3. Chess clock counting down (synchronized)
  4. Move history panel updating in real-time
  5. In-game chat with typing indicator
  6. Check animation (king pulse + red glow)
  7. Pawn promotion dialog (Queen/Rook/Bishop/Knight)
  8. Draw offer / Takeback / Resign modals
  9. Low-time warning (≤30s → rose background + pulse)

### Scene 4: Post-Game Screen (45 seconds)
```
┌─────────────────────────────────────────────────────────────────┐
│                         CHECKMATE                                 │
│                      VICTORY  +12 ELO                             │
├─────────────────────────────────────────────────────────────────┤
│  Ren (1430)          VS          KnightMaster (1441)            │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │   ACCURACY 87%   │  │  BEST MOVES: 8   │  │  BLUNDERS: 1  │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  MISTAKES: 2     │  │  TIME USED: 4:31 │  │  CAPTURES: 14 │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
│                                                                 │
│  [REVIEW GAME]    [PLAY AGAIN]    [SHARE RESULT]                │
└─────────────────────────────────────────────────────────────────┘
```

### Scene 5: Game Replay (45 seconds)
- Move-by-move replay with ◀ ◀ ▶ ▶ controls
- FEN display + copy button at any position
- Mock evaluation bar (visual only)
- Move list with click-to-jump

### Scene 6: Leaderboard (40 seconds)
- Tabs: Global / Weekly / Friends / **UKH**
- UKH leaderboard highlighted for induction day
- Medal emojis for top 3 (🥇 🥈 🥉)

### Scene 7: Tournament (30 seconds)
- Tournament card: "UKH INDIVIDUAL CHESS CUP"
- Bracket visualization (Round 1 → Semifinal → Final)
- Registration status: "Open / Starts in 02:14:32"

---

## 3. Features Included in Demo

### 3.1 Core Gameplay (Fully Interactive)

| Feature | Demo Implementation | Notes |
|---------|---------------------|-------|
| **Legal Move Generation** | `chess.js` client-side | Full rule validation |
| **Move Animation** | Framer Motion (60fps) | Smooth piece translation |
| **Piece Promotion** | Modal with 4 options | Auto-queen after 5s |
| **Check/Checkmate Detection** | `chess.js` + visual effects | King pulse, board flash |
| **Draw Rules** | 3-fold, 50-move, insufficient material | Auto-detected |
| **Clock System** | High-res timer (500ms ticks) | Fischer increment support |
| **Time Controls** | 6 presets + custom | Bullet → Classical |

### 3.2 Game Modes (Simulated)

| Mode | Demo Behavior |
|------|---------------|
| **Quick Match** | Simulated matchmaking → Demo Bot opponent |
| **Create Game** | Generates 6-char code, shows waiting room |
| **Join by Code** | Validates format, simulates opponent join |
| **Direct Challenge** | From friends list, 60s expiration timer |
| **Tournaments** | Bracket display only (no backend pairing) |
| **Puzzles** | Static puzzle set with solution reveal |

### 3.3 Demo Opponent (Built-in)

**UKH Bot** — Rating: 1450 (configurable: Easy/Intermediate/Expert)
- Uses `chess.js` + simple evaluation for moves
- No external engine dependency
- Works offline — critical for induction day WiFi uncertainty

```typescript
// Simplified demo bot logic (client-side only)
function getDemoBotMove(game: Chess, difficulty: 'easy' | 'medium' | 'hard'): Move {
  const moves = game.moves({ verbose: true });
  // Easy: random | Medium: capture/center preference | Hard: basic minimax depth 2
  return selectMove(moves, difficulty);
}
```

### 3.4 Social Features (Mock Data)

| Feature | Demo State |
|---------|------------|
| **Friends List** | 3-5 mock friends (mixed online/offline) |
| **Friend Requests** | Simulated incoming/outgoing |
| **Direct Challenge** | Opens challenge modal with time control picker |
| **In-Game Chat** | Pre-scripted messages + typing simulation |
| **Notifications** | Bell icon with 4-5 mock notifications |
| **Profile** | Editable display name, country, avatar |

### 3.5 Customization (Fully Functional)

#### Board Themes (10 Presets)
| Theme | Light Squares | Dark Squares | Vibe |
|-------|---------------|--------------|------|
| **UKH Chancellor** | `#E8EEF5` | `#1A3B5C` | University brand |
| **Peshmerga Tactical** | `#DFD0B0` | `#435433` | Kurdish heritage |
| **Wall Maria (AoT)** | `#1C221A` | `#4A5D43` | Anime dark fantasy |
| **Emerald Tournament** | `#EEEED2` | `#769656` | Classic FIDE green |
| **Warm Walnut** | `#E2C499` | `#9C6A38` | Handcrafted wood |
| **Ocean Breeze** | `#DEE3E6` | `#678292` | Maritime slate |
| **Midnight Slate** | `#334155` | `#0F172A` | Deep obsidian |
| **Royal Marble** | `#E8EBF0` | `#8CA2B0` | Polished alabaster |
| **Classic** | `#F0D9B5` | `#B58863` | Traditional |
| **Custom/Theme-Matched** | CSS vars | CSS vars | Syncs with UI palette |

**Transition:** Instant CSS variable swap — no reload, no lag.

#### Piece Themes (9 Sets)
| Set | Style | Tag |
|-----|-------|-----|
| **Peshmerga Royal** | Kurdish 21-ray sun, Khanjar crests | SIGNATURE |
| **UKH Chancellor** | Academic regalia, gold torches | ACADEMIC |
| **Attack on Titan** | Scouts vs Nine Titans | ANIME |
| **Crystal Neon** | Translucent glowing vectors | GLOW |
| **FIDE 3D Staunton** | Tournament 3D shaded | OFFICIAL |
| **Classic Staunton** | Flat vector tournament | STANDARD |
| **Vintage Carved** | Antiqued amber/sepia | WARM |
| **Neo Azure** | Electric slate high-contrast | CLEAN |
| **Custom Upload** | User SVG/PNG | PERSONAL |

### 3.6 Settings Tabs (Demo-Accessible)

| Tab | Controls |
|-----|----------|
| **Themes** | UI palette, board theme, piece theme |
| **Background** | Animated BG on/off, particle density |
| **Board** | Coordinates, legal move dots, last move highlight, 3D perspective |
| **Gameplay** | Confirm moves, auto-queen, show captured pieces, sound toggles |
| **Accessibility** | High contrast, larger pieces, reduced motion |

---

## 4. UI/UX Design System

### 4.1 Color Palette (CSS Variables)

```css
:root {
  /* Core */
  --app-bg: #080B12;
  --panel-bg: #10151F;
  --panel-hover: #181F2A;
  
  /* Brand */
  --primary-accent: #F5B83D;      /* Gold — primary actions */
  --secondary-accent: #6EE7B7;    /* Emerald — success, online */
  --tertiary-accent: #60A5FA;     /* Blue — info, links */
  --danger: #FB7185;              /* Rose — errors, low time */
  
  /* Text */
  --text-main: #F8FAFC;
  --text-muted: #94A3B8;
  --text-dim: #64748B;
  
  /* Glass */
  --glass-bg: rgba(255,255,255,0.04);
  --glass-bg-hover: rgba(255,255,255,0.08);
  --glass-border: rgba(255,255,255,0.1);
  --glass-border-strong: rgba(255,255,255,0.15);
  
  /* Board (theme-dependent, overridden by theme) */
  --board-light: #EEEED2;
  --board-dark: #769656;
}
```

**Usage Rules:**
- Gold (`--primary-accent`) — primary CTAs only (1-2 per screen)
- Emerald (`--secondary-accent`) — success states, online indicators
- Blue (`--tertiary-accent`) — secondary actions, links
- Rose (`--danger`) — destructive actions, time warnings only

### 4.2 Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Display/Headline | `Space Grotesk` | 48-72px | 700 (Bold) |
| Section Title | `Space Grotesk` | 20-24px | 700 |
| Body | `DM Sans` | 14-16px | 400 (Regular) |
| Mono (clock, ELO, FEN) | `JetBrains Mono` | 12-16px | 500 (Medium) |
| UI Labels | `DM Sans` | 10-11px | 700 (Bold) + uppercase + tracking-widest |

### 4.3 Spacing System (Tailwind-based)

| Token | Value | Use Case |
|-------|-------|----------|
| `space-1` | 4px | Icon gaps, tight groups |
| `space-2` | 8px | Standard element gap |
| `space-3` | 12px | Form field groups |
| `space-4` | 16px | Card padding, section gaps |
| `space-6` | 24px | Major section separation |
| `space-8` | 32px | Page-level margins |

### 4.4 Border Radius

| Element | Radius |
|---------|--------|
| Buttons, inputs | `rounded-xl` (12px) |
| Cards, panels | `rounded-2xl` (16px) |
| Modals, major containers | `rounded-3xl` (24px) |
| Pills, badges | `rounded-full` (9999px) |
| Chess squares | `rounded-sm` (2px) or none |

### 4.5 Shadows & Glow

```css
/* Board glow (theme-dependent) */
--board-glow: shadow-[0_0_30px_rgba(theme-accent,0.3)];

/* Glass depth */
--shadow-glass: 0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05);
--shadow-glass-hover: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1);
--shadow-elevated: 0 20px 60px rgba(0,0,0,0.6);

/* Focus ring */
--focus-ring: 0 0 0 3px rgba(245,184,61,0.4); /* gold */
```

### 4.6 Animation Specifications

| Interaction | Animation | Duration | Easing |
|-------------|-----------|----------|--------|
| Piece move | `translate` + `scale` | 180ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Piece hover | `scale(1.05)` + drop-shadow | 120ms | `ease-out` |
| Square select | Ring expand | 150ms | `ease-out` |
| Legal dot appear | Scale 0→1 + fade | 100ms stagger | `ease-out` |
| Check pulse | `scale(1.02)` + box-shadow | 800ms infinite | `ease-in-out` |
| Low-time pulse | Background color + scale | 1000ms infinite | `ease-in-out` |
| Modal enter | Scale 0.9→1 + fade | 200ms | `spring(350, 25)` |
| Tab switch | Slide + fade | 150ms | `ease-out` |
| Theme change | CSS var transition | 300ms | `ease-in-out` |
| Confetti | Canvas particles | 3000ms | Physics-based |

### 4.7 Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| **Desktop** (≥1024px) | Board (max 560px) + Sidebar (move history, chat) side-by-side |
| **Tablet** (768-1023px) | Board (max 480px) + Collapsible sidebar |
| **Mobile** (<768px) | Stacked: Opponent clock → Board → Your clock → Tabs (Moves/Chat/Details) |

**Mobile-specific UX:**
- Swipeable bottom sheet for move history/chat
- Larger touch targets (min 48×48px)
- Simplified controls (no hover states)

---

## 5. Component Inventory (Demo Edition)

### 5.1 Core Game Components

| Component | File | Demo Status |
|-----------|------|-------------|
| `ChessBoard` | `src/components/ChessBoard.tsx` | ✅ Full — all themes, animations, interactions |
| `ChessPiece` | `src/components/ChessPiece.tsx` | ✅ Full — all piece themes, drag/drop, click-move |
| `ChessClock` | `src/components/ChessClock.tsx` | ✅ Full — dual clock, increment, low-time warning |
| `CapturedPieces` | `src/components/CapturedPieces.tsx` | ✅ Full — material count, animated captures |
| `MoveHistory` | `src/components/MoveHistory.tsx` | ✅ Full — SAN notation, click-to-replay |
| `InGameChatPanel` | `src/components/InGameChatPanel.tsx` | ✅ Mock messages + typing simulation |
| `GameOverModal` | `src/components/GameOverModal.tsx` | ✅ Full — result, stats, replay/share actions |
| `PromotionModal` | `src/components/PromotionModal.tsx` | ✅ Full — 4 piece options, auto-queen timer |
| `GameControls` | `src/components/GameControls.tsx` | ✅ Draw/Takeback/Resign/Settings |

### 5.2 Multiplayer/Lobby Components

| Component | File | Demo Status |
|-----------|------|-------------|
| `MultiplayerLobbyView` | `src/components/MultiplayerLobbyView.tsx` | ✅ Tabs: Quick/Create/Join/My Rooms/Open/Tournaments |
| `ModernWaitingRoom` | `src/components/multiplayer/ModernWaitingRoom.tsx` | ✅ Countdown, opponent avatar, cancel |
| `ModernGameCreationModal` | `src/components/multiplayer/ModernGameCreationModal.tsx` | ✅ Time control, color, rated, visibility |
| `ModernFloatingControls` | `src/components/multiplayer/ModernFloatingControls.tsx` | ✅ In-game floating action buttons |
| `ConnectionStatus` | `src/components/multiplayer/ConnectionStatus.tsx` | ✅ Visual indicator (simulated) |

### 5.3 Social/Profile Components

| Component | File | Demo Status |
|-----------|------|-------------|
| `ProfileModal` | `src/components/ProfileModal.tsx` | ✅ Full edit, avatar picker, badges |
| `FriendsModal` | `src/components/FriendsModal.tsx` | ✅ List, requests, challenge |
| `LeaderboardModal` | `src/components/LeaderboardModal.tsx` | ✅ Tabs: Respect/ELO, UKH filter |
| `Notifications` | `src/components/Notifications.tsx` | ✅ Bell dropdown with mock data |

### 5.4 Tournament/Spectator Components

| Component | File | Demo Status |
|-----------|------|-------------|
| `TournamentBracket` | `src/components/TournamentBracket.tsx` | ✅ Visual bracket, current match highlight |
| `ModernSpectatorWidget` | `src/components/multiplayer/ModernSpectatorWidget.tsx` | ✅ Live game list, spectate button |
| `WorldwideLeaderboardView` | `src/components/WorldwideLeaderboardView.tsx` | ✅ Global rankings table |

### 5.5 Settings/Customization Components

| Component | File | Demo Status |
|-----------|------|-------------|
| `SettingsModal` | `src/components/SettingsModal.tsx` | ✅ 9 tabs, all functional |
| `CustomThemeModal` | `src/components/CustomThemeModal.tsx` | ✅ Create/edit custom UI themes |
| `ThemeSelectorModal` | `src/components/ThemeSelectorModal.tsx` | ✅ Quick theme picker |
| `ChessAvatarModal` | `src/components/ChessAvatarModal.tsx` | ✅ Preset avatars + custom upload |

### 5.6 Landing/Marketing Components

| Component | File | Demo Status |
|-----------|------|-------------|
| `LandingPage` | `src/components/LandingPage.tsx` | ✅ Full — animated BG, live ticker, testimonials |
| `AboutUsModal` | `src/components/AboutUsModal.tsx` | ✅ Team, mission, tech stack (high-level) |
| `UkhLogo` | `src/components/UkhLogo.tsx` | ✅ University branding |

### 5.7 Utility/Feedback Components

| Component | File | Demo Status |
|-----------|------|-------------|
| `FeedbackModal` | `src/components/FeedbackModal.tsx` | ✅ Submit feedback (mock) |
| `KeyboardShortcutsModal` | `src/components/KeyboardShortcutsModal.tsx` | ✅ Help overlay |
| `GlassUI` | `src/components/GlassUI.tsx` | ✅ Reusable glassmorphism primitives |

---

## 6. Interactive Behaviors Specification

### 6.1 Chess Board Interactions

```
CLICK PIECE
    │
    ├─► Highlight square (amber ring-4 ring-amber-400)
    ├─► Show legal moves:
    │     • Empty square: emerald circle (w-2 h-2 rounded-full bg-emerald-400/60)
    │     • Capture: rose border-2 border-rose-400/80
    └─► Play move sound (Web Audio synthesis)

CLICK LEGAL SQUARE
    │
    ├─► Animate piece to target (Framer Motion)
    ├─► Play capture sound if capture
    ├─► Update clocks (switch active side)
    ├─► Add to move history
    ├─► Check for check/checkmate/draw
    ├─► Trigger opponent response (demo bot)
    └─► If promotion: show PromotionModal

HOVER PIECE (desktop)
    └─► scale-105 + drop-shadow-lg

HOVER LEGAL DOT
    └─► scale-125 + opacity-100
```

### 6.2 Clock Behavior

```typescript
// TimerManager (simplified for demo)
class DemoTimer {
  whiteTime: number;  // milliseconds
  blackTime: number;
  increment: number;  // milliseconds per move
  activeSide: 'w' | 'b';
  lastTick: number;   // performance.now()
  
  tick() {
    const now = performance.now();
    const delta = now - this.lastTick;
    this.lastTick = now;
    
    if (this.activeSide === 'w') {
      this.whiteTime = Math.max(0, this.whiteTime - delta);
      if (this.whiteTime <= 30000) triggerLowTimeWarning('white');
      if (this.whiteTime === 0) triggerFlagFall('white');
    } else {
      this.blackTime = Math.max(0, this.blackTime - delta);
      if (this.blackTime <= 30000) triggerLowTimeWarning('black');
      if (this.blackTime === 0) triggerFlagFall('black');
    }
  }
  
  onMove() {
    if (this.activeSide === 'w') {
      this.whiteTime += this.increment;
    } else {
      this.blackTime += this.increment;
    }
    this.activeSide = this.activeSide === 'w' ? 'b' : 'w';
    this.lastTick = performance.now();
  }
}
```

### 6.3 Demo Bot Behavior

```typescript
// Difficulty levels for induction day
const DEMO_BOT_CONFIG = {
  easy: {
    name: 'UKH Bot (Beginner)',
    rating: 1000,
    moveDelay: 800, // ms
    strategy: 'random_legal'
  },
  medium: {
    name: 'UKH Bot (Club)',
    rating: 1450,
    moveDelay: 1200,
    strategy: 'capture_center_control'
  },
  hard: {
    name: 'UKH Bot (Expert)',
    rating: 1800,
    moveDelay: 1500,
    strategy: 'minimax_depth_2'
  }
};
```

### 6.4 Matchmaking Simulation

```typescript
// Simulated matchmaking flow (no server)
async function simulateMatchmaking(timeControl: TimeControl): Promise<MatchFound> {
  // 1. Show searching state
  setSearchStatus('Finding opponent...');
  setSearchTimer(0);
  
  // 2. Animate timer
  const timer = setInterval(() => setSearchTimer(t => t + 1), 1000);
  
  // 3. Simulate 2-4 second search
  await delay(random(2000, 4000));
  clearInterval(timer);
  
  // 4. Generate mock opponent
  const opponent = generateMockOpponent(timeControl);
  
  // 5. Show match found modal
  return {
    opponent,
    timeControl,
    estimatedRating: opponent.rating
  };
}
```

---

## 7. Pages/Routes in Demo

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `LandingPage` | Marketing landing with animated background |
| `/dashboard` | `DashboardView` | Main hub — quick match, create, join, tournaments |
| `/play` | `OnlineMatchView` | Full game screen with board, clock, chat, history |
| `/play/:matchId` | `OnlineMatchView` | Specific game (demo: generates mock session) |
| `/replay/:gameId` | `GameReplayView` | Move-by-move replay with analysis |
| `/leaderboard` | `LeaderboardModal` (full page) | Global/Weekly/Friends/UKH tabs |
| `/tournaments` | `TournamentView` | Tournament list + bracket viewer |
| `/profile` | `ProfileModal` (full page) | Editable profile, stats, achievements |
| `/settings` | `SettingsModal` (full page) | All customization tabs |
| `/puzzles` | `PuzzleMode` | Daily puzzle + practice mode |

---

## 8. Demo Data Fixtures

### 8.1 Mock Players

```typescript
const DEMO_PLAYERS = [
  { uid: 'demo-1', name: 'Ren Barzani', elo: 1428, country: 'IQ', flag: '🇮🇶', avatar: 'ukh-chancellor', online: true },
  { uid: 'demo-2', name: 'KnightMaster', elo: 1441, country: 'DE', flag: '🇩🇪', avatar: 'neo', online: true },
  { uid: 'demo-3', name: 'SaraChess', elo: 1567, country: 'IQ', flag: '🇮🇶', avatar: 'peshmerga', online: true },
  { uid: 'demo-4', name: 'Dilan', elo: 1290, country: 'SE', flag: '🇸🇪', avatar: 'classic', online: false },
  { uid: 'demo-5', name: 'GM Magnus K.', elo: 2842, country: 'NO', flag: '🇳🇴', avatar: 'fide_3d', online: true },
  { uid: 'demo-6', name: 'GM Hikaru N.', elo: 2820, country: 'US', flag: '🇺🇸', avatar: 'crystal_neon', online: true },
];
```

### 8.2 Mock Games (for ticker, replay, history)

```typescript
const DEMO_GAMES = [
  {
    id: 'demo-game-1',
    white: 'Ren Barzani',
    black: 'KnightMaster',
    result: '1-0',
    timeControl: '3+2',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3', 'O-O', 'h3', 'Nb8', 'd4', 'Nbd7', 'Nbd2', 'c5', 'd5', 'Nb6', 'Bc2', 'c4', 'dxc4', 'bxc4', 'Nb3', 'Nc5', 'Nxc5', 'dxc5', 'Bb2', 'Qc7', 'Qd3', 'Rfd8', 'Rad1', 'Rac8', 'Rfe1', 'Rxd3', 'Rxd3', 'Rxd3', 'Bxd3', 'Qxd3', 'Bxf1', 'Kxf1', 'Qd2', 'Qxd2', 'Bxd2', 'Kf8', 'Ke2', 'Ke7', 'Kd3', 'Kd6', 'f3', 'f5', 'exf5+', 'Kxf5', 'Kc4', 'Ke6', 'Kb5', 'Kd6', 'a4', 'a5', 'bxa5', 'bxa5', 'Kxa5', 'Kc5', 'Ka6', 'Kb4', 'Kb7', 'Kc3', 'Kc5', 'Kd3', 'Kd5', 'f4', 'Kc5', 'Ke4', 'Kb4', 'f5', 'Kc5', 'Kf5', 'Kb4', 'Kxf6', 'Kxa4', 'Kf7', 'Kxb3', 'Kf8', 'Kc4', 'Kf8', 'Kd5', 'Kf7', 'Ke5', 'Kf6', 'Kd6', 'Kf7', 'f6+', 'Kxf6', 'Kd7'],
    pgn: '[Event "Quick Match"]\n[Site "Chesskys"]\n[Date "2026.10.09"]\n[Round "1"]\n[White "Ren Barzani"]\n[Black "KnightMaster"]\n[Result "1-0"]\n[TimeControl "180+2"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. Nbd2 c5 12. d5 Nb6 13. Bc2 c4 14. dxc4 bxc4 15. Nb3 Nc5 16. Nxc5 dxc5 17. Bb2 Qc7 18. Qd3 Rfd8 19. Rad1 Rac8 20. Rfe1 Rxd3 21. Rxd3 Rxd3 22. Bxd3 Qxd3 23. Bxf1 Kxf1 24. Qd2 Qxd2 25. Bxd2 Kf8 26. Ke2 Ke7 27. Kd3 Kd6 28. f3 f5 29. exf5+ Kxf5 30. Kc4 Ke6 31. Kb5 Kd6 32. a4 a5 33. bxa5 bxa5 34. Kxa5 Kc5 35. Ka6 Kb4 36. Kb7 Kc3 37. Kc5 Kd3 38. Kd5 f4 39. Kc5 Ke4 40. Kb4 f5 41. Kc5 Kf5 42. Kb4 Kxf6 43. Kxa4 Kf7 44. Kxb3 Kf8 45. Kc4 Kf8 46. Kd5 Kf7 47. Ke5 Kf6 48. Kd6 Kf7 49. f6+ Kxf6 50. Kd7 1-0'
  },
  // ... more demo games
];
```

### 8.3 Mock Tournament

```typescript
const DEMO_TOURNAMENT = {
  id: 'ukh-cup-2026',
  name: 'UKH INDIVIDUAL CHESS CUP 2026',
  format: 'swiss',
  timeControl: '5+3',
  maxPlayers: 64,
  registeredCount: 32,
  status: 'registration',
  startTime: '2026-10-15T14:00:00Z',
  rounds: 6,
  currentRound: 0,
  prizePool: '10,000 XP + Champion Badge',
  bracket: [
    { round: 1, matches: [
      { white: 'Ren Barzani', black: 'Ali Hassan', status: 'pending' },
      { white: 'Sara Ahmed', black: 'Dilan Omar', status: 'pending' },
      // ... 14 more matches
    ]}
  ]
};
```

---

## 9. Accessibility (WCAG 2.1 AA)

| Requirement | Implementation |
|-------------|----------------|
| **Color Contrast** | All text ≥ 4.5:1 (7:1 for large text) |
| **Focus Visible** | Gold focus ring (3px) on all interactive elements |
| **Keyboard Navigation** | Full tab order, arrow keys for board, Escape to close modals |
| **Screen Readers** | ARIA labels, live regions for clock/moves, role="grid" for board |
| **Reduced Motion** | `prefers-reduced-motion` disables all non-essential animations |
| **High Contrast Mode** | Toggle in settings — overrides palette to pure B&W + gold |
| **Touch Targets** | Minimum 48×48px on mobile |
| **Zoom Support** | Up to 200% without horizontal scroll |

---

## 10. Performance Budgets (Demo)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Initial Load** | < 2.5s | LCP on 3G Fast |
| **Time to Interactive** | < 3.5s | TTI on 3G Fast |
| **Bundle Size (gzipped)** | < 200 KB | Main JS + CSS |
| **Frame Rate** | 60 fps | During gameplay |
| **Memory** | < 50 MB | After 10 games |
| **Clock Drift** | < 100ms | Over 10 minutes |

**Optimization Techniques Used:**
- Code splitting by route (`React.lazy` + `Suspense`)
- Dynamic imports for heavy components (AnalysisPanel, DatabaseView)
- `chess.js` tree-shaken (only used functions)
- Framer Motion `layout` animations (GPU-accelerated)
- CSS variables for theming (no JS recalculation)
- Image optimization (WebP, responsive sizes)

---

## 11. What Is EXCLUDED from Demo (Intentional)

### 11.1 Backend Architecture (Private)

```
❌ Firebase Auth / Firestore / Storage implementation
❌ Node.js Express server (server.ts)
❌ Socket.io WebSocket server
❌ Redis session store, pub/sub, rate limiting
❌ PostgreSQL schema (schema.sql) — users, games, moves, tournaments
❌ Bull Queue background jobs
❌ Nginx reverse proxy config
❌ Docker compose orchestration
❌ CI/CD pipelines
```

### 11.2 Anti-Cheat System (Private)

```
❌ Move timing analysis (<200ms avg, <50ms variance)
❌ Engine correlation (accuracy >90%, best-move >85%)
❌ ELO-adaptive thresholds (95%/92% vs 90%/85%)
❌ Flag escalation (3→monitor, 5→7-day suspension)
❌ Audit trail logging (PostgreSQL + Redis 24hr TTL)
❌ Moderator WebSocket alerts
```

### 11.3 Production Infrastructure (Private)

```
❌ JWT token rotation + blacklist
❌ bcrypt 12-round password hashing
❌ Rate limiting (5/15min refresh endpoint)
❌ CORS/Helmet middleware
❌ Per-game move locks (FIFO queue)
❌ Join code atomic Redis SET NX
❌ Reservation locks (15s during code generation)
❌ Database migrations
❌ Schema auto-init
```

### 11.4 Advanced Features (Feature Cards Only)

| Feature | Demo Representation |
|---------|---------------------|
| **Chess960** | Card: "Available in Full Platform" |
| **Tournament Engine** | Visual bracket only — no pairing algorithm |
| **Fair Play System** | Badge: "🛡 Fair Play Protection Active" |
| **Advanced Analytics** | Mock charts — no Stockfish integration |
| **Real-time Multiplayer** | Simulated — Demo Bot only |
| **Reconnection System** | UI state only — no actual recovery |
| **Persistent Accounts** | localStorage demo profile |

---

## 12. "Coming in Full Platform" Section

Place prominently on landing page and dashboard:

```jsx
<Section title="ADVANCED PLATFORM FEATURES" subtitle="Powering the full production experience">
  <FeatureCard icon="🛡" title="Fair Play Engine" 
    desc="Real-time move analysis, engine correlation detection, ELO-adaptive thresholds" />
  <FeatureCard icon="🏆" title="Tournament Engine" 
    desc="Swiss, Round Robin, Elimination, Arena formats with Berger pairing tables" />
  <FeatureCard icon="♟" title="Chess960 (Fischer Random)" 
    desc="960 starting positions, full castling rules, separate ratings" />
  <FeatureCard icon="📈" title="Deep Analytics" 
    desc="Stockfish evaluation, move classification, accuracy heatmaps, opening explorer" />
  <FeatureCard icon="👥" title="Real-time Multiplayer" 
    desc="WebSocket sync, 30s reconnection grace, presence, spectator mode" />
  <FeatureCard icon="🔄" title="Game State Persistence" 
    desc="Redis active state (2hr TTL) + PostgreSQL full archive (PGN, FEN, telemetry)" />
  <FeatureCard icon="🎯" title="ELO Integrity" 
    desc="Per-time-control ratings, Glicko-2 ready, rating deviation tracking" />
  <FeatureCard icon="🔐" title="Enterprise Security" 
    desc="JWT rotation, bcrypt 12, rate limits, per-game locks, audit trails" />
</Section>
```

**Interaction:** Click any card → Toast: *"This feature is available in the full production platform. Contact the team for a technical deep-dive."*

---

## 13. Presentation Mode

A special mode for induction day projection:

```typescript
// Activated via URL param: ?presentation=true
// Or keyboard shortcut: Ctrl+Shift+P

const PRESENTATION_MODE = {
  boardScale: 1.3,           // 30% larger board
  fontScale: 1.25,           // Larger text
  hideTechnicalControls: true, // No dev tools, no debug panels
  autoDemoOpponent: true,    // Auto-play demo bot
  autoTransitions: true,     // Auto-advance through scenes
  highlightCursor: true,     // Large cursor ring for projector
  simplifiedNav: true,       // Only: Play, Leaderboard, Tournament, Settings
  disableExternalLinks: true // No navigation away from demo
};
```

**Activation:** Add `?presentation=true` to demo URL. Shows indicator: "🎬 PRESENTATION MODE" in corner.

---

## 14. Demo Deployment Checklist

### Pre-Event (Day Before)
- [ ] Build production bundle: `npm run build`
- [ ] Test on target hardware (projector resolution, laptop)
- [ ] Verify all 10 board themes render correctly
- [ ] Verify all 9 piece themes render correctly
- [ ] Test full 5-minute scripted flow end-to-end
- [ ] Test Presentation Mode on projector
- [ ] Prepare backup: recorded video of full flow
- [ ] Verify offline capability (no network calls)

### Event Day
- [ ] Open demo in browser (incognito/private window)
- [ ] Enable Presentation Mode (`?presentation=true`)
- [ ] Fullscreen browser (F11)
- [ ] Disable OS notifications
- [ ] Test audio (move sounds, capture sounds)
- [ ] Have charger connected

### Post-Event
- [ ] Collect feedback
- [ ] Note any issues for production roadmap

---

## 15. File Structure for Demo Build

```
demo-build/
├── index.html                 # Entry point
├── assets/
│   ├── index-[hash].js        # Main bundle (~180KB gzipped)
│   ├── index-[hash].css       # Styles (~25KB gzipped)
│   ├── pieces/                # Piece theme SVGs/PNGs
│   │   ├── peshmerga/
│   │   ├── ukh/
│   │   ├── aot/
│   │   ├── crystal_neon/
│   │   ├── fide_3d/
│   │   ├── classic/
│   │   ├── vintage/
│   │   └── neo/
│   └── backgrounds/           # Board textures
├── manifest.json              # PWA manifest
├── sw.js                      # Service worker (offline)
└── demo-data.js               # All mock data (separate for easy swap)
```

**Build Command:**
```bash
# In demo branch/worktree
npm run build:demo  # Sets VITE_DEMO_MODE=true, strips private imports
```

---

## 16. Quick Reference: Demo vs Production Code Paths

| Feature Area | Demo Path | Production Path |
|--------------|-----------|-----------------|
| Auth | `useDemoAuth()` (localStorage) | `useAuth()` (Firebase + JWT) |
| Game State | `useDemoGame()` (chess.js local) | `RoomContext` + `OnlineMatchView` (Firestore + Socket.io) |
| Matchmaking | `simulateMatchmaking()` | `joinWorldwideMatchmaking()` (backend queue) |
| Chat | `useMockChat()` | `listenToInGameMessages()` (Firestore) |
| Leaderboard | `DEMO_LEADERBOARD` array | `syncWithCloudLeaderboard()` (Firestore) |
| Tournaments | `DEMO_TOURNAMENT` object | `listenToTournaments()` + pairing engine |
| Themes | `THEME_STYLES` (CSS vars) | Same + custom theme persistence (Firestore) |
| Pieces | Local SVG imports | Same + custom upload (Firebase Storage) |
| Sound | Web Audio synthesis | Same |
| Clock | `DemoTimer` class | `TimerManager` (drift-free, server-synced) |

---

## 17. Induction Day Talking Points

### Technical Highlights (for Q&A)

1. **"The board rendering uses CSS variables for instant theme switching — no re-renders, no layout thrashing."**
2. **"Piece animations are GPU-accelerated via Framer Motion's `layout` prop — 60fps even on integrated graphics."**
3. **"The chess logic runs entirely on `chess.js` — same library used by Chess.com and Lichess for move validation."**
4. **"Our demo bot uses a lightweight minimax with alpha-beta pruning — runs in <5ms per move on mobile."**
5. **"The production platform adds server-authoritative moves, anti-cheat analysis, and persistent ELO across time controls."**

### What Makes This a UKH Project

1. **Peshmerga Tactical Theme** — Kurdish 21-ray sun, Khanjar crests, gold/crimson trim
2. **UKH Chancellor Theme** — University brand colors (Navy `#1A3B5C` + Parchment `#E8EEF5`)
3. **UKH Leaderboard** — Dedicated university ranking for campus community
4. **Bilingual Ready** — i18n infrastructure (English/Kurdish/Arabic) in codebase
5. **Respect/Honor System** — Cultural values embedded in gamification (not just ELO)

---

## 18. Appendix: Key Source Files Reference

| Area | Primary Files (for team reference) |
|------|-----------------------------------|
| Board Rendering | `src/components/ChessBoard.tsx`, `src/components/ChessPiece.tsx` |
| Themes | `src/components/SettingsModal.tsx` (BOARD_THEMES, PIECE_THEMES), `src/utils/themePresets.ts` |
| Game Logic | `src/engine/board.ts`, `src/engine/ChessGameEngine.ts`, `src/utils/chessEngine.ts` |
| Multiplayer UI | `src/components/OnlineMatchView.tsx`, `src/components/MultiplayerLobbyView.tsx` |
| Room/State | `src/context/RoomContext.tsx`, `src/context/AuthContext.tsx` |
| Tournament | `src/components/TournamentBracket.tsx`, `src/services/tournamentService.ts` |
| Landing | `src/components/LandingPage.tsx` |
| Profile/Social | `src/components/ProfileModal.tsx`, `src/components/FriendsModal.tsx` |
| Leaderboard | `src/components/LeaderboardModal.tsx`, `src/utils/respectSystem.ts` |
| Settings | `src/components/SettingsModal.tsx`, `src/components/CustomThemeModal.tsx` |

---

## 19. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-09 | Demo Team | Initial induction day specification |

---

## 20. Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Technical Lead | | | |
| Product Owner | | | |
| UKH Faculty Advisor | | | |

---

**END OF DEMO SPECIFICATION**

*This document describes the Showcase Demo Edition only. The full production platform includes substantial additional engineering not described here. For technical deep-dive on backend architecture, anti-cheat systems, or tournament pairing algorithms, request a private technical review session.*