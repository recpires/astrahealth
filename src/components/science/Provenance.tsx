import { Database, FlaskConical, Layers, ScrollText } from "lucide-react";
import { PROVENANCE, PROVENANCE_KINDS } from "@/config/data-provenance";
import type { ProvenanceKind } from "@/lib/science/types";
import { Badge, Panel, cx } from "@/components/ui/primitives";
import { TONES, type ToneName } from "@/components/ui/levels";

export const PROVENANCE_TONE: Record<ProvenanceKind, ToneName> = {
  "simulated-data": "accent",
  "real-scientific": "nominal",
  "demo-rule": "caution",
};

const ICONS = { "simulated-data": Database, "real-scientific": FlaskConical, "demo-rule": ScrollText } as const;

export function ProvenanceBadge({ kind, className }: { kind: ProvenanceKind; className?: string }) {
  return (
    <Badge tone={PROVENANCE_TONE[kind]} className={className}>
      {PROVENANCE_KINDS[kind].label}
    </Badge>
  );
}

/** Three cards explaining the three kinds of content. */
export function ProvenanceLegend() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-testid="provenance-legend">
      {(Object.keys(PROVENANCE_KINDS) as ProvenanceKind[]).map((kind) => {
        const Icon = ICONS[kind];
        const t = TONES[PROVENANCE_TONE[kind]];
        const examples = PROVENANCE.filter((p) => p.kind === kind);
        return (
          <section key={kind} className={cx("rounded-xl border bg-space-900/85 p-4", t.border)}>
            <div className="flex items-center gap-2">
              <span className={cx("grid h-8 w-8 place-items-center rounded-lg border", t.border, t.bg)}>
                <Icon aria-hidden className={cx("h-4 w-4", t.text)} />
              </span>
              <h2 className={cx("text-sm font-semibold uppercase tracking-wider", t.text)}>{PROVENANCE_KINDS[kind].label}</h2>
            </div>
            <p className="mt-2 text-sm text-ink-muted">{PROVENANCE_KINDS[kind].description}</p>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-ink-faint">
              {examples.map((e) => (
                <li key={e.item}>{e.item}</li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Detailed table: item · category · source · used by. */
export function ProvenanceTable() {
  return (
    <Panel title="What is what in ASTRA Health" eyebrow="Data & rules provenance" icon={Layers}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm" data-testid="provenance-table">
          <thead className="text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            <tr>
              <th className="py-2 pr-3">Content</th>
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Source</th>
              <th className="py-2">Used by</th>
            </tr>
          </thead>
          <tbody>
            {PROVENANCE.map((p) => (
              <tr key={p.item} className="border-t border-line/60 align-top">
                <td className="py-2 pr-3 text-ink">{p.item}</td>
                <td className="py-2 pr-3">
                  <ProvenanceBadge kind={p.kind} />
                </td>
                <td className="py-2 pr-3 font-mono text-[11px] text-ink-muted">{p.source}</td>
                <td className="py-2 text-xs text-ink-muted">{p.usedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
