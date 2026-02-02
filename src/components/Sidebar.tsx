import { useState } from 'react'
import { Package, MessageSquare, Plus, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ToolId } from '../App'

interface SidebarProps {
  activeTool: ToolId
  onToolSelect: (tool: ToolId) => void
}

interface Tool {
  id: ToolId
  name: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  disabled?: boolean
}

const tools: Tool[] = [
  {
    id: 'packaging',
    name: 'Packaging',
    icon: Package,
    description: 'Generate titles, thumbnails & descriptions',
  },
  {
    id: 'chat',
    name: 'AI Chat',
    icon: MessageSquare,
    description: 'Chat with Claude or GPT',
  },
  {
    id: 'coming-soon',
    name: 'More Tools',
    icon: Plus,
    description: 'Coming soon...',
    disabled: true,
  },
]

const SIDEBAR_EXPANDED_KEY = 'yt-assist-sidebar-expanded'

export default function Sidebar({ activeTool, onToolSelect }: SidebarProps) {
  const [expanded, setExpanded] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_EXPANDED_KEY)
    return saved !== null ? JSON.parse(saved) : true
  })

  const toggleExpanded = () => {
    const newValue = !expanded
    setExpanded(newValue)
    localStorage.setItem(SIDEBAR_EXPANDED_KEY, JSON.stringify(newValue))
  }

  return (
    <aside
      className={cn(
        'flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200',
        expanded ? 'w-64' : 'w-16'
      )}
    >
      {/* Header */}
      <div className={cn(
        "h-12 flex items-center px-3 border-b border-sidebar-border",
        expanded ? "justify-between" : "justify-center"
      )}>
        {expanded && (
          <h1 className="text-lg font-bold text-foreground text-balance">YT-Assist</h1>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleExpanded}
          className="h-8 w-8"
          data-flow-name="sidebar-toggle"
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={expanded}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', !expanded && 'rotate-180')} />
        </Button>
      </div>

      {/* Tools list */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {tools.map((tool) => {
          const isActive = activeTool === tool.id
          const isDisabled = tool.disabled
          const Icon = tool.icon

          return (
            <Button
              key={tool.id}
              variant="ghost"
              onClick={() => !isDisabled && onToolSelect(tool.id)}
              disabled={isDisabled}
              data-flow-name={`tool-${tool.id}`}
              className={cn(
                'w-full justify-start gap-3 h-auto py-3',
                isActive && 'bg-accent text-accent-foreground',
                !isActive && !isDisabled && 'text-muted-foreground hover:text-foreground',
                isDisabled && 'opacity-50'
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {expanded && (
                <div className="text-left overflow-hidden flex-1">
                  <p className="font-medium text-sm truncate">{tool.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
                </div>
              )}
            </Button>
          )
        })}
      </nav>

      {/* Footer */}
      {expanded && (
        <div className="p-4 border-t border-sidebar-border">
          <p className="text-xs text-muted-foreground text-center">
            YouTube Helper Tools
          </p>
        </div>
      )}
    </aside>
  )
}
