# YT-Assist

A web app with YouTube helper tools. Built with React, Vite, and Tailwind CSS.

## Features

### YouTube Packaging Tool
Generate high-CTR titles, thumbnails, descriptions, chapters, and hashtags from your video transcript.

- **Inputs View**: Paste your transcript or import it from a YouTube URL, then customize generation settings
- **Output View**: Copy the generated prompt or send it directly to AI Chat
- **Template Editor**: Drag-and-drop to reorder sections, toggle sections on/off, and edit content

### AI Chat
Chat with Claude or GPT directly in the app with support for images.

- **Multiple Providers**: Choose between Anthropic Claude or OpenAI GPT
- **Model Selection**: Pick from available models (Claude Sonnet 4, GPT-4o, etc.)
- **Image Support**: Paste screenshots or upload images to include in messages
- **Chat History**: All chats are stored locally and can be accessed anytime
- **Streaming Responses**: See AI responses in real-time as they're generated

### Image Gen
Generate images with Google's Nano Banana 2 or Nano Banana Pro models.

- **Text-to-Image**: Generate images from prompts alone
- **Image + Text**: Use one or more reference images to guide generations
- **Multiple Results**: Request 1, 2, or 4 outputs in one run
- **Browse & Download**: Review generated images in-app and download each result

## Development

```bash
# Install dependencies
npm install

# Run frontend only at http://localhost:5103
npm run dev

# Run API server only for development (http://localhost:3000)
npm run dev:server

# Run both frontend and API server
npm run dev:all

# Build or preview the frontend bundle
npm run build
npm run preview
```

`vite.config.ts` pins the frontend dev server to `http://127.0.0.1:5103` and proxies `/api` requests to `http://localhost:3000`. The standalone production server defaults to `http://localhost:5103`.

## Environment Variables

Create a `.env` file in the root directory:

```env
# Required for AI features you use
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
SUPADATA_API_KEY=sd-...

# Optional
# API server port for the standalone server (defaults to 5103)
PORT=5103
```

`npm run dev:server` explicitly uses port `3000` so the frontend dev server can stay on `5103`. If you change the API dev port, update the `/api` proxy target in `vite.config.ts` to match.

## Deploy (Self-Hosted)

For self-hosted deployment with AI Chat:

```bash
# Build and run
npm run start

# Or manually:
npm run build
npm run server
```

The production server serves the built frontend from `dist/` and exposes the AI chat API from the same Hono process.

## Deploy (Static Only)

If you only need the Packaging Tool without AI Chat, deploy to any static host:

Manual transcript paste works fine on a static deployment. Video URL transcript import requires the backend proxy so your Supadata key stays off the client.

### Vercel
```bash
npx vercel
```

### Netlify
```bash
npx netlify deploy --prod --dir=dist
```

### GitHub Pages
Push the `dist/` folder to a `gh-pages` branch.

## Project Structure

```
yt-assist/
├── server/            # API server (Hono)
│   ├── index.ts       # Server entry point
│   └── routes/        # API routes
│       ├── anthropic.ts
│       └── openai.ts
├── src/
│   ├── components/    # Shared UI components
│   │   └── Sidebar.tsx
│   ├── chat/          # AI Chat feature
│   │   ├── ChatPage.tsx
│   │   ├── ChatList.tsx
│   │   ├── ChatMessage.tsx
│   │   └── ChatInput.tsx
│   ├── tools/         # Tool modules
│   │   └── packaging/ # YouTube Packaging Tool
│   ├── stores/        # State management
│   │   ├── templateStore.ts
│   │   └── chatStore.ts
│   ├── data/          # Default templates
│   └── types/         # TypeScript types
│       ├── template.ts
│       └── chat.ts
└── dist/              # Production build output
```

## Template Variables

When editing templates, use these variables:

- `${transcript}` - Video transcript
- `${mustInclude}` - Words that must appear in titles
- `${niceToInclude}` - Words that would be nice to include
- `${avoidWords}` - Words/phrases to avoid
- `${hashtagCount}` - Number of hashtags to generate
- `${additionalContext}` - Extra instructions

## Adding New Tools

1. Create a new folder in `src/tools/`
2. Add your tool component
3. Update `src/App.tsx` to include the new tool
4. Add navigation in `src/components/Sidebar.tsx`

## API Endpoints

### POST /api/chat/anthropic
Chat with Claude models.

### POST /api/chat/openai
Chat with GPT models.

Both endpoints accept:
```json
{
  "model": "string",
  "messages": [
    {
      "role": "user|assistant",
      "content": [
        { "type": "text", "text": "..." },
        { "type": "image", "imageData": "base64...", "mimeType": "image/png" }
      ]
    }
  ],
  "stream": true
}
```

### POST /api/transcripts/import
Imports a transcript from a supported YouTube URL and writes it into the Packaging transcript box.

### GET /api/transcripts/import/:jobId
Polls an in-progress transcript generation job when the provider needs extra time.
