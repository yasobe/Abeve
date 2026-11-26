-- Shaar (שער): gate, time contracts, soft lock and effort account.
-- Safe to run more than once.  Supabase > SQL Editor > New query > paste > Run.
--
-- Everything here is server-only: row level security is on with no policies,
-- anon/authenticated get no grants, and the only entry point is
-- public.shaar_api(), executable by the service role (the Edge Function) alone.
-- All state transitions happen inside one transaction per call, so the
-- shortcut's check is strongly consistent with what the web app just wrote.

-- ---------------------------------------------------------------- tables
create table if not exists public.shaar_state (
  id         int primary key default 1 check (id = 1),
  settings   jsonb not null default '{}'::jsonb,
  credits    int not null default 0,          -- effort credits (banked early releases)
  streak     int not null default 0,          -- consecutive broken contracts
  updated_at timestamptz not null default now()
);
insert into public.shaar_state (id) values (1) on conflict (id) do nothing;

-- raw log of every shortcut call (app opened / closed)
create table if not exists public.shaar_events (
  id     bigint generated always as identity primary key,
  at     timestamptz not null,
  kind   text not null check (kind in ('open', 'close')),
  app    text not null,
  result text not null                         -- gate | lock | timer | ok | none | kept | broken
);
create index if not exists shaar_events_at on public.shaar_events (at);

-- one row per answered gate ("what am I looking for right now?")
create table if not exists public.shaar_attempts (
  id             bigint generated always as identity primary key,
  at             timestamptz not null,
  app            text not null,
  intent         text not null,
  decision       text not null,                 -- pass | wait | ask | none (gave up before answering)
  message        text not null default '',
  question       text not null default '',
  wait_seconds   int not null default 0,
  max_minutes    int not null default 5,
  answer         text,
  final_decision text check (final_decision in ('pass', 'wait')),
  final_message  text,
  wait_until     timestamptz,
  outcome        text check (outcome in ('passed', 'resisted')),
  outcome_at     timestamptz,
  model          text,
  latency_ms     int,
  ai_ok          boolean not null default true
);
create index if not exists shaar_attempts_at on public.shaar_attempts (at);
alter table public.shaar_attempts drop constraint if exists shaar_attempts_decision_check;
alter table public.shaar_attempts add constraint shaar_attempts_decision_check
  check (decision in ('pass', 'wait', 'ask', 'none'));

-- time contracts: declared minutes, when they really started, how they ended
create table if not exists public.shaar_passes (
  id            bigint generated always as identity primary key,
  attempt_id    bigint references public.shaar_attempts (id) on delete set null,
  app           text not null,
  minutes       int not null check (minutes between 1 and 120),
  granted_at    timestamptz not null,
  start_by      timestamptz not null,          -- the app must be opened before this
  started_at    timestamptz,                   -- first open after the gate
  ends_at       timestamptz,                   -- started_at + minutes
  last_open_at  timestamptz,
  last_close_at timestamptz,
  status        text not null default 'granted'
                check (status in ('granted', 'active', 'kept', 'broken', 'unknown', 'unused')),
  overrun_sec   int,
  settled_at    timestamptz
);
create index if not exists shaar_passes_status on public.shaar_passes (status);
create index if not exists shaar_passes_granted on public.shaar_passes (granted_at);

create table if not exists public.shaar_locks (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('cooldown', 'penalty', 'manual')),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  pass_id     bigint references public.shaar_passes (id) on delete set null,
  meta        jsonb not null default '{}'::jsonb,
  released_at timestamptz,
  release_via text check (release_via in ('effort', 'credit'))
);
create index if not exists shaar_locks_ends on public.shaar_locks (ends_at);

-- tasks I keep postponing, and the small steps taken on them
create table if not exists public.shaar_tasks (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null,
  title      text not null,
  status     text not null default 'open' check (status in ('open', 'done', 'dropped')),
  closed_at  timestamptz
);

create table if not exists public.shaar_steps (
  id             bigint generated always as identity primary key,
  task_id        bigint not null references public.shaar_tasks (id) on delete cascade,
  created_at     timestamptz not null,
  step           text not null,
  minutes        int not null,
  done_when      text not null default '',
  report         text,
  reported_at    timestamptz,
  accepted       boolean,
  feedback       text,
  released_lock  boolean not null default false,
  model          text,
  ai_ok          boolean not null default true
);
create index if not exists shaar_steps_created on public.shaar_steps (created_at);

