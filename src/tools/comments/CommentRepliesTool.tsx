import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { MessageSquare, Copy, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { requestChatText } from '@/utils/apiClient'
import { ToolBody, ToolContainer, ToolHeader, ToolShell } from '@/components/layout/ToolShell'
import { toast } from 'sonner'

type ToneStyle = 'friendly' | 'professional' | 'humorous' | 'helpful'

interface GeneratedReply {
  id: string
  comment: string
  replies: {
    tone: ToneStyle
    reply: string
  }[]
}

const toneDescriptions: Record<ToneStyle, string> = {
  friendly: 'Warm and approachable',
  professional: 'Polished and business-like',
  humorous: 'Light-hearted and funny',
  helpful: 'Informative and supportive',
}

export default function CommentRepliesTool() {
  const [comments, setComments] = useState('')
  const [selectedTones, setSelectedTones] = useState<ToneStyle[]>(['friendly', 'helpful'])
  const [customTone, setCustomTone] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedReplies, setGeneratedReplies] = useState<GeneratedReply[]>([])

  const handleGenerate = async () => {
    if (!comments.trim()) {
      toast.error('Please enter at least one comment')
      return
    }

    setIsGenerating(true)
    try {
      // Split comments by double newline (paragraph breaks)
      const commentList = comments
        .split(/\n\n+/)
        .map(c => c.trim())
        .filter(Boolean)

      const replies: GeneratedReply[] = []

      for (const comment of commentList) {
        const toneReplies = []

        for (const tone of selectedTones) {
          // Generate reply for this tone
          const reply = await generateReply(comment, tone, customTone)
          toneReplies.push({ tone, reply })
        }

        replies.push({
          id: Date.now().toString() + Math.random(),
          comment,
          replies: toneReplies,
        })
      }

      setGeneratedReplies(replies)
      toast.success(`Generated replies for ${commentList.length} comment(s)`)
    } catch (error) {
      toast.error('Failed to generate replies')
      console.error(error)
    } finally {
      setIsGenerating(false)
    }
  }

  const generateReply = async (
    comment: string,
    tone: ToneStyle,
    customInstructions?: string
  ): Promise<string> => {
    const toneInstructions = {
      friendly: 'warm, friendly, and conversational. Use casual language and show genuine interest.',
      professional: 'professional, polished, and well-structured. Maintain a business-appropriate tone.',
      humorous: 'lighthearted, fun, and entertaining. Add appropriate humor while staying respectful.',
      helpful: 'informative, supportive, and solution-oriented. Provide value and actionable advice.',
    }

    const prompt = `You are helping a YouTube creator respond to a comment. Generate a reply that is ${toneInstructions[tone]}

${customInstructions ? `Additional tone guidance: ${customInstructions}\n` : ''}
Comment: "${comment}"

Generate a brief, engaging reply (2-3 sentences maximum) that:
- Acknowledges the commenter
- Matches the specified tone
- Encourages further engagement
- Feels authentic and personal

Reply:`

    const result = await requestChatText({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    })

    return result.text?.trim() || ''
  }

  const handleCopyReply = (reply: string) => {
    navigator.clipboard.writeText(reply)
    toast.success('Reply copied to clipboard')
  }

  const handleToggleTone = (tone: ToneStyle) => {
    setSelectedTones(prev =>
      prev.includes(tone)
        ? prev.filter(t => t !== tone)
        : [...prev, tone]
    )
  }

  return (
    <ToolShell>
      <ToolHeader
        icon={MessageSquare}
        title="Comment Replies"
        description="Generate AI-powered replies to YouTube comments."
      />
      <ToolBody>
        <ToolContainer className="max-w-5xl">
          {/* Input Section */}
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="comments" className="text-sm font-medium">
                  Comments
                </Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  Paste one or multiple comments. Separate multiple comments with blank lines.
                </p>
                <Textarea
                  id="comments"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Example:

Great video! This really helped me understand the concept.

Could you make a follow-up video about...?

I disagree with your point about..."
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>

              {/* Tone Selection */}
              <div>
                <Label className="text-sm font-medium">Reply Tone(s)</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  Select one or more tones to generate different reply options
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(Object.keys(toneDescriptions) as ToneStyle[]).map((tone) => (
                    <button
                      key={tone}
                      onClick={() => handleToggleTone(tone)}
                      className={cn(
                        'px-4 py-3 rounded-lg border text-left transition-colors',
                        selectedTones.includes(tone)
                          ? 'border-accent bg-accent/10 text-foreground'
                          : 'border-border bg-card text-muted-foreground hover:border-accent/50'
                      )}
                    >
                      <div className="font-medium text-sm capitalize">{tone}</div>
                      <div className="text-xs opacity-70">{toneDescriptions[tone]}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Tone Instructions */}
              <div>
                <Label htmlFor="custom-tone" className="text-sm font-medium">
                  Custom Tone (Optional)
                </Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  Add specific instructions for your creator voice
                </p>
                <Textarea
                  id="custom-tone"
                  value={customTone}
                  onChange={(e) => setCustomTone(e.target.value)}
                  placeholder="Example: Always mention our community, use emojis, keep it under 50 words..."
                  className="h-20 text-sm"
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !comments.trim() || selectedTones.length === 0}
                className="w-full gap-2"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="h-4 w-4 animate-pulse" />
                    Generating Replies...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Replies
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Generated Replies */}
          {generatedReplies.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground">Generated Replies</h2>
              {generatedReplies.map((item) => (
                <Card key={item.id} className="p-6">
                  {/* Original Comment */}
                  <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">
                      Original Comment:
                    </p>
                    <p className="text-sm text-foreground">{item.comment}</p>
                  </div>

                  {/* Reply Options */}
                  <div className="space-y-3">
                    {item.replies.map((replyOption, idx) => (
                      <div
                        key={idx}
                        className="p-4 border border-border rounded-lg hover:border-accent transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent border border-accent/20 capitalize">
                                {replyOption.tone}
                              </span>
                            </div>
                            <p className="text-sm text-foreground">{replyOption.reply}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyReply(replyOption.reply)}
                            className="shrink-0"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ToolContainer>
      </ToolBody>
    </ToolShell>
  )
}
