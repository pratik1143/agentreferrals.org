export const ROLES = Object.freeze({ PROFESSIONAL: 'PROFESSIONAL', ADMIN: 'ADMIN', SUPER_ADMIN: 'SUPER_ADMIN' });

export const PERMISSIONS = Object.freeze({
  USERS_VIEW: 'USERS_VIEW', USERS_EDIT: 'USERS_EDIT', USERS_SUSPEND: 'USERS_SUSPEND', USERS_REACTIVATE: 'USERS_REACTIVATE',
  PROFESSIONALS_VIEW: 'PROFESSIONALS_VIEW', PROFESSIONALS_EDIT: 'PROFESSIONALS_EDIT',
  BROKERAGES_VIEW: 'BROKERAGES_VIEW', BROKERAGES_EDIT: 'BROKERAGES_EDIT',
  VERIFICATION_VIEW: 'VERIFICATION_VIEW', VERIFICATION_REVIEW: 'VERIFICATION_REVIEW', VERIFICATION_APPROVE: 'VERIFICATION_APPROVE', VERIFICATION_REJECT: 'VERIFICATION_REJECT',
  REFERRALS_VIEW: 'REFERRALS_VIEW', REFERRALS_REVIEW: 'REFERRALS_REVIEW', REFERRALS_EDIT: 'REFERRALS_EDIT', REFERRALS_MODERATE: 'REFERRALS_MODERATE', REFERRALS_CANCEL: 'REFERRALS_CANCEL',
  APPLICATIONS_VIEW: 'APPLICATIONS_VIEW', APPLICATIONS_MONITOR: 'APPLICATIONS_MONITOR',
  AGREEMENTS_VIEW: 'AGREEMENTS_VIEW', AGREEMENTS_MONITOR: 'AGREEMENTS_MONITOR',
  AGREEMENTS_MANAGE: 'AGREEMENTS_MANAGE',
  NOTIFICATIONS_VIEW: 'NOTIFICATIONS_VIEW', NOTIFICATIONS_SEND: 'NOTIFICATIONS_SEND',
  SUPPORT_VIEW: 'SUPPORT_VIEW', SUPPORT_MANAGE: 'SUPPORT_MANAGE', REPORTS_VIEW: 'REPORTS_VIEW', AUDIT_LOGS_VIEW: 'AUDIT_LOGS_VIEW',
  CONTENT_VIEW: 'CONTENT_VIEW', CONTENT_MANAGE: 'CONTENT_MANAGE', SETTINGS_VIEW: 'SETTINGS_VIEW',
  ADMINS_VIEW: 'ADMINS_VIEW', ADMINS_MANAGE: 'ADMINS_MANAGE', ROLES_VIEW: 'ROLES_VIEW', ROLES_MANAGE: 'ROLES_MANAGE',
  PERMISSIONS_VIEW: 'PERMISSIONS_VIEW', SYSTEM_SETTINGS_VIEW: 'SYSTEM_SETTINGS_VIEW', SYSTEM_SETTINGS_MANAGE: 'SYSTEM_SETTINGS_MANAGE', SECURITY_VIEW: 'SECURITY_VIEW',
});

export const ADMIN_PERMISSIONS = Object.freeze([
  'USERS_VIEW','USERS_EDIT','USERS_SUSPEND','USERS_REACTIVATE','PROFESSIONALS_VIEW','PROFESSIONALS_EDIT',
  'BROKERAGES_VIEW','BROKERAGES_EDIT','VERIFICATION_VIEW','VERIFICATION_REVIEW','VERIFICATION_APPROVE','VERIFICATION_REJECT',
  'REFERRALS_VIEW','REFERRALS_REVIEW','REFERRALS_EDIT','REFERRALS_MODERATE','REFERRALS_CANCEL',
  'APPLICATIONS_VIEW','APPLICATIONS_MONITOR','AGREEMENTS_VIEW','AGREEMENTS_MONITOR',
  'NOTIFICATIONS_VIEW','NOTIFICATIONS_SEND','SUPPORT_VIEW','SUPPORT_MANAGE','REPORTS_VIEW','AUDIT_LOGS_VIEW',
  'CONTENT_VIEW','CONTENT_MANAGE','SETTINGS_VIEW',
]);
export const SUPER_ADMIN_PERMISSIONS = Object.freeze([...ADMIN_PERMISSIONS,
  'ADMINS_VIEW','ADMINS_MANAGE','ROLES_VIEW','ROLES_MANAGE','PERMISSIONS_VIEW','SYSTEM_SETTINGS_VIEW','SYSTEM_SETTINGS_MANAGE','SECURITY_VIEW','AGREEMENTS_MANAGE',
]);
export const rolePermissions = role => role === ROLES.SUPER_ADMIN ? SUPER_ADMIN_PERMISSIONS : role === ROLES.ADMIN ? ADMIN_PERMISSIONS : [];
export const can = (role, permission) => rolePermissions(role).includes(permission);

export const MODULES = Object.freeze([
  { path:'dashboard', label:'Dashboard', permission:'USERS_VIEW', collection:null },
  { path:'users', label:'Users', permission:'USERS_VIEW', collection:'users' },
  { path:'professionals', label:'Professionals', permission:'PROFESSIONALS_VIEW', collection:'users' },
  { path:'brokerages', label:'Brokerages', permission:'BROKERAGES_VIEW', collection:'brokerages' },
  { path:'verification', label:'Verification', permission:'VERIFICATION_VIEW', collection:'users' },
  { path:'referrals', label:'Referrals', permission:'REFERRALS_VIEW', collection:'referrals' },
  { path:'applications', label:'Applications', permission:'APPLICATIONS_VIEW', collection:'applications' },
  { path:'agreements', label:'Agreements', permission:'AGREEMENTS_VIEW', collection:'agreements' },
  { path:'notifications', label:'Notifications', permission:'NOTIFICATIONS_VIEW', collection:'notifications' },
  { path:'support', label:'Support', permission:'SUPPORT_VIEW', collection:'support_requests' },
  { path:'reports', label:'Reports', permission:'REPORTS_VIEW', collection:null },
  { path:'audit-logs', label:'Audit logs', permission:'AUDIT_LOGS_VIEW', collection:'audit_logs' },
  { path:'content', label:'Content', permission:'CONTENT_VIEW', collection:'content' },
  { path:'settings', label:'Settings', permission:'SETTINGS_VIEW', collection:null },
  { path:'admin-users', label:'Admin users', permission:'ADMINS_VIEW', collection:'users' },
  { path:'roles', label:'Roles', permission:'ROLES_VIEW', collection:null },
  { path:'permissions', label:'Permissions', permission:'PERMISSIONS_VIEW', collection:null },
  { path:'system-settings', label:'System settings', permission:'SYSTEM_SETTINGS_VIEW', collection:'system_settings' },
  { path:'security', label:'Security', permission:'SECURITY_VIEW', collection:'audit_logs' },
]);
