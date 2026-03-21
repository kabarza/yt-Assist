import { create } from 'zustand'
import { generateId } from '../types/chat'
import type { DrawingData } from '../types/canvas'
import type {
  ImageAsset,
  ImageAspectRatio,
  ImageDraft,
  ImageGenerationModel,
  ImagePipeline,
  ImageSize,
  ImageThreadSnapshot,
  ImageTurn,
  ImageViewMode,
  StoredImageAsset,
} from '../types/images'
import {
  DEFAULT_IMAGE_GRID_COLUMNS,
  DEFAULT_IMAGE_DRAFT,
  IMAGE_THREAD_SNAPSHOT_VERSION,
  MAX_IMAGE_REFERENCE_COUNT,
  normalizeImageGridColumns,
  normalizeImageViewMode,
} from '../types/images'
import {
  deleteImageGenerationAssets,
  loadImageGenerationPersistence,
  putImageGenerationAssets,
  saveImageGenerationSnapshot,
} from '../utils/imageGenerationPersistence'

const INTERRUPTED_QUEUE_MESSAGE = 'Generation interrupted by reload. Resume the queue to continue.'

interface ImageGenerationStore {
  isHydrated: boolean
  isHydrating: boolean
  hydrationError: string | null
  turns: ImageTurn[]
  assetsById: Record<string, ImageAsset>
  pipelines: ImagePipeline[]
  draft: ImageDraft
  composerDrawingData: DrawingData | null
  viewMode: ImageViewMode
  gridColumns: number
  queuePaused: boolean
  hydrate: () => Promise<void>
  setDraftPrompt: (prompt: string) => Promise<void>
  setDraftModel: (model: ImageGenerationModel) => Promise<void>
  setDraftCount: (count: number) => Promise<void>
  setDraftAspectRatio: (aspectRatio: ImageAspectRatio) => Promise<void>
  setDraftImageSize: (imageSize: ImageSize) => Promise<void>
  setComposerDrawingData: (drawingData: DrawingData | null) => Promise<void>
  clearComposerDrawingData: () => Promise<void>
  resetDraft: () => Promise<void>
  addDraftReference: (input: { blob: Blob; mimeType: string; name?: string }) => Promise<string>
  addDraftReferenceIds: (assetIds: string[]) => Promise<void>
  addReusableAsset: (input: { blob: Blob; mimeType: string; name?: string }) => Promise<string>
  renameAsset: (assetId: string, name: string) => Promise<void>
  deleteReusableAsset: (assetId: string) => Promise<void>
  removeDraftReference: (assetId: string) => Promise<void>
  clearDraftReferences: () => Promise<void>
  savePipeline: (name: string) => Promise<string | null>
  updatePipeline: (pipelineId: string) => Promise<void>
  applyPipeline: (pipelineId: string) => Promise<void>
  deletePipeline: (pipelineId: string) => Promise<void>
  enqueueDraft: () => Promise<string | null>
  pauseQueue: () => Promise<void>
  resumeQueue: () => Promise<void>
  setViewMode: (viewMode: ImageViewMode) => Promise<void>
  setGridColumns: (gridColumns: number) => Promise<void>
  markTurnRunning: (turnId: string) => Promise<void>
  completeTurn: (
    turnId: string,
    payload: {
      images: Array<{ blob: Blob; mimeType: string }>
      responseText?: string
      warnings?: string[]
    }
  ) => Promise<void>
  failTurn: (turnId: string, error: string, warnings?: string[]) => Promise<void>
  cancelTurn: (turnId: string, error?: string) => Promise<void>
  removeTurn: (turnId: string) => Promise<void>
  retryTurn: (turnId: string) => Promise<void>
  prefillFromTurn: (turnId: string) => Promise<void>
  prefillForEdit: (turnId: string, resultAssetId: string) => Promise<void>
}

let hydratePromise: Promise<void> | null = null

function normalizeStoredAsset(asset: StoredImageAsset): StoredImageAsset {
  return {
    ...asset,
    isReusable: Boolean(asset.isReusable),
  }
}

