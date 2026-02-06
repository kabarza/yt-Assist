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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronDown, Star, Archive } from 'lucide-react'
import { cn } from '@/lib/utils'

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
          <p className="text-sm text-muted-foreground">
            Customize outputs and prompt sections to match your workflow.
          </p>
        </div>

        {/* Presets Dropdown */}
        <DropdownMenu open={showPresetMenu} onOpenChange={setShowPresetMenu}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              data-flow-name="btn-presets-menu"
              className="gap-2"
            >
              <Archive className="size-4" />
              Presets
              <ChevronDown className={cn(
                "size-4 transition-transform duration-200",
                showPresetMenu && "rotate-180"
              )} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {/* Active Preset */}
            {activePreset && (
              <div className="p-3 border-b border-border">
                <div className="text-xs flex items-center gap-1.5">
                  <span className="text-muted-foreground">Active:</span>
                  <span className="text-foreground font-medium">{activePreset.name}</span>
                  {defaultPresetId === activePreset.id && (
                    <Star className="size-4 text-yellow-400 fill-yellow-400" />
                  )}
                </div>
              </div>
            )}

            {/* Saved Presets */}
            {presets.length > 0 && (
              <>
                <div className="p-2">
                  <p className="text-xs text-muted-foreground px-2 mb-1">Saved Presets</p>
                  {presets.map(preset => (
                    <div key={preset.id} className="group flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDefaultPreset(defaultPresetId === preset.id ? null : preset.id)}
                        className="h-auto p-1"
                        aria-label={defaultPresetId === preset.id ? `Remove ${preset.name} as default preset` : `Set ${preset.name} as default preset`}
                        aria-pressed={defaultPresetId === preset.id}
                      >
                        <Star className={cn(
                          "size-4",
                          defaultPresetId === preset.id
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-muted-foreground"
                        )} />
                      </Button>
                      <DropdownMenuItem
                        onClick={() => {
                          loadPreset(preset.id)
                          setShowPresetMenu(false)
                          setHasChanges(true)
                        }}
                        className={cn(
                          "flex-1 text-sm cursor-pointer",
                          activePreset?.id === preset.id && "bg-accent"
                        )}
                      >
                        {preset.name}
                        {defaultPresetId === preset.id && (
                          <span className="ml-1 text-xs text-muted-foreground">(default)</span>
                        )}
                      </DropdownMenuItem>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deletePreset(preset.id)}
                        className="h-auto p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        aria-label={`Delete preset: ${preset.name}`}
                      >
                        <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>
                  ))}
                </div>
                <DropdownMenuSeparator />
              </>
            )}

            {/* Save New Preset */}
            <div className="p-2">
              {showSavePreset ? (
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="Preset name..."
                    className="h-8 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                    autoFocus
                  />
                  <Button
                    onClick={handleSavePreset}
                    disabled={!newPresetName.trim()}
                    size="sm"
                    className="h-8"
                  >
                    Save
                  </Button>
                </div>
              ) : (
                <DropdownMenuItem
                  onClick={() => setShowSavePreset(true)}
                  className="text-sm cursor-pointer"
                >
                  + Save Current as Preset
                </DropdownMenuItem>
              )}
            </div>

            {/* Import/Export */}
            <DropdownMenuSeparator />
            <div className="p-2">
              <DropdownMenuItem
                onClick={handleExport}
                className="text-sm cursor-pointer"
              >
                Export Template...
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => fileInputRef.current?.click()}
                className="text-sm cursor-pointer"
              >
                Import Template...
              </DropdownMenuItem>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
                aria-label="Import template file"
              />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tab Switcher */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as EditorTab)}>
        <TabsList>
          <TabsTrigger value="outputs" data-flow-name="tab-outputs">
            Output Order
          </TabsTrigger>
          <TabsTrigger value="sections" data-flow-name="tab-sections">
            Prompt Sections
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Output Order Tab */}
      {activeTab === 'outputs' && (
        <div className="p-4 bg-card border border-border rounded-lg">
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
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setShowPreview(!showPreview)}
          data-flow-name="btn-toggle-preview"
          className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-secondary transition-colors"
        >
          <span className="text-sm font-medium text-foreground">Preview Generated Prompt</span>
          <ChevronIcon expanded={showPreview} />
        </button>
        {showPreview && (
          <div className="p-4 bg-background border-t border-border">
            <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap max-h-96 overflow-auto">
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
          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
        >
          Reset to Default
        </button>
        
        {hasChanges && (
          <span className="text-sm text-foreground">
            Changes saved automatically
          </span>
        )}
      </div>

      {/* Info Panel */}
      <div className="p-4 bg-card border border-border rounded-lg">
        <h4 className="text-sm font-medium text-foreground mb-2">Template Variables</h4>
        <p className="text-xs text-muted-foreground mb-3">
          Use these variables in your template. They will be replaced with your inputs when generating.
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <code className="text-foreground">${'${transcript}'}</code>
          <code className="text-foreground">${'${mustInclude}'}</code>
          <code className="text-foreground">${'${niceToInclude}'}</code>
          <code className="text-foreground">${'${avoidWords}'}</code>
          <code className="text-foreground">${'${includeName}'}</code>
          <code className="text-foreground">${'${nameForTitles}'}</code>
          <code className="text-foreground">${'${hashtagCount}'}</code>
          <code className="text-foreground">${'${additionalContext}'}</code>
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
