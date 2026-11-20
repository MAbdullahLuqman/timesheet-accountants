import { loadEnvFile } from "node:process";
import { createClient } from "@supabase/supabase-js";

try { loadEnvFile(".env.local"); } catch { /* CI may provide environment variables directly. */ }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const firmId = "11111111-1111-1111-1111-111111111111";
const firmName = "Islamabad Chartered Accountants & Co.";
const testDomain = "@islamabadca.test";
const isTest = (email?: string | null) => email?.toLowerCase().endsWith(testDomain) ?? false;
const assert = (error: { message: string } | null) => { if (error) throw new Error(error.message); };

async function testUsers() {
  const users: { id: string; email?: string }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    assert(error);
    users.push(...data.users.filter((user) => isTest(user.email) || user.app_metadata?.demo_seed === true).map(({ id, email }) => ({ id, email })));
    if (data.users.length < 1000) return users;
  }
}

async function count(table: string) {
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true }).eq("firm_id", firmId);
  assert(error);
  return count ?? 0;
}

async function clean(keepFirm: boolean) {
  const { data: firm, error: firmError } = await admin.from("firms").select("id,name").eq("id", firmId).maybeSingle();
  assert(firmError);
  if (firm && firm.name !== firmName) throw new Error("Refusing cleanup: the reserved demo firm ID has a different name.");
  const { data: profiles, error: profilesError } = await admin.from("profiles").select("id,email").eq("firm_id", firmId);
  assert(profilesError);
  const users = await testUsers();
  const seededIds = new Set(users.map((user) => user.id));
  const realProfiles = (profiles ?? []).filter((profile) => !isTest(profile.email) && !seededIds.has(profile.id));
  if (realProfiles.length) throw new Error(`Refusing cleanup: ${realProfiles.length} non-test profile(s) belong to the demo firm. Move them to a real firm first.`);
  for (const table of ["time_entry_audits", "client_invoices", "period_locks", "time_entries", "engagement_tasks", "engagements"]) {
    const { error } = await admin.from(table).delete().eq("firm_id", firmId);
    assert(error);
  }
  for (const user of users) assert((await admin.auth.admin.deleteUser(user.id)).error);
  if (!keepFirm) {
    assert((await admin.from("departments").delete().eq("firm_id", firmId)).error);
    assert((await admin.from("firms").delete().eq("id", firmId)).error);
  }
  const remaining = await testUsers();
  const remainingProfiles = await count("profiles");
  const engagements = await count("engagements");
  const entries = await count("time_entries");
  console.log(`Clean complete: ${remaining.length} test users, ${remainingProfiles} demo profiles, ${engagements} demo engagements, ${entries} demo time entries remain.${keepFirm ? " Firm and departments retained." : " Firm removed."}`);
  if (remaining.length || remainingProfiles || engagements || entries) throw new Error("Cleanup verification failed.");
}

async function seed() {
  const password = process.env.DEMO_SEED_PASSWORD;
  if (!password || password.length < 12) throw new Error("Set DEMO_SEED_PASSWORD to at least 12 characters before seeding.");
  const { data: existingFirm, error: firmError } = await admin.from("firms").select("id,name").eq("id", firmId).maybeSingle();
  assert(firmError);
  if (existingFirm && existingFirm.name !== firmName) throw new Error("Reserved demo firm ID belongs to another firm.");
  if (!existingFirm) assert((await admin.from("firms").insert({ id: firmId, name: firmName })).error);
  const { data: existingDepartments, error: departmentError } = await admin.from("departments").select("id,name").eq("firm_id", firmId);
  assert(departmentError);
  const departments = new Map((existingDepartments ?? []).map((department) => [department.name, department.id]));
  for (const name of ["Tax", "Audit", "Corporate", "Advisory", "Bookkeeping"]) if (!departments.has(name)) {
    const { data, error } = await admin.from("departments").insert({ firm_id: firmId, name }).select("id").single();
    assert(error); departments.set(name, data!.id);
  }
  const users = await testUsers();
  for (const person of [
    { email: "managing.partner@islamabadca.test", name: "Demo Managing Partner", role: "PARTNER", department: null },
    { email: "head@islamabadca.test", name: "Demo Department Head", role: "HEAD", department: "Advisory" },
    { email: "accountant@islamabadca.test", name: "Demo Accountant", role: "STAFF", department: "Advisory" },
  ]) {
    let user = users.find((item) => item.email === person.email);
    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({ email: person.email, password, email_confirm: true, app_metadata: { demo_seed: true } });
      assert(error); user = data.user!;
    }
    const { data: profile, error: profileError } = await admin.from("profiles").select("firm_id").eq("id", user.id).maybeSingle();
    assert(profileError);
    if (profile && profile.firm_id !== firmId) throw new Error(`Demo user ${person.email} belongs to another firm.`);
    if (!profile) assert((await admin.from("profiles").insert({ id: user.id, firm_id: firmId, department_id: person.department ? departments.get(person.department) : null, full_name: person.name, email: person.email, role: person.role, is_active: true, cost_rate_pkr: 0, bill_rate_pkr: 0, weekly_target_hrs: 45 })).error);
  }
  const { data: demoEngagement, error: engagementError } = await admin.from("engagements").select("id").eq("firm_id", firmId).eq("client_name", "Demo Advisory Client (Test)").maybeSingle();
  assert(engagementError);
  let engagementId = demoEngagement?.id;
  if (!engagementId) {
    const { data, error } = await admin.from("engagements").insert({ firm_id: firmId, department_id: departments.get("Advisory"), client_name: "Demo Advisory Client (Test)", ntn_strn: "", title: "Demo Monthly Accounts", billing_model: "FIXED", budget_hours: 40, fee_pkr: 100000, status: "ACTIVE" }).select("id").single();
    assert(error); engagementId = data!.id;
  }
  const { data: demoTask, error: taskError } = await admin.from("engagement_tasks").select("id").eq("firm_id", firmId).eq("engagement_id", engagementId).eq("title", "Demo Bank Reconciliation").maybeSingle();
  assert(taskError);
  if (!demoTask) assert((await admin.from("engagement_tasks").insert({ firm_id: firmId, engagement_id: engagementId, title: "Demo Bank Reconciliation", task_code: "Bookkeeping", stage: "TO_DO", allocated_hours: 8 })).error);
  console.log(`Seed complete: ${await testUsers().then((items) => items.length)} test users; demo firm, departments, engagement and task ready.`);
}

const flags = new Set(process.argv.slice(2));
if ([...flags].some((flag) => !["--clean", "--keep-firm"].includes(flag)) || flags.has("--keep-firm") && !flags.has("--clean")) throw new Error("Use --clean [--keep-firm], or run without flags to seed.");
(flags.has("--clean") ? clean(flags.has("--keep-firm")) : seed()).catch((error) => { console.error(error.message); process.exitCode = 1; });
