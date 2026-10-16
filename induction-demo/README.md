# Chesskys — UKH Induction Day Demo

A browser-only showcase of the Chesskys chess platform, built for the UKH Induction Day presentation.

It runs entirely in the browser. There is no backend, no account, and no server to start, so it works on any laptop with a browser.

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # development server at http://localhost:5173
```

To run the production build locally:

```bash
npm run build      # type-checks, then builds to dist/
npm run preview    # serves dist/ at http://localhost:4173
```

The `dist/` folder is plain static files. It can be hosted on any static host (Netlify, Vercel, GitHub Pages, or a USB stick opened through a local server).

## What the demo shows

1. **Landing page**: the platform and the Kurdish heritage branding.
2. **Dashboard**: rating, stats, Quick Match with a bot, create or join a room by code, and the tournament listing.
3. **Quick Match**: a short search, then a live game against the UKH Bot. Click a piece, then a destination square.
4. **Game screen**: clocks with increment, move history, undo, draw and resign, and the execute / spare decision.
5. **Game review**: step through a finished game move by move.
6. **Leaderboard, tournaments and profile**: sample data for the UKH Cup.
7. **Features page**: an overview of the platform's capabilities.
8. **Settings**: board and piece themes, presentation mode, and other options.

## What is real and what is mocked

| Area | Status |
| --- | --- |
| Chess rules, legal moves, check, mate, PGN and FEN | Real (chess.js) |
| Bot opponent | Simple, not the production engine: random moves (Beginner), a capture and centre heuristic (Club), or a two-ply search (Expert) |
| Players, ratings, tournaments, leaderboard, recent games | Sample data (`src/data/demoData.ts`) |
| Clocks, increments and flag fall | Real, in the browser |
| Settings | Saved in the browser (localStorage) |
| Multiplayer, accounts, rating changes | Not included. The production platform has these, but they are not part of this demo |
| Accuracy, blunders and best-move counts on the result screen | Fixed sample numbers, not analysed from the game |

Nothing in this repository talks to a server, and it contains no keys or credentials.

## Presenter tips

- Start on the landing page and press **Play Demo**. A match starts in a few seconds.
- The bot answers after about a second. The first move can be yours or the bot's, because colours are random.
- Use **Review Game** on the result screen, or the replay view, to show the move list.
- Presentation mode (the projector icon in the header) hides clutter for a projector.
- If something looks stuck, reload the page. Settings are kept in the browser, so the look stays the same.

## Project layout

```
src/
  components/   screens and widgets (GameView, ChessBoard, ReplayView, ...)
  context/      DemoContext: game, settings and navigation state
  data/         sample players, games, tournaments and themes
  utils/        chess helpers (move generation, bot moves, time formatting)
  types/        shared TypeScript types
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run typecheck` | TypeScript check, no output files |
| `npm run build` | Type check, then production build |
| `npm run preview` | Serve the production build locally |
