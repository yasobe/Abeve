-- Tick: security hardening. Safe to run more than once.
-- Supabase > SQL Editor > New query > paste > Run.

-- 1) Anonymous (not signed in) visitors get no table access at all
revoke all on public.trades, public.profiles from anon;

-- 2) Size and format limits so nobody can fill the free project quota
alter table public.trades drop constraint if exists trades_id_format;
alter table public.trades add constraint trades_id_format check (id ~ '^[a-z0-9]{4,40}$');
alter table public.trades drop constraint if exists trades_data_size;
alter table public.trades add constraint trades_data_size check (pg_column_size(data) < 32768);
alter table public.profiles drop constraint if exists profiles_data_size;
alter table public.profiles add constraint profiles_data_size check (pg_column_size(data) < 262144);

-- 3) At most 20,000 trades per user
create or replace function public.tick_trades_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.trades where user_id = new.user_id) >= 20000
     and not exists (select 1 from public.trades where user_id = new.user_id and id = new.id) then
    raise exception 'trade limit reached';
  end if;
  return new;
end $$;
revoke execute on function public.tick_trades_limit() from public, anon, authenticated;
drop trigger if exists tick_trades_limit on public.trades;
create trigger tick_trades_limit before insert on public.trades
  for each row execute function public.tick_trades_limit();

-- 4) Screenshots: JPEG only, max 3 MB, file name must be <user id>/<trade id>.jpg
update storage.buckets
   set file_size_limit = 3145728, allowed_mime_types = array['image/jpeg']
 where id = 'shots';

drop policy if exists "own shots insert" on storage.objects;
create policy "own shots insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'shots' and name ~ ('^' || auth.uid()::text || '/[a-z0-9]{4,40}\.jpg$'));
drop policy if exists "own shots update" on storage.objects;
create policy "own shots update" on storage.objects for update to authenticated
  using (bucket_id = 'shots' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'shots' and name ~ ('^' || auth.uid()::text || '/[a-z0-9]{4,40}\.jpg$'));

-- 5) Let a signed-in user delete their own account and all their data
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.trades where user_id = auth.uid();
  delete from public.profiles where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
