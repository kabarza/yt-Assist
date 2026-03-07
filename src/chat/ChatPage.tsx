import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../stores/chatStore'
import { useCanvasStore } from '../stores/canvasStore'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useOfflineQueue } from '../stores/offlineQueueStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useIsMobile } from '../hooks/useMediaQuery'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import { CanvasPanel } from './CanvasPanel'
import MobileHeader from '../components/MobileHeader'
import WelcomeScreen from './WelcomeScreen'
import SystemPromptDialog from './SystemPromptDialog'
import PinnedMessagesPanel from './PinnedMessagesPanel'
import ComparisonView, { type ComparisonResponse } from '../components/ComparisonView'
import ComparisonModeSelector, { type ComparisonModel } from '../components/ComparisonModeSelector'
import TitleVariantsView, { type TitleVariant } from '../components/TitleVariantsView'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import type { ContentPart, Provider } from '../types/chat'
import { MODELS } from '../types/chat'
import { ChevronLeft, Pin } from 'lucide-react'
import { toast } from 'sonner'
import { extractTitle, generateTitleVariants } from '../utils/titleVariants'
import { requestChatText, streamChatCompletion, type ChatRequestMessage } from '../utils/apiClient'

interface ChatPageProps {
  initialChatId?: string
  promptId?: string
  onPromptProcessed?: () => void
  onRegisterFocusInput?: (focusFn: () => void) => void
  onToggleSidebar?: () => void
}

