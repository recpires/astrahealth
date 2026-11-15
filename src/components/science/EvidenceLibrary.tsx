"use client";

import { useState } from "react";
import { BookOpenCheck, ExternalLink, FileText, Quote } from "lucide-react";
import { EVIDENCE_LIBRARY, TOPIC_LABEL } from "@/config/evidence-library";
import type { EvidenceItem, EvidenceLink, EvidenceTopic } from "@/lib/science/types";
import { Badge, Panel, cx } from "@/components/ui/primitives";
import { ProvenanceBadge } from "@/components/science/Provenance";

type Filter = "all" | EvidenceTopic;

const TOPIC_TONE = { cardiovascular: "warning", hypoxia: "advisory", "medical-capability": "sensor" } as const;

function LinkButton({ link }: { link: EvidenceLink }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
        link.kind === "pdf" ? "border-accent/50 bg-accent/10 text-accent hover:bg-accent/20" : "border-line-strong text-ink-muted hover:text-ink",
      )}
    >
      {link.kind === "pdf" ? <FileText aria-hidden className="h-3.5 w-3.5" /> : <ExternalLink aria-hidden className="h-3.5 w-3.5" />}
      {link.label}
    </a>
  );
}

function EvidenceCard({ item }: { item: EvidenceItem }) {
  return (
    <article className="rounded-xl border border-level-nominal/30 bg-space-850/70 p-4" data-testid={`evidence-${item.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <ProvenanceBadge kind="real-scientific" />
        <Badge tone={TOPIC_TONE[item.topic]}>{TOPIC_LABEL[item.topic]}</Badge>
        <Badge tone="neutral">{item.documentType}</Badge>
      </div>
      <h3 className="mt-2 text-base font-semibold leading-snug text-ink">{item.title}</h3>
      <dl className="mt-1 space-y-0.5 text-xs text-ink-muted">
        <div>
          <dt className="inline text-ink-faint">Source: </dt>
          <dd className="inline">{item.source}</dd>
        </div>
        <div>
          <dt className="inline text-ink-faint">Authors: </dt>
          <dd className="inline">
            {item.authors}
            <span className="text-ink-faint"> · </span>
            {item.date}
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        {item.links.map((l) => (
          <LinkButton key={l.url} link={l} />
        ))}
      </div>

      <blockquote className="mt-4 rounded-lg border-l-2 border-accent/70 bg-space-950/50 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Official risk statement (verbatim)</p>
        <p className="mt-1 text-sm italic text-ink">“{item.riskStatement.text}”</p>
        <p className="mt-1 text-[11px] text-ink-faint">{item.riskStatement.where}</p>
      </blockquote>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
            <Quote aria-hidden className="h-3.5 w-3.5" /> Key points (verbatim quotes)
          </p>
          <ul className="mt-1.5 space-y-2">
            {item.keyQuotes.map((q) => (
              <li key={q.text} className="text-xs leading-relaxed text-ink-muted">
                “{q.text}”<span className="block text-[11px] text-ink-faint">— {q.where}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">How ASTRA Health uses it</p>
          <p className="mt-1.5 text-sm text-ink-muted">{item.useInAstra}</p>
          <Badge tone="caution" className="mt-2">
            No threshold derived
          </Badge>
          {item.related.length > 0 && (
            <>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Related official records</p>
              <ul className="mt-1 space-y-1">
                {item.related.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-level-warning">Limitations</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-ink-muted">
            {item.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-ink-faint">Links and quotes verified against the official source on {item.verifiedOn}.</p>
    </article>
  );
}

export function EvidenceLibrary() {
  const [filter, setFilter] = useState<Filter>("all");
  const items = EVIDENCE_LIBRARY.filter((e) => filter === "all" || e.topic === filter);
  const filters: Filter[] = ["all", "cardiovascular", "hypoxia", "medical-capability"];
  return (
    <Panel
      title="NASA Human Research Program — evidence library"
      eyebrow="Real scientific evidence · official sources"
      icon={BookOpenCheck}
      tone="nominal"
      actions={<ProvenanceBadge kind="real-scientific" className="hidden sm:inline-flex" />}
    >
      <p className="text-sm text-ink-muted">
        Official HRP evidence reports and risk pages on the risks ASTRA Health relates to. They are shown as scientific context with
        their source, link and limitations. ASTRA Health does not derive any threshold from them and does not present any of its
        checklists as NASA-approved.
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter evidence by topic">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={cx(
              "rounded-md border px-2.5 py-1 text-xs",
              filter === f ? "border-accent/60 bg-accent/10 text-accent" : "border-line text-ink-muted hover:text-ink",
            )}
          >
            {f === "all" ? `All (${EVIDENCE_LIBRARY.length})` : TOPIC_LABEL[f]}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-4">
        {items.map((item) => (
          <EvidenceCard key={item.id} item={item} />
        ))}
      </div>
    </Panel>
  );
}
