import { useEffect, useState } from 'react';

export function useKeyboardViewport(): boolean {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const baselineHeight = window.innerHeight;

    const getActiveField = (): HTMLInputElement | HTMLTextAreaElement | null => {
      const el = document.activeElement;
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : null;
    };

    const isKeyboardLikelyOpen = () => {
      const visibleHeight = window.visualViewport?.height ?? window.innerHeight;
      return Boolean(getActiveField()) || baselineHeight - visibleHeight > 140;
    };

    // Toggling isKeyboardOpen on every blur reflows the layout (footer un-hides,
    // padding changes). When switching between set inputs, the blur of one field
    // is immediately followed by focusing the next, so collapsing the layout in
    // between makes the tapped field jump away — forcing a second tap. Debounce
    // the "closed" transition so a blur followed by a quick re-focus is a no-op;
    // only commit the closed state once focus has truly settled outside inputs.
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

    // The app uses a fixed-height shell with an inner scroll container, so iOS
    // Safari does not auto-scroll a focused field into view when the keyboard
    // opens — the body never scrolls. Manually keep the focused weight/reps/RIR
    // field centered in the area above the keyboard once the viewport shrinks.
    let scrollFrame = 0;
    const keepFieldVisible = () => {
      const activeField = getActiveField();
      if (!activeField) return;
      if (scrollFrame) cancelAnimationFrame(scrollFrame);

      const performScroll = () => {
        // Enforce zero layout viewport scroll offset to prevent iOS Safari from shifting the entire page layout upwards.
        if (window.scrollY !== 0) {
          window.scrollTo(0, 0);
        }

        const container = activeField.closest('.inner-scroll');
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const fieldRect = activeField.getBoundingClientRect();

        // Calculate container's visible height within the visual viewport.
        // This dynamically shrinks the centering frame when the keyboard slides up.
        const viewportHeight = window.visualViewport
          ? window.visualViewport.height
          : window.innerHeight;
        const containerVisibleHeight = Math.max(
          100,
          Math.min(containerRect.height, viewportHeight - containerRect.top)
        );

        // Calculate target scroll top to center the active input row.
        const currentScrollTop = container.scrollTop;
        const fieldTopRelativeToContainer = fieldRect.top - containerRect.top;
        const targetScrollTop =
          currentScrollTop +
          fieldTopRelativeToContainer -
          containerVisibleHeight / 2 +
          fieldRect.height / 2;

        container.scrollTo({
          top: targetScrollTop,
          behavior: 'auto', // Use instant positioning. Async smooth scrolling animations fight with keyboard layout resizing.
        });
      };

      scrollFrame = requestAnimationFrame(() => {
        performScroll();
        // Keyboard appearance on iOS Safari has asynchronous layout reflow delays;
        // fire additional checks at 80ms and 150ms to ensure the input centers.
        window.setTimeout(performScroll, 80);
        window.setTimeout(performScroll, 150);
      });
    };

    const handleViewportResize = () => {
      commitKeyboardState();
      keepFieldVisible();
    };

    const handleFocusIn = (event: FocusEvent) => {
      commitKeyboardState();
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        keepFieldVisible();
      }
    };

    // Prevent any browser-induced window-level (body) scrolling.
    const handleWindowScroll = () => {
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    };

    commitKeyboardState();
    window.visualViewport?.addEventListener('resize', handleViewportResize);
    window.visualViewport?.addEventListener('scroll', commitKeyboardState);
    window.addEventListener('resize', commitKeyboardState);
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', commitKeyboardState);
    window.addEventListener('scroll', handleWindowScroll, { passive: true });

    return () => {
      if (closeTimer) clearTimeout(closeTimer);
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
      window.visualViewport?.removeEventListener('scroll', commitKeyboardState);
      window.removeEventListener('resize', commitKeyboardState);
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', commitKeyboardState);
      window.removeEventListener('scroll', handleWindowScroll);
    };
  }, []);

  return isKeyboardOpen;
}
