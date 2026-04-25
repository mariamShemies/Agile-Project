import { supabase } from './supabaseClient'
import { SUBJECT_STATUS_ACTIVE } from './subjectCatalog'
import {
  dateAndTimeToLocalTimestamp,
  normalizeReservationDate,
  normalizeRoomIdForInsert,
  normalizeTimeForDb,
  reservationOverlapsExisting,
  timeToMinutes,
} from './roomAvailability'

export const RESERVATION_STATUS_BOOKED = 'Booked'
export const RESERVATION_STATUS_CANCELLED = 'Cancelled'

function normalizeReservationStatus(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

export function isBookingStatusCancelled(value) {
  return normalizeReservationStatus(value) === 'cancelled' || normalizeReservationStatus(value) === 'canceled'
}

export function isBookingStatusActive(value) {
  return !isBookingStatusCancelled(value)
}

export async function fetchActiveSubjects() {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, subject_code, subject_name, department, status')
    .eq('status', SUBJECT_STATUS_ACTIVE)
    .order('subject_code', { ascending: true })

  if (error) {
    // fallback: tolerate older rows with null/legacy status, handle filtering client-side
    const fallback = await supabase
      .from('subjects')
      .select('id, subject_code, subject_name, department, status')
      .order('subject_code', { ascending: true })
    if (fallback.error) throw fallback.error
    return (fallback.data ?? []).filter((s) => !s?.status || s.status === SUBJECT_STATUS_ACTIVE)
  }

  return data ?? []
}

/**
 * @param {string} dateString yyyy-mm-dd
 */
export async function fetchReservations(dateString) {
  const day = normalizeReservationDate(dateString)
  const { data, error } = await supabase
    .from('reservations')
    .select(
      `
      id,
      room_id,
      subject_id,
      date,
      start_time,
      end_time,
      purpose,
      status,
      room:room_id(id, room_number, type, capacity),
      subject:subject_id(id, subject_code, subject_name, status)
    `
    )
    .eq('date', day)
    .order('start_time', { ascending: true })

  if (error) {
    // Fallback without relationship embeds
    const fallback = await supabase
      .from('reservations')
      .select('id, room_id, subject_id, date, start_time, end_time, purpose, status')
      .eq('date', day)
      .order('start_time', { ascending: true })
    if (fallback.error) throw fallback.error
    return await hydrateReservationRows(fallback.data ?? [])
  }

  return data ?? []
}

async function hydrateReservationRows(rows) {
  const roomIds = [...new Set((rows ?? []).map((r) => r.room_id).filter(Boolean))]
  const subjectIds = [...new Set((rows ?? []).map((r) => r.subject_id).filter(Boolean))]

  const [roomsRes, subjectsRes] = await Promise.all([
    roomIds.length
      ? supabase.from('rooms').select('id, room_number, type, capacity').in('id', roomIds)
      : Promise.resolve({ data: [] }),
    subjectIds.length
      ? supabase.from('subjects').select('id, subject_code, subject_name, status').in('id', subjectIds)
      : Promise.resolve({ data: [] }),
  ])

  if (roomsRes.error) throw roomsRes.error
  if (subjectsRes.error) throw subjectsRes.error

  const roomMap = new Map((roomsRes.data ?? []).map((r) => [String(r.id), r]))
  const subjectMap = new Map((subjectsRes.data ?? []).map((s) => [String(s.id), s]))

  return (rows ?? []).map((r) => ({
    ...r,
    room: roomMap.get(String(r.room_id)) ?? null,
    subject: subjectMap.get(String(r.subject_id)) ?? null,
  }))
}

/**
 * @param {object} input
 * @param {string|number} input.roomId
 * @param {string|number} input.subjectId
 * @param {string} input.date
 * @param {string} input.startTime
 * @param {string} input.endTime
 * @param {string} input.purpose
 */
export async function createReservation({ roomId, subjectId, date, startTime, endTime, purpose }) {
  const day = normalizeReservationDate(date)
  const sMin = timeToMinutes(normalizeTimeForDb(startTime))
  const eMin = timeToMinutes(normalizeTimeForDb(endTime))
  if (eMin <= sMin) {
    throw new Error('End time must be after start time.')
  }

  // Validate subject is Active
  const subj = await supabase.from('subjects').select('id, status').eq('id', subjectId).maybeSingle()
  if (subj.error) throw subj.error
  if (!subj.data) {
    throw new Error('Selected subject was not found.')
  }
  if (subj.data.status && subj.data.status !== SUBJECT_STATUS_ACTIVE) {
    throw new Error('Subject must be Active to reserve a room for it.')
  }

  const { data: dayRows, error: dayErr } = await supabase
    .from('reservations')
    .select('id, room_id, date, start_time, end_time, status')
    .eq('date', day)
  if (dayErr) throw dayErr

  const activeRows = (dayRows ?? []).filter((r) => isBookingStatusActive(r?.status))
  if (reservationOverlapsExisting(roomId, day, startTime, endTime, activeRows)) {
    const err = new Error('Room already booked')
    err.code = 'conflict'
    throw err
  }

  const row = {
    id: crypto.randomUUID(),
    room_id: normalizeRoomIdForInsert(roomId),
    subject_id: subjectId,
    date: day,
    start_time: dateAndTimeToLocalTimestamp(day, startTime),
    end_time: dateAndTimeToLocalTimestamp(day, endTime),
    purpose: String(purpose ?? '').trim(),
    status: RESERVATION_STATUS_BOOKED,
  }

  const { data, error } = await supabase.from('reservations').insert([row]).select('*').maybeSingle()
  if (error) {
    const code = String(error?.code || '')
    const msg = String(error?.message || '')

    // True overlap conflicts should be caught before insert; unique violations *might* be overlap-related,
    // but they can also indicate RLS/schema issues depending on the DB. Prefer surfacing the real error.
    if (code === '23505' || /duplicate|unique/i.test(msg)) {
      const e = new Error('Room already booked (database constraint). If you believe this is wrong, check for a unique index on reservations or cancelled rows still blocking re-booking.')
      e.code = 'conflict'
      e.cause = error
      e.details = { supabaseCode: code, supabaseMessage: msg }
      throw e
    }

    const wrapped = new Error(
      `Could not save reservation: ${msg || 'Unknown error'}. If you are using Row Level Security, ensure INSERT is allowed for authenticated users on public.reservations.`
    )
    wrapped.code = 'supabase'
    wrapped.cause = error
    throw wrapped
  }

  return data
}

export async function cancelReservation(reservationId) {
  const { data, error } = await supabase
    .from('reservations')
    .update({ status: RESERVATION_STATUS_CANCELLED })
    .eq('id', reservationId)
    .select('id, status')
    .maybeSingle()

  if (error) throw error
  return data
}
