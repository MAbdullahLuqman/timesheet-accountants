create table if not exists public.expense_claims (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  user_id uuid not null references public.profiles(id),
  engagement_id uuid references public.engagements(id),
  expense_date date not null,
  claim_month text not null,
  location_client text not null,
  reason text not null,
  amount_pkr numeric(12,2) not null check (amount_pkr > 0),
  billable_to_client boolean not null default false,
  status text not null default 'DRAFT' check (status in ('DRAFT','SUBMITTED','APPROVED','REJECTED')),
  review_comment text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.expense_claims add column if not exists claim_month text;
update public.expense_claims set claim_month = to_char(expense_date, 'YYYY-MM') where claim_month is null;
alter table public.expense_claims alter column claim_month set not null;
create index if not exists expense_claims_firm_month on public.expense_claims (firm_id, expense_date);
create index if not exists expense_claims_user_month on public.expense_claims (user_id, expense_date);
alter table public.expense_claims enable row level security;
