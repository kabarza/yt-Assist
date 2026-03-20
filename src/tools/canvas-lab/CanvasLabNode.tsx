import { memo, useState, type ComponentProps, type WheelEvent } from 'react'
import { Handle, Position } from '@xyflow/react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bug,
  Check,
  ChevronDown,
  Copy,
  CopyPlus,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Pin,
  Pencil,
  Play,
  Plus,
  Trash2,
  WandSparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  addPromptProgramOutputField,
  createPromptProgramOutputField,
  movePromptProgramOutputField,
  removePromptProgramOutputField,
  setPromptProgramInputValue,
  TRANSCRIPT_SOURCE_INPUT_IDS,
  updatePromptProgramOutputField,
} from '@/lib/canvasPromptProgram'
import {
  useCanvasLabStore,
  useCanvasNode,
  useCanvasNodeArtifacts,
  useCanvasNodeLatestRun,
  useCanvasNodeThread,
} from '@/stores/canvasLabStore'
import { generateId, MODELS } from '@/types/chat'
import type {
  Artifact,
  ArtifactItem,
  CanvasAsset,
  CanvasNodeConfigMap,
  PackagingBriefConfig,
  PromptProgramOutputField,
  PromptBuilderOutputDefinition,
  PromptOutputType,
} from '@/types/canvasLab'
import { cn } from '@/lib/utils'
import { IMAGE_ASPECT_RATIO_OPTIONS, IMAGE_GENERATION_MODELS, IMAGE_SIZE_OPTIONS } from '@/types/images'
import {
  createPromptBuilderOutputsForPreset,
} from '@/utils/canvasLabWorkspace'
import { toast } from 'sonner'

const statusClassNames = {
  idle: 'border-border/80 text-muted-foreground',
  running: 'border-amber-500/35 text-amber-600 dark:text-amber-300',
  complete: 'border-emerald-500/35 text-emerald-700 dark:text-emerald-300',
  stale: 'border-blue-500/35 text-blue-700 dark:text-blue-300',
  error: 'border-destructive/40 text-destructive',
}

const PROMPT_BUILDER_PRESET_OPTIONS = [
  { value: 'custom', label: 'Custom' },
  { value: 'youtube_packaging', label: 'YouTube Packaging' },
] as const

const PROMPT_OUTPUT_TYPE_OPTIONS: Array<{ value: PromptOutputType; label: string }> = [
  { value: 'generic', label: 'Generic' },
  { value: 'titles', label: 'Titles' },
  { value: 'thumbnail_copy', label: 'Thumbnail Copy' },
  { value: 'description', label: 'Description' },
  { value: 'chapters', label: 'Chapters' },
  { value: 'hashtags', label: 'Hashtags' },
  { value: 'core_hook', label: 'Core Hook' },
  { value: 'image_prompt', label: 'Image Prompt' },
]

function defaultPresentationForOutputType(outputType: PromptOutputType) {
  if (outputType === 'core_hook' || outputType === 'hashtags' || outputType === 'image_prompt') {
    return 'combined_block'
  }

  return 'rows'
}

function copyTextToClipboard(value: string, label = 'Copied') {
  const text = value.trim()
  if (!text) return
  void navigator.clipboard.writeText(text)
  toast.success(label)
}

function itemSummaryText(item: ArtifactItem) {
  if (item.secondaryText?.trim()) {
    return item.secondaryText.trim()
  }

  const firstMeta = Object.entries(item.meta || {}).find(([, value]) => value !== null && value !== '')
  if (!firstMeta) return ''
  return `${firstMeta[0]}: ${String(firstMeta[1])}`
}

function activeGuidanceFieldCount(brief: PackagingBriefConfig) {
  return [
    brief.mustInclude.trim(),
    brief.niceToInclude.trim(),
    brief.avoidWords.trim(),
    brief.additionalContext.trim(),
    brief.includeName && brief.nameForTitles.trim() ? brief.nameForTitles.trim() : '',
    brief.transcriptIncludeTimestamps ? '' : 'timestamps-off',
  ].filter(Boolean).length
}

function guidanceSummaryText(brief: PackagingBriefConfig) {
  const summary = [
    brief.mustInclude.trim() ? 'must include set' : null,
    brief.niceToInclude.trim() ? 'nice-to-include set' : null,
    brief.avoidWords.trim() ? 'avoid words set' : null,
    brief.additionalContext.trim() ? 'directions added' : null,
    brief.includeName && brief.nameForTitles.trim() ? `name: ${brief.nameForTitles.trim()}` : null,
    brief.transcriptIncludeTimestamps ? null : 'timestamps off',
  ].filter(Boolean)

  if (summary.length === 0) {
    return 'No optional guidance yet.'
  }

  return summary.length > 2
    ? `${summary.slice(0, 2).join(' · ')} +${summary.length - 2} more`
    : summary.join(' · ')
}

function promptOutputTypeLabel(output: PromptBuilderOutputDefinition) {
  switch (output.outputType) {
    case 'core_hook':
      return 'Core hook'
    case 'description':
      return 'Descriptions'
    case 'titles':
      return 'Titles'
    case 'thumbnail_copy':
      return 'Thumbnail copy'
    case 'chapters':
      return 'Chapters'
    case 'hashtags':
      return 'Hashtags'
    case 'image_prompt':
      return 'Image prompt'
    default:
      return 'Generic'
  }
}

function shouldLeaveWheelForCanvas(event: WheelEvent<HTMLElement>) {
  if (event.ctrlKey) return true
  return Math.abs(event.deltaX) > Math.abs(event.deltaY)
}

function stopCanvasWheelPropagation(event: WheelEvent<HTMLElement>, scrollElement: HTMLElement | null) {
  if (!scrollElement || shouldLeaveWheelForCanvas(event)) return
  if (scrollElement.scrollHeight <= scrollElement.clientHeight + 1) return

  const deltaY = event.deltaY
  const canScrollUp = scrollElement.scrollTop > 0
  const canScrollDown =
    scrollElement.scrollTop + scrollElement.clientHeight < scrollElement.scrollHeight - 1

  if ((deltaY < 0 && canScrollUp) || (deltaY > 0 && canScrollDown)) {
    event.stopPropagation()
  }
}

function handleTextareaWheelCapture(event: WheelEvent<HTMLTextAreaElement>) {
  stopCanvasWheelPropagation(event, event.currentTarget)
}

function handleScrollAreaWheelCapture(event: WheelEvent<HTMLDivElement>) {
  const viewport = event.currentTarget.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null
  stopCanvasWheelPropagation(event, viewport)
}

function outputFieldSummary(field: PromptProgramOutputField) {
  const shapeLabel =
    field.responseType === 'combined_block'
      ? 'combined block'
      : field.responseType === 'code_block'
      ? 'code block'
      : field.responseType === 'table'
      ? 'table'
      : 'item list'

  return `${shapeLabel} · ${field.count} ${field.count === 1 ? 'item' : 'items'}`
}

