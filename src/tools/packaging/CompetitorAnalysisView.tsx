import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Target, Lightbulb, TrendingUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { requestChatText } from '@/utils/apiClient'
import { toast } from 'sonner'

interface CompetitorAnalysisViewProps {
  onSendToChat?: (prompt: string) => void
}

interface AnalysisResult {
  analysis: string
  timestamp: number
}

export default function CompetitorAnalysisView({ onSendToChat }: CompetitorAnalysisViewProps) {
  const [competitorTitle, setCompetitorTitle] = useState('')
  const [competitorDescription, setCompetitorDescription] = useState('')
  const [yourTopic, setYourTopic] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)

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
        analysis: (await requestChatText({
          provider: 'openai',
          model: 'gpt-4o',
          messages: [{
            role: 'user',
            content: [{ type: 'text', text: prompt }],
          }],
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
    if (onSendToChat) {
      const chatPrompt = `Based on this competitor analysis:\n\n${analysisResult.analysis}\n\nHelp me refine my video strategy and create compelling titles and descriptions.`
      onSendToChat(chatPrompt)
      toast.success('Sent to AI Chat')
    }
  }

  const handleClear = () => {
    setCompetitorTitle('')
    setCompetitorDescription('')
    setYourTopic('')
    setAnalysisResult(null)
  }

  return (
    <div className="flex h-full">
      {/* Input Section */}
      <div className="w-[26rem] space-y-6 border-r border-border/70 bg-card/40 p-6">
        <div>
          <h2 className="mb-2 text-2xl font-semibold tracking-tight">Competitor Analysis</h2>
          <p className="text-sm text-muted-foreground">
            Analyze competitor videos to find unique angles and differentiation opportunities
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="competitor-title">
              Competitor Video Title *
            </Label>
            <Input
              id="competitor-title"
              value={competitorTitle}
              onChange={(e) => setCompetitorTitle(e.target.value)}
              placeholder="Enter their video title..."
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="competitor-desc">
              Competitor Description (Optional)
            </Label>
            <Textarea
              id="competitor-desc"
              value={competitorDescription}
              onChange={(e) => setCompetitorDescription(e.target.value)}
              placeholder="Paste their video description if available..."
              className="min-h-[100px] text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="your-topic">
              Your Video Topic *
            </Label>
            <Textarea
              id="your-topic"
              value={yourTopic}
              onChange={(e) => setYourTopic(e.target.value)}
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
              {isAnalyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isAnalyzing ? 'Analyzing...' : 'Analyze Competitor'}
            </Button>
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={isAnalyzing}
              className="h-10"
            >
              Clear
            </Button>
          </div>
        </div>

        <Card className="bg-muted/40 p-4">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Tips:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Include competitor's full title for best results</li>
                <li>Add their description for deeper analysis</li>
                <li>Be specific about your intended topic</li>
                <li>Use this to find unique angles, not to copy</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {/* Results Section */}
      <div className="flex-1 flex flex-col">
        {analysisResult ? (
          <>
            <div className="flex items-center justify-between border-b border-border/70 bg-background/80 p-4 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-500" />
                <h3 className="font-semibold">Differentiation Strategy</h3>
              </div>
              <div className="flex gap-2">
                {onSendToChat && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSendToAI}
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Refine in AI Chat
                  </Button>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 p-6">
              <div className="prose prose-neutral dark:prose-invert mx-auto max-w-4xl prose-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {analysisResult.analysis}
                </ReactMarkdown>
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Target className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Competitor Analysis</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Enter a competitor's video details and your topic to get strategic insights on how to differentiate your content.
              </p>
              <div className="space-y-2 text-xs text-muted-foreground text-left bg-muted/50 p-4 rounded-lg">
                <p className="font-medium text-foreground">You'll get:</p>
                <ul className="space-y-1">
                  <li>✓ Analysis of their approach and angle</li>
                  <li>✓ Gaps and missed opportunities</li>
                  <li>✓ Differentiation recommendations</li>
                  <li>✓ Alternative title suggestions</li>
                  <li>✓ Unique positioning ideas</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
