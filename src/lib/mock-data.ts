export type Department = "Tax" | "Audit" | "Corporate" | "Advisory" | "Bookkeeping";
export type Role = "Accountant" | "ICAP Trainee" | "Department Head" | "Managing Partner";
export type BillingModel = "Monthly Retainer" | "Fixed-Fee Audit" | "Hourly";
export type EntryStatus = "Draft" | "Submitted" | "Returned" | "Approved";

export type StaffMember = {
  id: string;
  name: string;
  initials: string;
  role: Role;
  department: Department | "Leadership";
  costRate: number;
  billingRate: number;
  weeklyCapacity: number;
  status: "Submitted" | "Draft" | "Exam leave" | "Overtime";
  hours: number;
};

export type Client = {
  id: string;
  name: string;
  industry: string;
  city: string;
  ntn: string;
  strn: string;
};

export type Engagement = {
  id: string;
  clientId: string;
  name: string;
  department: Department;
  headId: string;
  billingModel: BillingModel;
  contractValue: number;
  budgetHours: number;
  loggedHours: number;
  status: "On track" | "Watch" | "At risk";
};

export type TimeEntry = {
  id: string;
  staffId: string;
  engagementId: string;
  taskCode: string;
  weekOf: string;
  hours: number[];
  note: string;
  status: EntryStatus;
  approvedHours: number | null;
  comment?: string;
};

export const week = {
  start: "2026-11-16",
  end: "2026-11-21",
  label: "Nov 16 – Nov 21, 2026",
  days: ["Mon 16", "Tue 17", "Wed 18", "Thu 19", "Fri 20", "Sat 21"],
};

export const departments: Department[] = ["Tax", "Audit", "Corporate", "Advisory", "Bookkeeping"];

export const departmentPerformance: Record<Department, { realization: number; utilization: number; billed: number }> = {
  Tax: { realization: 91.4, utilization: 78.2, billed: 4520000 },
  Audit: { realization: 87.8, utilization: 84.6, billed: 6380000 },
  Corporate: { realization: 94.2, utilization: 71.5, billed: 1870000 },
  Advisory: { realization: 89.6, utilization: 75.8, billed: 3260000 },
  Bookkeeping: { realization: 96.1, utilization: 88.4, billed: 2410000 },
};

export const taskCodes = [
  "FBR Income Tax · IRIS",
  "Sales Tax · SRB / PRA",
  "WHT Reconciliation",
  "Statutory Audit Fieldwork",
  "SECP Form A / 29",
  "ICAP Study Leave",
];

const heads = [
  { id: "H-TAX", name: "Ayesha Siddiqui", department: "Tax" as const, initials: "AS" },
  { id: "H-AUD", name: "Usman Farooq", department: "Audit" as const, initials: "UF" },
  { id: "H-COR", name: "Nadia Rahman", department: "Corporate" as const, initials: "NR" },
  { id: "H-ADV", name: "Kamran Shah", department: "Advisory" as const, initials: "KS" },
  { id: "H-BK", name: "Sana Javed", department: "Bookkeeping" as const, initials: "SJ" },
];

export const roles = [
  { id: "partner", name: "Tariq Mahmood", title: "Managing Partner", role: "Managing Partner" as const, department: "Leadership" as const },
  { id: "tax-head", name: "Ayesha Siddiqui", title: "Head of Tax", role: "Department Head" as const, department: "Tax" as const },
  { id: "audit-head", name: "Usman Farooq", title: "Head of Audit", role: "Department Head" as const, department: "Audit" as const },
  { id: "trainee", name: "Bilal Ahmed", title: "ICAP Trainee", role: "ICAP Trainee" as const, department: "Tax" as const },
];

const givenNames = ["Bilal", "Hira", "Saad", "Mariam", "Hamza", "Iqra", "Zain", "Fatima", "Omar", "Mehwish", "Daniyal"];
const surnames = ["Ahmed", "Khan", "Raza", "Malik", "Qureshi", "Iqbal", "Siddiqui", "Butt", "Sheikh", "Ali", "Farooq"];
const grades: Role[] = ["ICAP Trainee", "Accountant", "Accountant", "Accountant", "Accountant", "Accountant", "Accountant", "Accountant", "Accountant", "Accountant", "Accountant"];

