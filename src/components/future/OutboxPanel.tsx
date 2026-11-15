"use client";

import { RadioTower } from "lucide-react";
import { Badge, EmptyState, Panel } from "@/components/ui/primitives";
import { OUTBOX_TEXT, OUTBOX_TONE, PRIORITY_TONE } from "@/components/future/common";
import { useFuture } from "@/features/platform/FutureProvider";
import { transmissionOrder } from "@/features/platform/earth-link";
import { formatMissionTime } from "@/features/platform/time";
import type { ModuleId } from "@/features/platform/types";
import { roundTripMinutes } from "@/lib/comms/delay";

export function OutboxPanel({ filterModule }: { filterModule?: ModuleId }) {
  const { state } = useFuture();
  const { outbox, link } = state.platform;
  const items = [...outbox].filter((m) => !filterModule || m.module === filterModule).reverse();
  const order = transmissionOrder(outbox).map((m) => m.id);
  return (
    <Panel
      title={filterModule ? `Earth Link queue — ${filterModule}` : "Earth Link queue — all FUTURE modules"}
      icon={RadioTower}
      eyebrow={`Store-and-forward · one-way ${link.oneWayDelayMin} min · round trip ${roundTripMinutes(link.oneWayDelayMin)} min (simulated)`}
      actions={<Badge tone={link.available ? "nominal" : "warning"}>{link.available ? "Link available" : "Link lost"}</Badge>}
    >
      {items.length === 0 ? (
        <EmptyState>Nothing queued for Earth.</EmptyState>
      ) : (
        <ul className="space-y-1.5" data-testid="outbox-list">
          {items.map((m) => (
            <li key={m.id} className="rounded-lg border border-line p-2 text-xs" data-testid={`outbox-${m.id}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-ink-faint">{m.id}</span>
                <Badge tone={PRIORITY_TONE[m.priority]}>{m.priority}</Badge>
                <Badge tone={OUTBOX_TONE[m.state]}>
                  <span data-testid="outbox-state">{OUTBOX_TEXT[m.state]}</span>
                </Badge>
                {m.state === "queued" && order.indexOf(m.id) >= 0 && <span className="text-ink-faint">next to send: #{order.indexOf(m.id) + 1}</span>}
                {m.sendOrder && <span className="text-ink-faint">sent #{m.sendOrder}</span>}
                <span className="ml-auto text-ink-faint">{m.module}</span>
              </div>
              <p className="mt-1 text-ink">{m.title}</p>
              <p className="text-ink-faint">{m.summary}</p>
              <p className="mt-0.5 font-mono text-[10px] text-ink-faint">
                created {formatMissionTime(m.createdAt)}
                {m.sentAt && ` · sent ${formatMissionTime(m.sentAt)}`}
                {m.deliveredAt && ` · on Earth ${formatMissionTime(m.deliveredAt)}`}
                {m.acknowledgedAt && ` · ack ${formatMissionTime(m.acknowledgedAt)}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
