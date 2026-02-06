import { create } from 'zustand'
import type { Chat, Message, Provider, ContentPart, Citation } from '../types/chat'
import { generateId, generateTitle, MODELS, DEFAULT_PROVIDER } from '../types/chat'

const STORAGE_KEY = 'yt-assist-chats'

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------
function loadChats(): Chat[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function saveChats(chats: Chat[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------
interface ChatStore {
  chats: Chat[]
  activeChatId: string | null
  activeChat: Chat | null

  setActiveChatId: (id: string | null) => void
  createChat: (provider?: Provider, initialMessage?: string) => string
  deleteChat: (id: string) => void

  addMessage: (chatId: string, role: 'user' | 'assistant', content: ContentPart[]) => string
  appendToMessage: (chatId: string, messageId: string, text: string) => void
  setCitations: (chatId: string, messageId: string, citations: Citation[]) => void

  setProvider: (chatId: string, provider: Provider) => void
  setModel: (chatId: string, model: string) => void
  setTitle: (chatId: string, title: string) => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export const useChatStore = create<ChatStore>((set, get) => ({
  chats: loadChats(),
  activeChatId: null,
  activeChat: null,

  setActiveChatId: (id) => {
    const { chats } = get()
    set({
      activeChatId: id,
      activeChat: id ? (chats.find(c => c.id === id) ?? null) : null,
    })
  },

  createChat: (provider = DEFAULT_PROVIDER, initialMessage?) => {
    const id = generateId()
    const model = MODELS[provider][0].id
    const messages: Message[] = []

    if (initialMessage) {
      messages.push({
        id: generateId(),
        role: 'user',
        content: [{ type: 'text', text: initialMessage }],
        timestamp: Date.now(),
      })
    }

    const newChat: Chat = {
      id,
      title: initialMessage ? generateTitle(initialMessage) : 'New Chat',
      provider,
      model,
      messages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const chats = [newChat, ...get().chats]
    saveChats(chats)
    set({ chats, activeChatId: id, activeChat: newChat })
    return id
  },

  deleteChat: (id) => {
    const chats = get().chats.filter(c => c.id !== id)
    saveChats(chats)
    const activeChatId = get().activeChatId === id ? null : get().activeChatId
    set({
      chats,
      activeChatId,
      activeChat: activeChatId ? (chats.find(c => c.id === activeChatId) ?? null) : null,
    })
  },

  addMessage: (chatId, role, content) => {
    const message: Message = {
      id: generateId(),
      role,
      content,
      timestamp: Date.now(),
    }

    const chats = get().chats.map(c => {
      if (c.id !== chatId) return c
      const messages = [...c.messages, message]
      const firstTitleText = content.find(
        p => p.type === 'text' && p.text && !p.text.trimStart().startsWith('<canvas')
      )?.text
      const title = c.messages.length === 0 && role === 'user'
        ? generateTitle(firstTitleText || 'New Chat')
        : c.title
      return { ...c, messages, title, updatedAt: Date.now() }
    })

    saveChats(chats)
    set({
      chats,
      activeChat: chats.find(c => c.id === get().activeChatId) ?? null,
    })

    return message.id
  },

  appendToMessage: (chatId, messageId, text) => {
    const chats = get().chats.map(c => {
      if (c.id !== chatId) return c
      return {
        ...c,
        messages: c.messages.map(m => {
          if (m.id !== messageId) return m
          const lastPart = m.content[m.content.length - 1]
          if (lastPart?.type === 'text') {
            return {
              ...m,
              content: [
                ...m.content.slice(0, -1),
                { ...lastPart, text: (lastPart.text || '') + text },
              ],
            }
          }
          return { ...m, content: [...m.content, { type: 'text' as const, text }] }
        }),
        updatedAt: Date.now(),
      }
    })

    saveChats(chats)
    set({
      chats,
      activeChat: chats.find(c => c.id === get().activeChatId) ?? null,
    })
  },

  setCitations: (chatId, messageId, citations) => {
    const chats = get().chats.map(c => {
      if (c.id !== chatId) return c
      return {
        ...c,
        messages: c.messages.map(m =>
          m.id === messageId ? { ...m, citations } : m
        ),
        updatedAt: Date.now(),
      }
    })

    saveChats(chats)
    set({
      chats,
      activeChat: chats.find(c => c.id === get().activeChatId) ?? null,
    })
  },

  setProvider: (chatId, provider) => {
    const model = MODELS[provider][0].id
    const chats = get().chats.map(c =>
      c.id === chatId ? { ...c, provider, model, updatedAt: Date.now() } : c
    )
    saveChats(chats)
    set({
      chats,
      activeChat: chats.find(c => c.id === get().activeChatId) ?? null,
    })
  },

  setModel: (chatId, model) => {
    const chats = get().chats.map(c =>
      c.id === chatId ? { ...c, model, updatedAt: Date.now() } : c
    )
    saveChats(chats)
    set({
      chats,
      activeChat: chats.find(c => c.id === get().activeChatId) ?? null,
    })
  },

  setTitle: (chatId, title) => {
    const chats = get().chats.map(c =>
      c.id === chatId ? { ...c, title, updatedAt: Date.now() } : c
    )
    saveChats(chats)
    set({
      chats,
      activeChat: chats.find(c => c.id === get().activeChatId) ?? null,
    })
  },
}))
