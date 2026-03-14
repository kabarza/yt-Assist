/**
 * Keyboard shortcut utilities
 */

/**
 * Detect if the user is on a Mac
 */
export const isMac = () => {
  if (typeof navigator === 'undefined') return false
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0
}

/**
 * Get the modifier key symbol for the current platform
 * Returns '⌘' for Mac, 'Ctrl' for others
 */
export const getModKey = () => {
  return isMac() ? '⌘' : 'Ctrl'
}

/**
 * Format a keyboard shortcut for display
 * @param key The key (e.g., 'N', 'B', '1', '2', '/')
 * @param withMod Whether to include the modifier key (Cmd/Ctrl)
 */
export const formatShortcut = (key: string, withMod: boolean = true) => {
  const normalized = key.toLowerCase()

  if (normalized.startsWith('mod+')) {
    return `${getModKey()}+${key.slice(4).toUpperCase()}`
  }

  if (!withMod) return key.toUpperCase()

  if (/^[a-z0-9]$/i.test(key)) {
    return `${getModKey()}+${key.toUpperCase()}`
  }

  return key
}
