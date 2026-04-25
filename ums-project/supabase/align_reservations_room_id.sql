-- Make reservations.room_id match public.rooms.id (uuid).
-- Run this if you see: invalid input syntax for type bigint / numeric: "<uuid>"
-- That means room_id is still int/bigint/numeric; Postgres cannot store a room UUID in that column.
--
-- Back up public.reservations first. This TRUNCATE deletes all rows in reservations.

TRUNCATE TABLE public.reservations;

ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_room_id_fkey;

ALTER TABLE public.reservations
  DROP COLUMN IF EXISTS room_id;

ALTER TABLE public.reservations
  ADD COLUMN room_id uuid NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE;
