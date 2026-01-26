import type { Chat } from '../types/chat'

interface ChatListProps {
  chats: Chat[]
  activeChatId: string | null
  onSelectChat: (id: string) => void
  onNewChat: () => void
  onDeleteChat: (id: string) => void
}

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const ChatIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
)

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
    <div className="w-64 flex flex-col border-r border-gray-800 bg-gray-900/50">
      {/* Header */}
      <div className="p-3 border-b border-gray-800">
        <button
          onClick={onNewChat}
          data-flow-name="btn-new-chat"
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-lime-500 text-gray-900 rounded-lg font-medium hover:bg-lime-400 transition-colors"
        >
          <PlusIcon />
          New Chat
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {sortedChats.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No chats yet
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {sortedChats.map((chat) => (
              <div
                key={chat.id}
                className={`
                  group flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors
                  ${activeChatId === chat.id 
                    ? 'bg-gray-800 text-white' 
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                  }
                `}
                onClick={() => onSelectChat(chat.id)}
                data-flow-name={`chat-item-${chat.id}`}
              >
                <ChatIcon />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{chat.title}</p>
                  <p className="text-xs text-gray-500">{formatDate(chat.updatedAt)}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteChat(chat.id)
                  }}
                  data-flow-name={`delete-chat-${chat.id}`}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
