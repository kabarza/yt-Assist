import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  Eye,
  Link2,
  Loader2,
  MessageSquare,
  Type,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { usePackagingSessionStore } from '@/stores/packagingSessionStore'
import type { TranscriptImportResponse } from '@/types/transcriptImport'
import { cn } from '@/lib/utils'
import { pollTranscriptImport, requestTranscriptImport } from '@/utils/transcriptImportClient'
import type { UserInputs } from '../../types/template'

interface InputsViewProps {
  userInputs: UserInputs
  setUserInputs: React.Dispatch<React.SetStateAction<UserInputs>>
  onGenerate: () => void
  onSendToAI?: () => void
  generatePrompt: (inputs: UserInputs) => string
}

function isLikelyYouTubeUrl(value: string) {
  try {
    const url = new URL(value)
    const hostname = url.hostname.toLowerCase()

    return hostname === 'youtu.be' ||
      hostname === 'youtube.com' ||
      hostname.endsWith('.youtube.com')
  } catch {
    return false
  }
}

function getImportButtonLabel(status: ReturnType<typeof usePackagingSessionStore.getState>['transcriptImport']['status']) {
  if (status === 'loading') {
    return 'Starting Import'
  }

  if (status === 'polling') {
    return 'Generating Transcript'
  }

  return 'Import Transcript'
}

const compactFieldClassName = 'rounded-[0.95rem] border-border/60 bg-background/72 shadow-none'
const utilityToggleBaseClassName =
  'inline-flex h-9 items-center gap-1.5 rounded-[0.95rem] px-3 text-sm font-medium transition-[background-color,color,box-shadow] duration-150'
const utilityToggleActiveClassName =
  'bg-background/88 text-foreground shadow-[0_14px_34px_-22px_hsl(var(--foreground)/0.55),inset_0_0_0_1px_hsl(var(--border)/0.58)]'
const utilityToggleIdleClassName =
  'bg-foreground/[0.045] text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.45)] hover:bg-foreground/[0.07] hover:text-foreground'
const disclosureRowClassName =
  'flex w-full items-center justify-between rounded-[0.95rem] px-3 py-2.5 text-left transition-[background-color,color] duration-150 hover:bg-foreground/[0.04]'

