import React, { lazy, Suspense } from 'react';
import { AuthLayout } from './components/auth/AuthLayout';
import { LoginForm } from './components/auth/LoginForm';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { AppProvider, useApp } from './context/AppContext';
import { UserSession } from './types';
import { AlertCircle, WifiOff } from 'lucide-react';

// Code-split heavy routes & secondary components to reduce initial bundle by >70%
const SignUpForm = lazy(() =>
  import('./components/auth/SignUpForm').then((m) => ({ default: m.SignUpForm }))
);
const ChatLayout = lazy(() =>
  import('./components/chat/ChatLayout').then((m) => ({ default: m.ChatLayout }))
);
const AdminLogin = lazy(() =>
  import('./components/admin/AdminLogin').then((m) => ({ default: m.AdminLogin }))
);
const AdminLayout = lazy(() =>
  import('./components/admin/AdminLayout').then((m) => ({ default: m.AdminLayout }))
);
const LogoutDialog = lazy(() =>
  import('./components/common/LogoutDialog').then((m) => ({ default: m.LogoutDialog }))
);
const SessionTimeoutModal = lazy(() =>
  import('./components/common/SessionTimeoutModal').then((m) => ({ default: m.SessionTimeoutModal }))
);
const NotFound = lazy(() =>
  import('./components/common/NotFound').then((m) => ({ default: m.NotFound }))
);
const PrivacyNoticeModal = lazy(() =>
  import('./components/common/PrivacyNoticeModal').then((m) => ({ default: m.PrivacyNoticeModal }))
);
const SuspendedNotice = lazy(() =>
  import('./components/common/SuspendedNotice').then((m) => ({ default: m.SuspendedNotice }))
);
const WaitingForApprovalNotice = lazy(() =>
  import('./components/auth/WaitingForApprovalNotice').then((m) => ({
    default: m.WaitingForApprovalNotice,
  }))
);
const ReportModal = lazy(() =>
  import('./components/common/ReportModal').then((m) => ({ default: m.ReportModal }))
);

const FastSpinner = () => (
  <div className="min-h-screen bg-[#0B141A] text-[#E9EDEF] flex items-center justify-center p-4">
    <div className="w-8 h-8 border-2 border-[#00A884] border-t-transparent rounded-full animate-spin" />
  </div>
);

