import {
  type CertificationType,
  type ExperienceTier,
  CERT_WEIGHTS,
  TIER_THRESHOLDS,
} from '@/types';

/**
 * Calculates an interpreter's experience tier based on their certifications
 * and years of experience. This prevents a 20-year veteran from starting
 * as "provisional" just because they're new to the platform.
 *
 * Scoring formula:
 *   composite = highest_cert_weight + (years_experience * 5) + (num_specializations * 10)
 *
 * Thresholds:
 *   Expert:      150+ points (e.g., NIC Master(100) + 10 yrs(50) = 150)
 *   Advanced:    100+ points (e.g., NIC(75) + 5 yrs(25) = 100)
 *   Certified:    60+ points (e.g., BEI Basic(50) + 2 yrs(10) = 60)
 *   Provisional:   0+ points (new, minimal certs)
 */
export function calculateTier(
  certTypes: CertificationType[],
  yearsExperience: number,
  numSpecializations: number = 1,
): { tier: ExperienceTier; hourlyRateCents: number; compositeScore: number } {
  // Get highest certification weight
  const highestCertWeight = certTypes.length > 0
    ? Math.max(...certTypes.map((ct) => CERT_WEIGHTS[ct] ?? 0))
    : 0;

  // Composite score
  const compositeScore =
    highestCertWeight +
    yearsExperience * 5 +
    Math.max(0, numSpecializations - 1) * 10;

  // Find matching tier (sorted highest to lowest)
  for (const threshold of TIER_THRESHOLDS) {
    if (compositeScore >= threshold.minScore) {
      return {
        tier: threshold.tier,
        hourlyRateCents: threshold.hourlyRateCents,
        compositeScore,
      };
    }
  }

  // Fallback (shouldn't reach here since provisional has minScore 0)
  return {
    tier: 'provisional',
    hourlyRateCents: TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1].hourlyRateCents,
    compositeScore,
  };
}
