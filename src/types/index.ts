// ============================================================
// PAH — Core Type Definitions
// ============================================================

// --- Enums ---

export type UserRole = 'deaf_user' | 'interpreter' | 'business_admin';

export type ExperienceTier = 'provisional' | 'certified' | 'advanced' | 'expert';

export type Specialization = 'general' | 'medical' | 'legal' | 'educational' | 'mental_health';

export type CertificationType =
  | 'RID_NIC'
  | 'RID_NIC_ADVANCED'
  | 'RID_NIC_MASTER'
  | 'RID_CDI'
  | 'BEI_BASIC'
  | 'BEI_ADVANCED'
  | 'BEI_MASTER'
  | 'CCHI_CORE'
  | 'CCHI_PERFORMANCE'
  | 'NBCMI_CMI'
  | 'STATE_LICENSE'
  | 'OTHER';

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'expired';

export type OrgType = 'medical' | 'legal' | 'educational' | 'government' | 'corporate' | 'other';

export type BookingType = 'scheduled' | 'urgent' | 'on_demand';

export type BookingStatus =
  | 'pending'
  | 'matching'
  | 'offered'
  | 'confirmed'
  | 'interpreter_en_route'
  | 'in_progress'
  | 'completed'
  | 'billed'
  | 'cancelled'
  | 'no_match'
  | 'disputed';

export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'transferred'
  | 'refunded'
  | 'failed';

export type LocationType = 'in_person' | 'vri';

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'expired';

// --- Database Row Types ---

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  roles: UserRole[];
  preferred_language: string;
  created_at: string;
  updated_at: string;
}

export interface InterpreterProfile {
  id: string;
  user_id: string;
  stripe_connect_account_id: string | null;
  stripe_onboarding_complete: boolean;
  bio: string | null;
  years_experience: number;
  experience_tier: ExperienceTier;
  hourly_rate_cents: number; // what PAH pays them
  specializations: Specialization[];
  certifications_verified: boolean;
  service_radius_miles: number;
  is_available: boolean;
  current_lat: number | null;
  current_lng: number | null;
  last_location_update: string | null;
  avg_rating: number;
  total_jobs: number;
  total_earnings_cents: number;
  round_robin_score: number;
  google_calendar_token_enc: string | null;
  google_calendar_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Certification {
  id: string;
  interpreter_id: string;
  cert_type: CertificationType;
  cert_number: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  document_url: string | null;
  verification_status: VerificationStatus;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  org_type: OrgType;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  stripe_customer_id: string | null;
  payment_method_on_file: boolean;
  hipaa_baa_signed: boolean;
  hipaa_baa_signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  org_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
}

export interface Booking {
  id: string;
  deaf_user_id: string | null;
  interpreter_id: string | null;
  organization_id: string | null;
  requested_by: string;
  booking_type: BookingType;
  specialization_required: Specialization;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  location_type: LocationType;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  status: BookingStatus;
  base_rate_cents: number;
  rush_multiplier: number;
  estimated_duration_minutes: number;
  actual_duration_minutes: number | null;
  wait_time_minutes: number;
  total_charge_cents: number | null;
  interpreter_payout_cents: number | null;
  platform_fee_cents: number | null;
  stripe_payment_intent_id: string | null;
  stripe_transfer_id: string | null;
  payment_status: PaymentStatus;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  cancellation_fee_cents: number;
  dedup_key: string | null;
  merged_from_booking_id: string | null;
  public_notes: string | null;
  interpreter_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingOffer {
  id: string;
  booking_id: string;
  interpreter_id: string;
  offer_order: number;
  status: OfferStatus;
  offered_at: string;
  responded_at: string | null;
  expires_at: string;
  decline_reason: string | null;
  match_score: number;
  distance_miles: number;
}

export interface Rating {
  id: string;
  booking_id: string;
  rated_by: string;
  rated_user: string;
  rating: number;
  review_text: string | null;
  is_visible: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AvailabilityWindow {
  id: string;
  interpreter_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
  specific_date: string | null;
  created_at: string;
}

export interface PlatformConfig {
  key: string;
  value: unknown;
  updated_at: string;
}

// --- Tier System ---

// Maps certification type to a "weight" for tier calculation
export const CERT_WEIGHTS: Record<CertificationType, number> = {
  RID_NIC_MASTER: 100,
  RID_NIC_ADVANCED: 90,
  RID_CDI: 90,
  RID_NIC: 75,
  BEI_MASTER: 85,
  BEI_ADVANCED: 70,
  BEI_BASIC: 50,
  CCHI_PERFORMANCE: 65,
  CCHI_CORE: 55,
  NBCMI_CMI: 60,
  STATE_LICENSE: 40,
  OTHER: 20,
};

// Tier thresholds based on composite score (cert weight + years)
export const TIER_THRESHOLDS: { tier: ExperienceTier; minScore: number; hourlyRateCents: number }[] = [
  { tier: 'expert', minScore: 150, hourlyRateCents: 7200 },    // $72/hr
  { tier: 'advanced', minScore: 100, hourlyRateCents: 6200 },   // $62/hr
  { tier: 'certified', minScore: 60, hourlyRateCents: 5200 },   // $52/hr
  { tier: 'provisional', minScore: 0, hourlyRateCents: 4200 },  // $42/hr
];

// What businesses pay (flat rate regardless of interpreter tier)
export const PLATFORM_RATES = {
  in_person_hourly_cents: 8500, // $85/hr — slightly below agency $100-125/hr
  vri_hourly_cents: 5500,       // $55/hr — below agency $60-100/hr
  minimum_hours_in_person: 2,
  minimum_hours_vri: 1,
  rush_threshold_hours: 24,
  rush_multiplier: 1.5,
  wait_time_multiplier: 0.5,
  cancellation_full_charge_hours: 24,
  cancellation_half_charge_hours: 48,
} as const;
