#!/usr/bin/env node
// Release = bump version, commit, tag, push. Every push must go through this script.
//
//   npm run release            → minor bump (0.1 → 0.2); the first release keeps 0.1
//   npm run release -- --major → major bump (0.x → 1.0); only on the owner's explicit instruction
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const sh = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();
const run = (cmd) => execSync(cmd, { stdio: "inherit" });

if (sh("git status --porcelain")) {
  console.error("✗ Working tree is not clean. Commit your changes first.");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const [major, minor] = pkg.version.split(".").map(Number);
const hasTags = sh("git tag --list 'v*'") !== "";

let next;
if (process.argv.includes("--major")) next = `${major + 1}.0`;
else if (!hasTags) next = `${major}.${minor}`;
else next = `${major}.${minor + 1}`;

pkg.version = `${next}.0`;
writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
run("npm install --package-lock-only --ignore-scripts --silent");

run("git add package.json package-lock.json");
if (sh("git diff --cached --name-only")) run(`git commit -m "chore(release): v${next}"`);
run(`git tag -a v${next} -m "v${next}"`);
run("git push --follow-tags");
console.log(`✓ Released v${next}`);
