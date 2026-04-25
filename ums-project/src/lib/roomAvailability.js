import { supabase } from './supabaseClient'

export const RESERVATION_STATUS_CANCELLED = 'Cancelled'

export function isActiveReservationRow(row) {
  if (!row) return false
  const s = String(row.status ?? '')
    .trim()
    .toLowerCase()
  if (!s) return true
  if (s === 'cancelled' || s === 'canceled') return false
  return true
}

export function getLocalDateString(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function normalizeReservationDate(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    return value.slice(0, 10)
  }
  if (value instanceof Date) {
    return getLocalDateString(value)
  }
  return String(value).slice(0, 10)
}

export function timeToMinutes(value) {
  if (value == null || value === '') return 0
  if (value instanceof Date) {
    return value.getHours() * 60 + value.getMinutes()
  }
  const raw = String(value).trim()
  let clock = raw
  if (raw.includes('T')) {
    const i = raw.indexOf('T')
    clock = raw.slice(i + 1, i + 9)
  } else if (/^\d{4}-\d{2}-\d{2}\s/.test(raw)) {
    clock = raw.slice(11, 19)
  }
  clock = clock.replace(/\.\d+/, '').replace(/Z$/i, '')
  const parts = clock.split(':')
  const h = Number(parts[0]) || 0
  const min = Number(parts[1]) || 0
  const sec = Number(parts[2]) || 0
  return h * 60 + min + Math.floor(sec / 60)
}

export function getNowMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes()
}

export function reservationCoversInstant(reservation, at = new Date()) {
  if (!isActiveReservationRow(reservation)) {
    return false
  }
  const day = getLocalDateString(at)
  if (normalizeReservationDate(reservation.date) !== day) {
    return false
  }
  const nowMin = getNowMinutes(at)
  const startMin = timeToMinutes(reservation.start_time)
  const endMin = timeToMinutes(reservation.end_time)
  if (endMin <= startMin) {
    return nowMin >= startMin
  }
  return nowMin >= startMin && nowMin < endMin
}

export async function fetchAllRooms() {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, room_number, type, capacity')
    .order('room_number', { ascending: true })
  if (error) {
    throw error
  }
  return data ?? []
}

export async function fetchReservationsForDate(dateString = getLocalDateString()) {
  const { data, error } = await supabase
    .from('reservations')
    .select('id, room_id, date, start_time, end_time, status')
    .eq('date', dateString)
  if (error) {
    throw error
  }
  return (data ?? []).filter((r) => isActiveReservationRow(r))
}

export function normalizeTimeForDb(timeInput) {
  if (timeInput == null || timeInput === '') {
    return '00:00:00'
  }
  const parts = String(timeInput).split(':')
  const h = String(Math.min(23, Math.max(0, Number(parts[0]) || 0))).padStart(2, '0')
  const m = String(Math.min(59, Math.max(0, Number(parts[1]) || 0))).padStart(2, '0')
  return `${h}:${m}:00`
}

export function dateAndTimeToLocalTimestamp(dateStr, timeInput) {
  const day = normalizeReservationDate(dateStr)
  const t = normalizeTimeForDb(timeInput)
  return `${day} ${t}`
}

export function timeRangesOverlapMinutes(a1, a2, b1, b2) {
  return a1 < b2 && b1 < a2
}

export function roomIdsMatch(a, b) {
  if (a == null || b == null) return a === b
  return String(a) === String(b)
}

export function normalizeRoomIdForInsert(roomId) {
  if (roomId == null) return roomId
  if (typeof roomId === 'number' && Number.isInteger(roomId)) {
    return roomId
  }
  const s = String(roomId).trim()
  if (/^\d{1,19}$/.test(s)) {
    const n = Number(s)
    if (Number.isSafeInteger(n)) {
      return n
    }
  }
  return roomId
}

export function reservationOverlapsExisting(roomId, date, startTime, endTime, existingRows) {
  const day = normalizeReservationDate(date)
  const s = timeToMinutes(normalizeTimeForDb(startTime))
  const e = timeToMinutes(normalizeTimeForDb(endTime))
  if (e <= s) {
    return true
  }
  for (const r of existingRows) {
    if (!isActiveReservationRow(r)) continue
    if (!roomIdsMatch(r.room_id, roomId)) continue
    if (normalizeReservationDate(r.date) !== day) continue
    const rs = timeToMinutes(r.start_time)
    const re = timeToMinutes(r.end_time)
    if (re <= rs) {
      if (timeRangesOverlapMinutes(s, e, rs, 24 * 60)) return true
      continue
    }
    if (timeRangesOverlapMinutes(s, e, rs, re)) return true
  }
  return false
}

