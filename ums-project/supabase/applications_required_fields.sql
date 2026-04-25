-- Server-side: NOT NULL on columns the UMS "New application" form always supplies.
-- Run in Supabase → SQL Editor after backing up.
--
-- 1) Check for bad rows (this should return no rows before you add NOT NULL):
--    select id, full_name, national_id, date_of_birth, email, phone, program, status, created_at
--    from public.applications
--    where full_name is null
--       or national_id is null
--       or date_of_birth is null
--       or email is null
--       or phone is null
--       or program is null
--       or status is null
--       or id is null
--       or created_at is null;
--
-- 2) Fix or remove any rows that fail the check, then run the block below.

alter table public.applications
  alter column id set not null,
  alter column full_name set not null,
  alter column national_id set not null,
  alter column date_of_birth set not null,
  alter column email set not null,
  alter column phone set not null,
  alter column program set not null,
  alter column status set not null,
  alter column created_at set not null;

-- Optional: reject clearly invalid email at the database (complements app validation).
-- Comment out if you already have rows that would fail.
-- alter table public.applications
--   add constraint applications_email_check
--   check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
