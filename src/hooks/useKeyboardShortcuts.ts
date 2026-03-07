import { useEffect } from 'react'

export interface KeyboardShortcuts {
  onNewChat?: () => void
  onToggleSidebar?: () => void
  onFocusInput?: () => void
  onFocusSearch?: () => void
  onSwitchToPackaging?: () => void
  onSwitchToChat?: () => void
}

/**
 * Hook to handle global keyboard shortcuts
 *
 * Shortcuts:
 * - Cmd/Ctrl+N: New chat
 * - Cmd/Ctrl+B: Toggle sidebar
 * - /: Focus chat input
 * - Cmd/Ctrl+F: Focus search
 * - Cmd/Ctrl+1: Switch to packaging tool
 * - Cmd/Ctrl+2: Switch to chat tool
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcuts) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modKey = isMac ? event.metaKey : event.ctrlKey

      // Ignore shortcuts when typing in input/textarea (except for /)
      const isInputField =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement).isContentEditable

      // Cmd/Ctrl+N: New chat
      if (modKey && event.key === 'n' && shortcuts.onNewChat) {
        event.preventDefault()
        shortcuts.onNewChat()
        return
      }

      // Cmd/Ctrl+B: Toggle sidebar
      if (modKey && event.key === 'b' && shortcuts.onToggleSidebar) {
        event.preventDefault()
        shortcuts.onToggleSidebar()
        return
      }

      // Cmd/Ctrl+F: Focus search
      if (modKey && event.key === 'f' && shortcuts.onFocusSearch) {
        event.preventDefault()
        shortcuts.onFocusSearch()
        return
      }

      // Cmd/Ctrl+1: Switch to packaging tool
      if (modKey && event.key === '1' && shortcuts.onSwitchToPackaging) {
        event.preventDefault()
        shortcuts.onSwitchToPackaging()
        return
      }

      // Cmd/Ctrl+2: Switch to chat tool
      if (modKey && event.key === '2' && shortcuts.onSwitchToChat) {
        event.preventDefault()
        shortcuts.onSwitchToChat()
        return
      }

      // /: Focus input (only when NOT already in an input field)
      if (event.key === '/' && !isInputField && shortcuts.onFocusInput) {
        event.preventDefault()
        shortcuts.onFocusInput()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}
