import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import Anthropic from '@anthropic-ai/sdk'

interface ContentPart {
  type: 'text' | 'image'
  text?: string
  imageData?: string
  mimeType?: string
}

interface Message {
  role: 'user' | 'assistant'
  content: ContentPart[]
}

interface ChatRequest {
  model: string
  messages: Message[]
  stream?: boolean
}

const anthropicRoute = new Hono()

// Convert our message format to Anthropic's format
function toAnthropicMessages(messages: Message[]): Anthropic.MessageParam[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content.map((part) => {
      if (part.type === 'image' && part.imageData) {
        // Extract base64 data from data URL
        const base64Match = part.imageData.match(/^data:([^;]+);base64,(.+)$/)
        if (base64Match) {
          return {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: base64Match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64Match[2],
            },
          }
        }
      }
      return {
        type: 'text' as const,
        text: part.text || '',
      }
    }),
  }))
}

anthropicRoute.post('/', async (c) => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500)
  }

  const body = await c.req.json<ChatRequest>()
  const { model, messages, stream = true } = body

  const client = new Anthropic({ apiKey })

  if (stream) {
    return streamSSE(c, async (sseStream) => {
      try {
        const response = await client.messages.stream({
          model: model || 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          messages: toAnthropicMessages(messages),
        })

        for await (const event of response) {
          if (event.type === 'content_block_delta') {
            const delta = event.delta
            if ('text' in delta) {
              await sseStream.writeSSE({
                data: JSON.stringify({ type: 'delta', text: delta.text }),
              })
            }
          }
        }

        await sseStream.writeSSE({
          data: JSON.stringify({ type: 'done' }),
        })
      } catch (error) {
        console.error('Anthropic streaming error:', error)
        await sseStream.writeSSE({
          data: JSON.stringify({ type: 'error', error: String(error) }),
        })
      }
    })
  } else {
    try {
      const response = await client.messages.create({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: toAnthropicMessages(messages),
      })

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('')

      return c.json({ text })
    } catch (error) {
      console.error('Anthropic error:', error)
      return c.json({ error: String(error) }, 500)
    }
  }
})

export { anthropicRoute }
