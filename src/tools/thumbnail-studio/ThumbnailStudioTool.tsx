import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  ImagePlus,
  Layers3,
  Lock,
  Palette,
  Plus,
  Sparkles,
  Trash2,
  Type,
  Unlock,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { ToolBody, ToolHeader, ToolShell } from '@/components/layout/ToolShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  useActiveThumbnailDocument,
  useEffectiveThumbnailBrandKit,
  useSelectedThumbnailLayer,
  useThumbnailEditorStore,
} from '@/stores/thumbnailEditorStore'
import { loadCanvasLabPersistence } from '@/utils/canvasLabPersistence'
import { requestThumbnailEdit } from '@/utils/thumbnailApiClient'
import { loadImageGenerationPersistence } from '@/utils/imageGenerationPersistence'
import { ThumbnailStage, type ThumbnailStageRef } from '@/tools/thumbnail-studio/ThumbnailStage'
import type {
  ThumbnailAiJob,
  ThumbnailAiMode,
  ThumbnailBoardPreset,
  ThumbnailTextLayer,
} from '@/types/thumbnailEditor'
import { THUMBNAIL_BOARD_PRESETS } from '@/types/thumbnailEditor'
import { IMAGE_COUNT_OPTIONS, IMAGE_GENERATION_MODELS } from '@/types/images'

type ExternalAssetSource = 'library' | 'results' | 'canvas'

interface ExternalAssetEntry {
  id: string
  key: ExternalAssetSource
  name: string
  blob: Blob
  mimeType: string
  url: string
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || target.isContentEditable
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl)
  return await response.blob()
}

async function getImageDimensions(blob: Blob) {
  const url = URL.createObjectURL(blob)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new window.Image()
      nextImage.decoding = 'async'
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () => reject(new Error('Failed to read image dimensions'))
      nextImage.src = url
    })

    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function buildExportName(name: string, extension: 'png' | 'jpg') {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'thumbnail'

  return `${slug}.${extension}`
}

function resolveBoardPreset(board: { width: number; height: number }): ThumbnailBoardPreset | null {
  return THUMBNAIL_BOARD_PRESETS.find((preset) => preset.width === board.width && preset.height === board.height) || null
}

function buildPromptTemplate(mode: ThumbnailAiMode) {
  switch (mode) {
    case 'remove_background':
      return ''
    case 'outpaint':
      return 'Extend the image naturally for thumbnail composition.'
    case 'replace':
    default:
      return 'Sharpen the pose, expression, and readability for a high-contrast thumbnail.'
  }
}

function sourceLabel(source: ExternalAssetSource) {
  switch (source) {
    case 'library':
      return 'Reusable Library'
    case 'results':
      return 'Image Results'
    case 'canvas':
      return 'Canvas Lab'
  }
}

function ControlLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{children}</p>
}

class ThumbnailStudioErrorBoundary extends Component<
  { children: React.ReactNode },
  { errorMessage: string | null }
