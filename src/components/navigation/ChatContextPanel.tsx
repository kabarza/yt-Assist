import { useEffect, useRef, useState } from 'react'
import {
  Check,
  File,
  FileJson,
  FileText,
  Folder as FolderIcon,
  FolderPlus,
  GitBranch,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  SIDEBAR_ACTION_BUTTON_CLASS,
  SIDEBAR_CHAT_ROW_CLASS,
} from '@/components/navigation/sidebarLayout'
import FolderList from '@/components/FolderList'
import { exportChat, type ExportFormat } from '@/utils/exportChat'
import { searchChats, type ChatSearchResult } from '@/utils/searchChats'
import type { Chat, Folder } from '@/types/chat'

function groupChatsByDate(chats: Chat[]) {
  const now = new Date()
  const groups: Array<{ label: string; chats: Chat[] }> = []

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
  isEditing: boolean
  draftTitle: string
  folders: Folder[]
  snippet?: string
  metadata?: string
  showActions: boolean
  onSelect: () => void
  onDelete: () => void
  onStartRename: () => void
  onDraftTitleChange: (value: string) => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  onMoveToFolder: (folderId: string | null) => void
  onExport: (format: ExportFormat) => void
}

function ChatNavItem({
  chat,
  isActive,
  isEditing,
  draftTitle,
  folders,
  snippet,
  metadata,
  showActions,
  onSelect,
  onDelete,
  onStartRename,
  onDraftTitleChange,
  onRenameCommit,
  onRenameCancel,
  onMoveToFolder,
  onExport,
}: ChatNavItemProps) {
  const actionVisibilityClass = showActions
    ? 'opacity-100'
    : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'

  return (
    <div
      className={cn(
        SIDEBAR_CHAT_ROW_CLASS,
        isActive
          ? 'bg-foreground/[0.06] text-foreground'
          : 'bg-transparent text-foreground/80 hover:bg-foreground/[0.04]',
      )}
    >
      {isEditing ? (
        <>
          <div className="min-w-0 -ml-0.5 py-1.5 pl-0.5">
            <Input
              type="text"
              value={draftTitle}
              onChange={(event) => onDraftTitleChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onRenameCommit()
                if (event.key === 'Escape') onRenameCancel()
              }}
              className="h-8 rounded-[0.7rem] border-border/55 bg-background/82 text-sm shadow-none"
              autoFocus
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-[1.625rem] w-[1.625rem] self-center rounded-[0.55rem] text-muted-foreground hover:bg-background/72 hover:text-foreground"
            onClick={onRenameCancel}
            aria-label={`Cancel rename for ${chat.title}`}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-[1.625rem] w-[1.625rem] self-center rounded-[0.55rem] text-muted-foreground hover:bg-background/72 hover:text-foreground"
            onClick={onRenameCommit}
            aria-label={`Save rename for ${chat.title}`}
            disabled={!draftTitle.trim()}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onSelect}
            className="-ml-0.5 block min-w-0 max-w-full py-2.5 pl-0.5 pr-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
            aria-label={`Select chat: ${chat.title}`}
            aria-current={isActive ? 'true' : undefined}
          >
            <div className="flex min-w-0 items-center gap-1.5 text-[13px] leading-5">
              {chat.forkedFrom ? (
                <GitBranch
                  className={cn(
                    'h-3 w-3 shrink-0',
                    isActive ? 'text-foreground/58' : 'text-muted-foreground/95',
                  )}
                />
              ) : null}
              <span className={cn('truncate', isActive ? 'font-semibold text-foreground' : 'font-medium')}>
                {chat.title}
              </span>
            </div>

            {snippet ? (
              <div
                className={cn(
                  'mt-0.5 truncate text-[11px] leading-4',
                  isActive ? 'text-foreground/62' : 'text-muted-foreground',
                )}
              >
                {snippet}
              </div>
            ) : null}

            {metadata ? (
              <div
                className={cn(
                  'mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.08em]',
                  isActive ? 'text-foreground/50' : 'text-muted-foreground/80',
                )}
              >
                {metadata}
              </div>
            ) : null}
          </button>

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              SIDEBAR_ACTION_BUTTON_CLASS,
              'self-center text-muted-foreground hover:bg-background/72 hover:text-destructive',
              actionVisibilityClass,
            )}
            onClick={onDelete}
            aria-label={`Delete ${chat.title}`}
          >
            <Trash2 className="h-[0.8125rem] w-[0.8125rem]" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  SIDEBAR_ACTION_BUTTON_CLASS,
                  'self-center text-muted-foreground hover:bg-background/72 hover:text-foreground',
                  actionVisibilityClass,
                )}
                aria-label={`Chat actions for ${chat.title}`}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Chat</DropdownMenuLabel>
              <DropdownMenuItem onClick={onStartRename}>Rename chat</DropdownMenuItem>

              {(folders.length > 0 || chat.folderId) ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2 rounded-lg">
                    <FolderIcon className="h-4 w-4" />
                    Move to project
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52">
                    <DropdownMenuItem onClick={() => onMoveToFolder(null)} className="gap-2">
                      <span className="flex-1">Chats</span>
                      {!chat.folderId ? <Check className="h-4 w-4" /> : null}
                    </DropdownMenuItem>
                    {folders.map((folder) => (
                      <DropdownMenuItem
                        key={folder.id}
                        onClick={() => onMoveToFolder(folder.id)}
                        className="gap-2"
                      >
                        <span className="flex-1 truncate">{folder.name}</span>
                        {chat.folderId === folder.id ? <Check className="h-4 w-4" /> : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : null}

              <DropdownMenuSeparator />
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
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  )
}

interface ChatContextPanelProps {
  chats: Chat[]
  folders: Folder[]
  activeChatId: string | null
  onSelectChat: (chatId: string) => void
  onNewChat: () => void
  onDeleteChat: (chatId: string) => void
  onRenameChat: (chatId: string, title: string) => void
  onCreateFolder: (name: string, systemPrompt?: string) => string | void
  onRenameFolder: (folderId: string, name: string, systemPrompt?: string) => void
  onDeleteFolder: (folderId: string) => void
  onMoveToFolder: (chatId: string, folderId: string | null) => void
  onRegisterSearchFocus?: (focusFn: (() => void) | null) => void
  className?: string
  mode?: 'desktop' | 'mobile'
}

export function ChatContextPanel({
  chats,
  folders,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveToFolder,
  onRegisterSearchFocus,
  className,
  mode = 'desktop',
}: ChatContextPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectPrompt, setNewProjectPrompt] = useState('')
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingChatTitle, setEditingChatTitle] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const projectNameInputRef = useRef<HTMLInputElement>(null)
  const projectComposerRef = useRef<HTMLDivElement>(null)
  const projectTriggerRef = useRef<HTMLButtonElement>(null)
  const shouldFocusSearchRef = useRef(false)

  useEffect(() => {
    onRegisterSearchFocus?.(() => {
      if (isSearchExpanded) {
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }

      shouldFocusSearchRef.current = true
      setIsCreatingProject(false)
      setIsSearchExpanded(true)
    })

    return () => {
      onRegisterSearchFocus?.(null)
    }
  }, [isSearchExpanded, onRegisterSearchFocus])

  useEffect(() => {
    if (!isSearchExpanded || !shouldFocusSearchRef.current) return

    const frameId = requestAnimationFrame(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
      shouldFocusSearchRef.current = false
    })

    return () => cancelAnimationFrame(frameId)
  }, [isSearchExpanded])

  useEffect(() => {
    if (!isCreatingProject) return

    const frameId = requestAnimationFrame(() => {
      projectNameInputRef.current?.focus()
    })

    return () => cancelAnimationFrame(frameId)
  }, [isCreatingProject])

  useEffect(() => {
    if (!isCreatingProject) return

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (!target) return

      if (
        projectComposerRef.current?.contains(target) ||
        projectTriggerRef.current?.contains(target)
      ) {
        return
      }

      setIsCreatingProject(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [isCreatingProject])

  const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt)
  const searchResults: ChatSearchResult[] | null = searchQuery
    ? searchChats(sortedChats, searchQuery)
    : null
  const filteredChats = searchResults ? searchResults.map((result) => result.chat) : sortedChats
  const grouped = groupChatsByDate(filteredChats)
  const showActions = mode === 'mobile'

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

    onMoveToFolder(chat.id, folderId)
    toast.success(folderId ? 'Chat moved to project' : 'Chat moved to chats')
  }

  const startEditingChat = (chat: Chat) => {
    setEditingChatId(chat.id)
    setEditingChatTitle(chat.title)
  }

  const cancelEditingChat = () => {
    setEditingChatId(null)
    setEditingChatTitle('')
  }

  const commitEditingChat = () => {
    const trimmedTitle = editingChatTitle.trim()
    if (!editingChatId || !trimmedTitle) return

    onRenameChat(editingChatId, trimmedTitle)
    toast.success('Chat renamed')
    cancelEditingChat()
  }

  const handleDeleteChat = (chatId: string) => {
    onDeleteChat(chatId)
    if (editingChatId === chatId) {
      cancelEditingChat()
    }
    toast.success('Chat deleted')
  }

  const closeProjectComposer = () => {
    setIsCreatingProject(false)
    setNewProjectName('')
    setNewProjectPrompt('')
  }

  const handleCreateProject = () => {
    const trimmedName = newProjectName.trim()

    if (!trimmedName) return

    onCreateFolder(trimmedName, newProjectPrompt.trim() || undefined)
    closeProjectComposer()
    toast.success('Project created')
  }

  const openSearch = () => {
    setIsCreatingProject(false)

    if (isSearchExpanded) {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
      return
    }

    shouldFocusSearchRef.current = true
    setIsSearchExpanded(true)
  }

  const closeSearch = () => {
    searchInputRef.current?.blur()
    setSearchQuery('')
    setIsSearchExpanded(false)
    shouldFocusSearchRef.current = false
  }

  const toggleProjectComposer = () => {
    if (isCreatingProject) {
      setIsCreatingProject(false)
      return
    }

    closeSearch()
    setIsCreatingProject(true)
  }

  return (
    <TooltipProvider delayDuration={120}>
      <div className={cn('flex h-full min-h-0 flex-col overflow-hidden bg-sidebar', className)}>
        <div className="relative z-20 border-b border-border/55 px-3 py-2.5">
          <div className="relative">
            <div className="relative h-9">
              <div
                className={cn(
                  'absolute inset-0 flex items-center gap-2 transition-[opacity,transform,filter] duration-150 ease-out',
                  isSearchExpanded
                    ? 'pointer-events-none -translate-x-2 opacity-0 blur-[1px]'
                    : 'translate-y-0 scale-100 opacity-100',
                )}
                aria-hidden={isSearchExpanded}
              >
                <Button
                  variant="ghost"
                  onClick={onNewChat}
                  tabIndex={isSearchExpanded ? -1 : 0}
                  className="h-9 flex-1 justify-start rounded-[0.95rem] bg-foreground/[0.045] px-2.75 text-[12.5px] font-medium text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.45)] transition-[background-color,box-shadow] duration-150 hover:bg-foreground/[0.07]"
                >
                  <Plus className="mr-2 h-3.5 w-3.5 text-foreground/65" />
                  New chat
                </Button>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      ref={projectTriggerRef}
                      type="button"
                      onClick={toggleProjectComposer}
                      tabIndex={isSearchExpanded ? -1 : 0}
                      aria-label="Create new project"
                      aria-expanded={isCreatingProject}
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.95rem] bg-foreground/[0.045] text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.45)] transition-[background-color,color,box-shadow] duration-150 hover:bg-foreground/[0.07] hover:text-foreground',
                        isCreatingProject && 'bg-background/84 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.58)]',
                      )}
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="rounded-lg px-2.5 py-1.5 text-xs">
                    New project
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={openSearch}
                      tabIndex={isSearchExpanded ? -1 : 0}
                      aria-label="Search chats"
                      aria-expanded={isSearchExpanded}
                      className="h-9 w-9 rounded-[0.95rem] bg-foreground/[0.045] text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.45)] transition-[background-color,color,transform] duration-150 hover:bg-foreground/[0.07] hover:text-foreground"
                    >
                      <Search className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="rounded-lg px-2.5 py-1.5 text-xs">
                    Search chats
                  </TooltipContent>
                </Tooltip>
              </div>

              <div
                className={cn(
                  'absolute inset-y-0 right-0 flex justify-end overflow-hidden transition-[width,opacity,transform] duration-150 ease-out',
                  isSearchExpanded
                    ? 'w-full translate-x-0 opacity-100'
                    : 'pointer-events-none w-9 translate-x-0 opacity-0',
                )}
                aria-hidden={!isSearchExpanded}
              >
                <div className="flex h-9 w-full items-center gap-2 rounded-[0.95rem] bg-background/88 px-3 shadow-[0_14px_34px_-22px_hsl(var(--foreground)/0.55),inset_0_0_0_1px_hsl(var(--border)/0.58)] backdrop-blur-sm">
                  <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        if (searchQuery) {
                          setSearchQuery('')
                        } else {
                          closeSearch()
                        }
                      }
                    }}
                    tabIndex={isSearchExpanded ? 0 : -1}
                    placeholder="Search chats"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                    aria-label="Search chats and messages"
                  />
                  <button
                    type="button"
                    onClick={closeSearch}
                    tabIndex={isSearchExpanded ? 0 : -1}
                    className="rounded-[0.65rem] p-1.25 text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                    aria-label="Close search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 top-full pt-2">
              <div
                ref={projectComposerRef}
                className={cn(
                  'pointer-events-auto origin-top-right rounded-[1.15rem] border border-border/65 bg-background/95 p-3 shadow-[0_26px_48px_-24px_hsl(var(--foreground)/0.55)] backdrop-blur-sm transition-[opacity,transform] duration-150 ease-out',
                  isCreatingProject
                    ? 'translate-y-0 scale-100 opacity-100'
                    : 'pointer-events-none -translate-y-1 scale-[0.985] opacity-0',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      New project
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Group chats with shared context and instructions.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeProjectComposer}
                    className="rounded-[0.7rem] p-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                    aria-label="Close project form"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-3 space-y-2.5">
                  <Input
                    ref={projectNameInputRef}
                    type="text"
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                    placeholder="Project name"
                    className="h-9 rounded-[0.8rem] border-border/55 bg-background/80 text-sm shadow-none"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleCreateProject()
                      if (event.key === 'Escape') closeProjectComposer()
                    }}
                  />

                  <Textarea
                    value={newProjectPrompt}
                    onChange={(event) => setNewProjectPrompt(event.target.value)}
                    placeholder="Project-wide prompt or shared context"
                    className="min-h-[104px] resize-none rounded-[0.8rem] border-border/55 bg-background/80 text-sm shadow-none"
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') closeProjectComposer()
                    }}
                  />

                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" className="h-8 rounded-[0.7rem] px-3" onClick={closeProjectComposer}>
                      Cancel
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-8 rounded-[0.7rem] px-3 shadow-none"
                      onClick={handleCreateProject}
                      disabled={!newProjectName.trim()}
                    >
                      Create project
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="w-full min-w-0 overflow-hidden px-3 py-3">
            {searchQuery ? (
              <>
                <div className="px-1 pb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Search results
                  </p>
                </div>

                {grouped.length === 0 ? (
                  <p className="px-2 py-5 text-center text-sm text-muted-foreground">
                    No chats match your search.
                  </p>
                ) : null}

                {grouped.map((group) => (
                  <div key={group.label} className="mb-4 last:mb-0">
                    <p className="px-1 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {group.label}
                    </p>
                    <div className="space-y-1 px-0.5">
                      {group.chats.map((chat) => {
                        const isActive = chat.id === activeChatId
                        const searchResult = searchResults?.find((result) => result.chat.id === chat.id)
                        const messageMatches = searchResult?.matches.filter((match) => match.type === 'message') ?? []
                        const firstSnippet = messageMatches[0]?.snippet
                        const metadata =
                          messageMatches.length > 0
                            ? `${messageMatches.length} message match${messageMatches.length > 1 ? 'es' : ''}`
                            : 'Matched in title'

                        return (
                          <ChatNavItem
                            key={chat.id}
                            chat={chat}
                            isActive={isActive}
                            isEditing={editingChatId === chat.id}
                            draftTitle={editingChatId === chat.id ? editingChatTitle : chat.title}
                            folders={folders}
                            snippet={firstSnippet}
                            metadata={metadata}
                            showActions={showActions}
                            onSelect={() => onSelectChat(chat.id)}
                            onDelete={() => handleDeleteChat(chat.id)}
                            onStartRename={() => startEditingChat(chat)}
                            onDraftTitleChange={setEditingChatTitle}
                            onRenameCommit={commitEditingChat}
                            onRenameCancel={cancelEditingChat}
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
              <FolderList
                folders={folders}
                chats={sortedChats}
                activeChatId={activeChatId}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
                mode={mode}
                renderChatItem={(chat) => {
                  const isActive = chat.id === activeChatId

                  return (
                    <ChatNavItem
                      chat={chat}
                      isActive={isActive}
                      isEditing={editingChatId === chat.id}
                      draftTitle={editingChatId === chat.id ? editingChatTitle : chat.title}
                      folders={folders}
                      metadata={mode === 'mobile' && chat.folderId ? 'In project' : undefined}
                      showActions={showActions}
                      onSelect={() => onSelectChat(chat.id)}
                      onDelete={() => handleDeleteChat(chat.id)}
                      onStartRename={() => startEditingChat(chat)}
                      onDraftTitleChange={setEditingChatTitle}
                      onRenameCommit={commitEditingChat}
                      onRenameCancel={cancelEditingChat}
                      onMoveToFolder={(folderId) => handleMoveChatToFolder(chat, folderId)}
                      onExport={(format) => handleExportChat(chat, format)}
                    />
                  )
                }}
              />
            )}
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  )
}
