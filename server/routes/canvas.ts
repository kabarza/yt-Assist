import Anthropic from '@anthropic-ai/sdk'
import { Hono } from 'hono'
import OpenAI from 'openai'
import type {
  CanvasExecuteNodeRequest,
  CanvasExecuteNodeResponse,
  PackagingOutputNodeKind,
  PromptBuilderOutputDefinition,
} from '../../src/types/canvasLab'

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
        body.brief.additionalContext ? `Packaging directions: ${body.brief.additionalContext}` : null,
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

function normalizePackagingNodeKind(
  kind: CanvasExecuteNodeRequest['nodeKind'],
): PackagingOutputNodeKind | 'transcript_source' | 'image_prompt' {
  if (kind === 'summary') return 'description'
  if (kind === 'transcript_source' || kind === 'image_prompt') return kind
  return kind as PackagingOutputNodeKind
}

function buildOutputPayloadSchema(kind: PackagingOutputNodeKind | 'image_prompt', requestedCount = 1) {
  switch (kind) {
    case 'core_hook':
      return {
        type: 'object',
        additionalProperties: false,
        properties: {
          content: { type: 'string' },
          items: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
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
      }
    case 'description':
      return {
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
              },
              required: ['text'],
            },
          },
        },
        required: ['items'],
      }
    case 'titles':
      return {
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
      }
    case 'thumbnail_copy':
      return {
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
      }
    case 'chapters':
      return {
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
      }
    case 'hashtags':
      return {
        type: 'object',
        additionalProperties: false,
        properties: {
          content: { type: 'string' },
          items: {
            type: 'array',
            minItems: requestedCount,
            maxItems: requestedCount,
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
      }
    case 'image_prompt':
      return {
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
      }
  }
}

function buildSchema(kind: PackagingOutputNodeKind | 'transcript_source' | 'image_prompt', body: CanvasExecuteNodeRequest) {
  if (kind === 'transcript_source') {
    const selectedOutputs = body.selectedOutputs || {}
    const selectedKinds = Object.entries(selectedOutputs)
      .filter(([, selection]) => selection?.enabled)
      .map(([outputKind]) => outputKind as PackagingOutputNodeKind)

    return {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          outputs: {
            type: 'object',
            additionalProperties: false,
            properties: Object.fromEntries(
              selectedKinds.map((outputKind) => [
                outputKind,
                buildOutputPayloadSchema(outputKind, selectedOutputs[outputKind]?.count || 1),
              ]),
            ),
            required: selectedKinds,
          },
        },
        required: ['outputs'],
      },
    }
  }

  return {
    schema: buildOutputPayloadSchema(kind, body.requestedCount || 1),
  }
}

function getRequestedPromptBuilderOutputs(body: CanvasExecuteNodeRequest) {
  const outputs = body.promptBuilder?.outputs || []
  if (!body.targetOutputId) {
    return outputs.filter((output) => output.enabled)
  }

  return outputs.filter((output) => output.outputId === body.targetOutputId)
}

function buildPromptBuilderOutputSchema(output: PromptBuilderOutputDefinition) {
  if (
    output.outputType === 'core_hook' ||
    output.outputType === 'description' ||
    output.outputType === 'titles' ||
    output.outputType === 'thumbnail_copy' ||
    output.outputType === 'chapters' ||
    output.outputType === 'hashtags' ||
    output.outputType === 'image_prompt'
  ) {
    return buildOutputPayloadSchema(output.outputType, output.requestedCount)
  }

  if (output.presentation === 'combined_block') {
    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        content: { type: 'string' },
      },
      required: ['content'],
    }
  }

  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      items: {
        type: 'array',
        minItems: output.requestedCount,
        maxItems: output.requestedCount,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            text: { type: 'string' },
            secondaryText: { type: 'string' },
          },
          required: ['text'],
        },
      },
    },
    required: ['items'],
  }
}

function buildPromptBuilderOutputInstruction(output: PromptBuilderOutputDefinition) {
  const promptHint = output.promptHint.trim()
  const hintText = promptHint ? ` Additional hint: ${promptHint}` : ''

  switch (output.outputType) {
    case 'core_hook':
      return `- ${output.outputId} (${output.label}): write one concise core hook as exactly 2 lines.${hintText}`
    case 'description':
      return `- ${output.outputId} (${output.label}): generate exactly ${output.requestedCount} publish-ready YouTube descriptions.${hintText}`
    case 'titles':
      return `- ${output.outputId} (${output.label}): generate exactly ${output.requestedCount} titles, each with short thumbnail text.${hintText}`
    case 'thumbnail_copy':
      return `- ${output.outputId} (${output.label}): generate exactly ${output.requestedCount} short thumbnail text options.${hintText}`
    case 'chapters':
      return `- ${output.outputId} (${output.label}): generate around ${output.requestedCount} timestamped chapters in ascending order.${hintText}`
    case 'hashtags':
      return `- ${output.outputId} (${output.label}): generate exactly ${output.requestedCount} hashtags as one copy-ready block.${hintText}`
    case 'image_prompt':
      return `- ${output.outputId} (${output.label}): generate a production-ready image prompt.${hintText}`
    default:
      if (output.presentation === 'combined_block') {
        return `- ${output.outputId} (${output.label}): generate one polished combined block. Aim for roughly ${output.requestedCount} useful elements if relevant.${hintText}`
      }
      return `- ${output.outputId} (${output.label}): generate exactly ${output.requestedCount} separate row-style items.${hintText}`
  }
}

