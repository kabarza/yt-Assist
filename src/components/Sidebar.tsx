import { useState, useRef, useEffect } from 'react'
import {
  Search,
  Plus,
  Trash2,
  PanelLeft,
  X,
  GitBranch,
  Settings,
  Image as ImageIcon,
  MoreHorizontal,
  File,
  FileJson,
  FileText,
  Folder as FolderIcon,
  Check,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import ConfirmDialog from './ConfirmDialog'
import ThemeToggle from './ThemeToggle'
import FolderList from './FolderList'
import SettingsDialog from './SettingsDialog'
import type { Chat, Folder } from '../types/chat'
import type { ToolId } from '@/types/navigation'
import { toast } from 'sonner'
import { formatShortcut } from '../utils/keyboard'
import { searchChats, type ChatSearchResult } from '../utils/searchChats'
import { useIsMobile } from '../hooks/useMediaQuery'
import { exportChat, type ExportFormat } from '../utils/exportChat'

const SIDEBAR_EXPANDED_KEY = 'yt-assist-sidebar-expanded'

interface SidebarProps {
  activeTool: ToolId
  onToolSelect: (tool: ToolId) => void
  // Chat sidebar data (only used when activeTool === 'chat')
  chats?: Chat[]
  folders?: Folder[]
  activeChatId?: string | null
  onSelectChat?: (id: string) => void
  onNewChat?: () => void
  onDeleteChat?: (id: string) => void
  onRenameFolder?: (id: string, name: string) => void
  onDeleteFolder?: (id: string) => void
  onMoveToFolder?: (chatId: string, folderId: string | null) => void
  expanded?: boolean
  onToggle?: () => void
  onRegisterSearchFocus?: (focusFn: () => void) => void
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

interface ChatNavItemProps {
  chat: Chat
  isActive: boolean
  folders: Folder[]
  snippet?: string
  metadata?: string
  showFolderLabel?: boolean
  onSelect: () => void
  onDelete: () => void
  onMoveToFolder: (folderId: string | null) => void
  onExport: (format: ExportFormat) => void
}

function ChatNavItem({
  chat,
  isActive,
  folders,
  snippet,
  metadata,
  showFolderLabel = false,
  onSelect,
  onDelete,
  onMoveToFolder,
  onExport,
}: ChatNavItemProps) {
  const currentFolder = chat.folderId
    ? folders.find((folder) => folder.id === chat.folderId) ?? null
    : null
  const footer = metadata ?? (showFolderLabel && currentFolder ? `In ${currentFolder.name}` : undefined)

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg border border-transparent transition-colors duration-150',
        isActive
          ? 'border-sidebar-border/80 bg-sidebar-accent text-sidebar-accent-foreground'
          : 'hover:bg-accent/45'
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="block w-full min-w-0 px-2.5 py-2 pr-10 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
        aria-label={`Select chat: ${chat.title}`}
        aria-current={isActive ? 'true' : undefined}
      >
        <div className="flex items-center gap-1.5 text-[13px] font-medium leading-5">
          {chat.forkedFrom && (
            <GitBranch
              className={cn(
                'h-3 w-3 shrink-0',
                isActive ? 'text-sidebar-accent-foreground/70' : 'text-muted-foreground'
              )}
            />
          )}
          <span className="truncate">{chat.title}</span>
        </div>
        {snippet && (
          <div
            className={cn(
              'mt-0.5 truncate text-[11px] leading-4',
              isActive ? 'text-sidebar-accent-foreground/75' : 'text-muted-foreground'
            )}
          >
            {snippet}
          </div>
        )}
        {footer && (
          <div
            className={cn(
              'mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.06em]',
              isActive ? 'text-sidebar-accent-foreground/65' : 'text-muted-foreground/80'
            )}
          >
            {footer}
          </div>
        )}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'absolute right-1 top-1 size-7 rounded-md text-muted-foreground transition-opacity',
              isActive ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100'
            )}
            aria-label={`Chat actions for ${chat.title}`}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Conversation</DropdownMenuLabel>

          {(folders.length > 0 || chat.folderId) && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2 rounded-lg">
                <FolderIcon className="h-4 w-4" />
                Move to
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">
                <DropdownMenuItem onClick={() => onMoveToFolder(null)} className="gap-2">
                  <span className="flex-1">Chats</span>
                  {!chat.folderId && <Check className="h-4 w-4" />}
                </DropdownMenuItem>
                {folders.map((folder) => (
                  <DropdownMenuItem
                    key={folder.id}
                    onClick={() => onMoveToFolder(folder.id)}
                    className="gap-2"
                  >
                    <span className="flex-1 truncate">{folder.name}</span>
                    {chat.folderId === folder.id && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2 rounded-lg">
              <FileText className="h-4 w-4" />
              Export
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52">
              <DropdownMenuItem onClick={() => onExport('markdown')} className="gap-2">
                <FileText className="h-4 w-4" />
                Export as Markdown
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport('json')} className="gap-2">
                <FileJson className="h-4 w-4" />
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport('text')} className="gap-2">
                <File className="h-4 w-4" />
                Export as Text
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete chat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default function Sidebar({
  activeTool,
  onToolSelect,
  chats = [],
  folders = [],
  activeChatId = null,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameFolder,
  onDeleteFolder,
  onMoveToFolder,
  expanded: expandedProp,
  onToggle,
  onRegisterSearchFocus,
}: SidebarProps) {
  const [internalExpanded, setInternalExpanded] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_EXPANDED_KEY)
    return saved !== null ? JSON.parse(saved) : true
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()

  // Use controlled prop if provided, otherwise use internal state
  const expanded = expandedProp !== undefined ? expandedProp : internalExpanded

  // On mobile, auto-close sidebar when selecting a chat
  useEffect(() => {
    if (isMobile && activeChatId && expanded) {
      if (onToggle) {
        onToggle()
      } else {
        setInternalExpanded(false)
      }
    }
  }, [activeChatId, isMobile])

  const toggleExpanded = () => {
    if (onToggle) {
      onToggle()
    } else {
      const next = !internalExpanded
      setInternalExpanded(next)
      localStorage.setItem(SIDEBAR_EXPANDED_KEY, JSON.stringify(next))
    }
  }

  // Register search focus callback for keyboard shortcut (Cmd/Ctrl+F)
  useEffect(() => {
    if (onRegisterSearchFocus) {
      onRegisterSearchFocus(() => {
        searchInputRef.current?.focus()
      })
    }
  }, [onRegisterSearchFocus])

  // Non-narrowed reference so comparisons inside conditional JSX branches compile
  const currentTool: string = activeTool
  const isChat = currentTool === 'chat'

  // Search and filter chats
  const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt)
  const searchResults: ChatSearchResult[] | null = searchQuery
    ? searchChats(sortedChats, searchQuery)
    : null

  // If searching, use search results; otherwise use all chats
  const filteredChats = searchResults
    ? searchResults.map(r => r.chat)
    : sortedChats
  const grouped = groupChatsByDate(filteredChats)

  const handleNewChatClick = () => {
    setSearchQuery('')
    onNewChat?.()
  }

  const handleExportChat = (chat: Chat, format: ExportFormat) => {
    try {
      exportChat(chat, format)
      toast.success(`Chat exported as ${format.toUpperCase()}`)
    } catch (error) {
      toast.error('Failed to export chat')
      console.error('Export error:', error)
    }
  }

  const handleMoveChatToFolder = (chat: Chat, folderId: string | null) => {
    const nextFolderId = folderId ?? undefined
    if (chat.folderId === nextFolderId) return

    onMoveToFolder?.(chat.id, folderId)
    toast.success(folderId ? 'Chat moved to folder' : 'Chat moved to chats')
  }

  // ── Collapsed state: just the toggle icon ─────────────────────────────────
  if (!expanded) {
    return (
      <aside className="flex h-full w-16 flex-col items-center border-r border-sidebar-border/80 bg-sidebar">
        <div className="flex h-14 items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleExpanded}
            className="size-9 rounded-lg"
            aria-label="Expand sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Icon-only nav — always visible so you can switch tools */}
        <nav className="flex flex-1 flex-col items-center gap-2 px-1.5 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToolSelect('packaging')}
            className={cn('size-10 rounded-xl', currentTool === 'packaging' && 'bg-sidebar-accent text-sidebar-accent-foreground')}
            aria-label="Packaging Tool"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 6.75L7.5 2.25l9 0 3.75 4.5M3.75 6.75L5.25 21h13.5l1.5-14.25M3.75 6.75h16.5M8.25 6.75V4.5a.75.75 0 01.75-.75h6a.75.75 0 01.75.75v2.25" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToolSelect('images')}
            className={cn('size-10 rounded-xl', currentTool === 'images' && 'bg-sidebar-accent text-sidebar-accent-foreground')}
            aria-label="Image Gen"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToolSelect('comments')}
            className={cn('size-10 rounded-xl', currentTool === 'comments' && 'bg-sidebar-accent text-sidebar-accent-foreground')}
            aria-label="Comment Replies"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToolSelect('script')}
            className={cn('size-10 rounded-xl', currentTool === 'script' && 'bg-sidebar-accent text-sidebar-accent-foreground')}
            aria-label="Video Script Writer"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToolSelect('chat')}
            className={cn('size-10 rounded-xl', currentTool === 'chat' && 'bg-sidebar-accent text-sidebar-accent-foreground')}
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
              onClick={handleNewChatClick}
              className="size-10 rounded-xl"
              aria-label="New Chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </nav>

        {/* Theme toggle and Settings at bottom */}
        <div className="flex flex-col gap-1.5 border-t border-sidebar-border/80 p-2.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-lg"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <ThemeToggle />
        </div>
      </aside>
    )
  }

  // ── Expanded state ─────────────────────────────────────────────────────────
  return (
    <TooltipProvider delayDuration={300}>
      {/* Mobile overlay backdrop */}
      {isMobile && expanded && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={toggleExpanded}
          aria-label="Close sidebar"
        />
      )}

      <aside className={cn(
        "flex h-full w-[15.25rem] flex-col border-r border-sidebar-border/80 bg-sidebar",
        isMobile && "fixed top-0 left-0 z-50 md:relative"
      )}>
        {/* Header row */}
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border/80 px-3">
          {isChat ? (
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-foreground">AI Chat</h1>
              <p className="text-[11px] text-muted-foreground">Chats and folders</p>
            </div>
          ) : (
            <h1 className="text-sm font-semibold tracking-tight text-foreground">YT-Assist</h1>
          )}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <ThemeToggle />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleExpanded}
                  className="size-8 rounded-lg"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeft className="h-4 w-4 rotate-180" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle Sidebar ({formatShortcut('B')})</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

      {isChat ? (
        /* ── Chat sidebar content ─────────────────────────────────────────── */
        <>
          {/* Primary action */}
          <div className="px-2.5 pb-2 pt-2.5">
            <Button
              onClick={handleNewChatClick}
              className="h-9 w-full justify-start rounded-lg px-3 text-sm font-medium shadow-none"
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              New chat
            </Button>
          </div>

          {/* Search */}
          <div className="px-2.5 pb-1.5">
            <div className="flex h-9 items-center gap-2 rounded-lg border border-border/70 bg-background px-3">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-0"
                aria-label="Search chats and messages"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Chat list - folder view or search results */}
          <ScrollArea className="flex-1">
            <div className="px-2 py-1.5">
              {searchQuery ? (
                /* Search results view */
                <>
                  <div className="px-2 pb-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Search results
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Matches across titles and messages
                    </p>
                  </div>
                  {grouped.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border/70 px-3 py-5 text-center text-sm text-muted-foreground">
                      No chats match your search
                    </p>
                  )}
                  {grouped.map((group) => (
                    <div key={group.label} className="mb-3 last:mb-0">
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {group.label}
                      </p>
                      <div className="space-y-1">
                        {group.chats.map((chat) => {
                          const isActive = chat.id === activeChatId
                          const searchResult = searchResults?.find(r => r.chat.id === chat.id)
                          const messageMatches = searchResult?.matches.filter(m => m.type === 'message') || []
                          const firstSnippet = messageMatches[0]?.snippet
                          const metadata = messageMatches.length > 0
                            ? `${messageMatches.length} message match${messageMatches.length > 1 ? 'es' : ''}`
                            : 'Matched in title'

                          return (
                            <ChatNavItem
                              key={chat.id}
                              chat={chat}
                              isActive={isActive}
                              folders={folders}
                              snippet={firstSnippet}
                              metadata={metadata}
                              onSelect={() => onSelectChat?.(chat.id)}
                              onDelete={() => setDeleteChatId(chat.id)}
                              onMoveToFolder={(folderId) => handleMoveChatToFolder(chat, folderId)}
                              onExport={(format) => handleExportChat(chat, format)}
                            />
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                /* Folder view */
                <FolderList
                  folders={folders}
                  chats={sortedChats}
                  activeChatId={activeChatId}
                  onRenameFolder={(id, name) => onRenameFolder?.(id, name)}
                  onDeleteFolder={onDeleteFolder!}
                  renderChatItem={(chat) => {
                    const isActive = chat.id === activeChatId
                    return (
                      <ChatNavItem
                        chat={chat}
                        isActive={isActive}
                        folders={folders}
                        onSelect={() => onSelectChat?.(chat.id)}
                        onDelete={() => setDeleteChatId(chat.id)}
                        onMoveToFolder={(folderId) => handleMoveChatToFolder(chat, folderId)}
                        onExport={(format) => handleExportChat(chat, format)}
                      />
                    )
                  }}
                />
              )}
            </div>
          </ScrollArea>
        </>
      ) : (
        /* ── Tool navigation ──────────────────────────────────────────────── */
        <nav className="flex-1 px-2.5 py-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onToolSelect('packaging')}
                className={cn(
                'mb-1 flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors duration-150',
                  currentTool === 'packaging'
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
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
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Packaging Tool ({formatShortcut('1')})</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onToolSelect('images')}
                className={cn(
                'mb-1 flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors duration-150',
                  currentTool === 'images'
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                )}
              >
                <ImageIcon className="h-4 w-4 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Image Gen</p>
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Image Generation</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onToolSelect('comments')}
                className={cn(
                'mb-1 flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors duration-150',
                  currentTool === 'comments'
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                )}
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <div>
                  <p className="text-sm font-medium">Comments</p>
                  <p className="text-xs text-muted-foreground">Generate comment replies</p>
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Comment Replies ({formatShortcut('2')})</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onToolSelect('script')}
                className={cn(
                'mb-1 flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors duration-150',
                  currentTool === 'script'
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                )}
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <p className="text-sm font-medium">Script Writer</p>
                  <p className="text-xs text-muted-foreground">Full video scripts with structure</p>
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Video Script Writer ({formatShortcut('3')})</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onToolSelect('chat')}
                className={cn(
                'mb-1 flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors duration-150',
                  currentTool === 'chat'
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
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
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>AI Chat ({formatShortcut('4')})</p>
            </TooltipContent>
          </Tooltip>

          <button
            type="button"
            disabled
            className="mt-2 flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-3.5 py-2.5 text-left opacity-50"
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
          if (deleteChatId) {
            onDeleteChat?.(deleteChatId)
            toast.success('Chat deleted')
          }
          setDeleteChatId(null)
        }}
        onCancel={() => setDeleteChatId(null)}
      />

      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </aside>
    </TooltipProvider>
  )
}
