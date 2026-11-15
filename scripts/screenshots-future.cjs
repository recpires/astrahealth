#!/usr/bin/env node
/**
 * 16:9 presentation screenshots of the FUTURE modules, following the demo script
 * (docs/future/DEMO_SCRIPT.md) step by step, plus a phone capture and a capture taken
 * after the server was stopped (offline reload).
 *
 *   npm run build
 *   npm run screenshots:future       # starts `next start` on a free port (or uses BASE_URL)
 *
 * Output: docs/screenshots/future/*.png (2880 × 1620) and docs/screenshots/future/README.md (captions EN / PT).
 * Requires Playwright with Chromium. All data shown are simulated demo data.
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
const OUT = path.join(ROOT, "docs", "screenshots", "future");
const WIDTH = Number(process.env.SHOT_WIDTH || 1920);
const HEIGHT = Math.round((WIDTH * 9) / 16);
const SCALE = Number(process.env.SHOT_SCALE || 1.5);

const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

async function startServer() {
  if (process.env.BASE_URL) return { url: process.env.BASE_URL, stop: () => {}, canStop: false };
  const port = await freePort();
  const proc = spawn(process.execPath, [path.join(ROOT, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(port)], {
    cwd: ROOT,
    stdio: "ignore",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });
  const url = `http://localhost:${port}`;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return { url, stop: () => proc.kill("SIGKILL"), canStop: true };
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  proc.kill();
  throw new Error("Production server did not start. Run `npm run build` first.");
}

/** [file, English caption, Portuguese caption] in demo order. */
const CAPTIONS = [];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (f.endsWith(".png")) fs.unlinkSync(path.join(OUT, f));
  const server = await startServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: SCALE });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const tid = (id) => `[data-testid="${id}"]`;

  const shot = async (file, en, pt, { scrollTo, offset = 80 } = {}) => {
    if (scrollTo) {
      await page.locator(scrollTo).first().evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.evaluate((o) => window.scrollBy(0, -o), offset);
    } else {
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await page.mouse.move(0, HEIGHT - 1);
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(OUT, file) });
    CAPTIONS.push([file, en, pt]);
    console.log(`captured ${file}`);
  };
  const tab = async (href) => {
    await page.click(`nav[aria-label="FUTURE modules"] a[href="${href}"]`);
    await page.waitForURL((u) => new URL(u).pathname === href);
    await page.waitForTimeout(500);
  };
  const crew = (id) => page.click(tid(`crew-${id}`));

  try {
    await page.goto(`${server.url}/future`);
    await page.waitForSelector(tid("future-clock"));
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(800);

    // 1 — Overview
    await shot(
      "01-overview.png",
      "Platform preview: five FUTURE modules beside the tested demo — offline-first, evidence-based, human-in-the-loop, traceable. Mission day 15, simulated crew of four.",
      "Prévia da plataforma: cinco módulos FUTURE ao lado da demo testada — offline-first, baseados em evidências, com humano no circuito, rastreáveis. Dia 15 da missão, tripulação simulada de quatro pessoas.",
    );

    // 2 — Journal: Crew Member B flags + sleep trend
    await tab("/future/journal");
    await crew("crew-b");
    await shot(
      "02-journal-flags.png",
      "F01 · Health Journal — Crew Member B: demonstration rules flag short sleep and high fatigue for five days in a row; the 14-day trend shows the drop.",
      "F01 · Diário de saúde — Tripulante B: as regras demonstrativas sinalizam sono curto e fadiga alta por cinco dias seguidos; a tendência de 14 dias mostra a queda.",
    );

    // 3 — Journal: Crew Member C check-in with headache
    await crew("crew-c");
    await page.fill(tid("checkin-sleep"), "6.8");
    await page.fill(tid("checkin-fluid"), "1.3");
    await page.locator(tid("checkin-hydration")).getByText("2", { exact: true }).click();
    await page.locator(tid("checkin-fatigue")).getByText("3", { exact: true }).click();
    await page.click(`label:has(${tid("checkin-symptom-headache")})`);
    await page.click(tid("checkin-submit"));
    await page.waitForSelector(tid("checkin-saved"));
    await shot(
      "03-journal-checkin.png",
      "F01 · Crew Member C records today's check-in (headache, feeling poorly hydrated). It is saved on the device; flags update; routines show what is overdue.",
      "F01 · Tripulante C registra o check-in de hoje (dor de cabeça, sensação de pouca hidratação). Fica salvo no dispositivo; os alertas se atualizam; as rotinas mostram o que está atrasado.",
    );

    // 4 — Assessment for Crew Member C
    await tab("/future/assess");
    await crew("crew-c");
    await page.selectOption(tid("assess-symptom"), "headache");
    await page.locator(tid("assess-severity")).getByText("Moderate").click();
    await page.locator(tid("assess-onset")).getByText("Gradually").click();
    await page.locator(tid("assess-trend")).getByText("Worse").click();
    await page.fill(tid("assess-duration"), "20");
    await page.locator(tid("assess-duties")).getByText("Yes").click();
    await page.click(tid("assess-submit"));
    await page.waitForSelector(tid("assess-result"));
    await shot(
      "04-assessment-headache.png",
      "F02 · Symptom Assessment — Crew Member C, moderate headache getting worse: rule set ASTRA-SYM@0.1.0-demo proposes “Inform crew medical officer”, lists the journal facts and NASA references used, and states HIGH uncertainty (no symptom-specific NASA reference).",
      "F02 · Avaliação de sintomas — Tripulante C, dor de cabeça moderada piorando: o conjunto de regras ASTRA-SYM@0.1.0-demo propõe “Informar o oficial médico”, lista os fatos do diário e as referências NASA usadas e declara incerteza ALTA (sem referência NASA específica para o sintoma).",
    );
    await page.click(tid("review-accept"));

    // 5 — Assessment with a warning sign for Crew Member B
    await crew("crew-b");
    await page.selectOption(tid("assess-symptom"), "dizziness");
    await page.locator(tid("assess-severity")).getByText("Moderate").click();
    await page.locator(tid("assess-onset")).getByText("Suddenly").click();
    await page.fill(tid("assess-duration"), "1");
    await page.click(`label:has(${tid("assess-warning-fainting")})`);
    await page.click(tid("assess-submit"));
    await page.waitForSelector(tid("assess-result"));
    await page.click(tid("review-accept"));
    await page.click(tid("assess-queue"));
    await shot(
      "05-assessment-warning-sign.png",
      "F02 · Crew Member B, dizziness with a warning sign: “Medical support now”, urgent report, EVA hold. The cardiovascular risk is quoted word for word from the verified NASA evidence report; the crew medical officer accepted the proposal and queued the urgent report.",
      "F02 · Tripulante B, tontura com sinal de alerta: “Suporte médico agora”, relatório urgente, bloqueio de EVA. O risco cardiovascular é citado palavra por palavra do relatório de evidência da NASA verificado; o oficial médico aceitou a proposta e enviou o relatório urgente à fila.",
      { scrollTo: tid("assess-science") },
    );

    // 6 — Space Health Profile
    await tab("/future/profile");
    await crew("crew-a");
    await shot(
      "06-health-profile.png",
      "F03 · Space Health Profile — nine domains. Each value shows time, origin, quality, trend and validation status. Intracranial pressure, retina imaging and ECG need equipment the demo does not have: “No data”, never simulated.",
      "F03 · Perfil de Saúde Espacial — nove domínios. Cada valor mostra horário, origem, qualidade, tendência e status de validação. Pressão intracraniana, imagem de retina e ECG exigem equipamento que a demo não tem: “Sem dado”, nunca simulado.",
      { scrollTo: tid("profile-summary") },
    );

    // 7 — EVA gate HOLD
    await tab("/future/eva");
    await page.uncheck(tid("eva-crew-crew-c"));
    await page.check(tid("eva-crew-crew-b"));
    await page.click(tid("eva-plan"));
    await page.waitForSelector(tid("eva-proposal"));
    for (const id of ["PRE-03", "PRE-04", "PRE-05", "PRE-06"]) await page.click(tid(`eva-check-${id}`));
    await shot(
      "07-eva-gate-hold.png",
      "F04 · EVA for Crew Members A and B: the pre-EVA checks use the other modules — Crew B has no check-in today and is held by the urgent assessment — so the system proposes HOLD. It is not a medical clearance; the commander decides.",
      "F04 · EVA dos Tripulantes A e B: as verificações pré-EVA usam os outros módulos — B não fez check-in hoje e está bloqueado pela avaliação urgente — então o sistema propõe HOLD. Não é liberação médica; o comandante decide.",
      { scrollTo: tid("eva-phase") },
    );

    // 8 — EVA: Earth link lost, then equipment loss and a crew member unwell (after an override)
    await page.fill(tid("eva-reason"), "Ground-cleared training EVA (demo override)");
    await page.click(tid("eva-go"));
    await page.waitForSelector(tid("eva-raise-EV-LINK-LOST"));
    await page.click(tid("eva-raise-EV-LINK-LOST"));
    await page.locator(tid("eva-event-EV-LINK-LOST")).locator(tid("event-continue")).click();
    await page.uncheck(tid("equip-suit-telemetry"));
    await page.click(tid("eva-raise-EV-UNWELL"));
    await page.waitForSelector(tid("eva-event-EV-UNWELL"));
    await shot(
      "08-eva-event.png",
      "F04 · During the EVA the Earth link is lost and suit telemetry is unavailable; then a crew member feels unwell. Dependent steps switch to their alternatives, an urgent report waits in the queue and the system proposes ending the EVA. The GO override and its reason are in the decision history.",
      "F04 · Durante a EVA o link com a Terra cai e a telemetria do traje fica indisponível; em seguida um tripulante se sente mal. Os passos dependentes passam para as alternativas, um relatório urgente aguarda na fila e o sistema propõe encerrar a EVA. O GO contra a proposta e o motivo ficam no histórico de decisões.",
      { scrollTo: tid("eva-event-EV-UNWELL"), offset: 140 },
    );
    await page.locator(tid("eva-event-EV-UNWELL")).locator(tid("event-terminate")).click();
    await page.click(tid("eva-queue-log"));

    // 9 — Earth link lost: everything waits in the queue, urgent first
    await tab("/future");
    await shot(
      "09-link-lost-queue.png",
      "Earth link lost: every module keeps working on local data. The routine note (link lost), the urgent EVA report and the EVA log wait in the store-and-forward queue — the urgent report is next to send although it was queued later.",
      "Link com a Terra perdido: todos os módulos continuam funcionando com dados locais. A nota de rotina (link perdido), o relatório urgente da EVA e o log da EVA aguardam na fila store-and-forward — o urgente é o próximo a sair, mesmo tendo entrado depois.",
      { scrollTo: tid("outbox-list"), offset: 160 },
    );

    // 10 — Link restored: urgent first
    await page.click(tid("link-toggle"));
    await page.click(tid("advance-15"));
    await shot(
      "10-link-restored.png",
      "Link restored: the urgent EVA report leaves first, then the routine items, in that send order; 15 minutes later all have reached Earth (12-minute one-way delay, simulated). Every transition is in the audit trail.",
      "Link restabelecido: o relatório urgente da EVA sai primeiro, depois os itens de rotina, nessa ordem de envio; 15 minutos depois todos chegaram à Terra (atraso de 12 minutos por sentido, simulado). Cada transição fica na trilha de auditoria.",
      { scrollTo: tid("outbox-list"), offset: 160 },
    );

    // 11 — Readiness
    await tab("/future/readiness");
    await page.click(tid("tamper-test"));
    await shot(
      "11-readiness.png",
      "F05 · Readiness — per crew member: is today's information complete and reviewed? (not a medical clearance). System verification: audit trail intact, rules versioned and PROVISIONAL, every reference resolves offline.",
      "F05 · Prontidão — por tripulante: a informação de hoje está completa e revisada? (não é liberação médica). Verificação do sistema: trilha de auditoria íntegra, regras versionadas e PROVISIONAL, toda referência resolve offline.",
    );

    // 12 — Audit trail
    await shot(
      "12-audit-trail.png",
      "F05 · Traceability — every decision, evidence shown, action and transmission with mission time, rule set and rule ids, evidence ids, input checksum and a chained checksum. The tamper test on a copy detects an edited entry; the trail exports as JSON.",
      "F05 · Rastreabilidade — cada decisão, evidência exibida, ação e transmissão com horário da missão, conjunto de regras e regras acionadas, evidências, checksum das entradas e checksum encadeado. O teste de adulteração numa cópia detecta a entrada editada; a trilha é exportada em JSON.",
      { scrollTo: tid("audit-table"), offset: 200 },
    );

    // 13 — Phone
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    const pp = await phone.newPage();
    await pp.goto(`${server.url}/future/assess`);
    await pp.waitForSelector(tid("future-clock"));
    await pp.locator(tid("assess-severity")).scrollIntoViewIfNeeded();
    await pp.evaluate(() => window.scrollBy(0, -260));
    await pp.waitForTimeout(400);
    await pp.screenshot({ path: path.join(OUT, "13-phone.png") });
    CAPTIONS.push([
      "13-phone.png",
      "The same modules on a phone (390 px wide): no horizontal scrolling; options are large enough to tap and keyboard focus is always visible (see docs/ACCESSIBILITY.md).",
      "Os mesmos módulos no celular (390 px de largura): sem rolagem lateral; opções grandes o suficiente para tocar e foco de teclado sempre visível (veja docs/ACCESSIBILITY.pt-BR.md).",
    ]);
    console.log("captured 13-phone.png");
    await phone.close();

    // 14 — Offline reload with the server stopped
    if (server.canStop) {
      server.stop();
      await context.setOffline(true);
      await page.waitForTimeout(800);
      await page.goto(`${server.url}/future/journal`);
      await page.waitForSelector(tid("future-clock"));
      await crew("crew-c");
      await page.waitForSelector(tid("checkin-saved"));
      await shot(
        "14-offline-reload.png",
        "No server, no network: the page was reloaded after the web server was stopped and the browser taken offline. The service worker serves the app; Crew Member C's check-in is still there (“Available offline”).",
        "Sem servidor e sem rede: a página foi recarregada depois de o servidor ser desligado e o navegador ficar offline. O service worker entrega o app; o check-in do Tripulante C continua lá (“Available offline”).",
      );
    }
  } finally {
    await browser.close();
    server.stop();
  }

  const md = [
    "# FUTURE modules — screenshots",
    "",
    "Generated by `scripts/screenshots-future.cjs` (`npm run screenshots:future`), following [the demo script](../../future/DEMO_SCRIPT.md) ([português](../../future/DEMO_SCRIPT.pt-BR.md)). 2880 × 1620 px (phone: 1170 × 2532 px). All data are simulated demonstration data.",
    "",
    "| # | Screenshot | Caption | Legenda |",
    "|---|---|---|---|",
    ...CAPTIONS.map(([f, en, pt], i) => `| ${i + 1} | [<img src="${f}" width="240" alt="${f}">](${f}) | ${en.replaceAll("|", "\\|")} | ${pt.replaceAll("|", "\\|")} |`),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT, "README.md"), md);
  console.log(`\n${CAPTIONS.length} screenshots · page errors: ${errors.length}${errors.length ? ` — ${errors.join(" | ")}` : ""}`);
  process.exitCode = errors.length ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