function buildPromptBuilderPrompt(
  body: CanvasExecuteNodeRequest,
  outputs: PromptBuilderOutputDefinition[],
) {
  return `You are generating structured outputs for a visual prompt builder inside Canvas Lab.

Return strict JSON only.

Shared instruction:
${body.promptBuilder?.sharedInstruction?.trim() || 'No extra shared instruction provided.'}

Requested outputs:
${outputs.map((output) => buildPromptBuilderOutputInstruction(output)).join('\n')}

${summarizeArtifacts(body)}`
}

function buildTranscriptOutputSpecs(body: CanvasExecuteNodeRequest) {
  const selectedOutputs = body.selectedOutputs || {}
  const lines: string[] = []

  for (const [kind, selection] of Object.entries(selectedOutputs)) {
    if (!selection?.enabled) continue
    switch (kind as PackagingOutputNodeKind) {
      case 'core_hook':
        lines.push('- core_hook: exactly 2 lines explaining what the video is really about and why someone should click')
        break
      case 'description':
        lines.push(`- description: exactly ${selection.count} YouTube descriptions, each publish-ready and not robotic`)
        break
      case 'titles':
        lines.push(`- titles: exactly ${selection.count} titles, each with a paired thumbnail-text companion`)
        break
      case 'thumbnail_copy':
        lines.push(`- thumbnail_copy: exactly ${selection.count} extra thumbnail text options, 1-4 words when possible`)
        break
      case 'chapters':
        lines.push(`- chapters: generate around ${selection.count} timestamped chapters in ascending order`)
        break
      case 'hashtags':
        lines.push(`- hashtags: exactly ${selection.count} relevant hashtags, also return a joined copy-ready hashtag line`)
        break
    }
  }

  return lines.join('\n')
}

function buildPackagingPrompt(body: CanvasExecuteNodeRequest) {
  const requestedCount = body.requestedCount || 1
  const normalizedKind = normalizePackagingNodeKind(body.nodeKind)

  if (normalizedKind === 'transcript_source') {
    return `You are generating YouTube packaging outputs from one transcript inside a node-based workspace.

Use the creator packaging context below and return strict JSON only.

Apply these packaging principles:
- Titles should be click-worthy but not dishonest.
- Thumbnail copy should complement titles, not repeat them.
- Descriptions should feel publish-ready and specific.
- Chapters must use ascending timestamps and concise labels.
- Hashtags must be relevant and non-spammy.
- Avoid generic AI wording and filler.

Requested outputs:
${buildTranscriptOutputSpecs(body)}

${summarizeArtifacts(body)}`
  }

  const taskInstruction =
    normalizedKind === 'core_hook'
      ? 'Write one concise core hook and return exactly 2 lines: what the video is really about, and why someone should click.'
      : normalizedKind === 'description'
      ? `Generate exactly ${requestedCount} publish-ready YouTube descriptions.`
      : normalizedKind === 'titles'
      ? `Generate exactly ${requestedCount} YouTube title ideas. Each item must also include short thumbnail text.`
      : normalizedKind === 'thumbnail_copy'
      ? `Generate exactly ${requestedCount} short thumbnail text ideas. Keep them punchy and 1-4 words when possible.`
      : normalizedKind === 'chapters'
      ? 'Generate a chapter list with timestamps and chapter titles.'
      : normalizedKind === 'hashtags'
      ? `Generate exactly ${requestedCount} relevant hashtags and also return a copy-ready joined hashtag line.`
      : normalizedKind === 'description'
      ? `Generate exactly ${requestedCount} publish-ready YouTube descriptions.`
      : 'Write an image prompt for a thumbnail generation model based on the connected context.'

  const extraRules =
    normalizedKind === 'core_hook'
      ? 'Keep the core hook concrete and high-signal.'
      : normalizedKind === 'description'
      ? 'Descriptions should open strong, feel human, and mention concrete transcript details.'
      : normalizedKind === 'titles'
      ? 'Titles should feel click-worthy but not spammy. Avoid obvious duplicates.'
      : normalizedKind === 'thumbnail_copy'
      ? 'Do not repeat the title directly. Focus on contrast, curiosity, or outcome.'
      : normalizedKind === 'chapters'
      ? 'Return timestamps in ascending order and keep titles concise.'
      : normalizedKind === 'hashtags'
      ? 'Use only relevant tags that would plausibly help discovery.'
      : normalizedKind === 'image_prompt'
      ? 'The image prompt should be production-ready and specific about composition, lighting, subject focus, and style.'
      : 'Keep the output useful and readable.'

  return `${taskInstruction}

${extraRules}

Use the context below and respond with JSON that matches the provided schema.

${summarizeArtifacts(body)}`
}

