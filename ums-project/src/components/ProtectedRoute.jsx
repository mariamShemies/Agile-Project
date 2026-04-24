import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ allowedRoles }) {
  const { session, role, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <section className="page-card">
        <h2>Loading account...</h2>
        <p>Please wait while we check your session and role.</p>
      </section>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!role) {
    return (
      <section className="page-card">
        <h2>Access unavailable</h2>
        <p>Your account is authenticated but no matching role exists in staff or students.</p>
      </section>
    )
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    const homePath = role === 'staff' ? '/staff-dashboard' : '/student-dashboard'
    return <Navigate to={homePath} replace />
  }

  return <Outlet />
}
