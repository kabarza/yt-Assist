import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Copy, Check, Sparkles, Clock, Film } from 'lucide-react'
import { cn } from '@/lib/utils'
import { requestChatText } from '@/utils/apiClient'
import { ToolBody, ToolContainer, ToolHeader, ToolShell } from '@/components/layout/ToolShell'
import { toast } from 'sonner'
import { parseScriptView, type ScriptView, updateViewSearchParams } from '@/navigation/views'
import type { GeneratedScript, ScriptStyle } from '@/types/toolSessions'
import { useScriptToolStore } from '@/stores/scriptToolStore'

const styleDescriptions: Record<ScriptStyle, string> = {
  casual: 'Conversational and relatable',
  formal: 'Professional and polished',
  energetic: 'Upbeat and enthusiastic',
  educational: 'Clear and instructive',
}

export default function VideoScriptTool() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeView = parseScriptView(searchParams.get('view'))
  const [isGenerating, setIsGenerating] = useState(false)
  const [copiedSection, setCopiedSection] = useState<string | null>(null)
  const {
    topic,
    context,
    duration,
    style,
    keyPoints,
    generatedScript,
    setTopic,
    setContext,
    setDuration,
    setStyle,
    setKeyPoints,
    setGeneratedScript,
  } = useScriptToolStore()

  const setActiveView = (view: ScriptView) => {
    setSearchParams(updateViewSearchParams(searchParams, view, 'input'))
  }

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error('Please enter a video topic')
      return
    }

    setIsGenerating(true)
    try {
      const script = await generateScript(topic, context, duration, style, keyPoints)
      setGeneratedScript(script)
      setActiveView('output')
      toast.success('Script generated successfully!')
    } catch (error) {
      toast.error('Failed to generate script')
      console.error(error)
    } finally {
      setIsGenerating(false)
    }
  }

  const generateScript = async (
    nextTopic: string,
    nextContext: string,
    nextDuration: string,
    nextStyle: ScriptStyle,
    nextKeyPoints: string,
  ): Promise<GeneratedScript> => {
    const styleInstructions = {
      casual:
        'Use a conversational, friendly tone. Speak directly to the viewer as if talking to a friend. Use contractions and natural language.',
      formal:
        'Maintain a professional, polished tone. Use complete sentences and sophisticated vocabulary. Be authoritative but approachable.',
      energetic:
        'Be enthusiastic and upbeat! Use exclamation points, dynamic language, and keep the energy high throughout.',
      educational:
        'Focus on clarity and instruction. Break down concepts step-by-step. Use examples and explanations that help viewers learn.',
    }

    const durationInt = parseInt(nextDuration, 10) || 10
    const wordCount = durationInt * 150

    const prompt = `You are a professional YouTube video script writer. Generate a complete, detailed video script.

Video Topic: ${nextTopic}
${nextContext ? `Context/Additional Info: ${nextContext}\n` : ''}
Target Duration: ${durationInt} minutes (~${wordCount} words)
Script Style: ${nextStyle} - ${styleInstructions[nextStyle]}
${nextKeyPoints ? `Key Points to Cover:\n${nextKeyPoints}\n` : ''}

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
    return parseScript(result.text?.trim() || '')
  }

  const parseScript = (scriptText: string): GeneratedScript => {
    const sections = scriptText.split(/(?=\[[\d-]+)/g).filter(Boolean)

    const intro = {
      title: 'Intro/Hook',
      content: sections[0] || '',
      timing: '0:00-0:30',
      brollSuggestions: extractBroll(sections[0] || ''),
      transitions: extractTransitions(sections[0] || ''),
    }

    const mainContent = sections.slice(1, -1).map((section, index) => ({
      title: `Segment ${index + 1}`,
      content: section,
      timing: `${index + 1}:00-${index + 2}:00`,
      brollSuggestions: extractBroll(section),
      transitions: extractTransitions(section),
    }))

    const outro = {
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
    if (!match) return []

    return match[1]
      .split(/[,\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
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
        title="Video Script Writer"
        description="Write structured scripts with scene timing and keep the working draft intact across navigation."
      />
      <ToolBody className="overflow-y-auto">
        <ToolContainer>
          <Tabs
            value={activeView}
            onValueChange={(value) => setActiveView(value as ScriptView)}
            className="space-y-6"
          >
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="input">Input</TabsTrigger>
              <TabsTrigger value="output" disabled={!generatedScript}>
                Generated Script
              </TabsTrigger>
            </TabsList>

            <TabsContent value="input" className="space-y-6">
              <Card className="p-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="topic" className="text-sm font-medium">
                      Video Topic *
                    </Label>
                    <Input
                      id="topic"
                      value={topic}
                      onChange={(event) => setTopic(event.target.value)}
                      placeholder="e.g., How to Start a YouTube Channel in 2024"
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="context" className="text-sm font-medium">
                      Context (Optional)
                    </Label>
                    <p className="mb-2 mt-1 text-xs text-muted-foreground">
                      Paste packaging output, video description, or additional context.
                    </p>
                    <Textarea
                      id="context"
                      value={context}
                      onChange={(event) => setContext(event.target.value)}
                      placeholder="Optional: Paste your video title, description, or chapters here..."
                      className="h-24 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="duration" className="text-sm font-medium">
                        Target Duration (minutes)
                      </Label>
                      <Input
                        id="duration"
                        type="number"
                        value={duration}
                        onChange={(event) => setDuration(event.target.value)}
                        placeholder="10"
                        min="1"
                        max="60"
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Script Style</Label>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {(Object.keys(styleDescriptions) as ScriptStyle[]).map((entry) => (
                          <button
                            key={entry}
                            onClick={() => setStyle(entry)}
                            className={cn(
                              'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                              style === entry
                                ? 'border-accent bg-accent/10 text-foreground'
                                : 'border-border bg-card text-muted-foreground hover:border-accent/50',
                            )}
                          >
                            <div className="font-medium capitalize">{entry}</div>
                            <div className="text-xs opacity-70">{styleDescriptions[entry]}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="keyPoints" className="text-sm font-medium">
                      Key Points to Cover (Optional)
                    </Label>
                    <p className="mb-2 mt-1 text-xs text-muted-foreground">
                      List the main topics, examples, or beats the script should cover.
                    </p>
                    <Textarea
                      id="keyPoints"
                      value={keyPoints}
                      onChange={(event) => setKeyPoints(event.target.value)}
                      placeholder="Example:
- Start with a compelling hook
- Explain the setup process
- Cover common mistakes
- End with a strong CTA"
                      className="min-h-[120px] text-sm"
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
                        Generate Script
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="output" className="space-y-6">
              {!generatedScript ? (
                <Card className="p-8 text-center text-sm text-muted-foreground">
                  Generate a script to review structured sections here.
                </Card>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">Generated Script</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Review each section or copy the full script.
                      </p>
                    </div>
                    <Button onClick={handleCopyFullScript} className="gap-2">
                      <Copy className="h-4 w-4" />
                      Copy Full Script
                    </Button>
                  </div>

                  <Card className="overflow-hidden">
                    <ScrollArea className="h-[70vh]">
                      <div className="space-y-6 p-6">
                        {[generatedScript.intro, ...generatedScript.mainContent, generatedScript.outro].map((section) => (
                          <div key={`${section.title}-${section.timing}`} className="rounded-xl border border-border/70 p-5">
                            <div className="mb-4 flex items-start justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Film className="h-4 w-4 text-accent" />
                                  <h3 className="text-lg font-semibold text-foreground">{section.title}</h3>
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                                  <Clock className="h-3.5 w-3.5" />
                                  {section.timing}
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => handleCopySection(section.title, section.content)}
                              >
                                {copiedSection === section.title ? (
                                  <>
                                    <Check className="h-4 w-4" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-4 w-4" />
                                    Copy
                                  </>
                                )}
                              </Button>
                            </div>

                            <div className="space-y-4">
                              <div>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                  Script
                                </p>
                                <div className="whitespace-pre-wrap rounded-lg bg-muted/35 p-4 text-sm leading-7 text-foreground">
                                  {section.content}
                                </div>
                              </div>

                              {section.brollSuggestions.length > 0 ? (
                                <div>
                                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    B-Roll Suggestions
                                  </p>
                                  <ul className="space-y-1 text-sm text-foreground">
                                    {section.brollSuggestions.map((suggestion) => (
                                      <li key={suggestion} className="rounded-lg bg-muted/20 px-3 py-2">
                                        {suggestion}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}

                              {section.transitions ? (
                                <div>
                                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    Transition
                                  </p>
                                  <p className="rounded-lg bg-muted/20 px-3 py-2 text-sm text-foreground">
                                    {section.transitions}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
        </ToolContainer>
      </ToolBody>
    </ToolShell>
  )
}
