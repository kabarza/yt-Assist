import type { Provider, ContentPart } from '../types/chat'
import type { TitleVariant } from '../components/TitleVariantsView'
import { requestChatText } from './apiClient'

// Extract title from AI response text
export function extractTitle(text: string): string | null {
  // Try to find title in various formats
  const patterns = [
    /(?:^|\n)(?:##?\s*)?Title[:\s]+([^\n]+)/i,
    /(?:^|\n)(?:##?\s*)?Video Title[:\s]+([^\n]+)/i,
    /(?:^|\n)\*\*Title[:\s]*\*\*[:\s]*([^\n]+)/i,
    /(?:^|\n)Title:\s*"([^"]+)"/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      return match[1].trim().replace(/^["']|["']$/g, '')
    }
  }

  return null
}

// Generate prompt for title variants
export function generateVariantsPrompt(originalTitle: string, context?: string): string {
  return `I need 5 alternative title variations for a YouTube video. The original title is: "${originalTitle}"

${context ? `Context about the video: ${context}\n` : ''}
Generate 5 title variants, each using a different psychological angle:
1. **Curiosity-driven**: Create intrigue and mystery
2. **Benefit-focused**: Emphasize what viewers will gain
3. **Urgency/FOMO**: Create time-sensitivity or fear of missing out
4. **Question-based**: Pose an intriguing question
5. **Direct/Straightforward**: Clear and to-the-point

For each variant, also suggest 2-4 words of text that could go on the thumbnail.

Format your response exactly like this:

1. CURIOSITY: [title]
   Thumbnail: [text]

2. BENEFIT: [title]
   Thumbnail: [text]

3. URGENCY: [title]
   Thumbnail: [text]

4. QUESTION: [title]
   Thumbnail: [text]

5. DIRECT: [title]
   Thumbnail: [text]

Keep titles under 70 characters and make them compelling for YouTube.`
}

// Parse AI response into structured variants
export function parseVariantsResponse(text: string): TitleVariant[] {
  const variants: TitleVariant[] = []

  const angleMap: Record<string, TitleVariant['angle']> = {
    'CURIOSITY': 'curiosity',
    'BENEFIT': 'benefit',
    'URGENCY': 'urgency',
    'QUESTION': 'question',
    'DIRECT': 'direct',
  }

  // Split by numbered items
  const sections = text.split(/\d+\.\s+/)

  for (const section of sections) {
    if (!section.trim()) continue

    // Extract angle and title
    const angleMatch = section.match(/^(CURIOSITY|BENEFIT|URGENCY|QUESTION|DIRECT):\s*(.+?)(?:\n|$)/i)
    if (!angleMatch) continue

    const angleKey = angleMatch[1].toUpperCase()
    const title = angleMatch[2].trim()
    const angle = angleMap[angleKey]

    if (!angle) continue

    // Extract thumbnail text
    const thumbnailMatch = section.match(/Thumbnail:\s*(.+?)(?:\n|$)/i)
    const thumbnailText = thumbnailMatch ? thumbnailMatch[1].trim() : undefined

    variants.push({
      title,
      angle,
      thumbnailText,
    })
  }

  return variants
}

// Generate title variants using AI
export async function generateTitleVariants(
  originalTitle: string,
  provider: Provider,
  model: string,
  context?: string
): Promise<TitleVariant[]> {
  const prompt = generateVariantsPrompt(originalTitle, context)

  const result = await requestChatText({
    provider,
    model,
    messages: [{
      role: 'user',
      content: [{ type: 'text', text: prompt }] as ContentPart[],
    }],
  })

  return parseVariantsResponse(result.text || '')
}
