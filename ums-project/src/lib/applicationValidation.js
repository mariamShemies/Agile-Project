/**
 * Client-side rules aligned with the `applications` insert; DB may enforce stricter `NOT NULL` in Supabase.
 * @param {Record<string, string>} form
 * @returns {{ ok: true, values: { full_name: string, national_id: string, date_of_birth: string, email: string, phone: string, program: string } } | { ok: false, message: string, fieldErrors: Record<string, string> }}
 */
export function validateApplicationForm(form) {
  const full_name = (form.full_name ?? '').trim()
  const national_id = (form.national_id ?? '').trim()
  const date_of_birth = (form.date_of_birth ?? '').trim()
  const email = (form.email ?? '').trim()
  const phone = (form.phone ?? '').trim()
  const program = (form.program ?? '').trim()

  /** @type {Record<string, string>} */
  const fieldErrors = {}

  if (!full_name) {
    fieldErrors.full_name = 'Full name is required.'
  }
  if (!national_id) {
    fieldErrors.national_id = 'National ID is required.'
  }
  if (!date_of_birth) {
    fieldErrors.date_of_birth = 'Date of birth is required.'
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) {
    fieldErrors.date_of_birth = 'Please choose a valid date of birth.'
  } else {
    const dob = new Date(`${date_of_birth}T00:00:00`)
    if (Number.isNaN(dob.getTime())) {
      fieldErrors.date_of_birth = 'Please choose a valid date of birth.'
    } else {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (dob > today) {
        fieldErrors.date_of_birth = 'Date of birth cannot be in the future.'
      }
    }
  }

  if (!email) {
    fieldErrors.email = 'Email is required.'
  } else if (!isReasonableEmail(email)) {
    fieldErrors.email = 'Please enter a valid email address.'
  }

  if (!phone) {
    fieldErrors.phone = 'Phone is required.'
  } else if (!/[\d]/.test(phone) || phone.replace(/[\d\s+().-]/g, '') !== '') {
    fieldErrors.phone = 'Use digits and common separators only (spaces, +, -, parentheses).'
  }

  if (!program) {
    fieldErrors.program = 'Program is required.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      fieldErrors,
      message: 'Please review the fields below. Required items cannot be left empty.',
    }
  }

  return {
    ok: true,
    values: { full_name, national_id, date_of_birth, email, phone, program },
  }
}

function isReasonableEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
