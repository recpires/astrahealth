/**
 * Offline service worker (public/sw.js): every route of the app is pre-cached
 * and the worker is served with no-cache headers. Its behaviour (reload with the
 * server stopped) is checked in the browser by scripts/e2e-future.cjs (E2E-OFF-05).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

const ROOT = join(__dirname, "..", "..");
const sw = readFileSync(join(ROOT, "public", "sw.js"), "utf8");

function appRoutes(dir = join(ROOT, "src", "app")): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...appRoutes(p));
    else if (name === "page.tsx") out.push("/" + relative(join(ROOT, "src", "app"), dir).replaceAll("\\", "/"));
  }
  return out.map((r) => (r === "/" ? r : r.replace(/\/$/, ""))).sort();
}

describe("offline service worker", () => {
  it("pre-caches exactly the routes of the app", () => {
    const listed = [...sw.match(/const ROUTES = \[([\s\S]*?)\];/)![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
    expect(listed).toEqual(appRoutes());
  });

  it("tries the network first for pages and data, so online behaviour is unchanged", () => {
    expect(sw).toMatch(/request\.mode === "navigate"[\s\S]*networkFirst\(request, PAGES/);
    expect(sw).toMatch(/isRscRequest\(request, url\)[\s\S]*networkFirst\(request, DATA/);
    expect(sw).toMatch(/const SW_VERSION = "astra-health-sw-v\d+"/);
  });

  it("is served with no-cache headers", async () => {
    const rules = await nextConfig.headers!();
    const rule = rules.find((r) => r.source === "/sw.js")!;
    expect(rule.headers).toEqual(expect.arrayContaining([{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }]));
  });
});
