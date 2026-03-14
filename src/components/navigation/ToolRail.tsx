import { Settings, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { TOOL_REGISTRY } from '@/navigation/tools'
import type { ToolId } from '@/types/navigation'
import ThemeToggle from '@/components/ThemeToggle'
import { formatShortcut } from '@/utils/keyboard'

const TOOL_BUTTON_BASE_CLASS =
  'group relative isolate flex h-11 w-full cursor-pointer items-center justify-center overflow-hidden rounded-[1.1rem] border border-transparent text-sidebar-foreground/64 transition-[background-color,color,border-color,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar'

const TOOL_BUTTON_ACTIVE_CLASS =
  'border-sidebar-border/80 bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_22px_rgba(0,0,0,0.14)] hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'

const TOOL_BUTTON_IDLE_CLASS =
  'bg-transparent hover:border-sidebar-border/55 hover:bg-sidebar-accent/72 hover:text-sidebar-foreground'

interface ToolRailProps {
  activeToolId: ToolId
  getToolHref: (toolId: ToolId) => string
  onActiveToolToggle: () => void
  onOpenSettings: (origin: { left: number; top: number; width: number; height: number }) => void
}

export function ToolRail({
  activeToolId,
  getToolHref,
  onActiveToolToggle,
  onOpenSettings,
}: ToolRailProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <aside className="hidden w-[3.75rem] shrink-0 flex-col border-r border-sidebar-border/70 bg-sidebar shadow-[inset_-1px_0_0_hsl(var(--border)/0.12)] md:flex">
        <div className="flex h-[4.25rem] shrink-0 items-center justify-center px-3">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-[0.9rem] border border-border/45 bg-background/45 text-[11px] font-semibold tracking-[0.22em] text-foreground/72"
          >
            YT
          </div>
        </div>

        <nav className="flex flex-1 flex-col items-center gap-3 px-2 py-2">
          {TOOL_REGISTRY.map((tool) => {
            const Icon = tool.icon
            const isToolActive = activeToolId === tool.id
            return (
              <Tooltip key={tool.id}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={getToolHref(tool.id)}
                    end={tool.id !== 'chat'}
                    onClick={(event) => {
                      if (activeToolId === tool.id && tool.panelKind !== 'none') {
                        event.preventDefault()
                        onActiveToolToggle()
                      }
                    }}
                    className={cn(
                      TOOL_BUTTON_BASE_CLASS,
                      isToolActive
                        ? TOOL_BUTTON_ACTIVE_CLASS
                        : TOOL_BUTTON_IDLE_CLASS,
                    )}
                    aria-label={tool.label}
                    aria-current={isToolActive ? 'page' : undefined}
                  >
                    <Icon className="relative z-10 h-[15px] w-[15px]" />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  <div className="space-y-0.5">
                    <p className="text-[13px] font-medium text-foreground">{tool.label}</p>
                    <p className="text-[11px] text-muted-foreground">{formatShortcut(tool.shortcut)}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

        <div className="mx-auto h-px w-7 bg-border/45" />

        <div className="flex flex-col items-center gap-2.5 px-2 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-[2.125rem] w-[2.125rem] rounded-[0.9rem] border border-transparent text-muted-foreground hover:border-border/35 hover:bg-foreground/[0.04] hover:text-foreground/88"
            onClick={(event) => onOpenSettings(event.currentTarget.getBoundingClientRect())}
            aria-label="Open settings"
          >
            <Settings className="h-[15px] w-[15px]" />
          </Button>
          <div className="[&_button]:h-[2.125rem] [&_button]:w-[2.125rem] [&_button]:rounded-[0.9rem] [&_button]:border [&_button]:border-transparent [&_button]:bg-transparent [&_button]:text-muted-foreground [&_button]:transition-[background-color,color,border-color] [&_button]:hover:border-border/35 [&_button]:hover:bg-foreground/[0.04] [&_button]:hover:text-foreground/88">
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </TooltipProvider>
  )
}

interface MobileNavigationDrawerProps {
  activeToolId: ToolId
  getToolHref: (toolId: ToolId) => string
  isOpen: boolean
  onClose: () => void
  onOpenSettings: (origin: { left: number; top: number; width: number; height: number }) => void
  children?: ReactNode
}

export function MobileNavigationDrawer({
  activeToolId,
  getToolHref,
  isOpen,
  onClose,
  onOpenSettings,
  children,
}: MobileNavigationDrawerProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close navigation menu"
      />
      <div className="absolute inset-y-0 left-0 flex w-[min(92vw,24rem)] flex-col border-r border-border/70 bg-sidebar shadow-2xl">
        <div className="flex h-16 items-center justify-between border-b border-border/60 px-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Workspace</p>
            <h2 className="text-base font-semibold tracking-tight text-foreground">YT-Assist</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-2xl"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="border-b border-border/60 px-3 py-3">
          <nav className="space-y-1.5">
            {TOOL_REGISTRY.map((tool) => {
              const Icon = tool.icon
              const isActive = activeToolId === tool.id
              return (
                <NavLink
                  key={tool.id}
                  to={getToolHref(tool.id)}
                  end={tool.id !== 'chat'}
                  onClick={onClose}
                  className={cn(
                    'relative flex items-start gap-3 overflow-hidden rounded-[1rem] border border-transparent px-3.5 py-3 text-muted-foreground transition-[background-color,color,border-color]',
                    isActive
                      ? "border-border/55 bg-foreground/[0.05] text-muted-foreground before:absolute before:bottom-3 before:left-2 before:top-3 before:w-[2px] before:rounded-full before:bg-foreground/38 before:content-['']"
                      : 'text-muted-foreground hover:border-border/35 hover:bg-foreground/[0.04] hover:text-foreground',
                  )}
                >
                  <div className={cn(
                    'mt-0.5 flex h-9 w-9 items-center justify-center rounded-[0.9rem] border border-transparent',
                    isActive
                      ? 'border-border/45 bg-background/68 text-muted-foreground'
                      : 'bg-background/55 text-foreground/84',
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{tool.label}</span>
                      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        {formatShortcut(tool.shortcut)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{tool.description}</p>
                  </div>
                </NavLink>
              )
            })}
          </nav>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
          <Button
            variant="outline"
            className="rounded-[0.9rem] bg-background/60"
            onClick={(event) => onOpenSettings(event.currentTarget.getBoundingClientRect())}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
