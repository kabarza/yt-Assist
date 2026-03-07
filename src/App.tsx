import { useState, useCallback, useRef, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import PackagingTool from './tools/packaging/PackagingTool'
import CommentRepliesTool from './tools/comments/CommentRepliesTool'
import VideoScriptTool from './tools/script/VideoScriptTool'
import ChatPage from './chat/ChatPage'
import { useChatStore } from './stores/chatStore'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useOfflineSync } from './hooks/useOfflineSync'
import OfflineIndicator from './components/OfflineIndicator'
import { Toaster } from 'sonner'

export type ToolId = 'packaging' | 'comments' | 'script' | 'chat' | 'coming-soon'

export interface ChatNavigationState {
  chatId?: string
  promptId?: string
}

export interface AppProps {
  activeTool?: ToolId
  onToolChange?: (tool: ToolId) => void
  onChatChange?: (chatId: string | null) => void
}

export default function App({ activeTool: activeToolProp, onToolChange, onChatChange }: AppProps = {}) {
  const [activeTool, setActiveTool] = useState<ToolId>(activeToolProp || 'packaging')
  const [chatState, setChatState] = useState<ChatNavigationState>({})
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    const saved = localStorage.getItem('yt-assist-sidebar-expanded')
    return saved !== null ? JSON.parse(saved) : true
  })
  const focusInputRef = useRef<(() => void) | null>(null)
  const focusSearchRef = useRef<(() => void) | null>(null)

  // Sync activeTool with prop
  useEffect(() => {
    if (activeToolProp && activeToolProp !== activeTool) {
      setActiveTool(activeToolProp)
    }
  }, [activeToolProp])

  const {
    chats,
    folders,
    activeChatId,
    setActiveChatId,
    createChat,
    deleteChat,
    createFolder,
    renameFolder,
    deleteFolder,
    moveToFolder,
  } = useChatStore()

  const handleNavigateToChat = useCallback((prompt?: string) => {
    if (!prompt) {
      setChatState({})
      setActiveTool('chat')
      onToolChange?.('chat')
      return
    }

    const chatId = createChat(undefined, prompt)
    const promptId = `${Date.now()}-${Math.random()}`
    setChatState({ chatId, promptId })
    setActiveTool('chat')
    onChatChange?.(chatId)
  }, [createChat, onChatChange, onToolChange])

  const clearInitialPrompt = useCallback(() => {
    setChatState({})
  }, [])

  const handleToolSelect = (tool: ToolId) => {
    if (tool !== 'chat') {
      setChatState({})
    }
    setActiveTool(tool)
    onToolChange?.(tool)
  }

  const handleNewChat = () => {
    const newChatId = createChat()
    setActiveTool('chat')
    onToolChange?.('chat')
    onChatChange?.(newChatId)
  }

  // Notify parent when active chat changes
  useEffect(() => {
    if (activeChatId) {
      onChatChange?.(activeChatId)
    }
  }, [activeChatId, onChatChange])

  const handleToggleSidebar = () => {
    setSidebarExpanded((prev: boolean) => {
      const next = !prev
      localStorage.setItem('yt-assist-sidebar-expanded', JSON.stringify(next))
      return next
    })
  }

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewChat: handleNewChat,
    onToggleSidebar: handleToggleSidebar,
    onFocusInput: () => focusInputRef.current?.(),
    onFocusSearch: () => focusSearchRef.current?.(),
    onSwitchToPackaging: () => handleToolSelect('packaging'),
    onSwitchToChat: () => handleToolSelect('chat'),
  })

  // Offline sync - handles queue processing and status notifications
  useOfflineSync()

  const renderTool = () => {
    switch (activeTool) {
      case 'packaging':
        return <PackagingTool onSendToChat={handleNavigateToChat} />
      case 'comments':
        return <CommentRepliesTool />
      case 'script':
        return <VideoScriptTool />
      case 'chat':
        return (
          <ChatPage
            initialChatId={chatState.chatId}
            promptId={chatState.promptId}
            onPromptProcessed={clearInitialPrompt}
            onRegisterFocusInput={(focusFn) => {
              focusInputRef.current = focusFn
            }}
            onToggleSidebar={handleToggleSidebar}
          />
        )
      default:
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>More tools coming soon...</p>
          </div>
        )
    }
  }

  return (
    <div className="flex h-dvh bg-background">
      <OfflineIndicator />
      <Sidebar
        activeTool={activeTool}
        onToolSelect={handleToolSelect}
        chats={chats}
        folders={folders}
        activeChatId={activeChatId}
        onSelectChat={(chatId) => {
          setActiveChatId(chatId)
          onChatChange?.(chatId)
        }}
        onNewChat={handleNewChat}
        onDeleteChat={deleteChat}
        onCreateFolder={createFolder}
        onRenameFolder={renameFolder}
        onDeleteFolder={deleteFolder}
        onMoveToFolder={moveToFolder}
        expanded={sidebarExpanded}
        onToggle={handleToggleSidebar}
        onRegisterSearchFocus={(focusFn) => {
          focusSearchRef.current = focusFn
        }}
      />
      <main className="flex-1 overflow-hidden">
        {renderTool()}
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
