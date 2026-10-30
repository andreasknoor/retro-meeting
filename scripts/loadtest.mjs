#!/usr/bin/env node
// Load test: one complete retro with N simulated participants against a Convex deployment.
//
//   node scripts/loadtest.mjs [participants=30]
//
// Uses NEXT_PUBLIC_CONVEX_URL from .env.local (the dev deployment). Never point it at
// production: it creates and deletes a retro there.
import { readFileSync } from "node:fs";
import { ConvexClient } from "convex/browser";
import { anyApi } from "convex/server";

const api = anyApi;
const N = Number(process.argv[2] ?? 30);
const url =
  process.env.CONVEX_URL ??
  readFileSync(".env.local", "utf8").match(/^NEXT_PUBLIC_CONVEX_URL=(.+)$/m)?.[1].replace(/["']/g, "");
if (!url) throw new Error("No Convex URL (set CONVEX_URL or NEXT_PUBLIC_CONVEX_URL in .env.local)");

const percentile = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))];
const stats = (xs) => `n=${xs.length} p50=${percentile(xs, 50)}ms p95=${percentile(xs, 95)}ms max=${Math.max(...xs)}ms`;
const timed = async (fn) => {
  const t0 = performance.now();
  await fn();
  return Math.round(performance.now() - t0);
};

const admin = new ConvexClient(url);
const { slug, token } = await admin.action(api.retrosNode.create, {
  name: `Load test ${new Date().toISOString()}`,
  subtitle: "",
  date: new Date().toISOString().slice(0, 10),
  lengthMin: 30,
  facilitator: "Load test",
  enabledPhases: ["intro", "brainstorm", "vote", "discuss"],
  password: "loadtest-pw",
});
console.log(`Retro ${slug} created; ${N} participants joining…`);

// Every participant subscribes to what the retro page shows.
const people = Array.from({ length: N }, (_, i) => {
  const client = new ConvexClient(url);
  const participantId = `load-${String(i).padStart(4, "0")}-${slug}`;
  const person = { client, participantId, ideas: [], retro: null, online: 0, waiters: [] };
  const notify = () => notifyAll(person);
  client.onUpdate(api.retros.getBySlug, { slug }, (r) => ((person.retro = r), notify()));
  client.onUpdate(api.ideas.list, { slug, participantId }, (list) => ((person.ideas = list), notify()));
  client.onUpdate(api.pulse.summary, { slug, participantId }, () => {});
  client.onUpdate(api.actions.list, { slug, participantId }, () => {});
  return person;
});
function notifyAll(person) {
  person.waiters.forEach((w) => w());
}
const until = (person, check) =>
  new Promise((resolve) => {
    if (check()) return resolve();
    const w = () => check() && (person.waiters.splice(person.waiters.indexOf(w), 1), resolve());
    person.waiters.push(w);
  });

// Propagation: time until every participant sees a change made by one of them.
async function propagation(label, mutate, seen) {
  const t0 = performance.now();
  await mutate();
  const times = await Promise.all(people.map(async (p) => (await until(p, () => seen(p)), Math.round(performance.now() - t0))));
  console.log(`  ${label}: everyone sees it after ${stats(times)}`);
}

const phase = (from) => admin.mutation(api.phase.startNext, { slug, from, token });

await Promise.all(people.map((p) => until(p, () => p.retro !== null)));

// Presence: everyone joins at once, then sends a heartbeat every 10 s like the browser does.
const heartbeat = (p) =>
  p.client.mutation(api.presence.heartbeat, { roomId: slug, userId: p.participantId, sessionId: `${p.participantId}-tab`, interval: 10_000 });
const joins = await Promise.all(
  people.map((p) =>
    timed(async () => {
      const { roomToken } = await heartbeat(p);
      p.client.onUpdate(api.presence.list, { roomToken }, (list) => ((p.online = list.filter((x) => x.online).length), notifyAll(p)));
    }),
  ),
);
console.log(`Presence joins: ${stats(joins)}`);
await Promise.all(people.map((p) => until(p, () => p.online === N)));
console.log(`  everyone sees ${N} online`);
const beatTimes = [];
const beats = setInterval(() => people.forEach((p) => timed(() => heartbeat(p)).then((ms) => beatTimes.push(ms))), 10_000);
await propagation("phase change", () => phase("not_started"), (p) => p.retro?.state === "intro");

const pulse = await Promise.all(people.map((p, i) => timed(() => p.client.mutation(api.pulse.answer, { slug, participantId: p.participantId, score: 1 + (i % 5) }))));
console.log(`Pulse answers: ${stats(pulse)}`);

await phase("intro");
const columns = ["keep", "fix", "try"];
const adds = await Promise.all(
  people.flatMap((p, i) =>
    columns.map((column) =>
      timed(() => p.client.mutation(api.ideas.add, { slug, participantId: p.participantId, column, text: `Idea ${i} ${column}`, initials: "LT" })),
    ),
  ),
);
console.log(`Ideas added (${adds.length}): ${stats(adds)}`);
await Promise.all(people.map((p) => until(p, () => p.ideas.length === N * 3)));
await propagation("one more idea", () => people[0].client.mutation(api.ideas.add, { slug, participantId: people[0].participantId, column: "keep", text: "Late idea", initials: "" }), (p) => p.ideas.length === N * 3 + 1);

await phase("brainstorm");
await Promise.all(people.map((p) => until(p, () => p.retro?.state === "vote")));
// Everyone votes for the first idea of each column: maximal contention on the same documents.
const firstOf = (column) => people[0].ideas.find((idea) => idea.column === column).id;
const votes = await Promise.all(
  people.flatMap((p) => columns.map((column) => timed(() => p.client.mutation(api.votes.toggle, { ideaId: firstOf(column), participantId: p.participantId })))),
);
console.log(`Votes cast (${votes.length}, all on the same 3 ideas): ${stats(votes)}`);
await Promise.all(people.map((p) => until(p, () => p.ideas.find((i) => i.id === firstOf("keep"))?.voteCount === N)));
console.log(`  vote counts correct for everyone: ${N} votes on each top idea`);

await phase("vote");
const actions = await Promise.all(
  people.slice(0, 10).map((p, i) => timed(() => p.client.mutation(api.actions.add, { slug, participantId: p.participantId, text: `Action ${i}`, owner: `Owner ${i}`, dueDate: "2099-12-01" }))),
);
console.log(`Actions added: ${stats(actions)}`);
await phase("discuss");
clearInterval(beats);
// One more round all at once, in case the run was shorter than 10 s.
beatTimes.push(...(await Promise.all(people.map((p) => timed(() => heartbeat(p))))));
console.log(`Heartbeats: ${stats(beatTimes)}`);

await admin.mutation(api.admin.deleteRetro, { slug, token, confirmName: (await admin.query(api.retros.getBySlug, { slug })).name });
console.log(`Retro ${slug} deleted.`);
await Promise.all([admin, ...people.map((p) => p.client)].map((c) => c.close()));
