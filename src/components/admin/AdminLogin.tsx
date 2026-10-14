import React, { useState } from 'react';
import { Shield, ArrowLeft, Loader2, AlertCircle, Info, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  signInWithGoogle,
  getUserProfile,
  bootstrapAdminProfileIfNeeded,
  logoutFirebase,
  parseFriendlyError,
  syncUserToDirectory,
} from '../../lib/firebaseService';
import { OrgUser } from '../../types';
import { recordSessionApprovedAdmin } from '../../lib/sessionAdminMemory';

export const AdminLogin: React.FC = () => {
  const { setScreen, setCurrentSession, addAuditEntry } = useApp();

  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [timeoutBanner, setTimeoutBanner] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('gsa_timeout_banner');
    } catch {
      return null;
    }
  });

  const dismissTimeoutBanner = () => {
    setTimeoutBanner(null);
    try {
      sessionStorage.removeItem('gsa_timeout_banner');
    } catch {}
  };

  const verifyAdminUser = async (userOrProfile: any) => {
    let profile: OrgUser | null = null;
    let isBusy = false;
    const emailLower = (userOrProfile.email || '').toLowerCase();

    if ('uid' in userOrProfile) {
      // FirebaseUser from Google
      if (emailLower === 'dmbogo20@gmail.com') {
        const bootRes = await bootstrapAdminProfileIfNeeded(userOrProfile);
        profile = bootRes.profile;
        if (bootRes.isBusy) isBusy = true;
      }
      if (!profile) {
        const profRes = await getUserProfile(userOrProfile.uid);
        profile = profRes.profile;
        if (profRes.isBusy) isBusy = true;
      }
    } else {
      profile = userOrProfile;
    }

    if (!profile) {
      await logoutFirebase();
      if (isBusy) {
        setErrorMessage('The service is busy right now. Please try again later.');
      } else {
        setErrorMessage('This account does not have administrator access');
      }
      return;
    }

    const isAdmin = profile.role === 'admin' && profile.status === 'approved';

    if (!isAdmin) {
      await logoutFirebase();
      setErrorMessage('This account does not have administrator access');
      return;
    }

    const adminUser: OrgUser = profile;
    recordSessionApprovedAdmin(adminUser.id);

    const now = Date.now().toString();
    try {
      localStorage.setItem('gsa_session_started', now);
      localStorage.setItem('gsa_last_activity', now);
      sessionStorage.removeItem('gsa_timeout_banner');
    } catch {}

    // Success: establish elevated Admin session
    setCurrentSession({
      uid: adminUser.id,
      email: adminUser.email,
      fullName: adminUser.fullName,
      department: adminUser.department,
      role: 'admin',
      status: 'approved',
      keyFingerprint: 'SEC-DEVICE-ADM-01',
      deviceId: 'SEC-DEVICE-ADM-01',
      algorithm: 'TLS 1.3 + HTTPS Strict Transport',
      channels: adminUser.channels || ['General', 'Finance Team', 'IT Support', 'Executive Board'],
    });

    // Sync Admin into directory collection
    await syncUserToDirectory(
      adminUser.id,
      adminUser.fullName,
      adminUser.department
    );

    // Audit log for admin login
    await addAuditEntry(
      adminUser.email,
      'Admin login',
      'Elevated governance session established via device SEC-DEVICE-ADM-01',
      'Auth'
    );

    // Go straight to the admin dashboard
    setScreen('admin_dashboard');
  };

  const handleGoogleAdminLogin = async () => {
    setErrorMessage(null);
    setIsLoadingGoogle(true);

    try {
      const { user, error } = await signInWithGoogle();
      if (!user) {
        setIsLoadingGoogle(false);
        if (error) {
          setErrorMessage(error);
        }
        return;
      }

      await verifyAdminUser(user);
    } catch (err: any) {
      setIsLoadingGoogle(false);
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        await logoutFirebase();
        setErrorMessage(parseFriendlyError(err));
      }
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B141A] text-[#E9EDEF] flex flex-col items-center justify-center p-4 antialiased">
      {/* Centered Restrained Card: solid #1F2C33, 12px radius, 1px border rgba(255,255,255,0.08) */}
      <div className="w-full max-w-[420px] bg-[#1F2C33] rounded-[12px] border border-white/[0.08] p-8 flex flex-col">
        {/* Top Icon & Title */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-[10px] bg-[#00A884]/15 border border-[#00A884]/30 text-[#00A884] flex items-center justify-center mb-3">
            <Shield className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <h1 className="text-[24px] font-semibold text-[#E9EDEF] title-tracking leading-tight">
            Administrator Portal
          </h1>
          <p className="text-[14px] text-[#8696A0] mt-1 leading-[1.5]">
            Restricted access. Sign in with your administrator Google account.
          </p>
        </div>

        {/* Calm session timeout info banner */}
        {timeoutBanner && (
          <div className="mb-4 p-3 bg-[#182229] border border-white/[0.12] rounded-[10px] text-[13px] text-[#E9EDEF] flex items-center justify-between gap-2 shadow-sm animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <Info className="w-4 h-4 text-[#00A884] flex-shrink-0" strokeWidth={2} />
              <span>{timeoutBanner}</span>
            </div>
            <button
              type="button"
              onClick={dismissTimeoutBanner}
              className="text-[#8696A0] hover:text-[#E9EDEF] p-1 rounded hover:bg-white/[0.05] transition-colors cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-[#E5484D]/10 border border-[#E5484D]/30 rounded-[10px] text-[13px] text-[#E5484D] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Google Sign In Button */}
        <div>
          <button
            type="button"
            onClick={handleGoogleAdminLogin}
            disabled={isLoadingGoogle}
            className="w-full h-[46px] rounded-[10px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] text-[#E9EDEF] text-[14px] font-medium flex items-center justify-center gap-2.5 transition-standard cursor-pointer disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-[#00A884] focus:ring-offset-2 focus:ring-offset-[#1F2C33]"
          >
            {isLoadingGoogle ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#00A884]" strokeWidth={1.75} />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </>
            )}
          </button>
        </div>

        {/* Return to Staff Login */}
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => setScreen('login')}
            className="inline-flex items-center gap-1.5 text-[12px] text-[#8696A0] hover:text-[#E9EDEF] transition-standard cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Return to staff login</span>
          </button>
        </div>
      </div>
    </div>
  );
};
