import { Pin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Chat, Message } from '../types/chat'

interface PinnedMessagesPanelProps {
  chats: Chat[]
  activeChatId: string | null
  onJumpToMessage?: (chatId: string, messageId: string) => void
  onUnpin: (chatId: string, messageId: string) => void
  onClose: () => void
}

function getMessagePreview(message: Message): string {
  const textPart = message.content.find(p => p.type === 'text')
  if (!textPart?.text) return 'Image message'
  return textPart.text.slice(0, 150) + (textPart.text.length > 150 ? '...' : '')
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / (24 * 3600000))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export default function PinnedMessagesPanel({
  chats,
  activeChatId,
  onJumpToMessage,
  onUnpin,
  onClose,
}: PinnedMessagesPanelProps) {
  // Get all pinned messages from all chats
  const pinnedMessages: Array<{ chat: Chat; message: Message }> = []

  chats.forEach(chat => {
    chat.messages.forEach(message => {
      if (message.isPinned) {
        pinnedMessages.push({ chat, message })
      }
    })
  })

  // Sort by timestamp (newest first)
  pinnedMessages.sort((a, b) => b.message.timestamp - a.message.timestamp)

  return (
    <div className="flex flex-col h-full bg-sidebar border-l border-sidebar-border w-80">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Pin className="h-4 w-4 fill-current text-foreground" />
          <h2 className="font-semibold text-sm">Pinned Messages</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7"
          aria-label="Close pinned messages"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {pinnedMessages.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Pin className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">No pinned messages</p>
              <p className="text-xs text-muted-foreground mt-1">
                Pin important messages to find them quickly
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {pinnedMessages.map(({ chat, message }) => {
                const isActiveChat = chat.id === activeChatId
                return (
                  <div
                    key={`${chat.id}-${message.id}`}
                    className="group relative rounded-lg border border-border bg-card p-3 hover:bg-accent/50 transition-colors"
                  >
                    {/* Chat title */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-xs font-medium truncate ${isActiveChat ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {chat.title}
                      </span>
                      {isActiveChat && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-accent text-accent-foreground">
                          Current
                        </span>
                      )}
                    </div>

                    {/* Message preview */}
                    <p className="text-sm text-foreground/90 mb-2 line-clamp-3">
                      {getMessagePreview(message)}
                    </p>

                    {/* Footer with timestamp and actions */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(message.timestamp)}
                      </span>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onJumpToMessage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onJumpToMessage(chat.id, message.id)}
                            className="h-6 px-2 text-xs"
                          >
                            Jump to
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onUnpin(chat.id, message.id)}
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          aria-label="Unpin message"
                        >
                          <Pin className="h-3 w-3 fill-current" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
