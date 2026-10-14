import React, { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  UserPlus,
  Info,
  X,
} from 'lucide-react';
import { UserSession } from '../../types';
import {
  signInWithGoogle,
  signInWithStaffEmail,
  getUserProfile,
  bootstrapAdminProfileIfNeeded,
  logoutFirebase,
  parseFriendlyError,
} from '../../lib/firebaseService';
import { ForgotPasswordDialog } from './ForgotPasswordDialog';
import { useApp } from '../../context/AppContext';
import { recordSessionApprovedAdmin } from '../../lib/sessionAdminMemory';

interface LoginFormProps {
  onSuccess: (session: UserSession) => void;
  onNavigateSignUp: () => void;
  onNavigateAdmin?: () => void;
  onEmailVerificationNeeded?: (email: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onNavigateSignUp,
  onNavigateAdmin,
  onEmailVerificationNeeded,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [googleHint, setGoogleHint] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [pendingApprovalNotice, setPendingApprovalNotice] = useState<string | null>(null);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
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

  const completeLoginSession = (profile: any, providerId: string = 'password') => {
    const now = Date.now().toString();
    try {
      localStorage.setItem('gsa_session_started', now);
      localStorage.setItem('gsa_last_activity', now);
      sessionStorage.removeItem('gsa_timeout_banner');
    } catch {}

    onSuccess({
      uid: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      department: profile.department,
      role: profile.role,
      status: profile.status,
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
      providerId,
    });
  };

  const handleProfileRouting = async (firebaseUser: any, providerId: string) => {
    // If password user is not email verified, redirect to verify email screen
    if (providerId === 'password' && !firebaseUser.emailVerified) {
      if (onEmailVerificationNeeded) {
        onEmailVerificationNeeded(firebaseUser.email || email);
      }
      return;
    }

    let profile: any = null;
    let isBusy = false;
    if (firebaseUser.email?.toLowerCase() === 'dmbogo20@gmail.com') {
      const bootRes = await bootstrapAdminProfileIfNeeded(firebaseUser);
      profile = bootRes.profile;
      if (bootRes.isBusy) isBusy = true;
    }
    if (!profile) {
      const profRes = await getUserProfile(firebaseUser.uid);
      profile = profRes.profile;
      if (profRes.isBusy) isBusy = true;
    }

    if (!profile) {
      await logoutFirebase();
      if (isBusy) {
        setErrorMessage('The service is busy right now. Please try again later.');
      } else {
        setErrorMessage('No account found. Please sign up first.');
      }
      return;
    }

    if (profile.role === 'admin' && profile.status === 'approved') {
      recordSessionApprovedAdmin(profile.id);
    }

    if (profile.status === 'pending') {
      // Establish session with pending status so user sees WaitingForApprovalNotice
      completeLoginSession(profile, providerId);
      return;
    }

    if (profile.status === 'rejected') {
      await logoutFirebase();
      try {
        sessionStorage.setItem(
          'gsa_timeout_banner',
          'Your registration was not approved. Contact your administrator.'
        );
      } catch {}
      setErrorMessage('Your registration was not approved. Contact your administrator.');
      return;
    }

    if (profile.status === 'approved' || profile.status === 'suspended') {
      completeLoginSession(profile, providerId);
      return;
    }

    await logoutFirebase();
    setErrorMessage('Account status unknown. Please contact support.');
  };

  const { setAuthFlowInProgress } = useApp();

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setGoogleHint(false);
    setPendingApprovalNotice(null);

    const errs: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errs.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Enter a valid email address';
    }
    if (!password) {
      errs.password = 'Password is required';
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsLoadingEmail(true);
    setAuthFlowInProgress(true);
    try {
      const res = await signInWithStaffEmail(email, password);
      if (res.error) {
        setErrorMessage(res.error);
        if (res.googleHint) {
          setGoogleHint(true);
        }
        return;
      }
      if (res.user) {
        await handleProfileRouting(res.user, 'password');
      }
    } catch (err: any) {
      console.warn('handleEmailSignIn catch:', err);
      setErrorMessage('Incorrect email or password');
    } finally {
      setIsLoadingEmail(false);
      setAuthFlowInProgress(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setGoogleHint(false);
    setPendingApprovalNotice(null);
    setIsLoadingGoogle(true);
    setAuthFlowInProgress(true);

    try {
      const { user, error } = await signInWithGoogle();
      if (!user) {
        setIsLoadingGoogle(false);
        if (error) {
          setErrorMessage(error);
        }
        return;
      }

      await handleProfileRouting(user, 'google.com');
    } catch (err: any) {
      setIsLoadingGoogle(false);
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        await logoutFirebase();
        setErrorMessage(parseFriendlyError(err));
      }
    } finally {
      setIsLoadingGoogle(false);
      setAuthFlowInProgress(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-3 text-left">
      {/* Forgot Password Dialog */}
      <ForgotPasswordDialog
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        initialEmail={email}
      />

      {/* Pending Approval Notice */}
      {pendingApprovalNotice && (
        <div className="p-3.5 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-[10px] text-[13px] text-[#F59E0B] leading-relaxed">
          <p className="font-semibold mb-1">Approval pending</p>
          <p>{pendingApprovalNotice}</p>
        </div>
      )}

      {/* Calm session timeout info banner */}
      {timeoutBanner && (
        <div className="p-3 bg-[#182229] border border-white/[0.12] rounded-[10px] text-[13px] text-[#E9EDEF] flex items-center justify-between gap-2 shadow-sm animate-fadeIn">
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

      {/* General Error Banner */}
      {errorMessage && (
        <div className="p-3 bg-[#E5484D]/10 border border-[#E5484D]/30 rounded-[10px] text-[13px] text-[#E5484D] flex flex-col gap-1">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
            <span>{errorMessage}</span>
          </div>
          {/* Section 5: Small muted hint under error if signed up with Google */}
          {googleHint && (
            <p className="text-[12px] text-[#8696A0] pl-6">
              Signed up with Google? Use Continue with Google.
            </p>
          )}
        </div>
      )}

      {/* Section 1: Keep Continue with Google */}
      <div>
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoadingEmail || isLoadingGoogle}
          className="w-full h-[48px] sm:h-[44px] rounded-[10px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] text-[#E9EDEF] text-[14px] font-medium flex items-center justify-center gap-2.5 transition-standard cursor-pointer disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-[#00A884] focus:ring-offset-2 focus:ring-offset-[#1F2C33]"
        >
          {isLoadingGoogle ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#00A884]" strokeWidth={1.75} />
              <span>Signing in with Google...</span>
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
              <span>Continue with Google</span>
            </>
          )}
        </button>
      </div>

      {/* Divider with muted text 'or' */}
      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 h-[1px] bg-white/10" />
        <span className="text-[13px] text-[#8696A0] select-none font-normal">
          or
        </span>
        <div className="flex-1 h-[1px] bg-white/10" />
      </div>

      {/* Email & Password Form */}
      <form onSubmit={handleEmailSignIn} className="flex flex-col gap-3">
        {/* Email Field */}
        <div className="flex flex-col gap-1">
          <label className="text-[13px] font-medium text-[#8696A0]">
            Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8696A0]">
              <Mail className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </div>
            <input
              type="email"
              value={email}
              autoFocus
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email && e.target.value.trim()) {
                  setFieldErrors((p) => ({ ...p, email: undefined }));
                }
              }}
              onBlur={() => {
                if (!email.trim()) {
                  setFieldErrors((p) => ({ ...p, email: 'Email is required' }));
                } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                  setFieldErrors((p) => ({ ...p, email: 'Enter a valid email address' }));
                }
              }}
              placeholder="user@org.com"
              className="w-full h-[44px] pl-10 pr-3.5 rounded-[10px] bg-[#2A3942] border border-white/[0.08] text-[#E9EDEF] text-[14px] placeholder-[#8696A0]/75 focus:outline-none focus:border-[#00A884] transition-standard"
            />
          </div>
          {/* Reserved space for inline error */}
          <div className="min-h-[16px] text-[12px] text-[#E5484D] pl-1">
            {fieldErrors.email || ''}
          </div>
        </div>

        {/* Password Field */}
        <div className="flex flex-col gap-1 -mt-1">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-medium text-[#8696A0]">
              Password
            </label>
            {/* Section 1: Forgot password? link */}
            <button
              type="button"
              onClick={() => setIsForgotPasswordOpen(true)}
              className="text-[12px] text-[#00A884] hover:underline cursor-pointer font-medium"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8696A0]">
              <Lock className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password && e.target.value) {
                  setFieldErrors((p) => ({ ...p, password: undefined }));
                }
              }}
              onBlur={() => {
                if (!password) {
                  setFieldErrors((p) => ({ ...p, password: 'Password is required' }));
                }
              }}
              placeholder="Enter password"
              className="w-full h-[44px] pl-10 pr-11 rounded-[10px] bg-[#2A3942] border border-white/[0.08] text-[#E9EDEF] text-[14px] placeholder-[#8696A0]/75 focus:outline-none focus:border-[#00A884] transition-standard"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8696A0] hover:text-[#00A884] focus:text-[#00A884] transition-standard cursor-pointer select-none"
            >
              {showPassword ? (
                <EyeOff className="w-[18px] h-[18px]" strokeWidth={1.75} />
              ) : (
                <Eye className="w-[18px] h-[18px]" strokeWidth={1.75} />
              )}
            </button>
          </div>
          {/* Reserved space for inline error */}
          <div className="min-h-[16px] text-[12px] text-[#E5484D] pl-1">
            {fieldErrors.password || ''}
          </div>
        </div>

        {/* Primary Button: Log in */}
        <button
          type="submit"
          disabled={isLoadingEmail || isLoadingGoogle}
          className="w-full h-[48px] sm:h-[44px] rounded-[10px] bg-[#00A884] hover:bg-[#008F72] text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition-standard cursor-pointer disabled:opacity-50 disabled:pointer-events-none mt-0.5 focus:outline-none focus:ring-2 focus:ring-[#00A884] focus:ring-offset-2 focus:ring-offset-[#1F2C33]"
        >
          {isLoadingEmail ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
              <span>Logging in...</span>
            </>
          ) : (
            <span>Log in</span>
          )}
        </button>
      </form>

      {/* Divider row: New here? */}
      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1 h-[1px] bg-white/10" />
        <span className="text-[13px] text-[#8696A0] select-none font-normal">
          New here?
        </span>
        <div className="flex-1 h-[1px] bg-white/10" />
      </div>

      {/* Outlined Button: Create an account */}
      <div className="mt-1 flex flex-col gap-2">
        <button
          type="button"
          onClick={onNavigateSignUp}
          className="w-full h-[48px] sm:h-[44px] rounded-[10px] bg-transparent hover:bg-[#00A884]/[0.12] border-[1.5px] border-[#00A884] text-[#00A884] font-semibold text-[14px] flex items-center justify-center gap-2 transition-standard cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#00A884] focus:ring-offset-2 focus:ring-offset-[#1F2C33]"
        >
          <UserPlus className="w-[18px] h-[18px]" strokeWidth={1.75} />
          <span>Create an account</span>
        </button>

        <p className="text-[13px] text-[#8696A0] text-center leading-relaxed">
          New members need administrator approval before they can chat.
        </p>
      </div>

      {/* Link to Administrator Portal */}
      {onNavigateAdmin && (
        <div className="pt-2.5 mt-1 border-t border-white/[0.06] w-full text-center text-[13px] text-[#8696A0]">
          <span>Security Administrator? </span>
          <button
            type="button"
            onClick={onNavigateAdmin}
            className="text-[#00A884] hover:underline cursor-pointer font-medium"
          >
            Admin portal
          </button>
        </div>
      )}

      {/* Footer lock badge */}
      <div className="w-full mt-2 pt-2.5 border-t border-white/[0.06] flex items-center justify-center gap-1.5 text-[#8696A0] text-[13px]">
        <Lock className="w-[14px] h-[14px] flex-shrink-0 text-[#8696A0]" />
        <span>Secure messaging with role-based access control</span>
      </div>
    </div>
  );
};
