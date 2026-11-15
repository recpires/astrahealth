#!/usr/bin/env node
/**
 * Checks that every link of the NASA evidence library and of the imported OSDR
 * snapshots still answers on the official servers.
 *
 *   npm run science:check-links
 *
 * Behind an HTTP proxy, run with NODE_USE_ENV_PROXY=1 (Node.js ≥ 22.21).
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const library = readFileSync(join(ROOT, "src", "config", "evidence-library.ts"), "utf8");
const urls = new Set([...library.matchAll(/url:\s*"(https:\/\/[^"]+)"/g)].map((m) => m[1]));

const osdrDir = join(ROOT, "src", "data", "osdr");
if (existsSync(osdrDir)) {
  for (const f of readdirSync(osdrDir).filter((x) => x.endsWith(".json"))) {
    const s = JSON.parse(readFileSync(join(osdrDir, f), "utf8"));
    [s.studyUrl, s.metadataApiUrl, s.filesApiUrl, s.file?.downloadUrl].filter(Boolean).forEach((u) => urls.add(u));
  }
}

let failed = 0;
for (const url of urls) {
  try {
    const res = await fetch(url, { redirect: "follow" });
    const type = (res.headers.get("content-type") ?? "").split(";")[0];
    let title = "";
    if (type === "text/html") {
      const m = /<title>([\s\S]*?)<\/title>/i.exec(await res.text());
      title = m ? ` — ${m[1].trim().replace(/\s+/g, " ")}` : "";
    } else await res.arrayBuffer();
    const ok = res.ok && !/page not found/i.test(title);
    if (!ok) failed++;
    console.log(`${ok ? "OK  " : "FAIL"} ${res.status} ${type}${title}\n     ${url}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${e.cause?.code ?? e.message}\n     ${url}`);
  }
}
console.log(`\n${urls.size - failed}/${urls.size} links OK`);
process.exit(failed ? 1 : 0);
