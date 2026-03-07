import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { GitBranch, Save } from 'lucide-react'

interface ForkDialogProps {
  isOpen: boolean
  onClose: () => void
  onSaveAndReplace: () => void
  onFork: () => void
  hasSubsequentMessages: boolean
}

export default function ForkDialog({
  isOpen,
  onClose,
  onSaveAndReplace,
  onFork,
  hasSubsequentMessages,
}: ForkDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Message</DialogTitle>
          <DialogDescription>
            {hasSubsequentMessages
              ? 'This message has responses after it. Choose how to handle your edit:'
              : 'How would you like to save this edit?'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <button
            type="button"
            onClick={() => {
              onSaveAndReplace()
              onClose()
            }}
            className="w-full p-4 rounded-lg border-2 border-border hover:border-accent hover:bg-accent/5 transition-all text-left group"
          >
            <div className="flex items-start gap-3">
              <div className="mt-1 p-2 rounded-lg bg-muted group-hover:bg-accent/10 transition-colors">
                <Save className="h-5 w-5 text-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">Save & Replace</h3>
                <p className="text-sm text-muted-foreground">
                  {hasSubsequentMessages
                    ? 'Update this message and remove all responses after it. The conversation will continue from this edited message.'
                    : 'Update this message in the current conversation.'}
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onFork()
              onClose()
            }}
            className="w-full p-4 rounded-lg border-2 border-border hover:border-accent hover:bg-accent/5 transition-all text-left group"
          >
            <div className="flex items-start gap-3">
              <div className="mt-1 p-2 rounded-lg bg-muted group-hover:bg-accent/10 transition-colors">
                <GitBranch className="h-5 w-5 text-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">Fork Conversation</h3>
                <p className="text-sm text-muted-foreground">
                  Create a new conversation branch with this edit. The original conversation will remain unchanged.
                </p>
              </div>
            </div>
          </button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
