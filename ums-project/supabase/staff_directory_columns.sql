-- Optional: align `public.staff` with the HR "Add Professor" form.
-- If your `staff` table is only { id, name, role } for auth, add columns and unique employee_id.
-- New directory rows use id = gen_random_uuid() and do not have to match auth user id (HR records).

-- Example (adjust types/names to match your existing table):
-- alter table public.staff
--   add column if not exists employee_id text,
--   add column if not exists full_name text,
--   add column if not exists department text,
--   add column if not exists email text,
--   add column if not exists office_location text,
--   add column if not exists created_at timestamptz default now();

-- create unique index if not exists staff_employee_id_key on public.staff (employee_id)
--   where employee_id is not null;

-- RLS: ensure policies allow staff (or service role) to insert/update directory rows as needed.
