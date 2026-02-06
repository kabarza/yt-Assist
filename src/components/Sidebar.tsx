import { useState } from 'react'
import { Search, Plus, Trash2, PanelLeft, ChevronLeft } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import ConfirmDialog from './ConfirmDialog'
import type { Chat } from '../types/chat'
import type { ToolId } from '../App'

const SIDEBAR_EXPANDED_KEY = 'yt-assist-sidebar-expanded'

interface SidebarProps {
  activeTool: ToolId
  onToolSelect: (tool: ToolId) => void
  // Chat sidebar data (only used when activeTool === 'chat')
  chats?: Chat[]
  activeChatId?: string | null
  onSelectChat?: (id: string) => void
  onNewChat?: () => void
  onDeleteChat?: (id: string) => void
}

// Group chats by relative date
function groupChatsByDate(chats: Chat[]) {
  const now = new Date()
  const groups: { label: string; chats: Chat[] }[] = []

  const today: Chat[] = []
  const yesterday: Chat[] = []
  const last7: Chat[] = []
  const older: Chat[] = []

  for (const chat of chats) {
    const date = new Date(chat.updatedAt)
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) today.push(chat)
    else if (diffDays === 1) yesterday.push(chat)
    else if (diffDays < 7) last7.push(chat)
    else older.push(chat)
  }

  if (today.length) groups.push({ label: 'Today', chats: today })
  if (yesterday.length) groups.push({ label: 'Yesterday', chats: yesterday })
  if (last7.length) groups.push({ label: 'Last 7 days', chats: last7 })
  if (older.length) groups.push({ label: 'Older', chats: older })

  return groups
}

export default function Sidebar({
  activeTool,
  onToolSelect,
  chats = [],
  activeChatId = null,
  onSelectChat,
  onNewChat,
  onDeleteChat,
}: SidebarProps) {
  const [expanded, setExpanded] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_EXPANDED_KEY)
    return saved !== null ? JSON.parse(saved) : true
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null)

  const toggleExpanded = () => {
    const next = !expanded
    setExpanded(next)
    localStorage.setItem(SIDEBAR_EXPANDED_KEY, JSON.stringify(next))
  }

  // Non-narrowed reference so comparisons inside conditional JSX branches compile
  const currentTool: string = activeTool
  const isChat = currentTool === 'chat'

  // Filter and sort chats
  const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt)
  const filteredChats = searchQuery
    ? sortedChats.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : sortedChats
  const grouped = groupChatsByDate(filteredChats)

  // ── Collapsed state: just the toggle icon ─────────────────────────────────
  if (!expanded) {
    return (
      <aside className="flex flex-col items-center w-14 h-full bg-sidebar border-r border-sidebar-border">
        <div className="h-12 flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleExpanded}
            className="h-8 w-8"
            aria-label="Expand sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Icon-only nav — always visible so you can switch tools */}
        <nav className="flex flex-col items-center gap-1 py-3 px-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToolSelect('packaging')}
            className={cn('h-9 w-9', currentTool === 'packaging' && 'bg-accent text-accent-foreground')}
            aria-label="Packaging Tool"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 6.75L7.5 2.25l9 0 3.75 4.5M3.75 6.75L5.25 21h13.5l1.5-14.25M3.75 6.75h16.5M8.25 6.75V4.5a.75.75 0 01.75-.75h6a.75.75 0 01.75.75v2.25" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToolSelect('chat')}
            className={cn('h-9 w-9', currentTool === 'chat' && 'bg-accent text-accent-foreground')}
            aria-label="AI Chat"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </Button>
          {isChat && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onNewChat}
              className="h-9 w-9"
              aria-label="New Chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </nav>
      </aside>
    )
  }

  // ── Expanded state ─────────────────────────────────────────────────────────
  return (
    <aside className="flex flex-col w-64 h-full bg-sidebar border-r border-sidebar-border">
      {/* Header row */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-sidebar-border">
        {isChat ? (
          <button
            type="button"
            onClick={() => onToolSelect('packaging')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
            aria-label="Back to tools"
          >
            <ChevronLeft className="h-4 w-4" />
            Chats
          </button>
        ) : (
          <h1 className="text-sm font-semibold text-foreground">YT-Assist</h1>
        )}
        <div className="flex items-center gap-0.5">
          {isChat && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onNewChat}
              className="h-8 w-8"
              aria-label="New Chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleExpanded}
            className="h-8 w-8"
            aria-label="Collapse sidebar"
          >
            <PanelLeft className="h-4 w-4 rotate-180" />
          </Button>
        </div>
      </div>

      {isChat ? (
        /* ── Chat sidebar content ─────────────────────────────────────────── */
        <>
          {/* Search */}
          <div className="px-3 pt-2 pb-1">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your chats..."
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-0"
                aria-label="Search chats"
              />
            </div>
          </div>

          {/* Chat list with date groups */}
          <ScrollArea className="flex-1">
            <div className="px-2 py-1">
              {grouped.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6 px-3">
                  {searchQuery ? 'No chats match your search' : 'No chats yet'}
                </p>
              )}

              {grouped.map((group) => (
                <div key={group.label}>
                  {/* Date group label */}
                  <p className="text-xs font-medium text-foreground/40 px-2 py-1.5 mt-1 first:mt-0">
                    {group.label}
                  </p>

                  {group.chats.map((chat) => {
                    const isActive = chat.id === activeChatId
                    return (
                      <div key={chat.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => onSelectChat?.(chat.id)}
                          className={cn(
                            'w-full text-left px-2 pr-6 py-1.5 rounded-md text-sm truncate transition-colors duration-150',
                            isActive
                              ? 'bg-accent text-foreground'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                          )}
                          aria-label={`Select chat: ${chat.title}`}
                          aria-current={isActive ? 'true' : undefined}
                        >
                          {chat.title}
                        </button>

                        {/* Delete on hover */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteChatId(chat.id)
                          }}
                          className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive z-10"
                          aria-label={`Delete chat: ${chat.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </ScrollArea>
        </>
      ) : (
        /* ── Tool navigation ──────────────────────────────────────────────── */
        <nav className="flex-1 py-3 px-2">
          <button
            type="button"
            onClick={() => onToolSelect('packaging')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors duration-150',
              currentTool === 'packaging'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 6.75L7.5 2.25l9 0 3.75 4.5M3.75 6.75L5.25 21h13.5l1.5-14.25M3.75 6.75h16.5M8.25 6.75V4.5a.75.75 0 01.75-.75h6a.75.75 0 01.75.75v2.25" />
            </svg>
            <div>
              <p className="text-sm font-medium">Packaging</p>
              <p className="text-xs text-muted-foreground">Titles, thumbnails & descriptions</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onToolSelect('chat')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors duration-150',
              currentTool === 'chat'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <div>
              <p className="text-sm font-medium">AI Chat</p>
              <p className="text-xs text-muted-foreground">Chat with Claude or GPT</p>
            </div>
          </button>

          <button
            type="button"
            disabled
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left opacity-40 cursor-not-allowed"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <div>
              <p className="text-sm font-medium">More Tools</p>
              <p className="text-xs text-muted-foreground">Coming soon...</p>
            </div>
          </button>
        </nav>
      )}

      {/* Delete chat confirmation */}
      <ConfirmDialog
        isOpen={deleteChatId !== null}
        title="Delete Chat?"
        message="This will permanently delete this chat and all its messages. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          if (deleteChatId) onDeleteChat?.(deleteChatId)
          setDeleteChatId(null)
        }}
        onCancel={() => setDeleteChatId(null)}
      />
    </aside>
  )
}
