import type { AttentionLevel, FindingCategory, SensorStatus } from "@/lib/types";
import type { SupportUrgency } from "@/lib/response/escalation";
import type { MessageState } from "@/lib/comms/queue";

export interface Tone {
  text: string;
  bg: string;
  border: string;
  dot: string;
  hex: string;
}

// Tailwind needs to see full class names, so they are listed explicitly.
export const TONES = {
  nominal: {
    text: "text-level-nominal",
    bg: "bg-level-nominal/10",
    border: "border-level-nominal/40",
    dot: "bg-level-nominal",
    hex: "#34d399",
  },
  advisory: {
    text: "text-level-advisory",
    bg: "bg-level-advisory/10",
    border: "border-level-advisory/40",
    dot: "bg-level-advisory",
    hex: "#38bdf8",
  },
  caution: {
    text: "text-level-caution",
    bg: "bg-level-caution/10",
    border: "border-level-caution/40",
    dot: "bg-level-caution",
    hex: "#fbbf24",
  },
  warning: {
    text: "text-level-warning",
    bg: "bg-level-warning/10",
    border: "border-level-warning/40",
    dot: "bg-level-warning",
    hex: "#f43f5e",
  },
  sensor: {
    text: "text-level-sensor",
    bg: "bg-level-sensor/10",
    border: "border-level-sensor/40",
    dot: "bg-level-sensor",
    hex: "#a78bfa",
  },
  neutral: {
    text: "text-ink-muted",
    bg: "bg-ink-muted/10",
    border: "border-ink-muted/30",
    dot: "bg-ink-muted",
    hex: "#93a8c9",
  },
  accent: {
    text: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/40",
    dot: "bg-accent",
    hex: "#22d3ee",
  },
} satisfies Record<string, Tone>;

export type ToneName = keyof typeof TONES;

export const LEVEL_TONE: Record<AttentionLevel, ToneName> = {
  NOMINAL: "nominal",
  ADVISORY: "advisory",
  CAUTION: "caution",
  WARNING: "warning",
};

export const LEVEL_TEXT: Record<AttentionLevel, string> = {
  NOMINAL: "Nominal",
  ADVISORY: "Advisory",
  CAUTION: "Caution",
  WARNING: "Warning",
};

export const CATEGORY_TONE: Record<FindingCategory, ToneName> = {
  "vital-deviation": "warning",
  "sensor-issue": "sensor",
};

export const CATEGORY_TEXT: Record<FindingCategory, string> = {
  "vital-deviation": "Vital-sign deviation",
  "sensor-issue": "Sensor issue",
};

export const SENSOR_TONE: Record<SensorStatus, ToneName> = {
  online: "nominal",
  degraded: "caution",
  "no-signal": "warning",
  suspect: "sensor",
};

export const SENSOR_TEXT: Record<SensorStatus, string> = {
  online: "Online",
  degraded: "Degraded",
  "no-signal": "No signal",
  suspect: "Suspect",
};

export const URGENCY_TONE: Record<SupportUrgency, ToneName> = {
  none: "nominal",
  monitor: "advisory",
  recommended: "caution",
  urgent: "warning",
};

export const MESSAGE_TONE: Record<MessageState, ToneName> = {
  queued: "neutral",
  sent: "accent",
  received: "advisory",
  "response-pending": "caution",
  "response-received": "nominal",
};
