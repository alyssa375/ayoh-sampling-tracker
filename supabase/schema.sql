-- ============================================================
-- AYOH SAMPLING TRACKER - Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES TABLE
-- Extended user info beyond Supabase Auth
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  email text not null,
  role text not null default 'rep' check (role in ('rep', 'admin')),
  hourly_rate numeric(10, 2) default 0,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'rep')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- CLOCK EVENTS TABLE
-- Each row = one clock-in or clock-out
-- ============================================================
create table public.clock_events (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  event_type text not null check (event_type in ('clock_in', 'clock_out')),
  timestamp timestamptz default now() not null,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  location_name text,        -- reverse-geocoded or store name
  store_name text,           -- which store they're at
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- SHIFTS VIEW
-- Pairs clock-in and clock-out events into complete shifts
-- ============================================================
create or replace view public.shifts as
with ranked as (
  select
    id,
    user_id,
    event_type,
    timestamp,
    store_name,
    latitude,
    longitude,
    location_name,
    row_number() over (partition by user_id order by timestamp) as rn
  from public.clock_events
),
clock_ins as (
  select id as clock_in_id, user_id, timestamp as clock_in_time, store_name,
         latitude as in_lat, longitude as in_lng, location_name as in_location, rn
  from ranked where event_type = 'clock_in'
),
clock_outs as (
  select id as clock_out_id, user_id, timestamp as clock_out_time,
         latitude as out_lat, longitude as out_lng, location_name as out_location, rn
  from ranked where event_type = 'clock_out'
)
select
  ci.clock_in_id,
  co.clock_out_id,
  ci.user_id,
  ci.clock_in_time,
  co.clock_out_time,
  ci.store_name,
  ci.in_lat,
  ci.in_lng,
  ci.in_location,
  co.out_lat,
  co.out_lng,
  co.out_location,
  extract(epoch from (co.clock_out_time - ci.clock_in_time)) / 3600 as hours_worked
from clock_ins ci
left join clock_outs co on ci.user_id = co.user_id and co.rn = ci.rn + 1
  and co.clock_out_time > ci.clock_in_time;

-- ============================================================
-- EVENT REPORTS TABLE
-- Submitted after each sampling event
-- ============================================================
create table public.event_reports (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  event_date date not null default current_date,
  store_name text not null,
  store_address text,
  city text,
  state text,
  products_sampled text[] default '{}',   -- array of product names
  units_sampled integer default 0,
  consumer_interactions integer default 0,
  units_sold integer default 0,
  notes text,
  photo_urls text[] default '{}',          -- photos from the event
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- EXPENSES TABLE
-- Rep submits an expense with receipt photo
-- ============================================================
create table public.expenses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  expense_date date not null default current_date,
  category text not null check (category in (
    'supplies', 'travel', 'mileage', 'food', 'equipment', 'other'
  )),
  amount numeric(10, 2) not null,
  description text not null,
  receipt_url text,            -- path in Supabase storage
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.clock_events enable row level security;
alter table public.event_reports enable row level security;
alter table public.expenses enable row level security;

-- Profiles: users see their own; admins see all
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins can update any profile"
  on public.profiles for update
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- Clock events: reps manage own; admins see all
create policy "Reps can insert own clock events"
  on public.clock_events for insert
  with check (auth.uid() = user_id);

create policy "Reps can view own clock events"
  on public.clock_events for select
  using (auth.uid() = user_id);

create policy "Admins can view all clock events"
  on public.clock_events for select
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- Event reports: reps manage own; admins see all
create policy "Reps can insert own event reports"
  on public.event_reports for insert
  with check (auth.uid() = user_id);

create policy "Reps can view own event reports"
  on public.event_reports for select
  using (auth.uid() = user_id);

create policy "Reps can update own event reports"
  on public.event_reports for update
  using (auth.uid() = user_id);

create policy "Admins can view all event reports"
  on public.event_reports for select
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- Expenses: reps manage own; admins see all and can update status
create policy "Reps can insert own expenses"
  on public.expenses for insert
  with check (auth.uid() = user_id);

create policy "Reps can view own expenses"
  on public.expenses for select
  using (auth.uid() = user_id);

create policy "Admins can view all expenses"
  on public.expenses for select
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "Admins can update expense status"
  on public.expenses for update
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- ============================================================
-- STORAGE BUCKET for receipts & event photos
-- Run this after creating the bucket in Supabase dashboard
-- ============================================================

-- In Supabase Dashboard > Storage, create a bucket named "receipts"
-- Then run:
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict do nothing;

create policy "Reps can upload their receipts"
  on storage.objects for insert
  with check (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Reps can view their receipts"
  on storage.objects for select
  using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Admins can view all receipts"
  on storage.objects for select
  using (
    bucket_id = 'receipts' and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- SAMPLE DATA (optional - remove before production)
-- ============================================================
-- To create your first admin user:
-- 1. Sign up normally through the app
-- 2. Then run: update public.profiles set role = 'admin' where email = 'alyssa@ayohfoods.com';
