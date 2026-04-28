import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import CreateSubjectPage from './CreateSubjectPage.jsx'
import { ASSIGNMENT_ROLE_INSTRUCTOR } from '../lib/subjectAssignments'

function getSubjectCode(row) {
  return row.subject_code ?? row.code ?? '—'
}

function getSubjectName(row) {
  return row.subject_name ?? row.name ?? '—'
}

function getDisplayHours(row) {
  if (row.credit_hours != null && row.credit_hours !== '') {
    return row.credit_hours
  }
  return '—'
}

function getSubjectType(row) {
  return row.type ?? 'Core'
}

function normalizeForFilter(status) {
  return String(status ?? 'Active')
    .trim()
    .toLowerCase()
}

export default function Subjects() {
  const { role } = useAuth()
  const [subjects, setSubjects] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [instructorBySubjectId, setInstructorBySubjectId] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [departmentFilter, setDepartmentFilter] = useState('All')
  const [selectedSubject, setSelectedSubject] = useState(null)

  const fetchSubjects = useCallback(async () => {
    setLoadError('')
    setInstructorBySubjectId({})
    setIsLoading(true)
    try {
      let q = supabase.from('subjects').select('*').order('created_at', { ascending: false })
      // Students only see active offerings; inactive subjects stay in admin manage UI only
      if (role !== 'staff') {
        q = q.eq('status', 'Active')
      }
      const { data, error } = await q
      if (error) {
        setLoadError('Failed to load the course catalog.')
        setSubjects([])
        return
      }
      const rows = data ?? []
      setSubjects(rows)

      try {
        const ids = rows.map((r) => r.id).filter(Boolean)
        if (ids.length === 0) return
        const { data: aData, error: aErr } = await supabase
          .from('subject_assignments')
          .select('subject_id, role, staff:staff_id(full_name)')
          .eq('role', ASSIGNMENT_ROLE_INSTRUCTOR)
          .in('subject_id', ids)

        if (aErr) return

        const map = {}
        for (const a of aData ?? []) {
          if (a?.subject_id && a?.staff?.full_name) {
            map[a.subject_id] = a.staff.full_name
          }
        }
        setInstructorBySubjectId(map)
      } catch (e) {
        console.error('subjects instructor lookup', e)
      }
    } finally {
      setIsLoading(false)
    }
  }, [role])

  useEffect(() => {
    void fetchSubjects()
  }, [fetchSubjects])

  const uniqueDepartments = useMemo(() => {
    const depts = new Set()
    for (const row of subjects) {
      if (row.department && String(row.department).trim()) {
        depts.add(String(row.department).trim())
      }
    }
    return [...depts].sort()
  }, [subjects])

  const uniqueTypes = useMemo(() => {
    const types = new Set()
    for (const row of subjects) {
      if (row.type && String(row.type).trim()) {
        types.add(String(row.type).trim())
      }
    }
    return [...types].sort()
  }, [subjects])

  const filteredSubjects = useMemo(() => {
    let result = subjects

    // Filter by status (active only for students)
    if (role !== 'staff') {
      result = result.filter((row) => normalizeForFilter(row.status) === 'active')
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase()
      result = result.filter((row) => {
        const code = String(getSubjectCode(row)).toLowerCase()
        const name = String(getSubjectName(row)).toLowerCase()
        return code.includes(query) || name.includes(query)
      })
    }

    // Filter by type
    if (typeFilter !== 'All') {
      result = result.filter((row) => getSubjectType(row) === typeFilter)
    }

    // Filter by department
    if (departmentFilter !== 'All') {
      result = result.filter((row) => row.department === departmentFilter)
    }

    return result
  }, [subjects, searchQuery, typeFilter, departmentFilter, role])

  return (
    <section className="page-card subjects-page">
      <p className="eyebrow">Course Catalog</p>
      <h2>Browse Subjects</h2>
      {role === 'staff' ? (
        <p className="room-availability-intro">
          As an Academic Administrator (staff), you can <strong>create</strong> and{' '}
          <Link to="/subjects-manage">edit or deactivate subjects</Link> from the <strong>Manage subjects</strong> page.
          The list below shows all courses; students only see <strong>Active</strong> courses.
        </p>
      ) : (
        <p className="room-availability-intro">
          Browse all available <strong>Active</strong> courses at the university. Click any course to view details.
        </p>
      )}

      {role === 'staff' ? <CreateSubjectPage onCreated={fetchSubjects} /> : null}

      {loadError ? (
        <p className="status-message error-message" role="status">
          {loadError}
        </p>
      ) : null}

      {isLoading ? <p className="status-message">Loading course catalog…</p> : null}

      {!isLoading && !loadError ? (
        <>
          <div className="subjects-controls">
            <div className="subjects-search-box">
              <input
                type="search"
                placeholder="Search by course name or code…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search courses by name or code"
              />
            </div>

            <div className="subjects-filter-box">
              <div className="filter-group">
                <label htmlFor="type-filter">Type</label>
                <select
                  id="type-filter"
                  className="form-select"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="All">All</option>
                  {uniqueTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="dept-filter">Department</label>
                <select
                  id="dept-filter"
                  className="form-select"
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                >
                  <option value="All">All</option>
                  {uniqueDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {(searchQuery || typeFilter !== 'All' || departmentFilter !== 'All') ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setSearchQuery('')
                    setTypeFilter('All')
                    setDepartmentFilter('All')
                  }}
                >
                  Clear Filters
                </button>
              ) : null}
            </div>
          </div>

          {filteredSubjects.length === 0 ? (
            <p className="status-message subjects-empty-state">
              No courses found. Try adjusting your search or filters.
            </p>
          ) : null}

          {filteredSubjects.length > 0 ? (
            <div className="subjects-grid">
              {filteredSubjects.map((row) => (
                <div
                  key={row.id}
                  className="subject-card"
                  onClick={() => setSelectedSubject(row)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelectedSubject(row)
                    }
                  }}
                >
                  <div className="subject-card-header">
                    <div className="subject-code-badge">{getSubjectCode(row)}</div>
                    {row.type ? <span className="subject-type-badge">{row.type}</span> : null}
                  </div>

                  <h3 className="subject-card-title">{getSubjectName(row)}</h3>

                  <div className="subject-card-meta">
                    <span className="subject-meta-item">{getDisplayHours(row)} credits</span>
                    {row.department ? <span className="subject-meta-item">{row.department}</span> : null}
                  </div>

                  {instructorBySubjectId[row.id] ? (
                    <div className="subject-card-instructor">Instructor: {instructorBySubjectId[row.id]}</div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {selectedSubject ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedSubject(null)}>
          <div
            className="modal-panel page-card subjects-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="subject-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="subjects-modal-header">
              <h3 id="subject-detail-title">
                {getSubjectCode(selectedSubject)} — {getSubjectName(selectedSubject)}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedSubject(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="subjects-modal-body">
              <div className="subject-detail-row">
                <span className="detail-label">Course Code:</span>
                <span className="detail-value">{getSubjectCode(selectedSubject)}</span>
              </div>

              <div className="subject-detail-row">
                <span className="detail-label">Course Name:</span>
                <span className="detail-value">{getSubjectName(selectedSubject)}</span>
              </div>

              <div className="subject-detail-row">
                <span className="detail-label">Type:</span>
                <span className="detail-value">{getSubjectType(selectedSubject)}</span>
              </div>

              <div className="subject-detail-row">
                <span className="detail-label">Credit Hours:</span>
                <span className="detail-value">{getDisplayHours(selectedSubject)}</span>
              </div>

              <div className="subject-detail-row">
                <span className="detail-label">Department:</span>
                <span className="detail-value">{selectedSubject.department ?? '—'}</span>
              </div>

              {instructorBySubjectId[selectedSubject.id] ? (
                <div className="subject-detail-row">
                  <span className="detail-label">Instructor:</span>
                  <span className="detail-value">{instructorBySubjectId[selectedSubject.id]}</span>
                </div>
              ) : null}

              {selectedSubject.description ? (
                <div className="subject-detail-section">
                  <span className="detail-label">Description:</span>
                  <p className="detail-description">{selectedSubject.description}</p>
                </div>
              ) : null}
            </div>

            <div className="modal-actions">
              <button type="button" className="primary-button" onClick={() => setSelectedSubject(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
