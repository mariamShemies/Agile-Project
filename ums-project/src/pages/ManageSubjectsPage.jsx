import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  deactivateSubject,
  fetchSubjects,
  SUBJECT_STATUS_ACTIVE,
  SUBJECT_STATUS_INACTIVE,
  SUBJECT_TYPE_CORE,
  SUBJECT_TYPE_ELECTIVE,
  updateSubject,
  validateEditSubjectForm,
} from '../lib/subjectCatalog'

function getCode(row) {
  return String(row.subject_code ?? row.code ?? '—')
}

function getName(row) {
  return String(row.subject_name ?? row.name ?? '—')
}

function getHours(row) {
  const h = row.credit_hours
  if (h != null && h !== '') {
    return h
  }
  return '—'
}

function isActiveForDeactivate(row) {
  const s = String(row.status ?? SUBJECT_STATUS_ACTIVE)
  return s === SUBJECT_STATUS_ACTIVE
}

const emptyEdit = () => ({
  subject_name: '',
  credit_hours: '',
  type: SUBJECT_TYPE_CORE,
  department: '',
})

/**
 * Academic administrator: search, edit (code read-only), deactivate (Inactive + confirm).
 */
export default function ManageSubjectsPage() {
  const { role } = useAuth()
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [feedback, setFeedback] = useState({ type: '', text: '' })
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState(() => emptyEdit())
  const [savingId, setSavingId] = useState(null)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [deactivating, setDeactivating] = useState(false)

  const load = useCallback(async () => {
    setLoadError('')
    setIsLoading(true)
    try {
      setRows(await fetchSubjects())
    } catch (e) {
      console.error('fetchSubjects', e)
      setLoadError(e.message || 'Could not load subjects.')
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) {
      return rows
    }
    return rows.filter((r) => {
      const code = getCode(r).toLowerCase()
      const name = getName(r).toLowerCase()
      return code.includes(q) || name.includes(q)
    })
  }, [rows, search])

  const startEdit = (row) => {
    setFeedback({ type: '', text: '' })
    setEditingId(String(row.id))
    setEditDraft({
      subject_name: getName(row) === '—' ? '' : getName(row),
      credit_hours: getHours(row) === '—' ? '' : String(getHours(row)),
      type: row.type === SUBJECT_TYPE_ELECTIVE ? SUBJECT_TYPE_ELECTIVE : SUBJECT_TYPE_CORE,
      department: String(row.department ?? ''),
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft(emptyEdit())
  }

  const saveEdit = async (row) => {
    setFeedback({ type: '', text: '' })
    const check = validateEditSubjectForm(editDraft)
    if (!check.ok) {
      setFeedback({ type: 'error', text: check.message })
      return
    }
    setSavingId(String(row.id))
    try {
      await updateSubject(String(row.id), check.values)
      setFeedback({ type: 'success', text: 'Subject updated.' })
      setEditingId(null)
      setEditDraft(emptyEdit())
      await load()
    } catch (e) {
      console.error('updateSubject', e)
      setFeedback({ type: 'error', text: e.message || 'Update failed.' })
    } finally {
      setSavingId(null)
    }
  }

  const confirmDeactivate = async () => {
    if (!deactivateTarget) {
      return
    }
    setDeactivating(true)
    setFeedback({ type: '', text: '' })
    try {
      await deactivateSubject(String(deactivateTarget.id))
      setFeedback({ type: 'success', text: 'Subject deactivated. It is hidden from the student course catalog.' })
      setDeactivateTarget(null)
      await load()
    } catch (e) {
      console.error('deactivateSubject', e)
      setFeedback({ type: 'error', text: e.message || 'Deactivation failed.' })
    } finally {
      setDeactivating(false)
    }
  }

  if (role !== 'staff') {
    return (
      <section className="page-card">
        <h2>Access denied</h2>
        <p>Only staff (Academic Administrator) can manage subjects.</p>
      </section>
    )
  }

  return (
    <section className="page-card manage-subjects-page">
      <p className="eyebrow">Academic</p>
      <h2>Manage subjects</h2>
      <p className="room-availability-intro">
        Search by code or name, edit offer details, or <strong>deactivate</strong> a subject (sets status to Inactive; students
        will no longer see it in the catalog). Subject code cannot be changed.
      </p>

      <div className="manage-subjects-toolbar">
        <div className="form-field">
          <label htmlFor="subject-search">Search</label>
          <input
            id="subject-search"
            type="search"
            placeholder="Filter by subject code or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="manage-subjects-search"
            autoComplete="off"
            disabled={isLoading}
          />
        </div>
        <button className="primary-button room-refresh-btn" type="button" onClick={() => void load()} disabled={isLoading}>
          {isLoading ? 'Loading…' : 'Refresh list'}
        </button>
      </div>

      {loadError ? (
        <p className="status-message error-message" role="status">
          {loadError}
        </p>
      ) : null}
      {feedback.text ? (
        <p
          className={feedback.type === 'success' ? 'status-message success-message' : 'status-message error-message'}
          role="status"
        >
          {feedback.text}
        </p>
      ) : null}

      {isLoading && !loadError ? <p className="status-message">Loading subjects…</p> : null}

      {!isLoading && !loadError && filtered.length === 0 ? (
        <p className="status-message">No subjects match this search, or the catalog is empty.</p>
      ) : null}

      {!isLoading && !loadError && filtered.length > 0 ? (
        <div className="table-scroll room-availability-scroll">
          <table className="review-table manage-subjects-table">
            <caption className="sr-only">Subjects: code, name, credits, type, department, status, actions</caption>
            <thead>
              <tr>
                <th scope="col">Subject code</th>
                <th scope="col">Subject name</th>
                <th scope="col">Credit hours</th>
                <th scope="col">Type</th>
                <th scope="col">Department</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const id = String(row.id)
                const isEdit = editingId === id
                return (
                  <tr key={id}>
                    <td>
                      <span className="subject-code-readonly" title="Subject code cannot be edited">
                        {getCode(row)}
                      </span>
                    </td>
                    {isEdit ? (
                      <>
                        <td>
                          <input
                            className="manage-subjects-input"
                            value={editDraft.subject_name}
                            onChange={(e) => setEditDraft((d) => ({ ...d, subject_name: e.target.value }))}
                            disabled={savingId === id}
                            aria-label="Subject name"
                          />
                        </td>
                        <td>
                          <input
                            className="manage-subjects-input"
                            type="number"
                            min={1}
                            step={1}
                            value={editDraft.credit_hours}
                            onChange={(e) => setEditDraft((d) => ({ ...d, credit_hours: e.target.value }))}
                            disabled={savingId === id}
                            aria-label="Credit hours"
                          />
                        </td>
                        <td>
                          <select
                            className="form-select manage-subjects-select"
                            value={editDraft.type}
                            onChange={(e) => setEditDraft((d) => ({ ...d, type: e.target.value }))}
                            disabled={savingId === id}
                            aria-label="Type"
                          >
                            <option value={SUBJECT_TYPE_CORE}>Core</option>
                            <option value={SUBJECT_TYPE_ELECTIVE}>Elective</option>
                          </select>
                        </td>
                        <td>
                          <input
                            className="manage-subjects-input"
                            value={editDraft.department}
                            onChange={(e) => setEditDraft((d) => ({ ...d, department: e.target.value }))}
                            disabled={savingId === id}
                            aria-label="Department"
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{getName(row)}</td>
                        <td>{getHours(row)}</td>
                        <td>{row.type ?? '—'}</td>
                        <td>{row.department ?? '—'}</td>
                      </>
                    )}
                    <td>
                      <span
                        className={
                          String(row.status ?? SUBJECT_STATUS_ACTIVE) === SUBJECT_STATUS_INACTIVE
                            ? 'room-status room-status-inactive'
                            : 'room-status room-status-free'
                        }
                        title="Student catalog shows Active only"
                      >
                        {row.status ?? SUBJECT_STATUS_ACTIVE}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        {isEdit ? (
                          <>
                            <button
                              className="primary-button table-action-btn"
                              type="button"
                              disabled={savingId === id}
                              onClick={() => void saveEdit(row)}
                            >
                              {savingId === id ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              className="logout-button table-action-btn"
                              type="button"
                              disabled={savingId === id}
                              onClick={cancelEdit}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="primary-button table-action-btn"
                              type="button"
                              onClick={() => startEdit(row)}
                              disabled={savingId !== null || deactivating}
                            >
                              Edit
                            </button>
                            {isActiveForDeactivate(row) ? (
                              <button
                                className="table-action-btn danger-text-btn"
                                type="button"
                                onClick={() => {
                                  setFeedback({ type: '', text: '' })
                                  setDeactivateTarget(row)
                                }}
                                disabled={deactivating}
                              >
                                Deactivate
                              </button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {deactivateTarget ? (
        <div className="modal-backdrop" role="presentation" onClick={() => (deactivating ? null : setDeactivateTarget(null))}>
          <div
            className="modal-panel page-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deactivate-subject-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="deactivate-subject-title">Confirm deactivation</h3>
            <p className="modal-subtitle">
              Are you sure you want to deactivate <strong>{getName(deactivateTarget)}</strong> (
              {getCode(deactivateTarget)})?
            </p>
            <p className="modal-subtitle">The subject will be set to <strong>Inactive</strong> and will no longer appear in the
              student course catalog. The record is not deleted.</p>
            <div className="modal-actions">
              <button
                className="logout-button modal-cancel"
                type="button"
                onClick={() => setDeactivateTarget(null)}
                disabled={deactivating}
              >
                Cancel
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => void confirmDeactivate()}
                disabled={deactivating}
              >
                {deactivating ? 'Updating…' : 'Yes, deactivate'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
