// Fields that must never leave the server.
const PRIVATE_USER_FIELDS = [
  "password", "otp", "otpExpiry",
  "twoFactorCode", "twoFactorExpiry", "twoFactorSecret",
  "verificationToken", "verificationTokenExpiry",
  "googleId", "__v",
];

export const toSafeUser = (user) => {
  if (!user) return user;
  const obj = typeof user.toObject === "function" ? user.toObject() : { ...user };
  for (const field of PRIVATE_USER_FIELDS) delete obj[field];
  return obj;
};

// Use with .select() when querying users for API responses.
export const SAFE_USER_SELECT = PRIVATE_USER_FIELDS.map((f) => `-${f}`).join(" ");

export const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const pick = (source, keys) => {
  const out = {};
  for (const key of keys) if (source[key] !== undefined) out[key] = source[key];
  return out;
};
