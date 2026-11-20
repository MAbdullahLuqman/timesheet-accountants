"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAccountant, requirePartner } from "@/lib/auth/guards";
import type { BillingModel, EngagementStatus } from "@/lib/supabase/types";

export type TimeEntryInput = {
  id: string;
  engagement_id: string;
  task_code: string;
  work_date: string;
  logged_hours: number;
  billable: boolean;
  notes: string;
};
const quarterHour = (value: number) => Number.isFinite(value) && value >= 0 && value <= 24 && Math.abs(value * 4 - Math.round(value * 4)) < 0.00001;
const bad = (error: string) => ({ error });
const taskCodes = ["FBR Income Tax / IRIS", "Sales Tax / SRB / PRA", "WHT Reconciliation", "Statutory Audit", "SECP Filing", "Bookkeeping", "Exam Leave / Admin"];

export async function getTimesheetData(start: string, end: string) {
  const { user, profile } = await requireAccountant();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return { error: "Invalid week range." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("time_entries").select("id,firm_id,user_id,engagement_id,task_code,work_date,logged_hours,billed_hours,billable,notes,status,review_comment,reviewed_by").eq("firm_id", profile.firm_id).eq("user_id", user.id).gte("work_date", start).lte("work_date", end).order("work_date");
  return error ? bad(error.message) : { data: data ?? [] };
}

export async function getApprovalsData(start: string, end: string) {
  const { profile } = await requirePartner();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return bad("Invalid week range.");
  const supabase = await createClient();
  let entriesQuery = supabase.from("time_entries").select("id,firm_id,user_id,engagement_id,task_code,work_date,logged_hours,billed_hours,billable,notes,status,review_comment,reviewed_by").eq("firm_id", profile.firm_id).eq("status", "SUBMITTED").gte("work_date", start).lte("work_date", end);
  if (profile.role === "HEAD") {
    const [{ data: deptEngagements }, { data: departmentProfiles }] = await Promise.all([
      supabase.from("engagements").select("id").eq("firm_id", profile.firm_id).eq("department_id", profile.department_id),
      supabase.from("profiles").select("id").eq("firm_id", profile.firm_id).eq("department_id", profile.department_id),
    ]);
    const engagementIds = (deptEngagements ?? []).map((item) => item.id);
    const userIds = (departmentProfiles ?? []).map((item) => item.id);
    if (!engagementIds.length || !userIds.length) return { data: [] };
    entriesQuery = entriesQuery.in("engagement_id", engagementIds).in("user_id", userIds);
  }
  const { data: entries, error } = await entriesQuery.order("work_date");
  if (error) return bad(error.message);
  const userIds = [...new Set((entries ?? []).map((item) => item.user_id))];
  const engagementIds = [...new Set((entries ?? []).map((item) => item.engagement_id))];
  const [{ data: people }, { data: engagements }, { data: departments }] = await Promise.all([
    userIds.length ? supabase.from("profiles").select("id,firm_id,department_id,full_name,email,role").eq("firm_id", profile.firm_id).in("id", userIds) : { data: [] },
    engagementIds.length ? supabase.from("engagements").select("id,firm_id,department_id,client_name,ntn_strn,title,billing_model,budget_hours,fee_pkr,status").eq("firm_id", profile.firm_id).in("id", engagementIds) : { data: [] },
    supabase.from("departments").select("id,name,firm_id").eq("firm_id", profile.firm_id),
  ]);
  const profilesById = new Map((people ?? []).map((item) => [item.id, item]));
  const engagementsById = new Map((engagements ?? []).map((item) => [item.id, item]));
  const departmentsById = new Map((departments ?? []).map((item) => [item.id, item.name]));
  return { data: (entries ?? []).map((entry) => ({ ...entry, logged_hours: Number(entry.logged_hours), billed_hours: Number(entry.billed_hours), profile: profilesById.get(entry.user_id) ?? null, engagement: { ...engagementsById.get(entry.engagement_id), department_name: departmentsById.get(engagementsById.get(entry.engagement_id)?.department_id ?? "") ?? "Unassigned" } })) };
}

export async function getReportsData(start: string, end: string) {
  const { profile } = await requirePartner();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return bad("Invalid report period.");
  const supabase = await createClient();
  let profilesQuery = supabase.from("profiles").select("id,department_id,full_name,role,weekly_target_hrs").eq("firm_id", profile.firm_id);
  if (profile.role === "HEAD") profilesQuery = profilesQuery.eq("department_id", profile.department_id);
  const [{ data: safeProfiles, error: staffError }, { data: departments, error: deptError }] = await Promise.all([
    profilesQuery,
    supabase.from("departments").select("id,name,firm_id").eq("firm_id", profile.firm_id),
  ]);
  if (staffError || deptError) return bad(staffError?.message ?? deptError?.message ?? "Could not load report scope.");
  const scopedUserIds = (safeProfiles ?? []).map((item) => item.id);
  let engagementsQuery = supabase.from("engagements").select("id,firm_id,department_id,client_name,title,fee_pkr").eq("firm_id", profile.firm_id);
  if (profile.role === "HEAD") engagementsQuery = engagementsQuery.eq("department_id", profile.department_id);
  const { data: engagements, error: engagementError } = await engagementsQuery;
  if (engagementError) return bad(engagementError.message);
  const engagementIds = (engagements ?? []).map((item) => item.id);
  let weekQuery = supabase.from("time_entries").select("id,user_id,engagement_id,task_code,work_date,logged_hours,billed_hours,billable,status").eq("firm_id", profile.firm_id).gte("work_date", start).lte("work_date", end);
  if (profile.role === "HEAD") weekQuery = scopedUserIds.length && engagementIds.length ? weekQuery.in("user_id", scopedUserIds).in("engagement_id", engagementIds) : weekQuery.eq("user_id", "00000000-0000-0000-0000-000000000000");
  const { data: weekEntries, error: weekError } = await weekQuery;
  if (weekError) return bad(weekError.message);
  let allEntries: { user_id: string; engagement_id: string; logged_hours: number; billed_hours: number }[] = [];
  let ratesByUser = new Map<string, number>();
  if (profile.role === "PARTNER") {
    const admin = createAdminClient();
    const [{ data: richProfiles }, { data: entries, error: allError }] = await Promise.all([
      admin.from("profiles").select("id,cost_rate_pkr,bill_rate_pkr,department_id").eq("firm_id", profile.firm_id),
      engagementIds.length ? supabase.from("time_entries").select("user_id,engagement_id,logged_hours,billed_hours").eq("firm_id", profile.firm_id).in("engagement_id", engagementIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (allError) return bad(allError.message);
    allEntries = (entries ?? []).map((item) => ({ ...item, logged_hours: Number(item.logged_hours), billed_hours: Number(item.billed_hours) }));
    ratesByUser = new Map((richProfiles ?? []).map((item) => [item.id, Number(item.cost_rate_pkr)]));
  }
  const profileByUser = new Map((safeProfiles ?? []).map((item) => [item.id, item]));
  const deptNames = new Map((departments ?? []).map((item) => [item.id, item.name]));
  const totalLogged = (weekEntries ?? []).reduce((sum, item) => sum + Number(item.logged_hours), 0);
  const billableHours = (weekEntries ?? []).filter((item) => item.billable).reduce((sum, item) => sum + Number(item.logged_hours), 0);
  const billedHours = (weekEntries ?? []).reduce((sum, item) => sum + Number(item.billed_hours), 0);
  const targetHours = (safeProfiles ?? []).reduce((sum, item) => sum + Number(item.weekly_target_hrs), 0);
  const departmentsData = (departments ?? []).filter((item) => profile.role === "PARTNER" || item.id === profile.department_id).map((department) => {
    const people = (safeProfiles ?? []).filter((item) => item.department_id === department.id);
    const userIds = new Set(people.map((item) => item.id));
    const deptEntries = (weekEntries ?? []).filter((item) => userIds.has(item.user_id));
    const logged = deptEntries.reduce((sum, item) => sum + Number(item.logged_hours), 0);
    const billable = deptEntries.filter((item) => item.billable).reduce((sum, item) => sum + Number(item.logged_hours), 0);
    const billed = deptEntries.reduce((sum, item) => sum + Number(item.billed_hours), 0);
    return { department: department.name, logged_hours: logged, utilization: people.reduce((sum, item) => sum + Number(item.weekly_target_hrs), 0) ? billable / people.reduce((sum, item) => sum + Number(item.weekly_target_hrs), 0) * 100 : 0, realization: logged ? billed / logged * 100 : 0 };
  });
  let marginRows: { client_name: string; fee_pkr: number; internal_cost_pkr: number; margin_percent: number }[] = [];
  if (profile.role === "PARTNER") {
    const byClient = new Map<string, { fee: number; cost: number }>();
    for (const engagement of engagements ?? []) {
      const clientName = String(engagement.client_name);
      const row = byClient.get(clientName) ?? { fee: 0, cost: 0 };
      row.fee += Number(engagement.fee_pkr);
      row.cost += allEntries.filter((item) => item.engagement_id === engagement.id).reduce((sum, item) => sum + item.logged_hours * (ratesByUser.get(item.user_id) ?? 0), 0);
      byClient.set(clientName, row);
    }
    marginRows = [...byClient.entries()].map(([client_name, row]) => ({ client_name, fee_pkr: row.fee, internal_cost_pkr: row.cost, margin_percent: row.fee ? (row.fee - row.cost) / row.fee * 100 : 0 }));
  }
  const csvRows = (weekEntries ?? []).filter((item) => item.status === "APPROVED").map((item) => {
    const engagement = (engagements ?? []).find((row) => row.id === item.engagement_id);
    const person = profileByUser.get(item.user_id);
    return { entry_id: item.id, work_date: item.work_date, staff: person?.full_name ?? "", department: deptNames.get(person?.department_id ?? "") ?? "", client: String(engagement?.client_name ?? ""), engagement: String(engagement?.title ?? ""), task_code: item.task_code, logged_hours: Number(item.logged_hours), billed_hours: Number(item.billed_hours) };
  });
  return { data: { role: profile.role, total_logged_hours: totalLogged, billable_utilization: totalLogged ? billableHours / totalLogged * 100 : 0, realization: billableHours ? billedHours / billableHours * 100 : 0, departments: departmentsData, margins: marginRows, csvRows } };
}

export async function saveTimeEntries(items: TimeEntryInput[]) {
  const { user, profile } = await requireAccountant();
  if (!Array.isArray(items) || items.length > 200) return bad("Invalid timesheet submission.");
  const supabase = await createClient();
  for (const item of items) {
    if (!/^[0-9a-f-]{36}$/i.test(item.id) || !item.engagement_id || !taskCodes.includes(item.task_code) || !/^\d{4}-\d{2}-\d{2}$/.test(item.work_date) || !quarterHour(item.logged_hours) || typeof item.notes !== "string" || item.notes.length > 1000 || typeof item.billable !== "boolean") return bad("Check the entry, date, task code, notes, and 15-minute hour increments.");
    const { data: engagement, error: engagementError } = await supabase.from("engagements").select("id,department_id").eq("id", item.engagement_id).eq("firm_id", profile.firm_id).eq("status", "ACTIVE").maybeSingle();
    if (engagementError || !engagement) return bad("That engagement is outside your firm or inactive.");
  }
  const ids = items.map((item) => item.id);
  if (new Set(ids).size !== ids.length) return bad("Duplicate timesheet entry IDs.");
  const { data: existing, error: existingError } = await supabase.from("time_entries").select("id,user_id,status").eq("firm_id", profile.firm_id).in("id", ids);
  if (existingError) return bad(existingError.message);
  if ((existing ?? []).some((row) => row.user_id !== user.id || !["DRAFT", "RETURNED"].includes(row.status))) return bad("One or more entries are locked or belong to another user.");
  const records = items.map((item) => ({ id: item.id, firm_id: profile.firm_id, user_id: user.id, engagement_id: item.engagement_id, task_code: item.task_code.trim(), work_date: item.work_date, logged_hours: item.logged_hours, billed_hours: 0, billable: item.billable, notes: item.notes.trim(), status: "DRAFT", review_comment: null, reviewed_by: null }));
  if (records.length) {
    const { error } = await supabase.from("time_entries").upsert(records, { onConflict: "id" });
    if (error) return bad(error.message);
  }
  revalidatePath("/accountant/timesheet");
  revalidatePath("/partner/review");
  revalidatePath("/accountant/engagements");
  revalidatePath("/partner/engagements");
  return { success: true };
}

export async function submitWeek(start: string, end: string) {
  const { user, profile } = await requireAccountant();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return bad("Invalid week range.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("time_entries").update({ status: "SUBMITTED" }).eq("firm_id", profile.firm_id).eq("user_id", user.id).gte("work_date", start).lte("work_date", end).in("status", ["DRAFT", "RETURNED"]).select("id");
  if (error) return bad(error.message);
  if (!data?.length) return bad("There are no draft or returned entries to submit for this week.");
  revalidatePath("/accountant/timesheet");
  revalidatePath("/partner/review");
  return { success: true };
}

export async function logTimerEntry(input: { id: string; engagementId: string; taskCode: string; workDate: string; loggedHours: number }) {
  const { user, profile } = await requireAccountant();
  if (!input || !/^[0-9a-f-]{36}$/i.test(input.id) || !/^\d{4}-\d{2}-\d{2}$/.test(input.workDate) || !quarterHour(input.loggedHours) || input.loggedHours === 0 || !taskCodes.includes(input.taskCode)) return bad("Timer entry, date, task code, or rounded duration is invalid.");
  const supabase = await createClient();
  const { data: engagement } = await supabase.from("engagements").select("id,department_id").eq("id", input.engagementId).eq("firm_id", profile.firm_id).eq("status", "ACTIVE").maybeSingle();
  if (!engagement) return bad("That engagement is outside your firm or inactive.");
  const { data: previous } = await supabase.from("time_entries").select("id,user_id,firm_id,engagement_id,task_code,work_date,logged_hours,status").eq("id", input.id).maybeSingle();
  if (previous) {
    const matches = previous.user_id === user.id && previous.firm_id === profile.firm_id && previous.status === "DRAFT" && previous.engagement_id === input.engagementId && previous.task_code === input.taskCode && previous.work_date === input.workDate && Number(previous.logged_hours) === input.loggedHours;
    return matches ? { success: true } : bad("This timer entry ID is already in use.");
  }
  const { error } = await supabase.from("time_entries").insert({ id: input.id, firm_id: profile.firm_id, user_id: user.id, engagement_id: input.engagementId, task_code: input.taskCode, work_date: input.workDate, logged_hours: input.loggedHours, billed_hours: 0, billable: input.taskCode !== "Exam Leave / Admin", notes: "Timed work · add a summary", status: "DRAFT" });
  if (error) return bad(error.message);
  revalidatePath("/accountant/timesheet");
  return { success: true };
}

export async function reviewTimeEntry(input: { id: string; action: "approve" | "return"; billedHours: number; comment?: string }) {
  const { user, profile } = await requirePartner();
  if (!input || !input.id || !["approve", "return"].includes(input.action) || !quarterHour(input.billedHours) || input.action === "return" && (typeof input.comment !== "string" || !input.comment.trim() || input.comment.length > 1000)) return bad("Enter valid billed hours and a comment when returning an entry.");
  const supabase = await createClient();
  const { data: entry, error } = await supabase.from("time_entries").select("id,user_id,engagement_id,logged_hours,status").eq("id", input.id).eq("firm_id", profile.firm_id).eq("status", "SUBMITTED").maybeSingle();
  if (error || !entry) return bad("This entry is no longer awaiting review.");
  if (input.billedHours > Number(entry.logged_hours)) return bad("Billed hours cannot exceed logged hours.");
  const [{ data: engagement }, { data: owner }] = await Promise.all([
    supabase.from("engagements").select("department_id").eq("id", entry.engagement_id).eq("firm_id", profile.firm_id).maybeSingle(),
    supabase.from("profiles").select("department_id").eq("id", entry.user_id).eq("firm_id", profile.firm_id).maybeSingle(),
  ]);
  if (profile.role === "HEAD" && (!engagement || engagement.department_id !== profile.department_id || owner?.department_id !== profile.department_id)) return bad("This entry is outside your department.");
  const { data: updated, error: updateError } = await supabase.from("time_entries").update({ status: input.action === "approve" ? "APPROVED" : "RETURNED", billed_hours: input.billedHours, review_comment: input.action === "return" ? input.comment!.trim() : null, reviewed_by: user.id }).eq("id", input.id).eq("firm_id", profile.firm_id).eq("status", "SUBMITTED").select("id").maybeSingle();
  if (updateError || !updated) return bad(updateError?.message ?? "This entry was already reviewed.");
  revalidatePath("/partner/review");
  revalidatePath("/accountant/timesheet");
  revalidatePath("/partner/reports");
  return { success: true };
}

export async function createEngagement(input: { department_id: string | null; client_name: string; ntn_strn: string; title: string; billing_model: BillingModel; budget_hours: number; fee_pkr: number }) {
  const { profile } = await requirePartner();
  if (!input || typeof input.client_name !== "string" || typeof input.title !== "string" || typeof input.ntn_strn !== "string" || !input.client_name.trim() || !input.title.trim() || input.ntn_strn.length > 100 || !["RETAINER", "FIXED", "HOURLY"].includes(input.billing_model) || !Number.isFinite(input.budget_hours) || input.budget_hours <= 0 || !Number.isFinite(input.fee_pkr) || input.fee_pkr < 0) return bad("Enter a client, title, billing model, positive budget, and valid fee.");
  const departmentId = profile.role === "HEAD" ? profile.department_id : input.department_id;
  if (!departmentId || (profile.role === "HEAD" && input.department_id && input.department_id !== profile.department_id)) return bad("Choose a department you are allowed to manage.");
  const supabase = await createClient();
  const { data: department } = await supabase.from("departments").select("id").eq("id", departmentId).eq("firm_id", profile.firm_id).maybeSingle();
  if (!department) return bad("That department is not in your firm.");
  const { error } = await supabase.from("engagements").insert({ firm_id: profile.firm_id, department_id: departmentId, client_name: input.client_name.trim(), ntn_strn: input.ntn_strn.trim(), title: input.title.trim(), billing_model: input.billing_model, budget_hours: input.budget_hours, fee_pkr: input.fee_pkr, status: "ACTIVE" });
  if (error) return bad(error.message);
  revalidatePath("/partner/engagements");
  revalidatePath("/accountant/engagements");
  revalidatePath("/accountant/timesheet");
  return { success: true };
}

export async function setEngagementStatus(id: string, status: EngagementStatus) {
  const { profile } = await requirePartner();
  if (!id || !["ACTIVE", "ON_HOLD", "CLOSED"].includes(status)) return bad("Invalid engagement status.");
  const supabase = await createClient();
  let query = supabase.from("engagements").update({ status }).eq("id", id).eq("firm_id", profile.firm_id);
  if (profile.role === "HEAD") query = query.eq("department_id", profile.department_id);
  const { data, error } = await query.select("id").maybeSingle();
  if (error || !data) return bad(error?.message ?? "That engagement is outside your department.");
  revalidatePath("/partner/engagements");
  revalidatePath("/accountant/engagements");
  return { success: true };
}
