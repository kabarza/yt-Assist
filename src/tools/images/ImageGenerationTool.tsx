import {
  useCallback,
  useEffect,
  useMemo,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SyntheticEvent,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
} from 'react'
import Masonry from '@mui/lab/Masonry'
import Skeleton from '@mui/material/Skeleton'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  Copy,
  Download,
  GripHorizontal,
  Info,
  Loader2,
  Pause,
  Pencil,
  Play,
  Library,
  RefreshCcw,
  Sparkles,
  Square,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { DrawingCanvas } from '@/chat/DrawingCanvas'
import ConfirmDialog from '@/components/ConfirmDialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToolBody, ToolContainer, ToolHeader, ToolShell } from '@/components/layout/ToolShell'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { requestGeneratedImages } from '@/utils/imageApiClient'
import { showBackgroundTaskCompletionToast } from '@/utils/taskCompletionToast'
import { useImageGenerationStore } from '@/stores/imageGenerationStore'
import type { DrawingCanvasRef, DrawingData } from '@/types/canvas'
import type {
  ImageAsset,
  ImageAspectRatio,
  ImageDraft,
  ImageGenerationModel,
  ImagePipeline,
  ImageSize,
  ImageTurn,
  ImageTurnStatus,
} from '@/types/images'
import {
  DEFAULT_IMAGE_DRAFT,
  IMAGE_ASPECT_RATIO_OPTIONS,
  IMAGE_COUNT_OPTIONS,
  IMAGE_GENERATION_MODELS,
  IMAGE_SIZE_OPTIONS,
  IMAGE_VIEW_MODE_OPTIONS,
  MAX_IMAGE_GRID_COLUMNS,
  MAX_IMAGE_REFERENCE_COUNT,
  MIN_IMAGE_GRID_COLUMNS,
} from '@/types/images'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const COMPACT_COMPOSER_DEFAULT_PROMPT_HEIGHT = 160
const COMPACT_COMPOSER_MIN_PROMPT_HEIGHT = 120
const COMPACT_COMPOSER_MAX_PROMPT_HEIGHT = 360
const MASONRY_SPACING = 1.5

interface ViewerSelection {
  turnId: string
  assetId: string
  assetIds: string[]
}

interface TurnViewerItem {
  turnId: string
  assetId: string
  asset: ImageAsset
  kind: 'reference' | 'result'
  position: number
}

interface GridResultItem {
  turnId: string
  assetId: string
  asset: ImageAsset
  position: number
  createdAt: number
  aspectRatio: ImageAspectRatio
}

interface ComposerContextMeta {
  title: string
  detail?: string
  description: string
}

type ImageDownloadVariant = 'original' | 'png' | 'jpeg-100' | 'jpeg-80' | 'jpeg-60'

function modelLabel(modelId: ImageGenerationModel) {
  return IMAGE_GENERATION_MODELS.find((entry) => entry.id === modelId)?.name ?? modelId
}

function buildDownloadBaseName(prompt: string, index: number) {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'image'

  return `${slug}-${index + 1}`
}

function buildDrawingReferenceName(index: number) {
  return `drawing-reference-${index}.png`
}

function getSequentialMasonryColumns(preferredColumns: number, itemCount: number) {
  return Math.max(1, Math.min(preferredColumns, itemCount || 1))
}

function SequentialMasonry({
  columns,
  children,
}: {
  columns: number
  children: NonNullable<ReactNode>
}) {
  return (
    <div className="w-full px-1.5">
      <Masonry columns={columns} spacing={MASONRY_SPACING} sequential>
        {children}
      </Masonry>
    </div>
  )
}

function ProgressiveResultImage({
  src,
  alt,
  aspectRatio,
  className,
  imageClassName,
}: {
  src: string
  alt: string
  aspectRatio: ImageAspectRatio
  className?: string
  imageClassName?: string
}) {
  const [isLoaded, setIsLoaded] = useState(false)
  const cssAspectRatio = toCssAspectRatio(aspectRatio)

  useEffect(() => {
    setIsLoaded(false)
  }, [src])

  const handleLoad = useCallback((_event: SyntheticEvent<HTMLImageElement>) => {
    setIsLoaded(true)
  }, [])

  return (
    <div
      className={cn('relative overflow-hidden bg-muted/30', className)}
      style={{ aspectRatio: cssAspectRatio }}
    >
      {!isLoaded ? (
        <>
          <Skeleton
            variant="rectangular"
            animation="wave"
            className="absolute inset-0 h-full w-full rounded-none bg-muted/70"
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(var(--foreground)/0.06),_transparent_58%)]" />
        </>
      ) : null}

      <img
        src={src}
        alt={alt}
        onLoad={handleLoad}
        onError={handleLoad}
        className={cn(
          'absolute inset-0 h-full w-full object-cover transition-opacity duration-200',
          isLoaded ? 'opacity-100' : 'opacity-0',
          imageClassName
        )}
      />
    </div>
  )
}

function normalizeMimeType(mimeType: string) {
  return mimeType.split(';', 1)[0]?.trim().toLowerCase() || 'application/octet-stream'
}

function getFileExtensionFromMimeType(mimeType: string) {
  switch (normalizeMimeType(mimeType)) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    case 'image/avif':
      return 'avif'
    case 'image/svg+xml':
      return 'svg'
    default:
      return null
  }
}

function getFileExtensionFromName(filename?: string) {
  if (!filename) return null

  const match = filename.trim().match(/\.([a-z0-9]+)$/i)
  return match ? match[1].toLowerCase() : null
}

function stripFileExtension(filename: string) {
  return filename.replace(/\.[^.]+$/, '')
}

function getAssetBaseDownloadName(turn: ImageTurn, item: TurnViewerItem) {
  if (item.kind === 'reference') {
    const referenceName = item.asset.name?.trim()
    return referenceName ? stripFileExtension(referenceName) : `source-image-${item.position}`
  }

  return buildDownloadBaseName(turn.prompt, item.position - 1)
}

function getOriginalAssetExtension(asset: ImageAsset) {
  return getFileExtensionFromMimeType(asset.mimeType) ?? getFileExtensionFromName(asset.name) ?? 'png'
}

function resolveTurnAssets(turn: ImageTurn, assetsById: Record<string, ImageAsset>) {
  const referenceAssets = turn.referenceAssetIds
    .map((assetId) => assetsById[assetId])
    .filter((asset): asset is ImageAsset => Boolean(asset))
  const resultAssets = turn.resultAssetIds
    .map((assetId) => assetsById[assetId])
    .filter((asset): asset is ImageAsset => Boolean(asset))

  return { referenceAssets, resultAssets }
}

function buildTurnViewerItems(turn: ImageTurn, assetsById: Record<string, ImageAsset>): TurnViewerItem[] {
  const { referenceAssets, resultAssets } = resolveTurnAssets(turn, assetsById)

  return [
    ...referenceAssets.map((asset, index) => ({
      turnId: turn.id,
      assetId: asset.id,
      asset,
      kind: 'reference' as const,
      position: index + 1,
    })),
    ...resultAssets.map((asset, index) => ({
      turnId: turn.id,
      assetId: asset.id,
      asset,
      kind: 'result' as const,
      position: index + 1,
    })),
  ]
}

function buildViewerAssetOrder(
  turn: ImageTurn,
  assetsById: Record<string, ImageAsset>,
) {
  const { referenceAssets, resultAssets } = resolveTurnAssets(turn, assetsById)
  const referenceAssetIds = referenceAssets.map((asset) => asset.id)
  const resultAssetIds = resultAssets.map((asset) => asset.id)

  return [...referenceAssetIds, ...resultAssetIds]
}

function buildResultViewerAssetOrder(
  turn: ImageTurn,
  assetsById: Record<string, ImageAsset>,
) {
  return resolveTurnAssets(turn, assetsById).resultAssets.map((asset) => asset.id)
}

function getViewerItemLabel(item: TurnViewerItem) {
  return item.kind === 'reference' ? 'Source image' : 'Generated result'
}

function getViewerItemTitle(item: TurnViewerItem) {
  return item.kind === 'reference'
    ? item.asset.name || `Source image ${item.position}`
    : `Result ${item.position}`
}

function getViewerItemDescription(item: TurnViewerItem) {
  return item.kind === 'reference'
    ? 'Uploaded source used to guide this batch.'
    : 'Generated output from this batch.'
}

function buildAssetDownloadName(
  turn: ImageTurn,
  item: TurnViewerItem,
  variant: ImageDownloadVariant = 'original',
) {
  const baseName = getAssetBaseDownloadName(turn, item)

  switch (variant) {
    case 'png':
      return `${baseName}-png.png`
    case 'jpeg-100':
      return `${baseName}-jpeg-100.jpg`
    case 'jpeg-80':
      return `${baseName}-jpeg-80.jpg`
    case 'jpeg-60':
      return `${baseName}-jpeg-60.jpg`
    case 'original':
    default:
      return `${baseName}.${getOriginalAssetExtension(item.asset)}`
  }
}

function toCssAspectRatio(aspectRatio: ImageAspectRatio) {
  return aspectRatio.replace(':', ' / ')
}

function getStatusVariant(status: ImageTurnStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'complete':
      return 'default'
    case 'running':
      return 'secondary'
    case 'failed':
      return 'destructive'
    default:
      return 'outline'
  }
}

function getStatusLabel(status: ImageTurnStatus) {
  switch (status) {
    case 'queued':
      return 'Queued'
    case 'running':
      return 'Generating'
    case 'complete':
      return 'Complete'
    case 'failed':
      return 'Failed'
    case 'canceled':
      return 'Canceled'
    case 'paused':
      return 'Paused'
  }
}

function getOriginLabel(turn: ImageTurn) {
  if (turn.origin === 'variant') return 'Variant'
  if (turn.origin === 'edit') return 'Edit'
  return 'New'
}

function getPromptPreview(prompt: string) {
  const collapsed = prompt.replace(/\s+/g, ' ').trim()
  return collapsed.length > 180 ? `${collapsed.slice(0, 177)}...` : collapsed
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'))
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl)
  return await response.blob()
}

