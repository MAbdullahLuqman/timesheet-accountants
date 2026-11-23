"use server";

import { revalidateTag } from "next/cache";
import { requireActiveUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateMyName(value: string) {
  const { user, profile } = await requireActiveUser();
  if (typeof value !== "string") return { error: "Enter your full name." };
  const fullName = value.trim().replace(/\s+/g, " ");
  if (fullName.length < 2 || fullName.length > 100) return { error: "Enter a name between 2 and 100 characters." };
  const { data, error } = await createAdminClient().from("profiles").update({ full_name: fullName }).eq("id", user.id).eq("firm_id", profile.firm_id).select("id").maybeSingle();
  if (error || !data) return { error: error?.message ?? "Could not update your name." };
  revalidateTag(`firm:${profile.firm_id}:staff`);
  return { success: true };
}
