#!/usr/bin/env node
/**
 * Verifies the NASA Human Research Roadmap (HRR) risk references used by the
 * FUTURE modules against the official risk index page.
 *
 *   npm run future:check-refs                   # fetch the live index, compare every title and link
 *   npm run future:check-refs -- --write-snapshot   # also refresh src/data/future/hrr-risk-index.snapshot.json
 *
 * The snapshot lets the unit tests check the references offline.
 * In a sandbox behind a proxy, Node needs NODE_USE_ENV_PROXY=1.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REFS = join(ROOT, "src", "data", "future", "hrr-risk-references.json");
const SNAPSHOT = join(ROOT, "src", "data", "future", "hrr-risk-index.snapshot.json");
const INDEX_URL = "https://humanresearchroadmap.nasa.gov/Risks/";

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const res = await fetch(INDEX_URL, { headers: { "user-agent": "astra-health-reference-check" } });
if (!res.ok) {
  console.error(`Index page answered HTTP ${res.status}`);
  process.exit(1);
}
const html = await res.text();
const risks = {};
for (const m of html.matchAll(/Risks\/\?i=(\d+)"[^>]*>([^<]+)</g)) risks[m[1]] = decode(m[2]);
console.log(`Index: ${Object.keys(risks).length} risk links found at ${INDEX_URL}`);

const refs = JSON.parse(readFileSync(REFS, "utf8"));
let failures = 0;
for (const r of refs.entries) {
  const live = risks[String(r.hrrId)];
  const urlOk = r.url === `https://humanresearchroadmap.nasa.gov/Risks/?i=${r.hrrId}`;
  const ok = live === r.title && urlOk;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  i=${r.hrrId}  ${r.title}${ok ? "" : `\n      index says: ${live ?? "(not listed)"}${urlOk ? "" : " · URL does not match hrrId"}`}`);
}

if (process.argv.includes("--write-snapshot")) {
  const snapshot = {
    url: INDEX_URL,
    retrievedOn: new Date().toISOString().slice(0, 10),
    sha256: createHash("sha256").update(html).digest("hex"),
    note: "Risk id → title pairs extracted verbatim (HTML entities decoded, whitespace collapsed) from the official HRR risk index.",
    risks,
  };
  writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`Snapshot written: ${SNAPSHOT}`);
}

console.log(failures ? `\n${failures} reference(s) FAILED` : `\nAll ${refs.entries.length} references match the official index.`);
process.exit(failures ? 1 : 0);