function materializeAsset(asset: StoredImageAsset): ImageAsset {
  const normalizedAsset = normalizeStoredAsset(asset)
  return {
    ...normalizedAsset,
    url: URL.createObjectURL(normalizedAsset.blob),
  }
}

function toStoredAsset(asset: ImageAsset): StoredImageAsset {
  const { url: _url, ...rest } = asset
  return normalizeStoredAsset(rest)
}

function revokeAssetUrls(assets: Record<string, ImageAsset>, assetIds: string[]) {
  for (const assetId of assetIds) {
    const asset = assets[assetId]
    if (asset) {
      URL.revokeObjectURL(asset.url)
    }
  }
}

function sortTurns(turns: ImageTurn[]) {
  return [...turns].sort((a, b) => a.createdAt - b.createdAt)
}

function sortPipelines(pipelines: ImagePipeline[]) {
  return [...pipelines].sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt)
}

function uniqueAssetIds(assetIds: string[]) {
  const uniqueIds: string[] = []
  const seen = new Set<string>()

  for (const assetId of assetIds) {
    if (!assetId || seen.has(assetId)) continue
    seen.add(assetId)
    uniqueIds.push(assetId)
  }

  return uniqueIds
}

function appendReferenceAssetIds(currentIds: string[], nextIds: string[]) {
  const mergedIds = uniqueAssetIds([...currentIds, ...nextIds])
  if (mergedIds.length > MAX_IMAGE_REFERENCE_COUNT) {
    throw new Error(`You can use up to ${MAX_IMAGE_REFERENCE_COUNT} reference images per generation.`)
  }
  return mergedIds
}

function buildDraftFromPipeline(pipeline: ImagePipeline): ImageDraft {
  return {
    prompt: pipeline.prompt,
    model: pipeline.model,
    count: pipeline.count,
    aspectRatio: pipeline.aspectRatio,
    imageSize: pipeline.imageSize,
    referenceAssetIds: [...pipeline.pinnedAssetIds],
    origin: 'new',
    sourceTurnId: undefined,
    pipelineId: pipeline.id,
  }
}

function buildSnapshot(
  state: Pick<ImageGenerationStore, 'turns' | 'draft' | 'composerDrawingData' | 'viewMode' | 'gridColumns' | 'queuePaused' | 'pipelines'>
): ImageThreadSnapshot {
  return {
    version: IMAGE_THREAD_SNAPSHOT_VERSION,
    turns: state.turns,
    draft: state.draft,
    composerDrawingData: state.composerDrawingData,
    viewMode: state.viewMode,
    gridColumns: state.gridColumns,
    queuePaused: state.queuePaused,
    pipelines: sortPipelines(state.pipelines),
  }
}

function getRetainedAssetIds(
  turns: ImageTurn[],
  draft: ImageDraft,
  pipelines: ImagePipeline[],
  assetsById: Record<string, ImageAsset>,
) {
  const ids = new Set<string>()

  for (const assetId of draft.referenceAssetIds) {
    ids.add(assetId)
  }

  for (const pipeline of pipelines) {
    for (const assetId of pipeline.pinnedAssetIds) {
      ids.add(assetId)
    }
  }

  for (const turn of turns) {
    for (const assetId of turn.referenceAssetIds) {
      ids.add(assetId)
    }

    for (const assetId of turn.resultAssetIds) {
      ids.add(assetId)
    }
  }

  for (const asset of Object.values(assetsById)) {
    if (asset.isReusable) {
      ids.add(asset.id)
    }
  }

  return ids
}

function sanitizePipelines(
  pipelines: ImagePipeline[] | undefined,
  availableAssetIds: Set<string>,
) {
  return sortPipelines(
    (pipelines ?? []).map((pipeline) => ({
      ...pipeline,
      pinnedAssetIds: uniqueAssetIds(pipeline.pinnedAssetIds ?? []).filter((assetId) =>
        availableAssetIds.has(assetId)
      ),
    }))
  )
}

