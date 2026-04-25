import { useState } from 'react'
import {
  insertSubject,
  SUBJECT_TYPE_CORE,
  SUBJECT_TYPE_ELECTIVE,
  validateCreateSubjectForm,
} from '../lib/subjectCatalog'

const initialForm = {
  subject_code: '',
  subject_name: '',
  credit_hours: '',
  type: SUBJECT_TYPE_CORE,
  department: '',
}

/**
 * Course catalog: create a subject (Academic Administrator / staff in this UMS build).
 * Form UI + submit wiring; validation and Supabase live in `lib/subjectCatalog.js`.
 * @param {{ onCreated?: () => void | Promise<void> }} props
 */
export default function CreateSubjectPage({ onCreated }) {
  const [form, setForm] = useState(() => ({ ...initialForm }))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const updateField = (field) => (event) => {
    const { value } = event.target
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const runSubmit = async (normalized) => {
    const result = await insertSubject(normalized)
    if (!result.ok) {
      setErrorMessage(result.message)
      return
    }
    setForm({ ...initialForm, type: SUBJECT_TYPE_CORE })
    setSuccessMessage('Subject was created and added to the catalog (status: Active).')
    window.setTimeout(() => setSuccessMessage(''), 6000)
    if (onCreated) {
      await onCreated()
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    const check = validateCreateSubjectForm(form)
    if (!check.ok) {
      setErrorMessage(check.message)
      window.alert(check.message)
      return
    }

    setIsSubmitting(true)
    try {
      await runSubmit(check.values)
    } catch (e) {
      console.error('Create subject failed', e)
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-card create-subject-block">
      <p className="eyebrow">Academic</p>
      <h3 className="create-subject-title">Add a new subject</h3>
      <p className="room-availability-intro">
        Create an official course record. <strong>Subject code</strong> must be unique. New subjects are saved with status
        <strong> Active</strong>.
      </p>

      <form className="application-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="form-field">
          <label htmlFor="subject_code">Subject code</label>
          <input
            id="subject_code"
            name="subject_code"
            value={form.subject_code}
            onChange={updateField('subject_code')}
            autoComplete="off"
            placeholder="e.g. CS201"
            disabled={isSubmitting}
          />
        </div>
        <div className="form-field">
          <label htmlFor="subject_name">Subject name</label>
          <input
            id="subject_name"
            name="subject_name"
            value={form.subject_name}
            onChange={updateField('subject_name')}
            autoComplete="off"
            placeholder="e.g. Data Structures"
            disabled={isSubmitting}
          />
        </div>
        <div className="form-field">
          <label htmlFor="credit_hours">Credit hours</label>
          <input
            id="credit_hours"
            name="credit_hours"
            type="number"
            min={1}
            step={1}
            value={form.credit_hours}
            onChange={updateField('credit_hours')}
            disabled={isSubmitting}
          />
        </div>
        <div className="form-field">
          <label htmlFor="subject_type">Type</label>
          <select
            id="subject_type"
            name="type"
            className="form-select"
            value={form.type}
            onChange={updateField('type')}
            disabled={isSubmitting}
          >
            <option value={SUBJECT_TYPE_CORE}>Core</option>
            <option value={SUBJECT_TYPE_ELECTIVE}>Elective</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="department">Department</label>
          <input
            id="department"
            name="department"
            value={form.department}
            onChange={updateField('department')}
            autoComplete="organization"
            placeholder="e.g. Computer Science"
            disabled={isSubmitting}
          />
        </div>
        <div>
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Add subject to catalog'}
          </button>
        </div>
      </form>

      {errorMessage ? (
        <p className="status-message error-message" role="status">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="status-message success-message" role="status">
          {successMessage}
        </p>
      ) : null}
    </div>
  )
}
