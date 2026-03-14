export type ImageGenerationModel =
  | 'gemini-3.1-flash-image-preview'
  | 'gemini-3-pro-image-preview'

export type ImageAspectRatio = '1:1' | '3:2' | '16:9' | '9:16'
export type ImageSize = '1K' | '2K'
export type ImageAssetKind = 'reference' | 'result'
export type ImageTurnStatus = 'queued' | 'running' | 'complete' | 'failed' | 'canceled' | 'paused'
export type ImageTurnOrigin = 'new' | 'variant' | 'edit'
export type ImageGridZoom = 'compact' | 'list' | 'detail'

export interface ImageAssetMeta {
  id: string
  kind: ImageAssetKind
  mimeType: string
  createdAt: number
  sourceTurnId?: string
  name?: string
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
}

export const IMAGE_THREAD_SNAPSHOT_VERSION = 1 as const

export interface ImageThreadSnapshot {
  version: typeof IMAGE_THREAD_SNAPSHOT_VERSION
  turns: ImageTurn[]
  draft: ImageDraft
  gridZoom: ImageGridZoom
  queuePaused: boolean
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
export const IMAGE_GRID_ZOOM_OPTIONS: Array<{ id: ImageGridZoom; label: string }> = [
  { id: 'compact', label: 'Compact' },
  { id: 'list', label: 'List' },
  { id: 'detail', label: 'Detail' },
]

export const DEFAULT_IMAGE_DRAFT: ImageDraft = {
  prompt: '',
  model: 'gemini-3.1-flash-image-preview',
  count: 1,
  aspectRatio: '1:1',
  imageSize: '1K',
  referenceAssetIds: [],
  origin: 'new',
}
