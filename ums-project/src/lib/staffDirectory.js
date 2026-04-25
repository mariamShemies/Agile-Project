import { supabase } from './supabaseClient'

export const STAFF_ROLE_PROFESSOR = 'Professor'

/**
 * Task 3: next ID in "EMP-###" form (pad 3). Scans existing `employee_id` values; handle collision via unique constraint + retry in UI.
 * @returns {Promise<string>}
 */
export async function generateNextEmployeeId() {
  const { data, error } = await supabase.from('staff').select('employee_id')
  if (error) {
    throw error
  }
  let max = 0
  for (const row of data ?? []) {
    const id = row?.employee_id
    if (id == null || id === '') {
      continue
    }
    const m = /^EMP-(\d+)$/i.exec(String(id).trim())
    if (m) {
      max = Math.max(max, parseInt(m[1], 10))
    }
  }
  return `EMP-${String(max + 1).padStart(3, '0')}`
}

/**
 * @param {Record<string, string | boolean | undefined>} raw
 * @param {{ skipEmployeeId?: boolean }} options — set true for pre-check when using auto-generated ID
 * @returns {{ ok: true, values: object } | { ok: false, message: string }}
 */
export function validateAddProfessorForm(raw, { skipEmployeeId = false } = {}) {
  const full_name = String(raw?.full_name ?? '').trim()
  const department = String(raw?.department ?? '').trim()
  const email = String(raw?.email ?? '').trim()
  const office_location = String(raw?.office_location ?? '').trim()
  const employee_id = String(raw?.employee_id ?? '').trim()

  if (!full_name) {
    return { ok: false, message: 'Full name is required.' }
  }
  if (!skipEmployeeId && !employee_id) {
    return { ok: false, message: 'Employee ID is required, or enable auto-generated ID.' }
  }
  if (!department) {
    return { ok: false, message: 'Department is required.' }
  }
  if (!email) {
    return { ok: false, message: 'Email is required.' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: 'Please enter a valid email address.' }
  }
  if (!office_location) {
    return { ok: false, message: 'Office location is required.' }
  }

  return {
    ok: true,
    values: {
      full_name,
      employee_id,
      department,
      email,
      office_location,
    },
  }
}

/**
 * @param {import('@supabase/supabase-js').PostgrestError} err
 */
function isUniqueEmployeeIdError(err) {
  if (err?.code === '23505') {
    return true
  }
  const m = (err?.message || '').toLowerCase()
  return (
    (m.includes('duplicate key') || m.includes('unique')) && (m.includes('employee_id') || m.includes('employee'))
  )
}

/**
 * Task 2: insert professor row; `role` is always Professor.
 * @param {object} input — must include `employee_id` (final), all other fields
 * @returns {Promise<{ ok: true, id: string } | { ok: false, code: 'duplicate' | 'insert', message: string }>}
 */
export async function insertProfessor(input) {
  const id = crypto.randomUUID()
  const nowIso = new Date().toISOString()

  const row = {
    id,
    employee_id: input.employee_id,
    full_name: input.full_name,
    department: input.department,
    email: input.email,
    office_location: input.office_location,
    role: STAFF_ROLE_PROFESSOR,
    created_at: nowIso,
  }

  const { error } = await supabase.from('staff').insert([row])

  if (error) {
    if (isUniqueEmployeeIdError(error)) {
      return { ok: false, code: 'duplicate', message: 'Employee ID already exists.' }
    }
    return {
      ok: false,
      code: 'insert',
      message: error.message || 'Could not add professor. Please try again.',
    }
  }

  return { ok: true, id }
}

/**
 * List staff for directory (HR view). Tolerates legacy `name` column.
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function fetchStaffDirectory() {
  const { data, error } = await supabase
    .from('staff')
    .select('id, employee_id, full_name, name, department, email, office_location, role, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    const fallback = await supabase.from('staff').select('*').order('created_at', { ascending: false })
    if (fallback.error) {
      throw fallback.error
    }
    return fallback.data ?? []
  }
  return data ?? []
}