function triggerAssetDownload(url: string, filename: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function downloadAsset(asset: ImageAsset, filename: string) {
  triggerAssetDownload(asset.url, filename)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  triggerAssetDownload(url, filename)
  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 0)
}

async function renderBlobToCanvas(blob: Blob, exportMimeType: 'image/png' | 'image/jpeg') {
  const imageUrl = URL.createObjectURL(blob)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image()
      nextImage.decoding = 'async'
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () => reject(new Error('Failed to load the image for conversion.'))
      nextImage.src = imageUrl
    })

    const width = image.naturalWidth || image.width
    const height = image.naturalHeight || image.height

    if (!width || !height) {
      throw new Error('Image has invalid dimensions.')
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Canvas conversion is not available in this browser.')
    }

    if (exportMimeType === 'image/jpeg') {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)
    }

    context.drawImage(image, 0, 0, width, height)
    return canvas
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

async function exportImageVariant(
  asset: ImageAsset,
  variant: Exclude<ImageDownloadVariant, 'original'>,
) {
  const exportMimeType = variant === 'png' ? 'image/png' : 'image/jpeg'
  const quality = variant === 'jpeg-100' ? 1 : variant === 'jpeg-80' ? 0.8 : variant === 'jpeg-60' ? 0.6 : undefined
  const canvas = await renderBlobToCanvas(asset.blob, exportMimeType)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Could not create the converted image.'))
        return
      }

      resolve(blob)
    }, exportMimeType, quality)
  })
}

function classifyImageGenerationError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error)

  if (/GEMINI_API_KEY not configured/i.test(raw)) {
    return 'Add a Gemini API key in Settings or configure GEMINI_API_KEY on the server.'
  }

  if (/Quota exceeded/i.test(raw) && /free.?tier/i.test(raw)) {
    return 'This Gemini project is still on Free tier or has no paid quota for Nano Banana 2 / Pro. Upgrade the exact AI Studio project tied to your API key and try again.'
  }

  if (/rate limit/i.test(raw)) {
    return 'Gemini rate limit reached. Wait a moment or reduce parallel usage on the same project.'
  }

  return raw
}

function TurnStatusBadge({ status }: { status: ImageTurnStatus }) {
  return <Badge variant={getStatusVariant(status)}>{getStatusLabel(status)}</Badge>
}

function isDraftDirty(draft: ImageDraft) {
  return Boolean(
    draft.prompt.trim()
    || draft.referenceAssetIds.length > 0
    || draft.origin !== 'new'
    || draft.sourceTurnId
    || draft.pipelineId
    || draft.model !== DEFAULT_IMAGE_DRAFT.model
    || draft.count !== DEFAULT_IMAGE_DRAFT.count
    || draft.aspectRatio !== DEFAULT_IMAGE_DRAFT.aspectRatio
    || draft.imageSize !== DEFAULT_IMAGE_DRAFT.imageSize
  )
}

function hasClearableDraftState(draft: ImageDraft) {
  return Boolean(
    draft.prompt.trim()
    || draft.referenceAssetIds.length > 0
    || draft.origin !== 'new'
    || draft.sourceTurnId
    || draft.pipelineId
  )
}

function getComposerContextMeta(
  draft: ImageDraft,
  activePipeline: ImagePipeline | null,
): ComposerContextMeta | null {
  if (activePipeline) {
    return {
      title: 'Pipeline active',
      detail: activePipeline.name,
      description: `Saved prompt, settings, and ${activePipeline.pinnedAssetIds.length} pinned reference${activePipeline.pinnedAssetIds.length === 1 ? '' : 's'}. New images only affect the next run unless you update the pipeline.`,
    }
  }

  if (draft.origin === 'edit') {
    return {
      title: 'Editing result',
      description: 'This submission will be appended as a new turn in the same thread.',
    }
  }

  if (draft.origin !== 'new' || draft.sourceTurnId) {
    return {
      title: 'Another version',
      description: 'This submission will be appended as a new turn in the same thread.',
    }
  }

  return null
}

