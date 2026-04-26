import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchAllRooms, getLocalDateString, normalizeReservationDate, timeToMinutes } from '../lib/roomAvailability'
import {
  cancelReservation,
  fetchReservationsForSubjectIds,
  isBookingStatusActive,
  updateReservation,
} from '../lib/roomReservations'
import { fetchProfessorSupervisors } from '../lib/staffDirectory'
import { fetchInstructorSubjectsForStaff } from '../lib/subjectAssignments'

function formatDate(value) {
  if (!value) return '—'
  return String(value).slice(0, 10)
}

function formatTimeValue(value) {
  if (value == null || value === '') return '—'
  const raw = String(value)
  if (raw.includes('T')) {
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }
  if (/^\d{2}:\d{2}/.test(raw)) {
    return raw.slice(0, 5)
  }
  return raw
}

function formatTimeRange(start, end) {
  return `${formatTimeValue(start)} – ${formatTimeValue(end)}`
}

function getStaffLabel(row) {
  return String(row?.full_name ?? row?.name ?? '—')
}

function getSubjectLabel(row) {
  const subject = row?.subject
  const code = subject?.subject_code
  const name = subject?.subject_name
  if (code && name) {
    return `${code} — ${name}`
  }
  return String(code || name || '—')
}

function getRoomLabel(row) {
  return row?.room?.room_number ?? '—'
}

function isOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart
}

function buildConflictMap(rows) {
  const conflictReasons = new Map()
  const sortedRows = [...rows].sort((left, right) => {
    const leftDate = normalizeReservationDate(left?.date)
    const rightDate = normalizeReservationDate(right?.date)
    if (leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate)
    }
    return timeToMinutes(left?.start_time) - timeToMinutes(right?.start_time)
  })

  const pushReason = (rowId, message) => {
    if (!rowId) return
    const next = conflictReasons.get(rowId) ?? []
    next.push(message)
    conflictReasons.set(rowId, next)
  }

  for (let i = 0; i < sortedRows.length; i += 1) {
    const left = sortedRows[i]
    const leftDay = normalizeReservationDate(left?.date)
    const leftStart = timeToMinutes(left?.start_time)
    const leftEnd = timeToMinutes(left?.end_time)
    if (leftEnd <= leftStart) {
      continue
    }

    for (let j = i + 1; j < sortedRows.length; j += 1) {
      const right = sortedRows[j]
      const rightDay = normalizeReservationDate(right?.date)
      if (leftDay !== rightDay) {
        continue
      }

      const rightStart = timeToMinutes(right?.start_time)
      const rightEnd = timeToMinutes(right?.end_time)
      if (rightEnd <= rightStart) {
        continue
      }

      if (!isOverlap(leftStart, leftEnd, rightStart, rightEnd)) {
        continue
      }

      const leftLabel = `${getSubjectLabel(left)} ${formatTimeRange(left.start_time, left.end_time)} in room ${getRoomLabel(left)}`
      const rightLabel = `${getSubjectLabel(right)} ${formatTimeRange(right.start_time, right.end_time)} in room ${getRoomLabel(right)}`
      pushReason(left.id, `Overlaps with ${rightLabel}`)
      pushReason(right.id, `Overlaps with ${leftLabel}`)
    }
  }

  return conflictReasons
}

