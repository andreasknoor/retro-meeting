# Retro Meeting App — Implementation Plan

**Status:** Draft for review · **Date:** 2026-10-29 · **Author:** Andreas Knoor (with Claude)

> Nothing has been implemented yet. This document defines scope, architecture, data model and the build sequence. Items marked **[DEFAULT]** are assumptions I made where no decision exists yet. Please confirm or correct them (they are also listed in §12 Open Questions).

---

## 1. Summary

A lightweight web app for running team retrospectives with many participants in real time. Anyone can create a retro and share it via a link, and participants join without logging in. A retro runs through up to four phases: **Intro & Pulse Check → Brainstorm → Vote → Discuss**. A synchronized phase timer guides the group. Ideas, votes and action items appear live for everyone, and the whole retro lives on a single page. Past retros stay accessible. A small admin area, protected by a password set per retro, lets you change agenda times and delete retros.

**Stack:** Next.js (App Router, TypeScript) + Convex (reactive database & realtime) on Vercel (Hobby plan), with the source code on GitHub.

---

## 2. Goals & Non-Goals

### Goals
1. A facilitator can set up a retro and share the link in **under 2 minutes**.
2. Participants join from a link with **zero sign-up**.
3. Every participant sees new ideas, votes, phase changes and the timer **in under 1 second**.
4. Every retro ends with a **list of action items with an owner and a due date**.
5. Runs at **zero infrastructure cost** (Vercel Hobby + Convex free tier).

### Non-Goals (v1)
| Non-goal | Reason |
|---|---|
| User accounts / SSO | Link-based access is an explicit requirement, and accounts add friction and GDPR scope. |
| Configurable columns (beyond Keep / Fix / Try) | The columns are fixed by decision. Keeping them fixed simplifies the data model and UI. |
| Custom agenda items | Only the agenda *times* are editable. |
| Role-based phase control (only the facilitator can advance) | Decision: "anyone can switch". We will revisit this if it causes problems. |
| Integrations (Jira, Slack, export to other tools) | Not needed to validate the core flow. See P2. |
| Grouping / merging similar ideas | Useful but complex. See P2. |

---

## 3. Users & Roles

