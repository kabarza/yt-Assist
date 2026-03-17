import { memo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import {
  ArrowRight,
  Bug,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  Pin,
  Play,
  WandSparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  useCanvasLabStore,
  useCanvasNode,
  useCanvasNodeArtifacts,
  useCanvasNodeLatestRun,
  useCanvasNodeThread,
} from '@/stores/canvasLabStore'
import { MODELS } from '@/types/chat'
import type {
  Artifact,
  ArtifactItem,
  CanvasAsset,
  CanvasNodeConfigMap,
  PackagingBriefConfig,
  PackagingOutputNodeKind,
} from '@/types/canvasLab'
import { cn } from '@/lib/utils'
import { IMAGE_ASPECT_RATIO_OPTIONS, IMAGE_GENERATION_MODELS, IMAGE_SIZE_OPTIONS } from '@/types/images'
import {
  deriveTranscriptArtifacts,
  PACKAGING_OUTPUT_NODE_KINDS,
} from '@/utils/canvasLabWorkspace'
import { toast } from 'sonner'

const statusClassNames = {
  idle: 'border-border/80 text-muted-foreground',
  running: 'border-amber-500/35 text-amber-600 dark:text-amber-300',
  complete: 'border-emerald-500/35 text-emerald-700 dark:text-emerald-300',
  stale: 'border-blue-500/35 text-blue-700 dark:text-blue-300',
  error: 'border-destructive/40 text-destructive',
}

const OUTPUT_SELECTION_LABELS: Record<PackagingOutputNodeKind, string> = {
  core_hook: 'Core Hook',
  description: 'Description',
  titles: 'Titles',
  thumbnail_copy: 'Thumbnail Copy',
  chapters: 'Chapters',
  hashtags: 'Hashtags',
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-[0.8rem] opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => copyTextToClipboard(item.text, 'Copied item')}
            aria-label="Copy item"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant={item.accepted ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8 rounded-[0.8rem]"
            onClick={() => {
              void toggleArtifactItemState(artifact.id, item.id, 'accepted')
            }}
            aria-label={item.accepted ? 'Unaccept item' : 'Accept item'}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant={item.pinned ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8 rounded-[0.8rem]"
            onClick={() => {
              void toggleArtifactItemState(artifact.id, item.id, 'pinned')
            }}
            aria-label={item.pinned ? 'Unpin item' : 'Pin item'}
          >
            <Pin className="h-3.5 w-3.5" />
          </Button>
          {composeNodeId ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-[0.8rem]"
              onClick={() => {
                void addComposeItemFromArtifact(composeNodeId, artifact.id, item.id)
              }}
              aria-label="Send item to compose stage"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function NodeHeader({
  label,
  status,
  kind,
  onOpenCompose,
  onOpenDebug,
}: {
  label: string
  status: string
  kind: string
  onOpenCompose?: () => void
  onOpenDebug?: () => void
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
        <Badge
          variant="outline"
          className={cn(
            'rounded-full bg-background/70 text-[10px] uppercase',
            statusClassNames[status as keyof typeof statusClassNames] || statusClassNames.idle,
          )}
        >
          {status}
        </Badge>
        {onOpenDebug ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-3"
            onClick={onOpenDebug}
          >
            <Bug className="mr-1.5 h-3.5 w-3.5" />
            Debug
          </Button>
        ) : null}
        {onOpenCompose ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-3"
            onClick={onOpenCompose}
          >
            Stage
          </Button>
        ) : null}
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

function CopyableContentBlock({
  content,
}: {
  content: string
}) {
  return (
    <div className="group rounded-[1rem] border border-border/65 bg-background/70 p-3 text-sm leading-6 text-foreground">
      <div className="mb-2 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-[0.8rem] opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => copyTextToClipboard(content, 'Copied block')}
          aria-label="Copy block"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
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
  const importPackagingSession = useCanvasLabStore((state) => state.importPackagingSession)
  const importActiveChat = useCanvasLabStore((state) => state.importActiveChat)
  const importReusableAssets = useCanvasLabStore((state) => state.importReusableAssets)
  const setOpenComposeNodeId = useCanvasLabStore((state) => state.setOpenComposeNodeId)
  const setOpenDebugNodeId = useCanvasLabStore((state) => state.setOpenDebugNodeId)
  const assetsById = useCanvasLabStore((state) => state.assetsById)
  const [isTranscriptGuidanceOpen, setIsTranscriptGuidanceOpen] = useState(false)

  if (!node) {
    return null
  }

  const latestArtifact = [...artifacts].sort((a, b) => b.updatedAt - a.updatedAt)[0]
  const isRunning = node.status === 'running'
  const transcriptConfig =
    node.kind === 'transcript_source'
      ? (node.config as CanvasNodeConfigMap['transcript_source'])
      : null
  const guidanceCount = transcriptConfig ? activeGuidanceFieldCount(transcriptConfig.brief) : 0
  const latestError = latestRun?.status === 'error' ? latestRun.error?.trim() || '' : ''
  const latestWarnings = latestRun?.warnings?.filter((warning) => warning.trim()) || []
  const canOpenDebug = Boolean(latestRun?.requestPreview || latestRun?.responsePreview)
  const isPackagingOutputNode = ['core_hook', 'description', 'titles', 'chapters', 'hashtags', 'thumbnail_copy', 'image_prompt'].includes(node.kind)

  const runNode = (message?: string, requestedCount?: number) => {
    void executeNode(node.id, { message, requestedCount })
  }

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-background !bg-primary/80"
      />
      <Card className="w-[320px] overflow-hidden rounded-[1.35rem] border-border/80 bg-card/95 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
        <NodeHeader
          label={node.label}
          status={node.status}
          kind={node.kind}
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
                  const transcript = event.target.value
                  void updateNodeConfig(node.id, (current) => ({
                    ...(current as CanvasNodeConfigMap['transcript_source']),
                    transcript,
                    artifacts: deriveTranscriptArtifacts(transcript),
                  }))
                }}
                className="min-h-36 rounded-[1rem] border-border/65 bg-background/80 shadow-none"
                placeholder="Paste transcript here, or import from Packaging."
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
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                This node auto-derives the digest, timestamp map, and key hooks for downstream nodes.
              </p>
              {transcriptConfig ? (
                <div className="overflow-hidden rounded-[1rem] border border-border/65 bg-background/55">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-background/60"
                    onClick={() => setIsTranscriptGuidanceOpen((current) => !current)}
                    aria-expanded={isTranscriptGuidanceOpen}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">Optional guidance</p>
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
                            const value = event.target.value
                            void updateNodeConfig(node.id, (current) => ({
                              ...(current as CanvasNodeConfigMap['transcript_source']),
                              brief: {
                                ...(current as CanvasNodeConfigMap['transcript_source']).brief,
                                mustInclude: value,
                              },
                            }))
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
                            const value = event.target.value
                            void updateNodeConfig(node.id, (current) => ({
                              ...(current as CanvasNodeConfigMap['transcript_source']),
                              brief: {
                                ...(current as CanvasNodeConfigMap['transcript_source']).brief,
                                niceToInclude: value,
                              },
                            }))
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
                            const value = event.target.value
                            void updateNodeConfig(node.id, (current) => ({
                              ...(current as CanvasNodeConfigMap['transcript_source']),
                              brief: {
                                ...(current as CanvasNodeConfigMap['transcript_source']).brief,
                                avoidWords: value,
                              },
                            }))
                          }}
                          className="rounded-[0.95rem] border-border/65 bg-background/80"
                          placeholder="Terms you do not want in the output"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`${node.id}-packaging-directions`} className="text-xs text-muted-foreground">
                          Packaging directions
                        </Label>
                        <Textarea
                          id={`${node.id}-packaging-directions`}
                          value={transcriptConfig.brief.additionalContext}
                          onChange={(event) => {
                            const value = event.target.value
                            void updateNodeConfig(node.id, (current) => ({
                              ...(current as CanvasNodeConfigMap['transcript_source']),
                              brief: {
                                ...(current as CanvasNodeConfigMap['transcript_source']).brief,
                                additionalContext: value,
                              },
                            }))
                          }}
                          className="min-h-24 rounded-[1rem] border-border/65 bg-background/80 shadow-none"
                          placeholder="Audience, tone, packaging direction, or channel context"
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
                              void updateNodeConfig(node.id, (current) => ({
                                ...(current as CanvasNodeConfigMap['transcript_source']),
                                brief: {
                                  ...(current as CanvasNodeConfigMap['transcript_source']).brief,
                                  transcriptIncludeTimestamps: checked,
                                },
                              }))
                            }}
                          />
                        </div>
                      </div>

                      <div className="rounded-[0.95rem] border border-border/65 bg-background/70 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <Label htmlFor={`${node.id}-include-name`} className="text-sm font-medium text-foreground">
                              Include a specific name
                            </Label>
                            <p className="text-xs leading-5 text-muted-foreground">
                              Use this when titles should anchor to a person, channel, or brand.
                            </p>
                          </div>
                          <Switch
                            id={`${node.id}-include-name`}
                            checked={transcriptConfig.brief.includeName}
                            onCheckedChange={(checked) => {
                              void updateNodeConfig(node.id, (current) => ({
                                ...(current as CanvasNodeConfigMap['transcript_source']),
                                brief: {
                                  ...(current as CanvasNodeConfigMap['transcript_source']).brief,
                                  includeName: checked,
                                },
                              }))
                            }}
                          />
                        </div>

                        {transcriptConfig.brief.includeName ? (
                          <div className="mt-3 space-y-2">
                            <Label htmlFor={`${node.id}-name-for-titles`} className="text-xs text-muted-foreground">
                              Name to include in titles
                            </Label>
                            <Input
                              id={`${node.id}-name-for-titles`}
                              value={transcriptConfig.brief.nameForTitles}
                              onChange={(event) => {
                                const value = event.target.value
                                void updateNodeConfig(node.id, (current) => ({
                                  ...(current as CanvasNodeConfigMap['transcript_source']),
                                  brief: {
                                    ...(current as CanvasNodeConfigMap['transcript_source']).brief,
                                    nameForTitles: value,
                                  },
                                }))
                              }}
                              className="rounded-[0.95rem] border-border/65 bg-background/80"
                              placeholder="Person, brand, or channel name"
                            />
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-[0.95rem] border border-border/65 bg-background/70 p-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">Generated outputs</p>
                          <p className="text-xs leading-5 text-muted-foreground">
                            Checked outputs are generated when you run Transcript Source. Unchecked outputs stay on canvas if they already exist, but future transcript runs skip them.
                          </p>
                        </div>

                        <div className="mt-3 space-y-2">
                          {PACKAGING_OUTPUT_NODE_KINDS.map((kind) => {
                            const selection = transcriptConfig.selectedOutputs[kind]
                            return (
                              <div
                                key={kind}
                                className="flex items-center gap-3 rounded-[0.9rem] border border-border/60 bg-background/80 px-3 py-2.5"
                              >
                                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground">
                                      {OUTPUT_SELECTION_LABELS[kind]}
                                    </p>
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                      {selection.enabled ? 'Included' : 'Skipped'}
                                    </p>
                                  </div>
                                  {kind !== 'core_hook' ? (
                                    <Input
                                      type="number"
                                      min={1}
                                      value={String(selection.count)}
                                      onChange={(event) => {
                                        const value = Math.max(1, Number(event.target.value) || 1)
                                        void updateNodeConfig(node.id, (current) => ({
                                          ...(current as CanvasNodeConfigMap['transcript_source']),
                                          selectedOutputs: {
                                            ...(current as CanvasNodeConfigMap['transcript_source']).selectedOutputs,
                                            [kind]: {
                                              ...(current as CanvasNodeConfigMap['transcript_source']).selectedOutputs[kind],
                                              count: value,
                                            },
                                          },
                                        }))
                                      }}
                                      className="h-9 w-20 rounded-[0.8rem] border-border/65 bg-background/90 text-center"
                                    />
                                  ) : null}
                                </div>
                                <Switch
                                  checked={selection.enabled}
                                  onCheckedChange={(checked) => {
                                    void updateNodeConfig(node.id, (current) => ({
                                      ...(current as CanvasNodeConfigMap['transcript_source']),
                                      selectedOutputs: {
                                        ...(current as CanvasNodeConfigMap['transcript_source']).selectedOutputs,
                                        [kind]: {
                                          ...(current as CanvasNodeConfigMap['transcript_source']).selectedOutputs[kind],
                                          enabled: checked,
                                        },
                                      },
                                    }))
                                  }}
                                />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}

          {isPackagingOutputNode ? (
            <>
              <Textarea
                value={(node.config as CanvasNodeConfigMap['titles']).draftInstruction}
                onChange={(event) => {
                  const value = event.target.value
                  void updateNodeConfig(node.id, (current) => ({
                    ...(current as CanvasNodeConfigMap['titles']),
                    draftInstruction: value,
                  }))
                }}
                className="min-h-20 rounded-[1rem] border-border/65 bg-background/80 shadow-none"
                placeholder="Direction for the next run, for example: darker, more direct, more curious."
              />
              {latestArtifact ? (
                <ScrollArea className="max-h-60 pr-2">
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
              <Textarea
                value={(node.config as CanvasNodeConfigMap['chat']).draftPrompt}
                onChange={(event) => {
                  const value = event.target.value
                  void updateNodeConfig(node.id, (current) => ({
                    ...(current as CanvasNodeConfigMap['chat']),
                    draftPrompt: value,
                  }))
                }}
                className="min-h-24 rounded-[1rem] border-border/65 bg-background/80 shadow-none"
                placeholder="Ask a research or follow-up question."
              />
              <ScrollArea className="max-h-48 pr-2">
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
                <ScrollArea className="max-h-56 pr-2">
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
              <ScrollArea className="max-h-56 pr-2">
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
          <RunFooter
            onRun={() => runNode((node.config as CanvasNodeConfigMap['chat']).draftPrompt)}
            isRunning={isRunning}
            primaryLabel={latestArtifact ? 'Refine' : 'Run'}
          />
        ) : null}

        {['titles', 'thumbnail_copy'].includes(node.kind) ? (
          <RunFooter
            onRun={() => runNode((node.config as CanvasNodeConfigMap['titles']).draftInstruction)}
            onRunFiveMore={() => runNode((node.config as CanvasNodeConfigMap['titles']).draftInstruction || 'Give me 5 more in a fresh direction.', 5)}
            onRunTenMore={() => runNode((node.config as CanvasNodeConfigMap['titles']).draftInstruction || 'Give me 10 more in a fresh direction.', 10)}
            isRunning={isRunning}
            allowCountButtons
            primaryLabel={latestArtifact ? 'Refine' : 'Run'}
          />
        ) : null}

        {['core_hook', 'description', 'chapters', 'hashtags', 'image_prompt', 'image_generate'].includes(node.kind) ? (
          <RunFooter
            onRun={() => runNode((node.config as CanvasNodeConfigMap['titles']).draftInstruction)}
            isRunning={isRunning}
            primaryLabel={latestArtifact ? 'Refine' : 'Run'}
          />
        ) : null}
      </Card>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-background !bg-primary/80"
      />
    </>
  )
}

export default memo(CanvasLabNodeComponent)
