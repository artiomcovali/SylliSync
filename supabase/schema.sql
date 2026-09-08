-- Run this in the Supabase SQL Editor before enabling accounts in the app.
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  code text not null,
  instructor text not null default '',
  term text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.syllabus_events (
  id text primary key,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  type text not null check (type in ('assignment', 'quiz', 'exam', 'project', 'reading', 'office_hours', 'other')),
  date date not null,
  start_time time,
  end_time time,
  all_day boolean not null default true,
  description text,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  selected boolean not null default true,
  recurring jsonb,
  created_at timestamptz not null default now()
);

alter table public.courses enable row level security;
alter table public.syllabus_events enable row level security;

create policy "Users manage their own courses" on public.courses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage events for their own courses" on public.syllabus_events
  for all using (exists (select 1 from public.courses where courses.id = syllabus_events.course_id and courses.user_id = auth.uid()))
  with check (exists (select 1 from public.courses where courses.id = syllabus_events.course_id and courses.user_id = auth.uid()));
