import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Archive, ChevronDown, Star } from 'lucide-react'
import InputsView from './InputsView'
import OutputView from './OutputView'
import TemplateEditor from './TemplateEditor'
import BatchView from './BatchView'
import CompetitorAnalysisView from './CompetitorAnalysisView'
import AnalyticsView from './AnalyticsView'
import { ToolContainer, ToolHeader, ToolShell } from '@/components/layout/ToolShell'
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
import { updateViewSearchParams, parsePackagingView, type PackagingView } from '@/navigation/views'
import { cn } from '@/lib/utils'
import { useTemplateStore } from '@/stores/templateStore'
import { usePackagingSessionStore } from '@/stores/packagingSessionStore'
import type { UserInputs } from '@/types/template'

interface PackagingToolProps {
  onSendToChat?: (prompt: string) => void
}

export default function PackagingTool({ onSendToChat }: PackagingToolProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeView = parsePackagingView(searchParams.get('view'))
  const [showPresetMenu, setShowPresetMenu] = useState(false)
  const [showSavePreset, setShowSavePreset] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')

  const {
    userInputs,
    setUserInputs: setStoredUserInputs,
    setGeneratedPrompt,
    generatedPrompt,
  } = usePackagingSessionStore()
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

  const setActiveView = (view: PackagingView) => {
    setSearchParams(updateViewSearchParams(searchParams, view, 'inputs'))
  }

  const setUserInputs: Dispatch<SetStateAction<UserInputs>> = (nextValue) => {
    if (typeof nextValue === 'function') {
      setStoredUserInputs(nextValue(userInputs))
      return
    }

    setStoredUserInputs(nextValue)
  }

  const hashtagOutput = outputTypes.find((output) => output.id === 'hashtags')
  const defaultHashtagCount = hashtagOutput?.quantity?.toString() || '5'

  useEffect(() => {
    const hashtagCount = outputTypes.find((output) => output.id === 'hashtags')?.quantity?.toString() || '5'
    if (userInputs.hashtagCount !== hashtagCount) {
      setStoredUserInputs({ ...userInputs, hashtagCount })
    }
  }, [outputTypes, setStoredUserInputs, userInputs])

  const handleGenerate = () => {
    const prompt = generatePrompt(userInputs)
    setGeneratedPrompt(prompt)
    setActiveView('output')
  }

  const handleSendToAI = () => {
    const prompt = generatePrompt(userInputs)
    setGeneratedPrompt(prompt)
    onSendToChat?.(prompt)
  }

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return

    savePreset(newPresetName.trim())
    setNewPresetName('')
    setShowSavePreset(false)
    setShowPresetMenu(false)
  }

  const enabledOutputs = outputTypes
    .filter((output) => output.enabled)
    .sort((a, b) => a.order - b.order)

  useEffect(() => {
    if (!userInputs.hashtagCount) {
      setStoredUserInputs({ ...userInputs, hashtagCount: defaultHashtagCount })
    }
  }, [defaultHashtagCount, setStoredUserInputs, userInputs])

  return (
    <ToolShell>
      <ToolHeader
        title="Packaging"
        description="Build titles, thumbnails, prompts, and strategy from one persistent workflow."
        actions={
          <DropdownMenu open={showPresetMenu} onOpenChange={setShowPresetMenu}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2 rounded-[0.8rem] bg-background/60 px-3">
                <Archive className="size-4" />
                Presets
                <ChevronDown
                  className={cn(
                    'size-4 transition-transform duration-200',
                    showPresetMenu && 'rotate-180',
                  )}
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <div className="border-b border-border p-3">
                <p className="mb-2 text-xs text-muted-foreground">Enabled Outputs</p>
                <div className="flex flex-wrap gap-1">
                  {enabledOutputs.map((output) => (
                    <Badge key={output.id} variant="outline" className="text-xs">
                      {output.name}
                      {output.quantity > 1 && !['core-hook', 'chapters'].includes(output.id) ? (
                        <span className="ml-1 text-foreground">({output.quantity})</span>
                      ) : null}
                    </Badge>
                  ))}
                  {enabledOutputs.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No outputs enabled</span>
                  ) : null}
                </div>
                {activePreset ? (
                  <div className="mt-2 flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">Active:</span>
                    <span className="font-medium text-foreground">{activePreset.name}</span>
                    {defaultPresetId === activePreset.id ? (
                      <Star className="size-4 fill-yellow-400 text-yellow-400" />
                    ) : null}
                  </div>
                ) : null}
              </div>

              {presets.length > 0 ? (
                <>
                  <div className="p-2">
                    <p className="mb-1 px-2 text-xs text-muted-foreground">Saved Presets</p>
                    {presets.map((preset) => (
                      <div key={preset.id} className="group flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDefaultPreset(defaultPresetId === preset.id ? null : preset.id)
                          }
                          className="h-auto p-1"
                          aria-label={
                            defaultPresetId === preset.id
                              ? `Remove ${preset.name} as default preset`
                              : `Set ${preset.name} as default preset`
                          }
                          aria-pressed={defaultPresetId === preset.id}
                        >
                          <Star
                            className={cn(
                              'size-4',
                              defaultPresetId === preset.id
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-muted-foreground',
                            )}
                          />
                        </Button>
                        <DropdownMenuItem
                          onClick={() => {
                            loadPreset(preset.id)
                            setShowPresetMenu(false)
                          }}
                          className={cn(
                            'flex-1 cursor-pointer text-sm',
                            activePreset?.id === preset.id && 'bg-accent',
                          )}
                        >
                          {preset.name}
                          {defaultPresetId === preset.id ? (
                            <span className="ml-1 text-xs text-muted-foreground">(default)</span>
                          ) : null}
                        </DropdownMenuItem>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deletePreset(preset.id)}
                          className="h-auto p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                          aria-label={`Delete preset: ${preset.name}`}
                        >
                          <svg
                            className="size-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </Button>
                      </div>
                    ))}
                  </div>
                  <DropdownMenuSeparator />
                </>
              ) : null}

              <div className="p-2">
                {showSavePreset ? (
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={newPresetName}
                      onChange={(event) => setNewPresetName(event.target.value)}
                      placeholder="Preset name..."
                      className="h-8 text-sm"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') handleSavePreset()
                      }}
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
                    className="cursor-pointer text-sm"
                  >
                    + Save Current as Preset
                  </DropdownMenuItem>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="px-5 py-2.5">
        <ToolContainer className="space-y-0">
          <Tabs
            value={activeView}
            onValueChange={(value) => setActiveView(value as PackagingView)}
            className="w-full"
          >
            <TabsList className="h-auto flex-wrap rounded-[0.9rem]">
              <TabsTrigger value="inputs" data-flow-name="tab-inputs">
                Inputs
              </TabsTrigger>
              <TabsTrigger value="output" data-flow-name="tab-output">
                Output
              </TabsTrigger>
              <TabsTrigger value="competitor" data-flow-name="tab-competitor">
                Competitor
              </TabsTrigger>
              <TabsTrigger value="analytics" data-flow-name="tab-analytics">
                Analytics
              </TabsTrigger>
              <TabsTrigger value="batch" data-flow-name="tab-batch">
                Batch
              </TabsTrigger>
              <TabsTrigger value="template" data-flow-name="tab-template">
                Template
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </ToolContainer>
      </div>

      <div className="flex-1 overflow-auto">
        <ToolContainer className="space-y-0">
          {activeView === 'inputs' ? (
            <InputsView
              userInputs={userInputs}
              setUserInputs={setUserInputs}
              onGenerate={handleGenerate}
              onSendToAI={onSendToChat ? handleSendToAI : undefined}
              generatePrompt={generatePrompt}
            />
          ) : null}

          {activeView === 'output' ? (
            <OutputView
              generatedPrompt={generatedPrompt}
              transcript={userInputs.transcript}
              onBack={() => setActiveView('inputs')}
              onSendToChat={onSendToChat}
            />
          ) : null}

          {activeView === 'competitor' ? (
            <CompetitorAnalysisView onSendToChat={onSendToChat} />
          ) : null}

          {activeView === 'analytics' ? <AnalyticsView /> : null}

          {activeView === 'batch' ? (
            <BatchView
              userInputs={userInputs}
              generatePrompt={generatePrompt}
              onSendToChat={onSendToChat}
            />
          ) : null}

          {activeView === 'template' ? <TemplateEditor /> : null}
        </ToolContainer>
      </div>
    </ToolShell>
  )
}