function sanitizeDraft(
  draft: ImageDraft | undefined,
  availableAssetIds: Set<string>,
  availablePipelineIds: Set<string>,
): ImageDraft {
  return {
    ...DEFAULT_IMAGE_DRAFT,
    ...draft,
    referenceAssetIds: uniqueAssetIds(draft?.referenceAssetIds ?? []).filter((assetId) =>
      availableAssetIds.has(assetId)
    ),
    origin: draft?.origin ?? 'new',
    pipelineId:
      draft?.pipelineId && availablePipelineIds.has(draft.pipelineId)
        ? draft.pipelineId
        : null,
  }
}

function sanitizeTurns(turns: ImageTurn[] | undefined, availableAssetIds: Set<string>) {
  let shouldPauseQueue = false

  const normalizedTurns = sortTurns(turns ?? []).map((turn) => {
    const nextTurn: ImageTurn = {
      ...turn,
      referenceAssetIds: uniqueAssetIds(turn.referenceAssetIds ?? []).filter((assetId) =>
        availableAssetIds.has(assetId)
      ),
      resultAssetIds: uniqueAssetIds(turn.resultAssetIds ?? []).filter((assetId) =>
        availableAssetIds.has(assetId)
      ),
    }

    if (nextTurn.status === 'running' || nextTurn.status === 'queued') {
      shouldPauseQueue = true
      nextTurn.status = 'paused'
      nextTurn.error = INTERRUPTED_QUEUE_MESSAGE
    }

    return nextTurn
  })

  return { normalizedTurns, shouldPauseQueue }
}

async function persistSnapshotFromState(
  state: Pick<ImageGenerationStore, 'turns' | 'draft' | 'composerDrawingData' | 'viewMode' | 'gridColumns' | 'queuePaused' | 'pipelines'>
) {
  await saveImageGenerationSnapshot(buildSnapshot(state))
}

