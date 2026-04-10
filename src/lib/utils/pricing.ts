import { PLATFORM_RATES } from '@/types';
import type { LocationType } from '@/types';

/**
 * Calculates what the business/client pays for a booking.
 * This is a FLAT rate — same regardless of interpreter experience.
 */
export function calculateClientCharge({
  locationType,
  durationMinutes,
  isRush,
  waitTimeMinutes = 0,
}: {
  locationType: LocationType;
  durationMinutes: number;
  isRush: boolean;
  waitTimeMinutes?: number;
}): {
  baseChargeCents: number;
  rushChargeCents: number;
  waitChargeCents: number;
  totalChargeCents: number;
  billedHours: number;
} {
  const isInPerson = locationType === 'in_person';
  const hourlyRate = isInPerson
    ? PLATFORM_RATES.in_person_hourly_cents
    : PLATFORM_RATES.vri_hourly_cents;
  const minHours = isInPerson
    ? PLATFORM_RATES.minimum_hours_in_person
    : PLATFORM_RATES.minimum_hours_vri;

  // Apply minimum hours
  const actualHours = durationMinutes / 60;
  const billedHours = Math.max(Math.ceil(actualHours), minHours);

  const baseChargeCents = billedHours * hourlyRate;

  // Rush multiplier applies to the entire charge
  const rushMultiplier = isRush ? PLATFORM_RATES.rush_multiplier : 1;
  const rushChargeCents = isRush
    ? Math.round(baseChargeCents * (rushMultiplier - 1))
    : 0;

  // Wait time at reduced rate
  const waitHours = waitTimeMinutes / 60;
  const waitChargeCents = Math.round(
    waitHours * hourlyRate * PLATFORM_RATES.wait_time_multiplier
  );

  const totalChargeCents = Math.round(
    baseChargeCents * rushMultiplier + waitChargeCents
  );

  return {
    baseChargeCents,
    rushChargeCents,
    waitChargeCents,
    totalChargeCents,
    billedHours,
  };
}

/**
 * Calculates what the interpreter gets paid for a booking.
 * Based on their tier rate, NOT the flat client rate.
 */
export function calculateInterpreterPayout({
  tierHourlyRateCents,
  durationMinutes,
  isRush,
  waitTimeMinutes = 0,
  locationType,
}: {
  tierHourlyRateCents: number;
  durationMinutes: number;
  isRush: boolean;
  waitTimeMinutes?: number;
  locationType: LocationType;
}): number {
  const isInPerson = locationType === 'in_person';
  const minHours = isInPerson
    ? PLATFORM_RATES.minimum_hours_in_person
    : PLATFORM_RATES.minimum_hours_vri;

  const actualHours = durationMinutes / 60;
  const billedHours = Math.max(Math.ceil(actualHours), minHours);

  const basePay = billedHours * tierHourlyRateCents;
  const rushMultiplier = isRush ? PLATFORM_RATES.rush_multiplier : 1;
  const waitPay = Math.round(
    (waitTimeMinutes / 60) * tierHourlyRateCents * PLATFORM_RATES.wait_time_multiplier
  );

  return Math.round(basePay * rushMultiplier + waitPay);
}

/**
 * Determines cancellation fee based on how far in advance the cancellation is.
 */
export function calculateCancellationFee({
  scheduledStart,
  cancelledAt,
  estimatedTotalCents,
}: {
  scheduledStart: Date;
  cancelledAt: Date;
  estimatedTotalCents: number;
}): { feeCents: number; percentage: number } {
  const hoursUntilStart =
    (scheduledStart.getTime() - cancelledAt.getTime()) / (1000 * 60 * 60);

  if (hoursUntilStart < PLATFORM_RATES.cancellation_full_charge_hours) {
    return { feeCents: estimatedTotalCents, percentage: 100 };
  }

  if (hoursUntilStart < PLATFORM_RATES.cancellation_half_charge_hours) {
    return { feeCents: Math.round(estimatedTotalCents * 0.5), percentage: 50 };
  }

  return { feeCents: 0, percentage: 0 };
}

/**
 * Checks if a booking qualifies for rush pricing.
 */
export function isRushBooking(scheduledStart: Date, bookedAt: Date = new Date()): boolean {
  const hoursUntilStart =
    (scheduledStart.getTime() - bookedAt.getTime()) / (1000 * 60 * 60);
  return hoursUntilStart < PLATFORM_RATES.rush_threshold_hours;
}
