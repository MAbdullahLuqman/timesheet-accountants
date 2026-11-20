"use server";

import { revalidatePath } from "next/cache";
import { requirePartner } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function freezeMonth(month: string) {
  const { user, profile } = await requirePartner();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { error: "Choose a valid month." };
  const through = new Date(`${month}-01T12:00:00Z`);
  through.setUTCMonth(through.getUTCMonth() + 1);
  through.setUTCDate(0);
  const date = through.toISOString().slice(0, 10);
  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin.from("period_locks").select("locked_through_date").eq("firm_id", profile.firm_id).order("locked_through_date", { ascending: false }).limit(1).maybeSingle();
  if (lookupError) return { error: lookupError.message };
  if (existing && existing.locked_through_date >= date) return { error: `The firm is already locked through ${existing.locked_through_date}.` };
  const { error } = await admin.from("period_locks").insert({ firm_id: profile.firm_id, locked_through_date: date, locked_by: user.id, reason: `Month-end freeze: ${month}` });
  if (error) return { error: error.message };
  revalidatePath("/partner/review");
  return { success: true, lockedThrough: date };
}
