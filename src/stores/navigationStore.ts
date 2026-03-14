import { create } from 'zustand'
import type { ShellNavigationState, ToolId } from '@/types/navigation'

const STORAGE_KEY = 'yt-assist-shell-navigation'

function loadDesktopPanelState(): Partial<Record<ToolId, boolean>> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return {}

    const parsed = JSON.parse(saved) as Pick<ShellNavigationState, 'desktopPanelOpenByTool'>
    return parsed.desktopPanelOpenByTool ?? {}
  } catch {
    return {}
  }
}

function saveDesktopPanelState(desktopPanelOpenByTool: Partial<Record<ToolId, boolean>>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ desktopPanelOpenByTool }))
  } catch {
    // Ignore persistence failures.
  }
}

interface NavigationStore extends ShellNavigationState {
  setDesktopPanelOpen: (toolId: ToolId, open: boolean) => void
  toggleDesktopPanel: (toolId: ToolId, defaultOpen?: boolean) => void
  openMobileNavigation: () => void
  closeMobileNavigation: () => void
  setMobileNavigationOpen: (open: boolean) => void
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  desktopPanelOpenByTool: loadDesktopPanelState(),
  mobileNavigationOpen: false,
  setDesktopPanelOpen: (toolId, open) =>
    set((state) => {
      const desktopPanelOpenByTool = {
        ...state.desktopPanelOpenByTool,
        [toolId]: open,
      }
      saveDesktopPanelState(desktopPanelOpenByTool)
      return { desktopPanelOpenByTool }
    }),
  toggleDesktopPanel: (toolId, defaultOpen = false) =>
    set((state) => {
      const current = state.desktopPanelOpenByTool[toolId] ?? defaultOpen
      const desktopPanelOpenByTool = {
        ...state.desktopPanelOpenByTool,
        [toolId]: !current,
      }
      saveDesktopPanelState(desktopPanelOpenByTool)
      return { desktopPanelOpenByTool }
    }),
  openMobileNavigation: () => set({ mobileNavigationOpen: true }),
  closeMobileNavigation: () => set({ mobileNavigationOpen: false }),
  setMobileNavigationOpen: (open) => set({ mobileNavigationOpen: open }),
}))