export default function ChatPage({ initialChatId, promptId, onPromptProcessed, onRegisterFocusInput, onToggleSidebar }: ChatPageProps) {
  const isMobile = useIsMobile()
  const {
    chats,
    activeChat,
    activeChatId,
    setActiveChatId,
    createChat,
    forkChat,
    addMessage,
    appendToMessage,
    setCitations,
    updateMessage,
    removeMessage,
    setProvider,
    setModel,
    setTitle,
    setSystemPrompt,
    togglePinMessage,
  } = useChatStore()

  const { isOnline } = useOnlineStatus()
  const { addToQueue } = useOfflineQueue()
  const { settings } = useSettingsStore()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())
  const [isStreaming, setIsStreaming] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
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
  const [isSystemPromptDialogOpen, setIsSystemPromptDialogOpen] = useState(false)
  const [isPinnedPanelOpen, setIsPinnedPanelOpen] = useState(false)

  // Comparison mode state
  const [isComparisonMode, setIsComparisonMode] = useState(false)
  const [comparisonModels, setComparisonModels] = useState<ComparisonModel[]>([
    { provider: 'anthropic', model: MODELS.anthropic[0].id },
    { provider: 'openai', model: MODELS.openai[0].id },
  ])
  const [comparisonResponses, setComparisonResponses] = useState<ComparisonResponse[]>([])
  const [showComparisonView, setShowComparisonView] = useState(false)

  // Title variants state
  const [titleVariants, setTitleVariants] = useState<TitleVariant[]>([])
  const [showTitleVariants, setShowTitleVariants] = useState(false)
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false)
  const defaultProvider = settings.defaultProvider
  const defaultModel = MODELS[defaultProvider].some((entry) => entry.id === settings.defaultModel)
    ? settings.defaultModel
    : MODELS[defaultProvider][0].id

  // Auto-detach notes if content is cleared while attached
  useEffect(() => {
    if (isNotesAttached && !canvasContent.trim()) {
      setIsNotesAttached(false)
    }
  }, [canvasContent, isNotesAttached])

  // Auto-detach drawing if snapshot is cleared while attached
  useEffect(() => {
    if (isDrawingAttached && !drawingSnapshot) {
      setIsDrawingAttached(false)
    }
  }, [drawingSnapshot, isDrawingAttached])

  // Auto-send a newly created chat from another tool exactly once.
  useEffect(() => {
    if (initialChatId && promptId && processedPromptIdRef.current !== promptId) {
      processedPromptIdRef.current = promptId
      void sendToAI(initialChatId)
      onPromptProcessed?.()
    }
  }, [initialChatId, promptId, onPromptProcessed])

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
      const result = await requestChatText({
        provider,
        model,
        messages: [{
          role: 'user',
          content: [{
            type: 'text',
            text: `Based on this message, generate a 3-4 word title that describes what this video/content is about. Reply with ONLY the title, nothing else. No quotes, no punctuation at the end.\n\nMessage:\n${userMessage.slice(0, 1000)}`,
          }],
        }],
      })

      if (result.text) {
        setTitle(chatId, result.text.trim().slice(0, 50))
      }
    } catch {
      // Silently fail
    }
  }

  const toRequestMessages = (messages: { role: 'user' | 'assistant'; content: ContentPart[] }[]): ChatRequestMessage[] =>
    messages.map((message) => ({
      role: message.role,
      content: message.content,
    }))

  const queueChatRequest = (
    chatId: string,
    provider: Provider,
    model: string,
    messages: ChatRequestMessage[],
    systemPrompt?: string
  ) => {
    addToQueue({
      chatId,
      provider,
      model,
      messages,
      webSearch: isWebSearchEnabled,
      systemPrompt,
    })
    toast.info('Message queued', {
      description: 'Will be sent when connection is restored',
    })
  }

  const sendToAI = async (chatId: string) => {
    if (isStreaming) return

    const chat = useChatStore.getState().chats.find(c => c.id === chatId)
    if (!chat) return

    const messages = toRequestMessages(chat.messages)

    if (!isOnline) {
      queueChatRequest(chatId, chat.provider, chat.model, messages, chat.systemPrompt)
      return
    }

    const isFirstMessage = chat.messages.length === 1 && chat.messages[0]?.role === 'user'
    const latestUserMessage = [...chat.messages].reverse().find((message) => message.role === 'user')
    setIsStreaming(true)

    const controller = new AbortController()
    setAbortController(controller)

    const assistantMessageId = addMessage(chatId, 'assistant', [{ type: 'text', text: '' }])

    try {
      await streamChatCompletion(
        {
          provider: chat.provider,
          model: chat.model,
          messages,
          webSearch: isWebSearchEnabled,
          systemPrompt: chat.systemPrompt,
          signal: controller.signal,
        },
        {
          onText: (text) => appendToMessage(chatId, assistantMessageId, text),
          onCitations: (citations) => setCitations(chatId, assistantMessageId, citations),
          onError: (error) => {
            appendToMessage(chatId, assistantMessageId, `\n\nError: ${error}`)
            toast.error(`API error: ${error}`)
          },
        }
      )

      if (isFirstMessage && latestUserMessage) {
        const userText = getTitleSeedText(latestUserMessage.content)
        if (userText) {
          void generateChatTitle(chatId, chat.provider, chat.model, userText)
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        appendToMessage(chatId, assistantMessageId, '\n\n[Response stopped by user]')
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error)
        appendToMessage(chatId, assistantMessageId, `Error: ${errorMessage}`)
        toast.error(`Failed to send message: ${errorMessage}`)
      }
    } finally {
      setIsStreaming(false)
      setAbortController(null)
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

  // Send to multiple models for comparison
  const sendToModelsForComparison = async (content: ContentPart[]) => {
    if (isStreaming) return

    setIsStreaming(true)
    setShowComparisonView(true)

    // Initialize responses for all models
    const initialResponses: ComparisonResponse[] = comparisonModels.map(model => ({
      provider: model.provider,
      model: model.model,
      response: '',
      isStreaming: true,
    }))
    setComparisonResponses(initialResponses)

    // Send to all models in parallel
    const promises = comparisonModels.map(async (modelConfig, index) => {
      try {
        let accumulatedText = ''
        let streamError: string | null = null

        await streamChatCompletion(
          {
            provider: modelConfig.provider,
            model: modelConfig.model,
            messages: [{ role: 'user', content }],
            webSearch: isWebSearchEnabled,
          },
          {
            onText: (text) => {
              accumulatedText += text
              setComparisonResponses(prev =>
                prev.map((response, responseIndex) =>
                  responseIndex === index
                    ? { ...response, response: accumulatedText }
                    : response
                )
              )
            },
            onError: (error) => {
              streamError = error
            },
          }
        )

        if (streamError) {
          throw new Error(streamError)
        }

        // Mark as done streaming
        setComparisonResponses(prev =>
          prev.map((r, i) =>
            i === index ? { ...r, isStreaming: false } : r
          )
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        setComparisonResponses(prev =>
          prev.map((r, i) =>
            i === index
              ? { ...r, isStreaming: false, error: errorMessage }
              : r
          )
        )
      }
    })

    await Promise.all(promises)
    setIsStreaming(false)
  }

  const handleSend = async (content: ContentPart[]) => {
    if (!activeChatId || isStreaming) return

    const finalContent = buildContentWithCanvas(content)
    if (finalContent.length === 0) return

    // If comparison mode is active, use comparison send
    if (isComparisonMode) {
      await sendToModelsForComparison(finalContent)
      setIsNotesAttached(false)
      setIsDrawingAttached(false)
      return
    }

    addMessage(activeChatId, 'user', finalContent)
    await sendToAI(activeChatId)

    setIsNotesAttached(false)
    setIsDrawingAttached(false)
  }

  const handleWelcomeSend = async (content: ContentPart[]) => {
    if (isStreaming) return

    const finalContent = buildContentWithCanvas(content)
    if (finalContent.length === 0) return

    const chatId = createChat()
    addMessage(chatId, 'user', finalContent)
    await sendToAI(chatId)

    setIsNotesAttached(false)
    setIsDrawingAttached(false)
  }

  const handleProviderChange = (provider: Provider) => {
    if (activeChatId) setProvider(activeChatId, provider)
  }

  const handleModelChange = (model: string) => {
    if (activeChatId) setModel(activeChatId, model)
  }

  const handleSystemPromptSave = (systemPrompt: string | undefined) => {
    if (activeChatId) {
      setSystemPrompt(activeChatId, systemPrompt)
      toast.success(systemPrompt ? 'Custom system prompt saved' : 'Using default system prompt')
    }
  }

  // Comparison mode handlers
  const handleToggleComparisonMode = () => {
    setIsComparisonMode(!isComparisonMode)
    if (isComparisonMode) {
      // Exiting comparison mode
      setShowComparisonView(false)
      setComparisonResponses([])
    }
  }

  const handlePromoteResponse = (provider: Provider, model: string, response: string) => {
    if (!activeChatId) return

    // Add the promoted response as an assistant message in the main chat
    addMessage(activeChatId, 'assistant', [{ type: 'text', text: response }])

    // Exit comparison mode
    setIsComparisonMode(false)
    setShowComparisonView(false)
    setComparisonResponses([])

    // Update chat to use the promoted model
    setProvider(activeChatId, provider)
    setModel(activeChatId, model)

    toast.success(`Using response from ${model}`)
  }

  const handleCloseComparisonView = () => {
    setShowComparisonView(false)
    setComparisonResponses([])
  }

  // Title variants handlers
  const handleGenerateTitleVariants = async (messageText: string) => {
    const title = extractTitle(messageText)
    if (!title) {
      toast.error('Could not find a title in this message')
      return
    }

    if (!activeChat) return

    setIsGeneratingVariants(true)
    setShowTitleVariants(true)
    setTitleVariants([])

    try {
      const variants = await generateTitleVariants(
        title,
        activeChat.provider,
        activeChat.model,
        messageText.slice(0, 500) // Context snippet
      )
      setTitleVariants(variants)
      toast.success(`Generated ${variants.length} title variants`)
    } catch (error) {
      toast.error('Failed to generate title variants')
      console.error(error)
    } finally {
      setIsGeneratingVariants(false)
    }
  }

  const handleSelectTitleVariant = (title: string) => {
    if (!activeChatId) return

    // Add the selected title as a user message to continue the conversation
    addMessage(activeChatId, 'user', [{ type: 'text', text: `Use this title instead: "${title}"` }])

    // Close variants view
    setShowTitleVariants(false)
    setTitleVariants([])

    toast.success('Title selected')
  }

  const handleCloseTitleVariants = () => {
    setShowTitleVariants(false)
  }

  const handleStop = () => {
    if (abortController) {
      abortController.abort()
    }
  }

  // Handle suggestion prompt from welcome screen
  const handleSuggestion = (prompt: string) => {
    const chatId = createChat(undefined, prompt)
    void sendToAI(chatId)
  }

  // Handle regenerate button click
  const handleRegenerate = (messageId: string) => {
    if (!activeChatId || isStreaming) return

    const chat = chats.find(c => c.id === activeChatId)
    if (!chat) return

    // Find the assistant message index
    const messageIndex = chat.messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1 || chat.messages[messageIndex].role !== 'assistant') return

    // Get the previous user message
    if (messageIndex === 0) return // No previous message
    const previousMessage = chat.messages[messageIndex - 1]
    if (previousMessage.role !== 'user') return

    // Remove the assistant message
    removeMessage(activeChatId, messageId)

    // Re-send the user message
    void sendToAI(activeChatId)
  }

  // Handle message edit
  const handleEdit = (messageId: string, content: ContentPart[]) => {
    if (!activeChatId || isStreaming) return

    const chat = chats.find(c => c.id === activeChatId)
    if (!chat) return

    // Find the message index
    const messageIndex = chat.messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1 || chat.messages[messageIndex].role !== 'user') return

    // Update the message content
    updateMessage(activeChatId, messageId, content)

    // Remove all messages after this one (they're based on the old content)
    const messagesToRemove = chat.messages.slice(messageIndex + 1)
    messagesToRemove.forEach(msg => removeMessage(activeChatId, msg.id))

    // Send the updated message to get a new AI response
    void sendToAI(activeChatId)
  }

  const handleFork = (messageId: string, content: ContentPart[]) => {
    if (!activeChatId || isStreaming) return

    // Create fork with the edited message
    const forkedChatId = forkChat(activeChatId, messageId, content)

    if (forkedChatId) {
      toast.success('Created conversation fork')
      // Send the edited message to get AI response in the forked chat
      void sendToAI(forkedChatId)
    }
  }

  const handleTogglePin = (messageId: string) => {
    if (!activeChatId) return
    togglePinMessage(activeChatId, messageId)
  }

  const handleJumpToMessage = (chatId: string, messageId: string) => {
    // Switch to the chat if not already active
    if (chatId !== activeChatId) {
      setActiveChatId(chatId)
      // Wait for chat to switch and DOM to update
      setTimeout(() => {
        scrollToMessage(messageId)
      }, 100)
    } else {
      scrollToMessage(messageId)
    }
    // Close the pinned panel after jumping
    setIsPinnedPanelOpen(false)
  }

  const scrollToMessage = (messageId: string) => {
    const messageElement = messageRefsMap.current.get(messageId)
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Highlight the message briefly
      messageElement.classList.add('bg-accent/30')
      setTimeout(() => {
        messageElement.classList.remove('bg-accent/30')
      }, 2000)
    }
  }

  return (
    <div className="flex h-full bg-background">
      {/* Main Chat Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Header (hamburger menu) */}
        {isMobile && <MobileHeader onMenuClick={() => onToggleSidebar?.()} />}

        {activeChat ? (
          <>
            {/* Header with system prompt and pinned messages buttons */}
            <div className="flex h-14 items-center justify-end gap-2 border-b border-border/70 bg-background/85 px-4 backdrop-blur-xl">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPinnedPanelOpen(!isPinnedPanelOpen)}
                className="h-9 gap-1.5 rounded-xl px-3 text-sm"
              >
                <Pin className={`h-3.5 w-3.5 ${isPinnedPanelOpen ? 'fill-current' : ''}`} />
                Pinned
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSystemPromptDialogOpen(true)}
                className="h-9 gap-1.5 rounded-xl px-3 text-sm"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {activeChat.systemPrompt ? 'Custom System Prompt' : 'System Prompt'}
              </Button>
            </div>

            {/* Messages, Comparison View, or Title Variants */}
            {showComparisonView ? (
              <ComparisonView
                responses={comparisonResponses}
                onPromote={handlePromoteResponse}
                onClose={handleCloseComparisonView}
              />
            ) : showTitleVariants ? (
              <div className="flex-1 overflow-y-auto px-4 pb-6 pt-5 sm:px-6">
                <div className="mx-auto w-full max-w-5xl">
                  <TitleVariantsView
                    variants={titleVariants}
                    isGenerating={isGeneratingVariants}
                    onSelectVariant={handleSelectTitleVariant}
                    onClose={handleCloseTitleVariants}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-4 pb-8 pt-5 sm:px-6">
                <div className="mx-auto w-full max-w-[48rem] space-y-5">
                  {activeChat.messages.map((message, index) => {
                    const hasSubsequentMessages = index < activeChat.messages.length - 1
                    return (
                      <div
                        key={message.id}
                        ref={(el) => {
                          if (el) {
                            messageRefsMap.current.set(message.id, el)
                          } else {
                            messageRefsMap.current.delete(message.id)
                          }
                        }}
                        className="transition-colors duration-500"
                      >
                        <ChatMessage
                          message={message}
                          onRegenerate={message.role === 'assistant' ? () => handleRegenerate(message.id) : undefined}
                          onEdit={message.role === 'user' ? handleEdit : undefined}
                          onFork={message.role === 'user' ? handleFork : undefined}
                          onTogglePin={handleTogglePin}
                          onGenerateTitleVariants={message.role === 'assistant' ? handleGenerateTitleVariants : undefined}
                          hasSubsequentMessages={hasSubsequentMessages}
                          modelId={activeChat.model}
                        />
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            )}

            {/* Comparison mode selector */}
            <ComparisonModeSelector
              selectedModels={comparisonModels}
              onModelsChange={setComparisonModels}
              onClose={() => setIsComparisonMode(false)}
              isActive={isComparisonMode}
            />

            {/* Input — floats at bottom */}
            <div className="w-full px-4 pb-4 sm:px-6">
              <div className="mx-auto w-full max-w-[48rem]">
                <ChatInput
                  onSend={handleSend}
                  disabled={isStreaming}
                  isStreaming={isStreaming}
                  onStop={handleStop}
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
                  messages={activeChat.messages}
                  isComparisonMode={isComparisonMode}
                  onToggleComparisonMode={handleToggleComparisonMode}
                  onRegisterFocusInput={onRegisterFocusInput}
                />
              </div>
            </div>
          </>
        ) : (
          /* Welcome / empty state */
          <div className="flex-1 flex flex-col">
            <div className="flex flex-1 items-center justify-center px-6 py-10">
              <WelcomeScreen onSuggestion={handleSuggestion} />
            </div>
            <div className="w-full px-4 pb-4 sm:px-6">
              <div className="mx-auto w-full max-w-[48rem]">
                <ChatInput
                  onSend={handleWelcomeSend}
                  disabled={isStreaming}
                  isStreaming={isStreaming}
                  onStop={handleStop}
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
                  provider={defaultProvider}
                  model={defaultModel}
                  onProviderChange={() => {}}
                  onModelChange={() => {}}
                  isComparisonMode={isComparisonMode}
                  onToggleComparisonMode={handleToggleComparisonMode}
                  onRegisterFocusInput={onRegisterFocusInput}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Canvas — Side panel on desktop, modal on mobile */}
      {isMobile ? (
        /* Mobile: Canvas as Dialog/Modal */
        <Dialog open={isCanvasOpen} onOpenChange={setIsCanvasOpen}>
          <DialogContent className="max-w-[95vw] w-full h-[85vh] max-h-[85vh] p-0 flex flex-col">
            <CanvasPanel
              width={400}
              onWidthChange={() => {}}
              onClose={() => setIsCanvasOpen(false)}
            />
          </DialogContent>
        </Dialog>
      ) : (
        /* Desktop: Side panel */
        <>
          {/* Canvas reopen tab — visible only when panel is closed */}
          {!isCanvasOpen && (
            <button
              type="button"
              onClick={() => setIsCanvasOpen(true)}
              aria-label="Open canvas panel"
              className="flex w-8 self-stretch items-center justify-center border-l border-border/70 bg-background text-muted-foreground transition-colors duration-150 hover:bg-accent/60 hover:text-foreground"
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
        </>
      )}

      {/* Pinned Messages Panel */}
      {isPinnedPanelOpen && (
        <PinnedMessagesPanel
          chats={chats}
          activeChatId={activeChatId}
          onJumpToMessage={handleJumpToMessage}
          onUnpin={(chatId, messageId) => {
            togglePinMessage(chatId, messageId)
            toast.success('Message unpinned')
          }}
          onClose={() => setIsPinnedPanelOpen(false)}
        />
      )}

      {/* System Prompt Dialog */}
      {activeChat && (
        <SystemPromptDialog
          isOpen={isSystemPromptDialogOpen}
          onClose={() => setIsSystemPromptDialogOpen(false)}
          currentSystemPrompt={activeChat.systemPrompt}
          onSave={handleSystemPromptSave}
        />
      )}
    </div>
  )
}
