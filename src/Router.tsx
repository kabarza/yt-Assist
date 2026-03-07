import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate, useLocation } from 'react-router-dom'
import App from './App'
import type { ToolId } from './App'
import { useChatStore } from './stores/chatStore'

/**
 * Route wrapper component that syncs URL with app state
 */
function RouteSync() {
  const { chatId } = useParams<{ chatId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { chats, activeChatId, setActiveChatId } = useChatStore()

  // Determine active tool from URL
  const getToolFromPath = (pathname: string): ToolId => {
    if (pathname.startsWith('/chat')) return 'chat'
    if (pathname === '/packaging') return 'packaging'
    if (pathname === '/comments') return 'comments'
    return 'packaging' // default
  }

  // Sync URL params with chat store
  useEffect(() => {
    if (!chatId) return

    const chatExists = chats.some(c => c.id === chatId)
    if (chatExists) {
      if (chatId !== activeChatId) {
        setActiveChatId(chatId)
      }
    } else {
      navigate('/', { replace: true })
    }
  }, [chatId, activeChatId, chats, setActiveChatId, navigate])

  useEffect(() => {
    if (location.pathname === '/chat') {
      setActiveChatId(null)
    }
  }, [location.pathname, setActiveChatId])

  // Update document title based on route
  useEffect(() => {
    const pathname = location.pathname
    const activeChat = chats.find(c => c.id === activeChatId)

    if (pathname.startsWith('/chat') && activeChat) {
      document.title = `${activeChat.title} - YT Assist`
    } else if (pathname === '/packaging') {
      document.title = 'Packaging Tool - YT Assist'
    } else if (pathname === '/comments') {
      document.title = 'Comment Replies - YT Assist'
    } else {
      document.title = 'YT Assist - YouTube Helper Tools'
    }
  }, [location.pathname, activeChatId, chats])

  const activeTool = getToolFromPath(location.pathname)

  return (
    <App
      activeTool={activeTool}
      onToolChange={(tool) => {
        const currentPath = location.pathname
        // Avoid redundant navigation if already on the correct route
        if (tool === 'chat') {
          const targetPath = activeChatId ? `/chat/${activeChatId}` : '/chat'
          if (currentPath !== targetPath) {
            navigate(targetPath)
          }
        } else if (tool === 'packaging' && currentPath !== '/packaging') {
          navigate('/packaging')
        } else if (tool === 'comments' && currentPath !== '/comments') {
          navigate('/comments')
        }
      }}
      onChatChange={(newChatId) => {
        if (newChatId) {
          navigate(`/chat/${newChatId}`)
        } else {
          navigate('/')
        }
      }}
    />
  )
}

/**
 * Main router component
 * Handles URL-based routing for the app
 */
export default function Router() {
  const { chats, activeChatId } = useChatStore()

  return (
    <BrowserRouter>
      <Routes>
        {/* Home - redirect to last active chat or packaging tool */}
        <Route
          path="/"
          element={
            activeChatId && chats.some(c => c.id === activeChatId) ? (
              <Navigate to={`/chat/${activeChatId}`} replace />
            ) : (
              <Navigate to="/packaging" replace />
            )
          }
        />

        {/* Chat routes */}
        <Route path="/chat" element={<RouteSync />} />
        <Route path="/chat/:chatId" element={<RouteSync />} />

        {/* Tool routes */}
        <Route path="/packaging" element={<RouteSync />} />
        <Route path="/comments" element={<RouteSync />} />

        {/* Catch-all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
