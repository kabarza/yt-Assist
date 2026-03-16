import Anthropic from '@anthropic-ai/sdk'
import { Hono } from 'hono'
import OpenAI from 'openai'
import type { CanvasExecuteNodeRequest, CanvasExecuteNodeResponse } from '../../src/types/canvasLab'

const canvasRoute = new Hono()

function requireOpenAIClient(body: CanvasExecuteNodeRequest) {
  const apiKey = body.packagingModel?.openaiApiKey?.trim() || process.env.OPENAI_API_KEY || ''
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured for Canvas Lab.')
  }

  return new OpenAI({ apiKey })
}

function summarizeArtifacts(body: CanvasExecuteNodeRequest) {
  const sections: string[] = []

  if (body.transcript?.digest?.trim()) {
    sections.push(`Transcript digest:\n${body.transcript.digest.trim()}`)
  }

  if (body.transcript?.keyHooks?.length) {
    sections.push(`Key hooks:\n- ${body.transcript.keyHooks.join('\n- ')}`)
  }

  if (body.nodeKind === 'chapters' && body.transcript?.timestampMap?.trim()) {
    sections.push(`Timestamp map:\n${body.transcript.timestampMap.trim()}`)
  }

  if (body.brief) {
    sections.push(
      `Packaging brief:\n${[
        body.brief.mustInclude ? `Must include: ${body.brief.mustInclude}` : null,
        body.brief.niceToInclude ? `Nice to include: ${body.brief.niceToInclude}` : null,
        body.brief.avoidWords ? `Avoid: ${body.brief.avoidWords}` : null,
        body.brief.includeName && body.brief.nameForTitles
          ? `Use this name when useful: ${body.brief.nameForTitles}`
          : null,
        body.brief.additionalContext ? `Additional context: ${body.brief.additionalContext}` : null,
      ]
        .filter(Boolean)
        .join('\n')}`,
    )
  }

  if (body.artifacts.length > 0) {
    sections.push(
      `Connected artifacts:\n${body.artifacts
        .map((artifact) => {
          const items = artifact.items
            .slice(0, 12)
            .map((item) => {
              const flags = [item.accepted ? 'accepted' : '', item.pinned ? 'pinned' : '']
                .filter(Boolean)
                .join(', ')
              return `- ${item.text}${item.secondaryText ? ` | ${item.secondaryText}` : ''}${flags ? ` (${flags})` : ''}`
            })
            .join('\n')

          return `## ${artifact.label}\n${artifact.content || ''}${items ? `\n${items}` : ''}`
        })
        .join('\n\n')}`,
    )
  }

  if (body.thread.length > 0) {
    sections.push(
      `Node thread:\n${body.thread
        .slice(-8)
        .map((message) => `${message.role.toUpperCase()}: ${message.text}`)
        .join('\n')}`,
    )
  }

  return sections.join('\n\n')
}

function buildSchema(kind: CanvasExecuteNodeRequest['nodeKind'], requestedCount = 1) {
  switch (kind) {
    case 'titles':
      return {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            items: {
              type: 'array',
              minItems: requestedCount,
              maxItems: requestedCount,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  text: { type: 'string' },
                  secondaryText: { type: 'string' },
                  angle: { type: 'string' },
                },
                required: ['text', 'secondaryText', 'angle'],
              },
            },
          },
          required: ['items'],
        },
      }
    case 'thumbnail_copy':
      return {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            items: {
              type: 'array',
              minItems: requestedCount,
              maxItems: requestedCount,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  text: { type: 'string' },
                  secondaryText: { type: 'string' },
                },
                required: ['text', 'secondaryText'],
              },
            },
          },
          required: ['items'],
        },
      }
    case 'chapters':
      return {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            items: {
              type: 'array',
              minItems: 3,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  text: { type: 'string' },
                  secondaryText: { type: 'string' },
                },
                required: ['text', 'secondaryText'],
              },
            },
          },
          required: ['items'],
        },
      }
    case 'summary':
      return {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            content: { type: 'string' },
            items: {
              type: 'array',
              minItems: 2,
              maxItems: 4,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  text: { type: 'string' },
                },
                required: ['text'],
              },
            },
          },
          required: ['content', 'items'],
        },
      }
    case 'image_prompt':
      return {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            content: { type: 'string' },
            items: {
              type: 'array',
              minItems: 2,
              maxItems: 4,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  text: { type: 'string' },
                },
                required: ['text'],
              },
            },
          },
          required: ['content', 'items'],
        },
      }
    default:
      return {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            content: { type: 'string' },
          },
          required: ['content'],
        },
      }
  }
}

function buildPackagingPrompt(body: CanvasExecuteNodeRequest) {
  const requestedCount = body.requestedCount || 1

  const taskInstruction =
    body.nodeKind === 'titles'
      ? `Generate exactly ${requestedCount} YouTube title ideas. Each item must also include short thumbnail text.`
      : body.nodeKind === 'thumbnail_copy'
      ? `Generate exactly ${requestedCount} short thumbnail text ideas. Keep them punchy and 1-4 words when possible.`
      : body.nodeKind === 'chapters'
      ? 'Generate a chapter list with timestamps and chapter titles.'
      : body.nodeKind === 'summary'
      ? 'Write one strong YouTube summary plus a few supporting takeaways.'
      : 'Write an image prompt for a thumbnail generation model based on the connected context.'

  const extraRules =
    body.nodeKind === 'titles'
      ? 'Titles should feel click-worthy but not spammy. Avoid obvious duplicates.'
      : body.nodeKind === 'thumbnail_copy'
      ? 'Do not repeat the title directly. Focus on contrast, curiosity, or outcome.'
      : body.nodeKind === 'chapters'
      ? 'Return timestamps in ascending order and keep titles concise.'
      : body.nodeKind === 'image_prompt'
      ? 'The image prompt should be production-ready and specific about composition, lighting, subject focus, and style.'
      : 'Keep the summary useful and readable.'

  return `${taskInstruction}

