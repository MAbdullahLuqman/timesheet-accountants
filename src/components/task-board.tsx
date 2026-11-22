"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEngagementTask, moveEngagementTask } from "@/lib/supabase/task-actions";
import type { TaskStage } from "@/lib/supabase/types";

type Task = { id: string; engagement_id: string; title: string; stage: TaskStage; allocated_hours: number; actual_hours: number };
type Engagement = { id: string; client_name: string; title: string };
const stages: { id: TaskStage; label: string }[] = [{ id: "TO_DO", label: "To do" }, { id: "IN_PROGRESS", label: "In progress" }, { id: "REVIEW", label: "Partner review" }, { id: "DONE", label: "Done / filed" }];

export function TaskBoard({ engagements, initialTasks }: { engagements: Engagement[]; initialTasks: Task[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(engagements[0]?.id ?? "");
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState("");
  const [hours, setHours] = useState("0");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const add = () => startTransition(async () => { const result = await createEngagementTask(selected, title, Number(hours)); if ("error" in result) setMessage(result.error ?? "Could not create task."); else { setTitle(""); setMessage("Task created."); router.refresh(); } });
  const move = (id: string, stage: TaskStage) => {
    const before = tasks;
    setTasks((current) => current.map((task) => task.id === id ? { ...task, stage } : task));
    startTransition(async () => { const result = await moveEngagementTask(id, stage); if ("error" in result) { setTasks(before); setMessage(result.error ?? "Could not move task."); } else router.refresh(); });
  };
  return <section className="mt-5 rounded-lg border bg-white p-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Deliverable task board</h2><p className="text-xs text-zinc-500">Move work through preparation, review, and filing.</p></div><select aria-label="Choose engagement" value={selected} onChange={(event) => setSelected(event.target.value)} className="max-w-full rounded border px-3 py-2 text-sm">{engagements.map((engagement) => <option key={engagement.id} value={engagement.id}>{engagement.client_name} · {engagement.title}</option>)}</select></div>
    {message && <p role="status" className="mb-3 text-sm text-zinc-700">{message}</p>}
    {selected && <form onSubmit={(event) => { event.preventDefault(); add(); }} className="mb-4 flex flex-wrap gap-2"><input aria-label="New task title" required maxLength={200} placeholder="New deliverable" value={title} onChange={(event) => setTitle(event.target.value)} className="min-w-48 flex-1 rounded border px-3 py-2 text-sm" /><input aria-label="Allocated hours" type="number" min="0" max="1000" step="0.25" value={hours} onChange={(event) => setHours(event.target.value)} className="w-28 rounded border px-3 py-2 text-sm" /><button disabled={pending} className="rounded bg-[var(--accent)] px-3 py-2 text-sm text-white hover:bg-[var(--accent-hover)] disabled:opacity-50">Add task</button></form>}
    <div className="grid gap-3 lg:grid-cols-4">{stages.map((stage) => <div key={stage.id} className="min-h-32 rounded-lg bg-zinc-50 p-3"><h3 className="mb-3 text-xs font-semibold uppercase text-zinc-600">{stage.label}</h3><div className="space-y-2">{tasks.filter((task) => task.engagement_id === selected && task.stage === stage.id).map((task) => { const burn = Number(task.allocated_hours) ? Number(task.actual_hours) / Number(task.allocated_hours) * 100 : 0; return <article key={task.id} className="rounded border bg-white p-3"><p className="text-sm font-medium">{task.title}</p><p className="mt-1 text-xs tabular-nums text-zinc-500">{Number(task.actual_hours).toFixed(2)} / {Number(task.allocated_hours).toFixed(2)} hours</p><div className="mt-2 h-1.5 rounded bg-zinc-100"><div className="h-full rounded bg-emerald-600" style={{ width: `${Math.min(100, burn)}%` }} /></div><select aria-label={`Stage for ${task.title}`} value={task.stage} disabled={pending} onChange={(event) => move(task.id, event.target.value as TaskStage)} className="mt-3 w-full rounded border px-2 py-1 text-xs">{stages.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></article>; })}</div></div>)}</div>
    {!engagements.length && <p className="text-sm text-zinc-500">Create an engagement to start its deliverable board.</p>}
  </section>;
}
