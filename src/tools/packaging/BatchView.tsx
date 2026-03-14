import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  X,
  Play,
  Trash2,
  Download,
  Copy,
  Check,
  Loader2,
} from 'lucide-react'
import type { UserInputs } from '@/types/template'
import type { BatchItem } from '@/types/toolSessions'
import { usePackagingSessionStore } from '@/stores/packagingSessionStore'
import { cn } from '@/lib/utils'

interface BatchViewProps {
  userInputs: UserInputs
  generatePrompt: (inputs: UserInputs) => string
  onSendToChat?: (prompt: string) => void
}

export default function BatchView({ userInputs, generatePrompt, onSendToChat }: BatchViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const {
    batchItems,
    newBatchItemName,
    newBatchItemTranscript,
    isBatchAddFormOpen,
    selectedBatchItemId,
    setBatchItems,
    setNewBatchItemName,
    setNewBatchItemTranscript,
    setBatchAddFormOpen,
    setSelectedBatchItemId,
  } = usePackagingSessionStore()

  const addBatchItem = () => {
    if (!newBatchItemTranscript.trim()) return

    const newItem: BatchItem = {
      id: Date.now().toString(),
      name: newBatchItemName.trim() || `Transcript ${batchItems.length + 1}`,
      transcript: newBatchItemTranscript,
      status: 'pending',
    }

    setBatchItems((items) => [...items, newItem])
    setNewBatchItemName('')
    setNewBatchItemTranscript('')
    setBatchAddFormOpen(false)
    setSelectedBatchItemId(newItem.id)
  }

  const removeBatchItem = (id: string) => {
    setBatchItems((items) => items.filter((item) => item.id !== id))
    if (selectedBatchItemId === id) {
      setSelectedBatchItemId(null)
    }
  }

  const clearAll = () => {
    setBatchItems([])
    setSelectedBatchItemId(null)
  }

  const processAll = async () => {
    for (const item of batchItems) {
      if (item.status === 'completed') continue

      setBatchItems((items) =>
        items.map((entry) =>
          entry.id === item.id ? { ...entry, status: 'processing' as const } : entry,
        ),
      )

      try {
        const itemInputs = { ...userInputs, transcript: item.transcript }
        const prompt = generatePrompt(itemInputs)

        await new Promise((resolve) => setTimeout(resolve, 500))

        setBatchItems((items) =>
          items.map((entry) =>
            entry.id === item.id
              ? { ...entry, status: 'completed' as const, output: prompt, error: undefined }
              : entry,
          ),
        )
      } catch (error) {
        setBatchItems((items) =>
          items.map((entry) =>
            entry.id === item.id
              ? { ...entry, status: 'error' as const, error: String(error) }
              : entry,
          ),
        )
      }
    }
  }

  const exportAll = () => {
    const completed = batchItems.filter((item) => item.status === 'completed')
    if (completed.length === 0) return

    const content = completed
      .map((item) => `# ${item.name}\n\n${item.output}\n\n---\n\n`)
      .join('')

    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const date = new Date().toISOString().split('T')[0]
    link.download = `batch-results-${date}.md`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const selectedItem = batchItems.find((item) => item.id === selectedBatchItemId)
  const pendingCount = batchItems.filter((item) => item.status === 'pending').length
  const processingCount = batchItems.filter((item) => item.status === 'processing').length
  const completedCount = batchItems.filter((item) => item.status === 'completed').length

  return (
    <div className="flex h-full">
      <div className="flex w-[18rem] flex-col border-r border-border">
        <div className="border-b border-border px-4 py-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Batch Items</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBatchAddFormOpen(!isBatchAddFormOpen)}
              className="h-8"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </div>

          <div className="flex gap-2 text-xs">
            <Badge variant="outline">{batchItems.length} Total</Badge>
            {completedCount > 0 ? <Badge variant="default">{completedCount} Done</Badge> : null}
            {processingCount > 0 ? <Badge variant="secondary">{processingCount} Processing</Badge> : null}
          </div>
        </div>

        {isBatchAddFormOpen ? (
          <div className="space-y-2 border-b border-border bg-secondary/20 p-4">
            <Input
              type="text"
              value={newBatchItemName}
              onChange={(event) => setNewBatchItemName(event.target.value)}
              placeholder="Name (optional)"
              className="h-8"
            />
            <Textarea
              value={newBatchItemTranscript}
              onChange={(event) => setNewBatchItemTranscript(event.target.value)}
              placeholder="Paste transcript..."
              className="h-24 resize-none text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={addBatchItem}
                disabled={!newBatchItemTranscript.trim()}
                className="flex-1"
              >
                Add Item
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setBatchAddFormOpen(false)
                  setNewBatchItemName('')
                  setNewBatchItemTranscript('')
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {batchItems.length > 0 ? (
          <div className="flex gap-2 border-b border-border px-3 py-2.5">
            <Button
              size="sm"
              onClick={processAll}
              disabled={processingCount > 0 || pendingCount === 0}
              className="h-8 flex-1"
            >
              {processingCount > 0 ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                  Process All
                </>
              )}
            </Button>
            <Button size="sm" variant="outline" onClick={exportAll} disabled={completedCount === 0} className="h-8">
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={clearAll} className="h-8">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null}

        <ScrollArea className="flex-1">
          {batchItems.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <p>No batch items yet.</p>
              <p className="mt-1">Click "Add" to start.</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {batchItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedBatchItemId(item.id)}
                  className={cn(
                    'group w-full rounded-lg p-3 text-left transition-colors',
                    selectedBatchItemId === item.id ? 'bg-accent' : 'hover:bg-accent/50',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{item.name}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.transcript.slice(0, 50)}...
                      </div>
                      <div className="mt-1.5">
                        {item.status === 'pending' ? <Badge variant="outline" className="text-xs">Pending</Badge> : null}
                        {item.status === 'processing' ? (
                          <Badge variant="secondary" className="text-xs">
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            Processing
                          </Badge>
                        ) : null}
                        {item.status === 'completed' ? <Badge variant="default" className="text-xs">Completed</Badge> : null}
                        {item.status === 'error' ? <Badge variant="destructive" className="text-xs">Error</Badge> : null}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation()
                        removeBatchItem(item.id)
                      }}
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex flex-1 flex-col">
        {selectedItem ? (
          <>
            <div className="border-b border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{selectedItem.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedItem.transcript.split(/\s+/).length} words
                  </p>
                </div>
                {selectedItem.status === 'completed' && selectedItem.output ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(selectedItem.output!, selectedItem.id)}
                      className="h-8"
                    >
                      {copiedId === selectedItem.id ? (
                        <>
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1.5 h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </Button>
                    {onSendToChat ? (
                      <Button size="sm" onClick={() => onSendToChat(selectedItem.output!)} className="h-8">
                        Send to Chat
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <ScrollArea className="flex-1 px-5 py-4">
              <div className="space-y-5">
                <div>
                  <h4 className="mb-2 text-sm font-medium text-foreground">Transcript</h4>
                  <Card className="p-3">
                    <p className="whitespace-pre-wrap font-mono text-sm text-muted-foreground">
                      {selectedItem.transcript}
                    </p>
                  </Card>
                </div>

                {selectedItem.status === 'completed' && selectedItem.output ? (
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-foreground">Generated Prompt</h4>
                    <Card className="p-3">
                      <p className="whitespace-pre-wrap text-sm text-foreground">{selectedItem.output}</p>
                    </Card>
                  </div>
                ) : null}

                {selectedItem.status === 'error' ? (
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-destructive">Error</h4>
                    <Card className="border-destructive p-3">
                      <p className="text-sm text-destructive">
                        {selectedItem.error || 'An error occurred while processing this item.'}
                      </p>
                    </Card>
                  </div>
                ) : null}

                {selectedItem.status === 'processing' ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {batchItems.length === 0 ? (
              <div className="max-w-md text-center">
                <p className="mb-2">Batch Processing Mode</p>
                <p className="text-xs">
                  Add multiple transcripts to process them all at once with the same template settings.
                </p>
              </div>
            ) : (
              <p>Select an item to view details</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