export const useImageGenerationStore = create<ImageGenerationStore>((set, get) => {
  const persistSnapshot = async () => {
    await persistSnapshotFromState(get())
  }

  const cleanupUnretainedAssets = async () => {
    const state = get()
    const retainedAssetIds = getRetainedAssetIds(
      state.turns,
      state.draft,
      state.pipelines,
      state.assetsById,
    )
    const assetIdsToDelete = Object.keys(state.assetsById).filter((assetId) => !retainedAssetIds.has(assetId))

    if (assetIdsToDelete.length === 0) return

    revokeAssetUrls(state.assetsById, assetIdsToDelete)
    set((currentState) => {
      const nextAssetsById = { ...currentState.assetsById }
      for (const assetId of assetIdsToDelete) {
        delete nextAssetsById[assetId]
      }
      return { assetsById: nextAssetsById }
    })

    await deleteImageGenerationAssets(assetIdsToDelete)
  }

  const promoteReferenceAssetsToReusable = async (assetIds: string[]) => {
    const state = get()
    const validReferenceIds = uniqueAssetIds(assetIds).filter((assetId) => Boolean(state.assetsById[assetId]))

    const updates = validReferenceIds.flatMap((assetId) => {
      const asset = state.assetsById[assetId]
      if (!asset || asset.isReusable) return []
      return [{ ...asset, isReusable: true }]
    })

    if (updates.length > 0) {
      await putImageGenerationAssets(updates.map(toStoredAsset))
      set((currentState) => ({
        assetsById: {
          ...currentState.assetsById,
          ...Object.fromEntries(updates.map((asset) => [asset.id, asset])),
        },
      }))
    }

    return validReferenceIds
  }

  return {
    isHydrated: false,
    isHydrating: false,
    hydrationError: null,
    turns: [],
    assetsById: {},
    pipelines: [],
    draft: DEFAULT_IMAGE_DRAFT,
    composerDrawingData: null,
    viewMode: 'grid',
    gridColumns: DEFAULT_IMAGE_GRID_COLUMNS,
    queuePaused: false,

    hydrate: async () => {
      if (get().isHydrated) return
      if (hydratePromise) return hydratePromise

      set({ isHydrating: true, hydrationError: null })

      hydratePromise = (async () => {
        try {
          const { snapshot, assets } = await loadImageGenerationPersistence()
          const materializedAssets = Object.fromEntries(
            assets.map((asset) => {
              const materialized = materializeAsset(asset)
              return [materialized.id, materialized]
            })
          )
          const availableAssetIds = new Set(assets.map((asset) => asset.id))
          const pipelines = sanitizePipelines(snapshot?.pipelines, availableAssetIds)
          const availablePipelineIds = new Set(pipelines.map((pipeline) => pipeline.id))
          const { normalizedTurns, shouldPauseQueue } = sanitizeTurns(snapshot?.turns, availableAssetIds)
          const draft = sanitizeDraft(snapshot?.draft, availableAssetIds, availablePipelineIds)
          const composerDrawingData = snapshot?.composerDrawingData ?? null
          const legacyGridZoom =
            snapshot && 'gridZoom' in snapshot
              ? (snapshot as ImageThreadSnapshot & { gridZoom?: string }).gridZoom
              : undefined
          const viewMode = normalizeImageViewMode(snapshot?.viewMode, legacyGridZoom)
          const gridColumns = normalizeImageGridColumns(snapshot?.gridColumns)
          const queuePaused = shouldPauseQueue ? true : (snapshot?.queuePaused ?? false)

          set({
            isHydrated: true,
            isHydrating: false,
            turns: normalizedTurns,
            assetsById: materializedAssets,
            pipelines,
            draft,
            composerDrawingData,
            viewMode,
            gridColumns,
            queuePaused,
          })

          if (
            !snapshot ||
            snapshot.version !== IMAGE_THREAD_SNAPSHOT_VERSION ||
            shouldPauseQueue ||
            snapshot.viewMode !== viewMode ||
            snapshot.gridColumns !== gridColumns ||
            snapshot.queuePaused !== queuePaused ||
            JSON.stringify(snapshot.turns ?? []) !== JSON.stringify(normalizedTurns) ||
            JSON.stringify(snapshot.draft ?? DEFAULT_IMAGE_DRAFT) !== JSON.stringify(draft) ||
            JSON.stringify(snapshot.composerDrawingData ?? null) !== JSON.stringify(composerDrawingData) ||
            JSON.stringify(snapshot.pipelines ?? []) !== JSON.stringify(pipelines)
          ) {
            await persistSnapshotFromState({
              turns: normalizedTurns,
              draft,
              composerDrawingData,
              viewMode,
              gridColumns,
              queuePaused,
              pipelines,
            })
          }

          await cleanupUnretainedAssets()
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to load image generations'
          set({
            isHydrated: true,
            isHydrating: false,
            hydrationError: message,
          })
        } finally {
          hydratePromise = null
        }
      })()

      return hydratePromise
    },

    setDraftPrompt: async (prompt) => {
      set((state) => ({
        draft: {
          ...state.draft,
          prompt,
        },
      }))

      await persistSnapshot()
    },

    setDraftModel: async (model) => {
      set((state) => ({
        draft: {
          ...state.draft,
          model,
        },
      }))

      await persistSnapshot()
    },

    setDraftCount: async (count) => {
      set((state) => ({
        draft: {
          ...state.draft,
          count,
        },
      }))

      await persistSnapshot()
    },

    setDraftAspectRatio: async (aspectRatio) => {
      set((state) => ({
        draft: {
          ...state.draft,
          aspectRatio,
        },
      }))

      await persistSnapshot()
    },

    setDraftImageSize: async (imageSize) => {
      set((state) => ({
        draft: {
          ...state.draft,
          imageSize,
        },
      }))

      await persistSnapshot()
    },

    setComposerDrawingData: async (composerDrawingData) => {
      set({ composerDrawingData })

      await persistSnapshot()
    },

    clearComposerDrawingData: async () => {
      set({ composerDrawingData: null })

      await persistSnapshot()
    },

    resetDraft: async () => {
      set((state) => ({
        draft: {
          ...DEFAULT_IMAGE_DRAFT,
          model: state.draft.model,
          count: state.draft.count,
          aspectRatio: state.draft.aspectRatio,
          imageSize: state.draft.imageSize,
        },
      }))

      await persistSnapshot()
      await cleanupUnretainedAssets()
    },

    addDraftReference: async ({ blob, mimeType, name }) => {
      const assetId = generateId()
      const state = get()
      const nextReferenceAssetIds = appendReferenceAssetIds(state.draft.referenceAssetIds, [assetId])
      const storedAsset: StoredImageAsset = {
        id: assetId,
        kind: 'reference',
        mimeType,
        createdAt: Date.now(),
        name,
        isReusable: false,
        blob,
      }

      await putImageGenerationAssets([storedAsset])

      set((currentState) => ({
        assetsById: {
          ...currentState.assetsById,
          [assetId]: materializeAsset(storedAsset),
        },
        draft: {
          ...currentState.draft,
          referenceAssetIds: nextReferenceAssetIds,
        },
      }))

      await persistSnapshot()
      return assetId
    },

    addDraftReferenceIds: async (assetIds) => {
      const state = get()
      const validReferenceIds = uniqueAssetIds(assetIds).filter((assetId) => Boolean(state.assetsById[assetId]))

      if (validReferenceIds.length === 0) return

      const nextReferenceAssetIds = appendReferenceAssetIds(
        state.draft.referenceAssetIds,
        validReferenceIds,
      )

      set((currentState) => ({
        draft: {
          ...currentState.draft,
          referenceAssetIds: nextReferenceAssetIds,
        },
      }))

      await persistSnapshot()
    },

    addReusableAsset: async ({ blob, mimeType, name }) => {
      const assetId = generateId()
      const storedAsset: StoredImageAsset = {
        id: assetId,
        kind: 'reference',
        mimeType,
        createdAt: Date.now(),
        name,
        isReusable: true,
        blob,
      }

      await putImageGenerationAssets([storedAsset])

      set((state) => ({
        assetsById: {
          ...state.assetsById,
          [assetId]: materializeAsset(storedAsset),
        },
      }))

      return assetId
    },

    renameAsset: async (assetId, name) => {
      const asset = get().assetsById[assetId]
      if (!asset) return

      const nextAsset: ImageAsset = {
        ...asset,
        name: name.trim() || undefined,
      }

      await putImageGenerationAssets([toStoredAsset(nextAsset)])
      set((state) => ({
        assetsById: {
          ...state.assetsById,
          [assetId]: nextAsset,
        },
      }))
    },

    deleteReusableAsset: async (assetId) => {
      const asset = get().assetsById[assetId]
      if (!asset || !asset.isReusable) return

      const nextAsset: ImageAsset = {
        ...asset,
        isReusable: false,
      }

      await putImageGenerationAssets([toStoredAsset(nextAsset)])

      set((state) => {
        const nextPipelines = state.pipelines.map((pipeline) => ({
          ...pipeline,
          pinnedAssetIds: pipeline.pinnedAssetIds.filter((id) => id !== assetId),
        }))

        return {
          assetsById: {
            ...state.assetsById,
            [assetId]: nextAsset,
          },
          pipelines: nextPipelines,
          draft: {
            ...state.draft,
            pipelineId:
              state.draft.pipelineId && nextPipelines.some((pipeline) => pipeline.id === state.draft.pipelineId)
                ? state.draft.pipelineId
                : null,
            referenceAssetIds: state.draft.referenceAssetIds.filter((id) => id !== assetId),
          },
        }
      })

      await persistSnapshot()
      await cleanupUnretainedAssets()
    },

    removeDraftReference: async (assetId) => {
      set((state) => ({
        draft: {
          ...state.draft,
          referenceAssetIds: state.draft.referenceAssetIds.filter((id) => id !== assetId),
        },
      }))

      await persistSnapshot()
      await cleanupUnretainedAssets()
    },

    clearDraftReferences: async () => {
      set((state) => ({
        draft: {
          ...state.draft,
          referenceAssetIds: [],
        },
      }))

      await persistSnapshot()
      await cleanupUnretainedAssets()
    },

    savePipeline: async (name) => {
      const trimmedName = name.trim()
      const state = get()
      const prompt = state.draft.prompt.trim()

      if (!trimmedName || !prompt) return null

      const pinnedAssetIds = await promoteReferenceAssetsToReusable(state.draft.referenceAssetIds)
      const timestamp = Date.now()
      const pipeline: ImagePipeline = {
        id: generateId(),
        name: trimmedName,
        prompt,
        model: state.draft.model,
        count: state.draft.count,
        aspectRatio: state.draft.aspectRatio,
        imageSize: state.draft.imageSize,
        pinnedAssetIds,
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      set((currentState) => ({
        pipelines: sortPipelines([pipeline, ...currentState.pipelines]),
        draft: buildDraftFromPipeline(pipeline),
      }))

      await persistSnapshot()
      return pipeline.id
    },

    updatePipeline: async (pipelineId) => {
      const state = get()
      const existingPipeline = state.pipelines.find((pipeline) => pipeline.id === pipelineId)
      const prompt = state.draft.prompt.trim()

      if (!existingPipeline || !prompt) return

      const pinnedAssetIds = await promoteReferenceAssetsToReusable(state.draft.referenceAssetIds)
      const updatedPipeline: ImagePipeline = {
        ...existingPipeline,
        prompt,
        model: state.draft.model,
        count: state.draft.count,
        aspectRatio: state.draft.aspectRatio,
        imageSize: state.draft.imageSize,
        pinnedAssetIds,
        updatedAt: Date.now(),
      }

      set((currentState) => ({
        pipelines: sortPipelines(
          currentState.pipelines.map((pipeline) =>
            pipeline.id === pipelineId ? updatedPipeline : pipeline
          )
        ),
        draft: currentState.draft.pipelineId === pipelineId
          ? buildDraftFromPipeline(updatedPipeline)
          : currentState.draft,
      }))

      await persistSnapshot()
    },

    applyPipeline: async (pipelineId) => {
      const pipeline = get().pipelines.find((entry) => entry.id === pipelineId)
      if (!pipeline) return

      set({
        draft: buildDraftFromPipeline(pipeline),
      })

      await persistSnapshot()
      await cleanupUnretainedAssets()
    },

    deletePipeline: async (pipelineId) => {
      set((state) => ({
        pipelines: state.pipelines.filter((pipeline) => pipeline.id !== pipelineId),
        draft: state.draft.pipelineId === pipelineId
          ? {
              ...state.draft,
              pipelineId: null,
            }
          : state.draft,
      }))

      await persistSnapshot()
      await cleanupUnretainedAssets()
    },

    enqueueDraft: async () => {
      const state = get()
      const prompt = state.draft.prompt.trim()
      if (!prompt) return null
      if (state.draft.referenceAssetIds.length > MAX_IMAGE_REFERENCE_COUNT) return null

      const turn: ImageTurn = {
        id: generateId(),
        status: 'queued',
        createdAt: Date.now(),
        origin: state.draft.origin,
        sourceTurnId: state.draft.sourceTurnId,
        prompt,
        model: state.draft.model,
        count: state.draft.count,
        aspectRatio: state.draft.aspectRatio,
        imageSize: state.draft.imageSize,
        referenceAssetIds: [...state.draft.referenceAssetIds],
        resultAssetIds: [],
      }

      set((currentState) => ({
        turns: [...currentState.turns, turn],
      }))

      await persistSnapshot()
      await cleanupUnretainedAssets()
      return turn.id
    },

    pauseQueue: async () => {
      set({ queuePaused: true })
      await persistSnapshot()
    },

    resumeQueue: async () => {
      set((state) => ({
        queuePaused: false,
        turns: state.turns.map((turn) =>
          turn.status === 'paused'
            ? { ...turn, status: 'queued', error: undefined }
            : turn
        ),
      }))

      await persistSnapshot()
    },

    setViewMode: async (viewMode) => {
      set({ viewMode })
      await persistSnapshot()
    },

    setGridColumns: async (gridColumns) => {
      set({ gridColumns: normalizeImageGridColumns(gridColumns) })
      await persistSnapshot()
    },

    markTurnRunning: async (turnId) => {
      set((state) => ({
        turns: state.turns.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                status: 'running',
                error: undefined,
              }
            : turn
        ),
      }))

      await persistSnapshot()
    },

    completeTurn: async (turnId, payload) => {
      const turn = get().turns.find((entry) => entry.id === turnId)
      if (!turn) return

      const nextStoredAssets: StoredImageAsset[] = payload.images.map((image, index) => ({
        id: generateId(),
        kind: 'result',
        mimeType: image.mimeType,
        createdAt: Date.now(),
        sourceTurnId: turnId,
        name: `Result ${index + 1}`,
        isReusable: false,
        blob: image.blob,
      }))

      await putImageGenerationAssets(nextStoredAssets)

      set((state) => ({
        assetsById: {
          ...state.assetsById,
          ...Object.fromEntries(nextStoredAssets.map((asset) => [asset.id, materializeAsset(asset)])),
        },
        turns: state.turns.map((entry) =>
          entry.id === turnId
            ? {
                ...entry,
                status: 'complete',
                resultAssetIds: nextStoredAssets.map((asset) => asset.id),
                responseText: payload.responseText,
                warnings: payload.warnings,
                error: undefined,
              }
            : entry
        ),
      }))

      await persistSnapshot()
    },

    failTurn: async (turnId, error, warnings) => {
      set((state) => ({
        turns: state.turns.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                status: 'failed',
                error,
                warnings,
              }
            : turn
        ),
      }))

      await persistSnapshot()
    },

    cancelTurn: async (turnId, error) => {
      set((state) => ({
        turns: state.turns.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                status: 'canceled',
                error: error || 'Generation canceled',
              }
            : turn
        ),
      }))

      await persistSnapshot()
    },

    removeTurn: async (turnId) => {
      const turn = get().turns.find((entry) => entry.id === turnId)
      if (!turn || turn.status === 'running') return

      set((state) => ({
        turns: state.turns.filter((entry) => entry.id !== turnId),
      }))

      await persistSnapshot()
      await cleanupUnretainedAssets()
    },

    retryTurn: async (turnId) => {
      const turn = get().turns.find((entry) => entry.id === turnId)
      if (!turn) return

      set((state) => ({
        turns: state.turns.map((entry) =>
          entry.id === turnId
            ? {
                ...entry,
                status: 'queued',
                error: undefined,
                warnings: undefined,
                resultAssetIds: [],
                responseText: undefined,
              }
            : entry
        ),
      }))

      await persistSnapshot()
      await cleanupUnretainedAssets()
    },

    prefillFromTurn: async (turnId) => {
      const turn = get().turns.find((entry) => entry.id === turnId)
      if (!turn) return

      set({
        draft: {
          prompt: turn.prompt,
          model: turn.model,
          count: turn.count,
          aspectRatio: turn.aspectRatio,
          imageSize: turn.imageSize,
          referenceAssetIds: [...turn.referenceAssetIds],
          origin: 'variant',
          sourceTurnId: turn.id,
          pipelineId: null,
        },
      })

      await persistSnapshot()
    },

    prefillForEdit: async (turnId, resultAssetId) => {
      const turn = get().turns.find((entry) => entry.id === turnId)
      if (!turn) return

      const referenceAssetIds = uniqueAssetIds([
        resultAssetId,
        ...turn.referenceAssetIds.filter((assetId) => assetId !== resultAssetId),
      ]).slice(0, MAX_IMAGE_REFERENCE_COUNT)

      set({
        draft: {
          prompt: turn.prompt,
          model: turn.model,
          count: turn.count,
          aspectRatio: turn.aspectRatio,
          imageSize: turn.imageSize,
          referenceAssetIds,
          origin: 'edit',
          sourceTurnId: turn.id,
          pipelineId: null,
        },
      })

      await persistSnapshot()
    },
  }
})
