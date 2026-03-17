import { useSettingsStore } from '../stores/settingsStore'
import type { TranscriptImportResponse } from '../types/transcriptImport'
import { fetchApi } from './fetchApi'

interface ImportTranscriptOptions {
  url: string
  includeTimestamps: boolean
  signal?: AbortSignal
}

interface ImportTranscriptRequestBody {
  url: string
  includeTimestamps: boolean
  apiKeyOverride?: string
}

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

function buildRequestBody(options: ImportTranscriptOptions): ImportTranscriptRequestBody {
  const supadataApiKey = useSettingsStore.getState().settings.supadataApiKey?.trim()

  return {
    url: options.url.trim(),
    includeTimestamps: options.includeTimestamps,
    ...(supadataApiKey ? { apiKeyOverride: supadataApiKey } : {}),
  }
}

export async function requestTranscriptImport(
  options: ImportTranscriptOptions
): Promise<TranscriptImportResponse> {
  const response = await fetchApi('/api/transcripts/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildRequestBody(options)),
    signal: options.signal,
  })

  if (!response.ok) {
    throw new Error(await getResponseError(response))
  }

  return response.json()
}

async function sleep(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup()
      resolve()
    }, ms)

    const abortHandler = () => {
      window.clearTimeout(timeoutId)
      cleanup()
      reject(signal?.reason ?? new DOMException('The operation was aborted.', 'AbortError'))
    }

    const cleanup = () => {
      signal?.removeEventListener('abort', abortHandler)
    }

    signal?.addEventListener('abort', abortHandler, { once: true })
  })
}

export async function pollTranscriptImport(
  jobId: string,
  options: {
    signal?: AbortSignal
    intervalMs?: number
    maxAttempts?: number
  } = {}
): Promise<TranscriptImportResponse> {
  const intervalMs = options.intervalMs ?? 2000
  const maxAttempts = options.maxAttempts ?? 30

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await sleep(intervalMs, options.signal)
    }

    const response = await fetchApi(`/api/transcripts/import/${encodeURIComponent(jobId)}`, {
      signal: options.signal,
    })

    if (!response.ok) {
      throw new Error(await getResponseError(response))
    }

    const result = await response.json() as TranscriptImportResponse
    if (result.status === 'completed') {
      return result
    }
  }

  throw new Error('Transcript import is still processing. Try again in a moment.')
}
