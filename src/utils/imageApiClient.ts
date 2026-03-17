import { useSettingsStore } from '../stores/settingsStore'
import type {
  ImageAspectRatio,
  ImageGenerationModel,
  ImageSize,
} from '../types/images'
import { fetchApi } from './fetchApi'

export interface GenerateImagesOptions {
  model: ImageGenerationModel
  prompt: string
  referenceImages: Array<{
    dataUrl: string
    mimeType: string
  }>
  count: number
  aspectRatio: ImageAspectRatio
  imageSize: ImageSize
  signal?: AbortSignal
}

export interface GeneratedImageResult {
  mimeType: string
  dataUrl: string
}

export interface GenerateImagesResult {
  images: GeneratedImageResult[]
  text?: string
  warnings?: string[]
}

interface GenerateImagesRequestBody {
  model: ImageGenerationModel
  prompt: string
  referenceImages: Array<{
    dataUrl: string
    mimeType: string
  }>
  count: number
  aspectRatio: ImageAspectRatio
  imageSize: ImageSize
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

function buildRequestBody(options: GenerateImagesOptions): GenerateImagesRequestBody {
  const geminiApiKey = useSettingsStore.getState().settings.geminiApiKey?.trim()

  return {
    model: options.model,
    prompt: options.prompt,
    referenceImages: options.referenceImages.map((image) => ({
      dataUrl: image.dataUrl,
      mimeType: image.mimeType,
    })),
    count: options.count,
    aspectRatio: options.aspectRatio,
    imageSize: options.imageSize,
    ...(geminiApiKey ? { apiKeyOverride: geminiApiKey } : {}),
  }
}

export async function requestGeneratedImages(
  options: GenerateImagesOptions
): Promise<GenerateImagesResult> {
  const response = await fetchApi('/api/images/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildRequestBody(options)),
    signal: options.signal,
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
