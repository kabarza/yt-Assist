import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, X, Play, Trash2, Download, Copy, Check, Loader2 } from 'lucide-react'
import type { UserInputs } from '../../types/template'
import { cn } from '@/lib/utils'

interface BatchItem {
  id: string
  name: string
  transcript: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  output?: string
  error?: string
}

interface BatchViewProps {
  userInputs: UserInputs
  generatePrompt: (inputs: UserInputs) => string
  onSendToChat?: (prompt: string) => void
}

export default function BatchView({ userInputs, generatePrompt, onSendToChat }: BatchViewProps) {
  const [batchItems, setBatchItems] = useState<BatchItem[]>([])
  const [newItemName, setNewItemName] = useState('')
  const [newItemTranscript, setNewItemTranscript] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const addBatchItem = () => {
    if (!newItemTranscript.trim()) return

    const newItem: BatchItem = {
      id: Date.now().toString(),
      name: newItemName.trim() || `Transcript ${batchItems.length + 1}`,
      transcript: newItemTranscript,
      status: 'pending',
    }

    setBatchItems(prev => [...prev, newItem])
    setNewItemName('')
    setNewItemTranscript('')
    setShowAddForm(false)
  }

  const removeBatchItem = (id: string) => {
    setBatchItems(prev => prev.filter(item => item.id !== id))
    if (selectedId === id) {
      setSelectedId(null)
    }
  }

  const clearAll = () => {
    setBatchItems([])
    setSelectedId(null)
  }

  const processAll = async () => {
    // Process each item sequentially to avoid overwhelming the API
    for (const item of batchItems) {
      if (item.status === 'completed') continue

      setBatchItems(prev =>
        prev.map(i => i.id === item.id ? { ...i, status: 'processing' as const } : i)
      )

      try {
        // Generate the prompt with this item's transcript
        const itemInputs = { ...userInputs, transcript: item.transcript }
        const prompt = generatePrompt(itemInputs)

        // Simulate processing (in real implementation, this would call the AI)
        await new Promise(resolve => setTimeout(resolve, 500))

        setBatchItems(prev =>
          prev.map(i =>
            i.id === item.id
              ? { ...i, status: 'completed' as const, output: prompt }
              : i
          )
        )
      } catch (error) {
        setBatchItems(prev =>
          prev.map(i =>
            i.id === item.id
              ? { ...i, status: 'error' as const, error: String(error) }
              : i
          )
        )
      }
    }
  }

  const exportAll = () => {
    const completed = batchItems.filter(item => item.status === 'completed')
    if (completed.length === 0) return

    const content = completed
      .map(item => {
        return `# ${item.name}\n\n${item.output}\n\n---\n\n`
      })
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

  const selectedItem = batchItems.find(item => item.id === selectedId)
  const pendingCount = batchItems.filter(item => item.status === 'pending').length
  const processingCount = batchItems.filter(item => item.status === 'processing').length
  const completedCount = batchItems.filter(item => item.status === 'completed').length

  return (
    <div className="flex h-full">
      {/* Left Panel - List */}
      <div className="w-80 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">Batch Items</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddForm(!showAddForm)}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {/* Status Summary */}
          <div className="flex gap-2 text-xs">
            <Badge variant="outline">{batchItems.length} Total</Badge>
            {completedCount > 0 && (
              <Badge variant="default">{completedCount} Done</Badge>
            )}
            {processingCount > 0 && (
              <Badge variant="secondary">{processingCount} Processing</Badge>
            )}
          </div>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="p-4 border-b border-border space-y-2 bg-secondary/20">
            <Input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Name (optional)"
              className="h-8"
            />
            <Textarea
              value={newItemTranscript}
              onChange={(e) => setNewItemTranscript(e.target.value)}
              placeholder="Paste transcript..."
              className="h-24 resize-none text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={addBatchItem}
                disabled={!newItemTranscript.trim()}
                className="flex-1"
              >
                Add Item
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowAddForm(false)
                  setNewItemName('')
                  setNewItemTranscript('')
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Batch Actions */}
        {batchItems.length > 0 && (
          <div className="p-3 border-b border-border flex gap-2">
            <Button
              size="sm"
              onClick={processAll}
              disabled={processingCount > 0 || pendingCount === 0}
              className="flex-1 h-8"
            >
              {processingCount > 0 ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Process All
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={exportAll}
              disabled={completedCount === 0}
              className="h-8"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearAll}
              className="h-8"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Items List */}
        <ScrollArea className="flex-1">
          {batchItems.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <p>No batch items yet.</p>
              <p className="mt-1">Click "Add" to start.</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {batchItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg transition-colors group",
                    selectedId === item.id
                      ? "bg-accent"
                      : "hover:bg-accent/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">
                        {item.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {item.transcript.slice(0, 50)}...
                      </div>
                      <div className="mt-1.5">
                        {item.status === 'pending' && (
                          <Badge variant="outline" className="text-xs">Pending</Badge>
                        )}
                        {item.status === 'processing' && (
                          <Badge variant="secondary" className="text-xs">
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Processing
                          </Badge>
                        )}
                        {item.status === 'completed' && (
                          <Badge variant="default" className="text-xs">Completed</Badge>
                        )}
                        {item.status === 'error' && (
                          <Badge variant="destructive" className="text-xs">Error</Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
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

      {/* Right Panel - Detail View */}
      <div className="flex-1 flex flex-col">
        {selectedItem ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{selectedItem.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedItem.transcript.split(/\s+/).length} words
                  </p>
                </div>
                {selectedItem.status === 'completed' && selectedItem.output && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(selectedItem.output!, selectedItem.id)}
                      className="h-8"
                    >
                      {copiedId === selectedItem.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 mr-1.5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 mr-1.5" />
                          Copy
                        </>
                      )}
                    </Button>
                    {onSendToChat && (
                      <Button
                        size="sm"
                        onClick={() => onSendToChat(selectedItem.output!)}
                        className="h-8"
                      >
                        Send to Chat
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 p-4">
              <div className="max-w-3xl space-y-6">
                {/* Transcript */}
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Transcript</h4>
                  <Card className="p-3">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                      {selectedItem.transcript}
                    </p>
                  </Card>
                </div>

                {/* Output */}
                {selectedItem.status === 'completed' && selectedItem.output && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2">Generated Prompt</h4>
                    <Card className="p-3">
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {selectedItem.output}
                      </p>
                    </Card>
                  </div>
                )}

                {/* Error */}
                {selectedItem.status === 'error' && (
                  <div>
                    <h4 className="text-sm font-medium text-destructive mb-2">Error</h4>
                    <Card className="p-3 border-destructive">
                      <p className="text-sm text-destructive">
                        {selectedItem.error || 'An error occurred while processing this item.'}
                      </p>
                    </Card>
                  </div>
                )}

                {/* Processing State */}
                {selectedItem.status === 'processing' && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            {batchItems.length === 0 ? (
              <div className="text-center max-w-md">
                <p className="mb-2">Batch Processing Mode</p>
                <p className="text-xs">
                  Add multiple transcripts to process them all at once with the same template settings.
                  Perfect for comparing multiple videos or analyzing a series of content.
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
