#!/usr/bin/env node
/**
 * Browser end-to-end tests of the three demonstration scenarios, run against the
 * real production build. Each check maps to cases of tests/acceptance/test-plan.json.
 *
 *   npm run build
 *   npm run test:e2e                 # starts `next start` on a free port, or uses BASE_URL if set
 *
 * Output (default folder docs/test-results; `--out <dir>` writes the same files to another folder,
 * e.g. for the regression run of the FUTURE modules):
 *   docs/test-results/e2e-results.json   — every check with expected / observed / status
 *   docs/test-results/e2e/*.png          — screenshot evidence (1440 × 810)
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
const outArg = process.argv.indexOf("--out");
const OUT = outArg > 0 && process.argv[outArg + 1] ? path.resolve(ROOT, process.argv[outArg + 1]) : path.join(ROOT, "docs", "test-results");
const SHOTS = path.join(OUT, "e2e");
const VIEWPORT = { width: 1440, height: 810 };

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
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  const results = [];
  const t0 = Date.now();

  /** Runs one check: fn returns the observed value (string) or throws. */
  async function check(id, covers, description, expected, fn, shot) {
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
    if (shot) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      screenshot = `e2e/${id}.png`;
      await page.screenshot({ path: path.join(OUT, screenshot) });
    }
    results.push({ id, covers, description, expected, observed, status, durationMs: Date.now() - started, screenshot });
    console.log(`${status === "passed" ? "PASS" : "FAIL"} ${id} — ${description}\n     ${observed}`);
  }

  const T = 60_000;
  // textContent = the text as written (innerText would return CSS-uppercased badge labels).
  const text = async (sel) => ((await page.locator(sel).first().textContent()) ?? "").replace(/\s+/g, " ").trim();
  const headline = (sel) => text(`${sel} p`);
  const expectText = async (sel, re) => {
    await page.waitForFunction(([s, r]) => new RegExp(r).test(document.querySelector(s)?.textContent ?? ""), [sel, re.source], { timeout: T });
    return text(sel);
  };
  const nav = async (href) => {
    await page.click(`nav a[href="${href}"]`);
    await page.waitForURL((u) => new URL(u).pathname === href);
    await page.waitForTimeout(400);
  };
  const speed = (x) => page.click(`header button:has-text("${x}×")`);
  const count = (sel) => page.locator(sel).count();
  /** Generates + queues a report and follows the newest message through every state (3-min delay, 60×). */
  async function sendReportAndFollow(expectedPriority) {
    await page.click('button:has-text("Short · 3 min")');
    await page.click('[data-testid="generate-report"]');
    const preview = await text('[data-testid="report-preview"]');
    const priority = await page.locator("#priority").inputValue();
    if (!/SIMULATED DEMONSTRATION REPORT/.test(preview)) throw new Error("report preview lacks the simulation disclaimer");
    if (priority !== expectedPriority) throw new Error(`priority ${priority}, expected ${expectedPriority}`);
    await page.click('[data-testid="queue-report"]');
    const row = page.locator('[data-testid^="message-MSG-"]').first();
    const id = (await row.getAttribute("data-testid")).replace("message-", "");
    await speed(60);
    const seen = [];
    const startMs = Date.now();
    while (Date.now() - startMs < T) {
      const st = await page.locator(`[data-testid="message-${id}"]`).getAttribute("data-state");
      if (seen[seen.length - 1] !== st) seen.push(st);
      if (st === "response-received") break;
      await page.waitForTimeout(100);
    }
    await speed(10);
    const want = ["queued", "sent", "received", "response-pending", "response-received"];
    if (want.some((s) => !seen.includes(s))) throw new Error(`states seen: ${seen.join(" → ")}`);
    return { id, priority, preview, seen };
  }

  try {
    await page.goto(server.url);
    await page.waitForTimeout(1500);

    // ── Scenario 1 — Nominal ──────────────────────────────────────────────
    await check("E2E-S1-01", ["S1-01", "S1-02"], "Monitoring shows three simulated vital signs within range, sensors online, level NOMINAL",
      "NOMINAL; 3 × 'Within demo range'; 3 × 'Sensor Online'; 'Simulated data' label", async () => {
        const level = await expectText('[data-testid="overall-level"]', /NOMINAL/);
        const within = await count('[data-testid^="vital-card-"] >> text=Within demo range');
        const online = await count('[data-testid^="sensor-"] >> text=Online');
        const simLabel = await count("text=Simulated data · Demo");
        if (within !== 3 || online !== 3 || simLabel < 1) throw new Error(`within=${within} online=${online} label=${simLabel}`);
        return `level ${level}; ${within}/3 within demo range; ${online}/3 sensors online; simulated label shown`;
      }, true);
    await nav("/analysis");
    await check("E2E-S1-02", ["S1-02"], "Analysis shows NOMINAL, no findings and High reliability",
      "NOMINAL; 'Findings (0)'; reliability High", async () => {
        const level = await expectText('[data-testid="analysis-level"]', /NOMINAL/);
        const rel = await text('[data-testid="reliability-label"]');
        const findings = await count('[data-testid^="finding-"]');
        if (findings !== 0 || rel !== "High") throw new Error(`findings=${findings} reliability=${rel}`);
        return `level ${level}; ${findings} findings; reliability ${rel}`;
      });
    await nav("/response");
    await check("E2E-S1-03", ["S1-03"], "Response shows no medical support and routine monitoring only",
      "'Medical support not required by the demo rules'; PROC-NM-01", async () => {
        await expectText('[data-testid="medical-support"]', /not required/);
        if ((await count('[data-testid="procedure-PROC-NM-01"]')) !== 1) throw new Error("PROC-NM-01 missing");
        return `"${await headline('[data-testid="medical-support"]')}"; procedure PROC-NM-01 shown`;
      }, true);
    await nav("/comms");
    await check("E2E-S1-04", ["S1-04"], "Routine report is queued and passes through every message state",
      "priority routine; queued → sent → received → response pending → response received", async () => {
        const r = await sendReportAndFollow("routine");
        return `${r.id} (${r.priority}): ${r.seen.join(" → ")}`;
      }, true);

    // ── Scenario 2 — Vital-sign deviation ─────────────────────────────────
    await nav("/");
    await check("E2E-S2-01", ["S2-01", "S2-02"], "'Simulate incident' leads to WARNING with HR above and SpO₂ below the demo range",
      "WARNING within 60 s of real time at 10×; HR 'Above demo range'; SpO₂ 'Below demo range'; sensors online", async () => {
        const startMs = Date.now();
        await page.click('[data-testid="simulate-incident"]');
        await expectText('[data-testid="overall-level"]', /WARNING/);
        const secs = ((Date.now() - startMs) / 1000).toFixed(1);
        const hr = await text('[data-testid="vital-card-hr"]');
        const spo2 = await text('[data-testid="vital-card-spo2"]');
        const hrValue = await text('[data-testid="vital-value-hr"]');
        const spo2Value = await text('[data-testid="vital-value-spo2"]');
        if (!/Above demo range/.test(hr) || !/Below demo range/.test(spo2)) throw new Error("cards do not show the deviation");
        const online = await count('[data-testid^="sensor-"] >> text=Online');
        if (online !== 3) throw new Error(`${online}/3 sensors online`);
        return `WARNING after ${secs} s real time (10×); HR ${hrValue} bpm (above demo range 50–100); SpO₂ ${spo2Value} % (below demo range 95–100); 3/3 sensors online`;
      }, true);
    await nav("/analysis");
    await check("E2E-S2-02", ["S2-02", "S2-03"], "Analysis lists three vital-sign deviations, reliability High and escalation events",
      "3 VITAL_OUT_OF_RANGE findings; 'not a diagnosis'; reliability High; 'escalated' events", async () => {
        const level = await expectText('[data-testid="analysis-level"]', /WARNING/);
        const f = await count('[data-testid^="finding-VITAL_OUT_OF_RANGE"]');
        const rel = await text('[data-testid="reliability-label"]');
        // Heart rate escalates to WARNING 10 s (mission time) after SpO₂: wait for both escalation events.
        await page.waitForFunction(() => [...document.querySelectorAll("td")].filter((td) => td.textContent?.trim() === "escalated").length >= 2, null, { timeout: T });
        const escalated = await page.evaluate(() => [...document.querySelectorAll("td")].filter((td) => td.textContent?.trim() === "escalated").length);
        const notDiag = await count("text=/not a diagnosis/");
        if (f !== 3 || rel !== "High" || escalated < 2 || notDiag < 3) throw new Error(`findings=${f} reliability=${rel} escalated=${escalated} notDiagnosis=${notDiag}`);
        return `level ${level}; ${f} vital-sign findings; reliability ${rel}; ${escalated} escalation events; 'not a diagnosis' shown ${notDiag}×`;
      }, true);
    await nav("/response");
    await check("E2E-S2-03", ["S2-04", "S2-05"], "Response requests medical support now and logs a completed checklist step",
      "'Request medical support now'; PROC-ESC-01 + PROC-VD-01; step logged in the action log", async () => {
        const sup = await expectText('[data-testid="medical-support"]', /Request medical support now/);
        const procs = (await count('[data-testid="procedure-PROC-ESC-01"]')) + (await count('[data-testid="procedure-PROC-VD-01"]'));
        await page.locator('[data-testid="procedure-PROC-ESC-01"] input[type=checkbox]').first().check();
        const log = await expectText('[data-testid="action-log"]', /Step completed \[PROC-ESC-01\]/);
        if (procs !== 2) throw new Error(`procedures shown: ${procs}`);
        return `"${await headline('[data-testid="medical-support"]')}"; PROC-ESC-01 + PROC-VD-01 shown; log: "${log.match(/Step completed \[PROC-ESC-01\][^.]*/)?.[0]}"`;
      }, true);
    await nav("/comms");
    await check("E2E-S2-04", ["S2-06", "S2-07"], "Urgent incident report is generated and delivered through every state",
      "report shows WARNING + disclaimer; priority urgent; every message state reached", async () => {
        const r = await sendReportAndFollow("urgent");
        if (!/ATTENTION: WARNING/.test(r.preview)) throw new Error("report preview lacks WARNING");
        return `${r.id} (${r.priority}); report: WARNING + simulation disclaimer; ${r.seen.join(" → ")}`;
      }, true);

    // ── Scenario 3 — Sensor fault ─────────────────────────────────────────
    await nav("/");
    await check("E2E-S3-01", ["S3-01", "S3-02"], "'Simulate sensor fault' gives CAUTION with SpO₂ unverified and other sensors online",
      "CAUTION; SpO₂ card 'unverified' and sensor not online; HR and temperature sensors online", async () => {
        const startMs = Date.now();
        await page.click('[data-testid="simulate-sensor-fault"]');
        await expectText('[data-testid="overall-level"]', /CAUTION/);
        const secs = ((Date.now() - startMs) / 1000).toFixed(1);
        await expectText('[data-testid="vital-card-spo2"]', /unverified/);
        const spo2Sensor = await text('[data-testid="sensor-spo2"]');
        const hrSensor = await text('[data-testid="sensor-hr"]');
        const tempSensor = await text('[data-testid="sensor-temp"]');
        if (/Online/.test(spo2Sensor) || !/Online/.test(hrSensor) || !/Online/.test(tempSensor)) throw new Error("unexpected sensor states");
        return `CAUTION after ${secs} s real time (10×); SpO₂ value shown as unverified; SpO₂ sensor "${spo2Sensor.match(/(Degraded|Suspect|No signal)/)?.[0]}"; HR and temperature sensors online`;
      }, true);
    await nav("/analysis");
    await check("E2E-S3-02", ["S3-02"], "Analysis reports an inconsistent reading (sensor issue), no vital deviation, reliability Low",
      "READING_INCONSISTENT with 'Confirmation needed'; 0 vital-deviation findings; reliability Low", async () => {
        const level = await expectText('[data-testid="analysis-level"]', /CAUTION/);
        const inc = await text('[data-testid="finding-READING_INCONSISTENT:spo2"]');
        const vital = await count('[data-testid^="finding-VITAL_OUT_OF_RANGE"]');
        const rel = await text('[data-testid="reliability-label"]');
        if (!/Confirmation needed/.test(inc) || vital !== 0 || rel !== "Low") throw new Error(`vital=${vital} reliability=${rel}`);
        return `level ${level}; inconsistent-reading finding with confirmation request; ${vital} vital-sign findings; reliability ${rel}`;
      }, true);
    await nav("/response");
    await check("E2E-S3-03", ["S3-03"], "Response asks to confirm the SpO₂ measurement; medical support not yet required",
      "confirmation box for SpO₂; 'not yet required'; PROC-SC-01", async () => {
        const sup = await expectText('[data-testid="medical-support"]', /not yet required/);
        const box = await count('[data-testid="confirm-spo2"]');
        const sc = await count('[data-testid="procedure-PROC-SC-01"]');
        if (box !== 1 || sc !== 1) throw new Error(`confirm box=${box} PROC-SC-01=${sc}`);
        return `"${await headline('[data-testid="medical-support"]')}"; SpO₂ confirmation requested; PROC-SC-01 shown`;
      }, true);
    await check("E2E-S3-04", ["S3-04"], "Confirmation reading attributes the values to the sensor; SpO₂ excluded; ADVISORY",
      "'sensor artifact'; 'not required'; Monitoring level ADVISORY; SpO₂ card 'Excluded'", async () => {
        await page.click('[data-testid="confirm-spo2"] button:has-text("Take confirmation reading")');
        const res = await expectText('[data-testid="confirmation-result"]', /sensor artifact/);
        await expectText('[data-testid="medical-support"]', /not required/);
        const sup = await headline('[data-testid="medical-support"]');
        await nav("/");
        const level = await expectText('[data-testid="overall-level"]', /ADVISORY/);
        const card = await expectText('[data-testid="vital-card-spo2"]', /Excluded/);
        return `confirmation reading ${res.match(/(\d+)\s*%/)?.[1]} % — "${res.match(/Not reproduced — sensor artifact/)?.[0]}"; "${sup}"; level ${level}; SpO₂ card "${card.match(/Excluded — sensor artifact/)?.[0]}"`;
      }, true);
    await nav("/comms");
    await check("E2E-S3-06", ["S3-06"], "Informational report contains the crew confirmation and resolved findings",
      "report text: 'RESOLVED BY CREW CONFIRMATION', 'CONFIRMATIONS', 'For information'; priority routine", async () => {
        await page.click('[data-testid="generate-report"]');
        const preview = await text('[data-testid="report-preview"]');
        const priority = await page.locator("#priority").inputValue();
        for (const s of ["RESOLVED BY CREW CONFIRMATION", "CONFIRMATIONS", "For information"]) if (!preview.includes(s)) throw new Error(`missing "${s}"`);
        if (priority !== "routine") throw new Error(`priority ${priority}`);
        return `report includes resolved findings, the confirmation and "For information"; priority ${priority}`;
      }, true);
    await nav("/");
    await check("E2E-S3-05", ["S3-05"], "If the crew cannot re-measure, medical support is recommended",
      "'Request medical support'; PROC-ESC-01 added", async () => {
        await page.click('[data-testid="simulate-sensor-fault"]');
        await expectText('[data-testid="overall-level"]', /CAUTION/);
        await page.waitForTimeout(3000);
        await nav("/response");
        await page.click('[data-testid="confirm-spo2"] button:has-text("Unable to re-measure")');
        const sup = await expectText('[data-testid="medical-support"]', /Request medical support/);
        const esc = await count('[data-testid="procedure-PROC-ESC-01"]');
        if (esc !== 1) throw new Error("PROC-ESC-01 missing");
        return `"${await headline('[data-testid="medical-support"]')}"; PROC-ESC-01 added`;
      }, true);
  } finally {
    const browserVersion = browser.version();
    await browser.close();
    server.stop();
    const summary = {
      generatedBy: "scripts/e2e-scenarios.cjs",
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
    fs.writeFileSync(path.join(OUT, "e2e-results.json"), JSON.stringify(summary, null, 2) + "\n");
    console.log(`\n${summary.passed}/${results.length} browser checks passed · page errors: ${pageErrors.length} · ${summary.durationSec} s`);
    process.exitCode = summary.failed || pageErrors.length ? 1 : 0;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
