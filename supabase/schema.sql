-- Engineer AI database schema. Run this in the Supabase SQL Editor (once).
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS.

create extension if not exists pg_trgm;

-- ---------- Profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- Chats ----------
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chats_user_idx on public.chats (user_id, updated_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_chat_idx on public.messages (chat_id, created_at);

-- ---------- Papers ----------
create table if not exists public.papers (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  subject text,
  course text,
  institution text,
  level text,
  year int,
  exam_type text,
  file_path text not null,
  file_type text not null,
  file_size bigint not null,
  -- private: only the uploader (used for "Solve with Engineer AI")
  -- pending: awaiting moderation (only if moderation is switched on)
  -- published: visible and downloadable by everyone
  -- removed: taken down by an admin
  status text not null default 'private' check (status in ('private','pending','published','removed')),
  download_count int not null default 0,
  report_count int not null default 0,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists papers_status_idx on public.papers (status, published_at desc);
create index if not exists papers_search_idx on public.papers using gin ((coalesce(title,'') || ' ' || coalesce(subject,'') || ' ' || coalesce(course,'') || ' ' || coalesce(institution,'')) gin_trgm_ops);

create table if not exists public.paper_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  paper_id uuid not null references public.papers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, paper_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  reason text not null check (reason in ('inappropriate','copyright','incorrect','spam','other')),
  details text,
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text,
  email text,
  message text not null,
  created_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.papers enable row level security;
alter table public.paper_saves enable row level security;
alter table public.reports enable row level security;
alter table public.feedback enable row level security;

-- profiles: you see/update your own (role cannot be changed by you); admins see all
drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

-- chats + messages: strictly private to the owner
drop policy if exists "chats owner all" on public.chats;
create policy "chats owner all" on public.chats for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "messages owner all" on public.messages;
create policy "messages owner all" on public.messages for all
  using (exists (select 1 from public.chats c where c.id = chat_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.chats c where c.id = chat_id and c.user_id = auth.uid()));

-- papers: PUBLIC can read published; owners read their own; admins read all.
-- All writes go through server routes (service role) after validation, so no client write policies.
drop policy if exists "papers read" on public.papers;
create policy "papers read" on public.papers for select
  using (status = 'published' or uploader_id = auth.uid() or public.is_admin());

-- saves: private to the user
drop policy if exists "saves owner all" on public.paper_saves;
create policy "saves owner all" on public.paper_saves for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- reports + feedback: written by server routes; only admins read
drop policy if exists "reports admin read" on public.reports;
create policy "reports admin read" on public.reports for select using (public.is_admin());
drop policy if exists "feedback admin read" on public.feedback;
create policy "feedback admin read" on public.feedback for select using (public.is_admin());

-- ---------- Storage ----------
-- One PRIVATE bucket. Files are only ever handed out through /api/papers/[id]/download
-- as short-lived signed URLs, and only for published papers (or the owner/admin).
insert into storage.buckets (id, name, public, file_size_limit)
values ('papers', 'papers', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;
-- No storage.objects policies are created on purpose: the browser cannot read or write
-- this bucket directly. The server uses the service role key.

-- To make yourself an admin after signing up:
--   update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');

-- ---------- Helper functions called by the server ----------
create or replace function public.increment_download(p uuid) returns void
language sql security definer set search_path = public as $$
  update public.papers set download_count = download_count + 1 where id = p and status = 'published';
$$;
revoke all on function public.increment_download(uuid) from public, anon, authenticated;
grant execute on function public.increment_download(uuid) to service_role;

-- ---------- Generated engineering images (private to the owner) ----------
create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  prompt text,
  style text,
  svg text not null check (length(svg) <= 250000),
  created_at timestamptz not null default now()
);
create index if not exists images_user_idx on public.images (user_id, created_at desc);
alter table public.images enable row level security;
drop policy if exists "images owner all" on public.images;
create policy "images owner all" on public.images for all using (user_id = auth.uid()) with check (user_id = auth.uid());
