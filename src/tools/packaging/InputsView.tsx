import { useState } from 'react'
import type { UserInputs } from '../../types/template'

interface InputsViewProps {
  userInputs: UserInputs
  setUserInputs: React.Dispatch<React.SetStateAction<UserInputs>>
  onGenerate: () => void
  onSendToAI?: () => void
}

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

const ChatIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
)

export default function InputsView({
  userInputs,
  setUserInputs,
  onGenerate,
  onSendToAI,
}: InputsViewProps) {
  const [moreOptionsExpanded, setMoreOptionsExpanded] = useState(false)

  const updateField = <K extends keyof UserInputs>(field: K, value: UserInputs[K]) => {
    setUserInputs(prev => ({ ...prev, [field]: value }))
  }

  const wordCount = userInputs.transcript.trim()
    ? userInputs.transcript.trim().split(/\s+/).length
    : 0

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">

      {/* Transcript Input */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-300">
            Transcript <span className="text-red-400">*</span>
          </label>
          <span className="text-xs text-gray-500">{wordCount} words</span>
        </div>
        <textarea
          value={userInputs.transcript}
          onChange={(e) => updateField('transcript', e.target.value)}
          placeholder="Paste your video transcript here..."
          data-flow-name="input-transcript"
          className="w-full h-32 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent resize-none font-mono text-sm"
        />
      </div>

      {/* Always Visible Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Must-Include Words
          </label>
          <input
            type="text"
            value={userInputs.mustInclude}
            onChange={(e) => updateField('mustInclude', e.target.value)}
            placeholder="e.g., Tutorial, Review"
            data-flow-name="input-must-include"
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Nice-To-Include Words
          </label>
          <input
            type="text"
            value={userInputs.niceToInclude}
            onChange={(e) => updateField('niceToInclude', e.target.value)}
            placeholder="e.g., Brand names, topics"
            data-flow-name="input-nice-include"
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* More Options Collapsible Section */}
      <div>
        <button
          onClick={() => setMoreOptionsExpanded(!moreOptionsExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-gray-100 transition-colors py-2"
        >
          <ChevronIcon expanded={moreOptionsExpanded} />
          More Options
        </button>

        {moreOptionsExpanded && (
          <div className="mt-3 space-y-3">
            {/* Avoid Words and Hashtag Count */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Avoid Words/Phrases
                </label>
                <input
                  type="text"
                  value={userInputs.avoidWords}
                  onChange={(e) => updateField('avoidWords', e.target.value)}
                  placeholder="e.g., Clickbait words to avoid"
                  data-flow-name="input-avoid-words"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Hashtag Count
                </label>
                <input
                  type="number"
                  value={userInputs.hashtagCount}
                  onChange={(e) => updateField('hashtagCount', e.target.value)}
                  placeholder="5"
                  min="1"
                  max="15"
                  data-flow-name="input-hashtag-count"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Name Options */}
            <div className="p-3 bg-gray-900 border border-gray-700 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <input
                  type="checkbox"
                  id="includeName"
                  checked={userInputs.includeName}
                  onChange={(e) => updateField('includeName', e.target.checked)}
                  data-flow-name="input-include-name"
                  className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-lime-500 focus:ring-lime-500 focus:ring-offset-gray-900"
                />
                <label htmlFor="includeName" className="text-sm font-medium text-gray-300">
                  Must include name in titles?
                </label>
              </div>
              {userInputs.includeName && (
                <input
                  type="text"
                  value={userInputs.nameForTitles}
                  onChange={(e) => updateField('nameForTitles', e.target.value)}
                  placeholder="Enter the name to include..."
                  data-flow-name="input-name-for-titles"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                />
              )}
            </div>

            {/* Additional Context */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Additional Context / Notes
              </label>
              <textarea
                value={userInputs.additionalContext}
                onChange={(e) => updateField('additionalContext', e.target.value)}
                placeholder="Any other instructions or context for the AI..."
                data-flow-name="input-additional-context"
                className="w-full h-24 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onGenerate}
          disabled={!userInputs.transcript.trim()}
          data-flow-name="btn-generate"
          className={`flex-1 py-4 rounded-lg font-bold text-lg transition-all ${
            userInputs.transcript.trim()
              ? 'bg-lime-500 text-gray-900 hover:bg-lime-400 active:scale-[0.98]'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Generate Prompt
        </button>
        {onSendToAI && (
          <button
            onClick={onSendToAI}
            disabled={!userInputs.transcript.trim()}
            data-flow-name="btn-send-to-ai"
            className={`flex items-center justify-center gap-2 px-6 py-4 rounded-lg font-bold text-lg transition-all ${
              userInputs.transcript.trim()
                ? 'bg-blue-600 text-white hover:bg-blue-500 active:scale-[0.98]'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            <ChatIcon />
            Send to AI
          </button>
        )}
      </div>
    </div>
  )
}
