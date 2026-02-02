import type { Chat } from '../types/chat'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, Trash2, MessageCircle } from 'lucide-react'

interface ChatListProps {
  chats: Chat[]
  activeChatId: string | null
  onSelectChat: (id: string) => void
  onNewChat: () => void
  onDeleteChat: (id: string) => void
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

export default function ChatList({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
}: ChatListProps) {
  const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="w-64 flex flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <Button
          onClick={onNewChat}
          data-flow-name="btn-new-chat"
          className="w-full"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Chat List */}
      <ScrollArea className="flex-1">
        {sortedChats.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No chats yet
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {sortedChats.map((chat) => (
              <div
                key={chat.id}
                className="group relative"
              >
                <Button
                  variant="ghost"
                  onClick={() => onSelectChat(chat.id)}
                  data-flow-name={`chat-item-${chat.id}`}
                  className={`
                    w-full flex items-start gap-2 h-auto p-2 justify-start
                    ${activeChatId === chat.id
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                    }
                  `}
                  aria-label={`Select chat: ${chat.title}`}
                  aria-current={activeChatId === chat.id ? 'true' : undefined}
                >
                  <MessageCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate">{chat.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(chat.updatedAt)}</p>
                  </div>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteChat(chat.id)
                  }}
                  data-flow-name={`delete-chat-${chat.id}`}
                  className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 h-6 w-6 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete chat: ${chat.title}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
