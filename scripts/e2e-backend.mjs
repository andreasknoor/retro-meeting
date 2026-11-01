#!/usr/bin/env node
// Local Convex backend for E2E runs, so they don't use up the cloud deployments' database I/O.
//
//   node scripts/e2e-backend.mjs        (Playwright starts it; see playwright.config.ts)
//
// Runs `convex dev` in anonymous local mode (no Convex account) from .e2e-backend/, a folder with
// a copy of convex/ and its own .env.local: run from the project root, the CLI would point the
// project's .env.local at the local backend. Pushes the functions, sets the E2E env vars and
// keeps running until Playwright stops it. Node actions need Node 22 or 24 on PATH.
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";

// Must match E2E_CONVEX_URL in playwright.config.ts. READY_PORT answers once functions and env vars are in.
const E2E_CONVEX_URL = "http://127.0.0.1:3210";
const READY_PORT = 3209;

const root = resolve(import.meta.dirname, "..");
const dir = join(root, ".e2e-backend");
mkdirSync(dir, { recursive: true });
for (const name of ["node_modules", "package.json", "tsconfig.json"]) {
  if (!existsSync(join(dir, name))) symlinkSync(join(root, name), join(dir, name));
}
// A copy, not a link: the bundler resolves links to the real path and then finds no app bundle.
// Changes to convex/ during a run are not picked up.
rmSync(join(dir, "convex"), { recursive: true, force: true });
cpSync(join(root, "convex"), join(dir, "convex"), { recursive: true });

const supported = (bin) => {
  const result = spawnSync(join(bin, "node"), ["--version"], { encoding: "utf8" });
  return /^v(22|24)\./.test(result.stdout ?? "");
};
const pathDirs = (process.env.PATH ?? "").split(delimiter);
const nodeBin = [
  ...pathDirs.filter((d) => existsSync(join(d, "node"))).slice(0, 1),
  "/opt/homebrew/opt/node@24/bin",
  "/usr/local/opt/node@24/bin",
  "/opt/homebrew/opt/node@22/bin",
  "/usr/local/opt/node@22/bin",
].find((d) => existsSync(join(d, "node")) && supported(d));
if (!nodeBin) {
  console.error("✗ The local Convex backend needs Node 22 or 24 for its Node actions (e.g. `brew install node@24`).");
  process.exit(1);
}

const env = { ...process.env, CONVEX_AGENT_MODE: "anonymous", PATH: [nodeBin, ...pathDirs].join(delimiter) };
const convex = (args, opts = {}) => spawn("npx", ["convex", ...args], { cwd: dir, env, ...opts });

// Same process group as this script: Playwright stops the whole group, including the backend
// binary the CLI starts.
const dev = convex(["dev", "--codegen", "disable", "--typecheck", "disable", "--tail-logs", "disable"], {
  stdio: ["ignore", "pipe", "pipe"],
});
const stop = () => dev.kill("SIGTERM");
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => (stop(), process.exit(0)));
process.on("exit", stop);
dev.on("exit", (code) => process.exit(code ?? 1));

let ready = false;
dev.stdout.on("data", (chunk) => process.stdout.write(chunk));
// The CLI reports progress on stderr.
dev.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
  if (ready || !/Convex functions ready/.test(String(chunk))) return;
  ready = true;
  const url = readFileSync(join(dir, ".env.local"), "utf8").match(/^NEXT_PUBLIC_CONVEX_URL=(.+)$/m)?.[1];
  if (url !== E2E_CONVEX_URL) {
    console.error(`✗ Local backend runs at ${url}, but the E2E app build expects ${E2E_CONVEX_URL}.`);
    process.exit(1);
  }
  // Many retros per run; production keeps the limit (README, rate limits).
  const set = convex(["env", "set", "RELAX_CREATE_RETRO_LIMIT", "true"], { stdio: "inherit" });
  set.on("exit", (code) => {
    if (code !== 0) process.exit(code ?? 1);
    createServer((_, res) => res.end("ready")).listen(READY_PORT, "127.0.0.1");
    console.log(`✓ Local Convex backend ready at ${url}`);
  });
});
