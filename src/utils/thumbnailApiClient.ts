import { useSettingsStore } from '@/stores/settingsStore'
import type { ThumbnailEditRequest, ThumbnailEditResponse } from '@/types/thumbnailEditor'
import { fetchApi } from '@/utils/fetchApi'

async function getResponseError(response: Response): Promise<string> {
  try {
    const data = await response.json()
    if (typeof data?.error === 'string' && data.error.trim()) {
      return data.error
    }
  } catch {
    // Ignore and fall through.
  }

  try {
    const text = await response.text()
    if (text.trim()) {
      return text.trim()
    }
  } catch {
    // Ignore and fall through.
  }

  return `API error: ${response.status}`
}

export async function requestThumbnailEdit(
  request: Omit<ThumbnailEditRequest, 'apiKeyOverride'>,
  signal?: AbortSignal,
): Promise<ThumbnailEditResponse> {
  const geminiApiKey = useSettingsStore.getState().settings.geminiApiKey?.trim()

  const response = await fetchApi('/api/thumbnail/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...request,
      ...(geminiApiKey ? { apiKeyOverride: geminiApiKey } : {}),
    }),
    signal,
  })

  if (!response.ok) {
    throw new Error(await getResponseError(response))
  }

  const data = await response.json()
  return {
    images: Array.isArray(data?.images) ? data.images : [],
    text: typeof data?.text === 'string' ? data.text : undefined,
    warnings: Array.isArray(data?.warnings) ? data.warnings : undefined,
  }
}
