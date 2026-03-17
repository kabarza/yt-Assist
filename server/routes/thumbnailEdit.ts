import { Hono } from 'hono'
import {
  generateGeminiImages,
  type ReferenceImageInput,
} from '../lib/geminiImage'

const thumbnailEditRoute = new Hono()

type ThumbnailEditMode = 'replace' | 'remove_background' | 'outpaint'

interface ThumbnailEditRequest {
  mode: ThumbnailEditMode
  model: 'gemini-3.1-flash-image-preview' | 'gemini-3-pro-image-preview'
  prompt?: string
  count?: 1 | 2 | 4
  targetImage: ReferenceImageInput
  contextImage?: ReferenceImageInput
  board: {
    width: number
    height: number
  }
  layerFrame: {
    x: number
    y: number
    width: number
    height: number
  }
  outpaint?: {
    top: number
    right: number
    bottom: number
    left: number
  }
  apiKeyOverride?: string
}

const SUPPORTED_ASPECT_RATIOS = [
  { id: '1:1', ratio: 1 },
  { id: '3:2', ratio: 3 / 2 },
  { id: '16:9', ratio: 16 / 9 },
  { id: '9:16', ratio: 9 / 16 },
] as const

function deriveAspectRatio(width: number, height: number) {
  const targetRatio = width > 0 && height > 0 ? width / height : 16 / 9

  return SUPPORTED_ASPECT_RATIOS
    .map((entry) => ({
      id: entry.id,
      distance: Math.abs(entry.ratio - targetRatio),
    }))
    .sort((a, b) => a.distance - b.distance)[0]?.id || '16:9'
}

function deriveImageSize(width: number, height: number) {
  return Math.max(width, height) > 1280 || width * height > 1280 * 720 ? '2K' : '1K'
}

function sanitizeCount(count: ThumbnailEditRequest['count']) {
  if (count === 2 || count === 4) {
    return count
  }

  return 1
}

function buildPrompt(body: ThumbnailEditRequest) {
  const userPrompt = body.prompt?.trim()

  if (body.mode === 'remove_background') {
    return [
      'Edit the target image for a YouTube thumbnail workflow.',
      'Keep the main subject intact and cleanly remove the background as much as possible.',
      'Preserve subject details, edges, lighting, and silhouette.',
      'Do not add extra props, extra people, or a new background.',
      'Best effort result is acceptable even if transparency is not guaranteed.',
      userPrompt ? `Extra direction: ${userPrompt}` : null,
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (body.mode === 'outpaint') {
    const outpaint = body.outpaint || { top: 0, right: 0, bottom: 0, left: 0 }
    return [
      'Edit the target image for a YouTube thumbnail workflow.',
      'Expand the composition into the newly requested empty space while keeping the existing subject identity and style consistent.',
      'Preserve the visible content that already exists.',
      `Expand amounts in pixels: top ${outpaint.top}, right ${outpaint.right}, bottom ${outpaint.bottom}, left ${outpaint.left}.`,
      `Target board: ${body.board.width}x${body.board.height}.`,
      `Layer frame after expansion: x ${Math.round(body.layerFrame.x)}, y ${Math.round(body.layerFrame.y)}, width ${Math.round(body.layerFrame.width)}, height ${Math.round(body.layerFrame.height)}.`,
      userPrompt ? `Direction: ${userPrompt}` : 'Fill the expanded area naturally and keep the subject production-ready.',
    ].join('\n')
  }

  return [
    'Edit the target image for a YouTube thumbnail workflow.',
    'Keep the composition punchy and readable at thumbnail size.',
    userPrompt || 'Refine the selected image while preserving the subject and overall framing.',
  ].join('\n')
}

thumbnailEditRoute.post('/', async (c) => {
  try {
    const body = await c.req.json<ThumbnailEditRequest>()
    const apiKey = body.apiKeyOverride?.trim() || process.env.GEMINI_API_KEY || ''

    if (!apiKey) {
      return c.json({ error: 'GEMINI_API_KEY not configured' }, 500)
    }

    if (!body.targetImage?.dataUrl || !body.targetImage?.mimeType) {
      return c.json({ error: 'Target image is required' }, 400)
    }

    if (!body.board?.width || !body.board?.height) {
      return c.json({ error: 'Board size is required' }, 400)
    }

    const aspectRatio = deriveAspectRatio(body.board.width, body.board.height)
    const imageSize = deriveImageSize(body.board.width, body.board.height)
    const count = sanitizeCount(body.count)

    const result = await generateGeminiImages({
      apiKey,
      model: body.model,
      prompt: buildPrompt(body),
      referenceImages: [
        body.targetImage,
        ...(body.contextImage ? [body.contextImage] : []),
      ],
      count,
      aspectRatio,
      imageSize,
    })

    return c.json(result)
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Thumbnail image edit failed',
      },
      500,
    )
  }
})

export { thumbnailEditRoute }