/**
 * `id` = uuid PK (NOT NULL). Set here because the table has no DEFAULT gen_random_uuid() on id.
 * `date` = date; `start_time` / `end_time` = timestamp; `room_id` = uuid FK to rooms.id.
 */
export async function createReservation({ roomId, date, startTime, endTime }) {
  const day = normalizeReservationDate(date)
  const row = {
    id: crypto.randomUUID(),
    room_id: normalizeRoomIdForInsert(roomId),
    date: day,
    start_time: dateAndTimeToLocalTimestamp(day, startTime),
    end_time: dateAndTimeToLocalTimestamp(day, endTime),
  }
  const rowWithStatus = { ...row, status: 'Booked' }
  let { error } = await supabase.from('reservations').insert([rowWithStatus])
  if (error && (error.code === '42703' || /status/i.test(String(error.message || '')))) {
    // Older DBs may not have `status` yet
    const retry = await supabase.from('reservations').insert([row])
    error = retry.error
  }
  if (error) {
    const msg = error.message || String(error)
    // room_id in DB is often still bigint / numeric while rooms.id is uuid — type must match.
    if (
      /invalid input syntax for type (bigint|numeric|integer)/i.test(msg) &&
      /[0-9a-f]{8}-[0-9a-f]{4}-/i.test(msg)
    ) {
      const hint =
        'The database is still coercing reservations.room_id to a number (numeric/bigint) while the app sends a room UUID. In Supabase → Table Editor → public.reservations → set column room_id to type uuid (FK to public.rooms.id). Or run ums-project/supabase/align_reservations_room_id.sql in the SQL editor (it truncates reservations first). The UI "uuid" in rooms does not change reservations until you migrate this column.'
      const wrapped = new Error(`${msg} — ${hint}`)
      wrapped.cause = error
      throw wrapped
    }
    throw error
  }
  return row
}

export function roomIdsBookedNow(reservations, at = new Date()) {
  const ids = new Set()
  for (const r of reservations) {
    if (reservationCoversInstant(r, at)) {
      ids.add(String(r.room_id))
    }
  }
  return ids
}

/**
 * Same day as `at` and the reservation window starts after the current clock (minutes).
 * Pairs with {@link reservationCoversInstant} so "Reserved" shows e.g. after you book 2–3pm while it is 1pm.
 * Uses the same time parsing as overlap logic (works with Postgres time/timestamp values).
 */
export function roomHasUpcomingReservationToday(reservations, roomId, at = new Date()) {
  const day = getLocalDateString(at)
  const nowMin = getNowMinutes(at)
  for (const r of reservations) {
    if (!roomIdsMatch(r.room_id, roomId)) continue
    if (normalizeReservationDate(r.date) !== day) continue
    const startMin = timeToMinutes(r.start_time)
    if (startMin > nowMin) {
      return true
    }
  }
  return false
}

/**
 * - Booked: current time is inside a reservation
 * - Reserved: has a booking that starts later today (so the room is no longer "blank" for the whole day in the UI)
 * - Free: no in-use and no upcoming booking for that room in this day’s query
 */
export function mergeRoomsWithAvailability(rooms, reservations, at = new Date()) {
  const inUseNowIds = roomIdsBookedNow(reservations, at)
  return rooms.map((room) => {
    const idStr = String(room.id)
    if (inUseNowIds.has(idStr)) {
      return { ...room, status: 'Booked' }
    }
    if (roomHasUpcomingReservationToday(reservations, room.id, at)) {
      return { ...room, status: 'Reserved' }
    }
    return { ...room, status: 'Free' }
  })
}

export function filterRooms(rooms, { type = '', minCapacity = '' } = {}) {
  let list = rooms
  const typeTrim = String(type).trim()
  if (typeTrim) {
    list = list.filter((r) => String(r.type ?? '').toLowerCase() === typeTrim.toLowerCase())
  }
  const min = Number(minCapacity)
  if (Number.isFinite(min) && min > 0) {
    list = list.filter((r) => Number(r.capacity) >= min)
  }
  return list
}

export function uniqueRoomTypes(rooms) {
  const set = new Set()
  for (const r of rooms) {
    if (r.type != null && String(r.type).trim() !== '') {
      set.add(String(r.type).trim())
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}
