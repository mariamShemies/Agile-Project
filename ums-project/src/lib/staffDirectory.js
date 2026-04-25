import { supabase } from './supabaseClient'

export const STAFF_ROLE_PROFESSOR = 'Professor'
export const STAFF_ROLE_TA = 'TA'

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
  const result = validateAddStaffForm(
    {
      ...raw,
      role: STAFF_ROLE_PROFESSOR,
      supervisor_id: null,
    },
    { skipEmployeeId }
  )
  if (!result.ok) {
    return result
  }

  return {
    ok: true,
    values: {
      full_name: result.values.full_name,
      employee_id: result.values.employee_id,
      department: result.values.department,
      email: result.values.email,
      office_location: result.values.office_location,
    },
  }
}

/**
 * @param {Record<string, string | boolean | undefined>} raw
 * @param {{ skipEmployeeId?: boolean }} options — set true for pre-check when using auto-generated ID
 * @returns {{ ok: true, values: object } | { ok: false, message: string }}
 */
export function validateAddStaffForm(raw, { skipEmployeeId = false } = {}) {
  const role = String(raw?.role ?? '').trim()
  const full_name = String(raw?.full_name ?? '').trim()
  const department = String(raw?.department ?? '').trim()
  const email = String(raw?.email ?? '').trim()
  const office_location = String(raw?.office_location ?? '').trim()
  const employee_id = String(raw?.employee_id ?? '').trim()
  const supervisor_id = String(raw?.supervisor_id ?? '').trim()

  if (![STAFF_ROLE_PROFESSOR, STAFF_ROLE_TA].includes(role)) {
    return { ok: false, message: 'Please choose a valid staff role.' }
  }

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
  if (role === STAFF_ROLE_TA && !supervisor_id) {
    return { ok: false, message: 'Supervisor Professor is required for TAs.' }
  }

  return {
    ok: true,
    values: {
      role,
      full_name,
      employee_id,
      department,
      email,
      office_location,
      supervisor_id: role === STAFF_ROLE_TA ? supervisor_id : null,
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
 * Backward-compatible helper that always inserts role=Professor.
 * @param {object} input — must include `employee_id` (final), all other fields
 * @returns {Promise<{ ok: true, id: string } | { ok: false, code: 'duplicate' | 'insert', message: string }>}
 */
export async function insertProfessor(input) {
  return insertStaffMember({
    ...input,
    role: STAFF_ROLE_PROFESSOR,
    supervisor_id: null,
  })
}

/**
 * Insert either Professor or TA row.
 * @param {object} input — must include `employee_id`, required directory fields, `role`, and optional `supervisor_id`
 * @returns {Promise<{ ok: true, id: string } | { ok: false, code: 'duplicate' | 'insert', message: string }>}
 */
export async function insertStaffMember(input) {
  const id = crypto.randomUUID()
  const nowIso = new Date().toISOString()
  const role = input.role === STAFF_ROLE_TA ? STAFF_ROLE_TA : STAFF_ROLE_PROFESSOR

  const row = {
    id,
    employee_id: input.employee_id,
    full_name: input.full_name,
    department: input.department,
    email: input.email,
    office_location: input.office_location,
    role,
    supervisor_id: role === STAFF_ROLE_TA ? input.supervisor_id : null,
    created_at: nowIso,
  }

  const { error } = await supabase.from('staff').insert([row])

  if (error) {
    if (isUniqueEmployeeIdError(error)) {
      return { ok: false, code: 'duplicate', message: 'Employee ID already exists.' }
    }
    if (error.code === '23503') {
      return { ok: false, code: 'insert', message: 'Selected supervisor professor is invalid.' }
    }
    if (error.code === '23514') {
      return { ok: false, code: 'insert', message: 'Supervisor rules were violated for this role.' }
    }
    return {
      ok: false,
      code: 'insert',
      message: error.message || 'Could not add staff member. Please try again.',
    }
  }

  return { ok: true, id }
}

/**
 * List professors for the TA supervisor dropdown.
 * @returns {Promise<Array<{ id: string, full_name?: string, name?: string, employee_id?: string }>>}
 */
export async function fetchProfessorSupervisors() {
  const { data, error } = await supabase
    .from('staff')
    .select('id, full_name, name, employee_id, role')
    .eq('role', STAFF_ROLE_PROFESSOR)
    .order('full_name', { ascending: true })

  if (error) {
    const fallback = await supabase.from('staff').select('*').eq('role', STAFF_ROLE_PROFESSOR)
    if (fallback.error) {
      throw fallback.error
    }
    return fallback.data ?? []
  }

  return data ?? []
}

/**
 * List staff for directory (HR view). Tolerates legacy `name` column.
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function fetchStaffDirectory() {
  const { data, error } = await supabase
    .from('staff')
    .select('id, employee_id, full_name, name, department, email, office_location, role, supervisor_id, created_at')
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

/**
 * Public-facing staff directory with supervisor info for TAs (privacy-safe).
 * Fetches only safe fields: full_name, role, department, office_location, supervisor info.
 * @returns {Promise<Array<{ id: string, full_name: string, role: string, department: string, office_location?: string, supervisor?: { full_name: string, role: string } }>>}
 */
export async function fetchPublicStaffDirectory() {
  const { data, error } = await supabase
    .from('staff')
    .select(
      `
      id,
      full_name,
      role,
      department,
      office_location,
      supervisor_id,
      supervisor:supervisor_id(full_name, role)
    `
    )
    .order('full_name', { ascending: true })

  if (error) {
    throw error
  }

  const base = (data ?? []).map((row) => ({
    id: row.id,
    full_name: row.full_name || '—',
    role: row.role || '—',
    department: row.department || '—',
    office_location: row.office_location || null,
    supervisor:
      row.role === STAFF_ROLE_TA && row.supervisor
        ? {
            full_name: row.supervisor.full_name || 'Unknown',
            role: row.supervisor.role || 'Unknown',
          }
        : null,
  }))

  // Attach subject assignments for "staff profile" visibility (best-effort)
  try {
    const staffIds = base.map((s) => s.id).filter(Boolean)
    if (staffIds.length === 0) return base

    const { data: aData, error: aErr } = await supabase
      .from('subject_assignments')
      .select(
        `
        staff_id,
        role,
        subject:subject_id(subject_code, subject_name)
      `
      )
      .in('staff_id', staffIds)

    if (aErr) return base

    const map = new Map()
    for (const a of aData ?? []) {
      const sid = a?.staff_id
      if (!sid) continue
      const list = map.get(sid) ?? []
      list.push(a)
      map.set(sid, list)
    }

    return base.map((s) => {
      const list = map.get(s.id) ?? []
      const subjects = list
        .map((a) => {
          const subj = a?.subject
          const code = subj?.subject_code ?? subj?.code
          const name = subj?.subject_name ?? subj?.name
          return { role: a?.role ?? '—', code: code ?? '—', name: name ?? '—' }
        })
        .filter(Boolean)
      return { ...s, assignments: subjects }
    })
  } catch (e) {
    console.error('fetchPublicStaffDirectory assignments', e)
    return base
  }
}
