import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Applications() {
  const { role } = useAuth()
  const [pendingApplications, setPendingApplications] = useState([])
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [activeActionId, setActiveActionId] = useState(null)
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [feedbackState, setFeedbackState] = useState('idle')
  const [feedbackMessage, setFeedbackMessage] = useState('')

  const fetchPendingApplications = async () => {
    setIsLoadingList(true)
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
  }

  useEffect(() => {
    if (role === 'staff') {
      fetchPendingApplications()
    }
  }, [role])

  const removeFromPendingList = (applicationId) => {
    setPendingApplications((currentApplications) =>
      currentApplications.filter((application) => application.id !== applicationId)
    )
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
        .update({ status: 'Approved', rejection_reason: null })
        .eq('id', application.id)

      if (updateError) {
        throw updateError
      }

      removeFromPendingList(application.id)
      setFeedbackState('success')
      setFeedbackMessage(`Application approved. Student created with ID ${generatedStudentId}.`)
    } catch (error) {
      console.error('Failed to approve application', error)
      setFeedbackState('error')
      setFeedbackMessage(error.message || 'Failed to approve application.')
    } finally {
      setActiveActionId(null)
      setRejectingId(null)
      setRejectReason('')
    }
  }

  const handleReject = async (application) => {
    const trimmedReason = rejectReason.trim()
    if (!trimmedReason) {
      setFeedbackState('error')
      setFeedbackMessage('Rejection reason is required.')
      return
    }

    setFeedbackMessage('')
    setActiveActionId(application.id)

    try {
      const { error } = await supabase
        .from('applications')
        .update({ status: 'Rejected', rejection_reason: trimmedReason })
        .eq('id', application.id)

      if (error) {
        throw error
      }

      removeFromPendingList(application.id)
      setFeedbackState('success')
      setFeedbackMessage('Application rejected successfully.')
      setRejectingId(null)
      setRejectReason('')
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
        <p>Applications are visible to staff members only.</p>
      </section>
    )
  }

  return (
    <section className="page-card">
      <p className="eyebrow">Registrar</p>
      <h2>Pending Applications Review</h2>
      <p>Approve qualified applications or reject with a reason.</p>

      {isLoadingList ? <p className="status-message">Loading pending applications...</p> : null}

      {!isLoadingList && pendingApplications.length === 0 ? (
        <p className="status-message">No pending applications found.</p>
      ) : null}

      <div className="review-grid">
        {pendingApplications.map((application) => {
          const isProcessing = activeActionId === application.id
          const isRejectingThisCard = rejectingId === application.id

          return (
            <article key={application.id} className="review-card">
              <h3>{application.full_name}</h3>
              <p>
                <strong>National ID:</strong> {application.national_id}
              </p>
              <p>
                <strong>Date of birth:</strong> {application.date_of_birth}
              </p>
              <p>
                <strong>Email:</strong> {application.email}
              </p>
              <p>
                <strong>Phone:</strong> {application.phone}
              </p>
              <p>
                <strong>Program:</strong> {application.program}
              </p>
              <p>
                <strong>Status:</strong> {application.status}
              </p>

              <div className="review-actions">
                <button
                  className="primary-button"
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleApprove(application)}
                >
                  {isProcessing ? 'Processing...' : 'Approve'}
                </button>

                <button
                  className="danger-button"
                  type="button"
                  disabled={isProcessing}
                  onClick={() => {
                    if (isRejectingThisCard) {
                      setRejectingId(null)
                      setRejectReason('')
                    } else {
                      setRejectingId(application.id)
                      setRejectReason('')
                    }
                  }}
                >
                  Reject
                </button>
              </div>

              {isRejectingThisCard ? (
                <div className="reject-panel">
                  <label htmlFor={`reject-reason-${application.id}`}>Rejection reason</label>
                  <textarea
                    id={`reject-reason-${application.id}`}
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder="Enter reason for rejection"
                    rows={3}
                  />
                  <button
                    className="danger-button"
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleReject(application)}
                  >
                    {isProcessing ? 'Processing...' : 'Confirm rejection'}
                  </button>
                </div>
              ) : null}
            </article>
          )
        })}
      </div>

      {feedbackMessage ? (
        <p className={feedbackState === 'success' ? 'status-message success-message' : 'status-message error-message'}>
          {feedbackMessage}
        </p>
      ) : null}
    </section>
  )
}
