import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  fetchActiveElectiveSubjects,
  fetchStudentRegistrations,
  fetchUnmetPrerequisiteSubjectIds,
  MAX_ELECTIVE_CREDITS,
  registerStudentSubjects,
  removeStudentRegistration,
} from '../lib/electiveRegistrations'

function getCreditValue(subject) {
  const n = Number(subject?.credit_hours ?? 0)
  if (!Number.isFinite(n)) return 0
  return n
}

function getJoinedSubject(registrationRow) {
  const value = registrationRow?.subject
  if (Array.isArray(value)) {
    return value[0] ?? null
  }
  return value ?? null
}

function getRegisteredCreditValue(registrationRow) {
  return getCreditValue(getJoinedSubject(registrationRow))
}

export default function ElectiveRegistrationPage() {
  const { role, user } = useAuth()

  const [electiveSubjects, setElectiveSubjects] = useState([])
  const [registeredSubjects, setRegisteredSubjects] = useState([])
  const [selectedSubjects, setSelectedSubjects] = useState([])
  const [status, setStatus] = useState({ type: '', message: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [prerequisiteStatus, setPrerequisiteStatus] = useState({
    supported: false,
    unmetSubjectIds: new Set(),
  })

  const studentId = user?.id ?? null

  const loadPageData = useCallback(async ({ silent = false } = {}) => {
    if (!studentId) {
      setIsLoading(false)
      setIsRefreshing(false)
      return
    }

    if (silent) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      const [subjects, registrations] = await Promise.all([
        fetchActiveElectiveSubjects(),
        fetchStudentRegistrations(studentId),
      ])

      setElectiveSubjects(subjects)
      setRegisteredSubjects(registrations)

      const electiveIds = subjects.map((row) => row.id).filter(Boolean)
      const prerequisiteInfo = await fetchUnmetPrerequisiteSubjectIds(studentId, electiveIds)
      setPrerequisiteStatus({
        supported: Boolean(prerequisiteInfo.supported),
        unmetSubjectIds: new Set(prerequisiteInfo.unmetSubjectIds ?? []),
      })

      // Keep local selection in sync with currently available electives.
      setSelectedSubjects((prev) => prev.filter((subjectId) => electiveIds.includes(subjectId)))
    } catch (error) {
      console.error('elective registration load', error)
      setStatus({ type: 'error', message: error?.message || 'Failed to load elective registration data.' })
      setElectiveSubjects([])
      setRegisteredSubjects([])
      setSelectedSubjects([])
      setPrerequisiteStatus({ supported: false, unmetSubjectIds: new Set() })
    } finally {
      if (silent) {
        setIsRefreshing(false)
      } else {
        setIsLoading(false)
      }
    }
  }, [studentId])

  useEffect(() => {
    void loadPageData()
  }, [loadPageData])

  const registeredSubjectIdSet = useMemo(
    () => new Set((registeredSubjects ?? []).map((row) => row.subject_id).filter(Boolean)),
    [registeredSubjects],
  )

  const electiveById = useMemo(() => {
    const map = new Map()
    for (const row of electiveSubjects) {
      if (row?.id) {
        map.set(row.id, row)
      }
    }
    return map
  }, [electiveSubjects])

  const registeredCredits = useMemo(() => {
    return registeredSubjects.reduce((sum, row) => sum + getRegisteredCreditValue(row), 0)
  }, [registeredSubjects])

  const toggleSubject = useCallback(
    (subject, checked) => {
      if (!subject?.id) return

      const subjectId = subject.id

      if (!checked) {
        setSelectedSubjects((prev) => prev.filter((id) => id !== subjectId))
        return
      }

      if (registeredSubjectIdSet.has(subjectId)) {
        return
      }

      if (prerequisiteStatus.supported && prerequisiteStatus.unmetSubjectIds.has(subjectId)) {
        return
      }

      setSelectedSubjects((prev) => {
        if (prev.includes(subjectId)) {
          return prev
        }

        const currentCredits = prev.reduce((sum, id) => {
          return sum + getCreditValue(electiveById.get(id))
        }, 0)
        const nextSelectedCredits = currentCredits + getCreditValue(subject)
        const nextTotalCredits = registeredCredits + nextSelectedCredits
        if (nextTotalCredits > MAX_ELECTIVE_CREDITS) {
          setStatus({ type: 'error', message: 'Credit limit exceeded' })
          return prev
        }

        return [...prev, subjectId]
      })
    },
    [electiveById, prerequisiteStatus, registeredCredits, registeredSubjectIdSet],
  )

  const onRegisterSelected = useCallback(async () => {
    if (!studentId || selectedSubjects.length === 0) {
      return
    }

    const selectedCredits = selectedSubjects.reduce((sum, subjectId) => {
      return sum + getCreditValue(electiveById.get(subjectId))
    }, 0)
    const nextTotalCredits = registeredCredits + selectedCredits
    if (nextTotalCredits > MAX_ELECTIVE_CREDITS) {
      setStatus({ type: 'error', message: 'Credit limit exceeded' })
      return
    }

    setIsSubmitting(true)
    setStatus({ type: '', message: '' })

    try {
      await registerStudentSubjects(studentId, selectedSubjects)
      setSelectedSubjects([])
      await loadPageData({ silent: true })
      setStatus({ type: 'success', message: 'Selected subjects registered successfully.' })
    } catch (error) {
      console.error('register selected subjects', error)
      setStatus({ type: 'error', message: error?.message || 'Failed to register selected subjects.' })
    } finally {
      setIsSubmitting(false)
    }
  }, [electiveById, loadPageData, registeredCredits, selectedSubjects, studentId])

  const onRemoveSubject = useCallback(
    async (subjectId) => {
      if (!studentId || !subjectId) return

      const previousRows = registeredSubjects
      setRegisteredSubjects((prev) => prev.filter((row) => row.subject_id !== subjectId))
      setSelectedSubjects((prev) => prev.filter((id) => id !== subjectId))

      try {
        await removeStudentRegistration(studentId, subjectId)
        await loadPageData({ silent: true })
        setStatus({ type: 'success', message: 'Subject removed from your registrations.' })
      } catch (error) {
        console.error('remove registration', error)
        setRegisteredSubjects(previousRows)
        setStatus({ type: 'error', message: error?.message || 'Failed to remove subject registration.' })
      }
    },
    [loadPageData, registeredSubjects, studentId],
  )

  if (role !== 'student') {
    return (
      <section className="page-card">
        <h2>Access denied</h2>
        <p>Elective registration is available to students only.</p>
      </section>
    )
  }

  return (
    <section className="page-card elective-registration-page">
      <p className="eyebrow">Student Services</p>
      <h2>Register for Elective Subjects</h2>
      <p className="room-availability-intro">
        Select active elective subjects and register in one step. Duplicate registrations are blocked automatically.
      </p>

      {status.type === 'success' && status.message ? (
        <p
          className="status-message success-message"
          role="status"
        >
          {status.message}
        </p>
      ) : null}

      {isLoading ? <p className="status-message">Loading elective subjects…</p> : null}

      {!isLoading ? (
        <>
          <section className="elective-section">
            <div className="elective-section-header">
              <h3>Available Elective Subjects</h3>
              <p className="elective-credits">Total Credits: {registeredCredits} / {MAX_ELECTIVE_CREDITS}</p>
            </div>

            <div className="table-scroll elective-table-scroll">
              <table className="review-table elective-table" aria-label="Elective subjects table">
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Subject Code</th>
                    <th>Subject Name</th>
                    <th>Credit Hours</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {electiveSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <p className="status-message elective-empty">No active elective subjects available.</p>
                      </td>
                    </tr>
                  ) : (
                    electiveSubjects.map((subject) => {
                      const subjectId = subject.id
                      const alreadyRegistered = registeredSubjectIdSet.has(subjectId)
                      const blockedByPrerequisite =
                        prerequisiteStatus.supported && prerequisiteStatus.unmetSubjectIds.has(subjectId)

                      let disabledReason = ''
                      if (alreadyRegistered) {
                        disabledReason = 'Already registered'
                      } else if (blockedByPrerequisite) {
                        disabledReason = 'Prerequisites not satisfied'
                      }

                      return (
                        <tr key={subjectId}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedSubjects.includes(subjectId)}
                              onChange={(e) => toggleSubject(subject, e.target.checked)}
                              disabled={isSubmitting || alreadyRegistered || blockedByPrerequisite}
                              aria-label={`Select ${subject.subject_code || subject.subject_name || 'subject'}`}
                            />
                          </td>
                          <td>{subject.subject_code ?? '—'}</td>
                          <td>{subject.subject_name ?? '—'}</td>
                          <td>{subject.credit_hours ?? '—'}</td>
                          <td>
                            {disabledReason ? <span className="badge-warning">{disabledReason}</span> : 'Available'}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="elective-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => void onRegisterSelected()}
                disabled={isSubmitting || selectedSubjects.length === 0}
              >
                {isSubmitting ? 'Registering…' : 'Register Selected Subjects'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void loadPageData({ silent: true })}
                disabled={isRefreshing || isSubmitting}
              >
                {isRefreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </section>

          <section className="elective-section">
            <div className="elective-section-header">
              <h3>My Registered Subjects</h3>
            </div>

            <div className="table-scroll elective-table-scroll">
              <table className="review-table elective-table" aria-label="My registered subjects table">
                <thead>
                  <tr>
                    <th>Subject Code</th>
                    <th>Subject Name</th>
                    <th>Credit Hours</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {registeredSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <p className="status-message elective-empty">You have not registered for any elective subjects yet.</p>
                      </td>
                    </tr>
                  ) : (
                    registeredSubjects.map((row) => {
                      const joinedSubject = getJoinedSubject(row)
                      return (
                      <tr key={row.id ?? row.subject_id}>
                        <td>{joinedSubject?.subject_code ?? '—'}</td>
                        <td>{joinedSubject?.subject_name ?? '—'}</td>
                        <td>{joinedSubject?.credit_hours ?? '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="secondary-button table-action-btn"
                            onClick={() => void onRemoveSubject(row.subject_id)}
                            disabled={isSubmitting || isRefreshing}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {status.type === 'error' && status.message ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setStatus({ type: '', message: '' })}>
          <div
            className="modal-panel page-card elective-error-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="elective-error-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="elective-error-title" className="elective-error-title">Action failed</h3>
            <p className="elective-error-message">{status.message}</p>
            <div className="modal-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => setStatus({ type: '', message: '' })}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
