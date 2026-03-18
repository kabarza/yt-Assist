import 'dotenv/config'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { anthropicRoute } from './routes/anthropic'
import { canvasRoute } from './routes/canvas'
import { geminiImagesRoute } from './routes/geminiImages'
import { openaiRoute } from './routes/openai'
import { transcriptRoute } from './routes/transcripts'

const app = new Hono()

// Enable CORS for development
app.use('*', cors())

// API routes
app.route('/api/chat/anthropic', anthropicRoute)
app.route('/api/chat/openai', openaiRoute)
app.route('/api/images/gemini', geminiImagesRoute)
app.route('/api/transcripts', transcriptRoute)
app.route('/api/canvas', canvasRoute)

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok' }))

// Serve static files in production
app.use('/*', serveStatic({ root: './dist' }))

// Fallback to index.html for SPA routing
app.get('*', serveStatic({ path: './dist/index.html' }))

const port = parseInt(process.env.PORT || '5103')

console.log(`🚀 Server running at http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port,
})
