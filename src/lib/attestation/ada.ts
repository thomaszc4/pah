import { createHash } from 'crypto';

/**
 * Versioned ADA & emergency-booking attestation text.
 *
 * Each attestation is stored with its `version` so historical signatures stay
 * bound to the exact wording the user saw. When the wording changes, increment
 * the version and keep prior versions here for audit lookup.
 */

export interface AttestationText {
  version: string;
  text: string;
  hash: string;
}

function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

// --- ADA Liability Clarity (#19) ---

export const ADA_NOTICES: Record<string, AttestationText> = {
  v1: (() => {
    const text =
      'The business named above is legally responsible under the Americans with Disabilities ' +
      'Act (42 U.S.C. §12182) and, where applicable, Section 1557 of the ACA (42 U.S.C. §18116) ' +
      'for providing effective communication to Deaf, DeafBlind, and Hard of Hearing clients — ' +
      'including payment for qualified sign language interpreter services under 28 C.F.R. §36.303. ' +
      'This fee may not be passed on to the Deaf individual as a surcharge. ' +
      'By booking through PAH, an authorized agent of the business accepts responsibility for ' +
      'payment and confirms that the interpreter engagement terms have been reviewed.';
    return { version: 'v1', text, hash: hash(text) };
  })(),
};

export const CURRENT_ADA_NOTICE = ADA_NOTICES.v1;

// --- Emergency Booking Attestation (#2) ---

export const EMERGENCY_ATTESTATIONS: Record<string, AttestationText> = {
  v1: (() => {
    const text =
      'I attest that this is a bona fide emergency or urgent personal need requiring immediate ' +
      'interpreter services. I understand that if this booking concerns a business or place of ' +
      'public accommodation, that entity is legally responsible under the ADA for providing and ' +
      'paying for the interpreter. I authorize PAH to contact the designated business to confirm ' +
      'this obligation. If the business declines or cannot be reached within one hour of the ' +
      'booking, I agree to be charged for the service with the right to seek reimbursement from ' +
      'the business under applicable civil rights law.';
    return { version: 'v1', text, hash: hash(text) };
  })(),
};

export const CURRENT_EMERGENCY_ATTESTATION = EMERGENCY_ATTESTATIONS.v1;

// --- Business Confirmation for Emergency Booking (#2) ---

export const BUSINESS_EMERGENCY_CONFIRMATION: Record<string, AttestationText> = {
  v1: (() => {
    const text =
      'On behalf of the business named above, I confirm that a Deaf client has presented for an ' +
      'appointment or visit, that the business is a place of public accommodation or covered ' +
      'entity under the ADA (42 U.S.C. §12182) and/or Section 1557 of the ACA, and that the ' +
      'business accepts responsibility for payment of this interpreter engagement. I represent ' +
      'that I am authorized to bind the business and to approve this charge.';
    return { version: 'v1', text, hash: hash(text) };
  })(),
};

export const CURRENT_BUSINESS_EMERGENCY_CONFIRMATION = BUSINESS_EMERGENCY_CONFIRMATION.v1;

// --- VRI Warning (#20) ---

export const VRI_WARNINGS: Record<string, AttestationText> = {
  v1: (() => {
    const text =
      'Video Remote Interpreting (VRI) may not be appropriate for every setting. Under DOJ ' +
      'regulations at 28 C.F.R. §36.303(f), VRI requires high-speed connection, clear audio, ' +
      'and a sharply-delivered full-face image. VRI is generally inadequate for patients with ' +
      'limited vision or cognitive impairment, for trauma situations, post-operative recovery, ' +
      'pediatric care, mental-health sessions, or any setting requiring nuanced communication. ' +
      'The Deaf person\'s preference regarding in-person versus remote interpreting is ' +
      'generally determinative under the "primary consideration" standard. I acknowledge this ' +
      'notice and confirm VRI is appropriate for this booking.';
    return { version: 'v1', text, hash: hash(text) };
  })(),
};

export const CURRENT_VRI_WARNING = VRI_WARNINGS.v1;

// --- Helpers ---

export function verifyAcknowledgment(providedVersion: string | null, current: AttestationText): boolean {
  if (!providedVersion) return false;
  return providedVersion === current.version;
}
