import type { ToolDefinition, ToolId } from '@/types/navigation'

function PackagingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3.75 6.75L7.5 2.25h9l3.75 4.5M3.75 6.75L5.25 21h13.5l1.5-14.25M3.75 6.75h16.5M8.25 6.75V4.5A.75.75 0 019 3.75h6a.75.75 0 01.75.75v2.25"
      />
    </svg>
  )
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  )
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 7.5A2.5 2.5 0 016.5 5h11A2.5 2.5 0 0120 7.5v9a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 16.5v-9z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14l2.5-3 2.5 3 2-2.5L18 15M9 9.25h.01" />
    </svg>
  )
}

function CommentsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
      />
    </svg>
  )
}

function ScriptIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  )
}

export const TOOL_REGISTRY: ToolDefinition[] = [
  {
    id: 'packaging',
    label: 'Packaging',
    shortLabel: 'Pack',
    path: '/packaging',
    description: 'Titles, thumbnails, descriptions, and strategy',
    shortcut: 'mod+1',
    panelKind: 'none',
    icon: PackagingIcon,
  },
  {
    id: 'chat',
    label: 'AI Chat',
    shortLabel: 'Chat',
    path: '/chat',
    description: 'Conversations, prompts, images, and follow-up work',
    shortcut: 'mod+2',
    panelKind: 'chat',
    panelDefaultOpen: true,
    icon: ChatIcon,
  },
  {
    id: 'images',
    label: 'Image Gen',
    shortLabel: 'Images',
    path: '/images',
    description: 'Generate reference-driven visuals and variations',
    shortcut: 'mod+3',
    panelKind: 'none',
    icon: ImageIcon,
  },
  {
    id: 'comments',
    label: 'Comments',
    shortLabel: 'Replies',
    path: '/comments',
    description: 'Draft comment replies in multiple creator tones',
    shortcut: 'mod+4',
    panelKind: 'none',
    icon: CommentsIcon,
  },
  {
    id: 'script',
    label: 'Script Writer',
    shortLabel: 'Script',
    path: '/script',
    description: 'Write structured video scripts with scene timing',
    shortcut: 'mod+5',
    panelKind: 'none',
    icon: ScriptIcon,
  },
]

export const TOOL_REGISTRY_BY_ID = Object.fromEntries(
  TOOL_REGISTRY.map((tool) => [tool.id, tool]),
) as Record<ToolId, ToolDefinition>

export function getToolById(toolId: ToolId) {
  return TOOL_REGISTRY_BY_ID[toolId]
}

export function getToolByPathname(pathname: string): ToolDefinition {
  if (pathname.startsWith('/chat')) return TOOL_REGISTRY_BY_ID.chat
  if (pathname.startsWith('/images')) return TOOL_REGISTRY_BY_ID.images
  if (pathname.startsWith('/comments')) return TOOL_REGISTRY_BY_ID.comments
  if (pathname.startsWith('/script')) return TOOL_REGISTRY_BY_ID.script
  return TOOL_REGISTRY_BY_ID.packaging
}