export const staff: StaffMember[] = [
  ...heads.map((head, index) => ({
    id: head.id,
    name: head.name,
    initials: head.initials,
    role: "Department Head" as const,
    department: head.department,
    costRate: 6200 + index * 350,
    billingRate: 14500 + index * 500,
    weeklyCapacity: 45,
    status: "Submitted" as const,
    hours: 41.5 + index * 1.5,
  })),
  ...departments.flatMap((department, deptIndex) =>
    givenNames.map((givenName, memberIndex) => {
      const name = `${givenName} ${surnames[(memberIndex + deptIndex * 2) % surnames.length]}`;
      const departmentCode = { Tax: "TAX", Audit: "AUD", Corporate: "COR", Advisory: "ADV", Bookkeeping: "BK" }[department];
      const hours = [37.5, 42, 48.25, 44, 39.5, 46.75, 40, 51, 35.5, 43.25, 45.5][memberIndex];
      const status: StaffMember["status"] = memberIndex === 3 ? "Exam leave" : hours > 50 ? "Overtime" : memberIndex === 8 ? "Draft" : "Submitted";
      return {
        id: `${departmentCode}-${String(memberIndex + 1).padStart(2, "0")}`,
        name,
        initials: name.split(" ").map((part) => part[0]).join(""),
        role: grades[memberIndex],
        department,
        costRate: (memberIndex < 2 ? 1800 : memberIndex < 6 ? 2900 : 3900) + deptIndex * 150,
        billingRate: (memberIndex < 2 ? 4500 : memberIndex < 6 ? 7200 : 9500) + deptIndex * 300,
        weeklyCapacity: memberIndex === 0 ? 40 : 45,
        status,
        hours,
      };
    }),
  ),
  {
    id: "MP-001", name: "Tariq Mahmood", initials: "TM", role: "Managing Partner",
    department: "Leadership", costRate: 12000, billingRate: 30000, weeklyCapacity: 35,
    status: "Submitted", hours: 28.5,
  },
];

export const clients: Client[] = [
  { id: "CL-001", name: "Margalla Foods (Pvt.) Ltd.", industry: "Food & beverage", city: "Islamabad", ntn: "4527816-2", strn: "3277876459123" },
  { id: "CL-002", name: "Blue Area Technologies", industry: "Technology", city: "Islamabad", ntn: "7183204-6", strn: "3277876459234" },
  { id: "CL-003", name: "Crescent Capital Partners", industry: "Financial services", city: "Islamabad", ntn: "2945618-1", strn: "3277876459345" },
  { id: "CL-004", name: "F-7 Medical Centre", industry: "Healthcare", city: "Islamabad", ntn: "6138402-9", strn: "3277876459456" },
  { id: "CL-005", name: "Potohar Engineering Works", industry: "Manufacturing", city: "Rawalpindi", ntn: "5371260-4", strn: "3277876459567" },
  { id: "CL-006", name: "Margalla Heights Developers", industry: "Real estate", city: "Islamabad", ntn: "8642091-7", strn: "3277876459678" },
  { id: "CL-007", name: "Indus Learning Foundation", industry: "Non-profit", city: "Islamabad", ntn: "3650172-3", strn: "3277876459789" },
  { id: "CL-008", name: "Jinnah Avenue Logistics", industry: "Logistics", city: "Islamabad", ntn: "4928371-8", strn: "3277876459890" },
  { id: "CL-009", name: "Safa Hospitality Group", industry: "Hospitality", city: "Islamabad", ntn: "9204173-5", strn: "3277876460012" },
  { id: "CL-010", name: "Federal Books & Stationers", industry: "Retail", city: "Islamabad", ntn: "1846270-1", strn: "3277876460123" },
  { id: "CL-011", name: "Twin City Solar Energy", industry: "Energy", city: "Rawalpindi", ntn: "7503186-0", strn: "3277876460234" },
  { id: "CL-012", name: "Kohsar Consultancy Services", industry: "Professional services", city: "Islamabad", ntn: "3189046-7", strn: "3277876460345" },
];

