import { useRef, useState, useEffect } from 'react'
import { MessageSquare, History, Trash2, Sparkles, GitCompare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useOutputHistory, type OutputHistoryItem } from '../../stores/outputHistoryStore'
import OutputDiffView from '../../components/OutputDiffView'
import { generateSEOKeywords } from '../../utils/generateSEOKeywords'
import SEOKeywordsSection from '../../components/SEOKeywordsSection'
import ThumbnailPreview from '../../components/ThumbnailPreview'
import type { SEOKeywords } from '../../types/seo'
import { toast } from 'sonner'

interface OutputViewProps {
  generatedPrompt: string
  transcript?: string
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

export default function OutputView({ generatedPrompt, transcript, onBack, onSendToChat }: OutputViewProps) {
  const [copied, setCopied] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [currentPrompt, setCurrentPrompt] = useState(generatedPrompt)
  const [seoKeywords, setSeoKeywords] = useState<SEOKeywords | null>(null)
  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false)
  const [isComparing, setIsComparing] = useState(false)
  const [selectedForComparison, setSelectedForComparison] = useState<OutputHistoryItem[]>([])
  const [showDiffView, setShowDiffView] = useState(false)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const { history, addToHistory, removeFromHistory} = useOutputHistory()

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
      toast.success('Prompt copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      if (textAreaRef.current) {
        textAreaRef.current.focus()
        textAreaRef.current.select()
        try {
          document.execCommand('copy')
          setCopied(true)
          toast.success('Prompt copied to clipboard')
          setTimeout(() => setCopied(false), 2000)
        } catch (err) {
          console.error('Copy failed:', err)
          toast.error('Failed to copy prompt')
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
      toast.success('Prompt sent to AI Chat')
    }
  }

  const handleSelectFromHistory = (prompt: string) => {
    setCurrentPrompt(prompt)
    setShowHistory(false)
  }

  const handleGenerateKeywords = async () => {
    if (!transcript || !transcript.trim()) {
      toast.error('No transcript available for keyword analysis')
      return
    }

    setIsGeneratingKeywords(true)
    try {
      const keywords = await generateSEOKeywords(transcript)
      setSeoKeywords(keywords)
      toast.success('SEO keywords generated successfully')
    } catch (error) {
      console.error('Failed to generate keywords:', error)
      toast.error('Failed to generate SEO keywords')
    } finally {
      setIsGeneratingKeywords(false)
    }
  }

  const handleToggleCompareMode = () => {
    if (isComparing) {
      setIsComparing(false)
      setSelectedForComparison([])
    } else {
      if (history.length < 2) {
        toast.error('Need at least 2 outputs in history to compare')
        return
      }
      setIsComparing(true)
    }
  }

  const handleSelectForComparison = (item: OutputHistoryItem) => {
    if (selectedForComparison.find(i => i.id === item.id)) {
      setSelectedForComparison(prev => prev.filter(i => i.id !== item.id))
    } else {
      if (selectedForComparison.length >= 2) {
        toast.error('Can only compare 2 outputs at a time')
        return
      }
      setSelectedForComparison(prev => [...prev, item])
    }
  }

  const handleStartComparison = () => {
    if (selectedForComparison.length !== 2) {
      toast.error('Please select exactly 2 outputs to compare')
      return
    }
    setShowDiffView(true)
  }

  const handleCloseDiffView = () => {
    setShowDiffView(false)
    setIsComparing(false)
    setSelectedForComparison([])
  }

  // Show diff view if comparing
  if (showDiffView && selectedForComparison.length === 2) {
    return (
      <OutputDiffView
        oldOutput={selectedForComparison[0]}
        newOutput={selectedForComparison[1]}
        onClose={handleCloseDiffView}
      />
    )
  }

