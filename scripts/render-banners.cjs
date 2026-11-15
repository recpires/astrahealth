#!/usr/bin/env node
/**
 * Renders the README banners (English and Portuguese) from scripts/banner/banner.html.
 *
 *   npm run banners
 *
 * Output: docs/assets/banner-en.png, docs/assets/banner-pt.png (2400 × 780 px).
 * The banner embeds the team's AI-generated logo (public/brand/astra-health-logo.png),
 * which keeps its "AI-generated" label.
 */
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

const ROOT = path.join(__dirname, "..");
const TEMPLATE = fs.readFileSync(path.join(__dirname, "banner", "banner.html"), "utf8");
const LOGO = pathToFileURL(path.join(ROOT, "public", "brand", "astra-health-logo.png")).href;
const OUT = path.join(ROOT, "docs", "assets");

const chip = (n, label) => `<span class="chip"><b>${n}</b>${label}</span>`;
const arrow = '<span class="arrow">→</span>';

const VARIANTS = {
  en: {
    EYEBROW: "Team ANGARIS · NASA Space Apps Challenge 2026",
    TITLE: "Autonomous Space Health<br/><em>Response Assistant</em>",
    PIPELINE: [chip("01", "MEASURE"), chip("02", "UNDERSTAND"), chip("03", "ACT"), chip("04", "COMMUNICATE")].join(arrow),
    FEATURES: "Vital-sign monitoring · Rule-based analysis · Safety checklists · Earth–Mars link simulator",
    NOTICE: "Demonstration prototype · Simulated data · Not a medical device",
  },
  pt: {
    EYEBROW: "Equipe ANGARIS · NASA Space Apps Challenge 2026",
    TITLE: "Assistente Autônomo de<br/><em>Resposta em Saúde Espacial</em>",
    PIPELINE: [chip("01", "MEDIR"), chip("02", "ENTENDER"), chip("03", "AGIR"), chip("04", "COMUNICAR")].join(arrow),
    FEATURES: "Monitoramento de sinais vitais · Análise por regras · Checklists de segurança · Simulador do link Terra–Marte",
    NOTICE: "Protótipo demonstrativo · Dados simulados · Não é dispositivo médico",
  },
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 520 }, deviceScaleFactor: 1.5 });
  for (const [lang, v] of Object.entries(VARIANTS)) {
    let html = TEMPLATE.replace("LOGO_URL", LOGO).replace('<html lang="en">', `<html lang="${lang === "pt" ? "pt-BR" : "en"}">`);
    for (const [k, val] of Object.entries(v)) html = html.replace(k, val);
    const tmp = path.join(OUT, `.banner-${lang}.html`);
    fs.writeFileSync(tmp, html);
    await page.goto(pathToFileURL(tmp).href);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    const file = path.join(OUT, `banner-${lang}.png`);
    await page.screenshot({ path: file });
    fs.unlinkSync(tmp);
    console.log(`rendered ${path.relative(ROOT, file)}`);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
