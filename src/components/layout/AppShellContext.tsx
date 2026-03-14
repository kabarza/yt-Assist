import { createContext, useContext, type ReactNode } from 'react'
import type { ToolDefinition } from '@/types/navigation'

export interface PendingChatNavigation {
  chatId?: string
  promptId?: string
}

export interface AppShellContextValue {
  activeTool: ToolDefinition
  isContextPanelOpen: boolean
  openMobileNavigation: () => void
  closeMobileNavigation: () => void
  toggleContextPanel: () => void
  openChat: (chatId: string) => void
  createNewChat: () => void
  navigateToChat: (prompt?: string) => void
  registerSearchFocus: (focusFn: (() => void) | null) => void
  registerInputFocus: (focusFn: (() => void) | null) => void
  focusContextSearch: () => void
  pendingChatNavigation: PendingChatNavigation
  clearPendingChatNavigation: () => void
}

const AppShellContext = createContext<AppShellContextValue | null>(null)

export function AppShellProvider({
  value,
  children,
}: {
  value: AppShellContextValue
  children: ReactNode
}) {
  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>
}

export function useAppShell() {
  const context = useContext(AppShellContext)

  if (!context) {
    throw new Error('useAppShell must be used within AppShellProvider')
  }

  return context
}
