import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  reauthenticateWithCredential,
  updatePassword,
  EmailAuthProvider,
  fetchSignInMethodsForEmail,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocFromCache,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  Unsubscribe,
  orderBy,
  limit,
  arrayUnion,
  deleteDoc,
  terminate,
  clearIndexedDbPersistence,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import {
  OrgUser,
  AuditLogEntry,
  UserRole,
  ChatMessage,
  DirectoryUser,
  MessageStatus,
  AttachedFile,
  ReportDoc,
  HistoryRequest,
  MessageReplyTo,
  ChannelDoc,
  MeetingDoc,
  MyMeetingDoc,
  MeetingRsvpStatus,
} from '../types';
import { normalizeChannelId } from './channelAvatars';

export { auth, db, Timestamp };

/**
 * Extract Firestore Timestamp for a user's channel historyFrom setting.
 * Defaults to Timestamp.fromMillis(0) ("Full history") if no entry exists.
 */
export function getChannelHistoryFromTimestamp(
  historyFromMap: Record<string, any> | undefined,
  channelId: string
): Timestamp {
  if (!historyFromMap) {
    return Timestamp.fromMillis(0);
  }
  const normId = normalizeChannelId(channelId);
  const entry = historyFromMap[normId] || historyFromMap[channelId];
  if (!entry) {
    return Timestamp.fromMillis(0);
  }
  if (entry instanceof Timestamp) {
    return entry;
  }
  if (typeof entry?.toMillis === 'function') {
    return Timestamp.fromMillis(entry.toMillis());
  }
  if (typeof entry?.seconds === 'number') {
    return new Timestamp(entry.seconds, entry.nanoseconds || 0);
  }
  return Timestamp.fromMillis(0);
}

/**
 * Format friendly authentication error message.
 * Returns null if the user simply dismissed or closed the popup.
 */
export function formatAuthError(err: any): string | null {
  const code = err?.code;

  // Expected user dismissals - do not log as an error
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return null;
  }

  console.warn('Firebase Auth:', code, err?.message);

  if (code === 'auth/popup-blocked') {
    return 'The sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not authorized for OAuth operations. Please verify domain authorization in Firebase Console.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network request failed. Please check your internet connection and try again.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many requests. Please wait a few minutes and try again.';
  }
  return err?.message || 'Authentication failed. Please try again.';
}

/**
 * Parse any error (including Firestore JSON error info) into a clean user-facing message
 */
export function parseFriendlyError(err: any): string {
  if (!err) return 'An unexpected error occurred. Please try again.';
  const msg = err.message || String(err);

  if (
    msg.includes('resource-exhausted') ||
    msg.includes('The service is busy right now') ||
    err?.code === 'resource-exhausted'
  ) {
    return 'The service is busy right now. Please try again later.';
  }

  try {
    const parsed = JSON.parse(msg);
    if (parsed.errorCode === 'resource-exhausted' || parsed.error?.includes?.('resource-exhausted')) {
      return 'The service is busy right now. Please try again later.';
    }
    if (parsed.error) {
      if (parsed.error.includes('the client is offline')) {
        return 'Connecting to the database... Please try signing in again.';
      }
      if (parsed.error.includes('Missing or insufficient permissions')) {
        return 'Access restricted. Please ensure you are authorized.';
      }
      return parsed.error;
    }
  } catch (_) {
    // Not JSON
  }
  if (msg.includes('the client is offline')) {
    return 'Connecting to the database... Please try signing in again.';
  }
  if (msg.includes('Firestore operation') || msg.includes('users/')) {
    return 'A database error occurred. Please try again later.';
  }
  return msg;
}

/**
 * Google Sign-In with popup
 */
export async function signInWithGoogle(): Promise<{ user: FirebaseUser | null; error: string | null }> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null };
  } catch (err: any) {
    const message = formatAuthError(err);
    return { user: null, error: message };
  }
}

/**
 * Email and password sign-in for STAFF
 * Never reveals whether email exists. Shows single friendly error for wrong email/password.
 */
export async function signInWithStaffEmail(
  email: string,
  password: string
): Promise<{ user: FirebaseUser | null; error: string | null; googleHint?: boolean }> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return { user: cred.user, error: null };
  } catch (err: any) {
    const code = err?.code;
    console.warn('[Staff Email Login Error]', code);

    if (code === 'auth/too-many-requests') {
      return {
        user: null,
        error: 'Too many attempts. Please wait a few minutes and try again.',
      };
    }

    if (code === 'auth/network-request-failed') {
      return {
        user: null,
        error: 'Network error. Please check your internet connection.',
      };
    }

    // Check if user account was created via Google Sign-In
    let googleHint = false;
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email.trim());
      if (methods.includes('google.com') && !methods.includes('password')) {
        googleHint = true;
      }
    } catch {
      // ignore
    }

    return {
      user: null,
      error: 'Incorrect email or password',
      googleHint,
    };
  }
}

/**
 * Register a new staff user with email and password
 * Enforces creation of users/{uid} AFTER user is signed in, then sends verification email.
 */
export async function signUpWithStaffEmail(
  fullName: string,
  department: string,
  email: string,
  password: string
): Promise<{ user: FirebaseUser; profile: OrgUser }> {
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  } catch (err: any) {
    console.warn('[Staff Email SignUp Error]', err?.code);
    if (err?.code === 'auth/email-already-in-use') {
      throw new Error(
        'This email is already registered. Try logging in, or use Continue with Google if you signed up with Google.'
      );
    }
    if (err?.code === 'auth/too-many-requests') {
      throw new Error('Too many attempts. Please wait a few minutes and try again.');
    }
    if (err?.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw new Error('Could not create account. Please check your details and try again.');
  }

  // Update profile with full name
  try {
    await updateProfile(cred.user, { displayName: fullName.trim() });
  } catch (e) {
    console.warn('updateProfile note:', e);
  }

  // Create users/{uid} document strictly AFTER user is signed in
  const profile = await createStaffProfile(cred.user, fullName, department, 'password');

  // Send verification email
  try {
    await sendEmailVerification(cred.user);
  } catch (err: any) {
    console.warn('sendEmailVerification error:', err?.code, err);
    throw new Error('Could not send the verification email. Try again.');
  }

  return { user: cred.user, profile };
}

/**
 * Send password reset email
 * Always returns consistent success response, errors logged to console only.
 */
export async function sendStaffPasswordResetEmail(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (err: any) {
    console.warn('[Password Reset Error]', err?.code);
    // Never reveal whether email exists to user
  }
}

/**
 * Change user password (for password-provider users)
 * Reauthenticates with current password, then calls updatePassword.
 */
export async function changeStaffPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.email) {
    throw new Error('No active user session found.');
  }

  // Reauthenticate first
  try {
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
  } catch (err: any) {
    console.warn('[Change Password Reauth Error]', err?.code);
    if (
      err?.code === 'auth/wrong-password' ||
      err?.code === 'auth/invalid-credential'
    ) {
      throw new Error('Incorrect current password.');
    }
    if (err?.code === 'auth/too-many-requests') {
      throw new Error('Too many attempts. Please wait a few minutes and try again.');
    }
    throw new Error('Could not verify current password. Please try again.');
  }

  // Update password
  try {
    await updatePassword(currentUser, newPassword);
  } catch (err: any) {
    console.warn('[Update Password Error]', err?.code);
    if (err?.code === 'auth/requires-recent-login') {
      throw new Error('Session expired. Please sign in again.');
    }
    throw new Error('Could not update password. Please try again.');
  }
}

/**
 * Race a promise against a timeout (ms) to prevent infinite or multi-second network hangs.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number = 3000,
  timeoutErrorMsg: string = 'deadline-exceeded'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err: any = new Error(timeoutErrorMsg);
      err.code = 'deadline-exceeded';
      reject(err);
    }, ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export interface UserProfileResult {
  profile: OrgUser | null;
  fromCache: boolean;
  isBusy?: boolean;
}

/**
 * Get user profile from Firestore.
 * On resource-exhausted or transient network error, falls back ONLY to Firestore's getDocFromCache.
 * Never stores or reads profile data from browser storage (localStorage / sessionStorage).
 */
