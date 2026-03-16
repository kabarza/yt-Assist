import type { Edge, Node } from '@xyflow/react'
import type { Provider } from '@/types/chat'
import type { ImageAspectRatio, ImageGenerationModel, ImageSize } from '@/types/images'

export type CanvasLabNodeKind =
  | 'transcript_source'
  | 'packaging_brief'
  | 'titles'
  | 'summary'
  | 'chapters'
  | 'thumbnail_copy'
  | 'image_prompt'
  | 'image_generate'
  | 'chat'
  | 'asset_library'
  | 'compose'

export type CanvasLabNodeStatus = 'idle' | 'running' | 'complete' | 'stale' | 'error'

export type ArtifactKind =
  | 'raw_transcript'
  | 'transcript_digest'
  | 'timestamp_map'
  | 'key_hooks'
  | 'brief'
  | 'title_suggestions'
  | 'summary'
  | 'chapter_list'
  | 'thumbnail_copy'
  | 'image_prompt'
  | 'chat_answer'
  | 'generated_image'
  | 'asset_reference'
  | 'compose_plan'

export interface ArtifactItem {
  id: string
  text: string
  secondaryText?: string
  meta?: Record<string, string | number | boolean | null>
  assetId?: string
  accepted?: boolean
  pinned?: boolean
}

export interface Artifact {
  id: string
  nodeId: string
  kind: ArtifactKind
  label: string
  content?: string
  items: ArtifactItem[]
  createdAt: number
  updatedAt: number
}

export interface NodeRun {
  id: string
  nodeId: string
  status: 'running' | 'complete' | 'error'
  startedAt: number
  completedAt?: number
  provider: 'openai' | 'anthropic' | 'gemini' | 'local'
  model: string
  requestedCount?: number
  warnings?: string[]
  error?: string
}

export interface NodeThreadMessage {
  id: string
  nodeId: string
  role: 'user' | 'assistant' | 'system'
  text: string
  createdAt: number
}

export interface TranscriptArtifacts {
  rawTranscript: string
  digest: string
  timestampMap: string
  keyHooks: string[]
}

export interface PackagingBriefConfig {
  mustInclude: string
  niceToInclude: string
  avoidWords: string
  includeName: boolean
  nameForTitles: string
  additionalContext: string
  transcriptIncludeTimestamps: boolean
}

export interface OutputNodeConfig {
  requestedCount: number
  draftInstruction: string
}

export interface ChatNodeConfig {
  provider: Provider
  model: string
  draftPrompt: string
  systemPrompt: string
}

export interface ImageGenerateNodeConfig {
  model: ImageGenerationModel
  count: number
  aspectRatio: ImageAspectRatio
  imageSize: ImageSize
}

export interface AssetLibraryNodeConfig {
  assetIds: string[]
}

export interface ComposeItem {
  id: string
  kind: 'text' | 'image'
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  locked: boolean
  text?: string
  style?: {
    fontSize?: number
    fontWeight?: number
    color?: string
    align?: 'left' | 'center' | 'right'
  }
  assetId?: string
}

export interface ComposeNodeConfig {
  items: ComposeItem[]
  selectedItemId: string | null
}

export interface TranscriptSourceNodeConfig {
  transcript: string
  artifacts: TranscriptArtifacts
}

export interface CanvasNodeConfigMap {
  transcript_source: TranscriptSourceNodeConfig
  packaging_brief: PackagingBriefConfig
  titles: OutputNodeConfig
  summary: OutputNodeConfig
  chapters: OutputNodeConfig
  thumbnail_copy: OutputNodeConfig
  image_prompt: OutputNodeConfig
  image_generate: ImageGenerateNodeConfig
  chat: ChatNodeConfig
  asset_library: AssetLibraryNodeConfig
  compose: ComposeNodeConfig
}

export type CanvasNodeConfig =
  | TranscriptSourceNodeConfig
  | PackagingBriefConfig
  | OutputNodeConfig
  | ChatNodeConfig
  | ImageGenerateNodeConfig
  | AssetLibraryNodeConfig
  | ComposeNodeConfig

export interface CanvasNode {
  id: string
  kind: CanvasLabNodeKind
  label: string
  position: { x: number; y: number }
  width?: number
  height?: number
  status: CanvasLabNodeStatus | string
  lastRunId?: string
  config: CanvasNodeConfig
  createdAt: number
  updatedAt: number
}

export interface CanvasEdge {
  id: string
  source: string
  target: string
  createdAt: number
}

export interface CanvasWorkspace {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  artifacts: Artifact[]
  runs: NodeRun[]
  threadMessages: NodeThreadMessage[]
}

export interface CanvasLabNodeData extends Record<string, unknown> {
  nodeId: string
}

export type CanvasLabFlowNode = Node<CanvasLabNodeData>
export type CanvasLabFlowEdge = Edge

export interface StoredCanvasAsset {
  id: string
  workspaceId: string
  name: string
  mimeType: string
  createdAt: number
  source: 'library' | 'generated' | 'imported'
  blob: Blob
}

export interface CanvasAsset extends StoredCanvasAsset {
  url: string
}

export interface CanvasExecuteNodeRequest {
  nodeKind: CanvasLabNodeKind
  nodeLabel: string
  requestedCount?: number
  thread: Array<Pick<NodeThreadMessage, 'role' | 'text'>>
  transcript?: TranscriptArtifacts
  brief?: PackagingBriefConfig
  artifacts: Array<{
    kind: ArtifactKind
    label: string
    content?: string
    items: Array<{
      text: string
      secondaryText?: string
      assetId?: string
      accepted?: boolean
      pinned?: boolean
    }>
  }>
  chat?: {
    provider: Provider
    model: string
    prompt: string
    systemPrompt?: string
    openaiApiKey?: string
    anthropicApiKey?: string
  }
  imageGenerate?: {
    model: ImageGenerationModel
    count: number
    aspectRatio: ImageAspectRatio
    imageSize: ImageSize
    prompt: string
    referenceImages: Array<{
      dataUrl: string
      mimeType: string
      name?: string
    }>
    geminiApiKey?: string
  }
  packagingModel?: {
    model: string
    openaiApiKey?: string
  }
}

export interface CanvasExecuteNodeResponse {
  provider: 'openai' | 'anthropic' | 'gemini' | 'local'
  model: string
  warnings?: string[]
  content?: string
  items?: Array<{
    text: string
    secondaryText?: string
    meta?: Record<string, string | number | boolean | null>
    imageDataUrl?: string
    mimeType?: string
    name?: string
  }>
}
