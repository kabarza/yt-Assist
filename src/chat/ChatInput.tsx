import { useState, useRef, useCallback, useEffect } from 'react'
import type { ContentPart } from '../types/chat'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Send, Image as ImageIcon, X, FileText, Pencil, Globe } from 'lucide-react'

interface ChatInputProps {
  onSend: (content: ContentPart[]) => void
  disabled?: boolean
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
}

interface AttachedImage {
  id: string
  dataUrl: string
  mimeType: string
}

export default function ChatInput({
  onSend,
  disabled,
  canvasContent = '',
  canvasMode: _canvasMode = 'notes',
  drawingSnapshot = null,
  isNotesAttached = false,
  isDrawingAttached = false,
  onAttachNotes,
  onAttachDrawing,
  onOpenCanvas,
  isWebSearchEnabled = false,
  onToggleWebSearch
}: ChatInputProps) {
  const [text, setText] = useState('')
  const [images, setImages] = useState<AttachedImage[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setImages(prev => [...prev, {
        id: Date.now().toString(),
        dataUrl,
        mimeType: file.type,
      }])
    }
    reader.readAsDataURL(file)
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) handleImageFile(file)
        return
      }
    }
  }, [handleImageFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const files = e.dataTransfer.files
    for (const file of files) {
      handleImageFile(file)
    }
  }, [handleImageFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      for (const file of files) {
        handleImageFile(file)
      }
    }
    e.target.value = ''
  }, [handleImageFile])

  const removeImage = useCallback((id: string) => {
    setImages(prev => prev.filter(img => img.id !== id))
  }, [])

  // Auto-resize textarea based on content
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const newHeight = Math.max(80, Math.min(textarea.scrollHeight, 200))
      textarea.style.height = `${newHeight}px`
    }
  }, [])

  // Adjust height when text changes
  useEffect(() => {
    adjustTextareaHeight()
  }, [text, adjustTextareaHeight])

  const handleSend = useCallback(() => {
    const trimmedText = text.trim()
    if (!trimmedText && images.length === 0) return

    const content: ContentPart[] = []

    // Add images first
    for (const img of images) {
      content.push({
        type: 'image',
        imageData: img.dataUrl,
        mimeType: img.mimeType,
      })
    }

    // Add text
    if (trimmedText) {
      content.push({
        type: 'text',
        text: trimmedText,
      })
    }

    onSend(content)
    setText('')
    setImages([])
    // Reset textarea height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = '80px'
    }
  }, [text, images, onSend])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <TooltipProvider>
      <div className="relative border-t border-border">
        <div className="px-8 pt-6 pb-8 bg-background/95">
        {/* Notes Attachment Indicator */}
        {isNotesAttached && canvasContent.trim() && (
          <div className="mb-4 px-4 py-3 bg-accent/50 border border-border rounded-lg flex items-center justify-between group hover:bg-accent transition-colors duration-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Notes attached</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {canvasContent.trim().split('\n')[0].substring(0, 60)}
                  {canvasContent.trim().length > 60 ? '...' : ''}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onAttachNotes}
              className="h-8 w-8 opacity-0 group-hover:opacity-100"
              aria-label="Detach notes from message"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Drawing Attachment Indicator */}
        {isDrawingAttached && drawingSnapshot && (
          <div className="mb-4 px-4 py-3 bg-accent/50 border border-border rounded-lg flex items-center justify-between group hover:bg-accent transition-colors duration-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg">
                <Pencil className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Drawing attached</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Canvas drawing will be sent as image
                  </p>
                </div>
                {drawingSnapshot && (
                  <img
                    src={drawingSnapshot}
                    alt="Drawing preview"
                    className="w-16 h-16 object-cover rounded-lg border border-border"
                  />
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onAttachDrawing}
              className="h-8 w-8 opacity-0 group-hover:opacity-100"
              aria-label="Detach drawing from message"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Attached Images */}
        {images.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-muted-foreground uppercase">
                {images.length} {images.length === 1 ? 'Image' : 'Images'} Attached
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="flex gap-3 flex-wrap">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="relative group cursor-pointer"
                >
                  <div className="relative overflow-hidden rounded-lg ring-2 ring-border group-hover:ring-accent transition-[box-shadow] duration-200">
                    <img
                      src={img.dataUrl}
                      alt="Attached"
                      className="w-24 h-24 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => removeImage(img.id)}
                    className="absolute -top-2 -right-2 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-[opacity,transform] duration-200 hover:scale-110"
                    aria-label="Remove attached image"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Input Container */}
        <div
          className="relative rounded-lg bg-card border border-border shadow-lg focus-within:border-accent transition-[border-color,box-shadow] duration-200 overflow-hidden"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {/* Input Field */}
          <div className="relative">
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
              className="w-full px-6 py-5 bg-transparent border-0 resize-none focus-visible:ring-0 pr-32 text-sm"
              style={{ height: '80px', minHeight: '80px', maxHeight: '200px' }}
              aria-label="Type your message"
            />

            {/* Character count for long messages */}
            {text.length > 500 && (
              <div className="absolute top-3 right-24 text-xs text-muted-foreground font-mono tabular-nums">
                {text.length}
              </div>
            )}
          </div>

          {/* Bottom Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t border-border">
            {/* Left: Attachment Buttons */}
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    data-flow-name="btn-attach-image"
                    className="h-8 w-8"
                    aria-label="Attach image to message"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add image</TooltipContent>
              </Tooltip>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                aria-label="File upload input for images"
              />

              {onAttachNotes && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isNotesAttached ? "secondary" : "ghost"}
                      size="icon"
                      onClick={() => {
                        if (!canvasContent.trim()) {
                          // Open canvas panel if no notes content
                          onOpenCanvas?.()
                        } else {
                          // Toggle attachment
                          onAttachNotes()
                        }
                      }}
                      data-flow-name="btn-attach-notes"
                      className="h-8 w-8"
                      aria-label={isNotesAttached ? "Notes attached to message" : "Attach notes to message"}
                      aria-pressed={isNotesAttached}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {canvasContent.trim() ? (isNotesAttached ? 'Detach notes' : 'Attach notes') : 'Open canvas'}
                  </TooltipContent>
                </Tooltip>
              )}

              {onAttachDrawing && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isDrawingAttached ? "secondary" : "ghost"}
                      size="icon"
                      onClick={() => {
                        if (!drawingSnapshot) {
                          // Open canvas panel if no drawing
                          onOpenCanvas?.()
                        } else {
                          // Toggle attachment
                          onAttachDrawing()
                        }
                      }}
                      data-flow-name="btn-attach-drawing"
                      className="h-8 w-8"
                      aria-label={isDrawingAttached ? "Drawing attached to message" : "Attach drawing to message"}
                      aria-pressed={isDrawingAttached}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {drawingSnapshot ? (isDrawingAttached ? 'Detach drawing' : 'Attach drawing') : 'Open canvas'}
                  </TooltipContent>
                </Tooltip>
              )}

              {onToggleWebSearch && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isWebSearchEnabled ? "secondary" : "ghost"}
                      size="icon"
                      onClick={onToggleWebSearch}
                      className="h-8 w-8"
                      aria-label={isWebSearchEnabled ? "Web search enabled" : "Enable web search"}
                      aria-pressed={isWebSearchEnabled}
                    >
                      <Globe className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isWebSearchEnabled ? 'Disable web search' : 'Enable web search'}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Right: Keyboard Hints & Send Button */}
            <div className="flex items-center gap-4">
              {/* Keyboard shortcuts - hide on mobile */}
              <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono">
                    ↵
                  </kbd>
                  <span>send</span>
                </div>
                <div className="w-px h-3 bg-border" />
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-1 bg-muted border border-border rounded text-xs font-mono">
                    ⇧
                  </kbd>
                  <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono">
                    ↵
                  </kbd>
                  <span>line</span>
                </div>
              </div>

              {/* Send Button */}
              <Button
                onClick={handleSend}
                disabled={disabled || (!text.trim() && images.length === 0)}
                data-flow-name="btn-send"
                size="sm"
              >
                <span className="text-sm">Send</span>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
