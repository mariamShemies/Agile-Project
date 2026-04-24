import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Subjects() {
  const { role } = useAuth()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [subjects, setSubjects] = useState([])
  const [message, setMessage] = useState('')

  const fetchSubjects = async () => {
    const { data, error } = await supabase.from('subjects').select('*').order('id', { ascending: false })

    if (error) {
      setMessage('Failed to load subjects.')
      return
    }

    setSubjects(data ?? [])
  }

  const createSubject = async () => {
    setMessage('')
    if (!name.trim() || !code.trim()) {
      setMessage('Name and code are required.')
      return
    }

    const { error } = await supabase.from('subjects').insert([
      { name: name.trim(), code: code.trim(), active: true },
    ])

    if (error) {
      setMessage('Failed to create subject.')
      return
    }

    setName('')
    setCode('')
    setMessage('Subject created successfully.')
    fetchSubjects()
  }

  useEffect(() => {
    fetchSubjects()
  }, [])

  return (
    <section className="page-card">
      <h2>{role === 'staff' ? 'Subject Management' : 'Subjects'}</h2>

      {role === 'staff' ? (
        <>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
          />
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Code"
          />
          <button className="primary-button" onClick={createSubject}>Create</button>
        </>
      ) : (
        <p>View-only access enabled for students.</p>
      )}

      {message ? <p className="status-message">{message}</p> : null}

      {subjects.map((subject) => (
        <div key={subject.id} className="list-row">
          {subject.name} ({subject.code})
        </div>
      ))}
    </section>
  )
}