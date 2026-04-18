import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { haversineMiles } from '@/lib/utils/geo';
import { isEligibleForInPerson } from '@/lib/licensure/stateMatrix';
import type { CertificationType } from '@/types';

/**
 * Scored matching — Feature #17 Priority Dispatch.
 *
 * Hard filters:
 *   - has the required specialization
 *   - has no conflicting booking for the requested time window
 *   - is not in the `blocked_interpreter_ids` for this deaf user
 *   - is not in the exclude list (already declined / previously dispatched)
 *
 * Score (higher is better):
 *   +50  exact specialization match
 *   +(avg_rating * 10), cap 50
 *   -(distance_miles * 0.5)
 *   +30  in user's favorites
 *   +20  gender matches user preference
 *   +priority_score (calibrated nightly from completion/rating/no-show)
 *   -15  per pending offer the interpreter already has (fairness)
 *
 * Preferences: passed in from the booking's snapshot to respect what the
 * user/business agreed to at booking time.
 */

export interface MatchResult {
  interpreterId: string;
  userId: string;
  score: number;
  distanceMiles: number;
}

export interface FindMatchInput {
  specialization: string;
  scheduledStart: string;
  scheduledEnd: string;
  excludeInterpreterIds?: string[];
  deafUserId?: string | null;
  preferences?: Record<string, unknown> | null;
  /** Target location for distance scoring (in-person bookings). */
  targetLat?: number | null;
  targetLng?: number | null;
  /** State of service — used to enforce state-licensure rules for in-person. */
  serviceState?: string | null;
  /** Whether this booking is in-person (licensure matters) or VRI (warn-only). */
  isInPerson?: boolean;
  /** If provided, returns top-N instead of top-1. */
  topN?: number;
}

interface InterpreterRow {
  id: string;
  user_id: string;
  specializations: string[];
  avg_rating: number;
  priority_score: number;
  current_lat: number | null;
  current_lng: number | null;
  gender: string | null;
  service_radius_miles: number;
  is_accepting_offers: boolean;
}

function svc(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function findAvailableInterpreter(
  input: FindMatchInput,
): Promise<MatchResult | null> {
  const matches = await findMatchCandidates({ ...input, topN: 1 });
  return matches[0] ?? null;
}

export async function findMatchCandidates(
  input: FindMatchInput,
): Promise<MatchResult[]> {
  const supabase = svc();
  const prefs = (input.preferences || {}) as Record<string, unknown>;
  const blockedIds = Array.isArray(prefs.blocked_interpreter_ids)
    ? (prefs.blocked_interpreter_ids as string[])
    : [];
  const favoriteIds = Array.isArray(prefs.preferred_interpreter_ids)
    ? (prefs.preferred_interpreter_ids as string[])
    : [];
  const preferredGenders = Array.isArray(prefs.preferred_gender)
    ? (prefs.preferred_gender as string[])
    : [];
  const exclude = new Set<string>([
    ...(input.excludeInterpreterIds ?? []),
    ...blockedIds,
  ]);

  const { data: interpreters, error } = await supabase
    .from('interpreter_profiles')
    .select('id, user_id, specializations, avg_rating, priority_score, current_lat, current_lng, gender, service_radius_miles, is_accepting_offers')
    .contains('specializations', [input.specialization])
    .eq('is_accepting_offers', true);

  if (error || !interpreters || interpreters.length === 0) return [];

  // Filter scheduling conflicts in parallel (bounded by list size).
  const candidates = (interpreters as InterpreterRow[]).filter((i) => !exclude.has(i.id));
  if (candidates.length === 0) return [];

  const withConflicts = await Promise.all(
    candidates.map(async (c) => {
      const { data: conflicts } = await supabase
        .from('bookings')
        .select('id')
        .eq('interpreter_id', c.id)
        .in('status', ['confirmed', 'interpreter_en_route', 'in_progress', 'offered'])
        .lt('scheduled_start', input.scheduledEnd)
        .gt('scheduled_end', input.scheduledStart)
        .limit(1);
      return conflicts && conflicts.length > 0 ? null : c;
    }),
  );
  const available = withConflicts.filter((c): c is InterpreterRow => c !== null);
  if (available.length === 0) return [];

  // State licensure filter (hard gate for in-person in licensure states).
  let stateFiltered = available;
  if (input.isInPerson && input.serviceState) {
    const interpIds = available.map((c) => c.id);
    const { data: certRows } = await supabase
      .from('certifications')
      .select('interpreter_id, cert_type, valid_in_states, verification_status')
      .in('interpreter_id', interpIds)
      .eq('verification_status', 'verified');
    const certsByInterp = new Map<string, Array<{ cert_type: CertificationType; valid_in_states: string[] | null }>>();
    for (const row of certRows ?? []) {
      const interpreterId = row.interpreter_id as string;
      const list = certsByInterp.get(interpreterId) ?? [];
      list.push({
        cert_type: row.cert_type as CertificationType,
        valid_in_states: (row.valid_in_states as string[] | null) ?? [],
      });
      certsByInterp.set(interpreterId, list);
    }
    stateFiltered = available.filter((c) => {
      const certs = certsByInterp.get(c.id) ?? [];
      return isEligibleForInPerson(certs, input.serviceState!);
    });
  }
  if (stateFiltered.length === 0) return [];

  // Count pending offers per interpreter for fairness penalty.
  const interpIds = stateFiltered.map((c) => c.id);
  const { data: pendingOffers } = await supabase
    .from('booking_offers')
    .select('interpreter_id')
    .in('interpreter_id', interpIds)
    .eq('status', 'pending');
  const pendingCounts = new Map<string, number>();
  for (const row of pendingOffers ?? []) {
    const count = pendingCounts.get(row.interpreter_id) || 0;
    pendingCounts.set(row.interpreter_id, count + 1);
  }

  // Score everyone.
  const scored: MatchResult[] = stateFiltered.map((c) => {
    let score = 0;
    // Specialization match (we already filtered via contains, so +50 is implicit)
    score += 50;
    // Rating bonus
    score += Math.min(Number(c.avg_rating) * 10, 50);
    // Priority
    score += Number(c.priority_score);
    // Favorites
    if (favoriteIds.includes(c.id)) score += 30;
    // Gender match
    if (preferredGenders.length > 0 && c.gender && preferredGenders.includes(c.gender)) {
      score += 20;
    }
    // Fairness: pending offers penalty
    const pending = pendingCounts.get(c.id) || 0;
    score -= pending * 15;
    // Distance (if both ends known)
    let distanceMiles = 0;
    if (
      input.targetLat !== null && input.targetLat !== undefined &&
      input.targetLng !== null && input.targetLng !== undefined &&
      c.current_lat !== null && c.current_lng !== null
    ) {
      distanceMiles = haversineMiles(
        { lat: input.targetLat, lng: input.targetLng },
        { lat: c.current_lat, lng: c.current_lng },
      );
      score -= distanceMiles * 0.5;
      // Hard cap: if outside service radius, heavy penalty but still eligible
      if (distanceMiles > c.service_radius_miles) score -= 100;
    }
    return {
      interpreterId: c.id,
      userId: c.user_id,
      score: Math.round(score * 100) / 100,
      distanceMiles: Math.round(distanceMiles * 10) / 10,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const topN = input.topN ?? 1;
  return scored.slice(0, topN);
}
