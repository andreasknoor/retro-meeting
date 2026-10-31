# Retro Meeting App — Implementation Plan

**Status:** ✅ Released as **v1.0** on 2026-10-30, current **v1.9** (M0–M8 done, acceptance checklist passed on production) · **Plan date:** 2026-10-29 · **Author:** Andreas Knoor (with Claude)

> Nothing has been implemented yet. This document defines scope, architecture, data model and the build sequence. Items marked **[DEFAULT]** are assumptions I made where no decision exists yet. Please confirm or correct them (they are also listed in §12 Open Questions).

---

## 1. Summary

A lightweight web app for running team retrospectives with many participants in real time. Anyone can create a retro and share it via a link, and participants join without logging in. A retro runs through up to four phases: **Intro & Pulse Check → Brainstorm → Vote → Discuss & Act**. A synchronized phase timer guides the group. Ideas, votes and action items appear live for everyone, and the whole retro lives on a single page. Past retros stay accessible. A small admin area, protected by a password set per retro, lets you change agenda times and delete retros.

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
| Integrations (Jira, Slack, export to other tools) | Not needed to validate the core flow. See P2. |
| Grouping / merging similar ideas | Useful but complex. See P2. |

---

## 3. Users & Roles

| Role | How they are identified | Can do |
|---|---|---|
| **Participant** | An anonymous `participantId` (random UUID stored in the browser's `localStorage`) | Pulse check, add/delete own ideas, vote, create/edit action items and delete their own; switch phases and control the timer only if the retro allows everyone to |
| **Retro creator / Admin** | Knows the retro's admin password; the creator is logged in automatically | Everything a participant can do, plus switch phases (always), edit agenda times and phase control, delete any idea, delete the retro |

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
- **Only the admin can switch phases** (checkbox, **on by default**; decision v0.11, replaces B.5 "anyone can switch"). Off = everyone with the link controls phases and the timer
- **Admin password** (required, min 6 chars, entered twice). The repeat field is re-checked on every keystroke (in either field); as soon as both entries are identical, a green check mark appears next to the repeat field

After creation the app redirects to `/r/<slug>` and shows a **"Copy link"** button. The creator is **logged in as admin automatically** (session cookie set by the create server action), since they just chose the password.

**Retro identifier:** a random, unguessable 12-character slug (e.g. `/r/k7f3q9xa2m4p`; 8 characters before v1.3, those links stay valid). A random slug is used instead of a sequential retro number so that outsiders cannot enumerate retros. Retros are **link-only** (decision Q1): the link is the only way in.

### 4.2 Phases & agenda

| # | Phase | Default (30 min) | Purpose |
|---|---|---|---|
| 1 | Intro & Pulse Check | 4 min | Set the goal, everyone rates the period 1–5 |
| 2 | Brainstorm | 8 min | Add ideas to Keep / Fix / Try |
| 3 | Vote | 5 min | One vote per person per column |
| 4 | Discuss & Act | 13 min | Discuss the top ideas, turn them into action items |

- **Default for other lengths:** the times are scaled proportionally from the 30-minute template and rounded to whole minutes. Any rounding remainder goes to Discuss & Act.
- Disabled phases are left out of the agenda, and their time is redistributed proportionally to the remaining phases.
- The agenda card shows each phase's **start offset** (0:00, 0:04, …) and its duration, and highlights the current phase.
- **Admin:** only the durations can be edited. The app shows a warning, but does not block saving, if the total differs from the retro length.

**Retro states:** `not_started` → `intro` → `brainstorm` → `vote` → `discuss` → `finished` (disabled phases are skipped).

### 4.3 Phase bar & timer
A sticky bar below the header contains:
- **Phase stepper:** done phases show ✓, the current one is highlighted, and each shows its planned minutes.
- **Focus card (v1.1):** the card people work in during the current phase gets a ring: the pulse check in Intro, the idea board in Brainstorm and Vote, the action items in Discuss & Act. Exactly one card at a time; none before the start or after the end.
- **Countdown** (mm:ss) for the current phase. When it reaches 0:00, it turns red and counts the overtime up (`+01:23`). **It never advances automatically.**
- **Buttons** (only for the admin by default; for everyone if the retro allows it — see §4.1):
  - `← Back` returns to the previous enabled phase (from Finished to the last phase); disabled before the start and in the first phase. **[DEFAULT]** The earlier phase restarts with its full planned duration. Ideas, pulse answers and actions are kept; going back to Vote reopens voting with the votes kept. **Going back before the Vote phase deletes all votes** (decision after v0.12): if there are votes, an inline warning ("Going back to Brainstorm deletes all votes.") must be confirmed first; the server refuses without that confirmation
  - `Start <next phase>` ends the current phase and starts the next one with its planned duration
  - `+1 min` extends the current phase
  - `Pause` / `Resume` (v1.7, replaced `End early`): Pause stops the timer and keeps the remaining time (`Paused 03:12`, negative in overtime); Resume continues from it. `+1 min` also works while paused. Timers stopped with the old `End early` count as paused at 00:00
  - `Reset` sets the retro back to `not_started` (asks for confirmation inline, not in a browser dialog). Ideas, pulse answers and actions stay; **votes are deleted** since v1.7, like going back before Vote, and the confirmation says so when there are any
- **Locked for participants:** they see the timer and the stepper, plus the hint "Only the admin can switch phases." (v1.5; before: "The facilitator controls the phases.") and a **"Log in to control"** button that opens an inline password field (same login, lockout and session as the admin area). The server rejects phase mutations without a valid admin session ("Only the admin can switch phases.").
- **Presence (v1.6):** next to the timer, "N online" counts the people (browsers, not tabs) that have the retro open, via `@convex-dev/presence` (heartbeat every 10 s; a closed tab leaves at once, a lost connection after about 25 s). During Intro it adds how many have answered the pulse check, during Vote how many have voted.
- **Sync model:** the server stores `phaseStartedAt` and `phaseDurationSec`, and each client computes the remaining time itself. No server-side ticking is needed, and clients stay in sync up to differences in device clocks. These differences are compensated by a server-time offset measured when the page loads.

### 4.4 Pulse check
- The question reads: *"How did the time since the last retro go for you?"* (v1.5; it used to ask about the retro itself)
- Five buttons: 1 Bad · 2 Poor · 3 Okay · 4 Good · 5 Great.
- One answer per `participantId`. Tapping another number changes the answer.
- The results panel shows the **average (1 decimal place)**, **the number of respondents**, and a bar per score with its count. Your own choice is highlighted, and a badge says "You answered 3".
- Answers are **anonymous**: nobody can see who gave which score.
- **v1.5:** until you answer (or the Intro phase is over), the panel shows only how many have answered; average and distribution are not even sent, so they cannot anchor your answer.
- **[DEFAULT]** You can answer in every phase. The card is visually emphasized during Intro.
- If the Intro phase is disabled, the pulse check card is hidden.

### 4.5 Idea board
- **Three fixed columns:** **Keep** ("What worked well?"), **Fix** ("What got in the way?"), **Try** ("What should we try next?"). Each column header shows its idea count.
- **Adding an idea:** a textarea (max 500 chars) plus an optional **initials** field (max 4 chars, remembered in the browser for next time). Press Enter to submit and Shift+Enter for a new line.
- **Realtime:** new ideas appear for everyone immediately.
- **Order:**
  - before the Vote phase: by creation time (oldest first)
  - after the Vote phase (v1.7; before: from the Vote phase on): by vote count (highest first), with ties broken by creation time; the top idea in each column gets a "Top in Keep" badge
- **Actions on each idea:**
  - `Vote` / `✓ Voted`, shown only during the Vote phase; afterwards the count, with "· incl. yours" on your own votes
  - `Make action`, shown **only in the Discuss phase** (v1.7: hidden instead of disabled with a tooltip; the board hint explains it). On an idea that already has an action it reads `+ Another action`, and the form names the existing action(s)
  - `Delete`, visible only to the idea's author (same `participantId`) or to an admin, after an inline confirmation (v1.7) that warns when votes would be lost
- **[DEFAULT]** You can add ideas in every phase, not only during Brainstorm, because "anyone can switch" makes strict phase locking unhelpful. Outside Brainstorm the input is visually de-emphasized.
- **[DEFAULT]** Editing an idea is not in v1. Delete it and add it again instead.
- **Finished (v1.7):** the board and the pulse check are read-only (server-enforced: `ideas.add`, the author's `ideas.remove`, `pulse.answer`). The admin can still delete ideas; actions stay editable and can be ticked off. A note says so and that `Back` reopens the retro.

### 4.6 Voting
- **One vote per person per column** (so at most 3 votes per person).
- Voting for an idea in a column where you already voted **moves** your vote. Tapping `✓ Voted` **takes the vote back**.
- **v1.7:** vote counts stay hidden during the Vote phase (the server sends 0, only `votedByMe` is real), so late voters cannot follow the trend; they show once the phase is over. Who voted for what is never shown. The phase bar shows how many have voted (`votes.voterCount`).
- A header indicator shows your remaining votes: `● ● ○ 1 of 3 votes left`, with one dot per column.
- Voting is **locked outside the Vote phase**. The counts stay visible after it.
- **[DEFAULT]** You may vote for your own idea.
- If the Vote phase is disabled, the vote counts and vote-based sorting are hidden.

### 4.7 Action items
- A separate card titled "Action items" with a count badge (e.g. "None yet").
- **Creating an action:**
  - `Make action` on an idea, **only during the Discuss phase**: pre-fills the action text with the idea text, scrolls to the action card and focuses the Owner field
  - free text typed directly into the form, **possible in every phase** (including `not_started` and `finished`)
- **[DEFAULT]** If the Discuss phase is disabled for a retro, `Make action` becomes available once the retro is `finished`.
- The server enforces this: `actions.add` with an `ideaId` is rejected unless the retro is in the `discuss` state (or `finished` when Discuss is disabled).
- **Required fields:** text and **owner** (free text). The **due date** (date picker, shown as dd.mm.yyyy) is optional since v1.5 and cannot be in the past (an existing overdue date may stay when editing). `Add action` stays disabled until text and owner are filled.
- An action created from an idea links back to it: the idea shows an "→ Action" badge, and the action shows "from Fix: …".
- Everyone can edit actions (inline); only the participant who added an action, or the admin, can delete it (v1.3), after an inline confirmation (v1.5).
- The list is sorted by due date, then by creation time; actions without a due date come last.
- **Done (v1.7):** a checkbox per action ticks it off for everyone (`actions.setDone`, like editing); done actions are struck through.

### 4.7b Summary (v1.7)
- In the `finished` state a "Summary" card at the top shows the pulse average, the top 3 ideas per column with votes and all actions with owner, due date and status.
- `Copy as Markdown`, `Download .md` (`YYYY-MM-DD-<name>.md`) and `Print / PDF` (a print stylesheet prints only the card). The Markdown (all ideas by votes, pulse distribution, actions as `- [x]` checklist) comes from `lib/summary.ts`, built in the browser from the queries already loaded.
- **v1.6:** each participant can add at most 20 actions per retro (checked per author, like ideas, so simultaneous adds don't conflict). The list shows at most 200 and says so when there are more.

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
  - switch **who controls the phases** (only the admin / everyone)
  - edit the agenda **phase durations** (number inputs, live total vs. retro length)
  - delete the retro, after typing its name to confirm; this cascades to all ideas, votes, pulse answers and actions
  - use a `New retro` shortcut
- Admin sessions also enable `Delete` on every idea in the board.
- **There is no password recovery.** If the password is lost, the retro can no longer be administered. This is shown clearly in the create form.
- Brute-force protection (v1.7): after 3 failed attempts in a row per retro (within 15 minutes, since the last success), each further attempt waits 10 s, 20 s, 40 s, … up to 2 minutes. Before v1.7, 5 failures locked the login for 15 minutes, which let anyone with the link lock the admin out.

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
  slug: v.string(),                 // 12-char random (8 before v1.3), unique
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
  voteCount: v.optional(v.number()), // unused since v0.14; counts come from `votes`
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

**Vote integrity:** `votes.toggle` reads and writes only the caller's own vote row for that column (cast, move or take back), so people voting at the same time never touch the same documents. Vote counts are computed in `ideas.list` from the `votes` table instead of a counter on the idea (changed in v0.14 after the load test showed write contention on hot ideas). `ideas.add` caps ideas per participant (30) instead of per retro for the same reason, and since v1.6 `actions.add` caps actions per participant (20).

**Presence (v1.6):** heartbeats go to the `@convex-dev/presence` component and touch only the caller's own session row. `presence.list` replaces participant ids with positions before returning, so the room list reveals nobody's id. Deleting a retro removes its room.

---

## 7. Convex Function Inventory

| File | Function | Type | Notes |
|---|---|---|---|
| `retros.ts` | `getManyBySlugs` | query | "Your recent retros" on the home page (max. 50 slugs, no secrets) |
| | `getBySlug` | query | Master data + phase state (no hash) |
| | `create` | action → internal mutation | Hashes the password, generates the slug and the default agenda |
| | `updateAgenda` | mutation | Admin token required |
| | `remove` | mutation | Admin token; cascades in batches |
| `phase.ts` | `startNext`, `back`, `extend`, `pause`, `resume`, `reset` | mutation | Each takes the seen state (`from`); `back` / `reset` need `discardVotes` when votes would be deleted (`endEarly` replaced in v1.7) |
| | `serverNow` | action | Clock offset for the timer (queries must not read the wall clock) |
| `pulse.ts` | `summary` | query | Average, counts, the caller's own score |
| | `answer` | mutation | Upsert per participant, score 1..5 |
| `ideas.ts` | `listByRetro` | query | Sorting depends on state; returns `isMine` / `votedByMe` |
| | `add`, `remove` | mutation | Length limits; `remove` requires the author or an admin |
| `votes.ts` | `toggle` | mutation | Only in the `vote` state; one per column |
| | `voterCount` | query | Number of people who have voted (v1.6) |
| `presence.ts` | `heartbeat`, `list`, `disconnect` | mutation / query | Wraps `@convex-dev/presence`; room = retro, user = participant (v1.6) |
| `actions.ts` | `list`, `add`, `update`, `setDone`, `remove` | query / mutation | Owner required, due date optional and not in the past; `add` with `ideaId` only in Discuss |
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
- [x] E2E workflow runs after every successful **production** deployment, triggered by Vercel's commit status (Vercel creates no GitHub deployments, so `deployment_status` never fires). Previews are behind Vercel Authentication; enabling them needs a protection-bypass secret → later
- [x] E2E retros in production are named `E2E <timestamp>`; they will be cleaned up once deletion exists (M7)
- [x] Convex AI guidelines installed (`convex/_generated/ai/guidelines.md`); the health query no longer reads the wall clock (guideline: no `Date.now()` in queries)
- **Rule from here on:** every milestone ships with its tests; new Convex functions without tests fail the coverage gate.

### M1 — Retro lifecycle (1 day) ✅ v0.3
- [x] Schema, `retros.create` (slug, scrypt hash, default agenda calculation), `getBySlug`, `getManyBySlugs`
- [x] `/new` form with validation; `/` home with "recent retros" from `localStorage`; `/r/[slug]` header + "Copy link"
- [x] Unit tests for agenda scaling and redistribution across disabled phases
- [x] Component tests (form, recent list, link field, retro page) and E2E: create → open as a second participant → recent list → paste link; validation; not found
- **Done when:** I can create a retro, open it from its link, and find it again under "recent retros" in the same browser.

### M2 — Phases & timer (1 day) ✅ v0.4
- [x] Phase state machine (`startNext`, `extend`, `endEarly`, `reset`) with transition tests
- [x] `serverNow` action + `useServerClock` hook; `Timer` with overtime display
- [x] `PhaseBar` stepper and `Agenda` card with the current-phase highlight
- [x] Stale clicks are ignored: every phase mutation carries the state the caller saw (`from`), so two people clicking "Start next" at once advance only one phase
- [x] On mobile the phase bar is not sticky and the stepper scrolls horizontally
- **Done when:** two browsers show the same countdown (±1 s), and either one can advance the phase.

### M3 — Pulse check (0.5 day) ✅ v0.5
- [x] `participantId` helper; `pulse.answer` / `pulse.summary`
- [x] Pulse card with result bars and the "You answered" badge; optimistic update
- **Done when:** the average and distribution update live across browsers, and changing an answer does not double-count.

### M4 — Idea board (1.5 days) ✅ v0.6
- [x] `ideas.add/remove/listByRetro` with `isMine`; initials remembered in `localStorage`
- [x] Three columns, Enter to submit, counts, and the empty state per column
- [x] Mobile column switcher
- **Done when:** ideas from 3+ browsers appear live in creation order, and only the author or an admin sees Delete.

### M5 — Voting (1 day) ✅ v0.7
- [x] `votes.toggle` (cast, move, retract) with a transactional `voteCount`
- [x] Phase-dependent sorting, the "Top in …" badge, the votes-left indicator
- [x] Concurrency test: 20 parallel votes produce correct counts
- **Done when:** each person has at most one vote per column, can change it, and the columns re-sort live.

### M6 — Action items (1 day) ✅ v0.8
- [x] CRUD; the `Make action` pre-fill, scroll and focus (Discuss phase only, enforced server-side); the idea ↔ action link badges
- [x] Date picker, required-field validation, sorting by due date
- [x] Inline editing and deletion of actions; deleting an idea keeps its action and only drops the link
- **Done when:** an action can be created from an idea during Discuss and as free text in any phase, and all actions show an owner and a due date.

### M7 — Admin area (1 day) ✅ v0.9
- [x] `admin.login` (scrypt verify, rate limit), the cookie route handler, `validate`
- [x] Agenda duration editor with the live total; delete the retro with typed confirmation (cascade)
- [x] The admin's Delete on any idea
- [x] Login attempts are recorded as failures *before* the password check, in the same transaction as the lockout count, so parallel attempts cannot bypass the 5-attempt limit
- [x] Admin operations run through Next.js server actions (`app/actions/admin.ts`), which read the HTTP-only cookie; the token never reaches browser JavaScript
- [x] Deleting a retro removes the retro document first (all open pages switch to "not found" live) and purges the rest in scheduled batches; a daily cron removes expired sessions and day-old login attempts
- [x] E2E tests delete every retro they create (fixture `newRetro`), so runs against production leave no data behind
- **Done when:** a wrong password is rejected and locked out after 5 attempts, and a deleted retro disappears everywhere it is open in real time.

### M7.5 — Admin-only phase control (0.5 day) ✅ v0.11
- [x] Per-retro setting `adminControlsPhases` (create form checkbox, default on; switch in the admin area). Retros created before v0.11 keep "anyone may switch"
- [x] Phase mutations require a valid admin session when the setting is on; they are called through a server action that reads the session cookie
- [x] Auto-login: creating a retro runs through a server action that also opens the creator's admin session (same transaction as the retro) and sets the cookie
- [x] Phase bar for participants: hint + inline admin login
- [x] Tests: backend lock and auto-login, server actions, components, E2E (admin mode with inline takeover, open mode)

### M7.6 — Phase "Back" (0.25 day) ✅ v0.12
- [x] `phase.back` with the same admin lock and stale-click guard (`from`) as the other phase controls
- [x] `← Back` button in the phase bar (label "Back to <phase>")
- [x] Tests: state helper, backend (disabled phases, finished, votes kept and voting reopened), component, E2E
- [x] v0.13: going back before Vote deletes all votes after an inline warning (only shown when votes exist); `retros.getBySlug` returns `hasVotes` (v1.5: derived on the client from `ideas.list` instead, so `getBySlug` no longer re-runs on votes)

### M8 — Polish, QA & launch (1.5 days) ✅ v0.14–v0.15, launched as v1.0
- [x] Responsive pass, keyboard navigation, focus states, ARIA labels on vote and score buttons; automated axe-core WCAG 2.1 AA check in E2E (fixed: header and stepper contrast, focusable scroll region)
- [x] Empty, loading and error states (unknown slug → not-found card, unknown URL → 404 page; Convex disconnected → banner)
- [x] Playwright E2E: a full retro with 3 browser contexts running through all phases
- [x] Load test with 30 simulated participants (`npm run loadtest`, dev deployment). Found write contention: `ideas.add` read all ideas for the cap and votes wrote a shared counter → OCC failures and dropped connections. Fixed in v0.14 (per-participant cap of 30 ideas; vote counts computed from `votes`). Result: p95 add idea 373 ms, vote 473 ms, propagation to all ~250 ms, 0 failures; ~2,000 Convex function calls per 30-person retro
- [x] README (local dev, tests, releases, env vars, security notes)
- [x] Old E2E test retros from before v0.9 removed from production (60 retros with all their data, via the admin delete flow; owner-approved)
- **Done when:** the acceptance checklist in §10 passes on production. ✅

### Post-1.0 changes
- [x] v1.1: the card people work in is highlighted per phase (pulse in Intro, idea board in Brainstorm and Vote, action items in Discuss & Act; nothing before the start or after the end; `focusArea` in `convex/lib/phases.ts`). The Discuss phase is now labelled **"Discuss & Act"** (display label only; the internal key stays `discuss`)
- [x] v1.3 (security review): global limit on new retros (60/hour, checked before hashing) and a per-browser write limit (60/minute, burst 30) via `@convex-dev/rate-limiter` (`convex/lib/rateLimits.ts`); per-retro caps were tried and dropped because any counter shared by a retro made 30 simultaneous voters wait for seconds (load test), so the board instead says when its list is cut off at 300 ideas. Only the author or the admin can delete an action (`admin.removeAction`). 12-character slugs; `getManyBySlugs` takes at most 20. Security headers (CSP with `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`). GitHub workflows run with read-only tokens
- [x] v1.4: live URL moved to https://retro-meeting.andreasknoor.com
- [x] v1.5 (backlog items): pulse results hidden until you answer or the Intro phase is over; pulse question asks about the period, not the retro; the phase lock says "Only the admin can switch phases."; the board hint explains that ideas added during Vote may miss votes and those added later get none; action due dates are optional and cannot be in the past; deleting an action asks inline first. Agenda changes move the running phase's timer by the difference (keeping "+1 min" extensions), and header and agenda card show the actual agenda total. The admin agenda form shows changes from other tabs unless it has unsaved edits ("Unsaved changes", Discard; Save only when changed). `getBySlug` reads only the retro document (whether anyone voted comes from `ideas.list`); a vote flag on the retro was tried and dropped because the first votes all conflicted on it (load test). The board and the pulse card say when vote counts or answers are cut off at 3000 / 500
- [x] v1.6 (backlog items): actions are capped per participant (20) instead of per retro, which removes the conflicts when many add actions at once (load test, 10 simultaneous adds: p95 from 1.6–3.5 s to 0.44 s); the action list says when it is cut off at 200. Presence: the phase bar shows how many are online and, during Intro / Vote, how many have answered / voted (`@convex-dev/presence`, ids never leave the server; load test: 30 joins p95 0.54 s, heartbeats p95 0.24 s)
- [x] v1.7 (backlog items 1–10 without 8b): Reset deletes votes after a confirmation and ignores stale clicks; vote counts and ranking hidden during the Vote phase (server-side); a finished retro is read-only for ideas and the pulse check; deleting an idea asks inline and warns about lost votes; "Make action" only in Discuss, "+ Another action" on ideas that have one, with a note in the form; buttons that do nothing in the current phase are hidden instead of disabled with tooltips; `End early` replaced by Pause / Resume; actions can be ticked off; Summary card with Markdown copy / download and print; failed admin logins slow down (10 s … 2 min) instead of locking for 15 minutes
- [x] v1.8: the app version is shown small next to the name in the top bar (instead of the footer); the dev deployment skips the global limit on new retros via the Convex env var `RELAX_CREATE_RETRO_LIMIT=true` (not set on production)
- [x] v1.9: "QR code" next to "Copy link" in the retro header opens a large QR code of the retro link (for joining by phone during a video call); generated in the browser with `qrcode`, so the link never reaches a third-party service

**Total: about 9.5 working days.**

---

## 10. Acceptance Checklist (release gate) — ✅ passed on production with v0.15

Each item is covered by automated tests; the E2E suite runs against https://retro-meeting.andreasknoor.com after every deployment.

- [x] A retro can be created with all master data and opened via its link without logging in — `e2e/retro-lifecycle.spec.ts`
- [x] There is no public list of retros; retros created or opened in this browser appear under "recent retros" on `/` — `e2e/retro-lifecycle.spec.ts`
- [x] Disabled phases do not appear in the stepper, the agenda or the UI — `e2e/phases.spec.ts`, `e2e/pulse.spec.ts`
- [x] The phase timer is in sync across clients (±1 s); `Back`, `+1 min`, `End early` and `Reset` work; by default only the admin controls phases — `e2e/phases.spec.ts`, `convex/phase.test.ts`
- [x] Pulse check: one answer per browser, changeable, anonymous, with a correct average — `e2e/pulse.spec.ts`
- [x] Ideas appear live for everyone in creation order; initials are optional — `e2e/ideas.spec.ts`
- [x] Voting only during the Vote phase; max. one vote per column per person; changeable; columns sort by votes — `e2e/voting.spec.ts`, `convex/votes.test.ts`
- [x] `Make action` on ideas works only in the Discuss phase; free-text actions are possible in every phase; owner and due date are required — `e2e/actions.spec.ts`
- [x] The admin password is required for agenda edits and deletion; brute-force lockout works — `e2e/admin.spec.ts`, `convex/admin.test.ts`
- [x] No `participantId`, `authorId` or password hash is ever returned to the client — `e2e/privacy.spec.ts` (inspects all WebSocket frames), `convex/*.test.ts`
- [x] The page works at 375 px width and at 1440 px — every E2E test runs on desktop and on a Pixel 7 viewport
- [x] A complete retro with three participants works end to end — `e2e/full-retro.spec.ts`
- [x] No serious WCAG 2.1 AA violations — `e2e/accessibility.spec.ts`

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
| Facilitator drops out while phases are locked | Retro stuck in a phase | Anyone with the password can log in inline from the phase bar; ideas, pulse check and free-text actions keep working in every phase |
| Lost admin password | Retro cannot be deleted | Clear warning at creation; P1: an optional recovery code shown once |
| Free-tier limits exceeded | App stops working | Load test in M8; queries return only the fields they need; no polling |
| Device clock drift | Different timer values | Server-time offset from `serverNow` |

---

## 14. Future Considerations (P1 / P2)

**P1 (fast follow)**
- Show open actions of previous retros (marking actions as done: v1.7)
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
