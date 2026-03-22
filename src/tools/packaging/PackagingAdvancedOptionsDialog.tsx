import type { Dispatch, SetStateAction } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { OutputType, UserInputs } from '@/types/template'
import {
  packagingFieldGroupClassName,
  packagingFieldLabelClassName,
  packagingFieldStackClassName,
  packagingTextareaFieldClassName,
} from './fieldStyles'

interface PackagingAdvancedOptionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userInputs: UserInputs
  setUserInputs: Dispatch<SetStateAction<UserInputs>>
  outputTypes: OutputType[]
  onToggleOutput: (id: string) => void
  onChangeOutputQuantity: (id: string, quantity: number) => void
}

const inlineStepperButtonClassName =
  'h-7 w-7 rounded-full border border-border/55 bg-background/78 text-foreground shadow-none hover:bg-muted/35 [&_svg]:size-3.5'

function outputHasQuantity(outputId: OutputType['id']) {
  return !['core-hook', 'chapters'].includes(outputId)
}

export default function PackagingAdvancedOptionsDialog({
  open,
  onOpenChange,
  userInputs,
  setUserInputs,
  outputTypes,
  onToggleOutput,
  onChangeOutputQuantity,
}: PackagingAdvancedOptionsDialogProps) {
  const updateField = <K extends keyof UserInputs>(field: K, value: UserInputs[K]) => {
    setUserInputs((prev) => ({ ...prev, [field]: value }))
  }

  const sortedOutputs = [...outputTypes].sort((a, b) => a.order - b.order)

  const renderToggle = (output: OutputType, className?: string) => (
    <Switch
      checked={output.enabled}
      onCheckedChange={() => onToggleOutput(output.id)}
      data-flow-name={`advanced-output-toggle-${output.id}`}
      aria-label={`Enable ${output.name}`}
      className={cn('h-5 w-9 shrink-0', className)}
    />
  )

  const renderCounter = (output: OutputType) => {
    if (!outputHasQuantity(output.id)) return null

    return (
      <div className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/45 p-[3px] shadow-[inset_0_1px_0_hsl(var(--background)/0.28)]">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={inlineStepperButtonClassName}
          onClick={() => onChangeOutputQuantity(output.id, output.quantity - 1)}
          disabled={output.quantity <= 1}
          aria-label={`Decrease ${output.name} count`}
        >
          <Minus className="size-4" />
        </Button>
        <span className="min-w-7 text-center text-sm font-semibold tabular-nums text-foreground">
          {output.quantity}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={inlineStepperButtonClassName}
          onClick={() => onChangeOutputQuantity(output.id, output.quantity + 1)}
          disabled={output.quantity >= 20}
          aria-label={`Increase ${output.name} count`}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    )
  }

  const renderOutputCard = (output: OutputType) => {
    const hasQuantity = outputHasQuantity(output.id)
    const counter = renderCounter(output)

    return (
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="pr-3 text-[1rem] font-medium leading-5 text-foreground">{output.name}</p>
            <p className="max-w-[26rem] text-[0.9rem] leading-5 text-muted-foreground">{output.description}</p>
          </div>
          <div className="flex items-center gap-2">
            {hasQuantity ? counter : null}
            {renderToggle(output)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-[62rem] overflow-hidden rounded-[1.4rem] p-0">
        <DialogHeader className="border-b border-border/50 px-7 pb-4 pt-6">
          <DialogTitle className="text-[1.65rem] font-semibold tracking-[-0.03em]">Advanced options</DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-4">
          <div className="max-h-[calc(88vh-6.1rem)] overflow-y-auto pr-2 [scrollbar-gutter:stable]">
            <div className="grid gap-6 px-2 py-5 lg:grid-cols-[minmax(0,22.5rem)_minmax(0,1fr)] lg:gap-7">
              <div className="space-y-5">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Prompt controls</p>
                  <p className="max-w-[20rem] text-[0.88rem] leading-5 text-muted-foreground">
                    Keep extras and exclusions here.
                  </p>
                </div>

                <div className={packagingFieldStackClassName}>
                  <div className={packagingFieldGroupClassName}>
                    <Label htmlFor="advanced-nice-to-include" className={packagingFieldLabelClassName}>
                      Nice to include
                    </Label>
                    <Textarea
                      id="advanced-nice-to-include"
                      value={userInputs.niceToInclude}
                      onChange={(event) => updateField('niceToInclude', event.target.value)}
                      placeholder={'Optional extras\nAngles\nBrand words\nTopics to weave in if useful'}
                      data-flow-name="input-nice-include"
                      className={cn(
                        'min-h-[7rem] resize-y',
                        packagingTextareaFieldClassName,
                      )}
                    />
                  </div>

                  <div className={packagingFieldGroupClassName}>
                    <Label htmlFor="avoid-words" className={packagingFieldLabelClassName}>
                      Avoid words
                    </Label>
                    <Textarea
                      id="avoid-words"
                      value={userInputs.avoidWords}
                      onChange={(event) => updateField('avoidWords', event.target.value)}
                      placeholder={'One term per line if helpful\nWords or phrases to avoid'}
                      data-flow-name="input-avoid-words"
                      className={cn(
                        'min-h-[6.25rem] resize-y',
                        packagingTextareaFieldClassName,
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3.5 lg:pl-1">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Output controls</p>
                  <p className="text-[0.92rem] leading-5 text-muted-foreground">
                    Enable, disable, and size outputs here. Order still comes from the Template tab.
                  </p>
                </div>

                <div className="overflow-hidden rounded-[0.95rem] border border-border/40 bg-background/18">
                  {sortedOutputs.map((output, index) => (
                    <div
                      key={output.id}
                      className={cn(
                        'px-4 py-3.5 transition-opacity sm:px-[1.125rem] sm:py-4',
                        index > 0 && 'border-t border-border/35',
                        !output.enabled && 'opacity-70',
                      )}
                    >
                      {renderOutputCard(output)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
