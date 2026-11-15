import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { TONES, type ToneName } from "@/components/ui/levels";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function Panel({
  title,
  icon: Icon,
  eyebrow,
  actions,
  children,
  className,
  bodyClassName,
  tone,
}: {
  title?: ReactNode;
  icon?: LucideIcon;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: ToneName;
}) {
  const t = tone ? TONES[tone] : null;
  return (
    <section
      className={cx(
        "flex min-w-0 flex-col rounded-xl border bg-space-900/85 shadow-[0_0_0_1px_rgba(0,0,0,0.2),0_12px_32px_-16px_rgba(0,0,0,0.6)] backdrop-blur",
        t ? t.border : "border-line",
        className,
      )}
    >
      {(title || actions || eyebrow) && (
        <header className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {Icon && <Icon aria-hidden className={cx("h-4 w-4 shrink-0", t ? t.text : "text-accent")} />}
            <div className="min-w-0">
              {eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">{eyebrow}</p>}
              {title && <h2 className="truncate text-sm font-semibold tracking-wide text-ink">{title}</h2>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx("min-w-0 flex-1 p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Badge({
  tone = "neutral",
  children,
  className,
  pulse,
  title,
}: {
  tone?: ToneName;
  children: ReactNode;
  className?: string;
  pulse?: boolean;
  title?: string;
}) {
  const t = TONES[tone];
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        t.text,
        t.bg,
        t.border,
        className,
      )}
    >
      <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", t.dot, pulse && "pulse-ring")} />
      {children}
    </span>
  );
}

export function DemoTag({ className, label = "Simulated data" }: { className?: string; label?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded border border-dashed border-accent/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent/90",
        className,
      )}
    >
      {label}
    </span>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "sensor";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-space-950 hover:bg-accent-strong border-accent font-semibold",
  secondary: "bg-space-800 text-ink hover:bg-space-700 border-line-strong",
  ghost: "bg-transparent text-ink-muted hover:text-ink hover:bg-space-800 border-transparent",
  danger: "bg-level-warning/15 text-level-warning hover:bg-level-warning/25 border-level-warning/50 font-semibold",
  sensor: "bg-level-sensor/15 text-level-sensor hover:bg-level-sensor/25 border-level-sensor/50 font-semibold",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: "sm" | "md" = "md", className?: string): string {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40",
    size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm",
    BUTTON_VARIANTS[variant],
    className,
  );
}

export function Button({
  variant = "secondary",
  icon: Icon,
  className,
  children,
  size = "md",
  ...rest
}: ComponentProps<"button"> & { variant?: ButtonVariant; icon?: LucideIcon; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      {...rest}
      className={buttonClass(variant, size, className)}
    >
      {Icon && <Icon aria-hidden className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
      {children}
    </button>
  );
}

export function ProgressBar({ value, tone = "accent", label }: { value: number; tone?: ToneName; label?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-1.5 w-full overflow-hidden rounded-full bg-space-700"
    >
      <div className={cx("h-full rounded-full transition-[width] duration-300", TONES[tone].dot)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-ink">{children}</dd>
    </div>
  );
}

/** Horizontally scrollable area that keyboard users can focus and scroll (WCAG 2.1.1). */
export function ScrollArea({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cx("overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent", className)}
    >
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-faint">{children}</p>;
}
