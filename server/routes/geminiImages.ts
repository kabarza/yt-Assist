import { Hono } from 'hono'

const geminiImagesRoute = new Hono()

const SUPPORTED_MODELS = new Set([
  'gemini-3.1-flash-image-preview',
  'gemini-3-pro-image-preview',
])

const SUPPORTED_ASPECT_RATIOS = new Set(['1:1', '3:2', '16:9', '9:16'])
const SUPPORTED_IMAGE_SIZES = new Set(['1K', '2K'])

interface ReferenceImageInput {
  dataUrl: string
  mimeType: string
}

interface GeminiImageRequest {
  model: string
  prompt: string
  referenceImages?: ReferenceImageInput[]
  count?: number
  aspectRatio?: string
  imageSize?: string
  apiKeyOverride?: string
}

interface GeminiInlineDataPart {
  inlineData?: {
    mimeType?: string
    data?: string
  }
  inline_data?: {
    mime_type?: string
    data?: string
  }
  text?: string
}

function extractBase64FromDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) {
    return null
  }

  return {
    mimeType: match[1],
    data: match[2],
  }
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === 'object' && payload !== null) {
    const error = (payload as { error?: { message?: string } }).error
    if (typeof error?.message === 'string' && error.message.trim()) {
      return error.message
    }
  }

  return fallback
}

async function callGeminiImageModel({
  apiKey,
  model,
  prompt,
  referenceImages,
  aspectRatio,
  imageSize,
}: {
  apiKey: string
  model: string
  prompt: string
  referenceImages: ReferenceImageInput[]
  aspectRatio: string
  imageSize: string
}) {
  const parts = [
    { text: prompt },
    ...referenceImages.map((image) => {
      const parsed = extractBase64FromDataUrl(image.dataUrl)
      if (!parsed) {
        throw new Error('One of the reference images is not a valid base64 data URL.')
      }

      return {
        inline_data: {
          mime_type: image.mimeType || parsed.mimeType,
          data: parsed.data,
        },
      }
    }),
  ]

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio,
            imageSize,
          },
        },
      }),
    }
  )

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, `Gemini image request failed (${response.status})`))
  }

  const candidates = Array.isArray((payload as { candidates?: unknown[] } | null)?.candidates)
    ? ((payload as { candidates: Array<{ content?: { parts?: GeminiInlineDataPart[] } }> }).candidates)
    : []

  const partsFromCandidates = candidates.flatMap((candidate) => candidate.content?.parts ?? [])
  const text = partsFromCandidates
    .flatMap((part) => (typeof part.text === 'string' && part.text.trim() ? [part.text.trim()] : []))
    .join('\n')

  const images = partsFromCandidates.flatMap((part) => {
    const inlineData = part.inlineData ?? part.inline_data
    let mimeType: string | undefined

    if (inlineData && 'mimeType' in inlineData && typeof inlineData.mimeType === 'string') {
      mimeType = inlineData.mimeType
    }

    if (!mimeType && inlineData && 'mime_type' in inlineData && typeof inlineData.mime_type === 'string') {
      mimeType = inlineData.mime_type
    }

    const data = inlineData?.data

    if (!mimeType || !data) {
      return []
    }

    return [{
      mimeType,
      dataUrl: `data:${mimeType};base64,${data}`,
    }]
  })

  return { images, text }
}

geminiImagesRoute.post('/', async (c) => {
  const body = await c.req.json<GeminiImageRequest>()
  const apiKey = body.apiKeyOverride?.trim() || process.env.GEMINI_API_KEY || ''

  if (!apiKey) {
    return c.json({ error: 'GEMINI_API_KEY not configured' }, 500)
  }

  const model = body.model?.trim()
  const prompt = body.prompt?.trim()
  const referenceImages = Array.isArray(body.referenceImages) ? body.referenceImages : []
  const count = Math.max(1, Math.min(4, Math.floor(body.count ?? 1)))
  const aspectRatio = body.aspectRatio?.trim() || '1:1'
  const imageSize = body.imageSize?.trim() || '1K'

  if (!model || !SUPPORTED_MODELS.has(model)) {
    return c.json({ error: 'Unsupported Gemini image model' }, 400)
  }

  if (!prompt) {
    return c.json({ error: 'Prompt is required' }, 400)
  }

  if (!SUPPORTED_ASPECT_RATIOS.has(aspectRatio)) {
    return c.json({ error: 'Unsupported aspect ratio' }, 400)
  }

  if (!SUPPORTED_IMAGE_SIZES.has(imageSize)) {
    return c.json({ error: 'Unsupported image size' }, 400)
  }

  const warnings: string[] = []
  const images: Array<{ mimeType: string; dataUrl: string }> = []
  let text = ''

  for (let index = 0; index < count; index += 1) {
    try {
      const result = await callGeminiImageModel({
        apiKey,
        model,
        prompt,
        referenceImages,
        aspectRatio,
        imageSize,
      })

      if (!text && result.text) {
        text = result.text
      }

      if (result.images.length === 0) {
        warnings.push(`Attempt ${index + 1} returned no image.`)
        continue
      }

      for (const image of result.images) {
        images.push(image)
        if (images.length >= count) {
          break
        }
      }

      if (images.length >= count) {
        break
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error))
    }
  }

  if (images.length === 0) {
    return c.json({ error: warnings[0] || 'Gemini returned no images.' }, 500)
  }

  return c.json({
    images: images.slice(0, count),
    ...(text ? { text } : {}),
    ...(warnings.length ? { warnings } : {}),
  })
})

export { geminiImagesRoute }
