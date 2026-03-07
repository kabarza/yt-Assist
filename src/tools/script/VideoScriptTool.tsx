import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { FileText, Copy, Check, Sparkles, Clock, Film } from 'lucide-react'
import { cn } from '@/lib/utils'
import { requestChatText } from '@/utils/apiClient'
import { ToolBody, ToolContainer, ToolHeader, ToolShell } from '@/components/layout/ToolShell'
import { toast } from 'sonner'

type ScriptStyle = 'casual' | 'formal' | 'energetic' | 'educational'

interface ScriptSection {
  title: string
  content: string
  timing: string
  brollSuggestions: string[]
  transitions: string
}

interface GeneratedScript {
  intro: ScriptSection
  mainContent: ScriptSection[]
  outro: ScriptSection
  fullScript: string
}

const styleDescriptions: Record<ScriptStyle, string> = {
  casual: 'Conversational and relatable',
  formal: 'Professional and polished',
  energetic: 'Upbeat and enthusiastic',
  educational: 'Clear and instructive',
}

export default function VideoScriptTool() {
  const [topic, setTopic] = useState('')
  const [context, setContext] = useState('')
  const [duration, setDuration] = useState('10')
  const [style, setStyle] = useState<ScriptStyle>('casual')
  const [keyPoints, setKeyPoints] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null)
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error('Please enter a video topic')
      return
    }

    setIsGenerating(true)
    try {
      const script = await generateScript(topic, context, duration, style, keyPoints)
      setGeneratedScript(script)
      toast.success('Script generated successfully!')
    } catch (error) {
      toast.error('Failed to generate script')
      console.error(error)
    } finally {
      setIsGenerating(false)
    }
  }

  const generateScript = async (
    topic: string,
    context: string,
    duration: string,
    style: ScriptStyle,
    keyPoints: string
  ): Promise<GeneratedScript> => {
    const styleInstructions = {
      casual: 'Use a conversational, friendly tone. Speak directly to the viewer as if talking to a friend. Use contractions and natural language.',
      formal: 'Maintain a professional, polished tone. Use complete sentences and sophisticated vocabulary. Be authoritative but approachable.',
      energetic: 'Be enthusiastic and upbeat! Use exclamation points, dynamic language, and keep the energy high throughout.',
      educational: 'Focus on clarity and instruction. Break down concepts step-by-step. Use examples and explanations that help viewers learn.',
    }

    const durationInt = parseInt(duration) || 10
    const wordCount = durationInt * 150 // ~150 words per minute

    const prompt = `You are a professional YouTube video script writer. Generate a complete, detailed video script.

Video Topic: ${topic}
${context ? `Context/Additional Info: ${context}\n` : ''}
Target Duration: ${durationInt} minutes (~${wordCount} words)
Script Style: ${style} - ${styleInstructions[style]}
${keyPoints ? `Key Points to Cover:\n${keyPoints}\n` : ''}

Generate a structured video script with the following sections:

**INTRO/HOOK (15-30 seconds)**
- Attention-grabbing opening
- Preview of what viewers will learn
- Why they should keep watching
- Include B-roll suggestions and timing

**MAIN CONTENT (${Math.floor(durationInt * 0.7)} minutes)**
- Break into 3-5 clear segments
- Each segment should have:
  - Scene description
  - Spoken dialogue
  - B-roll suggestions
  - Transition cues
  - Approximate timing

**OUTRO/CTA (30-45 seconds)**
- Summary of key takeaways
- Clear call-to-action
- Engagement prompt (like, comment, subscribe)
- B-roll suggestions

Format each section with:
[TIMING] Section Title
SCRIPT: [spoken content]
B-ROLL: [visual suggestions]
TRANSITION: [how to move to next section]

Generate the complete script now:`

    const result = await requestChatText({
      provider: 'openai',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    })
    const scriptText = result.text?.trim() || ''

    // Parse the script into structured sections
    return parseScript(scriptText)
  }

  const parseScript = (scriptText: string): GeneratedScript => {
    // Simple parsing - in production, this would be more sophisticated
    const sections = scriptText.split(/(?=\[[\d-]+)/g).filter(Boolean)

    const intro: ScriptSection = {
      title: 'Intro/Hook',
      content: sections[0] || '',
      timing: '0:00-0:30',
      brollSuggestions: extractBroll(sections[0] || ''),
      transitions: extractTransitions(sections[0] || ''),
    }

    const mainContent: ScriptSection[] = sections.slice(1, -1).map((section, idx) => ({
      title: `Segment ${idx + 1}`,
      content: section,
      timing: `${idx + 1}:00-${idx + 2}:00`,
      brollSuggestions: extractBroll(section),
      transitions: extractTransitions(section),
    }))

    const outro: ScriptSection = {
      title: 'Outro/CTA',
      content: sections[sections.length - 1] || '',
      timing: `${sections.length - 1}:00-${sections.length}:00`,
      brollSuggestions: extractBroll(sections[sections.length - 1] || ''),
      transitions: '',
    }

    return {
      intro,
      mainContent,
      outro,
      fullScript: scriptText,
    }
  }

  const extractBroll = (text: string): string[] => {
    const match = text.match(/B-ROLL:([^\n]+(?:\n(?!TRANSITION:)[^\n]+)*)/i)
    if (match) {
      return match[1]
        .split(/[,\n]/)
        .map(s => s.trim())
        .filter(Boolean)
    }
    return []
  }

  const extractTransitions = (text: string): string => {
    const match = text.match(/TRANSITION:([^\n]+)/i)
    return match ? match[1].trim() : ''
  }

  const handleCopySection = (sectionName: string, content: string) => {
    navigator.clipboard.writeText(content)
    setCopiedSection(sectionName)
    toast.success(`${sectionName} copied to clipboard`)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  const handleCopyFullScript = () => {
    if (!generatedScript) return
    navigator.clipboard.writeText(generatedScript.fullScript)
    toast.success('Full script copied to clipboard')
  }

  return (
    <ToolShell>
      <ToolHeader
        icon={FileText}
        title="Video Script Writer"
        description="Generate complete, structured video scripts with scene breakdowns."
      />
      <ToolBody className="overflow-y-auto">
        <ToolContainer>
          <Tabs defaultValue="input" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="input">Input</TabsTrigger>
              <TabsTrigger value="output" disabled={!generatedScript}>
                Generated Script
              </TabsTrigger>
            </TabsList>

            {/* Input Tab */}
            <TabsContent value="input" className="space-y-6">
              <Card className="p-6">
                <div className="space-y-4">
                  {/* Topic */}
                  <div>
                    <Label htmlFor="topic" className="text-sm font-medium">
                      Video Topic *
                    </Label>
                    <Input
                      id="topic"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., How to Start a YouTube Channel in 2024"
                      className="mt-2"
                    />
                  </div>

                  {/* Context */}
                  <div>
                    <Label htmlFor="context" className="text-sm font-medium">
                      Context (Optional)
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1 mb-2">
                      Paste packaging output, video description, or additional context
                    </p>
                    <Textarea
                      id="context"
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      placeholder="Optional: Paste your video title, description, or chapters here..."
                      className="h-24 text-sm"
                    />
                  </div>

                  {/* Duration and Style */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="duration" className="text-sm font-medium">
                        Target Duration (minutes)
                      </Label>
                      <Input
                        id="duration"
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        placeholder="10"
                        min="1"
                        max="60"
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Script Style</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {(Object.keys(styleDescriptions) as ScriptStyle[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => setStyle(s)}
                            className={cn(
                              'px-3 py-2 rounded-lg border text-left transition-colors text-sm',
                              style === s
                                ? 'border-accent bg-accent/10 text-foreground'
                                : 'border-border bg-card text-muted-foreground hover:border-accent/50'
                            )}
                          >
                            <div className="font-medium capitalize">{s}</div>
                            <div className="text-xs opacity-70">{styleDescriptions[s]}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Key Points */}
                  <div>
                    <Label htmlFor="keyPoints" className="text-sm font-medium">
                      Key Points to Cover (Optional)
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1 mb-2">
                      List main topics or sections, one per line
                    </p>
                    <Textarea
                      id="keyPoints"
                      value={keyPoints}
                      onChange={(e) => setKeyPoints(e.target.value)}
                      placeholder="- Introduction to YouTube basics&#10;- Setting up your channel&#10;- Creating your first video&#10;- Growing your audience"
                      className="h-32 text-sm font-mono"
                    />
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || !topic.trim()}
                    className="w-full gap-2"
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <Sparkles className="h-4 w-4 animate-pulse" />
                        Generating Script...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate Video Script
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </TabsContent>

            {/* Output Tab */}
            <TabsContent value="output" className="space-y-6">
              {generatedScript && (
                <>
                  {/* Full Script Actions */}
                  <div className="flex justify-end">
                    <Button onClick={handleCopyFullScript} variant="default" className="gap-2">
                      <Copy className="h-4 w-4" />
                      Copy Full Script
                    </Button>
                  </div>

                  {/* Intro Section */}
                  <ScriptSectionCard
                    section={generatedScript.intro}
                    icon={<Film className="h-5 w-5 text-green-500" />}
                    onCopy={() => handleCopySection('Intro', generatedScript.intro.content)}
                    isCopied={copiedSection === 'Intro'}
                  />

                  {/* Main Content Sections */}
                  {generatedScript.mainContent.map((section, idx) => (
                    <ScriptSectionCard
                      key={idx}
                      section={section}
                      icon={<FileText className="h-5 w-5 text-blue-500" />}
                      onCopy={() => handleCopySection(section.title, section.content)}
                      isCopied={copiedSection === section.title}
                    />
                  ))}

                  {/* Outro Section */}
                  <ScriptSectionCard
                    section={generatedScript.outro}
                    icon={<Film className="h-5 w-5 text-purple-500" />}
                    onCopy={() => handleCopySection('Outro', generatedScript.outro.content)}
                    isCopied={copiedSection === 'Outro'}
                  />
                </>
              )}
            </TabsContent>
          </Tabs>
        </ToolContainer>
      </ToolBody>
    </ToolShell>
  )
}

function ScriptSectionCard({
  section,
  icon,
  onCopy,
  isCopied,
}: {
  section: ScriptSection
  icon: React.ReactNode
  onCopy: () => void
  isCopied: boolean
}) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <h3 className="text-lg font-semibold text-foreground">{section.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{section.timing}</span>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onCopy} className="gap-2">
          {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {isCopied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      {/* Script Content */}
      <div className="mb-4 p-4 bg-muted/50 rounded-lg">
        <ScrollArea className="max-h-[300px]">
          <pre className="text-sm text-foreground whitespace-pre-wrap font-sans">
            {section.content}
          </pre>
        </ScrollArea>
      </div>

      {/* B-roll Suggestions */}
      {section.brollSuggestions.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">B-Roll Suggestions:</p>
          <div className="flex flex-wrap gap-2">
            {section.brollSuggestions.map((suggestion, idx) => (
              <span
                key={idx}
                className="px-2 py-1 rounded text-xs bg-blue-500/10 text-blue-500 border border-blue-500/20"
              >
                {suggestion}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Transitions */}
      {section.transitions && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Transition:</p>
          <p className="text-sm text-foreground italic">{section.transitions}</p>
        </div>
      )}
    </Card>
  )
}
