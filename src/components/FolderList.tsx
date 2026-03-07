import { useState } from 'react'
import { Folder as FolderIcon, ChevronRight, ChevronDown, Plus, Edit2, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Chat, Folder } from '../types/chat'
import ConfirmDialog from './ConfirmDialog'
import { toast } from 'sonner'

interface FolderListProps {
  folders: Folder[]
  chats: Chat[]
  onCreateFolder: (name: string) => void
  onRenameFolder: (id: string, name: string) => void
  onDeleteFolder: (id: string) => void
  onMoveToFolder: (chatId: string, folderId: string | null) => void
  renderChatItem: (chat: Chat) => React.ReactNode
}

export default function FolderList({
  folders,
  chats,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveToFolder,
  renderChatItem,
}: FolderListProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['all']))
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null)
  const [draggedChatId, setDraggedChatId] = useState<string | null>(null)

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return
    onCreateFolder(newFolderName.trim())
    setNewFolderName('')
    setShowNewFolderInput(false)
    toast.success('Folder created')
  }

  const handleRenameFolder = (id: string) => {
    if (!editingName.trim()) return
    onRenameFolder(id, editingName.trim())
    setEditingFolderId(null)
    setEditingName('')
    toast.success('Folder renamed')
  }

  const handleDeleteFolder = () => {
    if (!deleteFolderId) return
    onDeleteFolder(deleteFolderId)
    setDeleteFolderId(null)
    toast.success('Folder deleted')
  }

  const handleDragStart = (chatId: string) => {
    setDraggedChatId(chatId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (folderId: string | null) => {
    if (!draggedChatId) return
    onMoveToFolder(draggedChatId, folderId)
    setDraggedChatId(null)
    toast.success(folderId ? 'Moved to folder' : 'Moved to All Chats')
  }

  // Get chats without folder (All Chats)
  const unorganizedChats = chats.filter(c => !c.folderId)

  // Get sorted folders
  const sortedFolders = [...folders].sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-2">
      {/* New Folder Button */}
      <div className="px-1.5 pb-1">
        {showNewFolderInput ? (
          <div className="flex gap-2">
            <Input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name..."
              className="h-9 rounded-xl text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder()
                if (e.key === 'Escape') {
                  setShowNewFolderInput(false)
                  setNewFolderName('')
                }
              }}
              autoFocus
            />
            <Button
              size="sm"
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
              className="h-9 rounded-xl px-3"
            >
              Add
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNewFolderInput(true)}
            className="h-9 w-full justify-start rounded-xl px-3 text-sm font-medium"
          >
            <Plus className="h-3 w-3 mr-1.5" />
            New Folder
          </Button>
        )}
      </div>

      {/* All Chats (unorganized) */}
      <div>
        <button
          type="button"
          onClick={() => toggleFolder('all')}
          onDragOver={handleDragOver}
          onDrop={() => handleDrop(null)}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-colors",
            "text-foreground/75 hover:bg-muted/50 hover:text-foreground"
          )}
        >
          {expandedFolders.has('all') ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )}
          <FolderIcon className="h-3 w-3 shrink-0" />
          <span className="flex-1 text-left">All Chats</span>
          <span className="text-[12px] text-muted-foreground">({unorganizedChats.length})</span>
        </button>

        {expandedFolders.has('all') && (
          <div className="ml-2 mt-1 space-y-1">
            {unorganizedChats.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-muted-foreground">
                No chats
              </p>
            ) : (
              unorganizedChats.map(chat => (
                <div
                  key={chat.id}
                  draggable
                  onDragStart={() => handleDragStart(chat.id)}
                  className={cn(
                    "cursor-move",
                    draggedChatId === chat.id && "opacity-50"
                  )}
                >
                  {renderChatItem(chat)}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* User Folders */}
      {sortedFolders.map(folder => {
        const folderChats = chats.filter(c => c.folderId === folder.id)
        const isExpanded = expandedFolders.has(folder.id)
        const isEditing = editingFolderId === folder.id

        return (
          <div key={folder.id}>
            <div className="group relative">
              {isEditing ? (
                <div className="flex gap-2 px-1.5">
                  <Input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="h-9 rounded-xl text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameFolder(folder.id)
                      if (e.key === 'Escape') {
                        setEditingFolderId(null)
                        setEditingName('')
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={() => handleRenameFolder(folder.id)}
                    disabled={!editingName.trim()}
                    className="h-9 rounded-xl px-3"
                  >
                    Save
                  </Button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => toggleFolder(folder.id)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(folder.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-colors",
                      "text-foreground/75 hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/70 opacity-0 group-hover:opacity-100" />
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 shrink-0" />
                    )}
                    <FolderIcon className="h-3 w-3 shrink-0" />
                    <span className="flex-1 text-left truncate">{folder.name}</span>
                    <span className="text-[12px] text-muted-foreground">({folderChats.length})</span>
                  </button>

                  {/* Folder actions on hover */}
                  <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingFolderId(folder.id)
                        setEditingName(folder.name)
                      }}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Rename folder"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteFolderId(folder.id)
                      }}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:text-destructive"
                      aria-label="Delete folder"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </>
              )}
            </div>

            {isExpanded && !isEditing && (
              <div className="ml-2 mt-1 space-y-1">
                {folderChats.length === 0 ? (
                  <p className="px-3 py-2.5 text-xs text-muted-foreground">
                    No chats in this folder
                  </p>
                ) : (
                  folderChats.map(chat => (
                    <div
                      key={chat.id}
                      draggable
                      onDragStart={() => handleDragStart(chat.id)}
                      className={cn(
                        "cursor-move",
                        draggedChatId === chat.id && "opacity-50"
                      )}
                    >
                      {renderChatItem(chat)}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Delete Folder Confirmation */}
      <ConfirmDialog
        isOpen={deleteFolderId !== null}
        title="Delete Folder?"
        message="This will delete the folder. All chats in this folder will be moved to 'All Chats'. This action cannot be undone."
        confirmLabel="Delete Folder"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteFolder}
        onCancel={() => setDeleteFolderId(null)}
      />
    </div>
  )
}
