import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  Activity,
  BusFront,
  CalendarRange,
  ChartNoAxesColumn,
  CircuitBoard,
  Map as MapIcon,
  Menu,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Operations", icon: Activity, code: "OPS" },
  { to: "/map", label: "Route Map", icon: MapIcon, code: "MAP" },
  { to: "/schedule", label: "Scheduling", icon: CalendarRange, code: "SCH" },
  { to: "/fleet", label: "Fleet & Crew", icon: Users, code: "FLT" },
  { to: "/disruptions", label: "Disruptions", icon: ShieldAlert, code: "DSR" },
  { to: "/optimizer", label: "Optimizer", icon: CircuitBoard, code: "OPT" },
  { to: "/analytics", label: "Analytics", icon: ChartNoAxesColumn, code: "ANL" },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = pathname === item.to;
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold transition-all duration-200",
              active
                ? "bg-primary text-primary-foreground"
                : "text-ink-foreground/70 hover:bg-ink-foreground/10 hover:text-ink-foreground",
            )}
          >
            <Icon
              className="h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110"
              strokeWidth={2.4}
            />
            <span>{item.label}</span>
            <span className="num label-xs ml-auto opacity-50">{item.code}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary">
        <BusFront className="h-6 w-6 text-primary-foreground" strokeWidth={2.4} />
      </span>
      <div className="leading-tight">
        <p className="text-base font-extrabold text-ink-foreground">TransitOps</p>
        <p className="label-xs text-ink-foreground/50">DTC · SIH 1612</p>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-ink px-4 py-6 lg:flex">
        <Brand />
        <div className="mt-8 flex-1">
          <p className="label-xs mb-3 px-3 text-ink-foreground/40">Control modules</p>
          <NavList />
        </div>
        <div className="rounded-md bg-ink-foreground/10 p-4">
          <p className="label-xs text-secondary">Solver online</p>
          <p className="mt-2 text-sm text-ink-foreground/70">
            CP-SAT engine idle · last run 06:12 IST
          </p>
        </div>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="flex w-72 flex-col bg-ink px-4 py-6">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="rounded-md p-2 text-ink-foreground transition-colors duration-200 hover:bg-ink-foreground/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-8">
              <NavList onNavigate={() => setOpen(false)} />
            </div>
          </div>
          <button
            aria-label="Close navigation overlay"
            className="flex-1 bg-ink/60"
            onClick={() => setOpen(false)}
          />
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b-2 border-border bg-background px-5 py-4 sm:px-8">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            className="rounded-md bg-muted p-2 transition-colors duration-200 hover:bg-border lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden sm:block">
            <p className="label-xs text-muted-foreground">Operations control centre</p>
            <p className="text-sm font-semibold">Delhi NCR network · Weekday service</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="label-xs hidden rounded-sm bg-secondary-tint px-3 py-2 text-secondary sm:inline-flex">
              GTFS feed live
            </span>
            <span className="num rounded-sm bg-muted px-3 py-2 text-sm font-semibold">
              06:45 IST
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-ink text-sm font-bold text-ink-foreground">
              DP
            </span>
          </div>
        </header>
        <main className="px-5 py-8 sm:px-8 lg:py-10">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
