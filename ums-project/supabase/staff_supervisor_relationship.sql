-- Add professor-to-TA hierarchy support in public.staff.
-- Safe to run multiple times.

alter table public.staff
  add column if not exists supervisor_id uuid;

create index if not exists staff_supervisor_id_idx on public.staff (supervisor_id);

-- Self-reference: TA supervisor points to another staff record.
alter table public.staff
  drop constraint if exists staff_supervisor_id_fkey;

alter table public.staff
  add constraint staff_supervisor_id_fkey
  foreign key (supervisor_id)
  references public.staff (id)
  on delete set null;

-- Enforce TA must have supervisor and non-TA should not store supervisor_id.
alter table public.staff
  drop constraint if exists staff_supervisor_required_for_ta_chk;

alter table public.staff
  add constraint staff_supervisor_required_for_ta_chk
  check (
    (role = 'TA' and supervisor_id is not null)
    or (role <> 'TA' and supervisor_id is null)
  );

-- Enforce that TA supervisor row has role = 'Professor'.
create or replace function public.enforce_staff_supervisor_role()
returns trigger
language plpgsql
as $$
begin
  if new.role = 'TA' then
    if new.supervisor_id is null then
      raise exception 'TA requires supervisor_id';
    end if;

    if not exists (
      select 1
      from public.staff s
      where s.id = new.supervisor_id
        and s.role = 'Professor'
    ) then
      raise exception 'TA supervisor must reference a staff row with role=Professor';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_staff_supervisor_role on public.staff;

create trigger trg_staff_supervisor_role
before insert or update of role, supervisor_id
on public.staff
for each row
execute function public.enforce_staff_supervisor_role();