function IconActionButton({
  label,
  children,
  className,
  forceVisible = false,
  ...props
}: ComponentProps<typeof Button> & {
  label: string
  forceVisible?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8 rounded-[0.8rem] transition-opacity focus-visible:opacity-100',
            !forceVisible && 'opacity-0 group-hover:opacity-100',
            className,
          )}
          aria-label={label}
          title={label}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function ArtifactItemRow({
  artifact,
  item,
  asset,
}: {
  artifact: Artifact
  item: ArtifactItem
  asset?: CanvasAsset
}) {
  const toggleArtifactItemState = useCanvasLabStore((state) => state.toggleArtifactItemState)
  const addComposeItemFromArtifact = useCanvasLabStore((state) => state.addComposeItemFromArtifact)
  const openComposeNodeId = useCanvasLabStore((state) => state.openComposeNodeId)
  const activeWorkspace = useCanvasLabStore((state) =>
    state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId),
  )
  const composeNodeId = openComposeNodeId || activeWorkspace?.nodes.find((node) => node.kind === 'compose')?.id || null

  return (
    <div className="group rounded-[1rem] border border-border/65 bg-background/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium leading-5 text-foreground">{item.text}</p>
          {itemSummaryText(item) ? (
            <p className="text-xs leading-5 text-muted-foreground">{itemSummaryText(item)}</p>
          ) : null}
          {asset ? (
            <div className="overflow-hidden rounded-[0.85rem] border border-border/70 bg-card">
              <img
                src={asset.url}
                alt={asset.name}
                className="h-24 w-full object-cover"
              />
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <IconActionButton
            onClick={() => copyTextToClipboard(item.text, 'Copied item')}
            label="Copy item"
          >
            <Copy className="h-3.5 w-3.5" />
          </IconActionButton>
          <IconActionButton
            variant={item.accepted ? 'default' : 'ghost'}
            forceVisible={Boolean(item.accepted)}
            className={item.accepted ? 'opacity-100' : undefined}
            onClick={() => {
              void toggleArtifactItemState(artifact.id, item.id, 'accepted')
            }}
            label={item.accepted ? 'Remove from downstream use' : 'Accept for downstream use'}
          >
            <Check className="h-3.5 w-3.5" />
          </IconActionButton>
          <IconActionButton
            variant={item.pinned ? 'secondary' : 'ghost'}
            forceVisible={Boolean(item.pinned)}
            className={item.pinned ? 'opacity-100' : undefined}
            onClick={() => {
              void toggleArtifactItemState(artifact.id, item.id, 'pinned')
            }}
            label={item.pinned ? 'Unpin favored item' : 'Pin to keep favored across refinements'}
          >
            <Pin className="h-3.5 w-3.5" />
          </IconActionButton>
          {composeNodeId ? (
            <IconActionButton
              onClick={() => {
                void addComposeItemFromArtifact(composeNodeId, artifact.id, item.id)
              }}
              label="Send to compose stage"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </IconActionButton>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function NodeHeader({
  label,
  kind,
  onRename,
  onDuplicate,
  onDisconnect,
  onOpenCompose,
  onOpenDebug,
  onToggleContentSize,
  onDelete,
  isContentExpanded = false,
}: {
  label: string
  kind: string
  onRename?: () => void
  onDuplicate?: () => void
  onDisconnect?: () => void
  onOpenCompose?: () => void
  onOpenDebug?: () => void
  onToggleContentSize?: () => void
  onDelete?: () => void
  isContentExpanded?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
      <div className="min-w-0 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {kind.replace('_', ' ')}
        </p>
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{label}</h3>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onToggleContentSize ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-[0.8rem]"
                onClick={onToggleContentSize}
                aria-label={isContentExpanded ? 'Collapse node content' : 'Expand node content'}
                title={isContentExpanded ? 'Collapse content' : 'Expand content'}
              >
                {isContentExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isContentExpanded ? 'Collapse content' : 'Expand content'}</TooltipContent>
          </Tooltip>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-[0.8rem]"
              aria-label="Open node actions"
              title="Open node actions"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-[1rem] border-border/70 bg-card/96 p-1">
            {onRename ? (
              <DropdownMenuItem className="rounded-[0.8rem] px-3 py-2.5" onClick={onRename}>
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
            ) : null}
            {onDuplicate ? (
              <DropdownMenuItem className="rounded-[0.8rem] px-3 py-2.5" onClick={onDuplicate}>
                <CopyPlus className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
            ) : null}
            {onDisconnect ? (
              <DropdownMenuItem className="rounded-[0.8rem] px-3 py-2.5" onClick={onDisconnect}>
                Disconnect links
              </DropdownMenuItem>
            ) : null}
            {(onOpenDebug || onOpenCompose) && <DropdownMenuSeparator className="mx-0 my-1" />}
            {onOpenDebug ? (
              <DropdownMenuItem className="rounded-[0.8rem] px-3 py-2.5" onClick={onOpenDebug}>
                <Bug className="mr-2 h-4 w-4" />
                Open Debug
              </DropdownMenuItem>
            ) : null}
            {onOpenCompose ? (
              <DropdownMenuItem className="rounded-[0.8rem] px-3 py-2.5" onClick={onOpenCompose}>
                Open Compose Stage
              </DropdownMenuItem>
            ) : null}
            {onDelete ? <DropdownMenuSeparator className="mx-0 my-1" /> : null}
            {onDelete ? (
              <DropdownMenuItem
                className="rounded-[0.8rem] px-3 py-2.5 text-destructive focus:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function RunFooter({
  onRun,
  onRunFiveMore,
  onRunTenMore,
  isRunning,
  allowCountButtons = false,
  primaryLabel = 'Run',
}: {
  onRun: () => void
  onRunFiveMore?: () => void
  onRunTenMore?: () => void
  isRunning: boolean
  allowCountButtons?: boolean
  primaryLabel?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-3">
      <Button
        type="button"
        size="sm"
        className="h-8 rounded-full px-3"
        onClick={onRun}
        disabled={isRunning}
      >
        {isRunning ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-2 h-3.5 w-3.5" />}
        {primaryLabel}
      </Button>
      {allowCountButtons && onRunFiveMore ? (
        <Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3" onClick={onRunFiveMore} disabled={isRunning}>
          5 more
        </Button>
      ) : null}
      {allowCountButtons && onRunTenMore ? (
        <Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3" onClick={onRunTenMore} disabled={isRunning}>
          10 more
        </Button>
      ) : null}
    </div>
  )
}

function RefinementRail({
  value,
  onChange,
  placeholder,
  onRun,
  onRunFiveMore,
  onRunTenMore,
  isRunning,
  allowCountButtons = false,
  primaryLabel = 'Run',
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  onRun: () => void
  onRunFiveMore?: () => void
  onRunTenMore?: () => void
  isRunning: boolean
  allowCountButtons?: boolean
  primaryLabel?: string
}) {
  return (
    <div className="border-t border-border/60 bg-background/55 px-4 py-3">
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-20 rounded-[1rem] border-border/65 bg-background/90 shadow-none"
        placeholder={placeholder}
        onWheelCapture={handleTextareaWheelCapture}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="h-8 rounded-full px-3"
          onClick={onRun}
          disabled={isRunning}
        >
          {isRunning ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-2 h-3.5 w-3.5" />}
          {primaryLabel}
        </Button>
        {allowCountButtons && onRunFiveMore ? (
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3" onClick={onRunFiveMore} disabled={isRunning}>
            5 more
          </Button>
        ) : null}
        {allowCountButtons && onRunTenMore ? (
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3" onClick={onRunTenMore} disabled={isRunning}>
            10 more
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function CopyableContentBlock({
  content,
}: {
  content: string
}) {
  return (
    <div className="group rounded-[1rem] border border-border/65 bg-background/70 p-3 text-sm leading-6 text-foreground">
      <div className="mb-2 flex justify-end">
        <IconActionButton
          onClick={() => copyTextToClipboard(content, 'Copied block')}
          label="Copy block"
        >
          <Copy className="h-3.5 w-3.5" />
        </IconActionButton>
      </div>
      <div className="whitespace-pre-wrap">{content}</div>
    </div>
  )
}

function CanvasLabNodeComponent({ data }: any) {
  const node = useCanvasNode(data.nodeId)
  const artifacts = useCanvasNodeArtifacts(data.nodeId)
  const latestRun = useCanvasNodeLatestRun(data.nodeId)
  const thread = useCanvasNodeThread(data.nodeId)
  const executeNode = useCanvasLabStore((state) => state.executeNode)
  const updateNodeConfig = useCanvasLabStore((state) => state.updateNodeConfig)
  const createPromptBuilderFromTranscript = useCanvasLabStore((state) => state.createPromptBuilderFromTranscript)
  const importPackagingSession = useCanvasLabStore((state) => state.importPackagingSession)
  const importActiveChat = useCanvasLabStore((state) => state.importActiveChat)
  const importReusableAssets = useCanvasLabStore((state) => state.importReusableAssets)
  const renameNode = useCanvasLabStore((state) => state.renameNode)
  const duplicateNode = useCanvasLabStore((state) => state.duplicateNode)
  const disconnectNode = useCanvasLabStore((state) => state.disconnectNode)
  const deleteNode = useCanvasLabStore((state) => state.deleteNode)
  const setOpenComposeNodeId = useCanvasLabStore((state) => state.setOpenComposeNodeId)
  const setOpenDebugNodeId = useCanvasLabStore((state) => state.setOpenDebugNodeId)
  const assetsById = useCanvasLabStore((state) => state.assetsById)
  const [isTranscriptGuidanceOpen, setIsTranscriptGuidanceOpen] = useState(false)
  const [isTranscriptOutputsOpen, setIsTranscriptOutputsOpen] = useState(false)
  const [isContentExpanded, setIsContentExpanded] = useState(false)
  const promptOutputBuilderNodeId =
    node?.kind === 'prompt_output'
      ? (node.config as CanvasNodeConfigMap['prompt_output']).builderNodeId
      : null
  const promptOutputBuilderNode = useCanvasNode(promptOutputBuilderNodeId)

  if (!node) {
    return null
  }

  const latestArtifact = [...artifacts].sort((a, b) => b.updatedAt - a.updatedAt)[0]
  const isRunning = node.status === 'running'
  const transcriptConfig =
    node.kind === 'transcript_source'
      ? (node.config as CanvasNodeConfigMap['transcript_source'])
      : null
  const promptBuilderConfig =
    node.kind === 'prompt_builder'
      ? (node.config as CanvasNodeConfigMap['prompt_builder'])
      : null
  const promptOutputConfig =
    node.kind === 'prompt_output'
      ? (node.config as CanvasNodeConfigMap['prompt_output'])
      : null
  const guidanceCount = transcriptConfig ? activeGuidanceFieldCount(transcriptConfig.brief) : 0
  const latestError = latestRun?.status === 'error' ? latestRun.error?.trim() || '' : ''
  const latestWarnings = latestRun?.warnings?.filter((warning) => warning.trim()) || []
  const canOpenDebug = Boolean(latestRun?.requestPreview || latestRun?.responsePreview)
  const isPackagingOutputNode = ['core_hook', 'description', 'titles', 'chapters', 'hashtags', 'thumbnail_copy', 'image_prompt'].includes(node.kind)
  const canToggleContentSize = isPackagingOutputNode || node.kind === 'prompt_output' || node.kind === 'chat' || node.kind === 'image_generate' || node.kind === 'asset_library'
  const canDeleteNode = node.kind !== 'transcript_source'
  const transcriptOutputArtifacts = transcriptConfig
    ? transcriptConfig.promptProgram.outputSchema.map((field) => ({
        field,
        artifact: [...artifacts]
          .filter((artifact) => artifact.outputId === field.captureKey)
          .sort((left, right) => right.updatedAt - left.updatedAt)[0],
      }))
    : []

  const runNode = (message?: string, requestedCount?: number) => {
    void executeNode(node.id, { message, requestedCount })
  }

  const renameCurrentNode = () => {
    const nextLabel = window.prompt('Rename node', node.label)
    if (!nextLabel || nextLabel.trim() === node.label) return
    void renameNode(node.id, nextLabel)
  }

  const duplicateCurrentNode = () => {
    void duplicateNode(node.id)
  }

  const disconnectCurrentNode = () => {
    void disconnectNode(node.id)
  }

  const updatePromptBuilderOutput = (
    builderNodeId: string,
    outputId: string,
    updater: (output: PromptBuilderOutputDefinition) => PromptBuilderOutputDefinition,
  ) => {
    void updateNodeConfig(builderNodeId, (current) => ({
      ...(current as CanvasNodeConfigMap['prompt_builder']),
      outputs: (current as CanvasNodeConfigMap['prompt_builder']).outputs.map((output) =>
        output.outputId === outputId ? updater(output) : output,
      ),
    }))
  }

  const updateTranscriptPromptProgram = (
    updater: (config: CanvasNodeConfigMap['transcript_source']) => CanvasNodeConfigMap['transcript_source'],
  ) => {
    void updateNodeConfig(node.id, (current) => updater(current as CanvasNodeConfigMap['transcript_source']))
  }

  const updateTranscriptInputField = (fieldId: string, value: string | number | boolean) => {
    updateTranscriptPromptProgram((current) => ({
      ...current,
      promptProgram: setPromptProgramInputValue(current.promptProgram, fieldId, value),
    }))
  }

  const updateTranscriptOutputFieldConfig = (
    outputId: string,
    updater: (field: PromptProgramOutputField) => PromptProgramOutputField,
  ) => {
    updateTranscriptPromptProgram((current) => ({
      ...current,
      promptProgram: updatePromptProgramOutputField(current.promptProgram, outputId, updater),
    }))
  }
  const enabledTranscriptOutputCount =
    transcriptConfig?.promptProgram.outputSchema.filter((field) => field.enabled).length || 0

  const transcriptHasOutputTypeConflict = (outputId: string, outputType: PromptOutputType) =>
    outputType !== 'generic' &&
    transcriptConfig?.promptProgram.outputSchema.some(
      (field) => field.id !== outputId && field.outputType === outputType,
    )

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-background !bg-primary/80"
      />
      <TooltipProvider delayDuration={150}>
        <div className="relative w-[320px] pt-5">
          <Badge
            variant="outline"
            className={cn(
              'pointer-events-none absolute left-4 top-0 z-10 rounded-full bg-background/95 text-[10px] uppercase shadow-sm backdrop-blur',
              statusClassNames[node.status as keyof typeof statusClassNames] || statusClassNames.idle,
            )}
          >
            {node.status}
          </Badge>
      <Card className="overflow-hidden rounded-[1.35rem] border-border/80 bg-card/95 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
        <NodeHeader
          label={node.label}
          kind={node.kind}
          onRename={renameCurrentNode}
          onDuplicate={node.kind !== 'transcript_source' ? duplicateCurrentNode : undefined}
          onDisconnect={disconnectCurrentNode}
          onToggleContentSize={canToggleContentSize ? () => setIsContentExpanded((current) => !current) : undefined}
          isContentExpanded={isContentExpanded}
          onDelete={canDeleteNode
            ? () => {
                if (!window.confirm(`Delete "${node.label}" from this canvas?`)) {
                  return
                }
                void deleteNode(node.id)
              }
            : undefined}
          onOpenDebug={canOpenDebug ? () => setOpenDebugNodeId(node.id) : undefined}
          onOpenCompose={node.kind === 'compose' ? () => setOpenComposeNodeId(node.id) : undefined}
        />

        <div className="space-y-3 px-4 py-3">
          {latestError ? (
            <div className="rounded-[1rem] border border-destructive/35 bg-destructive/8 px-3 py-2.5 text-xs leading-5 text-destructive">
              {latestError}
            </div>
          ) : null}

          {!latestError && latestWarnings.length > 0 ? (
            <div className="rounded-[1rem] border border-amber-500/35 bg-amber-500/8 px-3 py-2.5 text-xs leading-5 text-amber-700 dark:text-amber-300">
              {latestWarnings.join(' ')}
            </div>
          ) : null}

          {node.kind === 'transcript_source' ? (
            <>
              <Textarea
                value={transcriptConfig?.transcript || ''}
                onChange={(event) => {
                  updateTranscriptInputField(TRANSCRIPT_SOURCE_INPUT_IDS.transcript, event.target.value)
                }}
                className="min-h-36 rounded-[1rem] border-border/65 bg-background/80 shadow-none"
                placeholder="Paste transcript here, or import from Packaging."
                onWheelCapture={handleTextareaWheelCapture}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full px-3"
                  onClick={() => {
                    void importPackagingSession()
                  }}
                >
                  Import Packaging
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full px-3"
                  onClick={() => {
                    void createPromptBuilderFromTranscript()
                  }}
                >
                  Create Packaging Builder
                </Button>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                This node auto-derives the digest, timestamp map, and key hooks for downstream nodes.
              </p>
              {transcriptConfig ? (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-[1rem] border border-border/65 bg-background/55">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-background/60"
                      onClick={() => setIsTranscriptGuidanceOpen((current) => !current)}
                      aria-expanded={isTranscriptGuidanceOpen}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">Optional inputs</p>
                          {guidanceCount > 0 ? (
                            <Badge variant="outline" className="rounded-full bg-background/70 text-[10px] uppercase">
                              {guidanceCount} set
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs leading-5 text-muted-foreground">
                          {guidanceSummaryText(transcriptConfig.brief)}
                        </p>
                      </div>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                          isTranscriptGuidanceOpen && 'rotate-180',
                        )}
                      />
                    </button>

                    {isTranscriptGuidanceOpen ? (
                      <div className="space-y-3 border-t border-border/60 px-3.5 py-3">
                        <div className="space-y-2">
                          <Label htmlFor={`${node.id}-must-include`} className="text-xs text-muted-foreground">
                            Must include
                          </Label>
                          <Input
                            id={`${node.id}-must-include`}
                            value={transcriptConfig.brief.mustInclude}
                            onChange={(event) => {
                              updateTranscriptInputField(TRANSCRIPT_SOURCE_INPUT_IDS.mustInclude, event.target.value)
                            }}
                            className="rounded-[0.95rem] border-border/65 bg-background/80"
                            placeholder="Required words, angles, or brand names"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${node.id}-nice-to-include`} className="text-xs text-muted-foreground">
                            Nice to include
                          </Label>
                          <Input
                            id={`${node.id}-nice-to-include`}
                            value={transcriptConfig.brief.niceToInclude}
                            onChange={(event) => {
                              updateTranscriptInputField(TRANSCRIPT_SOURCE_INPUT_IDS.niceToInclude, event.target.value)
                            }}
                            className="rounded-[0.95rem] border-border/65 bg-background/80"
                            placeholder="Helpful extras if they fit"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${node.id}-avoid-words`} className="text-xs text-muted-foreground">
                            Words to avoid
                          </Label>
                          <Input
                            id={`${node.id}-avoid-words`}
                            value={transcriptConfig.brief.avoidWords}
                            onChange={(event) => {
                              updateTranscriptInputField(TRANSCRIPT_SOURCE_INPUT_IDS.wordsToAvoid, event.target.value)
                            }}
                            className="rounded-[0.95rem] border-border/65 bg-background/80"
                            placeholder="Terms you do not want in the output"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${node.id}-packaging-directions`} className="text-xs text-muted-foreground">
                            Additional context
                          </Label>
                          <Textarea
                            id={`${node.id}-packaging-directions`}
                            value={transcriptConfig.brief.additionalContext}
                            onChange={(event) => {
                              updateTranscriptInputField(TRANSCRIPT_SOURCE_INPUT_IDS.additionalContext, event.target.value)
                            }}
                            className="min-h-24 rounded-[1rem] border-border/65 bg-background/80 shadow-none"
                            placeholder="Audience, tone, packaging direction, or channel context"
                            onWheelCapture={handleTextareaWheelCapture}
                          />
                        </div>

                        <div className="rounded-[0.95rem] border border-border/65 bg-background/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <Label htmlFor={`${node.id}-timestamps`} className="text-sm font-medium text-foreground">
                                Prefer transcript timestamps
                              </Label>
                              <p className="text-xs leading-5 text-muted-foreground">
                                Use transcript timestamps when chapters or timing-sensitive outputs need them.
                              </p>
                            </div>
                            <Switch
                              id={`${node.id}-timestamps`}
                              checked={transcriptConfig.brief.transcriptIncludeTimestamps}
                              onCheckedChange={(checked) => {
                                updateTranscriptInputField(TRANSCRIPT_SOURCE_INPUT_IDS.preferTimestamps, checked)
                              }}
                            />
                          </div>
                        </div>

                        <div className="rounded-[0.95rem] border border-border/65 bg-background/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <Label htmlFor={`${node.id}-include-name`} className="text-sm font-medium text-foreground">
                                Include specific name
                              </Label>
                              <p className="text-xs leading-5 text-muted-foreground">
                                Use this when titles should anchor to a person, channel, or brand.
                              </p>
                            </div>
                            <Switch
                              id={`${node.id}-include-name`}
                              checked={transcriptConfig.brief.includeName}
                              onCheckedChange={(checked) => {
                                updateTranscriptInputField(TRANSCRIPT_SOURCE_INPUT_IDS.includeSpecificName, checked)
                              }}
                            />
                          </div>

                          {transcriptConfig.brief.includeName ? (
                            <div className="mt-3 space-y-2">
                              <Label htmlFor={`${node.id}-name-for-titles`} className="text-xs text-muted-foreground">
                                Specific name
                              </Label>
                              <Input
                                id={`${node.id}-name-for-titles`}
                                value={transcriptConfig.brief.nameForTitles}
                                onChange={(event) => {
                                  updateTranscriptInputField(TRANSCRIPT_SOURCE_INPUT_IDS.specificName, event.target.value)
                                }}
                                className="rounded-[0.95rem] border-border/65 bg-background/80"
                                placeholder="Person, brand, or channel name"
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="overflow-hidden rounded-[1rem] border border-border/65 bg-background/55">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-background/60"
                      onClick={() => setIsTranscriptOutputsOpen((current) => !current)}
                      aria-expanded={isTranscriptOutputsOpen}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">Output settings</p>
                          <Badge variant="outline" className="rounded-full bg-background/70 text-[10px] uppercase">
                            {enabledTranscriptOutputCount} enabled
                          </Badge>
                        </div>
                        <p className="text-xs leading-5 text-muted-foreground">
                          Add, remove, reorder, and reshape Transcript Source outputs without code changes.
                        </p>
                      </div>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                          isTranscriptOutputsOpen && 'rotate-180',
                        )}
                      />
                    </button>

                    {isTranscriptOutputsOpen ? (
                      <div className="space-y-3 border-t border-border/60 px-3.5 py-3">
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-full px-3"
                            onClick={() => {
                              updateTranscriptPromptProgram((current) => ({
                                ...current,
                                promptProgram: addPromptProgramOutputField(
                                  current.promptProgram,
                                  createPromptProgramOutputField({
                                    label: `Output ${current.promptProgram.outputSchema.length + 1}`,
                                    outputType: 'generic',
                                  }),
                                ),
                              }))
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Output
                          </Button>
                        </div>

                        <div className="space-y-2">
                          {transcriptConfig.promptProgram.outputSchema.map((output) => (
                            <div key={output.id} className="rounded-[1rem] border border-border/65 bg-background/80 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground">{output.label}</p>
                                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                    {promptOutputTypeLabel({
                                      outputId: output.captureKey,
                                      label: output.label,
                                      enabled: output.enabled,
                                      requestedCount: output.count,
                                      presentation: output.grouping === 'combined' ? 'combined_block' : 'rows',
                                      promptHint: output.promptHint,
                                      outputType: output.outputType,
                                    })} · {outputFieldSummary(output)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <IconActionButton
                                    label="Move output up"
                                    forceVisible
                                    onClick={() => {
                                      updateTranscriptPromptProgram((current) => ({
                                        ...current,
                                        promptProgram: movePromptProgramOutputField(current.promptProgram, output.id, 'up'),
                                      }))
                                    }}
                                  >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </IconActionButton>
                                  <IconActionButton
                                    label="Move output down"
                                    forceVisible
                                    onClick={() => {
                                      updateTranscriptPromptProgram((current) => ({
                                        ...current,
                                        promptProgram: movePromptProgramOutputField(current.promptProgram, output.id, 'down'),
                                      }))
                                    }}
                                  >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </IconActionButton>
                                  <Switch
                                    checked={output.enabled}
                                    onCheckedChange={(checked) => {
                                      updateTranscriptOutputFieldConfig(output.id, (current) => ({
                                        ...current,
                                        enabled: checked,
                                      }))
                                    }}
                                  />
                                  <IconActionButton
                                    label={`Remove ${output.label}`}
                                    forceVisible
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => {
                                      updateTranscriptPromptProgram((current) => ({
                                        ...current,
                                        promptProgram: removePromptProgramOutputField(current.promptProgram, output.id),
                                      }))
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </IconActionButton>
                                </div>
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">Label</Label>
                                  <Input
                                    value={output.label}
                                    onChange={(event) => {
                                      updateTranscriptOutputFieldConfig(output.id, (current) => ({
                                        ...current,
                                        label: event.target.value,
                                      }))
                                    }}
                                    className="rounded-[0.95rem] border-border/65 bg-background/80"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">Count</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={String(output.count)}
                                    onChange={(event) => {
                                      const value = Math.max(1, Number(event.target.value) || 1)
                                      updateTranscriptOutputFieldConfig(output.id, (current) => ({
                                        ...current,
                                        count: value,
                                      }))
                                    }}
                                    className="rounded-[0.95rem] border-border/65 bg-background/80"
                                  />
                                </div>
                                <div className="col-span-2 space-y-2">
                                  <Label className="text-xs text-muted-foreground">Output type</Label>
                                  <Select
                                    value={output.outputType}
                                    onValueChange={(value) => {
                                      const nextType = value as PromptOutputType
                                      if (transcriptHasOutputTypeConflict(output.id, nextType)) {
                                        toast.error('Transcript Source can only have one output for each built-in packaging type.')
                                        return
                                      }

                                      const nextDefaults = createPromptProgramOutputField({
                                        outputType: nextType,
                                      })
                                      updateTranscriptOutputFieldConfig(output.id, (current) => ({
                                        ...current,
                                        outputType: nextType,
                                        responseType: nextDefaults.responseType,
                                        grouping: nextDefaults.grouping,
                                      }))
                                    }}
                                  >
                                    <SelectTrigger className="rounded-[0.95rem] border-border/65 bg-background/80">
                                      <SelectValue placeholder="Output type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {PROMPT_OUTPUT_TYPE_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">Response shape</Label>
                                  <Select
                                    value={output.responseType}
                                    onValueChange={(value) => {
                                      updateTranscriptOutputFieldConfig(output.id, (current) => ({
                                        ...current,
                                        responseType: value as PromptProgramOutputField['responseType'],
                                      }))
                                    }}
                                  >
                                    <SelectTrigger className="rounded-[0.95rem] border-border/65 bg-background/80">
                                      <SelectValue placeholder="Response shape" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="text_item_list">Item list</SelectItem>
                                      <SelectItem value="combined_block">Combined block</SelectItem>
                                      <SelectItem value="table">Table</SelectItem>
                                      <SelectItem value="code_block">Code block</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">Grouping</Label>
                                  <Select
                                    value={output.grouping}
                                    onValueChange={(value) => {
                                      updateTranscriptOutputFieldConfig(output.id, (current) => ({
                                        ...current,
                                        grouping: value as PromptProgramOutputField['grouping'],
                                      }))
                                    }}
                                  >
                                    <SelectTrigger className="rounded-[0.95rem] border-border/65 bg-background/80">
                                      <SelectValue placeholder="Grouping" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="separate">Separate</SelectItem>
                                      <SelectItem value="combined">Combined</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="col-span-2 space-y-2">
                                  <Label className="text-xs text-muted-foreground">Description</Label>
                                  <Textarea
                                    value={output.description}
                                    onChange={(event) => {
                                      updateTranscriptOutputFieldConfig(output.id, (current) => ({
                                        ...current,
                                        description: event.target.value,
                                      }))
                                    }}
                                    className="min-h-20 rounded-[1rem] border-border/65 bg-background/80 shadow-none"
                                    placeholder="What this output should capture."
                                    onWheelCapture={handleTextareaWheelCapture}
                                  />
                                </div>
                                <div className="col-span-2 space-y-2">
                                  <Label className="text-xs text-muted-foreground">Prompt hint</Label>
                                  <Textarea
                                    value={output.promptHint}
                                    onChange={(event) => {
                                      updateTranscriptOutputFieldConfig(output.id, (current) => ({
                                        ...current,
                                        promptHint: event.target.value,
                                      }))
                                    }}
                                    className="min-h-20 rounded-[1rem] border-border/65 bg-background/80 shadow-none"
                                    placeholder="Optional extra direction just for this output."
                                    onWheelCapture={handleTextareaWheelCapture}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {transcriptOutputArtifacts.some((entry) => entry.artifact) ? (
                    <ScrollArea
                      className="pr-2"
                      onWheelCapture={handleScrollAreaWheelCapture}
                    >
                      <div className="space-y-3">
                        {transcriptOutputArtifacts.map(({ field, artifact }) => {
                          if (!artifact) return null

                          return (
                            <div key={field.id} className="space-y-2 rounded-[1rem] border border-border/65 bg-background/60 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-foreground">{field.label}</p>
                                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                    {outputFieldSummary(field)}
                                  </p>
                                </div>
                              </div>
                              {field.grouping === 'combined' || artifact.items.length === 0 ? (
                                <CopyableContentBlock
                                  content={artifact.content?.trim() || artifact.items.map((item) => item.text).join('\n')}
                                />
                              ) : (
                                <div className="space-y-2">
                                  {artifact.items.map((item) => (
                                    <ArtifactItemRow
                                      key={item.id}
                                      artifact={artifact}
                                      item={item}
                                      asset={item.assetId ? assetsById[item.assetId] : undefined}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}

          {node.kind === 'prompt_builder' && promptBuilderConfig ? (
            <>
              <div className="flex items-center gap-2">
                <Select
                  value={promptBuilderConfig.presetId}
                  onValueChange={(value) => {
                    const presetId = value as CanvasNodeConfigMap['prompt_builder']['presetId']
                    void updateNodeConfig(node.id, (current) => {
                      const currentConfig = current as CanvasNodeConfigMap['prompt_builder']
                      return {
                        ...currentConfig,
                        presetId,
                        outputs:
                          presetId === currentConfig.presetId
                            ? currentConfig.outputs
                            : presetId === 'youtube_packaging'
                            ? createPromptBuilderOutputsForPreset('youtube_packaging')
                            : currentConfig.outputs.length > 0
                            ? currentConfig.outputs
                            : createPromptBuilderOutputsForPreset('custom'),
                      }
                    })
                  }}
                >
                  <SelectTrigger className="rounded-[0.95rem] border-border/65 bg-background/80">
                    <SelectValue placeholder="Preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROMPT_BUILDER_PRESET_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-[0.95rem] px-3"
                  onClick={() => {
                    void updateNodeConfig(node.id, (current) => {
                      const currentConfig = current as CanvasNodeConfigMap['prompt_builder']
                      return {
                        ...currentConfig,
                        outputs: [
                          ...currentConfig.outputs,
                          {
                            outputId: generateId(),
                            label: `Output ${currentConfig.outputs.length + 1}`,
                            enabled: true,
                            requestedCount: 3,
                            presentation: 'rows',
                            promptHint: '',
                            outputType: 'generic',
                          },
                        ],
                      }
                    })
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Output
                </Button>
              </div>

              <Textarea
                value={promptBuilderConfig.sharedInstruction}
                onChange={(event) => {
                  const value = event.target.value
                  void updateNodeConfig(node.id, (current) => ({
                    ...(current as CanvasNodeConfigMap['prompt_builder']),
                    sharedInstruction: value,
                  }))
                }}
                className="min-h-24 rounded-[1rem] border-border/65 bg-background/80 shadow-none"
                placeholder="Shared instruction for all outputs. Example: keep it sharp, human, and specific."
                onWheelCapture={handleTextareaWheelCapture}
              />

              <p className="text-xs leading-5 text-muted-foreground">
                Run the builder to update all enabled child outputs. Each output appears as its own node and can be rerun separately.
              </p>

              <div className="space-y-2">
                {promptBuilderConfig.outputs.map((output) => (
                  <div
                    key={output.outputId}
                    className="rounded-[1rem] border border-border/65 bg-background/60 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{output.label}</p>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          {promptOutputTypeLabel(output)} · {output.presentation === 'rows' ? 'Rows' : 'Combined block'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={output.enabled}
                          onCheckedChange={(checked) => {
                            updatePromptBuilderOutput(node.id, output.outputId, (current) => ({
                              ...current,
                              enabled: checked,
                            }))
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-[0.8rem] text-destructive hover:text-destructive"
                          onClick={() => {
                            void updateNodeConfig(node.id, (current) => ({
                              ...(current as CanvasNodeConfigMap['prompt_builder']),
                              outputs: (current as CanvasNodeConfigMap['prompt_builder']).outputs.filter(
                                (entry) => entry.outputId !== output.outputId,
                              ),
                            }))
                          }}
                          aria-label={`Remove ${output.label}`}
                          title={`Remove ${output.label}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Label</Label>
                        <Input
                          value={output.label}
                          onChange={(event) => {
                            const value = event.target.value
                            updatePromptBuilderOutput(node.id, output.outputId, (current) => ({
                              ...current,
                              label: value,
                            }))
                          }}
                          className="rounded-[0.95rem] border-border/65 bg-background/80"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Count</Label>
                        <Input
                          type="number"
                          min={1}
                          value={String(output.requestedCount)}
                          onChange={(event) => {
                            const value = Math.max(1, Number(event.target.value) || 1)
                            updatePromptBuilderOutput(node.id, output.outputId, (current) => ({
                              ...current,
                              requestedCount: value,
                            }))
                          }}
                          className="rounded-[0.95rem] border-border/65 bg-background/80"
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label className="text-xs text-muted-foreground">Output type</Label>
                        <Select
                          value={output.outputType}
                          onValueChange={(value) => {
                            const outputType = value as PromptOutputType
                            updatePromptBuilderOutput(node.id, output.outputId, (current) => ({
                              ...current,
                              outputType,
                              presentation: defaultPresentationForOutputType(outputType),
                            }))
                          }}
                        >
                          <SelectTrigger className="rounded-[0.95rem] border-border/65 bg-background/80">
                            <SelectValue placeholder="Output type" />
                          </SelectTrigger>
                          <SelectContent>
                            {PROMPT_OUTPUT_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label className="text-xs text-muted-foreground">Presentation</Label>
                        <Select
                          value={output.presentation}
                          onValueChange={(value) => {
                            updatePromptBuilderOutput(node.id, output.outputId, (current) => ({
                              ...current,
                              presentation: value as PromptBuilderOutputDefinition['presentation'],
                            }))
                          }}
                        >
                          <SelectTrigger className="rounded-[0.95rem] border-border/65 bg-background/80">
                            <SelectValue placeholder="Presentation" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rows">Separate rows</SelectItem>
                            <SelectItem value="combined_block">One combined block</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label className="text-xs text-muted-foreground">Output hint</Label>
                        <Textarea
                          value={output.promptHint}
                          onChange={(event) => {
                            const value = event.target.value
                            updatePromptBuilderOutput(node.id, output.outputId, (current) => ({
                              ...current,
                              promptHint: value,
                            }))
                          }}
                          className="min-h-20 rounded-[1rem] border-border/65 bg-background/80 shadow-none"
                          placeholder="Optional extra direction just for this output."
                          onWheelCapture={handleTextareaWheelCapture}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {node.kind === 'prompt_output' && promptOutputConfig ? (
            <>
              <div className="rounded-[1rem] border border-border/65 bg-background/60 px-3 py-2.5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {promptOutputBuilderNode?.label || 'Prompt Builder'}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {promptOutputTypeLabel(promptOutputConfig)}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {promptOutputConfig.presentation === 'rows'
                    ? `Returns ${promptOutputConfig.requestedCount} separate items.`
                    : `Returns one copyable block with up to ${promptOutputConfig.requestedCount} items worth of content.`}
                </p>
              </div>

              {latestArtifact ? (
                <ScrollArea
                  className={cn('pr-2', !isContentExpanded && 'max-h-60')}
                  onWheelCapture={handleScrollAreaWheelCapture}
                >
                  <div className="space-y-2">
                    {promptOutputConfig.presentation === 'combined_block' ? (
                      <CopyableContentBlock
                        content={
                          latestArtifact.content?.trim() ||
                          latestArtifact.items.map((item) => item.text).join('\n')
                        }
                      />
                    ) : latestArtifact.items.length > 0 ? (
                      latestArtifact.items.map((item) => (
                        <ArtifactItemRow
                          key={item.id}
                          artifact={latestArtifact}
                          item={item}
                          asset={item.assetId ? assetsById[item.assetId] : undefined}
                        />
                      ))
                    ) : latestArtifact.content?.trim() ? (
                      <CopyableContentBlock content={latestArtifact.content} />
                    ) : null}
                  </div>
                </ScrollArea>
              ) : (
                <div className="rounded-[1rem] border border-dashed border-border/70 bg-background/60 p-4 text-xs leading-5 text-muted-foreground">
                  Nothing generated yet.
                </div>
              )}
            </>
          ) : null}

          {isPackagingOutputNode ? (
            <>
              {latestArtifact ? (
                <ScrollArea
                  className={cn('pr-2', !isContentExpanded && 'max-h-60')}
                  onWheelCapture={handleScrollAreaWheelCapture}
                >
                  <div className="space-y-2">
                    {latestArtifact.content?.trim() && (latestArtifact.items.length === 0 || node.kind === 'core_hook') ? (
                      <CopyableContentBlock content={latestArtifact.content} />
                    ) : null}
                    {latestArtifact.content?.trim() && latestArtifact.items.length > 0 && (node.kind === 'hashtags' || node.kind === 'image_prompt') ? (
                      <CopyableContentBlock content={latestArtifact.content} />
                    ) : null}
                    {(node.kind === 'core_hook' ? [] : latestArtifact.items).map((item) => (
                      <ArtifactItemRow
                        key={item.id}
                        artifact={latestArtifact}
                        item={item}
                        asset={item.assetId ? assetsById[item.assetId] : undefined}
                      />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="rounded-[1rem] border border-dashed border-border/70 bg-background/60 p-4 text-xs leading-5 text-muted-foreground">
                  Nothing generated yet.
                </div>
              )}
            </>
          ) : null}

          {node.kind === 'chat' ? (
            <>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full px-3"
                  onClick={() => {
                    void importActiveChat()
                  }}
                >
                  Import Active Chat
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={(node.config as CanvasNodeConfigMap['chat']).provider}
                  onValueChange={(value) => {
                    const provider = value as CanvasNodeConfigMap['chat']['provider']
                    void updateNodeConfig(node.id, (current) => ({
                      ...(current as CanvasNodeConfigMap['chat']),
                      provider,
                      model: MODELS[provider][0].id,
                    }))
                  }}
                >
                  <SelectTrigger className="rounded-[0.95rem] border-border/65 bg-background/80">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={(node.config as CanvasNodeConfigMap['chat']).model}
                  onValueChange={(value) => {
                    void updateNodeConfig(node.id, (current) => ({
                      ...(current as CanvasNodeConfigMap['chat']),
                      model: value,
                    }))
                  }}
                >
                  <SelectTrigger className="rounded-[0.95rem] border-border/65 bg-background/80">
                    <SelectValue placeholder="Model" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS[(node.config as CanvasNodeConfigMap['chat']).provider].map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ScrollArea
                className={cn('pr-2', !isContentExpanded && 'max-h-48')}
                onWheelCapture={handleScrollAreaWheelCapture}
              >
                <div className="space-y-2">
                  {thread.slice(-4).map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'rounded-[1rem] border p-3 text-xs leading-5',
                        message.role === 'user'
                          ? 'border-border/70 bg-background/70 text-foreground'
                          : 'border-emerald-500/20 bg-emerald-500/8 text-foreground',
                      )}
                    >
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {message.role}
                      </p>
                      <p>{message.text}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          ) : null}

          {node.kind === 'image_generate' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={(node.config as CanvasNodeConfigMap['image_generate']).model}
                  onValueChange={(value) => {
                    void updateNodeConfig(node.id, (current) => ({
                      ...(current as CanvasNodeConfigMap['image_generate']),
                      model: value as CanvasNodeConfigMap['image_generate']['model'],
                    }))
                  }}
                >
                  <SelectTrigger className="rounded-[0.95rem] border-border/65 bg-background/80">
                    <SelectValue placeholder="Model" />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_GENERATION_MODELS.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String((node.config as CanvasNodeConfigMap['image_generate']).count)}
                  onValueChange={(value) => {
                    void updateNodeConfig(node.id, (current) => ({
                      ...(current as CanvasNodeConfigMap['image_generate']),
                      count: Number(value),
                    }))
                  }}
                >
                  <SelectTrigger className="rounded-[0.95rem] border-border/65 bg-background/80">
                    <SelectValue placeholder="Count" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 image</SelectItem>
                    <SelectItem value="2">2 images</SelectItem>
                    <SelectItem value="4">4 images</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={(node.config as CanvasNodeConfigMap['image_generate']).aspectRatio}
                  onValueChange={(value) => {
                    void updateNodeConfig(node.id, (current) => ({
                      ...(current as CanvasNodeConfigMap['image_generate']),
                      aspectRatio: value as CanvasNodeConfigMap['image_generate']['aspectRatio'],
                    }))
                  }}
                >
                  <SelectTrigger className="rounded-[0.95rem] border-border/65 bg-background/80">
                    <SelectValue placeholder="Aspect ratio" />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_ASPECT_RATIO_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={(node.config as CanvasNodeConfigMap['image_generate']).imageSize}
                  onValueChange={(value) => {
                    void updateNodeConfig(node.id, (current) => ({
                      ...(current as CanvasNodeConfigMap['image_generate']),
                      imageSize: value as CanvasNodeConfigMap['image_generate']['imageSize'],
                    }))
                  }}
                >
                  <SelectTrigger className="rounded-[0.95rem] border-border/65 bg-background/80">
                    <SelectValue placeholder="Image size" />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {latestArtifact?.items.length ? (
                <ScrollArea
                  className={cn('pr-2', !isContentExpanded && 'max-h-56')}
                  onWheelCapture={handleScrollAreaWheelCapture}
                >
                  <div className="grid grid-cols-2 gap-2">
                    {latestArtifact.items.map((item) => {
                      const asset = item.assetId ? assetsById[item.assetId] : undefined
                      return asset ? (
                        <button
                          key={item.id}
                          type="button"
                          className="overflow-hidden rounded-[0.95rem] border border-border/65 bg-background/70 text-left transition-colors hover:border-border"
                          onClick={() => {
                            const composeNode = useCanvasLabStore.getState().workspaces
                              .find((workspace) => workspace.id === useCanvasLabStore.getState().activeWorkspaceId)
                              ?.nodes.find((entry) => entry.kind === 'compose')
                            if (composeNode) {
                              void useCanvasLabStore.getState().addComposeItemFromArtifact(composeNode.id, latestArtifact.id, item.id)
                            }
                          }}
                        >
                          <img src={asset.url} alt={asset.name} className="h-24 w-full object-cover" />
                          <div className="px-2 py-2 text-[11px] text-muted-foreground">{item.text}</div>
                        </button>
                      ) : null
                    })}
                  </div>
                </ScrollArea>
              ) : null}
            </div>
          ) : null}

          {node.kind === 'asset_library' ? (
            latestArtifact?.items.length ? (
              <ScrollArea
                className={cn('pr-2', !isContentExpanded && 'max-h-56')}
                onWheelCapture={handleScrollAreaWheelCapture}
              >
                <div className="grid grid-cols-2 gap-2">
                  {latestArtifact.items.map((item) => {
                    const asset = item.assetId ? assetsById[item.assetId] : undefined
                    return asset ? (
                      <button
                        key={item.id}
                        type="button"
                        className="overflow-hidden rounded-[0.95rem] border border-border/65 bg-background/70 text-left transition-colors hover:border-border"
                        onClick={() => {
                          const composeNode = useCanvasLabStore.getState().workspaces
                            .find((workspace) => workspace.id === useCanvasLabStore.getState().activeWorkspaceId)
                            ?.nodes.find((entry) => entry.kind === 'compose')
                          if (composeNode) {
                            void useCanvasLabStore.getState().addComposeItemFromAsset(composeNode.id, asset.id)
                          }
                        }}
                      >
                        <img src={asset.url} alt={asset.name} className="h-20 w-full object-cover" />
                        <div className="px-2 py-2 text-[11px] text-muted-foreground">{asset.name}</div>
                      </button>
                    ) : null
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="rounded-[1rem] border border-dashed border-border/70 bg-background/60 p-4 text-xs leading-5 text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span>Import reusable assets from the Image Gen tool to populate this node.</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full px-3"
                    onClick={() => {
                      void importReusableAssets()
                    }}
                  >
                    Import Assets
                  </Button>
                </div>
              </div>
            )
          ) : null}

          {node.kind === 'compose' ? (
            <div className="rounded-[1rem] border border-border/65 bg-background/70 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                <WandSparkles className="h-4 w-4" />
                Compose stage
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Keep the main graph clean. Open the compose stage to arrange text and images on a fixed thumbnail board.
              </p>
            </div>
          ) : null}
        </div>

        {node.kind === 'transcript_source' ? (
          <RunFooter
            onRun={() => runNode()}
            isRunning={isRunning}
          />
        ) : null}

        {node.kind === 'chat' ? (
          <RefinementRail
            value={(node.config as CanvasNodeConfigMap['chat']).draftPrompt}
            onChange={(value) => {
              void updateNodeConfig(node.id, (current) => ({
                ...(current as CanvasNodeConfigMap['chat']),
                draftPrompt: value,
              }))
            }}
            placeholder="Ask a research or follow-up question."
            onRun={() => runNode((node.config as CanvasNodeConfigMap['chat']).draftPrompt)}
            isRunning={isRunning}
            primaryLabel={latestArtifact ? 'Refine' : 'Run'}
          />
        ) : null}

        {node.kind === 'prompt_builder' ? (
          <RunFooter
            onRun={() => runNode()}
            isRunning={isRunning}
            primaryLabel="Run All"
          />
        ) : null}

        {node.kind === 'prompt_output' ? (
          <RefinementRail
            value={promptOutputConfig?.promptHint || ''}
            onChange={(value) => {
              if (!promptOutputConfig) return
              updatePromptBuilderOutput(promptOutputConfig.builderNodeId, promptOutputConfig.outputId, (current) => ({
                ...current,
                promptHint: value,
              }))
            }}
            placeholder="Refinement hint for this output."
            onRun={() => runNode()}
            isRunning={isRunning}
            primaryLabel={latestArtifact ? 'Refine' : 'Run'}
          />
        ) : null}

        {['titles', 'thumbnail_copy'].includes(node.kind) ? (
          <RefinementRail
            value={(node.config as CanvasNodeConfigMap['titles']).draftInstruction}
            onChange={(value) => {
              void updateNodeConfig(node.id, (current) => ({
                ...(current as CanvasNodeConfigMap['titles']),
                draftInstruction: value,
              }))
            }}
            placeholder="Direction for the next run, for example: darker, more direct, more curious."
            onRun={() => runNode((node.config as CanvasNodeConfigMap['titles']).draftInstruction)}
            onRunFiveMore={() => runNode((node.config as CanvasNodeConfigMap['titles']).draftInstruction || 'Give me 5 more in a fresh direction.', 5)}
            onRunTenMore={() => runNode((node.config as CanvasNodeConfigMap['titles']).draftInstruction || 'Give me 10 more in a fresh direction.', 10)}
            isRunning={isRunning}
            allowCountButtons
            primaryLabel={latestArtifact ? 'Refine' : 'Run'}
          />
        ) : null}

        {['core_hook', 'description', 'chapters', 'hashtags', 'image_prompt'].includes(node.kind) ? (
          <RefinementRail
            value={(node.config as CanvasNodeConfigMap['titles']).draftInstruction}
            onChange={(value) => {
              void updateNodeConfig(node.id, (current) => ({
                ...(current as CanvasNodeConfigMap['titles']),
                draftInstruction: value,
              }))
            }}
            placeholder="Direction for the next run, for example: sharper, simpler, more grounded."
            onRun={() => runNode((node.config as CanvasNodeConfigMap['titles']).draftInstruction)}
            isRunning={isRunning}
            primaryLabel={latestArtifact ? 'Refine' : 'Run'}
          />
        ) : null}

        {node.kind === 'image_generate' ? (
          <RunFooter
            onRun={() => runNode()}
            isRunning={isRunning}
            primaryLabel={latestArtifact ? 'Refine' : 'Run'}
          />
        ) : null}
      </Card>
        </div>
      </TooltipProvider>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-background !bg-primary/80"
      />
    </>
  )
}

export default memo(CanvasLabNodeComponent)
