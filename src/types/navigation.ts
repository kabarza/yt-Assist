import type { ComponentType } from 'react'

export type ToolId = 'packaging' | 'chat' | 'images' | 'comments' | 'script' | 'canvasLab'

export type ToolPanelKind = 'none' | 'chat'

export interface ToolDefinition {
  id: ToolId
  label: string
  shortLabel: string
  path: string
  description: string
  shortcut: string
  panelKind: ToolPanelKind
  panelDefaultOpen?: boolean
  icon: ComponentType<{ className?: string }>
}

export interface ShellNavigationState {
  desktopPanelOpenByTool: Partial<Record<ToolId, boolean>>
  mobileNavigationOpen: boolean
}
