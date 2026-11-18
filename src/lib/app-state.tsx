"use client";

import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { clients, engagements as initialEngagements, entries as initialEntries, reviewThreads, roles, week, type Engagement, type TimeEntry } from "@/lib/mock-data";

type RoleOption = (typeof roles)[number];
type AppState = {
  role: RoleOption;
  setRole: (roleId: string) => void;
  timeEntries: TimeEntry[];
  setTimeEntries: Dispatch<SetStateAction<TimeEntry[]>>;
  engagementList: Engagement[];
  setEngagementList: Dispatch<SetStateAction<Engagement[]>>;
  auditThreads: typeof reviewThreads;
  setAuditThreads: Dispatch<SetStateAction<typeof reviewThreads>>;
  weekStart: Date;
  shiftWeek: (amount: number) => void;
  timerSeconds: number;
  timerRunning: boolean;
  timerClient: string;
  setTimerClient: (id: string) => void;
  toggleTimer: () => void;
  stopTimer: () => void;
  timerLog: { clientId: string; hours: number; roleId: string; sequence: number; weekOf: string } | null;
};

const Context = createContext<AppState | null>(null);
const startingWeek = new Date(`${week.start}T12:00:00`);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [roleId, setRoleId] = useState("partner");
  const [timeEntries, setTimeEntries] = useState(initialEntries);
  const [engagementList, setEngagementList] = useState(initialEngagements);
  const [auditThreads, setAuditThreads] = useState(reviewThreads);
  const [weekStart, setWeekStart] = useState(startingWeek);
  const [timerClient, setTimerClient] = useState(clients[1].id);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerLog, setTimerLog] = useState<AppState["timerLog"]>(null);
  const [timerSequence, setTimerSequence] = useState(0);
  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => setTimerSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning]);
  const value = useMemo<AppState>(() => ({
    role: roles.find((item) => item.id === roleId) ?? roles[0],
    setRole: (id) => setRoleId(id),
    timeEntries,
    setTimeEntries,
    engagementList,
    setEngagementList,
    auditThreads,
    setAuditThreads,
    weekStart,
    shiftWeek: (amount) => setWeekStart((date) => new Date(date.getTime() + amount * 7 * 86400000)),
    timerSeconds,
    timerRunning,
    timerClient,
    setTimerClient,
    toggleTimer: () => setTimerRunning((running) => !running),
    stopTimer: () => {
      setTimerLog({ clientId: timerClient, hours: Math.max(0.25, Math.round(timerSeconds / 900) / 4), roleId, sequence: timerSequence + 1, weekOf: weekStart.toISOString().slice(0, 10) });
      setTimerSequence((sequence) => sequence + 1);
      setTimerRunning(false);
      setTimerSeconds(0);
    },
    timerLog,
  }), [roleId, timeEntries, engagementList, auditThreads, weekStart, timerSeconds, timerRunning, timerClient, timerLog, timerSequence]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppState() {
  const context = useContext(Context);
  if (!context) throw new Error("useAppState must be used inside AppStateProvider");
  return context;
}
