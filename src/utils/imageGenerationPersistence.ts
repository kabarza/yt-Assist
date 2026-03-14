import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ImageThreadSnapshot, StoredImageAsset } from '../types/images'

const DB_NAME = 'yt-assist-image-gen'
const DB_VERSION = 1
const SNAPSHOT_KEY = 'rolling-thread'

interface ImageGenerationDB extends DBSchema {
  meta: {
    key: string
    value: ImageThreadSnapshot
  }
  assets: {
    key: string
    value: StoredImageAsset
  }
}

let dbPromise: Promise<IDBPDatabase<ImageGenerationDB>> | null = null

function getDb(): Promise<IDBPDatabase<ImageGenerationDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ImageGenerationDB>(DB_NAME, DB_VERSION, {
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

export async function loadImageGenerationPersistence() {
  const db = await getDb()
  const [snapshot, assets] = await Promise.all([
    db.get('meta', SNAPSHOT_KEY),
    db.getAll('assets'),
  ])

  return { snapshot, assets }
}

export async function saveImageGenerationSnapshot(snapshot: ImageThreadSnapshot) {
  const db = await getDb()
  await db.put('meta', snapshot, SNAPSHOT_KEY)
}

export async function putImageGenerationAssets(assets: StoredImageAsset[]) {
  if (assets.length === 0) return

  const db = await getDb()
  const tx = db.transaction('assets', 'readwrite')

  for (const asset of assets) {
    tx.store.put(asset)
  }

  await tx.done
}

export async function deleteImageGenerationAssets(assetIds: string[]) {
  if (assetIds.length === 0) return

  const db = await getDb()
  const tx = db.transaction('assets', 'readwrite')

  for (const assetId of assetIds) {
    tx.store.delete(assetId)
  }

  await tx.done
}
