import { useRef, useState, useEffect } from 'react'
import { useOutputHistory } from '../../stores/outputHistoryStore'

interface OutputViewProps {
  generatedPrompt: string
  onBack: () => void
  onSendToChat?: (prompt: string) => void
}

const ChatIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
)

const HistoryIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

export default function OutputView({ generatedPrompt, onBack, onSendToChat }: OutputViewProps) {
  const [copied, setCopied] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [currentPrompt, setCurrentPrompt] = useState(generatedPrompt)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const { history, addToHistory, removeFromHistory } = useOutputHistory()

  // Update current prompt when generatedPrompt changes
  useEffect(() => {
    if (generatedPrompt) {
      setCurrentPrompt(generatedPrompt)
      addToHistory(generatedPrompt)
    }
  }, [generatedPrompt, addToHistory])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(currentPrompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      if (textAreaRef.current) {
        textAreaRef.current.focus()
        textAreaRef.current.select()
        try {
          document.execCommand('copy')
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch (err) {
          console.error('Copy failed:', err)
        }
      }
    }
  }

  const selectAllText = () => {
    if (textAreaRef.current) {
      textAreaRef.current.focus()
      textAreaRef.current.select()
    }
  }

  const handleSendToChat = () => {
    if (onSendToChat && currentPrompt) {
      onSendToChat(currentPrompt)
    }
  }

  const handleSelectFromHistory = (prompt: string) => {
    setCurrentPrompt(prompt)
    setShowHistory(false)
  }

  if (!currentPrompt && history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <p className="text-gray-500 mb-4">No prompt generated yet</p>
        <button
          onClick={onBack}
          data-flow-name="btn-go-to-inputs"
          className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
        >
          Go to Inputs
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-400">
            Copy this prompt or send it directly to AI Chat
          </p>
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              data-flow-name="btn-toggle-history"
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-all ${
                showHistory
                  ? 'bg-lime-500 text-gray-900'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              <HistoryIcon />
              History ({history.length})
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={selectAllText}
            data-flow-name="btn-select-all"
            className="px-4 py-2 rounded-lg font-medium transition-all bg-gray-700 text-gray-300 hover:bg-gray-600"
          >
            Select All
          </button>
          <button
            onClick={copyToClipboard}
            data-flow-name="btn-copy"
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              copied
                ? 'bg-green-600 text-white'
                : 'bg-lime-500 text-gray-900 hover:bg-lime-400'
            }`}
          >
            {copied ? 'Copied!' : 'Copy Prompt'}
          </button>
          {onSendToChat && (
            <button
              onClick={handleSendToChat}
              data-flow-name="btn-send-to-chat"
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-blue-600 text-white hover:bg-blue-500"
            >
              <ChatIcon />
              Send to AI Chat
            </button>
          )}
        </div>
      </div>

      {/* History Panel */}
      {showHistory && history.length > 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 max-h-48 overflow-y-auto">
          <p className="text-xs text-gray-500 mb-2">Recent Outputs</p>
          <div className="space-y-1">
            {history.map((item) => (
              <div
                key={item.id}
                className="group flex items-center gap-2 p-2 rounded hover:bg-gray-800 cursor-pointer"
                onClick={() => handleSelectFromHistory(item.prompt)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 truncate">{item.preview}</p>
                  <p className="text-xs text-gray-500">{formatDate(item.timestamp)}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFromHistory(item.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <textarea
          ref={textAreaRef}
          readOnly
          value={currentPrompt}
          data-flow-name="output-textarea"
          className="w-full h-[calc(100vh-380px)] min-h-80 overflow-auto p-4 bg-gray-900 border border-gray-700 rounded-lg text-gray-300 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-lime-500"
        />
      </div>

      <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
        <p className="text-sm text-gray-300">
          <span className="font-bold text-lime-400">Next step:</span> Copy the prompt and paste it into an AI chat, or click "Send to AI Chat" to chat directly in this app. The AI will generate your YouTube packaging based on your transcript.
        </p>
      </div>
    </div>
  )
}
