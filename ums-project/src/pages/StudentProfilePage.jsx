import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchStudents, updateStudent } from '../lib/students'

function isValidEmail(value) {
  const v = String(value ?? '').trim()
  if (!v) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function phoneDigits(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString()
}

export default function StudentProfilePage() {
  const [students, setStudents] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState(null)

  const [isLoading, setIsLoading] = useState(true)
  const [status, setStatus] = useState({ type: '', message: '' })

  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState({ email: '', phone: '', program: '' })
  const [fieldErrors, setFieldErrors] = useState({ email: '', phone: '' })
  const [isSaving, setIsSaving] = useState(false)

  const loadStudents = useCallback(async () => {
    setIsLoading(true)
    setStatus({ type: '', message: '' })
    try {
      const data = await fetchStudents()
      setStudents(data)
      if (data.length > 0) {
        setSelectedStudentId((prev) => prev ?? data[0].student_id)
      } else {
        setSelectedStudentId(null)
      }
    } catch (e) {
      console.error('fetchStudents', e)
      setStudents([])
      setSelectedStudentId(null)
      setStatus({ type: 'error', message: e?.message || 'Failed to load students.' })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStudents()
  }, [loadStudents])

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return students
    return students.filter((s) => {
      const id = String(s.student_id ?? '').toLowerCase()
      const name = String(s.full_name ?? '').toLowerCase()
      return id.includes(q) || name.includes(q)
    })
  }, [students, searchQuery])

  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) return null
    return students.find((s) => s.student_id === selectedStudentId) ?? null
  }, [students, selectedStudentId])

  useEffect(() => {
    setEditMode(false)
    setFieldErrors({ email: '', phone: '' })
    setStatus({ type: '', message: '' })
    setDraft({
      email: selectedStudent?.email ?? '',
      phone: selectedStudent?.phone ?? '',
      program: selectedStudent?.program ?? '',
    })
  }, [selectedStudentId]) // intentionally reset when selecting a new student

  const validateDraft = useCallback(() => {
    const nextErrors = { email: '', phone: '' }
    if (!isValidEmail(draft.email)) {
      nextErrors.email = 'Please enter a valid email address.'
    }

    if (phoneDigits(draft.phone).length < 10) {
      nextErrors.phone = 'Phone number must be at least 10 digits.'
    }

    setFieldErrors(nextErrors)
    return !nextErrors.email && !nextErrors.phone
  }, [draft.email, draft.phone])

  const handleSave = useCallback(async () => {
    if (!selectedStudent) return
    setStatus({ type: '', message: '' })

    if (!validateDraft()) {
      setStatus({ type: 'error', message: 'Please fix validation errors before saving.' })
      return
    }

    setIsSaving(true)
    try {
      const updated = await updateStudent(selectedStudent.student_id, {
        email: String(draft.email ?? '').trim(),
        phone: String(draft.phone ?? '').trim(),
        program: String(draft.program ?? '').trim(),
      })

      setStudents((prev) =>
        prev.map((s) => (s.student_id === selectedStudent.student_id ? (updated ?? s) : s)),
      )
      setEditMode(false)
      setStatus({ type: 'success', message: 'Student record updated successfully.' })
    } catch (e) {
      console.error('updateStudent', e)
      setStatus({ type: 'error', message: e?.message || 'Failed to update student record.' })
    } finally {
      setIsSaving(false)
    }
  }, [draft.email, draft.phone, draft.program, selectedStudent, validateDraft])

  const handleCancelEdit = useCallback(() => {
    setEditMode(false)
    setFieldErrors({ email: '', phone: '' })
    setStatus({ type: '', message: '' })
    setDraft({
      email: selectedStudent?.email ?? '',
      phone: selectedStudent?.phone ?? '',
      program: selectedStudent?.program ?? '',
    })
  }, [selectedStudent])

  const lastUpdatedText = useMemo(() => {
    if (!selectedStudent?.updated_at) return '—'
    const d = new Date(selectedStudent.updated_at)
    if (Number.isNaN(d.getTime())) return String(selectedStudent.updated_at)
    return d.toLocaleString()
  }, [selectedStudent?.updated_at])

  return (
    <section className="page-card student-profile-page">
      <p className="eyebrow">Registrar</p>
      <h2>Student Records</h2>
      <p className="room-availability-intro">Search, view, and edit student contact information and program details.</p>

      <div className="student-profile-toolbar">
        <div className="form-field student-profile-search">
          <label htmlFor="student-search">Search</label>
          <input
            id="student-search"
            type="text"
            placeholder="Search by Student ID or full name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <p className="field-hint">Matches on student ID or full name.</p>
        </div>

        <div className="student-profile-toolbar-actions">
          <label className="form-field-checkbox" htmlFor="edit-mode-toggle">
            <input
              id="edit-mode-toggle"
              type="checkbox"
              checked={editMode}
              onChange={(e) => {
                const enabled = e.target.checked
                setEditMode(enabled)
                setStatus({ type: '', message: '' })
                setFieldErrors({ email: '', phone: '' })
                if (!enabled) {
                  setDraft({
                    email: selectedStudent?.email ?? '',
                    phone: selectedStudent?.phone ?? '',
                    program: selectedStudent?.program ?? '',
                  })
                }
              }}
              disabled={!selectedStudent || isSaving}
            />
            Edit mode
          </label>

          <button
            type="button"
            className="secondary-button"
            onClick={loadStudents}
            disabled={isLoading || isSaving}
          >
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? <p className="status-message">Loading students…</p> : null}

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

      {!isLoading && filteredStudents.length === 0 ? (
        <p className="status-message">{students.length === 0 ? 'No students found.' : 'No matches found.'}</p>
      ) : null}

      <div className="student-profile-grid">
        <div className="student-list" aria-label="Students list">
          {filteredStudents.map((s) => {
            const isActive = s.student_id === selectedStudentId
            return (
              <button
                key={String(s.student_id)}
                type="button"
                className={`student-list-row${isActive ? ' student-list-row-active' : ''}`}
                onClick={() => setSelectedStudentId(s.student_id)}
                disabled={isSaving}
              >
                <div className="student-list-row-main">
                  <p className="student-list-name">{s.full_name}</p>
                  <p className="student-list-meta">{s.student_id}</p>
                </div>
                <span className="student-list-program">{s.program || '—'}</span>
              </button>
            )
          })}
        </div>

        <div className="student-details" aria-label="Student details">
          {!selectedStudent ? (
            <div className="review-card">
              <p className="status-message">Select a student to view details.</p>
            </div>
          ) : (
            <div className="review-card student-details-card">
              <div className="student-details-header">
                <div>
                  <h3 className="student-details-title">{selectedStudent.full_name}</h3>
                  <p className="student-details-subtitle">
                    <strong>Student ID:</strong> {selectedStudent.student_id}
                  </p>
                </div>

                <div className="student-details-updated">
                  <p className="student-details-updated-label">Last updated</p>
                  <p className="student-details-updated-value">{lastUpdatedText}</p>
                </div>
              </div>

              <div className="student-details-grid">
                <div className="form-field">
                  <label>Student ID</label>
                  <div className="employee-id-readonly">{selectedStudent.student_id}</div>
                </div>

                <div className="form-field">
                  <label>Full name</label>
                  <div className="employee-id-readonly">{selectedStudent.full_name}</div>
                </div>

                <div className="form-field">
                  <label htmlFor="student-email">Email</label>
                  <input
                    id="student-email"
                    type="email"
                    value={draft.email}
                    onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))}
                    onBlur={() => {
                      if (!editMode) return
                      validateDraft()
                    }}
                    disabled={!editMode || isSaving}
                    placeholder="student@university.edu"
                  />
                  {fieldErrors.email ? <p className="field-error">{fieldErrors.email}</p> : null}
                </div>

                <div className="form-field">
                  <label htmlFor="student-phone">Phone</label>
                  <input
                    id="student-phone"
                    type="tel"
                    value={draft.phone}
                    onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))}
                    onBlur={() => {
                      if (!editMode) return
                      validateDraft()
                    }}
                    disabled={!editMode || isSaving}
                    placeholder="e.g., +20 10 1234 5678"
                  />
                  {fieldErrors.phone ? <p className="field-error">{fieldErrors.phone}</p> : null}
                </div>

                <div className="form-field">
                  <label htmlFor="student-program">Program</label>
                  <input
                    id="student-program"
                    type="text"
                    value={draft.program}
                    onChange={(e) => setDraft((p) => ({ ...p, program: e.target.value }))}
                    disabled={!editMode || isSaving}
                    placeholder="e.g., Computer Science"
                  />
                </div>

                <div className="form-field">
                  <label>Enrollment date</label>
                  <div className="employee-id-readonly">{formatDate(selectedStudent.enrollment_date) || '—'}</div>
                </div>
              </div>

              {editMode ? (
                <div className="review-actions student-details-actions">
                  <button type="button" className="primary-button" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" className="secondary-button" onClick={handleCancelEdit} disabled={isSaving}>
                    Cancel
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

