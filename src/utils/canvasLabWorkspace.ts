import { generateId, MODELS } from '@/types/chat'
import type {
  Artifact,
  ArtifactItem,
  CanvasEdge,
  CanvasLabNodeStatus,
  CanvasLabNodeKind,
  CanvasNode,
  CanvasNodeConfigMap,
  CanvasWorkspace,
  ComposeItem,
  NodeRun,
  NodeThreadMessage,
  PackagingBriefConfig,
  PackagingOutputNodeKind,
  PackagingOutputSelectionMap,
  PromptBuilderOutputDefinition,
  PromptBuilderPresetId,
  PromptOutputNodeConfig,
  PromptOutputSpecSnapshot,
  TranscriptArtifacts,
} from '@/types/canvasLab'
import type { AppSettings } from '@/stores/settingsStore'
import {
  createTranscriptSourcePromptProgram,
  normalizePromptProgramNodeConfig,
  syncTranscriptSourceConfig,
} from '@/lib/canvasPromptProgram'

export const DEFAULT_PACKAGING_BRIEF: PackagingBriefConfig = {
  mustInclude: '',
  niceToInclude: '',
  avoidWords: '',
  additionalContext: '',
  transcriptIncludeTimestamps: true,
}

export const PACKAGING_OUTPUT_NODE_KINDS: PackagingOutputNodeKind[] = [
  'core_hook',
  'description',
  'titles',
  'thumbnail_copy',
  'chapters',
  'hashtags',
]

export const DEFAULT_PACKAGING_OUTPUT_SELECTIONS: PackagingOutputSelectionMap = {
  core_hook: { enabled: true, count: 1 },
  description: { enabled: true, count: 3 },
  titles: { enabled: true, count: 10 },
  thumbnail_copy: { enabled: true, count: 10 },
  chapters: { enabled: true, count: 8 },
  hashtags: { enabled: true, count: 5 },
}

const DUPLICATE_ALLOWED_NODE_KINDS = new Set<CanvasLabNodeKind>([
  'prompt_builder',
  'prompt_output',
])

const DEFAULT_NODE_LABELS: Record<CanvasLabNodeKind, string> = {
  transcript_source: 'Transcript Source',
  prompt_builder: 'Prompt Builder',
  prompt_output: 'Prompt Output',
  core_hook: 'Core Hook',
  description: 'Description',
  titles: 'Titles',
  summary: 'Summary',
  chapters: 'Chapters',
  hashtags: 'Hashtags',
  thumbnail_copy: 'Thumbnail Copy',
  image_prompt: 'Image Prompt',
  image_generate: 'Image Gen',
  chat: 'Chat',
  asset_library: 'Asset Library',
  compose: 'Compose',
}

const LEGACY_DEFAULT_NODE_POSITIONS: Record<CanvasLabNodeKind, { x: number; y: number }> = {
  transcript_source: { x: 36, y: 70 },
  prompt_builder: { x: 592, y: 120 },
  prompt_output: { x: 964, y: 120 },
  core_hook: { x: 420, y: 36 },
  description: { x: 420, y: 268 },
  titles: { x: 420, y: 36 },
  summary: { x: 420, y: 268 },
  chapters: { x: 420, y: 500 },
  hashtags: { x: 420, y: 964 },
  thumbnail_copy: { x: 420, y: 732 },
  image_prompt: { x: 816, y: 154 },
  image_generate: { x: 1210, y: 154 },
  asset_library: { x: 816, y: 470 },
  compose: { x: 1210, y: 470 },
  chat: { x: 816, y: 786 },
}

const DEFAULT_CANVAS_LAYOUT: Record<CanvasLabNodeKind, { x: number; y: number }> = {
  transcript_source: { x: 88, y: 80 },
  prompt_builder: { x: 592, y: 120 },
  prompt_output: { x: 964, y: 120 },
  core_hook: { x: 592, y: 36 },
  description: { x: 592, y: 308 },
  titles: { x: 964, y: 36 },
  thumbnail_copy: { x: 964, y: 308 },
  chapters: { x: 592, y: 644 },
  hashtags: { x: 964, y: 644 },
  chat: { x: 88, y: 604 },
  summary: { x: 592, y: 308 },
  image_prompt: { x: 1120, y: 120 },
  asset_library: { x: 1120, y: 486 },
  image_generate: { x: 1648, y: 120 },
  compose: { x: 1648, y: 486 },
}

const VALID_NODE_STATUSES = new Set<CanvasLabNodeStatus>([
  'idle',
  'running',
  'complete',
  'stale',
  'error',
])

export function createEmptyTranscriptArtifacts(): TranscriptArtifacts {
  return {
    rawTranscript: '',
    digest: '',
    timestampMap: '',
    keyHooks: [],
  }
}

export function createDefaultPackagingOutputSelections(): PackagingOutputSelectionMap {
  return JSON.parse(JSON.stringify(DEFAULT_PACKAGING_OUTPUT_SELECTIONS)) as PackagingOutputSelectionMap
}

