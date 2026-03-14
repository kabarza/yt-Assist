import { useEffect } from 'react'
import type { ToolId } from '@/types/navigation'

export interface KeyboardShortcuts {
  onNewChat?: () => void
  onTogglePanel?: () => void
  onFocusInput?: () => void
  onFocusSearch?: () => void
  onSelectTool?: (toolId: ToolId) => void
  toolShortcuts?: Array<{
    toolId: ToolId
    shortcut: string
  }>
}

/**
 * Hook to handle global keyboard shortcuts
 *
 * Shortcuts:
 * - Cmd/Ctrl+N: New chat
 * - Cmd/Ctrl+B: Toggle context panel
 * - /: Focus chat input
 * - Cmd/Ctrl+K: Focus search
 * - Cmd/Ctrl+1..5: Switch tools
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcuts) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modKey = isMac ? event.metaKey : event.ctrlKey
      const key = event.key.toLowerCase()

      // Ignore shortcuts when typing in input/textarea (except for /)
      const isInputField =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement).isContentEditable

      // Cmd/Ctrl+N: New chat
      if (modKey && key === 'n' && shortcuts.onNewChat) {
        event.preventDefault()
        shortcuts.onNewChat()
        return
      }

      // Cmd/Ctrl+B: Toggle context panel
      if (modKey && key === 'b' && shortcuts.onTogglePanel) {
        event.preventDefault()
        shortcuts.onTogglePanel()
        return
      }

      // Cmd/Ctrl+K: Focus search
      if (modKey && (key === 'k' || key === 'f') && shortcuts.onFocusSearch) {
        event.preventDefault()
        shortcuts.onFocusSearch()
        return
      }

      if (modKey && shortcuts.onSelectTool && shortcuts.toolShortcuts) {
        const matchedTool = shortcuts.toolShortcuts.find((toolShortcut) => {
          const normalizedShortcut = toolShortcut.shortcut.toLowerCase()
          return normalizedShortcut.startsWith('mod+') && normalizedShortcut.slice(4) === key
        })

        if (matchedTool) {
          event.preventDefault()
          shortcuts.onSelectTool(matchedTool.toolId)
          return
        }
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
