import { useCallback, useEffect, useState } from 'react'
import { fetchPublicStaffDirectory, STAFF_ROLE_TA } from '../lib/staffDirectory'

/**
 * Public staff directory page.
 * Accessible to all users (students & staff).
 * Shows safe public data: name, role, department, office location, supervisor (for TAs).
 * Hides: email, employee_id, sensitive internal fields.
 */
export default function StaffDirectory() {
  const [allStaff, setAllStaff] = useState([])
  const [filteredStaff, setFilteredStaff] = useState([])
  const [searchName, setSearchName] = useState('')
  const [searchDept, setSearchDept] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDirectory = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchPublicStaffDirectory()
      setAllStaff(data)
      setFilteredStaff(data)
    } catch (e) {
      console.error('fetchPublicStaffDirectory', e)
      setError(e?.message || 'Failed to load staff directory.')
      setAllStaff([])
      setFilteredStaff([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDirectory()
  }, [loadDirectory])

  const handleSearch = useCallback(() => {
    const nameQuery = searchName.trim().toLowerCase()
    const deptQuery = searchDept.trim().toLowerCase()

    const results = allStaff.filter((staff) => {
      const matchName = !nameQuery || (staff.full_name || '').toLowerCase().includes(nameQuery)
      const matchDept = !deptQuery || (staff.department || '').toLowerCase().includes(deptQuery)
      return matchName && matchDept
    })

    setFilteredStaff(results)
  }, [searchName, searchDept, allStaff])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    handleSearch()
  }

  const handleClear = () => {
    setSearchName('')
    setSearchDept('')
    setFilteredStaff(allStaff)
  }

  return (
    <section className="page-card staff-directory-page">
      <p className="eyebrow">University Directory</p>
      <h2>Staff Directory</h2>
      <p className="room-availability-intro">
        Search for professors and teaching assistants. Find contact information and department details below.
      </p>

      <form className="directory-search-form" onSubmit={handleSearchSubmit}>
        <div className="directory-search-bar">
          <div className="form-field">
            <label htmlFor="search-name">Name</label>
            <input
              id="search-name"
              type="text"
              placeholder="Search by full name (e.g., Dr. Smith)"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="search-dept">Department</label>
            <input
              id="search-dept"
              type="text"
              placeholder="Search by department (e.g., Computer Science)"
              value={searchDept}
              onChange={(e) => setSearchDept(e.target.value)}
            />
          </div>

          <div className="directory-search-actions">
            <button type="submit" className="primary-button directory-search-btn">
              Search
            </button>
            <button
              type="button"
              className="secondary-button directory-clear-btn"
              onClick={handleClear}
            >
              Clear
            </button>
          </div>
        </div>
      </form>

      {loading ? (
        <div className="skeleton-grid" aria-label="Loading staff directory">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="skeleton-card">
              <div className="skeleton-line skeleton-line-title" />
              <div className="skeleton-line" />
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-line-short" />
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="status-message error-message" role="status">
          {error}
        </p>
      ) : null}

      {!loading && !error && filteredStaff.length === 0 ? (
        <p className="status-message">
          {allStaff.length === 0
            ? 'No staff records found.'
            : 'No matches found. Try a different search.'}
        </p>
      ) : null}

      {!loading && !error && filteredStaff.length > 0 ? (
        <div className="directory-results">
          {filteredStaff.map((staff) => (
            <div key={String(staff.id)} className="directory-card">
              <div className="directory-card-header">
                <h3>{staff.full_name}</h3>
                <span className={`role-badge role-badge-${(staff.role || '').toLowerCase()}`}>
                  {staff.role}
                </span>
              </div>

              <div className="directory-card-body">
                <p>
                  <strong>Department:</strong> {staff.department}
                </p>

                {staff.office_location ? (
                  <p>
                    <strong>Office:</strong> {staff.office_location}
                  </p>
                ) : null}

                {staff.role === STAFF_ROLE_TA && staff.supervisor ? (
                  <p className="supervisor-info">
                    <strong>Supervised by:</strong> {staff.supervisor.full_name}{' '}
                    <span className="supervisor-role">({staff.supervisor.role})</span>
                  </p>
                ) : null}

                {Array.isArray(staff.assignments) && staff.assignments.length > 0 ? (
                  <p className="supervisor-info">
                    <strong>Assigned subjects:</strong>{' '}
                    {staff.assignments
                      .slice(0, 3)
                      .map((a) => `${a.code} (${a.role})`)
                      .join(', ')}
                    {staff.assignments.length > 3 ? ` +${staff.assignments.length - 3} more` : ''}
                  </p>
                ) : (
                  <p className="field-hint">No subject assignments yet.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
