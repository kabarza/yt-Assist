import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import OpenAI from 'openai'

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

const openaiRoute = new Hono()

// Convert our message format to OpenAI's format
function toOpenAIMessages(messages: Message[]): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content.map((part) => {
      if (part.type === 'image' && part.imageData) {
        return {
          type: 'image_url' as const,
          image_url: {
            url: part.imageData,
          },
        }
      }
      return {
        type: 'text' as const,
        text: part.text || '',
      }
    }),
  }))
}

openaiRoute.post('/', async (c) => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return c.json({ error: 'OPENAI_API_KEY not configured' }, 500)
  }

  const body = await c.req.json<ChatRequest>()
  const { model, messages, stream = true } = body

  const client = new OpenAI({ apiKey })

  if (stream) {
    return streamSSE(c, async (sseStream) => {
      try {
        const response = await client.chat.completions.create({
          model: model || 'gpt-4o',
          messages: toOpenAIMessages(messages),
          stream: true,
        })

        for await (const chunk of response) {
          const text = chunk.choices[0]?.delta?.content
          if (text) {
            await sseStream.writeSSE({
              data: JSON.stringify({ type: 'delta', text }),
            })
          }
        }

        await sseStream.writeSSE({
          data: JSON.stringify({ type: 'done' }),
        })
      } catch (error) {
        console.error('OpenAI streaming error:', error)
        await sseStream.writeSSE({
          data: JSON.stringify({ type: 'error', error: String(error) }),
        })
      }
    })
  } else {
    try {
      const response = await client.chat.completions.create({
        model: model || 'gpt-4o',
        messages: toOpenAIMessages(messages),
      })

      const text = response.choices[0]?.message?.content || ''
      return c.json({ text })
    } catch (error) {
      console.error('OpenAI error:', error)
      return c.json({ error: String(error) }, 500)
    }
  }
})

export { openaiRoute }
