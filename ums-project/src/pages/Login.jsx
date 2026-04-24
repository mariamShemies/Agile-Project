import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { session, role, login, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  if (session && role) {
    return <Navigate to={role === 'staff' ? '/staff-dashboard' : '/student-dashboard'} replace />
  }

  const formatAuthError = (error) => {
    if (!error) {
      return 'Authentication failed. Please try again.'
    }

    const normalizedMessage = String(error.message || '').toLowerCase()
    const normalizedCode = String(error.code || '').toLowerCase()

    if (
      normalizedMessage.includes('invalid login credentials') ||
      normalizedMessage.includes('invalid email or password') ||
      normalizedCode === 'invalid_credentials'
    ) {
      return 'Invalid email or password. Please try again.'
    }

    const status = error.status ? ` (${error.status})` : ''
    const code = error.code ? ` [${error.code}]` : ''

    if (error.message) {
      return `${error.message}${status}${code}`
    }

    return `Authentication failed${status}${code}`
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')

    try {
      await login(email, password)
    } catch (error) {
      setErrorMessage(formatAuthError(error))
    }
  }

  return (
    <div className="auth-shell">
      <section className="page-card auth-card">
        <p className="eyebrow">UMS Access</p>
        <h1>Sign in</h1>
        <p>Use your university account to access the portal.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />

          {errorMessage ? <p className="error-message">{errorMessage}</p> : null}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Please wait...' : 'Sign in'}
          </button>
        </form>
      </section>
    </div>
  )
}
