import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

type SubjectTypeOption = 'Core' | 'Elective'

/** Form field values; credit_hours kept as string for controlled <input type="number">. */
type CreateSubjectFormState = {
  subject_code: string
  subject_name: string
  credit_hours: string
  type: SubjectTypeOption
  department: string
}

const initialForm: CreateSubjectFormState = {
  subject_code: '',
  subject_name: '',
  credit_hours: '',
  type: 'Core',
  department: '',
}

type SubjectRow = {
  id: string | number
  subject_code?: string
  subject_name?: string
  credit_hours?: number
  type?: string
  department?: string
  status?: string
  // legacy columns (older seeds)
  name?: string
  code?: string
  active?: boolean
}

function isUniqueViolation(err: { code?: string; message?: string } | null) {
  if (!err) return false
  if (err.code === '23505') return true
  return /duplicate key|unique constraint|already exists/i.test(String(err.message ?? ''))
}

export default function Subjects() {
  const { role } = useAuth()
  const [form, setForm] = useState<CreateSubjectFormState>(initialForm)
  const [list, setList] = useState<SubjectRow[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const fetchSubjects = async () => {
    const { data, error } = await supabase.from('subjects').select('*').order('id', { ascending: false })

    if (error) {
      setErrorMessage('Failed to load subjects.')
      return
    }
    setList((data ?? []) as SubjectRow[])
  }

  useEffect(() => {
    void fetchSubjects()
  }, [])

  const updateField = <K extends keyof CreateSubjectFormState>(key: K) => {
    return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value } as CreateSubjectFormState))
    }
  }

  const handleCreateSubject = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    const subject_code = form.subject_code.trim()
    const subject_name = form.subject_name.trim()
    const department = form.department.trim()
    const credit = Number.parseFloat(form.credit_hours)

    if (!subject_code) {
      setErrorMessage('Subject code is required.')
      return
    }
    if (!subject_name) {
      setErrorMessage('Subject name is required.')
      return
    }
    if (form.credit_hours.trim() === '' || Number.isNaN(credit) || credit <= 0) {
      setErrorMessage('Enter a valid credit hours value (a number greater than 0).')
      return
    }
    if (!department) {
      setErrorMessage('Department is required.')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('subjects').insert([
        {
          subject_code,
          subject_name,
          credit_hours: credit,
          type: form.type,
          department,
          status: 'Active',
        },
      ])

      if (error) {
        if (isUniqueViolation(error)) {
          setErrorMessage('A subject with this subject code already exists. Use a different code.')
        } else {
          setErrorMessage(error.message || 'Failed to create subject. Please try again.')
        }
        return
      }

      window.alert('Subject created successfully.')
      setForm(initialForm)
      await fetchSubjects()
    } finally {
      setIsSubmitting(false)
    }
  }

  const displayCode = (s: SubjectRow) => s.subject_code ?? s.code ?? '—'
  const displayName = (s: SubjectRow) => s.subject_name ?? s.name ?? '—'
  const displayStatus = (s: SubjectRow) => s.status ?? (s.active === true ? 'Active' : s.active === false ? 'Inactive' : '—')

  return (
    <section className="page-card">
      <h2>{role === 'staff' ? 'Subject management' : 'Subjects'}</h2>

      {role === 'staff' ? (
        <>
          <p className="eyebrow">Create subject</p>
          <h3 className="section-heading-sub">Add a new course</h3>
          <form className="application-form" onSubmit={handleCreateSubject}>
            <div className="form-field">
              <label htmlFor="subject_code">Subject code</label>
              <input
                id="subject_code"
                name="subject_code"
                value={form.subject_code}
                onChange={updateField('subject_code')}
                required
                disabled={isSubmitting}
                autoComplete="off"
              />
            </div>
            <div className="form-field">
              <label htmlFor="subject_name">Subject name</label>
              <input
                id="subject_name"
                name="subject_name"
                value={form.subject_name}
                onChange={updateField('subject_name')}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="form-field">
              <label htmlFor="credit_hours">Credit hours</label>
              <input
                id="credit_hours"
                name="credit_hours"
                type="number"
                min={0.5}
                step="any"
                value={form.credit_hours}
                onChange={updateField('credit_hours')}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="form-field">
              <label htmlFor="type">Type</label>
              <select
                id="type"
                name="type"
                value={form.type}
                onChange={updateField('type')}
                required
                disabled={isSubmitting}
                className="form-select"
              >
                <option value="Core">Core</option>
                <option value="Elective">Elective</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="department">Department</label>
              <input
                id="department"
                name="department"
                value={form.department}
                onChange={updateField('department')}
                required
                disabled={isSubmitting}
              />
            </div>
            <div>
              <button className="primary-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting…' : 'Create subject'}
              </button>
            </div>
          </form>
        </>
      ) : (
        <p>View-only access. Browse available subjects below.</p>
      )}

      {errorMessage ? (
        <p className="status-message error-message" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {list.length > 0 ? <h3 className="section-heading-sub">All subjects</h3> : null}
      {list.map((subject) => (
        <div key={subject.id} className="list-row">
          <span className="list-row-title">{displayName(subject)}</span>
          <span className="list-row-meta">
            {displayCode(subject)} · {subject.credit_hours != null ? `${subject.credit_hours} cr` : '—'}
            {subject.type ? ` · ${subject.type}` : ''} · {subject.department ?? '—'} · {displayStatus(subject)}
          </span>
        </div>
      ))}
    </section>
  )
}
