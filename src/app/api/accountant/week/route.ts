import { NextRequest, NextResponse } from "next/server";
import { requireAccountant } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getCachedActiveEngagements } from "@/lib/cache/firm-cache";

export async function GET(request: NextRequest) {
  const start = request.nextUrl.searchParams.get("start") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || Number.isNaN(Date.parse(start))) return NextResponse.json({ error: "Invalid week start." }, { status: 400 });
  const { user, profile } = await requireAccountant();
  const endDate = new Date(`${start}T12:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 5);
  const end = endDate.toISOString().slice(0, 10);
  const supabase = await createClient();
  const [engagements, { data: entries, error }] = await Promise.all([
    getCachedActiveEngagements(profile.firm_id),
    supabase.from("time_entries").select("id,engagement_id,task_code,work_date,logged_hours,billable,notes,status,review_comment").eq("firm_id", profile.firm_id).eq("user_id", user.id).gte("work_date", start).lte("work_date", end).order("work_date"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: entries ?? [], engagements, weekStart: start, weekEnd: end });
}
