import { useState, useEffect, useRef, useCallback } from 'react';
import {
  STAFF_IDLE_MINUTES,
  ADMIN_IDLE_MINUTES,
  WARNING_SECONDS,
  STAFF_MAX_SESSION_HOURS,
  ADMIN_MAX_SESSION_HOURS,
} from '../config/session';
import { UserSession, AuthScreen, AuditCategory } from '../types';
import {
  unsubscribeAllActiveListeners,
  clearOfflineFirestoreCache,
  logoutFirebase,
} from '../lib/firebaseService';
import { clearSessionApprovedAdmins } from '../lib/sessionAdminMemory';

interface UseSessionTimeoutParams {
  currentSession: UserSession | null;
  screen: AuthScreen;
  needsPrivacyNotice: boolean;
  addAuditEntry: (
    actor: string,
    action: string,
    details: string,
    category: AuditCategory
  ) => Promise<void>;
  clearAppCaches: () => void;
  setScreen: (screen: AuthScreen) => void;
}

export function useSessionTimeout({
  currentSession,
  screen,
  needsPrivacyNotice,
  addAuditEntry,
  clearAppCaches,
  setScreen,
}: UseSessionTimeoutParams) {
  // Modal state
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [warningType, setWarningType] = useState<'idle' | 'max_session'>('idle');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(WARNING_SECONDS);

  // In-memory timestamps
  const lastActivityRef = useRef<number>(Date.now());
  const sessionStartedRef = useRef<number>(Date.now());
  const isExecutingSignOutRef = useRef<boolean>(false);

  // Determine if timeout should run:
  // "Run the timeout only for fully approved, signed-in users who are inside the chat or admin pages.
  // Do not run it on the login page, the sign-up page, or the 'Waiting for approval', 'Suspended'
  // and 'Before you start' screens."
  const isEligible = Boolean(
    currentSession &&
      currentSession.status === 'approved' &&
      !needsPrivacyNotice &&
      (screen === 'chat' || screen === 'admin_dashboard')
  );

  const isAdmin = currentSession?.role === 'admin';
  const idleLimitMs = (isAdmin ? ADMIN_IDLE_MINUTES : STAFF_IDLE_MINUTES) * 60 * 1000;
  const maxSessionMs = (isAdmin ? ADMIN_MAX_SESSION_HOURS : STAFF_MAX_SESSION_HOURS) * 60 * 60 * 1000;
  const warningWindowMs = WARNING_SECONDS * 1000;

  // Initialize or synchronize session start and last activity
  useEffect(() => {
    if (!currentSession) {
      setIsWarningOpen(false);
      return;
    }

    const now = Date.now();

    // Check or set gsa_session_started
    const storedSessionStart = localStorage.getItem('gsa_session_started');
    if (!storedSessionStart) {
      localStorage.setItem('gsa_session_started', now.toString());
      sessionStartedRef.current = now;
    } else {
      const parsed = parseInt(storedSessionStart, 10);
      sessionStartedRef.current = isNaN(parsed) ? now : parsed;
    }

    // Check or set gsa_last_activity
    const storedLastActivity = localStorage.getItem('gsa_last_activity');
    if (!storedLastActivity) {
      localStorage.setItem('gsa_last_activity', now.toString());
      lastActivityRef.current = now;
    } else {
      const parsed = parseInt(storedLastActivity, 10);
      lastActivityRef.current = isNaN(parsed) ? now : parsed;
    }
  }, [currentSession]);

  // Execute unified sign-out sequence
  const executeTimeoutSignOut = useCallback(
    async (reason: 'idle' | 'max_session') => {
      if (isExecutingSignOutRef.current) return;
      isExecutingSignOutRef.current = true;

      const wasAdmin = currentSession?.role === 'admin' || screen === 'admin_dashboard';
      const actorName = currentSession?.fullName || currentSession?.email || 'User';
      const actorEmail = currentSession?.email || 'user';
      const auditDetails =
        reason === 'max_session'
          ? `Session timed out for ${actorName} (maximum session length)`
          : `Session timed out for ${actorName} (idle)`;

      // Step 1: Write an audit entry first, while still signed in
      try {
        await addAuditEntry(
          actorEmail,
          reason === 'max_session' ? 'Session expired' : 'Session timed out',
          auditDetails,
          'Auth'
        );
      } catch (err) {
        console.warn('Timeout audit log entry error:', err);
      }

      // Step 2: Unsubscribe from every Firestore listener
      try {
        unsubscribeAllActiveListeners();
      } catch (err) {
        console.warn('Error unsubscribing active listeners:', err);
      }

      // Step 3: Clear all in-memory caches (messages, directory, channels, drafts, admin flags)
      try {
        clearSessionApprovedAdmins();
        clearAppCaches();
      } catch (err) {
        console.warn('Error clearing app caches:', err);
      }

      // Step 4: Remove localStorage keys "gsa_last_activity" and "gsa_session_started"
      // and set one-time sessionStorage flag for login banner
      try {
        const bannerText =
          reason === 'max_session'
            ? 'Your session expired. Please sign in again.'
            : 'You were signed out because of inactivity.';
        sessionStorage.setItem('gsa_timeout_banner', bannerText);

        localStorage.removeItem('gsa_last_activity');
        localStorage.removeItem('gsa_session_started');
        if (currentSession?.uid) {
          localStorage.removeItem(`gsa_muted_channels_${currentSession.uid}`);
        }

        // Clear any draft or muted channel keys
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('gsa_draft_') || k.startsWith('draft_') || k.startsWith('gsa_muted_channels_'))) {
            localStorage.removeItem(k);
          }
        }
        if (typeof document !== 'undefined') {
          document.title = 'Group Secure App - Secure Team Messaging';
        }
      } catch (err) {
        console.warn('Error clearing storage keys:', err);
      }

      // Step 5: Sign out of Firebase and set role screen
      try {
        await logoutFirebase();
      } catch (err) {
        console.warn('Firebase logout error:', err);
      }

      if (wasAdmin) {
        setScreen('admin_login');
      } else {
        setScreen('login');
      }

      // Step 6: Clear local Firestore offline cache on device
      // Terminate instance, call clearIndexedDbPersistence, then reload page.
      // If clearing fails, continue the reload / redirect.
      try {
        await clearOfflineFirestoreCache();
      } catch (err) {
        console.warn('Failed to clear offline Firestore cache, proceeding:', err);
      }

      const targetPath = wasAdmin ? '/admin' : '/';
      if (typeof window !== 'undefined') {
        if (window.location.pathname !== targetPath) {
          window.location.href = targetPath;
        } else {
          window.location.reload();
        }
      }
    },
    [currentSession, screen, addAuditEntry, clearAppCaches, setScreen]
  );

  // Record user activity in memory and localStorage
  const recordUserActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem('gsa_last_activity', now.toString());
    } catch {
      // ignore
    }
  }, []);

  // "Stay signed in" resets idle clock and closes warning dialog
  const handleStaySignedIn = useCallback(() => {
    recordUserActivity();
    setIsWarningOpen(false);
  }, [recordUserActivity]);

  // Handle cross-tab activity via StorageEvent
  useEffect(() => {
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'gsa_last_activity' && e.newValue) {
        const val = parseInt(e.newValue, 10);
        if (!isNaN(val)) {
          lastActivityRef.current = Math.max(lastActivityRef.current, val);
          // Any activity inside other tabs also closes the warning in this tab
          const now = Date.now();
          const idleTime = now - lastActivityRef.current;
          if (idleTime < idleLimitMs - warningWindowMs) {
            setIsWarningOpen(false);
          }
        }
      } else if (e.key === 'gsa_session_started' && e.newValue) {
        const val = parseInt(e.newValue, 10);
        if (!isNaN(val)) {
          sessionStartedRef.current = val;
        }
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    return () => window.removeEventListener('storage', handleStorageEvent);
  }, [idleLimitMs, warningWindowMs]);

  // Activity listeners (mouse movement throttled to 1s, clicks, key presses, scroll, touch, tab visibility)
  useEffect(() => {
    if (!isEligible) return;

    let lastMoveThrottle = 0;
    const handleMouseMove = () => {
      // If warning dialog is currently open in idle mode, user must click button or hit Escape
      if (isWarningOpen) return;
      const now = Date.now();
      if (now - lastMoveThrottle >= 1000) {
        lastMoveThrottle = now;
        recordUserActivity();
      }
    };

    const handleGeneralActivity = () => {
      if (isWarningOpen) return;
      recordUserActivity();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        recordUserActivity();
        // Run check immediately whenever tab becomes visible again
        checkTimeout();
      }
    };

    // Attach activity listeners
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleGeneralActivity, { passive: true });
    window.addEventListener('click', handleGeneralActivity, { passive: true });
    window.addEventListener('keydown', handleGeneralActivity, { passive: true });
    window.addEventListener('scroll', handleGeneralActivity, { passive: true, capture: true });
    window.addEventListener('touchstart', handleGeneralActivity, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleGeneralActivity);
      window.removeEventListener('click', handleGeneralActivity);
      window.removeEventListener('keydown', handleGeneralActivity);
      window.removeEventListener('scroll', handleGeneralActivity, { capture: true });
      window.removeEventListener('touchstart', handleGeneralActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isEligible, isWarningOpen, recordUserActivity]);

  // Core timeout checking function
  const checkTimeout = useCallback(() => {
    if (!isEligible) return;

    const now = Date.now();

    // Read latest from localStorage in case updated elsewhere
    const storedLast = parseInt(localStorage.getItem('gsa_last_activity') || '0', 10);
    const effectiveLast = Math.max(lastActivityRef.current, isNaN(storedLast) ? 0 : storedLast);
    lastActivityRef.current = effectiveLast;

    const storedStart = parseInt(localStorage.getItem('gsa_session_started') || '0', 10);
    const effectiveStart = !isNaN(storedStart) && storedStart > 0
      ? storedStart
      : (sessionStartedRef.current || now);
    sessionStartedRef.current = effectiveStart;

    // 1. Check Maximum Session Length
    const sessionDuration = now - effectiveStart;
    if (sessionDuration >= maxSessionMs) {
      setWarningType('max_session');
      setSecondsRemaining(0);
      setIsWarningOpen(true);
      return;
    }

    // 2. Check Idle Timeout
    const idleDuration = now - effectiveLast;
    if (idleDuration >= idleLimitMs) {
      executeTimeoutSignOut('idle');
      return;
    }

    // 3. Check Warning Window (WARNING_SECONDS before limit)
    const remainingIdleMs = idleLimitMs - idleDuration;
    if (remainingIdleMs <= warningWindowMs) {
      const remainingSecs = Math.max(1, Math.ceil(remainingIdleMs / 1000));
      setSecondsRemaining(remainingSecs);
      setWarningType('idle');
      setIsWarningOpen(true);
    } else {
      if (isWarningOpen && warningType === 'idle') {
        setIsWarningOpen(false);
      }
    }
  }, [isEligible, maxSessionMs, idleLimitMs, warningWindowMs, executeTimeoutSignOut, isWarningOpen, warningType]);

  // Periodic 5-second check
  useEffect(() => {
    if (!isEligible) return;

    // Initial check
    checkTimeout();

    const interval = setInterval(checkTimeout, 5000);
    return () => clearInterval(interval);
  }, [isEligible, checkTimeout]);

  // 1-second live countdown ticker while warning modal is active
  useEffect(() => {
    if (!isWarningOpen || warningType !== 'idle' || !isEligible) return;

    const ticker = setInterval(() => {
      const now = Date.now();
      const storedLast = parseInt(localStorage.getItem('gsa_last_activity') || '0', 10);
      const effectiveLast = Math.max(lastActivityRef.current, isNaN(storedLast) ? 0 : storedLast);
      const idleDuration = now - effectiveLast;
      const remainingIdleMs = idleLimitMs - idleDuration;

      if (remainingIdleMs <= 0) {
        clearInterval(ticker);
        executeTimeoutSignOut('idle');
        return;
      }

      // If activity in another tab extended the session past the warning threshold:
      if (remainingIdleMs > warningWindowMs) {
        setIsWarningOpen(false);
        return;
      }

      const remainingSecs = Math.max(0, Math.ceil(remainingIdleMs / 1000));
      setSecondsRemaining(remainingSecs);
    }, 1000);

    return () => clearInterval(ticker);
  }, [isWarningOpen, warningType, isEligible, idleLimitMs, warningWindowMs, executeTimeoutSignOut]);

  return {
    isWarningOpen,
    warningType,
    secondsRemaining,
    handleStaySignedIn,
    handleTimeoutSignOut: () => executeTimeoutSignOut(warningType),
  };
}
