import Anthropic from '@anthropic-ai/sdk'
import { Hono } from 'hono'
import OpenAI from 'openai'
import type {
  CanvasExecuteNodeRequest,
  CanvasExecuteNodeResponse,
  CanvasStructuredProvider,
  PackagingOutputNodeKind,
  PromptBuilderOutputDefinition,
} from '../../src/types/canvasLab'
import {
  buildMultiOutputContract,
  buildOutputInstruction,
  buildSingleOutputContract,
  coerceOutputContractPayload,
  promptBuilderOutputToContractField,
  promptProgramOutputToContractField,
  validateOutputContractPayload,
  validationIssuesToText,
} from '../../src/lib/canvasOutputContract'

const canvasRoute = new Hono()

const DEFAULT_STRUCTURED_MODELS: Record<CanvasStructuredProvider, string> = {
  openai: 'gpt-5.2',
  anthropic: 'claude-sonnet-4-20250514',
  gemini: 'gemini-3.1-pro-preview',
}

function requireOpenAIClient(body: CanvasExecuteNodeRequest) {
  const apiKey = body.packagingModel?.openaiApiKey?.trim() || process.env.OPENAI_API_KEY || ''
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured for Canvas Lab.')
  }

  return new OpenAI({ apiKey })
}

function requireAnthropicClient(body: CanvasExecuteNodeRequest) {
  const apiKey = body.packagingModel?.anthropicApiKey?.trim() || process.env.ANTHROPIC_API_KEY || ''
  if (!apiKey) {
    throw new Error('Anthropic API key is not configured for Canvas Lab.')
  }

  return new Anthropic({ apiKey })
}

function requireGeminiApiKey(body: CanvasExecuteNodeRequest) {
  const apiKey = body.packagingModel?.geminiApiKey?.trim() || process.env.GEMINI_API_KEY || ''
  if (!apiKey) {
    throw new Error('Gemini API key is not configured for Canvas Lab.')
  }

  return apiKey
}

function getStructuredProvider(body: CanvasExecuteNodeRequest): CanvasStructuredProvider {
  return body.packagingModel?.provider || 'openai'
}

function getStructuredModel(body: CanvasExecuteNodeRequest) {
  const provider = getStructuredProvider(body)
  const requestedModel = body.packagingModel?.model?.trim()
  return requestedModel || DEFAULT_STRUCTURED_MODELS[provider]
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

function getTranscriptPromptProgramFields(body: CanvasExecuteNodeRequest) {
  return (body.promptProgram?.outputSchema || [])
    .filter((field) => field.enabled)
    .map((field) => promptProgramOutputToContractField(field))
}

function buildPromptProgramOutputSpecs(body: CanvasExecuteNodeRequest) {
  return getTranscriptPromptProgramFields(body)
    .map((field) => buildOutputInstruction(field))
    .join('\n')
}

function buildTranscriptPromptProgramPrompt(body: CanvasExecuteNodeRequest) {
  const additionalContext = buildPromptProgramOutputSpecs(body)

  return `You are generating transcript-driven outputs inside Canvas Lab.

Return strict JSON only.

Use these rules:
- Keep each output grounded in the transcript.
- Avoid filler, generic AI phrasing, and fabricated claims.
- Apply optional guidance only when it is provided.
- Respect each output's count and shape exactly.

Requested outputs:
${additionalContext || '- No outputs were enabled.'}

${summarizeArtifacts(body)}`
}

function getTranscriptOutputContract(body: CanvasExecuteNodeRequest) {
  const fields = getTranscriptPromptProgramFields(body)
  if (fields.length === 0) {
    throw new Error('Transcript Source needs at least one enabled output.')
  }

  return buildMultiOutputContract('transcript_source_response', fields)
}

function getPromptBuilderOutputContract(body: CanvasExecuteNodeRequest) {
  const outputs = getRequestedPromptBuilderOutputs(body)
  if (outputs.length === 0) {
    throw new Error('Prompt Builder needs at least one output to run.')
  }

  return buildMultiOutputContract(
    'prompt_builder_response',
    outputs.map((output) => promptBuilderOutputToContractField(output)),
  )
}

function getSingleNodeContract(body: CanvasExecuteNodeRequest) {
  const normalizedKind = normalizePackagingNodeKind(body.nodeKind)
  const requestedCount = body.requestedCount || 1

  const field = promptBuilderOutputToContractField({
    outputId: normalizedKind,
    label: body.nodeLabel,
    enabled: true,
    requestedCount,
    presentation:
      normalizedKind === 'core_hook' || normalizedKind === 'hashtags' || normalizedKind === 'image_prompt'
        ? 'combined_block'
        : 'rows',
    promptHint: '',
    outputType: normalizedKind,
  } satisfies PromptBuilderOutputDefinition)

  return buildSingleOutputContract(`${normalizedKind}_response`, field)
}

function parseGeminiStructuredPayload(payload: unknown) {
  const candidates = Array.isArray((payload as { candidates?: unknown[] } | null)?.candidates)
    ? ((payload as {
        candidates: Array<{
          content?: { parts?: Array<{ text?: string }> }
        }>
      }).candidates)
    : []

  const text = candidates
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || '')
    .join('')
    .trim()

  if (!text) {
    throw new Error('Gemini returned no structured JSON text.')
  }

  return JSON.parse(text)
}

