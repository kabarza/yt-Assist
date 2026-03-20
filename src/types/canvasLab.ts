import type { Edge, Node } from '@xyflow/react'
import type { Provider } from '@/types/chat'
import type { ImageAspectRatio, ImageGenerationModel, ImageSize } from '@/types/images'

export type CanvasLabNodeKind =
  | 'transcript_source'
  | 'prompt_builder'
  | 'prompt_output'
  | 'core_hook'
  | 'description'
  | 'titles'
  | 'summary'
  | 'chapters'
  | 'hashtags'
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
  | 'prompt_output'
  | 'core_hook'
  | 'description'
  | 'title_suggestions'
  | 'summary'
  | 'chapter_list'
  | 'hashtags'
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

export type PromptBuilderPresetId = 'custom' | 'youtube_packaging'

export type PromptOutputPresentationMode = 'rows' | 'combined_block'

export type PromptOutputType =
  | PackagingOutputNodeKind
  | 'generic'
  | 'image_prompt'

export type CanvasStructuredProvider = 'openai' | 'anthropic' | 'gemini'

export type PromptProgramFieldSection = 'core' | 'optional'

export type PromptProgramFieldVisibility = 'always' | 'collapsible'

export type PromptProgramInputFieldType = 'long_text' | 'short_text' | 'number' | 'boolean'

export type PromptProgramOutputFieldType =
  | 'text_item_list'
  | 'combined_block'
  | 'table'
  | 'code_block'

export type PromptProgramOutputGrouping = 'combined' | 'separate'

export type PromptProgramInputInjectionRule =
  | 'replace_section'
  | 'append_if_present'
  | 'boolean_preference'
  | 'conditional_value'

export interface TemplateBlock {
  id: string
  kind: 'instruction' | 'context' | 'output'
  text: string
}

export interface PromptProgramResponseContractRef {
  version: number
  contractId: string
}

export interface PromptProgramNodeViewConfig {
  optionalInputsCollapsed: boolean
  outputSettingsCollapsed: boolean
}

export interface PromptProgramInputVisibilityRule {
  fieldId: string
  equals: string | number | boolean
}

interface PromptProgramInputFieldBase<TType extends PromptProgramInputFieldType, TValue> {
  id: string
  type: TType
  label: string
  description?: string
  required: boolean
  defaultValue?: TValue
  value: TValue
  section: PromptProgramFieldSection
  visible: PromptProgramFieldVisibility
  promptLabel?: string
  injectionRule?: PromptProgramInputInjectionRule
  visibleWhen?: PromptProgramInputVisibilityRule
}

export type PromptProgramInputField =
  | PromptProgramInputFieldBase<'long_text', string>
  | PromptProgramInputFieldBase<'short_text', string>
  | PromptProgramInputFieldBase<'number', number>
  | PromptProgramInputFieldBase<'boolean', boolean>

export interface PromptProgramOutputField {
  id: string
  captureKey: string
  enabled: boolean
  label: string
  description: string
  promptHint: string
  count: number
  outputType: PromptOutputType
  responseType: PromptProgramOutputFieldType
  grouping: PromptProgramOutputGrouping
}

export interface PromptProgramNodeConfig {
  templateId: 'transcript_source' | 'custom'
  inputSchema: PromptProgramInputField[]
  outputSchema: PromptProgramOutputField[]
  promptTemplate: TemplateBlock[]
  responseContract: PromptProgramResponseContractRef
  viewConfig: PromptProgramNodeViewConfig
}

export interface OutputContractField {
  captureKey: string
  label: string
  description?: string
  promptHint?: string
  count: number
  outputType: PromptOutputType
  responseType: PromptProgramOutputFieldType
  grouping: PromptProgramOutputGrouping
}

export interface OutputContractValidationIssue {
  path: string
  message: string
}

export interface OutputContractDefinition {
  name: string
  schema: Record<string, unknown>
  fields: OutputContractField[]
  wrapKey?: string
}

export interface PromptOutputSpecSnapshot {
  outputId: string
  label: string
  enabled: boolean
  requestedCount: number
  presentation: PromptOutputPresentationMode
  promptHint: string
  outputType: PromptOutputType
}

