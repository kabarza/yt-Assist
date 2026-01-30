import { useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TemplateSection } from '../../types/template'
import { TEMPLATE_VARIABLES } from '../../types/template'

interface SortableSectionProps {
  section: TemplateSection
  isExpanded: boolean
  onToggle: () => void
  onExpand: () => void
  onContentChange: (content: string) => void
}

const DragHandle = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
  </svg>
)

const ChevronDown = ({ expanded }: { expanded: boolean }) => (
  <svg 
    className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
)

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
    <div
      ref={setNodeRef}
      style={style}
      data-flow-name={`section-${section.id}`}
      className={`
        bg-gray-900 border rounded-lg overflow-hidden transition-all
        ${isDragging ? 'border-lime-500 shadow-lg shadow-lime-500/20 z-50' : 'border-gray-700'}
        ${!section.enabled ? 'opacity-50' : ''}
      `}
    >
      {/* Section Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 touch-none"
          data-flow-name={`drag-handle-${section.id}`}
          aria-label={`Drag to reorder ${section.name} section`}
        >
          <DragHandle />
        </button>

        {/* Section Name (clickable to expand) */}
        <button
          onClick={onExpand}
          className="flex-1 flex items-center justify-between text-left"
          data-flow-name={`expand-${section.id}`}
        >
          <span className="font-medium text-gray-200">{section.name}</span>
          <ChevronDown expanded={isExpanded} />
        </button>

        {/* Toggle Switch */}
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={section.enabled}
            onChange={onToggle}
            className="sr-only peer"
            data-flow-name={`toggle-${section.id}`}
            aria-label={`Enable ${section.name} section`}
          />
          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-lime-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-lime-500"></div>
        </label>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-800">
          {/* Variable Chips */}
          <div className="mt-3 mb-2">
            <p className="text-xs text-gray-500 mb-2">Click to insert variable:</p>
            <div className="flex flex-wrap gap-1">
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.name}
                  onClick={() => insertVariable(v.name)}
                  title={v.description}
                  data-flow-name={`var-chip-${v.name}`}
                  className="px-2 py-1 text-xs font-mono bg-gray-800 border border-gray-600 rounded text-lime-400 hover:bg-gray-700 hover:border-lime-500 transition-colors"
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={section.content}
            onChange={(e) => onContentChange(e.target.value)}
            data-flow-name={`content-${section.id}`}
            className="w-full h-64 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-300 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
            placeholder="Section content..."
          />
        </div>
      )}
    </div>
  )
}
