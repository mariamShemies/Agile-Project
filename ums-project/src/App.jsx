import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import Applications from './pages/Applications.jsx'
import ApplicationsReview from './pages/ApplicationsReview.jsx'
import Login from './pages/Login.jsx'
import RoomAvailabilityPage from './pages/RoomAvailabilityPage.jsx'
import Staff from './pages/Staff.jsx'
import StaffDirectory from './pages/StaffDirectory.jsx'
import ManageSubjectsPage from './pages/ManageSubjectsPage.jsx'
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
          { to: '/applications-review', label: 'Application Reviews' },
          { to: '/rooms', label: 'Room Availability' },
          { to: '/staff', label: 'Add New Staff' },
          { to: '/directory', label: 'Staff Directory' },
          { to: '/subjects', label: 'Course Catalog' },
          { to: '/subjects-manage', label: 'Manage Courses' },
        ]
      : [
          { to: '/student-dashboard', label: 'Dashboard' },
          { to: '/directory', label: 'Staff Directory' },
          { to: '/subjects', label: 'Course Catalog' },
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
          <Route path="/directory" element={<StaffDirectory />} />
          <Route path="/staff-dashboard" element={<StaffDashboard />} />
          <Route path="/student-dashboard" element={<StudentDashboard />} />
          {role === 'staff' ? <Route path="/applications" element={<Applications />} /> : null}
          {role === 'staff' ? <Route path="/applications-review" element={<ApplicationsReview />} /> : null}
          <Route path="/subjects" element={<Subjects />} />
          {role === 'staff' ? <Route path="/subjects-manage" element={<ManageSubjectsPage />} /> : null}
          {role === 'staff' ? <Route path="/rooms" element={<RoomAvailabilityPage />} /> : null}
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