export const engagements: Engagement[] = [
  { id: "ENG-1048", clientId: "CL-001", name: "FY26 Statutory Audit", department: "Audit", headId: "H-AUD", billingModel: "Fixed-Fee Audit", contractValue: 1850000, budgetHours: 320, loggedHours: 294, status: "Watch" },
  { id: "ENG-1052", clientId: "CL-002", name: "Monthly Tax Compliance", department: "Tax", headId: "H-TAX", billingModel: "Monthly Retainer", contractValue: 425000, budgetHours: 92, loggedHours: 64.5, status: "On track" },
  { id: "ENG-1061", clientId: "CL-003", name: "Quarterly WHT & CIT", department: "Tax", headId: "H-TAX", billingModel: "Hourly", contractValue: 780000, budgetHours: 110, loggedHours: 101, status: "At risk" },
  { id: "ENG-1070", clientId: "CL-004", name: "Payroll & Sales Tax", department: "Bookkeeping", headId: "H-BK", billingModel: "Monthly Retainer", contractValue: 310000, budgetHours: 74, loggedHours: 51, status: "On track" },
  { id: "ENG-1074", clientId: "CL-005", name: "Statutory Audit FY26", department: "Audit", headId: "H-AUD", billingModel: "Fixed-Fee Audit", contractValue: 2450000, budgetHours: 420, loggedHours: 369, status: "Watch" },
  { id: "ENG-1082", clientId: "CL-006", name: "SECP Annual Returns", department: "Corporate", headId: "H-COR", billingModel: "Monthly Retainer", contractValue: 365000, budgetHours: 84, loggedHours: 78, status: "At risk" },
  { id: "ENG-1091", clientId: "CL-007", name: "Grant Compliance Review", department: "Advisory", headId: "H-ADV", billingModel: "Hourly", contractValue: 640000, budgetHours: 96, loggedHours: 61.5, status: "On track" },
  { id: "ENG-1105", clientId: "CL-008", name: "Sales Tax Return · PRA", department: "Tax", headId: "H-TAX", billingModel: "Monthly Retainer", contractValue: 290000, budgetHours: 68, loggedHours: 63, status: "At risk" },
  { id: "ENG-1112", clientId: "CL-009", name: "Bookkeeping & Payroll", department: "Bookkeeping", headId: "H-BK", billingModel: "Monthly Retainer", contractValue: 475000, budgetHours: 118, loggedHours: 84, status: "On track" },
  { id: "ENG-1120", clientId: "CL-010", name: "FBR Tax Representation", department: "Tax", headId: "H-TAX", billingModel: "Hourly", contractValue: 520000, budgetHours: 72, loggedHours: 59, status: "Watch" },
  { id: "ENG-1138", clientId: "CL-011", name: "Internal Controls Review", department: "Advisory", headId: "H-ADV", billingModel: "Hourly", contractValue: 890000, budgetHours: 140, loggedHours: 87.5, status: "On track" },
  { id: "ENG-1144", clientId: "CL-012", name: "Monthly Management Accounts", department: "Bookkeeping", headId: "H-BK", billingModel: "Monthly Retainer", contractValue: 340000, budgetHours: 88, loggedHours: 72, status: "Watch" },
  { id: "ENG-1156", clientId: "CL-003", name: "SECP Form A / 29", department: "Corporate", headId: "H-COR", billingModel: "Hourly", contractValue: 235000, budgetHours: 40, loggedHours: 22.5, status: "On track" },
  { id: "ENG-1160", clientId: "CL-006", name: "Lease Portfolio Audit", department: "Audit", headId: "H-AUD", billingModel: "Fixed-Fee Audit", contractValue: 1250000, budgetHours: 210, loggedHours: 192, status: "At risk" },
  { id: "ENG-1173", clientId: "CL-002", name: "Investor Readiness", department: "Advisory", headId: "H-ADV", billingModel: "Hourly", contractValue: 1120000, budgetHours: 160, loggedHours: 98, status: "On track" },
];

