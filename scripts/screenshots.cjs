#!/usr/bin/env node
/**
 * Captures 16:9 presentation screenshots of every module, scenario and the Science & Limits section.
 *
 *   npm run build && npm run start          # in one terminal
 *   npm run screenshots                     # in another (BASE_URL defaults to http://localhost:3000)
 *
 * Requires Playwright with Chromium (`npm i -D playwright && npx playwright install chromium`
 * if it is not already available on your machine). Output: docs/screenshots/*.png
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
const OUT = path.join(__dirname, "..", "docs", "screenshots");
const WIDTH = Number(process.env.SHOT_WIDTH || 1920);
const HEIGHT = Math.round((WIDTH * 9) / 16);
const SCALE = Number(process.env.SHOT_SCALE || 1.5);

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: SCALE });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const shot = async (name, { scrollTo } = {}) => {
    if (scrollTo) {
      await page.locator(scrollTo).first().evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.evaluate(() => window.scrollBy(0, -90));
    } else {
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log(`captured ${name}.png`);
  };
  const nav = async (href) => {
    await page.click(`nav a[href="${href}"]`);
    await page.waitForURL((u) => new URL(u).pathname === href);
    await page.waitForTimeout(500);
  };
  const speed = async (x) => page.click(`header button:has-text("${x}×")`);
  const waitLevel = async (level) =>
    page.waitForFunction((l) => document.querySelector('[data-testid="overall-level"]')?.textContent?.includes(l), level, {
      timeout: 60_000,
    });

  await page.goto(BASE);
  await page.waitForTimeout(2500);

  // Scenario 1 — nominal
  await shot("01-monitoring-nominal");

  // Scenario 2 — vital-sign deviation
  await page.click('[data-testid="simulate-incident"]');
  await waitLevel("WARNING");
  await page.waitForTimeout(4000);
  await speed(1);
  await shot("02-monitoring-vital-deviation");
  await nav("/analysis");
  await shot("03-analysis-vital-deviation");
  await nav("/response");
  await page.locator('[data-testid="procedure-PROC-ESC-01"] input[type=checkbox]').first().check();
  await page.locator('[data-testid="procedure-PROC-VD-01"] input[type=checkbox]').nth(0).check();
  await page.locator('[data-testid="procedure-PROC-VD-01"] input[type=checkbox]').nth(1).check();
  await shot("04-response-vital-deviation");

  // Earth link: several messages in different states.
  await nav("/comms");
  await page.click('button:has-text("Short · 3 min")');
  await speed(60);
  await page.click('[data-testid="generate-report"]');
  await page.click('[data-testid="queue-report"]');
  await page.waitForTimeout(4500);
  await page.fill("#note", "CMO notified. Crew member resting, sensors attached.");
  await page.click('button:has-text("Queue")');
  await page.waitForTimeout(2500);
  await page.click('button:has-text("Simulate outage")');
  await page.fill("#note", "Habitat readouts checked on vehicle display.");
  await page.click('button:has-text("Queue")');
  await page.waitForTimeout(500);
  await speed(1);
  await shot("05-earth-link-queue");
  await page.click('button:has-text("Restore link")');
  await speed(60);
  await page.waitForTimeout(9000);
  await speed(1);
  await shot("06-earth-link-responses");

  // Scenario 3 — sensor fault
  await speed(10);
  await nav("/");
  await page.click('[data-testid="simulate-sensor-fault"]');
  await waitLevel("CAUTION");
  await page.waitForTimeout(5000);
  await speed(1);
  await shot("07-monitoring-sensor-fault");
  await nav("/analysis");
  await shot("08-analysis-sensor-fault");
  await nav("/response");
  await shot("09-response-confirmation-request");
  await page.click('[data-testid="confirm-spo2"] button:has-text("Take confirmation reading")');
  await shot("10-response-sensor-artifact-confirmed");
  await nav("/");
  await shot("11-monitoring-sensor-excluded");
  await nav("/science");
  await shot("12-science-and-limits");
  await shot("13-science-evidence-library", { scrollTo: '[data-testid="evidence-hrp-dcs-hypoxia-2023"]' });
  await shot("14-science-osdr-dataset", { scrollTo: 'h2:has-text("NASA OSDR dataset")' });
  await shot("15-science-provenance", { scrollTo: 'h2:has-text("What is what")' });

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
