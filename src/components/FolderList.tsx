import { useEffect, useState, type ReactNode } from 'react'
import { Check, ChevronDown, ChevronRight, Folder as FolderIcon, MoreHorizontal, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  SIDEBAR_ACTION_BUTTON_CLASS,
  SIDEBAR_COUNT_CLASS,
  SIDEBAR_FOLDER_BRANCH_CLASS,
  SIDEBAR_FOLDER_ROW_CLASS,
  SIDEBAR_FOLDER_TOGGLE_CLASS,
  SIDEBAR_SECTION_ROW_CLASS,
} from '@/components/navigation/sidebarLayout'
import type { Chat, Folder } from '../types/chat'

interface FolderListProps {
  folders: Folder[]
  chats: Chat[]
  activeChatId?: string | null
  onRenameFolder: (id: string, name: string, systemPrompt?: string) => void
  onDeleteFolder: (id: string) => void
  mode?: 'desktop' | 'mobile'
  renderChatItem: (chat: Chat) => ReactNode
}

interface SectionLabelProps {
  label: string
  tooltip: string
  count: number
}

function SectionLabel({ label, tooltip, count }: SectionLabelProps) {
  return (
    <div className={SIDEBAR_SECTION_ROW_CLASS}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-56">
          {tooltip}
        </TooltipContent>
      </Tooltip>

      <span aria-hidden="true" className="h-[1.625rem] w-[1.625rem]" />
      <span aria-hidden="true" className="h-[1.625rem] w-[1.625rem]" />
      <span className={SIDEBAR_COUNT_CLASS}>{count}</span>
    </div>
  )
}

