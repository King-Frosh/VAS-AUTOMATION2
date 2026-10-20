"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileUp,
  CalendarRange,
  FileSpreadsheet,
  SendHorizonal,
  FileWarning,
  Handshake,
  Network,
  PenLine,
  ServerCog,
  CalendarClock,
  History,
  ScrollText,
  Settings2,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/actions/auth";
import ThemeToggle from "@/components/theme-toggle";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Operations",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/uploads", label: "Upload Logs", icon: FileUp },
      { href: "/processing", label: "Date Range & Processing", icon: CalendarRange },
      { href: "/reports", label: "Generated Reports", icon: FileSpreadsheet },
      { href: "/email-centre", label: "Email Centre", icon: SendHorizonal },
      { href: "/unmatched", label: "Unmatched Records", icon: FileWarning },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/partners", label: "Partner Register", icon: Handshake },
      { href: "/services", label: "Service Mappings", icon: Network },
      { href: "/templates", label: "Email Templates", icon: PenLine },
      { href: "/email-settings", label: "Email Settings", icon: ServerCog, adminOnly: true },
      { href: "/automation", label: "Automation", icon: CalendarClock, adminOnly: true },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/deliveries", label: "Delivery History", icon: History },
      { href: "/audit", label: "Audit Logs", icon: ScrollText },
      { href: "/settings", label: "System Settings", icon: Settings2, adminOnly: true },
    ],
  },
];

export default function Sidebar({
  user,
  badgeCounts,
}: {
  user: { username: string; fullName: string; role: string };
  badgeCounts: { failed: number; unmatched: number; pending: number };
}) {
  const pathname = usePathname();

  const badgeFor = (href: string): number => {
    if (href === "/email-centre") return badgeCounts.pending;
    if (href === "/unmatched") return badgeCounts.unmatched;
    if (href === "/deliveries") return badgeCounts.failed;
    return 0;
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-navy-950">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(420px 280px at 20% -5%, rgba(49,84,159,0.35), transparent 60%), radial-gradient(300px 260px at 90% 100%, rgba(201,162,39,0.10), transparent 55%)",
        }}
      />
      {/* Brand */}
      <div className="relative flex items-center gap-3 px-4 pb-5 pt-5">
        <Image
          src="/briccs-logo.svg"
          alt="BRICCS International Ideal Limited"
          width={54}
          height={54}
          priority
          className="h-12 w-12 shrink-0 rounded-lg object-contain"
        />
        <div className="min-w-0">
          <p className="font-display text-[12px] font-bold leading-tight tracking-wide text-white">BRICCS INTERNATIONAL</p>
          <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-gold-400">VAS Revenue Console</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-scroll relative flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => {
          const visible = group.items.filter((i) => !i.adminOnly || user.role === "ADMIN");
          if (visible.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{group.label}</p>
              <div className="space-y-0.5">
                {visible.map((item) => {
                  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  const badge = badgeFor(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-[9px] text-[13px] font-medium transition-all duration-200",
                        active
                          ? "bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-gold-300 to-gold-600" />
                      )}
                      <item.icon
                        strokeWidth={1.9}
                        className={cn("h-[17px] w-[17px] shrink-0 transition", active ? "text-gold-400" : "text-slate-500 group-hover:text-slate-300")}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {badge > 0 && (
                        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold-500/15 px-1.5 font-mono text-[10px] font-bold text-gold-400 ring-1 ring-inset ring-gold-500/30">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="relative border-t border-white/[0.06] px-3 py-2">
        <ThemeToggle />
      </div>

      {/* User */}
      <div className="relative border-t border-white/[0.06] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-700 text-[13px] font-bold text-gold-300 ring-1 ring-white/10">
            {(user.fullName || user.username).slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white">{user.fullName || user.username}</p>
            <p className="text-[10.5px] font-medium uppercase tracking-wider text-slate-500">
              {user.role === "ADMIN" ? "Administrator" : user.role === "OPS" ? "Operations" : "Reviewer"}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-rose-400"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
