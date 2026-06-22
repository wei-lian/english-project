create table if not exists public.vocabulary (
  word text primary key,
  full_form text not null default '',
  category text not null default 'other',
  difficulty text not null default '',
  part_of_speech text not null default '',
  phonetic text not null default '',
  audio text not null default '',
  translations jsonb not null default '{}'::jsonb,
  description text not null default '',
  english_definition text not null default '',
  example text not null default '',
  meanings jsonb not null default '[]'::jsonb,
  code_examples jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

grant select on table public.vocabulary to anon, authenticated;

alter table public.vocabulary enable row level security;

create or replace function public.touch_vocabulary_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_vocabulary_updated_at on public.vocabulary;

create trigger set_vocabulary_updated_at
before update on public.vocabulary
for each row
execute function public.touch_vocabulary_updated_at();

drop policy if exists "public can read vocabulary" on public.vocabulary;

create policy "public can read vocabulary"
on public.vocabulary
for select
to anon, authenticated
using (true);