-- --------------------------------------------------------------- lock down
do $$
declare t text;
begin
  foreach t in array array['shaar_state', 'shaar_events', 'shaar_attempts', 'shaar_passes',
                           'shaar_locks', 'shaar_tasks', 'shaar_steps'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on public.%I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on public.%I from authenticated', t);
    end if;
  end loop;
end $$;

-- --------------------------------------------------------------- helpers
-- The clock. Tests can pin it with: set shaar.now = '2026-01-01 10:00+02'
create or replace function public.shaar__now() returns timestamptz
language sql stable as $$
  select coalesce(nullif(current_setting('shaar.now', true), '')::timestamptz, now())
$$;

create or replace function public.shaar__settings() returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object(
           'form', 'm',                 -- how Claude and the UI address me: m | f
           'tz', 'Asia/Jerusalem',
           'cooldown_min', 10,          -- lock after every contract (0 = off)
           'penalty_factor', 2,         -- extra lock minutes per minute of overrun
           'grace_sec', 60,             -- closing up to a minute late still counts as kept
           'start_window_sec', 180,     -- after passing the gate, open the app within 3 min
           'max_minutes_cap', 30,
           'credit_cap', 3,
           'ai_daily_limit', 150,
           'rules', ''                  -- my own rules, given to the gatekeeper
         ) || coalesce((select settings from shaar_state where id = 1), '{}'::jsonb)
$$;

create or replace function public.shaar__active_lock(p_now timestamptz) returns public.shaar_locks
language sql stable set search_path = public, pg_temp as $$
  select * from shaar_locks
   where released_at is null and starts_at <= p_now and ends_at > p_now
   order by ends_at desc limit 1
$$;

create or replace function public.shaar__lock_json(l public.shaar_locks) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select case when l.id is null then null else
    jsonb_build_object('id', l.id, 'kind', l.kind, 'starts_at', l.starts_at, 'ends_at', l.ends_at,
                       'meta', l.meta, 'pass_id', l.pass_id) end
$$;

-- End a contract and apply its consequence (cooldown, or a longer penalty lock).
create or replace function public.shaar__finish(p public.shaar_passes, p_now timestamptz,
                                                p_status text, p_overrun int)
returns void language plpgsql set search_path = public, pg_temp as $$
declare
  s jsonb := shaar__settings();
  v_cool int := greatest(0, (s->>'cooldown_min')::int);
  v_factor numeric := greatest(0, (s->>'penalty_factor')::numeric);
  v_streak int;
  v_over_min int;
  v_mins numeric;
begin
  update shaar_passes set status = p_status, settled_at = p_now, overrun_sec = p_overrun
   where id = p.id;
  if p_status = 'broken' then
    update shaar_state set streak = streak + 1, updated_at = p_now where id = 1
      returning streak into v_streak;
    v_over_min := ceil(least(p_overrun, 3600) / 60.0);
    v_mins := (greatest(v_cool, 5) + v_over_min * v_factor) * (1 + 0.5 * (v_streak - 1));
    v_mins := least(round(v_mins), 180);
    insert into shaar_locks (kind, starts_at, ends_at, pass_id, meta)
    values ('penalty', p_now, p_now + make_interval(mins => v_mins::int), p.id,
            jsonb_build_object('app', p.app, 'minutes', p.minutes, 'overrun_min', v_over_min,
                               'streak', v_streak, 'lock_min', v_mins::int));
  else
    if p_status = 'kept' then
      update shaar_state set streak = 0, updated_at = p_now where id = 1;
    end if;
    if p_status in ('kept', 'unknown') and v_cool > 0 and p.ends_at is not null
       and p.ends_at + make_interval(mins => v_cool) > p_now then
      insert into shaar_locks (kind, starts_at, ends_at, pass_id, meta)
      values ('cooldown', p.ends_at, p.ends_at + make_interval(mins => v_cool), p.id,
              jsonb_build_object('app', p.app, 'minutes', p.minutes, 'lock_min', v_cool));
    end if;
  end if;
end $$;

-- Lazily close contracts whose time is up.
create or replace function public.shaar__settle(p_now timestamptz) returns void
language plpgsql set search_path = public, pg_temp as $$
declare
  s jsonb := shaar__settings();
  v_grace interval := make_interval(secs => (s->>'grace_sec')::int);
  p shaar_passes;
begin
  update shaar_passes set status = 'unused', settled_at = p_now
   where status = 'granted' and start_by < p_now;
  for p in select * from shaar_passes
            where status = 'active' and ends_at + v_grace < p_now order by id for update loop
    if p.last_close_at is not null and p.last_close_at >= p.last_open_at then
      perform shaar__finish(p, p_now, 'kept', 0);         -- closed in time
    elsif p_now > p.ends_at + interval '3 hours' then
      perform shaar__finish(p, p_now, 'unknown', null);   -- never heard a close
    end if;  -- otherwise: maybe still inside the app; the close event decides
  end loop;
end $$;

create or replace function public.shaar__stats(p_now timestamptz) returns jsonb
language plpgsql stable set search_path = public, pg_temp as $$
declare
  tz text := shaar__settings()->>'tz';
  d0 timestamptz := (date_trunc('day', p_now at time zone tz)) at time zone tz;
  w0 timestamptz := d0 - interval '6 days';
  r jsonb;
begin
  select jsonb_build_object(
    'visits',    (select count(*) from shaar_events where kind = 'open' and result in ('gate', 'lock') and at >= d0),
    'attempts',  (select count(*) from shaar_attempts where at >= d0),
    'passed',    (select count(*) from shaar_attempts where at >= d0 and outcome = 'passed'),
    'resisted',  (select count(*) from shaar_attempts where at >= d0 and outcome = 'resisted'),
    'minutes',   (select coalesce(sum(minutes), 0) from shaar_passes where granted_at >= d0 and status <> 'unused'),
    'kept',      (select count(*) from shaar_passes where granted_at >= d0 and status = 'kept'),
    'broken',    (select count(*) from shaar_passes where granted_at >= d0 and status = 'broken'),
    'steps',     (select count(*) from shaar_steps where created_at >= d0 and accepted),
    'week_kept',   (select count(*) from shaar_passes where granted_at >= w0 and status = 'kept'),
    'week_broken', (select count(*) from shaar_passes where granted_at >= w0 and status = 'broken'),
    'week_resisted', (select count(*) from shaar_attempts where at >= w0 and outcome = 'resisted'),
    'week_attempts', (select count(*) from shaar_attempts where at >= w0),
    'ai_today',  (select count(*) + count(answer) from shaar_attempts where at >= d0 and model is not null)
               + (select count(*) + count(report) from shaar_steps where created_at >= d0 and model is not null)
  ) into r;
  return r;
end $$;

create or replace function public.shaar__clean(p text, p_max int) returns text
language sql immutable as $$
  select left(btrim(regexp_replace(coalesce(p, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g')), p_max)
$$;

-- --------------------------------------------------------------- the API
create or replace function public.shaar_api(p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_now  timestamptz := shaar__now();
  s      jsonb := shaar__settings();
  a      jsonb := coalesce(p_args, '{}'::jsonb);
  v_app  text := lower(coalesce(a->>'app', ''));
  l      shaar_locks;
  p      shaar_passes;
  t      shaar_attempts;
  k      shaar_tasks;
  st     shaar_steps;
  v_res  text;
  v_int  int;
  v_max  int;
  v_eff  text;
  v_ok   boolean;
  r      jsonb;
begin
  if v_app <> '' and v_app !~ '^[a-z0-9_-]{1,32}$' then
    raise exception 'shaar:bad_app';
  end if;

  perform shaar__settle(v_now);

  case p_action

  -- ---------------------------------------------- shortcut: app was opened
  when 'open' then
    if v_app = '' then raise exception 'shaar:bad_app'; end if;
    l := shaar__active_lock(v_now);
    -- a valid contract survives the cooldown of another app's contract,
    -- but not a manual or penalty lock
    if not exists (select 1 from shaar_locks where released_at is null and kind <> 'cooldown'
                    and starts_at <= v_now and ends_at > v_now) then
      select * into p from shaar_passes
       where app = v_app and status in ('granted', 'active') order by id desc limit 1 for update;
      if p.id is not null and p.status = 'granted' then
        update shaar_passes set status = 'active', started_at = v_now, last_open_at = v_now,
               ends_at = v_now + make_interval(mins => p.minutes)
         where id = p.id;
        v_res := 'timer';
      elsif p.id is not null and v_now < p.ends_at then
        update shaar_passes set last_open_at = v_now where id = p.id;
        v_res := 'ok';
      elsif p.id is not null then
        -- time is up and the app is being opened again
        if p.last_close_at is not null and p.last_close_at >= p.last_open_at then
          perform shaar__finish(p, v_now, 'kept', 0);
        else
          perform shaar__finish(p, v_now, 'unknown', null);
        end if;
        l := shaar__active_lock(v_now);
      end if;
    end if;
    if v_res in ('timer', 'ok') then l := null; end if;
    if v_res is null then v_res := case when l.id is null then 'gate' else 'lock' end; end if;
    insert into shaar_events (at, kind, app, result) values (v_now, 'open', v_app, v_res);
    return jsonb_build_object('r', v_res, 'minutes', case when v_res = 'timer' then p.minutes end,
                              'lock', shaar__lock_json(l));

  -- ---------------------------------------------- shortcut: app was closed
  when 'close' then
    if v_app = '' then raise exception 'shaar:bad_app'; end if;
    v_res := 'none';
    select * into p from shaar_passes
     where app = v_app and status = 'active' order by id desc limit 1 for update;
    if p.id is not null then
      update shaar_passes set last_close_at = v_now where id = p.id returning * into p;
      if v_now > p.ends_at + make_interval(secs => (s->>'grace_sec')::int) then
        v_int := extract(epoch from v_now - p.ends_at)::int;
        perform shaar__finish(p, v_now, 'broken', v_int);
        v_res := 'broken';
      elsif v_now >= p.ends_at then
        perform shaar__finish(p, v_now, 'kept', 0);
        v_res := 'kept';
      else
        v_res := 'ok';
      end if;
    end if;
    insert into shaar_events (at, kind, app, result) values (v_now, 'close', v_app, v_res);
    return jsonb_build_object('r', v_res);

  -- ---------------------------------------------- everything the UI shows
  when 'state' then
    l := shaar__active_lock(v_now);
    select jsonb_build_object(
      'now', v_now,
      'settings', s,
      'credits', (select credits from shaar_state where id = 1),
      'streak', (select streak from shaar_state where id = 1),
      'lock', shaar__lock_json(l),
      'lock_pass', (select jsonb_build_object('app', x.app, 'minutes', x.minutes, 'status', x.status,
                                              'overrun_sec', x.overrun_sec)
                      from shaar_passes x where x.id = l.pass_id),
      'passes', coalesce((select jsonb_agg(jsonb_build_object(
                   'id', x.id, 'app', x.app, 'minutes', x.minutes, 'status', x.status,
                   'start_by', x.start_by, 'ends_at', x.ends_at) order by x.id)
                 from shaar_passes x where x.status in ('granted', 'active')), '[]'::jsonb),
      'last_pass', (select jsonb_build_object('app', x.app, 'minutes', x.minutes, 'status', x.status,
                                              'ends_at', x.ends_at, 'overrun_sec', x.overrun_sec,
                                              'settled_at', x.settled_at)
                      from shaar_passes x where x.status in ('kept', 'broken', 'unknown')
                     order by x.settled_at desc limit 1),
      'pending', (select to_jsonb(x) from shaar_attempts x
                   where x.app = v_app and x.outcome is null and x.at > v_now - interval '30 minutes'
                   order by x.id desc limit 1),
      'recent', coalesce((select jsonb_agg(to_jsonb(y) order by y.id desc) from (
                   select x.id, x.at, x.app, x.intent, x.decision, x.final_decision, x.outcome,
                          x.question, x.answer
                     from shaar_attempts x order by x.id desc limit 12) y), '[]'::jsonb),
      'tasks', coalesce((select jsonb_agg(jsonb_build_object(
                   'id', x.id, 'title', x.title, 'created_at', x.created_at,
                   'steps', (select count(*) from shaar_steps z where z.task_id = x.id and z.accepted),
                   'last_step', (select z.step from shaar_steps z where z.task_id = x.id and z.accepted
                                  order by z.id desc limit 1)) order by x.id desc)
                 from shaar_tasks x where x.status = 'open'), '[]'::jsonb),
      'open_step', (select jsonb_build_object('id', z.id, 'task_id', z.task_id, 'title', x.title,
                                              'step', z.step, 'minutes', z.minutes, 'done_when', z.done_when,
                                              'created_at', z.created_at, 'feedback', z.feedback,
                                              'accepted', z.accepted)
                      from shaar_steps z join shaar_tasks x on x.id = z.task_id
                     where (z.accepted is null or z.accepted = false) and z.created_at > v_now - interval '6 hours'
                       and x.status = 'open'
                     order by z.id desc limit 1),
      'stats', shaar__stats(v_now)
    ) into r;
    return r;

  -- ---------------------------------------------- gate decision (from Claude) saved
  when 'attempt_new' then
    if v_app = '' then raise exception 'shaar:bad_app'; end if;
    v_eff := a->>'decision';
    if v_eff is null or v_eff not in ('pass', 'wait', 'ask') then raise exception 'shaar:bad_decision'; end if;
    v_int := least(greatest(coalesce((a->>'wait_seconds')::int, 0), 0), 900);
    v_max := least(greatest(coalesce((a->>'max_minutes')::int, 5), 1), (s->>'max_minutes_cap')::int);
    insert into shaar_attempts (at, app, intent, decision, message, question, wait_seconds, max_minutes,
                                wait_until, model, latency_ms, ai_ok)
    values (v_now, v_app, shaar__clean(a->>'intent', 500), v_eff, shaar__clean(a->>'message', 400),
            case when v_eff = 'ask' then shaar__clean(a->>'question', 200) else '' end,
            case when v_eff = 'wait' then v_int else 0 end, v_max,
            case when v_eff = 'wait' then v_now + make_interval(secs => v_int) end,
            shaar__clean(a->>'model', 60), (a->>'latency_ms')::int, coalesce((a->>'ai_ok')::boolean, true))
    returning * into t;
    return to_jsonb(t);

  when 'attempt_get' then
    select * into t from shaar_attempts where id = (a->>'id')::bigint;
    if t.id is null then raise exception 'shaar:not_found'; end if;
    return to_jsonb(t);

  -- ---------------------------------------------- the answer to the one question
  when 'attempt_answer' then
    select * into t from shaar_attempts where id = (a->>'id')::bigint for update;
    if t.id is null then raise exception 'shaar:not_found'; end if;
    if t.decision <> 'ask' or t.final_decision is not null or t.outcome is not null then
      raise exception 'shaar:bad_state';
    end if;
    v_eff := a->>'decision';
    if v_eff is null or v_eff not in ('pass', 'wait') then raise exception 'shaar:bad_decision'; end if;
    v_int := least(greatest(coalesce((a->>'wait_seconds')::int, 0), 0), 900);
    v_max := least(greatest(coalesce((a->>'max_minutes')::int, t.max_minutes), 1), (s->>'max_minutes_cap')::int);
    update shaar_attempts set answer = shaar__clean(a->>'answer', 500), final_decision = v_eff,
           final_message = shaar__clean(a->>'message', 400), max_minutes = v_max,
           wait_seconds = case when v_eff = 'wait' then v_int else 0 end,
           wait_until = case when v_eff = 'wait' then v_now + make_interval(secs => v_int) end,
           latency_ms = coalesce(latency_ms, 0) + coalesce((a->>'latency_ms')::int, 0),
           ai_ok = ai_ok and coalesce((a->>'ai_ok')::boolean, true)
     where id = t.id returning * into t;
    return to_jsonb(t);

  -- ---------------------------------------------- declare the time contract
  when 'pass' then
    select * into t from shaar_attempts where id = (a->>'attempt_id')::bigint for update;
    if t.id is null then raise exception 'shaar:not_found'; end if;
    if t.outcome is not null or t.at < v_now - interval '30 minutes' then raise exception 'shaar:stale'; end if;
    if (shaar__active_lock(v_now)).id is not null then
      raise exception 'shaar:locked';
    end if;
    v_eff := coalesce(t.final_decision, t.decision);
    if v_eff = 'ask' then raise exception 'shaar:need_answer'; end if;
    if v_eff = 'wait' and v_now < t.wait_until then raise exception 'shaar:wait'; end if;
    v_int := least(greatest(coalesce((a->>'minutes')::int, t.max_minutes), 1), t.max_minutes);
    update shaar_passes set status = 'unused', settled_at = v_now
     where app = t.app and status = 'granted';
    insert into shaar_passes (attempt_id, app, minutes, granted_at, start_by)
    values (t.id, t.app, v_int, v_now, v_now + make_interval(secs => (s->>'start_window_sec')::int))
    returning * into p;
    update shaar_attempts set outcome = 'passed', outcome_at = v_now where id = t.id;
    return jsonb_build_object('id', p.id, 'app', p.app, 'minutes', p.minutes, 'start_by', p.start_by);

  when 'resist' then
    if a ? 'attempt_id' then
      update shaar_attempts set outcome = 'resisted', outcome_at = v_now
       where id = (a->>'attempt_id')::bigint and outcome is null returning * into t;
    elsif v_app <> '' then
      -- gave up at the gate before even answering: still a resisted urge
      insert into shaar_attempts (at, app, intent, decision, outcome, outcome_at)
      values (v_now, v_app, '', 'none', 'resisted', v_now) returning * into t;
    end if;
    return jsonb_build_object('ok', t.id is not null, 'stats', shaar__stats(v_now));

  -- ---------------------------------------------- soft lock, by hand
  when 'lock' then
    v_int := (a->>'minutes')::int;
    if v_int is null or v_int < 1 or v_int > 720 then raise exception 'shaar:bad_minutes'; end if;
    insert into shaar_locks (kind, starts_at, ends_at, meta)
    values ('manual', v_now, v_now + make_interval(mins => v_int), jsonb_build_object('lock_min', v_int))
    returning * into l;
    return jsonb_build_object('lock', shaar__lock_json(shaar__active_lock(v_now)));

  -- ---------------------------------------------- spend a banked effort credit
  when 'use_credit' then
    l := shaar__active_lock(v_now);
    if l.id is null then raise exception 'shaar:not_locked'; end if;
    update shaar_state set credits = credits - 1, updated_at = v_now where id = 1 and credits > 0
      returning credits into v_int;
    if v_int is null then raise exception 'shaar:no_credit'; end if;
    update shaar_locks set released_at = v_now, release_via = 'credit'
     where released_at is null and starts_at <= v_now and ends_at > v_now;
    return jsonb_build_object('released', true, 'credits', v_int);

  -- ---------------------------------------------- effort account
  when 'task_ctx' then
    if coalesce(a->>'title', '') <> '' then
      insert into shaar_tasks (created_at, title) values (v_now, shaar__clean(a->>'title', 200)) returning * into k;
    else
      select * into k from shaar_tasks where id = (a->>'task_id')::bigint and status = 'open';
    end if;
    if k.id is null then raise exception 'shaar:not_found'; end if;
    l := shaar__active_lock(v_now);
    return jsonb_build_object(
      'now', v_now,
      'task', to_jsonb(k),
      'lock', shaar__lock_json(l),
      'settings', s,
      'stats', shaar__stats(v_now),
      'history', coalesce((select jsonb_agg(to_jsonb(y) order by y.id) from (
                   select z.id, z.created_at, z.step, z.minutes, z.report, z.accepted, z.feedback
                     from shaar_steps z where z.task_id = k.id order by z.id desc limit 6) y), '[]'::jsonb));

  when 'step_new' then
    select * into k from shaar_tasks where id = (a->>'task_id')::bigint and status = 'open';
    if k.id is null then raise exception 'shaar:not_found'; end if;
    insert into shaar_steps (task_id, created_at, step, minutes, done_when, model, ai_ok)
    values (k.id, v_now, shaar__clean(a->>'step', 400),
            least(greatest(coalesce((a->>'minutes')::int, 5), 1), 30),
            shaar__clean(a->>'done_when', 300), shaar__clean(a->>'model', 60),
            coalesce((a->>'ai_ok')::boolean, true))
    returning * into st;
    return to_jsonb(st) || jsonb_build_object('title', k.title);

  when 'step_get' then
    select * into st from shaar_steps where id = (a->>'id')::bigint;
    if st.id is null then raise exception 'shaar:not_found'; end if;
    select * into k from shaar_tasks where id = st.task_id;
    return to_jsonb(st) || jsonb_build_object(
      'title', k.title, 'settings', s,
      'elapsed_sec', extract(epoch from v_now - st.created_at)::int,
      'min_sec', least(st.minutes * 60, 120),
      'locked', (shaar__active_lock(v_now)).id is not null);

  when 'step_report' then
    select * into st from shaar_steps where id = (a->>'id')::bigint for update;
    if st.id is null then raise exception 'shaar:not_found'; end if;
    if st.accepted then raise exception 'shaar:bad_state'; end if;
    if v_now - st.created_at < make_interval(secs => least(st.minutes * 60, 120)) then
      raise exception 'shaar:too_soon';
    end if;
    v_ok := coalesce((a->>'accepted')::boolean, false);
    update shaar_steps set report = shaar__clean(a->>'report', 1000), reported_at = v_now,
           accepted = v_ok, feedback = shaar__clean(a->>'feedback', 400)
     where id = st.id;
    v_res := 'none';
    if v_ok then
      l := shaar__active_lock(v_now);
      if l.id is not null then
        update shaar_locks set released_at = v_now, release_via = 'effort'
         where released_at is null and starts_at <= v_now and ends_at > v_now;
        update shaar_steps set released_lock = true where id = st.id;
        v_res := 'released';
      else
        update shaar_state set credits = least(credits + 1, (s->>'credit_cap')::int), updated_at = v_now
         where id = 1;
        v_res := 'credit';
      end if;
    end if;
    return jsonb_build_object('accepted', v_ok, 'result', v_res,
                              'credits', (select credits from shaar_state where id = 1));

  when 'task_close' then
    v_eff := coalesce(a->>'status', 'done');
    if v_eff not in ('done', 'dropped') then raise exception 'shaar:bad_state'; end if;
    update shaar_tasks set status = v_eff, closed_at = v_now
     where id = (a->>'id')::bigint and status = 'open' returning * into k;
    return jsonb_build_object('ok', k.id is not null);

  -- ---------------------------------------------- settings (whitelisted keys)
  when 'settings' then
    r := '{}'::jsonb;
    if a ? 'form' and a->>'form' in ('m', 'f') then r := r || jsonb_build_object('form', a->>'form'); end if;
    if a ? 'cooldown_min' then
      r := r || jsonb_build_object('cooldown_min', least(greatest((a->>'cooldown_min')::int, 0), 120));
    end if;
    if a ? 'penalty_factor' then
      r := r || jsonb_build_object('penalty_factor', least(greatest((a->>'penalty_factor')::numeric, 0), 5));
    end if;
    if a ? 'max_minutes_cap' then
      r := r || jsonb_build_object('max_minutes_cap', least(greatest((a->>'max_minutes_cap')::int, 1), 120));
    end if;
    if a ? 'rules' then r := r || jsonb_build_object('rules', shaar__clean(a->>'rules', 1500)); end if;
    if a ? 'tz' and exists (select 1 from pg_timezone_names where name = a->>'tz') then
      r := r || jsonb_build_object('tz', a->>'tz');
    end if;
    update shaar_state set settings = settings || r, updated_at = v_now where id = 1;
    return shaar__settings();

  -- ---------------------------------------------- raw history for a weekly report
  when 'export' then
    v_int := least(greatest(coalesce((a->>'days')::int, 7), 1), 365);
    return jsonb_build_object(
      'from', v_now - make_interval(days => v_int), 'to', v_now, 'settings', s,
      'events',   coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from shaar_events x
                             where x.at >= v_now - make_interval(days => v_int)), '[]'::jsonb),
      'attempts', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from shaar_attempts x
                             where x.at >= v_now - make_interval(days => v_int)), '[]'::jsonb),
      'passes',   coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from shaar_passes x
                             where x.granted_at >= v_now - make_interval(days => v_int)), '[]'::jsonb),
      'locks',    coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from shaar_locks x
                             where x.starts_at >= v_now - make_interval(days => v_int)), '[]'::jsonb),
      'tasks',    coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from shaar_tasks x), '[]'::jsonb),
      'steps',    coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from shaar_steps x
                             where x.created_at >= v_now - make_interval(days => v_int)), '[]'::jsonb));

  else
    raise exception 'shaar:bad_action';
  end case;
end $$;

-- --------------------------------------------------------------- grants
do $$
declare f text;
begin
  foreach f in array array[
    'public.shaar_api(text, jsonb)', 'public.shaar__now()', 'public.shaar__settings()',
    'public.shaar__active_lock(timestamptz)', 'public.shaar__lock_json(public.shaar_locks)',
    'public.shaar__finish(public.shaar_passes, timestamptz, text, int)', 'public.shaar__settle(timestamptz)',
    'public.shaar__stats(timestamptz)', 'public.shaar__clean(text, int)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on function %s from authenticated', f);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.shaar_api(text, jsonb) to service_role;
  end if;
end $$;
