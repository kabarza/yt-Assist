import { useEffect, useRef } from 'react'
import { useOnlineStatus } from './useOnlineStatus'
import { useOfflineQueue } from '../stores/offlineQueueStore'
import { useChatStore } from '../stores/chatStore'
import { requestChatText } from '../utils/apiClient'
import { toast } from 'sonner'

/**
 * Hook to handle offline sync and queue processing
 * Automatically processes queued messages when connection is restored
 */
export function useOfflineSync() {
  const { isOnline } = useOnlineStatus()
  const { queue, processQueue } = useOfflineQueue()
  const { addMessage, setCitations } = useChatStore()
  const previousOnlineStatus = useRef(isOnline)
  const hasShownOfflineToast = useRef(false)

  useEffect(() => {
    // Detect status changes
    if (previousOnlineStatus.current !== isOnline) {
      if (isOnline) {
        // Just came back online
        toast.success('Connection restored', {
          description: queue.length > 0
            ? `Processing ${queue.length} queued message${queue.length > 1 ? 's' : ''}...`
            : undefined,
        })
        hasShownOfflineToast.current = false

        // Process queued messages
        if (queue.length > 0) {
          processQueue(async (message) => {
            try {
              const result = await requestChatText({
                provider: message.provider,
                model: message.model,
                messages: message.messages,
                webSearch: message.webSearch,
                systemPrompt: message.systemPrompt,
              })

              const assistantMessageId = addMessage(message.chatId, 'assistant', [
                { type: 'text', text: result.text },
              ])

              if (result.citations.length > 0) {
                setCitations(message.chatId, assistantMessageId, result.citations)
              }

              return true
            } catch {
              return false
            }
          })
        }
      } else {
        // Just went offline
        if (!hasShownOfflineToast.current) {
          toast.error('Connection lost', {
            description: 'Messages will be queued and sent when connection is restored',
          })
          hasShownOfflineToast.current = true
        }
      }

      previousOnlineStatus.current = isOnline
    }
  }, [isOnline, queue.length, processQueue])

  return { isOnline }
}
