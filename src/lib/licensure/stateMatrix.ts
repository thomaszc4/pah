import type { CertificationType } from '@/types';
import { LICENSURE_STATES } from '@/types';

/**
 * Maps each cert type to the US states where that credential is *sufficient*
 * for in-person interpreting. Empty array means "nationwide where no state
 * license is required" (most RID, CCHI, etc. fall here).
 *
 * State-specific entries (like BEI → TX) mean the interpreter is licensed
 * in those states via that credential.
 */
export const CERT_STATE_VALIDITY: Partial<Record<CertificationType, readonly string[]>> = {
  // RID - nationwide (no state-specific endorsement)
  RID_NIC: [],
  RID_NIC_ADVANCED: [],
  RID_NIC_MASTER: [],
  RID_CDI: [],
  RID_SC_L: [],
  RID_ED_K12: [],
  RID_OTC: [],

  // BEI - Texas
  BEI_BASIC: ['TX'],
  BEI_ADVANCED: ['TX'],
  BEI_MASTER: ['TX'],
  BEI_COURT: ['TX'],
  BEI_MEDICAL: ['TX'],
  BEI_TRILINGUAL: ['TX'],

  // Medical certifications - nationwide
  CCHI_CORE: [],
  CCHI_PERFORMANCE: [],
  NBCMI_CMI: [],
  NBCDI: [],
  QMHI: [],
  DEAF_BLIND_CERT: [],

  // CART - nationwide (captioning)
  CART: [],

  // State license - the admin must capture which state in cert metadata; treat as
  // valid in one state only (admin should set valid_in_states during verification).
  STATE_LICENSE: [],

  OTHER: [],
};

/**
 * Union the valid_in_states arrays of a set of certs.
 * If any cert is nationwide (empty array), returns null meaning "valid in all
 * non-licensure states, and additionally in any licensure state where another
 * cert grants access."
 */
export function computeLicensedStates(
  certs: Array<{ cert_type: CertificationType; valid_in_states: string[] | null | undefined }>,
): { nationwide: boolean; states: Set<string> } {
  const states = new Set<string>();
  let nationwide = false;
  for (const cert of certs) {
    const rowStates = cert.valid_in_states ?? CERT_STATE_VALIDITY[cert.cert_type] ?? [];
    if (rowStates.length === 0) {
      nationwide = true;
    } else {
      for (const s of rowStates) states.add(s.toUpperCase());
    }
  }
  return { nationwide, states };
}

/**
 * Returns true if an interpreter with these cert rows is eligible to work
 * in-person in the given state.
 *
 * - Non-licensure states: nationwide cert is enough.
 * - Licensure states: must have a state-specific cert in that state's set.
 */
export function isEligibleForInPerson(
  certs: Array<{ cert_type: CertificationType; valid_in_states: string[] | null | undefined }>,
  serviceState: string | null | undefined,
): boolean {
  if (!serviceState) return true;
  const upper = serviceState.toUpperCase();
  const { nationwide, states } = computeLicensedStates(certs);
  const requiresLicense = (LICENSURE_STATES as readonly string[]).includes(upper);
  if (!requiresLicense) {
    // State does not require a separate license — any verified cert is fine.
    return nationwide || states.size > 0;
  }
  // Licensure state — must have a state-specific cert for that state.
  return states.has(upper);
}

/**
 * Human-readable explanation of why an interpreter is ineligible, useful for admins and UI.
 */
export function ineligibleReason(
  certs: Array<{ cert_type: CertificationType; valid_in_states: string[] | null | undefined }>,
  serviceState: string,
): string | null {
  if (isEligibleForInPerson(certs, serviceState)) return null;
  return `Interpreting in ${serviceState.toUpperCase()} requires a state license (e.g., BEI for Texas). Verified certifications on file do not qualify.`;
}
