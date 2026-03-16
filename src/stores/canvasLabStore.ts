import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react'
import { useMemo } from 'react'
import { create } from 'zustand'
import { toast } from 'sonner'
import { useChatStore } from '@/stores/chatStore'
import { useImageGenerationStore } from '@/stores/imageGenerationStore'
import { usePackagingSessionStore } from '@/stores/packagingSessionStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { generateId } from '@/types/chat'
import type {
  Artifact,
  ArtifactItem,
  CanvasAsset,
  CanvasExecuteNodeRequest,
  CanvasLabFlowEdge,
  CanvasLabFlowNode,
  CanvasLabNodeKind,
  CanvasLabNodeStatus,
  CanvasNode,
  CanvasNodeConfigMap,
  CanvasWorkspace,
  ComposeItem,
  NodeRun,
  NodeThreadMessage,
  StoredCanvasAsset,
} from '@/types/canvasLab'
import { blobToDataUrl, requestCanvasNodeExecution } from '@/utils/canvasLabClient'
import {
  deleteCanvasWorkspace,
  loadCanvasLabPersistence,
  materializeCanvasAsset,
  putCanvasAssets,
  saveCanvasWorkspace,
} from '@/utils/canvasLabPersistence'
import {
  artifactPreviewText,
  createInitialCanvasWorkspace,
  deriveTranscriptArtifacts,
  normalizeCanvasWorkspace,
  upsertArtifactItems,
} from '@/utils/canvasLabWorkspace'

const ACTIVE_WORKSPACE_KEY = 'yt-assist-canvas-lab-active-workspace'

interface CanvasLabStore {
  isHydrated: boolean
  isHydrating: boolean
  hydrationError: string | null
  workspaces: CanvasWorkspace[]
  assetsById: Record<string, CanvasAsset>
  activeWorkspaceId: string | null
  selectedNodeId: string | null
  openComposeNodeId: string | null
  hydrate: () => Promise<void>
  createWorkspace: (name?: string) => Promise<string>
  deleteWorkspace: (workspaceId: string) => Promise<void>
  renameWorkspace: (workspaceId: string, name: string) => Promise<void>
  setActiveWorkspaceId: (workspaceId: string | null) => void
  setSelectedNodeId: (nodeId: string | null) => void
  setOpenComposeNodeId: (nodeId: string | null) => void
  applyFlowNodeChanges: (changes: NodeChange[]) => Promise<void>
  applyFlowEdgeChanges: (changes: EdgeChange[]) => Promise<void>
  connectNodes: (connection: Connection) => Promise<void>
  updateNodeConfig: (
    nodeId: string,
    updater: (current: CanvasNode['config']) => CanvasNode['config'],
  ) => Promise<void>
  updateNodeStatus: (nodeId: string, status: CanvasLabNodeStatus, lastRunId?: string) => Promise<void>
  toggleArtifactItemState: (
    artifactId: string,
    itemId: string,
    field: 'accepted' | 'pinned',
  ) => Promise<void>
  executeNode: (nodeId: string, options?: { requestedCount?: number; message?: string }) => Promise<void>
  importPackagingSession: () => Promise<void>
  importActiveChat: () => Promise<void>
  importReusableAssets: () => Promise<void>
  addComposeItemFromArtifact: (composeNodeId: string, artifactId: string, itemId?: string) => Promise<void>
  addComposeItemFromAsset: (composeNodeId: string, assetId: string) => Promise<void>
  updateComposeItem: (composeNodeId: string, itemId: string, patch: Partial<ComposeItem>) => Promise<void>
  selectComposeItem: (composeNodeId: string, itemId: string | null) => Promise<void>
  moveComposeItemLayer: (composeNodeId: string, itemId: string, direction: 'up' | 'down') => Promise<void>
  duplicateComposeItem: (composeNodeId: string, itemId: string) => Promise<void>
  removeComposeItem: (composeNodeId: string, itemId: string) => Promise<void>
}

let hydratePromise: Promise<void> | null = null

function loadActiveWorkspaceId() {
  try {
    return localStorage.getItem(ACTIVE_WORKSPACE_KEY)
  } catch {
    return null
  }
}

function saveActiveWorkspaceId(workspaceId: string | null) {
  try {
    if (workspaceId) {
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId)
      return
    }
    localStorage.removeItem(ACTIVE_WORKSPACE_KEY)
  } catch {
    // Ignore localStorage failures.
  }
}

function toFlowNodes(workspace: CanvasWorkspace): CanvasLabFlowNode[] {
  return workspace.nodes.map((node) => ({
    id: node.id,
    type: 'canvasLabNode',
    position: node.position,
    data: { nodeId: node.id },
    width: node.width,
    height: node.height,
  }))
}

function toFlowEdges(workspace: CanvasWorkspace): CanvasLabFlowEdge[] {
  return workspace.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
    animated: false,
  }))
}

function fromFlowNodes(workspace: CanvasWorkspace, flowNodes: Array<{ id: string; position: { x: number; y: number }; width?: number; height?: number }>) {
  const nodeMap = new Map(flowNodes.map((node) => [node.id, node]))
  return workspace.nodes.map((node) => {
    const flowNode = nodeMap.get(node.id)
    if (!flowNode) return node

    const positionUnchanged =
      flowNode.position.x === node.position.x &&
      flowNode.position.y === node.position.y

    if (positionUnchanged) {
      return node
    }

    return {
      ...node,
      position: flowNode.position,
      updatedAt: Date.now(),
    }
  })
}

function fromFlowEdges(
  workspace: CanvasWorkspace,
  flowEdges: CanvasLabFlowEdge[],
) {
  return flowEdges.map((edge) => {
    const current = workspace.edges.find((entry) => entry.id === edge.id)
    return current || {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      createdAt: Date.now(),
    }
  })
}

function getActiveWorkspace(state: Pick<CanvasLabStore, 'workspaces' | 'activeWorkspaceId'>) {
  if (!state.activeWorkspaceId) return null
  return state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId) || null
}

function replaceWorkspace(workspaces: CanvasWorkspace[], nextWorkspace: CanvasWorkspace) {
  return workspaces.map((workspace) => (workspace.id === nextWorkspace.id ? nextWorkspace : workspace))
}

function getIncomingNodeIds(workspace: CanvasWorkspace, nodeId: string) {
  return workspace.edges
    .filter((edge) => edge.target === nodeId)
    .map((edge) => edge.source)
}

