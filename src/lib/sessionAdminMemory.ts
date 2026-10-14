/**
 * In-memory registry of UIDs that have been successfully verified and approved as
 * administrators earlier in the CURRENT browser tab session.
 *
 * CRITICAL SECURITY CONSTRAINTS:
 * - In-memory only (Set<string>). NEVER stored in localStorage or sessionStorage.
 * - Never assume an admin role from a fallback profile unless the profile came from
 *   Firestore's cache AND the user was already an approved admin earlier in the same tab session.
 * - Cleared completely on sign-out, idle timeout, and maximum session expiry.
 */

const sessionApprovedAdmins = new Set<string>();

/**
 * Record that a user with the given UID has been confirmed as an approved admin
 * from a live or valid Firestore read in the current browser tab session.
 */
export function recordSessionApprovedAdmin(uid: string): void {
  if (uid) {
    sessionApprovedAdmins.add(uid);
  }
}

/**
 * Check whether a user was already confirmed as an approved admin in this session.
 */
export function wasSessionApprovedAdmin(uid: string): boolean {
  return uid ? sessionApprovedAdmins.has(uid) : false;
}

/**
 * Clear the in-memory admin flag registry on sign-out, idle timeout, or expiry.
 */
export function clearSessionApprovedAdmins(): void {
  sessionApprovedAdmins.clear();
}
