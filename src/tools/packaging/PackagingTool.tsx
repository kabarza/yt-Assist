import { useState, useEffect } from 'react'
import InputsView from './InputsView'
import OutputView from './OutputView'
import TemplateEditor from './TemplateEditor'
import { useTemplateStore } from '../../stores/templateStore'
import type { UserInputs } from '../../types/template'
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
import { Badge } from '@/components/ui/badge'
import { ChevronDown, Star, Archive } from 'lucide-react'
import { cn } from '@/lib/utils'

type TabId = 'inputs' | 'output' | 'template'

interface PackagingToolProps {
  onSendToChat?: (prompt: string) => void
}

export default function PackagingTool({ onSendToChat }: PackagingToolProps) {
  const [activeTab, setActiveTab] = useState<TabId>('inputs')
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [showPresetMenu, setShowPresetMenu] = useState(false)
  const [showSavePreset, setShowSavePreset] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')
  const {
    generatePrompt,
    outputTypes,
    presets,
    loadPreset,
    deletePreset,
    savePreset,
    activePreset,
    defaultPresetId,
    setDefaultPreset,
  } = useTemplateStore()
  
  // Get hashtag count from output types
  const hashtagOutput = outputTypes.find(o => o.id === 'hashtags')
  const defaultHashtagCount = hashtagOutput?.quantity?.toString() || '5'
  
  const [userInputs, setUserInputs] = useState<UserInputs>({
    transcript: '',
    mustInclude: '',
    niceToInclude: '',
    avoidWords: '',
    includeName: false,
    nameForTitles: '',
    hashtagCount: defaultHashtagCount,
    additionalContext: '',
  })
  
  // Sync hashtag count when output types change
  useEffect(() => {
    const hashtagQty = outputTypes.find(o => o.id === 'hashtags')?.quantity?.toString() || '5'
    setUserInputs(prev => ({ ...prev, hashtagCount: hashtagQty }))
  }, [outputTypes])

  const handleGenerate = () => {
    const prompt = generatePrompt(userInputs)
    setGeneratedPrompt(prompt)
    setActiveTab('output')
  }

  const handleSendToAI = () => {
    const prompt = generatePrompt(userInputs)
    if (onSendToChat) {
      onSendToChat(prompt)
    }
  }

  const handleSavePreset = () => {
    if (newPresetName.trim()) {
      savePreset(newPresetName.trim())
      setNewPresetName('')
      setShowSavePreset(false)
      setShowPresetMenu(false)
    }
  }

  // Get enabled outputs for summary
  const enabledOutputs = outputTypes
    .filter(o => o.enabled)
    .sort((a, b) => a.order - b.order)

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex items-center justify-between gap-1 px-6 py-3 border-b border-border bg-secondary/30">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabId)} className="flex-1">
          <TabsList className="h-9">
            <TabsTrigger value="inputs" data-flow-name="tab-inputs" className="text-sm">
              Inputs
            </TabsTrigger>
            <TabsTrigger value="output" data-flow-name="tab-output" className="text-sm">
              Output
            </TabsTrigger>
            <TabsTrigger value="template" data-flow-name="tab-template" className="text-sm">
              Template
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Presets Dropdown */}
        <DropdownMenu open={showPresetMenu} onOpenChange={setShowPresetMenu}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              data-flow-name="btn-presets-input"
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
            {/* Enabled Outputs Summary Section */}
            <div className="p-3 border-b border-border">
              <p className="text-xs text-muted-foreground mb-2">Enabled Outputs</p>
              <div className="flex flex-wrap gap-1">
                {enabledOutputs.map(output => (
                  <Badge key={output.id} variant="outline" className="text-xs">
                    {output.name}
                    {output.quantity > 1 && !['core-hook', 'chapters'].includes(output.id) && (
                      <span className="ml-1 text-foreground">({output.quantity})</span>
                    )}
                  </Badge>
                ))}
                {enabledOutputs.length === 0 && (
                  <span className="text-xs text-muted-foreground">No outputs enabled</span>
                )}
              </div>
              {activePreset && (
                <div className="mt-2 text-xs flex items-center gap-1.5">
                  <span className="text-muted-foreground">Active:</span>
                  <span className="text-foreground font-medium">{activePreset.name}</span>
                  {defaultPresetId === activePreset.id && (
                    <Star className="size-4 text-yellow-400 fill-yellow-400" />
                  )}
                </div>
              )}
            </div>

            {/* Saved Presets */}
            {presets.length > 0 && (
              <>
                <div className="p-2">
                  <p className="text-xs text-muted-foreground px-2 mb-1">Saved Presets</p>
                  {presets.map(preset => (
                    <div key={preset.id} className="group flex items-center gap-1">
                      {/* Star button for default */}
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
                      {/* Preset name button */}
                      <DropdownMenuItem
                        onClick={() => {
                          loadPreset(preset.id)
                          setShowPresetMenu(false)
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
                      {/* Delete button */}
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
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'inputs' && (
          <InputsView
            userInputs={userInputs}
            setUserInputs={setUserInputs}
            onGenerate={handleGenerate}
            onSendToAI={onSendToChat ? handleSendToAI : undefined}
          />
        )}
        {activeTab === 'output' && (
          <OutputView
            generatedPrompt={generatedPrompt}
            onBack={() => setActiveTab('inputs')}
            onSendToChat={onSendToChat}
          />
        )}
        {activeTab === 'template' && (
          <TemplateEditor />
        )}
      </div>
    </div>
  )
}
