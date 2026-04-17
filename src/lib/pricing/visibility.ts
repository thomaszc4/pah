import type { Booking, DeafUserPreferences } from '@/types';

/**
 * Decide whether to hide pricing from a Deaf user viewing a booking.
 *
 * Under ADA Title III, the Deaf individual may not be charged for interpreter
 * services in business contexts — so showing them the price is both confusing
 * and potentially harmful ("they'll think they owe this"). Hide by default
 * for business bookings; respect explicit preference.
 */
export function shouldHidePriceFromDeafUser(
  booking: Pick<Booking, 'booking_context' | 'organization_id'>,
  preferences?: Pick<DeafUserPreferences, 'hide_pricing_for_business'> | null,
): boolean {
  const isBusiness = booking.booking_context === 'business' || !!booking.organization_id;
  if (!isBusiness) return false;
  // Default: hide. Only show if user has explicitly opted in.
  return preferences?.hide_pricing_for_business !== false;
}

export function formatPriceForDeafUser(
  booking: Pick<Booking, 'booking_context' | 'organization_id' | 'total_charge_cents'>,
  opts: { orgName?: string | null } = {},
): string {
  if (shouldHidePriceFromDeafUser(booking)) {
    return opts.orgName
      ? `No charge to you — ${opts.orgName} is billed under the ADA`
      : 'No charge to you — the business is billed under the ADA';
  }
  const cents = booking.total_charge_cents ?? 0;
  return `$${(cents / 100).toFixed(2)}`;
}
