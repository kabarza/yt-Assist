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
  ComposeNodeConfig,
  ComposeItem,
  NodeRun,
  NodeThreadMessage,
  PackagingBriefConfig,
  TranscriptArtifacts,
} from '@/types/canvasLab'
import type { AppSettings } from '@/stores/settingsStore'

export const DEFAULT_PACKAGING_BRIEF: PackagingBriefConfig = {
  mustInclude: '',
  niceToInclude: '',
  avoidWords: '',
  includeName: false,
  nameForTitles: '',
  additionalContext: '',
  transcriptIncludeTimestamps: true,
}

const DEFAULT_NODE_LABELS: Record<CanvasLabNodeKind, string> = {
  transcript_source: 'Transcript Source',
  packaging_brief: 'Packaging Brief',
  titles: 'Titles',
  summary: 'Summary',
  chapters: 'Chapters',
  thumbnail_copy: 'Thumbnail Copy',
  image_prompt: 'Image Prompt',
  image_generate: 'Image Gen',
  chat: 'Chat',
  asset_library: 'Asset Library',
  compose: 'Compose',
}

const LEGACY_DEFAULT_NODE_POSITIONS: Record<CanvasLabNodeKind, { x: number; y: number }> = {
  transcript_source: { x: 36, y: 70 },
  packaging_brief: { x: 36, y: 410 },
  titles: { x: 420, y: 36 },
  summary: { x: 420, y: 268 },
  chapters: { x: 420, y: 500 },
  thumbnail_copy: { x: 420, y: 732 },
  image_prompt: { x: 816, y: 154 },
  image_generate: { x: 1210, y: 154 },
  asset_library: { x: 816, y: 470 },
  compose: { x: 1210, y: 470 },
  chat: { x: 816, y: 786 },
}

