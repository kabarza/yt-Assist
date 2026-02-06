import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../stores/chatStore'
import { useCanvasStore } from '../stores/canvasStore'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import { CanvasPanel } from './CanvasPanel'
import WelcomeScreen from './WelcomeScreen'
import type { ContentPart, Provider } from '../types/chat'
import { MODELS, DEFAULT_PROVIDER } from '../types/chat'
import { ChevronLeft } from 'lucide-react'

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
    createChat,
    addMessage,
    appendToMessage,
    setCitations,
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
      const chatId = createChat(DEFAULT_PROVIDER, initialPrompt)
      sendToAIWithChat(chatId, DEFAULT_PROVIDER, MODELS[DEFAULT_PROVIDER][0].id, [{ type: 'text', text: initialPrompt }], true)
      onPromptProcessed?.()
    }
  }, [initialPrompt, promptId])

  // Track chat switches
  useEffect(() => {
    if (activeChatId !== previousChatIdRef.current) {
      isInitialLoadRef.current = true
      previousChatIdRef.current = activeChatId
      setCanvasActiveChatId(activeChatId)
      setIsNotesAttached(false)
      setIsDrawingAttached(false)
      setIsWebSearchEnabled(false)
    }
  }, [activeChatId, setCanvasActiveChatId])

  // Scroll to bottom
  useEffect(() => {
    if (activeChat?.messages.length) {
      messagesEndRef.current?.scrollIntoView({
        behavior: isInitialLoadRef.current ? 'instant' : 'smooth'
      })
      isInitialLoadRef.current = false
    }
  }, [activeChat?.messages])

  // Generate AI title
  const getTitleSeedText = (content: ContentPart[]) => {
    const textPart = content.find(
      (part) =>
        part.type === 'text' &&
        part.text &&
        part.text.trim().length > 0 &&
        !part.text.trimStart().startsWith('<canvas')
    )
    return textPart?.text?.trim() || ''
  }

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
          setTitle(chatId, data.text.trim().slice(0, 50))
        }
      }
    } catch {
      // Silently fail
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

    const assistantMessageId = addMessage(chatId, 'assistant', [{ type: 'text', text: '' }])

    try {
      const response = await fetch(`/api/chat/${provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content }],
          stream: true,
          webSearch: isWebSearchEnabled,
        }),
      })

      if (!response.ok) throw new Error(`API error: ${response.status}`)

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('No response body')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        for (const line of decoder.decode(value).split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'delta' && data.text) {
                appendToMessage(chatId, assistantMessageId, data.text)
              } else if (data.type === 'citations' && data.citations) {
                setCitations(chatId, assistantMessageId, data.citations)
              } else if (data.type === 'error') {
                appendToMessage(chatId, assistantMessageId, `\n\nError: ${data.error}`)
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }

      if (shouldGenerateTitle) {
        const userText = getTitleSeedText(content)
        if (userText) {
          generateChatTitle(chatId, provider, model, userText)
        }
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

    const assistantMessageId = addMessage(chatId, 'assistant', [{ type: 'text', text: '' }])

    try {
      const response = await fetch(`/api/chat/${chat.provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: chat.model,
          messages: [...chat.messages, { role: 'user', content }],
          stream: true,
          webSearch: isWebSearchEnabled,
        }),
      })

      if (!response.ok) throw new Error(`API error: ${response.status}`)

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('No response body')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        for (const line of decoder.decode(value).split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'delta' && data.text) {
                appendToMessage(chatId, assistantMessageId, data.text)
              } else if (data.type === 'citations' && data.citations) {
                setCitations(chatId, assistantMessageId, data.citations)
              } else if (data.type === 'error') {
                appendToMessage(chatId, assistantMessageId, `\n\nError: ${data.error}`)
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }

      if (isFirstMessage) {
        const userText = getTitleSeedText(content)
        if (userText) {
          generateChatTitle(chatId, chat.provider, chat.model, userText)
        }
      }
    } catch (error) {
      appendToMessage(chatId, assistantMessageId, `Error: ${error}`)
    } finally {
      setIsStreaming(false)
    }
  }

  const buildContentWithCanvas = (content: ContentPart[]) => {
    let finalContent = content

    if (isNotesAttached && canvasContent.trim()) {
      const instructionsAttr = canvasInstructions.trim()
        ? ` instructions="${canvasInstructions.replace(/"/g, '&quot;')}"`
        : ''
      const canvasBlock: ContentPart = {
        type: 'text',
        text: `<canvas type="${canvasType}"${instructionsAttr}>\n${canvasContent}\n</canvas>\n\n`,
      }

      const textIndex = content.findIndex(c => c.type === 'text')
      if (textIndex !== -1) {
        finalContent = [
          ...content.slice(0, textIndex),
          canvasBlock,
          { type: 'text', text: content[textIndex].text },
          ...content.slice(textIndex + 1),
        ]
      } else {
        finalContent = [canvasBlock, ...content]
      }
      saveSnapshot()
    }

    if (isDrawingAttached && drawingSnapshot) {
      finalContent = [{ type: 'image', imageData: drawingSnapshot, mimeType: 'image/png' }, ...finalContent]
      saveDrawingSnapshot()
    }

    return finalContent
  }

  const handleSend = async (content: ContentPart[]) => {
    if (!activeChatId || isStreaming) return

    const finalContent = buildContentWithCanvas(content)
    if (finalContent.length === 0) return

    addMessage(activeChatId, 'user', finalContent)
    await sendToAI(activeChatId, finalContent)

    setIsNotesAttached(false)
    setIsDrawingAttached(false)
  }

  const handleWelcomeSend = async (content: ContentPart[]) => {
    if (isStreaming) return

    const finalContent = buildContentWithCanvas(content)
    if (finalContent.length === 0) return

    const chatId = createChat(DEFAULT_PROVIDER)
    addMessage(chatId, 'user', finalContent)
    await sendToAIWithChat(
      chatId,
      DEFAULT_PROVIDER,
      MODELS[DEFAULT_PROVIDER][0].id,
      finalContent,
      Boolean(getTitleSeedText(finalContent))
    )

    setIsNotesAttached(false)
    setIsDrawingAttached(false)
  }

  const handleProviderChange = (provider: Provider) => {
    if (activeChatId) setProvider(activeChatId, provider)
  }

  const handleModelChange = (model: string) => {
    if (activeChatId) setModel(activeChatId, model)
  }

  // Handle suggestion prompt from welcome screen
  const handleSuggestion = (prompt: string) => {
    const chatId = createChat(DEFAULT_PROVIDER, prompt)
    sendToAIWithChat(chatId, DEFAULT_PROVIDER, MODELS[DEFAULT_PROVIDER][0].id, [{ type: 'text', text: prompt }], true)
  }

  return (
    <div className="flex h-full">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeChat ? (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 pb-2 pt-1">
              <div className="max-w-3xl mx-auto w-full space-y-4">
                {activeChat.messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input — floats at bottom */}
            <div className="max-w-3xl mx-auto w-full">
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
                    setIsNotesAttached(false)
                  } else if (canvasContent.trim()) {
                    setIsNotesAttached(true)
                    if (canvasMode !== 'notes') setCanvasMode('notes')
                  }
                }}
                onAttachDrawing={() => {
                  if (isDrawingAttached) {
                    setIsDrawingAttached(false)
                  } else if (drawingSnapshot) {
                    setIsDrawingAttached(true)
                    if (canvasMode !== 'draw') setCanvasMode('draw')
                  }
                }}
                onOpenCanvas={() => setIsCanvasOpen(true)}
                isWebSearchEnabled={isWebSearchEnabled}
                onToggleWebSearch={activeChat.provider === 'openai' ? () => setIsWebSearchEnabled(!isWebSearchEnabled) : undefined}
                provider={activeChat.provider}
                model={activeChat.model}
                onProviderChange={handleProviderChange}
                onModelChange={handleModelChange}
              />
            </div>
          </>
        ) : (
          /* Welcome / empty state */
          <div className="flex-1 flex flex-col">
            <div className="flex-1 flex items-center justify-center px-4">
              <WelcomeScreen onSuggestion={handleSuggestion} />
            </div>
            <div className="max-w-3xl mx-auto w-full">
              <ChatInput
                onSend={handleWelcomeSend}
                disabled={isStreaming}
                canvasContent={canvasContent}
                canvasMode={canvasMode}
                drawingSnapshot={drawingSnapshot}
                isNotesAttached={isNotesAttached}
                isDrawingAttached={isDrawingAttached}
                onAttachNotes={() => {
                  if (isNotesAttached) {
                    setIsNotesAttached(false)
                  } else if (canvasContent.trim()) {
                    setIsNotesAttached(true)
                    if (canvasMode !== 'notes') setCanvasMode('notes')
                  }
                }}
                onAttachDrawing={() => {
                  if (isDrawingAttached) {
                    setIsDrawingAttached(false)
                  } else if (drawingSnapshot) {
                    setIsDrawingAttached(true)
                    if (canvasMode !== 'draw') setCanvasMode('draw')
                  }
                }}
                onOpenCanvas={() => setIsCanvasOpen(true)}
                isWebSearchEnabled={isWebSearchEnabled}
                onToggleWebSearch={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
                provider={DEFAULT_PROVIDER}
                model={MODELS[DEFAULT_PROVIDER][0].id}
                onProviderChange={() => {}}
                onModelChange={() => {}}
              />
            </div>
          </div>
        )}
      </div>

      {/* Canvas reopen tab — visible only when panel is closed */}
      {!isCanvasOpen && (
        <button
          type="button"
          onClick={() => setIsCanvasOpen(true)}
          aria-label="Open canvas panel"
          className="self-stretch flex items-center justify-center w-5 bg-card border-l border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-150"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      )}

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
