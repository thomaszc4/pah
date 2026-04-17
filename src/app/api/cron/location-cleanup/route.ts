import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Daily cron — deletes interpreter_locations older than 24 hours after
 * the booking ended. Privacy guardrail per plan.
 */

function verifyCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const header = request.headers.get('authorization') || '';
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!verifyCron(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Delete locations for bookings that ended more than 24h ago.
  const { data: oldBookings } = await service
    .from('bookings')
    .select('id')
    .in('status', ['completed', 'cancelled', 'billed'])
    .lt('actual_end', cutoff);

  if (!oldBookings || oldBookings.length === 0) {
    return NextResponse.json({ ok: true, deleted_booking_count: 0 });
  }

  const ids = oldBookings.map((b: { id: string }) => b.id);
  const { error } = await service
    .from('interpreter_locations')
    .delete()
    .in('booking_id', ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted_booking_count: ids.length });
}