function MainApp() {
  const {
    screen,
    setScreen,
    currentSession,
    setCurrentSession,
    isLogoutOpen,
    closeLogoutDialog,
    confirmLogout,
    openLogoutDialog,
    authLoading,
    configError,
    isOffline,
    isPrivacyModalOpen,
    closePrivacyModal,
    acceptPrivacyNotice,
    reportModalTarget,
    closeReportModal,
    showToast,
    addAuditEntry,
    clearAppCaches,
  } = useApp();

  // First-time approved sign-in privacy notice requirement ("Before you start" screen)
  const needsPrivacyNotice = Boolean(
    currentSession &&
    currentSession.status === 'approved' &&
    !currentSession.privacyAcceptedAt
  );

  // Session timeout management (idle timeout & maximum session length)
  const {
    isWarningOpen,
    warningType,
    secondsRemaining,
    handleStaySignedIn,
    handleTimeoutSignOut,
  } = useSessionTimeout({
    currentSession,
    screen,
    needsPrivacyNotice,
    addAuditEntry,
    clearAppCaches,
    setScreen,
  });

  const handleLoginSuccess = (session: UserSession) => {
    setCurrentSession(session);
    if (session.status === 'approved') {
      setScreen('chat');
    } else {
      setScreen('verifying_keys');
    }
  };

  React.useEffect(() => {
    if (screen === 'verifying_keys') {
      if (currentSession?.status === 'approved') {
        setScreen('chat');
      } else if (!currentSession && !authLoading) {
        setScreen('login');
      }
    }
  }, [screen, currentSession, authLoading, setScreen]);

  const handleSignUpSuccess = () => {
    // Form component manages confirmation screen
  };

  const handleNavigateToLogin = () => {
    setScreen('login');
  };

  const handleNavigateToSignUp = () => {
    setScreen('signup');
  };

  const handleNavigateToAdmin = () => {
    setScreen('admin_login');
  };

  const getTitle = () => {
    if (screen === 'signup') {
      return 'Request account access';
    }
    return 'Group Secure App';
  };

  const getSubtitle = () => {
    switch (screen) {
      case 'signup':
        return 'Register with your organization details';
      case 'verifying_keys':
        return 'Signing you in...';
      case 'login':
      default:
        return 'Secure messaging for your organization';
    }
  };

  // Initial authentication loading state (fast, minimal CSS spinner)
  if (authLoading) {
    return <FastSpinner />;
  }

  // Waiting for approval screen: pending accounts
  if (currentSession && currentSession.status === 'pending') {
    return (
      <Suspense fallback={<FastSpinner />}>
        <WaitingForApprovalNotice user={currentSession} onSignOut={confirmLogout} />
      </Suspense>
    );
  }

  // Suspended account screen: lives updates live without refresh when reactivated
  if (currentSession && currentSession.status === 'suspended') {
    return (
      <Suspense fallback={<FastSpinner />}>
        <SuspendedNotice onSignOut={confirmLogout} />
      </Suspense>
    );
  }

  return (
    <>
      {/* Offline Status Banner */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-[#F59E0B] text-black px-4 py-2 text-[13px] font-medium flex items-center justify-center gap-2 shadow-lg">
          <WifiOff className="w-4 h-4 flex-shrink-0 text-black" />
          <span>You are currently offline. Messages will queue and sync when reconnected.</span>
        </div>
      )}

      {/* Visible Configuration Error Banner if missing keys */}
      {configError && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-[#F15C6D] text-white px-4 py-2 text-[13px] font-medium flex items-center justify-center gap-2 shadow-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{configError}</span>
        </div>
      )}

      {/* Centered Logout Confirmation Modal */}
      {isLogoutOpen && (
        <Suspense fallback={null}>
          <LogoutDialog
            isOpen={isLogoutOpen}
            onClose={closeLogoutDialog}
            onConfirm={confirmLogout}
          />
        </Suspense>
      )}

      {/* Session Timeout Warning and Expiration Modal */}
      {isWarningOpen && (
        <Suspense fallback={null}>
          <SessionTimeoutModal
            isOpen={isWarningOpen}
            type={warningType}
            secondsRemaining={secondsRemaining}
            onStaySignedIn={handleStaySignedIn}
            onSignOut={handleTimeoutSignOut}
          />
        </Suspense>
      )}

      {/* Read-Only Privacy Notice Dialog (from menu) */}
      {isPrivacyModalOpen && (
        <Suspense fallback={null}>
          <PrivacyNoticeModal
            isOpen={isPrivacyModalOpen}
            onClose={closePrivacyModal}
            isReadOnly={true}
          />
        </Suspense>
      )}

      {/* First-time Full-page Privacy Notice (shown once before chat opens) */}
      {needsPrivacyNotice && (
        <Suspense fallback={<FastSpinner />}>
          <PrivacyNoticeModal
            isOpen={true}
            onClose={() => {}}
            isReadOnly={false}
            onAccept={acceptPrivacyNotice}
          />
        </Suspense>
      )}

      {/* Report Modal (for reporting a message or app problem) */}
      {reportModalTarget !== null && (
        <Suspense fallback={null}>
          <ReportModal
            isOpen={reportModalTarget !== null}
            onClose={closeReportModal}
            target={reportModalTarget}
            reporterId={currentSession?.uid || ''}
            reporterName={currentSession?.fullName || 'Staff Member'}
            onSuccessToast={showToast}
          />
        </Suspense>
      )}

      {/* Screen 1: Admin Dashboard (Governance, Approvals, Roles) */}
      {screen === 'admin_dashboard' && (
        <Suspense fallback={<FastSpinner />}>
          <AdminLayout />
        </Suspense>
      )}

      {/* Screen 2: Admin Login */}
      {screen === 'admin_login' && (
        <Suspense fallback={<FastSpinner />}>
          <AdminLogin />
        </Suspense>
      )}

      {/* Screen 3: Staff Chat (Edge-to-edge secure WhatsApp Web style) */}
      {screen === 'chat' && currentSession && !needsPrivacyNotice && (
        <Suspense fallback={<FastSpinner />}>
          <ChatLayout user={currentSession} onLogout={openLogoutDialog} />
        </Suspense>
      )}

      {/* Screen 4: Staff Auth Flow (Login, Sign-Up, Verification) */}
      {(screen === 'login' || screen === 'signup' || screen === 'verifying_keys') && (
        <AuthLayout
          title={getTitle()}
          subtitle={getSubtitle()}
          showDemoHint={false}
          isMainLogin={screen === 'login'}
        >
          {screen === 'login' && (
            <LoginForm
              onSuccess={handleLoginSuccess}
              onNavigateSignUp={handleNavigateToSignUp}
              onNavigateAdmin={handleNavigateToAdmin}
            />
          )}

          {screen === 'signup' && (
            <Suspense fallback={<div className="py-12 flex justify-center"><div className="w-6 h-6 border-2 border-[#00A884] border-t-transparent rounded-full animate-spin" /></div>}>
              <SignUpForm
                onSuccess={handleSignUpSuccess}
                onNavigateLogin={handleNavigateToLogin}
              />
            </Suspense>
          )}

          {screen === 'verifying_keys' && (
            <div className="flex flex-col items-center justify-center py-8 text-center select-none">
              <div className="w-7 h-7 border-2 border-[#00A884] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-[15px] font-medium text-[#E9EDEF]">Signing you in...</p>
            </div>
          )}
        </AuthLayout>
      )}

      {/* Screen 5: 404 Not Found Screen */}
      {screen === 'not_found' && (
        <Suspense fallback={<FastSpinner />}>
          <NotFound onBackToLogin={() => setScreen('login')} />
        </Suspense>
      )}
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
