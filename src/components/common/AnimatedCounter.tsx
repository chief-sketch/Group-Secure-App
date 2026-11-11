import React, { useEffect, useState, useRef } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface AnimatedCounterProps {
  value: number;
  durationMs?: number;
  className?: string;
}

/**
 * Animated counter that counts from 0 on first mount,
 * and interpolates from previous to new value when value changes.
 * Skips animation if user prefers reduced motion.
 */
export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  durationMs = 600,
  className = '',
}) => {
  const reducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState<number>(() => (reducedMotion ? value : 0));
  const prevValueRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayValue(value);
      prevValueRef.current = value;
      return;
    }

    const startValue = prevValueRef.current;
    const endValue = value;
    if (startValue === endValue && displayValue === endValue) return;

    const startTime = performance.now();

    // Cubic-bezier(0.22, 1, 0.36, 1) approximation for smooth deceleration without bounce
    const easeOutCubic = (t: number) => {
      const f = t - 1;
      return f * f * f + 1;
    };

    const update = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, Math.max(0, elapsed / durationMs));
      const eased = easeOutCubic(progress);
      const current = Math.round(startValue + (endValue - startValue) * eased);

      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(update);
      } else {
        setDisplayValue(endValue);
        prevValueRef.current = endValue;
      }
    };

    animFrameRef.current = requestAnimationFrame(update);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [value, durationMs, reducedMotion]);

  return (
    <span className={`tabular-nums font-mono-nums ${className}`}>
      {displayValue}
    </span>
  );
};
