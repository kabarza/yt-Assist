import { useState, useRef, useCallback, useEffect } from 'react'
import type { ContentPart } from '../types/chat'

interface ChatInputProps {
  onSend: (content: ContentPart[]) => void
  disabled?: boolean
  canvasContent?: string
  isCanvasAttached?: boolean
  onToggleCanvasAttached?: () => void
  onOpenCanvas?: () => void
}

interface AttachedImage {
  id: string
  dataUrl: string
  mimeType: string
}

const SendIcon = () => (
  <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
)

const ImageIcon = () => (
  <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const CloseIcon = () => (
  <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const CanvasIcon = () => (
  <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

export default function ChatInput({
  onSend,
  disabled,
  canvasContent = '',
  isCanvasAttached = false,
  onToggleCanvasAttached,
  onOpenCanvas
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
    <div className="relative border-t border-gray-800/40">
      {/* Focus indicator on top border - FIXED: removed gradient, reduced duration */}
      <div className="absolute inset-x-0 top-0 h-px bg-lime-500/20 opacity-0 transition-opacity duration-200 peer-focus-within:opacity-100" />

      {/* FIXED: removed backdrop-blur-sm, increased opacity */}
      <div className="px-8 pt-6 pb-8 bg-gray-950/95 peer">
        {/* Canvas Attachment Indicator - FIXED: added duration-200 */}
        {isCanvasAttached && canvasContent.trim() && (
          <div className="mb-4 px-4 py-3 bg-lime-500/5 border border-lime-500/20 rounded-2xl flex items-center justify-between group hover:bg-lime-500/8 transition-colors duration-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-lime-500/10 rounded-lg">
                <CanvasIcon />
              </div>
              <div>
                <p className="text-sm font-medium text-lime-400">Canvas attached</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {canvasContent.trim().split('\n')[0].substring(0, 60)}
                  {canvasContent.trim().length > 60 ? '...' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={onToggleCanvasAttached}
              aria-label="Detach canvas"
              className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 rounded-lg transition-[color,background-color] duration-200 opacity-0 group-hover:opacity-100"
              title="Detach canvas"
            >
              <CloseIcon />
            </button>
          </div>
        )}

        {/* Attached Images - FIXED: removed gradients, removed tracking-wider */}
        {images.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-gray-800/50" />
              <span className="text-xs font-medium text-gray-500 uppercase">
                {images.length} {images.length === 1 ? 'Image' : 'Images'} Attached
              </span>
              <div className="h-px flex-1 bg-gray-800/50" />
            </div>
            <div className="flex gap-3 flex-wrap">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="relative group cursor-pointer"
                >
                  {/* FIXED: changed transition-all to specific property, added duration */}
                  <div className="relative overflow-hidden rounded-2xl ring-2 ring-gray-800/50 group-hover:ring-lime-500/30 transition-[box-shadow] duration-200">
                    <img
                      src={img.dataUrl}
                      alt="Attached"
                      className="w-24 h-24 object-cover"
                    />
                    {/* FIXED: removed gradient overlay, using solid color */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  </div>
                  {/* FIXED: added aria-label, changed w-7 h-7 to size-7, specific transitions */}
                  <button
                    onClick={() => removeImage(img.id)}
                    aria-label="Remove image"
                    className="absolute -top-2 -right-2 size-7 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-xl opacity-0 group-hover:opacity-100 transition-[opacity,transform] duration-200 hover:scale-110 ring-2 ring-gray-950"
                  >
                    <CloseIcon />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Input Container - FIXED: removed backdrop-blur, specific transitions, reduced duration */}
        <div
          className="relative rounded-2xl bg-gray-900/90 border border-gray-800/60 shadow-2xl focus-within:border-lime-500/40 focus-within:shadow-lime-500/5 transition-[border-color,box-shadow] duration-200 overflow-hidden"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {/* Input Field - FIXED: specific transition property */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Ask me anything..."
              disabled={disabled}
              data-flow-name="chat-input"
              className="w-full px-6 py-5 bg-transparent text-gray-100 placeholder-gray-600 resize-none focus:outline-none disabled:opacity-50 transition-opacity duration-200 pr-32"
              style={{ height: '80px', minHeight: '80px', maxHeight: '200px' }}
            />

            {/* Character count for long messages */}
            {text.length > 500 && (
              <div className="absolute top-3 right-24 text-xs text-gray-600 font-mono tabular-nums">
                {text.length}
              </div>
            )}
          </div>

          {/* Bottom Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900/30 border-t border-gray-800/40">
            {/* Left: Attachment Buttons */}
            <div className="flex items-center gap-2">
              {/* FIXED: added aria-label, specific transition properties */}
              <button
                onClick={() => fileInputRef.current?.click()}
                data-flow-name="btn-attach-image"
                aria-label="Attach image"
                className="group relative p-2 text-gray-500 hover:text-lime-400 hover:bg-gray-800/60 rounded-xl transition-[color,background-color] duration-200"
                title="Attach image"
              >
                <ImageIcon />
                {/* FIXED: added duration */}
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none shadow-xl">
                  Add image
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* FIXED: added aria-label, specific transition properties */}
              {onToggleCanvasAttached && (
                <button
                  onClick={() => {
                    if (!canvasContent.trim() && !isCanvasAttached) {
                      onOpenCanvas?.()
                    } else {
                      onToggleCanvasAttached()
                    }
                  }}
                  disabled={!canvasContent.trim() && isCanvasAttached}
                  data-flow-name="btn-toggle-canvas"
                  aria-label={
                    isCanvasAttached
                      ? 'Canvas attached'
                      : canvasContent.trim()
                        ? 'Attach canvas'
                        : 'Open canvas'
                  }
                  className={`group relative p-2 rounded-xl transition-[color,background-color] duration-200 ${
                    isCanvasAttached
                      ? 'text-lime-400 bg-lime-500/15'
                      : 'text-gray-500 hover:text-lime-400 hover:bg-gray-800/60'
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                  title={
                    isCanvasAttached
                      ? 'Canvas attached'
                      : canvasContent.trim()
                        ? 'Attach canvas'
                        : 'Open canvas'
                  }
                >
                  <CanvasIcon />
                  {/* FIXED: added duration */}
                  {!isCanvasAttached && (
                    <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none shadow-xl">
                      {canvasContent.trim() ? 'Attach canvas' : 'Open canvas'}
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Right: Keyboard Hints & Send Button */}
            <div className="flex items-center gap-4">
              {/* Keyboard shortcuts - hide on mobile */}
              <div className="hidden sm:flex items-center gap-3 text-xs text-gray-600">
                <div className="flex items-center gap-1.5">
                  <kbd className="px-2 py-1 bg-gray-800/80 border border-gray-700/50 rounded-md text-gray-500 font-mono text-[10px] shadow-sm">
                    ↵
                  </kbd>
                  <span>send</span>
                </div>
                <div className="w-px h-3 bg-gray-800" />
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-1 bg-gray-800/80 border border-gray-700/50 rounded-md text-gray-500 font-mono text-[10px] shadow-sm">
                    ⇧
                  </kbd>
                  <kbd className="px-2 py-1 bg-gray-800/80 border border-gray-700/50 rounded-md text-gray-500 font-mono text-[10px] shadow-sm">
                    ↵
                  </kbd>
                  <span>line</span>
                </div>
              </div>

              {/* Send Button - FIXED: specific transition properties */}
              <button
                onClick={handleSend}
                disabled={disabled || (!text.trim() && images.length === 0)}
                data-flow-name="btn-send"
                className="group relative px-6 py-2.5 bg-lime-500 hover:bg-lime-400 text-gray-950 rounded-xl font-semibold shadow-lg shadow-lime-500/20 hover:shadow-xl hover:shadow-lime-500/30 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none transition-[background-color,box-shadow] duration-200 disabled:hover:bg-lime-500 flex items-center gap-2"
              >
                <span className="text-sm">Send</span>
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
