import { createClient } from '@supabase/supabase-js';
import { haversineMiles } from '@/lib/utils/geo';

export interface FeedJob {
  id: string;
  specialization_required: string;
  location_type: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  estimated_duration_minutes: number;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  interpreter_payout_cents: number | null;
  distance_miles: number | null;
  is_rush: boolean;
  client_name: string | null;
  booking_type: string;
}

export interface FeedInput {
  interpreterId: string;
  interpreterUserId: string;
  specializations: string[];
  currentLat: number | null;
  currentLng: number | null;
  serviceRadius: number;
  windowDays: number;
}

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * Returns available / unclaimed jobs for the interpreter in the given window.
 * Applies: specialization match, within service radius (if location known),
 * not already declined by this interpreter, not in scheduling conflict.
 */
export async function generateFeed(input: FeedInput): Promise<FeedJob[]> {
  const supabase = svc();

  const now = new Date();
  const end = new Date(now.getTime() + input.windowDays * 24 * 60 * 60 * 1000);

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, specialization_required, location_type, scheduled_start, scheduled_end, estimated_duration_minutes, address_line1, city, state, lat, lng, total_charge_cents, booking_type, client_name')
    .in('status', ['matching', 'no_match'])
    .gte('scheduled_start', now.toISOString())
    .lte('scheduled_start', end.toISOString())
    .in('specialization_required', input.specializations);

  if (!bookings || bookings.length === 0) return [];

  // Exclude bookings this interpreter has already declined or been offered.
  const { data: declinedOffers } = await supabase
    .from('booking_offers')
    .select('booking_id')
    .eq('interpreter_id', input.interpreterId);
  const excludeIds = new Set((declinedOffers || []).map((o) => o.booking_id));

  // Conflict-check against interpreter's confirmed bookings.
  const { data: confirmed } = await supabase
    .from('bookings')
    .select('scheduled_start, scheduled_end')
    .eq('interpreter_id', input.interpreterId)
    .in('status', ['confirmed', 'interpreter_en_route', 'in_progress', 'offered']);

  function hasConflict(start: string, endTs: string): boolean {
    return (confirmed || []).some((b) => {
      if (!b.scheduled_start || !b.scheduled_end) return false;
      return b.scheduled_start < endTs && b.scheduled_end > start;
    });
  }

  const rushThresholdMs = 24 * 60 * 60 * 1000;

  const feed: FeedJob[] = bookings
    .filter((b) => !excludeIds.has(b.id))
    .filter((b) => {
      if (!b.scheduled_start || !b.scheduled_end) return true;
      return !hasConflict(b.scheduled_start, b.scheduled_end);
    })
    .map((b) => {
      let distance: number | null = null;
      if (
        b.lat !== null && b.lng !== null &&
        input.currentLat !== null && input.currentLng !== null
      ) {
        distance = haversineMiles(
          { lat: input.currentLat, lng: input.currentLng },
          { lat: Number(b.lat), lng: Number(b.lng) },
        );
      }
      const startMs = b.scheduled_start ? new Date(b.scheduled_start).getTime() : 0;
      const isRush = startMs > 0 && startMs - Date.now() < rushThresholdMs;
      return {
        id: b.id,
        specialization_required: b.specialization_required,
        location_type: b.location_type,
        scheduled_start: b.scheduled_start,
        scheduled_end: b.scheduled_end,
        estimated_duration_minutes: b.estimated_duration_minutes,
        address_line1: b.address_line1,
        city: b.city,
        state: b.state,
        interpreter_payout_cents: b.total_charge_cents, // simplified display
        distance_miles: distance !== null ? Math.round(distance * 10) / 10 : null,
        is_rush: isRush,
        client_name: b.client_name,
        booking_type: b.booking_type,
      } satisfies FeedJob;
    })
    // Radius filter (if we know location and distance)
    .filter((b) => b.distance_miles === null || b.distance_miles <= input.serviceRadius)
    // Sort nearest+soonest first
    .sort((a, b) => {
      const dA = a.distance_miles ?? 9999;
      const dB = b.distance_miles ?? 9999;
      if (Math.abs(dA - dB) > 5) return dA - dB;
      return (a.scheduled_start || '').localeCompare(b.scheduled_start || '');
    });

  return feed;
}
