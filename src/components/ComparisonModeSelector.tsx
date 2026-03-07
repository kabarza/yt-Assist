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
    <div className="flex items-center gap-2">
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
        <SelectTrigger className="w-[120px] h-8 text-xs">
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
        <SelectTrigger className="w-[180px] h-8 text-xs">
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
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
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
    <Card className="mx-4 mb-3 p-3 bg-accent/10 border-accent">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium text-foreground">
            Comparison Mode
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-7 px-2 text-xs"
        >
          Exit
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground mb-2">
          Select 2-4 models to compare responses side-by-side
        </p>

        {/* Model selectors */}
        <div className="space-y-2">
          {selectedModels.map((model, index) => (
            <ModelSelector
              key={index}
              value={model}
              onChange={(newModel) => handleModelChange(index, newModel)}
              onRemove={() => handleRemoveModel(index)}
              canRemove={selectedModels.length > 2}
            />
          ))}
        </div>

        {/* Add model button */}
        {canAddMore && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddModel}
            className="w-full h-8 text-xs gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Model
          </Button>
        )}
      </div>
    </Card>
  )
}
