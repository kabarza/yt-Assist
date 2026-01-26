import { useState } from 'react'
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
} from '@dnd-kit/sortable'
import { useTemplateStore } from '../../stores/templateStore'
import SortableSection from './SortableSection'

export default function TemplateEditor() {
  const { sections, reorderSections, toggleSection, updateSectionContent, resetToDefault } = useTemplateStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((s) => s.id === active.id)
      const newIndex = sections.findIndex((s) => s.id === over.id)
      reorderSections(oldIndex, newIndex)
      setHasChanges(true)
    }
  }

  const handleToggle = (id: string) => {
    toggleSection(id)
    setHasChanges(true)
  }

  const handleContentChange = (id: string, content: string) => {
    updateSectionContent(id, content)
    setHasChanges(true)
  }

  const handleReset = () => {
    if (confirm('Reset all sections to default? This cannot be undone.')) {
      resetToDefault()
      setHasChanges(false)
      setExpandedId(null)
    }
  }

  const sortedSections = [...sections].sort((a, b) => a.order - b.order)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-2">Template Editor</h3>
        <p className="text-sm text-gray-400">
          Drag sections to reorder, toggle to enable/disable, or click to edit content.
        </p>
      </div>

      {/* Section List */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedSections.map(s => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {sortedSections.map((section) => (
              <SortableSection
                key={section.id}
                section={section}
                isExpanded={expandedId === section.id}
                onToggle={() => handleToggle(section.id)}
                onExpand={() => setExpandedId(expandedId === section.id ? null : section.id)}
                onContentChange={(content) => handleContentChange(section.id, content)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Actions */}
      <div className="mt-6 pt-6 border-t border-gray-800 flex justify-between items-center">
        <button
          onClick={handleReset}
          data-flow-name="btn-reset-template"
          className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
        >
          Reset to Default
        </button>
        
        {hasChanges && (
          <span className="text-sm text-lime-500">
            ✓ Changes saved automatically
          </span>
        )}
      </div>

      {/* Info Panel */}
      <div className="mt-6 p-4 bg-gray-900 border border-gray-700 rounded-lg">
        <h4 className="text-sm font-medium text-gray-300 mb-2">Template Variables</h4>
        <p className="text-xs text-gray-500 mb-3">
          Use these variables in your template. They will be replaced with your inputs when generating.
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <code className="text-lime-400">${'${transcript}'}</code>
          <code className="text-lime-400">${'${mustInclude}'}</code>
          <code className="text-lime-400">${'${niceToInclude}'}</code>
          <code className="text-lime-400">${'${avoidWords}'}</code>
          <code className="text-lime-400">${'${includeName}'}</code>
          <code className="text-lime-400">${'${nameForTitles}'}</code>
          <code className="text-lime-400">${'${hashtagCount}'}</code>
          <code className="text-lime-400">${'${additionalContext}'}</code>
        </div>
      </div>
    </div>
  )
}