export default function ImageGenerationTool() {
  const [searchParams] = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const libraryFileInputRef = useRef<HTMLInputElement>(null)
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null)
  const drawingCanvasRef = useRef<DrawingCanvasRef>(null)
  const threadScrollRef = useRef<HTMLDivElement>(null)
  const composerOverlayRef = useRef<HTMLDivElement>(null)
  const promptResizeStateRef = useRef<{ startY: number; startHeight: number } | null>(null)
  const workerBusyRef = useRef(false)
  const runningTurnIdRef = useRef<string | null>(null)
  const currentAbortControllerRef = useRef<AbortController | null>(null)
  const previousTailSignatureRef = useRef<string>('')

  const {
    isHydrated,
    isHydrating,
    hydrationError,
    turns,
    assetsById,
    pipelines,
    draft,
    composerDrawingData,
    viewMode,
    gridColumns,
    queuePaused,
    hydrate,
    setDraftPrompt,
    setDraftModel,
    setDraftCount,
    setDraftAspectRatio,
    setDraftImageSize,
    setComposerDrawingData,
    clearComposerDrawingData,
    resetDraft,
    addDraftReference,
    addDraftReferenceIds,
    addReusableAsset,
    renameAsset,
    deleteReusableAsset,
    removeDraftReference,
    savePipeline,
    updatePipeline,
    applyPipeline,
    deletePipeline,
    enqueueDraft,
    pauseQueue,
    resumeQueue,
    setViewMode,
    setGridColumns,
    markTurnRunning,
    completeTurn,
    failTurn,
    cancelTurn,
    removeTurn,
    retryTurn,
    prefillFromTurn,
    prefillForEdit,
  } = useImageGenerationStore()

  const [expandedTurnIds, setExpandedTurnIds] = useState<Record<string, boolean>>({})
  const [selectedImage, setSelectedImage] = useState<ViewerSelection | null>(null)
  const [composerBottomPadding, setComposerBottomPadding] = useState(220)
  const [isDrawingDialogOpen, setIsDrawingDialogOpen] = useState(false)
  const [isLibraryDialogOpen, setIsLibraryDialogOpen] = useState(false)
  const [isPipelineDialogOpen, setIsPipelineDialogOpen] = useState(false)
  const [compactPromptHeight, setCompactPromptHeight] = useState(COMPACT_COMPOSER_DEFAULT_PROMPT_HEIGHT)
  const [selectedLibraryAssetIds, setSelectedLibraryAssetIds] = useState<string[]>([])
  const [newPipelineName, setNewPipelineName] = useState('')
  const [pendingPipelineToApply, setPendingPipelineToApply] = useState<string | null>(null)
  const [pipelinePendingDelete, setPipelinePendingDelete] = useState<ImagePipeline | null>(null)
  const [libraryAssetPendingDelete, setLibraryAssetPendingDelete] = useState<ImageAsset | null>(null)

  const isCompactComposer = searchParams.get('composer') === 'compact'
  const isSmallViewport = useMediaQuery('(max-width: 639px)')
  const isMediumViewport = useMediaQuery('(max-width: 1023px)')
  const isGridView = viewMode === 'grid'

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const runningTurn = useMemo(
    () => turns.find((turn) => turn.status === 'running') ?? null,
    [turns]
  )
  const queuedTurns = useMemo(() => turns.filter((turn) => turn.status === 'queued'), [turns])
  const pausedTurns = useMemo(() => turns.filter((turn) => turn.status === 'paused'), [turns])
  const draftReferenceAssets = useMemo(
    () => draft.referenceAssetIds.map((assetId) => assetsById[assetId]).filter(Boolean),
    [assetsById, draft.referenceAssetIds]
  )
  const reusableAssets = useMemo(
    () => Object.values(assetsById)
      .filter((asset) => asset.isReusable)
      .sort((a, b) => b.createdAt - a.createdAt),
    [assetsById]
  )
  const activePipeline = useMemo(
    () => (draft.pipelineId ? pipelines.find((pipeline) => pipeline.id === draft.pipelineId) ?? null : null),
    [draft.pipelineId, pipelines]
  )
  const activePipelinePinnedAssetIds = useMemo(
    () => new Set(activePipeline?.pinnedAssetIds ?? []),
    [activePipeline]
  )
  const pendingPipeline = useMemo(
    () => (pendingPipelineToApply ? pipelines.find((pipeline) => pipeline.id === pendingPipelineToApply) ?? null : null),
    [pendingPipelineToApply, pipelines]
  )
  const sortedPipelines = useMemo(
    () => [...pipelines].sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt),
    [pipelines]
  )
  const gridResultItems = useMemo<GridResultItem[]>(
    () => [...turns]
      .sort((a, b) => b.createdAt - a.createdAt)
      .flatMap((turn) => {
        const { resultAssets } = resolveTurnAssets(turn, assetsById)
        return resultAssets.map((asset, index) => ({
          turnId: turn.id,
          assetId: asset.id,
          asset,
          position: index + 1,
          createdAt: turn.createdAt,
          aspectRatio: turn.aspectRatio,
        }))
      }),
    [assetsById, turns]
  )
  const gridTurnsNeedingAttention = useMemo(
    () => turns.filter((turn) => turn.status === 'queued' || turn.status === 'running' || turn.status === 'paused' || turn.status === 'failed'),
    [turns]
  )
  const effectiveGridColumns = useMemo(() => {
    const columnLimit = isSmallViewport ? 2 : isMediumViewport ? 5 : MAX_IMAGE_GRID_COLUMNS
    return Math.min(gridColumns, columnLimit)
  }, [gridColumns, isMediumViewport, isSmallViewport])
  const detailResultColumns = useMemo(
    () => (isSmallViewport ? 1 : isMediumViewport ? 2 : 3),
    [isMediumViewport, isSmallViewport]
  )
  const detailReferenceColumns = useMemo(
    () => (isSmallViewport ? 1 : 2),
    [isSmallViewport]
  )
  const selectedTurn = useMemo(
    () => (selectedImage ? turns.find((turn) => turn.id === selectedImage.turnId) ?? null : null),
    [selectedImage, turns]
  )
  const selectedViewerItems = useMemo(
    () => {
      if (!selectedTurn || !selectedImage) return []

      const viewerItemsById = new Map(
        buildTurnViewerItems(selectedTurn, assetsById).map((item) => [item.assetId, item] as const)
      )

      return selectedImage.assetIds
        .map((assetId) => viewerItemsById.get(assetId))
        .filter((item): item is TurnViewerItem => Boolean(item))
    },
    [assetsById, selectedImage, selectedTurn]
  )
  const selectedViewerIndex = useMemo(
    () => (selectedImage ? selectedViewerItems.findIndex((item) => item.assetId === selectedImage.assetId) : -1),
    [selectedImage, selectedViewerItems]
  )
  const selectedViewerItem = useMemo(
    () => (selectedViewerIndex >= 0 ? selectedViewerItems[selectedViewerIndex] ?? null : null),
    [selectedViewerIndex, selectedViewerItems]
  )
  const selectedViewerCanDownloadPng = useMemo(
    () => Boolean(selectedViewerItem && normalizeMimeType(selectedViewerItem.asset.mimeType) !== 'image/png'),
    [selectedViewerItem]
  )
  const referenceUsageLabel = `${draft.referenceAssetIds.length}/${MAX_IMAGE_REFERENCE_COUNT} refs`
  const isComposerDirty = useMemo(() => isDraftDirty(draft), [draft])
  const canClearComposer = useMemo(() => hasClearableDraftState(draft), [draft])
  const composerContext = useMemo(
    () => getComposerContextMeta(draft, activePipeline),
    [activePipeline, draft]
  )

  const tailSignature = useMemo(() => {
    const lastTurn = turns[turns.length - 1]
    if (!lastTurn) return ''
    return `${lastTurn.id}:${lastTurn.status}:${lastTurn.resultAssetIds.join(',')}`
  }, [turns])

  useEffect(() => {
    if (viewMode !== 'detail') return
    if (!tailSignature || tailSignature === previousTailSignatureRef.current) return
    previousTailSignatureRef.current = tailSignature

    const container = threadScrollRef.current
    if (!container) return

    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      })
    })
  }, [tailSignature, viewMode])

  useEffect(() => {
    if (selectedImage && (!selectedTurn || !selectedViewerItem)) {
      setSelectedImage(null)
    }
  }, [selectedImage, selectedTurn, selectedViewerItem])

  const attachFiles = useCallback(async (files: File[]) => {
    let addedCount = 0

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(`Skipped ${file.name}: not an image`)
        continue
      }

      try {
        await addDraftReference({
          blob: file,
          mimeType: file.type,
          name: file.name,
        })
        addedCount += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add the image.'
        toast.error(message)
        break
      }
    }

    if (addedCount > 0) {
      toast.success(`${addedCount} image${addedCount === 1 ? '' : 's'} added to this draft`)
    }
  }, [addDraftReference])

  const uploadReusableFiles = useCallback(async (files: File[]) => {
    let addedCount = 0

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(`Skipped ${file.name}: not an image`)
        continue
      }

      try {
        await addReusableAsset({
          blob: file,
          mimeType: file.type,
          name: file.name,
        })
        addedCount += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add the reusable asset.'
        toast.error(message)
      }
    }

    if (addedCount > 0) {
      toast.success(`${addedCount} reusable asset${addedCount === 1 ? '' : 's'} saved`)
    }
  }, [addReusableAsset])

  const handleFileSelect = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      await attachFiles(Array.from(event.target.files))
    }
    event.target.value = ''
  }, [attachFiles])

  const handleLibraryUploadSelect = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      await uploadReusableFiles(Array.from(event.target.files))
    }
    event.target.value = ''
  }, [uploadReusableFiles])

  const handleComposerDrop = useCallback(async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    await attachFiles(Array.from(event.dataTransfer.files))
  }, [attachFiles])

  const handleComposerPaste = useCallback(async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    for (const item of event.clipboardData.items) {
      if (!item.type.startsWith('image/')) continue

      event.preventDefault()
      const file = item.getAsFile()
      if (file) {
        await attachFiles([file])
      }
      return
    }
  }, [attachFiles])

  const handleComposerDrawingDataChange = useCallback((nextDrawingData: DrawingData | null) => {
    void setComposerDrawingData(nextDrawingData)
  }, [setComposerDrawingData])

  const handleAddDrawingReference = useCallback(async () => {
    const snapshot = await drawingCanvasRef.current?.captureImage()

    if (!snapshot) {
      toast.error('Draw something first')
      return
    }

    try {
      const blob = await dataUrlToBlob(snapshot)
      const nextReferenceIndex = draft.referenceAssetIds.length + 1

      await addDraftReference({
        blob,
        mimeType: blob.type || 'image/png',
        name: buildDrawingReferenceName(nextReferenceIndex),
      })

      toast.success('Drawing added to this draft')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add the drawing as a reference.'
      toast.error(message)
    }
  }, [addDraftReference, draft.referenceAssetIds.length])

  const handleClearDrawing = useCallback(async () => {
    await clearComposerDrawingData()
  }, [clearComposerDrawingData])

  const focusComposer = useCallback(() => {
    requestAnimationFrame(() => {
      composerTextareaRef.current?.focus()
    })
  }, [])

  const handleClearDraft = useCallback(async () => {
    await resetDraft()
    focusComposer()
  }, [focusComposer, resetDraft])

  const handlePromptResizeMove = useCallback((event: PointerEvent) => {
    const resizeState = promptResizeStateRef.current
    if (!resizeState) return

    const nextHeight = Math.max(
      COMPACT_COMPOSER_MIN_PROMPT_HEIGHT,
      Math.min(
        COMPACT_COMPOSER_MAX_PROMPT_HEIGHT,
        resizeState.startHeight + (resizeState.startY - event.clientY)
      )
    )

    setCompactPromptHeight((current) => (current === nextHeight ? current : nextHeight))
  }, [])

  const stopPromptResize = useCallback(() => {
    promptResizeStateRef.current = null
    window.removeEventListener('pointermove', handlePromptResizeMove)
    window.removeEventListener('pointerup', stopPromptResize)
    window.removeEventListener('pointercancel', stopPromptResize)
  }, [handlePromptResizeMove])

  const handlePromptResizePointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isCompactComposer) return

    event.preventDefault()

    promptResizeStateRef.current = {
      startY: event.clientY,
      startHeight: compactPromptHeight,
    }

    window.addEventListener('pointermove', handlePromptResizeMove)
    window.addEventListener('pointerup', stopPromptResize)
    window.addEventListener('pointercancel', stopPromptResize)
  }, [compactPromptHeight, handlePromptResizeMove, isCompactComposer, stopPromptResize])

  const handleDrawingDialogOpenChange = useCallback((open: boolean) => {
    setIsDrawingDialogOpen(open)

    if (!open) {
      focusComposer()
    }
  }, [focusComposer])

  const toggleLibraryAssetSelection = useCallback((assetId: string) => {
    setSelectedLibraryAssetIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId]
    )
  }, [])

  const openTurnViewer = useCallback((turnId: string, assetId: string) => {
    const turn = turns.find((entry) => entry.id === turnId)
    if (!turn) return

    setSelectedImage({
      turnId,
      assetId,
      assetIds: buildViewerAssetOrder(turn, assetsById),
    })
  }, [assetsById, turns])

  const openResultViewer = useCallback((turnId: string, assetId: string) => {
    const turn = turns.find((entry) => entry.id === turnId)
    if (!turn) return

    setSelectedImage({
      turnId,
      assetId,
      assetIds: buildResultViewerAssetOrder(turn, assetsById),
    })
  }, [assetsById, turns])

  const handleSelectPreviousViewerItem = useCallback(() => {
    if (selectedViewerIndex <= 0) return

    const previousItem = selectedViewerItems[selectedViewerIndex - 1]
    if (!previousItem) return

    setSelectedImage((current) => current ? { ...current, assetId: previousItem.assetId } : current)
  }, [selectedViewerIndex, selectedViewerItems])

  const handleSelectNextViewerItem = useCallback(() => {
    if (selectedViewerIndex < 0 || selectedViewerIndex >= selectedViewerItems.length - 1) return

    const nextItem = selectedViewerItems[selectedViewerIndex + 1]
    if (!nextItem) return

    setSelectedImage((current) => current ? { ...current, assetId: nextItem.assetId } : current)
  }, [selectedViewerIndex, selectedViewerItems])

  useEffect(() => {
    if (!selectedViewerItem) return

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        handleSelectPreviousViewerItem()
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        handleSelectNextViewerItem()
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  }, [handleSelectNextViewerItem, handleSelectPreviousViewerItem, selectedViewerItem])

  useEffect(() => {
    return () => {
      stopPromptResize()
    }
  }, [stopPromptResize])

  useEffect(() => {
    const overlay = composerOverlayRef.current
    if (!overlay) return

    const updatePadding = () => {
      const nextPadding = Math.ceil(overlay.getBoundingClientRect().height * 1.2)
      setComposerBottomPadding((current) => (current === nextPadding ? current : nextPadding))
    }

    updatePadding()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updatePadding)
      return () => {
        window.removeEventListener('resize', updatePadding)
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      updatePadding()
    })

    resizeObserver.observe(overlay)
    window.addEventListener('resize', updatePadding)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updatePadding)
    }
  }, [])

  useEffect(() => {
    if (!isLibraryDialogOpen) {
      setSelectedLibraryAssetIds([])
    }
  }, [isLibraryDialogOpen])

  const handleCopyPrompt = useCallback(async (turn: ImageTurn) => {
    await navigator.clipboard.writeText(turn.prompt)
    toast.success('Prompt copied')
  }, [])

  const handleDownloadVariant = useCallback(async (
    turn: ImageTurn,
    item: TurnViewerItem,
    variant: ImageDownloadVariant,
  ) => {
    try {
      const filename = buildAssetDownloadName(turn, item, variant)

      if (variant === 'original') {
        downloadAsset(item.asset, filename)
        return
      }

      const blob = await exportImageVariant(item.asset, variant)
      downloadBlob(blob, filename)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to prepare the image download.'
      toast.error(message)
    }
  }, [])

  const handleAnotherVersion = useCallback(async (turnId: string) => {
    await prefillFromTurn(turnId)
    setSelectedImage(null)
    focusComposer()
    toast.success('Composer prefilled for another version')
  }, [focusComposer, prefillFromTurn])

  const handleEditFromImage = useCallback(async (turnId: string, assetId: string) => {
    await prefillForEdit(turnId, assetId)
    setSelectedImage(null)
    focusComposer()
    toast.success('Composer prefilled for edit')
  }, [focusComposer, prefillForEdit])

  const handleAddSelectedLibraryAssets = useCallback(async () => {
    if (selectedLibraryAssetIds.length === 0) return

    try {
      await addDraftReferenceIds(selectedLibraryAssetIds)
      toast.success(`${selectedLibraryAssetIds.length} reusable asset${selectedLibraryAssetIds.length === 1 ? '' : 's'} added to the draft`)
      setSelectedLibraryAssetIds([])
      setIsLibraryDialogOpen(false)
      focusComposer()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add reusable assets.'
      toast.error(message)
    }
  }, [addDraftReferenceIds, focusComposer, selectedLibraryAssetIds])

  const handleAddSingleReusableAsset = useCallback(async (assetId: string) => {
    try {
      await addDraftReferenceIds([assetId])
      toast.success('Reusable asset added to the draft')
      focusComposer()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add the reusable asset.'
      toast.error(message)
    }
  }, [addDraftReferenceIds, focusComposer])

  const handleRenameReusableAsset = useCallback(async (assetId: string, nextName: string) => {
    await renameAsset(assetId, nextName)
  }, [renameAsset])

  const handleSavePipeline = useCallback(async () => {
    if (!newPipelineName.trim()) {
      toast.error('Name the pipeline first')
      return
    }

    if (!draft.prompt.trim()) {
      toast.error('Enter a prompt before saving a pipeline')
      return
    }

    const pipelineId = await savePipeline(newPipelineName)
    if (!pipelineId) return

    setNewPipelineName('')
    setIsPipelineDialogOpen(false)
    focusComposer()
    toast.success('Pipeline saved')
  }, [draft.prompt, focusComposer, newPipelineName, savePipeline])

  const handleUpdateActivePipeline = useCallback(async () => {
    if (!activePipeline) return

    if (!draft.prompt.trim()) {
      toast.error('Enter a prompt before updating this pipeline')
      return
    }

    await updatePipeline(activePipeline.id)
    toast.success('Pipeline updated')
  }, [activePipeline, draft.prompt, updatePipeline])

  const commitApplyPipeline = useCallback(async (pipelineId: string) => {
    await applyPipeline(pipelineId)
    setPendingPipelineToApply(null)
    setIsPipelineDialogOpen(false)
    focusComposer()
    toast.success('Pipeline applied')
  }, [applyPipeline, focusComposer])

  const handleApplyPipelineRequest = useCallback(async (pipelineId: string) => {
    if (isComposerDirty) {
      setPendingPipelineToApply(pipelineId)
      return
    }

    await commitApplyPipeline(pipelineId)
  }, [commitApplyPipeline, isComposerDirty])

  const handleConfirmReusableAssetDelete = useCallback(async () => {
    if (!libraryAssetPendingDelete) return

    await deleteReusableAsset(libraryAssetPendingDelete.id)
    setSelectedLibraryAssetIds((current) => current.filter((assetId) => assetId !== libraryAssetPendingDelete.id))
    setLibraryAssetPendingDelete(null)
    toast.success('Reusable asset deleted')
  }, [deleteReusableAsset, libraryAssetPendingDelete])

  const handleConfirmPipelineDelete = useCallback(async () => {
    if (!pipelinePendingDelete) return

    await deletePipeline(pipelinePendingDelete.id)
    setPipelinePendingDelete(null)
    toast.success('Pipeline deleted')
  }, [deletePipeline, pipelinePendingDelete])

  const handleEnqueue = useCallback(async () => {
    if (!draft.prompt.trim()) {
      toast.error('Enter a prompt first')
      return
    }

    if (draft.referenceAssetIds.length > MAX_IMAGE_REFERENCE_COUNT) {
      toast.error(`You can use up to ${MAX_IMAGE_REFERENCE_COUNT} reference images per generation.`)
      return
    }

    const turnId = await enqueueDraft()
    if (!turnId) return
  }, [draft.prompt, draft.referenceAssetIds.length, enqueueDraft])

  const handleCancelCurrent = useCallback(() => {
    currentAbortControllerRef.current?.abort()
  }, [])

  const handleCancelOrRemoveTurn = useCallback(async (turn: ImageTurn) => {
    if (turn.status === 'running') {
      handleCancelCurrent()
      return
    }

    await removeTurn(turn.id)
  }, [handleCancelCurrent, removeTurn])

  const toggleTurnExpanded = useCallback((turnId: string) => {
    setExpandedTurnIds((current) => ({
      ...current,
      [turnId]: !current[turnId],
    }))
  }, [])

  const runTurn = useCallback(async (turn: ImageTurn) => {
    workerBusyRef.current = true
    runningTurnIdRef.current = turn.id
    const controller = new AbortController()
    currentAbortControllerRef.current = controller

    try {
      await markTurnRunning(turn.id)

      const currentAssets = useImageGenerationStore.getState().assetsById
      const referenceImages = []

      for (const assetId of turn.referenceAssetIds) {
        const asset = currentAssets[assetId]
        if (!asset) {
          throw new Error('One or more reference images for this turn are missing from local storage.')
        }

        referenceImages.push({
          mimeType: asset.mimeType,
          dataUrl: await blobToDataUrl(asset.blob),
        })
      }

      const result = await requestGeneratedImages({
        model: turn.model,
        prompt: turn.prompt,
        referenceImages,
        count: turn.count,
        aspectRatio: turn.aspectRatio,
        imageSize: turn.imageSize,
        signal: controller.signal,
      })

      if (result.images.length === 0) {
        throw new Error('Gemini returned no images for this generation.')
      }

      const images = await Promise.all(
        result.images.map(async (image) => ({
          mimeType: image.mimeType,
          blob: await dataUrlToBlob(image.dataUrl),
        }))
      )

      await completeTurn(turn.id, {
        images,
        responseText: result.text,
        warnings: result.warnings,
      })

      showBackgroundTaskCompletionToast({
        routePrefix: '/images',
        title: 'Image batch ready',
        description: `${images.length} result${images.length === 1 ? '' : 's'} • ${getPromptPreview(turn.prompt)}`,
      })
    } catch (error) {
      if (isAbortError(error)) {
        await cancelTurn(turn.id, 'Generation canceled')
      } else {
        const friendlyError = classifyImageGenerationError(error)
        await failTurn(turn.id, friendlyError)
        toast.error(friendlyError)
      }
    } finally {
      workerBusyRef.current = false
      runningTurnIdRef.current = null
      currentAbortControllerRef.current = null
    }
  }, [cancelTurn, completeTurn, failTurn, markTurnRunning])

  useEffect(() => {
    if (!isHydrated || queuePaused || workerBusyRef.current || runningTurn) {
      return
    }

    const nextTurn = queuedTurns[0]
    if (!nextTurn) return

    void runTurn(nextTurn)
  }, [isHydrated, queuePaused, queuedTurns, runTurn, runningTurn])

  return (
    <ToolShell>
      <ToolHeader
        title="Image Gen"
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isGridView ? (
              <div className="flex items-center gap-2 rounded-[0.9rem] border border-border/70 bg-muted/20 px-3 py-2">
                <label htmlFor="image-grid-columns" className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Grid size
                </label>
                <input
                  id="image-grid-columns"
                  type="range"
                  min={String(MIN_IMAGE_GRID_COLUMNS)}
                  max={String(MAX_IMAGE_GRID_COLUMNS)}
                  step="1"
                  value={gridColumns}
                  onChange={(event) => {
                    void setGridColumns(Number(event.target.value))
                  }}
                  className="w-24 accent-foreground sm:w-32"
                  aria-label="Adjust grid density"
                />
                <span className="w-2 text-right text-xs font-medium text-foreground">{gridColumns}</span>
              </div>
            ) : null}

            <div className="flex items-center gap-1 rounded-[0.9rem] bg-muted/75 p-1 shadow-[inset_0_0_0_1px_hsl(var(--border)/0.5)]">
              {IMAGE_VIEW_MODE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    void setViewMode(option.id)
                  }}
                  className={cn(
                    'rounded-[0.7rem] px-3 py-1.5 text-[13px] font-medium transition-[color,background-color,box-shadow]',
                    viewMode === option.id
                      ? 'bg-background text-foreground shadow-[0_1px_2px_hsl(var(--foreground)/0.05)]'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {(queuePaused || pausedTurns.length > 0) ? (
              <Button type="button" size="sm" onClick={() => void resumeQueue()}>
                <Play className="h-4 w-4" />
                Resume queue
              </Button>
            ) : queuedTurns.length > 0 ? (
              <Button type="button" size="sm" variant="outline" onClick={() => void pauseQueue()}>
                <Pause className="h-4 w-4" />
                Pause queue
              </Button>
            ) : null}
          </div>
        )}
      />

      <ToolBody className="overflow-hidden p-0">
        <div className="flex h-full min-h-0 flex-col">
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div
              ref={threadScrollRef}
              className="flex-1 overflow-y-auto px-4 pt-5 sm:px-6"
              style={{ paddingBottom: composerBottomPadding }}
            >
              {isGridView ? (
                <div className="w-full pb-4">
                  {hydrationError ? (
                    <Card className="border-destructive/40 bg-destructive/5">
                      <CardContent className="p-4 text-sm text-foreground">
                        {hydrationError}
                      </CardContent>
                    </Card>
                  ) : null}

                  {!isHydrated || isHydrating ? (
                    <div className="flex min-h-[20rem] items-center justify-center rounded-3xl border border-dashed border-border/80 bg-muted/20">
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading image generations...
                      </div>
                    </div>
                  ) : turns.length === 0 ? (
                    <div className="flex min-h-[20rem] flex-col items-center justify-center rounded-[2rem] border border-dashed border-border/80 bg-muted/20 px-6 text-center">
                      <div className="rounded-2xl bg-secondary p-3 text-secondary-foreground">
                        <WandSparkles className="h-5 w-5" />
                      </div>
                      <h2 className="mt-4 text-lg font-semibold text-foreground">
                        Start an image conversation
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        Generated results, reusable assets, prompts, pipelines, and queue state stay saved locally on this device. Use the composer below to create a first image, pull in library assets, or save a repeatable pipeline.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {gridTurnsNeedingAttention.length > 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-border/70 bg-muted/18 px-4 py-3">
                          <p className="text-sm text-muted-foreground">
                            {gridTurnsNeedingAttention.length} batch{gridTurnsNeedingAttention.length === 1 ? '' : 'es'} still in progress or need attention. Switch to detail for live queue status and retries.
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              void setViewMode('detail')
                            }}
                          >
                            Open detail
                          </Button>
                        </div>
                      ) : null}

                      {gridResultItems.length === 0 ? (
                        <div className="flex min-h-[20rem] flex-col items-center justify-center rounded-[2rem] border border-dashed border-border/80 bg-muted/20 px-6 text-center">
                          <div className="rounded-2xl bg-secondary p-3 text-secondary-foreground">
                            <WandSparkles className="h-5 w-5" />
                          </div>
                          <h2 className="mt-4 text-lg font-semibold text-foreground">
                            No completed images yet
                          </h2>
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                            Completed generations will appear here as a full-width gallery. Use detail view for turn-by-turn queue status while your batches are running.
                          </p>
                        </div>
                      ) : (
                        <SequentialMasonry columns={effectiveGridColumns}>
                          {gridResultItems.map((item) => (
                            <button
                              key={item.assetId}
                              type="button"
                              onClick={() => openResultViewer(item.turnId, item.assetId)}
                              className="group block w-full overflow-hidden rounded-[1.35rem] border border-border/70 bg-card/90 text-left shadow-sm transition-transform hover:-translate-y-0.5"
                            >
                              <ProgressiveResultImage
                                src={item.asset.url}
                                alt={`Generated result ${item.position} from ${dateFormatter.format(item.createdAt)}`}
                                aspectRatio={item.aspectRatio}
                              />
                              <span className="sr-only">
                                Open generated result {item.position} from {dateFormatter.format(item.createdAt)}
                              </span>
                            </button>
                          ))}
                        </SequentialMasonry>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <ToolContainer className="space-y-0">
                <div className="flex w-full flex-col gap-4 pb-4">
                  {hydrationError ? (
                    <Card className="border-destructive/40 bg-destructive/5">
                      <CardContent className="p-4 text-sm text-foreground">
                        {hydrationError}
                      </CardContent>
                    </Card>
                  ) : null}

                  {!isHydrated || isHydrating ? (
                    <div className="flex min-h-[20rem] items-center justify-center rounded-3xl border border-dashed border-border/80 bg-muted/20">
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading image generations...
                      </div>
                    </div>
                  ) : turns.length === 0 ? (
                    <div className="flex min-h-[20rem] flex-col items-center justify-center rounded-[2rem] border border-dashed border-border/80 bg-muted/20 px-6 text-center">
                      <div className="rounded-2xl bg-secondary p-3 text-secondary-foreground">
                        <WandSparkles className="h-5 w-5" />
                      </div>
                      <h2 className="mt-4 text-lg font-semibold text-foreground">
                        Start an image conversation
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        Generated results, reusable assets, prompts, pipelines, and queue state stay saved locally on this device. Use the composer below to create a first image, pull in library assets, or save a repeatable pipeline.
                      </p>
                    </div>
                  ) : (
                    turns.map((turn) => {
                      const isExpanded = Boolean(expandedTurnIds[turn.id])
                      const { resultAssets, referenceAssets } = resolveTurnAssets(turn, assetsById)
                      const placeholderAspectRatio = toCssAspectRatio(turn.aspectRatio)

                      return (
                        <Card
                          key={turn.id}
                          className="overflow-hidden rounded-[1.75rem] border-border/70 bg-card/95 shadow-sm"
                        >
                          <CardContent className="p-5">
                            <div className="flex flex-col gap-5">
                              <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <TurnStatusBadge status={turn.status} />
                                    <Badge variant="outline">{getOriginLabel(turn)}</Badge>
                                    <Badge variant="outline">{modelLabel(turn.model)}</Badge>
                                    <Badge variant="outline">{turn.aspectRatio}</Badge>
                                    <Badge variant="outline">{turn.imageSize}</Badge>
                                    <Badge variant="outline">{referenceAssets.length > 0 ? 'Image + text' : 'Text to image'}</Badge>
                                  </div>
                                  <p className="text-sm leading-6 text-foreground">
                                    {getPromptPreview(turn.prompt)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {dateFormatter.format(turn.createdAt)}
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  {turn.status === 'complete' ? (
                                    <>
                                      <Button type="button" size="sm" variant="outline" onClick={() => void handleCopyPrompt(turn)}>
                                        <Copy className="h-4 w-4" />
                                        Copy prompt
                                      </Button>
                                      <Button type="button" size="sm" variant="outline" onClick={() => void handleAnotherVersion(turn.id)}>
                                        <RefreshCcw className="h-4 w-4" />
                                        Another version
                                      </Button>
                                    </>
                                  ) : null}

                                  {(turn.status === 'failed' || turn.status === 'canceled') ? (
                                    <Button type="button" size="sm" variant="outline" onClick={() => void retryTurn(turn.id)}>
                                      <RefreshCcw className="h-4 w-4" />
                                      Retry
                                    </Button>
                                  ) : null}

                                  {turn.status === 'running' ? (
                                    <Button type="button" size="sm" variant="outline" onClick={handleCancelCurrent}>
                                      <Square className="h-3.5 w-3.5 fill-current" />
                                      Cancel
                                    </Button>
                                  ) : null}

                                  {turn.status !== 'complete' ? (
                                    <Button type="button" size="sm" variant="ghost" onClick={() => void handleCancelOrRemoveTurn(turn)}>
                                      <Trash2 className="h-4 w-4" />
                                      Remove
                                    </Button>
                                  ) : null}

                                  <Button type="button" size="sm" variant="ghost" onClick={() => toggleTurnExpanded(turn.id)}>
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    Details
                                  </Button>
                                </div>
                              </div>

                              {turn.status === 'complete' && resultAssets.length > 0 ? (
                                <SequentialMasonry
                                  columns={getSequentialMasonryColumns(detailResultColumns, resultAssets.length)}
                                >
                                  {resultAssets.map((asset, index) => (
                                    <button
                                      key={asset.id}
                                      type="button"
                                      onClick={() => openResultViewer(turn.id, asset.id)}
                                      className="group block w-full overflow-hidden rounded-[1.25rem] border border-border/70 bg-muted/30 text-left transition-transform hover:-translate-y-0.5"
                                    >
                                      <div className="overflow-hidden border-b border-border/60 bg-background/75 p-2">
                                        <ProgressiveResultImage
                                          src={asset.url}
                                          alt={`Generated result ${index + 1}`}
                                          aspectRatio={turn.aspectRatio}
                                          className="rounded-[0.9rem]"
                                          imageClassName="rounded-[0.9rem]"
                                        />
                                      </div>
                                      <div className="flex items-center justify-between gap-3 px-3 py-3">
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium text-foreground">Result {index + 1}</p>
                                          <p className="truncate text-xs text-muted-foreground">
                                            Click for prompt, refs, version actions, and download
                                          </p>
                                        </div>
                                        <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                                      </div>
                                    </button>
                                  ))}
                                </SequentialMasonry>
                              ) : (
                                <SequentialMasonry
                                  columns={getSequentialMasonryColumns(detailResultColumns, turn.count)}
                                >
                                  {Array.from({ length: turn.count }).map((_, index) => (
                                    <div
                                      key={`${turn.id}-placeholder-${index}`}
                                      className={cn(
                                        'overflow-hidden rounded-[1.25rem] border border-dashed border-border/80 bg-muted/20',
                                        turn.status === 'running' && 'animate-pulse'
                                      )}
                                    >
                                      <div
                                        className="flex flex-col items-center justify-center px-4 text-center"
                                        style={{ aspectRatio: placeholderAspectRatio }}
                                      >
                                        {turn.status === 'running' ? (
                                          <Loader2 className="mb-3 h-5 w-5 animate-spin text-muted-foreground" />
                                        ) : (
                                          <Clock3 className="mb-3 h-5 w-5 text-muted-foreground" />
                                        )}
                                        <p className="text-sm font-medium text-foreground">
                                          {getStatusLabel(turn.status)}
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                          {turn.status === 'queued' && 'Waiting for its turn in the FIFO queue.'}
                                          {turn.status === 'paused' && 'Resume the queue to continue.'}
                                          {turn.status === 'failed' && 'Open details or retry this generation.'}
                                          {turn.status === 'canceled' && 'This generation was canceled before finishing.'}
                                          {turn.status === 'running' && 'Gemini is generating this batch now.'}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </SequentialMasonry>
                              )}

                              {isExpanded ? (
                                <div className="rounded-[1.5rem] border border-border/70 bg-muted/15 p-4">
                                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                                    <div className="space-y-3">
                                      <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                          Prompt
                                        </p>
                                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                                          {turn.prompt}
                                        </p>
                                      </div>

                                      {turn.responseText ? (
                                        <div>
                                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                            Model note
                                          </p>
                                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                                            {turn.responseText}
                                          </p>
                                        </div>
                                      ) : null}

                                      {turn.error ? (
                                        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
                                          {turn.error}
                                        </div>
                                      ) : null}

                                      {turn.warnings?.length ? (
                                        <div className="rounded-2xl border border-border/70 bg-background/70 p-3 text-sm text-muted-foreground">
                                          {turn.warnings[0]}
                                        </div>
                                      ) : null}
                                    </div>

                                    <div className="space-y-3">
                                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                        References used
                                      </p>
                                      {referenceAssets.length > 0 ? (
                                        <SequentialMasonry
                                          columns={getSequentialMasonryColumns(detailReferenceColumns, referenceAssets.length)}
                                        >
                                          {referenceAssets.map((asset, index) => (
                                            <button
                                              key={asset.id}
                                              type="button"
                                              onClick={() => openTurnViewer(turn.id, asset.id)}
                                              className="block w-full overflow-hidden rounded-2xl border border-border/70 bg-card text-left transition-[border-color,background-color] hover:border-foreground/15 hover:bg-muted/18"
                                            >
                                              <div className="overflow-hidden border-b border-border/60 bg-background/75 p-2">
                                                <img
                                                  src={asset.url}
                                                  alt={asset.name || `Source image ${index + 1}`}
                                                  className="block h-auto w-full rounded-xl"
                                                />
                                              </div>
                                              <div className="space-y-1 px-3 py-2.5">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                                  Source image {index + 1}
                                                </p>
                                                <p className="truncate text-xs font-medium text-foreground">
                                                  {asset.name || 'Reference image'}
                                                </p>
                                              </div>
                                            </button>
                                          ))}
                                        </SequentialMasonry>
                                      ) : (
                                        <div className="rounded-2xl bg-background/70 px-4 py-5 text-sm text-muted-foreground">
                                          No reference images were used for this turn.
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })
                  )}
                </div>
              </ToolContainer>
              )}
            </div>

            <div
              ref={composerOverlayRef}
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-6"
            >
              <div
                className={cn(
                  'pointer-events-auto mx-auto w-fit max-w-full'
                )}
              >
                <div className="pt-1">
                  <div
                    className={cn(
                      'overflow-hidden rounded-[1.45rem] border border-border/70 bg-background/96 shadow-[0_10px_30px_hsl(var(--background)/0.45)] backdrop-blur-sm transition-[border-color,box-shadow] duration-200 focus-within:border-ring/40',
                      !isCompactComposer && 'w-full'
                    )}
                    onDrop={handleComposerDrop}
                    onDragOver={(event) => event.preventDefault()}
                  >
                    {isCompactComposer ? (
                      <TooltipProvider delayDuration={120}>
                        <div className="border-b border-border/60 bg-muted/12 px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              {composerContext ? (
                                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs sm:text-sm">
                                  <span className="font-medium text-foreground">{composerContext.title}</span>
                                  {composerContext.detail ? (
                                    <span className="max-w-[13rem] truncate text-muted-foreground">
                                      {composerContext.detail}
                                    </span>
                                  ) : null}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        className="rounded-full text-muted-foreground transition-colors hover:text-foreground"
                                        aria-label="About this draft mode"
                                      >
                                        <Info className="h-3.5 w-3.5" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-[18rem] leading-5">
                                      {composerContext.description}
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              ) : (
                                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                  Reference inputs
                                </p>
                              )}

                              <Badge variant="outline" className="rounded-full px-3 py-1.5">
                                {referenceUsageLabel}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-9 rounded-full bg-background/80 px-3.5"
                                  >
                                    <Upload className="h-4 w-4" />
                                    Add reference
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                  <DropdownMenuLabel>Reference sources</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                                    Upload new
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setIsDrawingDialogOpen(true)}>
                                    Draw reference
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setIsLibraryDialogOpen(true)}>
                                    Add from library
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>

                              {activePipeline ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-9 rounded-full px-3.5"
                                    >
                                      Pipeline
                                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuLabel>{activePipeline.name}</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => {
                                      void handleUpdateActivePipeline()
                                    }}>
                                      Update from current draft
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setIsPipelineDialogOpen(true)}>
                                      Manage pipelines
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : null}

                              {canClearComposer ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-9 rounded-full px-3"
                                      onClick={() => {
                                        void handleClearDraft()
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                      Clear
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Reset the prompt, references, and draft mode.
                                  </TooltipContent>
                                </Tooltip>
                              ) : null}
                            </div>
                          </div>

                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(event) => {
                              void handleFileSelect(event)
                            }}
                          />
                        </div>

                        {draftReferenceAssets.length > 0 ? (
                          <div className="border-b border-border/60 px-4 py-3">
                            <div className="-mx-1 overflow-x-auto px-1 pb-1">
                              <div className="flex w-max items-center gap-3">
                                {draftReferenceAssets.map((asset, index) => (
                                  <div
                                    key={asset.id}
                                    className="group relative w-[8.75rem] shrink-0 overflow-hidden rounded-[1.1rem] border border-border/70 bg-muted/30 p-1.5"
                                  >
                                    <div className="absolute left-2 top-2 z-10 flex flex-wrap gap-1">
                                      {activePipelinePinnedAssetIds.has(asset.id) ? (
                                        <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">
                                          Pipeline
                                        </Badge>
                                      ) : null}
                                      {asset.isReusable && !activePipelinePinnedAssetIds.has(asset.id) ? (
                                        <Badge variant="outline" className="bg-background/90 px-2 py-0.5 text-[10px]">
                                          Library
                                        </Badge>
                                      ) : null}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => void removeDraftReference(asset.id)}
                                      className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                                      aria-label={`Remove reference ${index + 1}`}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>

                                    <div className="flex h-24 items-center justify-center rounded-[0.85rem] bg-background/70 p-1">
                                      <img
                                        src={asset.url}
                                        alt={asset.name || 'Draft reference'}
                                        className="max-h-full max-w-full rounded-[0.65rem] object-contain"
                                      />
                                    </div>

                                    <p className="truncate px-2 pb-1 pt-1.5 text-[11px] font-medium text-foreground/90">
                                      {asset.name || `Reference ${index + 1}`}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div className="px-4 pb-3 pt-3">
                          <div className="flex justify-center pb-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onPointerDown={handlePromptResizePointerDown}
                                  className="inline-flex h-6 w-16 cursor-ns-resize items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/55 hover:text-foreground"
                                  aria-label="Resize prompt area"
                                  style={{ touchAction: 'none' }}
                                >
                                  <GripHorizontal className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Drag up to make more room for long prompts.
                              </TooltipContent>
                            </Tooltip>
                          </div>

                          <label htmlFor="image-gen-composer" className="sr-only">Image prompt</label>
                          <Textarea
                            id="image-gen-composer"
                            ref={composerTextareaRef}
                            value={draft.prompt}
                            onChange={(event) => {
                              void setDraftPrompt(event.target.value)
                            }}
                            onPaste={(event) => {
                              void handleComposerPaste(event)
                            }}
                            placeholder="Describe the image you want. Add references from the toolbar above, or paste an image directly here."
                            style={{ height: `${compactPromptHeight}px` }}
                            className="h-auto min-h-0 resize-none overflow-y-auto border-0 bg-transparent px-0 py-0 text-[15px] leading-6 focus-visible:ring-0"
                          />
                        </div>

                        <div className="flex flex-wrap items-end gap-3 border-t border-border/60 px-4 pb-3 pt-2 md:flex-nowrap">
                          <div className="min-w-0 flex-1 overflow-x-auto pb-1 md:pb-0">
                            <div className="flex min-w-max items-center gap-2">
                              <Select value={draft.model} onValueChange={(value) => { void setDraftModel(value as ImageGenerationModel) }}>
                                <SelectTrigger className="h-9 min-w-[10.5rem] rounded-[0.85rem] bg-background/70">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {IMAGE_GENERATION_MODELS.map((entry) => (
                                    <SelectItem key={entry.id} value={entry.id}>
                                      {entry.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select value={String(draft.count)} onValueChange={(value) => { void setDraftCount(Number(value)) }}>
                                <SelectTrigger className="h-9 w-[7.25rem] shrink-0 rounded-[0.85rem] bg-background/70">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {IMAGE_COUNT_OPTIONS.map((value) => (
                                    <SelectItem key={value} value={String(value)}>
                                      {value} image{value > 1 ? 's' : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select value={draft.aspectRatio} onValueChange={(value) => { void setDraftAspectRatio(value as ImageAspectRatio) }}>
                                <SelectTrigger className="h-9 w-[4.9rem] shrink-0 rounded-[0.85rem] bg-background/70">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {IMAGE_ASPECT_RATIO_OPTIONS.map((value) => (
                                    <SelectItem key={value} value={value}>
                                      {value}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select value={draft.imageSize} onValueChange={(value) => { void setDraftImageSize(value as ImageSize) }}>
                                <SelectTrigger className="h-9 w-[4.35rem] shrink-0 rounded-[0.85rem] bg-background/70">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {IMAGE_SIZE_OPTIONS.map((value) => (
                                    <SelectItem key={value} value={value}>
                                      {value}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="ml-auto flex shrink-0 flex-col items-start gap-1 md:items-end">
                            <Button
                              type="button"
                              onClick={() => {
                                void handleEnqueue()
                              }}
                              disabled={!isHydrated || !draft.prompt.trim()}
                              className="h-10 min-w-[11.25rem] rounded-full px-5"
                            >
                              {runningTurn ? <Sparkles className="h-4 w-4" /> : <WandSparkles className="h-4 w-4" />}
                              {runningTurn || queuePaused ? 'Add to queue' : 'Generate'}
                            </Button>
                            {runningTurn ? (
                              <button
                                type="button"
                                onClick={handleCancelCurrent}
                                className="inline-flex h-7 items-center gap-1.5 rounded-[0.75rem] px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                              >
                                <Square className="h-3 w-3 fill-current" />
                                Cancel current
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </TooltipProvider>
                    ) : (
                      <>
                        {activePipeline ? (
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/16 px-4 py-2.5">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                Pipeline active: {activePipeline.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Saved prompt, settings, and {activePipeline.pinnedAssetIds.length} pinned reference{activePipeline.pinnedAssetIds.length === 1 ? '' : 's'}. New images only affect the next run unless you update the pipeline.
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  void handleUpdateActivePipeline()
                                }}
                              >
                                Update pipeline
                              </Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => setIsPipelineDialogOpen(true)}>
                                Manage
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  void handleClearDraft()
                                }}
                              >
                                <X className="h-4 w-4" />
                                Clear draft
                              </Button>
                            </div>
                          </div>
                        ) : (draft.origin !== 'new' || draft.sourceTurnId) ? (
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/16 px-4 py-2.5">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {draft.origin === 'edit' ? 'Editing from a previous result' : 'Creating another version'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                This submission will be appended as a new turn in the same thread.
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                void handleClearDraft()
                              }}
                            >
                              <X className="h-4 w-4" />
                              Clear draft
                            </Button>
                          </div>
                        ) : null}

                        {draftReferenceAssets.length > 0 ? (
                          <div className="flex flex-wrap gap-3 px-4 pt-4">
                            {draftReferenceAssets.map((asset, index) => (
                              <div key={asset.id} className="group relative overflow-hidden rounded-2xl border border-border/70 bg-muted/30 p-1.5">
                                <div className="absolute left-2 top-2 z-10 flex flex-wrap gap-1">
                                  {activePipelinePinnedAssetIds.has(asset.id) ? (
                                    <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">
                                      Pipeline
                                    </Badge>
                                  ) : null}
                                  {asset.isReusable && !activePipelinePinnedAssetIds.has(asset.id) ? (
                                    <Badge variant="outline" className="bg-background/90 px-2 py-0.5 text-[10px]">
                                      Library
                                    </Badge>
                                  ) : null}
                                </div>
                                <img
                                  src={asset.url}
                                  alt={asset.name || 'Draft reference'}
                                  className="block h-auto max-h-28 w-auto max-w-[8rem] rounded-[0.9rem]"
                                />
                                <button
                                  type="button"
                                  onClick={() => void removeDraftReference(asset.id)}
                                  className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                                  aria-label={`Remove reference ${index + 1}`}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <div className="px-4 py-3">
                          <label htmlFor="image-gen-composer" className="sr-only">Image prompt</label>
                          <Textarea
                            id="image-gen-composer"
                            ref={composerTextareaRef}
                            value={draft.prompt}
                            onChange={(event) => {
                              void setDraftPrompt(event.target.value)
                            }}
                            onPaste={(event) => {
                              void handleComposerPaste(event)
                            }}
                            placeholder="Describe the image you want. Add references below for edits, consistency, or style transfer."
                            className="min-h-24 resize-none border-0 bg-transparent px-0 py-0 text-[15px] leading-6 focus-visible:ring-0"
                          />
                        </div>

                        <div className="flex flex-nowrap items-end gap-8 px-4 pb-3 pt-1">
                          <div className="grid min-w-0 gap-2">
                            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 pr-1">
                              <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 rounded-[0.85rem] bg-background/70 hover:bg-accent/70" onClick={() => fileInputRef.current?.click()}>
                                <Upload className="h-4 w-4" />
                                Upload
                              </Button>
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(event) => {
                                  void handleFileSelect(event)
                                }}
                              />
                              <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 rounded-[0.85rem] bg-background/70 hover:bg-accent/70" onClick={() => setIsLibraryDialogOpen(true)}>
                                <Library className="h-4 w-4" />
                                Library
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 shrink-0 rounded-[0.85rem] bg-background/70 hover:bg-accent/70"
                                onClick={() => setIsDrawingDialogOpen(true)}
                              >
                                <Pencil className="h-4 w-4" />
                                Draw
                              </Button>

                              {!activePipeline && draft.origin === 'new' && !draft.sourceTurnId && canClearComposer ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-9 shrink-0 rounded-[0.85rem] bg-background/70 hover:bg-accent/70"
                                  onClick={() => {
                                    void handleClearDraft()
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                  Clear
                                </Button>
                              ) : null}
                            </div>

                            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 pr-1">
                              <Select value={draft.model} onValueChange={(value) => { void setDraftModel(value as ImageGenerationModel) }}>
                                <SelectTrigger className="h-9 w-[10rem] shrink-0 rounded-[0.85rem] bg-background/70">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {IMAGE_GENERATION_MODELS.map((entry) => (
                                    <SelectItem key={entry.id} value={entry.id}>
                                      {entry.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select value={String(draft.count)} onValueChange={(value) => { void setDraftCount(Number(value)) }}>
                                <SelectTrigger className="h-9 w-[6.85rem] shrink-0 rounded-[0.85rem] bg-background/70">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {IMAGE_COUNT_OPTIONS.map((value) => (
                                    <SelectItem key={value} value={String(value)}>
                                      {value} image{value > 1 ? 's' : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select value={draft.aspectRatio} onValueChange={(value) => { void setDraftAspectRatio(value as ImageAspectRatio) }}>
                                <SelectTrigger className="h-9 w-[4.7rem] shrink-0 rounded-[0.85rem] bg-background/70">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {IMAGE_ASPECT_RATIO_OPTIONS.map((value) => (
                                    <SelectItem key={value} value={value}>
                                      {value}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select value={draft.imageSize} onValueChange={(value) => { void setDraftImageSize(value as ImageSize) }}>
                                <SelectTrigger className="h-9 w-[4rem] shrink-0 rounded-[0.85rem] bg-background/70">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {IMAGE_SIZE_OPTIONS.map((value) => (
                                    <SelectItem key={value} value={value}>
                                      {value}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                                {referenceUsageLabel}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col items-start gap-1">
                            <Button
                              type="button"
                              onClick={() => {
                                void handleEnqueue()
                              }}
                              disabled={!isHydrated || !draft.prompt.trim()}
                              className="h-9 min-w-[11.25rem] rounded-[0.85rem]"
                            >
                              {runningTurn ? <Sparkles className="h-4 w-4" /> : <WandSparkles className="h-4 w-4" />}
                              {runningTurn || queuePaused ? 'Add to queue' : 'Generate'}
                            </Button>
                            {runningTurn ? (
                              <button
                                type="button"
                                onClick={handleCancelCurrent}
                                className="inline-flex h-7 items-center gap-1.5 rounded-[0.75rem] px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                              >
                                <Square className="h-3 w-3 fill-current" />
                                Cancel current
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ToolBody>

      <Dialog open={isDrawingDialogOpen} onOpenChange={handleDrawingDialogOpenChange}>
        <DialogContent className="flex max-h-[min(94vh,58rem)] max-w-[min(96vw,76rem)] flex-col gap-0 overflow-hidden border-border/70 bg-card p-0">
          <DialogHeader className="border-b border-border/60 px-6 pb-4 pt-6">
            <DialogTitle>Sketch a reference</DialogTitle>
            <DialogDescription>
              Draw rough layouts, subject placement, or style cues, then append each capture into this draft as a new reference image.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden p-4 sm:p-5">
            <div className="h-[min(72vh,42rem)] min-h-[22rem] overflow-hidden rounded-[1.4rem] border border-border/70 bg-background">
              <DrawingCanvas
                ref={drawingCanvasRef}
                drawingData={composerDrawingData}
                onDrawingDataChange={handleComposerDrawingDataChange}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  void handleClearDrawing()
                }}
                disabled={!composerDrawingData}
              >
                Clear drawing
              </Button>
              <Button type="button" variant="outline" onClick={() => handleDrawingDialogOpenChange(false)}>
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void handleAddDrawingReference()
                }}
                disabled={!isHydrated}
              >
                Add as reference
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPipelineDialogOpen} onOpenChange={setIsPipelineDialogOpen}>
        <DialogContent className="max-w-[min(94vw,72rem)] border-border/70 bg-card">
          <DialogHeader>
            <DialogTitle>Saved pipelines</DialogTitle>
            <DialogDescription>
              Restore a full image-gen setup with pinned reusable assets, prompt text, and output settings.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {sortedPipelines.length > 0 ? (
                sortedPipelines.map((pipeline) => {
                  const isActive = activePipeline?.id === pipeline.id

                  return (
                    <div
                      key={pipeline.id}
                      className={cn(
                        'rounded-[1.35rem] border border-border/70 bg-muted/15 p-4',
                        isActive && 'border-foreground/20 bg-muted/25'
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{pipeline.name}</p>
                            {isActive ? <Badge variant="secondary">Active</Badge> : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {pipeline.pinnedAssetIds.length} pinned ref{pipeline.pinnedAssetIds.length === 1 ? '' : 's'} • {pipeline.count} image{pipeline.count === 1 ? '' : 's'} • {pipeline.aspectRatio} • {pipeline.imageSize}
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {getPromptPreview(pipeline.prompt)}
                          </p>
                          <p className="mt-3 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                            Updated {dateFormatter.format(pipeline.updatedAt)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={() => {
                          void handleApplyPipelineRequest(pipeline.id)
                        }}>
                          {isActive ? 'Reapply' : 'Apply'}
                        </Button>
                        {isActive ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => {
                            void handleUpdateActivePipeline()
                          }}>
                            Update from current draft
                          </Button>
                        ) : null}
                        <Button type="button" size="sm" variant="ghost" onClick={() => setPipelinePendingDelete(pipeline)}>
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="flex min-h-56 items-center justify-center rounded-[1.5rem] border border-dashed border-border/70 bg-muted/15 px-6 text-center">
                  <div>
                    <p className="text-sm font-medium text-foreground">No saved pipelines yet</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Save the current draft to capture a repeatable setup with pinned brand assets and prompt text.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-[1.35rem] border border-border/70 bg-muted/15 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Save current draft</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Saving a pipeline promotes the current draft references into the reusable asset library automatically, then pins them into the saved setup.
                </p>
              </div>

              <Input
                value={newPipelineName}
                onChange={(event) => setNewPipelineName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleSavePipeline()
                  }
                }}
                placeholder="Brand setup, product edit, lifestyle batch..."
              />

              <Button
                type="button"
                className="w-full"
                disabled={!newPipelineName.trim() || !draft.prompt.trim()}
                onClick={() => {
                  void handleSavePipeline()
                }}
              >
                Save as new pipeline
              </Button>

              {activePipeline ? (
                <div className="rounded-[1rem] border border-border/70 bg-background/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Active now
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">{activePipeline.name}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Update it when you want the current draft to become the new baseline that reappears after each run.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() => {
                      void handleUpdateActivePipeline()
                    }}
                  >
                    Update active pipeline
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isLibraryDialogOpen} onOpenChange={setIsLibraryDialogOpen}>
        <DialogContent className="max-w-[min(94vw,76rem)] border-border/70 bg-card">
          <DialogHeader>
            <DialogTitle>Reusable asset library</DialogTitle>
            <DialogDescription>
              Keep brand images here, rename them once, and pull them into any draft alongside fresh uploads.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{reusableAssets.length} reusable</Badge>
                <Badge variant="outline">{selectedLibraryAssetIds.length} selected</Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => libraryFileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  Upload to library
                </Button>
                <input
                  ref={libraryFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    void handleLibraryUploadSelect(event)
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={selectedLibraryAssetIds.length === 0}
                  onClick={() => {
                    void handleAddSelectedLibraryAssets()
                  }}
                >
                  Add selected to draft
                </Button>
              </div>
            </div>

            {reusableAssets.length > 0 ? (
              <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                {reusableAssets.map((asset, index) => {
                  const isSelected = selectedLibraryAssetIds.includes(asset.id)
                  const isInDraft = draft.referenceAssetIds.includes(asset.id)

                  return (
                    <div
                      key={asset.id}
                      className={cn(
                        'rounded-[1.3rem] border border-border/70 bg-muted/15 p-3',
                        isSelected && 'border-foreground/20 bg-muted/25'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => toggleLibraryAssetSelection(asset.id)}
                          className="flex items-center gap-2 text-left"
                          aria-pressed={isSelected}
                        >
                          {isSelected ? (
                            <CheckCircle2 className="h-4 w-4 text-foreground" />
                          ) : (
                            <span className="h-4 w-4 rounded-full border border-border/80" />
                          )}
                          <span className="text-sm font-medium text-foreground">
                            {asset.name || `Reusable asset ${index + 1}`}
                          </span>
                        </button>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {isInDraft ? <Badge variant="secondary">In draft</Badge> : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              void handleAddSingleReusableAsset(asset.id)
                            }}
                          >
                            Add
                          </Button>
                          <Button type="button" size="icon" variant="ghost" onClick={() => setLibraryAssetPendingDelete(asset)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 overflow-hidden rounded-[1rem] border border-border/60 bg-background/80">
                        <img
                          src={asset.url}
                          alt={asset.name || `Reusable asset ${index + 1}`}
                          className="h-44 w-full object-cover"
                        />
                      </div>

                      <div className="mt-3 space-y-2">
                        <Input
                          defaultValue={asset.name ?? ''}
                          placeholder="Rename asset"
                          onBlur={(event) => {
                            void handleRenameReusableAsset(asset.id, event.currentTarget.value)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              event.currentTarget.blur()
                            }
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Added {dateFormatter.format(asset.createdAt)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex min-h-64 items-center justify-center rounded-[1.5rem] border border-dashed border-border/70 bg-muted/15 px-6 text-center">
                <div>
                  <p className="text-sm font-medium text-foreground">No reusable assets yet</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Upload your brand images here once, then reuse them whenever you need them in a draft or pipeline.
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={Boolean(pendingPipeline)}
        title="Apply this pipeline?"
        message={`This will replace the current draft with "${pendingPipeline?.name ?? 'the selected pipeline'}". Any unsaved draft changes will be lost.`}
        confirmLabel="Apply pipeline"
        cancelLabel="Keep draft"
        onConfirm={() => {
          if (pendingPipeline) {
            void commitApplyPipeline(pendingPipeline.id)
          }
        }}
        onCancel={() => setPendingPipelineToApply(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(pipelinePendingDelete)}
        title="Delete this pipeline?"
        message={`"${pipelinePendingDelete?.name ?? 'This pipeline'}" will be removed from the saved list. Historical turns will stay intact.`}
        confirmLabel="Delete pipeline"
        cancelLabel="Keep pipeline"
        variant="danger"
        onConfirm={() => {
          void handleConfirmPipelineDelete()
        }}
        onCancel={() => setPipelinePendingDelete(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(libraryAssetPendingDelete)}
        title="Delete this reusable asset?"
        message={`"${libraryAssetPendingDelete?.name ?? 'This reusable asset'}" will be removed from the library and from any saved pipelines. Historical turns that already used it will stay intact.`}
        confirmLabel="Delete asset"
        cancelLabel="Keep asset"
        variant="danger"
        onConfirm={() => {
          void handleConfirmReusableAssetDelete()
        }}
        onCancel={() => setLibraryAssetPendingDelete(null)}
      />

      <Dialog open={Boolean(selectedImage && selectedTurn && selectedViewerItem)} onOpenChange={(open) => {
        if (!open) {
          setSelectedImage(null)
        }
      }}>
        <DialogContent className="max-w-[min(96vw,120rem)] overflow-hidden border-border/70 bg-card p-0">
          {selectedTurn && selectedViewerItem ? (
            <>
              <DialogHeader className="border-b border-border/70 px-6 py-4">
                <DialogTitle>{modelLabel(selectedTurn.model)}</DialogTitle>
                <DialogDescription>
                  {getStatusLabel(selectedTurn.status)} • {dateFormatter.format(selectedTurn.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="grid max-h-[85vh] gap-0 lg:grid-cols-[minmax(0,1fr)_420px]">
                <div className="overflow-y-auto bg-muted/20 p-6">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3 rounded-[1.35rem] border border-border/70 bg-background/85 px-4 py-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={selectedViewerItem.kind === 'reference' ? 'secondary' : 'outline'}>
                            {getViewerItemLabel(selectedViewerItem)}
                          </Badge>
                          <Badge variant="outline">
                            {selectedViewerIndex + 1} of {selectedViewerItems.length}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {getViewerItemTitle(selectedViewerItem)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getViewerItemDescription(selectedViewerItem)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="relative overflow-hidden rounded-[1.5rem] border border-border/70 bg-card">
                      <img
                        src={selectedViewerItem.asset.url}
                        alt={getViewerItemTitle(selectedViewerItem)}
                        className="max-h-[72vh] w-full object-contain"
                      />

                      {selectedViewerItems.length > 1 ? (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-4">
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="pointer-events-auto rounded-full shadow-lg"
                            onClick={handleSelectPreviousViewerItem}
                            disabled={selectedViewerIndex <= 0}
                            aria-label="Previous image in batch"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="pointer-events-auto rounded-full shadow-lg"
                            onClick={handleSelectNextViewerItem}
                            disabled={selectedViewerIndex >= selectedViewerItems.length - 1}
                            aria-label="Next image in batch"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="overflow-y-auto border-l border-border/70 p-6">
                  <div className="space-y-6">
                    <div className="flex flex-wrap gap-2">
                      <TurnStatusBadge status={selectedTurn.status} />
                      <Badge variant="outline">{selectedTurn.aspectRatio}</Badge>
                      <Badge variant="outline">{selectedTurn.imageSize}</Badge>
                      <Badge variant="outline">{selectedTurn.referenceAssetIds.length > 0 ? 'Image + text' : 'Text to image'}</Badge>
                      <Badge variant={selectedViewerItem.kind === 'reference' ? 'secondary' : 'outline'}>
                        {getViewerItemLabel(selectedViewerItem)}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => void handleCopyPrompt(selectedTurn)}>
                        <Copy className="h-4 w-4" />
                        Copy prompt
                      </Button>
                      {selectedViewerItem.kind === 'result' ? (
                        <div className="flex">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-r-none"
                            onClick={() => {
                              void handleDownloadVariant(selectedTurn, selectedViewerItem, 'original')
                            }}
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="-ml-px rounded-l-none px-2"
                                aria-label="Open download variants"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {selectedViewerCanDownloadPng ? (
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() => {
                                    void handleDownloadVariant(selectedTurn, selectedViewerItem, 'png')
                                  }}
                                >
                                  PNG
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => {
                                  void handleDownloadVariant(selectedTurn, selectedViewerItem, 'jpeg-100')
                                }}
                              >
                                JPEG 100%
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => {
                                  void handleDownloadVariant(selectedTurn, selectedViewerItem, 'jpeg-80')
                                }}
                              >
                                JPEG 80%
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => {
                                  void handleDownloadVariant(selectedTurn, selectedViewerItem, 'jpeg-60')
                                }}
                              >
                                JPEG 60%
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            void handleDownloadVariant(selectedTurn, selectedViewerItem, 'original')
                          }}
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      )}
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Prompt used
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                        {selectedTurn.prompt}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Images in batch
                        </p>
                        <Badge variant="outline">{selectedViewerItems.length} total</Badge>
                      </div>
                      <div className="space-y-3">
                        {selectedViewerItems.map((item, index) => (
                          <button
                            key={item.assetId}
                            type="button"
                            onClick={() => {
                              setSelectedImage((current) => current ? { ...current, assetId: item.assetId } : current)
                            }}
                            className={cn(
                              'w-full rounded-[1.1rem] border border-border/70 bg-background/80 p-3 text-left transition-[border-color,background-color]',
                              item.assetId === selectedViewerItem.assetId
                                ? 'border-foreground/20 bg-muted/45'
                                : 'hover:border-foreground/15 hover:bg-muted/20'
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-24 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-background/75 p-1.5">
                                <img
                                  src={item.asset.url}
                                  alt={getViewerItemTitle(item)}
                                  className="block h-auto w-full rounded-lg"
                                />
                              </div>

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant={item.kind === 'reference' ? 'secondary' : 'outline'}>
                                    {item.kind === 'reference' ? 'Source' : 'Result'}
                                  </Badge>
                                  <span className="text-[11px] text-muted-foreground">
                                    {index + 1} of {selectedViewerItems.length}
                                  </span>
                                </div>
                                <p className="mt-2 truncate text-sm font-medium text-foreground">
                                  {getViewerItemTitle(item)}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                  {getViewerItemDescription(item)}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={() => void handleAnotherVersion(selectedTurn.id)}>
                        <RefreshCcw className="h-4 w-4" />
                        Another version
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleEditFromImage(selectedTurn.id, selectedViewerItem.assetId)}
                      >
                        <Sparkles className="h-4 w-4" />
                        Edit from this
                      </Button>
                    </div>

                    {selectedTurn.responseText ? (
                      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Model note
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                          {selectedTurn.responseText}
                        </p>
                      </div>
                    ) : null}

                    {selectedTurn.error ? (
                      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">
                        {selectedTurn.error}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </ToolShell>
  )
}
