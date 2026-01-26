import { useState, useRef, useCallback } from 'react'
import type { ContentPart } from '../types/chat'

interface ChatInputProps {
  onSend: (content: ContentPart[]) => void
  disabled?: boolean
}

interface AttachedImage {
  id: string
  dataUrl: string
  mimeType: string
}

const SendIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
)

const ImageIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const CloseIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
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
  }, [text, images, onSend])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <div className="p-4 border-t border-gray-800">
      {/* Attached Images */}
      {images.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {images.map((img) => (
            <div key={img.id} className="relative group">
              <img
                src={img.dataUrl}
                alt="Attached"
                className="w-16 h-16 object-cover rounded-lg border border-gray-700"
              />
              <button
                onClick={() => removeImage(img.id)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <CloseIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div
        className="flex items-end gap-2"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {/* File Upload Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          data-flow-name="btn-attach-image"
          className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ImageIcon />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Text Input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Type a message... (paste images with Cmd+V)"
          disabled={disabled}
          data-flow-name="chat-input"
          rows={1}
          className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-lime-500 disabled:opacity-50"
          style={{ minHeight: '48px', maxHeight: '200px' }}
        />

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={disabled || (!text.trim() && images.length === 0)}
          data-flow-name="btn-send"
          className="p-3 bg-lime-500 text-gray-900 rounded-lg hover:bg-lime-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <SendIcon />
        </button>
      </div>

      <p className="mt-2 text-xs text-gray-500">
        Press Enter to send, Shift+Enter for new line. Paste or drop images to attach.
      </p>
    </div>
  )
}
