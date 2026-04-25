import { useState } from 'react'
import { validateApplicationForm } from '../lib/applicationValidation'
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
  const [fieldErrors, setFieldErrors] = useState({})

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
    setFieldErrors((prev) => {
      if (!prev[field]) {
        return prev
      }
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFeedbackState('idle')
    setFeedbackMessage('')
    setFieldErrors({})

    const validation = validateApplicationForm(form)
    if (!validation.ok) {
      setFeedbackState('error')
      setFeedbackMessage(validation.message)
      setFieldErrors(validation.fieldErrors)
      return
    }
    const v = validation.values

    const applicationId = crypto.randomUUID()
    const nowIso = new Date().toISOString()

    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('applications').insert([
        {
          id: applicationId,
          full_name: v.full_name,
          national_id: v.national_id,
          date_of_birth: v.date_of_birth,
          email: v.email,
          phone: v.phone,
          program: v.program,
          status: 'Pending',
          created_at: nowIso,
        },
      ])

      if (error) {
        throw error
      }

      setForm(initialForm)
      setFieldErrors({})
      setFeedbackState('success')
      setFeedbackMessage('Application submitted successfully and is pending review')
    } catch (error) {
      console.error('Failed to submit application', error)
      setFieldErrors({})
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

      <form className="application-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="full_name">Full name</label>
          <input
            id="full_name"
            name="full_name"
            value={form.full_name}
            onChange={updateField('full_name')}
            autoComplete="name"
            aria-required="true"
            aria-invalid={fieldErrors.full_name ? 'true' : 'false'}
            aria-describedby={fieldErrors.full_name ? 'full_name-error' : undefined}
            disabled={isSubmitting}
          />
          {fieldErrors.full_name ? (
            <p className="field-error" id="full_name-error" role="alert">
              {fieldErrors.full_name}
            </p>
          ) : null}
        </div>

        <div className="form-field">
          <label htmlFor="national_id">National ID</label>
          <input
            id="national_id"
            name="national_id"
            value={form.national_id}
            onChange={updateField('national_id')}
            aria-required="true"
            aria-invalid={fieldErrors.national_id ? 'true' : 'false'}
            aria-describedby={fieldErrors.national_id ? 'national_id-error' : undefined}
            disabled={isSubmitting}
          />
          {fieldErrors.national_id ? (
            <p className="field-error" id="national_id-error" role="alert">
              {fieldErrors.national_id}
            </p>
          ) : null}
        </div>

        <div className="form-field">
          <label htmlFor="date_of_birth">Date of birth</label>
          <input
            id="date_of_birth"
            name="date_of_birth"
            type="date"
            value={form.date_of_birth}
            onChange={updateField('date_of_birth')}
            aria-required="true"
            aria-invalid={fieldErrors.date_of_birth ? 'true' : 'false'}
            aria-describedby={fieldErrors.date_of_birth ? 'date_of_birth-error' : undefined}
            disabled={isSubmitting}
          />
          {fieldErrors.date_of_birth ? (
            <p className="field-error" id="date_of_birth-error" role="alert">
              {fieldErrors.date_of_birth}
            </p>
          ) : null}
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
            aria-required="true"
            aria-invalid={fieldErrors.email ? 'true' : 'false'}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            disabled={isSubmitting}
          />
          {fieldErrors.email ? <p className="field-error" id="email-error" role="alert">{fieldErrors.email}</p> : null}
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
            aria-required="true"
            aria-invalid={fieldErrors.phone ? 'true' : 'false'}
            aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
            disabled={isSubmitting}
          />
          {fieldErrors.phone ? <p className="field-error" id="phone-error" role="alert">{fieldErrors.phone}</p> : null}
        </div>

        <div className="form-field">
          <label htmlFor="program">Program</label>
          <input
            id="program"
            name="program"
            value={form.program}
            onChange={updateField('program')}
            aria-required="true"
            aria-invalid={fieldErrors.program ? 'true' : 'false'}
            aria-describedby={fieldErrors.program ? 'program-error' : undefined}
            disabled={isSubmitting}
            placeholder="e.g. BSc Computer Science"
          />
          {fieldErrors.program ? <p className="field-error" id="program-error" role="alert">{fieldErrors.program}</p> : null}
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
