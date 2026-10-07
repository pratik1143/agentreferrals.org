import test from 'node:test';
import assert from 'node:assert/strict';
import { can, MODULES, PERMISSIONS, ROLES, rolePermissions } from './permissions.mjs';

test('professionals have no administrative permissions', () => {
  for (const permission of Object.values(PERMISSIONS)) assert.equal(can(ROLES.PROFESSIONAL, permission), false);
});

test('administrators have operational access without system control', () => {
  assert.equal(can(ROLES.ADMIN, 'VERIFICATION_APPROVE'), true);
  assert.equal(can(ROLES.ADMIN, 'REFERRALS_MODERATE'), true);
  assert.equal(can(ROLES.ADMIN, 'ADMINS_MANAGE'), false);
  assert.equal(can(ROLES.ADMIN, 'SYSTEM_SETTINGS_MANAGE'), false);
});

test('super admins inherit admin permissions and system permissions', () => {
  for (const permission of rolePermissions(ROLES.ADMIN)) assert.equal(can(ROLES.SUPER_ADMIN, permission), true);
  assert.equal(can(ROLES.SUPER_ADMIN, 'ADMINS_MANAGE'), true);
});

test('every admin module requires a known permission', () => {
  for (const module of MODULES) assert.ok(Object.hasOwn(PERMISSIONS, module.permission), module.path);
});
