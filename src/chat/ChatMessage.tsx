import type { Message } from '../types/chat'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ChatMessageProps {
  message: Message
}

const UserIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)

const BotIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? '' : 'bg-gray-900/50 -mx-4 px-4 py-4 rounded-lg'}`}>
      {/* Avatar */}
      <div className={`
        flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
        ${isUser ? 'bg-blue-600' : 'bg-lime-500 text-gray-900'}
      `}>
        {isUser ? <UserIcon /> : <BotIcon />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 mb-1">
          {isUser ? 'You' : 'Assistant'}
        </p>
        <div className="space-y-2">
          {message.content.map((part, i) => {
            if (part.type === 'image' && part.imageData) {
              return (
                <img
                  key={i}
                  src={part.imageData}
                  alt="Attached"
                  className="max-w-md max-h-64 rounded-lg border border-gray-700"
                />
              )
            }
            if (part.type === 'text' && part.text) {
              return (
                <div
                  key={i}
                  className="text-gray-200 prose prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-table:my-2 prose-pre:my-2"
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {part.text}
                  </ReactMarkdown>
                </div>
              )
            }
            return null
          })}
        </div>
      </div>
    </div>
  )
}
