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
import type { OutputType } from '../../types/template'

interface OutputOrderEditorProps {
  outputTypes: OutputType[]
  onReorder: (oldIndex: number, newIndex: number) => void
  onToggle: (id: string) => void
  onQuantityChange: (id: string, quantity: number) => void
}

const DragHandle = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
  </svg>
)

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
    <div
      ref={setNodeRef}
      style={style}
      data-flow-name={`output-item-${output.id}`}
      className={`
        flex items-center gap-3 px-3 py-2 bg-gray-800 border rounded-lg transition-all
        ${isDragging ? 'border-lime-500 shadow-lg shadow-lime-500/20 z-50' : 'border-gray-700'}
        ${!output.enabled ? 'opacity-50' : ''}
      `}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 touch-none"
        data-flow-name={`output-drag-${output.id}`}
        aria-label={`Drag to reorder ${output.name}`}
      >
        <DragHandle />
      </button>

      {/* Output Info */}
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${output.enabled ? 'text-gray-200' : 'text-gray-400'}`}>
          {output.name}
        </span>
        <p className="text-xs text-gray-500 truncate">{output.description}</p>
      </div>

      {/* Quantity Control */}
      {hasQuantity && output.enabled && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onQuantityChange(output.quantity - 1)}
            disabled={output.quantity <= 1}
            data-flow-name={`output-qty-minus-${output.id}`}
            className="w-6 h-6 flex items-center justify-center rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Decrease ${output.name} quantity`}
          >
            -
          </button>
          <span className="w-8 text-center text-sm font-mono text-lime-400" aria-label={`${output.name} quantity`}>
            {output.quantity}
          </span>
          <button
            onClick={() => onQuantityChange(output.quantity + 1)}
            disabled={output.quantity >= 20}
            data-flow-name={`output-qty-plus-${output.id}`}
            className="w-6 h-6 flex items-center justify-center rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Increase ${output.name} quantity`}
          >
            +
          </button>
        </div>
      )}

      {/* Toggle Switch */}
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={output.enabled}
          onChange={onToggle}
          className="sr-only peer"
          data-flow-name={`output-toggle-${output.id}`}
          aria-label={`Enable ${output.name}`}
        />
        <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-lime-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-lime-500"></div>
      </label>
    </div>
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
        <h4 className="text-sm font-medium text-gray-300">Output Order</h4>
        <span className="text-xs text-gray-500">
          {outputTypes.filter(o => o.enabled).length} of {outputTypes.length} enabled
        </span>
      </div>
      <p className="text-xs text-gray-500">
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
