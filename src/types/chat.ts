export type Provider = 'anthropic' | 'openai'

export interface ContentPart {
  type: 'text' | 'image'
  text?: string
  imageData?: string  // base64 data URL
  mimeType?: string
}

export interface Citation {
  title: string
  url: string
  start_index: number
  end_index: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: ContentPart[]
  citations?: Citation[]
  timestamp: number
}

export interface Chat {
  id: string
  title: string
  provider: Provider
  model: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

export interface ChatState {
  chats: Chat[]
  activeChatId: string | null
}

export const DEFAULT_PROVIDER: Provider = 'openai'

export const MODELS = {
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
  ],
  openai: [
    { id: 'gpt-5.2', name: 'GPT-5.2' },
    { id: 'gpt-5.2-pro', name: 'GPT-5.2 Pro' },
    { id: 'gpt-5.1', name: 'GPT-5.1' },
    { id: 'gpt-5.1-mini', name: 'GPT-5.1 Mini' },
    { id: 'gpt-4.1', name: 'GPT-4.1' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
    { id: 'o4-mini', name: 'o4 Mini' },
    { id: 'o3', name: 'o3' },
    { id: 'o3-mini', name: 'o3 Mini' },
    { id: 'o1', name: 'o1' },
    { id: 'o1-mini', name: 'o1 Mini' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  ],
} as const

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function generateTitle(firstMessage: string): string {
  // Take first 50 chars of first message as title
  const cleaned = firstMessage.replace(/\s+/g, ' ').trim()
  return cleaned.length > 50 ? cleaned.slice(0, 47) + '…' : cleaned
}
