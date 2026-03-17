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
  CanvasExecutionOutputPayload,
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
  PackagingBriefConfig,
  PackagingOutputNodeKind,
  PackagingOutputSelectionMap,
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
  buildDefaultEdges,
  createCanvasNode,
  createDefaultPackagingOutputSelections,
  createInitialCanvasWorkspace,
  deriveTranscriptArtifacts,
  getDefaultCanvasPosition,
  normalizeCanvasWorkspace,
  PACKAGING_OUTPUT_NODE_KINDS,
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
  openDebugNodeId: string | null
  hydrate: () => Promise<void>
  createWorkspace: (name?: string) => Promise<string>
  deleteWorkspace: (workspaceId: string) => Promise<void>
  renameWorkspace: (workspaceId: string, name: string) => Promise<void>
  setActiveWorkspaceId: (workspaceId: string | null) => void
  setSelectedNodeId: (nodeId: string | null) => void
  setOpenComposeNodeId: (nodeId: string | null) => void
  setOpenDebugNodeId: (nodeId: string | null) => void
  addNode: (kind: Extract<CanvasLabNodeKind, 'chat' | 'image_prompt' | 'image_generate' | 'asset_library' | 'compose'>) => Promise<void>
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

const CONNECTION_RULES: Partial<Record<CanvasLabNodeKind, CanvasLabNodeKind[]>> = {
  transcript_source: ['core_hook', 'description', 'titles', 'chapters', 'hashtags', 'thumbnail_copy', 'image_prompt', 'chat'],
  titles: ['image_prompt', 'compose'],
  description: ['compose'],
  thumbnail_copy: ['image_prompt', 'compose'],
  image_prompt: ['image_generate'],
  image_generate: ['compose'],
  asset_library: ['image_generate', 'compose'],
}

const MANUAL_NODE_KINDS: Array<Extract<CanvasLabNodeKind, 'chat' | 'image_prompt' | 'image_generate' | 'asset_library' | 'compose'>> = [
  'chat',
  'image_prompt',
  'image_generate',
  'asset_library',
  'compose',
]

const AUTOMATIC_PACKAGING_NODE_KINDS = new Set<PackagingOutputNodeKind>(PACKAGING_OUTPUT_NODE_KINDS)

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