export const entries: TimeEntry[] = [
  { id: "TS-4821", staffId: "TAX-02", engagementId: "ENG-1052", taskCode: "FBR Income Tax · IRIS", weekOf: week.start, hours: [2.5, 3, 2, 1.5, 0, 0], note: "Prepared IRIS working paper and reconciled advance tax.", status: "Submitted", approvedHours: null },
  { id: "TS-4822", staffId: "TAX-03", engagementId: "ENG-1061", taskCode: "WHT Reconciliation", weekOf: week.start, hours: [3, 2.5, 3.5, 2, 1.5, 0], note: "Matched CPRs to ledger; two challans need confirmation.", status: "Submitted", approvedHours: null },
  { id: "TS-4823", staffId: "COR-04", engagementId: "ENG-1156", taskCode: "SECP Form A / 29", weekOf: week.start, hours: [1, 2, 1.5, 2, 0.5, 0], note: "Updated director particulars and prepared filing pack.", status: "Returned", approvedHours: null, comment: "Please attach the client confirmation and move 0.5h to review." },
  { id: "TS-4824", staffId: "TAX-05", engagementId: "ENG-1105", taskCode: "Sales Tax · SRB / PRA", weekOf: week.start, hours: [2, 2.5, 3, 2, 1, 0], note: "Reviewed PRA annexures and followed up on missing invoices.", status: "Submitted", approvedHours: null },
  { id: "TS-4825", staffId: "AUD-02", engagementId: "ENG-1048", taskCode: "Statutory Audit Fieldwork", weekOf: week.start, hours: [6, 7.5, 7, 6.5, 4, 0], note: "Revenue testing, debtor confirmations and sample selection.", status: "Submitted", approvedHours: null },
  { id: "TS-4826", staffId: "AUD-03", engagementId: "ENG-1074", taskCode: "Statutory Audit Fieldwork", weekOf: week.start, hours: [7, 7, 8, 7.5, 6, 2], note: "Potohar plant visit and fixed-asset register tie-out.", status: "Submitted", approvedHours: null },
  { id: "TS-4827", staffId: "COR-02", engagementId: "ENG-1156", taskCode: "SECP Form A / 29", weekOf: week.start, hours: [2, 1.5, 2.5, 2, 1, 0], note: "Prepared annual return documents for partner review.", status: "Submitted", approvedHours: null },
  { id: "TS-4828", staffId: "BK-02", engagementId: "ENG-1070", taskCode: "WHT Reconciliation", weekOf: week.start, hours: [3.5, 3, 2.5, 3, 2, 0], note: "Reconciled payroll deductions to monthly CPRs.", status: "Submitted", approvedHours: null },
  { id: "TS-4829", staffId: "ADV-02", engagementId: "ENG-1091", taskCode: "FBR Income Tax · IRIS", weekOf: week.start, hours: [4, 4, 5, 3, 2.5, 0], note: "Reviewed donor reporting schedules and compliance gaps.", status: "Submitted", approvedHours: null },
  { id: "TS-4830", staffId: "AUD-04", engagementId: "ENG-1160", taskCode: "Statutory Audit Fieldwork", weekOf: week.start, hours: [6.5, 6, 7.5, 7, 5, 0], note: "Lease confirmations and sample testing across properties.", status: "Submitted", approvedHours: null },
  { id: "TS-4831", staffId: "TAX-06", engagementId: "ENG-1120", taskCode: "FBR Income Tax · IRIS", weekOf: week.start, hours: [1.5, 2, 1.5, 2, 0, 0], note: "Drafted response to section 161 notice.", status: "Draft", approvedHours: null },
  { id: "TS-4832", staffId: "TAX-07", engagementId: "ENG-1052", taskCode: "ICAP Study Leave", weekOf: week.start, hours: [0, 0, 0, 0, 0, 0], note: "Advanced Taxation exam leave.", status: "Draft", approvedHours: null },
  { id: "TS-4833", staffId: "AUD-05", engagementId: "ENG-1048", taskCode: "Statutory Audit Fieldwork", weekOf: week.start, hours: [8, 8.5, 8, 8, 7.5, 2], note: "Completed inventory observation and cost testing.", status: "Submitted", approvedHours: null },
  { id: "TS-4834", staffId: "BK-03", engagementId: "ENG-1112", taskCode: "WHT Reconciliation", weekOf: week.start, hours: [2.5, 3, 2.5, 3.5, 2, 0], note: "Reconciled payroll register and monthly WHT returns.", status: "Submitted", approvedHours: null },
  { id: "TS-4835", staffId: "TAX-08", engagementId: "ENG-1061", taskCode: "WHT Reconciliation", weekOf: week.start, hours: [2.5, 2.5, 3, 2.5, 2, 0], note: "Reconciled withholding ledger to CPRs; cleared unmatched items.", status: "Approved", approvedHours: 10.5 },
  { id: "TS-4836", staffId: "AUD-06", engagementId: "ENG-1048", taskCode: "Statutory Audit Fieldwork", weekOf: week.start, hours: [5, 5.5, 4.5, 4, 3, 0], note: "Completed debtors testing and documented two variances.", status: "Approved", approvedHours: 21.5 },
  { id: "TS-4837", staffId: "BK-04", engagementId: "ENG-1112", taskCode: "WHT Reconciliation", weekOf: week.start, hours: [2.5, 2.5, 2.5, 2.5, 2.5, 0], note: "Matched monthly payroll deductions and prepared WHT return.", status: "Approved", approvedHours: 12.5 },
  { id: "TS-4838", staffId: "TAX-01", engagementId: "ENG-1052", taskCode: "FBR Income Tax · IRIS", weekOf: week.start, hours: [2.5, 2, 3, 2, 0, 0], note: "Prepared IRIS return working and reconciled advance tax.", status: "Returned", approvedHours: null, comment: "Please attach the IRIS acknowledgement before approval." },
  { id: "TS-4839", staffId: "TAX-01", engagementId: "ENG-1052", taskCode: "ICAP Study Leave", weekOf: week.start, hours: [0, 0, 0, 0, 7.5, 0], note: "Advanced Taxation exam leave.", status: "Draft", approvedHours: null },
  { id: "TS-4840", staffId: "H-TAX", engagementId: "ENG-1061", taskCode: "WHT Reconciliation", weekOf: week.start, hours: [2, 2.5, 2, 3, 1, 0], note: "Reviewed WHT reconciliation and resolved unmatched CPRs.", status: "Draft", approvedHours: null },
  { id: "TS-4841", staffId: "H-AUD", engagementId: "ENG-1048", taskCode: "Statutory Audit Fieldwork", weekOf: week.start, hours: [3, 4, 3.5, 2, 2.5, 0], note: "Reviewed fieldwork status and cleared audit queries.", status: "Draft", approvedHours: null },
  { id: "TS-4842", staffId: "MP-001", engagementId: "ENG-1091", taskCode: "WHT Reconciliation", weekOf: week.start, hours: [1.5, 2, 2.5, 1, 1.5, 0], note: "Partner review of grant compliance findings.", status: "Draft", approvedHours: null },
];

export const reviewThreads: Record<string, { author: string; time: string; message: string }[]> = {
  "TS-4823": [
    { author: "Nadia Rahman", time: "Mon, 16 Nov · 16:42", message: "Please attach the client confirmation and move 0.5h to review." },
    { author: "Mariam Butt", time: "Tue, 17 Nov · 09:18", message: "Client confirmation requested; I’ll update the filing pack once received." },
  ],
  "TS-4821": [
    { author: "Ayesha Siddiqui", time: "Thu, 19 Nov · 11:06", message: "Can you attach the IRIS acknowledgement before approval?" },
  ],
  "TS-4838": [
    { author: "Ayesha Siddiqui", time: "Mon, 16 Nov · 16:42", message: "Please attach the IRIS acknowledgement before approval." },
  ],
};

export const formatPKR = (amount: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(amount);

export const findClient = (id: string) => clients.find((client) => client.id === id)!;
export const findEngagement = (id: string) => engagements.find((engagement) => engagement.id === id)!;
export const findStaff = (id: string) => staff.find((member) => member.id === id)!;
