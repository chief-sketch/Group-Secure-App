import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface HoldToConfirmButtonProps {
  onConfirm: () => void | Promise<void>;
  label: string;
  holdingLabel?: string;
  confirmedLabel?: string;
  icon?: React.ReactNode;
  durationMs?: number;
  variant?: 'danger' | 'warning' | 'primary';
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  onFallbackClick?: () => void;
  hintText?: string;
}

export const HoldToConfirmButton: React.FC<HoldToConfirmButtonProps> = ({
  onConfirm,
  label,
  holdingLabel,
  confirmedLabel,
  icon,
  durationMs = 1000,
  variant = 'danger',
  disabled = false,
  isLoading = false,
  className = '',
  onFallbackClick,
  hintText = 'Hold 1s to confirm',
}) => {
  const reducedMotion = useReducedMotion();
  const [progress, setProgress] = useState(0); // 0 to 1
  const [isHolding, setIsHolding] = useState(false);
  const [useFallbackMode, setUseFallbackMode] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isCompletedRef = useRef(false);

  const variantStyles = {
    danger: {
      base: 'bg-[#E5484D]/15 border-[#E5484D]/30 text-[#FF6B6B] hover:bg-[#E5484D]/25',
      fill: 'bg-[#E5484D]',
      fillText: 'text-white',
    },
    warning: {
      base: 'bg-[#F59E0B]/15 border-[#F59E0B]/30 text-[#F59E0B] hover:bg-[#F59E0B]/25',
      fill: 'bg-[#F59E0B]',
      fillText: 'text-[#0B1419]',
    },
    primary: {
      base: 'bg-[#3DDBB4]/15 border-[#3DDBB4]/30 text-[#3DDBB4] hover:bg-[#3DDBB4]/25',
      fill: 'bg-[#3DDBB4]',
      fillText: 'text-[#042A21]',
    },
  }[variant];

  // Cancel and reverse fill in 150ms
  const cancelHold = useCallback(() => {
    if (isCompletedRef.current) return;
    setIsHolding(false);
    startTimeRef.current = null;
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // Smoothly animate progress back to 0 over 150ms
    const startProgress = progress;
    if (startProgress <= 0) return;

    const reverseStartTime = performance.now();
    const reverseDuration = 150;

    const reverseAnim = (now: number) => {
      const elapsed = now - reverseStartTime;
      const t = Math.min(1, elapsed / reverseDuration);
      const newProgress = Math.max(0, startProgress * (1 - t));
      setProgress(newProgress);
      if (t < 1) {
        requestAnimationFrame(reverseAnim);
      }
    };
    requestAnimationFrame(reverseAnim);
  }, [progress]);

  const completeHold = useCallback(async () => {
    if (isCompletedRef.current) return;
    isCompletedRef.current = true;
    setIsHolding(false);
    setProgress(1);
    setLiveAnnouncement(`Action confirmed: ${label}`);

    try {
      await onConfirm();
    } finally {
      setTimeout(() => {
        isCompletedRef.current = false;
        setProgress(0);
      }, 300);
    }
  }, [onConfirm, label]);

  // Start hold countdown
  const startHold = useCallback(() => {
    if (disabled || isLoading || isCompletedRef.current) return;
    setIsHolding(true);
    startTimeRef.current = performance.now();

    const loop = (now: number) => {
      if (!startTimeRef.current) return;
      const elapsed = now - startTimeRef.current;
      const p = Math.min(1, elapsed / durationMs);
      setProgress(p);

      if (p >= 1) {
        completeHold();
      } else {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
  }, [disabled, isLoading, durationMs, completeHold]);

  // Keyboard support: Hold Space or Enter for 1s
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      if (!isHolding && !e.repeat) {
        e.preventDefault();
        startHold();
      }
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!isCompletedRef.current) {
        cancelHold();
      }
    }
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // If user prefers reduced motion or explicitly toggled fallback mode
  if (reducedMotion || useFallbackMode) {
    return (
      <div className="flex flex-col gap-1 items-stretch">
        <button
          type="button"
          onClick={() => {
            setLiveAnnouncement(`Action confirmed: ${label}`);
            onConfirm();
          }}
          disabled={disabled || isLoading}
          className={`min-h-[44px] px-4 rounded-[12px] font-semibold text-[13px] border transition-colors cursor-pointer flex items-center justify-center gap-2 ${variantStyles.base} ${className}`}
        >
          {icon}
          <span>{isLoading ? (confirmedLabel || 'Processing...') : label}</span>
        </button>
        <span className="sr-only" aria-live="polite">
          {liveAnnouncement}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 items-stretch">
      <button
        type="button"
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        disabled={disabled || isLoading}
        aria-label={`${label} (${hintText})`}
        className={`relative overflow-hidden min-h-[44px] px-4 rounded-[12px] font-semibold text-[13px] border transition-colors cursor-pointer select-none flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#3DDBB4] ${variantStyles.base} ${className}`}
      >
        {/* Animated Fill Bar (Transform scaleX only, linear fill) */}
        <div
          aria-hidden="true"
          className={`absolute inset-0 origin-left ${variantStyles.fill} opacity-90 pointer-events-none`}
          style={{
            transform: `scaleX(${progress})`,
            willChange: isHolding ? 'transform' : 'auto',
          }}
        />

        {/* Content layer above fill bar */}
        <div className={`relative z-10 flex items-center justify-center gap-2 transition-colors ${progress > 0.5 ? variantStyles.fillText : ''}`}>
          {icon}
          <span>
            {isLoading
              ? (confirmedLabel || 'Processing...')
              : progress > 0
              ? (holdingLabel || `Holding... ${Math.round(progress * 100)}%`)
              : label}
          </span>
        </div>
      </button>

      {/* Screen reader live region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* Subtle accessibility and fallback text */}
      <div className="flex items-center justify-between px-1 text-[11px] text-[#8696A0]">
        <span>{hintText}</span>
        <button
          type="button"
          onClick={() => {
            if (onFallbackClick) {
              onFallbackClick();
            } else {
              setUseFallbackMode(true);
            }
          }}
          className="text-[#8696A0] hover:text-[#E9EDEF] underline cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#3DDBB4] rounded"
        >
          Use standard confirmation
        </button>
      </div>
    </div>
  );
};
