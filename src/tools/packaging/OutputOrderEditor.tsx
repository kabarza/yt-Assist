import { GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { OutputType } from '../../types/template'

interface OutputOrderEditorProps {
  outputTypes: OutputType[]
  onReorder: (oldIndex: number, newIndex: number) => void
  onToggle: (id: string) => void
  onQuantityChange: (id: string, quantity: number) => void
}

interface SortableOutputItemProps {
  output: OutputType
  onToggle: () => void
  onQuantityChange: (quantity: number) => void
}

function SortableOutputItem({ output, onToggle, onQuantityChange }: SortableOutputItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: output.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Some outputs don't have configurable quantities
  const hasQuantity = !['core-hook', 'chapters'].includes(output.id)

  return (
    <Card
      ref={setNodeRef}
      style={style}
      data-flow-name={`output-item-${output.id}`}
      className={cn(
        "flex items-center gap-3 px-3 py-2 transition-all",
        isDragging && "ring-2 ring-ring shadow-lg z-50",
        !output.enabled && "opacity-50"
      )}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        data-flow-name={`output-drag-${output.id}`}
        aria-label={`Drag to reorder ${output.name}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Output Info */}
      <div className="flex-1 min-w-0">
        <span className={cn(
          "text-sm font-medium",
          output.enabled ? "text-foreground" : "text-muted-foreground"
        )}>
          {output.name}
        </span>
        <p className="text-xs text-muted-foreground truncate">{output.description}</p>
      </div>

      {/* Quantity Control */}
      {hasQuantity && output.enabled && (
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => onQuantityChange(output.quantity - 1)}
            disabled={output.quantity <= 1}
            data-flow-name={`output-qty-minus-${output.id}`}
            className="h-6 w-6"
            aria-label={`Decrease ${output.name} quantity`}
          >
            -
          </Button>
          <span className="w-8 text-center text-sm font-mono text-foreground" aria-label={`${output.name} quantity`}>
            {output.quantity}
          </span>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => onQuantityChange(output.quantity + 1)}
            disabled={output.quantity >= 20}
            data-flow-name={`output-qty-plus-${output.id}`}
            className="h-6 w-6"
            aria-label={`Increase ${output.name} quantity`}
          >
            +
          </Button>
        </div>
      )}

      {/* Toggle Switch */}
      <Switch
        checked={output.enabled}
        onCheckedChange={onToggle}
        data-flow-name={`output-toggle-${output.id}`}
        aria-label={`Enable ${output.name}`}
      />
    </Card>
  )
}

export default function OutputOrderEditor({
  outputTypes,
  onReorder,
  onToggle,
  onQuantityChange,
}: OutputOrderEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = outputTypes.findIndex((o) => o.id === active.id)
      const newIndex = outputTypes.findIndex((o) => o.id === over.id)
      onReorder(oldIndex, newIndex)
    }
  }

  const sortedOutputs = [...outputTypes].sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">Output Order</h4>
        <span className="text-xs text-muted-foreground">
          {outputTypes.filter(o => o.enabled).length} of {outputTypes.length} enabled
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Drag to reorder what the AI generates first. Toggle to enable/disable. Adjust quantities as needed.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedOutputs.map(o => o.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {sortedOutputs.map((output) => (
              <SortableOutputItem
                key={output.id}
                output={output}
                onToggle={() => onToggle(output.id)}
                onQuantityChange={(qty) => onQuantityChange(output.id, qty)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
