import { useState } from 'react'
import { ChevronDown, Eye, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { UserInputs } from '../../types/template'

interface InputsViewProps {
  userInputs: UserInputs
  setUserInputs: React.Dispatch<React.SetStateAction<UserInputs>>
  onGenerate: () => void
  onSendToAI?: () => void
  generatePrompt: (inputs: UserInputs) => string
}

export default function InputsView({
  userInputs,
  setUserInputs,
  onGenerate,
  onSendToAI,
  generatePrompt,
}: InputsViewProps) {
  const [moreOptionsExpanded, setMoreOptionsExpanded] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const updateField = <K extends keyof UserInputs>(field: K, value: UserInputs[K]) => {
    setUserInputs(prev => ({ ...prev, [field]: value }))
  }

  const wordCount = userInputs.transcript.trim()
    ? userInputs.transcript.trim().split(/\s+/).length
    : 0

  const hasTranscript = userInputs.transcript.trim().length > 0

  return (
    <div className="mx-auto max-w-5xl space-y-10 p-6 sm:p-10">
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4 border-b border-border/70 pb-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Transcript</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Start with the source material. Everything else stays optional.
            </p>
          </div>
          <span className="shrink-0 text-sm text-muted-foreground">{wordCount} words</span>
        </div>

        <Textarea
          value={userInputs.transcript}
          onChange={(e) => updateField('transcript', e.target.value)}
          placeholder="Paste your video transcript here..."
          data-flow-name="input-transcript"
          className="h-40 resize-none border-border/80 font-mono text-sm leading-6"
        />
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4 border-b border-border/70 pb-3">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">Core Constraints</h3>
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
          />
          </div>
        </div>
      </section>

      {/* More Options Collapsible Section */}
      <section className="space-y-4 border-t border-border/70 pt-6">
        <button
          type="button"
          onClick={() => setMoreOptionsExpanded(!moreOptionsExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-foreground"
        >
          <ChevronDown className={cn(
            "h-4 w-4 transition-transform text-muted-foreground",
            moreOptionsExpanded && "rotate-180"
          )} />
          More Options
        </button>

        {moreOptionsExpanded && (
          <div className="space-y-6 pt-2">
            {/* Avoid Words and Hashtag Count */}
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
                />
              </div>
            </div>

            {/* Name Options */}
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
                />
              )}
            </div>

            {/* Additional Context */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Additional Context / Notes
              </label>
              <Textarea
                value={userInputs.additionalContext}
                onChange={(e) => updateField('additionalContext', e.target.value)}
                placeholder="Any other instructions or context for the AI..."
                data-flow-name="input-additional-context"
                className="h-24 resize-none"
              />
            </div>
          </div>
        )}
      </section>

      {/* Prompt Preview */}
      <section className="space-y-4 border-t border-border/70 pt-6">
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Eye className="h-4 w-4" />
            Preview Prompt
          </span>
          <ChevronDown className={cn(
            "h-4 w-4 transition-transform",
            showPreview && "rotate-180"
          )} />
        </button>
        {showPreview && (
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap max-h-96 overflow-auto">
              {generatePrompt(userInputs)}
            </pre>
          </div>
        )}
      </section>

      {/* Action Buttons */}
      <section className="flex gap-3 border-t border-border/70 pt-6">
        <Button
          onClick={onGenerate}
          disabled={!hasTranscript}
          data-flow-name="btn-generate"
          size="lg"
          className="h-12 flex-1 text-base font-semibold"
        >
          Generate Prompt
        </Button>
        {onSendToAI && (
          <Button
            onClick={onSendToAI}
            disabled={!hasTranscript}
            data-flow-name="btn-send-to-ai"
            variant="secondary"
            size="lg"
            className="h-12 gap-2 px-6 text-base font-semibold"
          >
            <MessageSquare className="h-5 w-5" />
            Send to AI
          </Button>
        )}
      </section>
    </div>
  )
}
