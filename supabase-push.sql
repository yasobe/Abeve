-- Tick: push notification storage and the every-minute timer.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- One row per device that allowed notifications
create table if not exists public.push_subs (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  tz text not null default 'Asia/Jerusalem',
  created_at timestamptz not null default now(),
  -- only real browser push services, so nobody can make the server call arbitrary URLs
  constraint push_endpoint_host check (endpoint ~ '^https://(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com)/'),
  constraint push_sizes check (length(endpoint) < 1000 and length(p256dh) < 200 and length(auth) < 100 and length(tz) < 64)
);
alter table public.push_subs enable row level security;
drop policy if exists "own push subs" on public.push_subs;
create policy "own push subs" on public.push_subs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.push_subs from anon;
grant select, insert, update, delete on public.push_subs to authenticated;

-- at most 10 devices per user
create or replace function public.tick_push_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.push_subs where user_id = new.user_id) >= 10 then
    raise exception 'device limit reached';
  end if;
  return new;
end $$;
revoke execute on function public.tick_push_limit() from public, anon, authenticated;
drop trigger if exists tick_push_limit on public.push_subs;
create trigger tick_push_limit before insert on public.push_subs for each row execute function public.tick_push_limit();

-- Which reminders were already sent (server only, no client access)
create table if not exists public.push_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  rid text not null,
  day text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, rid, day)
);
alter table public.push_log enable row level security;
revoke all on public.push_log from anon, authenticated;

-- delete_my_account also removes devices and send history (cascade covers it)

-- Push keys are stored in Vault (run separately, values not in this file):
--   select vault.create_secret('<value>', 'tick_vapid_public'), ... 'tick_vapid_private', 'tick_cron_secret'
create or replace function public.tick_push_config() returns jsonb
language sql security definer set search_path = public, vault as $$
  select coalesce(jsonb_object_agg(name, decrypted_secret), '{}'::jsonb)
  from vault.decrypted_secrets
  where name in ('tick_vapid_public', 'tick_vapid_private', 'tick_cron_secret')
$$;
revoke execute on function public.tick_push_config() from public, anon, authenticated;
grant execute on function public.tick_push_config() to service_role;
