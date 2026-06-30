import { useEffect, useState } from 'react';

type FocusableFormField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLElement;

export function useKeyboardViewport(): boolean {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const baselineHeight = window.innerHeight;

    const getActiveField = (): FocusableFormField | null => {
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement
        || el instanceof HTMLTextAreaElement
        || el instanceof HTMLSelectElement
      ) {
        return el;
      }
      if (el instanceof HTMLElement && el.isContentEditable) return el;
      return null;
    };

    const isKeyboardLikelyOpen = () => {
      const visibleHeight = window.visualViewport?.height ?? window.innerHeight;
      return Boolean(getActiveField()) || baselineHeight - visibleHeight > 140;
    };

    let closeTimer = 0;
    const commitKeyboardState = () => {
      if (isKeyboardLikelyOpen()) {
        if (closeTimer) {
          clearTimeout(closeTimer);
          closeTimer = 0;
        }
        setIsKeyboardOpen(true);
        return;
      }

      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => {
        closeTimer = 0;
        setIsKeyboardOpen(isKeyboardLikelyOpen());
      }, 250);
    };

    commitKeyboardState();

    window.visualViewport?.addEventListener('resize', commitKeyboardState);
    window.addEventListener('resize', commitKeyboardState);
    window.addEventListener('focusin', commitKeyboardState);
    window.addEventListener('focusout', commitKeyboardState);

    return () => {
      if (closeTimer) clearTimeout(closeTimer);
      window.visualViewport?.removeEventListener('resize', commitKeyboardState);
      window.removeEventListener('resize', commitKeyboardState);
      window.removeEventListener('focusin', commitKeyboardState);
      window.removeEventListener('focusout', commitKeyboardState);
    };
  }, []);

  return isKeyboardOpen;
}
