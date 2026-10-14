import React from 'react';
import { AuthLayout } from './components/auth/AuthLayout';
import { LoginForm } from './components/auth/LoginForm';
import { SignUpForm } from './components/auth/SignUpForm';
import { ChatLayout } from './components/chat/ChatLayout';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminLayout } from './components/admin/AdminLayout';
import { LogoutDialog } from './components/common/LogoutDialog';
import { SessionTimeoutModal } from './components/common/SessionTimeoutModal';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { NotFound } from './components/common/NotFound';
import { PrivacyNoticeModal } from './components/common/PrivacyNoticeModal';
import { SuspendedNotice } from './components/common/SuspendedNotice';
import { VerifyEmailNotice } from './components/auth/VerifyEmailNotice';
import { WaitingForApprovalNotice } from './components/auth/WaitingForApprovalNotice';
import { ReportModal } from './components/common/ReportModal';
import { AppProvider, useApp } from './context/AppContext';
import { UserSession } from './types';
import { AlertCircle, WifiOff, Loader2 } from 'lucide-react';

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
    retryAuthProfile,
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

  const [pendingEmail, setPendingEmail] = React.useState<string>('');

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
      return 'Create your account';
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

  // Initial authentication loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0B141A] text-[#E9EDEF] flex items-center justify-center p-4">
        <div className="w-full max-w-[420px] bg-[#1F2C33] rounded-[12px] border border-white/[0.08] p-8 flex flex-col items-center justify-center space-y-4 text-center">
          <Loader2 className="w-8 h-8 text-[#00A884] animate-spin" />
          <p className="text-[14px] text-[#8696A0] font-medium">Signing you in securely...</p>
        </div>
      </div>
    );
  }



  // Email verification screen for email/password users whose email is not verified
  if (
    screen === 'verify_email' ||
    (currentSession &&
      currentSession.providerId === 'password' &&
      !currentSession.emailVerified)
  ) {
    return (
      <VerifyEmailNotice
        email={pendingEmail || currentSession?.email || ''}
        onVerified={() => {
          if (currentSession?.status === 'approved') {
            setScreen('chat');
          } else {
            setScreen('login');
          }
        }}
        onSignOut={confirmLogout}
      />
    );
  }

  // Waiting for approval screen: pending accounts
  if (currentSession && currentSession.status === 'pending') {
    return <WaitingForApprovalNotice user={currentSession} onSignOut={confirmLogout} />;
  }

  // Suspended account screen: lives updates live without refresh when reactivated
  if (currentSession && currentSession.status === 'suspended') {
    return <SuspendedNotice onSignOut={confirmLogout} />;
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
      <LogoutDialog
        isOpen={isLogoutOpen}
        onClose={closeLogoutDialog}
        onConfirm={confirmLogout}
      />

      {/* Session Timeout Warning and Expiration Modal */}
      <SessionTimeoutModal
        isOpen={isWarningOpen}
        type={warningType}
        secondsRemaining={secondsRemaining}
        onStaySignedIn={handleStaySignedIn}
        onSignOut={handleTimeoutSignOut}
      />

      {/* Read-Only Privacy Notice Dialog (from menu) */}
      <PrivacyNoticeModal
        isOpen={isPrivacyModalOpen}
        onClose={closePrivacyModal}
        isReadOnly={true}
      />

      {/* First-time Full-page Privacy Notice (shown once before chat opens) */}
      {needsPrivacyNotice && (
        <PrivacyNoticeModal
          isOpen={true}
          onClose={() => {}}
          isReadOnly={false}
          onAccept={acceptPrivacyNotice}
        />
      )}

      {/* Report Modal (for reporting a message or app problem) */}
      <ReportModal
        isOpen={reportModalTarget !== null}
        onClose={closeReportModal}
        target={reportModalTarget}
        reporterId={currentSession?.uid || ''}
        reporterName={currentSession?.fullName || 'Staff Member'}
        onSuccessToast={showToast}
      />

      {/* Screen 1: Admin Dashboard (Governance, Approvals, Roles) */}
      {screen === 'admin_dashboard' && <AdminLayout />}

      {/* Screen 2: Admin Login */}
      {screen === 'admin_login' && <AdminLogin />}

      {/* Screen 3: Staff Chat (Edge-to-edge secure WhatsApp Web style) */}
      {screen === 'chat' && currentSession && !needsPrivacyNotice && (
        <ChatLayout user={currentSession} onLogout={openLogoutDialog} />
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
              onEmailVerificationNeeded={(email) => {
                setPendingEmail(email);
                setScreen('verify_email');
              }}
            />
          )}

          {screen === 'signup' && (
            <SignUpForm
              onSuccess={handleSignUpSuccess}
              onNavigateLogin={handleNavigateToLogin}
              onEmailVerificationNeeded={(email) => {
                setPendingEmail(email);
                setScreen('verify_email');
              }}
            />
          )}

          {screen === 'verifying_keys' && (
            <div className="flex flex-col items-center justify-center py-8 text-center select-none">
              <Loader2 className="w-8 h-8 text-[#00A884] animate-spin mb-3" strokeWidth={2} />
              <p className="text-[15px] font-medium text-[#E9EDEF]">Signing you in...</p>
            </div>
          )}
        </AuthLayout>
      )}

      {/* Screen 5: 404 Not Found Screen */}
      {screen === 'not_found' && (
        <NotFound onBackToLogin={() => setScreen('login')} />
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
