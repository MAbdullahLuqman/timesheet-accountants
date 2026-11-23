alter table public.time_entries add column if not exists company_name text;
alter table public.time_entries alter column engagement_id drop not null;

do $$
declare rule record;
begin
  for rule in
    select conname from pg_constraint
    where conrelid = 'public.time_entries'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%task_code%'
  loop
    execute format('alter table public.time_entries drop constraint %I', rule.conname);
  end loop;
end $$;

alter table public.time_entries alter column task_code type text;
alter table public.time_entries drop constraint if exists time_entries_company_or_engagement;
alter table public.time_entries add constraint time_entries_company_or_engagement
  check (engagement_id is not null or nullif(btrim(company_name), '') is not null);

create table if not exists public.time_entry_labels (
  firm_id uuid not null references public.firms(id),
  kind text not null check (kind in ('company', 'task')),
  normalized_key text not null,
  display_name text not null,
  primary key (firm_id, kind, normalized_key)
);
alter table public.time_entry_labels enable row level security;
