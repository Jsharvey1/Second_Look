-- ============================================================
-- Second Look — database setup
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run more than once.
-- ============================================================

-- ---------- Tables ----------

create table if not exists public.selections (
  id            uuid primary key default gen_random_uuid(),
  title         text not null default 'Untitled selection',
  artist_name   text not null default '',
  purpose       text not null default '',
  artist_token  text not null unique default replace(gen_random_uuid()::text, '-', ''),
  mentor_token  text not null unique default replace(gen_random_uuid()::text, '-', ''),
  mentor_name   text not null default '',
  overall_note  text not null default '',
  status        text not null default 'draft'
                check (status in ('draft', 'in_review', 'reviewed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  reviewed_at   timestamptz
);

create table if not exists public.works (
  id               uuid primary key default gen_random_uuid(),
  selection_id     uuid not null references public.selections(id) on delete cascade,
  image_path       text not null,
  width            int,
  height           int,
  title            text not null default '',
  year             text not null default '',
  medium           text not null default '',
  dimensions       text not null default '',
  position         int  not null default 0,
  mentor_position  int,
  verdict          text check (verdict in ('keep', 'maybe', 'cut')),
  note             text not null default '',
  created_at       timestamptz not null default now()
);

create index if not exists works_selection_id_idx on public.works(selection_id);

-- Lock the tables down. Nobody reads or writes them directly;
-- every read and write goes through the functions below, which
-- check the private link token first.
alter table public.selections enable row level security;
alter table public.works      enable row level security;
revoke all on public.selections from anon, authenticated;
revoke all on public.works      from anon, authenticated;


-- ---------- Internal helper (not callable from the site) ----------

create or replace function public._sl_payload(p_id uuid, p_role text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id',           s.id,
    'title',        s.title,
    'artist_name',  s.artist_name,
    'purpose',      s.purpose,
    'status',       s.status,
    'created_at',   s.created_at,
    'reviewed_at',  s.reviewed_at,
    'role',         p_role,
    -- the mentor link is only shown to the artist
    'mentor_token', case when p_role = 'artist' then s.mentor_token end,
    -- the artist only sees feedback once the mentor presses Send
    'mentor_name',  case when p_role = 'mentor' or s.status = 'reviewed' then s.mentor_name  else '' end,
    'overall_note', case when p_role = 'mentor' or s.status = 'reviewed' then s.overall_note else '' end,
    'works', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',              w.id,
        'image_path',      w.image_path,
        'width',           w.width,
        'height',          w.height,
        'title',           w.title,
        'year',            w.year,
        'medium',          w.medium,
        'dimensions',      w.dimensions,
        'position',        w.position,
        'mentor_position', case when p_role = 'mentor' or s.status = 'reviewed' then w.mentor_position end,
        'verdict',         case when p_role = 'mentor' or s.status = 'reviewed' then w.verdict end,
        'note',            case when p_role = 'mentor' or s.status = 'reviewed' then w.note else '' end
      ) order by w.position, w.created_at)
      from public.works w
      where w.selection_id = s.id
    ), '[]'::jsonb)
  )
  from public.selections s
  where s.id = p_id;
$$;

