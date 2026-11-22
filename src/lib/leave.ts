export type LeaveType = "CASUAL" | "SICK" | "ANNUAL" | "ICAP_ACCA_EXAM";
export type Leave = { id: string; user_id: string; leave_type: LeaveType; start_date: string; end_date: string; working_days: number; reason: string; status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"; review_comment: string | null };
export const leaveAllowance: Record<LeaveType, number> = { CASUAL: 10, SICK: 10, ANNUAL: 20, ICAP_ACCA_EXAM: 10 };
const validDate = (value: string) => /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
// Firm timesheets run Monday through Saturday; Sunday is the non-working day.
export function workingDays(start: string, end: string) {
  if (!validDate(start) || !validDate(end) || end < start || Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`) > 366 * 86400000) return 0;
  let count = 0;
  for (let day = Date.parse(`${start}T00:00:00Z`); day <= Date.parse(`${end}T00:00:00Z`); day += 86400000) if (new Date(day).getUTCDay() !== 0) count++;
  return count;
}
