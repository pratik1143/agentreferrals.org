// Platform roles are intentionally small. Referral participation (referring,
// receiving, applicant, owner) is determined by each referral relationship.
export const PLATFORM_ROLES = Object.freeze({
  PROFESSIONAL: 'PROFESSIONAL',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
});

// Scoped roles are reserved for later organization and verification workflows.
export const FUTURE_SCOPED_ROLES = Object.freeze({
  BROKERAGE_ADMIN: 'BROKERAGE_ADMIN',
  VERIFICATION_REVIEWER: 'VERIFICATION_REVIEWER',
});

// Professional verification is paused: finishing profile onboarding opens the
// dashboard. The verification screens and admin review remain in place; set
// this to true (and restore the matching checks in firestore.rules and
// functions/index.mjs) to require admin approval again.
export const PROFESSIONAL_VERIFICATION_REQUIRED = false;

export function hasPlatformAccess(profile) {
  if (String(profile?.verificationStatus || '').toLowerCase() === 'approved') return true;
  return !PROFESSIONAL_VERIFICATION_REQUIRED && (profile?.onboardingCompleted === true || Boolean(profile?.verificationSubmittedAt));
}

export function isProfessionalRole(role) {
  // Keep accounts created by the original prototype working during migration.
  return role === PLATFORM_ROLES.PROFESSIONAL || role === 'professional';
}
