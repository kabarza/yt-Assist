import type { UserInputs } from '../../types/template'

interface InputsViewProps {
  userInputs: UserInputs
  setUserInputs: React.Dispatch<React.SetStateAction<UserInputs>>
  onGenerate: () => void
}

export default function InputsView({ userInputs, setUserInputs, onGenerate }: InputsViewProps) {
  const updateField = <K extends keyof UserInputs>(field: K, value: UserInputs[K]) => {
    setUserInputs(prev => ({ ...prev, [field]: value }))
  }

  const wordCount = userInputs.transcript.trim() 
    ? userInputs.transcript.trim().split(/\s+/).length 
    : 0

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
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
          className="w-full h-64 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent resize-none font-mono text-sm"
        />
      </div>

      {/* Optional Inputs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
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
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
          />
        </div>

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
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
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
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Name Options */}
      <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg">
        <div className="flex items-center gap-3 mb-3">
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
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
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
          className="w-full h-24 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={!userInputs.transcript.trim()}
        data-flow-name="btn-generate"
        className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
          userInputs.transcript.trim()
            ? 'bg-lime-500 text-gray-900 hover:bg-lime-400 active:scale-[0.98]'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        Generate Prompt
      </button>
    </div>
  )
}
