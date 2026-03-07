import { create } from 'zustand'
import type { Provider } from '../types/chat'
import { DEFAULT_PROVIDER, MODELS } from '../types/chat'

const SETTINGS_STORAGE_KEY = 'yt-assist-settings'

export interface AppSettings {
  // API Keys
  openaiApiKey?: string
  anthropicApiKey?: string

  // Default Model
  defaultProvider: Provider
  defaultModel: string
}

interface SettingsStore {
  settings: AppSettings
  updateSettings: (updates: Partial<AppSettings>) => void
  resetSettings: () => void
}

// Default settings
const defaultSettings: AppSettings = {
  defaultProvider: DEFAULT_PROVIDER,
  defaultModel: MODELS[DEFAULT_PROVIDER][0].id,
}

// Load settings from localStorage
function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return { ...defaultSettings, ...parsed }
    }
  } catch {
    // Ignore parsing errors
  }
  return defaultSettings
}

// Save settings to localStorage
function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage errors
  }
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: loadSettings(),

  updateSettings: (updates) => {
    set((state) => {
      const newSettings = { ...state.settings, ...updates }
      saveSettings(newSettings)
      return { settings: newSettings }
    })
  },

  resetSettings: () => {
    saveSettings(defaultSettings)
    set({ settings: defaultSettings })
  },
}))
