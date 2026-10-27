"use client";

import { useEffect, useState } from "react";
import { Palette } from "lucide-react";

const MODES = [
  { id: "light", label: "Light", color: "#f8f7f4" },
  { id: "dark", label: "Dark", color: "#252525" },
  { id: "red", label: "Red", color: "#e53935" },
  { id: "orange", label: "Orange", color: "#f57c00" },
  { id: "yellow", label: "Yellow", color: "#fdd835" },
  { id: "green", label: "Green", color: "#43a047" },
  { id: "blue", label: "Blue", color: "#1e88e5" },
  { id: "purple", label: "Purple", color: "#8e24aa" },
  { id: "pink", label: "Pink", color: "#ec407a" },
  { id: "brown", label: "Brown", color: "#795548" },
  { id: "black", label: "Black", color: "#111111" },
  { id: "gray", label: "Gray", color: "#78909c" },
] as const;

type ThemeMode = (typeof MODES)[number]["id"];
const STORAGE_KEY = "scriptwriter-color-mode";
const isThemeMode = (value: unknown): value is ThemeMode =>
  typeof value === "string" && MODES.some((item) => item.id === value);

export default function ThemeModeControl() {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [authenticated, setAuthenticated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const localMode = window.localStorage.getItem(STORAGE_KEY);
    const initial: ThemeMode = isThemeMode(localMode) ? localMode : "light";
    setMode(initial);
    document.documentElement.dataset.theme = initial;

    async function loadAccountPreference() {
      try {
        const meResponse = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
        const me = await meResponse.json();
        if (cancelled || !me.user) {
          if (!cancelled) setAuthenticated(false);
          return;
        }
        setAuthenticated(true);
        const preferenceResponse = await fetch("/api/user/preferences", { credentials: "same-origin", cache: "no-store" });
        if (!preferenceResponse.ok) return;
        const preference = await preferenceResponse.json();
        if (cancelled) return;
        if (isThemeMode(preference.colorMode)) {
          setMode(preference.colorMode);
          document.documentElement.dataset.theme = preference.colorMode;
          window.localStorage.setItem(STORAGE_KEY, preference.colorMode);
        } else if (isThemeMode(localMode)) {
          // Migrate an existing browser-only preference to the signed-in account.
          await fetch("/api/user/preferences", {
            method: "PATCH",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ colorMode: localMode }),
          });
        }
      } catch {
        if (!cancelled) setAuthenticated(false);
      }
    }

    void loadAccountPreference();
    return () => { cancelled = true; };
  }, []);

  async function changeMode(value: string) {
    if (!isThemeMode(value) || saving) return;
    const previous = mode;
    setMode(value);
    document.documentElement.dataset.theme = value;
    window.localStorage.setItem(STORAGE_KEY, value);
    setSaving(true);
    try {
      const response = await fetch("/api/user/preferences", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colorMode: value }),
      });
      if (!response.ok) throw new Error("Could not save preference");
    } catch {
      // Keep the selection active in this browser; account sync can be retried later.
      setMode(value);
      document.documentElement.dataset.theme = value;
    } finally {
      setSaving(false);
    }
    void previous;
  }

  if (!authenticated) return null;
  return <div className="theme-mode-control">
    <Palette size={16} aria-hidden="true" />
    <label htmlFor="theme-mode-select">Color mode</label>
    <span className="theme-swatch" style={{ background: MODES.find((item) => item.id === mode)?.color }} aria-hidden="true" />
    <select id="theme-mode-select" value={mode} onChange={(event) => void changeMode(event.target.value)} aria-label="Choose workspace color mode" disabled={saving}>
      {MODES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select>
  </div>;
}
