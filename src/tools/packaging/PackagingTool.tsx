import { useState } from 'react'
import InputsView from './InputsView'
import OutputView from './OutputView'
import TemplateEditor from './TemplateEditor'
import { useTemplateStore } from '../../stores/templateStore'
import type { UserInputs } from '../../types/template'

type TabId = 'inputs' | 'output' | 'template'

interface PackagingToolProps {
  onSendToChat?: (prompt: string) => void
}

export default function PackagingTool({ onSendToChat }: PackagingToolProps) {
  const [activeTab, setActiveTab] = useState<TabId>('inputs')
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const { generatePrompt } = useTemplateStore()
  
  const [userInputs, setUserInputs] = useState<UserInputs>({
    transcript: '',
    mustInclude: '',
    niceToInclude: '',
    avoidWords: '',
    includeName: false,
    nameForTitles: '',
    hashtagCount: '5',
    additionalContext: '',
  })

  const handleGenerate = () => {
    const prompt = generatePrompt(userInputs)
    setGeneratedPrompt(prompt)
    setActiveTab('output')
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'inputs', label: 'Inputs' },
    { id: 'output', label: 'Output' },
    { id: 'template', label: 'Template' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-800 bg-gray-900/50">
        <h2 className="text-xl font-bold text-white">YouTube Packaging Tool</h2>
        <p className="text-sm text-gray-400">Generate high-CTR titles, thumbnails, descriptions, and more</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 px-6 py-3 border-b border-gray-800 bg-gray-900/30">
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

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'inputs' && (
          <InputsView
            userInputs={userInputs}
            setUserInputs={setUserInputs}
            onGenerate={handleGenerate}
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
