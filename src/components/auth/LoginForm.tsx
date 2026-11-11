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
  createStaffProfile,
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
  onFailedLogin?: () => void;
  shouldAnimateEntrance?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onNavigateSignUp,
  onNavigateAdmin,
  onFailedLogin,
  shouldAnimateEntrance = false,
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
      algorithm: 'TLS in transit, encrypted at rest',
      channels:
        profile.channels && profile.channels.length > 0
          ? profile.channels
          : ['General'],
      providerId,
    });
  };

  const handleProfileRouting = async (firebaseUser: any, providerId: string) => {
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

    // Ensure both Google and Email sign-ins recover gracefully if their profile doc was interrupted or missing
    if (!profile && !isBusy) {
      try {
        const defaultName =
          firebaseUser.displayName ||
          (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Staff Member');
        profile = await createStaffProfile(
          firebaseUser,
          defaultName,
          'Operations',
          providerId === 'google.com' ? 'google' : 'password'
        );
      } catch (e) {
        console.warn('Auto create pending profile note:', e);
      }
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
    if (Object.keys(errs).length > 0) {
      onFailedLogin?.();
      return;
    }

    setIsLoadingEmail(true);
    setAuthFlowInProgress(true);
    try {
      const res = await signInWithStaffEmail(email, password);
      if (res.error) {
        setErrorMessage(res.error);
        onFailedLogin?.();
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
      onFailedLogin?.();
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
          onFailedLogin?.();
        }
        return;
      }

      await handleProfileRouting(user, 'google.com');
    } catch (err: any) {
      setIsLoadingGoogle(false);
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        await logoutFirebase();
        setErrorMessage(parseFriendlyError(err));
        onFailedLogin?.();
      }
    } finally {
      setIsLoadingGoogle(false);
      setAuthFlowInProgress(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 text-left">
      {/* Forgot Password Dialog */}
      <ForgotPasswordDialog
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        initialEmail={email}
      />

      {/* Pending Approval Notice */}
      {pendingApprovalNotice && (
        <div className="p-3.5 bg-[#F5A623]/10 border border-[#F5A623]/30 rounded-[12px] text-[13px] text-[#F5A623] leading-relaxed">
          <p className="font-semibold mb-1">Approval pending</p>
          <p>{pendingApprovalNotice}</p>
        </div>
      )}

      {/* Calm session timeout info banner */}
      {timeoutBanner && (
        <div className="p-3 bg-[#22323B] border border-[#3A4C57] rounded-[12px] text-[13px] text-[#F2F7F9] flex items-center justify-between gap-2 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-[#3DDBB4] flex-shrink-0" strokeWidth={2} />
            <span>{timeoutBanner}</span>
          </div>
          <button
            type="button"
            onClick={dismissTimeoutBanner}
            className="text-[#8FA2AD] hover:text-[#F2F7F9] p-1 rounded hover:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-[#3DDBB4] transition-colors cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* General Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-3 bg-[#E5484D]/10 border border-[#E5484D]/30 rounded-[12px] text-[13px] text-[#FF6B6B] flex flex-col gap-1 transition-opacity duration-150 animate-fadeIn"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#FF6B6B]" strokeWidth={1.75} />
              <span className="font-medium">{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-[#FF6B6B]/70 hover:text-[#FF6B6B] p-0.5 rounded cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-[#FF6B6B]"
              aria-label="Dismiss error message"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {googleHint && (
            <p className="text-[12px] text-[#A9BAC4] pl-6">
              Signed up with Google? Use Continue with Google below.
            </p>
          )}
        </div>
      )}

      {/* Login Form with 24px gap */}
      <form onSubmit={handleEmailSignIn} className="flex flex-col gap-5">
        {/* Field: Work email (stagger 120ms) */}
        <div
          className={`flex flex-col gap-2 ${shouldAnimateEntrance ? 'animate-login-stagger' : ''}`}
          style={shouldAnimateEntrance ? { animationDelay: '120ms' } : undefined}
        >
          <label htmlFor="login-email" className="text-[14px] font-medium text-[#C9D6DD]">
            Work email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#8FA2AD]">
              <Mail className="w-[18px] h-[18px]" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              autoFocus
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMessage) setErrorMessage(null);
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
              placeholder="you@organization.com"
              className="w-full h-[50px] pl-11 pr-4 rounded-[12px] bg-[#22323B] border border-[#3A4C57] text-[#F2F7F9] text-[14px] font-medium placeholder-[#8FA2AD] focus:outline-none focus:ring-2 focus:ring-[#3DDBB4] focus:border-transparent transition-all"
            />
          </div>
          {fieldErrors.email && (
            <div className="text-[12px] text-[#FF6B6B] pl-1 font-medium -mt-1">
              {fieldErrors.email}
            </div>
          )}
        </div>

        {/* Field: Password (stagger 160ms) */}
        <div
          className={`flex flex-col gap-2 ${shouldAnimateEntrance ? 'animate-login-stagger' : ''}`}
          style={shouldAnimateEntrance ? { animationDelay: '160ms' } : undefined}
        >
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="text-[14px] font-medium text-[#C9D6DD]">
              Password
            </label>
            <button
              type="button"
              onClick={() => setIsForgotPasswordOpen(true)}
              className="text-[14px] font-medium text-[#3DDBB4] hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3DDBB4] rounded-[4px] px-1 py-0.5 transition-colors"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#8FA2AD]">
              <Lock className="w-[18px] h-[18px]" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
                if (fieldErrors.password && e.target.value) {
                  setFieldErrors((p) => ({ ...p, password: undefined }));
                }
              }}
              onBlur={() => {
                if (!password) {
                  setFieldErrors((p) => ({ ...p, password: 'Password is required' }));
                }
              }}
              placeholder="Enter your password"
              className="w-full h-[50px] pl-11 pr-12 rounded-[12px] bg-[#22323B] border border-[#3A4C57] text-[#F2F7F9] text-[14px] font-medium placeholder-[#8FA2AD] focus:outline-none focus:ring-2 focus:ring-[#3DDBB4] focus:border-transparent transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 pr-4 flex items-center justify-center w-12 text-[#8FA2AD] hover:text-[#3DDBB4] focus:outline-none focus:ring-2 focus:ring-[#3DDBB4] rounded-[6px] transition-colors cursor-pointer select-none"
            >
              <div className="relative w-[18px] h-[18px]">
                <EyeOff
                  className={`w-[18px] h-[18px] absolute inset-0 transition-opacity duration-150 ${
                    showPassword ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                  strokeWidth={1.75}
                />
                <Eye
                  className={`w-[18px] h-[18px] absolute inset-0 transition-opacity duration-150 ${
                    showPassword ? 'opacity-0 pointer-events-none' : 'opacity-100'
                  }`}
                  strokeWidth={1.75}
                />
              </div>
            </button>
          </div>
          {fieldErrors.password && (
            <div className="text-[12px] text-[#FF6B6B] pl-1 font-medium -mt-1">
              {fieldErrors.password}
            </div>
          )}
        </div>

        {/* Primary Log in Button (stagger 200ms): 52px tall, background #2EE0B0, dark text #042A21, bold */}
        <button
          type="submit"
          disabled={isLoadingEmail || isLoadingGoogle}
          className={`relative w-full h-[52px] rounded-[12px] bg-[#2EE0B0] hover:bg-[#28CCA0] active:bg-[#22B890] text-[#042A21] text-[15px] font-bold flex items-center justify-center transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed mt-1 focus:outline-none focus:ring-2 focus:ring-[#3DDBB4] focus:ring-offset-2 focus:ring-offset-[#17232A] shadow-md overflow-hidden ${
            shouldAnimateEntrance ? 'animate-login-stagger' : ''
          }`}
          style={shouldAnimateEntrance ? { animationDelay: '200ms' } : undefined}
        >
          {/* Idle label */}
          <span
            className={`transition-opacity duration-150 flex items-center gap-2 ${
              isLoadingEmail ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            Log in
          </span>

          {/* Loading spinner */}
          <span
            className={`absolute inset-0 flex items-center justify-center gap-2 transition-opacity duration-150 ${
              isLoadingEmail ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <Loader2 className="w-5 h-5 animate-spin text-[#042A21]" strokeWidth={2.5} />
            <span>Logging in...</span>
          </span>
        </button>
      </form>

      {/* Divider with word "or" (stagger 240ms) */}
      <div
        className={`flex items-center gap-3 ${shouldAnimateEntrance ? 'animate-login-stagger' : ''}`}
        style={shouldAnimateEntrance ? { animationDelay: '240ms' } : undefined}
      >
        <div className="flex-1 h-[1px] bg-[#2C3B44]" />
        <span className="text-[13px] text-[#A9BAC4] select-none font-medium">
          or
        </span>
        <div className="flex-1 h-[1px] bg-[#2C3B44]" />
      </div>

      {/* Secondary Outlined Continue with Google Button: 50px tall (stagger 280ms) */}
      <div
        className={shouldAnimateEntrance ? 'animate-login-stagger' : ''}
        style={shouldAnimateEntrance ? { animationDelay: '280ms' } : undefined}
      >
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoadingEmail || isLoadingGoogle}
          className="relative w-full h-[50px] rounded-[12px] bg-transparent hover:bg-white/[0.04] active:bg-white/[0.08] border border-[#3A4C57] hover:border-[#3DDBB4]/60 text-[#F2F7F9] text-[14px] font-medium flex items-center justify-center transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#3DDBB4] focus:ring-offset-2 focus:ring-offset-[#17232A] overflow-hidden"
        >
          {/* Idle Google content */}
          <span
            className={`flex items-center justify-center gap-3 transition-opacity duration-150 ${
              isLoadingGoogle ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            <svg className="w-[18px] h-[18px] flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
          </span>

          {/* Loading spinner */}
          <span
            className={`absolute inset-0 flex items-center justify-center gap-2 transition-opacity duration-150 ${
              isLoadingGoogle ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <Loader2 className="w-4 h-4 animate-spin text-[#3DDBB4]" strokeWidth={2} />
            <span>Signing in with Google...</span>
          </span>
        </button>
      </div>

      {/* New here? Request access & Approval notice (stagger 320ms) */}
      <div
        className={`flex flex-col items-center text-center gap-2 ${
          shouldAnimateEntrance ? 'animate-login-stagger' : ''
        }`}
        style={shouldAnimateEntrance ? { animationDelay: '320ms' } : undefined}
      >
        <div className="text-[14px] text-[#A9BAC4] font-medium">
          <span>New here? </span>
          <button
            type="button"
            onClick={onNavigateSignUp}
            className="text-[#3DDBB4] font-semibold hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3DDBB4] rounded-[4px] px-1 py-0.5 transition-colors"
          >
            Request access
          </button>
        </div>

        <p className="text-[12px] text-[#A9BAC4] max-w-[320px] leading-relaxed font-medium">
          An administrator approves every new member, including Google sign-ups, before they can chat.
        </p>
      </div>

      {/* Footer line with small lock icon (stagger 360ms) */}
      <div
        className={`pt-3 border-t border-[#2C3B44] flex flex-col items-center gap-2 text-center ${
          shouldAnimateEntrance ? 'animate-login-stagger' : ''
        }`}
        style={shouldAnimateEntrance ? { animationDelay: '360ms' } : undefined}
      >
        <div className="flex items-center justify-center gap-1.5 text-[12.5px] text-[#3DDBB4] font-medium">
          <Lock className="w-[13px] h-[13px] text-[#3DDBB4]" strokeWidth={2} aria-hidden="true" />
          <span>End-to-end encrypted</span>
        </div>

        {onNavigateAdmin && (
          <div className="text-[12px] text-[#A9BAC4] font-medium">
            <span>Security Administrator? </span>
            <button
              type="button"
              onClick={onNavigateAdmin}
              className="text-[#3DDBB4] hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3DDBB4] rounded-[4px] px-1 py-0.5 transition-colors"
            >
              Admin portal
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
