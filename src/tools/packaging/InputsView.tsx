import { useState } from 'react'
import { ChevronDown, MessageSquare } from 'lucide-react'
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
}

export default function InputsView({
  userInputs,
  setUserInputs,
  onGenerate,
  onSendToAI,
}: InputsViewProps) {
  const [moreOptionsExpanded, setMoreOptionsExpanded] = useState(false)

  const updateField = <K extends keyof UserInputs>(field: K, value: UserInputs[K]) => {
    setUserInputs(prev => ({ ...prev, [field]: value }))
  }

  const wordCount = userInputs.transcript.trim()
    ? userInputs.transcript.trim().split(/\s+/).length
    : 0

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">

      {/* Transcript Input */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-foreground">
            Transcript <span className="text-destructive">*</span>
          </label>
          <span className="text-xs text-muted-foreground">{wordCount} words</span>
        </div>
        <Textarea
          value={userInputs.transcript}
          onChange={(e) => updateField('transcript', e.target.value)}
          placeholder="Paste your video transcript here..."
          data-flow-name="input-transcript"
          className="h-32 resize-none font-mono text-sm"
        />
      </div>

      {/* Always Visible Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
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

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
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

      {/* More Options Collapsible Section */}
      <div>
        <Button
          variant="ghost"
          onClick={() => setMoreOptionsExpanded(!moreOptionsExpanded)}
          className="gap-2 text-sm font-medium p-2 h-auto"
        >
          <ChevronDown className={cn(
            "h-4 w-4 transition-transform",
            moreOptionsExpanded && "rotate-180"
          )} />
          More Options
        </Button>

        {moreOptionsExpanded && (
          <div className="mt-3 space-y-3">
            {/* Avoid Words and Hashtag Count */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
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

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
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
            <div className="px-3 py-2 bg-card border border-border rounded-lg">
              <div className={cn("flex items-center gap-3", userInputs.includeName && "mb-2")}>
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
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
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
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={onGenerate}
          disabled={!userInputs.transcript.trim()}
          data-flow-name="btn-generate"
          size="lg"
          className="flex-1 text-lg font-bold py-6"
        >
          Generate Prompt
        </Button>
        {onSendToAI && (
          <Button
            onClick={onSendToAI}
            disabled={!userInputs.transcript.trim()}
            data-flow-name="btn-send-to-ai"
            variant="secondary"
            size="lg"
            className="gap-2 px-6 py-6 text-lg font-bold"
          >
            <MessageSquare className="h-5 w-5" />
            Send to AI
          </Button>
        )}
      </div>
    </div>
  )
}
