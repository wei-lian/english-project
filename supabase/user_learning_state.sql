create table if not exists public.user_learning_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  daily_queue jsonb not null default '{"date":"","newWords":[],"reviewWords":[],"completed":[]}'::jsonb,
  learning_records jsonb not null default '[]'::jsonb,
  statistics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

grant select, insert, update on table public.user_learning_state to authenticated;

alter table public.user_learning_state enable row level security;

create or replace function public.touch_user_learning_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_user_learning_state_updated_at on public.user_learning_state;

create trigger set_user_learning_state_updated_at
before update on public.user_learning_state
for each row
execute function public.touch_user_learning_state_updated_at();

drop policy if exists "users can read their own learning state" on public.user_learning_state;
drop policy if exists "users can insert their own learning state" on public.user_learning_state;
drop policy if exists "users can update their own learning state" on public.user_learning_state;

create policy "users can read their own learning state"
on public.user_learning_state
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "users can insert their own learning state"
on public.user_learning_state
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users can update their own learning state"
on public.user_learning_state
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
