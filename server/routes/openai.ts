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
  return messages.map((msg) => {
    if (msg.role === 'assistant') {
      const textContent = msg.content
        .filter((part) => part.type === 'text')
        .map((part) => part.text || '')
        .join('\n')

      return {
        role: 'assistant' as const,
        content: textContent,
      }
    }

    return {
      role: 'user' as const,
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
    }
  })
}

openaiRoute.post('/', async (c) => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return c.json({ error: 'OPENAI_API_KEY not configured' }, 500)
  }

  const body = await c.req.json<ChatRequest>()
  const { model, messages, stream = true, webSearch = false } = body

  const client = new OpenAI({ apiKey })

  // Only gpt-4o-search-preview / gpt-4o-mini-search-preview support web_search_options.
  // When enabled, swap to the appropriate search model regardless of what the user selected.
  const resolvedModel = webSearch
    ? ((model || '').includes('mini') ? 'gpt-4o-mini-search-preview' : 'gpt-4o-search-preview')
    : (model || 'gpt-4o')

  const params = {
    model: resolvedModel,
    messages: [
      { role: 'system' as const, content: CANVAS_SYSTEM_PROMPT },
      ...toOpenAIMessages(messages),
    ],
    ...(webSearch && { web_search_options: {} }),
  }

  if (stream) {
    return streamSSE(c, async (sseStream) => {
      try {
        // When web search is on, fire a parallel non-streaming request to capture
        // annotations — the streaming API does not include them in chunks.
        const annotationsPromise = webSearch
          ? client.chat.completions.create(params).then(r => r.choices[0]?.message?.annotations)
          : null

        const response = await client.chat.completions.create({ ...params, stream: true })

        for await (const chunk of response) {
          const text = chunk.choices[0]?.delta?.content
          if (text) {
            await sseStream.writeSSE({
              data: JSON.stringify({ type: 'delta', text }),
            })
          }
        }

        // Send citations once we have them (parallel request already in flight)
        if (annotationsPromise) {
          const annotations = await annotationsPromise
          if (annotations?.length) {
            const citations = annotations.map(a => ({
              title: a.url_citation.title,
              url: a.url_citation.url,
              start_index: a.url_citation.start_index,
              end_index: a.url_citation.end_index,
            }))
            await sseStream.writeSSE({
              data: JSON.stringify({ type: 'citations', citations }),
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
      const response = await client.chat.completions.create(params)

      const text = response.choices[0]?.message?.content || ''
      return c.json({ text })
    } catch (error) {
      console.error('OpenAI error:', error)
      return c.json({ error: String(error) }, 500)
    }
  }
})

export { openaiRoute }