function createPromptOutputDefinition(
  input?: Partial<PromptBuilderOutputDefinition>,
): PromptBuilderOutputDefinition {
  return {
    outputId: input?.outputId || generateId(),
    label: input?.label?.trim() || 'Output',
    enabled: input?.enabled ?? true,
    requestedCount: Math.max(1, Math.round(input?.requestedCount || 3)),
    presentation: input?.presentation || 'rows',
    promptHint: input?.promptHint || '',
    outputType: input?.outputType || 'generic',
  }
}

export function createPromptBuilderOutputsForPreset(
  presetId: PromptBuilderPresetId,
  selections = createDefaultPackagingOutputSelections(),
): PromptBuilderOutputDefinition[] {
  if (presetId === 'youtube_packaging') {
    return [
      createPromptOutputDefinition({
        outputId: 'core_hook',
        label: 'Core Hook',
        requestedCount: selections.core_hook.count,
        presentation: 'combined_block',
        outputType: 'core_hook',
      }),
      createPromptOutputDefinition({
        outputId: 'description',
        label: 'Descriptions',
        requestedCount: selections.description.count,
        presentation: 'rows',
        outputType: 'description',
      }),
      createPromptOutputDefinition({
        outputId: 'titles',
        label: 'Titles',
        requestedCount: selections.titles.count,
        presentation: 'rows',
        outputType: 'titles',
      }),
      createPromptOutputDefinition({
        outputId: 'thumbnail_copy',
        label: 'Thumbnail Copy',
        requestedCount: selections.thumbnail_copy.count,
        presentation: 'rows',
        outputType: 'thumbnail_copy',
      }),
      createPromptOutputDefinition({
        outputId: 'chapters',
        label: 'Chapters',
        requestedCount: selections.chapters.count,
        presentation: 'rows',
        outputType: 'chapters',
      }),
      createPromptOutputDefinition({
        outputId: 'hashtags',
        label: 'Hashtags',
        requestedCount: selections.hashtags.count,
        presentation: 'combined_block',
        outputType: 'hashtags',
      }),
    ]
  }

  return [
    createPromptOutputDefinition({
      label: 'Output',
      requestedCount: 3,
      presentation: 'rows',
      outputType: 'generic',
    }),
  ]
}

export function createPromptBuilderConfig(
  presetId: PromptBuilderPresetId = 'custom',
  selections = createDefaultPackagingOutputSelections(),
) {
  return {
    presetId,
    sharedInstruction: '',
    systemPrompt: '',
    outputs: createPromptBuilderOutputsForPreset(presetId, selections),
  } satisfies CanvasNodeConfigMap['prompt_builder']
}

function normalizePromptOutputSpecSnapshot(
  input: unknown,
  fallback?: Partial<PromptOutputSpecSnapshot>,
): PromptOutputSpecSnapshot {
  const record = isRecord(input) ? input : {}
  return createPromptOutputDefinition({
    outputId: getString(record.outputId, fallback?.outputId || generateId()),
    label: getString(record.label, fallback?.label || 'Output'),
    enabled: getBoolean(record.enabled, fallback?.enabled ?? true),
    requestedCount: getFinitePositiveInteger(record.requestedCount, fallback?.requestedCount || 3),
    presentation:
      record.presentation === 'combined_block' || record.presentation === 'rows'
        ? record.presentation
        : fallback?.presentation || 'rows',
    promptHint: getString(record.promptHint, fallback?.promptHint || ''),
    outputType:
      typeof record.outputType === 'string'
        ? record.outputType as PromptOutputSpecSnapshot['outputType']
        : fallback?.outputType || 'generic',
  })
}

function normalizeWhitespace(value: string) {
  return value.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim()
}

function takeDistinctLines(lines: string[], count: number) {
  const seen = new Set<string>()
  const nextLines: string[] = []

  for (const line of lines) {
    const normalized = normalizeWhitespace(line)
    if (!normalized || seen.has(normalized.toLowerCase())) continue
    seen.add(normalized.toLowerCase())
    nextLines.push(normalized)
    if (nextLines.length >= count) break
  }

  return nextLines
}

export function deriveTranscriptArtifacts(transcript: string): TranscriptArtifacts {
  const cleaned = transcript.replace(/\u00a0/g, ' ').trim()
  const lines = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const timestampLines = takeDistinctLines(
    lines.filter((line) => /(?:^|\s)(\d{1,2}:\d{2}(?::\d{2})?)/.test(line)),
    24,
  )

  const sentenceCandidates = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter((sentence) => sentence.length > 24)

  const digest = takeDistinctLines(sentenceCandidates, 8)
    .slice(0, 8)
    .map((sentence) => `- ${sentence}`)
    .join('\n')

  const hookCandidates = takeDistinctLines(
    [
      ...sentenceCandidates.slice(0, 12),
      ...lines.filter((line) => line.length > 18),
    ],
    6,
  )

  return {
    rawTranscript: cleaned,
    digest,
    timestampMap: timestampLines.join('\n'),
    keyHooks: hookCandidates.slice(0, 5),
  }
}

