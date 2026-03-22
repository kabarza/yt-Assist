import { generateId } from '../types/chat'
import type {
  PackagingBriefConfig,
  PackagingOutputNodeKind,
  PackagingOutputSelectionMap,
  PromptBuilderOutputDefinition,
  PromptProgramInputField,
  PromptProgramNodeConfig,
  PromptProgramOutputField,
  PromptOutputPresentationMode,
  PromptOutputSpecSnapshot,
  PromptOutputType,
  TranscriptArtifacts,
  TranscriptSourceNodeConfig,
} from '../types/canvasLab'

const PACKAGING_OUTPUT_NODE_KINDS: PackagingOutputNodeKind[] = [
  'core_hook',
  'description',
  'titles',
  'thumbnail_copy',
  'chapters',
  'hashtags',
]

const DEFAULT_PACKAGING_BRIEF: PackagingBriefConfig = {
  mustInclude: '',
  niceToInclude: '',
  avoidWords: '',
  additionalContext: '',
  transcriptIncludeTimestamps: true,
}

const DEFAULT_PACKAGING_OUTPUT_SELECTIONS: PackagingOutputSelectionMap = {
  core_hook: { enabled: true, count: 1 },
  description: { enabled: true, count: 3 },
  titles: { enabled: true, count: 10 },
  thumbnail_copy: { enabled: true, count: 10 },
  chapters: { enabled: true, count: 8 },
  hashtags: { enabled: true, count: 5 },
}

const PACKAGING_OUTPUT_TYPE_SET = new Set<PackagingOutputNodeKind>(PACKAGING_OUTPUT_NODE_KINDS)

export const TRANSCRIPT_SOURCE_INPUT_IDS = {
  transcript: 'transcript',
  mustInclude: 'must_include',
  niceToInclude: 'nice_to_include',
  wordsToAvoid: 'words_to_avoid',
  additionalContext: 'additional_context',
  preferTimestamps: 'prefer_timestamps',
} as const

function cloneSelections(
  input: PackagingOutputSelectionMap = DEFAULT_PACKAGING_OUTPUT_SELECTIONS,
): PackagingOutputSelectionMap {
  return JSON.parse(JSON.stringify(input)) as PackagingOutputSelectionMap
}

function cloneBrief(input: PackagingBriefConfig = DEFAULT_PACKAGING_BRIEF): PackagingBriefConfig {
  return { ...DEFAULT_PACKAGING_BRIEF, ...input }
}

