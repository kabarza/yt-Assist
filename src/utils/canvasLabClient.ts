import { useSettingsStore } from '@/stores/settingsStore'
import type { CanvasExecuteNodeRequest, CanvasExecuteNodeResponse } from '@/types/canvasLab'

async function getResponseError(response: Response): Promise<string> {
  try {
    const data = await response.json()
    if (typeof data?.error === 'string' && data.error.trim()) {
      return data.error
    }
  } catch {
    // Ignore and fall back to text.
  }

  try {
    const text = await response.text()
    if (text.trim()) {
      return text.trim()
    }
  } catch {
    // Ignore.
  }

  return `Canvas execution failed (${response.status})`
}

export async function requestCanvasNodeExecution(
  request: Omit<CanvasExecuteNodeRequest, 'packagingModel'>,
): Promise<CanvasExecuteNodeResponse> {
  const { settings } = useSettingsStore.getState()
  const response = await fetch('/api/canvas/execute-node', {
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
