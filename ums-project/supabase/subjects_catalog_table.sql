-- Course catalog: `subjects` (run once in Supabase SQL, or adjust if your table already exists)
-- Enforces unique subject_code for duplicate handling in the app (Postgres 23505).

create table if not exists public.subjects (
  id uuid primary key,
  subject_code text not null,
  subject_name text not null,
  credit_hours integer not null,
  type text not null,
  department text not null,
  status text not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (subject_code)
);

-- If the table already exists with different columns, migrate in Table Editor to match, then:
--   alter table public.subjects add constraint subjects_subject_code_key unique (subject_code);

create index if not exists subjects_department_idx on public.subjects (department);
create index if not exists subjects_status_idx on public.subjects (status);
