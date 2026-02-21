-- Tempr initial schema
-- Run via: supabase db push (or supabase migration up)

-- Users (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  spotify_user_id text,
  spotify_access_token text,
  spotify_refresh_token text,
  spotify_token_expires_at timestamptz,
  google_access_token text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Listening history snapshots (for caching)
create table if not exists public.listening_history_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  track_ids jsonb not null default '[]',
  snapshot_at timestamptz default now()
);

-- Generated queues
create table if not exists public.queues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  track_ids jsonb not null default '[]',
  mood_profile jsonb,
  source text, -- 'app_prompted' | 'user_chat' | 'user_video'
  context jsonb, -- weather, calendar, etc.
  created_at timestamptz default now()
);

-- Queue interactions (swipes, hearts) for analytics
create table if not exists public.queue_interactions (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid references public.queues(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  track_id text not null,
  action text not null, -- 'keep' | 'remove' | 'heart'
  created_at timestamptz default now()
);

-- Cached weather/calendar (server-side, via edge functions)
create table if not exists public.weather_cache (
  id uuid primary key default gen_random_uuid(),
  lat numeric not null,
  lon numeric not null,
  data jsonb not null,
  cached_at timestamptz default now()
);

create table if not exists public.calendar_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  data jsonb not null,
  cached_at timestamptz default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.listening_history_snapshots enable row level security;
alter table public.queues enable row level security;
alter table public.queue_interactions enable row level security;
alter table public.weather_cache enable row level security;
alter table public.calendar_cache enable row level security;

create policy "Users can read own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can manage own history" on public.listening_history_snapshots
  for all using (auth.uid() = user_id);

create policy "Users can manage own queues" on public.queues
  for all using (auth.uid() = user_id);

create policy "Users can manage own interactions" on public.queue_interactions
  for all using (auth.uid() = user_id);

create policy "Calendar cache by user" on public.calendar_cache
  for all using (auth.uid() = user_id);
