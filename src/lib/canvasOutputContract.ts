import type {
  CanvasExecutionOutputPayload,
  OutputContractDefinition,
  OutputContractField,
  OutputContractValidationIssue,
  PromptBuilderOutputDefinition,
  PromptProgramOutputField,
  PromptOutputType,
} from '../types/canvasLab'
import { isPackagingOutputType } from './canvasPromptProgram'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeLineItems(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function buildGenericItemsSchema(count: number, requireSecondaryText = false) {
  return {
    type: 'array',
    minItems: count,
    maxItems: count,
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        text: { type: 'string' },
        secondaryText: { type: 'string' },
      },
      required: requireSecondaryText ? ['text', 'secondaryText'] : ['text'],
    },
  }
}

function buildFieldSchema(field: OutputContractField) {
  switch (field.outputType) {
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
          items: buildGenericItemsSchema(field.count),
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
            minItems: field.count,
            maxItems: field.count,
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
          items: buildGenericItemsSchema(field.count, true),
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
            minItems: field.count,
            maxItems: field.count,
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
            minItems: field.count,
            maxItems: field.count,
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
            minItems: 1,
            maxItems: Math.max(1, field.count),
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
        required: ['content'],
      }
  }

  if (field.responseType === 'combined_block' || field.responseType === 'code_block') {
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
      items: buildGenericItemsSchema(field.count),
    },
    required: ['items'],
  }
}

function createContractField(input: {
  captureKey: string
  label: string
  description?: string
  promptHint?: string
  count: number
  outputType: PromptOutputType
  responseType: OutputContractField['responseType']
  grouping: OutputContractField['grouping']
}): OutputContractField {
  return {
    captureKey: input.captureKey,
    label: input.label,
    description: input.description,
    promptHint: input.promptHint,
    count: Math.max(1, Math.round(input.count || 1)),
    outputType: input.outputType,
    responseType: input.responseType,
    grouping: input.grouping,
  }
}

export function promptProgramOutputToContractField(
  field: PromptProgramOutputField,
): OutputContractField {
  return createContractField({
    captureKey: field.captureKey,
    label: field.label,
    description: field.description,
    promptHint: field.promptHint,
    count: field.count,
    outputType: field.outputType,
    responseType: field.responseType,
    grouping: field.grouping,
  })
}

export function promptBuilderOutputToContractField(
  output: PromptBuilderOutputDefinition,
): OutputContractField {
  return createContractField({
    captureKey: output.outputId,
    label: output.label,
    promptHint: output.promptHint,
    count: output.requestedCount,
    outputType: output.outputType,
    responseType: output.presentation === 'combined_block' ? 'combined_block' : 'text_item_list',
    grouping: output.presentation === 'combined_block' ? 'combined' : 'separate',
  })
}

export function buildSingleOutputContract(
  name: string,
  field: OutputContractField,
): OutputContractDefinition {
  return {
    name,
    schema: buildFieldSchema(field),
    fields: [field],
  }
}

export function buildMultiOutputContract(
  name: string,
  fields: OutputContractField[],
  wrapKey = 'outputs',
): OutputContractDefinition {
  return {
    name,
    wrapKey,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        [wrapKey]: {
          type: 'object',
          additionalProperties: false,
          properties: Object.fromEntries(
            fields.map((field) => [field.captureKey, buildFieldSchema(field)]),
          ),
          required: fields.map((field) => field.captureKey),
        },
      },
      required: [wrapKey],
    },
    fields,
  }
}

function readContractContainer(contract: OutputContractDefinition, payload: unknown) {
  if (!contract.wrapKey) {
    return isRecord(payload)
      ? { [contract.fields[0]?.captureKey || 'output']: payload }
      : {}
  }

  if (!isRecord(payload)) return {}
  const wrapped = payload[contract.wrapKey]
  return isRecord(wrapped) ? wrapped : {}
}

