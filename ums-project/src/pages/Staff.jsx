import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchStaffDirectory } from '../lib/staffDirectory'
import AddProfessorPage from './AddProfessorPage.jsx'

function displayName(row) {
  return String(row?.full_name ?? row?.name ?? '—')
}

function displayId(row) {
  const e = row?.employee_id
  if (e == null || e === '') {
    return '—'
  }
  return String(e)
}

/**
 * HR staff directory: add professor + list (Professors appear in the list after save).
 */
export default function Staff() {
  const { role } = useAuth()
  const [rows, setRows] = useState([])
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoadError('')
    setLoading(true)
    try {
      setRows(await fetchStaffDirectory())
    } catch (e) {
      console.error('fetchStaffDirectory', e)
      setLoadError(e?.message || 'Failed to load staff directory.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (role === 'staff') {
      void load()
    }
  }, [load, role])

  if (role !== 'staff') {
    return (
      <section className="page-card">
        <h2>Access denied</h2>
        <p>The staff directory is available to HR (staff) accounts only.</p>
      </section>
    )
  }

  return (
    <section className="page-card staff-directory-page">
      <p className="eyebrow">HR</p>
      <h2>Staff directory</h2>
      <p className="room-availability-intro">
        Add <strong>professors</strong> to the university record. New entries use role <strong>Professor</strong> and
        (optionally) an <strong>EMP-###</strong> employee ID. The table below refreshes when a row is created.
      </p>

      <AddProfessorPage onAdded={load} />

      <h3 className="subjects-list-heading">Directory</h3>
      {loading ? <p className="status-message">Loading directory…</p> : null}
      {loadError ? (
        <p className="status-message error-message" role="status">
          {loadError}
        </p>
      ) : null}

      {!loading && !loadError && rows.length === 0 ? (
        <p className="status-message">No staff records found. Add a professor using the form above.</p>
      ) : null}

      {!loading && !loadError && rows.length > 0 ? (
        <div className="table-scroll room-availability-scroll">
          <table className="review-table staff-directory-table">
            <caption className="sr-only">Staff directory listing</caption>
            <thead>
              <tr>
                <th scope="col">Employee ID</th>
                <th scope="col">Full name</th>
                <th scope="col">Department</th>
                <th scope="col">Email</th>
                <th scope="col">Office</th>
                <th scope="col">Role</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)}>
                  <td>{displayId(row)}</td>
                  <td>{displayName(row)}</td>
                  <td>{row.department ?? '—'}</td>
                  <td>{row.email ?? '—'}</td>
                  <td>{row.office_location ?? '—'}</td>
                  <td>{row.role ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
