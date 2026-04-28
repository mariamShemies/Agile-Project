import { supabase } from './supabaseClient'
import { STAFF_ROLE_PROFESSOR, STAFF_ROLE_TA } from './staffDirectory'
import { SUBJECT_STATUS_ACTIVE } from './subjectCatalog'

export const ASSIGNMENT_ROLE_INSTRUCTOR = 'Instructor'
export const ASSIGNMENT_ROLE_TA = 'TA'

function normalizeSubjectName(row) {
  return row?.subject_name ?? row?.name ?? '—'
}

function normalizeSubjectCode(row) {
  return row?.subject_code ?? row?.code ?? '—'
}

export async function fetchSubjects() {
  const { data, error } = await supabase
    .from('subjects')
    // IMPORTANT: avoid selecting legacy/non-existent columns (e.g. `code`, `name`)
    // since Supabase will error if any selected column doesn't exist.
    .select('id, subject_code, subject_name, department, status, created_at, updated_at')
    .eq('status', SUBJECT_STATUS_ACTIVE)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    ...row,
    subject_code: normalizeSubjectCode(row),
    subject_name: normalizeSubjectName(row),
  }))
}

export async function fetchStaff() {
  const { data, error } = await supabase
    .from('staff')
    .select('id, full_name, role, status')
    .eq('status', 'Active')
    .order('full_name', { ascending: true })

  if (error) {
    // fallback if `status` column doesn't exist yet
    const fallback = await supabase.from('staff').select('id, full_name, role').order('full_name', { ascending: true })
    if (fallback.error) throw fallback.error
    return fallback.data ?? []
  }

  return data ?? []
}

export async function fetchAssignments(subjectIds) {
  if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('subject_assignments')
    .select(
      `
      id,
      subject_id,
      staff_id,
      role,
      assigned_at,
      staff:staff_id(id, full_name, role)
    `
    )
    .in('subject_id', subjectIds)

  if (error) throw error
  return data ?? []
}

/**
 * Load subjects taught by a professor (Instructor assignments only).
 * @param {string} staffId
 * @returns {Promise<Array<{ id: string, subject_code?: string, subject_name?: string, department?: string, status?: string }>>}
 */
export async function fetchInstructorSubjectsForStaff(staffId) {
  const normalizedStaffId = String(staffId ?? '').trim()
  if (!normalizedStaffId) {
    return []
  }

  const { data, error } = await supabase
    .from('subject_assignments')
    .select(
      `
      subject_id,
      subject:subject_id(id, subject_code, subject_name, department, status)
    `
    )
    .eq('staff_id', normalizedStaffId)
    .eq('role', ASSIGNMENT_ROLE_INSTRUCTOR)
    .order('assigned_at', { ascending: true })

  if (error) {
    const fallback = await supabase
      .from('subject_assignments')
      .select('subject_id')
      .eq('staff_id', normalizedStaffId)
      .eq('role', ASSIGNMENT_ROLE_INSTRUCTOR)
    if (fallback.error) {
      throw fallback.error
    }

    return (fallback.data ?? [])
      .map((row) => ({ id: row?.subject_id }))
      .filter((row) => row.id)
  }

  const subjectsById = new Map()
  for (const row of data ?? []) {
    const subject = row?.subject
    const subjectId = subject?.id ?? row?.subject_id
    if (!subjectId || subjectsById.has(String(subjectId))) {
      continue
    }

    subjectsById.set(String(subjectId), {
      id: String(subjectId),
      subject_code: subject?.subject_code ?? '—',
      subject_name: subject?.subject_name ?? '—',
      department: subject?.department ?? '—',
      status: subject?.status ?? null,
    })
  }

  return [...subjectsById.values()]
}

export async function assignInstructor({ subjectId, staffId, role }) {
  const normalizedRole = role === ASSIGNMENT_ROLE_TA ? ASSIGNMENT_ROLE_TA : ASSIGNMENT_ROLE_INSTRUCTOR

  // Validate subject is Active
  const subjectCheck = await supabase.from('subjects').select('id, status').eq('id', subjectId).maybeSingle()
  if (subjectCheck.error) throw subjectCheck.error
  if (!subjectCheck.data || subjectCheck.data.status !== SUBJECT_STATUS_ACTIVE) {
    throw new Error('Subject must be Active to assign staff.')
  }

  // Validate staff is Active + business rule for Instructor
  let staffRow = null
  const staffWithStatus = await supabase.from('staff').select('id, role, status').eq('id', staffId).maybeSingle()
  if (staffWithStatus.error) {
    const staffWithoutStatus = await supabase.from('staff').select('id, role').eq('id', staffId).maybeSingle()
    if (staffWithoutStatus.error) throw staffWithoutStatus.error
    staffRow = staffWithoutStatus.data ?? null
  } else {
    staffRow = staffWithStatus.data ?? null
  }

  if (!staffRow) {
    throw new Error('Selected staff member was not found.')
  }
  if (staffRow.status && staffRow.status !== 'Active') {
    throw new Error('Staff must be Active to be assigned.')
  }
  if (normalizedRole === ASSIGNMENT_ROLE_INSTRUCTOR && staffRow.role !== STAFF_ROLE_PROFESSOR) {
    throw new Error('Only Professors can be assigned as Instructor.')
  }
  if (normalizedRole === ASSIGNMENT_ROLE_TA && staffRow.role !== STAFF_ROLE_TA) {
    throw new Error('Only TAs can be assigned as TA.')
  }

  // Prevent duplicates (same subject + same staff)
  const dupCheck = await supabase
    .from('subject_assignments')
    .select('id')
    .eq('subject_id', subjectId)
    .eq('staff_id', staffId)
    .maybeSingle()
  if (dupCheck.error) throw dupCheck.error
  if (dupCheck.data?.id) {
    throw new Error('This staff member is already assigned to this subject.')
  }

  // Prevent conflicts: only one Instructor per subject
  if (normalizedRole === ASSIGNMENT_ROLE_INSTRUCTOR) {
    const instructorExists = await supabase
      .from('subject_assignments')
      .select('id, staff_id')
      .eq('subject_id', subjectId)
      .eq('role', ASSIGNMENT_ROLE_INSTRUCTOR)
      .maybeSingle()
    if (instructorExists.error) throw instructorExists.error
    if (instructorExists.data?.id) {
      throw new Error('This subject already has an Instructor assigned.')
    }
  }

  const row = {
    subject_id: subjectId,
    staff_id: staffId,
    role: normalizedRole,
    assigned_at: new Date().toISOString(),
  }

  const { data, error } = await supabase.from('subject_assignments').insert([row]).select('*').maybeSingle()
  if (error) throw error
  return data
}

