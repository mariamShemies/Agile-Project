-- Optional: align `public.reservations` with the Scheduling Coordinator feature.
-- Run in Supabase SQL editor if your table is missing any of these columns.

alter table public.reservations
  add column if not exists subject_id uuid references public.subjects (id) on delete restrict;

alter table public.reservations
  add column if not exists purpose text;

alter table public.reservations
  add column if not exists status text not null default 'Booked';

alter table public.reservations
  drop constraint if exists reservations_status_check;

alter table public.reservations
  add constraint reservations_status_check
  check (status in ('Booked', 'Cancelled'));

-- Helpful for conflict prevention (optional, depends on your desired rules):
-- create unique index if not exists reservations_room_time_unique
-- on public.reservations (room_id, date, start_time, end_time)
-- where status = 'Booked';
