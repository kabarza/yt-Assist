import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import SettingsDialog from '@/components/SettingsDialog'
import { AppShellProvider, type PendingChatNavigation } from '@/components/layout/AppShellContext'
import { ChatContextPanel } from '@/components/navigation/ChatContextPanel'
import { MobileNavigationDrawer, ToolRail } from '@/components/navigation/ToolRail'
import OfflineIndicator from '@/components/OfflineIndicator'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { getToolById, getToolByPathname, TOOL_REGISTRY } from '@/navigation/tools'
import { useChatStore } from '@/stores/chatStore'
import { useNavigationStore } from '@/stores/navigationStore'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import type { ToolId } from '@/types/navigation'

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const activeTool = getToolByPathname(location.pathname)

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsTriggerOrigin, setSettingsTriggerOrigin] = useState<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)
  const [pendingChatNavigation, setPendingChatNavigation] = useState<PendingChatNavigation>({})

  const focusSearchRef = useRef<(() => void) | null>(null)
  const focusInputRef = useRef<(() => void) | null>(null)

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
    setTitle,
  } = useChatStore()

  const {
    desktopPanelOpenByTool,
    mobileNavigationOpen,
    setDesktopPanelOpen,
    toggleDesktopPanel,
    openMobileNavigation,
    closeMobileNavigation,
    setMobileNavigationOpen,
  } = useNavigationStore()

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? null,
    [activeChatId, chats],
  )

  const isContextPanelOpen =
    activeTool.panelKind !== 'none' &&
    (desktopPanelOpenByTool[activeTool.id] ?? activeTool.panelDefaultOpen ?? false)

  const getToolHref = useCallback(
    (toolId: ToolId) => {
      if (toolId === 'chat') {
        return activeChatId ? `/chat/${activeChatId}` : '/chat'
      }

      return getToolById(toolId).path
    },
    [activeChatId],
  )

  const selectTool = useCallback(
    (toolId: ToolId) => {
      setPendingChatNavigation({})
      navigate(getToolHref(toolId))
    },
    [getToolHref, navigate],
  )

  const openChat = useCallback(
    (chatId: string) => {
      setPendingChatNavigation({})
      setActiveChatId(chatId)
      closeMobileNavigation()
      navigate(`/chat/${chatId}`)
    },
    [closeMobileNavigation, navigate, setActiveChatId],
  )

  const createNewChat = useCallback(() => {
    const chatId = createChat()
    setPendingChatNavigation({})
    closeMobileNavigation()
    navigate(`/chat/${chatId}`)
  }, [closeMobileNavigation, createChat, navigate])

  const navigateToChat = useCallback(
    (prompt?: string) => {
      if (!prompt) {
        setPendingChatNavigation({})
        closeMobileNavigation()
        navigate(activeChatId ? `/chat/${activeChatId}` : '/chat')
        return
      }

      const chatId = createChat(undefined, prompt)
      const promptId = `${Date.now()}-${Math.random()}`
      setPendingChatNavigation({ chatId, promptId })
      closeMobileNavigation()
      navigate(`/chat/${chatId}`)
    },
    [activeChatId, closeMobileNavigation, createChat, navigate],
  )

  const clearPendingChatNavigation = useCallback(() => {
    setPendingChatNavigation({})
  }, [])

  const registerSearchFocus = useCallback((focusFn: (() => void) | null) => {
    focusSearchRef.current = focusFn
  }, [])

  const registerInputFocus = useCallback((focusFn: (() => void) | null) => {
    focusInputRef.current = focusFn
  }, [])

  const focusContextSearch = useCallback(() => {
    if (activeTool.panelKind === 'none') return

    if (activeTool.panelKind === 'chat' && !isMobile && !isContextPanelOpen) {
      setDesktopPanelOpen(activeTool.id, true)
      requestAnimationFrame(() => {
        focusSearchRef.current?.()
      })
      return
    }

    if (isMobile) {
      openMobileNavigation()
      requestAnimationFrame(() => {
        focusSearchRef.current?.()
      })
      return
    }

    focusSearchRef.current?.()
  }, [
    activeTool.id,
    activeTool.panelKind,
    isContextPanelOpen,
    isMobile,
    openMobileNavigation,
    setDesktopPanelOpen,
  ])

  const toggleContextPanel = useCallback(() => {
    if (isMobile) {
      setMobileNavigationOpen(!mobileNavigationOpen)
      return
    }

    if (activeTool.panelKind === 'none') return

    toggleDesktopPanel(activeTool.id, activeTool.panelDefaultOpen)
  }, [
    activeTool.id,
    activeTool.panelDefaultOpen,
    activeTool.panelKind,
    isMobile,
    mobileNavigationOpen,
    setMobileNavigationOpen,
    toggleDesktopPanel,
  ])

  useEffect(() => {
    closeMobileNavigation()
  }, [closeMobileNavigation, location.pathname, location.search])

  useEffect(() => {
    if (location.pathname.startsWith('/chat') && activeChat) {
      document.title = `${activeChat.title} - YT Assist`
      return
    }

    document.title = `${activeTool.label} - YT Assist`
  }, [activeChat, activeTool.label, location.pathname])

  useKeyboardShortcuts({
    onNewChat: createNewChat,
    onTogglePanel: toggleContextPanel,
    onFocusInput: activeTool.id === 'chat' ? () => focusInputRef.current?.() : undefined,
    onFocusSearch: activeTool.id === 'chat' ? focusContextSearch : undefined,
    onSelectTool: selectTool,
    toolShortcuts: TOOL_REGISTRY.map(({ id, shortcut }) => ({ toolId: id, shortcut })),
  })

  useOfflineSync()

  const appShellValue = useMemo(
    () => ({
      activeTool,
      isContextPanelOpen,
      openMobileNavigation,
      closeMobileNavigation,
      toggleContextPanel,
      openChat,
      createNewChat,
      navigateToChat,
      registerSearchFocus,
      registerInputFocus,
      focusContextSearch,
      pendingChatNavigation,
      clearPendingChatNavigation,
    }),
    [
      activeTool,
      clearPendingChatNavigation,
      closeMobileNavigation,
      createNewChat,
      focusContextSearch,
      isContextPanelOpen,
      navigateToChat,
      openChat,
      openMobileNavigation,
      pendingChatNavigation,
      registerInputFocus,
      registerSearchFocus,
      toggleContextPanel,
    ],
  )

  return (
    <AppShellProvider value={appShellValue}>
      <div className="flex h-dvh overflow-hidden bg-background text-foreground">
        <OfflineIndicator />

        <ToolRail
          activeToolId={activeTool.id}
          getToolHref={getToolHref}
          onActiveToolToggle={toggleContextPanel}
          onOpenSettings={(origin) => {
            setSettingsTriggerOrigin(origin)
            setIsSettingsOpen(true)
          }}
        />

        {activeTool.panelKind === 'chat' && isContextPanelOpen ? (
          <aside className="relative z-10 hidden w-64 shrink-0 overflow-hidden border-r border-sidebar-border/70 bg-sidebar md:flex">
            <ChatContextPanel
              chats={chats}
              folders={folders}
              activeChatId={activeChatId}
              onSelectChat={openChat}
              onNewChat={createNewChat}
              onDeleteChat={deleteChat}
              onRenameChat={setTitle}
              onCreateFolder={createFolder}
              onRenameFolder={renameFolder}
              onDeleteFolder={deleteFolder}
              onMoveToFolder={moveToFolder}
              onRegisterSearchFocus={registerSearchFocus}
            />
          </aside>
        ) : null}

        <main className="min-w-0 flex-1 overflow-hidden bg-background">
          <Outlet />
        </main>

        <MobileNavigationDrawer
          activeToolId={activeTool.id}
          getToolHref={getToolHref}
          isOpen={mobileNavigationOpen}
          onClose={closeMobileNavigation}
          onOpenSettings={(origin) => {
            setSettingsTriggerOrigin(origin)
            setIsSettingsOpen(true)
          }}
        >
          {activeTool.panelKind === 'chat' ? (
            <div className="h-full border-t border-border/60">
              <ChatContextPanel
                chats={chats}
                folders={folders}
                activeChatId={activeChatId}
                onSelectChat={openChat}
                onNewChat={createNewChat}
                onDeleteChat={deleteChat}
                onRenameChat={setTitle}
                onCreateFolder={createFolder}
                onRenameFolder={renameFolder}
                onDeleteFolder={deleteFolder}
                onMoveToFolder={moveToFolder}
                onRegisterSearchFocus={registerSearchFocus}
                mode="mobile"
              />
            </div>
          ) : null}
        </MobileNavigationDrawer>

        <SettingsDialog
          isOpen={isSettingsOpen}
          onClose={() => {
            setIsSettingsOpen(false)
            setSettingsTriggerOrigin(null)
          }}
          triggerOrigin={settingsTriggerOrigin}
        />
        <Toaster position="top-right" richColors />
      </div>
    </AppShellProvider>
  )
}