const DEFAULT_CANVAS_LAYOUT: Record<CanvasLabNodeKind, { x: number; y: number }> = {
  transcript_source: { x: 88, y: 80 },
  packaging_brief: { x: 88, y: 458 },
  chat: { x: 88, y: 878 },
  titles: { x: 592, y: 36 },
  summary: { x: 592, y: 308 },
  thumbnail_copy: { x: 592, y: 580 },
  chapters: { x: 592, y: 892 },
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

function getDefaultCanvasPosition(kind: CanvasLabNodeKind) {
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

function defaultOutputRequestedCount(kind: Extract<CanvasLabNodeKind, 'titles' | 'summary' | 'chapters' | 'thumbnail_copy' | 'image_prompt'>) {
  switch (kind) {
    case 'titles':
      return 10
    case 'summary':
      return 1
    case 'chapters':
      return 8
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
      return {
        transcript: '',
        artifacts: createEmptyTranscriptArtifacts(),
      }
    case 'packaging_brief':
      return { ...DEFAULT_PACKAGING_BRIEF }
    case 'titles':
    case 'summary':
    case 'chapters':
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
      return {
        transcript,
        artifacts: normalizeTranscriptArtifacts(config.artifacts, transcript),
      }
    }
    case 'packaging_brief':
      return {
        mustInclude: getString(config.mustInclude),
        niceToInclude: getString(config.niceToInclude),
        avoidWords: getString(config.avoidWords),
        includeName: getBoolean(config.includeName),
        nameForTitles: getString(config.nameForTitles),
        additionalContext: getString(config.additionalContext),
        transcriptIncludeTimestamps: getBoolean(config.transcriptIncludeTimestamps, true),
      }
    case 'titles':
    case 'summary':
    case 'chapters':
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

function normalizeArtifacts(input: unknown, validNodeIds: Set<string>) {
  if (!Array.isArray(input)) return []

  const artifacts: Artifact[] = []

  for (const artifact of input) {
      if (!isRecord(artifact)) continue
      const nodeId = getString(artifact.nodeId)
      if (!nodeId || !validNodeIds.has(nodeId)) continue
      const kind = getString(artifact.kind)
      const label = getString(artifact.label).trim()
      if (!kind || !label) continue

      artifacts.push({
        id: getString(artifact.id, generateId()),
        nodeId,
        kind: kind as Artifact['kind'],
        label,
        content: getString(artifact.content, '') || undefined,
        items: Array.isArray(artifact.items)
          ? artifact.items
              .map((item) => normalizeArtifactItem(item))
              .filter((item): item is ArtifactItem => Boolean(item))
          : [],
        createdAt: getFiniteNumber(artifact.createdAt, Date.now()),
        updatedAt: getFiniteNumber(artifact.updatedAt, Date.now()),
      })
  }

  return artifacts
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
) {
  if (!Array.isArray(input)) return []

  const nextEdges = input
    .map((edge) => {
      if (!isRecord(edge)) return null
      const source = getString(edge.source)
      const target = getString(edge.target)
      if (!source || !target || source === target) return null
      if (!validNodeIds.has(source) || !validNodeIds.has(target)) return null

      return {
        id: getString(edge.id, generateId()),
        source,
        target,
        createdAt: getFiniteNumber(edge.createdAt, Date.now()),
      } satisfies CanvasEdge
    })
    .filter((edge): edge is CanvasEdge => Boolean(edge))

  return nextEdges
}

export function createInitialCanvasWorkspace(name: string, settings: AppSettings): CanvasWorkspace {
  const transcriptPosition = getDefaultCanvasPosition('transcript_source')
  const transcriptNode = {
    ...createNodeBase(
      'transcript_source',
      'Transcript Source',
      transcriptPosition.x,
      transcriptPosition.y,
    ),
    config: {
      transcript: '',
      artifacts: createEmptyTranscriptArtifacts(),
    },
  }

  const briefPosition = getDefaultCanvasPosition('packaging_brief')
  const briefNode = {
    ...createNodeBase(
      'packaging_brief',
      'Packaging Brief',
      briefPosition.x,
      briefPosition.y,
    ),
    config: { ...DEFAULT_PACKAGING_BRIEF },
  }

  const openAiModel = MODELS.openai.some((entry) => entry.id === settings.defaultModel)
    ? settings.defaultModel
    : MODELS.openai[0].id

  const chatModel =
    settings.defaultProvider === 'anthropic'
      ? MODELS.anthropic.some((entry) => entry.id === settings.defaultModel)
        ? settings.defaultModel
        : MODELS.anthropic[0].id
      : openAiModel

  const composeConfig: ComposeNodeConfig = {
    items: [],
    selectedItemId: null,
  }

  const nodes = [
    transcriptNode,
    briefNode,
    {
      ...createNodeBase(
        'titles',
        'Titles',
        DEFAULT_CANVAS_LAYOUT.titles.x,
        DEFAULT_CANVAS_LAYOUT.titles.y,
      ),
      config: { requestedCount: 10, draftInstruction: '' },
    },
    {
      ...createNodeBase(
        'summary',
        'Summary',
        DEFAULT_CANVAS_LAYOUT.summary.x,
        DEFAULT_CANVAS_LAYOUT.summary.y,
      ),
      config: { requestedCount: 1, draftInstruction: '' },
    },
    {
      ...createNodeBase(
        'chapters',
        'Chapters',
        DEFAULT_CANVAS_LAYOUT.chapters.x,
        DEFAULT_CANVAS_LAYOUT.chapters.y,
      ),
      config: { requestedCount: 8, draftInstruction: '' },
    },
    {
      ...createNodeBase(
        'thumbnail_copy',
        'Thumbnail Copy',
        DEFAULT_CANVAS_LAYOUT.thumbnail_copy.x,
        DEFAULT_CANVAS_LAYOUT.thumbnail_copy.y,
      ),
      config: { requestedCount: 10, draftInstruction: '' },
    },
    {
      ...createNodeBase(
        'image_prompt',
        'Image Prompt',
        DEFAULT_CANVAS_LAYOUT.image_prompt.x,
        DEFAULT_CANVAS_LAYOUT.image_prompt.y,
      ),
      config: { requestedCount: 1, draftInstruction: '' },
    },
    {
      ...createNodeBase(
        'image_generate',
        'Image Gen',
        DEFAULT_CANVAS_LAYOUT.image_generate.x,
        DEFAULT_CANVAS_LAYOUT.image_generate.y,
      ),
      config: {
        model: 'gemini-3.1-flash-image-preview',
        count: 1,
        aspectRatio: '16:9',
        imageSize: '1K',
      } as const,
    },
    {
      ...createNodeBase(
        'asset_library',
        'Asset Library',
        DEFAULT_CANVAS_LAYOUT.asset_library.x,
        DEFAULT_CANVAS_LAYOUT.asset_library.y,
      ),
      config: { assetIds: [] },
    },
    {
      ...createNodeBase(
        'compose',
        'Compose',
        DEFAULT_CANVAS_LAYOUT.compose.x,
        DEFAULT_CANVAS_LAYOUT.compose.y,
      ),
      config: composeConfig,
    },
    {
      ...createNodeBase(
        'chat',
        'Chat',
        DEFAULT_CANVAS_LAYOUT.chat.x,
        DEFAULT_CANVAS_LAYOUT.chat.y,
      ),
      config: {
        provider: settings.defaultProvider,
        model: chatModel,
        draftPrompt: '',
        systemPrompt: '',
      },
    },
  ]

  const [sourceId, briefId, titlesId, summaryId, chaptersId, thumbId, imagePromptId, imageGenId, assetId, composeId, chatId] =
    nodes.map((node) => node.id)

  const edges = [
    { id: generateId(), source: sourceId, target: titlesId, createdAt: Date.now() },
    { id: generateId(), source: briefId, target: titlesId, createdAt: Date.now() },
    { id: generateId(), source: sourceId, target: summaryId, createdAt: Date.now() },
    { id: generateId(), source: briefId, target: summaryId, createdAt: Date.now() },
    { id: generateId(), source: sourceId, target: chaptersId, createdAt: Date.now() },
    { id: generateId(), source: briefId, target: chaptersId, createdAt: Date.now() },
    { id: generateId(), source: sourceId, target: thumbId, createdAt: Date.now() },
    { id: generateId(), source: briefId, target: thumbId, createdAt: Date.now() },
    { id: generateId(), source: titlesId, target: imagePromptId, createdAt: Date.now() },
    { id: generateId(), source: thumbId, target: imagePromptId, createdAt: Date.now() },
    { id: generateId(), source: sourceId, target: imagePromptId, createdAt: Date.now() },
    { id: generateId(), source: briefId, target: imagePromptId, createdAt: Date.now() },
    { id: generateId(), source: imagePromptId, target: imageGenId, createdAt: Date.now() },
    { id: generateId(), source: assetId, target: imageGenId, createdAt: Date.now() },
    { id: generateId(), source: titlesId, target: composeId, createdAt: Date.now() },
    { id: generateId(), source: thumbId, target: composeId, createdAt: Date.now() },
    { id: generateId(), source: imageGenId, target: composeId, createdAt: Date.now() },
    { id: generateId(), source: assetId, target: composeId, createdAt: Date.now() },
    { id: generateId(), source: sourceId, target: chatId, createdAt: Date.now() },
    { id: generateId(), source: briefId, target: chatId, createdAt: Date.now() },
  ]

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
    fallback.nodes.map((node) => [node.kind, node]),
  ) as Record<CanvasLabNodeKind, CanvasNode>

  const existingNodesByKind = new Map<CanvasLabNodeKind, unknown>()
  if (isRecord(workspace) && Array.isArray(workspace.nodes)) {
    for (const node of workspace.nodes) {
      if (!isRecord(node) || typeof node.kind !== 'string') continue
      if (!(node.kind in fallbackByKind)) continue
      if (!existingNodesByKind.has(node.kind as CanvasLabNodeKind)) {
        existingNodesByKind.set(node.kind as CanvasLabNodeKind, node)
      }
    }
  }

  const nodes = fallback.nodes.map((fallbackNode) =>
    normalizeNode(
      existingNodesByKind.get(fallbackNode.kind),
      fallbackNode.kind,
      settings,
      fallbackNode,
    ),
  )

  const validNodeIds = new Set(nodes.map((node) => node.id))
  const nodeIdByKind = Object.fromEntries(nodes.map((node) => [node.kind, node.id])) as Record<
    CanvasLabNodeKind,
    string
  >

  const persistedEdges =
    isRecord(workspace) && 'edges' in workspace
      ? normalizeEdges(workspace.edges, validNodeIds)
      : []

  const edges =
    persistedEdges.length > 0
      ? persistedEdges
      : fallback.edges.map((edge) => {
          const sourceKind = fallback.nodes.find((node) => node.id === edge.source)?.kind
          const targetKind = fallback.nodes.find((node) => node.id === edge.target)?.kind
          return {
            id: generateId(),
            source: sourceKind ? nodeIdByKind[sourceKind] : edge.source,
            target: targetKind ? nodeIdByKind[targetKind] : edge.target,
            createdAt: edge.createdAt,
          }
        })

  return {
    id: isRecord(workspace) ? getString(workspace.id, fallback.id) : fallback.id,
    name,
    createdAt: isRecord(workspace) ? getFiniteNumber(workspace.createdAt, fallback.createdAt) : fallback.createdAt,
    updatedAt: isRecord(workspace) ? getFiniteNumber(workspace.updatedAt, fallback.updatedAt) : fallback.updatedAt,
    nodes,
    edges,
    artifacts: isRecord(workspace) ? normalizeArtifacts(workspace.artifacts, validNodeIds) : [],
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
    kind: Artifact['kind']
    label: string
    content?: string
    items?: ArtifactItem[]
  },
) {
  const now = Date.now()

  if (existing) {
    return {
      ...existing,
      label: input.label,
      content: input.content,
      items: input.items ?? existing.items,
      updatedAt: now,
    }
  }

  return {
    id: generateId(),
    nodeId: input.nodeId,
    kind: input.kind,
    label: input.label,
    content: input.content,
    items: input.items ?? [],
    createdAt: now,
    updatedAt: now,
  }
}
