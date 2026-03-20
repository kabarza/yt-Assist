import { Component, type ErrorInfo, type ReactNode, type WheelEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  ConnectionLineType,
  PanOnScrollMode,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Boxes, Check, ChevronDown, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ToolBody, ToolShell } from '@/components/layout/ToolShell'
import ComposeStage from '@/tools/canvas-lab/ComposeStage'
import CanvasLabNode from '@/tools/canvas-lab/CanvasLabNode'
import {
  useActiveCanvasWorkspace,
  useCanvasLabStore,
  useCanvasNode,
  useCanvasNodeLatestRun,
  useCanvasNodeThread,
} from '@/stores/canvasLabStore'

const nodeTypes = {
  canvasLabNode: CanvasLabNode,
}

const CANVAS_EDGE_STYLE = {
  stroke: 'var(--foreground)',
  strokeWidth: 1.65,
  opacity: 0.28,
}

const CANVAS_CONNECTION_LINE_STYLE = {
  stroke: 'var(--foreground)',
  strokeWidth: 1.65,
  opacity: 0.45,
}

const MANUAL_NODE_OPTIONS = [
  { kind: 'prompt_builder', label: 'Prompt Builder' },
  { kind: 'chat', label: 'Chat' },
  { kind: 'image_prompt', label: 'Image Prompt' },
  { kind: 'image_generate', label: 'Image Gen' },
  { kind: 'asset_library', label: 'Asset Library' },
  { kind: 'compose', label: 'Compose' },
] as const

class CanvasLabErrorBoundary extends Component<
  { children: ReactNode },
  { errorMessage: string | null }
