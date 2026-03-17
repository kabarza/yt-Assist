import { create } from 'zustand'
import { generateId } from '@/types/chat'
import type {
  ThumbnailAiJob,
  ThumbnailAsset,
  ThumbnailBackgroundLayer,
  ThumbnailBrandKit,
  ThumbnailBrandOverrides,
  ThumbnailDocument,
  ThumbnailEditorSnapshot,
  ThumbnailImageLayer,
  ThumbnailLayer,
  ThumbnailTextLayer,
  ThumbnailTextStylePreset,
  ThumbnailToolMode,
  StoredThumbnailAsset,
} from '@/types/thumbnailEditor'
import { THUMBNAIL_EDITOR_SNAPSHOT_VERSION } from '@/types/thumbnailEditor'
import {
  loadThumbnailEditorPersistence,
  materializeThumbnailAsset,
  putThumbnailAssets,
  revokeThumbnailAssetUrls,
  saveThumbnailEditorSnapshot,
} from '@/utils/thumbnailEditorPersistence'

const DEFAULT_FONT_FAMILY = '"IBM Plex Sans", "IBM Plex Sans Hebrew", system-ui, sans-serif'

const DEFAULT_TEXT_PRESETS: ThumbnailTextStylePreset[] = [
  {
    id: 'impact-headline',
    name: 'Impact Headline',
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: 104,
    fontWeight: 700,
    color: '#fff7e8',
    align: 'center',
    letterSpacing: -1.4,
    lineHeight: 0.94,
    strokeColor: '#120f15',
    strokeWidth: 10,
    shadowColor: 'rgba(8, 6, 9, 0.6)',
    shadowBlur: 26,
  },
  {
    id: 'side-kicker',
    name: 'Side Kicker',
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: 60,
    fontWeight: 600,
    color: '#ffd47c',
    align: 'left',
    letterSpacing: -0.4,
    lineHeight: 0.98,
    strokeColor: '#120f15',
    strokeWidth: 8,
    shadowColor: 'rgba(8, 6, 9, 0.42)',
    shadowBlur: 18,
  },
]

const DEFAULT_BRAND_KIT: ThumbnailBrandKit = {
  id: 'default-brand-kit',
  name: 'Studio Core',
  fontFamily: DEFAULT_FONT_FAMILY,
  themeName: 'Cinder Signal',
  backgroundColor: '#120f15',
  brandColors: ['#fff7e8', '#ffb15a', '#ff6f61', '#2ad1c9'],
  textStyles: DEFAULT_TEXT_PRESETS,
}

interface ThumbnailEditorStore {
  isHydrated: boolean
  isHydrating: boolean
  hydrationError: string | null
  documents: ThumbnailDocument[]
  activeDocumentId: string | null
  assetsById: Record<string, ThumbnailAsset>
  brandKits: ThumbnailBrandKit[]
  toolMode: ThumbnailToolMode
  aiJobs: ThumbnailAiJob[]
  activeAiJobId: string | null
  hydrate: () => Promise<void>
  setToolMode: (mode: ThumbnailToolMode) => void
  createDocument: (name?: string) => void
  duplicateDocument: (documentId?: string) => void
  renameDocument: (documentId: string, name: string) => void
  deleteDocument: (documentId: string) => void
  setActiveDocumentId: (documentId: string | null) => void
  updateBoard: (patch: Partial<ThumbnailDocument['board']>) => void
  importAsset: (input: {
    blob: Blob
    mimeType: string
    name?: string
    source: StoredThumbnailAsset['source']
    width?: number
    height?: number
  }) => Promise<string>
  addImageLayerFromAsset: (assetId: string, options?: { asBackground?: boolean }) => void
  addTextLayer: (presetId?: string) => void
  selectLayer: (layerId: string | null) => void
  updateLayer: (layerId: string, updater: (layer: ThumbnailLayer) => ThumbnailLayer) => void
  moveLayer: (layerId: string, direction: 'up' | 'down') => void
  duplicateLayer: (layerId: string) => void
  removeLayer: (layerId: string) => void
  toggleLayerLock: (layerId: string) => void
  toggleLayerHidden: (layerId: string) => void
  replaceLayerAsset: (layerId: string, assetId: string, resetBounds?: boolean) => void
  applyBrandKit: (brandKitId: string) => void
  updateBrandOverrides: (patch: Partial<ThumbnailBrandOverrides>) => void
  createBrandKitFromCurrent: (name: string) => string | null
  updateBrandKit: (brandKitId: string, updater: (kit: ThumbnailBrandKit) => ThumbnailBrandKit) => void
  upsertAiJob: (job: ThumbnailAiJob) => void
  removeAiJob: (jobId: string) => void
  setActiveAiJobId: (jobId: string | null) => void
}