export default function FolderList({
  folders,
  chats,
  activeChatId,
  onRenameFolder,
  onDeleteFolder,
  mode = 'desktop',
  renderChatItem,
}: FolderListProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingSystemPrompt, setEditingSystemPrompt] = useState('')
  const [editingFolderMode, setEditingFolderMode] = useState<'rename' | 'settings' | null>(null)

  useEffect(() => {
    const activeChat = activeChatId ? chats.find((chat) => chat.id === activeChatId) : null

    if (!activeChat?.folderId) return

    setExpandedFolders((previous) => {
      if (previous.has(activeChat.folderId!)) return previous
      const next = new Set(previous)
      next.add(activeChat.folderId!)
      return next
    })
  }, [activeChatId, chats])

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((previous) => {
      const next = new Set(previous)

      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }

      return next
    })
  }

  const resetEditingState = () => {
    setEditingFolderId(null)
    setEditingName('')
    setEditingSystemPrompt('')
    setEditingFolderMode(null)
  }

  const startEditingFolder = (folder: Folder, mode: 'rename' | 'settings') => {
    setEditingFolderId(folder.id)
    setEditingName(folder.name)
    setEditingSystemPrompt(folder.systemPrompt || '')
    setEditingFolderMode(mode)
    setExpandedFolders((previous) => {
      const next = new Set(previous)
      next.add(folder.id)
      return next
    })
  }

  const handleRenameFolder = (id: string) => {
    const trimmedName = editingName.trim()

    if (!trimmedName) return

    onRenameFolder(id, trimmedName, editingSystemPrompt.trim() || undefined)
    resetEditingState()
    toast.success('Project updated')
  }

  const handleDeleteFolder = (folderId: string) => {
    onDeleteFolder(folderId)
    toast.success('Project deleted')
  }

  const unorganizedChats = chats.filter((chat) => !chat.folderId)
  const sortedFolders = [...folders].sort((a, b) => a.order - b.order)
  const showActions = mode === 'mobile'
  const actionVisibilityClass = showActions
    ? 'opacity-100'
    : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'

  return (
    <div className="min-w-0 space-y-5 overflow-hidden">
      <section className="space-y-2">
        <SectionLabel
          label="Chats"
          tooltip="Standalone conversations."
          count={unorganizedChats.length}
        />

        {unorganizedChats.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">
            No chats yet.
          </p>
        ) : (
          <div className="space-y-0.5 overflow-hidden px-0.5">
            {unorganizedChats.map((chat) => (
              <div key={chat.id}>
                {renderChatItem(chat)}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <SectionLabel
          label="Projects"
          tooltip="Grouped chats with shared context and a project-wide prompt."
          count={sortedFolders.length}
        />

        {sortedFolders.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">
            No projects yet.
          </p>
        ) : (
          sortedFolders.map((folder) => {
            const folderChats = chats.filter((chat) => chat.folderId === folder.id)
            const isExpanded = expandedFolders.has(folder.id)
            const isEditing = editingFolderId === folder.id
            const hasActiveChat = folderChats.some((chat) => chat.id === activeChatId)

            return (
              <div key={folder.id} className="space-y-0.5 overflow-hidden px-0.5">
                {isEditing ? (
                  editingFolderMode === 'rename' ? (
                    <div className="grid grid-cols-[minmax(0,1fr)_1.625rem_1.625rem] items-center gap-x-1 px-1">
                      <Input
                        type="text"
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        placeholder="Project name"
                        className="h-8 rounded-[0.7rem] border-border/55 bg-background/78 text-sm shadow-none"
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') handleRenameFolder(folder.id)
                          if (event.key === 'Escape') resetEditingState()
                        }}
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-[1.625rem] w-[1.625rem] rounded-[0.55rem] text-muted-foreground hover:bg-background/72 hover:text-foreground"
                        onClick={resetEditingState}
                        aria-label={`Cancel rename for ${folder.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-[1.625rem] w-[1.625rem] rounded-[0.55rem] text-muted-foreground hover:bg-background/72 hover:text-foreground"
                        onClick={() => handleRenameFolder(folder.id)}
                        disabled={!editingName.trim()}
                        aria-label={`Save rename for ${folder.name}`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="ml-2 border-l border-border/45 pl-3 pr-1">
                      <Input
                        type="text"
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        placeholder="Project name"
                        className="h-8 rounded-[0.7rem] border-border/55 bg-background/78 text-sm shadow-none"
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') handleRenameFolder(folder.id)
                          if (event.key === 'Escape') resetEditingState()
                        }}
                        autoFocus
                      />

                      <Textarea
                        value={editingSystemPrompt}
                        onChange={(event) => setEditingSystemPrompt(event.target.value)}
                        placeholder="Project-wide prompt or shared context"
                        className="mt-2 min-h-[88px] resize-none rounded-[0.7rem] border-border/55 bg-background/78 text-sm shadow-none"
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') resetEditingState()
                        }}
                      />

                      <div className="mt-3 flex items-center justify-end gap-2">
                        <Button variant="ghost" className="h-8 rounded-[0.7rem] px-3" onClick={resetEditingState}>
                          Cancel
                        </Button>
                        <Button
                          variant="secondary"
                          className="h-8 rounded-[0.7rem] px-3 shadow-none"
                          onClick={() => handleRenameFolder(folder.id)}
                          disabled={!editingName.trim()}
                        >
                          Save project
                        </Button>
                      </div>
                    </div>
                  )
                ) : (
                  <>
                    <div className={SIDEBAR_FOLDER_ROW_CLASS}>
                      <button
                        type="button"
                        onClick={() => toggleFolder(folder.id)}
                        className={cn(
                          SIDEBAR_FOLDER_TOGGLE_CLASS,
                          hasActiveChat
                            ? 'bg-foreground/[0.06] text-foreground'
                            : isExpanded
                              ? 'bg-foreground/[0.03] text-foreground/90'
                              : 'text-foreground/80 hover:bg-foreground/[0.04]',
                        )}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-[11px] w-[11px] shrink-0 text-muted-foreground/85" />
                        ) : (
                          <ChevronRight className="h-[11px] w-[11px] shrink-0 text-muted-foreground/85" />
                        )}

                        <FolderIcon className="h-[13px] w-[13px] shrink-0 text-muted-foreground/95" />

                        <div className="min-w-0 flex items-center gap-2">
                          <span className={cn(
                            'truncate text-[13px] leading-5',
                            hasActiveChat ? 'font-semibold text-foreground' : 'font-medium',
                          )}>
                            {folder.name}
                          </span>
                          {folder.systemPrompt ? (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/35" />
                          ) : null}
                        </div>
                      </button>

                      <span className={SIDEBAR_COUNT_CLASS}>{folderChats.length}</span>

                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          SIDEBAR_ACTION_BUTTON_CLASS,
                          'hover:bg-background/72 hover:text-destructive',
                          actionVisibilityClass,
                        )}
                        onClick={() => handleDeleteFolder(folder.id)}
                        aria-label={`Delete ${folder.name}`}
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
                              'hover:bg-background/72 hover:text-foreground',
                              actionVisibilityClass,
                            )}
                            aria-label={`Project actions for ${folder.name}`}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => startEditingFolder(folder, 'rename')}>
                            Rename project
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => startEditingFolder(folder, 'settings')}>
                            Project settings
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {isExpanded ? (
                      <div className={SIDEBAR_FOLDER_BRANCH_CLASS}>
                        {folder.systemPrompt ? (
                          <div className="mb-1.5 px-1 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/78">
                            Prompt active for this project
                          </div>
                        ) : null}

                        {folderChats.length === 0 ? (
                          <p className="px-1 py-2 text-sm text-muted-foreground">
                            No chats in this project yet.
                          </p>
                        ) : (
                          <div className="space-y-0.5 overflow-hidden">
                            {folderChats.map((chat) => (
                              <div key={chat.id}>
                                {renderChatItem(chat)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            )
          })
        )}
      </section>

    </div>
  )
}
