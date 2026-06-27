'use client';

import { createContext, useContext } from 'react';

interface SidebarState {
  expanded: boolean;
  collapse?: () => void;
}

const SidebarExpandedContext = createContext<SidebarState>({ expanded: true });

export const SidebarExpandedProvider = SidebarExpandedContext.Provider;

export function useSidebarExpanded() {
  return useContext(SidebarExpandedContext).expanded;
}

export function useSidebarCollapse() {
  return useContext(SidebarExpandedContext).collapse;
}