function validateItems(
  items: unknown,
  path: string,
  issues: OutputContractValidationIssue[],
  options: {
    min: number
    max: number
    requireSecondaryText?: boolean
    requireAngle?: boolean
  },
) {
  if (!Array.isArray(items)) {
    issues.push({ path, message: 'Expected an array of items.' })
    return
  }

  if (items.length < options.min || items.length > options.max) {
    issues.push({
      path,
      message: `Expected between ${options.min} and ${options.max} items.`,
    })
  }

  items.forEach((item, index) => {
    if (!isRecord(item)) {
      issues.push({ path: `${path}[${index}]`, message: 'Expected an object item.' })
      return
    }

    if (!asTrimmedString(item.text)) {
      issues.push({ path: `${path}[${index}].text`, message: 'Missing text.' })
    }

    if (options.requireSecondaryText && !asTrimmedString(item.secondaryText)) {
      issues.push({ path: `${path}[${index}].secondaryText`, message: 'Missing secondaryText.' })
    }

    if (options.requireAngle && !asTrimmedString(item.angle)) {
      issues.push({ path: `${path}[${index}].angle`, message: 'Missing angle.' })
    }
  })
}

function validateFieldPayload(
  field: OutputContractField,
  value: unknown,
  path: string,
  issues: OutputContractValidationIssue[],
) {
  if (!isRecord(value)) {
    issues.push({ path, message: 'Expected an object payload.' })
    return
  }

  switch (field.outputType) {
    case 'core_hook':
      if (!asTrimmedString(value.content)) {
        issues.push({ path: `${path}.content`, message: 'Missing content.' })
      }
      validateItems(value.items, `${path}.items`, issues, { min: 2, max: 2 })
      return
    case 'description':
      validateItems(value.items, `${path}.items`, issues, {
        min: field.count,
        max: field.count,
      })
      return
    case 'titles':
      validateItems(value.items, `${path}.items`, issues, {
        min: field.count,
        max: field.count,
        requireSecondaryText: true,
        requireAngle: true,
      })
      return
    case 'thumbnail_copy':
      validateItems(value.items, `${path}.items`, issues, {
        min: field.count,
        max: field.count,
        requireSecondaryText: true,
      })
      return
    case 'chapters':
      validateItems(value.items, `${path}.items`, issues, {
        min: field.count,
        max: field.count,
        requireSecondaryText: true,
      })
      return
    case 'hashtags':
      if (!asTrimmedString(value.content)) {
        issues.push({ path: `${path}.content`, message: 'Missing content.' })
      }
      validateItems(value.items, `${path}.items`, issues, {
        min: field.count,
        max: field.count,
      })
      return
    case 'image_prompt':
      if (!asTrimmedString(value.content)) {
        issues.push({ path: `${path}.content`, message: 'Missing content.' })
      }
      if ('items' in value && value.items !== undefined) {
        validateItems(value.items, `${path}.items`, issues, {
          min: 1,
          max: Math.max(1, field.count),
        })
      }
      return
  }

  if (field.responseType === 'combined_block' || field.responseType === 'code_block') {
    if (!asTrimmedString(value.content)) {
      issues.push({ path: `${path}.content`, message: 'Missing content.' })
    }
    return
  }

  validateItems(value.items, `${path}.items`, issues, {
    min: field.count,
    max: field.count,
  })
}

