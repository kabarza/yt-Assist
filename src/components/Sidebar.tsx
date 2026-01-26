import { useState } from 'react'
import type { ToolId } from '../App'

interface SidebarProps {
  activeTool: ToolId
  onToolSelect: (tool: ToolId) => void
}

interface Tool {
  id: ToolId
  name: string
  icon: React.ReactNode
  description: string
  disabled?: boolean
}

const PackageIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
)

const ChatIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
)

const MoreIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
)

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg 
    className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
)

const tools: Tool[] = [
  {
    id: 'packaging',
    name: 'Packaging',
    icon: <PackageIcon />,
    description: 'Generate titles, thumbnails & descriptions',
  },
  {
    id: 'chat',
    name: 'AI Chat',
    icon: <ChatIcon />,
    description: 'Chat with Claude or GPT',
  },
  {
    id: 'coming-soon',
    name: 'More Tools',
    icon: <MoreIcon />,
    description: 'Coming soon...',
    disabled: true,
  },
]

export default function Sidebar({ activeTool, onToolSelect }: SidebarProps) {
  const [expanded, setExpanded] = useState(true)

  return (
    <aside 
      className={`
        flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-300
        ${expanded ? 'w-64' : 'w-16'}
      `}
    >
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-gray-800">
        {expanded && (
          <h1 className="text-lg font-bold text-lime-500">YT-Assist</h1>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
          data-flow-name="sidebar-toggle"
        >
          <ChevronIcon expanded={expanded} />
        </button>
      </div>

      {/* Tools list */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {tools.map((tool) => {
          const isActive = activeTool === tool.id
          const isDisabled = tool.disabled
          
          return (
            <button
              key={tool.id}
              onClick={() => !isDisabled && onToolSelect(tool.id)}
              disabled={isDisabled}
              data-flow-name={`tool-${tool.id}`}
              className={`
                w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all
                ${isActive 
                  ? 'bg-lime-500/10 text-lime-500 border border-lime-500/30' 
                  : isDisabled
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }
              `}
            >
              <span className="flex-shrink-0">{tool.icon}</span>
              {expanded && (
                <div className="text-left overflow-hidden">
                  <p className="font-medium text-sm truncate">{tool.name}</p>
                  <p className="text-xs text-gray-500 truncate">{tool.description}</p>
                </div>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      {expanded && (
        <div className="p-4 border-t border-gray-800">
          <p className="text-xs text-gray-600 text-center">
            YouTube Helper Tools
          </p>
        </div>
      )}
    </aside>
  )
}
