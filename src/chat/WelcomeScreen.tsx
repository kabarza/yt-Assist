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
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="space-y-3 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          AI Workspace
        </p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          How can I help you today?
        </h1>
        <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          Start with a quick prompt or drop into one of the YouTube workflows already built into the app.
        </p>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap justify-center gap-2.5">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSuggestion(`Help me with YouTube ${cat.label.toLowerCase()}`)}
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-medium text-foreground transition-[color,box-shadow,border-color] duration-150 hover:border-ring/40 hover:bg-accent/60 hover:text-foreground"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* Suggestion prompts */}
      <div className="grid gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSuggestion(suggestion)}
            className="rounded-2xl border border-border/70 bg-card/80 px-4 py-4 text-left text-sm text-foreground transition-[color,box-shadow,border-color] duration-150 hover:border-ring/30 hover:bg-accent/50"
          >
            <span className="block leading-6">{suggestion}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
