#!/usr/bin/env node
/**
 * Accessibility audit of every page of ASTRA Health (tested demo + FUTURE modules).
 *
 *   npm run build
 *   npm run test:a11y          # starts `next start` on a free port, or uses BASE_URL if set
 *
 * 1. axe-core (WCAG 2.0 / 2.1 / 2.2, levels A and AA) on every route at desktop (1440 × 900) and phone (390 × 844)
 *    widths, plus the interactive states that matter in the demo (incident running, report generated,
 *    assessment result, EVA event, readiness after actions).
 * 2. Keyboard pass on every route: Tab through the page, check that each stop shows a visible focus
 *    indicator and that focus is not trapped.
 *
 * Output: docs/test-results/a11y/a11y-results.json and docs/ACCESSIBILITY.md / docs/ACCESSIBILITY.pt-BR.md.
 * Exit code 1 if axe reports any violation or the keyboard pass finds a problem.
 */
const path = require("node:path");
const fs = require("node:fs");
const { spawn, execSync } = require("node:child_process");
const net = require("node:net");

let chromium, AxeBuilder;
try {
  ({ chromium } = require("playwright"));
  ({ AxeBuilder } = require("@axe-core/playwright"));
} catch {
  console.error("Needs Playwright with Chromium and @axe-core/playwright (npm install).");
  process.exit(1);
}

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "docs", "test-results", "a11y");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const ROUTES = ["/", "/analysis", "/response", "/comms", "/science", "/future", "/future/journal", "/future/assess", "/future/profile", "/future/eva", "/future/readiness"];

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

/** Interactive states, reached by clicking like a user would. */
const STATES = [
  {
    id: "incident-monitoring",
    label: "Monitoring during a vital-sign incident",
    route: "/",
    run: async (page) => {
      await page.click('[data-testid="simulate-incident"]');
      await page.click('header button:has-text("60×")');
      await page.waitForFunction(() => /WARNING/.test(document.querySelector('[data-testid="overall-level"]')?.textContent ?? ""), null, { timeout: 60_000 });
      await page.click('header button:has-text("10×")');
    },
  },
  { id: "incident-analysis", label: "Analysis with active findings", route: "/analysis", continues: true },
  { id: "incident-response", label: "Response with medical support and checklists", route: "/response", continues: true },
  {
    id: "report-generated",
    label: "Earth Link with a generated and queued report",
    route: "/comms",
    continues: true,
    run: async (page) => {
      await page.click('[data-testid="generate-report"]');
      await page.click('[data-testid="queue-report"]');
    },
  },
  {
    id: "assessment-result",
    label: "FUTURE 02 assessment result with review",
    route: "/future/assess",
    run: async (page) => {
      await page.click('label:has([data-testid="assess-warning-fainting"])');
      await page.click('[data-testid="assess-submit"]');
      await page.waitForSelector('[data-testid="assess-result"]');
    },
  },
  {
    id: "eva-event",
    label: "FUTURE 04 EVA during an event",
    route: "/future/eva",
    run: async (page) => {
      await page.click('[data-testid="eva-plan"]');
      await page.fill('[data-testid="eva-reason"]', "Accessibility audit");
      await page.click('[data-testid="eva-go"]');
      await page.click('[data-testid="eva-raise-EV-UNWELL"]');
      await page.waitForSelector('[data-testid="eva-event-EV-UNWELL"]');
    },
  },
  {
    id: "readiness-after-actions",
    label: "FUTURE 05 with audit entries and tamper test",
    route: "/future/readiness",
    continues: true,
    run: async (page) => {
      await page.click('[data-testid="tamper-test"]');
    },
  },
];

async function axe(page) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return {
    violations: r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      helpUrl: v.helpUrl,
      tags: v.tags.filter((t) => t.startsWith("wcag")),
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
      summary: v.nodes[0]?.failureSummary?.split("\n").slice(0, 3).join(" ") ?? "",
    })),
    passes: r.passes.length,
    incomplete: r.incomplete.map((i) => ({ id: i.id, nodes: i.nodes.length })),
  };
}

