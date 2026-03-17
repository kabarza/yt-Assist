import { Hono } from 'hono'
import {
  generateGeminiImages,
  getGeminiErrorMessage,
  validateGeminiRequestShape,
} from '../lib/geminiImage'

const geminiImagesRoute = new Hono()

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

  const validationError = validateGeminiRequestShape({
    model,
    prompt,
    aspectRatio,
    imageSize,
  })
  if (validationError) {
    return c.json({ error: validationError }, 400)
  }

  try {
    const result = await generateGeminiImages({
      apiKey,
      model,
      prompt,
      referenceImages,
      count,
      aspectRatio,
      imageSize,
    })

    return c.json(result)
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : getGeminiErrorMessage(error, 'Gemini returned no images.'),
      },
      500,
    )
  }
})

export { geminiImagesRoute }
