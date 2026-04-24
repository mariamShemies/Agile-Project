import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

const AUTH_TIMEOUT_MS = 5000
const ROLE_TIMEOUT_MS = 15000

async function withTimeout(promise, label, timeoutMs = AUTH_TIMEOUT_MS) {
  let timeoutId

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timeoutId)
  }
}

async function resolveRole(userId) {
  const [staffResult, studentResult] = await Promise.all([
    supabase.from('staff').select('id').eq('id', userId).maybeSingle(),
    supabase.from('students').select('student_id').eq('student_id', userId).maybeSingle(),
  ])

  if (staffResult.error) {
    throw staffResult.error
  }

  if (studentResult.error) {
    throw studentResult.error
  }

  if (staffResult.data) {
    return 'staff'
  }

  if (studentResult.data) {
    return 'student'
  }

  return null
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const hydrateSession = async () => {
      try {
        setLoading(true)

        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          'Session lookup'
        )

        if (error) {
          console.error('Failed to load session', error)
        }

        const activeSession = data?.session ?? null
        if (!isMounted) {
          return
        }

        setSession(activeSession)
        setUser(activeSession?.user ?? null)

        if (activeSession?.user?.id) {
          try {
            const detectedRole = await withTimeout(
              resolveRole(activeSession.user.id),
              'Role lookup'
            )
            if (isMounted) {
              setRole(detectedRole)
            }
          } catch (roleError) {
            console.error('Failed to resolve role', roleError)
            if (isMounted) {
              setRole(null)
            }
          }
        } else {
          setRole(null)
        }
      } catch (bootstrapError) {
        console.error('Auth bootstrap failed', bootstrapError)
        if (isMounted) {
          setSession(null)
          setUser(null)
          setRole(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    hydrateSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (!nextSession?.user?.id) {
        setRole(null)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const detectedRole = await withTimeout(
          resolveRole(nextSession.user.id),
          'Role lookup',
          ROLE_TIMEOUT_MS
        )
        setRole(detectedRole)
      } catch (roleError) {
        console.error('Failed to resolve role', roleError)
        setRole(null)
      } finally {
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const login = async (email, password) => {
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setLoading(false)
      throw error
    }

    const signedInUserId = data?.user?.id
    if (!signedInUserId) {
      await supabase.auth.signOut()
      setLoading(false)
      throw new Error('No user was returned after sign-in.')
    }

    const detectedRole = await resolveRole(signedInUserId)

    if (!detectedRole) {
      await supabase.auth.signOut()
      setLoading(false)
      throw new Error('No profile found in staff or students table for this account.')
    }

    setRole(detectedRole)
    setLoading(false)
    return detectedRole
  }

  const logout = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signOut()

    if (error) {
      setLoading(false)
      throw error
    }

    setSession(null)
    setUser(null)
    setRole(null)
    setLoading(false)
  }

  const value = useMemo(
    () => ({
      user,
      session,
      role,
      loading,
      login,
      logout,
    }),
    [user, session, role, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }

  return context
}
