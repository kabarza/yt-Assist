import { useRef, useState, useEffect } from 'react'
import { MessageSquare, History, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useOutputHistory } from '../../stores/outputHistoryStore'

interface OutputViewProps {
  generatedPrompt: string
  onBack: () => void
  onSendToChat?: (prompt: string) => void
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

export default function OutputView({ generatedPrompt, onBack, onSendToChat }: OutputViewProps) {
  const [copied, setCopied] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [currentPrompt, setCurrentPrompt] = useState(generatedPrompt)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const { history, addToHistory, removeFromHistory } = useOutputHistory()

  // Update current prompt when generatedPrompt changes
  useEffect(() => {
    if (generatedPrompt) {
      setCurrentPrompt(generatedPrompt)
      addToHistory(generatedPrompt)
    }
  }, [generatedPrompt, addToHistory])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(currentPrompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      if (textAreaRef.current) {
        textAreaRef.current.focus()
        textAreaRef.current.select()
        try {
          document.execCommand('copy')
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch (err) {
          console.error('Copy failed:', err)
        }
      }
    }
  }

  const selectAllText = () => {
    if (textAreaRef.current) {
      textAreaRef.current.focus()
      textAreaRef.current.select()
    }
  }

  const handleSendToChat = () => {
    if (onSendToChat && currentPrompt) {
      onSendToChat(currentPrompt)
    }
  }

  const handleSelectFromHistory = (prompt: string) => {
    setCurrentPrompt(prompt)
    setShowHistory(false)
  }

  if (!currentPrompt && history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <p className="text-muted-foreground mb-4">No prompt generated yet</p>
        <Button
          onClick={onBack}
          data-flow-name="btn-go-to-inputs"
          variant="secondary"
        >
          Go to Inputs
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Copy this prompt or send it directly to AI Chat
          </p>
          {history.length > 0 && (
            <Button
              variant={showHistory ? "default" : "outline"}
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              data-flow-name="btn-toggle-history"
              className="gap-1 text-xs h-7"
              aria-label="Toggle output history"
              aria-expanded={showHistory}
            >
              <History className="h-3 w-3" />
              History ({history.length})
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={selectAllText}
            data-flow-name="btn-select-all"
          >
            Select All
          </Button>
          <Button
            variant={copied ? "secondary" : "default"}
            onClick={copyToClipboard}
            data-flow-name="btn-copy"
            className={cn(copied && "bg-green-600 hover:bg-green-700")}
          >
            {copied ? 'Copied!' : 'Copy Prompt'}
          </Button>
          {onSendToChat && (
            <Button
              variant="secondary"
              onClick={handleSendToChat}
              data-flow-name="btn-send-to-chat"
              className="gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Send to AI Chat
            </Button>
          )}
        </div>
      </div>

      {/* History Panel */}
      {showHistory && history.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-2">Recent Outputs</p>
          <ScrollArea className="max-h-48">
            <div className="space-y-1">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                  onClick={() => handleSelectFromHistory(item.prompt)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{item.preview}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(item.timestamp)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFromHistory(item.id)
                    }}
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    aria-label="Remove from history"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      <div className="relative">
        <Textarea
          ref={textAreaRef}
          readOnly
          value={currentPrompt}
          data-flow-name="output-textarea"
          className="h-[calc(100vh-380px)] min-h-80 resize-none font-mono text-sm"
        />
      </div>

      <div className="p-4 bg-card border border-border rounded-lg">
        <p className="text-sm text-foreground">
          <span className="font-bold">Next step:</span> Copy the prompt and paste it into an AI chat, or click "Send to AI Chat" to chat directly in this app. The AI will generate your YouTube packaging based on your transcript.
        </p>
      </div>
    </div>
  )
}
