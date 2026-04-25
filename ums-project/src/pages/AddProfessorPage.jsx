import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  generateNextEmployeeId,
  insertProfessor,
  validateAddProfessorForm,
} from '../lib/staffDirectory'

const initialForm = {
  full_name: '',
  employee_id: '',
  department: '',
  email: '',
  office_location: '',
}

/**
 * HR: add a professor to the staff directory (Supabase `staff` table, role = Professor).
 * @param {{ onAdded?: () => void | Promise<void> }} props
 */
export default function AddProfessorPage({ onAdded }) {
  const { role } = useAuth()
  const [form, setForm] = useState(() => ({ ...initialForm }))
  const [useAutoEmployeeId, setUseAutoEmployeeId] = useState(true)
  const [suggestedEmployeeId, setSuggestedEmployeeId] = useState('')
  const [isResolvingId, setIsResolvingId] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const refreshSuggestedId = useCallback(async () => {
    setIsResolvingId(true)
    setErrorMessage('')
    try {
      const next = await generateNextEmployeeId()
      setSuggestedEmployeeId(next)
    } catch (e) {
      console.error('generateNextEmployeeId', e)
      setSuggestedEmployeeId('')
      setErrorMessage(e.message || 'Could not generate an employee ID. Check the staff table in Supabase.')
    } finally {
      setIsResolvingId(false)
    }
  }, [])

  useEffect(() => {
    if (useAutoEmployeeId && role === 'staff') {
      void refreshSuggestedId()
    }
  }, [useAutoEmployeeId, role, refreshSuggestedId])

  const updateField = (field) => (event) => {
    const { value } = event.target
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const runSubmit = async () => {
    let employee_id = form.employee_id.trim()
    if (useAutoEmployeeId) {
      employee_id = await generateNextEmployeeId()
    }

    const validation = validateAddProfessorForm({ ...form, employee_id })
    if (!validation.ok) {
      setErrorMessage(validation.message)
      return
    }

    const result = await insertProfessor(validation.values)
    if (!result.ok) {
      if (result.code === 'duplicate' && useAutoEmployeeId) {
        await refreshSuggestedId()
      }
      setErrorMessage(result.message)
      return
    }

    setForm({ ...initialForm })
    setErrorMessage('')
    setSuccessMessage('Professor added to the staff directory.')
    window.setTimeout(() => setSuccessMessage(''), 5000)
    if (useAutoEmployeeId) {
      void refreshSuggestedId()
    }
    if (onAdded) {
      await onAdded()
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (role !== 'staff') {
      return
    }

    const preCheck = validateAddProfessorForm(form, { skipEmployeeId: useAutoEmployeeId })
    if (!preCheck.ok) {
      setErrorMessage(preCheck.message)
      return
    }

    setIsSubmitting(true)
    try {
      await runSubmit()
    } catch (e) {
      console.error('Add professor failed', e)
      setErrorMessage(e.message || 'Something went wrong.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (role !== 'staff') {
    return null
  }

  return (
    <div className="add-professor-block">
      <p className="eyebrow">HR</p>
      <h3 className="add-professor-title">Add professor to directory</h3>
      <p className="room-availability-intro">
        New records are stored with <strong>role: Professor</strong>. Employee ID must be unique. You can use an
        auto-generated code (e.g. EMP-001) or enter your own.
      </p>

      <form className="application-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="form-field form-field-row">
          <label className="form-field-checkbox">
            <input
              type="checkbox"
              checked={useAutoEmployeeId}
              onChange={(e) => {
                setUseAutoEmployeeId(e.target.checked)
                setErrorMessage('')
              }}
              disabled={isSubmitting}
            />
            <span>Use auto-generated employee ID</span>
          </label>
        </div>

        <div className="form-field">
          <label htmlFor="employee_id">Employee ID</label>
          {useAutoEmployeeId ? (
            <div className="employee-id-preview">
              <input
                id="employee_id"
                name="employee_id"
                value={isResolvingId ? 'Resolving…' : suggestedEmployeeId}
                readOnly
                className="employee-id-readonly"
                aria-describedby="employee_id-hint"
                disabled
              />
              <button
                type="button"
                className="logout-button"
                onClick={() => void refreshSuggestedId()}
                disabled={isSubmitting || isResolvingId}
              >
                Regenerate
              </button>
            </div>
          ) : (
            <input
              id="employee_id"
              name="employee_id"
              value={form.employee_id}
              onChange={updateField('employee_id')}
              autoComplete="off"
              placeholder="e.g. EMP-042 or your org code"
              disabled={isSubmitting}
            />
          )}
          <p id="employee_id-hint" className="field-hint">
            {useAutoEmployeeId
              ? 'A new ID is chosen on submit (latest sequence). Regenerate to preview the next value.'
              : 'Must be unique; duplicates are rejected.'}
          </p>
        </div>

        <div className="form-field">
          <label htmlFor="prof_full_name">Full name</label>
          <input
            id="prof_full_name"
            name="full_name"
            value={form.full_name}
            onChange={updateField('full_name')}
            autoComplete="name"
            aria-required="true"
            disabled={isSubmitting}
          />
        </div>
        <div className="form-field">
          <label htmlFor="prof_department">Department</label>
          <input
            id="prof_department"
            name="department"
            value={form.department}
            onChange={updateField('department')}
            disabled={isSubmitting}
          />
        </div>
        <div className="form-field">
          <label htmlFor="prof_email">Email</label>
          <input
            id="prof_email"
            name="email"
            type="email"
            value={form.email}
            onChange={updateField('email')}
            autoComplete="email"
            disabled={isSubmitting}
          />
        </div>
        <div className="form-field">
          <label htmlFor="prof_office">Office location</label>
          <input
            id="prof_office"
            name="office_location"
            value={form.office_location}
            onChange={updateField('office_location')}
            placeholder="e.g. Science Bldg, Room 201"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Add professor'}
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
