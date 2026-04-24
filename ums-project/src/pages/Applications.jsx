import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Applications() {
  const { role, user } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const fetchApplications = async () => {
    if (role !== 'staff') {
      return
    }

    setLoading(true)
    const { data, error } = await supabase.from('applications').select('*').order('id', { ascending: false })

    if (error) {
      setMessage('Failed to load applications.')
      console.error(error)
    } else {
      setApplications(data ?? [])
    }
    setLoading(false)
  }

  const submitApplication = async () => {
    setMessage('')
    if (!name.trim() || !email.trim()) {
      setMessage('Name and email are required.')
      return
    }

    const { error } = await supabase.from('applications').insert([
      { name: name.trim(), email: email.trim(), status: 'pending', student_id: user?.id ?? null },
    ])

    if (error) {
      setMessage('Error submitting application.')
    } else {
      setMessage('Application submitted successfully.')
      setName('')
      setEmail('')
      fetchApplications()
    }
  }

  const updateStatus = async (id, status) => {
    const { error } = await supabase.from('applications').update({ status }).eq('id', id)

    if (error) {
      setMessage('Failed to update application status.')
      return
    }

    fetchApplications()
  }

  useEffect(() => {
    fetchApplications()
  }, [role])

  return (
    <section className="page-card">
      <h2>{role === 'staff' ? 'Applications Management' : 'Submit Application'}</h2>

      {role === 'student' ? (
        <>
          <input
            placeholder="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          <input
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <button className="primary-button" onClick={submitApplication}>
            Submit
          </button>
        </>
      ) : null}

      {message ? <p className="status-message">{message}</p> : null}

      {role === 'staff' ? (
        <>
          <h3>All Applications</h3>
          {loading ? <p>Loading applications...</p> : null}

          {applications.map((app) => (
            <div key={app.id} className="list-row">
              <span>
                {app.name} - {app.email} - <b>{app.status}</b>
              </span>

              <span className="row-actions">
                <button onClick={() => updateStatus(app.id, 'approved')}>Approve</button>
                <button onClick={() => updateStatus(app.id, 'rejected')}>Reject</button>
              </span>
            </div>
          ))}
        </>
      ) : null}
    </section>
  )
}
