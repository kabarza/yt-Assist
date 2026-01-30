import { useState, useRef } from 'react'
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
import OutputOrderEditor from './OutputOrderEditor'
import ConfirmDialog from '../../components/ConfirmDialog'

type EditorTab = 'sections' | 'outputs'

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg 
    className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
)

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg 
    className={`w-4 h-4 ${filled ? 'text-yellow-400 fill-yellow-400' : 'text-gray-500'}`} 
    fill={filled ? 'currentColor' : 'none'} 
    stroke="currentColor" 
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
)

export default function TemplateEditor() {
  const { 
    sections, 
    reorderSections, 
    toggleSection, 
    updateSectionContent, 
    outputTypes,
    reorderOutputTypes,
    toggleOutputType,
    updateOutputTypeQuantity,
    presets,
    savePreset,
    loadPreset,
    deletePreset,
    exportPresets,
    importPresets,
    activePreset,
    defaultPresetId,
    setDefaultPreset,
    resetToDefault,
    generatePreviewPrompt,
  } = useTemplateStore()
  
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [activeTab, setActiveTab] = useState<EditorTab>('outputs')
  const [showPreview, setShowPreview] = useState(false)
  const [showPresetMenu, setShowPresetMenu] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')
  const [showSavePreset, setShowSavePreset] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleResetClick = () => {
    setShowResetConfirm(true)
  }

  const handleResetConfirm = () => {
    resetToDefault()
    setHasChanges(false)
    setExpandedId(null)
    setShowResetConfirm(false)
  }

  const handleSavePreset = () => {
    if (newPresetName.trim()) {
      savePreset(newPresetName.trim())
      setNewPresetName('')
      setShowSavePreset(false)
      setShowPresetMenu(false)
    }
  }

  const handleExport = () => {
    const data = exportPresets()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'yt-assist-template.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const result = event.target?.result
        if (typeof result === 'string') {
          if (importPresets(result)) {
            setHasChanges(true)
          } else {
            alert('Failed to import template. Invalid file format.')
          }
        }
      }
      reader.readAsText(file)
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const sortedSections = [...sections].sort((a, b) => a.order - b.order)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header with Presets */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Template Editor</h3>
          <p className="text-sm text-gray-400">
            Customize outputs and prompt sections to match your workflow.
          </p>
        </div>
        
        {/* Active Preset Label + Presets Dropdown */}
        <div className="flex items-center gap-3">
          {activePreset && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-800/50 rounded text-sm">
              <span className="text-gray-500">Active:</span>
              <span className="text-lime-400 font-medium">{activePreset.name}</span>
              {defaultPresetId === activePreset.id && (
                <StarIcon filled={true} />
              )}
            </div>
          )}
          
          {/* Presets Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPresetMenu(!showPresetMenu)}
              data-flow-name="btn-presets-menu"
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
              aria-label="Presets menu"
              aria-expanded={showPresetMenu}
              aria-haspopup="menu"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              Presets
              <ChevronIcon expanded={showPresetMenu} />
            </button>

          {showPresetMenu && (
            <div className="absolute right-0 top-full mt-1 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
              {/* Saved Presets */}
              {presets.length > 0 && (
                <div className="p-2 border-b border-gray-700">
                  <p className="text-xs text-gray-500 px-2 mb-1">Saved Presets</p>
                  {presets.map(preset => (
                    <div key={preset.id} className="group flex items-center gap-1">
                      {/* Star button for default */}
                      <button
                        onClick={() => setDefaultPreset(defaultPresetId === preset.id ? null : preset.id)}
                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                        aria-label={defaultPresetId === preset.id ? `Remove ${preset.name} as default preset` : `Set ${preset.name} as default preset`}
                        aria-pressed={defaultPresetId === preset.id}
                      >
                        <StarIcon filled={defaultPresetId === preset.id} />
                      </button>
                      {/* Preset name button */}
                      <button
                        onClick={() => {
                          loadPreset(preset.id)
                          setShowPresetMenu(false)
                          setHasChanges(true)
                        }}
                        className={`flex-1 text-left px-2 py-1.5 text-sm rounded transition-colors ${
                          activePreset?.id === preset.id 
                            ? 'text-lime-400 bg-gray-700/50' 
                            : 'text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {preset.name}
                        {defaultPresetId === preset.id && (
                          <span className="ml-1 text-xs text-gray-500">(default)</span>
                        )}
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={() => deletePreset(preset.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all"
                        aria-label={`Delete preset: ${preset.name}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Save New Preset */}
              <div className="p-2 border-b border-gray-700">
                {showSavePreset ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      placeholder="Preset name..."
                      className="flex-1 px-2 py-1 text-sm bg-gray-900 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
                      onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                      autoFocus
                    />
                    <button
                      onClick={handleSavePreset}
                      disabled={!newPresetName.trim()}
                      className="px-2 py-1 text-sm bg-lime-500 text-gray-900 rounded hover:bg-lime-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSavePreset(true)}
                    className="w-full text-left px-2 py-1.5 text-sm text-lime-400 hover:bg-gray-700 rounded transition-colors"
                  >
                    + Save Current as Preset
                  </button>
                )}
              </div>

              {/* Import/Export */}
              <div className="p-2">
                <button
                  onClick={handleExport}
                  className="w-full text-left px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-700 rounded transition-colors"
                >
                  Export Template...
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full text-left px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-700 rounded transition-colors"
                >
                  Import Template...
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                  aria-label="Import template file"
                />
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 p-1 bg-gray-900 rounded-lg">
        <button
          onClick={() => setActiveTab('outputs')}
          data-flow-name="tab-outputs"
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'outputs'
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Output Order
        </button>
        <button
          onClick={() => setActiveTab('sections')}
          data-flow-name="tab-sections"
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'sections'
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Prompt Sections
        </button>
      </div>

      {/* Output Order Tab */}
      {activeTab === 'outputs' && (
        <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg">
          <OutputOrderEditor
            outputTypes={outputTypes}
            onReorder={(oldIdx, newIdx) => {
              reorderOutputTypes(oldIdx, newIdx)
              setHasChanges(true)
            }}
            onToggle={(id) => {
              toggleOutputType(id)
              setHasChanges(true)
            }}
            onQuantityChange={(id, qty) => {
              updateOutputTypeQuantity(id, qty)
              setHasChanges(true)
            }}
          />
        </div>
      )}

      {/* Sections Tab */}
      {activeTab === 'sections' && (
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
      )}

      {/* Preview Panel */}
      <div className="border border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowPreview(!showPreview)}
          data-flow-name="btn-toggle-preview"
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-900 hover:bg-gray-800 transition-colors"
        >
          <span className="text-sm font-medium text-gray-300">Preview Generated Prompt</span>
          <ChevronIcon expanded={showPreview} />
        </button>
        {showPreview && (
          <div className="p-4 bg-gray-950 border-t border-gray-700">
            <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap max-h-96 overflow-auto">
              {generatePreviewPrompt()}
            </pre>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <button
          onClick={handleResetClick}
          data-flow-name="btn-reset-template"
          className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
        >
          Reset to Default
        </button>
        
        {hasChanges && (
          <span className="text-sm text-lime-500">
            Changes saved automatically
          </span>
        )}
      </div>

      {/* Info Panel */}
      <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg">
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

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Reset to Default?"
        message="This will reset all sections and outputs to their default settings. Any custom configurations will be lost. This action cannot be undone."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={handleResetConfirm}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  )
}
