import { useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import Applications from './pages/Applications.jsx'
import ApplicationsReview from './pages/ApplicationsReview.jsx'
import Login from './pages/Login.jsx'
import RoomReservationPage from './pages/RoomReservationPage.jsx'
import ProfessorSchedulePage from './pages/ProfessorSchedulePage.jsx'
import Staff from './pages/Staff.jsx'
import StaffDirectory from './pages/StaffDirectory.jsx'
import ManageSubjectsPage from './pages/ManageSubjectsPage.jsx'
import Subjects from './pages/Subjects.jsx'
import StudentProfilePage from './pages/StudentProfilePage.jsx'
import AssignInstructorPage from './pages/AssignInstructorPage.jsx'
import ElectiveRegistrationPage from './pages/ElectiveRegistrationPage.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { useAuth } from './context/AuthContext.jsx'
import { getLocalDateString, mergeRoomsWithAvailability } from './lib/roomAvailability'
import { supabase } from './lib/supabaseClient'

function StaffDashboard() {
  const { user } = useAuth()
  const [staffName, setStaffName] = useState('Admin')
  const [summary, setSummary] = useState({
    students: 0,
    staff: 0,
    courses: 0,
    pendingApplications: 0,
    availableRooms: 0,
  })
  const [isLoadingSummary, setIsLoadingSummary] = useState(true)

  useEffect(() => {
    let isMounted = true

    const fallbackName = () => {
      const raw = String(user?.email ?? '').split('@')[0]
      const pretty = raw
        .replace(/[._-]+/g, ' ')
        .trim()
        .replace(/\b\w/g, (m) => m.toUpperCase())
      return pretty || 'Admin'
    }

    const loadDashboard = async () => {
      setIsLoadingSummary(true)
      try {
        const today = getLocalDateString()

        const [
          staffProfile,
          studentsCount,
          staffCount,
          coursesCount,
          pendingApplicationsCount,
          roomsResult,
          reservationsResult,
        ] = await Promise.all([
          user?.id
            ? supabase.from('staff').select('full_name').eq('id', user.id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          supabase.from('students').select('student_id', { count: 'exact', head: true }),
          supabase.from('staff').select('id', { count: 'exact', head: true }),
          supabase.from('subjects').select('id', { count: 'exact', head: true }),
          supabase
            .from('applications')
            .select('id', { count: 'exact', head: true })
            .in('status', ['Pending', 'pending']),
          supabase.from('rooms').select('id, room_number, type, capacity'),
          supabase
            .from('reservations')
            .select('room_id, date, start_time, end_time, status')
            .eq('date', today),
        ])

        if (staffProfile?.error) throw staffProfile.error
        if (studentsCount?.error) throw studentsCount.error
        if (staffCount?.error) throw staffCount.error
        if (coursesCount?.error) throw coursesCount.error
        if (pendingApplicationsCount?.error) throw pendingApplicationsCount.error
        if (roomsResult?.error) throw roomsResult.error
        if (reservationsResult?.error) throw reservationsResult.error

        const mergedRooms = mergeRoomsWithAvailability(roomsResult.data ?? [], reservationsResult.data ?? [])
        const freeRooms = mergedRooms.filter((r) => r.status === 'Free').length

        if (!isMounted) return

        setStaffName(staffProfile?.data?.full_name || fallbackName())
        setSummary({
          students: studentsCount?.count ?? 0,
          staff: staffCount?.count ?? 0,
          courses: coursesCount?.count ?? 0,
          pendingApplications: pendingApplicationsCount?.count ?? 0,
          availableRooms: freeRooms,
        })
      } catch (e) {
        console.error('Failed to load staff dashboard summary', e)
        if (!isMounted) return
        setStaffName(fallbackName())
      } finally {
        if (isMounted) {
          setIsLoadingSummary(false)
        }
      }
    }

    void loadDashboard()

    return () => {
      isMounted = false
    }
  }, [user])

  return (
    <section className="page-card">
      <p className="eyebrow">University Management System</p>
      <h1>Welcome back, {staffName} 👋</h1>
      <p>Here&apos;s what&apos;s happening today.</p>

      <div className="dashboard-summary-grid" aria-label="Staff dashboard summary">
        <article className="dashboard-summary-card">
          <p className="dashboard-summary-value">{isLoadingSummary ? '...' : summary.students}</p>
          <p className="dashboard-summary-label">Total Students</p>
        </article>
        <article className="dashboard-summary-card">
          <p className="dashboard-summary-value">{isLoadingSummary ? '...' : summary.staff}</p>
          <p className="dashboard-summary-label">Total Staff</p>
        </article>
        <article className="dashboard-summary-card">
          <p className="dashboard-summary-value">{isLoadingSummary ? '...' : summary.courses}</p>
          <p className="dashboard-summary-label">Total Courses</p>
        </article>
        <article className="dashboard-summary-card">
          <p className="dashboard-summary-value">{isLoadingSummary ? '...' : summary.pendingApplications}</p>
          <p className="dashboard-summary-label">Pending Applications</p>
        </article>
        <article className="dashboard-summary-card">
          <p className="dashboard-summary-value">{isLoadingSummary ? '...' : summary.availableRooms}</p>
          <p className="dashboard-summary-label">Available Rooms</p>
        </article>
      </div>
    </section>
  )
}

function StudentDashboard() {
  const { user } = useAuth()
  const [summary, setSummary] = useState({ courses: 0, staff: 0 })
  const [isLoadingSummary, setIsLoadingSummary] = useState(true)
  const studentName = (() => {
    const raw = String(user?.email ?? '').split('@')[0]
    const pretty = raw
      .replace(/[._-]+/g, ' ')
      .trim()
      .replace(/\b\w/g, (m) => m.toUpperCase())
    return pretty || 'Student'
  })()

  useEffect(() => {
    let isMounted = true

    const loadSummary = async () => {
      setIsLoadingSummary(true)
      try {
        const [coursesCount, staffCount] = await Promise.all([
          supabase.from('subjects').select('id', { count: 'exact', head: true }),
          supabase.from('staff').select('id', { count: 'exact', head: true }),
        ])

        if (coursesCount.error) throw coursesCount.error
        if (staffCount.error) throw staffCount.error

        if (!isMounted) return
        setSummary({
          courses: coursesCount.count ?? 0,
          staff: staffCount.count ?? 0,
        })
      } catch (e) {
        console.error('Failed to load student dashboard summary', e)
      } finally {
        if (isMounted) {
          setIsLoadingSummary(false)
        }
      }
    }

    void loadSummary()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <section className="page-card">
      <p className="eyebrow">University Management System</p>
      <h1>Welcome back, {studentName} 👋</h1>
      <p>Here&apos;s what&apos;s available for you today.</p>

      <div className="dashboard-summary-grid dashboard-summary-grid-student" aria-label="Student dashboard summary">
        <article className="dashboard-summary-card">
          <p className="dashboard-summary-value">{isLoadingSummary ? '...' : summary.courses}</p>
          <p className="dashboard-summary-label">Total Available Courses</p>
        </article>
        <article className="dashboard-summary-card">
          <p className="dashboard-summary-value">{isLoadingSummary ? '...' : summary.staff}</p>
          <p className="dashboard-summary-label">Total Available Staff</p>
        </article>
      </div>
    </section>
  )
}

function AppLayout() {
  const { role, logout } = useAuth()

  const navItems =
    role === 'staff'
      ? [
          { to: '/staff-dashboard', label: 'Dashboard' },
          { to: '/students', label: 'Students' },
          { to: '/assign-instructors', label: 'Assign Instructors' },
          { to: '/applications', label: 'Applications' },
          { to: '/applications-review', label: 'Application Reviews' },
          { to: '/rooms', label: 'Room reservations' },
          { to: '/professor-schedule', label: 'Professor schedule' },
          { to: '/staff', label: 'Add New Staff' },
          { to: '/directory', label: 'Staff Directory' },
          { to: '/subjects', label: 'Course Catalog' },
          { to: '/subjects-manage', label: 'Manage Courses' },
        ]
      : [
          { to: '/student-dashboard', label: 'Dashboard' },
          { to: '/directory', label: 'Staff Directory' },
          { to: '/subjects', label: 'Course Catalog' },
          { to: '/elective-registration', label: 'Elective Registration' },
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
          {role === 'student' ? <Route path="/elective-registration" element={<ElectiveRegistrationPage />} /> : null}
          {role === 'staff' ? <Route path="/students" element={<StudentProfilePage />} /> : null}
          {role === 'staff' ? <Route path="/assign-instructors" element={<AssignInstructorPage />} /> : null}
          {role === 'staff' ? <Route path="/applications" element={<Applications />} /> : null}
          {role === 'staff' ? <Route path="/applications-review" element={<ApplicationsReview />} /> : null}
          <Route path="/subjects" element={<Subjects />} />
          {role === 'staff' ? <Route path="/subjects-manage" element={<ManageSubjectsPage />} /> : null}
          {role === 'staff' ? <Route path="/rooms" element={<RoomReservationPage />} /> : null}
          {role === 'staff' ? <Route path="/professor-schedule" element={<ProfessorSchedulePage />} /> : null}
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
