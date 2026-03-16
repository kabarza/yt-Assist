import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { CanvasAsset, CanvasWorkspace, StoredCanvasAsset } from '@/types/canvasLab'

const DB_NAME = 'yt-assist-canvas-lab'
const DB_VERSION = 1

interface CanvasLabDB extends DBSchema {
  workspaces: {
    key: string
    value: CanvasWorkspace
  }
  assets: {
    key: string
    value: StoredCanvasAsset
  }
}

let dbPromise: Promise<IDBPDatabase<CanvasLabDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<CanvasLabDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('workspaces')) {
          db.createObjectStore('workspaces', { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets', { keyPath: 'id' })
        }
      },
    })
  }

  return dbPromise
}

export async function loadCanvasLabPersistence() {
  const db = await getDb()
  const [workspaces, assets] = await Promise.all([
    db.getAll('workspaces'),
    db.getAll('assets'),
  ])

  return { workspaces, assets }
}

export async function saveCanvasWorkspace(workspace: CanvasWorkspace) {
  const db = await getDb()
  await db.put('workspaces', workspace)
}

export async function deleteCanvasWorkspace(workspaceId: string) {
  const db = await getDb()
  const tx = db.transaction(['workspaces', 'assets'], 'readwrite')
  await tx.objectStore('workspaces').delete(workspaceId)

  const assets = await tx.objectStore('assets').getAll()
  for (const asset of assets) {
    if (asset.workspaceId === workspaceId) {
      tx.objectStore('assets').delete(asset.id)
    }
  }

  await tx.done
}

export async function putCanvasAssets(assets: StoredCanvasAsset[]) {
  if (assets.length === 0) return

  const db = await getDb()
  const tx = db.transaction('assets', 'readwrite')
  for (const asset of assets) {
    tx.objectStore('assets').put(asset)
  }
  await tx.done
}

export async function deleteCanvasAssets(assetIds: string[]) {
  if (assetIds.length === 0) return

  const db = await getDb()
  const tx = db.transaction('assets', 'readwrite')
  for (const assetId of assetIds) {
    tx.objectStore('assets').delete(assetId)
  }
  await tx.done
}

export function materializeCanvasAsset(asset: StoredCanvasAsset): CanvasAsset {
  return {
    ...asset,
    url: URL.createObjectURL(asset.blob),
  }
}

export function toStoredCanvasAsset(asset: CanvasAsset): StoredCanvasAsset {
  const { url: _url, ...rest } = asset
  return rest
}

export function revokeCanvasAssetUrls(assets: Record<string, CanvasAsset>) {
  for (const asset of Object.values(assets)) {
    URL.revokeObjectURL(asset.url)
  }
}
