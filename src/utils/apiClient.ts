import { useAPIConfigStore } from '../stores/apiConfigStore'
import { useSettingsStore } from '../stores/settingsStore'
import type { Citation, ContentPart, Provider } from '../types/chat'
import { fetchApi } from './fetchApi'

export interface ChatEndpointOverride {
  baseUrl?: string
  apiKey?: string
}

export interface ChatRequestMessage {
  role: 'user' | 'assistant'
  content: ContentPart[]
}

export interface ChatRequestOptions {
  provider: Provider
  model: string
  messages: ChatRequestMessage[]
  webSearch?: boolean
  systemPrompt?: string
  signal?: AbortSignal
  endpointOverride?: ChatEndpointOverride
}

export interface ChatTextResult {
  text: string
  citations: Citation[]
}

export interface StreamChatHandlers {
  onText?: (text: string) => void
  onCitations?: (citations: Citation[]) => void
  onError?: (error: string) => void
}

interface ChatProxyRequestBody {
  model: string
  messages: ChatRequestMessage[]
  stream: boolean
  webSearch: boolean
  systemPrompt?: string
  endpointOverride?: ChatEndpointOverride
}

/**
 * All chat traffic goes through the local proxy. Provider-specific endpoint
 * overrides and browser-stored API keys are forwarded in the request body.
 */
export function getAPIEndpoint(provider: Provider): string {
  return `/api/chat/${provider}`
}

function getStoredApiKey(provider: Provider): string | undefined {
  const { settings } = useSettingsStore.getState()

  if (provider === 'openai') {
    return settings.openaiApiKey?.trim() || undefined
  }

  return settings.anthropicApiKey?.trim() || undefined
}

function sanitizeEndpointOverride(
  endpointOverride?: ChatEndpointOverride
): ChatEndpointOverride | undefined {
  if (!endpointOverride) return undefined

  const baseUrl = endpointOverride.baseUrl?.trim()
  const apiKey = endpointOverride.apiKey?.trim()

  if (!baseUrl && !apiKey) {
    return undefined
  }

  return {
    ...(baseUrl ? { baseUrl } : {}),
    ...(apiKey ? { apiKey } : {}),
  }
}

export function getEndpointOverride(provider: Provider): ChatEndpointOverride | undefined {
  const state = useAPIConfigStore.getState()
  const providerConfig = state[provider]
  const usesCustomEndpoint =
    state.custom.enabled &&
    state.custom.provider === provider &&
    !!state.custom.baseUrl

  const baseUrl = usesCustomEndpoint
    ? state.custom.baseUrl
    : providerConfig.enabled && providerConfig.baseUrl
    ? providerConfig.baseUrl
    : undefined

  const apiKey = (usesCustomEndpoint ? state.custom.apiKey : providerConfig.apiKey) || getStoredApiKey(provider)

  return sanitizeEndpointOverride({ baseUrl, apiKey })
}

function buildRequestBody(
  options: ChatRequestOptions,
  stream: boolean
): ChatProxyRequestBody {
  const endpointOverride = sanitizeEndpointOverride(
    options.endpointOverride ?? getEndpointOverride(options.provider)
  )

  return {
    model: options.model,
    messages: options.messages,
    stream,
    webSearch: options.webSearch ?? false,
    ...(options.systemPrompt ? { systemPrompt: options.systemPrompt } : {}),
    ...(endpointOverride ? { endpointOverride } : {}),
  }
}

async function getResponseError(response: Response): Promise<string> {
  try {
    const data = await response.json()
    if (typeof data?.error === 'string' && data.error.trim()) {
      return data.error
    }
  } catch {
    // Fall back to text/status below.
  }

  try {
    const text = await response.text()
    if (text.trim()) {
      return text.trim()
    }
  } catch {
    // Ignore.
  }

  return `API error: ${response.status}`
}

function handleStreamLine(line: string, handlers: StreamChatHandlers) {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) return

  const payload = trimmed.slice(5).trim()
  if (!payload || payload === '[DONE]') return

  const data = JSON.parse(payload)

  if (data.type === 'delta' && typeof data.text === 'string') {
    handlers.onText?.(data.text)
    return
  }

  if (data.type === 'citations' && Array.isArray(data.citations)) {
    handlers.onCitations?.(data.citations)
    return
  }

  if (data.type === 'error' && typeof data.error === 'string') {
    handlers.onError?.(data.error)
  }
}

async function consumeEventStream(response: Response, handlers: StreamChatHandlers) {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      try {
        handleStreamLine(line, handlers)
      } catch {
        // Ignore malformed or partial events and keep the stream alive.
      }
    }
  }

  buffer += decoder.decode()

  if (buffer.trim()) {
    try {
      handleStreamLine(buffer, handlers)
    } catch {
      // Ignore malformed trailing data.
    }
  }
}

export async function requestChatText(options: ChatRequestOptions): Promise<ChatTextResult> {
  const response = await fetchApi(getAPIEndpoint(options.provider), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildRequestBody(options, false)),
    signal: options.signal,
  })

  if (!response.ok) {
    throw new Error(await getResponseError(response))
  }

  const data = await response.json()
  return {
    text: typeof data?.text === 'string' ? data.text : '',
    citations: Array.isArray(data?.citations) ? data.citations : [],
  }
}

export async function streamChatCompletion(
  options: ChatRequestOptions,
  handlers: StreamChatHandlers = {}
): Promise<void> {
  const response = await fetchApi(getAPIEndpoint(options.provider), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildRequestBody(options, true)),
    signal: options.signal,
  })

  if (!response.ok) {
    throw new Error(await getResponseError(response))
  }

  await consumeEventStream(response, handlers)
}

/**
 * Check if a provider has custom configuration
 */
export function hasCustomEndpoint(provider: Provider): boolean {
  const { hasCustomConfig } = useAPIConfigStore.getState()
  return hasCustomConfig(provider)
}

/**
 * Get the display name for the current endpoint configuration
 */
export function getEndpointDisplayName(provider: Provider): string {
  const { hasCustomConfig, getActiveEndpoint } = useAPIConfigStore.getState()

  if (!hasCustomConfig(provider)) {
    return 'Default'
  }

  const endpoint = getActiveEndpoint(provider)

  if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) {
    if (endpoint.includes('1234')) return 'LM Studio'
    if (endpoint.includes('11434')) return 'Ollama'
    return 'Local'
  }

  if (endpoint.includes('azure')) {
    return 'Azure'
  }

  return 'Custom'
}
