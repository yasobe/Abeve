-- Tick: cloud sync schema. Paste into Supabase > SQL Editor > New query > Run.
-- Every user can read and write only their own rows (row level security).

create table if not exists public.trades (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.trades enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "own trades" on public.trades;
create policy "own trades" on public.trades for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.trades, public.profiles to authenticated;

-- Private bucket for chart screenshots: files live under <user id>/<trade id>.jpg
insert into storage.buckets (id, name, public) values ('shots', 'shots', false)
on conflict (id) do nothing;

drop policy if exists "own shots select" on storage.objects;
create policy "own shots select" on storage.objects for select to authenticated
  using (bucket_id = 'shots' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own shots insert" on storage.objects;
create policy "own shots insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'shots' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own shots update" on storage.objects;
create policy "own shots update" on storage.objects for update to authenticated
  using (bucket_id = 'shots' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own shots delete" on storage.objects;
create policy "own shots delete" on storage.objects for delete to authenticated
  using (bucket_id = 'shots' and (storage.foldername(name))[1] = auth.uid()::text);

-- After this file, also run supabase-hardening.sql (limits and extra protection).