function getOutgoingNodeIds(workspace: CanvasWorkspace, nodeId: string) {
  return workspace.edges
    .filter((edge) => edge.source === nodeId)
    .map((edge) => edge.target)
}

function markDescendantsStale(workspace: CanvasWorkspace, nodeId: string) {
  const queue = [...getOutgoingNodeIds(workspace, nodeId)]
  const seen = new Set<string>()
  const nodes = workspace.nodes.map((node) => {
    if (!queue.includes(node.id)) return node
    return {
      ...node,
      status: 'stale' as const,
      updatedAt: Date.now(),
    }
  })

  while (queue.length > 0) {
    const currentId = queue.shift()
    if (!currentId || seen.has(currentId)) continue
    seen.add(currentId)
    for (const nextId of getOutgoingNodeIds(workspace, currentId)) {
      if (!seen.has(nextId)) {
        queue.push(nextId)
      }
    }
  }

  return {
    ...workspace,
    nodes: nodes.map((node) =>
      seen.has(node.id)
        ? {
            ...node,
            status: node.status === 'running' ? node.status : 'stale',
            updatedAt: Date.now(),
          }
        : node,
    ),
    updatedAt: Date.now(),
  }
}

function uniqueArtifacts(artifacts: Artifact[]) {
  const seen = new Set<string>()
  return artifacts.filter((artifact) => {
    if (seen.has(artifact.id)) return false
    seen.add(artifact.id)
    return true
  })
}

function collectAncestorArtifacts(workspace: CanvasWorkspace, nodeId: string) {
  const queue = [...getIncomingNodeIds(workspace, nodeId)]
  const visited = new Set<string>()
  const artifacts: Artifact[] = []
  const ancestorNodes: CanvasNode[] = []

  while (queue.length > 0) {
    const currentId = queue.shift()
    if (!currentId || visited.has(currentId)) continue
    visited.add(currentId)

    const node = workspace.nodes.find((entry) => entry.id === currentId)
    if (node) {
      ancestorNodes.push(node)
      artifacts.push(...workspace.artifacts.filter((artifact) => artifact.nodeId === currentId))
    }

    for (const parentId of getIncomingNodeIds(workspace, currentId)) {
      if (!visited.has(parentId)) queue.push(parentId)
    }
  }

  return {
    ancestorNodes,
    artifacts: uniqueArtifacts(artifacts).sort((a, b) => a.createdAt - b.createdAt),
  }
}

