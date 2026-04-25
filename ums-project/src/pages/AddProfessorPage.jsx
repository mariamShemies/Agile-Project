import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  fetchProfessorSupervisors,
  generateNextEmployeeId,
  insertStaffMember,
  STAFF_ROLE_PROFESSOR,
  STAFF_ROLE_TA,
  validateAddStaffForm,
} from '../lib/staffDirectory'

const initialForm = {
  role: STAFF_ROLE_PROFESSOR,
  full_name: '',
  employee_id: '',
  department: '',
  email: '',
  office_location: '',
  supervisor_id: '',
}

/**
 * HR: add staff members (Professor or TA) to the directory.
 * @param {{ onAdded?: () => void | Promise<void> }} props
 */
export default function AddProfessorPage({ onAdded }) {
  const { role } = useAuth()
  const [form, setForm] = useState(() => ({ ...initialForm }))
  const [professors, setProfessors] = useState([])
  const [isLoadingProfessors, setIsLoadingProfessors] = useState(false)
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

  const refreshProfessorSupervisors = useCallback(async () => {
    setIsLoadingProfessors(true)
    setErrorMessage('')
    try {
      const rows = await fetchProfessorSupervisors()
      setProfessors(rows)
    } catch (e) {
      console.error('fetchProfessorSupervisors', e)
      setProfessors([])
      setErrorMessage(e.message || 'Could not load professor supervisors.')
    } finally {
      setIsLoadingProfessors(false)
    }
  }, [])

  useEffect(() => {
    if (useAutoEmployeeId && role === 'staff') {
      void refreshSuggestedId()
    }
  }, [useAutoEmployeeId, role, refreshSuggestedId])

  useEffect(() => {
    if (role === 'staff') {
      void refreshProfessorSupervisors()
    }
  }, [refreshProfessorSupervisors, role])

  const updateField = (field) => (event) => {
    const { value } = event.target
    setForm((prev) => {
      if (field === 'role') {
        return {
          ...prev,
          role: value,
          supervisor_id: value === STAFF_ROLE_TA ? prev.supervisor_id : '',
        }
      }
      return { ...prev, [field]: value }
    })
  }

  const runSubmit = async () => {
    let employee_id = form.employee_id.trim()
    if (useAutoEmployeeId) {
      employee_id = await generateNextEmployeeId()
    }

    const validation = validateAddStaffForm({ ...form, employee_id })
    if (!validation.ok) {
      setErrorMessage(validation.message)
      return
    }

    const result = await insertStaffMember(validation.values)
    if (!result.ok) {
      if (result.code === 'duplicate' && useAutoEmployeeId) {
        await refreshSuggestedId()
      }
      setErrorMessage(result.message)
      return
    }

    setForm({ ...initialForm })
    setErrorMessage('')
    setSuccessMessage(
      validation.values.role === STAFF_ROLE_TA
        ? 'Teaching Assistant added to the staff directory.'
        : 'Professor added to the staff directory.'
    )
    window.setTimeout(() => setSuccessMessage(''), 5000)
    if (useAutoEmployeeId) {
      void refreshSuggestedId()
    }
    void refreshProfessorSupervisors()
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

    const preCheck = validateAddStaffForm(form, { skipEmployeeId: useAutoEmployeeId })
    if (!preCheck.ok) {
      setErrorMessage(preCheck.message)
      return
    }

    setIsSubmitting(true)
    try {
      await runSubmit()
    } catch (e) {
      console.error('Add staff member failed', e)
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
      <h3 className="add-professor-title">Add staff to directory</h3>
      <p className="room-availability-intro">
        Use one form to add <strong>Professors</strong> and <strong>Teaching Assistants (TAs)</strong>. TAs must be
        assigned to a supervisor professor.
      </p>

      <form className="application-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="form-field">
          <label htmlFor="staff_role">Role</label>
          <select
            id="staff_role"
            name="role"
            className="form-select"
            value={form.role}
            onChange={updateField('role')}
            disabled={isSubmitting}
          >
            <option value={STAFF_ROLE_PROFESSOR}>Professor</option>
            <option value={STAFF_ROLE_TA}>TA</option>
          </select>
        </div>

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

        {form.role === STAFF_ROLE_TA ? (
          <div className="form-field">
            <label htmlFor="supervisor_id">Supervisor Professor</label>
            <select
              id="supervisor_id"
              name="supervisor_id"
              className="form-select"
              value={form.supervisor_id}
              onChange={updateField('supervisor_id')}
              disabled={isSubmitting || isLoadingProfessors}
              aria-required="true"
            >
              <option value="">Select a professor</option>
              {professors.map((prof) => (
                <option key={String(prof.id)} value={String(prof.id)}>
                  {String(prof.full_name ?? prof.name ?? 'Unnamed professor')}
                  {prof.employee_id ? ` (${String(prof.employee_id)})` : ''}
                </option>
              ))}
            </select>
            <p className="field-hint">
              {isLoadingProfessors
                ? 'Loading professors…'
                : professors.length === 0
                  ? 'No professors found. Add at least one professor before creating a TA.'
                  : 'Required for TA records.'}
            </p>
          </div>
        ) : null}

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
            placeholder="Optional"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Add staff member'}
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
