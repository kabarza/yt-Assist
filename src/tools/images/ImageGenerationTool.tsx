import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
} from 'react'
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
  Loader2,
  Pause,
  Play,
  RefreshCcw,
  Sparkles,
  Square,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToolBody, ToolContainer, ToolHeader, ToolShell } from '@/components/layout/ToolShell'
import { Textarea } from '@/components/ui/textarea'
import { requestGeneratedImages } from '@/utils/imageApiClient'
import { showBackgroundTaskCompletionToast } from '@/utils/taskCompletionToast'
import { useImageGenerationStore } from '@/stores/imageGenerationStore'
import type {
  ImageAsset,
  ImageAspectRatio,
  ImageGenerationModel,
  ImageGridZoom,
  ImageSize,
  ImageTurn,
  ImageTurnStatus,
} from '@/types/images'
import {
  IMAGE_ASPECT_RATIO_OPTIONS,
  IMAGE_COUNT_OPTIONS,
  IMAGE_GENERATION_MODELS,
  IMAGE_GRID_ZOOM_OPTIONS,
  IMAGE_SIZE_OPTIONS,
} from '@/types/images'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const gridMinWidthByZoom: Record<ImageGridZoom, number> = {
  compact: 160,
  list: 220,
  detail: 320,
}

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

