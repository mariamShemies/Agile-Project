import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import Applications from './pages/Applications.jsx'
import Login from './pages/Login.jsx'
import Rooms from './pages/Rooms.jsx'
import Staff from './pages/Staff.jsx'
import Subjects from './pages/Subjects.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { useAuth } from './context/AuthContext.jsx'

function StaffDashboard() {
  return (
    <section className="page-card">
      <p className="eyebrow">University Management System</p>
      <h1>Staff Dashboard</h1>
      <p>
        Manage applications, rooms, staff records, and subjects from one place.
      </p>
    </section>
  )
}

function StudentDashboard() {
  return (
    <section className="page-card">
      <p className="eyebrow">University Management System</p>
      <h1>Student Dashboard</h1>
      <p>Submit applications and browse available subjects from your portal.</p>
    </section>
  )
}

function AppLayout() {
  const { role, logout } = useAuth()

  const navItems =
    role === 'staff'
      ? [
          { to: '/staff-dashboard', label: 'Dashboard' },
          { to: '/applications', label: 'Applications' },
          { to: '/rooms', label: 'Rooms' },
          { to: '/staff', label: 'Staff' },
          { to: '/subjects', label: 'Subjects' },
        ]
      : [
          { to: '/student-dashboard', label: 'Dashboard' },
          { to: '/applications', label: 'Applications' },
          { to: '/subjects', label: 'Subjects' },
        ]

  const navLinkClass = ({ isActive }) =>
    `nav-link${isActive ? ' nav-link-active' : ''}`

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="brand-kicker">UMS</p>
          <h2 className="brand-title">University Management System</h2>
        </div>

        <div className="nav-actions">
          <nav className="nav-bar" aria-label="Primary navigation">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to.includes('dashboard')} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button className="logout-button" type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <main className="content-area">
        <Routes>
          <Route path="/staff-dashboard" element={<StaffDashboard />} />
          <Route path="/student-dashboard" element={<StudentDashboard />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/subjects" element={<Subjects />} />
          {role === 'staff' ? <Route path="/rooms" element={<Rooms />} /> : null}
          {role === 'staff' ? <Route path="/staff" element={<Staff />} /> : null}
          <Route
            path="*"
            element={
              <Navigate
                to={role === 'staff' ? '/staff-dashboard' : '/student-dashboard'}
                replace
              />
            }
          />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  const { session, role } = useAuth()

  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/*" element={<AppLayout />} />
        </Route>

        <Route
          path="*"
          element={
            <Navigate
              to={session ? (role === 'staff' ? '/staff-dashboard' : '/student-dashboard') : '/login'}
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
