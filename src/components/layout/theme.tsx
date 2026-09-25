"use client";

import { useSyncExternalStore } from "react";

import { Moon, Sun } from "@/components/ui/icons";

import { THEME_STORAGE_KEY } from "./theme-script";

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

const getIsDark = () => document.documentElement.classList.contains("dark");

export function ThemeToggle() {
  // Server snapshot is null so the button renders neutrally until hydrated.
  const isDark = useSyncExternalStore<boolean | null>(subscribe, getIsDark, () => null);

  function toggle() {
    const next = !getIsDark();
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Storage may be unavailable (private mode); the toggle still works for this page view.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Dark theme"
      aria-pressed={isDark ?? undefined}
      className="inline-flex size-10 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      <Sun className="hidden size-5 dark:block" />
      <Moon className="size-5 dark:hidden" />
    </button>
  );
}