export async function getUserProfile(uid: string): Promise<UserProfileResult> {
  const path = `users/${uid}`;

  // 1. Try local Firestore cache first for instant load (< 5ms)
  try {
    const cachedSnap = await getDocFromCache(doc(db, 'users', uid));
    if (cachedSnap.exists()) {
      return { profile: cachedSnap.data() as OrgUser, fromCache: true };
    }
  } catch {}

  // 2. Fetch from network with a short 2500ms timeout
  try {
    const snap = await withTimeout(getDoc(doc(db, 'users', uid)), 2500, 'deadline-exceeded');
    if (snap.exists()) {
      return { profile: snap.data() as OrgUser, fromCache: false };
    }
    return { profile: null, fromCache: false };
  } catch (err: any) {
    const code = err?.code || (err instanceof Error ? err.message : String(err));
    const isResourceExhausted =
      code === 'resource-exhausted' || String(err).includes('resource-exhausted');
    const isTransient =
      isResourceExhausted ||
      code === 'unavailable' ||
      code === 'deadline-exceeded' ||
      code === 'network-request-failed';

    if (isTransient) {
      // 1. Fall back ONLY to Firestore's own offline IndexedDB persistence cache
      try {
        const cachedSnap = await getDocFromCache(doc(db, 'users', uid));
        if (cachedSnap.exists()) {
          return {
            profile: cachedSnap.data() as OrgUser,
            fromCache: true,
            isBusy: isResourceExhausted,
          };
        }
      } catch {}

      console.warn(`[Firestore getUserProfile notice] Remote service busy or unreachable (${code})`);
      return { profile: null, fromCache: false, isBusy: true };
    }

    // 2. For permission errors, log and throw
    if (code === 'permission-denied' || String(err).includes('permission')) {
      handleFirestoreError(err, OperationType.GET, path);
    }

    console.warn(`[Firestore getUserProfile notice] Error fetching profile (${code})`);
    return { profile: null, fromCache: false };
  }
}

/**
 * Create a staff user document for Google or Email Sign-In
 */
export async function createStaffProfile(
  user: FirebaseUser,
  fullName: string,
  department: string,
  authProvider: 'google' | 'password' = 'google'
): Promise<OrgUser> {
  const path = `users/${user.uid}`;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });

  const profile: OrgUser = {
    id: user.uid,
    fullName: fullName.trim() || user.displayName || 'Staff Member',
    email: (user.email || '').toLowerCase(),
    department: department || 'Operations',
    role: 'staff',
    status: 'pending',
    channels: [],
    authProvider,
    dateRegistered: dateStr,
  };

  try {
    await setDoc(doc(db, 'users', user.uid), {
      ...profile,
      createdAt: serverTimestamp(),
    });
    return profile;
  } catch (err: any) {
    const code = err?.code || (err instanceof Error ? err.message : String(err));
    if (code === 'resource-exhausted' || String(err).includes('resource-exhausted')) {
      console.warn('[Firestore createStaffProfile notice] Service busy during profile write');
      throw new Error('The service is busy right now. Please try again later.');
    }
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Bootstrap admin account for dmbogo20@gmail.com if no profile exists yet in Firestore.
 * Requires verified email (emailVerified === true).
 * Never assumes or synthesizes an admin profile in code if it cannot be read from or written to Firestore.
 */
export async function bootstrapAdminProfileIfNeeded(
  user: FirebaseUser
): Promise<{ profile: OrgUser | null; isBusy?: boolean }> {
  // Only for the bootstrap email and strictly when email is verified
  if (user.email?.toLowerCase() !== 'dmbogo20@gmail.com' || !user.emailVerified) {
    return { profile: null };
  }

  const path = `users/${user.uid}`;
  const adminProfile: OrgUser = {
    id: user.uid,
    fullName: user.displayName || 'D. Mbogo (Bootstrap Admin)',
    email: 'dmbogo20@gmail.com',
    department: 'Executive Governance & RBAC',
    role: 'admin',
    status: 'approved',
    channels: ['General', 'Finance Team', 'IT Support', 'Executive Board'],
    authProvider: 'google',
    dateRegistered: new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }),
  };

  // 1. Check local cache first for instant resolution
  try {
    const cachedSnap = await getDocFromCache(doc(db, 'users', user.uid));
    if (cachedSnap.exists()) {
      return { profile: cachedSnap.data() as OrgUser };
    }
  } catch {}

  // 2. Fetch or create via network with 2500ms timeout
  try {
    const snap = await withTimeout(getDoc(doc(db, 'users', user.uid)), 2500, 'deadline-exceeded');
    if (snap.exists()) {
      return { profile: snap.data() as OrgUser };
    }

    await withTimeout(
      setDoc(doc(db, 'users', user.uid), {
        ...adminProfile,
        createdAt: serverTimestamp(),
      }),
      3000,
      'deadline-exceeded'
    );

    return { profile: adminProfile };
  } catch (err: any) {
    const code = err?.code || (err instanceof Error ? err.message : String(err));
    const isResourceExhausted =
      code === 'resource-exhausted' || String(err).includes('resource-exhausted');
    const isTransient =
      isResourceExhausted ||
      code === 'unavailable' ||
      code === 'deadline-exceeded' ||
      code === 'network-request-failed';

    if (isTransient) {
      try {
        const cachedSnap = await getDocFromCache(doc(db, 'users', user.uid));
        if (cachedSnap.exists()) {
          return { profile: cachedSnap.data() as OrgUser };
        }
      } catch {}

      console.warn(`[Firestore bootstrap notice] Server busy or unreachable (${code})`);
      return { profile: null, isBusy: true };
    }

    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Global registry of all active Firestore listeners for clean session tear-down
const activeFirestoreListeners = new Set<() => void>();

export function registerActiveListener(unsub: () => void): Unsubscribe {
  activeFirestoreListeners.add(unsub);
  return () => {
    activeFirestoreListeners.delete(unsub);
    try {
      unsub();
    } catch {
      // ignore
    }
  };
}

export function unsubscribeAllActiveListeners(): void {
  for (const unsub of Array.from(activeFirestoreListeners)) {
    try {
      unsub();
    } catch (e) {
      console.warn('Error unsubscribing listener:', e);
    }
  }
  activeFirestoreListeners.clear();
}

/**
 * Clear local Firestore offline cache on device:
 * Terminate Firestore instance, then call clearIndexedDbPersistence.
 */
export async function clearOfflineFirestoreCache(): Promise<void> {
  try {
    await terminate(db);
  } catch (err) {
    console.warn('Terminate Firestore error:', err);
  }
  try {
    await clearIndexedDbPersistence(db);
  } catch (err) {
    console.warn('Clear IndexedDB persistence error:', err);
  }
}

/**
 * Subscribe to all users for admin governance
 */
export function subscribeToAllUsers(
  callback: (users: OrgUser[]) => void
): Unsubscribe {
  const colRef = collection(db, 'users');
  const unsub = onSnapshot(
    colRef,
    (snap) => {
      const all: OrgUser[] = [];
      snap.forEach((d) => all.push(d.data() as OrgUser));
      callback(all);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
    }
  );
  return registerActiveListener(unsub);
}

/**
 * Subscribe to audit logs (orderBy timestamp descending with limit)
 */
export function subscribeToAuditLogs(
  callback: (logs: AuditLogEntry[]) => void,
  limitCount: number = 100
): Unsubscribe {
  const colRef = collection(db, 'auditLogs');
  const q = query(colRef, orderBy('timestamp', 'desc'), limit(limitCount));
  const unsub = onSnapshot(
    q,
    (snap) => {
      const logs: (AuditLogEntry & { _time?: any })[] = [];
      snap.forEach((d) => {
        const data = d.data();
        logs.push({
          id: data.id || d.id,
          timestamp: data.timestamp || 'Just now',
          actor: data.actor || 'system',
          action: data.action || '',
          details: data.details || '',
          category: data.category || 'Auth',
          _time: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
        });
      });
      callback(logs);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'auditLogs');
    }
  );
  return registerActiveListener(unsub);
}

