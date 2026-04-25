import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import CreateSubjectPage from './CreateSubjectPage.jsx'

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

export default function Subjects() {
  const { role } = useAuth()
  const [subjects, setSubjects] = useState([])
  const [loadError, setLoadError] = useState('')

  const fetchSubjects = useCallback(async () => {
    setLoadError('')
    let q = supabase.from('subjects').select('*').order('created_at', { ascending: false })
    // Students only see active offerings; inactive subjects stay in admin manage UI only
    if (role !== 'staff') {
      q = q.or('status.eq.Active,status.is.null')
    }
    const { data, error } = await q
    if (error) {
      setLoadError('Failed to load the course catalog.')
      return
    }
    setSubjects(data ?? [])
  }, [role])

  useEffect(() => {
    void fetchSubjects()
  }, [fetchSubjects])

  return (
    <section className="page-card subjects-page">
      <h2>Course catalog</h2>
      {role === 'staff' ? (
        <p className="room-availability-intro">
          As an Academic Administrator (staff),           you can <strong>create</strong> and <Link to="/subjects-manage">edit or deactivate subjects</Link> from the
          <strong> Manage subjects</strong> page. The list below is the live catalog; students only see
          <strong> Active</strong> courses.
        </p>
      ) : (
        <p>View the university <strong>Active</strong> course catalog. Inactive subjects are not shown here.</p>
      )}

      {role === 'staff' ? <CreateSubjectPage onCreated={fetchSubjects} /> : null}

      {loadError ? (
        <p className="status-message error-message" role="status">
          {loadError}
        </p>
      ) : null}

      <h3 className="subjects-list-heading">Offered courses</h3>
      {subjects.length === 0 && !loadError ? (
        <p className="status-message">No subjects in the catalog yet.</p>
      ) : null}
      {subjects.length > 0
        ? subjects.map((row) => (
            <div key={row.id} className="list-row subjects-list-row">
              <div>
                <strong>{getSubjectCode(row)}</strong> — {getSubjectName(row)}
              </div>
              <div className="subjects-list-meta">
                {row.type ? `${row.type} · ` : ''}
                {getDisplayHours(row)} cr · {row.department ?? '—'}
                {row.status ? ` · ${row.status}` : ''}
              </div>
            </div>
          ))
        : null}
    </section>
  )
}
