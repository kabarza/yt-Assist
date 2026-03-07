import type { SEOKeywords, SearchVolume } from '../types/seo'
import { requestChatText } from './apiClient'

const SEO_PROMPT = `Analyze the following transcript and extract SEO keywords for YouTube optimization.

Provide keywords in three categories:
1. PRIMARY KEYWORDS (3-5 main topics): Core themes that best represent the video content
2. SECONDARY KEYWORDS (5-8 supporting topics): Related concepts and subtopics
3. LONG-TAIL KEYWORDS (5-10 specific phrases): Detailed search phrases users might type (2-4 words each)

For each keyword, estimate search volume as: HIGH (very common searches), MEDIUM (moderate searches), or LOW (niche searches).

Format your response EXACTLY as follows (this is critical for parsing):

PRIMARY:
- keyword | volume
- keyword | volume
...

SECONDARY:
- keyword | volume
- keyword | volume
...

LONG-TAIL:
- keyword phrase | volume
- keyword phrase | volume
...

Transcript:
`

function parseSearchVolume(volumeStr: string): SearchVolume {
  const vol = volumeStr.trim().toLowerCase()
  if (vol === 'high') return 'high'
  if (vol === 'medium') return 'medium'
  return 'low'
}

function parseSEOResponse(response: string): SEOKeywords {
  const result: SEOKeywords = {
    primary: [],
    secondary: [],
    longTail: [],
  }

  // Split by sections
  const primaryMatch = response.match(/PRIMARY:([\s\S]*?)(?=SECONDARY:|$)/i)
  const secondaryMatch = response.match(/SECONDARY:([\s\S]*?)(?=LONG-TAIL:|$)/i)
  const longTailMatch = response.match(/LONG-TAIL:([\s\S]*?)$/i)

  const parseSection = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim().startsWith('-'))
    return lines.map(line => {
      const cleaned = line.replace(/^-\s*/, '')
      const parts = cleaned.split('|')
      const keyword = parts[0]?.trim() || ''
      const volume = parts[1] ? parseSearchVolume(parts[1]) : 'medium'
      return { keyword, volume }
    }).filter(item => item.keyword.length > 0)
  }

  if (primaryMatch) {
    result.primary = parseSection(primaryMatch[1])
  }

  if (secondaryMatch) {
    result.secondary = parseSection(secondaryMatch[1])
  }

  if (longTailMatch) {
    result.longTail = parseSection(longTailMatch[1])
  }

  return result
}

export async function generateSEOKeywords(
  transcript: string,
  provider: 'openai' | 'anthropic' = 'openai'
): Promise<SEOKeywords> {
  const model = provider === 'openai' ? 'gpt-4.1' : 'claude-sonnet-4-20250514'

  const result = await requestChatText({
    provider,
    model,
    messages: [{
      role: 'user',
      content: [{
        type: 'text',
        text: SEO_PROMPT + transcript.slice(0, 8000),
      }],
    }],
  })

  return parseSEOResponse(result.text || '')
}