async function requestStructuredOutputFromProvider(
  body: CanvasExecuteNodeRequest,
  contractName: string,
  contractSchema: Record<string, unknown>,
  systemPrompt: string,
  userPrompt: string,
) {
  const provider = getStructuredProvider(body)
  const model = getStructuredModel(body)

  if (provider === 'anthropic') {
    const client = requireAnthropicClient(body)
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      tools: [
        {
          name: 'capture_output',
          description: 'Return the final structured output that matches the schema exactly.',
          input_schema: contractSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: {
        type: 'tool',
        name: 'capture_output',
        disable_parallel_tool_use: true,
      },
    })

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock =>
        block.type === 'tool_use' && block.name === 'capture_output',
    )

    if (!toolUse) {
      throw new Error('Anthropic did not return a structured tool result.')
    }

    return {
      provider,
      model,
      parsed: toolUse.input,
    }
  }

  if (provider === 'gemini') {
    const apiKey = requireGeminiApiKey(body)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: contractSchema,
          },
        }),
      },
    )

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `Gemini structured output request failed (${response.status})`))
    }

    return {
      provider,
      model,
      parsed: parseGeminiStructuredPayload(payload),
    }
  }

  const client = requireOpenAIClient(body)
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: contractName,
        schema: contractSchema,
        strict: true,
      },
    },
  } as any)

  const content = response.choices[0]?.message?.content || '{}'
  return {
    provider,
    model,
    parsed: JSON.parse(content),
  }
}

async function requestValidatedStructuredOutput(
  body: CanvasExecuteNodeRequest,
  contract: ReturnType<typeof buildSingleOutputContract> | ReturnType<typeof buildMultiOutputContract>,
  systemPrompt: string,
  userPrompt: string,
) {
  const warnings: string[] = []
  let repairCount = 0
  let structured = await requestStructuredOutputFromProvider(
    body,
    contract.name,
    contract.schema,
    systemPrompt,
    userPrompt,
  )

  let validation = validateOutputContractPayload(contract, structured.parsed)
  if (!validation.valid) {
    warnings.push('Structured output failed validation on the first pass.')

    const repairPrompt = `Repair this structured JSON so it matches the schema exactly.

Validation issues:
${validationIssuesToText(validation.issues)}

Previous JSON:
${JSON.stringify(structured.parsed, null, 2)}`

    structured = await requestStructuredOutputFromProvider(
      body,
      `${contract.name}_repair`,
      contract.schema,
      `${systemPrompt}\n\nYou repair invalid structured JSON against a schema.`,
      repairPrompt,
    )
    repairCount += 1
    validation = validateOutputContractPayload(contract, structured.parsed)
  }

  if (!validation.valid) {
    warnings.push(`Structured output is still partially invalid after ${repairCount} repair pass.`)
  } else if (repairCount > 0) {
    warnings.push('Structured output was repaired after validation failed.')
  }

  return {
    provider: structured.provider,
    model: structured.model,
    warnings,
    repairCount,
    parsed: structured.parsed,
    normalized: coerceOutputContractPayload(contract, structured.parsed),
    responsePreview: JSON.stringify(structured.parsed, null, 2),
  }
}

async function runStructuredPackaging(body: CanvasExecuteNodeRequest): Promise<CanvasExecuteNodeResponse> {
  const normalizedKind = normalizePackagingNodeKind(body.nodeKind)
  if (normalizedKind === 'transcript_source') {
    const contract = getTranscriptOutputContract(body)
    const requestPreview = buildTranscriptPromptProgramPrompt(body)
    const result = await requestValidatedStructuredOutput(
      body,
      contract,
      'You generate strict structured outputs for a transcript-first creative workspace. Follow the response contract exactly.',
      requestPreview,
    )

    return {
      provider: result.provider,
      model: result.model,
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
      outputs: result.normalized,
      requestPreview,
      responsePreview: result.responsePreview,
    }
  }

  const contract = getSingleNodeContract(body)
  const requestPreview = buildPackagingPrompt(body)
  const result = await requestValidatedStructuredOutput(
    body,
    contract,
    'You generate structured outputs for a graph-based creative workspace. Be concise, strategic, and follow the response contract exactly.',
    requestPreview,
  )
  const payload = result.normalized[contract.fields[0].captureKey]

  return {
    provider: result.provider,
    model: result.model,
    warnings: result.warnings.length > 0 ? result.warnings : undefined,
    content: payload?.content,
    items: payload?.items,
    requestPreview,
    responsePreview: result.responsePreview,
  }
}

async function runPromptBuilderNode(body: CanvasExecuteNodeRequest): Promise<CanvasExecuteNodeResponse> {
  const outputs = getRequestedPromptBuilderOutputs(body)
  if (outputs.length === 0) {
    throw new Error('Prompt Builder needs at least one output to run.')
  }

  const contract = getPromptBuilderOutputContract(body)
  const requestPreview = buildPromptBuilderPrompt(body, outputs)
  const result = await requestValidatedStructuredOutput(
    body,
    contract,
    body.promptBuilder?.systemPrompt?.trim() ||
      'You generate structured outputs for a visual prompt-builder workspace. Be strategic and follow the response contract exactly.',
    requestPreview,
  )

  return {
    provider: result.provider,
    model: result.model,
    warnings: result.warnings.length > 0 ? result.warnings : undefined,
    outputs: Object.fromEntries(
      outputs.map((output) => {
        const value = result.normalized[output.outputId]
        return [
          output.outputId,
          {
            ...value,
            payload: value,
            presentation: output.presentation,
            outputLabel: output.label,
            outputType: output.outputType,
          },
        ]
      }),
    ),
    requestPreview,
    responsePreview: result.responsePreview,
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
