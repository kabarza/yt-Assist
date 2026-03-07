import { Download, FileText, FileJson, File } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { exportChat, type ExportFormat } from '../utils/exportChat'
import type { Chat } from '../types/chat'
import { toast } from 'sonner'

interface ExportMenuProps {
  chat: Chat
  variant?: 'icon' | 'button'
}

export default function ExportMenu({ chat, variant = 'icon' }: ExportMenuProps) {
  const handleExport = (format: ExportFormat) => {
    try {
      exportChat(chat, format)
      toast.success(`Chat exported as ${format.toUpperCase()}`)
    } catch (error) {
      toast.error('Failed to export chat')
      console.error('Export error:', error)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'icon' ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-lg"
            aria-label="Export chat"
          >
            <Download className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            aria-label="Export chat"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => handleExport('markdown')} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4" />
          Export as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('json')} className="gap-2 cursor-pointer">
          <FileJson className="h-4 w-4" />
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('text')} className="gap-2 cursor-pointer">
          <File className="h-4 w-4" />
          Export as Text
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
