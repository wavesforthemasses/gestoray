import { describe, it, expect } from 'vitest';
import { hasAccess } from './authCheck';

describe('RBAC Access Control (hasAccess)', () => {
  it('should grant access to superadmin for any allowed roles list containing superadmin', () => {
    expect(hasAccess('superadmin', ['superadmin', 'commerciale'])).toBe(true);
  });

  it('should deny access to tecnico when role is not in allowed list', () => {
    expect(hasAccess('tecnico', ['superadmin', 'amministrazione'])).toBe(false);
  });

  it('should grant access when user role is included in allowed list', () => {
    expect(hasAccess('commerciale', ['commerciale', 'direzione'])).toBe(true);
  });

  it('should deny access for undefined or empty role', () => {
    expect(hasAccess('', ['superadmin'])).toBe(false);
    expect(hasAccess(undefined, ['superadmin'])).toBe(false);
  });
});
