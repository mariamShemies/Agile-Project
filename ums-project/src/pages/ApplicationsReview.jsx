import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

function formatDate(value) {
  if (!value) return '—'
  const d = typeof value === 'string' ? value.slice(0, 10) : value
  return d
}

function formatDateTime(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return String(value)
  }
}

export default function ApplicationsReview() {
  const { role } = useAuth()
  const [pendingApplications, setPendingApplications] = useState([])
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [activeActionId, setActiveActionId] = useState(null)
  const [feedbackState, setFeedbackState] = useState('idle')
  const [feedbackMessage, setFeedbackMessage] = useState('')

  const fetchPendingApplications = useCallback(async () => {
    setIsLoadingList(true)
    setFeedbackState('idle')
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('id, full_name, national_id, date_of_birth, email, phone, program, status, created_at')
        .eq('status', 'Pending')
        .order('created_at', { ascending: true })

      if (error) {
        throw error
      }

      setPendingApplications(data ?? [])
    } catch (error) {
      console.error('Failed to fetch pending applications', error)
      setFeedbackState('error')
      setFeedbackMessage(error.message || 'Failed to load pending applications.')
    } finally {
      setIsLoadingList(false)
    }
  }, [])

  useEffect(() => {
    if (role === 'staff') {
      fetchPendingApplications()
    }
  }, [role, fetchPendingApplications])

  const removeFromPendingList = (applicationId) => {
    setPendingApplications((current) => current.filter((a) => a.id !== applicationId))
  }

  const handleApprove = async (application) => {
    setFeedbackMessage('')
    setActiveActionId(application.id)

    const generatedStudentId = crypto.randomUUID()
    const studentPayload = {
      student_id: generatedStudentId,
      full_name: application.full_name,
      national_id: application.national_id,
      email: application.email,
      program: application.program,
    }

    try {
      const { error: studentInsertError } = await supabase.from('students').insert([studentPayload])

      if (studentInsertError) {
        throw studentInsertError
      }

      const { error: updateError } = await supabase
        .from('applications')
        .update({ status: 'Approved' })
        .eq('id', application.id)

      if (updateError) {
        throw updateError
      }

      removeFromPendingList(application.id)
      setFeedbackState('success')
      setFeedbackMessage('Application approved successfully. Student record created.')
    } catch (error) {
      console.error('Failed to approve application', error)
      setFeedbackState('error')
      setFeedbackMessage(error.message || 'Failed to approve application.')
    } finally {
      setActiveActionId(null)
    }
  }

  const handleReject = async (application) => {
    const confirmed = window.confirm('Reject this application?')
    if (!confirmed) {
      return
    }

    setFeedbackMessage('')
    setActiveActionId(application.id)

    try {
      const { error } = await supabase.from('applications').update({ status: 'Rejected' }).eq('id', application.id)

      if (error) {
        throw error
      }

      removeFromPendingList(application.id)
      setFeedbackState('success')
      setFeedbackMessage('Application rejected successfully.')
    } catch (error) {
      console.error('Failed to reject application', error)
      setFeedbackState('error')
      setFeedbackMessage(error.message || 'Failed to reject application.')
    } finally {
      setActiveActionId(null)
    }
  }

  if (role !== 'staff') {
    return (
      <section className="page-card">
        <h2>Access denied</h2>
        <p>Application review is for registrar staff only.</p>
      </section>
    )
  }

  return (
    <section className="page-card">
      <p className="eyebrow">Registrar</p>
      <h2>Review applications</h2>
      <p>Only applications with status Pending are shown. Approve to create a student record, or reject to mark as rejected.</p>

      {isLoadingList ? <p className="status-message">Loading pending applications...</p> : null}

      {!isLoadingList && pendingApplications.length === 0 ? (
        <p className="status-message">No pending applications found.</p>
      ) : null}

      {!isLoadingList && pendingApplications.length > 0 ? (
        <div className="table-scroll">
          <table className="review-table">
            <caption className="sr-only">Pending applications with approve and reject actions</caption>
            <thead>
              <tr>
                <th scope="col">Full name</th>
                <th scope="col">National ID</th>
                <th scope="col">Date of birth</th>
                <th scope="col">Email</th>
                <th scope="col">Phone</th>
                <th scope="col">Program</th>
                <th scope="col">Submitted</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingApplications.map((application) => {
                const isProcessing = activeActionId === application.id

                return (
                  <tr key={application.id}>
                    <td>{application.full_name}</td>
                    <td>{application.national_id}</td>
                    <td>{formatDate(application.date_of_birth)}</td>
                    <td>{application.email}</td>
                    <td>{application.phone}</td>
                    <td>{application.program}</td>
                    <td>{formatDateTime(application.created_at)}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="primary-button table-action-btn"
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleApprove(application)}
                        >
                          {isProcessing ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          className="danger-button table-action-btn"
                          type="button"
                          disabled={isProcessing}
                          onClick={() => void handleReject(application)}
                        >
                          {isProcessing ? 'Processing...' : 'Reject'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

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