  if (!currentPrompt && history.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
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
    <div className="space-y-5 px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Copy this prompt or send it directly to AI Chat
          </p>
          {history.length > 0 && (
            <>
              <Button
                variant={showHistory ? "default" : "outline"}
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                data-flow-name="btn-toggle-history"
                className="h-8 gap-1.5"
                aria-label="Toggle output history"
                aria-expanded={showHistory}
              >
                <History className="h-3 w-3" />
                History ({history.length})
              </Button>
              {history.length >= 2 && (
                <Button
                  variant={isComparing ? "default" : "outline"}
                  size="sm"
                  onClick={handleToggleCompareMode}
                  data-flow-name="btn-toggle-compare"
                  className="h-8 gap-1.5"
                >
                  <GitCompare className="h-3 w-3" />
                  Compare
                </Button>
              )}
            </>
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
        <div className="rounded-[0.9rem] border border-border/70 bg-muted/18 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">
              {isComparing ? `Select 2 outputs to compare (${selectedForComparison.length}/2 selected)` : 'Recent Outputs'}
            </p>
            {isComparing && selectedForComparison.length === 2 && (
              <Button
                variant="default"
                size="sm"
                onClick={handleStartComparison}
                className="h-8"
              >
                Compare Selected
              </Button>
            )}
          </div>
          <ScrollArea className="max-h-48">
            <div className="space-y-1">
              {history.map((item) => {
                const isSelected = selectedForComparison.find(i => i.id === item.id)
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "group flex cursor-pointer items-center gap-2 rounded-xl p-3 transition-colors hover:bg-accent/60",
                      isSelected && "border border-border/70 bg-accent"
                    )}
                    onClick={() => isComparing ? handleSelectForComparison(item) : handleSelectFromHistory(item.prompt)}
                  >
                    {isComparing && (
                      <input
                        type="checkbox"
                        checked={!!isSelected}
                        onChange={() => {}}
                        className="h-4 w-4"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{item.preview}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(item.timestamp)}</p>
                    </div>
                    {!isComparing && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFromHistory(item.id)
                          toast.success('Removed from history')
                        }}
                        className="size-8 opacity-0 text-muted-foreground transition-opacity group-hover:opacity-100 hover:text-destructive"
                        aria-label="Remove from history"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )
              })}
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
          className="h-[calc(100vh-380px)] min-h-80 resize-none border-border/80 p-4 font-mono text-sm leading-6"
        />
      </div>

      <div className="border-t border-border/70 pt-5">
        <p className="text-sm text-foreground">
          <span className="font-bold">Next step:</span> Copy the prompt and paste it into an AI chat, or click "Send to AI Chat" to chat directly in this app. The AI will generate your YouTube packaging based on your transcript.
        </p>
      </div>

      {/* SEO Keywords Section */}
      {transcript && transcript.trim() && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">SEO Keywords</h3>
              <p className="text-sm text-muted-foreground">
                AI-powered keyword suggestions to optimize discoverability
              </p>
            </div>
            {!seoKeywords && (
              <Button
                onClick={handleGenerateKeywords}
                disabled={isGeneratingKeywords}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {isGeneratingKeywords ? 'Generating...' : 'Generate Keywords'}
              </Button>
            )}
          </div>

          {seoKeywords && <SEOKeywordsSection keywords={seoKeywords} />}

          {!seoKeywords && !isGeneratingKeywords && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <Sparkles className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Click "Generate Keywords" to get SEO keyword suggestions
              </p>
              <p className="text-xs text-muted-foreground">
                Helps optimize your content for search and discovery
              </p>
            </div>
          )}
        </div>
      )}

      {/* Thumbnail Text Preview */}
      <ThumbnailPreview thumbnailText={extractThumbnailText(currentPrompt)} />
    </div>
  )
}

// Helper function to extract thumbnail text from the prompt
function extractThumbnailText(prompt: string): string {
  // Look for patterns like "Thumbnail text:", "Thumbnail:", etc.
  const patterns = [
    /thumbnail text[:\s]+([^\n]+)/i,
    /thumbnail[:\s]+([^\n]+)/i,
    /text overlay[:\s]+([^\n]+)/i,
  ]

  for (const pattern of patterns) {
    const match = prompt.match(pattern)
    if (match && match[1]) {
      return match[1].trim().replace(/["""]/g, '')
    }
  }

  // If no pattern found, return empty string
  return ''
}
