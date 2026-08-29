import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Flat design primitives. Colour blocks, no shadows, no depth.
 * Every accent is a design token, never a raw Tailwind palette class.
 * ------------------------------------------------------------------ */

export type Tone = "primary" | "secondary" | "accent" | "destructive" | "violet" | "neutral";

const toneBlock: Record<Tone, string> = {
  primary: "bg-primary-tint text-primary",
  secondary: "bg-secondary-tint text-secondary",
  accent: "bg-accent-tint text-accent",
  destructive: "bg-destructive-tint text-destructive",
  violet: "bg-violet-tint text-violet",
  neutral: "bg-muted text-muted-foreground",
};

const toneSolid: Record<Tone, string> = {
  primary: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  accent: "bg-accent text-accent-foreground",
  destructive: "bg-destructive text-destructive-foreground",
  violet: "bg-violet text-primary-foreground",
  neutral: "bg-ink text-ink-foreground",
};

const toneText: Record<Tone, string> = {
  primary: "text-primary",
  secondary: "text-secondary",
  accent: "text-accent",
  destructive: "text-destructive",
  violet: "text-violet",
  neutral: "text-foreground",
};

const toneBar: Record<Tone, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  accent: "bg-accent",
  destructive: "bg-destructive",
  violet: "bg-violet",
  neutral: "bg-ink",
};

export function Pill({
  children,
  tone = "neutral",
  solid = false,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  solid?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "label-xs inline-flex items-center gap-1.5 rounded-sm px-2 py-1 whitespace-nowrap",
        solid ? toneSolid[tone] : toneBlock[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Panel({
  title,
  hint,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-lg bg-card", className)}>
      {title ? (
        <header className="flex flex-wrap items-end justify-between gap-3 px-6 pt-6 pb-4">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={cn(title ? "px-6 pb-6" : "p-6", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Metric({
  label,
  value,
  unit,
  delta,
  tone = "primary",
  icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <div className="group rounded-lg bg-card p-6 transition-transform duration-200 hover:scale-[1.02]">
      <div className="flex items-start justify-between gap-4">
        <p className="label-xs text-muted-foreground">{label}</p>
        {icon ? (
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-transform duration-200 group-hover:scale-110",
              toneBlock[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className={cn("num mt-5 text-4xl font-extrabold", toneText[tone])}>
        {value}
        {unit ? <span className="ml-1 text-lg font-bold">{unit}</span> : null}
      </p>
      {delta ? <p className="mt-2 text-sm text-muted-foreground">{delta}</p> : null}
    </div>
  );
}

export function Meter({
  value,
  tone = "primary",
  className,
}: {
  value: number;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-sm bg-muted", className)}>
      <div
        className={cn("h-full rounded-sm transition-all duration-300", toneBar[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function BarSeries({
  data,
  tone = "primary",
  peakTone = "accent",
  height = 168,
}: {
  data: { label: string; value: number; note?: string }[];
  tone?: Tone;
  peakTone?: Tone;
  height?: number;
  }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d) => {
        const isPeak = d.value === max;
        return (
          <div key={d.label} className="group flex h-full flex-1 flex-col justify-end gap-2">
            <span className="num text-center text-[11px] font-semibold text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {d.note ?? d.value}
            </span>
            <div
              className={cn(
                "w-full rounded-sm transition-all duration-200 group-hover:opacity-80",
                isPeak ? toneBar[peakTone] : toneBar[tone],
              )}
              style={{ height: `${(d.value / max) * 100}%` }}
            />
            <span className="num text-center text-[11px] font-medium text-muted-foreground">
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cn("label-xs px-4 py-3 text-left text-muted-foreground", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle text-sm", className)}>{children}</td>;
}

export function DataTable({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md">
      <table className="w-full min-w-[720px] border-collapse">
        <thead className="bg-muted">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export function PageHead({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 border-b-2 border-border pb-8">
      <div className="max-w-2xl">
        <p className="label-xs text-primary">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">{title}</h1>
        <p className="mt-3 text-base text-muted-foreground">{description}</p>
      </div>
      {aside}
    </div>
  );
}