> {
  state = {
    errorMessage: null,
  }

  static getDerivedStateFromError(error: Error) {
    return {
      errorMessage: error.message || 'Thumbnail Studio crashed while rendering.',
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Thumbnail Studio render error', error, errorInfo)
  }

  render() {
    if (this.state.errorMessage) {
      return (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="max-w-lg rounded-[1.5rem] border border-red-400/30 bg-red-500/10 p-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
            <h2 className="text-lg font-semibold text-white">Thumbnail Studio hit a render error</h2>
            <p className="mt-3 text-sm leading-6 text-white/72">{this.state.errorMessage}</p>
            <div className="mt-5 flex justify-center">
              <Button type="button" variant="outline" className="border-white/12 bg-white/6 text-white hover:bg-white/10" onClick={() => window.location.reload()}>
                Reload editor
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default function ThumbnailStudioTool() {
  const stageRef = useRef<ThumbnailStageRef | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hydrate = useThumbnailEditorStore((state) => state.hydrate)
  const isHydrated = useThumbnailEditorStore((state) => state.isHydrated)
  const isHydrating = useThumbnailEditorStore((state) => state.isHydrating)
  const hydrationError = useThumbnailEditorStore((state) => state.hydrationError)
  const documents = useThumbnailEditorStore((state) => state.documents)
  const activeDocumentId = useThumbnailEditorStore((state) => state.activeDocumentId)
  const assetsById = useThumbnailEditorStore((state) => state.assetsById)
  const toolMode = useThumbnailEditorStore((state) => state.toolMode)
  const aiJobs = useThumbnailEditorStore((state) => state.aiJobs)
  const activeAiJobId = useThumbnailEditorStore((state) => state.activeAiJobId)
  const setToolMode = useThumbnailEditorStore((state) => state.setToolMode)
  const createDocument = useThumbnailEditorStore((state) => state.createDocument)
  const duplicateDocument = useThumbnailEditorStore((state) => state.duplicateDocument)
  const renameDocument = useThumbnailEditorStore((state) => state.renameDocument)
  const deleteDocument = useThumbnailEditorStore((state) => state.deleteDocument)
  const setActiveDocumentId = useThumbnailEditorStore((state) => state.setActiveDocumentId)
  const updateBoard = useThumbnailEditorStore((state) => state.updateBoard)
  const importAsset = useThumbnailEditorStore((state) => state.importAsset)
  const addImageLayerFromAsset = useThumbnailEditorStore((state) => state.addImageLayerFromAsset)
  const addTextLayer = useThumbnailEditorStore((state) => state.addTextLayer)
  const selectLayer = useThumbnailEditorStore((state) => state.selectLayer)
  const updateLayer = useThumbnailEditorStore((state) => state.updateLayer)
  const moveLayer = useThumbnailEditorStore((state) => state.moveLayer)
  const duplicateLayer = useThumbnailEditorStore((state) => state.duplicateLayer)
  const removeLayer = useThumbnailEditorStore((state) => state.removeLayer)
  const toggleLayerLock = useThumbnailEditorStore((state) => state.toggleLayerLock)
  const toggleLayerHidden = useThumbnailEditorStore((state) => state.toggleLayerHidden)
  const replaceLayerAsset = useThumbnailEditorStore((state) => state.replaceLayerAsset)
  const brandKits = useThumbnailEditorStore((state) => state.brandKits)
  const applyBrandKit = useThumbnailEditorStore((state) => state.applyBrandKit)
  const updateBrandOverrides = useThumbnailEditorStore((state) => state.updateBrandOverrides)
  const createBrandKitFromCurrent = useThumbnailEditorStore((state) => state.createBrandKitFromCurrent)
  const upsertAiJob = useThumbnailEditorStore((state) => state.upsertAiJob)
  const removeAiJob = useThumbnailEditorStore((state) => state.removeAiJob)
  const setActiveAiJobId = useThumbnailEditorStore((state) => state.setActiveAiJobId)

  const document = useActiveThumbnailDocument()
  const selectedLayer = useSelectedThumbnailLayer()
  const effectiveBrandKit = useEffectiveThumbnailBrandKit()
  const activeAiJob = useMemo(
    () => (activeAiJobId ? aiJobs.find((job) => job.id === activeAiJobId) ?? null : null),
    [activeAiJobId, aiJobs],
  )

  const [editingTextLayerId, setEditingTextLayerId] = useState<string | null>(null)
  const [editingTextValue, setEditingTextValue] = useState('')
  const [selectedPresetId, setSelectedPresetId] = useState<string>(effectiveBrandKit.textStyles[0]?.id || '')
  const [brandKitDraftName, setBrandKitDraftName] = useState('')
  const [aiPrompt, setAiPrompt] = useState(buildPromptTemplate('replace'))
  const [aiCount, setAiCount] = useState<1 | 2 | 4>(4)
  const [aiModel, setAiModel] = useState(IMAGE_GENERATION_MODELS[0].id)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [externalAssetSource, setExternalAssetSource] = useState<ExternalAssetSource>('library')
  const [externalAssets, setExternalAssets] = useState<ExternalAssetEntry[]>([])
  const [pendingOutpaintByLayer, setPendingOutpaintByLayer] = useState<Record<string, { top: number; right: number; bottom: number; left: number }>>({})

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    if (!selectedLayer || selectedLayer.kind !== 'text') {
      setEditingTextLayerId(null)
      return
    }

    if (editingTextLayerId && editingTextLayerId !== selectedLayer.id) {
      setEditingTextLayerId(null)
    }
  }, [editingTextLayerId, selectedLayer])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!document || isEditableTarget(event.target)) return

      const key = event.key.toLowerCase()
      if (key === 'v') {
        event.preventDefault()
        setToolMode('move')
        return
      }

      if (key === 'k') {
        event.preventDefault()
        setToolMode('transform')
        return
      }

      if (key === 't') {
        event.preventDefault()
        addTextLayer(selectedPresetId || undefined)
        return
      }

      if ((event.metaKey || event.ctrlKey) && key === 'd' && selectedLayer) {
        event.preventDefault()
        duplicateLayer(selectedLayer.id)
        return
      }

      if (event.key === '[' && selectedLayer) {
        event.preventDefault()
        moveLayer(selectedLayer.id, 'down')
        return
      }

      if (event.key === ']' && selectedLayer) {
        event.preventDefault()
        moveLayer(selectedLayer.id, 'up')
        return
      }

      if (event.key === 'Backspace' && selectedLayer && selectedLayer.kind !== 'background') {
        event.preventDefault()
        removeLayer(selectedLayer.id)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [addTextLayer, document, duplicateLayer, moveLayer, removeLayer, selectedLayer, selectedPresetId, setToolMode])

  useEffect(() => {
    if (!isImportDialogOpen) {
      setExternalAssets((current) => {
        current.forEach((asset) => URL.revokeObjectURL(asset.url))
        return []
      })
      return
    }

    let disposed = false

    const loadExternalAssets = async () => {
      try {
        const [imagePersistence, canvasPersistence] = await Promise.all([
          loadImageGenerationPersistence(),
          loadCanvasLabPersistence(),
        ])

        const nextAssets: ExternalAssetEntry[] = [
          ...imagePersistence.assets
            .filter((asset) => asset.isReusable)
            .map((asset) => ({
              id: asset.id,
              key: 'library' as const,
              name: asset.name || 'Reusable image',
              blob: asset.blob,
              mimeType: asset.mimeType,
              url: URL.createObjectURL(asset.blob),
            })),
          ...imagePersistence.assets
            .filter((asset) => asset.kind === 'result')
            .map((asset) => ({
              id: asset.id,
              key: 'results' as const,
              name: asset.name || 'Generated result',
              blob: asset.blob,
              mimeType: asset.mimeType,
              url: URL.createObjectURL(asset.blob),
            })),
          ...canvasPersistence.assets.map((asset) => ({
            id: asset.id,
            key: 'canvas' as const,
            name: asset.name || 'Canvas asset',
            blob: asset.blob,
            mimeType: asset.mimeType,
            url: URL.createObjectURL(asset.blob),
          })),
        ]

        if (disposed) {
          nextAssets.forEach((asset) => URL.revokeObjectURL(asset.url))
          return
        }

        setExternalAssets((current) => {
          current.forEach((asset) => URL.revokeObjectURL(asset.url))
          return nextAssets
        })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load external assets')
      }
    }

    void loadExternalAssets()

    return () => {
      disposed = true
    }
  }, [isImportDialogOpen])

  const localAssets = useMemo(
    () => Object.values(assetsById).sort((a, b) => b.createdAt - a.createdAt),
    [assetsById],
  )

  const selectedAsset =
    selectedLayer && (selectedLayer.kind === 'image' || selectedLayer.kind === 'background') && selectedLayer.assetId
      ? assetsById[selectedLayer.assetId] || null
      : null

  const pendingOutpaint =
    selectedLayer && selectedLayer.kind === 'image'
      ? pendingOutpaintByLayer[selectedLayer.id] || null
      : null

  const candidateAssets = useMemo(
    () => activeAiJob?.candidateAssetIds.map((assetId) => assetsById[assetId]).filter(Boolean) || [],
    [activeAiJob?.candidateAssetIds, assetsById],
  )

  const importExternalEntry = useCallback(async (entry: ExternalAssetEntry, asBackground = false) => {
    try {
      const dimensions = await getImageDimensions(entry.blob)
      const assetId = await importAsset({
        blob: entry.blob,
        mimeType: entry.mimeType,
        name: entry.name,
        source:
          entry.key === 'library'
            ? 'imageLibrary'
            : entry.key === 'results'
            ? 'imageResult'
            : 'canvasLab',
        width: dimensions.width,
        height: dimensions.height,
      })

      addImageLayerFromAsset(assetId, asBackground ? { asBackground: true } : undefined)
      toast.success(asBackground ? 'Imported as background' : 'Imported into Thumbnail Studio')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not import asset')
    }
  }, [addImageLayerFromAsset, importAsset])

  const handleLocalUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const dimensions = await getImageDimensions(file)
      const assetId = await importAsset({
        blob: file,
        mimeType: file.type,
        name: file.name,
        source: 'upload',
        width: dimensions.width,
        height: dimensions.height,
      })

      addImageLayerFromAsset(assetId)
      toast.success('Image added to the board')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import image')
    }
  }, [addImageLayerFromAsset, importAsset])

  const startEditingText = useCallback((layerId: string) => {
    const textLayer = document?.layers.find((layer): layer is ThumbnailTextLayer => layer.id === layerId && layer.kind === 'text')
    if (!textLayer) return
    setEditingTextLayerId(layerId)
    setEditingTextValue(textLayer.text)
  }, [document])

  const commitEditingText = useCallback(() => {
    if (!editingTextLayerId) return

    updateLayer(editingTextLayerId, (layer) => {
      if (layer.kind !== 'text') {
        return layer
      }

      const lineCount = Math.max(1, editingTextValue.split('\n').length)
      return {
        ...layer,
        text: editingTextValue,
        height: Math.max(layer.height, layer.style.fontSize * layer.style.lineHeight * lineCount + 32),
      }
    })
    setEditingTextLayerId(null)
  }, [editingTextLayerId, editingTextValue, updateLayer])

  const runAiEdit = useCallback(async (mode: ThumbnailAiMode) => {
    if (!document || !selectedLayer || selectedLayer.kind !== 'image' || !selectedAsset) {
      toast.error('Select an image layer first')
      return
    }

    if (mode === 'outpaint' && !pendingOutpaint) {
      toast.error('Use Cmd/Ctrl while resizing an image layer to mark an outpaint area first')
      return
    }

    const jobId = crypto.randomUUID()
    const baseJob: ThumbnailAiJob = {
      id: jobId,
      documentId: document.id,
      targetLayerId: selectedLayer.id,
      mode,
      model: aiModel,
      prompt: aiPrompt.trim(),
      count: aiCount,
      status: 'running',
      candidateAssetIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...(mode === 'outpaint' && pendingOutpaint ? { outpaint: pendingOutpaint } : {}),
    }

    upsertAiJob(baseJob)

    try {
      const [targetImageDataUrl, contextImageDataUrl] = await Promise.all([
        blobToDataUrl(selectedAsset.blob),
        Promise.resolve(stageRef.current?.exportDataUrl({ mimeType: 'image/png' }) || ''),
      ])

      const result = await requestThumbnailEdit({
        mode,
        model: aiModel,
        prompt: mode === 'remove_background' ? undefined : aiPrompt.trim(),
        count: aiCount,
        targetImage: {
          dataUrl: targetImageDataUrl,
          mimeType: selectedAsset.mimeType,
        },
        contextImage: contextImageDataUrl
          ? {
              dataUrl: contextImageDataUrl,
              mimeType: 'image/png',
            }
          : undefined,
        board: {
          width: document.board.width,
          height: document.board.height,
        },
        layerFrame: {
          x: selectedLayer.x,
          y: selectedLayer.y,
          width: selectedLayer.width,
          height: selectedLayer.height,
        },
        ...(mode === 'outpaint' && pendingOutpaint ? { outpaint: pendingOutpaint } : {}),
      })

      const candidateAssetIds: string[] = []

      for (const image of result.images) {
        const blob = await dataUrlToBlob(image.dataUrl)
        const dimensions = await getImageDimensions(blob)
        const assetId = await importAsset({
          blob,
          mimeType: image.mimeType,
          name: `${selectedLayer.name} AI ${candidateAssetIds.length + 1}`,
          source: 'thumbnailAi',
          width: dimensions.width,
          height: dimensions.height,
        })
        candidateAssetIds.push(assetId)
      }

      upsertAiJob({
        ...baseJob,
        status: 'complete',
        candidateAssetIds,
        warnings: result.warnings,
        updatedAt: Date.now(),
      })

      if (result.warnings?.length) {
        toast.warning(result.warnings[0])
      } else {
        toast.success('AI options ready')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI edit failed'
      upsertAiJob({
        ...baseJob,
        status: 'error',
        error: message,
        updatedAt: Date.now(),
      })
      toast.error(message)
    }
  }, [aiCount, aiModel, aiPrompt, document, importAsset, pendingOutpaint, selectedAsset, selectedLayer, upsertAiJob])

  const exportBoard = useCallback((mimeType: 'image/png' | 'image/jpeg') => {
    if (!document) return
    const dataUrl = stageRef.current?.exportDataUrl({
      mimeType,
      ...(mimeType === 'image/jpeg' ? { quality: 0.92 } : {}),
    })

    if (!dataUrl) {
      toast.error('Could not export the thumbnail')
      return
    }

    downloadDataUrl(dataUrl, buildExportName(document.name, mimeType === 'image/png' ? 'png' : 'jpg'))
  }, [document])

  const handleApplyTextPreset = useCallback((presetId: string) => {
    setSelectedPresetId(presetId)
    if (!selectedLayer || selectedLayer.kind !== 'text') return

    const preset = effectiveBrandKit.textStyles.find((entry) => entry.id === presetId)
    if (!preset) return

    updateLayer(selectedLayer.id, (layer) => {
      if (layer.kind !== 'text') {
        return layer
      }

      return {
        ...layer,
        style: {
          ...layer.style,
          fontFamily: preset.fontFamily,
          fontSize: preset.fontSize,
          fontWeight: preset.fontWeight,
          color: preset.color,
          align: preset.align,
          letterSpacing: preset.letterSpacing,
          lineHeight: preset.lineHeight,
          strokeColor: preset.strokeColor,
          strokeWidth: preset.strokeWidth,
          shadowColor: preset.shadowColor,
          shadowBlur: preset.shadowBlur,
        },
      }
    })
  }, [effectiveBrandKit.textStyles, selectedLayer, updateLayer])

  const handleSaveBrandKit = useCallback(() => {
    const id = createBrandKitFromCurrent(brandKitDraftName)
    if (!id) {
      toast.error('Name the brand kit first')
      return
    }

    setBrandKitDraftName('')
    applyBrandKit(id)
    toast.success('Brand kit saved')
  }, [applyBrandKit, brandKitDraftName, createBrandKitFromCurrent])

  const handleAcceptAiCandidate = useCallback((assetId: string) => {
    if (!selectedLayer || selectedLayer.kind !== 'image' || !activeAiJob) return
    replaceLayerAsset(selectedLayer.id, assetId, true)
    removeAiJob(activeAiJob.id)
    setActiveAiJobId(null)
    setPendingOutpaintByLayer((current) => {
      const next = { ...current }
      delete next[selectedLayer.id]
      return next
    })
    toast.success('Image layer updated')
  }, [activeAiJob, removeAiJob, replaceLayerAsset, selectedLayer, setActiveAiJobId])

  if (!isHydrated || isHydrating) {
    return (
      <ToolShell className="bg-[#0c0a0e]">
        <ToolBody className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded-[1.6rem] border border-white/10 bg-white/5 p-8 text-center shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
            <Sparkles className="mx-auto mb-4 h-8 w-8 text-[#ffb15a]" />
            <h2 className="text-lg font-semibold text-white">Preparing Thumbnail Studio</h2>
            <p className="mt-2 text-sm leading-6 text-white/62">
              Loading your documents, imported assets, and brand kits.
            </p>
          </div>
        </ToolBody>
      </ToolShell>
    )
  }

  if (hydrationError || !document) {
    return (
      <ToolShell className="bg-[#0c0a0e]">
        <ToolBody className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded-[1.6rem] border border-red-400/30 bg-red-500/10 p-8 text-center shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
            <h2 className="text-lg font-semibold text-white">Thumbnail Studio could not load</h2>
            <p className="mt-2 text-sm leading-6 text-white/70">{hydrationError || 'No active document available.'}</p>
          </div>
        </ToolBody>
      </ToolShell>
    )
  }

  const boardPreset = resolveBoardPreset(document.board)
  const visibleExternalAssets = externalAssets.filter((asset) => asset.key === externalAssetSource)

  return (
    <ToolShell className="bg-[#09070b]">
      <ToolHeader
        title="Thumbnail Studio"
        description="Layer-based thumbnail editing with brand kits, image imports, and AI variations."
        className="border-white/10 bg-[linear-gradient(180deg,rgba(16,13,19,0.98),rgba(10,8,12,0.94))]"
        actions={
          <div className="flex items-center gap-2">
            <Select value={activeDocumentId || undefined} onValueChange={setActiveDocumentId}>
              <SelectTrigger className="w-[14rem] border-white/10 bg-white/6 text-white">
                <SelectValue placeholder="Select document" />
              </SelectTrigger>
              <SelectContent>
                {documents.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" className="border-white/12 bg-white/6 text-white hover:bg-white/10" onClick={() => createDocument()}>
              <Plus className="mr-2 h-4 w-4" />
              New
            </Button>
            <Button type="button" variant="outline" className="border-white/12 bg-white/6 text-white hover:bg-white/10" onClick={() => duplicateDocument()}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </Button>
            <Button type="button" variant="outline" className="border-white/12 bg-white/6 text-white hover:bg-white/10" onClick={() => exportBoard('image/png')}>
              <Download className="mr-2 h-4 w-4" />
              PNG
            </Button>
            <Button type="button" variant="outline" className="border-white/12 bg-white/6 text-white hover:bg-white/10" onClick={() => exportBoard('image/jpeg')}>
              <Download className="mr-2 h-4 w-4" />
              JPEG
            </Button>
          </div>
        }
      />

      <ThumbnailStudioErrorBoundary>
        <ToolBody className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
          <ScrollArea className="min-h-[22rem] rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(22,18,27,0.96),rgba(12,10,16,0.98))]">
          <div className="space-y-6 p-5">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <ControlLabel>Document</ControlLabel>
                  <p className="mt-1 text-sm text-white/72">One board per thumbnail document.</p>
                </div>
                <Badge variant="secondary" className="border border-white/10 bg-white/8 text-white/80">
                  {document.board.width}x{document.board.height}
                </Badge>
              </div>
              <Input
                value={document.name}
                onChange={(event) => renameDocument(document.id, event.target.value)}
                className="border-white/10 bg-black/20 text-white placeholder:text-white/35"
              />
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="border-white/10 bg-white/6 text-white hover:bg-white/10" onClick={() => duplicateDocument()}>
                  <Copy className="mr-2 h-4 w-4" />
                  Variant
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-red-400/20 bg-red-500/8 text-white hover:bg-red-500/14"
                  disabled={documents.length <= 1}
                  onClick={() => deleteDocument(document.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <ControlLabel>Assets</ControlLabel>
                <p className="mt-1 text-sm text-white/72">Upload directly or import from Image Gen and Canvas Lab.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" className="bg-[#ffb15a] text-[#120f15] hover:bg-[#ffc17a]" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </Button>
                <Button type="button" variant="outline" className="border-white/10 bg-white/6 text-white hover:bg-white/10" onClick={() => setIsImportDialogOpen(true)}>
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Import
                </Button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLocalUpload} />
              <div className="grid grid-cols-2 gap-2">
                {localAssets.slice(0, 8).map((asset) => (
                  <div key={asset.id} className="overflow-hidden rounded-[1rem] border border-white/10 bg-black/18">
                    <div className="aspect-[4/3] bg-black/30">
                      <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="space-y-2 p-2.5">
                      <p className="line-clamp-1 text-xs font-medium text-white">{asset.name}</p>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" className="h-8 flex-1 bg-white/8 text-white hover:bg-white/14" onClick={() => addImageLayerFromAsset(asset.id)}>
                          Add
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="h-8 border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => addImageLayerFromAsset(asset.id, { asBackground: true })}>
                          BG
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-[#ffb15a]" />
                <ControlLabel>Brand Kit</ControlLabel>
              </div>
              <Select value={document.brandKitId} onValueChange={applyBrandKit}>
                <SelectTrigger className="border-white/10 bg-black/20 text-white">
                  <SelectValue placeholder="Brand kit" />
                </SelectTrigger>
                <SelectContent>
                  {brandKits.map((kit) => (
                    <SelectItem key={kit.id} value={kit.id}>
                      {kit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="space-y-2">
                <ControlLabel>Board background</ControlLabel>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={document.board.backgroundColor}
                    onChange={(event) => {
                      updateBoard({ backgroundColor: event.target.value })
                      updateBrandOverrides({ backgroundColor: event.target.value })
                    }}
                    className="h-10 w-12 rounded border border-white/10 bg-transparent"
                  />
                  <Input
                    value={document.board.backgroundColor}
                    onChange={(event) => {
                      updateBoard({ backgroundColor: event.target.value })
                      updateBrandOverrides({ backgroundColor: event.target.value })
                    }}
                    className="border-white/10 bg-black/20 text-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <ControlLabel>Font family</ControlLabel>
                <Input
                  value={effectiveBrandKit.fontFamily}
                  onChange={(event) => updateBrandOverrides({ fontFamily: event.target.value })}
                  className="border-white/10 bg-black/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <ControlLabel>Brand colors</ControlLabel>
                <div className="grid grid-cols-4 gap-2">
                  {effectiveBrandKit.brandColors.slice(0, 4).map((color, index) => (
                    <input
                      key={`${color}-${index}`}
                      type="color"
                      value={color}
                      onChange={(event) => {
                        const nextColors = [...effectiveBrandKit.brandColors]
                        nextColors[index] = event.target.value
                        updateBrandOverrides({ brandColors: nextColors })
                      }}
                      className="h-11 w-full rounded border border-white/10 bg-transparent"
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <ControlLabel>Text presets</ControlLabel>
                  <Button type="button" size="sm" variant="outline" className="h-8 border-white/10 bg-white/6 text-white hover:bg-white/10" onClick={() => addTextLayer(selectedPresetId || undefined)}>
                    <Type className="mr-2 h-4 w-4" />
                    Add text
                  </Button>
                </div>
                <div className="space-y-2">
                  {effectiveBrandKit.textStyles.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyTextPreset(preset.id)}
                      className={cn(
                        'w-full rounded-[1rem] border px-3 py-3 text-left transition',
                        selectedPresetId === preset.id ? 'border-[#ffb15a]/70 bg-[#ffb15a]/10' : 'border-white/10 bg-black/18 hover:bg-white/6',
                      )}
                    >
                      <p className="text-sm font-semibold text-white">{preset.name}</p>
                      <p className="mt-1 text-xs text-white/58">{preset.fontSize}px • {preset.align}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  value={brandKitDraftName}
                  onChange={(event) => setBrandKitDraftName(event.target.value)}
                  placeholder="Save current look as..."
                  className="border-white/10 bg-black/20 text-white placeholder:text-white/35"
                />
                <Button type="button" variant="outline" className="border-white/10 bg-white/6 text-white hover:bg-white/10" onClick={handleSaveBrandKit}>
                  Save
                </Button>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <WandSparkles className="h-4 w-4 text-[#ffb15a]" />
                <ControlLabel>AI Layer Edit</ControlLabel>
              </div>
              <p className="text-sm leading-6 text-white/68">
                {selectedLayer?.kind === 'image'
                  ? 'Selected image layer is ready for AI replacement or outpaint.'
                  : 'Select an image layer to use AI replace, remove background, or outpaint.'}
              </p>
              <Select value={aiModel} onValueChange={(value) => setAiModel(value as typeof aiModel)}>
                <SelectTrigger className="border-white/10 bg-black/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_GENERATION_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(aiCount)} onValueChange={(value) => setAiCount(Number(value) as 1 | 2 | 4)}>
                <SelectTrigger className="border-white/10 bg-black/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_COUNT_OPTIONS.map((count) => (
                    <SelectItem key={count} value={String(count)}>
                      {count} option{count === 1 ? '' : 's'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                placeholder="Describe the edit you want."
                className="min-h-28 border-white/10 bg-black/20 text-white placeholder:text-white/35"
              />
              <div className="grid grid-cols-1 gap-2">
                <Button type="button" className="bg-[#ffb15a] text-[#120f15] hover:bg-[#ffc17a]" disabled={selectedLayer?.kind !== 'image'} onClick={() => {
                  void runAiEdit('replace')
                }}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Run AI replace
                </Button>
                <Button type="button" variant="outline" className="border-white/10 bg-white/6 text-white hover:bg-white/10" disabled={selectedLayer?.kind !== 'image'} onClick={() => {
                  void runAiEdit('remove_background')
                }}>
                  AI remove background (best effort)
                </Button>
                <Button type="button" variant="outline" className="border-white/10 bg-white/6 text-white hover:bg-white/10" disabled={selectedLayer?.kind !== 'image' || !pendingOutpaint} onClick={() => {
                  void runAiEdit('outpaint')
                }}>
                  Run outpaint
                </Button>
              </div>
              {pendingOutpaint ? (
                <div className="rounded-[1rem] border border-[#ffb15a]/30 bg-[#ffb15a]/8 p-3 text-xs leading-5 text-white/72">
                  Pending expansion: top {Math.round(pendingOutpaint.top)}, right {Math.round(pendingOutpaint.right)}, bottom {Math.round(pendingOutpaint.bottom)}, left {Math.round(pendingOutpaint.left)}.
                </div>
              ) : null}
              {activeAiJob?.status === 'error' ? (
                <div className="rounded-[1rem] border border-red-400/25 bg-red-500/10 p-3 text-xs leading-5 text-white/72">
                  {activeAiJob.error}
                </div>
              ) : null}
            </section>
          </div>
          </ScrollArea>

          <div className="relative min-h-[32rem] overflow-hidden rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(16,13,19,0.96),rgba(10,8,12,0.96))]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" className={cn('h-9 rounded-full px-4', toolMode === 'move' ? 'bg-[#ffb15a] text-[#120f15] hover:bg-[#ffc17a]' : 'bg-white/6 text-white hover:bg-white/10')} onClick={() => setToolMode('move')}>
                Move (V)
              </Button>
              <Button type="button" size="sm" className={cn('h-9 rounded-full px-4', toolMode === 'transform' ? 'bg-[#ffb15a] text-[#120f15] hover:bg-[#ffc17a]' : 'bg-white/6 text-white hover:bg-white/10')} onClick={() => setToolMode('transform')}>
                Scale (K)
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="border border-white/10 bg-white/8 text-white/72">
                {boardPreset ? boardPreset.label : 'Custom size'}
              </Badge>
              <Badge variant="secondary" className="border border-white/10 bg-white/8 text-white/72">
                {toolMode === 'move' ? 'Move mode' : 'Transform mode'}
              </Badge>
            </div>
          </div>

          <div className="relative flex h-[calc(100%-3.75rem)] min-h-0 flex-col">
            <ThumbnailStage
              ref={stageRef}
              document={document}
              assetsById={assetsById}
              toolMode={toolMode}
              editingTextLayerId={editingTextLayerId}
              editingTextValue={editingTextValue}
              onEditingTextChange={setEditingTextValue}
              onEditingTextCommit={commitEditingText}
              onEditingTextCancel={() => setEditingTextLayerId(null)}
              onRequestTextEdit={startEditingText}
              onSelectLayer={selectLayer}
              onUpdateLayer={updateLayer}
              onRequestOutpaint={(layerId, outpaint) => {
                setPendingOutpaintByLayer((current) => ({
                  ...current,
                  [layerId]: outpaint,
                }))
                setAiPrompt(buildPromptTemplate('outpaint'))
              }}
            />

            {activeAiJob?.status === 'running' ? (
              <div className="pointer-events-none absolute bottom-4 right-4 rounded-full border border-white/12 bg-black/55 px-4 py-2 text-xs font-medium text-white/76 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur">
                Generating {activeAiJob.count} option{activeAiJob.count === 1 ? '' : 's'}...
              </div>
            ) : null}

            {activeAiJob?.status === 'complete' && candidateAssets.length > 0 ? (
              <div className="absolute bottom-4 right-4 z-20 w-[23rem] rounded-[1.3rem] border border-white/12 bg-[linear-gradient(180deg,rgba(20,17,24,0.98),rgba(12,10,16,0.98))] p-4 shadow-[0_22px_60px_rgba(0,0,0,0.46)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">AI options</p>
                    <p className="text-xs text-white/58">Choose one to replace the current layer.</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-white/64 hover:bg-white/8 hover:text-white" onClick={() => removeAiJob(activeAiJob.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {candidateAssets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => handleAcceptAiCandidate(asset.id)}
                      className="overflow-hidden rounded-[1rem] border border-white/10 bg-black/20 text-left transition hover:border-[#ffb15a]/55 hover:bg-white/6"
                    >
                      <div className="aspect-[4/3] bg-black/25">
                        <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" />
                      </div>
                      <div className="p-2 text-xs font-medium text-white">Use this</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          </div>

          <ScrollArea className="min-h-[22rem] rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(22,18,27,0.96),rgba(12,10,16,0.98))]">
          <div className="space-y-6 p-5">
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-[#ffb15a]" />
                <ControlLabel>Layers</ControlLabel>
              </div>
              <div className="space-y-2">
                {[...document.layers].reverse().map((layer) => (
                  <button
                    key={layer.id}
                    type="button"
                    onClick={() => selectLayer(layer.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[1rem] border px-3 py-3 text-left transition',
                      layer.id === document.selectedLayerId ? 'border-[#ffb15a]/60 bg-[#ffb15a]/10' : 'border-white/10 bg-black/18 hover:bg-white/6',
                    )}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-[0.9rem] bg-white/8 text-white/72">
                      {layer.kind === 'text' ? <Type className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{layer.name}</p>
                      <p className="text-xs text-white/56">{layer.kind}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-white/58 hover:bg-white/8 hover:text-white" onClick={(event) => {
                        event.stopPropagation()
                        toggleLayerHidden(layer.id)
                      }}>
                        {layer.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-white/58 hover:bg-white/8 hover:text-white" onClick={(event) => {
                        event.stopPropagation()
                        toggleLayerLock(layer.id)
                      }}>
                        {layer.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      </Button>
                    </div>
                  </button>
                ))}
              </div>
              {selectedLayer ? (
                <div className="grid grid-cols-4 gap-2">
                  <Button type="button" variant="outline" className="border-white/10 bg-white/6 text-white hover:bg-white/10" onClick={() => moveLayer(selectedLayer.id, 'up')}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" className="border-white/10 bg-white/6 text-white hover:bg-white/10" onClick={() => moveLayer(selectedLayer.id, 'down')}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" className="border-white/10 bg-white/6 text-white hover:bg-white/10" onClick={() => duplicateLayer(selectedLayer.id)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" className="border-red-400/20 bg-red-500/8 text-white hover:bg-red-500/14" disabled={selectedLayer.kind === 'background'} onClick={() => removeLayer(selectedLayer.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </section>

            <section className="space-y-3">
              <ControlLabel>Board settings</ControlLabel>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  value={document.board.width}
                  onChange={(event) => updateBoard({ width: Number(event.target.value) || document.board.width })}
                  className="border-white/10 bg-black/20 text-white"
                />
                <Input
                  type="number"
                  value={document.board.height}
                  onChange={(event) => updateBoard({ height: Number(event.target.value) || document.board.height })}
                  className="border-white/10 bg-black/20 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {THUMBNAIL_BOARD_PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    variant="outline"
                    className={cn(
                      'border-white/10 bg-white/6 text-white hover:bg-white/10',
                      boardPreset?.id === preset.id && 'border-[#ffb15a]/55 bg-[#ffb15a]/10',
                    )}
                    onClick={() => updateBoard({ width: preset.width, height: preset.height })}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <ControlLabel>Inspector</ControlLabel>
              {!selectedLayer ? (
                <div className="rounded-[1rem] border border-white/10 bg-black/18 p-4 text-sm leading-6 text-white/62">
                  Select a layer to edit its properties. Double-click a text layer on the board to edit copy inline.
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    value={selectedLayer.name}
                    onChange={(event) => updateLayer(selectedLayer.id, (layer) => ({
                      ...layer,
                      name: event.target.value,
                    }))}
                    className="border-white/10 bg-black/20 text-white"
                  />

                  {(selectedLayer.kind === 'image' || selectedLayer.kind === 'background') ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          value={Math.round(selectedLayer.x)}
                          onChange={(event) => updateLayer(selectedLayer.id, (layer) => ({
                            ...layer,
                            x: Number(event.target.value) || 0,
                          }))}
                          className="border-white/10 bg-black/20 text-white"
                        />
                        <Input
                          type="number"
                          value={Math.round(selectedLayer.y)}
                          onChange={(event) => updateLayer(selectedLayer.id, (layer) => ({
                            ...layer,
                            y: Number(event.target.value) || 0,
                          }))}
                          className="border-white/10 bg-black/20 text-white"
                        />
                        <Input
                          type="number"
                          value={Math.round(selectedLayer.width)}
                          onChange={(event) => updateLayer(selectedLayer.id, (layer) => {
                            if (layer.kind !== 'image' && layer.kind !== 'background') {
                              return layer
                            }

                            const nextWidth = Number(event.target.value) || layer.width
                            return {
                              ...layer,
                              width: nextWidth,
                              contentWidth: nextWidth,
                              contentOffsetX: 0,
                            }
                          })}
                          className="border-white/10 bg-black/20 text-white"
                        />
                        <Input
                          type="number"
                          value={Math.round(selectedLayer.height)}
                          onChange={(event) => updateLayer(selectedLayer.id, (layer) => {
                            if (layer.kind !== 'image' && layer.kind !== 'background') {
                              return layer
                            }

                            const nextHeight = Number(event.target.value) || layer.height
                            return {
                              ...layer,
                              height: nextHeight,
                              contentHeight: nextHeight,
                              contentOffsetY: 0,
                            }
                          })}
                          className="border-white/10 bg-black/20 text-white"
                        />
                      </div>
                      {selectedAsset ? (
                        <div className="overflow-hidden rounded-[1rem] border border-white/10 bg-black/18">
                          <div className="aspect-[16/10] bg-black/25">
                            <img src={selectedAsset.url} alt={selectedAsset.name} className="h-full w-full object-cover" />
                          </div>
                          <div className="p-3 text-xs text-white/62">
                            Current asset: {selectedAsset.name}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-[1rem] border border-dashed border-white/12 bg-black/18 p-4 text-sm text-white/56">
                          No image assigned yet.
                        </div>
                      )}
                    </>
                  ) : null}

                  {selectedLayer.kind === 'text' ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          value={Math.round(selectedLayer.style.fontSize)}
                          onChange={(event) => updateLayer(selectedLayer.id, (layer) => {
                            if (layer.kind !== 'text') return layer
                            return {
                              ...layer,
                              style: {
                                ...layer.style,
                                fontSize: Number(event.target.value) || layer.style.fontSize,
                              },
                            }
                          })}
                          className="border-white/10 bg-black/20 text-white"
                        />
                        <Input
                          type="number"
                          value={Math.round(selectedLayer.style.fontWeight)}
                          onChange={(event) => updateLayer(selectedLayer.id, (layer) => {
                            if (layer.kind !== 'text') return layer
                            return {
                              ...layer,
                              style: {
                                ...layer.style,
                                fontWeight: Number(event.target.value) || layer.style.fontWeight,
                              },
                            }
                          })}
                          className="border-white/10 bg-black/20 text-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="color"
                          value={selectedLayer.style.color}
                          onChange={(event) => updateLayer(selectedLayer.id, (layer) => {
                            if (layer.kind !== 'text') return layer
                            return {
                              ...layer,
                              style: {
                                ...layer.style,
                                color: event.target.value,
                              },
                            }
                          })}
                          className="h-11 rounded border border-white/10 bg-transparent"
                        />
                        <Input
                          type="number"
                          value={selectedLayer.style.strokeWidth || 0}
                          onChange={(event) => updateLayer(selectedLayer.id, (layer) => {
                            if (layer.kind !== 'text') return layer
                            return {
                              ...layer,
                              style: {
                                ...layer.style,
                                strokeWidth: Number(event.target.value) || 0,
                              },
                            }
                          })}
                          className="border-white/10 bg-black/20 text-white"
                        />
                      </div>
                      <Select value={selectedLayer.style.align} onValueChange={(value) => updateLayer(selectedLayer.id, (layer) => {
                        if (layer.kind !== 'text') return layer
                        return {
                          ...layer,
                          style: {
                            ...layer.style,
                            align: value as ThumbnailTextLayer['style']['align'],
                          },
                        }
                      })}>
                        <SelectTrigger className="border-white/10 bg-black/20 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="center">Center</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" className="border-white/10 bg-white/6 text-white hover:bg-white/10" onClick={() => startEditingText(selectedLayer.id)}>
                        Edit copy inline
                      </Button>
                    </>
                  ) : null}
                </div>
              )}
            </section>
          </div>
          </ScrollArea>
        </ToolBody>
      </ThumbnailStudioErrorBoundary>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-4xl border-white/10 bg-[#0f0c13] text-white">
          <DialogHeader>
            <DialogTitle>Import existing assets</DialogTitle>
            <DialogDescription className="text-white/58">
              Copy assets from the app&apos;s reusable image library, generated image results, or Canvas Lab.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            {(['library', 'results', 'canvas'] as ExternalAssetSource[]).map((source) => (
              <Button
                key={source}
                type="button"
                variant="outline"
                className={cn(
                  'border-white/10 bg-white/6 text-white hover:bg-white/10',
                  externalAssetSource === source && 'border-[#ffb15a]/55 bg-[#ffb15a]/10',
                )}
                onClick={() => setExternalAssetSource(source)}
              >
                {sourceLabel(source)}
              </Button>
            ))}
          </div>

          <ScrollArea className="h-[28rem] pr-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleExternalAssets.map((asset) => (
                <div key={`${asset.key}-${asset.id}`} className="overflow-hidden rounded-[1.1rem] border border-white/10 bg-black/18">
                  <div className="aspect-[4/3] bg-black/25">
                    <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="space-y-2 p-3">
                    <p className="line-clamp-1 text-sm font-semibold text-white">{asset.name}</p>
                    <div className="flex gap-2">
                      <Button type="button" className="flex-1 bg-[#ffb15a] text-[#120f15] hover:bg-[#ffc17a]" onClick={() => void importExternalEntry(asset)}>
                        Add
                      </Button>
                      <Button type="button" variant="outline" className="border-white/10 bg-white/6 text-white hover:bg-white/10" onClick={() => void importExternalEntry(asset, true)}>
                        BG
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </ToolShell>
  )
}
