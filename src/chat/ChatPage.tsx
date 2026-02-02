import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../stores/chatStore'
import { useCanvasStore } from '../stores/canvasStore'
import ChatList from './ChatList'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import { CanvasPanel } from './CanvasPanel'
import type { ContentPart, Provider } from '../types/chat'
import { MODELS, DEFAULT_PROVIDER } from '../types/chat'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText } from 'lucide-react'

interface ChatPageProps {
  initialPrompt?: string
  promptId?: string
  onPromptProcessed?: () => void
}

export default function ChatPage({ initialPrompt, promptId, onPromptProcessed }: ChatPageProps) {
  const {
    chats,
    activeChat,
    activeChatId,
    setActiveChatId,
    createChat,
    deleteChat,
    addMessage,
    appendToMessage,
    setProvider,
    setModel,
    setTitle,
  } = useChatStore()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const processedPromptIdRef = useRef<string | null>(null)
  const titleGeneratedRef = useRef<Set<string>>(new Set())
  const isInitialLoadRef = useRef(true)
  const previousChatIdRef = useRef<string | null>(null)

  const {
    mode: canvasMode,
    content: canvasContent,
    isOpen: isCanvasOpen,
    width: canvasWidth,
    drawingSnapshot,
    canvasType,
    canvasInstructions,
    setIsOpen: setIsCanvasOpen,
    setWidth: setCanvasWidth,
    setActiveChatId: setCanvasActiveChatId,
    setMode: setCanvasMode,
    saveSnapshot,
    saveDrawingSnapshot
  } = useCanvasStore()

  const [isNotesAttached, setIsNotesAttached] = useState(false)
  const [isDrawingAttached, setIsDrawingAttached] = useState(false)
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false)

  // Create a new chat with initial prompt and send to AI
  useEffect(() => {
    if (initialPrompt && promptId && processedPromptIdRef.current !== promptId) {
      processedPromptIdRef.current = promptId
      
      // Create chat with the prompt as first message
      const chatId = createChat(DEFAULT_PROVIDER, initialPrompt)
      
      // Send to AI immediately
      sendToAIWithChat(chatId, DEFAULT_PROVIDER, MODELS[DEFAULT_PROVIDER][0].id, [{ type: 'text', text: initialPrompt }], true)
      
      // Clear the prompt from parent state
      onPromptProcessed?.()
    }
  }, [initialPrompt, promptId])

  // Track when switching to a different chat (for instant vs smooth scroll)
  useEffect(() => {
    if (activeChatId !== previousChatIdRef.current) {
      isInitialLoadRef.current = true
      previousChatIdRef.current = activeChatId
      // Update canvas store to use this chat's canvas state
      setCanvasActiveChatId(activeChatId)
      // Reset attachment states when switching chats
      setIsNotesAttached(false)
      setIsDrawingAttached(false)
      setIsWebSearchEnabled(false)
    }
  }, [activeChatId, setCanvasActiveChatId])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (activeChat?.messages.length) {
      messagesEndRef.current?.scrollIntoView({ 
        behavior: isInitialLoadRef.current ? 'instant' : 'smooth' 
      })
      isInitialLoadRef.current = false
    }
  }, [activeChat?.messages])

  // Generate AI title for chat
  const generateChatTitle = async (chatId: string, provider: Provider, model: string, userMessage: string) => {
    if (titleGeneratedRef.current.has(chatId)) return
    titleGeneratedRef.current.add(chatId)

    try {
      const endpoint = `/api/chat/${provider}`
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{
            role: 'user',
            content: [{
              type: 'text',
              text: `Based on this message, generate a 3-4 word title that describes what this video/content is about. Reply with ONLY the title, nothing else. No quotes, no punctuation at the end.\n\nMessage:\n${userMessage.slice(0, 1000)}`
            }]
          }],
          stream: false,
          webSearch: false,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.text) {
          const title = data.text.trim().slice(0, 50)
          setTitle(chatId, title)
        }
      }
    } catch {
      // Silently fail - title generation is not critical
    }
  }

  const sendToAIWithChat = async (
    chatId: string, 
    provider: Provider, 
    model: string, 
    content: ContentPart[],
    shouldGenerateTitle = false
  ) => {
    if (isStreaming) return

    setIsStreaming(true)

    // Add assistant message placeholder
    const assistantMessageId = addMessage(chatId, 'assistant', [{ type: 'text', text: '' }])

    try {
      const endpoint = `/api/chat/${provider}`
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content }],
          stream: true,
          webSearch: isWebSearchEnabled,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No response body')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'delta' && data.text) {
                appendToMessage(chatId, assistantMessageId, data.text)
              } else if (data.type === 'error') {
                appendToMessage(chatId, assistantMessageId, `\n\nError: ${data.error}`)
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      // Generate title after successful response
      if (shouldGenerateTitle) {
        const userText = content.find(c => c.type === 'text')?.text || ''
        generateChatTitle(chatId, provider, model, userText)
      }
    } catch (error) {
      appendToMessage(chatId, assistantMessageId, `Error: ${error}`)
    } finally {
      setIsStreaming(false)
    }
  }

  const sendToAI = async (chatId: string, content: ContentPart[]) => {
    const chat = chats.find(c => c.id === chatId)
    if (!chat) return

    const isFirstMessage = chat.messages.length <= 1

    setIsStreaming(true)

    // Add assistant message placeholder
    const assistantMessageId = addMessage(chatId, 'assistant', [{ type: 'text', text: '' }])

    try {
      const endpoint = `/api/chat/${chat.provider}`
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: chat.model,
          messages: [...chat.messages, { role: 'user', content }],
          stream: true,
          webSearch: isWebSearchEnabled,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No response body')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'delta' && data.text) {
                appendToMessage(chatId, assistantMessageId, data.text)
              } else if (data.type === 'error') {
                appendToMessage(chatId, assistantMessageId, `\n\nError: ${data.error}`)
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      // Generate title if this was the first real message
      if (isFirstMessage) {
        const userText = content.find(c => c.type === 'text')?.text || ''
        generateChatTitle(chatId, chat.provider, chat.model, userText)
      }
    } catch (error) {
      appendToMessage(chatId, assistantMessageId, `Error: ${error}`)
    } finally {
      setIsStreaming(false)
    }
  }

  const handleSend = async (content: ContentPart[]) => {
    if (!activeChatId || isStreaming) return

    let finalContent = content

    // Add notes if attached
    if (isNotesAttached && canvasContent.trim()) {
      // Build canvas XML tag with type and instructions attributes
      const instructionsAttr = canvasInstructions.trim()
        ? ` instructions="${canvasInstructions.replace(/"/g, '&quot;')}"`
        : '';
      const canvasBlock: ContentPart = {
        type: 'text',
        text: `<canvas type="${canvasType}"${instructionsAttr}>\n${canvasContent}\n</canvas>\n\n`,
      }

      // Insert canvas before text content
      const textIndex = content.findIndex(c => c.type === 'text')
      if (textIndex !== -1) {
        finalContent = [
          ...content.slice(0, textIndex),
          canvasBlock,
          {
            type: 'text',
            text: content[textIndex].text,
          },
          ...content.slice(textIndex + 1),
        ]
      } else {
        // No text content, just prepend canvas
        finalContent = [canvasBlock, ...content]
      }

      // Auto-save snapshot when sending with notes attached
      saveSnapshot()
    }

    // Add drawing if attached
    if (isDrawingAttached && drawingSnapshot) {
      const drawingImage: ContentPart = {
        type: 'image',
        imageData: drawingSnapshot,
        mimeType: 'image/png',
      }

      // Prepend drawing image
      finalContent = [drawingImage, ...finalContent]

      // Auto-save drawing snapshot when sending
      saveDrawingSnapshot()
    }

    addMessage(activeChatId, 'user', finalContent)
    await sendToAI(activeChatId, finalContent)

    // Reset attachment states after sending
    setIsNotesAttached(false)
    setIsDrawingAttached(false)
  }

  const handleNewChat = () => {
    createChat(DEFAULT_PROVIDER)
  }

  const handleProviderChange = (provider: Provider) => {
    if (activeChatId) {
      setProvider(activeChatId, provider)
    }
  }

  const handleModelChange = (model: string) => {
    if (activeChatId) {
      setModel(activeChatId, model)
    }
  }

  return (
    <div className="flex h-full">
      {/* Chat List Sidebar */}
      <ChatList
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        onNewChat={handleNewChat}
        onDeleteChat={deleteChat}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeChat ? (
          <>
            {/* Header with provider/model selector */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-4">
              <label htmlFor="provider-select" className="sr-only">AI Provider</label>
              <Select
                value={activeChat.provider}
                onValueChange={(value) => handleProviderChange(value as Provider)}
              >
                <SelectTrigger
                  id="provider-select"
                  className="w-[180px] h-8 text-sm"
                  data-flow-name="provider-select"
                  aria-label="Select AI provider"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                </SelectContent>
              </Select>

              <label htmlFor="model-select" className="sr-only">AI Model</label>
              <Select
                value={activeChat.model}
                onValueChange={handleModelChange}
              >
                <SelectTrigger
                  id="model-select"
                  className="w-[200px] h-8 text-sm"
                  data-flow-name="model-select"
                  aria-label="Select AI model"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS[activeChat.provider].map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCanvasOpen(!isCanvasOpen)}
                className={`ml-auto h-8 w-8 ${isCanvasOpen ? 'text-foreground bg-accent' : ''}`}
                aria-label={isCanvasOpen ? 'Close canvas panel' : 'Open canvas panel'}
                aria-expanded={isCanvasOpen}
                data-flow-name="btn-toggle-canvas-panel"
              >
                <FileText className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeChat.messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <ChatInput
              onSend={handleSend}
              disabled={isStreaming}
              canvasContent={canvasContent}
              canvasMode={canvasMode}
              drawingSnapshot={drawingSnapshot}
              isNotesAttached={isNotesAttached}
              isDrawingAttached={isDrawingAttached}
              onAttachNotes={() => {
                if (isNotesAttached) {
                  // Detach notes
                  setIsNotesAttached(false)
                } else if (canvasContent.trim()) {
                  // Attach notes
                  setIsNotesAttached(true)
                  // Switch to notes mode if not already
                  if (canvasMode !== 'notes') {
                    setCanvasMode('notes')
                  }
                }
              }}
              onAttachDrawing={() => {
                if (isDrawingAttached) {
                  // Detach drawing
                  setIsDrawingAttached(false)
                } else if (drawingSnapshot) {
                  // Attach drawing
                  setIsDrawingAttached(true)
                  // Switch to draw mode if not already
                  if (canvasMode !== 'draw') {
                    setCanvasMode('draw')
                  }
                }
              }}
              onOpenCanvas={() => setIsCanvasOpen(true)}
              isWebSearchEnabled={isWebSearchEnabled}
              onToggleWebSearch={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="mb-4 text-sm">Select a chat or start a new one</p>
              <Button
                onClick={handleNewChat}
                data-flow-name="btn-new-chat-empty"
              >
                New Chat
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Canvas Panel */}
      {isCanvasOpen && (
        <CanvasPanel
          width={canvasWidth}
          onWidthChange={setCanvasWidth}
          onClose={() => setIsCanvasOpen(false)}
        />
      )}
    </div>
  )
}
