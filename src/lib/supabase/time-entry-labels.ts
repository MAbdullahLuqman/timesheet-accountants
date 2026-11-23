"use server";

import { requireAccountant } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveTimeEntries, type TimeEntryInput } from "@/lib/supabase/actions";
import { normalizeTimeEntryLabel as key } from "@/lib/time-entry-label";

type Label = { kind: "company" | "task"; normalized_key: string; display_name: string };

export async function getTimeEntryLabels(): Promise<{ data: Label[] } | { error: string }> {
  const { profile } = await requireAccountant();
  const { data, error } = await createAdminClient().from("time_entry_labels").select("kind,normalized_key,display_name").eq("firm_id", profile.firm_id);
  return error ? { error: error.message } : { data: (data ?? []) as Label[] };
}

export async function importTimeEntries(items: TimeEntryInput[], addLabels: { company: string[]; task: string[] }) {
  const { profile } = await requireAccountant();
  if (!Array.isArray(items) || !items.length || items.length > 200 || !addLabels || !Array.isArray(addLabels.company) || !Array.isArray(addLabels.task)) return { error: "Invalid timesheet import." };
  if (items.some((item) => typeof item.company_name !== "string" || !item.company_name.trim() || item.company_name.length > 200 || typeof item.task_code !== "string" || !item.task_code.trim() || item.task_code.length > 150 || item.engagement_id !== null)) return { error: "Each imported row needs a company and task." };
  const selected = ([...addLabels.company.map((display_name) => ({ kind: "company" as const, display_name })), ...addLabels.task.map((display_name) => ({ kind: "task" as const, display_name }))]);
  if (selected.length > 400 || selected.some((label) => typeof label.display_name !== "string" || !label.display_name.trim() || label.display_name.length > (label.kind === "company" ? 200 : 150) || !key(label.display_name))) return { error: "Check the company and task labels." };
  const admin = createAdminClient();
  // shortcut: labels can remain if row saving fails, use a database transaction if imports must be atomic.
  if (selected.length) {
    const { error } = await admin.from("time_entry_labels").upsert(selected.map((label) => ({ firm_id: profile.firm_id, kind: label.kind, normalized_key: key(label.display_name), display_name: label.display_name.trim() })), { onConflict: "firm_id,kind,normalized_key", ignoreDuplicates: true });
    if (error) return { error: error.message };
  }
  const { data, error } = await admin.from("time_entry_labels").select("kind,normalized_key,display_name").eq("firm_id", profile.firm_id);
  if (error) return { error: error.message };
  const names = new Map((data ?? []).map((label) => [`${label.kind}:${label.normalized_key}`, label.display_name]));
  return saveTimeEntries(items.map((item) => ({ ...item, company_name: names.get(`company:${key(item.company_name!)}`) ?? item.company_name!.trim(), task_code: names.get(`task:${key(item.task_code)}`) ?? item.task_code.trim() })));
}
