import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
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
  const loadingRef = useRef(true)

  const syncLoadingRef = (v) => {
    loadingRef.current = v
    setLoading(v)
  }

  useEffect(() => {
    let isMounted = true
    let bootstrapId = 0

    const applyUserFromSession = async (activeSession) => {
      if (!activeSession?.user?.id) {
        if (isMounted) {
          setRole(null)
        }
        return
      }
      try {
        const detectedRole = await withTimeout(
          resolveRole(activeSession.user.id),
          'Role lookup',
          ROLE_TIMEOUT_MS
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
    }

    const completeBootstrap = async (activeSession) => {
      if (!isMounted) {
        return
      }
      setSession(activeSession)
      setUser(activeSession?.user ?? null)
      await applyUserFromSession(activeSession)
      if (isMounted) {
        syncLoadingRef(false)
      }
    }

    const hydrateSession = async () => {
      const myId = ++bootstrapId
      try {
        syncLoadingRef(true)

        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          'Session lookup',
          AUTH_TIMEOUT_MS
        )

        if (error) {
          console.error('Failed to load session', error)
        }

        if (myId !== bootstrapId || !isMounted) {
          return
        }

        const activeSession = data?.session ?? null

        if (!activeSession) {
          setSession(null)
          setUser(null)
          setRole(null)
          if (isMounted) {
            syncLoadingRef(false)
          }
          return
        }

        await completeBootstrap(activeSession)
      } catch (bootstrapError) {
        console.error('Auth bootstrap failed', bootstrapError)
        if (isMounted) {
          setSession(null)
          setUser(null)
          setRole(null)
          syncLoadingRef(false)
        }
      }
    }

    const recoverBootstrapIfStuck = async () => {
      if (document.visibilityState !== 'visible' || !isMounted) {
        return
      }
      if (!loadingRef.current) {
        return
      }
      // Tab was in background: timers/ Promises can stall; re-fetch session and finish
      const myId = ++bootstrapId
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          'Session recovery',
          AUTH_TIMEOUT_MS
        )
        if (error) {
          console.error('Session recovery failed', error)
        }
        if (myId !== bootstrapId || !isMounted) {
          return
        }
        const activeSession = data?.session ?? null
        if (!activeSession) {
          setSession(null)
          setUser(null)
          setRole(null)
          syncLoadingRef(false)
          return
        }
        await completeBootstrap(activeSession)
      } catch (e) {
        console.error('Session recovery error', e)
        if (isMounted) {
          syncLoadingRef(false)
        }
      }
    }

    void hydrateSession()

    const onVisibility = () => {
      void recoverBootstrapIfStuck()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!isMounted) {
        return
      }

      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (!nextSession?.user?.id) {
        setRole(null)
        syncLoadingRef(false)
        return
      }

      // Do not toggle global `loading` here. Tab return / token refresh can fire
      // SIGNED_IN or other events; blocking the app caused endless "Loading account…"
      // Only the initial `hydrateSession` / `recoverBootstrapIfStuck` / login / logout
      // control the full-page loader.
      try {
        const detectedRole = await withTimeout(
          resolveRole(nextSession.user.id),
          'Role lookup',
          ROLE_TIMEOUT_MS
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
    })

    return () => {
      isMounted = false
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
      subscription.unsubscribe()
    }
  }, [])

  const login = async (email, password) => {
    syncLoadingRef(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      syncLoadingRef(false)
      throw error
    }

    const signedInUserId = data?.user?.id
    if (!signedInUserId) {
      await supabase.auth.signOut()
      syncLoadingRef(false)
      throw new Error('No user was returned after sign-in.')
    }

    let detectedRole
    try {
      detectedRole = await withTimeout(resolveRole(signedInUserId), 'Role lookup', ROLE_TIMEOUT_MS)
    } catch (e) {
      await supabase.auth.signOut()
      syncLoadingRef(false)
      throw e
    }

    if (!detectedRole) {
      await supabase.auth.signOut()
      syncLoadingRef(false)
      throw new Error('No profile found in staff or students table for this account.')
    }

    setRole(detectedRole)
    syncLoadingRef(false)
    return detectedRole
  }

  const logout = async () => {
    syncLoadingRef(true)
    const { error } = await supabase.auth.signOut()

    if (error) {
      syncLoadingRef(false)
      throw error
    }

    setSession(null)
    setUser(null)
    setRole(null)
    syncLoadingRef(false)
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
