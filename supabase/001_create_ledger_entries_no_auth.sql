-- Optional: the EdgeOne Node Function will also create this table automatically on first request.
-- This version is intentionally single-user / no-auth, matching the requested Umami-style DATABASE_URL setup.

create extension if not exists pgcrypto;

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income', 'expense')),
  title text not null,
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  entry_date date not null,
  note text default '',
  inserted_at timestamptz not null default now()
);

create index if not exists ledger_entries_entry_date_idx
  on public.ledger_entries (entry_date desc, inserted_at desc);
