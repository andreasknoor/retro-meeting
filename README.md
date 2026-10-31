# Retro Meeting

Real-time team retrospectives (Keep / Fix / Try). Participants join via link, no sign-up.

**Live:** https://retro-meeting.andreasknoor.com · **Plan:** [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) · **Prototype:** [mockups/prototype.html](mockups/prototype.html)

![A retro in the Discuss & Act phase: agenda, pulse check, ranked idea board and action items](docs/screenshot.png)

## Features

- Create a retro (name, goal, date, length, facilitator, phases, admin password); share it by link or as a QR code for phones
- Phases with a synchronized timer: Intro & Pulse → Brainstorm → Vote → Discuss & Act (Back, +1 min, Pause / Resume, Reset)
- By default only the admin switches phases; the creator is logged in automatically
- Anonymous pulse check (1–5), live idea board, one vote per column (counts hidden until voting ends), action items with owner, optional due date and done status
- Summary of a finished retro: copy as Markdown, download as .md, or print as PDF
- Presence in the phase bar: how many are online, and during Intro / Vote how many have answered / voted
- Admin area per retro: agenda times, phase control, delete any idea, delete the retro

## Stack

Next.js 16 (App Router, TypeScript, Tailwind, shadcn/ui) · Convex (database, realtime, server functions) · Vercel (Hobby) · GitHub Actions

## Local development

Prerequisites: Node 24+, a Convex login with access to the project (`npx convex login --vercel`).

```bash
npm install
npx convex dev        # terminal 1: pushes convex/ to your dev deployment, writes .env.local
npm run dev           # terminal 2: http://localhost:3000
```

If `npx`-spawned installs fail with `EALLOWSCRIPTS`, your user `.npmrc` sets `allow-scripts`; run the command with `NPM_CONFIG_USERCONFIG=/dev/null`.

## Tests

| Command | What |
|---|---|
| `npm test` | Unit, component and Convex backend tests (Vitest, convex-test) |
| `npm run test:coverage` | Same with coverage; fails below the gates (convex/ ≥ 90 %, lib/ ≥ 80 %) |
| `npm run test:e2e` | Playwright on desktop + mobile against a local production build (port 3100) and the Convex dev deployment |
| `npm run loadtest` | One complete retro with 30 simulated participants against the **dev** deployment |

E2E tests delete every retro they create. CI runs lint, typecheck and coverage on every push; after each production deployment the E2E suite runs against https://retro-meeting.andreasknoor.com.

## Releases

Never `git push` directly — every push is a release:

```bash
npm run release              # 0.13 → 0.14, commit, tag v0.14, push
npm run release -- --major   # only on the owner's explicit instruction
```

A pre-push hook blocks pushes whose HEAD is not tagged with the current version. Vercel deploys `main` automatically; the build runs `npx convex deploy` before `next build`.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `CONVEX_DEPLOY_KEY` | Vercel (Production, Preview) | Lets the build deploy the Convex backend (set by the Marketplace integration) |
| `NEXT_PUBLIC_CONVEX_URL` | Vercel / `.env.local` | Convex deployment URL for the browser and server actions |
| `CONVEX_DEPLOYMENT` | `.env.local` | Your dev deployment (written by `npx convex dev`) |

## Security notes

- Admin passwords are stored as salted scrypt hashes; after 3 failed logins in a row, each further attempt waits longer (10 s up to 2 minutes), so nobody can lock the admin out.
- The admin session token lives only in an HTTP-only, SameSite=strict cookie; all admin operations run through server actions.
- Participants are pseudonymous browser IDs; nothing returned to clients reveals who wrote, voted or answered what.
- Rate limits (`convex/lib/rateLimits.ts`): 60 new retros per hour overall (switched off on the dev deployment with the Convex env var `RELAX_CREATE_RETRO_LIMIT=true`, so E2E runs aren't throttled; never set it on production), 60 writes per minute per browser; at most 30 ideas and 20 actions per browser and retro.
- Security headers (CSP, no framing, `nosniff`) are set in `next.config.ts`.
- Known limit of the no-login design: a script can invent many participant IDs and so cast extra votes or flood a retro. The retro link is the only access control, so share it only with the team.
