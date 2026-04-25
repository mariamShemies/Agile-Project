-- Fix "nothing saves" / "empty list" when using Supabase Row Level Security with the browser client.
-- Symptom: inserts/selects return errors like "new row violates row-level security policy" or empty results.
--
-- This enables authenticated users (any logged-in Supabase user) to manage reservations.
-- Adjust the USING/WITH CHECK expressions if you want to restrict to staff only.

alter table public.reservations enable row level security;

-- Read schedule + load conflict checks
drop policy if exists "reservations_select_authenticated" on public.reservations;
create policy "reservations_select_authenticated"
on public.reservations
for select
to authenticated
using (true);

-- Create bookings
drop policy if exists "reservations_insert_authenticated" on public.reservations;
create policy "reservations_insert_authenticated"
on public.reservations
for insert
to authenticated
with check (true);

-- Cancel bookings
drop policy if exists "reservations_update_authenticated" on public.reservations;
create policy "reservations_update_authenticated"
on public.reservations
for update
to authenticated
using (true)
with check (true);

-- Optional: allow anon read-only (NOT recommended) — keep disabled in production
-- create policy "reservations_select_anon" on public.reservations for select to anon using (false);
