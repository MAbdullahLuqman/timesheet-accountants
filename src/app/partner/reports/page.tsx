import { PageHeading } from "@/components/ui";
import { requirePartner } from "@/lib/auth/guards";
import ReportsDashboard from "../../reports/reports-dashboard";

export default async function PartnerReports() {
  await requirePartner();
  return <><PageHeading title="Firm analytics & export" subtitle="Live utilization, realization, approved time, and client profitability." /><ReportsDashboard /></>;
}
