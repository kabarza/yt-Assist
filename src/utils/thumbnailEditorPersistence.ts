import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  ThumbnailAsset,
  ThumbnailEditorSnapshot,
  StoredThumbnailAsset,
} from '@/types/thumbnailEditor'

const DB_NAME = 'yt-assist-thumbnail-studio'
const DB_VERSION = 1
const SNAPSHOT_KEY = 'thumbnail-studio'

interface ThumbnailStudioDB extends DBSchema {
  meta: {
    key: string
    value: ThumbnailEditorSnapshot
  }
  assets: {
    key: string
    value: StoredThumbnailAsset
  }
}

let dbPromise: Promise<IDBPDatabase<ThumbnailStudioDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<ThumbnailStudioDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta')
        }

        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets', { keyPath: 'id' })
        }
      },
    })
  }

  return dbPromise
}

export async function loadThumbnailEditorPersistence() {
  const db = await getDb()
  const [snapshot, assets] = await Promise.all([
    db.get('meta', SNAPSHOT_KEY),
    db.getAll('assets'),
  ])

  return { snapshot, assets }
}

export async function saveThumbnailEditorSnapshot(snapshot: ThumbnailEditorSnapshot) {
  const db = await getDb()
  await db.put('meta', snapshot, SNAPSHOT_KEY)
}

export async function putThumbnailAssets(assets: StoredThumbnailAsset[]) {
  if (assets.length === 0) return

  const db = await getDb()
  const tx = db.transaction('assets', 'readwrite')

  for (const asset of assets) {
    tx.store.put(asset)
  }

  await tx.done
}

export async function deleteThumbnailAssets(assetIds: string[]) {
  if (assetIds.length === 0) return

  const db = await getDb()
  const tx = db.transaction('assets', 'readwrite')

  for (const assetId of assetIds) {
    tx.store.delete(assetId)
  }

  await tx.done
}

export function materializeThumbnailAsset(asset: StoredThumbnailAsset): ThumbnailAsset {
  return {
    ...asset,
    url: URL.createObjectURL(asset.blob),
  }
}

export function revokeThumbnailAssetUrls(assets: Record<string, ThumbnailAsset>) {
  for (const asset of Object.values(assets)) {
    URL.revokeObjectURL(asset.url)
  }
}

