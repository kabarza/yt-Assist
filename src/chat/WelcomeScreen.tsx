import { Video, Sparkles, Code, BookOpen } from 'lucide-react'

interface WelcomeScreenProps {
  onSuggestion: (prompt: string) => void
}

const CATEGORIES = [
  { id: 'titles', label: 'Titles', icon: Sparkles },
  { id: 'thumbnails', label: 'Thumbnails', icon: Video },
  { id: 'descriptions', label: 'Descriptions', icon: BookOpen },
  { id: 'scripts', label: 'Scripts', icon: Code },
] as const

const SUGGESTIONS = [
  'Write 5 YouTube titles for a video about productivity hacks',
  'Create a thumbnail concept for a tech review video',
  'Write a YouTube description for a cooking tutorial',
  'Help me outline a script for a 10-minute explainer video',
  'Generate hashtags for a fitness YouTube channel',
  'What makes a good YouTube hook in the first 3 seconds?',
]

export default function WelcomeScreen({ onSuggestion }: WelcomeScreenProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground text-center text-balance mb-6">
        How can I help you?
      </h1>

      {/* Category pills */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSuggestion(`Help me with YouTube ${cat.label.toLowerCase()}`)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm text-muted-foreground hover:border-accent hover:text-foreground transition-colors duration-150"
            >
              <Icon className="h-3.5 w-3.5" />
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* Suggestion prompts */}
      <div className="flex flex-col gap-1">
        {SUGGESTIONS.map((suggestion, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSuggestion(suggestion)}
            className="text-left px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 rounded-md hover:bg-muted/50"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  )
}
