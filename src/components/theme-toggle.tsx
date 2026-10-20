"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100"
    >
      {isDark ? <Sun className="h-4 w-4 text-gold-400" /> : <Moon className="h-4 w-4 text-gold-400" />}
      <span className="flex-1 text-left">{isDark ? "Light mode" : "Dark mode"}</span>
      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
        {isDark ? "On" : "Off"}
      </span>
    </button>
  );
}
