import React, { useState } from 'react';
import {
  User,
  Mail,
  Building2,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ChevronDown,
  AlertCircle,
  LogIn,
} from 'lucide-react';
import { SignUpFormData, FormErrors } from '../../types';
import {
  signInWithGoogle,
  signUpWithStaffEmail,
  createStaffProfile,
  parseFriendlyError,
} from '../../lib/firebaseService';
import { useApp } from '../../context/AppContext';

interface SignUpFormProps {
  onSuccess: (data: SignUpFormData) => void;
  onNavigateLogin: () => void;
  onEmailVerificationNeeded?: (email: string) => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({
  onSuccess,
  onNavigateLogin,
  onEmailVerificationNeeded,
}) => {
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);

  const departments = [
    'Administration',
    'Finance',
    'IT',
    'Human Resources',
    'Operations',
  ];

  // Section 2: Live checklist under password field (at least 8 characters, a letter, a number)
  const hasLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordValid = hasLength && hasLetter && hasNumber;

  const validateAll = (): boolean => {
    const errs: FormErrors = {};

    if (!fullName.trim()) {
      errs.fullName = 'Full name is required';
    }
    if (!department) {
      errs.department = 'Please select your department';
    }

    const emailTrimmed = email.trim();
    if (!emailTrimmed) {
      errs.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      errs.email = 'Please enter a valid email address';
    }

    if (!password) {
      errs.password = 'Password is required';
    } else if (!isPasswordValid) {
      errs.password = 'Password must meet all 3 checklist requirements';
    }

    if (!confirmPassword) {
      errs.confirmPassword = 'Confirm your password';
    } else if (confirmPassword !== password) {
      errs.confirmPassword = 'Passwords do not match';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const { setAuthFlowInProgress } = useApp();

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;

    setIsLoadingEmail(true);
    setAuthFlowInProgress(true);
    setErrors({});

    try {
      await signUpWithStaffEmail(fullName, department, email, password);

      // Section 2: Move to verification screen below
      if (onEmailVerificationNeeded) {
        onEmailVerificationNeeded(email.trim());
      } else {
        onSuccess({
          fullName,
          email,
          department,
          password: '',
          confirmPassword: '',
        });
      }
    } catch (err: any) {
      console.warn('handleEmailSignUp error:', err);
      setErrors({ general: err.message || 'Could not create account. Please try again.' });
    } finally {
      setIsLoadingEmail(false);
      setAuthFlowInProgress(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setErrors({});
    const newErrors: FormErrors = {};
    if (!department) {
      newErrors.department = 'Please select your department first';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoadingGoogle(true);
    setAuthFlowInProgress(true);

    try {
      const { user, error } = await signInWithGoogle();
      if (!user) {
        setIsLoadingGoogle(false);
        if (error) {
          setErrors({ general: error });
        }
        return;
      }

      const profile = await createStaffProfile(
        user,
        fullName || user.displayName || 'Staff Member',
        department,
        'google'
      );

      onSuccess({
        fullName: profile.fullName,
        email: profile.email,
        department: profile.department,
        password: '',
        confirmPassword: '',
      });
    } catch (err: any) {
      setIsLoadingGoogle(false);
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setErrors({ general: parseFriendlyError(err) });
      }
    } finally {
      setIsLoadingGoogle(false);
      setAuthFlowInProgress(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-3 text-left">
      {/* General error banner */}
      {errors.general && (
        <div className="p-3 bg-[#E5484D]/10 border border-[#E5484D]/30 rounded-[10px] text-[13px] text-[#E5484D] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
          <span className="leading-relaxed">{errors.general}</span>
        </div>
      )}

      {/* Section 2: Keep Continue with Google */}
      <div>
        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={isLoadingEmail || isLoadingGoogle}
          className="w-full h-[48px] sm:h-[44px] rounded-[10px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] text-[#E9EDEF] text-[14px] font-medium flex items-center justify-center gap-2.5 transition-standard cursor-pointer disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-[#00A884] focus:ring-offset-2 focus:ring-offset-[#1F2C33]"
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

      <form onSubmit={handleEmailSignUp} className="flex flex-col gap-2.5">
        {/* Field 1: Full Name */}
        <div className="flex flex-col gap-1">
          <label className="text-[13px] font-medium text-[#8696A0]">
            Full name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8696A0]">
              <User className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </div>
            <input
              type="text"
              value={fullName}
              autoFocus
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName && e.target.value.trim()) {
                  setErrors((prev) => ({ ...prev, fullName: undefined }));
                }
              }}
              onBlur={() => {
                if (!fullName.trim()) {
                  setErrors((prev) => ({ ...prev, fullName: 'Full name is required' }));
                }
              }}
              placeholder="Alex Vance"
              className="w-full h-[44px] pl-10 pr-3.5 rounded-[10px] bg-[#2A3942] border border-white/[0.08] text-[#E9EDEF] text-[14px] placeholder-[#8696A0]/75 focus:outline-none focus:border-[#00A884] transition-standard"
            />
          </div>
          {/* Reserved inline error slot */}
          <div className="min-h-[16px] text-[12px] text-[#E5484D] pl-1">
            {errors.fullName || ''}
          </div>
        </div>

        {/* Field 2: Department Select */}
        <div className="flex flex-col gap-1 -mt-1">
          <label className="text-[13px] font-medium text-[#8696A0]">
            Department
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8696A0]">
              <Building2 className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </div>
            <select
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                if (errors.department) setErrors((prev) => ({ ...prev, department: undefined }));
              }}
              onBlur={() => {
                if (!department) {
                  setErrors((prev) => ({ ...prev, department: 'Please select your department' }));
                }
              }}
              className="w-full h-[44px] pl-10 pr-9 rounded-[10px] bg-[#2A3942] border border-white/[0.08] text-[#E9EDEF] text-[14px] appearance-none focus:outline-none focus:border-[#00A884] transition-standard cursor-pointer"
            >
              <option value="" disabled className="bg-[#1F2C33] text-[#8696A0]">
                Select department
              </option>
              {departments.map((dept) => (
                <option key={dept} value={dept} className="bg-[#1F2C33] text-[#E9EDEF]">
                  {dept}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#8696A0]">
              <ChevronDown className="w-4 h-4" strokeWidth={1.75} />
            </div>
          </div>
          {/* Reserved inline error slot */}
          <div className="min-h-[16px] text-[12px] text-[#E5484D] pl-1">
            {errors.department || ''}
          </div>
        </div>

        {/* Field 3: Email */}
        <div className="flex flex-col gap-1 -mt-1">
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
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email && e.target.value.trim()) {
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              onBlur={() => {
                if (!email.trim()) {
                  setErrors((prev) => ({ ...prev, email: 'Email is required' }));
                } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                  setErrors((prev) => ({ ...prev, email: 'Enter a valid email address' }));
                }
              }}
              placeholder="alex@org.com"
              className="w-full h-[44px] pl-10 pr-3.5 rounded-[10px] bg-[#2A3942] border border-white/[0.08] text-[#E9EDEF] text-[14px] placeholder-[#8696A0]/75 focus:outline-none focus:border-[#00A884] transition-standard"
            />
          </div>
          {/* Reserved inline error slot */}
          <div className="min-h-[16px] text-[12px] text-[#E5484D] pl-1">
            {errors.email || ''}
          </div>
        </div>

        {/* Field 4: Password with Live Checklist */}
        <div className="flex flex-col gap-1 -mt-1">
          <label className="text-[13px] font-medium text-[#8696A0]">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8696A0]">
              <Lock className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) {
                  setErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              onBlur={() => {
                if (!password) {
                  setErrors((prev) => ({ ...prev, password: 'Password is required' }));
                } else if (!isPasswordValid) {
                  setErrors((prev) => ({ ...prev, password: 'Password must meet all 3 checklist requirements' }));
                }
              }}
              placeholder="Create strong password"
              className="w-full h-[44px] pl-10 pr-11 rounded-[10px] bg-[#2A3942] border border-white/[0.08] text-[#E9EDEF] text-[14px] placeholder-[#8696A0]/75 focus:outline-none focus:border-[#00A884] transition-standard"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8696A0] hover:text-[#00A884] transition-standard cursor-pointer select-none"
            >
              {showPassword ? (
                <EyeOff className="w-[18px] h-[18px]" strokeWidth={1.75} />
              ) : (
                <Eye className="w-[18px] h-[18px]" strokeWidth={1.75} />
              )}
            </button>
          </div>

          {/* Section 2: Live checklist under the password field (at least 8 characters, a letter, a number) */}
          <div className="flex flex-col gap-1 text-[12px] text-[#8696A0] mt-1 pl-1">
            <div className={`flex items-center gap-1.5 transition-standard ${hasLength ? 'text-[#00A884]' : 'text-[#8696A0]'}`}>
              <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${hasLength ? 'bg-[#00A884]/20 text-[#00A884]' : 'bg-white/10 text-transparent'}`}>✓</span>
              <span>At least 8 characters</span>
            </div>
            <div className={`flex items-center gap-1.5 transition-standard ${hasLetter ? 'text-[#00A884]' : 'text-[#8696A0]'}`}>
              <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${hasLetter ? 'bg-[#00A884]/20 text-[#00A884]' : 'bg-white/10 text-transparent'}`}>✓</span>
              <span>At least one letter</span>
            </div>
            <div className={`flex items-center gap-1.5 transition-standard ${hasNumber ? 'text-[#00A884]' : 'text-[#8696A0]'}`}>
              <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${hasNumber ? 'bg-[#00A884]/20 text-[#00A884]' : 'bg-white/10 text-transparent'}`}>✓</span>
              <span>At least one number</span>
            </div>
          </div>

          {/* Reserved inline error slot */}
          <div className="min-h-[16px] text-[12px] text-[#E5484D] pl-1">
            {errors.password || ''}
          </div>
        </div>

        {/* Field 5: Confirm Password */}
        <div className="flex flex-col gap-1 -mt-1">
          <label className="text-[13px] font-medium text-[#8696A0]">
            Confirm password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8696A0]">
              <Lock className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </div>
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword && e.target.value === password) {
                  setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                }
              }}
              onBlur={() => {
                if (confirmPassword && confirmPassword !== password) {
                  setErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match' }));
                }
              }}
              placeholder="Re-enter password"
              className="w-full h-[44px] pl-10 pr-11 rounded-[10px] bg-[#2A3942] border border-white/[0.08] text-[#E9EDEF] text-[14px] placeholder-[#8696A0]/75 focus:outline-none focus:border-[#00A884] transition-standard"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8696A0] hover:text-[#00A884] transition-standard cursor-pointer select-none"
            >
              {showConfirmPassword ? (
                <EyeOff className="w-[18px] h-[18px]" strokeWidth={1.75} />
              ) : (
                <Eye className="w-[18px] h-[18px]" strokeWidth={1.75} />
              )}
            </button>
          </div>
          {/* Reserved inline error slot */}
          <div className="min-h-[16px] text-[12px] text-[#E5484D] pl-1">
            {errors.confirmPassword || ''}
          </div>
        </div>

        {/* Primary Button: Create account */}
        <button
          type="submit"
          disabled={isLoadingEmail || isLoadingGoogle}
          className="w-full h-[48px] sm:h-[44px] rounded-[10px] bg-[#00A884] hover:bg-[#008F72] text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition-standard cursor-pointer disabled:opacity-50 disabled:pointer-events-none mt-1 focus:outline-none focus:ring-2 focus:ring-[#00A884] focus:ring-offset-2 focus:ring-offset-[#1F2C33]"
        >
          {isLoadingEmail ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
              <span>Creating account...</span>
            </>
          ) : (
            <span>Create account</span>
          )}
        </button>
      </form>

      {/* Already registered? Back to Login */}
      <div className="mt-3 pt-3 border-t border-white/[0.06] text-center">
        <button
          type="button"
          onClick={onNavigateLogin}
          className="inline-flex items-center gap-1.5 text-[13px] text-[#8696A0] hover:text-[#00A884] transition-colors cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          <span>Already registered? Log in</span>
        </button>
      </div>
    </div>
  );
};
