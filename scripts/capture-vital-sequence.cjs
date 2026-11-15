#!/usr/bin/env node
/**
 * Captures the COMPLETE step-by-step sequence of Scenario 2 (simulated vital-sign
 * deviation): MEASURE → UNDERSTAND → ACT → COMMUNICATE, including every Earth-link
 * message state. The simulation is paused at each step so every frame is consistent.
 *
 *   npm run build && npm run start          # in one terminal
 *   npm run screenshots:sequence            # in another (BASE_URL defaults to http://localhost:3000)
 *
 * Output: docs/screenshots/sequence-vital-deviation/*.png (16:9, 1920×1080 layout at 1.5×).
 * All data shown is simulated demonstration data.
 */
const path = require("node:path");
const fs = require("node:fs");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "docs", "screenshots", "sequence-vital-deviation");
const WIDTH = Number(process.env.SHOT_WIDTH || 1920);
const HEIGHT = Math.round((WIDTH * 9) / 16);
const SCALE = Number(process.env.SHOT_SCALE || 1.5);
const TIMEOUT = 90_000;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (f.endsWith(".png")) fs.unlinkSync(path.join(OUT, f));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: SCALE });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let n = 0;

  const shot = async (name, { scrollTo } = {}) => {
    if (scrollTo) {
      await page.locator(scrollTo).first().evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.evaluate(() => window.scrollBy(0, -80));
    } else {
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await page.waitForTimeout(450);
    n += 1;
    const file = `${String(n).padStart(2, "0")}-${name}.png`;
    await page.screenshot({ path: path.join(OUT, file) });
    console.log(`captured ${file}`);
  };
  const nav = async (href) => {
    await page.click(`nav a[href="${href}"]`);
    await page.waitForURL((u) => new URL(u).pathname === href);
    await page.waitForTimeout(500);
  };
  const speed = (x) => page.click(`header button:has-text("${x}×")`);
  const running = async (on) => {
    const label = on ? "Resume simulation" : "Pause simulation";
    const btn = page.locator(`header button[aria-label="${label}"]`);
    if (await btn.count()) await btn.click();
  };
  const waitLevel = (level) =>
    page.waitForFunction((l) => document.querySelector('[data-testid="overall-level"]')?.textContent?.includes(l), level, {
      timeout: TIMEOUT,
    });
  const waitMessage = (state, minProgress = 0) =>
    page.waitForFunction(
      ([s, p]) => {
        const row = document.querySelector('[data-testid="message-MSG-001"]');
        if (!row || row.getAttribute("data-state") !== s) return false;
        if (p === 0) return true;
        const bar = row.querySelector('[role="progressbar"]');
        return bar ? Number(bar.getAttribute("aria-valuenow")) >= p : false;
      },
      [state, minProgress],
      { timeout: TIMEOUT },
    );

  // ── MEASURE ───────────────────────────────────────────────────────────────
  await page.goto(BASE);
  await page.waitForTimeout(3000);
  await running(false);
  await shot("monitoring-baseline-nominal");

  await running(true);
  await page.click('[data-testid="simulate-incident"]');
  await page.waitForTimeout(1500);
  await running(false);
  await shot("monitoring-incident-started");

  await running(true);
  await waitLevel("CAUTION");
  await page.waitForTimeout(700);
  await running(false);
  await shot("monitoring-first-deviation-caution");

  await running(true);
  await waitLevel("WARNING");
  await page.waitForTimeout(4000);
  await running(false);
  await shot("monitoring-warning");

  // ── UNDERSTAND ────────────────────────────────────────────────────────────
  await nav("/analysis");
  await shot("analysis-findings-and-reliability");
  await shot("analysis-event-history", { scrollTo: 'h2:has-text("Event history")' });

  // ── ACT ───────────────────────────────────────────────────────────────────
  await nav("/response");
  await shot("response-identified-event-medical-support");

  await running(true);
  const steps = [
    ['[data-testid="procedure-PROC-ESC-01"]', 0],
    ['[data-testid="procedure-PROC-VD-01"]', 0],
    ['[data-testid="procedure-PROC-VD-01"]', 1],
    ['[data-testid="procedure-PROC-VD-01"]', 2],
    ['[data-testid="procedure-PROC-VD-01"]', 3],
    ['[data-testid="procedure-PROC-VD-01"]', 4],
  ];
  const check = (sel, i) => page.locator(`${sel} input[type=checkbox]`).nth(i).check();
  for (const [sel, i] of steps) {
    await check(sel, i);
    await page.waitForTimeout(1200);
  }
  await running(false);
  await shot("response-checklist-and-action-log", { scrollTo: '[data-testid="procedure-PROC-ESC-01"]' });

  // ── COMMUNICATE ───────────────────────────────────────────────────────────
  await nav("/comms");
  await page.click('[data-testid="generate-report"]');
  await shot("earth-link-report-generated-text");
  await page.click('[data-testid="report-preview"] button:has-text("json")');
  await shot("earth-link-report-generated-json");

  await page.click('[data-testid="queue-report"]');
  // Tick the "send / prepare report" steps at the moment the report is queued.
  await nav("/response");
  await check('[data-testid="procedure-PROC-ESC-01"]', 1);
  await check('[data-testid="procedure-PROC-VD-01"]', 5);
  await nav("/comms");
  await shot("earth-link-1-awaiting-send");

  await speed(60);
  await running(true);
  await waitMessage("sent", 45);
  await running(false);
  await shot("earth-link-2-sent-in-transit");

  await running(true);
  await waitMessage("received", 30);
  await running(false);
  await shot("earth-link-3-received-by-earth");

  await running(true);
  await waitMessage("response-pending", 45);
  await running(false);
  await shot("earth-link-4-response-pending");

  await running(true);
  await waitMessage("response-received");
  await running(false);
  await shot("earth-link-5-response-received");

  await nav("/response");
  await check('[data-testid="procedure-PROC-ESC-01"]', 2);
  await check('[data-testid="procedure-PROC-ESC-01"]', 3);
  await shot("response-final-checklists-and-action-log", { scrollTo: '[data-testid="action-log"]' });

  await browser.close();
  if (errors.length) {
    console.error("Page errors:\n" + errors.join("\n"));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
