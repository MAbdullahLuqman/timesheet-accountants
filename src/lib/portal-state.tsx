"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Engagement, Profile } from "@/lib/supabase/types";

export type AppProfile = Omit<Profile, "email" | "is_active" | "cost_rate_pkr" | "bill_rate_pkr">;
type AppState = {
  profile: AppProfile;
  activeEngagements: Pick<Engagement, "id" | "client_name" | "title">[];
  weekStart: Date;
  shiftWeek: (amount: number) => void;
  selectedDay: number;
  setSelectedDay: (day: number) => void;
  timerSeconds: number;
  timerRunning: boolean;
  timerEngagement: string;
  setTimerEngagement: (id: string) => void;
  timerTaskCode: string;
  setTimerTaskCode: (code: string) => void;
  toggleTimer: () => void;
  stopTimer: () => { id: string; engagementId: string; taskCode: string; workDate: string; loggedHours: number } | null;
  clearTimer: () => void;
};

const Context = createContext<AppState | null>(null);
const dateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const mondayOf = (date: Date) => {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
};

export function AppStateProvider({ children, profile, activeEngagements }: { children: React.ReactNode; profile: AppProfile; activeEngagements: Pick<Engagement, "id" | "client_name" | "title">[] }) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [weekRestored, setWeekRestored] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem(`practice-workbench-week:${profile.id}`);
    if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved) && !Number.isNaN(Date.parse(saved))) setWeekStart(mondayOf(new Date(`${saved}T12:00:00`)));
    setWeekRestored(true);
  }, [profile.id]);
  useEffect(() => { if (weekRestored) localStorage.setItem(`practice-workbench-week:${profile.id}`, dateString(weekStart)); }, [profile.id, weekRestored, weekStart]);
  const [selectedDay, setSelectedDay] = useState(() => {
    const day = (new Date().getDay() + 6) % 7;
    return Math.min(day, 5);
  });
  const [timerEngagement, setTimerEngagement] = useState(activeEngagements[0]?.id ?? "");
  const [timerTaskCode, setTimerTaskCode] = useState("FBR Income Tax / IRIS");
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("practice-workbench-timer");
      if (saved) {
        const state: unknown = JSON.parse(saved);
        if (typeof state === "object" && state !== null && "seconds" in state && typeof state.seconds === "number" && Number.isFinite(state.seconds) && state.seconds >= 0 && "running" in state && typeof state.running === "boolean" && "engagement" in state && typeof state.engagement === "string" && activeEngagements.some((item) => item.id === state.engagement)) {
          setTimerSeconds(state.seconds);
          setTimerEngagement(state.engagement);
          if ("task" in state && typeof state.task === "string") setTimerTaskCode(state.task);
          if (state.running && "startedAt" in state && typeof state.startedAt === "number" && Number.isFinite(state.startedAt)) {
            setTimerSeconds(state.seconds + Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000)));
            setTimerStartedAt(state.startedAt);
            setTimerRunning(true);
          }
        }
      }
    } catch { localStorage.removeItem("practice-workbench-timer"); }
    setHydrated(true);
  }, [activeEngagements]);
  useEffect(() => {
    if (hydrated) localStorage.setItem("practice-workbench-timer", JSON.stringify({ seconds: timerSeconds, running: timerRunning, startedAt: timerStartedAt, engagement: timerEngagement, task: timerTaskCode }));
  }, [hydrated, timerSeconds, timerRunning, timerStartedAt, timerEngagement, timerTaskCode]);
  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => setTimerSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning]);
  const value = useMemo<AppState>(() => ({
    profile,
    activeEngagements,
    weekStart,
    shiftWeek: (amount) => setWeekStart((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount * 7)),
    selectedDay,
    setSelectedDay: (day) => setSelectedDay(Math.max(0, Math.min(5, day))),
    timerSeconds,
    timerRunning,
    timerEngagement,
    setTimerEngagement,
    timerTaskCode,
    setTimerTaskCode,
    toggleTimer: () => setTimerRunning((running) => { const next = !running; setTimerStartedAt(next ? Date.now() : null); return next; }),
    stopTimer: () => {
      if (!timerSeconds || !timerEngagement) return null;
      const workDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + selectedDay);
      const result = { id: crypto.randomUUID(), engagementId: timerEngagement, taskCode: timerTaskCode, workDate: dateString(workDate), loggedHours: Math.max(0.25, Math.round(timerSeconds / 900) / 4) };
      setTimerRunning(false);
      setTimerStartedAt(null);
      return result;
    },
    clearTimer: () => { setTimerSeconds(0); setTimerRunning(false); setTimerStartedAt(null); },
  }), [profile, activeEngagements, weekStart, selectedDay, timerSeconds, timerRunning, timerEngagement, timerTaskCode]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppState() {
  const context = useContext(Context);
  if (!context) throw new Error("useAppState must be used inside AppStateProvider");
  return context;
}
