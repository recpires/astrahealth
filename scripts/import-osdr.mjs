#!/usr/bin/env node
/**
 * Imports a PUBLIC NASA Open Science Data Repository (OSDR) tabular file into
 * src/data/osdr/<ACCESSION>.json, together with its source identification.
 *
 *   npm run osdr:import -- OSD-575
 *   npm run osdr:import -- OSD-575 --file <exact file name>
 *   npm run osdr:import -- OSD-575 --list          # list the study's files
 *
 * The file content is stored VERBATIM (its SHA-256 is recorded) so anyone can
 * check it against the original download. No value is altered, filtered or
 * merged with ASTRA Health's simulated vital signs. The application parses the
 * stored text and only displays per-timepoint summary statistics.
 *
 * Behind an HTTP proxy, run with NODE_USE_ENV_PROXY=1 (Node.js ≥ 22.21).
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "src", "data", "osdr");
const BASE = "https://osdr.nasa.gov";

/** Default file per study, chosen for relevance to ASTRA Health. */
const DEFAULT_FILES = {
  "OSD-575": "LSDS-8_Multiplex_serum_cardiovascular_EvePanel_TRANSFORMED.csv",
};

function parseArgs(argv) {
  const args = { accession: null, file: null, list: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file") args.file = argv[++i];
    else if (a === "--list") args.list = true;
    else if (!args.accession) args.accession = a;
  }
  const m = /^(?:OSD-)?(\d+)$/i.exec(args.accession ?? "");
  if (!m) {
    console.error("Usage: npm run osdr:import -- OSD-<number> [--file <name>] [--list]");
    process.exit(1);
  }
  args.number = m[1];
  args.accession = `OSD-${m[1]}`;
  return args;
}

async function get(url) {
  let res;
  try {
    res = await fetch(url, { redirect: "follow", headers: { Accept: "application/json, text/csv, */*" } });
  } catch (e) {
    const hint = process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY ? " (behind a proxy? retry with NODE_USE_ENV_PROXY=1)" : "";
    throw new Error(`Network error for ${url}: ${e.cause?.code ?? e.message}${hint}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res;
}

const comment = (study, name) => (study.comments ?? []).find((c) => c.name === name)?.value || null;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const metaUrl = `${BASE}/osdr/data/osd/meta/${args.number}`;
  const filesUrl = `${BASE}/osdr/data/osd/files/${args.number}`;

  const meta = await (await get(metaUrl)).json();
  const study = meta?.study?.[args.accession]?.studies?.[0];
  if (!study) throw new Error(`${args.accession} not found in OSDR metadata (${metaUrl})`);

  const filesJson = await (await get(filesUrl)).json();
  const files = filesJson?.studies?.[args.accession]?.study_files ?? [];

  if (args.list) {
    console.log(`${args.accession} — ${study.title}`);
    for (const f of files) console.log(`  [${f.category}${f.subdirectory ? " / " + f.subdirectory : ""}] ${f.file_name} (${f.file_size} B)${f.restricted ? " RESTRICTED" : ""}`);
    return;
  }

  const wanted = args.file ?? DEFAULT_FILES[args.accession];
  if (!wanted) throw new Error(`No default file for ${args.accession}. Use --list, then --file <name>.`);
  const file = files.find((f) => f.file_name === wanted);
  if (!file) throw new Error(`File "${wanted}" not found in ${args.accession}. Use --list to see the available files.`);
  if (file.restricted) throw new Error(`File "${wanted}" is restricted; only public files can be imported.`);

  const downloadUrl = `${BASE}${file.remote_url}`;
  const bytes = Buffer.from(await (await get(downloadUrl)).arrayBuffer());
  if (typeof file.file_size === "number" && file.file_size !== bytes.length) {
    throw new Error(`Size mismatch for ${wanted}: expected ${file.file_size} B, received ${bytes.length} B`);
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const snapshot = {
    kind: "real-scientific-data",
    repository: "NASA Open Science Data Repository (OSDR)",
    accession: args.accession,
    title: study.title,
    description: study.description,
    studyUrl: `${BASE}/bio/repo/data/studies/${args.accession}`,
    metadataApiUrl: metaUrl,
    filesApiUrl: filesUrl,
    publicReleaseDate: study.publicReleaseDate ?? null,
    mission: {
      name: comment(study, "Mission Name"),
      start: comment(study, "Mission Start"),
      end: comment(study, "Mission End"),
    },
    factors: (study.factors ?? []).map((f) => f.factorName),
    publications: (study.publications ?? []).map((p) => ({ title: p.title, doi: p.doi || null })),
    file: {
      name: file.file_name,
      category: file.category,
      subcategory: file.subcategory || null,
      subdirectory: file.subdirectory || null,
      downloadUrl,
      bytes: bytes.length,
      sha256,
    },
    retrievedOn: new Date().toISOString().slice(0, 10),
    importedWith: "scripts/import-osdr.mjs",
    content: bytes.toString("utf8"),
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const out = join(OUT_DIR, `${args.accession}.json`);
  writeFileSync(out, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`Imported ${args.accession} / ${file.file_name}`);
  console.log(`  ${bytes.length} B · sha256 ${sha256}`);
  console.log(`  → ${relative(ROOT, out)}`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