function blankTranscriptArtifacts(): TranscriptArtifacts {
  return {
    rawTranscript: '',
    digest: '',
    timestampMap: '',
    keyHooks: [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function getBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function getFinitePositiveInteger(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.max(1, Math.round(value))
    : fallback
}

function createPromptProgramInputField(
  input: Partial<PromptProgramInputField> & Pick<PromptProgramInputField, 'id' | 'type' | 'label'>,
): PromptProgramInputField {
  const section = input.section || 'optional'
  const visible = input.visible || (section === 'core' ? 'always' : 'collapsible')

  if (input.type === 'boolean') {
    return {
      id: input.id,
      type: 'boolean',
      label: input.label,
      description: input.description,
      required: input.required ?? false,
      defaultValue: typeof input.defaultValue === 'boolean' ? input.defaultValue : false,
      value: typeof input.value === 'boolean'
        ? input.value
        : typeof input.defaultValue === 'boolean'
        ? input.defaultValue
        : false,
      section,
      visible,
      promptLabel: input.promptLabel,
      injectionRule: input.injectionRule,
      visibleWhen: input.visibleWhen,
    }
  }

  if (input.type === 'number') {
    return {
      id: input.id,
      type: 'number',
      label: input.label,
      description: input.description,
      required: input.required ?? false,
      defaultValue: typeof input.defaultValue === 'number' ? input.defaultValue : 0,
      value: typeof input.value === 'number'
        ? input.value
        : typeof input.defaultValue === 'number'
        ? input.defaultValue
        : 0,
      section,
      visible,
      promptLabel: input.promptLabel,
      injectionRule: input.injectionRule,
      visibleWhen: input.visibleWhen,
    }
  }

  return {
    id: input.id,
    type: input.type,
    label: input.label,
    description: input.description,
    required: input.required ?? input.id === TRANSCRIPT_SOURCE_INPUT_IDS.transcript,
    defaultValue: typeof input.defaultValue === 'string' ? input.defaultValue : '',
    value: typeof input.value === 'string'
      ? input.value
      : typeof input.defaultValue === 'string'
      ? input.defaultValue
      : '',
    section,
    visible,
    promptLabel: input.promptLabel,
    injectionRule: input.injectionRule,
    visibleWhen: input.visibleWhen,
  }
}

function defaultResponseTypeForOutputType(outputType: PromptOutputType) {
  if (outputType === 'core_hook' || outputType === 'hashtags' || outputType === 'image_prompt') {
    return 'combined_block' as const
  }

  return 'text_item_list' as const
}

function defaultGroupingForResponseType(responseType: PromptProgramOutputField['responseType']) {
  return responseType === 'combined_block' || responseType === 'code_block'
    ? 'combined' as const
    : 'separate' as const
}

export function createPromptProgramOutputField(
  input?: Partial<PromptProgramOutputField>,
): PromptProgramOutputField {
  const outputType = input?.outputType || 'generic'
  const responseType = input?.responseType || defaultResponseTypeForOutputType(outputType)

  return {
    id: input?.id || generateId(),
    captureKey: input?.captureKey?.trim() || input?.id || generateId(),
    enabled: input?.enabled ?? true,
    label: input?.label?.trim() || 'Output',
    description: input?.description || '',
    promptHint: input?.promptHint || '',
    count: Math.max(1, Math.round(input?.count || 3)),
    outputType,
    responseType,
    grouping: input?.grouping || defaultGroupingForResponseType(responseType),
  }
}

function transcriptOutputLabel(kind: PackagingOutputNodeKind) {
  switch (kind) {
    case 'core_hook':
      return 'Core Hook'
    case 'description':
      return 'Descriptions'
    case 'titles':
      return 'Titles'
    case 'thumbnail_copy':
      return 'Thumbnail Copy'
    case 'chapters':
      return 'Chapters'
    case 'hashtags':
      return 'Hashtags'
  }
}

function transcriptOutputDescription(kind: PackagingOutputNodeKind) {
  switch (kind) {
    case 'core_hook':
      return 'A two-line explanation of what the video is really about and why someone should click.'
    case 'description':
      return 'Publish-ready YouTube descriptions grounded in the transcript.'
    case 'titles':
      return 'Clickable title options with paired thumbnail text.'
    case 'thumbnail_copy':
      return 'Short thumbnail text options that complement the title.'
    case 'chapters':
      return 'Timestamped chapter options in ascending order.'
    case 'hashtags':
      return 'Relevant hashtags plus one copy-ready combined hashtag line.'
  }
}

function createTranscriptOutputField(
  kind: PackagingOutputNodeKind,
  selection: PackagingOutputSelectionMap[PackagingOutputNodeKind],
): PromptProgramOutputField {
  return createPromptProgramOutputField({
    id: kind,
    captureKey: kind,
    enabled: selection.enabled,
    label: transcriptOutputLabel(kind),
    description: transcriptOutputDescription(kind),
    count: selection.count,
    outputType: kind,
    responseType: defaultResponseTypeForOutputType(kind),
    grouping: defaultGroupingForResponseType(defaultResponseTypeForOutputType(kind)),
  })
}

export function createTranscriptSourcePromptProgram(options?: {
  transcript?: string
  brief?: PackagingBriefConfig
  selectedOutputs?: PackagingOutputSelectionMap
}): PromptProgramNodeConfig {
  const brief = cloneBrief(options?.brief)
  const selectedOutputs = cloneSelections(options?.selectedOutputs)

  return {
    templateId: 'transcript_source',
    inputSchema: [
      createPromptProgramInputField({
        id: TRANSCRIPT_SOURCE_INPUT_IDS.transcript,
        type: 'long_text',
        label: 'Transcript',
        description: 'The full source transcript that downstream outputs should be based on.',
        required: true,
        section: 'core',
        visible: 'always',
        promptLabel: 'Transcript',
        injectionRule: 'replace_section',
        value: options?.transcript || '',
      }),
      createPromptProgramInputField({
        id: TRANSCRIPT_SOURCE_INPUT_IDS.mustInclude,
        type: 'short_text',
        label: 'Must include',
        description: 'Words, ideas, or constraints that must appear in the result.',
        section: 'optional',
        visible: 'collapsible',
        promptLabel: 'Must include',
        injectionRule: 'append_if_present',
        value: brief.mustInclude,
      }),
      createPromptProgramInputField({
        id: TRANSCRIPT_SOURCE_INPUT_IDS.niceToInclude,
        type: 'short_text',
        label: 'Nice to include',
        description: 'Helpful extras that improve the output when they fit naturally.',
        section: 'optional',
        visible: 'collapsible',
        promptLabel: 'Nice to include',
        injectionRule: 'append_if_present',
        value: brief.niceToInclude,
      }),
      createPromptProgramInputField({
        id: TRANSCRIPT_SOURCE_INPUT_IDS.wordsToAvoid,
        type: 'short_text',
        label: 'Words to avoid',
        description: 'Terms or phrasing the model should avoid using.',
        section: 'optional',
        visible: 'collapsible',
        promptLabel: 'Words to avoid',
        injectionRule: 'append_if_present',
        value: brief.avoidWords,
      }),
      createPromptProgramInputField({
        id: TRANSCRIPT_SOURCE_INPUT_IDS.additionalContext,
        type: 'long_text',
        label: 'Additional context',
        description: 'Audience, tone, packaging direction, or channel context.',
        section: 'optional',
        visible: 'collapsible',
        promptLabel: 'Additional context',
        injectionRule: 'append_if_present',
        value: brief.additionalContext,
      }),
      createPromptProgramInputField({
        id: TRANSCRIPT_SOURCE_INPUT_IDS.preferTimestamps,
        type: 'boolean',
        label: 'Prefer transcript timestamps',
        description: 'Use transcript timestamps when timing-sensitive outputs need them.',
        section: 'optional',
        visible: 'collapsible',
        promptLabel: 'Prefer transcript timestamps',
        injectionRule: 'boolean_preference',
        defaultValue: true,
        value: brief.transcriptIncludeTimestamps,
      }),
    ],
    outputSchema: PACKAGING_OUTPUT_NODE_KINDS.map((kind) =>
      createTranscriptOutputField(kind, selectedOutputs[kind]),
    ),
    promptTemplate: [
      {
        id: 'transcript_context',
        kind: 'context',
        text: 'Use the transcript as the source of truth and avoid fabricating details.',
      },
      {
        id: 'guidance',
        kind: 'instruction',
        text: 'Apply optional guidance only when fields are provided or toggled on.',
      },
      {
        id: 'outputs',
        kind: 'output',
        text: 'Return only the requested outputs and respect each output contract.',
      },
    ],
    responseContract: {
      version: 1,
      contractId: 'transcript_source_v1',
    },
    viewConfig: {
      optionalInputsCollapsed: true,
      outputSettingsCollapsed: true,
    },
  }
}

export function getPromptProgramInputValue(
  promptProgram: PromptProgramNodeConfig,
  fieldId: string,
) {
  return promptProgram.inputSchema.find((field) => field.id === fieldId)?.value
}

export function setPromptProgramInputValue(
  promptProgram: PromptProgramNodeConfig,
  fieldId: string,
  value: string | number | boolean,
): PromptProgramNodeConfig {
  return {
    ...promptProgram,
    inputSchema: promptProgram.inputSchema.map((field) => {
      if (field.id !== fieldId) return field

      if (field.type === 'boolean') {
        return { ...field, value: Boolean(value) }
      }

      if (field.type === 'number') {
        return { ...field, value: typeof value === 'number' ? value : Number(value) || 0 }
      }

      return { ...field, value: String(value) }
    }),
  }
}

export function updatePromptProgramOutputField(
  promptProgram: PromptProgramNodeConfig,
  outputId: string,
  updater: (field: PromptProgramOutputField) => PromptProgramOutputField,
): PromptProgramNodeConfig {
  return {
    ...promptProgram,
    outputSchema: promptProgram.outputSchema.map((field) =>
      field.id === outputId ? updater(field) : field,
    ),
  }
}

export function addPromptProgramOutputField(
  promptProgram: PromptProgramNodeConfig,
  input?: Partial<PromptProgramOutputField>,
): PromptProgramNodeConfig {
  return {
    ...promptProgram,
    outputSchema: [...promptProgram.outputSchema, createPromptProgramOutputField(input)],
  }
}

export function movePromptProgramOutputField(
  promptProgram: PromptProgramNodeConfig,
  outputId: string,
  direction: 'up' | 'down',
): PromptProgramNodeConfig {
  const index = promptProgram.outputSchema.findIndex((field) => field.id === outputId)
  if (index < 0) return promptProgram

  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= promptProgram.outputSchema.length) {
    return promptProgram
  }

  const nextOutputs = [...promptProgram.outputSchema]
  const [field] = nextOutputs.splice(index, 1)
  nextOutputs.splice(targetIndex, 0, field)

  return {
    ...promptProgram,
    outputSchema: nextOutputs,
  }
}

export function removePromptProgramOutputField(
  promptProgram: PromptProgramNodeConfig,
  outputId: string,
): PromptProgramNodeConfig {
  return {
    ...promptProgram,
    outputSchema: promptProgram.outputSchema.filter((field) => field.id !== outputId),
  }
}

function normalizeInputField(
  field: unknown,
  fallbackById: Map<string, PromptProgramInputField>,
): PromptProgramInputField | null {
  if (!isRecord(field)) return null

  const fallback = fallbackById.get(getString(field.id))
  const type = field.type === 'long_text' || field.type === 'short_text' || field.type === 'number' || field.type === 'boolean'
    ? field.type
    : fallback?.type

  if (!type) return null

  const baseInput = {
    id: getString(field.id, fallback?.id || generateId()),
    label: getString(field.label, fallback?.label || 'Field'),
    description: getString(field.description, fallback?.description || '') || undefined,
    required: getBoolean(field.required, fallback?.required ?? false),
    section: field.section === 'core' ? 'core' : field.section === 'optional' ? 'optional' : fallback?.section || 'optional',
    visible: field.visible === 'always' ? 'always' : field.visible === 'collapsible' ? 'collapsible' : fallback?.visible || 'collapsible',
    promptLabel: getString(field.promptLabel, fallback?.promptLabel || '') || undefined,
    injectionRule:
      field.injectionRule === 'replace_section' ||
      field.injectionRule === 'append_if_present' ||
      field.injectionRule === 'boolean_preference' ||
      field.injectionRule === 'conditional_value'
        ? field.injectionRule
        : fallback?.injectionRule,
    visibleWhen:
      isRecord(field.visibleWhen) && typeof field.visibleWhen.fieldId === 'string'
        ? {
            fieldId: field.visibleWhen.fieldId,
            equals:
              typeof field.visibleWhen.equals === 'string' ||
              typeof field.visibleWhen.equals === 'number' ||
              typeof field.visibleWhen.equals === 'boolean'
                ? field.visibleWhen.equals
                : true,
          }
        : fallback?.visibleWhen,
  } as const

  if (type === 'boolean') {
    return createPromptProgramInputField({
      ...baseInput,
      type: 'boolean',
      defaultValue: getBoolean(field.defaultValue, fallback?.type === 'boolean' ? fallback.defaultValue : false),
      value: getBoolean(field.value, fallback?.type === 'boolean' ? fallback.value : false),
    })
  }

  if (type === 'number') {
    return createPromptProgramInputField({
      ...baseInput,
      type: 'number',
      defaultValue: getFinitePositiveInteger(field.defaultValue, fallback?.type === 'number' ? fallback.defaultValue ?? 0 : 0),
      value: getFinitePositiveInteger(field.value, fallback?.type === 'number' ? fallback.value ?? 0 : 0),
    })
  }

  return createPromptProgramInputField({
    ...baseInput,
    type,
    defaultValue: getString(
      field.defaultValue,
      fallback?.type === 'long_text' || fallback?.type === 'short_text' ? fallback.defaultValue : '',
    ),
    value: getString(
      field.value,
      fallback?.type === 'long_text' || fallback?.type === 'short_text' ? fallback.value : '',
    ),
  })
}

function normalizeOutputField(field: unknown): PromptProgramOutputField | null {
  if (!isRecord(field)) return null

  const outputType =
    typeof field.outputType === 'string'
      ? field.outputType as PromptOutputType
      : 'generic'

  return createPromptProgramOutputField({
    id: getString(field.id, generateId()),
    captureKey: getString(field.captureKey, getString(field.id, generateId())),
    enabled: getBoolean(field.enabled, true),
    label: getString(field.label, 'Output'),
    description: getString(field.description),
    promptHint: getString(field.promptHint),
    count: getFinitePositiveInteger(field.count, 3),
    outputType,
    responseType:
      field.responseType === 'text_item_list' ||
      field.responseType === 'combined_block' ||
      field.responseType === 'table' ||
      field.responseType === 'code_block'
        ? field.responseType
        : defaultResponseTypeForOutputType(outputType),
    grouping:
      field.grouping === 'combined' || field.grouping === 'separate'
        ? field.grouping
        : defaultGroupingForResponseType(defaultResponseTypeForOutputType(outputType)),
  })
}

export function normalizePromptProgramNodeConfig(
  input: unknown,
  fallback = createTranscriptSourcePromptProgram(),
): PromptProgramNodeConfig {
  if (!isRecord(input)) return fallback

  const fallbackById = new Map(fallback.inputSchema.map((field) => [field.id, field]))
  const inputSchema = Array.isArray(input.inputSchema)
    ? input.inputSchema
        .map((field) => normalizeInputField(field, fallbackById))
        .filter((field): field is PromptProgramInputField => Boolean(field))
    : fallback.inputSchema

  const outputSchema = Array.isArray(input.outputSchema)
    ? input.outputSchema
        .map((field) => normalizeOutputField(field))
        .filter((field): field is PromptProgramOutputField => Boolean(field))
        .filter((field, index, fields) => fields.findIndex((entry) => entry.id === field.id) === index)
    : fallback.outputSchema

  return {
    templateId: input.templateId === 'custom' ? 'custom' : fallback.templateId,
    inputSchema: inputSchema.length > 0 ? inputSchema : fallback.inputSchema,
    outputSchema: outputSchema.length > 0 ? outputSchema : fallback.outputSchema,
    promptTemplate: Array.isArray(input.promptTemplate)
      ? (input.promptTemplate
          .filter(isRecord)
          .map((block, index) => {
            const kind =
              block.kind === 'instruction' || block.kind === 'context' || block.kind === 'output'
                ? block.kind
                : 'instruction'

            return {
              id: getString(block.id, `template-${index}`),
              kind,
              text: getString(block.text),
            }
          })
          .filter((block) => block.text.trim().length > 0) as PromptProgramNodeConfig['promptTemplate'])
      : fallback.promptTemplate,
    responseContract: isRecord(input.responseContract)
      ? {
          version: getFinitePositiveInteger(input.responseContract.version, fallback.responseContract.version),
          contractId: getString(input.responseContract.contractId, fallback.responseContract.contractId),
        }
      : fallback.responseContract,
    viewConfig: isRecord(input.viewConfig)
      ? {
          optionalInputsCollapsed: getBoolean(
            input.viewConfig.optionalInputsCollapsed,
            fallback.viewConfig.optionalInputsCollapsed,
          ),
          outputSettingsCollapsed: getBoolean(
            input.viewConfig.outputSettingsCollapsed,
            fallback.viewConfig.outputSettingsCollapsed,
          ),
        }
      : fallback.viewConfig,
  }
}

export function deriveTranscriptSourceLegacyState(promptProgram: PromptProgramNodeConfig) {
  const transcript = String(getPromptProgramInputValue(promptProgram, TRANSCRIPT_SOURCE_INPUT_IDS.transcript) || '')

  const brief: PackagingBriefConfig = {
    mustInclude: String(getPromptProgramInputValue(promptProgram, TRANSCRIPT_SOURCE_INPUT_IDS.mustInclude) || ''),
    niceToInclude: String(getPromptProgramInputValue(promptProgram, TRANSCRIPT_SOURCE_INPUT_IDS.niceToInclude) || ''),
    avoidWords: String(getPromptProgramInputValue(promptProgram, TRANSCRIPT_SOURCE_INPUT_IDS.wordsToAvoid) || ''),
    additionalContext: String(getPromptProgramInputValue(promptProgram, TRANSCRIPT_SOURCE_INPUT_IDS.additionalContext) || ''),
    transcriptIncludeTimestamps: Boolean(
      getPromptProgramInputValue(promptProgram, TRANSCRIPT_SOURCE_INPUT_IDS.preferTimestamps),
    ),
  }

  const selectedOutputs = cloneSelections()
  for (const kind of PACKAGING_OUTPUT_NODE_KINDS) {
    const field = promptProgram.outputSchema.find((output) => output.outputType === kind)
    selectedOutputs[kind] = {
      enabled: field?.enabled ?? false,
      count: field?.count || selectedOutputs[kind].count,
    }
  }

  return {
    transcript,
    brief,
    selectedOutputs,
  }
}

export function promptProgramOutputFieldToOutputSpecSnapshot(
  field: PromptProgramOutputField,
): PromptOutputSpecSnapshot {
  const presentation: PromptOutputPresentationMode =
    field.grouping === 'combined' ? 'combined_block' : 'rows'

  return {
    outputId: field.captureKey,
    label: field.label,
    enabled: field.enabled,
    requestedCount: field.count,
    presentation,
    promptHint: field.promptHint,
    outputType: field.outputType,
  }
}

export function promptProgramOutputFieldToPromptBuilderOutput(
  field: PromptProgramOutputField,
): PromptBuilderOutputDefinition {
  return {
    ...promptProgramOutputFieldToOutputSpecSnapshot(field),
  }
}

export function syncTranscriptSourceConfig(
  config: TranscriptSourceNodeConfig,
  options?: {
    deriveArtifacts?: (transcript: string) => TranscriptArtifacts
  },
): TranscriptSourceNodeConfig {
  const promptProgram = normalizePromptProgramNodeConfig(
    config.promptProgram,
    createTranscriptSourcePromptProgram({
      transcript: config.transcript,
      brief: config.brief,
      selectedOutputs: config.selectedOutputs,
    }),
  )

  const { transcript, brief, selectedOutputs } = deriveTranscriptSourceLegacyState(promptProgram)
  const nextArtifacts = options?.deriveArtifacts
    ? options.deriveArtifacts(transcript)
    : config.artifacts?.rawTranscript === transcript
    ? config.artifacts
    : blankTranscriptArtifacts()

  return {
    ...config,
    transcript,
    artifacts: nextArtifacts,
    brief,
    selectedOutputs,
    promptProgram,
  }
}

export function isPackagingOutputType(outputType: PromptOutputType): outputType is PackagingOutputNodeKind {
  return PACKAGING_OUTPUT_TYPE_SET.has(outputType as PackagingOutputNodeKind)
}
