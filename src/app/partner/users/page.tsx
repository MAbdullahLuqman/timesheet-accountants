import { PageHeading } from "@/components/ui";
import { getCachedDepartments, getCachedStaffDirectory } from "@/lib/cache/firm-cache";
import { requirePartner } from "@/lib/auth/guards";
import TeamAdmin from "../../team/team-admin";

export default async function PartnerUsers() {
  const { profile } = await requirePartner();
  const [people, departments] = await Promise.all([getCachedStaffDirectory(profile.firm_id), getCachedDepartments(profile.firm_id)]);
  const departmentNames = new Map(departments.map((department) => [department.id, department.name]));
  const rows = people.map((person) => ({ ...person, department_name: person.department_id ? departmentNames.get(person.department_id) ?? "Unknown department" : "Firm-wide" }));
  return <><PageHeading title="User & access control" subtitle="Provision firm identities, manage access, and maintain internal and billing rates." /><TeamAdmin people={rows} departments={departments} /></>;
}
