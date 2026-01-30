import { useState, useEffect } from 'react'
import InputsView from './InputsView'
import OutputView from './OutputView'
import TemplateEditor from './TemplateEditor'
import { useTemplateStore } from '../../stores/templateStore'
import type { UserInputs } from '../../types/template'

type TabId = 'inputs' | 'output' | 'template'

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

  const tabs: { id: TabId; label: string }[] = [
    { id: 'inputs', label: 'Inputs' },
    { id: 'output', label: 'Output' },
    { id: 'template', label: 'Template' },
  ]

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
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-800 bg-gray-900/50">
        <h2 className="text-xl font-bold text-white">YouTube Packaging Tool</h2>
        <p className="text-sm text-gray-400">Generate high-CTR titles, thumbnails, descriptions, and more</p>
      </header>

      {/* Tabs */}
      <div className="flex items-center justify-between gap-1 px-6 py-3 border-b border-gray-800 bg-gray-900/30">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-flow-name={`tab-${tab.id}`}
              className={`
                px-4 py-2 rounded-lg font-medium text-sm transition-all
                ${activeTab === tab.id
                  ? 'bg-lime-500 text-gray-900'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Presets Button */}
        <div className="relative">
          <button
            onClick={() => setShowPresetMenu(!showPresetMenu)}
            data-flow-name="btn-presets-input"
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
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
              {/* Enabled Outputs Summary Section */}
              <div className="p-3 border-b border-gray-700">
                <p className="text-xs text-gray-500 mb-2">Enabled Outputs</p>
                <div className="flex flex-wrap gap-1">
                  {enabledOutputs.map(output => (
                    <span
                      key={output.id}
                      className="px-2 py-0.5 text-xs bg-gray-900 border border-gray-600 rounded text-gray-300"
                    >
                      {output.name}
                      {output.quantity > 1 && !['core-hook', 'chapters'].includes(output.id) && (
                        <span className="ml-1 text-lime-400">({output.quantity})</span>
                      )}
                    </span>
                  ))}
                  {enabledOutputs.length === 0 && (
                    <span className="text-xs text-gray-500">No outputs enabled</span>
                  )}
                </div>
                {activePreset && (
                  <div className="mt-2 text-xs flex items-center gap-1">
                    <span className="text-gray-500">Active:</span>
                    <span className="text-lime-400 font-medium">{activePreset.name}</span>
                    {defaultPresetId === activePreset.id && (
                      <StarIcon filled={true} />
                    )}
                  </div>
                )}
              </div>

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
              <div className="p-2">
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
            </div>
          )}
        </div>
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