export function validateOutputContractPayload(
  contract: OutputContractDefinition,
  payload: unknown,
) {
  const issues: OutputContractValidationIssue[] = []
  const container = readContractContainer(contract, payload)

  for (const field of contract.fields) {
    validateFieldPayload(
      field,
      container[field.captureKey],
      contract.wrapKey ? `${contract.wrapKey}.${field.captureKey}` : field.captureKey,
      issues,
    )
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}

function coerceSimpleItems(
  value: unknown,
  maxCount: number,
  options?: {
    requireSecondaryText?: boolean
    includeAngle?: boolean
  },
) {
  if (Array.isArray(value)) {
    return value
      .filter(isRecord)
      .map((item) => ({
        text: asTrimmedString(item.text),
        secondaryText: asTrimmedString(item.secondaryText) || undefined,
        angle: asTrimmedString(item.angle) || undefined,
      }))
      .filter((item) => item.text)
      .map((item) => ({
        text: item.text,
        secondaryText:
          options?.requireSecondaryText
            ? item.secondaryText || item.text
            : item.secondaryText,
        meta:
          options?.includeAngle && item.angle
            ? { angle: item.angle }
            : undefined,
      }))
      .slice(0, maxCount)
  }

  return []
}

function coerceFieldPayload(
  field: OutputContractField,
  value: unknown,
): CanvasExecutionOutputPayload {
  const source = isRecord(value) ? value : {}
  const content = asTrimmedString(source.content)

  switch (field.outputType) {
    case 'core_hook': {
      const items = coerceSimpleItems(source.items, 2)
      const lines = items.length > 0 ? items : normalizeLineItems(content).slice(0, 2).map((text) => ({ text }))
      return {
        content: content || lines.map((item) => item.text).join('\n'),
        items: lines.slice(0, 2),
      }
    }
    case 'description':
      return {
        items:
          coerceSimpleItems(source.items, field.count).length > 0
            ? coerceSimpleItems(source.items, field.count)
            : normalizeLineItems(content).slice(0, field.count).map((text) => ({ text })),
      }
    case 'titles':
      return {
        items: coerceSimpleItems(source.items, field.count, {
          requireSecondaryText: true,
          includeAngle: true,
        }),
      }
    case 'thumbnail_copy':
    case 'chapters':
      return {
        items: coerceSimpleItems(source.items, field.count, {
          requireSecondaryText: true,
        }),
      }
    case 'hashtags': {
      const items =
        coerceSimpleItems(source.items, field.count).length > 0
          ? coerceSimpleItems(source.items, field.count)
          : content
              .split(/\s+/)
              .map((part) => part.trim())
              .filter((part) => /^#/.test(part))
              .slice(0, field.count)
              .map((text) => ({ text }))

      return {
        content: content || items.map((item) => item.text).join(' '),
        items,
      }
    }
    case 'image_prompt':
      return {
        content: content,
        items: coerceSimpleItems(source.items, Math.max(1, field.count)),
      }
  }

  if (field.responseType === 'combined_block' || field.responseType === 'code_block') {
    return {
      content: content || normalizeLineItems(asTrimmedString(source.items)).join('\n'),
    }
  }

  return {
    items:
      coerceSimpleItems(source.items, field.count).length > 0
        ? coerceSimpleItems(source.items, field.count)
        : normalizeLineItems(content).slice(0, field.count).map((text) => ({ text })),
  }
}

export function coerceOutputContractPayload(
  contract: OutputContractDefinition,
  payload: unknown,
) {
  const container = readContractContainer(contract, payload)
  return Object.fromEntries(
    contract.fields.map((field) => [
      field.captureKey,
      coerceFieldPayload(field, container[field.captureKey]),
    ]),
  ) as Record<string, CanvasExecutionOutputPayload>
}

export function validationIssuesToText(issues: OutputContractValidationIssue[]) {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n')
}

export function buildOutputInstruction(field: OutputContractField) {
  const hintText = field.promptHint?.trim() ? ` Additional hint: ${field.promptHint.trim()}` : ''
  const descriptionText = field.description?.trim() ? ` ${field.description.trim()}` : ''

  switch (field.outputType) {
    case 'core_hook':
      return `- ${field.captureKey} (${field.label}): return exactly 2 lines that capture what the video is really about and why someone should click.${hintText}`
    case 'description':
      return `- ${field.captureKey} (${field.label}): generate exactly ${field.count} publish-ready descriptions.${descriptionText}${hintText}`
    case 'titles':
      return `- ${field.captureKey} (${field.label}): generate exactly ${field.count} titles, each with thumbnail text and a strategic angle.${hintText}`
    case 'thumbnail_copy':
      return `- ${field.captureKey} (${field.label}): generate exactly ${field.count} short thumbnail text options.${hintText}`
    case 'chapters':
      return `- ${field.captureKey} (${field.label}): generate exactly ${field.count} timestamped chapters in ascending order.${hintText}`
    case 'hashtags':
      return `- ${field.captureKey} (${field.label}): generate exactly ${field.count} relevant hashtags and also return one copy-ready combined hashtag line.${hintText}`
    case 'image_prompt':
      return `- ${field.captureKey} (${field.label}): generate one production-ready image prompt.${hintText}`
    default:
      if (field.responseType === 'combined_block' || field.responseType === 'code_block') {
        return `- ${field.captureKey} (${field.label}): generate one polished combined block.${descriptionText}${hintText}`
      }
      return `- ${field.captureKey} (${field.label}): generate exactly ${field.count} row-style items.${descriptionText}${hintText}`
  }
}

export function listKnownStrictOutputProviders() {
  return ['openai', 'gemini', 'anthropic'] as const
}

export function usesPackagingOutputType(field: OutputContractField) {
  return isPackagingOutputType(field.outputType)
}
