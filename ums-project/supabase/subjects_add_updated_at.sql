-- Add `updated_at` for subject edits / deactivation (if missing).
-- Safe to run more than once if your Supabase/Postgres version supports IF NOT EXISTS.

alter table public.subjects
  add column if not exists updated_at timestamptz;

-- Optional: backfill from created_at
-- update public.subjects set updated_at = coalesce(created_at, now()) where updated_at is null;
