import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchAllRooms, getLocalDateString, timeToMinutes } from '../lib/roomAvailability'
import {
  cancelReservation,
  createReservation,
  fetchActiveSubjects,
  fetchReservations,
  isBookingStatusActive,
  isBookingStatusCancelled,
  RESERVATION_STATUS_CANCELLED,
} from '../lib/roomReservations'

function formatTimeValue(value) {
  if (value == null || value === '') return '—'
  if (value instanceof Date) {
    return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  // Postgres may return a full timestamp string; extract clock portion when possible
  const s = String(value)
  if (s.includes('T')) {
    const d = new Date(s)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }
  if (/^\d{2}:\d{2}/.test(s)) {
    return s.slice(0, 5)
  }
  return s
}

function formatTimeRange(start, end) {
  return `${formatTimeValue(start)} – ${formatTimeValue(end)}`
}

function displaySubject(row) {
  const subj = row?.subject
  const code = subj?.subject_code
  const name = subj?.subject_name
  if (code && name) return `${code} — ${name}`
  return String(code || name || '—')
}

function displayRoom(row) {
  return row?.room?.room_number ?? '—'
}

export default function RoomReservationPage() {
  const { role } = useAuth()

  const [rooms, setRooms] = useState([])
  const [subjects, setSubjects] = useState([])

  const [scheduleDate, setScheduleDate] = useState(() => getLocalDateString())
  const [rows, setRows] = useState([])

  const [roomId, setRoomId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [requiredCapacity, setRequiredCapacity] = useState(1)
  const [date, setDate] = useState(() => getLocalDateString())
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [purpose, setPurpose] = useState('')

  const [lookupLoading, setLookupLoading] = useState(true)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)
  const [status, setStatus] = useState({ type: '', message: '' })

  const loadLookups = useCallback(async () => {
    const [r, s] = await Promise.all([fetchAllRooms(), fetchActiveSubjects()])
    setRooms(r)
    setSubjects(s)
    if (s.length > 0) {
      setSubjectId((prev) => prev || String(s[0].id))
    }
  }, [])

  const eligibleRooms = useMemo(() => {
    const min = Number(requiredCapacity)
    if (!Number.isFinite(min) || min <= 0) {
      return rooms
    }
    return (rooms ?? []).filter((r) => Number(r.capacity) >= min)
  }, [rooms, requiredCapacity])

  useEffect(() => {
    if (eligibleRooms.length === 0) {
      setRoomId('')
      return
    }
    setRoomId((prev) => {
      if (prev && eligibleRooms.some((r) => String(r.id) === String(prev))) {
        return prev
      }
      return String(eligibleRooms[0].id)
    })
  }, [eligibleRooms])

  const loadScheduleFor = useCallback(async (day) => {
    setScheduleLoading(true)
    try {
      setStatus((prev) => (prev.type === 'error' ? { type: '', message: '' } : prev))
      const data = await fetchReservations(day)
      setRows(data)
    } catch (e) {
      console.error('loadScheduleFor', e)
      setRows([])
      setStatus({ type: 'error', message: e?.message || 'Failed to load the schedule (check Supabase permissions/RLS).' })
    } finally {
      setScheduleLoading(false)
    }
  }, [])

  const loadAll = useCallback(async () => {
    setLookupLoading(true)
    setStatus({ type: '', message: '' })
    try {
      await loadLookups()
    } catch (e) {
      console.error('RoomReservationPage load', e)
      setStatus({ type: 'error', message: e?.message || 'Failed to load room reservation data.' })
      setRows([])
    } finally {
      setLookupLoading(false)
    }

    // Schedule fetch is best-effort: never block the reservation form if this hangs/fails
    void loadScheduleFor(scheduleDate)
  }, [loadLookups, loadScheduleFor, scheduleDate])

  useEffect(() => {
    if (role === 'staff') {
      void loadAll()
    }
  }, [role, loadAll])

  const onSubmit = useCallback(async (e) => {
    e.preventDefault()
    setStatus({ type: '', message: '' })

    if (!roomId || !subjectId) {
      setStatus({ type: 'error', message: 'Please select a room and a subject.' })
      return
    }
    const minCap = Number(requiredCapacity)
    if (!Number.isFinite(minCap) || !Number.isInteger(minCap) || minCap < 1) {
      setStatus({ type: 'error', message: 'Required capacity must be a whole number of at least 1.' })
      return
    }
    if (!String(purpose ?? '').trim()) {
      setStatus({ type: 'error', message: 'Purpose is required.' })
      return
    }

    const s = timeToMinutes(startTime)
    const en = timeToMinutes(endTime)
    if (en <= s) {
      setStatus({ type: 'error', message: 'End time must be after start time.' })
      return
    }

    setSaving(true)
    try {
      await createReservation({
        roomId,
        subjectId,
        date,
        startTime,
        endTime,
        purpose,
      })
      setStatus({ type: 'success', message: 'Reservation created.' })
      setPurpose('')

      // Keep schedule in sync: show the day being reserved
      setScheduleDate(date)
      await loadScheduleFor(date)
    } catch (err) {
      console.error('createReservation', err)
      const msg = err?.message || 'Could not create reservation.'
      setStatus({ type: 'error', message: msg })
    } finally {
      setSaving(false)
    }
  }, [date, endTime, loadScheduleFor, purpose, requiredCapacity, roomId, startTime, subjectId])

  const onCancel = async (id) => {
    if (!id) return
    const ok = window.confirm('Cancel this booking?')
    if (!ok) return

    setCancellingId(id)
    setStatus({ type: '', message: '' })
    try {
      await cancelReservation(id)
      setStatus({ type: 'success', message: 'Reservation cancelled.' })
      setRows((prev) =>
        (prev ?? []).map((r) => (r.id === id ? { ...r, status: RESERVATION_STATUS_CANCELLED } : r))
      )
    } catch (e) {
      console.error('cancelReservation', e)
      setStatus({ type: 'error', message: e?.message || 'Could not cancel reservation.' })
    } finally {
      setCancellingId(null)
    }
  }

  const visibleRows = useMemo(() => (rows ?? []).filter((r) => isBookingStatusActive(r?.status)), [rows])

  if (role !== 'staff') {
    return (
      <section className="page-card">
        <h2>Access denied</h2>
        <p>Room reservations are available to staff (Scheduling Coordinator) only.</p>
      </section>
    )
  }

  return (
    <section className="page-card room-reservation-page">
      <p className="eyebrow">Scheduling Coordinator</p>
      <h2>Reserve room / lab</h2>
      <p className="room-availability-intro">
        Create an official booking for a <strong>classroom or lab</strong> tied to an <strong>active subject</strong>.
        The schedule below updates for the selected day.
      </p>

      <div className="room-reservation-layout room-reservation-layout-stack">
        <form className="review-card room-reservation-card" onSubmit={(e) => void onSubmit(e)}>
          <h3 className="add-professor-title">New reservation</h3>
          <div className="student-details-grid">
            <div className="form-field">
              <label htmlFor="res-required-capacity">Required capacity</label>
              <input
                id="res-required-capacity"
                type="number"
                min={1}
                step={1}
                value={requiredCapacity}
                onChange={(e) => setRequiredCapacity(Number(e.target.value))}
                required
                disabled={saving || lookupLoading}
              />
              <p className="field-hint">Only rooms with capacity greater than or equal to this value will appear.</p>
            </div>

            <div className="form-field">
              <label htmlFor="res-room">Room</label>
              <select
                id="res-room"
                className="form-select"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                required
                disabled={saving || lookupLoading || eligibleRooms.length === 0}
              >
                {rooms.length === 0 ? <option value="">No rooms found</option> : null}
                {rooms.length > 0 && eligibleRooms.length === 0 ? (
                  <option value="">No rooms meet the required capacity</option>
                ) : null}
                {eligibleRooms.map((r) => (
                  <option key={String(r.id)} value={String(r.id)}>
                    {r.room_number ?? r.id} {r.type ? `(${r.type})` : ''} · cap {r.capacity ?? '—'}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="res-subject">Subject</label>
              <select
                id="res-subject"
                className="form-select"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                required
                disabled={saving || lookupLoading}
              >
                {subjects.length === 0 ? <option value="">No active subjects found</option> : null}
                {subjects.map((s) => (
                  <option key={String(s.id)} value={String(s.id)}>
                    {s.subject_code} — {s.subject_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="res-date">Date</label>
              <input
                id="res-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                disabled={saving || lookupLoading}
              />
            </div>

            <div className="form-field">
              <label htmlFor="res-start">Start time</label>
              <input
                id="res-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                disabled={saving || lookupLoading}
              />
            </div>

            <div className="form-field">
              <label htmlFor="res-end">End time</label>
              <input
                id="res-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                disabled={saving || lookupLoading}
              />
            </div>

            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="res-purpose">Purpose</label>
              <input
                id="res-purpose"
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g., Midterm exam session, lab practical…"
                required
                disabled={saving || lookupLoading}
              />
            </div>
          </div>

          <div className="review-actions" style={{ marginTop: 12 }}>
            {status.message ? (
              <p
                className={
                  status.type === 'error' && /room already booked/i.test(status.message)
                    ? 'alert-inline'
                    : `status-message ${status.type === 'success' ? 'success-message' : ''} ${
                        status.type === 'error' ? 'error-message' : ''
                      }`
                }
                role="status"
                style={{ flexBasis: '100%', marginTop: 0, marginBottom: 0 }}
              >
                {status.message}
              </p>
            ) : null}
            <button className="primary-button" type="submit" disabled={saving || lookupLoading}>
              {saving ? 'Submitting…' : 'Create reservation'}
            </button>
            <button type="button" className="secondary-button" onClick={() => void loadAll()} disabled={saving || lookupLoading}>
              Refresh
            </button>
          </div>
        </form>

        <div className="review-card room-reservation-card">
          <h3 className="add-professor-title" style={{ marginBottom: 10 }}>
            Schedule
          </h3>
          <div className="schedule-toolbar">
            <div className="schedule-toolbar-left">
              <label htmlFor="schedule-date">Schedule date</label>
              <input
                id="schedule-date"
                type="date"
                value={scheduleDate}
                onChange={async (e) => {
                  const next = e.target.value
                  setScheduleDate(next)
                  setStatus({ type: '', message: '' })
                  try {
                    await loadScheduleFor(next)
                  } catch (err) {
                    console.error(err)
                    setStatus({ type: 'error', message: err?.message || 'Failed to load schedule.' })
                  }
                }}
                disabled={saving || lookupLoading}
              />
            </div>

            <div className="schedule-toolbar-right">
              <button
                className="primary-button"
                type="button"
                onClick={() => void loadScheduleFor(scheduleDate).catch((err) => console.error(err))}
                disabled={saving || scheduleLoading}
              >
                Reload schedule
              </button>
            </div>
          </div>

          {lookupLoading || scheduleLoading ? <p className="status-message">Loading…</p> : null}

          <div className="table-scroll room-availability-scroll" style={{ marginTop: 12 }}>
            <table className="review-table room-availability-table">
              <caption className="sr-only">Reservations for selected date</caption>
              <thead>
                <tr>
                  <th scope="col">Room</th>
                  <th scope="col">Subject</th>
                  <th scope="col">Date</th>
                  <th scope="col">Time</th>
                  <th scope="col">Purpose</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 && !lookupLoading && !scheduleLoading ? (
                  <tr>
                    <td colSpan={7} className="room-availability-empty">
                      No bookings for this day.
                    </td>
                  </tr>
                ) : null}

                {visibleRows.map((r) => {
                  const day = normalizeDateCell(r.date)
                  const st = r.status ? String(r.status) : 'Booked'
                  const canCancel = !isBookingStatusCancelled(r?.status)
                  return (
                    <tr key={String(r.id)}>
                      <td>{displayRoom(r)}</td>
                      <td>{displaySubject(r)}</td>
                      <td>{day}</td>
                      <td>{formatTimeRange(r.start_time, r.end_time)}</td>
                      <td>{r.purpose ? String(r.purpose) : '—'}</td>
                      <td>{st}</td>
                      <td>
                        <button
                          type="button"
                          className="danger-button table-action-btn"
                          onClick={() => void onCancel(r.id)}
                          disabled={!canCancel || cancellingId === r.id}
                        >
                          {cancellingId === r.id ? 'Cancelling…' : 'Cancel'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}

function normalizeDateCell(value) {
  if (!value) return '—'
  if (typeof value === 'string') {
    return value.slice(0, 10)
  }
  return String(value)
}