let hydratePromise: Promise<void> | null = null
let persistTimeout: ReturnType<typeof setTimeout> | null = null

function buildSnapshot(state: Pick<ThumbnailEditorStore, 'documents' | 'activeDocumentId' | 'brandKits'>): ThumbnailEditorSnapshot {
  return {
    version: THUMBNAIL_EDITOR_SNAPSHOT_VERSION,
    documents: state.documents,
    activeDocumentId: state.activeDocumentId,
    brandKits: state.brandKits,
  }
}

function schedulePersist(state: Pick<ThumbnailEditorStore, 'documents' | 'activeDocumentId' | 'brandKits'>) {
  if (persistTimeout) {
    clearTimeout(persistTimeout)
  }

  persistTimeout = setTimeout(() => {
    persistTimeout = null
    void saveThumbnailEditorSnapshot(buildSnapshot(state))
  }, 180)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function createBackgroundLayer(board: ThumbnailDocument['board']): ThumbnailBackgroundLayer {
  const now = Date.now()
  return {
    id: generateId(),
    kind: 'background',
    name: 'Background',
    x: 0,
    y: 0,
    width: board.width,
    height: board.height,
    hidden: false,
    locked: false,
    opacity: 1,
    createdAt: now,
    updatedAt: now,
    assetId: null,
    fit: 'cover',
    contentOffsetX: 0,
    contentOffsetY: 0,
    contentWidth: board.width,
    contentHeight: board.height,
  }
}

function createDefaultDocument(brandKit: ThumbnailBrandKit, name = 'Thumbnail Draft'): ThumbnailDocument {
  const now = Date.now()
  const board = {
    width: 1280,
    height: 720,
    backgroundColor: brandKit.backgroundColor,
  }

  return {
    id: generateId(),
    name,
    board,
    brandKitId: brandKit.id,
    brandOverrides: {},
    layers: [createBackgroundLayer(board)],
    selectedLayerId: null,
    createdAt: now,
    updatedAt: now,
  }
}

function getActiveDocument(state: Pick<ThumbnailEditorStore, 'documents' | 'activeDocumentId'>) {
  if (!state.activeDocumentId) return null
  return state.documents.find((document) => document.id === state.activeDocumentId) || null
}

function replaceDocument(documents: ThumbnailDocument[], nextDocument: ThumbnailDocument) {
  return documents.map((document) => (document.id === nextDocument.id ? nextDocument : document))
}

function getEffectiveBrandKit(document: ThumbnailDocument, brandKits: ThumbnailBrandKit[]) {
  const baseKit = brandKits.find((kit) => kit.id === document.brandKitId) || DEFAULT_BRAND_KIT
  return {
    ...baseKit,
    ...(document.brandOverrides.fontFamily ? { fontFamily: document.brandOverrides.fontFamily } : {}),
    ...(document.brandOverrides.backgroundColor ? { backgroundColor: document.brandOverrides.backgroundColor } : {}),
    ...(document.brandOverrides.brandColors ? { brandColors: document.brandOverrides.brandColors } : {}),
    ...(document.brandOverrides.textStyles ? { textStyles: document.brandOverrides.textStyles } : {}),
  }
}

function fitAssetToBoard(
  board: ThumbnailDocument['board'],
  asset?: Pick<ThumbnailAsset, 'width' | 'height'>,
) {
  const maxWidth = board.width * 0.56
  const maxHeight = board.height * 0.56

  if (asset?.width && asset?.height) {
    const ratio = asset.width / asset.height
    let width = asset.width
    let height = asset.height

    if (width > maxWidth) {
      width = maxWidth
      height = width / ratio
    }

    if (height > maxHeight) {
      height = maxHeight
      width = height * ratio
    }

    return { width, height }
  }

  return {
    width: maxWidth,
    height: Math.min(maxHeight, maxWidth * 0.72),
  }
}

export const useThumbnailEditorStore = create<ThumbnailEditorStore>((set, get) => ({
  isHydrated: false,
  isHydrating: false,
  hydrationError: null,
  documents: [],
  activeDocumentId: null,
  assetsById: {},
  brandKits: [DEFAULT_BRAND_KIT],
  toolMode: 'move',
  aiJobs: [],
  activeAiJobId: null,

  hydrate: async () => {
    if (get().isHydrated) return
    if (hydratePromise) return hydratePromise

    set({ isHydrating: true, hydrationError: null })

    hydratePromise = (async () => {
      try {
        const { snapshot, assets } = await loadThumbnailEditorPersistence()
        const materializedAssets = Object.fromEntries(
          assets.map((asset) => {
            const materialized = materializeThumbnailAsset(asset)
            return [materialized.id, materialized] as const
          }),
        )

        const brandKits = snapshot?.brandKits?.length ? snapshot.brandKits : [DEFAULT_BRAND_KIT]
        const documents = snapshot?.documents?.length
          ? snapshot.documents
          : [createDefaultDocument(brandKits[0])]
        const activeDocumentId =
          snapshot?.activeDocumentId && documents.some((document) => document.id === snapshot.activeDocumentId)
            ? snapshot.activeDocumentId
            : documents[0]?.id || null

        set({
          isHydrated: true,
          isHydrating: false,
          documents,
          activeDocumentId,
          assetsById: materializedAssets,
          brandKits,
        })

        if (!snapshot) {
          await saveThumbnailEditorSnapshot({
            version: THUMBNAIL_EDITOR_SNAPSHOT_VERSION,
            documents,
            activeDocumentId,
            brandKits,
          })
        }
      } catch (error) {
        set({
          isHydrated: true,
          isHydrating: false,
          hydrationError: error instanceof Error ? error.message : 'Failed to load Thumbnail Studio',
        })
      } finally {
        hydratePromise = null
      }
    })()

    return hydratePromise
  },

  setToolMode: (mode) => set({ toolMode: mode }),

  createDocument: (name) => {
    const brandKit = get().brandKits[0] || DEFAULT_BRAND_KIT
    const document = createDefaultDocument(brandKit, name?.trim() || `Thumbnail ${get().documents.length + 1}`)

    set((state) => ({
      documents: [...state.documents, document],
      activeDocumentId: document.id,
    }))

    schedulePersist(get())
  },

  duplicateDocument: (documentId) => {
    const state = get()
    const source = documentId
      ? state.documents.find((document) => document.id === documentId)
      : getActiveDocument(state)
    if (!source) return

    const now = Date.now()
    const duplicate: ThumbnailDocument = {
      ...source,
      id: generateId(),
      name: `${source.name} Copy`,
      selectedLayerId: null,
      createdAt: now,
      updatedAt: now,
      layers: source.layers.map((layer) => ({
        ...layer,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      })),
    }

    set((currentState) => ({
      documents: [...currentState.documents, duplicate],
      activeDocumentId: duplicate.id,
    }))

    schedulePersist(get())
  },

  renameDocument: (documentId, name) => {
    const trimmed = name.trim()
    if (!trimmed) return

    set((state) => ({
      documents: state.documents.map((document) =>
        document.id === documentId
          ? {
              ...document,
              name: trimmed,
              updatedAt: Date.now(),
            }
          : document,
      ),
    }))

    schedulePersist(get())
  },

  deleteDocument: (documentId) => {
    const state = get()
    if (state.documents.length <= 1) return

    const nextDocuments = state.documents.filter((document) => document.id !== documentId)
    set({
      documents: nextDocuments,
      activeDocumentId: state.activeDocumentId === documentId ? nextDocuments[0]?.id || null : state.activeDocumentId,
    })

    schedulePersist(get())
  },

  setActiveDocumentId: (documentId) => {
    set({ activeDocumentId: documentId })
    schedulePersist(get())
  },

  updateBoard: (patch) => {
    const activeDocument = getActiveDocument(get())
    if (!activeDocument) return

    const nextBoard = {
      ...activeDocument.board,
      ...patch,
    }

    const nextDocument: ThumbnailDocument = {
      ...activeDocument,
      board: nextBoard,
      updatedAt: Date.now(),
      layers: activeDocument.layers.map((layer) =>
        layer.kind === 'background'
          ? {
              ...layer,
              x: 0,
              y: 0,
              width: nextBoard.width,
              height: nextBoard.height,
              contentOffsetX: 0,
              contentOffsetY: 0,
              contentWidth: nextBoard.width,
              contentHeight: nextBoard.height,
              updatedAt: Date.now(),
            }
          : {
              ...layer,
              x: clamp(layer.x, 0, Math.max(0, nextBoard.width - 40)),
              y: clamp(layer.y, 0, Math.max(0, nextBoard.height - 40)),
            },
      ),
    }

    set((state) => ({
      documents: replaceDocument(state.documents, nextDocument),
    }))

    schedulePersist(get())
  },

  importAsset: async ({ blob, mimeType, name, source, width, height }) => {
    const assetId = generateId()
    const storedAsset: StoredThumbnailAsset = {
      id: assetId,
      name: name?.trim() || 'Imported image',
      mimeType,
      createdAt: Date.now(),
      source,
      blob,
      width,
      height,
    }

    await putThumbnailAssets([storedAsset])

    set((state) => ({
      assetsById: {
        ...state.assetsById,
        [assetId]: materializeThumbnailAsset(storedAsset),
      },
    }))

    return assetId
  },

  addImageLayerFromAsset: (assetId, options) => {
    const state = get()
    const activeDocument = getActiveDocument(state)
    const asset = state.assetsById[assetId]
    if (!activeDocument || !asset) return

    if (options?.asBackground) {
      const nextDocument: ThumbnailDocument = {
        ...activeDocument,
        updatedAt: Date.now(),
        selectedLayerId: activeDocument.layers.find((layer) => layer.kind === 'background')?.id || null,
        layers: activeDocument.layers.map((layer) =>
          layer.kind === 'background'
            ? {
                ...layer,
                assetId,
                opacity: 1,
                contentOffsetX: 0,
                contentOffsetY: 0,
                contentWidth: activeDocument.board.width,
                contentHeight: activeDocument.board.height,
                updatedAt: Date.now(),
              }
            : layer,
        ),
      }

      set((currentState) => ({
        documents: replaceDocument(currentState.documents, nextDocument),
      }))
      schedulePersist(get())
      return
    }

    const size = fitAssetToBoard(activeDocument.board, asset)
    const now = Date.now()
    const layer: ThumbnailImageLayer = {
      id: generateId(),
      kind: 'image',
      name: asset.name,
      x: (activeDocument.board.width - size.width) / 2,
      y: (activeDocument.board.height - size.height) / 2,
      width: size.width,
      height: size.height,
      hidden: false,
      locked: false,
      opacity: 1,
      createdAt: now,
      updatedAt: now,
      assetId,
      fit: 'cover',
      contentOffsetX: 0,
      contentOffsetY: 0,
      contentWidth: size.width,
      contentHeight: size.height,
    }

    const nextDocument: ThumbnailDocument = {
      ...activeDocument,
      selectedLayerId: layer.id,
      updatedAt: now,
      layers: [...activeDocument.layers, layer],
    }

    set((currentState) => ({
      documents: replaceDocument(currentState.documents, nextDocument),
    }))
    schedulePersist(get())
  },

  addTextLayer: (presetId) => {
    const state = get()
    const activeDocument = getActiveDocument(state)
    if (!activeDocument) return

    const brandKit = getEffectiveBrandKit(activeDocument, state.brandKits)
    const preset = brandKit.textStyles.find((entry) => entry.id === presetId) || brandKit.textStyles[0] || DEFAULT_TEXT_PRESETS[0]
    const now = Date.now()
    const layer: ThumbnailTextLayer = {
      id: generateId(),
      kind: 'text',
      name: 'Headline',
      x: activeDocument.board.width * 0.12,
      y: activeDocument.board.height * 0.12,
      width: activeDocument.board.width * 0.76,
      height: preset.fontSize * 1.8,
      hidden: false,
      locked: false,
      opacity: 1,
      createdAt: now,
      updatedAt: now,
      text: 'Your headline',
      style: {
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

    const nextDocument: ThumbnailDocument = {
      ...activeDocument,
      selectedLayerId: layer.id,
      updatedAt: now,
      layers: [...activeDocument.layers, layer],
    }

    set((currentState) => ({
      documents: replaceDocument(currentState.documents, nextDocument),
    }))
    schedulePersist(get())
  },

  selectLayer: (layerId) => {
    const activeDocument = getActiveDocument(get())
    if (!activeDocument) return

    set((state) => ({
      documents: replaceDocument(state.documents, {
        ...activeDocument,
        selectedLayerId: layerId,
      }),
    }))

    schedulePersist(get())
  },

  updateLayer: (layerId, updater) => {
    const activeDocument = getActiveDocument(get())
    if (!activeDocument) return

    const now = Date.now()
    const nextDocument: ThumbnailDocument = {
      ...activeDocument,
      updatedAt: now,
      layers: activeDocument.layers.map((layer) =>
        layer.id === layerId
          ? {
              ...updater(layer),
              updatedAt: now,
            }
          : layer,
      ),
    }

    set((state) => ({
      documents: replaceDocument(state.documents, nextDocument),
    }))

    schedulePersist(get())
  },

  moveLayer: (layerId, direction) => {
    const activeDocument = getActiveDocument(get())
    if (!activeDocument) return

    const index = activeDocument.layers.findIndex((layer) => layer.id === layerId)
    if (index < 0) return

    const nextIndex = direction === 'up' ? Math.min(activeDocument.layers.length - 1, index + 1) : Math.max(0, index - 1)
    if (index === nextIndex) return

    const nextLayers = [...activeDocument.layers]
    const [layer] = nextLayers.splice(index, 1)
    nextLayers.splice(nextIndex, 0, layer)

    set((state) => ({
      documents: replaceDocument(state.documents, {
        ...activeDocument,
        layers: nextLayers,
        updatedAt: Date.now(),
      }),
    }))

    schedulePersist(get())
  },

  duplicateLayer: (layerId) => {
    const activeDocument = getActiveDocument(get())
    if (!activeDocument) return

    const layer = activeDocument.layers.find((entry) => entry.id === layerId)
    if (!layer) return

    const now = Date.now()
    const duplicate: ThumbnailLayer = {
      ...layer,
      id: generateId(),
      name: `${layer.name} Copy`,
      x: clamp(layer.x + 24, 0, Math.max(0, activeDocument.board.width - layer.width)),
      y: clamp(layer.y + 24, 0, Math.max(0, activeDocument.board.height - layer.height)),
      createdAt: now,
      updatedAt: now,
    }

    set((state) => ({
      documents: replaceDocument(state.documents, {
        ...activeDocument,
        layers: [...activeDocument.layers, duplicate],
        selectedLayerId: duplicate.id,
        updatedAt: now,
      }),
    }))

    schedulePersist(get())
  },

  removeLayer: (layerId) => {
    const activeDocument = getActiveDocument(get())
    if (!activeDocument) return

    const layer = activeDocument.layers.find((entry) => entry.id === layerId)
    if (!layer || layer.kind === 'background') return

    const nextLayers = activeDocument.layers.filter((entry) => entry.id !== layerId)
    set((state) => ({
      documents: replaceDocument(state.documents, {
        ...activeDocument,
        layers: nextLayers,
        selectedLayerId: activeDocument.selectedLayerId === layerId ? null : activeDocument.selectedLayerId,
        updatedAt: Date.now(),
      }),
    }))

    schedulePersist(get())
  },

  toggleLayerLock: (layerId) => {
    get().updateLayer(layerId, (layer) => ({
      ...layer,
      locked: !layer.locked,
    }))
  },

  toggleLayerHidden: (layerId) => {
    get().updateLayer(layerId, (layer) => ({
      ...layer,
      hidden: !layer.hidden,
    }))
  },

  replaceLayerAsset: (layerId, assetId, resetBounds = true) => {
    const state = get()
    const activeDocument = getActiveDocument(state)
    const asset = state.assetsById[assetId]
    if (!activeDocument || !asset) return

    get().updateLayer(layerId, (layer) => {
      if (layer.kind !== 'image' && layer.kind !== 'background') {
        return layer
      }

      return {
        ...layer,
        assetId,
        ...(resetBounds
          ? {
              contentOffsetX: 0,
              contentOffsetY: 0,
              contentWidth: layer.width,
              contentHeight: layer.height,
            }
          : {}),
        name: layer.kind === 'background' ? layer.name : asset.name,
      }
    })
  },

  applyBrandKit: (brandKitId) => {
    const activeDocument = getActiveDocument(get())
    if (!activeDocument) return

    const nextDocument: ThumbnailDocument = {
      ...activeDocument,
      brandKitId,
      updatedAt: Date.now(),
    }

    set((state) => ({
      documents: replaceDocument(state.documents, nextDocument),
    }))

    schedulePersist(get())
  },

  updateBrandOverrides: (patch) => {
    const activeDocument = getActiveDocument(get())
    if (!activeDocument) return

    set((state) => ({
      documents: replaceDocument(state.documents, {
        ...activeDocument,
        brandOverrides: {
          ...activeDocument.brandOverrides,
          ...patch,
        },
        updatedAt: Date.now(),
      }),
    }))

    schedulePersist(get())
  },

  createBrandKitFromCurrent: (name) => {
    const activeDocument = getActiveDocument(get())
    if (!activeDocument || !name.trim()) return null

    const effective = getEffectiveBrandKit(activeDocument, get().brandKits)
    const brandKit: ThumbnailBrandKit = {
      ...effective,
      id: generateId(),
      name: name.trim(),
    }

    set((state) => ({
      brandKits: [...state.brandKits, brandKit],
    }))

    schedulePersist(get())
    return brandKit.id
  },

  updateBrandKit: (brandKitId, updater) => {
    set((state) => ({
      brandKits: state.brandKits.map((kit) => (kit.id === brandKitId ? updater(kit) : kit)),
    }))

    schedulePersist(get())
  },

  upsertAiJob: (job) => {
    set((state) => ({
      aiJobs: state.aiJobs.some((entry) => entry.id === job.id)
        ? state.aiJobs.map((entry) => (entry.id === job.id ? job : entry))
        : [...state.aiJobs, job],
      activeAiJobId: job.id,
    }))
  },

  removeAiJob: (jobId) => {
    set((state) => ({
      aiJobs: state.aiJobs.filter((job) => job.id !== jobId),
      activeAiJobId: state.activeAiJobId === jobId ? null : state.activeAiJobId,
    }))
  },

  setActiveAiJobId: (jobId) => set({ activeAiJobId: jobId }),
}))

export function useActiveThumbnailDocument() {
  return useThumbnailEditorStore((state) => getActiveDocument(state))
}

export function useSelectedThumbnailLayer() {
  return useThumbnailEditorStore((state) => {
    const document = getActiveDocument(state)
    if (!document?.selectedLayerId) return null
    return document.layers.find((layer) => layer.id === document.selectedLayerId) || null
  })
}

export function useEffectiveThumbnailBrandKit() {
  return useThumbnailEditorStore((state) => {
    const document = getActiveDocument(state)
    if (!document) return DEFAULT_BRAND_KIT
    return getEffectiveBrandKit(document, state.brandKits)
  })
}

export function cleanupThumbnailAssetUrls() {
  revokeThumbnailAssetUrls(useThumbnailEditorStore.getState().assetsById)
}
