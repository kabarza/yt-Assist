import { useState, useEffect, useCallback } from 'react'
import type { Chat, Message, Provider, ContentPart } from '../types/chat'
import { generateId, generateTitle, MODELS, DEFAULT_PROVIDER } from '../types/chat'

const STORAGE_KEY = 'yt-assist-chats'

export function useChatStore() {
  const [chats, setChats] = useState<Chat[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch {
      // Ignore errors
    }
    return []
  })

  const [activeChatId, setActiveChatId] = useState<string | null>(null)

  // Save to localStorage whenever chats change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
    } catch {
      // Ignore errors
    }
  }, [chats])

  const activeChat = chats.find(c => c.id === activeChatId) || null

  const createChat = useCallback((
    provider: Provider = DEFAULT_PROVIDER,
    initialMessage?: string
  ): string => {
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

    setChats(prev => [newChat, ...prev])
    setActiveChatId(id)
    return id
  }, [])

  const deleteChat = useCallback((id: string) => {
    setChats(prev => prev.filter(c => c.id !== id))
    if (activeChatId === id) {
      setActiveChatId(null)
    }
  }, [activeChatId])

  const updateChat = useCallback((id: string, updates: Partial<Chat>) => {
    setChats(prev => prev.map(c => 
      c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
    ))
  }, [])

  const addMessage = useCallback((chatId: string, role: 'user' | 'assistant', content: ContentPart[]) => {
    const message: Message = {
      id: generateId(),
      role,
      content,
      timestamp: Date.now(),
    }

    setChats(prev => prev.map(c => {
      if (c.id !== chatId) return c
      
      const messages = [...c.messages, message]
      const title = c.messages.length === 0 && role === 'user'
        ? generateTitle(content.find(p => p.type === 'text')?.text || 'New Chat')
        : c.title

      return { ...c, messages, title, updatedAt: Date.now() }
    }))

    return message.id
  }, [])

  const updateMessage = useCallback((chatId: string, messageId: string, content: ContentPart[]) => {
    setChats(prev => prev.map(c => {
      if (c.id !== chatId) return c
      return {
        ...c,
        messages: c.messages.map(m => 
          m.id === messageId ? { ...m, content } : m
        ),
        updatedAt: Date.now(),
      }
    }))
  }, [])

  const appendToMessage = useCallback((chatId: string, messageId: string, text: string) => {
    setChats(prev => prev.map(c => {
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
                { ...lastPart, text: (lastPart.text || '') + text }
              ]
            }
          }
          return {
            ...m,
            content: [...m.content, { type: 'text', text }]
          }
        }),
        updatedAt: Date.now(),
      }
    }))
  }, [])

  const setProvider = useCallback((chatId: string, provider: Provider) => {
    const model = MODELS[provider][0].id
    updateChat(chatId, { provider, model })
  }, [updateChat])

  const setModel = useCallback((chatId: string, model: string) => {
    updateChat(chatId, { model })
  }, [updateChat])

  const setTitle = useCallback((chatId: string, title: string) => {
    updateChat(chatId, { title })
  }, [updateChat])

  return {
    chats,
    activeChatId,
    activeChat,
    setActiveChatId,
    createChat,
    deleteChat,
    updateChat,
    addMessage,
    updateMessage,
    appendToMessage,
    setProvider,
    setModel,
    setTitle,
  }
}
