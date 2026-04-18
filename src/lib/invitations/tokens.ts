import { createHash, randomBytes } from 'crypto';

/**
 * Invitation tokens are opaque random strings the server mints and hashes
 * for database storage. The plaintext token goes in the invite link; only
 * its SHA-256 hash is stored in the DB. This is the same pattern as the
 * emergency-attestation flow in src/app/api/bookings/[id]/emergency-attestation.
 */

export function mintToken(): string {
  // 24 bytes → 32 base64url characters. Collision-resistant and URL-safe.
  return randomBytes(24).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function invitationUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, '')}/invite/${token}`;
}
