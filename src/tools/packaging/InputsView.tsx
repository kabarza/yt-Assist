import { useEffect, useRef, useState } from 'react'
import {
  Check,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  MessageSquare,
  Type,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { usePackagingSessionStore } from '@/stores/packagingSessionStore'
import type { TranscriptImportResponse } from '@/types/transcriptImport'
import { cn } from '@/lib/utils'
import { pollTranscriptImport, requestTranscriptImport } from '@/utils/transcriptImportClient'
import {
  packagingFieldGroupClassName,
  packagingFieldLabelClassName,
  packagingFieldStackClassName,
  packagingTextareaFieldClassName,
} from './fieldStyles'
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
    return 'Starting import'
  }

  if (status === 'polling') {
    return 'Generating transcript'
  }

  return 'Import transcript'
}

const sectionCardClassName =
  'rounded-[1.35rem] border-border/70 bg-card/95 shadow-[0_12px_32px_hsl(var(--background)/0.55)]'
const fieldClassName = 'h-10 rounded-[0.95rem] border-border/60 bg-background/80 shadow-none'

export default function InputsView({
  userInputs,
  setUserInputs,
  onGenerate,
  onSendToAI,
  generatePrompt,
}: InputsViewProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [copiedPreview, setCopiedPreview] = useState(false)
  const activeImportControllerRef = useRef<AbortController | null>(null)
  const previewCopyTimeoutRef = useRef<number | null>(null)
  const {
    transcriptImport,
    setTranscriptImport,
  } = usePackagingSessionStore()

  const updateField = <K extends keyof UserInputs>(field: K, value: UserInputs[K]) => {
    setUserInputs((prev) => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    return () => {
      activeImportControllerRef.current?.abort()

      if (previewCopyTimeoutRef.current) {
        window.clearTimeout(previewCopyTimeoutRef.current)
      }
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

  const handleCopyPreview = async () => {
    try {
      await navigator.clipboard.writeText(promptPreview)
      setCopiedPreview(true)
      toast.success('Prompt copied to clipboard.')

      if (previewCopyTimeoutRef.current) {
        window.clearTimeout(previewCopyTimeoutRef.current)
      }

      previewCopyTimeoutRef.current = window.setTimeout(() => {
        setCopiedPreview(false)
        previewCopyTimeoutRef.current = null
      }, 1800)
    } catch {
      toast.error('Could not copy the prompt.')
    }
  }

  const hasTranscript = userInputs.transcript.trim().length > 0
  const isUrlMode = userInputs.transcriptSourceMode === 'url'
  const isImporting = transcriptImport.status === 'loading' || transcriptImport.status === 'polling'
  const canImport = isLikelyYouTubeUrl(userInputs.transcriptUrl) && !isImporting
  const importMetadata = transcriptImport.metadata
  const promptPreview = generatePrompt(userInputs)

  return (
    <div className="px-5 py-5">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <Card className={sectionCardClassName}>
            <CardHeader className="gap-4 pb-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl space-y-1">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">Transcript</CardTitle>
                    <CardDescription>Paste text or import a YouTube transcript, then edit it here.</CardDescription>
                  </div>
                </div>

                <div className="flex flex-col gap-3 lg:min-w-[21rem] lg:items-end">
                  <Tabs
                    value={userInputs.transcriptSourceMode}
                    onValueChange={(value) =>
                      updateField('transcriptSourceMode', value as UserInputs['transcriptSourceMode'])
                    }
                    className="w-full lg:w-auto"
                  >
                    <TabsList className="grid w-full grid-cols-2 lg:w-auto">
                      <TabsTrigger value="manual" className="gap-2">
                        <Type className="size-4" />
                        Paste text
                      </TabsTrigger>
                      <TabsTrigger value="url" className="gap-2">
                        <Link2 className="size-4" />
                        Import URL
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {importMetadata ? (
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <Badge variant="outline" className="gap-1 rounded-full px-2.5 py-1 text-xs">
                        <CheckCircle2 className="size-3.5" />
                        Imported
                      </Badge>
                      <Badge variant="outline" className="rounded-full px-2.5 py-1 text-xs">
                        {importMetadata.wasGenerated ? 'AI generated' : 'Native captions'}
                      </Badge>
                      <Badge variant="outline" className="rounded-full px-2.5 py-1 text-xs uppercase">
                        {importMetadata.provider}
                      </Badge>
                      {importMetadata.language ? (
                        <Badge variant="outline" className="rounded-full px-2.5 py-1 text-xs uppercase">
                          {importMetadata.language}
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 p-5">
              {isUrlMode ? (
                <div className="space-y-4 rounded-[1.15rem] border border-border/60 bg-muted/20 p-4">
                  <div className="space-y-2">
                    <Label htmlFor="transcript-url">Video URL</Label>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <Input
                        id="transcript-url"
                        type="url"
                        value={userInputs.transcriptUrl}
                        onChange={(event) => updateField('transcriptUrl', event.target.value)}
                        placeholder="Paste a YouTube URL"
                        data-flow-name="input-transcript-url"
                        className={fieldClassName}
                      />
                      <Button
                        type="button"
                        onClick={handleImportTranscript}
                        disabled={!canImport}
                        data-flow-name="btn-import-transcript"
                        className="h-10 rounded-[0.95rem] px-4 text-sm font-semibold"
                      >
                        {isImporting ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Link2 className="size-4" />
                        )}
                        {getImportButtonLabel(transcriptImport.status)}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-[1rem] border border-border/60 bg-background/70 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">Requires configured Supadata access.</p>
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

                  {transcriptImport.error ? (
                    <div className="rounded-[1rem] border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
                      {transcriptImport.error}
                    </div>
                  ) : null}

                  {transcriptImport.status === 'polling' ? (
                    <div className="flex items-center gap-2 rounded-[1rem] border border-border/60 bg-background/70 px-3.5 py-3 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      <span>Generating transcript. Longer videos can take a little more time.</span>
                    </div>
                  ) : null}

                  {importMetadata?.title ? (
                    <p className="text-xs text-muted-foreground">Last import: {importMetadata.title}</p>
                  ) : null}
                </div>
              ) : transcriptImport.error ? (
                <div className="rounded-[1rem] border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
                  {transcriptImport.error}
                </div>
              ) : null}

              <div className="overflow-hidden rounded-[1.15rem] border border-border/60 bg-background">
                <div className="flex flex-col gap-2 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Transcript editor</p>
                    <p className="text-xs text-muted-foreground">
                      {isUrlMode ? 'Import lands here. Edit before sending.' : 'Paste the transcript here and shape it before sending.'}
                    </p>
                  </div>

                  {isImporting ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Importing
                    </div>
                  ) : null}
                </div>

                <Textarea
                  value={userInputs.transcript}
                  onChange={(event) => updateField('transcript', event.target.value)}
                  placeholder={
                    isUrlMode
                      ? 'Imported transcript will appear here. You can edit it after import.'
                      : 'Paste your video transcript here...'
                  }
                  data-flow-name="input-transcript"
                  className="min-h-[18rem] resize-none rounded-none border-0 bg-transparent px-4 py-4 font-mono text-sm leading-6 focus-visible:ring-0"
                />
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Dialog
                    open={previewOpen}
                    onOpenChange={(open) => {
                      setPreviewOpen(open)

                      if (!open) {
                        setCopiedPreview(false)
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="h-11 rounded-[0.95rem] bg-background/70 px-4 text-sm font-semibold"
                      >
                        Preview prompt
                      </Button>
                    </DialogTrigger>

                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>Prompt preview</DialogTitle>
                        <DialogDescription>Review the exact prompt before generating or sending it.</DialogDescription>
                      </DialogHeader>

                      <div className="max-h-[65vh] overflow-auto rounded-[1rem] border border-border/60 bg-muted/20 p-4">
                        <pre className="whitespace-pre-wrap font-mono text-xs leading-6 text-muted-foreground">
                          {promptPreview}
                        </pre>
                      </div>

                      <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
                        <Button type="button" variant="outline" onClick={handleCopyPreview}>
                          {copiedPreview ? <Check className="size-4" /> : <Copy className="size-4" />}
                          {copiedPreview ? 'Copied' : 'Copy prompt'}
                        </Button>
                        <DialogClose asChild>
                          <Button type="button" variant="ghost">
                            Close
                          </Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Button
                    onClick={onGenerate}
                    disabled={!hasTranscript}
                    data-flow-name="btn-generate"
                    variant={onSendToAI ? 'outline' : 'default'}
                    size="lg"
                    className={cn(
                      'h-11 rounded-[0.95rem] px-4 text-sm font-semibold',
                      onSendToAI && 'bg-background/70',
                    )}
                  >
                    Generate prompt
                  </Button>
                </div>

                {onSendToAI ? (
                  <Button
                    onClick={onSendToAI}
                    disabled={!hasTranscript}
                    data-flow-name="btn-send-to-ai"
                    size="lg"
                    className="h-11 rounded-[0.95rem] px-5 text-sm font-semibold"
                  >
                    <MessageSquare className="size-4" />
                    Send to AI
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className={sectionCardClassName}>
            <CardHeader className="pb-5">
              <CardTitle className="text-base">Prompt brief</CardTitle>
              <CardDescription className="max-w-[20rem]">
                Keep only the constraints that matter. Use one line per idea when you want the prompt to keep the separation.
              </CardDescription>
            </CardHeader>

            <CardContent className={packagingFieldStackClassName}>
              <div className={packagingFieldGroupClassName}>
                <Label htmlFor="must-include" className={packagingFieldLabelClassName}>
                  Must include
                </Label>
                <Textarea
                  id="must-include"
                  value={userInputs.mustInclude}
                  onChange={(event) => updateField('mustInclude', event.target.value)}
                  placeholder={'One idea per line\nKey words\nThemes\nPhrases to keep'}
                  data-flow-name="input-must-include"
                  className={cn('min-h-[6.5rem] resize-y', packagingTextareaFieldClassName)}
                />
              </div>

              <div className={packagingFieldGroupClassName}>
                <Label htmlFor="additional-context" className={packagingFieldLabelClassName}>
                  Notes
                </Label>
                <Textarea
                  id="additional-context"
                  value={userInputs.additionalContext}
                  onChange={(event) => updateField('additionalContext', event.target.value)}
                  placeholder="Any extra context for the AI..."
                  data-flow-name="input-additional-context"
                  className={cn('min-h-[8.5rem] resize-none', packagingTextareaFieldClassName)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
