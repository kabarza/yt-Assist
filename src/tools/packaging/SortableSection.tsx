import { useRef } from 'react'
import { GripVertical, ChevronDown } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { TemplateSection } from '../../types/template'
import { TEMPLATE_VARIABLES } from '../../types/template'

interface SortableSectionProps {
  section: TemplateSection
  isExpanded: boolean
  onToggle: () => void
  onExpand: () => void
  onContentChange: (content: string) => void
}

export default function SortableSection({
  section,
  isExpanded,
  onToggle,
  onExpand,
  onContentChange,
}: SortableSectionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const insertVariable = (varName: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = section.content
    const variableText = `\${${varName}}`

    const newContent = text.substring(0, start) + variableText + text.substring(end)
    onContentChange(newContent)

    // Restore focus and set cursor position after the inserted variable
    setTimeout(() => {
      textarea.focus()
      const newPosition = start + variableText.length
      textarea.setSelectionRange(newPosition, newPosition)
    }, 0)
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      data-flow-name={`section-${section.id}`}
      className={cn(
        "overflow-hidden transition-all",
        isDragging && "ring-2 ring-ring shadow-lg z-50",
        !section.enabled && "opacity-50"
      )}
    >
      {/* Section Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          data-flow-name={`drag-handle-${section.id}`}
          aria-label={`Drag to reorder ${section.name} section`}
        >
          <GripVertical className="h-5 w-5" />
        </button>

        {/* Section Name (clickable to expand) */}
        <button
          onClick={onExpand}
          className="flex-1 flex items-center justify-between text-left"
          data-flow-name={`expand-${section.id}`}
        >
          <span className="font-medium text-foreground text-sm">{section.name}</span>
          <ChevronDown className={cn(
            "h-4 w-4 transition-transform duration-200",
            isExpanded && "rotate-180"
          )} />
        </button>

        {/* Toggle Switch */}
        <Switch
          checked={section.enabled}
          onCheckedChange={onToggle}
          data-flow-name={`toggle-${section.id}`}
          aria-label={`Enable ${section.name} section`}
        />
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border">
          {/* Variable Chips */}
          <div className="mt-3 mb-2">
            <p className="text-xs text-muted-foreground mb-2">Click to insert variable:</p>
            <div className="flex flex-wrap gap-1">
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.name}
                  onClick={() => insertVariable(v.name)}
                  title={v.description}
                  data-flow-name={`var-chip-${v.name}`}
                  className="inline-flex items-center rounded-md border border-border px-2.5 py-0.5 text-xs font-mono font-semibold transition-colors hover:bg-accent cursor-pointer"
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>

          <Textarea
            ref={textareaRef}
            value={section.content}
            onChange={(e) => onContentChange(e.target.value)}
            data-flow-name={`content-${section.id}`}
            className="h-64 font-mono text-sm resize-y"
            placeholder="Section content..."
          />
        </div>
      )}
    </Card>
  )
}
