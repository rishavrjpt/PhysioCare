// Fields that must never leave the server (camelCase, as returned by utils/rows.js).
const PRIVATE_USER_FIELDS = [
  "password", "otp", "otpExpiry", "otpAttempts", "otpLastSentAt",
  "verificationToken", "verificationTokenExpiry",
  "googleId",
];

export const toSafeUser = (user) => {
  if (!user) return user;
  const obj = { ...user };
  for (const field of PRIVATE_USER_FIELDS) delete obj[field];
  return obj;
};

// SQL select list for users in API responses (no secrets), including enrolledPrograms as an id array.
export const SAFE_USER_SELECT = `
  id, name, email, role, auth_provider, is_verified, profile_completed, profile_photo, phone, city,
  date_of_birth, gender, blood_group, current_condition, existing_conditions, past_surgeries,
  emergency_contact_name, emergency_contact_number, created_at, updated_at,
  coalesce((select array_agg(pe.program_id::text) from program_enrollments pe where pe.patient_id = users.id), '{}') as enrolled_programs`;

export const pick = (source, keys) => {
  const out = {};
  for (const key of keys) if (source[key] !== undefined) out[key] = source[key];
  return out;
};