${extraRules}

Use the context below and respond with JSON that matches the provided schema.

${summarizeArtifacts(body)}`
}

async function runStructuredPackaging(body: CanvasExecuteNodeRequest): Promise<CanvasExecuteNodeResponse> {
  const client = requireOpenAIClient(body)
  const schema = buildSchema(body.nodeKind, body.requestedCount)
  const model = body.packagingModel?.model || 'gpt-5.2'

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          'You generate structured YouTube packaging outputs for a graph-based creative workspace. Be concise, strategic, and strictly follow the JSON schema.',
      },
      {
        role: 'user',
        content: buildPackagingPrompt(body),
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: `${body.nodeKind}_node_response`,
        schema: schema.schema,
        strict: true,
      },
    },
  } as any)

  const content = response.choices[0]?.message?.content || '{}'
  const parsed = JSON.parse(content)

  return {
    provider: 'openai',
    model,
    content: typeof parsed.content === 'string' ? parsed.content : undefined,
    items: Array.isArray(parsed.items) ? parsed.items : [],
  }
}

function toAnthropicContext(body: CanvasExecuteNodeRequest) {
  return `You are answering inside a node-based creative workspace. Use the connected context below when relevant.

${summarizeArtifacts(body)}

Question:
${body.chat?.prompt || ''}`
}

async function runChatNode(body: CanvasExecuteNodeRequest): Promise<CanvasExecuteNodeResponse> {
  if (!body.chat?.prompt?.trim()) {
    throw new Error('Chat node prompt is empty.')
  }

  if (body.chat.provider === 'anthropic') {
    const apiKey = body.chat.anthropicApiKey?.trim() || process.env.ANTHROPIC_API_KEY || ''
    if (!apiKey) {
      throw new Error('Anthropic API key is not configured for Canvas Lab.')
    }

    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: body.chat.model || 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system:
        body.chat.systemPrompt?.trim() ||
        'Answer clearly, use the connected node context when relevant, and keep the response compact.',
      messages: [
        {
          role: 'user',
          content: toAnthropicContext(body),
        },
      ],
    })

    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    return {
      provider: 'anthropic',
      model: body.chat.model,
      content,
    }
  }

  const client = requireOpenAIClient({
    ...body,
    packagingModel: {
      model: body.chat.model,
      openaiApiKey: body.chat.openaiApiKey,
    },
  })

  const response = await client.chat.completions.create({
    model: body.chat.model,
    messages: [
      {
        role: 'system',
        content:
          body.chat.systemPrompt?.trim() ||
          'Answer clearly, use the connected node context when relevant, and keep the response compact.',
      },
      {
        role: 'user',
        content: summarizeArtifacts(body),
      },
      {
        role: 'user',
        content: body.chat.prompt,
      },
    ],
  })

  return {
    provider: 'openai',
    model: body.chat.model,
    content: response.choices[0]?.message?.content || '',
  }
}

interface ReferenceImageInput {
  dataUrl: string
  mimeType: string
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
    },
  )

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(getErrorMessage(payload, `Gemini image request failed (${response.status})`))
  }

  const candidates = Array.isArray((payload as { candidates?: unknown[] } | null)?.candidates)
    ? ((payload as {
        candidates: Array<{
          content?: { parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } }> }
        }>
      }).candidates)
    : []

  const partsFromCandidates = candidates.flatMap((candidate) => candidate.content?.parts ?? [])
  return partsFromCandidates.flatMap((part) => {
    const inlineData = part.inlineData ?? part.inline_data
    const mimeType =
      inlineData && 'mimeType' in inlineData
        ? inlineData.mimeType
        : inlineData && 'mime_type' in inlineData
        ? inlineData.mime_type
        : undefined
    if (!mimeType || !inlineData?.data) return []
    return [
      {
        mimeType,
        dataUrl: `data:${mimeType};base64,${inlineData.data}`,
      },
    ]
  })
}

async function runImageNode(body: CanvasExecuteNodeRequest): Promise<CanvasExecuteNodeResponse> {
  if (!body.imageGenerate) {
    throw new Error('Image generation payload is missing.')
  }

  const apiKey = body.imageGenerate.geminiApiKey?.trim() || process.env.GEMINI_API_KEY || ''
  if (!apiKey) {
    throw new Error('Gemini API key is not configured for Canvas Lab.')
  }

  const images: Array<{ mimeType: string; dataUrl: string }> = []
  for (let index = 0; index < body.imageGenerate.count; index += 1) {
    const nextImages = await callGeminiImageModel({
      apiKey,
      model: body.imageGenerate.model,
      prompt: body.imageGenerate.prompt,
      referenceImages: body.imageGenerate.referenceImages,
      aspectRatio: body.imageGenerate.aspectRatio,
      imageSize: body.imageGenerate.imageSize,
    })
    if (nextImages.length > 0) {
      images.push(nextImages[0])
    }
  }

  if (images.length === 0) {
    throw new Error('Gemini returned no images for this run.')
  }

  return {
    provider: 'gemini',
    model: body.imageGenerate.model,
    items: images.map((image, index) => ({
      text: `Generated image ${index + 1}`,
      imageDataUrl: image.dataUrl,
      mimeType: image.mimeType,
      name: `Canvas Lab ${index + 1}`,
    })),
  }
}

canvasRoute.post('/execute-node', async (c) => {
  try {
    const body = await c.req.json<CanvasExecuteNodeRequest>()

    const response =
      body.nodeKind === 'chat'
        ? await runChatNode(body)
        : body.nodeKind === 'image_generate'
        ? await runImageNode(body)
        : await runStructuredPackaging(body)

    return c.json(response)
  } catch (error) {
    console.error('Canvas node execution failed:', error)
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Canvas node execution failed',
      },
      500,
    )
  }
})

export { canvasRoute }