| Role | How they are identified | Can do |
|---|---|---|
| **Participant** | An anonymous `participantId` (random UUID stored in the browser's `localStorage`) | Pulse check, add/delete own ideas, vote, create/edit action items, switch phases, control the timer |
| **Retro creator / Admin** | Knows the retro's admin password | Everything a participant can do, plus edit agenda times, delete any idea, delete the retro |

There is no global super-admin. Each retro's admin password is set when the retro is created.

---

## 4. Functional Specification

### 4.1 Retro master data
Set when a retro is created:
- **Name** (required, max 80 chars), e.g. "Q4 Planning Retro"
- **Subtitle / goal** (optional, max 140 chars), e.g. "What to keep, fix and try before Q1"
- **Date** (required, defaults to today)
- **Length** in minutes (required; presets 30 / 45 / 60 / 90, default 30)
- **Facilitator name** (required)
- **Enabled phases** (checkboxes, all on by default; at least Brainstorm must stay enabled)
- **Admin password** (required, min 6 chars, entered twice)

After creation the app redirects to `/r/<slug>` and shows a **"Copy link"** button.

**Retro identifier:** a random, unguessable 8-character slug (e.g. `/r/k7f3q9xa`). A random slug is used instead of a sequential retro number so that outsiders cannot enumerate retros. Retros are **link-only** (decision Q1): the link is the only way in.

### 4.2 Phases & agenda

| # | Phase | Default (30 min) | Purpose |
|---|---|---|---|
| 1 | Intro & Pulse Check | 4 min | Set the goal, everyone rates the period 1–5 |
| 2 | Brainstorm | 8 min | Add ideas to Keep / Fix / Try |
| 3 | Vote | 5 min | One vote per person per column |
| 4 | Discuss | 13 min | Discuss the top ideas, turn them into action items |

- **Default for other lengths:** the times are scaled proportionally from the 30-minute template and rounded to whole minutes. Any rounding remainder goes to Discuss.
- Disabled phases are left out of the agenda, and their time is redistributed proportionally to the remaining phases.
- The agenda card shows each phase's **start offset** (0:00, 0:04, …) and its duration, and highlights the current phase.
- **Admin:** only the durations can be edited. The app shows a warning, but does not block saving, if the total differs from the retro length.

**Retro states:** `not_started` → `intro` → `brainstorm` → `vote` → `discuss` → `finished` (disabled phases are skipped).

### 4.3 Phase bar & timer
A sticky bar below the header contains:
- **Phase stepper:** done phases show ✓, the current one is highlighted, and each shows its planned minutes.
- **Countdown** (mm:ss) for the current phase. When it reaches 0:00, it turns red and counts the overtime up (`+01:23`). **It never advances automatically.**
- **Buttons** (available to everyone):
  - `Start <next phase>` ends the current phase and starts the next one with its planned duration
  - `+1 min` extends the current phase
  - `End early` ends the current phase without starting the next one; the timer stops and the bar shows `Start <next phase>`
  - `Reset` sets the retro back to `not_started` but keeps all data (asks for confirmation inline, not in a browser dialog)
- **Sync model:** the server stores `phaseStartedAt` and `phaseDurationSec`, and each client computes the remaining time itself. No server-side ticking is needed, and clients stay in sync up to differences in device clocks. These differences are compensated by a server-time offset measured when the page loads.

### 4.4 Pulse check
- The question reads: *"How well did {retro name} work for you?"*
- Five buttons: 1 Bad · 2 Poor · 3 Okay · 4 Good · 5 Great.
- One answer per `participantId`. Tapping another number changes the answer.
- The results panel shows the **average (1 decimal place)**, **the number of respondents**, and a bar per score with its count. Your own choice is highlighted, and a badge says "You answered 3".
- Answers are **anonymous**: nobody can see who gave which score.
- **[DEFAULT]** You can answer in every phase. The card is visually emphasized during Intro.
- If the Intro phase is disabled, the pulse check card is hidden.

### 4.5 Idea board
- **Three fixed columns:** **Keep** ("What worked well?"), **Fix** ("What got in the way?"), **Try** ("What should we try next?"). Each column header shows its idea count.
- **Adding an idea:** a textarea (max 500 chars) plus an optional **initials** field (max 4 chars, remembered in the browser for next time). Press Enter to submit and Shift+Enter for a new line.
- **Realtime:** new ideas appear for everyone immediately.
- **Order:**
  - before the Vote phase: by creation time (oldest first)
  - from the Vote phase on: by vote count (highest first), with ties broken by creation time; the top idea in each column gets a "Top in Keep" badge
- **Actions on each idea:**
  - `Vote` / `✓ Voted`, enabled only during the Vote phase
  - `Make action`, enabled **only in the Discuss phase** (outside it, the button is shown disabled with the tooltip "Available in the Discuss phase")
  - `Delete`, visible only to the idea's author (same `participantId`) or to an admin
- **[DEFAULT]** You can add ideas in every phase, not only during Brainstorm, because "anyone can switch" makes strict phase locking unhelpful. Outside Brainstorm the input is visually de-emphasized.
- **[DEFAULT]** Editing an idea is not in v1. Delete it and add it again instead.

### 4.6 Voting
- **One vote per person per column** (so at most 3 votes per person).
- Voting for an idea in a column where you already voted **moves** your vote. Tapping `✓ Voted` **takes the vote back**.
- The vote count is visible to everyone. Who voted for what is never shown.
- A header indicator shows your remaining votes: `● ● ○ 1 of 3 votes left`, with one dot per column.
- Voting is **locked outside the Vote phase**. The counts stay visible from the Vote phase onward.
- **[DEFAULT]** You may vote for your own idea.
- If the Vote phase is disabled, the vote counts and vote-based sorting are hidden.

### 4.7 Action items
- A separate card titled "Action items" with a count badge (e.g. "None yet").
- **Creating an action:**
  - `Make action` on an idea, **only during the Discuss phase**: pre-fills the action text with the idea text, scrolls to the action card and focuses the Owner field
  - free text typed directly into the form, **possible in every phase** (including `not_started` and `finished`)
- **[DEFAULT]** If the Discuss phase is disabled for a retro, `Make action` becomes available once the retro is `finished`.
- The server enforces this: `actions.add` with an `ideaId` is rejected unless the retro is in the `discuss` state (or `finished` when Discuss is disabled).
- **Required fields:** text, **owner** (free text), **due date** (date picker, shown as dd.mm.yyyy). `Add action` stays disabled until all three are filled.
- An action created from an idea links back to it: the idea shows an "→ Action" badge, and the action shows "from Fix: …".
- Everyone can edit (inline) and delete actions.
- The list is sorted by due date, then by creation time.

### 4.8 Home page (no public overview)
- **Decision Q1: link-only.** There is no list of all retros anywhere in the app.
- `/` shows:
  - a `New retro` button
  - a "Have a link?" field for pasting a retro URL
  - **"Your recent retros"**: the retros created or opened *in this browser*. Their slugs are stored in `localStorage`, and the app loads their names via `retros.getManyBySlugs`. Deleted retros silently drop out of this list.
- To reopen an old retro on another device, you need its link. The create confirmation and the header's `Copy link` make sharing the link easy.
- **[DEFAULT]** Old retros stay fully editable. There is no lock.

### 4.9 Admin area
- `/r/<slug>/admin` shows a password prompt. On success it creates an admin session for this retro (an HTTP-only cookie storing a token; the token's hash is stored in the database; valid for 12 h).
- Once logged in, the admin can:
  - edit the agenda **phase durations** (number inputs, live total vs. retro length)
  - delete the retro, after typing its name to confirm; this cascades to all ideas, votes, pulse answers and actions
  - use a `New retro` shortcut
- Admin sessions also enable `Delete` on every idea in the board.
- **There is no password recovery.** If the password is lost, the retro can no longer be administered. This is shown clearly in the create form.
- Brute-force protection: after 5 failed attempts per retro within 15 minutes, logins are blocked for 15 minutes.

### 4.10 Layout ("everything on one page")
The retro page is a single vertically scrolling page with no tabs. It follows the general layout of the reference screenshots (coloured header, white cards on a light grey background, rounded buttons) but uses **neutral branding**: no company names, logos or corporate colours. The app has its own neutral name and palette, defined as design tokens so they are easy to change.

```
┌──────────────────────────────────────────────────────────────┐
│ HEADER: Name · Subtitle            Date | Length | Facilitator│
├──────────────────────────────────────────────────────────────┤
│ PHASE BAR (sticky): stepper · timer · Start / +1 / End / Reset│
├───────────────────────────────┬──────────────────────────────┤
│ Agenda (phases + times)       │ Pulse check (buttons + bars) │
├───────────────────────────────┴──────────────────────────────┤
│ Idea board:  Keep │ Fix │ Try          (votes-left indicator) │
├──────────────────────────────────────────────────────────────┤
│ Action items: form + list                                     │
└──────────────────────────────────────────────────────────────┘
```
- Desktop (≥1280 px): as above.
- Tablet: the agenda and the pulse check stack on top of each other, and the board keeps 3 columns.
- Mobile (<768 px): the board shows one column at a time with a segmented control to switch between Keep, Fix and Try. All other content stays on the same page.
- UI language: **[DEFAULT] English** (the reference screenshots are in English). Dates use the `en-GB` format.

---

## 5. Architecture

```
Browser (Next.js client components)
   │  useQuery / useMutation  (WebSocket, managed by Convex client)
   ▼
Convex deployment (US region)
   ├─ queries    → reactive reads (board, pulse, actions, phase state)
   ├─ mutations  → writes with validation (ideas, votes, phase, actions)
   └─ actions    → Node runtime: password hashing (scrypt)
   ▲
Next.js on Vercel (Hobby)
   ├─ static/SSR pages: /, /new, /r/[slug], /r/[slug]/admin
   └─ route handler: /api/admin/session (sets/clears the HTTP-only cookie)
```

**Why Convex:** queries are reactive, so any change to the data pushes to every subscribed client automatically. That covers the realtime requirement without a separate WebSocket or pub/sub service, and Vercel Functions never hold long-lived connections, which keeps the setup within Hobby limits.

**Key decisions**
| Topic | Decision |
|---|---|
| Rendering | The retro page is a client component tree under a `ConvexClientProvider`. The home and create pages may use server rendering via `fetchQuery`. |
| Identity | `participantId` = `crypto.randomUUID()` stored in `localStorage` and sent as an argument with every mutation. The server treats it as a pseudonymous key, not as authentication. |
| Admin auth | The password is hashed with Node `crypto.scrypt` in a Convex action (random salt per retro). Login creates a random 32-byte token; only its SHA-256 hash is stored in `adminSessions`. The token lives in an HTTP-only cookie and is passed to admin mutations by a Next.js route handler / server action. It is never readable by JavaScript in the browser. |
| Timer | The server stores timestamps only. Clients compute the countdown, using the server-time offset from the `serverNow` action (queries must not read the wall clock). |
| Optimistic UI | Votes, pulse answers and new ideas use Convex optimistic updates so they feel instant. |
| Validation | Every mutation validates its arguments with Convex `v` validators and enforces length limits, enum values and phase rules on the server. |
| Region | **US (aws-us-east-1)**. Decided in M0: EU carries a 30 % surcharge and is not fully covered by the free plan; acceptable for private use. |

---

## 6. Data Model (Convex schema)

```ts
// convex/schema.ts (sketch)
retros: defineTable({
  slug: v.string(),                 // 8-char random, unique
  name: v.string(),
  subtitle: v.optional(v.string()),
  date: v.string(),                 // ISO date "2026-10-28"
  lengthMin: v.number(),
  facilitator: v.string(),
  enabledPhases: v.array(v.union(v.literal("intro"), v.literal("brainstorm"),
                                 v.literal("vote"), v.literal("discuss"))),
  agenda: v.object({ intro: v.number(), brainstorm: v.number(),
                     vote: v.number(), discuss: v.number() }), // minutes
  state: v.union(v.literal("not_started"), v.literal("intro"), v.literal("brainstorm"),
                 v.literal("vote"), v.literal("discuss"), v.literal("finished")),
  phaseStartedAt: v.optional(v.number()),   // ms epoch; undefined = timer stopped
  phaseDurationSec: v.optional(v.number()), // incl. "+1 min" extensions
  passwordHash: v.string(),
  passwordSalt: v.string(),
}).index("by_slug", ["slug"]).index("by_date", ["date"]),

pulseAnswers: defineTable({
  retroId: v.id("retros"), participantId: v.string(), score: v.number(), // 1..5
}).index("by_retro_participant", ["retroId", "participantId"]),

ideas: defineTable({
  retroId: v.id("retros"),
  column: v.union(v.literal("keep"), v.literal("fix"), v.literal("try")),
  text: v.string(), initials: v.optional(v.string()),
  authorId: v.string(),              // participantId, never exposed to other clients
  voteCount: v.number(),             // denormalized for sorting
}).index("by_retro", ["retroId"]),

votes: defineTable({
  retroId: v.id("retros"), ideaId: v.id("ideas"),
  column: v.union(v.literal("keep"), v.literal("fix"), v.literal("try")),
  participantId: v.string(),
}).index("by_retro_participant_column", ["retroId", "participantId", "column"])
  .index("by_idea", ["ideaId"]),

actions: defineTable({
  retroId: v.id("retros"), ideaId: v.optional(v.id("ideas")),
  text: v.string(), owner: v.string(), dueDate: v.string(),
}).index("by_retro", ["retroId"]),

adminSessions: defineTable({
  retroId: v.id("retros"), tokenHash: v.string(), expiresAt: v.number(),
}).index("by_token", ["tokenHash"]),

loginAttempts: defineTable({
  retroId: v.id("retros"), at: v.number(), success: v.boolean(),
}).index("by_retro_time", ["retroId", "at"]),
```

**Privacy rules in queries:** `authorId` and `participantId` are never returned to clients. Instead each idea returns `isMine: boolean` and `votedByMe: boolean`, computed from the `participantId` argument. Pulse answers are returned only as aggregates plus the caller's own score.

**Vote integrity:** `castVote(ideaId, participantId)` runs in a single transactional mutation. It looks up the caller's existing vote in that column, then deletes it, moves it, or inserts a new one, and updates `voteCount` on the affected ideas. Because Convex mutations are serializable transactions, two people voting at the same moment cannot corrupt the counts.

---

## 7. Convex Function Inventory

| File | Function | Type | Notes |
|---|---|---|---|
| `retros.ts` | `getManyBySlugs` | query | "Your recent retros" on the home page (max. 50 slugs, no secrets) |
| | `getBySlug` | query | Master data + phase state (no hash) |
| | `create` | action → internal mutation | Hashes the password, generates the slug and the default agenda |
| | `updateAgenda` | mutation | Admin token required |
| | `remove` | mutation | Admin token; cascades in batches |
| `phase.ts` | `startNext`, `extend`, `endEarly`, `reset` | mutation | Open to everyone; each validates the state transition |
| | `serverNow` | action | Clock offset for the timer (queries must not read the wall clock) |
| `pulse.ts` | `summary` | query | Average, counts, the caller's own score |
| | `answer` | mutation | Upsert per participant, score 1..5 |
| `ideas.ts` | `listByRetro` | query | Sorting depends on state; returns `isMine` / `votedByMe` |
| | `add`, `remove` | mutation | Length limits; `remove` requires the author or an admin |
| `votes.ts` | `toggle` | mutation | Only in the `vote` state; one per column |
| `actions.ts` | `list`, `add`, `update`, `remove` | query / mutation | Owner and due date required; `add` with `ideaId` only in Discuss |
| `admin.ts` | `login` | action | scrypt verify, rate limit, issues the token |
| | `logout`, `validate` | mutation / query | |
| `crons.ts` | `purgeExpiredSessions` | cron (daily) | Cleans up sessions and login attempts |

---

## 8. Project Structure

```
retro-meeting/
├─ app/
│  ├─ layout.tsx                 # fonts, ConvexClientProvider, theme
│  ├─ page.tsx                   # retro overview
│  ├─ new/page.tsx               # create form
│  ├─ r/[slug]/page.tsx          # the retro (single page)
│  ├─ r/[slug]/admin/page.tsx    # admin login + settings
│  └─ api/admin/session/route.ts # set/clear admin cookie
├─ components/
│  ├─ retro/Header.tsx  PhaseBar.tsx  Timer.tsx  Agenda.tsx
│  ├─ retro/PulseCheck.tsx  IdeaBoard.tsx  IdeaColumn.tsx  IdeaCard.tsx
│  ├─ retro/VotesLeft.tsx  ActionItems.tsx
│  └─ ui/                        # shadcn/ui primitives
├─ convex/
│  ├─ schema.ts  retros.ts  phase.ts  pulse.ts  ideas.ts  votes.ts
│  ├─ actions.ts  admin.ts  crons.ts
│  └─ lib/ agenda.ts  validation.ts  auth.ts
├─ lib/ participant.ts  useServerClock.ts  format.ts
├─ tests/ unit/  convex/  e2e/
├─ .github/workflows/ci.yml
└─ IMPLEMENTATION_PLAN.md
```

---

## 9. Build Sequence (Milestones)

The estimates assume one developer working with an AI pair. Each milestone ends with a deployable state on Vercel.

### M0 — Setup (0.5 day) ✅ v0.1
- [x] Create the GitHub repo and run `create-next-app` (TypeScript, Tailwind, App Router, ESLint)
- [x] Initialize shadcn/ui; set neutral design tokens (primary colour, card radius, font), with no corporate branding
- [x] Create a Vercel project linked to the GitHub repo
- [x] Install **Convex via the Vercel Marketplace** (`vercel integration add convex`, free plan, US region), and pull the env vars (`vercel env pull`)
- [x] Set the build command to `npx convex deploy --cmd 'next build'`
- [x] Add a CI workflow (lint, typecheck, unit tests) for pull requests
- **Done when:** a "hello" page reading from Convex is live on `*.vercel.app`.

### M0.5 — Test infrastructure (0.5 day) ✅ v0.2
- [x] Vitest with two projects: `convex` (edge-runtime + `convex-test`) and `web` (jsdom + Testing Library)
- [x] Coverage gate (v8): `convex/**` ≥ 90 % lines/functions/statements (85 % branches), `lib/**` ≥ 80 % (75 % branches); CI fails below it, and the summary is shown in the GitHub run
- [x] Playwright (desktop + mobile) with a smoke test; locally it starts `npm run dev`
- [x] E2E workflow runs against every successful **production** deployment (previews are behind Vercel Authentication; enabling them needs a protection-bypass secret → later)
- [x] Convex AI guidelines installed (`convex/_generated/ai/guidelines.md`); the health query no longer reads the wall clock (guideline: no `Date.now()` in queries)
- **Rule from here on:** every milestone ships with its tests; new Convex functions without tests fail the coverage gate.

### M1 — Retro lifecycle (1 day)
- [ ] Schema, `retros.create` (slug, scrypt hash, default agenda calculation), `getBySlug`, `getManyBySlugs`
- [ ] `/new` form with validation; `/` home with "recent retros" from `localStorage`; `/r/[slug]` header + "Copy link"
- [ ] Unit tests for agenda scaling and redistribution across disabled phases
- **Done when:** I can create a retro, open it from its link, and find it again under "recent retros" in the same browser.

### M2 — Phases & timer (1 day)
- [ ] Phase state machine (`startNext`, `extend`, `endEarly`, `reset`) with transition tests
- [ ] `serverNow` action + `useServerClock` hook; `Timer` with overtime display
- [ ] `PhaseBar` stepper and `Agenda` card with the current-phase highlight
- **Done when:** two browsers show the same countdown (±1 s), and either one can advance the phase.

### M3 — Pulse check (0.5 day)
- [ ] `participantId` helper; `pulse.answer` / `pulse.summary`
- [ ] Pulse card with result bars and the "You answered" badge; optimistic update
- **Done when:** the average and distribution update live across browsers, and changing an answer does not double-count.

### M4 — Idea board (1.5 days)
- [ ] `ideas.add/remove/listByRetro` with `isMine`; initials remembered in `localStorage`
- [ ] Three columns, Enter to submit, counts, and the empty state per column
- [ ] Mobile column switcher
- **Done when:** ideas from 3+ browsers appear live in creation order, and only the author or an admin sees Delete.

### M5 — Voting (1 day)
- [ ] `votes.toggle` (cast, move, retract) with a transactional `voteCount`
- [ ] Phase-dependent sorting, the "Top in …" badge, the votes-left indicator
- [ ] Concurrency test: 20 parallel votes produce correct counts
- **Done when:** each person has at most one vote per column, can change it, and the columns re-sort live.

### M6 — Action items (1 day)
- [ ] CRUD; the `Make action` pre-fill, scroll and focus (Discuss phase only, enforced server-side); the idea ↔ action link badges
- [ ] Date picker, required-field validation, sorting by due date
- **Done when:** an action can be created from an idea during Discuss and as free text in any phase, and all actions show an owner and a due date.

### M7 — Admin area (1 day)
- [ ] `admin.login` (scrypt verify, rate limit), the cookie route handler, `validate`
- [ ] Agenda duration editor with the live total; delete the retro with typed confirmation (cascade)
- [ ] The admin's Delete on any idea
- **Done when:** a wrong password is rejected and locked out after 5 attempts, and a deleted retro disappears everywhere it is open in real time.

### M8 — Polish, QA & launch (1.5 days)
- [ ] Responsive pass, keyboard navigation, focus states, ARIA labels on vote and score buttons
- [ ] Empty, loading and error states (unknown slug → 404 page; Convex disconnected → banner)
- [ ] Playwright E2E: a full retro with 3 browser contexts running through all phases
- [ ] Load test with 30 simulated participants; check Convex free-tier usage
- [ ] Short README (local dev, deploy, env vars)
- **Done when:** the acceptance checklist in §10 passes on production.

**Total: about 9.5 working days.**

---

## 10. Acceptance Checklist (release gate)

- [ ] A retro can be created with all master data and opened via its link without logging in
- [ ] There is no public list of retros; retros created or opened in this browser appear under "recent retros" on `/`
- [ ] Disabled phases do not appear in the stepper, the agenda or the UI
- [ ] The phase timer is in sync across clients (±1 s); `+1 min`, `End early` and `Reset` work for everyone
- [ ] Pulse check: one answer per browser, changeable, anonymous, with a correct average
- [ ] Ideas appear live for everyone in creation order; initials are optional
- [ ] Voting only during the Vote phase; max. one vote per column per person; changeable; columns sort by votes
- [ ] `Make action` on ideas works only in the Discuss phase; free-text actions are possible in every phase; owner and due date are required
- [ ] The admin password is required for agenda edits and deletion; brute-force lockout works
- [ ] No `participantId`, `authorId` or password hash is ever returned to the client (verified in the network tab)
- [ ] The page works at 375 px width and at 1440 px

---

## 11. Testing Strategy

| Level | Tool | Covers |
|---|---|---|
| Unit | Vitest | Agenda scaling, timer math, sorting, validation helpers |
| Backend | `convex-test` + Vitest | State machine, vote rules, privacy of query outputs, cascade delete, rate limiting |
| E2E | Playwright (multiple browser contexts) | The realtime flow across participants, mobile layout |
| Manual | 2–3 people in a real test retro | Usability, timing, perceived latency |

CI runs lint, typecheck, unit and backend tests on every pull request. E2E tests run against the Vercel preview URL.

---

## 12. Open Questions

| # | Question | Owner | Blocking? |
|---|---|---|---|
| ~~Q1~~ | ~~Public overview vs. private links~~. **Decided: link-only**, with "recent retros" per browser (§4.8). | — | Resolved |
| ~~Q2~~ | ~~Vercel Hobby for non-commercial use only~~. **Decided: private use only**, so the Hobby plan is fine. | — | Resolved |
| Q3 | Can a retro be **locked** (read-only) after it finishes, or is it always editable (current default)? | Andreas | No |
| Q4 | UI language: English only (default), German, or switchable? | Andreas | No |
| Q5 | Can people add ideas outside the Brainstorm phase (default: yes)? | Andreas | No |
| Q6 | Should open action items carry over into the next retro of the same team? This needs a notion of a "team" or "series" → P2. | Andreas | No |
| Q7 | Convex free tier: check the current limits (function calls, bandwidth) and whether inactive free deployments get paused. Check whether preview deployments are available on the free plan. | Engineering | Yes, during M0 |
| Q8 | GDPR: the data is stored in the US region (private use). Is a short privacy notice still wanted? | Andreas | No |

---

## 13. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Hobby plan terms | The account could be suspended if usage becomes commercial | Usage is private (Q2). If that changes, move to Pro; the code works unchanged |
| A lost link means a lost retro on other devices | Old retros are hard to find again | "Recent retros" per browser; prominent `Copy link`; P1: export with link |
| Vote manipulation (new browser = new identity) | Skewed votes | Acceptable for internal trust-based use; P2: an optional name prompt or one link per participant |
| "Anyone can switch phase" leads to accidental skips | Confusion during the meeting | The stepper shows who switched in a toast ("Phase changed to Vote"); `Reset` exists; P1: an optional facilitator lock |
| Lost admin password | Retro cannot be deleted | Clear warning at creation; P1: an optional recovery code shown once |
| Free-tier limits exceeded | App stops working | Load test in M8; queries return only the fields they need; no polling |
| Device clock drift | Different timer values | Server-time offset from `serverNow` |

---

## 14. Future Considerations (P1 / P2)

**P1 (fast follow)**
- Optional facilitator lock for the phase controls
- Mark action items as done; show open actions of previous retros
- Export a retro as Markdown or PDF (e.g. for Obsidian or Confluence)
- Recovery code for the admin password
- Edit your own idea

**P2 (design for, don't build)**
- Team / series concept: retros grouped by team, with action items carried over
- Configurable columns and agenda items (the schema keeps `column` as an enum that is easy to widen)
- Grouping or merging similar ideas
- Jira / Linear export of action items
- SSO for enterprise use

---

## 15. Versioning

- Versions are `MAJOR.MINOR`, starting at **0.1**; the version is shown in the app footer.
- **Every push bumps the minor version**: `npm run release` bumps `package.json`, commits, tags `vX.Y` and pushes. A pre-push hook (`scripts/hooks/pre-push`) blocks any push whose HEAD is not tagged with the current version.
- **Major versions only on the owner's explicit instruction** (`npm run release -- --major`).

## 15b. Success Metrics

| Metric | Type | Target | Measurement |
|---|---|---|---|
| Time to create and share a retro | Leading | < 2 min (median) | Manual test with 3 facilitators |
| Share of participants who submit ≥1 idea | Leading | ≥ 80 % | `ideas` grouped by `authorId` vs. pulse respondents |
| Realtime latency (idea visible to others) | Leading | p95 < 1 s | Playwright timing in E2E |
| Retros ending with ≥1 action item that has an owner and a due date | Lagging | ≥ 90 % | `actions` per retro |
| Repeat usage (teams running a 2nd retro within 6 weeks) | Lagging | ≥ 60 % | Retro list by facilitator name |

---

## 16. Clickable Prototype

**File:** [`mockups/prototype.html`](mockups/prototype.html). Open it directly in a browser; it needs no build or server.

It is a single self-contained HTML file. All data is simulated in memory, and nothing is saved. Use the dark bar at the top to jump between views:

| View | What you can try |
|---|---|
| **Home** | "Your recent retros" (this browser), the "Have a link?" field, `New retro` |
| **New retro** | All master-data fields, length presets, phase toggles with a live agenda preview, password validation. `Create retro` opens a fresh, empty retro |
| **Retro** | The phase stepper and live timer (`Start <next>`, `+1 min`, `End early`, inline `Reset` confirmation), the agenda highlight, the pulse check with live results, adding ideas with initials (Enter), voting (only in the Vote phase, one vote per column, move or retract), ranking and the "Top in …" badge, `Make action` (Discuss phase only) → a pre-filled form, free-text actions in every phase, action items with owner and due date, the mobile column switcher (< 768 px) |
| **Admin login** | Any password works, except `wrong`, which fails; 5 failures trigger the lockout |
| **Admin** | Edit agenda durations with the live total and a deviation warning, typed-name confirmation for deleting, log out. While logged in, the retro view shows an "Admin" badge and `Delete` on every idea |
| **▶ Simulate others** | Adds pulse answers, ideas or votes from "other participants" every 2 s, depending on the current phase, to show the realtime behaviour |

The visual style is neutral (indigo primary, no company branding). It follows the card layout of the reference screenshots.
