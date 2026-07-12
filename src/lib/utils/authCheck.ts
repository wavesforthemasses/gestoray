/**
 * Utility to check if a user role is allowed to access a route.
 * Returns true if allowed, false otherwise.
 */
export function hasAccess(userRole: string | null | undefined, allowedRoles: string[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}
