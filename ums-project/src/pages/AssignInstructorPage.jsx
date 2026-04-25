import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ASSIGNMENT_ROLE_INSTRUCTOR,
  ASSIGNMENT_ROLE_TA,
  assignInstructor,
  fetchAssignments,
  fetchStaff,
  fetchSubjects,
} from '../lib/subjectAssignments'
import { STAFF_ROLE_PROFESSOR, STAFF_ROLE_TA } from '../lib/staffDirectory'

function toDisplayName(staff) {
  return staff?.full_name || '—'
}

export default function AssignInstructorPage() {
  const [subjects, setSubjects] = useState([])
  const [staff, setStaff] = useState([])
  const [assignments, setAssignments] = useState([])

  const [subjectQuery, setSubjectQuery] = useState('')
  const [staffQuery, setStaffQuery] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState(null)
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [selectedRole, setSelectedRole] = useState(ASSIGNMENT_ROLE_INSTRUCTOR)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })

  const load = useCallback(async () => {
    setLoading(true)
    setStatus({ type: '', message: '' })
    try {
      const [subjectsData, staffData] = await Promise.all([fetchSubjects(), fetchStaff()])
      setSubjects(subjectsData)
      setStaff(staffData)

      const subjectIds = (subjectsData ?? []).map((s) => s.id).filter(Boolean)
      const assignmentData = await fetchAssignments(subjectIds)
      setAssignments(assignmentData)

      if ((subjectsData ?? []).length > 0) {
        setSelectedSubjectId((prev) => prev ?? subjectsData[0].id)
      } else {
        setSelectedSubjectId(null)
      }
    } catch (e) {
      console.error('AssignInstructorPage load', e)
      setSubjects([])
      setStaff([])
      setAssignments([])
      setSelectedSubjectId(null)
      setStatus({ type: 'error', message: e?.message || 'Failed to load assignment data.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const assignmentsBySubject = useMemo(() => {
    const map = new Map()
    for (const a of assignments ?? []) {
      const sid = a?.subject_id
      if (!sid) continue
      const arr = map.get(sid) ?? []
      arr.push(a)
      map.set(sid, arr)
    }
    return map
  }, [assignments])

  const filteredSubjects = useMemo(() => {
    const q = subjectQuery.trim().toLowerCase()
    if (!q) return subjects
    return (subjects ?? []).filter((s) => {
      const code = String(s.subject_code ?? '').toLowerCase()
      const name = String(s.subject_name ?? '').toLowerCase()
      return code.includes(q) || name.includes(q)
    })
  }, [subjects, subjectQuery])

  const filteredStaff = useMemo(() => {
    const q = staffQuery.trim().toLowerCase()
    const requiredRole = selectedRole === ASSIGNMENT_ROLE_TA ? STAFF_ROLE_TA : STAFF_ROLE_PROFESSOR

    return (staff ?? []).filter((s) => {
      if (s?.role !== requiredRole) return false
      if (!q) return true
      const name = String(s.full_name ?? '').toLowerCase()
      const role = String(s.role ?? '').toLowerCase()
      return name.includes(q) || role.includes(q)
    })
  }, [staff, staffQuery, selectedRole])

  useEffect(() => {
    if (!selectedStaffId) return
    const stillValid = filteredStaff.some((s) => String(s.id) === String(selectedStaffId))
    if (!stillValid) {
      setSelectedStaffId('')
    }
  }, [filteredStaff, selectedStaffId])

  const selectedSubject = useMemo(() => subjects.find((s) => s.id === selectedSubjectId) ?? null, [subjects, selectedSubjectId])

  const subjectInstructor = useMemo(() => {
    if (!selectedSubjectId) return null
    const list = assignmentsBySubject.get(selectedSubjectId) ?? []
    return list.find((a) => a.role === ASSIGNMENT_ROLE_INSTRUCTOR) ?? null
  }, [assignmentsBySubject, selectedSubjectId])

  const subjectTAs = useMemo(() => {
    if (!selectedSubjectId) return []
    const list = assignmentsBySubject.get(selectedSubjectId) ?? []
    return list.filter((a) => a.role === ASSIGNMENT_ROLE_TA)
  }, [assignmentsBySubject, selectedSubjectId])

  const isUnassigned = useCallback(
    (subjectId) => {
      const list = assignmentsBySubject.get(subjectId) ?? []
      return !list.some((a) => a.role === ASSIGNMENT_ROLE_INSTRUCTOR)
    },
    [assignmentsBySubject]
  )

  const handleAssign = useCallback(async () => {
    if (!selectedSubjectId) {
      setStatus({ type: 'error', message: 'Please select a subject first.' })
      return
    }
    if (!selectedStaffId) {
      setStatus({ type: 'error', message: 'Please select a staff member first.' })
      return
    }

    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      await assignInstructor({
        subjectId: selectedSubjectId,
        staffId: selectedStaffId,
        role: selectedRole,
      })

      const refreshed = await fetchAssignments([selectedSubjectId])
      setAssignments((prev) => {
        const others = (prev ?? []).filter((a) => a.subject_id !== selectedSubjectId)
        return [...others, ...refreshed]
      })

      setStatus({ type: 'success', message: 'Assignment saved.' })
    } catch (e) {
      console.error('assignInstructor', e)
      setStatus({ type: 'error', message: e?.message || 'Failed to assign staff to subject.' })
    } finally {
      setSaving(false)
    }
  }, [selectedRole, selectedStaffId, selectedSubjectId])

  return (
    <section className="page-card assign-instructor-page">
      <p className="eyebrow">Department Head</p>
      <h2>Assign instructor to subject</h2>
      <p className="room-availability-intro">
        Only <strong>Active</strong> subjects and <strong>Active</strong> staff appear here. Each subject can have one
        main <strong>Instructor</strong> (Professor) and one or more <strong>TAs</strong>.
      </p>

      <div className="student-profile-toolbar">
        <div className="form-field student-profile-search">
          <label htmlFor="subject-search">Search subjects</label>
          <input
            id="subject-search"
            type="text"
            placeholder="Search by subject code or name"
            value={subjectQuery}
            onChange={(e) => setSubjectQuery(e.target.value)}
          />
        </div>

        <div className="student-profile-toolbar-actions">
          <button type="button" className="secondary-button" onClick={load} disabled={loading || saving}>
            Refresh
          </button>
        </div>
      </div>

      {loading ? <p className="status-message">Loading…</p> : null}

      {status.message ? (
        <p
          className={`status-message ${status.type === 'success' ? 'success-message' : ''} ${
            status.type === 'error' ? 'error-message' : ''
          }`}
          role="status"
        >
          {status.message}
        </p>
      ) : null}

      {!loading && filteredSubjects.length === 0 ? (
        <p className="status-message">No active subjects found.</p>
      ) : null}

      <div className="student-profile-grid assign-grid">
        <div className="student-list" aria-label="Subjects list">
          {filteredSubjects.map((s) => {
            const active = s.id === selectedSubjectId
            const needsInstructor = isUnassigned(s.id)
            return (
              <button
                key={String(s.id)}
                type="button"
                className={`student-list-row${active ? ' student-list-row-active' : ''}${
                  needsInstructor ? ' assign-needs-instructor' : ''
                }`}
                onClick={() => {
                  setSelectedSubjectId(s.id)
                  setStatus({ type: '', message: '' })
                }}
                disabled={saving}
              >
                <div className="student-list-row-main">
                  <p className="student-list-name">
                    {s.subject_code} — {s.subject_name}
                  </p>
                  <p className="student-list-meta">{s.department ?? '—'}</p>
                </div>
                <span className="student-list-program">{needsInstructor ? 'Unassigned' : 'Assigned'}</span>
              </button>
            )
          })}
        </div>

        <div className="student-details" aria-label="Assignment details">
          {!selectedSubject ? (
            <div className="review-card">
              <p className="status-message">Select a subject to assign staff.</p>
            </div>
          ) : (
            <div className="review-card student-details-card">
              <div className="student-details-header">
                <div>
                  <h3 className="student-details-title">
                    {selectedSubject.subject_code} — {selectedSubject.subject_name}
                  </h3>
                  <p className="student-details-subtitle">
                    <strong>Department:</strong> {selectedSubject.department ?? '—'}
                  </p>
                </div>
              </div>

              <div className="assignment-summary">
                <p>
                  <strong>Instructor:</strong>{' '}
                  {subjectInstructor?.staff?.full_name ? subjectInstructor.staff.full_name : '—'}
                </p>
                <p>
                  <strong>TAs:</strong>{' '}
                  {subjectTAs.length === 0
                    ? '—'
                    : subjectTAs
                        .map((a) => a?.staff?.full_name)
                        .filter(Boolean)
                        .join(', ')}
                </p>
              </div>

              <div className="student-details-grid">
                <div className="form-field">
                  <label htmlFor="assignment-role">Assign as</label>
                  <select
                    id="assignment-role"
                    className="form-select"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    disabled={saving}
                  >
                    <option value={ASSIGNMENT_ROLE_INSTRUCTOR}>Instructor (Professor)</option>
                    <option value={ASSIGNMENT_ROLE_TA}>TA</option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="staff-search">Search staff</label>
                  <input
                    id="staff-search"
                    type="text"
                    placeholder="Search by name or role"
                    value={staffQuery}
                    onChange={(e) => setStaffQuery(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="staff-select">Select staff</label>
                  <select
                    id="staff-select"
                    className="form-select"
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    disabled={saving}
                  >
                    <option value="">Choose a staff member…</option>
                    {filteredStaff.map((s) => (
                      <option key={String(s.id)} value={s.id}>
                        {toDisplayName(s)} — {s.role ?? '—'}
                      </option>
                    ))}
                  </select>
                  <p className="field-hint">Only Active staff are listed.</p>
                </div>
              </div>

              <div className="review-actions student-details-actions">
                <button type="button" className="primary-button" onClick={handleAssign} disabled={saving}>
                  {saving ? 'Assigning…' : 'Assign Instructor'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

