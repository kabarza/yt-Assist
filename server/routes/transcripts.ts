import { Hono } from 'hono'

const transcriptRoute = new Hono()

const SUPADATA_TRANSCRIPT_ENDPOINT = 'https://api.supadata.ai/v1/youtube/transcript'
const CREATE_WAIT_TIME_SECONDS = 15
const PENDING_JOB_TTL_MS = 30 * 60 * 1000

interface TranscriptImportRequest {
  url?: string
  includeTimestamps?: boolean
  apiKeyOverride?: string
}

interface SupadataTranscriptChunk {
  text?: string
  offset?: number
  duration?: number
}

interface SupadataTranscriptPayload {
  content?: SupadataTranscriptChunk[] | string
  lang?: string
  availableLangs?: unknown
  title?: string
  jobId?: string
  status?: string
  generatedByAI?: boolean
  generated?: boolean
  error?: string
}

interface PendingImportJob {
  url: string
  apiKey: string
  includeTimestamps: boolean
  createdAt: number
  wasGenerated: boolean
}

const pendingImports = new Map<string, PendingImportJob>()

function cleanupExpiredJobs() {
  const now = Date.now()

  for (const [jobId, job] of pendingImports.entries()) {
    if (now - job.createdAt > PENDING_JOB_TTL_MS) {
      pendingImports.delete(jobId)
    }
  }
}

function isYouTubeUrl(value: string) {
  try {
    const url = new URL(value)
    const hostname = url.hostname.toLowerCase()

    return hostname === 'youtu.be' ||
      hostname.endsWith('.youtube.com') ||
      hostname === 'youtube.com'
  } catch {
    return false
  }
}

function formatTimestamp(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  if (hours > 0) {
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0'),
    ].join(':')
  }

  return [
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0'),
  ].join(':')
}

function formatTranscriptText(
  segments: Array<{ text: string; offsetSeconds: number }>,
  includeTimestamps: boolean
) {
  if (includeTimestamps) {
    return segments
      .map((segment) => `[${formatTimestamp(segment.offsetSeconds)}] ${segment.text}`)
      .join('\n')
  }

  return segments
    .map((segment) => segment.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractAvailableLanguages(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    if (typeof entry === 'string' && entry.trim()) {
      return [entry.trim()]
    }

    if (typeof entry === 'object' && entry !== null) {
      const lang = (entry as { lang?: unknown }).lang
      if (typeof lang === 'string' && lang.trim()) {
        return [lang.trim()]
      }
    }

    return []
  })
}

function getSupadataErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === 'object' && payload !== null) {
    const error = (payload as { error?: unknown }).error
    if (typeof error === 'string' && error.trim()) {
      return error
    }

    if (typeof error === 'object' && error !== null) {
      const message = (error as { message?: unknown }).message
      if (typeof message === 'string' && message.trim()) {
        return message
      }
    }
  }

  return fallback
}

function toClientErrorStatus(status: number) {
  if (status >= 500) {
    return 502 as const
  }

  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 408 || status === 409 || status === 422 || status === 429) {
    return status
  }

  return 500 as const
}

function normalizeTranscriptPayload(
  payload: SupadataTranscriptPayload,
  sourceUrl: string,
  includeTimestamps: boolean,
  fallbackWasGenerated: boolean
) {
  const rawContent = payload.content
  const segments = Array.isArray(rawContent)
    ? rawContent.flatMap((entry) => {
        const text = typeof entry?.text === 'string' ? entry.text.trim() : ''
        if (!text) {
          return []
        }

        return [{
          text,
          offsetSeconds: typeof entry.offset === 'number' ? entry.offset : 0,
          durationSeconds: typeof entry.duration === 'number' ? entry.duration : 0,
        }]
      })
    : typeof rawContent === 'string' && rawContent.trim()
    ? [{
        text: rawContent.trim(),
        offsetSeconds: 0,
        durationSeconds: 0,
      }]
    : []

  if (segments.length === 0) {
    throw new Error('Transcript provider returned no transcript content.')
  }

  const providerWasGenerated =
    typeof payload.generatedByAI === 'boolean'
      ? payload.generatedByAI
      : typeof payload.generated === 'boolean'
      ? payload.generated
      : fallbackWasGenerated

  return {
    status: 'completed' as const,
    transcriptText: formatTranscriptText(segments, includeTimestamps),
    segments,
    metadata: {
      sourceUrl,
      provider: 'supadata' as const,
      wasGenerated: providerWasGenerated,
      title: typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : undefined,
      language: typeof payload.lang === 'string' && payload.lang.trim() ? payload.lang.trim() : undefined,
      availableLanguages: extractAvailableLanguages(payload.availableLangs),
    },
  }
}