> {
  state = {
    errorMessage: null,
  }

  static getDerivedStateFromError(error: Error) {
    return {
      errorMessage: error.message || 'Canvas Lab hit a render error.',
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Canvas Lab render error', error, errorInfo)
  }

  render() {
    if (this.state.errorMessage) {
      return (
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="max-w-lg rounded-[1.5rem] border border-destructive/30 bg-card/95 p-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[1rem] border border-destructive/20 bg-destructive/10">
              <Boxes className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Canvas Lab crashed while rendering</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {this.state.errorMessage}
            </p>
            <div className="mt-5 flex justify-center">
              <Button
                type="button"
                variant="outline"
                className="rounded-[0.95rem]"
                onClick={() => window.location.reload()}
              >
                Reload canvas
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function CanvasFlowSurface() {
  const workspace = useActiveCanvasWorkspace()
  const applyFlowNodeChanges = useCanvasLabStore((state) => state.applyFlowNodeChanges)
  const applyFlowEdgeChanges = useCanvasLabStore((state) => state.applyFlowEdgeChanges)
  const connectNodes = useCanvasLabStore((state) => state.connectNodes)
  const addNode = useCanvasLabStore((state) => state.addNode)
  const executeNode = useCanvasLabStore((state) => state.executeNode)
  const duplicateNode = useCanvasLabStore((state) => state.duplicateNode)
  const disconnectNode = useCanvasLabStore((state) => state.disconnectNode)
  const deleteNode = useCanvasLabStore((state) => state.deleteNode)
  const setSelectedNodeId = useCanvasLabStore((state) => state.setSelectedNodeId)
  const setOpenComposeNodeId = useCanvasLabStore((state) => state.setOpenComposeNodeId)
  const setOpenDebugNodeId = useCanvasLabStore((state) => state.setOpenDebugNodeId)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<
    | null
    | { type: 'pane'; x: number; y: number }
    | { type: 'node'; x: number; y: number; nodeId: string }
  >(null)

  const nodes = useMemo(
    () =>
      (workspace?.nodes || []).map((node) => ({
        id: node.id,
        type: 'canvasLabNode',
        position: node.position,
        data: {
          nodeId: node.id,
        },
      })),
    [workspace],
  )

  const edges = useMemo(
    () =>
      (workspace?.edges || []).map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'default',
        style: CANVAS_EDGE_STYLE,
        pathOptions: {
          curvature: 0.42,
        },
      })),
    [workspace],
  )

  if (!workspace) {
    return null
  }

  const contextNode =
    contextMenu?.type === 'node'
      ? workspace.nodes.find((entry) => entry.id === contextMenu.nodeId) || null
      : null

  const closeContextMenu = () => setContextMenu(null)

  return (
    <div
      ref={surfaceRef}
      className="relative flex min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,hsl(var(--background)),hsl(var(--muted))/0.45_55%,hsl(var(--background)))]"
      onMouseDown={() => {
        if (contextMenu) closeContextMenu()
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.22 }}
        minZoom={0.35}
        maxZoom={1.6}
        zoomOnScroll={false}
        zoomOnPinch
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={CANVAS_CONNECTION_LINE_STYLE}
        proOptions={{ hideAttribution: true }}
        onNodesChange={(changes) => {
          void applyFlowNodeChanges(changes)
        }}
        onEdgesChange={(changes) => {
          void applyFlowEdgeChanges(changes)
        }}
        onConnect={(connection: Connection) => {
          void connectNodes(connection)
        }}
        onNodeClick={(_, node) => {
          closeContextMenu()
          setSelectedNodeId(node.id)
        }}
        onNodeDoubleClick={(_, node) => {
          if (workspace.nodes.find((entry) => entry.id === node.id)?.kind === 'compose') {
            setOpenComposeNodeId(node.id)
          }
        }}
        onNodeContextMenu={(event, flowNode) => {
          event.preventDefault()
          const bounds = surfaceRef.current?.getBoundingClientRect()
          if (!bounds) return
          setSelectedNodeId(flowNode.id)
          setContextMenu({
            type: 'node',
            nodeId: flowNode.id,
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
          })
        }}
        onPaneClick={() => {
          closeContextMenu()
          setSelectedNodeId(null)
        }}
        onPaneContextMenu={(event) => {
          event.preventDefault()
          const bounds = surfaceRef.current?.getBoundingClientRect()
          if (!bounds) return
          setContextMenu({
            type: 'pane',
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
          })
        }}
        nodesDraggable
        edgesFocusable
        nodesFocusable
        defaultEdgeOptions={{
          type: 'default',
          style: CANVAS_EDGE_STYLE,
        }}
      >
        <Background color="var(--border)" gap={22} size={1} />
      </ReactFlow>
      {contextMenu ? (
        <div
          role="menu"
          className="absolute z-40 min-w-52 overflow-hidden rounded-[1rem] border border-border/70 bg-card/96 p-1 shadow-[0_22px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === 'pane' ? (
            <>
              {MANUAL_NODE_OPTIONS.map((option) => (
                <button
                  key={option.kind}
                  type="button"
                  className="flex w-full items-center rounded-[0.8rem] px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-background/70"
                  onClick={() => {
                    closeContextMenu()
                    void addNode(option.kind)
                  }}
                >
                  Add {option.label}
                </button>
              ))}
              <div className="my-1 h-px bg-border/70" />
              <button
                type="button"
                disabled
                className="flex w-full items-center rounded-[0.8rem] px-3 py-2.5 text-left text-sm text-muted-foreground opacity-60"
              >
                Paste Node
              </button>
              <button
                type="button"
                disabled
                className="flex w-full items-center rounded-[0.8rem] px-3 py-2.5 text-left text-sm text-muted-foreground opacity-60"
              >
                Auto-layout (Future)
              </button>
            </>
          ) : contextNode ? (
            <>
              <button
                type="button"
                className="flex w-full items-center rounded-[0.8rem] px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-background/70"
                onClick={() => {
                  closeContextMenu()
                  void executeNode(contextNode.id)
                }}
              >
                Run
              </button>
              <button
                type="button"
                className="flex w-full items-center rounded-[0.8rem] px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-background/70"
                onClick={() => {
                  closeContextMenu()
                  void duplicateNode(contextNode.id)
                }}
              >
                Duplicate
              </button>
              <button
                type="button"
                className="flex w-full items-center rounded-[0.8rem] px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-background/70"
                onClick={() => {
                  closeContextMenu()
                  void disconnectNode(contextNode.id)
                }}
              >
                Disconnect
              </button>
              <button
                type="button"
                className="flex w-full items-center rounded-[0.8rem] px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-background/70"
                onClick={() => {
                  closeContextMenu()
                  setOpenDebugNodeId(contextNode.id)
                }}
              >
                Open Debug
              </button>
              <div className="my-1 h-px bg-border/70" />
              <button
                type="button"
                disabled={contextNode.kind === 'transcript_source'}
                className="flex w-full items-center rounded-[0.8rem] px-3 py-2.5 text-left text-sm text-destructive transition-colors hover:bg-background/70 disabled:opacity-40"
                onClick={() => {
                  closeContextMenu()
                  if (contextNode.kind !== 'transcript_source' && window.confirm(`Delete "${contextNode.label}"?`)) {
                    void deleteNode(contextNode.id)
                  }
                }}
              >
                Delete
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function handleDebugDrawerWheelCapture(event: WheelEvent<HTMLDivElement>) {
  if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
  const viewport = event.currentTarget.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null
  if (!viewport || viewport.scrollHeight <= viewport.clientHeight + 1) return
  event.stopPropagation()
}

function DebugDrawer({
  nodeId,
  onClose,
}: {
  nodeId: string | null
  onClose: () => void
}) {
  const node = useCanvasNode(nodeId)
  const latestRun = useCanvasNodeLatestRun(nodeId)
  const thread = useCanvasNodeThread(nodeId)

  if (!nodeId || !node || !latestRun || (!latestRun.requestPreview && !latestRun.responsePreview)) {
    return null
  }

  return (
    <div className="pointer-events-auto absolute bottom-4 right-4 top-20 z-30 w-[26rem] overflow-hidden rounded-[1.45rem] border border-border/70 bg-card/96 shadow-[0_26px_70px_rgba(0,0,0,0.3)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4 border-b border-border/70 px-4 py-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Run Debug
          </p>
          <h3 className="text-sm font-semibold text-foreground">{node.label}</h3>
          <p className="text-xs text-muted-foreground">
            {latestRun.model}
            {latestRun.sourceRunId ? ` · source ${latestRun.sourceRunId.slice(-6)}` : ''}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-[0.9rem]"
          onClick={onClose}
          aria-label="Close debug drawer"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea
        className="h-full max-h-[calc(100%-4.25rem)]"
        onWheelCapture={handleDebugDrawerWheelCapture}
      >
        <div className="space-y-5 px-4 py-4">
          {thread.length > 0 ? (
            <section className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Refinement Thread
              </p>
              <div className="space-y-2">
                {thread.slice(-6).map((message) => (
                  <div key={message.id} className="rounded-[1rem] border border-border/65 bg-background/70 px-3 py-2.5 text-xs leading-5 text-foreground">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {message.role}
                    </p>
                    <p>{message.text}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Request
            </p>
            <pre className="overflow-x-auto rounded-[1rem] border border-border/65 bg-background/75 p-3 text-[11px] leading-5 text-foreground whitespace-pre-wrap">
              {latestRun.requestPreview || 'No request preview stored.'}
            </pre>
          </section>

          <section className="space-y-2 pb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Response
            </p>
            <pre className="overflow-x-auto rounded-[1rem] border border-border/65 bg-background/75 p-3 text-[11px] leading-5 text-foreground whitespace-pre-wrap">
              {latestRun.responsePreview || 'No response preview stored.'}
            </pre>
          </section>
        </div>
      </ScrollArea>
    </div>
  )
}

export default function CanvasLabTool() {
  const hydrate = useCanvasLabStore((state) => state.hydrate)
  const isHydrated = useCanvasLabStore((state) => state.isHydrated)
  const isHydrating = useCanvasLabStore((state) => state.isHydrating)
  const hydrationError = useCanvasLabStore((state) => state.hydrationError)
  const activeWorkspace = useActiveCanvasWorkspace()
  const workspaces = useCanvasLabStore((state) => state.workspaces)
  const activeWorkspaceId = useCanvasLabStore((state) => state.activeWorkspaceId)
  const setActiveWorkspaceId = useCanvasLabStore((state) => state.setActiveWorkspaceId)
  const createWorkspace = useCanvasLabStore((state) => state.createWorkspace)
  const deleteWorkspace = useCanvasLabStore((state) => state.deleteWorkspace)
  const renameWorkspace = useCanvasLabStore((state) => state.renameWorkspace)
  const addNode = useCanvasLabStore((state) => state.addNode)
  const openComposeNodeId = useCanvasLabStore((state) => state.openComposeNodeId)
  const setOpenComposeNodeId = useCanvasLabStore((state) => state.setOpenComposeNodeId)
  const openDebugNodeId = useCanvasLabStore((state) => state.openDebugNodeId)
  const setOpenDebugNodeId = useCanvasLabStore((state) => state.setOpenDebugNodeId)
  const [isRenamingWorkspace, setIsRenamingWorkspace] = useState(false)
  const [workspaceDraftName, setWorkspaceDraftName] = useState('')
  const workspaceInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    setWorkspaceDraftName(activeWorkspace?.name || 'Canvas Lab')
  }, [activeWorkspace?.id, activeWorkspace?.name])

  useEffect(() => {
    if (!isRenamingWorkspace) return
    workspaceInputRef.current?.focus()
    workspaceInputRef.current?.select()
  }, [isRenamingWorkspace])

  const commitWorkspaceRename = () => {
    if (!activeWorkspace) {
      setIsRenamingWorkspace(false)
      return
    }

    const trimmed = workspaceDraftName.trim()
    if (!trimmed) {
      setWorkspaceDraftName(activeWorkspace.name)
      setIsRenamingWorkspace(false)
      return
    }

    if (trimmed !== activeWorkspace.name) {
      void renameWorkspace(activeWorkspace.id, trimmed)
    }

    setIsRenamingWorkspace(false)
  }

  return (
    <ToolShell className="bg-background">
      <ToolBody className="flex min-h-0 flex-1 gap-0 overflow-hidden p-0">
        {!isHydrated || isHydrating ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <div className="max-w-md rounded-[1.5rem] border border-border/70 bg-card/90 p-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[1rem] border border-border/70 bg-background/70">
                <Sparkles className="h-6 w-6 text-foreground/78" />
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Preparing Canvas Lab</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Loading your local workspace, graph, artifacts, and compose-stage assets.
              </p>
            </div>
          </div>
        ) : hydrationError ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <div className="max-w-md rounded-[1.5rem] border border-destructive/30 bg-card/90 p-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[1rem] border border-destructive/25 bg-destructive/10">
                <Boxes className="h-6 w-6 text-destructive" />
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Canvas Lab could not load</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{hydrationError}</p>
            </div>
          </div>
        ) : (
          <CanvasLabErrorBoundary>
            <div className="relative flex min-h-0 flex-1 overflow-hidden">
              <div className="pointer-events-none absolute right-4 top-4 z-20 flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="pointer-events-auto h-10 rounded-full border-border/65 bg-background/80 px-3 shadow-[0_18px_42px_rgba(0,0,0,0.22)] backdrop-blur-xl"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Node
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={4} className="w-[14rem] rounded-[1rem] border-border/70 bg-card/95 p-1">
                    {MANUAL_NODE_OPTIONS.map((option) => {
                      const exists =
                        option.kind === 'prompt_builder'
                          ? false
                          : activeWorkspace?.nodes.some((node) => node.kind === option.kind)
                      return (
                        <DropdownMenuItem
                          key={option.kind}
                          disabled={exists}
                          className="rounded-[0.8rem] px-3 py-2.5"
                          onClick={() => {
                            void addNode(option.kind)
                          }}
                        >
                          {option.label}
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="pointer-events-auto flex items-center rounded-full border border-border/65 bg-background/80 pr-1 shadow-[0_18px_42px_rgba(0,0,0,0.22)] backdrop-blur-xl">
                  <div className="flex w-[14rem] items-center pl-4">
                    {isRenamingWorkspace ? (
                      <Input
                        ref={workspaceInputRef}
                        value={workspaceDraftName}
                        onChange={(event) => setWorkspaceDraftName(event.target.value)}
                        onBlur={commitWorkspaceRename}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            commitWorkspaceRename()
                          }
                          if (event.key === 'Escape') {
                            setWorkspaceDraftName(activeWorkspace?.name || 'Canvas Lab')
                            setIsRenamingWorkspace(false)
                          }
                        }}
                        className="h-9 border-0 bg-transparent px-0 text-sm font-medium text-foreground shadow-none focus-visible:ring-0"
                      />
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex h-10 w-full items-center gap-3 rounded-full pr-2 text-left text-foreground transition-colors hover:bg-background/45"
                            aria-label="Choose workspace"
                            title="Double-click the name to rename"
                            onDoubleClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              setWorkspaceDraftName(activeWorkspace?.name || 'Canvas Lab')
                              setIsRenamingWorkspace(true)
                            }}
                          >
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                              {activeWorkspace?.name || 'Canvas Lab'}
                            </span>
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          sideOffset={4}
                          className="w-[14rem] rounded-[1rem] border-border/70 bg-card/95 p-1"
                        >
                          {workspaces.map((workspace) => (
                            <DropdownMenuItem
                              key={workspace.id}
                              className="flex items-center justify-between rounded-[0.8rem] px-3 py-2.5"
                              onClick={() => setActiveWorkspaceId(workspace.id)}
                            >
                              <span className="truncate">{workspace.name}</span>
                              {workspace.id === activeWorkspaceId ? (
                                <Check className="h-4 w-4 shrink-0 text-foreground" />
                              ) : null}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator className="mx-0 my-1" />
                          <DropdownMenuItem
                            disabled={workspaces.length <= 1 || !activeWorkspace}
                            className="rounded-[0.8rem] px-3 py-2.5 text-destructive focus:text-destructive"
                            onClick={() => {
                              if (activeWorkspace && workspaces.length > 1) {
                                void deleteWorkspace(activeWorkspace.id)
                              }
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Canvas
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  <div className="mx-1 h-5 w-px bg-border/65" />
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-background/60"
                    onClick={() => {
                      void createWorkspace()
                    }}
                    aria-label="New workspace"
                    title="New workspace"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <ReactFlowProvider>
                <CanvasFlowSurface />
              </ReactFlowProvider>
              <DebugDrawer
                nodeId={openDebugNodeId}
                onClose={() => setOpenDebugNodeId(null)}
              />
            </div>
            <ComposeStage
              nodeId={openComposeNodeId}
              isOpen={Boolean(openComposeNodeId)}
              onClose={() => setOpenComposeNodeId(null)}
            />
          </CanvasLabErrorBoundary>
        )}
      </ToolBody>
    </ToolShell>
  )
}
