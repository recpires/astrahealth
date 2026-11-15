"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExternalLink, FileUp, Microscope, RotateCcw, ShieldCheck } from "lucide-react";
import { OSDR_SNAPSHOTS } from "@/lib/science/osdr-datasets";
import { OsdrFormatError, formatConcentration, summarizeOsdrMultiplex } from "@/lib/science/osdr";
import type { OsdrSnapshot, OsdrSummary } from "@/lib/science/types";
import { Badge, Button, Panel, cx } from "@/components/ui/primitives";
import { ProvenanceBadge } from "@/components/science/Provenance";

interface ImportedFile {
  accession: string;
  fileName: string;
  summary: OsdrSummary;
}

function SourceIdentification({ snapshot }: { snapshot: OsdrSnapshot }) {
  const row = (label: string, value: React.ReactNode, className = "") => (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink">{value}</dd>
    </div>
  );
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="osdr-source">
      {row("Repository", snapshot.repository)}
      {row(
        "Accession",
        <a href={snapshot.studyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
          {snapshot.accession} <ExternalLink aria-hidden className="h-3.5 w-3.5" />
        </a>,
      )}
      {row("Public release", snapshot.publicReleaseDate ?? "—")}
      {row("Study title", snapshot.title, "sm:col-span-2 xl:col-span-3")}
      {row("Mission", `${snapshot.mission.name ?? "—"} (${snapshot.mission.start ?? "?"} – ${snapshot.mission.end ?? "?"})`)}
      {row(
        "File",
        <a href={snapshot.file.downloadUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-accent hover:underline">
          {snapshot.file.name}
        </a>,
      )}
      {row("Folder", `${snapshot.file.category} · ${snapshot.file.subdirectory ?? "—"}`)}
      {row(
        "SHA-256 (verbatim copy)",
        <span className="font-mono text-xs text-ink-muted" title={snapshot.file.sha256}>
          {snapshot.file.sha256.slice(0, 16)}…{snapshot.file.sha256.slice(-8)}
        </span>,
      )}
      {row("Retrieved on", `${snapshot.retrievedOn} · ${snapshot.importedWith}`)}
      {row(
        "Publications",
        <span className="flex flex-col gap-0.5">
          {snapshot.publications
            .filter((p) => p.doi)
            .map((p) => (
              <a key={p.doi} href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
                {p.title} (doi:{p.doi})
              </a>
            ))}
        </span>,
      )}
    </dl>
  );
}

function SummaryView({ summary, flightWindow }: { summary: OsdrSummary; flightWindow: boolean }) {
  const [selected, setSelected] = useState(summary.analytes[0]?.key ?? "");
  const analyte = summary.analytes.find((a) => a.key === selected) ?? summary.analytes[0];
  const data = analyte.points.map((p) => ({ tp: p.timepoint, mean: p.mean, range: [p.min, p.max] as [number, number] }));
  const firstPost = analyte.points.find((p) => p.phase === "post-flight")?.timepoint;
  const lastPre = [...analyte.points].reverse().find((p) => p.phase === "pre-flight")?.timepoint;
  return (
    <div data-testid="osdr-summary">
      <p className="text-sm text-ink-muted">
        <span className="font-semibold text-ink">{summary.subjects}</span> crew members ·{" "}
        <span className="font-semibold text-ink">{summary.samples}</span> serum samples ·{" "}
        <span className="font-semibold text-ink">{summary.timepoints.length}</span> timepoints ({summary.timepoints.join(", ")}) ·{" "}
        <span className="font-semibold text-ink">{summary.analytes.length}</span> analytes
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Select analyte">
        {summary.analytes.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setSelected(a.key)}
            aria-pressed={a.key === analyte.key}
            className={cx(
              "rounded-md border px-2 py-0.5 text-xs",
              a.key === analyte.key ? "border-level-nominal/60 bg-level-nominal/10 text-level-nominal" : "border-line text-ink-muted hover:text-ink",
            )}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <p className="text-xs text-ink-muted">
            {analyte.label} — mean (line) and min–max range (band) per timepoint, {analyte.unit}
          </p>
          <div className="mt-2 h-56 w-full" role="img" aria-label={`${analyte.label} summary chart (real OSDR data)`}>
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 224 }}>
              <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="#1a3159" strokeDasharray="2 4" vertical={false} />
                {flightWindow && lastPre && firstPost && (
                  <ReferenceArea x1={lastPre} x2={firstPost} fill="#22d3ee" fillOpacity={0.06} stroke="none" label={{ value: "flight", fill: "#7a8fb3", fontSize: 10, position: "insideTop" }} />
                )}
                <XAxis dataKey="tp" tick={{ fill: "#7a8fb3", fontSize: 11 }} stroke="#1a3159" />
                <YAxis tick={{ fill: "#7a8fb3", fontSize: 10 }} stroke="#1a3159" width={84} tickFormatter={(v) => formatConcentration(Number(v))} />
                <Tooltip
                  contentStyle={{ background: "#071226", border: "1px solid #24427a", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#93a8c9" }}
                  itemStyle={{ color: "#e6f1ff" }}
                  formatter={(v, name) =>
                    Array.isArray(v)
                      ? [`${formatConcentration(Number(v[0]))} – ${formatConcentration(Number(v[1]))} ${analyte.unit}`, "min–max"]
                      : [`${formatConcentration(Number(v))} ${analyte.unit}`, String(name)]
                  }
                />
                <Area dataKey="range" stroke="none" fill="#34d399" fillOpacity={0.15} isAnimationActive={false} />
                <Line dataKey="mean" stroke="#34d399" strokeWidth={2} dot={{ r: 3, fill: "#34d399" }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="xl:col-span-2">
          <table className="w-full text-left text-xs" data-testid="osdr-table">
            <thead className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">
              <tr>
                <th className="py-1.5 pr-2">Timepoint</th>
                <th className="py-1.5 pr-2">n</th>
                <th className="py-1.5 pr-2 text-right">Mean</th>
                <th className="py-1.5 pr-2 text-right">Min</th>
                <th className="py-1.5 text-right">Max</th>
              </tr>
            </thead>
            <tbody className="tabular font-mono text-ink-muted">
              {analyte.points.map((p) => (
                <tr key={p.timepoint} className="border-t border-line/60">
                  <td className="py-1.5 pr-2 font-sans text-ink">
                    {p.timepoint} <span className="text-[10px] text-ink-faint">{p.phase === "pre-flight" ? "pre" : "post"}</span>
                  </td>
                  <td className="py-1.5 pr-2">{p.n}</td>
                  <td className="py-1.5 pr-2 text-right">{formatConcentration(p.mean)}</td>
                  <td className="py-1.5 pr-2 text-right">{formatConcentration(p.min)}</td>
                  <td className="py-1.5 text-right">{formatConcentration(p.max)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] text-ink-faint">
            Unit: {analyte.unit} (column token “{analyte.unitToken}”). L = days before launch, R = days after return.
          </p>
        </div>
      </div>
      {summary.ignoredColumns.length > 0 && (
        <p className="mt-2 text-[11px] text-ink-faint">
          {summary.ignoredColumns.length} column(s) not displayed: {summary.ignoredColumns[0].reason}
        </p>
      )}
    </div>
  );
}

export function OsdrDatasetPanel() {
  const snapshot = OSDR_SNAPSHOTS[0];
  const bundled = useMemo(() => summarizeOsdrMultiplex(snapshot.content), [snapshot]);
  const [imported, setImported] = useState<ImportedFile | null>(null);
  const [accession, setAccession] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    setError(null);
    if (!file) return;
    const acc = accession.trim().toUpperCase();
    if (!/^OSD-\d+$/.test(acc)) {
      setError("Enter the OSDR accession of the file first (e.g. OSD-575) so the source is identified.");
      return;
    }
    try {
      const summary = summarizeOsdrMultiplex(await file.text());
      setImported({ accession: acc, fileName: file.name, summary });
    } catch (err) {
      setError(err instanceof OsdrFormatError ? err.message : "The file could not be read.");
    }
  };

  return (
    <Panel
      title="NASA OSDR dataset — real measurements"
      eyebrow="Real scientific data · kept apart from the simulation"
      icon={Microscope}
      tone="nominal"
      actions={<ProvenanceBadge kind="real-scientific" className="hidden sm:inline-flex" />}
    >
      <div className="rounded-lg border border-level-nominal/30 bg-level-nominal/5 p-3 text-xs text-ink-muted">
        <p className="flex items-center gap-2 font-semibold text-level-nominal">
          <ShieldCheck aria-hidden className="h-4 w-4" /> Separated from ASTRA Health&apos;s simulated vital signs
        </p>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
          <li>Real serum biomarker data from four private astronauts of a 3-day low-Earth-orbit mission (SpaceX Inspiration4), published by NASA OSDR.</li>
          <li>Only summary statistics per timepoint are shown; per-person values are not displayed.</li>
          <li>Not used by the analysis engine, the alerts or the reports, and not comparable with the simulated heart rate, SpO₂ or temperature.</li>
          <li>No reference range or clinical interpretation is applied to these values.</li>
          <li>
            Verified on 2026-11-15: identical to a fresh OSDR download (SHA-256); all 252 values and 9 units cross-checked with the
            submitted results file; statistics confirmed by an independent implementation (docs/SCIENCE_VERIFICATION.md).
          </li>
        </ul>
      </div>

      {imported ? (
        <div className="mt-4" data-testid="osdr-imported">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="nominal">Imported in this browser — not saved</Badge>
            <span className="text-sm text-ink">
              {imported.accession} · <span className="font-mono text-xs">{imported.fileName}</span>
            </span>
            <span className="text-[11px] text-ink-faint">(source declared by the user; verify on osdr.nasa.gov)</span>
            <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setImported(null)} className="ml-auto">
              Back to bundled {snapshot.accession}
            </Button>
          </div>
          <div className="mt-3">
            <SummaryView key={imported.fileName} summary={imported.summary} flightWindow />
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          <SourceIdentification snapshot={snapshot} />
          <SummaryView summary={bundled} flightWindow />
        </div>
      )}

      <div className="mt-5 border-t border-line pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Import another OSDR file</p>
        <p className="mt-1 text-xs text-ink-muted">
          Supported: OSDR multiplex “TRANSFORMED” tables (Sample Name + concentration columns), such as the OSD-575 cardiovascular or immune
          panels. The file is read only in this browser and never enters the mission simulation. To bundle a dataset with the app, run{" "}
          <code className="text-ink">npm run osdr:import -- OSD-575</code>.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label htmlFor="osdr-accession" className="text-xs text-ink-muted">
            Accession
          </label>
          <input
            id="osdr-accession"
            value={accession}
            onChange={(e) => setAccession(e.target.value)}
            placeholder="OSD-575"
            className="w-28 rounded-md border border-line bg-space-850 px-2 py-1 font-mono text-sm text-ink placeholder:text-ink-faint"
          />
          <label className={cx("inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line-strong bg-space-800 px-3 py-1.5 text-sm text-ink hover:bg-space-700 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent")}>
            <FileUp aria-hidden className="h-4 w-4" />
            Choose CSV file
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" data-testid="osdr-file-input" />
          </label>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-xs text-level-warning">
            {error}
          </p>
        )}
      </div>
    </Panel>
  );
}
