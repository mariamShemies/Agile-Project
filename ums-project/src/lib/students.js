import { supabase } from './supabaseClient'

export async function fetchStudents() {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('full_name', { ascending: true })

  if (error) {
    throw error
  }

  return data ?? []
}

export async function updateStudent(studentId, updates) {
  const payload = {
    email: updates.email,
    phone: updates.phone,
    program: updates.program,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('students')
    .update(payload)
    .eq('student_id', studentId)
    .select('*')
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

