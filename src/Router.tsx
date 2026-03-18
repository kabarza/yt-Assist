import { useEffect } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom'
import App from './App'
import ChatPage from './chat/ChatPage'
import { useAppShell } from './components/layout/AppShellContext'
import { useChatStore } from './stores/chatStore'
import CommentRepliesTool from './tools/comments/CommentRepliesTool'
import CanvasLabTool from './tools/canvas-lab/CanvasLabTool'
import ImageGenerationTool from './tools/images/ImageGenerationTool'
import PackagingTool from './tools/packaging/PackagingTool'
import VideoScriptTool from './tools/script/VideoScriptTool'

function HomeRedirect() {
  const { chats, activeChatId } = useChatStore()

  if (activeChatId && chats.some((chat) => chat.id === activeChatId)) {
    return <Navigate to={`/chat/${activeChatId}`} replace />
  }

  return <Navigate to="/packaging" replace />
}

function PackagingRoute() {
  const { navigateToChat } = useAppShell()
  return <PackagingTool onSendToChat={navigateToChat} />
}

function ChatRoute() {
  const { chatId } = useParams<{ chatId: string }>()
  const navigate = useNavigate()
  const { chats, activeChatId, setActiveChatId } = useChatStore()
  const {
    clearPendingChatNavigation,
    openChat,
    pendingChatNavigation,
    registerInputFocus,
  } = useAppShell()

  useEffect(() => {
    if (!chatId) {
      setActiveChatId(null)
      return
    }

    const chatExists = chats.some((chat) => chat.id === chatId)
    if (!chatExists) {
      navigate('/chat', { replace: true })
      return
    }

    if (chatId !== activeChatId) {
      setActiveChatId(chatId)
    }
  }, [activeChatId, chatId, chats, navigate, setActiveChatId])

  return (
    <ChatPage
      initialChatId={pendingChatNavigation.chatId}
      promptId={pendingChatNavigation.promptId}
      onPromptProcessed={clearPendingChatNavigation}
      onSelectChat={openChat}
      onRegisterFocusInput={registerInputFocus}
    />
  )
}

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<HomeRedirect />} />
          <Route path="packaging" element={<PackagingRoute />} />
          <Route path="images" element={<ImageGenerationTool />} />
          <Route path="comments" element={<CommentRepliesTool />} />
          <Route path="script" element={<VideoScriptTool />} />
          <Route path="canvas-lab" element={<CanvasLabTool />} />
          <Route path="chat" element={<ChatRoute />} />
          <Route path="chat/:chatId" element={<ChatRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
