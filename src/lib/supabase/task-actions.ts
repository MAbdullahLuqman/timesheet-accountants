"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireActiveUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TaskStage } from "@/lib/supabase/types";

export async function createEngagementTask(engagementId: string, title: string, allocatedHours: number) {
  const { profile } = await requireActiveUser();
  if (!engagementId || !title.trim() || title.length > 200 || !Number.isFinite(allocatedHours) || allocatedHours < 0 || allocatedHours > 1000) return { error: "Enter a task title and valid allocated hours." };
  const admin = createAdminClient();
  const { data: engagement } = await admin.from("engagements").select("id").eq("id", engagementId).eq("firm_id", profile.firm_id).maybeSingle();
  if (!engagement) return { error: "Engagement not found in your firm." };
  const { error } = await admin.from("engagement_tasks").insert({ firm_id: profile.firm_id, engagement_id: engagementId, title: title.trim(), task_code: "GENERAL", stage: "TO_DO", allocated_hours: allocatedHours });
  if (error) return { error: error.message };
  revalidateTag(`firm:${profile.firm_id}:tasks`);
  revalidatePath("/accountant/engagements"); revalidatePath("/partner/engagements");
  return { success: true };
}

export async function moveEngagementTask(taskId: string, stage: TaskStage) {
  const { profile } = await requireActiveUser();
  if (!taskId || !["TO_DO", "IN_PROGRESS", "REVIEW", "DONE"].includes(stage)) return { error: "Invalid task stage." };
  const { data, error } = await createAdminClient().from("engagement_tasks").update({ stage }).eq("id", taskId).eq("firm_id", profile.firm_id).select("id").maybeSingle();
  if (error || !data) return { error: error?.message ?? "Task not found in your firm." };
  revalidateTag(`firm:${profile.firm_id}:tasks`);
  revalidatePath("/accountant/engagements"); revalidatePath("/partner/engagements");
  return { success: true };
}
