import crypto from 'crypto';

/**
 * Helper to generate secure random passwords.
 */
export function generatePassword(length = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from(crypto.randomFillSync(new Uint8Array(length)))
    .map((x) => charset[x % charset.length])
    .join('');
}
