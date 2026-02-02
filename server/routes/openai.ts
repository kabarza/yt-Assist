import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import OpenAI from 'openai'
import { CANVAS_SYSTEM_PROMPT } from '../utils/systemPrompt'

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
  webSearch?: boolean
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
  const { model, messages, stream = true, webSearch = false } = body

  const client = new OpenAI({ apiKey })

  if (stream) {
    return streamSSE(c, async (sseStream) => {
      try {
        // Use search-enabled model if web search is requested
        const modelToUse = webSearch
          ? (model || 'gpt-4o').includes('mini')
            ? 'gpt-4o-mini-search-preview'
            : 'gpt-4o-search-preview'
          : model || 'gpt-4o'

        const response = await client.chat.completions.create({
          model: modelToUse,
          messages: [
            { role: 'system', content: CANVAS_SYSTEM_PROMPT },
            ...toOpenAIMessages(messages),
          ],
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
      // Use search-enabled model if web search is requested
      const modelToUse = webSearch
        ? (model || 'gpt-4o').includes('mini')
          ? 'gpt-4o-mini-search-preview'
          : 'gpt-4o-search-preview'
        : model || 'gpt-4o'

      const response = await client.chat.completions.create({
        model: modelToUse,
        messages: [
          { role: 'system', content: CANVAS_SYSTEM_PROMPT },
          ...toOpenAIMessages(messages),
        ],
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