function formatBriefArtifactContent(config: CanvasNodeConfigMap['packaging_brief']) {
  return [
    config.mustInclude ? `Must include: ${config.mustInclude}` : null,
    config.niceToInclude ? `Nice to include: ${config.niceToInclude}` : null,
    config.avoidWords ? `Avoid: ${config.avoidWords}` : null,
    config.includeName && config.nameForTitles
      ? `Use name in titles: ${config.nameForTitles}`
      : null,
    config.additionalContext ? `Additional context: ${config.additionalContext}` : null,
    `Transcript timestamps preferred: ${config.transcriptIncludeTimestamps ? 'yes' : 'no'}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function describeComposeItems(items: ComposeItem[], assetsById: Record<string, CanvasAsset>) {
  return items
    .slice()
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((item) => {
      if (item.kind === 'text') {
        return `Text layer: ${item.text || 'Untitled text'}`
      }

      const assetName = item.assetId ? assetsById[item.assetId]?.name || 'Referenced image' : 'Image layer'
      return `Image layer: ${assetName}`
    })
    .join('\n')
}

function synchronizeNodeArtifacts(
  workspace: CanvasWorkspace,
  nodeId: string,
  assetsById: Record<string, CanvasAsset>,
) {
  const node = workspace.nodes.find((entry) => entry.id === nodeId)
  if (!node) return workspace

  const nextArtifacts = [...workspace.artifacts]

  const upsertAtIndex = (artifact: Artifact) => {
    const index = nextArtifacts.findIndex((entry) => entry.id === artifact.id)
    if (index >= 0) {
      nextArtifacts[index] = artifact
      return
    }
    nextArtifacts.push(artifact)
  }

  if (node.kind === 'transcript_source') {
    const config = node.config as CanvasNodeConfigMap['transcript_source']
    const pairs: Array<{ kind: Artifact['kind']; label: string; content: string; items?: ArtifactItem[] }> = [
      { kind: 'raw_transcript', label: 'Raw transcript', content: config.artifacts.rawTranscript },
      { kind: 'transcript_digest', label: 'Transcript digest', content: config.artifacts.digest },
      { kind: 'timestamp_map', label: 'Timestamp map', content: config.artifacts.timestampMap },
      {
        kind: 'key_hooks',
        label: 'Key hooks',
        content: config.artifacts.keyHooks.join('\n'),
        items: config.artifacts.keyHooks.map((hook) => ({
          id: generateId(),
          text: hook,
        })),
      },
    ]

    for (const pair of pairs) {
      const existing = nextArtifacts.find(
        (artifact) => artifact.nodeId === node.id && artifact.kind === pair.kind,
      )
      upsertAtIndex(
        upsertArtifactItems(existing, {
          nodeId: node.id,
          kind: pair.kind,
          label: pair.label,
          content: pair.content,
          items: pair.items,
        }),
      )
    }
  }

  if (node.kind === 'packaging_brief') {
    const existing = nextArtifacts.find(
      (artifact) => artifact.nodeId === node.id && artifact.kind === 'brief',
    )
    upsertAtIndex(
      upsertArtifactItems(existing, {
        nodeId: node.id,
        kind: 'brief',
        label: 'Packaging brief',
        content: formatBriefArtifactContent(node.config as CanvasNodeConfigMap['packaging_brief']),
      }),
    )
  }

  if (node.kind === 'asset_library') {
    const config = node.config as CanvasNodeConfigMap['asset_library']
    const items = config.assetIds
      .map((assetId) => assetsById[assetId])
      .filter((asset): asset is CanvasAsset => Boolean(asset))
      .map((asset) => ({
        id: generateId(),
        text: asset.name,
        secondaryText: asset.source,
        assetId: asset.id,
      }))
    const existing = nextArtifacts.find(
      (artifact) => artifact.nodeId === node.id && artifact.kind === 'asset_reference',
    )
    upsertAtIndex(
      upsertArtifactItems(existing, {
        nodeId: node.id,
        kind: 'asset_reference',
        label: 'Asset library',
        content: items.map((item) => item.text).join('\n'),
        items,
      }),
    )
  }

  if (node.kind === 'compose') {
    const config = node.config as CanvasNodeConfigMap['compose']
    const items = config.items
      .slice()
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((item) => ({
        id: item.id,
        text:
          item.kind === 'text'
            ? item.text || 'Text layer'
            : assetsById[item.assetId || '']?.name || 'Image layer',
        secondaryText: item.kind === 'text' ? 'text layer' : 'image layer',
        assetId: item.assetId,
      }))
    const existing = nextArtifacts.find(
      (artifact) => artifact.nodeId === node.id && artifact.kind === 'compose_plan',
    )
    upsertAtIndex(
      upsertArtifactItems(existing, {
        nodeId: node.id,
        kind: 'compose_plan',
        label: 'Compose plan',
        content: describeComposeItems(config.items, assetsById),
        items,
      }),
    )
  }

  return {
    ...workspace,
    artifacts: nextArtifacts,
    updatedAt: Date.now(),
  }
}

function artifactKindForNode(kind: CanvasLabNodeKind): Artifact['kind'] | null {
  switch (kind) {
    case 'titles':
      return 'title_suggestions'
    case 'summary':
      return 'summary'
    case 'chapters':
      return 'chapter_list'
    case 'thumbnail_copy':
      return 'thumbnail_copy'
    case 'image_prompt':
      return 'image_prompt'
    case 'chat':
      return 'chat_answer'
    case 'image_generate':
      return 'generated_image'
    default:
      return null
  }
}

function labelForGeneratedArtifact(node: CanvasNode) {
  switch (node.kind) {
    case 'titles':
      return 'Generated titles'
    case 'summary':
      return 'Summary'
    case 'chapters':
      return 'Chapter list'
    case 'thumbnail_copy':
      return 'Thumbnail copy'
    case 'image_prompt':
      return 'Image prompt'
    case 'chat':
      return 'Chat response'
    case 'image_generate':
      return 'Generated images'
    default:
      return node.label
  }
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl)
  return response.blob()
}

function getNodeThreadMessages(workspace: CanvasWorkspace, nodeId: string) {
  return workspace.threadMessages
    .filter((message) => message.nodeId === nodeId)
    .sort((a, b) => a.createdAt - b.createdAt)
}

function createThreadMessage(nodeId: string, role: NodeThreadMessage['role'], text: string): NodeThreadMessage {
  return {
    id: generateId(),
    nodeId,
    role,
    text,
    createdAt: Date.now(),
  }
}

function toRequestArtifacts(artifacts: Artifact[]) {
  return artifacts.map((artifact) => ({
    kind: artifact.kind,
    label: artifact.label,
    content: artifact.content,
    items: artifact.items.map((item) => ({
      text: item.text,
      secondaryText: item.secondaryText,
      assetId: item.assetId,
      accepted: item.accepted,
      pinned: item.pinned,
    })),
  }))
}

function extractTranscript(ancestorNodes: CanvasNode[]) {
  const sourceNode = ancestorNodes.find((node) => node.kind === 'transcript_source')
  if (!sourceNode) return null
  return (sourceNode.config as CanvasNodeConfigMap['transcript_source']).artifacts
}

function extractBrief(ancestorNodes: CanvasNode[]) {
  const briefNode = ancestorNodes.find((node) => node.kind === 'packaging_brief')
  if (!briefNode) return null
  return briefNode.config as CanvasNodeConfigMap['packaging_brief']
}

function extractImagePromptFromArtifacts(artifacts: Artifact[]) {
  const promptArtifact = [...artifacts]
    .reverse()
    .find((artifact) => artifact.kind === 'image_prompt')
  if (promptArtifact?.content?.trim()) return promptArtifact.content.trim()
  if (promptArtifact?.items[0]?.text.trim()) return promptArtifact.items[0].text.trim()
  return ''
}

function collectReferencedAssetIds(artifacts: Artifact[]) {
  const assetIds = new Set<string>()
  for (const artifact of artifacts) {
    for (const item of artifact.items) {
      if (item.assetId) {
        assetIds.add(item.assetId)
      }
    }
  }
  return [...assetIds]
}

function withWorkspaceUpdate(
  state: CanvasLabStore,
  set: (
    partial:
      | Partial<CanvasLabStore>
      | ((store: CanvasLabStore) => Partial<CanvasLabStore>),
  ) => void,
  updater: (workspace: CanvasWorkspace) => CanvasWorkspace,
) {
  const activeWorkspace = getActiveWorkspace(state)
  if (!activeWorkspace) return null
  const nextWorkspace = updater(activeWorkspace)
  set({
    workspaces: replaceWorkspace(state.workspaces, nextWorkspace),
  })
  void saveCanvasWorkspace(nextWorkspace)
  return nextWorkspace
}

export const useCanvasLabStore = create<CanvasLabStore>((set, get) => ({
  isHydrated: false,
  isHydrating: false,
  hydrationError: null,
  workspaces: [],
  assetsById: {},
  activeWorkspaceId: loadActiveWorkspaceId(),
  selectedNodeId: null,
  openComposeNodeId: null,

  hydrate: async () => {
    if (get().isHydrated) return
    if (hydratePromise) return hydratePromise

    set({ isHydrating: true, hydrationError: null })

    hydratePromise = (async () => {
      try {
        const settings = useSettingsStore.getState().settings
        const { workspaces, assets } = await loadCanvasLabPersistence()
        const assetsById = Object.fromEntries(
          assets.map((asset) => [asset.id, materializeCanvasAsset(asset)]),
        )
        let activeWorkspaceId = loadActiveWorkspaceId()

        const nextWorkspaces = [...workspaces]
          .map((workspace) => normalizeCanvasWorkspace(workspace, settings))
          .sort((a, b) => b.updatedAt - a.updatedAt)

        if (!activeWorkspaceId || !nextWorkspaces.some((workspace) => workspace.id === activeWorkspaceId)) {
          activeWorkspaceId = nextWorkspaces[0]?.id || null
        }

        if (nextWorkspaces.length === 0) {
          const initialWorkspace = createInitialCanvasWorkspace(
            'Canvas Lab',
            settings,
          )
          await saveCanvasWorkspace(initialWorkspace)
          nextWorkspaces.push(initialWorkspace)
          activeWorkspaceId = initialWorkspace.id
        } else {
          await Promise.all(nextWorkspaces.map((workspace) => saveCanvasWorkspace(workspace)))
        }

        saveActiveWorkspaceId(activeWorkspaceId)

        set({
          isHydrated: true,
          isHydrating: false,
          workspaces: nextWorkspaces,
          assetsById,
          activeWorkspaceId,
        })
      } catch (error) {
        set({
          isHydrated: true,
          isHydrating: false,
          hydrationError:
            error instanceof Error ? error.message : 'Failed to load the canvas lab workspace',
        })
      } finally {
        hydratePromise = null
      }
    })()

    return hydratePromise
  },

  createWorkspace: async (name) => {
    const workspace = createInitialCanvasWorkspace(
      name?.trim() || `Canvas Lab ${get().workspaces.length + 1}`,
      useSettingsStore.getState().settings,
    )
    await saveCanvasWorkspace(workspace)
    set((state) => ({
      workspaces: [workspace, ...state.workspaces],
      activeWorkspaceId: workspace.id,
      selectedNodeId: null,
      openComposeNodeId: null,
    }))
    saveActiveWorkspaceId(workspace.id)
    return workspace.id
  },

  deleteWorkspace: async (workspaceId) => {
    const { assetsById, workspaces, activeWorkspaceId } = get()
    const nextWorkspaces = workspaces.filter((workspace) => workspace.id !== workspaceId)
    const deletedAssets = Object.values(assetsById).filter((asset) => asset.workspaceId === workspaceId)
    for (const asset of deletedAssets) {
      URL.revokeObjectURL(asset.url)
    }

    await deleteCanvasWorkspace(workspaceId)

    const nextActiveWorkspaceId =
      activeWorkspaceId === workspaceId ? nextWorkspaces[0]?.id || null : activeWorkspaceId

    set((state) => ({
      workspaces: nextWorkspaces,
      activeWorkspaceId: nextActiveWorkspaceId,
      assetsById: Object.fromEntries(
        Object.entries(state.assetsById).filter(([, asset]) => asset.workspaceId !== workspaceId),
      ),
      selectedNodeId: null,
      openComposeNodeId:
        state.openComposeNodeId && nextWorkspaces.some((workspace) => workspace.nodes.some((node) => node.id === state.openComposeNodeId))
          ? state.openComposeNodeId
          : null,
    }))
    saveActiveWorkspaceId(nextActiveWorkspaceId)
  },

  renameWorkspace: async (workspaceId, name) => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    const state = get()
    const workspace = state.workspaces.find((entry) => entry.id === workspaceId)
    if (!workspace) return

    const nextWorkspace: CanvasWorkspace = {
      ...workspace,
      name: trimmedName,
      updatedAt: Date.now(),
    }

    set({
      workspaces: replaceWorkspace(state.workspaces, nextWorkspace),
    })
    await saveCanvasWorkspace(nextWorkspace)
  },

  setActiveWorkspaceId: (workspaceId) => {
    set({
      activeWorkspaceId: workspaceId,
      selectedNodeId: null,
      openComposeNodeId: null,
    })
    saveActiveWorkspaceId(workspaceId)
  },

  setSelectedNodeId: (nodeId) => {
    set({ selectedNodeId: nodeId })
  },

  setOpenComposeNodeId: (nodeId) => {
    set({ openComposeNodeId: nodeId })
  },

  applyFlowNodeChanges: async (changes) => {
    const positionChanges = changes.filter((change) => change.type === 'position')
    if (positionChanges.length === 0) return

    const state = get()
    withWorkspaceUpdate(state, set, (workspace) => {
      const flowNodes = applyNodeChanges(positionChanges as any, toFlowNodes(workspace)) as CanvasLabFlowNode[]
      const nextNodes = fromFlowNodes(workspace, flowNodes)
      if (nextNodes.every((node, index) => node === workspace.nodes[index])) {
        return workspace
      }

      return {
        ...workspace,
        nodes: nextNodes,
        updatedAt: Date.now(),
      }
    })
  },

  applyFlowEdgeChanges: async (changes) => {
    const state = get()
    withWorkspaceUpdate(state, set, (workspace) => {
      const flowEdges = applyEdgeChanges(changes, toFlowEdges(workspace))
      return {
        ...workspace,
        edges: fromFlowEdges(workspace, flowEdges),
        updatedAt: Date.now(),
      }
    })
  },

  connectNodes: async (connection) => {
    if (!connection.source || !connection.target) return

    const state = get()
    withWorkspaceUpdate(state, set, (workspace) => {
      const nextFlowEdges = addEdge(
        {
          ...connection,
          id: generateId(),
          type: 'smoothstep',
        },
        toFlowEdges(workspace),
      )

      return {
        ...workspace,
        edges: fromFlowEdges(workspace, nextFlowEdges),
        updatedAt: Date.now(),
      }
    })
  },

  updateNodeConfig: async (nodeId, updater) => {
    const state = get()
    withWorkspaceUpdate(state, set, (workspace) => {
      const nextNodes = workspace.nodes.map((node) => {
        if (node.id !== nodeId) return node
        return {
          ...node,
          config: updater(node.config),
          updatedAt: Date.now(),
        }
      })

      let nextWorkspace: CanvasWorkspace = {
        ...workspace,
        nodes: nextNodes,
        updatedAt: Date.now(),
      }
      nextWorkspace = synchronizeNodeArtifacts(nextWorkspace, nodeId, state.assetsById)
      nextWorkspace = markDescendantsStale(nextWorkspace, nodeId)
      return nextWorkspace
    })
  },

  updateNodeStatus: async (nodeId, status, lastRunId) => {
    const state = get()
    withWorkspaceUpdate(state, set, (workspace) => ({
      ...workspace,
      nodes: workspace.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              status,
              lastRunId: lastRunId ?? node.lastRunId,
              updatedAt: Date.now(),
            }
          : node,
      ),
      updatedAt: Date.now(),
    }))
  },

  toggleArtifactItemState: async (artifactId, itemId, field) => {
    const state = get()
    withWorkspaceUpdate(state, set, (workspace) => {
      const artifact = workspace.artifacts.find((entry) => entry.id === artifactId)
      if (!artifact) return workspace

      const nextWorkspace: CanvasWorkspace = {
        ...workspace,
        artifacts: workspace.artifacts.map((entry) =>
          entry.id === artifactId
            ? {
                ...entry,
                items: entry.items.map((item) =>
                  item.id === itemId
                    ? {
                        ...item,
                        [field]: !item[field],
                      }
                    : item,
                ),
                updatedAt: Date.now(),
              }
            : entry,
        ),
        updatedAt: Date.now(),
      }

      return markDescendantsStale(nextWorkspace, artifact.nodeId)
    })
  },

  executeNode: async (nodeId, options) => {
    const state = get()
    const workspace = getActiveWorkspace(state)
    if (!workspace) return
    const node = workspace.nodes.find((entry) => entry.id === nodeId)
    if (!node) return

    const threadMessages = getNodeThreadMessages(workspace, nodeId)
    const nextUserMessage =
      options?.message?.trim()
        ? createThreadMessage(nodeId, 'user', options.message.trim())
        : null

    const runId = generateId()
    const run: NodeRun = {
      id: runId,
      nodeId,
      status: 'running',
      startedAt: Date.now(),
      provider: node.kind === 'image_generate' ? 'gemini' : node.kind === 'chat'
        ? ((node.config as CanvasNodeConfigMap['chat']).provider === 'anthropic' ? 'anthropic' : 'openai')
        : 'openai',
      model:
        node.kind === 'chat'
          ? (node.config as CanvasNodeConfigMap['chat']).model
          : node.kind === 'image_generate'
          ? (node.config as CanvasNodeConfigMap['image_generate']).model
          : 'gpt-5.2',
      requestedCount: options?.requestedCount,
    }

    let runningWorkspace = withWorkspaceUpdate(state, set, (currentWorkspace) => ({
      ...currentWorkspace,
      nodes: currentWorkspace.nodes.map((entry) =>
        entry.id === nodeId
          ? {
              ...entry,
              status: 'running',
              lastRunId: runId,
              updatedAt: Date.now(),
            }
          : entry,
      ),
      runs: [run, ...currentWorkspace.runs],
      threadMessages: nextUserMessage
        ? [...currentWorkspace.threadMessages, nextUserMessage]
        : currentWorkspace.threadMessages,
      updatedAt: Date.now(),
    }))

    if (!runningWorkspace) return

    const activeNode = runningWorkspace.nodes.find((entry) => entry.id === nodeId)
    if (!activeNode) return

    const { ancestorNodes, artifacts } = collectAncestorArtifacts(runningWorkspace, nodeId)
    const transcript = extractTranscript(ancestorNodes)
    const brief = extractBrief(ancestorNodes)

    const request: Omit<CanvasExecuteNodeRequest, 'packagingModel'> = {
      nodeKind: activeNode.kind,
      nodeLabel: activeNode.label,
      requestedCount:
        options?.requestedCount ||
        (activeNode.kind === 'titles' ||
        activeNode.kind === 'thumbnail_copy' ||
        activeNode.kind === 'chapters' ||
        activeNode.kind === 'summary' ||
        activeNode.kind === 'image_prompt'
          ? (activeNode.config as CanvasNodeConfigMap['titles']).requestedCount
          : undefined),
      thread: [...threadMessages, ...(nextUserMessage ? [nextUserMessage] : [])].map((message) => ({
        role: message.role,
        text: message.text,
      })),
      transcript: transcript || undefined,
      brief: brief || undefined,
      artifacts: toRequestArtifacts(artifacts),
    }

    if (activeNode.kind === 'chat') {
      const config = activeNode.config as CanvasNodeConfigMap['chat']
      request.chat = {
        provider: config.provider,
        model: config.model,
        prompt: options?.message?.trim() || config.draftPrompt.trim(),
        systemPrompt: config.systemPrompt.trim() || undefined,
      }
    }

    if (activeNode.kind === 'image_generate') {
      const config = activeNode.config as CanvasNodeConfigMap['image_generate']
      const prompt = extractImagePromptFromArtifacts(artifacts)
      if (!prompt) {
        toast.error('Connect an Image Prompt node before running image generation.')
        await get().updateNodeStatus(nodeId, 'error', runId)
        return
      }

      const referenceImages = await Promise.all(
        collectReferencedAssetIds(artifacts)
          .map((assetId) => get().assetsById[assetId])
          .filter((asset): asset is CanvasAsset => Boolean(asset))
          .map(async (asset) => ({
            dataUrl: await blobToDataUrl(asset.blob),
            mimeType: asset.mimeType,
            name: asset.name,
          })),
      )

      request.imageGenerate = {
        model: config.model,
        count: config.count,
        aspectRatio: config.aspectRatio,
        imageSize: config.imageSize,
        prompt,
        referenceImages,
      }
    }

    try {
      const response = await requestCanvasNodeExecution(request)

      const assistantPreview =
        response.content?.trim() ||
        response.items?.slice(0, 2).map((item) => item.text).join(' · ') ||
        `${activeNode.label} updated`

      const assistantMessage = createThreadMessage(nodeId, 'assistant', assistantPreview)
      const nextAssetRecords: StoredCanvasAsset[] = []
      const nextArtifactItems: ArtifactItem[] = []

      if (activeNode.kind === 'image_generate' && response.items) {
        for (const item of response.items) {
          if (!item.imageDataUrl || !item.mimeType) continue
          const blob = await dataUrlToBlob(item.imageDataUrl)
          const assetId = generateId()
          nextAssetRecords.push({
            id: assetId,
            workspaceId: runningWorkspace.id,
            name: item.name || `${activeNode.label} ${nextAssetRecords.length + 1}`,
            mimeType: item.mimeType,
            createdAt: Date.now(),
            source: 'generated',
            blob,
          })
          nextArtifactItems.push({
            id: generateId(),
            text: item.name || `Generated image ${nextArtifactItems.length + 1}`,
            secondaryText: item.meta?.summary ? String(item.meta.summary) : undefined,
            assetId,
          })
        }
      } else {
        for (const item of response.items || []) {
          nextArtifactItems.push({
            id: generateId(),
            text: item.text,
            secondaryText: item.secondaryText,
            meta: item.meta,
          })
        }
      }

      if (nextAssetRecords.length > 0) {
        await putCanvasAssets(nextAssetRecords)
      }

      const nextAssetsById =
        nextAssetRecords.length > 0
          ? {
              ...get().assetsById,
              ...Object.fromEntries(nextAssetRecords.map((asset) => [asset.id, materializeCanvasAsset(asset)])),
            }
          : get().assetsById

      set({ assetsById: nextAssetsById })

      const artifactKind = artifactKindForNode(activeNode.kind)

      withWorkspaceUpdate(get(), set, (currentWorkspace) => {
        let nextWorkspace: CanvasWorkspace = {
          ...currentWorkspace,
          nodes: currentWorkspace.nodes.map((entry) =>
            entry.id === nodeId
              ? {
                  ...entry,
                  status: 'complete',
                  lastRunId: runId,
                  updatedAt: Date.now(),
                }
              : entry,
          ),
          runs: currentWorkspace.runs.map((entry) =>
            entry.id === runId
              ? {
                  ...entry,
                  status: 'complete',
                  completedAt: Date.now(),
                  provider: response.provider,
                  model: response.model,
                  warnings: response.warnings,
                }
              : entry,
          ),
          threadMessages: [...currentWorkspace.threadMessages, assistantMessage],
          updatedAt: Date.now(),
        }

        if (artifactKind) {
          const existingArtifact = currentWorkspace.artifacts.find(
            (artifact) => artifact.nodeId === nodeId && artifact.kind === artifactKind,
          )
          const nextArtifact = upsertArtifactItems(existingArtifact, {
            nodeId,
            kind: artifactKind,
            label: labelForGeneratedArtifact(activeNode),
            content: response.content,
            items: nextArtifactItems,
          })

          nextWorkspace = {
            ...nextWorkspace,
            artifacts: [
              ...currentWorkspace.artifacts.filter((artifact) => artifact.id !== existingArtifact?.id),
              nextArtifact,
            ].sort((a, b) => a.createdAt - b.createdAt),
            updatedAt: Date.now(),
          }
        }

        nextWorkspace = synchronizeNodeArtifacts(nextWorkspace, nodeId, nextAssetsById)
        nextWorkspace = markDescendantsStale(nextWorkspace, nodeId)
        return nextWorkspace
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Node execution failed'
      withWorkspaceUpdate(get(), set, (currentWorkspace) => ({
        ...currentWorkspace,
        nodes: currentWorkspace.nodes.map((entry) =>
          entry.id === nodeId
            ? {
                ...entry,
                status: 'error',
                lastRunId: runId,
                updatedAt: Date.now(),
              }
            : entry,
        ),
        runs: currentWorkspace.runs.map((entry) =>
          entry.id === runId
            ? {
                ...entry,
                status: 'error',
                completedAt: Date.now(),
                error: message,
              }
            : entry,
        ),
        updatedAt: Date.now(),
      }))
      toast.error(message)
    }
  },

  importPackagingSession: async () => {
    const state = get()
    const workspace = getActiveWorkspace(state)
    if (!workspace) return
    const packaging = usePackagingSessionStore.getState().userInputs

    withWorkspaceUpdate(state, set, (currentWorkspace) => {
      const nextNodes = currentWorkspace.nodes.map((node) => {
        if (node.kind === 'transcript_source') {
          const artifacts = deriveTranscriptArtifacts(packaging.transcript)
          return {
            ...node,
            status: packaging.transcript.trim() ? 'complete' : 'idle',
            config: {
              transcript: packaging.transcript,
              artifacts,
            },
            updatedAt: Date.now(),
          }
        }

        if (node.kind === 'packaging_brief') {
          return {
            ...node,
            status: 'complete',
            config: {
              mustInclude: packaging.mustInclude,
              niceToInclude: packaging.niceToInclude,
              avoidWords: packaging.avoidWords,
              includeName: packaging.includeName,
              nameForTitles: packaging.nameForTitles,
              additionalContext: packaging.additionalContext,
              transcriptIncludeTimestamps: packaging.transcriptIncludeTimestamps,
            },
            updatedAt: Date.now(),
          }
        }

        return node
      })

      let nextWorkspace: CanvasWorkspace = {
        ...currentWorkspace,
        nodes: nextNodes,
        updatedAt: Date.now(),
      }
      nextWorkspace = synchronizeNodeArtifacts(
        synchronizeNodeArtifacts(nextWorkspace, nextNodes.find((node) => node.kind === 'transcript_source')?.id || '', state.assetsById),
        nextNodes.find((node) => node.kind === 'packaging_brief')?.id || '',
        state.assetsById,
      )
      nextWorkspace = markDescendantsStale(nextWorkspace, nextNodes.find((node) => node.kind === 'transcript_source')?.id || '')
      nextWorkspace = markDescendantsStale(nextWorkspace, nextNodes.find((node) => node.kind === 'packaging_brief')?.id || '')
      return nextWorkspace
    })

    toast.success('Packaging session imported into Canvas Lab.')
  },

  importActiveChat: async () => {
    const state = get()
    const workspace = getActiveWorkspace(state)
    if (!workspace) return
    const activeChat = useChatStore.getState().activeChat
    if (!activeChat) {
      toast.error('Open a chat first, then import it.')
      return
    }

    const chatMessages = activeChat.messages
      .flatMap((message) =>
        message.content
          .filter((part) => part.type === 'text' && part.text?.trim())
          .map((part) => ({
            role: message.role,
            text: part.text!.trim(),
          })),
      )
      .slice(-8)

    const chatNode = workspace.nodes.find((node) => node.kind === 'chat')
    if (!chatNode) return

    withWorkspaceUpdate(state, set, (currentWorkspace) => ({
      ...currentWorkspace,
      threadMessages: [
        ...currentWorkspace.threadMessages.filter((message) => message.nodeId !== chatNode.id),
        ...chatMessages.map((message) => createThreadMessage(chatNode.id, message.role, message.text)),
      ],
      nodes: currentWorkspace.nodes.map((node) =>
        node.id === chatNode.id
          ? {
              ...node,
              status: 'complete',
              updatedAt: Date.now(),
            }
          : node,
      ),
      updatedAt: Date.now(),
    }))

    toast.success('Active chat context imported into the Chat node.')
  },

  importReusableAssets: async () => {
    const imageStore = useImageGenerationStore.getState()
    await imageStore.hydrate()
    const reusableAssets = Object.values(useImageGenerationStore.getState().assetsById).filter(
      (asset) => asset.isReusable,
    )

    if (reusableAssets.length === 0) {
      toast.error('No reusable image assets found.')
      return
    }

    const state = get()
    const workspace = getActiveWorkspace(state)
    if (!workspace) return

    const assetLibraryNode = workspace.nodes.find((node) => node.kind === 'asset_library')
    if (!assetLibraryNode) return

    const nextAssets: StoredCanvasAsset[] = reusableAssets.map((asset) => ({
      id: generateId(),
      workspaceId: workspace.id,
      name: asset.name || `Asset ${asset.id.slice(-4)}`,
      mimeType: asset.mimeType,
      createdAt: Date.now(),
      source: 'library',
      blob: asset.blob,
    }))

    await putCanvasAssets(nextAssets)

    const materializedAssets = Object.fromEntries(
      nextAssets.map((asset) => [asset.id, materializeCanvasAsset(asset)]),
    )

    set((currentState) => ({
      assetsById: {
        ...currentState.assetsById,
        ...materializedAssets,
      },
    }))

    withWorkspaceUpdate(get(), set, (currentWorkspace) => {
      const nextWorkspace: CanvasWorkspace = {
        ...currentWorkspace,
        nodes: currentWorkspace.nodes.map((node) =>
          node.id === assetLibraryNode.id
            ? {
                ...node,
                status: 'complete',
                config: {
                  assetIds: [
                    ...(node.config as CanvasNodeConfigMap['asset_library']).assetIds,
                    ...nextAssets.map((asset) => asset.id),
                  ],
                },
                updatedAt: Date.now(),
              }
            : node,
        ),
        updatedAt: Date.now(),
      }

      const synced = synchronizeNodeArtifacts(nextWorkspace, assetLibraryNode.id, {
        ...get().assetsById,
        ...materializedAssets,
      })
      return markDescendantsStale(synced, assetLibraryNode.id)
    })

    toast.success(`${nextAssets.length} reusable assets imported into Canvas Lab.`)
  },

  addComposeItemFromArtifact: async (composeNodeId, artifactId, itemId) => {
    const state = get()
    withWorkspaceUpdate(state, set, (workspace) => {
      const artifact = workspace.artifacts.find((entry) => entry.id === artifactId)
      if (!artifact) return workspace
      const composeNode = workspace.nodes.find((node) => node.id === composeNodeId && node.kind === 'compose')
      if (!composeNode) return workspace

      const targetItem = itemId
        ? artifact.items.find((entry) => entry.id === itemId)
        : artifact.items.find((entry) => entry.accepted) || artifact.items[0]

      if (!targetItem) return workspace

      const config = composeNode.config as CanvasNodeConfigMap['compose']
      const nextItem: ComposeItem =
        targetItem.assetId
          ? {
              id: generateId(),
              kind: 'image',
              x: 56 + config.items.length * 18,
              y: 56 + config.items.length * 18,
              width: 280,
              height: 180,
              rotation: 0,
              zIndex: config.items.length,
              locked: false,
              assetId: targetItem.assetId,
            }
          : {
              id: generateId(),
              kind: 'text',
              x: 72 + config.items.length * 16,
              y: 72 + config.items.length * 16,
              width: 340,
              height: 96,
              rotation: 0,
              zIndex: config.items.length,
              locked: false,
              text: targetItem.secondaryText
                ? `${targetItem.text}\n${targetItem.secondaryText}`
                : targetItem.text,
              style: {
                fontSize: 42,
                fontWeight: 800,
                color: '#ffffff',
                align: 'center',
              },
            }

      let nextWorkspace: CanvasWorkspace = {
        ...workspace,
        nodes: workspace.nodes.map((node) =>
          node.id === composeNodeId
            ? {
                ...node,
                config: {
                  ...config,
                  items: [...config.items, nextItem],
                  selectedItemId: nextItem.id,
                },
                status: 'complete',
                updatedAt: Date.now(),
              }
            : node,
        ),
        updatedAt: Date.now(),
      }

      nextWorkspace = synchronizeNodeArtifacts(nextWorkspace, composeNodeId, state.assetsById)
      nextWorkspace = markDescendantsStale(nextWorkspace, composeNodeId)
      return nextWorkspace
    })
  },

  addComposeItemFromAsset: async (composeNodeId, assetId) => {
    const state = get()
    withWorkspaceUpdate(state, set, (workspace) => {
      const composeNode = workspace.nodes.find((node) => node.id === composeNodeId && node.kind === 'compose')
      if (!composeNode || !state.assetsById[assetId]) return workspace
      const config = composeNode.config as CanvasNodeConfigMap['compose']
      const nextItem: ComposeItem = {
        id: generateId(),
        kind: 'image',
        x: 48 + config.items.length * 18,
        y: 48 + config.items.length * 18,
        width: 280,
        height: 180,
        rotation: 0,
        zIndex: config.items.length,
        locked: false,
        assetId,
      }

      let nextWorkspace: CanvasWorkspace = {
        ...workspace,
        nodes: workspace.nodes.map((node) =>
          node.id === composeNodeId
            ? {
                ...node,
                config: {
                  ...config,
                  items: [...config.items, nextItem],
                  selectedItemId: nextItem.id,
                },
                status: 'complete',
                updatedAt: Date.now(),
              }
            : node,
        ),
        updatedAt: Date.now(),
      }
      nextWorkspace = synchronizeNodeArtifacts(nextWorkspace, composeNodeId, state.assetsById)
      nextWorkspace = markDescendantsStale(nextWorkspace, composeNodeId)
      return nextWorkspace
    })
  },

  updateComposeItem: async (composeNodeId, itemId, patch) => {
    const state = get()
    withWorkspaceUpdate(state, set, (workspace) => {
      const composeNode = workspace.nodes.find((node) => node.id === composeNodeId && node.kind === 'compose')
      if (!composeNode) return workspace
      const config = composeNode.config as CanvasNodeConfigMap['compose']

      let nextWorkspace: CanvasWorkspace = {
        ...workspace,
        nodes: workspace.nodes.map((node) =>
          node.id === composeNodeId
            ? {
                ...node,
                config: {
                  ...config,
                  items: config.items.map((item) =>
                    item.id === itemId
                      ? {
                          ...item,
                          ...patch,
                        }
                      : item,
                  ),
                },
                updatedAt: Date.now(),
              }
            : node,
        ),
        updatedAt: Date.now(),
      }
      nextWorkspace = synchronizeNodeArtifacts(nextWorkspace, composeNodeId, state.assetsById)
      nextWorkspace = markDescendantsStale(nextWorkspace, composeNodeId)
      return nextWorkspace
    })
  },

  selectComposeItem: async (composeNodeId, itemId) => {
    const state = get()
    withWorkspaceUpdate(state, set, (workspace) => {
      const composeNode = workspace.nodes.find((node) => node.id === composeNodeId && node.kind === 'compose')
      if (!composeNode) return workspace
      const config = composeNode.config as CanvasNodeConfigMap['compose']
      return {
        ...workspace,
        nodes: workspace.nodes.map((node) =>
          node.id === composeNodeId
            ? {
                ...node,
                config: {
                  ...config,
                  selectedItemId: itemId,
                },
                updatedAt: Date.now(),
              }
            : node,
        ),
        updatedAt: Date.now(),
      }
    })
  },

  moveComposeItemLayer: async (composeNodeId, itemId, direction) => {
    const state = get()
    withWorkspaceUpdate(state, set, (workspace) => {
      const composeNode = workspace.nodes.find((node) => node.id === composeNodeId && node.kind === 'compose')
      if (!composeNode) return workspace
      const config = composeNode.config as CanvasNodeConfigMap['compose']
      const items = [...config.items].sort((a, b) => a.zIndex - b.zIndex)
      const index = items.findIndex((item) => item.id === itemId)
      if (index < 0) return workspace
      const targetIndex =
        direction === 'up'
          ? Math.min(items.length - 1, index + 1)
          : Math.max(0, index - 1)
      if (targetIndex === index) return workspace

      const [moved] = items.splice(index, 1)
      items.splice(targetIndex, 0, moved)

      const nextItems = items.map((item, nextIndex) => ({
        ...item,
        zIndex: nextIndex,
      }))

      let nextWorkspace: CanvasWorkspace = {
        ...workspace,
        nodes: workspace.nodes.map((node) =>
          node.id === composeNodeId
            ? {
                ...node,
                config: {
                  ...config,
                  items: nextItems,
                },
                updatedAt: Date.now(),
              }
            : node,
        ),
        updatedAt: Date.now(),
      }
      nextWorkspace = synchronizeNodeArtifacts(nextWorkspace, composeNodeId, state.assetsById)
      nextWorkspace = markDescendantsStale(nextWorkspace, composeNodeId)
      return nextWorkspace
    })
  },

  duplicateComposeItem: async (composeNodeId, itemId) => {
    const state = get()
    withWorkspaceUpdate(state, set, (workspace) => {
      const composeNode = workspace.nodes.find((node) => node.id === composeNodeId && node.kind === 'compose')
      if (!composeNode) return workspace
      const config = composeNode.config as CanvasNodeConfigMap['compose']
      const item = config.items.find((entry) => entry.id === itemId)
      if (!item) return workspace

      const duplicate: ComposeItem = {
        ...item,
        id: generateId(),
        x: item.x + 20,
        y: item.y + 20,
        zIndex: config.items.length,
      }

      let nextWorkspace: CanvasWorkspace = {
        ...workspace,
        nodes: workspace.nodes.map((node) =>
          node.id === composeNodeId
            ? {
                ...node,
                config: {
                  ...config,
                  items: [...config.items, duplicate],
                  selectedItemId: duplicate.id,
                },
                updatedAt: Date.now(),
              }
            : node,
        ),
        updatedAt: Date.now(),
      }
      nextWorkspace = synchronizeNodeArtifacts(nextWorkspace, composeNodeId, state.assetsById)
      nextWorkspace = markDescendantsStale(nextWorkspace, composeNodeId)
      return nextWorkspace
    })
  },

  removeComposeItem: async (composeNodeId, itemId) => {
    const state = get()
    withWorkspaceUpdate(state, set, (workspace) => {
      const composeNode = workspace.nodes.find((node) => node.id === composeNodeId && node.kind === 'compose')
      if (!composeNode) return workspace
      const config = composeNode.config as CanvasNodeConfigMap['compose']
      const nextItems = config.items
        .filter((item) => item.id !== itemId)
        .map((item, index) => ({
          ...item,
          zIndex: index,
        }))

      let nextWorkspace: CanvasWorkspace = {
        ...workspace,
        nodes: workspace.nodes.map((node) =>
          node.id === composeNodeId
            ? {
                ...node,
                config: {
                  ...config,
                  items: nextItems,
                  selectedItemId:
                    config.selectedItemId === itemId
                      ? nextItems[nextItems.length - 1]?.id || null
                      : config.selectedItemId,
                },
                updatedAt: Date.now(),
              }
            : node,
        ),
        updatedAt: Date.now(),
      }
      nextWorkspace = synchronizeNodeArtifacts(nextWorkspace, composeNodeId, state.assetsById)
      nextWorkspace = markDescendantsStale(nextWorkspace, composeNodeId)
      return nextWorkspace
    })
  },
}))

export function useActiveCanvasWorkspace() {
  return useCanvasLabStore((state) => getActiveWorkspace(state))
}

export function useCanvasNode(nodeId: string | null) {
  const workspace = useActiveCanvasWorkspace()

  return useMemo(() => {
    if (!workspace || !nodeId) return null
    return workspace.nodes.find((node) => node.id === nodeId) || null
  }, [workspace, nodeId])
}

export function useCanvasNodeArtifacts(nodeId: string | null) {
  const workspace = useActiveCanvasWorkspace()

  return useMemo(() => {
    if (!workspace || !nodeId) return []
    return workspace.artifacts
      .filter((artifact) => artifact.nodeId === nodeId)
      .sort((a, b) => a.updatedAt - b.updatedAt)
  }, [workspace, nodeId])
}

export function useCanvasNodeThread(nodeId: string | null) {
  const workspace = useActiveCanvasWorkspace()

  return useMemo(() => {
    if (!workspace || !nodeId) return []
    return getNodeThreadMessages(workspace, nodeId)
  }, [workspace, nodeId])
}

export function useCanvasWorkspacePreview(nodeId: string | null) {
  const workspace = useActiveCanvasWorkspace()

  return useMemo(() => {
    if (!workspace || !nodeId) return ''
    const artifact = workspace.artifacts
      .filter((entry) => entry.nodeId === nodeId)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0]
    return artifact ? artifactPreviewText(artifact) : ''
  }, [workspace, nodeId])
}
