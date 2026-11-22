"use server";

import { revalidatePath } from "next/cache";
import { requireAccountant, requirePartner } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export type ExpenseInput = { expense_date: string; location_client: string; reason: string; amount_pkr: number; engagement_id?: string | null; billable_to_client?: boolean };
export type Expense = ExpenseInput & { id: string; user_id: string; status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED"; review_comment: string | null };
const validMonth = (month: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
const validDate = (date: string) => /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
const monthEnd = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10);
const validExpense = (row: ExpenseInput) => validDate(row.expense_date) && !!row.location_client?.trim() && !!row.reason?.trim() && row.location_client.length <= 250 && row.reason.length <= 500 && Number.isFinite(row.amount_pkr) && row.amount_pkr > 0 && row.amount_pkr <= 9999999999.99;

export async function addExpenses(rows: ExpenseInput[]) {
  const { user, profile } = await requireAccountant();
  if (!Array.isArray(rows) || !rows.length || rows.length > 500) return { error: "Import between 1 and 500 rows at a time." };
  if (rows.some((row) => !validExpense(row))) return { error: "Each row needs a valid date, location, reason, and positive PKR amount." };
  const admin = createAdminClient();
  const engagementIds = [...new Set(rows.map((row) => row.engagement_id).filter((id): id is string => !!id))];
  if (engagementIds.length) {
    const { data, error } = await admin.from("engagements").select("id").eq("firm_id", profile.firm_id).eq("status", "ACTIVE").in("id", engagementIds);
    if (error || data?.length !== engagementIds.length) return { error: "Choose an active engagement in your firm." };
  }
  const { error } = await admin.from("expense_claims").insert(rows.map((row) => ({ firm_id: profile.firm_id, user_id: user.id, claim_month: row.expense_date.slice(0, 7), engagement_id: row.engagement_id || null, expense_date: row.expense_date, location_client: row.location_client.trim(), reason: row.reason.trim(), amount_pkr: row.amount_pkr, billable_to_client: !!row.billable_to_client })));
  if (error) return { error: error.message };
  revalidatePath("/accountant/expenses");
  revalidatePath("/partner/expenses");
  return { success: true };
}

export async function updateExpense(id: string, row: ExpenseInput) {
  const { user, profile } = await requireAccountant();
  if (!/^[0-9a-f-]{36}$/i.test(id) || !row || !validExpense(row) || typeof row.billable_to_client !== "boolean") return { error: "Enter a valid date, location, reason, amount, and billable setting." };
  const admin = createAdminClient();
  if (row.engagement_id) {
    const { data: engagement } = await admin.from("engagements").select("id").eq("id", row.engagement_id).eq("firm_id", profile.firm_id).eq("status", "ACTIVE").maybeSingle();
    if (!engagement) return { error: "Choose an active engagement in your firm." };
  }
  const { data, error } = await admin.from("expense_claims").update({ expense_date: row.expense_date, claim_month: row.expense_date.slice(0, 7), location_client: row.location_client.trim(), reason: row.reason.trim(), amount_pkr: row.amount_pkr, engagement_id: row.engagement_id || null, billable_to_client: row.billable_to_client, status: "DRAFT", review_comment: null, reviewed_by: null, reviewed_at: null }).eq("id", id).eq("firm_id", profile.firm_id).eq("user_id", user.id).in("status", ["DRAFT", "REJECTED", "SUBMITTED"]).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Approved claims cannot be edited." };
  revalidatePath("/accountant/expenses"); revalidatePath("/partner/expenses");
  return { success: true };
}

export async function deleteExpense(id: string) {
  const { user, profile } = await requireAccountant();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Invalid expense row." };
  const { data, error } = await createAdminClient().from("expense_claims").delete().eq("id", id).eq("firm_id", profile.firm_id).eq("user_id", user.id).in("status", ["DRAFT", "REJECTED", "SUBMITTED"]).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Approved claims cannot be deleted." };
  revalidatePath("/accountant/expenses"); revalidatePath("/partner/expenses");
  return { success: true };
}

export async function submitExpenseMonth(month: string) {
  const { user, profile } = await requireAccountant();
  if (!validMonth(month)) return { error: "Choose a valid month." };
  const { error } = await createAdminClient().from("expense_claims").update({ status: "SUBMITTED", review_comment: null, reviewed_by: null, reviewed_at: null }).eq("firm_id", profile.firm_id).eq("user_id", user.id).gte("expense_date", `${month}-01`).lt("expense_date", monthEnd(month)).in("status", ["DRAFT", "REJECTED"]);
  if (error) return { error: error.message };
  revalidatePath("/accountant/expenses"); revalidatePath("/partner/expenses");
  return { success: true };
}

export async function reviewExpense(id: string, action: "APPROVED" | "REJECTED", comment = "") {
  const { user, profile } = await requirePartner();
  if (!id || !["APPROVED", "REJECTED"].includes(action) || (action === "REJECTED" && !comment.trim())) return { error: "A rejection comment is required." };
  const { data, error } = await createAdminClient().from("expense_claims").update({ status: action, review_comment: action === "REJECTED" ? comment.trim() : null, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", id).eq("firm_id", profile.firm_id).eq("status", "SUBMITTED").select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "This claim is no longer awaiting review." };
  revalidatePath("/accountant/expenses"); revalidatePath("/partner/expenses");
  return { success: true };
}

export async function approveStaffExpenses(staffId: string, month: string) {
  const { user, profile } = await requirePartner();
  if (!staffId || !validMonth(month)) return { error: "Choose a valid staff member and month." };
  const admin = createAdminClient();
  const { data: staff } = await admin.from("profiles").select("id").eq("id", staffId).eq("firm_id", profile.firm_id).maybeSingle();
  if (!staff) return { error: "Staff member is not in your firm." };
  const { error } = await admin.from("expense_claims").update({ status: "APPROVED", review_comment: null, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("firm_id", profile.firm_id).eq("user_id", staffId).gte("expense_date", `${month}-01`).lt("expense_date", monthEnd(month)).eq("status", "SUBMITTED");
  if (error) return { error: error.message };
  revalidatePath("/accountant/expenses"); revalidatePath("/partner/expenses");
  return { success: true };
}

export async function setExpenseBillable(id: string, billable: boolean) {
  const { profile } = await requirePartner();
  if (!id || typeof billable !== "boolean") return { error: "Invalid claim update." };
  const { data, error } = await createAdminClient().from("expense_claims").update({ billable_to_client: billable }).eq("id", id).eq("firm_id", profile.firm_id).eq("status", "SUBMITTED").select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Only submitted claims can be changed." };
  revalidatePath("/partner/expenses");
  return { success: true };
}