function createNodeBase(kind: CanvasLabNodeKind, label: string, x: number, y: number) {
  return {
    id: generateId(),
    kind,
    label,
    position: { x, y },
    width: 320,
    status: 'idle' as const,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function getDefaultCanvasPosition(kind: CanvasLabNodeKind) {
  return DEFAULT_CANVAS_LAYOUT[kind]
}

function isSamePosition(value: { x: number; y: number }, target: { x: number; y: number }) {
  return value.x === target.x && value.y === target.y
}

function migrateLegacyCanvasPosition(kind: CanvasLabNodeKind, position: { x: number; y: number }) {
  return isSamePosition(position, LEGACY_DEFAULT_NODE_POSITIONS[kind])
    ? DEFAULT_CANVAS_LAYOUT[kind]
    : position
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function getBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function getFiniteNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function getFinitePositiveInteger(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.max(1, Math.round(value))
    : fallback
}

function getFiniteNonNegativeInteger(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.max(0, Math.round(value))
    : fallback
}

function normalizeTranscriptArtifacts(input: unknown, transcript: string): TranscriptArtifacts {
  const fallback = deriveTranscriptArtifacts(transcript)
  if (!isRecord(input)) {
    return fallback
  }

  const keyHooks = Array.isArray(input.keyHooks)
    ? input.keyHooks.filter((value): value is string => typeof value === 'string')
    : fallback.keyHooks

  return {
    rawTranscript: getString(input.rawTranscript, fallback.rawTranscript),
    digest: getString(input.digest, fallback.digest),
    timestampMap: getString(input.timestampMap, fallback.timestampMap),
    keyHooks,
  }
}

function normalizePackagingBriefConfig(input: unknown): PackagingBriefConfig {
  if (!isRecord(input)) {
    return { ...DEFAULT_PACKAGING_BRIEF }
  }

  return {
    mustInclude: getString(input.mustInclude),
    niceToInclude: getString(input.niceToInclude),
    avoidWords: getString(input.avoidWords),
    additionalContext: getString(input.additionalContext),
    transcriptIncludeTimestamps: getBoolean(input.transcriptIncludeTimestamps, true),
  }
}

function normalizePackagingOutputSelections(input: unknown): PackagingOutputSelectionMap {
  const fallback = createDefaultPackagingOutputSelections()
  if (!isRecord(input)) {
    return fallback
  }

  return PACKAGING_OUTPUT_NODE_KINDS.reduce<PackagingOutputSelectionMap>((accumulator, kind) => {
    const rawSelection = isRecord(input[kind]) ? input[kind] : null
    accumulator[kind] = {
      enabled: rawSelection ? getBoolean(rawSelection.enabled, fallback[kind].enabled) : fallback[kind].enabled,
      count: rawSelection ? getFinitePositiveInteger(rawSelection.count, fallback[kind].count) : fallback[kind].count,
    }
    return accumulator
  }, createDefaultPackagingOutputSelections())
}

function defaultOutputRequestedCount(
  kind: Extract<CanvasLabNodeKind, 'core_hook' | 'description' | 'titles' | 'summary' | 'chapters' | 'hashtags' | 'thumbnail_copy' | 'image_prompt'>,
) {
  switch (kind) {
    case 'core_hook':
      return 1
    case 'description':
      return 3
    case 'titles':
      return 10
    case 'summary':
      return 1
    case 'chapters':
      return 8
    case 'hashtags':
      return 5
    case 'thumbnail_copy':
      return 10
    case 'image_prompt':
      return 1
  }
}

function createDefaultNodeConfig(kind: CanvasLabNodeKind, settings: AppSettings): CanvasNode['config'] {
  const openAiModel = MODELS.openai.some((entry) => entry.id === settings.defaultModel)
    ? settings.defaultModel
    : MODELS.openai[0].id

  const chatModel =
    settings.defaultProvider === 'anthropic'
      ? MODELS.anthropic.some((entry) => entry.id === settings.defaultModel)
        ? settings.defaultModel
        : MODELS.anthropic[0].id
      : openAiModel

  switch (kind) {
    case 'transcript_source':
      return syncTranscriptSourceConfig({
        transcript: '',
        artifacts: createEmptyTranscriptArtifacts(),
        brief: { ...DEFAULT_PACKAGING_BRIEF },
        selectedOutputs: createDefaultPackagingOutputSelections(),
        promptProgram: createTranscriptSourcePromptProgram(),
      }, {
        deriveArtifacts: deriveTranscriptArtifacts,
      })
    case 'prompt_builder':
      return createPromptBuilderConfig()
    case 'prompt_output':
      return {
        builderNodeId: '',
        ...createPromptOutputDefinition(),
      } satisfies PromptOutputNodeConfig
    case 'core_hook':
    case 'description':
    case 'titles':
    case 'summary':
    case 'chapters':
    case 'hashtags':
    case 'thumbnail_copy':
    case 'image_prompt':
      return {
        requestedCount: defaultOutputRequestedCount(kind),
        draftInstruction: '',
      }
    case 'image_generate':
      return {
        model: 'gemini-3.1-flash-image-preview',
        count: 1,
        aspectRatio: '16:9',
        imageSize: '1K',
      } as const
    case 'chat':
      return {
        provider: settings.defaultProvider,
        model: chatModel,
        draftPrompt: '',
        systemPrompt: '',
      }
    case 'asset_library':
      return {
        assetIds: [],
      }
    case 'compose':
      return {
        items: [],
        selectedItemId: null,
      }
  }
}

function normalizeComposeItem(item: unknown, index: number): ComposeItem | null {
  if (!isRecord(item)) return null

  const kind = item.kind === 'image' ? 'image' : item.kind === 'text' ? 'text' : null
  if (!kind) return null

  const style: ComposeItem['style'] = isRecord(item.style)
    ? {
        fontSize:
          typeof item.style.fontSize === 'number' && Number.isFinite(item.style.fontSize)
            ? item.style.fontSize
            : undefined,
        fontWeight:
          typeof item.style.fontWeight === 'number' && Number.isFinite(item.style.fontWeight)
            ? item.style.fontWeight
            : undefined,
        color: getString(item.style.color) || undefined,
        align:
          item.style.align === 'left' || item.style.align === 'center' || item.style.align === 'right'
            ? item.style.align
            : undefined,
      }
    : undefined

  return {
    id: getString(item.id, generateId()),
    kind,
    x: getFiniteNumber(item.x, 48 + index * 18),
    y: getFiniteNumber(item.y, 48 + index * 18),
    width: getFinitePositiveInteger(item.width, kind === 'text' ? 340 : 280),
    height: getFinitePositiveInteger(item.height, kind === 'text' ? 96 : 180),
    rotation: getFiniteNumber(item.rotation, 0),
    zIndex: getFiniteNonNegativeInteger(item.zIndex, index),
    locked: getBoolean(item.locked, false),
    text: kind === 'text' ? getString(item.text, '') : undefined,
    style: kind === 'text' ? style : undefined,
    assetId: kind === 'image' ? getString(item.assetId, '') || undefined : undefined,
  }
}

function normalizeNodeConfig(
  kind: CanvasLabNodeKind,
  config: unknown,
  settings: AppSettings,
): CanvasNode['config'] {
  const fallback = createDefaultNodeConfig(kind, settings)

  if (!isRecord(config)) {
    return fallback
  }

  switch (kind) {
    case 'transcript_source': {
      const transcript = getString(config.transcript)
      const briefSource = isRecord(config.brief) ? config.brief : config
      const brief = normalizePackagingBriefConfig(briefSource)
      const selectedOutputs = normalizePackagingOutputSelections(config.selectedOutputs)

      return syncTranscriptSourceConfig({
        transcript,
        artifacts: normalizeTranscriptArtifacts(config.artifacts, transcript),
        brief,
        selectedOutputs,
        promptProgram: normalizePromptProgramNodeConfig(
          config.promptProgram,
          createTranscriptSourcePromptProgram({
            transcript,
            brief,
            selectedOutputs,
          }),
        ),
      }, {
        deriveArtifacts: deriveTranscriptArtifacts,
      })
    }
    case 'prompt_builder': {
      const presetId = config.presetId === 'youtube_packaging' ? 'youtube_packaging' : 'custom'
      const fallback = createPromptBuilderConfig(presetId)
      const outputs = Array.isArray(config.outputs)
        ? config.outputs
            .map((output) => normalizePromptOutputSpecSnapshot(output))
            .filter((output, index, array) => array.findIndex((entry) => entry.outputId === output.outputId) === index)
        : fallback.outputs

      return {
        presetId,
        sharedInstruction: getString(config.sharedInstruction),
        systemPrompt: getString(config.systemPrompt),
        outputs: outputs.length > 0 ? outputs : fallback.outputs,
      } satisfies CanvasNodeConfigMap['prompt_builder']
    }
    case 'prompt_output': {
      const promptOutputFallback = fallback as CanvasNodeConfigMap['prompt_output']
      return {
        builderNodeId: getString(config.builderNodeId, promptOutputFallback.builderNodeId),
        ...normalizePromptOutputSpecSnapshot(config, promptOutputFallback),
      } satisfies CanvasNodeConfigMap['prompt_output']
    }
    case 'core_hook':
    case 'description':
    case 'titles':
    case 'summary':
    case 'chapters':
    case 'hashtags':
    case 'thumbnail_copy':
    case 'image_prompt':
      return {
        requestedCount: getFinitePositiveInteger(
          config.requestedCount,
          (fallback as CanvasNodeConfigMap['titles']).requestedCount,
        ),
        draftInstruction: getString(config.draftInstruction),
      }
    case 'image_generate':
      return {
        model:
          typeof config.model === 'string'
            ? config.model
            : (fallback as CanvasNodeConfigMap['image_generate']).model,
        count: getFinitePositiveInteger(
          config.count,
          (fallback as CanvasNodeConfigMap['image_generate']).count,
        ),
        aspectRatio:
          typeof config.aspectRatio === 'string'
            ? config.aspectRatio
            : (fallback as CanvasNodeConfigMap['image_generate']).aspectRatio,
        imageSize:
          typeof config.imageSize === 'string'
            ? config.imageSize
            : (fallback as CanvasNodeConfigMap['image_generate']).imageSize,
      } as CanvasNodeConfigMap['image_generate']
    case 'chat': {
      const provider = config.provider === 'anthropic' ? 'anthropic' : 'openai'
      const validModels = MODELS[provider].map((entry) => entry.id)
      const fallbackModel = MODELS[provider][0].id
      const model = typeof config.model === 'string' && validModels.includes(config.model as (typeof validModels)[number])
        ? config.model
        : fallbackModel

      return {
        provider,
        model,
        draftPrompt: getString(config.draftPrompt),
        systemPrompt: getString(config.systemPrompt),
      }
    }
    case 'asset_library':
      return {
        assetIds: Array.isArray(config.assetIds)
          ? config.assetIds.filter((value): value is string => typeof value === 'string')
          : [],
      }
    case 'compose': {
      const items = Array.isArray(config.items)
        ? config.items
            .map((item, index) => normalizeComposeItem(item, index))
            .filter((item): item is ComposeItem => Boolean(item))
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((item, index) => ({
              ...item,
              zIndex: index,
            }))
        : []

      const selectedItemId = getString(config.selectedItemId, '') || null
      return {
        items,
        selectedItemId: selectedItemId && items.some((item) => item.id === selectedItemId)
          ? selectedItemId
          : items[items.length - 1]?.id || null,
      }
    }
  }
}

function normalizeNode(node: unknown, kind: CanvasLabNodeKind, settings: AppSettings, fallbackNode: CanvasNode) {
  if (!isRecord(node)) {
    return fallbackNode
  }

  return {
    ...fallbackNode,
    id: getString(node.id, fallbackNode.id),
    label: getString(node.label, fallbackNode.label) || DEFAULT_NODE_LABELS[kind],
    position: isRecord(node.position)
      ? migrateLegacyCanvasPosition(kind, {
          x: getFiniteNumber(node.position.x, fallbackNode.position.x),
          y: getFiniteNumber(node.position.y, fallbackNode.position.y),
        })
      : fallbackNode.position,
    width: getFinitePositiveInteger(node.width, fallbackNode.width || 320),
    height:
      typeof node.height === 'number' && Number.isFinite(node.height)
        ? Math.max(160, Math.round(node.height))
        : fallbackNode.height,
    status:
      typeof node.status === 'string' && VALID_NODE_STATUSES.has(node.status as CanvasLabNodeStatus)
        ? node.status
        : fallbackNode.status,
    lastRunId: typeof node.lastRunId === 'string' ? node.lastRunId : fallbackNode.lastRunId,
    config: normalizeNodeConfig(kind, node.config, settings),
    createdAt: getFiniteNumber(node.createdAt, fallbackNode.createdAt),
    updatedAt: getFiniteNumber(node.updatedAt, fallbackNode.updatedAt),
  }
}

function normalizeArtifactItem(item: unknown): ArtifactItem | null {
  if (!isRecord(item)) return null
  const text = getString(item.text).trim()
  if (!text) return null

  return {
    id: getString(item.id, generateId()),
    text,
    secondaryText: getString(item.secondaryText, '') || undefined,
    meta: isRecord(item.meta) ? (item.meta as ArtifactItem['meta']) : undefined,
    assetId: getString(item.assetId, '') || undefined,
    accepted: getBoolean(item.accepted, false),
    pinned: getBoolean(item.pinned, false),
  }
}

function normalizeArtifacts(
  input: unknown,
  validNodeIds: Set<string>,
  nodeIdRemap: Record<string, string> = {},
) {
  if (!Array.isArray(input)) return []

  const artifactsByKey = new Map<string, Artifact>()

  for (const artifact of input) {
      if (!isRecord(artifact)) continue
      const rawNodeId = getString(artifact.nodeId)
      const nodeId = nodeIdRemap[rawNodeId] || rawNodeId
      if (!nodeId || !validNodeIds.has(nodeId)) continue
      const kind = getString(artifact.kind)
      const label = getString(artifact.label).trim()
      if (!kind || !label) continue

      const nextArtifact = {
        id: getString(artifact.id, generateId()),
        nodeId,
        outputId: getString(artifact.outputId, '') || undefined,
        kind: kind as Artifact['kind'],
        label,
        content: getString(artifact.content, '') || undefined,
        items: Array.isArray(artifact.items)
          ? artifact.items
              .map((item) => normalizeArtifactItem(item))
              .filter((item): item is ArtifactItem => Boolean(item))
          : [],
        payload: 'payload' in artifact ? artifact.payload : undefined,
        schemaVersion: typeof artifact.schemaVersion === 'number' && Number.isFinite(artifact.schemaVersion)
          ? artifact.schemaVersion
          : undefined,
        outputSpecSnapshot: 'outputSpecSnapshot' in artifact
          ? normalizePromptOutputSpecSnapshot(artifact.outputSpecSnapshot, getString(artifact.outputId, '') ? { outputId: getString(artifact.outputId) } : undefined)
          : undefined,
        createdAt: getFiniteNumber(artifact.createdAt, Date.now()),
        updatedAt: getFiniteNumber(artifact.updatedAt, Date.now()),
      } satisfies Artifact

      const artifactKey = `${nodeId}:${kind}:${nextArtifact.outputId || ''}`
      const existingArtifact = artifactsByKey.get(artifactKey)
      if (!existingArtifact || nextArtifact.updatedAt >= existingArtifact.updatedAt) {
        artifactsByKey.set(artifactKey, nextArtifact)
      }
  }

  return [...artifactsByKey.values()]
}

function normalizeRuns(input: unknown, validNodeIds: Set<string>) {
  if (!Array.isArray(input)) return []

  const runs: NodeRun[] = []

  for (const run of input) {
      if (!isRecord(run)) continue
      const nodeId = getString(run.nodeId)
      if (!nodeId || !validNodeIds.has(nodeId)) continue

      runs.push({
        id: getString(run.id, generateId()),
        nodeId,
        outputId: getString(run.outputId, '') || undefined,
        status:
          run.status === 'complete' || run.status === 'error' || run.status === 'running'
            ? run.status
            : 'complete',
        startedAt: getFiniteNumber(run.startedAt, Date.now()),
        completedAt:
          typeof run.completedAt === 'number' && Number.isFinite(run.completedAt)
            ? run.completedAt
            : undefined,
        provider:
          run.provider === 'anthropic' ||
          run.provider === 'openai' ||
          run.provider === 'gemini' ||
          run.provider === 'local'
            ? run.provider
            : 'local',
        model: getString(run.model, 'unknown'),
        requestedCount:
          typeof run.requestedCount === 'number' && Number.isFinite(run.requestedCount)
            ? run.requestedCount
            : undefined,
        warnings: Array.isArray(run.warnings)
          ? run.warnings.filter((warning): warning is string => typeof warning === 'string')
          : undefined,
        error: getString(run.error, '') || undefined,
        requestPreview: getString(run.requestPreview, '') || undefined,
        responsePreview: getString(run.responsePreview, '') || undefined,
        sourceRunId: getString(run.sourceRunId, '') || undefined,
        outputSpecSnapshot: 'outputSpecSnapshot' in run
          ? normalizePromptOutputSpecSnapshot(run.outputSpecSnapshot, getString(run.outputId, '') ? { outputId: getString(run.outputId) } : undefined)
          : undefined,
      })
  }

  return runs
}

function normalizeThreadMessages(input: unknown, validNodeIds: Set<string>) {
  if (!Array.isArray(input)) return []

  const messages: NodeThreadMessage[] = []

  for (const message of input) {
      if (!isRecord(message)) continue
      const nodeId = getString(message.nodeId)
      if (!nodeId || !validNodeIds.has(nodeId)) continue
      const role =
        message.role === 'assistant' || message.role === 'system' || message.role === 'user'
          ? message.role
          : 'assistant'
      const text = getString(message.text).trim()
      if (!text) continue

      messages.push({
        id: getString(message.id, generateId()),
        nodeId,
        outputId: getString(message.outputId, '') || undefined,
        role,
        text,
        createdAt: getFiniteNumber(message.createdAt, Date.now()),
      })
  }

  return messages
}

function normalizeEdges(
  input: unknown,
  validNodeIds: Set<string>,
  nodeIdRemap: Record<string, string> = {},
) {
  if (!Array.isArray(input)) return []

  const seenConnections = new Set<string>()
  const nextEdges: CanvasEdge[] = []

  for (const edge of input) {
    if (!isRecord(edge)) continue
    const rawSource = getString(edge.source)
    const rawTarget = getString(edge.target)
    const source = nodeIdRemap[rawSource] || rawSource
    const target = nodeIdRemap[rawTarget] || rawTarget
    if (!source || !target || source === target) continue
    if (!validNodeIds.has(source) || !validNodeIds.has(target)) continue

    const sourceOutputId = getString(edge.sourceOutputId, '') || undefined
    const connectionKey = `${source}:${sourceOutputId || ''}:${target}`
    if (seenConnections.has(connectionKey)) continue
    seenConnections.add(connectionKey)

    nextEdges.push({
      id: getString(edge.id, generateId()),
      source,
      target,
      sourceOutputId,
      createdAt: getFiniteNumber(edge.createdAt, Date.now()),
    })
  }

  return nextEdges
}

function mapLegacyNodeKind(kind: string): CanvasLabNodeKind | null {
  if (kind === 'summary') return 'description'
  if (kind === 'packaging_brief') return 'transcript_source'
  return kind in DEFAULT_NODE_LABELS ? (kind as CanvasLabNodeKind) : null
}

function mapLegacyArtifactKind(kind: string): Artifact['kind'] {
  if (kind === 'summary') return 'description'
  return kind as Artifact['kind']
}

export function createCanvasNode(kind: CanvasLabNodeKind, settings: AppSettings): CanvasNode {
  const position = getDefaultCanvasPosition(kind)
  return {
    ...createNodeBase(
      kind,
      DEFAULT_NODE_LABELS[kind],
      position.x,
      position.y,
    ),
    config: createDefaultNodeConfig(kind, settings),
  }
}

export function buildDefaultEdges(
  nodeIdByKind: Partial<Record<CanvasLabNodeKind, string>>,
): CanvasEdge[] {
  const possibleEdges: Array<[CanvasLabNodeKind, CanvasLabNodeKind]> = [
    ['transcript_source', 'core_hook'],
    ['transcript_source', 'description'],
    ['transcript_source', 'titles'],
    ['transcript_source', 'thumbnail_copy'],
    ['transcript_source', 'chapters'],
    ['transcript_source', 'hashtags'],
    ['transcript_source', 'chat'],
    ['transcript_source', 'image_prompt'],
    ['titles', 'image_prompt'],
    ['thumbnail_copy', 'image_prompt'],
    ['image_prompt', 'image_generate'],
    ['asset_library', 'image_generate'],
    ['titles', 'compose'],
    ['thumbnail_copy', 'compose'],
    ['image_generate', 'compose'],
    ['asset_library', 'compose'],
  ]

  return possibleEdges.flatMap(([sourceKind, targetKind]) => {
    const source = nodeIdByKind[sourceKind]
    const target = nodeIdByKind[targetKind]
    if (!source || !target) return []
    return [{
      id: generateId(),
      source,
      target,
      createdAt: Date.now(),
    }]
  })
}

export function createInitialCanvasWorkspace(name: string, settings: AppSettings): CanvasWorkspace {
  const nodes = [createCanvasNode('transcript_source', settings)]
  const edges: CanvasEdge[] = []

  const now = Date.now()

  return {
    id: generateId(),
    name,
    createdAt: now,
    updatedAt: now,
    nodes,
    edges,
    artifacts: [],
    runs: [],
    threadMessages: [],
  }
}

export function normalizeCanvasWorkspace(
  workspace: unknown,
  settings: AppSettings,
): CanvasWorkspace {
  const name =
    isRecord(workspace) && typeof workspace.name === 'string' && workspace.name.trim()
      ? workspace.name.trim()
      : 'Canvas Lab'

  const fallback = createInitialCanvasWorkspace(name, settings)
  const fallbackByKind = Object.fromEntries(
    Object.keys(DEFAULT_NODE_LABELS).map((kind) => [
      kind,
      createCanvasNode(kind as CanvasLabNodeKind, settings),
    ]),
  ) as Record<CanvasLabNodeKind, CanvasNode>

  const existingNodesByKind = new Map<CanvasLabNodeKind, unknown>()
  const duplicateNodes: Array<{ node: unknown; kind: CanvasLabNodeKind }> = []
  if (isRecord(workspace) && Array.isArray(workspace.nodes)) {
    for (const node of workspace.nodes) {
      if (!isRecord(node) || typeof node.kind !== 'string') continue
      const mappedKind = mapLegacyNodeKind(node.kind)
      if (!mappedKind) continue
      if (DUPLICATE_ALLOWED_NODE_KINDS.has(mappedKind)) {
        duplicateNodes.push({ node: { ...node, kind: mappedKind }, kind: mappedKind })
        continue
      }
      if (!existingNodesByKind.has(mappedKind)) {
        existingNodesByKind.set(mappedKind, { ...node, kind: mappedKind })
      }
    }
  }

  const rawTranscriptSourceNode = existingNodesByKind.get('transcript_source')
  const legacyBriefNode =
    isRecord(workspace) && Array.isArray(workspace.nodes)
      ? workspace.nodes.find(
          (node): node is Record<string, unknown> =>
            isRecord(node) && node.kind === 'packaging_brief',
        )
      : undefined

  const shouldAdoptLegacyBrief =
    Boolean(legacyBriefNode) &&
    !(
      isRecord(rawTranscriptSourceNode) &&
      isRecord(rawTranscriptSourceNode.config) &&
      isRecord(rawTranscriptSourceNode.config.brief)
    )

  const legacyBriefConfig = shouldAdoptLegacyBrief
    ? normalizePackagingBriefConfig(legacyBriefNode?.config)
    : null

  const kindsToKeep = new Set<CanvasLabNodeKind>(['transcript_source'])
  for (const kind of existingNodesByKind.keys()) {
    kindsToKeep.add(kind)
  }

  let nodes = [...kindsToKeep].map((kind) =>
    normalizeNode(
      existingNodesByKind.get(kind),
      kind,
      settings,
      fallbackByKind[kind],
    ),
  )

  if (duplicateNodes.length > 0) {
    nodes = [
      ...nodes,
      ...duplicateNodes.map(({ node, kind }) =>
        normalizeNode(
          node,
          kind,
          settings,
          fallbackByKind[kind],
        ),
      ),
    ]
  }

  if (legacyBriefConfig) {
    nodes = nodes.map((node) =>
      node.kind === 'transcript_source'
        ? (() => {
            const nextConfig = syncTranscriptSourceConfig({
              ...(node.config as CanvasNodeConfigMap['transcript_source']),
              brief: legacyBriefConfig,
            }, {
              deriveArtifacts: deriveTranscriptArtifacts,
            })

            return {
            ...node,
            config: nextConfig,
            updatedAt: Math.max(
              node.updatedAt,
              getFiniteNumber(legacyBriefNode?.updatedAt, node.updatedAt),
            ),
          }
        })()
        : node,
    )
  }

  const validNodeIds = new Set(nodes.map((node) => node.id))
  const nodeIdByKind = Object.fromEntries(nodes.map((node) => [node.kind, node.id])) as Record<
    CanvasLabNodeKind,
    string
  >
  const nodeIdRemap =
    legacyBriefNode && getString(legacyBriefNode.id)
      ? { [getString(legacyBriefNode.id)]: nodeIdByKind.transcript_source }
      : {}

  const persistedEdges =
    isRecord(workspace) && 'edges' in workspace
      ? normalizeEdges(workspace.edges, validNodeIds, nodeIdRemap)
      : []

  const edges =
    persistedEdges.length > 0
      ? persistedEdges
      : buildDefaultEdges(nodeIdByKind)

  const normalizedArtifacts =
    isRecord(workspace)
      ? normalizeArtifacts(workspace.artifacts, validNodeIds, nodeIdRemap).map((artifact) => ({
          ...artifact,
          kind: mapLegacyArtifactKind(artifact.kind),
          label: artifact.kind === 'summary' ? 'Description' : artifact.label,
        }))
      : []

  return {
    id: isRecord(workspace) ? getString(workspace.id, fallback.id) : fallback.id,
    name,
    createdAt: isRecord(workspace) ? getFiniteNumber(workspace.createdAt, fallback.createdAt) : fallback.createdAt,
    updatedAt: isRecord(workspace) ? getFiniteNumber(workspace.updatedAt, fallback.updatedAt) : fallback.updatedAt,
    nodes,
    edges,
    artifacts: normalizedArtifacts,
    runs: isRecord(workspace) ? normalizeRuns(workspace.runs, validNodeIds) : [],
    threadMessages: isRecord(workspace)
      ? normalizeThreadMessages(workspace.threadMessages, validNodeIds)
      : [],
  }
}

export function artifactPreviewText(artifact: Artifact) {
  if (artifact.content?.trim()) return artifact.content.trim()
  if (artifact.items.length > 0) {
    return artifact.items
      .slice(0, 3)
      .map((item) => item.text)
      .join(' · ')
  }
  return ''
}

export function upsertArtifactItems(
  existing: Artifact | undefined,
  input: {
    nodeId: string
    outputId?: string
    kind: Artifact['kind']
    label: string
    content?: string
    items?: ArtifactItem[]
    payload?: unknown
    schemaVersion?: number
    outputSpecSnapshot?: PromptOutputSpecSnapshot
  },
) {
  const now = Date.now()

  if (existing) {
    return {
      ...existing,
      outputId: input.outputId ?? existing.outputId,
      label: input.label,
      content: input.content,
      items: input.items ?? existing.items,
      payload: input.payload ?? existing.payload,
      schemaVersion: input.schemaVersion ?? existing.schemaVersion,
      outputSpecSnapshot: input.outputSpecSnapshot ?? existing.outputSpecSnapshot,
      updatedAt: now,
    }
  }

  return {
    id: generateId(),
    nodeId: input.nodeId,
    outputId: input.outputId,
    kind: input.kind,
    label: input.label,
    content: input.content,
    items: input.items ?? [],
    payload: input.payload,
    schemaVersion: input.schemaVersion,
    outputSpecSnapshot: input.outputSpecSnapshot,
    createdAt: now,
    updatedAt: now,
  }
}
