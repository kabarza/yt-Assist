import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Target, Lightbulb, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { requestChatText } from '@/utils/apiClient'
import { usePackagingSessionStore } from '@/stores/packagingSessionStore'
import { toast } from 'sonner'

interface CompetitorAnalysisViewProps {
  onSendToChat?: (prompt: string) => void
}

export default function CompetitorAnalysisView({ onSendToChat }: CompetitorAnalysisViewProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const {
    competitorTitle,
    competitorDescription,
    yourTopic,
    analysisResult,
    setCompetitorTitle,
    setCompetitorDescription,
    setYourTopic,
    setAnalysisResult,
  } = usePackagingSessionStore()

  const handleAnalyze = async () => {
    if (!competitorTitle.trim() || !yourTopic.trim()) {
      toast.error('Please provide both competitor title and your topic')
      return
    }

    setIsAnalyzing(true)
    setAnalysisResult(null)

    try {
      const prompt = buildAnalysisPrompt(competitorTitle, competitorDescription, yourTopic)

      setAnalysisResult({
        analysis:
          (await requestChatText({
            provider: 'openai',
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: [{ type: 'text', text: prompt }],
              },
            ],
          })).text,
        timestamp: Date.now(),
      })

      toast.success('Analysis complete!')
    } catch (error) {
      console.error('Analysis error:', error)
      toast.error('Failed to analyze competitor')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const buildAnalysisPrompt = (title: string, description: string, topic: string): string => {
    return `You are a YouTube strategy expert specializing in competitive differentiation.

COMPETITOR VIDEO:
Title: ${title}
${description ? `Description: ${description}` : ''}

MY VIDEO TOPIC: ${topic}

Analyze the competitor's approach and provide a comprehensive differentiation strategy. Structure your response in the following sections:

## 🎯 Competitor Analysis
- What angle/perspective did they take?
- What audience are they targeting?
- What keywords and topics did they emphasize?
- Tone and style (educational, entertainment, how-to, etc.)

## 🔍 Gaps & Opportunities
- What's missing from their coverage?
- What questions did they leave unanswered?
- What perspectives or angles did they ignore?
- What audience segments might they have missed?

## 💡 Differentiation Strategy
- How should I position my video differently?
- What unique angle can I take?
- What value can I add that they didn't?
- How can I target an underserved audience?

## 📝 Alternative Title Suggestions (5)
Provide 5 alternative title ideas that:
- Clearly differentiate from the competitor
- Target different angles or audiences
- Emphasize the unique value proposition
- Are compelling and click-worthy

## 🎬 Positioning Ideas
- Specific hooks or intros that highlight the difference
- Key points to emphasize that they missed
- Unique storytelling approaches
- Visual or structural differences to consider

Be specific, actionable, and strategic. Focus on creating a video that complements or improves upon the competitor rather than just copying them.`
  }

  const handleSendToAI = () => {
    if (!analysisResult) return
    onSendToChat?.(
      `Based on this competitor analysis:\n\n${analysisResult.analysis}\n\nHelp me refine my video strategy and create compelling titles and descriptions.`,
    )
    toast.success('Sent to AI Chat')
  }

  const handleClear = () => {
    setCompetitorTitle('')
    setCompetitorDescription('')
    setYourTopic('')
    setAnalysisResult(null)
  }

  return (
    <div className="flex h-full">
      <div className="w-[24rem] space-y-5 border-r border-border/70 bg-card/30 px-5 py-5">
        <div>
          <h2 className="mb-2 text-lg font-semibold tracking-tight">Competitor Analysis</h2>
          <p className="text-sm text-muted-foreground">
            Analyze competitor videos to find unique angles and differentiation opportunities.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="competitor-title">Competitor Video Title *</Label>
            <Input
              id="competitor-title"
              value={competitorTitle}
              onChange={(event) => setCompetitorTitle(event.target.value)}
              placeholder="Enter their video title..."
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="competitor-desc">Competitor Description (Optional)</Label>
            <Textarea
              id="competitor-desc"
              value={competitorDescription}
              onChange={(event) => setCompetitorDescription(event.target.value)}
              placeholder="Paste their video description if available..."
              className="min-h-[100px] text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="your-topic">Your Video Topic *</Label>
            <Textarea
              id="your-topic"
              value={yourTopic}
              onChange={(event) => setYourTopic(event.target.value)}
              placeholder="Describe what you want to cover..."
              className="min-h-[80px] text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !competitorTitle.trim() || !yourTopic.trim()}
              className="h-10 flex-1"
            >
              {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isAnalyzing ? 'Analyzing...' : 'Analyze Competitor'}
            </Button>
            <Button variant="outline" onClick={handleClear} disabled={isAnalyzing} className="h-10">
              Clear
            </Button>
          </div>
        </div>

        <Card className="bg-muted/40 p-4">
          <div className="flex items-start gap-2">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
            <div className="text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Tips:</p>
              <ul className="list-inside list-disc space-y-1">
                <li>Include the competitor title for better signal.</li>
                <li>Add the description when you want sharper differentiation advice.</li>
                <li>Use this to find unique angles, not to copy.</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-1 flex-col">
        {analysisResult ? (
          <>
            <div className="flex items-center justify-between border-b border-border/70 bg-background/80 p-4 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-500" />
                <h3 className="font-semibold">Differentiation Strategy</h3>
              </div>
              {onSendToChat ? (
                <Button variant="secondary" size="sm" onClick={handleSendToAI}>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Refine in AI Chat
                </Button>
              ) : null}
            </div>

            <ScrollArea className="flex-1 px-5 py-5">
              <div className="prose prose-sm max-w-none prose-neutral dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {analysisResult.analysis}
                </ReactMarkdown>
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Target className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Competitor Analysis</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Enter a competitor's video details and your topic to get strategic differentiation ideas.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
