import { create } from 'zustand'
import type { Chat, Message, Provider, ContentPart, Citation, Folder } from '../types/chat'
import { generateId, generateTitle, MODELS, DEFAULT_PROVIDER } from '../types/chat'
import { useSettingsStore } from './settingsStore'

const STORAGE_KEY = 'yt-assist-chats'
const FOLDERS_STORAGE_KEY = 'yt-assist-folders'

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

function loadFolders(): Folder[] {
  try {
    const saved = localStorage.getItem(FOLDERS_STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function saveFolders(folders: Folder[]) {
  try {
    localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders))
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
  folders: Folder[]

  setActiveChatId: (id: string | null) => void
  createChat: (provider?: Provider, initialMessage?: string) => string
  forkChat: (parentChatId: string, upToMessageId: string, editedContent: ContentPart[]) => string
  deleteChat: (id: string) => void

  addMessage: (chatId: string, role: 'user' | 'assistant', content: ContentPart[]) => string
  appendToMessage: (chatId: string, messageId: string, text: string) => void
  setCitations: (chatId: string, messageId: string, citations: Citation[]) => void
  updateMessage: (chatId: string, messageId: string, content: ContentPart[]) => void
  removeMessage: (chatId: string, messageId: string) => void

  setProvider: (chatId: string, provider: Provider) => void
  setModel: (chatId: string, model: string) => void
  setTitle: (chatId: string, title: string) => void
  setSystemPrompt: (chatId: string, systemPrompt: string | undefined) => void
  togglePinMessage: (chatId: string, messageId: string) => void

  // Folder management
  createFolder: (name: string, systemPrompt?: string) => string
  renameFolder: (id: string, name: string, systemPrompt?: string) => void
  deleteFolder: (id: string) => void
  moveToFolder: (chatId: string, folderId: string | null) => void
  reorderFolders: (folderIds: string[]) => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export const useChatStore = create<ChatStore>((set, get) => ({
  chats: loadChats(),
  activeChatId: null,
  activeChat: null,
  folders: loadFolders(),

  setActiveChatId: (id) => {
    const { chats } = get()
    set({
      activeChatId: id,
      activeChat: id ? (chats.find(c => c.id === id) ?? null) : null,
    })
  },

  createChat: (provider?, initialMessage?) => {
    const id = generateId()
    const settings = useSettingsStore.getState().settings
    const finalProvider: Provider = (provider || settings.defaultProvider || DEFAULT_PROVIDER) as Provider
    const providerModels = MODELS[finalProvider]
    const hasSavedModel = providerModels.some((entry) => entry.id === settings.defaultModel)
    const finalModel =
      finalProvider === settings.defaultProvider && hasSavedModel
        ? settings.defaultModel
        : providerModels[0].id
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
      provider: finalProvider,
      model: finalModel,
      messages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const chats = [newChat, ...get().chats]
    saveChats(chats)
    set({ chats, activeChatId: id, activeChat: newChat })
    return id
  },

  forkChat: (parentChatId, upToMessageId, editedContent) => {
    const parentChat = get().chats.find(c => c.id === parentChatId)
    if (!parentChat) return ''

    // Find the index of the message being edited
    const messageIndex = parentChat.messages.findIndex(m => m.id === upToMessageId)
    if (messageIndex === -1) return ''

    // Create forked chat with messages up to (and including) the edited message
    const forkedMessages = parentChat.messages.slice(0, messageIndex + 1).map((msg, idx) => {
      // Replace the last message (being edited) with new content
      if (idx === messageIndex) {
        return {
          ...msg,
          content: editedContent,
          timestamp: Date.now(),
        }
      }
      return msg
    })

    const forkId = generateId()
    const forkedChat: Chat = {
      id: forkId,
      title: `Fork from: ${parentChat.title}`,
      provider: parentChat.provider,
      model: parentChat.model,
      messages: forkedMessages,
      systemPrompt: parentChat.systemPrompt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      forkedFrom: parentChatId,
      forkPoint: messageIndex,
    }

    const chats = [forkedChat, ...get().chats]
    saveChats(chats)
    set({ chats, activeChatId: forkId, activeChat: forkedChat })
    return forkId
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

  updateMessage: (chatId, messageId, content) => {
    const chats = get().chats.map(c => {
      if (c.id !== chatId) return c
      return {
        ...c,
        messages: c.messages.map(m =>
          m.id === messageId ? { ...m, content, timestamp: Date.now() } : m
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

  removeMessage: (chatId, messageId) => {
    const chats = get().chats.map(c => {
      if (c.id !== chatId) return c
      return {
        ...c,
        messages: c.messages.filter(m => m.id !== messageId),
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

  setSystemPrompt: (chatId, systemPrompt) => {
    const chats = get().chats.map(c =>
      c.id === chatId ? { ...c, systemPrompt, updatedAt: Date.now() } : c
    )
    saveChats(chats)
    set({
      chats,
      activeChat: chats.find(c => c.id === get().activeChatId) ?? null,
    })
  },

  togglePinMessage: (chatId, messageId) => {
    const chats = get().chats.map(c => {
      if (c.id !== chatId) return c
      return {
        ...c,
        messages: c.messages.map(m =>
          m.id === messageId ? { ...m, isPinned: !m.isPinned } : m
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

  // Folder management
  createFolder: (name, systemPrompt) => {
    const id = generateId()
    const newFolder: Folder = {
      id,
      name,
      systemPrompt: systemPrompt?.trim() || undefined,
      createdAt: Date.now(),
      order: get().folders.length,
    }
    const folders = [...get().folders, newFolder]
    saveFolders(folders)
    set({ folders })
    return id
  },

  renameFolder: (id, name, systemPrompt) => {
    const folders = get().folders.map(f =>
      f.id === id
        ? { ...f, name, systemPrompt: systemPrompt?.trim() || undefined }
        : f
    )
    saveFolders(folders)
    set({ folders })
  },

  deleteFolder: (id) => {
    // Move chats in this folder back to "All Chats" (no folder)
    const chats = get().chats.map(c =>
      c.folderId === id ? { ...c, folderId: undefined } : c
    )
    saveChats(chats)

    const folders = get().folders.filter(f => f.id !== id)
    saveFolders(folders)
    set({ chats, folders })
  },

  moveToFolder: (chatId, folderId) => {
    const chats = get().chats.map(c =>
      c.id === chatId ? { ...c, folderId: folderId || undefined, updatedAt: Date.now() } : c
    )
    saveChats(chats)
    set({
      chats,
      activeChat: chats.find(c => c.id === get().activeChatId) ?? null,
    })
  },

  reorderFolders: (folderIds) => {
    const folderMap = new Map(get().folders.map(f => [f.id, f]))
    const folders = folderIds
      .map((id, index) => {
        const folder = folderMap.get(id)
        return folder ? { ...folder, order: index } : null
      })
      .filter((f): f is Folder => f !== null)
    saveFolders(folders)
    set({ folders })
  },
}))
