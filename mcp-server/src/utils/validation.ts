/** Validates E.164 phone number format: +[1-9][digits], 2–15 total digits */
export function validatePhoneNumber(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

export function validateContext(context: string): boolean {
  return typeof context === 'string' && context.length > 0 && context.length <= 1000;
}