/**
 * Approve user in Firestore, optionally setting initial channel historyFrom timestamps
 */
export async function approveUserInFirestore(
  userId: string,
  role: UserRole,
  channels: string[],
  historyFrom?: Record<string, Timestamp>
): Promise<void> {
  const path = `users/${userId}`;
  try {
    const payload: any = {
      status: 'approved',
      role,
      channels: channels.length > 0 ? channels : ['General'],
      updatedAt: serverTimestamp(),
    };
    if (historyFrom) {
      payload.historyFrom = historyFrom;
    }
    await updateDoc(doc(db, 'users', userId), payload);
  } catch (err: any) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

/**
 * Reject user in Firestore
 */
export async function rejectUserInFirestore(userId: string): Promise<void> {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      status: 'rejected',
      updatedAt: serverTimestamp(),
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

/**
 * Update user role and channels in Firestore, preserving or updating historyFrom per-channel
 */
export async function updateUserRoleAndChannelsInFirestore(
  userId: string,
  role: UserRole,
  channels: string[],
  historyFromUpdates?: Record<string, Timestamp>
): Promise<void> {
  const path = `users/${userId}`;
  try {
    const payload: any = {
      role,
      channels: channels.length > 0 ? channels : ['General'],
      updatedAt: serverTimestamp(),
    };
    if (historyFromUpdates) {
      Object.entries(historyFromUpdates).forEach(([chId, ts]) => {
        const normId = normalizeChannelId(chId);
        payload[`historyFrom.${normId}`] = ts;
      });
    }
    await updateDoc(doc(db, 'users', userId), payload);
  } catch (err: any) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

/**
 * Update historyFrom for a specific channel on a user document using field-path updates
 * so other channels are not overwritten.
 */
export async function updateUserChannelHistoryFrom(
  userId: string,
  channelId: string,
  historyFromTimestamp: Timestamp
): Promise<void> {
  const normId = normalizeChannelId(channelId);
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      [`historyFrom.${normId}`]: historyFromTimestamp,
      updatedAt: serverTimestamp(),
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

/**
 * Append audit log entry to Firestore
 */
export async function logAuditToFirestore(entry: AuditLogEntry): Promise<void> {
  const path = `auditLogs/${entry.id}`;
  try {
    await setDoc(doc(db, 'auditLogs', entry.id), {
      ...entry,
      createdAt: serverTimestamp(),
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

/**
 * Sign out of both Firebase Auth and in-app email session
 */
export async function logoutFirebase(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err: any) {
    console.error('Firebase SignOut Error:', err?.code, err);
  }
}

/**
 * 1. Ensure Default Channels Exist with Fixed IDs:
 * "general", "finance", "it-support", "executive-board"
 * (created from the admin dashboard on load, only for admins)
 */
export async function ensureDefaultChannelsExist(): Promise<void> {
  const defaultList: { id: string; name: string; description: string }[] = [
    {
      id: 'general',
      name: 'General',
      description: 'Organization-wide broadcast & staff channel',
    },
    {
      id: 'finance',
      name: 'Finance Team',
      description: 'Finance & procurement team channel',
    },
    {
      id: 'it-support',
      name: 'IT Support',
      description: 'Technical support & infrastructure channel',
    },
    {
      id: 'executive-board',
      name: 'Executive Board',
      description: 'Restricted fiduciary governance channel',
    },
  ];

  for (const ch of defaultList) {
    try {
      const channelRef = doc(db, 'channels', ch.id);
      const snap = await getDoc(channelRef);
      if (!snap.exists()) {
        await setDoc(channelRef, {
          name: ch.name,
          description: ch.description,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.warn(`ensureDefaultChannels note for ${ch.id}:`, err);
    }
  }
}

/**
 * Live subscription to all channels documents for approved users.
 * One single shared listener for the entire app.
 */
export function subscribeToChannels(
  callback: (channels: ChannelDoc[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const colRef = collection(db, 'channels');
  const unsub = onSnapshot(
    colRef,
    (snap) => {
      const list: ChannelDoc[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          name: data.name || d.id,
          description: data.description || '',
          avatarMode: data.avatarMode || 'icon',
          avatarIcon: data.avatarIcon,
          avatarColor: data.avatarColor,
          avatarPhoto: data.avatarPhoto || '',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });
      callback(list);
    },
    (err) => {
      console.warn('subscribeToChannels error:', err);
      if (onError) onError(err);
    }
  );
  return registerActiveListener(unsub);
}

/**
 * Admin action: update channel avatar and description in channels/{channelId}
 * Merges { avatarMode, avatarIcon, avatarColor, avatarPhoto, description }
 */
export async function updateChannelInFirestore(
  channelId: string,
  payload: {
    avatarMode: 'icon' | 'photo';
    avatarIcon: string;
    avatarColor: string;
    avatarPhoto: string;
    description: string;
  }
): Promise<void> {
  const docRef = doc(db, 'channels', channelId);
  await setDoc(
    docRef,
    {
      avatarMode: payload.avatarMode,
      avatarIcon: payload.avatarIcon,
      avatarColor: payload.avatarColor,
      avatarPhoto: payload.avatarPhoto || '',
      description: payload.description || '',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * 2. Directory management: directory/{uid}
 * Keeps email addresses out of it. Staff can list directory to find people to message.
 */
export async function syncUserToDirectory(
  uid: string,
  displayName: string,
  department: string,
  channels?: string[]
): Promise<void> {
  if (!uid) return;
  try {
    const payload: any = {
      displayName: displayName.trim() || 'Staff Member',
      department: department.trim() || 'Operations',
      updatedAt: serverTimestamp(),
    };
    if (channels && Array.isArray(channels)) {
      payload.channels = channels;
    }
    await setDoc(doc(db, 'directory', uid), payload, { merge: true });
  } catch (err: any) {
    console.warn(`Could not sync user to directory:`, err);
  }
}

export function subscribeToDirectory(
  callback: (users: DirectoryUser[]) => void
): Unsubscribe {
  const unsub = onSnapshot(
    collection(db, 'directory'),
    (snap) => {
      const list: DirectoryUser[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          uid: d.id,
          displayName: data.displayName || 'Staff Member',
          department: data.department || 'Operations',
          channels: data.channels || [],
          avatarMode: data.avatarMode || 'initials',
          avatarColor: data.avatarColor || '',
          avatarPhoto: data.avatarPhoto || '',
        });
      });
      callback(list);
    },
    (err) => {
      console.warn('Directory subscription error:', err);
    }
  );
  return registerActiveListener(unsub);
}

/**
 * Real-time subscription to retention policies collection: retentionPolicies/{channelId}
 */
export function subscribeToRetentionPolicies(
  callback: (policies: Record<string, any>) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const colRef = collection(db, 'retentionPolicies');
  const unsub = onSnapshot(
    colRef,
    (snap) => {
      const result: Record<string, any> = {};
      snap.forEach((docSnap) => {
        result[docSnap.id] = {
          id: docSnap.id,
          ...docSnap.data(),
        };
      });
      callback(result);
    },
    (err) => {
      console.warn('Retention policies subscription error:', err);
      if (onError) onError(err);
    }
  );
  return registerActiveListener(unsub);
}

/**
 * Persist retention policy document to retentionPolicies/{channelId}
 */
export async function saveRetentionPolicyInFirestore(
  channelId: string,
  payload: {
    channelName: string;
    messageExpiry: string;
    fileExpiry: string;
    updatedBy: string;
  }
): Promise<void> {
  const normId = normalizeChannelId(channelId);
  const path = `retentionPolicies/${normId}`;
  try {
    await setDoc(doc(db, 'retentionPolicies', normId), {
      channelName: payload.channelName,
      messageExpiry: payload.messageExpiry,
      fileExpiry: payload.fileExpiry,
      updatedBy: payload.updatedBy,
      updatedAt: serverTimestamp(),
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Update user avatar settings in directory/{uid}
 * Merged with existing displayName, department and channels
 */
export async function updateUserAvatarInDirectory(
  uid: string,
  avatarMode: 'initials' | 'photo',
  avatarColor: string,
  avatarPhoto: string
): Promise<void> {
  if (!uid) return;
  const docRef = doc(db, 'directory', uid);
  await setDoc(
    docRef,
    {
      avatarMode,
      avatarColor: avatarColor || '',
      avatarPhoto: avatarPhoto || '',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Admin action to remove a user's profile photo in directory/{targetUid}
 */
export async function adminRemoveUserAvatarPhoto(
  targetUid: string
): Promise<void> {
  if (!targetUid) return;
  const docRef = doc(db, 'directory', targetUid);
  await setDoc(
    docRef,
    {
      avatarMode: 'initials',
      avatarPhoto: '',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Real-time subscription to the current user's own profile in users/{uid}
 * Enables instant sidebar unlock/lock when an admin modifies channels
 */
export function subscribeToUserDoc(
  uid: string,
  callback: (userData: OrgUser | null) => void
): Unsubscribe {
  const unsub = onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as OrgUser);
      } else {
        callback(null);
      }
    },
    (err) => {
      console.warn('subscribeToUserDoc error:', err);
    }
  );
  return registerActiveListener(unsub);
}

/**
 * Format timestamp helper
 */
function formatMessageTime(rawTimestamp: any): string {
  if (!rawTimestamp) {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (typeof rawTimestamp.toDate === 'function') {
    return rawTimestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (rawTimestamp instanceof Date) {
    return rawTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return String(rawTimestamp);
}

/**
 * 3. Live Messages Subscription with pagination (newest N messages)
 */
export function subscribeToConversationMessages(
  conversationType: 'channel' | 'direct',
  conversationId: string,
  messageLimit: number,
  currentUserId: string,
  callback: (messages: ChatMessage[]) => void,
  onError?: (err: any) => void,
  autoMarkRead: boolean = true,
  historyFromTimestamp?: Timestamp
): Unsubscribe {
  const basePath = conversationType === 'channel' ? 'channels' : 'directChats';

  // Apply historyFrom lower bound for channels
  // For channels, every query must include where createdAt >= lowerBound (default Timestamp.fromMillis(0))
  const lowerBound =
    conversationType === 'channel'
      ? historyFromTimestamp || Timestamp.fromMillis(0)
      : null;

  const q = lowerBound
    ? query(
        collection(db, basePath, conversationId, 'messages'),
        where('createdAt', '>=', lowerBound),
        orderBy('createdAt', 'desc'),
        limit(messageLimit)
      )
    : query(
        collection(db, basePath, conversationId, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(messageLimit)
      );

  const unsub = onSnapshot(
    q,
    (snap) => {
      const msgs: ChatMessage[] = [];
      const needDelivered: string[] = [];
      const needRead: string[] = [];

      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const senderId = data.senderId;
        const deliveredTo: string[] = Array.isArray(data.deliveredTo) ? data.deliveredTo : [];
        const readBy: string[] = Array.isArray(data.readBy) ? data.readBy : [];
        const isOutgoing = senderId === currentUserId;

        // Auto delivery and read receipt for recipients when actively viewing
        if (!isOutgoing && currentUserId && autoMarkRead) {
          if (!deliveredTo.includes(currentUserId)) {
            needDelivered.push(docSnap.id);
          }
          if (!readBy.includes(currentUserId)) {
            needRead.push(docSnap.id);
          }
        }

        let status: MessageStatus = 'sent';
        const otherRecipientsDelivered = deliveredTo.filter((u) => u !== senderId);
        const otherRecipientsRead = readBy.filter((u) => u !== senderId);

        if (otherRecipientsRead.length > 0) {
          status = 'read';
        } else if (otherRecipientsDelivered.length > 0) {
          status = 'delivered';
        }

        const deleted = Boolean(data.deleted);
        const text = deleted ? '' : (data.text || '');

        msgs.push({
          id: docSnap.id,
          senderId,
          senderName: data.senderName || 'Staff Member',
          text,
          timestamp: formatMessageTime(data.createdAt),
          createdAt: data.createdAt,
          editedAt: data.editedAt,
          deleted,
          deletedAt: data.deletedAt,
          deletedBy: data.deletedBy,
          deletedReason: data.deletedReason,
          replyTo: data.replyTo,
          deliveredTo,
          readBy,
          isOutgoing,
          status,
          type: data.type || (data.fileId ? 'file' : 'text'),
          fileId: deleted ? undefined : data.fileId,
          fileName: deleted ? undefined : data.fileName,
          fileType: deleted ? undefined : data.fileType,
          fileSize: deleted ? undefined : data.fileSize,
          thumb: deleted ? undefined : data.thumb,
          file: deleted ? undefined : data.file,
          fileDataUrl: deleted ? undefined : (data.fileDataUrl || data.file?.dataUrl),
        });
      });

      // Reverse so messages are chronological (oldest to newest)
      msgs.reverse();
      callback(msgs);

      // Automatic recipient updates for delivery & read using writeBatch (max 400 operations per batch)
      if (currentUserId && (needRead.length > 0 || needDelivered.length > 0)) {
        const updatesToApply: { id: string; payload: any }[] = [];
        const handledMsgIds = new Set<string>();

        needRead.forEach((msgId) => {
          handledMsgIds.add(msgId);
          updatesToApply.push({
            id: msgId,
            payload: {
              readBy: arrayUnion(currentUserId),
              deliveredTo: arrayUnion(currentUserId),
            },
          });
        });

        needDelivered.forEach((msgId) => {
          if (!handledMsgIds.has(msgId)) {
            handledMsgIds.add(msgId);
            updatesToApply.push({
              id: msgId,
              payload: {
                deliveredTo: arrayUnion(currentUserId),
              },
            });
          }
        });

        const BATCH_SIZE = 400;
        for (let i = 0; i < updatesToApply.length; i += BATCH_SIZE) {
          const chunk = updatesToApply.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(db);
          chunk.forEach((item) => {
            batch.update(doc(db, basePath, conversationId, 'messages', item.id), item.payload);
          });
          batch.commit().catch((e) => console.warn('Could not commit receipt batch:', e));
        }
      }
    },
    (err) => {
      console.warn(`Messages snapshot error for ${conversationType}/${conversationId}:`, err);
      if (onError) onError(err);
    }
  );
  return registerActiveListener(unsub);
}

/**
 * Mark specific messages as read by the current user
 */
export async function markConversationMessagesAsRead(
  conversationType: 'channel' | 'direct',
  conversationId: string,
  currentUserId: string,
  messageIds: string[]
): Promise<void> {
  if (!currentUserId || !conversationId || messageIds.length === 0) return;
  const basePath = conversationType === 'channel' ? 'channels' : 'directChats';

  const promises = messageIds.map((msgId) =>
    updateDoc(doc(db, basePath, conversationId, 'messages', msgId), {
      readBy: arrayUnion(currentUserId),
      deliveredTo: arrayUnion(currentUserId),
    }).catch((e) => console.warn('Could not mark message read:', e))
  );

  await Promise.allSettled(promises);
}

/**
 * 4. Send Message (channels or directChats)
 * Validates: 1 to 4000 characters, createdAt == serverTimestamp()
 * replyTo: preview max 100 characters (rules allow up to 140)
 */
export async function sendChatMessage(
  conversationType: 'channel' | 'direct',
  conversationId: string,
  senderId: string,
  senderName: string,
  text: string,
  file?: AttachedFile,
  replyTo?: MessageReplyTo
): Promise<string> {
  const trimmed = text.trim();
  const effectiveText = trimmed || (file ? (file.isImage ? '📷 Photo' : `📎 ${file.name}`) : '');
  if (!effectiveText) {
    throw new Error('Message cannot be empty');
  }
  if (effectiveText.length > 4000) {
    throw new Error('Message cannot exceed 4000 characters');
  }

  const basePath = conversationType === 'channel' ? 'channels' : 'directChats';
  const messagesCol = collection(db, basePath, conversationId, 'messages');
  const docRef = doc(messagesCol);

  const payload: any = {
    senderId,
    senderName,
    text: effectiveText,
    createdAt: serverTimestamp(),
    deliveredTo: [senderId],
    readBy: [senderId],
  };

  if (replyTo && replyTo.messageId) {
    payload.replyTo = {
      messageId: replyTo.messageId,
      senderName: replyTo.senderName,
      preview: (replyTo.preview || '').slice(0, 100),
    };
  }

  if (file) {
    payload.file = {
      name: file.name,
      size: file.size,
      type: file.type,
      dataUrl: file.dataUrl,
      isImage: file.isImage,
    };
  }

  await setDoc(docRef, payload);

  // If direct chat, update lastMessage and lastMessageTime on parent
  if (conversationType === 'direct') {
    try {
      await updateDoc(doc(db, 'directChats', conversationId), {
        lastMessage: effectiveText,
        lastMessageTime: serverTimestamp(),
      });
    } catch (_) {}
  }

  return docRef.id;
}

/**
 * Edit Message (own message only, within 15 mins)
 * Updates { text, editedAt: serverTimestamp() } and nothing else
 */
export async function editChatMessage(
  conversationType: 'channel' | 'direct',
  conversationId: string,
  messageId: string,
  newText: string
): Promise<void> {
  const trimmed = newText.trim();
  if (!trimmed || trimmed.length < 1) {
    throw new Error('Message cannot be empty');
  }
  if (trimmed.length > 4000) {
    throw new Error('Message cannot exceed 4000 characters');
  }

  const basePath = conversationType === 'channel' ? 'channels' : 'directChats';
  const msgRef = doc(db, basePath, conversationId, 'messages', messageId);

  await updateDoc(msgRef, {
    text: trimmed,
    editedAt: serverTimestamp(),
  });
}

/**
 * Soft delete message
 * Updates { deleted: true, text: "", deletedAt: serverTimestamp() } and nothing else.
 * If message has an associated fileId, also delete the file document.
 */
export async function softDeleteChatMessage(
  conversationType: 'channel' | 'direct',
  conversationId: string,
  messageId: string,
  fileId?: string
): Promise<void> {
  const basePath = conversationType === 'channel' ? 'channels' : 'directChats';

  // 1. Delete associated file document if present
  if (fileId) {
    try {
      const fileRef = doc(db, basePath, conversationId, 'files', fileId);
      await deleteDoc(fileRef);
    } catch (err) {
      console.warn('Failed to delete file document on soft delete:', err);
    }
  }

  // 2. Soft delete message document
  const msgRef = doc(db, basePath, conversationId, 'messages', messageId);
  await updateDoc(msgRef, {
    deleted: true,
    text: '',
    deletedAt: serverTimestamp(),
  });

  if (conversationType === 'direct') {
    try {
      await updateDoc(doc(db, 'directChats', conversationId), {
        lastMessage: 'Message deleted',
        lastMessageTime: serverTimestamp(),
      });
    } catch (_) {}
  }
}

/**
 * Moderator Remove Message (Admin only, Channels only)
 * Updates ONLY: deleted: true, text: "", deletedAt: serverTimestamp(), deletedBy: "admin", deletedReason: reason.
 * If message is a file message, also deletes its document in the files subcollection.
 */
export async function moderatorRemoveChatMessage(
  channelId: string,
  messageId: string,
  reason: string,
  fileId?: string
): Promise<void> {
  // If file message, delete its document in channels/{channelId}/files/{fileId}
  if (fileId) {
    try {
      const fileRef = doc(db, 'channels', channelId, 'files', fileId);
      await deleteDoc(fileRef);
    } catch (err) {
      console.warn('Failed to delete file document during moderator removal:', err);
    }
  }

  // Update ONLY the permitted 5 keys in channels/{channelId}/messages/{messageId}
  const msgRef = doc(db, 'channels', channelId, 'messages', messageId);
  await updateDoc(msgRef, {
    deleted: true,
    text: '',
    deletedAt: serverTimestamp(),
    deletedBy: 'admin',
    deletedReason: reason,
  });
}

/**
 * Fetch a single message doc by ID (used for reviewing reported message by ID)
 */
export async function fetchSingleMessage(
  conversationType: 'channel' | 'direct',
  conversationId: string,
  messageId: string
): Promise<ChatMessage | null> {
  try {
    const basePath = conversationType === 'channel' ? 'channels' : 'directChats';
    const msgRef = doc(db, basePath, conversationId, 'messages', messageId);
    const snap = await getDoc(msgRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id,
      senderId: data.senderId,
      senderName: data.senderName || 'Staff Member',
      text: data.deleted ? '' : (data.text || ''),
      timestamp: formatMessageTime(data.createdAt),
      createdAt: data.createdAt,
      editedAt: data.editedAt,
      deleted: Boolean(data.deleted),
      deletedAt: data.deletedAt,
      deletedBy: data.deletedBy,
      deletedReason: data.deletedReason,
      isOutgoing: false,
      fileId: data.deleted ? undefined : data.fileId,
      fileName: data.deleted ? undefined : data.fileName,
      fileType: data.deleted ? undefined : data.fileType,
      fileSize: data.deleted ? undefined : data.fileSize,
      type: data.type || (data.fileId ? 'file' : 'text'),
    };
  } catch (err) {
    console.warn('Error fetching single message:', err);
    return null;
  }
}

/**
 * Send File Message
 * 1. Writes file document to channels/{channelId}/files/{fileId} or directChats/{chatId}/files/{fileId}
 * 2. Writes message document to channels/{channelId}/messages/{messageId} or directChats/{chatId}/messages/{messageId}
 */
export async function sendFileChatMessage(
  conversationType: 'channel' | 'direct',
  conversationId: string,
  senderId: string,
  senderName: string,
  fileData: {
    fileName: string;
    fileType: string;
    fileSize: number;
    data: string; // base64 string
    thumb?: string;
  },
  caption: string = '',
  replyTo?: MessageReplyTo,
  onProgress?: (progress: number) => void
): Promise<string> {
  const basePath = conversationType === 'channel' ? 'channels' : 'directChats';

  if (onProgress) onProgress(30);

  // 1. Create file document first
  const fileCol = collection(db, basePath, conversationId, 'files');
  const fileRef = doc(fileCol);
  const fileId = fileRef.id;

  const fileDocPayload = {
    senderId,
    fileName: fileData.fileName.slice(0, 120),
    fileType: fileData.fileType,
    fileSize: fileData.fileSize,
    data: fileData.data,
    createdAt: serverTimestamp(),
  };

  await setDoc(fileRef, fileDocPayload);

  if (onProgress) onProgress(80);

  // 2. Write message document after file doc succeeds
  const messagesCol = collection(db, basePath, conversationId, 'messages');
  const msgRef = doc(messagesCol);

  const msgPayload: any = {
    type: 'file',
    fileId,
    fileName: fileData.fileName.slice(0, 120),
    fileType: fileData.fileType,
    fileSize: fileData.fileSize,
    text: (caption || '').slice(0, 500),
    senderId,
    senderName,
    createdAt: serverTimestamp(),
    deliveredTo: [senderId],
    readBy: [senderId],
  };

  if (fileData.thumb) {
    msgPayload.thumb = fileData.thumb;
  }

  if (replyTo && replyTo.messageId) {
    msgPayload.replyTo = {
      messageId: replyTo.messageId,
      senderName: replyTo.senderName,
      preview: (replyTo.preview || '').slice(0, 100),
    };
  }

  await setDoc(msgRef, msgPayload);

  if (onProgress) onProgress(100);

  // If direct chat, update lastMessage on directChats/{chatId}
  if (conversationType === 'direct') {
    try {
      const isPhoto = fileData.fileType.startsWith('image/');
      const previewText = caption.trim()
        ? caption.trim()
        : isPhoto
        ? 'Photo'
        : `File: ${fileData.fileName}`;

      await updateDoc(doc(db, 'directChats', conversationId), {
        lastMessage: previewText,
        lastMessageTime: serverTimestamp(),
      });
    } catch (_) {}
  }

  return msgRef.id;
}

/**
 * Fetch File Document on demand (one read of file document when user clicks)
 */
export async function fetchFileDocument(
  conversationType: 'channel' | 'direct',
  conversationId: string,
  fileId: string
): Promise<{ fileName: string; fileType: string; fileSize: number; data: string } | null> {
  const basePath = conversationType === 'channel' ? 'channels' : 'directChats';
  const fileRef = doc(db, basePath, conversationId, 'files', fileId);
  const snap = await getDoc(fileRef);
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    fileName: d.fileName || 'file',
    fileType: d.fileType || 'application/octet-stream',
    fileSize: d.fileSize || 0,
    data: d.data || '',
  };
}

/**
 * Typing Indicators
 * Document at channels/{channelId}/typing/{uid} or directChats/{chatId}/typing/{uid}
 * Payload: { name, updatedAt: serverTimestamp() }
 */
export async function updateTypingStatusInFirestore(
  conversationType: 'channel' | 'direct',
  conversationId: string,
  uid: string,
  name: string
): Promise<void> {
  const basePath = conversationType === 'channel' ? 'channels' : 'directChats';
  const typingRef = doc(db, basePath, conversationId, 'typing', uid);
  await setDoc(typingRef, {
    name,
    updatedAt: serverTimestamp(),
  });
}

export async function clearTypingStatusInFirestore(
  conversationType: 'channel' | 'direct',
  conversationId: string,
  uid: string
): Promise<void> {
  try {
    const basePath = conversationType === 'channel' ? 'channels' : 'directChats';
    const typingRef = doc(db, basePath, conversationId, 'typing', uid);
    await deleteDoc(typingRef);
  } catch (_) {}
}

export function subscribeToTypingStatus(
  conversationType: 'channel' | 'direct',
  conversationId: string,
  currentUserId: string,
  callback: (typingUsers: { uid: string; name: string }[]) => void
): Unsubscribe {
  const basePath = conversationType === 'channel' ? 'channels' : 'directChats';
  const typingCol = collection(db, basePath, conversationId, 'typing');

  const unsub = onSnapshot(
    typingCol,
    (snap) => {
      const now = Date.now();
      const active: { uid: string; name: string }[] = [];

      snap.forEach((d) => {
        if (d.id === currentUserId) return;
        const data = d.data();
        let updatedTimeMs = 0;
        if (data.updatedAt) {
          if (typeof data.updatedAt.toMillis === 'function') {
            updatedTimeMs = data.updatedAt.toMillis();
          } else if (typeof data.updatedAt.toDate === 'function') {
            updatedTimeMs = data.updatedAt.toDate().getTime();
          } else if (data.updatedAt.seconds) {
            updatedTimeMs = data.updatedAt.seconds * 1000;
          } else if (data.updatedAt instanceof Date) {
            updatedTimeMs = data.updatedAt.getTime();
          }
        }
        // Ignore any document older than 6 seconds
        if (!updatedTimeMs || (now - updatedTimeMs <= 6000)) {
          active.push({
            uid: d.id,
            name: data.name || 'Someone',
          });
        }
      });

      callback(active);
    },
    (err) => {
      console.warn('subscribeToTypingStatus error:', err);
    }
  );
  return registerActiveListener(unsub);
}

/**
 * 5. Direct chat creator: participants [uidA, uidB] sorted and joined with '_'
 */
export async function getOrCreateDirectChat(uidA: string, uidB: string): Promise<string> {
  const sorted = [uidA, uidB].sort();
  const chatId = sorted.join('_');
  const chatRef = doc(db, 'directChats', chatId);

  try {
    const snap = await getDoc(chatRef);
    if (!snap.exists()) {
      await setDoc(chatRef, {
        participants: sorted,
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.warn('getOrCreateDirectChat check/create note:', err);
  }

  return chatId;
}

/**
 * 6. Subscribe to user's direct chats
 */
export function subscribeToUserDirectChats(
  currentUserId: string,
  callback: (chats: { id: string; participants: string[]; lastMessage?: string; lastMessageTime?: any }[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'directChats'),
    where('participants', 'array-contains', currentUserId)
  );

  const unsub = onSnapshot(
    q,
    (snap) => {
      const list: { id: string; participants: string[]; lastMessage?: string; lastMessageTime?: any }[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          participants: data.participants || [],
          lastMessage: data.lastMessage,
          lastMessageTime: data.lastMessageTime,
        });
      });
      callback(list);
    },
    (err) => {
      console.warn('subscribeToUserDirectChats error:', err);
    }
  );
  return registerActiveListener(unsub);
}

/**
 * 7. Update User Status in Firestore (suspend / reactivate)
 */
export async function updateUserStatusInFirestore(
  userId: string,
  status: 'approved' | 'suspended' | 'pending' | 'rejected'
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    status,
    updatedAt: serverTimestamp(),
  });
}

/**
 * 8. Accept Privacy Notice
 */
export async function acceptPrivacyNoticeInFirestore(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    privacyAcceptedAt: serverTimestamp(),
  });
}

/**
 * 9. Submit a Report (problem or message report)
 */
export async function submitReportToFirestore(report: {
  reporterId: string;
  reporterName: string;
  conversationType: 'channel' | 'direct' | 'app';
  conversationId?: string;
  messageId?: string;
  reason: string;
  note: string;
}): Promise<string> {
  const colRef = collection(db, 'reports');
  const docRef = doc(colRef);
  await setDoc(docRef, {
    reporterId: report.reporterId,
    reporterName: report.reporterName,
    conversationType: report.conversationType,
    conversationId: report.conversationId || '',
    messageId: report.messageId || '',
    reason: report.reason,
    note: (report.note || '').slice(0, 500),
    status: 'open',
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * 10. Real-time subscription to reports for administrators
 */
export function subscribeToReports(
  callback: (reports: ReportDoc[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const colRef = collection(db, 'reports');
  const q = query(colRef, orderBy('createdAt', 'desc'), limit(100));
  const unsub = onSnapshot(
    q,
    (snap) => {
      const list: ReportDoc[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          reporterId: data.reporterId || '',
          reporterName: data.reporterName || 'Staff Member',
          conversationType: data.conversationType || 'app',
          conversationId: data.conversationId,
          messageId: data.messageId,
          reason: data.reason || 'Other',
          note: data.note || '',
          status: data.status || 'open',
          createdAt: data.createdAt,
        });
      });
      callback(list);
    },
    (err) => {
      console.warn('subscribeToReports error:', err);
      if (onError) onError(err);
    }
  );
  return registerActiveListener(unsub);
}

/**
 * 11. Mark Report as Resolved
 */
export async function resolveReportInFirestore(reportId: string): Promise<void> {
  const docRef = doc(db, 'reports', reportId);
  await updateDoc(docRef, {
    status: 'resolved',
  });
}

/**
 * 12. History Requests management
 */

/**
 * Create a history request document at historyRequests/{uid}_{channelId}
 */
export async function createHistoryRequestInFirestore(
  uid: string,
  userName: string,
  channelId: string,
  note?: string
): Promise<void> {
  const normId = normalizeChannelId(channelId);
  const reqId = `${uid}_${normId}`;
  const path = `historyRequests/${reqId}`;
  try {
    await setDoc(doc(db, 'historyRequests', reqId), {
      uid,
      userName,
      channelId: normId,
      note: (note || '').trim().slice(0, 200),
      status: 'open',
      createdAt: serverTimestamp(),
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Fetch existing history request for user and channel
 */
export async function getHistoryRequest(
  uid: string,
  channelId: string
): Promise<HistoryRequest | null> {
  const normId = normalizeChannelId(channelId);
  const reqId = `${uid}_${normId}`;
  try {
    const snap = await getDoc(doc(db, 'historyRequests', reqId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as HistoryRequest;
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Live subscription to all history requests for administrators
 */
export function subscribeToAllHistoryRequests(
  callback: (requests: HistoryRequest[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const colRef = collection(db, 'historyRequests');
  const q = query(colRef, orderBy('createdAt', 'desc'), limit(100));
  const unsub = onSnapshot(
    q,
    (snap) => {
      const list: HistoryRequest[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          uid: data.uid || '',
          userName: data.userName || 'Staff Member',
          channelId: data.channelId || '',
          note: data.note || '',
          status: data.status || 'open',
          createdAt: data.createdAt,
        });
      });
      // Sort newest first
      list.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
      });
      callback(list);
    },
    (err) => {
      console.warn('subscribeToAllHistoryRequests error:', err);
      if (onError) onError(err);
    }
  );
  return registerActiveListener(unsub);
}

/**
 * Live subscription to history requests for a specific member
 */
export function subscribeToUserHistoryRequests(
  uid: string,
  callback: (requests: HistoryRequest[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const q = query(collection(db, 'historyRequests'), where('uid', '==', uid));
  const unsub = onSnapshot(
    q,
    (snap) => {
      const list: HistoryRequest[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          uid: data.uid || '',
          userName: data.userName || '',
          channelId: data.channelId || '',
          note: data.note || '',
          status: data.status || 'open',
          createdAt: data.createdAt,
        });
      });
      callback(list);
    },
    (err) => {
      console.warn('subscribeToUserHistoryRequests error:', err);
      if (onError) onError(err);
    }
  );
  return registerActiveListener(unsub);
}

/**
 * Approve a history request:
 * Sets users/{uid}.historyFrom.<channelId> to Timestamp.fromMillis(0) (full history)
 * and marks historyRequests doc status to 'approved'
 */
export async function approveHistoryRequestInFirestore(
  requestId: string,
  uid: string,
  channelId: string
): Promise<void> {
  const normId = normalizeChannelId(channelId);
  try {
    await updateDoc(doc(db, 'historyRequests', requestId), {
      status: 'approved',
    });
    await updateDoc(doc(db, 'users', uid), {
      [`historyFrom.${normId}`]: Timestamp.fromMillis(0),
      updatedAt: serverTimestamp(),
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.UPDATE, `historyRequests/${requestId}`);
  }
}

/**
 * Decline a history request: marks status to 'declined'
 */
export async function declineHistoryRequestInFirestore(
  requestId: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'historyRequests', requestId), {
      status: 'declined',
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.UPDATE, `historyRequests/${requestId}`);
  }
}

/* ==========================================================================
   MEETING SCHEDULING, REMINDERS, AND RSVP
   ========================================================================== */

/**
 * Subscribe to upcoming scheduled meetings for a specific channel or direct chat.
 * ONLY active while the meetings side panel is open.
 * meetings where status == "scheduled" and startsAt >= now, ordered by startsAt, limit 20.
 */
export function subscribeToConversationMeetings(
  conversationType: 'channel' | 'direct',
  conversationId: string,
  callback: (meetings: MeetingDoc[]) => void,
  onError?: (err: any) => void
): () => void {
  const collectionPath =
    conversationType === 'channel'
      ? `channels/${conversationId}/meetings`
      : `directChats/${conversationId}/meetings`;

  const colRef = collection(
    db,
    conversationType === 'channel' ? 'channels' : 'directChats',
    conversationId,
    'meetings'
  );

  const q = query(
    colRef,
    where('status', '==', 'scheduled'),
    where('startsAt', '>=', Timestamp.now()),
    orderBy('startsAt', 'asc'),
    limit(20)
  );

  const unsub = onSnapshot(
    q,
    (snap) => {
      const list: MeetingDoc[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          title: data.title || '',
          startsAt: data.startsAt,
          durationMinutes: data.durationMinutes || 30,
          location: data.location || '',
          link: data.link || '',
          note: data.note || '',
          status: data.status || 'scheduled',
          createdBy: data.createdBy || '',
          createdByName: data.createdByName || '',
          createdAt: data.createdAt,
          rsvp: data.rsvp || {},
          editedAt: data.editedAt,
          cancelledBy: data.cancelledBy,
          cancelledAt: data.cancelledAt,
        });
      });
      callback(list);
    },
    (err) => {
      console.warn(`subscribeToConversationMeetings error on ${collectionPath}:`, err);
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, collectionPath);
    }
  );

  return registerActiveListener(unsub);
}

/**
 * One-time fetch of cancelled meetings of the last 7 days for a conversation
 */
export async function getCancelledMeetingsForConversation(
  conversationType: 'channel' | 'direct',
  conversationId: string
): Promise<MeetingDoc[]> {
  const collectionPath =
    conversationType === 'channel'
      ? `channels/${conversationId}/meetings`
      : `directChats/${conversationId}/meetings`;

  const colRef = collection(
    db,
    conversationType === 'channel' ? 'channels' : 'directChats',
    conversationId,
    'meetings'
  );

  const sevenDaysAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const q = query(
    colRef,
    where('status', '==', 'cancelled'),
    where('startsAt', '>=', sevenDaysAgo),
    orderBy('startsAt', 'desc'),
    limit(20)
  );

  try {
    const snap = await getDocs(q);
    const list: MeetingDoc[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        id: d.id,
        title: data.title || '',
        startsAt: data.startsAt,
        durationMinutes: data.durationMinutes || 30,
        location: data.location || '',
        link: data.link || '',
        note: data.note || '',
        status: data.status || 'cancelled',
        createdBy: data.createdBy || '',
        createdByName: data.createdByName || '',
        createdAt: data.createdAt,
        rsvp: data.rsvp || {},
        editedAt: data.editedAt,
        cancelledBy: data.cancelledBy,
        cancelledAt: data.cancelledAt,
      });
    });
    return list;
  } catch (err: any) {
    console.warn(`getCancelledMeetingsForConversation error on ${collectionPath}:`, err);
    return [];
  }
}

/**
 * One-time fetch of a single meeting document
 */
export async function getMeetingDoc(
  conversationType: 'channel' | 'direct',
  conversationId: string,
  meetingId: string
): Promise<MeetingDoc | null> {
  const path =
    conversationType === 'channel'
      ? `channels/${conversationId}/meetings/${meetingId}`
      : `directChats/${conversationId}/meetings/${meetingId}`;

  try {
    const meetingRef = doc(
      db,
      conversationType === 'channel' ? 'channels' : 'directChats',
      conversationId,
      'meetings',
      meetingId
    );
    const snap = await getDoc(meetingRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id,
      title: data.title || '',
      startsAt: data.startsAt,
      durationMinutes: data.durationMinutes || 30,
      location: data.location || '',
      link: data.link || '',
      note: data.note || '',
      status: data.status || 'scheduled',
      createdBy: data.createdBy || '',
      createdByName: data.createdByName || '',
      createdAt: data.createdAt,
      rsvp: data.rsvp || {},
      editedAt: data.editedAt,
      cancelledBy: data.cancelledBy,
      cancelledAt: data.cancelledAt,
    };
  } catch (err: any) {
    console.warn(`getMeetingDoc error on ${path}:`, err);
    return null;
  }
}

/**
 * Create a new meeting in a channel or direct chat and add creator's myMeetings entry.
 */
export async function createMeetingInFirestore(
  conversationType: 'channel' | 'direct',
  conversationId: string,
  conversationName: string,
  meetingData: {
    title: string;
    startsAt: Timestamp;
    durationMinutes: number;
    location?: string;
    link?: string;
    note?: string;
  },
  user: { uid: string; fullName: string }
): Promise<string> {
  const meetingId = `meet_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const meetingsPath =
    conversationType === 'channel'
      ? `channels/${conversationId}/meetings/${meetingId}`
      : `directChats/${conversationId}/meetings/${meetingId}`;

  const meetingDocRef = doc(
    db,
    conversationType === 'channel' ? 'channels' : 'directChats',
    conversationId,
    'meetings',
    meetingId
  );

  // Filter only allowed keys in validMeetingCreate
  const payload: Record<string, any> = {
    title: meetingData.title.trim().slice(0, 100),
    startsAt: meetingData.startsAt,
    durationMinutes: Math.max(5, Math.min(480, meetingData.durationMinutes || 30)),
    status: 'scheduled',
    createdBy: user.uid,
    createdByName: user.fullName || 'User',
    createdAt: serverTimestamp(),
    rsvp: {
      [user.uid]: 'going',
    },
  };

  if (meetingData.location && meetingData.location.trim()) {
    payload.location = meetingData.location.trim().slice(0, 120);
  }
  if (meetingData.link && meetingData.link.trim()) {
    payload.link = meetingData.link.trim().slice(0, 200);
  }
  if (meetingData.note && meetingData.note.trim()) {
    payload.note = meetingData.note.trim().slice(0, 300);
  }

  try {
    await setDoc(meetingDocRef, payload);
  } catch (err: any) {
    handleFirestoreError(err, OperationType.CREATE, meetingsPath);
  }

  // Automatically write creator's myMeetings document
  const myMeetingPath = `users/${user.uid}/myMeetings/${meetingId}`;
  try {
    await setDoc(doc(db, 'users', user.uid, 'myMeetings', meetingId), {
      conversationType,
      conversationId,
      conversationName,
      title: meetingData.title.trim().slice(0, 100),
      startsAt: meetingData.startsAt,
    });
  } catch (err: any) {
    console.warn(`Could not write to ${myMeetingPath}:`, err);
  }

  return meetingId;
}

/**
 * Edit an existing meeting (by creator only).
 * Updates only title, startsAt, durationMinutes, link, location, note, editedAt.
 */
export async function updateMeetingInFirestore(
  conversationType: 'channel' | 'direct',
  conversationId: string,
  meetingId: string,
  updates: {
    title: string;
    startsAt: Timestamp;
    durationMinutes: number;
    location?: string;
    link?: string;
    note?: string;
  },
  creatorUid: string
): Promise<void> {
  const path =
    conversationType === 'channel'
      ? `channels/${conversationId}/meetings/${meetingId}`
      : `directChats/${conversationId}/meetings/${meetingId}`;

  const meetingDocRef = doc(
    db,
    conversationType === 'channel' ? 'channels' : 'directChats',
    conversationId,
    'meetings',
    meetingId
  );

  const payload: Record<string, any> = {
    title: updates.title.trim().slice(0, 100),
    startsAt: updates.startsAt,
    durationMinutes: Math.max(5, Math.min(480, updates.durationMinutes || 30)),
    location: updates.location ? updates.location.trim().slice(0, 120) : '',
    link: updates.link ? updates.link.trim().slice(0, 200) : '',
    note: updates.note ? updates.note.trim().slice(0, 300) : '',
    editedAt: serverTimestamp(),
  };

  try {
    await updateDoc(meetingDocRef, payload);
  } catch (err: any) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }

  // Update creator's myMeetings bookmark
  try {
    await updateDoc(doc(db, 'users', creatorUid, 'myMeetings', meetingId), {
      title: updates.title.trim().slice(0, 100),
      startsAt: updates.startsAt,
    });
  } catch {
    // Might not exist if creator had declined
  }
}

/**
 * Update user's RSVP status on a meeting and synchronize users/{uid}/myMeetings
 */
export async function updateMeetingRsvpInFirestore(
  conversationType: 'channel' | 'direct',
  conversationId: string,
  conversationName: string,
  meetingId: string,
  rsvpStatus: MeetingRsvpStatus,
  user: { uid: string },
  meetingTitle: string,
  startsAt: Timestamp
): Promise<void> {
  const path =
    conversationType === 'channel'
      ? `channels/${conversationId}/meetings/${meetingId}`
      : `directChats/${conversationId}/meetings/${meetingId}`;

  const meetingDocRef = doc(
    db,
    conversationType === 'channel' ? 'channels' : 'directChats',
    conversationId,
    'meetings',
    meetingId
  );

  try {
    await updateDoc(meetingDocRef, {
      [`rsvp.${user.uid}`]: rsvpStatus,
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }

  // Update personal myMeetings: written only when user RSVPs "going", deleted when "declined" or cancelled
  const myMeetingRef = doc(db, 'users', user.uid, 'myMeetings', meetingId);
  try {
    if (rsvpStatus === 'going') {
      await setDoc(myMeetingRef, {
        conversationType,
        conversationId,
        conversationName,
        title: meetingTitle,
        startsAt,
      });
    } else {
      await deleteDoc(myMeetingRef);
    }
  } catch (err: any) {
    console.warn(`Failed to update personal myMeetings for ${meetingId}:`, err);
  }
}

/**
 * Cancel a meeting (by creator or channel admin member).
 * Writes audit log if an administrator cancels someone else's meeting.
 */
export async function cancelMeetingInFirestore(
  conversationType: 'channel' | 'direct',
  conversationId: string,
  meetingId: string,
  user: { uid: string; fullName: string; email: string; role: string },
  conversationName: string,
  meetingCreatedBy: string
): Promise<void> {
  const path =
    conversationType === 'channel'
      ? `channels/${conversationId}/meetings/${meetingId}`
      : `directChats/${conversationId}/meetings/${meetingId}`;

  const meetingDocRef = doc(
    db,
    conversationType === 'channel' ? 'channels' : 'directChats',
    conversationId,
    'meetings',
    meetingId
  );

  try {
    await updateDoc(meetingDocRef, {
      status: 'cancelled',
      cancelledBy: user.uid,
      cancelledAt: serverTimestamp(),
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }

  // Delete own myMeetings bookmark if present
  try {
    await deleteDoc(doc(db, 'users', user.uid, 'myMeetings', meetingId));
  } catch {
    // ignore
  }

  // If an administrator cancels someone else's meeting, write audit entry:
  // "Meeting cancelled by <admin name> in <conversation name>" (type "Moderation", with actorUid).
  // Meeting title is NOT copied into audit entry.
  if (user.role === 'admin' && meetingCreatedBy !== user.uid) {
    const adminName = user.fullName || user.email || 'Administrator';
    const auditText = `Meeting cancelled by ${adminName} in ${conversationName}`;
    try {
      await logAuditToFirestore({
        id: `audit_cancel_${meetingId}_${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: adminName,
        action: auditText,
        details: auditText,
        category: 'Moderation',
        actorUid: user.uid,
        type: 'Moderation',
      });
    } catch (auditErr) {
      console.warn('Could not write admin cancellation audit log:', auditErr);
    }
  }
}

/**
 * Subscribe to user's upcoming meetings from users/{uid}/myMeetings.
 * Exactly one listener: startsAt >= now, ordered by startsAt, limit 20.
 */
export function subscribeToUserMyMeetings(
  uid: string,
  callback: (myMeetings: MyMeetingDoc[]) => void,
  onError?: (err: any) => void
): () => void {
  const colRef = collection(db, 'users', uid, 'myMeetings');
  const q = query(
    colRef,
    where('startsAt', '>=', Timestamp.now()),
    orderBy('startsAt', 'asc'),
    limit(20)
  );

  const unsub = onSnapshot(
    q,
    (snap) => {
      const list: MyMeetingDoc[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          conversationType: data.conversationType || 'channel',
          conversationId: data.conversationId || '',
          conversationName: data.conversationName || '',
          title: data.title || '',
          startsAt: data.startsAt,
        });
      });
      callback(list);
    },
    (err) => {
      console.warn('subscribeToUserMyMeetings error:', err);
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, `users/${uid}/myMeetings`);
    }
  );

  return registerActiveListener(unsub);
}

/**
 * Synchronize / update a myMeeting document with current meeting doc state (e.g. if time edited)
 */
export async function syncMyMeetingDoc(
  uid: string,
  meetingId: string,
  updatedData: { title: string; startsAt: Timestamp }
): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid, 'myMeetings', meetingId), {
      title: updatedData.title,
      startsAt: updatedData.startsAt,
    });
  } catch (err) {
    console.warn('syncMyMeetingDoc error:', err);
  }
}

/**
 * Remove a meeting from myMeetings (e.g. if meeting was cancelled)
 */
export async function removeMyMeetingDoc(uid: string, meetingId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', uid, 'myMeetings', meetingId));
  } catch (err) {
    console.warn('removeMyMeetingDoc error:', err);
  }
}

