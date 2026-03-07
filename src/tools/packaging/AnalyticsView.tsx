import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, TrendingUp, TrendingDown, Lightbulb, BarChart3, Copy } from 'lucide-react'
import { requestChatText } from '@/utils/apiClient'
import { toast } from 'sonner'

interface AnalyticsViewProps {
  onBack?: () => void
}

interface AnalyticsInsights {
  topPerformers: string
  underperforming: string
  patterns: string
  retention: string
  recommendations: string
}

const ANALYTICS_PROMPT = `Analyze the following YouTube analytics data and provide detailed insights:

1. TOP PERFORMERS: Identify the best-performing videos and explain what makes them successful (topics, titles, formats, length, CTR, retention)

2. UNDERPERFORMING CONTENT: Identify videos that didn't perform well and potential reasons why

3. SUCCESS PATTERNS: Find patterns across successful videos:
   - Common topics or themes
   - Optimal video lengths
   - Title/thumbnail patterns
   - Publishing patterns

4. AUDIENCE RETENTION & CTR TRENDS: Analyze:
   - Average CTR trends
   - View duration patterns
   - Audience retention insights
   - Drop-off points

5. ACTIONABLE RECOMMENDATIONS: Provide 5-7 specific, actionable recommendations for future content based on the data

Format your response with clear sections using these exact headers:
## TOP PERFORMERS
## UNDERPERFORMING CONTENT
## SUCCESS PATTERNS
## RETENTION & CTR TRENDS
## RECOMMENDATIONS

Analytics Data:
`

function parseInsights(response: string): AnalyticsInsights {
  const sections = {
    topPerformers: '',
    underperforming: '',
    patterns: '',
    retention: '',
    recommendations: '',
  }

  const topMatch = response.match(/## TOP PERFORMERS\s*([\s\S]*?)(?=##|$)/i)
  const underMatch = response.match(/## UNDERPERFORMING CONTENT\s*([\s\S]*?)(?=##|$)/i)
  const patternsMatch = response.match(/## SUCCESS PATTERNS\s*([\s\S]*?)(?=##|$)/i)
  const retentionMatch = response.match(/## RETENTION & CTR TRENDS\s*([\s\S]*?)(?=##|$)/i)
  const recsMatch = response.match(/## RECOMMENDATIONS\s*([\s\S]*?)$/i)

  if (topMatch) sections.topPerformers = topMatch[1].trim()
  if (underMatch) sections.underperforming = underMatch[1].trim()
  if (patternsMatch) sections.patterns = patternsMatch[1].trim()
  if (retentionMatch) sections.retention = retentionMatch[1].trim()
  if (recsMatch) sections.recommendations = recsMatch[1].trim()

  return sections
}

function InsightSection({
  title,
  content,
  icon: Icon
}: {
  title: string
  content: string
  icon: React.ComponentType<{ className?: string }>
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${title}\n\n${content}`)
      setCopied(true)
      toast.success(`${title} copied`)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  if (!content) return null

  return (
    <div className="p-4 border border-border rounded-lg bg-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-accent" />
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="gap-2"
        >
          {copied ? 'Copied!' : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
        {content}
      </div>
    </div>
  )
}

export default function AnalyticsView({ onBack }: AnalyticsViewProps) {
  const [analyticsData, setAnalyticsData] = useState('')
  const [insights, setInsights] = useState<AnalyticsInsights | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleAnalyze = async () => {
    if (!analyticsData.trim()) {
      toast.error('Please paste your analytics data first')
      return
    }

    setIsAnalyzing(true)
    setInsights(null)

    try {
      const result = await requestChatText({
        provider: 'openai',
        model: 'gpt-4.1',
        messages: [{
          role: 'user',
          content: [{
            type: 'text',
            text: ANALYTICS_PROMPT + '\n\n' + analyticsData.slice(0, 10000),
          }],
        }],
      })
      const parsedInsights = parseInsights(result.text)
      setInsights(parsedInsights)
      toast.success('Analysis complete!')
    } catch (error) {
      console.error('Analysis error:', error)
      toast.error('Failed to analyze data')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const copyAllInsights = async () => {
    if (!insights) return

    const fullText = `YouTube Analytics Insights

TOP PERFORMERS
${insights.topPerformers}

UNDERPERFORMING CONTENT
${insights.underperforming}

SUCCESS PATTERNS
${insights.patterns}

RETENTION & CTR TRENDS
${insights.retention}

RECOMMENDATIONS
${insights.recommendations}`

    try {
      await navigator.clipboard.writeText(fullText)
      toast.success('All insights copied to clipboard')
    } catch {
      toast.error('Failed to copy insights')
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">YouTube Analytics Insights</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Paste your YouTube Studio analytics data to get AI-powered insights and recommendations
        </p>
      </div>

      {/* Input Section */}
      {!insights && (
        <div className="space-y-4">
          <div>
            <label htmlFor="analytics-data" className="text-sm font-medium text-foreground mb-2 block">
              Analytics Data
            </label>
            <Textarea
              id="analytics-data"
              value={analyticsData}
              onChange={(e) => setAnalyticsData(e.target.value)}
              placeholder="Paste your YouTube analytics data here (CSV, table, or plain text from YouTube Studio)...

Example formats:
- Video title, Views, CTR, Avg view duration, Impressions
- Copy from YouTube Studio analytics page
- Export as CSV and paste here"
              className="min-h-[300px] font-mono text-xs"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !analyticsData.trim()}
              className="gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4" />
                  Analyze Data
                </>
              )}
            </Button>
            {onBack && (
              <Button variant="outline" onClick={onBack}>
                Back
              </Button>
            )}
          </div>

          <div className="p-4 bg-muted/50 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Tip:</strong> For best results, include data like video titles,
              views, CTR (%), average view duration, impressions, and any other metrics from YouTube Studio.
              The AI will analyze patterns and provide actionable recommendations.
            </p>
          </div>
        </div>
      )}

      {/* Insights Display */}
      {insights && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Analysis Results</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyAllInsights}
                className="gap-2"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInsights(null)
                  setAnalyticsData('')
                }}
              >
                New Analysis
              </Button>
            </div>
          </div>

          <ScrollArea className="max-h-[calc(100vh-300px)]">
            <div className="space-y-4 pr-4">
              <InsightSection
                title="Top Performers"
                content={insights.topPerformers}
                icon={TrendingUp}
              />
              <InsightSection
                title="Underperforming Content"
                content={insights.underperforming}
                icon={TrendingDown}
              />
              <InsightSection
                title="Success Patterns"
                content={insights.patterns}
                icon={BarChart3}
              />
              <InsightSection
                title="Retention & CTR Trends"
                content={insights.retention}
                icon={BarChart3}
              />
              <InsightSection
                title="Recommendations"
                content={insights.recommendations}
                icon={Lightbulb}
              />
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
