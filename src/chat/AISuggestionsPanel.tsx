import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sparkles, X, Plus, Loader2, RotateCw } from 'lucide-react'
import { requestChatText } from '../utils/apiClient'

interface Suggestion {
  id: string
  text: string
  type: 'addition' | 'expansion' | 'question'
}

interface AISuggestionsPanelProps {
  canvasContent: string
  canvasType: string
  onAddSuggestion: (text: string) => void
  onClose: () => void
  provider: string
  model: string
}

export default function AISuggestionsPanel({
  canvasContent,
  canvasType,
  onAddSuggestion,
  onClose,
  provider,
  model,
}: AISuggestionsPanelProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateSuggestions = async () => {
    if (!canvasContent.trim()) {
      setError('Canvas is empty. Add some content first.')
      return
    }

    setIsGenerating(true)
    setError(null)
    setSuggestions([])

    try {
      // Build context-aware prompt based on canvas type
      const contextPrompts: Record<string, string> = {
        notes: 'personal notes and thoughts',
        instructions: 'instructions or directives',
        draft: 'document draft in progress',
        reference: 'reference material',
      }

      const contextDescription = contextPrompts[canvasType] || 'content'

      const prompt = `You are an AI brainstorming assistant helping a creator expand their ${contextDescription}.

Current canvas content:
---
${canvasContent.slice(0, 2000)}
---

Based on the content above, provide 4-6 helpful suggestions to expand or improve it. Each suggestion should be:
- Specific and actionable
- Contextually relevant to the existing content
- Helpful for ${canvasType === 'draft' ? 'completing the document' : canvasType === 'instructions' ? 'clarifying the instructions' : canvasType === 'reference' ? 'adding useful references' : 'developing ideas'}

Format your response as a JSON array with this structure:
[
  {
    "type": "addition",
    "text": "Add a section about..."
  },
  {
    "type": "expansion",
    "text": "Expand on the point about..."
  },
  {
    "type": "question",
    "text": "Consider: What about...?"
  }
]

Provide ONLY the JSON array, no other text.`

      const result = await requestChatText({
        provider: provider as 'openai' | 'anthropic',
        model,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }],
          },
        ],
      })

      // Parse the JSON response
      try {
        const jsonMatch = result.text.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const parsedSuggestions = JSON.parse(jsonMatch[0])
          const formattedSuggestions: Suggestion[] = parsedSuggestions.map(
            (s: { type: string; text: string }, index: number) => ({
              id: `suggestion-${Date.now()}-${index}`,
              text: s.text,
              type: s.type as 'addition' | 'expansion' | 'question',
            })
          )
          setSuggestions(formattedSuggestions)
        } else {
          throw new Error('Could not parse suggestions')
        }
      } catch (parseError) {
        console.error('Failed to parse suggestions:', parseError)
        setError('Failed to parse AI suggestions')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to generate suggestions: ${errorMessage}`)
      console.error('Error generating suggestions:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  // Auto-generate on mount
  useEffect(() => {
    if (canvasContent.trim()) {
      generateSuggestions()
    }
  }, []) // Only run once on mount

  const handleAddSuggestion = (suggestion: Suggestion) => {
    // Format the suggestion based on type
    let formattedText = ''
    if (suggestion.type === 'addition') {
      formattedText = `\n\n## ${suggestion.text}\n\n`
    } else if (suggestion.type === 'expansion') {
      formattedText = `\n\n${suggestion.text}\n\n`
    } else {
      formattedText = `\n\n> ${suggestion.text}\n\n`
    }

    onAddSuggestion(formattedText)

    // Remove the added suggestion from the list
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id))
  }

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'addition':
        return '➕'
      case 'expansion':
        return '📝'
      case 'question':
        return '💭'
      default:
        return '💡'
    }
  }

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-card border-l border-border flex flex-col shadow-2xl z-10">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-11 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium">AI Suggestions</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7"
          aria-label="Close AI suggestions"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-3" />
            <p className="text-sm">Generating suggestions...</p>
          </div>
        ) : error ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive">
            {error}
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No suggestions available</p>
            <p className="text-xs mt-1">Add content to your canvas first</p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="bg-accent/5 border border-border rounded-lg p-3 hover:border-accent/50 transition-colors duration-150"
              >
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-lg leading-none">{getSuggestionIcon(suggestion.type)}</span>
                  <p className="text-sm text-foreground flex-1">{suggestion.text}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddSuggestion(suggestion)}
                  className="w-full h-7 text-xs gap-1.5"
                >
                  <Plus className="h-3 w-3" />
                  Add to Canvas
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer with refresh button */}
      {!isGenerating && suggestions.length > 0 && (
        <div className="p-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={generateSuggestions}
            className="w-full gap-2"
            disabled={isGenerating}
          >
            <RotateCw className="h-3.5 w-3.5" />
            Generate New Suggestions
          </Button>
        </div>
      )}

      {!isGenerating && error && (
        <div className="p-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={generateSuggestions}
            className="w-full gap-2"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}
    </div>
  )
}
