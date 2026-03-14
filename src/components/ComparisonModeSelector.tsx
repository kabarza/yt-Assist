import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, Plus, ArrowLeftRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Provider } from '../types/chat'
import { MODELS } from '../types/chat'

export interface ComparisonModel {
  provider: Provider
  model: string
}

interface ComparisonModeSelectorProps {
  selectedModels: ComparisonModel[]
  onModelsChange: (models: ComparisonModel[]) => void
  onClose: () => void
  isActive: boolean
}

function ModelSelector({
  value,
  onChange,
  onRemove,
  canRemove,
}: {
  value: ComparisonModel
  onChange: (model: ComparisonModel) => void
  onRemove: () => void
  canRemove: boolean
}) {
  return (
    <div
      className={cn(
        'grid gap-2 sm:items-center',
        canRemove
          ? 'sm:grid-cols-[8.5rem_minmax(0,1fr)_2.25rem]'
          : 'sm:grid-cols-[8.5rem_minmax(0,1fr)]'
      )}
    >
      {/* Provider selector */}
      <Select
        value={value.provider}
        onValueChange={(provider: Provider) => {
          onChange({
            provider,
            model: MODELS[provider][0].id,
          })
        }}
      >
        <SelectTrigger className="h-9 w-full rounded-[0.85rem] text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="anthropic">Anthropic</SelectItem>
          <SelectItem value="openai">OpenAI</SelectItem>
        </SelectContent>
      </Select>

      {/* Model selector */}
      <Select
        value={value.model}
        onValueChange={(model) => onChange({ ...value, model })}
      >
        <SelectTrigger className="h-9 w-full rounded-[0.85rem] text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MODELS[value.provider].map((model) => (
            <SelectItem key={model.id} value={model.id}>
              {model.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Remove button */}
      {canRemove && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-9 w-9 rounded-[0.85rem] text-muted-foreground hover:text-foreground"
          title="Remove model"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

export default function ComparisonModeSelector({
  selectedModels,
  onModelsChange,
  onClose,
  isActive,
}: ComparisonModeSelectorProps) {
  const canAddMore = selectedModels.length < 4

  const handleModelChange = (index: number, model: ComparisonModel) => {
    const newModels = [...selectedModels]
    newModels[index] = model
    onModelsChange(newModels)
  }

  const handleRemoveModel = (index: number) => {
    if (selectedModels.length > 2) {
      onModelsChange(selectedModels.filter((_, i) => i !== index))
    }
  }

  const handleAddModel = () => {
    if (canAddMore) {
      onModelsChange([
        ...selectedModels,
        { provider: 'openai', model: MODELS.openai[0].id },
      ])
    }
  }

  if (!isActive) return null

  return (
    <div className="relative z-20 w-full px-4 pb-3 sm:px-6">
      <Card className="mx-auto w-full max-w-[38rem] rounded-[1.45rem] border-border/70 bg-background/96 p-4 shadow-[0_12px_30px_hsl(var(--background)/0.32)] backdrop-blur-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                Comparison Mode
              </span>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Select 2-4 models to compare responses side-by-side.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 rounded-[0.85rem] px-2.5 text-xs"
          >
            Exit
          </Button>
        </div>

        <div className="space-y-2.5">
          {selectedModels.map((model, index) => (
            <ModelSelector
              key={index}
              value={model}
              onChange={(newModel) => handleModelChange(index, newModel)}
              onRemove={() => handleRemoveModel(index)}
              canRemove={selectedModels.length > 2}
            />
          ))}

          {canAddMore && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddModel}
              className="h-9 w-full justify-start gap-1.5 rounded-[0.85rem] px-3 text-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              Add model
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