function loadPackagingOutputSelections(): PackagingOutputSelectionMap {
  const selections = createDefaultPackagingOutputSelections()

  try {
    const raw = localStorage.getItem('yt-assist-output-types')
    if (!raw) return selections
    const parsed = JSON.parse(raw) as Array<{ id?: string; enabled?: boolean; quantity?: number }>

    for (const output of parsed) {
      switch (output.id) {
        case 'core-hook':
          selections.core_hook = {
            enabled: output.enabled ?? selections.core_hook.enabled,
            count: selections.core_hook.count,
          }
          break
        case 'descriptions':
          selections.description = {
            enabled: output.enabled ?? selections.description.enabled,
            count: output.quantity || selections.description.count,
          }
          break
        case 'titles-thumbnails':
          selections.titles = {
            enabled: output.enabled ?? selections.titles.enabled,
            count: output.quantity || selections.titles.count,
          }
          break
        case 'extra-thumbnails':
          selections.thumbnail_copy = {
            enabled: output.enabled ?? selections.thumbnail_copy.enabled,
            count: output.quantity || selections.thumbnail_copy.count,
          }
          break
        case 'chapters':
          selections.chapters = {
            enabled: output.enabled ?? selections.chapters.enabled,
            count: selections.chapters.count,
          }
          break
        case 'hashtags':
          selections.hashtags = {
            enabled: output.enabled ?? selections.hashtags.enabled,
            count: output.quantity || selections.hashtags.count,
          }
          break
      }
    }
  } catch {
    // Ignore broken local storage and fall back to defaults.
  }

  return selections
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

function getNodeById(workspace: CanvasWorkspace, nodeId: string) {
  return workspace.nodes.find((node) => node.id === nodeId) || null
}

function getNodeByKind(workspace: CanvasWorkspace, kind: CanvasLabNodeKind) {
  return workspace.nodes.find((node) => node.kind === kind) || null
}

function canConnectCanvasNodes(sourceKind: CanvasLabNodeKind, targetKind: CanvasLabNodeKind) {
  return CONNECTION_RULES[sourceKind]?.includes(targetKind) || false
}

function isPackagingOutputNodeKind(kind: CanvasLabNodeKind): kind is PackagingOutputNodeKind {
  return AUTOMATIC_PACKAGING_NODE_KINDS.has(kind as PackagingOutputNodeKind)
}

function getTranscriptSourceConfig(node: CanvasNode | null) {
  if (!node || node.kind !== 'transcript_source') return null
  return node.config as CanvasNodeConfigMap['transcript_source']
}

function getSelectedPackagingOutputKinds(config: CanvasNodeConfigMap['transcript_source']) {
  return PACKAGING_OUTPUT_NODE_KINDS.filter((kind) => config.selectedOutputs[kind]?.enabled)
}

function getPackagingSelectionCount(config: CanvasNodeConfigMap['transcript_source'], kind: PackagingOutputNodeKind) {
  return config.selectedOutputs[kind]?.count || createDefaultPackagingOutputSelections()[kind].count
}

function orderWorkspaceNodes(nodes: CanvasNode[]) {
  return [...nodes].sort((left, right) => {
    if (left.position.x === right.position.x) {
      return left.position.y - right.position.y
    }
    return left.position.x - right.position.x
  })
}

function getNextNodePosition(workspace: CanvasWorkspace, kind: CanvasLabNodeKind) {
  const base = getDefaultCanvasPosition(kind)
  const existing = workspace.nodes.find((node) => node.kind === kind)
  if (existing) return existing.position

  const kindCount = workspace.nodes.filter((node) => node.kind === kind).length
  return {
    x: base.x + kindCount * 32,
    y: base.y + kindCount * 24,
  }
}

function ensureNodeInWorkspace(
  workspace: CanvasWorkspace,
  kind: CanvasLabNodeKind,
  settings = useSettingsStore.getState().settings,
) {
  const existing = getNodeByKind(workspace, kind)
  if (existing) return { workspace, node: existing }

  const nextNode = createCanvasNode(kind, settings)
  const position = getNextNodePosition(workspace, kind)
  nextNode.position = position

  const nextWorkspace = {
    ...workspace,
    nodes: orderWorkspaceNodes([...workspace.nodes, nextNode]),
    updatedAt: Date.now(),
  }

  return { workspace: nextWorkspace, node: nextNode }
}

function withDefaultEdges(workspace: CanvasWorkspace) {
  const nodeIdByKind = Object.fromEntries(workspace.nodes.map((node) => [node.kind, node.id])) as Partial<Record<CanvasLabNodeKind, string>>
  const defaultEdges = buildDefaultEdges(nodeIdByKind)
  const seen = new Set(workspace.edges.map((edge) => `${edge.source}:${edge.target}`))
  const extraEdges = defaultEdges.filter((edge) => !seen.has(`${edge.source}:${edge.target}`))
  if (extraEdges.length === 0) return workspace
  return {
    ...workspace,
    edges: [...workspace.edges, ...extraEdges],
    updatedAt: Date.now(),
  }
}

function ensureTranscriptOutputNodes(
  workspace: CanvasWorkspace,
  outputKinds: PackagingOutputNodeKind[],
) {
  let nextWorkspace = workspace
  const transcriptConfig = getTranscriptSourceConfig(getNodeByKind(workspace, 'transcript_source'))
  for (const kind of outputKinds) {
    nextWorkspace = ensureNodeInWorkspace(nextWorkspace, kind).workspace
  }

  if (transcriptConfig) {
    nextWorkspace = {
      ...nextWorkspace,
      nodes: nextWorkspace.nodes.map((node) =>
        isPackagingOutputNodeKind(node.kind)
          ? {
              ...node,
              config: {
                ...(node.config as CanvasNodeConfigMap['titles']),
                requestedCount: getPackagingSelectionCount(transcriptConfig, node.kind),
              },
            }
          : node,
      ),
      updatedAt: Date.now(),
    }
  }

  return withDefaultEdges(nextWorkspace)
}

function ensureManualNode(
  workspace: CanvasWorkspace,
  kind: Extract<CanvasLabNodeKind, 'chat' | 'image_prompt' | 'image_generate' | 'asset_library' | 'compose'>,
) {
  return withDefaultEdges(ensureNodeInWorkspace(workspace, kind).workspace)
}

function getConnectionErrorMessage(
  workspace: CanvasWorkspace,
  sourceId: string,
  targetId: string,
) {
  const sourceNode = getNodeById(workspace, sourceId)
  const targetNode = getNodeById(workspace, targetId)

  if (!sourceNode || !targetNode) {
    return 'Canvas Lab could not find one of the selected nodes.'
  }

  if (sourceNode.id === targetNode.id) {
    return 'A node cannot connect to itself.'
  }

  if (workspace.edges.some((edge) => edge.source === sourceId && edge.target === targetId)) {
    return `${sourceNode.label} is already connected to ${targetNode.label}.`
  }

  if (!canConnectCanvasNodes(sourceNode.kind, targetNode.kind)) {
    const allowedTargets = CONNECTION_RULES[sourceNode.kind] || []
    const allowedLabels = allowedTargets
      .map((kind) => workspace.nodes.find((node) => node.kind === kind)?.label || kind)
      .join(', ')

    return allowedLabels
      ? `${sourceNode.label} cannot connect to ${targetNode.label}. Allowed targets: ${allowedLabels}.`
      : `${sourceNode.label} cannot connect to ${targetNode.label}.`
  }

  return null
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

function formatBriefArtifactContent(config: PackagingBriefConfig) {
  return [
    config.mustInclude ? `Must include: ${config.mustInclude}` : null,
    config.niceToInclude ? `Nice to include: ${config.niceToInclude}` : null,
    config.avoidWords ? `Avoid: ${config.avoidWords}` : null,
    config.includeName && config.nameForTitles
      ? `Use name in titles: ${config.nameForTitles}`
      : null,
    config.additionalContext ? `Packaging directions: ${config.additionalContext}` : null,
    `Transcript timestamps preferred: ${config.transcriptIncludeTimestamps ? 'yes' : 'no'}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function hasBriefConfigContent(config: PackagingBriefConfig) {
  return Boolean(
    config.mustInclude.trim() ||
      config.niceToInclude.trim() ||
      config.avoidWords.trim() ||
      config.additionalContext.trim() ||
      (config.includeName && config.nameForTitles.trim()) ||
      !config.transcriptIncludeTimestamps,
  )
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

    const existing = nextArtifacts.find(
      (artifact) => artifact.nodeId === node.id && artifact.kind === 'brief',
    )
    upsertAtIndex(
      upsertArtifactItems(existing, {
        nodeId: node.id,
        kind: 'brief',
        label: 'Packaging brief',
        content: formatBriefArtifactContent(config.brief),
        items: [],
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
    case 'core_hook':
      return 'core_hook'
    case 'description':
      return 'description'
    case 'titles':
      return 'title_suggestions'
    case 'chapters':
      return 'chapter_list'
    case 'hashtags':
      return 'hashtags'
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
    case 'core_hook':
      return 'Core hook'
    case 'description':
      return 'Description'
    case 'titles':
      return 'Generated titles'
    case 'chapters':
      return 'Chapter list'
    case 'hashtags':
      return 'Hashtags'
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
  const sourceNode = ancestorNodes.find((node) => node.kind === 'transcript_source')
  if (!sourceNode) return null
  return (sourceNode.config as CanvasNodeConfigMap['transcript_source']).brief
}

function extractSelectedOutputs(ancestorNodes: CanvasNode[]) {
  const sourceNode = ancestorNodes.find((node) => node.kind === 'transcript_source')
  if (!sourceNode) return null
  return (sourceNode.config as CanvasNodeConfigMap['transcript_source']).selectedOutputs
}

function getTranscriptSourceNode(ancestorNodes: CanvasNode[]) {
  return ancestorNodes.find((node) => node.kind === 'transcript_source') || null
}

function hasTranscriptContent(node: CanvasNode | null) {
  if (!node || node.kind !== 'transcript_source') return false
  const config = node.config as CanvasNodeConfigMap['transcript_source']
  return Boolean(config.transcript.trim())
}

function hasImagePromptArtifact(artifacts: Artifact[]) {
  return artifacts.some((artifact) => {
    if (artifact.kind !== 'image_prompt') return false
    if (artifact.content?.trim()) return true
    return artifact.items.some((item) => item.text.trim())
  })
}

function hasImagePromptContext(artifacts: Artifact[], transcriptNode: CanvasNode | null) {
  if (hasTranscriptContent(transcriptNode)) {
    return true
  }

  return artifacts.some((artifact) => {
    if (artifact.kind === 'title_suggestions' || artifact.kind === 'thumbnail_copy') {
      return artifact.items.some((item) => item.text.trim())
    }

    return artifact.kind === 'transcript_digest' || artifact.kind === 'key_hooks'
      ? Boolean(artifact.content?.trim())
      : false
  })
}

function getNodeExecutionError(
  node: CanvasNode,
  ancestorNodes: CanvasNode[],
  artifacts: Artifact[],
  options?: { requestedCount?: number; message?: string },
) {
  const transcriptNode = getTranscriptSourceNode(ancestorNodes)

  switch (node.kind) {
    case 'transcript_source':
      if (!hasTranscriptContent(node)) {
        return 'Paste a transcript into Transcript Source before running packaging.'
      }
      if (getSelectedPackagingOutputKinds(node.config as CanvasNodeConfigMap['transcript_source']).length === 0) {
        return 'Select at least one packaging output before running Transcript Source.'
      }
      return null
    case 'core_hook':
    case 'description':
    case 'titles':
    case 'chapters':
    case 'hashtags':
    case 'thumbnail_copy':
      if (!transcriptNode) {
        return `Connect Transcript Source to ${node.label} before running it.`
      }
      if (!hasTranscriptContent(transcriptNode)) {
        return `Paste a transcript into Transcript Source before running ${node.label}.`
      }
      return null
    case 'image_prompt':
      if (!hasImagePromptContext(artifacts, transcriptNode)) {
        return 'Connect Transcript Source, Titles, or Thumbnail Copy to Image Prompt before running it.'
      }
      return null
    case 'image_generate':
      if (!hasImagePromptArtifact(artifacts)) {
        return 'Connect Image Prompt to Image Gen and run Image Prompt first.'
      }
      return null
    case 'chat':
      if (!options?.message?.trim()) {
        return 'Enter a prompt in the Chat node before running it.'
      }
      return null
    default:
      return null
  }
}

function getRunProvider(node: CanvasNode): NodeRun['provider'] {
  if (node.kind === 'image_generate') {
    return 'gemini'
  }

  if (node.kind === 'chat') {
    return (node.config as CanvasNodeConfigMap['chat']).provider === 'anthropic'
      ? 'anthropic'
      : 'openai'
  }

  return 'openai'
}

function getRunModel(node: CanvasNode) {
  if (node.kind === 'chat') {
    return (node.config as CanvasNodeConfigMap['chat']).model
  }

  if (node.kind === 'image_generate') {
    return (node.config as CanvasNodeConfigMap['image_generate']).model
  }

  return 'gpt-5.2'
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

function toArtifactItems(payload: CanvasExecutionOutputPayload | undefined) {
  return (payload?.items || []).map((item) => ({
    id: generateId(),
    text: item.text,
    secondaryText: item.secondaryText,
    meta: item.meta,
  }))
}

function upsertGeneratedArtifactForNode(
  workspace: CanvasWorkspace,
  node: CanvasNode,
  payload: CanvasExecutionOutputPayload | undefined,
) {
  const artifactKind = artifactKindForNode(node.kind)
  if (!artifactKind || !payload) return workspace

  const existingArtifact = workspace.artifacts.find(
    (artifact) => artifact.nodeId === node.id && artifact.kind === artifactKind,
  )

  const nextArtifact = upsertArtifactItems(existingArtifact, {
    nodeId: node.id,
    kind: artifactKind,
    label: labelForGeneratedArtifact(node),
    content: payload.content,
    items: toArtifactItems(payload),
  })

  return {
    ...workspace,
    artifacts: [
      ...workspace.artifacts.filter((artifact) => artifact.id !== existingArtifact?.id),
      nextArtifact,
    ].sort((left, right) => left.createdAt - right.createdAt),
    updatedAt: Date.now(),
  }
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
  openDebugNodeId: null,

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
          openDebugNodeId: null,
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
      openDebugNodeId: null,
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
      openDebugNodeId: null,
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
      openDebugNodeId: null,
    })
    saveActiveWorkspaceId(workspaceId)
  },

  setSelectedNodeId: (nodeId) => {
    set({ selectedNodeId: nodeId })
  },

  setOpenComposeNodeId: (nodeId) => {
    set({ openComposeNodeId: nodeId })
  },

  setOpenDebugNodeId: (nodeId) => {
    set({ openDebugNodeId: nodeId })
  },

  addNode: async (kind) => {
    const state = get()
    if (!MANUAL_NODE_KINDS.includes(kind)) return

    withWorkspaceUpdate(state, set, (workspace) => ensureManualNode(workspace, kind))
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
      const errorMessage = getConnectionErrorMessage(
        workspace,
        connection.source!,
        connection.target!,
      )

      if (errorMessage) {
        toast.error(errorMessage)
        return workspace
      }

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
      let nextNodes = workspace.nodes.map((node) => {
        if (node.id !== nodeId) return node
        return {
          ...node,
          config: updater(node.config),
          updatedAt: Date.now(),
        }
      })

      const updatedNode = nextNodes.find((node) => node.id === nodeId)
      if (updatedNode?.kind === 'transcript_source') {
        const transcriptConfig = updatedNode.config as CanvasNodeConfigMap['transcript_source']
        nextNodes = nextNodes.map((node) => {
          if (!isPackagingOutputNodeKind(node.kind)) return node
          return {
            ...node,
            config: {
              ...(node.config as CanvasNodeConfigMap['titles']),
              requestedCount: getPackagingSelectionCount(transcriptConfig, node.kind),
            },
            updatedAt: Date.now(),
          }
        })
      }

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
    let workspace = getActiveWorkspace(state)
    if (!workspace) return
    const node = workspace.nodes.find((entry) => entry.id === nodeId)
    if (!node) return

    if (node.kind === 'transcript_source') {
      workspace = synchronizeNodeArtifacts(workspace, nodeId, state.assetsById)
    }

    const { ancestorNodes, artifacts } = collectAncestorArtifacts(workspace, nodeId)
    const executionError = getNodeExecutionError(node, ancestorNodes, artifacts, options)
    if (executionError) {
      const runId = generateId()
      const failedRun: NodeRun = {
        id: runId,
        nodeId,
        status: 'error',
        startedAt: Date.now(),
        completedAt: Date.now(),
        provider: getRunProvider(node),
        model: getRunModel(node),
        requestedCount: options?.requestedCount,
        error: executionError,
      }

      withWorkspaceUpdate(state, set, (currentWorkspace) => ({
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
        runs: [failedRun, ...currentWorkspace.runs],
        updatedAt: Date.now(),
      }))
      toast.error(executionError)
      return
    }

    const transcript =
      node.kind === 'transcript_source'
        ? (node.config as CanvasNodeConfigMap['transcript_source']).artifacts
        : extractTranscript(ancestorNodes)
    const brief =
      node.kind === 'transcript_source'
        ? (node.config as CanvasNodeConfigMap['transcript_source']).brief
        : extractBrief(ancestorNodes)
    const selectedOutputs =
      node.kind === 'transcript_source'
        ? (node.config as CanvasNodeConfigMap['transcript_source']).selectedOutputs
        : extractSelectedOutputs(ancestorNodes)

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
      provider: getRunProvider(node),
      model: getRunModel(node),
      requestedCount: options?.requestedCount,
      sourceRunId:
        node.kind !== 'transcript_source'
          ? getTranscriptSourceNode(ancestorNodes)?.lastRunId
          : undefined,
    }

    const selectedOutputKinds =
      node.kind === 'transcript_source'
        ? getSelectedPackagingOutputKinds(node.config as CanvasNodeConfigMap['transcript_source'])
        : []

    let runningWorkspace = withWorkspaceUpdate(state, set, (currentWorkspace) => {
      let nextWorkspace = currentWorkspace

      if (node.kind === 'transcript_source') {
        nextWorkspace = ensureTranscriptOutputNodes(nextWorkspace, selectedOutputKinds)
      }

      nextWorkspace = synchronizeNodeArtifacts(nextWorkspace, nodeId, state.assetsById)

      return {
        ...nextWorkspace,
        nodes: nextWorkspace.nodes.map((entry) => {
          if (entry.id === nodeId || (node.kind === 'transcript_source' && selectedOutputKinds.includes(entry.kind as PackagingOutputNodeKind))) {
            return {
              ...entry,
              status: 'running',
              lastRunId: entry.id === nodeId ? runId : entry.lastRunId,
              updatedAt: Date.now(),
            }
          }

          return entry
        }),
        runs: [run, ...nextWorkspace.runs],
        threadMessages: nextUserMessage
          ? [...nextWorkspace.threadMessages, nextUserMessage]
          : nextWorkspace.threadMessages,
        updatedAt: Date.now(),
      }
    })

    if (!runningWorkspace) return

    const activeNode = runningWorkspace.nodes.find((entry) => entry.id === nodeId)
    if (!activeNode) return

    const request: Omit<CanvasExecuteNodeRequest, 'packagingModel'> = {
      nodeKind: activeNode.kind,
      nodeLabel: activeNode.label,
      requestedCount:
        options?.requestedCount ||
        (activeNode.kind === 'core_hook' ||
        activeNode.kind === 'description' ||
        activeNode.kind === 'titles' ||
        activeNode.kind === 'thumbnail_copy' ||
        activeNode.kind === 'chapters' ||
        activeNode.kind === 'hashtags' ||
        activeNode.kind === 'image_prompt'
          ? (activeNode.config as CanvasNodeConfigMap['titles']).requestedCount
          : undefined),
      thread: [...threadMessages, ...(nextUserMessage ? [nextUserMessage] : [])].map((message) => ({
        role: message.role,
        text: message.text,
      })),
      transcript: transcript || undefined,
      brief: brief || undefined,
      selectedOutputs:
        activeNode.kind === 'transcript_source'
          ? selectedOutputs || undefined
          : undefined,
      sourceRunId:
        activeNode.kind !== 'transcript_source'
          ? getTranscriptSourceNode(ancestorNodes)?.lastRunId || undefined
          : undefined,
      artifacts:
        activeNode.kind === 'transcript_source'
          ? []
          : toRequestArtifacts(artifacts),
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
        activeNode.kind === 'transcript_source'
          ? `${selectedOutputKinds.length} packaging output${selectedOutputKinds.length === 1 ? '' : 's'} updated`
          : response.content?.trim() ||
            response.items?.slice(0, 2).map((item) => item.text).join(' · ') ||
            `${activeNode.label} updated`

      const assistantMessage = createThreadMessage(nodeId, 'assistant', assistantPreview)
      const nextAssetRecords: StoredCanvasAsset[] = []
      const nextArtifactItems: ArtifactItem[] = []

      if (activeNode.kind === 'transcript_source') {
        const outputRunIds = Object.fromEntries(
          selectedOutputKinds.map((kind) => [kind, generateId()]),
        ) as Record<PackagingOutputNodeKind, string>

        withWorkspaceUpdate(get(), set, (currentWorkspace) => {
          let nextWorkspace = currentWorkspace

          nextWorkspace = {
            ...nextWorkspace,
            nodes: nextWorkspace.nodes.map((entry) => {
              if (entry.id === nodeId) {
                return {
                  ...entry,
                  status: 'complete',
                  lastRunId: runId,
                  updatedAt: Date.now(),
                }
              }

              if (selectedOutputKinds.includes(entry.kind as PackagingOutputNodeKind)) {
                return {
                  ...entry,
                  status: 'complete',
                  lastRunId: outputRunIds[entry.kind as PackagingOutputNodeKind],
                  updatedAt: Date.now(),
                }
              }

              return entry
            }),
            runs: nextWorkspace.runs.map((entry) =>
              entry.id === runId
                ? {
                    ...entry,
                    status: 'complete',
                    completedAt: Date.now(),
                    provider: response.provider,
                    model: response.model,
                    warnings: response.warnings,
                    requestPreview: response.requestPreview,
                    responsePreview: response.responsePreview,
                  }
                : entry,
            ),
            threadMessages: [...nextWorkspace.threadMessages, assistantMessage],
            updatedAt: Date.now(),
          }

          nextWorkspace = {
            ...nextWorkspace,
            runs: [
              ...selectedOutputKinds.map((kind) => ({
                id: outputRunIds[kind],
                nodeId: getNodeByKind(nextWorkspace, kind)?.id || '',
                status: 'complete' as const,
                startedAt: Date.now(),
                completedAt: Date.now(),
                provider: response.provider,
                model: response.model,
                requestedCount: selectedOutputs?.[kind]?.count,
                requestPreview: response.requestPreview,
                responsePreview: JSON.stringify(response.outputs?.[kind] || {}, null, 2),
                sourceRunId: runId,
              })).filter((entry) => entry.nodeId),
              ...nextWorkspace.runs,
            ],
          }

          nextWorkspace = synchronizeNodeArtifacts(nextWorkspace, nodeId, get().assetsById)

          for (const outputKind of selectedOutputKinds) {
            const outputNode = getNodeByKind(nextWorkspace, outputKind)
            if (!outputNode) continue
            nextWorkspace = upsertGeneratedArtifactForNode(
              nextWorkspace,
              outputNode,
              response.outputs?.[outputKind],
            )
          }

          for (const outputKind of selectedOutputKinds) {
            const outputNode = getNodeByKind(nextWorkspace, outputKind)
            if (!outputNode) continue
            nextWorkspace = markDescendantsStale(nextWorkspace, outputNode.id)
          }

          return nextWorkspace
        })
        return
      }

      const outputSourceRunId = getTranscriptSourceNode(ancestorNodes)?.lastRunId
      const assistantRefinementMessage = createThreadMessage(nodeId, 'assistant', assistantPreview)

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
                  requestPreview: response.requestPreview,
                  responsePreview: response.responsePreview,
                  sourceRunId: outputSourceRunId || entry.sourceRunId,
                }
              : entry,
          ),
          threadMessages: [...currentWorkspace.threadMessages, assistantRefinementMessage],
          updatedAt: Date.now(),
        }

        const artifactKind = artifactKindForNode(activeNode.kind)
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
          entry.id === nodeId || (node.kind === 'transcript_source' && selectedOutputKinds.includes(entry.kind as PackagingOutputNodeKind))
            ? {
                ...entry,
                status: 'error',
                lastRunId: entry.id === nodeId ? runId : entry.lastRunId,
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
    const selectedOutputs = loadPackagingOutputSelections()

    withWorkspaceUpdate(state, set, (currentWorkspace) => {
      let nextNodes = currentWorkspace.nodes.map((node) => {
        if (node.kind === 'transcript_source') {
          const artifacts = deriveTranscriptArtifacts(packaging.transcript)
          const brief: PackagingBriefConfig = {
            mustInclude: packaging.mustInclude,
            niceToInclude: packaging.niceToInclude,
            avoidWords: packaging.avoidWords,
            includeName: packaging.includeName,
            nameForTitles: packaging.nameForTitles,
            additionalContext: packaging.additionalContext,
            transcriptIncludeTimestamps: packaging.transcriptIncludeTimestamps,
          }

          return {
            ...node,
            status: packaging.transcript.trim() || hasBriefConfigContent(brief) ? 'complete' : 'idle',
            config: {
              transcript: packaging.transcript,
              artifacts,
              brief,
              selectedOutputs,
            },
            updatedAt: Date.now(),
          }
        }

        return node
      })

      nextNodes = nextNodes.map((node) =>
        isPackagingOutputNodeKind(node.kind)
          ? {
              ...node,
              config: {
                ...(node.config as CanvasNodeConfigMap['titles']),
                requestedCount: selectedOutputs[node.kind].count,
              },
            }
          : node,
      )

      let nextWorkspace: CanvasWorkspace = {
        ...currentWorkspace,
        nodes: nextNodes,
        updatedAt: Date.now(),
      }
      nextWorkspace = synchronizeNodeArtifacts(
        nextWorkspace,
        nextNodes.find((node) => node.kind === 'transcript_source')?.id || '',
        state.assetsById,
      )
      nextWorkspace = markDescendantsStale(nextWorkspace, nextNodes.find((node) => node.kind === 'transcript_source')?.id || '')
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

    withWorkspaceUpdate(state, set, (currentWorkspace) => {
      const nextWorkspace = ensureManualNode(currentWorkspace, 'chat')
      const chatNode = nextWorkspace.nodes.find((node) => node.kind === 'chat')
      if (!chatNode) return currentWorkspace

      return {
        ...nextWorkspace,
        threadMessages: [
          ...nextWorkspace.threadMessages.filter((message) => message.nodeId !== chatNode.id),
          ...chatMessages.map((message) => createThreadMessage(chatNode.id, message.role, message.text)),
        ],
        nodes: nextWorkspace.nodes.map((node) =>
          node.id === chatNode.id
            ? {
                ...node,
                status: 'complete',
                updatedAt: Date.now(),
              }
            : node,
        ),
        updatedAt: Date.now(),
      }
    })

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
      const nextWorkspaceWithNode = ensureManualNode(currentWorkspace, 'asset_library')
      const ensuredAssetLibraryNode = nextWorkspaceWithNode.nodes.find((node) => node.kind === 'asset_library')
      if (!ensuredAssetLibraryNode) return currentWorkspace

      const nextWorkspace: CanvasWorkspace = {
        ...nextWorkspaceWithNode,
        nodes: nextWorkspaceWithNode.nodes.map((node) =>
          node.id === ensuredAssetLibraryNode.id
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

      const synced = synchronizeNodeArtifacts(nextWorkspace, ensuredAssetLibraryNode.id, {
        ...get().assetsById,
        ...materializedAssets,
      })
      return markDescendantsStale(synced, ensuredAssetLibraryNode.id)
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

export function useCanvasNodeLatestRun(nodeId: string | null) {
  const workspace = useActiveCanvasWorkspace()

  return useMemo(() => {
    if (!workspace || !nodeId) return null
    return (
      workspace.runs
        .filter((run) => run.nodeId === nodeId)
        .sort((a, b) => b.startedAt - a.startedAt)[0] || null
    )
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
