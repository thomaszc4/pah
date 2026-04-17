// ============================================================
// PAH — Core Type Definitions
// ============================================================

// --- Enums ---

export type UserRole = 'deaf_user' | 'interpreter' | 'business_admin' | 'platform_admin';

export type ExperienceTier = 'provisional' | 'certified' | 'advanced' | 'expert';

export type Specialization =
  | 'general'
  | 'medical'
  | 'legal'
  | 'educational'
  | 'mental_health'
  | 'deaf_interpreter'
  | 'trilingual'
  | 'deaf_blind'
  | 'oral_transliterator'
  | 'religious'
  | 'performing_arts'
  | 'cart_captioning'
  | 'pediatric'
  | 'other';

export type CertificationType =
  | 'RID_NIC'
  | 'RID_NIC_ADVANCED'
  | 'RID_NIC_MASTER'
  | 'RID_CDI'
  | 'RID_SC_L'
  | 'RID_ED_K12'
  | 'RID_OTC'
  | 'BEI_BASIC'
  | 'BEI_ADVANCED'
  | 'BEI_MASTER'
  | 'BEI_COURT'
  | 'BEI_MEDICAL'
  | 'BEI_TRILINGUAL'
  | 'CCHI_CORE'
  | 'CCHI_PERFORMANCE'
  | 'NBCMI_CMI'
  | 'NBCDI'
  | 'QMHI'
  | 'DEAF_BLIND_CERT'
  | 'CART'
  | 'STATE_LICENSE'
  | 'OTHER';

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'expired';

export type OrgType = 'medical' | 'legal' | 'educational' | 'government' | 'corporate' | 'other';

export type BookingType = 'scheduled' | 'urgent' | 'on_demand';

export type BookingContext = 'personal' | 'emergency' | 'business';

export type BookingStatus =
  | 'pending'
  | 'pending_business_approval'
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

export type FallbackOption = 'wait' | 'vri' | 'reschedule' | 'cancel';

export type PayoutFrequency = 'per_job' | 'weekly' | 'biweekly';

export type Gender = 'female' | 'male' | 'non_binary' | 'prefer_not_to_say';

