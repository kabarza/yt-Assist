import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ContentPart, Provider } from '../types/chat'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'
import { X, FileText, Pencil, Globe, Paperclip, ArrowUp, Square, ArrowLeftRight } from 'lucide-react'
import ModelPicker from './ModelPicker'
import TokenCounter from '@/components/TokenCounter'
import { ConversationCost } from '@/components/CostDisplay'
import type { Message } from '../types/chat'
import { useIsMobile } from '../hooks/useMediaQuery'

// ---------------------------------------------------------------------------
// Attachment chip with tiny inline preview + hover popover (portalled)
// ---------------------------------------------------------------------------
function NotesChip({ content, onDetach }: { content: string; onDetach: () => void }) {
  const [hovered, setHovered] = useState(false)
  const chipRef = useRef<HTMLSpanElement>(null)
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})
  const snippet = content.split('\n')[0].slice(0, 28)

  useEffect(() => {
    if (hovered && chipRef.current) {
      const rect = chipRef.current.getBoundingClientRect()
      setPopoverStyle({
        position: 'fixed',
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left,
        width: 256,
        zIndex: 50,
      })
    }
  }, [hovered])

  return (
    <>
      <span
        ref={chipRef}
        className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-foreground"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <FileText className="h-3 w-3 shrink-0" />
        <span className="truncate max-w-[140px]">
          {snippet}{content.length > 28 && '…'}
        </span>
        <button
          type="button"
          onClick={onDetach}
          className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Detach notes from message"
        >
          <X className="h-3 w-3" />
        </button>
      </span>

      {hovered && createPortal(
        <div
          className="max-h-40 overflow-y-auto rounded-xl border border-border/70 bg-popover p-3 shadow-xl"
          style={popoverStyle}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <p className="text-xs text-muted-foreground mb-1 font-medium">Notes preview</p>
          <p className="text-xs text-foreground whitespace-pre-wrap break-words">{content}</p>
        </div>,
        document.body
      )}
    </>
  )
}

