import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AuthScreen,
  OrgUser,
  UserRole,
  UserSession,
  AuditLogEntry,
  AuditCategory,
  ChannelRetentionPolicy,
  DirectoryUser,
  ReportDoc,
  HistoryRequest,
  ChannelDoc,
  MyMeetingDoc,
  MeetingReminderToastData,
} from '../types';
import { auth, firebaseConfigError } from '../lib/firebase';
import {
  getUserProfile,
  bootstrapAdminProfileIfNeeded,
  subscribeToAllUsers,
  subscribeToAuditLogs,
  approveUserInFirestore,
  rejectUserInFirestore,
  updateUserRoleAndChannelsInFirestore,
  logAuditToFirestore,
  logoutFirebase,
  unsubscribeAllActiveListeners,
  syncUserToDirectory,
  subscribeToUserDoc,
  ensureDefaultChannelsExist,
  subscribeToDirectory,
  updateUserAvatarInDirectory,
  adminRemoveUserAvatarPhoto,
  updateUserStatusInFirestore,
  acceptPrivacyNoticeInFirestore,
  subscribeToReports,
  subscribeToChannels,
  updateChannelInFirestore,
  Timestamp,
  updateUserChannelHistoryFrom,
  subscribeToAllHistoryRequests,
  approveHistoryRequestInFirestore,
  declineHistoryRequestInFirestore,
  subscribeToRetentionPolicies,
  saveRetentionPolicyInFirestore,
  createStaffProfile,
  subscribeToUserMyMeetings,
  getMeetingDoc,
  syncMyMeetingDoc,
  removeMyMeetingDoc,
} from '../lib/firebaseService';
import {
  normalizeChannelId,
  getChannelDisplayName,
  displayChannelName,
} from '../lib/channelAvatars';
import {
  recordSessionApprovedAdmin,
  wasSessionApprovedAdmin,
  clearSessionApprovedAdmins,
} from '../lib/sessionAdminMemory';

export type AdminSection =
  | 'dashboard'
  | 'pending'
  | 'roles'
  | 'channels'
  | 'retention'
  | 'checklist'
  | 'reports'
  | 'history_requests'
  | 'meetings';

export const ALL_CHANNELS = [
  'General',
  'Finance Team',
  'IT Support',
  'Executive Board',
];

export interface ReportModalTarget {
  type: 'message' | 'app';
  conversationType?: 'channel' | 'direct';
  conversationId?: string;
  messageId?: string;
}