create or replace function public._sl_artist_selection(p_token text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.selections
  where artist_token = p_token and length(coalesce(p_token, '')) >= 20;
$$;

create or replace function public._sl_mentor_selection(p_token text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.selections
  where mentor_token = p_token and length(coalesce(p_token, '')) >= 20;
$$;


-- ---------- Functions the site calls ----------

-- Start a new selection. Returns the artist's private token.
create or replace function public.create_selection(
  p_title text, p_artist_name text, p_purpose text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  insert into public.selections (title, artist_name, purpose)
  values (
    coalesce(nullif(left(trim(p_title), 140), ''), 'Untitled selection'),
    left(trim(coalesce(p_artist_name, '')), 120),
    left(trim(coalesce(p_purpose, '')), 140)
  )
  returning artist_token into v_token;
  return jsonb_build_object('artist_token', v_token);
end;
$$;

-- What the artist sees.
create or replace function public.get_artist_view(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public._sl_payload(public._sl_artist_selection(p_token), 'artist');
$$;

-- What the mentor sees.
create or replace function public.get_mentor_view(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public._sl_payload(public._sl_mentor_selection(p_token), 'mentor');
$$;

-- Artist edits the selection's title, name or purpose.
create or replace function public.update_selection(
  p_token text, p_title text, p_artist_name text, p_purpose text
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid := public._sl_artist_selection(p_token);
begin
  if v_id is null then raise exception 'Selection not found'; end if;
  update public.selections set
    title       = coalesce(nullif(left(trim(p_title), 140), ''), title),
    artist_name = left(trim(coalesce(p_artist_name, artist_name)), 120),
    purpose     = left(trim(coalesce(p_purpose, purpose)), 140),
    updated_at  = now()
  where id = v_id;
end;
$$;

-- Artist adds a work (after uploading its image to storage).
create or replace function public.add_work(
  p_token text, p_image_path text, p_width int, p_height int, p_title text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id    uuid := public._sl_artist_selection(p_token);
  v_count int;
  v_work  uuid;
begin
  if v_id is null then raise exception 'Selection not found'; end if;
  select count(*) into v_count from public.works where selection_id = v_id;
  if v_count >= 40 then raise exception 'A selection can hold up to 40 works'; end if;
  -- images must live in this selection's own folder: <selection id>/<random id>.jpg
  if p_image_path is null
     or p_image_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
     or split_part(p_image_path, '/', 1) <> v_id::text then
    raise exception 'Bad image path';
  end if;

  insert into public.works (selection_id, image_path, width, height, title, position)
  values (
    v_id, p_image_path, p_width, p_height,
    left(trim(coalesce(p_title, '')), 200),
    coalesce((select max(position) + 1 from public.works where selection_id = v_id), 0)
  )
  returning id into v_work;

  update public.selections set updated_at = now() where id = v_id;
  return jsonb_build_object('id', v_work);
end;
$$;

-- Artist edits a work's details.
create or replace function public.update_work(
  p_token text, p_work_id uuid,
  p_title text, p_year text, p_medium text, p_dimensions text
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid := public._sl_artist_selection(p_token);
begin
  if v_id is null then raise exception 'Selection not found'; end if;
  update public.works set
    title      = left(trim(coalesce(p_title, '')), 200),
    year       = left(trim(coalesce(p_year, '')), 40),
    medium     = left(trim(coalesce(p_medium, '')), 200),
    dimensions = left(trim(coalesce(p_dimensions, '')), 120)
  where id = p_work_id and selection_id = v_id;
end;
$$;

-- Artist removes a work.
create or replace function public.delete_work(p_token text, p_work_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid := public._sl_artist_selection(p_token);
begin
  if v_id is null then raise exception 'Selection not found'; end if;
  delete from public.works where id = p_work_id and selection_id = v_id;
end;
$$;

-- Artist reorders works. p_ids = every work id in the new order.
create or replace function public.reorder_works(p_token text, p_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid := public._sl_artist_selection(p_token);
begin
  if v_id is null then raise exception 'Selection not found'; end if;
  update public.works w
  set position = o.ord - 1
  from unnest(p_ids) with ordinality as o(work_id, ord)
  where w.id = o.work_id and w.selection_id = v_id;
end;
$$;

-- Mentor saves their review. p_items = [{id, verdict, note, position}, ...]
-- p_submit = true sends it to the artist.
create or replace function public.save_review(
  p_token text, p_mentor_name text, p_overall_note text,
  p_items jsonb, p_submit boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid := public._sl_mentor_selection(p_token);
begin
  if v_id is null then raise exception 'Selection not found'; end if;

  update public.works w set
    verdict = case when i->>'verdict' in ('keep', 'maybe', 'cut') then i->>'verdict' end,
    note    = left(coalesce(i->>'note', ''), 4000),
    mentor_position = case when (i->>'position') ~ '^[0-9]{1,4}$' then (i->>'position')::int end
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as i
  where (i->>'id') ~ '^[0-9a-fA-F-]{36}$'
    and w.id = (i->>'id')::uuid
    and w.selection_id = v_id;

  update public.selections set
    mentor_name  = left(trim(coalesce(p_mentor_name, '')), 120),
    overall_note = left(coalesce(p_overall_note, ''), 8000),
    status       = case
                     when p_submit then 'reviewed'
                     when status = 'reviewed' then 'reviewed'
                     else 'in_review'
                   end,
    reviewed_at  = case when p_submit then now() else reviewed_at end,
    updated_at   = now()
  where id = v_id;

  return public._sl_payload(v_id, 'mentor');
end;
$$;


-- ---------- Who can call what ----------

revoke all on function public._sl_payload(uuid, text)      from public, anon, authenticated;
revoke all on function public._sl_artist_selection(text)   from public, anon, authenticated;
revoke all on function public._sl_mentor_selection(text)   from public, anon, authenticated;

grant execute on function public.create_selection(text, text, text)                 to anon, authenticated;
grant execute on function public.get_artist_view(text)                              to anon, authenticated;
grant execute on function public.get_mentor_view(text)                              to anon, authenticated;
grant execute on function public.update_selection(text, text, text, text)           to anon, authenticated;
grant execute on function public.add_work(text, text, int, int, text)               to anon, authenticated;
grant execute on function public.update_work(text, uuid, text, text, text, text)    to anon, authenticated;
grant execute on function public.delete_work(text, uuid)                            to anon, authenticated;
grant execute on function public.reorder_works(text, uuid[])                        to anon, authenticated;
grant execute on function public.save_review(text, text, text, jsonb, boolean)      to anon, authenticated;


-- ---------- Image storage ----------

-- A public bucket: images can be viewed by anyone who has the exact
-- link (file names are random), but files can't be listed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('works', 'works', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Second Look: upload work images" on storage.objects;
create policy "Second Look: upload work images"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'works'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  );
