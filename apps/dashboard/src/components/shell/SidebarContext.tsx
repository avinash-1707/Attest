'use client';

import { createContext, useContext } from 'react';

const SidebarExpandedContext = createContext(true);

export const SidebarExpandedProvider = SidebarExpandedContext.Provider;

export function useSidebarExpanded() {
  return useContext(SidebarExpandedContext);
}