export default function ImageGenerationTool() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null)
  const threadScrollRef = useRef<HTMLDivElement>(null)
  const composerOverlayRef = useRef<HTMLDivElement>(null)
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
    draft,
    gridZoom,
    queuePaused,
    hydrate,
    setDraftPrompt,
    setDraftModel,
    setDraftCount,
    setDraftAspectRatio,
    setDraftImageSize,
    resetDraft,
    addDraftReference,
    removeDraftReference,
    enqueueDraft,
    pauseQueue,
    resumeQueue,
    setGridZoom,
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

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const runningTurn = useMemo(
    () => turns.find((turn) => turn.status === 'running') ?? null,
    [turns]
  )
  const queuedTurns = useMemo(() => turns.filter((turn) => turn.status === 'queued'), [turns])
  const pausedTurns = useMemo(() => turns.filter((turn) => turn.status === 'paused'), [turns])
  const failedTurns = useMemo(() => turns.filter((turn) => turn.status === 'failed'), [turns])
  const draftReferenceAssets = useMemo(
    () => draft.referenceAssetIds.map((assetId) => assetsById[assetId]).filter(Boolean),
    [assetsById, draft.referenceAssetIds]
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

  const tailSignature = useMemo(() => {
    const lastTurn = turns[turns.length - 1]
    if (!lastTurn) return ''
    return `${lastTurn.id}:${lastTurn.status}:${lastTurn.resultAssetIds.join(',')}`
  }, [turns])

  useEffect(() => {
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
  }, [tailSignature])

  useEffect(() => {
    if (selectedImage && (!selectedTurn || !selectedViewerItem)) {
      setSelectedImage(null)
    }
  }, [selectedImage, selectedTurn, selectedViewerItem])

  const attachFiles = useCallback(async (files: File[]) => {
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(`Skipped ${file.name}: not an image`)
        continue
      }

      await addDraftReference({
        blob: file,
        mimeType: file.type,
        name: file.name,
      })
    }
  }, [addDraftReference])

  const handleFileSelect = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      await attachFiles(Array.from(event.target.files))
    }
    event.target.value = ''
  }, [attachFiles])

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

  const focusComposer = useCallback(() => {
    requestAnimationFrame(() => {
      composerTextareaRef.current?.focus()
    })
  }, [])

  const openViewer = useCallback((turnId: string, assetId: string) => {
    const turn = turns.find((entry) => entry.id === turnId)
    if (!turn) return

    setSelectedImage({
      turnId,
      assetId,
      assetIds: buildViewerAssetOrder(turn, assetsById),
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

  const handleEnqueue = useCallback(async () => {
    if (!draft.prompt.trim()) {
      toast.error('Enter a prompt first')
      return
    }

    const turnId = await enqueueDraft()
    if (!turnId) return
  }, [draft.prompt, enqueueDraft])

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

  const queueSummary = useMemo(() => {
    const parts: string[] = []
    if (runningTurn) parts.push('1 running')
    if (queuedTurns.length > 0) parts.push(`${queuedTurns.length} queued`)
    if (pausedTurns.length > 0) parts.push(`${pausedTurns.length} paused`)
    if (failedTurns.length > 0) parts.push(`${failedTurns.length} failed`)
    return parts.length > 0 ? parts.join(' • ') : 'Idle'
  }, [failedTurns.length, pausedTurns.length, queuedTurns.length, runningTurn])

  const isListView = gridZoom === 'list'
  const masonryColumnWidth = `${gridMinWidthByZoom[gridZoom]}px`

  return (
    <ToolShell>
      <ToolHeader
        title="Image Gen"
        description="Persistent Nano Banana image conversations with queueing, references, and versioning."
      />

      <ToolBody className="overflow-hidden p-0">
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-border/70 px-5 py-2.5">
            <ToolContainer className="space-y-0">
              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Stored locally in this browser</Badge>
                  <Badge variant={runningTurn ? 'secondary' : 'outline'}>{queueSummary}</Badge>
                  <Badge variant="outline">{turns.length} turn{turns.length === 1 ? '' : 's'}</Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 rounded-[0.9rem] bg-muted/75 p-1 shadow-[inset_0_0_0_1px_hsl(var(--border)/0.5)]">
                    {IMAGE_GRID_ZOOM_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          void setGridZoom(option.id)
                        }}
                        className={cn(
                          'rounded-[0.7rem] px-3 py-1.5 text-[13px] font-medium transition-[color,background-color,box-shadow]',
                          gridZoom === option.id
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
              </div>
            </ToolContainer>
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col">
            <div
              ref={threadScrollRef}
              className="flex-1 overflow-y-auto px-4 pt-5 sm:px-6"
              style={{ paddingBottom: composerBottomPadding }}
            >
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
                        Generated results, references, prompts, and queue state will stay saved locally on this device. Use the composer below to create a first image or bring references into the thread.
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
                                isListView ? (
                                  <div className="space-y-2">
                                    {resultAssets.map((asset, index) => (
                                      <button
                                        key={asset.id}
                                        type="button"
                                        onClick={() => openViewer(turn.id, asset.id)}
                                        className="group grid w-full grid-cols-[7.5rem_minmax(0,1fr)_1rem] items-start gap-4 overflow-hidden rounded-[1rem] border border-border/70 bg-muted/18 px-3 py-3 text-left transition-[background-color,border-color] hover:bg-muted/28"
                                      >
                                        <div className="overflow-hidden rounded-[0.85rem] border border-border/60 bg-background/75 p-1.5">
                                          <img
                                            src={asset.url}
                                            alt={`Generated result ${index + 1}`}
                                            className="block h-auto w-full rounded-[0.65rem]"
                                          />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium text-foreground">Result {index + 1}</p>
                                          <p className="mt-1 truncate text-xs text-muted-foreground">
                                            {turn.aspectRatio} • {turn.imageSize} • {modelLabel(turn.model)}
                                          </p>
                                          <p className="mt-2 text-xs text-muted-foreground">
                                            Open prompt, refs, version actions, and download.
                                          </p>
                                        </div>
                                        <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <div
                                    className="w-full"
                                    style={{ columnGap: '0.75rem', columnWidth: masonryColumnWidth }}
                                  >
                                    {resultAssets.map((asset, index) => (
                                      <button
                                        key={asset.id}
                                        type="button"
                                        onClick={() => openViewer(turn.id, asset.id)}
                                        className="group mb-3 block w-full break-inside-avoid overflow-hidden rounded-[1.25rem] border border-border/70 bg-muted/30 text-left transition-transform hover:-translate-y-0.5"
                                      >
                                        <div className="overflow-hidden border-b border-border/60 bg-background/75 p-2">
                                          <img
                                            src={asset.url}
                                            alt={`Generated result ${index + 1}`}
                                            className="block h-auto w-full rounded-[0.9rem]"
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
                                  </div>
                                )
                              ) : (
                                isListView ? (
                                  <div className="space-y-2">
                                    {Array.from({ length: turn.count }).map((_, index) => (
                                      <div
                                        key={`${turn.id}-placeholder-${index}`}
                                        className={cn(
                                          'grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-4 rounded-[1rem] border border-dashed border-border/80 bg-muted/16 px-3 py-3',
                                          turn.status === 'running' && 'animate-pulse',
                                        )}
                                      >
                                        <div
                                          className="flex w-full items-center justify-center rounded-[0.85rem] bg-background/55"
                                          style={{ aspectRatio: placeholderAspectRatio }}
                                        >
                                          {turn.status === 'running' ? (
                                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                          ) : (
                                            <Clock3 className="h-5 w-5 text-muted-foreground" />
                                          )}
                                        </div>
                                        <div>
                                          <p className="text-sm font-medium text-foreground">
                                            Result {index + 1} • {getStatusLabel(turn.status)}
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
                                  </div>
                                ) : (
                                  <div
                                    className="w-full"
                                    style={{ columnGap: '0.75rem', columnWidth: masonryColumnWidth }}
                                  >
                                    {Array.from({ length: turn.count }).map((_, index) => (
                                      <div
                                        key={`${turn.id}-placeholder-${index}`}
                                        className={cn(
                                          'mb-3 break-inside-avoid overflow-hidden rounded-[1.25rem] border border-dashed border-border/80 bg-muted/20',
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
                                  </div>
                                )
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
                                        <div
                                          className="w-full"
                                          style={{ columnGap: '0.75rem', columnWidth: '140px' }}
                                        >
                                          {referenceAssets.map((asset, index) => (
                                            <button
                                              key={asset.id}
                                              type="button"
                                              onClick={() => openViewer(turn.id, asset.id)}
                                              className="mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl border border-border/70 bg-card text-left transition-[border-color,background-color] hover:border-foreground/15 hover:bg-muted/18"
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
                                        </div>
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
            </div>

            <div
              ref={composerOverlayRef}
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-6"
            >
              <div className="pointer-events-auto mx-auto w-full max-w-[49.5rem]">
                <div className="pt-1">
                  <div
                    className="overflow-hidden rounded-[1.45rem] border border-border/70 bg-background/96 shadow-[0_10px_30px_hsl(var(--background)/0.45)] backdrop-blur-sm transition-[border-color,box-shadow] duration-200 focus-within:border-ring/40"
                    onDrop={handleComposerDrop}
                    onDragOver={(event) => event.preventDefault()}
                  >
                    {(draft.origin !== 'new' || draft.sourceTurnId) ? (
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
                            void resetDraft()
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

                    <div className="flex flex-wrap items-end gap-2.5 px-4 pb-3 pt-1 sm:flex-nowrap">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
                        <Button type="button" variant="ghost" size="sm" className="h-9 shrink-0 rounded-[0.85rem]" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="h-4 w-4" />
                          Add images
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

                        <Select value={draft.model} onValueChange={(value) => { void setDraftModel(value as ImageGenerationModel) }}>
                          <SelectTrigger className="h-9 min-w-[10.5rem] flex-1 basis-[11rem] rounded-[0.85rem] bg-background/70 sm:max-w-[11rem] sm:flex-none">
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

                      <div className="ml-auto flex min-w-[12rem] shrink-0 flex-col items-stretch gap-2 sm:items-end">
                        {runningTurn ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-[0.85rem] px-3 text-xs sm:w-auto"
                            onClick={handleCancelCurrent}
                          >
                            <Square className="h-3.5 w-3.5 fill-current" />
                            Cancel current
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          onClick={() => {
                            void handleEnqueue()
                          }}
                          disabled={!isHydrated || !draft.prompt.trim()}
                          className="h-9 min-w-32 rounded-[0.85rem] w-full sm:w-auto"
                        >
                          {runningTurn ? <Sparkles className="h-4 w-4" /> : <WandSparkles className="h-4 w-4" />}
                          {runningTurn || queuePaused ? 'Add to queue' : 'Generate'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ToolBody>

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
                            onClick={() => openViewer(item.turnId, item.assetId)}
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
