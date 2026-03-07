import { create } from 'zustand'
import type { Provider } from '../types/chat'

export interface APIEndpointConfig {
  baseUrl: string
  apiKey?: string
  enabled: boolean
}

export interface APIConfigState {
  openai: APIEndpointConfig
  anthropic: APIEndpointConfig
  azure: APIEndpointConfig
  custom: APIEndpointConfig & { provider: 'openai' | 'anthropic' }
  setConfig: (provider: Provider | 'azure' | 'custom', config: Partial<APIEndpointConfig>) => void
  resetConfig: (provider: Provider | 'azure' | 'custom') => void
  getActiveEndpoint: (provider: Provider) => string
  hasCustomConfig: (provider: Provider) => boolean
}

const STORAGE_KEY = 'yt-assist-api-config'

const DEFAULT_ENDPOINTS = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  azure: '',
  custom: '',
}

const loadFromStorage = (): Partial<Omit<APIConfigState, 'setConfig' | 'resetConfig' | 'getActiveEndpoint' | 'hasCustomConfig'>> => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    console.error('Failed to load API config:', error)
  }
  return {}
}

const saveToStorage = (state: Omit<APIConfigState, 'setConfig' | 'resetConfig' | 'getActiveEndpoint' | 'hasCustomConfig'>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      openai: state.openai,
      anthropic: state.anthropic,
      azure: state.azure,
      custom: state.custom,
    }))
  } catch (error) {
    console.error('Failed to save API config:', error)
  }
}

const initialState = loadFromStorage()

export const useAPIConfigStore = create<APIConfigState>((set, get) => ({
  openai: initialState.openai || {
    baseUrl: DEFAULT_ENDPOINTS.openai,
    enabled: false,
  },
  anthropic: initialState.anthropic || {
    baseUrl: DEFAULT_ENDPOINTS.anthropic,
    enabled: false,
  },
  azure: initialState.azure || {
    baseUrl: DEFAULT_ENDPOINTS.azure,
    enabled: false,
  },
  custom: initialState.custom || {
    baseUrl: DEFAULT_ENDPOINTS.custom,
    enabled: false,
    provider: 'openai',
  },

  setConfig: (provider, config) => {
    set((state) => {
      const newState = {
        ...state,
        [provider]: {
          ...state[provider as keyof typeof state],
          ...config,
        },
      }
      saveToStorage(newState)
      return newState
    })
  },

  resetConfig: (provider) => {
    set((state) => {
      const newState = {
        ...state,
        [provider]: {
          baseUrl: DEFAULT_ENDPOINTS[provider as keyof typeof DEFAULT_ENDPOINTS] || '',
          enabled: false,
          ...(provider === 'custom' ? { provider: 'openai' as const } : {}),
        },
      }
      saveToStorage(newState)
      return newState
    })
  },

  getActiveEndpoint: (provider) => {
    const state = get()
    const config = state[provider]

    // Check if custom endpoint is enabled and uses this provider
    if (state.custom.enabled && state.custom.provider === provider && state.custom.baseUrl) {
      return state.custom.baseUrl
    }

    // Check provider-specific config
    if (config.enabled && config.baseUrl) {
      return config.baseUrl
    }

    // Fallback to default
    return DEFAULT_ENDPOINTS[provider]
  },

  hasCustomConfig: (provider) => {
    const state = get()
    const config = state[provider]
    return (config.enabled && !!config.baseUrl) ||
           (state.custom.enabled && state.custom.provider === provider && !!state.custom.baseUrl)
  },
}))
