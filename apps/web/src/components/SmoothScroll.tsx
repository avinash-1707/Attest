'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ReactLenis, useLenis } from 'lenis/react';

// Reset to top on route change. Lenis preserves scroll inertia across Next client navigations, which
// can otherwise land a new page mid-scroll. Only fires on pathname change, not hash (anchor jumps).
function ScrollReset() {
  const lenis = useLenis();
  const pathname = usePathname();
  useEffect(() => {
    lenis?.scrollTo(0, { immediate: true });
  }, [pathname, lenis]);
  return null;
}

// Lenis smooths the page scroll and (via `anchors`) the nav's in-page jumps; `root` attaches to the
// document and owns its RAF loop (no manual lenis.raf). The sticky nav is ~80px, so anchor targets get
// a negative offset to land below it. Lenis does NOT read prefers-reduced-motion itself (verified
// against the installed build), so we drop smoothing + jump instantly for users who opt out. The
// provider stays mounted across that switch, so children mount once (no re-fired entrance animations).
export function SmoothScroll({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return (
    <ReactLenis
      root
      options={{
        lerp: 0.09,
        smoothWheel: !reduced,
        syncTouch: false,
        wheelMultiplier: 1,
        touchMultiplier: 1.5,
        anchors: reduced ? { immediate: true } : { offset: -96 },
        stopInertiaOnNavigate: true,
      }}
    >
      <ScrollReset />
      {children}
    </ReactLenis>
  );
}