function DrawingChip({ snapshot: snapshotUrl, onDetach }: { snapshot: string; onDetach: () => void }) {
  const [hovered, setHovered] = useState(false)
  const chipRef = useRef<HTMLSpanElement>(null)
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})

  useEffect(() => {
    if (hovered && chipRef.current) {
      const rect = chipRef.current.getBoundingClientRect()
      setPopoverStyle({
        position: 'fixed',
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left,
        zIndex: 50,
      })
    }
  }, [hovered])

  return (
    <>
      <span
        ref={chipRef}
        className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-foreground"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Pencil className="h-3 w-3 shrink-0" />
        <img
          src={snapshotUrl}
          alt="Drawing preview"
          className="h-4 w-6 object-contain rounded-sm border border-border bg-card"
          draggable={false}
        />
        <span>Drawing</span>
        <button
          type="button"
          onClick={onDetach}
          className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Detach drawing from message"
        >
          <X className="h-3 w-3" />
        </button>
      </span>

      {hovered && createPortal(
        <div
          className="rounded-xl border border-border/70 bg-popover p-2.5 shadow-xl"
          style={popoverStyle}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <p className="text-xs text-muted-foreground mb-1.5 font-medium px-1">Drawing preview</p>
          <img
            src={snapshotUrl}
            alt="Drawing preview"
            className="max-w-[240px] max-h-[160px] object-contain rounded border border-border bg-card"
            draggable={false}
          />
        </div>,
        document.body
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface ChatInputProps {
  onSend: (content: ContentPart[]) => void
  disabled?: boolean
  isStreaming?: boolean
  onStop?: () => void
  canvasContent?: string
  canvasMode?: 'notes' | 'draw'
  drawingSnapshot?: string | null
  isNotesAttached?: boolean
  isDrawingAttached?: boolean
  onAttachNotes?: () => void
  onAttachDrawing?: () => void
  onOpenCanvas?: () => void
  isWebSearchEnabled?: boolean
  onToggleWebSearch?: () => void
  // Model picker props (forwarded to ModelPicker)
  provider?: Provider
  model?: string
  onProviderChange?: (provider: Provider) => void
  onModelChange?: (model: string) => void
  // Token counter
  messages?: Message[]
  // Comparison mode
  isComparisonMode?: boolean
  onToggleComparisonMode?: () => void
  // Keyboard shortcut support
  onRegisterFocusInput?: (focusFn: () => void) => void
}

interface AttachedImage {
  id: string
  dataUrl: string
  mimeType: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ChatInput({
  onSend,
  disabled,
  isStreaming = false,
  onStop,
  canvasContent = '',
  canvasMode: _canvasMode = 'notes',
  drawingSnapshot = null,
  isNotesAttached = false,
  isDrawingAttached = false,
  onAttachNotes,
  onAttachDrawing,
  onOpenCanvas,
  isWebSearchEnabled = false,
  onToggleWebSearch,
  provider = 'openai',
  model = 'gpt-5.2',
  onProviderChange,
  onModelChange,
  messages = [],
  isComparisonMode = false,
  onToggleComparisonMode,
  onRegisterFocusInput,
}: ChatInputProps) {
  const isMobile = useIsMobile()
  const [text, setText] = useState('')
  const [images, setImages] = useState<AttachedImage[]>([])
  const [notesEmptyHint, setNotesEmptyHint] = useState(false)
  const [drawingEmptyHint, setDrawingEmptyHint] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Image handling ──────────────────────────────────────────────────────
  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setImages((prev) => [
        ...prev,
        { id: Date.now().toString(), dataUrl, mimeType: file.type },
      ])
    }
    reader.readAsDataURL(file)
  }, [])

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) handleImageFile(file)
          return
        }
      }
    },
    [handleImageFile]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      for (const file of e.dataTransfer.files) {
        handleImageFile(file)
      }
    },
    [handleImageFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        for (const file of e.target.files) {
          handleImageFile(file)
        }
      }
      e.target.value = ''
    },
    [handleImageFile]
  )

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id))
  }, [])

  // ── Auto-dismiss empty hints ────────────────────────────────────────────
  useEffect(() => {
    if (notesEmptyHint) {
      const timer = setTimeout(() => setNotesEmptyHint(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [notesEmptyHint])

  useEffect(() => {
    if (drawingEmptyHint) {
      const timer = setTimeout(() => setDrawingEmptyHint(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [drawingEmptyHint])

  // ── Register focus callback for keyboard shortcuts ─────────────────────
  useEffect(() => {
    if (onRegisterFocusInput) {
      onRegisterFocusInput(() => {
        textareaRef.current?.focus()
      })
    }
  }, [onRegisterFocusInput])

  // ── Auto-resize textarea ────────────────────────────────────────────────
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const newHeight = Math.max(56, Math.min(textarea.scrollHeight, 200))
      textarea.style.height = `${newHeight}px`
    }
  }, [])

  useEffect(() => {
    adjustTextareaHeight()
  }, [text, adjustTextareaHeight])

  // ── Send ────────────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const trimmedText = text.trim()
    const hasAttachedCanvasContent =
      (isNotesAttached && canvasContent.trim().length > 0) ||
      (isDrawingAttached && Boolean(drawingSnapshot))
    if (!trimmedText && images.length === 0 && !hasAttachedCanvasContent) return

    const content: ContentPart[] = []

    // Images first
    for (const img of images) {
      content.push({ type: 'image', imageData: img.dataUrl, mimeType: img.mimeType })
    }

    // Text
    if (trimmedText) {
      content.push({ type: 'text', text: trimmedText })
    }

    onSend(content)
    setText('')
    setImages([])

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = '56px'
    }
  }, [text, images, onSend, isNotesAttached, canvasContent, isDrawingAttached, drawingSnapshot])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  // ── Derived flags ───────────────────────────────────────────────────────
  const hasAttachedCanvasContent =
    (isNotesAttached && canvasContent.trim()) ||
    (isDrawingAttached && drawingSnapshot)
  const hasAttachmentChips = hasAttachedCanvasContent
  const canSend = !disabled && (text.trim().length > 0 || images.length > 0 || Boolean(hasAttachedCanvasContent))
  const hasConversationMeta = messages.length > 0

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <TooltipProvider delayDuration={0}>
      <div className="pb-5 pt-1">
        {/* ── Single rounded floating container ─────────────────────────────── */}
        <div
          className="overflow-hidden rounded-[1.45rem] border border-border/70 bg-background/96 shadow-[0_10px_30px_hsl(var(--background)/0.45)] backdrop-blur-sm transition-[border-color,box-shadow] duration-200 focus-within:border-ring/40"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
        {/* ── Attachment chips (notes / drawing) ──────────────────────────── */}
        {hasAttachmentChips && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {isNotesAttached && canvasContent.trim() && (
              <NotesChip content={canvasContent.trim()} onDetach={onAttachNotes!} />
            )}
            {isDrawingAttached && drawingSnapshot && (
              <DrawingChip snapshot={drawingSnapshot} onDetach={onAttachDrawing!} />
            )}
          </div>
        )}

        {/* ── Image thumbnails ─────────────────────────────────────────────── */}
        {images.length > 0 && (
          <div className={cn('flex flex-wrap gap-2 px-4', hasAttachmentChips ? 'pt-2' : 'pt-3')}>
            {images.map((img) => (
              <div key={img.id} className="relative group">
                <div className="relative overflow-hidden rounded-xl border border-border/70 bg-muted/40 ring-1 ring-border/60 transition-[box-shadow,border-color] duration-150 group-hover:border-ring/40">
                  <img src={img.dataUrl} alt="Attached" className="w-20 h-20 object-cover" />
                  <div className="absolute inset-0 bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </div>
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:scale-110"
                  aria-label="Remove attached image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Textarea ─────────────────────────────────────────────────────── */}
        <div className="relative">
          {hasConversationMeta && (
            <div className="absolute right-4 top-3 z-10 flex items-center gap-1.5">
              <TokenCounter messages={messages} modelId={model} compact />
              <ConversationCost messages={messages} modelId={model} compact />
            </div>
          )}

          <label htmlFor="chat-input" className="sr-only">Chat message</label>
          <Textarea
            id="chat-input"
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Ask me anything..."
            disabled={disabled}
            data-flow-name="chat-input"
            className={cn(
              'w-full resize-none border-0 bg-transparent px-4 py-3 text-[15px] leading-6 focus-visible:ring-0',
              hasConversationMeta && 'pr-[14rem] sm:pr-[16rem]'
            )}
            style={{ height: '56px', minHeight: '56px', maxHeight: '200px' }}
            aria-label="Type your message"
          />

          {/* Character count for long messages */}
          {text.length > 500 && (
            <div
              className={cn(
                'absolute right-4 text-xs text-muted-foreground font-mono tabular-nums',
                hasConversationMeta ? 'top-10' : 'top-3'
              )}
            >
              {text.length}
            </div>
          )}
        </div>

        {/* ── Toolbar row ──────────────────────────────────────────────────── */}
        <div className="px-4 pb-3 pt-1">
          <div className="flex w-full flex-wrap items-center gap-2.5">
            {/* Model picker — only render when callbacks are provided */}
            {onProviderChange && onModelChange && (
              <div className="flex shrink-0 items-center">
                <ModelPicker
                  provider={provider}
                  model={model}
                  onProviderChange={onProviderChange}
                  onModelChange={onModelChange}
                />
              </div>
            )}

            {/* Web-search pill */}
            {onToggleWebSearch && (
              <button
                type="button"
                onClick={onToggleWebSearch}
                aria-pressed={isWebSearchEnabled}
                aria-label={isWebSearchEnabled ? 'Web search enabled' : 'Enable web search'}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-[0.85rem] border px-3 text-sm font-medium transition-colors duration-150',
                  isWebSearchEnabled
                    ? 'border-border bg-accent text-foreground'
                    : 'border-border/80 bg-background text-muted-foreground hover:border-ring/30 hover:text-foreground'
                )}
              >
                <Globe className="h-3.5 w-3.5" />
                Search
              </button>
            )}

            {/* Comparison mode pill */}
            {onToggleComparisonMode && (
              <button
                type="button"
                onClick={onToggleComparisonMode}
                aria-pressed={isComparisonMode}
                aria-label={isComparisonMode ? 'Comparison mode enabled' : 'Enable comparison mode'}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-[0.85rem] border px-3 text-sm font-medium transition-colors duration-150',
                  isComparisonMode
                    ? 'border-border bg-accent text-foreground'
                    : 'border-border/80 bg-background text-muted-foreground hover:border-ring/30 hover:text-foreground'
                )}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Compare
              </button>
            )}

            <div className="flex flex-wrap items-center gap-1 sm:ml-auto sm:flex-nowrap">
              {/* Image attach (paperclip) */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                data-flow-name="btn-attach-image"
                className={cn('rounded-[0.85rem]', isMobile ? 'h-11 w-11' : 'h-9 w-9')}
                title="Attach image"
                aria-label="Attach image to message"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                aria-label="File upload input for images"
              />

              {/* Notes attach */}
              {onAttachNotes && (
                <Tooltip open={notesEmptyHint} onOpenChange={setNotesEmptyHint}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        // Priority: if attached, always allow detach
                        if (isNotesAttached) {
                          onAttachNotes()
                        } else if (!canvasContent.trim()) {
                          // Empty: show hint + open canvas
                          setNotesEmptyHint(true)
                          onOpenCanvas?.()
                        } else {
                          // Has content: attach
                          onAttachNotes()
                        }
                      }}
                      data-flow-name="btn-attach-notes"
                      className={cn(
                        'rounded-[0.85rem]',
                        isMobile ? 'h-11 w-11' : 'h-9 w-9',
                        isNotesAttached && 'border border-border/70 bg-accent text-foreground'
                      )}
                      title={canvasContent.trim() ? (isNotesAttached ? 'Detach notes' : 'Attach notes') : 'Open canvas'}
                      aria-label={isNotesAttached ? 'Notes attached to message' : 'Attach notes to message'}
                      aria-pressed={isNotesAttached}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipPrimitive.Portal>
                    <TooltipContent side="top">
                      <p>Notes is empty</p>
                    </TooltipContent>
                  </TooltipPrimitive.Portal>
                </Tooltip>
              )}

              {/* Drawing attach */}
              {onAttachDrawing && (
                <Tooltip open={drawingEmptyHint} onOpenChange={setDrawingEmptyHint}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        // Priority: if attached, always allow detach
                        if (isDrawingAttached) {
                          onAttachDrawing()
                        } else if (!drawingSnapshot) {
                          // Empty: show hint + open canvas
                          setDrawingEmptyHint(true)
                          onOpenCanvas?.()
                        } else {
                          // Has content: attach
                          onAttachDrawing()
                        }
                      }}
                      data-flow-name="btn-attach-drawing"
                      className={cn(
                        'rounded-[0.85rem]',
                        isMobile ? 'h-11 w-11' : 'h-9 w-9',
                        isDrawingAttached && 'border border-border/70 bg-accent text-foreground'
                      )}
                      title={drawingSnapshot ? (isDrawingAttached ? 'Detach drawing' : 'Attach drawing') : 'Open canvas'}
                      aria-label={isDrawingAttached ? 'Drawing attached to message' : 'Attach drawing to message'}
                      aria-pressed={isDrawingAttached}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipPrimitive.Portal>
                    <TooltipContent side="top">
                      <p>Drawing is empty</p>
                    </TooltipContent>
                  </TooltipPrimitive.Portal>
                </Tooltip>
              )}

              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStop}
                  data-flow-name="btn-stop"
                  aria-label="Stop generating"
                  className={cn(
                    'flex items-center justify-center rounded-[0.85rem] bg-foreground text-background transition-opacity duration-150 hover:opacity-85',
                    isMobile ? 'size-11' : 'size-9'
                  )}
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                  data-flow-name="btn-send"
                  aria-label="Send message"
                  className={cn(
                    'flex items-center justify-center rounded-[0.85rem] transition-[opacity,color,background-color] duration-150',
                    isMobile ? 'size-11' : 'size-9',
                    canSend
                      ? 'bg-foreground text-background hover:opacity-85'
                      : 'cursor-not-allowed bg-muted text-muted-foreground'
                  )}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
  )
}
