import { PageHeading } from "@/components/ui";
import { requirePartner } from "@/lib/auth/guards";
import ReportsDashboard from "../../reports/reports-dashboard";
import { getCachedPartnerReportsSummary } from "@/lib/cache/firm-cache";

export default async function PartnerReports() {
  const { profile } = await requirePartner();
  const summary = await getCachedPartnerReportsSummary(profile.firm_id);
  return <><PageHeading title="Firm analytics & export" subtitle="Utilization, realization, approved time, and client profitability." /><div className="mb-4 grid gap-3 sm:grid-cols-3">{[["All-time logged hours", summary.total_logged_hours.toFixed(2)], ["Utilization", `${summary.utilization.toFixed(1)}%`], ["Realization", `${summary.realization.toFixed(1)}%`]].map(([label, value]) => <div key={label} className="rounded-lg border bg-white p-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>)}</div><ReportsDashboard /></>;
}
