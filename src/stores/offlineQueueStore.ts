import { create } from 'zustand'
import type { ContentPart, Provider } from '../types/chat'

const QUEUE_STORAGE_KEY = 'yt-assist-offline-queue'

export interface QueuedMessage {
  id: string
  chatId: string
  provider: Provider
  model: string
  messages: Array<{ role: 'user' | 'assistant'; content: ContentPart[] }>
  webSearch: boolean
  systemPrompt?: string
  timestamp: number
  retryCount: number
  status: 'pending' | 'retrying' | 'failed'
}

interface OfflineQueueStore {
  queue: QueuedMessage[]
  isProcessing: boolean

  addToQueue: (message: Omit<QueuedMessage, 'id' | 'timestamp' | 'retryCount' | 'status'>) => void
  removeFromQueue: (id: string) => void
  updateQueueStatus: (id: string, status: QueuedMessage['status']) => void
  incrementRetry: (id: string) => void
  clearQueue: () => void
  processQueue: (onProcess: (message: QueuedMessage) => Promise<boolean>) => Promise<void>
}

// Load queue from localStorage
function loadQueue(): QueuedMessage[] {
  try {
    const saved = localStorage.getItem(QUEUE_STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

// Save queue to localStorage
function saveQueue(queue: QueuedMessage[]) {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // Ignore storage errors
  }
}

export const useOfflineQueue = create<OfflineQueueStore>((set, get) => ({
  queue: loadQueue(),
  isProcessing: false,

  addToQueue: (message) => {
    const queuedMessage: QueuedMessage = {
      ...message,
      id: `queue-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    }

    const queue = [...get().queue, queuedMessage]
    saveQueue(queue)
    set({ queue })
  },

  removeFromQueue: (id) => {
    const queue = get().queue.filter(m => m.id !== id)
    saveQueue(queue)
    set({ queue })
  },

  updateQueueStatus: (id, status) => {
    const queue = get().queue.map(m =>
      m.id === id ? { ...m, status } : m
    )
    saveQueue(queue)
    set({ queue })
  },

  incrementRetry: (id) => {
    const queue = get().queue.map(m =>
      m.id === id ? { ...m, retryCount: m.retryCount + 1 } : m
    )
    saveQueue(queue)
    set({ queue })
  },

  clearQueue: () => {
    saveQueue([])
    set({ queue: [] })
  },

  processQueue: async (onProcess) => {
    if (get().isProcessing) return

    set({ isProcessing: true })

    const pendingMessages = get().queue.filter(m => m.status === 'pending')

    for (const message of pendingMessages) {
      // Update status to retrying
      get().updateQueueStatus(message.id, 'retrying')

      try {
        const success = await onProcess(message)

        if (success) {
          // Remove from queue on success
          get().removeFromQueue(message.id)
      } else {
        // Mark as failed if processing returned false
        const nextRetryCount = message.retryCount + 1
        get().incrementRetry(message.id)
        if (nextRetryCount >= 3) {
          get().updateQueueStatus(message.id, 'failed')
        } else {
          get().updateQueueStatus(message.id, 'pending')
        }
      }
    } catch (error) {
      // Mark as failed on error
      const nextRetryCount = message.retryCount + 1
      get().incrementRetry(message.id)
      if (nextRetryCount >= 3) {
        get().updateQueueStatus(message.id, 'failed')
      } else {
        get().updateQueueStatus(message.id, 'pending')
      }
      }
    }

    set({ isProcessing: false })
  },
}))
