import 'dotenv/config'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { anthropicRoute } from './routes/anthropic'
import { openaiRoute } from './routes/openai'

const app = new Hono()

// Enable CORS for development
app.use('*', cors())

// API routes
app.route('/api/chat/anthropic', anthropicRoute)
app.route('/api/chat/openai', openaiRoute)

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok' }))

// Serve static files in production
app.use('/*', serveStatic({ root: './dist' }))

// Fallback to index.html for SPA routing
app.get('*', serveStatic({ path: './dist/index.html' }))

const port = parseInt(process.env.PORT || '3000')

console.log(`🚀 Server running at http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port,
})
