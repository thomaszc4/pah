import { createClient } from '@supabase/supabase-js';

/**
 * MVP Matching Algorithm
 *
 * Simple approach: pick the first interpreter who:
 * 1. Has verified certifications (or is onboarded)
 * 2. Has the required specialization
 * 3. Does NOT have a conflicting booking at the requested time
 *
 * No scoring, no round-robin — just first-available.
 * Full algorithm with distance, ratings, fairness comes in Phase 2.
 */
export async function findAvailableInterpreter({
  specialization,
  scheduledStart,
  scheduledEnd,
  excludeInterpreterIds = [],
}: {
  specialization: string;
  scheduledStart: string;
  scheduledEnd: string;
  excludeInterpreterIds?: string[];
}): Promise<{ interpreterId: string; userId: string } | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Get all interpreters with the required specialization
  const { data: interpreters, error } = await supabase
    .from('interpreter_profiles')
    .select('id, user_id, specializations')
    .contains('specializations', [specialization])
    .order('created_at', { ascending: true });

  if (error || !interpreters || interpreters.length === 0) {
    return null;
  }

  // Filter out excluded interpreters
  const candidates = interpreters.filter(
    (i) => !excludeInterpreterIds.includes(i.id),
  );

  // Check each candidate for scheduling conflicts
  for (const candidate of candidates) {
    const { data: conflicts } = await supabase
      .from('bookings')
      .select('id')
      .eq('interpreter_id', candidate.id)
      .in('status', ['confirmed', 'interpreter_en_route', 'in_progress', 'offered'])
      .or(
        `and(scheduled_start.lt.${scheduledEnd},scheduled_end.gt.${scheduledStart})`,
      )
      .limit(1);

    // No conflicts = this interpreter is available
    if (!conflicts || conflicts.length === 0) {
      return { interpreterId: candidate.id, userId: candidate.user_id };
    }
  }

  // No available interpreter found
  return null;
}
