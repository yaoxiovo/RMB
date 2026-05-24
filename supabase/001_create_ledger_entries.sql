create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  title text not null,
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  entry_date date not null,
  note text default '',
  inserted_at timestamptz not null default now()
);

alter table public.ledger_entries enable row level security;

drop policy if exists "select own ledger entries" on public.ledger_entries;
create policy "select own ledger entries"
on public.ledger_entries
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "insert own ledger entries" on public.ledger_entries;
create policy "insert own ledger entries"
on public.ledger_entries
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "update own ledger entries" on public.ledger_entries;
create policy "update own ledger entries"
on public.ledger_entries
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "delete own ledger entries" on public.ledger_entries;
create policy "delete own ledger entries"
on public.ledger_entries
for delete
to authenticated
using (auth.uid() = user_id);