interface AppContextType {
  screen: AuthScreen;
  setScreen: (screen: AuthScreen) => void;
  users: OrgUser[];
  auditLogs: AuditLogEntry[];
  retentionPolicies: ChannelRetentionPolicy[];
  currentSession: UserSession | null;
  setCurrentSession: (session: UserSession | null) => void;
  adminSection: AdminSection;
  setAdminSection: (section: AdminSection) => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
  isLogoutOpen: boolean;
  openLogoutDialog: () => void;
  closeLogoutDialog: () => void;
  confirmLogout: () => Promise<void>;
  approveUser: (
    userId: string,
    role: UserRole,
    channels: string[],
    historyFromOptions?: Record<string, 'now' | 'full'>
  ) => Promise<void>;
  rejectUser: (userId: string) => Promise<void>;
  reconsiderUser: (userId: string) => Promise<void>;
  suspendUser: (userId: string) => Promise<void>;
  reactivateUser: (userId: string) => Promise<void>;
  updateUserRoleAndChannels: (
    userId: string,
    role: UserRole,
    channels: string[],
    historyFromUpdates?: Record<string, 'now' | 'full'>
  ) => Promise<void>;
  changeUserChannelHistoryAccess: (
    userId: string,
    channelId: string,
    mode: 'now' | 'full'
  ) => Promise<void>;
  historyRequests: HistoryRequest[];
  openHistoryRequestsCount: number;
  approveHistoryRequest: (
    requestId: string,
    uid: string,
    channelId: string,
    userName: string,
    channelName: string
  ) => Promise<void>;
  declineHistoryRequest: (
    requestId: string,
    uid: string,
    channelId: string,
    userName: string,
    channelName: string
  ) => Promise<void>;
  getUserByEmail: (email: string) => OrgUser | undefined;
  addAuditEntry: (
    actor: string,
    action: string,
    details: string,
    category: AuditCategory
  ) => Promise<void>;
  saveRetentionPolicies: (policies: ChannelRetentionPolicy[]) => Promise<void>;
  loadMoreAuditLogs: () => void;
  authFlowInProgress: boolean;
  setAuthFlowInProgress: (inProgress: boolean) => void;
  notificationsEnabled: boolean;
  toggleNotifications: () => void;
  authLoading: boolean;
  configError: string | null;
  isOffline: boolean;
  directoryUsers: DirectoryUser[];
  directoryMap: Record<string, DirectoryUser>;
  directoryLoading: boolean;
  getDirectoryUser: (uid?: string) => DirectoryUser | undefined;
  isProfileOpen: boolean;
  openProfileDialog: () => void;
  closeProfileDialog: () => void;
  updateUserProfileAvatar: (
    avatarMode: 'initials' | 'photo',
    avatarColor: string,
    avatarPhoto: string
  ) => Promise<void>;
  adminRemoveUserPhoto: (targetUid: string, targetName: string) => Promise<void>;
  isPrivacyModalOpen: boolean;
  openPrivacyModal: () => void;
  closePrivacyModal: () => void;
  acceptPrivacyNotice: () => Promise<void>;
  reportModalTarget: ReportModalTarget | null;
  openReportModal: (target: ReportModalTarget) => void;
  closeReportModal: () => void;
  openReportsCount: number;
  channelsList: ChannelDoc[];
  channelsMap: Record<string, ChannelDoc>;
  channelsLoading: boolean;
  getChannelDoc: (channelIdOrName: string) => ChannelDoc | undefined;
  updateChannelData: (
    channelId: string,
    payload: {
      avatarMode: 'icon' | 'photo';
      avatarIcon: string;
      avatarColor: string;
      avatarPhoto: string;
      description: string;
    }
  ) => Promise<void>;
  clearAppCaches: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  mutedChannelIds: string[];
  isChannelMuted: (channelId: string) => boolean;
  toggleMuteChannel: (channelId: string) => void;
  navToChatId: string | null;
  navToMessageId: string | null;
  navigateToChatMessage: (chatId: string, messageId?: string) => void;
  clearNavToChatMessage: () => void;
  isServiceBusy: boolean;
  retryAuthProfile: () => Promise<void>;
  myMeetings: MyMeetingDoc[];
  meetingReminder: MeetingReminderToastData | null;
  clearMeetingReminder: () => void;
  openMeetingConversation: (conversationType: 'channel' | 'direct', conversationId: string) => void;
  isMyMeetingsPageOpen: boolean;
  setIsMyMeetingsPageOpen: (open: boolean) => void;
  openMeetingsPanelChatId: string | null;
  setOpenMeetingsPanelChatId: (chatId: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const INITIAL_RETENTION_POLICIES: ChannelRetentionPolicy[] = [
  { channelName: 'General', messageExpiry: '90 days', fileExpiry: '30 days' },
  { channelName: 'Finance Team', messageExpiry: '1 year', fileExpiry: '90 days' },
  { channelName: 'IT Support', messageExpiry: '30 days', fileExpiry: '30 days' },
  { channelName: 'Executive Board', messageExpiry: 'Never', fileExpiry: 'Never' },
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getInitialScreen = (): AuthScreen => {
    if (typeof window !== 'undefined' && window.location) {
      const path = window.location.pathname;
      if (path.startsWith('/admin')) {
        return 'admin_login';
      }
      if (path !== '/' && path !== '' && path !== '/index.html') {
        return 'not_found';
      }
    }
    return 'login';
  };

  const [screen, setScreenState] = useState<AuthScreen>(getInitialScreen);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [retentionPolicies, setRetentionPolicies] = useState<ChannelRetentionPolicy[]>(
    INITIAL_RETENTION_POLICIES
  );
  const [currentSession, setCurrentSession] = useState<UserSession | null>(null);
  const currentSessionRef = useRef<UserSession | null>(null);
  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);
  const [adminSection, setAdminSection] = useState<AdminSection>('dashboard');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [isServiceBusy, setIsServiceBusy] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>([]);
  const [directoryMap, setDirectoryMap] = useState<Record<string, DirectoryUser>>({});
  const [directoryLoading, setDirectoryLoading] = useState<boolean>(true);
  const [channelsList, setChannelsList] = useState<ChannelDoc[]>([]);
  const [channelsMap, setChannelsMap] = useState<Record<string, ChannelDoc>>({});
  const [channelsLoading, setChannelsLoading] = useState<boolean>(true);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState<boolean>(false);
  const [reportModalTarget, setReportModalTarget] = useState<ReportModalTarget | null>(null);
  const [openReportsCount, setOpenReportsCount] = useState<number>(0);
  const [historyRequests, setHistoryRequests] = useState<HistoryRequest[]>([]);
  const openHistoryRequestsCount = historyRequests.filter((r) => r.status === 'open').length;

  // Navigation target when navigating from reports or notifications to a specific chat message
  const [navToChatId, setNavToChatId] = useState<string | null>(null);
  const [navToMessageId, setNavToMessageId] = useState<string | null>(null);

  const navigateToChatMessage = (chatId: string, messageId?: string) => {
    setNavToChatId(chatId);
    setNavToMessageId(messageId || null);
    setScreenState('chat');
  };

  const clearNavToChatMessage = () => {
    setNavToChatId(null);
    setNavToMessageId(null);
  };

  // Shared flag indicating an authentication action is actively running
  const authFlowInProgressRef = useRef<boolean>(false);
  const [authFlowInProgress, setAuthFlowInProgressState] = useState<boolean>(false);
  const setAuthFlowInProgress = (inProgress: boolean) => {
    authFlowInProgressRef.current = inProgress;
    setAuthFlowInProgressState(inProgress);
  };

  // 1. Theme State (Device-wide in localStorage under "gsa-theme", dark is default, client-only)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('gsa-theme');
        if (saved === 'light' || saved === 'dark') {
          return saved;
        }
      }
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    try {
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme);
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('gsa-theme', theme);
      }
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // 2. Muted Channels (Stored per user uid in localStorage: gsa_muted_channels_${uid})
  const [mutedChannelIds, setMutedChannelIds] = useState<string[]>([]);

  useEffect(() => {
    if (!currentSession?.uid) {
      setMutedChannelIds([]);
      return;
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(`gsa_muted_channels_${currentSession.uid}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setMutedChannelIds(parsed);
            return;
          }
        }
      }
    } catch {}
    setMutedChannelIds([]);
  }, [currentSession?.uid]);

  const isChannelMuted = (channelId: string): boolean => {
    const norm = normalizeChannelId(channelId);
    return mutedChannelIds.some(
      (id) => id === channelId || normalizeChannelId(id) === norm
    );
  };

  const toggleMuteChannel = (channelId: string) => {
    if (!currentSession?.uid) return;
    const norm = normalizeChannelId(channelId);
    setMutedChannelIds((prev) => {
      const alreadyMuted = prev.some(
        (id) => id === channelId || normalizeChannelId(id) === norm
      );
      const next = alreadyMuted
        ? prev.filter((id) => id !== channelId && normalizeChannelId(id) !== norm)
        : [...prev, channelId];
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(
            `gsa_muted_channels_${currentSession.uid}`,
            JSON.stringify(next)
          );
        }
      } catch {}
      return next;
    });
  };

  // Meetings & Reminders state
  const [myMeetings, setMyMeetings] = useState<MyMeetingDoc[]>([]);
  const myMeetingsRef = useRef<MyMeetingDoc[]>([]);
  useEffect(() => {
    myMeetingsRef.current = myMeetings;
  }, [myMeetings]);

  const [meetingReminder, setMeetingReminder] = useState<MeetingReminderToastData | null>(null);
  const [isMyMeetingsPageOpen, setIsMyMeetingsPageOpen] = useState<boolean>(false);
  const [openMeetingsPanelChatId, setOpenMeetingsPanelChatId] = useState<string | null>(null);

  const clearMeetingReminder = () => {
    setMeetingReminder(null);
  };

  const openMeetingConversation = (
    conversationType: 'channel' | 'direct',
    conversationId: string
  ) => {
    setIsMyMeetingsPageOpen(false);
    setScreenState('chat');
    setNavToChatId(conversationId);
    setNavToMessageId(null);
    setOpenMeetingsPanelChatId(conversationId);
    setMeetingReminder(null);
  };

  const [auditLogLimit, setAuditLogLimit] = useState<number>(100);
  const loadMoreAuditLogs = () => setAuditLogLimit((prev) => prev + 100);

  const openPrivacyModal = () => setIsPrivacyModalOpen(true);
  const closePrivacyModal = () => setIsPrivacyModalOpen(false);

  const openReportModal = (target: ReportModalTarget) => setReportModalTarget(target);
  const closeReportModal = () => setReportModalTarget(null);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync browser pathname
  const setScreen = (newScreen: AuthScreen) => {
    setScreenState(newScreen);
    if (typeof window !== 'undefined' && window.history) {
      if (newScreen === 'admin_login' || newScreen === 'admin_dashboard') {
        if (!window.location.pathname.startsWith('/admin')) {
          window.history.pushState(null, '', '/admin');
        }
      } else if (newScreen === 'not_found') {
        // preserve current pathname
      } else {
        if (window.location.pathname.startsWith('/admin') || window.location.pathname !== '/') {
          window.history.pushState(null, '', '/');
        }
      }
    }
  };

  // Listen to popstate
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/admin')) {
        setScreenState((prev) => (prev === 'admin_dashboard' ? 'admin_dashboard' : 'admin_login'));
      } else if (path === '/' || path === '' || path === '/index.html') {
        setScreenState((prev) => (prev === 'chat' ? 'chat' : 'login'));
      } else {
        setScreenState('not_found');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Firebase Auth session persistence - reads Firestore ONLY when signed in
  useEffect(() => {
    let isSubscribed = true;

    // Safety fallback timer: ensure authLoading is never stuck indefinitely
    const authSafetyTimer = setTimeout(() => {
      if (isSubscribed) {
        setAuthLoading(false);
      }
    }, 1500);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(authSafetyTimer);

      if (!firebaseUser) {
        setCurrentSession(null);
        setScreenState((prev) => {
          if (prev === 'admin_dashboard' || prev === 'admin_signup') {
            return 'admin_login';
          }
          if (prev === 'chat' || prev === 'verifying_keys' || prev === 'verify_email') {
            return 'login';
          }
          return prev;
        });
        setAuthLoading(false);
        return;
      }

      try {
        const isPasswordProvider = firebaseUser.providerData.some(
          (p) => p.providerId === 'password'
        );
        const isEmailVerified = firebaseUser.emailVerified;

        let profileResult = await getUserProfile(firebaseUser.uid);
        let profile = profileResult.profile;
        let isBusy = Boolean(profileResult.isBusy);

        if (!profile && firebaseUser.email?.toLowerCase() === 'dmbogo20@gmail.com') {
          const bootRes = await bootstrapAdminProfileIfNeeded(firebaseUser);
          profile = bootRes.profile;
          if (bootRes.isBusy) isBusy = true;
        }

        // Wait if an authentication handler is actively writing the profile (max 2 seconds)
        if (!profile && authFlowInProgressRef.current) {
          let waited = 0;
          while (authFlowInProgressRef.current && waited < 20) {
            await new Promise((r) => setTimeout(r, 100));
            waited++;
          }
          profileResult = await getUserProfile(firebaseUser.uid);
          profile = profileResult.profile;
          if (profileResult.isBusy) isBusy = true;
        }

        // If no flow is in progress and profile is still null, create pending profile
        if (!profile && !isBusy) {
          if (firebaseUser.email?.toLowerCase() === 'dmbogo20@gmail.com') {
            const bootRes = await bootstrapAdminProfileIfNeeded(firebaseUser);
            profile = bootRes.profile;
            if (bootRes.isBusy) isBusy = true;
          } else {
            try {
              profile = await createStaffProfile(
                firebaseUser,
                firebaseUser.displayName || 'Staff Member',
                'Operations',
                isPasswordProvider ? 'password' : 'google'
              );
            } catch (createErr: any) {
              const errMsg = String(createErr);
              if (errMsg.includes('busy') || errMsg.includes('resource-exhausted')) {
                isBusy = true;
              }
            }
          }
        }

        // Handle case where profile could not be read
        if (!profile) {
          setCurrentSession(null);
          setIsServiceBusy(false);
          setAuthLoading(false);
          return;
        }

        if (profile) {
          setIsServiceBusy(false);

          // If user was approved and is admin, record in session memory
          if (profile.status === 'approved' && profile.role === 'admin') {
            recordSessionApprovedAdmin(firebaseUser.uid);
          }

          // If user is rejected, sign out and show notification banner
          if (profile.status === 'rejected') {
            try {
              sessionStorage.setItem(
                'gsa_timeout_banner',
                'Your registration was not approved. Contact your administrator.'
              );
            } catch {}
            await logoutFirebase();
            clearSessionApprovedAdmins();
            setCurrentSession(null);
            setScreenState('login');
            return;
          }

          const sessionObj: UserSession = {
            uid: firebaseUser.uid,
            email: profile.email,
            fullName: profile.fullName,
            department: profile.department,
            role: profile.role,
            status: profile.status,
            privacyAcceptedAt: profile.privacyAcceptedAt,
            keyFingerprint:
              profile.role === 'admin'
                ? 'SEC-DEVICE-ADM-01'
                : 'ECC-256: 4F:9A:82:1C:7E:33:B8:2D',
            deviceId:
              profile.role === 'admin' ? 'SEC-DEVICE-ADM-01' : 'SEC-DEVICE-STF-99',
            algorithm:
              profile.role === 'admin'
                ? 'TLS 1.3 + HTTPS Strict Transport'
                : 'TLS 1.3 Standard Transport',
            channels:
              profile.channels && profile.channels.length > 0
                ? profile.channels
                : ['General'],
            historyFrom: profile.historyFrom || {},
            providerId: isPasswordProvider ? 'password' : 'google.com',
            emailVerified: isEmailVerified,
          };

          setCurrentSession(sessionObj);

          if (isPasswordProvider && !isEmailVerified) {
            setScreenState('verify_email');
          } else if (profile.status === 'approved') {
            // Guard: Never show admin screens from a fallback unless the profile came from
            // Firestore's cache AND the user was already an approved admin earlier in the same browser tab session.
            if (profile.role === 'admin') {
              const canAccessAdmin =
                !profileResult.fromCache || wasSessionApprovedAdmin(firebaseUser.uid);
              if (canAccessAdmin) {
                syncUserToDirectory(firebaseUser.uid, profile.fullName, profile.department);
                setScreenState((prev) => (prev === 'admin_login' ? 'admin_dashboard' : prev));
              } else {
                // Not previously verified admin in this session: treat as staff chat or prompt login
                setScreenState('login');
              }
            } else {
              setScreenState((prev) =>
                prev === 'login' || prev === 'signup' || prev === 'verify_email' ? 'chat' : prev
              );
            }
          }
        } else {
          setCurrentSession(null);
        }
      } catch (err: any) {
        console.warn('Auth state change resolution note:', err);
        // On error or resource exhaustion: fall back ONLY to Firestore's own offline cache
        // to keep an ALREADY signed-in, ALREADY approved user in their session.
        let cachedProfile: OrgUser | null = null;
        try {
          const cacheRes = await getUserProfile(firebaseUser.uid);
          if (cacheRes.fromCache && cacheRes.profile) {
            cachedProfile = cacheRes.profile;
          }
        } catch {}

        const isAlreadySignedInSession =
          currentSessionRef.current &&
          currentSessionRef.current.uid === firebaseUser.uid &&
          currentSessionRef.current.status === 'approved';

        if (cachedProfile && isAlreadySignedInSession) {
          // If fallback profile says status is pending, rejected, or suspended, treat it as that status
          if (cachedProfile.status === 'rejected') {
            await logoutFirebase();
            clearSessionApprovedAdmins();
            setCurrentSession(null);
            setScreenState('login');
            return;
          }

          // Never show admin screens from a fallback unless the profile came from Firestore's cache
          // AND the user was already an approved admin earlier in the same tab session.
          const isAllowedAdmin =
            cachedProfile.role === 'admin' &&
            wasSessionApprovedAdmin(firebaseUser.uid);

          const effectiveRole: UserRole = isAllowedAdmin ? 'admin' : (cachedProfile.role === 'admin' ? 'staff' : cachedProfile.role);

          const sessionObj: UserSession = {
            uid: firebaseUser.uid,
            email: cachedProfile.email,
            fullName: cachedProfile.fullName,
            department: cachedProfile.department,
            role: effectiveRole,
            status: cachedProfile.status,
            privacyAcceptedAt: cachedProfile.privacyAcceptedAt,
            keyFingerprint:
              effectiveRole === 'admin'
                ? 'SEC-DEVICE-ADM-01'
                : 'ECC-256: 4F:9A:82:1C:7E:33:B8:2D',
            deviceId:
              effectiveRole === 'admin' ? 'SEC-DEVICE-ADM-01' : 'SEC-DEVICE-STF-99',
            algorithm:
              effectiveRole === 'admin'
                ? 'TLS 1.3 + HTTPS Strict Transport'
                : 'TLS 1.3 Standard Transport',
            channels:
              cachedProfile.channels && cachedProfile.channels.length > 0
                ? cachedProfile.channels
                : ['General'],
            historyFrom: cachedProfile.historyFrom || {},
            providerId: firebaseUser.providerData.some((p) => p.providerId === 'password')
              ? 'password'
              : 'google.com',
            emailVerified: firebaseUser.emailVerified,
          };
          setCurrentSession(sessionObj);
          if (cachedProfile.status === 'approved') {
            if (isAllowedAdmin) {
              setScreenState((prev) => (prev === 'admin_login' ? 'admin_dashboard' : prev));
            } else {
              setScreenState((prev) => (prev === 'login' || prev === 'signup' || prev === 'verify_email' ? 'chat' : prev));
            }
          }
        } else {
          setCurrentSession(null);
        }
      } finally {
        if (isSubscribed) setAuthLoading(false);
      }
    });

    return () => {
      isSubscribed = false;
      clearTimeout(authSafetyTimer);
      unsubscribe();
    };
  }, []);

  const retryAuthProfile = async () => {
    const user = auth.currentUser;
    if (!user) {
      setIsServiceBusy(false);
      return;
    }
    setAuthLoading(true);
    setIsServiceBusy(false);
    try {
      let profRes = await getUserProfile(user.uid);
      let profile = profRes.profile;
      let isBusy = Boolean(profRes.isBusy);

      if (!profile && user.email?.toLowerCase() === 'dmbogo20@gmail.com') {
        const bootRes = await bootstrapAdminProfileIfNeeded(user);
        profile = bootRes.profile;
        if (bootRes.isBusy) isBusy = true;
      }

      if (!profile && !isBusy) {
        if (user.email?.toLowerCase() === 'dmbogo20@gmail.com') {
          const bootRes = await bootstrapAdminProfileIfNeeded(user);
          profile = bootRes.profile;
          if (bootRes.isBusy) isBusy = true;
        } else {
          try {
            const isPassword = user.providerData.some((p) => p.providerId === 'password');
            profile = await createStaffProfile(
              user,
              user.displayName || 'Staff Member',
              'Operations',
              isPassword ? 'password' : 'google'
            );
          } catch (createErr: any) {
            const errMsg = String(createErr);
            if (errMsg.includes('busy') || errMsg.includes('resource-exhausted')) {
              isBusy = true;
            }
          }
        }
      }

      if (profile) {
        setIsServiceBusy(false);
        if (profile.role === 'admin' && profile.status === 'approved') {
          recordSessionApprovedAdmin(user.uid);
        }
        if (profile.status === 'rejected') {
          try {
            sessionStorage.setItem(
              'gsa_timeout_banner',
              'Your registration was not approved. Contact your administrator.'
            );
          } catch {}
          await logoutFirebase();
          clearSessionApprovedAdmins();
          setCurrentSession(null);
          setScreenState('login');
          return;
        }

        const isPasswordProvider = user.providerData.some((p) => p.providerId === 'password');
        const sessionObj: UserSession = {
          uid: user.uid,
          email: profile.email,
          fullName: profile.fullName,
          department: profile.department,
          role: profile.role,
          status: profile.status,
          privacyAcceptedAt: profile.privacyAcceptedAt,
          keyFingerprint:
            profile.role === 'admin'
              ? 'SEC-DEVICE-ADM-01'
              : 'ECC-256: 4F:9A:82:1C:7E:33:B8:2D',
          deviceId:
            profile.role === 'admin' ? 'SEC-DEVICE-ADM-01' : 'SEC-DEVICE-STF-99',
          algorithm:
            profile.role === 'admin'
              ? 'TLS 1.3 + HTTPS Strict Transport'
              : 'TLS 1.3 Standard Transport',
          channels:
            profile.channels && profile.channels.length > 0
              ? profile.channels
              : ['General'],
          historyFrom: profile.historyFrom || {},
          providerId: isPasswordProvider ? 'password' : 'google.com',
          emailVerified: user.emailVerified,
        };
        setCurrentSession(sessionObj);
        if (isPasswordProvider && !user.emailVerified) {
          setScreenState('verify_email');
        } else if (profile.status === 'approved') {
          if (profile.role === 'admin') {
            const canAccessAdmin = !profRes.fromCache || wasSessionApprovedAdmin(user.uid);
            if (canAccessAdmin) {
              syncUserToDirectory(user.uid, profile.fullName, profile.department);
              setScreenState((prev) => (prev === 'admin_login' ? 'admin_dashboard' : prev));
            } else {
              setScreenState('login');
            }
          } else {
            setScreenState((prev) => (prev === 'login' || prev === 'signup' || prev === 'verify_email' ? 'chat' : prev));
          }
        }
      } else {
        if (isBusy) {
          setIsServiceBusy(true);
        } else {
          setCurrentSession(null);
        }
      }
    } catch {
      setIsServiceBusy(true);
    } finally {
      setAuthLoading(false);
    }
  };

  // Real-time listener for current user's profile to instantly update channels or status without a refresh
  useEffect(() => {
    if (!currentSession?.uid || !auth.currentUser) return;

    const unsub = subscribeToUserDoc(currentSession.uid, async (freshProfile) => {
      if (!freshProfile) {
        // Document deleted / missing
        try {
          sessionStorage.setItem(
            'gsa_timeout_banner',
            'Your account is no longer available. Contact your administrator.'
          );
        } catch {}
        await logoutFirebase();
        unsubscribeAllActiveListeners();
        setCurrentSession(null);
        setScreenState('login');
        return;
      }

      if (freshProfile.status === 'rejected') {
        // Status changed to rejected
        try {
          sessionStorage.setItem(
            'gsa_timeout_banner',
            'Your registration was not approved. Contact your administrator.'
          );
        } catch {}
        await logoutFirebase();
        unsubscribeAllActiveListeners();
        setCurrentSession(null);
        setScreenState('login');
        return;
      }

      setCurrentSession((prev) => {
        if (!prev) return prev;
        const prevChannels = (prev.channels || []).slice().sort().join(',');
        const nextChannels = (freshProfile.channels || []).slice().sort().join(',');
        const prevHistory = JSON.stringify(prev.historyFrom || {});
        const nextHistory = JSON.stringify(freshProfile.historyFrom || {});
        if (
          prevChannels !== nextChannels ||
          prevHistory !== nextHistory ||
          prev.role !== freshProfile.role ||
          prev.status !== freshProfile.status ||
          prev.privacyAcceptedAt !== freshProfile.privacyAcceptedAt
        ) {
          if (prev.status === 'pending' && freshProfile.status === 'approved') {
            if (freshProfile.role === 'admin') {
              setScreenState('admin_dashboard');
            } else {
              setScreenState('chat');
            }
          }
          return {
            ...prev,
            role: freshProfile.role,
            status: freshProfile.status,
            channels: freshProfile.channels || ['General'],
            historyFrom: freshProfile.historyFrom || {},
            privacyAcceptedAt: freshProfile.privacyAcceptedAt,
          };
        }
        return prev;
      });
    });

    return () => unsub();
  }, [currentSession?.uid]);

  // Real-time reports subscription for administrators
  useEffect(() => {
    const isAdmin = currentSession?.role === 'admin' && currentSession?.status === 'approved';
    if (!isAdmin) {
      setOpenReportsCount(0);
      return;
    }

    const unsub = subscribeToReports(
      (list) => {
        setOpenReportsCount(list.filter((r) => r.status === 'open').length);
      },
      (err) => {
        console.warn('Reports badge subscription error:', err);
      }
    );

    return () => unsub();
  }, [currentSession?.role, currentSession?.status]);

  // Real-time history requests subscription for administrators
  useEffect(() => {
    const isAdmin =
      (currentSession?.role === 'admin' || screen === 'admin_dashboard') &&
      currentSession?.status === 'approved' &&
      auth.currentUser !== null;
    if (!isAdmin) {
      setHistoryRequests([]);
      return;
    }

    const unsub = subscribeToAllHistoryRequests(
      (list) => {
        setHistoryRequests(list);
      },
      (err) => {
        console.warn('History requests subscription error:', err);
      }
    );

    return () => unsub();
  }, [currentSession?.role, currentSession?.status, screen]);

  // Single subscription to directory documents for all approved members
  useEffect(() => {
    if (!currentSession?.uid || currentSession.status !== 'approved' || !auth.currentUser) {
      setDirectoryUsers([]);
      setDirectoryMap({});
      setDirectoryLoading(false);
      return;
    }

    setDirectoryLoading(true);
    const unsub = subscribeToDirectory((list) => {
      setDirectoryUsers(list.filter((u) => u.uid !== currentSession.uid));
      const map: Record<string, DirectoryUser> = {};
      list.forEach((u) => {
        map[u.uid] = u;
      });
      setDirectoryMap(map);
      setDirectoryLoading(false);
    });

    return () => unsub();
  }, [currentSession?.uid, currentSession?.status]);

  // Live subscription to retention policies in Firestore: retentionPolicies/{channelId}
  useEffect(() => {
    if (!currentSession?.uid || currentSession.status !== 'approved' || !auth.currentUser) {
      return;
    }

    const unsub = subscribeToRetentionPolicies((policiesMap) => {
      setRetentionPolicies((prev) =>
        prev.map((def) => {
          const normId = normalizeChannelId(def.channelName);
          const docData = policiesMap[normId] || policiesMap[def.channelName];
          if (docData) {
            return {
              ...def,
              messageExpiry: docData.messageExpiry || def.messageExpiry,
              fileExpiry: docData.fileExpiry || def.fileExpiry,
            };
          }
          return def;
        })
      );
    });

    return () => unsub();
  }, [currentSession?.uid, currentSession?.status]);

  // Single shared subscription to channels collection for approved members
  useEffect(() => {
    if (!currentSession?.uid || currentSession.status !== 'approved' || !auth.currentUser) {
      setChannelsList([]);
      setChannelsMap({});
      setChannelsLoading(false);
      return;
    }

    setChannelsLoading(true);
    const unsub = subscribeToChannels(
      (list) => {
        setChannelsList(list);
        const map: Record<string, ChannelDoc> = {};
        list.forEach((ch) => {
          map[ch.id] = ch;
          const norm = normalizeChannelId(ch.id);
          map[norm] = ch;
          if (ch.name) {
            map[ch.name] = ch;
            map[normalizeChannelId(ch.name)] = ch;
          }
        });
        setChannelsMap(map);
        setChannelsLoading(false);
      },
      (err) => {
        console.warn('Channels subscription error:', err);
        setChannelsLoading(false);
      }
    );

    return () => unsub();
  }, [currentSession?.uid, currentSession?.status]);

  // Live subscription to user's upcoming personal meetings from users/{uid}/myMeetings
  // Exactly one listener: startsAt >= now, ordered by startsAt, limit 20
  useEffect(() => {
    if (!currentSession?.uid || currentSession.status !== 'approved' || !auth.currentUser) {
      setMyMeetings([]);
      return;
    }

    const unsub = subscribeToUserMyMeetings(
      currentSession.uid,
      (list) => {
        setMyMeetings(list);
      },
      (err) => {
        console.warn('myMeetings subscription error:', err);
      }
    );

    return () => unsub();
  }, [currentSession?.uid, currentSession?.status]);

  // Background meeting reminders check every 30 seconds
  // At 15 minutes before and at start time, fetch meeting document once to confirm it is still scheduled
  // and time did not change, then show existing toast style notification with an "Open" button.
  // Fired reminders tracked in sessionStorage (keys "gsa_remind_<meetingId>_<15|0>", no personal data).
  // Does not count reminders as user activity for session timeout.
  useEffect(() => {
    if (!currentSession?.uid || currentSession.status !== 'approved') return;

    const checkReminders = async () => {
      const currentList = myMeetingsRef.current;
      if (!currentList || currentList.length === 0) return;

      const now = Date.now();

      for (const item of currentList) {
        if (!item.startsAt) continue;
        const startsAtMs =
          typeof item.startsAt.toMillis === 'function'
            ? item.startsAt.toMillis()
            : typeof item.startsAt.seconds === 'number'
            ? item.startsAt.seconds * 1000
            : new Date(item.startsAt).getTime();

        const diffMinutes = (startsAtMs - now) / 60000;

        // Check 1: 15 minutes before (within window 0 < diffMinutes <= 15)
        if (diffMinutes > 0 && diffMinutes <= 15) {
          const key15 = `gsa_remind_${item.id}_15`;
          let alreadyFired = false;
          try {
            alreadyFired = sessionStorage.getItem(key15) === '1';
          } catch {}

          if (!alreadyFired) {
            const docData = await getMeetingDoc(item.conversationType, item.conversationId, item.id);
            if (docData && docData.status === 'scheduled') {
              const actualStartsAtMs =
                typeof docData.startsAt?.toMillis === 'function'
                  ? docData.startsAt.toMillis()
                  : typeof docData.startsAt?.seconds === 'number'
                  ? docData.startsAt.seconds * 1000
                  : new Date(docData.startsAt).getTime();

              if (actualStartsAtMs !== startsAtMs) {
                syncMyMeetingDoc(currentSession.uid, item.id, {
                  title: docData.title,
                  startsAt: docData.startsAt,
                });
              }

              const actualDiffMins = (actualStartsAtMs - Date.now()) / 60000;
              if (actualDiffMins > 0 && actualDiffMins <= 15) {
                try {
                  sessionStorage.setItem(key15, '1');
                } catch {}
                setMeetingReminder({
                  id: `${item.id}_15`,
                  meetingId: item.id,
                  conversationType: item.conversationType,
                  conversationId: item.conversationId,
                  conversationName: item.conversationName,
                  title: docData.title || item.title,
                  timing: '15',
                });
              }
            } else if (docData && docData.status === 'cancelled') {
              removeMyMeetingDoc(currentSession.uid, item.id);
            }
          }
        }

        // Check 2: At start time (within window -5 <= diffMinutes <= 0)
        if (diffMinutes <= 0 && diffMinutes >= -5) {
          const key0 = `gsa_remind_${item.id}_0`;
          let alreadyFired0 = false;
          try {
            alreadyFired0 = sessionStorage.getItem(key0) === '1';
          } catch {}

          if (!alreadyFired0) {
            const docData = await getMeetingDoc(item.conversationType, item.conversationId, item.id);
            if (docData && docData.status === 'scheduled') {
              try {
                sessionStorage.setItem(key0, '1');
              } catch {}
              setMeetingReminder({
                id: `${item.id}_0`,
                meetingId: item.id,
                conversationType: item.conversationType,
                conversationId: item.conversationId,
                conversationName: item.conversationName,
                title: docData.title || item.title,
                timing: '0',
              });
            } else if (docData && docData.status === 'cancelled') {
              removeMyMeetingDoc(currentSession.uid, item.id);
            }
          }
        }
      }
    };

    const interval = setInterval(checkReminders, 30000);
    const initialTimer = setTimeout(checkReminders, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimer);
    };
  }, [currentSession?.uid, currentSession?.status]);

  const getChannelDoc = (channelIdOrName: string): ChannelDoc | undefined => {
    if (!channelIdOrName) return undefined;
    return channelsMap[channelIdOrName] || channelsMap[normalizeChannelId(channelIdOrName)];
  };

  const updateChannelData = async (
    channelId: string,
    payload: {
      avatarMode: 'icon' | 'photo';
      avatarIcon: string;
      avatarColor: string;
      avatarPhoto: string;
      description: string;
    }
  ) => {
    const norm = normalizeChannelId(channelId);
    const channelName = getChannelDisplayName(channelId);
    await updateChannelInFirestore(norm, payload);
    // Optimistically update channelsMap & channelsList
    setChannelsMap((prev) => {
      const existing = prev[norm] || {
        id: norm,
        name: channelName,
        description: '',
      };
      const updated: ChannelDoc = {
        ...existing,
        avatarMode: payload.avatarMode,
        avatarIcon: payload.avatarIcon,
        avatarColor: payload.avatarColor,
        avatarPhoto: payload.avatarPhoto,
        description: payload.description,
      };
      return {
        ...prev,
        [norm]: updated,
        [channelId]: updated,
        [channelName]: updated,
      };
    });

    await addAuditEntry(
      currentSession?.fullName || 'Security Administrator',
      `Channel avatar updated: ${displayChannelName(channelName)}`,
      `Updated avatar and description for ${displayChannelName(channelName)}`,
      'Role change'
    );
  };

  const getDirectoryUser = (uid?: string): DirectoryUser | undefined => {
    if (!uid) return undefined;
    return directoryMap[uid];
  };

  const openProfileDialog = () => setIsProfileOpen(true);
  const closeProfileDialog = () => setIsProfileOpen(false);

  const updateUserProfileAvatar = async (
    avatarMode: 'initials' | 'photo',
    avatarColor: string,
    avatarPhoto: string
  ) => {
    if (!currentSession?.uid) return;
    try {
      await updateUserAvatarInDirectory(
        currentSession.uid,
        avatarMode,
        avatarColor,
        avatarPhoto
      );
      // Optimistically update directoryMap
      setDirectoryMap((prev) => ({
        ...prev,
        [currentSession.uid]: {
          ...(prev[currentSession.uid] || {
            uid: currentSession.uid,
            displayName: currentSession.fullName,
            department: currentSession.department,
          }),
          avatarMode,
          avatarColor,
          avatarPhoto,
        },
      }));
      showToast('Profile updated');
    } catch (err) {
      console.error('Failed to update avatar in directory:', err);
      showToast('Failed to update profile');
      throw err;
    }
  };

  const adminRemoveUserPhoto = async (targetUid: string, targetName: string) => {
    try {
      await adminRemoveUserAvatarPhoto(targetUid);
      // Optimistically update directoryMap
      setDirectoryMap((prev) => ({
        ...prev,
        [targetUid]: {
          ...(prev[targetUid] || {
            uid: targetUid,
            displayName: targetName,
            department: 'Operations',
          }),
          avatarMode: 'initials',
          avatarPhoto: '',
        },
      }));
      await addAuditEntry(
        currentSession?.email || 'admin',
        'Profile photo removed',
        `Profile photo removed for ${targetName}`,
        'Role change'
      );
      showToast(`Profile photo removed for ${targetName}`);
    } catch (err) {
      console.error('Failed to remove user photo:', err);
      showToast('Failed to remove photo');
      throw err;
    }
  };

  // Real-time Firestore sync for admin pages (when user is admin or on admin screens)
  useEffect(() => {
    const isAdmin =
      (currentSession?.role === 'admin' || screen === 'admin_dashboard') &&
      auth.currentUser !== null;
    if (!isAdmin) return;

    // Ensure 4 default channels exist in Firestore: "general", "finance", "it-support", "executive-board"
    ensureDefaultChannelsExist();

    const unsubUsers = subscribeToAllUsers((realUsers) => {
      setUsers(realUsers);
    });

    const unsubLogs = subscribeToAuditLogs((realLogs) => {
      setAuditLogs(realLogs);
    }, auditLogLimit);

    return () => {
      unsubUsers();
      unsubLogs();
    };
  }, [currentSession, screen, auditLogLimit]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  const openLogoutDialog = () => {
    setIsLogoutOpen(true);
  };

  const closeLogoutDialog = () => {
    setIsLogoutOpen(false);
  };

  const addAuditEntry = async (
    actor: string,
    action: string,
    details: string,
    category: AuditCategory
  ) => {
    const now = new Date();
    const timeStr = `Today at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const newEntry: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: timeStr,
      actor,
      action,
      details,
      category,
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
    try {
      await logAuditToFirestore(newEntry);
    } catch (e) {
      console.warn('Audit log write error:', e);
    }
  };

  const clearAppCaches = () => {
    setUsers([]);
    setAuditLogs([]);
    setDirectoryUsers([]);
    setDirectoryMap({});
    setChannelsList([]);
    setChannelsMap({});
    setCurrentSession(null);
  };

  const confirmLogout = async () => {
    const wasAdmin = currentSession?.role === 'admin' || screen === 'admin_dashboard';
    const email = currentSession?.email || auth.currentUser?.email || 'user';
    const loggedOutUid = currentSession?.uid || auth.currentUser?.uid;
    await addAuditEntry(email, 'Session termination', 'User signed out', 'Auth');
    try {
      unsubscribeAllActiveListeners();
    } catch {}
    clearSessionApprovedAdmins();
    setCurrentSession(null);
    setIsServiceBusy(false);
    setIsLogoutOpen(false);
    clearAppCaches();
    setMutedChannelIds([]);
    try {
      if (typeof document !== 'undefined') {
        document.title = 'Group Secure App - Secure Team Messaging';
      }
    } catch {}
    try {
      localStorage.removeItem('gsa_last_activity');
      localStorage.removeItem('gsa_session_started');
      if (loggedOutUid) {
        localStorage.removeItem(`gsa_muted_channels_${loggedOutUid}`);
      }
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('gsa_draft_') || k.startsWith('draft_') || k.startsWith('gsa_muted_channels_'))) {
          localStorage.removeItem(k);
        }
      }
    } catch {}
    await logoutFirebase();
    if (wasAdmin) {
      setScreen('admin_login');
    } else {
      setScreen('login');
    }
  };

  const getUserByEmail = (email: string): OrgUser | undefined => {
    const lower = email.trim().toLowerCase();
    return users.find((u) => u.email.toLowerCase() === lower);
  };

  const approveUser = async (
    userId: string,
    role: UserRole,
    channels: string[],
    historyFromOptions?: Record<string, 'now' | 'full'>
  ) => {
    const targetUser = users.find((u) => u.id === userId);
    const assignedChannels = channels.length > 0 ? channels : ['General'];

    // Build historyFrom map: default is "From now" (client Timestamp.now()), or Timestamp.fromMillis(0) for "Full history"
    const historyFromMap: Record<string, Timestamp> = {};
    const nowTs = Timestamp.now();
    assignedChannels.forEach((ch) => {
      const normId = normalizeChannelId(ch);
      const opt = historyFromOptions?.[ch] || historyFromOptions?.[normId] || 'now';
      historyFromMap[normId] = opt === 'full' ? Timestamp.fromMillis(0) : nowTs;
    });

    try {
      await approveUserInFirestore(userId, role, assignedChannels, historyFromMap);
      // Create/update directory document for approved user
      await syncUserToDirectory(
        userId,
        targetUser?.fullName || 'Staff Member',
        targetUser?.department || 'Operations',
        assignedChannels
      );
      const roleName = role === 'admin' ? 'Admin' : role === 'team_lead' ? 'Team Lead' : 'Staff';
      await addAuditEntry(
        currentSession?.email || 'admin',
        'Account approved',
        `${targetUser?.fullName || 'User'} approved as ${roleName} with ${assignedChannels.length} channels`,
        'Approval'
      );
      showToast('Account approved');
    } catch (err) {
      console.error('Failed to approve user in Firestore:', err);
      showToast('Failed to approve user');
    }
  };

  const rejectUser = async (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);

    try {
      await rejectUserInFirestore(userId);
      await addAuditEntry(
        currentSession?.email || 'admin',
        'Account registration rejected',
        `Registration rejected for ${targetUser?.fullName || 'User'} (${targetUser?.email || ''})`,
        'Approval'
      );
      showToast('Account rejected');
    } catch (err) {
      console.error('Failed to reject user in Firestore:', err);
      showToast('Failed to reject user');
    }
  };

  const reconsiderUser = async (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);

    try {
      await updateUserStatusInFirestore(userId, 'pending');
      await addAuditEntry(
        currentSession?.email || 'admin',
        'Registration reconsidered',
        `Registration status reset to pending for ${targetUser?.fullName || 'User'} (${targetUser?.email || ''})`,
        'Approval'
      );
      showToast('Applicant returned to pending approvals');
    } catch (err) {
      console.error('Failed to reconsider user in Firestore:', err);
      showToast('Failed to reconsider user');
    }
  };

  const suspendUser = async (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;
    if (userId === currentSession?.uid) {
      showToast('You cannot suspend your own account');
      return;
    }
    if (targetUser.role === 'admin') {
      const approvedAdmins = users.filter((u) => u.role === 'admin' && u.status === 'approved');
      if (approvedAdmins.length <= 1) {
        showToast('Cannot suspend the last remaining administrator');
        return;
      }
    }

    try {
      await updateUserStatusInFirestore(userId, 'suspended');
      await addAuditEntry(
        currentSession?.email || 'admin',
        'User suspended',
        `Account ${targetUser.email} suspended by ${currentSession?.email || 'admin'}`,
        'Role change'
      );
      showToast(`${targetUser.fullName} suspended`);
    } catch (err) {
      console.error('Failed to suspend user in Firestore:', err);
      showToast('Failed to suspend user');
    }
  };

  const reactivateUser = async (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    try {
      await updateUserStatusInFirestore(userId, 'approved');
      await addAuditEntry(
        currentSession?.email || 'admin',
        'User reactivated',
        `Account ${targetUser.email} reactivated by ${currentSession?.email || 'admin'}`,
        'Role change'
      );
      showToast(`${targetUser.fullName} reactivated`);
    } catch (err) {
      console.error('Failed to reactivate user in Firestore:', err);
      showToast('Failed to reactivate user');
    }
  };

  const acceptPrivacyNotice = async () => {
    if (!currentSession?.uid) return;
    try {
      await acceptPrivacyNoticeInFirestore(currentSession.uid);
      setCurrentSession((prev) => (prev ? { ...prev, privacyAcceptedAt: new Date() } : prev));
    } catch (err) {
      console.error('Failed to record privacy notice acceptance:', err);
    }
  };

  const updateUserRoleAndChannels = async (
    userId: string,
    role: UserRole,
    channels: string[],
    historyFromUpdates?: Record<string, 'now' | 'full'>
  ) => {
    const targetUser = users.find((u) => u.id === userId);
    const newChannels = channels.length > 0 ? channels : ['General'];
    const prevChannels = targetUser?.channels || [];

    // History map updates:
    // When an admin removes someone from a channel and later adds them back, the default is "From now" again
    const historyUpdates: Record<string, Timestamp> = {};
    const nowTs = Timestamp.now();
    newChannels.forEach((ch) => {
      const normId = normalizeChannelId(ch);
      const isNewlyAdded = !prevChannels.some((pc) => normalizeChannelId(pc) === normId);
      if (isNewlyAdded || historyFromUpdates?.[ch] || historyFromUpdates?.[normId]) {
        const opt = historyFromUpdates?.[ch] || historyFromUpdates?.[normId] || 'now';
        historyUpdates[normId] = opt === 'full' ? Timestamp.fromMillis(0) : nowTs;
      }
    });

    try {
      await updateUserRoleAndChannelsInFirestore(userId, role, newChannels, historyUpdates);
      await syncUserToDirectory(
        userId,
        targetUser?.fullName || 'Staff Member',
        targetUser?.department || 'Operations',
        newChannels
      );
      const roleName = role === 'admin' ? 'Admin' : role === 'team_lead' ? 'Team Lead' : 'Staff';
      await addAuditEntry(
        currentSession?.email || 'admin',
        'Role & channel reassignment',
        `${targetUser?.fullName || 'User'} updated to ${roleName} with ${newChannels.length} channels`,
        'Role change'
      );
      showToast('Changes saved');
    } catch (err) {
      console.error('Failed to update user in Firestore:', err);
      showToast('Failed to update user');
    }
  };

  const changeUserChannelHistoryAccess = async (
    userId: string,
    channelId: string,
    mode: 'now' | 'full'
  ) => {
    const targetUser = users.find((u) => u.id === userId);
    const normId = normalizeChannelId(channelId);
    const chName = getChannelDisplayName(channelId);
    const ts = mode === 'full' ? Timestamp.fromMillis(0) : Timestamp.now();

    try {
      await updateUserChannelHistoryFrom(userId, normId, ts);
      await addAuditEntry(
        currentSession?.email || 'admin',
        `History access changed for ${targetUser?.fullName || 'User'} in ${displayChannelName(chName)}`,
        `History access changed for ${targetUser?.fullName || 'User'} in ${displayChannelName(chName)} (${mode === 'full' ? 'Full history' : 'From now'})`,
        'Role change'
      );
      showToast(`History access updated for ${targetUser?.fullName || 'User'}`);
    } catch (err) {
      console.error('Failed to update history access in Firestore:', err);
      showToast('Failed to update history access');
    }
  };

  const approveHistoryRequest = async (
    requestId: string,
    uid: string,
    channelId: string,
    userName: string,
    channelName: string
  ) => {
    try {
      await approveHistoryRequestInFirestore(requestId, uid, channelId);
      await addAuditEntry(
        currentSession?.email || 'admin',
        `History access changed for ${userName} in ${displayChannelName(channelName)}`,
        `Approved full history for ${userName} in ${displayChannelName(channelName)}`,
        'Role change'
      );
      showToast(`Approved history request for ${userName}`);
    } catch (err) {
      console.error('Failed to approve history request:', err);
      showToast('Failed to approve request');
    }
  };

  const declineHistoryRequest = async (
    requestId: string,
    uid: string,
    channelId: string,
    userName: string,
    channelName: string
  ) => {
    try {
      await declineHistoryRequestInFirestore(requestId);
      await addAuditEntry(
        currentSession?.email || 'admin',
        'History request declined',
        `Declined history request for ${userName} in ${displayChannelName(channelName)}`,
        'Role change'
      );
      showToast(`Declined history request for ${userName}`);
    } catch (err) {
      console.error('Failed to decline history request:', err);
      showToast('Failed to decline request');
    }
  };

  const saveRetentionPolicies = async (policies: ChannelRetentionPolicy[]) => {
    setRetentionPolicies(policies);
    for (const p of policies) {
      const normId = normalizeChannelId(p.channelName);
      await saveRetentionPolicyInFirestore(normId, {
        channelName: p.channelName,
        messageExpiry: p.messageExpiry,
        fileExpiry: p.fileExpiry,
        updatedBy: currentSession?.email || 'admin',
      });
      await addAuditEntry(
        currentSession?.email || 'admin',
        `Retention policy updated for ${displayChannelName(p.channelName)}`,
        `Retention policy updated for ${displayChannelName(p.channelName)} (Message expiry: ${p.messageExpiry}, File expiry: ${p.fileExpiry})`,
        'Retention'
      );
    }
    showToast('Retention policy saved');
  };

  const toggleNotifications = () => {
    setNotificationsEnabled((prev) => {
      const next = !prev;
      showToast(next ? 'Notifications unmuted' : 'Notifications muted');
      return next;
    });
  };

  return (
    <AppContext.Provider
      value={{
        screen,
        setScreen,
        users,
        auditLogs,
        retentionPolicies,
        currentSession,
        setCurrentSession,
        adminSection,
        setAdminSection,
        toastMessage,
        showToast,
        isLogoutOpen,
        openLogoutDialog,
        closeLogoutDialog,
        confirmLogout,
        approveUser,
        rejectUser,
        reconsiderUser,
        suspendUser,
        reactivateUser,
        updateUserRoleAndChannels,
        changeUserChannelHistoryAccess,
        historyRequests,
        openHistoryRequestsCount,
        approveHistoryRequest,
        declineHistoryRequest,
        getUserByEmail,
        addAuditEntry,
        saveRetentionPolicies,
        loadMoreAuditLogs,
        authFlowInProgress,
        setAuthFlowInProgress,
        notificationsEnabled,
        toggleNotifications,
        authLoading,
        configError: firebaseConfigError,
        isOffline,
        directoryUsers,
        directoryMap,
        directoryLoading,
        getDirectoryUser,
        isProfileOpen,
        openProfileDialog,
        closeProfileDialog,
        updateUserProfileAvatar,
        adminRemoveUserPhoto,
        isPrivacyModalOpen,
        openPrivacyModal,
        closePrivacyModal,
        acceptPrivacyNotice,
        reportModalTarget,
        openReportModal,
        closeReportModal,
        openReportsCount,
        channelsList,
        channelsMap,
        channelsLoading,
        getChannelDoc,
        updateChannelData,
        clearAppCaches,
        theme,
        toggleTheme,
        mutedChannelIds,
        isChannelMuted,
        toggleMuteChannel,
        navToChatId,
        navToMessageId,
        navigateToChatMessage,
        clearNavToChatMessage,
        isServiceBusy,
        retryAuthProfile,
        myMeetings,
        meetingReminder,
        clearMeetingReminder,
        openMeetingConversation,
        isMyMeetingsPageOpen,
        setIsMyMeetingsPageOpen,
        openMeetingsPanelChatId,
        setOpenMeetingsPanelChatId,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
