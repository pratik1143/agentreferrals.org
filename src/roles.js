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

export function isProfessionalRole(role) {
  // Keep accounts created by the original prototype working during migration.
  return role === PLATFORM_ROLES.PROFESSIONAL || role === 'professional';
}
