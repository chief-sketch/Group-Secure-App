import { useEffect, useRef } from 'react';

interface UseFocusTrapOptions {
  onEscape?: () => void;
  isDismissible?: boolean;
}

/**
 * Accessible focus trap for modal dialogs:
 * - Traps Tab and Shift+Tab navigation within the container
 * - Optionally dismisses on Escape if dismissible
 * - Auto-focuses the first interactive element upon open
 * - Restores focus to the trigger element on close
 */
export function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
  options: UseFocusTrapOptions = {}
) {
  const { onEscape, isDismissible = true } = options;
  const triggerElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Remember the element that triggered the dialog
    triggerElementRef.current = document.activeElement as HTMLElement | null;

    const container = ref.current;
    if (!container) return;

    const focusableSelectors = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    const getFocusableElements = () => {
      if (!container) return [];
      return Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelectors)
      ).filter((el) => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0);
    };

    // Delay slightly to allow modal enter animation / mounting
    const focusTimer = setTimeout(() => {
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        container.focus();
      }
    }, 40);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDismissible && onEscape) {
          e.preventDefault();
          e.stopPropagation();
          onEscape();
        }
        return;
      }

      if (e.key === 'Tab') {
        const focusable = getFocusableElements();
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !container.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !container.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      if (triggerElementRef.current && typeof triggerElementRef.current.focus === 'function') {
        triggerElementRef.current.focus();
      }
    };
  }, [isOpen, onEscape, isDismissible, ref]);
}
