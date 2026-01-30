import { useState, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import PackagingTool from './tools/packaging/PackagingTool'
import ChatPage from './chat/ChatPage'

export type ToolId = 'packaging' | 'chat' | 'coming-soon'

export interface ChatNavigationState {
  initialPrompt?: string
  promptId?: string // Unique ID to prevent duplicate processing
}

export default function App() {
  const [activeTool, setActiveTool] = useState<ToolId>('packaging')
  const [chatState, setChatState] = useState<ChatNavigationState>({})

  const handleNavigateToChat = useCallback((prompt?: string) => {
    // Generate unique ID for this prompt to prevent duplicates
    const promptId = prompt ? `${Date.now()}-${Math.random()}` : undefined
    setChatState({ initialPrompt: prompt, promptId })
    setActiveTool('chat')
  }, [])

  const clearInitialPrompt = useCallback(() => {
    setChatState({})
  }, [])

  const handleToolSelect = (tool: ToolId) => {
    if (tool !== 'chat') {
      setChatState({}) // Clear chat state when switching away
    }
    setActiveTool(tool)
  }

  const renderTool = () => {
    switch (activeTool) {
      case 'packaging':
        return <PackagingTool onSendToChat={handleNavigateToChat} />
      case 'chat':
        return (
          <ChatPage
            initialPrompt={chatState.initialPrompt}
            promptId={chatState.promptId}
            onPromptProcessed={clearInitialPrompt}
          />
        )
      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>More tools coming soon...</p>
          </div>
        )
    }
  }

  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar activeTool={activeTool} onToolSelect={handleToolSelect} />
      <main className="flex-1 overflow-hidden">
        {renderTool()}
      </main>
    </div>
  )
}