function buildSupadataUrl(url: string, waitTimeSeconds?: number) {
  const endpoint = new URL(SUPADATA_TRANSCRIPT_ENDPOINT)
  endpoint.searchParams.set('url', url)
  endpoint.searchParams.set('text', 'false')

  if (typeof waitTimeSeconds === 'number') {
    endpoint.searchParams.set('waitTime', waitTimeSeconds.toString())
  }

  return endpoint.toString()
}

async function requestSupadataTranscript(
  method: 'GET' | 'POST',
  {
    url,
    apiKey,
    waitTimeSeconds,
  }: {
    url: string
    apiKey: string
    waitTimeSeconds?: number
  }
) {
  const response = await fetch(buildSupadataUrl(url, waitTimeSeconds), {
    method,
    headers: {
      'x-api-key': apiKey,
    },
  })

  const payload = await response.json().catch(() => null) as SupadataTranscriptPayload | null

  return { response, payload }
}

transcriptRoute.post('/import', async (c) => {
  cleanupExpiredJobs()

  const body = await c.req.json<TranscriptImportRequest>()
  const url = body.url?.trim() || ''
  const includeTimestamps = body.includeTimestamps !== false
  const apiKey = body.apiKeyOverride?.trim() || process.env.SUPADATA_API_KEY || ''

  if (!apiKey) {
    return c.json({ error: 'SUPADATA_API_KEY not configured. Add it on the server or in Settings.' }, 500)
  }

  if (!url) {
    return c.json({ error: 'A YouTube video URL is required.' }, 400)
  }

  if (!isYouTubeUrl(url)) {
    return c.json({ error: 'Only YouTube video URLs are supported in v1.' }, 400)
  }

  const existingTranscript = await requestSupadataTranscript('GET', { url, apiKey })

  if (existingTranscript.response.ok && existingTranscript.payload) {
    try {
      return c.json(normalizeTranscriptPayload(existingTranscript.payload, url, includeTimestamps, false))
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 502)
    }
  }

  const createdTranscript = await requestSupadataTranscript('POST', {
    url,
    apiKey,
    waitTimeSeconds: CREATE_WAIT_TIME_SECONDS,
  })

  if (createdTranscript.response.ok && createdTranscript.payload) {
    try {
      return c.json(normalizeTranscriptPayload(createdTranscript.payload, url, includeTimestamps, true))
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 502)
    }
  }

  const pendingJobId = createdTranscript.payload?.jobId?.trim()
  if (createdTranscript.response.status === 202 && pendingJobId) {
    pendingImports.set(pendingJobId, {
      url,
      apiKey,
      includeTimestamps,
      createdAt: Date.now(),
      wasGenerated: true,
    })

    return c.json({
      status: 'pending' as const,
      jobId: pendingJobId,
    })
  }

  const errorMessage = getSupadataErrorMessage(
    createdTranscript.payload,
    `Transcript import failed (${createdTranscript.response.status})`
  )

  return c.json({ error: errorMessage }, toClientErrorStatus(createdTranscript.response.status))
})

transcriptRoute.get('/import/:jobId', async (c) => {
  cleanupExpiredJobs()

  const jobId = c.req.param('jobId')
  const pendingJob = pendingImports.get(jobId)

  if (!pendingJob) {
    return c.json({ error: 'Transcript import job not found or expired.' }, 404)
  }

  const transcriptResponse = await requestSupadataTranscript('GET', {
    url: pendingJob.url,
    apiKey: pendingJob.apiKey,
  })

  if (transcriptResponse.response.ok && transcriptResponse.payload) {
    pendingImports.delete(jobId)

    try {
      return c.json(
        normalizeTranscriptPayload(
          transcriptResponse.payload,
          pendingJob.url,
          pendingJob.includeTimestamps,
          pendingJob.wasGenerated
        )
      )
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 502)
    }
  }

  if (transcriptResponse.response.status === 202 || transcriptResponse.response.status === 404) {
    return c.json({
      status: 'pending' as const,
      jobId,
    })
  }

  const errorMessage = getSupadataErrorMessage(
    transcriptResponse.payload,
    `Transcript import failed (${transcriptResponse.response.status})`
  )

  return c.json({ error: errorMessage }, toClientErrorStatus(transcriptResponse.response.status))
})

export { transcriptRoute }
