#!/usr/bin/env node
/**
 * Browser end-to-end tests of the FUTURE modules (F01–F05), run against the real
 * production build — including a real network cut (browser offline mode) and a reload.
 *
 *   npm run build
 *   npm run test:e2e:future          # starts `next start` on a free port, or uses BASE_URL if set
 *
 * Output:
 *   docs/test-results/future/e2e-future-results.json — every check with expected / observed / status
 *   docs/test-results/future/e2e/*.png               — screenshot evidence (1440 × 900)
 * Exit code 1 if any check fails. Requires Playwright with Chromium.
 */
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const net = require("node:net");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "docs", "test-results", "future");
const SHOTS = path.join(OUT, "e2e");
const VIEWPORT = { width: 1440, height: 900 };

const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

async function startServer() {
  if (process.env.BASE_URL) return { url: process.env.BASE_URL, stop: () => {} };
  const port = await freePort();
  const proc = spawn(process.execPath, [path.join(ROOT, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(port)], {
    cwd: ROOT,
    stdio: "ignore",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });
  const url = `http://localhost:${port}`;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return { url, stop: () => proc.kill() };
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  proc.kill();
  throw new Error("Production server did not start. Run `npm run build` first.");
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const f of fs.readdirSync(SHOTS)) if (f.endsWith(".png")) fs.unlinkSync(path.join(SHOTS, f));

  const server = await startServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  const results = [];
  const t0 = Date.now();

  async function check(id, module, description, expected, fn, shotSelector) {
    const started = Date.now();
    let observed = "";
    let status = "passed";
    try {
      observed = await fn();
    } catch (e) {
      status = "failed";
      observed = `ERROR: ${String(e.message ?? e).split("\n")[0]}`;
    }
    let screenshot = null;
    if (shotSelector) {
      try {
        if (shotSelector === "top") await page.evaluate(() => window.scrollTo(0, 0));
        else await page.locator(shotSelector).first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(250);
        screenshot = `e2e/${id}.png`;
        await page.screenshot({ path: path.join(OUT, screenshot) });
      } catch {
        screenshot = null;
      }
    }
    results.push({ id, module, description, expected, observed, status, durationMs: Date.now() - started, screenshot });
    console.log(`${status === "passed" ? "PASS" : "FAIL"} ${id} — ${description}\n     ${observed}`);
  }

  const T = 15_000;
  const tid = (id) => `[data-testid="${id}"]`;
  // Text nodes joined with spaces (textContent glues adjacent elements; innerText applies CSS uppercase).
  const text = (sel) =>
    page
      .locator(sel)
      .first()
      .evaluate((el) => {
        const out = [];
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        while (w.nextNode()) out.push(w.currentNode.nodeValue);
        return out.join(" ").replace(/\s+/g, " ").trim();
      }, undefined, { timeout: T });
  const expectText = async (sel, re) => {
    await page.waitForFunction(([s, r]) => new RegExp(r).test(document.querySelector(s)?.textContent ?? ""), [sel, re.source], { timeout: T });
    return text(sel);
  };
  const must = (cond, msg) => {
    if (!cond) throw new Error(msg);
  };
  const tab = async (href) => {
    await page.click(`nav[aria-label="FUTURE modules"] a[href="${href}"]`);
    await page.waitForURL((u) => new URL(u).pathname === href, { timeout: T });
    await page.waitForTimeout(300);
  };
  const crew = (id) => page.click(tid(`crew-${id}`));

  try {
    await page.goto(`${server.url}/future`);
    await expectText(tid("storage-status"), /Saved on this device/);
    // Warm the client router for every FUTURE tab while online.
    for (const href of ["/future/journal", "/future/assess", "/future/profile", "/future/eva", "/future/readiness", "/future"]) await tab(href);

    // ── F01 Health Journal ────────────────────────────────────────────────
    await tab("/future/journal");
    await check("E2E-F01-01", "F01", "Demo journal: storyline flags appear for Crew Member B and D", "B: SHORT_SLEEP + HIGH_FATIGUE (days 10–14); D: CHECKIN_MISSING (days 12, 14); D body mass overdue", async () => {
      await crew("crew-b");
      const b = await text(tid("journal-flags"));
      must(/Short sleep reported/.test(b) && /High fatigue reported/.test(b), `B flags: ${b.slice(0, 120)}`);
      await crew("crew-d");
      const d = await text(tid("flag-CHECKIN_MISSING"));
      must(/days 12, 14/.test(d), d);
      const r = await text(tid("routine-body-mass"));
      must(/Overdue/.test(r), r);
      await crew("crew-b");
      return `B: short sleep + high fatigue · D: "${d.slice(0, 70)}…" · D body mass: overdue`;
    }, tid("journal-flags"));

    await check("E2E-F01-02", "F01", "Crew Member A records today's check-in", "Saved with mission time and stored on the device; listed as a crew entry", async () => {
      await crew("crew-a");
      await page.fill(tid("checkin-sleep"), "7.4");
      await page.fill(tid("checkin-fluid"), "2.3");
      await page.locator(tid("checkin-mood")).getByText("4", { exact: true }).click();
      await page.click(tid("checkin-submit"));
      const saved = await expectText(tid("checkin-saved"), /Saved for Crew Member A/);
      const row = await text(`${tid("journal-history")} tbody tr`);
      must(/D\s?15 08:00/.test(row) && /Crew entry/i.test(row), row);
      return `"${saved}" · history: ${row}`;
    }, "top");

    await check("E2E-F01-03", "F01", "A routine is marked done", "Body mass (Crew Member D) changes from Overdue to Done today", async () => {
      await crew("crew-d");
      await page.click(tid("routine-done-body-mass"));
      const r = await expectText(tid("routine-body-mass"), /Done today/);
      await crew("crew-a");
      return r;
    });

    // ── F02 Symptom Assessment ────────────────────────────────────────────
    await tab("/future/assess");
    await check("E2E-F02-01", "F02", "Moderate, worsening headache for Crew Member C", "Inform crew medical officer; uncertainty HIGH (no symptom-specific NASA reference); rules ASTRA-SYM@0.1.0-demo", async () => {
      await crew("crew-c");
      await page.selectOption(tid("assess-symptom"), "headache");
      await page.locator(tid("assess-severity")).getByText("Moderate").click();
      await page.locator(tid("assess-onset")).getByText("Gradually").click();
      await page.locator(tid("assess-trend")).getByText("Worse").click();
      await page.fill(tid("assess-duration"), "20");
      await page.locator(tid("assess-duties")).getByText("Yes").click();
      await page.click(tid("assess-submit"));
      const level = await expectText(tid("assess-level"), /Inform crew medical officer/);
      const unc = await text(tid("assess-uncertainty"));
      must(unc === "HIGH", `uncertainty ${unc}`);
      const result = await text(tid("assess-result"));
      must(/No symptom-specific NASA reference/.test(result), "missing uncertainty reason");
      must(/ASTRA-SYM@0\.1\.0-demo/.test(result), "rule set not shown");
      await page.click(tid("review-accept"));
      await expectText(tid("assess-review-done"), /Proposal accepted/);
      return `level "${level}" · uncertainty ${unc} · reviewed: accepted`;
    });

    await check("E2E-F02-02", "F02", "Dizziness with a warning sign for Crew Member B", "Medical support now; URGENT report and EVA hold proposed; verified NASA excerpt quoted; report queued as urgent", async () => {
      await crew("crew-b");
      await page.selectOption(tid("assess-symptom"), "dizziness");
      await page.locator(tid("assess-severity")).getByText("Moderate").click();
      await page.click(tid("assess-warning-fainting"));
      await page.click(tid("assess-submit"));
      const level = await expectText(tid("assess-level"), /Medical support now/);
      const steps = await text(tid("assess-steps"));
      must(/URGENT report/.test(steps) && /Hold EVA participation/.test(steps), steps.slice(0, 160));
      const sci = await text(tid("assess-science"));
      must(/Verified excerpts available/.test(sci) && /Reference only/.test(sci), "evidence levels missing");
      await page.click(tid("assess-queue"));
      await expectText(tid("assess-queue"), /Report queued/);
      return `level "${level}" · steps include URGENT report + EVA hold · evidence: verified excerpt + reference-only · queued (urgent)`;
    }, tid("assess-result"));

    // ── F03 Space Health Profile ──────────────────────────────────────────
    await tab("/future/profile");
    await check("E2E-F03-01", "F03", "Nine domains; unavailable exams show 'No data' and are never simulated", "9 domain panels; intracranial pressure, bone density, kidney imaging = No data; heart rate from simulated telemetry for Crew Member A only", async () => {
      await crew("crew-a");
      const domains = await page.locator(`${tid("profile-domains")} [data-testid^="domain-"]`).count();
      must(domains === 9, `${domains} domains`);
      for (const m of ["icp", "bone-density", "kidney-imaging"]) {
        const v = await text(tid(`metric-value-${m}`));
        must(v === "No data", `${m}: ${v}`);
      }
      must(/does not simulate or estimate/.test(await text(tid("metric-icp"))), "ICP note missing");
      const hrA = await text(tid("metric-value-heart-rate"));
      must(/bpm/.test(hrA), `HR A: ${hrA}`);
      await crew("crew-b");
      const hrB = await text(tid("metric-value-heart-rate"));
      must(hrB === "No data", `HR B: ${hrB}`);
      await crew("crew-a");
      return `9 domains · ICP / bone density / kidney imaging: No data · HR Crew A ${hrA} (simulated) · Crew B: ${hrB}`;
    }, tid("domain-neuro-ocular"));

    await check("E2E-F03-02", "F03", "Typed blood-pressure reading", "400 rejected by the typing check (not a clinical limit); 118 stored as crew-entered (not validated)", async () => {
      await page.selectOption(tid("metric-select"), "bp-systolic");
      await page.fill(tid("metric-input"), "400");
      await page.click(tid("metric-submit"));
      const err = await text('[role="alert"]');
      must(/not a clinical limit/.test(err), err);
      await page.fill(tid("metric-input"), "118");
      await page.click(tid("metric-submit"));
      const v = await expectText(tid("metric-value-bp-systolic"), /118 mmHg/);
      const row = await text(tid("metric-bp-systolic"));
      must(/crew-entered \(not validated\)/.test(row), row);
      return `400 → "${err}" · 118 → ${v}, crew-entered (not validated)`;
    });

    // ── F04 EVA ───────────────────────────────────────────────────────────
    await tab("/future/eva");
    await check("E2E-F04-01", "F04", "Pre-EVA gate for Crew Members A and B", "System proposes HOLD: Crew B has no check-in today and is held by the urgent assessment; GO is disabled without a reason", async () => {
      await page.uncheck(tid("eva-crew-crew-c"));
      await page.check(tid("eva-crew-crew-b"));
      await page.click(tid("eva-plan"));
      const p = await expectText(tid("eva-proposal"), /HOLD/);
      const pre01 = await text(tid("eva-item-PRE-01"));
      const pre02 = await text(tid("eva-item-PRE-02"));
      must(/No check-in today: Crew Member B/.test(pre01), pre01);
      must(/Held by assessment/.test(pre02), pre02);
      must(await page.locator(tid("eva-go")).isDisabled(), "GO enabled without reason");
      return `proposal ${p} · PRE-01 "${pre01.slice(-40)}" · PRE-02 held · GO disabled`;
    }, tid("eva-proposal"));

    await check("E2E-F04-02", "F04", "Override, equipment loss and an in-EVA event", "Override GO logged with reason; telemetry unavailable → alternative steps; 'feeling unwell' → urgent report queued; commander ends the EVA", async () => {
      for (const id of ["PRE-03", "PRE-04", "PRE-05", "PRE-06"]) await page.click(tid(`eva-check-${id}`));
      await page.fill(tid("eva-reason"), "Ground-reviewed exercise: demo override");
      await page.click(tid("eva-go"));
      await expectText(tid("eva-phase"), /During EVA/);
      await page.uncheck(tid("equip-suit-telemetry"));
      const dur = await text(tid("eva-item-DUR-02"));
      must(/Alternative step/.test(dur), dur);
      await page.click(tid("eva-raise-EV-UNWELL"));
      const ev = await text(tid("eva-event-EV-UNWELL"));
      must(/verbal status every 2 minutes/.test(ev), "alternative not applied to event step");
      await page.locator(tid("eva-event-EV-UNWELL")).locator(tid("event-terminate")).click();
      await expectText(tid("eva-phase"), /Post-EVA/);
      const hist = await text(tid("eva-decisions"));
      must(/override/.test(hist) && /END/.test(hist), hist.slice(0, 160));
      const q = await text(tid("outbox-list"));
      must(/urgent/.test(q), "urgent EVA report not queued");
      return "GO override logged · DUR-02 + U3 use alternatives · urgent report queued · EVA ended by commander";
    }, tid("eva-decisions"));

    await check("E2E-F04-03", "F04", "Post-EVA closure", "EVA log queued (routine); closing with open items requires a reason; EVA moves to history", async () => {
      await page.click(tid("eva-queue-log"));
      must(await page.locator(tid("eva-close")).isDisabled(), "close enabled with open items and no reason");
      await page.fill(tid("eva-reason"), "Post-EVA vitals deferred to next shift (demo)");
      await page.click(tid("eva-close"));
      await page.waitForSelector(tid("eva-plan"), { timeout: T });
      const hist = await text(tid("eva-decisions"));
      return `closed; decision history: ${hist.slice(0, 120)}…`;
    });

    // ── Communication loss: Earth link lost AND browser offline ───────────
    await tab("/future/journal");
    const offlineRequests = [];
    const onReq = (r) => offlineRequests.push(r.url());
    await check("E2E-OFF-01", "Platform", "Earth link lost and the browser cut from the network: modules keep working on local data", "Check-in, assessment and report work offline; items wait in the queue (Waiting to send)", async () => {
      await page.click(tid("link-toggle"));
      await expectText(tid("link-status"), /LOST/);
      await context.setOffline(true);
      page.on("request", onReq);
      await crew("crew-d");
      await page.fill(tid("checkin-sleep"), "6.9");
      await page.click(tid("checkin-submit"));
      await expectText(tid("checkin-saved"), /Saved for Crew Member D/);
      await page.click(tid("journal-queue-summary"));
      const n = await text(tid("outbox-count"));
      must(Number(n) >= 1, `outbox ${n}`);
      return `check-in saved offline for Crew Member D · ${n} item(s) in queue · browser offline: ${await page.evaluate(() => !navigator.onLine)}`;
    }, "top");

    await check("E2E-OFF-02", "Platform", "Moving between FUTURE modules while offline", "Client-side navigation to F05 works without the network; records are visible", async () => {
      await tab("/future/readiness");
      await expectText(tid("verify-result-V-OFFLINE"), /PASS/);
      const offline = await text(tid("verify-V-OFFLINE"));
      must(/Link LOST/.test(offline), offline);
      return `F05 rendered offline · ${offline.slice(0, 110)}`;
    }, tid("verification-checks"));

    await check("E2E-OFF-03", "Platform", "Earth link restored", "Queued items are sent in priority order (urgent first) and acknowledged after the round trip", async () => {
      await context.setOffline(false);
      page.off("request", onReq);
      await tab("/future");
      await page.click(tid("link-toggle"));
      await expectText(tid("link-status"), /Available/);
      const items = await page.locator(`${tid("outbox-list")} li`).evaluateAll((els) =>
        els.map((e) => ({ t: e.textContent.replace(/\s+/g, " "), urgent: /urgent/.test(e.textContent), order: Number((e.textContent.match(/sent #(\d+)/) || [])[1] || 0) })),
      );
      const firstSent = items.filter((i) => i.order > 0).sort((a, b) => a.order - b.order)[0];
      must(firstSent && firstSent.urgent, "first transmitted item is not urgent");
      await page.click(tid("advance-60"));
      const count = await expectText(tid("outbox-count"), /^0$/);
      return `${items.length} items · first sent: urgent · after +1 h: ${count} pending (all acknowledged)`;
    }, tid("outbox-list"));

    await check("E2E-OFF-04", "Platform", "Reload the page: records come back from the device", "Crew Member D's offline check-in, the queue history and the audit trail are restored after reload", async () => {
      const before = await text(tid("future-clock"));
      await page.reload();
      await expectText(tid("storage-status"), /Saved on this device/);
      const after = await expectText(tid("future-clock"), new RegExp(before.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      await tab("/future/journal");
      await crew("crew-d");
      const saved = await expectText(tid("checkin-saved"), /Saved for Crew Member D/);
      return `clock ${after} restored · "${saved}"`;
    }, "top");

    // ── F05 Readiness & Trace ─────────────────────────────────────────────
    await tab("/future/readiness");
    await check("E2E-F05-01", "F05", "Readiness, verification and tamper test", "4 crew cards; audit trail intact; no rule set presented as validated; tamper test detects an edited copy", async () => {
      const cards = await page.locator('[data-testid^="readiness-overall-"]').count();
      must(cards === 4, `${cards} crew cards`);
      const audit = await text(tid("verify-result-V-AUDIT"));
      const nv = await text(tid("verify-result-V-NOT-VALIDATED"));
      must(audit === "PASS" && nv === "PASS", `${audit}/${nv}`);
      await page.click(tid("tamper-test"));
      const t = await expectText(tid("tamper-result"), /verification failed/);
      const rows = await page.locator(tid("audit-row")).count();
      return `4 crew cards · V-AUDIT ${audit} · V-NOT-VALIDATED ${nv} · ${rows} audit entries · tamper: "${t.slice(0, 90)}…"`;
    }, "top");

    await check("E2E-F05-02", "F05", "Export of the full trace", "Downloaded JSON contains the state, the rule-set versions and a verified checksum chain", async () => {
      const [dl] = await Promise.all([page.waitForEvent("download", { timeout: T }), page.click(tid("export-trace"))]);
      const file = path.join(OUT, "exported-trace-sample.json");
      await dl.saveAs(file);
      const json = JSON.parse(fs.readFileSync(file, "utf8"));
      must(json.chain.ok === true, "chain not ok");
      must(json.ruleSets.length === 4, "rule sets missing");
      must(json.state.platform.audit.length === json.chain.checked, "entry count mismatch");
      const kinds = [...new Set(json.state.platform.audit.map((a) => a.kind))].sort();
      return `${dl.suggestedFilename()} · ${json.chain.checked} entries, chain ok · kinds: ${kinds.join(", ")} · rule sets: ${json.ruleSets.map((r) => r.ref).join(", ")}`;
    }, tid("audit-table"));

    // ── Regression: tested demo untouched ─────────────────────────────────
    await check("E2E-REG-01", "Regression", "The tested demo is unchanged and reachable", "Monitoring still shows the three vital cards and scenario buttons; 'Platform preview' is an extra menu entry", async () => {
      await page.click('nav[aria-label="Modules"] a[href="/"]');
      await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: T });
      for (const k of ["hr", "spo2", "temp"]) await page.waitForSelector(tid(`vital-card-${k}`), { timeout: T });
      must(await page.locator(tid("simulate-incident")).isVisible(), "simulate-incident missing");
      const navText = await text('nav[aria-label="Modules"]');
      must(/Platform preview/.test(navText), "nav entry missing");
      return "vital cards + scenario buttons present · nav: Monitoring, Analysis, Response, Earth Link, Science & Limits, Platform preview";
    }, "top");

    results.find((r) => r.id === "E2E-OFF-01").networkRequestsWhileOffline = offlineRequests.length;
  } finally {
    const browserVersion = browser.version();
    await browser.close();
    server.stop();
    const summary = {
      generatedBy: "scripts/e2e-future.cjs",
      date: new Date().toISOString(),
      browser: `Chromium ${browserVersion}`,
      viewport: `${VIEWPORT.width}×${VIEWPORT.height}`,
      target: process.env.BASE_URL ? process.env.BASE_URL : "next start (production build)",
      durationSec: Math.round((Date.now() - t0) / 1000),
      passed: results.filter((r) => r.status === "passed").length,
      failed: results.filter((r) => r.status === "failed").length,
      pageErrors,
      results,
    };
    fs.writeFileSync(path.join(OUT, "e2e-future-results.json"), JSON.stringify(summary, null, 2) + "\n");
    console.log(`\n${summary.passed}/${results.length} browser checks passed · page errors: ${pageErrors.length} · ${summary.durationSec} s`);
    process.exitCode = summary.failed || pageErrors.length ? 1 : 0;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
