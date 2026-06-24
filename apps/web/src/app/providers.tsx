'use client';

import type { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';

// next-themes drives the `data-theme` attribute on <html> that every CSS token block keys off
// (`:root, [data-theme='dark']` is the dark default; `[data-theme='light']` inverts the palette).
// The provider injects a pre-paint script so the stored theme applies before first render (no flash);
// `suppressHydrationWarning` on <html> covers the attribute the server can't know.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
