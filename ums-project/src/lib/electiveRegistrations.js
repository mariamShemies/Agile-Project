import { supabase } from './supabaseClient'

export const MAX_ELECTIVE_CREDITS = 18

async function hydrateRegistrationSubjects(rows) {
  const subjectIds = (rows ?? []).map((row) => row?.subject_id).filter(Boolean)
  if (subjectIds.length === 0) {
    return rows ?? []
  }

  const { data: subjectRows, error: subjectsError } = await supabase
    .from('subjects')
    .select('id, subject_code, subject_name, credit_hours')
    .in('id', subjectIds)

  if (subjectsError) {
    throw subjectsError
  }

  const subjectById = new Map((subjectRows ?? []).map((row) => [row.id, row]))
  return (rows ?? []).map((row) => ({
    ...row,
    subject: subjectById.get(row.subject_id) ?? null,
  }))
}

export async function fetchActiveElectiveSubjects() {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, subject_code, subject_name, credit_hours, type, status')
    .eq('type', 'Elective')
    .eq('status', 'Active')
    .order('subject_code', { ascending: true })

  if (error) {
    throw error
  }

  return data ?? []
}

export async function fetchStudentRegistrations(studentId) {
  const { data, error } = await supabase
    .from('registrations')
    .select('id, subject_id, registered_at')
    .eq('student_id', studentId)
    .order('registered_at', { ascending: false })

  if (error) {
    throw error
  }

  return hydrateRegistrationSubjects(data ?? [])
}

export async function registerStudentSubjects(studentId, subjectIds) {
  const payload = (subjectIds ?? []).map((subjectId) => ({
    student_id: studentId,
    subject_id: subjectId,
  }))

  if (payload.length === 0) {
    return []
  }

  const { data, error } = await supabase.from('registrations').insert(payload).select('id, subject_id')

  if (error) {
    throw error
  }

  return data ?? []
}

export async function removeStudentRegistration(studentId, subjectId) {
  const { error } = await supabase
    .from('registrations')
    .delete()
    .eq('student_id', studentId)
    .eq('subject_id', subjectId)

  if (error) {
    throw error
  }
}

export async function fetchUnmetPrerequisiteSubjectIds(studentId, electiveSubjectIds) {
  if (!studentId || !Array.isArray(electiveSubjectIds) || electiveSubjectIds.length === 0) {
    return { supported: false, unmetSubjectIds: [] }
  }

  // Optional table: skip prerequisite logic if this relation does not exist.
  const { data: prerequisiteRows, error: prerequisiteError } = await supabase
    .from('subject_prerequisites')
    .select('subject_id, prerequisite_subject_id')
    .in('subject_id', electiveSubjectIds)

  if (prerequisiteError) {
    return { supported: false, unmetSubjectIds: [] }
  }

  if (!prerequisiteRows || prerequisiteRows.length === 0) {
    return { supported: true, unmetSubjectIds: [] }
  }

  const { data: registrations, error: registrationsError } = await supabase
    .from('registrations')
    .select('subject_id')
    .eq('student_id', studentId)

  if (registrationsError) {
    throw registrationsError
  }

  const satisfied = new Set((registrations ?? []).map((row) => row.subject_id).filter(Boolean))
  const unmet = new Set()

  for (const row of prerequisiteRows) {
    if (!row?.subject_id || !row?.prerequisite_subject_id) {
      continue
    }
    if (!satisfied.has(row.prerequisite_subject_id)) {
      unmet.add(row.subject_id)
    }
  }

  return { supported: true, unmetSubjectIds: [...unmet] }
}
