import { useEffect } from 'react';

/**
 * Ref-counted page scroll lock.
 *
 * Several overlays (3D rail detail views, cart, order slip) can be open at
 * different times. Each one calls `lockScroll()` when it opens and the
 * returned function when it closes; the page only becomes scrollable again
 * once ALL locks are released.
 *
 * Why position:fixed instead of only `overflow:hidden`?
 *  - On iOS Safari `overflow:hidden` on body does not stop touch scrolling.
 *  - It also keeps the user's scroll position, so closing the overlay
 *    returns them to exactly where they were.
 */
let lockCount = 0;
let savedScrollY = 0;
let prev: { htmlOverflow: string; bodyStyle: Partial<CSSStyleDeclaration> } | null = null;

export function lockScroll(): () => void {
  if (typeof window === 'undefined') return () => {};

  if (lockCount === 0) {
    const html = document.documentElement;
    const body = document.body;
    savedScrollY = window.scrollY || html.scrollTop || 0;

    prev = {
      htmlOverflow: html.style.overflow,
      bodyStyle: {
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        overflow: body.style.overflow,
        paddingRight: body.style.paddingRight,
      },
    };

    // Avoid layout jump when the scrollbar disappears (desktop)
    const scrollbarW = window.innerWidth - html.clientWidth;
    if (scrollbarW > 0) {
      body.style.paddingRight = `${scrollbarW}px`;
    }

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${savedScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
  }

  lockCount += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);

    if (lockCount === 0 && prev) {
      const html = document.documentElement;
      const body = document.body;
      html.style.overflow = prev.htmlOverflow;
      Object.assign(body.style, prev.bodyStyle);
      prev = null;
      // Restore without smooth-scroll animation
      const root = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      window.scrollTo(0, savedScrollY);
      html.style.scrollBehavior = root;
    }
  };
}

/** React hook: page is locked while `active` is true. */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const unlock = lockScroll();
    return unlock;
  }, [active]);
}
