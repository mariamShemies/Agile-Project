import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  createReservation,
  fetchAllRooms,
  fetchReservationsForDate,
  filterRooms,
  getLocalDateString,
  mergeRoomsWithAvailability,
  reservationOverlapsExisting,
  uniqueRoomTypes,
} from '../lib/roomAvailability'

export default function RoomAvailabilityPage() {
  const { role } = useAuth()
  const [rooms, setRooms] = useState([])
  const [reservations, setReservations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterMinCapacity, setFilterMinCapacity] = useState('')
  const [nowClock, setNowClock] = useState(() => new Date())

  const [reserveRoom, setReserveRoom] = useState(null)
  const [reserveDate, setReserveDate] = useState(() => getLocalDateString())
  const [reserveStart, setReserveStart] = useState('09:00')
  const [reserveEnd, setReserveEnd] = useState('10:00')
  const [reserveDayRows, setReserveDayRows] = useState([])
  const [reserveSubmitting, setReserveSubmitting] = useState(false)
  const [reserveFeedback, setReserveFeedback] = useState({ type: '', text: '' })
  const [pageNotice, setPageNotice] = useState('')

  useEffect(() => {
    const id = window.setInterval(() => setNowClock(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const loadData = useCallback(async () => {
    setErrorMessage('')
    setIsLoading(true)
    try {
      const today = getLocalDateString()
      const [roomRows, reservationRows] = await Promise.all([
        fetchAllRooms(),
        fetchReservationsForDate(today),
      ])
      setRooms(roomRows)
      setReservations(reservationRows)
    } catch (e) {
      console.error('Room availability load failed', e)
      setErrorMessage(e.message || 'Failed to load rooms or reservations.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (role === 'staff') {
      void loadData()
    }
  }, [role, loadData])

  useEffect(() => {
    if (!reserveRoom) {
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        const rows = await fetchReservationsForDate(reserveDate)
        if (!cancelled) {
          setReserveDayRows(rows)
        }
      } catch (e) {
        console.error('Failed to load reservations for reserve modal', e)
        if (!cancelled) {
          setReserveDayRows([])
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [reserveRoom, reserveDate])

  const openReserve = (room) => {
    setReserveFeedback({ type: '', text: '' })
    setReserveDate(getLocalDateString())
    setReserveStart('09:00')
    setReserveEnd('10:00')
    setReserveRoom(room)
  }

  const closeReserve = () => {
    setReserveRoom(null)
    setReserveFeedback({ type: '', text: '' })
    setReserveDayRows([])
  }

  const handleReserveSubmit = async (event) => {
    event.preventDefault()
    setReserveFeedback({ type: '', text: '' })

    const startMin =
      Number(reserveStart.split(':')[0]) * 60 + Number(reserveStart.split(':')[1] || 0)
    const endMin = Number(reserveEnd.split(':')[0]) * 60 + Number(reserveEnd.split(':')[1] || 0)
    if (endMin <= startMin) {
      setReserveFeedback({ type: 'error', text: 'End time must be after start time.' })
      return
    }

    if (
      reservationOverlapsExisting(reserveRoom.id, reserveDate, reserveStart, reserveEnd, reserveDayRows)
    ) {
      setReserveFeedback({
        type: 'error',
        text: 'This time overlaps an existing reservation for this room on that date.',
      })
      return
    }

    setReserveSubmitting(true)
    try {
      await createReservation({
        roomId: reserveRoom.id,
        date: reserveDate,
        startTime: reserveStart,
        endTime: reserveEnd,
      })
      closeReserve()
      setPageNotice('Reservation saved.')
      window.setTimeout(() => setPageNotice(''), 4000)
      await loadData()
      setNowClock(new Date())
    } catch (e) {
      console.error('Reserve failed', e)
      setReserveFeedback({ type: 'error', text: e.message || 'Could not create reservation.' })
    } finally {
      setReserveSubmitting(false)
    }
  }

  const roomsWithStatus = useMemo(
    () => mergeRoomsWithAvailability(rooms, reservations, nowClock),
    [rooms, reservations, nowClock]
  )

  const typeOptions = useMemo(() => uniqueRoomTypes(rooms), [rooms])

  const displayedRows = useMemo(
    () => filterRooms(roomsWithStatus, { type: filterType, minCapacity: filterMinCapacity }),
    [roomsWithStatus, filterType, filterMinCapacity]
  )

  if (role !== 'staff') {
    return (
      <section className="page-card">
        <h2>Access denied</h2>
        <p>Room availability is available to staff (Scheduling Coordinator) only.</p>
      </section>
    )
  }

  const todayLabel = getLocalDateString()

  return (
    <section className="page-card room-availability">
      <p className="eyebrow">Scheduling</p>
      <h2>Room availability</h2>
      <p className="room-availability-intro">
        Timetable for <strong>{todayLabel}</strong>. <strong>Booked</strong> = within a reservation right now.{' '}
        <strong>Reserved</strong> = has a booking later today. <strong>Free</strong> = not in use, and no later block today
        (past blocks no longer count toward status).
      </p>

      <div className="room-availability-toolbar">
        <div className="filter-group">
          <label htmlFor="filter-room-type">Room type</label>
          <select
            id="filter-room-type"
            className="form-select room-filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filter-min-capacity">Minimum capacity</label>
          <input
            id="filter-min-capacity"
            type="number"
            min={0}
            placeholder="e.g. 20"
            value={filterMinCapacity}
            onChange={(e) => setFilterMinCapacity(e.target.value)}
          />
        </div>
        <button className="primary-button room-refresh-btn" type="button" onClick={() => void loadData()} disabled={isLoading}>
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {pageNotice ? <p className="status-message success-message">{pageNotice}</p> : null}
      {errorMessage ? <p className="status-message error-message">{errorMessage}</p> : null}

      {isLoading ? <p className="status-message">Loading rooms…</p> : null}

      {!isLoading && !errorMessage ? (
        <div className="table-scroll room-availability-scroll">
          <table className="review-table room-availability-table">
            <caption className="sr-only">
              Room availability: room number, type, capacity, status, and reserve action
            </caption>
            <thead>
              <tr>
                <th scope="col">Room number</th>
                <th scope="col">Type</th>
                <th scope="col">Capacity</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="room-availability-empty">
                    No rooms match the current filters.
                  </td>
                </tr>
              ) : (
                displayedRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.room_number ?? '—'}</td>
                    <td>{row.type ?? '—'}</td>
                    <td>{row.capacity ?? '—'}</td>
                    <td>
                      <span
                        className={
                          row.status === 'Free'
                            ? 'room-status room-status-free'
                            : row.status === 'Booked'
                              ? 'room-status room-status-booked'
                              : 'room-status room-status-reserved'
                        }
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="primary-button table-action-btn"
                        onClick={() => openReserve(row)}
                        title="Create a reservation for this room"
                      >
                        Reserve
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {reserveRoom ? (
        <div className="modal-backdrop" role="presentation" onClick={closeReserve}>
          <div
            className="modal-panel page-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reserve-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="reserve-modal-title">Reserve room {reserveRoom.room_number ?? reserveRoom.id}</h3>
            <p className="modal-subtitle">
              {reserveRoom.type ?? 'Room'} · Capacity {reserveRoom.capacity ?? '—'}
            </p>

            <form className="reserve-form" onSubmit={(e) => void handleReserveSubmit(e)}>
              <div className="form-field">
                <label htmlFor="reserve-date">Date</label>
                <input
                  id="reserve-date"
                  type="date"
                  value={reserveDate}
                  onChange={(e) => setReserveDate(e.target.value)}
                  required
                  disabled={reserveSubmitting}
                />
              </div>
              <div className="form-field">
                <label htmlFor="reserve-start">Start time</label>
                <input
                  id="reserve-start"
                  type="time"
                  value={reserveStart}
                  onChange={(e) => setReserveStart(e.target.value)}
                  required
                  disabled={reserveSubmitting}
                />
              </div>
              <div className="form-field">
                <label htmlFor="reserve-end">End time</label>
                <input
                  id="reserve-end"
                  type="time"
                  value={reserveEnd}
                  onChange={(e) => setReserveEnd(e.target.value)}
                  required
                  disabled={reserveSubmitting}
                />
              </div>

              {reserveFeedback.text ? (
                <p
                  className={
                    reserveFeedback.type === 'success' ? 'status-message success-message' : 'status-message error-message'
                  }
                >
                  {reserveFeedback.text}
                </p>
              ) : null}

              <div className="modal-actions">
                <button className="logout-button modal-cancel" type="button" onClick={closeReserve} disabled={reserveSubmitting}>
                  Cancel
                </button>
                <button className="primary-button" type="submit" disabled={reserveSubmitting}>
                  {reserveSubmitting ? 'Saving…' : 'Save reservation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}
