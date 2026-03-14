import { create } from 'zustand'
import { generateId } from '../types/chat'
import type {
  ImageAsset,
  ImageAspectRatio,
  ImageDraft,
  ImageGenerationModel,
  ImageGridZoom,
  ImageSize,
  ImageThreadSnapshot,
  ImageTurn,
  StoredImageAsset,
} from '../types/images'
import {
  DEFAULT_IMAGE_DRAFT,
  IMAGE_THREAD_SNAPSHOT_VERSION,
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
  draft: ImageDraft
  gridZoom: ImageGridZoom
  queuePaused: boolean
  hydrate: () => Promise<void>
  setDraftPrompt: (prompt: string) => Promise<void>
  setDraftModel: (model: ImageGenerationModel) => Promise<void>
  setDraftCount: (count: number) => Promise<void>
  setDraftAspectRatio: (aspectRatio: ImageAspectRatio) => Promise<void>
  setDraftImageSize: (imageSize: ImageSize) => Promise<void>
  resetDraft: () => Promise<void>
  addDraftReference: (input: { blob: Blob; mimeType: string; name?: string }) => Promise<string>
  removeDraftReference: (assetId: string) => Promise<void>
  clearDraftReferences: () => Promise<void>
  enqueueDraft: () => Promise<string | null>
  pauseQueue: () => Promise<void>
  resumeQueue: () => Promise<void>
  setGridZoom: (gridZoom: ImageGridZoom) => Promise<void>
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

function materializeAsset(asset: StoredImageAsset): ImageAsset {
  return {
    ...asset,
    url: URL.createObjectURL(asset.blob),
  }
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

function buildSnapshot(state: Pick<ImageGenerationStore, 'turns' | 'draft' | 'gridZoom' | 'queuePaused'>): ImageThreadSnapshot {
  return {
    version: IMAGE_THREAD_SNAPSHOT_VERSION,
    turns: state.turns,
    draft: state.draft,
    gridZoom: state.gridZoom,
    queuePaused: state.queuePaused,
  }
}

function clearDraftAfterSubmit(draft: ImageDraft): ImageDraft {
  return {
    ...draft,
    prompt: '',
    referenceAssetIds: [],
    origin: 'new',
    sourceTurnId: undefined,
  }
}

function getReferencedAssetIds(turns: ImageTurn[], draft: ImageDraft) {
  const ids = new Set<string>()

  for (const assetId of draft.referenceAssetIds) {
    ids.add(assetId)
  }

  for (const turn of turns) {
    for (const assetId of turn.referenceAssetIds) {
      ids.add(assetId)
    }

    for (const assetId of turn.resultAssetIds) {
      ids.add(assetId)
    }
  }

  return ids
}

function sanitizeDraft(draft: ImageDraft | undefined, availableAssetIds: Set<string>): ImageDraft {
  return {
    ...DEFAULT_IMAGE_DRAFT,
    ...draft,
    referenceAssetIds: (draft?.referenceAssetIds ?? []).filter((assetId) => availableAssetIds.has(assetId)),
    origin: draft?.origin ?? 'new',
  }
}

function normalizeGridZoom(gridZoom: string | undefined): ImageGridZoom {
  if (gridZoom === 'comfortable') return 'list'
  if (gridZoom === 'compact' || gridZoom === 'detail' || gridZoom === 'list') return gridZoom
  return 'list'
}

function sanitizeTurns(turns: ImageTurn[] | undefined, availableAssetIds: Set<string>) {
  let shouldPauseQueue = false

  const normalizedTurns = sortTurns(turns ?? []).map((turn) => {
    const nextTurn: ImageTurn = {
      ...turn,
      referenceAssetIds: turn.referenceAssetIds.filter((assetId) => availableAssetIds.has(assetId)),
      resultAssetIds: turn.resultAssetIds.filter((assetId) => availableAssetIds.has(assetId)),
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

async function persistSnapshotFromState(state: Pick<ImageGenerationStore, 'turns' | 'draft' | 'gridZoom' | 'queuePaused'>) {
  await saveImageGenerationSnapshot(buildSnapshot(state))
}

export const useImageGenerationStore = create<ImageGenerationStore>((set, get) => ({
  isHydrated: false,
  isHydrating: false,
  hydrationError: null,
  turns: [],
  assetsById: {},
  draft: DEFAULT_IMAGE_DRAFT,
  gridZoom: 'list',
  queuePaused: false,

  hydrate: async () => {
    if (get().isHydrated) return
    if (hydratePromise) return hydratePromise

    set({ isHydrating: true, hydrationError: null })

    hydratePromise = (async () => {
      try {
        const { snapshot, assets } = await loadImageGenerationPersistence()
        const materializedAssets = Object.fromEntries(
          assets.map((asset) => [asset.id, materializeAsset(asset)])
        )
        const availableAssetIds = new Set(assets.map((asset) => asset.id))
        const { normalizedTurns, shouldPauseQueue } = sanitizeTurns(snapshot?.turns, availableAssetIds)
        const draft = sanitizeDraft(snapshot?.draft, availableAssetIds)
        const gridZoom = normalizeGridZoom(snapshot?.gridZoom)
        const queuePaused = shouldPauseQueue ? true : (snapshot?.queuePaused ?? false)

        set({
          isHydrated: true,
          isHydrating: false,
          turns: normalizedTurns,
          assetsById: materializedAssets,
          draft,
          gridZoom,
          queuePaused,
        })

        if (
          !snapshot ||
          snapshot.version !== IMAGE_THREAD_SNAPSHOT_VERSION ||
          shouldPauseQueue ||
          snapshot.gridZoom !== gridZoom ||
          snapshot.queuePaused !== queuePaused ||
          JSON.stringify(snapshot.turns ?? []) !== JSON.stringify(normalizedTurns) ||
          JSON.stringify(snapshot.draft ?? DEFAULT_IMAGE_DRAFT) !== JSON.stringify(draft)
        ) {
          await persistSnapshotFromState({
            turns: normalizedTurns,
            draft,
            gridZoom,
            queuePaused,
          })
        }
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

    await persistSnapshotFromState(get())
  },

  setDraftModel: async (model) => {
    set((state) => ({
      draft: {
        ...state.draft,
        model,
      },
    }))

    await persistSnapshotFromState(get())
  },

  setDraftCount: async (count) => {
    set((state) => ({
      draft: {
        ...state.draft,
        count,
      },
    }))

    await persistSnapshotFromState(get())
  },

  setDraftAspectRatio: async (aspectRatio) => {
    set((state) => ({
      draft: {
        ...state.draft,
        aspectRatio,
      },
    }))

    await persistSnapshotFromState(get())
  },

  setDraftImageSize: async (imageSize) => {
    set((state) => ({
      draft: {
        ...state.draft,
        imageSize,
      },
    }))

    await persistSnapshotFromState(get())
  },

  resetDraft: async () => {
    const assetIds = [...get().draft.referenceAssetIds]

    set((state) => ({
      draft: {
        ...DEFAULT_IMAGE_DRAFT,
        model: state.draft.model,
        count: state.draft.count,
        aspectRatio: state.draft.aspectRatio,
        imageSize: state.draft.imageSize,
      },
    }))

    await persistSnapshotFromState(get())

    const state = get()
    const referencedAssetIds = getReferencedAssetIds(state.turns, state.draft)
    const assetIdsToDelete = assetIds.filter((assetId) => !referencedAssetIds.has(assetId))

    if (assetIdsToDelete.length > 0) {
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
  },

  addDraftReference: async ({ blob, mimeType, name }) => {
    const assetId = generateId()
    const storedAsset: StoredImageAsset = {
      id: assetId,
      kind: 'reference',
      mimeType,
      createdAt: Date.now(),
      name,
      blob,
    }

    await putImageGenerationAssets([storedAsset])

    set((state) => ({
      assetsById: {
        ...state.assetsById,
        [assetId]: materializeAsset(storedAsset),
      },
      draft: {
        ...state.draft,
        referenceAssetIds: [...state.draft.referenceAssetIds, assetId],
      },
    }))

    await persistSnapshotFromState(get())
    return assetId
  },

  removeDraftReference: async (assetId) => {
    set((state) => ({
      draft: {
        ...state.draft,
        referenceAssetIds: state.draft.referenceAssetIds.filter((id) => id !== assetId),
      },
    }))

    await persistSnapshotFromState(get())

    const state = get()
    const referencedAssetIds = getReferencedAssetIds(state.turns, state.draft)
    if (!referencedAssetIds.has(assetId) && state.assetsById[assetId]) {
      revokeAssetUrls(state.assetsById, [assetId])
      set((currentState) => {
        const { [assetId]: _removed, ...rest } = currentState.assetsById
        return { assetsById: rest }
      })
      await deleteImageGenerationAssets([assetId])
    }
  },

  clearDraftReferences: async () => {
    const assetIds = [...get().draft.referenceAssetIds]

    set((state) => ({
      draft: {
        ...state.draft,
        referenceAssetIds: [],
      },
    }))

    await persistSnapshotFromState(get())

    const state = get()
    const referencedAssetIds = getReferencedAssetIds(state.turns, state.draft)
    const assetIdsToDelete = assetIds.filter((assetId) => !referencedAssetIds.has(assetId))

    if (assetIdsToDelete.length > 0) {
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
  },

  enqueueDraft: async () => {
    const state = get()
    const prompt = state.draft.prompt.trim()
    if (!prompt) return null

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
      draft: clearDraftAfterSubmit(currentState.draft),
    }))

    await persistSnapshotFromState(get())
    return turn.id
  },

  pauseQueue: async () => {
    set({ queuePaused: true })
    await persistSnapshotFromState(get())
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

    await persistSnapshotFromState(get())
  },

  setGridZoom: async (gridZoom) => {
    set({ gridZoom })
    await persistSnapshotFromState(get())
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

    await persistSnapshotFromState(get())
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

    await persistSnapshotFromState(get())
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

    await persistSnapshotFromState(get())
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

    await persistSnapshotFromState(get())
  },

  removeTurn: async (turnId) => {
    const turn = get().turns.find((entry) => entry.id === turnId)
    if (!turn || turn.status === 'running') return

    const assetIdsToCheck = [...turn.referenceAssetIds, ...turn.resultAssetIds]

    set((state) => ({
      turns: state.turns.filter((entry) => entry.id !== turnId),
    }))

    await persistSnapshotFromState(get())

    const state = get()
    const referencedAssetIds = getReferencedAssetIds(state.turns, state.draft)
    const assetIdsToDelete = assetIdsToCheck.filter((assetId) => !referencedAssetIds.has(assetId))

    if (assetIdsToDelete.length > 0) {
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
  },

  retryTurn: async (turnId) => {
    const turn = get().turns.find((entry) => entry.id === turnId)
    if (!turn) return

    const resultAssetIds = [...turn.resultAssetIds]

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

    await persistSnapshotFromState(get())

    const state = get()
    const referencedAssetIds = getReferencedAssetIds(state.turns, state.draft)
    const assetIdsToDelete = resultAssetIds.filter((assetId) => !referencedAssetIds.has(assetId))

    if (assetIdsToDelete.length > 0) {
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
      },
    })

    await persistSnapshotFromState(get())
  },

  prefillForEdit: async (turnId, resultAssetId) => {
    const turn = get().turns.find((entry) => entry.id === turnId)
    if (!turn) return

    const referenceAssetIds = [
      resultAssetId,
      ...turn.referenceAssetIds.filter((assetId) => assetId !== resultAssetId),
    ]

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
      },
    })

    await persistSnapshotFromState(get())
  },
}))
