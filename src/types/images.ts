import type { DrawingData } from './canvas'

export type ImageGenerationModel =
  | 'gemini-3.1-flash-image-preview'
  | 'gemini-3-pro-image-preview'

export type ImageAspectRatio = '1:1' | '3:2' | '16:9' | '9:16'
export type ImageSize = '1K' | '2K'
export type ImageAssetKind = 'reference' | 'result'
export type ImageTurnStatus = 'queued' | 'running' | 'complete' | 'failed' | 'canceled' | 'paused'
export type ImageTurnOrigin = 'new' | 'variant' | 'edit'
export type ImageViewMode = 'grid' | 'detail'

export interface ImageAssetMeta {
  id: string
  kind: ImageAssetKind
  mimeType: string
  createdAt: number
  sourceTurnId?: string
  name?: string
  isReusable?: boolean
}

export interface StoredImageAsset extends ImageAssetMeta {
  blob: Blob
}

export interface ImageAsset extends ImageAssetMeta {
  blob: Blob
  url: string
}

export interface ImageTurn {
  id: string
  status: ImageTurnStatus
  createdAt: number
  origin: ImageTurnOrigin
  sourceTurnId?: string
  prompt: string
  model: ImageGenerationModel
  count: number
  aspectRatio: ImageAspectRatio
  imageSize: ImageSize
  referenceAssetIds: string[]
  resultAssetIds: string[]
  responseText?: string
  warnings?: string[]
  error?: string
}

export interface ImageDraft {
  prompt: string
  model: ImageGenerationModel
  count: number
  aspectRatio: ImageAspectRatio
  imageSize: ImageSize
  referenceAssetIds: string[]
  origin: ImageTurnOrigin
  sourceTurnId?: string
  pipelineId?: string | null
}

export interface ImagePipeline {
  id: string
  name: string
  prompt: string
  model: ImageGenerationModel
  count: number
  aspectRatio: ImageAspectRatio
  imageSize: ImageSize
  pinnedAssetIds: string[]
  createdAt: number
  updatedAt: number
}

export const IMAGE_THREAD_SNAPSHOT_VERSION = 4 as const

export interface ImageThreadSnapshot {
  version: typeof IMAGE_THREAD_SNAPSHOT_VERSION
  turns: ImageTurn[]
  draft: ImageDraft
  composerDrawingData: DrawingData | null
  viewMode: ImageViewMode
  gridColumns: number
  queuePaused: boolean
  pipelines: ImagePipeline[]
}

export interface ImageGenerationModelOption {
  id: ImageGenerationModel
  name: string
  summary: string
}

export const IMAGE_GENERATION_MODELS: ImageGenerationModelOption[] = [
  {
    id: 'gemini-3.1-flash-image-preview',
    name: 'Nano Banana 2',
    summary: 'Faster image generation for iterative and higher-volume use.',
  },
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Nano Banana Pro',
    summary: 'Higher-fidelity asset generation for more demanding prompts.',
  },
]

export const IMAGE_COUNT_OPTIONS = [1, 2, 4] as const
export const IMAGE_ASPECT_RATIO_OPTIONS: ImageAspectRatio[] = ['1:1', '3:2', '16:9', '9:16']
export const IMAGE_SIZE_OPTIONS: ImageSize[] = ['1K', '2K']
export const IMAGE_VIEW_MODE_OPTIONS: Array<{ id: ImageViewMode; label: string }> = [
  { id: 'grid', label: 'Grid' },
  { id: 'detail', label: 'Detail' },
]
export const MAX_IMAGE_REFERENCE_COUNT = 14
export const DEFAULT_IMAGE_GRID_COLUMNS = 5
export const MIN_IMAGE_GRID_COLUMNS = 2
export const MAX_IMAGE_GRID_COLUMNS = 10

export const DEFAULT_IMAGE_DRAFT: ImageDraft = {
  prompt: '',
  model: 'gemini-3.1-flash-image-preview',
  count: 1,
  aspectRatio: '1:1',
  imageSize: '1K',
  referenceAssetIds: [],
  origin: 'new',
  pipelineId: null,
}

export function normalizeImageViewMode(
  viewMode: string | undefined,
  legacyGridZoom?: string,
): ImageViewMode {
  if (viewMode === 'grid' || viewMode === 'detail') return viewMode
  if (legacyGridZoom === 'detail') return 'detail'
  if (legacyGridZoom === 'compact' || legacyGridZoom === 'list' || legacyGridZoom === 'comfortable') {
    return 'grid'
  }
  return 'grid'
}

export function normalizeImageGridColumns(value: number | undefined): number {
  const numericValue = typeof value === 'number' ? value : Number.NaN

  if (!Number.isFinite(numericValue)) return DEFAULT_IMAGE_GRID_COLUMNS

  return Math.min(
    MAX_IMAGE_GRID_COLUMNS,
    Math.max(MIN_IMAGE_GRID_COLUMNS, Math.round(numericValue)),
  )
}