export default function ProfessorSchedulePage() {
  const { role } = useAuth()

  const [professors, setProfessors] = useState([])
  const [rooms, setRooms] = useState([])
  const [professorSubjects, setProfessorSubjects] = useState([])
  const [scheduleRows, setScheduleRows] = useState([])
  const [selectedProfessorId, setSelectedProfessorId] = useState('')
  const [isLoadingLookups, setIsLoadingLookups] = useState(true)
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false)
  const [savingReservationId, setSavingReservationId] = useState(null)
  const [cancellingReservationId, setCancellingReservationId] = useState(null)
  const [notice, setNotice] = useState({ type: '', message: '' })
  const [editReservation, setEditReservation] = useState(null)
  const [editDraft, setEditDraft] = useState({
    roomId: '',
    subjectId: '',
    date: getLocalDateString(),
    startTime: '09:00',
    endTime: '10:00',
    purpose: '',
  })

  const selectedProfessor = useMemo(
    () => professors.find((row) => String(row.id) === String(selectedProfessorId)) ?? null,
    [professors, selectedProfessorId]
  )

  const conflictMap = useMemo(() => buildConflictMap(scheduleRows), [scheduleRows])
  const visibleSubjects = professorSubjects
  const visibleRows = scheduleRows

  const loadProfessorSchedule = useCallback(async (professorId) => {
    const normalizedProfessorId = String(professorId ?? '').trim()
    if (!normalizedProfessorId) {
      setProfessorSubjects([])
      setScheduleRows([])
      return
    }

    setIsLoadingSchedule(true)
    setNotice({ type: '', message: '' })
    try {
      const subjects = await fetchInstructorSubjectsForStaff(normalizedProfessorId)
      setProfessorSubjects(subjects)

      if (subjects.length === 0) {
        setScheduleRows([])
        return
      }

      const reservations = await fetchReservationsForSubjectIds(subjects.map((subject) => subject.id))
      setScheduleRows((reservations ?? []).filter((row) => isBookingStatusActive(row?.status)))
    } catch (error) {
      console.error('Failed to load professor schedule', error)
      setScheduleRows([])
      setProfessorSubjects([])
      setNotice({ type: 'error', message: error?.message || 'Failed to load professor schedule.' })
    } finally {
      setIsLoadingSchedule(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadLookups = async () => {
      setIsLoadingLookups(true)
      try {
        const [professorRows, roomRows] = await Promise.all([fetchProfessorSupervisors(), fetchAllRooms()])
        if (cancelled) return

        setProfessors(professorRows)
        setRooms(roomRows)

        setSelectedProfessorId((current) => {
          if (current) {
            return current
          }
          return String(professorRows[0]?.id ?? '')
        })
      } catch (error) {
        console.error('Failed to load schedule lookups', error)
        if (!cancelled) {
          setNotice({ type: 'error', message: error?.message || 'Failed to load professor list or rooms.' })
          setProfessors([])
          setRooms([])
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLookups(false)
        }
      }
    }

    void loadLookups()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedProfessorId) {
      setScheduleRows([])
      setProfessorSubjects([])
      return
    }

    let cancelled = false
    const run = async () => {
      await loadProfessorSchedule(selectedProfessorId)
      if (cancelled) {
        return
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [loadProfessorSchedule, selectedProfessorId])

  useEffect(() => {
    setEditReservation(null)
  }, [selectedProfessorId])

  const openEditReservation = (row) => {
    setNotice({ type: '', message: '' })
    setEditReservation(row)
    setEditDraft({
      roomId: String(row?.room_id ?? ''),
      subjectId: String(row?.subject_id ?? ''),
      date: formatDate(row?.date),
      startTime: formatTimeValue(row?.start_time),
      endTime: formatTimeValue(row?.end_time),
      purpose: String(row?.purpose ?? ''),
    })
  }

  const closeEditReservation = () => {
    setEditReservation(null)
  }

  const handleEditChange = (field) => (event) => {
    const { value } = event.target
    setEditDraft((current) => ({ ...current, [field]: value }))
  }

  const handleSaveReservation = async (event) => {
    event.preventDefault()
    if (!editReservation) {
      return
    }

    setSavingReservationId(editReservation.id)
    setNotice({ type: '', message: '' })
    try {
      const updated = await updateReservation(editReservation.id, {
        roomId: editDraft.roomId,
        subjectId: editDraft.subjectId,
        date: editDraft.date,
        startTime: editDraft.startTime,
        endTime: editDraft.endTime,
        purpose: editDraft.purpose,
      })

      setScheduleRows((current) => current.map((row) => (String(row.id) === String(updated.id) ? updated : row)))
      setEditReservation(null)
      setNotice({ type: 'success', message: 'Reservation updated.' })
    } catch (error) {
      console.error('Failed to update reservation', error)
      setNotice({ type: 'error', message: error?.message || 'Could not update reservation.' })
    } finally {
      setSavingReservationId(null)
    }
  }

  const handleCancelReservation = async (row) => {
    const ok = window.confirm('Cancel this booking?')
    if (!ok) {
      return
    }

    setCancellingReservationId(row.id)
    setNotice({ type: '', message: '' })
    try {
      await cancelReservation(row.id)
      setScheduleRows((current) => current.filter((entry) => String(entry.id) !== String(row.id)))
      if (String(editReservation?.id) === String(row.id)) {
        setEditReservation(null)
      }
      setNotice({ type: 'success', message: 'Reservation cancelled.' })
    } catch (error) {
      console.error('Failed to cancel reservation', error)
      setNotice({ type: 'error', message: error?.message || 'Could not cancel reservation.' })
    } finally {
      setCancellingReservationId(null)
    }
  }

  const selectedProfessorName = selectedProfessor ? getStaffLabel(selectedProfessor) : 'No professor selected'

  if (role !== 'staff') {
    return (
      <section className="page-card">
        <h2>Access denied</h2>
        <p>Professor schedule view is available to staff accounts only.</p>
      </section>
    )
  }

  return (
    <section className="page-card professor-schedule-page">
      <p className="eyebrow">Scheduling</p>
      <h2>Professor Schedule</h2>
      <p className="room-availability-intro">
        Select a professor to view all bookings tied to their instructor assignments. Conflicting time slots are
        highlighted automatically.
      </p>

      <div className="room-availability-toolbar professor-schedule-toolbar">
        <div className="filter-group professor-schedule-select-group">
          <label htmlFor="professor-select">Professor</label>
          <select
            id="professor-select"
            className="form-select professor-schedule-select"
            value={selectedProfessorId}
            onChange={(event) => setSelectedProfessorId(event.target.value)}
            disabled={isLoadingLookups || professors.length === 0}
          >
            {professors.length === 0 ? <option value="">No professors found</option> : null}
            {professors.map((professor) => (
              <option key={String(professor.id)} value={String(professor.id)}>
                {getStaffLabel(professor)}
              </option>
            ))}
          </select>
        </div>

        <button
          className="primary-button room-refresh-btn"
          type="button"
          onClick={() => void loadProfessorSchedule(selectedProfessorId)}
          disabled={isLoadingLookups || isLoadingSchedule || !selectedProfessorId}
        >
          {isLoadingSchedule ? 'Refreshing…' : 'Refresh schedule'}
        </button>
      </div>

      <p className="field-hint professor-schedule-selected">
        Showing schedule for <strong>{selectedProfessorName}</strong>
        {visibleSubjects.length > 0 ? ` · ${visibleSubjects.length} instructor assignment${visibleSubjects.length === 1 ? '' : 's'}` : ''}
      </p>

      {isLoadingLookups || isLoadingSchedule ? <p className="status-message">Loading professor schedule…</p> : null}
      {notice.message ? (
        <p className={notice.type === 'success' ? 'status-message success-message' : 'status-message error-message'} role="status">
          {notice.message}
        </p>
      ) : null}

      {!isLoadingLookups && !isLoadingSchedule && visibleRows.length === 0 ? (
        <p className="status-message">No bookings found for this professor.</p>
      ) : null}

      {!isLoadingLookups && !isLoadingSchedule && visibleRows.length > 0 ? (
        <div className="table-scroll room-availability-scroll">
          <table className="review-table professor-schedule-table">
            <caption className="sr-only">Professor schedule and action buttons</caption>
            <thead>
              <tr>
                <th scope="col">Subject Name</th>
                <th scope="col">Room</th>
                <th scope="col">Date</th>
                <th scope="col">Start Time</th>
                <th scope="col">End Time</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const conflictReasons = conflictMap.get(row.id) ?? []
                const conflictTitle = conflictReasons.length > 0 ? conflictReasons.join('\n') : ''
                const isConflicting = conflictReasons.length > 0
                const isEditingThisRow = editReservation && String(editReservation.id) === String(row.id)
                const isBusy = savingReservationId === row.id || cancellingReservationId === row.id

                return (
                  <tr key={String(row.id)} className={isConflicting ? 'conflict-row' : ''} title={conflictTitle || undefined}>
                    <td>
                      <div className="schedule-subject-cell">
                        <span>{getSubjectLabel(row)}</span>
                        <span className="subject-instructor-subtitle">Instructor: {selectedProfessorName}</span>
                        {isConflicting ? (
                          <span className="conflict-badge" title={conflictTitle}>
                            ⚠ Conflict
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>{getRoomLabel(row)}</td>
                    <td>{formatDate(row.date)}</td>
                    <td>{formatTimeValue(row.start_time)}</td>
                    <td>{formatTimeValue(row.end_time)}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="primary-button table-action-btn"
                          onClick={() => openEditReservation(row)}
                          disabled={isBusy || isLoadingLookups}
                        >
                          {isEditingThisRow ? 'Editing…' : 'Edit'}
                        </button>
                        <button
                          type="button"
                          className="danger-button table-action-btn"
                          onClick={() => void handleCancelReservation(row)}
                          disabled={isBusy || isLoadingLookups}
                        >
                          {cancellingReservationId === row.id ? 'Cancelling…' : 'Cancel'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {editReservation ? (
        <div className="modal-backdrop" role="presentation" onClick={() => (savingReservationId ? null : closeEditReservation())}>
          <div
            className="modal-panel page-card professor-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="professor-schedule-edit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="professor-schedule-edit-title">Edit reservation</h3>
            <p className="modal-subtitle">
              Update the booking and the schedule will re-check for conflicts immediately after save.
            </p>

            <form className="reserve-form professor-edit-form" onSubmit={(event) => void handleSaveReservation(event)}>
              <div className="professor-edit-grid">
                <div className="form-field">
                  <label htmlFor="edit-subject">Subject</label>
                  <select
                    id="edit-subject"
                    className="form-select"
                    value={editDraft.subjectId}
                    onChange={handleEditChange('subjectId')}
                    disabled={savingReservationId !== null || visibleSubjects.length === 0}
                    required
                  >
                    {visibleSubjects.length === 0 ? <option value="">No instructor assignments found</option> : null}
                    {visibleSubjects.map((subject) => (
                      <option key={String(subject.id)} value={String(subject.id)}>
                        {String(subject.subject_code ?? '—')} — {String(subject.subject_name ?? '—')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="edit-room">Room</label>
                  <select
                    id="edit-room"
                    className="form-select"
                    value={editDraft.roomId}
                    onChange={handleEditChange('roomId')}
                    disabled={savingReservationId !== null || rooms.length === 0}
                    required
                  >
                    {rooms.length === 0 ? <option value="">No rooms found</option> : null}
                    {rooms.map((room) => (
                      <option key={String(room.id)} value={String(room.id)}>
                        {room.room_number ?? room.id} {room.type ? `(${room.type})` : ''} · cap {room.capacity ?? '—'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="edit-date">Date</label>
                  <input
                    id="edit-date"
                    type="date"
                    value={editDraft.date}
                    onChange={handleEditChange('date')}
                    required
                    disabled={savingReservationId !== null}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="edit-start">Start time</label>
                  <input
                    id="edit-start"
                    type="time"
                    value={editDraft.startTime}
                    onChange={handleEditChange('startTime')}
                    required
                    disabled={savingReservationId !== null}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="edit-end">End time</label>
                  <input
                    id="edit-end"
                    type="time"
                    value={editDraft.endTime}
                    onChange={handleEditChange('endTime')}
                    required
                    disabled={savingReservationId !== null}
                  />
                </div>

                <div className="form-field professor-edit-purpose">
                  <label htmlFor="edit-purpose">Purpose</label>
                  <input
                    id="edit-purpose"
                    type="text"
                    value={editDraft.purpose}
                    onChange={handleEditChange('purpose')}
                    placeholder="e.g., Lecture, lab, review session"
                    required
                    disabled={savingReservationId !== null}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button className="logout-button modal-cancel" type="button" onClick={closeEditReservation} disabled={savingReservationId !== null}>
                  Cancel
                </button>
                <button className="primary-button" type="submit" disabled={savingReservationId !== null}>
                  {savingReservationId ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}