async function keyboardPass(page, maxStops = 250) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.activeElement?.blur?.();
  });
  await page.mouse.click(2, 2);
  const stops = [];
  const problems = [];
  let first = null;
  for (let i = 0; i < maxStops; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const ring = (cs) => (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== "none");
      const r = el.getBoundingClientRect();
      // A visually hidden input (radio/checkbox drawn as a chip) must show focus on its visible label.
      const hidden = r.width <= 2 || r.height <= 2 || getComputedStyle(el).clip === "rect(0px, 0px, 0px, 0px)";
      const label = el.closest("label");
      const visibleFocus = hidden ? Boolean(label && ring(getComputedStyle(label))) : Boolean(ring(getComputedStyle(el)));
      // Stable identity: stamp each element the first time it receives focus.
      window.__a11yStop = window.__a11yStop || 0;
      if (!el.dataset.a11yStop) el.dataset.a11yStop = String(++window.__a11yStop);
      const name = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("data-testid") || el.getAttribute("name") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
      const box = hidden && label ? label.getBoundingClientRect() : r;
      // WCAG 2.4.11: the focused element must not be entirely hidden by sticky content (e.g. the header).
      const pts = [
        [box.left + box.width / 2, box.top + box.height / 2],
        [box.left + 2, box.top + 2],
        [box.right - 2, box.bottom - 2],
      ].filter(([x, y]) => x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight);
      const target = hidden && label ? label : el;
      const obscured = pts.length > 0 && pts.every(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        return hit && !target.contains(hit) && !hit.contains(target);
      });
      return {
        key: el.dataset.a11yStop,
        name: `${el.tagName.toLowerCase()} "${name}"`,
        visibleFocus,
        inViewport: box.bottom > 0 && box.top < window.innerHeight,
        obscured,
      };
    });
    if (!info) continue;
    if (first && info.key === first) break; // wrapped around: no trap
    if (!first) first = info.key;
    stops.push(info.name);
    if (!info.visibleFocus) problems.push(`no visible focus indicator on ${info.name}`);
    if (!info.inViewport) problems.push(`focused element not scrolled into view: ${info.name}`);
    if (info.inViewport && info.obscured) problems.push(`focused element hidden behind other content: ${info.name}`);
  }
  const unique = new Set(stops).size;
  if (stops.length >= 10 && unique < stops.length / 3) problems.push("focus seems trapped (few distinct stops repeated)");
  return { stops: stops.length, problems: [...new Set(problems)] };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch();
  const results = { pages: [], states: [], keyboard: [], errors: [] };
  const t0 = Date.now();
  try {
    for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
      const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
      const page = await ctx.newPage();
      for (const route of ROUTES) {
        await page.goto(`${server.url}${route}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(600);
        const r = await axe(page);
        results.pages.push({ route, viewport: vpName, ...r });
        console.log(`${r.violations.length ? "FAIL" : "PASS"} axe ${vpName.padEnd(7)} ${route.padEnd(18)} ${r.violations.map((v) => `${v.id}(${v.nodes})`).join(", ")}`);
      }
      await ctx.close();
    }

    const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    for (const st of STATES) {
      try {
      if (st.continues) {
        await page.click(`nav[aria-label="Modules"] a[href="${st.route}"]`).catch(() => page.goto(`${server.url}${st.route}`));
        await page.waitForURL((u) => new URL(u).pathname === st.route);
      } else {
        await page.goto(`${server.url}${st.route}`, { waitUntil: "networkidle" });
      }
      await page.waitForTimeout(500);
      if (st.run) await st.run(page);
      await page.waitForTimeout(500);
      const r = await axe(page);
      results.states.push({ id: st.id, label: st.label, route: st.route, ...r });
      console.log(`${r.violations.length ? "FAIL" : "PASS"} axe state   ${st.id.padEnd(24)} ${r.violations.map((v) => `${v.id}(${v.nodes})`).join(", ")}`);
      } catch (e) {
        results.errors.push(`state ${st.id}: ${String(e.message ?? e).split("\n")[0]}`);
        console.log(`FAIL state ${st.id} could not be reached: ${String(e.message ?? e).split("\n")[0]}`);
      }
    }
    await ctx.close();

    const kctx = await browser.newContext({ viewport: VIEWPORTS.desktop, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const kpage = await kctx.newPage();
    for (const route of ROUTES) {
      await kpage.goto(`${server.url}${route}`, { waitUntil: "networkidle" });
      await kpage.waitForTimeout(400);
      let r;
      try {
        r = await keyboardPass(kpage);
      } catch (e) {
        r = { stops: 0, problems: [`keyboard pass failed: ${String(e.message ?? e).split("\n")[0]}`] };
      }
      results.keyboard.push({ route, ...r });
      console.log(`${r.problems.length ? "FAIL" : "PASS"} keyboard ${route.padEnd(18)} ${r.stops} stops ${r.problems.slice(0, 3).join("; ")}`);
    }
    await kctx.close();
  } catch (e) {
    results.errors.push(`audit aborted: ${String(e.message ?? e).split("\n")[0]}`);
  } finally {
    const version = browser.version();
    await browser.close();
    server.stop();
    let commit = "unknown";
    try {
      commit = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
    } catch {}
    const axeVersion = JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules", "axe-core", "package.json"), "utf8")).version;
    const summary = {
      generatedBy: "scripts/a11y-audit.cjs",
      date: new Date().toISOString(),
      commit,
      browser: `Chromium ${version}`,
      axeCore: axeVersion,
      standard: TAGS,
      durationSec: Math.round((Date.now() - t0) / 1000),
      axeChecks: results.pages.length + results.states.length,
      axeViolations: [...results.pages, ...results.states].reduce((n, p) => n + p.violations.length, 0),
      keyboardProblems: results.keyboard.reduce((n, k) => n + k.problems.length, 0),
      expected: { axeChecks: ROUTES.length * Object.keys(VIEWPORTS).length + STATES.length, keyboardPages: ROUTES.length },
      ...results,
    };
    fs.writeFileSync(path.join(OUT, "a11y-results.json"), JSON.stringify(summary, null, 2) + "\n");
    writeReports(summary);
    console.log(`\naxe: ${summary.axeChecks} page/state checks, ${summary.axeViolations} violation types · keyboard: ${summary.keyboardProblems} problem(s) · ${summary.durationSec} s`);
    const complete = summary.axeChecks === summary.expected.axeChecks && summary.keyboard.length === summary.expected.keyboardPages && !summary.errors.length;
    if (!complete) console.log(`INCOMPLETE audit: ${summary.axeChecks}/${summary.expected.axeChecks} axe checks, ${summary.keyboard.length}/${summary.expected.keyboardPages} keyboard pages, errors: ${summary.errors.join(" | ")}`);
    process.exitCode = summary.axeViolations || summary.keyboardProblems || !complete ? 1 : 0;
  }
}

function writeReports(s) {
  const esc = (x) => String(x).replaceAll("|", "\\|");
  for (const en of [true, false]) {
    const L = (a, b) => (en ? a : b);
    const o = [];
    o.push(`# ${L("ASTRA Health — accessibility audit", "ASTRA Health — auditoria de acessibilidade")}`);
    o.push("");
    o.push(`> 🌐 ${en ? "[Versão em português](ACCESSIBILITY.pt-BR.md)" : "[English version](ACCESSIBILITY.md)"}`);
    o.push("");
    o.push(
      L(
        `Generated by \`scripts/a11y-audit.cjs\` (\`npm run test:a11y\`) on ${s.date.slice(0, 10)} · code \`${s.commit}\` · ${s.browser} · axe-core ${s.axeCore}. Raw results: [a11y-results.json](test-results/a11y/a11y-results.json).`,
        `Gerado por \`scripts/a11y-audit.cjs\` (\`npm run test:a11y\`) em ${s.date.slice(0, 10)} · código \`${s.commit}\` · ${s.browser} · axe-core ${s.axeCore}. Resultados brutos: [a11y-results.json](test-results/a11y/a11y-results.json).`,
      ),
    );
    o.push("");
    o.push(`## ${L("Summary", "Resumo")}`);
    o.push("");
    o.push(`| ${L("Check", "Verificação")} | ${L("Scope", "Escopo")} | ${L("Result", "Resultado")} |`);
    o.push("|---|---|---|");
    o.push(`| axe-core — WCAG 2.0/2.1/2.2 A + AA | ${L(`${ROUTES.length} pages × desktop and phone + ${s.states.length} interactive states`, `${ROUTES.length} páginas × desktop e celular + ${s.states.length} estados interativos`)} (${s.axeChecks}) | ${s.axeViolations ? `❌ ${s.axeViolations}` : L("✅ 0 violations", "✅ 0 violações")} |`);
    o.push(`| ${L("Keyboard: visible focus, no trap", "Teclado: foco visível, sem armadilha")} | ${L(`${ROUTES.length} pages, Tab through each`, `${ROUTES.length} páginas, Tab em cada uma`)} | ${s.keyboardProblems ? `❌ ${s.keyboardProblems}` : L("✅ no problem", "✅ nenhum problema")} |`);
    o.push("");
    o.push(`## ${L("axe-core by page", "axe-core por página")}`);
    o.push("");
    o.push(`| ${L("Page", "Página")} | Desktop | ${L("Phone", "Celular")} |`);
    o.push("|---|---|---|");
    for (const r of ROUTES) {
      const cell = (vp) => {
        const p = s.pages.find((x) => x.route === r && x.viewport === vp);
        return p.violations.length ? `❌ ${p.violations.map((v) => v.id).join(", ")}` : `✅ (${p.passes} ${L("rules passed", "regras aprovadas")})`;
      };
      o.push(`| \`${r}\` | ${cell("desktop")} | ${cell("phone")} |`);
    }
    o.push("");
    o.push(`## ${L("Interactive states", "Estados interativos")}`);
    o.push("");
    o.push(`| ${L("State", "Estado")} | ${L("Page", "Página")} | axe |`);
    o.push("|---|---|---|");
    for (const st of s.states) o.push(`| ${esc(st.label)} | \`${st.route}\` | ${st.violations.length ? `❌ ${st.violations.map((v) => v.id).join(", ")}` : "✅"} |`);
    o.push("");
    o.push(`## ${L("Keyboard", "Teclado")}`);
    o.push("");
    o.push(`| ${L("Page", "Página")} | ${L("Tab stops checked", "Paradas de Tab verificadas")} | ${L("Result", "Resultado")} |`);
    o.push("|---|---|---|");
    for (const k of s.keyboard) o.push(`| \`${k.route}\` | ${k.stops} | ${k.problems.length ? `❌ ${esc(k.problems.join("; "))}` : "✅"} |`);
    o.push("");
    const all = [...s.pages, ...s.states].flatMap((p) => p.violations);
    if (all.length) {
      o.push(`## ${L("Violations", "Violações")}`);
      o.push("");
      for (const v of all) o.push(`- **${v.id}** (${v.impact}) — ${esc(v.help)} · ${v.nodes} ${L("element(s)", "elemento(s)")}: \`${esc(v.targets.join("`, `"))}\``);
      o.push("");
    }
    o.push(`## ${L("What was fixed in this audit", "O que foi corrigido nesta auditoria")}`);
    o.push("");
    for (const line of en ? FIXES_EN : FIXES_PT) o.push(`- ${line}`);
    o.push("");
    o.push(`## ${L("Limits", "Limites")}`);
    o.push("");
    for (const line of en
      ? [
          "Automated tools find only part of the accessibility problems. No screen-reader session (NVDA, JAWS, VoiceOver) and no test with users with disabilities were done.",
          "Charts (Recharts) are visual; the same values are available as text on each page (current values, tables, event lists), but the charts themselves have no data table alternative.",
          "The interface is in English only.",
          "Colour contrast is checked by axe on what is on screen at audit time; colours used only in other states were checked by reading the theme tokens (see below).",
        ]
      : [
          "Ferramentas automáticas encontram só parte dos problemas de acessibilidade. Não houve sessão com leitor de tela (NVDA, JAWS, VoiceOver) nem teste com pessoas com deficiência.",
          "Os gráficos (Recharts) são visuais; os mesmos valores aparecem em texto em cada página (valores atuais, tabelas, listas de eventos), mas os gráficos em si não têm tabela de dados alternativa.",
          "A interface está só em inglês.",
          "O contraste de cores é verificado pelo axe no que está na tela no momento da auditoria; cores usadas só em outros estados foram conferidas pelos tokens do tema (abaixo).",
        ])
      o.push(`- ${line}`);
    o.push("");
    fs.writeFileSync(path.join(ROOT, "docs", en ? "ACCESSIBILITY.md" : "ACCESSIBILITY.pt-BR.md"), o.join("\n"));
  }
}

// Problems found by the first run of this audit and fixed (kept so the report keeps the history).
const FIXES_EN = [
  "**Label in name (WCAG 2.5.3)** — the header logo link had an accessible name (“ASTRA Health home”) different from its visible text; it now uses the visible text.",
  "**Definition lists (WCAG 1.3.1)** — invalid `<dl>` markup in Science & Limits (evidence cards, OSDR source), the Earth Link message timeline and the Space Health Profile was restructured into proper term / description pairs.",
  "**Scrollable regions (WCAG 2.1.1)** — wide tables that scroll sideways on phones (journal history, rule sets, audit trail, EVA decisions, provenance, provisional thresholds) are now focusable labelled regions, so they can be scrolled with the keyboard.",
  "**Target size (WCAG 2.5.8)** — the warning-sign checkboxes of the symptom assessment (13 × 13 px) became full-width options at least 36 px tall.",
  "**Visible focus (WCAG 2.4.7)** — text fields and selects of the FUTURE modules now show a focus ring, and chip-style options (symptoms, warning signs, ratings, OSDR file chooser) show focus on their visible label.",
  "**Focus not obscured (WCAG 2.4.11) and reflow (1.4.10)** — on phones the sticky header covered more than half of the screen; it now scrolls away below 768 px, and from 768 px `scroll-padding-top` keeps focused elements clear of it. The keyboard pass now fails if a focused element is hidden behind other content (checked with a negative control).",
];
const FIXES_PT = [
  "**Rótulo no nome (WCAG 2.5.3)** — o link do logo no cabeçalho tinha nome acessível (“ASTRA Health home”) diferente do texto visível; agora usa o texto visível.",
  "**Listas de definição (WCAG 1.3.1)** — marcação `<dl>` inválida em Science & Limits (cartões de evidência, fonte do OSDR), na linha do tempo das mensagens do Earth Link e no Perfil de Saúde Espacial foi reorganizada em pares termo / descrição.",
  "**Regiões roláveis (WCAG 2.1.1)** — tabelas largas que rolam para o lado no celular (histórico do diário, conjuntos de regras, trilha de auditoria, decisões de EVA, procedência, limites provisórios) agora são regiões rotuladas que recebem foco e podem ser roladas pelo teclado.",
  "**Tamanho do alvo (WCAG 2.5.8)** — as caixas de sinais de alerta da avaliação de sintomas (13 × 13 px) viraram opções de largura total com pelo menos 36 px de altura.",
  "**Foco visível (WCAG 2.4.7)** — campos de texto e seletores dos módulos FUTURE mostram um anel de foco, e opções em formato de botão (sintomas, sinais de alerta, notas 1–5, escolha de arquivo do OSDR) mostram o foco no rótulo visível.",
  "**Foco não encoberto (WCAG 2.4.11) e refluxo (1.4.10)** — no celular o cabeçalho fixo cobria mais da metade da tela; abaixo de 768 px ele agora rola junto com a página, e a partir de 768 px o `scroll-padding-top` mantém o elemento focado fora dele. A passagem por teclado agora falha se um elemento focado ficar escondido atrás de outro conteúdo (verificado com controle negativo).",
];

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
