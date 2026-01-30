import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../stores/chatStore'
import { useCanvasStore } from '../stores/canvasStore'
import ChatList from './ChatList'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import { CanvasPanel } from './CanvasPanel'
import type { ContentPart, Provider } from '../types/chat'
import { MODELS, DEFAULT_PROVIDER } from '../types/chat'

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
    isAttached: isCanvasAttached,
    isOpen: isCanvasOpen,
    width: canvasWidth,
    drawingSnapshot,
    setIsAttached: setIsCanvasAttached,
    setIsOpen: setIsCanvasOpen,
    setWidth: setCanvasWidth,
    saveSnapshot,
    saveDrawingSnapshot
  } = useCanvasStore()

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
    }
  }, [activeChatId])

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

    // Prepend canvas content if attached
    let finalContent = content
    if (isCanvasAttached) {
      if (canvasMode === 'notes' && canvasContent.trim()) {
        const canvasBlock: ContentPart = {
          type: 'text',
          text: `<canvas>\n${canvasContent}\n</canvas>\n\n`,
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

        // Auto-save snapshot when sending with canvas attached
        saveSnapshot()
      } else if (canvasMode === 'draw' && drawingSnapshot) {
        const drawingImage: ContentPart = {
          type: 'image',
          imageData: drawingSnapshot,
          mimeType: 'image/png',
        }

        // Prepend drawing image
        finalContent = [drawingImage, ...content]

        // Auto-save drawing snapshot when sending
        saveDrawingSnapshot()
      }
    }

    addMessage(activeChatId, 'user', finalContent)
    await sendToAI(activeChatId, finalContent)
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
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-4">
              <label htmlFor="provider-select" className="sr-only">AI Provider</label>
              <select
                id="provider-select"
                value={activeChat.provider}
                onChange={(e) => handleProviderChange(e.target.value as Provider)}
                data-flow-name="provider-select"
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500"
                aria-label="Select AI provider"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic Claude</option>
              </select>

              <label htmlFor="model-select" className="sr-only">AI Model</label>
              <select
                id="model-select"
                value={activeChat.model}
                onChange={(e) => handleModelChange(e.target.value)}
                data-flow-name="model-select"
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500"
                aria-label="Select AI model"
              >
                {MODELS[activeChat.provider].map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>

              <button
                onClick={() => setIsCanvasOpen(!isCanvasOpen)}
                className={`ml-auto p-2 rounded-lg transition-colors ${
                  isCanvasOpen
                    ? 'text-lime-500 bg-lime-500/10'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
                aria-label={isCanvasOpen ? 'Close canvas panel' : 'Open canvas panel'}
                aria-expanded={isCanvasOpen}
                data-flow-name="btn-toggle-canvas-panel"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
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
              isCanvasAttached={isCanvasAttached}
              onToggleCanvasAttached={() => setIsCanvasAttached(!isCanvasAttached)}
              onOpenCanvas={() => setIsCanvasOpen(true)}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="mb-4">Select a chat or start a new one</p>
              <button
                onClick={handleNewChat}
                data-flow-name="btn-new-chat-empty"
                className="px-4 py-2 bg-lime-500 text-gray-900 rounded-lg font-medium hover:bg-lime-400 transition-colors"
              >
                New Chat
              </button>
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
