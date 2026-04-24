import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

const AUTH_TIMEOUT_MS = 5000

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

const ROLE_TOTAL_TIMEOUT_MS = 20000

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
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

/** Retries help after the tab was idle: network/Supabase can flakily fail on the first call */
async function resolveRoleWithRetry(userId, { attempts = 3, delayMs = 400 } = {}) {
  let lastError
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await resolveRole(userId)
    } catch (e) {
      lastError = e
      if (i < attempts - 1) {
        await sleep(delayMs * (i + 1))
      }
    }
  }
  throw lastError
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isResolvingRole, setIsResolvingRole] = useState(false)
  const loadingRef = useRef(true)
  const roleLookupInFlight = useRef(0)

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
          resolveRoleWithRetry(activeSession.user.id),
          'Role lookup',
          ROLE_TOTAL_TIMEOUT_MS
        )
        if (isMounted) {
          setRole(detectedRole)
        }
      } catch (roleError) {
        // Do not clear an existing valid role: transient network/DB errors on refresh are common
        console.error('Failed to resolve role', roleError)
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
        roleLookupInFlight.current = 0
        setIsResolvingRole(false)
        syncLoadingRef(false)
        return
      }

      // Do not toggle global `loading` here. Tab return / token refresh can re-run role lookup;
      // errors must not clear a previously valid role, or the UI shows "no role" until full refresh.
      roleLookupInFlight.current += 1
      if (isMounted) {
        setIsResolvingRole(true)
      }
      try {
        const detectedRole = await withTimeout(
          resolveRoleWithRetry(nextSession.user.id),
          'Role lookup',
          ROLE_TOTAL_TIMEOUT_MS
        )
        if (isMounted) {
          setRole(detectedRole)
        }
      } catch (roleError) {
        console.error('Failed to resolve role (keeping previous role if any)', roleError)
      } finally {
        if (isMounted) {
          roleLookupInFlight.current = Math.max(0, roleLookupInFlight.current - 1)
          setIsResolvingRole(roleLookupInFlight.current > 0)
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
      detectedRole = await withTimeout(
        resolveRoleWithRetry(signedInUserId),
        'Role lookup',
        ROLE_TOTAL_TIMEOUT_MS
      )
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
      isResolvingRole,
      login,
      logout,
    }),
    [user, session, role, loading, isResolvingRole]
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
