import type { Message, ContentPart } from '../types/chat'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useCanvasStore } from '../stores/canvasStore'
import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Copy, Check, Globe, RotateCcw, Edit2, X, Send, Pin, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { extractTitle } from '../utils/titleVariants'
import { MessageCost } from '@/components/CostDisplay'
import ForkDialog from '../components/ForkDialog'
import { cn } from '@/lib/utils'

// Parse canvas-update blocks from text
function parseCanvasUpdates(text: string): { beforeText: string; canvasUpdate: string | null; afterText: string } {
  const canvasUpdateRegex = /<canvas-update>([\s\S]*?)<\/canvas-update>/;
  const match = text.match(canvasUpdateRegex);

  if (match) {
    return {
      beforeText: text.substring(0, match.index),
      canvasUpdate: match[1].trim(),
      afterText: text.substring((match.index || 0) + match[0].length),
    };
  }

  return { beforeText: text, canvasUpdate: null, afterText: '' };
}

// Code block with copy button
function CodeBlock({ children, className, ...props }: any) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const extractText = (node: any): string => {
      if (typeof node === 'string') return node;
      if (Array.isArray(node)) return node.map(extractText).join('');
      if (node?.props?.children) return extractText(node.props.children);
      return '';
    };

    navigator.clipboard.writeText(extractText(children));
    setCopied(true);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-4">
      <pre {...props} className={cn(className, 'pr-14')}>{children}</pre>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleCopy}
        className="absolute right-2 top-2 z-10 h-8 w-8 rounded-lg p-0 opacity-0 transition-opacity group-hover:opacity-100"
        aria-label="Copy to clipboard"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

interface ChatMessageProps {
  message: Message
  onRegenerate?: () => void
  onEdit?: (messageId: string, content: ContentPart[]) => void
  onFork?: (messageId: string, content: ContentPart[]) => void
  onTogglePin?: (messageId: string) => void
  onGenerateTitleVariants?: (messageText: string) => void
  hasSubsequentMessages?: boolean
  modelId?: string
}