async function runStructuredPackaging(body: CanvasExecuteNodeRequest): Promise<CanvasExecuteNodeResponse> {
  const client = requireOpenAIClient(body)
  const normalizedKind = normalizePackagingNodeKind(body.nodeKind)
  const schema = buildSchema(normalizedKind, body)
  const model = body.packagingModel?.model || 'gpt-5.2'
  const requestPreview = buildPackagingPrompt(body)

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          normalizedKind === 'transcript_source'
            ? 'You generate structured YouTube packaging outputs for a transcript-first creative workspace. Be strategic and strictly follow the JSON schema.'
            : 'You generate structured YouTube packaging outputs for a graph-based creative workspace. Be concise, strategic, and strictly follow the JSON schema.',
      },
      {
        role: 'user',
        content: requestPreview,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: `${normalizedKind}_node_response`,
        schema: schema.schema,
        strict: true,
      },
    },
  } as any)

  const content = response.choices[0]?.message?.content || '{}'
  const parsed = JSON.parse(content)
  const responsePreview = JSON.stringify(parsed, null, 2)

  const normalizeItems = (items: unknown) =>
    Array.isArray(items)
      ? items.map((item: Record<string, unknown>) => ({
          text: typeof item.text === 'string' ? item.text : '',
          secondaryText: typeof item.secondaryText === 'string' ? item.secondaryText : undefined,
          meta:
            typeof item.angle === 'string' && item.angle.trim()
              ? { angle: item.angle }
              : undefined,
        }))
      : []

  if (normalizedKind === 'transcript_source') {
    return {
      provider: 'openai',
      model,
      outputs: Object.fromEntries(
        Object.entries(parsed.outputs || {}).map(([outputKind, value]) => [
          outputKind,
          {
            content:
              typeof (value as { content?: unknown }).content === 'string'
                ? (value as { content: string }).content
                : undefined,
            items: normalizeItems((value as { items?: unknown }).items),
          },
        ]),
      ),
      requestPreview,
      responsePreview,
    }
  }

  return {
    provider: 'openai',
    model,
    content: typeof parsed.content === 'string' ? parsed.content : undefined,
    items: normalizeItems(parsed.items),
    requestPreview,
    responsePreview,
  }
}

async function runPromptBuilderNode(body: CanvasExecuteNodeRequest): Promise<CanvasExecuteNodeResponse> {
  const outputs = getRequestedPromptBuilderOutputs(body)
  if (outputs.length === 0) {
    throw new Error('Prompt Builder needs at least one output to run.')
  }

  const client = requireOpenAIClient(body)
  const model = body.packagingModel?.model || 'gpt-5.2'
  const requestPreview = buildPromptBuilderPrompt(body, outputs)

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          body.promptBuilder?.systemPrompt?.trim() ||
          'You generate structured outputs for a visual prompt-builder workspace. Be strategic and strictly follow the JSON schema.',
      },
      {
        role: 'user',
        content: requestPreview,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'prompt_builder_response',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            outputs: {
              type: 'object',
              additionalProperties: false,
              properties: Object.fromEntries(
                outputs.map((output) => [output.outputId, buildPromptBuilderOutputSchema(output)]),
              ),
              required: outputs.map((output) => output.outputId),
            },
          },
          required: ['outputs'],
        },
        strict: true,
      },
    },
  } as any)

  const content = response.choices[0]?.message?.content || '{}'
  const parsed = JSON.parse(content)
  const responsePreview = JSON.stringify(parsed, null, 2)

  const normalizeItems = (items: unknown) =>
    Array.isArray(items)
      ? items.map((item: Record<string, unknown>) => ({
          text: typeof item.text === 'string' ? item.text : '',
          secondaryText: typeof item.secondaryText === 'string' ? item.secondaryText : undefined,
          meta:
            typeof item.angle === 'string' && item.angle.trim()
              ? { angle: item.angle }
              : undefined,
        }))
      : []

  return {
    provider: 'openai',
    model,
    outputs: Object.fromEntries(
      outputs.map((output) => {
        const value = parsed.outputs?.[output.outputId] as { content?: unknown; items?: unknown } | undefined
        return [
          output.outputId,
          {
            content: typeof value?.content === 'string' ? value.content : undefined,
            items: normalizeItems(value?.items),
            payload: value,
            presentation: output.presentation,
            outputLabel: output.label,
            outputType: output.outputType,
          },
        ]
      }),
    ),
    requestPreview,
    responsePreview,
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
        : body.nodeKind === 'prompt_builder' || body.nodeKind === 'prompt_output'
        ? await runPromptBuilderNode(body)
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
