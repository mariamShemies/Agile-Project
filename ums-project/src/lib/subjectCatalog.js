import { supabase } from './supabaseClient'

export const SUBJECT_TYPE_CORE = 'Core'
export const SUBJECT_TYPE_ELECTIVE = 'Elective'

export const SUBJECT_STATUS_ACTIVE = 'Active'
export const SUBJECT_STATUS_INACTIVE = 'Inactive'

/** @typedef {typeof SUBJECT_TYPE_CORE | typeof SUBJECT_TYPE_ELECTIVE} SubjectTypeKey */

const EMPTY_MESSAGE = 'Please complete all required fields. Empty values are not allowed.'

/**
 * Task 3: required fields, non-empty / valid credit hours before submit.
 * @param {Record<string, unknown>} raw
 * @returns {{ ok: true, values: { subject_code: string, subject_name: string, credit_hours: number, type: string, department: string } } | { ok: false, message: string }}
 */
export function validateCreateSubjectForm(raw) {
  const subject_code = String(raw?.subject_code ?? '').trim()
  const subject_name = String(raw?.subject_name ?? '').trim()
  const department = String(raw?.department ?? '').trim()
  const type = String(raw?.type ?? '').trim()
  const creditInput = raw?.credit_hours

  if (!subject_code || !subject_name || !department) {
    return { ok: false, message: EMPTY_MESSAGE }
  }
  if (type !== SUBJECT_TYPE_CORE && type !== SUBJECT_TYPE_ELECTIVE) {
    return { ok: false, message: 'Type must be Core or Elective.' }
  }
  if (creditInput === '' || creditInput === null || creditInput === undefined) {
    return { ok: false, message: EMPTY_MESSAGE }
  }
  const n = Number(creditInput)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    return { ok: false, message: 'Credit hours must be a whole number of at least 1.' }
  }

  return {
    ok: true,
    values: { subject_code, subject_name, credit_hours: n, type, department },
  }
}

/**
 * Task 2: insert into `subjects`; status is always "Active" here.
 * @param {object} input — normalized { subject_code, subject_name, credit_hours, type, department }
 * @returns {Promise<{ ok: true, id: string } | { ok: false, code: 'duplicate' | 'insert', message: string }>}
 */
export async function insertSubject(input) {
  const id = crypto.randomUUID()
  const nowIso = new Date().toISOString()

  const row = {
    id,
    subject_code: input.subject_code,
    subject_name: input.subject_name,
    credit_hours: input.credit_hours,
    type: input.type,
    department: input.department,
    status: SUBJECT_STATUS_ACTIVE,
    created_at: nowIso,
  }

  const { error } = await supabase.from('subjects').insert([row])

  if (error) {
    if (isPostgresUniqueViolation(error)) {
      return { ok: false, code: 'duplicate', message: 'Subject code already exists.' }
    }
    return {
      ok: false,
      code: 'insert',
      message: error.message || 'Could not create subject. Please try again.',
    }
  }

  return { ok: true, id }
}

/**
 * @param {import('@supabase/supabase-js').PostgrestError} err
 */
function isPostgresUniqueViolation(err) {
  if (err?.code === '23505') {
    return true
  }
  const m = (err?.message || '').toLowerCase()
  return m.includes('duplicate key') || m.includes('unique constraint') || m.includes('already exists')
}

/**
 * Task 4: list all subjects (manage UI + local search). Legacy `code`/`name` may exist on old rows.
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function fetchSubjects() {
  const { data, error } = await supabase.from('subjects').select('*').order('created_at', { ascending: false })
  if (error) {
    throw error
  }
  return data ?? []
}

/**
 * @param {Record<string, unknown>} input
 * @returns {{ ok: true, values: { subject_name: string, credit_hours: number, type: string, department: string } } | { ok: false, message: string }}
 */
export function validateEditSubjectForm(input) {
  const subject_name = String(input?.subject_name ?? '').trim()
  const department = String(input?.department ?? '').trim()
  const type = String(input?.type ?? '').trim()
  const ch = input?.credit_hours
  if (!subject_name) {
    return { ok: false, message: 'Subject name is required.' }
  }
  if (type !== SUBJECT_TYPE_CORE && type !== SUBJECT_TYPE_ELECTIVE) {
    return { ok: false, message: 'Type must be Core or Elective.' }
  }
  if (!department) {
    return { ok: false, message: 'Department is required.' }
  }
  if (ch === '' || ch === null || ch === undefined) {
    return { ok: false, message: 'Credit hours is required.' }
  }
  const n = Number(ch)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    return { ok: false, message: 'Credit hours must be a whole number of at least 1.' }
  }
  return { ok: true, values: { subject_name, credit_hours: n, type, department } }
}

/**
 * Task 4: update editable fields + `updated_at` (code is not passed).
 * @param {string} id — row uuid
 * @param {{ subject_name: string, credit_hours: number, type: string, department: string }} values
 */
export async function updateSubject(id, values) {
  const updated_at = new Date().toISOString()
  const { error } = await supabase
    .from('subjects')
    .update({
      subject_name: values.subject_name,
      credit_hours: values.credit_hours,
      type: values.type,
      department: values.department,
      updated_at,
    })
    .eq('id', id)

  if (error) {
    throw error
  }
}

/**
 * Task 4: soft deactivation (status only).
 * @param {string} id
 */
export async function deactivateSubject(id) {
  const updated_at = new Date().toISOString()
  const { error } = await supabase
    .from('subjects')
    .update({ status: SUBJECT_STATUS_INACTIVE, updated_at })
    .eq('id', id)

  if (error) {
    throw error
  }
}