export interface Artifact {
  id: string
  nodeId: string
  outputId?: string
  kind: ArtifactKind
  label: string
  content?: string
  items: ArtifactItem[]
  payload?: unknown
  schemaVersion?: number
  outputSpecSnapshot?: PromptOutputSpecSnapshot
  createdAt: number
  updatedAt: number
}

export interface NodeRun {
  id: string
  nodeId: string
  outputId?: string
  status: 'running' | 'complete' | 'error'
  startedAt: number
  completedAt?: number
  provider: 'openai' | 'anthropic' | 'gemini' | 'local'
  model: string
  requestedCount?: number
  warnings?: string[]
  error?: string
  requestPreview?: string
  responsePreview?: string
  sourceRunId?: string
  outputSpecSnapshot?: PromptOutputSpecSnapshot
}

export interface NodeThreadMessage {
  id: string
  nodeId: string
  outputId?: string
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

export type PackagingOutputNodeKind =
  | 'core_hook'
  | 'description'
  | 'titles'
  | 'thumbnail_copy'
  | 'chapters'
  | 'hashtags'

export interface PackagingOutputSelection {
  enabled: boolean
  count: number
}

export type PackagingOutputSelectionMap = Record<PackagingOutputNodeKind, PackagingOutputSelection>

export interface PromptBuilderOutputDefinition extends PromptOutputSpecSnapshot {}

export interface PromptBuilderNodeConfig {
  presetId: PromptBuilderPresetId
  sharedInstruction: string
  systemPrompt: string
  outputs: PromptBuilderOutputDefinition[]
}

export interface PromptOutputNodeConfig extends PromptOutputSpecSnapshot {
  builderNodeId: string
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
  brief: PackagingBriefConfig
  selectedOutputs: PackagingOutputSelectionMap
  promptProgram: PromptProgramNodeConfig
}

export interface CanvasNodeConfigMap {
  transcript_source: TranscriptSourceNodeConfig
  prompt_builder: PromptBuilderNodeConfig
  prompt_output: PromptOutputNodeConfig
  core_hook: OutputNodeConfig
  description: OutputNodeConfig
  titles: OutputNodeConfig
  summary: OutputNodeConfig
  chapters: OutputNodeConfig
  hashtags: OutputNodeConfig
  thumbnail_copy: OutputNodeConfig
  image_prompt: OutputNodeConfig
  image_generate: ImageGenerateNodeConfig
  chat: ChatNodeConfig
  asset_library: AssetLibraryNodeConfig
  compose: ComposeNodeConfig
}

export type CanvasNodeConfig =
  | TranscriptSourceNodeConfig
  | PromptBuilderNodeConfig
  | PromptOutputNodeConfig
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
  sourceOutputId?: string
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
  targetOutputId?: string
  thread: Array<Pick<NodeThreadMessage, 'role' | 'text'>>
  transcript?: TranscriptArtifacts
  brief?: PackagingBriefConfig
  selectedOutputs?: PackagingOutputSelectionMap
  promptProgram?: PromptProgramNodeConfig
  promptBuilder?: {
    presetId: PromptBuilderPresetId
    sharedInstruction?: string
    systemPrompt?: string
    outputs: PromptBuilderOutputDefinition[]
  }
  sourceRunId?: string
  artifacts: Array<{
    kind: ArtifactKind
    outputId?: string
    label: string
    content?: string
    payload?: unknown
    outputSpecSnapshot?: PromptOutputSpecSnapshot
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
    provider?: CanvasStructuredProvider
    model: string
    openaiApiKey?: string
    anthropicApiKey?: string
    geminiApiKey?: string
  }
}

export interface CanvasExecutionOutputPayload {
  content?: string
  items?: Array<{
    text: string
    secondaryText?: string
    meta?: Record<string, string | number | boolean | null>
  }>
  payload?: unknown
  presentation?: PromptOutputPresentationMode
  outputLabel?: string
  outputType?: PromptOutputType
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
  outputs?: Record<string, CanvasExecutionOutputPayload>
  requestPreview?: string
  responsePreview?: string
}
