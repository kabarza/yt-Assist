import type { ImageGenerationModel } from '@/types/images'

export type ThumbnailToolMode = 'move' | 'transform'
export type ThumbnailLayerKind = 'background' | 'image' | 'text'
export type ThumbnailTextAlign = 'left' | 'center' | 'right'
export type ThumbnailImageFit = 'cover'
export type ThumbnailAiMode = 'replace' | 'remove_background' | 'outpaint'
export type ThumbnailAiJobStatus = 'idle' | 'running' | 'complete' | 'error'
export type ThumbnailAssetSource =
  | 'upload'
  | 'imageLibrary'
  | 'imageResult'
  | 'canvasLab'
  | 'thumbnailAi'
  | 'thumbnailImport'

export interface ThumbnailBoard {
  width: number
  height: number
  backgroundColor: string
}

export interface ThumbnailTextStylePreset {
  id: string
  name: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  color: string
  align: ThumbnailTextAlign
  letterSpacing: number
  lineHeight: number
  strokeColor?: string
  strokeWidth?: number
  shadowColor?: string
  shadowBlur?: number
}

export interface ThumbnailBrandKit {
  id: string
  name: string
  fontFamily: string
  themeName: string
  backgroundColor: string
  brandColors: string[]
  textStyles: ThumbnailTextStylePreset[]
}

export interface ThumbnailBrandOverrides {
  fontFamily?: string
  backgroundColor?: string
  brandColors?: string[]
  textStyles?: ThumbnailTextStylePreset[]
}

interface ThumbnailLayerBase {
  id: string
  kind: ThumbnailLayerKind
  name: string
  x: number
  y: number
  width: number
  height: number
  hidden: boolean
  locked: boolean
  opacity: number
  createdAt: number
  updatedAt: number
}

interface ThumbnailVisualImageLayer extends ThumbnailLayerBase {
  kind: 'background' | 'image'
  assetId: string | null
  fit: ThumbnailImageFit
  contentOffsetX: number
  contentOffsetY: number
  contentWidth: number
  contentHeight: number
}

export interface ThumbnailBackgroundLayer extends ThumbnailVisualImageLayer {
  kind: 'background'
}

export interface ThumbnailImageLayer extends ThumbnailVisualImageLayer {
  kind: 'image'
}

export interface ThumbnailTextStyle {
  fontFamily: string
  fontSize: number
  fontWeight: number
  color: string
  align: ThumbnailTextAlign
  letterSpacing: number
  lineHeight: number
  strokeColor?: string
  strokeWidth?: number
  shadowColor?: string
  shadowBlur?: number
}

export interface ThumbnailTextLayer extends ThumbnailLayerBase {
  kind: 'text'
  text: string
  style: ThumbnailTextStyle
}

export type ThumbnailLayer = ThumbnailBackgroundLayer | ThumbnailImageLayer | ThumbnailTextLayer

export interface ThumbnailDocument {
  id: string
  name: string
  board: ThumbnailBoard
  brandKitId: string
  brandOverrides: ThumbnailBrandOverrides
  layers: ThumbnailLayer[]
  selectedLayerId: string | null
  createdAt: number
  updatedAt: number
}

export interface StoredThumbnailAsset {
  id: string
  name: string
  mimeType: string
  createdAt: number
  source: ThumbnailAssetSource
  blob: Blob
  width?: number
  height?: number
}

export interface ThumbnailAsset extends StoredThumbnailAsset {
  url: string
}

export interface ThumbnailAiJob {
  id: string
  documentId: string
  targetLayerId: string
  mode: ThumbnailAiMode
  model: ImageGenerationModel
  prompt: string
  count: 1 | 2 | 4
  status: ThumbnailAiJobStatus
  candidateAssetIds: string[]
  warnings?: string[]
  error?: string
  outpaint?: {
    top: number
    right: number
    bottom: number
    left: number
  }
  createdAt: number
  updatedAt: number
}

export interface ThumbnailEditorSnapshot {
  version: 1
  documents: ThumbnailDocument[]
  activeDocumentId: string | null
  brandKits: ThumbnailBrandKit[]
}

export interface ThumbnailEditRequest {
  mode: ThumbnailAiMode
  model: ImageGenerationModel
  prompt?: string
  count: 1 | 2 | 4
  targetImage: {
    dataUrl: string
    mimeType: string
  }
  contextImage?: {
    dataUrl: string
    mimeType: string
  }
  board: {
    width: number
    height: number
  }
  layerFrame: {
    x: number
    y: number
    width: number
    height: number
  }
  outpaint?: {
    top: number
    right: number
    bottom: number
    left: number
  }
  apiKeyOverride?: string
}

export interface ThumbnailEditResponse {
  images: Array<{
    mimeType: string
    dataUrl: string
  }>
  text?: string
  warnings?: string[]
}

export interface ThumbnailBoardPreset {
  id: string
  label: string
  width: number
  height: number
}

export const THUMBNAIL_EDITOR_SNAPSHOT_VERSION = 1 as const

export const THUMBNAIL_BOARD_PRESETS: ThumbnailBoardPreset[] = [
  { id: 'youtube', label: 'YouTube 1280x720', width: 1280, height: 720 },
  { id: 'full-hd', label: 'Full HD 1920x1080', width: 1920, height: 1080 },
  { id: 'square', label: 'Square 1024x1024', width: 1024, height: 1024 },
  { id: 'portrait', label: 'Portrait 1080x1350', width: 1080, height: 1350 },
]

