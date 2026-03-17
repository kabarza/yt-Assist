import { useSettingsStore } from '@/stores/settingsStore'
import type { CanvasExecuteNodeRequest, CanvasExecuteNodeResponse } from '@/types/canvasLab'
import { fetchApi } from '@/utils/fetchApi'

async function getResponseError(response: Response): Promise<string> {
  const text = await response.text().catch(() => '')

  if (text.trim()) {
    try {
      const data = JSON.parse(text)
      if (typeof data?.error === 'string' && data.error.trim()) {
        return data.error
      }
    } catch {
      // Ignore and fall back to a friendlier HTTP message.
    }
  }

  if (response.status === 404) {
    return 'Canvas execution endpoint was not found at POST /api/canvas/execute-node. Start or restart the API server before running Canvas Lab nodes.'
  }

  if (text.trim()) {
    return text.trim()
  }

  return `Canvas execution failed (${response.status})`
}

function getFetchError(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : ''
  if (message) {
    return `Canvas execution could not reach the API server. ${message}`
  }

  return 'Canvas execution could not reach the API server. Start or restart the API server before running Canvas Lab nodes.'
}

export async function requestCanvasNodeExecution(
  request: Omit<CanvasExecuteNodeRequest, 'packagingModel'>,
): Promise<CanvasExecuteNodeResponse> {
  const { settings } = useSettingsStore.getState()
  let response: Response

  try {
    response = await fetchApi('/api/canvas/execute-node', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...request,
        packagingModel: {
          model:
            settings.defaultProvider === 'openai' && settings.defaultModel
              ? settings.defaultModel
              : 'gpt-5.2',
          openaiApiKey: settings.openaiApiKey?.trim() || undefined,
        },
        chat: request.chat
          ? {
              ...request.chat,
              openaiApiKey: request.chat.openaiApiKey || settings.openaiApiKey?.trim() || undefined,
              anthropicApiKey:
                request.chat.anthropicApiKey || settings.anthropicApiKey?.trim() || undefined,
            }
          : undefined,
        imageGenerate: request.imageGenerate
          ? {
              ...request.imageGenerate,
              geminiApiKey:
                request.imageGenerate.geminiApiKey || settings.geminiApiKey?.trim() || undefined,
            }
          : undefined,
      }),
    })
  } catch (error) {
    throw new Error(getFetchError(error))
  }

  if (!response.ok) {
    throw new Error(await getResponseError(response))
  }

  return response.json()
}

export async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Could not read image blob'))
    }
    reader.onerror = () => reject(reader.error || new Error('Could not read image blob'))
    reader.readAsDataURL(blob)
  })
}
