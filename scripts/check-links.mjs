#!/usr/bin/env node
// Dependency-free check that relative links and #anchors in this repo's markdown files resolve.
// Usage: node scripts/check-links.mjs   (run from the repo root; exits 1 on any broken link)
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const SKIP = new Set(["node_modules", "dist", ".git", "generated"]);

function markdownFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? markdownFiles(full) : name.endsWith(".md") ? [full] : [];
  });
}

const slug = (heading) =>
  heading.trim().toLowerCase().replace(/`/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s/g, "-");

function anchors(file) {
  const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  return new Set([...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => slug(m[1])));
}

let broken = 0;
for (const file of markdownFiles(".")) {
  const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:)/.test(target)) continue;
    const [path, hash] = target.split("#");
    const dest = path ? resolve(dirname(file), path) : resolve(file);
    if (!existsSync(dest)) { console.error(`${file}: missing file ${target}`); broken++; continue; }
    if (hash && dest.endsWith(".md") && !anchors(dest).has(hash)) { console.error(`${file}: missing anchor ${target}`); broken++; }
  }
}
if (broken) { console.error(`${broken} broken link(s)`); process.exit(1); }
console.log("All relative markdown links resolve");
