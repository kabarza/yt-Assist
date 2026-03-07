import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface SystemPromptDialogProps {
  isOpen: boolean
  onClose: () => void
  currentSystemPrompt?: string
  onSave: (systemPrompt: string | undefined) => void
}

export default function SystemPromptDialog({
  isOpen,
  onClose,
  currentSystemPrompt,
  onSave,
}: SystemPromptDialogProps) {
  const [value, setValue] = useState(currentSystemPrompt || '')

  useEffect(() => {
    setValue(currentSystemPrompt || '')
  }, [currentSystemPrompt, isOpen])

  const handleSave = () => {
    const trimmed = value.trim()
    onSave(trimmed || undefined)
    onClose()
  }

  const handleClear = () => {
    setValue('')
  }

  const handleUseDefault = () => {
    onSave(undefined)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Custom System Prompt</DialogTitle>
          <DialogDescription>
            Set a custom system prompt for this chat. Leave empty to use the default canvas-aware system prompt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="system-prompt">System Prompt</Label>
            <Textarea
              id="system-prompt"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter a custom system prompt for this chat..."
              className="min-h-[200px] font-mono text-sm"
            />
          </div>

          {currentSystemPrompt && (
            <div className="text-xs text-muted-foreground">
              Current: Custom system prompt is active
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClear}>
            Clear
          </Button>
          {currentSystemPrompt && (
            <Button variant="outline" onClick={handleUseDefault}>
              Use Default
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