export default function ChatMessage({ message, onRegenerate, onEdit, onFork, onTogglePin, onGenerateTitleVariants, hasSubsequentMessages = false, modelId }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const { setContent } = useCanvasStore()
  const [appliedUpdates, setAppliedUpdates] = useState<Set<number>>(new Set())
  const [isHovered, setIsHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [showForkDialog, setShowForkDialog] = useState(false)

  // ── User message: right-aligned content-width bubble ──────────────────────
  if (isUser) {
    // Get the text content for editing
    const textContent = message.content.find(p => p.type === 'text')?.text || ''

    const handleEditStart = () => {
      setEditText(textContent)
      setIsEditing(true)
    }

    const handleEditCancel = () => {
      setIsEditing(false)
      setEditText('')
      setShowForkDialog(false)
    }

    const handleEditSave = () => {
      if (!editText.trim()) return

      // If there are subsequent messages and fork is available, show dialog
      if (hasSubsequentMessages && onFork && onEdit) {
        setShowForkDialog(true)
      } else if (onEdit) {
        // No subsequent messages or fork not available, just save
        onEdit(message.id, [{ type: 'text', text: editText }])
        setIsEditing(false)
        setEditText('')
      }
    }

    const handleSaveAndReplace = () => {
      if (!onEdit || !editText.trim()) return
      onEdit(message.id, [{ type: 'text', text: editText }])
      setIsEditing(false)
      setEditText('')
      setShowForkDialog(false)
    }

    const handleFork = () => {
      if (!onFork || !editText.trim()) return
      onFork(message.id, [{ type: 'text', text: editText }])
      setIsEditing(false)
      setEditText('')
      setShowForkDialog(false)
    }

    return (
      <div
        className="flex justify-end group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="max-w-[75%] space-y-2.5">
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="min-h-[80px] text-sm"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEditCancel}
                  className="h-8"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleEditSave}
                  disabled={!editText.trim()}
                  className="h-8"
                >
                  <Send className="h-4 w-4 mr-1" />
                  Save & Resend
                </Button>
              </div>
            </div>
          ) : (
            <>
              {message.content.map((part, i) => {
                if (part.type === 'image' && part.imageData) {
                  return (
                    <div key={i} className="flex justify-end">
                      <img
                        src={part.imageData}
                        alt="User uploaded image"
                        className="max-w-xs max-h-48 rounded-lg border border-border"
                      />
                    </div>
                  )
                }
                if (part.type === 'text' && part.text) {
                  return (
                    <div
                      key={i}
                      className="inline-block rounded-[1.35rem] bg-foreground/[0.07] px-4 py-3 text-sm leading-6 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.55)]"
                    >
                      {part.text}
                    </div>
                  )
                }
                return null
              })}
              {(onEdit || onTogglePin) && isHovered && (
                <div className="flex justify-end gap-1">
                  {onTogglePin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onTogglePin(message.id)
                        toast.success(message.isPinned ? 'Message unpinned' : 'Message pinned')
                      }}
                      className="h-7 px-2 text-muted-foreground hover:text-foreground"
                      aria-label={message.isPinned ? "Unpin message" : "Pin message"}
                    >
                      <Pin className={`h-3 w-3 mr-1 ${message.isPinned ? 'fill-current' : ''}`} />
                      {message.isPinned ? 'Unpin' : 'Pin'}
                    </Button>
                  )}
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleEditStart}
                      className="h-7 px-2 text-muted-foreground hover:text-foreground"
                      aria-label="Edit message"
                    >
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

      {/* Fork Dialog */}
      <ForkDialog
          isOpen={showForkDialog}
          onClose={() => setShowForkDialog(false)}
          onSaveAndReplace={handleSaveAndReplace}
          onFork={handleFork}
          hasSubsequentMessages={hasSubsequentMessages}
        />
      </div>
    )
  }

  // ── Assistant message: left-aligned, no bubble ────────────────────────────
  return (
    <div
      className="group space-y-4 py-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {message.content.map((part, i) => {
        if (part.type === 'image' && part.imageData) {
          return (
            <img
              key={i}
              src={part.imageData}
              alt="Assistant generated image"
              className="max-w-md max-h-64 rounded-lg border border-border"
            />
          )
        }
        if (part.type === 'text' && part.text) {
          const { beforeText, canvasUpdate, afterText } = parseCanvasUpdates(part.text);

          return (
            <div key={i} className="space-y-3">
              {beforeText && (
                <div className="prose prose-neutral dark:prose-invert max-w-none text-pretty text-sm text-foreground prose-headings:my-4 prose-li:my-0 prose-ol:my-3 prose-p:my-2 prose-pre:my-4 prose-table:my-4 prose-ul:my-3">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlock }}>
                    {beforeText}
                  </ReactMarkdown>
                </div>
              )}

              {canvasUpdate && (
                <Card className="border-border/70 bg-muted/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Canvas Update</span>
                    <Button
                      variant={appliedUpdates.has(i) ? "secondary" : "default"}
                      size="sm"
                      onClick={() => {
                        setContent(canvasUpdate);
                        setAppliedUpdates(prev => new Set(prev).add(i));
                        setTimeout(() => {
                          setAppliedUpdates(prev => {
                            const next = new Set(prev);
                            next.delete(i);
                            return next;
                          });
                        }, 2000);
                      }}
                      aria-label="Apply canvas update to editor"
                    >
                      {appliedUpdates.has(i) ? 'Applied!' : 'Apply to Canvas'}
                    </Button>
                  </div>
                  <Card className="bg-background/70 p-3">
                    <div className="prose prose-neutral dark:prose-invert max-w-none text-sm text-foreground">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {canvasUpdate}
                      </ReactMarkdown>
                    </div>
                  </Card>
                </Card>
              )}

              {afterText && (
                <div className="prose prose-neutral dark:prose-invert max-w-none text-pretty text-sm text-foreground prose-headings:my-4 prose-li:my-0 prose-ol:my-3 prose-p:my-2 prose-pre:my-4 prose-table:my-4 prose-ul:my-3">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlock }}>
                    {afterText}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )
        }
        return null
      })}

      {/* Action buttons */}
      {isHovered && (onRegenerate || onGenerateTitleVariants || onTogglePin) && (
        <div className="flex gap-2 pt-1">
          {onTogglePin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onTogglePin(message.id)
                toast.success(message.isPinned ? 'Message unpinned' : 'Message pinned')
              }}
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
              aria-label={message.isPinned ? "Unpin message" : "Pin message"}
            >
              <Pin className={`h-3.5 w-3.5 mr-1.5 ${message.isPinned ? 'fill-current' : ''}`} />
              {message.isPinned ? 'Unpin' : 'Pin'}
            </Button>
          )}
          {onRegenerate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerate}
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
              aria-label="Regenerate response"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Regenerate
            </Button>
          )}
          {onGenerateTitleVariants && (() => {
            const messageText = message.content.find(p => p.type === 'text')?.text || ''
            const hasTitle = extractTitle(messageText)
            return hasTitle ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onGenerateTitleVariants(messageText)}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                aria-label="Generate title variants"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Generate Title Variants
              </Button>
            ) : null
          })()}

          {/* Cost display */}
          {modelId && isHovered && (
            <div className="ml-auto">
              <MessageCost message={message} modelId={modelId} />
            </div>
          )}
        </div>
      )}

      {/* Citations */}
      {message.citations?.length ? (
        <div className="border-t border-border/70 pt-4">
          <div className="mb-2 flex items-center gap-1.5">
            <Globe className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Sources</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {message.citations.map((citation, i) => (
              <a
                key={i}
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground"
              >
                <span className="text-foreground/70 font-mono">[{i + 1}]</span>
                <span className="truncate max-w-[160px]">{citation.title}</span>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
