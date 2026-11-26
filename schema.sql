-- Run once in Supabase: SQL Editor -> New query -> paste -> Run
create table if not exists public.pos_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.pos_data enable row level security;
create policy "own row select" on public.pos_data for select using (auth.uid() = user_id);
create policy "own row insert" on public.pos_data for insert with check (auth.uid() = user_id);
create policy "own row update" on public.pos_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own row delete" on public.pos_data for delete using (auth.uid() = user_id);
