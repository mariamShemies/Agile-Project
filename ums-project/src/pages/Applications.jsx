import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

const initialForm = {
  full_name: '',
  national_id: '',
  date_of_birth: '',
  email: '',
  phone: '',
  program: '',
}

export default function Applications() {
  const { role } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedbackState, setFeedbackState] = useState('idle')
  const [feedbackMessage, setFeedbackMessage] = useState('')

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFeedbackState('idle')
    setFeedbackMessage('')

    const applicationId = crypto.randomUUID()
    const nowIso = new Date().toISOString()

    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('applications').insert([
        {
          id: applicationId,
          full_name: form.full_name.trim(),
          national_id: form.national_id.trim(),
          date_of_birth: form.date_of_birth,
          email: form.email.trim(),
          phone: form.phone.trim(),
          program: form.program.trim(),
          status: 'Pending',
          created_at: nowIso,
        },
      ])

      if (error) {
        throw error
      }

      setForm(initialForm)
      setFeedbackState('success')
      setFeedbackMessage('Application submitted successfully and is pending review')
    } catch (error) {
      console.error('Failed to submit application', error)
      setFeedbackState('error')
      setFeedbackMessage(error.message || 'Failed to submit application. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (role !== 'staff') {
    return (
      <section className="page-card">
        <h2>Access denied</h2>
        <p>Application submission is only available to staff (Admissions).</p>
      </section>
    )
  }

  return (
    <section className="page-card">
      <p className="eyebrow">Admissions</p>
      <h2>New application</h2>
      <p>Enter the applicant’s details. The record is saved immediately as Pending; approval happens separately in Review.</p>

      <form className="application-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="full_name">Full name</label>
          <input
            id="full_name"
            name="full_name"
            value={form.full_name}
            onChange={updateField('full_name')}
            autoComplete="name"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="form-field">
          <label htmlFor="national_id">National ID</label>
          <input
            id="national_id"
            name="national_id"
            value={form.national_id}
            onChange={updateField('national_id')}
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="form-field">
          <label htmlFor="date_of_birth">Date of birth</label>
          <input
            id="date_of_birth"
            name="date_of_birth"
            type="date"
            value={form.date_of_birth}
            onChange={updateField('date_of_birth')}
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={updateField('email')}
            autoComplete="email"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="form-field">
          <label htmlFor="phone">Phone</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={updateField('phone')}
            autoComplete="tel"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="form-field">
          <label htmlFor="program">Program</label>
          <input
            id="program"
            name="program"
            value={form.program}
            onChange={updateField('program')}
            required
            disabled={isSubmitting}
            placeholder="e.g. BSc Computer Science"
          />
        </div>

        <div>
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit application'}
          </button>
        </div>
      </form>

      {feedbackMessage ? (
        <p
          className={feedbackState === 'success' ? 'status-message success-message' : 'status-message error-message'}
          role="status"
        >
          {feedbackMessage}
        </p>
      ) : null}
    </section>
  )
}
