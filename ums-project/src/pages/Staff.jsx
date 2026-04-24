import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Staff() {
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  const addProfessor = async () => {
    if (!name.trim()) {
      setMessage('Name is required.')
      return
    }

    const { error } = await supabase.from('staff').insert([{ name: name.trim(), role: 'professor' }])

    if (error) {
      setMessage('Failed to add professor.')
      return
    }

    setName('')
    setMessage('Professor added successfully.')
  }

  return (
    <section className="page-card">
      <h2>Add Professor</h2>
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Professor name" />
      <button className="primary-button" onClick={addProfessor}>Add</button>
      {message ? <p className="status-message">{message}</p> : null}
    </section>
  )
}