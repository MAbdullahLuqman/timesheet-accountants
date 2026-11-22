create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id),
  user_id uuid not null references public.profiles(id),
  leave_type text not null check (leave_type in ('CASUAL','SICK','ANNUAL','ICAP_ACCA_EXAM')),
  start_date date not null,
  end_date date not null,
  working_days numeric(5,1) not null check (working_days > 0 and working_days * 2 = trunc(working_days * 2)),
  reason text not null,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  review_comment text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists leave_requests_firm_status on public.leave_requests (firm_id, status);
create index if not exists leave_requests_user_dates on public.leave_requests (user_id, start_date, end_date);
alter table public.leave_requests enable row level security;