export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';

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
  headline: string | null;
  profile_photo_url: string | null;
  intro_video_url: string | null;
  intro_video_caption_url: string | null;
  intro_video_transcript: string | null;
  gender: Gender | null;
  pronouns: string | null;
  skills: string[];
  languages: string[];
  years_experience: number;
  experience_tier: ExperienceTier;
  hourly_rate_cents: number;
  specializations: Specialization[];
  certifications_verified: boolean;
  service_radius_miles: number;
  is_available: boolean;
  is_accepting_offers: boolean;
  current_lat: number | null;
  current_lng: number | null;
  last_location_update: string | null;
  avg_rating: number;
  total_jobs: number;
  no_show_count: number;
  completion_rate: number;
  total_earnings_cents: number;
  round_robin_score: number;
  priority_score: number;
  payout_frequency: PayoutFrequency;
  current_pay_period_cents: number;
  current_pay_period_start: string | null;
  google_calendar_token_enc: string | null;
  google_calendar_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Certification {
  id: string;
  interpreter_id: string;
  cert_type: CertificationType;
  cert_category: string | null;
  cert_other_description: string | null;
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
  default_session_minutes: number;
  ada_acknowledged_at: string | null;
  ada_acknowledged_by: string | null;
  ada_acknowledged_version: string | null;
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
  booking_context: BookingContext;
  specialization_required: Specialization;
  specialization_other_description: string | null;
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
  authorized_max_minutes: number | null;
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
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  emergency_attestation_signed_at: string | null;
  emergency_attestation_ip: string | null;
  emergency_attestation_name: string | null;
  emergency_attestation_token: string | null;
  emergency_attestation_version: string | null;
  emergency_fallback_charged: boolean;
  ada_notice_acknowledged_at: string | null;
  ada_notice_version: string | null;
  vri_warning_acknowledged: boolean;
  interpreter_eta_minutes: number | null;
  interpreter_en_route_at: string | null;
  interpreter_arrived_at: string | null;
  interpreter_accepted_at: string | null;
  interpreter_declined_at: string | null;
  interpreter_decline_reason: string | null;
  interpreter_preferences_snapshot: Record<string, unknown> | null;
  rematch_count: number;
  fallback_option_chosen: FallbackOption | null;
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
  video_feedback_url: string | null;
  tags: string[];
  would_rebook: boolean | null;
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

export interface NotificationDelivery {
  id: string;
  notification_id: string | null;
  user_id: string | null;
  channel: NotificationChannel;
  provider: string | null;
  provider_message_id: string | null;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced';
  error: string | null;
  sent_at: string;
  updated_at: string;
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

export interface DeafUserPreferences {
  user_id: string;
  preferred_gender: Gender[];
  preferred_specializations: Specialization[];
  preferred_interpreter_ids: string[];
  blocked_interpreter_ids: string[];
  prefers_location_type: 'in_person' | 'vri' | 'no_preference';
  notify_email: boolean;
  notify_sms: boolean;
  notify_push: boolean;
  intro_video_url: string | null;
  intro_video_caption_url: string | null;
  intro_video_transcript: string | null;
  hide_pricing_for_business: boolean;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  booking_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface InterpreterLocation {
  id: string;
  booking_id: string;
  interpreter_id: string;
  lat: number;
  lng: number;
  eta_minutes: number | null;
  recorded_at: string;
}

export interface BusinessRegistrationRequest {
  id: string;
  requested_by: string;
  business_name: string;
  business_type: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  reason: string | null;
  status: 'pending' | 'contacted' | 'registered' | 'declined';
  admin_notes: string | null;
  created_at: string;
}

// --- Tier System ---

export const CERT_WEIGHTS: Record<CertificationType, number> = {
  RID_NIC_MASTER: 100,
  RID_NIC_ADVANCED: 90,
  RID_CDI: 90,
  RID_SC_L: 95,          // Legal — premium
  RID_NIC: 75,
  RID_ED_K12: 70,
  RID_OTC: 60,
  BEI_MASTER: 85,
  BEI_COURT: 90,
  BEI_MEDICAL: 85,
  BEI_ADVANCED: 70,
  BEI_TRILINGUAL: 75,
  BEI_BASIC: 50,
  CCHI_PERFORMANCE: 65,
  CCHI_CORE: 55,
  NBCMI_CMI: 60,
  NBCDI: 80,
  QMHI: 65,
  DEAF_BLIND_CERT: 85,
  CART: 55,
  STATE_LICENSE: 40,
  OTHER: 20,
};

export const TIER_THRESHOLDS: { tier: ExperienceTier; minScore: number; hourlyRateCents: number }[] = [
  { tier: 'expert', minScore: 150, hourlyRateCents: 7200 },
  { tier: 'advanced', minScore: 100, hourlyRateCents: 6200 },
  { tier: 'certified', minScore: 60, hourlyRateCents: 5200 },
  { tier: 'provisional', minScore: 0, hourlyRateCents: 4200 },
];

export const PLATFORM_RATES = {
  in_person_hourly_cents: 8500,
  vri_hourly_cents: 5500,
  minimum_hours_in_person: 2,
  minimum_hours_vri: 1,
  rush_threshold_hours: 24,
  rush_multiplier: 1.5,
  wait_time_multiplier: 0.5,
  cancellation_full_charge_hours: 24,
  cancellation_half_charge_hours: 48,
} as const;

// --- Human-readable labels ---

export const SPECIALIZATION_LABELS: Record<Specialization, string> = {
  general: 'General',
  medical: 'Medical',
  legal: 'Legal / Court',
  educational: 'Educational (K-12, Higher Ed)',
  mental_health: 'Mental Health',
  deaf_interpreter: 'Deaf Interpreter (CDI)',
  trilingual: 'Trilingual (ASL-English-Spanish)',
  deaf_blind: 'Deaf-Blind / ProTactile',
  oral_transliterator: 'Oral Transliterator',
  religious: 'Religious',
  performing_arts: 'Performing Arts',
  cart_captioning: 'CART / Captioning',
  pediatric: 'Pediatric',
  other: 'Other',
};

export const CERT_LABELS: Record<CertificationType, string> = {
  RID_NIC: 'RID NIC',
  RID_NIC_ADVANCED: 'RID NIC Advanced',
  RID_NIC_MASTER: 'RID NIC Master',
  RID_CDI: 'RID CDI (Deaf Interpreter)',
  RID_SC_L: 'RID SC:L (Legal)',
  RID_ED_K12: 'RID Ed:K-12',
  RID_OTC: 'RID OTC (Oral)',
  BEI_BASIC: 'BEI Basic',
  BEI_ADVANCED: 'BEI Advanced',
  BEI_MASTER: 'BEI Master',
  BEI_COURT: 'BEI Court',
  BEI_MEDICAL: 'BEI Medical',
  BEI_TRILINGUAL: 'BEI Trilingual',
  CCHI_CORE: 'CCHI CoreCHI',
  CCHI_PERFORMANCE: 'CCHI CHI',
  NBCMI_CMI: 'NBCMI CMI',
  NBCDI: 'NBCDI',
  QMHI: 'QMHI (Mental Health)',
  DEAF_BLIND_CERT: 'Deaf-Blind Certification',
  CART: 'CART Certified',
  STATE_LICENSE: 'State License',
  OTHER: 'Other',
};
