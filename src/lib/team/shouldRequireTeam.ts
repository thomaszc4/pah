import type { Specialization, OrgType } from '@/types';

/**
 * Decides whether a booking should require a team of two interpreters
 * under RID Standard Practice Paper + ADA effective-communication guidance.
 *
 * - Hard: duration > 120 min, or legal/depo/court regardless of duration,
 *   or deaf_blind (tactile relief required), or trilingual (cognitive load).
 * - Soft (prompt but optional): duration 60–120 min, mental_health,
 *   complex medical settings.
 */
export interface TeamTriggerInput {
  specialization: Specialization;
  durationMinutes: number;
  orgType?: OrgType | null;
}

export interface TeamTriggerResult {
  required: boolean;       // hard requirement
  recommended: boolean;    // soft prompt
  reasons: string[];
}

export function evaluateTeamRequirement(input: TeamTriggerInput): TeamTriggerResult {
  const reasons: string[] = [];
  let required = false;
  let recommended = false;

  // Hard triggers
  if (input.durationMinutes > 120) {
    required = true;
    reasons.push('Sessions longer than 2 hours require a team of 2 interpreters for accuracy.');
  }
  if (input.specialization === 'legal' || input.orgType === 'legal') {
    required = true;
    reasons.push('Legal proceedings require a team (RID Legal Standard Practice Paper).');
  }
  if (input.specialization === 'deaf_blind') {
    required = true;
    reasons.push('Deaf-Blind / ProTactile work requires a team for tactile relief.');
  }
  if (input.specialization === 'trilingual') {
    required = true;
    reasons.push('Trilingual (ASL-English-Spanish) work requires a team.');
  }

  // Soft triggers
  if (!required) {
    if (input.durationMinutes > 60) {
      recommended = true;
      reasons.push('Sessions longer than 1 hour benefit from a team of 2.');
    }
    if (input.specialization === 'mental_health') {
      recommended = true;
      reasons.push('Mental-health sessions often benefit from a team.');
    }
    if (input.specialization === 'medical' && input.durationMinutes > 60) {
      recommended = true;
      reasons.push('Long medical sessions benefit from a team.');
    }
  }

  return { required, recommended, reasons };
}
