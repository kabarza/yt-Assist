# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Development (frontend only - hot reload)
npm run dev

# Development (API server only - hot reload)
npm run dev:server

# Development (both frontend and server - hot reload)
npm run dev:all

# Production build
npm run build

# Run production server (serves static build + API)
npm run server

# Build and start production
npm run start
```

## TypeScript Compilation

The project uses three TypeScript configs:
- `tsconfig.json` - Main React frontend (src/)
- `tsconfig.server.json` - Backend server (server/)
- `tsconfig.node.json` - Vite config files

Run `tsc` to type-check frontend code. The build process automatically handles compilation.

## Environment Setup

Create `.env` file in the project root with:

```env
# Required for AI Chat functionality
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Optional
PORT=3000
```

**Important**: Never commit API keys. They are in `.gitignore`.

## Architecture Overview

### Frontend Architecture

This is a React SPA built with Vite. The app has two main features accessed via a sidebar:

1. **Packaging Tool** (`src/tools/packaging/`) - Generate YouTube video packaging materials from transcripts
2. **AI Chat** (`src/chat/`) - Chat interface with Claude/GPT with image support

**State Management**: Uses React hooks with localStorage persistence (no Redux/Zustand)
- `src/stores/templateStore.ts` - Template sections, output types, and presets for Packaging Tool
- `src/stores/chatStore.ts` - Chat history, messages, provider/model selection
- `src/stores/outputHistoryStore.ts` - History of generated packaging outputs
- `src/stores/canvasStore.ts` - Canvas/drawing state

**Routing**: No react-router. App navigation handled by `activeTool` state in `App.tsx`.

### Backend Architecture

Simple Hono-based API server (`server/index.ts`) that:
- Proxies requests to Anthropic/OpenAI APIs (handles streaming)
- Serves static frontend build in production
- Routes defined in `server/routes/anthropic.ts` and `server/routes/openai.ts`

API endpoints:
- `POST /api/chat/anthropic` - Claude chat (streaming)
- `POST /api/chat/openai` - GPT chat (streaming)
- `GET /api/health` - Health check

### Key Data Flows

**Packaging Tool Flow**:
1. User inputs transcript + settings in `InputsView.tsx`
2. Template system (`templateStore`) combines sections with user inputs
3. Generated prompt can be copied or sent to AI Chat
4. Template sections are drag-and-drop reorderable (`@dnd-kit/sortable`)

**AI Chat Flow**:
1. User types message in `ChatInput.tsx` (uses TipTap editor)
2. Can paste images (converted to base64)
3. Request sent to backend API route based on selected provider
4. Backend streams response from AI API
5. UI updates in real-time as chunks arrive (`ChatMessage.tsx`)

### Important Technical Details

**Template System**:
- Templates have sections (introduction, transcript, output specs, etc.)
- Sections support variable interpolation: `${transcript}`, `${mustInclude}`, etc.
- Output specs section is dynamically generated from `OutputType[]` configuration
- Users can create/save/load presets (entire template + output type configurations)

**LocalStorage Keys**:
- `yt-assist-template` - Template sections
- `yt-assist-output-types` - Output type configs
- `yt-assist-presets` - Saved presets
- `yt-assist-chats` - Chat history
- `yt-assist-output-history` - Packaging tool output history
- `yt-assist-canvas` - Canvas state

**Image Handling**:
- Images pasted in chat are converted to base64 data URLs
- Sent to backend with `mimeType` and `imageData` fields
- Backend routes transform to provider-specific format

**Development Server Setup**:
- Frontend dev server (Vite): `http://localhost:5173`
- Backend API server (Hono): `http://localhost:3000`
- Vite proxies `/api/*` requests to backend during development (see `vite.config.ts`)

## Styling

Uses Tailwind CSS with dark theme (`bg-gray-950`, `text-gray-*` scale). No custom CSS classes beyond Tailwind utilities.

Additional plugins:
- `@tailwindcss/typography` - For rendering markdown in chat messages

## Key Libraries

- **UI Components**: No component library (all custom React components)
- **Drag and Drop**: `@dnd-kit/core`, `@dnd-kit/sortable`
- **Rich Text Editor**: TipTap (for chat input with markdown support)
- **Markdown Rendering**: `react-markdown` + `remark-gfm`
- **Canvas Drawing**: `@excalidraw/excalidraw` (in CanvasPanel)

## Common Patterns

**Adding a new tool**:
1. Create component in `src/tools/<tool-name>/`
2. Add tool ID to `ToolId` type in `App.tsx`
3. Add case in `renderTool()` switch statement
4. Add navigation button in `Sidebar.tsx`

**Adding a new chat provider**:
1. Add provider to `Provider` type in `src/types/chat.ts`
2. Add models to `MODELS` object
3. Create route handler in `server/routes/<provider>.ts`
4. Register route in `server/index.ts`

**Adding a new template section**:
Sections are stored in localStorage. Modify `src/data/defaultTemplate.ts` to change defaults, but users customize via UI.

## Deployment Notes

**Static-only (no AI Chat backend)**:
- Deploy `dist/` folder to Vercel, Netlify, or GitHub Pages
- AI Chat will not work without backend

**Self-hosted (with AI Chat)**:
- Run `npm run start` (builds frontend + starts server)
- Server serves static files from `dist/` and provides API routes
- Requires API keys in environment variables