export default function InputsView({
  userInputs,
  setUserInputs,
  onGenerate,
  onSendToAI,
  generatePrompt,
}: InputsViewProps) {
  const [moreOptionsExpanded, setMoreOptionsExpanded] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const activeImportControllerRef = useRef<AbortController | null>(null)
  const {
    transcriptImport,
    setTranscriptImport,
  } = usePackagingSessionStore()

  const updateField = <K extends keyof UserInputs>(field: K, value: UserInputs[K]) => {
    setUserInputs(prev => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    return () => {
      activeImportControllerRef.current?.abort()
    }
  }, [])

  const applyImportedTranscript = (result: TranscriptImportResponse) => {
    if (result.status !== 'completed' || !result.transcriptText) {
      throw new Error('Transcript import did not return transcript text.')
    }

    updateField('transcript', result.transcriptText)
    setTranscriptImport({
      status: 'success',
      error: null,
      jobId: null,
      metadata: result.metadata ?? null,
    })
  }

  const handleImportTranscript = async () => {
    const trimmedUrl = userInputs.transcriptUrl.trim()

    if (!trimmedUrl) {
      setTranscriptImport({
        status: 'error',
        error: 'Add a YouTube URL before importing.',
        jobId: null,
      })
      return
    }

    if (!isLikelyYouTubeUrl(trimmedUrl)) {
      setTranscriptImport({
        status: 'error',
        error: 'Only YouTube video URLs are supported in v1.',
        jobId: null,
      })
      return
    }

    activeImportControllerRef.current?.abort()
    const controller = new AbortController()
    activeImportControllerRef.current = controller

    setTranscriptImport({
      status: 'loading',
      error: null,
      jobId: null,
    })

    try {
      const initialResult = await requestTranscriptImport({
        url: trimmedUrl,
        includeTimestamps: userInputs.transcriptIncludeTimestamps,
        signal: controller.signal,
      })

      if (initialResult.status === 'completed') {
        applyImportedTranscript(initialResult)
        toast.success('Transcript imported into the transcript box.')
        return
      }

      if (!initialResult.jobId) {
        throw new Error('Transcript import started but no job ID was returned.')
      }

      setTranscriptImport({
        status: 'polling',
        error: null,
        jobId: initialResult.jobId,
      })

      const finalResult = await pollTranscriptImport(initialResult.jobId, {
        signal: controller.signal,
      })

      applyImportedTranscript(finalResult)
      toast.success('Transcript imported into the transcript box.')
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }

      setTranscriptImport({
        status: 'error',
        error: error instanceof Error ? error.message : 'Transcript import failed.',
        jobId: null,
      })
    } finally {
      if (activeImportControllerRef.current === controller) {
        activeImportControllerRef.current = null
      }
    }
  }

  const wordCount = userInputs.transcript.trim()
    ? userInputs.transcript.trim().split(/\s+/).length
    : 0

  const hasTranscript = userInputs.transcript.trim().length > 0
  const isUrlMode = userInputs.transcriptSourceMode === 'url'
  const isImporting = transcriptImport.status === 'loading' || transcriptImport.status === 'polling'
  const canImport = isLikelyYouTubeUrl(userInputs.transcriptUrl) && !isImporting
  const hasTranscriptStatus =
    Boolean(transcriptImport.error) ||
    transcriptImport.status === 'polling' ||
    Boolean(transcriptImport.metadata)

  return (
    <div className="space-y-7 px-5 py-5">
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4 border-b border-border/70 pb-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Transcript</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Bring in the source material first, then shape it however you want.
            </p>
          </div>
          <span className="shrink-0 text-sm text-muted-foreground">{wordCount} words</span>
        </div>

        <div className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-background/96 shadow-[0_10px_30px_hsl(var(--background)/0.45)] transition-[border-color,box-shadow] duration-200 focus-within:border-ring/40">
          <div className="space-y-3 px-4 pb-3 pt-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Source
                </p>
                <p className="text-sm text-muted-foreground">
                  Paste text or import from a YouTube URL into this same transcript field.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateField('transcriptSourceMode', 'manual')}
                  aria-pressed={!isUrlMode}
                  className={cn(
                    utilityToggleBaseClassName,
                    !isUrlMode ? utilityToggleActiveClassName : utilityToggleIdleClassName,
                  )}
                >
                  <Type className="size-4" />
                  Paste Transcript
                </button>
                <button
                  type="button"
                  onClick={() => updateField('transcriptSourceMode', 'url')}
                  aria-pressed={isUrlMode}
                  className={cn(
                    utilityToggleBaseClassName,
                    isUrlMode ? utilityToggleActiveClassName : utilityToggleIdleClassName,
                  )}
                >
                  <Link2 className="size-4" />
                  Import from URL
                </button>
              </div>
            </div>

            {isUrlMode ? (
              <div className="space-y-3 border-t border-border/60 pt-3">
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                  <Input
                    id="transcript-url"
                    type="url"
                    value={userInputs.transcriptUrl}
                    onChange={(e) => updateField('transcriptUrl', e.target.value)}
                    placeholder="Paste a YouTube URL"
                    data-flow-name="input-transcript-url"
                    className={cn('h-10', compactFieldClassName)}
                  />

                  <Button
                    type="button"
                    onClick={handleImportTranscript}
                    disabled={!canImport}
                    data-flow-name="btn-import-transcript"
                    className="h-10 rounded-[0.95rem] px-4 text-sm font-semibold"
                  >
                    {isImporting ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                    {getImportButtonLabel(transcriptImport.status)}
                  </Button>
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Needs a Supadata key in Settings or on the server.
                  </p>
                  <label
                    htmlFor="transcript-include-timestamps"
                    className="flex items-center gap-3 text-sm text-foreground"
                  >
                    <span>Include timestamps</span>
                    <span className="text-xs text-muted-foreground">
                      {userInputs.transcriptIncludeTimestamps ? 'On' : 'Off'}
                    </span>
                    <Switch
                      id="transcript-include-timestamps"
                      checked={userInputs.transcriptIncludeTimestamps}
                      onCheckedChange={(checked) => updateField('transcriptIncludeTimestamps', checked)}
                      data-flow-name="switch-transcript-timestamps"
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {hasTranscriptStatus ? (
              <div className="space-y-3 border-t border-border/60 pt-3">
                {transcriptImport.error ? (
                  <p className="text-sm text-destructive">{transcriptImport.error}</p>
                ) : null}

                {transcriptImport.status === 'polling' ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    <span>Generating transcript. Longer videos can take a little more time.</span>
                  </div>
                ) : null}

                {transcriptImport.metadata ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="gap-1 rounded-full px-2.5 py-1">
                        <CheckCircle2 className="size-3.5" />
                        Imported
                      </Badge>
                      <Badge variant="outline" className="rounded-full px-2.5 py-1">
                        {transcriptImport.metadata.wasGenerated ? 'AI Generated' : 'Native Captions'}
                      </Badge>
                      <Badge variant="outline" className="rounded-full px-2.5 py-1 uppercase">
                        {transcriptImport.metadata.provider}
                      </Badge>
                      {transcriptImport.metadata.language ? (
                        <Badge variant="outline" className="rounded-full px-2.5 py-1 uppercase">
                          {transcriptImport.metadata.language}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {transcriptImport.metadata.title?.trim()
                        ? `Last import: ${transcriptImport.metadata.title}`
                        : 'Last import completed successfully.'}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="border-t border-border/60">
            <Textarea
              value={userInputs.transcript}
              onChange={(e) => updateField('transcript', e.target.value)}
              placeholder={isUrlMode
                ? 'Imported transcript will appear here. You can edit it after import.'
                : 'Paste your video transcript here...'}
              data-flow-name="input-transcript"
              className="h-48 resize-none rounded-none border-0 bg-transparent px-4 py-3 font-mono text-sm leading-6 focus-visible:ring-0"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4 border-b border-border/70 pb-3">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-foreground">Core Constraints</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add the few terms or ideas that the output should orbit around.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Must-Include Words
            </label>
            <Input
              type="text"
              value={userInputs.mustInclude}
              onChange={(e) => updateField('mustInclude', e.target.value)}
              placeholder="e.g., Tutorial, Review"
              data-flow-name="input-must-include"
              className={compactFieldClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Nice-To-Include Words
            </label>
            <Input
              type="text"
              value={userInputs.niceToInclude}
              onChange={(e) => updateField('niceToInclude', e.target.value)}
              placeholder="e.g., Brand names, topics"
              data-flow-name="input-nice-include"
              className={compactFieldClassName}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-border/70 pt-5">
        <button
          type="button"
          onClick={() => setMoreOptionsExpanded(!moreOptionsExpanded)}
          className={disclosureRowClassName}
        >
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ChevronDown className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              moreOptionsExpanded && 'rotate-180'
            )} />
            More Options
          </span>
        </button>

        {moreOptionsExpanded && (
          <div className="space-y-5 pt-2">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  Avoid Words/Phrases
                </label>
                <Input
                  type="text"
                  value={userInputs.avoidWords}
                  onChange={(e) => updateField('avoidWords', e.target.value)}
                  placeholder="e.g., Clickbait words to avoid"
                  data-flow-name="input-avoid-words"
                  className={compactFieldClassName}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  Hashtag Count
                </label>
                <Input
                  type="number"
                  value={userInputs.hashtagCount}
                  onChange={(e) => updateField('hashtagCount', e.target.value)}
                  placeholder="5"
                  min="1"
                  max="15"
                  data-flow-name="input-hashtag-count"
                  className={compactFieldClassName}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch
                  id="includeName"
                  checked={userInputs.includeName}
                  onCheckedChange={(checked) => updateField('includeName', checked)}
                  data-flow-name="input-include-name"
                />
                <label htmlFor="includeName" className="text-sm font-medium text-foreground">
                  Must include name in titles?
                </label>
              </div>
              {userInputs.includeName && (
                <Input
                  type="text"
                  value={userInputs.nameForTitles}
                  onChange={(e) => updateField('nameForTitles', e.target.value)}
                  placeholder="Enter the name to include..."
                  data-flow-name="input-name-for-titles"
                  className={compactFieldClassName}
                />
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Additional Context / Notes
              </label>
              <Textarea
                value={userInputs.additionalContext}
                onChange={(e) => updateField('additionalContext', e.target.value)}
                placeholder="Any other instructions or context for the AI..."
                data-flow-name="input-additional-context"
                className={cn('h-24 resize-none', compactFieldClassName)}
              />
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3 border-t border-border/70 pt-5">
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className={disclosureRowClassName}
        >
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Eye className="h-4 w-4" />
            Preview Prompt
          </span>
          <ChevronDown className={cn(
            'h-4 w-4 transition-transform',
            showPreview && 'rotate-180'
          )} />
        </button>
        {showPreview && (
          <div className="rounded-[1rem] bg-foreground/[0.035] p-4 shadow-[inset_0_0_0_1px_hsl(var(--border)/0.45)]">
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
              {generatePrompt(userInputs)}
            </pre>
          </div>
        )}
      </section>

      <section className="flex gap-3 border-t border-border/70 pt-5">
        <Button
          onClick={onGenerate}
          disabled={!hasTranscript}
          data-flow-name="btn-generate"
          size="lg"
          className="h-11 flex-1 rounded-[0.95rem] text-sm font-semibold shadow-[0_14px_30px_-24px_hsl(var(--foreground)/0.9)]"
        >
          Generate Prompt
        </Button>
        {onSendToAI && (
          <Button
            onClick={onSendToAI}
            disabled={!hasTranscript}
            data-flow-name="btn-send-to-ai"
            variant="ghost"
            size="lg"
            className="h-11 gap-2 rounded-[0.95rem] bg-foreground/[0.045] px-5 text-sm font-semibold text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.45)] hover:bg-foreground/[0.07]"
          >
            <MessageSquare className="h-5 w-5" />
            Send to AI
          </Button>
        )}
      </section>
    </div>
  )
}
